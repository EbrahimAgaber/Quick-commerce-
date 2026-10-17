import React, { useState, useEffect } from 'react';
import { Order, OrderStatus, StoreSettings } from '../../types/store';
import { StoreManager } from '../../services/storeManager';
import { 
  X, 
  Search, 
  PackageCheck, 
  Clock, 
  Package, 
  Truck, 
  CheckCircle2, 
  XCircle, 
  MessageCircle,
  MapPin,
  Calendar,
  CreditCard,
  Loader2
} from 'lucide-react';
import { createWhatsAppUrl } from '../../utils/whatsappInvoice';

interface OrderTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeId: string;
  orders: Order[];
  settings: StoreSettings;
  initialOrderId?: string;
}

const STEPS: { status: OrderStatus; label: string; desc: string; icon: any }[] = [
  {
    status: 'Received',
    label: 'تم استلام الطلب',
    desc: 'تم تسجيل الطلب وتأكيد بيانات العميل',
    icon: Clock,
  },
  {
    status: 'In Progress',
    label: 'قيد التجهيز',
    desc: 'جاري تجهيز وتغليف المنتجات المطلوبة',
    icon: Package,
  },
  {
    status: 'Out for Delivery',
    label: 'جاري التوصيل',
    desc: 'الشحنة مع مندوب التوصيل أو شركة الشحن',
    icon: Truck,
  },
  {
    status: 'Delivered',
    label: 'تم التوصيل بنجاح',
    desc: 'تم تسليم الشحنة للعميل بنجاح',
    icon: CheckCircle2,
  },
];

