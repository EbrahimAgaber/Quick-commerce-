import React, { useState } from 'react';
import { StorePolicy } from '../../types/store';
import { X, Ruler, RefreshCw, Truck, Sparkles, BookOpen } from 'lucide-react';

interface StorePoliciesModalProps {
  isOpen: boolean;
  onClose: () => void;
  policies: StorePolicy[];
}

export const StorePoliciesModal: React.FC<StorePoliciesModalProps> = ({
  isOpen,
  onClose,
  policies,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState(policies[0]?.id || 'policy-01');

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Ruler':
        return Ruler;
      case 'RefreshCw':
        return RefreshCw;
      case 'Truck':
        return Truck;
      case 'Sparkles':
        return Sparkles;
      default:
        return BookOpen;
    }
  };

  const selectedPolicy = policies.find((p) => p.id === activeTab) || policies[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-stone-950/70 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden z-10 border border-stone-200 my-auto flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-600" />
            <h3 className="text-base sm:text-lg font-bold text-stone-900">
              سياسات المتجر والضمان وخدمات التوصيل
            </h3>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-200 text-stone-600 hover:text-stone-900 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 p-3 bg-stone-100 border-b border-stone-200 overflow-x-auto scrollbar-none">
          {policies.map((pol) => {
            const Icon = getIcon(pol.icon);
            const isActive = pol.id === activeTab;
            return (
              <button
                key={pol.id}
                onClick={() => setActiveTab(pol.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  isActive
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-stone-400'}`} />
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

              {/* Sizing Table Special Render if Ruler */}
              {selectedPolicy.icon === 'Ruler' && (
                <div className="overflow-x-auto rounded-xl border border-stone-200 my-4">
                  <table className="w-full text-xs text-right">
                    <thead className="bg-stone-900 text-white font-bold">
                      <tr>
                        <th className="p-2.5">المقاس (إنش)</th>
                        <th className="p-2.5">طول القامة الموصى به</th>
                        <th className="p-2.5">عرض الصدر التقريبي</th>
                        <th className="p-2.5">طول الكم</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200 bg-white">
                      <tr className="hover:bg-stone-50">
                        <td className="p-2.5 font-bold font-mono text-amber-700">52</td>
                        <td className="p-2.5 text-stone-700">150 - 155 سم</td>
                        <td className="p-2.5 text-stone-600">21 إنش</td>
                        <td className="p-2.5 text-stone-600">26 إنش</td>
                      </tr>
                      <tr className="hover:bg-stone-50">
                        <td className="p-2.5 font-bold font-mono text-amber-700">54</td>
                        <td className="p-2.5 text-stone-700">156 - 160 سم</td>
                        <td className="p-2.5 text-stone-600">22 إنش</td>
                        <td className="p-2.5 text-stone-600">27 إنش</td>
                      </tr>
                      <tr className="hover:bg-stone-50">
                        <td className="p-2.5 font-bold font-mono text-amber-700">56</td>
                        <td className="p-2.5 text-stone-700">161 - 165 سم</td>
                        <td className="p-2.5 text-stone-600">23 إنش</td>
                        <td className="p-2.5 text-stone-600">28 إنش</td>
                      </tr>
                      <tr className="hover:bg-stone-50">
                        <td className="p-2.5 font-bold font-mono text-amber-700">58</td>
                        <td className="p-2.5 text-stone-700">166 - 170 سم</td>
                        <td className="p-2.5 text-stone-600">24 إنش</td>
                        <td className="p-2.5 text-stone-600">29 إنش</td>
                      </tr>
                      <tr className="hover:bg-stone-50">
                        <td className="p-2.5 font-bold font-mono text-amber-700">60</td>
                        <td className="p-2.5 text-stone-700">171 سم فما فوق</td>
                        <td className="p-2.5 text-stone-600">25 إنش</td>
                        <td className="p-2.5 text-stone-600">30 إنش</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              <div className="text-xs sm:text-sm text-stone-700 leading-relaxed whitespace-pre-line bg-stone-50 p-4 rounded-2xl border border-stone-200">
                {selectedPolicy.content}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
