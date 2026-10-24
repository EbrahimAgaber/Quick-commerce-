import type { IncomingMessage, ServerResponse } from 'http';
import * as crypto from 'crypto';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // Unix timestamp in ms
}

interface MemoryRateLimitBucket {
  timestamps: number[];
  lastPruned: number;
}

const memorySlidingWindows = new Map<string, MemoryRateLimitBucket>();
const CLEANUP_INTERVAL_MS = 60 * 1000;
let lastGlobalCleanup = Date.now();

/**
 * Periodically prunes expired timestamps to prevent memory leaks in serverless runtimes.
 */
function pruneStaleWindows() {
  const now = Date.now();
  if (now - lastGlobalCleanup < CLEANUP_INTERVAL_MS) return;
  lastGlobalCleanup = now;

  for (const [key, bucket] of memorySlidingWindows.entries()) {
    // If bucket has no activity in the last 15 minutes, remove it entirely
    if (bucket.timestamps.length === 0 || (bucket.timestamps[bucket.timestamps.length - 1] < now - 15 * 60 * 1000)) {
      memorySlidingWindows.delete(key);
    }
  }
}

/**
 * Distributed or Sliding-Window In-Memory Rate Limiter.
 * Evaluates request count within a sliding window of `windowMs`.
 */
export async function evaluateRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  // 1. If Upstash Redis REST is configured, execute distributed sliding window
  if (upstashUrl && upstashToken) {
    try {
      const windowSec = Math.ceil(windowMs / 1000);
      const redisKey = `ratelimit:${key}`;
      
      // Upstash REST pipeline for sliding-window sorted set
      const pipelineRes = await fetch(`${upstashUrl}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${upstashToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['ZREMRANGEBYSCORE', redisKey, 0, now - windowMs],
          ['ZCARD', redisKey],
          ['ZADD', redisKey, now, `${now}-${Math.random()}`],
          ['EXPIRE', redisKey, windowSec],
        ]),
      });

      if (pipelineRes.ok) {
        const results = await pipelineRes.json();
        // results[1] is the output of ZCARD before adding current
        const currentCount = (results[1]?.result as number) || 0;
        const allowed = currentCount < maxRequests;
        return {
          allowed,
          limit: maxRequests,
          remaining: Math.max(0, maxRequests - currentCount - (allowed ? 1 : 0)),
          resetAt: now + windowMs,
        };
      }
    } catch (err) {
      console.warn('Upstash rate limit error, falling back to local memory window:', err);
    }
  }

  // 2. High-precision In-Memory Sliding Window
  pruneStaleWindows();

  let bucket = memorySlidingWindows.get(key);
  if (!bucket) {
    bucket = { timestamps: [], lastPruned: now };
    memorySlidingWindows.set(key, bucket);
  }

  // Filter out timestamps outside the sliding window
  const windowStart = now - windowMs;
  bucket.timestamps = bucket.timestamps.filter((ts) => ts > windowStart);

  const currentCount = bucket.timestamps.length;
  if (currentCount >= maxRequests) {
    const oldest = bucket.timestamps[0] || windowStart;
    return {
      allowed: false,
      limit: maxRequests,
      remaining: 0,
      resetAt: oldest + windowMs,
    };
  }

  bucket.timestamps.push(now);
  return {
    allowed: true,
    limit: maxRequests,
    remaining: maxRequests - currentCount - 1,
    resetAt: now + windowMs,
  };
}

/**
 * Synchronous/Backward-compatible rate limiter helper.
 */
export function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  pruneStaleWindows();

  let bucket = memorySlidingWindows.get(key);
  if (!bucket) {
    bucket = { timestamps: [], lastPruned: now };
    memorySlidingWindows.set(key, bucket);
  }

  const windowStart = now - windowMs;
  bucket.timestamps = bucket.timestamps.filter((ts) => ts > windowStart);

  if (bucket.timestamps.length >= maxRequests) {
    return false;
  }

  bucket.timestamps.push(now);
  return true;
}

/**
 * Sets standard IETF rate-limit response headers
 */
export function setRateLimitHeaders(res: any, result: RateLimitResult): void {
  if (!res || typeof res.setHeader !== 'function') return;
  res.setHeader('X-RateLimit-Limit', result.limit.toString());
  res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
  res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000).toString());
}

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-app-check-token, x-turnstile-token');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return false; // Handled preflight
  }

  return true;
}

/**
 * Extracts client IP from standard proxy and CDN headers (Cloudflare, Vercel, standard X-Forwarded-For)
 */
export function getClientIp(req: any): string {
  // Cloudflare Connecting IP is highest fidelity when behind Cloudflare
  const cfIp = req.headers?.['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.trim()) {
    return cfIp.trim();
  }

  // True-Client-IP header
  const trueClientIp = req.headers?.['true-client-ip'];
  if (typeof trueClientIp === 'string' && trueClientIp.trim()) {
    return trueClientIp.trim();
  }

  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }

  return req.socket?.remoteAddress || req.connection?.remoteAddress || '127.0.0.1';
}

/**
 * Verifies Cloudflare Turnstile bot token
 */
export async function verifyTurnstileToken(
  token: string,
  clientIp?: string
): Promise<{ success: boolean; error?: string }> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  // If not configured, allow bypass in non-production environments
  if (!secretKey) {
    if (process.env.NODE_ENV === 'production') {
      return { success: false, error: 'TURNSTILE_SECRET_KEY is not configured in production.' };
    }
    return { success: true };
  }

  if (!token || typeof token !== 'string') {
    return { success: false, error: 'رمز التحقق من الروبوت (Turnstile) مطلوب.' };
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (clientIp) {
      formData.append('remoteip', clientIp);
    }

    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });

    const data = await verifyRes.json();
    if (data.success) {
      return { success: true };
    }

    return {
      success: false,
      error: 'فشل التحقق الأمني ضد برامج الروبوت. يرجى إعادة المحاولة.',
    };
  } catch (err: any) {
    console.error('Turnstile verification error:', err);
    return { success: false, error: 'تعذر التحقق من البصمة الأمنية.' };
  }
}

/**
 * Generates an HMAC-SHA256 signature for outbound merchant webhooks
 */
export function generateWebhookSignature(
  secret: string,
  payload: string,
  timestamp: number = Date.now()
): { signature: string; header: string; timestamp: number } {
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  return {
    signature,
    header: `t=${timestamp},v1=${signature}`,
    timestamp,
  };
}

/**
 * Validates an incoming webhook HMAC signature
 */
export function verifyWebhookSignature(
  secret: string,
  payload: string,
  signatureHeader: string,
  toleranceSeconds: number = 300
): boolean {
  if (!secret || !signatureHeader) return false;

  const parts = signatureHeader.split(',');
  const timestampPart = parts.find((p) => p.startsWith('t='));
  const signaturePart = parts.find((p) => p.startsWith('v1='));

  if (!timestampPart || !signaturePart) return false;

  const timestamp = parseInt(timestampPart.substring(2), 10);
  const receivedSig = signaturePart.substring(3);

  if (isNaN(timestamp)) return false;

  // Check tolerance window to prevent replay attacks
  const now = Date.now();
  if (Math.abs(now - timestamp) > toleranceSeconds * 1000) {
    return false;
  }

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(receivedSig), Buffer.from(expectedSig));
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
