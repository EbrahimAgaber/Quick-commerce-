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
    }, 800);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-stone-950/70 backdrop-blur-xs">
      {/* Backdrop click to close */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden z-10 border border-stone-200 my-auto flex flex-col md:flex-row max-h-[90vh]">
        {/* Top Action Buttons (Close + Share) */}
        <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
          <button
            onClick={handleShareProduct}
            className="h-8 px-2.5 rounded-full bg-white/90 text-stone-700 hover:bg-stone-100 flex items-center gap-1 shadow-sm border border-stone-200 text-[11px] font-bold transition-transform active:scale-95 cursor-pointer"
            title="مشاركة رابط المنتج"
          >
            {copiedShareLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">تم نسخ الرابط</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                <span>مشاركة</span>
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/90 text-stone-700 hover:bg-stone-100 flex items-center justify-center shadow-sm border border-stone-200 transition-transform active:scale-90 cursor-pointer"
            aria-label="إغلاق النافذة"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Product Media Column */}
        <div className="md:w-1/2 bg-stone-50 flex flex-col justify-between p-4 sm:p-6 border-b md:border-b-0 md:border-l border-stone-200 overflow-y-auto">
          {/* Main Selected Image */}
          <div className="aspect-4/3 w-full rounded-2xl overflow-hidden bg-stone-100 relative shadow-inner border border-stone-200">
            <ProductImage
              src={selectedImage}
              alt={product.name}
              category={product.category}
              size="lg"
              width={800}
              height={600}
              accentColor={brand.accentColor}
              primaryColor={brand.primaryColor}
              className="w-full h-full"
              imgClassName="w-full h-full object-cover object-center transition-all duration-300"
            />
            {hasDiscount && (
              <span 
                className="absolute top-3 right-3 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-sm z-20"
                style={{ backgroundColor: brand.accentColor }}
              >
                وفر {discountPercent}%
              </span>
            )}
          </div>

          {/* Thumbnail Strip */}
          {allImages.length > 1 && (
            <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1">
              {allImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedImage(img);
                  }}
                  className={`w-14 h-14 rounded-xl overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
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
                    width={120}
                    height={120}
                    className="w-full h-full"
                    imgClassName="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info & Controls Column */}
        <div className="md:w-1/2 p-5 sm:p-6 flex flex-col justify-between overflow-y-auto space-y-4">
          <div>
            {/* Meta */}
            <div className="flex items-center justify-between text-xs text-stone-500 mb-1.5">
              <span className="font-semibold" style={{ color: brand.accentColor }}>{product.category}</span>
              {maxStock !== undefined && maxStock > 0 && maxStock <= 10 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold text-[11px]">
                  <Flame className="w-3 h-3 text-amber-500" />
                  <span>متبقي {maxStock} في المخزون</span>
                </span>
              )}
            </div>

            {/* Title */}
            <h2 className="text-lg sm:text-xl font-bold leading-snug" style={{ color: brand.primaryColor }}>
              {product.name}
            </h2>

            {/* Price Row */}
            <div className="mt-3 flex flex-wrap items-baseline gap-2">
              <span className="text-2xl font-black font-mono" style={{ color: brand.primaryColor }}>
                {currentPrice.toLocaleString('en-US')}
              </span>
              <span className="text-sm font-bold text-stone-600">{settings.currency}</span>
              {unitLabel && (
                <span className="text-xs font-bold text-stone-700 bg-stone-100 px-2 py-0.5 rounded-lg border border-stone-200">
                  / {unitLabel}
                </span>
              )}
              {hasDiscount && (
                <span className="text-sm text-stone-400 line-through mr-2">
                  {product.price.toLocaleString('en-US')} {settings.currency}
                </span>
              )}
              {getZatcaComplianceType(settings) !== 'non_registered' && (
                <span className="text-xs text-stone-500 font-medium mr-2">(شامل ضريبة القيمة المضافة 15%)</span>
              )}
            </div>

            {/* Fabric / Specs notes */}
            {product.fabricComposition && (
              <div 
                className="mt-3 p-2.5 rounded-xl border flex items-center gap-2 text-xs"
                style={{ backgroundColor: `${brand.neutralColor}40`, borderColor: brand.neutralColor }}
              >
                <Sparkles className="w-4 h-4 shrink-0" style={{ color: brand.accentColor }} />
                <span>
                  <strong style={{ color: brand.primaryColor }}>المواصفات:</strong> {product.fabricComposition}
                </span>
              </div>
            )}

            {/* Description */}
            <div className="mt-4 text-xs sm:text-sm text-stone-600 leading-relaxed border-t border-stone-100 pt-3">
              <p>{product.description}</p>
            </div>

            {/* Variants / Packages Selection */}
            {realVariants.length > 0 && (
              <div className="mt-5 space-y-2">
                <span className="text-xs font-bold text-stone-800">اختر الخيار المطلوب:</span>

                <div className="flex flex-wrap gap-2">
                  {realVariants.map((v) => {
                    const isSelected = selectedVariant === v;
                    return (
                      <button
                        key={v}
                        onClick={() => setSelectedVariant(v)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                          isSelected
                            ? 'text-white shadow-xs ring-2 ring-blue-500/20'
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

            {/* Quantity Selector with Custom Amount & Quick Chips */}
            <div className="mt-5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-800">
                  الكمية المطلوبة {unitLabel ? `(${unitLabel})` : ''}:
                </span>
                <span className="text-[11px] text-stone-500">
                  (الخطوة: {step} {unitLabel} · الحد الأدنى: {minQty})
                </span>
              </div>

              {/* Stepper with direct editable text input */}
              <div className="flex items-center justify-between p-1.5 bg-stone-100 rounded-2xl border border-stone-200">
                <button
                  type="button"
                  onClick={() => handleAdjustQuantity(-step)}
                  disabled={quantity <= minQty}
                  className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-xl bg-white text-stone-700 font-bold hover:bg-stone-50 disabled:opacity-40 flex items-center justify-center shadow-xs cursor-pointer text-lg"
                  aria-label="تقليل الكمية"
                >
                  -
                </button>

                <div className="flex items-center justify-center gap-1.5 flex-1 px-2">
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
                    className="w-20 text-center text-base sm:text-lg font-mono font-bold text-stone-900 bg-white border border-stone-200 rounded-lg py-1 px-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                  />
                  {unitLabel && (
                    <span className="text-xs font-semibold text-stone-600">
                      {unitLabel}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleAdjustQuantity(step)}
                  disabled={maxStock !== undefined && quantity >= maxStock}
                  className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-xl bg-white text-stone-700 font-bold hover:bg-stone-50 disabled:opacity-40 flex items-center justify-center shadow-xs cursor-pointer text-lg"
                  aria-label="زيادة الكمية"
                >
                  +
                </button>
              </div>

              {/* Quick Preset Amount Chips */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[10px] text-stone-400 font-bold ml-1">كميات سريعة:</span>
                {(isFractional ? [0.5, 1, 1.5, 2, 3] : [1, 2, 3, 5, 10]).map((preset) => {
                  const isSelected = Math.abs(quantity - preset) < 0.001;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleSetQuickQuantity(preset)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-white text-stone-700 hover:bg-stone-50 border-stone-200'
                      }`}
                    >
                      {preset === 0.5 ? '½' : preset === 1.5 ? '1.5' : preset} {unitLabel || 'حبة'}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-stone-200 space-y-2">
            <button
              onClick={handleAdd}
              disabled={isOutOfStock}
              className={`w-full py-3.5 px-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-98 text-white cursor-pointer ${
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
                  <ShoppingBag className="w-5 h-5" style={{ color: brand.highlightColor || '#A5F3B6' }} />
                  <span>
                    إضافة للسلة · {calculatedLineTotal.toLocaleString('en-US')} {settings.currency}
                    {unitLabel ? ` (${quantity} ${unitLabel})` : ''}
                  </span>
                </>
              ) : (
                <span>نفدت الكمية حالياً</span>
              )}
            </button>

            {/* Quick Ask on WhatsApp */}
            {settings.whatsappNumber && (
              <button
                onClick={handleAskOnWhatsApp}
                className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center gap-1.5 transition-colors border border-emerald-200/50 cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <span>استفسار مباشر عن المنتج عبر الواتساب</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
