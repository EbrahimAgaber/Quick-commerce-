import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { RESERVED_SLUGS } from '../src/services/storeManager';

describe('Firestore Rules & Access Control (S1, S4, S6, S7)', () => {
  const rulesContent = fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf-8');

  it('rules strictly disallow client order creation (allow create: if false)', () => {
    // Orders must be written exclusively by the Admin SDK inside createOrder transaction
    const orderMatch = rulesContent.match(/match \/orders\/\{orderId\} \{[\s\S]*?\}/);
    expect(orderMatch).not.toBeNull();
    const orderRules = orderMatch![0];

    expect(orderRules).toContain('allow create: if false;');
    expect(orderRules).not.toContain('isValidOrder');
  });

  it('rules protect private merchant subcollection from non-owners', () => {
    const privateMatch = rulesContent.match(/match \/private\/\{docId\} \{[\s\S]*?\}/);
    expect(privateMatch).not.toBeNull();
    const privateRules = privateMatch![0];

    // Must require store owner authentication
    expect(privateRules).toContain('allow read, write: if isStoreOwner(storeId);');
  });

  it('rules protect order tracking projection and disallow client writes', () => {
    const trackingMatch = rulesContent.match(/match \/tracking\/\{orderId\} \{[\s\S]*?\}/);
    expect(trackingMatch).not.toBeNull();
    const trackingRules = trackingMatch![0];

    expect(trackingRules).toContain('allow get: if isValidId(orderId);');
    expect(trackingRules).toContain('allow list, write: if false;');
  });

  it('rules prevent creating or deleting the demo store store_aurora_01', () => {
    expect(rulesContent).toContain("storeId != 'store_aurora_01'");
  });

  it('disallows arbitrary listing of all stores (allow list: if false)', () => {
    const storesMatch = rulesContent.match(/match \/stores\/\{storeId\} \{[\s\S]*?match \/private/);
    expect(storesMatch).not.toBeNull();
    const storeHeader = storesMatch![0];

    expect(storeHeader).toContain('allow list: if false;');
    expect(storeHeader).not.toContain('request.query.limit <= 20');
  });

  it('maintains reserved slug list to prevent hijacking system endpoints', () => {
    expect(RESERVED_SLUGS.has('admin')).toBe(true);
    expect(RESERVED_SLUGS.has('api')).toBe(true);
    expect(RESERVED_SLUGS.has('login')).toBe(true);
    expect(RESERVED_SLUGS.has('checkout')).toBe(true);
    expect(RESERVED_SLUGS.has('aurora')).toBe(true);
  });
});
