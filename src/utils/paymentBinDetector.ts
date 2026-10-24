/**
 * Payment BIN (Bank Identification Number) and Card Type Detector
 * Specially calibrated for the Saudi Mada National Payment Switch, Visa, Mastercard, and Amex.
 */

export type CardBrand = 'mada' | 'visa' | 'mastercard' | 'amex' | 'unknown';

// Official Saudi Central Bank (SAMA) Mada 6-digit BIN prefixes
const MADA_BINS = new Set([
  '588845', '588846', '588847', '588848', '588849', '588850', '588851',
  '400861', '401757', '409201', '410621', '417633', '422817', '422818', '422819',
  '428671', '428672', '428673', '440647', '440795', '446393', '446404', '446672',
  '457865', '457997', '458456', '462220', '468540', '468541', '468542', '468543',
  '484783', '486094', '486095', '486096', '489318', '489319', '504300', '508160',
  '513213', '521076', '524130', '524514', '529415', '529741', '530906', '531095',
  '535825', '535989', '536023', '537767', '539738', '543357', '554180', '557606',
  '558848', '585265', '604906', '605141', '636120', '968201', '968202', '968203',
  '968204', '968205', '968206', '968207', '968208', '968209', '968210', '968211'
]);

/**
 * Normalizes input string by stripping non-digit characters and converting Arabic-Indic numerals
 */
export function sanitizeCardNumber(raw: string): string {
  if (!raw) return '';
  const arabicIndicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let norm = raw.trim();
  for (let i = 0; i < 10; i++) {
    norm = norm.replaceAll(arabicIndicDigits[i], i.toString());
  }
  return norm.replace(/\D/g, '');
}

/**
 * Detects the card brand from the card number or initial 6 digits (BIN).
 * High priority: Evaluates Mada BINs before generic Visa/Mastercard ranges,
 * matching Saudi Central Bank (SAMA) routing guidelines.
 */
export function detectCardBrand(cardNumber: string): CardBrand {
  const clean = sanitizeCardNumber(cardNumber);
  if (clean.length < 4) return 'unknown';

  // 1. Check Saudi Mada BINs first
  const bin6 = clean.substring(0, 6);
  if (MADA_BINS.has(bin6)) {
    return 'mada';
  }

  // 2. American Express: starts with 34 or 37
  if (/^3[47]/.test(clean)) {
    return 'amex';
  }

  // 3. Visa: starts with 4
  if (/^4/.test(clean)) {
    return 'visa';
  }

  // 4. Mastercard: 51-55 or 2221-2720
  if (/^5[1-5]/.test(clean) || /^(222[1-9]|22[3-9]\d|2[3-6]\d{2}|27[01]\d|2720)/.test(clean)) {
    return 'mastercard';
  }

  return 'unknown';
}

/**
 * Luhn algorithm checksum verification for card number integrity
 */
export function validateLuhnChecksum(cardNumber: string): boolean {
  const clean = sanitizeCardNumber(cardNumber);
  if (clean.length < 13 || clean.length > 19) return false;

  let sum = 0;
  let shouldDouble = false;

  for (let i = clean.length - 1; i >= 0; i--) {
    let digit = parseInt(clean.charAt(i), 10);

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

/**
 * Formats card number with standard 4-digit spacing (e.g. "4123 4567 8901 2345")
 */
export function formatCardNumberDisplay(cardNumber: string): string {
  const clean = sanitizeCardNumber(cardNumber);
  const parts: string[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    parts.push(clean.substring(i, i + 4));
  }
  return parts.join(' ').substring(0, 23);
}
