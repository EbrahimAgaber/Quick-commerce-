import React, { useState } from 'react';
import { Product, StoreSettings } from '../../types/store';
import { ProductCard } from './ProductCard';
import { ArrowDownAZ, ArrowUpZA, Sparkles, SearchX } from 'lucide-react';

interface ProductGridProps {
  products: Product[];
  settings: StoreSettings;
  onSelectProduct: (product: Product) => void;
  onQuickAdd: (product: Product, e: React.MouseEvent) => void;
  justAddedId: string | null;
  onResetFilters: () => void;
  isFiltered: boolean;
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  settings,
  onSelectProduct,
  onQuickAdd,
  justAddedId,
  onResetFilters,
  isFiltered,
}) => {
  const [sortBy, setSortBy] = useState<'default' | 'price-asc' | 'price-desc'>('default');

  const sortedProducts = [...products].sort((a, b) => {
    const priceA = a.salePrice ?? a.price;
    const priceB = b.salePrice ?? b.price;

    if (sortBy === 'price-asc') return priceA - priceB;
    if (sortBy === 'price-desc') return priceB - priceA;
    // Default: featured first, then keep original order
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return 0;
  });

  return (
    <div className="space-y-4">
      {/* Controls & Counts Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-stone-600 pb-2 border-b border-stone-200">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-stone-900">المنتجات المتوفرة:</span>
          <span className="bg-stone-100 text-stone-800 px-2 py-0.5 rounded font-mono font-bold">
            {sortedProducts.length}
          </span>
          {isFiltered && (
            <button
              onClick={onResetFilters}
              className="text-amber-600 hover:text-amber-700 underline text-xs mr-2"
            >
              إلغاء التصفية
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-stone-500">الترتيب:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-white border border-stone-200 rounded-lg px-2.5 py-1 text-xs text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="default">المميز والأحدث</option>
            <option value="price-asc">السعر: من الأقل للأعلى</option>
            <option value="price-desc">السعر: من الأعلى للأقل</option>
          </select>
        </div>
      </div>

      {/* Grid of cards */}
      {sortedProducts.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
          {sortedProducts.map((prod) => (
            <ProductCard
              key={prod.id}
              product={prod}
              settings={settings}
              onSelectProduct={onSelectProduct}
              onQuickAdd={onQuickAdd}
              isAddedJustNow={justAddedId === prod.id}
            />
          ))}
        </div>
      ) : (
        <div className="py-16 text-center space-y-3 bg-white rounded-2xl border border-stone-200 p-8 max-w-md mx-auto">
          <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-400 mx-auto flex items-center justify-center">
            <SearchX className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-stone-800">لم يتم العثور على أي منتج</h3>
          <p className="text-xs text-stone-500">
            جربي البحث بكلمات أخرى أو تصفح جميع الأقسام لإيجاد ما يناسبكِ.
          </p>
          <button
            onClick={onResetFilters}
            className="px-4 py-2 bg-stone-900 text-white text-xs font-semibold rounded-xl hover:bg-stone-800 transition-colors"
          >
            عرض كافة المنتجات
          </button>
        </div>
      )}
    </div>
  );
};
