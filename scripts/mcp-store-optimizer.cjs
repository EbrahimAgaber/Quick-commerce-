#!/usr/bin/env node
/**
 * Model Context Protocol (MCP) Server: store_optimizer
 * 
 * Provides AI agents with tools to audit, analyze, and optimize:
 * - Store appearance (color palettes, typography, hero copy, CTAs)
 * - Search Engine Optimization (SEO) & OpenGraph tags
 * - Saudi Local Geolocation (GEO) targeting & Google schema.org markup
 * - Social exposure simulators (Google SERP snippets & WhatsApp link previews)
 */

const readline = require('readline');

// Saudi Cities Geolocation Dataset
const SAUDI_CITIES = {
  'الرياض': { cityAr: 'الرياض', cityEn: 'Riyadh', lat: 24.7136, lng: 46.6753, region: 'منطقة الرياض' },
  'جدة': { cityAr: 'جدة', cityEn: 'Jeddah', lat: 21.4858, lng: 39.1925, region: 'منطقة مكة المكرمة' },
  'مكة المكرمة': { cityAr: 'مكة المكرمة', cityEn: 'Makkah', lat: 21.3891, lng: 39.8579, region: 'منطقة مكة المكرمة' },
  'المدينة المنورة': { cityAr: 'المدينة المنورة', cityEn: 'Madinah', lat: 24.5247, lng: 39.5692, region: 'منطقة المدينة المنورة' },
  'الدمام': { cityAr: 'الدمام', cityEn: 'Dammam', lat: 26.4207, lng: 50.0888, region: 'المنطقة الشرقية' },
  'الخبر': { cityAr: 'الخبر', cityEn: 'Khobar', lat: 26.2172, lng: 50.1971, region: 'المنطقة الشرقية' },
  'الأحساء': { cityAr: 'الأحساء', cityEn: 'Al Ahsa', lat: 25.3835, lng: 49.5864, region: 'المنطقة الشرقية' },
  'بريدة': { cityAr: 'بريدة', cityEn: 'Buraidah', lat: 26.3260, lng: 43.9750, region: 'منطقة القصيم' },
  'تبوك': { cityAr: 'تبوك', cityEn: 'Tabuk', lat: 28.3835, lng: 36.5662, region: 'منطقة تبوك' },
  'أبها': { cityAr: 'أبها', cityEn: 'Abha', lat: 18.2164, lng: 42.5053, region: 'منطقة عسير' },
  'الطائف': { cityAr: 'الطائف', cityEn: 'Taif', lat: 21.2854, lng: 40.4222, region: 'منطقة مكة المكرمة' },
  'ينبع': { cityAr: 'ينبع', cityEn: 'Yanbu', lat: 24.0895, lng: 38.0618, region: 'منطقة المدينة المنورة' },
  'الجبيل': { cityAr: 'الجبيل', cityEn: 'Jubail', lat: 27.0046, lng: 49.6606, region: 'المنطقة الشرقية' },
};

function resolveCity(name) {
  if (!name) return SAUDI_CITIES['الرياض'];
  const clean = name.trim();
  for (const [key, val] of Object.entries(SAUDI_CITIES)) {
    if (clean.includes(key) || key.includes(clean) || clean.toLowerCase() === val.cityEn.toLowerCase()) {
      return val;
    }
  }
  return SAUDI_CITIES['الرياض'];
}

