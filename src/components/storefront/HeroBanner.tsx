import React from 'react';
import { StoreSettings } from '../../types/store';
import { toWhatsAppNumber } from '../../utils/digits';
import { Sparkles, Zap, Palette, PackageCheck, MessageCircle, Truck, ShieldCheck } from 'lucide-react';

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
      className="relative overflow-hidden rounded-3xl p-6 sm:p-10 mb-8 border transition-all duration-300"
      style={{ 
        backgroundColor: '#FFFFFF',
        borderColor: brand.neutralColor,
        boxShadow: '0 6px 24px rgba(15,23,42,0.05)'
      }}
    >
      <div className="relative max-w-4xl mx-auto text-center space-y-4">
        {/* Top Badge */}
        <div 
          className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold border"
          style={{ 
            backgroundColor: `${brand.accentColor}10`, 
            borderColor: `${brand.accentColor}30`, 
            color: brand.accentColor 
          }}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{settings.storeSubtitle ? `${settings.storeSubtitle} · ` : ''}{settings.tagline}</span>
        </div>

        {/* Hero Title */}
        <h2 
          className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight"
          style={{ color: brand.primaryColor }}
        >
          {settings.heroTitle || settings.storeName}
        </h2>

        {/* Hero Subtitle */}
        <p 
          className="text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed text-stone-600"
        >
          {settings.heroSubtitle || settings.tagline}
        </p>

        {/* Action CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            onClick={onExploreClick}
            className="px-6 py-2.5 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-transform active:scale-95 flex items-center gap-2 cursor-pointer"
            style={{ backgroundColor: brand.accentColor }}
          >
            <span>استكشاف كافة المنتجات</span>
            <Zap className="w-4 h-4" />
          </button>

          {onOpenTracker && (
            <button
              onClick={onOpenTracker}
              className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold border bg-stone-50 hover:bg-stone-100 text-stone-700 transition-colors flex items-center gap-1.5 cursor-pointer"
              style={{ borderColor: brand.neutralColor }}
            >
              <PackageCheck className="w-4 h-4 text-stone-500" />
              <span>تتبع شحنتك</span>
            </button>
          )}

          {cleanWhatsapp && (
            <a
              href={`https://wa.me/${cleanWhatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold border bg-white hover:bg-stone-50 text-emerald-700 transition-colors flex items-center gap-1.5"
              style={{ borderColor: brand.neutralColor }}
            >
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              <span>استفسار واتساب سريع</span>
            </a>
          )}

          {isMerchantLoggedIn && onOpenBrandStudio && (
            <button
              onClick={onOpenBrandStudio}
              className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold border bg-white hover:bg-stone-50 transition-colors flex items-center gap-1.5 cursor-pointer"
              style={{ borderColor: brand.neutralColor, color: brand.primaryColor }}
            >
              <Palette className="w-4 h-4" style={{ color: brand.accentColor }} />
              <span>تخصيص الهوية والألوان</span>
            </button>
          )}
        </div>

        {/* Clean E-Commerce Feature Highlights */}
        <div className="pt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl mx-auto text-center">
          <div 
            className="p-4 rounded-2xl border bg-stone-50/70 transition-transform hover:-translate-y-0.5"
            style={{ borderColor: brand.neutralColor }}
          >
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-[#2563EB] flex items-center justify-center mx-auto mb-2">
              <Truck className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-bold" style={{ color: brand.primaryColor }}>
              شحن سريع ومباشر
            </h4>
            <p className="text-[11px] text-stone-500 mt-1">توصيل آمن لجميع المدن خلال 1-3 أيام عمل</p>
          </div>

          <div 
            className="p-4 rounded-2xl border bg-stone-50/70 transition-transform hover:-translate-y-0.5"
            style={{ borderColor: brand.neutralColor }}
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-2">
              <MessageCircle className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-bold" style={{ color: brand.primaryColor }}>
              طلب فوري عبر الواتساب
            </h4>
            <p className="text-[11px] text-stone-500 mt-1">إرسال الفاتورة وتفاصيل الطلب برابط نقرة واحدة</p>
          </div>

          <div 
            className="p-4 rounded-2xl border bg-stone-50/70 transition-transform hover:-translate-y-0.5"
            style={{ borderColor: brand.neutralColor }}
          >
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-2">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-bold" style={{ color: brand.primaryColor }}>
              ضمان ذهبي 100%
            </h4>
            <p className="text-[11px] text-stone-500 mt-1">استبدال واسترجاع مرن وحماية تامة للطلب</p>
          </div>
        </div>
      </div>
    </div>
  );
};
