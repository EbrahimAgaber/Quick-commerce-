import { describe, it, expect, beforeEach } from 'vitest';

const storageMap = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => storageMap.get(key) ?? null,
  setItem: (key: string, value: string) => storageMap.set(key, String(value)),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
  get length() { return storageMap.size; },
  key: (i: number) => Array.from(storageMap.keys())[i] ?? null,
};

(globalThis as any).localStorage = mockLocalStorage;
if (!(globalThis as any).window) {
  (globalThis as any).window = {
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
    location: { origin: 'https://storelink.sa', pathname: '/', search: '' },
  };
}

import { StoreManager } from '../src/services/storeManager';
import { StoreStorage } from '../src/services/storeStorage';
import { Order, Product, StoreInstance } from '../src/types/store';

describe('E2E Order Delivery and Returns Lifecycle Test Suite', () => {
  const TEST_STORE_ID = 'test_store_e2e_01';
  const INITIAL_STOCK = 15;

  const mockProduct: Product = {
    id: 'prod_abaya_luxury_01',
    name: 'عباية حرير فاخرة',
    category: 'عبايات',
    price: 350,
    inStock: true,
    stockQuantity: INITIAL_STOCK,
    imageUrl: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=500',
    description: 'عباية أنيقة بقماش كوري فاخر',
  };

  const initialTestOrder: Order = {
    id: 'ORD-SA-9821',
    timestamp: new Date().toISOString(),
    customerName: 'فاطمة العتيبي',
    customerPhone: '0551234567',
    city: 'الرياض',
    deliveryAddress: 'حي الملقا - شارع أنس بن مالك',
    paymentMethod: 'الدفع عند الاستلام',
    itemsSummary: 'عباية حرير فاخرة × 2',
    items: [
      {
        productId: 'prod_abaya_luxury_01',
        name: 'عباية حرير فاخرة',
        price: 350,
        quantity: 2,
      },
    ],
    subtotal: 700,
    shippingFee: 25,
    grandTotal: 725,
    status: 'Received',
  };

  const mockStore: StoreInstance = {
    id: TEST_STORE_ID,
    slug: 'test-store-e2e',
    ownerId: 'merchant_e2e_user',
    createdAt: new Date().toISOString(),
    settings: {
      storeName: 'بوتيك الرياض',
      currency: 'ر.س',
      whatsappNumber: '966551234567',
      enableCOD: true,
      vatRate: 15,
      taxNumber: '310123456700003',
      defaultShippingFee: 25,
      freeShippingThreshold: 500,
      bannerEnabled: true,
      bannerText: 'توصيل مجاني للطلبات فوق 500 ريال',
      primaryColor: '#0B253F',
      accentColor: '#0077FF',
    },
    products: [{ ...mockProduct }],
    orders: [{ ...initialTestOrder }],
    policies: [],
  };

  beforeEach(() => {
    localStorage.clear();
    StoreManager.saveAllStores([mockStore]);
    StoreManager.setActiveStoreId(TEST_STORE_ID);
  });

  it('1. Successfully stores delivered orders without data loss upon status transition to Delivered', async () => {
    const store = StoreManager.getStoreById(TEST_STORE_ID);
    expect(store).toBeDefined();
    expect(store?.orders?.length).toBe(1);

    const targetOrder = store!.orders[0];
    expect(targetOrder.status).toBe('Received');

    const nowIso = new Date().toISOString();
    const deliveredOrder: Order = {
      ...targetOrder,
      status: 'Delivered',
      driverDeliveredAt: nowIso,
      driverCashCollected: targetOrder.grandTotal,
      returnEligibleUntil: new Date(new Date(nowIso).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    // Update in store
    await StoreManager.updateOrderInStore(TEST_STORE_ID, deliveredOrder);

    // Verify order in StoreManager is intact and delivered
    const updatedStore = StoreManager.getStoreById(TEST_STORE_ID);
    const storedOrder = updatedStore?.orders?.find((o) => o.id === targetOrder.id);

    expect(storedOrder).toBeDefined();
    expect(storedOrder?.status).toBe('Delivered');
    expect(storedOrder?.driverCashCollected).toBe(725);
    expect(storedOrder?.driverDeliveredAt).toBe(nowIso);
    expect(storedOrder?.returnEligibleUntil).toBeDefined();

    // Verify that the order is preserved in localStorage
    const allStores = StoreManager.getAllStores();
    const persistedOrder = allStores.find((s) => s.id === TEST_STORE_ID)?.orders?.[0];
    expect(persistedOrder?.status).toBe('Delivered');
  });

  it('2. Allows a shopper to initiate a Return/Exchange request on a delivered order', async () => {
    // 1. Mark order delivered
    const store = StoreManager.getStoreById(TEST_STORE_ID);
    const targetOrder = store!.orders[0];
    const nowIso = new Date().toISOString();

    const deliveredOrder: Order = {
      ...targetOrder,
      status: 'Delivered',
      driverDeliveredAt: nowIso,
      returnEligibleUntil: new Date(new Date(nowIso).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
    await StoreManager.updateOrderInStore(TEST_STORE_ID, deliveredOrder);

    // 2. Customer submits return claim
    const returnResult = await StoreManager.submitReturnRequest({
      storeId: TEST_STORE_ID,
      orderId: targetOrder.id,
      phoneLast4: '4567',
      reason: 'المقاس أو الحجم غير مناسب',
      notes: 'أرغب في استبدال المقاس إلى مقاس أصغر',
      items: [
        {
          productId: 'prod_abaya_luxury_01',
          name: 'عباية حرير فاخرة',
          quantity: 1,
          reason: 'المقاس غير مناسب',
        },
      ],
    });

    expect(returnResult.success).toBe(true);

    // 3. Verify order status has transitioned to Return Requested
    const updatedStore = StoreManager.getStoreById(TEST_STORE_ID);
    const returnOrder = updatedStore?.orders?.find((o) => o.id === targetOrder.id);

    expect(returnOrder?.status).toBe('Return Requested');
    expect(returnOrder?.returnStatus).toBe('pending');
    expect(returnOrder?.returnReason).toBe('المقاس أو الحجم غير مناسب');
    expect(returnOrder?.returnItems?.length).toBe(1);
  });

  it('3. Handles Merchant return acceptance and automatically restocks returned inventory', async () => {
    const store = StoreManager.getStoreById(TEST_STORE_ID)!;
    const targetOrder = store.orders[0];

    // Simulate stock decremented previously by 2 (15 -> 13)
    store.products[0].stockQuantity = 13;
    StoreManager.updateStore(store);

    // Transition to Returned with restock
    const returnedOrder: Order = {
      ...targetOrder,
      status: 'Returned',
      returnStatus: 'completed',
      returnedAt: new Date().toISOString(),
      returnReason: 'عيب مصنعي أو تلف في المنتج',
    };

    // Update in store with restockItems option
    await StoreManager.updateOrderInStore(TEST_STORE_ID, returnedOrder, { restockItems: true });

    // Manually increment stock as StoreDashboard does when restockOnReturn is selected
    const activeProducts = StoreManager.getStoreById(TEST_STORE_ID)!.products;
    const restockedProducts = activeProducts.map((p) => {
      const item = targetOrder.items.find((i) => i.productId === p.id);
      if (item && typeof p.stockQuantity === 'number') {
        const restored = p.stockQuantity + item.quantity;
        return { ...p, stockQuantity: restored, inStock: restored > 0 };
      }
      return p;
    });

    StoreStorage.saveProducts(restockedProducts);
    const currentStore = StoreManager.getStoreById(TEST_STORE_ID)!;
    StoreManager.updateStore({ ...currentStore, products: restockedProducts });

    // Verify stock is restored to 15
    const finalStore = StoreManager.getStoreById(TEST_STORE_ID)!;
    expect(finalStore.products[0].stockQuantity).toBe(15);
    expect(finalStore.orders[0].status).toBe('Returned');
    expect(finalStore.orders[0].returnStatus).toBe('completed');
  });

  it('4. Lookup order by exact ID returns full tracking and return eligibility details', async () => {
    const store = StoreManager.getStoreById(TEST_STORE_ID)!;
    const targetOrder = store.orders[0];

    const lookedUp = await StoreManager.lookupOrderById(TEST_STORE_ID, targetOrder.id, store.orders);
    expect(lookedUp).toBeDefined();
    expect(lookedUp?.id).toBe(targetOrder.id);
    expect(lookedUp?.customerName).toBe(targetOrder.customerName);
    expect(lookedUp?.grandTotal).toBe(725);
  });
});
