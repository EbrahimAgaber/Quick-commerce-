import path from 'path';
import fs from 'fs';

const DATA_DIR = path.resolve(process.cwd(), 'data');

export interface WhatsAppServiceStatus {
  status: 'disconnected' | 'connecting' | 'connected' | 'qr_ready';
  qrCodeDataUrl: string | null;
  connectedPhone: string | null;
  lastConnectedAt: string | null;
  error?: string | null;
}

const WA_AUTH_DIR = path.join(DATA_DIR, 'whatsapp_session');

class ServerWhatsAppManager {
  private socket: any = null;
  private status: 'disconnected' | 'connecting' | 'connected' | 'qr_ready' = 'disconnected';
  private currentQrRaw: string | null = null;
  private currentQrDataUrl: string | null = null;
  private connectedPhone: string | null = null;
  private lastConnectedAt: string | null = null;
  private lastError: string | null = null;
  private isInitializing: boolean = false;

  constructor() {
    this.ensureSessionDir();
  }

  private ensureSessionDir(): void {
    try {
      if (!fs.existsSync(WA_AUTH_DIR)) {
        fs.mkdirSync(WA_AUTH_DIR, { recursive: true });
      }
    } catch (e) {
      console.warn('Notice creating whatsapp auth dir:', e);
    }
  }

  public getStatus(): WhatsAppServiceStatus {
    return {
      status: this.status,
      qrCodeDataUrl: this.currentQrDataUrl,
      connectedPhone: this.connectedPhone,
      lastConnectedAt: this.lastConnectedAt,
      error: this.lastError,
    };
  }

  public async initialize(): Promise<WhatsAppServiceStatus> {
    if (this.status === 'connected') {
      return this.getStatus();
    }
    if (this.isInitializing) {
      return this.getStatus();
    }

    this.isInitializing = true;
    this.status = 'connecting';
    this.lastError = null;

    try {
      // Dynamic import to prevent client/bundler crashes
      const baileys = await import('@whiskeysockets/baileys');
      const makeWASocket = baileys.default || baileys.makeWASocket;
      const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = baileys;
      const pino = (await import('pino')).default;
      const QRCode = (await import('qrcode')).default;

      this.ensureSessionDir();
      const { state, saveCreds } = await useMultiFileAuthState(WA_AUTH_DIR);
      let version: [number, number, number] = [2, 3000, 1015901307];
      try {
        const vResult = await fetchLatestBaileysVersion();
        if (vResult?.version) {
          version = vResult.version;
        }
      } catch {}

      // Create socket with silent logger
      const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ['Quick-Ecommerce Desktop', 'Chrome', '124.0.0.0'],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
      });

      this.socket = sock;

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.currentQrRaw = qr;
          this.status = 'qr_ready';
          try {
            this.currentQrDataUrl = await QRCode.toDataURL(qr, {
              margin: 2,
              width: 280,
              color: {
                dark: '#0B253F',
                light: '#FFFFFF',
              },
            });
          } catch (qrErr: any) {
            this.currentQrDataUrl = null;
          }
        }

        if (connection === 'open') {
          this.status = 'connected';
          this.currentQrRaw = null;
          this.currentQrDataUrl = null;
          this.lastConnectedAt = new Date().toISOString();
          this.lastError = null;

          const userJid = sock.user?.id || '';
          const rawNum = userJid.split(':')[0] || userJid.split('@')[0];
          this.connectedPhone = rawNum || 'متصل';
          console.log(`[WhatsApp Service] ✅ Successfully connected to WhatsApp: +${this.connectedPhone}`);
        } else if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          this.socket = null;
          this.connectedPhone = null;

          if (statusCode === DisconnectReason.loggedOut) {
            console.log('[WhatsApp Service] ⚠️ Logged out from WhatsApp.');
            this.status = 'disconnected';
            this.clearSessionFiles();
          } else if (shouldReconnect) {
            console.log('[WhatsApp Service] 🔄 Reconnecting WhatsApp...');
            this.status = 'connecting';
            this.isInitializing = false;
            setTimeout(() => this.initialize().catch(() => {}), 3000);
          } else {
            this.status = 'disconnected';
            this.lastError = 'انقطع الاتصال بواتساب. يرجى إعادة المحاولة.';
          }
        }
      });

      this.isInitializing = false;
      return this.getStatus();
    } catch (err: any) {
      this.isInitializing = false;
      this.status = 'disconnected';
      this.lastError = err?.message || 'تعذر بدء خدمة واتساب';
      console.error('[WhatsApp Service Error]:', err);
      return this.getStatus();
    }
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.socket) {
        try {
          await this.socket.logout();
        } catch {}
        try {
          this.socket.end(new Error('Manual user logout'));
        } catch {}
      }
    } finally {
      this.socket = null;
      this.status = 'disconnected';
      this.currentQrRaw = null;
      this.currentQrDataUrl = null;
      this.connectedPhone = null;
      this.lastError = null;
      this.clearSessionFiles();
    }
  }

  public clearSessionFiles(): void {
    try {
      if (fs.existsSync(WA_AUTH_DIR)) {
        fs.rmSync(WA_AUTH_DIR, { recursive: true, force: true });
        fs.mkdirSync(WA_AUTH_DIR, { recursive: true });
      }
    } catch (err) {
      console.warn('Notice clearing whatsapp auth files:', err);
    }
  }

  public async sendMessage(recipientPhone: string, text: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (this.status !== 'connected' || !this.socket) {
      return {
        success: false,
        error: 'خدمة واتساب غير متصلة. يرجى مسح رمز الاستجابة السريعة (QR) أولاً للربط.',
      };
    }

    try {
      let clean = recipientPhone.replace(/\D/g, '');
      if (clean.startsWith('05')) {
        clean = '966' + clean.slice(1);
      } else if (clean.startsWith('5') && clean.length === 9) {
        clean = '966' + clean;
      }
      if (!clean) {
        return { success: false, error: 'رقم هاتف المستلم غير صحيح.' };
      }

      const jid = `${clean}@s.whatsapp.net`;
      const sent = await this.socket.sendMessage(jid, { text });

      return {
        success: true,
        messageId: sent?.key?.id,
      };
    } catch (err: any) {
      console.error('[WhatsApp Service Send Error]:', err);
      return {
        success: false,
        error: err?.message || 'فشل إرسال رسالة الواتساب في الخلفية.',
      };
    }
  }
}

export const serverWhatsAppManager = new ServerWhatsAppManager();
