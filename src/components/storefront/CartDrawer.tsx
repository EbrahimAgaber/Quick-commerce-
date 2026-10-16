import React from 'react';
import { CartItem, StoreSettings } from '../../types/store';
import { X, Trash2, ShoppingBag, ArrowLeft, Sparkles, Truck } from 'lucide-react';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (index: number, newQty: number) => void;
  onRemoveItem: (index: number) => void;
  onProceedToCheckout: () => void;
  settings: StoreSettings;
  orderNotes: string;
  onOrderNotesChange: (notes: string) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onProceedToCheckout,
  settings,
  orderNotes,
  onOrderNotesChange,
}) => {
  if (!isOpen) return null;

  const brand = settings.brandTheme || {
    primaryColor: '#0B253F',
    accentColor: '#0077FF',
    highlightColor: '#A5F3B6',
    backgroundColor: '#F8F3ED',
    neutralColor: '#E4E7EB',
    textColor: '#0B253F',
  };

  const subtotal = items.reduce((sum, item) => {
    const price = item.product.salePrice ?? item.product.price;
    return sum + price * item.quantity;
  }, 0);

  const qualifiesForFreeShipping = subtotal >= settings.freeShippingThreshold;
  const shippingFee = items.length === 0 ? 0 : qualifiesForFreeShipping ? 0 : settings.standardShippingRate;
  const grandTotal = subtotal + shippingFee;

  const freeShippingDelta = Math.max(0, settings.freeShippingThreshold - subtotal);
  const freeShippingProgress = Math.min(100, Math.round((subtotal / settings.freeShippingThreshold) * 100));

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-stone-950/70 backdrop-blur-xs flex justify-end">
      {/* Backdrop */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Drawer Surface */}
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between bg-stone-50" style={{ borderColor: brand.neutralColor }}>
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" style={{ color: brand.accentColor }} />
            <h2 className="text-base font-bold" style={{ color: brand.primaryColor }}>سلة مشترياتك</h2>
            <span 
              className="text-xs px-2 py-0.5 rounded-full font-mono font-bold"
              style={{ backgroundColor: brand.neutralColor, color: brand.textColor }}
            >
              {items.reduce((acc, i) => acc + i.quantity, 0)}
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-200 text-stone-600 hover:text-stone-900 flex items-center justify-center transition-colors"
            aria-label="إغلاق السلة"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Milestone Free Shipping Progress Bar */}
        <div className="p-4 bg-stone-50/80 border-b" style={{ borderColor: brand.neutralColor }}>
          <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
            <div className="flex items-center gap-1.5 text-stone-800">
              <Truck className="w-4 h-4" style={{ color: brand.accentColor }} />
              {qualifiesForFreeShipping ? (
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  مبروك! طلبيتك مؤهلة للشحن والتسليم المجاني
                </span>
              ) : (
                <span>
                  أضيفي بـ{' '}
                  <strong className="font-bold" style={{ color: brand.accentColor }}>
                    {freeShippingDelta.toLocaleString('en-US')} {settings.currency}
                  </strong>{' '}
                  للحصول على شحن مجاني!
                </span>
              )}
            </div>
            <span className="text-stone-500 font-mono text-[11px]">{freeShippingProgress}%</span>
          </div>

          {/* Progress bar line */}
          <div className="w-full h-2 rounded-full bg-stone-200 overflow-hidden">
            <div
              className="h-full transition-all duration-500 rounded-full"
              style={{
                width: `${freeShippingProgress}%`,
                backgroundColor: qualifiesForFreeShipping ? '#059669' : brand.accentColor,
              }}
            />
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-stone-100">
          {items.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-stone-100 text-stone-400 mx-auto flex items-center justify-center">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-stone-800">سلة التسوق فارغة حالياً</h3>
              <p className="text-xs text-stone-500 max-w-xs mx-auto">
                تصفحي الخدمات والمنتجات المتاحة وأضيفي ما يعجبك بضغطة زر.
              </p>
            </div>
          ) : (
            items.map((item, index) => {
              const unitPrice = item.product.salePrice ?? item.product.price;
              const itemTotal = unitPrice * item.quantity;

              return (
                <div key={`${item.product.id}-${item.selectedVariant}-${index}`} className="pt-3 first:pt-0 flex gap-3">
                  {/* Image */}
                  <img
                    src={item.product.imageUrl}
                    alt={item.product.name}
                    className="w-18 h-20 object-cover rounded-xl bg-stone-100 shrink-0 border"
                    style={{ borderColor: brand.neutralColor }}
                  />

                  {/* Info */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="text-xs sm:text-sm font-bold line-clamp-2" style={{ color: brand.primaryColor }}>
                          {item.product.name}
                        </h4>
                        <button
                          onClick={() => onRemoveItem(index)}
                          className="text-stone-400 hover:text-red-500 transition-colors p-1"
                          title="حذف المنتج"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {item.selectedVariant && (
                        <div className="text-[11px] text-stone-500 mt-0.5">
                          <span>الخيار: </span>
                          <span className="font-semibold text-stone-700">{item.selectedVariant}</span>
                        </div>
                      )}
                    </div>

                    {/* Quantity & Item Total */}
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2 bg-stone-100 rounded-lg p-0.5 border border-stone-200">
                        <button
                          onClick={() => onUpdateQuantity(index, item.quantity - 1)}
                          className="w-6 h-6 rounded bg-white text-stone-700 font-bold hover:bg-stone-50 flex items-center justify-center text-xs"
                        >
                          -
                        </button>
                        <span className="w-6 text-center text-xs font-mono font-bold text-stone-900">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => onUpdateQuantity(index, item.quantity + 1)}
                          className="w-6 h-6 rounded bg-white text-stone-700 font-bold hover:bg-stone-50 flex items-center justify-center text-xs"
                        >
                          +
                        </button>
                      </div>

                      <div className="text-left font-bold text-xs sm:text-sm" style={{ color: brand.primaryColor }}>
                        <span>{itemTotal.toLocaleString('en-US')}</span>{' '}
                        <span className="text-[11px] font-normal text-stone-500">{settings.currency}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer with breakdown & checkout button */}
        {items.length > 0 && (
          <div className="p-4 border-t bg-stone-50 space-y-3" style={{ borderColor: brand.neutralColor }}>
            {/* Merchant order notes */}
            <div>
              <input
                type="text"
                value={orderNotes}
                onChange={(e) => onOrderNotesChange(e.target.value)}
                placeholder="ملاحظات إضافية للطلب أو الموعد المفضل..."
                className="w-full px-3 py-2 text-xs bg-white border rounded-xl text-stone-800 placeholder:text-stone-400 focus:outline-none"
                style={{ borderColor: brand.neutralColor }}
              />
            </div>

            {/* Price Calculations */}
            <div className="space-y-1.5 text-xs text-stone-600">
              <div className="flex justify-between">
                <span>المجموع الفرعي:</span>
                <span className="font-semibold text-stone-900">
                  {subtotal.toLocaleString('en-US')} {settings.currency}
                </span>
              </div>
              <div className="flex justify-between">
                <span>رسوم التوصيل / التسليم:</span>
                <span>
                  {shippingFee === 0 ? (
                    <strong className="text-emerald-700">مجاني (عرض المتجر)</strong>
                  ) : (
                    `${shippingFee.toLocaleString('en-US')} ${settings.currency}`
                  )}
                </span>
              </div>
              <div className="pt-2 border-t flex justify-between text-sm sm:text-base font-black" style={{ borderColor: brand.neutralColor }}>
                <span style={{ color: brand.primaryColor }}>المبلغ الإجمالي المستحق:</span>
                <span style={{ color: brand.accentColor }}>
                  {grandTotal.toLocaleString('en-US')} {settings.currency}
                </span>
              </div>
            </div>

            {/* Checkout Action Button */}
            <button
              onClick={onProceedToCheckout}
              className="w-full py-3.5 px-4 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-98"
              style={{ backgroundColor: brand.primaryColor }}
            >
              <span>متابعة إتمام الطلب</span>
              <ArrowLeft className="w-4 h-4" style={{ color: brand.highlightColor || '#A5F3B6' }} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
