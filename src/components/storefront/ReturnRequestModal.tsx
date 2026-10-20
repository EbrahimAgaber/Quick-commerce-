import React, { useState } from 'react';
import { Order, StoreSettings } from '../../types/store';
import { StoreManager } from '../../services/storeManager';
import { createWhatsAppUrl } from '../../utils/whatsappInvoice';
import { 
  RotateCcw, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Package, 
  MessageCircle, 
  Loader2, 
  ShieldCheck,
  Calendar,
  Check
} from 'lucide-react';

interface ReturnRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  settings: StoreSettings;
  storeId?: string;
  onSuccess?: () => void;
}

const RETURN_REASONS = [
  { id: 'defective', label: 'عيب مصنعي أو تلف في المنتج', desc: 'استلام المنتج تالفاً أو لا يعمل بشكل صحيح' },
  { id: 'wrong_item', label: 'استلمت منتجاً مختلفاً عن المعروض', desc: 'المنتج المستلم لا يطابق المواصفات في الطلب' },
  { id: 'size_fit', label: 'المقاس أو الحجم غير مناسب', desc: 'طلب استبدال بمقاس آخر متاح' },
  { id: 'changed_mind', label: 'تغيير الرأي (المنتج بحالته الأصلية)', desc: 'ضمن فترة 7 أيام نظاماً والمنتج غير مستخدم' },
  { id: 'other', label: 'سبب آخر', desc: 'يرجى كتابة التوضيح في الملاحظات' },
];

