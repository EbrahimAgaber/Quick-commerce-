import { Product } from '../types/store';
import { normalizeArabicDigits } from './digits';

export interface CsvParseError {
  row: number;
  reason: string;
  rawData?: Record<string, string>;
}

export interface CsvProductImportResult {
  validProducts: Product[];
  errors: CsvParseError[];
  totalRows: number;
}

/**
 * Universal field synonym mapping for Google Sheets / Excel column headers.
 * Supports English, Arabic, and snake_case / camelCase variants.
 */
const FIELD_ALIASES: Record<keyof Omit<Product, 'galleryImages' | 'variants'> | 'variants' | 'galleryImages', string[]> = {
  id: ['id', 'product_id', 'sku', 'barcode', 'رمز المنتج', 'المعرف', 'كود المنتج', 'الرمز'],
  name: ['name', 'product_name', 'title', 'اسم المنتج', 'الاسم', 'عنوان المنتج', 'اسم'],
  price: ['price', 'regular_price', 'unit_price', 'السعر', 'سعر المنتج', 'السعر الأصلي', 'سعر'],
  salePrice: ['saleprice', 'sale_price', 'discount_price', 'discountprice', 'discount', 'سعر الخصم', 'سعر التخفيض', 'الخصم', 'سعر العرض'],
  category: ['category', 'department', 'section', 'type', 'التصنيف', 'القسم', 'الفئة', 'المجموعة'],
  description: ['description', 'details', 'desc', 'body', 'الوصف', 'التفاصيل', 'وصف المنتج', 'شرح المنتج'],
  imageUrl: ['image', 'image_url', 'imageurl', 'photo', 'picture', 'صورة', 'رابط الصورة', 'صورة المنتج', 'الرابط'],
  galleryImages: ['gallery', 'gallery_images', 'galleryimages', 'additional_images', 'صور إضافية', 'معرض الصور', 'صور'],
  variants: ['variants', 'options', 'sizes', 'colors', 'الخيارات', 'المقاسات', 'الألوان', 'المتغيرات', 'الأحجام'],
  inStock: ['instock', 'in_stock', 'available', 'status', 'متوفر', 'في المخزن', 'الحالة', 'التوفر'],
  stockQuantity: ['stock', 'quantity', 'qty', 'stock_quantity', 'inventory', 'الكمية', 'المخزون', 'الرصيد'],
  featured: ['featured', 'is_featured', 'star', 'مميز', 'منتج مميز', 'موصى به'],
  fabricComposition: ['fabric', 'material', 'composition', 'الخامة', 'المادة'],
  colorName: ['color', 'color_name', 'اللون', 'اسم اللون'],
  rating: ['rating', 'stars', 'rate', 'التقييم', 'النجوم'],
  reviewsCount: ['reviews', 'reviewscount', 'reviews_count', 'عدد التقييمات', 'المراجعات'],
};

/**
 * Normalizes header string to lowercase trimmed alphanumerics for comparison.
 * Removes spaces, underscores, and dashes so 'Product Name', 'product_name', 'product-name' all match.
 */
function normalizeHeaderKey(key: string): string {
  return key
    .toLowerCase()
    .replace(/[\uFEFF\r\n\t\s_\-]/g, '')
    .trim();
}

/**
 * Detects the canonical product field corresponding to an arbitrary column header.
 */
export function matchHeaderToField(header: string): string | null {
  const clean = normalizeHeaderKey(header);
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) {
      if (clean === normalizeHeaderKey(alias)) {
        return field;
      }
    }
  }
  return null;
}

/**
 * Parses numeric strings, handling Eastern Arabic numerals, currency signs, and commas.
 */
export function parseCleanNumber(val: any): number | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  if (typeof val === 'number') return isNaN(val) ? undefined : val;

  // Convert Eastern Arabic numerals to ASCII digits and strip spaces
  let s = normalizeArabicDigits(String(val)).trim();
  // Strip currency symbols (SAR, ر.س, $, €, £, etc.)
  s = s.replace(/(sar|usd|eur|gbp|ر\.?س|ريال|دولار)/gi, '');
  // Remove thousand separator commas e.g. "1,250.50" -> "1250.50"
  s = s.replace(/,/g, '').trim();

  const num = parseFloat(s);
  return isNaN(num) ? undefined : num;
}

/**
 * Parses boolean representations (true, false, نعم, لا, 1, 0, متوفر).
 */
