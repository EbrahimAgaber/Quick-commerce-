import React, { useState, useEffect } from 'react';
import { CartItem, Order, PromoCode, StoreSettings } from '../../types/store';
import { StoreManager } from '../../services/storeManager';
import { normalizeArabicDigits, normalizeSaudiPhoneNumber } from '../../utils/digits';
import { trackBeginCheckout, trackPurchase } from '../../utils/analytics';
import { 
  X, 
  Send, 
  CreditCard, 
  Banknote, 
  Building2, 
  Check, 
  Copy, 
  AlertCircle, 
  Loader2, 
  ChevronLeft, 
  ChevronRight, 
  MapPin, 
  Store, 
  Truck, 
  CheckCircle2, 
  ShoppingBag, 
  ShieldCheck 
} from 'lucide-react';

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

  // Step state: 1 (Info & Delivery), 2 (Payment), 3 (Review & Confirm)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Form fields
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [city, setCity] = useState(DEFAULT_CITIES[0]);
  const [customCity, setCustomCity] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [landmarkNotes, setLandmarkNotes] = useState(orderNotes || '');
  const [paymentMethod, setPaymentMethod] = useState(settings.paymentMethods[0] || 'الدفع عند الاستلام (COD)');
  const [copiedIban, setCopiedIban] = useState(false);
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Pricing calculations
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

  // Pickup has 0 shipping fee
  const shippingFee = deliveryType === 'pickup' ? 0 : qualifiesForFreeShipping ? 0 : settings.standardShippingRate;
  const grandTotal = discountedSubtotal + shippingFee;

  // Track Begin Checkout on Open
  useEffect(() => {
    if (isOpen && items.length > 0) {
      trackBeginCheckout(items, grandTotal, settings.currency);
    }
  }, [isOpen]);

  const handlePhoneChange = (val: string) => {
    const normalized = normalizeArabicDigits(val);
    setCustomerPhone(normalized);
    if (normalized.trim()) {
      const check = normalizeSaudiPhoneNumber(normalized);
      if (!check.isValid && normalized.length >= 8) {
        setPhoneError('تنبيه: تأكد من كتابة رقم جوال سعودي صحيح (مثال: 0512345678)');
      } else {
        setPhoneError(null);
      }
    } else {
      setPhoneError(null);
    }
  };

  const handleCopyIban = () => {
    if (settings.bankDetails?.iban) {
      navigator.clipboard.writeText(settings.bankDetails.iban);
      setCopiedIban(true);
      setTimeout(() => setCopiedIban(false), 2000);
    }
  };

  const handleGetLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      alert('المتصفح لا يدعم تحديد الموقع التلقائي. يمكنك كتابة العنوان يدوياً.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
        setGoogleMapsUrl(mapsUrl);
        if (!deliveryAddress.trim()) {
          setDeliveryAddress(`موقع محدد عبر الخريطة (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
        }
        setIsLocating(false);
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setIsLocating(false);
        alert('تعذر الوصول إلى موقعك تلقائياً. يرجى السماح بالوصول للموقع في المتصفح أو إدخال العنوان يدوياً.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Validate step 1 and advance
  const handleNextFromStep1 = () => {
    setErrorMsg('');
    if (!customerName.trim() || customerName.trim().length < 2) {
      setErrorMsg('يرجى كتابة الاسم الكريم للمستلم');
      return;
    }

    const phoneCheck = normalizeSaudiPhoneNumber(customerPhone);
    const digitsOnly = normalizeArabicDigits(customerPhone).replace(/\D/g, '');
    if (!phoneCheck.isValid && (digitsOnly.length < 8 || digitsOnly.length > 15)) {
      setErrorMsg('يرجى إدخال رقم جوال واتساب صحيح للتواصل وتأكيد الشحن');
      return;
    }

    if (deliveryType === 'delivery') {
      if (city === 'مدينة أخرى' && !customCity.trim()) {
        setErrorMsg('يرجى كتابة اسم مدينتك في الحقل المخصص');
        return;
      }
      if (!deliveryAddress.trim()) {
        setErrorMsg('يرجى تدوين عنوان التوصيل أو الحي');
        return;
      }
    }

    setCurrentStep(2);
  };

  // Submit Order
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const phoneCheck = normalizeSaudiPhoneNumber(customerPhone);
    const finalPhone = phoneCheck.isValid ? phoneCheck.normalized : normalizeArabicDigits(customerPhone).replace(/\D/g, '');
    const finalCity = deliveryType === 'pickup' 
      ? (settings.city || 'الفرع الرئيسي') 
      : city === 'مدينة أخرى' ? customCity.trim() : city;
    const finalAddress = deliveryType === 'pickup' 
      ? (settings.storePickupAddress || 'استلام مباشر من مقر المتجر') 
      : deliveryAddress.trim();

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
          phone: finalPhone,
          city: finalCity,
          address: finalAddress,
          landmark: landmarkNotes.trim(),
          googleMapsUrl: googleMapsUrl.trim(),
          deliveryType,
        },
        paymentMethod: mappedPaymentMethod,
        promoCode: appliedPromo?.code,
      });

      if (!serverRes.success || !serverRes.order) {
        setErrorMsg(serverRes.error || 'تعذر تسجيل الطلب في الخادم. يرجى مراجعة البيانات والمحاولة مجدداً.');
        return;
      }

      // Track purchase event across marketing pixels
      trackPurchase(serverRes.order, settings.currency);

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

      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden z-10 border border-stone-200 my-auto flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-black" style={{ color: brand.primaryColor }}>
              إتمام الطلب والدفع
            </h3>
            <p className="text-xs text-stone-500">
              تسوق آمن ومحمي 100% — متوافق مع مواصفات التجارة الإلكترونية
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-200 text-stone-600 hover:text-stone-900 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stepper Indicator */}
        <div className="px-5 py-3 bg-stone-100/60 border-b border-stone-200 flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${
                currentStep >= 1 ? 'bg-stone-900 text-white' : 'bg-stone-300 text-stone-600'
              }`}
            >
              1
            </span>
            <span className={currentStep === 1 ? 'text-stone-900 font-extrabold' : 'text-stone-500'}>
              بيانات التوصيل
            </span>
          </div>

          <div className="h-0.5 w-8 bg-stone-300 mx-1" />

          <div className="flex items-center gap-1.5">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${
                currentStep >= 2 ? 'bg-stone-900 text-white' : 'bg-stone-300 text-stone-600'
              }`}
            >
              2
            </span>
            <span className={currentStep === 2 ? 'text-stone-900 font-extrabold' : 'text-stone-500'}>
              طريقة الدفع
            </span>
          </div>

          <div className="h-0.5 w-8 bg-stone-300 mx-1" />

          <div className="flex items-center gap-1.5">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${
                currentStep === 3 ? 'bg-stone-900 text-white' : 'bg-stone-300 text-stone-600'
              }`}
            >
              3
            </span>
            <span className={currentStep === 3 ? 'text-stone-900 font-extrabold' : 'text-stone-500'}>
              تأكيد الطلب
            </span>
          </div>
        </div>

        {/* Error Banner */}
        {errorMsg && (
          <div className="m-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Body based on current step */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* STEP 1: Info & Delivery */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">
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
                  placeholder="الاسم الكامل (مثال: محمد عبدالله القحطاني)"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Customer Phone (with live digit normalization) */}
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  رقم الجوال / الواتساب <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="05XXXXXXXX"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  dir="ltr"
                />
                {phoneError && (
                  <p className="text-[11px] text-amber-700 mt-1">{phoneError}</p>
                )}
                <p className="text-[10px] text-stone-400 mt-0.5">
                  يدعم الأرقام العربية والإنجليزية (يتم التنسيق تلقائياً)
                </p>
              </div>

              {/* Delivery or Store Pickup Toggle */}
              {settings.enableStorePickup && (
                <div className="pt-1">
                  <label className="block text-xs font-bold text-stone-800 mb-1.5">
                    طريقة الاستلام:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDeliveryType('delivery')}
                      className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        deliveryType === 'delivery'
                          ? 'border-blue-600 bg-blue-50/50 text-blue-900 ring-1 ring-blue-500'
                          : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      <Truck className="w-4 h-4 text-blue-600" />
                      <span>توصيل للمنزل</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeliveryType('pickup')}
                      className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        deliveryType === 'pickup'
                          ? 'border-emerald-600 bg-emerald-50/50 text-emerald-900 ring-1 ring-emerald-500'
                          : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      <Store className="w-4 h-4 text-emerald-600" />
                      <span>استلام من الفرع (مجاناً)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Delivery Address Fields */}
              {deliveryType === 'delivery' ? (
                <>
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
                          placeholder="مثال: الخرج، حوطة بني تميم..."
                          className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  {/* Detailed Address */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-stone-800">
                        الحي واسم الشارع أو العنوان الوطني <span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleGetLocation}
                        disabled={isLocating}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                      >
                        <MapPin className="w-3.5 h-3.5 text-blue-600" />
                        <span>{isLocating ? 'جاري تحديد موقعك...' : 'تحديد موقعي التلقائي (GPS)'}</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="مثال: حي الياسمين، شارع أنس بن مالك، فيلا 12"
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm focus:outline-none"
                    />
                    {googleMapsUrl && (
                      <div className="mt-1.5 p-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>تم ربط إحداثيات موقعك بالخريطة للمندوب</span>
                        </span>
                        <a
                          href={googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] underline text-blue-700 font-bold"
                        >
                          معاينة
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Landmark Notes */}
                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      معلم بارز أو ملاحظات للمندوب (اختياري)
                    </label>
                    <input
                      type="text"
                      value={landmarkNotes}
                      onChange={(e) => setLandmarkNotes(e.target.value)}
                      placeholder="مثال: بجوار جامع النور، شقة الدور الثاني"
                      className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-xs focus:outline-none"
                    />
                  </div>
                </>
              ) : (
                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-1 text-xs">
                  <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <Store className="w-4 h-4 text-emerald-700" />
                    <span>عنوان الاستلام من مقر المتجر:</span>
                  </div>
                  <p className="text-emerald-800 font-medium">
                    {settings.storePickupAddress || 'الفرع الرئيسي للمتجر — سيتم إرسال الموقع والتفاصيل عبر الواتساب فور تأكيد الطلب.'}
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={handleNextFromStep1}
                className="w-full py-3.5 px-4 bg-stone-900 hover:bg-stone-800 text-white rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer mt-4"
              >
                <span>المتابعة إلى طريقة الدفع</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 2: Payment Method */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <label className="block text-xs font-bold text-stone-800 mb-2">
                اختر وسيلة الدفع المناسبة لك:
              </label>

              <div className="space-y-2.5">
                {settings.paymentMethods.map((method) => {
                  const isSelected = paymentMethod === method;
                  return (
                    <label
                      key={method}
                      className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-blue-50/40 text-stone-900 ring-2'
                          : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                      }`}
                      style={{
                        borderColor: isSelected ? brand.accentColor : undefined,
                      }}
                    >
                      <div className="flex items-center gap-2.5 text-xs font-bold">
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
              {paymentMethod.includes('بنكي') && settings.bankDetails?.iban && (
                <div className="mt-3 p-3.5 rounded-2xl bg-stone-50 border border-stone-200 space-y-2 text-xs">
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

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-4 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-2xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>رجوع</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="flex-1 py-3 px-4 bg-stone-900 hover:bg-stone-800 text-white rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <span>مراجعة وتأكيد الطلب</span>
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Review & Confirm */}
          {currentStep === 3 && (
            <form onSubmit={handleSubmitOrder} className="space-y-4 animate-in fade-in duration-200">
              {/* Order items preview */}
              <div className="border border-stone-200 rounded-2xl p-3.5 bg-stone-50 space-y-2">
                <span className="text-xs font-bold text-stone-800 block">
                  المنتجات المطلوبة ({items.reduce((s, i) => s + i.quantity, 0)} قطع):
                </span>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-xs text-stone-700">
                      <span>{item.quantity}× {item.product.name} {item.selectedVariant ? `(${item.selectedVariant})` : ''}</span>
                      <span className="font-mono font-bold">
                        {((item.product.salePrice || item.product.price) * item.quantity).toLocaleString('en-US')} {settings.currency}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Delivery and payment preview */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-0.5">
                  <span className="text-stone-400 block text-[10px]">المستلم:</span>
                  <p className="font-bold text-stone-900 truncate">{customerName}</p>
                  <p className="font-mono text-stone-600 text-[11px]" dir="ltr">{customerPhone}</p>
                </div>
                <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-0.5">
                  <span className="text-stone-400 block text-[10px]">طريقة الدفع:</span>
                  <p className="font-bold text-stone-900 truncate">{paymentMethod}</p>
                  <p className="text-stone-600 text-[11px]">
                    {deliveryType === 'pickup' ? 'استلام من الفرع' : city}
                  </p>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="p-3.5 rounded-2xl bg-stone-100/80 border border-stone-200 space-y-1.5 text-xs">
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
                  <span>الشحن والتوصيل:</span>
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
                  <span className="text-base font-mono font-black" style={{ color: brand.accentColor }}>
                    {grandTotal.toLocaleString('en-US')} {settings.currency}
                  </span>
                </div>
              </div>

              {/* Submit CTA */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-3.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-2xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>رجوع</span>
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{ backgroundColor: brand.accentColor }}
                  className="flex-1 py-3.5 px-4 text-white rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg hover:brightness-105 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري إرسال وتوثيق الطلب...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>{`تأكيد الطلب (${grandTotal.toLocaleString('en-US')} ${settings.currency})`}</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-stone-500 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>طلبك محمي ومشفر بالكامل لدى المتجر</span>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
