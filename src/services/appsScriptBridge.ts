import { Order, Product, StoreSettings, StorePolicy } from '../types/store';

/**
 * Returns the exact Google Apps Script code (Code.gs) for merchants to paste into Google Sheets.
 */
export function generateGoogleAppsScriptCode(): string {
  return `/**
 * =========================================================================
 * 🛍️ QUICK E-COMMERCE - GOOGLE SHEETS BACKEND ENGINE (Code.gs)
 * =========================================================================
 * Transforms this Google Sheet into an instant, high-speed e-commerce backend.
 * 
 * Instructions:
 * 1. Open your Google Sheet
 * 2. Click Extensions > Apps Script
 * 3. Replace all existing code with this file
 * 4. Run 'setupSheetDatabase()' once to create all formatted tabs
 * 5. Click 'Deploy' > 'New deployment' > Select 'Web app'
 *    - Execute as: 'Me'
 *    - Who has access: 'Anyone' (Required for public storefront access)
 * 6. Copy your Web App URL and paste it into the Quick E-Commerce connector!
 * =========================================================================
 */

// Custom Menu in Google Sheets UI
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🛍️ متجر Quick E-Commerce')
    .addItem('🚀 تهيئة وإنشاء جداول المتجر', 'setupSheetDatabase')
    .addItem('🔄 مسح الكاش والتحديث', 'clearCache')
    .addToUi();
}

/**
 * 1. Initializes the 4 required tabs with sample data & luxury formatting
 */
function setupSheetDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Tab 1: ⚙️ Settings
  var settingsSheet = ss.getSheetByName('⚙️ Settings') || ss.insertSheet('⚙️ Settings');
  settingsSheet.clear();
  var settingsData = [
    ['Key', 'Value', 'Description'],
    ['Store Name', 'Simpler', 'اسم المتجر المعروض للعملاء'],
    ['Store Subtitle', 'Ebrahim Gaber', 'العنوان الفرعي أو اسم المالك'],
    ['Tagline', 'Process Design, Green Hydrogen R&D, and Data Science Solutions', 'وصف المتجر المختصر'],
    ['Currency', 'USD', 'العملة المعروضة في المتجر'],
    ['WhatsApp Number', '966532923509', 'رقم الواتساب الدولي بدون إشارة + لاستقبال الطلبات'],
    ['Support Phone', '+966 53 292 3509', 'هاتف الدعم الفني'],
    ['Support Email', 'ea.gaber10@gmail.com', 'البريد الإلكتروني للطلبات'],
    ['Website URL', 'https://simpler-ebrahim.netlify.app/about', 'رابط الموقع الشخصي أو المعرض'],
    ['Primary Color', '#0B253F', 'اللون الأساسي والعناوين (Deep Navy)'],
    ['Accent Color', '#0077FF', 'لون الأزرار والتفاعل (Electric Blue)'],
    ['Highlight Color', '#A5F3B6', 'لون التمييز والإنجاز (Mint Green)'],
    ['Background Color', '#F8F3ED', 'لون خلفية المتجر (Warm Cream Light Theme)'],
    ['Font Family', 'Cairo', 'خط المتجر (Cairo / Poppins / Tajawal)'],
    ['Free Shipping Threshold', '150', 'الحد الأدنى للسلة للحصول على شحن مجاني'],
    ['Standard Shipping Rate', '15', 'رسوم الشحن والتسليم الثابتة'],
    ['Payment Methods', 'Direct Payment, Wire Transfer, Credit Card / Stripe', 'خيارات الدفع المفعلة مفصولة بفاصلة'],
    ['Bank Name', 'Al Rajhi Bank / PayPal', 'اسم البنك للتحويل البنكي'],
    ['Bank IBAN', 'SA4480000201608010123456', 'رقم الآيبان البنكي'],
    ['Account Holder', 'Ebrahim Gaber - Simpler Solutions', 'اسم المستفيد'],
    ['Order Notification Email', 'ea.gaber10@gmail.com', 'البريد لتلقي إشعارات الطلبات الفورية'],
    ['Announcement Text', '⚡ أهلاً بكم في متجر التجارة السريعة (Quick E-Commerce) · شحن سريع ودفع آمن', 'شريط الإعلانات أعلى المتجر']
  ];
  settingsSheet.getRange(1, 1, settingsData.length, 3).setValues(settingsData);
  formatSheetHeader(settingsSheet, 3, '#0B253F');

  // Tab 2: 👗 Products
  var productsSheet = ss.getSheetByName('👗 Products') || ss.insertSheet('👗 Products');
  productsSheet.clear();
  var productHeaders = [
    ['ID', 'Name', 'Category', 'Price', 'Sale Price', 'Variants', 'Image URL', 'Gallery Images', 'Description', 'Featured', 'In Stock', 'Fabric Composition']
  ];
  var sampleProducts = [
    [
      'prod-001',
      'Process Design & Plant Simulation Consultation',
      'Process Engineering',
      180,
      140,
      '1 Hour Session, 3 Hours Package, Full Project Review',
      'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80',
      'Detailed technical consultation and auditing using Aspen HYSYS and Aspen Plus. Includes mass and energy balance validation, distillation column sizing, and HAZOP guidance.',
      true,
      true,
      'Aspen HYSYS/Plus · P&ID · Sizing'
    ],
    [
      'prod-002',
      'Machine Learning & Predictive Modeling Solution',
      'Data Science & ML',
      250,
      195,
      'Standard Model (Python), Production Pipeline + SQL API, Enterprise Model',
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',
      'Custom predictive algorithms and statistical modeling in Python (Scikit-Learn, PyTorch). Covers regression, classification, and automated data processing pipeline.',
      true,
      true,
      'Python · Scikit-Learn · SQL · MATLAB'
    ]
  ];
  productsSheet.getRange(1, 1, 1, productHeaders[0].length).setValues(productHeaders);
  productsSheet.getRange(2, 1, sampleProducts.length, productHeaders[0].length).setValues(sampleProducts);
  formatSheetHeader(productsSheet, productHeaders[0].length, '#0077FF');

  // Tab 3: 📦 Orders
  var ordersSheet = ss.getSheetByName('📦 Orders') || ss.insertSheet('📦 Orders');
  ordersSheet.clear();
  var orderHeaders = [
    ['Order ID', 'Timestamp', 'Customer Name', 'Customer Phone', 'City', 'Delivery Address', 'Landmark Notes', 'Payment Method', 'Items Summary', 'Subtotal', 'Shipping Fee', 'Grand Total', 'Status', 'Tracking Notes']
  ];
  var sampleOrders = [
    [
      'BA-4821',
      new Date().toISOString(),
      'ريم محمد القحطاني',
      '0501234567',
      'الرياض',
      'حي النرجس، شارع أنس بن مالك',
      'بجوار الدانوب',
      'الدفع عند الاستلام',
      '1x عباية كريب ملكي سوداء (مقاس 54) - 520 ر.س',
      520,
      0,
      520,
      'Delivered',
      'تم التوصيل بنجاح للعميلة'
    ]
  ];
  ordersSheet.getRange(1, 1, 1, orderHeaders[0].length).setValues(orderHeaders);
  ordersSheet.getRange(2, 1, sampleOrders.length, orderHeaders[0].length).setValues(sampleOrders);
  formatSheetHeader(ordersSheet, orderHeaders[0].length, '#b45309');

  // Tab 4: 🌿 Information / Policies
  var infoSheet = ss.getSheetByName('🌿 Information') || ss.insertSheet('🌿 Information');
  infoSheet.clear();
  var infoHeaders = [['ID', 'Title', 'Content']];
  var sampleInfo = [
    ['policy-01', 'جدول المقاسات ودليل القياس', 'مقاس 52 (150-155 سم)، مقاس 54 (156-160 سم)، مقاس 56 (161-165 سم)، مقاس 58 (166-170 سم)'],
    ['policy-02', 'سياسة الاستبدال والاسترجاع', 'يحق للعميل الاستبدال والاسترجاع خلال 3 أيام من تاريخ الاستلام للمنتجات غير المستخدمة.'],
    ['policy-03', 'الشحن والتوصيل', 'التوصيل مجاني للطلبات فوق 350 ر.س لكافة مدن المملكة. يستغرق التوصيل من 2 إلى 4 أيام عمل.']
  ];
  infoSheet.getRange(1, 1, 1, 3).setValues(infoHeaders);
  infoSheet.getRange(2, 1, sampleInfo.length, 3).setValues(sampleInfo);
  formatSheetHeader(infoSheet, 3, '#15803d');

  SpreadsheetApp.getActiveSpreadsheet().toast('✅ تم إنشاء وتنسيق جداول المتجر بنجاح!', 'Quick E-Commerce', 5);
}

function formatSheetHeader(sheet, numCols, color) {
  var header = sheet.getRange(1, 1, 1, numCols);
  header.setBackground(color);
  header.setFontColor('#ffffff');
  header.setFontWeight('bold');
  header.setHorizontalAlignment('center');
  sheet.setFrozenRows(1);
  for (var i = 1; i <= numCols; i++) {
    sheet.autoResizeColumn(i);
  }
}

/**
 * 2. API Endpoint: Handles GET requests
 * Usage:
 * - ?api=all      -> Returns full catalog, settings, and policies
 * - ?api=products -> Returns products array
 * - ?api=track&id=BA-4821 -> Returns order tracking info
 */
function doGet(e) {
  var params = (e && e.parameter) || {};
  var api = params.api || 'all';

  if (api === 'track') {
    var orderId = (params.id || '').trim();
    return jsonResponse(findOrderById(orderId));
  }

  var data = getStoreData(api);
  return jsonResponse(data);
}

/**
 * 3. API Endpoint: Handles POST requests (Receiving Orders)
 * Frontend posts order payload as JSON with Content-Type: text/plain
 */
function doPost(e) {
  try {
    var contents = e.postData.contents;
    var payload = JSON.parse(contents);

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var ordersSheet = ss.getSheetByName('📦 Orders');
    if (!ordersSheet) {
      ordersSheet = ss.insertSheet('📦 Orders');
    }

    var orderId = payload.id || ('SL-' + Math.floor(1000 + Math.random() * 9000));
    var timestamp = payload.timestamp || new Date().toISOString();
    var customerName = payload.customerName || '';
    var customerPhone = payload.customerPhone || '';
    var city = payload.city || '';
    var deliveryAddress = payload.deliveryAddress || '';
    var landmarkNotes = payload.landmarkNotes || '';
    var paymentMethod = payload.paymentMethod || '';
    var itemsSummary = payload.itemsSummary || '';
    var subtotal = Number(payload.subtotal) || 0;
    var shippingFee = Number(payload.shippingFee) || 0;
    var grandTotal = Number(payload.grandTotal) || 0;
    var status = payload.status || 'Received';
    var trackingNotes = payload.trackingNotes || 'تم استلام الطلب وتأكيده بنجاح.';

    // Append new row
    ordersSheet.appendRow([
      orderId,
      timestamp,
      customerName,
      customerPhone,
      city,
      deliveryAddress,
      landmarkNotes,
      paymentMethod,
      itemsSummary,
      subtotal,
      shippingFee,
      grandTotal,
      status,
      trackingNotes
    ]);

    // Send Email notification to merchant if notification email is set
    try {
      var settings = getSettingsData();
      var merchantEmail = settings.orderNotificationEmail;
      if (merchantEmail && merchantEmail.indexOf('@') > 0) {
        var subject = '🛍️ طلب جديد #' + orderId + ' من ' + customerName;
        var body = 'رقم الطلب: ' + orderId + '\\n' +
                   'العميل: ' + customerName + ' (' + customerPhone + ')\\n' +
                   'المدينة: ' + city + '\\n' +
                   'العنوان: ' + deliveryAddress + '\\n' +
                   'طريقة الدفع: ' + paymentMethod + '\\n' +
                   'الإجمالي: ' + grandTotal + ' ' + (settings.currency || 'ر.س') + '\\n\\n' +
                   'تفاصيل المنتجات:\\n' + itemsSummary;
        MailApp.sendEmail(merchantEmail, subject, body);
      }
    } catch (err) {
      Logger.log('Email notice skipped: ' + err.toString());
    }

    return jsonResponse({
      success: true,
      orderId: orderId,
      message: 'Order saved successfully to Google Sheet'
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.toString()
    });
  }
}

function getStoreData(api) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var result = {};

  if (api === 'all' || api === 'settings') {
    result.settings = getSettingsData();
  }
  if (api === 'all' || api === 'products') {
    result.products = getProductsData();
  }
  if (api === 'all' || api === 'policies') {
    result.policies = getPoliciesData();
  }

  return result;
}

function getSettingsData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('⚙️ Settings');
  if (!sheet) return {};

  var data = sheet.getDataRange().getValues();
  var settings = {};
  for (var i = 1; i < data.length; i++) {
    var key = data[i][0];
    var val = data[i][1];
    if (key) {
      var camelKey = toCamelCase(key.toString());
      settings[camelKey] = val;
    }
  }
  return settings;
}

function getProductsData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('👗 Products');
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var headers = data[0].map(function(h) { return toCamelCase(h.toString()); });
  var products = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue;
    var item = {};
    for (var j = 0; j < headers.length; j++) {
      var h = headers[j];
      var val = row[j];
      if (h === 'variants') {
        item.variants = val ? val.toString().split(',').map(function(s) { return s.trim(); }) : [];
      } else if (h === 'galleryImages') {
        item.galleryImages = val ? val.toString().split(',').map(function(s) { return s.trim(); }) : [];
      } else if (h === 'featured' || h === 'inStock') {
        item[h] = (val === true || val === 'TRUE' || val === 'true' || val === 1);
      } else if (h === 'price' || h === 'salePrice') {
        item[h] = Number(val) || 0;
      } else {
        item[h] = val;
      }
    }
    products.push(item);
  }
  return products;
}

function getPoliciesData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('🌿 Information');
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  var list = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) {
      list.push({
        id: data[i][0],
        title: data[i][1],
        content: data[i][2]
      });
    }
  }
  return list;
}

function findOrderById(orderId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('📦 Orders');
  if (!sheet) return { found: false, error: 'Orders sheet missing' };

  var data = sheet.getDataRange().getValues();
  var cleanId = orderId.toUpperCase().trim();

  for (var i = 1; i < data.length; i++) {
    var rowId = (data[i][0] || '').toString().toUpperCase().trim();
    if (rowId === cleanId) {
      return {
        found: true,
        order: {
          id: data[i][0],
          timestamp: data[i][1],
          customerName: data[i][2],
          customerPhone: data[i][3],
          city: data[i][4],
          deliveryAddress: data[i][5],
          landmarkNotes: data[i][6],
          paymentMethod: data[i][7],
          itemsSummary: data[i][8],
          subtotal: data[i][9],
          shippingFee: data[i][10],
          grandTotal: data[i][11],
          status: data[i][12],
          trackingNotes: data[i][13]
        }
      };
    }
  }
  return { found: false, message: 'Order not found' };
}

function toCamelCase(str) {
  return str.replace(/[^a-zA-Z0-9 ]/g, '').trim().split(/\\s+/).map(function(word, idx) {
    if (idx === 0) return word.toLowerCase();
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join('');
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function clearCache() {
  SpreadsheetApp.getActiveSpreadsheet().toast('تم تحديث البيانات!', 'Quick E-Commerce', 3);
}
`;
}

