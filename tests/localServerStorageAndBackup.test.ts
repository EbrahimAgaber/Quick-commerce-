import { describe, it, expect, beforeEach } from 'vitest';
import { StoreManager, generateUniqueProductId } from '../src/services/storeManager';
import { StoreStorage } from '../src/services/storeStorage';
import {
  ensureStorageDirectories,
  persistBase64ImageToDisk,
  saveStoreOnDisk,
  readStoresFromDisk,
  STORES_DB_PATH,
  STORES_BAK_PATH,
  UPLOADS_DIR,
} from '../server';
import fs from 'fs';
import path from 'path';
import type { Product } from '../src/types/store';

// Mock localStorage in Node test environment
const storageMap = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => (storageMap.has(key) ? storageMap.get(key)! : null),
  setItem: (key: string, value: string) => {
    storageMap.set(key, String(value));
  },
  removeItem: (key: string) => {
    storageMap.delete(key);
  },
  clear: () => {
    storageMap.clear();
  },
  key: (index: number) => Array.from(storageMap.keys())[index] ?? null,
  get length() {
    return storageMap.size;
  },
};

Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('Local Server Storage Engine, Image Asset Pipeline & Multi-Product Bug Fix', () => {
  beforeEach(() => {
    storageMap.clear();
    StoreManager.resetCorruptedStorage();
    ensureStorageDirectories();
  });

  it('generates collision-resistant unique product IDs and never overwrites the first product when adding a second product', () => {
    const store = StoreManager.createStore({
      storeName: 'متجر التميز',
      ownerId: 'merchant_1',
      tagline: 'أفضل المنتجات',
      whatsappNumber: '966500000001',
      currency: 'ر.س',
      primaryColor: '#0F172A',
      accentColor: '#2563EB',
      backgroundColor: '#F8FAFC',
      logoLetter: 'ت',
      initialProducts: [],
    });

    expect(store.products).toHaveLength(0);

    // Add First Product
    const firstId = generateUniqueProductId(store.products);
    const firstProduct: Product = {
      id: firstId,
      name: 'عطر عود ملكي فاخر',
      category: 'عطور',
      price: 250,
      imageUrl: '/uploads/prod_1.webp',
      galleryImages: ['/uploads/prod_1.webp'],
      description: 'وصف المنتج الأول',
      inStock: true,
      featured: true,
      variants: ['100 مل'],
    };

    const productsAfterFirst = [...store.products, JSON.parse(JSON.stringify(firstProduct))];
    StoreStorage.saveProducts(productsAfterFirst);
    StoreManager.updateStore({ ...store, products: productsAfterFirst });

    // Add Second Product immediately (same millisecond simulation)
    const currentStore = StoreManager.getStoreById(store.id)!;
    const secondId = generateUniqueProductId(currentStore.products);
    expect(secondId).not.toBe(firstId);

    const secondProduct: Product = {
      id: secondId,
      name: 'بخور دوسري أصلي',
      category: 'بخور',
      price: 180,
      imageUrl: '/uploads/prod_2.webp',
      galleryImages: ['/uploads/prod_2.webp'],
      description: 'وصف المنتج الثاني',
      inStock: true,
      featured: false,
      variants: ['علبة كبيرة'],
    };

    const productsAfterSecond = [
      ...currentStore.products,
      JSON.parse(JSON.stringify(secondProduct)),
    ];
    StoreStorage.saveProducts(productsAfterSecond);
    StoreManager.updateStore({ ...currentStore, products: productsAfterSecond });

    const finalStore = StoreManager.getStoreById(store.id)!;
    expect(finalStore.products).toHaveLength(2);
    expect(finalStore.products[0].id).toBe(firstId);
    expect(finalStore.products[0].name).toBe('عطر عود ملكي فاخر');
    expect(finalStore.products[0].price).toBe(250);
    expect(finalStore.products[1].id).toBe(secondId);
    expect(finalStore.products[1].name).toBe('بخور دوسري أصلي');
    expect(finalStore.products[1].price).toBe(180);
  });

  it('converts Base64 image data URLs into static files in /public/uploads/ and returns /uploads/<filename>', () => {
    // 1x1 transparent PNG in Base64
    const sampleBase64 =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const urlPath = persistBase64ImageToDisk(sampleBase64, 'test_prod');
    expect(urlPath).toBeTruthy();
    expect(urlPath!.startsWith('/uploads/test_prod_')).toBe(true);
    expect(urlPath!.endsWith('.png')).toBe(true);

    const fileName = urlPath!.replace('/uploads/', '');
    const fullDiskPath = path.join(UPLOADS_DIR, fileName);
    expect(fs.existsSync(fullDiskPath)).toBe(true);
  });

  it('persists store data to /data/stores.json with automatic .bak rotation and converts embedded Base64 product images', async () => {
    const sampleBase64 =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const testStore = StoreManager.createStore({
      storeName: 'متجر السيرفر المحلي',
      ownerId: 'local_owner',
      tagline: 'تخزين محلي آمن',
      whatsappNumber: '966501112233',
      currency: 'ر.س',
      primaryColor: '#0F172A',
      accentColor: '#2563EB',
      backgroundColor: '#F8FAFC',
      logoLetter: 'س',
      initialProducts: [
        {
          id: 'prod_disk_1',
          name: 'منتج بصورة مرفوعة',
          category: 'عام',
          price: 99,
          imageUrl: sampleBase64,
          galleryImages: [sampleBase64],
          description: 'اختبار تحويل الصور تلقائياً لملفات',
          inStock: true,
          featured: false,
          variants: [],
        },
      ],
    });

    // Save first time
    const saved1 = await saveStoreOnDisk(testStore);
    expect(saved1.products[0].imageUrl.startsWith('/uploads/')).toBe(true);
    expect(fs.existsSync(STORES_DB_PATH)).toBe(true);

    // Save second time with a second product to trigger .bak rotation
    const updatedStore = {
      ...saved1,
      products: [
        ...saved1.products,
        {
          id: 'prod_disk_2',
          name: 'المنتج الثاني المحفوظ',
          category: 'عام',
          price: 149,
          imageUrl: '/uploads/second.webp',
          galleryImages: ['/uploads/second.webp'],
          description: 'المنتج الثاني',
          inStock: true,
          featured: false,
          variants: [],
        },
      ],
    };
    await saveStoreOnDisk(updatedStore);
    expect(fs.existsSync(STORES_BAK_PATH)).toBe(true);

    const diskStores = readStoresFromDisk();
    const found = diskStores.find((s) => s.id === testStore.id);
    expect(found).toBeDefined();
    expect(found!.products).toHaveLength(2);
    expect(found!.products[0].name).toBe('منتج بصورة مرفوعة');
    expect(found!.products[1].name).toBe('المنتج الثاني المحفوظ');
  });

  it('restores a store from a JSON backup in both replace and merge modes', async () => {
    const activeStore = StoreManager.createStore({
      storeName: 'متجر الاستعادة',
      ownerId: 'merchant_restore',
      tagline: 'تجربة النسخ الاحتياطي',
      whatsappNumber: '966509998877',
      currency: 'ر.س',
      primaryColor: '#0F172A',
      accentColor: '#2563EB',
      backgroundColor: '#F8FAFC',
      logoLetter: 'ا',
      initialProducts: [
        {
          id: 'prod_existing_1',
          name: 'منتج حالي 1',
          category: 'قسم 1',
          price: 120,
          imageUrl: '/uploads/ex1.webp',
          galleryImages: ['/uploads/ex1.webp'],
          description: '',
          inStock: true,
          featured: false,
          variants: [],
        },
      ],
    });

    const backupPayload = {
      backupVersion: '2.0',
      exportedAt: new Date().toISOString(),
      store: {
        ...activeStore,
        products: [
          {
            id: 'prod_backup_1',
            name: 'منتج من النسخة الاحتياطية 1',
            category: 'قسم الاحتياط',
            price: 300,
            imageUrl: '/uploads/bk1.webp',
            galleryImages: ['/uploads/bk1.webp'],
            description: 'وصف احتياطي',
            inStock: true,
            featured: true,
            variants: [],
          },
          {
            id: 'prod_backup_2',
            name: 'منتج من النسخة الاحتياطية 2',
            category: 'قسم الاحتياط',
            price: 450,
            imageUrl: '/uploads/bk2.webp',
            galleryImages: ['/uploads/bk2.webp'],
            description: 'وصف احتياطي 2',
            inStock: true,
            featured: false,
            variants: [],
          },
        ],
      },
    };

    // 1. Test Merge mode (1 existing + 2 backup = 3 products)
    const mergeRes = await StoreManager.restoreStoreFromBackup(
      backupPayload,
      'merge',
      activeStore.id
    );
    expect(mergeRes.success).toBe(true);
    expect(mergeRes.store?.products).toHaveLength(3);

    // 2. Test Replace mode (replaces with exact 2 backup products)
    const replaceRes = await StoreManager.restoreStoreFromBackup(
      backupPayload,
      'replace',
      activeStore.id
    );
    expect(replaceRes.success).toBe(true);
    expect(replaceRes.store?.products).toHaveLength(2);
    expect(replaceRes.store?.products[0].id).toBe('prod_backup_1');
    expect(replaceRes.store?.products[1].id).toBe('prod_backup_2');
  });
});
