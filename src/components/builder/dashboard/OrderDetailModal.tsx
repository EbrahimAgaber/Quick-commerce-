import React, { useState, useEffect } from 'react';
import { Order, OrderStatus, StoreSettings } from '../../../types/store';
import { 
  X, 
  RotateCcw, 
  Check, 
  MessageCircle, 
  Truck, 
  FileText, 
  Loader2,
  Printer,
  ExternalLink,
  Zap,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { AuthService } from '../../../services/authService';
import { CarrierService } from '../../../services/carrierService';

interface OrderDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  settings: StoreSettings;
  onStatusChange: (orderId: string, newStatus: OrderStatus, restock?: boolean) => void;
  onSaveCourier: (orderId: string, courierDetails: { 
    courierName: string; 
    courierPhone: string; 
    trackingNumber: string; 
    trackingUrl: string;
    labelUrl?: string;
    estimatedDeliveryDate?: string;
  }) => void;
  onDispatchToDriver: (order: Order) => void;
  onOpenInvoice: (order: Order) => void;
  onRefundOrder: (order: Order) => void;
  onContactWhatsApp: (order: Order) => void;
  isRefunding?: boolean;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  isOpen,
  onClose,
  order,
  settings,
  onStatusChange,
  onSaveCourier,
  onDispatchToDriver,
  onOpenInvoice,
  onRefundOrder,
  onContactWhatsApp,
  isRefunding = false,
}) => {
  const [courierForm, setCourierForm] = useState({
    courierName: '',
    courierPhone: '',
    trackingNumber: '',
    trackingUrl: '',
    labelUrl: '',
  });

  const [selectedProvider, setSelectedProvider] = useState<string>('torod');
  const [isGeneratingAwb, setIsGeneratingAwb] = useState<boolean>(false);
  const [awbSuccessMessage, setAwbSuccessMessage] = useState<string | null>(null);
  const [awbErrorMessage, setAwbErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (order) {
      setCourierForm({
        courierName: order.courierName || '',
        courierPhone: order.courierPhone || '',
        trackingNumber: order.trackingNumber || '',
        trackingUrl: order.trackingUrl || '',
        labelUrl: order.labelUrl || '',
      });
      setAwbSuccessMessage(null);
      setAwbErrorMessage(null);
    }
  }, [order]);

  if (!isOpen || !order) return null;

  const isElectronicPayment =
    ['card', 'apple_pay', 'stc_pay', 'moyasar'].includes((order.paymentMethod || '').toLowerCase()) ||
    order.paymentMethod === 'Moyasar';

  const handleGenerateAwb = async () => {
    if (!order) return;
    setIsGeneratingAwb(true);
    setAwbSuccessMessage(null);
    setAwbErrorMessage(null);

    try {
      let shipmentResult: {
        trackingNumber: string;
        courierName: string;
        labelUrl?: string;
        trackingUrl?: string;
        estimatedDeliveryDate?: string;
      } | null = null;

      // 1. Attempt serverless shipment generation with merchant auth token
      const token = await AuthService.getIdToken();
      if (token) {
        try {
          const res = await fetch('/api/createShipment', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              storeId: order.storeId || order.storeSlug || settings.storeSlug || 'store',
              orderId: order.id,
              provider: selectedProvider,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data.success && data.shipment) {
              shipmentResult = data.shipment;
            }
          }
        } catch (apiErr) {
          console.warn('API createShipment network fallback:', apiErr);
        }
      }

      // 2. Client-side fallback if offline, demo mode, or token not present
      if (!shipmentResult) {
        const providerInstance = CarrierService.getProvider(selectedProvider);
        const res = await providerInstance.createShipment({
          orderId: order.id,
          storeId: order.storeId || order.storeSlug || settings.storeSlug || 'store',
          sender: {
            name: settings.storeName || 'المتجر',
            phone: settings.whatsappNumber || settings.supportPhone || '0500000000',
            city: settings.city || 'الرياض',
            address: settings.storePickupAddress || 'المملكة العربية السعودية',
          },
          recipient: {
            name: order.customerName,
            phone: order.customerPhone,
            city: order.city,
            address: order.deliveryAddress,
          },
          packages: {
            weightKg: 1,
            description: order.itemsSummary || 'طلب متجر',
            itemCount: order.items?.length || 1,
          },
          codAmount: order.paymentMethod?.toLowerCase().includes('cash') ? order.grandTotal : 0,
        });

        if (res.success) {
          shipmentResult = {
            trackingNumber: res.trackingNumber,
            courierName: res.courierName,
            labelUrl: res.labelUrl,
            trackingUrl: res.trackingUrl,
            estimatedDeliveryDate: res.estimatedDeliveryDate,
          };
        }
      }

      if (shipmentResult) {
        const nextCourier = {
          courierName: shipmentResult.courierName,
          courierPhone: courierForm.courierPhone,
          trackingNumber: shipmentResult.trackingNumber,
          trackingUrl: shipmentResult.trackingUrl || '',
          labelUrl: shipmentResult.labelUrl || '',
          estimatedDeliveryDate: shipmentResult.estimatedDeliveryDate,
        };
        setCourierForm((prev) => ({
          ...prev,
          ...nextCourier,
        }));
        onSaveCourier(order.id, nextCourier);
        if (order.status === 'Received') {
          onStatusChange(order.id, 'In Progress');
        }
        setAwbSuccessMessage(`تم إصدار بوليصة ${shipmentResult.courierName} برقم: ${shipmentResult.trackingNumber}`);
        setTimeout(() => setAwbSuccessMessage(null), 4000);
      } else {
        setAwbErrorMessage('تعذر إصدار البوليصة، يرجى المحاولة مرة أخرى.');
        setTimeout(() => setAwbErrorMessage(null), 4000);
      }
    } catch (err: any) {
      console.error('AWB generation error:', err);
      setAwbErrorMessage(err.message || 'حدث خطأ أثناء إصدار البوليصة.');
      setTimeout(() => setAwbErrorMessage(null), 4000);
    } finally {
      setIsGeneratingAwb(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-stone-950/70 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden z-10 border border-stone-200 my-auto p-6 space-y-4 animate-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-stone-900">
              تفاصيل الطلب #{order.id}
            </h3>
            <p className="text-xs text-stone-500">
              {order.timestamp}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 text-stone-600 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 text-xs bg-stone-50 p-4 rounded-2xl border border-stone-200">
          <div><strong>العميل:</strong> {order.customerName}</div>
          <div><strong>الجوال:</strong> <span className="font-mono" dir="ltr">{order.customerPhone}</span></div>
          <div><strong>العنوان:</strong> {order.city} — {order.deliveryAddress}</div>
          {order.deliveryPin && (
            <div><strong>كود تأكيد التسليم (PIN):</strong> <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{order.deliveryPin}</span></div>
          )}
          {order.googleMapsUrl && (
            <div>
              <strong>موقع GPS للعميل:</strong>{' '}
              <a
                href={order.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline font-bold inline-flex items-center gap-1"
              >
                <span>فتح الموقع على Google Maps 📍</span>
              </a>
            </div>
          )}
          <div><strong>طريقة الدفع:</strong> {order.paymentMethod}</div>
          {order.bankTransferSenderName && (
            <div><strong>اسم المحوّل (الحساب البنكي):</strong> {order.bankTransferSenderName}</div>
          )}
          {order.landmarkNotes && <div><strong>ملاحظات العميل:</strong> {order.landmarkNotes}</div>}
        </div>

        {/* Bank Transfer Receipt Inspection & Manual Payment Verification */}
        {(order.bankTransferReceiptUrl ||
          (order.paymentMethod || '').toLowerCase().includes('bank') ||
          (order.paymentMethod || '').includes('تحويل')) && (
          <div
            className={`p-4 rounded-2xl border text-xs space-y-3 ${
              order.status === 'Paid' || order.paymentStatus === 'paid' || order.paidAt
                ? 'bg-emerald-50/80 border-emerald-300'
                : 'bg-amber-50/80 border-amber-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-stone-900 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-700" />
                <span>إيصال التحويل البنكي وحالة الدفع</span>
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  order.status === 'Paid' || order.paymentStatus === 'paid' || order.paidAt
                    ? 'bg-emerald-200 text-emerald-900'
                    : 'bg-amber-200 text-amber-900'
                }`}
              >
                {order.status === 'Paid' || order.paymentStatus === 'paid' || order.paidAt
                  ? 'مدفوع — تم اعتماد الإيصال ✅'
                  : 'بانتظار مراجعة الإيصال ⏳'}
              </span>
            </div>

            {order.bankTransferReceiptUrl && (
              <div className="bg-white p-2.5 rounded-xl border border-stone-200 flex flex-col items-center gap-2">
                {order.bankTransferReceiptUrl.startsWith('data:image/') ||
                order.bankTransferReceiptUrl.startsWith('http') ? (
                  <img
                    src={order.bankTransferReceiptUrl}
                    alt="إيصال التحويل البنكي"
                    className="max-h-48 object-contain rounded-lg border border-stone-100"
                  />
                ) : (
                  <div className="text-stone-600 py-2">
                    ملف الإيصال المرفق: {order.bankTransferReceiptFileName || 'إيصال تحويل بنكي'}
                  </div>
                )}
              </div>
            )}

            {!(order.status === 'Paid' || order.paymentStatus === 'paid' || order.paidAt) && (
              <button
                type="button"
                onClick={() => onStatusChange(order.id, 'Paid')}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>اعتماد الإيصال وتحديد الطلب كمدفوع (Mark as Paid)</span>
              </button>
            )}
          </div>
        )}

        <div className="space-y-2 max-h-60 overflow-y-auto">
          <div className="text-xs font-bold text-stone-700">المنتجات المطلوبة:</div>
          {order.items && order.items.length > 0 ? (
            order.items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl border border-stone-100 text-xs">
                <div className="flex items-center gap-2.5">
                  {item.imageUrl && (
                    <img src={item.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover bg-stone-100" />
                  )}
                  <div>
                    <div className="font-bold text-stone-900">{item.name}</div>
                    <div className="text-[11px] text-stone-500">
                      الخيار: {item.variant || 'افتراضي'} × {item.quantity}
                    </div>
                  </div>
                </div>
                <div className="font-mono font-bold text-stone-900">
                  {(item.price * item.quantity).toLocaleString('en-US')} {settings.currency}
                </div>
              </div>
            ))
          ) : (
            <div className="p-3 bg-stone-50 rounded-xl text-xs font-mono">{order.itemsSummary}</div>
          )}
        </div>

        <div className="border-t border-stone-200 pt-3 space-y-1 text-xs">
          <div className="flex justify-between text-stone-600">
            <span>المجموع الفرعي:</span>
            <span className="font-mono">{order.subtotal.toLocaleString('en-US')} {settings.currency}</span>
          </div>
          {Boolean(order.discountAmount && order.discountAmount > 0) && (
            <div className="flex justify-between text-emerald-700 font-bold">
              <span>الخصم ({order.discountCode}):</span>
              <span className="font-mono">-{order.discountAmount?.toLocaleString('en-US')} {settings.currency}</span>
            </div>
          )}
          <div className="flex justify-between text-stone-600">
            <span>الشحن:</span>
            <span className="font-mono">{order.shippingFee.toLocaleString('en-US')} {settings.currency}</span>
          </div>
          <div className="flex justify-between text-sm font-black text-stone-900 pt-1">
            <span>الإجمالي النهائي:</span>
            <span className="font-mono">{order.grandTotal.toLocaleString('en-US')} {settings.currency}</span>
          </div>
        </div>

        {/* Customer Return Request Details & Actions */}
        {(order.status === 'Return Requested' || order.returnReason || order.status === 'Returned' || order.status === 'Refunded') && (
          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-300 text-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-950 flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-amber-700" />
                <span>تفاصيل طلب الاسترجاع / الاستبدال:</span>
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900">
                {order.status === 'Return Requested' ? 'بانتظار قرار المتجر' : 'تمت المعالجة'}
              </span>
            </div>

            <div className="space-y-1 text-stone-700 bg-white p-3 rounded-xl border border-amber-200">
              <div><strong>سبب الاسترجاع:</strong> {order.returnReason || 'غير محدد'}</div>
              {order.returnNotes && <div><strong>ملاحظات العميل:</strong> {order.returnNotes}</div>}
              {order.returnRequestedAt && (
                <div className="text-[11px] text-stone-500">
                  تاريخ الطلب: {new Date(order.returnRequestedAt).toLocaleString('ar-SA')}
                </div>
              )}
              {order.returnItems && order.returnItems.length > 0 && (
                <div className="pt-1">
                  <strong>المنتجات المطلوب إرجاعها:</strong>
                  <ul className="list-disc list-inside mt-0.5 text-[11px] text-stone-600">
                    {order.returnItems.map((ri, rIdx) => (
                      <li key={rIdx}>{ri.name} ({ri.quantity} قطعة)</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {order.status === 'Return Requested' && (
              <div className="space-y-2 pt-1">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onStatusChange(order.id, 'Returned', true)}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>قبول الاسترجاع وإعادة للمخزون</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onStatusChange(order.id, 'Delivered')}
                    className="py-2 px-3 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    رفض الطلب
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => onContactWhatsApp(order)}
                  className="w-full py-2 bg-white hover:bg-stone-50 border border-amber-300 text-amber-900 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <span>التواصل مع العميل لتنسيق استلام الشحنة</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Courier & Delivery Assignment */}
        <div className="space-y-3 text-xs bg-stone-50 p-4 rounded-2xl border border-stone-200">
          <div className="font-bold text-stone-800 flex items-center gap-1.5">
            <Truck className="w-4 h-4 text-blue-600" />
            <span>بيانات الشحن والتوصيل (المندوب / شركة الشحن):</span>
          </div>

          {/* ⚡ AWB Generator & Saudi Carrier Selection */}
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="font-bold text-blue-950 flex items-center gap-1.5 text-xs">
                <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span>إصدار بوليصة شحن AWB فورية:</span>
              </div>
              <span className="text-[10px] text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full font-bold">
                ربط مباشر
              </span>
            </div>

            <div className="flex gap-2 items-center">
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="flex-1 bg-white border border-blue-200 rounded-lg py-1.5 px-2 text-xs font-medium text-stone-800 focus:outline-blue-500"
              >
                <option value="torod">تورود - مجمع شركات الشحن (Torod Aggregator)</option>
                <option value="smsa">سمسا إكسبريس (SMSA Express)</option>
                <option value="aramex">أرامكس (Aramex)</option>
                <option value="spl">سبل - البريد السعودي (SPL Subul)</option>
                <option value="mock">محاكي الشحن التجريبي (Sandbox Mock)</option>
              </select>

              <button
                type="button"
                disabled={isGeneratingAwb}
                onClick={handleGenerateAwb}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
              >
                {isGeneratingAwb ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>جارٍ الإصدار...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>إصدار البوليصة</span>
                  </>
                )}
              </button>
            </div>

            {awbSuccessMessage && (
              <div className="flex items-center gap-1.5 text-emerald-800 bg-emerald-100/70 p-2 rounded-lg text-[11px] font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{awbSuccessMessage}</span>
              </div>
            )}

            {awbErrorMessage && (
              <div className="flex items-center gap-1.5 text-rose-800 bg-rose-100/70 p-2 rounded-lg text-[11px] font-bold">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>{awbErrorMessage}</span>
              </div>
            )}

            {(courierForm.labelUrl || order.labelUrl) && (
              <div className="pt-1 flex items-center gap-2">
                <a
                  href={courierForm.labelUrl || order.labelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة بوليصة الشحن (AWB Label)</span>
                  <ExternalLink className="w-3 h-3 opacity-80" />
                </a>
                {(courierForm.trackingUrl || order.trackingUrl) && (
                  <a
                    href={courierForm.trackingUrl || order.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                  >
                    <span>تتبع</span>
                    <ExternalLink className="w-3 h-3 text-stone-400" />
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-stone-500 block mb-0.5">شركة الشحن / اسم المندوب</label>
              <input
                type="text"
                value={courierForm.courierName}
                onChange={(e) => setCourierForm((prev) => ({ ...prev, courierName: e.target.value }))}
                placeholder="مثال: أرامكس / سمسا"
                className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-stone-500 block mb-0.5">رقم جوال المندوب</label>
              <input
                type="text"
                value={courierForm.courierPhone}
                onChange={(e) => setCourierForm((prev) => ({ ...prev, courierPhone: e.target.value }))}
                placeholder="05XXXXXXXX"
                className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-mono"
                dir="ltr"
              />
            </div>
            <div>
              <label className="text-[10px] text-stone-500 block mb-0.5">رقم البوليصة / الشحنة</label>
              <input
                type="text"
                value={courierForm.trackingNumber}
                onChange={(e) => setCourierForm((prev) => ({ ...prev, trackingNumber: e.target.value }))}
                placeholder="Tracking #"
                className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] text-stone-500 block mb-0.5">رابط التتبع (اختياري)</label>
              <input
                type="url"
                value={courierForm.trackingUrl}
                onChange={(e) => setCourierForm((prev) => ({ ...prev, trackingUrl: e.target.value }))}
                placeholder="https://..."
                className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-mono"
                dir="ltr"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSaveCourier(order.id, courierForm)}
            className="w-full py-1.5 bg-stone-800 hover:bg-stone-900 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            تحديث وحفظ بيانات الشحن
          </button>
          <button
            type="button"
            onClick={() => onDispatchToDriver(order)}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <Truck className="w-4 h-4" />
            <span>إرسال تفاصيل الشحنة للمندوب عبر واتساب (1-Tap Dispatch)</span>
          </button>
        </div>

        {/* Actions Bar */}
        <div className="space-y-2 pt-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onOpenInvoice(order)}
              className="flex-1 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>عرض وطباعة الفاتورة (ZATCA)</span>
            </button>

            {isElectronicPayment && order.status !== 'Cancelled' && (
              <button
                type="button"
                disabled={isRefunding}
                onClick={() => onRefundOrder(order)}
                className="py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors border border-rose-200"
                title="استرجاع المبلغ للعميل عبر بوابة ميسر"
              >
                {isRefunding ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                <span>استرجاع (ميسر)</span>
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onContactWhatsApp(order)}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>مراسلة العميل عبر واتساب</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
