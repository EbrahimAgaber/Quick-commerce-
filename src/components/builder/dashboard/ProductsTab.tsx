import React, { useState, useMemo } from 'react';
import {
  Search,
  Download,
  FileSpreadsheet,
  Trash2,
  Plus,
  ShoppingBag,
  Star,
  Edit3,
} from 'lucide-react';
import type { Product, StoreSettings } from '../../../types/store';
import { getProductUnitLabel } from '../../../types/store';

interface ProductsTabProps {
  products: Product[];
  settings: StoreSettings;
  onExportCSV: () => void;
  onOpenCsvImport: () => void;
  onClearCatalog: () => void;
  onOpenAddProduct: () => void;
  onOpenEditProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onToggleProductStock: (productId: string) => void;
}

export const ProductsTab: React.FC<ProductsTabProps> = ({
  products,
  settings,
  onExportCSV,
  onOpenCsvImport,
  onClearCatalog,
  onOpenAddProduct,
  onOpenEditProduct,
  onDeleteProduct,
  onToggleProductStock,
}) => {
  const [productSearch, setProductSearch] = useState('');

  const filteredProductsList = useMemo(() => {
    if (!productSearch.trim()) return products;
    const q = productSearch.toLowerCase().trim();
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  }, [products, productSearch]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-stone-900">
            كتالوج المنتجات ({products.length})
          </h3>
          <p className="text-xs text-stone-500">
            ارفع صور منتجاتك من جوالك أو جهازك مباشرة واستخدم الذكاء الاصطناعي لكتابة الوصف
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <input
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="ابحث بالاسم أو القسم..."
              className="w-full pr-8 pl-3 py-2 text-xs bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
            />
            <Search className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          {products.length > 0 && (
            <button
              type="button"
              onClick={onExportCSV}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-emerald-200 shrink-0"
              title="تصدير المنتجات الحالية إلى ملف CSV لـ Excel أو Google Sheets"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">تصدير CSV</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenCsvImport}
            className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-stone-300 shrink-0 shadow-2xs"
            title="استيراد منتجات من ملف CSV أو Google Sheets"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>استيراد CSV</span>
          </button>

          {products.length > 0 && (
            <button
              type="button"
              onClick={onClearCatalog}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-rose-200 shrink-0"
              title="تفريغ كافة المنتجات من المتجر"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">تفريغ الكتالوج</span>
            </button>
          )}

          <button
            onClick={onOpenAddProduct}
            className="px-4 py-2 bg-[#2563EB] hover:bg-blue-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة منتج</span>
          </button>
        </div>
      </div>

      {/* Products Grid */}
      {filteredProductsList.length === 0 ? (
        <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-stone-800 text-sm">لا توجد منتجات حالياً</h4>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            {productSearch ? 'جرّب البحث بكلمة مختلفة' : 'ابدأ بإضافة أول منتج أو استورد كافة منتجاتك دفعة واحدة من Google Sheets'}
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <button
              onClick={onOpenCsvImport}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>استيراد من Google Sheets (CSV)</span>
            </button>
            <button
              onClick={onOpenAddProduct}
              className="px-4 py-2 bg-[#2563EB] hover:bg-blue-600 text-white font-bold rounded-xl text-xs inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة منتج يدوياً</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProductsList.map((prod) => (
            <div
              key={prod.id}
              className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-stone-100 shrink-0 border border-stone-100 relative">
                    <img
                      src={prod.imageUrl}
                      alt={prod.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80';
                      }}
                    />
                    {prod.featured && (
                      <span className="absolute top-1 right-1 bg-amber-400 text-stone-950 p-0.5 rounded-full">
                        <Star className="w-2.5 h-2.5 fill-current" />
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 truncate">
                        {prod.category}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          prod.inStock
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {prod.inStock
                          ? prod.stockQuantity !== undefined
                            ? `متوفر (${prod.stockQuantity} ${getProductUnitLabel(prod.unit, prod.unitLabel)})`
                            : 'متوفر'
                          : 'نفذت الكمية'}
                      </span>
                    </div>

                    <h4 className="font-bold text-stone-900 text-sm mt-1 truncate">
                      {prod.name}
                    </h4>

                    <div className="flex items-baseline gap-1.5 mt-1">
                      <span className="font-black text-sm text-[#0F172A] font-mono">
                        {(prod.salePrice ?? prod.price).toLocaleString('en-US')} {settings.currency}
                      </span>
                      {prod.unit && prod.unit !== 'piece' && (
                        <span className="text-[11px] font-medium text-stone-500">
                          / {getProductUnitLabel(prod.unit, prod.unitLabel)}
                        </span>
                      )}
                      {Boolean(prod.salePrice && prod.salePrice < prod.price) && (
                        <span className="text-xs text-stone-400 line-through font-mono mr-1">
                          {prod.price.toLocaleString('en-US')} {settings.currency}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {prod.description && (
                  <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">
                    {prod.description}
                  </p>
                )}

                {prod.variants && prod.variants.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {prod.variants.slice(0, 3).map((v: string, i: number) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-slate-50 text-[#0F172A] border border-stone-200"
                      >
                        {v}
                      </span>
                    ))}
                    {prod.variants.length > 3 && (
                      <span className="text-[10px] text-stone-400 self-center">
                        +{prod.variants.length - 3} أخرى
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Card Bottom Actions */}
              <div className="px-4 py-2.5 bg-stone-50 border-t border-stone-100 flex items-center justify-between text-xs">
                <button
                  onClick={() => onToggleProductStock(prod.id)}
                  className={`text-[11px] font-bold transition-colors cursor-pointer ${
                    prod.inStock ? 'text-stone-500 hover:text-stone-800' : 'text-emerald-600 font-bold'
                  }`}
                >
                  {prod.inStock ? 'تعيين كغير متوفر' : 'تعيين كمتوفر الآن'}
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onOpenEditProduct(prod)}
                    className="p-1.5 text-stone-600 hover:text-[#2563EB] hover:bg-white rounded-lg transition-colors cursor-pointer"
                    title="تعديل المنتج"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onDeleteProduct(prod.id)}
                    className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                    title="حذف المنتج"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
