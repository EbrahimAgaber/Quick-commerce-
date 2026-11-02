import { handleCors, getClientIp } from './_security';
import { reconcilePaylinkPayment } from './verifyPaylinkPayment';
import { getAdminFirestore } from './_firebaseAdmin';

/**
 * Paylink Order Payment & Status Webhook Handler
 * Follows Paylink Webhook documentation:
 * - Accepts POST request from Paylink
 * - Supports payload v1 and v2 formats (transactionNo, merchantOrderNumber, orderStatus, amount)
 * - Returns HTTP 200 { "status": "success" } on acknowledgment
 */
export default async function handler(req: any, res: any) {
  if (!handleCors(req, res)) {
    return res.status(403).json({ error: 'Origin not allowed.', success: false });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.', success: false });
  }

  const payload = req.body || {};
  const transactionNo = payload.transactionNo;
  const merchantOrderNumber = payload.merchantOrderNumber || payload.orderNumber;
  const orderStatus = payload.orderStatus;

  if (!transactionNo || !merchantOrderNumber) {
    return res.status(400).json({
      error: 'Invalid Paylink webhook payload. Missing transactionNo or merchantOrderNumber.',
      success: false,
    });
  }

  try {
    const db = getAdminFirestore();

    // Find which store owns this order
    const storeQuery = await db.collectionGroup('orders').where('id', '==', merchantOrderNumber).limit(1).get();

    let storeId = '';
    if (!storeQuery.empty) {
      const orderDoc = storeQuery.docs[0];
      const parentStoreRef = orderDoc.ref.parent.parent;
      if (parentStoreRef) {
        storeId = parentStoreRef.id;
      }
    }

    if (!storeId) {
      // Try resolving via store tracking collection
      const trackingDoc = await db.collection('tracking').doc(merchantOrderNumber).get();
      if (trackingDoc.exists) {
        storeId = trackingDoc.data()?.storeId || '';
      }
    }

    if (!storeId) {
      console.warn(`Paylink webhook: store could not be resolved for order ${merchantOrderNumber}`);
      return res.status(200).json({ status: 'success', note: 'Order not found, acknowledged' });
    }

    // Reconcile transaction with Paylink server
    await reconcilePaylinkPayment({
      storeId,
      orderId: merchantOrderNumber,
      transactionNo,
      source: 'webhook',
    });

    return res.status(200).json({ status: 'success' });
  } catch (err: any) {
    console.error('Paylink webhook execution error:', err);
    // Paylink retries up to 10 times if 200 is not returned
    return res.status(500).json({ error: 'Internal webhook error', status: 'error' });
  }
}
