import { StoreInstance, Product, Order } from '../types/store';
import { 
  DEFAULT_SETTINGS, 
  DEFAULT_PRODUCTS, 
  DEFAULT_ORDERS, 
  DEFAULT_POLICIES 
} from './storeStorage';
import { db, auth, isFirebaseConfigured } from './firebase';
import { generateCleanStoreSlug } from '../utils/urlRouter';
import { 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  collection, 
  query, 
  where, 
  limit,
  getDocs,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';

const STORES_STORAGE_KEY = 'storelink_all_stores';
const ACTIVE_STORE_KEY = 'storelink_active_store_id';

export type CloudSyncStatus = 'synced' | 'syncing' | 'local_only' | 'error';

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

// In-memory cache and deduplication maps for high-concurrency performance
let memoryStoresCache: StoreInstance[] | null = null;
const inFlightStoreFetches = new Map<string, Promise<StoreInstance | null>>();
const syncDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

export class StoreManager {
  static getAllStores(): StoreInstance[] {
    if (memoryStoresCache && memoryStoresCache.length > 0) {
      return memoryStoresCache;
    }

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
            memoryStoresCache = parsed;
            return parsed;
          }
        }
      }
    } catch (e) {
      console.warn('Error reading stores list from localStorage', e);
    }

    const initialList = [INITIAL_AURORA_STORE];
    memoryStoresCache = initialList;
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
    memoryStoresCache = stores;
    try {
      localStorage.setItem(STORES_STORAGE_KEY, JSON.stringify(stores));
    } catch (e) {
      console.warn('LocalStorage quota reached on saveAllStores, applying LRU eviction:', e);
      try {
        const currentUserId = auth.currentUser?.uid;
        // Keep owned stores + active store + INITIAL_AURORA_STORE, and trim cached orders
        const activeId = localStorage.getItem(ACTIVE_STORE_KEY);
        const trimmed = stores
          .filter((s, idx) => s.ownerId === currentUserId || s.id === activeId || idx < 4)
          .map((s) => ({
            ...s,
            orders: (s.orders || []).slice(0, 50),
          }));
        memoryStoresCache = trimmed.length > 0 ? trimmed : [INITIAL_AURORA_STORE];
        localStorage.setItem(STORES_STORAGE_KEY, JSON.stringify(memoryStoresCache));
      } catch (retryErr) {
        console.warn('Could not persist stores after LRU eviction:', retryErr);
      }
    }
    window.dispatchEvent(new Event('storelink_stores_changed'));
  }

  static getActiveStore(): StoreInstance {
    const all = this.getAllStores();
    try {
      const activeId = localStorage.getItem(ACTIVE_STORE_KEY);
      if (activeId) {
        const found = all.find((s) => s.id === activeId);
        if (found) return found;
      }
    } catch {}
    const fallback = all[0] || INITIAL_AURORA_STORE;
    try {
      localStorage.setItem(ACTIVE_STORE_KEY, fallback.id);
    } catch {}
    return fallback;
  }

  static setActiveStoreId(storeId: string): void {
    try {
      const current = localStorage.getItem(ACTIVE_STORE_KEY);
      if (current === storeId) return;
      localStorage.setItem(ACTIVE_STORE_KEY, storeId);
    } catch (e) {
      console.warn('Could not set active store ID:', e);
    }
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
   * - Skips wasted `getDoc` when the query is a slug (`!cleanQuery.startsWith('store_')`)
   * - Enforces `limit(1)` to comply with Firestore security rules and high-concurrency scalability
   * - Deduplicates concurrent in-flight requests for the same slug/ID
   */
  static async fetchStoreFromFirestore(idOrSlug: string): Promise<StoreInstance | null> {
    const cleanQuery = idOrSlug.trim();
    if (!cleanQuery || !isFirebaseConfigured) return null;

    const cacheKey = cleanQuery.toLowerCase();
    const existingPromise = inFlightStoreFetches.get(cacheKey);
    if (existingPromise) {
      return existingPromise;
    }

    const fetchPromise = (async (): Promise<StoreInstance | null> => {
      try {
        const looksLikeStoreId = cleanQuery.startsWith('store_');

        if (looksLikeStoreId) {
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
        }

        // Direct indexed slug query with limit(1)
        const storesCol = collection(db, 'stores');
        const q = query(storesCol, where('slug', '==', cleanQuery.toLowerCase()), limit(1));
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

        // Fallback to direct ID lookup only if slug query missed and it wasn't checked yet
        if (!looksLikeStoreId) {
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
        }
      } catch (err) {
        console.warn('Firestore fetchStore error:', err);
      } finally {
        inFlightStoreFetches.delete(cacheKey);
      }
      return null;
    })();

    inFlightStoreFetches.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  private static dispatchSyncStatus(status: CloudSyncStatus): void {
    window.dispatchEvent(new CustomEvent('storelink_sync_status', { detail: status }));
  }

  /**
   * Sync a store's public catalog & settings to Cloud Firestore.
   * Strips `orders` from the `/stores/{storeId}` document to comply with Firestore PII security rules.
   */
  static async syncStoreToFirestore(store: StoreInstance): Promise<boolean> {
    if (!isFirebaseConfigured || !auth.currentUser || store.ownerId !== auth.currentUser.uid) {
      this.dispatchSyncStatus('local_only');
      return false;
    }
    try {
      this.dispatchSyncStatus('syncing');
      const docRef = doc(db, 'stores', store.id);
      const { orders: _orders, ...publicStoreData } = store;
      const payload = {
        ...publicStoreData,
        storeName: store.settings.storeName || 'متجر إلكتروني',
        updatedAt: new Date().toISOString()
      };
      await setDoc(docRef, payload, { merge: true });
      this.dispatchSyncStatus('synced');
      return true;
    } catch (err) {
      console.warn('Could not sync store to Firestore:', err);
      this.dispatchSyncStatus('error');
      return false;
    }
  }

  /**
   * Debounced wrapper around syncStoreToFirestore to prevent write contention
   * when merchants rapidly edit settings, policies, or product stock.
   */
  static scheduleStoreSync(store: StoreInstance, delayMs: number = 450): void {
    if (!isFirebaseConfigured || !auth.currentUser || store.ownerId !== auth.currentUser.uid) {
      this.dispatchSyncStatus('local_only');
      return;
    }
    this.dispatchSyncStatus('syncing');
    const prevTimer = syncDebounceTimers.get(store.id);
    if (prevTimer) {
      clearTimeout(prevTimer);
    }
    const timer = setTimeout(() => {
      syncDebounceTimers.delete(store.id);
      this.syncStoreToFirestore(store).catch(console.warn);
    }, delayMs);
    syncDebounceTimers.set(store.id, timer);
  }

  /**
   * Fetch all stores belonging to a merchant from Firestore in parallel
   */
  static async fetchUserStoresFromFirestore(ownerId: string): Promise<StoreInstance[]> {
    if (!ownerId || !isFirebaseConfigured) return [];
    try {
      const storesCol = collection(db, 'stores');
      const q = query(storesCol, where('ownerId', '==', ownerId), limit(20));
      const querySnap = await getDocs(q);

      const userStores = await Promise.all(
        querySnap.docs.map(async (d) => {
          const raw = d.data() as StoreInstance;
          const orders = await this.fetchStoreOrdersFromFirestore(raw.id);
          return {
            ...raw,
            orders,
          };
        })
      );

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
   * Fetch orders for a store from `/stores/{storeId}/orders` (Owner only)
   */
  static async fetchStoreOrdersFromFirestore(storeId: string): Promise<Order[]> {
    if (!storeId || !isFirebaseConfigured || !auth.currentUser) return [];
    try {
      const ordersCol = collection(db, 'stores', storeId, 'orders');
      const q = query(ordersCol, limit(200));
      const snap = await getDocs(q);
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
   * Subscribe in real-time (`onSnapshot`) to a store's orders subcollection for the merchant dashboard
   */
  static subscribeToStoreOrders(
    storeId: string,
    onOrdersUpdated: (orders: Order[], newOrdersCount: number) => void
  ): Unsubscribe | null {
    if (!storeId || !isFirebaseConfigured || !auth.currentUser || storeId === 'store_aurora_01') {
      return null;
    }
    try {
      let isInitialSnapshot = true;
      let knownOrderIds = new Set<string>();
      const ordersCol = collection(db, 'stores', storeId, 'orders');
      const q = query(ordersCol, limit(200));

      return onSnapshot(
        q,
        (snap) => {
          const list: Order[] = [];
          let newlyAdded = 0;

          snap.forEach((d) => {
            const ord = d.data() as Order;
            list.push(ord);
            if (!isInitialSnapshot && !knownOrderIds.has(ord.id)) {
              newlyAdded++;
            }
          });

          knownOrderIds = new Set(list.map((o) => o.id));
          isInitialSnapshot = false;
          list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          onOrdersUpdated(list, newlyAdded);
        },
        (err) => {
          console.warn('Real-time order listener notice:', err);
        }
      );
    } catch (err) {
      console.warn('Could not attach order listener:', err);
      return null;
    }
  }

  /**
   * Submit a new customer order to `/stores/{storeId}/orders/{orderId}`
   * and decrement local product stock quantities if tracked.
   */
  static async submitOrderToStore(storeId: string, order: Order): Promise<boolean> {
    const store = this.getStoreById(storeId);
    if (store) {
      store.orders = [order, ...(store.orders || [])].slice(0, 150);

      // Decrement stockQuantity if tracked on ordered products
      let stockChanged = false;
      if (Array.isArray(store.products) && Array.isArray(order.items)) {
        store.products = store.products.map((prod) => {
          const orderedQty = order.items
            .filter((item) => item.productId === prod.id)
            .reduce((sum, item) => sum + item.quantity, 0);
          if (orderedQty > 0 && typeof prod.stockQuantity === 'number') {
            stockChanged = true;
            const remaining = Math.max(0, prod.stockQuantity - orderedQty);
            return {
              ...prod,
              stockQuantity: remaining,
              inStock: remaining > 0 ? prod.inStock : false,
            };
          }
          return prod;
        });
      }

      const all = this.getAllStores();
      const idx = all.findIndex((s) => s.id === storeId);
      if (idx >= 0) {
        all[idx] = store;
        this.saveAllStores(all);
      }

      if (stockChanged && auth.currentUser && store.ownerId === auth.currentUser.uid) {
        this.scheduleStoreSync(store);
      }
    }

    if (isFirebaseConfigured && storeId && storeId !== 'store_aurora_01') {
      try {
        const orderRef = doc(db, 'stores', storeId, 'orders', order.id);
        await setDoc(orderRef, order);
        return true;
      } catch (err) {
        console.warn('Could not write customer order to Firestore:', err);
        return false;
      }
    }
    return true;
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
    businessType?: string;
    slug?: string;
    ownerId: string;
    tagline: string;
    whatsappNumber: string;
    currency: string;
    primaryColor: string;
    accentColor: string;
    backgroundColor: string;
    logoLetter: string;
    logoUrl?: string;
    freeShippingThreshold?: number;
    standardShippingRate?: number;
    initialProducts?: Product[];
  }): StoreInstance {
    const all = this.getAllStores();
    const rawSlugInput = params.slug?.trim() || params.storeName;
    const baseSlug = generateCleanStoreSlug(rawSlugInput, 'shop');

    // Ensure local slug uniqueness
    const slugExists = all.some((s) => s.slug.toLowerCase() === baseSlug.toLowerCase());
    const cleanSlug = slugExists ? `${baseSlug}-${Math.floor(100 + Math.random() * 900)}` : baseSlug;
    const cleanWhatsapp = params.whatsappNumber.replace(/\D/g, '') || '';

    const newStore: StoreInstance = {
      id: `store_${Date.now()}`,
      slug: cleanSlug,
      ownerId: params.ownerId || auth.currentUser?.uid || 'merchant_user',
      createdAt: new Date().toISOString(),
      settings: {
        ...DEFAULT_SETTINGS,
        storeName: params.storeName.trim(),
        storeSubtitle: params.storeSubtitle?.trim() || '',
        businessType: params.businessType || '',
        logoLetter: params.logoLetter || params.storeName.trim().charAt(0) || 'S',
        logoUrl: params.logoUrl || '',
        tagline: params.tagline.trim() || 'تسوق أسهل وأسرع مع الطلب المباشر عبر واتساب',
        whatsappNumber: cleanWhatsapp,
        supportPhone: cleanWhatsapp ? `+${cleanWhatsapp}` : '',
        supportEmail: '',
        instagramHandle: '',
        tiktokHandle: '',
        websiteUrl: '',
        currency: params.currency || 'ر.س',
        freeShippingThreshold:
          typeof params.freeShippingThreshold === 'number' ? params.freeShippingThreshold : 300,
        standardShippingRate:
          typeof params.standardShippingRate === 'number' ? params.standardShippingRate : 25,
        bankDetails: {
          bankName: '',
          iban: '',
          accountHolder: params.storeName.trim(),
        },
        orderNotificationEmail: '',
        heroTitle: `أهلاً بك في ${params.storeName.trim()}`,
        heroSubtitle: params.tagline.trim() || 'تصفح أحدث منتجاتنا واطلبها مباشرة عبر الواتساب بضغطة زر.',
        announcementText:
          typeof params.freeShippingThreshold === 'number' && params.freeShippingThreshold > 0
            ? `✨ شحن مجاني للطلبات فوق ${params.freeShippingThreshold} ${params.currency || 'ر.س'} — اطلب الآن عبر واتساب!`
            : `✨ أهلاً بك في ${params.storeName.trim()} — طلب فوري وسريع عبر واتساب!`,
        promoCodes: [],
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
    };

    const updated = [newStore, ...all];
    this.saveAllStores(updated);
    this.setActiveStoreId(newStore.id);

    // Sync to Firestore immediately on creation
    if (auth.currentUser) {
      this.syncStoreToFirestore(newStore).catch(console.warn);
    }

    return newStore;
  }

  static updateStore(updatedStore: StoreInstance, options?: { skipCloudSync?: boolean; immediateSync?: boolean }): void {
    const all = this.getAllStores();
    const index = all.findIndex((s) => s.id === updatedStore.id);
    if (index >= 0) {
      all[index] = updatedStore;
      this.saveAllStores(all);
    } else {
      this.saveAllStores([updatedStore, ...all]);
    }

    if (!options?.skipCloudSync && auth.currentUser && updatedStore.ownerId === auth.currentUser.uid) {
      if (options?.immediateSync) {
        this.syncStoreToFirestore(updatedStore).catch(console.warn);
      } else {
        this.scheduleStoreSync(updatedStore);
      }
    }
  }

  static deleteStore(storeId: string): void {
    if (storeId === 'store_aurora_01') return;
    const all = this.getAllStores();
    const targetStore = all.find(s => s.id === storeId);
    const filtered = all.filter((s) => s.id !== storeId);
    const finalStores = filtered.length > 0 ? filtered : [INITIAL_AURORA_STORE];
    this.saveAllStores(finalStores);
    this.setActiveStoreId(finalStores[0].id);

    if (isFirebaseConfigured && auth.currentUser && targetStore?.ownerId === auth.currentUser.uid) {
      deleteDoc(doc(db, 'stores', storeId)).catch(console.warn);
    }
  }
}