export const OrderTrackerModal: React.FC<OrderTrackerModalProps> = ({
  isOpen,
  onClose,
  storeId,
  orders,
  settings,
  initialOrderId = '',
}) => {
  if (!isOpen) return null;

  const [searchId, setSearchId] = useState(initialOrderId);
  const [searchedOrder, setSearchedOrder] = useState<Order | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    // Only auto-search if the customer just completed an order and clicked "Track This Order"
    if (initialOrderId) {
      setSearchId(initialOrderId);
      handleSearch(initialOrderId);
    } else {
      setSearchId('');
      setSearchedOrder(null);
      setHasSearched(false);
    }
  }, [initialOrderId]);

  const handleSearch = async (idToSearch: string) => {
    const cleanId = idToSearch.toUpperCase().trim().replace('#', '');
    if (!cleanId) return;

    setIsSearching(true);
    try {
      const found = await StoreManager.lookupOrderById(storeId, cleanId, orders);
      setSearchedOrder(found || null);
      setHasSearched(true);
    } finally {
      setIsSearching(false);
    }
  };

  const getStepIndex = (status: OrderStatus): number => {
    switch (status) {
      case 'Received':
        return 0;
      case 'In Progress':
        return 1;
      case 'Out for Delivery':
        return 2;
      case 'Delivered':
        return 3;
      case 'Cancelled':
        return -1;
      default:
        return 0;
    }
  };

  const currentStepIdx = searchedOrder ? getStepIndex(searchedOrder.status) : 0;

  const handleInquireWhatsApp = (order: Order) => {
    const text = `مرحباً متجر ${settings.storeName}، أود الاستفسار عن حالة طلبي رقم #${order.id}.`;
    const url = createWhatsAppUrl(settings.whatsappNumber, text);
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-stone-950/70 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden z-10 border border-stone-200 my-auto flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-stone-900">
                تتبع حالة الطلب والشحنة
              </h3>
              <p className="text-xs text-stone-500">
                أدخل رقم الطلب المرفق في فاتورتك لمتابعة حالة التجهيز والتوصيل
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-200 text-stone-600 hover:text-stone-900 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* Search Box */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-stone-700">
              أدخل رقم الطلب الخاص بك (مثال: BA-4821):
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchId)}
                  placeholder="رقم الطلب (BA-XXXX)"
                  className="w-full pr-10 pl-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
                />
                <Search className="absolute right-3 top-3 w-4 h-4 text-stone-400" />
              </div>

              <button
                onClick={() => handleSearch(searchId)}
                disabled={isSearching || !searchId.trim()}
                className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {isSearching && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>بحث</span>
              </button>
            </div>
          </div>

          {/* Searched Order Result */}
          {searchedOrder ? (
            <div className="space-y-6">
              {/* Status Header Card */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-500">رقم الطلب:</span>
                    <span className="text-base font-black font-mono text-stone-900">
                      #{searchedOrder.id}
                    </span>
                  </div>
                  <div className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
                    <Calendar className="w-3.5 h-3.5 text-stone-400" />
                    <span>
                      {new Date(searchedOrder.timestamp).toLocaleDateString('ar-SA', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-500">الحالة الحالية:</span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      searchedOrder.status === 'Delivered'
                        ? 'bg-emerald-100 text-emerald-800'
                        : searchedOrder.status === 'Out for Delivery'
                        ? 'bg-blue-100 text-blue-800'
                        : searchedOrder.status === 'In Progress'
                        ? 'bg-amber-100 text-amber-800'
                        : searchedOrder.status === 'Cancelled'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-stone-200 text-stone-800'
                    }`}
                  >
                    {searchedOrder.status === 'Delivered'
                      ? 'تم التوصيل'
                      : searchedOrder.status === 'Out for Delivery'
                      ? 'جاري التوصيل'
                      : searchedOrder.status === 'In Progress'
                      ? 'قيد التجهيز'
                      : searchedOrder.status === 'Cancelled'
                      ? 'ملغي'
                      : 'تم الاستلام'}
                  </span>
                </div>
              </div>

              {/* Milestone Progress Stepper */}
              {searchedOrder.status !== 'Cancelled' ? (
                <div className="py-2">
                  <h4 className="text-xs font-bold text-stone-700 mb-4">مسار تجهيز وشحن الطلب:</h4>

                  <div className="relative">
                    <div className="space-y-6 sm:space-y-0 sm:grid sm:grid-cols-4 gap-2">
                      {STEPS.map((step, idx) => {
                        const Icon = step.icon;
                        const isDone = currentStepIdx >= idx;
                        const isCurrent = currentStepIdx === idx;

                        return (
                          <div
                            key={step.status}
                            className={`flex sm:flex-col items-center sm:items-center text-right sm:text-center gap-3 sm:gap-2 p-2 rounded-xl transition-all ${
                              isCurrent ? 'bg-blue-50/80 ring-1 ring-blue-300' : ''
                            }`}
                          >
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold transition-all ${
                                isDone
                                  ? 'bg-stone-900 text-white ring-4 ring-blue-100'
                                  : 'bg-stone-100 text-stone-400 border border-stone-200'
                              }`}
                            >
                              <Icon className="w-5 h-5" />
                            </div>

                            <div className="flex-1 sm:flex-initial">
                              <h5
                                className={`text-xs font-bold leading-tight ${
                                  isDone ? 'text-stone-900' : 'text-stone-400'
                                }`}
                              >
                                {step.label}
                              </h5>
                              <p className="text-[11px] text-stone-500 mt-0.5 line-clamp-2">
                                {step.desc}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-3">
                  <XCircle className="w-6 h-6 text-red-600 shrink-0" />
                  <div>
                    <h5 className="font-bold">هذا الطلب تم إلغاؤه</h5>
                    <p className="text-[11px] text-red-700">
                      يرجى التواصل مع خدمة العملاء لمعرفة تفاصيل الإلغاء أو إعادة تقديم الطلب.
                    </p>
                  </div>
                </div>
              )}

              {/* Courier Tracking Notes */}
              {searchedOrder.trackingNotes && (
                <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-200/70 text-xs space-y-1">
                  <span className="font-bold text-blue-900 flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-blue-700" />
                    ملاحظات التتبع والشحن:
                  </span>
                  <p className="text-stone-700 font-medium leading-relaxed">
                    {searchedOrder.trackingNotes}
                  </p>
                </div>
              )}

              {/* Privacy-Safe Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
                  <span className="font-bold text-stone-800 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-stone-500" />
                    مدينة التوصيل:
                  </span>
                  <p className="text-stone-700 font-semibold">
                    {searchedOrder.city}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
                  <span className="font-bold text-stone-800 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-stone-500" />
                    طريقة الدفع والمبلغ:
                  </span>
                  <p className="text-stone-700">{searchedOrder.paymentMethod}</p>
                  <p className="text-stone-900 font-bold text-sm">
                    {searchedOrder.grandTotal.toLocaleString('ar-SA')} {settings.currency}
                  </p>
                </div>
              </div>

              {/* Items in order */}
              <div className="border border-stone-200 rounded-2xl p-4 space-y-2">
                <h5 className="text-xs font-bold text-stone-800">المنتجات المطلوبة:</h5>
                <p className="text-xs text-stone-600 leading-relaxed font-mono">
                  {searchedOrder.itemsSummary}
                </p>
              </div>

              {/* Inquire on WhatsApp */}
              {settings.whatsappNumber && (
                <button
                  onClick={() => handleInquireWhatsApp(searchedOrder)}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>مراسلة المتجر عبر واتساب بخصوص هذا الطلب</span>
                </button>
              )}
            </div>
          ) : hasSearched ? (
            <div className="py-12 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-400 mx-auto flex items-center justify-center">
                <Search className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-stone-800">
                لم يتم العثور على أي طلب برقم: {searchId}
              </h4>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                يرجى التأكد من كتابة رمز الطلب بشكل صحيح كما ورد في رسالة الواتساب أو الفاتورة.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
