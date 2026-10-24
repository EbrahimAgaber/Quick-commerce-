import { describe, it, expect, vi, beforeEach } from 'vitest';

// Node environment window & CustomEvent polyfill for tests
const listeners: Record<string, ((e: any) => void)[]> = {};
if (!(globalThis as any).window) {
  (globalThis as any).window = {
    dispatchEvent: (event: any) => {
      const callbacks = listeners[event.type] || [];
      callbacks.forEach((cb) => cb(event));
      return true;
    },
    addEventListener: (type: string, cb: any) => {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(cb);
    },
    removeEventListener: (type: string, cb: any) => {
      if (!listeners[type]) return;
      listeners[type] = listeners[type].filter((fn) => fn !== cb);
    },
  };
}
if (!(globalThis as any).CustomEvent) {
  (globalThis as any).CustomEvent = class CustomEvent {
    type: string;
    detail: any;
    constructor(type: string, options?: any) {
      this.type = type;
      this.detail = options?.detail;
    }
  };
}

import { 
  NotificationHub, 
  playOrderNotificationSound, 
  requestDesktopNotificationPermission,
  buildTelegramMessage,
  buildDiscordPayload
} from '../src/services/notificationService';
import { Order, StoreSettings } from '../src/types/store';
import { DEFAULT_SETTINGS } from '../src/services/storeStorage';
import { toWhatsAppNumber, buildWhatsAppLink } from '../src/utils/digits';
import { buildWhatsAppInvoiceMessage, buildMerchantCustomerUpdateMessage, formatPaymentMethodLabel } from '../src/utils/whatsappInvoice';

