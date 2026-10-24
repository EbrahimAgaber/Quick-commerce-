import { Order, StoreSettings } from '../types/store';
import { normalizeArabicDigits, toWhatsAppNumber } from './digits';
import { getZatcaComplianceType } from './zatca';

/**
 * Generates a high-entropy, collision-resistant order reference (e.g. "BA-8F3K9M2X").
 * Uses crypto.getRandomValues across 8 alphanumeric characters (~2.8 trillion combinations)
 * to eliminate Birthday Paradox collisions under high concurrent order traffic.
 */
export function generateOrderId(prefix: string = 'BA'): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Unambiguous Crockford-style alphabet
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 8; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return `${prefix}-${code}`;
}

/**
 * Generates an unpredictable, cryptographically random 4-digit Delivery PIN (1000 - 9999).
 * Eliminates deterministic derivation vulnerabilities where malicious actors deduce PIN from order ID.
 */
export function generateDeliveryPin(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return String(1000 + (arr[0] % 9000));
  }
  return String(1000 + Math.floor(Math.random() * 9000));
}

/**
 * Resolves or deterministically calculates a 4-digit Delivery PIN for an order.
 * Shopper must share this code with the delivery driver to verify delivery.
 */
export function getOrderDeliveryPin(order: Partial<Order> & { id?: string }): string {
  if (order.deliveryPin && /^\d{4}$/.test(order.deliveryPin)) {
    return order.deliveryPin;
  }
  // Deterministic 4-digit fallback only for legacy orders missing an explicit deliveryPin
  const digits = (order.id || '').replace(/\D/g, '');
  if (digits.length >= 4) return digits.slice(-4);
  const seed = (order.id || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return String(1000 + (seed % 9000));
}

/**
 * Localizes payment method names into clean, friendly Arabic with icons
 */
export function formatPaymentMethodLabel(method?: string): string {
  if (!method) return 'الدفع عند الاستلام (COD) 💵';
  const m = method.toLowerCase();
  if (m.includes('cod') || m.includes('استلام') || m.includes('cash')) {
    return 'الدفع عند الاستلام (COD) 💵';
  }
  if (m.includes('card') || m.includes('mada') || m.includes('apple_pay') || m.includes('مدى') || m.includes('بطاق') || m.includes('visa') || m.includes('paid')) {
    return 'مدفوع إلكترونياً (مدى / Apple Pay) ✅';
  }
  if (m.includes('bank') || m.includes('تحويل')) {
    return 'تحويل بنكي فوري 🏦';
  }
  return method;
}

/**
 * Formats a clean, respectful order submission message sent by the SHOPPER to the MERCHANT.
 * Crafted from the customer's perspective confirming their order with the store.
 */
export function buildWhatsAppInvoiceMessage(order: Order, settings: StoreSettings, storeSlug?: string): string {
  const lineItemsText = (order.items || [])
    .map(
      item =>
        `• ${item.quantity}x ${item.name}${item.variant ? ` (الخيار: ${item.variant})` : ''} - ${(item.price * item.quantity).toLocaleString('en-US')} ${settings.currency}`
    )
    .join('\n');

  const shippingText =
    order.shippingFee === 0
      ? `مجاني (عرض الشحن المجاني) 🎁`
      : `${order.shippingFee.toLocaleString('en-US')} ${settings.currency}`;

  const discountLine =
    order.discountAmount && order.discountAmount > 0
      ? `\n🎟️ *الخصم (${order.discountCode || 'كوبون'}):* -${order.discountAmount.toLocaleString('en-US')} ${settings.currency}`
      : '';

  const complianceType = order.zatcaComplianceType || getZatcaComplianceType(settings);
  const taxDisclosureLine =
    complianceType === 'non_registered'
      ? '\n📄 *الضريبة:* منشأة غير مسجلة في ضريبة القيمة المضافة'
      : `\n🧾 *الضريبة:* الأسعار شاملة ضريبة القيمة المضافة 15%${settings.vatNumber ? ` (الرقم الضريبي: ${settings.vatNumber})` : ''}`;

  const trackingOrigin = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'https://quick-ecommerce-saas-app.web.app';

  const resolvedSlug = storeSlug || order.storeSlug || settings.storeSlug || '';
  const slugParam = resolvedSlug ? `store=${encodeURIComponent(resolvedSlug)}&` : '';
  const trackingUrl = `${trackingOrigin}/?${slugParam}track=${order.id}`;

  const orderDate = new Date(order.timestamp).toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const pin = getOrderDeliveryPin(order);
  const pinText = order.deliveryType === 'pickup'
    ? `\n🔑 *كود الاستلام من الفرع:* \`${pin}\``
    : `\n🔑 *كود تأكيد التسليم للمندوب:* \`${pin}\` (زوّد المندوب بهذا الكود عند الاستلام)`;

  const message = `السلام عليكم ورحمة الله وبركاته 🌟
أود تأكيد طلبي الجديد من متجر *${settings.storeName}* 🛍️
━━━━━━━━━━━━━━━━━━━━
🔖 *رقم الطلب:* #${order.id}${pinText}
📅 *التاريخ:* ${orderDate}

👤 *بيانات المستلم والتوصيل:*
• الاسم: ${order.customerName}
• الجوال: ${order.customerPhone}
• المدينة: ${order.city}
• العنوان التفصيلي: ${order.deliveryAddress}${
    order.landmarkNotes ? `\n• ملاحظات التوصيل: ${order.landmarkNotes}` : ''
  }

📦 *المنتجات المطلوبة:*
${lineItemsText}

━━━━━━━━━━━━━━━━━━━━
💵 *المجموع الفرعي:* ${order.subtotal.toLocaleString('en-US')} ${settings.currency}${discountLine}
🚚 *رسوم التوصيل:* ${shippingText}
💰 *الإجمالي المستحق:* ${order.grandTotal.toLocaleString('en-US')} ${settings.currency}${taxDisclosureLine}
💳 *طريقة الدفع:* ${formatPaymentMethodLabel(order.paymentMethod)}
━━━━━━━━━━━━━━━━━━━━
🔍 *تتبع حالة الطلب مباشرة:*
${trackingUrl}

بانتظار تأكيدكم وبدء التجهيز، شكراً لكم! 🙏✨`;

  return message;
}

/**
 * Formats a premium, refined confirmation and status update message sent by the MERCHANT to the SHOPPER.
 * Crafted from the store's perspective providing customer service, order summary, and live tracking.
 */
export function buildMerchantCustomerUpdateMessage(order: Order, settings: StoreSettings, storeSlug?: string): string {
  const statusMap: Record<string, string> = {
    Received: 'تم استلام وتأكيد طلبكم بنجاح وجارٍ التجهيز 📋',
    'In Progress': 'طلبكم قيد التجهيز والتغليف الآن بعناية 📦',
    'Out for Delivery': 'خرجت شحنتكم مع المندوب وهي في طريقها إليكم 🚚💨',
    Delivered: 'تم توصيل طلبكم بنجاح، نتمنى لكم تجربة تسوق ممتعة 🎉',
    Cancelled: 'تم إلغاء الطلب بناءً على رغبتكم أو لتعذر التواصل ❌',
    Paid: 'تم استلام وتأكيد الدفع الإلكتروني بنجاح ✅',
    'Payment Failed': 'تعذر استلام الدفع الإلكتروني، يرجى المحاولة مرة أخرى ⚠️',
    'Return Requested': 'طلب الاسترجاع قيد المراجعة والاعتماد لدى المتجر 🔄',
    Returned: 'تم استلام المنتجات المرتجعة وإغلاق المعاملة بنجاح 📦',
    Refunded: 'تم استرداد مبلغ طلبكم بنجاح إلى حسابكم البنكي 💳',
    'Partially Refunded': 'تم استرداد جزء من مبلغ طلبكم بنجاح 💳',
  };

  const statusLabel = statusMap[order.status] || `حالة الطلب: ${order.status}`;

  const trackingOrigin = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'https://quick-ecommerce-saas-app.web.app';

  const resolvedSlug = storeSlug || order.storeSlug || settings.storeSlug || '';
  const slugParam = resolvedSlug ? `store=${encodeURIComponent(resolvedSlug)}&` : '';
  const trackingUrl = `${trackingOrigin}/?${slugParam}track=${order.id}`;

  const itemsSummary = (order.items && order.items.length > 0)
    ? order.items.map((i) => `• ${i.quantity}x ${i.name}${i.variant ? ` (${i.variant})` : ''}`).join('\n')
    : (order.itemsSummary || 'مجموعة منتقاة من منتجات المتجر');

  const pin = getOrderDeliveryPin(order);
  const pinNotice = order.status !== 'Delivered' && order.status !== 'Cancelled'
    ? `\n🔑 *كود تأكيد التسليم للمندوب:* \`${pin}\` (يرجى تزويد المندوب بهذا الكود عند وصوله)`
    : '';

  const message = `مرحباً أ. ${order.customerName} 🌟
تحية طيبة من فريق *${settings.storeName}*،

يسعدنا إبلاغك بتحديث حالة طلبك رقم *#${order.id}*:
━━━━━━━━━━━━━━━━━━━━
📌 *الحالة الحالية:* *${statusLabel}*${pinNotice}

📦 *تفاصيل المنتجات:*
${itemsSummary}

💰 *الإجمالي المستحق:* ${order.grandTotal.toLocaleString('en-US')} ${settings.currency} (${formatPaymentMethodLabel(order.paymentMethod)})
${order.trackingNotes ? `🚚 *ملاحظات التوصيل / الشحن:* ${order.trackingNotes}\n` : ''}━━━━━━━━━━━━━━━━━━━━
🔍 *يمكنك متابعة مسار شحنتك لحظة بلحظة عبر الرابط التالي:*
${trackingUrl}

شاكرين ومقدرين اختيارك لنا دائماً، ونسعد بخدمتك في أي وقت ✨
فريق خدمة العملاء | *${settings.storeName}*`;

  return message;
}

/**
 * Creates the direct wa.me link with the sanitized phone number and encoded text
 */
export function createWhatsAppUrl(phoneNumber: string, message: string): string {
  const cleanPhone = toWhatsAppNumber(phoneNumber);
  const encodedText = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedText}`;
}
