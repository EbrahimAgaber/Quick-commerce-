import { getAdminFirestore, getAdminAuth } from './_firebaseAdmin';
import { handleCors } from './_security';

export default async function handler(req: any, res: any) {
  if (!handleCors(req, res)) {
    return res.status(403).json({ error: 'Origin not allowed.', success: false });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.', success: false });
  }

  // 1. Authenticate Merchant
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required to process refunds.', success: false });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  let merchantUid = '';
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    merchantUid = decoded.uid;
  } catch {
    return res.status(401).json({ error: 'Invalid merchant authentication token.', success: false });
  }

  const { storeId, orderId, amount, reason } = req.body || {};
  if (!storeId || !orderId) {
    return res.status(400).json({ error: 'storeId and orderId are required.', success: false });
  }

  const db = getAdminFirestore();

  try {
    let storeRef = db.collection('stores').doc(storeId);
    let storeSnap = await storeRef.get();
    if (!storeSnap.exists) {
      const slugQuery = await db.collection('stores').where('slug', '==', storeId).limit(1).get();
      if (!slugQuery.empty) {
        storeRef = slugQuery.docs[0].ref;
        storeSnap = slugQuery.docs[0];
      } else {
        return res.status(404).json({ error: 'Store not found.', success: false });
      }
    }

    // Verify ownership
    if (storeSnap.data()?.ownerId !== merchantUid) {
      return res.status(403).json({ error: 'You are not authorized to refund orders for this store.', success: false });
    }

    const orderRef = storeRef.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      return res.status(404).json({ error: 'Order not found.', success: false });
    }

    const orderData = orderSnap.data() || {};
    const refundableStatuses = ['Paid', 'Delivered', 'Return Requested', 'Partially Refunded'];
    if (!refundableStatuses.includes(orderData.status)) {
      return res.status(400).json({
        error: 'يمكن استرداد قيمة الطلبات المدفوعة، المستلمة، أو التي عليها طلب استرجاع فقط.',
        success: false
      });
    }

    const paymentId = orderData.paymentId;
    const isElectronicPayment = Boolean(paymentId);

    // Amount to refund in halalas (if not specified, full refund)
    const refundAmountHalalas = amount ? Math.round(Number(amount) * 100) : Math.round(orderData.grandTotal * 100);
    let refundResultId = `manual_refund_${Date.now()}`;

    // If electronic payment ID exists, trigger gateway refund via Moyasar
    if (isElectronicPayment) {
      // Resolve merchant Moyasar secret key
      const privatePaymentRef = storeRef.collection('private').doc('payment');
      const privatePaymentSnap = await privatePaymentRef.get();
      let secretKey = process.env.MOYASAR_SECRET_KEY || '';
      if (privatePaymentSnap.exists) {
        const pData = privatePaymentSnap.data() || {};
        if (pData.secretKey) secretKey = pData.secretKey;
      }

      if (!secretKey) {
        return res.status(500).json({ error: 'Merchant Moyasar secret key is not configured.', success: false });
      }

      const moyasarApiUrl = process.env.MOYASAR_API_URL || 'https://api.moyasar.com/v1';
      const authHeaderMoyasar = 'Basic ' + Buffer.from(`${secretKey}:`).toString('base64');

      const moyasarRes = await fetch(`${moyasarApiUrl}/payments/${paymentId}/refund`, {
        method: 'POST',
        headers: {
          Authorization: authHeaderMoyasar,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: refundAmountHalalas,
          description: reason || 'Merchant requested refund',
        }),
      });

      if (!moyasarRes.ok) {
        const errData = await moyasarRes.json();
        return res.status(400).json({
          error: errData?.message || 'Moyasar gateway rejected the refund request.',
          success: false,
        });
      }

      const refundResult = await moyasarRes.json();
      refundResultId = refundResult.id || refundResultId;
    }

    const isFullRefund = refundAmountHalalas >= Math.round(orderData.grandTotal * 100);
    const newStatus = isFullRefund ? 'Refunded' : 'Partially Refunded';
    const nowIso = new Date().toISOString();

    await orderRef.update({
      status: newStatus,
      returnStatus: 'completed',
      refundedAmount: (orderData.refundedAmount || 0) + refundAmountHalalas / 100,
      refundReason: reason || '',
      refundedAt: nowIso,
      updatedAt: nowIso,
    });

    // Record in immutable refunds subcollection
    const refundDocRef = orderRef.collection('refunds').doc();
    await refundDocRef.set({
      id: refundResultId,
      amountHalalas: refundAmountHalalas,
      amountSar: refundAmountHalalas / 100,
      reason: reason || '',
      paymentMethod: orderData.paymentMethod || 'Manual / Cash',
      createdAt: nowIso,
    });

    // Synchronize minimal public tracking projection
    try {
      const trackingRef = db.collection('tracking').doc(orderId);
      await trackingRef.update({
        status: newStatus,
        returnStatus: 'completed',
        trackingNotes: `تم استرداد المبلغ (${refundAmountHalalas / 100} ريال) بنجاح.`,
        updatedAt: nowIso,
      });
    } catch (trackErr) {
      console.warn('Tracking projection refund update notice:', trackErr);
    }

    return res.status(200).json({
      success: true,
      status: newStatus,
      refundedAmount: refundAmountHalalas / 100,
      orderId,
    });
  } catch (err: any) {
    console.error('Refund processing error:', err);
    return res.status(500).json({ error: 'Internal error processing refund.', success: false });
  }
}