export const ReturnRequestModal: React.FC<ReturnRequestModalProps> = ({
  isOpen,
  onClose,
  order,
  settings,
  storeId,
  onSuccess,
}) => {
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    if (Array.isArray(order.items)) {
      order.items.forEach((item) => {
        init[item.productId] = item.quantity;
      });
    }
    return init;
  });

  const [reason, setReason] = useState<string>(RETURN_REASONS[0].label);
  const [notes, setNotes] = useState('');
  const [phoneLast4, setPhoneLast4] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isOpen) return null;

  // Calculate return items payload
  const returnClaimItems = (order.items || [])
    .filter((i) => (selectedItems[i.productId] || 0) > 0)
    .map((i) => ({
      productId: i.productId,
      name: i.name,
      quantity: selectedItems[i.productId] || 1,
      reason,
    }));

  const handleToggleItem = (productId: string, maxQty: number) => {
    setSelectedItems((prev) => {
      const current = prev[productId] || 0;
      return {
        ...prev,
        [productId]: current > 0 ? 0 : maxQty,
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (returnClaimItems.length === 0) {
      setErrorMessage('يرجى تحديد منتج واحد على الأقل ترغب في استرجاعه أو استبداله.');
      return;
    }

    if (phoneLast4.trim().length !== 4) {
      setErrorMessage('يرجى كتابة آخر 4 أرقام من رقم الجوال المسجل بالطلب للتحقق.');
      return;
    }

    setIsSubmitting(true);
    try {
      const targetStoreId = storeId || settings.storeName || 'aurora';
      const res = await StoreManager.submitReturnRequest({
        storeId: targetStoreId,
        orderId: order.id,
        phoneLast4: phoneLast4.trim(),
        reason,
        notes: notes.trim(),
        items: returnClaimItems,
      });

      if (!res.success) {
        setErrorMessage(res.error || 'فشل تقديم طلب الاسترجاع.');
        return;
      }

      setIsSubmitted(true);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ غير متوقع.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenWhatsAppClaim = () => {
    const itemsText = returnClaimItems.map((i) => `• ${i.name} (${i.quantity} قطعة)`).join('\n');
    const msg = `مرحباً متجر ${settings.storeName} 👋\nأرغب في تقديم طلب *استرجاع / استبدال* للطلب رقم #${order.id}\n\n📋 *المنتجات المراد إرجاعها:*\n${itemsText}\n\n⚠️ *سبب الاسترجاع:* ${reason}\n${notes ? `📝 *ملاحظات إضافية:* ${notes}\n` : ''}\n👤 *اسم العميل:* ${order.customerName}\n📱 *رقم الجوال:* ${order.customerPhone}`;
    const url = createWhatsAppUrl(settings.whatsappNumber, msg);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Eligibility window formatted date
  const deliveryDate = order.driverDeliveredAt || order.timestamp;
  const eligibleDate = order.returnEligibleUntil
    ? new Date(order.returnEligibleUntil).toLocaleDateString('ar-SA')
    : new Date(new Date(deliveryDate).getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('ar-SA');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-stone-950/75 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden z-10 border border-stone-200 my-auto flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 bg-linear-to-r from-stone-900 to-stone-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 border border-amber-500/30">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold">طلب استرجاع أو استبدال</h3>
              <p className="text-xs text-stone-300">
                طلب رقم <span className="font-mono text-amber-300 font-bold">#{order.id}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-right" dir="rtl">
          {/* Policy Compliance Banner */}
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5 text-xs">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold">حق المستهلك نظاماً (وزارة التجارة):</span>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                متاح تقديم طلب الاسترجاع حتى <span className="font-bold">{eligibleDate}</span> بشرط الحفاظ على المنتج وملحقاته بحالته الأصلية.
              </p>
            </div>
          </div>

          {isSubmitted ? (
            <div className="py-6 text-center space-y-4 animate-in zoom-in-95">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-stone-900">تم تسجيل طلب الاسترجاع بنجاح!</h4>
                <p className="text-xs text-stone-600 max-w-md mx-auto leading-relaxed">
                  تم إشعار إدارة المتجر بطلبك وسيقوم فريق خدمة العملاء بالتواصل معك لترتيب استلام الشحنة وإعادة المبلغ أو الاستبدال.
                </p>
              </div>

              {settings.whatsappNumber && (
                <button
                  type="button"
                  onClick={handleOpenWhatsAppClaim}
                  className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>تأكيد الطلب وإرسال تفاصيل الإرجاع عبر واتساب</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                إغلاق النافذة
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* 1. Item Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-stone-800">
                  ١. حدد المنتجات المراد استرجاعها:
                </label>
                <div className="space-y-2">
                  {(order.items || []).map((item) => {
                    const isSelected = (selectedItems[item.productId] || 0) > 0;
                    return (
                      <div
                        key={item.productId}
                        onClick={() => handleToggleItem(item.productId, item.quantity)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-blue-50/70 border-blue-400 ring-1 ring-blue-300'
                            : 'bg-stone-50 border-stone-200 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-colors ${
                              isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-stone-300 bg-white'
                            }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-stone-900 block">{item.name}</span>
                            <span className="text-[11px] text-stone-500">
                              الكمية في الطلب: {item.quantity} | السعر:{' '}
                              {item.price.toLocaleString('ar-SA')} {settings.currency}
                            </span>
                          </div>
                        </div>

                        {isSelected && item.quantity > 1 && (
                          <div
                            className="flex items-center gap-2 text-xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="text-stone-500 text-[11px]">الكمية للإرجاع:</span>
                            <select
                              value={selectedItems[item.productId]}
                              onChange={(e) =>
                                setSelectedItems({
                                  ...selectedItems,
                                  [item.productId]: Number(e.target.value),
                                })
                              }
                              className="px-2 py-1 rounded-lg border border-blue-300 bg-white font-bold text-xs"
                            >
                              {Array.from({ length: item.quantity }, (_, idx) => idx + 1).map((n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Return Reason */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-stone-800">
                  ٢. سبب الاسترجاع أو الاستبدال:
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {RETURN_REASONS.map((r) => (
                    <label
                      key={r.id}
                      className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-colors ${
                        reason === r.label
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'bg-stone-50 border-stone-200 text-stone-800 hover:bg-stone-100'
                      }`}
                    >
                      <input
                        type="radio"
                        name="return_reason"
                        checked={reason === r.label}
                        onChange={() => setReason(r.label)}
                        className="mt-1"
                      />
                      <div>
                        <span className="text-xs font-bold block">{r.label}</span>
                        <span
                          className={`text-[10px] block ${
                            reason === r.label ? 'text-stone-300' : 'text-stone-500'
                          }`}
                        >
                          {r.desc}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* 3. Detailed Notes */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-stone-800">
                  ٣. تفاصيل إضافية أو وصف المشكلة (اختياري):
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مثال: يرجى استبدال المقاس من L إلى M، أو توضيح موضع الخدش / العيب..."
                  rows={2}
                  className="w-full p-3 rounded-xl border border-stone-200 bg-stone-50 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900"
                />
              </div>

              {/* 4. Phone Verification */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-stone-800">
                  ٤. للتحقق: أدخل آخر 4 أرقام من رقم الجوال المسجل في الطلب:
                </label>
                <input
                  type="text"
                  maxLength={4}
                  value={phoneLast4}
                  onChange={(e) => setPhoneLast4(e.target.value.replace(/\D/g, ''))}
                  placeholder="مثال: 4567"
                  className="w-36 p-2.5 rounded-xl border border-stone-200 bg-stone-50 text-center font-mono text-sm tracking-widest text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 px-4 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RotateCcw className="w-4 h-4" />
                  )}
                  <span>إرسال طلب الاسترجاع</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="py-3 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
