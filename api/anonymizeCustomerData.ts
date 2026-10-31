import { getAdminFirestore, getAdminAuth } from './_firebaseAdmin';
import { handleCors, evaluateRateLimit, setRateLimitHeaders, getClientIp } from './_security';
import { normalizeSaudiPhoneNumber } from '../src/utils/digits';

/**
 * Saudi PDPL (Personal Data Protection Law / نظام حماية البيانات الشخصية)
 * Customer Right to Erasure / Anonymization (Article 18)
 *
 * Anonymizes Personally Identifiable Information (PII) including name, phone, GPS, and addresses
 * while strictly retaining immutable financial totals & VAT invoices for ZATCA 5-year compliance.
 */
export default async function handler(req: any, res: any) {
  if (!handleCors(req, res)) {
    return res.status(403).json({ error: 'Origin not allowed.', success: false });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.', success: false });
  }

  const clientIp = getClientIp(req);
  const rateLimit = await evaluateRateLimit(`pdpl_ip_${clientIp}`, 15, 10 * 60 * 1000);
  setRateLimitHeaders(res, rateLimit);
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'طلبات مسح بيانات متكررة. يرجى الانتظار.', success: false });
  }

  const { storeId, orderId, customerPhone } = req.body || {};
  if (!storeId || !orderId) {
    return res.status(400).json({ error: 'storeId و orderId مطلوبان لممارسة حق الإتلاف.', success: false });
  }

  const db = getAdminFirestore();

  try {
    // 1. Locate Store
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

    // 2. Authorization Check (Merchant Token OR Verified Customer Phone)
    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    let isMerchantAuthorized = false;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length).trim();
      try {
        const decoded = await getAdminAuth().verifyIdToken(token);
        if (storeSnap.data()?.ownerId === decoded.uid) {
          isMerchantAuthorized = true;
        }
      } catch {
        // Not merchant token
      }
    }

    // 3. Locate Order
    const orderRef = storeRef.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      return res.status(404).json({ error: 'الطلب غير موجود.', success: false });
    }

    const orderData = orderSnap.data() || {};

    // If not merchant, verify customer phone
    if (!isMerchantAuthorized) {
      if (!customerPhone) {
        return res.status(401).json({
          error: 'يلزم مصادقة التاجر أو تقديم رقم جوال العميل المطابق للطلب لمسح البيانات.',
          success: false,
        });
      }

      const normCustomer = normalizeSaudiPhoneNumber(customerPhone);
      const normOrder = normalizeSaudiPhoneNumber(orderData.customerPhone || '');
      const isPhoneMatch =
        (normCustomer.isValid && normOrder.isValid && normCustomer.normalized === normOrder.normalized) ||
        customerPhone.replace(/\D/g, '').slice(-9) === (orderData.customerPhone || '').replace(/\D/g, '').slice(-9);

      if (!isPhoneMatch) {
        return res.status(403).json({ error: 'رقم الجوال غير مطابق لسجل هذا الطلب.', success: false });
      }
    }

    // 4. Verify fulfillment state: active orders in transit cannot be anonymized until closed
    const activeStatuses = ['Received', 'In Progress', 'Out for Delivery'];
    if (activeStatuses.includes(orderData.status)) {
      return res.status(400).json({
        error: 'لا يمكن تعمية بيانات طلب قيد التوصيل والتنفيذ. يرجى الانتظار حتى اكتمال التسليم أو الإلغاء.',
        success: false,
      });
    }

    const nowIso = new Date().toISOString();

    // 5. Apply Anonymization & Tombstoning
    await orderRef.update({
      customerName: 'عميل محمي (PDPL)',
      customerPhone: '+966500000000',
      deliveryAddress: 'العنوان محذوف بموجب نظام حماية البيانات الشخصية',
      googleMapsUrl: null,
      landmarkNotes: null,
      deliveryPin: null,
      anonymizedAt: nowIso,
      anonymizedBy: isMerchantAuthorized ? 'merchant' : 'shopper',
      anonymizationLegalBasis: 'Article 18 Saudi Personal Data Protection Law (SDAIA PDPL)',
      updatedAt: nowIso,
    });

    // 6. Update Public Tracking Projection
    try {
      const trackingRef = db.collection('tracking').doc(orderId);
      await trackingRef.set({
        customerName: 'عميل محمي (PDPL)',
        phoneLast4: '0000',
        trackingNotes: 'تمت تعمية البيانات الشخصية بناء على طلب صاحب البيانات وفق نظام PDPL.',
        updatedAt: nowIso,
      }, { merge: true });
    } catch (trackErr) {
      console.warn('Tracking projection anonymization notice:', trackErr);
    }

    return res.status(200).json({
      success: true,
      message: 'تمت تعمية ومسح البيانات الشخصية بنجاح وفقاً للمادة 18 من نظام حماية البيانات الشخصية السعودي، مع الاحتفاظ بالسجلات الضريبية النظامية.',
      orderId,
      anonymizedAt: nowIso,
    });
  } catch (err: any) {
    console.error('PDPL anonymization error:', err);
    return res.status(500).json({ error: 'حدث خطأ غير متوقع أثناء معالجة طلب مسح البيانات.', success: false });
  }
}
