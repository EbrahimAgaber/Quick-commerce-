import React, { useState, useEffect } from 'react';
import { 
  Product, 
  StoreSettings, 
  getProductUnitLabel, 
  getProductUnitMeta 
} from '../../types/store';
import { X, Check, ShoppingBag, MessageCircle, Sparkles, Share2, Flame } from 'lucide-react';
import { createWhatsAppUrl } from '../../utils/whatsappInvoice';
import { buildShareableStoreUrl } from '../../utils/urlRouter';
import { getZatcaComplianceType } from '../../utils/zatca';
import { normalizeArabicDigits } from '../../utils/digits';
import { ProductImage } from '../common/ProductImage';
import { isLegacyWatchPlaceholder } from '../../utils/imageOptimizer';

interface ProductModalProps {
  product: Product | null;
  storeSlug?: string;
  settings: StoreSettings;
  onClose: () => void;
  onAddToCart: (product: Product, variant: string, quantity: number) => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  product,
  storeSlug,
  settings,
  onClose,
  onAddToCart,
}) => {
  if (!product) return null;

  const brand = settings.brandTheme || {
    primaryColor: '#0B253F',
    accentColor: '#0077FF',
    highlightColor: '#A5F3B6',
    backgroundColor: '#F8FAFC',
    neutralColor: '#E4E7EB',
    textColor: '#0B253F',
  };

  const unitLabel = getProductUnitLabel(product.unit, product.unitLabel);
  const unitMeta = getProductUnitMeta(product.unit);
  const isFractional = Boolean(unitMeta?.allowDecimal || ['kg', 'meter', 'liter', 'tola'].includes(product.unit || ''));
  const step = product.quantityStep || (unitMeta?.defaultStep ?? (isFractional ? 0.5 : 1));
  const minQty = product.minQuantity || (unitMeta?.defaultMin ?? (isFractional ? 0.5 : 1));

  const [selectedImage, setSelectedImage] = useState<string>(product.imageUrl);
  const realVariants = (product.variants || []).filter((v) => v && v !== 'الخيار الافتراضي');
  const [selectedVariant, setSelectedVariant] = useState<string>(
    realVariants.length > 0 ? realVariants[0] : ''
  );
  const [quantity, setQuantity] = useState<number>(minQty);
  const [quantityInput, setQuantityInput] = useState<string>(String(minQty));
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [copiedShareLink, setCopiedShareLink] = useState<boolean>(false);

  // Sync state if product changes
  useEffect(() => {
    const realVars = (product.variants || []).filter((v) => v && v !== 'الخيار الافتراضي');
    const uMeta = getProductUnitMeta(product.unit);
    const isFrac = Boolean(uMeta?.allowDecimal || ['kg', 'meter', 'liter', 'tola'].includes(product.unit || ''));
    const initialMin = product.minQuantity || (uMeta?.defaultMin ?? (isFrac ? 0.5 : 1));

    setSelectedImage(product.imageUrl);
    setSelectedVariant(realVars.length > 0 ? realVars[0] : '');
    setQuantity(initialMin);
    setQuantityInput(String(initialMin));
    setIsSuccess(false);
  }, [product]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const hasDiscount = Boolean(
    typeof product.salePrice === 'number' &&
      product.salePrice > 0 &&
      product.price > 0 &&
      product.salePrice < product.price
  );
  const currentPrice = hasDiscount ? product.salePrice! : product.price;
  const discountPercent = hasDiscount
    ? Math.round(((product.price - product.salePrice!) / product.price) * 100)
    : 0;

  const maxStock = typeof product.stockQuantity === 'number' ? product.stockQuantity : undefined;
  const isOutOfStock = !product.inStock || (maxStock !== undefined && maxStock <= 0);

  const handleQuantityInputChange = (val: string) => {
    const norm = normalizeArabicDigits(val).replace(/[^0-9.]/g, '');
    setQuantityInput(norm);
    const parsed = parseFloat(norm);
    if (!isNaN(parsed) && parsed > 0) {
      const clean = Math.round(parsed * 1000) / 1000;
      setQuantity(clean);
    }
  };

  const handleAdjustQuantity = (delta: number) => {
    const current = typeof quantity === 'number' && quantity > 0 ? quantity : minQty;
    let next = Math.round((current + delta) * 1000) / 1000;
    if (next < minQty) next = minQty;
    if (maxStock !== undefined && next > maxStock) next = maxStock;
    setQuantity(next);
    setQuantityInput(String(next));
  };

  const handleSetQuickQuantity = (val: number) => {
    let next = val;
    if (maxStock !== undefined && next > maxStock) next = maxStock;
    setQuantity(next);
    setQuantityInput(String(next));
  };

  const calculatedLineTotal = Math.round(currentPrice * quantity * 100) / 100;

  const handleAdd = () => {
    if (isOutOfStock) return;
    const finalQty = typeof quantity === 'number' && quantity > 0 ? quantity : minQty;
    onAddToCart(product, selectedVariant, finalQty);
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 700);
  };

  const handleAskOnWhatsApp = () => {
    const text = `مرحباً، أود الاستفسار عن: *${product.name}* (الكمية: ${quantity} ${unitLabel || 'حبة'}) عبر متجر ${settings.storeName}`;
    const url = createWhatsAppUrl(settings.whatsappNumber, text);
    window.open(url, '_blank');
  };

  const handleShareProduct = () => {
    const shareUrl = storeSlug
      ? buildShareableStoreUrl(storeSlug, product.id)
      : window.location.href;
    if (navigator.share) {
      navigator.share({
        title: `${product.name} | ${settings.storeName}`,
        text: product.description,
        url: shareUrl,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl);
      setCopiedShareLink(true);
      setTimeout(() => setCopiedShareLink(false), 2000);
    }
  };

  const allImages = [
    product.imageUrl,
    ...(product.galleryImages || []).filter((img) => img && img !== product.imageUrl),
  ].filter((img) => Boolean(img) && !isLegacyWatchPlaceholder(img));

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center p-0 sm:p-4 bg-stone-950/70 backdrop-blur-xs">
      {/* Backdrop */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Modal / Bottom Sheet Container */}
      <div className="relative w-full sm:max-w-3xl bg-white rounded-t-[28px] sm:rounded-3xl shadow-2xl overflow-hidden z-10 border-t sm:border border-stone-200 flex flex-col max-h-[92vh] sm:max-h-[88vh] animate-in slide-in-from-top-4 sm:zoom-in-95 duration-200">
        {/* Mobile Drag Indicator Handle */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center bg-white cursor-grab">
          <div className="w-10 h-1 bg-stone-300 rounded-full" />
        </div>

        {/* Top Header Controls (Close & Share) */}
        <div className="px-4 py-2 sm:p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center gap-2 text-xs font-bold text-stone-600 truncate">
            <span style={{ color: brand.accentColor }}>{product.category}</span>
            {unitLabel && (
              <>
                <span className="text-stone-300">·</span>
                <span className="text-stone-500 font-medium">{unitLabel}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleShareProduct}
              className="min-h-[36px] px-2.5 rounded-lg bg-white text-stone-700 hover:bg-stone-100 flex items-center gap-1 border border-stone-200 text-xs font-bold transition-transform active:scale-95 cursor-pointer"
              title="مشاركة رابط المنتج"
            >
              {copiedShareLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">تم النسخ</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">مشاركة</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-transform active:scale-90 cursor-pointer"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-stone-100">
          {/* Image & Gallery Column */}
          <div className="md:w-1/2 p-4 sm:p-6 bg-stone-50/50 flex flex-col items-center justify-center">
            <div className="aspect-square sm:aspect-4/3 w-full max-w-sm rounded-2xl overflow-hidden bg-white shadow-inner border border-stone-200 relative">
              <ProductImage
                src={selectedImage}
                alt={product.name}
                category={product.category}
                size="lg"
                width={600}
                height={600}
                accentColor={brand.accentColor}
                primaryColor={brand.primaryColor}
                className="w-full h-full"
                imgClassName="w-full h-full object-cover object-center"
              />
              {hasDiscount && (
                <span 
                  className="absolute top-2.5 right-2.5 text-white text-[11px] font-bold px-2 py-0.5 rounded-md shadow-xs z-10"
                  style={{ backgroundColor: brand.accentColor }}
                >
                  خصم {discountPercent}%
                </span>
              )}
            </div>

            {/* Thumbnail Strip */}
            {allImages.length > 1 && (
              <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1 max-w-full">
                {allImages.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedImage(img)}
                    className={`w-12 h-12 rounded-xl overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                      selectedImage === img
                        ? 'scale-105 shadow-xs'
                        : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                    style={{ borderColor: selectedImage === img ? brand.accentColor : 'transparent' }}
                  >
                    <ProductImage
                      src={img}
                      alt={`thumb-${idx}`}
                      size="xs"
                      width={100}
                      height={100}
                      className="w-full h-full"
                      imgClassName="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details & Options Column */}
          <div className="md:w-1/2 p-4 sm:p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              {/* Product Title */}
              <h2 className="text-base sm:text-xl font-black leading-snug" style={{ color: brand.primaryColor }}>
                {product.name}
              </h2>

              {/* Price Row */}
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-black font-mono tabular-nums" style={{ color: brand.primaryColor }}>
                  {currentPrice.toLocaleString('en-US')}
                </span>
                <span className="text-xs sm:text-sm font-bold text-stone-600">{settings.currency}</span>
                {unitLabel && (
                  <span className="text-xs font-semibold text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md">
                    لكل {unitLabel}
                  </span>
                )}
                {hasDiscount && (
                  <span className="text-xs sm:text-sm text-stone-400 line-through mr-1">
                    {product.price.toLocaleString('en-US')}
                  </span>
                )}
                {getZatcaComplianceType(settings) !== 'non_registered' && (
                  <span className="text-[11px] text-stone-400 font-medium">(شامل الضريبة 15%)</span>
                )}
              </div>

              {/* Description */}
              {product.description && (
                <p className="text-xs sm:text-sm text-stone-600 leading-relaxed font-normal">
                  {product.description}
                </p>
              )}

              {/* Variants Selection */}
              {realVariants.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <span className="text-xs font-bold text-stone-800">الخيارات المتاحة:</span>
                  <div className="flex flex-wrap gap-2">
                    {realVariants.map((v) => {
                      const isSelected = selectedVariant === v;
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setSelectedVariant(v)}
                          className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer active:scale-95 ${
                            isSelected
                              ? 'text-white shadow-2xs'
                              : 'bg-stone-50 text-stone-700 hover:bg-stone-100'
                          }`}
                          style={{
                            backgroundColor: isSelected ? brand.primaryColor : '#F9FAFB',
                            borderColor: isSelected ? brand.primaryColor : brand.neutralColor,
                          }}
                        >
                          {v}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quantity Stepper & Presets */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs font-bold text-stone-800">
                  <span>الكمية المطلوبة:</span>
                  {maxStock !== undefined && maxStock <= 10 && (
                    <span className="text-amber-700 text-[11px] font-semibold flex items-center gap-1">
                      <Flame className="w-3 h-3 text-amber-500" />
                      متبقي {maxStock} فقط
                    </span>
                  )}
                </div>

                {/* Tactile Stepper Box */}
                <div className="flex items-center justify-between p-1 bg-stone-100 rounded-xl border border-stone-200">
                  <button
                    type="button"
                    onClick={() => handleAdjustQuantity(-step)}
                    disabled={quantity <= minQty}
                    className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-lg bg-white text-stone-800 font-bold hover:bg-stone-50 disabled:opacity-30 flex items-center justify-center shadow-2xs text-lg active:scale-90 transition-transform cursor-pointer"
                    aria-label="تقليل الكمية"
                  >
                    -
                  </button>

                  <div className="flex items-center justify-center gap-1.5 px-3">
                    <input
                      type="text"
                      inputMode="decimal"
                      dir="ltr"
                      value={quantityInput}
                      onChange={(e) => handleQuantityInputChange(e.target.value)}
                      onBlur={() => {
                        if (!quantity || quantity < minQty) {
                          setQuantity(minQty);
                          setQuantityInput(String(minQty));
                        }
                      }}
                      className="w-16 text-center text-base font-mono tabular-nums font-bold text-stone-900 bg-white border border-stone-200 rounded-lg py-1 px-1 focus:outline-none"
                    />
                    {unitLabel && (
                      <span className="text-xs font-bold text-stone-600">{unitLabel}</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAdjustQuantity(step)}
                    disabled={maxStock !== undefined && quantity >= maxStock}
                    className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-lg bg-white text-stone-800 font-bold hover:bg-stone-50 disabled:opacity-30 flex items-center justify-center shadow-2xs text-lg active:scale-90 transition-transform cursor-pointer"
                    aria-label="زيادة الكمية"
                  >
                    +
                  </button>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  {(isFractional ? [0.5, 1, 1.5, 2] : [1, 2, 3, 5]).map((preset) => {
                    const isSelected = Math.abs(quantity - preset) < 0.001;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleSetQuickQuantity(preset)}
                        className={`min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-bold transition-all border cursor-pointer active:scale-95 ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                            : 'bg-white text-stone-700 hover:bg-stone-50 border-stone-200'
                        }`}
                      >
                        {preset === 0.5 ? '½' : preset} {unitLabel || 'حبة'}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Thumb-Zone Bottom Purchase Bar */}
        <div className="sticky bottom-0 bg-white border-t border-stone-200 p-3 sm:p-4 pb-safe space-y-2 shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
          <button
            type="button"
            onClick={handleAdd}
            disabled={isOutOfStock}
            className={`w-full min-h-[48px] py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-98 text-white cursor-pointer ${
              isOutOfStock ? 'bg-stone-300 text-stone-500 cursor-not-allowed' : ''
            }`}
            style={{
              backgroundColor: isSuccess ? '#059669' : !isOutOfStock ? brand.primaryColor : '#D1D5DB',
            }}
          >
            {isSuccess ? (
              <>
                <Check className="w-5 h-5 text-white" />
                <span>تمت الإضافة للسلة بنجاح!</span>
              </>
            ) : !isOutOfStock ? (
              <>
                <ShoppingBag className="w-4.5 h-4.5" style={{ color: brand.highlightColor || '#A5F3B6' }} />
                <span>
                  إضافة للسلة · {calculatedLineTotal.toLocaleString('en-US')} {settings.currency}
                  {unitLabel ? ` (${quantity} ${unitLabel})` : ''}
                </span>
              </>
            ) : (
              <span>نفدت الكمية حالياً</span>
            )}
          </button>

          {/* Quick WhatsApp Inquiry */}
          {settings.whatsappNumber && (
            <button
              type="button"
              onClick={handleAskOnWhatsApp}
              className="w-full min-h-[40px] py-2 px-3 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center gap-1.5 transition-colors border border-emerald-200/50 cursor-pointer active:scale-98"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>استفسار مباشر عن المنتج عبر الواتساب</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
