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
  storeSlug?: string;
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
  freelanceCertificate?: string;
  sbcNumber?: string;
  vatNumber?: string;
  pricesIncludeVat?: boolean;
  vatRate?: number;
  zatcaComplianceType?: 'non_registered' | 'phase_1' | 'phase_2';
  zatcaPhase2Uuid?: string;
  city?: string;
  restrictCodToStoreCity?: boolean;
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
  customPaymentLink?: string;
  paymentLinkProvider?: 'newleap' | 'moyasar' | 'tap' | 'paylink' | 'custom' | string;
  moyasarPublishableKey?: string;
  moyasarSecretKey?: string;
  moyasarTestMode?: boolean;
  notificationWebhookUrl?: string;
  enableAudioNotifications?: boolean;
  enableDesktopNotifications?: boolean;
  enableEmailNotifications?: boolean;
  telegramBotToken?: string;
  telegramChatId?: string;
  customDomain?: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string[];
  geoCity?: string;
  geoCoordinates?: { lat: number; lng: number };
}

export type ProductUnit =
  | 'piece'
  | 'kg'
  | 'g'
  | 'meter'
  | 'cm'
  | 'liter'
  | 'ml'
  | 'dozen'
  | 'box'
  | 'pack'
  | 'tola'
  | 'waqiyyah'
  | string;

export interface StandardUnitMeta {
  id: string;
  label: string;
  zatcaCode: string;
  defaultStep: number;
  defaultMin: number;
  allowDecimal: boolean;
}

export const STANDARD_UNITS: StandardUnitMeta[] = [
  { id: 'piece', label: 'حبة', zatcaCode: 'PCE', defaultStep: 1, defaultMin: 1, allowDecimal: false },
  { id: 'kg', label: 'كجم', zatcaCode: 'KGM', defaultStep: 0.5, defaultMin: 0.5, allowDecimal: true },
  { id: 'g', label: 'جرام', zatcaCode: 'GRM', defaultStep: 50, defaultMin: 50, allowDecimal: false },
  { id: 'meter', label: 'متر', zatcaCode: 'MTR', defaultStep: 0.5, defaultMin: 0.5, allowDecimal: true },
  { id: 'cm', label: 'سم', zatcaCode: 'CMT', defaultStep: 10, defaultMin: 10, allowDecimal: false },
  { id: 'liter', label: 'لتر', zatcaCode: 'LTR', defaultStep: 0.5, defaultMin: 0.5, allowDecimal: true },
  { id: 'ml', label: 'مل', zatcaCode: 'MLT', defaultStep: 50, defaultMin: 50, allowDecimal: false },
  { id: 'dozen', label: 'درزن', zatcaCode: 'DZN', defaultStep: 1, defaultMin: 1, allowDecimal: false },
  { id: 'box', label: 'كرتون', zatcaCode: 'BX', defaultStep: 1, defaultMin: 1, allowDecimal: false },
  { id: 'pack', label: 'طقم / باقة', zatcaCode: 'PK', defaultStep: 1, defaultMin: 1, allowDecimal: false },
  { id: 'tola', label: 'تولة', zatcaCode: 'GRM', defaultStep: 0.5, defaultMin: 0.5, allowDecimal: true },
  { id: 'waqiyyah', label: 'أوقية', zatcaCode: 'GRM', defaultStep: 1, defaultMin: 1, allowDecimal: false },
];

export function getProductUnitMeta(unit?: string): StandardUnitMeta | undefined {
  if (!unit) return undefined;
  return STANDARD_UNITS.find((u) => u.id === unit || u.label === unit);
}

export function getProductUnitLabel(unit?: string, customLabel?: string): string {
  if (customLabel && customLabel.trim()) return customLabel.trim();
  if (!unit) return '';
  const found = getProductUnitMeta(unit);
  return found ? found.label : unit;
}

export function getProductZatcaUnitCode(unit?: string): string {
  if (!unit) return 'PCE';
  const found = getProductUnitMeta(unit);
  return found ? found.zatcaCode : 'PCE';
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
  rating?: number;
  reviewsCount?: number;
  unit?: ProductUnit;
  unitLabel?: string;
  minQuantity?: number;
  quantityStep?: number;
}

export type OrderStatus =
  | 'Received'
  | 'In Progress'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Return Requested'
  | 'Returned'
  | 'Cancelled'
  | 'Paid'
  | 'Payment Failed'
  | 'Refunded'
  | 'Partially Refunded';

export interface OrderItem {
  productId: string;
  name: string;
  variant?: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  unit?: string;
  unitLabel?: string;
}

export interface ReturnClaimItem {
  productId: string;
  name: string;
  quantity: number;
  reason?: string;
}

export interface Order {
  id: string;
  storeSlug?: string;
  storeId?: string;
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
  labelUrl?: string;
  estimatedDeliveryDate?: string;
  deliveryType?: 'delivery' | 'pickup';
  googleMapsUrl?: string;
  driverCashCollected?: number;
  driverDeliveredAt?: string;
  driverSettled?: boolean;
  driverSettledAt?: string;
  deliveryPin?: string; // 4-digit verification code provided by shopper to driver upon delivery
  vatAmount?: number;
  vatRate?: number;
  zatcaComplianceType?: 'non_registered' | 'phase_1' | 'phase_2';
  invoiceUuid?: string;
  invoiceHash?: string;
  paymentId?: string;
  paidAt?: string;
  paymentStatus?: 'pending_payment' | 'pending_receipt_review' | 'paid' | 'failed' | 'refunded';
  bankTransferReceiptUrl?: string;
  bankTransferReceiptFileName?: string;
  bankTransferSenderName?: string;
  bankTransferVerifiedAt?: string;
  // Return & Refund Fields
  returnEligibleUntil?: string;
  returnRequestedAt?: string;
  returnReason?: string;
  returnNotes?: string;
  returnStatus?: 'pending' | 'approved' | 'rejected' | 'completed';
  returnItems?: ReturnClaimItem[];
  returnedAt?: string;
  refundedAmount?: number;
  refundReason?: string;
  refundedAt?: string;
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
  unit?: string;
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
