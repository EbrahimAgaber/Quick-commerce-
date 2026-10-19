import React, { useEffect, useState } from 'react';
import { Bell, ShoppingBag, X, ExternalLink, CheckCircle, Volume2 } from 'lucide-react';
import { Order, StoreSettings } from '../../types/store';
import { playOrderNotificationSound } from '../../services/notificationService';

interface ToastItem {
  id: string;
  order: Order;
  settings: StoreSettings;
  createdAt: number;
}

interface OrderNotificationToastProps {
  onSelectOrder?: (orderId: string) => void;
}

export const OrderNotificationToast: React.FC<OrderNotificationToastProps> = ({ onSelectOrder }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handleOrderPlaced = (e: Event) => {
      const customEvent = e as CustomEvent<{ order: Order; settings: StoreSettings }>;
      if (!customEvent.detail || !customEvent.detail.order) return;

      const newToast: ToastItem = {
        id: `${customEvent.detail.order.id}_${Date.now()}`,
        order: customEvent.detail.order,
        settings: customEvent.detail.settings,
        createdAt: Date.now(),
      };

      setToasts((prev) => [newToast, ...prev].slice(0, 3));
    };

    window.addEventListener('storelink_new_order_placed', handleOrderPlaced);
    return () => {
      window.removeEventListener('storelink_new_order_placed', handleOrderPlaced);
    };
  }, []);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-5 left-5 z-[9999] flex flex-col gap-3 max-w-md w-[calc(100vw-2.5rem)] pointer-events-none"
      dir="rtl"
      role="region"
      aria-label="إشعارات الطلبات الجديدة"
    >
      {toasts.map((toast) => {
        const { order, settings } = toast;
        const cleanPhone = (order.customerPhone || '').replace(/\D/g, '');
        const whatsappHref = cleanPhone ? `https://wa.me/${cleanPhone}` : null;

        return (
          <div
            key={toast.id}
            className="pointer-events-auto relative overflow-hidden bg-stone-900/95 border-2 border-emerald-500/40 backdrop-blur-xl text-white rounded-2xl shadow-2xl p-4 transition-all duration-300 animate-in slide-in-from-top-4 hover:shadow-emerald-500/10"
          >
            {/* Top Bar with Pulsing Badge & Dismiss */}
            <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                  <ShoppingBag className="w-3.5 h-3.5" />
                  طلب جديد وارد الآن
                </span>
                <span className="text-[11px] font-mono text-stone-400">
                  {order.id}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => playOrderNotificationSound()}
                  title="إعادة تشغيل رنين التنبيه"
                  className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  title="إغلاق التنبيه"
                  className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Customer & Total Details */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white truncate">
                  {order.customerName}
                </p>
                <p className="text-xs text-stone-300 truncate mt-0.5">
                  {order.itemsSummary || `${order.items?.length || 1} منتجات`}
                </p>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  📍 {order.city} {order.deliveryType === 'pickup' ? '• استلام من الفرع' : ''}
                </p>
              </div>
              <div className="text-left shrink-0">
                <span className="inline-block px-2.5 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-bold text-sm font-mono">
                  {order.grandTotal.toLocaleString('en-US')} {settings.currency}
                </span>
              </div>
            </div>

            {/* Action Bar */}
            <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center gap-2">
              {whatsappHref && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md active:scale-95"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  مراسلة واتساب
                </a>
              )}
              {onSelectOrder && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectOrder(order.id);
                    dismissToast(toast.id);
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all active:scale-95"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  تفاصيل الطلب
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
