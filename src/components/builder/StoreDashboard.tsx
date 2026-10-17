import React, { useState, useEffect } from 'react';
import { StoreSettings, Product, Order, StorePolicy, OrderStatus, MerchantUser } from '../../types/store';
import { 
  Copy, 
  Check, 
  ShoppingBag, 
  Package, 
  TrendingUp, 
  DollarSign, 
  Plus, 
  Palette, 
  Sparkles,
  Link2,
  MessageCircle,
  Edit3,
  Trash2,
  Search,
  X,
  Tag,
  Settings as SettingsIcon,
  Save
} from 'lucide-react';

interface StoreDashboardProps {
  storeSlug: string;
  settings: StoreSettings;
  products: Product[];
  orders: Order[];
  policies: StorePolicy[];
  onUpdateSettings: (newSettings: StoreSettings) => void;
  onUpdateProducts: (newProducts: Product[]) => void;
  onUpdateOrders: (newOrders: Order[]) => void;
  onUpdatePolicies: (newPolicies: StorePolicy[]) => void;
  onViewStorefront: () => void;
  onOpenBrandStudio: () => void;
  onOpenNewStoreWizard: () => void;
  currentUser?: MerchantUser | null;
}

export const StoreDashboard: React.FC<StoreDashboardProps> = ({
  storeSlug,
  settings,
  products,
  orders,
  policies,
  onUpdateSettings,
  onUpdateProducts,
  onUpdateOrders,
  onUpdatePolicies,
  onViewStorefront,
  onOpenBrandStudio,
  onOpenNewStoreWizard,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'settings'>('overview');
  const [copiedLink, setCopiedLink] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Editable Settings State for the Settings tab
  const [editableSettings, setEditableSettings] = useState<StoreSettings>({ ...settings });
  useEffect(() => {
    setEditableSettings({ ...settings });
  }, [settings]);

  // Product Management Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    category: 'منتجات مميزة',
    price: 150,
    salePrice: 0,
    variants: 'الخيار الأساسي',
    imageUrl: '',
    description: '',
    inStock: true,
  });

  const brand = settings.brandTheme || {
    primaryColor: '#0F172A',
    accentColor: '#2563EB',
    highlightColor: '#86EFAC',
    backgroundColor: '#F8FAFC',
    neutralColor: '#E2E8F0',
    textColor: '#0F172A',
  };

  const cleanSlug = storeSlug || 'aurora';
  const storeUrl = typeof window !== 'undefined' && window.location.origin 
    ? `${window.location.origin}/?store=${encodeURIComponent(cleanSlug)}` 
    : `https://quick-ecommerce.app/?store=${encodeURIComponent(cleanSlug)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(storeUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Metrics
  const totalRevenue = orders.reduce((sum, o) => sum + o.grandTotal, 0);
  const deliveredOrders = orders.filter((o) => o.status === 'Delivered').length;
  const inStockProducts = products.filter((p) => p.inStock).length;

  const handleOrderStatusChange = (orderId: string, newStatus: OrderStatus) => {
    const updated = orders.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o));
    onUpdateOrders(updated);
  };

  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      category: 'عام',
      price: 100,
      salePrice: 0,
      variants: 'مقاس موحد',
      imageUrl: '',
      description: '',
      inStock: true,
    });
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (p: Product) => {
    setEditingProduct(p);
    setProductForm({
      name: p.name,
      category: p.category,
      price: p.price,
      salePrice: p.salePrice || 0,
      variants: (p.variants || []).join(', '),
      imageUrl: p.imageUrl,
      description: p.description,
      inStock: p.inStock,
    });
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim()) return;

    const variantsArray = productForm.variants
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

    const defaultImg = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80';

    if (editingProduct) {
      const updated = products.map((p) =>
        p.id === editingProduct.id
          ? {
              ...p,
              name: productForm.name.trim(),
              category: productForm.category.trim() || 'عام',
              price: Number(productForm.price) || 0,
              salePrice: productForm.salePrice && Number(productForm.salePrice) > 0 ? Number(productForm.salePrice) : undefined,
              variants: variantsArray.length > 0 ? variantsArray : ['الخيار الافتراضي'],
              imageUrl: productForm.imageUrl.trim() || defaultImg,
              description: productForm.description.trim(),
              inStock: productForm.inStock,
            }
          : p
      );
      onUpdateProducts(updated);
      setSyncMessage('✨ تم تحديث بيانات المنتج وحفظها في المتجر بنجاح!');
    } else {
      const newP: Product = {
        id: `prod-${Date.now()}`,
        name: productForm.name.trim(),
        category: productForm.category.trim() || 'عام',
        price: Number(productForm.price) || 0,
        salePrice: productForm.salePrice && Number(productForm.salePrice) > 0 ? Number(productForm.salePrice) : undefined,
        variants: variantsArray.length > 0 ? variantsArray : ['الخيار الافتراضي'],
        imageUrl: productForm.imageUrl.trim() || defaultImg,
        galleryImages: [productForm.imageUrl.trim() || defaultImg],
        description: productForm.description.trim(),
        featured: false,
        inStock: productForm.inStock,
      };
      onUpdateProducts([newP, ...products]);
      setSyncMessage('🎉 تم إضافة المنتج الجديد ونشره فورياً في متجرك!');
    }
    setIsProductModalOpen(false);
    setTimeout(() => setSyncMessage(null), 3000);
  };

  const handleDeleteProduct = (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا المنتج من متجرك؟')) {
      onUpdateProducts(products.filter((p) => p.id !== id));
      setSyncMessage('🗑️ تم حذف المنتج بنجاح');
      setTimeout(() => setSyncMessage(null), 2500);
    }
  };

  const handleToggleProductStock = (id: string) => {
    const updated = products.map((p) => (p.id === id ? { ...p, inStock: !p.inStock } : p));
    onUpdateProducts(updated);
  };

  const handleSaveSettingsForm = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(editableSettings);
    setSyncMessage('✅ تم حفظ إعدادات المتجر والشحن والدفع بنجاح!');
    setTimeout(() => setSyncMessage(null), 3000);
  };

  const filteredProductsList = products.filter((p) => {
    if (!productSearch.trim()) return true;
    const q = productSearch.toLowerCase().trim();
    return (
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-200">
      {/* Toast Alert */}
      {syncMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#0F172A] text-white text-xs sm:text-sm font-bold py-2.5 px-5 rounded-2xl shadow-xl flex items-center gap-2 animate-in zoom-in-95">
          <Sparkles className="w-4 h-4 text-[#86EFAC]" />
          <span>{syncMessage}</span>
        </div>
      )}

      {/* Top Banner: Storefront Link & Quick Actions */}
      <div 
        className="bg-white rounded-3xl p-6 sm:p-8 border shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
        style={{ borderColor: brand.neutralColor }}
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div 
              className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-white text-lg shadow-sm"
              style={{ backgroundColor: brand.primaryColor }}
            >
              {settings.logoLetter || 'S'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black" style={{ color: brand.primaryColor }}>
                  {settings.storeName}
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  متجر نشط · Live
                </span>
                {currentUser && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-[#2563EB] border border-blue-200 inline-flex items-center gap-1">
                    <span>المالك: {currentUser.name}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500">
                {settings.tagline}
              </p>
            </div>
          </div>

          {/* Store URL Bar */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-xs text-stone-500 font-bold">رابط متجرك للعملاء:</span>
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-mono" dir="ltr">
              <Link2 className="w-3.5 h-3.5 text-[#2563EB]" />
              <span className="text-stone-700 font-semibold">{storeUrl}</span>
            </div>

            <button
              onClick={handleCopyLink}
              className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="نسخ رابط المتجر"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'تم النسخ!' : 'نسخ الرابط'}</span>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleOpenAddProduct}
            className="px-4 py-2.5 bg-[#0F172A] hover:bg-stone-800 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center gap-1.5 shadow-xs transition-transform active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#86EFAC]" />
            <span>إضافة منتج جديد</span>
          </button>

          <button
            onClick={onViewStorefront}
            className="px-4 py-2.5 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-xs transition-transform active:scale-95 cursor-pointer"
            style={{ backgroundColor: brand.accentColor }}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>معاينة متجر الزبون</span>
          </button>

          <button
            onClick={onOpenBrandStudio}
            className="px-4 py-2.5 bg-white hover:bg-stone-50 text-stone-800 font-bold rounded-xl text-xs sm:text-sm border transition-colors flex items-center gap-1.5 cursor-pointer"
            style={{ borderColor: brand.neutralColor }}
          >
            <Palette className="w-4 h-4" style={{ color: brand.accentColor }} />
            <span>تخصيص الهوية</span>
          </button>

          <button
            onClick={onOpenNewStoreWizard}
            className="px-3.5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title="إنشاء متجر جديد"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">متجر جديد</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border shadow-xs" style={{ borderColor: brand.neutralColor }}>
          <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
            <span>إجمالي المبيعات</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono" style={{ color: brand.primaryColor }}>
            {totalRevenue.toLocaleString('en-US')} {settings.currency}
          </div>
          <span className="text-[10px] text-stone-400">مجموع الطلبات المسجلة</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border shadow-xs" style={{ borderColor: brand.neutralColor }}>
          <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
            <span>عدد الطلبات</span>
            <Package className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono" style={{ color: brand.primaryColor }}>
            {orders.length}
          </div>
          <span className="text-[10px] text-emerald-600 font-bold">{deliveredOrders} طلب مكتمل</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border shadow-xs" style={{ borderColor: brand.neutralColor }}>
          <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
            <span>المنتجات المتوفرة</span>
            <ShoppingBag className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono" style={{ color: brand.primaryColor }}>
            {inStockProducts}
          </div>
          <span className="text-[10px] text-stone-400">من أصل {products.length} منتج</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border shadow-xs" style={{ borderColor: brand.neutralColor }}>
          <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
            <span>طلبات الواتساب</span>
            <MessageCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono" style={{ color: brand.primaryColor }}>
            مفعّل
          </div>
          <span className="text-[10px] text-stone-400">إرسال فوري للفاتورة</span>
        </div>
      </div>

      {/* Simple 3-Tab Navigation for Business Owner */}
      <div className="flex items-center gap-2 border-b border-stone-200 pb-2 overflow-x-auto scrollbar-none text-xs sm:text-sm font-bold">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'text-white shadow-xs'
              : 'bg-white text-stone-600 hover:bg-stone-50 border'
          }`}
          style={{
            backgroundColor: activeTab === 'overview' ? brand.primaryColor : '#FFFFFF',
            borderColor: brand.neutralColor,
          }}
        >
          <TrendingUp className="w-4 h-4" />
          <span>إدارة الطلبات ({orders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'products'
              ? 'text-white shadow-xs'
              : 'bg-white text-stone-600 hover:bg-stone-50 border'
          }`}
          style={{
            backgroundColor: activeTab === 'products' ? brand.primaryColor : '#FFFFFF',
            borderColor: brand.neutralColor,
          }}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>المنتجات والمخزون ({products.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'settings'
              ? 'text-white shadow-xs'
              : 'bg-white text-stone-600 hover:bg-stone-50 border'
          }`}
          style={{
            backgroundColor: activeTab === 'settings' ? brand.primaryColor : '#FFFFFF',
            borderColor: brand.neutralColor,
          }}
        >
          <SettingsIcon className="w-4 h-4" />
          <span>إعدادات المتجر والشحن والسياسات</span>
        </button>
      </div>

      {/* TAB 1: ORDERS CRM */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-stone-900">سجل طلبات العملاء</h3>
            <span className="text-xs text-stone-500">
              تغيير حالة الطلب هنا يظهر مباشرة للعميل عند تتبع طلبه
            </span>
          </div>

          {orders.length === 0 ? (
            <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center space-y-2">
              <Package className="w-10 h-10 text-stone-300 mx-auto" />
              <h4 className="text-sm font-bold text-stone-800">لا توجد طلبات مسجلة حتى الآن</h4>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                شارك رابط متجرك مع عملائك، وستظهر جميع الطلبات الواردة هنا فور إتمامها.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border bg-white shadow-xs" style={{ borderColor: brand.neutralColor }}>
              <table className="w-full text-xs text-right divide-y divide-stone-200">
                <thead className="bg-slate-50 text-stone-700 font-bold">
                  <tr>
                    <th className="p-3">رقم الطلب</th>
                    <th className="p-3">العميل والجوال</th>
                    <th className="p-3">المدينة والعنوان</th>
                    <th className="p-3">المنتجات المطلوبة</th>
                    <th className="p-3">الإجمالي</th>
                    <th className="p-3">طريقة الدفع</th>
                    <th className="p-3">حالة الطلب</th>
                    <th className="p-3">ملاحظات الشحن / رقم البوليصة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {orders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-stone-50 transition-colors">
                      <td className="p-3 font-mono font-black text-[#2563EB]">#{ord.id}</td>
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
                        {ord.grandTotal.toLocaleString('en-US')} {settings.currency}
                      </td>
                      <td className="p-3 text-[11px] text-stone-600">{ord.paymentMethod}</td>
                      <td className="p-3">
                        <select
                          value={ord.status}
                          onChange={(e) => handleOrderStatusChange(ord.id, e.target.value as OrderStatus)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border focus:outline-none ${
                            ord.status === 'Delivered'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : ord.status === 'Out for Delivery'
                              ? 'bg-blue-50 text-blue-800 border-blue-300'
                              : ord.status === 'In Progress'
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : 'bg-stone-100 text-stone-800 border-stone-300'
                          }`}
                        >
                          <option value="Received">تم الاستلام</option>
                          <option value="In Progress">قيد التجهيز</option>
                          <option value="Out for Delivery">جاري التوصيل</option>
                          <option value="Delivered">تم التوصيل بنجاح</option>
                          <option value="Cancelled">ملغي</option>
                        </select>
                      </td>
                      <td className="p-3 min-w-[180px]">
                        <input
                          type="text"
                          value={ord.trackingNotes || ''}
                          onChange={(e) => {
                            const updated = orders.map((o) =>
                              o.id === ord.id ? { ...o, trackingNotes: e.target.value } : o
                            );
                            onUpdateOrders(updated);
                          }}
                          placeholder="رقم البوليصة أو ملاحظة..."
                          className="w-full px-2 py-1 text-xs bg-stone-50 border rounded focus:bg-white"
                          style={{ borderColor: brand.neutralColor }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PRODUCTS MANAGEMENT */}
      {activeTab === 'products' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-stone-900">
                كتالوج المنتجات ({products.length})
              </h3>
              <p className="text-xs text-stone-500">
                أي منتج تضيفه أو تعدله هنا يظهر مباشرة لزوار متجرك
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="ابحث بالاسم أو القسم..."
                  className="w-full pr-8 pl-3 py-2 text-xs bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                />
                <Search className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>

              <button
                onClick={handleOpenAddProduct}
                className="px-4 py-2 bg-[#2563EB] hover:bg-blue-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة منتج</span>
              </button>
            </div>
          </div>

          {/* Products Grid */}
          {filteredProductsList.length === 0 ? (
            <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-stone-800 text-sm">لا توجد منتجات حالياً</h4>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                {productSearch ? 'جرّب البحث بكلمة مختلفة' : 'ابدأ بإضافة أول منتج في متجرك الآن'}
              </p>
              <button
                onClick={handleOpenAddProduct}
                className="px-4 py-2 bg-[#2563EB] text-white font-bold rounded-xl text-xs inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة أول منتج</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProductsList.map((prod) => (
                <div
                  key={prod.id}
                  className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <div className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-stone-100 shrink-0 border border-stone-100">
                        <img
                          src={prod.imageUrl}
                          alt={prod.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as any).src =
                              'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80';
                          }}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 truncate">
                            {prod.category}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              prod.inStock
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {prod.inStock ? 'متوفر' : 'غير متوفر'}
                          </span>
                        </div>

                        <h4 className="font-bold text-stone-900 text-sm mt-1 truncate">
                          {prod.name}
                        </h4>

                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="font-black text-sm text-[#0F172A] font-mono">
                            {(prod.salePrice ?? prod.price).toLocaleString('en-US')} {settings.currency}
                          </span>
                          {prod.salePrice && (
                            <span className="text-xs text-stone-400 line-through font-mono">
                              {prod.price.toLocaleString('en-US')} {settings.currency}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {prod.description && (
                      <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">
                        {prod.description}
                      </p>
                    )}

                    {prod.variants && prod.variants.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {prod.variants.slice(0, 3).map((v, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-slate-50 text-[#0F172A] border border-stone-200"
                          >
                            {v}
                          </span>
                        ))}
                        {prod.variants.length > 3 && (
                          <span className="text-[10px] text-stone-400 self-center">
                            +{prod.variants.length - 3} أخرى
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="px-4 py-2.5 bg-stone-50 border-t border-stone-100 flex items-center justify-between text-xs">
                    <button
                      onClick={() => handleToggleProductStock(prod.id)}
                      className={`text-[11px] font-bold transition-colors cursor-pointer ${
                        prod.inStock ? 'text-stone-500 hover:text-stone-800' : 'text-emerald-600 font-bold'
                      }`}
                    >
                      {prod.inStock ? 'تعيين كغير متوفر' : 'تعيين كمتوفر الآن'}
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditProduct(prod)}
                        className="p-1.5 text-stone-600 hover:text-[#2563EB] hover:bg-white rounded-lg transition-colors cursor-pointer"
                        title="تعديل المنتج"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteProduct(prod.id)}
                        className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                        title="حذف المنتج"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: STORE SETTINGS, SHIPPING, BANK DETAILS & POLICIES */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
          <form onSubmit={handleSaveSettingsForm} className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <div className="bg-white p-6 rounded-3xl border border-stone-200 space-y-4">
              <h3 className="text-sm font-bold text-stone-900 border-b border-stone-100 pb-2">
                بيانات المتجر والتواصل
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">اسم المتجر</label>
                  <input
                    type="text"
                    required
                    value={editableSettings.storeName}
                    onChange={(e) => setEditableSettings({ ...editableSettings, storeName: e.target.value })}
                    className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">العملة</label>
                  <input
                    type="text"
                    value={editableSettings.currency}
                    onChange={(e) => setEditableSettings({ ...editableSettings, currency: e.target.value })}
                    className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">رقم الواتساب لاستقبال الطلبات (دولي بدون +)</label>
                  <input
                    type="text"
                    value={editableSettings.whatsappNumber}
                    onChange={(e) => setEditableSettings({ ...editableSettings, whatsappNumber: e.target.value })}
                    placeholder="9665XXXXXXXX"
                    className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-mono"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">البريد الإلكتروني لخدمة العملاء</label>
                  <input
                    type="email"
                    value={editableSettings.supportEmail}
                    onChange={(e) => setEditableSettings({ ...editableSettings, supportEmail: e.target.value })}
                    className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="text-xs">
                <label className="block font-bold text-stone-700 mb-1">وصف المتجر (Tagline)</label>
                <input
                  type="text"
                  value={editableSettings.tagline}
                  onChange={(e) => setEditableSettings({ ...editableSettings, tagline: e.target.value })}
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl"
                />
              </div>

              <div className="text-xs">
                <label className="block font-bold text-stone-700 mb-1">شريط الإعلانات العلوي</label>
                <input
                  type="text"
                  value={editableSettings.announcementText}
                  onChange={(e) => setEditableSettings({ ...editableSettings, announcementText: e.target.value })}
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl"
                />
              </div>
            </div>

            {/* Shipping & Bank Transfer */}
            <div className="bg-white p-6 rounded-3xl border border-stone-200 space-y-4">
              <h3 className="text-sm font-bold text-stone-900 border-b border-stone-100 pb-2">
                إعدادات الشحن والتحويل البنكي
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    رسوم الشحن العادية ({editableSettings.currency})
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editableSettings.standardShippingRate}
                    onChange={(e) =>
                      setEditableSettings({
                        ...editableSettings,
                        standardShippingRate: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    الحد الأدنى للشحن المجاني ({editableSettings.currency})
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editableSettings.freeShippingThreshold}
                    onChange={(e) =>
                      setEditableSettings({
                        ...editableSettings,
                        freeShippingThreshold: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">اسم البنك (للتحويل البنكي)</label>
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
                    className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">اسم صاحب الحساب / المؤسسة</label>
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
                    className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-stone-700 mb-1">رقم الآيبان (IBAN)</label>
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
                    className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#2563EB] hover:bg-blue-600 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>حفظ إعدادات المتجر</span>
                </button>
              </div>
            </div>
          </form>

          {/* Store Policies Column */}
          <div className="bg-white p-6 rounded-3xl border border-stone-200 space-y-4 h-fit">
            <h3 className="text-sm font-bold text-stone-900 border-b border-stone-100 pb-2">
              سياسات المتجر والضمان
            </h3>
            <p className="text-xs text-stone-500">
              تظهر هذه السياسات للعملاء عند النقر على أيقونة السياسات في المتجر:
            </p>
            <div className="space-y-3">
              {policies.map((pol, idx) => (
                <div key={pol.id} className="space-y-1">
                  <label className="block text-xs font-bold text-stone-800">{pol.title}</label>
                  <textarea
                    rows={3}
                    value={pol.content}
                    onChange={(e) => {
                      const updated = [...policies];
                      updated[idx] = { ...pol, content: e.target.value };
                      onUpdatePolicies(updated);
                    }}
                    className="w-full p-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl leading-relaxed focus:bg-white focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT PRODUCT */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-stone-950/70 backdrop-blur-xs">
          <div className="fixed inset-0" onClick={() => setIsProductModalOpen(false)} aria-hidden="true" />

          <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden z-10 border border-stone-200 my-auto p-6 sm:p-8 space-y-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#0F172A] text-white flex items-center justify-center font-bold text-lg shadow-sm">
                  <ShoppingBag className="w-5 h-5 text-[#86EFAC]" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-stone-900">
                    {editingProduct ? 'تعديل بيانات المنتج' : 'إضافة منتج جديد للمتجر'}
                  </h3>
                  <p className="text-xs text-stone-500">
                    أدخل تفاصيل المنتج وسينعكس التحديث مباشرة في واجهة المتجر
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsProductModalOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-100 text-stone-600 hover:text-stone-900 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">
                    اسم المنتج <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    placeholder="مثال: عطر عود ملكي 100 مل"
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-800 mb-1">القسم / الفئة</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={productForm.category}
                      onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                      placeholder="مثال: عطور، ساعات، إكسسوارات..."
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                    />
                    <Tag className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-3 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">
                    السعر الأساسي ({settings.currency}) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-800 mb-1">
                    سعر الخصم الاختياري ({settings.currency})
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={productForm.salePrice}
                    onChange={(e) => setProductForm({ ...productForm, salePrice: Number(e.target.value) })}
                    placeholder="اتركه 0 إذا لم يوجد خصم"
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-800 mb-1">
                  المقاسات أو الخيارات المتاحة (مفصولة بفاصلة)
                </label>
                <input
                  type="text"
                  value={productForm.variants}
                  onChange={(e) => setProductForm({ ...productForm, variants: e.target.value })}
                  placeholder="مثال: صغير، وسط، كبير (أو: أسود، أبيض)"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-800 mb-1">رابط صورة المنتج (Image URL)</label>
                <input
                  type="url"
                  value={productForm.imageUrl}
                  onChange={(e) => setProductForm({ ...productForm, imageUrl: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-800 mb-1">وصف المنتج ومميزاته</label>
                <textarea
                  rows={3}
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  placeholder="اكتب وصفاً واضحاً للمنتج، الخامات، أو المميزات..."
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={productForm.inStock}
                    onChange={(e) => setProductForm({ ...productForm, inStock: e.target.checked })}
                    className="rounded text-[#2563EB]"
                  />
                  <span className="font-bold text-stone-800">المنتج متوفر في المخزون وجاهز للطلب</span>
                </label>
              </div>

              <div className="pt-4 border-t border-stone-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#2563EB] hover:bg-blue-600 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingProduct ? 'حفظ التعديلات' : 'إضافة المنتج للمتجر'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
