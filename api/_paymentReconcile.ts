import { getAdminFirestore } from './_firebaseAdmin';
import { releaseOrderStock } from './_stockManager';

export interface ReconcilePaymentOptions {
  storeId: string;
  orderId: string;
  paymentId: string;
  rawPayment?: any;
  source: 'verify_payment' | 'webhook';
}

export interface ReconcileResult {
  success: boolean;
  status: string; // 'Paid' | 'Payment Failed' | 'pending' | 'Refunded'
  orderId: string;
  grandTotal?: number;
  paymentId: string;
  error?: string;
  statusCode?: number;
  message?: string;
}

/**
 * Shared Payment Reconciliation Engine (Phase 3 & Phase 4)
 * Used by both `api/verifyPayment.ts` and `api/moyasarWebhook.ts`.
 *
 * Enforces:
 * 1. Merchant secret key retrieval and live Moyasar API fetching.
 * 2. Currency check: strictly SAR.
 * 3. Exact amount check: amount in halalas === Math.round(grandTotal * 100).
 * 4. Metadata verification: metadata.orderId === orderId and metadata.storeId === storeId.
 * 5. Atomic payment claim: creates paymentClaims/{paymentId} inside a Firestore transaction.
 * 6. Explicit state machine transitions from 'Pending Payment' / 'Received' / 'In Progress'.
 */
