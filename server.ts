import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import type { StoreInstance, Product } from './src/types/store';
import {
  DEFAULT_SETTINGS,
  DEFAULT_PRODUCTS,
  DEFAULT_ORDERS,
  DEFAULT_POLICIES,
} from './src/services/storeStorage';

import { serverWhatsAppManager } from './src/services/serverWhatsAppService';

export const DATA_DIR = path.resolve(process.cwd(), 'data');
export const STORES_DB_PATH = path.join(DATA_DIR, 'stores.json');
export const STORES_BAK_PATH = path.join(DATA_DIR, 'stores.json.bak');
export const UPLOADS_DIR = path.resolve(process.cwd(), 'public', 'uploads');

export const DEFAULT_AURORA_STORE_RECORD: StoreInstance = {
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

let serverMemoryStores: StoreInstance[] | null = null;
let writeQueuePromise: Promise<void> = Promise.resolve();

/**
 * Ensures /data and /public/uploads directories exist and initializes /data/stores.json if missing.
 */
export function ensureStorageDirectories(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORES_DB_PATH)) {
      const initialPayload = JSON.stringify({
        version: '2.0.0',
        updatedAt: new Date().toISOString(),
        stores: [DEFAULT_AURORA_STORE_RECORD],
      }, null, 2);
      fs.writeFileSync(STORES_DB_PATH, initialPayload, 'utf-8');
    }
  } catch (err) {
    console.warn('Notice ensuring storage directories:', err);
  }
}

/**
 * Reads all stores from /data/stores.json with automatic fallback to .bak if primary is corrupted.
 */
export function readStoresFromDisk(): StoreInstance[] {
  ensureStorageDirectories();
  if (serverMemoryStores && serverMemoryStores.length > 0) {
    return serverMemoryStores;
  }

  const tryReadFile = (filePath: string): StoreInstance[] | null => {
    try {
      if (!fs.existsSync(filePath)) return null;
      const raw = fs.readFileSync(filePath, 'utf-8');
      if (!raw.trim()) return null;
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.stores) ? parsed.stores : null;
      if (Array.isArray(list) && list.length > 0) {
        return list.filter((s) => s && typeof s === 'object' && s.id);
      }
    } catch (err) {
      console.warn(`Warning reading store file ${filePath}:`, err);
    }
    return null;
  };

  let stores = tryReadFile(STORES_DB_PATH);
  if (!stores) {
    stores = tryReadFile(STORES_BAK_PATH);
  }
  if (!stores || stores.length === 0) {
    stores = [DEFAULT_AURORA_STORE_RECORD];
  }

  if (!stores.some((s) => s.id === 'store_aurora_01')) {
    stores.push(DEFAULT_AURORA_STORE_RECORD);
  }

  serverMemoryStores = stores;
  return stores;
}

/**
 * Atomically writes the stores list to /data/stores.json using a temporary file and rename,
 * while rotating the previous valid file to /data/stores.json.bak.
 */
export async function writeStoresToDisk(stores: StoreInstance[]): Promise<void> {
  ensureStorageDirectories();
  serverMemoryStores = stores;

  writeQueuePromise = writeQueuePromise.then(async () => {
    const tempFile = `${STORES_DB_PATH}.${process.pid}.${Date.now()}.tmp`;
    const payload = JSON.stringify(
      {
        version: '2.0.0',
        updatedAt: new Date().toISOString(),
        stores,
      },
      null,
      2
    );

    try {
      await fs.promises.writeFile(tempFile, payload, 'utf-8');
      if (fs.existsSync(STORES_DB_PATH)) {
        try {
          await fs.promises.copyFile(STORES_DB_PATH, STORES_BAK_PATH);
        } catch {}
      }
      await fs.promises.rename(tempFile, STORES_DB_PATH);
    } catch (err) {
      console.error('Atomic write error:', err);
      try {
        if (fs.existsSync(tempFile)) {
          await fs.promises.unlink(tempFile);
        }
      } catch {}
    }
  });

  return writeQueuePromise;
}

