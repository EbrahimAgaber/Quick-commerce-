import React, { useState } from 'react';
import { 
  Globe, 
  Flame, 
  Triangle, 
  Cloud, 
  Github, 
  Check, 
  Copy, 
  Terminal, 
  ExternalLink, 
  X, 
  ShieldCheck, 
  Sparkles,
  Zap,
  HardDrive,
  Download
} from 'lucide-react';

interface FreeHostingModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeName: string;
}

type HostingTab = 'firebase' | 'vercel' | 'cloudflare' | 'netlify';

export const FreeHostingModal: React.FC<FreeHostingModalProps> = ({
  isOpen,
  onClose,
  storeName,
}) => {
  const [activeTab, setActiveTab] = useState<HostingTab>('firebase');
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-stone-950/70 backdrop-blur-xs font-sans" dir="rtl">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden z-10 border border-stone-200 my-auto p-5 sm:p-7 space-y-6 animate-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              <Globe className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-stone-900">
                  دليل النشر والاستضافة المجانية 100%
                </h3>
                <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                  Free of Charge
                </span>
              </div>
              <p className="text-xs text-stone-500">
                خيارات استضافة سريعة ومجانية تماماً لمتجر "{storeName}" مع شهادة SSL مجانية ونطاق خاص
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 hover:text-stone-900 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Platform Selection Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            onClick={() => setActiveTab('firebase')}
            className={`p-3 rounded-2xl border text-right transition-all cursor-pointer ${
              activeTab === 'firebase'
                ? 'border-amber-500 bg-amber-50/50 shadow-xs ring-1 ring-amber-500/20'
                : 'border-stone-200 hover:border-stone-300 bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <Flame className="w-5 h-5 text-amber-500" />
              <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">الأفضل</span>
            </div>
            <div className="font-bold text-xs text-stone-900">Firebase Hosting</div>
            <div className="text-[10px] text-stone-500">مربوط بمشروعك الحالي</div>
          </button>

          <button
            onClick={() => setActiveTab('vercel')}
            className={`p-3 rounded-2xl border text-right transition-all cursor-pointer ${
              activeTab === 'vercel'
                ? 'border-black bg-stone-50 shadow-xs ring-1 ring-black/20'
                : 'border-stone-200 hover:border-stone-300 bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <Triangle className="w-5 h-5 text-black" />
              <span className="text-[10px] bg-stone-200 text-stone-800 font-bold px-1.5 py-0.5 rounded">بنقرة واحدة</span>
            </div>
            <div className="font-bold text-xs text-stone-900">Vercel</div>
            <div className="text-[10px] text-stone-500">نشر فوري عبر GitHub</div>
          </button>

          <button
            onClick={() => setActiveTab('cloudflare')}
            className={`p-3 rounded-2xl border text-right transition-all cursor-pointer ${
              activeTab === 'cloudflare'
                ? 'border-orange-500 bg-orange-50/50 shadow-xs ring-1 ring-orange-500/20'
                : 'border-stone-200 hover:border-stone-300 bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <Cloud className="w-5 h-5 text-orange-500" />
              <span className="text-[10px] bg-orange-100 text-orange-800 font-bold px-1.5 py-0.5 rounded">غير محدود</span>
            </div>
            <div className="font-bold text-xs text-stone-900">Cloudflare Pages</div>
            <div className="text-[10px] text-stone-500">سعة وباندويث لا نهائي</div>
          </button>

          <button
            onClick={() => setActiveTab('netlify')}
            className={`p-3 rounded-2xl border text-right transition-all cursor-pointer ${
              activeTab === 'netlify'
                ? 'border-teal-500 bg-teal-50/50 shadow-xs ring-1 ring-teal-500/20'
                : 'border-stone-200 hover:border-stone-300 bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <HardDrive className="w-5 h-5 text-teal-600" />
              <span className="text-[10px] bg-teal-100 text-teal-800 font-bold px-1.5 py-0.5 rounded">سحب وإفلات</span>
            </div>
            <div className="font-bold text-xs text-stone-900">Netlify Drop</div>
            <div className="text-[10px] text-stone-500">رفع مجلد dist مباشرة</div>
          </button>
        </div>

        {/* Tab 1: Firebase Hosting (RECOMMENDED) */}
        {activeTab === 'firebase' && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl text-amber-900 flex items-start gap-3">
              <Flame className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-sm">لماذا يعتبر Firebase Hosting الخيار الأمثل لمتجرك؟</div>
                <p className="text-amber-800 leading-relaxed text-xs">
                  هذا التطبيق متصل بالفعل بمشروع Google Firebase الخاص بك (المعرف: <code>impressive-toolbox-3lcf1</code>) المربوط بقاعدة بيانات Firestore والمصادقة. يمكنك إطلاق موقعك مجاناً فوراً على نفس الخوادم السحابية بنقرة واحدة وبدون أي تكاليف شهرية!
                </p>
                <div className="flex flex-wrap gap-3 pt-1 text-[11px] font-bold text-amber-900">
                  <span>✓ مساحة 10GB مجاناً</span>
                  <span>✓ 360MB نقل بيانات يومياً</span>
                  <span>✓ شهادة أمان SSL مجانية</span>
                  <span>✓ ربط نطاق مخصص مجاناً (.com / .sa)</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-stone-900 text-sm">خطوات النشر على Firebase Hosting (خلال دقيقة واحدة):</h4>
              
              {/* Step 1 */}
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-stone-800">1. تسجيل الدخول إلى Firebase CLI:</span>
                  <button
                    onClick={() => handleCopy('npx firebase login', 'fb-1')}
                    className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                  >
                    {copiedIndex === 'fb-1' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedIndex === 'fb-1' ? 'تم النسخ!' : 'نسخ الأمر'}</span>
                  </button>
                </div>
                <pre className="p-2.5 bg-slate-900 text-emerald-400 rounded-lg font-mono text-[11px] overflow-x-auto text-left" dir="ltr">
                  npx firebase login
                </pre>
              </div>

              {/* Step 2 */}
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-stone-800">2. بناء ونشر المتجر مباشرة (تم إعداد ملف firebase.json مسبقاً):</span>
                  <button
                    onClick={() => handleCopy('npm run deploy:firebase', 'fb-2')}
                    className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                  >
                    {copiedIndex === 'fb-2' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedIndex === 'fb-2' ? 'تم النسخ!' : 'نسخ الأمر'}</span>
                  </button>
                </div>
                <pre className="p-2.5 bg-slate-900 text-emerald-400 rounded-lg font-mono text-[11px] overflow-x-auto text-left" dir="ltr">
                  npm run deploy:firebase
                </pre>
              </div>

              {/* Step 3 */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-emerald-900 flex items-center justify-between">
                <div>
                  <span className="font-bold">رابط متجرك المباشر بعد النشر:</span>
                  <div className="font-mono text-xs text-emerald-700 mt-0.5" dir="ltr">
                    https://impressive-toolbox-3lcf1.web.app
                  </div>
                </div>
                <a
                  href="https://console.firebase.google.com/project/impressive-toolbox-3lcf1/hosting"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 transition-colors"
                >
                  <span>لوحة تحكم Firebase</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Vercel */}
        {activeTab === 'vercel' && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-stone-100 border border-stone-300 rounded-2xl text-stone-900 flex items-start gap-3">
              <Triangle className="w-5 h-5 text-black shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-sm">استضافة Vercel (الأسهل والأسرع للتطبيقات الحديثة)</div>
                <p className="text-stone-700 leading-relaxed text-xs">
                  توفر Vercel استضافة سريعة مجانية 100% مع 100GB باندويث شهرياً ونطاق فرعي فوري <code>.vercel.app</code> وشهادة SSL مجانية. تم إنشاء ملف <code>vercel.json</code> وضبط التوجيه تلقائياً في المشروع.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-stone-900 text-sm">طرق النشر على Vercel:</h4>

              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-stone-800">الطريقة الأولى: النشر المباشر عبر الطرفية (CLI):</span>
                  <button
                    onClick={() => handleCopy('npm run deploy:vercel', 'vc-1')}
                    className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                  >
                    {copiedIndex === 'vc-1' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedIndex === 'vc-1' ? 'تم النسخ!' : 'نسخ الأمر'}</span>
                  </button>
                </div>
                <pre className="p-2.5 bg-slate-900 text-emerald-400 rounded-lg font-mono text-[11px] overflow-x-auto text-left" dir="ltr">
                  npm run deploy:vercel
                </pre>
              </div>

              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1 text-stone-700 leading-relaxed">
                <span className="font-bold text-stone-800 block">الطريقة الثانية: الربط مع مستودع GitHub:</span>
                <p>1. ارفع الكود إلى مستودع GitHub خاص بك.</p>
                <p>2. توجه إلى <a href="https://vercel.com/new" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-bold underline">vercel.com/new</a> واختر المستودع.</p>
                <p>3. اضغط على Deploy وسيتم بناء ونشر الموقع خلال 30 ثانية مع تحديثات تلقائية عند كل Push.</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Cloudflare Pages */}
        {activeTab === 'cloudflare' && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-orange-50/70 border border-orange-200 rounded-2xl text-orange-900 flex items-start gap-3">
              <Cloud className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-sm">Cloudflare Pages (سعة غير محدودة وأسرع شبكة خوادم عالمية)</div>
                <p className="text-orange-800 leading-relaxed text-xs">
                  أقوى منصة استضافة مجانية للمتاجر ذات الزيارات العالية، لأنها تقدم **باندويث غير محدود مجاناً 100%** مع حماية مجانية من هجمات DDoS وشبكة موزعة على أكثر من 300 مدينة حول العالم.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-stone-900 text-sm">خطوات الاستضافة على Cloudflare Pages:</h4>
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                <p className="text-stone-700">1. قم ببناء ملفات الإنتاج في مجلد <code>dist</code> عبر الأمر:</p>
                <pre className="p-2.5 bg-slate-900 text-emerald-400 rounded-lg font-mono text-[11px] overflow-x-auto text-left" dir="ltr">
                  npm run build
                </pre>
                <p className="text-stone-700 mt-2">2. ادخل إلى <a href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer" className="text-orange-600 font-bold underline">Cloudflare Dashboard</a> &gt; Pages &gt; Create a project.</p>
                <p className="text-stone-700">3. اختر "Direct Upload" واسحب مجلد <code>dist</code> أو اربط مستودع GitHub. (تم تضمين ملف <code>_redirects</code> لضمان عمل كافة الروابط).</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Netlify Drop */}
        {activeTab === 'netlify' && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-teal-50/70 border border-teal-200 rounded-2xl text-teal-900 flex items-start gap-3">
              <HardDrive className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-sm">Netlify Drop (السحب والإفلات الأبسط بدون أي أوامر برمجية)</div>
                <p className="text-teal-800 leading-relaxed text-xs">
                  إذا كنت لا ترغب في كتابة أي أوامر في الطرفية، تتيح لك Netlify رفع مجلد الموقع المترجم (<code>dist</code>) بالسحب والإفلات فقط، وسيعمل متجرك مباشرة بنطاق فرعي وشهادة SSL مجاناً.
                </p>
              </div>
            </div>

            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
              <p className="text-stone-700">1. شغل أمر البناء الإنتاجي:</p>
              <pre className="p-2.5 bg-slate-900 text-emerald-400 rounded-lg font-mono text-[11px] overflow-x-auto text-left" dir="ltr">
                npm run build
              </pre>
              <p className="text-stone-700 mt-2">2. افتح موقع <a href="https://app.netlify.com/drop" target="_blank" rel="noopener noreferrer" className="text-teal-600 font-bold underline">app.netlify.com/drop</a> في متصفحك.</p>
              <p className="text-stone-700">3. اسحب مجلد <code>dist</code> الناتج إلى الصفحة، وسيبدأ موقعك بالعمل فوراً في ثوانٍ معدودة مجاناً!</p>
            </div>
          </div>
        )}

        {/* Summary Footer */}
        <div className="border-t border-stone-100 pt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-stone-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>كافة ملفات التكوين (firebase.json / vercel.json / _redirects) مهيأة وجاهزة بالكامل</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            حسناً، فهمت
          </button>
        </div>
      </div>
    </div>
  );
};
