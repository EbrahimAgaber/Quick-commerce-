import React, { useState, useEffect } from 'react';
import { StorePolicy } from '../../types/store';
import { 
  X, 
  Ruler, 
  RefreshCw, 
  Truck, 
  Sparkles, 
  BookOpen, 
  ShieldCheck, 
  HelpCircle, 
  FileText, 
  RotateCcw, 
  CreditCard, 
  Lock, 
  Clock, 
  Package, 
  MapPin, 
  PhoneCall, 
  MessageCircle, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';

interface StorePoliciesModalProps {
  isOpen: boolean;
  onClose: () => void;
  policies: StorePolicy[];
  storeName?: string;
}

export const StorePoliciesModal: React.FC<StorePoliciesModalProps> = ({
  isOpen,
  onClose,
  policies,
  storeName,
}) => {
  if (!isOpen) return null;

  const validPolicies = Array.isArray(policies) ? policies.filter((p) => p && p.id && p.title) : [];
  const [activeTab, setActiveTab] = useState(validPolicies[0]?.id || '');

  useEffect(() => {
    if (validPolicies.length > 0 && !validPolicies.some((p) => p.id === activeTab)) {
      setActiveTab(validPolicies[0].id);
    }
  }, [validPolicies, activeTab]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Ruler':
        return Ruler;
      case 'RefreshCw':
      case 'RotateCcw':
        return RotateCcw;
      case 'Truck':
        return Truck;
      case 'Sparkles':
        return Sparkles;
      case 'ShieldCheck':
        return ShieldCheck;
      case 'CreditCard':
        return CreditCard;
      case 'Lock':
        return Lock;
      case 'Clock':
        return Clock;
      case 'Package':
        return Package;
      case 'MapPin':
        return MapPin;
      case 'PhoneCall':
      case 'MessageCircle':
        return MessageCircle;
      case 'AlertCircle':
        return AlertCircle;
      case 'CheckCircle2':
        return CheckCircle2;
      default:
        return FileText;
    }
  };

  const selectedPolicy = validPolicies.find((p) => p.id === activeTab) || validPolicies[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-stone-950/70 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden z-10 border border-stone-200 my-auto flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-base sm:text-lg font-bold text-stone-900">
                سياسات المتجر والضمان
              </h3>
              {storeName && (
                <span className="text-xs text-stone-500 font-medium">
                  {storeName}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-200 text-stone-600 hover:text-stone-900 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {validPolicies.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <BookOpen className="w-10 h-10 text-stone-300 mx-auto" />
            <p className="text-sm font-bold text-stone-700">لم يتم إعداد سياسات لهذا المتجر بعد</p>
            <p className="text-xs text-stone-400">يمكن لمالك المتجر إضافة وتعديل سياسات الاستبدال والضمان والشحن من لوحة التحكم.</p>
          </div>
        ) : (
          <>
            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 p-3 bg-stone-100 border-b border-stone-200 overflow-x-auto scrollbar-none">
              {validPolicies.map((pol) => {
                const Icon = getIcon(pol.icon);
                const isActive = pol.id === activeTab;
                return (
                  <button
                    key={pol.id}
                    onClick={() => setActiveTab(pol.id)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-stone-900 text-white shadow-xs'
                        : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : 'text-stone-400'}`} />
                    <span>{pol.title}</span>
                  </button>
                );
              })}
            </div>

            {/* Content Area */}
            <div className="p-6 overflow-y-auto space-y-4">
              {selectedPolicy && (
                <div className="space-y-4">
                  <h4 className="text-lg font-bold text-stone-900 pb-2 border-b border-stone-100 flex items-center gap-2">
                    <span>{selectedPolicy.title}</span>
                  </h4>

                  <div className="text-xs sm:text-sm text-stone-700 leading-relaxed whitespace-pre-line bg-stone-50 p-4 rounded-2xl border border-stone-200">
                    {selectedPolicy.content}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
