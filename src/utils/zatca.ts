/**
 * ZATCA (Zakat, Tax and Customs Authority - Saudi Arabia) E-Invoicing Utilities
 * Implements Phase 1 Simplified Tax Invoice QR Code (TLV Base64 encoding).
 */

function toTLV(tag: number, value: string): Uint8Array {
  const encoder = new TextEncoder();
  const valueBytes = encoder.encode(value);
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
}

/**
 * Generates standard ZATCA Phase 1 TLV Base64 QR Payload
 */
export function generateZatcaTLVBase64(data: ZatcaInvoiceData): string {
  const tlv1 = toTLV(1, data.sellerName);
  const tlv2 = toTLV(2, data.vatNumber);
  const tlv3 = toTLV(3, data.timestamp);
  const tlv4 = toTLV(4, data.invoiceTotal);
  const tlv5 = toTLV(5, data.vatTotal);

  const totalLength = tlv1.length + tlv2.length + tlv3.length + tlv4.length + tlv5.length;
  const combined = new Uint8Array(totalLength);

  let offset = 0;
  [tlv1, tlv2, tlv3, tlv4, tlv5].forEach((tlv) => {
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
 * Calculates standard Saudi VAT (15%) breakdown
 */
export function calculateVatBreakdown(
  grandTotal: number,
  pricesIncludeVat: boolean = true,
  vatRate: number = 0.15
): {
  netAmount: number;
  vatAmount: number;
  totalWithVat: number;
} {
  if (pricesIncludeVat) {
    // If prices already include 15% VAT:
    // Net = Total / (1 + vatRate)
    const netAmount = Math.round((grandTotal / (1 + vatRate)) * 100) / 100;
    const vatAmount = Math.round((grandTotal - netAmount) * 100) / 100;
    return {
      netAmount,
      vatAmount,
      totalWithVat: grandTotal,
    };
  } else {
    // If prices exclude VAT:
    const vatAmount = Math.round(grandTotal * vatRate * 100) / 100;
    const totalWithVat = Math.round((grandTotal + vatAmount) * 100) / 100;
    return {
      netAmount: grandTotal,
      vatAmount,
      totalWithVat,
    };
  }
}
