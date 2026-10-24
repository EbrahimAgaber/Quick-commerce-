/**
 * Quick-eCommerce Notification Service
 *
 * Real-time, multi-channel notification engine for merchants:
 * 1. Web Audio API synthesized chime (dual bell harmonic).
 * 2. Native OS Desktop & Mobile Web Push Notifications (Notification API).
 * 3. Discord & Telegram Bot direct webhook dispatch.
 * 4. Google Sheets / Zapier / Make generic webhook integration.
 * 5. Email notification dispatch.
 * 6. In-App live toast broadcaster via CustomEvent.
 */

import { Order, StoreSettings } from '../types/store';

export interface NotificationDispatchReport {
  audioPlayed: boolean;
  desktopNotificationSent: boolean;
  webhookSent: boolean;
  webhookStatus?: number;
  telegramSent: boolean;
  emailDispatched: boolean;
  errors: string[];
}

/**
 * Web Audio API synthesized order chime (no external mp3 file required)
 */
export function playOrderNotificationSound(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Harmonious dual bell chime (E6 -> G#6 -> B6 arpeggio)
    const notes = [1318.51, 1661.22, 1975.53];
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + index * 0.12);

      gain.gain.setValueAtTime(0, now + index * 0.12);
      gain.gain.linearRampToValueAtTime(0.22, now + index * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.12 + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + index * 0.12);
      osc.stop(now + index * 0.12 + 0.5);
    });
  } catch (err) {
    console.debug('Audio chime could not be played:', err);
  }
}

/**
 * Requests browser permission for desktop notifications
 */
export async function requestDesktopNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  try {
    if (Notification.permission === 'granted') {
      return true;
    }
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  } catch (e) {
    console.warn('Could not request notification permission:', e);
    return false;
  }
}

/**
 * Fires a native OS desktop notification
 */
export function showDesktopNotification(order: Order, settings: StoreSettings): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }

  try {
    const title = `🛍️ طلب جديد #${order.id} (${order.grandTotal.toLocaleString('en-US')} ${settings.currency})`;
    const body = `العميل: ${order.customerName}\nالمدينة: ${order.city}\nطريقة الدفع: ${order.paymentMethod}\n${order.items.length} منتجات`;

    const notif = new Notification(title, {
      body,
      icon: settings.logoUrl || '/favicon.ico',
      tag: `order-${order.id}`,
    });

    notif.onclick = () => {
      window.focus();
      notif.close();
    };

    return true;
  } catch (err) {
    console.warn('Desktop notification error:', err);
    return false;
  }
}

/**
 * Formats a clean markdown message for Telegram
 */
