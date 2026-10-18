import { StoreSettings, Product, Order, StorePolicy, BrandTheme } from '../types/store';

export const MODERN_RETAIL_THEME: BrandTheme = {
  primaryColor: '#0F172A', // Slate 900 (High-contrast, elegant)
  accentColor: '#2563EB', // Royal Blue (High converting CTA)
  highlightColor: '#86EFAC', // Soft Mint (Discounts & Badges)
  backgroundColor: '#F8FAFC', // Crisp Slate 50
  neutralColor: '#E2E8F0', // Slate 200 (Clean borders)
  textColor: '#0F172A',
  secondaryAccentColor: '#F59E0B', // Amber 500
  fontFamily: 'Cairo',
  borderRadius: 14,
};

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: 'أورورا ريتيل | Aurora Store',
  storeSubtitle: 'تشكيلة حصرية منتقاة بعناية',
  logoLetter: 'A',
  tagline: 'تسوق أحدث المنتجات العصرية الفاخرة مع توصيل سريع وضمان جودة معتمد',
  currency: 'ر.س',
  whatsappNumber: '966500000000',
  supportPhone: '+966 50 000 0000',
  supportEmail: 'support@aurorastore.com',
  instagramHandle: '@aurora.boutique',
  tiktokHandle: '@aurora.store',
  websiteUrl: '',
  freeShippingThreshold: 250,
  standardShippingRate: 20,
  paymentMethods: [
    'الدفع عند الاستلام (Cash on Delivery)',
    'تحويل بنكي فوري (Bank Transfer)',
    'بطاقات مدى / فيزا / Apple Pay',
  ],
  bankDetails: {
    bankName: 'مصرف الراجحي / البنك الأهلي',
    iban: 'SA0000000000000000000000',
    accountHolder: 'متجر أورورا للتجزئة الحديثة',
  },
  orderNotificationEmail: 'orders@aurorastore.com',
  primaryColor: '#0F172A',
  secondaryColor: '#2563EB',
  brandTheme: MODERN_RETAIL_THEME,
  heroTitle: 'أناقة عصرية وتجربة تسوق استثنائية',
  heroSubtitle:
    'استكشف تشكيلة واسعة من الإكسسوارات والمقتنيات الفاخرة بجودة فائقة وضمان ذهبي مع شحن فوري لكافة المدن.',
  announcementText: '✨ شحن مجاني لكافة الطلبات فوق 250 ر.س · طلب فوري عبر الواتساب والدفع عند الاستلام',
  deliveryEstimationDays: '1 - 3 أيام عمل للتسليم المباشر',
  googleWebAppUrl: '',
};

