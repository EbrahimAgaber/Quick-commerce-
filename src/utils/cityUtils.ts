/**
 * Saudi City normalization and geolocation coordinates helper
 */

export const SAUDI_CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  'الرياض': { lat: 24.7136, lng: 46.6753 },
  'جدة': { lat: 21.5433, lng: 39.1728 },
  'مكة المكرمة': { lat: 21.4225, lng: 39.8262 },
  'المدينة المنورة': { lat: 24.4672, lng: 39.6111 },
  'العلا': { lat: 26.6167, lng: 37.9167 },
  'الدمام': { lat: 26.4385, lng: 50.1118 },
  'الخبر': { lat: 26.2974, lng: 50.2078 },
  'الظهران': { lat: 26.3055, lng: 50.1422 },
  'الأحساء': { lat: 25.4151, lng: 49.5786 },
  'القطيف': { lat: 26.5594, lng: 50.0097 },
  'الجبيل': { lat: 27.0046, lng: 49.6601 },
  'حفر الباطن': { lat: 28.4328, lng: 45.9708 },
  'الخرج': { lat: 24.1554, lng: 47.3119 },
  'الدوادمي': { lat: 24.5072, lng: 44.4039 },
  'بريدة (القصيم)': { lat: 26.3592, lng: 43.9818 },
  'عنيزة': { lat: 26.0911, lng: 43.9877 },
  'الرس': { lat: 25.8694, lng: 43.4975 },
  'حائل': { lat: 27.5216, lng: 41.6959 },
  'أبها': { lat: 18.2164, lng: 42.5053 },
  'خميس مشيط': { lat: 18.3000, lng: 42.7333 },
  'محايل عسير': { lat: 18.5447, lng: 42.0544 },
  'بيشة': { lat: 19.9897, lng: 42.6053 },
  'جازان': { lat: 16.8892, lng: 42.5706 },
  'صبيا': { lat: 17.1495, lng: 42.6256 },
  'أبو عريش': { lat: 16.9689, lng: 42.8306 },
  'صامطة': { lat: 16.5969, lng: 42.9469 },
  'نجران': { lat: 17.4933, lng: 44.1322 },
  'شرورة': { lat: 17.4875, lng: 47.1239 },
  'تبوك': { lat: 28.3835, lng: 36.5662 },
  'ينبع': { lat: 24.0895, lng: 38.0637 },
  'الطائف': { lat: 21.2703, lng: 40.4158 },
  'عرعر': { lat: 30.9753, lng: 41.0381 },
  'سكاكا': { lat: 29.9697, lng: 40.2064 },
  'القريات': { lat: 31.3317, lng: 37.3428 },
  'وادي الدواسر': { lat: 20.4500, lng: 44.8000 },
};

/**
 * Normalizes Arabic city strings to allow accurate equivalence comparison:
 * e.g. "بريدة (القصيم)" === "بريدة"
 * "مكة" === "مكة المكرمة"
 * "مدينة العلا" === "العلا"
 */
export function normalizeCityName(cityName?: string): string {
  if (!cityName || typeof cityName !== 'string') return '';
  let clean = cityName.trim();

  // Strip common prefixes
  clean = clean.replace(/^(مدينة|محافظة|منطقة)\s+/g, '');

  // Strip parentheses and anything inside (e.g. " (القصيم)")
  clean = clean.replace(/\(.*?\)/g, '');

  // Normalize Arabic letters (أ إ آ -> ا, ة -> ه)
  clean = clean
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim();

  // Common aliases
  if (clean === 'مكه' || clean === 'مكه المكرمه') return 'مكة المكرمة';
  if (clean === 'المدينه' || clean === 'المدينه المنوره') return 'المدينة المنورة';
  if (clean === 'بريده' || clean === 'القصيم') return 'بريدة';
  if (clean === 'حفرالباطن') return 'حفر الباطن';
  if (clean === 'ابوعريش') return 'أبو عريش';
  if (clean === 'خميس' || clean === 'خميس مشيط') return 'خميس مشيط';
  if (clean === 'الحسا' || clean === 'الهفوف' || clean === 'المبرز') return 'الأحساء';

  return clean;
}

/**
 * Compares two Saudi city names accurately
 */
export function isSameSaudiCity(cityA?: string, cityB?: string): boolean {
  if (!cityA || !cityB) return false;
  const normA = normalizeCityName(cityA);
  const normB = normalizeCityName(cityB);

  if (normA === normB) return true;
  if (normA.includes(normB) || normB.includes(normA)) return true;

  return false;
}

/**
 * Gets coordinates for a city with graceful fallback to Riyadh center
 */
export function getSaudiCityCoordinates(cityName?: string): { lat: number; lng: number } {
  if (!cityName) return { lat: 24.7136, lng: 46.6753 };

  // Exact match
  if (SAUDI_CITY_COORDINATES[cityName]) {
    return SAUDI_CITY_COORDINATES[cityName];
  }

  // Normalized search
  const norm = normalizeCityName(cityName);
  for (const [key, coords] of Object.entries(SAUDI_CITY_COORDINATES)) {
    if (normalizeCityName(key) === norm || isSameSaudiCity(key, cityName)) {
      return coords;
    }
  }

  return { lat: 24.7136, lng: 46.6753 };
}