/**
 * Extracts any embedded data:image/...;base64 strings inside a product or store logo
 * and converts them into standalone files in /public/uploads/, returning the clean URL path.
 */
export function persistBase64ImageToDisk(dataUrl: string, prefix = 'prod'): string {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    return dataUrl;
  }

  ensureStorageDirectories();

  const match = dataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (!match) {
    return dataUrl;
  }

  const rawMimeSubtype = match[1].toLowerCase();
  const base64Payload = match[2];
  const buffer = Buffer.from(base64Payload, 'base64');

  let ext = 'webp';
  if (rawMimeSubtype.includes('png')) ext = 'png';
  else if (rawMimeSubtype.includes('jpeg') || rawMimeSubtype.includes('jpg')) ext = 'jpg';
  else if (rawMimeSubtype.includes('gif')) ext = 'gif';
  else if (rawMimeSubtype.includes('svg')) ext = 'svg';
  else if (rawMimeSubtype.includes('webp')) ext = 'webp';

  const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
  const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '') || 'img';
  const filename = `${safePrefix}_${hash}.${ext}`;
  const fullPath = path.join(UPLOADS_DIR, filename);

  if (!fs.existsSync(fullPath)) {
    fs.writeFileSync(fullPath, buffer);
  }

  return `/uploads/${filename}`;
}

/**
 * Sanitizes a store's products and logoUrl so that any Base64 strings are automatically converted to /uploads/ files.
 */
export function convertStoreBase64AssetsToFiles(store: StoreInstance): StoreInstance {
  if (!store || typeof store !== 'object') return store;

  const updatedSettings = { ...(store.settings || DEFAULT_SETTINGS) };
  if (updatedSettings.logoUrl && updatedSettings.logoUrl.startsWith('data:image/')) {
    updatedSettings.logoUrl = persistBase64ImageToDisk(updatedSettings.logoUrl, 'logo');
  }

  const updatedProducts: Product[] = Array.isArray(store.products)
    ? store.products.map((prod) => {
        if (!prod || typeof prod !== 'object') return prod;
        const cleanImageUrl =
          prod.imageUrl && prod.imageUrl.startsWith('data:image/')
            ? persistBase64ImageToDisk(prod.imageUrl, 'prod')
            : prod.imageUrl;

        const cleanGallery = Array.isArray(prod.galleryImages)
          ? prod.galleryImages.map((img) =>
              img && img.startsWith('data:image/') ? persistBase64ImageToDisk(img, 'prod') : img
            )
          : cleanImageUrl
          ? [cleanImageUrl]
          : [];

        return {
          ...prod,
          imageUrl: cleanImageUrl,
          galleryImages: cleanGallery,
        };
      })
    : [];

  return {
    ...store,
    settings: updatedSettings,
    products: updatedProducts,
  };
}

/**
 * Saves or updates a single store in /data/stores.json (or replaces all stores if an array is provided).
 */
