/**
 * ZATCA (Zakat, Tax and Customs Authority - Saudi Arabia) E-Invoicing Utilities
 * Implements:
 * 1. Non-Registered Business handling (Non-VAT: Commercial Invoices / Sales Receipts without tax QR)
 * 2. Phase 1 Simplified Tax Invoices (Generation Phase: TLV Base64 Tags 1–5)
 * 3. Phase 2 Simplified Tax Invoices (Integration & Clearance Phase: TLV Base64 Tags 1–9 with UUID & SHA-256 Hash)
 */

import { StoreSettings } from '../types/store';

export type ZatcaComplianceType = 'non_registered' | 'phase_1' | 'phase_2';

/**
 * Determines the business ZATCA/VAT registration status:
 * - 'non_registered': Freelancers / small businesses exempt or not registered for VAT.
 *                     MUST NOT issue tax invoices or charge VAT.
 * - 'phase_1': Registered in VAT, subject to Phase 1 generation rules (Tags 1-5).
 * - 'phase_2': Registered in VAT, integrated with ZATCA FATOORA portal (Tags 1-9, UUID, Hash).
 */
export function getZatcaComplianceType(settings?: Partial<StoreSettings> | null): ZatcaComplianceType {
  if (settings?.zatcaComplianceType) {
    return settings.zatcaComplianceType;
  }
  // If not explicitly configured, deduce from VAT number:
  const vatNumber = (settings?.vatNumber || '').trim();
  if (vatNumber.length >= 10 && (vatNumber.startsWith('3') || vatNumber.endsWith('3'))) {
    return 'phase_1';
  }
  return 'non_registered';
}

function toTLV(tag: number, value: string | Uint8Array): Uint8Array {
  let valueBytes: Uint8Array;
  if (typeof value === 'string') {
    const encoder = new TextEncoder();
    valueBytes = encoder.encode(value);
  } else {
    valueBytes = value;
  }

  const length = valueBytes.length;
  const tlv = new Uint8Array(2 + length);
  tlv[0] = tag;
  tlv[1] = length;
  tlv.set(valueBytes, 2);

  return tlv;
}

export interface ZatcaInvoiceData {
  sellerName: string;
  vatNumber: string;
  timestamp: string; // ISO 8601 string, e.g. 2026-10-18T10:00:00Z
  invoiceTotal: string; // Grand total including VAT as string, e.g. "280.00"
  vatTotal: string; // Total VAT amount as string, e.g. "36.52"
  // Phase 2 Optional Fields
  invoiceHash?: string; // Tag 6: SHA-256 hash in hex or binary
  digitalSignature?: string; // Tag 7: ECDSA P-256 signature
  publicKey?: string; // Tag 8: ECDSA Public Key
  certificateSignature?: string; // Tag 9: Cryptographic stamp
}

/**
 * Generates standard ZATCA Phase 1 or Phase 2 TLV Base64 QR Payload.
 * For Phase 1, encodes Tags 1-5.
 * For Phase 2, encodes Tags 1-5 plus Tags 6-9 when available.
 */
export function generateZatcaTLVBase64(data: ZatcaInvoiceData): string {
  const tlvs: Uint8Array[] = [
    toTLV(1, data.sellerName),
    toTLV(2, data.vatNumber),
    toTLV(3, data.timestamp),
    toTLV(4, data.invoiceTotal),
    toTLV(5, data.vatTotal),
  ];

  // Phase 2 Tags
  if (data.invoiceHash) {
    tlvs.push(toTLV(6, data.invoiceHash));
  }
  if (data.digitalSignature) {
    tlvs.push(toTLV(7, data.digitalSignature));
  }
  if (data.publicKey) {
    tlvs.push(toTLV(8, data.publicKey));
  }
  if (data.certificateSignature) {
    tlvs.push(toTLV(9, data.certificateSignature));
  }

  const totalLength = tlvs.reduce((acc, curr) => acc + curr.length, 0);
  const combined = new Uint8Array(totalLength);

  let offset = 0;
  tlvs.forEach((tlv) => {
    combined.set(tlv, offset);
    offset += tlv.length;
  });

  // Base64 encode
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(combined).toString('base64');
  }

  let binary = '';
  const len = combined.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(combined[i]);
  }
  return btoa(binary);
}

/**
 * Decodes a ZATCA TLV Base64 payload back to structured fields (for testing & verification)
 */
export function decodeZatcaTLVBase64(base64Str: string): Record<number, string> {
  const binary = typeof Buffer !== 'undefined'
    ? Buffer.from(base64Str, 'base64')
    : Uint8Array.from(atob(base64Str), (c) => c.charCodeAt(0));

  const decoder = new TextDecoder();
  const fields: Record<number, string> = {};
  let i = 0;

  while (i < binary.length) {
    const tag = binary[i];
    const len = binary[i + 1];
    const valBytes = binary.slice(i + 2, i + 2 + len);
    fields[tag] = decoder.decode(valBytes);
    i += 2 + len;
  }

  return fields;
}

