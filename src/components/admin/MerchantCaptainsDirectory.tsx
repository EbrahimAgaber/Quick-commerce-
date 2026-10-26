import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  MapPin, 
  Phone, 
  MessageCircle, 
  ShieldCheck, 
  Car, 
  ExternalLink, 
  AlertCircle, 
  RefreshCw,
  KeyRound,
  CheckCircle2,
  Copy,
  Check,
  UserCheck,
  Percent,
  Clock,
  Send
} from 'lucide-react';
import { DeliveryCaptain } from '../../types/captain';
import { CaptainService, DEFAULT_PLATFORM_FEE_PERCENT } from '../../services/captainService';
import { StoreSettings } from '../../types/store';

interface MerchantCaptainsDirectoryProps {
  settings: StoreSettings;
  storeSlug?: string;
  isPlatformOwner?: boolean;
}

export const MerchantCaptainsDirectory: React.FC<MerchantCaptainsDirectoryProps> = ({
  settings,
  storeSlug,
  isPlatformOwner = false, // Secure default: platform fee & approval controls restricted to platform owner
}) => {
  const storeCity = settings.city || 'الرياض';
  const [activeTab, setActiveTab] = useState<'city_captains' | 'pending_approval' | 'all_network'>('city_captains');
  const [captains, setCaptains] = useState<DeliveryCaptain[]>([]);
  const [selectedCityFilter, setSelectedCityFilter] = useState<string>(storeCity);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Owner activation inputs per captain { [captainId]: number (fee percentage) }
  const [customFees, setCustomFees] = useState<Record<string, number>>({});
  const [customCodes, setCustomCodes] = useState<Record<string, string>>({});
  const [activatedNotice, setActivatedNotice] = useState<string | null>(null);

  const loadCaptains = async () => {
    setIsLoading(true);
    try {
      await CaptainService.fetchCaptainsFromCloud();
    } catch {
      // Graceful offline fallback
    }
    const all = CaptainService.getAllCaptains();
    setCaptains(all);
    setIsLoading(false);
  };

  useEffect(() => {
    setSelectedCityFilter(settings.city || 'الرياض');
    loadCaptains();

    // Listen to real-time update events
    const handleUpdated = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setCaptains(e.detail);
      }
    };
    window.addEventListener('quick_captains_updated', handleUpdated);
    return () => window.removeEventListener('quick_captains_updated', handleUpdated);
  }, [settings.city]);

  const activeInCity = captains.filter(
    (c) => c.status === 'active' && (c.city === selectedCityFilter || c.city.includes(selectedCityFilter))
  );
  const pendingCaptains = captains.filter((c) => c.status === 'pending_activation');
  const allActive = captains.filter((c) => c.status === 'active');

  const getCaptainPortalUrl = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://quick-ecommerce-saas-app.web.app';
    return `${origin}/?view=captain`;
  };

  const handleCopyInviteLink = () => {
    navigator.clipboard.writeText(getCaptainPortalUrl());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleDispatchWhatsApp = (captain: DeliveryCaptain) => {
    const cleanPhone = captain.phone.replace(/\D/g, '');
    const intlPhone = cleanPhone.startsWith('966') ? cleanPhone : `966${cleanPhone.replace(/^0+/, '')}`;
    const text = encodeURIComponent(
      `السلام عليكم كابتن ${captain.name}، تحية طيبة من متجر ${settings.storeName}. لدينا شحنات توصيل فورية في مدينة ${selectedCityFilter} ونود إسنادها لك. هل أنت متاح الآن؟`
    );
    window.open(`https://wa.me/${intlPhone}?text=${text}`, '_blank');
  };

  // Owner Activates Captain with agreed fee percentage (restricted to Platform Owner)
  const handleOwnerActivate = (captain: DeliveryCaptain) => {
    if (!isPlatformOwner) return;
    const feePct = customFees[captain.id] ?? captain.platformFeePercent ?? DEFAULT_PLATFORM_FEE_PERCENT;
    const preferredCode = customCodes[captain.id] || captain.activationCode;
    
    // If owner customized code, save code first
    if (preferredCode && preferredCode !== captain.activationCode) {
      CaptainService.setCaptainActivationCodeAndFee(captain.id, preferredCode, feePct);
    }
    
    const res = CaptainService.ownerActivateCaptain(captain.id, feePct);

    if (res.success && res.whatsAppUrl) {
      setActivatedNotice(`تم تفعيل الكابتن ${captain.name} بنجاح! كود التفعيل: ${res.activationCode}`);
      loadCaptains();
      // Open WhatsApp to deliver activation code directly to captain
      window.open(res.whatsAppUrl, '_blank');
    }
  };

  const handleGenerateNewCode = (captainId: string) => {
    const newCode = CaptainService.generateActivationCode('CAP');
    setCustomCodes((prev) => ({ ...prev, [captainId]: newCode }));
  };

  const totalPlatformCommissionsEarned = isPlatformOwner
    ? captains.reduce((sum, c) => sum + (c.totalPlatformCommission || 0), 0)
    : 0;

  return (
    <div className="bg-white p-6 rounded-3xl border border-stone-200 space-y-5 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
        <div>
          <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-emerald-50 text-emerald-600">
              <Truck className="w-4 h-4" />
            </span>
            <span>شبكة وبوابة كباتن التوصيل (On-Demand Captain Network)</span>
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            نظام ديناميكي متكامل لتسجيل الكباتن، وإسناد وتوصيل طلبات المتجر بكفاءة وموثوقية
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyInviteLink}
            className="text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="نسخ رابط صفحة تسجيل ودخول الكباتن"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-blue-600" />}
            <span>{copiedLink ? 'تم نسخ رابط الكباتن!' : 'رابط تسجيل الكباتن 🔗'}</span>
          </button>

          <button
            type="button"
            onClick={loadCaptains}
            disabled={isLoading}
            className="text-xs text-stone-600 hover:text-stone-900 flex items-center gap-1 font-bold bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-xl cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-stone-100 pb-2 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('city_captains')}
          className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'city_captains'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          <span>كباتن مدينتك النشطين ({activeInCity.length})</span>
        </button>

        {isPlatformOwner && (
          <button
            type="button"
            onClick={() => setActiveTab('pending_approval')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'pending_approval'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-amber-800 bg-amber-50 hover:bg-amber-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>طلبات بانتظار تفعيل المالك</span>
            {pendingCaptains.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-black">
                {pendingCaptains.length}
              </span>
            )}
          </button>
        )}

        {isPlatformOwner && (
          <button
            type="button"
            onClick={() => setActiveTab('all_network')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'all_network'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>إجمالي شبكة الكباتن ({allActive.length})</span>
          </button>
        )}
      </div>

      {activatedNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{activatedNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setActivatedNotice(null)}
            className="text-stone-400 hover:text-stone-600 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* TAB 1: City Active Captains */}
      {activeTab === 'city_captains' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-stone-600 font-medium">
              عرض الكباتن المعتمدين والمفعلين داخل مدينة: <strong>{selectedCityFilter}</strong>
            </span>
            <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              {activeInCity.length} كابتن متاح
            </span>
          </div>

          {activeInCity.length === 0 ? (
            <div className="p-8 rounded-3xl bg-stone-50 border border-dashed border-stone-200 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white border border-stone-200 flex items-center justify-center mx-auto text-stone-400 shadow-xs">
                <Truck className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-stone-800">
                  لا يوجد كباتن مسجلين حالياً في مدينة ({selectedCityFilter})
                </p>
                <p className="text-[11px] text-stone-500 max-w-md mx-auto leading-relaxed">
                  يمكن لأي سائق في منطقتك التسجيل مباشرة عبر رابط بوابة الكباتن. بعد تسجيله واعتماد حسابه من إدارة المنصة سيظهر هنا لإسناد الطلبات إليه مباشرة.
                </p>
              </div>

              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={handleCopyInviteLink}
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>نسخ رابط تسجيل الكباتن لمشاركته</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeInCity.map((cap) => (
                <div
                  key={cap.id}
                  className="p-4 rounded-2xl border border-stone-200 hover:border-blue-300 transition-all bg-stone-50/50 space-y-3 shadow-xs"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-0.5">
                      <span className="font-bold text-stone-900 text-xs block">{cap.name}</span>
                      <span className="text-[11px] text-stone-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-stone-400" />
                        <span>المدينة: {cap.city}</span>
                        <span>· الوسيلة: {cap.vehicleType === 'motorcycle' ? 'دراجة' : cap.vehicleType === 'van' ? 'فان' : 'سيارة'}</span>
                      </span>
                      <span className="text-[10px] text-stone-400 block font-mono" dir="ltr">
                        {cap.phone}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      <span>معتمد</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-stone-200/60 text-xs">
                    <span className="text-stone-500 text-[11px]">
                      أنجز <strong>{cap.completedDeliveries}</strong> شحنة
                    </span>

                    <button
                      type="button"
                      onClick={() => handleDispatchWhatsApp(cap)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>إسناد طلب واتساب</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Pending Approval Gate (Owner Gate) */}
      {activeTab === 'pending_approval' && isPlatformOwner && (
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-950">
              <KeyRound className="w-4 h-4 text-amber-600" />
              <span>بوابة تفعيل الكباتن الحصرية لمالك المنصة</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              الكباتن المسجلون هنا <strong>لا يمكنهم رؤية أو استلام أي طلبات</strong> حتى تقوم كمالك للمنصة بالاتفاق معهم على نسبة رسوم المنصة (مثلاً 1% إلى 2.5%) والضغط على زر "تفعيل وإرسال كود التفعيل" لإرسال الكود له عبر الواتساب.
            </p>
          </div>

          {pendingCaptains.length === 0 ? (
            <div className="p-8 rounded-3xl bg-stone-50 border border-dashed border-stone-200 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="text-xs font-bold text-stone-700">لا توجد طلبات تسجيل كباتن معلقة حالياً</p>
              <p className="text-[11px] text-stone-500">
                جميع الكباتن المسجلين مفعلون أو لم يقم كباتن جدد بالتسجيل بعد. شارك الرابط لدعوة مناديب جدد.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingCaptains.map((cap) => {
                const currentFee = customFees[cap.id] ?? cap.platformFeePercent ?? DEFAULT_PLATFORM_FEE_PERCENT;
                return (
                  <div
                    key={cap.id}
                    className="p-4 rounded-2xl border border-amber-200 bg-white shadow-xs space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-stone-900 text-xs">{cap.name}</span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800">
                            بانتظار موافقتك
                          </span>
                        </div>
                        <div className="text-[11px] text-stone-500 flex flex-wrap items-center gap-2">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {cap.city}
                          </span>
                          <span>· جوال: <strong className="font-mono text-stone-800">{cap.phone}</strong></span>
                          <span>· مركبة: {cap.vehicleType === 'motorcycle' ? 'دراجة' : 'سيارة'}</span>
                          {cap.idNumber && <span>· هوية: {cap.idNumber}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <div className="text-[11px] font-mono text-stone-700 bg-amber-50/70 border border-amber-200 px-2.5 py-1 rounded-xl flex items-center gap-1.5">
                          <KeyRound className="w-3 h-3 text-amber-600" />
                          <span>كود التفعيل:</span>
                          <input
                            type="text"
                            value={customCodes[cap.id] !== undefined ? customCodes[cap.id] : (cap.activationCode || '')}
                            onChange={(e) => setCustomCodes({ ...customCodes, [cap.id]: e.target.value.toUpperCase() })}
                            className="w-24 px-1.5 py-0.5 bg-white border border-amber-300 rounded font-bold text-stone-900 text-center font-mono text-xs focus:ring-1 focus:ring-amber-500"
                            placeholder="CAP-XXXX"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleGenerateNewCode(cap.id)}
                          className="p-1.5 text-stone-500 hover:text-amber-700 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
                          title="توليد كود تفعيل جديد عشوائياً"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      {/* Agreed fee percentage selector */}
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-700">نسبة عمولة المنصة المتفق عليها:</span>
                        <div className="flex items-center gap-1">
                          {[1.0, 1.5, 2.0, 2.5].map((pct) => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => setCustomFees({ ...customFees, [cap.id]: pct })}
                              className={`px-2 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                                currentFee === pct
                                  ? 'bg-amber-600 border-amber-600 text-white'
                                  : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                              }`}
                            >
                              {pct}%
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Action: Activate & Send Code via WhatsApp */}
                      <button
                        type="button"
                        onClick={() => handleOwnerActivate(cap)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>تفعيل الحساب وإرسال الكود واتساب</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: All Network & Platform Earnings Overview */}
      {activeTab === 'all_network' && isPlatformOwner && (
        <div className="space-y-4">
          {/* Platform Commission Summary Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs text-emerald-800 font-bold block">إجمالي أرباح وعمولات المنصة المحصلة من التوصيل:</span>
              <span className="text-xl font-black text-emerald-950 font-mono">
                {totalPlatformCommissionsEarned.toFixed(2)} SAR
              </span>
            </div>
            <div className="text-xs text-emerald-800">
              <span>شبكة الكباتن النشطين: <strong>{allActive.length}</strong> كابتن</span>
            </div>
          </div>

          <div className="space-y-2">
            {allActive.map((cap) => (
              <div
                key={cap.id}
                className="p-3.5 rounded-2xl border border-stone-200 bg-stone-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-900">{cap.name}</span>
                    <span className="text-stone-500">({cap.city})</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      نسبة المنصة: {cap.platformFeePercent}%
                    </span>
                  </div>
                  <span className="text-[11px] text-stone-400 font-mono" dir="ltr">{cap.phone}</span>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono">
                  <div>
                    <span className="text-stone-400 block text-[10px]">شحنات منجزة:</span>
                    <strong className="text-stone-900">{cap.completedDeliveries}</strong>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">دخل الكابتن:</span>
                    <strong className="text-stone-900">{cap.totalDeliveryFeesEarned.toFixed(2)} SAR</strong>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">عمولة المنصة:</span>
                    <strong className="text-emerald-700 font-bold">{cap.totalPlatformCommission.toFixed(2)} SAR</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
