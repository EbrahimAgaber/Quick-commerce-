import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFirestoreData: Record<string, any> = {};

vi.mock('../api/_security', () => ({
  handleCors: vi.fn(() => true),
  checkRateLimit: vi.fn(() => true),
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

vi.mock('../api/_firebaseAdmin', () => ({
  getAdminAuth: () => ({
    verifyIdToken: vi.fn(),
  }),
  getAdminFirestore: () => ({
    collection: (collName: string) => ({
      doc: (docId: string) => {
        const fullPath = `${collName}/${docId}`;
        return {
          get: async () => ({
            exists: Boolean(mockFirestoreData[fullPath]),
            id: docId,
            data: () => mockFirestoreData[fullPath] || null,
          }),
          set: async (data: any, options?: any) => {
            if (options?.merge && mockFirestoreData[fullPath]) {
              mockFirestoreData[fullPath] = { ...mockFirestoreData[fullPath], ...data };
            } else {
              mockFirestoreData[fullPath] = data;
            }
          },
          update: async (data: any) => {
            if (!mockFirestoreData[fullPath]) throw new Error(`Doc not found: ${fullPath}`);
            mockFirestoreData[fullPath] = { ...mockFirestoreData[fullPath], ...data };
          },
          collection: (subCollName: string) => ({
            doc: (subDocId: string) => {
              const subPath = `${fullPath}/${subCollName}/${subDocId}`;
              return {
                get: async () => ({
                  exists: Boolean(mockFirestoreData[subPath]),
                  id: subDocId,
                  data: () => mockFirestoreData[subPath] || null,
                }),
                set: async (data: any) => {
                  mockFirestoreData[subPath] = data;
                },
                update: async (data: any) => {
                  mockFirestoreData[subPath] = { ...mockFirestoreData[subPath], ...data };
                },
              };
            },
          }),
        };
      },
      where: () => ({
        limit: () => ({
          get: async () => ({ empty: true, docs: [] }),
        }),
      }),
    }),
    runTransaction: async (updateFunction: any) => {
      const tx = {
        get: async (ref: any) => ref.get(),
        set: async (ref: any, data: any) => ref.set(data),
        create: async (ref: any, data: any) => ref.set(data),
        update: async (ref: any, data: any) => ref.update(data),
      };
      return await updateFunction(tx);
    },
  }),
}));

import moyasarWebhookHandler from '../api/moyasarWebhook';

function createMockReq(body: any, headers: Record<string, string> = {}, query: Record<string, string> = {}) {
  return {
    method: 'POST',
    body,
    headers: {
      origin: 'https://storelink.sa',
      ...headers,
    },
    query,
  };
}

function createMockRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
    setHeader() {},
  };
  return res;
}

describe('Phase 4: Moyasar Webhook Hardening', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    for (const k of Object.keys(mockFirestoreData)) {
      delete mockFirestoreData[k];
    }
    // Setup store in mock firestore
    mockFirestoreData['stores/store_1'] = { id: 'store_1', name: 'Test Store' };
    mockFirestoreData['stores/store_1/orders/ORD-1'] = {
      id: 'ORD-1',
      grandTotal: 100,
      status: 'Received',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('1. Fails closed (401) in development/test if no webhook secret is configured', async () => {
    delete process.env.MOYASAR_WEBHOOK_SECRET;

    const req = createMockReq({
      id: 'evt_1',
      type: 'payment_paid',
      data: {
        id: 'pay_1',
        status: 'paid',
        amount: 10000,
        currency: 'SAR',
        metadata: { storeId: 'store_1', orderId: 'ORD-1' },
      },
    });
    const res = createMockRes();

    await moyasarWebhookHandler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toContain('Failing closed');
  });

  it('2. Rejects webhook secret sent via query string (prevents log leakage)', async () => {
    process.env.MOYASAR_WEBHOOK_SECRET = 'secret_correct_123';

    const req = createMockReq(
      {
        id: 'evt_1',
        type: 'payment_paid',
        data: {
          id: 'pay_1',
          status: 'paid',
          amount: 10000,
          currency: 'SAR',
          metadata: { storeId: 'store_1', orderId: 'ORD-1' },
        },
      },
      {}, // No header
      { secret: 'secret_correct_123' } // In query string!
    );
    const res = createMockRes();

    await moyasarWebhookHandler(req, res);
    // Must be rejected because query secrets are disallowed
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toContain('Invalid or missing webhook secret');
  });

  it('3. Accepts valid secret_token in body using timing-safe comparison', async () => {
    process.env.MOYASAR_WEBHOOK_SECRET = 'secret_correct_123';

    // Mock fetch for live Moyasar verification call
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'pay_1',
        status: 'paid',
        amount: 10000,
        currency: 'SAR',
        metadata: { storeId: 'store_1', orderId: 'ORD-1' },
      }),
    });

    const req = createMockReq({
      id: 'evt_1',
      type: 'payment_paid',
      secret_token: 'secret_correct_123',
      data: {
        id: 'pay_1',
        status: 'paid',
        amount: 10000,
        currency: 'SAR',
        metadata: { storeId: 'store_1', orderId: 'ORD-1' },
      },
    });
    const res = createMockRes();

    await moyasarWebhookHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('Paid');
  });
});
