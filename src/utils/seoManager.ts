/**
 * SEO, Saudi GEO & Exposure Manager
 * Dynamically updates document metadata, Open Graph, Twitter cards,
 * Saudi geolocation tags, and Google-compliant JSON-LD structured data.
 */

import { StoreInstance, Product } from '../types/store';

export interface SaudiCityGeo {
  cityAr: string;
  cityEn: string;
  lat: number;
  lng: number;
  region: string;
}

export const SAUDI_CITIES_GEO: Record<string, SaudiCityGeo> = {
  'الرياض': { cityAr: 'الرياض', cityEn: 'Riyadh', lat: 24.7136, lng: 46.6753, region: 'منطقة الرياض' },
  'جدة': { cityAr: 'جدة', cityEn: 'Jeddah', lat: 21.4858, lng: 39.1925, region: 'منطقة مكة المكرمة' },
  'مكة المكرمة': { cityAr: 'مكة المكرمة', cityEn: 'Makkah', lat: 21.3891, lng: 39.8579, region: 'منطقة مكة المكرمة' },
  'المدينة المنورة': { cityAr: 'المدينة المنورة', cityEn: 'Madinah', lat: 24.5247, lng: 39.5692, region: 'منطقة المدينة المنورة' },
  'الدمام': { cityAr: 'الدمام', cityEn: 'Dammam', lat: 26.4207, lng: 50.0888, region: 'المنطقة الشرقية' },
  'الخبر': { cityAr: 'الخبر', cityEn: 'Khobar', lat: 26.2172, lng: 50.1971, region: 'المنطقة الشرقية' },
  'الظهران': { cityAr: 'الظهران', cityEn: 'Dhahran', lat: 26.2361, lng: 50.0393, region: 'المنطقة الشرقية' },
  'الأحساء': { cityAr: 'الأحساء', cityEn: 'Al Ahsa', lat: 25.3835, lng: 49.5864, region: 'المنطقة الشرقية' },
  'بريدة': { cityAr: 'بريدة', cityEn: 'Buraidah', lat: 26.3260, lng: 43.9750, region: 'منطقة القصيم' },
  'عنيزة': { cityAr: 'عنيزة', cityEn: 'Unaizah', lat: 26.0843, lng: 43.9936, region: 'منطقة القصيم' },
  'تبوك': { cityAr: 'تبوك', cityEn: 'Tabuk', lat: 28.3835, lng: 36.5662, region: 'منطقة تبوك' },
  'حائل': { cityAr: 'حائل', cityEn: 'Hail', lat: 27.5114, lng: 41.7208, region: 'منطقة حائل' },
  'أبها': { cityAr: 'أبها', cityEn: 'Abha', lat: 18.2164, lng: 42.5053, region: 'منطقة عسير' },
  'خميس مشيط': { cityAr: 'خميس مشيط', cityEn: 'Khamis Mushait', lat: 18.3064, lng: 42.7292, region: 'منطقة عسير' },
  'جازان': { cityAr: 'جازان', cityEn: 'Jazan', lat: 16.8894, lng: 42.5511, region: 'منطقة جازان' },
  'نجران': { cityAr: 'نجران', cityEn: 'Najran', lat: 17.4924, lng: 44.1277, region: 'منطقة نجران' },
  'الطائف': { cityAr: 'الطائف', cityEn: 'Taif', lat: 21.2854, lng: 40.4222, region: 'منطقة مكة المكرمة' },
  'ينبع': { cityAr: 'ينبع', cityEn: 'Yanbu', lat: 24.0895, lng: 38.0618, region: 'منطقة المدينة المنورة' },
  'الجبيل': { cityAr: 'الجبيل', cityEn: 'Jubail', lat: 27.0046, lng: 49.6606, region: 'المنطقة الشرقية' },
};

/**
 * Resolves GEO coordinates for a given Saudi city string
 */
export function resolveSaudiCityGeo(cityName?: string): SaudiCityGeo {
  if (!cityName) return SAUDI_CITIES_GEO['الرياض'];
  const clean = cityName.trim();
  for (const [key, val] of Object.entries(SAUDI_CITIES_GEO)) {
    if (clean.includes(key) || key.includes(clean) || clean.toLowerCase() === val.cityEn.toLowerCase()) {
      return val;
    }
  }
  return SAUDI_CITIES_GEO['الرياض'];
}

