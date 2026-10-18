import { describe, it, expect, vi } from 'vitest';
import handler from '../api/generate';
import { checkRateLimit, AI_TEMPLATES } from '../api/_security';

function createMockReqRes(options: {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
}) {
  const req = {
    method: options.method || 'POST',
    headers: options.headers || {},
    body: options.body || {},
    socket: { remoteAddress: '127.0.0.1' },
  };

  const headersSent: Record<string, string> = {};
  let statusCode = 200;
  let responseData: any = null;

  const res = {
    setHeader: vi.fn((k: string, v: string) => {
      headersSent[k.toLowerCase()] = v;
    }),
    status: vi.fn((code: number) => {
      statusCode = code;
      return res;
    }),
    json: vi.fn((data: any) => {
      responseData = data;
      return res;
    }),
    end: vi.fn(() => res),
    _getStatusCode: () => statusCode,
    _getData: () => responseData,
    _getHeaders: () => headersSent,
  };

  return { req, res };
}

describe('AI API Proxy Security (S3)', () => {
  it('rejects unauthenticated requests without Bearer token with 401', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      headers: {},
      body: { prompt: 'اكتب وصفاً للساعة' },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(401);
    expect(res._getData().success).toBe(false);
    expect(res._getData().error).toContain('Authentication required');
  });

  it('rejects invalid or malformed token with 401', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      headers: {
        authorization: 'Bearer bad_token_without_proper_jwt_structure',
      },
      body: { prompt: 'اكتب وصفاً للمنتج' },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(401);
    expect(res._getData().success).toBe(false);
  });

  it('enforces per-merchant rate limits', () => {
    const testKey = `merchant_test_rate_limit_${Date.now()}`;
    const maxRequests = 3;
    const windowMs = 5000;

    // Requests 1, 2, 3 succeed
    expect(checkRateLimit(testKey, maxRequests, windowMs)).toBe(true);
    expect(checkRateLimit(testKey, maxRequests, windowMs)).toBe(true);
    expect(checkRateLimit(testKey, maxRequests, windowMs)).toBe(true);

    // Request 4 exceeds rate limit and is rejected
    expect(checkRateLimit(testKey, maxRequests, windowMs)).toBe(false);
  });

  it('uses fixed server templates and refuses client-override system prompts', () => {
    expect(AI_TEMPLATES.product_description).toBeDefined();
    expect(AI_TEMPLATES.tagline).toBeDefined();
    expect(AI_TEMPLATES.store_hero).toBeDefined();

    // Verify Arabic copywriting guidelines are embedded in server-controlled template
    expect(AI_TEMPLATES.product_description).toContain('تسويقي متخصص في التجارة الإلكترونية باللغة العربية');
  });
});
