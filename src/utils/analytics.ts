import { CartItem, Order, Product, StoreSettings } from '../types/store';

/**
 * Multi-Platform Marketing Analytics Dispatcher
 * Supports Google Analytics 4 (GA4), Meta (Facebook) Pixel, TikTok Pixel, and Snapchat Pixel.
 * Fails safely and silently if ad-blockers block scripts or if running in server environments.
 */

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
    fbq?: (...args: any[]) => void;
    ttq?: {
      track: (event: string, params?: any) => void;
      page: () => void;
      load: (id: string) => void;
    };
    snaptr?: (...args: any[]) => void;
  }
}

let initializedPixels: {
  ga4?: string;
  fb?: string;
  tiktok?: string;
  snapchat?: string;
} = {};

/**
 * Injects marketing pixel scripts into the document head safely
 */
export function initializeMarketingPixels(settings: StoreSettings) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // 1. Google Analytics 4
  if (settings.googleAnalyticsId && settings.googleAnalyticsId !== initializedPixels.ga4) {
    try {
      const gaScript = document.createElement('script');
      gaScript.async = true;
      gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${settings.googleAnalyticsId}`;
      document.head.appendChild(gaScript);

      window.dataLayer = window.dataLayer || [];
      window.gtag = function () {
        window.dataLayer?.push(arguments);
      };
      window.gtag('js', new Date());
      window.gtag('config', settings.googleAnalyticsId, { send_page_view: true });
      initializedPixels.ga4 = settings.googleAnalyticsId;
    } catch (e) {
      console.debug('Failed to initialize GA4:', e);
    }
  }

  // 2. Meta (Facebook) Pixel
  if (settings.facebookPixelId && settings.facebookPixelId !== initializedPixels.fb) {
    try {
      /* eslint-disable */
      (function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
        if (f.fbq) return;
        n = f.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = !0;
        n.version = '2.0';
        n.queue = [];
        t = b.createElement(e);
        t.async = !0;
        t.src = v;
        s = b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t, s);
      })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      /* eslint-enable */

      window.fbq?.('init', settings.facebookPixelId);
      window.fbq?.('track', 'PageView');
      initializedPixels.fb = settings.facebookPixelId;
    } catch (e) {
      console.debug('Failed to initialize Facebook Pixel:', e);
    }
  }

  // 3. TikTok Pixel
  if (settings.tiktokPixelId && settings.tiktokPixelId !== initializedPixels.tiktok) {
    try {
      /* eslint-disable */
      (function (w: any, d: any, t: any) {
        w.TiktokAnalyticsObject = t;
        var ttq = (w[t] = w[t] || []);
        ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie'];
        ttq.setAndDefer = function (t: any, e: any) {
          t[e] = function () {
            t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
          };
        };
        for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
        ttq.instance = function (t: any) {
          for (var e = ttq._i[t] || [], n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]);
          return e;
        };
        ttq.load = function (e: any, n: any) {
          var i = 'https://analytics.tiktok.com/i18n/pixel/events.js';
          ttq._i = ttq._i || {};
          ttq._i[e] = [];
          ttq._i[e]._u = i;
          ttq._t = ttq._t || {};
          ttq._t[e] = +new Date();
          ttq._o = ttq._o || {};
          ttq._o[e] = n || {};
          var o = document.createElement('script');
          o.type = 'text/javascript';
          o.async = !0;
          o.src = i + '?sdkid=' + e + '&lib=' + t;
          var a = document.getElementsByTagName('script')[0];
          a.parentNode?.insertBefore(o, a);
        };
        ttq.load(settings.tiktokPixelId);
        ttq.page();
      })(window, document, 'ttq');
      /* eslint-enable */
      initializedPixels.tiktok = settings.tiktokPixelId;
    } catch (e) {
      console.debug('Failed to initialize TikTok Pixel:', e);
    }
  }

  // 4. Snapchat Pixel
  if (settings.snapchatPixelId && settings.snapchatPixelId !== initializedPixels.snapchat) {
    try {
      /* eslint-disable */
      (function (e: any, t: any, n: any) {
        if (e.snaptr) return;
        var a: any = (e.snaptr = function () {
          a.handleRequest ? a.handleRequest.apply(a, arguments) : a.queue.push(arguments);
        });
        a.queue = [];
        var s = 'script';
        var r = t.createElement(s);
        r.async = !0;
        r.src = n;
        var u = t.getElementsByTagName(s)[0];
        u.parentNode.insertBefore(r, u);
      })(window, document, 'https://sc-static.net/scevent.min.js');
      /* eslint-enable */
      window.snaptr?.('init', settings.snapchatPixelId);
      window.snaptr?.('track', 'PAGE_VIEW');
      initializedPixels.snapchat = settings.snapchatPixelId;
    } catch (e) {
      console.debug('Failed to initialize Snapchat Pixel:', e);
    }
  }
}

/**
 * Safely track ViewItem event across all enabled platforms
 */
export function trackViewItem(product: Product, currency: string = 'SAR') {
  if (typeof window === 'undefined') return;
  try {
    const price = product.salePrice && product.salePrice > 0 ? product.salePrice : product.price;

    window.gtag?.('event', 'view_item', {
      currency,
      value: price,
      items: [
        {
          item_id: product.id,
          item_name: product.name,
          price,
          item_category: product.category,
        },
      ],
    });

    window.fbq?.('track', 'ViewContent', {
      content_name: product.name,
      content_ids: [product.id],
      content_type: 'product',
      value: price,
      currency,
    });

    window.ttq?.track('ViewContent', {
      content_id: product.id,
      content_type: 'product',
      content_name: product.name,
      value: price,
      currency,
    });

    window.snaptr?.('track', 'VIEW_CONTENT', {
      item_ids: [product.id],
      price,
      currency,
    });
  } catch (err) {
    console.debug('Analytics trackViewItem error:', err);
  }
}

/**
 * Safely track AddToCart event
 */
export function trackAddToCart(item: CartItem, currency: string = 'SAR') {
  if (typeof window === 'undefined') return;
  try {
    const price =
      item.product.salePrice && item.product.salePrice > 0
        ? item.product.salePrice
        : item.product.price;
    const value = price * item.quantity;

    window.gtag?.('event', 'add_to_cart', {
      currency,
      value,
      items: [
        {
          item_id: item.product.id,
          item_name: item.product.name,
          item_variant: item.selectedVariant,
          price,
          quantity: item.quantity,
        },
      ],
    });

    window.fbq?.('track', 'AddToCart', {
      content_name: item.product.name,
      content_ids: [item.product.id],
      content_type: 'product',
      value,
      currency,
    });

    window.ttq?.track('AddToCart', {
      content_id: item.product.id,
      content_name: item.product.name,
      quantity: item.quantity,
      value,
      currency,
    });

    window.snaptr?.('track', 'ADD_CART', {
      item_ids: [item.product.id],
      price: value,
      currency,
    });
  } catch (err) {
    console.debug('Analytics trackAddToCart error:', err);
  }
}

/**
 * Safely track BeginCheckout event
 */
export function trackBeginCheckout(items: CartItem[], total: number, currency: string = 'SAR') {
  if (typeof window === 'undefined') return;
  try {
    window.gtag?.('event', 'begin_checkout', {
      currency,
      value: total,
      items: items.map((i) => ({
        item_id: i.product.id,
        item_name: i.product.name,
        quantity: i.quantity,
        price: i.product.salePrice && i.product.salePrice > 0 ? i.product.salePrice : i.product.price,
      })),
    });

    window.fbq?.('track', 'InitiateCheckout', {
      value: total,
      currency,
      num_items: items.reduce((sum, i) => sum + i.quantity, 0),
    });

    window.ttq?.track('InitiateCheckout', {
      value: total,
      currency,
    });

    window.snaptr?.('track', 'START_CHECKOUT', {
      price: total,
      currency,
    });
  } catch (err) {
    console.debug('Analytics trackBeginCheckout error:', err);
  }
}

/**
 * Safely track Purchase event
 */
export function trackPurchase(order: Order, currency: string = 'SAR') {
  if (typeof window === 'undefined') return;
  try {
    window.gtag?.('event', 'purchase', {
      transaction_id: order.id,
      value: order.grandTotal,
      currency,
      shipping: order.shippingFee,
      items: (order.items || []).map((i) => ({
        item_id: i.productId,
        item_name: i.name,
        price: i.price,
        quantity: i.quantity,
      })),
    });

    window.fbq?.('track', 'Purchase', {
      value: order.grandTotal,
      currency,
      content_type: 'product',
    });

    window.ttq?.track('CompletePayment', {
      value: order.grandTotal,
      currency,
    });

    window.snaptr?.('track', 'PURCHASE', {
      price: order.grandTotal,
      currency,
      transaction_id: order.id,
    });
  } catch (err) {
    console.debug('Analytics trackPurchase error:', err);
  }
}
