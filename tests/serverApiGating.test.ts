import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handleLocalStoreApiRequest, isLocalStorageApiEnabled, verifyLocalStorageAuth } from '../server';

describe('Phase 6: Server Storage API Gating & Token Protection', () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = { ...origEnv };
    delete process.env.LOCAL_STORAGE_API;
    delete process.env.LOCAL_STORAGE_ADMIN_TOKEN;
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it('rejects /api/store/* requests in production when LOCAL_STORAGE_API is not set', async () => {
    process.env.NODE_ENV = 'production';
    expect(isLocalStorageApiEnabled()).toBe(false);

    let status = 0;
    let json: any = null;

    const req: any = {
      url: '/api/store/data',
      method: 'GET',
      headers: {},
    };
    const res: any = {
      writeHead: (code: number) => {
        status = code;
      },
      end: (data: string) => {
        json = JSON.parse(data);
      },
    };

    const handled = await handleLocalStoreApiRequest(req, res);
    expect(handled).toBe(true);
    expect(status).toBe(403);
    expect(json.success).toBe(false);
    expect(json.error).toContain('disabled in production');
  });

  it('allows /api/store/* in production if explicit LOCAL_STORAGE_API=true and valid admin token provided', async () => {
    process.env.NODE_ENV = 'production';
    process.env.LOCAL_STORAGE_API = 'true';
    process.env.LOCAL_STORAGE_ADMIN_TOKEN = 'secret-admin-pass-123';

    expect(isLocalStorageApiEnabled()).toBe(true);

    let status = 0;
    let json: any = null;

    // 1. Missing token -> 401
    const unauthReq: any = {
      url: '/api/store/data',
      method: 'GET',
      headers: {},
    };
    const unauthRes: any = {
      writeHead: (code: number) => {
        status = code;
      },
      end: (data: string) => {
        json = JSON.parse(data);
      },
    };

    await handleLocalStoreApiRequest(unauthReq, unauthRes);
    expect(status).toBe(401);
    expect(json.success).toBe(false);

    // 2. Valid token via x-admin-token -> 200
    const authReq: any = {
      url: '/api/store/data',
      method: 'GET',
      headers: {
        'x-admin-token': 'secret-admin-pass-123',
      },
    };
    const authRes: any = {
      writeHead: (code: number) => {
        status = code;
      },
      end: (data: string) => {
        json = JSON.parse(data);
      },
    };

    const handled = await handleLocalStoreApiRequest(authReq, authRes);
    expect(handled).toBe(true);
    expect(status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.store).toBeDefined();
  });

  it('allows /api/store/* in development/test without token if no admin token is configured', async () => {
    process.env.NODE_ENV = 'development';
    expect(isLocalStorageApiEnabled()).toBe(true);

    let status = 0;
    let json: any = null;

    const req: any = {
      url: '/api/store/data',
      method: 'GET',
      headers: {},
    };
    const res: any = {
      writeHead: (code: number) => {
        status = code;
      },
      end: (data: string) => {
        json = JSON.parse(data);
      },
    };

    const handled = await handleLocalStoreApiRequest(req, res);
    expect(handled).toBe(true);
    expect(status).toBe(200);
    expect(json.success).toBe(true);
  });
});
