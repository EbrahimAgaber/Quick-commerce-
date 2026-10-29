import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleLocalStoreApiRequest, readStoresFromDisk, saveStoreOnDisk } from '../server';
import type { IncomingMessage, ServerResponse } from 'http';
import { EventEmitter } from 'events';

function createMockReqRes(options: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
}) {
  const req = new EventEmitter() as any as IncomingMessage;
  req.method = options.method;
  req.url = options.url;
  req.headers = options.headers || { host: 'localhost:5173' };

  let statusCode = 200;
  let headers: Record<string, string> = {};
  let bodyChunks: Buffer[] = [];
  let ended = false;

  const res = new EventEmitter() as any as ServerResponse;
  res.writeHead = (code: number, hdrs?: any) => {
    statusCode = code;
    if (hdrs) headers = { ...headers, ...hdrs };
    return res;
  };
  res.setHeader = (k: string, v: string) => {
    headers[k.toLowerCase()] = v;
    return res;
  };
  res.write = (chunk: any) => {
    bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return true;
  };
  res.end = (chunk?: any) => {
    if (chunk) {
      bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    ended = true;
    res.emit('finish');
    return res;
  };

  const getResult = () => {
    const raw = Buffer.concat(bodyChunks).toString('utf-8');
    let json: any = null;
    try {
      json = JSON.parse(raw);
    } catch {
      json = raw;
    }
    return { statusCode, headers, body: json, raw };
  };

  const startReq = () => {
    process.nextTick(() => {
      if (options.body) {
        const payload = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
        req.emit('data', Buffer.from(payload));
      }
      req.emit('end');
    });
  };

  return { req, res, getResult, startReq };
}

describe('Dev API Middleware (/api/geo/* and /api/createOrder local execution)', () => {
  it('intercepts /api/geo/reverseGeocode and returns 200 JSON', async () => {
    const { req, res, getResult, startReq } = createMockReqRes({
      method: 'GET',
      url: '/api/geo/reverseGeocode?lat=24.7136&lng=46.6753',
    });

    startReq();
    const handled = await handleLocalStoreApiRequest(req, res);
    expect(handled).toBe(true);

    const result = getResult();
    expect(result.statusCode).toBe(200);
    expect(result.body.success).toBe(true);
    expect(result.body.formattedAddress).toBeDefined();
  });

  it('intercepts /api/geo/nationalAddress and resolves Saudi short codes', async () => {
    const { req, res, getResult, startReq } = createMockReqRes({
      method: 'GET',
      url: '/api/geo/nationalAddress?shortCode=RIYD1221',
    });

    startReq();
    const handled = await handleLocalStoreApiRequest(req, res);
    expect(handled).toBe(true);

    const result = getResult();
    expect(result.statusCode).toBe(200);
    expect(result.body.success).toBe(true);
    expect(result.body.city).toContain('الرياض');
  });

  it('intercepts /api/createOrder and processes order authoritatively, decrementing inventory', async () => {
    const stores = readStoresFromDisk();
    const store = stores[0];
    
    // Ensure product has tracked stock
    if (store.products[0].stockQuantity === undefined) {
      store.products[0].stockQuantity = 10;
      await saveStoreOnDisk(store);
    }
    const product = store.products[0];
    const initialStock = product.stockQuantity!;

    const { req, res, getResult, startReq } = createMockReqRes({
      method: 'POST',
      url: '/api/createOrder',
      body: {
        storeId: store.id,
        items: [{ productId: product.id, qty: 1 }],
        customer: {
          name: 'محمد عبد الله',
          phone: '0501234567',
          city: 'الرياض',
          address: 'حي النرجس',
          deliveryType: 'delivery',
        },
        paymentMethod: 'cod',
      },
    });

    startReq();
    const handled = await handleLocalStoreApiRequest(req, res);
    expect(handled).toBe(true);

    const result = getResult();
    expect(result.statusCode).toBe(200);
    expect(result.body.success).toBe(true);
    expect(result.body.order).toBeDefined();
    expect(result.body.orderId).toBeDefined();

    // Verify stock decrement in updated store
    const updatedStores = readStoresFromDisk();
    const updatedStore = updatedStores.find((s) => s.id === store.id)!;
    const updatedProduct = updatedStore.products.find((p) => p.id === product.id)!;
    expect(updatedProduct.stockQuantity).toBe(initialStock - 1);
  });
});
