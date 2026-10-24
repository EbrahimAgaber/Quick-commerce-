import { getAdminFirestore } from './_firebaseAdmin';
import { handleCors, checkRateLimit, getClientIp } from './_security';

export default async function handler(req: any, res: any) {
  if (!handleCors(req, res)) {
    return res.status(403).json({ error: 'Origin not allowed.', success: false });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.', success: false });
  }

  const clientIp = getClientIp(req);
  if (!checkRateLimit(`pay_verify_${clientIp}`, 20, 10 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many requests. Please wait.', success: false });
  }

  const { storeId, orderId, paymentId } = req.body || {};

  if (!storeId || !orderId || !paymentId) {
    return res.status(400).json({ error: 'Missing storeId, orderId, or paymentId.', success: false });
  }

  const db = getAdminFirestore();

  try {
    let storeRef = db.collection('stores').doc(storeId);
    let storeSnap = await storeRef.get();

    // Fall back to slug lookup if storeId was passed as a store slug
    if (!storeSnap.exists) {
      const slugQuery = await db.collection('stores').where('slug', '==', storeId).limit(1).get();
      if (!slugQuery.empty) {
        storeRef = slugQuery.docs[0].ref;
        storeSnap = slugQuery.docs[0];
      }
    }

    const orderRef = storeRef.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return res.status(404).json({ error: 'Order not found.', success: false });
    }

    const orderData = orderSnap.data() || {};

    // If order is already verified Paid
    if (orderData.status === 'Paid') {
      return res.status(200).json({
        success: true,
        status: 'Paid',
        orderId,
        grandTotal: orderData.grandTotal,
        paymentId: orderData.paymentId,
      });
    }

    // Resolve merchant secret key from /stores/{id}/private/payment
    const privatePaymentRef = storeRef.collection('private').doc('payment');
    const privatePaymentSnap = await privatePaymentRef.get();

    let secretKey = process.env.MOYASAR_SECRET_KEY || '';
    if (privatePaymentSnap.exists) {
      const pData = privatePaymentSnap.data() || {};
      if (pData.secretKey) secretKey = pData.secretKey;
    }

    const moyasarApiUrl = process.env.MOYASAR_API_URL || 'https://api.moyasar.com/v1';

    if (!secretKey) {
      return res.status(500).json({
        error: 'Payment gateway credentials are not configured on the merchant store.',
        success: false,
      });
    }

    const authHeader = 'Basic ' + Buffer.from(`${secretKey}:`).toString('base64');
    const moyasarResponse = await fetch(`${moyasarApiUrl}/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
    });

    if (!moyasarResponse.ok) {
      return res.status(502).json({
        error: 'Could not fetch payment verification from Moyasar.',
        success: false,
      });
    }

    const payment = await moyasarResponse.json();

    const expectedAmountHalalas = Math.round(orderData.grandTotal * 100);
    const actualAmountHalalas = payment.amount;

    if (actualAmountHalalas !== expectedAmountHalalas) {
      return res.status(400).json({
        error: 'Payment amount mismatch.',
        success: false,
      });
    }

    const isPaid = payment.status === 'paid';
    const newStatus = isPaid ? 'Paid' : 'Payment Failed';

    await orderRef.update({
      status: newStatus,
      paymentId: payment.id,
      paymentFee: payment.fee || 0,
      paidAt: payment.created_at || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Update public tracking
    const trackingRef = db.collection('tracking').doc(orderId);
    await trackingRef.set(
      {
        status: newStatus,
        paymentStatus: isPaid ? 'Paid' : 'Failed',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return res.status(200).json({
      success: true,
      status: newStatus,
      orderId,
      grandTotal: orderData.grandTotal,
      paymentId,
    });
  } catch (err: any) {
    console.error('Verify payment error:', err);
    return res.status(500).json({
      error: 'An internal error occurred while verifying payment.',
      success: false,
    });
  }
}
