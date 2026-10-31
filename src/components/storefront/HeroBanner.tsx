import React from 'react';
import { StoreSettings } from '../../types/store';
import { toWhatsAppNumber } from '../../utils/digits';
import { Sparkles, MessageCircle, ArrowDown } from 'lucide-react';

interface HeroBannerProps {
  settings: StoreSettings;
  onExploreClick: () => void;
  onOpenBrandStudio?: () => void;
  onOpenTracker?: () => void;
  isMerchantLoggedIn?: boolean;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ 
  settings, 
  onExploreClick, 
  onOpenBrandStudio,
  onOpenTracker,
  isMerchantLoggedIn = false
}) => {
  const brand = settings.brandTheme || {
    primaryColor: '#0F172A',
    accentColor: '#2563EB',
    secondaryAccentColor: '#2563EB',
    highlightColor: '#86EFAC',
    backgroundColor: '#F8FAFC',
    neutralColor: '#E2E8F0',
    textColor: '#0F172A',
  };

  const cleanWhatsapp = toWhatsAppNumber(settings.whatsappNumber);

  return (
    <div 
      className="relative overflow-hidden rounded-2xl sm:rounded-3xl p-4 sm:p-7 mb-4 border transition-all duration-300 w-full"
      style={{ 
        backgroundColor: '#FFFFFF',
        borderColor: brand.neutralColor,
        boxShadow: '0 4px 20px rgba(15,23,42,0.04)'
      }}
    >
      {/* Background Accent Subtle Glow */}
      <div 
        className="absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl opacity-10 pointer-events-none"
        style={{ backgroundColor: brand.accentColor }}
      />

      <div className="relative max-w-2xl mx-auto text-center space-y-2.5 sm:space-y-3">
        {/* Unboxed Brand Subtitle & Tagline (Zero-Pill Discipline) */}
        {(settings.storeSubtitle || settings.tagline) && (
          <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-stone-500">
            <Sparkles className="w-3.5 h-3.5" style={{ color: brand.accentColor }} />
            <span>{settings.storeSubtitle || settings.storeName}</span>
            {settings.tagline && (
              <>
                <span aria-hidden="true" className="text-stone-300">·</span>
                <span className="truncate max-w-[240px] sm:max-w-md">{settings.tagline}</span>
              </>
            )}
          </div>
        )}

        {/* Hero Title */}
        <h2 
          className="text-lg sm:text-2xl md:text-3xl font-black tracking-tight leading-snug break-words"
          style={{ color: brand.primaryColor }}
        >
          {settings.heroTitle || settings.storeName}
        </h2>

        {/* Hero Subtitle */}
        {(settings.heroSubtitle || settings.tagline) && (
          <p className="text-xs sm:text-sm max-w-lg mx-auto leading-relaxed text-stone-600 break-words font-medium">
            {settings.heroSubtitle || settings.tagline}
          </p>
        )}

        {/* Mobile-Friendly Trust Strip */}
        <div className="flex items-center justify-center flex-wrap gap-x-2 gap-y-1 text-[11px] sm:text-xs text-stone-500 pt-1">
          <span>دفع آمن مدى وأبل باي</span>
          <span aria-hidden="true" className="text-stone-300">·</span>
          <span>توصيل لكافة مدن المملكة</span>
          <span aria-hidden="true" className="text-stone-300">·</span>
          <span>فوترة إلكترونية معتمدة</span>
        </div>

        {/* Action CTAs (Touch Hitboxes >= 44px) */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          <button
            type="button"
            onClick={onExploreClick}
            className="min-h-[44px] px-5 py-2.5 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            style={{ backgroundColor: brand.accentColor }}
          >
            <span>استكشاف المنتجات</span>
            <ArrowDown className="w-3.5 h-3.5" />
          </button>

          {cleanWhatsapp && (
            <a
              href={`https://wa.me/${cleanWhatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold border bg-white hover:bg-stone-50 text-emerald-800 transition-colors flex items-center justify-center gap-2 active:scale-95"
              style={{ borderColor: brand.neutralColor }}
            >
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              <span>استفسار واتساب</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
