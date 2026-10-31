import React from 'react';
import { StoreSettings } from '../../types/store';
import { toWhatsAppNumber } from '../../utils/digits';
import { Sparkles, Zap, Palette, PackageCheck, MessageCircle } from 'lucide-react';

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
      <div className="relative max-w-2xl mx-auto text-center space-y-3">
        {/* Top Badge */}
        {(settings.storeSubtitle || settings.tagline) && (
          <div 
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold border max-w-full"
            style={{ 
              backgroundColor: `${brand.accentColor}10`, 
              borderColor: `${brand.accentColor}30`, 
              color: brand.accentColor 
            }}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {settings.storeSubtitle ? `${settings.storeSubtitle} · ` : ''}{settings.tagline}
            </span>
          </div>
        )}

        {/* Hero Title */}
        <h2 
          className="text-lg sm:text-2xl md:text-3xl font-extrabold tracking-tight leading-snug break-words"
          style={{ color: brand.primaryColor }}
        >
          {settings.heroTitle || settings.storeName}
        </h2>

        {/* Hero Subtitle */}
        {(settings.heroSubtitle || settings.tagline) && (
          <p 
            className="text-xs sm:text-sm max-w-lg mx-auto leading-relaxed text-stone-600 break-words"
          >
            {settings.heroSubtitle || settings.tagline}
          </p>
        )}

        {/* Action CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <button
            onClick={onExploreClick}
            className="px-4 py-2 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-transform active:scale-95 flex items-center gap-1.5 cursor-pointer"
            style={{ backgroundColor: brand.accentColor }}
          >
            <span>استكشاف المنتجات</span>
            <Zap className="w-3.5 h-3.5" />
          </button>

          {onOpenTracker && (
            <button
              onClick={onOpenTracker}
              className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold border bg-stone-50 hover:bg-stone-100 text-stone-700 transition-colors flex items-center gap-1.5 cursor-pointer"
              style={{ borderColor: brand.neutralColor }}
            >
              <PackageCheck className="w-3.5 h-3.5 text-stone-500" />
              <span>تتبع شحنتك</span>
            </button>
          )}

          {cleanWhatsapp && (
            <a
              href={`https://wa.me/${cleanWhatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold border bg-white hover:bg-stone-50 text-emerald-700 transition-colors flex items-center gap-1.5"
              style={{ borderColor: brand.neutralColor }}
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>استفسار واتساب</span>
            </a>
          )}

          {isMerchantLoggedIn && onOpenBrandStudio && (
            <button
              onClick={onOpenBrandStudio}
              className="px-3 py-2 rounded-xl text-xs sm:text-sm font-bold border bg-white hover:bg-stone-50 transition-colors flex items-center gap-1.5 cursor-pointer"
              style={{ borderColor: brand.neutralColor, color: brand.primaryColor }}
            >
              <Palette className="w-3.5 h-3.5" style={{ color: brand.accentColor }} />
              <span className="hidden sm:inline">تخصيص الهوية</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