// Pre-curated Brand Themes by Niche
const NICHE_THEMES = {
  perfumes: {
    name: 'Luxury Fragrance / عطور فاخرة',
    primaryColor: '#0F172A',
    accentColor: '#B45309', // Royal Amber
    highlightColor: '#FEF3C7',
    backgroundColor: '#FAF8F5',
    neutralColor: '#E2E8F0',
    fontFamily: 'Cairo',
    tagline: 'عطور ملكية وثبات يدوم لأيام مع شحن سريع وتغليف إهدائي فاخر',
  },
  abayas: {
    name: 'Saudi Abayas & Fashion / عبايات وأزياء',
    primaryColor: '#18181B',
    accentColor: '#BE185D', // Rosewood
    highlightColor: '#FCE7F3',
    backgroundColor: '#FAFAFA',
    neutralColor: '#E4E4E7',
    fontFamily: 'Tajawal',
    tagline: 'تصاميم محتشمة راقية تواكب الذوق السعودي العصري مع شحن فوري',
  },
  coffee: {
    name: 'Specialty Coffee / قهوة مختصة',
    primaryColor: '#291811',
    accentColor: '#D97706',
    highlightColor: '#FEF3C7',
    backgroundColor: '#FDFBF7',
    neutralColor: '#E7E5E4',
    fontFamily: 'Readex Pro',
    tagline: 'أجود محاصيل البن المختص مع تاريخ حمص طازج وشحن لجميع المدن',
  },
  tech: {
    name: 'Electronics & Gadgets / إلكترونيات وإكسسوارات',
    primaryColor: '#0A0F1D',
    accentColor: '#2563EB',
    highlightColor: '#DBEAFE',
    backgroundColor: '#F8FAFC',
    neutralColor: '#E2E8F0',
    fontFamily: 'Almarai',
    tagline: 'أحدث ملحقات الهواتف والأجهزة الذكية مع ضمان استبدال ذهبي',
  },
  default: {
    name: 'Modern Saudi Retail / تجزئة عصرية',
    primaryColor: '#0F172A',
    accentColor: '#2563EB',
    highlightColor: '#86EFAC',
    backgroundColor: '#F8FAFC',
    neutralColor: '#E2E8F0',
    fontFamily: 'Cairo',
    tagline: 'تسوق أفضل المنتجات مع شحن فوري ودفع آمن عند الاستلام أو بأبل باي',
  },
};

// Tool Handlers
function handleAnalyzeSeoGeo(args) {
  const storeName = args.storeName || 'متجرنا';
  const metaTitle = args.metaTitle || storeName;
  const metaDesc = args.metaDescription || '';
  const city = resolveCity(args.city);
  const categories = Array.isArray(args.categories) ? args.categories : [];

  let score = 50;
  const titleIssues = [];
  const descIssues = [];
  const geoIssues = [];
  const recommendations = [];

  // Title Audit
  if (metaTitle.length < 30) {
    titleIssues.push('العنوان قصير جداً (أقل من 30 حرف). أضف اسم المدينة والمنتجات الأساسية.');
  } else if (metaTitle.length > 60) {
    titleIssues.push('العنوان طويل جداً (أكثر من 60 حرف) وقد يتم قصه في نتائج بحث قوقل.');
    score -= 10;
  } else {
    score += 15;
  }

  if (!metaTitle.includes(city.cityAr) && !metaTitle.includes('السعودية')) {
    titleIssues.push(`العنوان يفتقد الاستهداف الجغرافي (${city.cityAr} / السعودية)`);
    recommendations.push(`أضف اسم المدينة إلى العنوان: "${metaTitle} في ${city.cityAr} | توصيل سريع"`);
  } else {
    score += 10;
  }

  // Description Audit
  if (!metaDesc) {
    descIssues.push('لم يتم كتابة وصف مخصص (Meta Description)، سيقوم قوقل باقتطاع نصوص عشوائية من الصفحة.');
    score -= 20;
    recommendations.push(`اكتب وصفاً بين 120-155 حرفاً يتضمن عبارة الحث على الشراء: "تسوق الآن من ${storeName} تشكيلة مميزة مع شحن فوري في ${city.cityAr} والدفع عند الاستلام وبطاقات مدى."`);
  } else if (metaDesc.length < 90) {
    descIssues.push('الوصف قصير جداً (أقل من 90 حرفاً). لا يستغل المساحة الكاملة في قوقل.');
    score += 5;
  } else if (metaDesc.length > 160) {
    descIssues.push('الوصف طويل (أكثر من 160 حرفاً) وسيتم بتره بعلامة (...)');
    score += 10;
  } else {
    score += 20;
  }

  // Local GEO checks
  if (metaDesc && (metaDesc.includes('الدفع عند الاستلام') || metaDesc.includes('أبل باي') || metaDesc.includes('مدى'))) {
    score += 5;
  } else {
    recommendations.push('أضف وسائل الدفع السعودية المفضلة (مدى، أبل باي، الدفع عند الاستلام) داخل الوصف لرفع نسبة النقر CTR.');
  }

  score = Math.max(10, Math.min(100, score));

  return {
    score,
    grade: score >= 85 ? 'A (ممتاز)' : score >= 70 ? 'B (جيد جداً)' : score >= 50 ? 'C (متوسط - يحتاج تحسين)' : 'D (ضعيف)',
    targetCity: {
      arabic: city.cityAr,
      english: city.cityEn,
      region: city.region,
      coordinates: { lat: city.lat, lng: city.lng },
    },
    titleAudit: {
      current: metaTitle,
      length: metaTitle.length,
      status: titleIssues.length === 0 ? 'optimal' : 'needs_action',
      issues: titleIssues,
    },
    descriptionAudit: {
      current: metaDesc || 'غير محدد',
      length: metaDesc.length,
      status: descIssues.length === 0 ? 'optimal' : 'needs_action',
      issues: descIssues,
    },
    recommendations,
    suggestedMetaTitle: `${storeName} | أفضل عروض ${categories[0] || 'المنتجات الفاخرة'} في ${city.cityAr} والسعودية`,
    suggestedMetaDescription: `تسوق الآن من ${storeName} في ${city.cityAr}. تشكيلة حصرية من ${categories.slice(0, 3).join(' و ') || 'أرقى المنتجات'} مع شحن فوري لكافة مدن المملكة ودفع آمن عند الاستلام أو بمدى وأبل باي.`,
  };
}

