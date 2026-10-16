import React from 'react';
import { StoreSettings } from '../../types/store';
import { MessageCircle, ExternalLink, Sparkles, Mail, Phone, LogIn } from 'lucide-react';

interface FooterProps {
  settings: StoreSettings;
  onOpenPolicies: () => void;
  onOpenTracker: () => void;
  onOpenBrandStudio?: () => void;
  onOpenAuth?: () => void;
  isMerchantLoggedIn?: boolean;
}

export const Footer: React.FC<FooterProps> = ({ 
  settings, 
  onOpenPolicies, 
  onOpenTracker, 
  onOpenBrandStudio,
  onOpenAuth,
  isMerchantLoggedIn = false
}) => {
  const brand = settings.brandTheme || {
    primaryColor: '#0F172A',
    accentColor: '#2563EB',
    highlightColor: '#86EFAC',
    backgroundColor: '#F8FAFC',
    neutralColor: '#E2E8F0',
    textColor: '#0F172A',
  };

  const cleanWhatsapp = (settings.whatsappNumber || '').replace(/\D/g, '');
  const displayPhone = settings.supportPhone || `+${cleanWhatsapp}`;

  return (
    <footer 
      className="mt-20 text-white transition-colors"
      style={{ backgroundColor: brand.primaryColor }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Col */}
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center gap-2.5">
              <div 
                className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-base shadow-sm border border-white/20"
                style={{ backgroundColor: brand.accentColor }}
              >
                {settings.logoLetter || 'A'}
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">{settings.storeName}</h3>
                {settings.storeSubtitle && (
                  <p className="text-xs text-stone-300">{settings.storeSubtitle}</p>
                )}
              </div>
            </div>

            <p className="text-xs text-stone-300 max-w-sm leading-relaxed">
              {settings.tagline}. متجر رقمي متكامل يوفر تجربة تسوق سريعة ومريحة مع دعم مباشر للطلب الفوري عبر الواتساب.
            </p>

            <div className="text-xs text-stone-300 pt-1 space-y-1">
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-stone-400" />
                <span dir="ltr">{displayPhone}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-stone-400" />
                <span>{settings.supportEmail || 'support@quick-ecommerce.app'}</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">روابط المتجر</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={onOpenTracker}
                  className="text-stone-300 hover:text-white transition-colors cursor-pointer"
                >
                  تتبع حالة الطلب والشحنة
                </button>
              </li>
              <li>
                <button
                  onClick={onOpenPolicies}
                  className="text-stone-300 hover:text-white transition-colors cursor-pointer"
                >
                  السياسات والشحن والضمان
                </button>
              </li>
              {isMerchantLoggedIn && onOpenBrandStudio && (
                <li>
                  <button
                    onClick={onOpenBrandStudio}
                    className="text-stone-300 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span>تخصيص الهوية والألوان</span>
                    <Sparkles className="w-3 h-3 text-amber-400" />
                  </button>
                </li>
              )}
              {settings.websiteUrl && (
                <li>
                  <a
                    href={settings.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-stone-300 hover:text-white transition-colors flex items-center gap-1"
                  >
                    <span>الموقع الرسمي</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
              )}
            </ul>
          </div>

          {/* Customer Service & WhatsApp */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">خدمة العملاء والطلب الفوري</h4>
            <p className="text-xs text-stone-300">
              لأي استفسار أو متابعة خاصة لطلبك، فريق الدعم متواجد لخدمتك عبر الواتساب:
            </p>
            {cleanWhatsapp && (
              <a
                href={`https://wa.me/${cleanWhatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                <MessageCircle className="w-4 h-4" />
                <span>محادثة واتساب مباشرة</span>
              </a>
            )}
          </div>
        </div>

        {/* Bottom Credits & Discreet Merchant Login */}
        <div className="mt-12 pt-6 border-t border-white/10 text-[11px] text-stone-400 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} {settings.storeName}. كافة الحقوق محفوظة.</p>
          
          <div className="flex items-center gap-4 text-stone-400">
            {onOpenAuth && (
              <button
                onClick={onOpenAuth}
                className="text-stone-400 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer text-xs"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{isMerchantLoggedIn ? 'لوحة التاجر' : 'دخول التاجر'}</span>
              </button>
            )}
            <span className="text-stone-600">•</span>
            <span className="text-stone-500">منصة التجارة السريعة (Quick E-Commerce)</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
