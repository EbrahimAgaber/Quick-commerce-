import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  CarrierService, 
  MockCarrierProvider, 
  TorodCarrierProvider, 
  SmsaCarrierProvider, 
  SplCarrierProvider, 
  AramexCarrierProvider,
  CarrierManager,
  ShipmentRequest
} from '../src/services/carrierService';
import handler from '../api/createShipment';

// Mock dependencies for api/createShipment
vi.mock('../api/_security', () => ({
  handleCors: vi.fn(() => true),
}));

const mockVerifyIdToken = vi.fn();
const mockFirestoreData: Record<string, any> = {};

vi.mock('../api/_firebaseAdmin', () => ({
  getAdminAuth: () => ({
    verifyIdToken: mockVerifyIdToken,
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

describe('Saudi Carrier Integration Engine', () => {
  const sampleShipmentReq: ShipmentRequest = {
    orderId: 'ORD_KSA_991',
    storeId: 'store_riyadh_01',
    sender: {
      name: 'متجر التميز السعودي',
      phone: '0501112233',
      city: 'الرياض',
      address: 'طريق الملك فهد، حي الصحافة',
    },
    recipient: {
      name: 'فيصل القحطاني',
      phone: '0559988776',
      city: 'جدة',
      address: 'حي الشاطئ، شارع الأمير سلطان',
    },
    packages: {
      weightKg: 2.5,
      description: 'عطور ومستحضرات تجميل',
      itemCount: 3,
    },
    codAmount: 245,
  };

  it('Torod Carrier Provider generates authentic AWB and tracking URLs', async () => {
    const torod = new TorodCarrierProvider();
    expect(torod.name).toBe('Torod');

    const res = await torod.createShipment(sampleShipmentReq);
    expect(res.success).toBe(true);
    expect(res.trackingNumber).toMatch(/^TRD-\d+/);
    expect(res.courierName).toContain('تورود');
    expect(res.labelUrl).toContain('.pdf');
    expect(res.trackingUrl).toContain('https://track.torod.co/');

    const tracking = await torod.trackShipment(res.trackingNumber);
    expect(tracking.status).toBe('in_transit');
    expect(tracking.location).toContain('الرياض');

    const cancelled = await torod.cancelShipment(res.trackingNumber);
    expect(cancelled).toBe(true);
  });

  it('SMSA Express Provider generates standard 11-digit AWB and SMSA tracking/label endpoints', async () => {
    const smsa = new SmsaCarrierProvider();
    expect(smsa.name).toBe('SMSA');

    const res = await smsa.createShipment(sampleShipmentReq);
    expect(res.success).toBe(true);
    expect(res.trackingNumber).toMatch(/^290\d{8}/);
    expect(res.courierName).toContain('سمسا إكسبريس');
    expect(res.labelUrl).toContain('smsaexpress.com/printlabel.aspx');
    expect(res.trackingUrl).toContain('smsaexpress.com/tracking?trackNumber=');

    const tracking = await smsa.trackShipment(res.trackingNumber);
    expect(tracking.status).toBe('in_transit');
    expect(tracking.location).toContain('السلي');
  });

  it('SPL Subul Provider generates Saudi Post Universal Postal barcodes', async () => {
    const spl = new SplCarrierProvider();
    expect(spl.name).toBe('SPL');

    const res = await spl.createShipment(sampleShipmentReq);
    expect(res.success).toBe(true);
    expect(res.trackingNumber).toMatch(/^SPL\d+SA$/);
    expect(res.courierName).toContain('سبل');
    expect(res.labelUrl).toContain('splonline.com.sa/labels/');
    expect(res.trackingUrl).toContain('splonline.com.sa/ar/tracking/');

    const tracking = await spl.trackShipment(res.trackingNumber);
    expect(tracking.status).toBe('in_transit');
  });

  it('Aramex Provider generates standard 10-digit AWB starting with 3', async () => {
    const aramex = new AramexCarrierProvider('', '', true);
    expect(aramex.name).toBe('Aramex');

    const res = await aramex.createShipment(sampleShipmentReq);
    expect(res.success).toBe(true);
    expect(res.trackingNumber).toMatch(/^3\d{9}/);
    expect(res.courierName).toContain('أرامكس');
    expect(res.labelUrl).toContain('aramex.net');
    expect(res.trackingUrl).toContain('aramex.com/track');
  });

  it('CarrierManager correctly resolves all registered providers and lists available options', () => {
    const manager = new CarrierManager();
    const providers = manager.listAvailableProviders();
    expect(providers.length).toBe(5);

    const providerIds = providers.map((p) => p.id);
    expect(providerIds).toContain('torod');
    expect(providerIds).toContain('smsa');
    expect(providerIds).toContain('spl');
    expect(providerIds).toContain('aramex');
    expect(providerIds).toContain('mock');

    expect(manager.getProvider('smsa')).toBeInstanceOf(SmsaCarrierProvider);
    expect(manager.getProvider('spl')).toBeInstanceOf(SplCarrierProvider);
    expect(manager.getProvider('torod')).toBeInstanceOf(TorodCarrierProvider);
    expect(manager.getProvider('aramex')).toBeInstanceOf(AramexCarrierProvider);
    expect(manager.getProvider('mock')).toBeInstanceOf(MockCarrierProvider);
    expect(manager.getProvider('unknown_carrier')).toBeInstanceOf(MockCarrierProvider);
  });
});

describe('API Endpoint: /api/createShipment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockFirestoreData).forEach((k) => delete mockFirestoreData[k]);
  });

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

  it('returns 401 when merchant authorization header is absent', async () => {
    const req = {
      method: 'POST',
      headers: {},
      body: { storeId: 'store_1', orderId: 'ord_1' },
    };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toContain('Authentication required');
  });

  it('returns 401 when token verification fails', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));
    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer bad_token' },
      body: { storeId: 'store_1', orderId: 'ord_1' },
    };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toContain('Invalid merchant authentication token');
  });

  it('returns 403 when authenticated merchant is not the store owner', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'merchant_bob' });
    mockFirestoreData['stores/store_1'] = {
      ownerId: 'merchant_alice',
      storeName: 'Alice Boutique',
    };

    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer valid_token' },
      body: { storeId: 'store_1', orderId: 'ord_1' },
    };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toContain('not authorized');
  });

  it('returns 400 when order is already cancelled', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'merchant_alice' });
    mockFirestoreData['stores/store_1'] = {
      ownerId: 'merchant_alice',
      storeName: 'Alice Boutique',
    };
    mockFirestoreData['stores/store_1/orders/ord_cancelled'] = {
      id: 'ord_cancelled',
      status: 'Cancelled',
      customerName: 'سارة',
      grandTotal: 150,
    };

    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer valid_token' },
      body: { storeId: 'store_1', orderId: 'ord_cancelled' },
    };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('لا يمكن إصدار بوليصة شحن لطلب ملغي');
  });

  it('successfully generates AWB via SMSA and updates Firestore order & tracking projections', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'merchant_alice' });
    mockFirestoreData['stores/store_1'] = {
      ownerId: 'merchant_alice',
      storeName: 'Alice Boutique',
      city: 'الرياض',
      whatsappNumber: '0501234567',
    };
    mockFirestoreData['stores/store_1/orders/ord_101'] = {
      id: 'ord_101',
      status: 'Received',
      customerName: 'فهد التميمي',
      customerPhone: '0551239876',
      city: 'الدمام',
      deliveryAddress: 'حي الشاطئ',
      paymentMethod: 'Cash on Delivery',
      grandTotal: 320,
      itemsSummary: '2 × عطر مسك أبيض',
      items: [{ productId: 'p1', name: 'عطر مسك أبيض', quantity: 2, price: 160 }],
    };

    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer valid_token' },
      body: {
        storeId: 'store_1',
        orderId: 'ord_101',
        provider: 'smsa',
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.shipment.trackingNumber).toMatch(/^290\d{8}/);
    expect(res.body.shipment.courierName).toContain('سمسا إكسبريس');
    expect(res.body.shipment.labelUrl).toContain('smsaexpress.com/printlabel.aspx');
    expect(res.body.shipment.status).toBe('In Progress');

    // Verify order document in store subcollection was updated
    const updatedOrder = mockFirestoreData['stores/store_1/orders/ord_101'];
    expect(updatedOrder.status).toBe('In Progress');
    expect(updatedOrder.trackingNumber).toBe(res.body.shipment.trackingNumber);
    expect(updatedOrder.courierName).toBe(res.body.shipment.courierName);
    expect(updatedOrder.labelUrl).toBe(res.body.shipment.labelUrl);

    // Verify public tracking projection was synchronized
    const trackingDoc = mockFirestoreData['tracking/ord_101'];
    expect(trackingDoc).toBeDefined();
    expect(trackingDoc.orderId).toBe('ord_101');
    expect(trackingDoc.trackingNumber).toBe(res.body.shipment.trackingNumber);
    expect(trackingDoc.courierName).toBe(res.body.shipment.courierName);
    expect(trackingDoc.status).toBe('In Progress');
  });

  it('supports Torod Aggregator dispatch with COD amounts', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'merchant_alice' });
    mockFirestoreData['stores/store_1'] = {
      ownerId: 'merchant_alice',
      storeName: 'Alice Boutique',
      city: 'الرياض',
    };
    mockFirestoreData['stores/store_1/orders/ord_torod'] = {
      id: 'ord_torod',
      status: 'Paid',
      customerName: 'منى العتيبي',
      customerPhone: '0507766554',
      city: 'مكة المكرمة',
      deliveryAddress: 'حي العوالي',
      paymentMethod: 'Apple Pay',
      grandTotal: 180,
      items: [{ productId: 'p2', name: 'حقيبة يد جلدية', quantity: 1, price: 180 }],
    };

    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer valid_token' },
      body: {
        storeId: 'store_1',
        orderId: 'ord_torod',
        provider: 'torod',
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.shipment.trackingNumber).toMatch(/^TRD-\d+/);
    expect(res.body.shipment.courierName).toContain('تورود');
    expect(res.body.shipment.labelUrl).toContain('.pdf');
    // Status was Paid, should remain Paid
    expect(res.body.shipment.status).toBe('Paid');
  });
});
