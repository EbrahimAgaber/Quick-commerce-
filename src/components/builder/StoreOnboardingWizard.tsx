import React, { useState } from 'react';
import { StoreSettings, Product } from '../../types/store';
import { DEFAULT_PRODUCTS } from '../../services/storeStorage';
import { generateCleanStoreSlug } from '../../utils/urlRouter';
import { normalizeArabicDigits } from '../../utils/digits';
import { requestAIGeneration } from '../../services/aiService';
import { compressImageFile } from '../../utils/imageUploader';
import { 
  Store, 
  ArrowLeft, 
  ArrowRight, 
  Phone, 
  CheckCircle2,
  Truck,
  Sparkles,
  ShoppingBag,
  Globe,
  AlertCircle,
  Loader2,
  Wand2,
  Upload,
  Trash2
} from 'lucide-react';

interface StoreOnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (settings: StoreSettings, initialProducts?: Product[], customSlug?: string) => void;
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
  const [stepError, setStepError] = useState<string | null>(null);
  const [generatingTagline, setGeneratingTagline] = useState(false);

  // Step 1: Business Details
  const [storeName, setStoreName] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [storeSubtitle, setStoreSubtitle] = useState('');
  const [businessType, setBusinessType] = useState('أزياء وإكسسوارات');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [currency, setCurrency] = useState('ر.س');
  const [tagline, setTagline] = useState('تسوق أحدث المنتجات المختارة بعناية مع توصيل سريع وخدمة عملاء متميزة');

  // Step 2: Brand Theme
  const [primaryColor, setPrimaryColor] = useState('#0F172A');
  const [accentColor, setAccentColor] = useState('#2563EB');
  const [backgroundColor, setBackgroundColor] = useState('#F8FAFC');
  const [logoLetter, setLogoLetter] = useState('S');
  const [logoUrl, setLogoUrl] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Step 3: Shipping & Starter Catalog
  const [freeShippingThreshold, setFreeShippingThreshold] = useState<number>(250);
  const [standardShippingRate, setStandardShippingRate] = useState<number>(25);
  const [starterCatalogMode, setStarterCatalogMode] = useState<'empty' | 'sample'>('empty');

  const businessCategories = [
    'أزياء وإكسسوارات',
    'عطور ومستحضرات تجميل',
    'إلكترونيات وأجهزة ذكية',
    'أطعمة وحلويات ومقاهي',
    'هدايا ومقتنيات',
    'منتجات رقمية وخدمات',
    'نشاط تجاري عام',
  ];

  const handleGenerateAITagline = async () => {
    setGeneratingTagline(true);
    try {
      const prompt = `اكتب شعاراً تسويقياً جذاباً ومختصراً (Tagline) لمتجر إلكتروني اسمه: ${
        storeName.trim() || 'متجري'
      }، في مجال: ${businessType}`;
      const res = await requestAIGeneration(prompt);
      if (res.text) {
        setTagline(res.text);
      }
    } catch {
      // Fallback already handled inside requestAIGeneration
    } finally {
      setGeneratingTagline(false);
    }
  };

  const handleNextStep = () => {
    if (step === 1) {
      if (!storeName.trim()) {
        setStepError('يرجى إدخال اسم المتجر أولاً للمتابعة.');
        return;
      }
      const cleanPhone = normalizeArabicDigits(whatsappNumber.trim()).replace(/\D/g, '');
      if (!cleanPhone || cleanPhone.length < 8) {
        setStepError('يرجى إدخال رقم واتساب صحيح (مع رمز الدولة مثل 9665XXXXXXXX) لاستقبال طلبات العملاء.');
        return;
      }
    }
    setStepError(null);
    setStep((s) => (s + 1) as 1 | 2 | 3);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const dataUrl = await compressImageFile(file, 400, 400, 0.9);
      setLogoUrl(dataUrl);
    } catch {
      // Ignore
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleFinish = () => {
    const cleanPhone = normalizeArabicDigits(whatsappNumber.trim()).replace(/\D/g, '');
    const finalSlug = (customSlug.trim() || generateCleanStoreSlug(storeName.trim() || 'store'))
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '');

    const normFreeShipping = Number(normalizeArabicDigits(String(freeShippingThreshold)));
    const normStandardShipping = Number(normalizeArabicDigits(String(standardShippingRate)));

    const updatedSettings: StoreSettings = {
      ...currentSettings,
      storeName: storeName.trim() || 'متجري الجديد',
      storeSubtitle: storeSubtitle.trim(),
      businessType,
      logoLetter: (logoLetter.trim() || storeName.trim().charAt(0) || 'S').toUpperCase(),
      logoUrl: logoUrl.trim() || undefined,
      tagline: tagline.trim(),
      whatsappNumber: cleanPhone,
      supportPhone: cleanPhone ? `+${cleanPhone}` : '',
      currency: currency.trim() || 'ر.س',
      freeShippingThreshold: !isNaN(normFreeShipping) && normFreeShipping >= 0 ? normFreeShipping : 250,
      standardShippingRate: !isNaN(normStandardShipping) && normStandardShipping >= 0 ? normStandardShipping : 25,
      googleWebAppUrl: '',
      brandTheme: {
        primaryColor,
        accentColor,
        highlightColor: '#86EFAC',
        backgroundColor,
        neutralColor: '#E2E8F0',
        textColor: primaryColor,
        fontFamily: 'Cairo',
        borderRadius: 14,
      },
      primaryColor,
      secondaryColor: accentColor,
    };

    const initialProds = starterCatalogMode === 'sample' ? DEFAULT_PRODUCTS : [];
    onComplete(updatedSettings, initialProds, finalSlug);
    onClose();
  };

  const previewSlug = (customSlug.trim() || generateCleanStoreSlug(storeName.trim() || 'my-store'))
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-stone-950/70 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden z-10 border border-stone-200 my-auto flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-stone-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0F172A] text-white flex items-center justify-center font-bold text-lg shadow-sm">
              <Store className="w-5 h-5 text-[#86EFAC]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-[#0F172A]">
                إعداد وإطلاق متجرك الإلكتروني الجديد
              </h3>
              <p className="text-xs text-stone-500">
                أدخل بيانات نشاطك التجاري وهويتك البصرية ليصبح متجرك جاهزاً لاستقبال الطلبات فوراً
              </p>
            </div>
          </div>

          <div className="text-xs font-bold text-[#2563EB] bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
            خطوة {step} من 3
          </div>
        </div>

        {/* Stepper Indicator */}
        <div className="grid grid-cols-3 border-b border-stone-200 bg-stone-50 text-xs text-center font-bold">
          <div
            className={`py-2.5 border-b-2 transition-all ${
              step === 1 ? 'border-[#2563EB] text-[#2563EB] bg-white' : 'border-transparent text-stone-500'
            }`}
          >
            1. بيانات النشاط
          </div>
          <div
            className={`py-2.5 border-b-2 transition-all ${
              step === 2 ? 'border-[#2563EB] text-[#2563EB] bg-white' : 'border-transparent text-stone-500'
            }`}
          >
            2. الهوية والألوان
          </div>
          <div
            className={`py-2.5 border-b-2 transition-all ${
              step === 3 ? 'border-[#2563EB] text-[#2563EB] bg-white' : 'border-transparent text-stone-500'
            }`}
          >
            3. الشحن والمنتجات
          </div>
        </div>

        {/* Form Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {stepError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{stepError}</span>
            </div>
          )}

          {/* STEP 1: BUSINESS INFORMATION */}
          {step === 1 && (
            <div className="space-y-4 text-xs animate-in fade-in duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">
                    اسم المتجر / العلامة التجارية <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={storeName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setStoreName(val);
                      if (stepError) setStepError(null);
                      if (val.trim()) {
                        setLogoLetter(val.trim().charAt(0).toUpperCase());
                        if (!slugTouched) {
                          setCustomSlug(generateCleanStoreSlug(val));
                        }
                      }
                    }}
                    placeholder="مثال: متجر رونق، قهوة المختص، بوتيك النخبة..."
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-800 mb-1">
                    الرابط المختصر للمتجر (Store Link Slug)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={customSlug}
                      onChange={(e) => {
                        setSlugTouched(true);
                        setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''));
                      }}
                      placeholder="rawaq-store"
                      className="w-full pl-3.5 pr-9 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                      dir="ltr"
                    />
                    <Globe className="w-4 h-4 text-stone-400 absolute right-3 top-3 pointer-events-none" />
                  </div>
                  <span className="text-[10px] text-[#2563EB] font-mono mt-1 block" dir="ltr">
                    /?store={previewSlug || 'store'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">نوع النشاط التجاري</label>
                  <select
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-xs focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                  >
                    {businessCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-stone-800 mb-1">
                    العنوان الفرعي للمتجر (اختياري)
                  </label>
                  <input
                    type="text"
                    value={storeSubtitle}
                    onChange={(e) => setStoreSubtitle(e.target.value)}
                    placeholder="مثال: تشكيلة حصرية مختارة"
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">
                    رقم الواتساب لاستقبال الطلبات <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      required
                      value={whatsappNumber}
                      onChange={(e) => {
                        setWhatsappNumber(e.target.value);
                        if (stepError) setStepError(null);
                      }}
                      placeholder="9665XXXXXXXX"
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                      dir="ltr"
                    />
                    <Phone className="w-4 h-4 text-stone-400 absolute right-3 top-3 pointer-events-none" />
                  </div>
                  <span className="text-[11px] text-stone-500 mt-1 block">
                    تصل فواتير طلبات العملاء مباشرة إلى هذا الرقم عبر الواتساب بالإضافة إلى لوحة التحكم.
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
                    <option value="د.إ">درهم إماراتي (د.إ)</option>
                    <option value="د.ك">دينار كويتي (د.ك)</option>
                    <option value="ق.ر">ريال قطري (ق.ر)</option>
                    <option value="ج.م">جنيه مصري (ج.م)</option>
                    <option value="USD">دولار أمريكي (USD $)</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-stone-800">
                    الوصف التعريفي للمتجر (Tagline)
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateAITagline}
                    disabled={generatingTagline}
                    className="text-[11px] font-bold text-[#2563EB] hover:bg-blue-50 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {generatingTagline ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="w-3.5 h-3.5" />
                    )}
                    <span>توليد وصف احترافي بالذكاء الاصطناعي ✨</span>
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="اكتب نبذة قصيرة عن متجرك تظهر للزوار في أعلى المتجر..."
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-xs focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                />
              </div>
            </div>
          )}

          {/* STEP 2: BRANDING & THEME */}
          {step === 2 && (
            <div className="space-y-4 text-xs animate-in fade-in duration-200">
              <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-200 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-[#0F172A]">اختر ألوان الهوية البصرية لمتجرك</h4>
                  <p className="text-[11px] text-stone-500">
                    يمكنك تعديل هذه الألوان والخطوط في أي وقت لاحقاً من استوديو الهوية
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPrimaryColor('#0F172A');
                    setAccentColor('#2563EB');
                    setBackgroundColor('#F8FAFC');
                  }}
                  className="px-3 py-1 bg-white border border-stone-200 text-[#2563EB] font-bold rounded-lg hover:bg-stone-50 cursor-pointer"
                >
                  النمط الافتراضي
                </button>
              </div>

              {/* Color Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
                  <label className="font-bold text-stone-800 block">لون الخلفية</label>
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

              {/* Logo & Brand Icon */}
              <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-2xl space-y-3">
                <div>
                  <label className="block font-bold text-stone-800">
                    شعار المتجر أو رمز الأيقونة
                  </label>
                  <p className="text-[11px] text-stone-500">
                    ارفع صورة شعار متجرك (PNG شفاف أو JPG) أو اختر حرفاً يمثل متجرك
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl text-white shadow-xs overflow-hidden shrink-0 border border-stone-200"
                    style={{ backgroundColor: logoUrl ? '#FFFFFF' : primaryColor }}
                  >
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                    ) : (
                      <span>{logoLetter}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="px-3 py-2 bg-white hover:bg-stone-100 border border-stone-200 rounded-xl font-bold text-stone-700 flex items-center gap-1.5 cursor-pointer text-xs">
                      <Upload className="w-3.5 h-3.5 text-[#2563EB]" />
                      <span>{uploadingLogo ? 'جاري المعالجة...' : 'رفع صورة الشعار'}</span>
                      <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                    </label>

                    {logoUrl && (
                      <button
                        type="button"
                        onClick={() => setLogoUrl('')}
                        className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl cursor-pointer"
                        title="إزالة الشعار والعودة للحرف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-stone-500 font-medium">أو الحرف:</span>
                      <input
                        type="text"
                        maxLength={2}
                        value={logoLetter}
                        onChange={(e) => setLogoLetter(e.target.value.toUpperCase())}
                        placeholder="S"
                        className="w-12 px-2 py-1.5 bg-white border border-stone-200 rounded-xl text-center font-bold text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: SHIPPING & INITIAL CATALOG */}
          {step === 3 && (
            <div className="space-y-4 text-xs animate-in fade-in duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">
                    رسوم الشحن والتوصيل الثابتة ({currency})
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      dir="ltr"
                      value={standardShippingRate}
                      onChange={(e) => {
                        const norm = normalizeArabicDigits(e.target.value);
                        setStandardShippingRate(norm === '' ? 0 : Number(norm));
                      }}
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm font-mono focus:outline-none"
                    />
                    <Truck className="w-4 h-4 text-stone-400 absolute left-3 top-3 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-stone-800 mb-1">
                    الحد الأدنى للشحن المجاني ({currency})
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    dir="ltr"
                    value={freeShippingThreshold}
                    onChange={(e) => {
                      const norm = normalizeArabicDigits(e.target.value);
                      setFreeShippingThreshold(norm === '' ? 0 : Number(norm));
                    }}
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2.5 pt-2">
                <label className="block font-bold text-stone-800">كيف تفضل البدء بمنتجات متجرك؟</label>

                <label
                  onClick={() => setStarterCatalogMode('empty')}
                  className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                    starterCatalogMode === 'empty'
                      ? 'border-[#2563EB] bg-blue-50/40 ring-2 ring-[#2563EB]/20'
                      : 'border-stone-200 bg-white hover:bg-stone-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="catalog_mode"
                    checked={starterCatalogMode === 'empty'}
                    onChange={() => setStarterCatalogMode('empty')}
                    className="mt-1"
                  />
                  <div>
                    <h5 className="font-bold text-stone-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-[#2563EB]" />
                      <span>متجر جديد فارغ وجاهز لإضافة منتجاتي الخاصة (موصى به)</span>
                    </h5>
                    <p className="text-stone-500 text-[11px] mt-0.5 leading-relaxed">
                      ابدأ بمتجر نقي تماماً وأضف منتجاتك الحقيقية وأسعارك وصورك مباشرة من لوحة التحكم.
                    </p>
                  </div>
                </label>

                <label
                  onClick={() => setStarterCatalogMode('sample')}
                  className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                    starterCatalogMode === 'sample'
                      ? 'border-[#2563EB] bg-blue-50/40 ring-2 ring-[#2563EB]/20'
                      : 'border-stone-200 bg-white hover:bg-stone-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="catalog_mode"
                    checked={starterCatalogMode === 'sample'}
                    onChange={() => setStarterCatalogMode('sample')}
                    className="mt-1"
                  />
                  <div>
                    <h5 className="font-bold text-stone-900 flex items-center gap-1.5">
                      <ShoppingBag className="w-4 h-4 text-amber-500" />
                      <span>إضافة منتجات تجريبية أولية لمعاينة شكل المتجر</span>
                    </h5>
                    <p className="text-stone-500 text-[11px] mt-0.5 leading-relaxed">
                      ينشئ المتجر مع 6 منتجات نموذجية يمكنك تعديلها أو حذفها لاحقاً بنقرة واحدة.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer with Actions */}
        <div className="p-4 sm:p-5 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => {
                setStepError(null);
                setStep((s) => (s - 1) as 1 | 2 | 3);
              }}
              className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>السابق</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-stone-500 hover:text-stone-800 text-xs font-semibold cursor-pointer"
            >
              إلغاء
            </button>
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={handleNextStep}
              className="px-6 py-2.5 bg-[#2563EB] hover:bg-blue-600 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm transition-transform active:scale-95 cursor-pointer"
            >
              <span>التالي</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              className="px-6 py-2.5 bg-[#0F172A] hover:bg-stone-900 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md transition-transform active:scale-95 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-[#86EFAC]" />
              <span>إطلاق المتجر الآن 🚀</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
