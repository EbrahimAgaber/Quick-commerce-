import React, { useState } from 'react';
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
  Check
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
}) => {
  const [isStoreMenuOpen, setIsStoreMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

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

  // Strictly show Merchant Toolbar ONLY when the logged-in user owns this store (or is inside dashboard view) and is not in shopper preview mode
  const showMerchantToolbar = !isShopperPreviewOnly && Boolean(currentUser && (isStoreOwner || viewMode === 'dashboard'));

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200">
      {/* Top Merchant Control Bar - Strictly isolated to the authenticated store owner */}
      {showMerchantToolbar && currentUser && (
        <div 
          className="text-stone-200 px-4 py-1.5 text-xs flex flex-wrap items-center justify-between gap-2 border-b"
          style={{ backgroundColor: brand.primaryColor, borderColor: 'rgba(255,255,255,0.1)' }}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span 
                className="inline-block w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: brand.highlightColor || '#86EFAC' }}
              />
              <span className="font-bold text-white text-xs">لوحة التاجر</span>
            </div>

            {/* Store Switcher Dropdown - Shows ONLY this merchant's own stores */}
            <div className="relative">
              <button
                onClick={() => setIsStoreMenuOpen(!isStoreMenuOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors font-medium text-xs cursor-pointer"
              >
                <Store className="w-3.5 h-3.5" style={{ color: brand.highlightColor || '#86EFAC' }} />
                <span className="max-w-[120px] sm:max-w-[180px] truncate">{settings.storeName}</span>
                <ChevronDown className="w-3 h-3 text-stone-300" />
              </button>

              {isStoreMenuOpen && (
                <div 
                  className="absolute right-0 top-full mt-1.5 w-64 bg-white text-stone-900 rounded-2xl shadow-xl border border-stone-200 p-2 z-50 animate-in fade-in zoom-in-95"
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
              className="hidden sm:flex items-center gap-1 px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-xs font-medium cursor-pointer"
              title="نسخ رابط المتجر للعملاء"
            >
              {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Share2 className="w-3 h-3" />}
              <span>{copiedLink ? 'تم نسخ رابط المتجر!' : 'نسخ رابط المتجر للعملاء'}</span>
            </button>
          </div>

          {/* Simplified View Switcher: Dashboard vs Visitor Storefront ONLY */}
          <div className="flex items-center gap-1 bg-black/25 p-0.5 rounded-lg border border-white/10">
            <button
              onClick={() => onViewModeChange('dashboard')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'dashboard'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>لوحة التحكم</span>
            </button>

            <button
              onClick={() => onViewModeChange('storefront')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'storefront'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5 text-amber-500" />
              <span>واجهة الزبون</span>
            </button>
          </div>

          {/* Owner Profile & Device Preview */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-xs font-medium cursor-pointer"
              >
                {currentUser.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-[#86EFAC] text-[#0F172A] flex items-center justify-center text-[10px] font-black">
                    {currentUser.name.charAt(0) || 'U'}
                  </div>
                )}
                <span className="hidden sm:inline max-w-[100px] truncate">{currentUser.name}</span>
                <ChevronDown className="w-3 h-3 text-stone-300" />
              </button>

              {isUserMenuOpen && (
                <div 
                  className="absolute left-0 top-full mt-1.5 w-60 bg-white text-stone-900 rounded-2xl shadow-xl border border-stone-200 p-2 z-50 animate-in fade-in zoom-in-95"
                  onClick={() => setIsUserMenuOpen(false)}
                >
                  <div className="px-3 py-2 border-b border-stone-100 flex items-center gap-2.5">
                    {currentUser.avatarUrl ? (
                      <img src={currentUser.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-stone-200 shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[#86EFAC] text-[#0F172A] flex items-center justify-center text-xs font-black shrink-0">
                        {currentUser.name.charAt(0) || 'U'}
                      </div>
                    )}
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

      {/* Main Customer Storefront Header - 100% Pure Brand Experience */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-2xl text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0 border border-black/10"
            style={{ backgroundColor: brand.primaryColor }}
          >
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-cover rounded-2xl" />
            ) : (
              <span>{settings.logoLetter || 'A'}</span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight leading-snug" style={{ color: brand.primaryColor }}>
                {settings.storeName}
              </h1>
              {settings.storeSubtitle && (
                <span 
                  className="text-xs px-2.5 py-0.5 rounded-full font-medium hidden sm:inline" 
                  style={{ backgroundColor: brand.neutralColor, color: brand.textColor }}
                >
                  {settings.storeSubtitle}
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 line-clamp-1 max-w-[200px] sm:max-w-xs">
              {settings.tagline}
            </p>
          </div>
        </div>

        {/* Search input in desktop */}
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

        {/* Storefront Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Brand Customizer Trigger - Strictly shown ONLY to the verified store owner when not in shopper preview */}
          {showMerchantToolbar && isStoreOwner && (
            <button
              onClick={onOpenBrandStudio}
              className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-bold text-white rounded-xl shadow-xs transition-transform active:scale-95 cursor-pointer"
              style={{ backgroundColor: brand.accentColor }}
              title="تخصيص الهوية البصرية، الألوان، والخطوط"
            >
              <Palette className="w-4 h-4" />
              <span className="hidden sm:inline">تخصيص الهوية</span>
            </button>
          )}

          {/* Track Order Button */}
          <button
            onClick={onOpenTracker}
            className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors cursor-pointer"
          >
            <PackageCheck className="w-4 h-4" style={{ color: brand.accentColor }} />
            <span className="hidden sm:inline">تتبع طلبك</span>
          </button>

          {/* Store Policies */}
          <button
            onClick={onOpenPolicies}
            className="flex items-center gap-1 px-2.5 py-2 text-xs sm:text-sm font-medium text-stone-600 hover:text-stone-900 rounded-xl transition-colors cursor-pointer"
            title="سياسات المتجر والضمان"
          >
            <Info className="w-4 h-4" />
          </button>

          {/* Cart Drawer Trigger */}
          <button
            onClick={onOpenCart}
            className="relative flex items-center gap-2 px-3.5 py-2 text-white rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
            style={{ backgroundColor: brand.primaryColor }}
            aria-label="سلة المشتريات"
          >
            <ShoppingBag className="w-4 h-4" style={{ color: brand.highlightColor || '#86EFAC' }} />
            <div className="flex flex-col text-right leading-none">
              <span className="text-[11px] text-stone-300 font-medium hidden sm:inline">السلة</span>
              <span className="text-xs font-bold text-white">
                {cartTotal > 0 ? `${cartTotal.toLocaleString('en-US')} ${settings.currency}` : `0 ${settings.currency}`}
              </span>
            </div>
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

      {/* Mobile search bar */}
      <div className="md:hidden px-4 pb-3">
        <div className="relative w-full">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="ابحث عن المنتجات أو الأقسام..."
            className="w-full pr-10 pl-4 py-2 bg-stone-100 text-stone-900 text-sm rounded-xl border border-stone-200 focus:outline-none placeholder:text-stone-400"
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
    </header>
  );
};
