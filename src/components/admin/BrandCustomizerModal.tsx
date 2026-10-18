import React, { useState, useEffect } from 'react';
import { StoreSettings, BrandTheme } from '../../types/store';
import { BRAND_PRESETS, MODERN_RETAIL_THEME } from '../../services/storeStorage';
import { injectBrandThemeStyles, loadGoogleFont } from '../../utils/themeInjector';
import { compressImageFile } from '../../utils/imageUploader';
import { 
  Palette, 
  X, 
  Check, 
  Sparkles, 
  Type, 
  Paintbrush, 
  RotateCcw, 
  Layout, 
  SlidersHorizontal,
  Download,
  Upload,
  Trash2
} from 'lucide-react';

interface BrandCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: StoreSettings;
  onSaveSettings: (newSettings: StoreSettings) => void;
  onResetToDefault: () => void;
  onClearAllProducts?: () => void;
}

export const BrandCustomizerModal: React.FC<BrandCustomizerModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onClearAllProducts,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'colors' | 'typography' | 'identity' | 'presets'>('colors');
  const [formData, setFormData] = useState<StoreSettings>({
    ...settings,
    brandTheme: {
      ...MODERN_RETAIL_THEME,
      ...(settings.brandTheme || {}),
    },
  });

  const [customFontInput, setCustomFontInput] = useState(
    formData.brandTheme.customGoogleFont || ''
  );
  const [fontTestMessage, setFontTestMessage] = useState<string | null>(null);
  const [showSavedNotification, setShowSavedNotification] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Live injection whenever brandTheme changes
  useEffect(() => {
    if (formData.brandTheme) {
      injectBrandThemeStyles(formData.brandTheme);
    }
  }, [formData.brandTheme]);

  const handleCloseWithoutSaving = () => {
    // Revert live-injected CSS variables back to the saved settings
    if (settings.brandTheme) {
      injectBrandThemeStyles(settings.brandTheme);
    }
    onClose();
  };

  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const dataUrl = await compressImageFile(file, 400, 400, 0.9);
      setFormData((prev) => ({ ...prev, logoUrl: dataUrl }));
    } catch {
      // Ignore error
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleThemeChange = (key: keyof BrandTheme, value: any) => {
    setFormData((prev) => {
      const updatedTheme = {
        ...prev.brandTheme,
        [key]: value,
      };
      return {
        ...prev,
        brandTheme: updatedTheme,
        primaryColor: key === 'primaryColor' ? value : prev.primaryColor,
        secondaryColor: key === 'accentColor' ? value : prev.secondaryColor,
      };
    });
  };

  const handleSelectFont = (fontFamily: string) => {
    loadGoogleFont(fontFamily);
    handleThemeChange('fontFamily', fontFamily);
  };

  const handleApplyCustomFont = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanFont = customFontInput.trim();
    if (!cleanFont) return;

    loadGoogleFont(cleanFont);
    setFormData((prev) => ({
      ...prev,
      brandTheme: {
        ...prev.brandTheme,
        fontFamily: cleanFont,
        customGoogleFont: cleanFont,
      },
    }));
    setFontTestMessage(`✨ تم تحميل خط "${cleanFont}" وتطبيقه على المتجر بنجاح!`);
    setTimeout(() => setFontTestMessage(null), 3000);
  };

  const handleApplyPreset = (presetTheme: BrandTheme) => {
    setFormData((prev) => ({
      ...prev,
      brandTheme: presetTheme,
      primaryColor: presetTheme.primaryColor,
      secondaryColor: presetTheme.accentColor,
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    injectBrandThemeStyles(formData.brandTheme);
    onSaveSettings(formData);
    setShowSavedNotification(true);
    setTimeout(() => {
      setShowSavedNotification(false);
      onClose();
    }, 700);
  };

  const curatedGoogleFonts = [
    { id: 'Cairo', label: 'Cairo (الخط الافتراضي)', preview: 'تصميم حديث ومتوازن للواجهات العربية' },
    { id: 'Tajawal', label: 'Tajawal (تجوال)', preview: 'خط عربي هندسي نقي ومريح للقراءة في الهواتف' },
    { id: 'Almarai', label: 'Almarai (المراعي)', preview: 'خط عربي معاصر ومثالي للمتاجر الإلكترونية' },
    { id: 'Readex Pro', label: 'Readex Pro (ريدكس برو)', preview: 'خط عصري فائق الوضوح مخصص للمنصات الرقمية' },
    { id: 'Alexandria', label: 'Alexandria (الإسكندرية)', preview: 'خط فاخر مخصص للماركات الراقية والمتاجر الأنيقة' },
    { id: 'IBM Plex Sans Arabic', label: 'IBM Plex Sans Arabic', preview: 'طابع هندسي وتقني احترافي للحلول والبرمجيات' },
    { id: 'Amiri', label: 'Amiri (أميري كلاسيكي)', preview: 'خط عربي نسخ تقليدي فاخر للمنتجات العريقة' },
    { id: 'Poppins', label: 'Poppins (Geometric Latin)', preview: 'Modern Clean Sans Serif for global brands' },
    { id: 'Inter', label: 'Inter (UI Standard)', preview: 'Pixel-perfect typography for modern web apps' },
    { id: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans', preview: 'High-contrast aesthetic modern tech typography' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-stone-950/70 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={handleCloseWithoutSaving} aria-hidden="true" />

      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden z-10 border border-stone-200 my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div 
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-sm"
              style={{ backgroundColor: formData.brandTheme.accentColor }}
            >
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-stone-900">
                استوديو الهوية البصرية وتخصيص المتجر
              </h3>
              <p className="text-xs text-stone-500">
                تحكم كامل في خطوط Google Fonts، ألوان العلامة التجارية، ونمط المتجر
              </p>
            </div>
          </div>

          <button
            onClick={handleCloseWithoutSaving}
            className="w-8 h-8 rounded-full bg-stone-200 text-stone-600 hover:text-stone-900 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigator */}
        <div className="flex items-center gap-1 p-2 bg-stone-100 border-b border-stone-200 text-xs font-bold overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('colors')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'colors'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Paintbrush className="w-3.5 h-3.5" />
            <span>الألوان والتمييز (Accent Colors)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('typography')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'typography'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            <span>خطوط Google Fonts والطباعة</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('identity')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'identity'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Layout className="w-3.5 h-3.5" />
            <span>بيانات المتجر والشعار</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'presets'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>قوالب الهوية الجاهزة</span>
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSave} className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* Live Mini Preview Card (Shown in all tabs for real-time visual feedback) */}
          <div 
            className="p-5 rounded-3xl border transition-all duration-300 shadow-xs"
            style={{ 
              backgroundColor: formData.brandTheme.backgroundColor,
              borderColor: formData.brandTheme.neutralColor,
              fontFamily: formData.brandTheme.fontFamily || 'Cairo',
              borderRadius: `${formData.brandTheme.borderRadius ?? 12}px`
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div 
                  className="w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-sm text-white shadow-xs"
                  style={{ backgroundColor: formData.brandTheme.primaryColor }}
                >
                  {formData.logoLetter || 'S'}
                </div>
                <div>
                  <div className="text-sm font-bold leading-tight" style={{ color: formData.brandTheme.primaryColor }}>
                    {formData.storeName || 'متجر أورورا'}
                  </div>
                  <div className="text-xs opacity-75" style={{ color: formData.brandTheme.textColor }}>
                    {formData.storeSubtitle || 'تشكيلة مختارة بعناية'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span 
                  className="text-[10px] font-bold px-2.5 py-1 rounded-full shadow-xs"
                  style={{ backgroundColor: formData.brandTheme.highlightColor, color: formData.brandTheme.primaryColor }}
                >
                  معاينة حية للمتجر
                </span>
                <span 
                  className="text-[10px] font-bold px-2 py-0.5 rounded-md text-white"
                  style={{ backgroundColor: formData.brandTheme.secondaryAccentColor || formData.brandTheme.accentColor }}
                >
                  Accent
                </span>
              </div>
            </div>

            <p className="text-xs leading-relaxed mb-4" style={{ color: formData.brandTheme.textColor }}>
              {formData.tagline || 'تجربة تسوق عصرية وطلب فوري عبر الواتساب المباشر'}
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1 border-t" style={{ borderColor: formData.brandTheme.neutralColor }}>
              <button
                type="button"
                className="text-xs font-bold px-4 py-2 text-white shadow-xs"
                style={{ 
                  backgroundColor: formData.brandTheme.accentColor,
                  borderRadius: `${formData.brandTheme.borderRadius ?? 12}px`
                }}
              >
                زر الشراء والطلب (Primary CTA)
              </button>

              <button
                type="button"
                className="text-xs font-bold px-3 py-2 text-white shadow-xs"
                style={{ 
                  backgroundColor: formData.brandTheme.secondaryAccentColor || '#FF6B35',
                  borderRadius: `${formData.brandTheme.borderRadius ?? 12}px`
                }}
              >
                تمييز إضافي (Secondary Accent)
              </button>

              <span 
                className="text-xs px-2.5 py-1 font-mono font-bold"
                style={{ color: formData.brandTheme.primaryColor }}
              >
                الخط المطبق: {formData.brandTheme.fontFamily}
              </span>
            </div>
          </div>

          {/* TAB 1: ACCENT & BRAND COLORS */}
          {activeTab === 'colors' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Primary Brand Color */}
                <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
                  <label className="font-bold text-stone-800 flex items-center justify-between">
                    <span>اللون الأساسي (Primary Color)</span>
                    <span className="font-mono text-stone-500">{formData.brandTheme.primaryColor}</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.brandTheme.primaryColor}
                      onChange={(e) => handleThemeChange('primaryColor', e.target.value)}
                      className="w-10 h-10 rounded-xl border border-stone-300 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={formData.brandTheme.primaryColor}
                      onChange={(e) => handleThemeChange('primaryColor', e.target.value)}
                      className="flex-1 px-3 py-2 bg-white border border-stone-200 rounded-xl font-mono text-xs uppercase"
                    />
                  </div>
                  <p className="text-[11px] text-stone-500">يُستخدم للشعار، العناوين، وشريط المتجر العلوي (#0B253F)</p>
                </div>

                {/* Primary Action Accent Color */}
                <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
                  <label className="font-bold text-stone-800 flex items-center justify-between">
                    <span>لون التفاعل والأزرار (Primary Action Accent)</span>
                    <span className="font-mono text-stone-500">{formData.brandTheme.accentColor}</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.brandTheme.accentColor}
                      onChange={(e) => handleThemeChange('accentColor', e.target.value)}
                      className="w-10 h-10 rounded-xl border border-stone-300 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={formData.brandTheme.accentColor}
                      onChange={(e) => handleThemeChange('accentColor', e.target.value)}
                      className="flex-1 px-3 py-2 bg-white border border-stone-200 rounded-xl font-mono text-xs uppercase"
                    />
                  </div>
                  <p className="text-[11px] text-stone-500">لون أزرار الإضافة للسلة والطلب الفوري (#0077FF)</p>
                </div>

                {/* Brand-Specific Secondary Accent Color */}
                <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
                  <label className="font-bold text-stone-800 flex items-center justify-between">
                    <span>لون تمييز إضافي خاص بالبراند (Secondary Accent)</span>
                    <span className="font-mono text-stone-500">
                      {formData.brandTheme.secondaryAccentColor || formData.brandTheme.accentColor}
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.brandTheme.secondaryAccentColor || formData.brandTheme.accentColor}
                      onChange={(e) => handleThemeChange('secondaryAccentColor', e.target.value)}
                      className="w-10 h-10 rounded-xl border border-stone-300 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={formData.brandTheme.secondaryAccentColor || formData.brandTheme.accentColor}
                      onChange={(e) => handleThemeChange('secondaryAccentColor', e.target.value)}
                      className="flex-1 px-3 py-2 bg-white border border-stone-200 rounded-xl font-mono text-xs uppercase"
                    />
                  </div>
                  <p className="text-[11px] text-stone-500">لون ناري أو مكمل للإعلانات والخيارات المميزة</p>
                </div>

                {/* Highlight Mint/Success Color */}
                <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
                  <label className="font-bold text-stone-800 flex items-center justify-between">
                    <span>لون التميز والتأكيد (Highlight & Badges)</span>
                    <span className="font-mono text-stone-500">{formData.brandTheme.highlightColor}</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.brandTheme.highlightColor}
                      onChange={(e) => handleThemeChange('highlightColor', e.target.value)}
                      className="w-10 h-10 rounded-xl border border-stone-300 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={formData.brandTheme.highlightColor}
                      onChange={(e) => handleThemeChange('highlightColor', e.target.value)}
                      className="flex-1 px-3 py-2 bg-white border border-stone-200 rounded-xl font-mono text-xs uppercase"
                    />
                  </div>
                  <p className="text-[11px] text-stone-500">شارات الخصومات والتأكيد الأخضر النعناعي (#A5F3B6)</p>
                </div>

                {/* Background Color */}
                <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
                  <label className="font-bold text-stone-800 flex items-center justify-between">
                    <span>لون خلفية الموقع (Light Theme)</span>
                    <span className="font-mono text-stone-500">{formData.brandTheme.backgroundColor}</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.brandTheme.backgroundColor}
                      onChange={(e) => handleThemeChange('backgroundColor', e.target.value)}
                      className="w-10 h-10 rounded-xl border border-stone-300 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={formData.brandTheme.backgroundColor}
                      onChange={(e) => handleThemeChange('backgroundColor', e.target.value)}
                      className="flex-1 px-3 py-2 bg-white border border-stone-200 rounded-xl font-mono text-xs uppercase"
                    />
                  </div>
                  <p className="text-[11px] text-stone-500">الافتراضي: #F8FAFC (أبيض نقي مريح للعين)</p>
                </div>

                {/* Neutral Borders & Card Border */}
                <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
                  <label className="font-bold text-stone-800 flex items-center justify-between">
                    <span>لون الحدود والبطاقات (Neutral Border)</span>
                    <span className="font-mono text-stone-500">{formData.brandTheme.neutralColor}</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.brandTheme.neutralColor}
                      onChange={(e) => handleThemeChange('neutralColor', e.target.value)}
                      className="w-10 h-10 rounded-xl border border-stone-300 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={formData.brandTheme.neutralColor}
                      onChange={(e) => handleThemeChange('neutralColor', e.target.value)}
                      className="flex-1 px-3 py-2 bg-white border border-stone-200 rounded-xl font-mono text-xs uppercase"
                    />
                  </div>
                  <p className="text-[11px] text-stone-500">الافتراضي: #E4E7EB (رمادي ناعم)</p>
                </div>
              </div>

              {/* Border Radius Range Slider */}
              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-stone-800">
                  <div className="flex items-center gap-1.5">
                    <SlidersHorizontal className="w-4 h-4 text-stone-500" />
                    <span>درجة استدارة الحواف والأزرار (Border Radius)</span>
                  </div>
                  <span className="font-mono text-[#0077FF]">{formData.brandTheme.borderRadius ?? 12}px</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="28"
                  step="2"
                  value={formData.brandTheme.borderRadius ?? 12}
                  onChange={(e) => handleThemeChange('borderRadius', Number(e.target.value))}
                  className="w-full accent-[#0077FF] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-stone-400">
                  <span>مربع حاد (4px)</span>
                  <span>متناسق (12px)</span>
                  <span>دائري عصري (28px)</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GOOGLE FONTS & TYPOGRAPHY */}
          {activeTab === 'typography' && (
            <div className="space-y-6">
              {/* Custom Google Font Loader Input */}
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[#0B253F]">
                  <Download className="w-4 h-4 text-[#0077FF]" />
                  <span>تثبيت أي خط من Google Fonts بالاسم مباشرة:</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={customFontInput}
                    onChange={(e) => setCustomFontInput(e.target.value)}
                    placeholder="مثال: Noto Kufi Arabic أو Rubik أو Changa أو Montserrat..."
                    className="flex-1 px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#0077FF]/30 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => handleApplyCustomFont()}
                    className="px-4 py-2.5 bg-[#0077FF] hover:bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0"
                  >
                    <span>تحميل ومعاينة الخط الفوري</span>
                  </button>
                </div>
                {fontTestMessage && (
                  <p className="text-xs font-bold text-emerald-700 animate-in fade-in">{fontTestMessage}</p>
                )}
                <p className="text-[11px] text-stone-500">
                  💡 يمكنك إدخال اسم أي عائلة خطوط من مكتبة Google Fonts الرسمية، وسيتم حقنها وتطبيقها فوراً في الموقع.
                </p>
              </div>

              {/* Curated Google Fonts List */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <Type className="w-4 h-4 text-stone-500" />
                  <span>أو اختاري من الخطوط العربية والعالمية الأكثر شهرة:</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {curatedGoogleFonts.map((f) => {
                    const isSelected = formData.brandTheme.fontFamily === f.id;
                    return (
                      <div
                        key={f.id}
                        onClick={() => handleSelectFont(f.id)}
                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-[#0077FF] bg-blue-50/60 ring-2 ring-blue-500/20 shadow-xs'
                            : 'border-stone-200 bg-white hover:bg-stone-50'
                        }`}
                        style={{ fontFamily: f.id }}
                      >
                        <div className="flex items-center justify-between text-xs font-bold text-stone-900 mb-1">
                          <span>{f.label}</span>
                          {isSelected && <Check className="w-4 h-4 text-[#0077FF] shrink-0" />}
                        </div>
                        <p className="text-[11px] text-stone-500 leading-relaxed">{f.preview}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: STORE IDENTITY & DETAILS */}
          {activeTab === 'identity' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">اسم المتجر / العلامة</label>
                  <input
                    type="text"
                    required
                    value={formData.storeName}
                    onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                    placeholder="مثال: أورورا ريتيل"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-800 mb-1">اسم المالك / العنوان الفرعي</label>
                  <input
                    type="text"
                    value={formData.storeSubtitle || ''}
                    onChange={(e) => setFormData({ ...formData, storeSubtitle: e.target.value })}
                    placeholder="مثال: تشكيلة حصرية منتقاة بعناية"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl"
                  />
                </div>
              </div>

              {/* Store Logo Uploader */}
              <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-base text-white shadow-xs overflow-hidden shrink-0 border border-stone-200"
                    style={{ backgroundColor: formData.logoUrl ? '#FFFFFF' : formData.brandTheme.primaryColor }}
                  >
                    {formData.logoUrl ? (
                      <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                    ) : (
                      <span>{formData.logoLetter || 'S'}</span>
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-stone-800">شعار المتجر المصور (Logo Image)</div>
                    <p className="text-[11px] text-stone-500">ارفع شعار نشاطك التجاري من جهازك أو اترك حرف الشعار</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="px-3 py-2 bg-white hover:bg-stone-100 border border-stone-200 rounded-xl text-xs font-bold text-stone-700 flex items-center gap-1.5 cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>{uploadingLogo ? 'جاري الضغط...' : 'رفع صورة الشعار'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoFileUpload}
                      className="hidden"
                    />
                  </label>
                  {formData.logoUrl && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, logoUrl: '' })}
                      className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl cursor-pointer"
                      title="حذف الشعار المصور"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">حرف الشعار البديل (Monogram)</label>
                  <input
                    type="text"
                    maxLength={3}
                    value={formData.logoLetter || 'S'}
                    onChange={(e) => setFormData({ ...formData, logoLetter: e.target.value })}
                    placeholder="S"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-center font-bold text-base uppercase"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-800 mb-1">عملة المتجر</label>
                  <input
                    type="text"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    placeholder="USD أو ر.س"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-800 mb-1">رقم الواتساب للطلبات المباشرة</label>
                  <input
                    type="text"
                    value={formData.whatsappNumber}
                    onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                    placeholder="966500000000"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-800 mb-1">الوصف المختصر (Tagline)</label>
                <input
                  type="text"
                  value={formData.tagline}
                  onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                  placeholder="تجربة تسوق عصرية وطلب فوري عبر الواتساب"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-800 mb-1">عنوان البانر الرئيسي (Hero Title)</label>
                <input
                  type="text"
                  value={formData.heroTitle || ''}
                  onChange={(e) => setFormData({ ...formData, heroTitle: e.target.value })}
                  placeholder="مثال: أناقة عصرية وتجربة تسوق استثنائية"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-800 mb-1">شريط الإعلانات أعلى الصفحة</label>
                <input
                  type="text"
                  value={formData.announcementText}
                  onChange={(e) => setFormData({ ...formData, announcementText: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl"
                />
              </div>
            </div>
          )}

          {/* TAB 4: PRESETS */}
          {activeTab === 'presets' && (
            <div className="space-y-4">
              <p className="text-xs text-stone-600">
                اختر أحد النماذج الجاهزة لتطبيق هويتها اللونية ونمطها فورياً بضغطة زر واحدة:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {BRAND_PRESETS.map((preset) => {
                  const isCurrent =
                    formData.brandTheme.primaryColor === preset.theme.primaryColor &&
                    formData.brandTheme.accentColor === preset.theme.accentColor;

                  return (
                    <div
                      key={preset.id}
                      onClick={() => handleApplyPreset(preset.theme)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                        isCurrent
                          ? 'border-[#0077FF] bg-blue-50/40 ring-2 ring-blue-500/20 shadow-xs'
                          : 'border-stone-200 bg-white hover:bg-stone-50'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs font-bold text-stone-900 mb-1">
                          <span>{preset.name}</span>
                          {isCurrent && (
                            <span className="bg-[#0077FF] text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                              مفعّل
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-stone-500 leading-snug">{preset.description}</p>
                      </div>

                      {/* Color swatches */}
                      <div className="flex items-center gap-1.5 pt-2 border-t border-stone-100">
                        <span
                          className="w-6 h-6 rounded-md shadow-xs border"
                          style={{ backgroundColor: preset.theme.backgroundColor }}
                          title="خلفية"
                        />
                        <span
                          className="w-6 h-6 rounded-md shadow-xs"
                          style={{ backgroundColor: preset.theme.primaryColor }}
                          title="رئيسي"
                        />
                        <span
                          className="w-6 h-6 rounded-md shadow-xs"
                          style={{ backgroundColor: preset.theme.accentColor }}
                          title="تفاعل"
                        />
                        <span
                          className="w-6 h-6 rounded-md shadow-xs"
                          style={{ backgroundColor: preset.theme.highlightColor }}
                          title="تمييز"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reset Theme Colors ONLY (Preserves Store Name & Contact Details) */}
              <div className="pt-4 border-t border-stone-200 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleApplyPreset(MODERN_RETAIL_THEME);
                  }}
                  className="px-3.5 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>استعادة ألوان وخطوط النمط الافتراضي (مع الحفاظ على بيانات متجرك)</span>
                </button>

                {onClearAllProducts && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('هل ترغب في تفريغ المتجر للبدء بمتجر فارغ تماماً وإضافة منتجاتك الخاصة؟')) {
                        onClearAllProducts();
                        onClose();
                      }
                    }}
                    className="px-3 py-2 text-xs font-semibold text-stone-600 hover:text-red-600 rounded-xl transition-colors cursor-pointer"
                  >
                    تفريغ المنتجات للبدء من الصفر
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Footer Submit */}
          <div className="pt-4 border-t border-stone-200 flex items-center justify-between">
            <span className="text-xs text-stone-500">
              💡 التعديلات تُحقن فورياً في أنماط المتجر للمعاينة المباشرة.
            </span>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCloseWithoutSaving}
                className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                إلغاء
              </button>

              <button
                type="submit"
                className="px-6 py-2.5 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                style={{ backgroundColor: formData.brandTheme.accentColor }}
              >
                {showSavedNotification ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>تم الحفظ والتطبيق!</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-white" />
                    <span>تطبيق وحفظ الهوية للمتجر</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
