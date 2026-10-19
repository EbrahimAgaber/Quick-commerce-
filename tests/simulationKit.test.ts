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

import { 
  BusinessOwnerSimulator, 
  ShopperSimulator, 
  runFullSimulationKit 
} from '../src/services/simulationKit';
import { StoreManager } from '../src/services/storeManager';

describe('Simulation Kit - Business Owner & Shopper Persona Tests', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    StoreManager.resetCorruptedStorage();
  });

  describe('1. Full Lifecycle Simulation Runner', () => {
    it('executes the full 16-step end-to-end simulation successfully with 0 failures', async () => {
      const report = await runFullSimulationKit();

      if (!report.success) {
        console.error('Simulation Diagnostics:', report.diagnostics);
      }

      expect(report.success).toBe(true);
      expect(report.failedSteps).toBe(0);
      expect(report.passedSteps).toBe(report.totalSteps);
      expect(report.totalSteps).toBe(16);
      expect(report.storeId).toBeDefined();
      expect(report.orderId).toBeDefined();
    }, 20000);
  });

  describe('2. Business Owner Persona (Merchant Operations)', () => {
    it('creates a custom branded store with valid slug and settings', () => {
      const merchant = new BusinessOwnerSimulator();
      const store = merchant.createStore({
        storeName: 'بوتيك لؤلؤة الخليج',
        slug: 'pearl-boutique',
        tagline: 'أزياء راقية لكل مناسبة',
        whatsappNumber: '0501234567',
        freeShippingThreshold: 350,
        standardShippingRate: 35,
        city: 'جدة',
        storePickupAddress: 'جدة - حي الروضة - شارع الكيال',
      });

      expect(store.id).toBeDefined();
      expect(store.slug).toBe('pearl-boutique');
      expect(store.settings.storeName).toBe('بوتيك لؤلؤة الخليج');
      expect(store.settings.freeShippingThreshold).toBe(350);
      expect(store.settings.standardShippingRate).toBe(35);
      expect(store.settings.city).toBe('جدة');
      expect(store.settings.storePickupAddress).toBe('جدة - حي الروضة - شارع الكيال');
    });

    it('manages products, variants, and stock tracking', () => {
      const merchant = new BusinessOwnerSimulator();
      merchant.createStore({
        storeName: 'متجر العطور',
        whatsappNumber: '0501234567',
      });

      const prod = merchant.addProduct({
        name: 'عطر العود الكمبودي',
        category: 'عطور شرقية',
        price: 450,
        salePrice: 399,
        variants: ['50ml', '100ml'],
        stockQuantity: 15,
        inStock: true,
      });

      expect(prod.id).toBeDefined();
      expect(prod.price).toBe(450);
      expect(prod.salePrice).toBe(399);
      expect(prod.variants).toEqual(['50ml', '100ml']);
      expect(prod.stockQuantity).toBe(15);

      // Update stock
      const updated = merchant.updateProductStock(prod.id, 5);
      expect(updated.stockQuantity).toBe(5);
      expect(updated.inStock).toBe(true);

      // Set stock to 0
      const zeroStock = merchant.updateProductStock(prod.id, 0);
      expect(zeroStock.stockQuantity).toBe(0);
      expect(zeroStock.inStock).toBe(false);
    });

    it('advances order lifecycle and dispatches driver with 1-tap WhatsApp URL', async () => {
      const merchant = new BusinessOwnerSimulator();
      const store = merchant.createStore({
        storeName: 'سوبرماركت المدينة',
        whatsappNumber: '0501112233',
      });

      const prod = merchant.addProduct({
        name: 'سلة تمور فاخرة',
        category: 'تمور',
        price: 120,
        stockQuantity: 50,
      });

      // Submit an order
      const shopper = new ShopperSimulator();
      shopper.locateStore(store.id);
      const checkoutRes = await shopper.submitCheckout({
        items: [{ productId: prod.id, qty: 2 }],
        customerName: 'سعد الدوسري',
        customerPhone: '0567890123',
        city: 'الدمام',
        deliveryAddress: 'حي الشاطئ',
        paymentMethod: 'cod',
      });

      expect(checkoutRes.success).toBe(true);
      const orderId = checkoutRes.order!.id;

      // Advance to In Progress
      const inProgressOrder = await merchant.advanceOrderStatus(orderId, 'In Progress');
      expect(inProgressOrder.status).toBe('In Progress');

      // Dispatch Driver
      const dispatchRes = await merchant.dispatchDriver({
        orderId,
        driverName: 'الكابتن أحمد',
        driverPhone: '0559998877',
        driverFee: 20,
      });

      expect(dispatchRes.updatedOrder.status).toBe('Out for Delivery');
      expect(dispatchRes.updatedOrder.courierName).toBe('الكابتن أحمد');
      expect(dispatchRes.whatsappUrl).toContain('0559998877');
      expect(dispatchRes.message).toContain(orderId);

      // Driver Settlement
      const settled = await merchant.settleDriverCash(orderId, inProgressOrder.grandTotal);
      expect(settled.status).toBe('Delivered');
      expect(settled.driverSettled).toBe(true);
      expect(settled.driverCashCollected).toBe(inProgressOrder.grandTotal);
    });
  });

  describe('3. Shopper Persona (Customer Experience & Edge Cases)', () => {
    it('normalizes Eastern Arabic numerals in customer phone during checkout', async () => {
      const merchant = new BusinessOwnerSimulator();
      const store = merchant.createStore({
        storeName: 'متجر الجوالات',
        whatsappNumber: '0501112233',
      });

      const prod = merchant.addProduct({
        name: 'شاحن سريع 65W',
        category: 'إلكترونيات',
        price: 99,
        stockQuantity: 10,
      });

      const shopper = new ShopperSimulator();
      shopper.locateStore(store.id);

      const res = await shopper.submitCheckout({
        items: [{ productId: prod.id, qty: 1 }],
        customerName: 'فيصل الغامدي',
        customerPhone: '٠٥٠١١٢٢٣٣٤', // Eastern Arabic digits
        city: 'الرياض',
        deliveryAddress: 'حي العليا',
        paymentMethod: 'card',
      });

      expect(res.success).toBe(true);
      expect(res.order?.customerPhone).toBe('0501122334');
    });

    it('handles store pickup by setting shipping fee to 0 and pickup address', async () => {
      const merchant = new BusinessOwnerSimulator();
      const store = merchant.createStore({
        storeName: 'حلويات المملكة',
        whatsappNumber: '0501112233',
        standardShippingRate: 40,
        city: 'الرياض',
        storePickupAddress: 'الرياض - مخرج 5 - بجوار الغرفة التجارية',
      });

      const prod = merchant.addProduct({
        name: 'كيكة زعفران فاخرة',
        category: 'حلويات',
        price: 150,
        stockQuantity: 10,
      });

      const shopper = new ShopperSimulator();
      shopper.locateStore(store.id);

      const res = await shopper.submitCheckout({
        items: [{ productId: prod.id, qty: 1 }],
        customerName: 'ريما القحطاني',
        customerPhone: '0533344556',
        city: 'الرياض',
        deliveryAddress: 'استلام ذاتي',
        deliveryType: 'pickup',
        paymentMethod: 'bank_transfer',
      });

      expect(res.success).toBe(true);
      expect(res.order?.shippingFee).toBe(0);
      expect(res.order?.deliveryAddress).toContain('مخرج 5');
      expect(res.order?.grandTotal).toBe(150);
    });

    it('rejects checkout when item quantity exceeds inventory limits', async () => {
      const merchant = new BusinessOwnerSimulator();
      const store = merchant.createStore({
        storeName: 'ساعات فاخرة',
        whatsappNumber: '0501112233',
      });

      const prod = merchant.addProduct({
        name: 'ساعة رولكس كلاسيك (قطعة نادرة)',
        category: 'ساعات',
        price: 45000,
        stockQuantity: 1, // Only 1 in stock
      });

      const shopper = new ShopperSimulator();
      shopper.locateStore(store.id);

      const res = await shopper.submitCheckout({
        items: [{ productId: prod.id, qty: 2 }], // Requesting 2
        customerName: 'طارق الزهراني',
        customerPhone: '0544455667',
        city: 'جدة',
        deliveryAddress: 'حي الشاطئ',
        paymentMethod: 'bank_transfer',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('غير متوفرة');
    });

    it('rejects checkout when item is marked out of stock', async () => {
      const merchant = new BusinessOwnerSimulator();
      const store = merchant.createStore({
        storeName: 'مكتبة المعرفة',
        whatsappNumber: '0501112233',
      });

      const prod = merchant.addProduct({
        name: 'كتاب نادر نفد',
        category: 'كتب',
        price: 75,
        inStock: false,
      });

      const shopper = new ShopperSimulator();
      shopper.locateStore(store.id);

      const res = await shopper.submitCheckout({
        items: [{ productId: prod.id, qty: 1 }],
        customerName: 'أنس الصالح',
        customerPhone: '0522233445',
        city: 'مكة المكرمة',
        deliveryAddress: 'حي العزيزية',
        paymentMethod: 'cod',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('نفد من المخزون');
    });

    it('validates order tracking lookup with various formats (e.g. #ORD-..., lowercase, spaces)', async () => {
      const merchant = new BusinessOwnerSimulator();
      const store = merchant.createStore({
        storeName: 'أثاث البيت الراقي',
        whatsappNumber: '0501112233',
      });

      const prod = merchant.addProduct({
        name: 'طاولة قهوة رخامية',
        category: 'أثاث',
        price: 550,
        stockQuantity: 5,
      });

      const shopper = new ShopperSimulator();
      shopper.locateStore(store.id);

      const res = await shopper.submitCheckout({
        items: [{ productId: prod.id, qty: 1 }],
        customerName: 'سلطان الشمري',
        customerPhone: '0566677889',
        city: 'حائل',
        deliveryAddress: 'حي الجامعيين',
        paymentMethod: 'cod',
      });

      expect(res.success).toBe(true);
      const rawId = res.order!.id;

      // Lookup with exact ID
      const find1 = await shopper.trackOrder(rawId);
      expect(find1?.id).toBe(rawId);

      // Lookup with # prefix
      const find2 = await shopper.trackOrder(`#${rawId}`);
      expect(find2?.id).toBe(rawId);

      // Lookup with lowercase and spaces
      const find3 = await shopper.trackOrder(`  #${rawId.toLowerCase()}  `);
      expect(find3?.id).toBe(rawId);
    });

    it('simulates Moyasar online payment (Card / Apple Pay) transition to Paid', async () => {
      const merchant = new BusinessOwnerSimulator();
      const store = merchant.createStore({
        storeName: 'إلكترونيات المستقبل',
        whatsappNumber: '0501112233',
      });
      store.settings.enableOnlinePayments = true;
      store.settings.moyasarPublishableKey = 'pk_test_sample_key_123';
      store.settings.moyasarTestMode = true;
      StoreManager.updateStore(store);

      const prod = merchant.addProduct({
        name: 'سماعات لاسلكية عازلة للضوضاء',
        category: 'إلكترونيات',
        price: 299,
        stockQuantity: 20,
      });

      const shopper = new ShopperSimulator();
      shopper.locateStore(store.id);

      // Shopper checks out with card
      const res = await shopper.submitCheckout({
        items: [{ productId: prod.id, qty: 1 }],
        customerName: 'عبدالعزيز الراشد',
        customerPhone: '0501234567',
        city: 'الرياض',
        deliveryAddress: 'حي النخيل',
        paymentMethod: 'card',
      });

      expect(res.success).toBe(true);
      expect(res.order).toBeDefined();
      const createdOrder = res.order!;

      // Simulate Moyasar 3DS / Webhook approval
      const paymentId = 'pay_test_mysr_9988';
      const paidOrder = {
        ...createdOrder,
        status: 'Paid' as const,
        paymentId,
        paidAt: new Date().toISOString(),
        trackingNotes: `تم استلام الدفع الإلكتروني بنجاح (معرف العملية: ${paymentId}).`,
      };

      await StoreManager.updateOrderInStore(store.id, paidOrder);

      // Verify the order in store is now Paid
      const verified = await shopper.trackOrder(createdOrder.id);
      expect(verified?.status).toBe('Paid');
      expect(verified?.paymentId).toBe('pay_test_mysr_9988');
      expect(verified?.paidAt).toBeDefined();
    });
  });
});
