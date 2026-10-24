import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Order, StoreSettings, getProductUnitLabel } from '../../types/store';
import { 
  generateZatcaTLVBase64, 
  calculateVatBreakdown, 
  getZatcaComplianceType, 
  generateNonRegisteredOrderQRPayload,
  generateZatcaPhase2Uuid,
  generateInvoiceHash,
  ZatcaComplianceType
} from '../../utils/zatca';
import { 
  X, 
  Printer, 
  MessageCircle, 
  FileText, 
  Receipt,
  Truck,
  ShieldCheck,
  CheckCircle2,
  Info
} from 'lucide-react';
import { createWhatsAppUrl } from '../../utils/whatsappInvoice';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  settings: StoreSettings;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  isOpen,
  onClose,
  order,
  settings,
}) => {
  const [format, setFormat] = useState<'a4' | 'thermal'>('a4');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const brand = settings.brandTheme || {
    primaryColor: '#0B253F',
    accentColor: '#0077FF',
  };

  const complianceType: ZatcaComplianceType = 
    order?.zatcaComplianceType || getZatcaComplianceType(settings);

  // Compute VAT Breakdown based on business compliance type
  const vatBreakdown = order
    ? calculateVatBreakdown(
        order.grandTotal,
        settings.pricesIncludeVat ?? true,
        order.vatRate ?? settings.vatRate ?? 0.15,
        complianceType
      )
    : { netAmount: 0, vatAmount: 0, totalWithVat: 0, vatRate: 0, isVatApplicable: false, complianceType };

  // Generate QR Code adhering strictly to compliance type
  useEffect(() => {
    if (!order) return;

    let isMounted = true;
    const sellerName = settings.storeName || 'متجر إلكتروني';
    const vatNumber = settings.vatNumber || '300000000000003';
    
    // Parse order timestamp to ISO string safely
    let timestampIso = new Date().toISOString();
    try {
      if (order.createdAt) {
        timestampIso = new Date(order.createdAt).toISOString();
      } else if (order.timestamp) {
        const parsed = new Date(order.timestamp);
        if (!isNaN(parsed.getTime())) {
          timestampIso = parsed.toISOString();
        }
      }
    } catch {
      timestampIso = new Date().toISOString();
    }

    try {
      let qrPayload = '';

      if (complianceType === 'non_registered') {
        // NON-REGISTERED: Strictly forbid ZATCA Tax QR. Generate Order Verification QR.
        const storeSlug = order.storeSlug || settings.storeSlug || '';
        const slugParam = storeSlug ? `store=${encodeURIComponent(storeSlug)}&` : '';
        const trackingUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/?${slugParam}track=${order.id}`;
        qrPayload = generateNonRegisteredOrderQRPayload({
          storeName: sellerName,
          orderId: order.id,
          grandTotal: order.grandTotal,
          currency: settings.currency || 'ر.س',
          trackingUrl,
        });
      } else if (complianceType === 'phase_2') {
        // PHASE 2: Extended ZATCA with Hash & UUID
        const invoiceHash = order.invoiceHash || generateInvoiceHash(`${order.id}-${order.grandTotal}-${timestampIso}`);
        qrPayload = generateZatcaTLVBase64({
          sellerName,
          vatNumber,
          timestamp: timestampIso,
          invoiceTotal: order.grandTotal.toFixed(2),
          vatTotal: vatBreakdown.vatAmount.toFixed(2),
          invoiceHash,
        });
      } else {
        // PHASE 1: Standard ZATCA Phase 1 Simplified Tax Invoice QR (Tags 1-5)
        qrPayload = generateZatcaTLVBase64({
          sellerName,
          vatNumber,
          timestamp: timestampIso,
          invoiceTotal: order.grandTotal.toFixed(2),
          vatTotal: (order.vatAmount ?? vatBreakdown.vatAmount).toFixed(2),
        });
      }

      QRCode.toDataURL(qrPayload, {
        width: 180,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      }).then((url) => {
        if (isMounted) setQrDataUrl(url);
      });
    } catch (err) {
      console.error('Failed to generate invoice QR code:', err);
    }

    return () => {
      isMounted = false;
    };
  }, [order, settings, vatBreakdown.vatAmount, complianceType]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  const invoiceTitleArabic = 
    complianceType === 'non_registered'
      ? 'فاتورة مبيعات'
      : complianceType === 'phase_2'
      ? 'فاتورة ضريبية مبسطة - مرحلة الربط (FATOORA)'
      : 'فاتورة ضريبية مبسطة';

  const invoiceTitleEnglish = 
    complianceType === 'non_registered'
      ? 'COMMERCIAL SALES INVOICE'
      : complianceType === 'phase_2'
      ? 'SIMPLIFIED TAX INVOICE - PHASE 2'
      : 'SIMPLIFIED TAX INVOICE';

  const handleShareWhatsApp = () => {
    const storeSlug = order.storeSlug || settings.storeSlug || '';
    const slugParam = storeSlug ? `store=${encodeURIComponent(storeSlug)}&` : '';
    const trackingUrl = `${window.location.origin}/?${slugParam}track=${order.id}`;
    const text = `${invoiceTitleArabic} رقم #${order.id}\nالمتجر: ${settings.storeName}\nالمبلغ الإجمالي: ${order.grandTotal} ${settings.currency}\nرابط التتبع: ${trackingUrl}`;
    const url = createWhatsAppUrl(order.customerPhone || settings.whatsappNumber, text);
    window.open(url, '_blank');
  };

  const invoiceUuid = order.invoiceUuid || (complianceType === 'phase_2' ? generateZatcaPhase2Uuid() : null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto bg-stone-950/75 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Print-specific style */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #invoice-printable-area, #invoice-printable-area * {
            visibility: visible !important;
          }
          #invoice-printable-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 16px !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden z-10 border border-stone-200 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        {/* Top Control Bar (Hidden on print) */}
        <div className="no-print p-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-stone-700">تنسيق العرض:</span>
            <div className="flex rounded-xl bg-stone-200 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFormat('a4')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  format === 'a4'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>فاتورة A4</span>
              </button>
              <button
                type="button"
                onClick={() => setFormat('thermal')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  format === 'thermal'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>إيصال 80mm</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              title="طباعة الفاتورة"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">طباعة</span>
            </button>
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              title="إرسال عبر واتساب"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">مشاركة</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-stone-200 hover:bg-stone-300 text-stone-600 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document */}
        <div className="overflow-y-auto p-4 sm:p-8 bg-stone-100 flex justify-center">
          <div
            id="invoice-printable-area"
            className={`bg-white shadow-md border border-stone-200 transition-all ${
              format === 'a4'
                ? 'w-full max-w-xl p-6 sm:p-8 rounded-2xl text-xs sm:text-sm'
                : 'w-[320px] p-4 rounded-xl text-xs font-mono'
            }`}
          >
            {/* Header / Brand info */}
            <div className={`border-b pb-4 mb-4 ${format === 'thermal' ? 'border-dashed border-stone-400 text-center' : 'border-stone-200 flex items-start justify-between'}`}>
              <div>
                {settings.logoUrl && (
                  <img
                    src={settings.logoUrl}
                    alt={settings.storeName}
                    className={`object-contain mb-2 ${format === 'thermal' ? 'h-10 mx-auto' : 'h-12'}`}
                  />
                )}
                <h2 className="font-black text-lg text-stone-900">
                  {settings.storeName}
                </h2>
                <div className="text-[11px] text-stone-500 space-y-0.5 mt-1">
                  {settings.commercialRegister && (
                    <p>س.ت: {settings.commercialRegister}</p>
                  )}
                  {settings.freelanceCertificate && (
                    <p>وثيقة العمل الحر: {settings.freelanceCertificate}</p>
                  )}
                  {complianceType === 'non_registered' ? (
                    <p className="text-amber-700 font-semibold">غير مسجل في ضريبة القيمة المضافة</p>
                  ) : (
                    <p>الرقم الضريبي: {settings.vatNumber || '300000000000003'}</p>
                  )}
                  <p>{settings.city || 'المملكة العربية السعودية'}</p>
                </div>
              </div>

              {format === 'a4' && (
                <div className="text-left" dir="ltr">
                  <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider mb-2 ${
                    complianceType === 'non_registered'
                      ? 'bg-amber-100 text-amber-900'
                      : complianceType === 'phase_2'
                      ? 'bg-purple-100 text-purple-900'
                      : 'bg-stone-100 text-stone-800'
                  }`}>
                    {invoiceTitleEnglish}
                  </span>
                  <div className="text-xs text-stone-600 space-y-1">
                    <p><strong>Invoice #:</strong> {order.id}</p>
                    <p><strong>Date:</strong> {order.timestamp || new Date().toLocaleString('ar-SA')}</p>
                    <p><strong>Status:</strong> {order.status}</p>
                    {invoiceUuid && (
                      <p className="text-[10px] text-stone-400 truncate max-w-[200px]" title={invoiceUuid}>
                        <strong>UUID:</strong> {invoiceUuid}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Thermal Title */}
            {format === 'thermal' && (
              <div className="text-center py-2 border-b border-dashed border-stone-400 mb-3">
                <p className="font-bold text-sm">{invoiceTitleArabic}</p>
                <p className="text-[11px] text-stone-500">رقم الفاتورة: #{order.id}</p>
                <p className="text-[10px] text-stone-500">{order.timestamp}</p>
                {complianceType === 'non_registered' && (
                  <p className="text-[10px] text-amber-700 font-bold mt-0.5">منشأة غير مسجلة في ضريبة القيمة المضافة</p>
                )}
              </div>
            )}

            {/* Customer Details */}
            <div className={`p-3 bg-stone-50 rounded-xl mb-4 border border-stone-200 text-stone-700 ${format === 'thermal' ? 'text-[11px] space-y-1' : 'grid grid-cols-2 gap-2 text-xs'}`}>
              <div>
                <span className="text-stone-400 block text-[10px]">العميل:</span>
                <span className="font-bold text-stone-900">{order.customerName}</span>
              </div>
              <div>
                <span className="text-stone-400 block text-[10px]">رقم الجوال:</span>
                <span className="font-mono" dir="ltr">{order.customerPhone}</span>
              </div>
              <div>
                <span className="text-stone-400 block text-[10px]">المدينة والعنوان:</span>
                <span>{order.city} - {order.deliveryAddress}</span>
              </div>
              <div>
                <span className="text-stone-400 block text-[10px]">طريقة الدفع:</span>
                <span className="font-semibold">{order.paymentMethod}</span>
              </div>
            </div>

            {/* Items Table */}
            <div className="mb-4">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 text-[11px] text-stone-500">
                    <th className="py-1.5 font-bold">المنتج</th>
                    <th className="py-1.5 font-bold text-center">الكمية</th>
                    <th className="py-1.5 font-bold text-left">السعر</th>
                    <th className="py-1.5 font-bold text-left">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-stone-800">
                  {order.items && order.items.length > 0 ? (
                    order.items.map((item, idx) => (
                      <tr key={idx} className="text-xs">
                        <td className="py-2">
                          <p className="font-bold">{item.name}</p>
                          {item.variant && (
                            <p className="text-[10px] text-stone-400">({item.variant})</p>
                          )}
                        </td>
                        <td className="py-2 text-center font-mono">
                          {item.quantity}{item.unit ? ` ${getProductUnitLabel(item.unit)}` : ''}
                        </td>
                        <td className="py-2 text-left font-mono">{item.price.toFixed(2)}</td>
                        <td className="py-2 text-left font-mono font-bold">
                          {(item.price * item.quantity).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-3 text-center text-stone-500 text-xs italic">
                        {order.itemsSummary || 'تفاصيل المنتجات ملخصة في الإجمالي'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Financial Summary */}
            <div className={`border-t pt-3 space-y-1.5 ${format === 'thermal' ? 'border-dashed border-stone-400 text-xs' : 'border-stone-200 text-xs'}`}>
              <div className="flex justify-between text-stone-600">
                <span>مجموع المنتجات:</span>
                <span className="font-mono">
                  {(order.subtotal || order.grandTotal).toFixed(2)} {settings.currency}
                </span>
              </div>

              {Boolean(order.discountAmount && order.discountAmount > 0) && (
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>الخصم ({order.discountCode || 'كود التخفيض'}):</span>
                  <span className="font-mono">
                    -{(order.discountAmount || 0).toFixed(2)} {settings.currency}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-stone-600">
                <span>رسوم الشحن والتوصيل:</span>
                <span className="font-mono">
                  {order.shippingFee.toFixed(2)} {settings.currency}
                </span>
              </div>

              {/* VAT itemization: ONLY displayed if registered (Phase 1 or Phase 2). STRICTLY omitted for non-registered */}
              {vatBreakdown.isVatApplicable ? (
                <>
                  <div className="flex justify-between text-stone-500 text-[11px] pt-1 border-t border-stone-100">
                    <span>المجموع الخاضع للضريبة (غير شامل الضريبة):</span>
                    <span className="font-mono">
                      {vatBreakdown.netAmount.toFixed(2)} {settings.currency}
                    </span>
                  </div>

                  <div className="flex justify-between text-stone-700 font-semibold bg-stone-50 p-1.5 rounded-lg">
                    <span>ضريبة القيمة المضافة (15% VAT):</span>
                    <span className="font-mono text-stone-900">
                      {vatBreakdown.vatAmount.toFixed(2)} {settings.currency}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 p-2 rounded-lg text-amber-800 text-[11px]">
                  <Info className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                  <span>المنشأة غير خاضعة لضريبة القيمة المضافة (لا تضاف أي ضريبة).</span>
                </div>
              )}

              <div className="flex justify-between text-sm sm:text-base font-black text-stone-900 pt-2 border-t border-stone-200">
                <span>
                  {complianceType === 'non_registered' ? 'الإجمالي النهائي المستحق:' : 'الإجمالي الكلي شامل الضريبة:'}
                </span>
                <span className="font-mono" style={{ color: brand.primaryColor }}>
                  {order.grandTotal.toFixed(2)} {settings.currency}
                </span>
              </div>
            </div>

            {/* QR Code Section - Adapts strictly to Compliance Type */}
            <div className={`mt-6 pt-4 border-t ${format === 'thermal' ? 'border-dashed border-stone-400 text-center' : 'border-stone-200 flex items-center justify-between'}`}>
              <div className={format === 'thermal' ? 'mb-2' : ''}>
                {complianceType === 'non_registered' ? (
                  <>
                    <p className="text-[11px] font-bold text-stone-800 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
                      <span>رمز التحقق وتتبع الطلب التجاري</span>
                    </p>
                    <p className="text-[10px] text-stone-500 max-w-xs leading-relaxed">
                      امسح الرمز لتتبع تفاصيل طلبك مباشرة والتحقق من صحة الإيصال عبر المتجر.
                    </p>
                  </>
                ) : complianceType === 'phase_2' ? (
                  <>
                    <p className="text-[11px] font-bold text-purple-900 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                      <span>رمز التحقق لهيئة الزكاة (مرحلة الربط والتكامل FATOORA)</span>
                    </p>
                    <p className="text-[10px] text-stone-500 max-w-xs leading-relaxed">
                      فاتورة مشفرة ومطابقة لمتطلبات المرحلة الثانية لهيئة الزكاة والضريبة والجمارك مع البصمة الرقمية.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-[11px] font-bold text-stone-800 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>رمز التحقق لهيئة الزكاة والضريبة والجمارك (ZATCA)</span>
                    </p>
                    <p className="text-[10px] text-stone-500 max-w-xs leading-relaxed">
                      امسح الرمز بواسطة تطبيق هيئة الزكاة للتحقق من صحة الفاتورة الضريبية المبسطة وبيانات المنشأة.
                    </p>
                  </>
                )}
              </div>

              {qrDataUrl ? (
                <div className="flex justify-center">
                  <img
                    src={qrDataUrl}
                    alt={complianceType === 'non_registered' ? 'Order Verification QR' : 'ZATCA QR Code'}
                    className={`border border-stone-200 rounded-lg p-1 bg-white ${
                      format === 'thermal' ? 'w-28 h-28 mx-auto' : 'w-24 h-24'
                    }`}
                  />
                </div>
              ) : (
                <div className="w-24 h-24 bg-stone-100 rounded-lg flex items-center justify-center text-[10px] text-stone-400">
                  جاري التشفير...
                </div>
              )}
            </div>

            {/* Courier Info if dispatched */}
            {order.courierName && (
              <div className="mt-4 p-2.5 rounded-xl bg-blue-50/60 border border-blue-200 text-blue-900 text-[11px] flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-600 shrink-0" />
                <div>
                  <span className="font-bold">شركة الشحن: </span>
                  <span>{order.courierName}</span>
                  {order.trackingNumber && (
                    <span className="mr-2">| رقم التتبع: <strong className="font-mono">{order.trackingNumber}</strong></span>
                  )}
                </div>
              </div>
            )}

            {/* Thermal Footer */}
            {format === 'thermal' && (
              <div className="text-center text-[10px] text-stone-400 pt-4 border-t border-dashed border-stone-400 mt-4">
                <p>شكراً لتسوقكم من {settings.storeName}</p>
                <p>نظام المتجر الإلكتروني الذكي</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
