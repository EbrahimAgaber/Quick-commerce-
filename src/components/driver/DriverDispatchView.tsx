import React, { useState, useEffect } from 'react';
import { Order, StoreSettings } from '../../types/store';
import { StoreManager } from '../../services/storeManager';
import { 
  Truck, 
  MapPin, 
  Phone, 
  MessageCircle, 
  Banknote, 
  CheckCircle2, 
  Navigation, 
  Store, 
  Package, 
  Clock, 
  Check, 
  AlertCircle,
  ExternalLink,
  X,
  ShieldCheck,
  KeyRound,
  Loader2
} from 'lucide-react';
import { createWhatsAppUrl, getOrderDeliveryPin } from '../../utils/whatsappInvoice';
import { normalizeArabicDigits } from '../../utils/digits';

interface DriverDispatchViewProps {
  orderId: string;
  storeId?: string;
  onClose?: () => void;
}

export const DriverDispatchView: React.FC<DriverDispatchViewProps> = ({
  orderId,
  storeId = 'store_aurora_01',
}) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [deliveredSuccess, setDeliveredSuccess] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [showFailureModal, setShowFailureModal] = useState(false);
  const [failureReason, setFailureReason] = useState('العميل لم يقم بالرد على الاتصالات المتكررة');

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        let store = StoreManager.getStoreById(storeId) || StoreManager.getStoreBySlug(storeId);
        if (!store && storeId) {
          store = await StoreManager.fetchStoreFromFirestore(storeId);
        }
        if (!store) {
          store = StoreManager.getActiveStore();
        }
        if (store) {
          setSettings(store.settings);
          const cleanOrderId = orderId.toUpperCase().trim().replace('#', '');
          let found: Order | null | undefined = (store.orders || []).find((o) => o.id.toUpperCase().trim().replace('#', '') === cleanOrderId);
          if (!found && store.id) {
            found = await StoreManager.lookupOrderById(store.id, cleanOrderId, store.orders || []);
          }
          if (found) {
            setOrder(found);
            if (found.status === 'Delivered') {
              setDeliveredSuccess(true);
            }
          }
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [orderId, storeId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-900 text-white flex flex-col items-center justify-center p-4" dir="rtl">
        <Truck className="w-10 h-10 text-emerald-400 animate-bounce mb-3" />
        <p className="text-sm font-bold">جاري تحميل تفاصيل الشحنة للمندوب...</p>
      </div>
    );
  }

  if (!order || !settings) {
    return (
      <div className="min-h-screen bg-stone-900 text-white flex flex-col items-center justify-center p-4 text-center" dir="rtl">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
        <h2 className="text-base font-bold">لم يتم العثور على هذا الطلب</h2>
        <p className="text-xs text-stone-400 mt-1 max-w-xs">
          يرجى التأكد من صحة الرابط المرسل إليك عبر الواتساب أو التواصل مع إدارة المتجر.
        </p>
      </div>
    );
  }

  const isCOD = order.paymentMethod.toLowerCase().includes('cod') || order.paymentMethod.includes('استلام');
  const storeMapUrl = settings.storeLocationUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${settings.storeName} ${settings.city || ''}`)}`;
  const customerMapUrl = order.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${order.city} ${order.deliveryAddress}`)}`;

  const handleUpdateStatus = async (
    newStatus: 'Out for Delivery' | 'Delivered' | 'Cancelled',
    customNotes?: string,
    pin?: string
  ) => {
    setUpdating(true);
    const store = StoreManager.getStoreById(storeId) || StoreManager.getStoreBySlug(storeId) || StoreManager.getActiveStore();
    const targetStoreId = store?.id || storeId || 'aurora';
    const nowIso = new Date().toISOString();

    const updatedOrder: Order = {
      ...order,
      status: newStatus,
      driverDeliveredAt: newStatus === 'Delivered' ? nowIso : order.driverDeliveredAt,
      driverCashCollected: newStatus === 'Delivered' && isCOD ? order.grandTotal : (newStatus === 'Cancelled' ? 0 : order.driverCashCollected),
      returnEligibleUntil: newStatus === 'Delivered'
        ? new Date(new Date(nowIso).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
        : order.returnEligibleUntil,
      trackingNotes: customNotes || (newStatus === 'Cancelled' ? 'تعذر التوصيل: تم إرجاع الشحنة للمتجر بواسطة المندوب' : order.trackingNotes),
    };

    if (store) {
      const updatedOrders = (store.orders || []).map((o) => (o.id === order.id ? updatedOrder : o));
      StoreManager.updateStore({ ...store, orders: updatedOrders });
    }

    try {
      await StoreManager.updateOrderInStore(targetStoreId, updatedOrder, {
        source: 'driver',
        deliveryPin: pin || order.deliveryPin || (order ? getOrderDeliveryPin(order) : undefined),
        restockItems: newStatus === 'Cancelled',
      });
    } catch (err) {
      console.warn('Driver cloud update notice:', err);
    }

    setOrder(updatedOrder);
    setUpdating(false);

    if (newStatus === 'Delivered') {
      setDeliveredSuccess(true);
    }
  };

  const expectedPin = order ? getOrderDeliveryPin(order) : '';

  const handleVerifyAndDeliver = () => {
    const cleanEntered = normalizeArabicDigits(enteredPin).replace(/\D/g, '').trim();
    if (!cleanEntered) {
      setPinError('يرجى كتابة كود تأكيد التسليم المكون من 4 أرقام المستلم من العميل');
      return;
    }
    if (cleanEntered !== expectedPin) {
      setPinError('⚠️ كود التسليم غير صحيح! اطلب من العميل تزويدك بالكود المكون من 4 أرقام (موجود في رسالة الواتساب أو صفحة التتبع).');
      return;
    }
    setPinError('');
    handleUpdateStatus('Delivered', undefined, cleanEntered);
  };

  const handleConfirmFailure = () => {
    setShowFailureModal(false);
    handleUpdateStatus('Cancelled', `تعذر التوصيل: ${failureReason} (تم إرجاع الشحنة للمتجر)`);
  };

  const handleSendMerchantDeliveredWhatsApp = () => {
    const text = `تم تسليم الطلب #${order.id} بنجاح للعميل ${order.customerName}.\nالمبلغ المحصل كاش: ${isCOD ? `${order.grandTotal} ${settings.currency}` : 'مدفوع إلكترونياً'}`;
    const url = createWhatsAppUrl(settings.whatsappNumber, text);
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 p-3 sm:p-5 flex flex-col items-center" dir="rtl">
      <div className="w-full max-w-md space-y-4">
        {/* Top Header */}
        <div className="bg-stone-900 border border-stone-800 rounded-3xl p-4 sm:p-5 flex items-center justify-between shadow-xl">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-bold mb-1">
              <Truck className="w-3.5 h-3.5" />
              <span>مهمة توصيل محلية</span>
            </div>
            <h1 className="text-lg font-black text-white">
              طلب #{order.id}
            </h1>
            <p className="text-xs text-stone-400">
              متجر: <strong className="text-stone-200">{settings.storeName}</strong>
            </p>
          </div>

          <div className="text-left font-mono" dir="ltr">
            <span className={`px-2.5 py-1 rounded-xl text-xs font-bold ${
              order.status === 'Delivered'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : order.status === 'Out for Delivery'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}>
              {order.status}
            </span>
          </div>
        </div>

        {/* Success Banner if Delivered */}
        {deliveredSuccess && (
          <div className="bg-emerald-950/70 border border-emerald-600 rounded-3xl p-4 text-center space-y-2 animate-in zoom-in-95">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <h3 className="text-sm font-bold text-white">تم توثيق تسليم الشحنة بنجاح!</h3>
            <p className="text-xs text-emerald-200">
              تم تحديث حالة الطلب في نظام المتجر وسُجّل المبلغ في دفتر الحساب اليومي للمندوب.
            </p>
            <button
              onClick={handleSendMerchantDeliveredWhatsApp}
              className="mt-2 w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>إشعار صاحب المتجر عبر واتساب</span>
            </button>
          </div>
        )}

        {/* STEP 1: Pickup from Store */}
        <div className="bg-stone-900 border border-stone-800 rounded-3xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-stone-300 flex items-center gap-1.5">
              <Store className="w-4 h-4 text-amber-400" />
              <span>نقطة الاستلام (المحل):</span>
            </span>
            <span className="text-stone-400">{settings.city || 'الفرع'}</span>
          </div>

          <div className="p-3 bg-stone-950 rounded-2xl border border-stone-800 text-xs space-y-1">
            <p className="font-bold text-white text-sm">{settings.storeName}</p>
            <p className="text-stone-400 text-[11px]">{settings.storePickupAddress || 'مقر المتجر الرئيسي'}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <a
              href={storeMapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-3 bg-stone-800 hover:bg-stone-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Navigation className="w-3.5 h-3.5 text-amber-400" />
              <span>خريطة المحل</span>
            </a>
            <a
              href={`tel:${settings.whatsappNumber}`}
              className="py-2.5 px-3 bg-stone-800 hover:bg-stone-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span>اتصال بالمحل</span>
            </a>
          </div>
        </div>

        {/* STEP 2: Dropoff to Customer */}
        <div className="bg-stone-900 border border-stone-800 rounded-3xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-stone-300 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-blue-400" />
              <span>نقطة التسليم (العميل):</span>
            </span>
            <span className="font-bold text-white">{order.customerName}</span>
          </div>

          <div className="p-3 bg-stone-950 rounded-2xl border border-stone-800 text-xs space-y-1">
            <p className="font-bold text-white">{order.city} — {order.deliveryAddress}</p>
            {order.landmarkNotes && (
              <p className="text-amber-300 text-[11px]">ملاحظة العميل: {order.landmarkNotes}</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <a
              href={customerMapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 text-center"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>موقع العميل</span>
            </a>
            <a
              href={`tel:${order.customerPhone}`}
              className="py-2.5 px-2 bg-stone-800 hover:bg-stone-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 text-center"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span>اتصال</span>
            </a>
            <a
              href={createWhatsAppUrl(order.customerPhone, `مرحباً ${order.customerName}، أنا مندوب متجر ${settings.storeName} بخصوص طلبك #${order.id}.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 text-center"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>واتساب</span>
            </a>
          </div>
        </div>

        {/* STEP 3: Cash & Payment Breakdown */}
        <div className={`p-4 sm:p-5 rounded-3xl border ${
          isCOD 
            ? 'bg-amber-950/40 border-amber-600/50' 
            : 'bg-emerald-950/40 border-emerald-600/50'
        } space-y-2 text-xs`}>
          <div className="flex items-center justify-between">
            <span className="font-bold text-stone-200 flex items-center gap-1.5">
              <Banknote className="w-4 h-4 text-emerald-400" />
              <span>طريقة الدفع والمبلغ المطلوب:</span>
            </span>
            <span className="font-bold">{order.paymentMethod}</span>
          </div>

          {isCOD ? (
            <div className="p-3 bg-stone-950/90 rounded-2xl border border-amber-500/40 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-amber-400 block font-bold">المطلوب تحصيله كاش من العميل:</span>
                <span className="text-2xl font-black font-mono text-white">
                  {order.grandTotal.toLocaleString('en-US')} {settings.currency}
                </span>
              </div>
              <div className="text-left text-[10px] text-stone-400">
                <p>تشمل أجر التوصيل</p>
                <p>والمبلغ للمتجر</p>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-emerald-950/90 rounded-2xl border border-emerald-500/40 text-center">
              <span className="font-bold text-emerald-300 text-sm block">
                ✓ مدفوع إلكترونياً بالكامل
              </span>
              <span className="text-[11px] text-stone-400">
                لا تستلم أي مبالغ نقدية من العميل (سلّم الطلب مباشرة)
              </span>
            </div>
          )}
        </div>

        {/* STEP 4: Package Contents Preview */}
        <div className="bg-stone-900 border border-stone-800 rounded-3xl p-4 text-xs space-y-2">
          <span className="font-bold text-stone-400 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-stone-400" />
            <span>محتويات الشحنة للتأكد قبل الانطلاق:</span>
          </span>
          <p className="font-mono text-stone-300 bg-stone-950 p-2.5 rounded-xl leading-relaxed text-[11px]">
            {order.itemsSummary}
          </p>
        </div>

        {/* STEP 5: Delivery Action & Security PIN Verification */}
        {!deliveredSuccess && (
          <div className="space-y-3 pt-2 pb-8">
            {order.status !== 'Out for Delivery' && order.status !== 'Delivered' && (
              <button
                type="button"
                disabled={updating}
                onClick={() => handleUpdateStatus('Out for Delivery')}
                className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
              >
                <Truck className="w-4 h-4" />
                <span>استلمت من المحل وبدأت التوصيل 🚚</span>
              </button>
            )}

            {/* PIN Verification Box */}
            <div className="bg-stone-900 border border-emerald-500/30 rounded-3xl p-4 sm:p-5 space-y-3 shadow-xl">
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">
                    تأكيد تسليم الشحنة عبر الكود السري
                  </h3>
                  <p className="text-xs text-stone-400 mt-0.5 leading-relaxed">
                    اطلب كود تأكيد الاستلام (4 أرقام) من العميل لتوثيق التسليم في النظام.
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={enteredPin}
                    onChange={(e) => {
                      setEnteredPin(e.target.value);
                      setPinError('');
                    }}
                    placeholder="أدخل كود التسليم (4 أرقام)"
                    className="w-full py-3 px-4 bg-stone-950 border border-stone-700 focus:border-emerald-500 rounded-2xl text-center text-xl font-black font-mono tracking-widest text-emerald-300 placeholder:text-stone-600 placeholder:font-sans placeholder:text-xs placeholder:tracking-normal outline-none transition-colors"
                  />
                  <KeyRound className="w-4 h-4 text-stone-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {pinError && (
                  <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{pinError}</span>
                  </div>
                )}

                <button
                  type="button"
                  disabled={updating || !enteredPin.trim()}
                  onClick={handleVerifyAndDeliver}
                  className="w-full py-4 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-2xl text-sm font-black flex items-center justify-center gap-2 shadow-xl hover:scale-[1.01] active:scale-98 transition-all cursor-pointer"
                >
                  {updating ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-200" />
                  )}
                  <span>
                    {isCOD
                      ? `تحقق وتأكيد استلام ${order.grandTotal.toLocaleString('en-US')} ${settings.currency} كاش`
                      : 'تحقق وتأكيد تسليم الشحنة للعميل'}
                  </span>
                </button>
              </div>
            </div>

            {/* Inability to Deliver / Return Trigger */}
            {order.status !== 'Cancelled' && (
              <button
                type="button"
                disabled={updating}
                onClick={() => setShowFailureModal(true)}
                className="w-full py-2.5 px-3 bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-rose-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-stone-800"
              >
                <X className="w-3.5 h-3.5" />
                <span>تعذر التوصيل / رفض العميل الاستلام (إرجاع للمتجر)</span>
              </button>
            )}

            {/* Failure Reason Selector Sheet */}
            {showFailureModal && (
              <div className="p-4 bg-stone-900 border border-rose-500/40 rounded-3xl space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    <span>تحديد سبب تعذر التوصيل:</span>
                  </span>
                  <button
                    onClick={() => setShowFailureModal(false)}
                    className="text-stone-500 hover:text-stone-300 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-1.5 text-xs">
                  {[
                    'العميل لم يقم بالرد على الاتصالات المتكررة',
                    'العميل رفض استلام الشحنة / ألغى الطلب عند الوصول',
                    'العنوان المسجل غير دقيق أو خارج نطاق التوصيل',
                    'كود التحقق غير متوفر مع المستلم وتعذر التوثيق',
                  ].map((reason) => (
                    <label
                      key={reason}
                      className={`flex items-center gap-2 p-2.5 rounded-xl cursor-pointer transition-colors ${
                        failureReason === reason
                          ? 'bg-rose-950/60 text-rose-200 border border-rose-500/40'
                          : 'bg-stone-950 text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="failureReason"
                        checked={failureReason === reason}
                        onChange={() => setFailureReason(reason)}
                        className="accent-rose-500"
                      />
                      <span>{reason}</span>
                    </label>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={updating}
                  onClick={handleConfirmFailure}
                  className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md"
                >
                  تأكيد تعذر التوصيل وإرجاع الشحنة للمتجر
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
