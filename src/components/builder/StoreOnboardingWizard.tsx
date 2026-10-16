import React, { useState } from 'react';
import { StoreSettings, Product } from '../../types/store';
import { MODERN_RETAIL_THEME } from '../../services/storeStorage';
import { 
  Sparkles, 
  Store, 
  ArrowLeft, 
  ArrowRight, 
  Table, 
  Palette, 
  Check, 
  Link2, 
  Phone, 
  DollarSign, 
  CheckCircle2,
  FileSpreadsheet,
  Zap,
  Globe
} from 'lucide-react';

interface StoreOnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (settings: StoreSettings, initialProducts?: Product[]) => void;
  currentSettings: StoreSettings;
}

export const StoreOnboardingWizard: React.FC<StoreOnboardingWizardProps> = ({
  isOpen,
  onClose,
  onComplete,
  currentSettings,
}) => {
  if (!isOpen) return null;

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form State
  const [storeName, setStoreName] = useState(currentSettings.storeName || 'متجر النخبة | Elite Store');
  const [storeSubtitle, setStoreSubtitle] = useState(currentSettings.storeSubtitle || 'تشكيلة راقية ومختارة');
  const [businessType, setBusinessType] = useState('أزياء وإكسسوارات');
  const [whatsappNumber, setWhatsappNumber] = useState(currentSettings.whatsappNumber || '966500000000');
  const [currency, setCurrency] = useState(currentSettings.currency || 'ر.س');
  const [tagline, setTagline] = useState(currentSettings.tagline || 'متجر إلكتروني ذكي وسريع مربوط مباشرة بجدول Google Sheets');

  // Brand Theme
  const [primaryColor, setPrimaryColor] = useState(currentSettings.brandTheme?.primaryColor || '#0F172A');
  const [accentColor, setAccentColor] = useState(currentSettings.brandTheme?.accentColor || '#2563EB');
  const [backgroundColor, setBackgroundColor] = useState(currentSettings.brandTheme?.backgroundColor || '#F8FAFC');
  const [logoLetter, setLogoLetter] = useState(currentSettings.logoLetter || 'E');

  // Sheet Connection
  const [sheetConnectionMethod, setSheetConnectionMethod] = useState<'auto' | 'custom_url'>('auto');
  const [googleSheetUrl, setGoogleSheetUrl] = useState(currentSettings.googleWebAppUrl || '');

  const businessCategories = [
    'حلول تقنية واستشارات',
    'أزياء وعبايات وملابس',
    'عطور ومستحضرات تجميل',
    'أطعمة وحلويات ومقاهي',
    'أجهزة وإلكترونيات',
    'منتجات رقمية ودورات',
    'نشاط تجاري عام',
  ];

  const handleFinish = () => {
    const updatedSettings: StoreSettings = {
      ...currentSettings,
      storeName: storeName.trim(),
      storeSubtitle: storeSubtitle.trim(),
      logoLetter: logoLetter.trim() || storeName.charAt(0) || 'S',
      tagline: tagline.trim(),
      whatsappNumber: whatsappNumber.trim().replace(/\D/g, '') || '966500000000',
      supportPhone: `+${whatsappNumber.trim().replace(/\D/g, '') || '966500000000'}`,
      currency: currency.trim() || 'ر.س',
      googleWebAppUrl: googleSheetUrl.trim(),
      brandTheme: {
        primaryColor,
        accentColor,
        highlightColor: '#A5F3B6',
        backgroundColor,
        neutralColor: '#E4E7EB',
        textColor: primaryColor,
        fontFamily: 'Cairo',
        borderRadius: 12,
      },
      primaryColor,
      secondaryColor: accentColor,
    };

    onComplete(updatedSettings);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-stone-950/70 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden z-10 border border-stone-200 my-auto flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-stone-200 bg-[#F8F3ED] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0B253F] text-white flex items-center justify-center font-bold text-lg shadow-sm">
              <Store className="w-5 h-5 text-[#A5F3B6]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-[#0B253F]">
                  معالج إطلاق متجرك عبر Google Sheets · Developed by Ebrahim
                </h3>
              </div>
              <p className="text-xs text-stone-500">
                أدخلي بيانات نشاطك التجاري وسيتم ربط جدول البيانات تلقائياً ليعمل كقاعدة بيانات فورية
              </p>
            </div>
          </div>

          <div className="text-xs font-bold text-[#0077FF] bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
            خطوة {step} من 3
          </div>
        </div>

        {/* Stepper Indicator */}
        <div className="grid grid-cols-3 border-b border-stone-200 bg-stone-50 text-xs text-center font-bold">
          <div
            className={`py-2.5 border-b-2 transition-all ${
              step === 1 ? 'border-[#0077FF] text-[#0077FF] bg-white' : 'border-transparent text-stone-500'
            }`}
          >
            1. بيانات النشاط
          </div>
          <div
            className={`py-2.5 border-b-2 transition-all ${
              step === 2 ? 'border-[#0077FF] text-[#0077FF] bg-white' : 'border-transparent text-stone-500'
            }`}
          >
            2. الهوية والألوان
          </div>
          <div
            className={`py-2.5 border-b-2 transition-all ${
              step === 3 ? 'border-[#0077FF] text-[#0077FF] bg-white' : 'border-transparent text-stone-500'
            }`}
          >
            3. ربط Google Sheets
          </div>
        </div>

        {/* Form Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* STEP 1: BUSINESS INFORMATION */}
          {step === 1 && (
            <div className="space-y-4 text-xs animate-in fade-in duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">
                    اسم المتجر / البراند <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="مثال: سيمبلر، أزياء ريم، قهوة المختص..."
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0077FF]/30"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-800 mb-1">
                    اسم المالك أو النشاط الفرعي
                  </label>
                  <input
                    type="text"
                    value={storeSubtitle}
                    onChange={(e) => setStoreSubtitle(e.target.value)}
                    placeholder="مثال: إبراهيم جابر"
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0077FF]/30"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-800 mb-1">نوع النشاط التجاري</label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-xs focus:outline-none focus:ring-2 focus:ring-[#0077FF]/30"
                >
                  {businessCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">
                    رقم الواتساب لاستقبال الطلبات الفورية <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      placeholder="966532923509"
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0077FF]/30"
                      dir="ltr"
                    />
                    <Phone className="w-4 h-4 text-stone-400 absolute right-3 top-3 pointer-events-none" />
                  </div>
                  <span className="text-[11px] text-stone-500 mt-1 block">
                    يتم إرسال فواتير الطلبات وحفظها في Google Sheets ثم إرسالها لرقمك مباشرة.
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-stone-800 mb-1">
                    العملة المعروضة في المتجر
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm focus:outline-none"
                  >
                    <option value="ر.س">ريال سعودي (ر.س)</option>
                    <option value="USD">دولار أمريكي (USD $)</option>
                    <option value="د.إ">درهم إماراتي (د.إ)</option>
                    <option value="د.ك">دينار كويتي (د.ك)</option>
                    <option value="ق.ر">ريال قطري (ق.ر)</option>
                    <option value="ج.م">جنيه مصري (ج.م)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-800 mb-1">
                  شعار المتجر أو الوصف التعريفي (Tagline)
                </label>
                <textarea
                  rows={2}
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="اكتب نبذة عن متجرك وميزتك التنافسية..."
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-xs focus:outline-none focus:ring-2 focus:ring-[#0077FF]/30"
                />
              </div>
            </div>
          )}

          {/* STEP 2: BRANDING & LIGHT THEME */}
          {step === 2 && (
            <div className="space-y-4 text-xs animate-in fade-in duration-200">
              <div className="p-3.5 rounded-2xl bg-[#0077FF]/5 border border-[#0077FF]/20 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-[#0B253F]">هوية سيمبلر الافتراضية (Light Theme)</h4>
                  <p className="text-[11px] text-stone-500">
                    ألوان مريحة للعين وخلفية بيضاء كريمية دافئة (#F8F3ED) مع كحلي وأزرق أنيق
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPrimaryColor('#0B253F');
                    setAccentColor('#0077FF');
                    setBackgroundColor('#F8F3ED');
                    setLogoLetter('S');
                  }}
                  className="px-3 py-1 bg-white border border-stone-200 text-[#0077FF] font-bold rounded-lg hover:bg-stone-50"
                >
                  تطبيق الافتراضي
                </button>
              </div>

              {/* Color Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
                  <label className="font-bold text-stone-800 block">لون الخلفية (Light Theme)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer"
                    />
                    <input
                      type="text"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="flex-1 px-2 py-1 bg-white border border-stone-200 rounded font-mono text-xs uppercase"
                    />
                  </div>
                </div>

                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
                  <label className="font-bold text-stone-800 block">اللون الأساسي (العناوين)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="flex-1 px-2 py-1 bg-white border border-stone-200 rounded font-mono text-xs uppercase"
                    />
                  </div>
                </div>

                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
                  <label className="font-bold text-stone-800 block">لون الأزرار والتفاعل</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer"
                    />
                    <input
                      type="text"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="flex-1 px-2 py-1 bg-white border border-stone-200 rounded font-mono text-xs uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Logo Letter */}
              <div>
                <label className="block font-bold text-stone-800 mb-1">
                  رمز أيقونة الشعار (حرف أو رقم)
                </label>
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl text-white shadow-sm"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {logoLetter}
                  </div>
                  <input
                    type="text"
                    maxLength={2}
                    value={logoLetter}
                    onChange={(e) => setLogoLetter(e.target.value.toUpperCase())}
                    placeholder="S"
                    className="w-20 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-center font-bold text-base"
                  />
                  <span className="text-[11px] text-stone-400">
                    يظهر كشعار أنيق لمتجرك في رأس الصفحة وأيقونة المتجر
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: GOOGLE SHEETS CONNECTION */}
          {step === 3 && (
            <div className="space-y-4 text-xs animate-in fade-in duration-200">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>Google Sheets يعمل كقاعدة بيانات خلفية لمتجرك (Backend Database)</span>
                </div>
                <p className="text-xs leading-relaxed text-emerald-800">
                  يتم تخزين كافة المنتجات، الأسعار، المخزون، والطلبات الواردة في 4 تبويبات منظمة ومحمية داخل جدول بيانات Google Sheet.
                </p>
              </div>

              {/* Connection Mode Choice */}
              <div className="space-y-3">
                <label
                  onClick={() => setSheetConnectionMethod('auto')}
                  className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                    sheetConnectionMethod === 'auto'
                      ? 'border-[#0077FF] bg-blue-50/40 ring-2 ring-[#0077FF]/20'
                      : 'border-stone-200 bg-white hover:bg-stone-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="sheet_method"
                    checked={sheetConnectionMethod === 'auto'}
                    onChange={() => setSheetConnectionMethod('auto')}
                    className="mt-1"
                  />
                  <div>
                    <h5 className="font-bold text-stone-900 flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <span>توليد وتفعيل جدول المتجر التفاعلي فورياً (موصى به - Instant)</span>
                    </h5>
                    <p className="text-stone-500 text-[11px] mt-0.5 leading-relaxed">
                      يُنشئ المتجر قاعدة بيانات حية داخل المتصفح والجدول التفاعلي مع إمكانية ربطها بجدول Google Sheets الحقيقي لاحقاً بنقرة واحدة عبر كود Apps Script الجاهز.
                    </p>
                  </div>
                </label>

                <label
                  onClick={() => setSheetConnectionMethod('custom_url')}
                  className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                    sheetConnectionMethod === 'custom_url'
                      ? 'border-[#0077FF] bg-blue-50/40 ring-2 ring-[#0077FF]/20'
                      : 'border-stone-200 bg-white hover:bg-stone-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="sheet_method"
                    checked={sheetConnectionMethod === 'custom_url'}
                    onChange={() => setSheetConnectionMethod('custom_url')}
                    className="mt-1"
                  />
                  <div>
                    <h5 className="font-bold text-stone-900 flex items-center gap-1.5">
                      <Link2 className="w-4 h-4 text-[#0077FF]" />
                      <span>ربط رابط Google Apps Script Web App الخاص بك</span>
                    </h5>
                    <p className="text-stone-500 text-[11px] mt-0.5 leading-relaxed">
                      إذا كان لديك رابط Web App منشور من جدول Google Sheet الخاص بك (ينتهي بـ <code>/exec</code>)، الصقه هنا للمزامنة المباشرة.
                    </p>
                  </div>
                </label>
              </div>

              {sheetConnectionMethod === 'custom_url' && (
                <div className="space-y-1.5 pt-2">
                  <label className="font-bold text-stone-800">رابط Web App الخاص بجدول البيانات:</label>
                  <input
                    type="url"
                    value={googleSheetUrl}
                    onChange={(e) => setGoogleSheetUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-mono text-xs focus:outline-none"
                    dir="ltr"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer with Actions */}
        <div className="p-4 sm:p-5 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as any)}
              className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
              <span>السابق</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-stone-500 hover:text-stone-800 text-xs font-semibold"
            >
              إلغاء
            </button>
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => {
                if (!storeName.trim()) {
                  alert('يرجى إدخال اسم المتجر أولاً');
                  return;
                }
                setStep((s) => (s + 1) as any);
              }}
              className="px-6 py-2.5 bg-[#0077FF] hover:bg-blue-600 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm transition-transform active:scale-95"
            >
              <span>التالي: إعداد المظهر</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              className="px-6 py-2.5 bg-[#0B253F] hover:bg-stone-900 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md transition-transform active:scale-95"
            >
              <Check className="w-4 h-4 text-[#A5F3B6]" />
              <span>تأكيد وإنشاء المتجر فوراً 🚀</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
