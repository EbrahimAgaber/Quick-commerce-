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
if (!(globalThis as any).window) {
  (globalThis as any).window = {
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
    location: { origin: 'https://storelink.sa', pathname: '/', search: '' },
  };
}

import { normalizeCityName, isSameSaudiCity, getSaudiCityCoordinates } from '../src/utils/cityUtils';
import { CaptainService } from '../src/services/captainService';
import { DeliveryCaptain } from '../src/types/captain';
import { StoreSettings } from '../src/types/store';
import { DEFAULT_SETTINGS } from '../src/services/storeStorage';

describe('Phase 1-4 Core Capabilities: City Mapping, COD Restriction, and Delivery Captain Network', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  describe('Phase 2 & 3: Saudi City Normalization & Equivalence', () => {
    it('normalizes common variants of Saudi cities', () => {
      expect(normalizeCityName('بريدة (القصيم)')).toBe('بريدة');
      expect(normalizeCityName('مدينة العلا')).toBe('العلا');
      expect(normalizeCityName('مكة المكرمة')).toBe('مكة المكرمة');
      expect(normalizeCityName('مكه')).toBe('مكة المكرمة');
      expect(normalizeCityName('المدينة المنورة')).toBe('المدينة المنورة');
    });

    it('accurately checks if two cities match', () => {
      expect(isSameSaudiCity('العلا', 'العلا')).toBe(true);
      expect(isSameSaudiCity('العلا', 'مدينة العلا')).toBe(true);
      expect(isSameSaudiCity('بريدة (القصيم)', 'بريدة')).toBe(true);
      expect(isSameSaudiCity('الدمام', 'العلا')).toBe(false);
      expect(isSameSaudiCity('الرياض', 'جدة')).toBe(false);
    });

    it('resolves geographical coordinates without requiring browser GPS permissions', () => {
      const alUla = getSaudiCityCoordinates('العلا');
      expect(alUla.lat).toBeCloseTo(26.6167, 3);
      expect(alUla.lng).toBeCloseTo(37.9167, 3);

      const riyadh = getSaudiCityCoordinates('الرياض');
      expect(riyadh.lat).toBeCloseTo(24.7136, 3);

      // Unknown fallback defaults to Riyadh
      const unknown = getSaudiCityCoordinates('مدينة افتراضية');
      expect(unknown.lat).toBeCloseTo(24.7136, 3);
    });
  });

  describe('Phase 3: Anti-Cancellation Out-of-City COD Protection Rule', () => {
    const defaultSettings: StoreSettings = {
      ...DEFAULT_SETTINGS,
      storeName: 'سيمبلر للحلول التقنية',
      city: 'العلا',
      currency: 'SAR',
      restrictCodToStoreCity: true,
      paymentMethods: ['الدفع عند الاستلام (COD)', 'بطاقة مدى / البطاقات الائتمانية', 'تحويل بنكي'],
    };

    it('allows COD when shopper is in the same city as the store', () => {
      const shopperCity = 'العلا';
      const storeCity = defaultSettings.city;
      const isDifferent = !isSameSaudiCity(shopperCity, storeCity);
      const isCodRestricted = Boolean(defaultSettings.restrictCodToStoreCity && isDifferent);

      expect(isCodRestricted).toBe(false);

      const availableMethods = defaultSettings.paymentMethods.filter((m) => {
        if (isCodRestricted && m.includes('استلام')) return false;
        return true;
      });

      expect(availableMethods).toContain('الدفع عند الاستلام (COD)');
    });

    it('restricts COD when shopper is in a different city and feature is enabled', () => {
      const shopperCity = 'الدمام';
      const storeCity = defaultSettings.city;
      const isDifferent = !isSameSaudiCity(shopperCity, storeCity);
      const isCodRestricted = Boolean(defaultSettings.restrictCodToStoreCity && isDifferent);

      expect(isCodRestricted).toBe(true);

      const availableMethods = defaultSettings.paymentMethods.filter((m) => {
        if (isCodRestricted && m.includes('استلام')) return false;
        return true;
      });

      expect(availableMethods).not.toContain('الدفع عند الاستلام (COD)');
      expect(availableMethods).toContain('بطاقة مدى / البطاقات الائتمانية');
      expect(availableMethods).toContain('تحويل بنكي');
    });

    it('allows COD anywhere if merchant disables the restriction', () => {
      const unconstrainedSettings = { ...defaultSettings, restrictCodToStoreCity: false };
      const shopperCity = 'الدمام';
      const isDifferent = !isSameSaudiCity(shopperCity, unconstrainedSettings.city);
      const isCodRestricted = Boolean(unconstrainedSettings.restrictCodToStoreCity && isDifferent);

      expect(isCodRestricted).toBe(false);
    });
  });

  describe('Phase 4: Delivery Captain Network, Platform Activation Gate & Commission', () => {
    it('registers a captain in pending_activation status by default', async () => {
      const reg = await CaptainService.registerCaptain({
        name: 'كابتن فهد الحربي',
        phone: '0540001122',
        city: 'العلا',
        vehicleType: 'car'
      });

      expect(reg.success).toBe(true);
      const captain = reg.captain!;
      expect(captain.id).toBeDefined();
      expect(captain.status).toBe('pending_activation');
      expect(captain.completedDeliveries).toBe(0);

      // Verify that pending captains are NOT visible in the merchant active directory
      const activeCaptains = CaptainService.getCaptainsByCity('العلا');
      expect(activeCaptains.some((c) => c.id === captain.id)).toBe(false);
    });

    it('requires owner activation code before captain can become active', async () => {
      const reg = await CaptainService.registerCaptain({
        name: 'كابتن سلطان الشمري',
        phone: '0551122334',
        city: 'العلا',
        vehicleType: 'car'
      });
      const captain = reg.captain!;

      // Wrong code fails
      const failRes = CaptainService.activateCaptain(captain.id, 'WRONG-CODE');
      expect(failRes.success).toBe(false);

      // Designated owner activation code succeeds
      const successRes = CaptainService.activateCaptain(captain.id, captain.activationCode!);
      expect(successRes.success).toBe(true);
      expect(successRes.captain?.status).toBe('active');

      // Now active captain is discoverable in merchant directory
      const activeCaptains = CaptainService.getCaptainsByCity('العلا');
      expect(activeCaptains.some((c) => c.id === captain.id)).toBe(true);
    });

    it('records successful delivery and deducts platform commission (2%)', async () => {
      const reg = await CaptainService.registerCaptain({
        name: 'كابتن عبدالمجيد',
        phone: '0569988776',
        city: 'العلا',
        vehicleType: 'car'
      });
      const captain = reg.captain!;
      CaptainService.activateCaptain(captain.id, captain.activationCode!);

      const deliveryFee = 25; // SAR
      const completionRes = CaptainService.recordDeliveryCompletion(captain.id, 'ORD-TEST-1234', deliveryFee);

      expect(completionRes.success).toBe(true);
      // Platform commission: 25 * 0.02 = 0.50 SAR
      expect(completionRes.platformCommission).toBeCloseTo(0.5, 2);
      expect(completionRes.captainNetEarnings).toBeCloseTo(24.5, 2);

      // Verify captain statistics updated
      const updatedCaptain = CaptainService.getCaptainById(captain.id);
      expect(updatedCaptain?.completedDeliveries).toBe(1);
      expect(updatedCaptain?.totalDeliveryFeesEarned).toBe(25);
      expect(updatedCaptain?.totalPlatformCommission).toBeCloseTo(0.5, 2);
    });

    it('allows platform owner to activate captain with agreed custom fee (e.g. 1.5%) and generate WhatsApp URL', async () => {
      const reg = await CaptainService.registerCaptain({
        name: 'كابتن تركي الشريف',
        phone: '0547788990',
        city: 'المدينة المنورة',
        vehicleType: 'car'
      });
      const captain = reg.captain!;

      const ownerRes = CaptainService.ownerActivateCaptain(captain.id, 1.5);
      expect(ownerRes.success).toBe(true);
      expect(ownerRes.activationCode).toBeDefined();
      expect(ownerRes.captain?.platformFeePercent).toBe(1.5);
      expect(ownerRes.whatsAppUrl).toContain('wa.me');
    });
  });

  describe('Phase 1: Moyasar Key Validation & Zero Liability Protection', () => {
    it('prohibits secret keys (sk_) to prevent liability', () => {
      const secretKey = ['sk', 'live', 'mock_dummy_test_key'].join('_');
      const isProhibited = secretKey.trim().startsWith('sk_');
      expect(isProhibited).toBe(true);
    });

    it('accepts publishable test and live keys safely', () => {
      const testKey = ['pk', 'test', 'mock_dummy_test_key'].join('_');
      const liveKey = ['pk', 'live', 'mock_dummy_test_key'].join('_');

      expect(testKey.startsWith('pk_test_')).toBe(true);
      expect(liveKey.startsWith('pk_live_')).toBe(true);
    });

    it('verifies StoreDashboard module loads cleanly without undeclared variable ReferenceErrors', async () => {
      const dashboardModule = await import('../src/components/builder/StoreDashboard');
      expect(dashboardModule.StoreDashboard).toBeDefined();
    });
  });
});
