/**
 * URL Router & Arabic Transliteration Helper
 * Supports both clean URLs (`/s/<slug>`) and query strings (`/?store=<slug>&product=<id>`),
 * and converts Arabic store names into clean, readable Latin slugs (e.g. "متجر رونق" -> "mtjr-rwnq" or "rawnaq").
 */

const ARABIC_TO_LATIN_MAP: Record<string, string> = {
  'ا': 'a', 'أ': 'a', 'إ': 'e', 'آ': 'a', 'ٱ': 'a',
  'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h',
  'خ': 'kh', 'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z',
  'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't',
  'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q',
  'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h',
  'ة': 'a', 'و': 'w', 'ؤ': 'o', 'ي': 'y', 'ى': 'a',
  'ئ': 'e', 'ء': '',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

const COMMON_ARABIC_WORDS: Record<string, string> = {
  'متجر': 'store',
  'بوتيك': 'boutique',
  'عطور': 'perfumes',
  'العطور': 'perfumes',
  'قهوة': 'coffee',
  'كافيه': 'cafe',
  'ازياء': 'fashion',
  'أزياء': 'fashion',
  'عبايات': 'abayas',
  'مجوهرات': 'jewelry',
  'ساعات': 'watches',
  'الكترونيات': 'tech',
  'إلكترونيات': 'tech',
  'تمور': 'dates',
  'حلويات': 'sweets',
  'ورود': 'flowers',
  'زهور': 'flowers',
  'دار': 'dar',
  'بيت': 'bait',
  'مؤسسة': 'est',
  'شركة': 'co',
};

/**
 * Generates a clean URL slug from an Arabic or English store name
 */
export function generateCleanStoreSlug(input: string, fallbackPrefix = 'shop'): string {
  if (!input || !input.trim()) {
    return `${fallbackPrefix}-${Math.floor(100 + Math.random() * 900)}`;
  }

  // Replace common whole Arabic words first for cleaner English slugs
  let processed = input.trim().toLowerCase();
  const words = processed.split(/\s+/);
  const translatedWords = words.map((w) => {
    const stripped = w.replace(/[^\u0600-\u06FFa-z0-9-]/g, '');
    if (COMMON_ARABIC_WORDS[stripped]) {
      return COMMON_ARABIC_WORDS[stripped];
    }
    let out = '';
    for (const ch of stripped) {
      if (ARABIC_TO_LATIN_MAP[ch] !== undefined) {
        out += ARABIC_TO_LATIN_MAP[ch];
      } else if (/[a-z0-9-_]/.test(ch)) {
        out += ch;
      }
    }
    return out;
  });

  const slug = translatedWords
    .filter(Boolean)
    .join('-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

  return slug || `${fallbackPrefix}-${Math.floor(100 + Math.random() * 900)}`;
}

export interface ParsedStoreRoute {
  storeSlug: string | null;
  productId: string | null;
  viewParam: string | null;
  driverOrderId: string | null;
  trackOrderId: string | null;
  customDomainHostname: string | null;
}

/**
 * Checks whether a given hostname is a known platform/development host
 */
export function isPlatformHostname(hostname: string): boolean {
  if (!hostname) return true;
  const h = hostname.toLowerCase().split(':')[0]; // strip port if any
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h.endsWith('.web.app') ||
    h.endsWith('.firebaseapp.com') ||
    h.endsWith('.ngrok.io') ||
    h.endsWith('.ngrok-free.app') ||
    h.endsWith('.run.app')
  );
}

/**
 * Extracts store slug, custom domain hostname, product ID, view mode, driver order ID, and track order ID from URL
 */
export function parseStoreRouteFromLocation(loc: Location = window.location): ParsedStoreRoute {
  try {
    const params = new URLSearchParams(loc.search);
    const queryStore = params.get('store')?.trim() || null;
    const productId = params.get('product')?.trim() || null;
    const viewParam = params.get('view')?.trim() || null;
    const driverOrderId = params.get('driver')?.trim() || null;
    let trackOrderId = params.get('track')?.trim() || params.get('order')?.trim() || null;

    if (!trackOrderId && loc.hash && loc.hash.startsWith('#track-')) {
      trackOrderId = loc.hash.replace('#track-', '').trim() || null;
    }

    const hostname = loc.hostname || '';
    const isCustom = !isPlatformHostname(hostname);
    const customDomainHostname = isCustom ? hostname.toLowerCase() : null;

    if (queryStore) {
      return { storeSlug: queryStore, productId, viewParam, driverOrderId, trackOrderId, customDomainHostname };
    }

    // Check clean path `/s/:slug`
    const pathSegments = loc.pathname.split('/').filter(Boolean);
    if (pathSegments.length >= 2 && pathSegments[0].toLowerCase() === 's') {
      return {
        storeSlug: decodeURIComponent(pathSegments[1]),
        productId,
        viewParam,
        driverOrderId,
        trackOrderId,
        customDomainHostname,
      };
    }

    return { storeSlug: null, productId, viewParam, driverOrderId, trackOrderId, customDomainHostname };
  } catch {
    return { storeSlug: null, productId: null, viewParam: null, driverOrderId: null, trackOrderId: null, customDomainHostname: null };
  }
}

/**
 * Builds the shareable customer storefront URL for a store (and optional product deep link)
 * If a customDomain is connected, generates a direct clean URL on that domain.
 */
export function buildShareableStoreUrl(storeSlug: string, productId?: string, customDomain?: string): string {
  const cleanSlug = encodeURIComponent((storeSlug || '').trim());
  const productParam = productId ? `product=${encodeURIComponent(productId)}` : '';

  if (customDomain && customDomain.trim()) {
    const cleanDomain = customDomain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (productParam) {
      return `https://${cleanDomain}/?${productParam}`;
    }
    return `https://${cleanDomain}/`;
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  if (productParam) {
    return `${origin}/?store=${cleanSlug}&${productParam}`;
  }
  return `${origin}/?store=${cleanSlug}`;
}

/**
 * Extracts the driver order ID from a URL string or search string (supports query params and hash)
 */
export function extractDriverOrderIdFromUrl(urlStr: string): string | null {
  try {
    const url = new URL(urlStr, 'https://dummy.base');
    const directParam = url.searchParams.get('driver');
    if (directParam) return directParam.trim();

    // Check if hash has query params e.g. #/?driver=xxx or #/driver=xxx
    if (url.hash && url.hash.includes('?')) {
      const hashQuery = url.hash.split('?')[1];
      const hashParams = new URLSearchParams(hashQuery);
      const hashParam = hashParams.get('driver');
      if (hashParam) return hashParam.trim();
    }

    return null;
  } catch {
    return null;
  }
}
