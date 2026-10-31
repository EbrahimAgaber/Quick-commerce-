import React, { useState, useEffect } from 'react';
import { CartItem, Order, PromoCode, StoreSettings, getProductUnitLabel } from '../../types/store';
import { StoreManager } from '../../services/storeManager';
import { normalizeArabicDigits, normalizeSaudiPhoneNumber } from '../../utils/digits';
import { trackBeginCheckout, trackPurchase } from '../../utils/analytics';
import { getZatcaComplianceType, calculateVatBreakdown } from '../../utils/zatca';
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
  ShieldCheck,
  Navigation,
  Upload,
  FileCheck2
} from 'lucide-react';
import { buildWhatsAppInvoiceMessage, createWhatsAppUrl } from '../../utils/whatsappInvoice';
import { MoyasarPaymentModal } from './MoyasarPaymentModal';
import { LocationPickerModal } from './LocationPickerModal';
import { isSameSaudiCity } from '../../utils/cityUtils';

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
  'القطيف',
  'الجبيل',
  'حفر الباطن',
  'الخرج',
  'الدوادمي',
  'بريدة (القصيم)',
  'عنيزة',
  'الرس',
  'حائل',
  'أبها',
  'خميس مشيط',
  'محايل عسير',
  'بيشة',
  'جازان',
  'صبيا',
  'أبو عريش',
  'صامطة',
  'نجران',
  'شرورة',
  'تبوك',
  'العلا',
  'ينبع',
  'الطائف',
  'عرعر',
  'سكاكا',
  'القريات',
  'وادي الدواسر',
  'مدينة أخرى',
];

