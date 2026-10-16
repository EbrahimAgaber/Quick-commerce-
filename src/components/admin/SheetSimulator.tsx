import React, { useState } from 'react';
import { StoreSettings, Product, Order, StorePolicy, OrderStatus } from '../../types/store';
import { 
  Table, 
  Settings as SettingsIcon, 
  ShoppingBag, 
  Package, 
  FileText, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  RotateCcw, 
  Download, 
  Upload, 
  Check, 
  ExternalLink,
  Sparkles,
  RefreshCw,
  Search,
  Palette
} from 'lucide-react';

interface SheetSimulatorProps {
  settings: StoreSettings;
  products: Product[];
  orders: Order[];
  policies: StorePolicy[];
  onUpdateSettings: (newSettings: StoreSettings) => void;
  onUpdateProducts: (newProducts: Product[]) => void;
  onUpdateOrders: (newOrders: Order[]) => void;
  onUpdatePolicies: (newPolicies: StorePolicy[]) => void;
  onResetDefault: () => void;
  onSwitchToStore: () => void;
  onOpenAppsScriptHub: () => void;
  onOpenBrandStudio?: () => void;
}

type SheetTab = 'settings' | 'products' | 'orders' | 'policies';

export const SheetSimulator: React.FC<SheetSimulatorProps> = ({
  settings,
  products,
  orders,
  policies,
  onUpdateSettings,
  onUpdateProducts,
  onUpdateOrders,
  onUpdatePolicies,
  onResetDefault,
  onSwitchToStore,
  onOpenAppsScriptHub,
  onOpenBrandStudio,
}) => {
  const [activeTab, setActiveTab] = useState<SheetTab>('products');
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Search in products/orders
  const [gridSearch, setGridSearch] = useState('');

  // Editing state for settings form
  const [editableSettings, setEditableSettings] = useState<StoreSettings>({ ...settings });

  // Modal for adding a new product
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    id: `prod-00${products.length + 1}`,
    name: '',
    category: 'General',
    price: 100,
    salePrice: 80,
    variants: ['Standard Option', 'Pro / Extended Option'],
    imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80',
    galleryImages: [],
    description: '',
    featured: false,
    inStock: true,
    fabricComposition: '',
  });

  const triggerToast = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), 2500);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(editableSettings);
    triggerToast('✅ تم حفظ إعدادات المتجر ومزامنتها فورياً!');
  };

  const handleToggleProductStock = (productId: string) => {
    const updated = products.map((p) => (p.id === productId ? { ...p, inStock: !p.inStock } : p));
    onUpdateProducts(updated);
    triggerToast('🔄 تم تحديث حالة التوفر للمنتج!');
  };

  const handleDeleteProduct = (productId: string) => {
    if (confirm('هل أنتِ متأكدة من حذف هذا المنتج من جدول البيانات؟')) {
      const updated = products.filter((p) => p.id !== productId);
      onUpdateProducts(updated);
      triggerToast('🗑️ تم حذف المنتج من الجدول');
    }
  };

  const handleAddNewProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.name?.trim()) return;

    const fullProduct: Product = {
      id: newProduct.id?.trim() || `prod-${Date.now()}`,
      name: newProduct.name.trim(),
      category: newProduct.category || 'عبايات كلاسيك',
      price: Number(newProduct.price) || 0,
      salePrice: newProduct.salePrice ? Number(newProduct.salePrice) : undefined,
      variants: Array.isArray(newProduct.variants)
        ? newProduct.variants
        : (newProduct.variants as any)?.toString().split(',').map((s: string) => s.trim()) || ['52', '54', '56', '58'],
      imageUrl: newProduct.imageUrl || 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80',
      galleryImages: [newProduct.imageUrl || ''],
      description: newProduct.description || 'تصميم راقٍ بجودة عالية.',
      featured: !!newProduct.featured,
      inStock: newProduct.inStock ?? true,
      fabricComposition: newProduct.fabricComposition || 'قماش فاخر',
    };

    onUpdateProducts([fullProduct, ...products]);
    setIsAddProductOpen(false);
    triggerToast('✨ تم إضافة المنتج بنجاح إلى جدول البيانات!');
  };

  const handleOrderStatusChange = (orderId: string, newStatus: OrderStatus) => {
    const updated = orders.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o));
    onUpdateOrders(updated);
    triggerToast(`🚚 تم تحديث حالة الطلب #${orderId} إلى: ${newStatus}`);
  };

  const handleTrackingNotesChange = (orderId: string, notes: string) => {
    const updated = orders.map((o) => (o.id === orderId ? { ...o, trackingNotes: notes } : o));
    onUpdateOrders(updated);
  };

  const handleExportData = () => {
    const data = { settings, products, orders, policies };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `store_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    triggerToast('📥 تم تصدير نسخة احتياطية من قاعدة بيانات المتجر');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Toast alert */}
      {saveToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-stone-900 text-white text-xs sm:text-sm font-bold py-2.5 px-5 rounded-2xl shadow-xl flex items-center gap-2 animate-in fade-in zoom-in-95">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* Google Sheets Header Container */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        {/* Fake Google Sheets top toolbar */}
        <div className="bg-[#0f9d58] text-white p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center font-black text-sm">
              <Table className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold tracking-tight">
                  {settings.storeName} - قاعدة بيانات المتجر (Google Sheets DB)
                </h2>
                <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded font-mono">
                  v3.2 Live
                </span>
              </div>
              <p className="text-[11px] text-white/80">
                كل تعديل تقوم به هنا ينعكس فوراً وبشكل لحظي على واجهة متجر الويب
              </p>
            </div>
          </div>

          {/* Quick Action buttons */}
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={onSwitchToStore}
              className="bg-white text-emerald-900 font-bold px-3 py-1.5 rounded-xl shadow-xs hover:bg-emerald-50 flex items-center gap-1.5 transition-colors"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>معاينة المتجر الحي</span>
            </button>

            {onOpenBrandStudio && (
              <button
                onClick={onOpenBrandStudio}
                className="bg-white/20 hover:bg-white text-white hover:text-emerald-950 font-bold px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
              >
                <Palette className="w-3.5 h-3.5" />
                <span>تخصيص الهوية البصرية</span>
              </button>
            )}

            <button
              onClick={onOpenAppsScriptHub}
              className="bg-emerald-900/60 hover:bg-emerald-900 text-white font-medium px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>ربط Google Sheet حقيقي</span>
            </button>

            <button
              onClick={handleExportData}
              className="bg-emerald-900/60 hover:bg-emerald-900 text-white font-medium p-1.5 rounded-xl transition-colors"
              title="تصدير نسخة احتياطية"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                if (confirm('هل ترغب في إعادة ضبط المتجر إلى البيانات الافتراضية؟')) {
                  onResetDefault();
                  triggerToast('🔄 تم استعادة البيانات النموذجية الافتراضية');
                }
              }}
              className="bg-emerald-900/60 hover:bg-emerald-900 text-white font-medium p-1.5 rounded-xl transition-colors"
              title="إعادة ضبط للوضع الافتراضي"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Selector Bar */}
        <div className="bg-stone-100 border-b border-stone-200 px-4 flex items-center gap-1 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('products')}
            className={`flex items-center gap-2 py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all shrink-0 ${
              activeTab === 'products'
                ? 'border-emerald-600 bg-white text-emerald-900 shadow-xs'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            <span>👗 Products (المنتجات والمخزون)</span>
            <span className="bg-stone-200 text-stone-700 px-1.5 py-0.2 rounded-full text-[10px]">
              {products.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-2 py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all shrink-0 ${
              activeTab === 'orders'
                ? 'border-emerald-600 bg-white text-emerald-900 shadow-xs'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            <span>📦 Orders (الطلبات والتتبع)</span>
            <span className="bg-stone-200 text-stone-700 px-1.5 py-0.2 rounded-full text-[10px]">
              {orders.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all shrink-0 ${
              activeTab === 'settings'
                ? 'border-emerald-600 bg-white text-emerald-900 shadow-xs'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            <SettingsIcon className="w-3.5 h-3.5" />
            <span>⚙️ Settings (إعدادات المتجر)</span>
          </button>

          <button
            onClick={() => setActiveTab('policies')}
            className={`flex items-center gap-2 py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all shrink-0 ${
              activeTab === 'policies'
                ? 'border-emerald-600 bg-white text-emerald-900 shadow-xs'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>🌿 Information (السياسات والمعلومات)</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-4 sm:p-6 bg-stone-50/50 min-h-[500px]">
          {/* TAB 1: PRODUCTS */}
          {activeTab === 'products' && (
            <div className="space-y-4">
              {/* Product Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="relative w-64">
                    <input
                      type="text"
                      value={gridSearch}
                      onChange={(e) => setGridSearch(e.target.value)}
                      placeholder="تصفية المنتجات في الجدول..."
                      className="w-full pr-8 pl-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-stone-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <Search className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-2.5" />
                  </div>
                </div>

                <button
                  onClick={() => setIsAddProductOpen(true)}
                  className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة منتج جديد للجدول</span>
                </button>
              </div>

              {/* Products Table */}
              <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-xs">
                <table className="w-full text-xs text-right divide-y divide-stone-200">
                  <thead className="bg-stone-100/80 text-stone-700 font-bold">
                    <tr>
                      <th className="p-3">الصورة</th>
                      <th className="p-3">ID</th>
                      <th className="p-3">اسم المنتج</th>
                      <th className="p-3">القسم</th>
                      <th className="p-3">السعر</th>
                      <th className="p-3">سعر التخفيض</th>
                      <th className="p-3">المقاسات / الخيارات</th>
                      <th className="p-3">التوفر بالمخزون</th>
                      <th className="p-3">مميز</th>
                      <th className="p-3 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {products
                      .filter(
                        (p) =>
                          !gridSearch ||
                          p.name.includes(gridSearch) ||
                          p.category.includes(gridSearch) ||
                          p.id.includes(gridSearch)
                      )
                      .map((prod) => (
                        <tr key={prod.id} className="hover:bg-stone-50 transition-colors">
                          <td className="p-3">
                            <img
                              src={prod.imageUrl}
                              alt={prod.name}
                              className="w-10 h-12 object-cover rounded-md bg-stone-100 border border-stone-200"
                            />
                          </td>
                          <td className="p-3 font-mono font-bold text-stone-600">{prod.id}</td>
                          <td className="p-3 font-bold text-stone-900 max-w-xs">{prod.name}</td>
                          <td className="p-3 text-stone-600">{prod.category}</td>
                          <td className="p-3 font-bold text-stone-900 font-mono">
                            {prod.price} {settings.currency}
                          </td>
                          <td className="p-3 font-mono text-amber-700">
                            {prod.salePrice ? `${prod.salePrice} ${settings.currency}` : '-'}
                          </td>
                          <td className="p-3 text-stone-600 max-w-xs truncate">
                            {prod.variants.join(', ')}
                          </td>
                          <td className="p-3">
                            <button
                              onClick={() => handleToggleProductStock(prod.id)}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                                prod.inStock
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {prod.inStock ? 'متوفر' : 'غير متوفر'}
                            </button>
                          </td>
                          <td className="p-3">
                            <span
                              className={`text-[11px] font-bold ${
                                prod.featured ? 'text-amber-600' : 'text-stone-400'
                              }`}
                            >
                              {prod.featured ? '★ نعم' : 'لا'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleDeleteProduct(prod.id)}
                              className="p-1.5 text-stone-400 hover:text-red-600 rounded-lg transition-colors"
                              title="حذف المنتج"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: ORDERS */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-stone-600">
                  سجل طلبات العملاء المجمعة عبر المتجر. يمكنكِ تغيير حالة أي طلب فورياً أو كتابة رقم البوليصة لتظهر في تتبع العميل.
                </p>
                <span className="text-xs font-mono font-bold text-stone-700">
                  إجمالي الطلبات: {orders.length}
                </span>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-xs">
                <table className="w-full text-xs text-right divide-y divide-stone-200">
                  <thead className="bg-stone-100/80 text-stone-700 font-bold">
                    <tr>
                      <th className="p-3">رقم الطلب</th>
                      <th className="p-3">التاريخ</th>
                      <th className="p-3">العميل</th>
                      <th className="p-3">المدينة والعنوان</th>
                      <th className="p-3">طريقة الدفع</th>
                      <th className="p-3">الإجمالي</th>
                      <th className="p-3">الحالة الحالية</th>
                      <th className="p-3">ملاحظات التتبع / رقم البوليصة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {orders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-stone-50 transition-colors">
                        <td className="p-3 font-mono font-black text-amber-700">#{ord.id}</td>
                        <td className="p-3 text-stone-500 whitespace-nowrap">
                          {new Date(ord.timestamp).toLocaleDateString('ar-SA')}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-stone-900">{ord.customerName}</div>
                          <div className="text-[11px] text-stone-500 font-mono" dir="ltr">
                            {ord.customerPhone}
                          </div>
                        </td>
                        <td className="p-3 max-w-xs">
                          <span className="font-semibold text-stone-800">{ord.city}</span> -{' '}
                          <span className="text-stone-500 text-[11px]">{ord.deliveryAddress}</span>
                        </td>
                        <td className="p-3 text-stone-600 text-[11px]">{ord.paymentMethod}</td>
                        <td className="p-3 font-black text-stone-900 font-mono">
                          {ord.grandTotal} {settings.currency}
                        </td>
                        <td className="p-3">
                          <select
                            value={ord.status}
                            onChange={(e) =>
                              handleOrderStatusChange(ord.id, e.target.value as OrderStatus)
                            }
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border focus:outline-none ${
                              ord.status === 'Delivered'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : ord.status === 'Out for Delivery'
                                ? 'bg-blue-50 text-blue-800 border-blue-300'
                                : ord.status === 'In Progress'
                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                : ord.status === 'Cancelled'
                                ? 'bg-red-50 text-red-800 border-red-300'
                                : 'bg-stone-100 text-stone-800 border-stone-300'
                            }`}
                          >
                            <option value="Received">تم الاستلام (Received)</option>
                            <option value="In Progress">قيد التجهيز (In Progress)</option>
                            <option value="Out for Delivery">جاري التوصيل (Out for Delivery)</option>
                            <option value="Delivered">تم التوصيل (Delivered)</option>
                            <option value="Cancelled">ملغي (Cancelled)</option>
                          </select>
                        </td>
                        <td className="p-3 min-w-[200px]">
                          <input
                            type="text"
                            value={ord.trackingNotes || ''}
                            onChange={(e) => handleTrackingNotesChange(ord.id, e.target.value)}
                            placeholder="اكتب بوليصة الشحن أو ملاحظة المندوب..."
                            className="w-full px-2 py-1 text-xs bg-stone-50 border border-stone-200 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: SETTINGS */}
          {activeTab === 'settings' && (
            <form onSubmit={handleSaveSettings} className="max-w-3xl space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-stone-200 space-y-4">
                <h3 className="text-sm font-bold text-stone-900 border-b border-stone-100 pb-2">
                  بيانات المتجر الأساسية
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">اسم المتجر</label>
                    <input
                      type="text"
                      value={editableSettings.storeName}
                      onChange={(e) =>
                        setEditableSettings({ ...editableSettings, storeName: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      العملة المعروضة
                    </label>
                    <input
                      type="text"
                      value={editableSettings.currency}
                      onChange={(e) =>
                        setEditableSettings({ ...editableSettings, currency: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    شعار أو وصف المتجر (Tagline)
                  </label>
                  <input
                    type="text"
                    value={editableSettings.tagline}
                    onChange={(e) =>
                      setEditableSettings({ ...editableSettings, tagline: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    نص شريط الإعلانات أعلى المتجر
                  </label>
                  <input
                    type="text"
                    value={editableSettings.announcementText}
                    onChange={(e) =>
                      setEditableSettings({ ...editableSettings, announcementText: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl"
                  />
                </div>
              </div>

              {/* Shipping & WhatsApp Settings */}
              <div className="bg-white p-6 rounded-2xl border border-stone-200 space-y-4">
                <h3 className="text-sm font-bold text-stone-900 border-b border-stone-100 pb-2">
                  الشحن والواتساب
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      رقم الواتساب لاستقبال الطلبات (دولي بدون +)
                    </label>
                    <input
                      type="text"
                      value={editableSettings.whatsappNumber}
                      onChange={(e) =>
                        setEditableSettings({ ...editableSettings, whatsappNumber: e.target.value })
                      }
                      placeholder="966532923509"
                      className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl font-mono"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      الحد الأدنى للشحن المجاني ({editableSettings.currency})
                    </label>
                    <input
                      type="number"
                      value={editableSettings.freeShippingThreshold}
                      onChange={(e) =>
                        setEditableSettings({
                          ...editableSettings,
                          freeShippingThreshold: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      رسوم الشحن العادية ({editableSettings.currency})
                    </label>
                    <input
                      type="number"
                      value={editableSettings.standardShippingRate}
                      onChange={(e) =>
                        setEditableSettings({
                          ...editableSettings,
                          standardShippingRate: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      إيميل إشعارات الطلبات
                    </label>
                    <input
                      type="email"
                      value={editableSettings.orderNotificationEmail}
                      onChange={(e) =>
                        setEditableSettings({
                          ...editableSettings,
                          orderNotificationEmail: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>

              {/* Bank Details */}
              <div className="bg-white p-6 rounded-2xl border border-stone-200 space-y-4">
                <h3 className="text-sm font-bold text-stone-900 border-b border-stone-100 pb-2">
                  بيانات الحساب البنكي (للتحويل)
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">اسم البنك</label>
                    <input
                      type="text"
                      value={editableSettings.bankDetails?.bankName || ''}
                      onChange={(e) =>
                        setEditableSettings({
                          ...editableSettings,
                          bankDetails: {
                            ...editableSettings.bankDetails,
                            bankName: e.target.value,
                          },
                        })
                      }
                      className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">اسم المستفيد</label>
                    <input
                      type="text"
                      value={editableSettings.bankDetails?.accountHolder || ''}
                      onChange={(e) =>
                        setEditableSettings({
                          ...editableSettings,
                          bankDetails: {
                            ...editableSettings.bankDetails,
                            accountHolder: e.target.value,
                          },
                        })
                      }
                      className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      رقم الآيبان (IBAN)
                    </label>
                    <input
                      type="text"
                      value={editableSettings.bankDetails?.iban || ''}
                      onChange={(e) =>
                        setEditableSettings({
                          ...editableSettings,
                          bankDetails: {
                            ...editableSettings.bankDetails,
                            iban: e.target.value,
                          },
                        })
                      }
                      className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl font-mono"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>حفظ ومزامنة الإعدادات</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 4: POLICIES */}
          {activeTab === 'policies' && (
            <div className="space-y-4 max-w-3xl">
              <p className="text-xs text-stone-600">
                محتوى السياسات، دليل المقاسات، وشروط الاسترجاع المعروضة لزبائنك في المتجر.
              </p>

              {policies.map((pol, idx) => (
                <div key={pol.id} className="p-4 bg-white rounded-2xl border border-stone-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-stone-900">{pol.title}</h4>
                    <span className="text-[10px] text-stone-400 font-mono">#{pol.id}</span>
                  </div>
                  <textarea
                    rows={4}
                    value={pol.content}
                    onChange={(e) => {
                      const updated = [...policies];
                      updated[idx] = { ...pol, content: e.target.value };
                      onUpdatePolicies(updated);
                    }}
                    className="w-full p-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl leading-relaxed focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Product Modal */}
      {isAddProductOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-stone-950/70 backdrop-blur-xs">
          <div className="fixed inset-0" onClick={() => setIsAddProductOpen(false)} aria-hidden="true" />

          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden z-10 border border-stone-200 p-6 space-y-4">
            <h3 className="text-base font-bold text-stone-900">إضافة منتج جديد لجدول البيانات</h3>

            <form onSubmit={handleAddNewProductSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-stone-700 mb-1">اسم المنتج</label>
                <input
                  type="text"
                  required
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  placeholder="مثال: عباية كتان زيتي بأكمام أورجانزا"
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">القسم / التصنيف</label>
                  <select
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                    className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg"
                  >
                    <option value="عبايات كلاسيك">عبايات كلاسيك</option>
                    <option value="عبايات بشت وتطريز">عبايات بشت وتطريز</option>
                    <option value="فساتين واستقبال">فساتين واستقبال</option>
                    <option value="طرح واكسسوارات">طرح واكسسوارات</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">السعر الأصلي</label>
                  <input
                    type="number"
                    required
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: Number(e.target.value) })}
                    className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">سعر التخفيض (اختياري)</label>
                  <input
                    type="number"
                    value={newProduct.salePrice || ''}
                    onChange={(e) =>
                      setNewProduct({
                        ...newProduct,
                        salePrice: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">المقاسات (مفصولة بفاصلة)</label>
                  <input
                    type="text"
                    value={Array.isArray(newProduct.variants) ? newProduct.variants.join(', ') : newProduct.variants}
                    onChange={(e) =>
                      setNewProduct({
                        ...newProduct,
                        variants: e.target.value.split(',').map((s) => s.trim()),
                      })
                    }
                    placeholder="52, 54, 56, 58"
                    className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">رابط صورة المنتج (URL)</label>
                <input
                  type="url"
                  value={newProduct.imageUrl}
                  onChange={(e) => setNewProduct({ ...newProduct, imageUrl: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">وصف المنتج</label>
                <textarea
                  rows={2}
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddProductOpen(false)}
                  className="px-4 py-2 bg-stone-200 text-stone-800 rounded-xl font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold"
                >
                  إضافة المنتج
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