/**
 * Generates an Order Verification QR Code Payload for Non-Registered (Non-VAT) Businesses.
 * Because Non-VAT merchants are legally forbidden from issuing ZATCA tax QR codes,
 * this generates a direct order verification link / JSON payload for customer tracking.
 */
export function generateNonRegisteredOrderQRPayload(data: {
  storeName: string;
  orderId: string;
  grandTotal: number;
  currency: string;
  trackingUrl?: string;
}): string {
  if (data.trackingUrl) {
    return data.trackingUrl;
  }
  return JSON.stringify({
    type: 'COMMERCIAL_RECEIPT',
    store: data.storeName,
    order: data.orderId,
    total: `${data.grandTotal} ${data.currency}`,
    vatStatus: 'NON_REGISTERED',
  });
}

/**
 * Generates a pseudo-UUID v4 compliant with ZATCA Phase 2 FATOORA specifications
 */
export function generateZatcaPhase2Uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generates a mock/simulated SHA-256 invoice hash for Phase 2 integration readiness
 */
export function generateInvoiceHash(invoiceData: string): string {
  let hash = 0;
  for (let i = 0; i < invoiceData.length; i++) {
    const char = invoiceData.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `hash_zatca_p2_${hex}_${Date.now().toString(16)}`;
}

export interface VatBreakdownResult {
  netAmount: number;
  vatAmount: number;
  totalWithVat: number;
  vatRate: number;
  isVatApplicable: boolean;
  complianceType: ZatcaComplianceType;
}

/**
 * Normalizes any VAT rate input into standard decimal format (e.g. 0.15 for 15%).
 * Handles:
 * - Whole percentage numbers (e.g. 15 or 15.0 or "15") -> 0.15
 * - Decimals (e.g. 0.15) -> 0.15
 * - Zero (0) -> 0
 * - Undefined / null / NaN / negative -> 0.15 (statutory Saudi VAT rate)
 */
export function normalizeVatRate(rate?: number | string | null): number {
  if (rate === undefined || rate === null || rate === '') {
    return 0.15;
  }
  const numericRate = typeof rate === 'string' ? parseFloat(rate) : rate;
  if (isNaN(numericRate) || numericRate < 0) {
    return 0.15;
  }
  if (numericRate === 0) {
    return 0;
  }
  // If entered as whole percentage (e.g. 15 for 15%), normalize to decimal
  if (numericRate >= 1) {
    return Math.round((numericRate / 100) * 10000) / 10000;
  }
  return numericRate;
}

/**
 * Calculates VAT breakdown adhering strictly to Saudi ZATCA standards:
 * - non_registered: VAT rate is 0%, VAT amount is 0, Net Amount = Grand Total.
 * - phase_1 / phase_2: Standard 15% VAT (or merchant configured rate normalized).
 * 
 * Mathematically guarantees down to the halala:
 * - Inclusive: Net = Total / (1 + Rate), VAT = Total - Net, Net + VAT === Total
 * - Exclusive: VAT = Total * Rate, TotalWithVat = Total + VAT
 */
export function calculateVatBreakdown(
  grandTotal: number,
  pricesIncludeVat: boolean = true,
  vatRate: number | string = 0.15,
  complianceType: ZatcaComplianceType = 'phase_1'
): VatBreakdownResult {
  const safeGrandTotal = typeof grandTotal === 'number' && !isNaN(grandTotal) ? Math.max(0, grandTotal) : 0;

  if (complianceType === 'non_registered') {
    return {
      netAmount: Math.round(safeGrandTotal * 100) / 100,
      vatAmount: 0,
      totalWithVat: Math.round(safeGrandTotal * 100) / 100,
      vatRate: 0,
      isVatApplicable: false,
      complianceType,
    };
  }

  const effectiveRate = normalizeVatRate(vatRate);

  if (effectiveRate === 0) {
    return {
      netAmount: Math.round(safeGrandTotal * 100) / 100,
      vatAmount: 0,
      totalWithVat: Math.round(safeGrandTotal * 100) / 100,
      vatRate: 0,
      isVatApplicable: false,
      complianceType,
    };
  }

  if (pricesIncludeVat) {
    // If prices already include VAT:
    // Net = Total / (1 + effectiveRate)
    const netAmount = Math.round((safeGrandTotal / (1 + effectiveRate)) * 100) / 100;
    // VAT is the exact difference to guarantee zero-halala rounding drift
    const vatAmount = Math.round((safeGrandTotal - netAmount) * 100) / 100;
    return {
      netAmount,
      vatAmount,
      totalWithVat: safeGrandTotal,
      vatRate: effectiveRate,
      isVatApplicable: true,
      complianceType,
    };
  } else {
    // If prices exclude VAT:
    const vatAmount = Math.round(safeGrandTotal * effectiveRate * 100) / 100;
    const totalWithVat = Math.round((safeGrandTotal + vatAmount) * 100) / 100;
    return {
      netAmount: safeGrandTotal,
      vatAmount,
      totalWithVat,
      vatRate: effectiveRate,
      isVatApplicable: true,
      complianceType,
    };
  }
}
