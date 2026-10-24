import React, { useState, useMemo } from 'react';
import {
  Truck,
  Download,
  TrendingUp,
  MapPin,
  ShoppingBag,
  Search,
  Package,
  MessageCircle,
  Eye,
  FileText,
} from 'lucide-react';
import type { Order, OrderStatus, StoreSettings, OrderItem } from '../../../types/store';

interface OrdersTabProps {
  orders: Order[];
  settings: StoreSettings;
  brand: {
    primaryColor: string;
    neutralColor: string;
    fontClass?: string;
  };
  onOrderStatusChange: (orderId: string, newStatus: OrderStatus) => void;
  onDispatchToDriver: (order: Order) => void;
  onContactCustomerWhatsApp: (order: Order) => void;
  onSelectOrderDetail: (order: Order) => void;
  onOpenInvoice: (order: Order) => void;
  onOpenSettlement: () => void;
  onExportCSV: () => void;
  localTrackingNotes: Record<string, string>;
  onTrackingNoteChange: (orderId: string, note: string) => void;
  onCommitTrackingNote: (orderId: string) => void;
}

export const OrdersTab: React.FC<OrdersTabProps> = ({
  orders,
  settings,
  brand,
  onOrderStatusChange,
  onDispatchToDriver,
  onContactCustomerWhatsApp,
  onSelectOrderDetail,
  onOpenInvoice,
  onOpenSettlement,
  onExportCSV,
  localTrackingNotes,
  onTrackingNoteChange,
  onCommitTrackingNote,
}) => {
  const [orderStatusFilter, setOrderStatusFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');

  // Deduplicate orders by ID defensively
  const dedupedOrders = useMemo(() => {
    const map = new Map<string, Order>();
    for (const o of orders) {
      if (!o || !o.id) continue;
      const cleanId = String(o.id).trim().toUpperCase();
      if (!map.has(cleanId)) {
        map.set(cleanId, o);
      }
    }
    return Array.from(map.values());
  }, [orders]);

  // Accurate Metrics (Excludes Cancelled orders from Revenue)
  const validOrders = useMemo(() => dedupedOrders.filter((o) => o.status !== 'Cancelled'), [dedupedOrders]);
  const totalRevenue = useMemo(() => validOrders.reduce((sum, o) => sum + o.grandTotal, 0), [validOrders]);
  const deliveredOrders = useMemo(() => dedupedOrders.filter((o) => o.status === 'Delivered').length, [dedupedOrders]);

  const averageOrderValue = useMemo(() => {
    return validOrders.length > 0 ? Math.round(totalRevenue / validOrders.length) : 0;
  }, [validOrders.length, totalRevenue]);

  const cityBreakdown = useMemo(() => {
    const counts: Record<string, { count: number; total: number }> = {};
    validOrders.forEach((o) => {
      const c = o.city || 'أخرى';
      if (!counts[c]) counts[c] = { count: 0, total: 0 };
      counts[c].count += 1;
      counts[c].total += o.grandTotal;
    });
    return Object.entries(counts).sort((a, b) => b[1].total - a[1].total);
  }, [validOrders]);

  const topProducts = useMemo(() => {
    const map: Record<string, { name: string; qty: number; revenue: number }> = {};
    validOrders.forEach((o) => {
      (o.items || []).forEach((item: OrderItem) => {
        const id = item.productId || item.name;
        if (!map[id]) map[id] = { name: item.name, qty: 0, revenue: 0 };
        map[id].qty += item.quantity;
        map[id].revenue += item.price * item.quantity;
      });
    });
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [validOrders]);

  const filteredOrders = useMemo(() => {
    return dedupedOrders.filter((ord) => {
      if (orderStatusFilter !== 'ALL' && ord.status !== orderStatusFilter) return false;
      if (orderSearchQuery.trim()) {
        const q = orderSearchQuery.toLowerCase().trim();
        const matchId = ord.id.toLowerCase().includes(q);
        const matchName = ord.customerName.toLowerCase().includes(q);
        const matchPhone = ord.customerPhone.toLowerCase().includes(q);
        const matchCity = ord.city.toLowerCase().includes(q);
        if (!matchId && !matchName && !matchPhone && !matchCity) return false;
      }
      return true;
    });
  }, [dedupedOrders, orderStatusFilter, orderSearchQuery]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-stone-900">سجل طلبات العملاء الفوري</h3>
          <span className="text-xs text-stone-500">
            تصل الطلبات هنا تلقائياً بالوقت الفعلي وتنعكس حالتها عند تتبع العميل لطلبه
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={onOpenSettlement}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            title="تصفية حسابات ومبالغ التوصيل مع المندوب"
          >
            <Truck className="w-3.5 h-3.5" />
            <span>دفتر تصفية المندوب (Driver Ledger)</span>
          </button>

          {orders.length > 0 && (
            <button
              type="button"
              onClick={onExportCSV}
              className="px-3.5 py-2 bg-white hover:bg-stone-50 text-stone-800 border border-stone-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>تصدير الطلبات لملف Excel (CSV)</span>
            </button>
          )}
        </div>
      </div>

      {/* Analytics & Insights Performance Breakdown */}
      {validOrders.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* AOV & Efficiency Card */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-700">مؤشرات الأداء والكفاءة</span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-stone-500">متوسط قيمة السلة (AOV):</span>
                <span className="font-mono font-bold text-stone-900">{averageOrderValue} {settings.currency}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-stone-500">معدل اكتمال الطلبات:</span>
                <span className="font-mono font-bold text-emerald-700">
                  {orders.length > 0 ? Math.round((deliveredOrders / orders.length) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>

          {/* Geographic Performance */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-700">أعلى المدن مبيعاً (Geographic)</span>
              <MapPin className="w-4 h-4 text-blue-600" />
            </div>
            <div className="space-y-1 max-h-24 overflow-y-auto text-xs">
              {cityBreakdown.slice(0, 3).map(([cityName, data]) => (
                <div key={cityName} className="flex justify-between items-center">
                  <span className="text-stone-700 font-medium truncate max-w-[120px]">{cityName} ({data.count})</span>
                  <span className="font-mono font-bold text-stone-900">{data.total.toLocaleString('en-US')} {settings.currency}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Selling Products */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-700">المنتجات الأكثر طلباً (Top Products)</span>
              <ShoppingBag className="w-4 h-4 text-amber-600" />
            </div>
            <div className="space-y-1 max-h-24 overflow-y-auto text-xs">
              {topProducts.slice(0, 3).map((p, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  <span className="text-stone-700 font-medium truncate max-w-[130px]">{p.name} ({p.qty} قطعة)</span>
                  <span className="font-mono font-bold text-stone-900">{p.revenue.toLocaleString('en-US')} {settings.currency}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Orders Filter & Search Bar */}
      {orders.length > 0 && (
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-stone-200">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs font-bold">
            {(
              [
                { id: 'ALL', label: `الكل (${orders.length})` },
                { id: 'Received', label: 'تم الاستلام' },
                { id: 'In Progress', label: 'قيد التجهيز' },
                { id: 'Out for Delivery', label: 'جاري التوصيل' },
                { id: 'Delivered', label: `مكتمل (${orders.filter((o) => o.status === 'Delivered').length})` },
                { id: 'Return Requested', label: `طلبات استرجاع (${orders.filter((o) => o.status === 'Return Requested').length})` },
                { id: 'Returned', label: `مرتجع (${orders.filter((o) => o.status === 'Returned' || o.status === 'Refunded').length})` },
                { id: 'Cancelled', label: 'ملغي' },
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                onClick={() => setOrderStatusFilter(st.id)}
                className={`px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap cursor-pointer ${
                  orderStatusFilter === st.id
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-64">
            <input
              type="text"
              value={orderSearchQuery}
              onChange={(e) => setOrderSearchQuery(e.target.value)}
              placeholder="ابحث برقم الطلب، اسم العميل، الجوال..."
              className="w-full pr-8 pl-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:bg-white"
            />
            <Search className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-2 pointer-events-none" />
          </div>
        </div>
      )}

      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center space-y-2">
          <Package className="w-10 h-10 text-stone-300 mx-auto" />
          <h4 className="text-sm font-bold text-stone-800">
            {orders.length === 0 ? 'لا توجد طلبات مسجلة حتى الآن' : 'لا توجد طلبات مطابقة للبحث'}
          </h4>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            شارك رابط متجرك مع عملائك، وستظهر جميع الطلبات الواردة هنا فور إتمامها.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Order Cards (Optimized for Smartphone Merchants) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filteredOrders.map((ord) => (
              <div
                key={ord.id}
                className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3 shadow-2xs"
              >
                <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                  <div>
                    <span className="font-mono font-black text-sm text-[#2563EB]">#{ord.id}</span>
                    <span className="text-[11px] text-stone-400 block">
                      {ord.timestamp}
                    </span>
                  </div>
                  <select
                    value={ord.status}
                    onChange={(e) => onOrderStatusChange(ord.id, e.target.value as OrderStatus)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold border focus:outline-none ${
                      ord.status === 'Delivered'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : ord.status === 'Return Requested'
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : ord.status === 'Returned' || ord.status === 'Refunded'
                        ? 'bg-purple-50 text-purple-800 border-purple-300'
                        : ord.status === 'Out for Delivery'
                        ? 'bg-blue-50 text-blue-800 border-blue-300'
                        : ord.status === 'In Progress'
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : ord.status === 'Cancelled'
                        ? 'bg-rose-50 text-rose-800 border-rose-300'
                        : 'bg-stone-100 text-stone-800 border-stone-300'
                    }`}
                  >
                    <option value="Received">تم الاستلام</option>
                    <option value="In Progress">قيد التجهيز</option>
                    <option value="Out for Delivery">جاري التوصيل</option>
                    <option value="Delivered">تم التوصيل بنجاح</option>
                    <option value="Return Requested">طلب استرجاع</option>
                    <option value="Returned">تم الإرجاع</option>
                    <option value="Refunded">مسترد</option>
                    <option value="Cancelled">ملغي</option>
                  </select>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-900">{ord.customerName}</span>
                    <span className="font-black text-stone-900 font-mono text-sm">
                      {ord.grandTotal.toLocaleString('en-US')} {settings.currency}
                    </span>
                  </div>
                  <div className="text-stone-500">
                    📍 {ord.city} — {ord.deliveryAddress}
                  </div>
                  <div className="text-stone-600 bg-stone-50 p-2 rounded-xl font-mono text-[11px] line-clamp-2">
                    {ord.itemsSummary}
                  </div>
                </div>

                <div className="pt-1">
                  <input
                    type="text"
                    value={localTrackingNotes[ord.id] ?? ord.trackingNotes ?? ''}
                    onChange={(e) => onTrackingNoteChange(ord.id, e.target.value)}
                    onBlur={() => onCommitTrackingNote(ord.id)}
                    placeholder="رقم البوليصة أو ملاحظة للعميل..."
                    className="w-full px-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:bg-white"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onDispatchToDriver(ord)}
                    className="py-2 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                    title="إرسال تفاصيل الشحنة للمندوب عبر واتساب"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>للمندوب</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onContactCustomerWhatsApp(ord)}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>العميل</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectOrderDetail(ord)}
                    className="px-2.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenInvoice(ord)}
                    className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold flex items-center justify-center cursor-pointer"
                    title="الفاتورة الضريبية ZATCA"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Orders Table */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border bg-white shadow-xs" style={{ borderColor: brand.neutralColor }}>
            <table className="w-full text-xs text-right divide-y divide-stone-200">
              <thead className="bg-slate-50 text-stone-700 font-bold">
                <tr>
                  <th className="p-3">رقم الطلب</th>
                  <th className="p-3">العميل والجوال</th>
                  <th className="p-3">المدينة والعنوان</th>
                  <th className="p-3">المنتجات المطلوبة</th>
                  <th className="p-3">الإجمالي</th>
                  <th className="p-3">حالة الطلب</th>
                  <th className="p-3">ملاحظات الشحن / رقم البوليصة</th>
                  <th className="p-3">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-stone-50 transition-colors">
                    <td className="p-3 font-mono font-black text-[#2563EB]">
                      <div>#{ord.id}</div>
                      <div className="text-[10px] font-normal text-stone-400">
                        {ord.timestamp}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-stone-900">{ord.customerName}</div>
                      <div className="text-[11px] text-stone-500 font-mono" dir="ltr">
                        {ord.customerPhone}
                      </div>
                    </td>
                    <td className="p-3 max-w-xs text-stone-700">
                      <strong>{ord.city}</strong> - <span className="text-stone-500">{ord.deliveryAddress}</span>
                    </td>
                    <td className="p-3 max-w-xs truncate font-mono text-stone-600">
                      {ord.itemsSummary}
                    </td>
                    <td className="p-3 font-black text-stone-900 font-mono">
                      <div>{ord.grandTotal.toLocaleString('en-US')} {settings.currency}</div>
                      <div className="text-[10px] font-normal text-stone-400">{ord.paymentMethod}</div>
                    </td>
                    <td className="p-3">
                      <select
                        value={ord.status}
                        onChange={(e) => onOrderStatusChange(ord.id, e.target.value as OrderStatus)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border focus:outline-none ${
                          ord.status === 'Delivered'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : ord.status === 'Return Requested'
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : ord.status === 'Returned' || ord.status === 'Refunded'
                            ? 'bg-purple-50 text-purple-800 border-purple-300'
                            : ord.status === 'Out for Delivery'
                            ? 'bg-blue-50 text-blue-800 border-blue-300'
                            : ord.status === 'In Progress'
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : ord.status === 'Cancelled'
                            ? 'bg-rose-50 text-rose-800 border-rose-300'
                            : 'bg-stone-100 text-stone-800 border-stone-300'
                        }`}
                      >
                        <option value="Received">تم الاستلام</option>
                        <option value="In Progress">قيد التجهيز</option>
                        <option value="Out for Delivery">جاري التوصيل</option>
                        <option value="Delivered">تم التوصيل بنجاح</option>
                        <option value="Return Requested">طلب استرجاع</option>
                        <option value="Returned">تم الإرجاع</option>
                        <option value="Refunded">مسترد</option>
                        <option value="Cancelled">ملغي</option>
                      </select>
                    </td>
                    <td className="p-3 min-w-[180px]">
                      <input
                        type="text"
                        value={localTrackingNotes[ord.id] ?? ord.trackingNotes ?? ''}
                        onChange={(e) => onTrackingNoteChange(ord.id, e.target.value)}
                        onBlur={() => onCommitTrackingNote(ord.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') onCommitTrackingNote(ord.id);
                        }}
                        placeholder="رقم البوليصة (يحفظ تلقائياً)..."
                        className="w-full px-2.5 py-1.5 text-xs bg-stone-50 border rounded-lg focus:bg-white"
                        style={{ borderColor: brand.neutralColor }}
                      />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onDispatchToDriver(ord)}
                          className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors cursor-pointer"
                          title="إرسال تفاصيل الشحنة للمندوب عبر واتساب (1-Tap Dispatch)"
                        >
                          <Truck className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onContactCustomerWhatsApp(ord)}
                          className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors cursor-pointer"
                          title="مراسلة العميل عبر واتساب"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectOrderDetail(ord)}
                          className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition-colors cursor-pointer"
                          title="عرض تفاصيل الطلب والمنتجات"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenInvoice(ord)}
                          className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition-colors cursor-pointer"
                          title="عرض وطباعة الفاتورة الضريبية ZATCA"
                        >
                          <FileText className="w-4 h-4 text-emerald-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
