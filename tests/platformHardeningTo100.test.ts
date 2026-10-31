import { describe, it, expect, vi, beforeEach } from 'vitest';
import healthHandler from '../api/health';
import anonymizeHandler from '../api/anonymizeCustomerData';
import moyasarWebhookHandler from '../api/moyasarWebhook';

// Mocks for _security
vi.mock('../api/_security', () => ({
  handleCors: vi.fn(() => true),
  checkRateLimit: vi.fn(() => true),
  evaluateRateLimit: vi.fn(async () => ({ allowed: true, limit: 100, remaining: 99, resetAt: Date.now() + 60000 })),
  setRateLimitHeaders: vi.fn(),
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

const mockVerifyIdToken = vi.fn();
const mockFirestoreData: Record<string, any> = {};

vi.mock('../api/_firebaseAdmin', () => ({
  getAdminAuth: () => ({
    verifyIdToken: mockVerifyIdToken,
  }),
  getAdminFirestore: () => ({
    runTransaction: async (updateFunction: any) => {
      const tx = {
        get: async (ref: any) => ref.get(),
        set: async (ref: any, data: any) => ref.set(data),
        create: async (ref: any, data: any) => ref.set(data),
        update: async (ref: any, data: any) => ref.update(data),
      };
      return await updateFunction(tx);
    },
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
                  if (!mockFirestoreData[subPath]) throw new Error(`Doc not found: ${subPath}`);
                  mockFirestoreData[subPath] = { ...mockFirestoreData[subPath], ...data };
                },
              };
            },
          }),
        };
      },

      where: (field: string, op: string, val: string) => ({
        limit: () => ({
          get: async () => {
            for (const key of Object.keys(mockFirestoreData)) {
              if (key.startsWith(`${collName}/`)) {
                const doc = mockFirestoreData[key];
                if (doc && doc[field] === val) {
                  const id = key.split('/')[1];
                  return {
                    empty: false,
                    docs: [{
                      id,
                      ref: {
                        collection: (subColl: string) => ({
                          doc: (subDocId: string) => ({
                            get: async () => ({
                              exists: Boolean(mockFirestoreData[`${collName}/${id}/${subColl}/${subDocId}`]),
                              data: () => mockFirestoreData[`${collName}/${id}/${subColl}/${subDocId}`] || null,
                            }),
                            update: async (data: any) => {
                              mockFirestoreData[`${collName}/${id}/${subColl}/${subDocId}`] = {
                                ...mockFirestoreData[`${collName}/${id}/${subColl}/${subDocId}`],
                                ...data,
                              };
                            },
                          }),
                        }),
                      },
                      data: () => doc,
                    }],
                  };
                }
              }
            }
            return { empty: true, docs: [] };
          },
        }),
      }),
    }),
  }),
}));

const createMockRes = () => {
  const res: any = {};
  res.statusCode = 200;
  res.status = vi.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn().mockImplementation((payload: any) => {
    res.body = payload;
    return res;
  });
  return res;
};

describe('Synthetic Health & SLA Canary: /api/health', () => {
  it('returns 200 healthy status with latency and service reports', async () => {
    const req = { method: 'GET' };
    const res = createMockRes();

    await healthHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.services.firestore).toBe('operational');
    expect(res.body.services.carrierEngine).toBe('operational');
    expect(res.body.carrierProviders).toContain('torod');
    expect(res.body.carrierProviders).toContain('smsa');
    expect(res.body.carrierProviders).toContain('spl');
    expect(res.body.compliance.saudiPdplArticle18).toBe('active');
    expect(res.body.latency.totalExecutionMs).toBeGreaterThanOrEqual(0);
  });
});

