import React, { useState } from 'react';
import { Order, StoreSettings } from '../../types/store';
import { 
  X, 
  Truck, 
  Banknote, 
  CheckCircle2, 
  Calendar, 
  MessageCircle, 
  FileText, 
  Check, 
  DollarSign, 
  ArrowDownLeft, 
  Store,
  UserCheck
} from 'lucide-react';
import { createWhatsAppUrl } from '../../utils/whatsappInvoice';

interface DriverSettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  settings: StoreSettings;
  onUpdateOrders: (newOrders: Order[]) => void;
}

export const DriverSettlementModal: React.FC<DriverSettlementModalProps> = ({
  isOpen,
  onClose,
  orders,
  settings,
  onUpdateOrders,
}) => {
  const [filterMode, setFilterMode] = useState<'today' | 'all'>('today');
  const [settledSuccess, setSettledSuccess] = useState(false);

  if (!isOpen) return null;

  const driverName = settings.driverName || 'المندوب المحلي';
  const driverPhone = settings.driverPhone || settings.whatsappNumber;
  const driverFeePerOrder = settings.driverFee ?? 15;

  const todayStr = new Date().toISOString().split('T')[0];

  // Delivered orders relevant for the driver
  const deliveredOrders = orders.filter((o) => {
    if (o.status !== 'Delivered') return false;
    if (o.driverSettled) return false;
    if (filterMode === 'today') {
      const orderDate = (o.driverDeliveredAt || o.timestamp || '').split('T')[0];
      return orderDate === todayStr;
    }
    return true;
  });

  // Financial calculations
  const totalDeliveries = deliveredOrders.length;

  const totalCodCash = deliveredOrders.reduce((sum, o) => {
    const isCOD = o.paymentMethod.toLowerCase().includes('cod') || o.paymentMethod.includes('استلام');
    return isCOD ? sum + o.grandTotal : sum;
  }, 0);

  const totalDriverEarnings = totalDeliveries * driverFeePerOrder;
  const netDueToMerchant = Math.max(0, totalCodCash - totalDriverEarnings);

  const handleSettleAndSendReceipt = () => {
    // Mark delivered orders as settled
    const updated = orders.map((o) => {
      const isDelivered = deliveredOrders.some((d) => d.id === o.id);
      return isDelivered
        ? { ...o, driverSettled: true, driverSettledAt: new Date().toISOString() }
        : o;
    });

    onUpdateOrders(updated);
    setSettledSuccess(true);

    // Format settlement receipt for WhatsApp
    const message = 
      `📋 *تقرير تصفية الحساب اليومي للمندوب*\n` +
      `المتجر: ${settings.storeName}\n` +
      `المندوب: ${driverName}\n` +
      `التاريخ: ${new Date().toLocaleDateString('ar-SA')}\n` +
      `--------------------------------\n` +
      `• عدد الشحنات المسلّمة: ${totalDeliveries}\n` +
      `• إجمالي الكاش المستلم من العملاء: ${totalCodCash} ${settings.currency}\n` +
      `• أتعاب التوصيل المستحقة للمندوب (${driverFeePerOrder} × ${totalDeliveries}): ${totalDriverEarnings} ${settings.currency}\n` +
      `--------------------------------\n` +
      `💰 *الصافي المستحق تسليمه لإدارة المحل: ${netDueToMerchant} ${settings.currency}*\n\n` +
      `✅ تمت المطابقة والتصفية بنجاح.`;

    const url = createWhatsAppUrl(driverPhone, message);
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-stone-950/75 backdrop-blur-xs" dir="rtl">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden z-10 border border-stone-200 my-auto flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-stone-900">
                دفتر تصفية حساب المندوب المشترك
              </h3>
              <p className="text-xs text-stone-500">
                مطابقة الكاش المحصل وأتعاب التوصيل للمندوب: <strong className="text-stone-800">{driverName}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-200 text-stone-600 hover:text-stone-900 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Date Filter Bar */}
        <div className="px-5 py-2.5 bg-stone-100/70 border-b border-stone-200 flex items-center justify-between text-xs font-bold">
          <span className="text-stone-600">نطاق التصفية:</span>
          <div className="flex rounded-xl bg-stone-200 p-0.5">
            <button
              onClick={() => setFilterMode('today')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                filterMode === 'today' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600'
              }`}
            >
              طلبات اليوم ({todayStr})
            </button>
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                filterMode === 'all' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600'
              }`}
            >
              كافة الطلبات المسلّمة
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* 3 Metric Cards */}
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200">
              <span className="text-[10px] text-stone-500 block">شحنات مسلّمة</span>
              <span className="text-xl font-black font-mono text-stone-900">{totalDeliveries}</span>
            </div>

            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200">
              <span className="text-[10px] text-amber-700 block">كاش استلمه المندوب</span>
              <span className="text-xl font-black font-mono text-amber-900">{totalCodCash}</span>
              <span className="text-[9px] text-amber-600 block">{settings.currency}</span>
            </div>

            <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200">
              <span className="text-[10px] text-blue-700 block">أتعاب المندوب</span>
              <span className="text-xl font-black font-mono text-blue-900">{totalDriverEarnings}</span>
              <span className="text-[9px] text-blue-600 block">{settings.currency}</span>
            </div>
          </div>

          {/* Net Settlement Banner */}
          <div className="p-4 rounded-2xl bg-[#0B253F] text-white flex items-center justify-between shadow-md">
            <div>
              <span className="text-xs text-blue-200 block">صافي الكاش المستحق تسليمه لإدارة المحل:</span>
              <span className="text-2xl font-black font-mono text-emerald-300">
                {netDueToMerchant.toLocaleString('en-US')} {settings.currency}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <ArrowDownLeft className="w-6 h-6 text-emerald-400" />
            </div>
          </div>

          {/* Orders Itemized List */}
          <div className="border border-stone-200 rounded-2xl p-3.5 space-y-2">
            <h4 className="text-xs font-bold text-stone-800">تفاصيل شحنات التصفية:</h4>

            {deliveredOrders.length === 0 ? (
              <p className="text-xs text-stone-400 text-center py-6">
                لا توجد شحنات مسجلة كـ "تم التوصيل" في هذا النطاق.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto divide-y divide-stone-100">
                {deliveredOrders.map((o) => {
                  const isCOD = o.paymentMethod.toLowerCase().includes('cod') || o.paymentMethod.includes('استلام');
                  return (
                    <div key={o.id} className="pt-2 first:pt-0 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-blue-700">#{o.id}</span>
                          <span className="font-bold text-stone-900">{o.customerName}</span>
                        </div>
                        <p className="text-[10px] text-stone-400">{o.city} • {o.paymentMethod}</p>
                      </div>

                      <div className="text-left font-mono">
                        <span className="font-bold text-stone-900 block">
                          {isCOD ? `${o.grandTotal} ${settings.currency} (كاش)` : 'مدفوع إلكترونياً'}
                        </span>
                        <span className="text-[10px] text-emerald-600 block">
                          أتعاب المندوب: {driverFeePerOrder} {settings.currency}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Settle Action */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              disabled={deliveredOrders.length === 0}
              onClick={handleSettleAndSendReceipt}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>تصفية الحساب وإرسال السند للمندوب عبر واتساب</span>
            </button>
            <p className="text-[11px] text-stone-400 text-center">
              يرسل إشعاراً موثقاً بالمبالغ إلى واتساب المندوب لحفظ حقوق الطرفين
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
