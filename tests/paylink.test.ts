import { describe, it, expect, vi } from 'vitest';
import { PaylinkGateway } from '../api/_paylinkService';

describe('Paylink Saudi Gateway Integration Suite', () => {
  it('uses the correct environment base URLs', () => {
    expect(PaylinkGateway.getBaseUrl(true)).toBe('https://restpilot.paylink.sa');
    expect(PaylinkGateway.getBaseUrl(false)).toBe('https://restapi.paylink.sa');
  });

  it('provides official test credentials out of the box', () => {
    expect(PaylinkGateway.DEFAULT_SANDBOX_API_ID).toBe('APP_ID_1123453311');
    expect(PaylinkGateway.DEFAULT_SANDBOX_SECRET).toBe('0662abb5-13c7-38ab-cd12-236e58f43766');
  });

  it('authenticates against Paylink auth endpoint', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch' as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id_token: 'mock_jwt_paylink_token_xyz' }),
    } as any);

    const token = await PaylinkGateway.authenticate({
      apiId: 'APP_ID_1123453311',
      secretKey: '0662abb5-13c7-38ab-cd12-236e58f43766',
      isTestMode: true,
    });

    expect(token).toBe('mock_jwt_paylink_token_xyz');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://restpilot.paylink.sa/api/auth',
      expect.objectContaining({
        method: 'POST',
      })
    );

    fetchSpy.mockRestore();
  });

  it('creates an invoice and returns transactionNo & checkout URL', async () => {
    // 1st call is auth, 2nd call is addInvoice
    const fetchSpy = vi
      .spyOn(global, 'fetch' as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id_token: 'mock_token' }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          transactionNo: '1730549999000',
          url: 'https://restpilot.paylink.sa/payment/1730549999000',
        }),
      } as any);

    const res = await PaylinkGateway.createInvoice(
      {
        apiId: 'APP_ID_1123453311',
        secretKey: '0662abb5-13c7-38ab-cd12-236e58f43766',
        isTestMode: true,
      },
      {
        orderNumber: 'ORD-12345',
        amount: 150.0,
        callBackUrl: 'https://storelink.sa/order/ORD-12345',
        clientName: 'أحمد التميمي',
        clientMobile: '0501234567',
        products: [{ title: 'عسل سدر طبيعي', price: 150.0, qty: 1 }],
      }
    );

    expect(res.success).toBe(true);
    expect(res.transactionNo).toBe('1730549999000');
    expect(res.url).toContain('https://restpilot.paylink.sa/payment/');

    fetchSpy.mockRestore();
  });

  it('queries invoice details via getInvoice to verify Paid status', async () => {
    const fetchSpy = vi
      .spyOn(global, 'fetch' as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id_token: 'mock_token' }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transactionNo: '1730549999000',
          orderNumber: 'ORD-12345',
          orderStatus: 'Paid',
          amount: 150.0,
          paymentReceipt: {
            paymentMethod: 'Mada',
            receiptUrl: 'https://paylink.sa/receipt/1730549999000',
          },
        }),
      } as any);

    const invoice = await PaylinkGateway.getInvoice(
      {
        apiId: 'APP_ID_1123453311',
        secretKey: '0662abb5-13c7-38ab-cd12-236e58f43766',
        isTestMode: true,
      },
      '1730549999000'
    );

    expect(invoice.orderStatus).toBe('Paid');
    expect(invoice.amount).toBe(150.0);
    expect(invoice.paymentReceipt?.paymentMethod).toBe('Mada');

    fetchSpy.mockRestore();
  });
});