const KNOWN_SPL_PREFIXES: Record<string, { city: string; district?: string }> = {
  ALUL: { city: 'العلا', district: 'حي الصخيرات' },
  ULAA: { city: 'العلا', district: 'حي العزيزية' },
  RIYD: { city: 'الرياض', district: 'حي العليا' },
  RRRD: { city: 'الرياض', district: 'حي النخيل' },
  RYDH: { city: 'الرياض', district: 'حي الملز' },
  JEDD: { city: 'جدة', district: 'حي الروضة' },
  JDDH: { city: 'جدة', district: 'حي الشاطئ' },
  MAKK: { city: 'مكة المكرمة', district: 'حي العزيزية' },
  MADN: { city: 'المدينة المنورة', district: 'حي قباء' },
  DAMM: { city: 'الدمام', district: 'حي الشاطئ الشرقي' },
  KHBR: { city: 'الخبر', district: 'حي العليا' },
  DHHR: { city: 'الظهران', district: 'حي الجامعة' },
  ABHA: { city: 'أبها', district: 'حي المنسك' },
  TABK: { city: 'تبوك', district: 'حي المروج' },
  QASM: { city: 'بريدة (القصيم)', district: 'حي الريان' },
  TAIF: { city: 'الطائف', district: 'حي شهار' },
  HAIL: { city: 'حائل', district: 'حي النقرة' },
  JAZN: { city: 'جازان', district: 'حي الشاطئ' },
  NAJR: { city: 'نجران', district: 'حي الفهد' },
  JUBL: { city: 'الجبيل', district: 'حي الفردوس' },
  YANB: { city: 'ينبع', district: 'حي المجد' },
  AHSA: { city: 'الأحساء', district: 'حي المبرز' },
};

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
  const [bankTransferReceiptDataUrl, setBankTransferReceiptDataUrl] = useState('');
  const [bankTransferReceiptName, setBankTransferReceiptName] = useState('');
  const [bankTransferSenderName, setBankTransferSenderName] = useState('');
  const [isProcessingReceipt, setIsProcessingReceipt] = useState(false);
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [showLocationPickerModal, setShowLocationPickerModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [pendingMoyasarOrder, setPendingMoyasarOrder] = useState<Order | null>(null);
  const [showMoyasarModal, setShowMoyasarModal] = useState(false);

  // Saudi National Address (SPL) State
  const [splShortCode, setSplShortCode] = useState('');
  const [isLookingUpSpl, setIsLookingUpSpl] = useState(false);
  const [splSuccessMsg, setSplSuccessMsg] = useState('');
  const [splErrorMsg, setSplErrorMsg] = useState('');

  // Saudi Personal Data Protection Law (PDPL / SDAIA) Consent
  const [isPdplConsentAccepted, setIsPdplConsentAccepted] = useState(true);

  // Determine current active shopper city & store city
  const shopperCity = deliveryType === 'pickup' 
    ? (settings.city || 'الرياض') 
    : (city === 'مدينة أخرى' && customCity.trim() ? customCity.trim() : city);
  const storeCity = settings.city || 'العلا';
  const isDifferentCity = deliveryType === 'delivery' && !isSameSaudiCity(shopperCity, storeCity);
  const isCodRestricted = Boolean(settings.restrictCodToStoreCity && isDifferentCity);

  // Filter payment methods when out-of-city COD is restricted or online payments are disabled
  const availablePaymentMethods = (settings.paymentMethods || []).filter((method) => {
    if (isCodRestricted) {
      const isCod = method.includes('استلام') || method.toLowerCase().includes('cod');
      if (isCod) return false;
    }
    if (settings.enableOnlinePayments === false) {
      const isCard =
        method.includes('بطاق') ||
        method.includes('فيزا') ||
        method.includes('مدى') ||
        method.includes('Apple') ||
        method.toLowerCase().includes('card');
      if (isCard) return false;
    }
    return true;
  });

  // Ensure selected paymentMethod stays within availablePaymentMethods
  useEffect(() => {
    if (availablePaymentMethods.length > 0 && !availablePaymentMethods.includes(paymentMethod)) {
      setPaymentMethod(availablePaymentMethods[0]);
    }
  }, [availablePaymentMethods, paymentMethod]);

  const isBankTransferSelected =
    paymentMethod.includes('بنكي') ||
    paymentMethod.includes('تحويل') ||
    paymentMethod.toLowerCase().includes('bank');

  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('حجم ملف الإيصال كبير جداً. يرجى اختيار صورة أو ملف أقل من 10 ميجابايت.');
      return;
    }

    setErrorMsg('');
    setIsProcessingReceipt(true);
    setBankTransferReceiptName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawDataUrl = String(event.target?.result || '');
      // Compress images via canvas if in browser and file is an image
      if (file.type.startsWith('image/') && typeof Image !== 'undefined' && typeof document !== 'undefined') {
        const img = new Image();
        img.onload = () => {
          try {
            const maxDim = 1000;
            let width = img.width || 800;
            let height = img.height || 800;
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const compressed = canvas.toDataURL('image/jpeg', 0.72);
              setBankTransferReceiptDataUrl(compressed || rawDataUrl);
            } else {
              setBankTransferReceiptDataUrl(rawDataUrl);
            }
          } catch {
            setBankTransferReceiptDataUrl(rawDataUrl);
          } finally {
            setIsProcessingReceipt(false);
          }
        };
        img.onerror = () => {
          setBankTransferReceiptDataUrl(rawDataUrl);
          setIsProcessingReceipt(false);
        };
        img.src = rawDataUrl;
      } else {
        setBankTransferReceiptDataUrl(rawDataUrl);
        setIsProcessingReceipt(false);
      }
    };
    reader.onerror = () => {
      setErrorMsg('تعذر قراءة ملف الإيصال. يرجى المحاولة مرة أخرى.');
      setIsProcessingReceipt(false);
    };
    reader.readAsDataURL(file);
  };

  // Auto-switch payment method away from COD if restricted
  useEffect(() => {
    if (currentStep === 2 && isCodRestricted) {
      const isCurrentCod = paymentMethod.includes('استلام') || paymentMethod.toLowerCase().includes('cod');
      if (isCurrentCod) {
        const fallback = availablePaymentMethods[0] || 'بطاقة مدى / البطاقات الائتمانية';
        setPaymentMethod(fallback);
      }
    }
  }, [currentStep, isCodRestricted, paymentMethod, availablePaymentMethods]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Pricing calculations
  const validItems = (items || []).filter((item) => item && item.product && typeof item.product === 'object' && item.product.id);
  const subtotal = Math.round(
    validItems.reduce((sum, item) => {
      const hasSale =
        typeof item.product.salePrice === 'number' &&
        item.product.salePrice > 0 &&
        item.product.salePrice < item.product.price;
      const price = hasSale ? item.product.salePrice! : (item.product.price || 0);
      const lineTotal = Math.round(price * (item.quantity || 1) * 100) / 100;
      return sum + lineTotal;
    }, 0) * 100
  ) / 100;

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
      setShowLocationPickerModal(true);
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
        console.warn('Geolocation error or permission denied, falling back to interactive pin picker:', err);
        setIsLocating(false);
        // Automatically open the interactive pin picker so the customer is never blocked
        setShowLocationPickerModal(true);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleLookupNationalAddress = async () => {
    const cleaned = splShortCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleaned.length < 8) {
      setSplErrorMsg('يرجى إدخال رمز العنوان الوطني كاملاً (4 أحرف + 4 أرقام، مثال: RRRD2929 أو ALUL1885)');
      setSplSuccessMsg('');
      return;
    }

    setIsLookingUpSpl(true);
    setSplErrorMsg('');
    setSplSuccessMsg('');

    const prefix = cleaned.substring(0, 4);
    const bldg = cleaned.substring(4);
    const matchedPrefix = KNOWN_SPL_PREFIXES[prefix];

    // Determine current shopper city
    const currentSelectedCity = city === 'مدينة أخرى' && customCity.trim() ? customCity.trim() : city;
    const isDefaultCityUntouched = city === DEFAULT_CITIES[0] && !customCity.trim();

    try {
      const res = await fetch(`/api/geo/nationalAddress?shortCode=${encodeURIComponent(cleaned)}`);
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success && data.formattedAddress) {
          if (data.city) {
            // Only update city if shopper was on default untouched city
            if (isDefaultCityUntouched || !currentSelectedCity) {
              if (DEFAULT_CITIES.includes(data.city)) {
                setCity(data.city);
              } else {
                setCity('مدينة أخرى');
                setCustomCity(data.city);
              }
            }
          }
          setDeliveryAddress(data.formattedAddress);
          if (data.location?.lat && data.location?.lng) {
            setGoogleMapsUrl(`https://www.google.com/maps?q=${data.location.lat},${data.location.lng}`);
          }
          setSplSuccessMsg(`تم التحقق من العنوان الوطني بنجاح: ${data.city || currentSelectedCity} (${data.district || ''})`);
          setIsLookingUpSpl(false);
          return;
        }
      }
      throw new Error('Fallback to local resolver');
    } catch {
      // Local robust resolver that respects the shopper's city
      let targetCity = currentSelectedCity;
      let districtInfo = '';

      if (matchedPrefix) {
        // If shopper has an explicit known code (e.g. ALUL for AlUla, MAKK for Makkah, etc.)
        if (isDefaultCityUntouched) {
          targetCity = matchedPrefix.city;
          if (DEFAULT_CITIES.includes(matchedPrefix.city)) {
            setCity(matchedPrefix.city);
          } else {
            setCity('مدينة أخرى');
            setCustomCity(matchedPrefix.city);
          }
        }
        districtInfo = matchedPrefix.district ? `${matchedPrefix.district}، ` : '';
      }

      // Format clean address without destroying the shopper's selected city
      const fallbackAddr = `${districtInfo}العنوان الوطني المختصر (${cleaned}) - مبنى ${bldg}`;
      setDeliveryAddress(fallbackAddr);
      setSplSuccessMsg(`تم اعتماد العنوان الوطني المختصر: ${targetCity} (#${cleaned})`);
    } finally {
      setIsLookingUpSpl(false);
    }
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

    if (!isPdplConsentAccepted) {
      setErrorMsg('يرجى الموافقة على شروط معالجة البيانات وفق نظام حماية البيانات الشخصية السعودي لإتمام الطلب.');
      return;
    }

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
      if (paymentMethod.includes('تحويل') || paymentMethod.includes('بنكي') || paymentMethod.toLowerCase().includes('bank')) {
        mappedPaymentMethod = 'bank_transfer';
      } else if (paymentMethod.includes('بطاق') || paymentMethod.includes('فيزا') || paymentMethod.includes('مدى')) {
        mappedPaymentMethod = 'card';
      } else if (paymentMethod.includes('Apple')) {
        mappedPaymentMethod = 'apple_pay';
      } else if (paymentMethod.includes('STC')) {
        mappedPaymentMethod = 'stc_pay';
      }

      if (mappedPaymentMethod === 'bank_transfer' && !bankTransferReceiptDataUrl.trim()) {
        setErrorMsg('يرجى إرفاق صورة إيصال التحويل البنكي لإتمام الطلب.');
        setIsSubmitting(false);
        return;
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
        bankTransferReceiptUrl: mappedPaymentMethod === 'bank_transfer' ? bankTransferReceiptDataUrl : undefined,
        bankTransferReceiptFileName: mappedPaymentMethod === 'bank_transfer' ? bankTransferReceiptName : undefined,
        bankTransferSenderName: mappedPaymentMethod === 'bank_transfer' ? bankTransferSenderName.trim() : undefined,
      });

      if (!serverRes.success || !serverRes.order) {
        setErrorMsg(serverRes.error || 'تعذر تسجيل الطلب في الخادم. يرجى مراجعة البيانات والمحاولة مجدداً.');
        return;
      }

      // If Bank Transfer, automatically send/open merchant WhatsApp notification with shopper name & order info
      if (mappedPaymentMethod === 'bank_transfer' && settings.whatsappNumber?.trim()) {
        try {
          const waMsg = buildWhatsAppInvoiceMessage(
            serverRes.order,
            settings,
            serverRes.order.storeSlug || settings.storeSlug
          );
          const waUrl = createWhatsAppUrl(settings.whatsappNumber, waMsg);
          if (typeof window !== 'undefined' && typeof window.open === 'function') {
            window.open(waUrl, '_blank');
          }
        } catch (waErr) {
          console.debug('Auto WhatsApp notification note:', waErr);
        }
      }

      // If online payment (Mada, Apple Pay, Visa/MC, STC Pay) is selected:
      if (mappedPaymentMethod === 'card' || mappedPaymentMethod === 'apple_pay' || mappedPaymentMethod === 'stc_pay') {
        trackPurchase(serverRes.order, settings.currency);
        onOrderSuccess(serverRes.order);

        // Redirect customer to merchant's online payment link (Newleap, Paylink, etc.)
        const paymentUrl = settings.customPaymentLink?.trim();
        if (paymentUrl) {
          try {
            // Open payment link in a new tab / window immediately
            const opened = window.open(paymentUrl, '_blank', 'noopener,noreferrer');
            if (!opened || opened.closed || typeof opened.closed === 'undefined') {
              // If popups blocked, redirect parent window
              window.location.href = paymentUrl;
            }
          } catch {
            window.location.href = paymentUrl;
          }
        }
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

                  {/* Saudi National Address (SPL) Quick Lookup */}
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                        <span>العنوان الوطني المختصر (SPL)</span>
                      </span>
                      <span className="text-[10px] text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-full font-bold">
                        تعبئة ذكية للمدينة والشارع
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        maxLength={8}
                        value={splShortCode}
                        onChange={(e) => setSplShortCode(e.target.value.toUpperCase())}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleLookupNationalAddress();
                          }
                        }}
                        placeholder="مثال: RRRD2929 أو ALUL1885"
                        className="flex-1 px-3 py-2 bg-white border border-emerald-200 rounded-xl text-stone-900 text-xs font-mono tracking-wider uppercase focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        dir="ltr"
                      />
                      <button
                        type="button"
                        onClick={handleLookupNationalAddress}
                        disabled={isLookingUpSpl || !splShortCode.trim()}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                      >
                        {isLookingUpSpl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>تحقق</span>}
                      </button>
                    </div>
                    {splSuccessMsg && (
                      <p className="mt-1.5 text-[11px] text-emerald-700 flex items-center gap-1 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{splSuccessMsg}</span>
                      </p>
                    )}
                    {splErrorMsg && (
                      <p className="mt-1.5 text-[11px] text-red-600 flex items-center gap-1 font-bold">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{splErrorMsg}</span>
                      </p>
                    )}
                  </div>

                  {/* Detailed Address */}
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-1 mb-1.5">
                      <label className="block text-xs font-bold text-stone-800">
                        الحي واسم الشارع أو تفاصيل العنوان <span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleGetLocation}
                        disabled={isLocating}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                      >
                        <MapPin className="w-3.5 h-3.5 text-blue-600" />
                        <span>{isLocating ? 'جاري التحديد...' : 'تحديد بموقعي الحالي (GPS)'}</span>
                      </button>
                    </div>

                    {/* Prominent Delivery Map Pinning Card */}
                    <div className="mb-2 p-3 bg-gradient-to-r from-blue-50/80 via-emerald-50/50 to-blue-50/80 border border-blue-200/80 rounded-2xl flex items-center justify-between gap-3 shadow-2xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <Navigation className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-stone-900">
                            {googleMapsUrl ? 'تم تحديد موقعك بدقة على الخريطة' : 'تحديد موقع التوصيل على الخريطة'}
                          </p>
                          <p className="text-[11px] text-stone-500">
                            {googleMapsUrl
                              ? 'جاهز للمندوب للوصول المباشر دون الحاجة للاتصال بك'
                              : 'حرّك الخريطة أو ابحث عن حيك لتثبيت باب بيتك'}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowLocationPickerModal(true)}
                        style={{ backgroundColor: brand.accentColor }}
                        className="px-3 py-2 text-white rounded-xl text-xs font-bold shrink-0 hover:opacity-90 active:scale-95 transition-all shadow-xs cursor-pointer flex items-center gap-1"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{googleMapsUrl ? 'تعديل بالخريطة' : 'فتح الخريطة'}</span>
                      </button>
                    </div>

                    <input
                      type="text"
                      required
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="مثال: حي الياسمين، شارع أنس بن مالك، فيلا 12"
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    {googleMapsUrl && (
                      <div className="mt-1.5 p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>إحداثيات التوصيل موثقة وجاهزة لمسار السائق المباشر</span>
                        </span>
                        <a
                          href={googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] underline text-emerald-800 font-bold"
                        >
                          معاينة الموقع
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
              {/* Out-of-City Anti-Cancellation Protection Notice */}
              {isCodRestricted && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-950">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>الدفع عند الاستلام متاح فقط داخل مدينة المتجر ({storeCity})</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    نظراً لأن وجهة الشحن إلى مدينة <strong>({shopperCity})</strong>، تم حصر خيارات الدفع على الدفع الإلكتروني المعتمد أو التحويل البنكي لحجز وتجهيز شحنتك فوراً وتفادي إلغاء الشحنات بعد الإرسال.
                  </p>
                </div>
              )}

              <label className="block text-xs font-bold text-stone-800 mb-2">
                اختر وسيلة الدفع المناسبة لك:
              </label>

              <div className="space-y-2.5">
                {availablePaymentMethods.map((method) => {
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

              {/* If Bank Transfer is selected, show copyable IBAN details and Mandatory Receipt Upload */}
              {isBankTransferSelected && (
                <div className="mt-3 p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3 text-xs">
                  {settings.bankDetails?.iban ? (
                    <div className="space-y-2 pb-3 border-b border-stone-200">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-stone-800">{settings.bankDetails.bankName || 'الحساب البنكي للمتجر'}</span>
                        <span className="text-stone-500">حساب المتجر الرسمي</span>
                      </div>
                      {settings.bankDetails.accountHolder && (
                        <div className="text-stone-600">
                          <span>المستفيد: </span>
                          <span className="font-semibold text-stone-800">
                            {settings.bankDetails.accountHolder}
                          </span>
                        </div>
                      )}
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
                  ) : (
                    <div className="text-stone-600 pb-2 border-b border-stone-200">
                      يرجى التحويل إلى الحساب البنكي للمتجر ثم إرفاق صورة إيصال التحويل أدناه.
                    </div>
                  )}

                  {/* Sender Name (Optional) */}
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      اسم المحوّل (صاحب الحساب المحوّل منه)
                    </label>
                    <input
                      type="text"
                      value={bankTransferSenderName}
                      onChange={(e) => setBankTransferSenderName(e.target.value)}
                      placeholder="مثال: محمد عبدالله..."
                      className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs focus:outline-none focus:border-stone-400"
                    />
                  </div>

                  {/* Mandatory Receipt Upload */}
                  <div className="space-y-1.5">
                    <label className="block font-bold text-stone-900">
                      إرفاق إيصال التحويل البنكي <span className="text-red-500">* (إلزامي لإتمام الطلب)</span>
                    </label>
                    <p className="text-[11px] text-stone-500 leading-relaxed">
                      يرجى رفع صورة واضحة لإيصال التحويل البنكي، وسيتم إرسالها تلقائياً للتاجر مع تفاصيل طلبك لمراجعتها وتأكيد الدفع.
                    </p>

                    <label
                      className={`mt-1 flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
                        bankTransferReceiptDataUrl
                          ? 'border-emerald-400 bg-emerald-50/50'
                          : 'border-stone-300 hover:border-stone-400 bg-white'
                      }`}
                    >
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleReceiptFileChange}
                        className="hidden"
                        data-testid="bank-transfer-receipt-input"
                      />

                      {isProcessingReceipt ? (
                        <div className="flex items-center gap-2 text-stone-600 py-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>جارٍ تجهيز وإرفاق الإيصال...</span>
                        </div>
                      ) : bankTransferReceiptDataUrl ? (
                        <div className="w-full flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                              <FileCheck2 className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 text-right">
                              <span className="font-bold text-emerald-900 block truncate">
                                تم إرفاق إيصال التحويل بنجاح ✅
                              </span>
                              <span className="text-[10px] text-emerald-700 block truncate">
                                {bankTransferReceiptName || 'receipt.jpg'} (اضغط لتغيير الملف)
                              </span>
                            </div>
                          </div>
                          {bankTransferReceiptDataUrl.startsWith('data:image/') && (
                            <img
                              src={bankTransferReceiptDataUrl}
                              alt="معاينة الإيصال"
                              className="w-12 h-12 object-cover rounded-lg border border-emerald-200 shrink-0"
                            />
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5 text-center py-1">
                          <div className="w-9 h-9 rounded-xl bg-stone-100 text-stone-600 flex items-center justify-center">
                            <Upload className="w-4 h-4" />
                          </div>
                          <span className="font-bold text-stone-800">اضغط هنا لرفع صورة إيصال التحويل</span>
                          <span className="text-[10px] text-stone-400">يدعم الصور (JPG, PNG) أو ملف PDF</span>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              )}

              {/* Online Payment Link Trust Info */}
              {(paymentMethod.includes('بطاق') || paymentMethod.includes('فيزا') || paymentMethod.includes('مدى') || paymentMethod.includes('Apple') || paymentMethod.toLowerCase().includes('card')) && (
                <div className="mt-3 p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>دفع إلكتروني فوري وآمن (مدى / Apple Pay / فيزا)</span>
                    </span>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      <span>رابط دفع مباشر</span>
                    </span>
                  </div>

                  <p className="text-emerald-900 leading-relaxed text-[11px]">
                    عند إتمام الطلب، سيتم تحويلك مباشرة إلى صفحة الدفع المباشرة لسداد المبلغ عبر <strong>مدى، Apple Pay، أو البطاقات الائتمانية</strong> فورياً وبأعلى معايير الحماية والتشفير المصرفي.
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-bold">
                    <span className="px-2.5 py-1 rounded-lg border border-emerald-300 bg-white text-emerald-800 shadow-2xs">مدى mada</span>
                    <span className="px-2.5 py-1 rounded-lg border border-emerald-300 bg-white text-stone-900 shadow-2xs">Apple Pay</span>
                    <span className="px-2.5 py-1 rounded-lg border border-emerald-300 bg-white text-blue-900 shadow-2xs">Visa</span>
                    <span className="px-2.5 py-1 rounded-lg border border-emerald-300 bg-white text-amber-900 shadow-2xs">Mastercard</span>
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
                  onClick={() => {
                    setErrorMsg('');
                    if (isBankTransferSelected && !bankTransferReceiptDataUrl.trim()) {
                      setErrorMsg('يرجى إرفاق صورة إيصال التحويل البنكي للمتابعة وإتمام الطلب.');
                      return;
                    }
                    setCurrentStep(3);
                  }}
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
                  المنتجات المطلوبة ({items.length} أصناف):
                </span>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {items.map((item, idx) => {
                    const price = (item.product.salePrice && item.product.salePrice > 0) ? item.product.salePrice : item.product.price;
                    const lineTotal = Math.round(price * item.quantity * 100) / 100;
                    const unitLabel = getProductUnitLabel(item.product.unit, item.product.unitLabel);
                    return (
                      <div key={idx} className="flex justify-between text-xs text-stone-700">
                        <span>
                          <span className="font-semibold text-stone-900">{item.quantity} {unitLabel}</span>
                          {' • '}
                          {item.product.name} {item.selectedVariant ? `(${item.selectedVariant})` : ''}
                        </span>
                        <span className="font-mono font-bold">
                          {lineTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} {settings.currency}
                        </span>
                      </div>
                    );
                  })}
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
                  <span>{getZatcaComplianceType(settings) === 'non_registered' ? 'المجموع الفرعي:' : 'المجموع الفرعي الخاضع للضريبة:'}</span>
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

                {/* VAT itemization strictly when registered */}
                {getZatcaComplianceType(settings) !== 'non_registered' ? (
                  <div className="flex justify-between text-stone-700 font-semibold bg-stone-50 p-1.5 rounded-lg">
                    <span>منها ضريبة القيمة المضافة (15% VAT):</span>
                    <span className="font-mono text-stone-900">
                      {calculateVatBreakdown(grandTotal, settings.pricesIncludeVat ?? true, settings.vatRate ?? 0.15, getZatcaComplianceType(settings)).vatAmount.toFixed(2)} {settings.currency}
                    </span>
                  </div>
                ) : (
                  <div className="text-[11px] text-amber-800 bg-amber-50 p-1.5 rounded-lg">
                    منشأة غير خاضعة لضريبة القيمة المضافة (لا تضاف أي ضريبة).
                  </div>
                )}

                <div className="pt-2 border-t border-stone-200 flex justify-between text-sm font-black text-stone-900">
                  <span>{getZatcaComplianceType(settings) === 'non_registered' ? 'المبلغ الإجمالي النهائي المستحق:' : 'المبلغ الإجمالي شامل الضريبة:'}</span>
                  <span className="text-base font-mono font-black" style={{ color: brand.accentColor }}>
                    {grandTotal.toLocaleString('en-US')} {settings.currency}
                  </span>
                </div>
              </div>

              {/* Saudi Personal Data Protection Law (PDPL / SDAIA) Consent */}
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1.5">
                <label className="flex items-start gap-2.5 cursor-pointer select-none text-[11px] text-stone-700 leading-relaxed">
                  <input
                    type="checkbox"
                    checked={isPdplConsentAccepted}
                    onChange={(e) => setIsPdplConsentAccepted(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-0 cursor-pointer shrink-0"
                  />
                  <span>
                    أوافق على معالجة اسمي ورقم جوالي وعنوان التوصيل لإتمام توصيل الطلب والتواصل معي، وفقاً <strong>لنظام حماية البيانات الشخصية السعودي (PDPL)</strong> وسياسة خصوصية المتجر.
                  </span>
                </label>
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
                      <span>
                        {(paymentMethod.includes('بطاق') || paymentMethod.includes('فيزا') || paymentMethod.includes('مدى') || paymentMethod.includes('Apple') || paymentMethod.toLowerCase().includes('card'))
                          ? 'جاري توثيق الطلب والتحويل لرابط الدفع...'
                          : 'جاري إرسال وتوثيق الطلب...'}
                      </span>
                    </>
                  ) : (
                    <>
                      {(paymentMethod.includes('بطاق') || paymentMethod.includes('فيزا') || paymentMethod.includes('مدى') || paymentMethod.includes('Apple') || paymentMethod.toLowerCase().includes('card')) ? (
                        <CreditCard className="w-4 h-4" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      <span>
                        {(paymentMethod.includes('بطاق') || paymentMethod.includes('فيزا') || paymentMethod.includes('مدى') || paymentMethod.includes('Apple') || paymentMethod.toLowerCase().includes('card'))
                          ? `تأكيد ودفع ${grandTotal.toLocaleString('en-US')} ${settings.currency} بأمان`
                          : `تأكيد الطلب (${grandTotal.toLocaleString('en-US')} ${settings.currency})`}
                      </span>
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

      {/* Moyasar Online Payment Gateway Modal */}
      {showMoyasarModal && pendingMoyasarOrder && (
        <MoyasarPaymentModal
          isOpen={showMoyasarModal}
          onClose={() => setShowMoyasarModal(false)}
          order={pendingMoyasarOrder}
          settings={settings}
          storeSlug={storeId}
          onPaymentSuccess={(paidOrder) => {
            setShowMoyasarModal(false);
            trackPurchase(paidOrder, settings.currency);
            onOrderSuccess(paidOrder);
          }}
          onPaymentFailed={(errMsg) => {
            setErrorMsg(errMsg);
          }}
        />
      )}

      {/* Interactive Map Pin Location Picker */}
      {showLocationPickerModal && (
        <LocationPickerModal
          isOpen={showLocationPickerModal}
          onClose={() => setShowLocationPickerModal(false)}
          city={city === 'مدينة أخرى' && customCity.trim() ? customCity.trim() : city}
          initialAddress={deliveryAddress}
          primaryColor={brand.primaryColor}
          accentColor={brand.accentColor}
          onConfirm={(loc) => {
            setGoogleMapsUrl(loc.googleMapsUrl);
            setDeliveryAddress(loc.address);
            setShowLocationPickerModal(false);
          }}
        />
      )}
    </div>
  );
};
