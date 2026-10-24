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
    location: { origin: 'https://storelink.sa' },
  };
}

import { 
  STANDARD_UNITS, 
  getProductUnitMeta, 
  getProductUnitLabel, 
  getProductZatcaUnitCode,
  Product,
  Order
} from '../src/types/store';
import { parseProductsCsv } from '../src/utils/csvProductParser';
import { StoreManager } from '../src/services/storeManager';
import { DEFAULT_SETTINGS } from '../src/services/storeStorage';
import { buildWhatsAppInvoiceMessage } from '../src/utils/whatsappInvoice';
import { ZatcaPhase2Engine } from '../src/services/zatcaPhase2Engine';

describe('Product Units of Measure and Fractional Quantities', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  describe('Unit Definitions & Metadata', () => {
    it('provides standard retail units with correct arabic labels and defaults', () => {
      const kgMeta = getProductUnitMeta('kg');
      expect(kgMeta?.label).toBe('كجم');
      expect(kgMeta?.defaultStep).toBe(0.5);
      expect(kgMeta?.defaultMin).toBe(0.5);
      expect(kgMeta?.allowDecimal).toBe(true);
      expect(kgMeta?.zatcaCode).toBe('KGM');

      const meterMeta = getProductUnitMeta('meter');
      expect(meterMeta?.label).toBe('متر');
      expect(meterMeta?.defaultStep).toBe(0.5);
      expect(meterMeta?.allowDecimal).toBe(true);
      expect(meterMeta?.zatcaCode).toBe('MTR');

      const pieceMeta = getProductUnitMeta('piece');
      expect(pieceMeta?.label).toBe('حبة');
      expect(pieceMeta?.defaultStep).toBe(1);
      expect(pieceMeta?.allowDecimal).toBe(false);
      expect(pieceMeta?.zatcaCode).toBe('PCE');

      const dozenMeta = getProductUnitMeta('dozen');
      expect(dozenMeta?.label).toBe('درزن');
      expect(dozenMeta?.zatcaCode).toBe('DZN');
    });

    it('falls back to custom unit labels when specified', () => {
      expect(getProductUnitLabel('custom', 'تولة')).toBe('تولة');
      expect(getProductUnitLabel('kg', 'كيلو')).toBe('كيلو');
      expect(getProductUnitLabel('piece', undefined)).toBe('حبة');
    });

    it('maps ZATCA UNECE codes correctly', () => {
      expect(getProductZatcaUnitCode('kg')).toBe('KGM');
      expect(getProductZatcaUnitCode('meter')).toBe('MTR');
      expect(getProductZatcaUnitCode('liter')).toBe('LTR');
      expect(getProductZatcaUnitCode('dozen')).toBe('DZN');
      expect(getProductZatcaUnitCode('box')).toBe('BX');
      expect(getProductZatcaUnitCode('piece')).toBe('PCE');
      expect(getProductZatcaUnitCode(undefined)).toBe('PCE');
    });
  });

  describe('CSV Import with Measurement Units', () => {
    it('parses English and Arabic unit columns and fractional step/min values', () => {
      const csv = `name,price,category,stock,unit,min_quantity,quantity_step
عسل جبلي حر,180,أغذية,50,kg,0.5,0.5
قماش صوف إنجليزي,120,أقمشة,80,meter,1,0.25
دهن عود كلمنتان,250,عطور,10,تولة,0.25,0.25
علبة تمر سكري فاخر,45,تمور,100,box,1,1`;

      const result = parseProductsCsv(csv);
      expect(result.validProducts.length).toBe(4);

      const honey = result.validProducts[0];
      expect(honey.unit).toBe('kg');
      expect(honey.minQuantity).toBe(0.5);
      expect(honey.quantityStep).toBe(0.5);

      const fabric = result.validProducts[1];
      expect(fabric.unit).toBe('meter');
      expect(fabric.minQuantity).toBe(1);
      expect(fabric.quantityStep).toBe(0.25);

      const oud = result.validProducts[2];
      expect(oud.unit).toBe('tola');
      expect(oud.minQuantity).toBe(0.25);

      const dates = result.validProducts[3];
      expect(dates.unit).toBe('box');
    });

    it('preserves fractional stock quantities instead of flooring them', () => {
      const csv = `name,price,stock,unit
زعفران نقيل إيراني,95,12.5,gram`;
      const result = parseProductsCsv(csv);
      expect(result.validProducts.length).toBe(1);
      expect(result.validProducts[0].stockQuantity).toBe(12.5);
    });
  });

  describe('Financial Calculations & Floating Point Precision', () => {
    it('calculates fractional quantities with clean 2-decimal arithmetic', () => {
      // 1.5 kg * 150 SAR = 225.00 SAR
      const price1 = 150;
      const qty1 = 1.5;
      const line1 = Math.round(price1 * qty1 * 100) / 100;
      expect(line1).toBe(225);

      // 0.75 meter * 65 SAR = 48.75 SAR
      const price2 = 65;
      const qty2 = 0.75;
      const line2 = Math.round(price2 * qty2 * 100) / 100;
      expect(line2).toBe(48.75);

      // 0.33 kg * 99 SAR = 32.67 SAR
      const price3 = 99;
      const qty3 = 0.33;
      const line3 = Math.round(price3 * qty3 * 100) / 100;
      expect(line3).toBe(32.67);

      const subtotal = Math.round((line1 + line2 + line3) * 100) / 100;
      expect(subtotal).toBe(306.42);
    });
  });

  describe('Store Order Processing & Inventory Deduction', () => {
    it('preserves fractional stock deduction in submitOrderToStore', async () => {
      const storeId = 'store_aurora_01';
      const initialStore = StoreManager.getStoreById(storeId);
      expect(initialStore).not.toBeNull();

      // Find or create a test product with 10 kg initial stock
      const testProd: Product = {
        id: 'test-honey-kg',
        name: 'عسل تجريبي للكيلو',
        category: 'أغذية',
        price: 100,
        stockQuantity: 10,
        inStock: true,
        unit: 'kg',
        unitLabel: 'كجم',
        minQuantity: 0.5,
        quantityStep: 0.5,
        variants: [],
        imageUrl: '',
        galleryImages: [],
        description: '',
        featured: false,
      };

      const updatedProducts = [testProd, ...(initialStore?.products || []).filter(p => p.id !== testProd.id)];
      StoreManager.updateStore({
        ...initialStore!,
        products: updatedProducts,
      });

      const orderPayload: Order = {
        id: 'ORD-FRACTIONAL-01',
        timestamp: new Date().toISOString(),
        customerName: 'فهد العتيبي',
        customerPhone: '0555555555',
        city: 'الرياض',
        deliveryAddress: 'حي الملز',
        paymentMethod: 'الدفع عند الاستلام',
        itemsSummary: '1.5 كجم عسل تجريبي للكيلو',
        items: [
          {
            productId: testProd.id,
            name: testProd.name,
            price: testProd.price,
            quantity: 1.5,
            unit: 'kg',
            unitLabel: 'كجم',
          },
        ],
        subtotal: 150,
        shippingFee: 0,
        grandTotal: 150,
        status: 'Received',
      };

      // Submit the order
      const result = await StoreManager.submitOrderToStore(storeId, orderPayload);

      expect(result).toBe(true);

      // Check store order and items summary has unit label
      const afterStore = StoreManager.getStoreById(storeId);
      expect(afterStore?.orders[0]?.itemsSummary).toContain('1.5 كجم');
      expect(afterStore?.orders[0]?.items[0].quantity).toBe(1.5);
      expect(afterStore?.orders[0]?.grandTotal).toBe(150);

      // Verify stock was reduced by exactly 1.5 (from 10 to 8.5, NOT floored to 9 or corrupted)
      const afterProd = afterStore?.products.find(p => p.id === testProd.id);
      expect(afterProd?.stockQuantity).toBe(8.5);
    });
  });

  describe('WhatsApp Invoice Formatting', () => {
    it('includes unit label in invoice line items', () => {
      const order: Order = {
        id: 'ORD-9999',
        timestamp: new Date().toISOString(),
        customerName: 'محمد أحمد',
        customerPhone: '0512345678',
        city: 'جدة',
        deliveryAddress: 'حي الروضة',
        paymentMethod: 'الدفع عند الاستلام',
        itemsSummary: '1.5 كجم عسل سدر',
        items: [
          {
            productId: 'p-1',
            name: 'عسل سدر بلدي',
            price: 120,
            quantity: 1.5,
            unit: 'kg',
            unitLabel: 'كجم',
          },
        ],
        subtotal: 180,
        shippingFee: 0,
        grandTotal: 180,
        status: 'Received',
      };

      const msg = buildWhatsAppInvoiceMessage(order, {
        ...DEFAULT_SETTINGS,
        storeName: 'متجر العسل',
        currency: 'ر.س',
      });

      expect(msg).toContain('• 1.5 كجم عسل سدر بلدي');
      expect(msg).toContain('180 ر.س');
    });
  });

  describe('ZATCA Phase 2 UBL XML Generation', () => {
    it('generates correct UNECE unitCode for fractional and weight products', () => {
      const zatcaEngine = new ZatcaPhase2Engine();
      const invoiceData = {
        invoiceNumber: 'INV-2026-001',
        uuid: 'a8b7c6d5-e4f3-4210-9876-543210abcdef',
        issueDate: '2026-10-24',
        issueTime: '12:00:00',
        sellerName: 'شركة التجارة العصرية',
        sellerVatNumber: '310123456700003',
        sellerAddress: {
          street: 'طريق الملك فهد',
          buildingNumber: '1234',
          city: 'الرياض',
          postalCode: '12345',
          district: 'العليا',
        },
        lineItems: [
          {
            name: 'عسل سدر بلدي',
            quantity: 1.5,
            unitPrice: 100,
            vatRate: 0.15,
            unitCode: 'KGM',
          },
        ],
      };

      const ublXml = zatcaEngine.generateUblXml(invoiceData, 'test-prev-hash');
      expect(ublXml).toContain('unitCode="KGM"');
      expect(ublXml).toContain('>1.50<');
    });
  });
});
