import React, { useState } from 'react';
import { Order, StoreSettings } from '../../types/store';
import { 
  X, 
  ShieldCheck, 
  Lock, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  ExternalLink,
  CreditCard,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface PaylinkPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  settings: StoreSettings;
  storeSlug?: string;
  onPaymentSuccess: (updatedOrder: Order) => void;
  onPaymentFailed?: (errorMessage: string) => void;
}

export const PaylinkPaymentModal: React.FC<PaylinkPaymentModalProps> = ({
  isOpen,
  onClose,
  order,
  settings,
  storeSlug,
  onPaymentSuccess,
  onPaymentFailed,
}) => {
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [transactionNo, setTransactionNo] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const grandTotal = order.grandTotal || 0;
  const currency = settings.currency || 'SAR';
  const isTestMode = settings.paylinkTestMode !== false;

  const handleStartPayment = async () => {
    setIsGenerating(true);
    setErrorMsg(null);

    try {
      const cleanOrderId = String(order.id || '').replace(/#/g, '').trim();
      const sanitizedPhone = (order.customerPhone || '').replace(/\D/g, '') || '0500000000';

      // 1. First attempt: call backend API /api/createPaylinkInvoice
      let transactionNum = '';
      let checkoutUrl = '';

      try {
        const res = await fetch('/api/createPaylinkInvoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            storeId: storeSlug || (settings as any).storeId || 'default',
            orderId: cleanOrderId,
            callBackUrl: window.location.href,
          }),
        });

        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (res.ok && data.success && data.url) {
            transactionNum = data.transactionNo;
            checkoutUrl = data.url;
          } else if (data?.error) {
            throw new Error(data.error);
          }
        }
      } catch (apiErr: any) {
        console.warn('Backend /api/createPaylinkInvoice unreachable, trying direct client checkout:', apiErr);
      }

      // 2. Client-direct fallback (for Static Hosting, Firebase Hosting, Demo mode)
      if (!checkoutUrl) {
        const apiId = settings.paylinkApiId?.trim() || 'APP_ID_1123453311';
        const secretKey = settings.paylinkSecretKey?.trim() || '0662abb5-13c7-38ab-cd12-236e58f43766';
        const isSandbox = settings.paylinkTestMode !== false || apiId.startsWith('APP_ID_');
        const baseUrl = isSandbox ? 'https://restpilot.paylink.sa' : 'https://restapi.paylink.sa';

        // Direct Paylink Auth
        const authRes = await fetch(`${baseUrl}/api/auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ apiId, secretKey, persistToken: false }),
        });

        if (!authRes.ok) {
          throw new Error('فشل تسجيل الدخول إلى بوابة بايلينك. تأكد من صحة مفاتيح الربط البرمجي.');
        }

        const authData = await authRes.json();
        const idToken = authData.id_token;

        // Direct Paylink addInvoice
        const invoiceRes = await fetch(`${baseUrl}/api/addInvoice`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${idToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            orderNumber: cleanOrderId,
            amount: Math.max(5.0, Number(grandTotal.toFixed(2))),
            callBackUrl: window.location.href,
            cancelUrl: window.location.href,
            clientName: order.customerName || 'عميل المتجر',
            clientMobile: sanitizedPhone.startsWith('05') ? sanitizedPhone : '0500000000',
            clientEmail: 'customer@storelink.sa',
            currency: currency || 'SAR',
            products: [
              {
                title: `طلب رقم ${cleanOrderId}`,
                price: Math.max(5.0, Number(grandTotal.toFixed(2))),
                qty: 1,
              },
            ],
          }),
        });

        if (!invoiceRes.ok) {
          const errText = await invoiceRes.text().catch(() => '');
          throw new Error(`تعذر إنشاء فاتورة الدفع في بايلينك: ${errText || invoiceRes.statusText}`);
        }

        const invoiceData = await invoiceRes.json();
        if (!invoiceData.url) {
          throw new Error('لم تقم بايلينك بإرجاع رابط الدفع.');
        }

        transactionNum = invoiceData.transactionNo;
        checkoutUrl = invoiceData.url;
      }

      setTransactionNo(transactionNum);
      setPaymentUrl(checkoutUrl);

      // Open checkout in the current window or a new tab securely without triggering Safari pattern mismatch
      if (checkoutUrl) {
        try {
          const win = window.open(checkoutUrl, '_blank');
          if (!win || win.closed || typeof win.closed === 'undefined') {
            window.location.href = checkoutUrl;
          }
        } catch {
          window.location.href = checkoutUrl;
        }
      }
    } catch (err: any) {
      const msg = err.message || 'حدث خطأ أثناء فتح بوابة الدفع.';
      setErrorMsg(msg);
      if (onPaymentFailed) onPaymentFailed(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSimulateSandboxPayment = async () => {
    setIsVerifying(true);
    setErrorMsg(null);
    try {
      const simTransactionNo = `SIM_PAYLINK_${Date.now()}`;
      setTransactionNo(simTransactionNo);
      setSuccess(true);
      setTimeout(() => {
        onPaymentSuccess({
          ...order,
          status: 'Paid',
          paymentStatus: 'paid',
          paymentMethod: 'Paylink Sandbox (مدى / Apple Pay)',
          paymentId: simTransactionNo,
          paidAt: new Date().toISOString(),
          paylinkTransactionNo: simTransactionNo,
        });
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'حدث خطأ أثناء محاكاة الدفع التجريبي.');
    } finally {
      setIsVerifying(false);
    }
  };
  const handleVerifyPayment = async () => {
    if (!transactionNo) {
      setErrorMsg('لم يتم العثور على رقم معاملة للتحقق.');
      return;
    }

    setIsVerifying(true);
    setErrorMsg(null);

    try {
      let isPaid = false;
      let updatedOrderData: any = null;

      // 1. Try server-side verification
      try {
        const res = await fetch('/api/verifyPaylinkPayment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            storeId: storeSlug || (settings as any).storeId || 'default',
            orderId: order.id,
            transactionNo,
          }),
        });

        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (res.ok && data.success && data.status === 'Paid') {
            isPaid = true;
            updatedOrderData = data.updatedOrder;
          }
        }
      } catch (srvErr) {
        console.warn('Backend verifyPaylinkPayment unreachable, attempting direct check:', srvErr);
      }

      // 2. Direct client verification fallback
      if (!isPaid) {
        const apiId = settings.paylinkApiId?.trim() || 'APP_ID_1123453311';
        const secretKey = settings.paylinkSecretKey?.trim() || '0662abb5-13c7-38ab-cd12-236e58f43766';
        const isSandbox = settings.paylinkTestMode !== false || apiId.startsWith('APP_ID_');
        const baseUrl = isSandbox ? 'https://restpilot.paylink.sa' : 'https://restapi.paylink.sa';

        const authRes = await fetch(`${baseUrl}/api/auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ apiId, secretKey, persistToken: false }),
        });

        if (authRes.ok) {
          const { id_token } = await authRes.json();
          const invoiceRes = await fetch(`${baseUrl}/api/getInvoice/${encodeURIComponent(transactionNo)}`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${id_token}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
          });

          if (invoiceRes.ok) {
            const invoice = await invoiceRes.json();
            if (invoice.orderStatus === 'Paid') {
              isPaid = true;
            } else if (invoice.orderStatus === 'Declined' || invoice.orderStatus === 'Canceled') {
              throw new Error(`حالة الدفع في بايلينك: ${invoice.orderStatus}. يرجى إعادة المحاولة.`);
            }
          }
        }
      }

      if (!isPaid) {
        throw new Error('لم يتم تأكيد الدفع بعد. يرجى إتمام العملية في نافذة بايلينك ثم المحاولة مجدداً.');
      }

      setSuccess(true);
      setTimeout(() => {
        onPaymentSuccess(updatedOrderData || { ...order, status: 'Paid', paymentStatus: 'paid', paymentId: transactionNo });
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل التحقق من الدفع.');
    } finally {
      setIsVerifying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-500/20 text-blue-400 rounded-xl">
              <CreditCard className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-sm">بوابة الدفع الإلكتروني (Paylink)</h3>
              <p className="text-[11px] text-stone-300">مدى · أبل باي (Apple Pay) · فيزا وماستركارد</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-stone-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Order Summary Pill */}
          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-stone-500 block">رقم الطلب</span>
              <span className="font-mono font-bold text-sm text-stone-900">#{order.id}</span>
            </div>
            <div className="text-left">
              <span className="text-[11px] text-stone-500 block">المبلغ الإجمالي</span>
              <span className="font-extrabold text-base text-blue-600">
                {grandTotal.toFixed(2)} {currency}
              </span>
            </div>
          </div>

          {/* Test Mode Badge */}
          {isTestMode && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>وضع التجربة الآمن (Sandbox):</strong> يمكنك استخدام بطاقات بايلينك التجريبية لإكمال الطلب دون سحب أموال حقيقية.
              </span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {success && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-center space-y-1">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <p className="font-bold text-sm">تم تأكيد الدفع بنجاح!</p>
              <p className="text-xs text-emerald-700">جاري توجيهك لتأكيد الطلب...</p>
            </div>
          )}

          {!success && !paymentUrl && (
            <div className="space-y-4">
              <p className="text-xs text-stone-600 leading-relaxed text-center">
                سيتم نقلك إلى صفحة بايلينك الآمنة المعتمدة لإتمام الدفع بواسطة <strong>مدى</strong> أو <strong>Apple Pay</strong> أو البطاقة الائتمانية بأمان تام وموثوقية عالية.
              </p>

              <button
                type="button"
                onClick={handleStartPayment}
                disabled={isGenerating}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer text-sm"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري تحضير بوابة الدفع...</span>
                  </>
                ) : (
                  <>
                    <span>متابعة للدفع عبر Paylink</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {isTestMode && (
                <div className="pt-2 border-t border-dashed border-stone-200">
                  <button
                    type="button"
                    onClick={handleSimulateSandboxPayment}
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>إتمام الطلب في وضع التجربة فوراً (Sandbox 1-Tap)</span>
                  </button>
                  <p className="text-center text-[10px] text-stone-400 mt-1.5">
                    مخصص لتجربة دورة الطلب في بيئة الاختبار دون سحب أموال حقيقية.
                  </p>
                </div>
              )}
            </div>
          )}

          {!success && paymentUrl && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 text-xs space-y-2">
                <p className="font-bold">تم فتح نافذة الدفع في بايلينك</p>
                <p className="text-[11px] leading-relaxed">
                  إذا لم تفتح النافذة تلقائياً أو قمت بإغلاقها بالخطأ، يمكنك إعادة فتحها عبر الرابط أدناه:
                </p>
                <a
                  href={paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-bold text-blue-700 hover:underline pt-1"
                >
                  <span>فتح نافذة الدفع مرة أخرى</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <button
                type="button"
                onClick={handleVerifyPayment}
                disabled={isVerifying}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer text-sm"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري التحقق من نجاح العملية لدى بايلينك...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>لقد أتممت عملية الدفع بنجاح — تحقق الآن</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* SAMA / Security Footer */}
          <div className="pt-2 border-t border-stone-100 flex items-center justify-center gap-1.5 text-[11px] text-stone-400">
            <Lock className="w-3.5 h-3.5 text-stone-400" />
            <span>مدعوم ومشفر بالكامل عبر بوابة بايلينك المعتمدة من البنك المركزي السعودي</span>
          </div>
        </div>
      </div>
    </div>
  );
};
