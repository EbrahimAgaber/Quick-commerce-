import { generateWebhookSignature } from './_security';

export interface ServerNotificationResult {
  telegramSent: boolean;
  webhookSent: boolean;
  errors: string[];
}

/**
 * Builds formatted Telegram order message
 */
function buildTelegramOrderMessage(order: any, settings: any): string {
  const currency = settings.currency || 'ر.س';
  const grandTotal = Number(order.grandTotal).toLocaleString('en-US');
  const itemsText = Array.isArray(order.items)
    ? order.items
        .map((i: any) => `• *${i.quantity}x* ${i.name}${i.variant ? ` (${i.variant})` : ''} — ${Number(i.price * i.quantity).toLocaleString('en-US')} ${currency}`)
        .join('\n')
    : order.itemsSummary || '—';

  return `🛍️ *طلب جديد رقم #${order.id}*
🏬 *المتجر:* ${settings.storeName || order.storeId}

👤 *العميل:* ${order.customerName}
📱 *الهاتف:* \`${order.customerPhone}\`
📍 *المدينة:* ${order.city}
🗺️ *العنوان:* ${order.deliveryAddress}${order.landmarkNotes ? `\n📌 *علامة مميزة:* ${order.landmarkNotes}` : ''}

💳 *طريقة الدفع:* ${order.paymentMethod}
📦 *نوع التوصيل:* ${order.deliveryType === 'pickup' ? 'استلام من الفرع' : 'توصيل للعنوان'}

📋 *المنتجات:*
${itemsText}

💰 *الإجمالي النهائي:* *${grandTotal} ${currency}*
🕒 *الوقت:* ${new Date(order.timestamp).toLocaleString('ar-SA')}

_تم تأكيد الطلب آلياً عبر خادم Quick-eCommerce._`;
}

/**
 * Dispatches server-side merchant notifications asynchronously
 */
export async function dispatchServerOrderNotifications(
  order: any,
  settings: any,
  webhookSecret?: string
): Promise<ServerNotificationResult> {
  const result: ServerNotificationResult = {
    telegramSent: false,
    webhookSent: false,
    errors: [],
  };

  const tasks: Promise<void>[] = [];

  // 1. Telegram Bot Dispatch
  if (settings.telegramBotToken?.trim() && settings.telegramChatId?.trim()) {
    const telegramPromise = (async () => {
      try {
        const text = buildTelegramOrderMessage(order, settings);
        const url = `https://api.telegram.org/bot${settings.telegramBotToken.trim()}/sendMessage`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: settings.telegramChatId.trim(),
            text,
            parse_mode: 'Markdown',
          }),
        });

        if (res.ok) {
          result.telegramSent = true;
        } else {
          const errBody = await res.text();
          result.errors.push(`Telegram HTTP ${res.status}: ${errBody}`);
        }
      } catch (err: any) {
        result.errors.push(`Telegram dispatch failed: ${err?.message || err}`);
      }
    })();
    tasks.push(telegramPromise);
  }

  // 2. Outbound Merchant Webhook Dispatch with HMAC-SHA256 Signature
  if (settings.notificationWebhookUrl?.trim()) {
    const webhookPromise = (async () => {
      try {
        const payload = JSON.stringify({
          event: 'order.created',
          timestamp: new Date().toISOString(),
          storeId: order.storeId,
          orderId: order.id,
          order,
        });

        const secret = webhookSecret || process.env.WEBHOOK_SIGNING_SECRET || 'quick-ecom-secret';
        const { header, timestamp } = generateWebhookSignature(secret, payload);

        const res = await fetch(settings.notificationWebhookUrl.trim(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Quick-eCommerce-Webhook/2.0',
            'X-Quick-Signature': header,
            'X-Quick-Timestamp': timestamp.toString(),
            'X-Quick-Event': 'order.created',
          },
          body: payload,
        });

        if (res.ok) {
          result.webhookSent = true;
        } else {
          result.errors.push(`Webhook HTTP ${res.status}`);
        }
      } catch (err: any) {
        result.errors.push(`Webhook dispatch failed: ${err?.message || err}`);
      }
    })();
    tasks.push(webhookPromise);
  }

  // Execute all remote dispatches concurrently with a safe timeout
  try {
    await Promise.race([
      Promise.all(tasks),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Notification dispatch timeout')), 5000)),
    ]);
  } catch (err: any) {
    result.errors.push(err?.message || 'Notification timeout');
  }

  return result;
}
