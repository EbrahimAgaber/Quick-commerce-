import React, { useState, useRef, useEffect } from 'react';
import { StoreSettings, MerchantUser, StoreInstance } from '../../types/store';
import { 
  ShoppingBag, 
  Search, 
  Smartphone, 
  Monitor, 
  Info, 
  PackageCheck, 
  Palette, 
  LayoutDashboard,
  Plus,
  User,
  ChevronDown,
  LogOut,
  Store,
  Share2,
  Check,
  Truck,
  X
} from 'lucide-react';

export type AppViewMode = 'landing' | 'dashboard' | 'storefront';
export type DevicePreviewMode = 'desktop' | 'mobile';

interface NavbarProps {
  settings: StoreSettings;
  cartCount: number;
  cartTotal: number;
  onOpenCart: () => void;
  onOpenTracker: () => void;
  onOpenPolicies: () => void;
  onOpenBrandStudio: () => void;
  onOpenNewStoreWizard?: () => void;
  onOpenCaptainPortal?: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  viewMode: AppViewMode;
  onViewModeChange: (mode: AppViewMode) => void;
  devicePreview: DevicePreviewMode;
  onDevicePreviewChange: (mode: DevicePreviewMode) => void;
  currentUser?: MerchantUser | null;
  isStoreOwner?: boolean;
  merchantStores?: StoreInstance[];
  activeStoreId?: string;
  activeStoreSlug?: string;
  onSelectStore?: (storeId: string) => void;
  onOpenAuth?: () => void;
  onLogout?: () => void;
  isShopperPreviewOnly?: boolean;
  isMobileSearchExpanded?: boolean;
  onToggleMobileSearch?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  settings,
  cartCount,
  cartTotal,
  onOpenCart,
  onOpenTracker,
  onOpenPolicies,
  onOpenBrandStudio,
  onOpenNewStoreWizard,
  onOpenCaptainPortal,
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  devicePreview,
  onDevicePreviewChange,
  currentUser,
  isStoreOwner = false,
  merchantStores = [],
  activeStoreId,
  activeStoreSlug,
  onSelectStore,
  onOpenAuth,
  onLogout,
  isShopperPreviewOnly = false,
  isMobileSearchExpanded = false,
  onToggleMobileSearch,
}) => {
  const [isStoreMenuOpen, setIsStoreMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [localSearchExpanded, setLocalSearchExpanded] = useState(false);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);

  const isSearchVisible = isMobileSearchExpanded || localSearchExpanded || Boolean(searchQuery);

  const brand = settings.brandTheme || {
    primaryColor: '#0F172A',
    accentColor: '#2563EB',
    highlightColor: '#86EFAC',
    backgroundColor: '#F8FAFC',
    neutralColor: '#E2E8F0',
    textColor: '#0F172A',
  };

  const handleCopyShareLink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const shareUrl = `${origin}/?store=${encodeURIComponent(activeStoreSlug || activeStoreId || 'aurora')}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const toggleSearch = () => {
    if (onToggleMobileSearch) {
      onToggleMobileSearch();
    } else {
      setLocalSearchExpanded((prev) => !prev);
    }
  };

  useEffect(() => {
    if (isSearchVisible && mobileSearchInputRef.current) {
      mobileSearchInputRef.current.focus();
    }
  }, [isSearchVisible]);

  // Strictly show Merchant Toolbar ONLY when the logged-in user owns this store (or is inside dashboard view) and is not in shopper preview mode
  const showMerchantToolbar = !isShopperPreviewOnly && Boolean(currentUser && (isStoreOwner || viewMode === 'dashboard'));

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200">
      {/* Top Merchant Control Bar - Strictly isolated to the authenticated store owner */}
      {showMerchantToolbar && currentUser && (
        <div 
          className="text-stone-200 px-3 sm:px-4 py-1.5 text-xs flex items-center justify-between gap-2 border-b overflow-x-auto scrollbar-none"
          style={{ backgroundColor: brand.primaryColor, borderColor: 'rgba(255,255,255,0.1)' }}
        >
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="flex items-center gap-1.5">
              <span 
                className="inline-block w-2 h-2 rounded-full animate-pulse shrink-0"
                style={{ backgroundColor: brand.highlightColor || '#86EFAC' }}
              />
              <span className="font-bold text-white text-[11px] sm:text-xs whitespace-nowrap">لوحة التاجر</span>
            </div>

            {/* Store Switcher Dropdown - Shows ONLY this merchant's own stores */}
            <div className="relative">
              <button
                onClick={() => setIsStoreMenuOpen(!isStoreMenuOpen)}
                className="flex items-center gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors font-medium text-[11px] sm:text-xs cursor-pointer whitespace-nowrap"
              >
                <Store className="w-3 h-3 sm:w-3.5 sm:h-3.5" style={{ color: brand.highlightColor || '#86EFAC' }} />
                <span className="max-w-[100px] sm:max-w-[160px] truncate">{settings.storeName}</span>
                <ChevronDown className="w-3 h-3 text-stone-300" />
              </button>

              {isStoreMenuOpen && (
                <div 
                  className="absolute right-0 top-full mt-1.5 w-60 sm:w-64 bg-white text-stone-900 rounded-2xl shadow-xl border border-stone-200 p-2 z-50 animate-in fade-in zoom-in-95"
                  onClick={() => setIsStoreMenuOpen(false)}
                >
                  <div className="text-[11px] font-bold text-stone-400 px-2 py-1">متاجرك الخاصة:</div>
                  <div className="space-y-1">
                    {merchantStores.length > 0 ? (
                      merchantStores.map((st) => (
                        <button
                          key={st.id}
                          onClick={() => onSelectStore && onSelectStore(st.id)}
                          className={`w-full text-right px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                            st.id === activeStoreId ? 'bg-blue-50 text-[#2563EB] font-bold' : 'hover:bg-stone-50 text-stone-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: st.settings.primaryColor || '#2563EB' }} />
                            <span className="truncate">{st.settings.storeName}</span>
                          </div>
                          {st.id === activeStoreId && <span className="text-[10px] text-[#2563EB]">نشط</span>}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-xs text-stone-500">لم تقم بإنشاء متجر بعد</div>
                    )}
                  </div>

                  <div className="border-t border-stone-100 mt-2 pt-2">
                    <button
                      onClick={() => {
                        if (onOpenNewStoreWizard) onOpenNewStoreWizard();
                      }}
                      className="w-full text-right px-3 py-2 rounded-xl text-xs font-bold text-[#2563EB] hover:bg-blue-50 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ إنشاء متجر جديد</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Share Live Store URL */}
            <button
              onClick={handleCopyShareLink}
              className="flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-[11px] sm:text-xs font-medium cursor-pointer whitespace-nowrap"
              title="نسخ رابط المتجر للعملاء"
            >
              {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Share2 className="w-3 h-3" />}
              <span className="hidden sm:inline">{copiedLink ? 'تم النسخ!' : 'نسخ رابط المتجر'}</span>
              <span className="sm:hidden">{copiedLink ? 'تم' : 'مشاركة'}</span>
            </button>
          </div>

          {/* View Switcher: Dashboard vs Storefront */}
          <div className="flex items-center gap-1 shrink-0">
            <div className="flex items-center gap-1 bg-black/25 p-0.5 rounded-lg border border-white/10">
              <button
                onClick={() => onViewModeChange('dashboard')}
                className={`flex items-center gap-1 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded text-[11px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  viewMode === 'dashboard'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-300 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-3 h-3 text-[#2563EB]" />
                <span className="hidden sm:inline">لوحة التحكم</span>
                <span className="sm:hidden">الإدارة</span>
              </button>

              <button
                onClick={() => onViewModeChange('storefront')}
                className={`flex items-center gap-1 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded text-[11px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  viewMode === 'storefront'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-300 hover:text-white'
                }`}
              >
                <ShoppingBag className="w-3 h-3 text-amber-500" />
                <span className="hidden sm:inline">واجهة الزبون</span>
                <span className="sm:hidden">المتجر</span>
              </button>
            </div>

            {/* Owner Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-1 p-1 sm:px-2 sm:py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-xs font-medium cursor-pointer"
              >
                {currentUser.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-[#86EFAC] text-[#0F172A] flex items-center justify-center text-[10px] font-black">
                    {currentUser.name.charAt(0) || 'U'}
                  </div>
                )}
                <ChevronDown className="w-3 h-3 text-stone-300" />
              </button>

              {isUserMenuOpen && (
                <div 
                  className="absolute left-0 top-full mt-1.5 w-56 sm:w-60 bg-white text-stone-900 rounded-2xl shadow-xl border border-stone-200 p-2 z-50 animate-in fade-in zoom-in-95"
                  onClick={() => setIsUserMenuOpen(false)}
                >
                  <div className="px-3 py-2 border-b border-stone-100 flex items-center gap-2.5">
                    <div className="overflow-hidden">
                      <div className="font-bold text-xs text-stone-900 truncate">{currentUser.name}</div>
                      <div className="text-[11px] text-stone-500 font-mono truncate">{currentUser.email}</div>
                    </div>
                  </div>

                  <div className="pt-1">
                    <button
                      onClick={onOpenAuth}
                      className="w-full text-right px-3 py-2 rounded-xl text-xs hover:bg-stone-50 text-stone-700 flex items-center gap-2 cursor-pointer"
                    >
                      <User className="w-3.5 h-3.5 text-stone-500" />
                      <span>تبديل الحساب</span>
                    </button>

                    <button
                      onClick={() => {
                        if (onLogout) onLogout();
                      }}
                      className="w-full text-right px-3 py-2 rounded-xl text-xs hover:bg-red-50 text-red-600 flex items-center gap-2 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>تسجيل الخروج</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {viewMode === 'storefront' && (
              <div className="hidden md:flex items-center gap-1 text-[11px] text-stone-300 mr-2 border-r border-white/20 pr-2">
                <button
                  onClick={() => onDevicePreviewChange('desktop')}
                  className={`p-1 rounded transition-colors cursor-pointer ${
                    devicePreview === 'desktop' ? 'bg-white/20 text-white' : 'text-stone-400 hover:text-white'
                  }`}
                  title="عرض شاشة سطح المكتب"
                >
                  <Monitor className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDevicePreviewChange('mobile')}
                  className={`p-1 rounded transition-colors cursor-pointer ${
                    devicePreview === 'mobile' ? 'bg-white/20 text-white' : 'text-stone-400 hover:text-white'
                  }`}
                  title="معاينة شاشة الجوال"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Customer Storefront Header - Compact, Touch-First & Clean */}
      {viewMode !== 'dashboard' && (
        <>
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-3">
            {/* Zone 1: Brand Wordmark & Avatar */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div 
                className="relative w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl p-[1.5px] shadow-xs flex items-center justify-center shrink-0 overflow-hidden"
                style={{ 
                  background: `linear-gradient(135deg, ${brand.primaryColor}, ${brand.accentColor})` 
                }}
              >
                <div 
                  className="w-full h-full rounded-[10px] sm:rounded-[14px] flex items-center justify-center overflow-hidden p-0.5"
                  style={{ backgroundColor: settings.logoUrl ? '#FFFFFF' : brand.primaryColor }}
                >
                  {settings.logoUrl ? (
                    <img 
                      src={settings.logoUrl} 
                      alt={settings.storeName || 'Logo'} 
                      className="w-full h-full object-contain filter drop-shadow-xs" 
                    />
                  ) : (
                    <span className="font-extrabold text-sm sm:text-base tracking-wider text-white">
                      {settings.logoLetter || (settings.storeName ? settings.storeName.charAt(0) : 'S')}
                    </span>
                  )}
                </div>
              </div>
              <div className="min-w-0">
                <h1 
                  className="text-sm sm:text-lg font-black tracking-tight leading-tight truncate" 
                  style={{ color: brand.primaryColor }}
                >
                  {settings.storeName}
                </h1>
                {settings.tagline && (
                  <p className="text-[11px] sm:text-xs text-stone-500 truncate max-w-[140px] sm:max-w-xs font-medium">
                    {settings.tagline}
                  </p>
                )}
              </div>
            </div>

            {/* Zone 2: Desktop Search Bar */}
            <div className="hidden md:flex items-center flex-1 max-w-md mx-6">
              <div className="relative w-full">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="ابحث عن منتج أو قسم..."
                  className="w-full pr-10 pl-4 py-2 bg-stone-100 hover:bg-stone-50 focus:bg-white text-stone-900 text-sm rounded-xl border border-stone-200 focus:outline-none transition-all placeholder:text-stone-400"
                  style={{ borderColor: brand.neutralColor }}
                />
                <Search className="absolute right-3 top-2.5 w-4 h-4 text-stone-400" />
                {searchQuery && (
                  <button
                    onClick={() => onSearchChange('')}
                    className="absolute left-3 top-2.5 text-xs text-stone-400 hover:text-stone-600 cursor-pointer"
                  >
                    مسح
                  </button>
                )}
              </div>
            </div>

            {/* Zone 3: Storefront Actions (Touch-Optimized Hitboxes >= 44px) */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              {/* Mobile Search Toggle Button */}
              <button
                type="button"
                onClick={toggleSearch}
                className="md:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors active:scale-95 cursor-pointer"
                aria-label="البحث عن منتج"
              >
                <Search className="w-5 h-5" style={{ color: isSearchVisible ? brand.accentColor : undefined }} />
              </button>

              {/* Brand Customizer Trigger (Desktop owner only) */}
              {showMerchantToolbar && isStoreOwner && (
                <button
                  onClick={onOpenBrandStudio}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-bold text-white rounded-xl shadow-xs transition-transform active:scale-95 cursor-pointer min-h-[44px]"
                  style={{ backgroundColor: brand.accentColor }}
                  title="تخصيص الهوية البصرية، الألوان، والخطوط"
                >
                  <Palette className="w-4 h-4" />
                  <span>تخصيص الهوية</span>
                </button>
              )}

              {/* Delivery Captain Portal Button */}
              {isStoreOwner && onOpenCaptainPortal && (
                <button
                  type="button"
                  onClick={onOpenCaptainPortal}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer min-h-[44px]"
                  title="بوابة كباتن التوصيل وتسجيل المناديب"
                >
                  <Truck className="w-4 h-4 text-emerald-600" />
                  <span>الكباتن</span>
                </button>
              )}

              {/* Track Order Button */}
              <button
                onClick={onOpenTracker}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center sm:px-3 sm:py-2 text-xs sm:text-sm font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors cursor-pointer active:scale-95"
                title="تتبع شحنتك وطلبك"
              >
                <PackageCheck className="w-4.5 h-4.5 sm:w-4 sm:h-4" style={{ color: brand.accentColor }} />
                <span className="hidden sm:inline mr-1.5">تتبع طلبك</span>
              </button>

              {/* Store Policies */}
              <button
                onClick={onOpenPolicies}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-stone-600 hover:text-stone-900 rounded-xl transition-colors cursor-pointer active:scale-95"
                title="سياسات المتجر والضمان"
                aria-label="سياسات المتجر"
              >
                <Info className="w-4.5 h-4.5 sm:w-4 sm:h-4" />
              </button>

              {/* Cart Drawer Trigger */}
              <button
                onClick={onOpenCart}
                className="relative flex items-center justify-center gap-1.5 px-3 sm:px-3.5 h-10 sm:h-11 min-h-[44px] text-white rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                style={{ backgroundColor: brand.primaryColor }}
                aria-label="سلة المشتريات"
              >
                <ShoppingBag className="w-4.5 h-4.5" style={{ color: brand.highlightColor || '#86EFAC' }} />
                <span className="text-xs font-mono font-bold text-white whitespace-nowrap">
                  {cartTotal > 0 ? `${cartTotal.toLocaleString('en-US')}` : '0'}
                  <span className="text-[10px] mr-0.5 font-sans">{settings.currency}</span>
                </span>
                {cartCount > 0 && (
                  <span 
                    className="absolute -top-1.5 -right-1.5 font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow-md border-2 border-white"
                    style={{ backgroundColor: brand.accentColor, color: '#ffffff' }}
                  >
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Collapsible Mobile Search Field */}
          {isSearchVisible && (
            <div className="md:hidden px-3.5 pb-2.5 animate-in slide-in-from-top-4 duration-200">
              <div className="relative w-full">
                <input
                  ref={mobileSearchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="ابحث عن منتج، تصنيف، أو مواصفات..."
                  className="w-full pr-10 pl-9 py-2.5 bg-stone-100 text-stone-900 text-sm rounded-xl border border-stone-200 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                />
                <Search className="absolute right-3 top-3 w-4 h-4 text-stone-400" />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => onSearchChange('')}
                    className="absolute left-2.5 top-2.5 p-1 text-stone-400 hover:text-stone-700 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={toggleSearch}
                    className="absolute left-2.5 top-2.5 p-1 text-stone-400 hover:text-stone-700 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </header>
  );
};
