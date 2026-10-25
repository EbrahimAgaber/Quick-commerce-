import React, { useState, useEffect } from 'react';
import { 
  Product, 
  StoreSettings, 
  STANDARD_UNITS, 
  getProductUnitMeta, 
  getProductUnitLabel, 
  ProductUnit 
} from '../../../types/store';
import { uploadImageToServer } from '../../../utils/imageUploader';
import { normalizeProductImageUrl } from '../../../utils/csvProductParser';
import { isLegacyWatchPlaceholder } from '../../../utils/imageOptimizer';
import { requestAIGeneration } from '../../../services/aiService';
import { normalizeArabicDigits } from '../../../utils/digits';
import { 
  ShoppingBag, 
  X, 
  AlertCircle, 
  Check, 
  Wand2, 
  Loader2, 
  Upload, 
  Plus, 
  Star, 
  Tag,
  Scale
} from 'lucide-react';

interface ProductEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingProduct: Product | null;
  settings: StoreSettings;
  onSaveProduct: (productData: Omit<Product, 'id'> & { id?: string }) => void;
}

const INITIAL_PRODUCT_FORM = {
  name: '',
  category: 'عام',
  price: 100 as string | number,
  salePrice: 0 as string | number,
  unit: 'piece' as ProductUnit,
  unitLabel: '',
  minQuantity: '' as string | number,
  quantityStep: '' as string | number,
  variants: '',
  imageUrl: '',
  galleryImages: [] as string[],
  description: '',
  inStock: true,
  stockQuantity: '' as string | number,
  featured: false,
};

