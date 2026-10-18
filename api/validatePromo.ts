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
  if (!checkRateLimit(`promo_ip_${clientIp}`, 30, 10 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many requests. Please wait.', success: false });
  }

  const { storeId, promoCode, subtotal = 0 } = req.body || {};

  if (!storeId || typeof storeId !== 'string' || !promoCode || typeof promoCode !== 'string') {
    return res.status(400).json({ error: 'Invalid parameters.', valid: false });
  }

  const cleanCode = promoCode.trim().toUpperCase();
  const numSubtotal = Number(subtotal) || 0;

  try {
    const db = getAdminFirestore();
    const storeRef = db.collection('stores').doc(storeId);
    const privateConfigRef = storeRef.collection('private').doc('config');
    const privateSnap = await privateConfigRef.get();

    let promoList: any[] = [];
    if (privateSnap.exists) {
      promoList = privateSnap.data()?.promoCodes || [];
    }

    if (!promoList.length) {
      // Fallback to store doc settings if not migrated yet
      const storeSnap = await storeRef.get();
      if (storeSnap.exists) {
        promoList = storeSnap.data()?.settings?.promoCodes || [];
      }
    }

    const promo = promoList.find(
      (p) => p.code?.toUpperCase() === cleanCode && p.active !== false
    );

    if (!promo) {
      return res.status(200).json({
        valid: false,
        discountAmount: 0,
        message: 'كود الخصم غير موجود أو غير نشط.',
      });
    }

    // Check Expiration
    if (promo.expiryDate && new Date(promo.expiryDate).getTime() < Date.now()) {
      return res.status(200).json({
        valid: false,
        discountAmount: 0,
        message: 'كود الخصم منتهي الصلاحية.',
      });
    }

    // Check Min Order Amount
    if (promo.minOrderAmount && numSubtotal < promo.minOrderAmount) {
      return res.status(200).json({
        valid: false,
        discountAmount: 0,
        message: `الحد الأدنى لتطبيق هذا الكود هو ${promo.minOrderAmount} ر.س.`,
      });
    }

    // Check Max Uses
    if (promo.maxUses && (promo.usageCount || 0) >= promo.maxUses) {
      return res.status(200).json({
        valid: false,
        discountAmount: 0,
        message: 'تم استنفاد الحد الأقصى لاستخدام كود الخصم هذا.',
      });
    }

    let discountAmount = 0;
    if (promo.type === 'percentage') {
      const pct = Math.min(100, Math.max(0, Number(promo.value) || 0));
      discountAmount = Math.round((numSubtotal * pct) / 100);
    } else {
      discountAmount = Math.min(numSubtotal, Math.max(0, Number(promo.value) || 0));
    }

    return res.status(200).json({
      valid: true,
      code: cleanCode,
      type: promo.type,
      value: promo.value,
      discountAmount,
      message: 'تم تطبيق كود الخصم بنجاح!',
    });
  } catch (err: any) {
    console.error('Validate promo error:', err);
    return res.status(500).json({
      valid: false,
      error: 'تعذر التحقق من كود الخصم حالياً.',
    });
  }
}
