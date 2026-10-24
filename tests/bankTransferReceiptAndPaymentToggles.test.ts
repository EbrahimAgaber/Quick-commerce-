import { describe, it, expect, beforeEach } from 'vitest';

const storageMap = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => storageMap.get(key) ?? null,
  setItem: (key: string, value: string) => storageMap.set(key, String(value)),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
  get length() {
    return storageMap.size;
  },
  key: (i: number) => Array.from(storageMap.keys())[i] ?? null,
};

(globalThis as any).localStorage = mockLocalStorage;
if (!(globalThis as any).window) {
  (globalThis as any).window = {
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
    location: { origin: 'https://storelink.sa', pathname: '/', search: '' },
  };
}

import { StoreManager } from '../src/services/storeManager';
import { buildWhatsAppInvoiceMessage } from '../src/utils/whatsappInvoice';
import { buildTelegramMessage, buildDiscordPayload } from '../src/services/notificationService';

describe('Payment Methods Toggles & Mandatory Bank Transfer Receipt Flow', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    StoreManager.resetCorruptedStorage();
  });

  it('1. Rejects bank_transfer orders when receipt attachment is missing', async () => {
    const store = StoreManager.getActiveStore();
    const firstProduct = store.products[0];

    const res = await StoreManager.submitOrderToServer({
      storeId: store.id,
      items: [{ productId: firstProduct.id, qty: 1 }],
      customer: {
        name: 'خالد السبيعي',
        phone: '0501234567',
        city: 'الرياض',
        address: 'حي النرجس',
      },
      paymentMethod: 'bank_transfer',
      bankTransferReceiptUrl: '', // Missing receipt!
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('إرفاق إيصال التحويل البنكي');
  });

  it('2. Finalizes bank_transfer order with pending_receipt_review status and notifies merchant with shopper info', async () => {
    const store = StoreManager.getActiveStore();
    const firstProduct = store.products[0];
    const sampleReceipt =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

    const res = await StoreManager.submitOrderToServer({
      storeId: store.id,
      items: [{ productId: firstProduct.id, qty: 2 }],
      customer: {
        name: 'سلطان القحطاني',
        phone: '0551122334',
        city: 'جدة',
        address: 'حي الروضة',
      },
      paymentMethod: 'bank_transfer',
      bankTransferReceiptUrl: sampleReceipt,
      bankTransferReceiptFileName: 'alrajhi-receipt.png',
      bankTransferSenderName: 'سلطان عبدالله القحطاني',
    });

    expect(res.success).toBe(true);
    expect(res.order).toBeDefined();
    const order = res.order!;

    // Order is finalized (Received) while payment remains pending review
    expect(order.status).toBe('Received');
    expect(order.paymentStatus).toBe('pending_receipt_review');
    expect(order.bankTransferReceiptUrl).toBe(sampleReceipt);
    expect(order.bankTransferReceiptFileName).toBe('alrajhi-receipt.png');
    expect(order.bankTransferSenderName).toBe('سلطان عبدالله القحطاني');
    expect(order.trackingNotes).toContain('بانتظار مراجعة التاجر واعتماد الدفع');

    // Verify WhatsApp & Telegram & Discord merchant notifications include shopper name, order info, and receipt indicator
    const waMsg = buildWhatsAppInvoiceMessage(order, store.settings);
    expect(waMsg).toContain('سلطان القحطاني');
    expect(waMsg).toContain(order.id);
    expect(waMsg).toContain('تم إرفاق إيصال التحويل البنكي');
    expect(waMsg).toContain('سلطان عبدالله القحطاني');

    const tgMsg = buildTelegramMessage(order, store.settings);
    expect(tgMsg).toContain('سلطان القحطاني');
    expect(tgMsg).toContain('إيصال التحويل البنكي');

    const discordPayload = buildDiscordPayload(order, store.settings);
    expect(discordPayload.embeds[0].description).toContain('إيصال التحويل');
  });

  it('3. Allows merchant to mark bank_transfer order as Paid after inspecting receipt', async () => {
    const store = StoreManager.getActiveStore();
    const firstProduct = store.products[0];
    const sampleReceipt =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

    const res = await StoreManager.submitOrderToServer({
      storeId: store.id,
      items: [{ productId: firstProduct.id, qty: 1 }],
      customer: {
        name: 'نورة العتيبي',
        phone: '0549988776',
        city: 'الرياض',
        address: 'حي الملقا',
      },
      paymentMethod: 'bank_transfer',
      bankTransferReceiptUrl: sampleReceipt,
    });

    expect(res.success).toBe(true);
    const order = res.order!;
    expect(order.paymentStatus).toBe('pending_receipt_review');
    expect(order.paidAt).toBeUndefined();

    // Merchant marks order as Paid
    const verifiedAt = new Date().toISOString();
    const paidOrder = {
      ...order,
      status: 'Paid' as const,
      paymentStatus: 'paid' as const,
      paidAt: verifiedAt,
      bankTransferVerifiedAt: verifiedAt,
      trackingNotes: 'تم التحقق من إيصال التحويل البنكي واعتماد الدفع بنجاح — الطلب قيد التجهيز ✅',
    };

    await StoreManager.updateOrderInStore(store.id, paidOrder);
    const updatedStore = StoreManager.getStoreById(store.id)!;
    const savedOrder = updatedStore.orders.find((o) => o.id === order.id)!;

    expect(savedOrder.status).toBe('Paid');
    expect(savedOrder.paymentStatus).toBe('paid');
    expect(savedOrder.paidAt).toBe(verifiedAt);
    expect(savedOrder.bankTransferVerifiedAt).toBe(verifiedAt);
  });

  it('4. Persists merchant payment method toggles in StoreSettings', () => {
    const store = StoreManager.getActiveStore();

    // Merchant toggles off COD and leaves only Bank Transfer and Card
    const updatedSettings = {
      ...store.settings,
      paymentMethods: ['تحويل بنكي فوري (Bank Transfer)', 'بطاقات مدى / فيزا / Apple Pay'],
      enableOnlinePayments: true,
    };

    StoreManager.updateStore({
      ...store,
      settings: updatedSettings,
    });

    const reloaded = StoreManager.getStoreById(store.id)!;
    expect(reloaded.settings.paymentMethods).toEqual([
      'تحويل بنكي فوري (Bank Transfer)',
      'بطاقات مدى / فيزا / Apple Pay',
    ]);
    expect(reloaded.settings.paymentMethods.some((m) => m.includes('الاستلام'))).toBe(false);
  });
});