describe('Saudi PDPL Customer Right-to-Erasure: /api/anonymizeCustomerData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockFirestoreData).forEach((k) => delete mockFirestoreData[k]);
  });

  it('rejects anonymization of an in-transit order that is not yet delivered or cancelled', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'merchant_1' });
    mockFirestoreData['stores/store_1'] = { ownerId: 'merchant_1' };
    mockFirestoreData['stores/store_1/orders/ord_active'] = {
      id: 'ord_active',
      status: 'In Progress',
      customerName: 'محمد العتيبي',
      customerPhone: '0501112233',
    };

    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer merchant_token' },
      body: { storeId: 'store_1', orderId: 'ord_active' },
    };
    const res = createMockRes();

    await anonymizeHandler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('لا يمكن تعمية بيانات طلب قيد التوصيل');
  });

  it('anonymizes customer PII while strictly preserving financial and VAT records', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'merchant_1' });
    mockFirestoreData['stores/store_1'] = { ownerId: 'merchant_1' };
    mockFirestoreData['stores/store_1/orders/ord_delivered'] = {
      id: 'ord_delivered',
      status: 'Delivered',
      customerName: 'سارة الدوسري',
      customerPhone: '0559988776',
      deliveryAddress: 'حي الياسمين، الرياض',
      googleMapsUrl: 'https://maps.google.com/?q=24.7,46.6',
      deliveryPin: '4921',
      grandTotal: 345,
      subtotal: 300,
      vatAmount: 45,
      items: [{ name: 'عباية حرير', price: 300, quantity: 1 }],
      invoiceUuid: 'inv-uuid-9901',
    };

    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer merchant_token' },
      body: { storeId: 'store_1', orderId: 'ord_delivered' },
    };
    const res = createMockRes();

    await anonymizeHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('تمت تعمية ومسح البيانات الشخصية بنجاح');

    const anonymizedOrder = mockFirestoreData['stores/store_1/orders/ord_delivered'];
    expect(anonymizedOrder.customerName).toBe('عميل محمي (PDPL)');
    expect(anonymizedOrder.customerPhone).toBe('+966500000000');
    expect(anonymizedOrder.deliveryAddress).toContain('العنوان محذوف بموجب نظام حماية البيانات الشخصية');
    expect(anonymizedOrder.googleMapsUrl).toBeNull();
    expect(anonymizedOrder.deliveryPin).toBeNull();

    // Financial totals remain intact for ZATCA 5-year retention
    expect(anonymizedOrder.grandTotal).toBe(345);
    expect(anonymizedOrder.vatAmount).toBe(45);
    expect(anonymizedOrder.subtotal).toBe(300);
    expect(anonymizedOrder.invoiceUuid).toBe('inv-uuid-9901');
    expect(anonymizedOrder.anonymizedAt).toBeDefined();

    // Tracking projection was updated
    const trackingDoc = mockFirestoreData['tracking/ord_delivered'];
    expect(trackingDoc.customerName).toBe('عميل محمي (PDPL)');
    expect(trackingDoc.phoneLast4).toBe('0000');
  });

  it('allows verified shopper to request their own data erasure via matching phone', async () => {
    mockFirestoreData['stores/store_1'] = { ownerId: 'merchant_1' };
    mockFirestoreData['stores/store_1/orders/ord_shopper'] = {
      id: 'ord_shopper',
      status: 'Delivered',
      customerName: 'فهد العسيري',
      customerPhone: '0567788990',
      deliveryAddress: 'حي الورود',
      grandTotal: 150,
    };

    const req = {
      method: 'POST',
      headers: {},
      body: {
        storeId: 'store_1',
        orderId: 'ord_shopper',
        customerPhone: '0567788990',
      },
    };
    const res = createMockRes();

    await anonymizeHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    const updated = mockFirestoreData['stores/store_1/orders/ord_shopper'];
    expect(updated.customerName).toBe('عميل محمي (PDPL)');
    expect(updated.anonymizedBy).toBe('shopper');
  });
});

describe('Moyasar Distributed Idempotency Key Registry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockFirestoreData).forEach((k) => delete mockFirestoreData[k]);
  });

  it('intercepts duplicate webhook event via atomic idempotency registry', async () => {
    mockFirestoreData['stores/store_1'] = {
      ownerId: 'merchant_1',
      storeName: 'Test Store',
    };
    mockFirestoreData['stores/store_1/private/payment'] = {
      webhookSecret: 'test_sec_123',
    };
    mockFirestoreData['stores/store_1/orders/ord_100'] = {
      id: 'ord_100',
      status: 'In Progress',
      grandTotal: 200,
    };
    // Pre-seed atomic idempotency key
    mockFirestoreData['webhook_idempotency_keys/moyasar_pay_dup_paid'] = {
      paymentId: 'pay_dup',
      orderId: 'ord_100',
      createdAt: new Date().toISOString(),
    };

    const req = {
      method: 'POST',
      headers: {
        'x-moyasar-secret': 'test_sec_123',
      },
      body: {
        id: 'event_1',
        secret_token: 'test_sec_123',
        data: {
          id: 'pay_dup',
          status: 'paid',
          amount: 20000,
          currency: 'SAR',
          metadata: {
            storeId: 'store_1',
            orderId: 'ord_100',
          },
        },
      },
    };
    const res = createMockRes();

    await moyasarWebhookHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toContain('Atomic idempotency key hit');
  });
});
