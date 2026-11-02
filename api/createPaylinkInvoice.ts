import { handleCors, evaluateRateLimit, setRateLimitHeaders, getClientIp } from './_security';
import { getAdminFirestore } from './_firebaseAdmin';
import { PaylinkGateway } from './_paylinkService';

export default async function handler(req: any, res: any) {
  if (!handleCors(req, res)) {
    return res.status(403).json({ error: 'Origin not allowed.', success: false });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.', success: false });
  }

  const clientIp = getClientIp(req);
  const rateLimit = await evaluateRateLimit(`paylink_invoice_${clientIp}`, 20, 10 * 60 * 1000);
  setRateLimitHeaders(res, rateLimit);
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Too many requests. Please wait.', success: false });
  }

  const { storeId, orderId, callBackUrl, cancelUrl } = req.body || {};

  if (!storeId || !orderId) {
    return res.status(400).json({ error: 'Missing storeId or orderId.', success: false });
  }

  try {
    const db = getAdminFirestore();
    let storeRef = db.collection('stores').doc(storeId);
    let storeSnap = await storeRef.get();

    if (!storeSnap.exists) {
      const slugQuery = await db.collection('stores').where('slug', '==', storeId).limit(1).get();
      if (!slugQuery.empty) {
        storeRef = slugQuery.docs[0].ref;
        storeSnap = slugQuery.docs[0];
      } else {
        return res.status(404).json({ error: 'المتجر غير موجود.', success: false });
      }
    }

    const storeData = storeSnap.data() || {};
    const storeSettings = storeData.settings || {};

    // Get order details
    const orderDoc = await storeRef.collection('orders').doc(orderId).get();
    if (!orderDoc.exists) {
      return res.status(404).json({ error: 'الطلب غير موجود.', success: false });
    }

    const orderData = orderDoc.data() || {};

    // Check private credentials
    const privateSnap = await storeRef.collection('private').doc('payment').get();
    const privateData = privateSnap.exists ? privateSnap.data() || {} : {};

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

    const products = (orderData.items || []).map((item: any) => ({
      title: item.title || item.name || 'منتج',
      price: Number(item.price || 0),
      qty: Number(item.quantity || 1),
    }));

    const result = await PaylinkGateway.createInvoice(
      { apiId, secretKey, isTestMode },
      {
        orderNumber: orderId,
        amount: orderData.grandTotal || 0,
        callBackUrl: callBackUrl || `${req.headers.origin || 'https://storelink.sa'}/order/${orderId}?status=verify`,
        cancelUrl: cancelUrl || `${req.headers.origin || 'https://storelink.sa'}/order/${orderId}?status=cancel`,
        clientName: orderData.customer?.name || 'عميل المتجر',
        clientMobile: orderData.customer?.phone || '',
        currency: storeSettings.currency || 'SAR',
        products: products.length > 0 ? products : [{ title: `طلب #${orderId}`, price: orderData.grandTotal, qty: 1 }],
      }
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'فشل إنشاء فاتورة الدفع في بايلينك.', success: false });
    }

    // Attach transaction reference to order
    await orderDoc.ref.update({
      paylinkTransactionNo: result.transactionNo,
      paylinkUrl: result.url,
      updatedAt: new Date().toISOString(),
    });

    return res.status(200).json({
      success: true,
      transactionNo: result.transactionNo,
      url: result.url,
      qrUrl: result.qrUrl,
    });
  } catch (err: any) {
    console.error('Paylink create invoice error:', err);
    return res.status(500).json({
      error: 'حدث خطأ في الخادم أثناء الاتصال ببوابة بايلينك.',
      success: false,
    });
  }
}