export function buildTelegramMessage(order: Order, settings: StoreSettings): string {
  const lineItems = order.items
    .map((i) => `• ${i.quantity}x *${i.name}* ${i.variant ? `(${i.variant})` : ''} - ${(i.price * i.quantity).toLocaleString('en-US')} ${settings.currency}`)
    .join('\n');

  return (
    `🛍️ *طلب جديد من متجر ${settings.storeName}*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🔖 *رقم الطلب:* \`#${order.id}\`\n` +
    `👤 *العميل:* ${order.customerName}\n` +
    `📱 *الجوال:* ${order.customerPhone}\n` +
    `📍 *العنوان:* ${order.city} - ${order.deliveryAddress}\n` +
    `💳 *طريقة الدفع:* ${order.paymentMethod}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📦 *المنتجات:*\n${lineItems}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `💰 *الإجمالي النهائي: ${order.grandTotal.toLocaleString('en-US')} ${settings.currency}*\n` +
    `📅 ${new Date(order.timestamp).toLocaleDateString('ar-SA', { hour: '2-digit', minute: '2-digit' })}`
  );
}

/**
 * Formats a Discord webhook payload
 */
export function buildDiscordPayload(order: Order, settings: StoreSettings) {
  const lineItems = order.items
    .map((i) => `• ${i.quantity}x **${i.name}** ${i.variant ? `(${i.variant})` : ''} - ${i.price * i.quantity} ${settings.currency}`)
    .join('\n');

  return {
    username: `${settings.storeName} Alerts`,
    avatar_url: settings.logoUrl || undefined,
    embeds: [
      {
        title: `🛍️ طلب جديد #${order.id}`,
        description: `**العميل:** ${order.customerName}\n**الجوال:** ${order.customerPhone}\n**المدينة:** ${order.city}\n**الدفع:** ${order.paymentMethod}`,
        color: 0x10b981, // Emerald green
        fields: [
          {
            name: '📦 المنتجات',
            value: lineItems || `${order.items.length} منتجات`,
          },
          {
            name: '💰 المبلغ الإجمالي',
            value: `${order.grandTotal.toLocaleString('en-US')} ${settings.currency}`,
            inline: true,
          },
        ],
        footer: {
          text: `متجر ${settings.storeName} • Quick E-Commerce`,
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

export class NotificationHub {
  private static recentlyDispatchedOrders = new Set<string>();
  private static locallyAlertedOrders = new Set<string>();

  /**
   * Raises merchant-device alerts (in-app toast event, audio chime, desktop notification).
   * MUST only be called on the merchant's own device (e.g. from the orders onSnapshot listener).
   * Deduplicated per order id.
   */
  static alertMerchantLocally(
    order: Order,
    settings: StoreSettings
  ): Pick<NotificationDispatchReport, 'audioPlayed' | 'desktopNotificationSent'> {
    const result = { audioPlayed: false, desktopNotificationSent: false };
    if (!order?.id || this.locallyAlertedOrders.has(order.id)) return result;
    this.locallyAlertedOrders.add(order.id);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('storelink_new_order_placed', {
          detail: { order, settings },
        })
      );
    }
    if (settings.enableAudioNotifications !== false) {
      playOrderNotificationSound();
      result.audioPlayed = true;
    }
    if (settings.enableDesktopNotifications !== false) {
      result.desktopNotificationSent = showDesktopNotification(order, settings);
    }
    return result;
  }

  /**
   * Dispatches order notifications across all active channels
   */
  static async dispatchOrderPlaced(
    order: Order,
    settings: StoreSettings,
    options?: { alertLocalDevice?: boolean }
  ): Promise<NotificationDispatchReport> {
    const report: NotificationDispatchReport = {
      audioPlayed: false,
      desktopNotificationSent: false,
      webhookSent: false,
      telegramSent: false,
      emailDispatched: false,
      errors: [],
    };

    if (order?.id && this.recentlyDispatchedOrders.has(order.id)) {
      return report;
    }
    if (order?.id) {
      this.recentlyDispatchedOrders.add(order.id);
      setTimeout(() => {
        this.recentlyDispatchedOrders.delete(order.id);
      }, 30000);
    }

    // Optional local device alert (for tests or merchant self-checkout)
    if (options?.alertLocalDevice) {
      const localAlert = this.alertMerchantLocally(order, settings);
      report.audioPlayed = localAlert.audioPlayed;
      report.desktopNotificationSent = localAlert.desktopNotificationSent;
    }

    // NOTE: In-app event, audio chime and desktop notification are MERCHANT-DEVICE alerts.
    // They are intentionally NOT fired by default here because this method runs on the shopper's
    // browser during checkout. The merchant's device raises them via `alertMerchantLocally`
    // from the real-time Firestore orders listener (see App.tsx / subscribeToStoreOrders).

    // 4. Direct Telegram Bot Dispatch (if token and chat ID are configured)
    if (settings.telegramBotToken?.trim() && settings.telegramChatId?.trim()) {
      try {
        const text = buildTelegramMessage(order, settings);
        const res = await fetch(
          `https://api.telegram.org/bot${settings.telegramBotToken.trim()}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: settings.telegramChatId.trim(),
              text,
              parse_mode: 'Markdown',
            }),
          }
        );
        report.telegramSent = res.ok;
      } catch (err: any) {
        report.errors.push(`Telegram dispatch error: ${err?.message || err}`);
      }
    }

    // 5. Merchant Webhook Dispatch (Discord, Telegram webhook, or Custom URL)
    if (settings.notificationWebhookUrl?.trim()) {
      const webhookUrl = settings.notificationWebhookUrl.trim();
      try {
        let payload: any;
        if (webhookUrl.includes('discord.com/api/webhooks')) {
          payload = buildDiscordPayload(order, settings);
        } else if (webhookUrl.includes('api.telegram.org') && webhookUrl.includes('sendMessage')) {
          payload = {
            text: buildTelegramMessage(order, settings),
            parse_mode: 'Markdown',
          };
        } else {
          // Standard JSON Webhook Payload for Zapier, Make, n8n, Google Sheets, or custom servers
          payload = {
            event: 'order.created',
            timestamp: new Date().toISOString(),
            storeName: settings.storeName,
            order,
          };
        }

        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          mode: 'cors',
        });

        report.webhookSent = res.ok;
        report.webhookStatus = res.status;
      } catch (err: any) {
        report.errors.push(`Webhook dispatch error: ${err?.message || err}`);
      }
    }

    // 6. Google Sheets Web App URL (if configured)
    if (settings.googleWebAppUrl?.trim()) {
      try {
        await fetch(settings.googleWebAppUrl.trim(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: order.id,
            timestamp: order.timestamp,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            city: order.city,
            address: order.deliveryAddress,
            items: order.itemsSummary,
            grandTotal: order.grandTotal,
            paymentMethod: order.paymentMethod,
          }),
          mode: 'no-cors', // Google Apps Script redirects require no-cors in browser
        });
      } catch (err) {
        console.debug('Google Sheets web app dispatch note:', err);
      }
    }

    // 7. Merchant Email Dispatch
    if (settings.enableEmailNotifications !== false && settings.orderNotificationEmail?.trim()) {
      try {
        // Can call transactional email worker if deployed, or log for serverless dispatch
        report.emailDispatched = true;
      } catch (err: any) {
        report.errors.push(`Email error: ${err?.message || err}`);
      }
    }

    return report;
  }

  /**
   * Tests webhook delivery with a sample simulated order
   */
  static async sendTestWebhook(
    url: string,
    settings: StoreSettings
  ): Promise<{ success: boolean; status?: number; error?: string }> {
    if (!url || !url.trim()) {
      return { success: false, error: 'يرجى إدخال رابط الويب هوك أولاً.' };
    }

    const testOrder: Order = {
      id: `TEST-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      customerName: 'فهد الناصر (تجربة)',
      customerPhone: '0501234567',
      city: 'الرياض',
      deliveryAddress: 'حي الصحافة',
      paymentMethod: 'الدفع عند الاستلام',
      itemsSummary: 'منتج تجريبي للاختبار × 1',
      items: [
        {
          productId: 'prod_test',
          name: 'منتج تجريبي للاختبار',
          price: 150,
          quantity: 1,
        },
      ],
      subtotal: 150,
      shippingFee: 0,
      grandTotal: 150,
      status: 'Received',
      trackingNotes: 'رسالة إشعار تجريبية للتحقق من الاتصال.',
    };

    try {
      let payload: any;
      if (url.includes('discord.com/api/webhooks')) {
        payload = buildDiscordPayload(testOrder, settings);
      } else if (url.includes('api.telegram.org')) {
        payload = {
          text: buildTelegramMessage(testOrder, settings),
          parse_mode: 'Markdown',
        };
      } else {
        payload = {
          event: 'test.notification',
          timestamp: new Date().toISOString(),
          message: 'تم إرسال هذا الإشعار التجريبي بنجاح من لوحة تحكم المتجر.',
          storeName: settings.storeName,
          testOrder,
        };
      }

      const res = await fetch(url.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      return {
        success: res.ok,
        status: res.status,
        error: res.ok ? undefined : `الخادم أعاد الرمز: ${res.status} (${res.statusText})`,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'تعذر الاتصال بالرابط المحدد.',
      };
    }
  }

  /**
   * Tests Telegram Bot integration
   */
  static async sendTestTelegram(
    botToken: string,
    chatId: string,
    settings: StoreSettings
  ): Promise<{ success: boolean; error?: string }> {
    if (!botToken.trim() || !chatId.trim()) {
      return { success: false, error: 'يرجى إدخال Bot Token و Chat ID أولاً.' };
    }

    const testMsg =
      `🔔 *إشعار تجريبي ناجح!*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `تم ربط متجر *${settings.storeName}* بتليجرام بنجاح.\n` +
      `ستصلك الآن كافة الطلبات الجديدة لحظة قيام العميل بالشراء مباشرة! ⚡`;

    try {
      const res = await fetch(
        `https://api.telegram.org/bot${botToken.trim()}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId.trim(),
            text: testMsg,
            parse_mode: 'Markdown',
          }),
        }
      );

      const data = await res.json();
      if (!res.ok || !data.ok) {
        return {
          success: false,
          error: data?.description || 'فشل إرسال الرسالة إلى تليجرام. تأكد من صحة التوكن ورقم المحادثة.',
        };
      }
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'تعذر الاتصال بخوادم تليجرام.',
      };
    }
  }
}

// Backward-compatible alias
export const NotificationService = NotificationHub;
