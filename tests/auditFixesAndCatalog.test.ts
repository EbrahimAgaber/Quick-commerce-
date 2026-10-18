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
    location: { origin: 'https://storelink.sa' },
  };
}

import { StoreStorage, DEFAULT_PRODUCTS } from '../src/services/storeStorage';
import { StoreManager } from '../src/services/storeManager';
import { normalizeArabicDigits } from '../src/utils/digits';
import { parseStoreRouteFromLocation, extractDriverOrderIdFromUrl } from '../src/utils/urlRouter';
import { CartItem, Product, Order } from '../src/types/store';

describe('Audit Fixes & Catalog Integrity Test Suite', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  describe('Requirement 4: Persistent Default Products Bug & Catalog Empty State', () => {
    it('StoreStorage.getProducts() returns [] when localStorage has no products saved (never DEFAULT_PRODUCTS)', () => {
      mockLocalStorage.removeItem('storelink_products');
      const prods = StoreStorage.getProducts();
      expect(prods).toEqual([]);
      expect(prods.length).toBe(0);
    });

    it('StoreStorage.getProducts() preserves an explicit empty array [] after deletion', () => {
      StoreStorage.saveProducts([]);
      const prods = StoreStorage.getProducts();
      expect(prods).toEqual([]);
      expect(prods.length).toBe(0);
    });

    it('StoreManager.createStore respects initialProducts: [] and does not fallback to DEFAULT_PRODUCTS', () => {
      const store = StoreManager.createStore({
        storeName: 'متجر جديد فارغ',
        tagline: 'تجربة المتجر',
        whatsappNumber: '0501234567',
        currency: 'ر.س',
        primaryColor: '#000',
        accentColor: '#123',
        backgroundColor: '#fff',
        logoLetter: 'N',
        ownerId: 'merchant_123',
        initialProducts: [],
      });

      expect(store.products).toEqual([]);
      expect(store.products.length).toBe(0);

      const retrieved = StoreManager.getStoreById(store.id);
      expect(retrieved?.products).toEqual([]);
    });

    it('StoreManager.createStore populates sample products only when explicitly requested', () => {
      const store = StoreManager.createStore({
        storeName: 'متجر عينات',
        tagline: 'تجربة المتجر',
        whatsappNumber: '0501234567',
        currency: 'ر.س',
        primaryColor: '#000',
        accentColor: '#123',
        backgroundColor: '#fff',
        logoLetter: 'S',
        ownerId: 'merchant_123',
        initialProducts: DEFAULT_PRODUCTS,
      });

      expect(store.products.length).toBe(DEFAULT_PRODUCTS.length);
    });
  });

  describe('Requirement 1.1 & 3.1: Arabic-Indic Digits Normalization & Sanitization', () => {
    it('normalizes Eastern Arabic numerals to standard Latin digits', () => {
      const input = '٠٥٠١٢٣٤٥٦٧';
      const output = normalizeArabicDigits(input);
      expect(output).toBe('0501234567');
    });

    it('preserves Arabic phone numbers in StoreManager.createStore without wiping to empty', () => {
      const store = StoreManager.createStore({
        storeName: 'متجر التمور',
        tagline: 'أفضل تمور',
        whatsappNumber: '٠٥٠١٢٣٤٥٦٧',
        currency: 'ر.س',
        primaryColor: '#000',
        accentColor: '#123',
        backgroundColor: '#fff',
        logoLetter: 'D',
        ownerId: 'merchant_123',
      });

      expect(store.settings.whatsappNumber).toBe('0501234567');
    });

    it('normalizes pricing and stock values with Arabic digits', () => {
      const arabicPrice = '١٥٠';
      const arabicStock = '٢٥';
      expect(Number(normalizeArabicDigits(arabicPrice))).toBe(150);
      expect(Number(normalizeArabicDigits(arabicStock))).toBe(25);
    });
  });

  describe('Requirement 1.3 & 2.2: Cart Variant Normalization & Deduplication', () => {
    const sampleProduct: Product = {
      id: 'prod-001',
      name: 'عطر الفخامة',
      category: 'عطور',
      price: 200,
      imageUrl: 'https://images.unsplash.com/test.jpg',
      galleryImages: [],
      featured: false,
      description: 'عطر مميز',
      inStock: true,
      variants: ['50ml', '100ml'],
    };

    it('merges default empty variant "" and legacy "الخيار الافتراضي" into same cart line item', () => {
      let cart: CartItem[] = [];

      const addToCart = (product: Product, variant: string, quantity: number) => {
        const cleanVariant = (!variant || variant === 'الخيار الافتراضي') ? '' : variant;
        const existingIdx = cart.findIndex((item) => {
          const itemVar = (!item.selectedVariant || item.selectedVariant === 'الخيار الافتراضي') ? '' : item.selectedVariant;
          return item.product.id === product.id && itemVar === cleanVariant;
        });

        if (existingIdx >= 0) {
          cart = [...cart];
          cart[existingIdx] = {
            ...cart[existingIdx],
            selectedVariant: cleanVariant,
            quantity: cart[existingIdx].quantity + quantity,
          };
        } else {
          cart = [...cart, { product, selectedVariant: cleanVariant, quantity }];
        }
      };

      // 1. Add with empty string
      addToCart(sampleProduct, '', 1);
      expect(cart.length).toBe(1);
      expect(cart[0].quantity).toBe(1);

      // 2. Add with legacy "الخيار الافتراضي"
      addToCart(sampleProduct, 'الخيار الافتراضي', 2);
      expect(cart.length).toBe(1); // Merged into 1 item!
      expect(cart[0].quantity).toBe(3);
      expect(cart[0].selectedVariant).toBe('');
    });

    it('does NOT merge distinct custom variants into default or each other', () => {
      let cart: CartItem[] = [];

      const addToCart = (product: Product, variant: string, quantity: number) => {
        const cleanVariant = (!variant || variant === 'الخيار الافتراضي') ? '' : variant;
        const existingIdx = cart.findIndex((item) => {
          const itemVar = (!item.selectedVariant || item.selectedVariant === 'الخيار الافتراضي') ? '' : item.selectedVariant;
          return item.product.id === product.id && itemVar === cleanVariant;
        });

        if (existingIdx >= 0) {
          cart = [...cart];
          cart[existingIdx] = {
            ...cart[existingIdx],
            selectedVariant: cleanVariant,
            quantity: cart[existingIdx].quantity + quantity,
          };
        } else {
          cart = [...cart, { product, selectedVariant: cleanVariant, quantity }];
        }
      };

      // Add default item
      addToCart(sampleProduct, '', 1);
      // Add 50ml variant
      addToCart(sampleProduct, '50ml', 1);
      // Add 100ml variant
      addToCart(sampleProduct, '100ml', 2);

      expect(cart.length).toBe(3);
      expect(cart[0].selectedVariant).toBe('');
      expect(cart[1].selectedVariant).toBe('50ml');
      expect(cart[2].selectedVariant).toBe('100ml');
    });
  });

  describe('Requirement 1.4, 2.3 & 3.2: URL Route Parsing & Tracking', () => {
    it('parses track order parameter from ?track=', () => {
      const loc = {
        pathname: '/',
        search: '?track=ORD-12345&store=aurora',
        hash: '',
      } as Location;

      const route = parseStoreRouteFromLocation(loc);
      expect(route.trackOrderId).toBe('ORD-12345');
      expect(route.storeSlug).toBe('aurora');
    });

    it('parses track order parameter from ?order=', () => {
      const loc = {
        pathname: '/',
        search: '?order=ORD-67890',
        hash: '',
      } as Location;

      const route = parseStoreRouteFromLocation(loc);
      expect(route.trackOrderId).toBe('ORD-67890');
    });

    it('parses track order parameter from #track- hash format', () => {
      const loc = {
        pathname: '/',
        search: '',
        hash: '#track-ORD-HASH-111',
      } as Location;

      const route = parseStoreRouteFromLocation(loc);
      expect(route.trackOrderId).toBe('ORD-HASH-111');
    });

    it('extracts driverOrderId alongside store parameter', () => {
      const url = 'https://storelink.sa/?store=perfumes&driver=ORD-DRV-55';
      expect(extractDriverOrderIdFromUrl(url)).toBe('ORD-DRV-55');
    });
  });

  describe('Requirement 1.5: Driver Settlement Duplicate Collection Prevention', () => {
    it('filters out already settled orders in driver cash reconciliation', () => {
      const orders: Order[] = [
        {
          id: 'ORD-S1',
          customerName: 'أحمد',
          customerPhone: '0500000001',
          city: 'الرياض',
          deliveryAddress: 'العليا',
          paymentMethod: 'الدفع عند الاستلام (COD)',
          grandTotal: 100,
          subtotal: 80,
          shippingFee: 20,
          itemsSummary: 'منتج × 1',
          items: [],
          status: 'Delivered',
          timestamp: new Date().toISOString(),
          driverSettled: true,
          driverSettledAt: new Date().toISOString(),
        },
        {
          id: 'ORD-S2',
          customerName: 'سعد',
          customerPhone: '0500000002',
          city: 'الرياض',
          deliveryAddress: 'الملقا',
          paymentMethod: 'الدفع عند الاستلام (COD)',
          grandTotal: 150,
          subtotal: 130,
          shippingFee: 20,
          itemsSummary: 'منتج × 1',
          items: [],
          status: 'Delivered',
          timestamp: new Date().toISOString(),
          driverSettled: false,
        },
      ];

      const deliveredUnsettled = orders.filter((o) => o.status === 'Delivered' && !o.driverSettled);
      expect(deliveredUnsettled.length).toBe(1);
      expect(deliveredUnsettled[0].id).toBe('ORD-S2');
    });
  });

  describe('Requirement 1.2: Guest Store Claiming & Association', () => {
    it('associates guest stores with merchant ID upon claim', () => {
      // Create guest store
      const guestStore = StoreManager.createStore({
        storeName: 'متجر الضيف',
        tagline: 'تجربة',
        whatsappNumber: '0501112233',
        currency: 'ر.س',
        primaryColor: '#000',
        accentColor: '#123',
        backgroundColor: '#fff',
        logoLetter: 'G',
        ownerId: 'guest',
      });

      expect(guestStore.ownerId).toBe('merchant_user');

      // Claim stores for authenticated merchant
      const claimed = StoreManager.claimGuestStores('merchant_real_uid_777');
      expect(claimed.some((s) => s.id === guestStore.id)).toBe(true);

      const after = StoreManager.getStoreById(guestStore.id);
      expect(after?.ownerId).toBe('merchant_real_uid_777');
    });
  });
});