export async function saveStoreOnDisk(
  storeInput: StoreInstance,
  options?: { mergeProducts?: boolean }
): Promise<StoreInstance> {
  const cleanStore = convertStoreBase64AssetsToFiles(storeInput);
  const allStores = [...readStoresFromDisk()];
  const existingIdx = allStores.findIndex(
    (s) => s.id === cleanStore.id || (cleanStore.slug && s.slug === cleanStore.slug)
  );

  if (existingIdx >= 0) {
    const existing = allStores[existingIdx];
    let finalProducts = Array.isArray(cleanStore.products) ? cleanStore.products : existing.products || [];

    if (options?.mergeProducts && Array.isArray(existing.products)) {
      const prodMap = new Map<string, Product>();
      existing.products.forEach((p) => {
        if (p?.id) prodMap.set(p.id, p);
      });
      finalProducts.forEach((p) => {
        if (p?.id) prodMap.set(p.id, p);
      });
      finalProducts = Array.from(prodMap.values());
    }

    // Deduplicate products by ID while preserving order
    const seenIds = new Set<string>();
    const dedupedProducts: Product[] = [];
    for (const p of finalProducts) {
      if (p && p.id && !seenIds.has(p.id)) {
        seenIds.add(p.id);
        dedupedProducts.push(p);
      }
    }

    const mergedStore: StoreInstance = {
      ...existing,
      ...cleanStore,
      id: cleanStore.id || existing.id,
      settings: {
        ...(existing.settings || DEFAULT_SETTINGS),
        ...(cleanStore.settings || {}),
      },
      products: dedupedProducts,
      orders: Array.isArray(cleanStore.orders) && cleanStore.orders.length > 0
        ? cleanStore.orders
        : existing.orders || [],
      policies: Array.isArray(cleanStore.policies) && cleanStore.policies.length > 0
        ? cleanStore.policies
        : existing.policies || DEFAULT_POLICIES,
    };

    allStores[existingIdx] = mergedStore;
    await writeStoresToDisk(allStores);
    return mergedStore;
  } else {
    allStores.unshift(cleanStore);
    await writeStoresToDisk(allStores);
    return cleanStore;
  }
}

/**
 * Helper to read JSON body from Node IncomingMessage
 */
function readRequestBody(req: IncomingMessage, maxBytes = 25 * 1024 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    req.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf-8'));
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  const payload = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

/**
 * Handles all /api/store/* and /api/upload/image HTTP requests in both Vite middleware and standalone Node server.
 * Returns true if the request was handled, false otherwise.
 */

/**
 * Verifies if local storage API is enabled and whether the request possesses valid admin authorization.
 */
export function isLocalStorageApiEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.LOCAL_STORAGE_API === 'true';
}

export function verifyLocalStorageAuth(req: IncomingMessage): boolean {
  const adminToken = process.env.LOCAL_STORAGE_ADMIN_TOKEN;
  if (!adminToken) {
    // If no explicit token is configured, allow in dev/test when not in production
    return process.env.NODE_ENV !== 'production';
  }

  const rawAuth = req.headers['authorization'] || req.headers['x-admin-token'] || '';
  const authHeader = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();

  if (!token) return false;
  if (token.length !== adminToken.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(adminToken));
  } catch {
    return false;
  }
}

