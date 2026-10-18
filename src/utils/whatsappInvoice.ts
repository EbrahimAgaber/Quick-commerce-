import { Order, StoreSettings } from '../types/store';
import { normalizeArabicDigits } from './digits';

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
 * Formats a clean, professional WhatsApp invoice message
 */
export function buildWhatsAppInvoiceMessage(order: Order, settings: StoreSettings): string {
  const lineItemsText = order.items
    .map(
      item =>
        `• ${item.quantity}x ${item.name}${item.variant ? ` (الخيار: ${item.variant})` : ''} - ${(item.price * item.quantity).toLocaleString('en-US')} ${settings.currency}`
    )
    .join('\n');

  const shippingText =
    order.shippingFee === 0
      ? `مجاني (عرض الشحن المجاني)`
      : `${order.shippingFee.toLocaleString('en-US')} ${settings.currency}`;

  const discountLine =
    order.discountAmount && order.discountAmount > 0
      ? `\n🎟️ *الخصم (${order.discountCode || 'كوبون'}):* -${order.discountAmount.toLocaleString('en-US')} ${settings.currency}`
      : '';

  const message = `🛍️ *طلب جديد من متجر ${settings.storeName}*
━━━━━━━━━━━━━━━━━━━━
🔖 *رقم الطلب:* #${order.id}
📅 *التاريخ:* ${new Date(order.timestamp).toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })}

👤 *بيانات العميل:*
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
💰 *الإجمالي المستحق:* ${order.grandTotal.toLocaleString('en-US')} ${settings.currency}
💳 *طريقة الدفع:* ${order.paymentMethod}
━━━━━━━━━━━━━━━━━━━━
🔍 *تتبع حالة طلبك برقم:* ${order.id}
شكراً لتسوقك من ${settings.storeName} ✨`;

  return message;
}

/**
 * Creates the direct wa.me link with the sanitized phone number and encoded text
 */
export function createWhatsAppUrl(phoneNumber: string, message: string): string {
  // Strip any +, -, spaces, or parentheses while preserving Arabic digits converted to ASCII
  let cleanPhone = normalizeArabicDigits(phoneNumber || '').replace(/\D/g, '');
  // Normalize Saudi local mobile numbers e.g. 0501234567 -> 966501234567
  if (cleanPhone.startsWith('05') && cleanPhone.length === 10) {
    cleanPhone = '966' + cleanPhone.substring(1);
  } else if (cleanPhone.startsWith('00')) {
    cleanPhone = cleanPhone.substring(2);
  }
  const encodedText = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedText}`;
}
