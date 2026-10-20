import { getAdminFirestore } from './_firebaseAdmin';
import { handleCors, checkRateLimit, getClientIp } from './_security';

export default async function handler(req: any, res: any) {
  if (!handleCors(req, res)) {
    return res.status(403).json({ error: 'Origin not allowed.', success: false });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed. Use GET.', success: false });
  }

  const clientIp = getClientIp(req);
  if (!checkRateLimit(`track_ip_${clientIp}`, 60, 10 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many tracking queries.', success: false });
  }

  const orderId = (req.query?.orderId || '').toString().trim().toUpperCase().replace('#', '');
  const phoneLast4 = (req.query?.phoneLast4 || '').toString().trim();

  if (!orderId) {
    return res.status(400).json({ error: 'رقم الطلب مطلوب للتتبع.', success: false });
  }

  try {
    const db = getAdminFirestore();

    // 1. Fetch public tracking projection first
    const trackingRef = db.collection('tracking').doc(orderId);
    const trackingSnap = await trackingRef.get();

    if (!trackingSnap.exists) {
      return res.status(404).json({
        error: 'لم يتم العثور على شحنة أو طلب بهذا الرقم.',
        success: false,
      });
    }

    const trackingData = trackingSnap.data() || {};

    // 2. Minimal Public Projection (Always safe to display to anyone with the order number)
    const publicProjection = {
      orderId: trackingData.orderId,
      status: trackingData.status || 'Received',
      timestamp: trackingData.timestamp,
      itemsSummary: trackingData.itemsSummary,
      grandTotal: trackingData.grandTotal,
      shippingFee: trackingData.shippingFee,
      paymentMethod: trackingData.paymentMethod,
      trackingNotes: trackingData.trackingNotes,
      courierName: trackingData.courierName,
      trackingNumber: trackingData.trackingNumber,
      trackingUrl: trackingData.trackingUrl,
      driverDeliveredAt: trackingData.driverDeliveredAt,
      returnEligibleUntil: trackingData.returnEligibleUntil,
      returnStatus: trackingData.returnStatus,
      returnReason: trackingData.returnReason,
    };

    // 3. If customer provides phoneLast4 and it matches, return verified order details
    const expectedPhoneLast4 = trackingData.phoneLast4;
    const isPhoneVerified =
      Boolean(phoneLast4) &&
      phoneLast4.length === 4 &&
      expectedPhoneLast4 &&
      phoneLast4 === expectedPhoneLast4;

    return res.status(200).json({
      success: true,
      tracking: publicProjection,
      isVerified: isPhoneVerified,
    });
  } catch (err: any) {
    console.error('Tracking query error:', err);
    return res.status(500).json({
      error: 'تعذر الاستعلام عن حالة الشحنة حالياً.',
      success: false,
    });
  }
}
