export interface WhatsAppBridgeStatus {
  status: 'disconnected' | 'connecting' | 'connected' | 'qr_ready';
  qrCodeDataUrl: string | null;
  connectedPhone: string | null;
  lastConnectedAt: string | null;
  error?: string | null;
}

export class WhatsAppClientBridge {
  private static pollTimer: any = null;

  /**
   * Fetches the current WhatsApp connection status
   */
  public static async getStatus(): Promise<WhatsAppBridgeStatus> {
    try {
      const res = await fetch('/api/whatsapp/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      return {
        status: 'disconnected',
        qrCodeDataUrl: null,
        connectedPhone: null,
        lastConnectedAt: null,
      };
    }
  }

  /**
   * Initiates the WhatsApp connection and QR generation
   */
  public static async initiateConnection(): Promise<WhatsAppBridgeStatus> {
    try {
      const res = await fetch('/api/whatsapp/connect', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err: any) {
      return {
        status: 'disconnected',
        qrCodeDataUrl: null,
        connectedPhone: null,
        lastConnectedAt: null,
        error: err?.message || 'تعذر بدء الربط مع خدمة واتساب',
      };
    }
  }

  /**
   * Disconnects / logs out of WhatsApp session
   */
  public static async disconnect(): Promise<boolean> {
    try {
      const res = await fetch('/api/whatsapp/disconnect', { method: 'POST' });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Sends a message in the background without opening WhatsApp Web
   */
  public static async sendMessage(
    phone: string,
    message: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message }),
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'فشل الاتصال بخادم إرسال الواتساب.',
      };
    }
  }
}
