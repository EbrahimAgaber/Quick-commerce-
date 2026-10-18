import { Order, StoreSettings } from '../types/store';

export type NotificationChannel = 'email' | 'sms' | 'whatsapp';

export interface NotificationPayload {
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  message: string;
  orderId?: string;
  metadata?: Record<string, any>;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface NotificationProvider {
  name: string;
  send(payload: NotificationPayload): Promise<NotificationResult>;
}

/**
 * Default Webhook/Mock Notification Provider
 * Can be connected to Resend, Twilio, Taqnyat, or Unifonic in production.
 */
class ConsoleOrWebhookNotificationProvider implements NotificationProvider {
  name = 'ConsoleOrWebhookProvider';

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    // In production, dispatch to backend worker or transactional API
    // (e.g. POST /api/sendNotification)
    if (typeof window !== 'undefined') {
      console.log(`[NotificationService] Sending ${payload.channel} to ${payload.recipient}:`, payload.message);
    }
    return {
      success: true,
      messageId: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };
  }
}

class NotificationServiceManager {
  private providers: Map<NotificationChannel, NotificationProvider> = new Map();

  constructor() {
    const defaultProvider = new ConsoleOrWebhookNotificationProvider();
    this.providers.set('email', defaultProvider);
    this.providers.set('sms', defaultProvider);
    this.providers.set('whatsapp', defaultProvider);
  }

  public registerProvider(channel: NotificationChannel, provider: NotificationProvider) {
    this.providers.set(channel, provider);
  }

  public async notifyOrderCreated(order: Order, settings: StoreSettings): Promise<void> {
    const msg = `تم استلام طلب جديد برقم #${order.id} بمبلغ ${order.grandTotal} ${settings.currency} من العميل ${order.customerName}`;
    
    // 1. Merchant notification
    if (settings.orderNotificationEmail) {
      await this.send({
        channel: 'email',
        recipient: settings.orderNotificationEmail,
        subject: `طلب جديد #${order.id} - ${settings.storeName}`,
        message: msg,
        orderId: order.id,
      });
    }

    // 2. Customer SMS/WhatsApp confirmation if available
    if (order.customerPhone) {
      await this.send({
        channel: 'whatsapp',
        recipient: order.customerPhone,
        message: `مرحباً ${order.customerName}، تم استلام طلبك رقم #${order.id} بنجاح من متجر ${settings.storeName}.`,
        orderId: order.id,
      });
    }
  }

  public async send(payload: NotificationPayload): Promise<NotificationResult> {
    const provider = this.providers.get(payload.channel);
    if (!provider) {
      return { success: false, error: `No provider registered for channel ${payload.channel}` };
    }
    try {
      return await provider.send(payload);
    } catch (err: any) {
      return { success: false, error: err?.message || 'Notification failed' };
    }
  }
}

export const NotificationService = new NotificationServiceManager();

/**
 * Web Audio API synthesized order chime (no external mp3 file required)
 */
export function playOrderNotificationSound() {
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
      gain.gain.linearRampToValueAtTime(0.2, now + index * 0.12 + 0.02);
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