export async function handleLocalStoreApiRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  const rawUrl = req.url || '';
  const parsedUrl = new URL(rawUrl, 'http://localhost');
  const pathname = parsedUrl.pathname;

  // 1. Serve /uploads/* (including /uploads/products/*) statically if requested
  if (pathname.startsWith('/uploads/') && (req.method === 'GET' || req.method === 'HEAD')) {
    ensureStorageDirectories();
    const relPath = pathname.replace(/^\/uploads\/+/, '').replace(/\.\./g, '');
    const filePath = path.resolve(UPLOADS_DIR, relPath);
    if (
      filePath.startsWith(UPLOADS_DIR) &&
      fs.existsSync(filePath) &&
      fs.statSync(filePath).isFile()
    ) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.webp': 'image/webp',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
      };
      res.writeHead(200, {
        'Content-Type': mimeMap[ext] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
      });
      fs.createReadStream(filePath).pipe(res);
      return true;
    }
  }

  // Gate /api/store/*: only enabled if NODE_ENV !== 'production' or LOCAL_STORAGE_API === 'true'
  // and requires shared admin token if configured.
  if (pathname.startsWith('/api/store/')) {
    if (!isLocalStorageApiEnabled()) {
      sendJson(res, 403, { success: false, error: 'Local storage API is disabled in production.' });
      return true;
    }
    if (!verifyLocalStorageAuth(req)) {
      sendJson(res, 401, { success: false, error: 'Unauthorized: Valid admin token required for local storage API.' });
      return true;
    }
  }

  // 2. GET /api/store/data?storeId=:id
  if (pathname === '/api/store/data' && req.method === 'GET') {
    const storeId = parsedUrl.searchParams.get('storeId')?.trim();
    const stores = readStoresFromDisk();

    if (storeId) {
      const found = stores.find(
        (s) => s.id === storeId || s.slug?.toLowerCase() === storeId.toLowerCase()
      );
      if (!found) {
        sendJson(res, 404, { success: false, error: 'المتجر غير موجود على السيرفر المحلي.' });
        return true;
      }
      sendJson(res, 200, {
        success: true,
        store: found,
        stores,
        storageMode: 'local_server_disk',
      });
      return true;
    }

    sendJson(res, 200, {
      success: true,
      store: stores[0] || DEFAULT_AURORA_STORE_RECORD,
      stores,
      storageMode: 'local_server_disk',
    });
    return true;
  }

  // 3. POST /api/store/save
  if (pathname === '/api/store/save' && req.method === 'POST') {
    try {
      const rawBody = await readRequestBody(req);
      const parsed = JSON.parse(rawBody || '{}');

      if (Array.isArray(parsed.stores) && parsed.stores.length > 0) {
        const cleanedAll = parsed.stores
          .filter((s: any) => s && typeof s === 'object' && s.id)
          .map((s: StoreInstance) => convertStoreBase64AssetsToFiles(s));
        await writeStoresToDisk(cleanedAll);
        const targetStore = parsed.store
          ? await saveStoreOnDisk(parsed.store)
          : cleanedAll[0];
        sendJson(res, 200, {
          success: true,
          store: targetStore,
          stores: readStoresFromDisk(),
          savedAt: new Date().toISOString(),
        });
        return true;
      }

      const storeToSave: StoreInstance | null = parsed.store || (parsed.id ? parsed : null);
      if (!storeToSave || !storeToSave.id) {
        sendJson(res, 400, { success: false, error: 'بيانات المتجر غير صالحة للحفظ.' });
        return true;
      }

      const saved = await saveStoreOnDisk(storeToSave);
      sendJson(res, 200, {
        success: true,
        store: saved,
        stores: readStoresFromDisk(),
        savedAt: new Date().toISOString(),
      });
      return true;
    } catch (err: any) {
      sendJson(res, 400, {
        success: false,
        error: err?.message || 'حدث خطأ أثناء حفظ بيانات المتجر على السيرفر.',
      });
      return true;
    }
  }

  // 4. POST /api/upload/image
  if (pathname === '/api/upload/image' && req.method === 'POST') {
    try {
      const rawBody = await readRequestBody(req);
      const parsed = JSON.parse(rawBody || '{}');
      const imageData: string = parsed.image || parsed.dataUrl || parsed.base64 || '';
      const prefix: string = parsed.prefix || 'prod';

      if (!imageData || typeof imageData !== 'string') {
        sendJson(res, 400, { success: false, error: 'لم يتم إرسال بيانات الصورة.' });
        return true;
      }

      const normalizedDataUrl = imageData.startsWith('data:image/')
        ? imageData
        : `data:image/webp;base64,${imageData}`;

      const assetUrl = persistBase64ImageToDisk(normalizedDataUrl, prefix);
      sendJson(res, 200, {
        success: true,
        url: assetUrl,
        imageUrl: assetUrl,
      });
      return true;
    } catch (err: any) {
      sendJson(res, 400, {
        success: false,
        error: err?.message || 'تعذر رفع وحفظ الصورة على السيرفر.',
      });
      return true;
    }
  }

  // 5. GET /api/store/backup/download?storeId=:id
  if (pathname === '/api/store/backup/download' && req.method === 'GET') {
    const storeId = parsedUrl.searchParams.get('storeId')?.trim();
    const stores = readStoresFromDisk();
    const targetStore = storeId
      ? stores.find((s) => s.id === storeId || s.slug?.toLowerCase() === storeId.toLowerCase()) || stores[0]
      : stores[0];

    const dateStamp = new Date().toISOString().slice(0, 10);
    const cleanSlug = (targetStore?.slug || 'store').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `store-backup-${cleanSlug}-${dateStamp}.json`;

    const backupEnvelope = {
      backupVersion: '2.0.0',
      exportedAt: new Date().toISOString(),
      storeId: targetStore?.id,
      storeSlug: targetStore?.slug,
      storeName: targetStore?.settings?.storeName,
      store: targetStore,
      allStores: stores,
    };

    const body = JSON.stringify(backupEnvelope, null, 2);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    });
    res.end(body);
    return true;
  }

  // 6. POST /api/store/backup/restore
  if (pathname === '/api/store/backup/restore' && req.method === 'POST') {
    try {
      const rawBody = await readRequestBody(req);
      const parsed = JSON.parse(rawBody || '{}');
      const mode: 'replace' | 'merge' = parsed.mode === 'merge' ? 'merge' : 'replace';
      const targetStoreId: string | undefined = parsed.targetStoreId;

      const backupPayload = parsed.backup || parsed;
      const incomingStore: StoreInstance | null =
        backupPayload.store ||
        (Array.isArray(backupPayload.stores) ? backupPayload.stores[0] : null) ||
        (backupPayload.id && backupPayload.settings ? backupPayload : null);

      if (!incomingStore || typeof incomingStore !== 'object' || !incomingStore.settings) {
        sendJson(res, 400, {
          success: false,
          error: 'ملف النسخة الاحتياطية غير صالح أو لا يحتوي على بيانات متجر مكتملة.',
        });
        return true;
      }

      const resolvedId = targetStoreId || incomingStore.id || `store_${Date.now()}`;
      const storeToRestore: StoreInstance = {
        ...incomingStore,
        id: resolvedId,
      };

      const restored = await saveStoreOnDisk(storeToRestore, {
        mergeProducts: mode === 'merge',
      });

      sendJson(res, 200, {
        success: true,
        mode,
        store: restored,
        stores: readStoresFromDisk(),
        restoredAt: new Date().toISOString(),
      });
      return true;
    } catch (err: any) {
      sendJson(res, 400, {
        success: false,
        error: err?.message || 'تعذر استعادة النسخة الاحتياطية.',
      });
      return true;
    }
  }

  // 7. GET /api/whatsapp/status - Check connection status & QR code
  if (pathname === '/api/whatsapp/status' && req.method === 'GET') {
    const status = serverWhatsAppManager.getStatus();
    sendJson(res, 200, status);
    return true;
  }

  // 8. POST /api/whatsapp/connect - Request new QR code / connection
  if (pathname === '/api/whatsapp/connect' && req.method === 'POST') {
    try {
      const status = await serverWhatsAppManager.initialize();
      sendJson(res, 200, status);
      return true;
    } catch (err: any) {
      sendJson(res, 500, {
        status: 'disconnected',
        error: err?.message || 'فشل الاتصال بخدمة واتساب',
      });
      return true;
    }
  }

  // 9. POST /api/whatsapp/disconnect - Disconnect & logout
  if (pathname === '/api/whatsapp/disconnect' && req.method === 'POST') {
    try {
      await serverWhatsAppManager.disconnect();
      sendJson(res, 200, { success: true, status: 'disconnected' });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err?.message || 'فشل تسجيل الخروج من واتساب' });
      return true;
    }
  }

  // 10. POST /api/whatsapp/send - Send background message directly
  if (pathname === '/api/whatsapp/send' && req.method === 'POST') {
    try {
      const rawBody = await readRequestBody(req);
      const parsed = JSON.parse(rawBody || '{}');
      const { phone, message } = parsed;

      if (!phone || !message) {
        sendJson(res, 400, { success: false, error: 'رقم الهاتف ونص الرسالة مطلوبان.' });
        return true;
      }

      const result = await serverWhatsAppManager.sendMessage(phone, message);
      if (result.success) {
        sendJson(res, 200, result);
      } else {
        sendJson(res, 400, result);
      }
      return true;
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err?.message || 'خطأ أثناء إرسال رسالة الواتساب' });
      return true;
    }
  }

  return false;
}
