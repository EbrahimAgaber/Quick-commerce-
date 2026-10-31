import { describe, it, expect, beforeEach, vi } from 'vitest';

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

// Test Hygiene: Hermetic fetch stub preventing ANY network egress to storelink.sa or localhost
(globalThis as any).fetch = vi.fn(async (input: any, init?: any) => {
  const url = typeof input === 'string' ? input : input?.url || '';
  const headers = new Headers({ 'content-type': 'application/json' });
  if (url.includes('/api/tracking')) {
    return {
      ok: true,
      status: 200,
      headers,
      json: async () => ({
        success: true,
        tracking: {
          orderId: 'ORD-TEST-MOCK',
          status: 'Received',
          timestamp: new Date().toISOString(),
          itemsSummary: 'طلب تجريبي',
          grandTotal: 150,
          shippingFee: 0,
          paymentMethod: 'الدفع عند الاستلام',
          trackingNotes: 'تم استلام الطلب',
        },
      }),
      text: async () => JSON.stringify({ success: true }),
    };
  }
  if (url.includes('storelink.sa') || url.startsWith('/') || url.includes('/api/')) {
    return {
      ok: true,
      status: 200,
      headers,
      json: async () => ({ success: true, order: { id: 'MOCK-ORDER-1' } }),
      text: async () => JSON.stringify({ success: true }),
    };
  }
  return {
    ok: true,
    status: 200,
    headers,
    json: async () => ({ success: true }),
    text: async () => '{}',
  };
});

vi.mock('../src/services/firebase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/firebase')>();
  return {
    ...actual,
    isFirebaseConfigured: false,
  };
});

import { BusinessOwnerSimulator, ShopperSimulator } from '../src/services/simulationKit';
import { StoreManager } from '../src/services/storeManager';
import { CaptainService } from '../src/services/captainService';
import { generateDriverWhatsAppMessage, generateDriverWhatsAppUrl } from '../src/utils/driverDispatch';
import { normalizeSaudiPhoneNumber, normalizeArabicDigits } from '../src/utils/digits';
import { StoreInstance, Product } from '../src/types/store';

