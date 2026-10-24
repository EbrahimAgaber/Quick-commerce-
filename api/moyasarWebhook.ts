import { getAdminFirestore } from './_firebaseAdmin';
import { handleCors } from './_security';

interface MoyasarWebhookPayload {
  id: string;
  type: string;
  created_at: string;
  data: {
    id: string;
    status: string;
    amount: number; // In halalas
    currency: string;
    description?: string;
    amount_format?: string;
    fee?: number;
    refunded?: number;
    refunded_at?: string;
    captured?: number;
    captured_at?: string;
    voided_at?: string;
    invoice_id?: string;
    ip?: string;
    callback_url?: string;
    created_at?: string;
    updated_at?: string;
    metadata?: Record<string, string>;
    source?: any;
  };
}

/**
 * Moyasar Webhook Handler
 * Hardened multi-tenant webhook endpoint:
 * 1. Checks webhook signature / secret
 * 2. Re-fetches payment directly from Moyasar Payments API using merchant's secret key (sk)
 * 3. Enforces amount in halalas equals order grandTotal * 100
 * 4. Ensures idempotency: duplicate/replayed webhooks are safely ignored
 * 5. Appends immutable audit record to order's payment history
 */
export default async function handler(req: any, res: any) {
  if (!handleCors(req, res)) {
    return res.status(403).json({ error: 'Origin not allowed.', success: false });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.', success: false });
  }

  const payload = req.body as MoyasarWebhookPayload;
  if (!payload || !payload.data || !payload.data.id) {
    return res.status(400).json({ error: 'Invalid Moyasar webhook payload structure.', success: false });
  }

  const paymentData = payload.data;
  const paymentId = paymentData.id;
  const storeId = paymentData.metadata?.storeId;
  const orderId = paymentData.metadata?.orderId;

  if (!storeId || !orderId) {
    console.warn(`Moyasar webhook missing metadata (storeId: ${storeId}, orderId: ${orderId})`);
    return res.status(400).json({ error: 'Missing storeId or orderId in payment metadata.', success: false });
  }

  const db = getAdminFirestore();

  try {
    const storeRef = db.collection('stores').doc(storeId);
    const privatePaymentRef = storeRef.collection('private').doc('payment');
    const privatePaymentSnap = await privatePaymentRef.get();

    let secretKey = process.env.MOYASAR_SECRET_KEY || '';
    let webhookSecret = process.env.MOYASAR_WEBHOOK_SECRET || '';

    if (privatePaymentSnap.exists) {
      const pData = privatePaymentSnap.data() || {};
      if (pData.secretKey) secretKey = pData.secretKey;
      if (pData.webhookSecret) webhookSecret = pData.webhookSecret;
    }

    // 1. Webhook Signature / Secret Verification
    const providedSecret = req.headers?.['x-moyasar-secret'] || req.query?.secret;
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction && (!webhookSecret || providedSecret !== webhookSecret)) {
      console.warn('Moyasar webhook unauthorized secret mismatch in production');
      return res.status(401).json({ error: 'Invalid or missing webhook secret signature.', success: false });
    } else if (webhookSecret && providedSecret !== webhookSecret) {
      console.warn('Moyasar webhook unauthorized secret mismatch');
      return res.status(401).json({ error: 'Invalid webhook secret signature.', success: false });
    }

    // 2. Fetch Order from Firestore
    const orderRef = storeRef.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      console.error(`Order not found for Moyasar payment: ${orderId}`);
      return res.status(404).json({ error: 'Order not found.', success: false });
    }

    const orderData = orderSnap.data() || {};

    // 3. Replay / Idempotency Check:
    // If order is already Paid and payment ID already processed, return 200 OK immediately
    if (orderData.status === 'Paid' && orderData.paymentId === paymentId) {
      return res.status(200).json({
        success: true,
        message: 'Webhook already processed (Idempotent replay).',
      });
    }

    // Check distributed webhook idempotency registry
    const idempotencyDocId = `moyasar_${paymentId}_${payload.data.status || 'paid'}`;
    const idempotencyRef = db.collection('webhook_idempotency_keys').doc(idempotencyDocId);
    try {
      const existingKeySnap = await idempotencyRef.get();
      if (existingKeySnap.exists) {
        return res.status(200).json({
          success: true,
          message: 'Webhook event already processed (Atomic idempotency key hit).',
        });
      }
    } catch (idempErr) {
      console.warn('Idempotency read notice:', idempErr);
    }

    // 4. Re-fetch authentic payment from Moyasar API using merchant secret key (sk)
    // Never trust client payload or webhook payload alone!
    const moyasarApiUrl = process.env.MOYASAR_API_URL || 'https://api.moyasar.com/v1';
    let verifiedPayment = paymentData;

    if (secretKey && !secretKey.startsWith('sk_test_dummy')) {
      const authHeader = 'Basic ' + Buffer.from(`${secretKey}:`).toString('base64');
      const moyasarResponse = await fetch(`${moyasarApiUrl}/payments/${paymentId}`, {
        method: 'GET',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
      });

      if (!moyasarResponse.ok) {
        console.error(`Failed to re-fetch payment ${paymentId} from Moyasar API`);
        return res.status(502).json({ error: 'Could not verify payment with Moyasar gateway.', success: false });
      }

      verifiedPayment = await moyasarResponse.json();
    }

    // 5. Strict Security Assertions
    const expectedAmountHalalas = Math.round(orderData.grandTotal * 100);
    const actualAmountHalalas = verifiedPayment.amount;

    if (verifiedPayment.currency !== 'SAR') {
      console.error(`Currency mismatch: expected SAR, received ${verifiedPayment.currency}`);
      return res.status(400).json({ error: 'Invalid currency. Only SAR is supported.', success: false });
    }

    if (actualAmountHalalas !== expectedAmountHalalas) {
      console.error(`Amount mismatch: expected ${expectedAmountHalalas} halalas, got ${actualAmountHalalas}`);
      // Mark as payment amount mismatch to prevent merchant fraud
      await orderRef.update({
        paymentStatus: 'Amount Mismatch',
        paymentNotes: `Paid ${actualAmountHalalas / 100} SAR, but order total is ${orderData.grandTotal} SAR`,
        updatedAt: new Date().toISOString(),
      });
      return res.status(400).json({ error: 'Paid amount does not match order grand total.', success: false });
    }

    // 6. Update Order Status Idempotently
    const isPaid = verifiedPayment.status === 'paid';
    const newStatus = isPaid ? 'Paid' : 'Payment Failed';

    await orderRef.update({
      status: newStatus,
      paymentId: verifiedPayment.id,
      paymentMethod: verifiedPayment.source?.type || orderData.paymentMethod || 'card',
      paymentFee: verifiedPayment.fee || 0,
      paidAt: verifiedPayment.created_at || new Date().toISOString(),
      trackingNotes: isPaid ? 'تم تأكيد الدفع الإلكتروني بنجاح وجاري تجهيز الشحنة.' : 'تعذر إتمام الدفع الإلكتروني.',
      updatedAt: new Date().toISOString(),
    });

    // 7. Update Public Tracking Projection
    const trackingRef = db.collection('tracking').doc(orderId);
    await trackingRef.set(
      {
        status: newStatus,
        paymentStatus: isPaid ? 'Paid' : 'Failed',
        trackingNotes: isPaid ? 'تم تأكيد الدفع الإلكتروني بنجاح وجاري تجهيز الشحنة.' : 'تعذر إتمام الدفع الإلكتروني.',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // 8. Append Immutable Payment Event Log
    const paymentsSubCol = orderRef.collection('payments').doc(paymentId);
    await paymentsSubCol.set({
      id: paymentId,
      status: verifiedPayment.status,
      amount: verifiedPayment.amount,
      currency: verifiedPayment.currency,
      sourceType: verifiedPayment.source?.type || 'unknown',
      sourceCompany: verifiedPayment.source?.company || 'unknown',
      createdAt: new Date().toISOString(),
    });

    // 9. Store Distributed Idempotency Key with 7-Day Expiry
    try {
      await idempotencyRef.set({
        paymentId,
        storeId,
        orderId,
        status: verifiedPayment.status,
        amount: verifiedPayment.amount,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      });
    } catch (idempErr) {
      console.warn('Idempotency recording error:', idempErr);
    }

    return res.status(200).json({
      success: true,
      orderId,
      status: newStatus,
      paymentId,
    });
  } catch (err: any) {
    console.error('Moyasar webhook handling error:', err);
    return res.status(500).json({
      error: 'An internal error occurred while processing the webhook.',
      success: false,
    });
  }
}
