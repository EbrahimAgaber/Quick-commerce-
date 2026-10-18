import { describe, it, expect, vi } from 'vitest';
import { normalizeArabicDigits, normalizeSaudiPhoneNumber } from '../src/utils/digits';
import { 
  trackViewItem, 
  trackAddToCart, 
  trackBeginCheckout, 
  trackPurchase 
} from '../src/utils/analytics';
import { Product, CartItem, Order } from '../src/types/store';

describe('Arabic-Indic Digit Normalization & Saudi Phone Validation', () => {
  it('converts Eastern Arabic numerals to standard Latin digits', () => {
    expect(normalizeArabicDigits('٠٥١٢٣٤٥٦٧٨')).toBe('0512345678');
    expect(normalizeArabicDigits('مرحبا ١٢٣')).toBe('مرحبا 123');
    expect(normalizeArabicDigits('۰۵۱۲۳۴۵۶۷۸')).toBe('0512345678'); // Persian variants
  });

  it('validates and normalizes various Saudi mobile phone inputs', () => {
    // Standard 05XXXXXXXX
    const res1 = normalizeSaudiPhoneNumber('0501234567');
    expect(res1.isValid).toBe(true);
    expect(res1.normalized).toBe('0501234567');
    expect(res1.formattedInternational).toBe('+966501234567');

    // Eastern Arabic numerals ٠٥٠١٢٣٤٥٦٧
    const res2 = normalizeSaudiPhoneNumber('٠٥٠١٢٣٤٥٦٧');
    expect(res2.isValid).toBe(true);
    expect(res2.normalized).toBe('0501234567');

    // International format +966501234567
    const res3 = normalizeSaudiPhoneNumber('+966501234567');
    expect(res3.isValid).toBe(true);
    expect(res3.normalized).toBe('0501234567');

    // Without leading 0: 501234567
    const res4 = normalizeSaudiPhoneNumber('501234567');
    expect(res4.isValid).toBe(true);
    expect(res4.normalized).toBe('0501234567');

    // Invalid non-mobile or wrong length
    const res5 = normalizeSaudiPhoneNumber('0112345678'); // Riyadh landline
    expect(res5.isValid).toBe(false);

    const res6 = normalizeSaudiPhoneNumber('12345');
    expect(res6.isValid).toBe(false);
  });
});

describe('Marketing Analytics Dispatcher', () => {
  it('tracks view_item and purchase without throwing errors when pixel scripts are absent', () => {
    const mockProduct: Product = {
      id: 'prod_1',
      name: 'عطر مسك فاخر',
      category: 'عطور',
      price: 250,
      variants: [],
      imageUrl: '',
      galleryImages: [],
      description: 'وصف',
      featured: true,
      inStock: true,
    };

    expect(() => trackViewItem(mockProduct, 'SAR')).not.toThrow();

    const mockCartItem: CartItem = {
      product: mockProduct,
      selectedVariant: '100ml',
      quantity: 2,
    };
    expect(() => trackAddToCart(mockCartItem, 'SAR')).not.toThrow();
    expect(() => trackBeginCheckout([mockCartItem], 500, 'SAR')).not.toThrow();

    const mockOrder: Order = {
      id: 'ord_test_01',
      timestamp: '2026-10-18T10:00:00Z',
      customerName: 'فهد العتيبي',
      customerPhone: '0501234567',
      city: 'الرياض',
      deliveryAddress: 'حي النرجس',
      paymentMethod: 'الدفع عند الاستلام',
      itemsSummary: '2× عطر مسك فاخر',
      items: [
        {
          productId: 'prod_1',
          name: 'عطر مسك فاخر',
          price: 250,
          quantity: 2,
        },
      ],
      subtotal: 500,
      shippingFee: 25,
      grandTotal: 525,
      status: 'Received',
    };

    expect(() => trackPurchase(mockOrder, 'SAR')).not.toThrow();
  });

  it('dispatches purchase event to window.gtag and window.fbq when present', () => {
    const gtagSpy = vi.fn();
    const fbqSpy = vi.fn();
    (global as any).window = { gtag: gtagSpy, fbq: fbqSpy };

    const mockOrder: Order = {
      id: 'ord_analytics_99',
      timestamp: '2026-10-18T10:00:00Z',
      customerName: 'سارة خالد',
      customerPhone: '0555555555',
      city: 'جدة',
      deliveryAddress: 'حي الروضة',
      paymentMethod: 'بطاقة مدى',
      itemsSummary: '1× حقيبة يد',
      items: [
        {
          productId: 'prod_bag',
          name: 'حقيبة يد',
          price: 320,
          quantity: 1,
        },
      ],
      subtotal: 320,
      shippingFee: 0,
      grandTotal: 320,
      status: 'Received',
    };

    trackPurchase(mockOrder, 'SAR');

    expect(gtagSpy).toHaveBeenCalledWith('event', 'purchase', expect.objectContaining({
      transaction_id: 'ord_analytics_99',
      value: 320,
      currency: 'SAR',
    }));

    expect(fbqSpy).toHaveBeenCalledWith('track', 'Purchase', expect.objectContaining({
      value: 320,
      currency: 'SAR',
    }));

    delete (global as any).window.gtag;
    delete (global as any).window.fbq;
  });
});
