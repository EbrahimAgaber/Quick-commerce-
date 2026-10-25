export interface WhatsAppBridgeStatus {
  status: 'disconnected' | 'connecting' | 'connected' | 'qr_ready';
  qrCodeDataUrl: string | null;
  connectedPhone: string | null;
  lastConnectedAt: string | null;
  error?: string | null;
  isHostedStatic?: boolean;
}

export class WhatsAppClientBridge {
  private static pollTimer: any = null;

  /**
   * Resolves the active backend API root:
   * - If running locally or on local server: use origin ('')
   * - If running on static hosting (e.g. quick-ecommerce-saas-app.web.app): allow configuring a local relay or show instructions
   */
  private static getApiBase(): string {
    return '';
  }

  /**
   * Fetches the current WhatsApp connection status
   */
  public static async getStatus(): Promise<WhatsAppBridgeStatus> {
    try {
      const res = await fetch(`${this.getApiBase()}/api/whatsapp/status`);
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        // Returned HTML (e.g. static hosting rewrite)
        const isStaticHosting = typeof window !== 'undefined' && window.location.hostname.includes('web.app');
        return {
          status: 'disconnected',
          qrCodeDataUrl: null,
          connectedPhone: null,
          lastConnectedAt: null,
          isHostedStatic: isStaticHosting,
        };
      }
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
      const res = await fetch(`${this.getApiBase()}/api/whatsapp/connect`, { method: 'POST' });
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        const isStaticHosting = typeof window !== 'undefined' && window.location.hostname.includes('web.app');
        if (isStaticHosting) {
          return {
            status: 'disconnected',
            qrCodeDataUrl: null,
            connectedPhone: null,
            lastConnectedAt: null,
            isHostedStatic: true,
            error: 'خدمة خادم الواتساب (Baileys Node Engine) تعمل على جهازك أو سيرفر المتجر المحلي. للربط، افتح لوحة التحكم عبر السيرفر المحلي (http://localhost:3000 أو IP الشبكة) لتوليد رمز QR وحفظ الجلسة.',
          };
        }
        throw new Error(`HTTP ${res.status}: لم يتم العثور على استجابة JSON من الخادم`);
      }
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
      const res = await fetch(`${this.getApiBase()}/api/whatsapp/disconnect`, { method: 'POST' });
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
      const res = await fetch(`${this.getApiBase()}/api/whatsapp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return {
          success: false,
          error: 'خدمة خادم الواتساب غير متوفرة على هذا النطاق السحابي حالياً. استخدم الإرسال المباشر.',
        };
      }
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
