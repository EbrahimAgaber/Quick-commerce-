/**
 * Security and Sanitization Utilities
 */

/**
 * Validates that a URL uses safe protocols (http: or https:).
 * Blocks javascript:, data:, vbscript:, and relative malicious vectors.
 */
export function isValidSafeUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  // Disallow javascript:, data:, vbscript: with any casing or control characters
  const normalized = trimmed.toLowerCase().replace(/[\x00-\x1F\x7F-\x9F]/g, '');
  if (
    normalized.startsWith('javascript:') ||
    normalized.startsWith('data:') ||
    normalized.startsWith('vbscript:') ||
    normalized.startsWith('file:')
  ) {
    return false;
  }

  try {
    const parsed = new URL(trimmed, window.location.origin);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Normalizes phone numbers (handles Arabic-Indic digits ٠-٩ and strips non-digits).
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  const arabicIndicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let normalized = phone.trim();
  for (let i = 0; i < 10; i++) {
    normalized = normalized.replaceAll(arabicIndicDigits[i], i.toString());
  }
  // Strip everything except leading + and digits
  return normalized.replace(/[^\d+]/g, '');
}

/**
 * Normalizes Arabic-Indic digits in strings to Western Arabic numerals (0-9).
 */
export function normalizeArabicDigits(str: string): string {
  if (!str) return '';
  const arabicIndicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let res = str;
  for (let i = 0; i < 10; i++) {
    res = res.replaceAll(arabicIndicDigits[i], i.toString());
  }
  return res;
}
