import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileJson,
  CheckCircle2,
  AlertCircle,
  Package,
  ShoppingBag,
  Layers,
  ShieldCheck,
  RefreshCw,
  HardDrive,
} from 'lucide-react';
import { StoreInstance } from '../../types/store';
import { StoreManager } from '../../services/storeManager';

interface StoreBackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStoreId?: string;
  onRestoreComplete: (restoredStore: StoreInstance) => void;
}

interface ParsedBackupPreview {
  rawPayload: any;
  storeName: string;
  storeSlug: string;
  productCount: number;
  categoriesCount: number;
  ordersCount: number;
  exportedAt?: string;
  fileName: string;
}

export const StoreBackupRestoreModal: React.FC<StoreBackupRestoreModalProps> = ({
  isOpen,
  onClose,
  currentStoreId,
  onRestoreComplete,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<ParsedBackupPreview | null>(null);
  const [restoreMode, setRestoreMode] = useState<'replace' | 'merge'>('replace');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const parseBackupFile = (file: File) => {
    setErrorMsg(null);
    if (!file.name.toLowerCase().endsWith('.json')) {
      setErrorMsg('يرجى اختيار ملف نسخة احتياطية بصيغة JSON فقط (.json).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = String(event.target?.result || '');
        const parsed = JSON.parse(text);

        const candidate =
          parsed?.store && typeof parsed.store === 'object'
            ? parsed.store
            : Array.isArray(parsed?.stores) && parsed.stores.length > 0
            ? parsed.stores[0]
            : parsed?.settings || Array.isArray(parsed?.products)
            ? parsed
            : null;

        if (!candidate) {
          setErrorMsg('ملف JSON لا يحتوي على هيكل بيانات متجر صالح (منتجات أو إعدادات).');
          setPreview(null);
          return;
        }

        const products = Array.isArray(candidate.products) ? candidate.products : [];
        const categories = new Set(
          products.map((p: any) => p?.category).filter(Boolean)
        );
        const orders = Array.isArray(candidate.orders) ? candidate.orders : [];

        setPreview({
          rawPayload: parsed,
          storeName: candidate.settings?.storeName || candidate.storeName || 'متجر إلكتروني',
          storeSlug: candidate.slug || candidate.settings?.storeSlug || 'store',
          productCount: products.length,
          categoriesCount: categories.size,
          ordersCount: orders.length,
          exportedAt: parsed.exportedAt || candidate.updatedAt || candidate.createdAt,
          fileName: file.name,
        });
      } catch {
        setErrorMsg('تعذر قراءة ملف JSON. تأكد من أن الملف سليم وغير تالف.');
        setPreview(null);
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseBackupFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      parseBackupFile(file);
    }
  };

  const handleConfirmRestore = async () => {
    if (!preview) return;
    setIsRestoring(true);
    setErrorMsg(null);
    try {
      const result = await StoreManager.restoreStoreFromBackup(
        preview.rawPayload,
        restoreMode,
        currentStoreId
      );
      if (result.success && result.store) {
        onRestoreComplete(result.store);
        setPreview(null);
        onClose();
      } else {
        setErrorMsg(result.error || 'حدث خطأ أثناء استعادة النسخة الاحتياطية.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'حدث خطأ غير متوقع أثناء استعادة النسخة الاحتياطية.');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      dir="rtl"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base">استعادة نسخة احتياطية للمتجر (JSON)</h3>
              <p className="text-xs text-slate-300 mt-0.5">
                استعد كافة المنتجات، الصور، الأقسام، والإعدادات بضغطة زر
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Upload Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
              isDragging
                ? 'border-blue-600 bg-blue-50/70'
                : preview
                ? 'border-emerald-400 bg-emerald-50/30'
                : 'border-slate-300 hover:border-blue-500 bg-slate-50/70 hover:bg-slate-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mx-auto mb-3 text-blue-600">
              {preview ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              ) : (
                <Upload className="w-6 h-6" />
              )}
            </div>
            <p className="text-sm font-black text-slate-800">
              {preview
                ? `تم تحميل الملف: ${preview.fileName}`
                : 'اسحب وأفلت ملف النسخة الاحتياطية (.json) هنا أو اضغط للاختيار'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              يدعم ملفات النسخ الاحتياطي المصدرة من لوحة تحكم المتجر
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Backup Preview Card */}
          {preview && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <FileJson className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-black text-slate-900">
                      معاينة محتوى النسخة الاحتياطية
                    </span>
                  </div>
                  {preview.exportedAt && (
                    <span className="text-[11px] font-bold text-slate-500">
                      تاريخ التصدير:{' '}
                      {new Date(preview.exportedAt).toLocaleDateString('ar-SA')}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2.5 pt-1">
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200/80 text-center">
                    <div className="flex items-center justify-center gap-1 text-blue-600 mb-0.5">
                      <Package className="w-3.5 h-3.5" />
                      <span className="text-sm font-black">{preview.productCount}</span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-500">منتج</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200/80 text-center">
                    <div className="flex items-center justify-center gap-1 text-emerald-600 mb-0.5">
                      <Layers className="w-3.5 h-3.5" />
                      <span className="text-sm font-black">{preview.categoriesCount}</span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-500">قسم</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200/80 text-center">
                    <div className="flex items-center justify-center gap-1 text-amber-600 mb-0.5">
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span className="text-sm font-black">{preview.ordersCount}</span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-500">طلب مسجل</span>
                  </div>
                </div>

                <div className="text-xs text-slate-600 font-bold flex items-center justify-between pt-1">
                  <span>اسم المتجر بالنسخة:</span>
                  <span className="text-slate-900 font-black">{preview.storeName}</span>
                </div>
              </div>

              {/* Restore Mode Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-700">
                  طريقة الاستعادة:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setRestoreMode('replace')}
                    className={`p-3 rounded-xl border text-right transition-all ${
                      restoreMode === 'replace'
                        ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-black text-slate-900">
                      استبدال المتجر بالكامل (موصى به)
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      اعتماد منتجات وإعدادات النسخة الاحتياطية كما هي وحفظها على السيرفر
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRestoreMode('merge')}
                    className={`p-3 rounded-xl border text-right transition-all ${
                      restoreMode === 'merge'
                        ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-black text-slate-900">
                      دمج مع المنتجات الحالية
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      إضافة منتجات النسخة الاحتياطية إلى منتجاتك الحالية دون حذفها
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Security Note */}
          <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex items-center gap-2.5 text-emerald-900 text-xs font-bold">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              يتم حفظ البيانات المستعادة تلقائياً على السيرفر المحلي في ملف{' '}
              <code className="font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-emerald-200">
                /data/stores.json
              </code>{' '}
              مع نسخة احتياطية تلقائية.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors"
          >
            إلغاء
          </button>
          <button
            type="button"
            disabled={!preview || isRestoring}
            onClick={handleConfirmRestore}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black text-xs flex items-center gap-2 shadow-sm transition-all"
          >
            {isRestoring ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                جاري الاستعادة والحفظ...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                تأكيد استعادة النسخة الاحتياطية
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
