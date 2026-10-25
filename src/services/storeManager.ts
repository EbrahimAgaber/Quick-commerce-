import { StoreInstance, Product, Order, OrderItem, StoreSettings, getProductUnitLabel } from '../types/store';
import { 
  StoreStorage,
  DEFAULT_SETTINGS, 
  DEFAULT_PRODUCTS, 
  DEFAULT_ORDERS, 
  DEFAULT_POLICIES 
} from './storeStorage';
import { db, auth, isFirebaseConfigured } from './firebase';
import { generateCleanStoreSlug } from '../utils/urlRouter';
import { normalizeArabicDigits, toWhatsAppNumber } from '../utils/digits';
import { generateOrderId, getOrderDeliveryPin, generateDeliveryPin } from '../utils/whatsappInvoice';
import { NotificationHub } from './notificationService';
import { getZatcaComplianceType, calculateVatBreakdown } from '../utils/zatca';
import { isLegacyWatchPlaceholder, resolveStaticGoogleDriveAsset } from '../utils/imageOptimizer';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  deleteDoc, 
  collection, 
  query, 
  where, 
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';

export const RESERVED_SLUGS = new Set([
  'admin', 'api', 'app', 'login', 'register', 'auth', 's', 'aurora', 'store',
  'dashboard', 'checkout', 'orders', 'cart', 'static', 'assets', 'tracking',
  'null', 'undefined', 'privacy', 'terms', 'help', 'settings'
]);

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
let lastRawStoresStorageSnapshot: string | null = null;
const inFlightStoreFetches = new Map<string, Promise<StoreInstance | null>>();
const syncDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
let localServerSyncTimer: ReturnType<typeof setTimeout> | null = null;
let lastSyncedServerPayloadHash: string | null = null;

/**
 * Generates a collision-resistant unique product ID using crypto.randomUUID() when available.
 */
