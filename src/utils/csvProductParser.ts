import { Product } from '../types/store';
import { normalizeArabicDigits } from './digits';
import {
  extractGoogleDriveFileId,
  isLegacyWatchPlaceholder,
  resolveStaticGoogleDriveAsset,
} from './imageOptimizer';

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
  id: ['id', 'product_id', 'sku', 'barcode', 'item_id', 'رمز المنتج', 'المعرف', 'كود المنتج', 'الرمز', 'رقم المنتج'],
  name: ['name', 'product_name', 'productname', 'item_name', 'title', 'product', 'اسم المنتج', 'الاسم', 'عنوان المنتج', 'اسم', 'المنتج', 'الصنف'],
  price: [
    'price',
    'price_sar',
    'pricesar',
    'price_in_sar',
    'regular_price',
    'unit_price',
    'cost',
    'amount',
    'السعر',
    'سعر المنتج',
    'السعر الأصلي',
    'سعر',
    'السعر بالريال',
    'السعر ر.س',
  ],
  salePrice: ['saleprice', 'sale_price', 'discount_price', 'discountprice', 'discount', 'special_price', 'سعر الخصم', 'سعر التخفيض', 'الخصم', 'سعر العرض'],
  category: ['category', 'department', 'section', 'type', 'group', 'التصنيف', 'القسم', 'الفئة', 'المجموعة'],
  description: ['description', 'details', 'desc', 'body', 'notes', 'الوصف', 'التفاصيل', 'وصف المنتج', 'شرح المنتج', 'ملاحظات'],
  imageUrl: [
    'direct_image_url',
    'directimageurl',
    'direct_image',
    'image_url',
    'imageurl',
    'image',
    'photo',
    'picture',
    'thumbnail',
    'img',
    'رابط الصورة المباشر',
    'رابط الصورة',
    'صورة المنتج',
    'صورة',
    'الرابط',
  ],
  galleryImages: ['gallery', 'gallery_images', 'galleryimages', 'additional_images', 'صور إضافية', 'معرض الصور', 'صور'],
  variants: ['variants', 'options', 'sizes', 'colors', 'weights', 'الخيارات', 'المقاسات', 'الألوان', 'المتغيرات', 'الأحجام', 'الأوزان'],
  inStock: ['instock', 'in_stock', 'available', 'status', 'متوفر', 'في المخزن', 'الحالة', 'التوفر'],
  stockQuantity: ['stock', 'quantity', 'qty', 'stock_quantity', 'inventory', 'الكمية', 'المخزون', 'الرصيد'],
  featured: ['featured', 'is_featured', 'star', 'مميز', 'منتج مميز', 'موصى به'],
  fabricComposition: ['fabric', 'material', 'composition', 'الخامة', 'المادة'],
  colorName: ['color', 'color_name', 'اللون', 'اسم اللون'],
  rating: ['rating', 'stars', 'rate', 'التقييم', 'النجوم'],
  reviewsCount: ['reviews', 'reviewscount', 'reviews_count', 'عدد التقييمات', 'المراجعات'],
  unit: ['unit', 'unit_of_measure', 'uom', 'الوحدة', 'وحدة القياس', 'النوع', 'وحدة'],
  unitLabel: ['unit_label', 'unitlabel', 'تسمية الوحدة', 'اسم الوحدة'],
  minQuantity: ['min_qty', 'min_quantity', 'minquantity', 'أقل كمية', 'الحد الأدنى للكمية', 'أقل طلب'],
  quantityStep: ['quantity_step', 'step', 'qty_step', 'معدل الزيادة', 'خطوة الزيادة', 'الخطوة'],
};

/**
 * Normalizes header string to lowercase trimmed alphanumerics for comparison.
 * Strips parenthetical unit/currency annotations (e.g. "(SAR)", "(ر.س)") and punctuation
 * so 'Price (SAR)', 'Product Name', 'product_name', and 'Direct Image URL' all match cleanly.
 */
function normalizeHeaderKey(key: string): string {
  return key
    .toLowerCase()
    .replace(/\([^)]*\)/g, '') // Strip parenthetical suffixes like (SAR), (USD), (ر.س)
    .replace(/\[[^\]]*\]/g, '')
    .replace(/(?:sar|usd|eur|gbp|aed|kwd|qar|bhd|omr|ر\.?س|ريال)$/gi, '')
    .replace(/[\uFEFF\r\n\t\s_\-:/\\.,]/g, '')
    .trim();
}

/**
 * Converts Google Drive sharing or view URLs into direct embeddable image URLs
 * that render reliably inside browser <img> tags without CORS/cookie redirects.
 */
export function normalizeProductImageUrl(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed || isLegacyWatchPlaceholder(trimmed)) return '';

  const staticAsset = resolveStaticGoogleDriveAsset(trimmed);
  if (staticAsset) {
    return staticAsset;
  }

  const driveFileId = extractGoogleDriveFileId(trimmed);
  if (driveFileId) {
    return `https://lh3.googleusercontent.com/d/${driveFileId}=w1000`;
  }

  return trimmed;
}