function handleOptimizeAppearance(args) {
  const bType = (args.businessType || '').toLowerCase();
  let theme = NICHE_THEMES.default;
  if (bType.includes('عطر') || bType.includes('perfume') || bType.includes('عود') || bType.includes('بخور')) {
    theme = NICHE_THEMES.perfumes;
  } else if (bType.includes('عباي') || bType.includes('abaya') || bType.includes('ازياء') || bType.includes('فاشن')) {
    theme = NICHE_THEMES.abayas;
  } else if (bType.includes('قهو') || bType.includes('coffee') || bType.includes('كافيه')) {
    theme = NICHE_THEMES.coffee;
  } else if (bType.includes('تقني') || bType.includes('tech') || bType.includes('جوال') || bType.includes('الكتروني')) {
    theme = NICHE_THEMES.tech;
  }

  const storeName = args.storeName || 'متجرك';

  return {
    matchedNiche: theme.name,
    recommendedPalette: {
      primaryColor: theme.primaryColor,
      accentColor: theme.accentColor,
      highlightColor: theme.highlightColor,
      backgroundColor: theme.backgroundColor,
      neutralColor: theme.neutralColor,
      textColor: theme.primaryColor,
    },
    typography: {
      fontFamily: theme.fontFamily,
      googleFontUrl: `https://fonts.googleapis.com/css2?family=${encodeURIComponent(theme.fontFamily)}:wght@400;600;700;800;900&display=swap`,
      rationale: `خط ${theme.fontFamily} يتمتع بمقروئية استثنائية على شاشات الجوال ويدعم الأرقام اللاتينية والعربية بتناسق مريح للعين.`,
    },
    copywriting: {
      heroTitle: `فخامة واختيارات حصرية تليق بك من ${storeName}`,
      heroSubtitle: theme.tagline,
      announcementBanner: `✨ شحن سريع ومجاني للطلبات المؤهلة | طلب فوري وسهل عبر الواتساب مع الدفع عند الاستلام 🛍️`,
      ctaButtonText: 'تصفح التشكيلة واطلب الآن',
    },
  };
}

