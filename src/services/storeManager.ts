import { StoreInstance, Product, Order } from '../types/store';
import { 
  DEFAULT_SETTINGS, 
  DEFAULT_PRODUCTS, 
  DEFAULT_ORDERS, 
  DEFAULT_POLICIES 
} from './storeStorage';
import { db, auth, isFirebaseConfigured } from './firebase';
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

export const INITIAL_AURORA_STORE: StoreInstance = {
  id: 'store_aurora_01',
  slug: 'aurora',
  ownerId: 'system_demo',
  createdAt: '2026-10-16T12:00:00Z',
  settings: DEFAULT_SETTINGS,
  products: DEFAULT_PRODUCTS,
  orders: DEFAULT_ORDERS,
  policies: DEFAULT_POLICIES,
  googleSheetConfig: {
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

    const initialList = [INITIAL_AURORA_STORE];
    this.saveAllStores(initialList);
    return initialList;
  }

  /**
   * Returns strictly the stores owned by the specified authenticated merchant
   */
  static getMerchantStores(ownerId?: string | null): StoreInstance[] {
    if (!ownerId) return [];
    return this.getAllStores().filter((s) => s.ownerId === ownerId);
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
   * Public catalog only (orders are stored in a protected subcollection).
   */
  static async fetchStoreFromFirestore(idOrSlug: string): Promise<StoreInstance | null> {
    const cleanQuery = idOrSlug.trim();
    if (!cleanQuery || !isFirebaseConfigured) return null;

    try {
      // 1. Try direct ID lookup
      const docRef = doc(db, 'stores', cleanQuery);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const raw = snapshot.data();
        const storeData: StoreInstance = {
          ...(raw as StoreInstance),
          orders: Array.isArray(raw.orders) ? raw.orders : [],
        };
        this.cacheStoreLocally(storeData);
        return storeData;
      }

      // 2. Try slug query
      const storesCol = collection(db, 'stores');
      const q = query(storesCol, where('slug', '==', cleanQuery.toLowerCase()));
      const querySnap = await getDocs(q);
      if (!querySnap.empty) {
        const raw = querySnap.docs[0].data();
        const storeData: StoreInstance = {
          ...(raw as StoreInstance),
          orders: Array.isArray(raw.orders) ? raw.orders : [],
        };
        this.cacheStoreLocally(storeData);
        return storeData;
      }
    } catch (err) {
      console.warn('Firestore fetchStore error:', err);
    }
    return null;
  }

  /**
   * Sync a store's public catalog & settings to Cloud Firestore.
   * Strips `orders` from the `/stores/{storeId}` document to comply with Firestore PII security rules.
   */
  static async syncStoreToFirestore(store: StoreInstance): Promise<boolean> {
    if (!isFirebaseConfigured || !auth.currentUser || store.ownerId !== auth.currentUser.uid) {
      return false;
    }
    try {
      const docRef = doc(db, 'stores', store.id);
      const { orders: _orders, ...publicStoreData } = store;
      const payload = {
        ...publicStoreData,
        storeName: store.settings.storeName || 'متجر إلكتروني',
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
    if (!ownerId || !isFirebaseConfigured) return [];
    try {
      const storesCol = collection(db, 'stores');
      const q = query(storesCol, where('ownerId', '==', ownerId));
      const querySnap = await getDocs(q);
      const userStores: StoreInstance[] = [];

      for (const d of querySnap.docs) {
        const raw = d.data() as StoreInstance;
        const orders = await this.fetchStoreOrdersFromFirestore(raw.id);
        userStores.push({
          ...raw,
          orders,
        });
      }

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

  /**
   * Fetch all orders for a store from `/stores/{storeId}/orders` (Owner only)
   */
  static async fetchStoreOrdersFromFirestore(storeId: string): Promise<Order[]> {
    if (!storeId || !isFirebaseConfigured || !auth.currentUser) return [];
    try {
      const ordersCol = collection(db, 'stores', storeId, 'orders');
      const snap = await getDocs(ordersCol);
      const list: Order[] = [];
      snap.forEach((d) => list.push(d.data() as Order));
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return list;
    } catch (err) {
      console.warn('Could not fetch store orders from Firestore:', err);
      return [];
    }
  }

  /**
   * Submit a new customer order to `/stores/{storeId}/orders/{orderId}`
   */
  static async submitOrderToStore(storeId: string, order: Order): Promise<void> {
    const store = this.getStoreById(storeId);
    if (store) {
      store.orders = [order, ...(store.orders || [])];
      const all = this.getAllStores();
      const idx = all.findIndex((s) => s.id === storeId);
      if (idx >= 0) {
        all[idx] = store;
        this.saveAllStores(all);
      }
    }

    if (isFirebaseConfigured && storeId && storeId !== 'store_aurora_01') {
      try {
        const orderRef = doc(db, 'stores', storeId, 'orders', order.id);
        await setDoc(orderRef, order);
      } catch (err) {
        console.warn('Could not write customer order to Firestore:', err);
      }
    }
  }

  /**
   * Lookup a single order by exact ID for customer order tracking
   */
  static async lookupOrderById(storeId: string, orderId: string, localOrders: Order[] = []): Promise<Order | null> {
    const cleanId = orderId.toUpperCase().trim().replace('#', '');
    if (!cleanId) return null;

    const localMatch = localOrders.find((o) => o.id.toUpperCase().trim() === cleanId);
    if (localMatch) return localMatch;

    if (isFirebaseConfigured && storeId) {
      try {
        const orderRef = doc(db, 'stores', storeId, 'orders', cleanId);
        const snap = await getDoc(orderRef);
        if (snap.exists()) {
          return snap.data() as Order;
        }
      } catch (err) {
        console.warn('Order lookup notice:', err);
      }
    }
    return null;
  }

  /**
   * Update order status or tracking notes (Owner only)
   */
  static async updateOrderInStore(storeId: string, updatedOrder: Order): Promise<void> {
    if (!isFirebaseConfigured || !auth.currentUser) return;
    try {
      const orderRef = doc(db, 'stores', storeId, 'orders', updatedOrder.id);
      await setDoc(orderRef, updatedOrder, { merge: true });
    } catch (err) {
      console.warn('Could not update order in Firestore:', err);
    }
  }

  private static cacheStoreLocally(store: StoreInstance): void {
    const all = this.getAllStores();
    const idx = all.findIndex(s => s.id === store.id || s.slug === store.slug);
    let updated: StoreInstance[];
    if (idx >= 0) {
      updated = [...all];
      updated[idx] = {
        ...store,
        orders: updated[idx].orders?.length ? updated[idx].orders : store.orders || [],
      };
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
    initialProducts?: Product[];
  }): StoreInstance {
    const all = this.getAllStores();
    const baseSlug = (params.slug || params.storeName)
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || `store-${Date.now().toString().slice(-5)}`;

    // Ensure local slug uniqueness
    const slugExists = all.some((s) => s.slug.toLowerCase() === baseSlug);
    const cleanSlug = slugExists ? `${baseSlug}-${Date.now().toString().slice(-4)}` : baseSlug;

    const newStore: StoreInstance = {
      id: `store_${Date.now()}`,
      slug: cleanSlug,
      ownerId: params.ownerId || auth.currentUser?.uid || 'merchant_user',
      createdAt: new Date().toISOString(),
      settings: {
        ...DEFAULT_SETTINGS,
        storeName: params.storeName.trim(),
        storeSubtitle: params.storeSubtitle?.trim() || '',
        logoLetter: params.logoLetter || params.storeName.charAt(0) || 'S',
        tagline: params.tagline.trim(),
        whatsappNumber: params.whatsappNumber.replace(/\D/g, '') || '',
        supportPhone: params.whatsappNumber.replace(/\D/g, '') ? `+${params.whatsappNumber.replace(/\D/g, '')}` : '',
        currency: params.currency || 'ر.س',
        googleWebAppUrl: '',
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
      products: params.initialProducts !== undefined ? params.initialProducts : [],
      orders: [],
      policies: DEFAULT_POLICIES,
      googleSheetConfig: {
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

    if (isFirebaseConfigured && auth.currentUser && targetStore?.ownerId === auth.currentUser.uid) {
      deleteDoc(doc(db, 'stores', storeId)).catch(console.warn);
    }
  }
}
