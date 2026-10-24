import { describe, it, expect } from 'vitest';
import {
  parseProductsCsv,
  parseRawDelimitedText,
  matchHeaderToField,
  generateSampleProductCsv,
  exportProductsToCsv,
} from '../src/utils/csvProductParser';
import { Product } from '../src/types/store';

describe('CSV Product Parser & Importer (Google Sheets / Excel)', () => {
  it('matches common English and Arabic column headers accurately', () => {
    expect(matchHeaderToField('name')).toBe('name');
    expect(matchHeaderToField('Product Name')).toBe('name');
    expect(matchHeaderToField('اسم المنتج')).toBe('name');
    expect(matchHeaderToField('الاسم')).toBe('name');

    expect(matchHeaderToField('price')).toBe('price');
    expect(matchHeaderToField('السعر')).toBe('price');
    expect(matchHeaderToField('Unit_Price')).toBe('price');

    expect(matchHeaderToField('sale_price')).toBe('salePrice');
    expect(matchHeaderToField('discount_price')).toBe('salePrice');
    expect(matchHeaderToField('سعر الخصم')).toBe('salePrice');

    expect(matchHeaderToField('variants')).toBe('variants');
    expect(matchHeaderToField('الخيارات')).toBe('variants');
    expect(matchHeaderToField('المقاسات')).toBe('variants');

    expect(matchHeaderToField('stock')).toBe('stockQuantity');
    expect(matchHeaderToField('الكمية')).toBe('stockQuantity');
    expect(matchHeaderToField('المخزون')).toBe('stockQuantity');
  });

  it('correctly handles quoted fields with commas and CRLF', () => {
    const raw = `name,price,description\r\n"عطر ملكي, فاخر",350,"وصف يحتوي على, فواصل متعددة"`;
    const table = parseRawDelimitedText(raw);
    expect(table).toHaveLength(2);
    expect(table[1][0]).toBe('عطر ملكي, فاخر');
    expect(table[1][1]).toBe('350');
    expect(table[1][2]).toBe('وصف يحتوي على, فواصل متعددة');
  });

  it('parses Google Sheets comma-separated CSV with Arabic headers', () => {
    const csv = `اسم المنتج,السعر,سعر الخصم,القسم,المخزون,الخيارات\r\nشاي أخضر عضوي,45,38,مشروبات,100,"علبة 100g, علبة 250g"\r\nزعفران سوبر نقيل,120,,توابل,15,جرام واحد`;

    const result = parseProductsCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.validProducts).toHaveLength(2);

    const first = result.validProducts[0];
    expect(first.name).toBe('شاي أخضر عضوي');
    expect(first.price).toBe(45);
    expect(first.salePrice).toBe(38);
    expect(first.category).toBe('مشروبات');
    expect(first.stockQuantity).toBe(100);
    expect(first.variants).toEqual(['علبة 100g', 'علبة 250g']);

    const second = result.validProducts[1];
    expect(second.name).toBe('زعفران سوبر نقيل');
    expect(second.price).toBe(120);
    expect(second.salePrice).toBeUndefined();
    expect(second.stockQuantity).toBe(15);
  });

  it('parses direct copy-paste TSV table from Google Sheets', () => {
    // When copying cells from Google Sheets, the clipboard format is tab-delimited (\t)
    const tsv = `id\tname\tprice\tsale_price\tcategory\tstock\r\nSKU-99\tسماعة بلوتوث رياضية\t189\t149\tإلكترونيات\t30`;

    const result = parseProductsCsv(tsv);
    expect(result.errors).toHaveLength(0);
    expect(result.validProducts).toHaveLength(1);

    const prod = result.validProducts[0];
    expect(prod.id).toBe('SKU-99');
    expect(prod.name).toBe('سماعة بلوتوث رياضية');
    expect(prod.price).toBe(189);
    expect(prod.salePrice).toBe(149);
    expect(prod.category).toBe('إلكترونيات');
    expect(prod.stockQuantity).toBe(30);
  });

  it('normalizes Eastern Arabic numerals and strips currency abbreviations', () => {
    const csv = `name,price,sale_price,stock\r\nطقم فناجين سيراميك,١٥٠.٥٠ SAR,١٢٠ ر.س,٢٥`;

    const result = parseProductsCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.validProducts).toHaveLength(1);

    const prod = result.validProducts[0];
    expect(prod.price).toBe(150.5);
    expect(prod.salePrice).toBe(120);
    expect(prod.stockQuantity).toBe(25);
  });

  it('captures errors for invalid rows without dropping valid ones', () => {
    const csv = `name,price\r\n,99\r\nمنتج بدون سعر صالح,غير_معروف\r\nمنتج سليم تماماً,250`;

    const result = parseProductsCsv(csv);
    expect(result.validProducts).toHaveLength(1);
    expect(result.validProducts[0].name).toBe('منتج سليم تماماً');
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].row).toBe(2); // missing name
    expect(result.errors[1].row).toBe(3); // invalid price
  });

  it('generates a valid sample template and exports existing products cleanly', () => {
    const template = generateSampleProductCsv();
    expect(template).toContain('SKU-1001');
    const parsedTemplate = parseProductsCsv(template);
    expect(parsedTemplate.validProducts.length).toBeGreaterThan(0);

    const mockProducts: Product[] = [
      {
        id: 'p-export-1',
        name: 'منتج تصدير تجريبي',
        category: 'عطور',
        price: 299,
        salePrice: 249,
        variants: ['50ml', '100ml'],
        imageUrl: 'https://example.com/p1.jpg',
        galleryImages: ['https://example.com/p1.jpg'],
        description: 'وصف تصدير المنتجات',
        featured: true,
        inStock: true,
        stockQuantity: 40,
      },
    ];

    const exportedCsv = exportProductsToCsv(mockProducts);
    expect(exportedCsv).toContain('p-export-1');
    expect(exportedCsv).toContain('منتج تصدير تجريبي');
    expect(exportedCsv).toContain('299');

    const reimported = parseProductsCsv(exportedCsv);
    expect(reimported.validProducts).toHaveLength(1);
    expect(reimported.validProducts[0].id).toBe('p-export-1');
    expect(reimported.validProducts[0].price).toBe(299);
  });
});
