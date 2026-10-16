import React, { useState, useEffect } from 'react';
import { Product, StoreSettings } from '../../types/store';
import { X, Check, ShoppingBag, MessageCircle, Sparkles } from 'lucide-react';
import { createWhatsAppUrl } from '../../utils/whatsappInvoice';

interface ProductModalProps {
  product: Product | null;
  settings: StoreSettings;
  onClose: () => void;
  onAddToCart: (product: Product, variant: string, quantity: number) => void;
  onOpenSizeGuide?: () => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  product,
  settings,
  onClose,
  onAddToCart,
  onOpenSizeGuide,
}) => {
  if (!product) return null;

  const brand = settings.brandTheme || {
    primaryColor: '#0B253F',
    accentColor: '#0077FF',
    highlightColor: '#A5F3B6',
    backgroundColor: '#F8F3ED',
    neutralColor: '#E4E7EB',
    textColor: '#0B253F',
  };

  const [selectedImage, setSelectedImage] = useState<string>(product.imageUrl);
  const [selectedVariant, setSelectedVariant] = useState<string>(
    product.variants && product.variants.length > 0 ? product.variants[0] : ''
  );
  const [quantity, setQuantity] = useState<number>(1);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  // Sync state if product changes
  useEffect(() => {
    setSelectedImage(product.imageUrl);
    setSelectedVariant(product.variants && product.variants.length > 0 ? product.variants[0] : '');
    setQuantity(1);
    setIsSuccess(false);
  }, [product]);

  const currentPrice = product.salePrice ?? product.price;
  const hasDiscount = product.salePrice && product.salePrice < product.price;
  const discountPercent = hasDiscount
    ? Math.round(((product.price - product.salePrice!) / product.price) * 100)
    : 0;

  const handleAdd = () => {
    if (!product.inStock) return;
    onAddToCart(product, selectedVariant, quantity);
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 900);
  };

  const handleAskOnWhatsApp = () => {
    const text = `مرحباً، أود الاستفسار عن: *${product.name}* (ID: ${product.id}) عبر متجر ${settings.storeName}`;
    const url = createWhatsAppUrl(settings.whatsappNumber, text);
    window.open(url, '_blank');
  };

  const allImages = [
    product.imageUrl,
    ...(product.galleryImages || []).filter((img) => img !== product.imageUrl),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-stone-950/70 backdrop-blur-xs">
      {/* Backdrop click to close */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden z-10 border border-stone-200 my-auto flex flex-col md:flex-row max-h-[90vh]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 left-3 z-20 w-8 h-8 rounded-full bg-white/90 text-stone-700 hover:bg-stone-100 flex items-center justify-center shadow-sm border border-stone-200 transition-transform active:scale-90"
          aria-label="إغلاق النافذة"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Product Media Column */}
        <div className="md:w-1/2 bg-stone-50 flex flex-col justify-between p-4 sm:p-6 border-b md:border-b-0 md:border-l border-stone-200 overflow-y-auto">
          {/* Main Selected Image */}
          <div className="aspect-4/3 w-full rounded-2xl overflow-hidden bg-stone-100 relative shadow-inner border border-stone-200">
            <img
              src={selectedImage}
              alt={product.name}
              className="w-full h-full object-cover object-center transition-all duration-300"
            />
            {hasDiscount && (
              <span 
                className="absolute top-3 right-3 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-sm"
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
                  onClick={() => setSelectedImage(img)}
                  className={`w-14 h-14 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${
                    selectedImage === img
                      ? 'scale-105 shadow-xs'
                      : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                  style={{ borderColor: selectedImage === img ? brand.accentColor : 'transparent' }}
                >
                  <img src={img} alt={`thumb-${idx}`} className="w-full h-full object-cover" />
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
              <span className="font-mono text-stone-400">#{product.id}</span>
            </div>

            {/* Title */}
            <h2 className="text-lg sm:text-xl font-bold leading-snug" style={{ color: brand.primaryColor }}>
              {product.name}
            </h2>

            {/* Price Row */}
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono" style={{ color: brand.primaryColor }}>
                {currentPrice.toLocaleString('en-US')}
              </span>
              <span className="text-sm font-bold text-stone-600">{settings.currency}</span>
              {hasDiscount && (
                <span className="text-sm text-stone-400 line-through mr-2">
                  {product.price.toLocaleString('en-US')} {settings.currency}
                </span>
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
                  <strong style={{ color: brand.primaryColor }}>المواصفات / الأدوات:</strong> {product.fabricComposition}
                </span>
              </div>
            )}

            {/* Description */}
            <div className="mt-4 text-xs sm:text-sm text-stone-600 leading-relaxed border-t border-stone-100 pt-3">
              <p>{product.description}</p>
            </div>

            {/* Variants / Packages Selection */}
            {product.variants && product.variants.length > 0 && (
              <div className="mt-5 space-y-2">
                <span className="text-xs font-bold text-stone-800">اختيار الباقة / الخيار المطلوب:</span>

                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v) => {
                    const isSelected = selectedVariant === v;
                    return (
                      <button
                        key={v}
                        onClick={() => setSelectedVariant(v)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
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

            {/* Quantity Selector */}
            <div className="mt-5 flex items-center justify-between">
              <span className="text-xs font-bold text-stone-800">الكمية:</span>
              <div className="flex items-center gap-3 bg-stone-100 rounded-xl p-1 border border-stone-200">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-7 h-7 rounded-lg bg-white text-stone-700 font-bold hover:bg-stone-50 flex items-center justify-center shadow-xs"
                >
                  -
                </button>
                <span className="w-8 text-center text-xs font-mono font-bold text-stone-900">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-7 h-7 rounded-lg bg-white text-stone-700 font-bold hover:bg-stone-50 flex items-center justify-center shadow-xs"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-stone-200 space-y-2">
            <button
              onClick={handleAdd}
              disabled={!product.inStock}
              className={`w-full py-3.5 px-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-98 text-white ${
                !product.inStock ? 'bg-stone-300 text-stone-500 cursor-not-allowed' : ''
              }`}
              style={{
                backgroundColor: isSuccess ? '#059669' : product.inStock ? brand.primaryColor : '#D1D5DB',
              }}
            >
              {isSuccess ? (
                <>
                  <Check className="w-5 h-5 text-white" />
                  <span>تمت الإضافة للسلة بنجاح!</span>
                </>
              ) : product.inStock ? (
                <>
                  <ShoppingBag className="w-5 h-5" style={{ color: brand.highlightColor || '#A5F3B6' }} />
                  <span>
                    إضافة للسلة · {(currentPrice * quantity).toLocaleString('en-US')} {settings.currency}
                  </span>
                </>
              ) : (
                <span>غير متوفر حالياً</span>
              )}
            </button>

            {/* Quick Ask on WhatsApp */}
            <button
              onClick={handleAskOnWhatsApp}
              className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center gap-1.5 transition-colors border border-emerald-200/50"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              <span>استفسار مباشر عبر الواتساب (+966 53 292 3509)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
