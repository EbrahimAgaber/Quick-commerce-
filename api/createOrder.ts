import { getAdminFirestore } from './_firebaseAdmin';
import { handleCors, checkRateLimit, getClientIp } from './_security';

interface OrderItemInput {
  productId: string;
  variant?: string;
  qty: number;
}

interface CustomerInput {
  name: string;
  phone: string;
  city: string;
  address: string;
  landmark?: string;
  googleMapsUrl?: string;
  deliveryType?: 'delivery' | 'pickup';
}

export type PaymentMethodType = 'cod' | 'bank_transfer' | 'card' | 'apple_pay' | 'stc_pay';

interface CreateOrderRequest {
  storeId: string;
  items: OrderItemInput[];
  customer: CustomerInput;
  paymentMethod: PaymentMethodType;
  promoCode?: string;
  utm?: Record<string, string>;
  hp?: string; // Honeypot field
}

function normalizePhone(p: string): string {
  const arabicIndicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let norm = p.trim();
  for (let i = 0; i < 10; i++) {
    norm = norm.replaceAll(arabicIndicDigits[i], i.toString());
  }
  return norm.replace(/[^\d+]/g, '');
}

export default async function handler(req: any, res: any) {
  if (!handleCors(req, res)) {
    return res.status(403).json({ error: 'Origin not allowed.', success: false });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.', success: false });
  }

  const clientIp = getClientIp(req);

  // 1. IP Rate Limiting (max 10 orders per 10 minutes per IP)
  if (!checkRateLimit(`order_ip_${clientIp}`, 10, 10 * 60 * 1000)) {
    return res.status(429).json({
      error: 'لقد تجاوزت الحد المسموح به من الطلبات. يرجى الانتظار قليلاً.',
      success: false,
    });
  }

  const body = req.body as CreateOrderRequest;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'بيانات الطلب غير صالحة.', success: false });
  }

  // 2. Honeypot check
  if (body.hp) {
    return res.status(400).json({ error: 'تم رفض الطلب.', success: false });
  }

  const { storeId, items, customer, paymentMethod, promoCode, utm } = body;

  if (!storeId || typeof storeId !== 'string' || storeId.length > 128) {
    return res.status(400).json({ error: 'معرف المتجر غير صالح.', success: false });
  }

  if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
    return res.status(400).json({ error: 'يرجى اختيار منتج واحد على الأقل (بحد أقصى 100).', success: false });
  }

  if (
    !customer ||
    typeof customer !== 'object' ||
    !customer.name?.trim() ||
    customer.name.length > 120 ||
    !customer.phone?.trim() ||
    !customer.city?.trim() ||
    customer.city.length > 100 ||
    !customer.address?.trim() ||
    customer.address.length > 400
  ) {
    return res.status(400).json({ error: 'يرجى إكمال بيانات العميل المطلوبة بشكل صحيح.', success: false });
  }

  const cleanPhone = normalizePhone(customer.phone);
  if (cleanPhone.length < 8 || cleanPhone.length > 25) {
    return res.status(400).json({ error: 'رقم هاتف العميل غير صحيح.', success: false });
  }

  // 3. Phone Rate Limiting (max 5 orders per 10 minutes per phone)
  if (!checkRateLimit(`order_phone_${cleanPhone}`, 5, 10 * 60 * 1000)) {
    return res.status(429).json({
      error: 'تم تقديم عدة طلبات بهذا الرقم مؤخراً. يرجى الانتظار بضع دقائق.',
      success: false,
    });
  }

  const validPaymentMethods: PaymentMethodType[] = ['cod', 'bank_transfer', 'card', 'apple_pay', 'stc_pay'];
  if (!validPaymentMethods.includes(paymentMethod)) {
    return res.status(400).json({ error: 'طريقة الدفع المختارة غير صالحة.', success: false });
  }

  const db = getAdminFirestore();

  try {
    const result = await db.runTransaction(async (transaction: any) => {
      // 1. Read Store Document
      const storeRef = db.collection('stores').doc(storeId);
      const storeSnap = await transaction.get(storeRef);
      if (!storeSnap.exists) {
        throw new Error('المتجر المطلوب غير موجود.');
      }
      const storeData = storeSnap.data() || {};
      const settings = storeData.settings || {};

      // 2. Read Private Store Config (promo codes, private keys)
      const privateConfigRef = storeRef.collection('private').doc('config');
      const privateSnap = await transaction.get(privateConfigRef);
      const privateData = privateSnap.exists ? privateSnap.data() || {} : {};

      // Combine private promos and public fallback promos
      const promoList = Array.isArray(privateData.promoCodes)
        ? privateData.promoCodes
        : Array.isArray(settings.promoCodes)
        ? settings.promoCodes
        : [];

      // 3. Fetch products from subcollection or fallback to store.products array
      const productSubcollection = storeRef.collection('products');
      const uniqueProductIds = Array.from(new Set(items.map((i) => i.productId)));
      const productSnaps = await Promise.all(
        uniqueProductIds.map((pid) => transaction.get(productSubcollection.doc(pid)))
      );

      const productMap = new Map<string, any>();
      productSnaps.forEach((snap, idx) => {
        if (snap.exists) {
          productMap.set(snap.id, snap.data());
        }
      });

      // Fallback to legacy array if subcollection docs not populated yet
      if (Array.isArray(storeData.products)) {
        storeData.products.forEach((p: any) => {
          if (!productMap.has(p.id)) {
            productMap.set(p.id, p);
          }
        });
      }

      // 4. Validate Stock and Compute Server Prices
      let subtotal = 0;
      const verifiedOrderItems: any[] = [];
      const stockUpdatesToApply: { ref?: any; prodId: string; newStock?: number; inStock: boolean }[] = [];

      for (const item of items) {
        if (typeof item.qty !== 'number' || item.qty <= 0 || !Number.isInteger(item.qty)) {
          throw new Error('الكمية المحددة لبعض المنتجات غير صالحة.');
        }

        const prod = productMap.get(item.productId);
        if (!prod) {
          throw new Error(`المنتج (${item.productId}) لم يعد متوفراً في المتجر.`);
        }

        if (prod.inStock === false) {
          throw new Error(`عذراً، المنتج "${prod.name}" نفد من المخزون حالياً.`);
        }

        // Check stock quantity if tracked
        if (typeof prod.stockQuantity === 'number') {
          if (prod.stockQuantity < item.qty) {
            throw new Error(
              `الكمية المطلوبة من "${prod.name}" (${item.qty}) غير متوفرة. المتبقي: ${prod.stockQuantity}`
            );
          }
          const remainingStock = prod.stockQuantity - item.qty;
          const stillInStock = remainingStock > 0;
          prod.stockQuantity = remainingStock;
          prod.inStock = stillInStock;

          const docSnap = productSnaps.find((s) => s.id === item.productId);
          if (docSnap && docSnap.exists) {
            stockUpdatesToApply.push({
              ref: productSubcollection.doc(item.productId),
              prodId: item.productId,
              newStock: remainingStock,
              inStock: stillInStock,
            });
          }
        }

        // Determine authentic server-side price (applying sale rules)
        const hasSale =
          typeof prod.salePrice === 'number' &&
          prod.salePrice > 0 &&
          prod.salePrice < prod.price;
        const unitPrice = hasSale ? prod.salePrice : prod.price;

        subtotal += unitPrice * item.qty;

        verifiedOrderItems.push({
          productId: prod.id,
          name: prod.name,
          variant: item.variant || '',
          price: unitPrice,
          quantity: item.qty,
          imageUrl: prod.imageUrl || '',
        });
      }

      // 5. Server-side Promo Code Validation
      let discountAmount = 0;
      let appliedPromoCode: string | undefined;

      if (promoCode && typeof promoCode === 'string') {
        const cleanCode = promoCode.trim().toUpperCase();
        const promo = promoList.find(
          (p: any) => p.code?.toUpperCase() === cleanCode && p.active !== false
        );

        if (promo) {
          // Check expiry
          const isExpired = promo.expiryDate && new Date(promo.expiryDate).getTime() < Date.now();
          // Check min order
          const meetsMinOrder = !promo.minOrderAmount || subtotal >= promo.minOrderAmount;
          // Check max uses
          const usageCount = promo.usageCount || 0;
          const withinUsageLimit = !promo.maxUses || usageCount < promo.maxUses;

          if (!isExpired && meetsMinOrder && withinUsageLimit) {
            if (promo.type === 'percentage') {
              const pct = Math.min(100, Math.max(0, Number(promo.value) || 0));
              discountAmount = Math.round((subtotal * pct) / 100);
            } else {
              discountAmount = Math.min(subtotal, Math.max(0, Number(promo.value) || 0));
            }
            appliedPromoCode = cleanCode;

            // Increment usage count in private config
            promo.usageCount = usageCount + 1;
            transaction.set(privateConfigRef, { promoCodes: promoList }, { merge: true });
          }
        }
      }

      // 6. Server-side Shipping Fee Calculation
      const freeShippingThreshold = Number(settings.freeShippingThreshold) || 0;
      const standardShippingRate = Number(settings.standardShippingRate) || 0;
      const qualifiesForFreeShipping = freeShippingThreshold > 0 && subtotal >= freeShippingThreshold;
      const shippingFee = qualifiesForFreeShipping ? 0 : standardShippingRate;

      // 7. Calculate Grand Total
      const discountedSubtotal = Math.max(0, subtotal - discountAmount);
      const grandTotal = discountedSubtotal + shippingFee;

      // 8. Generate Unique Order ID with Collision Check
      let orderId = '';
      let isUnique = false;
      let attempts = 0;

      while (!isUnique && attempts < 5) {
        attempts++;
        const randHex = Math.random().toString(36).substring(2, 6).toUpperCase();
        const timePart = Date.now().toString(36).slice(-4).toUpperCase();
        const candidateId = `ORD-${randHex}${timePart}`;
        const orderRef = storeRef.collection('orders').doc(candidateId);
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists) {
          orderId = candidateId;
          isUnique = true;
        }
      }

      if (!orderId) {
        orderId = `ORD-${Date.now()}`;
      }

      // 9. Initial Order Status
      const isOnlinePayment = ['card', 'apple_pay', 'stc_pay'].includes(paymentMethod);
      const initialStatus = isOnlinePayment ? 'Pending Payment' : 'Received';

      const itemsSummary = verifiedOrderItems
        .map((i) => `${i.quantity}x ${i.name}${i.variant ? ` (${i.variant})` : ''} - ${i.price * i.quantity} ${settings.currency || 'ر.س'}`)
        .join(', ');

      const timestamp = new Date().toISOString();

      const fullOrderRecord = {
        id: orderId,
        storeId,
        timestamp,
        customerName: customer.name.trim(),
        customerPhone: cleanPhone,
        city: customer.city.trim(),
        deliveryAddress: customer.address.trim(),
        landmarkNotes: customer.landmark?.trim() || '',
        paymentMethod,
        itemsSummary,
        items: verifiedOrderItems,
        subtotal,
        discountCode: appliedPromoCode,
        discountAmount: discountAmount > 0 ? discountAmount : 0,
        shippingFee,
        grandTotal,
        status: initialStatus,
        trackingNotes: isOnlinePayment ? 'في انتظار استكمال الدفع الإلكتروني' : 'تم استلام الطلب وتأكيده بنجاح.',
        googleMapsUrl: customer.googleMapsUrl?.trim() || '',
        deliveryType: customer.deliveryType === 'pickup' ? 'pickup' : 'delivery',
        utm: utm || {},
        createdAt: timestamp,
        returnStatus: null,
        returnEligibleUntil: null,
      };

      // 10. Persist Full Order
      const newOrderDocRef = storeRef.collection('orders').doc(orderId);
      transaction.set(newOrderDocRef, fullOrderRecord);

      // 11. Persist Stock Decrements
      for (const update of stockUpdatesToApply) {
        if (update.ref) {
          transaction.update(update.ref, {
            stockQuantity: update.newStock,
            inStock: update.inStock,
          });
        }
      }

      // 12. Persist Minimal Public Tracking Projection (no customer PII)
      const trackingDocRef = db.collection('tracking').doc(orderId);
      transaction.set(trackingDocRef, {
        orderId,
        storeId,
        status: initialStatus,
        timestamp,
        itemsSummary,
        subtotal,
        discountAmount,
        shippingFee,
        grandTotal,
        paymentMethod,
        trackingNotes: fullOrderRecord.trackingNotes,
        phoneLast4: cleanPhone.slice(-4),
        returnStatus: null,
        returnEligibleUntil: null,
      });

      return {
        orderId,
        subtotal,
        discountAmount,
        shippingFee,
        grandTotal,
        amountHalalas: Math.round(grandTotal * 100),
        status: initialStatus,
        order: fullOrderRecord,
      };
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    console.error('Order creation transaction failed:', err);
    return res.status(400).json({
      error: err.message || 'فشلت معالجة الطلب في الخادم.',
      success: false,
    });
  }
}