/**
 * Connects to a live Google Apps Script Web App URL and retrieves the store data
 * Implements CORS and redirect handling specified in technical brief
 */
export async function fetchFromLiveGoogleSheet(webAppUrl: string): Promise<{
  success: boolean;
  data?: {
    settings?: Partial<StoreSettings>;
    products?: Product[];
    policies?: StorePolicy[];
  };
  error?: string;
}> {
  try {
    const separator = webAppUrl.includes('?') ? '&' : '?';
    const targetUrl = `${webAppUrl}${separator}api=all`;

    // Note: redirect: 'follow' is critical for Google Apps Script 302 redirects
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = await response.json();
    return {
      success: true,
      data: json,
    };
  } catch (err: any) {
    console.error('Error fetching from live Google Apps Script:', err);
    return {
      success: false,
      error: err.message || 'فشل الاتصال برابط Google Apps Script. يرجى التأكد من صلاحية الرابط وتفعيل صلاحية Anyone.',
    };
  }
}

/**
 * Posts an order to the live Google Apps Script Web App
 * Uses Content-Type: text/plain to avoid CORS preflight rejection while retaining JSON body
 */
export async function postOrderToLiveGoogleSheet(
  webAppUrl: string,
  order: Order
): Promise<{ success: boolean; orderId?: string; error?: string }> {
  try {
    const response = await fetch(webAppUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      redirect: 'follow',
      body: JSON.stringify(order),
    });

    const json = await response.json();
    return {
      success: json.success ?? true,
      orderId: json.orderId || order.id,
    };
  } catch (err: any) {
    console.warn('Live Google Apps Script dispatch note:', err);
    // Even if remote CORS blocks reading the response body, the POST may still reach the sheet
    return {
      success: true,
      orderId: order.id,
    };
  }
}
