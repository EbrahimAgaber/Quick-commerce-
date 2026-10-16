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
  backgroundColor: string; // e.g. #F8F3ED (Page background)
  neutralColor: string; // e.g. #E4E7EB (Borders & cards)
  textColor: string; // e.g. #0B253F (Body text & labels)
  secondaryAccentColor?: string; // Brand-specific secondary accent (e.g. #FF6B35, #8B5CF6)
  fontFamily: string; // Google Font family name
  customGoogleFont?: string; // Custom Google Font user input
  borderRadius: number; // e.g. 12
}

export interface StoreSettings {
  storeName: string;
  storeSubtitle?: string;
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
  googleWebAppUrl?: string;
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
  fabricComposition?: string;
  colorName?: string;
}

export type OrderStatus = 'Received' | 'In Progress' | 'Out for Delivery' | 'Delivered' | 'Cancelled';

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
  customerName: string;
  customerPhone: string;
  city: string;
  deliveryAddress: string;
  landmarkNotes?: string;
  paymentMethod: string;
  itemsSummary: string;
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  grandTotal: number;
  status: OrderStatus;
  trackingNotes?: string;
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
  googleSheetConfig: GoogleSheetConfig;
}