export const DEFAULT_PRODUCTS: Product[] = [
  {
    id: 'prod-001',
    name: 'ساعة يد كلاسيكية فاخرة بإطار ستانلس ستيل',
    category: 'ساعات وإكسسوارات',
    price: 360,
    salePrice: 280,
    variants: ['ميناء كحلي داكن', 'ميناء أسود مطفي', 'ميناء فضي كلاسيكي'],
    imageUrl: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=800&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
    ],
    description:
      'ساعة يد فاخرة مصنعة من أجود أنواع الستانلس ستيل المقاوم للصدأ 316L مع زجاج ياقوتي مضاد للخدش ومقاومة للماء حتى عمق 50 متراً. ملائمة لجميع المناسبات الرسمية واليومية.',
    featured: true,
    inStock: true,
    fabricComposition: 'ستانلس ستيل 316L · زجاج ياقوتي',
    colorName: 'كحلي ملوكي',
  },
  {
    id: 'prod-002',
    name: 'حقيبة ظهر جلدية عصرية متعددة الجيوب',
    category: 'حقائب ومقتنيات',
    price: 320,
    salePrice: 245,
    variants: ['جلد هافان بني كلاسيكي', 'جلد أسود كربوني'],
    imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80',
    ],
    description:
      'حقيبة ظهر عملية وأنيقة من الجلد الطبيعي المعالج، تحتوي على جيب مبطن ومخصص لأجهزة الحاسوب حتى 15.6 بوصة، مع حمالات كتف مريحة وتوزيع ذكي للوزن.',
    featured: true,
    inStock: true,
    fabricComposition: 'جلد طبيعي فاخر · بطانة مقاومة للمياه',
    colorName: 'هافان بني',
  },
  {
    id: 'prod-003',
    name: 'نظارة شمسية بإطار تيتانيوم مصقول وعدسات مستقطبة',
    category: 'ساعات وإكسسوارات',
    price: 210,
    salePrice: 165,
    variants: ['إطار رمادي تيتانيوم', 'إطار ذهبي مطفي'],
    imageUrl: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=800&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=800&q=80',
    ],
    description:
      'نظارة شمسية خفيفة الوزن للغاية مع حماية كاملة 100% من الأشعة فوق البنفسجية UV400 وعدسات بولارايزد تمنع التوهج وتمنحك رؤية بالغة النقاء.',
    featured: true,
    inStock: true,
    fabricComposition: 'تيتانيوم فائق الخفة · عدسات مستقطبة',
    colorName: 'رمادي تيتانيوم',
  },
  {
    id: 'prod-004',
    name: 'سماعة رأس لاسلكية مريحة مع إلغاء الضوضاء النشط',
    category: 'إلكترونيات ذكية',
    price: 390,
    salePrice: 295,
    variants: ['فضي بلاتينيوم', 'أسود ليلي'],
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
    ],
    description:
      'تجربة صوتية فائقة النقاء بتقنية Hi-Res Audio مع بطارية تدوم حتى 40 ساعة متواصلة وشحن سريع يمنحك 4 ساعات تشغيل خلال 10 دقائق فقط.',
    featured: true,
    inStock: true,
    fabricComposition: 'ألمنيوم مفرغ · وسائد أذن ميموري فوم',
    colorName: 'فضي بلاتينيوم',
  },
  {
    id: 'prod-005',
    name: 'عطر أورورا نوار المركز 100 مل',
    category: 'عطور ومستحضرات',
    price: 260,
    salePrice: 195,
    variants: ['عبوة 100 مل', 'عبوة 50 مل السفر'],
    imageUrl: 'https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=800&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=800&q=80',
    ],
    description:
      'توليفة عطرية شرقية حديثة بنفحات البرغموت والعود الأبيض وخشب الأرز والعنبر الدافئ، بثبات استثنائي يدوم لأكثر من 24 ساعة.',
    featured: false,
    inStock: true,
    fabricComposition: 'تركيز أو دو بارفان (Eau de Parfum)',
    colorName: 'أورورا نوار',
  },
  {
    id: 'prod-006',
    name: 'محفظة بطاقات نحيفة ذكية بتقنية حماية RFID',
    category: 'حقائب ومقتنيات',
    price: 110,
    salePrice: 85,
    variants: ['جلد كربوني أسود', 'جلد عسلي أصلي'],
    imageUrl: 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=800&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=800&q=80',
    ],
    description:
      'محفظة بطاقات مدمجة تتسع لـ 8 بطاقات مع آلية إخراج سريعة بلمسة زر واحدة وطبقة حماية تمنع سرقة بيانات البطاقات اللاسلكية.',
    featured: false,
    inStock: true,
    fabricComposition: 'جلد طبيعي · حماية RFID مدمجة',
    colorName: 'كربون أسود',
  },
];

export const DEFAULT_ORDERS: Order[] = [
  {
    id: 'ORD-1088',
    timestamp: '2026-10-16T10:15:00Z',
    customerName: 'سارة الشمري',
    customerPhone: '+966501234567',
    city: 'الرياض',
    deliveryAddress: 'حي الياسمين - شارع أنس بن مالك',
    landmarkNotes: 'التواصل عبر الواتساب قبل الوصول',
    paymentMethod: 'الدفع عند الاستلام',
    itemsSummary: '1x ساعة يد كلاسيكية فاخرة بإطار ستانلس ستيل - 280 ر.س',
    items: [
      {
        productId: 'prod-001',
        name: 'ساعة يد كلاسيكية فاخرة بإطار ستانلس ستيل',
        variant: 'ميناء كحلي داكن',
        price: 280,
        quantity: 1,
        imageUrl: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=800&q=80',
      },
    ],
    subtotal: 280,
    shippingFee: 0,
    grandTotal: 280,
    status: 'In Progress',
    trackingNotes: 'تم تأكيد الطلب وجاري تجهيز الشحنة مع شركة الشحن.',
  },
];

