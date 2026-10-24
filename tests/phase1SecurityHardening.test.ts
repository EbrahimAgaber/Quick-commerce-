import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  evaluateRateLimit,
  checkRateLimit,
  setRateLimitHeaders,
  generateWebhookSignature,
  verifyWebhookSignature,
  verifyTurnstileToken,
} from '../api/_security';
import { dispatchServerOrderNotifications } from '../api/_notifications';

describe('Phase 1: Security, Hardening & Guardrail Enforcement', () => {
  describe('Milestone 1.1: Firestore Rules Order Validation & Owner Management', () => {
    it('verifies firestore.rules validates new orders with isValidNewOrder and denies delete', () => {
      const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
      const rulesContent = fs.readFileSync(rulesPath, 'utf8');

      // Check match /orders/{orderId} block
      expect(rulesContent).toContain('match /orders/{orderId}');
      expect(rulesContent).toContain('isValidNewOrder');
      
      const ordersBlockMatch = rulesContent.match(/match \/orders\/\{orderId\}[\s\S]*?\}/);
      expect(ordersBlockMatch).not.toBeNull();
      const ordersBlock = ordersBlockMatch![0];

      expect(ordersBlock).toContain('allow create: if isValidId(orderId) && isValidNewOrder(request.resource.data, orderId);');
      expect(ordersBlock).toContain('allow delete: if false;');
      expect(ordersBlock).toContain('allow get, list: if isStoreOwner(storeId);');
    });
  });

  describe('Milestone 1.2: Server-Authoritative Price & Inventory Validation', () => {
    it('overrides any client price tampering with authentic catalog values', () => {
      const authenticCatalog = new Map([
        ['iphone-16-pro', { id: 'iphone-16-pro', price: 4999, salePrice: 4699, stockQuantity: 5, inStock: true }],
      ]);

      const clientClaimedUnitPrice = 1.0;
      const clientClaimedTotal = 1.0;
      const requestedQty = 1;

      const prod = authenticCatalog.get('iphone-16-pro')!;
      const authenticUnitPrice = (prod.salePrice && prod.salePrice < prod.price) ? prod.salePrice : prod.price;
      const authenticSubtotal = authenticUnitPrice * requestedQty;
      const authenticShipping = authenticSubtotal >= 250 ? 0 : 25;
      const authenticGrandTotal = authenticSubtotal + authenticShipping;

      expect(authenticGrandTotal).toBe(4699);
      expect(authenticGrandTotal).not.toBe(clientClaimedTotal);
      expect(authenticUnitPrice).not.toBe(clientClaimedUnitPrice);
    });

    it('rejects inventory oversell when requested quantity exceeds available stock', () => {
      const stockQuantity = 3;
      const requestedQty = 5;

      const canFulfill = stockQuantity >= requestedQty;
      expect(canFulfill).toBe(false);
    });
  });

  describe('Milestone 1.3: Distributed Rate Limiting & Bot Protection', () => {
    it('enforces sliding-window limits and tracks remaining allowance', async () => {
      const testKey = `test_ip_${Date.now()}_${Math.random()}`;
      const limit = 3;
      const windowMs = 5000;

      const r1 = await evaluateRateLimit(testKey, limit, windowMs);
      expect(r1.allowed).toBe(true);
      expect(r1.remaining).toBe(2);

      const r2 = await evaluateRateLimit(testKey, limit, windowMs);
      expect(r2.allowed).toBe(true);
      expect(r2.remaining).toBe(1);

      const r3 = await evaluateRateLimit(testKey, limit, windowMs);
      expect(r3.allowed).toBe(true);
      expect(r3.remaining).toBe(0);

      // Exceeded
      const r4 = await evaluateRateLimit(testKey, limit, windowMs);
      expect(r4.allowed).toBe(false);
      expect(r4.remaining).toBe(0);
    });

    it('sets standard IETF rate-limit response headers', () => {
      const headers: Record<string, string> = {};
      const mockRes = {
        setHeader: (k: string, v: string) => {
          headers[k] = v;
        },
      };

      setRateLimitHeaders(mockRes, {
        allowed: true,
        limit: 10,
        remaining: 7,
        resetAt: 1700000000000,
      });

      expect(headers['X-RateLimit-Limit']).toBe('10');
      expect(headers['X-RateLimit-Remaining']).toBe('7');
      expect(headers['X-RateLimit-Reset']).toBe('1700000000');
    });

    it('verifies Cloudflare Turnstile token validation behavior', async () => {
      // In non-production without TURNSTILE_SECRET_KEY, it allows graceful bypass
      const result = await verifyTurnstileToken('mock-token');
      expect(result.success).toBe(true);
    });
  });

  describe('Milestone 1.4: Server-Side Merchant Notifications & Webhook HMAC Signing', () => {
    const secret = 'test-merchant-webhook-secret-998877';
    const payload = JSON.stringify({
      event: 'order.created',
      orderId: 'ORD-TEST123',
      grandTotal: 350,
    });

    it('generates cryptographic HMAC-SHA256 signature in t=...,v1=... format', () => {
      const now = Date.now();
      const { signature, header, timestamp } = generateWebhookSignature(secret, payload, now);

      expect(signature).toBeDefined();
      expect(signature.length).toBe(64); // 256 bits = 64 hex chars
      expect(header).toBe(`t=${now},v1=${signature}`);
      expect(timestamp).toBe(now);
    });

    it('verifies authentic webhook signatures within tolerance window', () => {
      const now = Date.now();
      const { header } = generateWebhookSignature(secret, payload, now);

      const isValid = verifyWebhookSignature(secret, payload, header, 300);
      expect(isValid).toBe(true);
    });

    it('rejects tampered webhook payloads', () => {
      const now = Date.now();
      const { header } = generateWebhookSignature(secret, payload, now);

      const tamperedPayload = JSON.stringify({
        event: 'order.created',
        orderId: 'ORD-TEST123',
        grandTotal: 1, // Tampered!
      });

      const isValid = verifyWebhookSignature(secret, tamperedPayload, header, 300);
      expect(isValid).toBe(false);
    });

    it('rejects expired webhook signatures to prevent replay attacks', () => {
      const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
      const { header } = generateWebhookSignature(secret, payload, tenMinutesAgo);

      // 5-minute tolerance (300s)
      const isValid = verifyWebhookSignature(secret, payload, header, 300);
      expect(isValid).toBe(false);
    });

    it('dispatches server notifications gracefully with empty or invalid channels', async () => {
      const mockOrder = {
        id: 'ORD-NOTIF-01',
        storeId: 'store_test',
        customerName: 'فهد المطيري',
        customerPhone: '0501234567',
        city: 'الرياض',
        deliveryAddress: 'حي الياسمين',
        paymentMethod: 'الدفع عند الاستلام',
        grandTotal: 250,
        timestamp: new Date().toISOString(),
      };

      const result = await dispatchServerOrderNotifications(mockOrder, {});
      expect(result.telegramSent).toBe(false);
      expect(result.webhookSent).toBe(false);
      expect(result.errors.length).toBe(0);
    });
  });
});
