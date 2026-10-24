import React from 'react';
import { MerchantUser, StoreInstance } from '../../types/store';
import { 
  Store, 
  Sparkles, 
  Zap, 
  ShieldCheck, 
  MessageCircle, 
  Palette, 
  ArrowLeft, 
  LogIn, 
  LayoutDashboard, 
  CheckCircle2, 
  Globe, 
  ShoppingBag,
  Smartphone,
  Truck
} from 'lucide-react';

interface SaaSLandingPageProps {
  currentUser: MerchantUser | null;
  merchantStores: StoreInstance[];
  onStartCreateStore: () => void;
  onOpenAuth: () => void;
  onOpenDashboard: () => void;
  onPreviewDemoStore: () => void;
  onOpenCaptainPortal?: () => void;
}

export const SaaSLandingPage: React.FC<SaaSLandingPageProps> = ({
  currentUser,
  merchantStores,
  onStartCreateStore,
  onOpenAuth,
  onOpenDashboard,
  onPreviewDemoStore,
  onOpenCaptainPortal,
}) => {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans" dir="rtl">
      {/* Top SaaS Navigation */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0F172A] text-white flex items-center justify-center font-black text-lg shadow-sm">
              <Zap className="w-5 h-5 text-[#86EFAC]" />
            </div>
            <div>
              <span className="text-lg font-black tracking-tight text-[#0F172A] block leading-none">
                Quick E-Commerce
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                منصة إطلاق المتاجر الإلكترونية السريعة
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {onOpenCaptainPortal && (
              <button
                onClick={onOpenCaptainPortal}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer"
              >
                <Truck className="w-3.5 h-3.5 text-emerald-600" />
                <span>دخول الكباتن 🚗</span>
              </button>
            )}

            <button
              onClick={onPreviewDemoStore}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />
              <span>معاينة المتجر</span>
            </button>

            {currentUser ? (
              <button
                onClick={onOpenDashboard}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#2563EB] hover:bg-blue-600 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>لوحة تحكم متجرك</span>
              </button>
            ) : (
              <>
                <button
                  onClick={onOpenAuth}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  <LogIn className="w-4 h-4 text-slate-500" />
                  <span>دخول التجار</span>
                </button>
                <button
                  onClick={onStartCreateStore}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-[#0F172A] hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                  <span>ابدأ متجرك مجاناً</span>
                  <ArrowLeft className="w-4 h-4 text-[#86EFAC]" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-[#2563EB] text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>أسرع منصة لإطلاق متجرك الإلكتروني المتكامل بدون خبرة برمجية</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-[#0F172A] leading-tight">
              أنشئ متجرك الإلكتروني بهويتك الخاصة{' '}
              <span className="text-[#2563EB]">في أقل من 30 ثانية</span>
            </h1>

            <p className="text-sm sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              صمم واجهة متجرك، أضف منتجاتك وأسعارك، واحصل فوراً على رابط متجر مستقل لعملائك مع استقبال الطلبات مباشرة عبر الواتساب ولوحة التحكم السحابية.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-4">
              <button
                onClick={onStartCreateStore}
                className="w-full sm:w-auto px-8 py-4 bg-[#2563EB] hover:bg-blue-600 text-white rounded-2xl text-sm sm:text-base font-bold shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2.5 transition-all active:scale-95 cursor-pointer"
              >
                <Store className="w-5 h-5" />
                <span>{currentUser && merchantStores.length > 0 ? 'إنشاء متجر جديد آخر' : 'أنشئ متجرك الإلكتروني الآن'}</span>
                <ArrowLeft className="w-4 h-4" />
              </button>

              {currentUser && merchantStores.length > 0 ? (
                <button
                  onClick={onOpenDashboard}
                  className="w-full sm:w-auto px-7 py-4 bg-white hover:bg-slate-50 text-[#0F172A] border border-slate-200 rounded-2xl text-sm sm:text-base font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <LayoutDashboard className="w-5 h-5 text-[#2563EB]" />
                  <span>إدارة متجرك الحالي ({merchantStores[0].settings.storeName})</span>
                </button>
              ) : (
                <button
                  onClick={onPreviewDemoStore}
                  className="w-full sm:w-auto px-7 py-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-2xl text-sm sm:text-base font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <ShoppingBag className="w-5 h-5 text-amber-500" />
                  <span>تجربة متجر نموذجي كزائر</span>
                </button>
              )}
            </div>

            {/* Delivery Captain Direct Gateway */}
            {onOpenCaptainPortal && (
              <div className="pt-4 max-w-xl mx-auto">
                <button
                  type="button"
                  onClick={onOpenCaptainPortal}
                  className="w-full p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 text-right flex items-center justify-between gap-3 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-emerald-950">
                          بوابة كباتن التوصيل | سجل واربح معنا
                        </span>
                        <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full font-bold">
                          انضم الآن 🚗
                        </span>
                      </div>
                      <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                        استلم طلبات متاجر منطقتك، سلّم الشحنات للعملاء، وحصّل أرباحك اليومية مع المنصة مباشرة.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-bold text-emerald-700 shrink-0 group-hover:-translate-x-1 transition-transform">
                    <span>تسجيل ودخول</span>
                    <ArrowLeft className="w-4 h-4" />
                  </div>
                </button>
              </div>
            )}

            <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                بدون عمولة على المبيعات
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                رابط مستقل ونقي لعملائك
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                طلبات فورية على الواتساب ولوحة التحكم
              </span>
            </div>
          </div>
        </section>

        {/* How It Works (3 Simple Steps) */}
        <section className="py-12 bg-white border-y border-slate-200/80 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto space-y-10">
            <div className="text-center space-y-2">
              <h2 className="text-xl sm:text-2xl font-black text-[#0F172A]">
                كيف يعمل Quick E-Commerce؟
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                ثلاث خطوات بسيطة تفصلك عن استقبال أول طلب من عملائك
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white font-black text-base flex items-center justify-center shadow-sm">
                  1
                </div>
                <h3 className="text-base font-bold text-[#0F172A]">أعدّ اسم المتجر والهوية البصرية</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  اختر اسم نشاطك التجاري، العملة، رقم الواتساب لاستقبال الطلبات، وخصص ألوان علامتك التجارية والخطوط بنقرة واحدة.
                </p>
              </div>

              <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white font-black text-base flex items-center justify-center shadow-sm">
                  2
                </div>
                <h3 className="text-base font-bold text-[#0F172A]">أضف منتجاتك وأسعارك بسهولة</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  من خلال لوحة تحكم التاجر المبسطة، أضف صور المنتجات، الأقسام، الخيارات أو المقاسات، وحدد رسوم الشحن والسياسات.
                </p>
              </div>

              <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white font-black text-base flex items-center justify-center shadow-sm">
                  3
                </div>
                <h3 className="text-base font-bold text-[#0F172A]">شارك رابط متجرك واستقبل الطلبات</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  انسخ رابط متجرك الخاص وضعه في بايو إنستغرام أو تيك توك. سيرى زوارك متجرك النقي فقط بدون أي أدوات إدارة.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Core Platform Features */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center">
                <Palette className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-sm text-[#0F172A]">تخصيص كامل للهوية</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                تحكم في ألوان المتجر، الشعار، وخطوط Google Fonts العربية لتطابق علامتك التجارية.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <MessageCircle className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-sm text-[#0F172A]">فواتير واتساب ذكية</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                توليد فاتورة طلب مفصلة تلقائياً وإرسالها لواتساب التاجر مع حفظ الطلب في لوحة التحكم.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Smartphone className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-sm text-[#0F172A]">مصمم للهاتف أولاً</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                تجربة تسوق سريعة وسلسة لعملائك على الهواتف الذكية مع تتبع فوري لحالة الشحنة.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-sm text-[#0F172A]">عزل وأمان سحابي تام</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                بيانات عملائك وطلباتك محمية ومرتبطة بحسابك فقط، ولا يظهر لزوارك سوى واجهة متجرك.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* SaaS Footer */}
      <footer className="bg-[#0F172A] text-slate-400 py-8 px-4 sm:px-6 lg:px-8 border-t border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#86EFAC]" />
            <span className="font-bold text-white">Quick E-Commerce SaaS</span>
            <span>— منصة بناء المتاجر الإلكترونية السريعة</span>
          </div>
          <div>
            © {new Date().getFullYear()} جميع الحقوق محفوظة.
          </div>
        </div>
      </footer>
    </div>
  );
};
