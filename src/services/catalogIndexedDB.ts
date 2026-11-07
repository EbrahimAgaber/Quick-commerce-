import { Product } from '../types/store';

const DB_NAME = 'quick_ecommerce_idb';
const DB_VERSION = 1;
const STORE_PRODUCTS = 'products_store';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported or running in non-browser environment'));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_PRODUCTS)) {
        db.createObjectStore(STORE_PRODUCTS, { keyPath: 'storeId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class LargeCatalogStorage {
  /**
   * Check if IndexedDB is available in the current environment
   */
  static isAvailable(): boolean {
    return typeof window !== 'undefined' && Boolean(window.indexedDB);
  }

  /**
   * Save a large product list associated with a storeId to IndexedDB.
   */
  static async saveStoreProducts(storeId: string, products: Product[]): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const db = await openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_PRODUCTS], 'readwrite');
        const store = tx.objectStore(STORE_PRODUCTS);
        const req = store.put({ storeId, products, updatedAt: new Date().toISOString() });
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return false;
    }
  }

  /**
   * Retrieve products associated with a storeId from IndexedDB.
   */
  static async getStoreProducts(storeId: string): Promise<Product[] | null> {
    if (!this.isAvailable()) return null;
    try {
      const db = await openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_PRODUCTS], 'readonly');
        const store = tx.objectStore(STORE_PRODUCTS);
        const req = store.get(storeId);
        req.onsuccess = () => {
          if (req.result && Array.isArray(req.result.products)) {
            resolve(req.result.products);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  }

  /**
   * Remove products cache for a specific store.
   */
  static async removeStoreProducts(storeId: string): Promise<boolean> {
    try {
      const db = await openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_PRODUCTS], 'readwrite');
        const store = tx.objectStore(STORE_PRODUCTS);
        const req = store.delete(storeId);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return false;
    }
  }
}
