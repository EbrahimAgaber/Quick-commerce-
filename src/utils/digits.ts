/**
 * Arabic-Indic Digit Normalization & Saudi Phone Number Utilities
 */

const EASTERN_ARABIC_DIGITS: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

/**
 * Converts Arabic-Indic (Eastern Arabic & Persian) digits to standard Latin digits (0-9).
 * Preserves all other characters.
 */
export function normalizeArabicDigits(str: string): string {
  if (!str) return '';
  return str.replace(/[٠-٩۰-۹]/g, (match) => EASTERN_ARABIC_DIGITS[match] || match);
}

/**
 * Normalizes and validates Saudi phone numbers.
 * Supported formats:
 * - 05XXXXXXXX (10 digits)
 * - +9665XXXXXXXX or 9665XXXXXXXX (12-13 digits)
 * - 5XXXXXXXX (9 digits)
 * Returns formatted 10-digit number '05XXXXXXXX' or null if invalid.
 */
export function normalizeSaudiPhoneNumber(phone: string): {
  isValid: boolean;
  normalized: string;
  formattedInternational: string;
} {
  const digits = normalizeArabicDigits(phone).replace(/[^\d+]/g, '');

  let clean = digits;
  if (clean.startsWith('+')) {
    clean = clean.substring(1);
  }

  // Handle international prefix 966
  if (clean.startsWith('966')) {
    clean = clean.substring(3);
  }

  // If starts with 0, drop it temporarily to inspect the prefix
  if (clean.startsWith('0')) {
    clean = clean.substring(1);
  }

  // A valid Saudi mobile number must now start with '5' and have exactly 8 additional digits (total 9 digits)
  const isValid = /^5\d{8}$/.test(clean);

  const local = isValid ? `0${clean}` : digits;
  const international = isValid ? `+966${clean}` : digits;

  return {
    isValid,
    normalized: local,
    formattedInternational: international,
  };
}

/**
 * Converts any phone input into the international digits-only format required by
 * wa.me / api.whatsapp.com (e.g. 0558698103 -> 966558698103).
 * Handles Eastern Arabic digits, +, spaces, dashes, leading 00, and Saudi local formats.
 */
export function toWhatsAppNumber(phone: string | null | undefined): string {
  let clean = normalizeArabicDigits(String(phone || '')).replace(/\D/g, '');
  if (clean.startsWith('00')) clean = clean.substring(2);
  if (/^05\d{8}$/.test(clean)) return '966' + clean.substring(1);
  if (/^5\d{8}$/.test(clean)) return '966' + clean;
  if (/^96605\d{8}$/.test(clean)) return '966' + clean.substring(4);
  return clean;
}


/**
 * Builds a wa.me link with a normalized international number and optional pre-filled text.
 * Returns '' if no usable phone is given.
 */
export function buildWhatsAppLink(phone: string | null | undefined, text?: string): string {
  const num = toWhatsAppNumber(phone);
  if (!num) return '';
  return text ? `https://wa.me/${num}?text=${encodeURIComponent(text)}` : `https://wa.me/${num}`;
}
