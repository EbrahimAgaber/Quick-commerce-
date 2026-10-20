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
  X
} from 'lucide-react';
import { createWhatsAppUrl } from '../../utils/whatsappInvoice';

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

  const handleUpdateStatus = async (newStatus: 'Out for Delivery' | 'Delivered' | 'Cancelled') => {
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
      trackingNotes: newStatus === 'Cancelled' ? 'تعذر التوصيل: تم إرجاع الشحنة للمتجر بواسطة المندوب' : order.trackingNotes,
    };

    if (store) {
      const updatedOrders = (store.orders || []).map((o) => (o.id === order.id ? updatedOrder : o));
      StoreManager.updateStore({ ...store, orders: updatedOrders });
    }

    try {
      await StoreManager.updateOrderInStore(targetStoreId, updatedOrder, {
        source: 'driver',
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

        {/* STEP 5: Delivery Action Buttons */}
        {!deliveredSuccess && (
          <div className="space-y-2 pt-2 pb-6">
            {order.status !== 'Out for Delivery' && (
              <button
                type="button"
                disabled={updating}
                onClick={() => handleUpdateStatus('Out for Delivery')}
                className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
              >
                <Truck className="w-4 h-4" />
                <span>استلمت من المحل وجاري التوصيل</span>
              </button>
            )}

            <button
              type="button"
              disabled={updating}
              onClick={() => handleUpdateStatus('Delivered')}
              className="w-full py-4 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-sm font-black flex items-center justify-center gap-2 shadow-xl hover:scale-[1.01] transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-200" />
              <span>
                {isCOD ? `تم تسليم الطلب واستلام ${order.grandTotal} ${settings.currency} كاش` : 'تم تسليم الطلب للعميل بنجاح'}
              </span>
            </button>

            {order.status !== 'Cancelled' && (
              <button
                type="button"
                disabled={updating}
                onClick={() => {
                  if (window.confirm('هل أنت متأكد من تعذر التوصيل وإرجاع الشحنة للمتجر؟')) {
                    handleUpdateStatus('Cancelled');
                  }
                }}
                className="w-full py-2.5 px-3 bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-stone-800"
              >
                <X className="w-3.5 h-3.5" />
                <span>تعذر التوصيل / رفض العميل الاستلام (إرجاع للمتجر)</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
