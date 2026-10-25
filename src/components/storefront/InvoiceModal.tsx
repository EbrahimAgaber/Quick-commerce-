import React, { useState, useEffect, useRef } from 'react';
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
  Info,
  Package,
  MapPin,
  Phone,
  Tag
} from 'lucide-react';
import { createWhatsAppUrl, getOrderDeliveryPin } from '../../utils/whatsappInvoice';

export type PrintDocumentFormat = 'a4' | 'thermal' | 'label';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  settings: StoreSettings;
  initialFormat?: PrintDocumentFormat;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  isOpen,
  onClose,
  order,
  settings,
  initialFormat = 'a4',
}) => {
  const [format, setFormat] = useState<PrintDocumentFormat>(initialFormat);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [trackingQrDataUrl, setTrackingQrDataUrl] = useState<string>('');
  const printableAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFormat(initialFormat || 'a4');
    }
  }, [isOpen, initialFormat]);

  const brand = settings.brandTheme || {
    primaryColor: '#0F172A',
    accentColor: '#2563EB',
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

  // Generate ZATCA / Invoice QR Code + Shipping Label Tracking QR Code
  useEffect(() => {
    if (!order) return;

    let isMounted = true;
    const sellerName = settings.storeName || 'متجر إلكتروني';
    const vatNumber = settings.vatNumber || '300000000000003';
    
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

    const storeSlug = order.storeSlug || settings.storeSlug || '';
    const slugParam = storeSlug ? `store=${encodeURIComponent(storeSlug)}&` : '';
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://quick-ecommerce-saas-app.web.app';
    const trackingUrl = `${origin}/?${slugParam}track=${encodeURIComponent(order.id)}`;
    const driverDispatchUrl = `${origin}/?${slugParam}driver=${encodeURIComponent(order.id)}`;

    try {
      let qrPayload = '';

      if (complianceType === 'non_registered') {
        qrPayload = generateNonRegisteredOrderQRPayload({
          storeName: sellerName,
          orderId: order.id,
          grandTotal: order.grandTotal,
          currency: settings.currency || 'ر.س',
          trackingUrl,
        });
      } else if (complianceType === 'phase_2') {
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
        qrPayload = generateZatcaTLVBase64({
          sellerName,
          vatNumber,
          timestamp: timestampIso,
          invoiceTotal: order.grandTotal.toFixed(2),
          vatTotal: (order.vatAmount ?? vatBreakdown.vatAmount).toFixed(2),
        });
      }

      QRCode.toDataURL(qrPayload, {
        width: 200,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      }).then((url) => {
        if (isMounted) setQrDataUrl(url);
      });

      // Generate dedicated QR for shipping label (scans straight to Driver 1-Tap Dispatch / Order Tracking)
      QRCode.toDataURL(driverDispatchUrl, {
        width: 200,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      }).then((url) => {
        if (isMounted) setTrackingQrDataUrl(url);
      });
    } catch (err) {
      console.error('Failed to generate QR code:', err);
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

  /**
   * Dedicated Clean Print Engine:
   * Opens an isolated, self-contained HTML print window with all stylesheets, Cairo font,
   * and exact @page dimensions so parent overflow/scroll containers NEVER clip the printed page.
   */
  const handlePrint = () => {
    const contentEl = printableAreaRef.current;
    if (!contentEl) {
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank', 'width=900,height=850');
    if (!printWindow) {
      window.print();
      return;
    }

    // Collect all active style & link tags from main document so Tailwind classes render 100% identically
    const styleNodes = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((node) => node.outerHTML)
      .join('\n');

    const pageRule =
      format === 'thermal'
        ? '@page { size: 80mm auto; margin: 4mm; }'
        : format === 'label'
        ? '@page { size: 100mm 150mm; margin: 4mm; }'
        : '@page { size: A4 portrait; margin: 10mm; }';

    const containerWidthStyle =
      format === 'thermal'
        ? 'width: 72mm; max-width: 72mm; margin: 0 auto;'
        : format === 'label'
        ? 'width: 96mm; max-width: 100%; margin: 0 auto;'
        : 'width: 100%; max-width: 190mm; margin: 0 auto;';

    const docTitle =
      format === 'label'
        ? `بوليصة شحن - طلب #${order.id} - ${settings.storeName}`
        : `فاتورة طلب #${order.id} - ${settings.storeName}`;

    const htmlDocument = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>${docTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  ${styleNodes}
  <style>
    ${pageRule}
    * {
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #0f172a !important;
      font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif !important;
      height: auto !important;
      overflow: visible !important;
    }
    .print-wrapper {
      ${containerWidthStyle}
      padding: 4px;
      background: #ffffff !important;
    }
    #invoice-printable-area {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      box-shadow: none !important;
      overflow: visible !important;
    }
  </style>
</head>
<body>
  <div class="print-wrapper">
    ${contentEl.outerHTML}
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 250);
    };
  </script>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(htmlDocument);
    printWindow.document.close();
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

  const isCOD =
    (order.paymentMethod || '').toLowerCase().includes('cod') ||
    (order.paymentMethod || '').toLowerCase().includes('cash') ||
    (order.paymentMethod || '').includes('استلام');

  const paymentMethodArabic = isCOD
    ? 'الدفع عند الاستلام (COD)'
    : (order.paymentMethod || '').toLowerCase().includes('bank') || (order.paymentMethod || '').includes('تحويل')
    ? 'تحويل بنكي'
    : order.paymentMethod || 'دفع إلكتروني';

  const totalItemsCount =
    order.items && order.items.length > 0
      ? order.items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0)
      : 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto bg-stone-950/75 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden z-10 border border-stone-200 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200" dir="rtl">
        {/* Top Control Bar */}
        <div className="no-print p-4 border-b border-stone-200 bg-stone-50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-stone-700">نوع المستند للطباعة:</span>
            <div className="flex rounded-xl bg-stone-200 p-0.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setFormat('a4')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  format === 'a4'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-blue-600" />
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
                <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                <span>إيصال حراري 80mm</span>
              </button>
              <button
                type="button"
                onClick={() => setFormat('label')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  format === 'label'
                    ? 'bg-[#0F172A] text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Tag className="w-3.5 h-3.5 text-amber-500" />
                <span>بوليصة شحن / ملصق الطرد (Label)</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              title="طباعة المستند الآن"
            >
              <Printer className="w-4 h-4" />
              <span>{format === 'label' ? 'طباعة ملصق الطلب' : 'طباعة الفاتورة'}</span>
            </button>
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              title="إرسال عبر واتساب"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">واتساب</span>
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

        {/* Scrollable Printable Document Preview */}
        <div className="overflow-y-auto p-4 sm:p-8 bg-stone-100 flex justify-center">
          {format === 'label' ? (
            /* =====================================================================
               SHIPPING LABEL / WAYBILL (بوليصة الشحن وملصق الطرد 4x6 بوصة / A6)
               ===================================================================== */
            <div
              ref={printableAreaRef}
              id="invoice-printable-area"
              dir="rtl"
              className="w-full max-w-[400px] bg-white border-2 border-stone-900 rounded-xl p-4 text-stone-900 shadow-md space-y-3"
            >
              {/* 1. Top Header: Sender Store & Waybill Badge */}
              <div className="flex items-center justify-between border-b-2 border-stone-900 pb-3">
                <div className="flex items-center gap-2.5">
                  {settings.logoUrl ? (
                    <img
                      src={settings.logoUrl}
                      alt={settings.storeName}
                      className="w-11 h-11 object-contain rounded-lg border border-stone-200 p-0.5 bg-white"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-stone-900 text-white font-black text-base flex items-center justify-center">
                      {settings.logoLetter || settings.storeName?.charAt(0) || 'S'}
                    </div>
                  )}
                  <div>
                    <div className="text-[10px] font-bold text-stone-500">المُرسل (من المتجر):</div>
                    <div className="font-black text-sm text-stone-900 leading-tight">
                      {settings.storeName}
                    </div>
                    <div className="text-[11px] font-mono text-stone-600" dir="ltr">
                      {settings.whatsappNumber || settings.supportPhone || ''}
                    </div>
                  </div>
                </div>

                <div className="text-left">
                  <span className="inline-block px-2.5 py-1 bg-stone-900 text-white font-black text-[11px] rounded-md uppercase tracking-wider">
                    WAYBILL / بوليصة شحن
                  </span>
                  <div className="text-[10px] text-stone-500 mt-1 font-mono" dir="ltr">
                    {order.timestamp || new Date().toLocaleDateString('ar-SA')}
                  </div>
                </div>
              </div>

              {/* 2. Order Number + Destination City Highlight Banner */}
              <div className="grid grid-cols-2 gap-2 bg-stone-100 border-2 border-stone-900 rounded-lg p-2.5">
                <div>
                  <span className="text-[10px] font-bold text-stone-500 block">رقم الطلب (Order #):</span>
                  <span className="font-mono font-black text-lg text-stone-900 tracking-wide" dir="ltr">
                    #{order.id}
                  </span>
                </div>
                <div className="border-r-2 border-stone-900 pr-2.5">
                  <span className="text-[10px] font-bold text-stone-500 block">المدينة / الوجهة:</span>
                  <span className="font-black text-base text-stone-900 flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-stone-900 shrink-0" />
                    <span>{order.city || 'توصيل محلي'}</span>
                  </span>
                </div>
              </div>

              {/* 3. Recipient (Customer) Full Address & Contact Box */}
              <div className="border-2 border-stone-900 rounded-lg p-3 space-y-2 bg-white">
                <div className="flex items-center justify-between border-b border-stone-200 pb-1.5">
                  <span className="text-[11px] font-black text-stone-600 uppercase">
                    المستلم (بيانات التوصيل للعميل):
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-stone-100 text-stone-800">
                    {order.deliveryType === 'pickup' ? 'استلام من الفرع' : 'توصيل لباب العميل'}
                  </span>
                </div>

                <div className="text-base font-black text-stone-900">
                  {order.customerName}
                </div>

                <div className="flex items-center gap-1.5 text-sm font-mono font-black text-stone-900 bg-stone-50 px-2.5 py-1.5 rounded border border-stone-300" dir="ltr">
                  <Phone className="w-4 h-4 text-stone-700 shrink-0" />
                  <span>{order.customerPhone}</span>
                </div>

                <div className="text-xs font-bold text-stone-800 leading-relaxed pt-0.5">
                  <span className="text-stone-500">العنوان التفصيلي: </span>
                  <span>{order.city} — {order.deliveryAddress}</span>
                </div>

                {order.landmarkNotes && (
                  <div className="text-[11px] font-bold text-stone-700 bg-amber-50 border border-amber-300 rounded p-1.5">
                    <span>معلم بارز / ملاحظة التوصيل: </span>
                    <span>{order.landmarkNotes}</span>
                  </div>
                )}
              </div>

              {/* 4. COD / Payment Collection Box (Critical for Driver) */}
              <div
                className={`border-2 border-stone-900 rounded-lg p-3 flex items-center justify-between ${
                  isCOD ? 'bg-amber-50' : 'bg-emerald-50'
                }`}
              >
                <div>
                  <span className="text-[10px] font-black uppercase text-stone-600 block">
                    حالة التحصيل عند التسليم (Payment):
                  </span>
                  <span className="text-xs font-black text-stone-900">
                    {isCOD
                      ? '💵 الدفع عند الاستلام — يُحصّل من العميل'
                      : '✅ مدفوع مسبقاً — لا يُحصّل أي مبلغ'}
                  </span>
                </div>
                <div className="text-left font-mono">
                  <span className="text-[10px] font-bold text-stone-500 block">المبلغ المطلوب تحصيله:</span>
                  <span className="text-lg font-black text-stone-900">
                    {isCOD ? `${order.grandTotal.toFixed(2)} ${settings.currency}` : `0.00 ${settings.currency}`}
                  </span>
                </div>
              </div>

              {/* 5. Package Contents / Packing Slip Summary */}
              <div className="border-2 border-stone-900 rounded-lg p-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-black text-stone-700 border-b border-stone-200 pb-1">
                  <span className="flex items-center gap-1">
                    <Package className="w-3.5 h-3.5" />
                    <span>محتويات الطرد (Packing List):</span>
                  </span>
                  <span>إجمالي القطع: {totalItemsCount}</span>
                </div>

                {order.items && order.items.length > 0 ? (
                  <div className="space-y-1 text-xs">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between font-bold text-stone-900">
                        <span className="truncate max-w-[250px]">
                          • {item.name} {item.variant ? `(${item.variant})` : ''}
                        </span>
                        <span className="font-mono font-black bg-stone-100 px-1.5 py-0.5 rounded border border-stone-300">
                          × {item.quantity} {item.unit ? getProductUnitLabel(item.unit) : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs font-bold text-stone-800">
                    {order.itemsSummary || 'محتويات الطلب حسب الفاتورة'}
                  </div>
                )}
              </div>

              {/* 6. Bottom Barcode / QR & Driver Info */}
              <div className="border-t-2 border-stone-900 pt-3 flex items-center justify-between gap-3">
                <div className="space-y-1 text-[11px]">
                  {order.courierName && (
                    <div>
                      <span className="text-stone-500 font-bold">شركة الشحن / المندوب: </span>
                      <span className="font-black text-stone-900">{order.courierName}</span>
                    </div>
                  )}
                  {order.trackingNumber && (
                    <div>
                      <span className="text-stone-500 font-bold">رقم التتبع (AWB): </span>
                      <span className="font-mono font-black text-stone-900">{order.trackingNumber}</span>
                    </div>
                  )}
                  <div className="text-[10px] text-stone-600 leading-snug pt-1">
                    امسح رمز الـ QR بكاميرا الجوال لفتح مسار التوصيل وتأكيد تسليم الطلب مباشرة.
                  </div>
                  <div className="text-[10px] font-bold text-stone-500">
                    كود تأكيد الاستلام للعميل: <span className="font-mono text-stone-900">{getOrderDeliveryPin(order)}</span>
                  </div>
                </div>

                {(trackingQrDataUrl || qrDataUrl) && (
                  <div className="shrink-0 text-center">
                    <img
                      src={trackingQrDataUrl || qrDataUrl}
                      alt="Waybill QR"
                      className="w-24 h-24 border-2 border-stone-900 rounded-lg p-1 bg-white mx-auto"
                    />
                    <span className="text-[9px] font-mono font-bold text-stone-700 block mt-0.5">
                      #{order.id}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* =====================================================================
               CUSTOMER TAX / COMMERCIAL INVOICE (A4 or 80mm Thermal Receipt)
               ===================================================================== */
            <div
              ref={printableAreaRef}
              id="invoice-printable-area"
              dir="rtl"
              className={`bg-white shadow-md border border-stone-300 transition-all text-stone-900 ${
                format === 'a4'
                  ? 'w-full max-w-xl p-6 sm:p-8 rounded-2xl text-xs sm:text-sm'
                  : 'w-[320px] p-4 rounded-xl text-xs font-mono'
              }`}
            >
              {/* Header / Brand info */}
              <div className={`border-b-2 pb-4 mb-4 ${format === 'thermal' ? 'border-dashed border-stone-400 text-center' : 'border-stone-800 flex items-start justify-between gap-4'}`}>
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
                  <div className="text-[11px] text-stone-600 space-y-0.5 mt-1 font-medium">
                    {settings.commercialRegister && (
                      <p>س.ت: {settings.commercialRegister}</p>
                    )}
                    {settings.freelanceCertificate && (
                      <p>وثيقة العمل الحر: {settings.freelanceCertificate}</p>
                    )}
                    {complianceType === 'non_registered' ? (
                      <p className="text-amber-800 font-bold">غير مسجل في ضريبة القيمة المضافة</p>
                    ) : (
                      <p>الرقم الضريبي: {settings.vatNumber || '300000000000003'}</p>
                    )}
                    <p>{settings.city || 'المملكة العربية السعودية'}</p>
                    {(settings.whatsappNumber || settings.supportPhone) && (
                      <p dir="ltr" className="font-mono text-right">
                        هاتف: {settings.supportPhone || `+${settings.whatsappNumber}`}
                      </p>
                    )}
                  </div>
                </div>

                {format === 'a4' && (
                  <div className="text-left shrink-0" dir="ltr">
                    <span className="inline-block px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider mb-1.5 bg-stone-900 text-white">
                      {invoiceTitleEnglish}
                    </span>
                    <div className="text-xs font-bold text-stone-800 mb-1">
                      {invoiceTitleArabic}
                    </div>
                    <div className="text-xs text-stone-700 space-y-1">
                      <p><strong>Invoice #:</strong> {order.id}</p>
                      <p><strong>Date:</strong> {order.timestamp || new Date().toLocaleString('ar-SA')}</p>
                      <p><strong>Payment:</strong> {paymentMethodArabic}</p>
                      {invoiceUuid && (
                        <p className="text-[10px] text-stone-500 truncate max-w-[200px]" title={invoiceUuid}>
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
                  <p className="font-black text-sm">{invoiceTitleArabic}</p>
                  <p className="text-[11px] font-bold text-stone-700">رقم الفاتورة: #{order.id}</p>
                  <p className="text-[10px] text-stone-600">{order.timestamp}</p>
                  {complianceType === 'non_registered' && (
                    <p className="text-[10px] text-amber-800 font-bold mt-0.5">منشأة غير مسجلة في ضريبة القيمة المضافة</p>
                  )}
                </div>
              )}

              {/* Customer Details */}
              <div className={`p-3.5 bg-stone-50 rounded-xl mb-4 border border-stone-300 text-stone-800 ${format === 'thermal' ? 'text-[11px] space-y-1.5' : 'grid grid-cols-2 gap-3 text-xs'}`}>
                <div>
                  <span className="text-stone-500 font-bold block text-[10px]">العميل (Customer):</span>
                  <span className="font-black text-stone-900">{order.customerName}</span>
                </div>
                <div>
                  <span className="text-stone-500 font-bold block text-[10px]">رقم الجوال (Phone):</span>
                  <span className="font-mono font-bold text-stone-900" dir="ltr">{order.customerPhone}</span>
                </div>
                <div>
                  <span className="text-stone-500 font-bold block text-[10px]">المدينة والعنوان (Address):</span>
                  <span className="font-bold text-stone-900">{order.city} - {order.deliveryAddress}</span>
                </div>
                <div>
                  <span className="text-stone-500 font-bold block text-[10px]">طريقة الدفع (Payment):</span>
                  <span className="font-bold text-stone-900">{paymentMethodArabic}</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="mb-4">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b-2 border-stone-800 text-[11px] text-stone-700 bg-stone-100">
                      <th className="py-2 px-2 font-black">المنتج / البيان</th>
                      <th className="py-2 px-2 font-black text-center">الكمية</th>
                      <th className="py-2 px-2 font-black text-left">سعر الوحدة</th>
                      <th className="py-2 px-2 font-black text-left">المجموع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 text-stone-900">
                    {order.items && order.items.length > 0 ? (
                      order.items.map((item, idx) => (
                        <tr key={idx} className="text-xs">
                          <td className="py-2.5 px-2">
                            <p className="font-bold text-stone-900">{item.name}</p>
                            {item.variant && (
                              <p className="text-[10px] text-stone-600">({item.variant})</p>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono font-bold">
                            {item.quantity}{item.unit ? ` ${getProductUnitLabel(item.unit)}` : ''}
                          </td>
                          <td className="py-2.5 px-2 text-left font-mono">{Number(item.price || 0).toFixed(2)}</td>
                          <td className="py-2.5 px-2 text-left font-mono font-black">
                            {(Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-3 px-2 text-right text-stone-800 text-xs font-bold">
                          {order.itemsSummary || 'مشتريات من المتجر'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Financial Summary */}
              <div className={`border-t-2 pt-3 space-y-1.5 ${format === 'thermal' ? 'border-dashed border-stone-400 text-xs' : 'border-stone-800 text-xs'}`}>
                <div className="flex justify-between text-stone-700 font-bold">
                  <span>مجموع المنتجات (Subtotal):</span>
                  <span className="font-mono">
                    {Number(order.subtotal || order.grandTotal || 0).toFixed(2)} {settings.currency}
                  </span>
                </div>

                {Boolean(order.discountAmount && order.discountAmount > 0) && (
                  <div className="flex justify-between text-emerald-800 font-bold">
                    <span>الخصم ({order.discountCode || 'كود التخفيض'}):</span>
                    <span className="font-mono">
                      -{Number(order.discountAmount || 0).toFixed(2)} {settings.currency}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-stone-700 font-bold">
                  <span>رسوم الشحن والتوصيل (Shipping):</span>
                  <span className="font-mono">
                    {Number(order.shippingFee || 0).toFixed(2)} {settings.currency}
                  </span>
                </div>

                {vatBreakdown.isVatApplicable ? (
                  <>
                    <div className="flex justify-between text-stone-600 text-[11px] pt-1 border-t border-stone-200">
                      <span>المبلغ الخاضع للضريبة (غير شامل الضريبة):</span>
                      <span className="font-mono">
                        {vatBreakdown.netAmount.toFixed(2)} {settings.currency}
                      </span>
                    </div>

                    <div className="flex justify-between text-stone-800 font-bold bg-stone-100 p-1.5 rounded-lg">
                      <span>ضريبة القيمة المضافة (15% VAT):</span>
                      <span className="font-mono text-stone-900">
                        {vatBreakdown.vatAmount.toFixed(2)} {settings.currency}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-300 p-2 rounded-lg text-amber-900 text-[11px] font-bold">
                    <Info className="w-3.5 h-3.5 shrink-0 text-amber-700" />
                    <span>المنشأة غير خاضعة لضريبة القيمة المضافة (لا تضاف أي ضريبة).</span>
                  </div>
                )}

                <div className="flex justify-between text-sm sm:text-base font-black text-stone-900 pt-2.5 border-t-2 border-stone-900">
                  <span>
                    {complianceType === 'non_registered' ? 'الإجمالي النهائي المستحق:' : 'الإجمالي الكلي شامل الضريبة:'}
                  </span>
                  <span className="font-mono text-base sm:text-lg">
                    {Number(order.grandTotal || 0).toFixed(2)} {settings.currency}
                  </span>
                </div>
              </div>

              {/* QR Code Section */}
              <div className={`mt-5 pt-4 border-t ${format === 'thermal' ? 'border-dashed border-stone-400 text-center' : 'border-stone-300 flex items-center justify-between gap-4'}`}>
                <div className={format === 'thermal' ? 'mb-2' : ''}>
                  {complianceType === 'non_registered' ? (
                    <>
                      <p className="text-[11px] font-bold text-stone-900 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
                        <span>رمز التحقق وتتبع الطلب التجاري</span>
                      </p>
                      <p className="text-[10px] text-stone-600 max-w-xs leading-relaxed">
                        امسح الرمز لتتبع تفاصيل طلبك مباشرة والتحقق من صحة الإيصال عبر المتجر.
                      </p>
                    </>
                  ) : complianceType === 'phase_2' ? (
                    <>
                      <p className="text-[11px] font-bold text-purple-900 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                        <span>رمز التحقق لهيئة الزكاة (مرحلة الربط والتكامل FATOORA)</span>
                      </p>
                      <p className="text-[10px] text-stone-600 max-w-xs leading-relaxed">
                        فاتورة مشفرة ومطابقة لمتطلبات المرحلة الثانية لهيئة الزكاة والضريبة والجمارك.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-[11px] font-bold text-stone-900 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>رمز التحقق لهيئة الزكاة والضريبة والجمارك (ZATCA)</span>
                      </p>
                      <p className="text-[10px] text-stone-600 max-w-xs leading-relaxed">
                        امسح الرمز بواسطة تطبيق هيئة الزكاة للتحقق من صحة الفاتورة الضريبية المبسطة.
                      </p>
                    </>
                  )}
                </div>

                {qrDataUrl ? (
                  <div className="flex justify-center shrink-0">
                    <img
                      src={qrDataUrl}
                      alt={complianceType === 'non_registered' ? 'Order Verification QR' : 'ZATCA QR Code'}
                      className={`border border-stone-300 rounded-lg p-1 bg-white ${
                        format === 'thermal' ? 'w-28 h-28 mx-auto' : 'w-24 h-24'
                      }`}
                    />
                  </div>
                ) : (
                  <div className="w-24 h-24 bg-stone-100 rounded-lg flex items-center justify-center text-[10px] text-stone-500">
                    جاري التشفير...
                  </div>
                )}
              </div>

              {/* Courier Info if dispatched */}
              {order.courierName && (
                <div className="mt-4 p-2.5 rounded-xl bg-stone-100 border border-stone-300 text-stone-900 text-[11px] flex items-center gap-2">
                  <Truck className="w-4 h-4 text-stone-700 shrink-0" />
                  <div>
                    <span className="font-bold">شركة الشحن: </span>
                    <span>{order.courierName}</span>
                    {order.trackingNumber && (
                      <span className="mr-2">| رقم التتبع: <strong className="font-mono">{order.trackingNumber}</strong></span>
                    )}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="text-center text-[10px] text-stone-500 pt-3 border-t border-stone-200 mt-4 font-bold">
                <p>شكراً لتسوقكم من {settings.storeName}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
