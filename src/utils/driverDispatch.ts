import { Order, StoreSettings } from '../types/store';
import { normalizeArabicDigits } from './digits';

export interface DriverDispatchParams {
  order: Order;
  storeSettings: StoreSettings;
  driverFee?: number;
  origin?: string;
  storeSlug?: string;
}

export function generateDriverWhatsAppMessage(params: DriverDispatchParams): string {
  const { order, storeSettings, origin = 'https://storelink.sa', storeSlug = '' } = params;
  const targetStore = storeSlug || '';
  const driverLink = `${origin}/?store=${encodeURIComponent(targetStore)}&driver=${encodeURIComponent(order.id)}`;

  const isCOD =
    (order.paymentMethod || '').toLowerCase().includes('cod') ||
    (order.paymentMethod || '').includes('استلام');

  const paymentStatus = isCOD
    ? `💵 الدفع عند الاستلام (COD): تحصيل ${order.grandTotal} ${storeSettings.currency}`
    : `✅ مدفوع إلكترونياً مسبقاً (لا يُحصّل من العميل)`;

  let msg = `🚚 *مهمة توصيل جديدة - متجر ${storeSettings.storeName}*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📦 *رقم الطلب:* #${order.id}\n`;
  if (storeSettings.storeLocationUrl) {
    msg += `📍 *موقع استلام الشحنة (المحل):* ${storeSettings.storeLocationUrl}\n`;
  }
  msg += `👤 *العميل:* ${order.customerName}\n`;
  msg += `📱 *جوال العميل:* ${order.customerPhone}\n`;
  msg += `🏠 *العنوان:* ${order.city} - ${order.deliveryAddress}\n`;
  if (order.googleMapsUrl) {
    msg += `🗺️ *موقع العميل (Google Maps):* ${order.googleMapsUrl}\n`;
  }
  if (order.landmarkNotes) {
    msg += `📝 *ملاحظات:* ${order.landmarkNotes}\n`;
  }
  msg += `💰 *حالة التحصيل:* ${paymentStatus}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🔗 *رابط مسار التوصيل المباشر للمندوب:* \n${driverLink}\n`;
  msg += `(افتح الرابط بدون الحاجة لتحميل تطبيق لتأكيد الاستلام والتسليم بنقرة واحدة)`;

  return msg;
}

export function generateDriverWhatsAppUrl(params: {
  driverPhone: string;
  message: string;
}): string {
  const cleanPhone = normalizeArabicDigits(params.driverPhone || '').replace(/\D/g, '');
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(params.message)}`;
}

export function calculateDriverSettlement(orders: Order[], driverFeePerOrder: number = 15): {
  totalDelivered: number;
  totalCodCash: number;
  totalDriverEarnings: number;
  netDueToMerchant: number;
} {
  const delivered = orders.filter((o) => o.status === 'Delivered');
  const totalDelivered = delivered.length;

  const totalCodCash = delivered
    .filter((o) => {
      const pm = (o.paymentMethod || '').toLowerCase();
      return pm.includes('cod') || pm.includes('استلام');
    })
    .reduce((sum, o) => sum + (o.grandTotal || 0), 0);

  const totalDriverEarnings = totalDelivered * driverFeePerOrder;
  const netDueToMerchant = Math.max(0, totalCodCash - totalDriverEarnings);

  return {
    totalDelivered,
    totalCodCash,
    totalDriverEarnings,
    netDueToMerchant,
  };
}