export const ProductEditorModal: React.FC<ProductEditorModalProps> = ({
  isOpen,
  onClose,
  editingProduct,
  settings,
  onSaveProduct,
}) => {
  const [productFormError, setProductFormError] = useState<string | null>(null);
  const [uploadingProductImg, setUploadingProductImg] = useState(false);
  const [generatingProductAI, setGeneratingProductAI] = useState(false);
  const [extraGalleryUrl, setExtraGalleryUrl] = useState('');

  const [productForm, setProductForm] = useState({ ...INITIAL_PRODUCT_FORM });

  useEffect(() => {
    if (!isOpen) return;
    setProductFormError(null);
    setExtraGalleryUrl('');

    if (editingProduct && editingProduct.id) {
      // Deep-clone editingProduct so form mutations never alter the original product reference in memory
      const cloned: Product = JSON.parse(JSON.stringify(editingProduct));
      const rawPrimary = isLegacyWatchPlaceholder(cloned.imageUrl) ? '' : (cloned.imageUrl || '');
      const clonedGallery =
        Array.isArray(cloned.galleryImages) && cloned.galleryImages.length > 0
          ? cloned.galleryImages.filter((img) => img && !isLegacyWatchPlaceholder(img))
          : rawPrimary
          ? [rawPrimary]
          : [];

      setProductForm({
        name: cloned.name || '',
        category: cloned.category || 'عام',
        price: cloned.price ?? 100,
        salePrice: cloned.salePrice || 0,
        unit: cloned.unit || 'piece',
        unitLabel: cloned.unitLabel || '',
        minQuantity: cloned.minQuantity !== undefined ? cloned.minQuantity : '',
        quantityStep: cloned.quantityStep !== undefined ? cloned.quantityStep : '',
        variants: (cloned.variants || []).filter((v) => v && v !== 'الخيار الافتراضي').join(', '),
        imageUrl: rawPrimary,
        galleryImages: clonedGallery,
        description: cloned.description || '',
        inStock: cloned.inStock !== false,
        stockQuantity: cloned.stockQuantity !== undefined ? cloned.stockQuantity : '',
        featured: Boolean(cloned.featured),
      });
    } else {
      setProductForm({
        ...INITIAL_PRODUCT_FORM,
        galleryImages: [],
      });
    }
  }, [isOpen, editingProduct]);

  if (!isOpen) return null;

  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, isGallery = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProductImg(true);
    setProductFormError(null);
    try {
      // Upload to local server (/public/uploads/<hash>.webp) and return lightweight URL path
      const uploadedImageUrl = await uploadImageToServer(file, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.85,
        prefix: 'prod',
      });
      if (isGallery) {
        setProductForm((prev) => ({
          ...prev,
          galleryImages: [...prev.galleryImages, uploadedImageUrl],
          imageUrl: prev.imageUrl || uploadedImageUrl,
        }));
      } else {
        setProductForm((prev) => ({
          ...prev,
          imageUrl: uploadedImageUrl,
          galleryImages: prev.galleryImages.includes(uploadedImageUrl)
            ? [...prev.galleryImages]
            : [uploadedImageUrl, ...prev.galleryImages],
        }));
      }
    } catch (err: unknown) {
      setProductFormError(err instanceof Error ? err.message : 'تعذر رفع وضغط الصورة');
    } finally {
      setUploadingProductImg(false);
      // Reset file input so consecutive uploads of the same or another file always fire onChange
      e.target.value = '';
    }
  };

  const handleGenerateAIProductCopy = async () => {
    if (!productForm.name.trim()) {
      setProductFormError('يرجى كتابة اسم المنتج أولاً ليتمكن الذكاء الاصطناعي من صياغة الوصف.');
      return;
    }
    setGeneratingProductAI(true);
    setProductFormError(null);
    try {
      const prompt = `المنتج: ${productForm.name.trim()}\nالفئة: ${
        productForm.category.trim() || 'عام'
      }\nالمتجر: ${settings.storeName}`;
      const res = await requestAIGeneration(prompt, 'product_description');
      if (res.success && res.text) {
        setProductForm((prev) => ({ ...prev, description: res.text || '' }));
      } else {
        setProductFormError(res.error || 'تعذر توليد وصف المنتج بالذكاء الاصطناعي.');
      }
    } catch {
      setProductFormError('حدث خطأ غير متوقع أثناء توليد الوصف.');
    } finally {
      setGeneratingProductAI(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim()) return;

    const basePrice = Number(normalizeArabicDigits(String(productForm.price))) || 0;
    const normSale = productForm.salePrice ? Number(normalizeArabicDigits(String(productForm.salePrice))) : 0;
    const discountPrice = normSale > 0 ? normSale : undefined;

    if (discountPrice !== undefined && discountPrice >= basePrice) {
      setProductFormError('سعر الخصم يجب أن يكون أقل من السعر الأساسي للمنتج.');
      return;
    }

    const variantsArray = productForm.variants
      .split(/[,،]/)
      .map((v) => v.trim())
      .filter((v) => Boolean(v) && v !== 'الخيار الافتراضي');

    const normalizedGallery = productForm.galleryImages
      .map((img) => normalizeProductImageUrl(img))
      .filter(Boolean);
    const primaryImg = normalizeProductImageUrl(productForm.imageUrl.trim()) || normalizedGallery[0] || '';
    const finalGallery =
      normalizedGallery.length > 0
        ? Array.from(new Set([primaryImg, ...normalizedGallery].filter(Boolean)))
        : primaryImg
        ? [primaryImg]
        : [];

    const normStock = productForm.stockQuantity !== '' ? normalizeArabicDigits(String(productForm.stockQuantity)) : '';
    const parsedStockQty =
      normStock !== '' && !isNaN(Number(normStock))
        ? Math.max(0, Math.round(Number(normStock) * 1000) / 1000)
        : undefined;

    const finalInStock = parsedStockQty !== undefined ? parsedStockQty > 0 && productForm.inStock : productForm.inStock;

    const normMin = productForm.minQuantity !== '' ? Number(normalizeArabicDigits(String(productForm.minQuantity))) : undefined;
    const normStep = productForm.quantityStep !== '' ? Number(normalizeArabicDigits(String(productForm.quantityStep))) : undefined;

    // Pass id ONLY when editing an existing product; undefined when adding a new product
    onSaveProduct({
      id: editingProduct?.id ? String(editingProduct.id) : undefined,
      name: productForm.name.trim(),
      category: productForm.category.trim() || 'عام',
      price: basePrice,
      salePrice: discountPrice,
      unit: productForm.unit,
      unitLabel: productForm.unitLabel?.trim() || undefined,
      minQuantity: normMin && normMin > 0 ? normMin : undefined,
      quantityStep: normStep && normStep > 0 ? normStep : undefined,
      variants: [...variantsArray],
      imageUrl: primaryImg,
      galleryImages: [...finalGallery],
      description: productForm.description.trim(),
      inStock: finalInStock,
      stockQuantity: parsedStockQty,
      featured: productForm.featured,
    });

    // Reset form state after saving so subsequent opens start clean
    setProductForm({ ...INITIAL_PRODUCT_FORM, galleryImages: [] });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-stone-950/70 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden z-10 border border-stone-200 my-auto p-6 sm:p-8 space-y-5 max-h-[92vh] overflow-y-auto animate-in zoom-in-95">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#0F172A] text-white flex items-center justify-center font-bold text-lg shadow-sm">
              <ShoppingBag className="w-5 h-5 text-[#86EFAC]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-stone-900">
                {editingProduct ? 'تعديل بيانات المنتج' : 'إضافة منتج جديد للمتجر'}
              </h3>
              <p className="text-xs text-stone-500">
                ارفع صور المنتج من جهازك أو أضف الرابط، وسينعكس التحديث فوراً ويُحفظ محلياً على السيرفر
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 text-stone-600 hover:text-stone-900 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {productFormError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{productFormError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-stone-800 mb-1">
                اسم المنتج <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                placeholder="مثال: عطر عود ملكي 100 مل"
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
              />
            </div>

            <div>
              <label className="block font-bold text-stone-800 mb-1">القسم / الفئة</label>
              <div className="relative">
                <input
                  type="text"
                  value={productForm.category}
                  onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                  placeholder="مثال: عطور، ساعات، إكسسوارات..."
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                />
                <Tag className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-stone-800 mb-1">
                السعر الأساسي ({settings.currency}) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                inputMode="decimal"
                dir="ltr"
                required
                value={productForm.price}
                onChange={(e) => {
                  const norm = normalizeArabicDigits(e.target.value);
                  setProductForm({ ...productForm, price: norm });
                }}
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
              />
            </div>

            <div>
              <label className="block font-bold text-stone-800 mb-1">
                سعر الخصم ({settings.currency})
              </label>
              <input
                type="text"
                inputMode="decimal"
                dir="ltr"
                value={productForm.salePrice}
                onChange={(e) => {
                  const norm = normalizeArabicDigits(e.target.value);
                  setProductForm({ ...productForm, salePrice: norm });
                }}
                placeholder="0 بدون خصم"
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
              />
            </div>

            <div>
              <label className="block font-bold text-stone-800 mb-1">
                الكمية المتوفرة (اختياري)
              </label>
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                value={productForm.stockQuantity}
                onChange={(e) => {
                  const norm = normalizeArabicDigits(e.target.value);
                  setProductForm({
                    ...productForm,
                    stockQuantity: norm,
                  });
                }}
                placeholder="غير محدود"
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
              />
            </div>
          </div>

          {/* Unit of Measurement & Increments */}
          <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-stone-800">
                <Scale className="w-4 h-4 text-[#2563EB]" />
                <span>وحدة القياس وخيارات الشراء</span>
              </div>
              <span className="text-[11px] text-stone-500 font-medium">
                تسمح للمتسوق بطلب كميات مخصصة (مثل 0.5 كجم أو 1.5 متر)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-stone-700 mb-1">وحدة البيع</label>
                <select
                  value={productForm.unit}
                  onChange={(e) => {
                    const newUnit = e.target.value as ProductUnit;
                    const meta = getProductUnitMeta(newUnit);
                    setProductForm((prev) => ({
                      ...prev,
                      unit: newUnit,
                      minQuantity: meta ? meta.defaultMin : (newUnit === 'piece' ? 1 : 0.5),
                      quantityStep: meta ? meta.defaultStep : (newUnit === 'piece' ? 1 : 0.5),
                    }));
                  }}
                  className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 cursor-pointer"
                >
                  {STANDARD_UNITS.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label} ({u.id})
                    </option>
                  ))}
                  <option value="custom">وحدة مخصصة...</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">أقل كمية للطلب</label>
                <input
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  value={productForm.minQuantity}
                  onChange={(e) => {
                    const norm = normalizeArabicDigits(e.target.value);
                    setProductForm({ ...productForm, minQuantity: norm });
                  }}
                  placeholder={productForm.unit === 'piece' ? '1' : '0.5'}
                  className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-stone-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">خطوة الزيادة (Step)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  value={productForm.quantityStep}
                  onChange={(e) => {
                    const norm = normalizeArabicDigits(e.target.value);
                    setProductForm({ ...productForm, quantityStep: norm });
                  }}
                  placeholder={productForm.unit === 'piece' ? '1' : '0.5'}
                  className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-stone-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                />
              </div>
            </div>

            {productForm.unit === 'custom' && (
              <div>
                <label className="block font-bold text-stone-700 mb-1">تسمية الوحدة المخصصة</label>
                <input
                  type="text"
                  value={productForm.unitLabel}
                  onChange={(e) => setProductForm({ ...productForm, unitLabel: e.target.value })}
                  placeholder="مثال: لفة، عبوة، حزمة..."
                  className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                />
              </div>
            )}

            {/* Price display preview */}
            <div className="flex items-center gap-2 text-[11px] text-stone-600 bg-white p-2.5 rounded-xl border border-stone-200/80">
              <span className="font-bold text-stone-700">معاينة العرض:</span>
              <span className="font-mono font-bold text-[#2563EB]">
                {productForm.salePrice && Number(productForm.salePrice) > 0 ? productForm.salePrice : (productForm.price || 0)} {settings.currency}
              </span>
              <span>/ {getProductUnitLabel(productForm.unit, productForm.unitLabel) || 'حبة'}</span>
              <span className="text-stone-400">|</span>
              <span className="text-stone-500">
                (أقل طلب: {productForm.minQuantity || (productForm.unit === 'piece' ? '1' : '0.5')}، الزيادة: {productForm.quantityStep || (productForm.unit === 'piece' ? '1' : '0.5')})
              </span>
            </div>
          </div>

          <div>
            <label className="block font-bold text-stone-800 mb-1">
              المقاسات أو الخيارات المتاحة (مفصولة بفاصلة)
            </label>
            <input
              type="text"
              value={productForm.variants}
              onChange={(e) => setProductForm({ ...productForm, variants: e.target.value })}
              placeholder="مثال: صغير، وسط، كبير (أو: أسود، أبيض)"
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
            />
          </div>

          {/* Device Image Uploader + URL + Multi-Image Gallery */}
          <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-2xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="font-bold text-stone-800">صور المنتج (رفع من الجهاز أو الكاميرا)</label>
              <div className="flex items-center gap-2">
                <label className="px-3 py-1.5 bg-[#2563EB] hover:bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingProductImg ? 'جاري الرفع والحفظ...' : 'رفع صورة من جهازك'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleProductImageUpload(e, false)}
                    className="hidden"
                  />
                </label>
                <label className="px-3 py-1.5 bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer">
                  <Plus className="w-3.5 h-3.5" />
                  <span>صورة إضافية</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleProductImageUpload(e, true)}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <input
              type="text"
              value={productForm.imageUrl}
              onChange={(e) => setProductForm({ ...productForm, imageUrl: e.target.value })}
              placeholder="أو الصق رابط صورة مباشر https://..."
              className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-stone-900 font-mono text-xs"
              dir="ltr"
            />

            {/* Gallery Thumbnails */}
            {productForm.galleryImages.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap pt-1">
                {productForm.galleryImages.map((img, i) => (
                  <div key={i} className="relative w-14 h-14 rounded-xl overflow-hidden border border-stone-300 bg-white group">
                    <img src={img} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        const nextGallery = productForm.galleryImages.filter((_, idx) => idx !== i);
                        setProductForm({
                          ...productForm,
                          galleryImages: nextGallery,
                          imageUrl: productForm.imageUrl === img ? nextGallery[0] || '' : productForm.imageUrl,
                        });
                      }}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center text-[10px] cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Extra Gallery Image via URL */}
            <div className="flex gap-2">
              <input
                type="text"
                value={extraGalleryUrl}
                onChange={(e) => setExtraGalleryUrl(e.target.value)}
                placeholder="إضافة رابط صورة إضافية لمعرض المنتج..."
                className="flex-1 px-3 py-1.5 bg-white border border-stone-200 rounded-xl font-mono text-[11px]"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => {
                  const normExtra = normalizeProductImageUrl(extraGalleryUrl.trim());
                  if (!normExtra) return;
                  setProductForm((prev) => ({
                    ...prev,
                    galleryImages: [...prev.galleryImages, normExtra],
                    imageUrl: prev.imageUrl || normExtra,
                  }));
                  setExtraGalleryUrl('');
                }}
                className="px-3 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl font-bold text-[11px] cursor-pointer"
              >
                إضافة للمعرض
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-stone-800">وصف المنتج ومميزاته</label>
              <button
                type="button"
                onClick={handleGenerateAIProductCopy}
                disabled={generatingProductAI}
                className="text-[11px] font-bold text-[#2563EB] hover:bg-blue-50 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              >
                {generatingProductAI ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Wand2 className="w-3.5 h-3.5" />
                )}
                <span>كتابة الوصف بالذكاء الاصطناعي ✨</span>
              </button>
            </div>
            <textarea
              rows={3}
              value={productForm.description}
              onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
              placeholder="اكتب وصفاً واضحاً للمنتج، الخامات، أو المميزات..."
              className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={productForm.inStock}
                onChange={(e) => setProductForm({ ...productForm, inStock: e.target.checked })}
                className="rounded text-[#2563EB]"
              />
              <span className="font-bold text-stone-800">المنتج متوفر في المخزون وجاهز للطلب</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={productForm.featured}
                onChange={(e) => setProductForm({ ...productForm, featured: e.target.checked })}
                className="rounded text-amber-500"
              />
              <span className="font-bold text-stone-800 flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-current" />
                <span>تمييز المنتج (الأكثر طلباً)</span>
              </span>
            </label>
          </div>

          <div className="pt-4 border-t border-stone-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-bold cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-[#2563EB] hover:bg-blue-600 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{editingProduct ? 'حفظ التعديلات' : 'إضافة المنتج للمتجر'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
