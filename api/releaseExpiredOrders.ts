import { getAdminFirestore } from './_firebaseAdmin';
import { handleCors } from './_security';
import { releaseOrderStock } from './_stockManager';

export default async function handler(req: any, res: any) {
  if (!handleCors(req, res)) {
    return res.status(403).json({ error: 'Origin not allowed.', success: false });
  }

  // Allow GET or POST for flexible cron trigger
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed.', success: false });
  }

  // 1. Authenticate cron trigger using CRON_SECRET header or query
  const configuredCronSecret = process.env.CRON_SECRET || '';
  const incomingCronSecret =
    req.headers?.['x-cron-secret'] ||
    (req.headers?.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice('Bearer '.length).trim()
      : '');

  if (!configuredCronSecret || incomingCronSecret !== configuredCronSecret) {
    return res.status(401).json({ error: 'Unauthorized cron invocation.', success: false });
  }

  const expiryMinutes = Number(process.env.ORDER_EXPIRY_MINUTES) || 30;
  const expiryCutoffTime = new Date(Date.now() - expiryMinutes * 60 * 1000).toISOString();

  const db = getAdminFirestore();

  try {
    // Query orders in collectionGroup that are Pending Payment and older than cutoff
    // Note: status 'Pending Payment' / 'Received' (with paymentMethod card/apple_pay/stc_pay and paymentStatus pending_payment)
    const storesSnap = await db.collection('stores').get();
    const expiredOrdersSummary: { storeId: string; orderId: string; status: string }[] = [];

    for (const storeDoc of storesSnap.docs) {
      const storeId = storeDoc.id;
      const ordersCol = storeDoc.ref.collection('orders');

      // Query unpaid pending online orders older than cutoff
      const pendingOrdersSnap = await ordersCol
        .where('timestamp', '<=', expiryCutoffTime)
        .get();

      for (const orderDoc of pendingOrdersSnap.docs) {
        const orderData = orderDoc.data() || {};
        const isOnlinePayment = ['card', 'apple_pay', 'stc_pay'].includes(orderData.paymentMethod);
        const isPending =
          orderData.status === 'Received' ||
          orderData.status === 'In Progress' ||
          orderData.status === 'Pending Payment';
        const isNotPaid = orderData.status !== 'Paid' && orderData.paymentStatus !== 'paid';

        if (isOnlinePayment && isPending && isNotPaid && !orderData.stockReleased) {
          const orderId = orderDoc.id;
          const nowIso = new Date().toISOString();

          // Mark expired and release stock
          await releaseOrderStock(storeId, orderId, 'order_expired_unpaid');

          await orderDoc.ref.update({
            status: 'Expired',
            paymentStatus: 'expired',
            trackingNotes: 'تم إلغاء الطلب تلقائياً لانتهاء مهلة الدفع الإلكتروني (30 دقيقة).',
            updatedAt: nowIso,
          });

          // Sync tracking projection
          const trackingRef = db.collection('tracking').doc(orderId);
          await trackingRef.set(
            {
              status: 'Expired',
              paymentStatus: 'Expired',
              trackingNotes: 'تم إلغاء الطلب تلقائياً لانتهاء مهلة الدفع الإلكتروني (30 دقيقة).',
              updatedAt: nowIso,
            },
            { merge: true }
          );

          expiredOrdersSummary.push({ storeId, orderId, status: 'Expired' });
        }
      }
    }

    return res.status(200).json({
      success: true,
      expiryMinutes,
      expiredOrdersCount: expiredOrdersSummary.length,
      expiredOrders: expiredOrdersSummary,
    });
  } catch (err: any) {
    console.error('releaseExpiredOrders cron error:', err);
    return res.status(500).json({
      error: err?.message || 'Failed to release expired orders.',
      success: false,
    });
  }
}