describe('NotificationHub & Real-time Alert System', () => {
  const mockSettings: StoreSettings = {
    ...DEFAULT_SETTINGS,
    storeName: 'متجر الرياض الفاخر',
    storeSubtitle: 'أفخم العطور والأزياء',
    businessType: 'عطور ومستحضرات تجميل',
    tagline: 'الجودة والأناقة',
    whatsappNumber: '966500000000',
    currency: 'SAR',
    city: 'الرياض',
    freeShippingThreshold: 200,
    standardShippingRate: 25,
    enableAudioNotifications: true,
    enableDesktopNotifications: true,
    telegramBotToken: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
    telegramChatId: '987654321',
    notificationWebhookUrl: 'https://discord.com/api/webhooks/123/abc',
  };

  const mockOrder: Order = {
    id: 'ORD-NOTIF-999',
    timestamp: new Date().toISOString(),
    customerName: 'فيصل القحطاني',
    customerPhone: '966512345678',
    city: 'الرياض',
    deliveryAddress: 'حي النرجس، شارع أنس بن مالك',
    paymentMethod: 'cash_on_delivery',
    itemsSummary: '2x عطر ملكي، 1x بخور عود',
    items: [
      { productId: 'p1', name: 'عطر ملكي', price: 150, quantity: 2 },
      { productId: 'p2', name: 'بخور عود', price: 80, quantity: 1 },
    ],
    subtotal: 380,
    shippingFee: 0,
    grandTotal: 380,
    status: 'Received',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('dispatches storelink_new_order_placed CustomEvent on window with order and settings via alertMerchantLocally', () => {
    const eventSpy = vi.fn();
    window.addEventListener('storelink_new_order_placed', eventSpy);

    const report = NotificationHub.alertMerchantLocally(mockOrder, mockSettings);

    expect(eventSpy).toHaveBeenCalledTimes(1);
    const eventDetail = eventSpy.mock.calls[0][0].detail;
    expect(eventDetail.order.id).toBe(mockOrder.id);
    expect(eventDetail.order.customerName).toBe('فيصل القحطاني');
    expect(report.audioPlayed).toBe(true);

    window.removeEventListener('storelink_new_order_placed', eventSpy);
  });

  it('deduplicates rapid consecutive dispatches for the same order ID', () => {
    const dedupOrder: Order = { ...mockOrder, id: 'ORD-DEDUP-UNIQUE-1' };
    const eventSpy = vi.fn();
    window.addEventListener('storelink_new_order_placed', eventSpy);

    // First call: succeeds
    const report1 = NotificationHub.alertMerchantLocally(dedupOrder, mockSettings);
    expect(report1.audioPlayed).toBe(true);

    // Second call immediately with same order ID: skipped by deduplication
    const report2 = NotificationHub.alertMerchantLocally(dedupOrder, mockSettings);
    expect(report2.audioPlayed).toBe(false);

    // Event listener only fired once
    expect(eventSpy).toHaveBeenCalledTimes(1);

    window.removeEventListener('storelink_new_order_placed', eventSpy);
  });

  it('ensures dispatchOrderPlaced defaults to remote channels without alerting shopper locally', async () => {
    const eventSpy = vi.fn();
    window.addEventListener('storelink_new_order_placed', eventSpy);

    const shopperOrder: Order = { ...mockOrder, id: 'ORD-SHOPPER-NO-CHIME' };
    const report = await NotificationHub.dispatchOrderPlaced(shopperOrder, mockSettings);

    // Shopper device does NOT receive audio chime or local toast by default
    expect(report.audioPlayed).toBe(false);
    expect(eventSpy).not.toHaveBeenCalled();

    window.removeEventListener('storelink_new_order_placed', eventSpy);
  });

  it('synthesizes Web Audio chime cleanly without throwing errors', () => {
    expect(() => {
      playOrderNotificationSound();
    }).not.toThrow();
  });

  it('formats Telegram Markdown message with customer name, total, and items', () => {
    const message = buildTelegramMessage(mockOrder, mockSettings);
    expect(message).toContain('فيصل القحطاني');
    expect(message).toContain('ORD-NOTIF-999');
    expect(message).toContain('380 SAR');
    expect(message).toContain('عطر ملكي');
    expect(message).toContain('متجر الرياض الفاخر');
  });

  it('formats Discord rich embed payload with emerald branding and fields', () => {
    const payload = buildDiscordPayload(mockOrder, mockSettings);
    expect(payload.embeds).toBeDefined();
    expect(payload.embeds[0].title).toContain('ORD-NOTIF-999');
    expect(payload.embeds[0].description).toContain('فيصل القحطاني');
    expect(payload.embeds[0].color).toBe(0x10b981);
    expect(payload.embeds[0].fields.length).toBeGreaterThanOrEqual(2);
  });

  it('validates missing Telegram token or chat ID gracefully in sendTestTelegram', async () => {
    const res = await NotificationHub.sendTestTelegram('', '', mockSettings);
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  });

  it('validates missing Webhook URL gracefully in sendTestWebhook', async () => {
    const res = await NotificationHub.sendTestWebhook('', mockSettings);
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  });

  it('handles requestDesktopNotificationPermission in test environment safely', async () => {
    const granted = await requestDesktopNotificationPermission();
    expect(typeof granted).toBe('boolean');
  });

  describe('WhatsApp Normalization & Link Generation', () => {
    it('normalizes local Saudi numbers to international WhatsApp format (fixing @0558698103 error)', () => {
      // The exact user-reported number from WhatsApp screenshot
      expect(toWhatsAppNumber('0558698103')).toBe('966558698103');
      expect(buildWhatsAppLink('0558698103')).toBe('https://wa.me/966558698103');

      // With text
      expect(buildWhatsAppLink('0558698103', 'طلب جديد')).toBe('https://wa.me/966558698103?text=%D8%B7%D9%84%D8%A8%20%D8%AC%D8%AF%D9%8A%D8%AF');

      // Eastern Arabic digits
      expect(toWhatsAppNumber('٠٥٥٨٦٩٨١٠٣')).toBe('966558698103');

      // Formatted with spaces and +
      expect(toWhatsAppNumber('+966 55 869 8103')).toBe('966558698103');

      // Leading 00
      expect(toWhatsAppNumber('00966558698103')).toBe('966558698103');

      // 9 digits without leading 0
      expect(toWhatsAppNumber('558698103')).toBe('966558698103');
    });

    it('formats shopper-to-merchant order message with customer perspective rather than thanking themselves', () => {
      const msg = buildWhatsAppInvoiceMessage(mockOrder, mockSettings);

      // Perspective: customer greeting and submitting order to store
      expect(msg).toContain('السلام عليكم ورحمة الله وبركاته');
      expect(msg).toContain('أود تأكيد طلبي الجديد من متجر');
      expect(msg).toContain(mockSettings.storeName);
      expect(msg).toContain(mockOrder.id);
      expect(msg).toContain('الدفع عند الاستلام (COD) 💵');
      expect(msg).toContain('بانتظار تأكيدكم وبدء التجهيز، شكراً لكم!');

      // Must NOT contain inverted store-to-customer receipt text
      expect(msg).not.toContain('شكراً لتسوقك من');
    });

    it('formats merchant-to-customer confirmation message with premium customer service tone', () => {
      const msg = buildMerchantCustomerUpdateMessage(mockOrder, mockSettings);

      // Perspective: store addressing customer politely
      expect(msg).toContain(`مرحباً أ. ${mockOrder.customerName}`);
      expect(msg).toContain(`تحية طيبة من فريق *${mockSettings.storeName}*`);
      expect(msg).toContain(`تم استلام وتأكيد طلبكم بنجاح وجارٍ التجهيز 📋`);
      expect(msg).toContain(`380 SAR`);
      expect(msg).toContain(`الدفع عند الاستلام (COD) 💵`);
      expect(msg).toContain(`track=ORD-NOTIF-999`);
      expect(msg).toContain(`فريق خدمة العملاء`);
    });

    it('localizes payment method labels properly for Arabic shoppers', () => {
      expect(formatPaymentMethodLabel('cod')).toBe('الدفع عند الاستلام (COD) 💵');
      expect(formatPaymentMethodLabel('cash_on_delivery')).toBe('الدفع عند الاستلام (COD) 💵');
      expect(formatPaymentMethodLabel('card')).toBe('مدفوع إلكترونياً (مدى / Apple Pay) ✅');
      expect(formatPaymentMethodLabel('apple_pay')).toBe('مدفوع إلكترونياً (مدى / Apple Pay) ✅');
      expect(formatPaymentMethodLabel('bank_transfer')).toBe('تحويل بنكي فوري 🏦');
    });
  });
});
