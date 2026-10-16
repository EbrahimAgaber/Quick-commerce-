import React, { useState } from 'react';
import { StoreSettings, Product, Order, StorePolicy, OrderStatus, MerchantUser } from '../../types/store';
import { SheetSimulator } from '../admin/SheetSimulator';
import { AppsScriptHub } from '../admin/AppsScriptHub';
import { 
  Store, 
  ExternalLink, 
  Copy, 
  Check, 
  Share2, 
  RefreshCw, 
  Table, 
  ShoppingBag, 
  Package, 
  TrendingUp, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  Truck, 
  Plus, 
  Palette, 
  Sliders, 
  Code2, 
  Sparkles,
  Link2,
  Phone,
  MessageCircle,
  FileSpreadsheet,
  Edit3,
  Trash2,
  Search,
  Eye,
  UserCheck,
  X,
  Tag,
  Globe
} from 'lucide-react';

interface StoreDashboardProps {
  settings: StoreSettings;
  products: Product[];
  orders: Order[];
  policies: StorePolicy[];
  onUpdateSettings: (newSettings: StoreSettings) => void;
  onUpdateProducts: (newProducts: Product[]) => void;
  onUpdateOrders: (newOrders: Order[]) => void;
  onUpdatePolicies: (newPolicies: StorePolicy[]) => void;
  onResetDefault: () => void;
  onViewStorefront: () => void;
  onOpenBrandStudio: () => void;
  onOpenNewStoreWizard: () => void;
  onSyncLiveData: (data: any) => void;
  currentUser?: MerchantUser | null;
  onOpenAuth?: () => void;
  onOpenFreeHosting?: () => void;
}

