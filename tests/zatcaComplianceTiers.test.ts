import { describe, it, expect } from 'vitest';
import { 
  getZatcaComplianceType, 
  calculateVatBreakdown,
  normalizeVatRate, 
  generateZatcaTLVBase64, 
  decodeZatcaTLVBase64,
  generateNonRegisteredOrderQRPayload,
  generateZatcaPhase2Uuid,
  generateInvoiceHash
} from '../src/utils/zatca';
import { StoreSettings } from '../src/types/store';

describe('Saudi ZATCA & Tax Compliance: 3 Business Registration Tiers', () => {
  // -------------------------------------------------------------
  // TIER 1: Non-Registered in ZATCA (Freelancers / Small Businesses)
  // -------------------------------------------------------------
  describe('Tier 1: Non-Registered Businesses (وثيقة عمل حر / دون حد التسجيل)', () => {
    const nonRegisteredSettings: Partial<StoreSettings> = {
      storeName: 'حرف يدوية سعودية',
      currency: 'ر.س',
      freelanceCertificate: 'FL-982147',
      zatcaComplianceType: 'non_registered',
      vatNumber: undefined,
    };

    it('identifies business compliance tier as non_registered', () => {
      const tier = getZatcaComplianceType(nonRegisteredSettings);
      expect(tier).toBe('non_registered');
    });

    it('auto-deduces non_registered when no VAT number is present', () => {
      const tier = getZatcaComplianceType({ storeName: 'متجر عفاف' });
      expect(tier).toBe('non_registered');
    });

    it('calculates 0% VAT - PROHIBITING tax charges or VAT amounts on invoices', () => {
      const breakdown = calculateVatBreakdown(500, true, 0.15, 'non_registered');
      expect(breakdown.isVatApplicable).toBe(false);
      expect(breakdown.vatRate).toBe(0);
      expect(breakdown.vatAmount).toBe(0);
      expect(breakdown.netAmount).toBe(500);
      expect(breakdown.totalWithVat).toBe(500);
    });

    it('generates an Order Verification QR payload (NOT a ZATCA Tax QR)', () => {
      const qrPayload = generateNonRegisteredOrderQRPayload({
        storeName: 'حرف يدوية سعودية',
        orderId: 'ORD-7712',
        grandTotal: 500,
        currency: 'ر.س',
        trackingUrl: 'https://quick-ecommerce-saas-app.web.app/?track=ORD-7712',
      });

      expect(qrPayload).toBe('https://quick-ecommerce-saas-app.web.app/?track=ORD-7712');
      // Must not contain ZATCA TLV tags
      expect(qrPayload).not.toContain('300000000000003');
    });

    it('generates a structured JSON receipt payload when no tracking URL provided', () => {
      const qrPayload = generateNonRegisteredOrderQRPayload({
        storeName: 'حرف يدوية سعودية',
        orderId: 'ORD-7712',
        grandTotal: 500,
        currency: 'ر.س',
      });

      const parsed = JSON.parse(qrPayload);
      expect(parsed.type).toBe('COMMERCIAL_RECEIPT');
      expect(parsed.vatStatus).toBe('NON_REGISTERED');
      expect(parsed.total).toBe('500 ر.س');
    });
  });

  // -------------------------------------------------------------
  // TIER 2: Phase 1 Compliant (VAT Registered - Generation Phase)
  // -------------------------------------------------------------
  describe('Tier 2: Phase 1 Compliant (فاتورة ضريبية مبسطة - مرحلة الإصدار)', () => {
    const phase1Settings: Partial<StoreSettings> = {
      storeName: 'أزياء الرياض الفاخرة',
      currency: 'ر.س',
      commercialRegister: '1010998877',
      vatNumber: '310123456700003',
      zatcaComplianceType: 'phase_1',
      pricesIncludeVat: true,
      vatRate: 0.15,
    };

    it('identifies business compliance tier as phase_1', () => {
      const tier = getZatcaComplianceType(phase1Settings);
      expect(tier).toBe('phase_1');
    });

    it('auto-deduces phase_1 from a valid 15-digit VAT number', () => {
      const tier = getZatcaComplianceType({ vatNumber: '300000000000003' });
      expect(tier).toBe('phase_1');
    });

    it('calculates 15% VAT correctly for tax-inclusive prices', () => {
      // 230 SAR total including 15% VAT:
      // Net = 230 / 1.15 = 200.00 SAR
      // VAT = 30.00 SAR
      const breakdown = calculateVatBreakdown(230, true, 0.15, 'phase_1');
      expect(breakdown.isVatApplicable).toBe(true);
      expect(breakdown.vatRate).toBe(0.15);
      expect(breakdown.netAmount).toBe(200);
      expect(breakdown.vatAmount).toBe(30);
      expect(breakdown.totalWithVat).toBe(230);
    });

    it('CRITICAL REGRESSION FIX: calculates 1450 SAR order correctly when vatRate is 15 (integer percentage)', () => {
      // Previously: 1450 / (1 + 15) = 90.63 with VAT 1359.37 (DISASTER BUG)
      // Correct ZATCA: 1450 / 1.15 = 1260.87 SAR net, 189.13 SAR VAT, 1450.00 SAR total
      const breakdownFromInt = calculateVatBreakdown(1450, true, 15, 'phase_1');
      expect(breakdownFromInt.netAmount).toBe(1260.87);
      expect(breakdownFromInt.vatAmount).toBe(189.13);
      expect(breakdownFromInt.totalWithVat).toBe(1450);
      expect(breakdownFromInt.netAmount + breakdownFromInt.vatAmount).toBe(1450);

      const breakdownFromDecimal = calculateVatBreakdown(1450, true, 0.15, 'phase_1');
      expect(breakdownFromDecimal.netAmount).toBe(1260.87);
      expect(breakdownFromDecimal.vatAmount).toBe(189.13);
      expect(breakdownFromDecimal.totalWithVat).toBe(1450);

      const breakdownFromString = calculateVatBreakdown(1450, true, "15", 'phase_1');
      expect(breakdownFromString.netAmount).toBe(1260.87);
      expect(breakdownFromString.vatAmount).toBe(189.13);
    });

    it('normalizes all permutations of vatRate safely', () => {
      expect(normalizeVatRate(15)).toBe(0.15);
      expect(normalizeVatRate("15")).toBe(0.15);
      expect(normalizeVatRate(0.15)).toBe(0.15);
      expect(normalizeVatRate(5)).toBe(0.05);
      expect(normalizeVatRate(0)).toBe(0);
      expect(normalizeVatRate(undefined)).toBe(0.15);
      expect(normalizeVatRate(null)).toBe(0.15);
      expect(normalizeVatRate(-10)).toBe(0.15);
      expect(normalizeVatRate(NaN)).toBe(0.15);
    });

    it('generates valid ZATCA Phase 1 TLV Base64 payload with Tags 1 to 5', () => {
      const timestamp = '2026-10-20T12:00:00Z';
      const base64 = generateZatcaTLVBase64({
        sellerName: 'أزياء الرياض الفاخرة',
        vatNumber: '310123456700003',
        timestamp,
        invoiceTotal: '230.00',
        vatTotal: '30.00',
      });

      expect(typeof base64).toBe('string');
      expect(base64.length).toBeGreaterThan(20);

      // Verify bidirectional decode
      const decoded = decodeZatcaTLVBase64(base64);
      expect(decoded[1]).toBe('أزياء الرياض الفاخرة'); // Tag 1: Seller Name
      expect(decoded[2]).toBe('310123456700003');     // Tag 2: VAT Number
      expect(decoded[3]).toBe(timestamp);              // Tag 3: Timestamp
      expect(decoded[4]).toBe('230.00');               // Tag 4: Total With VAT
      expect(decoded[5]).toBe('30.00');                // Tag 5: Total VAT
    });
  });

  // -------------------------------------------------------------
  // TIER 3: Phase 2 Compliant (FATOORA Integration & Clearance)
  // -------------------------------------------------------------
  describe('Tier 3: Phase 2 Compliant (مرحلة الربط والتكامل مع منصة فاتورة FATOORA)', () => {
    const phase2Settings: Partial<StoreSettings> = {
      storeName: 'مؤسسة التقنية المتقدمة',
      currency: 'ر.س',
      commercialRegister: '1010123456',
      vatNumber: '300000000000003',
      zatcaComplianceType: 'phase_2',
      pricesIncludeVat: true,
      vatRate: 0.15,
    };

    it('identifies business compliance tier as phase_2', () => {
      const tier = getZatcaComplianceType(phase2Settings);
      expect(tier).toBe('phase_2');
    });

    it('generates valid UUID v4 compliant with ZATCA Phase 2 specifications', () => {
      const uuid = generateZatcaPhase2Uuid();
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('generates SHA-256 invoice cryptographic hash', () => {
      const hash = generateInvoiceHash('INV-001-2026-10-20-1000SAR');
      expect(hash).toContain('hash_zatca_p2_');
      expect(hash.length).toBeGreaterThan(15);
    });

    it('encodes Phase 2 TLV payload including Tag 6 (Invoice Hash)', () => {
      const timestamp = '2026-10-20T14:30:00Z';
      const invoiceHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

      const base64 = generateZatcaTLVBase64({
        sellerName: 'مؤسسة التقنية المتقدمة',
        vatNumber: '300000000000003',
        timestamp,
        invoiceTotal: '1150.00',
        vatTotal: '150.00',
        invoiceHash,
      });

      const decoded = decodeZatcaTLVBase64(base64);
      expect(decoded[1]).toBe('مؤسسة التقنية المتقدمة');
      expect(decoded[2]).toBe('300000000000003');
      expect(decoded[4]).toBe('1150.00');
      expect(decoded[5]).toBe('150.00');
      expect(decoded[6]).toBe(invoiceHash); // Tag 6: SHA-256 Invoice Hash
    });
  });
});
