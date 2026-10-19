export type StoreFont = 
  | 'Cairo' 
  | 'Tajawal' 
  | 'Almarai' 
  | 'Readex Pro' 
  | 'Alexandria' 
  | 'IBM Plex Sans Arabic' 
  | 'Amiri' 
  | 'Poppins' 
  | 'Inter' 
  | 'Plus Jakarta Sans' 
  | string;

export interface BrandTheme {
  primaryColor: string; // e.g. #0B253F (Main brand headers & high contrast)
  accentColor: string; // e.g. #0077FF (Primary CTA & buttons)
  highlightColor: string; // e.g. #A5F3B6 (Badges & discounts)
  backgroundColor: string; // e.g. #F8FAFC (Page background)
  neutralColor: string; // e.g. #E4E7EB (Borders & cards)
  textColor: string; // e.g. #0B253F (Body text & labels)
  secondaryAccentColor?: string; // Brand-specific secondary accent
  fontFamily: string; // Google Font family name
  customGoogleFont?: string; // Custom Google Font user input
  borderRadius: number; // e.g. 12
}

export interface PromoCode {
  code: string; // e.g. 'EID20'
  type: 'percentage' | 'fixed';
  value: number; // e.g. 20 (%) or 50 (currency)
  minOrderAmount?: number;
  active: boolean;
  expiryDate?: string;
  maxUses?: number;
  usageCount?: number;
}

export interface StoreSettings {
  storeName: string;
  storeSubtitle?: string;
  businessType?: string;
  logoLetter?: string;
  logoUrl?: string;
  tagline: string;
  currency: string;
  whatsappNumber: string;
  supportPhone: string;
  supportEmail: string;
  instagramHandle: string;
  tiktokHandle: string;
  websiteUrl?: string;
  freeShippingThreshold: number;
  standardShippingRate: number;
  shippingFee?: number;
  paymentMethods: string[];
  bankDetails: {
    bankName: string;
    iban: string;
    accountHolder: string;
  };
  orderNotificationEmail: string;
  primaryColor: string;
  secondaryColor: string;
  brandTheme: BrandTheme;
  heroTitle?: string;
  heroSubtitle?: string;
  announcementText: string;
  deliveryEstimationDays: string;
  promoCodes?: PromoCode[];
  googleWebAppUrl?: string;
  legalName?: string;
  commercialRegister?: string;
  vatNumber?: string;
  pricesIncludeVat?: boolean;
  vatRate?: number;
  city?: string;
  googleAnalyticsId?: string;
  facebookPixelId?: string;
  tiktokPixelId?: string;
  snapchatPixelId?: string;
  enableStorePickup?: boolean;
  storePickupAddress?: string;
  driverName?: string;
  driverPhone?: string;
  driverFee?: number;
  storeLocationUrl?: string;
  enableOnlinePayments?: boolean;
  moyasarPublishableKey?: string;
  moyasarSecretKey?: string;
  moyasarTestMode?: boolean;
  notificationWebhookUrl?: string;
  enableAudioNotifications?: boolean;
  enableDesktopNotifications?: boolean;
  enableEmailNotifications?: boolean;
  telegramBotToken?: string;
  telegramChatId?: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  salePrice?: number;
  variants: string[];
  imageUrl: string;
  galleryImages: string[];
  description: string;
  featured: boolean;
  inStock: boolean;
  stockQuantity?: number;
  fabricComposition?: string;
  colorName?: string;
}

export type OrderStatus = 'Received' | 'In Progress' | 'Out for Delivery' | 'Delivered' | 'Cancelled' | 'Paid' | 'Payment Failed';

export interface OrderItem {
  productId: string;
  name: string;
  variant?: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

export interface Order {
  id: string;
  timestamp: string;
  createdAt?: string;
  customerName: string;
  customerPhone: string;
  city: string;
  deliveryAddress: string;
  landmarkNotes?: string;
  paymentMethod: string;
  itemsSummary: string;
  items: OrderItem[];
  subtotal: number;
  discountCode?: string;
  discountAmount?: number;
  shippingFee: number;
  grandTotal: number;
  status: OrderStatus;
  trackingNotes?: string;
  courierName?: string;
  courierPhone?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  deliveryType?: 'delivery' | 'pickup';
  googleMapsUrl?: string;
  driverCashCollected?: number;
  driverDeliveredAt?: string;
  driverSettled?: boolean;
  driverSettledAt?: string;
  vatAmount?: number;
  vatRate?: number;
  paymentId?: string;
  paidAt?: string;
}

export interface StorePolicy {
  id: string;
  title: string;
  content: string;
  icon: string;
}

export interface CartItem {
  product: Product;
  selectedVariant: string;
  quantity: number;
}

export interface MerchantUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface GoogleSheetConfig {
  sheetId?: string;
  sheetUrl?: string;
  webAppUrl?: string;
  status: 'connected' | 'simulated';
  lastSyncedAt?: string;
}

export interface StoreInstance {
  id: string;
  slug: string;
  ownerId: string;
  createdAt: string;
  settings: StoreSettings;
  products: Product[];
  orders: Order[];
  policies: StorePolicy[];
  googleSheetConfig?: GoogleSheetConfig;
}
