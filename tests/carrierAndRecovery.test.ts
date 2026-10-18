import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CarrierService, MockCarrierProvider } from '../src/services/carrierService';
import { 
  saveCartForRecovery, 
  getSavedCartForRecovery, 
  clearCartRecovery 
} from '../src/utils/cartRecovery';
import { CartItem, Product } from '../src/types/store';

describe('Carrier Service Abstraction', () => {
  it('creates mock shipment with tracking number and estimated delivery', async () => {
    const provider = CarrierService.getActiveProvider();
    expect(provider).toBeInstanceOf(MockCarrierProvider);

    const res = await provider.createShipment({
      orderId: 'ord_carrier_01',
      storeId: 'store_aurora_01',
      sender: {
        name: 'متجر أورورا',
        phone: '0500000000',
        city: 'الرياض',
        address: 'حي الملك فهد',
      },
      recipient: {
        name: 'عبدالله السعيد',
        phone: '0512345678',
        city: 'جدة',
        address: 'حي الروضة',
      },
      packages: {
        weightKg: 1.5,
        description: 'ملابس واكسسوارات',
        itemCount: 2,
      },
    });

    expect(res.success).toBe(true);
    expect(res.trackingNumber).toMatch(/^SA\d+/);
    expect(res.courierName).toContain('سمسا');
  });

  it('tracks shipment status', async () => {
    const provider = CarrierService.getActiveProvider();
    const info = await provider.trackShipment('SA12345678');

    expect(info.trackingNumber).toBe('SA12345678');
    expect(info.status).toBe('in_transit');
    expect(info.statusDescription).toBeDefined();
  });
});

describe('Abandoned Cart Recovery', () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (global as any).window = {};
    (global as any).localStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, val: string) => { store[key] = val; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    };
  });

  afterEach(() => {
    delete (global as any).window;
    delete (global as any).localStorage;
  });

  it('saves, retrieves, and clears abandoned carts in storage', () => {
    const storeId = 'store_test_cart';
    const mockProduct: Product = {
      id: 'p_1',
      name: 'فستان صيفي',
      category: 'أزياء',
      price: 180,
      variants: ['S', 'M'],
      imageUrl: '',
      galleryImages: [],
      description: '',
      featured: true,
      inStock: true,
    };
    const cartItems: CartItem[] = [
      { product: mockProduct, selectedVariant: 'M', quantity: 1 },
    ];

    saveCartForRecovery(storeId, cartItems, '0512345678');

    const retrieved = getSavedCartForRecovery(storeId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.storeId).toBe(storeId);
    expect(retrieved?.items.length).toBe(1);
    expect(retrieved?.customerPhone).toBe('0512345678');

    clearCartRecovery(storeId);
    expect(getSavedCartForRecovery(storeId)).toBeNull();
  });
});