export const DEFAULT_POLICIES: StorePolicy[] = [
  {
    id: 'policy-01',
    title: 'سرعة الشحن والتوصيل المباشر',
    icon: 'Truck',
    content: `• يتم تجهيز وشحن الطلبات فور تأكيدها خلال 24 ساعة عمل.
• التوصيل لجميع المدن الرئيسية خلال 1 إلى 3 أيام عمل كحد أقصى.
• كود تتبع مباشر للشحنة يتم إرساله للعميل لمتابعة مسار الطلب لحظة بلحظة.`,
  },
  {
    id: 'policy-02',
    title: 'الضمان الذهبي والاستبدال المرن',
    icon: 'RefreshCw',
    content: `• ضمان ذهبي شامل 100% ضد عيوب الصناعة مع استبدال فوري.
• إمكانية الاستبدال أو الاسترجاع بكل سهولة خلال 14 يوماً من استلام الطلب.`,
  },
  {
    id: 'policy-03',
    title: 'طرق دفع آمنة ومتنوعة',
    icon: 'Sparkles',
    content: `• خيارات مرنة تشمل الدفع عند الاستلام، التحويل البنكي المباشر، وبطاقات مدى وApple Pay.
• بياناتك الشخصية ومعاملاتك مشفرة ومحمية بأعلى معايير الأمان العالمية.`,
  },
  {
    id: 'policy-04',
    title: 'خدمة عملاء ودعم مباشر عبر الواتساب',
    icon: 'MessageCircle',
    content: `• فريق دعم متواجد لخدمتك والإجابة على أي استفسارات على مدار الساعة.
• متابعة شخصية لكل عميل لضمان تجربة تسوق راقية ومرضية تماماً.`,
  },
];

export const BRAND_PRESETS = [
  {
    id: 'modern-retail',
    name: 'Modern Retail (الافتراضي العصري)',
    theme: MODERN_RETAIL_THEME,
    description: 'Slate 900 #0F172A, Royal Blue #2563EB, crisp slate background #F8FAFC',
  },
  {
    id: 'simpler-navy',
    name: 'Deep Navy & Electric Blue (أزرق تقني)',
    theme: {
      primaryColor: '#0B253F',
      accentColor: '#0077FF',
      highlightColor: '#A5F3B6',
      backgroundColor: '#F8F3ED',
      neutralColor: '#E4E7EB',
      textColor: '#0B253F',
      secondaryAccentColor: '#FF6B35',
      fontFamily: 'Cairo' as const,
      borderRadius: 12,
    },
    description: 'Deep navy with electric blue and warm cream background',
  },
  {
    id: 'warm-amber',
    name: 'Warm Amber & Gold (بوتيك فاخر)',
    theme: {
      primaryColor: '#1C1917',
      accentColor: '#D97706',
      highlightColor: '#FDE68A',
      backgroundColor: '#FAF9F6',
      neutralColor: '#E7E5E4',
      textColor: '#1C1917',
      secondaryAccentColor: '#B45309',
      fontFamily: 'Alexandria' as const,
      borderRadius: 14,
    },
    description: 'Luxury warm stone with golden amber accents',
  },
  {
    id: 'emerald-fresh',
    name: 'Emerald Green (أخضر زمردي طبيعي)',
    theme: {
      primaryColor: '#064E3B',
      accentColor: '#059669',
      highlightColor: '#A7F3D0',
      backgroundColor: '#F7FDF9',
      neutralColor: '#D1FAE5',
      textColor: '#064E3B',
      secondaryAccentColor: '#10B981',
      fontFamily: 'Tajawal' as const,
      borderRadius: 10,
    },
    description: 'Natural forest greens with fresh mint highlights',
  },
  {
    id: 'monochrome-minimal',
    name: 'Minimal Mono (أسود وأبيض مونوكروم)',
    theme: {
      primaryColor: '#18181B',
      accentColor: '#18181B',
      highlightColor: '#E4E4E7',
      backgroundColor: '#FFFFFF',
      neutralColor: '#E4E4E7',
      textColor: '#18181B',
      secondaryAccentColor: '#71717A',
      fontFamily: 'Inter' as const,
      borderRadius: 8,
    },
    description: 'High fashion editorial black, white, and subtle zinc borders',
  },
];

