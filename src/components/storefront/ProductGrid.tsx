import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Product, StoreSettings } from '../../types/store';
import { ProductCard } from './ProductCard';
import { SearchX, SlidersHorizontal, ChevronDown } from 'lucide-react';

interface ProductGridProps {
  products: Product[];
  settings: StoreSettings;
  onSelectProduct: (product: Product) => void;
  onQuickAdd: (product: Product, e: React.MouseEvent) => void;
  justAddedId: string | null;
  onResetFilters: () => void;
  isFiltered: boolean;
  isLoading?: boolean;
}

const PAGE_SIZE = 40;

export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  settings,
  onSelectProduct,
  onQuickAdd,
  justAddedId,
  onResetFilters,
  isFiltered,
  isLoading = false,
}) => {
  const [sortBy, setSortBy] = useState<'default' | 'newest' | 'discount' | 'price-asc' | 'price-desc'>('default');
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Reset pagination when filter or sort changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [products, sortBy]);

  const brand = settings.brandTheme || {
    primaryColor: '#0B253F',
    accentColor: '#0077FF',
  };

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      const priceA = (a.salePrice && a.salePrice > 0 && a.salePrice < a.price) ? a.salePrice : a.price;
      const priceB = (b.salePrice && b.salePrice > 0 && b.salePrice < b.price) ? b.salePrice : b.price;

      if (sortBy === 'price-asc') return priceA - priceB;
      if (sortBy === 'price-desc') return priceB - priceA;
      if (sortBy === 'discount') {
        const discA = (a.salePrice && a.salePrice > 0 && a.price > 0 && a.salePrice < a.price)
          ? (a.price - a.salePrice) / a.price
          : 0;
        const discB = (b.salePrice && b.salePrice > 0 && b.price > 0 && b.salePrice < b.price)
          ? (b.price - b.salePrice) / b.price
          : 0;
        return discB - discA;
      }
      if (sortBy === 'newest') {
        return b.id.localeCompare(a.id);
      }
      // Default: featured first, then original order
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      return 0;
    });
  }, [products, sortBy]);

  const visibleProducts = useMemo(() => {
    return sortedProducts.slice(0, visibleCount);
  }, [sortedProducts, visibleCount]);

  const hasMore = visibleCount < sortedProducts.length;

  // Infinite Scroll intersection observer: loads next batch seamlessly without freezing
  useEffect(() => {
    if (!hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, sortedProducts.length));
        }
      },
      { rootMargin: '400px' }
    );

    const el = loadMoreRef.current;
    if (el) observer.observe(el);
    return () => {
      if (el) observer.unobserve(el);
    };
  }, [hasMore, sortedProducts.length]);

  return (
    <section className="space-y-3 sm:space-y-4">
      {/* Controls & Counts Bar */}
      <div className="flex items-center justify-between gap-2 text-xs sm:text-sm text-stone-600 pb-2 border-b border-stone-200">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <span className="font-bold text-stone-900 text-xs sm:text-sm whitespace-nowrap">المنتجات:</span>
          <span className="bg-stone-100 text-stone-800 px-2 py-0.5 rounded-md font-mono tabular-nums text-xs font-bold">
            {sortedProducts.length}
          </span>
          {isFiltered && (
            <button
              type="button"
              onClick={onResetFilters}
              className="underline text-[11px] sm:text-xs mr-1 font-bold cursor-pointer whitespace-nowrap"
              style={{ color: brand.accentColor }}
            >
              إلغاء التصفية
            </button>
          )}
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-1.5 shrink-0">
          <SlidersHorizontal className="w-3.5 h-3.5 text-stone-400 hidden sm:inline" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-white border border-stone-200 rounded-lg px-2 py-1 text-xs text-stone-800 focus:outline-none focus:ring-1 focus:ring-blue-500/20 cursor-pointer"
          >
            <option value="default">المميز والأكثر طلباً</option>
            <option value="newest">الأحدث إضافة</option>
            <option value="discount">العروض والخصومات</option>
            <option value="price-asc">السعر: الأقل أولاً</option>
            <option value="price-desc">السعر: الأعلى أولاً</option>
          </select>
        </div>
      </div>

      {/* Grid of cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 md:gap-6 animate-pulse">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl sm:rounded-2xl overflow-hidden border border-stone-200 shadow-2xs flex flex-col">
              <div className="aspect-square sm:aspect-4/3 bg-stone-200" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-stone-200 rounded w-1/3" />
                <div className="h-4 bg-stone-200 rounded w-3/4" />
                <div className="h-4 bg-stone-200 rounded w-1/2 pt-2" />
              </div>
            </div>
          ))}
        </div>
      ) : sortedProducts.length === 0 ? (
        <div className="py-16 text-center space-y-3 bg-white rounded-2xl border border-stone-200 p-6 shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-400 mx-auto flex items-center justify-center">
            <SearchX className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-stone-800">لا توجد نتائج مطابقة لبحثك</h3>
          <p className="text-xs text-stone-500 max-w-xs mx-auto">
            جرب البحث بكلمات أخرى أو اختر قسماً مختلفاً من القائمة أعلاه.
          </p>
          {isFiltered && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onResetFilters}
                className="px-4 py-2 text-white rounded-xl text-xs font-bold shadow-2xs active:scale-95 transition-transform cursor-pointer"
                style={{ backgroundColor: brand.accentColor }}
              >
                عرض كل المنتجات
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 md:gap-6">
            {visibleProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                settings={settings}
                onSelectProduct={onSelectProduct}
                onQuickAdd={onQuickAdd}
                isAddedJustNow={justAddedId === product.id}
              />
            ))}
          </div>

          {/* Infinite Scroll trigger & Manual Fallback Button */}
          {hasMore && (
            <div ref={loadMoreRef} className="py-8 flex flex-col items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => Math.min(prev + PAGE_SIZE * 2, sortedProducts.length))}
                className="px-6 py-2.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-bold shadow-2xs flex items-center gap-2 cursor-pointer transition-all active:scale-95"
              >
                <span>عرض المزيد من المنتجات ({sortedProducts.length - visibleCount} متبقي)</span>
                <ChevronDown className="w-4 h-4 text-stone-400" />
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
};
