import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { RESERVED_SLUGS } from '../src/services/storeManager';

describe('Firestore Rules & Access Control (S1, S4, S6, S7)', () => {
  const rulesContent = fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf-8');

  it('rules lockdown direct client creation on orders and restrict management to store owners', () => {
    const orderMatch = rulesContent.match(/match \/orders\/\{orderId\} \{[\s\S]*?\}/);
    expect(orderMatch).not.toBeNull();
    const orderRules = orderMatch![0];

    // Phase 1 lock down: orders are server-write only
    expect(orderRules).toContain('allow create: if false;');
    expect(orderRules).toContain('allow get, list: if isStoreOwner(storeId);');
    expect(orderRules).toContain('allow delete: if false;');
    expect(orderRules).toContain('returnStatus');
    expect(orderRules).toContain('driverDeliveredAt');
  });

  it('rules protect private merchant subcollection from non-owners', () => {
    const privateMatch = rulesContent.match(/match \/private\/\{docId\} \{[\s\S]*?\}/);
    expect(privateMatch).not.toBeNull();
    const privateRules = privateMatch![0];

    // Must require store owner authentication
    expect(privateRules).toContain('allow read, write: if isStoreOwner(storeId);');
  });

  it('rules protect order tracking projection and disallow arbitrary listing', () => {
    const trackingMatch = rulesContent.match(/match \/tracking\/\{orderId\} \{[\s\S]*?\}/);
    expect(trackingMatch).not.toBeNull();
    const trackingRules = trackingMatch![0];

    // Phase 1 lock down: tracking is server-write and server-read only (via /api/tracking.ts)
    expect(trackingRules).toContain('allow read, write: if false;');
  });

  it('rules prevent creating or deleting the demo store store_aurora_01', () => {
    expect(rulesContent).toContain("storeId != 'store_aurora_01'");
  });

  it('disallows arbitrary public listing of stores and restricts list to owner', () => {
    const storesMatch = rulesContent.match(/match \/stores\/\{storeId\} \{[\s\S]*?match \/private/);
    expect(storesMatch).not.toBeNull();
    const storeHeader = storesMatch![0];

    expect(storeHeader).toContain('allow list: if isSignedIn() && resource.data.ownerId == request.auth.uid;');
    expect(storeHeader).not.toContain('request.query.limit <= 20');
  });

  it('maintains reserved slug list to prevent hijacking system endpoints', () => {
    expect(RESERVED_SLUGS.has('admin')).toBe(true);
    expect(RESERVED_SLUGS.has('api')).toBe(true);
    expect(RESERVED_SLUGS.has('login')).toBe(true);
    expect(RESERVED_SLUGS.has('checkout')).toBe(true);
    expect(RESERVED_SLUGS.has('aurora')).toBe(true);
  });

  it('strictly restricts platform super-owner privileges to gaberibra48@gmail.com', async () => {
    const { isPlatformSuperOwner, PLATFORM_OWNER_EMAIL } = await import('../src/utils/security');
    expect(PLATFORM_OWNER_EMAIL).toBe('gaberibra48@gmail.com');

    // Super owner email
    expect(isPlatformSuperOwner('gaberibra48@gmail.com')).toBe(true);
    expect(isPlatformSuperOwner('GABERIBRA48@GMAIL.COM')).toBe(true);
    expect(isPlatformSuperOwner({ email: 'gaberibra48@gmail.com' })).toBe(true);

    // Any other user or merchant
    expect(isPlatformSuperOwner('merchant@quick.sa')).toBe(false);
    expect(isPlatformSuperOwner('attacker@gmail.com')).toBe(false);
    expect(isPlatformSuperOwner(null)).toBe(false);
    expect(isPlatformSuperOwner(undefined)).toBe(false);
    expect(isPlatformSuperOwner({ email: 'other@gmail.com' })).toBe(false);
  });
});
