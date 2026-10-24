import { describe, it, expect, beforeEach } from 'vitest';

const storageMap = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => storageMap.get(key) ?? null,
  setItem: (key: string, value: string) => storageMap.set(key, String(value)),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
  get length() { return storageMap.size; },
  key: (i: number) => Array.from(storageMap.keys())[i] ?? null,
};

(globalThis as any).localStorage = mockLocalStorage;

const mockHeadElements: any[] = [];
if (!(globalThis as any).document) {
  (globalThis as any).document = {
    title: '',
    head: {
      appendChild: (el: any) => {
        mockHeadElements.push(el);
        return el;
      },
    },
    createElement: (tag: string) => {
      const attrs = new Map<string, string>();
      const elObj: any = {
        tagName: tag.toUpperCase(),
        setAttribute: (k: string, v: string) => {
          attrs.set(k, v);
          if (k === 'id') elObj.id = v;
          if (k === 'rel') elObj.rel = v;
          if (k === 'href') elObj.href = v;
        },
        getAttribute: (k: string) => attrs.get(k) ?? null,
        textContent: '',
        id: '',
        rel: '',
        href: '',
        remove: () => {
          const idx = mockHeadElements.indexOf(elObj);
          if (idx !== -1) mockHeadElements.splice(idx, 1);
        },
      };
      return elObj;
    },
    querySelector: (selector: string) => {
      return (
        mockHeadElements.find((el) => {
          if (selector.includes('name="description"') && el.getAttribute?.('name') === 'description') return true;
          if (selector.includes('geo.region') && el.getAttribute?.('name') === 'geo.region') return true;
          if (selector.includes('link[rel="canonical"]') && (el.getAttribute?.('rel') === 'canonical' || el.rel === 'canonical')) return true;
          return false;
        }) || null
      );
    },
    getElementById: (id: string) => {
      return mockHeadElements.find((el) => el.id === id) || null;
    },
  };
}

if (!(globalThis as any).window) {
  (globalThis as any).window = {
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
    location: { origin: 'https://storelink.sa', pathname: '/', search: '', hostname: 'localhost' },
  };
}

import { parseStoreRouteFromLocation, isPlatformHostname, buildShareableStoreUrl } from '../src/utils/urlRouter';
import { 
  resolveSaudiCityGeo, 
  buildStoreJsonLd, 
  buildProductJsonLd, 
  buildSaaSPlatformJsonLd,
  injectPlatformSEO,
  injectStoreSEO,
  setCanonicalUrl,
  generateAIOptimizedSEO,
  resolveDynamicStoreOgImage,
  DEFAULT_PLATFORM_OG_IMAGE
} from '../src/utils/seoManager';
import { StoreManager } from '../src/services/storeManager';
import { StoreInstance } from '../src/types/store';
import { spawnSync } from 'child_process';
import path from 'path';

