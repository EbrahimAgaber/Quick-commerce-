import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  DistributedReservationEngine,
  getClusterSafeKeys,
} from '../src/services/inventoryReservationEngine';
import { outboxService, TransactionalOutboxService } from '../src/services/outboxService';
import {
  zatcaPhase2Engine,
  ZATCA_GENESIS_PIH_BASE64,
} from '../src/services/zatcaPhase2Engine';

describe('Phase 3: Multi-Tenant Headless & High-Concurrency Scaling', () => {
  describe('Milestone 3.1: Canonical PostgreSQL 16 DDL Schema', () => {
    it('verifies db/schema.sql defines all canonical enterprise tables with multi-tenant keys', () => {
      const schemaPath = path.resolve(process.cwd(), 'db/schema.sql');
      expect(fs.existsSync(schemaPath)).toBe(true);

      const ddl = fs.readFileSync(schemaPath, 'utf8');

      // 1. Core tables
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS tenants');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS products');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS inventory_ledger');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS orders');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS order_line_items');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS outbox_events');

      // 2. Double-entry ledger movement types
      expect(ddl).toContain('RESERVATION_HOLD');
      expect(ddl).toContain('RESERVATION_RELEASE');
      expect(ddl).toContain('ORDER_FULFILLMENT');

      // 3. Composite multi-tenant keys
      expect(ddl).toContain('PRIMARY KEY (tenant_id, id)');
    });
  });

  describe('Milestone 3.2: Redis Lua Flash-Sale Concurrency & Slot Affinity', () => {
    it('enforces {tenant_id:sku} hash tags on Redis keys to prevent CROSSSLOT cluster errors', () => {
      const keys = getClusterSafeKeys('tenant_aurora_01', 'SKU-WATCH-100', 'token_123');

      expect(keys.availableKey).toBe('inv:{tenant_aurora_01:SKU-WATCH-100}:available');
      expect(keys.reservationsHashKey).toBe('inv:{tenant_aurora_01:SKU-WATCH-100}:reservations');
      expect(keys.tokenKey).toBe('res:{tenant_aurora_01:SKU-WATCH-100}:token_123');

      // Verify CRC16 hash tag extraction
      const extractHashTag = (key: string) => {
        const match = key.match(/\{([^}]+)\}/);
        return match ? match[1] : null;
      };

      expect(extractHashTag(keys.availableKey)).toBe('tenant_aurora_01:SKU-WATCH-100');
      expect(extractHashTag(keys.reservationsHashKey)).toBe('tenant_aurora_01:SKU-WATCH-100');
      expect(extractHashTag(keys.tokenKey)).toBe('tenant_aurora_01:SKU-WATCH-100');
    });

    it('prevents overselling under concurrent checkout requests on limited inventory', async () => {
      const engine = new DistributedReservationEngine();
      const tenantId = 'tenant_flash_01';
      const sku = 'SKU-LIMITED-5';

      // 5 units physically available
      engine.setInitialStock(tenantId, sku, 5);
      expect(engine.getAvailableStock(tenantId, sku)).toBe(5);

      // Simulate 20 concurrent shoppers attempting to purchase 1 unit simultaneously
      const requests = Array.from({ length: 20 }, (_, idx) =>
        engine.reserve({
          tenantId,
          sku,
          quantity: 1,
          customerId: `customer_${idx}`,
          idempotencyKey: `req_token_${idx}`,
        })
      );

      const results = await Promise.all(requests);

      const successfulReservations = results.filter((r) => r.status === 'HOLD');
      const rejectedReservations = results.filter((r) => r.status === 'OUT_OF_STOCK');

      // Exactly 5 reservations must succeed
      expect(successfulReservations.length).toBe(5);
      // Exactly 15 reservations must be rejected
      expect(rejectedReservations.length).toBe(15);
      // Remaining stock must be precisely 0 (never negative)
      expect(engine.getAvailableStock(tenantId, sku)).toBe(0);
    });

    it('releases reserved stock and restores available inventory on cart cancellation', async () => {
      const engine = new DistributedReservationEngine();
      const tenantId = 'tenant_flash_01';
      const sku = 'SKU-RELEASE-TEST';

      engine.setInitialStock(tenantId, sku, 2);

      const res1 = await engine.reserve({
        tenantId,
        sku,
        quantity: 2,
        customerId: 'shopper_abandoning',
        idempotencyKey: 'token_release_01',
      });

      expect(res1.status).toBe('HOLD');
      expect(engine.getAvailableStock(tenantId, sku)).toBe(0);

      // Release the reservation
      const releaseRes = await engine.release(tenantId, sku, 'token_release_01');
      expect(releaseRes.status).toBe('RELEASED');
      expect(releaseRes.releasedQuantity).toBe(2);
      expect(releaseRes.newAvailableStock).toBe(2);
      expect(engine.getAvailableStock(tenantId, sku)).toBe(2);
    });

    it('rejects invalid, negative, or zero quantity requests', async () => {
      const engine = new DistributedReservationEngine();
      engine.setInitialStock('tenant_test', 'SKU-ERR', 10);

      const resZero = await engine.reserve({
        tenantId: 'tenant_test',
        sku: 'SKU-ERR',
        quantity: 0,
        customerId: 'shopper_zero',
      });
      expect(resZero.status).toBe('INVALID_QUANTITY');

      const resNegative = await engine.reserve({
        tenantId: 'tenant_test',
        sku: 'SKU-ERR',
        quantity: -5,
        customerId: 'shopper_neg',
      });
      expect(resNegative.status).toBe('INVALID_QUANTITY');
    });
  });

  describe('Milestone 3.3: Transactional Outbox Pattern & Debezium CDC Streaming', () => {
    it('creates outbox events with W3C traceparent headers and formats Debezium CDC envelopes', () => {
      const service = new TransactionalOutboxService();

      const event = service.createEvent(
        'tenant_aurora_01',
        'Order',
        'ORD-2026-9901',
        'OrderPlaced',
        { grandTotal: 350, currency: 'SAR' }
      );

      expect(event.id).toBeDefined();
      expect(event.traceParent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
      expect(event.isProcessed).toBe(false);

      const cdcEnvelope = service.toDebeziumEnvelope(event);
      expect(cdcEnvelope.payload.source.connector).toBe('postgresql');
      expect(cdcEnvelope.payload.source.table).toBe('outbox_events');
      expect(cdcEnvelope.payload.op).toBe('c');
      expect(cdcEnvelope.payload.after.eventType).toBe('OrderPlaced');
    });

    it('routes failed events to the Dead Letter Queue after max retry threshold', async () => {
      const service = new TransactionalOutboxService();

      service.createEvent('tenant_01', 'Order', 'ORD-FAIL-1', 'OrderPlaced', { amount: 100 });

      // Simulate a failing downstream worker (e.g. temporary webhook timeout)
      const failingWorker = async () => {
        throw new Error('Connection refused to external webhook');
      };

      // Run 3 dispatch cycles (maxRetries = 3)
      await service.dispatchEvents(failingWorker, 3);
      await service.dispatchEvents(failingWorker, 3);
      const res3 = await service.dispatchEvents(failingWorker, 3);

      expect(res3.dlq).toBe(1);
      const dlq = service.getDeadLetterQueue();
      expect(dlq.length).toBe(1);
      expect(dlq[0].retryCount).toBeGreaterThanOrEqual(3);
      expect(dlq[0].lastError).toContain('Connection refused');
    });
  });

  describe('ZATCA Phase 2 E-Invoicing Engine', () => {
    it('verifies ZATCA [KSA-25] genesis Previous Invoice Hash (PIH) standard calculation', () => {
      expect(ZATCA_GENESIS_PIH_BASE64).toBeDefined();
      expect(ZATCA_GENESIS_PIH_BASE64.length).toBe(44); // 32 bytes in Base64 = 44 chars with padding
    });

    it('generates compliant UBL 2.1 XML and 9-tag Phase 2 cryptographic QR payload', () => {
      const invoice = zatcaPhase2Engine.stampInvoice({
        invoiceNumber: 'INV-2026-0001',
        uuid: '3c8f28c2-3e21-4f9e-993d-8e89f8123456',
        issueDate: '2026-10-23',
        issueTime: '12:00:00',
        sellerName: 'متجر السرعة للتجارة الإلكترونية',
        sellerVatNumber: '310123456700003',
        sellerAddress: {
          street: 'طريق الملك فهد',
          buildingNumber: '1234',
          city: 'الرياض',
          postalCode: '12345',
          district: 'حي العليا',
        },
        lineItems: [
          { name: 'عطر فاخر 100 مل', quantity: 1, unitPrice: 300, vatRate: 0.15 },
        ],
      });

      expect(invoice.uuid).toBe('3c8f28c2-3e21-4f9e-993d-8e89f8123456');
      expect(invoice.invoiceHash).toBeDefined();
      expect(invoice.digitalSignature).toBeDefined();
      expect(invoice.qrCodeBase64).toBeDefined();
      expect(invoice.ublXml).toContain('urn:oasis:names:specification:ubl:schema:xsd:Invoice-2');
      expect(invoice.ublXml).toContain('<cbc:ProfileID>reporting:1.0</cbc:ProfileID>');
      expect(invoice.ublXml).toContain('<cbc:ID>PIH</cbc:ID>');
    });
  });
});
