import React, { useState } from 'react';
import {
  Globe,
  Link2,
  Save,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Sparkles,
  Loader2,
  Wand2,
  Search,
  MessageCircle,
  Upload,
  Trash2,
  CreditCard,
  ShieldCheck,
  ExternalLink,
  Bell,
  Radio,
  Volume2,
  Send,
  Truck,
  TrendingUp,
  Percent,
  Plus,
  HardDrive,
  FileJson,
  Download,
} from 'lucide-react';
import type { StorePolicy, StoreSettings, PromoCode } from '../../../types/store';
import { normalizeArabicDigits } from '../../../utils/digits';
import { SAUDI_CITIES_GEO } from '../../../utils/seoManager';
import { MerchantCaptainsDirectory } from '../../admin/MerchantCaptainsDirectory';

interface SettingsTabProps {
  editableSettings: StoreSettings;
  setEditableSettings: React.Dispatch<React.SetStateAction<StoreSettings>>;
  brand: {
    primaryColor: string;
    neutralColor: string;
    fontClass?: string;
  };
  storeSlug: string;
  customSlugInput: string;
  setCustomSlugInput: (val: string) => void;
  slugFeedback: { status: 'idle' | 'valid' | 'error'; message?: string };
  setSlugFeedback: React.Dispatch<React.SetStateAction<{ status: 'idle' | 'valid' | 'error'; message?: string }>>;
  isSavingSlug: boolean;
  onSaveCustomSlug: () => void;
  isAiOptimizingSeo: boolean;
  onAiOptimizeSeo: () => void;
  uploadingStoreLogo: boolean;
  onStoreLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  testSoundPlayed: boolean;
  onTestSound: () => void;
  desktopPermission: NotificationPermission;
  onRequestDesktopPermission: () => void;
  testTelegramLoading: boolean;
  testTelegramStatus: { type: 'success' | 'error'; message: string } | null;
  onTestTelegram: () => void;
  testWebhookLoading: boolean;
  testWebhookStatus: { type: 'success' | 'error'; message: string } | null;
  onTestWebhook: () => void;
  editablePolicies: StorePolicy[];
  setEditablePolicies: React.Dispatch<React.SetStateAction<StorePolicy[]>>;
  onSavePolicies: () => void;
  onSaveSettingsForm: (e: React.FormEvent) => void;
  onAddPromoCode: (code: string, type: 'percentage' | 'fixed', value: number) => void;
  onTogglePromoCode: (code: string) => void;
  onDeletePromoCode: (code: string) => void;
  onDownloadBackupJson?: () => void;
  onOpenRestoreBackupModal?: () => void;
  onExportCSV?: () => void;
  onOpenWhatsAppConnect?: () => void;
  isWhatsAppConnected?: boolean;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  editableSettings,
  setEditableSettings,
  brand,
  storeSlug,
  customSlugInput,
  setCustomSlugInput,
  slugFeedback,
  setSlugFeedback,
  isSavingSlug,
  onSaveCustomSlug,
  isAiOptimizingSeo,
  onAiOptimizeSeo,
  uploadingStoreLogo,
  onStoreLogoUpload,
  testSoundPlayed,
  onTestSound,
  desktopPermission,
  onRequestDesktopPermission,
  testTelegramLoading,
  testTelegramStatus,
  onTestTelegram,
  testWebhookLoading,
  testWebhookStatus,
  onTestWebhook,
  editablePolicies,
  setEditablePolicies,
  onSavePolicies,
  onSaveSettingsForm,
  onAddPromoCode,
  onTogglePromoCode,
  onDeletePromoCode,
  onDownloadBackupJson,
  onOpenRestoreBackupModal,
  onExportCSV,
  onOpenWhatsAppConnect,
  isWhatsAppConnected,
}) => {
  const [copiedDnsKey, setCopiedDnsKey] = useState<string | null>(null);
  const [previewModeTab, setPreviewModeTab] = useState<'google' | 'whatsapp'>('google');
  const [showMoyasarGuide, setShowMoyasarGuide] = useState(false);
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoType, setNewPromoType] = useState<'percentage' | 'fixed'>('percentage');
  const [newPromoValue, setNewPromoValue] = useState<number>(10);

  const handleCopyDns = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedDnsKey(key);
    setTimeout(() => setCopiedDnsKey(null), 2000);
  };

  const handleInternalAddPromo = () => {
    if (!newPromoCode.trim()) return;
    onAddPromoCode(newPromoCode.trim().toUpperCase(), newPromoType, newPromoValue);
    setNewPromoCode('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
      <div className="lg:col-span-2 space-y-6">
        {/* SECTION: LOCAL SERVER STORAGE & ONE-CLICK BACKUP / RESTORE */}
        {(onDownloadBackupJson || onOpenRestoreBackupModal || onExportCSV) && (
          <div className="bg-white p-6 rounded-3xl border border-stone-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-[#2563EB]" />
                  <span>التخزين المحلي والنسخ الاحتياطي للمتجر (Local Server Backup & Restore)</span>
                </h3>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  بيانات متجرك وصور منتجاتك محفوظة محلياً على السيرفر بدون قيود حجم المتصفح، مع إمكانية التصدير والاستعادة بضغطة زر
                </p>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 self-start sm:self-auto">
                حالة التخزين: محفوظ محلياً على السيرفر 🟢
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {onDownloadBackupJson && (
                <button
                  type="button"
                  onClick={onDownloadBackupJson}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
                >
                  <FileJson className="w-4 h-4 text-emerald-400" />
                  <span>تحميل نسخة احتياطية (JSON)</span>
                </button>
              )}

              {onOpenRestoreBackupModal && (
                <button
                  type="button"
                  onClick={onOpenRestoreBackupModal}
                  className="px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-[#2563EB] font-bold rounded-xl text-xs flex items-center gap-2 transition-colors cursor-pointer border border-blue-200"
                >
                  <Upload className="w-4 h-4" />
                  <span>استعادة نسخة احتياطية</span>
                </button>
              )}

              {onExportCSV && (
                <button
                  type="button"
                  onClick={onExportCSV}
                  className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl text-xs flex items-center gap-2 transition-colors cursor-pointer border border-emerald-200"
                >
                  <Download className="w-4 h-4" />
                  <span>تصدير CSV / Excel</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* SECTION: STORE URL & CUSTOM DOMAIN */}
        <div className="bg-white p-6 rounded-3xl border border-stone-200 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#2563EB]" />
                <span>رابط المتجر والنطاق المخصص (Custom Domain & URL)</span>
              </h3>
              <p className="text-[11px] text-stone-500 mt-0.5">
                خصص رابط متجرك الفريد أو اربط نطاقك ودومينك الخاص (مثل shop.mybrand.sa)
              </p>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 self-start sm:self-auto">
              شهادة SSL مجانية وتوجيه فوري
            </span>
          </div>

          {/* 1. Custom Store Slug */}
          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>معرف ورابط المتجر (Store Slug)</span>
              </label>
              <span className="text-[10px] text-stone-500 font-mono">حروف إنجليزية وأرقام وشرطات فقط</span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex-1 flex items-center bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-mono text-stone-500 focus-within:border-[#2563EB] focus-within:ring-2 focus-within:ring-blue-100" dir="ltr">
                <span className="text-stone-400 select-none">https://quick-ecommerce-saas-app.web.app/?store=</span>
                <input
                  type="text"
                  value={customSlugInput}
                  onChange={(e) => {
                    const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                    setCustomSlugInput(val);
                    setSlugFeedback({ status: 'idle' });
                  }}
                  placeholder="my-brand"
                  className="flex-1 bg-transparent border-0 outline-hidden text-stone-900 font-bold p-0 ml-0.5"
                />
              </div>
              <button
                type="button"
                onClick={onSaveCustomSlug}
                disabled={isSavingSlug || customSlugInput === storeSlug}
                className="px-4 py-2 bg-[#0F172A] hover:bg-stone-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {isSavingSlug ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>{isSavingSlug ? 'جاري الحفظ...' : 'تحديث الرابط'}</span>
              </button>
            </div>

            {slugFeedback.message && (
              <div
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${
                  slugFeedback.status === 'valid'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                {slugFeedback.status === 'valid' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                )}
                <span>{slugFeedback.message}</span>
              </div>
            )}
          </div>

          {/* 2. Custom Domain Input */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                النطاق الخاص بالمتجر (Custom Domain)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editableSettings.customDomain || ''}
                  onChange={(e) =>
                    setEditableSettings({
                      ...editableSettings,
                      customDomain: e.target.value.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/$/, ''),
                    })
                  }
                  placeholder="shop.mybrand.sa أو store.com"
                  className="flex-1 px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono"
                  dir="ltr"
                />
              </div>
              <p className="text-[11px] text-stone-500 mt-1">
                اكتب نطاقك الخاص وسيتم توجيه عملائك مباشرة لواجهة متجرك مع شهادة أمان SSL تلقائية.
              </p>
            </div>

            {/* DNS Records Guide */}
            {editableSettings.customDomain && (
              <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-100 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-950 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>إعدادات سجلات الـ DNS المطلوبة في مزود نطاقك:</span>
                  </span>
                  <span className="text-[10px] text-blue-700 bg-white px-2 py-0.5 rounded-full border border-blue-200">
                    Cloudflare / GoDaddy / منصات النطاقات
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* CNAME Record */}
                  <div className="p-3 bg-white rounded-xl border border-blue-100 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-stone-800">1. سجل فرعي (CNAME Record)</span>
                      <span className="text-blue-600 font-mono font-bold">للنطاقات مثل shop.xxx</span>
                    </div>
                    <div className="space-y-1 font-mono text-[11px]">
                      <div className="flex items-center justify-between text-stone-600 bg-stone-50 px-2 py-1 rounded-md">
                        <span>الاسم (Host): <b>{editableSettings.customDomain.includes('.') ? editableSettings.customDomain.split('.')[0] : 'shop'}</b></span>
                        <button
                          type="button"
                          onClick={() => handleCopyDns('cname_host', editableSettings.customDomain?.split('.')[0] || 'shop')}
                          className="text-blue-600 hover:text-blue-800 cursor-pointer"
                        >
                          {copiedDnsKey === 'cname_host' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-stone-600 bg-stone-50 px-2 py-1 rounded-md">
                        <span>الهدف (Target): <b>quick-ecommerce-saas-app.web.app</b></span>
                        <button
                          type="button"
                          onClick={() => handleCopyDns('cname_val', 'quick-ecommerce-saas-app.web.app')}
                          className="text-blue-600 hover:text-blue-800 cursor-pointer"
                        >
                          {copiedDnsKey === 'cname_val' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* A Record */}
                  <div className="p-3 bg-white rounded-xl border border-blue-100 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-stone-800">2. سجل رئيسي (A Record)</span>
                      <span className="text-blue-600 font-mono font-bold">للنطاق المباشر @</span>
                    </div>
                    <div className="space-y-1 font-mono text-[11px]">
                      <div className="flex items-center justify-between text-stone-600 bg-stone-50 px-2 py-1 rounded-md">
                        <span>الاسم (Host): <b>@</b></span>
                        <button
                          type="button"
                          onClick={() => handleCopyDns('a_host', '@')}
                          className="text-blue-600 hover:text-blue-800 cursor-pointer"
                        >
                          {copiedDnsKey === 'a_host' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-stone-600 bg-stone-50 px-2 py-1 rounded-md">
                        <span>عنوان الآي بي (IP): <b>199.36.158.100</b></span>
                        <button
                          type="button"
                          onClick={() => handleCopyDns('a_val', '199.36.158.100')}
                          className="text-blue-600 hover:text-blue-800 cursor-pointer"
                        >
                          {copiedDnsKey === 'a_val' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SECTION: SEO, SAUDI GEO & SOCIAL EXPOSURE HUB */}
        <div className="bg-white p-6 rounded-3xl border border-stone-200 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#F59E0B]" />
                <span>تحسين محركات البحث والظهور الجغرافي (SEO & Saudi GEO Exposure)</span>
              </h3>
              <p className="text-[11px] text-stone-500 mt-0.5">
                ارفع تصدر متجرك في نتائج قوقل المحلية بالسعودية وتخصيص بطاقات المشاركة على واتساب ومواقع التواصل.
              </p>
            </div>

            <button
              type="button"
              onClick={onAiOptimizeSeo}
              disabled={isAiOptimizingSeo}
              className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer self-start sm:self-auto"
            >
              {isAiOptimizingSeo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5 text-amber-300" />}
              <span>{isAiOptimizingSeo ? 'جاري التحسين الذكي...' : 'تحسين ذكي بالذكاء الاصطناعي'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Meta Title */}
            <div className="sm:col-span-2 space-y-1">
              <div className="flex items-center justify-between">
                <label className="font-bold text-stone-700">عنوان الصفحة في قوقل (Meta Title)</label>
                <span className={`text-[10px] font-mono ${(editableSettings.metaTitle?.length || 0) > 60 ? 'text-rose-500 font-bold' : 'text-stone-400'}`}>
                  {editableSettings.metaTitle?.length || 0} / 60 حرف (الموصى به: 50-60)
                </span>
              </div>
              <input
                type="text"
                value={editableSettings.metaTitle || ''}
                onChange={(e) => setEditableSettings({ ...editableSettings, metaTitle: e.target.value })}
                placeholder={`${editableSettings.storeName} | تسوق أفضل المنتجات مع شحن فوري في السعودية`}
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl"
              />
            </div>

            {/* Meta Description */}
            <div className="sm:col-span-2 space-y-1">
              <div className="flex items-center justify-between">
                <label className="font-bold text-stone-700">وصف المتجر في نتائج البحث (Meta Description)</label>
                <span className={`text-[10px] font-mono ${(editableSettings.metaDescription?.length || 0) > 160 ? 'text-rose-500 font-bold' : 'text-stone-400'}`}>
                  {editableSettings.metaDescription?.length || 0} / 160 حرف (الموصى به: 120-160)
                </span>
              </div>
              <textarea
                rows={3}
                value={editableSettings.metaDescription || ''}
                onChange={(e) => setEditableSettings({ ...editableSettings, metaDescription: e.target.value })}
                placeholder="وصف مشوق يظهر تحت عنوان متجرك في قوقل وواتساب يشجع المتسوقين على الضغط والشراء..."
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl resize-none"
              />
            </div>

            {/* Target City for Local GEO */}
            <div className="space-y-1">
              <label className="block font-bold text-stone-700">المدينة المستهدفة (Saudi GEO Location)</label>
              <select
                value={editableSettings.geoCity || 'الرياض'}
                onChange={(e) => setEditableSettings({ ...editableSettings, geoCity: e.target.value })}
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-800"
              >
                {Object.keys(SAUDI_CITIES_GEO).map((c) => (
                  <option key={c} value={c}>
                    {c} ({SAUDI_CITIES_GEO[c].cityEn})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-stone-400">
                يتم توليد وسوم الإحداثيات الجغرافية (ICBM & Schema.org) آلياً لمحركات البحث.
              </p>
            </div>

            {/* SEO Keywords */}
            <div className="space-y-1">
              <label className="block font-bold text-stone-700">الكلمات المفتاحية (مفصولة بفاصلة)</label>
              <input
                type="text"
                value={Array.isArray(editableSettings.metaKeywords) ? editableSettings.metaKeywords.join(', ') : ''}
                onChange={(e) =>
                  setEditableSettings({
                    ...editableSettings,
                    metaKeywords: e.target.value
                      .split(',')
                      .map((k) => k.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="متجر عطور, تسوق أونلاين الرياض, الدفع عند الاستلام"
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl"
              />
              <p className="text-[10px] text-stone-400">تساعد أدوات الذكاء الاصطناعي على فهرسة منتجاتك.</p>
            </div>
          </div>

          {/* LIVE PREVIEWS TABS (Google vs WhatsApp) */}
          <div className="mt-4 pt-4 border-t border-stone-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-800">المعاينة المباشرة للظهور:</span>
              <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setPreviewModeTab('google')}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                    previewModeTab === 'google' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500'
                  }`}
                >
                  <Search className="w-3 h-3 text-[#2563EB]" />
                  <span>بحث قوقل</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewModeTab('whatsapp')}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                    previewModeTab === 'whatsapp' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500'
                  }`}
                >
                  <MessageCircle className="w-3 h-3 text-emerald-600" />
                  <span>بطاقة واتساب</span>
                </button>
              </div>
            </div>

            {previewModeTab === 'google' ? (
              <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-xs space-y-1.5 text-right font-sans" dir="rtl">
                <div className="flex items-center gap-2 text-xs text-stone-600">
                  <div className="w-5 h-5 rounded-full bg-stone-100 flex items-center justify-center text-[10px] font-bold text-stone-700">
                    {editableSettings.logoLetter || 'S'}
                  </div>
                  <div className="flex flex-col text-[11px] leading-tight font-sans">
                    <span className="font-bold text-stone-900">{editableSettings.storeName}</span>
                    <span className="text-stone-400 font-mono text-[10px]" dir="ltr">
                      {editableSettings.customDomain
                        ? `https://${editableSettings.customDomain}`
                        : `https://quick-ecommerce-saas-app.web.app › s › ${customSlugInput}`}
                    </span>
                  </div>
                </div>
                <div className="text-base text-[#1a0dab] hover:underline font-medium cursor-pointer line-clamp-1">
                  {editableSettings.metaTitle || `${editableSettings.storeName} | المتجر الرسمي في ${editableSettings.geoCity || 'السعودية'}`}
                </div>
                <p className="text-xs text-[#4d5156] line-clamp-2 leading-relaxed">
                  {editableSettings.metaDescription ||
                    `${editableSettings.storeName}: ${editableSettings.tagline || 'تسوق أفضل المنتجات مع شحن فوري لكافة مدن المملكة ودفع آمن عند الاستلام أو ببطاقات مدى وأبل باي.'}`}
                </p>
              </div>
            ) : (
              <div className="p-4 bg-stone-100 rounded-2xl border border-stone-200 max-w-md">
                <div className="bg-[#DCF8C6]/70 p-3 rounded-2xl shadow-xs space-y-2 border border-emerald-200/40">
                  {editableSettings.logoUrl && (
                    <div className="w-full h-32 rounded-xl overflow-hidden bg-white flex items-center justify-center border border-stone-200">
                      <img src={editableSettings.logoUrl} alt="Preview" className="w-full h-full object-contain p-2" />
                    </div>
                  )}
                  <div className="space-y-1 text-right" dir="rtl">
                    <h4 className="font-bold text-stone-900 text-xs">
                      {editableSettings.metaTitle || editableSettings.storeName}
                    </h4>
                    <p className="text-[11px] text-stone-600 line-clamp-2 leading-snug">
                      {editableSettings.metaDescription || editableSettings.tagline}
                    </p>
                    <span className="text-[10px] text-stone-400 font-mono block pt-0.5" dir="ltr">
                      {editableSettings.customDomain || 'quick-ecommerce-saas-app.web.app'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={onSaveSettingsForm} className="space-y-6">
          {/* Basic Info & Logo */}
          <div className="bg-white p-6 rounded-3xl border border-stone-200 space-y-4">
            <h3 className="text-sm font-bold text-stone-900 border-b border-stone-100 pb-2">
              بيانات المتجر، الشعار، والتواصل
            </h3>

            {/* Logo Upload Bar */}
            <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-base text-white shadow-xs overflow-hidden shrink-0 border border-stone-200"
                  style={{ backgroundColor: editableSettings.logoUrl ? '#FFFFFF' : brand.primaryColor }}
                >
                  {editableSettings.logoUrl ? (
                    <img src={editableSettings.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                  ) : (
                    <span>{editableSettings.logoLetter || 'S'}</span>
                  )}
                </div>
                <div>
                  <div className="font-bold text-stone-800">شعار المتجر (Logo)</div>
                  <p className="text-[11px] text-stone-500">ارفع صورة شعار متجرك من جوالك أو حاسوبك</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="px-3 py-2 bg-white hover:bg-stone-100 border border-stone-200 rounded-xl font-bold text-stone-700 flex items-center gap-1.5 cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>{uploadingStoreLogo ? 'جاري الضغط...' : 'رفع صورة الشعار'}</span>
                  <input type="file" accept="image/*" onChange={onStoreLogoUpload} className="hidden" />
                </label>
                {editableSettings.logoUrl && (
                  <button
                    type="button"
                    onClick={() => setEditableSettings({ ...editableSettings, logoUrl: '' })}
                    className="p-2 bg-red-50 text-red-600 rounded-xl cursor-pointer"
                    title="إزالة الشعار"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-stone-700 mb-1">اسم المتجر</label>
                <input
                  type="text"
                  required
                  value={editableSettings.storeName}
                  onChange={(e) => setEditableSettings({ ...editableSettings, storeName: e.target.value })}
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">العملة</label>
                <input
                  type="text"
                  value={editableSettings.currency}
                  onChange={(e) => setEditableSettings({ ...editableSettings, currency: e.target.value })}
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-stone-700">رقم الواتساب لاستقبال الطلبات (دولي بدون +)</label>
                  {onOpenWhatsAppConnect && (
                    <button
                      type="button"
                      onClick={onOpenWhatsAppConnect}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
                        isWhatsAppConnected
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                      }`}
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{isWhatsAppConnected ? 'واتساب متصل بالخلفية 🟢' : 'ربط واتساب المتجر (QR) ⚡'}</span>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={editableSettings.whatsappNumber}
                  onChange={(e) => setEditableSettings({ ...editableSettings, whatsappNumber: normalizeArabicDigits(e.target.value) })}
                  placeholder="9665XXXXXXXX"
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">البريد الإلكتروني لخدمة العملاء</label>
                <input
                  type="email"
                  value={editableSettings.supportEmail}
                  onChange={(e) => setEditableSettings({ ...editableSettings, supportEmail: e.target.value })}
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">حساب انستقرام (اختياري)</label>
                <input
                  type="text"
                  value={editableSettings.instagramHandle || ''}
                  onChange={(e) => setEditableSettings({ ...editableSettings, instagramHandle: e.target.value })}
                  placeholder="@yourstore"
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">حساب تيك توك (اختياري)</label>
                <input
                  type="text"
                  value={editableSettings.tiktokHandle || ''}
                  onChange={(e) => setEditableSettings({ ...editableSettings, tiktokHandle: e.target.value })}
                  placeholder="@yourstore"
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-mono"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-stone-700 mb-1">عنوان البانر الترحيبي (Hero Title)</label>
                <input
                  type="text"
                  value={editableSettings.heroTitle || ''}
                  onChange={(e) => setEditableSettings({ ...editableSettings, heroTitle: e.target.value })}
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">مدة التوصيل المتوقعة</label>
                <input
                  type="text"
                  value={editableSettings.deliveryEstimationDays || ''}
                  onChange={(e) => setEditableSettings({ ...editableSettings, deliveryEstimationDays: e.target.value })}
                  placeholder="1 إلى 3 أيام عمل"
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl"
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="block font-bold text-stone-700 mb-1">وصف المتجر (Tagline)</label>
              <input
                type="text"
                value={editableSettings.tagline}
                onChange={(e) => setEditableSettings({ ...editableSettings, tagline: e.target.value })}
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl"
              />
            </div>

            <div className="text-xs">
              <label className="block font-bold text-stone-700 mb-1">شريط الإعلانات العلوي</label>
              <input
                type="text"
                value={editableSettings.announcementText}
                onChange={(e) => setEditableSettings({ ...editableSettings, announcementText: e.target.value })}
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl"
              />
            </div>
          </div>

          {/* Shipping & Bank Transfer */}
          <div className="bg-white p-6 rounded-3xl border border-stone-200 space-y-4">
            <h3 className="text-sm font-bold text-stone-900 border-b border-stone-100 pb-2">
              إعدادات الشحن والتحويل البنكي
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  رسوم الشحن العادية ({editableSettings.currency})
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  value={editableSettings.standardShippingRate}
                  onChange={(e) => {
                    const norm = normalizeArabicDigits(e.target.value);
                    setEditableSettings({
                      ...editableSettings,
                      standardShippingRate: norm === '' ? 0 : Number(norm),
                    });
                  }}
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  الحد الأدنى للشحن المجاني ({editableSettings.currency})
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  value={editableSettings.freeShippingThreshold}
                  onChange={(e) => {
                    const norm = normalizeArabicDigits(e.target.value);
                    setEditableSettings({
                      ...editableSettings,
                      freeShippingThreshold: norm === '' ? 0 : Number(norm),
                    });
                  }}
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-mono"
                />
              </div>

              {/* Payment Methods Visibility Toggles */}
              <div className="sm:col-span-2 pt-3 border-t border-stone-100 space-y-3">
                <div>
                  <label className="block font-bold text-stone-900 text-xs sm:text-sm">
                    تفعيل وتخصيص وسائل الدفع المتاحة للعملاء في المتجر
                  </label>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    اختر وسائل الدفع التي ترغب بإظهارها للمتسوقين في صفحة إتمام الطلب (يجب تفعيل وسيلة واحدة على الأقل)
                  </p>
                </div>

                {(() => {
                  const currentMethods = Array.isArray(editableSettings.paymentMethods)
                    ? editableSettings.paymentMethods
                    : [
                        'الدفع عند الاستلام (Cash on Delivery)',
                        'تحويل بنكي فوري (Bank Transfer)',
                        'بطاقات مدى / فيزا / Apple Pay',
                      ];

                  const hasCod = currentMethods.some(
                    (m) => m.includes('الاستلام') || m.toLowerCase().includes('cod') || m.toLowerCase().includes('cash')
                  );
                  const hasBank = currentMethods.some(
                    (m) => m.includes('بنكي') || m.includes('تحويل') || m.toLowerCase().includes('bank')
                  );
                  const hasCard = currentMethods.some(
                    (m) =>
                      m.includes('مدى') ||
                      m.includes('بطاق') ||
                      m.toLowerCase().includes('card') ||
                      m.toLowerCase().includes('apple')
                  );

                  const togglePaymentOption = (
                    type: 'cod' | 'bank' | 'card',
                    canonicalLabel: string,
                    checked: boolean
                  ) => {
                    const filtered = currentMethods.filter((m) => {
                      if (type === 'cod') {
                        return !(m.includes('الاستلام') || m.toLowerCase().includes('cod') || m.toLowerCase().includes('cash'));
                      }
                      if (type === 'bank') {
                        return !(m.includes('بنكي') || m.includes('تحويل') || m.toLowerCase().includes('bank'));
                      }
                      return !(
                        m.includes('مدى') ||
                        m.includes('بطاق') ||
                        m.toLowerCase().includes('card') ||
                        m.toLowerCase().includes('apple')
                      );
                    });

                    const nextMethods = checked ? [...filtered, canonicalLabel] : filtered;
                    if (nextMethods.length === 0) {
                      return; // Keep at least one payment method enabled
                    }

                    setEditableSettings({
                      ...editableSettings,
                      paymentMethods: nextMethods,
                      ...(type === 'card' ? { enableOnlinePayments: checked } : {}),
                    });
                  };

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {/* 1. Cash on Delivery */}
                      <label
                        className={`flex items-start justify-between gap-2 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                          hasCod
                            ? 'bg-emerald-50/60 border-emerald-300 text-stone-900'
                            : 'bg-stone-50 border-stone-200 text-stone-500'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <span className="font-bold text-xs block">💵 الدفع عند الاستلام</span>
                          <span className="text-[10px] text-stone-500 block leading-relaxed">
                            يدفع العميل نقداً أو بالشبكة للمندوب عند استلام الطلب
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={hasCod}
                          onChange={(e) =>
                            togglePaymentOption(
                              'cod',
                              'الدفع عند الاستلام (Cash on Delivery)',
                              e.target.checked
                            )
                          }
                          className="w-4 h-4 rounded text-emerald-600 cursor-pointer mt-0.5 shrink-0"
                        />
                      </label>

                      {/* 2. Bank Transfer with Mandatory Receipt */}
                      <label
                        className={`flex items-start justify-between gap-2 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                          hasBank
                            ? 'bg-emerald-50/60 border-emerald-300 text-stone-900'
                            : 'bg-stone-50 border-stone-200 text-stone-500'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <span className="font-bold text-xs block">🏦 التحويل البنكي (مع إيصال)</span>
                          <span className="text-[10px] text-stone-500 block leading-relaxed">
                            يحول العميل لحسابك البنكي ويلتزم بإرفاق الإيصال للمراجعة والاعتماد
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={hasBank}
                          onChange={(e) =>
                            togglePaymentOption(
                              'bank',
                              'تحويل بنكي فوري (Bank Transfer)',
                              e.target.checked
                            )
                          }
                          className="w-4 h-4 rounded text-emerald-600 cursor-pointer mt-0.5 shrink-0"
                        />
                      </label>

                      {/* 3. Electronic Cards / Apple Pay */}
                      <label
                        className={`flex items-start justify-between gap-2 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                          hasCard
                            ? 'bg-emerald-50/60 border-emerald-300 text-stone-900'
                            : 'bg-stone-50 border-stone-200 text-stone-500'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <span className="font-bold text-xs block">💳 مدى / فيزا / Apple Pay</span>
                          <span className="text-[10px] text-stone-500 block leading-relaxed">
                            دفع إلكتروني فوري عبر بوابة الدفع المعتمدة
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={hasCard}
                          onChange={(e) =>
                            togglePaymentOption(
                              'card',
                              'بطاقات مدى / فيزا / Apple Pay',
                              e.target.checked
                            )
                          }
                          className="w-4 h-4 rounded text-emerald-600 cursor-pointer mt-0.5 shrink-0"
                        />
                      </label>
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">اسم البنك (للتحويل البنكي)</label>
                <input
                  type="text"
                  value={editableSettings.bankDetails?.bankName || ''}
                  onChange={(e) =>
                    setEditableSettings({
                      ...editableSettings,
                      bankDetails: {
                        ...editableSettings.bankDetails,
                        bankName: e.target.value,
                      },
                    })
                  }
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">اسم صاحب الحساب / المؤسسة</label>
                <input
                  type="text"
                  value={editableSettings.bankDetails?.accountHolder || ''}
                  onChange={(e) =>
                    setEditableSettings({
                      ...editableSettings,
                      bankDetails: {
                        ...editableSettings.bankDetails,
                        accountHolder: e.target.value,
                      },
                    })
                  }
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-stone-700 mb-1">رقم الآيبان (IBAN)</label>
                <input
                  type="text"
                  value={editableSettings.bankDetails?.iban || ''}
                  onChange={(e) =>
                    setEditableSettings({
                      ...editableSettings,
                      bankDetails: {
                        ...editableSettings.bankDetails,
                        iban: e.target.value,
                      },
                    })
                  }
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-mono"
                  dir="ltr"
                />
              </div>

              {/* Anti-Cancellation COD City Restriction */}
              <div className="sm:col-span-2 pt-2 border-t border-stone-100">
                <label className="flex items-start justify-between p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200 cursor-pointer">
                  <div className="space-y-0.5">
                    <span className="font-bold text-stone-900 flex items-center gap-1.5">
                      <span>حصر الدفع عند الاستلام (COD) داخل مدينة المتجر فقط</span>
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[10px] font-bold">
                        تجنب خسائر الشحن والإلغاء
                      </span>
                    </span>
                    <span className="text-stone-500 text-[11px] leading-relaxed block">
                      عند تفعيل هذا الخيار، سيتم إخفاء وسيلة "الدفع عند الاستلام" تلقائياً لأي عميل يطلب من خارج مدينة متجرك ({editableSettings.city || 'العلا / الرياض'}) وإلزامه بالدفع الإلكتروني أو التحويل البنكي لضمان جدية الشحنة وعدم إلغائها بعد الإرسال.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(editableSettings.restrictCodToStoreCity)}
                    onChange={(e) =>
                      setEditableSettings({
                        ...editableSettings,
                        restrictCodToStoreCity: e.target.checked,
                      })
                    }
                    className="w-5 h-5 rounded text-amber-600 cursor-pointer mt-1"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Moyasar Payment Gateway Settings */}
          <div className="bg-white p-6 rounded-3xl border border-stone-200 space-y-4">
            <div className="border-b border-stone-100 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  <span>بوابة الدفع الإلكتروني مويسر (Moyasar Gateway)</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  قبول بطاقات مدى (mada)، Apple Pay، Visa، و Mastercard مع توثيق الحماية المصرفية الثلاثية (3D Secure)
                </p>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>معتمد من البنك المركزي السعودي (SAMA)</span>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              {/* Enable Online Payments Toggle */}
              <label className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 border border-stone-200 cursor-pointer">
                <div>
                  <span className="font-bold text-stone-900 block">تفعيل الدفع الإلكتروني بالبطاقات و Apple Pay</span>
                  <span className="text-stone-500 text-[11px]">إتاحة خيار الدفع الإلكتروني لعملائك في صفحة إنهاء الطلب</span>
                </div>
                <input
                  type="checkbox"
                  checked={editableSettings.enableOnlinePayments !== false}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    const currentMethods = Array.isArray(editableSettings.paymentMethods)
                      ? editableSettings.paymentMethods
                      : [
                          'الدفع عند الاستلام (Cash on Delivery)',
                          'تحويل بنكي فوري (Bank Transfer)',
                          'بطاقات مدى / فيزا / Apple Pay',
                        ];
                    const withoutCard = currentMethods.filter(
                      (m) =>
                        !(
                          m.includes('مدى') ||
                          m.includes('بطاق') ||
                          m.toLowerCase().includes('card') ||
                          m.toLowerCase().includes('apple')
                        )
                    );
                    const nextMethods = checked
                      ? [...withoutCard, 'بطاقات مدى / فيزا / Apple Pay']
                      : withoutCard.length > 0
                      ? withoutCard
                      : ['الدفع عند الاستلام (Cash on Delivery)'];
                    setEditableSettings({
                      ...editableSettings,
                      enableOnlinePayments: checked,
                      paymentMethods: nextMethods,
                    });
                  }}
                  className="w-5 h-5 rounded text-emerald-600 cursor-pointer"
                />
              </label>

              {/* 1-Click Instant Sandbox Quick Action */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="font-bold text-blue-950 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span>تفعيل الدفع التجريبي الفوري بنقرة واحدة (بدون الحاجة لمفتاح خاص)</span>
                  </span>
                  <p className="text-blue-800 text-[11px] leading-relaxed">
                    إذا لم تكن تملك حساب ميسر بعد أو ترغب في تجربة الشراء ببطاقات مدى و Apple Pay الوهمية، اضغط الزر للتفعيل الفوري.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditableSettings({
                      ...editableSettings,
                      enableOnlinePayments: true,
                      moyasarTestMode: true,
                      moyasarPublishableKey: 'pk_test_vcFUAGwCU4x8MrjiqqnUS4Vjy3AnFsXZoEi2qTyg',
                    });
                    alert('تم تفعيل وضع الدفع التجريبي الفوري بنجاح! يمكنك الآن تجربة الشراء ببطاقات مدى و Apple Pay الوهمية.');
                  }}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shrink-0 cursor-pointer shadow-xs transition-colors"
                >
                  تفعيل التجربة بنقرة واحدة ⚡
                </button>
              </div>

              {/* Step-by-Step Onboarding Guide Toggle */}
              <div className="border border-stone-200 rounded-2xl p-3.5 bg-stone-50 space-y-2">
                <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowMoyasarGuide(!showMoyasarGuide)}>
                  <span className="font-bold text-stone-800 flex items-center gap-1.5">
                    <span>💡 كيف أحصل على مفتاح النشر من ميسر لتحصيل أموالي الحقيقية؟</span>
                  </span>
                  <span className="text-xs text-blue-600 font-bold hover:underline">
                    {showMoyasarGuide ? 'إخفاء الدليل ▲' : 'عرض الخطوات بالصور ▼'}
                  </span>
                </div>

                {showMoyasarGuide && (
                  <div className="pt-2 border-t border-stone-200 text-stone-700 space-y-2 text-[11px] leading-relaxed">
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0">1</span>
                      <span>
                        قم بتسجيل الدخول إلى حسابك في ميسر عبر الرابط الرسمي:{' '}
                        <a
                          href="https://dashboard.moyasar.com"
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 font-bold underline inline-flex items-center gap-0.5"
                        >
                          <span>لوحة تحكم ميسر (dashboard.moyasar.com)</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0">2</span>
                      <span>من القائمة الجانبية، اضغط على <strong>الإعدادات (Settings)</strong> ثم اختر <strong>مفاتيح API (API Keys)</strong>.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0">3</span>
                      <span>
                        انسخ <strong>مفتاح النشر العام (Publishable Key)</strong> الذي يبدأ بـ <code className="bg-stone-200 px-1 py-0.5 rounded font-mono text-stone-900" dir="ltr">pk_live_...</code> والصقه في الحقل أدناه (تجنب لصق المفتاح السري sk_).
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Publishable API Key */}
              <div className="grid grid-cols-1 gap-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-stone-700">
                      مفتاح النشر العام (Moyasar Publishable API Key)
                    </label>
                    {editableSettings.moyasarPublishableKey?.startsWith('pk_live_') && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>مفتاح إنتاج حي معتمد (Live Account)</span>
                      </span>
                    )}
                    {editableSettings.moyasarPublishableKey?.startsWith('pk_test_') && (
                      <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[10px] font-bold">
                        مفتاح تجريبي معتمد (Sandbox Test)
                      </span>
                    )}
                  </div>

                  <input
                    type="text"
                    placeholder="pk_live_... أو pk_test_..."
                    value={editableSettings.moyasarPublishableKey || ''}
                    onChange={(e) => {
                      const val = e.target.value.trim().replace(/['"؛;]/g, '');
                      setEditableSettings({
                        ...editableSettings,
                        moyasarPublishableKey: val,
                        moyasarTestMode: val.startsWith('pk_test_') ? true : val.startsWith('pk_live_') ? false : editableSettings.moyasarTestMode,
                      });
                    }}
                    className={`w-full px-3 py-2.5 bg-stone-50 border rounded-xl font-mono text-xs focus:outline-none ${
                      editableSettings.moyasarPublishableKey?.startsWith('sk_')
                        ? 'border-red-400 bg-red-50 text-red-900'
                        : 'border-stone-200 text-stone-900'
                    }`}
                    dir="ltr"
                  />

                  {/* Security Alert if Secret Key pasted */}
                  {editableSettings.moyasarPublishableKey?.startsWith('sk_') && (
                    <div className="p-2.5 mt-1.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-[11px] flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>
                        <strong>تنبيه أمني:</strong> لقد قمت بلصق المفتاح السري (Secret Key)! يرجى نسخ مفتاح النشر العام (Publishable Key) الذي يبدأ بـ <code>pk_</code> لحماية حسابك البنكي.
                      </span>
                    </div>
                  )}

                  <p className="text-[11px] text-stone-400 mt-1">
                    لا تشارك مفتاحك السري (sk_live) أبداً. مفتاح النشر العام (pk_live) هو المصرح به لمعالجة عمليات الدفع الآمنة من متصفح العميل.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Real-time Order Notifications Hub */}
          <div className="bg-white p-6 rounded-3xl border border-stone-200 space-y-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <span className="p-1.5 rounded-xl bg-amber-500/10 text-amber-600">
                    <Bell className="w-4 h-4" />
                  </span>
                  <span>مركز التنبيهات وإشعارات الطلبات الفورية (Order Notification Hub)</span>
                </h3>
                <p className="text-xs text-stone-500 mt-1">
                  استقبل تنبيهات مباشرة ولحظية لمتجرك فور إتمام العميل للطلب — حتى لو أغلق المتصفح أو لم يرسل رسالة واتساب
                </p>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold shrink-0 self-start sm:self-auto">
                <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
                <span>تنبيه آلي مباشر</span>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              {/* Channel 1: Audio Chime */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600 shrink-0 mt-0.5">
                    <Volume2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-stone-900 block text-xs">
                      رنين التنبيه الصوتي الذكي (Synthesized Audio Chime)
                    </span>
                    <span className="text-stone-500 text-[11px] block mt-0.5">
                      تشغيل جرس موسيقي نقي وفوري في جهازك عند تسجيل أي طلب جديد بدون الحاجة لملفات خارجية
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={onTestSound}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                      testSoundPlayed
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>{testSoundPlayed ? 'تم الرنين ✓' : 'تجربة النغمة'}</span>
                  </button>
                  <input
                    type="checkbox"
                    checked={editableSettings.enableAudioNotifications !== false}
                    onChange={(e) =>
                      setEditableSettings({
                        ...editableSettings,
                        enableAudioNotifications: e.target.checked,
                      })
                    }
                    className="w-5 h-5 rounded text-blue-600 cursor-pointer"
                  />
                </div>
              </div>

              {/* Channel 2: Push Notifications */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-purple-50 text-purple-600 shrink-0 mt-0.5">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-900 text-xs">
                        إشعارات سطح المكتب والنظام (Browser / Desktop Notifications)
                      </span>
                      {desktopPermission === 'granted' ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          مسموح به ✓
                        </span>
                      ) : desktopPermission === 'denied' ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                          محظور من المتصفح
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                          يحتاج إذن
                        </span>
                      )}
                    </div>
                    <span className="text-stone-500 text-[11px] block mt-0.5">
                      إظهار إشعار فوري على شاشة جهازك المحمول أو الكمبيوتر يتضمن اسم العميل وقيمة الطلب
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {desktopPermission !== 'granted' && (
                    <button
                      type="button"
                      onClick={onRequestDesktopPermission}
                      className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-all cursor-pointer"
                    >
                      تفعيل إذن المتصفح
                    </button>
                  )}
                  <input
                    type="checkbox"
                    checked={editableSettings.enableDesktopNotifications !== false}
                    onChange={(e) =>
                      setEditableSettings({
                        ...editableSettings,
                        enableDesktopNotifications: e.target.checked,
                      })
                    }
                    className="w-5 h-5 rounded text-purple-600 cursor-pointer"
                  />
                </div>
              </div>

              {/* Channel 3: Telegram Bot */}
              <div className="p-4 rounded-2xl bg-sky-50/50 border border-sky-100 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <div className="p-1.5 rounded-xl bg-sky-500 text-white shrink-0 mt-0.5">
                      <Send className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="font-bold text-stone-900 block text-xs">
                        تنبيهات تليجرام الفورية (Telegram Bot Integration)
                      </span>
                      <span className="text-stone-500 text-[11px] block">
                        تصلك تفاصيل كل فاتورة وعنوان العميل والمنتجات برسالة تليجرام أنيقة لحظياً
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={testTelegramLoading}
                    onClick={onTestTelegram}
                    className="self-end sm:self-auto px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {testTelegramLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>{testTelegramLoading ? 'جارِ الإرسال...' : 'إرسال إشعار تجريبي'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      توكن البوت (Telegram Bot Token)
                    </label>
                    <input
                      type="text"
                      value={editableSettings.telegramBotToken || ''}
                      onChange={(e) =>
                        setEditableSettings({
                          ...editableSettings,
                          telegramBotToken: e.target.value.trim(),
                        })
                      }
                      placeholder="مثال: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                      className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl font-mono text-xs"
                      dir="ltr"
                    />
                    <span className="text-[10px] text-stone-400 mt-1 block">
                      أنشئ بوتاً في دقيقة عبر مراسلة @BotFather على تليجرام
                    </span>
                  </div>
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      معرّف المحادثة (Telegram Chat ID)
                    </label>
                    <input
                      type="text"
                      value={editableSettings.telegramChatId || ''}
                      onChange={(e) =>
                        setEditableSettings({
                          ...editableSettings,
                          telegramChatId: e.target.value.trim(),
                        })
                      }
                      placeholder="مثال: 987654321 أو -100123456789"
                      className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl font-mono text-xs"
                      dir="ltr"
                    />
                    <span className="text-[10px] text-stone-400 mt-1 block">
                      احصل على رقمك أو رقم قروب المتجر من بوت @userinfobot
                    </span>
                  </div>
                </div>

                {testTelegramStatus && (
                  <div
                    className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                      testTelegramStatus.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {testTelegramStatus.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{testTelegramStatus.message}</span>
                  </div>
                )}
              </div>

              {/* Channel 4: Automated Webhook */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <div className="p-1.5 rounded-xl bg-stone-700 text-white shrink-0 mt-0.5">
                      <Link2 className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="font-bold text-stone-900 block text-xs">
                        رابط الويب هوك التلقائي (Webhook / Discord / Make / Zapier)
                      </span>
                      <span className="text-stone-500 text-[11px] block">
                        إرسال حمولة JSON كاملة عن كل طلب جديد لسيرفرك الخاص أو قناة Discord أو شيت إكسل
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={testWebhookLoading}
                    onClick={onTestWebhook}
                    className="self-end sm:self-auto px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-900 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {testWebhookLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>{testWebhookLoading ? 'جارِ الاختبار...' : 'اختبار الرابط'}</span>
                  </button>
                </div>

                <div>
                  <input
                    type="url"
                    value={editableSettings.notificationWebhookUrl || ''}
                    onChange={(e) =>
                      setEditableSettings({
                        ...editableSettings,
                        notificationWebhookUrl: e.target.value.trim(),
                      })
                    }
                    placeholder="https://discord.com/api/webhooks/... أو https://hook.eu1.make.com/..."
                    className="w-full px-3 py-2.5 bg-white border border-stone-200 rounded-xl font-mono text-xs"
                    dir="ltr"
                  />
                  <span className="text-[10px] text-stone-400 mt-1 block">
                    يدعم تلقائياً بطاقات ديسكورد الغنية (Discord Rich Embeds) ومخططات JSON القياسية
                  </span>
                </div>

                {testWebhookStatus && (
                  <div
                    className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                      testWebhookStatus.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {testWebhookStatus.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{testWebhookStatus.message}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Local Shared Freelance Driver Settings */}
          <div className="bg-white p-6 rounded-3xl border border-stone-200 space-y-4">
            <div className="border-b border-stone-100 pb-2">
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-blue-600" />
                <span>إعدادات المندوب المحلي المشترك (Local Freelance Driver)</span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                اربط متجرك بمندوب توصيل محلي مشترك يوصل طلباتك لعملائك ويحصل المبالغ النقدية دون الحاجة لتحميل أي تطبيق
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-stone-700 mb-1">اسم المندوب المحلي</label>
                <input
                  type="text"
                  value={editableSettings.driverName || ''}
                  onChange={(e) =>
                    setEditableSettings({
                      ...editableSettings,
                      driverName: e.target.value,
                    })
                  }
                  placeholder="مثال: كابتن أحمد / أبو محمد"
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">رقم واتساب المندوب (لاستلام الشحنات)</label>
                <input
                  type="text"
                  value={editableSettings.driverPhone || ''}
                  onChange={(e) =>
                    setEditableSettings({
                      ...editableSettings,
                      driverPhone: e.target.value,
                    })
                  }
                  placeholder="9665XXXXXXXX"
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  أجرة توصيل المندوب لكل طلب ({editableSettings.currency})
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  value={editableSettings.driverFee ?? 15}
                  onChange={(e) => {
                    const norm = normalizeArabicDigits(e.target.value);
                    setEditableSettings({
                      ...editableSettings,
                      driverFee: norm === '' ? 0 : Number(norm),
                    });
                  }}
                  placeholder="15"
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-mono"
                />
                <span className="text-[10px] text-stone-400 mt-0.5 block">
                  المبلغ المتفق عليه للمندوب عن كل شحنة ناجحة ليتم احتسابه تلقائياً في دفتر التصفية اليومي
                </span>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  رابط موقع المحل / المستودع على Google Maps
                </label>
                <input
                  type="url"
                  value={editableSettings.storeLocationUrl || ''}
                  onChange={(e) =>
                    setEditableSettings({
                      ...editableSettings,
                      storeLocationUrl: e.target.value,
                    })
                  }
                  placeholder="https://maps.app.goo.gl/..."
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-mono"
                  dir="ltr"
                />
                <span className="text-[10px] text-stone-400 mt-0.5 block">
                  يرسل للمندوب بنقرة واحدة لفتح اتجاهات القيادة واستلام الطرود من محلك
                </span>
              </div>
            </div>
          </div>

          {/* Verified Captains Network (Merchant View: Local Dispatch Only) */}
          <MerchantCaptainsDirectory settings={editableSettings} storeSlug={storeSlug} isPlatformOwner={false} />

          {/* Store Pickup & ZATCA Tax Compliance */}
          <div className="bg-white p-6 rounded-3xl border border-stone-200 space-y-4">
            <h3 className="text-sm font-bold text-stone-900 border-b border-stone-100 pb-2">
              الاستلام من الفرع وبيانات الضريبة (ZATCA)
            </h3>

            <div className="space-y-3 text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-stone-800">
                <input
                  type="checkbox"
                  checked={editableSettings.enableStorePickup ?? false}
                  onChange={(e) =>
                    setEditableSettings({
                      ...editableSettings,
                      enableStorePickup: e.target.checked,
                    })
                  }
                  className="rounded text-blue-600 w-4 h-4"
                />
                <span>تفعيل خيار الاستلام المباشر من الفرع / المتجر (بدون رسوم شحن)</span>
              </label>

              {editableSettings.enableStorePickup && (
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    عنوان وموقع الاستلام المباشر
                  </label>
                  <input
                    type="text"
                    value={editableSettings.storePickupAddress || ''}
                    onChange={(e) =>
                      setEditableSettings({
                        ...editableSettings,
                        storePickupAddress: e.target.value,
                      })
                    }
                    placeholder="مثال: الرياض - طريق الملك فهد - مجمع التحلية التجاري، المعرض 4"
                    className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl"
                  />
                </div>
              )}

              {/* ZATCA & Tax Compliance Tier Selection */}
              <div className="pt-2">
                <label className="block font-bold text-stone-700 mb-1.5 text-xs">
                  الحالة الضريبية والامتثال لهيئة الزكاة والضريبة والجمارك (ZATCA):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setEditableSettings({
                        ...editableSettings,
                        zatcaComplianceType: 'non_registered',
                      })
                    }
                    className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                      (editableSettings.zatcaComplianceType || (!editableSettings.vatNumber ? 'non_registered' : 'phase_1')) === 'non_registered'
                        ? 'border-amber-500 bg-amber-50/70 ring-1 ring-amber-500'
                        : 'border-stone-200 bg-stone-50 hover:bg-stone-100'
                    }`}
                  >
                    <p className="font-bold text-xs text-stone-900">غير مسجل بالضريبة</p>
                    <p className="text-[10px] text-stone-500 mt-1">
                      وثيقة عمل حر أو دون حد التسجيل. إصدار إيصالات وفواتير مبيعات دون احتساب 15% ضريبة.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setEditableSettings({
                        ...editableSettings,
                        zatcaComplianceType: 'phase_1',
                      })
                    }
                    className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                      editableSettings.zatcaComplianceType === 'phase_1' || (!editableSettings.zatcaComplianceType && editableSettings.vatNumber)
                        ? 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600'
                        : 'border-stone-200 bg-stone-50 hover:bg-stone-100'
                    }`}
                  >
                    <p className="font-bold text-xs text-stone-900">المرحلة 1 (إصدار الفواتير)</p>
                    <p className="text-[10px] text-stone-500 mt-1">
                      منشأة مسجلة بالضريبة. إصدار فواتير ضريبية مبسطة مع رمز QR مشفر (Tags 1-5).
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setEditableSettings({
                        ...editableSettings,
                        zatcaComplianceType: 'phase_2',
                      })
                    }
                    className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                      editableSettings.zatcaComplianceType === 'phase_2'
                        ? 'border-purple-600 bg-purple-50/70 ring-1 ring-purple-600'
                        : 'border-stone-200 bg-stone-50 hover:bg-stone-100'
                    }`}
                  >
                    <p className="font-bold text-xs text-stone-900">المرحلة 2 (الربط والتكامل)</p>
                    <p className="text-[10px] text-stone-500 mt-1">
                      الربط مع منصة فاتورة (FATOORA)، تشفير الختم الرقمي والبصمة (Hash & UUID).
                    </p>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {editableSettings.zatcaComplianceType !== 'non_registered' && (
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      الرقم الضريبي للمنشأة (15 رقماً)
                    </label>
                    <input
                      type="text"
                      value={editableSettings.vatNumber || ''}
                      onChange={(e) =>
                        setEditableSettings({
                          ...editableSettings,
                          vatNumber: e.target.value,
                        })
                      }
                      placeholder="300000000000003"
                      className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-mono"
                      dir="ltr"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    رقم السجل التجاري (Commercial Register)
                  </label>
                  <input
                    type="text"
                    value={editableSettings.commercialRegister || ''}
                    onChange={(e) =>
                      setEditableSettings({
                        ...editableSettings,
                        commercialRegister: e.target.value,
                      })
                    }
                    placeholder="1010XXXXXX"
                    className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-mono"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    رقم وثيقة العمل الحر (للمستقلين)
                  </label>
                  <input
                    type="text"
                    value={editableSettings.freelanceCertificate || ''}
                    onChange={(e) =>
                      setEditableSettings({
                        ...editableSettings,
                        freelanceCertificate: e.target.value,
                      })
                    }
                    placeholder="FL-XXXXXXXX"
                    className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              {editableSettings.zatcaComplianceType !== 'non_registered' && (
                <label className="flex items-center gap-2 cursor-pointer font-bold text-stone-800 pt-1">
                  <input
                    type="checkbox"
                    checked={editableSettings.pricesIncludeVat ?? true}
                    onChange={(e) =>
                      setEditableSettings({
                        ...editableSettings,
                        pricesIncludeVat: e.target.checked,
                      })
                    }
                    className="rounded text-blue-600 w-4 h-4"
                  />
                  <span>الأسعار المعروضة في المتجر شاملة لضريبة القيمة المضافة 15%</span>
                </label>
              )}
            </div>
          </div>

          {/* Marketing Pixels & Ad Campaigns */}
          <div className="bg-white p-6 rounded-3xl border border-stone-200 space-y-4">
            <div className="border-b border-stone-100 pb-2">
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>بكسلات التتبع والحملات الإعلانية (Marketing Pixels & GA4)</span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                اربط متجرك مع منصات الإعلانات لتتبع التحويلات (PageView, AddToCart, Purchase) تلقائياً
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Google Analytics 4 (معرّف القياس)
                </label>
                <input
                  type="text"
                  value={editableSettings.googleAnalyticsId || ''}
                  onChange={(e) =>
                    setEditableSettings({
                      ...editableSettings,
                      googleAnalyticsId: e.target.value,
                    })
                  }
                  placeholder="G-XXXXXXXXXX"
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Meta Pixel ID (فيسبوك / انستقرام)
                </label>
                <input
                  type="text"
                  value={editableSettings.facebookPixelId || ''}
                  onChange={(e) =>
                    setEditableSettings({
                      ...editableSettings,
                      facebookPixelId: e.target.value,
                    })
                  }
                  placeholder="123456789012345"
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  TikTok Pixel ID (تيك توك)
                </label>
                <input
                  type="text"
                  value={editableSettings.tiktokPixelId || ''}
                  onChange={(e) =>
                    setEditableSettings({
                      ...editableSettings,
                      tiktokPixelId: e.target.value,
                    })
                  }
                  placeholder="CXXXXXXXXXXXXXXXXXXX"
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Snapchat Pixel ID (سناب شات)
                </label>
                <input
                  type="text"
                  value={editableSettings.snapchatPixelId || ''}
                  onChange={(e) =>
                    setEditableSettings({
                      ...editableSettings,
                      snapchatPixelId: e.target.value,
                    })
                  }
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-mono"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-6 py-2.5 bg-[#2563EB] hover:bg-blue-600 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>حفظ إعدادات المتجر</span>
              </button>
            </div>
          </div>
        </form>

        {/* Promo Codes / Coupons Manager */}
        <div className="bg-white p-6 rounded-3xl border border-stone-200 space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-2">
            <div>
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                <Percent className="w-4 h-4 text-[#2563EB]" />
                <span>أكواد الخصم والكوبونات الترويجية</span>
              </h3>
              <p className="text-xs text-stone-500">
                أنشئ كوبونات خصم (نسبة مئوية أو مبلغ ثابت) لتحفيز عملائك على إتمام الشراء
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs items-end bg-stone-50 p-3.5 rounded-2xl border border-stone-200">
            <div>
              <label className="block font-bold text-stone-700 mb-1">كود الخصم</label>
              <input
                type="text"
                value={newPromoCode}
                onChange={(e) => setNewPromoCode(e.target.value.toUpperCase())}
                placeholder="WELCOME10"
                className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl font-mono uppercase"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block font-bold text-stone-700 mb-1">نوع الخصم</label>
              <select
                value={newPromoType}
                onChange={(e) => setNewPromoType(e.target.value as 'percentage' | 'fixed')}
                className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl"
              >
                <option value="percentage">نسبة مئوية (%)</option>
                <option value="fixed">مبلغ ثابت ({editableSettings.currency})</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-stone-700 mb-1">قيمة الخصم</label>
              <input
                type="text"
                inputMode="decimal"
                dir="ltr"
                value={newPromoValue}
                onChange={(e) => {
                  const norm = normalizeArabicDigits(e.target.value);
                  setNewPromoValue(norm === '' ? 0 : Number(norm));
                }}
                className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl font-mono"
              />
            </div>
            <button
              type="button"
              onClick={handleInternalAddPromo}
              className="px-4 py-2 bg-[#0F172A] hover:bg-stone-800 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer h-[38px]"
            >
              <Plus className="w-3.5 h-3.5 text-[#86EFAC]" />
              <span>إضافة الكود</span>
            </button>
          </div>

          {(editableSettings.promoCodes || []).length > 0 && (
            <div className="space-y-2">
              {(editableSettings.promoCodes || []).map((promo: PromoCode) => (
                <div
                  key={promo.code}
                  className="flex items-center justify-between p-3 rounded-xl border border-stone-200 bg-white text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-black text-sm px-2.5 py-1 rounded-lg bg-blue-50 text-[#2563EB]">
                      {promo.code}
                    </span>
                    <span className="font-bold text-stone-800">
                      خصم{' '}
                      {promo.type === 'percentage'
                        ? `${promo.value}%`
                        : `${promo.value} ${editableSettings.currency}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onTogglePromoCode(promo.code)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                        promo.active
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-stone-100 text-stone-500'
                      }`}
                    >
                      {promo.active ? 'مفعّل' : 'معطّل'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeletePromoCode(promo.code)}
                      className="p-1.5 text-stone-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Store Policies & Warranties Customizer */}
      <div className="bg-white p-6 rounded-3xl border border-stone-200 space-y-5 h-fit shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <span className="p-1 rounded-lg bg-blue-50 text-blue-600">
                <ShieldCheck className="w-4 h-4" />
              </span>
              <span>سياسات المتجر والضمان المخصصة (100% ديناميكية)</span>
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              يمكنك تخصيص وحذف وإضافة أي عدد من السياسات المستقلة الخاصة بمتجرك (استبدال، شحن، جودة، خصوصية).
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              const newId = `policy-${Date.now()}`;
              setEditablePolicies([
                ...editablePolicies,
                {
                  id: newId,
                  title: 'سياسة جديدة',
                  icon: 'ShieldCheck',
                  content: 'اكتب تفاصيل وشروط هذه السياسة هنا...',
                },
              ]);
            }}
            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#2563EB] border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة بند سياسة جديد</span>
          </button>
        </div>

        {editablePolicies.length === 0 ? (
          <div className="p-6 text-center rounded-2xl bg-stone-50 border border-dashed border-stone-200 space-y-2">
            <p className="text-xs font-bold text-stone-600">لا توجد سياسات مضافة لمتجرك حالياً</p>
            <p className="text-[11px] text-stone-400">انقر فوق "إضافة بند سياسة جديد" لكتابة شروط وضمانات متجرك الخاصة.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {editablePolicies.map((pol, idx) => (
              <div 
                key={pol.id} 
                className="p-4 bg-stone-50/80 rounded-2xl border border-stone-200 space-y-3 relative group transition-all hover:bg-stone-50"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-white border border-stone-200 text-stone-600 flex items-center justify-center text-xs font-bold shrink-0">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={pol.title}
                      placeholder="عنوان السياسة (مثال: سياسة الاستبدال والاسترجاع)"
                      onChange={(e) => {
                        const updated = [...editablePolicies];
                        updated[idx] = { ...pol, title: e.target.value };
                        setEditablePolicies(updated);
                      }}
                      className="w-full px-3 py-1.5 text-xs font-bold bg-white border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Icon selector */}
                    <select
                      value={pol.icon || 'ShieldCheck'}
                      onChange={(e) => {
                        const updated = [...editablePolicies];
                        updated[idx] = { ...pol, icon: e.target.value };
                        setEditablePolicies(updated);
                      }}
                      className="px-2 py-1 text-xs bg-white border border-stone-200 rounded-lg text-stone-700 cursor-pointer font-sans"
                      title="اختر أيقونة السياسة"
                    >
                      <option value="Truck">🚚 شحن وتوصيل</option>
                      <option value="RefreshCw">🔄 استرجاع واستبدال</option>
                      <option value="ShieldCheck">🛡️ ضمان وجودة</option>
                      <option value="Sparkles">✨ ميزات خاصة</option>
                      <option value="CreditCard">💳 دفع وأمان</option>
                      <option value="Lock">🔒 خصوصية وسرية</option>
                      <option value="Clock">⏱️ مواعيد وساعات العمل</option>
                      <option value="Package">📦 استلام وتغليف</option>
                      <option value="MessageCircle">💬 خدمة عملاء وتواصل</option>
                      <option value="FileText">📄 شروط وأحكام عامة</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => {
                        const updated = editablePolicies.filter((_, i) => i !== idx);
                        setEditablePolicies(updated);
                      }}
                      className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="حذف هذا البند"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <textarea
                    rows={4}
                    value={pol.content}
                    placeholder="اكتب نصوص وشروط هذه السياسة هنا بالتفصيل (يدعم الأسطر المتعددة)..."
                    onChange={(e) => {
                      const updated = [...editablePolicies];
                      updated[idx] = { ...pol, content: e.target.value };
                      setEditablePolicies(updated);
                    }}
                    className="w-full p-3 text-xs bg-white border border-stone-200 rounded-xl leading-relaxed text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-2">
          <button
            type="button"
            onClick={onSavePolicies}
            className="w-full py-3 bg-[#0F172A] hover:bg-stone-800 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <Save className="w-4 h-4 text-[#86EFAC]" />
            <span>حفظ جميع سياسات المتجر والضمان</span>
          </button>
        </div>
      </div>
    </div>
  );
};