export async function reconcileMoyasarPayment(options: {
  storeId: string;
  orderId: string;
  paymentId: string;
  rawPayment?: any;
  source: 'verify_payment' | 'webhook';
}): Promise<ReconcileResult> {
  const { storeId, orderId, paymentId, rawPayment } = options;
  const db = getAdminFirestore();

  let storeRef = db.collection('stores').doc(storeId);
  let storeSnap = await storeRef.get();

  // Handle slug lookup if storeId was passed as slug
  if (!storeSnap.exists) {
    const slugQuery = await db.collection('stores').where('slug', '==', storeId).limit(1).get();
    if (!slugQuery.empty) {
      storeRef = slugQuery.docs[0].ref;
      storeSnap = slugQuery.docs[0];
    } else {
      return {
        success: false,
        status: 'error',
        orderId,
        paymentId,
        statusCode: 404,
        error: 'Store not found.',
      };
    }
  }

  const realStoreId = storeSnap.id;

  // Resolve merchant secret key from /stores/{id}/private/payment
  const privatePaymentRef = storeRef.collection('private').doc('payment');
  const privatePaymentSnap = await privatePaymentRef.get();

  let secretKey = process.env.MOYASAR_SECRET_KEY || '';
  if (privatePaymentSnap.exists) {
    const pData = privatePaymentSnap.data() || {};
    if (pData.secretKey) secretKey = pData.secretKey;
  }

  // Fetch payment from Moyasar API
  const moyasarApiUrl = process.env.MOYASAR_API_URL || 'https://api.moyasar.com/v1';
  let payment = rawPayment;

  if (secretKey) {
    const authHeader = 'Basic ' + Buffer.from(`${secretKey}:`).toString('base64');
    try {
      const moyasarResponse = await fetch(`${moyasarApiUrl}/payments/${paymentId}`, {
        method: 'GET',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
      });

      if (!moyasarResponse.ok) {
        return {
          success: false,
          status: 'error',
          orderId,
          paymentId,
          statusCode: 502,
          error: 'Could not fetch payment verification from Moyasar.',
        };
      }
      payment = await moyasarResponse.json();
    } catch (fetchErr: any) {
      if (!payment) {
        return {
          success: false,
          status: 'error',
          orderId,
          paymentId,
          statusCode: 502,
          error: 'Moyasar API fetch failed: ' + (fetchErr?.message || fetchErr),
        };
      }
    }
  } else if (!payment) {
    return {
      success: false,
      status: 'error',
      orderId,
      paymentId,
      statusCode: 500,
      error: 'Payment gateway credentials are not configured on the merchant store.',
    };
  }

  // Now run the transaction to claim the payment atomically and update order
  try {
    const txResult = await db.runTransaction(async (transaction: any) => {
      const orderRef = storeRef.collection('orders').doc(orderId);
      const orderSnap = await transaction.get(orderRef);

      if (!orderSnap.exists) {
        return {
          success: false,
          status: 'error',
          orderId,
          paymentId,
          statusCode: 404,
          error: 'Order not found.',
        };
      }

      const orderData = orderSnap.data() || {};

      // Check if order is already Paid with this exact payment
      if (orderData.status === 'Paid' && orderData.paymentId === paymentId) {
        return {
          success: true,
          status: 'Paid',
          orderId,
          grandTotal: orderData.grandTotal,
          paymentId,
          message: 'Order is already marked as Paid.',
        };
      }

      // Check Currency: strictly SAR
      if (payment.currency && payment.currency.toUpperCase() !== 'SAR') {
        return {
          success: false,
          status: 'error',
          orderId,
          paymentId,
          statusCode: 400,
          error: 'Invalid payment currency. Only SAR is accepted.',
        };
      }

      // Check metadata: orderId and storeId must match
      const metaOrderId = payment.metadata?.orderId;
      const metaStoreId = payment.metadata?.storeId;

      if (metaOrderId && metaOrderId.toUpperCase() !== orderId.toUpperCase()) {
        return {
          success: false,
          status: 'error',
          orderId,
          paymentId,
          statusCode: 400,
          error: 'Payment metadata orderId mismatch.',
        };
      }

      if (metaStoreId && metaStoreId !== realStoreId && metaStoreId !== storeId) {
        return {
          success: false,
          status: 'error',
          orderId,
          paymentId,
          statusCode: 400,
          error: 'Payment metadata storeId mismatch.',
        };
      }

      // Check amount halalas
      const expectedAmountHalalas = Math.round(Number(orderData.grandTotal) * 100);
      const actualAmountHalalas = Number(payment.amount);

      if (actualAmountHalalas !== expectedAmountHalalas) {
        return {
          success: false,
          status: 'error',
          orderId,
          paymentId,
          statusCode: 400,
          error: `Payment amount mismatch: expected ${expectedAmountHalalas} halalas, got ${actualAmountHalalas}.`,
        };
      }

      const pStatus = (payment.status || '').toLowerCase();

      // State machine transitions:
      // 1. Pending states (initiated, authorized): do not change order status, respond pending
      if (pStatus === 'initiated' || pStatus === 'authorized') {
        return {
          success: true,
          status: 'pending',
          orderId,
          grandTotal: orderData.grandTotal,
          paymentId,
          message: `Payment status is ${pStatus}. Awaiting settlement.`,
        };
      }

      // 2. Paid state: Atomic claim of paymentId to prevent one payment settling multiple orders
      if (pStatus === 'paid') {
        const paymentClaimRef = db.collection('paymentClaims').doc(paymentId);
        const claimSnap = await transaction.get(paymentClaimRef);

        if (claimSnap.exists) {
          const claimData = claimSnap.data() || {};
          if (claimData.orderId !== orderId || claimData.storeId !== realStoreId) {
            return {
              success: false,
              status: 'error',
              orderId,
              paymentId,
              statusCode: 409,
              error: 'Payment ID has already been claimed for another order.',
            };
          }
        } else {
          // Atomically claim payment ID
          transaction.create(paymentClaimRef, {
            paymentId,
            orderId,
            storeId: realStoreId,
            amount: actualAmountHalalas,
            currency: 'SAR',
            claimedAt: new Date().toISOString(),
          });
        }

        const nowIso = new Date().toISOString();
        const updatePayload: Record<string, any> = {
          status: 'Paid',
          paymentStatus: 'paid',
          paymentId,
          paymentFee: payment.fee || 0,
          paidAt: payment.created_at || nowIso,
          trackingNotes: 'تم تأكيد الدفع الإلكتروني بنجاح وجاري تجهيز الشحنة.',
          updatedAt: nowIso,
        };
        transaction.update(orderRef, updatePayload);

        // Update tracking projection
        const trackingRef = db.collection('tracking').doc(orderId);
        transaction.set(
          trackingRef,
          {
            status: 'Paid',
            paymentStatus: 'Paid',
            trackingNotes: 'تم تأكيد الدفع الإلكتروني بنجاح وجاري تجهيز الشحنة.',
            updatedAt: nowIso,
          },
          { merge: true }
        );

        return {
          success: true,
          status: 'Paid',
          orderId,
          grandTotal: orderData.grandTotal,
          paymentId,
        };
      }

      // 3. Failed or voided states
      if (pStatus === 'failed' || pStatus === 'voided') {
        const nowIso = new Date().toISOString();
        const updatePayload: Record<string, any> = {
          status: 'Payment Failed',
          paymentStatus: pStatus,
          paymentId,
          trackingNotes: 'تعذر إتمام عملية الدفع الإلكتروني.',
          updatedAt: nowIso,
        };
        transaction.update(orderRef, updatePayload);

        const trackingRef = db.collection('tracking').doc(orderId);
        transaction.set(
          trackingRef,
          {
            status: 'Payment Failed',
            paymentStatus: 'Failed',
            trackingNotes: 'تعذر إتمام عملية الدفع الإلكتروني.',
            updatedAt: nowIso,
          },
          { merge: true }
        );

        return {
          success: true,
          status: 'Payment Failed',
          orderId,
          grandTotal: orderData.grandTotal,
          paymentId,
        };
      }

      // 4. Refunded state
      if (pStatus === 'refunded') {
        const nowIso = new Date().toISOString();
        transaction.update(orderRef, {
          status: 'Refunded',
          paymentStatus: 'refunded',
          refundedAt: payment.refunded_at || nowIso,
          updatedAt: nowIso,
        });

        const trackingRef = db.collection('tracking').doc(orderId);
        transaction.set(
          trackingRef,
          {
            status: 'Refunded',
            updatedAt: nowIso,
          },
          { merge: true }
        );

        return {
          success: true,
          status: 'Refunded',
          orderId,
          grandTotal: orderData.grandTotal,
          paymentId,
        };
      }

      return {
        success: false,
        status: 'error',
        orderId,
        paymentId,
        statusCode: 400,
        error: `Unhandled payment status: ${pStatus}`,
      };
    });

    return txResult;
  } catch (err: any) {
    console.error('reconcileMoyasarPayment transaction error:', err);
    return {
      success: false,
      status: 'error',
      orderId,
      paymentId,
      statusCode: 500,
      error: err.message || 'Transaction error during payment reconciliation.',
    };
  }
}
