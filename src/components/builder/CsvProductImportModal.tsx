import React, { useState, useRef } from 'react';
import {
  X,
  FileSpreadsheet,
  UploadCloud,
  Download,
  AlertCircle,
  CheckCircle2,
  FileText,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { Product } from '../../types/store';
import {
  parseProductsCsv,
  generateSampleProductCsv,
  CsvProductImportResult,
} from '../../utils/csvProductParser';
import { ProductImage } from '../common/ProductImage';

interface CsvProductImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (newProducts: Product[], mode: 'append' | 'replace') => void;
  existingCount: number;
}

export const CsvProductImportModal: React.FC<CsvProductImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  existingCount,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<CsvProductImportResult | null>(null);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [isDragging, setIsDragging] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleProcessText = (text: string, sourceName?: string) => {
    if (sourceName) setFileName(sourceName);
    const res = parseProductsCsv(text);
    setParseResult(res);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawText(content);
        handleProcessText(content, file.name);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          setRawText(content);
          handleProcessText(content, file.name);
        }
      };
      reader.readAsText(file);
    }
  };

  const handlePasteChange = (val: string) => {
    setRawText(val);
    if (val.trim()) {
      handleProcessText(val, 'بيانات منسوخة');
    } else {
      setParseResult(null);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = generateSampleProductCsv();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `products-template-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleConfirmImport = () => {
    if (!parseResult || parseResult.validProducts.length === 0) return;
    onImport(parseResult.validProducts, importMode);
    onClose();
  };

  const handleReset = () => {
    setRawText('');
    setFileName(null);
    setParseResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-stone-950/75 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden z-10 border border-stone-200 my-auto flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-stone-900">
                استيراد المنتجات من Google Sheets / Excel (CSV)
              </h3>
              <p className="text-xs text-stone-500">
                ارفع ملف جدول بياناتك أو الصق الخلايا مباشرة لتجهيز متجرك في ثوانٍ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 text-xs flex items-center gap-1 cursor-pointer transition-colors"
              title="تعليمات الأعمدة المدعومة"
            >
              <HelpCircle className="w-4 h-4" />
              <span className="hidden sm:inline">دليل الأعمدة</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-stone-200 hover:bg-stone-300 text-stone-600 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Column Help Drawer */}
        {showHelp && (
          <div className="bg-blue-50 border-b border-blue-200 p-4 text-xs text-blue-900 space-y-2 animate-in fade-in">
            <div className="font-bold flex items-center gap-1.5 text-blue-950">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>الأعمدة المدعومة في ملف CSV (عربي أو إنجليزي):</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] leading-relaxed">
              <div>
                <strong>الاسم / Name (إلزامي):</strong> اسم المنتج<br />
                <strong>السعر / Price (إلزامي):</strong> رقم موجب (مثال: 120)<br />
                <strong>سعر الخصم / Sale Price:</strong> اختياري للتخفيضات (مثال: 95)<br />
                <strong>القسم / Category:</strong> تصنيف المنتج (افتراضي: عام)
              </div>
              <div>
                <strong>المخزون / Stock:</strong> الكمية المتاحة (مثال: 50)<br />
                <strong>الخيارات / Variants:</strong> المقاسات/الألوان مفصولة بفاصلة (S, M, L)<br />
                <strong>رابط الصورة / Image URL:</strong> رابط مباشر لصورة المنتج<br />
                <strong>رمز المنتج / SKU / ID:</strong> معرف فريد (يتم توليده تلقائياً إن تُرِك فارغاً)
              </div>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Top Actions: Template Download & Tabs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-stone-50 p-3 rounded-2xl border border-stone-200">
            <div className="flex rounded-xl bg-stone-200/80 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'upload'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>رفع ملف CSV</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('paste')}
                className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'paste'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>لصق مباشر من Google Sheets</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3.5 py-2 rounded-xl bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs shrink-0"
              title="تحميل ملف CSV تجريبي جاهز مع كافة الأعمدة"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>تحميل نموذج CSV جاهز</span>
            </button>
          </div>

          {/* Input Method: Upload or Paste */}
          {!parseResult ? (
            activeTab === 'upload' ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50/50'
                    : 'border-stone-300 hover:border-stone-400 bg-stone-50/50 hover:bg-stone-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.tsv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="w-14 h-14 rounded-2xl bg-white border border-stone-200 shadow-xs flex items-center justify-center mx-auto text-blue-600 mb-3">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <h4 className="font-bold text-stone-800 text-sm mb-1">
                  اسحب ملف الـ CSV هنا أو اضغط للاختيار من جهازك
                </h4>
                <p className="text-xs text-stone-500 max-w-sm mx-auto mb-3">
                  يقبل الملفات المصدرة من Google Sheets (ملف &gt; تنزيل &gt; CSV) أو برامج Excel
                </p>
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-stone-200/60 text-stone-600 text-[11px] font-semibold">
                  يدعم UTF-8 مع الترميز العربي تلقائياً
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-stone-700">
                    انسخ الخلايا من Google Sheets والصقها هنا مباشرة (Ctrl+V):
                  </span>
                  <span className="text-stone-400 text-[11px]">يتعرف على الفواصل والجداول تلقائياً</span>
                </div>
                <textarea
                  rows={8}
                  value={rawText}
                  onChange={(e) => handlePasteChange(e.target.value)}
                  placeholder={`name,price,sale_price,category,stock,unit,min_quantity,quantity_step,variants\nعسل سدر جبلي,180,160,أغذية,30,kg,0.5,0.5,\nقماش كتان فاخر,45,,أقمشة,120,meter,1,0.5,"بيج, كحلي"\nساعة يد كلاسيكية,380,,إكسسوارات,15,piece,1,1,جلد بني`}
                  className="w-full p-3.5 text-xs font-mono bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white resize-y"
                  dir="auto"
                />
              </div>
            )
          ) : (
            /* Parsed Results & Preview */
            <div className="space-y-4">
              {/* Status Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-2xl bg-stone-50 border border-stone-200">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-stone-800">
                    {fileName ? `الملف: ${fileName}` : 'البيانات المُدخلة'}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black">
                    {parseResult.validProducts.length} منتج جاهز للاستيراد
                  </span>
                  {parseResult.errors.length > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-black">
                      {parseResult.errors.length} تنبيهات
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-stone-500 hover:text-stone-900 underline font-semibold cursor-pointer"
                >
                  اختيار ملف آخر
                </button>
              </div>

              {/* Errors Callout if any */}
              {parseResult.errors.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 space-y-1.5 text-xs text-amber-900 max-h-36 overflow-y-auto">
                  <div className="font-bold flex items-center gap-1.5 text-amber-950">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>تم تجاوز بعض الصفوف بسبب أخطاء في البيانات:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-800">
                    {parseResult.errors.map((err, idx) => (
                      <li key={idx}>
                        <strong>الصف {err.row}:</strong> {err.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preview Table */}
              {parseResult.validProducts.length > 0 && (
                <div className="border border-stone-200 rounded-2xl overflow-hidden">
                  <div className="bg-stone-100 px-4 py-2 border-b border-stone-200 text-xs font-bold text-stone-700 flex justify-between items-center">
                    <span>معاينة المنتجات المستخرجة (أول {Math.min(parseResult.validProducts.length, 10)} منتجات):</span>
                    <span className="text-[11px] text-stone-500">إجمالي {parseResult.validProducts.length} منتج</span>
                  </div>
                  <div className="max-h-60 overflow-y-auto overflow-x-auto">
                    <table className="w-full text-xs text-right divide-y divide-stone-200">
                      <thead className="bg-stone-50 text-stone-500 sticky top-0 text-[11px]">
                        <tr>
                          <th className="px-3 py-2">#</th>
                          <th className="px-3 py-2">الصورة</th>
                          <th className="px-3 py-2">اسم المنتج</th>
                          <th className="px-3 py-2">القسم</th>
                          <th className="px-3 py-2">السعر</th>
                          <th className="px-3 py-2">سعر الخصم</th>
                          <th className="px-3 py-2">المخزون</th>
                          <th className="px-3 py-2">الخيارات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 bg-white">
                        {parseResult.validProducts.slice(0, 10).map((p, idx) => (
                          <tr key={idx} className="hover:bg-stone-50/60">
                            <td className="px-3 py-2 text-stone-400 font-mono text-[10px]">{idx + 1}</td>
                            <td className="px-3 py-1.5">
                              <div className="w-10 h-10 rounded-lg overflow-hidden bg-stone-100 border border-stone-200 relative">
                                <ProductImage
                                  src={p.imageUrl}
                                  alt={p.name}
                                  category={p.category}
                                  size="xs"
                                  width={80}
                                  height={80}
                                  className="w-full h-full"
                                  imgClassName="w-full h-full object-cover"
                                />
                              </div>
                            </td>
                            <td className="px-3 py-2 font-bold text-stone-900 truncate max-w-[160px]">
                              {p.name}
                            </td>
                            <td className="px-3 py-2 text-stone-600">
                              <span className="px-2 py-0.5 rounded-md bg-stone-100 text-[10px]">
                                {p.category}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-mono font-bold text-stone-900">
                              {p.price}
                            </td>
                            <td className="px-3 py-2 font-mono text-emerald-700">
                              {p.salePrice ? `${p.salePrice}` : '-'}
                            </td>
                            <td className="px-3 py-2 font-mono text-stone-600">
                              {p.stockQuantity !== undefined ? p.stockQuantity : '∞'}
                            </td>
                            <td className="px-3 py-2 text-stone-500 text-[11px] truncate max-w-[120px]">
                              {p.variants && p.variants.length > 0 ? p.variants.join('، ') : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Import Mode Selection */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                <span className="text-xs font-bold text-stone-800 block">
                  طريقة إضافة المنتجات إلى متجرك (الكتالوج الحالي به {existingCount} منتج):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      importMode === 'append'
                        ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20'
                        : 'border-stone-200 bg-white hover:bg-stone-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      value="append"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                      className="mt-0.5 accent-blue-600"
                    />
                    <div>
                      <div className="font-bold text-xs text-stone-900 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-blue-600" />
                        <span>دمج وإضافة (Append)</span>
                      </div>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        الاحتفاظ بالمنتجات الحالية ({existingCount}) وإضافة المنتجات الجديدة ({parseResult.validProducts.length}) إليها
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      importMode === 'replace'
                        ? 'border-rose-600 bg-rose-50/50 ring-2 ring-rose-500/20'
                        : 'border-stone-200 bg-white hover:bg-stone-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="mt-0.5 accent-rose-600"
                    />
                    <div>
                      <div className="font-bold text-xs text-stone-900 flex items-center gap-1.5">
                        <ArrowRight className="w-3.5 h-3.5 text-rose-600" />
                        <span>استبدال الكتالوج بالكامل (Replace)</span>
                      </div>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        حذف الكتالوج الحالي واستبداله بمنتجات هذا الملف ({parseResult.validProducts.length}) فقط
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-stone-200 bg-stone-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-bold transition-colors cursor-pointer"
          >
            إلغاء
          </button>

          {parseResult && parseResult.validProducts.length > 0 ? (
            <button
              type="button"
              onClick={handleConfirmImport}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all active:scale-98 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                تأكيد واستيراد {parseResult.validProducts.length} منتج
                {importMode === 'append' ? ` (الإجمالي سيصبح ${existingCount + parseResult.validProducts.length})` : ''}
              </span>
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="px-6 py-2.5 rounded-xl bg-stone-300 text-stone-500 text-xs font-bold cursor-not-allowed opacity-60"
            >
              يرجى رفع ملف أو لصق البيانات أولاً
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
