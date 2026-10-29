export const RESERVED_SLUGS: readonly string[] = [
  'admin',
  'api',
  'app',
  'login',
  'register',
  'auth',
  's',
  'aurora',
  'storelink',
  'store',
  'dashboard',
  'checkout',
  'orders',
  'cart',
  'static',
  'assets',
  'tracking',
  'null',
  'undefined',
  'privacy',
  'terms',
  'help',
  'settings',
  'webhook',
  'webhooks',
] as const;

export const RESERVED_SLUGS_SET = new Set<string>(RESERVED_SLUGS);

export function isReservedSlug(slug: string): boolean {
  if (!slug || typeof slug !== 'string') return true;
  return RESERVED_SLUGS_SET.has(slug.trim().toLowerCase());
}
