import React, { useState } from 'react';
import { CartItem, PromoCode, StoreSettings, getProductUnitLabel, getProductUnitMeta } from '../../types/store';
import { X, Trash2, ShoppingBag, ArrowLeft, Sparkles, Truck, Tag, Check, Package, Loader2 } from 'lucide-react';

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
  appliedPromo: PromoCode | null;
  onApplyPromo: (promo: PromoCode | null) => void;
  storeId?: string;
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
  appliedPromo,
  onApplyPromo,
  storeId,
}) => {
  if (!isOpen) return null;

  const [couponInput, setCouponInput] = useState(appliedPromo?.code || '');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  const brand = settings.brandTheme || {
    primaryColor: '#0B253F',
    accentColor: '#0077FF',
    highlightColor: '#A5F3B6',
    backgroundColor: '#F8FAFC',
    neutralColor: '#E4E7EB',
    textColor: '#0B253F',
  };

  const validItems = (items || []).filter((item) => item && item.product && typeof item.product === 'object' && item.product.id);

  const subtotal = validItems.reduce((sum, item) => {
    const hasSale =
      typeof item.product.salePrice === 'number' &&
      item.product.salePrice > 0 &&
      item.product.salePrice < item.product.price;
    const price = hasSale ? item.product.salePrice! : (item.product.price || 0);
    return sum + price * (item.quantity || 1);
  }, 0);

  // Calculate discount from appliedPromo
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
  const shippingFee =
    items.length === 0 ? 0 : qualifiesForFreeShipping ? 0 : settings.standardShippingRate;
  const grandTotal = discountedSubtotal + shippingFee;

  const freeShippingDelta = hasFreeShippingPromo
    ? Math.max(0, settings.freeShippingThreshold - discountedSubtotal)
    : 0;
  const freeShippingProgress = hasFreeShippingPromo
    ? Math.min(100, Math.round((discountedSubtotal / settings.freeShippingThreshold) * 100))
    : 100;

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError(null);
    const code = couponInput.trim().toUpperCase();
    if (!code) {
      onApplyPromo(null);
      return;
    }

    // 1. Try local settings fallback first if promoCodes are populated
    const availableCodes = settings.promoCodes || [];
    const matched = availableCodes.find(
      (c) => c.active && c.code.trim().toUpperCase() === code
    );

    if (matched) {
      if (matched.minOrderAmount && subtotal < matched.minOrderAmount) {
        setCouponError(
          `الحد الأدنى لتفعيل هذا الكوبون هو ${matched.minOrderAmount} ${settings.currency}`
        );
        onApplyPromo(null);
        return;
      }
      onApplyPromo(matched);
      return;
    }

    // 2. Validate via backend endpoint /api/validatePromo against private merchant config
    if (storeId) {
      setIsValidatingCoupon(true);
      try {
        const res = await fetch('/api/validatePromo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storeId,
            promoCode: code,
            subtotal,
          }),
        });
        const data = await res.json();
        if (data.valid) {
          const promo: PromoCode = {
            code: data.code || code,
            type: data.type || 'fixed',
            value: Number(data.value) || 0,
            active: true,
            minOrderAmount: data.minOrderAmount,
          };
          onApplyPromo(promo);
          return;
        } else {
          setCouponError(data.message || 'كود الخصم غير صحيح أو منتهي الصلاحية.');
          onApplyPromo(null);
          return;
        }
      } catch (err) {
        console.warn('Backend promo validation error:', err);
      } finally {
        setIsValidatingCoupon(false);
      }
    }

    setCouponError('كود الخصم غير صحيح أو منتهي الصلاحية.');
    onApplyPromo(null);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-stone-950/70 backdrop-blur-xs flex justify-end">
      {/* Backdrop */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Drawer Surface */}
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-left duration-300">
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
            className="w-8 h-8 rounded-full bg-stone-200 text-stone-600 hover:text-stone-900 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="إغلاق السلة"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Milestone Free Shipping Progress Bar (Only shown when threshold > 0 and cart has items) */}
        {hasFreeShippingPromo && items.length > 0 && (
          <div className="p-4 bg-stone-50/80 border-b" style={{ borderColor: brand.neutralColor }}>
            <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
              <div className="flex items-center gap-1.5 text-stone-800">
                <Truck className="w-4 h-4" style={{ color: brand.accentColor }} />
                {qualifiesForFreeShipping ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    مبروك! طلبك مؤهل للشحن والتوصيل المجاني
                  </span>
                ) : (
                  <span>
                    أضف بـ{' '}
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
        )}

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-stone-100">
          {items.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-stone-100 text-stone-400 mx-auto flex items-center justify-center">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-stone-800">سلة التسوق فارغة حالياً</h3>
              <p className="text-xs text-stone-500 max-w-xs mx-auto">
                تصفح المنتجات المتاحة وأضف ما يعجبك بضغطة زر.
              </p>
            </div>
          ) : (
            items.map((item, index) => {
              const hasSale =
                typeof item.product.salePrice === 'number' &&
                item.product.salePrice > 0 &&
                item.product.salePrice < item.product.price;
              const unitPrice = hasSale ? item.product.salePrice! : item.product.price;
              const itemTotal = Math.round(unitPrice * item.quantity * 100) / 100;
              const maxStock =
                typeof item.product.stockQuantity === 'number'
                  ? item.product.stockQuantity
                  : undefined;

              const uLabel = getProductUnitLabel(item.unit || item.product.unit, item.product.unitLabel);
              const uMeta = getProductUnitMeta(item.unit || item.product.unit);
              const isFrac = Boolean(uMeta?.allowDecimal || ['kg', 'meter', 'liter', 'tola'].includes(item.product.unit || ''));
              const step = item.product.quantityStep || (uMeta?.defaultStep ?? (isFrac ? 0.5 : 1));
              const minQty = item.product.minQuantity || (uMeta?.defaultMin ?? (isFrac ? 0.5 : 1));

              const handleDecrease = () => {
                const next = Math.round((item.quantity - step) * 1000) / 1000;
                if (next < minQty || next <= 0) {
                  onRemoveItem(index);
                } else {
                  onUpdateQuantity(index, next);
                }
              };

              const handleIncrease = () => {
                const next = Math.round((item.quantity + step) * 1000) / 1000;
                onUpdateQuantity(index, maxStock !== undefined ? Math.min(maxStock, next) : next);
              };

              return (
                <div key={`${item.product.id}-${item.selectedVariant}-${index}`} className="pt-3 first:pt-0 flex gap-3">
                  {/* Image */}
                  {item.product.imageUrl ? (
                    <img
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      loading="lazy"
                      decoding="async"
                      className="w-18 h-20 object-cover rounded-xl bg-stone-100 shrink-0 border"
                      style={{ borderColor: brand.neutralColor }}
                    />
                  ) : (
                    <div
                      className="w-18 h-20 rounded-xl bg-stone-100 shrink-0 border flex items-center justify-center text-stone-400"
                      style={{ borderColor: brand.neutralColor }}
                    >
                      <Package className="w-6 h-6" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="text-xs sm:text-sm font-bold line-clamp-2" style={{ color: brand.primaryColor }}>
                          {item.product.name}
                        </h4>
                        <button
                          onClick={() => onRemoveItem(index)}
                          className="text-stone-400 hover:text-red-500 transition-colors p-1 cursor-pointer"
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
                      <div className="flex items-center gap-1.5 bg-stone-100 rounded-lg p-0.5 border border-stone-200">
                        <button
                          onClick={handleDecrease}
                          className="w-6 h-6 rounded bg-white text-stone-700 font-bold hover:bg-stone-50 flex items-center justify-center text-xs cursor-pointer shadow-2xs"
                          aria-label="تقليل الكمية"
                        >
                          -
                        </button>
                        <span className="px-1 text-center text-xs font-mono font-bold text-stone-900 whitespace-nowrap">
                          {item.quantity}{uLabel ? ` ${uLabel}` : ''}
                        </span>
                        <button
                          onClick={handleIncrease}
                          disabled={maxStock !== undefined && item.quantity >= maxStock}
                          className="w-6 h-6 rounded bg-white text-stone-700 font-bold hover:bg-stone-50 disabled:opacity-40 flex items-center justify-center text-xs cursor-pointer shadow-2xs"
                          aria-label="زيادة الكمية"
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
            {/* Promo / Coupon Code Input */}
            <form onSubmit={handleApplyCoupon} className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="w-3.5 h-3.5 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  placeholder="كود الخصم (مثال: EID20)"
                  className="w-full pr-8 pl-3 py-2 text-xs bg-white border rounded-xl text-stone-800 font-mono uppercase placeholder:font-sans focus:outline-none"
                  style={{ borderColor: brand.neutralColor }}
                  dir="ltr"
                />
              </div>
              {appliedPromo ? (
                <button
                  type="button"
                  onClick={() => {
                    setCouponInput('');
                    onApplyPromo(null);
                  }}
                  className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء الكوبون
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isValidatingCoupon}
                  className="px-3.5 py-2 bg-stone-900 text-white rounded-xl text-xs font-bold hover:bg-stone-800 transition-colors cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  {isValidatingCoupon ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>تطبيق</span>
                  )}
                </button>
              )}
            </form>

            {couponError && <p className="text-[11px] text-red-600 font-medium">{couponError}</p>}
            {appliedPromo && discountAmount > 0 && (
              <div className="flex items-center justify-between text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-xl font-bold">
                <span className="flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  تم تفعيل كوبون ({appliedPromo.code})
                </span>
                <span>-{discountAmount.toLocaleString('en-US')} {settings.currency}</span>
              </div>
            )}

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
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>خصم الكوبون ({appliedPromo?.code}):</span>
                  <span>-{discountAmount.toLocaleString('en-US')} {settings.currency}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>رسوم التوصيل:</span>
                <span>
                  {shippingFee === 0 ? (
                    <strong className="text-emerald-700">مجاني</strong>
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
              className="w-full py-3.5 px-4 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-98 cursor-pointer"
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
