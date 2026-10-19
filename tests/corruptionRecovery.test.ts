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

import { StoreManager, sanitizeStoreInstance, INITIAL_AURORA_STORE } from '../src/services/storeManager';
import { StoreStorage, DEFAULT_SETTINGS, DEFAULT_PRODUCTS, DEFAULT_ORDERS, DEFAULT_POLICIES } from '../src/services/storeStorage';
import { AuthService } from '../src/services/authService';

describe('Data Corruption Resilience & Self-Healing Test Suite', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  describe('1. StoreManager Corruption Resilience', () => {
    it('handles malformed JSON in localStorage gracefully without throwing', () => {
      mockLocalStorage.setItem('storelink_all_stores', '{broken json');
      const stores = StoreManager.getAllStores();
      expect(Array.isArray(stores)).toBe(true);
      expect(stores.length).toBeGreaterThan(0);
      expect(stores[0].id).toBe('store_aurora_01');
    });

    it('filters out null, numbers, and invalid non-store objects from store array', () => {
      mockLocalStorage.setItem('storelink_all_stores', JSON.stringify([null, 123, 'string', {}, { id: '' }]));
      const stores = StoreManager.getAllStores();
      expect(Array.isArray(stores)).toBe(true);
      expect(stores.length).toBe(1);
      expect(stores[0].id).toBe('store_aurora_01');
    });

    it('deeply sanitizes partial stores with missing settings or brandTheme', () => {
      const partialStore = {
        id: 'store_custom_99',
        slug: 'custom-shop',
        settings: {
          storeName: 'متجر مخصص',
          // brandTheme is completely missing
        },
        // products is missing
      };

      const sanitized = sanitizeStoreInstance(partialStore);
      expect(sanitized).not.toBeNull();
      expect(sanitized?.settings.storeName).toBe('متجر مخصص');
      expect(sanitized?.settings.brandTheme).toBeDefined();
      expect(sanitized?.settings.brandTheme?.primaryColor).toBe(DEFAULT_SETTINGS.brandTheme.primaryColor);
      expect(sanitized?.settings.brandTheme?.accentColor).toBe(DEFAULT_SETTINGS.brandTheme.accentColor);
      expect(Array.isArray(sanitized?.products)).toBe(true);
      expect(Array.isArray(sanitized?.orders)).toBe(true);
      expect(Array.isArray(sanitized?.policies)).toBe(true);
    });

    it('getActiveStore() returns a valid fallback when active ID points to non-existent store', () => {
      mockLocalStorage.setItem('storelink_active_store_id', 'non_existent_id_404');
      const active = StoreManager.getActiveStore();
      expect(active).toBeDefined();
      expect(active.id).toBe('store_aurora_01');
      expect(active.settings).toBeDefined();
      expect(active.settings.brandTheme).toBeDefined();
    });

    it('resetCorruptedStorage() clears all corrupt keys and restores clean initial state', () => {
      mockLocalStorage.setItem('storelink_all_stores', 'corrupted');
      mockLocalStorage.setItem('storelink_active_store_id', 'invalid');
      mockLocalStorage.setItem('storelink_cart_store_1', 'corrupted_cart');

      StoreManager.resetCorruptedStorage();

      const stores = StoreManager.getAllStores();
      expect(stores.length).toBe(1);
      expect(stores[0].id).toBe('store_aurora_01');
      expect(mockLocalStorage.getItem('storelink_active_store_id')).toBe('store_aurora_01');
      expect(mockLocalStorage.getItem('storelink_cart_store_1')).toBeNull();
    });
  });

  describe('2. StoreStorage Resilience', () => {
    it('getSettings() recovers robust defaults when stored settings has empty or invalid brandTheme', () => {
      mockLocalStorage.setItem('storelink_settings', JSON.stringify({ storeName: 'متجري', brandTheme: null }));
      const settings = StoreStorage.getSettings();
      expect(settings.storeName).toBe('متجري');
      expect(settings.brandTheme).toBeDefined();
      expect(settings.brandTheme.primaryColor).toBe(DEFAULT_SETTINGS.brandTheme.primaryColor);
    });

    it('getOrders() returns DEFAULT_ORDERS or empty array when corrupted data exists', () => {
      mockLocalStorage.setItem('storelink_orders', 'corrupted_json');
      const orders = StoreStorage.getOrders();
      expect(Array.isArray(orders)).toBe(true);
    });

    it('getOrders() filters out null/corrupted elements inside stored orders array', () => {
      mockLocalStorage.setItem('storelink_orders', JSON.stringify([null, { id: 'ORD-1' }, 'string', {}]));
      const orders = StoreStorage.getOrders();
      expect(orders.length).toBe(1);
      expect(orders[0].id).toBe('ORD-1');
    });

    it('getPolicies() filters out null elements and falls back to DEFAULT_POLICIES if empty', () => {
      mockLocalStorage.setItem('storelink_policies', JSON.stringify([null, 999]));
      const policies = StoreStorage.getPolicies();
      expect(policies.length).toBe(DEFAULT_POLICIES.length);
    });
  });

  describe('3. Cart & User Session Resilience', () => {
    it('filters out cart items where product is null or undefined', () => {
      const corruptCart = [
        null,
        { quantity: 2 }, // missing product
        { product: null, quantity: 1 },
        { product: { id: 'prod-1', name: 'قلم', price: 50 }, quantity: 3 },
      ];

      const validItems = corruptCart.filter((item: any) => item && item.product && typeof item.product === 'object' && item.product.id);
      expect(validItems.length).toBe(1);
      expect(validItems[0]?.product?.name).toBe('قلم');
      expect(validItems[0]?.quantity).toBe(3);
    });

    it('AuthService.getCurrentUser() recovers valid stored user session', () => {
      const sampleUser = {
        id: 'merchant_local_123',
        name: 'أحمد التاجر',
        email: 'ahmed@store.sa',
        createdAt: new Date().toISOString(),
      };
      mockLocalStorage.setItem('storelink_current_merchant', JSON.stringify(sampleUser));

      const current = AuthService.getCurrentUser();
      expect(current).not.toBeNull();
      expect(current?.id).toBe('merchant_local_123');
      expect(current?.name).toBe('أحمد التاجر');
    });

    it('AuthService.getCurrentUser() returns null gracefully when user data is corrupted', () => {
      mockLocalStorage.setItem('storelink_current_merchant', '{broken_json');
      const current = AuthService.getCurrentUser();
      expect(current).toBeNull();
    });
  });
});
