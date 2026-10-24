import React from 'react';
import { StoreSettings } from '../../types/store';
import { MessageCircle, ExternalLink, Sparkles, Mail, Phone, ShieldCheck, Building2, FileCheck2 } from 'lucide-react';
import { isValidSafeUrl } from '../../utils/security';
import { toWhatsAppNumber } from '../../utils/digits';
import { getZatcaComplianceType } from '../../utils/zatca';

interface FooterProps {
  settings: StoreSettings;
  onOpenPolicies: () => void;
  onOpenTracker: () => void;
  onOpenBrandStudio?: () => void;
  onOpenCaptainPortal?: () => void;
  isStoreOwner?: boolean;
}

export const Footer: React.FC<FooterProps> = ({ 
  settings, 
  onOpenPolicies, 
  onOpenTracker, 
  onOpenBrandStudio,
  onOpenCaptainPortal,
  isStoreOwner = false
}) => {
  const brand = settings.brandTheme || {
    primaryColor: '#0F172A',
    accentColor: '#2563EB',
    highlightColor: '#86EFAC',
    backgroundColor: '#F8FAFC',
    neutralColor: '#E2E8F0',
    textColor: '#0F172A',
  };

  const complianceType = getZatcaComplianceType(settings);

  const cleanWhatsapp = toWhatsAppNumber(settings.whatsappNumber);
  const displayPhone = settings.supportPhone || (cleanWhatsapp ? `+${cleanWhatsapp}` : '');

  const cleanInstagram = (settings.instagramHandle || '').trim().replace(/^@/, '');
  const cleanTiktok = (settings.tiktokHandle || '').trim().replace(/^@/, '');

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
              {settings.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt={settings.storeName}
                  className="w-10 h-10 rounded-xl object-contain p-1 border border-white/20 bg-white"
                />
              ) : (
                <div 
                  className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-base shadow-sm border border-white/20"
                  style={{ backgroundColor: brand.accentColor }}
                >
                  {settings.logoLetter || settings.storeName?.charAt(0) || 'S'}
                </div>
              )}
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">{settings.storeName}</h3>
                {settings.storeSubtitle && (
                  <p className="text-xs text-stone-300">{settings.storeSubtitle}</p>
                )}
              </div>
            </div>

            <p className="text-xs text-stone-300 max-w-sm leading-relaxed">
              {settings.tagline}
            </p>

            <div className="text-xs text-stone-300 pt-1 space-y-1.5">
              {displayPhone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-stone-400" />
                  <span dir="ltr">{displayPhone}</span>
                </div>
              )}
              {settings.supportEmail && (
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-stone-400" />
                  <span>{settings.supportEmail}</span>
                </div>
              )}
              {(cleanInstagram || cleanTiktok) && (
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  {cleanInstagram && (
                    <a
                      href={`https://instagram.com/${cleanInstagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-medium transition-colors"
                      dir="ltr"
                    >
                      Instagram: @{cleanInstagram}
                    </a>
                  )}
                  {cleanTiktok && (
                    <a
                      href={`https://tiktok.com/@${cleanTiktok}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-medium transition-colors"
                      dir="ltr"
                    >
                      TikTok: @{cleanTiktok}
                    </a>
                  )}
                </div>
              )}
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
              {onOpenCaptainPortal && (
                <li>
                  <button
                    onClick={onOpenCaptainPortal}
                    className="text-stone-300 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer text-emerald-300"
                  >
                    <span>انضم ككابتن توصيل</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-bold">
                      جديد 🚗
                    </span>
                  </button>
                </li>
              )}
              {isStoreOwner && onOpenBrandStudio && (
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
              {settings.websiteUrl && isValidSafeUrl(settings.websiteUrl) && (
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
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">خدمة العملاء</h4>
            <p className="text-xs text-stone-300">
              لأي استفسار أو متابعة خاصة لطلبك، يسعدنا تواصلك المباشر معنا:
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

        {/* Saudi E-Commerce Regulatory & Legal Disclosure Banner */}
        <div className="mt-8 pt-6 border-t border-white/10 text-xs text-stone-300 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 text-[11px]">
              {settings.commercialRegister && (
                <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1.5 rounded-lg">
                  <Building2 className="w-3.5 h-3.5 text-stone-300" />
                  <span>سجل تجاري: <strong className="font-mono">{settings.commercialRegister}</strong></span>
                </div>
              )}
              {settings.freelanceCertificate && (
                <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1.5 rounded-lg">
                  <FileCheck2 className="w-3.5 h-3.5 text-amber-300" />
                  <span>وثيقة عمل حر: <strong className="font-mono">{settings.freelanceCertificate}</strong></span>
                </div>
              )}
              {complianceType === 'non_registered' ? (
                <div className="flex items-center gap-1.5 bg-amber-500/20 text-amber-200 border border-amber-400/30 px-2.5 py-1.5 rounded-lg">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
                  <span>منشأة غير مسجلة في ضريبة القيمة المضافة (لا تضاف أي ضريبة)</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1.5 rounded-lg">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>الرقم الضريبي: <strong className="font-mono">{settings.vatNumber || '300000000000003'}</strong></span>
                  <span className="text-emerald-300 text-[10px] mr-1">(الأسعار شاملة ضريبة القيمة المضافة 15%)</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-stone-400 text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                <span>موثق بالمركز السعودي للأعمال (SBC)</span>
              </div>
            </div>

            {/* Payment Trust Badges */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-stone-400 ml-1">طرق الدفع المعتمدة:</span>
              <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-lg">
                <span className="text-[10px] font-bold text-white tracking-wide">مدى mada</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-lg">
                <span className="text-[10px] font-bold text-white tracking-wide">Apple Pay</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-lg">
                <span className="text-[10px] font-bold text-white tracking-wide">VISA</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-lg">
                <span className="text-[10px] font-bold text-white tracking-wide">Mastercard</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Credits */}
        <div className="mt-6 pt-4 border-t border-white/10 text-[11px] text-stone-400 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} {settings.storeName}. كافة الحقوق محفوظة.</p>
          <span className="text-stone-400/80">يعمل بواسطة منصة Quick E-Commerce</span>
        </div>
      </div>
    </footer>
  );
};
