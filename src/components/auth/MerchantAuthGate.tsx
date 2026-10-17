import React from 'react';
import { ShieldAlert, LogIn, Store, Lock, KeyRound } from 'lucide-react';
import { StoreSettings } from '../../types/store';

interface MerchantAuthGateProps {
  settings: StoreSettings;
  onOpenAuth: () => void;
  onBackToStore: () => void;
  targetViewName?: string;
}

export const MerchantAuthGate: React.FC<MerchantAuthGateProps> = ({
  settings,
  onOpenAuth,
  onBackToStore,
  targetViewName = 'لوحة التحكم وإدارة المتجر',
}) => {
  const brand = settings.brandTheme || {
    primaryColor: '#0F172A',
    accentColor: '#2563EB',
    backgroundColor: '#F8FAFC',
    textColor: '#0F172A',
  };

  return (
    <div className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-12 flex flex-col items-center justify-center">
      <div className="w-full bg-white rounded-3xl border border-stone-200/90 shadow-xl p-6 sm:p-10 text-center space-y-6 relative overflow-hidden">
        {/* Background Accent glow */}
        <div 
          className="absolute -top-24 -right-24 w-60 h-60 rounded-full blur-3xl opacity-15 pointer-events-none"
          style={{ backgroundColor: brand.accentColor || '#2563EB' }}
        />

        {/* Shield & Lock Badge */}
        <div className="relative mx-auto w-20 h-20 rounded-3xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 shadow-sm">
          <Lock className="w-9 h-9" />
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs shadow-md">
            <KeyRound className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Headings */}
        <div className="space-y-2 max-w-lg mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
            <span>منطقة محمية · خاصة بمالك المتجر فقط</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-stone-900">
            الدخول إلى {targetViewName}
          </h2>

          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
            للحفاظ على خصوصية مبيعاتك وأمان المنتجات وسجل الطلبات، تتطلب لوحة إدارة المتجر تسجيل الدخول بحساب مالك المتجر المعتمد.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 max-w-md mx-auto w-full">
          <button
            onClick={onOpenAuth}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            style={{ backgroundColor: brand.accentColor || '#2563EB' }}
          >
            <LogIn className="w-4 h-4" />
            <span>تسجيل الدخول بحساب التاجر</span>
          </button>

          <button
            onClick={onBackToStore}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Store className="w-4 h-4 text-stone-500" />
            <span>العودة لواجهة المتجر</span>
          </button>
        </div>

        {/* Features Protection List */}
        <div className="pt-6 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-right">
          <div className="p-3 bg-stone-50 rounded-xl text-stone-600 text-xs">
            <span className="font-bold text-stone-800 block mb-0.5">📦 سجل الطلبات</span>
            حماية بيانات العملاء، العناوين، وأرقام الهواتف من العرض العام.
          </div>
          <div className="p-3 bg-stone-50 rounded-xl text-stone-600 text-xs">
            <span className="font-bold text-stone-800 block mb-0.5">🏷️ إدارة المنتجات</span>
            تعديل الأسعار والمخزون متاح لمالك المتجر المعتمد فقط.
          </div>
          <div className="p-3 bg-stone-50 rounded-xl text-stone-600 text-xs">
            <span className="font-bold text-stone-800 block mb-0.5">🎨 الهوية البصرية</span>
            تخصيص ألوان المتجر والشعار وإعدادات الشحن والدفع.
          </div>
        </div>
      </div>
    </div>
  );
};
