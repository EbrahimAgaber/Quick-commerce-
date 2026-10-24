import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  X, 
  Check, 
  AlertCircle, 
  KeyRound, 
  ShieldCheck, 
  Phone, 
  MapPin, 
  Banknote, 
  CheckCircle2, 
  ExternalLink,
  Navigation,
  Car,
  User,
  LogOut,
  Sparkles,
  Lock
} from 'lucide-react';
import { DeliveryCaptain } from '../../types/captain';
import { CaptainService } from '../../services/captainService';
import { StoreManager } from '../../services/storeManager';
import { Order } from '../../types/store';
import { normalizeArabicDigits } from '../../utils/digits';
import { SAUDI_CITY_COORDINATES } from '../../utils/cityUtils';

interface CaptainPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CITY_OPTIONS = Object.keys(SAUDI_CITY_COORDINATES);

export const CaptainPortalModal: React.FC<CaptainPortalModalProps> = ({ isOpen, onClose }) => {
  const [activeCaptain, setActiveCaptain] = useState<DeliveryCaptain | null>(null);
  const [tab, setTab] = useState<'signin' | 'register'>('signin');

  // Registration Form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState(CITY_OPTIONS[0] || 'الرياض');
  const [vehicleType, setVehicleType] = useState<'car' | 'motorcycle' | 'van'>('car');

  // Sign In / Activation
  const [loginPhone, setLoginPhone] = useState('');
  const [loginActivationCode, setLoginActivationCode] = useState('');
  const [activationCodeInput, setActivationCodeInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [assignedOrders, setAssignedOrders] = useState<Order[]>([]);

  // Delivery Pin prompt
  const [completingOrderId, setCompletingOrderId] = useState<string | null>(null);
  const [customerPinInput, setCustomerPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setSuccessMsg('');
      const sessionCaptain = CaptainService.getActiveSessionCaptain();
      if (sessionCaptain) {
        setActiveCaptain(sessionCaptain);
        loadOrdersForCaptain(sessionCaptain);
      }
    }
  }, [isOpen]);

  const loadOrdersForCaptain = (captain: DeliveryCaptain) => {
    if (!captain || !captain.phone) {
      setAssignedOrders([]);
      return;
    }
    const cleanCaptainPhone = captain.phone.replace(/\D/g, '');
    const activeStore = StoreManager.getActiveStore();
    const storeOrders = Array.isArray(activeStore?.orders) ? activeStore.orders : [];
    const assigned = storeOrders.filter((order) => {
      const orderCourierPhone = (order.courierPhone || '').replace(/\D/g, '');
      const isAssignedToCaptain =
        Boolean(orderCourierPhone && cleanCaptainPhone && orderCourierPhone.endsWith(cleanCaptainPhone.slice(-8))) ||
        (order as any).assignedCaptainId === captain.id;
      const isActiveDeliveryStatus =
        order.status === 'Out for Delivery' || order.status === 'In Progress';
      return isAssignedToCaptain && isActiveDeliveryStatus;
    });
    setAssignedOrders(assigned.slice(0, 8));
  };

  if (!isOpen) return null;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const res = await CaptainService.registerCaptain({
      name,
      phone,
      city,
      vehicleType,
    });

    if (res.success && res.captain) {
      setActiveCaptain(res.captain);
      setSuccessMsg('تم تسجيل طلبك بنجاح! بانتظار إدخال كود التفعيل الممنوح من إدارة المنصة.');
    } else {
      setErrorMsg(res.error || 'حدث خطأ أثناء التسجيل');
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const captain = CaptainService.getCaptainByPhone(loginPhone);
    if (!captain) {
      setErrorMsg('لم يتم العثور على كابتن مسجل بهذا الرقم. يرجى التسجيل أولاً.');
      return;
    }

    // Security Gate: Active captains must verify their designated activation code to prevent phone-only takeover
    if (captain.status === 'active') {
      const cleanEnteredCode = loginActivationCode.trim().toUpperCase();
      const expectedCode = (captain.activationCode || '').trim().toUpperCase();
      if (!cleanEnteredCode || (expectedCode && cleanEnteredCode !== expectedCode)) {
        setErrorMsg('يرجى إدخال كود التفعيل السري الخاص بحسابك للتحقق من هويتك.');
        return;
      }
      CaptainService.setActiveSessionCaptain(captain.id);
    }

    setActiveCaptain(captain);
    loadOrdersForCaptain(captain);
  };

  const handleActivate = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!activeCaptain) return;

    const res = CaptainService.activateCaptain(activeCaptain.id, activationCodeInput);
    if (res.success && res.captain) {
      setActiveCaptain(res.captain);
      setSuccessMsg('تهانينا! تم تفعيل حسابك ككابتن معتمد بنجاح. يمكنك الآن استقبال وتسليم الطلبات.');
      loadOrdersForCaptain(res.captain);
    } else {
      setErrorMsg(res.error || 'كود التفعيل غير صالح');
    }
  };

  const handleLogout = () => {
    CaptainService.setActiveSessionCaptain(null);
    setActiveCaptain(null);
    setAssignedOrders([]);
  };

  const handleConfirmDelivery = (order: Order) => {
    setPinError('');
    const cleanPin = normalizeArabicDigits(customerPinInput).trim();
    if (cleanPin !== order.deliveryPin) {
      setPinError('رمز تأكيد التسليم غير صحيح. يرجى طلبه من العميل مباشرة (مكون من 4 أرقام).');
      return;
    }

    // Mark order delivered
    const updatedOrder: Order = {
      ...order,
      status: 'Delivered',
      driverDeliveredAt: new Date().toISOString(),
    };
    StoreManager.updateOrderInStore(order.storeId || 'store_aurora_01', updatedOrder, {
      source: 'driver',
    });

    // Record commission using dynamic order/store shipping fee
    if (activeCaptain) {
      const activeStore = StoreManager.getActiveStore();
      const deliveryFee =
        order.shippingFee ?? activeStore?.settings.standardShippingRate ?? activeStore?.settings.driverFee ?? 15;
      CaptainService.recordDeliveryCompletion(activeCaptain.id, order.id, deliveryFee);
      const updated = CaptainService.getCaptainById(activeCaptain.id);
      if (updated) setActiveCaptain(updated);
    }

    setCompletingOrderId(null);
    setCustomerPinInput('');
    alert(`تم تأكيد تسليم الطلب #${order.id} بنجاح واحتساب أرباح التوصيل! 🎉`);
    if (activeCaptain) loadOrdersForCaptain(activeCaptain);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-stone-950/70 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden z-10 border border-stone-200 my-auto flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black">بوابة كباتن التوصيل السريع</h3>
              <p className="text-xs text-stone-300">
                شبكة توصيل فورية تربط المتاجر بالكباتن المعتمدين في مدينتك
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* VIEW 1: NOT LOGGED IN / REGISTRATION & LOGIN */}
          {!activeCaptain && (
            <div className="space-y-4">
              <div className="flex rounded-2xl bg-stone-100 p-1 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setTab('signin')}
                  className={`flex-1 py-2.5 rounded-xl transition-all cursor-pointer ${
                    tab === 'signin' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  تسجيل دخول كابتن سابق
                </button>
                <button
                  type="button"
                  onClick={() => setTab('register')}
                  className={`flex-1 py-2.5 rounded-xl transition-all cursor-pointer ${
                    tab === 'register' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  انضم ككابتن جديد 🚗
                </button>
              </div>

              {tab === 'signin' ? (
                <form onSubmit={handleLogin} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      رقم الجوال المسجل:
                    </label>
                    <input
                      type="tel"
                      required
                      value={loginPhone}
                      onChange={(e) => setLoginPhone(e.target.value)}
                      placeholder="05XXXXXXXX"
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm font-mono"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      كود التفعيل السري (للحسابات المفعلة):
                    </label>
                    <input
                      type="password"
                      value={loginActivationCode}
                      onChange={(e) => setLoginActivationCode(e.target.value.toUpperCase())}
                      placeholder="CAP-XXXX (اتركه فارغاً إذا كان حسابك بانتظار التفعيل)"
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-xs font-mono uppercase tracking-wider"
                      dir="ltr"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                  >
                    دخول إلى لوحة الكابتن
                  </button>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      الاسم الكامل: <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="مثال: فهد القحطاني"
                      className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      رقم الجوال / الواتساب: <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="05XXXXXXXX"
                      className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-xs font-mono"
                      dir="ltr"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        المدينة الرئيسية للتوصيل:
                      </label>
                      <select
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-xs"
                      >
                        {CITY_OPTIONS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        نوع وسيلة التوصيل:
                      </label>
                      <select
                        value={vehicleType}
                        onChange={(e) => setVehicleType(e.target.value as any)}
                        className="w-full px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-xs"
                      >
                        <option value="car">سيارة خاصة 🚗</option>
                        <option value="motorcycle">دراجة نارية 🏍️</option>
                        <option value="van">فان / دينا بيك آب 🚐</option>
                      </select>
                    </div>
                  </div>

                  <p className="text-[11px] text-stone-500 leading-relaxed pt-1">
                    🔒 بعد التسجيل، سيتواصل معك مالك المنصة للاتفاق على نسبة العمولة (1% - 2.5%) وتزويدك بكود التفعيل الخاص لتنشيط حسابك.
                  </p>

                  <button
                    type="submit"
                    className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-stone-950 rounded-xl text-xs font-black shadow-xs cursor-pointer"
                  >
                    إرسال طلب الانضمام ككابتن
                  </button>
                </form>
              )}
            </div>
          )}

          {/* VIEW 2: LOGGED IN BUT PENDING ACTIVATION (Activation Code Gate) */}
          {activeCaptain && activeCaptain.status === 'pending_activation' && (
            <div className="space-y-4 bg-amber-50/70 border border-amber-200 p-4 rounded-2xl">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-100 rounded-xl text-amber-700 mt-0.5">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-950">
                    الحساب بانتظار كود التفعيل من مالك المنصة
                  </h4>
                  <p className="text-xs text-amber-800 leading-relaxed mt-1">
                    مرحباً أ. {activeCaptain.name}. تم تسجيل طلبك في مدينة <strong>{activeCaptain.city}</strong> بنجاح. لا يمكنك استقبال طلبات المتاجر إلا بعد إدخال كود التفعيل الممنوح لك من إدارة المنصة بعد الاتفاق على الرسوم (نسبة المنصة 1% - 2.5%).
                  </p>
                </div>
              </div>

              <form onSubmit={handleActivate} className="pt-2 space-y-2.5 border-t border-amber-200/80">
                <label className="block text-xs font-bold text-stone-800">
                  أدخل كود التفعيل الممنوح لك:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={activationCodeInput}
                    onChange={(e) => setActivationCodeInput(e.target.value.toUpperCase())}
                    placeholder="أدخل كود التفعيل المعتمد (مثال: CAP-XXXX)"
                    className="flex-1 px-3.5 py-2 bg-white border border-amber-300 rounded-xl text-stone-900 text-xs font-mono uppercase tracking-wider"
                    dir="ltr"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    تفعيل الحساب
                  </button>
                </div>
                <p className="text-[10px] text-stone-500">
                  يرجى إدخال كود التفعيل الخاص بك والممنوح من إدارة المنصة بعد اعتماد حسابك.
                </p>
              </form>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-xs text-stone-500 hover:text-stone-800 flex items-center gap-1 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>تسجيل خروج</span>
                </button>
                <a
                  href={`https://wa.me/966500000000?text=${encodeURIComponent(`السلام عليكم، أود تفعيل حسابي ككابتن توصيل في منصة كويك (${activeCaptain.name} - ${activeCaptain.city})`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-emerald-700 font-bold hover:underline"
                >
                  طلب كود التفعيل عبر واتساب المنصة 💬
                </a>
              </div>
            </div>
          )}

          {/* VIEW 3: ACTIVE CAPTAIN WORKSPACE */}
          {activeCaptain && activeCaptain.status === 'active' && (
            <div className="space-y-4">
              {/* Captain Profile Bar */}
              <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-900 text-xs sm:text-sm">{activeCaptain.name}</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      <span>كابتن معتمد نشط</span>
                    </span>
                  </div>
                  <span className="text-stone-500 text-[11px] flex items-center gap-1.5 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-stone-400" />
                    <span>مدينة التغطية: <strong>{activeCaptain.city}</strong></span>
                    <span>· النسبة المتفق عليها: <strong>{activeCaptain.platformFeePercent}%</strong></span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-2 hover:bg-stone-200 rounded-xl text-stone-600 cursor-pointer"
                  title="تسجيل خروج"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>

              {/* Financial Summary Card */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-3 rounded-2xl bg-blue-50/70 border border-blue-200">
                  <span className="text-blue-700 text-[10px] font-bold block mb-1">الطلبات المسلمة</span>
                  <span className="text-base font-black text-blue-950">{activeCaptain.completedDeliveries}</span>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                  <span className="text-emerald-700 text-[10px] font-bold block mb-1">صافي الأرباح</span>
                  <span className="text-base font-black text-emerald-950">
                    {(activeCaptain.totalDeliveryFeesEarned - activeCaptain.totalPlatformCommission).toFixed(2)} ر.س
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200">
                  <span className="text-amber-700 text-[10px] font-bold block mb-1">عمولة المنصة ({activeCaptain.platformFeePercent}%)</span>
                  <span className="text-base font-black text-amber-950">{activeCaptain.totalPlatformCommission.toFixed(2)} ر.س</span>
                </div>
              </div>

              {/* Available / Assigned Orders */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-stone-600" />
                    <span>الطلبات الجاهزة للتوصيل في مدينتك:</span>
                  </h4>
                  <span className="text-[10px] text-stone-500 font-bold bg-stone-100 px-2 py-0.5 rounded-full">
                    {assignedOrders.length} طلب
                  </span>
                </div>

                {assignedOrders.length === 0 ? (
                  <div className="p-6 text-center text-stone-400 text-xs border border-dashed border-stone-200 rounded-2xl">
                    لا توجد طلبات معلقة بانتظار التوصيل في مدينتك حالياً.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {assignedOrders.map((ord) => (
                      <div
                        key={ord.id}
                        className="p-3 rounded-2xl border border-stone-200 hover:border-blue-300 transition-all space-y-2 text-xs bg-white"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-mono font-bold text-stone-900">#{ord.id}</span>
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-bold">
                            {ord.grandTotal} ر.س ({ord.paymentMethod.includes('استلام') ? 'تحصيل COD' : 'مدفوع إلكترونياً'})
                          </span>
                        </div>

                        <div className="text-stone-600 space-y-0.5 text-[11px]">
                          <div>👤 العميل: <strong>{ord.customerName}</strong> ({ord.customerPhone})</div>
                          <div>🏠 العنوان: {ord.city} - {ord.deliveryAddress}</div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-stone-100">
                          {ord.googleMapsUrl ? (
                            <a
                              href={ord.googleMapsUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-1 text-[11px] font-bold"
                            >
                              <Navigation className="w-3.5 h-3.5" />
                              <span>فتح الخريطة</span>
                            </a>
                          ) : (
                            <span className="text-stone-400 text-[10px]">موقع نصي</span>
                          )}

                          <button
                            type="button"
                            onClick={() => setCompletingOrderId(ord.id)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>تأكيد التسليم (PIN)</span>
                          </button>
                        </div>

                        {/* PIN Verification Input */}
                        {completingOrderId === ord.id && (
                          <div className="p-3 bg-stone-50 border border-emerald-300 rounded-xl space-y-2 mt-2">
                            <label className="block text-[11px] font-bold text-stone-800">
                              اطلب رمز التسليم (4 أرقام) من العميل لتأكيد إتمام التوصيل:
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                maxLength={4}
                                value={customerPinInput}
                                onChange={(e) => setCustomerPinInput(e.target.value)}
                                placeholder="0000"
                                className="w-24 px-3 py-1.5 text-center font-mono font-bold tracking-widest text-sm bg-white border border-stone-300 rounded-lg"
                                dir="ltr"
                              />
                              <button
                                type="button"
                                onClick={() => handleConfirmDelivery(ord)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                              >
                                تأكيد
                              </button>
                              <button
                                type="button"
                                onClick={() => setCompletingOrderId(null)}
                                className="px-2 py-1.5 bg-stone-200 text-stone-700 rounded-lg text-xs"
                              >
                                إلغاء
                              </button>
                            </div>
                            {pinError && <p className="text-[10px] text-red-600">{pinError}</p>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