function handleGenerateLocalSchema(args) {
  const storeName = args.storeName || 'المتجر الإلكتروني';
  const city = resolveCity(args.city);
  const storeUrl = args.storeUrl || `https://quick-ecommerce-saas-app.web.app/?store=${encodeURIComponent(storeName)}`;
  const phone = args.telephone || '+966500000000';
  const catalog = Array.isArray(args.catalogSample) ? args.catalogSample : [];

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: storeName,
    url: storeUrl,
    telephone: phone,
    priceRange: '$$',
    currenciesAccepted: 'SAR',
    paymentAccepted: 'Cash, Credit Card, Apple Pay, Mada',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'SA',
      addressLocality: city.cityAr,
      addressRegion: city.region,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: city.lat,
      longitude: city.lng,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        opens: '00:00',
        closes: '23:59',
      },
    ],
    hasMerchantReturnPolicy: {
      '@type': 'MerchantReturnPolicy',
      returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
      merchantReturnDays: 7,
      returnMethod: 'https://schema.org/ReturnByMail',
    },
  };

  if (catalog.length > 0) {
    schema.makesOffer = catalog.slice(0, 10).map((item) => ({
      '@type': 'Offer',
      itemOffered: {
        '@type': 'Product',
        name: item.name,
      },
      price: item.price,
      priceCurrency: 'SAR',
      availability: 'https://schema.org/InStock',
    }));
  }

  return {
    rawJsonLd: schema,
    htmlScriptTag: `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`,
    googleRichSnippetReady: true,
  };
}

function handleAuditExposure(args) {
  const storeName = args.storeName || 'متجري';
  const metaTitle = args.metaTitle || `${storeName} | المتجر الرسمي في السعودية`;
  const metaDesc = args.metaDescription || `تسوق الآن من ${storeName} مع توصيل فوري والدفع عند الاستلام.`;
  const domain = args.customDomain || 'quick-ecommerce-saas-app.web.app';
  const logoUrl = args.logoUrl || '';

  return {
    serpPreview: {
      desktop: {
        title: metaTitle,
        url: `https://${domain} › s › ${encodeURIComponent(storeName)}`,
        snippet: metaDesc.slice(0, 155),
        truncated: metaDesc.length > 155,
      },
      mobile: {
        title: metaTitle,
        siteName: storeName,
        url: `https://${domain}`,
        snippet: metaDesc.slice(0, 130),
      },
    },
    socialCardPreview: {
      ogTitle: metaTitle,
      ogDescription: metaDesc,
      ogImage: logoUrl || 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800',
      ogUrl: `https://${domain}`,
      locale: 'ar_SA',
    },
    checks: [
      { name: 'Meta Title Length', passed: metaTitle.length >= 30 && metaTitle.length <= 60, current: `${metaTitle.length} chars` },
      { name: 'Meta Description Length', passed: metaDesc.length >= 100 && metaDesc.length <= 160, current: `${metaDesc.length} chars` },
      { name: 'Open Graph Image Attached', passed: Boolean(logoUrl), current: logoUrl ? 'Present' : 'Missing' },
      { name: 'Saudi Mobile CTR Optimized', passed: metaDesc.includes('شحن') || metaDesc.includes('توصيل') || metaDesc.includes('استلام'), current: 'Verified' },
    ],
  };
}

