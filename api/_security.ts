import type { IncomingMessage, ServerResponse } from 'http';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const memoryRateLimitMap = new Map<string, RateLimitEntry>();

/**
 * Handles CORS headers safely.
 * Returns true if request is allowed, or false if origin is forbidden.
 */
export function handleCors(req: any, res: any): boolean {
  const allowedOriginEnv = process.env.ALLOWED_ORIGIN;
  const isProduction = process.env.NODE_ENV === 'production';
  const requestOrigin = req.headers?.origin || req.headers?.Origin;

  if (isProduction && !allowedOriginEnv) {
    // Fail closed in production if ALLOWED_ORIGIN is not configured
    res.setHeader('Access-Control-Allow-Origin', 'null');
    return false;
  }

  let finalOrigin = '*';
  if (allowedOriginEnv) {
    const allowedList = allowedOriginEnv.split(',').map((o) => o.trim().toLowerCase());
    if (requestOrigin && allowedList.includes(requestOrigin.toLowerCase())) {
      finalOrigin = requestOrigin;
    } else if (allowedList.includes('*')) {
      finalOrigin = '*';
    } else {
      res.setHeader('Access-Control-Allow-Origin', allowedList[0] || 'null');
      return false;
    }
  } else if (!isProduction) {
    finalOrigin = requestOrigin || '*';
  }

  res.setHeader('Access-Control-Allow-Origin', finalOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-app-check-token');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return false; // Handled preflight
  }

  return true;
}

/**
 * Simple in-memory rate limiter per key (IP, phone, merchantId).
 */
export function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = memoryRateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    memoryRateLimitMap.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count += 1;
  return true;
}

/**
 * Extracts client IP from standard proxy headers
 */
export function getClientIp(req: any): string {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.connection?.remoteAddress || '127.0.0.1';
}

/**
 * Fixed server-side system templates for Gemini AI (cannot be arbitrarily overridden by client)
 */
export const AI_TEMPLATES: Record<string, string> = {
  product_description:
    'أنت كاتب محتوى تسويقي متخصص في التجارة الإلكترونية باللغة العربية. اكتب وصفاً جذاباً واحترافياً ومقنعاً للمنتج التالي يبرز مميزاته وفوائده ويدفع العميل للشراء فوراً. استخدم لغة عربية راقية وموجزة بنقاط واضحة.',
  tagline:
    'أنت خبير في ابتكار الشعارات التجارية (Taglines) للمتاجر الإلكترونية في السعودية ودول الخليج. اكتب 3 خيارات لشعارات تسويقية قصيرة جداً ومبتكرة ورنانة تعكس الفخامة والجودة وسرعة التوصيل.',
  store_hero:
    'أنت مصمم هويات تجارية وخبير تسويق رقمي. اكتب عنواناً رئيسياً (Hero Title) وعنواناً فرعياً جذاباً لصفحة الهبوط الخاصة بمتجر إلكتروني سعودي حديث.',
};
