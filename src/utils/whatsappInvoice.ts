import { Order, StoreSettings } from '../types/store';

/**
 * Generates a clean, unique order reference e.g., "BA-4821" or "SL-7392"
 */
export function generateOrderId(prefix: string = 'BA'): string {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${randomNum}`;
}

/**
 * Formats a clean, professional WhatsApp invoice message that matches Store.link's layout
 */
export function buildWhatsAppInvoiceMessage(order: Order, settings: StoreSettings): string {
  const lineItemsText = order.items
    .map(
      item =>
        `• ${item.quantity}x ${item.name}${item.variant ? ` (مقاس: ${item.variant})` : ''} - ${(item.price * item.quantity).toLocaleString('ar-SA')} ${settings.currency}`
    )
    .join('\n');

  const shippingText =
    order.shippingFee === 0
      ? `مجاني (عرض الشحن المجاني)`
      : `${order.shippingFee.toLocaleString('ar-SA')} ${settings.currency}`;

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
💵 *المجموع الفرعي:* ${order.subtotal.toLocaleString('ar-SA')} ${settings.currency}
🚚 *رسوم التوصيل:* ${shippingText}
💰 *الإجمالي المستحق:* ${order.grandTotal.toLocaleString('ar-SA')} ${settings.currency}
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
  // Strip any +, -, spaces, or parentheses
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  const encodedText = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedText}`;
}
