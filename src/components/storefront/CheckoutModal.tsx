import React, { useState, useEffect } from 'react';
import { CartItem, Order, PromoCode, StoreSettings } from '../../types/store';
import { StoreManager } from '../../services/storeManager';
import { X, Send, CreditCard, Banknote, Building2, Check, Copy, AlertCircle, Loader2 } from 'lucide-react';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  settings: StoreSettings;
  orderNotes: string;
  appliedPromo?: PromoCode | null;
  onOrderSuccess: (order: Order) => void;
  storeId?: string;
}

const DEFAULT_CITIES = [
  'الرياض',
  'جدة',
  'مكة المكرمة',
  'المدينة المنورة',
  'الدمام',
  'الخبر',
  'الظهران',
  'الأحساء',
  'بريدة (القصيم)',
  'عنيزة',
  'أبها',
  'خميس مشيط',
  'الطائف',
  'تبوك',
  'حائل',
  'جازان',
  'نجران',
  'الجبيل',
  'ينبع',
  'مدينة أخرى',
];

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  items,
  settings,
  orderNotes,
  appliedPromo,
  onOrderSuccess,
  storeId,
}) => {
  const brand = settings.brandTheme || {
    primaryColor: '#0B253F',
    accentColor: '#0077FF',
    highlightColor: '#A5F3B6',
    backgroundColor: '#F8FAFC',
    neutralColor: '#E4E7EB',
    textColor: '#0B253F',
  };

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [city, setCity] = useState(DEFAULT_CITIES[0]);
  const [customCity, setCustomCity] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [landmarkNotes, setLandmarkNotes] = useState(orderNotes || '');
  const [paymentMethod, setPaymentMethod] = useState(settings.paymentMethods[0] || 'الدفع عند الاستلام (COD)');
  const [copiedIban, setCopiedIban] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const subtotal = items.reduce((sum, item) => {
    const hasSale =
      typeof item.product.salePrice === 'number' &&
      item.product.salePrice > 0 &&
      item.product.salePrice < item.product.price;
    const price = hasSale ? item.product.salePrice! : item.product.price;
    return sum + price * item.quantity;
  }, 0);

  let discountAmount = 0;
  if (appliedPromo && appliedPromo.active && subtotal > 0) {
    if (!appliedPromo.minOrderAmount || subtotal >= appliedPromo.minOrderAmount) {
      if (appliedPromo.type === 'percentage') {
        discountAmount = Math.round((subtotal * Math.min(100, Math.max(0, appliedPromo.value))) / 100);
      } else {
        discountAmount = Math.min(subtotal, Math.max(0, appliedPromo.value));
      }
    }
  }

  const discountedSubtotal = Math.max(0, subtotal - discountAmount);
  const hasFreeShippingPromo = settings.freeShippingThreshold > 0;
  const qualifiesForFreeShipping = hasFreeShippingPromo
    ? discountedSubtotal >= settings.freeShippingThreshold
    : settings.standardShippingRate === 0;
  const shippingFee = qualifiesForFreeShipping ? 0 : settings.standardShippingRate;
  const grandTotal = discountedSubtotal + shippingFee;

  const handleCopyIban = () => {
    if (settings.bankDetails.iban) {
      navigator.clipboard.writeText(settings.bankDetails.iban);
      setCopiedIban(true);
      setTimeout(() => setCopiedIban(false), 2000);
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!customerName.trim() || customerName.trim().length < 2) {
      setErrorMsg('يرجى كتابة الاسم الكريم للمستلم');
      return;
    }

    const digitsOnlyPhone = customerPhone.replace(/\D/g, '');
    if (digitsOnlyPhone.length < 8 || digitsOnlyPhone.length > 15) {
      setErrorMsg('يرجى إدخال رقم جوال واتساب صحيح (8 إلى 15 رقماً) للتواصل وتأكيد الشحن');
      return;
    }

    if (city === 'مدينة أخرى' && !customCity.trim()) {
      setErrorMsg('يرجى كتابة اسم مدينتك في الحقل المخصص');
      return;
    }

    const finalCity = city === 'مدينة أخرى' ? customCity.trim() : city;

    if (!deliveryAddress.trim()) {
      setErrorMsg('يرجى تدوين عنوان التوصيل أو الحي');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      let mappedPaymentMethod: 'cod' | 'bank_transfer' | 'card' | 'apple_pay' | 'stc_pay' = 'cod';
      if (paymentMethod.includes('تحويل')) {
        mappedPaymentMethod = 'bank_transfer';
      } else if (paymentMethod.includes('بطاق') || paymentMethod.includes('فيزا') || paymentMethod.includes('مدى')) {
        mappedPaymentMethod = 'card';
      } else if (paymentMethod.includes('Apple')) {
        mappedPaymentMethod = 'apple_pay';
      } else if (paymentMethod.includes('STC')) {
        mappedPaymentMethod = 'stc_pay';
      }

      const serverRes = await StoreManager.submitOrderToServer({
        storeId: storeId || 'store_aurora_01',
        items: items.map((i) => ({
          productId: i.product.id,
          variant: i.selectedVariant,
          qty: i.quantity,
        })),
        customer: {
          name: customerName.trim(),
          phone: digitsOnlyPhone,
          city: finalCity,
          address: deliveryAddress.trim(),
          landmark: landmarkNotes.trim(),
        },
        paymentMethod: mappedPaymentMethod,
        promoCode: appliedPromo?.code,
      });

      if (!serverRes.success || !serverRes.order) {
        setErrorMsg(serverRes.error || 'تعذر تسجيل الطلب في الخادم. يرجى مراجعة البيانات والمحاولة مجدداً.');
        return;
      }

      // Success: pass verified server order to parent
      onOrderSuccess(serverRes.order);
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء معالجة الطلب');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-stone-950/70 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden z-10 border border-stone-200 my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-bold" style={{ color: brand.primaryColor }}>
              إتمام الطلب وتأكيد الشحن
            </h3>
            <p className="text-xs text-stone-500">
              يرجى تعبئة بيانات التوصيل وسيتم تحويلك مباشرة للواتساب بفاتورة منسقة
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-200 text-stone-600 hover:text-stone-900 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmitOrder} className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Customer Name */}
          <div>
            <label className="block text-xs font-bold text-stone-800 mb-1">
              اسم المستلم <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="مثال: محمد عبدالله القحطاني"
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Customer WhatsApp Phone */}
          <div>
            <label className="block text-xs font-bold text-stone-800 mb-1">
              رقم الواتساب للتواصل وتتبع الشحنة <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              required
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="05XXXXXXXX أو 9665XXXXXXXX"
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              dir="ltr"
            />
          </div>

          {/* City Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                المدينة <span className="text-red-500">*</span>
              </label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm focus:outline-none"
              >
                {DEFAULT_CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {city === 'مدينة أخرى' && (
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  اكتب اسم مدينتك <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={customCity}
                  onChange={(e) => setCustomCity(e.target.value)}
                  placeholder="مثال: الخرج، دبي، الكويت..."
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Detailed Address */}
          <div>
            <label className="block text-xs font-bold text-stone-800 mb-1">
              الحي واسم الشارع أو العنوان الوطني <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder="مثال: حي النرجس، شارع أنس بن مالك، مبنى 12"
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm focus:outline-none"
            />
          </div>

          {/* Landmark Notes */}
          <div>
            <label className="block text-xs font-bold text-stone-800 mb-1">
              معلم بارز أو ملاحظات إضافية للمندوب (اختياري)
            </label>
            <input
              type="text"
              value={landmarkNotes}
              onChange={(e) => setLandmarkNotes(e.target.value)}
              placeholder="مثال: بجوار مسجد النور، الاتصال قبل الوصول"
              className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-xs focus:outline-none"
            />
          </div>

          {/* Payment Method Selector */}
          <div className="pt-2">
            <label className="block text-xs font-bold text-stone-800 mb-2">
              طريقة الدفع المفضلة:
            </label>

            <div className="space-y-2">
              {settings.paymentMethods.map((method) => {
                const isSelected = paymentMethod === method;
                return (
                  <label
                    key={method}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-50/40 text-stone-900 ring-1'
                        : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                    }`}
                    style={{
                      borderColor: isSelected ? brand.accentColor : undefined,
                    }}
                  >
                    <div className="flex items-center gap-2.5 text-xs font-semibold">
                      <input
                        type="radio"
                        name="payment"
                        value={method}
                        checked={isSelected}
                        onChange={() => setPaymentMethod(method)}
                        style={{ accentColor: brand.accentColor }}
                      />
                      <span>{method}</span>
                    </div>

                    {method.includes('استلام') ? (
                      <Banknote className="w-4 h-4 text-emerald-600" />
                    ) : method.includes('بنكي') ? (
                      <Building2 className="w-4 h-4" style={{ color: brand.accentColor }} />
                    ) : (
                      <CreditCard className="w-4 h-4 text-blue-600" />
                    )}
                  </label>
                );
              })}
            </div>

            {/* If Bank Transfer is selected, show copyable IBAN details */}
            {paymentMethod.includes('بنكي') && settings.bankDetails && settings.bankDetails.iban && (
              <div className="mt-3 p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-800">{settings.bankDetails.bankName}</span>
                  <span className="text-stone-500">حساب المتجر الرسمي</span>
                </div>
                <div className="text-stone-600">
                  <span>المستفيد: </span>
                  <span className="font-semibold text-stone-800">
                    {settings.bankDetails.accountHolder}
                  </span>
                </div>
                <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-stone-200">
                  <code className="text-stone-900 font-mono text-xs select-all" dir="ltr">
                    {settings.bankDetails.iban}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyIban}
                    className="flex items-center gap-1 text-[11px] font-bold py-0.5 px-2 rounded bg-stone-100 hover:bg-stone-200 text-stone-800 transition-colors cursor-pointer"
                  >
                    {copiedIban ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>تم النسخ!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>نسخ الآيبان</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Order Summary Box */}
          <div className="p-3.5 rounded-2xl bg-stone-100/70 border border-stone-200/80 space-y-1.5 text-xs">
            <div className="flex justify-between text-stone-600">
              <span>عدد المنتجات:</span>
              <span className="font-mono font-bold text-stone-800">
                {items.reduce((acc, i) => acc + i.quantity, 0)} قطع
              </span>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>المجموع الفرعي:</span>
              <span className="font-mono">{subtotal.toLocaleString('en-US')} {settings.currency}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>خصم الكوبون ({appliedPromo?.code}):</span>
                <span className="font-mono">-{discountAmount.toLocaleString('en-US')} {settings.currency}</span>
              </div>
            )}
            <div className="flex justify-between text-stone-600">
              <span>الشحن:</span>
              <span>
                {shippingFee === 0 ? (
                  <strong className="text-emerald-700">مجاني</strong>
                ) : (
                  <span className="font-mono">{shippingFee.toLocaleString('en-US')} {settings.currency}</span>
                )}
              </span>
            </div>
            <div className="pt-2 border-t border-stone-200 flex justify-between text-sm font-black text-stone-900">
              <span>المبلغ الإجمالي المستحق:</span>
              <span className="text-base font-mono" style={{ color: brand.accentColor }}>
                {grandTotal.toLocaleString('en-US')} {settings.currency}
              </span>
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ backgroundColor: brand.accentColor }}
              className="w-full py-4 px-4 text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg hover:brightness-105 transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري تسجيل الطلب والتحقق في الخادم...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>
                    {`تأكيد الطلب (${grandTotal.toLocaleString('en-US')} ${settings.currency})`}
                  </span>
                </>
              )}
            </button>
            <p className="text-center text-[11px] text-stone-400 mt-2">
              يتم حفظ وتسجيل الطلب بشكل مشفّر في خوادم المتجر مع إمكانية إرسال الفاتورة عبر واتساب فوراً
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
