import { describe, it, expect } from 'vitest';

describe('Phase 0 Baseline Tests', () => {
  it('environment runs vitest properly', () => {
    expect(true).toBe(true);
  });

  it('verifies Node version is >= 20', () => {
    const majorVersion = parseInt(process.versions.node.split('.')[0], 10);
    expect(majorVersion).toBeGreaterThanOrEqual(20);
  });
});
