import React, { useState, useEffect } from 'react';
import { Order, StoreSettings } from '../../types/store';
import { CheckCircle2, MessageCircle, Copy, Check, PackageCheck, Sparkles, X, FileText, KeyRound, ShieldCheck } from 'lucide-react';
import { buildWhatsAppInvoiceMessage, createWhatsAppUrl, getOrderDeliveryPin } from '../../utils/whatsappInvoice';
import { InvoiceModal } from './InvoiceModal';

interface OrderSuccessModalProps {
  order: Order | null;
  settings: StoreSettings;
  onClose: () => void;
  onTrackOrder: (orderId: string) => void;
}

export const OrderSuccessModal: React.FC<OrderSuccessModalProps> = ({
  order,
  settings,
  onClose,
  onTrackOrder,
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  const brand = settings.brandTheme || {
    primaryColor: '#0B253F',
    accentColor: '#0077FF',
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!order) return null;

  const handleCopyInvoice = () => {
    const text = buildWhatsAppInvoiceMessage(order, settings, order.storeSlug || settings.storeSlug);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyOrderId = () => {
    navigator.clipboard.writeText(order.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleReopenWhatsApp = () => {
    const text = buildWhatsAppInvoiceMessage(order, settings, order.storeSlug || settings.storeSlug);
    const url = createWhatsAppUrl(settings.whatsappNumber, text);
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-stone-950/75 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden z-10 border border-stone-200 p-6 sm:p-8 text-center space-y-5 animate-in zoom-in-95 duration-200">
        {/* Top Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 w-8 h-8 rounded-full bg-stone-100 text-stone-500 hover:text-stone-900 flex items-center justify-center transition-colors cursor-pointer"
          aria-label="إغلاق"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Celebration Icon */}
        <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-inner">
          <CheckCircle2 className="w-9 h-9" />
        </div>

        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>تم استلام وتوثيق طلبك بنجاح!</span>
          </div>

          <h3 className="text-xl font-extrabold" style={{ color: brand.primaryColor }}>
            شكراً لتسوقك، {order.customerName}
          </h3>

          <p className="text-xs text-stone-500 mt-1">
            تم إشعار المتجر تلقائياً بطلبك وتسجيله بنجاح وجارٍ مراجعته وتجهيزه.
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span>تم إشعار صاحب المتجر مباشرة بدون الحاجة لإرسال أي رسالة</span>
          </div>
        </div>

        {/* Order Reference Box */}
        <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-1.5">
          <span className="text-xs text-stone-500">رقم الطلب الخاص بك:</span>
          <div className="flex items-center justify-center gap-2">
            <span
              className="text-2xl font-black font-mono tracking-wider select-all"
              style={{ color: brand.accentColor }}
            >
              #{order.id}
            </span>
            <button
              onClick={handleCopyOrderId}
              className="p-1.5 rounded-lg bg-white border border-stone-200 text-stone-600 hover:text-stone-900 text-xs cursor-pointer"
              title="نسخ رقم الطلب"
            >
              {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-[11px] text-stone-400">
            احفظ هذا الرقم لتتبع مسار شحنتك في أي وقت
          </p>
        </div>

        {/* Delivery Confirmation PIN Card */}
        <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200/90 text-center space-y-1.5 shadow-sm">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100/80 text-amber-900 text-[11px] font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
            <span>كود تأكيد التسليم للمندوب</span>
          </div>
          <div className="text-3xl font-black font-mono tracking-widest text-amber-700 py-0.5 select-all">
            {getOrderDeliveryPin(order)}
          </div>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            زوّد مندوب التوصيل بهذا الكود السري عند وصول الشحنة ليتمكن من تأكيد تسليمها بنجاح 📦
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-2.5 pt-2">
          {/* Re-open WhatsApp */}
          {settings.whatsappNumber && (
            <button
              onClick={handleReopenWhatsApp}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-98 cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>فتح محادثة واتساب مع المتجر</span>
            </button>
          )}

          {/* Copy Invoice */}
          <button
            onClick={handleCopyInvoice}
            className="w-full py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700">تم نسخ نص الفاتورة!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-stone-500" />
                <span>نسخ نص الفاتورة</span>
              </>
            )}
          </button>

          {/* View ZATCA Tax Invoice */}
          <button
            onClick={() => setShowInvoiceModal(true)}
            className="w-full py-2.5 px-4 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>عرض وطباعة الفاتورة الضريبية (ZATCA)</span>
          </button>

          {/* Track Order Now */}
          <button
            onClick={() => {
              onClose();
              onTrackOrder(order.id);
            }}
            className="w-full py-3 px-4 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
            style={{ backgroundColor: brand.primaryColor }}
          >
            <PackageCheck className="w-4 h-4" />
            <span>تتبع حالة هذا الطلب مباشرة</span>
          </button>

          {/* Back to store */}
          <button
            onClick={onClose}
            className="text-xs text-stone-500 hover:text-stone-800 pt-2 block mx-auto underline cursor-pointer"
          >
            متابعة تصفح المتجر
          </button>
        </div>
      </div>

      {/* ZATCA Tax Invoice Modal */}
      <InvoiceModal
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        order={order}
        settings={settings}
      />
    </div>
  );
};