export function parseCleanBoolean(val: any, defaultVal: boolean = true): boolean {
  if (val === undefined || val === null || val === '') return defaultVal;
  const s = String(val).trim().toLowerCase();
  if (['true', '1', 'yes', 'نعم', 'متوفر', 'متاح', 'نشط', 'صحيح'].includes(s)) {
    return true;
  }
  if (['false', '0', 'no', 'لا', 'غير متوفر', 'غير متاح', 'معطل', 'نفد'].includes(s)) {
    return false;
  }
  return defaultVal;
}

/**
 * Splits delimited string of items (comma, semicolon, or pipe separated).
 */
export function parseList(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String).filter(Boolean);
  return String(val)
    .split(/[,;||\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * RFC-4180 compliant CSV/TSV table string parser.
 * Automatically handles comma, tab, or semicolon delimiters and quoted fields with newlines.
 */
export function parseRawDelimitedText(text: string): string[][] {
  // Strip UTF-8 BOM if present
  let input = text.replace(/^\uFEFF/, '');
  if (!input.trim()) return [];

  // Detect delimiter by sampling the first non-empty line
  const firstLine = input.split(/\r?\n/).find((l) => l.trim().length > 0) || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;

  let delimiter = ',';
  if (tabCount > commaCount && tabCount > semiCount) {
    delimiter = '\t';
  } else if (semiCount > commaCount && semiCount > tabCount) {
    delimiter = ';';
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;
  let i = 0;

  while (i < input.length) {
    const char = input[i];
    const nextChar = input[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote: "" -> "
        currentField += '"';
        i += 2;
        continue;
      }
      insideQuotes = !insideQuotes;
      i++;
      continue;
    }

    if (!insideQuotes && char === delimiter) {
      currentRow.push(currentField.trim());
      currentField = '';
      i++;
      continue;
    }

    if (!insideQuotes && (char === '\r' || char === '\n')) {
      // End of line
      if (char === '\r' && nextChar === '\n') {
        i++; // skip LF of CRLF
      }
      currentRow.push(currentField.trim());
      // Only push non-empty rows
      if (currentRow.some((f) => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
      i++;
      continue;
    }

    currentField += char;
    i++;
  }

  // Push last field and row if any remains
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Parses raw CSV or TSV string into validated Storelink Products.
 */
export function parseProductsCsv(csvString: string): CsvProductImportResult {
  const table = parseRawDelimitedText(csvString);
  if (table.length < 2) {
    return {
      validProducts: [],
      errors: [
        {
          row: 1,
          reason: 'الملف فارغ أو لا يحتوي على صفوف بيانات بعد رأس الأعمدة (Header).',
        },
      ],
      totalRows: 0,
    };
  }

  const rawHeaders = table[0];
  const fieldMap: Record<number, string> = {};

  // Map each column index to product model field
  rawHeaders.forEach((header, idx) => {
    const matched = matchHeaderToField(header);
    if (matched) {
      fieldMap[idx] = matched;
    }
  });

  // Verify essential columns
  const mappedFields = Object.values(fieldMap);
  const hasName = mappedFields.includes('name');
  const hasPrice = mappedFields.includes('price');

  if (!hasName || !hasPrice) {
    return {
      validProducts: [],
      errors: [
        {
          row: 1,
          reason: `الملف يفتقر للأعمدة الأساسية المطلوبة: ${!hasName ? 'اسم المنتج (Name)' : ''} ${!hasPrice ? 'السعر (Price)' : ''}`.trim(),
        },
      ],
      totalRows: table.length - 1,
    };
  }

  const validProducts: Product[] = [];
  const errors: CsvParseError[] = [];

  for (let r = 1; r < table.length; r++) {
    const rowCells = table[r];
    const rowObj: Record<string, string> = {};

    rawHeaders.forEach((h, i) => {
      rowObj[h] = rowCells[i] || '';
    });

    const parsed: Record<string, any> = {};
    rowCells.forEach((cellVal, idx) => {
      const field = fieldMap[idx];
      if (field) {
        parsed[field] = cellVal;
      }
    });

    // 1. Validate Product Name
    const name = (parsed.name || '').trim();
    if (!name) {
      errors.push({
        row: r + 1,
        reason: 'اسم المنتج مفقود أو فارغ.',
        rawData: rowObj,
      });
      continue;
    }

    // 2. Validate Price
    const price = parseCleanNumber(parsed.price);
    if (price === undefined || price < 0) {
      errors.push({
        row: r + 1,
        reason: `السعر غير صالح "${parsed.price || ''}". يجب أن يكون رقماً موجباً.`,
        rawData: rowObj,
      });
      continue;
    }

    // 3. Optional Discount / Sale Price
    const salePrice = parseCleanNumber(parsed.salePrice);

    // 4. Stock & Availability
    const stockQuantity = parseCleanNumber(parsed.stockQuantity);
    const inStock = parseCleanBoolean(parsed.inStock, stockQuantity !== undefined ? stockQuantity > 0 : true);

    // 5. Category
    const category = (parsed.category || '').trim() || 'عام';

    // 6. Variants
    const variants = parseList(parsed.variants);

    // 7. Images
    const imageUrl = (parsed.imageUrl || '').trim() || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80';
    const galleryImages = parseList(parsed.galleryImages);

    // 8. ID (use provided or auto-generate)
    const id = (parsed.id || '').trim() || `prod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const product: Product = {
      id,
      name,
      category,
      price,
      salePrice: salePrice && salePrice > 0 ? salePrice : undefined,
      variants,
      imageUrl,
      galleryImages: galleryImages.length > 0 ? galleryImages : [imageUrl],
      description: (parsed.description || '').trim(),
      featured: parseCleanBoolean(parsed.featured, false),
      inStock,
      stockQuantity: stockQuantity !== undefined ? Math.max(0, Math.floor(stockQuantity)) : undefined,
      fabricComposition: parsed.fabricComposition?.trim() || undefined,
      colorName: parsed.colorName?.trim() || undefined,
      rating: parseCleanNumber(parsed.rating),
      reviewsCount: parseCleanNumber(parsed.reviewsCount),
    };

    validProducts.push(product);
  }

  return {
    validProducts,
    errors,
    totalRows: table.length - 1,
  };
}

/**
 * Generates an annotated sample CSV template that can be opened in Google Sheets or Excel.
 * Includes UTF-8 BOM so Arabic letters render without character encoding issues in Excel.
 */
export function generateSampleProductCsv(): string {
  const header = [
    'id',
    'name',
    'price',
    'sale_price',
    'category',
    'description',
    'stock',
    'in_stock',
    'variants',
    'image_url',
    'featured',
  ];

  const sampleRows = [
    [
      'SKU-1001',
      'قهوة مختصة كولومبية - محمصة فاخرة 250g',
      '68',
      '55',
      'قهوة ومشروبات',
      'حبوب بن كولومبي مختص معالجة مغسولة بإيحاءات الشوكولاتة والمكسرات',
      '50',
      'نعم',
      'حبوب كاملة, طحنة فلتر, طحنة إسبريسو',
      'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=600&auto=format&fit=crop&q=80',
      'نعم',
    ],
    [
      'SKU-1002',
      'كوب سيراميك يدوي الصنع 220ml',
      '45',
      '',
      'أكواب وأدوات',
      'كوب فخاري مصنوع يدوياً بطلاء حراري فريد مقاوم لغسالة الصحون',
      '20',
      'نعم',
      'أزرق بحري, رملي, أسود مطفي',
      'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80',
      'لا',
    ],
    [
      'SKU-1003',
      'ميزان قهوة رقمي مع مؤقت ذكي',
      '120',
      '99',
      'أجهزة وموازين',
      'ميزان عالي الدقة بحساسية 0.1 غرام مع شاشة LED مدمجة وبطارية قابلة للشحن',
      '15',
      'نعم',
      '',
      'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=600&auto=format&fit=crop&q=80',
      'نعم',
    ],
  ];

  const escapeCell = (cell: string) => {
    if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
      return `"${cell.replace(/"/g, '""')}"`;
    }
    return cell;
  };

  const lines = [
    header.join(','),
    ...sampleRows.map((r) => r.map(escapeCell).join(',')),
  ];

  // Prepend UTF-8 BOM so Excel opens Arabic correctly
  return '\uFEFF' + lines.join('\r\n');
}

/**
 * Exports the store's current products list into a CSV format ready for Google Sheets or Excel.
 */
export function exportProductsToCsv(products: Product[]): string {
  const header = [
    'id',
    'name',
    'price',
    'sale_price',
    'category',
    'description',
    'stock',
    'in_stock',
    'variants',
    'image_url',
    'featured',
  ];

  const escapeCell = (val: any) => {
    const s = val === undefined || val === null ? '' : String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = products.map((p) => [
    p.id,
    p.name,
    p.price,
    p.salePrice || '',
    p.category || 'عام',
    p.description || '',
    p.stockQuantity !== undefined ? p.stockQuantity : '',
    p.inStock ? 'نعم' : 'لا',
    (p.variants || []).join(', '),
    p.imageUrl || '',
    p.featured ? 'نعم' : 'لا',
  ]);

  const lines = [
    header.join(','),
    ...rows.map((r) => r.map(escapeCell).join(',')),
  ];

  return '\uFEFF' + lines.join('\r\n');
}
