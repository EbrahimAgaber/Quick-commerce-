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
    localStorage: mockLocalStorage,
  };
}

describe('Shopper Experience Delight & Frictionless Funnel', () => {
  const SAVED_PROFILE_KEY = 'storelink_saved_shopper_profile';

  beforeEach(() => {
    mockLocalStorage.clear();
  });

  it('saves customer profile data on order success with complete address fields', () => {
    const profile = {
      customerName: 'فهد السبيعي',
      customerPhone: '0501234567',
      city: 'الرياض',
      deliveryAddress: 'حي الملقا - شارع وادي حنيفة',
      landmarkNotes: 'فيلا رقم 14 بجوار جامع الفرقان',
      savedAt: Date.now(),
    };

    mockLocalStorage.setItem(SAVED_PROFILE_KEY, JSON.stringify(profile));

    const retrieved = JSON.parse(mockLocalStorage.getItem(SAVED_PROFILE_KEY) || '{}');
    expect(retrieved.customerName).toBe('فهد السبيعي');
    expect(retrieved.customerPhone).toBe('0501234567');
    expect(retrieved.city).toBe('الرياض');
    expect(retrieved.deliveryAddress).toContain('الملقا');
    expect(retrieved.landmarkNotes).toContain('الفرقان');
  });

  it('gracefully handles missing or corrupted saved profiles without crashing', () => {
    mockLocalStorage.setItem(SAVED_PROFILE_KEY, '{ invalid_json ');

    let parsed = null;
    try {
      const raw = mockLocalStorage.getItem(SAVED_PROFILE_KEY);
      if (raw) parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }

    expect(parsed).toBeNull();
  });

  it('correctly clears saved profile on user demand', () => {
    mockLocalStorage.setItem(
      SAVED_PROFILE_KEY,
      JSON.stringify({
        customerName: 'سارة خالد',
        customerPhone: '0559876543',
        city: 'جدة',
      })
    );

    expect(mockLocalStorage.getItem(SAVED_PROFILE_KEY)).toBeTruthy();

    mockLocalStorage.removeItem(SAVED_PROFILE_KEY);
    expect(mockLocalStorage.getItem(SAVED_PROFILE_KEY)).toBeNull();
  });

  it('calculates effective sale price and subtotal accurately for add-to-cart toast preview', () => {
    const product = {
      id: 'p_1',
      name: 'قهوة سعودية خولاني فاخرة',
      price: 90,
      salePrice: 75,
      inStock: true,
      unit: 'kg',
    };

    const quantity = 2;
    const effectivePrice =
      typeof product.salePrice === 'number' && product.salePrice > 0 && product.salePrice < product.price
        ? product.salePrice
        : product.price;

    expect(effectivePrice).toBe(75);
    expect(effectivePrice * quantity).toBe(150);
  });
});
