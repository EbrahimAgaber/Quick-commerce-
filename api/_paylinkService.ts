/**
 * Paylink Saudi Arabia Gateway Service
 * Documentation: https://developer.paylink.sa
 *
 * Testing Base URL: https://restpilot.paylink.sa
 * Production Base URL: https://restapi.paylink.sa
 */

export interface PaylinkAuthConfig {
  apiId: string;
  secretKey: string;
  isTestMode?: boolean;
}

export interface PaylinkInvoiceProduct {
  title: string;
  price: number;
  qty: number;
  description?: string;
}

export interface PaylinkCreateInvoicePayload {
  orderNumber: string;
  amount: number; // In SAR (minimum 5.00)
  callBackUrl: string;
  cancelUrl?: string;
  clientName: string;
  clientMobile: string;
  clientEmail?: string;
  currency?: string;
  products: PaylinkInvoiceProduct[];
  note?: string;
}

export interface PaylinkInvoiceResponse {
  success: boolean;
  transactionNo?: string;
  url?: string;
  qrUrl?: string;
  error?: string;
}

export interface PaylinkInvoiceDetails {
  transactionNo: string;
  orderNumber: string;
  orderStatus: 'Paid' | 'Pending' | 'Declined' | 'Canceled' | string;
  amount: number;
  paymentReceipt?: {
    paymentMethod?: string;
    receiptUrl?: string;
    cardNumber?: string;
    transactionId?: string;
  };
  clientName?: string;
  clientMobile?: string;
}

export class PaylinkGateway {
  // Official Paylink Sandbox Testing credentials from developer.paylink.sa
  public static readonly DEFAULT_SANDBOX_API_ID = 'APP_ID_1123453311';
  public static readonly DEFAULT_SANDBOX_SECRET = '0662abb5-13c7-38ab-cd12-236e58f43766';

  public static getBaseUrl(isTestMode = false): string {
    return isTestMode ? 'https://restpilot.paylink.sa' : 'https://restapi.paylink.sa';
  }

  /**
   * Authenticate against Paylink and retrieve JWT id_token
   */
  public static async authenticate(config: PaylinkAuthConfig): Promise<string> {
    const baseUrl = this.getBaseUrl(config.isTestMode);
    const res = await fetch(`${baseUrl}/api/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        apiId: config.apiId,
        secretKey: config.secretKey,
        persistToken: false,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Paylink authentication failed (${res.status}): ${errText || res.statusText}`);
    }

    const data = await res.json();
    if (!data.id_token) {
      throw new Error('Paylink auth did not return id_token');
    }
    return data.id_token;
  }

  /**
   * Sanitizes orderNumber to conform to alphanumeric + dash format
   */
  public static sanitizeOrderNumber(orderNumber: string): string {
    const cleaned = String(orderNumber || '')
      .replace(/#/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .trim();
    return cleaned || `ORD${Date.now()}`;
  }

  /**
   * Sanitizes Saudi mobile phone number to standard 05xxxxxxxx format
   */
  public static sanitizeMobile(phone: string): string {
    let digits = String(phone || '').replace(/\D/g, '');
    if (digits.startsWith('00966')) {
      digits = digits.slice(5);
    } else if (digits.startsWith('966')) {
      digits = digits.slice(3);
    }
    if (!digits.startsWith('0') && digits.length === 9) {
      digits = '0' + digits;
    }
    if (digits.length === 10 && digits.startsWith('05')) {
      return digits;
    }
    return digits || '0500000000';
  }

  /**
   * Create an invoice / checkout transaction link
   */
  public static async createInvoice(
    config: PaylinkAuthConfig,
    payload: PaylinkCreateInvoicePayload
  ): Promise<PaylinkInvoiceResponse> {
    const token = await this.authenticate(config);
    const baseUrl = this.getBaseUrl(config.isTestMode);

    const sanitizedOrderNumber = this.sanitizeOrderNumber(payload.orderNumber);
    const sanitizedMobile = this.sanitizeMobile(payload.clientMobile);

    const res = await fetch(`${baseUrl}/api/addInvoice`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        orderNumber: sanitizedOrderNumber,
        amount: Math.max(5.0, Number(payload.amount.toFixed(2))),
        callBackUrl: payload.callBackUrl,
        cancelUrl: payload.cancelUrl || payload.callBackUrl,
        clientName: payload.clientName || 'عميل المتجر',
        clientMobile: sanitizedMobile,
        clientEmail: payload.clientEmail || 'customer@storelink.sa',
        currency: payload.currency || 'SAR',
        products: payload.products && payload.products.length > 0 ? payload.products : [
          {
            title: `Order #${sanitizedOrderNumber}`,
            price: Math.max(5.0, Number(payload.amount.toFixed(2))),
            qty: 1,
          }
        ],
        note: payload.note,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        success: false,
        error: `Paylink invoice creation failed (${res.status}): ${errText || res.statusText}`,
      };
    }

    const data = await res.json();
    return {
      success: true,
      transactionNo: data.transactionNo,
      url: data.url,
      qrUrl: data.qrUrl,
    };
  }

  /**
   * Query invoice details and verify payment status
   */
  public static async getInvoice(
    config: PaylinkAuthConfig,
    transactionNo: string
  ): Promise<PaylinkInvoiceDetails> {
    const token = await this.authenticate(config);
    const baseUrl = this.getBaseUrl(config.isTestMode);

    const res = await fetch(`${baseUrl}/api/getInvoice/${encodeURIComponent(transactionNo)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Paylink getInvoice failed (${res.status}): ${errText || res.statusText}`);
    }

    return await res.json();
  }
}
