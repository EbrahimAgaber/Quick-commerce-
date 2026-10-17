import React, { useState } from 'react';
import { generateGoogleAppsScriptCode, fetchFromLiveGoogleSheet } from '../../services/appsScriptBridge';
import { StoreSettings, Product, StorePolicy } from '../../types/store';
import { 
  Code2, 
  Copy, 
  Check, 
  ExternalLink, 
  Play, 
  Radio, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle,
  FileSpreadsheet,
  Link2,
  RefreshCw
} from 'lucide-react';

interface AppsScriptHubProps {
  settings: StoreSettings;
  onUpdateSettings: (s: StoreSettings) => void;
  onSyncLiveData: (data: {
    settings?: Partial<StoreSettings>;
    products?: Product[];
    policies?: StorePolicy[];
  }) => void;
}

export const AppsScriptHub: React.FC<AppsScriptHubProps> = ({
  settings,
  onUpdateSettings,
  onSyncLiveData,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [webAppUrl, setWebAppUrl] = useState(settings.googleWebAppUrl || '');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: 'idle' | 'success' | 'error';
    message?: string;
    details?: any;
  }>({ status: 'idle' });

  const scriptCode = generateGoogleAppsScriptCode();

  const handleCopyCode = () => {
    navigator.clipboard.writeText(scriptCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleSaveAndTestUrl = async () => {
    if (!webAppUrl.trim()) {
      setTestResult({
        status: 'error',
        message: 'يرجى إدخال رابط Web App صالح ينتهي بـ /exec',
      });
      return;
    }

    setIsTesting(true);
    setTestResult({ status: 'idle' });
    const startTime = performance.now();

    try {
      const result = await fetchFromLiveGoogleSheet(webAppUrl.trim());
      const latencyMs = Math.round(performance.now() - startTime);

      if (result.success && result.data) {
        // Save URL in settings
        onUpdateSettings({
          ...settings,
          googleWebAppUrl: webAppUrl.trim(),
        });

        // Sync live data
        onSyncLiveData(result.data);

        setTestResult({
          status: 'success',
          message: 'تم التحقق من أذونات CORS والاتصال بنجاح بـ Google Apps Script وسحب البيانات الحية!',
          details: {
            productsFound: result.data.products?.length || 0,
            hasSettings: !!result.data.settings,
            latencyMs,
            corsStatus: 'Pass (Allowed for all origins)',
          },
        });
      } else {
        setTestResult({
          status: 'error',
          message: result.error || 'تعذر الاتصال بـ Web App. يرجى التأكد من اختيار Anyone في صلاحية الوصول لتفادي حظر CORS.',
          details: {
            latencyMs: Math.round(performance.now() - startTime),
            corsStatus: 'Fail (Likely blocked by Google Login redirect or missing Anyone permission)',
          },
        });
      }
    } catch (err: any) {
      setTestResult({
        status: 'error',
        message: err.message || 'خطأ أثناء الاتصال بالرابط',
        details: {
          latencyMs: Math.round(performance.now() - startTime),
          corsStatus: 'Blocked by origin policy or invalid endpoint',
        },
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Overview Card */}
      <div className="bg-gradient-to-r from-stone-900 to-stone-800 text-white rounded-3xl p-6 sm:p-8 border border-stone-800 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
          <Code2 className="w-4 h-4" />
          <span>Developed by Ebrahim · Google Sheets Engine Architecture</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold font-amiri">
          محرك Google Apps Script للربط الحي والمجاني
        </h2>
        <p className="text-xs sm:text-sm text-stone-300 max-w-3xl leading-relaxed">
          يعمل هذا الكود كوسيط برمجي (Middleware) يربط جدول Google Sheets بواجهة المتجر بدون خوادم مدفوعة أو اشتراكات شهرية، حيث يستقبل الطلبات ويسجلها في تبويب <code>📦 Orders</code>، ويوفر واجهة برمجية <code>doGet</code> و <code>doPost</code> فائقة السرعة.
        </p>
      </div>

      {/* 4 Steps Interactive Guide */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
          <span>خطوات الربط بجدول Google Sheet خلال دقيقتين:</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-white rounded-2xl border border-stone-200 space-y-2">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
              1
            </div>
            <h4 className="text-xs font-bold text-stone-900">إنشاء جدول جديد</h4>
            <p className="text-[11px] text-stone-500 leading-relaxed">
              افتحي Google Sheets جديد ثم اضغطي على قائمة <strong className="text-stone-800">Extensions &gt; Apps Script</strong>.
            </p>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-stone-200 space-y-2">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
              2
            </div>
            <h4 className="text-xs font-bold text-stone-900">لصق الكود والتهيئة</h4>
            <p className="text-[11px] text-stone-500 leading-relaxed">
              انسخي الكود البرمجي أدناه واستبدلي محتوى ملف <code>Code.gs</code>، ثم شغّلي دالة <code>setupSheetDatabase</code> لإنشاء التبويبات الأربعة.
            </p>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-stone-200 space-y-2">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
              3
            </div>
            <h4 className="text-xs font-bold text-stone-900">نشر التطبيق (Deploy)</h4>
            <p className="text-[11px] text-stone-500 leading-relaxed">
              اضغطي <strong className="text-stone-800">Deploy &gt; New deployment &gt; Web app</strong> مع اختيار: <span className="text-amber-800 font-mono font-bold">Anyone</span> في صلاحية الوصول.
            </p>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-stone-200 space-y-2">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
              4
            </div>
            <h4 className="text-xs font-bold text-stone-900">لصق الرابط هنا</h4>
            <p className="text-[11px] text-stone-500 leading-relaxed">
              انسخي رابط الـ Web App وضعي الرابط في حقل الاختبار أدناه للمزامنة الحية المباشرة.
            </p>
          </div>
        </div>
      </div>

      {/* Live Connector Field */}
      <div className="p-6 bg-white rounded-3xl border border-stone-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-amber-600" />
          <h3 className="text-sm font-bold text-stone-900">
            رابط Google Apps Script Web App الخاص بمتجرك
          </h3>
        </div>

        <p className="text-xs text-stone-500">
          إذا نشرتِ Web App من جدول Google Sheet الخاص بكِ، الصقي الرابط هنا ليصبح المتجر يقرأ ويكتب مباشرة من جدولك:
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="url"
            value={webAppUrl}
            onChange={(e) => setWebAppUrl(e.target.value)}
            placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
            className="flex-1 px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
            dir="ltr"
          />

          <button
            onClick={handleSaveAndTestUrl}
            disabled={isTesting}
            className="px-6 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 shrink-0"
          >
            {isTesting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                <span>جاري الاختبار...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 text-amber-400" />
                <span>اختبار الاتصال وسحب البيانات</span>
              </>
            )}
          </button>
        </div>

        {/* Test Result Feedback */}
        {testResult.status === 'success' && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1.5 w-full">
              <h5 className="font-bold">{testResult.message}</h5>
              {testResult.details && (
                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 font-bold text-emerald-900">
                    📦 {testResult.details.productsFound} منتج مسحوب
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-blue-100 font-bold text-blue-900">
                    ⚡ زمن الاستجابة: {testResult.details.latencyMs} ms
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-stone-100 font-mono text-stone-700">
                    🛡️ CORS: {testResult.details.corsStatus}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {testResult.status === 'error' && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-2 w-full">
              <h5 className="font-bold">تنبيه أثناء الاتصال بالرابط:</h5>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                {testResult.message}
              </p>
              {testResult.details?.corsStatus && (
                <div className="text-[11px] font-mono text-red-700 bg-red-100/50 p-1.5 rounded">
                  تشخيص CORS: {testResult.details.corsStatus}
                </div>
              )}
              <div className="text-[11px] text-stone-700 mt-2 bg-white/80 p-3 rounded-xl border border-amber-200/60 space-y-1">
                <div className="font-bold text-stone-900 mb-1">📋 قائمة التحقق من صلاحيات Apps Script Web App:</div>
                <div>1. <strong>Execute as:</strong> يجب أن تكون <code className="bg-stone-100 px-1 py-0.5 rounded font-mono text-stone-800">Me (حسابك الشخصي)</code>.</div>
                <div>2. <strong>Who has access:</strong> يجب أن تكون <code className="bg-stone-100 px-1 py-0.5 rounded font-mono text-amber-800 font-bold">Anyone</code> (وليس Only myself أو Domain).</div>
                <div>3. تأكد من عمل <strong>New deployment</strong> عند أي تعديل برمجى في الكود.</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Permissions & CORS Verification Card */}
      <div className="p-5 bg-stone-50 border border-stone-200 rounded-3xl space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-stone-800 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>معايير أمان وتوافق CORS لـ Google Apps Script (Production Ready)</span>
          </h4>
          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
            تم التحقق
          </span>
        </div>
        <p className="text-[11px] text-stone-600 leading-relaxed">
          تم تصميم محرك <code>appsScriptBridge.ts</code> ليتوافق مع سياسات CORS لمتصفحات الويب: إرسال الطلبات بنوع <code>text/plain</code> لمنع رفض طلبات الـ Preflight (OPTIONS)، واستقبال الردود عبر إعادة التوجيه التلقائي <code>redirect: 'follow'</code> لضمان استلام مبيعات متجرك دون حظر.
        </p>
      </div>

      {/* Code Viewer */}
      <div className="bg-stone-900 text-stone-100 rounded-3xl border border-stone-800 shadow-xl overflow-hidden">
        <div className="p-4 border-b border-stone-800 flex items-center justify-between bg-stone-950">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-amber-400">Code.gs</span>
            <span className="text-[11px] text-stone-400">· كود Google Apps Script الجاهز للنشر</span>
          </div>

          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
          >
            {copiedCode ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>تم نسخ الكود!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>نسخ الكود بالكامل</span>
              </>
            )}
          </button>
        </div>

        <div className="p-4 overflow-x-auto max-h-[500px] font-mono text-xs text-stone-300 leading-relaxed" dir="ltr">
          <pre>{scriptCode}</pre>
        </div>
      </div>
    </div>
  );
};
