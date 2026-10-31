import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Product, StoreSettings, getProductUnitLabel } from '../../types/store';
import { Plus, Check, Flame, Package, Eye } from 'lucide-react';
import { getZatcaComplianceType } from '../../utils/zatca';
import { getOptimizedImageUrl } from '../../utils/imageOptimizer';

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

  const isFractional = Boolean(
    ['kg', 'meter', 'liter', 'tola'].includes(product.unit || '') ||
    (product.quantityStep !== undefined && product.quantityStep < 1) ||
    (product.minQuantity !== undefined && product.minQuantity < 1)
  );
  const hasVariants = (product.variants || []).filter((v) => v && v !== 'الخيار الافتراضي').length > 1;
  const quickAddTooltip = isOutOfStock
    ? 'غير متوفر'
    : hasVariants || isFractional
    ? 'اختيار الخيارات أو الكمية'
    : 'إضافة سريعة للسلة';

  return (
    <motion.div
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onClick={() => onSelectProduct(product)}
      className="group relative bg-white rounded-xl sm:rounded-2xl overflow-hidden transition-all duration-300 flex flex-col cursor-pointer border hover:shadow-md select-none"
      style={{ 
        borderColor: brand.neutralColor,
        boxShadow: '0 2px 10px rgba(15,23,42,0.04)'
      }}
    >
      {/* Product Image Frame */}
      <div className="relative aspect-square sm:aspect-4/3 w-full overflow-hidden bg-stone-100">
        {!imgError && product.imageUrl ? (
          <img
            src={getOptimizedImageUrl(product.imageUrl, 400, 80)}
            alt={product.name}
            width={400}
            height={400}
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-stone-100 text-stone-400 gap-1 p-2 text-center">
            <Package className="w-7 h-7 sm:w-8 sm:h-8 opacity-60" />
            <span className="text-[10px] sm:text-xs font-medium truncate max-w-full">{product.name}</span>
          </div>
        )}

        {/* Top Badges */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 z-10 pointer-events-none">
          {hasDiscount && (
            <span 
              className="text-white text-[10px] sm:text-[11px] font-bold px-1.5 sm:px-2 py-0.5 rounded-md shadow-xs"
              style={{ backgroundColor: brand.accentColor }}
            >
              خصم {discountPercent}%
            </span>
          )}
          {product.featured && (
            <span 
              className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-xs text-stone-900 border"
              style={{ backgroundColor: brand.highlightColor, borderColor: 'rgba(0,0,0,0.05)' }}
            >
              مميز ★
            </span>
          )}
          {isLowStock && (
            <span className="bg-amber-500 text-white text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-xs flex items-center gap-0.5">
              <Flame className="w-2.5 h-2.5" />
              <span>متبقي {product.stockQuantity}</span>
            </span>
          )}
        </div>

        {/* Stock status overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-2">
            <span className="bg-white text-stone-900 text-[11px] sm:text-xs font-bold px-2.5 py-1 rounded-lg border border-stone-200 shadow-sm">
              نفدت الكمية
            </span>
          </div>
        )}

        {/* Quick View hint on desktop hover */}
        <div className="absolute bottom-2 inset-x-2 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex items-center justify-center gap-1.5 bg-stone-900/90 backdrop-blur-xs text-white text-xs py-1.5 rounded-lg">
          <Eye className="w-3.5 h-3.5" style={{ color: brand.highlightColor }} />
          <span>عرض التفاصيل</span>
        </div>
      </div>

      {/* Product Meta & Details */}
      <div className="p-2.5 sm:p-3.5 flex flex-col flex-1 justify-between gap-2">
        <div>
          {/* Category as quiet unboxed text */}
          <div className="text-[10px] sm:text-[11px] font-bold mb-0.5 truncate" style={{ color: brand.accentColor }}>
            {product.category}
          </div>

          {/* Product Name */}
          <h3 
            className="text-xs sm:text-sm font-bold line-clamp-2 leading-tight sm:leading-snug group-hover:opacity-85 transition-opacity min-h-[2rem] sm:min-h-[2.5rem]"
            style={{ color: brand.primaryColor }}
          >
            {product.name}
          </h3>
        </div>

        {/* Price & Action row */}
        <div className="pt-1.5 border-t flex items-center justify-between gap-1.5" style={{ borderColor: brand.neutralColor }}>
          <div className="flex flex-col min-w-0">
            <div className="flex items-baseline gap-1">
              <span className="text-sm sm:text-base font-black font-mono tabular-nums leading-none" style={{ color: brand.primaryColor }}>
                {currentPrice.toLocaleString('en-US')}
              </span>
              <span className="text-[10px] sm:text-xs font-semibold text-stone-500">{settings.currency}</span>
            </div>

            {hasDiscount && (
              <span className="text-[10px] text-stone-400 line-through leading-none mt-0.5">
                {product.price.toLocaleString('en-US')}
              </span>
            )}

            {product.unit && product.unit !== 'piece' && (
              <span className="text-[9px] sm:text-[10px] text-stone-500 truncate mt-0.5">
                لكل {getProductUnitLabel(product.unit, product.unitLabel)}
              </span>
            )}
          </div>

          {/* Quick Add Button (Optimized touch hitbox) */}
          <button
            type="button"
            onClick={(e) => onQuickAdd(product, e)}
            disabled={isOutOfStock}
            className={`w-9 h-9 sm:w-10 sm:h-10 min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] rounded-lg sm:rounded-xl flex items-center justify-center transition-all cursor-pointer shrink-0 ${
              isAddedJustNow
                ? 'bg-emerald-600 text-white'
                : !isOutOfStock
                ? 'text-white hover:opacity-90 active:scale-90 shadow-2xs'
                : 'bg-stone-200 text-stone-400 cursor-not-allowed'
            }`}
            style={{ backgroundColor: isAddedJustNow ? '#059669' : !isOutOfStock ? brand.accentColor : '#E5E7EB' }}
            title={quickAddTooltip}
            aria-label={quickAddTooltip}
          >
            {isAddedJustNow ? (
              <Check className="w-4 h-4 animate-in zoom-in" />
            ) : (
              <Plus className="w-4.5 h-4.5 text-white" />
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export const ProductCard = React.memo(ProductCardComponent);
