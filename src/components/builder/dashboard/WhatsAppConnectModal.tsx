import React, { useState, useEffect, useRef } from 'react';
import { X, Smartphone, RefreshCw, CheckCircle2, AlertCircle, LogOut, ShieldCheck, Zap } from 'lucide-react';
import { WhatsAppClientBridge, WhatsAppBridgeStatus } from '../../../services/whatsAppClientBridge';

interface WhatsAppConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  brandTheme?: {
    primaryColor?: string;
    accentColor?: string;
  };
  onConnectionChange?: (connected: boolean) => void;
}

export const WhatsAppConnectModal: React.FC<WhatsAppConnectModalProps> = ({
  isOpen,
  onClose,
  brandTheme,
  onConnectionChange,
}) => {
  const [statusData, setStatusData] = useState<WhatsAppBridgeStatus>({
    status: 'disconnected',
    qrCodeDataUrl: null,
    connectedPhone: null,
    lastConnectedAt: null,
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const pollIntervalRef = useRef<any>(null);

  const primaryColor = brandTheme?.primaryColor || '#0B253F';
  const accentColor = brandTheme?.accentColor || '#0077FF';

  const checkStatus = async () => {
    const data = await WhatsAppClientBridge.getStatus();
    setStatusData(data);
    if (data.status === 'connected') {
      onConnectionChange?.(true);
    } else {
      onConnectionChange?.(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    checkStatus();
    // Poll status while modal is open to detect scan
    pollIntervalRef.current = setInterval(() => {
      checkStatus();
    }, 2500);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isOpen]);

  const handleStartConnect = async () => {
    setLoading(true);
    setActionMessage('جاري إنشاء جلسة الاتصال وتوليد رمز QR...');
    const result = await WhatsAppClientBridge.initiateConnection();
    setStatusData(result);
    setLoading(false);
    setActionMessage(null);
  };

  const handleDisconnect = async () => {
    if (!confirm('هل أنت متأكد من رغبتك في تسجيل الخروج من جلسة الواتساب؟')) return;
    setLoading(true);
    await WhatsAppClientBridge.disconnect();
    await checkStatus();
    setLoading(false);
    setActionMessage('تم تسجيل الخروج بنجاح.');
    setTimeout(() => setActionMessage(null), 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/70 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-stone-200 z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div
          className="p-5 text-white flex items-center justify-between"
          style={{ backgroundColor: primaryColor }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-400/30">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">ربط واتساب المتجر (الإرسال التلقائي)</h3>
              <p className="text-xs text-stone-300">إرسال تفاصيل الشحن للمناديب في الخلفية دون فتح الويب</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {actionMessage && (
            <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-xl flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
              <span>{actionMessage}</span>
            </div>
          )}

          {statusData.status === 'connected' ? (
            /* Connected State */
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-inner">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div>
                <h4 className="text-base font-bold text-stone-900">واتساب متصل ويعمل بنجاح!</h4>
                <p className="text-xs text-stone-500 mt-1">
                  الرقم المرتبط: <span className="font-mono font-bold text-emerald-700">+{statusData.connectedPhone}</span>
                </p>
                {statusData.lastConnectedAt && (
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    آخر اتصال: {new Date(statusData.lastConnectedAt).toLocaleTimeString('ar-SA')}
                  </p>
                )}
              </div>

              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-right text-xs text-emerald-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <Zap className="w-4 h-4 text-emerald-600" />
                  <span>الإرسال التلقائي في الخلفية مفعل:</span>
                </div>
                <p className="text-emerald-800 text-[11px] leading-relaxed">
                  عند النقر على زر الشاحنة (🚚) لأي طلب، ستُرسل رسالة التوصيل وإحداثيات الموقع مباشرة من جوالك إلى المندوب فوراً دون فتح واتساب ويب.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>قطع الاتصال وتسجيل الخروج</span>
                </button>
              </div>
            </div>
          ) : (
            /* Disconnected or Scanning State */
            <div className="space-y-4">
              {statusData.qrCodeDataUrl ? (
                <div className="text-center space-y-3">
                  <div className="inline-block p-3 bg-white border-2 border-dashed border-stone-300 rounded-2xl shadow-sm">
                    <img
                      src={statusData.qrCodeDataUrl}
                      alt="WhatsApp QR Code"
                      className="w-56 h-56 mx-auto object-contain rounded-lg"
                    />
                  </div>
                  <p className="text-xs font-bold text-stone-800">
                    امسح رمز QR أعلاه بواسطة واتساب من هاتفك
                  </p>
                  <ol className="text-right text-[11px] text-stone-600 space-y-1 bg-stone-50 p-3 rounded-xl border border-stone-200 leading-relaxed list-decimal list-inside">
                    <li>افتح تطبيق واتساب على هاتفك</li>
                    <li>اضغط على <b>الإعدادات</b> أو <b>الخيارات (⋮)</b></li>
                    <li>اختر <b>الأجهزة المرتبطة (Linked Devices)</b></li>
                    <li>اضغط <b>ربط جهاز</b> ووجّه الكاميرا نحو الشاشة</li>
                  </ol>
                </div>
              ) : (
                <div className="text-center py-6 space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-stone-100 text-stone-500 mx-auto flex items-center justify-center">
                    <Smartphone className="w-7 h-7" />
                  </div>
                  <h4 className="text-sm font-bold text-stone-800">خدمة الواتساب غير مرتبطة حالياً</h4>
                  <p className="text-xs text-stone-500 max-w-xs mx-auto leading-relaxed">
                    اربط واتساب المتجر لتفعيل إرسال مهام التوصيل للسائقين وإشعارات الطلبات تلقائياً في الخلفية.
                  </p>
                </div>
              )}

              {statusData.error && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{statusData.error}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleStartConnect}
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md transition-all active:scale-98 cursor-pointer disabled:opacity-60"
                style={{ backgroundColor: accentColor }}
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري التوليد والاتصال...</span>
                  </>
                ) : statusData.qrCodeDataUrl ? (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>تحديث رمز QR</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>توليد رمز QR للربط الآن</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-stone-400 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>الاتصال مشفر طرفاً لطرف عبر بروتوكول واتساب المباشر</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
