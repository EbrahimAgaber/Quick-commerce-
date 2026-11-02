import { handleCors, evaluateRateLimit, setRateLimitHeaders, getClientIp } from './_security';
import { getAdminFirestore } from './_firebaseAdmin';
import { PaylinkGateway } from './_paylinkService';

/**
 * Reconciles a Paylink transaction by querying Paylink GET /api/getInvoice/{transactionNo}
 * and atomically updating the order state to Paid if successful.
 */
export async function reconcilePaylinkPayment(options: {
  storeId: string;
  orderId: string;
  transactionNo: string;
  source?: 'verify_payment' | 'webhook';
}) {
  const { storeId, orderId, transactionNo } = options;
  const db = getAdminFirestore();

  let storeRef = db.collection('stores').doc(storeId);
  let storeSnap = await storeRef.get();

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
        paymentId: transactionNo,
        statusCode: 404,
        error: 'Store not found.',
      };
    }
  }

  const realStoreId = storeSnap.id;
  const storeData = storeSnap.data() || {};
  const storeSettings = storeData.settings || {};

  // Resolve private credentials
  const privatePaymentRef = storeRef.collection('private').doc('payment');
  const privatePaymentSnap = await privatePaymentRef.get();
  const privateData = privatePaymentSnap.exists ? privatePaymentSnap.data() || {} : {};

  const apiId =
    privateData.paylinkApiId ||
    storeSettings.paylinkApiId ||
    process.env.PAYLINK_API_ID ||
    PaylinkGateway.DEFAULT_SANDBOX_API_ID;

  const secretKey =
    privateData.paylinkSecretKey ||
    storeSettings.paylinkSecretKey ||
    process.env.PAYLINK_SECRET_KEY ||
    PaylinkGateway.DEFAULT_SANDBOX_SECRET;

  const isTestMode =
    storeSettings.paylinkTestMode !== false &&
    (storeSettings.paylinkTestMode === true ||
      apiId.startsWith('APP_ID_') ||
      process.env.PAYLINK_MODE === 'test');

  let invoiceDetails: any;
  try {
    invoiceDetails = await PaylinkGateway.getInvoice({ apiId, secretKey, isTestMode }, transactionNo);
  } catch (fetchErr: any) {
    return {
      success: false,
      status: 'error',
      orderId,
      paymentId: transactionNo,
      statusCode: 502,
      error: 'Paylink getInvoice check failed: ' + (fetchErr?.message || fetchErr),
    };
  }

  // Atomic state transaction
  return await db.runTransaction(async (transaction: any) => {
    const orderRef = storeRef.collection('orders').doc(orderId);
    const orderSnap = await transaction.get(orderRef);

    if (!orderSnap.exists) {
      return {
        success: false,
        status: 'error',
        orderId,
        paymentId: transactionNo,
        statusCode: 404,
        error: 'Order not found.',
      };
    }

    const orderData = orderSnap.data() || {};

    // Already Paid check (idempotency)
    if (orderData.status === 'Paid' && (orderData.paymentId === transactionNo || orderData.paylinkTransactionNo === transactionNo)) {
      return {
        success: true,
        status: 'Paid',
        orderId,
        grandTotal: orderData.grandTotal,
        paymentId: transactionNo,
        message: 'Order is already marked as Paid.',
      };
    }

    // Verify orderNumber matches
    if (invoiceDetails.orderNumber && invoiceDetails.orderNumber.toUpperCase() !== orderId.toUpperCase()) {
      return {
        success: false,
        status: 'error',
        orderId,
        paymentId: transactionNo,
        statusCode: 400,
        error: 'Payment orderNumber mismatch.',
      };
    }

    // Amount match check
    const expectedAmount = Number(orderData.grandTotal || 0);
    const actualAmount = Number(invoiceDetails.amount || 0);

    if (Math.abs(actualAmount - expectedAmount) > 0.05) {
      return {
        success: false,
        status: 'error',
        orderId,
        paymentId: transactionNo,
        statusCode: 400,
        error: `Payment amount mismatch: expected ${expectedAmount} SAR, got ${actualAmount} SAR.`,
      };
    }

    const orderStatusStr = (invoiceDetails.orderStatus || '').toLowerCase();

    if (orderStatusStr === 'paid') {
      const paymentClaimRef = db.collection('paymentClaims').doc(transactionNo);
      const claimSnap = await transaction.get(paymentClaimRef);

      if (claimSnap.exists) {
        const claimData = claimSnap.data() || {};
        if (claimData.orderId !== orderId || claimData.storeId !== realStoreId) {
          return {
            success: false,
            status: 'error',
            orderId,
            paymentId: transactionNo,
            statusCode: 409,
            error: 'Paylink transaction has already been claimed for another order.',
          };
        }
      } else {
        transaction.create(paymentClaimRef, {
          paymentId: transactionNo,
          orderId,
          storeId: realStoreId,
          amount: actualAmount,
          currency: 'SAR',
          gateway: 'paylink',
          claimedAt: new Date().toISOString(),
        });
      }

      const paymentMethod = invoiceDetails.paymentReceipt?.paymentMethod || 'Paylink (Mada / Apple Pay / Card)';
      const updatedOrder = {
        ...orderData,
        status: 'Paid',
        paymentStatus: 'paid',
        paymentId: transactionNo,
        paylinkTransactionNo: transactionNo,
        paymentMethod,
        paidAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        paymentReceiptUrl: invoiceDetails.paymentReceipt?.receiptUrl || '',
      };

      transaction.update(orderRef, updatedOrder);

      // Public tracking sync
      const trackingDocRef = db.collection('tracking').doc(orderId);
      transaction.set(
        trackingDocRef,
        {
          orderId,
          storeId: realStoreId,
          status: 'Paid',
          paymentMethod,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      return {
        success: true,
        status: 'Paid',
        orderId,
        grandTotal: orderData.grandTotal,
        paymentId: transactionNo,
        updatedOrder,
        receiptUrl: invoiceDetails.paymentReceipt?.receiptUrl,
      };
    }

    if (orderStatusStr === 'declined' || orderStatusStr === 'canceled') {
      transaction.update(orderRef, {
        status: 'Cancelled',
        paymentStatus: 'failed',
        paymentNotes: `Paylink status: ${invoiceDetails.orderStatus}`,
        updatedAt: new Date().toISOString(),
      });
      return {
        success: false,
        status: 'failed',
        orderId,
        paymentId: transactionNo,
        statusCode: 400,
        error: `Paylink payment was ${invoiceDetails.orderStatus}.`,
      };
    }

    return {
      success: true,
      status: 'pending',
      orderId,
      grandTotal: orderData.grandTotal,
      paymentId: transactionNo,
      message: `Paylink orderStatus is ${invoiceDetails.orderStatus}. Awaiting settlement.`,
    };
  });
}

export default async function handler(req: any, res: any) {
  if (!handleCors(req, res)) {
    return res.status(403).json({ error: 'Origin not allowed.', success: false });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.', success: false });
  }

  const clientIp = getClientIp(req);
  const rateLimit = await evaluateRateLimit(`paylink_verify_${clientIp}`, 20, 10 * 60 * 1000);
  setRateLimitHeaders(res, rateLimit);
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Too many requests. Please wait.', success: false });
  }

  const { storeId, orderId, transactionNo } = req.body || {};

  if (!storeId || !orderId || !transactionNo) {
    return res.status(400).json({ error: 'Missing storeId, orderId, or transactionNo.', success: false });
  }

  try {
    const result = await reconcilePaylinkPayment({
      storeId,
      orderId,
      transactionNo,
      source: 'verify_payment',
    });

    if (!result.success) {
      return res.status(result.statusCode || 400).json({
        error: result.error || 'Payment verification failed.',
        success: false,
      });
    }

    return res.status(200).json(result);
  } catch (err: any) {
    console.error('Verify Paylink payment handler error:', err);
    return res.status(500).json({
      error: 'An internal error occurred while verifying Paylink payment.',
      success: false,
    });
  }
}
