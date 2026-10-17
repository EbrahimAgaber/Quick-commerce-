import React, { useState } from 'react';
import { CartItem, Order, StoreSettings } from '../../types/store';
import { generateOrderId, buildWhatsAppInvoiceMessage, createWhatsAppUrl } from '../../utils/whatsappInvoice';
import { X, Send, CreditCard, Banknote, Building2, Check, Copy, AlertCircle } from 'lucide-react';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  settings: StoreSettings;
  orderNotes: string;
  onOrderSuccess: (order: Order) => void;
}

const SAUDI_CITIES = [
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
  onOrderSuccess,
}) => {
  if (!isOpen) return null;

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [city, setCity] = useState(SAUDI_CITIES[0]);
  const [customCity, setCustomCity] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [landmarkNotes, setLandmarkNotes] = useState(orderNotes || '');
  const [paymentMethod, setPaymentMethod] = useState(settings.paymentMethods[0] || 'الدفع عند الاستلام (COD)');
  const [copiedIban, setCopiedIban] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const subtotal = items.reduce((sum, item) => {
    const price = item.product.salePrice ?? item.product.price;
    return sum + price * item.quantity;
  }, 0);

  const qualifiesForFreeShipping = subtotal >= settings.freeShippingThreshold;
  const shippingFee = qualifiesForFreeShipping ? 0 : settings.standardShippingRate;
  const grandTotal = subtotal + shippingFee;

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

    if (!customerName.trim()) {
      setErrorMsg('يرجى كتابة الاسم الكريم للمستلم');
      return;
    }

    if (!customerPhone.trim() || customerPhone.length < 8) {
      setErrorMsg('يرجى إدخال رقم هاتف واتساب صالح للتواصل وتأكيد الشحن');
      return;
    }

    const finalCity = city === 'مدينة أخرى' ? customCity.trim() || 'المملكة العربية السعودية' : city;

    if (!deliveryAddress.trim()) {
      setErrorMsg('يرجى تدوين عنوان التوصيل أو الحي');
      return;
    }

    setIsSubmitting(true);

    try {
      const orderId = generateOrderId('BA');
      const itemsSummary = items
        .map(
          (i) =>
            `${i.quantity}x ${i.product.name}${
              i.selectedVariant ? ` (${i.selectedVariant})` : ''
            } - ${(i.product.salePrice ?? i.product.price) * i.quantity} ${settings.currency}`
        )
        .join(', ');

      const orderItems = items.map((i) => ({
        productId: i.product.id,
        name: i.product.name,
        variant: i.selectedVariant,
        price: i.product.salePrice ?? i.product.price,
        quantity: i.quantity,
        imageUrl: i.product.imageUrl,
      }));

      const newOrder: Order = {
        id: orderId,
        timestamp: new Date().toISOString(),
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        city: finalCity,
        deliveryAddress: deliveryAddress.trim(),
        landmarkNotes: landmarkNotes.trim(),
        paymentMethod,
        itemsSummary,
        items: orderItems,
        subtotal,
        shippingFee,
        grandTotal,
        status: 'Received',
        trackingNotes: 'تم استلام الطلب وتأكيده بنجاح.',
      };

      // Build WhatsApp message
      const whatsappMsg = buildWhatsAppInvoiceMessage(newOrder, settings);
      const whatsappUrl = createWhatsAppUrl(settings.whatsappNumber, whatsappMsg);

      // Open WhatsApp window smoothly
      window.open(whatsappUrl, '_blank');

      // Trigger success callback
      onOrderSuccess(newOrder);
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء معالجة الطلب');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-stone-950/70 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden z-10 border border-stone-200 my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-stone-900">
              إتمام الطلب وتأكيد الشحن
            </h3>
            <p className="text-xs text-stone-500">
              يرجى تعبئة بيانات التوصيل وسيتم تحويلك مباشرة للواتساب بفاتورة منسقة
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-200 text-stone-600 hover:text-stone-900 flex items-center justify-center transition-colors"
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
              اسم المستلم الثلاثي <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="مثال: ريم محمد القحطاني"
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600"
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
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600"
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
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              >
                {SAUDI_CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {city === 'مدينة أخرى' && (
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  اكتبي اسم مدينتك
                </label>
                <input
                  type="text"
                  value={customCity}
                  onChange={(e) => setCustomCity(e.target.value)}
                  placeholder="مثال: الخرج، الدوادمي..."
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
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
              placeholder="مثال: حي النرجس، شارع أنس بن مالك، فيلا 12"
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600"
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
              className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30"
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
                        ? 'border-amber-600 bg-amber-50/40 text-stone-900 ring-1 ring-amber-600'
                        : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 text-xs font-semibold">
                      <input
                        type="radio"
                        name="payment"
                        value={method}
                        checked={isSelected}
                        onChange={() => setPaymentMethod(method)}
                        className="text-amber-600 focus:ring-amber-500"
                      />
                      <span>{method}</span>
                    </div>

                    {method.includes('استلام') ? (
                      <Banknote className="w-4 h-4 text-emerald-600" />
                    ) : method.includes('بنكي') ? (
                      <Building2 className="w-4 h-4 text-amber-700" />
                    ) : (
                      <CreditCard className="w-4 h-4 text-blue-600" />
                    )}
                  </label>
                );
              })}
            </div>

            {/* If Bank Transfer is selected, show copyable IBAN details */}
            {paymentMethod.includes('بنكي') && settings.bankDetails && (
              <div className="mt-3 p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-800">{settings.bankDetails.bankName}</span>
                  <span className="text-stone-500">حساب المؤسسة الرسمي</span>
                </div>
                <div className="text-stone-600">
                  <span>المستفيد: </span>
                  <span className="font-semibold text-stone-800">
                    {settings.bankDetails.accountHolder}
                  </span>
                </div>
                <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-stone-200">
                  <code className="text-stone-900 font-mono text-xs select-all">
                    {settings.bankDetails.iban}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyIban}
                    className="flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-800 py-0.5 px-2 rounded bg-amber-50 transition-colors"
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
              <span>{subtotal.toLocaleString('ar-SA')} {settings.currency}</span>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>الشحن:</span>
              <span>
                {shippingFee === 0 ? (
                  <strong className="text-emerald-700">مجاني</strong>
                ) : (
                  `${shippingFee.toLocaleString('ar-SA')} ${settings.currency}`
                )}
              </span>
            </div>
            <div className="pt-2 border-t border-stone-200 flex justify-between text-sm font-black text-stone-900">
              <span>المبلغ الإجمالي المستحق:</span>
              <span className="text-amber-800 text-base">
                {grandTotal.toLocaleString('ar-SA')} {settings.currency}
              </span>
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-98 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'جاري تجهيز الطلب...'
                  : `تأكيد وإرسال الفاتورة عبر واتساب (${grandTotal.toLocaleString('ar-SA')} ${settings.currency})`}
              </span>
            </button>
            <p className="text-center text-[11px] text-stone-400 mt-2">
              بمجرد الضغط سيتم تسجيل الطلب في سجلات المتجر وفتح محادثة واتساب جاهزة مع خدمة العملاء
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