function setMetaTag(nameOrProperty: string, content: string, isProperty = false): void {
  if (typeof document === 'undefined') return;
  const attr = isProperty ? 'property' : 'name';
  let el = document.querySelector(`meta[${attr}="${nameOrProperty}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, nameOrProperty);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/**
 * Builds Google-compliant JSON-LD structured data for Store / LocalBusiness
 */
export function buildStoreJsonLd(store: StoreInstance, storeUrl: string): Record<string, any> {
  const settings = store.settings;
  const city = settings.geoCity || settings.city || 'الرياض';
  const geo = resolveSaudiCityGeo(city);
  const lat = settings.geoCoordinates?.lat ?? geo.lat;
  const lng = settings.geoCoordinates?.lng ?? geo.lng;

  const productsCatalog = (store.products || []).slice(0, 15).map((p) => ({
    '@type': 'Product',
    name: p.name,
    description: p.description || p.name,
    image: p.imageUrl || undefined,
    offers: {
      '@type': 'Offer',
      price: p.salePrice || p.price,
      priceCurrency: settings.currency === 'ر.س' ? 'SAR' : 'SAR',
      availability: p.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: `${storeUrl}?product=${encodeURIComponent(p.id)}`,
    },
  }));

  return {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: settings.storeName,
    description: settings.metaDescription || settings.tagline,
    url: storeUrl,
    telephone: settings.whatsappNumber ? `+${settings.whatsappNumber}` : undefined,
    priceRange: '$$',
    currenciesAccepted: 'SAR',
    paymentAccepted: 'Cash, Credit Card, Apple Pay, Mada',
    image: settings.logoUrl || undefined,
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'SA',
      addressLocality: geo.cityAr,
      addressRegion: geo.region,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: lat,
      longitude: lng,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: [
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
          'Sunday',
        ],
        opens: '00:00',
        closes: '23:59',
      },
    ],
    hasMerchantReturnPolicy: {
      '@type': 'MerchantReturnPolicy',
      returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
      merchantReturnDays: 7,
      returnMethod: 'https://schema.org/ReturnByMail',
    },
    makesOffer: productsCatalog,
  };
}

/**
 * Injects complete dynamic SEO, OpenGraph, Saudi GEO meta tags, and JSON-LD schema into the document head
 */
export function injectStoreSEO(
  store: StoreInstance,
  options?: {
    activeProduct?: Product | null;
    customUrl?: string;
  }
): void {
  if (typeof document === 'undefined') return;

  const { settings } = store;
  const { activeProduct, customUrl } = options || {};

  const currentUrl =
    customUrl ||
    (typeof window !== 'undefined'
      ? settings.customDomain
        ? `https://${settings.customDomain}`
        : window.location.href
      : `https://quick-ecommerce-saas-app.web.app/?store=${store.slug}`);

  const city = settings.geoCity || settings.city || 'الرياض';
  const geo = resolveSaudiCityGeo(city);
  const lat = settings.geoCoordinates?.lat ?? geo.lat;
  const lng = settings.geoCoordinates?.lng ?? geo.lng;

  // Title calculation
  let title = '';
  let description = '';
  let imageUrl = settings.logoUrl || '';

  if (activeProduct) {
    title = `${activeProduct.name} | ${settings.storeName} - تسوق الآن`;
    description = activeProduct.description
      ? activeProduct.description.slice(0, 155)
      : `اشتري ${activeProduct.name} بأفضل سعر من ${settings.storeName} مع توصيل سريع في ${geo.cityAr} وكافة مدن السعودية.`;
    imageUrl = activeProduct.imageUrl || imageUrl;
  } else {
    title = settings.metaTitle || `${settings.storeName} | ${settings.tagline || 'المتجر الإلكتروني المعتمد في السعودية'}`;
    description =
      settings.metaDescription ||
      `${settings.storeName}: ${settings.tagline || 'تسوق أفضل المنتجات مع شحن فوري لكافة مدن المملكة ودفع آمن عند الاستلام أو ببطاقات مدى وأبل باي.'}`;
  }

  // 1. Update Document Title
  document.title = title;

  // 2. Standard Meta Tags
  setMetaTag('description', description);
  if (Array.isArray(settings.metaKeywords) && settings.metaKeywords.length > 0) {
    setMetaTag('keywords', settings.metaKeywords.join(', '));
  } else {
    setMetaTag(
      'keywords',
      `${settings.storeName}, متجر إلكتروني, تسوق أونلاين, ${geo.cityAr}, السعودية, الدفع عند الاستلام, أبل باي, توصيل سريع`
    );
  }

  // 3. Open Graph (WhatsApp, Telegram, Facebook)
  setMetaTag('og:title', title, true);
  setMetaTag('og:description', description, true);
  setMetaTag('og:type', activeProduct ? 'product' : 'website', true);
  setMetaTag('og:url', currentUrl, true);
  setMetaTag('og:locale', 'ar_SA', true);
  setMetaTag('og:site_name', settings.storeName, true);
  if (imageUrl) {
    setMetaTag('og:image', imageUrl, true);
  }

  // 4. Twitter Cards
  setMetaTag('twitter:card', 'summary_large_image');
  setMetaTag('twitter:title', title);
  setMetaTag('twitter:description', description);
  if (imageUrl) {
    setMetaTag('twitter:image', imageUrl);
  }

  // 5. Saudi GEO Tags (Local Search & Exposure)
  setMetaTag('geo.region', 'SA');
  setMetaTag('geo.placename', `${geo.cityAr}, Saudi Arabia`);
  setMetaTag('geo.position', `${lat};${lng}`);
  setMetaTag('ICBM', `${lat}, ${lng}`);

  // 6. JSON-LD Schema.org Structured Data
  let jsonLdEl = document.getElementById('store-jsonld-schema') as HTMLScriptElement | null;
  if (!jsonLdEl) {
    jsonLdEl = document.createElement('script');
    jsonLdEl.id = 'store-jsonld-schema';
    jsonLdEl.type = 'application/ld+json';
    document.head.appendChild(jsonLdEl);
  }
  jsonLdEl.textContent = JSON.stringify(buildStoreJsonLd(store, currentUrl));
}