describe('Custom Domain, URL Customization, SEO/GEO & MCP Suite', () => {
  beforeEach(() => {
    StoreManager.resetCorruptedStorage();
  });

  describe('1. URL Router & Custom Domain Resolution', () => {
    it('detects platform hostnames vs custom merchant domains correctly', () => {
      expect(isPlatformHostname('localhost')).toBe(true);
      expect(isPlatformHostname('127.0.0.1')).toBe(true);
      expect(isPlatformHostname('quick-ecommerce-saas-app.web.app')).toBe(true);
      expect(isPlatformHostname('quick-ecommerce-saas-app.firebaseapp.com')).toBe(true);

      expect(isPlatformHostname('shop.mybrand.sa')).toBe(false);
      expect(isPlatformHostname('rawnaq-store.com')).toBe(false);
      expect(isPlatformHostname('store.sa')).toBe(false);
    });

    it('extracts customDomainHostname from Location when on a custom domain', () => {
      const mockCustomLoc = {
        hostname: 'shop.mybrand.sa',
        search: '',
        pathname: '/',
        hash: '',
      } as Location;

      const route = parseStoreRouteFromLocation(mockCustomLoc);
      expect(route.customDomainHostname).toBe('shop.mybrand.sa');
      expect(route.storeSlug).toBeNull();
    });

    it('extracts query store parameter properly even on custom domains', () => {
      const mockLoc = {
        hostname: 'shop.mybrand.sa',
        search: '?store=special-event&product=p-123',
        pathname: '/',
        hash: '',
      } as Location;

      const route = parseStoreRouteFromLocation(mockLoc);
      expect(route.storeSlug).toBe('special-event');
      expect(route.productId).toBe('p-123');
      expect(route.customDomainHostname).toBe('shop.mybrand.sa');
    });

    it('buildShareableStoreUrl formats custom domains cleanly', () => {
      const normalUrl = buildShareableStoreUrl('rawnaq', 'prod-1');
      expect(normalUrl).toContain('?store=rawnaq&product=prod-1');

      const customDomainUrl = buildShareableStoreUrl('rawnaq', undefined, 'shop.mybrand.sa');
      expect(customDomainUrl).toBe('https://shop.mybrand.sa/');

      const customDomainProductUrl = buildShareableStoreUrl('rawnaq', 'prod-99', 'shop.mybrand.sa');
      expect(customDomainProductUrl).toBe('https://shop.mybrand.sa/?product=prod-99');
    });
  });

  describe('2. Slug Validation & StoreManager Domain Lookup', () => {
    it('validates candidate slugs and enforces length & character constraints', () => {
      const tooShort = StoreManager.validateSlugAvailability('ab');
      expect(tooShort.valid).toBe(false);
      expect(tooShort.error).toContain('3 أحرف');

      const validSlug = StoreManager.validateSlugAvailability('my-awesome-brand');
      expect(validSlug.valid).toBe(true);
      expect(validSlug.normalizedSlug).toBe('my-awesome-brand');
    });

    it('rejects reserved platform slugs (e.g. admin, api, store, checkout)', () => {
      const adminSlug = StoreManager.validateSlugAvailability('admin');
      expect(adminSlug.valid).toBe(false);
      expect(adminSlug.error).toContain('محجوز للنظام');

      const checkoutSlug = StoreManager.validateSlugAvailability('checkout');
      expect(checkoutSlug.valid).toBe(false);
      expect(checkoutSlug.error).toContain('محجوز للنظام');
    });

    it('finds stores by customDomain matching', () => {
      const activeStore = StoreManager.getActiveStore();
      const updated: StoreInstance = {
        ...activeStore,
        settings: {
          ...activeStore.settings,
          customDomain: 'boutique.alriyadh.sa',
        },
      };
      StoreManager.updateStore(updated, { skipCloudSync: true });

      const found = StoreManager.getStoreByCustomDomain('boutique.alriyadh.sa');
      expect(found).not.toBeNull();
      expect(found?.id).toBe(activeStore.id);

      // Protocol and trailing slash insensitive
      const foundWithProtocol = StoreManager.getStoreByCustomDomain('https://boutique.alriyadh.sa/');
      expect(foundWithProtocol?.id).toBe(activeStore.id);
    });

    it('updates store slug successfully when valid', async () => {
      const activeStore = StoreManager.getActiveStore();
      const res = await StoreManager.updateStoreSlug(activeStore.id, 'luxurious-boutique');
      expect(res.success).toBe(true);
      expect(res.updatedStore?.slug).toBe('luxurious-boutique');

      const lookup = StoreManager.getStoreBySlug('luxurious-boutique');
      expect(lookup?.id).toBe(activeStore.id);
    });
  });

  describe('3. Dynamic SEO & Saudi GEO Engine', () => {
    it('resolves Saudi cities with correct geographic coordinates', () => {
      const riyadh = resolveSaudiCityGeo('الرياض');
      expect(riyadh.cityEn).toBe('Riyadh');
      expect(riyadh.lat).toBeCloseTo(24.7136, 2);
      expect(riyadh.lng).toBeCloseTo(46.6753, 2);

      const jeddah = resolveSaudiCityGeo('جدة');
      expect(jeddah.cityEn).toBe('Jeddah');
      expect(jeddah.lat).toBeCloseTo(21.4858, 2);

      const dxbFallback = resolveSaudiCityGeo('غير محدد');
      expect(dxbFallback.cityAr).toBe('الرياض');
    });

    it('builds Google-compliant schema.org/Store JSON-LD structured data and omits fabricated reviews when unrated', () => {
      const store = StoreManager.getActiveStore();
      const jsonLd = buildStoreJsonLd(store, 'https://shop.mybrand.sa');

      expect(jsonLd['@context']).toBe('https://schema.org');
      expect(jsonLd['@type']).toBe('Store');
      expect(jsonLd.name).toBe(store.settings.storeName);
      expect(jsonLd.currenciesAccepted).toBe('SAR');
      expect(jsonLd.address.addressCountry).toBe('SA');
      expect(jsonLd.geo.latitude).toBeDefined();
      expect(jsonLd.geo.longitude).toBeDefined();

      if (jsonLd.makesOffer && jsonLd.makesOffer.length > 0) {
        const firstProd = jsonLd.makesOffer[0];
        expect(firstProd['@type']).toBe('Product');
        expect(firstProd.brand.name).toBe(store.settings.storeName);
        expect(firstProd.offers.priceValidUntil).toBeDefined();
        expect(firstProd.offers.itemCondition).toBe('https://schema.org/NewCondition');
      }
    });

    it('builds standalone Google-compliant Product JSON-LD schema with genuine ratings and omits fabricated ones', () => {
      const store = StoreManager.getActiveStore();
      const unratedProduct = { ...store.products[0], rating: undefined, reviewsCount: undefined };
      const unratedJsonLd = buildProductJsonLd(unratedProduct, store.settings, 'https://shop.mybrand.sa');
      expect(unratedJsonLd.aggregateRating).toBeUndefined();
      expect(unratedJsonLd.review).toBeUndefined();

      const ratedProduct = {
        ...store.products[0],
        rating: 4.9,
        reviewsCount: 15,
        reviews: [{ author: 'سارة', rating: 5, comment: 'ممتاز جداً', datePublished: '2026-10-01' }],
      } as any;
      const prodJsonLd = buildProductJsonLd(ratedProduct, store.settings, 'https://shop.mybrand.sa');

      expect(prodJsonLd['@context']).toBe('https://schema.org');
      expect(prodJsonLd['@type']).toBe('Product');
      expect(prodJsonLd.name).toBe(ratedProduct.name);
      expect(prodJsonLd.sku).toBe(ratedProduct.id);
      expect(prodJsonLd.aggregateRating['@type']).toBe('AggregateRating');
      expect(prodJsonLd.aggregateRating.ratingValue).toBe('4.9');
      expect(prodJsonLd.review[0]['@type']).toBe('Review');
      expect(prodJsonLd.offers.priceCurrency).toBe('SAR');
    });

    it('injects dynamic meta tags into the DOM', () => {
      const store = StoreManager.getActiveStore();
      injectStoreSEO(store);

      expect(document.title).toBeDefined();
      const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content');
      expect(metaDesc).toBeDefined();

      const geoRegion = document.querySelector('meta[name="geo.region"]')?.getAttribute('content');
      expect(geoRegion).toBe('SA');

      const scriptSchema = document.getElementById('store-jsonld-schema');
      expect(scriptSchema).not.toBeNull();
      expect(scriptSchema?.textContent).toContain('schema.org');
    });

    it('AI SEO Optimizer generates tailored copy and high-intent keywords', () => {
      const store = StoreManager.getActiveStore();
      const ai = generateAIOptimizedSEO(store);

      expect(ai.metaTitle).toContain(store.settings.storeName);
      expect(ai.metaDescription).toContain('تسوق');
      expect(ai.metaKeywords.length).toBeGreaterThan(3);
      expect(ai.heroTitle).toBeDefined();
    });

    it('builds SaaS Platform JSON-LD with WebApplication and no retail product items', () => {
      const saasLd = buildSaaSPlatformJsonLd('https://quick-ecommerce-saas-app.web.app');
      expect(saasLd['@context']).toBe('https://schema.org');
      expect(Array.isArray(saasLd['@graph'])).toBe(true);

      const webApp = saasLd['@graph'].find((item: any) => item['@type'] === 'WebApplication');
      expect(webApp).toBeDefined();
      expect(webApp.name).toContain('Quick E-Commerce');
      expect(webApp.applicationCategory).toBe('BusinessApplication');
      expect(webApp.featureList.length).toBeGreaterThan(3);

      const hasRetailProducts = saasLd['@graph'].some((item: any) => item['@type'] === 'Product' || item.makesOffer);
      expect(hasRetailProducts).toBe(false);
    });

    it('injectPlatformSEO injects SaaS metadata and removes store/product schemas', () => {
      // First inject store SEO
      const store = StoreManager.getActiveStore();
      injectStoreSEO(store);
      expect(document.getElementById('store-jsonld-schema')).not.toBeNull();

      // Now inject Platform SEO
      injectPlatformSEO('https://quick-ecommerce-saas-app.web.app');
      expect(document.title).toContain('منصة');
      expect(document.getElementById('platform-jsonld-schema')).not.toBeNull();
      // Store schema should be cleanly removed!
      expect(document.getElementById('store-jsonld-schema')).toBeNull();
      expect(document.getElementById('product-jsonld-schema')).toBeNull();
    });

        it('resolves dynamic Open Graph image following 3-tier hierarchy (Logo -> Product -> Fallback)', () => {
      const baseStore = StoreManager.getActiveStore();

      // Tier 1: Store Logo available
      const storeWithLogo = {
        ...baseStore,
        settings: {
          ...baseStore.settings,
          logoUrl: 'https://example.com/custom-store-logo.png',
        },
      };
      expect(resolveDynamicStoreOgImage(storeWithLogo)).toBe('https://example.com/custom-store-logo.png');

      // Tier 2a: Store Logo NOT available, but active product has an image
      const storeNoLogo = {
        ...baseStore,
        settings: {
          ...baseStore.settings,
          logoUrl: '',
        },
      };
      const activeProduct = {
        id: 'p-1',
        name: 'حذاء جلدي فاخر',
        price: 250,
        imageUrl: 'https://example.com/luxury-shoes.jpg',
        category: 'أحذية',
        variants: [],
        galleryImages: [],
        description: 'حذاء راقي',
        featured: true,
        inStock: true,
      };
      expect(resolveDynamicStoreOgImage(storeNoLogo, activeProduct)).toBe('https://example.com/luxury-shoes.jpg');

      // Tier 2b: Store Logo NOT available, no active product, but catalog has products with images
      const storeWithCatalog = {
        ...storeNoLogo,
        products: [
          { ...activeProduct, imageUrl: 'https://example.com/catalog-shoe-item.jpg' },
        ],
      };
      expect(resolveDynamicStoreOgImage(storeWithCatalog, null)).toBe('https://example.com/catalog-shoe-item.jpg');

      // Tier 3: Neither logo nor products have images -> Falls back to Quick E-Commerce Nano Banana asset
      const storeEmpty = {
        ...storeNoLogo,
        products: [],
      };
      expect(resolveDynamicStoreOgImage(storeEmpty, null)).toBe(DEFAULT_PLATFORM_OG_IMAGE);
    });

    it('injectStoreSEO removes platform schema and sets store-specific canonical URL', () => {
      injectPlatformSEO('https://quick-ecommerce-saas-app.web.app');
      expect(document.getElementById('platform-jsonld-schema')).not.toBeNull();

      const store = StoreManager.getActiveStore();
      injectStoreSEO(store, { customUrl: 'https://quick-ecommerce-saas-app.web.app/?store=simpler' });

      // Platform schema should be removed when viewing a store
      expect(document.getElementById('platform-jsonld-schema')).toBeNull();
      expect(document.getElementById('store-jsonld-schema')).not.toBeNull();
    });
  });

  describe('4. Standalone MCP Server CLI Verification', () => {
    const scriptPath = path.resolve(__dirname, '../scripts/mcp-store-optimizer.cjs');

    it('responds correctly to initialize JSON-RPC handshake', () => {
      const initPayload = JSON.stringify({
        jsonrpc: '2.0',
        id: 101,
        method: 'initialize',
        params: {},
      }) + '\n';

      const child = spawnSync('node', [scriptPath], {
        input: initPayload,
        encoding: 'utf-8',
        timeout: 4000,
      });

      expect(child.status).toBe(0);
      const res = JSON.parse(child.stdout.trim().split('\n')[0]);
      expect(res.id).toBe(101);
      expect(res.result.serverInfo.name).toBe('store_optimizer');
    });

    it('executes store_analyze_seo_geo tool via JSON-RPC', () => {
      const callPayload = JSON.stringify({
        jsonrpc: '2.0',
        id: 102,
        method: 'tools/call',
        params: {
          name: 'store_analyze_seo_geo',
          arguments: {
            storeName: 'متجر رونق',
            metaTitle: 'متجر رونق للعطور الفاخرة بالرياض',
            metaDescription: 'تسوق أفضل العطور مع شحن فوري في الرياض والدفع عند الاستلام وبطاقات مدى.',
            city: 'الرياض',
          },
        },
      }) + '\n';

      const child = spawnSync('node', [scriptPath], {
        input: callPayload,
        encoding: 'utf-8',
        timeout: 4000,
      });

      expect(child.status).toBe(0);
      const lines = child.stdout.trim().split('\n').filter(Boolean);
      const res = JSON.parse(lines[lines.length - 1]);
      expect(res.id).toBe(102);
      const toolContent = JSON.parse(res.result.content[0].text);
      expect(toolContent.score).toBeGreaterThan(60);
      expect(toolContent.targetCity.arabic).toBe('الرياض');
    });
  });
});
