import { StoreInstance, StoreSettings, Product, Order, StorePolicy } from '../types/store';
import { 
  DEFAULT_SETTINGS, 
  DEFAULT_PRODUCTS, 
  DEFAULT_ORDERS, 
  DEFAULT_POLICIES 
} from './storeStorage';
import { db, auth } from './firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  collection, 
  query, 
  where, 
  getDocs 
} from 'firebase/firestore';

const STORES_STORAGE_KEY = 'storelink_all_stores';
const ACTIVE_STORE_KEY = 'storelink_active_store_id';

const INITIAL_AURORA_STORE: StoreInstance = {
  id: 'store_aurora_01',
  slug: 'aurora',
  ownerId: 'system_default',
  createdAt: '2026-10-16T12:00:00Z',
  settings: DEFAULT_SETTINGS,
  products: DEFAULT_PRODUCTS,
  orders: DEFAULT_ORDERS,
  policies: DEFAULT_POLICIES,
  googleSheetConfig: {
    sheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
    sheetUrl: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit',
    status: 'connected',
    lastSyncedAt: new Date().toISOString(),
  },
};

export class StoreManager {
  static getAllStores(): StoreInstance[] {
    try {
      const stored = localStorage.getItem(STORES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const isStale = parsed.some((s: StoreInstance) =>
            s.settings?.tagline?.includes('Chemical') ||
            s.settings?.storeSubtitle?.includes('Ebrahim') ||
            s.settings?.heroTitle?.includes('Ebrahim') ||
            s.products?.some(p => p.name?.includes('Process Design') || p.name?.includes('Aspen') || p.name?.includes('باقة الحلول التقنية'))
          );
          if (!isStale) {
            return parsed;
          }
        }
      }
    } catch (e) {
      console.warn('Error reading stores list from localStorage', e);
    }

