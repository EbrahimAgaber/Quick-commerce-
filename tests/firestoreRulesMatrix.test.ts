import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { RESERVED_SLUGS } from '../src/constants/slugs';

describe('Firestore Rules Security Matrix (Phase 1)', () => {
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const rules = fs.readFileSync(rulesPath, 'utf8');

  describe('1. Orders Collection Lockdown (Server-Write-Only)', () => {
    it('blocks client direct creation of orders (allow create: if false;)', () => {
      const match = rules.match(/match \/orders\/\{orderId\}[\s\S]*?\}/);
      expect(match).not.toBeNull();
      const block = match![0];
      expect(block).toContain('allow create: if false;');
    });

    it('denies order deletion across all roles', () => {
      const match = rules.match(/match \/orders\/\{orderId\}[\s\S]*?\}/);
      expect(match).not.toBeNull();
      const block = match![0];
      expect(block).toContain('allow delete: if false;');
    });

    it('restricts order read and list strictly to verified store owner', () => {
      const match = rules.match(/match \/orders\/\{orderId\}[\s\S]*?\}/);
      expect(match).not.toBeNull();
      const block = match![0];
      expect(block).toContain('allow get, list: if isStoreOwner(storeId);');
    });

    it('restricts order updates strictly to store owner and only whitelisted operational fields', () => {
      const match = rules.match(/match \/orders\/\{orderId\}[\s\S]*?\}/);
      expect(match).not.toBeNull();
      const block = match![0];
      expect(block).toContain('allow update: if isStoreOwner(storeId) &&');
      expect(block).toContain('request.resource.data.diff(resource.data).affectedKeys().hasOnly([');
      // Ensure unauthenticated driver/shopper bypasses are completely eliminated
      expect(block).not.toContain("request.resource.data.status in ['Out for Delivery'");
      expect(block).not.toContain("request.resource.data.status == 'Return Requested'");
    });
  });

  describe('2. Tracking Projection Lockdown (Server-Write and Server-Read Only)', () => {
    it('blocks direct client read and write on /tracking/{orderId}', () => {
      const match = rules.match(/match \/tracking\/\{orderId\}[\s\S]*?\}/);
      expect(match).not.toBeNull();
      const block = match![0];
      expect(block).toContain('allow read, write: if false;');
    });
  });

  describe('3. Slug Hijacking & Reserved Slugs Protection', () => {
    it('enforces reserved slugs blocking in firestore.rules', () => {
      expect(rules).toContain('!isReservedSlug(slug)');
      expect(rules).toContain('isStoreOwner(request.resource.data.storeId)');
    });

    it('contains all critical reserved slugs in RESERVED_SLUGS', () => {
      const required = ['admin', 'api', 'app', 'login', 'aurora', 'storelink', 'tracking', 'orders', 'cart', 'checkout'];
      for (const slug of required) {
        expect(RESERVED_SLUGS).toContain(slug);
      }
    });

    it('restricts slug claiming to store owner of the referenced storeId', () => {
      const match = rules.match(/match \/slugs\/\{slug\}[\s\S]*?\}/);
      expect(match).not.toBeNull();
      const block = match![0];
      expect(block).toContain('request.resource.data.ownerId == request.auth.uid');
      expect(block).toContain('isStoreOwner(request.resource.data.storeId)');
    });
  });

  describe('4. Store & Private Config Protection', () => {
    it('restricts private config access strictly to store owner', () => {
      const match = rules.match(/match \/private\/\{docId\}[\s\S]*?\}/);
      expect(match).not.toBeNull();
      const block = match![0];
      expect(block).toContain('allow read, write: if isStoreOwner(storeId);');
    });

    it('prevents tampering with demo store store_aurora_01', () => {
      expect(rules).toContain("storeId != 'store_aurora_01'");
    });

    it('disallows arbitrary listing of stores by anonymous or non-owners', () => {
      const match = rules.match(/match \/stores\/\{storeId\}[\s\S]*?match \/private/);
      expect(match).not.toBeNull();
      const block = match![0];
      expect(block).toContain('allow list: if isSignedIn() && resource.data.ownerId == request.auth.uid;');
    });
  });

  describe('5. Delivery Captains Matrix', () => {
    it('restricts listing captains to platform owner only', () => {
      const match = rules.match(/match \/captains\/\{captainId\}[\s\S]*?\}/);
      expect(match).not.toBeNull();
      const block = match![0];
      expect(block).toContain('allow list: if isPlatformOwner();');
      expect(block).toContain("request.resource.data.status == 'pending_activation'");
    });
  });
});