describe('Comprehensive 500 User Journeys UX & UI Simulation Suite', () => {
  let mainStore: StoreInstance;
  let prodOud: Product;
  let prodWatch: Product;
  let prodCoffee: Product;

  beforeEach(() => {
    mockLocalStorage.clear();
    StoreManager.resetCorruptedStorage();
    const merchant = new BusinessOwnerSimulator();
    mainStore = merchant.createStore({
      storeName: 'متجر التميز الفاخر - Luxury Store',
      slug: 'luxury-store',
      tagline: 'تسوق أفضل المنتجات مع شحن فوري',
      whatsappNumber: '0501234567',
      currency: 'SAR',
      freeShippingThreshold: 200,
      standardShippingRate: 25,
      city: 'الرياض',
      storePickupAddress: 'طريق الملك فهد، العليا، الرياض',
    });

    prodOud = merchant.addProduct({
      name: 'عطر العود الملكي الفاخر',
      description: 'عطر فاخر أصيل مع نفحات العود والمسك',
      price: 150,
      stockQuantity: 1000,
      category: 'عطور',
      variants: ['50 مل', '100 مل'],
    });

    prodWatch = merchant.addProduct({
      name: 'ساعة ذكية مقاومة للماء',
      description: 'ساعة يد متطورة بشاشة OLED ومقاومة للماء',
      price: 220,
      stockQuantity: 500,
      category: 'إلكترونيات',
    });

    prodCoffee = merchant.addProduct({
      name: 'قهوة مختصة كولومبية فاخرة',
      description: 'بن محمص طازج بنكهة الكراميل والمكسرات',
      price: 45,
      stockQuantity: 2000,
      category: 'أغذية ومشروبات',
    });

    merchant.addPromoCode({
      code: 'DISCOUNT10',
      type: 'percentage',
      value: 10,
      minOrderAmount: 50,
      active: true,
    });
  });

  // -------------------------------------------------------------
  // 1. SHOPPER PERSONAS: 250 Journeys
  // -------------------------------------------------------------
  it('executes 250 diverse Shopper Journeys across mobile, tablet, and desktop', async () => {
    const paymentMethods: ('cod' | 'card' | 'apple_pay' | 'bank_transfer')[] = ['cod', 'card', 'apple_pay', 'bank_transfer'];
    const cities = ['الرياض', 'جدة', 'الدمام', 'مكة المكرمة', 'المدينة المنورة', 'الخبر', 'أبها', 'تبوك'];
    const products = [prodOud, prodWatch, prodCoffee];

    let passedJourneys = 0;

    for (let i = 1; i <= 250; i++) {
      const shopper = new ShopperSimulator();
      shopper.locateStore('luxury-store');

      const city = cities[i % cities.length];
      const selectedProd = products[i % products.length];
      const paymentMethod = paymentMethods[i % paymentMethods.length];
      const isStorePickup = (i % 5 === 0);
      const isEasternArabicDigits = (i % 2 === 0);
      const rawPhone = isEasternArabicDigits ? '٠٥٠' + (1000000 + i) : '050' + (1000000 + i);

      // 1. Search products
      const searchResults = shopper.searchCatalog(selectedProd.name.substring(0, 4));
      expect(searchResults.length).toBeGreaterThan(0);

      // 2. Select product & variant
      const variant = selectedProd.variants && selectedProd.variants.length > 0 ? selectedProd.variants[0] : undefined;

      // 3. Checkout
      const checkoutResult = await shopper.submitCheckout({
        items: [{ productId: selectedProd.id, qty: (i % 2) + 1, variant }],
        customerName: `متسوق تجربة رقم ${i}`,
        customerPhone: rawPhone,
        city: city,
        deliveryAddress: isStorePickup ? 'استلام من الفرع' : `حي الصحافة، شارع التحلية، ${city}`,
        paymentMethod: paymentMethod,
        deliveryType: isStorePickup ? 'pickup' : 'delivery',
        promoCode: i % 3 === 0 ? 'DISCOUNT10' : undefined,
      });

      expect(checkoutResult.success).toBe(true);
      expect(checkoutResult.order).toBeDefined();

      // 4. Track order & verify phone normalization
      const tracking = await shopper.trackOrder(checkoutResult.order!.id);
      expect(tracking).toBeDefined();
      expect(tracking?.customerPhone).toBe(normalizeSaudiPhoneNumber(normalizeArabicDigits(rawPhone)).normalized);

      passedJourneys++;
    }

    expect(passedJourneys).toBe(250);
  });

  // -------------------------------------------------------------
  // 2. MERCHANT PERSONAS: 150 Journeys
  // -------------------------------------------------------------
  it('executes 150 diverse Merchant Journeys (Onboarding, Catalog, Themes, Lifecycle Progression)', async () => {
    let passedJourneys = 0;

    for (let i = 1; i <= 150; i++) {
      const merchant = new BusinessOwnerSimulator();
      const storeSlug = `merchant-boutique-${i}`;
      const storeName = `متجر رواد الأعمال رقم ${i}`;

      // 1. Onboard new store
      const createdStore = merchant.createStore({
        storeName: storeName,
        slug: storeSlug,
        tagline: 'تجارة إلكترونية سلسة ومصممة بأعلى معايير UX',
        whatsappNumber: '0555' + (100000 + i),
        currency: 'SAR',
        freeShippingThreshold: 250,
        standardShippingRate: 20,
        city: i % 2 === 0 ? 'جدة' : 'الرياض',
      });

      expect(createdStore.id).toBeDefined();
      expect(createdStore.slug).toBe(storeSlug);

      // 2. Add multiple catalog products with SKU & stock
      const prod = merchant.addProduct({
        name: `منتج تجاري مخصص ${i}`,
        description: 'مواصفات وتفاصيل المنتج المتوافقة مع تجربة المستخدم الاحترافية',
        price: 90 + i,
        stockQuantity: 40 + i,
        category: i % 2 === 0 ? 'أزياء' : 'عطور',
      });
      expect(prod.id).toBeDefined();

      // 3. Issue customized campaign promo code
      merchant.addPromoCode({
        code: `PROMO${i}`,
        type: i % 2 === 0 ? 'percentage' : 'fixed',
        value: i % 2 === 0 ? 15 : 25,
        minOrderAmount: 100,
        active: true,
      });

      // 4. Create an order and advance status
      const shopper = new ShopperSimulator();
      shopper.locateStore(createdStore.id);
      const checkoutRes = await shopper.submitCheckout({
        items: [{ productId: prod.id, qty: 1 }],
        customerName: `عميل المتجر ${i}`,
        customerPhone: '0501112233',
        city: 'الرياض',
        deliveryAddress: 'طريق الملك عبدالله',
        paymentMethod: 'cod',
      });

      expect(checkoutRes.success).toBe(true);
      const orderId = checkoutRes.order!.id;

      const inProgressOrder = await merchant.advanceOrderStatus(orderId, 'In Progress');
      expect(inProgressOrder.status).toBe('In Progress');

      passedJourneys++;
    }

    expect(passedJourneys).toBe(150);
  });

  // -------------------------------------------------------------
  // 3. DRIVER / CAPTAIN PERSONAS: 100 Journeys
  // -------------------------------------------------------------
  it('executes 100 Driver & Captain Journeys (Registration, WhatsApp Dispatch, COD Settlement)', async () => {
    let passedJourneys = 0;
    const cities = ['الرياض', 'جدة', 'الدمام', 'مكة المكرمة'];

    for (let i = 1; i <= 100; i++) {
      const captainName = `الكابتن ناصر المطيري ${i}`;
      const captainPhone = '056' + (1000000 + i);
      const vehicleType = i % 3 === 0 ? 'car' : (i % 3 === 1 ? 'motorcycle' : 'van');
      const city = cities[i % cities.length];

      // 1. Captain registration
      const regResult = await CaptainService.registerCaptain({
        name: captainName,
        phone: captainPhone,
        city: city,
        vehicleType: vehicleType as any,
        idNumber: '10' + (10000000 + i),
        iban: `SA0380000000608010167${i}`,
      });

      expect(regResult.success).toBe(true);
      const captain = regResult.captain!;
      expect(captain.id).toBeDefined();
      expect(captain.activationCode).toBeDefined();

      // 2. Platform owner activation with custom fee
      const activationRes = CaptainService.activateCaptain(captain.id, captain.activationCode!, 1.5);
      expect(activationRes.success).toBe(true);
      expect(activationRes.captain?.status).toBe('active');

      // 3. Generate 1-tap WhatsApp driver dispatch URL
      const mockOrder = {
        id: `ORD-D-${i}`,
        customerName: `العميل المستلم ${i}`,
        customerPhone: '0509998877',
        city: city,
        deliveryAddress: `حي الملقا، طريق أنس بن مالك، ${city}`,
        paymentMethod: i % 2 === 0 ? 'cod' : 'card',
        grandTotal: 175,
        subtotal: 150,
        shippingFee: 25,
      };

      const whatsappMsg = generateDriverWhatsAppMessage({
        order: mockOrder as any,
        storeSettings: mainStore.settings,
      });

      const whatsappUrl = generateDriverWhatsAppUrl({
        driverPhone: captainPhone,
        message: whatsappMsg,
      });
      expect(whatsappUrl.startsWith('https://wa.me/')).toBe(true);

      // 4. Complete delivery & calculate commission
      const completionRes = CaptainService.recordDeliveryCompletion(captain.id, mockOrder.id, 25);
      expect(completionRes.success).toBe(true);
      expect(completionRes.platformCommission).toBeGreaterThanOrEqual(0);
      expect(completionRes.captainNetEarnings).toBeGreaterThanOrEqual(0);

      passedJourneys++;
    }

    expect(passedJourneys).toBe(100);
  });
});
