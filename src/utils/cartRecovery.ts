import { CartItem, StoreSettings } from '../types/store';
import { createWhatsAppUrl } from './whatsappInvoice';

export interface AbandonedCartRecord {
  storeId: string;
  items: CartItem[];
  customerPhone?: string;
  lastUpdated: string;
}

const STORAGE_PREFIX = 'storelink_abandoned_cart_';

export function saveCartForRecovery(storeId: string, items: CartItem[], customerPhone?: string) {
  if (typeof window === 'undefined') return;
  try {
    if (!items || items.length === 0) {
      localStorage.removeItem(`${STORAGE_PREFIX}${storeId}`);
      return;
    }
    const record: AbandonedCartRecord = {
      storeId,
      items,
      customerPhone,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(`${STORAGE_PREFIX}${storeId}`, JSON.stringify(record));
  } catch (e) {
    console.debug('Failed to save cart for recovery:', e);
  }
}

export function getSavedCartForRecovery(storeId: string): AbandonedCartRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${storeId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearCartRecovery(storeId: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${storeId}`);
  } catch (e) {
    console.debug('Failed to clear cart recovery:', e);
  }
}

/**
 * Creates a WhatsApp recovery reminder URL for an abandoned cart
 */
export function createAbandonedCartWhatsAppUrl(
  settings: StoreSettings,
  recipientPhone: string,
  items: CartItem[]
): string {
  const itemsText = items.map((i) => `• ${i.quantity}× ${i.product.name}`).join('\n');
  const storeUrl = window.location.origin;
  const message = `مرحباً بك! لاحظنا أنك تركت سلة التسوق في متجر ${settings.storeName}:\n${itemsText}\n\nيمكنك استكمال طلبك وتأكيد الشحن في أي وقت عبر الرابط:\n${storeUrl}`;
  return createWhatsAppUrl(recipientPhone, message);
}
