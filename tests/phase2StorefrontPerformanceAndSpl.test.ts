import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  detectCardBrand,
  validateLuhnChecksum,
  formatCardNumberDisplay,
  sanitizeCardNumber,
} from '../src/utils/paymentBinDetector';
import { getOptimizedImageUrl } from '../src/utils/imageOptimizer';
import { buildWhatsAppInvoiceMessage } from '../src/utils/whatsappInvoice';

describe('Phase 2: Performance, Edge SSR & Backend Gateway', () => {
  describe('Milestone 2.1: Route-Based Bundle Splitting & Merchant Admin Quarantine', () => {
    it('verifies vite.config.ts isolates merchant-admin components into a separate chunk', () => {
      const viteConfigPath = path.resolve(process.cwd(), 'vite.config.ts');
      const viteContent = fs.readFileSync(viteConfigPath, 'utf8');

      expect(viteContent).toContain("return 'merchant-admin'");
      expect(viteContent).toContain("src/components/builder/");
      expect(viteContent).toContain("src/components/admin/");
    });
  });

  describe('Milestone 2.2: Saudi Mada BIN Detection & Payment Integration', () => {
    it('detects Saudi Mada debit card BINs with highest priority over generic Visa/Mastercard', () => {
      // 588845 is SAMA Mada BIN (often co-badged with Mastercard, must resolve to mada)
      expect(detectCardBrand('5888451234567890')).toBe('mada');
      // 400861 is Al Rajhi Mada BIN (co-badged with Visa)
      expect(detectCardBrand('4008610011223344')).toBe('mada');
      // 968201 is Riyad Bank Mada BIN
      expect(detectCardBrand('9682019988776655')).toBe('mada');
    });

    it('detects standard Visa, Mastercard, and American Express cards', () => {
      expect(detectCardBrand('4123456789012345')).toBe('visa');
      expect(detectCardBrand('5100123456789012')).toBe('mastercard');
      expect(detectCardBrand('378282246310005')).toBe('amex');
    });

    it('normalizes Arabic-Indic numerals and strips formatting spaces in card numbers', () => {
      const arabicCard = '٥٨٨٨٤٥ ٠٠١١ ٢٢٣٣ ٤٤';
      expect(sanitizeCardNumber(arabicCard)).toBe('5888450011223344');
      expect(detectCardBrand(arabicCard)).toBe('mada');
    });

    it('validates Luhn algorithm checksum for genuine card numbers', () => {
      // Valid test cards (e.g. standard 16-digit test Visa)
      expect(validateLuhnChecksum('4242424242424242')).toBe(true);
      // Corrupted / invalid card
      expect(validateLuhnChecksum('4242424242424241')).toBe(false);
    });

    it('formats card numbers with standard 4-digit spacing', () => {
      expect(formatCardNumberDisplay('5888450011223344')).toBe('5888 4500 1122 3344');
    });
  });

  describe('Milestone 2.3: Saudi National Address (SPL) 4-Letter Short-Code Resolution', () => {
    it('verifies endpoint api/geo/nationalAddress.ts exists and handles short-code validation', () => {
      const splApiPath = path.resolve(process.cwd(), 'api/geo/nationalAddress.ts');
      expect(fs.existsSync(splApiPath)).toBe(true);

      const content = fs.readFileSync(splApiPath, 'utf8');
      expect(content).toContain('SPL_REGIONS');
      expect(content).toContain('RRRD');
      expect(content).toContain('JEDD');
      expect(content).toContain('DAMM');
      expect(content).toContain('ALUL');
      expect(content).toContain('العلا');
      expect(content).toContain('^[A-Z]{4}\\d{4}$');
    });

    it('verifies WhatsApp invoice builder never injects base64 data URIs into message text', () => {
      const sampleOrder: any = {
        id: 'ORD-TEST1234',
        customerName: 'ابو الشباب',
        customerPhone: '0546752889',
        city: 'العلا',
        deliveryAddress: 'الصخيرات',
        subtotal: 120,
        shippingFee: 25,
        grandTotal: 145,
        paymentMethod: 'card',
        status: 'Received',
        items: [
          {
            name: 'كتاب تعلم الآلة',
            quantity: 1,
            price: 120,
            imageUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...',
          },
        ],
      };

      const sampleSettings = {
        storeName: 'سيمبلر للحلول التقنية',
        currency: 'SAR',
        logoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
      };

      const message = buildWhatsAppInvoiceMessage(sampleOrder, sampleSettings as any);
      expect(message).not.toContain('data:image/');
      expect(message).not.toContain('base64');
      expect(message).not.toContain('🖼️ *معاينة الطلب:*');
      expect(message).toContain('العلا');
      expect(message).toContain('الصخيرات');
      expect(message).toContain('#ORD-TEST1234');
    });
  });

  describe('Milestone 2.4: Zero-CLS Arabic Typography & Image CDN Optimization', () => {
    it('verifies Cairo font fallback metric overrides exist in src/index.css to eliminate CLS', () => {
      const cssPath = path.resolve(process.cwd(), 'src/index.css');
      const cssContent = fs.readFileSync(cssPath, 'utf8');

      expect(cssContent).toContain("font-family: 'Cairo-Fallback'");
      expect(cssContent).toContain('ascent-override: 96.5%');
      expect(cssContent).toContain('descent-override: 26.5%');
      expect(cssContent).toContain('size-adjust: 104.2%');
      expect(cssContent).toContain("'Cairo', 'Cairo-Fallback'");
    });

    it('optimizes external Unsplash product image URLs with dynamic format and dimensions', () => {
      const rawUrl = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30';
      const optimized = getOptimizedImageUrl(rawUrl, 400, 80);

      expect(optimized).toContain('auto=format');
      expect(optimized).toContain('w=400');
      expect(optimized).toContain('q=80');
    });
  });
});
