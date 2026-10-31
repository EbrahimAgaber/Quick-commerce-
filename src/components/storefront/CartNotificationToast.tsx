import React, { useEffect } from 'react';
import { Product, StoreSettings, getProductUnitLabel } from '../../types/store';
import { CheckCircle2, ShoppingBag, X, ChevronLeft, CreditCard } from 'lucide-react';

interface CartNotificationToastProps {
  isOpen: boolean;
  product: Product | null;
  quantity: number;
  variant?: string;
  cartCount: number;
  cartTotal: number;
  settings: StoreSettings;
  onClose: () => void;
  onOpenCheckout: () => void;
  onOpenCart: () => void;
}

export const CartNotificationToast: React.FC<CartNotificationToastProps> = ({
  isOpen,
  product,
  quantity,
  variant,
  cartCount,
  cartTotal,
  settings,
  onClose,
  onOpenCheckout,
  onOpenCart,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      onClose();
    }, 4500);
    return () => clearTimeout(timer);
  }, [isOpen, product, onClose]);

  if (!isOpen || !product) return null;

  const brand = settings.brandTheme || {
    primaryColor: '#0B253F',
    accentColor: '#0077FF',
  };

  const unitLabel = getProductUnitLabel(product.unit);
  const effectivePrice =
    typeof product.salePrice === 'number' && product.salePrice > 0 && product.salePrice < product.price
      ? product.salePrice
      : product.price;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 sm:bottom-6 start-4 end-4 sm:start-6 sm:end-auto z-40 sm:max-w-md w-auto animate-in slide-in-from-bottom-5 duration-200"
    >
      <div className="bg-white/95 backdrop-blur-md border border-stone-200/90 rounded-2xl shadow-2xl p-3.5 sm:p-4 text-stone-900 space-y-3">
        {/* Top notification row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-emerald-800">
              تمت الإضافة إلى سلتك بنجاح!
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-6 h-6 rounded-full text-stone-400 hover:text-stone-700 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="إغلاق الإشعار"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Product preview */}
        <div className="flex items-center gap-3 bg-stone-50/80 p-2 rounded-xl border border-stone-100">
          <img
            src={product.imageUrl || 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=200'}
            alt={product.name}
            className="w-11 h-11 object-cover rounded-lg shrink-0 border border-stone-200/60"
            loading="lazy"
          />
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-stone-900 truncate">
              {product.name}
            </h4>
            <div className="flex items-center gap-1.5 text-[11px] text-stone-500 mt-0.5">
              <span>{quantity} {unitLabel}</span>
              {variant && (
                <>
                  <span>•</span>
                  <span className="font-medium text-stone-700">{variant}</span>
                </>
              )}
              <span>•</span>
              <span className="font-bold text-stone-900">
                {(effectivePrice * quantity).toLocaleString('ar-SA')} {settings.currency}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons: 1-Tap Checkout vs View Cart */}
        <div className="grid grid-cols-2 gap-2 pt-0.5">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenCart();
            }}
            className="w-full py-2.5 px-3 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-stone-600" />
            <span>عرض السلة ({cartCount})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenCheckout();
            }}
            className="w-full py-2.5 px-3 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-transform active:scale-98 shadow-sm cursor-pointer"
            style={{ backgroundColor: brand.primaryColor }}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>إتمام الطلب الآن</span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
