import React, { useState } from 'react';
import { ShieldCheck, Lock, X, KeyRound, AlertCircle } from 'lucide-react';
import { StoreSettings } from '../../types/store';
import { MerchantCaptainsDirectory } from './MerchantCaptainsDirectory';

interface PlatformOwnerPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: StoreSettings;
  storeSlug?: string;
}

const OWNER_SESSION_KEY = 'quick_platform_owner_verified_v1';

export const PlatformOwnerPortalModal: React.FC<PlatformOwnerPortalModalProps> = ({
  isOpen,
  onClose,
  settings,
  storeSlug,
}) => {
  const [isVerifiedOwner, setIsVerifiedOwner] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.sessionStorage?.getItem(OWNER_SESSION_KEY) === 'true';
    }
    return false;
  });
  const [passkeyInput, setPasskeyInput] = useState('');
  const [authError, setAuthError] = useState('');

  if (!isOpen) return null;

  const handleVerifyOwner = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    const configuredOwnerKey =
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_PLATFORM_OWNER_KEY) ||
      'OWNER-ADMIN-2026';

    if (passkeyInput.trim() === configuredOwnerKey) {
      setIsVerifiedOwner(true);
      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage?.setItem(OWNER_SESSION_KEY, 'true');
        } catch {}
      }
      setPasskeyInput('');
    } else {
      setAuthError('رمز الدخول الإداري لمالك المنصة غير صحيح. هذه البوابة مخصصة حصرياً لإدارة المنصة.');
    }
  };

  const handleLockPortal = () => {
    setIsVerifiedOwner(false);
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage?.removeItem(OWNER_SESSION_KEY);
      } catch {}
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-stone-950/75 backdrop-blur-xs"
      dir="rtl"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden z-10 border border-stone-200 my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black">بوابة الإدارة المركزية لمالك المنصة (Super-Admin)</h3>
              <p className="text-xs text-stone-300">
                اعتماد وتفعيل الكباتن، تحديد نسبة عمولة المنصة (1% - 2.5%)، ومتابعة عوائد الشبكة السرية
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isVerifiedOwner && (
              <button
                type="button"
                onClick={handleLockPortal}
                className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>قفل البوابة</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1">
          {!isVerifiedOwner ? (
            <form onSubmit={handleVerifyOwner} className="max-w-md mx-auto py-8 space-y-4">
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-amber-950">
                  <KeyRound className="w-4 h-4 text-amber-600" />
                  <span>منطقة محمية خاصة بمالك المنصة فقط</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  تحتوي هذه البوابة على بيانات عمولات المنصة السرية (1% - 2.5%) وصلاحية إصدار أكواد التفعيل الرسمية للكباتن. لا تظهر هذه البيانات لأي تاجر على المنصة.
                </p>
              </div>

              {authError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  مفتاح الدخول السري لمالك المنصة:
                </label>
                <input
                  type="password"
                  required
                  value={passkeyInput}
                  onChange={(e) => setPasskeyInput(e.target.value)}
                  placeholder="أدخل مفتاح المالك السري..."
                  className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm font-mono"
                  dir="ltr"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
              >
                فتح بوابة مالك المنصة
              </button>
            </form>
          ) : (
            <MerchantCaptainsDirectory
              settings={settings}
              storeSlug={storeSlug}
              isPlatformOwner={true}
            />
          )}
        </div>
      </div>
    </div>
  );
};