    // Initialize with clean Aurora modern retail store
    const initialList = [INITIAL_AURORA_STORE];
    this.saveAllStores(initialList);
    return initialList;
  }

  static saveAllStores(stores: StoreInstance[]): void {
    localStorage.setItem(STORES_STORAGE_KEY, JSON.stringify(stores));
    window.dispatchEvent(new Event('storelink_stores_changed'));
  }

  static getActiveStore(): StoreInstance {
    const all = this.getAllStores();
    const activeId = localStorage.getItem(ACTIVE_STORE_KEY);
    if (activeId) {
      const found = all.find((s) => s.id === activeId);
      if (found) return found;
    }
    const fallback = all[0] || INITIAL_AURORA_STORE;
    this.setActiveStoreId(fallback.id);
    return fallback;
  }

  static setActiveStoreId(storeId: string): void {
    localStorage.setItem(ACTIVE_STORE_KEY, storeId);
    window.dispatchEvent(new Event('storelink_stores_changed'));
  }

  static getStoreById(storeId: string): StoreInstance | null {
    const all = this.getAllStores();
    return all.find((s) => s.id === storeId) || null;
  }

  static getStoreBySlug(slug: string): StoreInstance | null {
    const cleanSlug = slug.toLowerCase().trim();
    const all = this.getAllStores();
    return all.find((s) => s.slug.toLowerCase().trim() === cleanSlug) || null;
  }

  /**
   * Fetch a store from Cloud Firestore by ID or slug.
   * If found, caches it locally and returns the StoreInstance.
   */
  static async fetchStoreFromFirestore(idOrSlug: string): Promise<StoreInstance | null> {
    const cleanQuery = idOrSlug.trim();
    if (!cleanQuery) return null;

    try {
      // 1. Try direct ID lookup
      const docRef = doc(db, 'stores', cleanQuery);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const storeData = snapshot.data() as StoreInstance;
        this.cacheStoreLocally(storeData);
        return storeData;
      }

      // 2. Try slug query
      const storesCol = collection(db, 'stores');
      const q = query(storesCol, where('slug', '==', cleanQuery.toLowerCase()));
      const querySnap = await getDocs(q);
      if (!querySnap.empty) {
        const storeData = querySnap.docs[0].data() as StoreInstance;
        this.cacheStoreLocally(storeData);
        return storeData;
      }
    } catch (err) {
      console.warn('Firestore fetchStore error:', err);
    }
    return null;
  }

  /**
   * Sync a store to Cloud Firestore
   */
  static async syncStoreToFirestore(store: StoreInstance): Promise<boolean> {
    try {
      const docRef = doc(db, 'stores', store.id);
      const payload: StoreInstance & { updatedAt: string } = {
        ...store,
        updatedAt: new Date().toISOString()
      };
      await setDoc(docRef, payload, { merge: true });
      return true;
    } catch (err) {
      console.warn('Could not sync store to Firestore:', err);
      return false;
    }
  }

  /**
   * Fetch all stores belonging to a merchant from Firestore
   */
  static async fetchUserStoresFromFirestore(ownerId: string): Promise<StoreInstance[]> {
    if (!ownerId) return [];
    try {
      const storesCol = collection(db, 'stores');
      const q = query(storesCol, where('ownerId', '==', ownerId));
      const querySnap = await getDocs(q);
      const userStores: StoreInstance[] = [];
      querySnap.forEach((d) => {
        userStores.push(d.data() as StoreInstance);
      });

      if (userStores.length > 0) {
        const existing = this.getAllStores();
        const mergedMap = new Map<string, StoreInstance>();
        existing.forEach(s => mergedMap.set(s.id, s));
        userStores.forEach(s => mergedMap.set(s.id, s));
        const mergedList = Array.from(mergedMap.values());
        this.saveAllStores(mergedList);
      }
      return userStores;
    } catch (err) {
      console.warn('Could not fetch user stores from Firestore:', err);
      return [];
    }
  }

  private static cacheStoreLocally(store: StoreInstance): void {
    const all = this.getAllStores();
    const idx = all.findIndex(s => s.id === store.id || s.slug === store.slug);
    let updated: StoreInstance[];
    if (idx >= 0) {
      updated = [...all];
      updated[idx] = store;
    } else {
      updated = [store, ...all];
    }
    this.saveAllStores(updated);
  }

  static createStore(params: {
    storeName: string;
    storeSubtitle?: string;
    slug?: string;
    ownerId: string;
    tagline: string;
    whatsappNumber: string;
    currency: string;
    primaryColor: string;
    accentColor: string;
    backgroundColor: string;
    logoLetter: string;
    googleSheetUrl?: string;
    initialProducts?: Product[];
  }): StoreInstance {
    const all = this.getAllStores();
    const cleanSlug = (params.slug || params.storeName)
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-') || `store-${Date.now().toString().slice(-4)}`;

    const newStore: StoreInstance = {
      id: `store_${Date.now()}`,
      slug: cleanSlug,
      ownerId: params.ownerId || auth.currentUser?.uid || 'merchant_user',
      createdAt: new Date().toISOString(),
      settings: {
        ...DEFAULT_SETTINGS,
        storeName: params.storeName.trim(),
        storeSubtitle: params.storeSubtitle?.trim() || '',
        logoLetter: params.logoLetter || params.storeName.charAt(0) || 'A',
        tagline: params.tagline.trim(),
        whatsappNumber: params.whatsappNumber.replace(/\D/g, '') || '966500000000',
        supportPhone: `+${params.whatsappNumber.replace(/\D/g, '') || '966500000000'}`,
        currency: params.currency || 'ر.س',
        googleWebAppUrl: params.googleSheetUrl || '',
        brandTheme: {
          primaryColor: params.primaryColor || '#0F172A',
          accentColor: params.accentColor || '#2563EB',
          highlightColor: '#86EFAC',
          backgroundColor: params.backgroundColor || '#F8FAFC',
          neutralColor: '#E2E8F0',
          textColor: params.primaryColor || '#0F172A',
          secondaryAccentColor: '#F59E0B',
          fontFamily: 'Cairo',
          borderRadius: 14,
        },
        primaryColor: params.primaryColor || '#0F172A',
        secondaryColor: params.accentColor || '#2563EB',
      },
      products: params.initialProducts && params.initialProducts.length > 0 ? params.initialProducts : DEFAULT_PRODUCTS,
      orders: [],
      policies: DEFAULT_POLICIES,
      googleSheetConfig: {
        sheetUrl: params.googleSheetUrl || 'https://docs.google.com/spreadsheets/d/auto-generated/edit',
        webAppUrl: params.googleSheetUrl || '',
        status: 'connected',
        lastSyncedAt: new Date().toISOString(),
      },
    };

    const updated = [newStore, ...all];
    this.saveAllStores(updated);
    this.setActiveStoreId(newStore.id);

    // Sync to Firestore asynchronously
    if (auth.currentUser) {
      this.syncStoreToFirestore(newStore).catch(console.warn);
    }

    return newStore;
  }

  static updateStore(updatedStore: StoreInstance): void {
    const all = this.getAllStores();
    const index = all.findIndex((s) => s.id === updatedStore.id);
    if (index >= 0) {
      all[index] = updatedStore;
      this.saveAllStores(all);
    }
    // Sync to Firestore
    if (auth.currentUser && updatedStore.ownerId === auth.currentUser.uid) {
      this.syncStoreToFirestore(updatedStore).catch(console.warn);
    }
  }

  static deleteStore(storeId: string): void {
    const all = this.getAllStores();
    const targetStore = all.find(s => s.id === storeId);
    const filtered = all.filter((s) => s.id !== storeId);
    this.saveAllStores(filtered);
    if (filtered.length > 0) {
      this.setActiveStoreId(filtered[0].id);
    }

    // Delete from Firestore
    if (auth.currentUser && targetStore?.ownerId === auth.currentUser.uid) {
      deleteDoc(doc(db, 'stores', storeId)).catch(console.warn);
    }
  }

  static addOrderToStore(storeId: string, order: Order): void {
    const store = this.getStoreById(storeId);
    if (store) {
      store.orders = [order, ...store.orders];
      this.updateStore(store);
    }
  }

  static updateOrderStatusInStore(
    storeId: string,
    orderId: string,
    status: Order['status'],
    notes?: string
  ): void {
    const store = this.getStoreById(storeId);
    if (store) {
      store.orders = store.orders.map((o) =>
        o.id === orderId
          ? { ...o, status, trackingNotes: notes !== undefined ? notes : o.trackingNotes }
          : o
      );
      this.updateStore(store);
    }
  }
}