/**
 * Intelligent AI SEO & Appearance Recommendation Engine
 * Analyzes store name, categories, and city to recommend optimal SEO title,
 * meta description, high-intent keywords, and brand palette.
 */
export function generateAIOptimizedSEO(store: StoreInstance): {
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string[];
  heroTitle: string;
  heroSubtitle: string;
  announcementText: string;
  geoCity: string;
  palette: {
    primaryColor: string;
    accentColor: string;
    backgroundColor: string;
  };
} {
  const storeName = store.settings.storeName || 'متجرنا';
  const city = store.settings.geoCity || store.settings.city || 'الرياض';
  const products = store.products || [];
  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));
  const primaryCat = categories[0] || 'منتجات فاخرة';

  const metaTitle = `${storeName} | أفضل عروض ${primaryCat} في ${city} والسعودية`;
  const metaDescription = `تسوق الآن من ${storeName} تشكيلة راقية من ${categories.slice(0, 3).join(' و ') || primaryCat}. توصيل سريع في ${city} وكافة مناطق المملكة والدفع عند الاستلام مع أبل باي ومدى.`;
  const metaKeywords = [
    storeName,
    primaryCat,
    ...categories,
    `متجر ${city}`,
    'تسوق أونلاين السعودية',
    'الدفع عند الاستلام',
    'توصيل سريع',
    'عروض خاصة',
  ].slice(0, 8);

  const heroTitle = `أناقة واختيارات استثنائية من ${storeName}`;
  const heroSubtitle = `اكتشف مجموعتنا الحصرية المختارة بعناية، مع شحن مباشر إلى باب منزلك في ${city} وضمان استبدال ذهبي.`;
  const announcementText = `✨ شحن سريع لكافة مدن المملكة | خصومات خاصة والدفع عند الاستلام أو بأبل باي 🛍️`;

  return {
    metaTitle,
    metaDescription,
    metaKeywords,
    heroTitle,
    heroSubtitle,
    announcementText,
    geoCity: city,
    palette: {
      primaryColor: '#0F172A',
      accentColor: '#2563EB',
      backgroundColor: '#F8FAFC',
    },
  };
}
