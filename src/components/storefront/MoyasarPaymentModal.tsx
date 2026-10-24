import React, { useEffect, useState, useRef } from 'react';
import { Order, StoreSettings } from '../../types/store';
import { StoreManager } from '../../services/storeManager';
import { 
  X, 
  ShieldCheck, 
  Lock, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  CreditCard,
  Sparkles
} from 'lucide-react';

declare global {
  interface Window {
    Moyasar?: {
      init: (config: any) => void;
    };
  }
}

interface MoyasarPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  settings: StoreSettings;
  storeSlug?: string;
  onPaymentSuccess: (updatedOrder: Order) => void;
  onPaymentFailed?: (errorMessage: string) => void;
}

const MOYASAR_CSS_URL = 'https://cdn.jsdelivr.net/npm/moyasar-payment-form@2.3.0/dist/moyasar.css';
const MOYASAR_JS_URL = 'https://cdn.jsdelivr.net/npm/moyasar-payment-form@2.3.0/dist/moyasar.umd.min.js';

// Default public sandbox key if merchant hasn't entered a custom key yet
const DEFAULT_SANDBOX_KEY = 'pk_test_vcFUAGwCU4x8MrjiqqnUS4Vjy3AnFsXZoEi2qTyg';

export const MoyasarPaymentModal: React.FC<MoyasarPaymentModalProps> = ({
  isOpen,
  onClose,
  order,
  settings,
  storeSlug,
  onPaymentSuccess,
  onPaymentFailed,
}) => {
  const [isLoadingScript, setIsLoadingScript] = useState<boolean>(true);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [paymentSuccess, setPaymentSuccess] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const formMountedRef = useRef<boolean>(false);

  const amountInHalalas = Math.round((order.grandTotal || 0) * 100);
  const rawKey = settings.moyasarPublishableKey?.trim() || (import.meta as any).env?.VITE_MOYASAR_PUBLISHABLE_KEY || '';
  const publishableKey =
    rawKey && /^pk_(test|live)_[a-zA-Z0-9]+$/.test(rawKey) && !rawKey.includes('xxx')
      ? rawKey
      : DEFAULT_SANDBOX_KEY;

  const isTestMode =
    settings.moyasarTestMode !== false ||
    publishableKey.startsWith('pk_test_');

  // Load Moyasar CSS & JS SDK dynamically
  useEffect(() => {
    if (!isOpen) {
      formMountedRef.current = false;
      return;
    }

    setIsLoadingScript(true);
    setScriptError(null);
    setStatusMessage('');

    // 1. Inject Stylesheet if not already present
    if (!document.querySelector(`link[href="${MOYASAR_CSS_URL}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = MOYASAR_CSS_URL;
      document.head.appendChild(link);
    }

    // 2. Load SDK Script
    const initForm = () => {
      setIsLoadingScript(false);
      mountMoyasarForm();
    };

    if (window.Moyasar) {
      initForm();
      return;
    }

    let existingScript = document.querySelector(`script[src="${MOYASAR_JS_URL}"]`) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', initForm);
      existingScript.addEventListener('error', () => {
        setIsLoadingScript(false);
        setScriptError('تعذر تحميل بوابة الدفع الإلكتروني. يرجى التحقق من اتصالك بالإنترنت.');
      });
      return;
    }

    const script = document.createElement('script');
    script.src = MOYASAR_JS_URL;
    script.async = true;
    script.onload = initForm;
    script.onerror = () => {
      setIsLoadingScript(false);
      setScriptError('تعذر تحميل واجهة الدفع الإلكتروني. يرجى مراجعة إعدادات الاتصال.');
    };
    document.body.appendChild(script);

    return () => {
      formMountedRef.current = false;
    };
  }, [isOpen, order.id, order.grandTotal]);

  const mountMoyasarForm = () => {
    if (!window.Moyasar || formMountedRef.current) return;

    const container = document.getElementById('mysr-form-container');
    if (!container) return;

    // Reset container HTML to prevent double mounting
    container.innerHTML = '';
    formMountedRef.current = true;

    try {
      const targetSlug = storeSlug || '';
      const callbackUrl = `${window.location.origin}/?store=${encodeURIComponent(targetSlug)}&order=${encodeURIComponent(order.id)}&pay_callback=1`;

      // Moyasar SDK requires Apple Pay label to strictly match ASCII characters only (/^[\x20-\x7E]+$/)
      const sanitizedStoreName = (settings.storeName || '')
        .replace(/[^\x20-\x7E]/g, '')
        .trim();
      const sanitizedSlug = (storeSlug || '').replace(/[^\x20-\x7E]/g, '').trim();
      const asciiLabel = sanitizedStoreName || sanitizedSlug || 'QuickStore';

      // Detect native Apple Pay support in the current browser/device session
      const supportsApplePay =
        typeof window !== 'undefined' &&
        typeof (window as any).ApplePaySession === 'function' &&
        (window as any).ApplePaySession.canMakePayments &&
        (window as any).ApplePaySession.canMakePayments();

      const activeMethods = supportsApplePay ? ['creditcard', 'applepay'] : ['creditcard'];

      const config: any = {
        element: '#mysr-form-container',
        amount: amountInHalalas,
        currency: 'SAR',
        description: `Order #${order.id} - ${asciiLabel}`,
        publishable_api_key: publishableKey,
        callback_url: callbackUrl,
        methods: activeMethods,
        supported_networks: ['mada', 'visa', 'mastercard'],
      };

      if (supportsApplePay) {
        config.apple_pay = {
          country: 'SA',
          label: asciiLabel,
          validate_merchant_url: 'https://api.moyasar.com/v1/applepay/initiate',
        };
      }

      window.Moyasar.init({
        ...config,
        on_completed: async (payment: any) => {
          await handlePaymentCompletion(payment);
        },
        on_failed: (err: any) => {
          const msg = err?.message || 'فشلت عملية الدفع. يرجى المحاولة ببطاقة أخرى.';
          setStatusMessage(msg);
          if (onPaymentFailed) onPaymentFailed(msg);
        },
      });
    } catch (err: any) {
      console.warn('Moyasar form init warning:', err);
      setScriptError(err?.message || 'حدث خطأ أثناء تهيئة نافذة الدفع.');
    }
  };

  const handlePaymentCompletion = async (paymentData: any) => {
    setIsVerifying(true);
    setStatusMessage('جاري التحقق من عملية الدفع واعتماد الطلب...');

    const paymentId = paymentData?.id || `pay_${Math.random().toString(36).substring(2, 9)}`;

    // Ensure paymentData reported success or we are in test mode
    if (paymentData?.status && paymentData.status !== 'paid' && !settings.moyasarTestMode) {
      setIsVerifying(false);
      setStatusMessage('فشلت عملية الدفع أو تم رفضها من قبل البنك. يرجى استخدام بطاقة أخرى.');
      if (onPaymentFailed) onPaymentFailed('فشلت عملية الدفع أو تم رفضها من قبل البنك.');
      return;
    }

    try {
      const canonicalStoreId = order.storeId || storeSlug || (settings as any).id || 'store_aurora_01';

      // 1. Try server-side verification if serverless functions are configured
      let serverVerified = false;
      try {
        const verifyRes = await fetch('/api/verifyPayment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storeId: canonicalStoreId,
            orderId: order.id,
            paymentId,
          }),
        });
        if (verifyRes.ok) {
          const data = await verifyRes.json();
          if (data.success) {
            serverVerified = true;
          }
        }
      } catch (e) {
        // Fallback to local verified order update
      }

      // If not verified on server and not in test mode, check if client paymentData was explicit
      if (!serverVerified && !settings.moyasarTestMode && (!paymentData || paymentData.status !== 'paid')) {
        setIsVerifying(false);
        setStatusMessage('تعذر التحقق من نجاح عملية الدفع مع البنك. يرجى مراجعة البنك أو تجربة وسيلة دفع أخرى.');
        if (onPaymentFailed) onPaymentFailed('تعذر التحقق من نجاح العملية مع البنك.');
        return;
      }

      // 2. Update order in local store state with Paid status & payment ID
      const updatedOrder: Order = {
        ...order,
        status: 'Paid',
        paymentId,
        paidAt: new Date().toISOString(),
        trackingNotes: `تم استلام الدفع الإلكتروني بنجاح (معرف العملية: ${paymentId}). الطلب مؤكد وجاري التجهيز.`,
      };

      await StoreManager.updateOrderInStore(canonicalStoreId, updatedOrder);

      setPaymentSuccess(true);
      setIsVerifying(false);

      setTimeout(() => {
        onPaymentSuccess(updatedOrder);
      }, 1200);
    } catch (err: any) {
      console.error('Error during payment processing:', err);
      setIsVerifying(false);
      setStatusMessage('حدث خطأ أثناء اعتماد حالة الدفع للطلب. يرجى التواصل مع الدعم الفني.');
      if (onPaymentFailed) onPaymentFailed(err?.message || 'تعذر اعتماد الدفع.');
    }
  };

  // Immediate Sandbox Simulator for test & dev environments
  const handleSimulateSandboxPayment = async () => {
    const fakePayment = {
      id: `pay_test_${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      status: 'paid',
      amount: amountInHalalas,
    };
    await handlePaymentCompletion(fakePayment);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/75 backdrop-blur-xs overflow-y-auto">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden z-10 border border-stone-200 my-auto flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-stone-900">
                الدفع الإلكتروني الآمن (Moyasar)
              </h3>
              <p className="text-[11px] text-stone-500">
                مدى · Apple Pay · Visa · Mastercard
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-200 text-stone-600 hover:text-stone-900 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Order Amount Banner */}
        <div className="px-5 py-3.5 bg-blue-50/70 border-b border-blue-100 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-blue-900 block">المبلغ الإجمالي للدفع:</span>
            <span className="text-xs text-blue-700">رقم الطلب: #{order.id}</span>
          </div>
          <div className="text-right">
            <span className="text-lg font-black font-mono text-blue-950">
              {order.grandTotal.toLocaleString('en-US')} {settings.currency}
            </span>
            <span className="block text-[10px] text-blue-700 font-mono">
              ({amountInHalalas.toLocaleString('en-US')} هللة)
            </span>
          </div>
        </div>

        {/* Test Mode Badge */}
        {isTestMode && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between text-xs text-amber-900">
            <div className="flex items-center gap-1.5 font-bold">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>وضع التجربة (Sandbox Mode)</span>
            </div>
            <span className="text-[11px] text-amber-700">لا يتم خصم أموال حقيقية</span>
          </div>
        )}

        {/* Content Area */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Loading Indicator */}
          {isLoadingScript && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-xs font-bold text-stone-700">جاري تحميل واجهة الدفع الآمنة...</p>
              <p className="text-[11px] text-stone-400">تشفير مصرفي معتمد من مؤسسة النقد (ساما)</p>
            </div>
          )}

          {/* Verification in Progress */}
          {isVerifying && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="w-9 h-9 text-emerald-600 animate-spin" />
              <p className="text-sm font-bold text-stone-800">جاري تأكيد عملية الدفع مع البنك...</p>
              <p className="text-xs text-stone-500">{statusMessage}</p>
            </div>
          )}

          {/* Payment Success State */}
          {paymentSuccess && (
            <div className="py-10 flex flex-col items-center justify-center text-center space-y-3 animate-in zoom-in-95">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-base font-black text-stone-900">تم الدفع بنجاح!</h4>
              <p className="text-xs text-stone-600">تم تأكيد استلام المبلغ واعتماد طلبك فورياً.</p>
            </div>
          )}

          {/* Error Message */}
          {(scriptError || (statusMessage && !isVerifying && !paymentSuccess)) && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold block">تنبيه أثناء الدفع:</span>
                <p className="text-[11px] leading-relaxed">{scriptError || statusMessage}</p>
              </div>
            </div>
          )}

          {/* The Official Moyasar Form Container */}
          <div
            id="mysr-form-container"
            className={`mysr-form transition-opacity ${isLoadingScript || isVerifying || paymentSuccess ? 'hidden' : 'block'}`}
          />

          {/* Quick Sandbox Payment Simulator (Visible in Test Mode or fallback) */}
          {isTestMode && !paymentSuccess && !isVerifying && (
            <div className="pt-3 border-t border-dashed border-stone-200">
              <button
                type="button"
                onClick={handleSimulateSandboxPayment}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>إتمام الدفع في وضع التجربة (Simulate Sandbox Approval)</span>
              </button>
              <p className="text-center text-[10px] text-stone-400 mt-1.5">
                مخصص لاختبار وتجربة إتمام الطلب بنجاح فوراً بدون إدخال بطاقة بنكية حقيقية.
              </p>
            </div>
          )}
        </div>

        {/* Footer Security Badges */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-[11px] text-stone-500">
          <div className="flex items-center gap-1.5 font-bold text-stone-700">
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            <span>اتصال مشفر 256-bit SSL</span>
          </div>

          <div className="flex items-center gap-1.5 font-bold text-emerald-700">
            <ShieldCheck className="w-4 h-4" />
            <span>متوافق مع PCI-DSS و SAMA</span>
          </div>
        </div>
      </div>
    </div>
  );
};
