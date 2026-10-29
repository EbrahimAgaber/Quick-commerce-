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
import reverseGeocodeHandler from './api/geo/reverseGeocode';
import nationalAddressHandler from './api/geo/nationalAddress';
import createOrderHandler from './api/createOrder';
import updateOrderStatusHandler from './api/updateOrderStatus';
import trackingHandler from './api/tracking';
import validatePromoHandler from './api/validatePromo';
import { hasFirebaseAdminCredentials } from './api/_firebaseAdmin';
import { generateOrderId, generateDeliveryPin } from './src/utils/whatsappInvoice';
import { getZatcaComplianceType, calculateVatBreakdown } from './src/utils/zatca';

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

  // 11. Helper to adapt Node IncomingMessage & ServerResponse into Express/Vercel-like req/res
  const adaptVercelHandler = (handler: (vReq: any, vRes: any) => Promise<any> | any) => {
    return async (bodyObj?: any) => {
      const queryObj: Record<string, string> = {};
      parsedUrl.searchParams.forEach((v, k) => {
        queryObj[k] = v;
      });

      let ended = false;
      const vReq: any = {
        method: req.method,
        url: req.url,
        headers: req.headers || {},
        query: queryObj,
        body: bodyObj || {},
        socket: req.socket,
        connection: (req as any).connection,
      };

      const vRes: any = {
        statusCode: 200,
        setHeader: (key: string, value: any) => {
          if (!ended) res.setHeader(key, value);
          return vRes;
        },
        status: (code: number) => {
          vRes.statusCode = code;
          return vRes;
        },
        json: (data: any) => {
          if (ended) return vRes;
          ended = true;
          const payload = JSON.stringify(data);
          vRes.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.writeHead(vRes.statusCode);
          res.end(payload);
          return vRes;
        },
        send: (data: any) => {
          if (ended) return vRes;
          ended = true;
          res.writeHead(vRes.statusCode);
          res.end(typeof data === 'string' ? data : JSON.stringify(data));
          return vRes;
        },
        end: (data?: any) => {
          if (ended) return vRes;
          ended = true;
          res.writeHead(vRes.statusCode);
          res.end(data);
          return vRes;
        },
      };

      await handler(vReq, vRes);
      return true;
    };
  };

  // 12. GET /api/geo/reverseGeocode
  if (pathname === '/api/geo/reverseGeocode') {
    const runner = adaptVercelHandler(reverseGeocodeHandler);
    let parsedBody: any = {};
    if (req.method === 'POST') {
      try {
        const raw = await readRequestBody(req);
        parsedBody = JSON.parse(raw || '{}');
      } catch {}
    }
    await runner(parsedBody);
    return true;
  }

  // 13. GET /api/geo/nationalAddress
  if (pathname === '/api/geo/nationalAddress') {
    const runner = adaptVercelHandler(nationalAddressHandler);
    let parsedBody: any = {};
    if (req.method === 'POST') {
      try {
        const raw = await readRequestBody(req);
        parsedBody = JSON.parse(raw || '{}');
      } catch {}
    }
    await runner(parsedBody);
    return true;
  }

  // 14. GET /api/tracking
  if (pathname === '/api/tracking') {
    if (hasFirebaseAdminCredentials()) {
      const runner = adaptVercelHandler(trackingHandler);
      await runner();
      return true;
    }
    // Local / Dev Fallback: query from /data/stores.json
    const orderId = (parsedUrl.searchParams.get('orderId') || '').trim().toUpperCase().replace('#', '');
    const phoneLast4 = (parsedUrl.searchParams.get('phoneLast4') || '').trim();
    if (!orderId) {
      sendJson(res, 400, { success: false, error: 'رقم الطلب مطلوب للتتبع.' });
      return true;
    }

    const stores = readStoresFromDisk();
    let foundOrder: any = null;
    let foundStore: StoreInstance | null = null;
    for (const s of stores) {
      const match = (s.orders || []).find((o) => o.id?.toUpperCase().replace('#', '') === orderId);
      if (match) {
        foundOrder = match;
        foundStore = s;
        break;
      }
    }

    if (!foundOrder) {
      sendJson(res, 404, { success: false, error: 'لم يتم العثور على شحنة أو طلب بهذا الرقم.' });
      return true;
    }

    const publicTracking = {
      orderId: foundOrder.id,
      status: foundOrder.status || 'Received',
      timestamp: foundOrder.timestamp || foundOrder.createdAt,
      itemsSummary: foundOrder.itemsSummary,
      grandTotal: foundOrder.grandTotal,
      shippingFee: foundOrder.shippingFee,
      paymentMethod: foundOrder.paymentMethod,
      trackingNotes: foundOrder.trackingNotes,
      courierName: foundOrder.courierName,
      courierPhone: foundOrder.courierPhone,
      trackingNumber: foundOrder.trackingNumber,
      trackingUrl: foundOrder.trackingUrl,
      deliveryType: foundOrder.deliveryType || 'delivery',
      returnStatus: foundOrder.returnStatus || null,
      returnEligibleUntil: foundOrder.returnEligibleUntil || null,
    };

    const isAuthorized = Boolean(
      phoneLast4 && (foundOrder.customerPhone || '').replace(/\D/g, '').endsWith(phoneLast4)
    );

    if (isAuthorized) {
      sendJson(res, 200, {
        success: true,
        orderId,
        tracking: {
          ...publicTracking,
          customerName: foundOrder.customerName,
          customerPhone: foundOrder.customerPhone,
          city: foundOrder.city,
          deliveryAddress: foundOrder.deliveryAddress,
          landmarkNotes: foundOrder.landmarkNotes,
          items: foundOrder.items,
          subtotal: foundOrder.subtotal,
          discountAmount: foundOrder.discountAmount,
          deliveryPin: foundOrder.deliveryPin,
        },
      });
      return true;
    }

    sendJson(res, 200, {
      success: true,
      orderId,
      tracking: publicTracking,
    });
    return true;
  }

  // 15. POST /api/validatePromo
  if (pathname === '/api/validatePromo' && req.method === 'POST') {
    if (hasFirebaseAdminCredentials()) {
      let rawBody = '';
      try {
        rawBody = await readRequestBody(req);
      } catch {}
      const parsed = JSON.parse(rawBody || '{}');
      const runner = adaptVercelHandler(validatePromoHandler);
      await runner(parsed);
      return true;
    }

    // Local / Dev Fallback: validate against /data/stores.json
    try {
      const rawBody = await readRequestBody(req);
      const parsed = JSON.parse(rawBody || '{}');
      const { storeId, promoCode, subtotal = 0 } = parsed;

      if (!storeId || !promoCode) {
        sendJson(res, 400, { valid: false, error: 'Invalid parameters.' });
        return true;
      }

      const stores = readStoresFromDisk();
      const store = stores.find((s) => s.id === storeId || s.slug?.toLowerCase() === storeId.toLowerCase());
      const promoList = store?.settings?.promoCodes || [];
      const cleanCode = promoCode.trim().toUpperCase();
      const promo = promoList.find((p) => p.code?.toUpperCase() === cleanCode && p.active !== false);

      if (!promo) {
        sendJson(res, 200, { valid: false, error: 'كوبون الخصم غير صحيح أو غير مفعل.' });
        return true;
      }

      if (promo.expiryDate && new Date(promo.expiryDate).getTime() < Date.now()) {
        sendJson(res, 200, { valid: false, error: 'انتهت صلاحية كوبون الخصم.' });
        return true;
      }

      if (promo.minOrderAmount && Number(subtotal) < promo.minOrderAmount) {
        sendJson(res, 200, {
          valid: false,
          error: `الحد الأدنى لتطبيق هذا الكوبون هو ${promo.minOrderAmount} ر.س.`,
        });
        return true;
      }

      if (promo.maxUses && (promo.usageCount || 0) >= promo.maxUses) {
        sendJson(res, 200, { valid: false, error: 'تم استنفاد الحد الأقصى لاستخدام هذا الكوبون.' });
        return true;
      }

      let discountAmount = 0;
      if (promo.type === 'percentage') {
        discountAmount = Math.round((Number(subtotal) * promo.value) / 100);
      } else {
        discountAmount = Math.min(Number(subtotal), promo.value);
      }

      sendJson(res, 200, {
        valid: true,
        promoCode: promo.code,
        discountType: promo.type,
        discountValue: promo.value,
        discountAmount,
        minOrderAmount: promo.minOrderAmount || 0,
      });
      return true;
    } catch (err: any) {
      sendJson(res, 400, { valid: false, error: err?.message || 'Failed to validate promo code.' });
      return true;
    }
  }

  // 16. POST /api/updateOrderStatus
  if (pathname === '/api/updateOrderStatus' && req.method === 'POST') {
    let rawBody = '';
    try {
      rawBody = await readRequestBody(req);
    } catch {}
    const parsed = JSON.parse(rawBody || '{}');

    if (hasFirebaseAdminCredentials()) {
      const runner = adaptVercelHandler(updateOrderStatusHandler);
      await runner(parsed);
      return true;
    }

    // Local / Dev Fallback: update in /data/stores.json
    try {
      const { storeId, orderId, status } = parsed;
      if (!storeId || !orderId) {
        sendJson(res, 400, { success: false, error: 'storeId and orderId are required.' });
        return true;
      }

      const stores = readStoresFromDisk();
      const store = stores.find((s) => s.id === storeId || s.slug?.toLowerCase() === storeId.toLowerCase());
      if (!store) {
        sendJson(res, 404, { success: false, error: 'المتجر غير موجود.' });
        return true;
      }

      const orderIdx = (store.orders || []).findIndex(
        (o) => o.id?.toUpperCase().replace('#', '') === orderId.toUpperCase().replace('#', '')
      );
      if (orderIdx < 0) {
        sendJson(res, 404, { success: false, error: 'الطلب غير موجود.' });
        return true;
      }

      const existingOrder = store.orders[orderIdx];
      const updatedOrder = {
        ...existingOrder,
        ...(status ? { status } : {}),
        ...(parsed.trackingNotes ? { trackingNotes: parsed.trackingNotes } : {}),
        ...(parsed.courierName ? { courierName: parsed.courierName } : {}),
        ...(parsed.courierPhone ? { courierPhone: parsed.courierPhone } : {}),
        ...(parsed.trackingNumber ? { trackingNumber: parsed.trackingNumber } : {}),
        ...(parsed.trackingUrl ? { trackingUrl: parsed.trackingUrl } : {}),
        ...(parsed.driverCashCollected !== undefined ? { driverCashCollected: parsed.driverCashCollected } : {}),
        ...(parsed.driverDeliveredAt ? { driverDeliveredAt: parsed.driverDeliveredAt } : {}),
        ...(parsed.driverSettled !== undefined ? { driverSettled: parsed.driverSettled } : {}),
      };

      store.orders[orderIdx] = updatedOrder;
      await saveStoreOnDisk(store);

      sendJson(res, 200, {
        success: true,
        orderId,
        status: updatedOrder.status,
      });
      return true;
    } catch (err: any) {
      sendJson(res, 400, { success: false, error: err?.message || 'Failed to update order status.' });
      return true;
    }
  }

  // 17. POST /api/createOrder
  if (pathname === '/api/createOrder' && req.method === 'POST') {
    let rawBody = '';
    try {
      rawBody = await readRequestBody(req);
    } catch {}
    const parsed = JSON.parse(rawBody || '{}');

    // If genuine Firebase Admin credentials exist AND store is not local demo:
    if (hasFirebaseAdminCredentials() && parsed.storeId !== 'store_aurora_01') {
      const runner = adaptVercelHandler(createOrderHandler);
      await runner(parsed);
      return true;
    }

    // Local Dev / Demo Server-Authoritative Processing against /data/stores.json
    try {
      const { storeId, items, customer, paymentMethod, promoCode, idempotencyKey } = parsed;

      if (!storeId || !Array.isArray(items) || items.length === 0 || !customer || !paymentMethod) {
        sendJson(res, 400, {
          success: false,
          error: 'بيانات الطلب غير مكتملة.',
        });
        return true;
      }

      const stores = readStoresFromDisk();
      const store = stores.find((s) => s.id === storeId || s.slug?.toLowerCase() === storeId.toLowerCase()) || stores[0];
      if (!store) {
        sendJson(res, 404, { success: false, error: 'المتجر غير موجود.' });
        return true;
      }

      const storeProducts = Array.isArray(store.products) ? store.products : [];
      const storeSettings = store.settings || DEFAULT_SETTINGS;

      // Idempotency check: if order with this idempotencyKey already exists in store
      if (idempotencyKey) {
        const existingOrder = (store.orders || []).find((o: any) => o.idempotencyKey === idempotencyKey);
        if (existingOrder) {
          sendJson(res, 200, {
            success: true,
            orderId: existingOrder.id,
            subtotal: existingOrder.subtotal,
            discountAmount: existingOrder.discountAmount || 0,
            shippingFee: existingOrder.shippingFee,
            grandTotal: existingOrder.grandTotal,
            amountHalalas: Math.round(existingOrder.grandTotal * 100),
            status: existingOrder.status,
            order: existingOrder,
          });
          return true;
        }
      }

      // Verify items, compute subtotal and check stock
      let subtotal = 0;
      const verifiedItems: any[] = [];
      const updatedProducts = [...storeProducts];

      for (const item of items) {
        const qty = Number(item.qty) || 1;
        const pIdx = updatedProducts.findIndex((p) => p.id === item.productId);
        if (pIdx < 0) {
          sendJson(res, 400, { success: false, error: `المنتج المطلوب غير موجود في المتجر.` });
          return true;
        }

        const prod = updatedProducts[pIdx];
        if (prod.inStock === false) {
          sendJson(res, 400, { success: false, error: `عذراً، المنتج "${prod.name}" نفد من المخزون.` });
          return true;
        }
        if (typeof prod.stockQuantity === 'number' && prod.stockQuantity < qty) {
          sendJson(res, 400, {
            success: false,
            error: `الكمية المطلوبة من "${prod.name}" غير متوفرة. المتبقي: ${prod.stockQuantity}`,
          });
          return true;
        }

        const unitPrice =
          typeof prod.salePrice === 'number' && prod.salePrice > 0 && prod.salePrice < prod.price
            ? prod.salePrice
            : prod.price;

        const lineTotal = Math.round(unitPrice * qty * 100) / 100;
        subtotal = Math.round((subtotal + lineTotal) * 100) / 100;

        // Decrement stock
        if (typeof prod.stockQuantity === 'number') {
          const remaining = Math.max(0, Math.round((prod.stockQuantity - qty) * 1000) / 1000);
          updatedProducts[pIdx] = {
            ...prod,
            stockQuantity: remaining,
            inStock: remaining > 0 ? prod.inStock : false,
          };
        }

        verifiedItems.push({
          productId: prod.id,
          name: prod.name,
          variant: item.variant || '',
          price: unitPrice,
          quantity: qty,
          imageUrl: prod.imageUrl || '',
          unit: prod.unit,
        });
      }

      // Validate promo
      let discountAmount = 0;
      let appliedPromoCode: string | undefined;
      const promoList = storeSettings.promoCodes || [];
      if (promoCode && typeof promoCode === 'string') {
        const cleanCode = promoCode.trim().toUpperCase();
        const promo = promoList.find((p) => p.code?.toUpperCase() === cleanCode && p.active !== false);
        if (promo) {
          const isExpired = promo.expiryDate && new Date(promo.expiryDate).getTime() < Date.now();
          const meetsMin = !promo.minOrderAmount || subtotal >= promo.minOrderAmount;
          const withinUsageLimit = !promo.maxUses || (promo.usageCount || 0) < promo.maxUses;
          if (!isExpired && meetsMin && withinUsageLimit) {
            appliedPromoCode = promo.code;
            discountAmount =
              promo.type === 'percentage'
                ? Math.round((subtotal * promo.value) / 100)
                : Math.min(subtotal, promo.value);
          }
        }
      }

      // Shipping
      const isPickup = customer.deliveryType === 'pickup';
      let shippingFee = isPickup
        ? 0
        : typeof storeSettings.shippingFee === 'number'
        ? storeSettings.shippingFee
        : typeof storeSettings.standardShippingRate === 'number'
        ? storeSettings.standardShippingRate
        : 25;

      if (!isPickup && storeSettings.freeShippingThreshold && subtotal >= storeSettings.freeShippingThreshold) {
        shippingFee = 0;
      }

      const grandTotal = Math.max(0, subtotal - discountAmount + shippingFee);
      const complianceType = getZatcaComplianceType(storeSettings);
      const vatCalc = calculateVatBreakdown(
        grandTotal,
        storeSettings.pricesIncludeVat ?? true,
        storeSettings.vatRate ?? 0.15,
        complianceType
      );

      const orderId = generateOrderId('ORD');
      const deliveryPin = generateDeliveryPin();
      const isBankTransfer = paymentMethod === 'bank_transfer';
      const isOnline = ['card', 'apple_pay', 'stc_pay'].includes(paymentMethod);

      const itemsSummary = verifiedItems
        .map((i) => `${i.quantity}x ${i.name}${i.variant ? ` (${i.variant})` : ''}`)
        .join('، ');

      const newOrder: any = {
        id: orderId,
        storeSlug: store.slug,
        storeId: store.id,
        timestamp: new Date().toISOString(),
        deliveryPin,
        customerName: customer.name.trim(),
        customerPhone: customer.phone.trim(),
        city: isPickup ? storeSettings.city || 'الفرع الرئيسي' : customer.city.trim(),
        deliveryAddress: isPickup ? storeSettings.storePickupAddress || 'استلام مباشر من مقر المتجر' : customer.address.trim(),
        landmarkNotes: customer.landmark || '',
        googleMapsUrl: customer.googleMapsUrl || '',
        deliveryType: customer.deliveryType || 'delivery',
        paymentMethod,
        paymentStatus: isBankTransfer ? 'pending_receipt_review' : isOnline ? 'pending_payment' : 'pending_payment',
        bankTransferReceiptUrl: isBankTransfer ? parsed.bankTransferReceiptUrl : undefined,
        bankTransferReceiptFileName: isBankTransfer ? parsed.bankTransferReceiptFileName : undefined,
        bankTransferSenderName: isBankTransfer ? parsed.bankTransferSenderName : undefined,
        itemsSummary,
        items: verifiedItems,
        subtotal,
        discountCode: appliedPromoCode,
        discountAmount: discountAmount > 0 ? discountAmount : undefined,
        shippingFee,
        grandTotal,
        vatAmount: vatCalc.vatAmount,
        vatRate: vatCalc.vatRate,
        zatcaComplianceType: complianceType,
        status: isOnline ? 'In Progress' : 'Received',
        trackingNotes: isBankTransfer
          ? 'تحويل بنكي — تم إرفاق إيصال التحويل وبانتظار مراجعة التاجر واعتماد الدفع.'
          : isOnline
          ? 'في انتظار استكمال الدفع الإلكتروني'
          : 'تم استلام الطلب وتأكيده بنجاح.',
        idempotencyKey,
      };

      store.products = updatedProducts;
      store.orders = [newOrder, ...(store.orders || [])].slice(0, 150);
      await saveStoreOnDisk(store);

      sendJson(res, 200, {
        success: true,
        orderId,
        subtotal,
        discountAmount,
        shippingFee,
        grandTotal,
        amountHalalas: Math.round(grandTotal * 100),
        status: newOrder.status,
        order: newOrder,
      });
      return true;
    } catch (err: any) {
      sendJson(res, 400, { success: false, error: err?.message || 'فشلت معالجة الطلب في الخادم المحلي.' });
      return true;
    }
  }

  return false;
}
