import React from 'react';
import { Store, Search, PackageCheck, ShoppingBag, LayoutDashboard, Sparkles } from 'lucide-react';
import { StoreSettings, BrandTheme } from '../../types/store';

interface MobileBottomNavProps {
  settings: StoreSettings;
  activeTab: 'store' | 'search' | 'tracker' | 'cart' | 'dashboard';
  onSelectTab: (tab: 'store' | 'search' | 'tracker' | 'cart' | 'dashboard') => void;
  cartCount: number;
  cartTotal: number;
  onOpenCart: () => void;
  onOpenTracker: () => void;
  onToggleSearch: () => void;
  onOpenDashboard?: () => void;
  isStoreOwner?: boolean;
  isDashboardActive?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  settings,
  activeTab,
  onSelectTab,
  cartCount,
  cartTotal,
  onOpenCart,
  onOpenTracker,
  onToggleSearch,
  onOpenDashboard,
  isStoreOwner = false,
  isDashboardActive = false,
}) => {
  const brand: BrandTheme = settings.brandTheme || {
    primaryColor: '#0F172A',
    accentColor: '#2563EB',
    highlightColor: '#86EFAC',
    backgroundColor: '#F8FAFC',
    neutralColor: '#E2E8F0',
    textColor: '#0F172A',
  };

  return (
    <nav 
      aria-label="التنقل الرئيسي للجوال"
      className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200/90 pb-safe sm:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
    >
      <div className="grid grid-cols-4 items-center h-15 px-2">
        {/* Tab 1: Store / Catalog */}
        <button
          type="button"
          onClick={() => onSelectTab('store')}
          className={`flex flex-col items-center justify-center min-h-[48px] py-1 transition-all active:scale-95 cursor-pointer ${
            activeTab === 'store' && !isDashboardActive ? 'font-bold' : 'text-stone-500'
          }`}
          style={{
            color: activeTab === 'store' && !isDashboardActive ? brand.accentColor : undefined,
          }}
        >
          <div className="relative">
            <Store className="w-5 h-5" />
            {activeTab === 'store' && !isDashboardActive && (
              <span
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: brand.accentColor }}
              />
            )}
          </div>
          <span className="text-[11px] mt-1 leading-none">المتجر</span>
        </button>

        {/* Tab 2: Search & Filter */}
        <button
          type="button"
          onClick={() => {
            onSelectTab('search');
            onToggleSearch();
          }}
          className={`flex flex-col items-center justify-center min-h-[48px] py-1 transition-all active:scale-95 cursor-pointer ${
            activeTab === 'search' ? 'font-bold' : 'text-stone-500'
          }`}
          style={{
            color: activeTab === 'search' ? brand.accentColor : undefined,
          }}
        >
          <div className="relative">
            <Search className="w-5 h-5" />
            {activeTab === 'search' && (
              <span
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: brand.accentColor }}
              />
            )}
          </div>
          <span className="text-[11px] mt-1 leading-none">البحث</span>
        </button>

        {/* Tab 3: Order Tracker */}
        <button
          type="button"
          onClick={() => {
            onSelectTab('tracker');
            onOpenTracker();
          }}
          className={`flex flex-col items-center justify-center min-h-[48px] py-1 transition-all active:scale-95 cursor-pointer ${
            activeTab === 'tracker' ? 'font-bold' : 'text-stone-500'
          }`}
          style={{
            color: activeTab === 'tracker' ? brand.accentColor : undefined,
          }}
        >
          <div className="relative">
            <PackageCheck className="w-5 h-5" />
            {activeTab === 'tracker' && (
              <span
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: brand.accentColor }}
              />
            )}
          </div>
          <span className="text-[11px] mt-1 leading-none">تتبع طلبك</span>
        </button>

        {/* Tab 4: Cart / Shopping Bag (or Dashboard if owner) */}
        {isStoreOwner && isDashboardActive ? (
          <button
            type="button"
            onClick={onOpenDashboard}
            className="flex flex-col items-center justify-center min-h-[48px] py-1 transition-all active:scale-95 cursor-pointer font-bold"
            style={{ color: brand.accentColor }}
          >
            <div className="relative">
              <LayoutDashboard className="w-5 h-5" />
              <span
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: brand.accentColor }}
              />
            </div>
            <span className="text-[11px] mt-1 leading-none">لوحة التحكم</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              onSelectTab('cart');
              onOpenCart();
            }}
            className="flex flex-col items-center justify-center min-h-[48px] py-1 transition-all active:scale-95 cursor-pointer text-stone-700 relative"
          >
            <div className="relative">
              <ShoppingBag className="w-5 h-5" style={{ color: cartCount > 0 ? brand.accentColor : undefined }} />
              {cartCount > 0 && (
                <span
                  className="absolute -top-1.5 -right-2 text-[10px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center text-white shadow-xs"
                  style={{ backgroundColor: brand.accentColor }}
                >
                  {cartCount}
                </span>
              )}
            </div>
            <span className="text-[11px] mt-1 leading-none font-bold">
              {cartCount > 0 ? `${cartTotal.toLocaleString('en-US')} ${settings.currency}` : 'السلة'}
            </span>
          </button>
        )}
      </div>
    </nav>
  );
};