/**
 * Detects the canonical product field corresponding to an arbitrary column header.
 */
export function matchHeaderToField(header: string): string | null {
  const rawClean = header
    .toLowerCase()
    .replace(/[\uFEFF\r\n\t\s_\-]/g, '')
    .trim();
  const clean = normalizeHeaderKey(header);
  if (!clean && !rawClean) return null;

  // 1. Exact match against aliases (both rawClean and currency/parenthesis-stripped clean)
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) {
      const normAlias = normalizeHeaderKey(alias);
      const rawNormAlias = alias.toLowerCase().replace(/[\uFEFF\r\n\t\s_\-]/g, '').trim();
      if (rawClean === rawNormAlias || (clean && clean === normAlias)) {
        return field;
      }
    }
  }

  // 2. Smart substring fallback for composite headers (e.g. "Price (SAR)", "Price in SAR", "Direct Image URL", "Product Price")
  if (rawClean.includes('directimage') || rawClean.includes('imageurl') || rawClean.includes('رابطالصور') || rawClean.includes('صورة')) {
    return 'imageUrl';
  }
  if (rawClean.includes('saleprice') || rawClean.includes('discountprice') || rawClean.includes('سعرالخصم') || rawClean.includes('سعرالعرض')) {
    return 'salePrice';
  }
  if (rawClean.includes('price') || rawClean.includes('سعر') || rawClean.includes('السعر')) {
    return 'price';
  }
  if (rawClean.includes('productname') || rawClean.includes('itemname') || rawClean.includes('اسمالمنتج') || rawClean.includes('اسم')) {
    return 'name';
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

  // Dynamic Content-Based Column Inference Fallback:
  // If any CSV has non-standard headers where 'name' or 'price' or 'imageUrl' wasn't matched by header name,
  // inspect the data rows (up to first 5 rows) to infer which column is Name, Price, or Image URL!
  const sampleDataRows = table.slice(1, Math.min(table.length, 6));
  const currentMappedFields = Object.values(fieldMap);

  if (!currentMappedFields.includes('price') && sampleDataRows.length > 0) {
    for (let colIdx = 0; colIdx < rawHeaders.length; colIdx++) {
      if (fieldMap[colIdx] === 'id' || fieldMap[colIdx] === 'name' || fieldMap[colIdx] === 'imageUrl') continue;
      const numericMatches = sampleDataRows.filter((row) => {
        const val = (row[colIdx] || '').trim();
        if (!val || val.startsWith('http')) return false;
        const n = parseCleanNumber(val);
        return n !== undefined && n >= 0;
      });
      if (numericMatches.length >= Math.ceil(sampleDataRows.length * 0.6)) {
        fieldMap[colIdx] = 'price';
        break;
      }
    }
  }

  if (!Object.values(fieldMap).includes('name') && sampleDataRows.length > 0) {
    for (let colIdx = 0; colIdx < rawHeaders.length; colIdx++) {
      if (fieldMap[colIdx]) continue;
      const textMatches = sampleDataRows.filter((row) => {
        const val = (row[colIdx] || '').trim();
        return val.length >= 2 && !val.startsWith('http') && parseCleanNumber(val) === undefined;
      });
      if (textMatches.length >= Math.ceil(sampleDataRows.length * 0.6)) {
        fieldMap[colIdx] = 'name';
        break;
      }
    }
  }

  if (!Object.values(fieldMap).includes('imageUrl') && sampleDataRows.length > 0) {
    for (let colIdx = 0; colIdx < rawHeaders.length; colIdx++) {
      if (fieldMap[colIdx]) continue;
      const urlMatches = sampleDataRows.filter((row) => {
        const val = (row[colIdx] || '').trim();
        return /^https?:\/\//i.test(val);
      });
      if (urlMatches.length >= Math.ceil(sampleDataRows.length * 0.6)) {
        fieldMap[colIdx] = 'imageUrl';
        break;
      }
    }
  }

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
      if (!field) return;
      const trimmedVal = (cellVal || '').trim();
      // Prefer "Direct Image URL" over a generic "Image URL" column when both exist
      if (field === 'imageUrl') {
        const headerNorm = (rawHeaders[idx] || '').toLowerCase();
        if (!parsed.imageUrl || (trimmedVal && headerNorm.includes('direct'))) {
          if (trimmedVal) parsed.imageUrl = trimmedVal;
        }
      } else if (!parsed[field] || trimmedVal) {
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

    // 7. Images (Automatically normalize Google Drive view/uc links into direct embeddable image URLs)
    // Collect any secondary image URL columns into galleryImages so no image column in the CSV is ever lost
    const extraImageUrls: string[] = [];
    rowCells.forEach((cellVal, idx) => {
      if (fieldMap[idx] === 'imageUrl') {
        const norm = normalizeProductImageUrl(cellVal || '');
        if (norm && !extraImageUrls.includes(norm)) {
          extraImageUrls.push(norm);
        }
      }
    });

    const imageUrl = normalizeProductImageUrl(parsed.imageUrl || '') || extraImageUrls[0] || '';
    const parsedGallery = parseList(parsed.galleryImages).map(normalizeProductImageUrl).filter(Boolean);
    const galleryImages = Array.from(new Set([imageUrl, ...extraImageUrls, ...parsedGallery].filter(Boolean)));

    // 8. ID (use provided or auto-generate)
    const id = (parsed.id || '').trim() || `prod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const rawUnit = (parsed.unit || '').trim().toLowerCase();
    let unitVal: string | undefined = rawUnit || undefined;
    if (['كيلو', 'كيلوغرام', 'كجم', 'كغ', 'kg', 'kilogram'].includes(rawUnit)) unitVal = 'kg';
    else if (['غرام', 'جرام', 'جم', 'g', 'gram'].includes(rawUnit)) unitVal = 'g';
    else if (['متر', 'م', 'meter', 'm'].includes(rawUnit)) unitVal = 'meter';
    else if (['سم', 'سنتيمتر', 'cm'].includes(rawUnit)) unitVal = 'cm';
    else if (['لتر', 'liter', 'l'].includes(rawUnit)) unitVal = 'liter';
    else if (['مل', 'مليلتر', 'ml'].includes(rawUnit)) unitVal = 'ml';
    else if (['درزن', 'dozen', 'dzn'].includes(rawUnit)) unitVal = 'dozen';
    else if (['كرتون', 'صندوق', 'box'].includes(rawUnit)) unitVal = 'box';
    else if (['طقم', 'باقة', 'كيس', 'pack'].includes(rawUnit)) unitVal = 'pack';
    else if (['تولة', 'tola'].includes(rawUnit)) unitVal = 'tola';
    else if (['أوقية', 'اوقية', 'waqiyyah'].includes(rawUnit)) unitVal = 'waqiyyah';
    else if (['حبة', 'قطعة', 'حبه', 'piece', 'pc', 'item'].includes(rawUnit)) unitVal = 'piece';

    const minQuantity = parseCleanNumber(parsed.minQuantity);
    const quantityStep = parseCleanNumber(parsed.quantityStep);

    const product: Product = {
      id,
      name,
      category,
      price,
      salePrice: salePrice && salePrice > 0 ? salePrice : undefined,
      variants,
      imageUrl,
      galleryImages,
      description: (parsed.description || '').trim(),
      featured: parseCleanBoolean(parsed.featured, false),
      inStock,
      stockQuantity: stockQuantity !== undefined ? Math.max(0, Math.round(stockQuantity * 1000) / 1000) : undefined,
      fabricComposition: parsed.fabricComposition?.trim() || undefined,
      colorName: parsed.colorName?.trim() || undefined,
      rating: parseCleanNumber(parsed.rating),
      reviewsCount: parseCleanNumber(parsed.reviewsCount),
      unit: unitVal,
      unitLabel: parsed.unitLabel?.trim() || undefined,
      minQuantity: minQuantity && minQuantity > 0 ? minQuantity : undefined,
      quantityStep: quantityStep && quantityStep > 0 ? quantityStep : undefined,
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
    'unit',
    'min_quantity',
    'quantity_step',
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
      'pack',
      '1',
      '1',
      'حبوب كاملة, طحنة فلتر, طحنة إسبريسو',
      'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=600&auto=format&fit=crop&q=80',
      'نعم',
    ],
    [
      'SKU-1002',
      'عسل سدر بلدي جبلي فاخر',
      '180',
      '160',
      'أغذية طبيعية',
      'عسل سدر طبيعي 100% مستخرج من مناحل جنوب المملكة، متوفر بالكيلوجرام والكسور',
      '30',
      'نعم',
      'kg',
      '0.5',
      '0.5',
      '',
      'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=600&auto=format&fit=crop&q=80',
      'نعم',
    ],
    [
      'SKU-1003',
      'قماش كتان طبيعي فاخر للمتر',
      '45',
      '',
      'أقمشة ومنسوجات',
      'قماش كتان نقي مناسب للملابس والديكور، يباع بالمتر أو أجزاء المتر',
      '120',
      'نعم',
      'meter',
      '1',
      '0.5',
      'أبيض ناصع, بيج طبيعي, كحلي',
      'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=600&auto=format&fit=crop&q=80',
      'لا',
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
    'unit',
    'min_quantity',
    'quantity_step',
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
    p.unit || 'piece',
    p.minQuantity !== undefined ? p.minQuantity : 1,
    p.quantityStep !== undefined ? p.quantityStep : 1,
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