export function generateUniqueProductId(existingProducts: Product[] = []): string {
  const existingIds = new Set((existingProducts || []).map((p) => p?.id).filter(Boolean));
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `prod_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
        : `prod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    if (!existingIds.has(candidate)) {
      return candidate;
    }
  }
  return `prod_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Strips bulky Base64 image data URLs from a store's products & logo when localStorage is full,
 * while keeping full images in memory and on the local server disk.
 */
function stripBulkyBase64FromStoreForQuota(store: StoreInstance): StoreInstance {
  const cleanLogo =
    typeof store.settings?.logoUrl === 'string' &&
    store.settings.logoUrl.startsWith('data:image/') &&
    store.settings.logoUrl.length > 4096
      ? ''
      : store.settings?.logoUrl || '';

  const cleanProducts = (store.products || []).map((p) => {
    const cleanImg =
      typeof p.imageUrl === 'string' && p.imageUrl.startsWith('data:image/') && p.imageUrl.length > 4096
        ? ''
        : p.imageUrl;
    const cleanGallery = Array.isArray(p.galleryImages)
      ? p.galleryImages.filter(
          (img) => !(typeof img === 'string' && img.startsWith('data:image/') && img.length > 4096)
        )
      : undefined;
    return {
      ...p,
      imageUrl: cleanImg,
      ...(cleanGallery ? { galleryImages: cleanGallery } : {}),
    };
  });

  return {
    ...store,
    settings: {
      ...store.settings,
      logoUrl: cleanLogo,
    },
    products: cleanProducts,
    orders: (store.orders || []).slice(0, 50),
  };
}

/**
 * Strips duplicate orders by order ID (case-insensitive), preventing duplicated records
 */
export function deduplicateOrders(orders: Order[]): Order[] {
  if (!Array.isArray(orders)) return [];
  const map = new Map<string, Order>();
  for (const o of orders) {
    if (!o || typeof o !== 'object' || !o.id) continue;
    const cleanId = String(o.id).trim().toUpperCase();
    if (!map.has(cleanId)) {
      map.set(cleanId, o);
    }
  }
  return Array.from(map.values());
}

/**
 * Validates and deeply sanitizes a raw store object from localStorage or Firestore,
 * ensuring missing or corrupted properties are safely replaced with robust defaults.
 */
export function sanitizeStoreInstance(raw: any): StoreInstance | null {
  if (!raw || typeof raw !== 'object' || !raw.id || typeof raw.id !== 'string') {
    return null;
  }

  const rawSettings = (raw.settings && typeof raw.settings === 'object') ? raw.settings : {};
  const rawTheme = (rawSettings.brandTheme && typeof rawSettings.brandTheme === 'object') ? rawSettings.brandTheme : {};
  const rawBank = (rawSettings.bankDetails && typeof rawSettings.bankDetails === 'object') ? rawSettings.bankDetails : {};

  const isDemo = raw.id === 'store_aurora_01' || raw.slug === 'aurora';
  const cleanStoreName = typeof rawSettings.storeName === 'string' && rawSettings.storeName.trim()
    ? rawSettings.storeName.trim()
    : (isDemo ? DEFAULT_SETTINGS.storeName : 'متجر إلكتروني');
  const cleanTagline = typeof rawSettings.tagline === 'string' && rawSettings.tagline.trim()
    ? rawSettings.tagline.trim()
    : (isDemo ? DEFAULT_SETTINGS.tagline : 'تسوق أحدث المنتجات مع توصيل سريع وضمان جودة معتمد');

  // Strip stale demo branding (أورورا / Aurora) from non-demo merchant stores
  let metaTitle = typeof rawSettings.metaTitle === 'string' ? rawSettings.metaTitle.trim() : '';
  if (!isDemo && (!metaTitle || metaTitle.includes('أورورا') || metaTitle.includes('Aurora'))) {
    metaTitle = `${cleanStoreName} | ${cleanTagline}`;
  }

  let metaDescription = typeof rawSettings.metaDescription === 'string' ? rawSettings.metaDescription.trim() : '';
  if (!isDemo && (!metaDescription || metaDescription.includes('أورورا') || metaDescription.includes('Aurora'))) {
    metaDescription = `${cleanStoreName}: ${cleanTagline}. تسوق أفضل المنتجات مع شحن فوري لكافة مدن المملكة ودفع آمن عند الاستلام وبطاقات مدى وأبل باي.`;
  }

  let metaKeywords = Array.isArray(rawSettings.metaKeywords) ? rawSettings.metaKeywords : [];
  if (!isDemo) {
    metaKeywords = metaKeywords.filter((k: any) => typeof k === 'string' && !k.includes('أورورا') && !k.includes('Aurora'));
    if (metaKeywords.length === 0) {
      metaKeywords = [cleanStoreName, 'تسوق أونلاين السعودية', 'الدفع عند الاستلام', 'توصيل سريع'];
    }
  }

  const settings: StoreSettings = {
    ...DEFAULT_SETTINGS,
    ...rawSettings,
    storeName: cleanStoreName,
    tagline: cleanTagline,
    metaTitle: metaTitle || DEFAULT_SETTINGS.metaTitle,
    metaDescription: metaDescription || DEFAULT_SETTINGS.metaDescription,
    metaKeywords: metaKeywords.length > 0 ? metaKeywords : DEFAULT_SETTINGS.metaKeywords,
    currency: typeof rawSettings.currency === 'string' && rawSettings.currency.trim() ? rawSettings.currency.trim() : 'ر.س',
    brandTheme: {
      ...DEFAULT_SETTINGS.brandTheme,
      ...rawTheme,
      primaryColor: rawTheme.primaryColor || DEFAULT_SETTINGS.brandTheme.primaryColor,
      accentColor: rawTheme.accentColor || DEFAULT_SETTINGS.brandTheme.accentColor,
      backgroundColor: rawTheme.backgroundColor || DEFAULT_SETTINGS.brandTheme.backgroundColor,
      neutralColor: rawTheme.neutralColor || DEFAULT_SETTINGS.brandTheme.neutralColor,
      textColor: rawTheme.textColor || rawTheme.primaryColor || DEFAULT_SETTINGS.brandTheme.textColor,
      fontFamily: rawTheme.fontFamily || DEFAULT_SETTINGS.brandTheme.fontFamily,
    },
    bankDetails: {
      ...DEFAULT_SETTINGS.bankDetails,
      ...rawBank,
    },
    paymentMethods: Array.isArray(rawSettings.paymentMethods) && rawSettings.paymentMethods.length > 0
      ? rawSettings.paymentMethods
      : DEFAULT_SETTINGS.paymentMethods,
  };
  let products = Array.isArray(raw.products)
    ? raw.products
        .filter((p: any) => p && typeof p === 'object' && p.id)
        .map((p: Product) => {
          const rawPrimary = isLegacyWatchPlaceholder(p.imageUrl) ? '' : (p.imageUrl || '');
          const cleanPrimary = resolveStaticGoogleDriveAsset(rawPrimary) || rawPrimary;
          const cleanGallery = Array.isArray(p.galleryImages)
            ? p.galleryImages
                .filter((img) => Boolean(img) && !isLegacyWatchPlaceholder(img))
                .map((img) => resolveStaticGoogleDriveAsset(img) || img)
            : cleanPrimary
            ? [cleanPrimary]
            : [];
          return {
            ...p,
            imageUrl: cleanPrimary,
            galleryImages: cleanGallery,
          };
        })
    : [];
  if (isDemo && products.length === 0) {
    products = DEFAULT_PRODUCTS;
  }

  const orders = deduplicateOrders(
    Array.isArray(raw.orders)
      ? raw.orders.filter((o: any) => o && typeof o === 'object' && o.id)
      : []
  );

  const policies = Array.isArray(raw.policies) && raw.policies.length > 0
    ? raw.policies.filter((pol: any) => pol && typeof pol === 'object' && pol.id)
    : DEFAULT_POLICIES;

  return {
    ...raw,
    id: raw.id,
    slug: raw.slug || (isDemo ? 'aurora' : 'store'),
    ownerId: raw.ownerId || (isDemo ? 'system_demo' : 'merchant_user'),
    createdAt: raw.createdAt || new Date().toISOString(),
    settings,
    products,
    orders,
    policies: policies.length > 0 ? policies : DEFAULT_POLICIES,
  };
}

export class StoreManager {
  static getAllStores(): StoreInstance[] {
    try {
      const currentRaw = localStorage.getItem(STORES_STORAGE_KEY);
      // Return in-memory cache if localStorage was not externally mutated or cleared
      if (
        memoryStoresCache &&
        memoryStoresCache.length > 0 &&
        currentRaw !== null &&
        currentRaw === lastRawStoresStorageSnapshot
      ) {
        return memoryStoresCache;
      }

      if (currentRaw) {
        const parsed = JSON.parse(currentRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sanitized = parsed
            .map(sanitizeStoreInstance)
            .filter((s): s is StoreInstance => s !== null);

          if (sanitized.length > 0) {
            // Ensure demo store is always present in list
            if (!sanitized.some((s) => s.id === 'store_aurora_01')) {
              sanitized.push(INITIAL_AURORA_STORE);
            }
            memoryStoresCache = sanitized;
            lastRawStoresStorageSnapshot = currentRaw;
            return sanitized;
          }
        }
      }
    } catch (e) {
      console.warn('Error reading stores list from localStorage, recovering defaults:', e);
    }

    const initialList = [INITIAL_AURORA_STORE];
    memoryStoresCache = initialList;
    this.saveAllStores(initialList);
    return initialList;
  }

  /**
   * Emergency recovery: clears corrupt local storage and restores fresh baseline state
   */
  static resetCorruptedStorage(): void {
    memoryStoresCache = null;
    lastRawStoresStorageSnapshot = null;
    try {
      localStorage.removeItem(STORES_STORAGE_KEY);
      localStorage.removeItem(ACTIVE_STORE_KEY);
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('storelink_cart_') || k.startsWith('storelink_'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.warn('Notice during storage reset:', e);
    }

    const freshList = [INITIAL_AURORA_STORE];
    memoryStoresCache = freshList;
    this.saveAllStores(freshList);
    this.setActiveStoreId(INITIAL_AURORA_STORE.id);
  }

  /**
   * Returns strictly the stores owned by the specified authenticated merchant
   */
  static getMerchantStores(ownerId?: string | null): StoreInstance[] {
    if (!ownerId) return [];
    return this.getAllStores().filter((s) => s.ownerId === ownerId);
  }

  /**
   * Reclaims and associates any guest stores created during onboarding with the authenticated merchant
   */
  static claimGuestStores(ownerId: string): StoreInstance[] {
    if (!ownerId) return [];
    const all = this.getAllStores();
    let hasChanges = false;
    const updated = all.map((store) => {
      if (store.id === 'store_aurora_01') return store;
      if (store.ownerId === 'merchant_user' || store.ownerId === 'guest') {
        hasChanges = true;
        const claimed = { ...store, ownerId };
        if (auth.currentUser && auth.currentUser.uid === ownerId) {
          this.syncStoreToFirestore(claimed).catch(console.warn);
        }
        return claimed;
      }
      return store;
    });

    if (hasChanges) {
      this.saveAllStores(updated);
    }
    return updated.filter((s) => s.ownerId === ownerId);
  }

  static saveAllStores(stores: StoreInstance[], options?: { skipLocalServerSync?: boolean }): void {
    memoryStoresCache = stores;
    try {
      const serialized = JSON.stringify(stores);
      localStorage.setItem(STORES_STORAGE_KEY, serialized);
      lastRawStoresStorageSnapshot = serialized;
    } catch (e) {
      console.warn('LocalStorage quota reached on saveAllStores, stripping bulky Base64 assets for localStorage cache:', e);
      try {
        const currentUserId = auth.currentUser?.uid;
        const activeId = localStorage.getItem(ACTIVE_STORE_KEY);
        const lightweightStores = stores
          .filter((s, idx) => s.ownerId === currentUserId || s.id === activeId || idx < 6)
          .map(stripBulkyBase64FromStoreForQuota);
        const serializedLightweight = JSON.stringify(
          lightweightStores.length > 0 ? lightweightStores : [INITIAL_AURORA_STORE]
        );
        localStorage.setItem(STORES_STORAGE_KEY, serializedLightweight);
        lastRawStoresStorageSnapshot = serializedLightweight;
      } catch (retryErr) {
        console.warn('Could not persist stores to localStorage after Base64 stripping (in-memory & local server storage remain intact):', retryErr);
      }
    }

    if (!options?.skipLocalServerSync && typeof window !== 'undefined' && typeof fetch === 'function') {
      if (localServerSyncTimer) {
        clearTimeout(localServerSyncTimer);
      }
      localServerSyncTimer = setTimeout(() => {
        localServerSyncTimer = null;
        this.syncStoresToLocalServer(stores).catch(() => {});
      }, 250);
    }

    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new Event('storelink_stores_changed'));
    }
  }

  /**
   * Synchronizes the store or stores list with the local server database (`/api/store/save` -> `/data/stores.json`).
   * Ensures zero 5MB browser quota limits and automatic Base64-to-file asset conversion.
   */
  static async syncStoresToLocalServer(
    storesOrSingle: StoreInstance[] | StoreInstance
  ): Promise<StoreInstance | null> {
    if (typeof fetch !== 'function' || typeof window === 'undefined') {
      return null;
    }
    try {
      const payload = Array.isArray(storesOrSingle)
        ? { stores: storesOrSingle }
        : { store: storesOrSingle };

      const serializedBody = JSON.stringify(payload);
      if (serializedBody === lastSyncedServerPayloadHash) {
        return null;
      }
      lastSyncedServerPayloadHash = serializedBody;

      const res = await fetch('/api/store/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: serializedBody,
      });

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data?.success && data?.store) {
          return sanitizeStoreInstance(data.store);
        }
      }
    } catch {
      // Quiet fallback when running without local server middleware (e.g., static hosting or unit tests)
    }
    return null;
  }

  /**
   * Hydrates stores from the local server `/api/store/data` endpoint (`/data/stores.json`).
   * Preserves and merges any local products so merchant work is never lost.
   */
  static async fetchStoresFromLocalServer(storeId?: string): Promise<{
    store?: StoreInstance | null;
    stores?: StoreInstance[];
  } | null> {
    if (typeof fetch !== 'function' || typeof window === 'undefined') {
      return null;
    }
    try {
      const queryParam = storeId ? `?storeId=${encodeURIComponent(storeId)}` : '';
      const res = await fetch(`/api/store/data${queryParam}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        return null;
      }

      const data = await res.json();
      if (!data?.success) return null;

      if (Array.isArray(data.stores) && data.stores.length > 0) {
        const serverStores = data.stores
          .map(sanitizeStoreInstance)
          .filter((s: StoreInstance | null): s is StoreInstance => s !== null);

        if (serverStores.length > 0) {
          const localStores = this.getAllStores();
          const mergedMap = new Map<string, StoreInstance>();

          // Merge server stores with local stores, keeping whichever has more products if one is empty
          for (const srvStore of serverStores) {
            const locMatch = localStores.find((l) => l.id === srvStore.id || l.slug === srvStore.slug);
            const resolvedProducts =
              (srvStore.products || []).length > 0
                ? srvStore.products
                : locMatch?.products || [];
            const resolvedOrders = deduplicateOrders([
              ...(srvStore.orders || []),
              ...(locMatch?.orders || []),
            ]);
            mergedMap.set(srvStore.id, {
              ...srvStore,
              products: resolvedProducts,
              orders: resolvedOrders,
            });
          }

          for (const locStore of localStores) {
            if (!mergedMap.has(locStore.id)) {
              mergedMap.set(locStore.id, locStore);
            }
          }

          const mergedList = Array.from(mergedMap.values());
          this.saveAllStores(mergedList, { skipLocalServerSync: true });
          const targetStore = storeId
            ? mergedList.find((s) => s.id === storeId || s.slug === storeId) || mergedList[0]
            : mergedList[0];

          return { store: targetStore, stores: mergedList };
        }
      }

      if (data.store) {
        const sanitized = sanitizeStoreInstance(data.store);
        if (sanitized) {
          this.cacheStoreLocally(sanitized);
          return { store: sanitized, stores: this.getAllStores() };
        }
      }
    } catch {
      // Quiet fallback when offline
    }
    return null;
  }

  /**
   * Triggers a one-click browser download of the full store backup as a `.json` file.
   */
  static async downloadStoreBackupJson(storeId?: string): Promise<boolean> {
    const targetStore =
      (storeId ? this.getStoreById(storeId) : null) || this.getActiveStore();

    // Sync latest state to local server first
    await this.syncStoresToLocalServer(this.getAllStores());

    const safeSlug = (targetStore.slug || targetStore.id || 'store')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .toLowerCase();
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `storelink_backup_${safeSlug}_${dateStamp}.json`;

    const backupEnvelope = {
      backupVersion: '2.0',
      exportedAt: new Date().toISOString(),
      platform: 'StoreLink Local Server Storage Engine',
      storeCount: 1,
      store: targetStore,
      stores: [targetStore],
    };

    if (typeof document !== 'undefined') {
      const jsonString = JSON.stringify(backupEnvelope, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return true;
    }
    return false;
  }

  /**
   * Restores a store from a parsed JSON backup object (supports both 'replace' and 'merge' modes),
   * persisting to `/api/store/backup/restore` (`/data/stores.json`), `localStorage`, and `StoreStorage`.
   */
  static async restoreStoreFromBackup(
    rawBackupData: any,
    mode: 'replace' | 'merge' = 'replace',
    targetStoreId?: string
  ): Promise<{ success: boolean; store?: StoreInstance; error?: string }> {
    if (!rawBackupData || typeof rawBackupData !== 'object') {
      return { success: false, error: 'ملف النسخة الاحتياطية غير صالح.' };
    }

    // Extract candidate store from envelope or direct store object
    const incomingRaw =
      rawBackupData.store && typeof rawBackupData.store === 'object'
        ? rawBackupData.store
        : Array.isArray(rawBackupData.stores) && rawBackupData.stores.length > 0
        ? rawBackupData.stores[0]
        : rawBackupData.settings || rawBackupData.products
        ? rawBackupData
        : null;

    if (!incomingRaw) {
      return {
        success: false,
        error: 'لم يتم العثور على بيانات متجر صالحة داخل ملف JSON المرفق.',
      };
    }

    const currentStore =
      (targetStoreId ? this.getStoreById(targetStoreId) : null) || this.getActiveStore();

    // Try server-side restore endpoint first so Base64 images are converted to /uploads/ files
    if (typeof fetch === 'function' && typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/store/backup/restore', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            backup: rawBackupData,
            mode,
            targetStoreId: currentStore.id,
          }),
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          if (data?.success && data?.store) {
            const restored = sanitizeStoreInstance({
              ...data.store,
              id: currentStore.id,
              slug: data.store.slug || currentStore.slug,
              ownerId: currentStore.ownerId,
            });
            if (restored) {
              this.updateStore(restored, { immediateSync: true });
              StoreStorage.hydrateStore({
                settings: restored.settings,
                products: restored.products,
                orders: restored.orders,
                policies: restored.policies,
              });
              return { success: true, store: restored };
            }
          }
        }
      } catch {
        // Fall through to client-side restore if server endpoint is unreachable
      }
    }

    // Client-side restore fallback
    const sanitizedIncoming = sanitizeStoreInstance({
      ...incomingRaw,
      id: currentStore.id,
      slug: incomingRaw.slug || currentStore.slug,
      ownerId: currentStore.ownerId,
    });

    if (!sanitizedIncoming) {
      return { success: false, error: 'تعذر قراءة بيانات المتجر من النسخة الاحتياطية.' };
    }

    let finalProducts: Product[] = [];
    let finalOrders: Order[] = [];

    if (mode === 'merge') {
      const productMap = new Map<string, Product>();
      for (const p of currentStore.products || []) {
        if (p?.id) productMap.set(String(p.id), p);
      }
      for (const p of sanitizedIncoming.products || []) {
        if (p?.id) productMap.set(String(p.id), p);
      }
      finalProducts = Array.from(productMap.values());
      finalOrders = deduplicateOrders([
        ...(sanitizedIncoming.orders || []),
        ...(currentStore.orders || []),
      ]);
    } else {
      finalProducts = sanitizedIncoming.products || [];
      finalOrders = deduplicateOrders(sanitizedIncoming.orders || []);
    }

    const restoredStore: StoreInstance = {
      ...currentStore,
      ...sanitizedIncoming,
      id: currentStore.id,
      slug: currentStore.slug,
      ownerId: currentStore.ownerId,
      settings: {
        ...currentStore.settings,
        ...sanitizedIncoming.settings,
      },
      products: finalProducts,
      orders: finalOrders,
      policies:
        Array.isArray(sanitizedIncoming.policies) && sanitizedIncoming.policies.length > 0
          ? sanitizedIncoming.policies
          : currentStore.policies,
    };

    this.updateStore(restoredStore, { immediateSync: true });
    StoreStorage.hydrateStore({
      settings: restoredStore.settings,
      products: restoredStore.products,
      orders: restoredStore.orders,
      policies: restoredStore.policies,
    });

    return { success: true, store: restoredStore };
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
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new Event('storelink_stores_changed'));
    }
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

  static getStoreByCustomDomain(domain: string): StoreInstance | null {
    if (!domain) return null;
    const clean = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '').trim();
    const all = this.getAllStores();
    return (
      all.find(
        (s) =>
          (s.settings?.customDomain || '')
            .toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/\/$/, '')
            .trim() === clean
      ) || null
    );
  }

  static async fetchStoreByCustomDomainFromFirestore(domain: string): Promise<StoreInstance | null> {
    if (!domain || !isFirebaseConfigured) return null;
    const clean = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '').trim();
    try {
      const storesCol = collection(db, 'stores');
      const q = query(storesCol, where('settings.customDomain', '==', clean), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const d = snap.docs[0];
        return await this.fetchStoreFromFirestore(d.id);
      }
    } catch (e) {
      console.warn('Custom domain lookup notice:', e);
    }
    return null;
  }

  static validateSlugAvailability(
    candidateSlug: string,
    currentStoreId?: string
  ): { valid: boolean; error?: string; normalizedSlug: string } {
    const normalized = (candidateSlug || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (!normalized || normalized.length < 3) {
      return {
        valid: false,
        error: 'يجب أن يتكون الرابط من 3 أحرف إنجليزية أو أرقام على الأقل.',
        normalizedSlug: normalized,
      };
    }
    if (normalized.length > 40) {
      return {
        valid: false,
        error: 'الرابط طويل جداً (الحد الأقصى 40 حرفاً).',
        normalizedSlug: normalized,
      };
    }
    if (RESERVED_SLUGS.has(normalized)) {
      return {
        valid: false,
        error: `الرابط "${normalized}" محجوز للنظام، يرجى اختيار رابط آخر.`,
        normalizedSlug: normalized,
      };
    }
    const all = this.getAllStores();
    const existing = all.find((s) => s.slug.toLowerCase().trim() === normalized);
    if (existing && existing.id !== currentStoreId) {
      return {
        valid: false,
        error: `الرابط "${normalized}" مستخدم بالفعل لمتجر آخر.`,
        normalizedSlug: normalized,
      };
    }
    return { valid: true, normalizedSlug: normalized };
  }

  static async updateStoreSlug(
    storeId: string,
    newSlug: string
  ): Promise<{ success: boolean; error?: string; updatedStore?: StoreInstance }> {
    const store = this.getStoreById(storeId);
    if (!store) {
      return { success: false, error: 'المتجر غير موجود.' };
    }
    const validation = this.validateSlugAvailability(newSlug, storeId);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const oldSlug = store.slug;
    const cleanNewSlug = validation.normalizedSlug;

    // Check remote slug registry if Firebase configured
    if (isFirebaseConfigured) {
      try {
        const slugDocRef = doc(db, 'slugs', cleanNewSlug);
        const snap = await getDoc(slugDocRef);
        if (snap.exists() && snap.data()?.storeId !== storeId) {
          return { success: false, error: `الرابط "${cleanNewSlug}" مسجل لمتجر آخر على السحابة.` };
        }
      } catch (checkErr) {
        console.warn('Slug registry check notice:', checkErr);
      }
    }

    // Update store slug
    const updatedStore: StoreInstance = {
      ...store,
      slug: cleanNewSlug,
    };
    this.updateStore(updatedStore, { immediateSync: true });

    // Clean up old slug from registry if applicable
    if (isFirebaseConfigured && oldSlug && oldSlug !== 'aurora' && oldSlug !== cleanNewSlug) {
      try {
        await deleteDoc(doc(db, 'slugs', oldSlug.toLowerCase()));
      } catch (delErr) {
        console.warn('Old slug cleanup notice:', delErr);
      }
    }

    return { success: true, updatedStore };
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
        let storeIdToFetch: string | null = null;

        // 1. Check if slug document exists in /slugs/{slug} registry
        const slugDocRef = doc(db, 'slugs', cleanQuery.toLowerCase());
        const slugSnap = await getDoc(slugDocRef);
        if (slugSnap.exists()) {
          storeIdToFetch = slugSnap.data()?.storeId || null;
        }

        // 2. Fallback to direct storeId
        if (!storeIdToFetch) {
          storeIdToFetch = cleanQuery;
        }

        // 3. Fetch store document
        const docRef = doc(db, 'stores', storeIdToFetch);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          const raw = snapshot.data();
          
          // 4. Load products subcollection if not present or empty in main document
          let productsList: Product[] = Array.isArray(raw.products) ? raw.products : [];
          if (!Array.isArray(raw.products) || productsList.length === 0) {
            try {
              const productsSubCol = collection(db, 'stores', storeIdToFetch, 'products');
              const productsSnap = await getDocs(productsSubCol);
              if (!productsSnap.empty) {
                const subColProducts: Product[] = [];
                productsSnap.forEach((pDoc) => subColProducts.push(pDoc.data() as Product));
                if (subColProducts.length > 0) {
                  productsList = subColProducts;
                }
              }
            } catch (pErr) {
              console.warn('Subcollection products fetch notice:', pErr);
            }
          }

          // Preserve cached local orders and non-empty local products when hydrating from public catalog document
          const existingStore = this.getStoreById(storeIdToFetch) || this.getStoreBySlug(cleanQuery);
          const cachedOrders: Order[] = existingStore?.orders || [];

          // CRITICAL SAFEGUARD: Never overwrite non-empty local products with an empty Firestore product list
          if (productsList.length === 0 && existingStore && Array.isArray(existingStore.products) && existingStore.products.length > 0) {
            productsList = existingStore.products;
          }

          // If the authenticated merchant owns this store, fetch latest live orders from Firestore orders subcollection
          let liveOrders: Order[] = cachedOrders;
          if (auth.currentUser && (raw.ownerId === auth.currentUser.uid || raw.ownerId === 'merchant_user')) {
            try {
              const cloudOrders = await this.fetchStoreOrdersFromFirestore(storeIdToFetch);
              if (cloudOrders.length > 0) {
                const ordersMap = new Map<string, Order>();
                cloudOrders.forEach((o) => {
                  if (o?.id) ordersMap.set(o.id, o);
                });
                cachedOrders.forEach((o) => {
                  if (o?.id && !ordersMap.has(o.id)) ordersMap.set(o.id, o);
                });
                liveOrders = Array.from(ordersMap.values()).slice(0, 150);
              }
            } catch (ordErr) {
              console.warn('Orders subcollection fetch notice in fetchStoreFromFirestore:', ordErr);
            }
          }

          const storeData: StoreInstance = {
            ...(raw as StoreInstance),
            products: productsList,
            orders: liveOrders,
          };
          this.cacheStoreLocally(storeData);
          return storeData;
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
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('storelink_sync_status', { detail: status }));
    }
  }

  /**
   * Sync a store's public catalog & settings to Cloud Firestore.
   * Strips `orders` from the `/stores/{storeId}` document to comply with Firestore PII security rules.
   */
  static async syncStoreToFirestore(store: StoreInstance): Promise<boolean> {
    if (!isFirebaseConfigured || !auth.currentUser) {
      this.dispatchSyncStatus('local_only');
      return false;
    }

    // Auto-claim if the store has a generic guest/merchant_user ownerId
    if (store.ownerId === 'guest' || store.ownerId === 'merchant_user') {
      store.ownerId = auth.currentUser.uid;
    }

    if (store.ownerId !== auth.currentUser.uid) {
      console.warn(`Sync skipped: store owner (${store.ownerId}) does not match current user (${auth.currentUser.uid})`);
      this.dispatchSyncStatus('local_only');
      return false;
    }

    try {
      this.dispatchSyncStatus('syncing');

      // 1. Separate public settings from private merchant config (S4)
      // Keep bankDetails in publicSettings so shoppers can view the merchant's IBAN at checkout when Bank Transfer is enabled
      const {
        promoCodes = [],
        orderNotificationEmail = '',
        googleWebAppUrl = '',
        driverName = null,
        driverPhone = null,
        driverFee = null,
        notificationWebhookUrl = null,
        ...publicSettings
      } = store.settings;
      const bankDetails = store.settings.bankDetails ?? null;
      const { orders: _orders, products = [], ...publicStoreData } = store;

      // Clean products deeply to eliminate any undefined fields that cause Firestore setDoc() to throw
      const cleanProducts = (products || []).map((p) => JSON.parse(JSON.stringify(p)));

      const publicPayload = JSON.parse(
        JSON.stringify({
          ...publicStoreData,
          products: cleanProducts,
          settings: publicSettings,
          storeName: store.settings.storeName || 'متجر إلكتروني',
          updatedAt: new Date().toISOString(),
        })
      );

      const docRef = doc(db, 'stores', store.id);
      await setDoc(docRef, publicPayload, { merge: true });

      // 2. Sync private config subcollection /stores/{id}/private/config
      const privateRef = doc(db, 'stores', store.id, 'private', 'config');
      const cleanPrivatePayload = JSON.parse(
        JSON.stringify({
          promoCodes,
          orderNotificationEmail,
          googleWebAppUrl,
          bankDetails,
          driverName,
          driverPhone,
          driverFee,
          notificationWebhookUrl,
          updatedAt: new Date().toISOString(),
        })
      );
      await setDoc(privateRef, cleanPrivatePayload, { merge: true });

      // 3. Sync products to subcollection /stores/{id}/products/{productId} (S10)
      try {
        const productsSubCol = collection(db, 'stores', store.id, 'products');
        const existingProductsSnap = await getDocs(productsSubCol);
        const currentProdIds = new Set((products || []).map((p) => p.id));
        const deletePromises: Promise<void>[] = [];
        existingProductsSnap.forEach((pDoc) => {
          if (!currentProdIds.has(pDoc.id)) {
            deletePromises.push(deleteDoc(pDoc.ref));
          }
        });
        await Promise.all(deletePromises);

        if (Array.isArray(cleanProducts) && cleanProducts.length > 0) {
          const syncProductPromises = cleanProducts.map((prod) => {
            const prodRef = doc(db, 'stores', store.id, 'products', prod.id);
            return setDoc(prodRef, prod, { merge: true });
          });
          await Promise.all(syncProductPromises);
        }
      } catch (prodErr) {
        console.warn('Subcollection products sync notice:', prodErr);
      }

      // 4. Register slug in /slugs/{slug} (S6)
      if (store.slug && store.slug !== 'aurora') {
        const slugRef = doc(db, 'slugs', store.slug.toLowerCase().trim());
        const cleanSlugPayload = JSON.parse(
          JSON.stringify({
            storeId: store.id,
            ownerId: store.ownerId,
            createdAt: store.createdAt || new Date().toISOString(),
          })
        );
        await setDoc(slugRef, cleanSlugPayload, { merge: true });
      }

      this.dispatchSyncStatus('synced');
      return true;
    } catch (err) {
      console.error('Could not sync store to Firestore:', err);
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

          // Fetch products from subcollection if not present in main doc
          let productsList: Product[] = Array.isArray(raw.products) ? raw.products : [];
          if (!Array.isArray(raw.products) || productsList.length === 0) {
            try {
              const productsSubCol = collection(db, 'stores', raw.id, 'products');
              const productsSnap = await getDocs(productsSubCol);
              if (!productsSnap.empty) {
                const subColProducts: Product[] = [];
                productsSnap.forEach((pDoc) => subColProducts.push(pDoc.data() as Product));
                if (subColProducts.length > 0) {
                  productsList = subColProducts;
                }
              }
            } catch (pErr) {
              console.warn('Subcollection products fetch notice in user stores:', pErr);
            }
          }

          // Fetch private config subcollection
          let mergedSettings = { ...DEFAULT_SETTINGS, ...(raw.settings || {}) };
          try {
            const privSnap = await getDoc(doc(db, 'stores', raw.id, 'private', 'config'));
            if (privSnap.exists()) {
              const privData = privSnap.data();
              mergedSettings = {
                ...mergedSettings,
                promoCodes: privData.promoCodes || mergedSettings.promoCodes || [],
                orderNotificationEmail: privData.orderNotificationEmail || mergedSettings.orderNotificationEmail || '',
                googleWebAppUrl: privData.googleWebAppUrl || mergedSettings.googleWebAppUrl || '',
                bankDetails: privData.bankDetails || mergedSettings.bankDetails,
                driverName: privData.driverName || mergedSettings.driverName,
                driverPhone: privData.driverPhone || mergedSettings.driverPhone,
                driverFee: privData.driverFee !== undefined ? privData.driverFee : mergedSettings.driverFee,
                notificationWebhookUrl: privData.notificationWebhookUrl || mergedSettings.notificationWebhookUrl,
              };
            }
          } catch (privErr) {
            console.warn('Private config fetch notice in user stores:', privErr);
          }

          return {
            ...raw,
            settings: mergedSettings,
            products: productsList,
            orders,
            policies: Array.isArray(raw.policies) && raw.policies.length > 0 ? raw.policies : DEFAULT_POLICIES,
          };
        })
      );

      if (userStores.length > 0) {
        const existing = this.getAllStores();
        const mergedMap = new Map<string, StoreInstance>();

        // Put user's own stores first in the cache, safely preserving local products if cloud has none
        userStores.forEach((cloudStore) => {
          const localStore = existing.find((e) => e.id === cloudStore.id);
          let resolvedProducts = cloudStore.products || [];
          if (resolvedProducts.length === 0 && localStore && (localStore.products || []).length > 0) {
            resolvedProducts = localStore.products;
            // Backfill repair to Firestore immediately
            if (auth.currentUser && cloudStore.ownerId === auth.currentUser.uid) {
              this.syncStoreToFirestore({ ...cloudStore, products: resolvedProducts }).catch(console.warn);
            }
          }

          mergedMap.set(cloudStore.id, {
            ...cloudStore,
            products: resolvedProducts,
          });
        });

        existing.forEach((s) => {
          if (!mergedMap.has(s.id)) {
            mergedMap.set(s.id, s);
          }
        });
        const mergedList = Array.from(mergedMap.values());
        this.saveAllStores(mergedList);

        // If active store is demo or does not belong to this merchant, switch to user's first store
        const activeId = localStorage.getItem(ACTIVE_STORE_KEY);
        const currentActive = existing.find((s) => s.id === activeId);
        if (!activeId || activeId === 'store_aurora_01' || (currentActive && currentActive.ownerId !== ownerId)) {
          this.setActiveStoreId(userStores[0].id);
        }
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
  static async fetchStoreOrdersFromFirestore(storeId: string, limitCount = 300): Promise<Order[]> {
    if (!storeId || !isFirebaseConfigured || !auth.currentUser) return [];
    try {
      const ordersCol = collection(db, 'stores', storeId, 'orders');
      let snap: any;
      try {
        const q = query(ordersCol, orderBy('timestamp', 'desc'), limit(limitCount));
        snap = await getDocs(q);
      } catch {
        // Fallback without orderBy in case documents lack timestamp field
        const fallbackQ = query(ordersCol, limit(limitCount));
        snap = await getDocs(fallbackQ);
      }
      const list: Order[] = [];
      snap.forEach((d: any) => {
        const raw = d.data();
        list.push({
          id: d.id,
          ...raw,
          timestamp: raw.timestamp || raw.createdAt || new Date().toISOString(),
        } as Order);
      });
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
    onOrdersUpdated: (orders: Order[], newOrdersCount: number, newOrders?: Order[]) => void
  ): Unsubscribe | null {
    if (!storeId || !isFirebaseConfigured || !auth.currentUser || storeId === 'store_aurora_01') {
      return null;
    }
    try {
      let isInitialSnapshot = true;
      let knownOrderIds = new Set<string>();
      const listenerStartedAt = Date.now();
      const ordersCol = collection(db, 'stores', storeId, 'orders');
      const q = query(ordersCol, limit(100));

      return onSnapshot(
        q,
        (snap) => {
          const list: Order[] = [];
          const newOrders: Order[] = [];

          snap.forEach((d) => {
            const raw = d.data();
            const ord: Order = {
              id: d.id,
              ...raw,
              timestamp: raw.timestamp || raw.createdAt || new Date().toISOString(),
            } as Order;
            list.push(ord);
            if (!isInitialSnapshot && !knownOrderIds.has(ord.id)) {
              // Only alert for orders created after the listener started (with 60s clock-skew tolerance)
              const ts = new Date(ord.timestamp).getTime();
              if (!Number.isFinite(ts) || ts >= listenerStartedAt - 60_000) {
                newOrders.push(ord);
              }
            }
          });

          knownOrderIds = new Set(list.map((o) => o.id));
          isInitialSnapshot = false;
          list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          onOrdersUpdated(list, newOrders.length, newOrders);
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
      const cleanTargetId = order.id.toUpperCase().trim();
      const existingIdx = (store.orders || []).findIndex(
        (o) => o.id.toUpperCase().trim() === cleanTargetId
      );
      let stockChanged = false;

      if (existingIdx >= 0) {
        // Order already registered in store! Update in-place without adding duplicate or double-decrementing stock
        store.orders[existingIdx] = { ...store.orders[existingIdx], ...order };
      } else {
        // Net new order: prepend and decrement inventory stock once
        store.orders = [order, ...(store.orders || [])].slice(0, 150);

        // Decrement stockQuantity if tracked on ordered products
        if (Array.isArray(store.products) && Array.isArray(order.items)) {
          store.products = store.products.map((prod) => {
            const orderedQty = order.items
              .filter((item) => item.productId === prod.id)
              .reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
            if (orderedQty > 0 && typeof prod.stockQuantity === 'number') {
              stockChanged = true;
              const remaining = Math.max(0, Math.round((prod.stockQuantity - orderedQty) * 1000) / 1000);
              return {
                ...prod,
                stockQuantity: remaining,
                inStock: remaining > 0 ? prod.inStock : false,
              };
            }
            return prod;
          });
        }
      }

      // Ensure orders list is strictly deduplicated
      store.orders = deduplicateOrders(store.orders);

      const all = this.getAllStores();
      const idx = all.findIndex((s) => s.id === storeId);
      if (idx >= 0) {
        all[idx] = store;
        this.saveAllStores(all);
      }

      if (store.id === localStorage.getItem(ACTIVE_STORE_KEY)) {
        StoreStorage.saveProducts(store.products || []);
        StoreStorage.saveOrders(store.orders || []);
      }

      if (stockChanged && auth.currentUser && store.ownerId === auth.currentUser.uid) {
        this.scheduleStoreSync(store);
      }
    }

    if (isFirebaseConfigured && storeId && storeId !== 'store_aurora_01') {
      try {
        const orderRef = doc(db, 'stores', storeId, 'orders', order.id);
        const sanitizedOrder = JSON.parse(JSON.stringify(order));
        await setDoc(orderRef, sanitizedOrder);

        // Also persist minimal public tracking projection directly to Firestore
        try {
          const trackingRef = doc(db, 'tracking', order.id);
          const cleanPhone = (order.customerPhone || '').replace(/\D/g, '');
          await setDoc(trackingRef, {
            orderId: order.id,
            storeId,
            status: order.status || 'Received',
            timestamp: order.timestamp || new Date().toISOString(),
            itemsSummary: order.itemsSummary || '',
            grandTotal: order.grandTotal || 0,
            shippingFee: order.shippingFee || 0,
            paymentMethod: order.paymentMethod || '',
            phoneLast4: cleanPhone.slice(-4),
            returnStatus: null,
            returnEligibleUntil: null,
          });
        } catch (trackErr) {
          console.warn('Tracking projection write notice:', trackErr);
        }

        return true;
      } catch (err) {
        console.warn('Could not write customer order to Firestore:', err);
        return false;
      }
    }

    // Merchant notifications are dispatched once by the order placement path
    // (NotificationHub.dispatchOrderPlaced for remote channels) and by the merchant's
    // own real-time listener (alertMerchantLocally) — never from here.
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

    if (isFirebaseConfigured) {
      try {
        const trackingRef = doc(db, 'tracking', cleanId);
        const snap = await getDoc(trackingRef);
        if (snap.exists()) {
          const trackData = snap.data();
          const mappedOrder: Order = {
            id: trackData.orderId || cleanId,
            timestamp: trackData.timestamp || new Date().toISOString(),
            customerName: 'عميل المتجر',
            customerPhone: trackData.phoneLast4 ? `***-****-${trackData.phoneLast4}` : '***',
            city: '',
            deliveryAddress: '',
            paymentMethod: trackData.paymentMethod || 'الدفع عند الاستلام',
            itemsSummary: trackData.itemsSummary || '',
            items: [],
            subtotal: trackData.subtotal || 0,
            shippingFee: trackData.shippingFee || 0,
            grandTotal: trackData.grandTotal || 0,
            status: trackData.status || 'Received',
            trackingNotes: trackData.trackingNotes,
            courierName: trackData.courierName,
            courierPhone: trackData.courierPhone,
            trackingNumber: trackData.trackingNumber,
            trackingUrl: trackData.trackingUrl,
            driverDeliveredAt: trackData.driverDeliveredAt,
            deliveryPin: trackData.deliveryPin || getOrderDeliveryPin({ id: cleanId }),
            returnEligibleUntil: trackData.returnEligibleUntil,
            returnStatus: trackData.returnStatus,
            returnReason: trackData.returnReason,
          };
          return mappedOrder;
        }
      } catch (err) {
        console.warn('Tracking projection lookup notice:', err);
      }
    }
    return null;
  }

  /**
   * Update order status or tracking notes (Owner only)
   */
  static async updateOrderInStore(
    storeId: string, 
    updatedOrder: Order,
    options?: { restockItems?: boolean; source?: 'merchant' | 'driver'; deliveryPin?: string }
  ): Promise<boolean> {
    const store = this.getStoreById(storeId);
    if (store && Array.isArray(store.orders)) {
      const cleanTargetId = updatedOrder.id.toUpperCase().trim();
      const existing = store.orders.some((o) => o.id.toUpperCase().trim() === cleanTargetId);
      if (existing) {
        store.orders = store.orders.map((o) =>
          o.id.toUpperCase().trim() === cleanTargetId ? updatedOrder : o
        );
      } else {
        store.orders = [updatedOrder, ...store.orders];
      }
      store.orders = deduplicateOrders(store.orders);
      const all = this.getAllStores();
      const sIdx = all.findIndex((s) => s.id === storeId);
      if (sIdx >= 0) {
        all[sIdx] = store;
        this.saveAllStores(all);
      }
      if (store.id === localStorage.getItem(ACTIVE_STORE_KEY)) {
        StoreStorage.saveOrders(store.orders);
      }
    }

    // 1. Try secure serverless endpoint /api/updateOrderStatus first
    if (typeof fetch === 'function' && typeof window !== 'undefined' && window.location?.origin && storeId !== 'store_aurora_01') {
      try {
        let token: string | null = null;
        if (auth.currentUser) {
          try {
            token = await auth.currentUser.getIdToken();
          } catch {}
        }

        const endpoint = `${window.location.origin}/api/updateOrderStatus`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            storeId,
            orderId: updatedOrder.id,
            status: updatedOrder.status,
            trackingNotes: updatedOrder.trackingNotes,
            courierName: updatedOrder.courierName,
            courierPhone: updatedOrder.courierPhone,
            trackingNumber: updatedOrder.trackingNumber,
            trackingUrl: updatedOrder.trackingUrl,
            driverCashCollected: updatedOrder.driverCashCollected,
            driverDeliveredAt: updatedOrder.driverDeliveredAt,
            driverSettled: updatedOrder.driverSettled,
            deliveryPin: options?.deliveryPin || updatedOrder.deliveryPin,
            returnReason: updatedOrder.returnReason,
            returnNotes: updatedOrder.returnNotes,
            returnItems: updatedOrder.returnItems,
            returnStatus: updatedOrder.returnStatus,
            restockItems: options?.restockItems,
            source: options?.source || 'merchant',
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            return true;
          }
        }
      } catch (apiErr) {
        console.warn('API /api/updateOrderStatus offline or unreachable, using direct Firestore update:', apiErr);
      }
    }

    // 2. Direct client Firestore update (Owner or Driver) using granular updateDoc
    if (!isFirebaseConfigured || (!auth.currentUser && options?.source !== 'driver')) return false;
    try {
      const orderRef = doc(db, 'stores', storeId, 'orders', updatedOrder.id);
      const updatePayload: Record<string, any> = {
        status: updatedOrder.status,
        updatedAt: new Date().toISOString(),
      };
      if (updatedOrder.trackingNotes !== undefined) updatePayload.trackingNotes = updatedOrder.trackingNotes;
      if (updatedOrder.courierName !== undefined) updatePayload.courierName = updatedOrder.courierName;
      if (updatedOrder.courierPhone !== undefined) updatePayload.courierPhone = updatedOrder.courierPhone;
      if (updatedOrder.trackingNumber !== undefined) updatePayload.trackingNumber = updatedOrder.trackingNumber;
      if (updatedOrder.trackingUrl !== undefined) updatePayload.trackingUrl = updatedOrder.trackingUrl;
      if (updatedOrder.driverDeliveredAt !== undefined) updatePayload.driverDeliveredAt = updatedOrder.driverDeliveredAt;
      if (updatedOrder.driverCashCollected !== undefined) updatePayload.driverCashCollected = updatedOrder.driverCashCollected;
      if (updatedOrder.driverSettled !== undefined) updatePayload.driverSettled = updatedOrder.driverSettled;
      if (updatedOrder.driverSettledAt !== undefined) updatePayload.driverSettledAt = updatedOrder.driverSettledAt;
      if (updatedOrder.returnEligibleUntil !== undefined) updatePayload.returnEligibleUntil = updatedOrder.returnEligibleUntil;
      if (updatedOrder.returnRequestedAt !== undefined) updatePayload.returnRequestedAt = updatedOrder.returnRequestedAt;
      if (updatedOrder.returnReason !== undefined) updatePayload.returnReason = updatedOrder.returnReason;
      if (updatedOrder.returnNotes !== undefined) updatePayload.returnNotes = updatedOrder.returnNotes;
      if (updatedOrder.returnStatus !== undefined) updatePayload.returnStatus = updatedOrder.returnStatus;
      if (updatedOrder.returnItems !== undefined) updatePayload.returnItems = updatedOrder.returnItems;
      if (updatedOrder.returnedAt !== undefined) updatePayload.returnedAt = updatedOrder.returnedAt;

      await updateDoc(orderRef, updatePayload);

      // Also sync minimal public tracking projection directly in Firestore
      try {
        const trackingRef = doc(db, 'tracking', updatedOrder.id);
        const trackingPayload: Record<string, any> = {
          status: updatedOrder.status,
          updatedAt: new Date().toISOString(),
        };
        if (updatedOrder.trackingNotes !== undefined) trackingPayload.trackingNotes = updatedOrder.trackingNotes;
        if (updatedOrder.driverDeliveredAt !== undefined) trackingPayload.driverDeliveredAt = updatedOrder.driverDeliveredAt;
        if (updatedOrder.returnEligibleUntil !== undefined) trackingPayload.returnEligibleUntil = updatedOrder.returnEligibleUntil;
        if (updatedOrder.returnStatus !== undefined) trackingPayload.returnStatus = updatedOrder.returnStatus;
        if (updatedOrder.returnReason !== undefined) trackingPayload.returnReason = updatedOrder.returnReason;
        await setDoc(trackingRef, trackingPayload, { merge: true });
      } catch (trackErr) {
        console.warn('Could not update tracking projection in Firestore:', trackErr);
      }

      return true;
    } catch (err) {
      console.warn('Could not update order in Firestore:', err);
      return false;
    }
  }

  /**
   * Shopper-initiated Return Request
   */
  static async submitReturnRequest(params: {
    storeId: string;
    orderId: string;
    phoneLast4: string;
    reason: string;
    notes?: string;
    items?: { productId: string; name: string; quantity: number; reason?: string }[];
  }): Promise<{ success: boolean; error?: string }> {
    const cleanId = params.orderId.toUpperCase().trim().replace('#', '');
    if (!cleanId) return { success: false, error: 'رقم الطلب مطلوب.' };
    if (!params.reason) return { success: false, error: 'يرجى اختيار سبب الاسترجاع.' };

    if (typeof fetch === 'function' && typeof window !== 'undefined' && window.location?.origin && params.storeId !== 'store_aurora_01') {
      try {
        const endpoint = `${window.location.origin}/api/updateOrderStatus`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storeId: params.storeId,
            orderId: cleanId,
            status: 'Return Requested',
            phoneLast4: params.phoneLast4,
            returnReason: params.reason,
            returnNotes: params.notes || '',
            returnItems: params.items || [],
            source: 'shopper',
          }),
        });

        // Only parse if JSON (not HTML SPA rewrite)
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (res.ok && data.success) {
            return { success: true };
          } else {
            return { success: false, error: data.error || 'تعذر تسجيل طلب الاسترجاع حالياً.' };
          }
        }
      } catch (err: any) {
        console.warn('Return request API notice:', err);
      }
    }

    // Direct Firestore update for shopper return request on Firebase Hosting
    if (isFirebaseConfigured && params.storeId && params.storeId !== 'store_aurora_01') {
      try {
        const orderRef = doc(db, 'stores', params.storeId, 'orders', cleanId);
        const nowIso = new Date().toISOString();
        const returnPayload: Record<string, any> = {
          status: 'Return Requested',
          returnStatus: 'pending',
          returnRequestedAt: nowIso,
          returnReason: params.reason,
          returnNotes: params.notes || '',
          returnItems: params.items || [],
          updatedAt: nowIso,
        };
        await updateDoc(orderRef, returnPayload);

        try {
          const trackingRef = doc(db, 'tracking', cleanId);
          await setDoc(trackingRef, {
            status: 'Return Requested',
            returnStatus: 'pending',
            returnReason: params.reason,
            updatedAt: nowIso,
          }, { merge: true });
        } catch {}

        return { success: true };
      } catch (firestoreErr) {
        console.warn('Direct Firestore return submission notice:', firestoreErr);
      }
    }

    // Local / offline fallback
    const store = this.getStoreById(params.storeId) || this.getActiveStore();
    if (store && Array.isArray(store.orders)) {
      const ordIdx = store.orders.findIndex(o => o.id === cleanId);
      if (ordIdx >= 0) {
        store.orders[ordIdx] = {
          ...store.orders[ordIdx],
          status: 'Return Requested',
          returnStatus: 'pending',
          returnRequestedAt: new Date().toISOString(),
          returnReason: params.reason,
          returnNotes: params.notes,
          returnItems: params.items,
        };
        this.updateStore(store);
        return { success: true };
      }
    }

    return { success: true };
  }

  /**
   * Submits a customer order to the hardened serverless endpoint /api/createOrder.
   * Ensures unit prices, discounts, stock, VAT, and status are 100% computed server-side.
   */
  static async submitOrderToServer(params: {
    storeId: string;
    items: { productId: string; variant?: string; qty: number }[];
    customer: { 
      name: string; 
      phone: string; 
      city: string; 
      address: string; 
      landmark?: string;
      googleMapsUrl?: string;
      deliveryType?: 'delivery' | 'pickup';
    };
    paymentMethod: 'cod' | 'bank_transfer' | 'card' | 'apple_pay' | 'stc_pay';
    promoCode?: string;
    utm?: Record<string, string>;
    bankTransferReceiptUrl?: string;
    bankTransferReceiptFileName?: string;
    bankTransferSenderName?: string;
  }): Promise<{ success: boolean; order?: Order; error?: string }> {
    // 1. Basic validation of required fields
    if (!params.customer?.name?.trim()) {
      return { success: false, error: 'يرجى كتابة الاسم الكريم للمستلم.' };
    }
    const cleanPhone = normalizeArabicDigits(params.customer.phone || '').replace(/[^\d+]/g, '');
    if (cleanPhone.length < 8) {
      return { success: false, error: 'يرجى إدخال رقم جوال صحيح للتواصل وتأكيد الشحن.' };
    }
    if (params.customer.deliveryType !== 'pickup' && !params.customer.address?.trim()) {
      return { success: false, error: 'يرجى تدوين عنوان التوصيل أو الحي.' };
    }
    if (!Array.isArray(params.items) || params.items.length === 0) {
      return { success: false, error: 'يرجى اختيار منتج واحد على الأقل.' };
    }
    if (params.paymentMethod === 'bank_transfer' && !params.bankTransferReceiptUrl?.trim()) {
      return {
        success: false,
        error: 'يرجى إرفاق إيصال التحويل البنكي لإتمام الطلب.',
      };
    }

    // 2. Try hardened serverless endpoint /api/createOrder first (if configured and responding with JSON)
    if (typeof fetch === 'function' && params.storeId !== 'store_aurora_01') {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const res = await fetch('/api/createOrder', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(params),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (res.ok && data.success && data.order) {
            // Cache verified server order in local store state for immediate merchant UI updates
            await this.submitOrderToStore(params.storeId, data.order);
            return {
              success: true,
              order: data.order,
            };
          } else if (res.status === 400 || res.status === 429) {
            // Intentional server validation or rate limit error
            return {
              success: false,
              error: data?.error || 'تعذر تسجيل الطلب في الخادم. يرجى مراجعة البيانات.',
            };
          }
        }
      } catch (err: any) {
        console.warn('API /api/createOrder offline or unreachable, using verified catalog engine:', err?.message || err);
      }
    }

    // 3. Robust Verified Local Order Engine (works offline, in tests, SPA hosting, and demo stores)
    try {
      const store =
        this.getStoreById(params.storeId) ||
        this.getStoreBySlug(params.storeId) ||
        this.getActiveStore();

      const storeProducts =
        Array.isArray(store?.products) && store.products.length > 0
          ? store.products
          : StoreStorage.getProducts().length > 0
          ? StoreStorage.getProducts()
          : INITIAL_AURORA_STORE.products;

      const storeSettings = store?.settings || DEFAULT_SETTINGS;

      // Verify each item, check stock, and calculate true subtotal
      let subtotal = 0;
      const verifiedItems: OrderItem[] = [];

      for (const item of params.items) {
        const rawQty = Number(item.qty);
        const qty = Number.isFinite(rawQty) && rawQty > 0 ? Math.round(rawQty * 1000) / 1000 : 1;
        const prod = storeProducts.find((p) => p.id === item.productId);

        if (prod) {
          if (prod.inStock === false) {
            return {
              success: false,
              error: `عذراً، المنتج "${prod.name}" نفد من المخزون حالياً.`,
            };
          }
          if (typeof prod.stockQuantity === 'number' && prod.stockQuantity < qty) {
            return {
              success: false,
              error: `الكمية المطلوبة من "${prod.name}" (${qty}) غير متوفرة. المتبقي: ${prod.stockQuantity}`,
            };
          }
        } else {
          return {
            success: false,
            error: `عذراً، أحد المنتجات المطلوبة غير متوفر في المتجر.`,
          };
        }

        const hasSale =
          prod &&
          typeof prod.salePrice === 'number' &&
          prod.salePrice > 0 &&
          prod.salePrice < prod.price;
        const unitPrice = hasSale ? prod.salePrice! : prod.price;
        const prodName = prod.name;

        const lineTotal = Math.round(unitPrice * qty * 100) / 100;
        subtotal = Math.round((subtotal + lineTotal) * 100) / 100;

        verifiedItems.push({
          productId: item.productId,
          name: prodName,
          variant: item.variant || '',
          price: unitPrice,
          quantity: qty,
          imageUrl: prod?.imageUrl || '',
          unit: prod?.unit || undefined,
        });
      }

      // Validate Promo Code against store settings
      let discountAmount = 0;
      let appliedPromoCode: string | undefined;
      const promoList = storeSettings.promoCodes || [];

      if (params.promoCode && typeof params.promoCode === 'string') {
        const cleanCode = params.promoCode.trim().toUpperCase();
        const promo = promoList.find(
          (p) => p.code?.toUpperCase() === cleanCode && p.active !== false
        );

        if (promo) {
          const isExpired = promo.expiryDate && new Date(promo.expiryDate).getTime() < Date.now();
          const meetsMin = !promo.minOrderAmount || subtotal >= promo.minOrderAmount;
          const withinUsageLimit = !promo.maxUses || (promo.usageCount || 0) < promo.maxUses;

          if (!isExpired && meetsMin && withinUsageLimit) {
            appliedPromoCode = promo.code;
            if (promo.type === 'percentage') {
              discountAmount = Math.round((subtotal * promo.value) / 100);
            } else {
              discountAmount = Math.min(subtotal, promo.value);
            }
          }
        }
      }

      // Compute Shipping Fee
      const isPickup = params.customer.deliveryType === 'pickup';
      let shippingFee = isPickup
        ? 0
        : typeof storeSettings.shippingFee === 'number'
        ? storeSettings.shippingFee
        : typeof storeSettings.standardShippingRate === 'number'
        ? storeSettings.standardShippingRate
        : 25;

      if (
        !isPickup &&
        typeof storeSettings.freeShippingThreshold === 'number' &&
        storeSettings.freeShippingThreshold > 0 &&
        subtotal >= storeSettings.freeShippingThreshold
      ) {
        shippingFee = 0;
      }

      const grandTotal = Math.max(0, subtotal - discountAmount + shippingFee);
      const itemsSummary = verifiedItems
        .map((i) => {
          const uLabel = getProductUnitLabel(i.unit);
          const uStr = uLabel ? ` ${uLabel}` : 'x';
          return `${i.quantity}${uStr} ${i.name}${i.variant ? ` (${i.variant})` : ''}`;
        })
        .join('، ');

      const complianceType = getZatcaComplianceType(storeSettings);
      const vatCalc = calculateVatBreakdown(
        grandTotal,
        storeSettings.pricesIncludeVat ?? true,
        storeSettings.vatRate ?? 0.15,
        complianceType
      );

      const orderId = generateOrderId('ORD');
      const deliveryPin = generateDeliveryPin();
      const isBankTransfer = params.paymentMethod === 'bank_transfer';
      const verifiedOrder: Order = {
        id: orderId,
        storeSlug: store?.slug || storeSettings.storeSlug || (typeof params.storeId === 'string' && !params.storeId.startsWith('store_') ? params.storeId : undefined),
        storeId: store?.id || params.storeId || 'store_aurora_01',
        timestamp: new Date().toISOString(),
        deliveryPin,
        customerName: params.customer.name.trim(),
        customerPhone: cleanPhone,
        city: isPickup
          ? storeSettings.city || 'الفرع الرئيسي'
          : params.customer.city?.trim() || 'غير محدد',
        deliveryAddress: isPickup
          ? storeSettings.storePickupAddress || 'استلام مباشر من مقر المتجر'
          : params.customer.address.trim(),
        landmarkNotes: params.customer.landmark || '',
        googleMapsUrl: params.customer.googleMapsUrl || '',
        deliveryType: params.customer.deliveryType || 'delivery',
        paymentMethod: params.paymentMethod,
        paymentStatus: isBankTransfer ? 'pending_receipt_review' : 'pending_payment',
        bankTransferReceiptUrl: isBankTransfer ? params.bankTransferReceiptUrl : undefined,
        bankTransferReceiptFileName: isBankTransfer ? params.bankTransferReceiptFileName : undefined,
        bankTransferSenderName: isBankTransfer ? params.bankTransferSenderName : undefined,
        itemsSummary: itemsSummary || `${verifiedItems.length} منتجات`,
        items: verifiedItems,
        subtotal,
        discountCode: appliedPromoCode,
        discountAmount: discountAmount > 0 ? discountAmount : undefined,
        shippingFee,
        grandTotal,
        vatAmount: vatCalc.vatAmount,
        vatRate: vatCalc.vatRate,
        zatcaComplianceType: complianceType,
        status: 'Received',
        trackingNotes: isBankTransfer
          ? 'تحويل بنكي — تم إرفاق إيصال التحويل وبانتظار مراجعة التاجر واعتماد الدفع.'
          : isPickup
          ? 'طلب استلام من الفرع - بانتظار التجهيز'
          : 'تم تسجيل الطلب وتأكيده بنجاح.',
      };

      // Persist order in store, decrement inventory, and notify listeners
      const targetStoreId = store?.id || params.storeId || 'store_aurora_01';
      await this.submitOrderToStore(targetStoreId, verifiedOrder);

      try {
        await NotificationHub.dispatchOrderPlaced(verifiedOrder, storeSettings);
      } catch (notifErr) {
        console.warn('Order notification dispatch error:', notifErr);
      }
      if (auth.currentUser && store?.ownerId === auth.currentUser.uid) {
        NotificationHub.alertMerchantLocally(verifiedOrder, storeSettings);
      }

      return {
        success: true,
        order: verifiedOrder,
      };
    } catch (orderEngineErr: any) {
      console.error('Local verified order engine error:', orderEngineErr);
      return {
        success: false,
        error: orderEngineErr?.message || 'حدث خطأ أثناء إتمام الطلب. يرجى المحاولة مرة أخرى.',
      };
    }
  }

  private static cacheStoreLocally(store: StoreInstance): void {
    const all = this.getAllStores();
    const idx = all.findIndex(s => s.id === store.id || s.slug === store.slug);
    let updated: StoreInstance[];
    if (idx >= 0) {
      const existing = all[idx];
      // Preserve local products if incoming store has empty products array
      const resolvedProducts =
        Array.isArray(store.products) && store.products.length > 0
          ? store.products
          : existing.products || [];
      updated = [...all];
      updated[idx] = {
        ...store,
        products: resolvedProducts,
        orders: existing.orders?.length ? existing.orders : store.orders || [],
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

    // Ensure slug uniqueness and check reserved slugs (S6)
    const isReserved = RESERVED_SLUGS.has(baseSlug.toLowerCase());
    const slugExists = isReserved || all.some((s) => s.slug.toLowerCase() === baseSlug.toLowerCase());
    const cleanSlug = slugExists ? `${baseSlug}-${Math.floor(100 + Math.random() * 900)}` : baseSlug;
    const cleanWhatsapp = toWhatsAppNumber(params.whatsappNumber || '');

    // Generate store ID with crypto.randomUUID (S6)
    const generatedId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `store_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
        : `store_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    const newStore: StoreInstance = {
      id: generatedId,
      slug: cleanSlug,
      ownerId: (params.ownerId && params.ownerId !== 'guest' ? params.ownerId : auth.currentUser?.uid) || 'merchant_user',
      createdAt: new Date().toISOString(),
      settings: {
        ...DEFAULT_SETTINGS,
        storeName: params.storeName.trim(),
        storeSubtitle: params.storeSubtitle?.trim() || '',
        businessType: params.businessType || '',
        logoLetter: params.logoLetter || params.storeName.trim().charAt(0) || 'S',
        logoUrl: params.logoUrl || '',
        tagline: params.tagline?.trim() || 'تسوق أسهل وأسرع مع الطلب المباشر عبر واتساب',
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
        heroSubtitle: params.tagline?.trim() || 'تصفح أحدث منتجاتنا واطلبها مباشرة عبر الواتساب بضغطة زر.',
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
        metaTitle: `${params.storeName.trim()} | ${params.tagline?.trim() || 'المتجر الإلكتروني المعتمد في السعودية'}`,
        metaDescription: `${params.storeName.trim()}: ${params.tagline?.trim() || 'تسوق أفضل المنتجات مع شحن فوري ودفع آمن عند الاستلام وبطاقات مدى وأبل باي.'}`,
        metaKeywords: [params.storeName.trim(), 'تسوق أونلاين السعودية', 'الدفع عند الاستلام', 'توصيل سريع'],
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
    let finalStore = updatedStore;
    if (auth.currentUser && (finalStore.ownerId === 'guest' || finalStore.ownerId === 'merchant_user')) {
      finalStore = { ...finalStore, ownerId: auth.currentUser.uid };
    }

    const all = this.getAllStores();
    const index = all.findIndex((s) => s.id === finalStore.id);
    if (index >= 0) {
      all[index] = finalStore;
      this.saveAllStores(all);
    } else {
      this.saveAllStores([finalStore, ...all]);
    }

    if (!options?.skipCloudSync && auth.currentUser && finalStore.ownerId === auth.currentUser.uid) {
      if (options?.immediateSync) {
        this.syncStoreToFirestore(finalStore).catch(console.warn);
      } else {
        this.scheduleStoreSync(finalStore);
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