export const StoreDashboard: React.FC<StoreDashboardProps> = ({
  settings,
  products,
  orders,
  policies,
  onUpdateSettings,
  onUpdateProducts,
  onUpdateOrders,
  onUpdatePolicies,
  onResetDefault,
  onViewStorefront,
  onOpenBrandStudio,
  onOpenNewStoreWizard,
  onSyncLiveData,
  currentUser,
  onOpenAuth,
  onOpenFreeHosting,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'sheet' | 'script'>('overview');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Product Management Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    category: 'حلول واستشارات',
    price: 150,
    salePrice: 120,
    variants: 'جلسة ساعة واحدة, باقة 3 جلسات, مراجعة شاملة للمشروع',
    imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80',
    description: '',
    inStock: true,
  });

  const brand = settings.brandTheme || {
    primaryColor: '#0B253F',
    accentColor: '#0077FF',
    highlightColor: '#A5F3B6',
    backgroundColor: '#F8F3ED',
    neutralColor: '#E4E7EB',
    textColor: '#0B253F',
  };

  const storeSlug = settings.storeName.toLowerCase().replace(/\s+/g, '-');
  const storeUrl = typeof window !== 'undefined' && window.location.origin 
    ? `${window.location.origin}?store=${storeSlug}` 
    : `https://quick-ecommerce.app/?store=${storeSlug}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(storeUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleManualSync = () => {
    setIsSyncing(true);
    setSyncMessage(null);
    setTimeout(() => {
      setIsSyncing(false);
      setSyncMessage('✅ تمت مزامنة كافة بيانات المتجر بنجاح مع جدول Google Sheets!');
      setTimeout(() => setSyncMessage(null), 3500);
    }, 800);
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
      category: 'حلول واستشارات',
      price: 150,
      salePrice: 120,
      variants: 'جلسة ساعة واحدة, باقة 3 جلسات, مراجعة شاملة للمشروع',
      imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80',
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

    if (editingProduct) {
      const updated = products.map((p) =>
        p.id === editingProduct.id
          ? {
              ...p,
              name: productForm.name.trim(),
              category: productForm.category.trim(),
              price: Number(productForm.price) || 0,
              salePrice: productForm.salePrice ? Number(productForm.salePrice) : undefined,
              variants: variantsArray.length > 0 ? variantsArray : ['الخيار الافتراضي'],
              imageUrl: productForm.imageUrl.trim() || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80',
              description: productForm.description.trim(),
              inStock: productForm.inStock,
            }
          : p
      );
      onUpdateProducts(updated);
      setSyncMessage('✨ تم تحديث بيانات المنتج ومزامنتها مع المتجر وجدول البيانات!');
    } else {
      const newP: Product = {
        id: `prod-${Date.now()}`,
        name: productForm.name.trim(),
        category: productForm.category.trim() || 'عام',
        price: Number(productForm.price) || 0,
        salePrice: productForm.salePrice ? Number(productForm.salePrice) : undefined,
        variants: variantsArray.length > 0 ? variantsArray : ['الخيار الافتراضي'],
        imageUrl: productForm.imageUrl.trim() || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80',
        galleryImages: [productForm.imageUrl.trim()],
        description: productForm.description.trim(),
        featured: false,
        inStock: productForm.inStock,
      };
      onUpdateProducts([newP, ...products]);
      setSyncMessage('🎉 تم إضافة المنتج الجديد ونشره فورياً في متجرك الإلكتروني!');
    }
    setIsProductModalOpen(false);
    setTimeout(() => setSyncMessage(null), 3000);
  };

  const handleDeleteProduct = (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا المنتج من قاعدة البيانات؟')) {
      onUpdateProducts(products.filter((p) => p.id !== id));
      setSyncMessage('🗑️ تم حذف المنتج بنجاح');
      setTimeout(() => setSyncMessage(null), 2500);
    }
  };

  const handleToggleProductStock = (id: string) => {
    const updated = products.map((p) => (p.id === id ? { ...p, inStock: !p.inStock } : p));
    onUpdateProducts(updated);
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
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#0B253F] text-white text-xs sm:text-sm font-bold py-2.5 px-5 rounded-2xl shadow-xl flex items-center gap-2 animate-in zoom-in-95">
          <Sparkles className="w-4 h-4 text-[#A5F3B6]" />
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
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black" style={{ color: brand.primaryColor }}>
                  {settings.storeName}
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  متجر نشط · Live
                </span>
                {currentUser && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-[#0077FF] border border-blue-200 inline-flex items-center gap-1">
                    {currentUser.avatarUrl ? (
                      <img src={currentUser.avatarUrl} alt="" className="w-3.5 h-3.5 rounded-full object-cover" />
                    ) : null}
                    <span>المالك: {currentUser.name}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500">
                {settings.tagline} · هاتف المتجر: <strong dir="ltr">{settings.supportPhone}</strong>
              </p>
            </div>
          </div>

          {/* Store URL Bar */}
          <div className="flex items-center gap-2 pt-2">
            <span className="text-xs text-stone-400 font-medium">رابط متجرك:</span>
            <div className="flex items-center gap-1.5 bg-[#F8F3ED] px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-mono">
              <Link2 className="w-3.5 h-3.5 text-[#0077FF]" />
              <span className="text-stone-700 font-semibold">{storeUrl}</span>
            </div>

            <button
              onClick={handleCopyLink}
              className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 transition-colors"
              title="نسخ الرابط"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleOpenAddProduct}
            className="px-4 py-2.5 bg-[#0B253F] hover:bg-stone-800 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center gap-1.5 shadow-xs transition-transform active:scale-95"
          >
            <Plus className="w-4 h-4 text-[#A5F3B6]" />
            <span>إضافة منتج جديد</span>
          </button>

          <button
            onClick={onViewStorefront}
            className="px-4 py-2.5 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-xs transition-transform active:scale-95"
            style={{ backgroundColor: brand.accentColor }}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>معاينة متجر الزائر</span>
          </button>

          <button
            onClick={onOpenBrandStudio}
            className="px-4 py-2.5 bg-white hover:bg-stone-50 text-stone-800 font-bold rounded-xl text-xs sm:text-sm border transition-colors flex items-center gap-1.5"
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

          {onOpenFreeHosting && (
            <button
              onClick={onOpenFreeHosting}
              className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold rounded-xl text-xs sm:text-sm flex items-center gap-1.5 transition-colors cursor-pointer"
              title="دليل النشر والاستضافة المجانية"
            >
              <Globe className="w-4 h-4 text-emerald-600" />
              <span>استضافة مجانية 100%</span>
            </button>
          )}
        </div>
      </div>

      {/* Google Sheets Connection Status Card (The Core Reverse-Engineered Feature) */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-white rounded-3xl p-6 border border-emerald-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-emerald-950">
                قاعدة بيانات Google Sheets المتصلة بالمتجر (Sheet-to-Storefront Backend)
              </h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-900">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                متصل ومزامن لحظياً
              </span>
            </div>
            <p className="text-xs text-stone-600 max-w-2xl leading-relaxed">
              يعمل جدول البيانات كقاعدة بيانات خلفية مباشرة. عند تعديل الأسعار، إضافة منتجات، أو تحديث حالات الطلبات، ينعكس التغيير فورياً على المتجر دون الحاجة لخوادم وسيطة أو اشتراكات.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'جاري المزامنة...' : 'مزامنة الآن'}</span>
          </button>

          <button
            onClick={() => setActiveTab('sheet')}
            className="px-3.5 py-2 bg-white hover:bg-stone-50 text-emerald-900 border border-emerald-300 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
          >
            <Table className="w-3.5 h-3.5 text-emerald-700" />
            <span>فتح جدول البيانات</span>
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
            <span>تحويلات الواتساب</span>
            <MessageCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono" style={{ color: brand.primaryColor }}>
            100%
          </div>
          <span className="text-[10px] text-stone-400">طلب فوري مع فاتورة جاهزة</span>
        </div>
      </div>

      {/* Navigation Tabs for Owner */}
      <div className="flex items-center gap-1.5 border-b border-stone-200 pb-2 overflow-x-auto scrollbar-none text-xs sm:text-sm font-bold">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
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
          <span>لوحة الطلبات الحديثة (Orders CRM)</span>
        </button>

        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
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
          <span>إدارة المنتجات ({products.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('sheet')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
            activeTab === 'sheet'
              ? 'text-white shadow-xs'
              : 'bg-white text-stone-600 hover:bg-stone-50 border'
          }`}
          style={{
            backgroundColor: activeTab === 'sheet' ? brand.primaryColor : '#FFFFFF',
            borderColor: brand.neutralColor,
          }}
        >
          <Table className="w-4 h-4" />
          <span>جدول البيانات الكامل (Google Sheet Simulator)</span>
        </button>

        <button
          onClick={() => setActiveTab('script')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
            activeTab === 'script'
              ? 'text-white shadow-xs'
              : 'bg-white text-stone-600 hover:bg-stone-50 border'
          }`}
          style={{
            backgroundColor: activeTab === 'script' ? brand.primaryColor : '#FFFFFF',
            borderColor: brand.neutralColor,
          }}
        >
          <Code2 className="w-4 h-4" />
          <span>كود Apps Script والربط المباشر</span>
        </button>
      </div>

      {/* TAB 1: ORDERS CRM */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-stone-900">أحدث الطلبات الواردة عبر المتجر</h3>
            <span className="text-xs text-stone-500">
              تغيير الحالة هنا يُحدّث نظام تتبع العميل فورياً
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border bg-white shadow-xs" style={{ borderColor: brand.neutralColor }}>
            <table className="w-full text-xs text-right divide-y divide-stone-200">
              <thead className="bg-[#F8F3ED] text-stone-700 font-bold">
                <tr>
                  <th className="p-3">رقم الطلب</th>
                  <th className="p-3">العميل والجوال</th>
                  <th className="p-3">المدينة والعنوان</th>
                  <th className="p-3">المنتجات المطلوبة</th>
                  <th className="p-3">الإجمالي</th>
                  <th className="p-3">طريقة الدفع</th>
                  <th className="p-3">حالة الطلب (تحديث فوري)</th>
                  <th className="p-3">ملاحظات التتبع / رقم البوليصة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {orders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-stone-50 transition-colors">
                    <td className="p-3 font-mono font-black text-[#0077FF]">#{ord.id}</td>
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
                        <option value="In Progress">قيد التجهيز والتفصيل</option>
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
                        placeholder="رقم البوليصة أو ملاحظة المندوب..."
                        className="w-full px-2 py-1 text-xs bg-stone-50 border rounded focus:bg-white"
                        style={{ borderColor: brand.neutralColor }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PRODUCTS MANAGEMENT */}
      {activeTab === 'products' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-stone-900">
                إدارة كتالوج المنتجات والخدمات ({products.length})
              </h3>
              <p className="text-xs text-stone-500">
                يتم مزامنة أي تعديل فورياً مع متجر الزائر وجدول بيانات Google Sheet
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="ابحث بالاسم أو الفئة..."
                  className="w-full pr-8 pl-3 py-2 text-xs bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0077FF]/30"
                />
                <Search className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>

              <button
                onClick={handleOpenAddProduct}
                className="px-4 py-2 bg-[#0077FF] hover:bg-blue-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs shrink-0"
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
              <h4 className="font-bold text-stone-800 text-sm">لم يتم العثور على أي منتجات</h4>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                {productSearch ? 'جرّب البحث بكلمة مختلفة' : 'أضف أول منتج في متجرك الآن أو استورد من جدول Google Sheets'}
              </p>
              <button
                onClick={handleOpenAddProduct}
                className="px-4 py-2 bg-[#0077FF] text-white font-bold rounded-xl text-xs inline-flex items-center gap-1.5 shadow-xs"
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
                              'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80';
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
                          <span className="font-black text-sm text-[#0B253F] font-mono">
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
                            className="text-[10px] px-2 py-0.5 rounded-md bg-[#F8F3ED] text-[#0B253F] border border-stone-200"
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
                      className={`text-[11px] font-bold transition-colors ${
                        prod.inStock ? 'text-stone-500 hover:text-stone-800' : 'text-emerald-600 font-bold'
                      }`}
                    >
                      {prod.inStock ? 'تعيين كغير متوفر' : 'تعيين كمتوفر الآن'}
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditProduct(prod)}
                        className="p-1.5 text-stone-600 hover:text-[#0077FF] hover:bg-white rounded-lg transition-colors"
                        title="تعديل المنتج"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteProduct(prod.id)}
                        className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-white rounded-lg transition-colors"
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

      {/* TAB 3: SHEET SIMULATOR */}
      {activeTab === 'sheet' && (
        <SheetSimulator
          settings={settings}
          products={products}
          orders={orders}
          policies={policies}
          onUpdateSettings={onUpdateSettings}
          onUpdateProducts={onUpdateProducts}
          onUpdateOrders={onUpdateOrders}
          onUpdatePolicies={onUpdatePolicies}
          onResetDefault={onResetDefault}
          onSwitchToStore={onViewStorefront}
          onOpenAppsScriptHub={() => setActiveTab('script')}
          onOpenBrandStudio={onOpenBrandStudio}
        />
      )}

      {/* TAB 4: APPS SCRIPT CODE & LIVE CONNECTOR */}
      {activeTab === 'script' && (
        <AppsScriptHub
          settings={settings}
          onUpdateSettings={onUpdateSettings}
          onSyncLiveData={onSyncLiveData}
        />
      )}

      {/* MODAL: ADD / EDIT PRODUCT */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-stone-950/70 backdrop-blur-xs">
          <div className="fixed inset-0" onClick={() => setIsProductModalOpen(false)} aria-hidden="true" />

          <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden z-10 border border-stone-200 my-auto p-6 sm:p-8 space-y-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#0B253F] text-white flex items-center justify-center font-bold text-lg shadow-sm">
                  <ShoppingBag className="w-5 h-5 text-[#A5F3B6]" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-[#0B253F]">
                    {editingProduct ? 'تعديل بيانات المنتج' : 'إضافة منتج جديد للمتجر'}
                  </h3>
                  <p className="text-xs text-stone-500">
                    ينعكس مباشرة في متجر الزائر وجدول بيانات Google Sheets
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsProductModalOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-100 text-stone-600 hover:text-stone-900 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-stone-800 mb-1">
                  اسم المنتج أو الخدمة <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  placeholder="مثال: استشارة هندسية، باقة متجر رقمي، عباية حرير..."
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0077FF]/30"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">
                    التصنيف / الفئة <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                    placeholder="مثال: استشارات، منتجات رقمية، أزياء..."
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-xs focus:outline-none"
                  />
                </div>

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
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">
                    سعر التخفيض (اختياري)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={productForm.salePrice || ''}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        salePrice: e.target.value ? Number(e.target.value) : 0,
                      })
                    }
                    placeholder="اتركه فارغاً إن لم يكن هناك خصم"
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-800 mb-1">
                    حالة التوفر
                  </label>
                  <label className="flex items-center gap-2 p-2.5 bg-stone-50 rounded-xl border border-stone-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={productForm.inStock}
                      onChange={(e) => setProductForm({ ...productForm, inStock: e.target.checked })}
                      className="w-4 h-4 text-[#0077FF] rounded"
                    />
                    <span className="font-semibold text-stone-800">متوفر للطلب في المتجر</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-800 mb-1">
                  الخيارات أو المقاسات (مفصولة بفاصلة)
                </label>
                <input
                  type="text"
                  value={productForm.variants}
                  onChange={(e) => setProductForm({ ...productForm, variants: e.target.value })}
                  placeholder="مثال: جلسة ساعة, باقة 3 جلسات, أو S, M, L"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-800 mb-1">
                  رابط صورة المنتج (URL)
                </label>
                <input
                  type="url"
                  value={productForm.imageUrl}
                  onChange={(e) => setProductForm({ ...productForm, imageUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-xs font-mono focus:outline-none"
                />

                {/* Preset image suggestions */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-stone-400">نماذج سريعة:</span>
                  {[
                    { label: 'استشارات تقنية', url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80' },
                    { label: 'هندسة وعمليات', url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80' },
                    { label: 'تطوير وبرمجة', url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80' },
                    { label: 'أزياء وعبايات', url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80' },
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setProductForm({ ...productForm, imageUrl: preset.url })}
                      className="text-[10px] px-2 py-0.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-800 mb-1">
                  وصف المنتج أو تفاصيل الخدمة
                </label>
                <textarea
                  rows={3}
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  placeholder="اكتب مواصفات المنتج، طريقة التسليم، أو ما يشمله العرض..."
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-xs focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 text-stone-600 hover:text-stone-900 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#0077FF] hover:bg-blue-600 text-white font-bold rounded-xl shadow-xs transition-transform active:scale-95"
                >
                  {editingProduct ? 'حفظ التعديلات' : 'نشر المنتج الآن'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