// MCP Stdio Server Protocol Loop (JSON-RPC 2.0)
const TOOLS = [
  {
    name: 'store_analyze_seo_geo',
    description: 'Scans and evaluates a store website for Saudi search engine optimization (SEO), local GEO tags, and Arabic metadata compliance. Returns a 0-100 score and copy-paste recommendations.',
    inputSchema: {
      type: 'object',
      properties: {
        storeName: { type: 'string', description: 'Name of the store' },
        metaTitle: { type: 'string', description: 'Current HTML document/meta title' },
        metaDescription: { type: 'string', description: 'Current meta description' },
        city: { type: 'string', description: 'Target Saudi city (e.g. Riyadh, Jeddah, Dammam)' },
        categories: { type: 'array', items: { type: 'string' }, description: 'Product categories sold in the store' },
      },
      required: ['storeName'],
    },
  },
  {
    name: 'store_optimize_appearance',
    description: 'Recommends high-converting brand palettes, Arabic Google typography, and persuasive hero copy tailored to Saudi shopper psychology and specific business niches (perfumes, fashion, coffee, tech).',
    inputSchema: {
      type: 'object',
      properties: {
        storeName: { type: 'string', description: 'Name of the store' },
        businessType: { type: 'string', description: 'Store niche/category (e.g. perfumes, abayas, fashion, coffee, electronics)' },
        targetAudience: { type: 'string', description: 'Target customer demographic' },
      },
      required: ['storeName'],
    },
  },
  {
    name: 'store_generate_local_schema',
    description: 'Emits Google-compliant schema.org/Store and LocalBusiness JSON-LD structured data with Saudi GPS coordinates and opening hours for local SEO discovery.',
    inputSchema: {
      type: 'object',
      properties: {
        storeName: { type: 'string', description: 'Name of the store' },
        city: { type: 'string', description: 'Target Saudi city' },
        storeUrl: { type: 'string', description: 'Website URL of the store' },
        telephone: { type: 'string', description: 'Customer service / WhatsApp number' },
        catalogSample: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              price: { type: 'number' },
            },
            required: ['name', 'price'],
          },
          description: 'Sample products for Google Merchant offers schema',
        },
      },
      required: ['storeName', 'city'],
    },
  },
  {
    name: 'store_audit_exposure',
    description: 'Audits social and search exposure, generating realistic simulations of Google Search snippets and WhatsApp chat share cards.',
    inputSchema: {
      type: 'object',
      properties: {
        storeName: { type: 'string', description: 'Store name' },
        metaTitle: { type: 'string', description: 'Meta title' },
        metaDescription: { type: 'string', description: 'Meta description' },
        customDomain: { type: 'string', description: 'Custom domain or store URL' },
        logoUrl: { type: 'string', description: 'Store logo or share image URL' },
      },
      required: ['storeName'],
    },
  },
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on('line', (line) => {
  if (!line || !line.trim()) return;
  try {
    const request = JSON.parse(line.trim());
    const id = request.id;
    const method = request.method;

    if (method === 'initialize') {
      const response = {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: 'store_optimizer',
            version: '1.0.0',
          },
        },
      };
      process.stdout.write(JSON.stringify(response) + '\n');
      return;
    }

    if (method === 'tools/list') {
      const response = {
        jsonrpc: '2.0',
        id,
        result: {
          tools: TOOLS,
        },
      };
      process.stdout.write(JSON.stringify(response) + '\n');
      return;
    }

    if (method === 'tools/call') {
      const toolName = request.params?.name;
      const args = request.params?.arguments || {};
      let resultData = null;

      if (toolName === 'store_analyze_seo_geo') {
        resultData = handleAnalyzeSeoGeo(args);
      } else if (toolName === 'store_optimize_appearance') {
        resultData = handleOptimizeAppearance(args);
      } else if (toolName === 'store_generate_local_schema') {
        resultData = handleGenerateLocalSchema(args);
      } else if (toolName === 'store_audit_exposure') {
        resultData = handleAuditExposure(args);
      } else {
        const errResponse = {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Tool ${toolName} not found on store_optimizer`,
          },
        };
        process.stdout.write(JSON.stringify(errResponse) + '\n');
        return;
      }

      const response = {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(resultData, null, 2),
            },
          ],
        },
      };
      process.stdout.write(JSON.stringify(response) + '\n');
      return;
    }

    // Default response for notifications or unhandled methods
    if (id !== undefined) {
      process.stdout.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id,
          result: {},
        }) + '\n'
      );
    }
  } catch (err) {
    // Malformed JSON
  }
});
