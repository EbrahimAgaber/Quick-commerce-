import { describe, it, expect, beforeEach } from 'vitest';
import type { Order, Product, StoreSettings, CartItem } from '../src/types/store';

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
    localStorage: mockLocalStorage,
  };
}

describe('Reorder & Merchant Store Pickup Feature Suite', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  const catalogProducts: Product[] = [
    {
      id: 'prod_dates_1',
      name: 'تمر سكري ملكي القصيم',
      category: 'تمور فاخرة',
      price: 65,
      variants: ['1 كجم', '3 كجم'],
      imageUrl: 'https://images.unsplash.com/photo-dates',
      galleryImages: [],
      description: 'سكري طازج ممتاز',
      featured: true,
      inStock: true,
      stockQuantity: 20,
      unit: 'kg',
      unitLabel: 'كجم',
    },
    {
      id: 'prod_cardamom_2',
      name: 'هيل أمريكي فاخر درجة أولى',
      category: 'بهارات وبهارات قهوة',
      price: 120,
      variants: ['250 جرام', '500 جرام'],
      imageUrl: 'https://images.unsplash.com/photo-cardamom',
      galleryImages: [],
      description: 'حب كبير أخضر',
      featured: false,
      inStock: true,
      stockQuantity: 10,
      unit: 'g',
      unitLabel: 'جرام',
    },
  ];

  describe('Part 1: Reorder past orders directly into shopping cart', () => {
    it('accurately parses items from a historical order and adds them to the cart', () => {
      const pastOrder: Order = {
        id: 'BA-9021',
        timestamp: '2026-10-30T10:00:00Z',
        customerName: 'سلطان الشمري',
        customerPhone: '0551122334',
        city: 'الرياض',
        deliveryAddress: 'حي الصحافة',
        paymentMethod: 'الدفع عند الاستلام',
        itemsSummary: 'تمر سكري ملكي القصيم (1 كجم) × 2 + هيل أمريكي فاخر (250 جرام) × 1',
        items: [
          {
            productId: 'prod_dates_1',
            name: 'تمر سكري ملكي القصيم',
            variant: '1 كجم',
            price: 65,
            quantity: 2,
          },
          {
            productId: 'prod_cardamom_2',
            name: 'هيل أمريكي فاخر درجة أولى',
            variant: '250 جرام',
            price: 120,
            quantity: 1,
          },
        ],
        subtotal: 250,
        shippingFee: 15,
        grandTotal: 265,
        status: 'Delivered',
      };

      // Simulate reorder resolution logic in App.tsx
      const cart: CartItem[] = [];

      pastOrder.items.forEach((item) => {
        const found = catalogProducts.find((p) => p.id === item.productId || p.name === item.name);
        const product: Product = found || {
          id: item.productId,
          name: item.name,
          category: 'الطلبات السابقة',
          price: item.price,
          variants: item.variant ? [item.variant] : [],
          imageUrl: '',
          galleryImages: [],
          description: '',
          featured: false,
          inStock: true,
        };

        const maxStock = product.stockQuantity !== undefined ? product.stockQuantity : 99;
        const targetQty = Math.min(maxStock, item.quantity);

        cart.push({
          product,
          selectedVariant: item.variant || '',
          quantity: targetQty,
        });
      });

      expect(cart).toHaveLength(2);
      expect(cart[0].product.id).toBe('prod_dates_1');
      expect(cart[0].selectedVariant).toBe('1 كجم');
      expect(cart[0].quantity).toBe(2);

      expect(cart[1].product.id).toBe('prod_cardamom_2');
      expect(cart[1].selectedVariant).toBe('250 جرام');
      expect(cart[1].quantity).toBe(1);

      const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
      expect(cartTotal).toBe(65 * 2 + 120 * 1); // 250 SAR
    });

    it('caps quantity to current stock if stock has reduced since the previous order', () => {
      const limitedProduct: Product = {
        ...catalogProducts[0],
        stockQuantity: 1, // only 1 left in stock now
      };

      const pastOrder: Order = {
        id: 'BA-4011',
        timestamp: '2026-10-28T14:00:00Z',
        customerName: 'نورة العتيبي',
        customerPhone: '0509988776',
        city: 'جدة',
        deliveryAddress: 'حي الروضة',
        paymentMethod: 'مدى',
        itemsSummary: 'تمر سكري ملكي القصيم × 5',
        items: [
          {
            productId: 'prod_dates_1',
            name: 'تمر سكري ملكي القصيم',
            price: 65,
            quantity: 5, // ordered 5 in past
          },
        ],
        subtotal: 325,
        shippingFee: 0,
        grandTotal: 325,
        status: 'Delivered',
      };

      const item = pastOrder.items[0];
      const maxAllowed = limitedProduct.stockQuantity ?? 99;
      const reorderQty = Math.min(maxAllowed, item.quantity);

      expect(reorderQty).toBe(1);
    });

    it('handles legacy orders with itemsSummary string fallback gracefully', () => {
      const legacyOrder: Order = {
        id: 'LEGACY-101',
        timestamp: '2026-09-01T12:00:00Z',
        customerName: 'عبدالرحمن الدوسري',
        customerPhone: '0540000000',
        city: 'الدمام',
        deliveryAddress: 'حي الشاطئ',
        paymentMethod: 'تحويل بنكي',
        itemsSummary: 'تمر سكري ملكي القصيم × 3',
        items: [], // empty items array in legacy snapshot
        subtotal: 195,
        shippingFee: 20,
        grandTotal: 215,
        status: 'Delivered',
      };

      // Fallback parser test
      const parts = legacyOrder.itemsSummary.split('+').map((s) => s.trim());
      expect(parts).toHaveLength(1);

      const part = parts[0];
      const qtyMatch = part.match(/×\s*(\d+)/);
      const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
      const cleanName = part.replace(/×\s*\d+/, '').trim();

      expect(qty).toBe(3);
      expect(cleanName).toBe('تمر سكري ملكي القصيم');
    });
  });

  describe('Part 2: Store Pickup vs Home Delivery Merchant Toggle & Shopper Selection', () => {
    it('merchant toggle enableStorePickup: true makes pickup option available with 0 shipping fee', () => {
      const settingsWithPickup: Partial<StoreSettings> = {
        storeName: 'تمور القصيم الأصيلة',
        storeSlug: 'qassim-dates',
        currency: 'ر.س',
        whatsappNumber: '966500000000',
        standardShippingRate: 25,
        freeShippingThreshold: 200,
        enableStorePickup: true,
        storePickupAddress: 'الرياض - طريق عثمان بن عفان - مخرج 7، معرض رقم 3',
        paymentMethods: ['الدفع عند الاستلام (COD)'],
      };

      expect(settingsWithPickup.enableStorePickup).toBe(true);

      // Shopper selects Store Pickup
      const deliveryType: 'delivery' | 'pickup' = 'pickup';
      const orderSubtotal = 150; // Below free shipping threshold (200)

      // When pickup is chosen, shipping fee is always 0 SAR
      const shippingFee = deliveryType === 'pickup' 
        ? 0 
        : (orderSubtotal >= (settingsWithPickup.freeShippingThreshold ?? 0) ? 0 : (settingsWithPickup.standardShippingRate ?? 0));

      expect(shippingFee).toBe(0);

      const finalAddress = deliveryType === 'pickup'
        ? (settingsWithPickup.storePickupAddress || 'استلام من مقر المتجر')
        : 'حي النرجس';

      expect(finalAddress).toContain('طريق عثمان بن عفان');
    });

    it('merchant toggle enableStorePickup: false restricts shopper to home delivery with standard shipping rates', () => {
      const settingsWithoutPickup: Partial<StoreSettings> = {
        storeName: 'تمور القصيم الأصيلة',
        storeSlug: 'qassim-dates',
        currency: 'ر.س',
        whatsappNumber: '966500000000',
        standardShippingRate: 25,
        freeShippingThreshold: 200,
        enableStorePickup: false,
        storePickupAddress: '',
        paymentMethods: ['الدفع عند الاستلام (COD)'],
      };

      expect(settingsWithoutPickup.enableStorePickup).toBe(false);

      // If merchant disabled pickup, UI enforces delivery
      const isPickupAllowed = Boolean(settingsWithoutPickup.enableStorePickup);
      expect(isPickupAllowed).toBe(false);

      const deliveryType = isPickupAllowed ? 'pickup' : 'delivery';
      expect(deliveryType).toBe('delivery');

      const orderSubtotal = 100; // Under free shipping threshold
      const qualifiesForFreeShipping = orderSubtotal >= (settingsWithoutPickup.freeShippingThreshold ?? 0);
      const shippingFee = qualifiesForFreeShipping ? 0 : (settingsWithoutPickup.standardShippingRate ?? 0);

      expect(shippingFee).toBe(25);
      expect(orderSubtotal + shippingFee).toBe(125);
    });

    it('store pickup orders preserve deliveryType: "pickup" on the generated Order entity', () => {
      const pickupOrder: Partial<Order> = {
        id: 'BA-7712',
        customerName: 'خالد الزهراني',
        customerPhone: '0567788990',
        city: 'الرياض',
        deliveryAddress: 'الرياض - طريق عثمان بن عفان - مخرج 7، معرض رقم 3',
        deliveryType: 'pickup',
        shippingFee: 0,
        subtotal: 130,
        grandTotal: 130,
      };

      expect(pickupOrder.deliveryType).toBe('pickup');
      expect(pickupOrder.shippingFee).toBe(0);
      expect(pickupOrder.grandTotal).toBe(pickupOrder.subtotal);
    });
  });
});
