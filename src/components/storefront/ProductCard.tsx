import React, { useState } from 'react';
import { Product, StoreSettings } from '../../types/store';
import { Plus, Eye, Check, Flame, Package } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  settings: StoreSettings;
  onSelectProduct: (p: Product) => void;
  onQuickAdd: (p: Product, e: React.MouseEvent) => void;
  isAddedJustNow?: boolean;
}

const ProductCardComponent: React.FC<ProductCardProps> = ({
  product,
  settings,
  onSelectProduct,
  onQuickAdd,
  isAddedJustNow,
}) => {
  const [imgError, setImgError] = useState(false);

  const brand = settings.brandTheme || {
    primaryColor: '#0B253F',
    accentColor: '#0077FF',
    highlightColor: '#A5F3B6',
    backgroundColor: '#F8FAFC',
    neutralColor: '#E4E7EB',
    textColor: '#0B253F',
  };

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

  const isOutOfStock =
    !product.inStock || (typeof product.stockQuantity === 'number' && product.stockQuantity <= 0);
  const isLowStock =
    !isOutOfStock &&
    typeof product.stockQuantity === 'number' &&
    product.stockQuantity > 0 &&
    product.stockQuantity <= 5;

  return (
    <div
      onClick={() => onSelectProduct(product)}
      className="group relative bg-white rounded-2xl overflow-hidden transition-all duration-300 flex flex-col cursor-pointer border hover:-translate-y-1 hover:shadow-md"
      style={{ 
        borderColor: brand.neutralColor,
        boxShadow: '0 4px 14px rgba(11,37,63,0.05)'
      }}
    >
      {/* Product Image Frame */}
      <div className="relative aspect-4/3 w-full overflow-hidden bg-stone-100">
        {!imgError && product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-stone-100 text-stone-400 gap-1.5">
            <Package className="w-8 h-8 opacity-60" />
            <span className="text-[11px] font-medium">{product.name}</span>
          </div>
        )}

        {/* Top Badges */}
        <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5 z-10">
          {hasDiscount && (
            <span 
              className="text-white text-[11px] font-bold px-2 py-0.5 rounded-md shadow-xs"
              style={{ backgroundColor: brand.accentColor }}
            >
              خصم {discountPercent}%
            </span>
          )}
          {product.featured && (
            <span 
              className="text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs text-stone-900 border"
              style={{ backgroundColor: brand.highlightColor, borderColor: 'rgba(0,0,0,0.05)' }}
            >
              مميز ★
            </span>
          )}
          {isLowStock && (
            <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1">
              <Flame className="w-3 h-3" />
              <span>متبقي {product.stockQuantity} فقط</span>
            </span>
          )}
        </div>

        {/* Stock status overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center">
            <span className="bg-white text-stone-900 text-xs font-bold px-3 py-1.5 rounded-lg border border-stone-200">
              نفدت الكمية
            </span>
          </div>
        )}

        {/* Quick View hint on hover */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex items-center justify-center gap-1.5 bg-stone-900/85 backdrop-blur-xs text-white text-xs py-2 rounded-xl">
          <Eye className="w-3.5 h-3.5" style={{ color: brand.highlightColor }} />
          <span>عرض التفاصيل والخيارات</span>
        </div>
      </div>

      {/* Product Meta & Details */}
      <div className="p-4 flex flex-col flex-1 justify-between gap-3">
        <div>
          {/* Category as unboxed text */}
          <div className="text-[11px] font-semibold mb-1 flex items-center gap-1" style={{ color: brand.accentColor }}>
            <span>{product.category}</span>
            {product.fabricComposition && (
              <>
                <span className="text-stone-300">·</span>
                <span className="text-stone-500 font-normal truncate max-w-[120px]">{product.fabricComposition}</span>
              </>
            )}
          </div>

          {/* Product Name */}
          <h3 
            className="text-sm font-bold line-clamp-2 leading-snug group-hover:opacity-85 transition-opacity"
            style={{ color: brand.primaryColor }}
          >
            {product.name}
          </h3>

          {/* Variants summary text */}
          {product.variants && product.variants.length > 0 && (
            <div className="mt-1.5 text-[11px] text-stone-500 flex items-center gap-1 overflow-hidden">
              <span className="shrink-0 text-stone-400">الخيارات:</span>
              <span className="truncate">{product.variants.join(' · ')}</span>
            </div>
          )}
        </div>

        {/* Price & Action row */}
        <div className="pt-2 border-t flex items-center justify-between gap-2" style={{ borderColor: brand.neutralColor }}>
          <div className="flex flex-col">
            <div className="flex items-baseline gap-1">
              <span className="text-base sm:text-lg font-black font-mono" style={{ color: brand.primaryColor }}>
                {currentPrice.toLocaleString('en-US')}
              </span>
              <span className="text-xs font-semibold text-stone-500">{settings.currency}</span>
            </div>
            {hasDiscount && (
              <span className="text-[11px] text-stone-400 line-through">
                {product.price.toLocaleString('en-US')} {settings.currency}
              </span>
            )}
          </div>

          {/* Quick add button */}
          <button
            onClick={(e) => onQuickAdd(product, e)}
            disabled={isOutOfStock}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              isAddedJustNow
                ? 'bg-emerald-600 text-white'
                : !isOutOfStock
                ? 'text-white hover:opacity-90 active:scale-95 shadow-xs'
                : 'bg-stone-200 text-stone-400 cursor-not-allowed'
            }`}
            style={{ backgroundColor: isAddedJustNow ? '#059669' : !isOutOfStock ? brand.accentColor : '#E5E7EB' }}
            title={!isOutOfStock ? (product.variants?.length > 1 ? 'اختيار الخيار والإضافة' : 'إضافة سريعة للسلة') : 'غير متوفر'}
          >
            {isAddedJustNow ? (
              <Check className="w-4 h-4 animate-in zoom-in" />
            ) : (
              <Plus className="w-4 h-4 text-white" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export const ProductCard = React.memo(ProductCardComponent);