const STORAGE_KEYS = {
  SETTINGS: 'storelink_settings',
  PRODUCTS: 'storelink_products',
  ORDERS: 'storelink_orders',
  POLICIES: 'storelink_policies',
};

export function safeSetLocalStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn(`LocalStorage quota notice for key "${key}":`, e);
    try {
      // Evict old cached orders first to free space
      if (key !== STORAGE_KEYS.ORDERS) {
        const rawOrders = localStorage.getItem(STORAGE_KEYS.ORDERS);
        if (rawOrders) {
          const parsed = JSON.parse(rawOrders);
          if (Array.isArray(parsed) && parsed.length > 30) {
            localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(parsed.slice(0, 30)));
          }
        }
      }
      localStorage.setItem(key, value);
    } catch (retryErr) {
      console.warn('Could not persist to localStorage after eviction:', retryErr);
    }
  }
}

export class StoreStorage {
  static getSettings(): StoreSettings {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === 'object') {
          return {
            ...DEFAULT_SETTINGS,
            ...parsed,
            brandTheme: parsed.brandTheme || DEFAULT_SETTINGS.brandTheme,
          };
        }
      }
    } catch (e) {
      console.error('Error reading settings from localStorage', e);
    }
    return DEFAULT_SETTINGS;
  }

  static saveSettings(settings: StoreSettings): void {
    safeSetLocalStorage(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    this.dispatchUpdate();
  }

  static getProducts(): Product[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      if (data !== null) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error reading products from localStorage', e);
    }
    return [];
  }

  static saveProducts(products: Product[]): void {
    safeSetLocalStorage(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    this.dispatchUpdate();
  }

  static getOrders(): Order[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ORDERS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error('Error reading orders from localStorage', e);
    }
    return DEFAULT_ORDERS;
  }

  static saveOrders(orders: Order[]): void {
    safeSetLocalStorage(STORAGE_KEYS.ORDERS, JSON.stringify(orders.slice(0, 150)));
    this.dispatchUpdate();
  }

  static addOrder(newOrder: Order): void {
    const orders = this.getOrders();
    const updated = [newOrder, ...orders];
    this.saveOrders(updated);
  }

  static updateOrderStatus(orderId: string, status: Order['status'], trackingNotes?: string): void {
    const orders = this.getOrders();
    const updated = orders.map((ord) => {
      if (ord.id === orderId) {
        return {
          ...ord,
          status,
          trackingNotes: trackingNotes !== undefined ? trackingNotes : ord.trackingNotes,
        };
      }
      return ord;
    });
    this.saveOrders(updated);
  }

  static getPolicies(): StorePolicy[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.POLICIES);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error reading policies from localStorage', e);
    }
    return DEFAULT_POLICIES;
  }

  static savePolicies(policies: StorePolicy[]): void {
    safeSetLocalStorage(STORAGE_KEYS.POLICIES, JSON.stringify(policies));
    this.dispatchUpdate();
  }

  /**
   * Batches hydrating all 4 active store slices in a single event dispatch
   */
  static hydrateStore(data: {
    settings: StoreSettings;
    products: Product[];
    orders: Order[];
    policies: StorePolicy[];
  }): void {
    safeSetLocalStorage(STORAGE_KEYS.SETTINGS, JSON.stringify(data.settings));
    safeSetLocalStorage(STORAGE_KEYS.PRODUCTS, JSON.stringify(data.products));
    safeSetLocalStorage(STORAGE_KEYS.ORDERS, JSON.stringify((data.orders || []).slice(0, 150)));
    safeSetLocalStorage(STORAGE_KEYS.POLICIES, JSON.stringify(data.policies));
    this.dispatchUpdate();
  }

  static resetToDefault(): void {
    safeSetLocalStorage(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
    safeSetLocalStorage(STORAGE_KEYS.PRODUCTS, JSON.stringify(DEFAULT_PRODUCTS));
    safeSetLocalStorage(STORAGE_KEYS.ORDERS, JSON.stringify(DEFAULT_ORDERS));
    safeSetLocalStorage(STORAGE_KEYS.POLICIES, JSON.stringify(DEFAULT_POLICIES));
    this.dispatchUpdate();
  }

  private static dispatchUpdate(): void {
    window.dispatchEvent(new Event('storelink_db_updated'));
  }
}
