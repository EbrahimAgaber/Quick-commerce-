import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Wrench, Home } from 'lucide-react';
import { StoreStorage } from '../../services/storeStorage';
import { StoreManager } from '../../services/storeManager';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleRepairAndReset = () => {
    try {
      // Clear potentially corrupt store keys
      StoreManager.resetCorruptedStorage();
      StoreStorage.resetToDefault();
    } catch (e) {
      console.warn('Error during reset:', e);
      try {
        localStorage.clear();
      } catch {}
    }
    // Navigate to clean root without query params
    window.location.href = window.location.origin + window.location.pathname;
  };

  private handleGoHome = () => {
    window.location.href = window.location.origin + window.location.pathname;
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans" dir="rtl">
          <div className="max-w-lg w-full bg-white rounded-3xl border border-stone-200 p-6 sm:p-8 shadow-xl space-y-6 text-center animate-in fade-in">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-black text-stone-900">
                حدث خطأ أثناء تشغيل التطبيق
              </h2>
              <p className="text-xs sm:text-sm text-stone-500 leading-relaxed">
                واجه التطبيق مشكلة غير متوقعة في عرض الصفحة أو قراءة البيانات المحفوظة. يمكنك إصلاح البيانات وإعادة التشغيل بنقرة واحدة.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-stone-100 rounded-xl text-left font-mono text-[11px] text-stone-700 max-h-32 overflow-y-auto border border-stone-200">
                <p className="font-bold text-rose-600">{this.state.error.name}: {this.state.error.message}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 justify-center pt-2">
              <button
                onClick={this.handleRepairAndReset}
                className="px-5 py-3 bg-[#0F172A] hover:bg-stone-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Wrench className="w-4 h-4 text-[#86EFAC]" />
                <span>إصلاح البيانات واستعادة المتجر الافتراضي</span>
              </button>

              <button
                onClick={this.handleReload}
                className="px-4 py-3 bg-white hover:bg-stone-50 text-stone-700 border border-stone-300 rounded-xl text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>إعادة تحميل الصفحة</span>
              </button>

              <button
                onClick={this.handleGoHome}
                className="px-4 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>الرئيسية</span>
              </button>
            </div>

            <p className="text-[11px] text-stone-400">
              Quick E-Commerce Platform · نظام الحماية واستعادة البيانات التلقائي
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
