import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StoreSettings, Product, Order, StorePolicy, OrderStatus, MerchantUser, PromoCode } from '../../types/store';
import { compressImageFile } from '../../utils/imageUploader';
import { requestAIGeneration } from '../../services/aiService';
import { CloudSyncStatus } from '../../services/storeManager';
import { AuthService } from '../../services/authService';
import { InvoiceModal } from '../storefront/InvoiceModal';
import { DriverSettlementModal } from '../driver/DriverSettlementModal';
import { playOrderNotificationSound } from '../../services/notificationService';
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
  Save,
  Upload,
  Download,
  Eye,
  Cloud,
  CloudOff,
  Loader2,
  Wand2,
  Percent,
  Star,
  AlertCircle,
  Truck,
  RotateCcw,
  FileText,
  Bell,
  MapPin
} from 'lucide-react';

interface StoreDashboardProps {
  storeId?: string;
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
  storeId,
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
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>('synced');

  // Listen to cloud sync events from StoreManager
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === 'string') {
        setCloudSyncStatus(detail as CloudSyncStatus);
      } else if (detail?.status) {
        setCloudSyncStatus(detail.status);
      }
    };
    window.addEventListener('storelink_sync_status', handler);
    return () => window.removeEventListener('storelink_sync_status', handler);
  }, []);

  // Editable Settings & Policies State (prevents per-keystroke Firestore writes)
  const [editableSettings, setEditableSettings] = useState<StoreSettings>({ ...settings });
  const [editablePolicies, setEditablePolicies] = useState<StorePolicy[]>([...policies]);

  useEffect(() => {
    setEditableSettings({ ...settings });
  }, [settings]);

  useEffect(() => {
    setEditablePolicies([...policies]);
  }, [policies]);

  // Orders Filter, Search, Local Tracking Notes & Detail Modal
  const [orderStatusFilter, setOrderStatusFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<Order | null>(null);
  const [localTrackingNotes, setLocalTrackingNotes] = useState<Record<string, string>>({});
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);
  const [isSettlementOpen, setIsSettlementOpen] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [courierForm, setCourierForm] = useState({
    courierName: '',
    courierPhone: '',
    trackingNumber: '',
    trackingUrl: '',
  });
  const [newOrderBanner, setNewOrderBanner] = useState<string | null>(null);

  // Sync courierForm when an order is selected
  useEffect(() => {
    if (selectedOrderDetail) {
      setCourierForm({
        courierName: selectedOrderDetail.courierName || '',
        courierPhone: selectedOrderDetail.courierPhone || '',
        trackingNumber: selectedOrderDetail.trackingNumber || '',
        trackingUrl: selectedOrderDetail.trackingUrl || '',
      });
    }
  }, [selectedOrderDetail]);

  // Real-time audio chime when new orders arrive
  const prevOrdersCountRef = useRef<number>(orders.length);
  useEffect(() => {
    if (orders.length > prevOrdersCountRef.current) {
      playOrderNotificationSound();
      const latest = orders[0];
      setNewOrderBanner(`وصل طلب جديد #${latest?.id || ''} بقيمة ${latest?.grandTotal || 0} ${editableSettings.currency}`);
      setTimeout(() => setNewOrderBanner(null), 6000);
    }
    prevOrdersCountRef.current = orders.length;
  }, [orders.length, editableSettings.currency]);

  // Promo Code Creation Form State
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoType, setNewPromoType] = useState<'percentage' | 'fixed'>('percentage');
  const [newPromoValue, setNewPromoValue] = useState<number>(10);
  const [newPromoMinOrder] = useState<number>(0);

  // Product Management Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productFormError, setProductFormError] = useState<string | null>(null);
  const [uploadingProductImg, setUploadingProductImg] = useState(false);
  const [uploadingStoreLogo, setUploadingStoreLogo] = useState(false);
  const [generatingProductAI, setGeneratingProductAI] = useState(false);
  const [extraGalleryUrl, setExtraGalleryUrl] = useState('');

  const [productForm, setProductForm] = useState({
    name: '',
    category: 'منتجات مميزة',
    price: 150,
    salePrice: 0,
    variants: 'الخيار الأساسي',
    imageUrl: '',
    galleryImages: [] as string[],
    description: '',
    inStock: true,
    stockQuantity: '' as string | number,
    featured: false,
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
    : `https://quick-ecommerce-saas-app.web.app/?store=${encodeURIComponent(cleanSlug)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(storeUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Accurate Metrics (Excludes Cancelled orders from Revenue)
  const validOrders = useMemo(() => orders.filter((o) => o.status !== 'Cancelled'), [orders]);
  const totalRevenue = useMemo(() => validOrders.reduce((sum, o) => sum + o.grandTotal, 0), [validOrders]);
  const deliveredOrders = useMemo(() => orders.filter((o) => o.status === 'Delivered').length, [orders]);
  const inStockProducts = useMemo(() => products.filter((p) => p.inStock).length, [products]);

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
      (o.items || []).forEach((item) => {
        const id = item.productId || item.name;
        if (!map[id]) map[id] = { name: item.name, qty: 0, revenue: 0 };
        map[id].qty += item.quantity;
        map[id].revenue += item.price * item.quantity;
      });
    });
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [validOrders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
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
  }, [orders, orderStatusFilter, orderSearchQuery]);

  const handleOrderStatusChange = (orderId: string, newStatus: OrderStatus) => {
    const updated = orders.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o));
    onUpdateOrders(updated);
    setSyncMessage('📦 تم تحديث حالة الطلب بنجاح');
    setTimeout(() => setSyncMessage(null), 2000);
  };

  const handleCommitTrackingNote = (orderId: string) => {
    const note = localTrackingNotes[orderId];
    if (note === undefined) return;
    const existing = orders.find((o) => o.id === orderId)?.trackingNotes || '';
    if (note === existing) return;
    const updated = orders.map((o) => (o.id === orderId ? { ...o, trackingNotes: note } : o));
    onUpdateOrders(updated);
    setSyncMessage('📝 تم حفظ ملاحظات الشحن / البوليصة');
    setTimeout(() => setSyncMessage(null), 2000);
  };

  const handleSaveCourierDetails = (orderId: string) => {
    const updated = orders.map((o) => (o.id === orderId ? {
      ...o,
      courierName: courierForm.courierName,
      courierPhone: courierForm.courierPhone,
      trackingNumber: courierForm.trackingNumber,
      trackingUrl: courierForm.trackingUrl,
    } : o));
    onUpdateOrders(updated);
    if (selectedOrderDetail && selectedOrderDetail.id === orderId) {
      setSelectedOrderDetail({
        ...selectedOrderDetail,
        courierName: courierForm.courierName,
        courierPhone: courierForm.courierPhone,
        trackingNumber: courierForm.trackingNumber,
        trackingUrl: courierForm.trackingUrl,
      });
    }
    setSyncMessage('🚚 تم حفظ وتحديث بيانات الشحن والتوصيل بنجاح');
    setTimeout(() => setSyncMessage(null), 2500);
  };

  const handleDispatchToDriver = (order: Order) => {
    const driverPhone = editableSettings.driverPhone || order.courierPhone || prompt('أدخل رقم جوال المندوب (مثال: 9665XXXXXXXX):');
    if (!driverPhone) return;

    const cleanPhone = driverPhone.replace(/[^0-9]/g, '');
    const origin = window.location.origin;
    const driverLink = `${origin}/?driver=${order.id}`;

    const isCOD = order.paymentMethod.toLowerCase().includes('cod') || order.paymentMethod.includes('استلام');
    const paymentStatus = isCOD 
      ? `💵 الدفع عند الاستلام (COD): تحصيل ${order.grandTotal} ${editableSettings.currency}`
      : `✅ مدفوع إلكترونياً مسبقاً (لا يُحصّل من العميل)`;

    let msg = `🚚 *مهمة توصيل جديدة - متجر ${editableSettings.storeName}*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📦 *رقم الطلب:* #${order.id}\n`;
    if (editableSettings.storeLocationUrl) {
      msg += `📍 *موقع استلام الشحنة (المحل):* ${editableSettings.storeLocationUrl}\n`;
    }
    msg += `👤 *العميل:* ${order.customerName}\n`;
    msg += `📱 *جوال العميل:* ${order.customerPhone}\n`;
    msg += `🏠 *العنوان:* ${order.city} - ${order.deliveryAddress}\n`;
    if (order.googleMapsUrl) {
      msg += `🗺️ *موقع العميل (Google Maps):* ${order.googleMapsUrl}\n`;
    }
    if (order.landmarkNotes) {
      msg += `📝 *ملاحظات:* ${order.landmarkNotes}\n`;
    }
    msg += `💰 *حالة التحصيل:* ${paymentStatus}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🔗 *رابط مسار التوصيل المباشر للمندوب:* \n${driverLink}\n`;
    msg += `(افتح الرابط بدون الحاجة لتحميل تطبيق لتأكيد الاستلام والتسليم بنقرة واحدة)`;

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');

    // If order was Received or In Progress, transition to Out for Delivery
    if (order.status === 'Received' || order.status === 'In Progress') {
      handleOrderStatusChange(order.id, 'Out for Delivery');
      if (selectedOrderDetail && selectedOrderDetail.id === order.id) {
        setSelectedOrderDetail({ ...selectedOrderDetail, status: 'Out for Delivery' });
      }
    }
  };

  const handleRefundOrder = async (order: Order) => {
    if (!window.confirm(`هل أنت متأكد من رغبتك في استرجاع مبلغ ${order.grandTotal} ${editableSettings.currency} للطلب #${order.id} عبر ميسر؟`)) {
      return;
    }
    setIsRefunding(true);
    try {
      const token = await AuthService.getIdToken();
      const res = await fetch('/api/refundOrder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          storeId: storeId || storeSlug,
          orderId: order.id,
          amount: order.grandTotal,
          reason: 'طلب استرجاع من التاجر عبر لوحة التحكم',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`فشل الاسترجاع: ${data.error || 'حدث خطأ أثناء معالجة الاسترجاع'}`);
        return;
      }
      const updated = orders.map((o) => (o.id === order.id ? { ...o, status: 'Cancelled' as OrderStatus } : o));
      onUpdateOrders(updated);
      if (selectedOrderDetail && selectedOrderDetail.id === order.id) {
        setSelectedOrderDetail({ ...selectedOrderDetail, status: 'Cancelled' });
      }
      alert('تم استرجاع المبلغ بنجاح عبر ميسر وتحديث حالة الطلب إلى ملغي.');
    } catch (err: any) {
      alert(`فشل الاسترجاع: ${err?.message || 'خطأ في الاتصال بالسيرفر'}`);
    } finally {
      setIsRefunding(false);
    }
  };

  const handleExportOrdersCSV = () => {
    if (orders.length === 0) return;
    const headers = [
      'رقم الطلب',
      'التاريخ',
      'اسم العميل',
      'رقم الجوال',
      'المدينة',
      'العنوان',
      'المنتجات',
      'الإجمالي الفرعي',
      'الشحن',
      'كود الخصم',
      'قيمة الخصم',
      'الإجمالي النهائي',
      'طريقة الدفع',
      'حالة الطلب',
      'ملاحظات الشحن',
    ];
    const escapeCell = (val: unknown) => {
      const str = String(val ?? '').replace(/"/g, '""');
      return `"${str}"`;
    };
    const rows = orders.map((o) => [
      o.id,
      o.timestamp,
      o.customerName,
      o.customerPhone,
      o.city,
      o.deliveryAddress,
      o.itemsSummary,
      o.subtotal,
      o.shippingFee,
      o.discountCode || '',
      o.discountAmount || 0,
      o.grandTotal,
      o.paymentMethod,
      o.status,
      o.trackingNotes || '',
    ]);

    const csvContent =
      '\uFEFF' + [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-${cleanSlug}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleContactCustomerWhatsApp = (ord: Order) => {
    const cleanPhone = ord.customerPhone.replace(/\D/g, '');
    const statusMap: Record<OrderStatus, string> = {
      Received: 'تم استلام طلبك بنجاح',
      'In Progress': 'طلبك قيد التجهيز الآن',
      'Out for Delivery': 'طلبك خرج للتوصيل مع المندوب',
      Delivered: 'تم توصيل طلبك بنجاح، شكراً لتسوقك معنا',
      Cancelled: 'تم إلغاء الطلب',
    };
    const msg = `مرحباً ${ord.customerName} 🌟\nبخصوص طلبك رقم #${ord.id} من *${settings.storeName}*:\nالحالة الحالية: *${statusMap[ord.status]}*${
      ord.trackingNotes ? `\nملاحظات الشحن: ${ord.trackingNotes}` : ''
    }\nنسعد بخدمتك دائماً!`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  };

  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProductFormError(null);
    setExtraGalleryUrl('');
    setProductForm({
      name: '',
      category: 'عام',
      price: 100,
      salePrice: 0,
      variants: 'مقاس موحد',
      imageUrl: '',
      galleryImages: [],
      description: '',
      inStock: true,
      stockQuantity: '',
      featured: false,
    });
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (p: Product) => {
    setEditingProduct(p);
    setProductFormError(null);
    setExtraGalleryUrl('');
    setProductForm({
      name: p.name,
      category: p.category,
      price: p.price,
      salePrice: p.salePrice || 0,
      variants: (p.variants || []).join(', '),
      imageUrl: p.imageUrl,
      galleryImages: p.galleryImages && p.galleryImages.length > 0 ? p.galleryImages : [p.imageUrl],
      description: p.description,
      inStock: p.inStock,
      stockQuantity: p.stockQuantity !== undefined ? p.stockQuantity : '',
      featured: Boolean(p.featured),
    });
    setIsProductModalOpen(true);
  };

  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, isGallery = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProductImg(true);
    setProductFormError(null);
    try {
      const compressedDataUrl = await compressImageFile(file, 800, 800, 0.85);
      if (isGallery) {
        setProductForm((prev) => ({
          ...prev,
          galleryImages: [...prev.galleryImages, compressedDataUrl],
          imageUrl: prev.imageUrl || compressedDataUrl,
        }));
      } else {
        setProductForm((prev) => ({
          ...prev,
          imageUrl: compressedDataUrl,
          galleryImages: prev.galleryImages.includes(compressedDataUrl)
            ? prev.galleryImages
            : [compressedDataUrl, ...prev.galleryImages],
        }));
      }
    } catch (err: unknown) {
      setProductFormError(err instanceof Error ? err.message : 'تعذر ضغط الصورة');
    } finally {
      setUploadingProductImg(false);
    }
  };

  const handleGenerateAIProductCopy = async () => {
    if (!productForm.name.trim()) {
      setProductFormError('يرجى كتابة اسم المنتج أولاً ليتمكن الذكاء الاصطناعي من صياغة الوصف.');
      return;
    }
    setGeneratingProductAI(true);
    setProductFormError(null);
    try {
      const prompt = `المنتج: ${productForm.name.trim()}\nالفئة: ${
        productForm.category.trim() || 'عام'
      }\nالمتجر: ${settings.storeName}`;
      const res = await requestAIGeneration(prompt, 'product_description');
      if (res.success && res.text) {
        setProductForm((prev) => ({ ...prev, description: res.text || '' }));
      } else {
        setProductFormError(res.error || 'تعذر توليد وصف المنتج بالذكاء الاصطناعي.');
      }
    } catch {
      setProductFormError('حدث خطأ غير متوقع أثناء توليد الوصف.');
    } finally {
      setGeneratingProductAI(false);
    }
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim()) return;

    const basePrice = Number(productForm.price) || 0;
    const discountPrice = productForm.salePrice && Number(productForm.salePrice) > 0 ? Number(productForm.salePrice) : undefined;

    if (discountPrice !== undefined && discountPrice >= basePrice) {
      setProductFormError('سعر الخصم يجب أن يكون أقل من السعر الأساسي للمنتج.');
      return;
    }

    const variantsArray = productForm.variants
      .split(/[,،]/)
      .map((v) => v.trim())
      .filter(Boolean);

    const defaultImg = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80';
    const primaryImg = productForm.imageUrl.trim() || productForm.galleryImages[0] || defaultImg;
    const finalGallery =
      productForm.galleryImages.length > 0
        ? Array.from(new Set([primaryImg, ...productForm.galleryImages]))
        : [primaryImg];

    const parsedStockQty =
      productForm.stockQuantity !== '' && !isNaN(Number(productForm.stockQuantity))
        ? Math.max(0, Number(productForm.stockQuantity))
        : undefined;

    const finalInStock = parsedStockQty !== undefined ? parsedStockQty > 0 && productForm.inStock : productForm.inStock;

    if (editingProduct) {
      const updated = products.map((p) =>
        p.id === editingProduct.id
          ? {
              ...p,
              name: productForm.name.trim(),
              category: productForm.category.trim() || 'عام',
              price: basePrice,
              salePrice: discountPrice,
              variants: variantsArray.length > 0 ? variantsArray : ['الخيار الافتراضي'],
              imageUrl: primaryImg,
              galleryImages: finalGallery,
              description: productForm.description.trim(),
              inStock: finalInStock,
              stockQuantity: parsedStockQty,
              featured: productForm.featured,
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
        price: basePrice,
        salePrice: discountPrice,
        variants: variantsArray.length > 0 ? variantsArray : ['الخيار الافتراضي'],
        imageUrl: primaryImg,
        galleryImages: finalGallery,
        description: productForm.description.trim(),
        featured: productForm.featured,
        inStock: finalInStock,
        stockQuantity: parsedStockQty,
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

  const handleStoreLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingStoreLogo(true);
    try {
      const dataUrl = await compressImageFile(file, 400, 400, 0.9);
      setEditableSettings((prev) => ({ ...prev, logoUrl: dataUrl }));
    } catch {
      // Ignore
    } finally {
      setUploadingStoreLogo(false);
    }
  };

  const handleAddPromoCode = () => {
    const code = newPromoCode.trim().toUpperCase().replace(/\s+/g, '');
    if (!code || newPromoValue <= 0) return;
    const existing = editableSettings.promoCodes || [];
    if (existing.some((p) => p.code.toUpperCase() === code)) return;

    const updatedPromos: PromoCode[] = [
      ...existing,
      {
        code,
        type: newPromoType,
        value: Number(newPromoValue),
        minOrderAmount: Number(newPromoMinOrder) > 0 ? Number(newPromoMinOrder) : undefined,
        active: true,
      },
    ];
    const nextSettings = { ...editableSettings, promoCodes: updatedPromos };
    setEditableSettings(nextSettings);
    onUpdateSettings(nextSettings);
    setNewPromoCode('');
    setSyncMessage(`🎟️ تم تفعيل كود الخصم ${code} بنجاح!`);
    setTimeout(() => setSyncMessage(null), 2500);
  };

  const handleTogglePromoCode = (code: string) => {
    const updatedPromos = (editableSettings.promoCodes || []).map((p) =>
      p.code === code ? { ...p, active: !p.active } : p
    );
    const nextSettings = { ...editableSettings, promoCodes: updatedPromos };
    setEditableSettings(nextSettings);
    onUpdateSettings(nextSettings);
  };

  const handleDeletePromoCode = (code: string) => {
    const updatedPromos = (editableSettings.promoCodes || []).filter((p) => p.code !== code);
    const nextSettings = { ...editableSettings, promoCodes: updatedPromos };
    setEditableSettings(nextSettings);
    onUpdateSettings(nextSettings);
  };

  const handleSaveSettingsForm = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(editableSettings);
    setSyncMessage('✅ تم حفظ إعدادات المتجر والشحن والدفع بنجاح!');
    setTimeout(() => setSyncMessage(null), 3000);
  };

  const handleSavePolicies = () => {
    onUpdatePolicies(editablePolicies);
    setSyncMessage('✅ تم حفظ سياسات المتجر والضمان بنجاح!');
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      {/* Toast Alert */}
      {syncMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#0F172A] text-white text-xs sm:text-sm font-bold py-2.5 px-5 rounded-2xl shadow-xl flex items-center gap-2 animate-in zoom-in-95">
          <Sparkles className="w-4 h-4 text-[#86EFAC]" />
          <span>{syncMessage}</span>
        </div>
      )}

      {/* Real-time New Order Banner */}
      {newOrderBanner && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-xs sm:text-sm font-bold py-3 px-6 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
          <Bell className="w-4 h-4 text-emerald-100" />
          <span>{newOrderBanner}</span>
        </div>
      )}

      {/* Top Banner: Storefront Link & Quick Actions */}
      <div 
        className="bg-white rounded-3xl p-5 sm:p-8 border shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
        style={{ borderColor: brand.neutralColor }}
      >
        <div className="space-y-2 w-full md:w-auto">
          <div className="flex items-center gap-3">
            <div 
              className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white text-lg shadow-sm overflow-hidden shrink-0 border border-stone-200"
              style={{ backgroundColor: settings.logoUrl ? '#FFFFFF' : brand.primaryColor }}
            >
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
              ) : (
                <span>{settings.logoLetter || 'S'}</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-2xl font-black" style={{ color: brand.primaryColor }}>
                  {settings.storeName}
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  متجر نشط · Live
                </span>
                {/* Live Cloud Sync Badge */}
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 border ${
                    cloudSyncStatus === 'syncing'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : cloudSyncStatus === 'error'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-blue-50 text-[#2563EB] border-blue-200'
                  }`}
                >
                  {cloudSyncStatus === 'syncing' ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>جاري الحفظ سحابياً...</span>
                    </>
                  ) : cloudSyncStatus === 'error' || cloudSyncStatus === 'local_only' ? (
                    <>
                      <CloudOff className="w-3 h-3" />
                      <span>محفوظ محلياً</span>
                    </>
                  ) : (
                    <>
                      <Cloud className="w-3 h-3" />
                      <span>محفوظ سحابياً</span>
                    </>
                  )}
                </span>
                {currentUser && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 hidden sm:inline-flex items-center gap-1">
                    <span>المالك: {currentUser.name}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500 line-clamp-1">
                {settings.tagline}
              </p>
            </div>
          </div>

          {/* Store URL Bar */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-xs text-stone-500 font-bold">رابط متجرك للعملاء:</span>
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-mono max-w-full overflow-x-auto" dir="ltr">
              <Link2 className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
              <span className="text-stone-700 font-semibold truncate">{storeUrl}</span>
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
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={handleOpenAddProduct}
            className="flex-1 sm:flex-initial justify-center px-4 py-2.5 bg-[#0F172A] hover:bg-stone-800 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center gap-1.5 shadow-xs transition-transform active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#86EFAC]" />
            <span>إضافة منتج جديد</span>
          </button>

          <button
            onClick={onViewStorefront}
            className="flex-1 sm:flex-initial justify-center px-4 py-2.5 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-xs transition-transform active:scale-95 cursor-pointer"
            style={{ backgroundColor: brand.accentColor }}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>معاينة متجر الزبون</span>
          </button>

          <button
            onClick={onOpenBrandStudio}
            className="px-3.5 py-2.5 bg-white hover:bg-stone-50 text-stone-800 font-bold rounded-xl text-xs sm:text-sm border transition-colors flex items-center gap-1.5 cursor-pointer"
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border shadow-xs" style={{ borderColor: brand.neutralColor }}>
          <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
            <span>صافي المبيعات</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg sm:text-2xl font-black font-mono" style={{ color: brand.primaryColor }}>
            {totalRevenue.toLocaleString('en-US')} {settings.currency}
          </div>
          <span className="text-[10px] text-stone-400">باستثناء الطلبات الملغاة</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border shadow-xs" style={{ borderColor: brand.neutralColor }}>
          <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
            <span>عدد الطلبات</span>
            <Package className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-lg sm:text-2xl font-black font-mono" style={{ color: brand.primaryColor }}>
            {orders.length}
          </div>
          <span className="text-[10px] text-emerald-600 font-bold">{deliveredOrders} طلب مكتمل</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border shadow-xs" style={{ borderColor: brand.neutralColor }}>
          <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
            <span>المنتجات المتوفرة</span>
            <ShoppingBag className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-lg sm:text-2xl font-black font-mono" style={{ color: brand.primaryColor }}>
            {inStockProducts}
          </div>
          <span className="text-[10px] text-stone-400">من أصل {products.length} منتج</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border shadow-xs" style={{ borderColor: brand.neutralColor }}>
          <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
            <span>أكواد الخصم الفعالة</span>
            <Percent className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-lg sm:text-2xl font-black font-mono" style={{ color: brand.primaryColor }}>
            {(settings.promoCodes || []).filter((c) => c.active).length}
          </div>
          <span className="text-[10px] text-stone-400">كوبونات خصم للعملاء</span>
        </div>
      </div>

      {/* Simple 3-Tab Navigation for Business Owner */}
      <div className="flex items-center gap-2 border-b border-stone-200 pb-2 overflow-x-auto scrollbar-none text-xs sm:text-sm font-bold">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
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
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
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
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
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
          <span>الإعدادات والكوبونات والسياسات</span>
        </button>
      </div>

      {/* TAB 1: ORDERS CRM */}
      {activeTab === 'overview' && (
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
                onClick={() => setIsSettlementOpen(true)}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                title="تصفية حسابات ومبالغ التوصيل مع المندوب"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>دفتر تصفية المندوب (Driver Ledger)</span>
              </button>

              {orders.length > 0 && (
                <button
                  type="button"
                  onClick={handleExportOrdersCSV}
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
                    { id: 'Delivered', label: 'مكتمل' },
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
                        onChange={(e) => handleOrderStatusChange(ord.id, e.target.value as OrderStatus)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-bold border focus:outline-none ${
                          ord.status === 'Delivered'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
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
                        onChange={(e) =>
                          setLocalTrackingNotes((prev) => ({ ...prev, [ord.id]: e.target.value }))
                        }
                        onBlur={() => handleCommitTrackingNote(ord.id)}
                        placeholder="رقم البوليصة أو ملاحظة للعميل..."
                        className="w-full px-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:bg-white"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleDispatchToDriver(ord)}
                        className="py-2 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                        title="إرسال تفاصيل الشحنة للمندوب عبر واتساب"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>للمندوب</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleContactCustomerWhatsApp(ord)}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>العميل</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedOrderDetail(ord)}
                        className="px-2.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setInvoiceOrder(ord)}
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
                            onChange={(e) => handleOrderStatusChange(ord.id, e.target.value as OrderStatus)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border focus:outline-none ${
                              ord.status === 'Delivered'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
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
                            <option value="Cancelled">ملغي</option>
                          </select>
                        </td>
                        <td className="p-3 min-w-[180px]">
                          <input
                            type="text"
                            value={localTrackingNotes[ord.id] ?? ord.trackingNotes ?? ''}
                            onChange={(e) =>
                              setLocalTrackingNotes((prev) => ({ ...prev, [ord.id]: e.target.value }))
                            }
                            onBlur={() => handleCommitTrackingNote(ord.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCommitTrackingNote(ord.id);
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
                              onClick={() => handleDispatchToDriver(ord)}
                              className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors cursor-pointer"
                              title="إرسال تفاصيل الشحنة للمندوب عبر واتساب (1-Tap Dispatch)"
                            >
                              <Truck className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleContactCustomerWhatsApp(ord)}
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors cursor-pointer"
                              title="مراسلة العميل عبر واتساب"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedOrderDetail(ord)}
                              className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition-colors cursor-pointer"
                              title="عرض تفاصيل الطلب والمنتجات"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setInvoiceOrder(ord)}
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
                ارفع صور منتجاتك من جوالك أو جهازك مباشرة واستخدم الذكاء الاصطناعي لكتابة الوصف
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
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-stone-100 shrink-0 border border-stone-100 relative">
                        <img
                          src={prod.imageUrl}
                          alt={prod.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80';
                          }}
                        />
                        {prod.featured && (
                          <span className="absolute top-1 right-1 bg-amber-400 text-stone-950 p-0.5 rounded-full">
                            <Star className="w-2.5 h-2.5 fill-current" />
                          </span>
                        )}
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
                            {prod.inStock
                              ? prod.stockQuantity !== undefined
                                ? `متوفر (${prod.stockQuantity})`
                                : 'متوفر'
                              : 'نفذت الكمية'}
                          </span>
                        </div>

                        <h4 className="font-bold text-stone-900 text-sm mt-1 truncate">
                          {prod.name}
                        </h4>

                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="font-black text-sm text-[#0F172A] font-mono">
                            {(prod.salePrice ?? prod.price).toLocaleString('en-US')} {settings.currency}
                          </span>
                          {Boolean(prod.salePrice && prod.salePrice < prod.price) && (
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

      {/* TAB 3: STORE SETTINGS, SHIPPING, PROMO CODES & POLICIES */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleSaveSettingsForm} className="space-y-6">
              {/* Basic Info & Logo */}
              <div className="bg-white p-6 rounded-3xl border border-stone-200 space-y-4">
                <h3 className="text-sm font-bold text-stone-900 border-b border-stone-100 pb-2">
                  بيانات المتجر، الشعار، والتواصل
                </h3>

                {/* Logo Upload Bar */}
                <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-base text-white shadow-xs overflow-hidden shrink-0 border border-stone-200"
                      style={{ backgroundColor: editableSettings.logoUrl ? '#FFFFFF' : brand.primaryColor }}
                    >
                      {editableSettings.logoUrl ? (
                        <img src={editableSettings.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                      ) : (
                        <span>{editableSettings.logoLetter || 'S'}</span>
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-stone-800">شعار المتجر (Logo)</div>
                      <p className="text-[11px] text-stone-500">ارفع صورة شعار متجرك من جوالك أو حاسوبك</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="px-3 py-2 bg-white hover:bg-stone-100 border border-stone-200 rounded-xl font-bold text-stone-700 flex items-center gap-1.5 cursor-pointer">
                      <Upload className="w-3.5 h-3.5 text-[#2563EB]" />
                      <span>{uploadingStoreLogo ? 'جاري الضغط...' : 'رفع صورة الشعار'}</span>
                      <input type="file" accept="image/*" onChange={handleStoreLogoUpload} className="hidden" />
                    </label>
                    {editableSettings.logoUrl && (
                      <button
                        type="button"
                        onClick={() => setEditableSettings({ ...editableSettings, logoUrl: '' })}
                        className="p-2 bg-red-50 text-red-600 rounded-xl cursor-pointer"
                        title="إزالة الشعار"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

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

                  <div>
                    <label className="block font-bold text-stone-700 mb-1">حساب انستقرام (اختياري)</label>
                    <input
                      type="text"
                      value={editableSettings.instagramHandle || ''}
                      onChange={(e) => setEditableSettings({ ...editableSettings, instagramHandle: e.target.value })}
                      placeholder="@yourstore"
                      className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-mono"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-700 mb-1">حساب تيك توك (اختياري)</label>
                    <input
                      type="text"
                      value={editableSettings.tiktokHandle || ''}
                      onChange={(e) => setEditableSettings({ ...editableSettings, tiktokHandle: e.target.value })}
                      placeholder="@yourstore"
                      className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-mono"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">عنوان البانر الترحيبي (Hero Title)</label>
                    <input
                      type="text"
                      value={editableSettings.heroTitle || ''}
                      onChange={(e) => setEditableSettings({ ...editableSettings, heroTitle: e.target.value })}
                      className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-700 mb-1">مدة التوصيل المتوقعة</label>
                    <input
                      type="text"
                      value={editableSettings.deliveryEstimationDays || ''}
                      onChange={(e) => setEditableSettings({ ...editableSettings, deliveryEstimationDays: e.target.value })}
                      placeholder="1 إلى 3 أيام عمل"
                      className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl"
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
              </div>

              {/* Local Shared Freelance Driver Settings */}
              <div className="bg-white p-6 rounded-3xl border border-stone-200 space-y-4">
                <div className="border-b border-stone-100 pb-2">
                  <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-blue-600" />
                    <span>إعدادات المندوب المحلي المشترك (Local Freelance Driver)</span>
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    اربط متجرك بمندوب توصيل محلي مشترك يوصل طلباتك لعملائك ويحصل المبالغ النقدية دون الحاجة لتحميل أي تطبيق
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">اسم المندوب المحلي</label>
                    <input
                      type="text"
                      value={editableSettings.driverName || ''}
                      onChange={(e) =>
                        setEditableSettings({
                          ...editableSettings,
                          driverName: e.target.value,
                        })
                      }
                      placeholder="مثال: كابتن أحمد / أبو محمد"
                      className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-700 mb-1">رقم واتساب المندوب (لاستلام الشحنات)</label>
                    <input
                      type="text"
                      value={editableSettings.driverPhone || ''}
                      onChange={(e) =>
                        setEditableSettings({
                          ...editableSettings,
                          driverPhone: e.target.value,
                        })
                      }
                      placeholder="9665XXXXXXXX"
                      className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-mono"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      أجرة توصيل المندوب لكل طلب ({editableSettings.currency})
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={editableSettings.driverFee ?? 15}
                      onChange={(e) =>
                        setEditableSettings({
                          ...editableSettings,
                          driverFee: Number(e.target.value),
                        })
                      }
                      placeholder="15"
                      className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-mono"
                    />
                    <span className="text-[10px] text-stone-400 mt-0.5 block">
                      المبلغ المتفق عليه للمندوب عن كل شحنة ناجحة ليتم احتسابه تلقائياً في دفتر التصفية اليومي
                    </span>
                  </div>

                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      رابط موقع المحل / المستودع على Google Maps
                    </label>
                    <input
                      type="url"
                      value={editableSettings.storeLocationUrl || ''}
                      onChange={(e) =>
                        setEditableSettings({
                          ...editableSettings,
                          storeLocationUrl: e.target.value,
                        })
                      }
                      placeholder="https://maps.app.goo.gl/..."
                      className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-mono"
                      dir="ltr"
                    />
                    <span className="text-[10px] text-stone-400 mt-0.5 block">
                      يرسل للمندوب بنقرة واحدة لفتح اتجاهات القيادة واستلام الطرود من محلك
                    </span>
                  </div>
                </div>
              </div>

              {/* Store Pickup & ZATCA Tax Compliance */}
              <div className="bg-white p-6 rounded-3xl border border-stone-200 space-y-4">
                <h3 className="text-sm font-bold text-stone-900 border-b border-stone-100 pb-2">
                  الاستلام من الفرع وبيانات الضريبة (ZATCA)
                </h3>

                <div className="space-y-3 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-stone-800">
                    <input
                      type="checkbox"
                      checked={editableSettings.enableStorePickup ?? false}
                      onChange={(e) =>
                        setEditableSettings({
                          ...editableSettings,
                          enableStorePickup: e.target.checked,
                        })
                      }
                      className="rounded text-blue-600 w-4 h-4"
                    />
                    <span>تفعيل خيار الاستلام المباشر من الفرع / المتجر (بدون رسوم شحن)</span>
                  </label>

                  {editableSettings.enableStorePickup && (
                    <div>
                      <label className="block font-bold text-stone-700 mb-1">
                        عنوان وموقع الاستلام المباشر
                      </label>
                      <input
                        type="text"
                        value={editableSettings.storePickupAddress || ''}
                        onChange={(e) =>
                          setEditableSettings({
                            ...editableSettings,
                            storePickupAddress: e.target.value,
                          })
                        }
                        placeholder="مثال: الرياض - طريق الملك فهد - مجمع التحلية التجاري، المعرض 4"
                        className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block font-bold text-stone-700 mb-1">
                        الرقم الضريبي للمنشأة (VAT Number)
                      </label>
                      <input
                        type="text"
                        value={editableSettings.vatNumber || ''}
                        onChange={(e) =>
                          setEditableSettings({
                            ...editableSettings,
                            vatNumber: e.target.value,
                          })
                        }
                        placeholder="300000000000003"
                        className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-mono"
                        dir="ltr"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-stone-700 mb-1">
                        رقم السجل التجاري (Commercial Register)
                      </label>
                      <input
                        type="text"
                        value={editableSettings.commercialRegister || ''}
                        onChange={(e) =>
                          setEditableSettings({
                            ...editableSettings,
                            commercialRegister: e.target.value,
                          })
                        }
                        placeholder="1010XXXXXX"
                        className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-mono"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer font-bold text-stone-800 pt-1">
                    <input
                      type="checkbox"
                      checked={editableSettings.pricesIncludeVat ?? true}
                      onChange={(e) =>
                        setEditableSettings({
                          ...editableSettings,
                          pricesIncludeVat: e.target.checked,
                        })
                      }
                      className="rounded text-blue-600 w-4 h-4"
                    />
                    <span>الأسعار المعروضة في المتجر شاملة لضريبة القيمة المضافة 15%</span>
                  </label>
                </div>
              </div>

              {/* Marketing Pixels & Ad Campaigns */}
              <div className="bg-white p-6 rounded-3xl border border-stone-200 space-y-4">
                <div className="border-b border-stone-100 pb-2">
                  <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <span>بكسلات التتبع والحملات الإعلانية (Marketing Pixels & GA4)</span>
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    اربط متجرك مع منصات الإعلانات لتتبع التحويلات (PageView, AddToCart, Purchase) تلقائياً
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      Google Analytics 4 (معرّف القياس)
                    </label>
                    <input
                      type="text"
                      value={editableSettings.googleAnalyticsId || ''}
                      onChange={(e) =>
                        setEditableSettings({
                          ...editableSettings,
                          googleAnalyticsId: e.target.value,
                        })
                      }
                      placeholder="G-XXXXXXXXXX"
                      className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-mono"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      Meta Pixel ID (فيسبوك / انستقرام)
                    </label>
                    <input
                      type="text"
                      value={editableSettings.facebookPixelId || ''}
                      onChange={(e) =>
                        setEditableSettings({
                          ...editableSettings,
                          facebookPixelId: e.target.value,
                        })
                      }
                      placeholder="123456789012345"
                      className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-mono"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      TikTok Pixel ID (تيك توك)
                    </label>
                    <input
                      type="text"
                      value={editableSettings.tiktokPixelId || ''}
                      onChange={(e) =>
                        setEditableSettings({
                          ...editableSettings,
                          tiktokPixelId: e.target.value,
                        })
                      }
                      placeholder="CXXXXXXXXXXXXXXXXXXX"
                      className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-mono"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      Snapchat Pixel ID (سناب شات)
                    </label>
                    <input
                      type="text"
                      value={editableSettings.snapchatPixelId || ''}
                      onChange={(e) =>
                        setEditableSettings({
                          ...editableSettings,
                          snapchatPixelId: e.target.value,
                        })
                      }
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
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

            {/* Promo Codes / Coupons Manager */}
            <div className="bg-white p-6 rounded-3xl border border-stone-200 space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <div>
                  <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                    <Percent className="w-4 h-4 text-[#2563EB]" />
                    <span>أكواد الخصم والكوبونات الترويجية</span>
                  </h3>
                  <p className="text-xs text-stone-500">
                    أنشئ كوبونات خصم (نسبة مئوية أو مبلغ ثابت) لتحفيز عملائك على إتمام الشراء
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs items-end bg-stone-50 p-3.5 rounded-2xl border border-stone-200">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">كود الخصم</label>
                  <input
                    type="text"
                    value={newPromoCode}
                    onChange={(e) => setNewPromoCode(e.target.value.toUpperCase())}
                    placeholder="WELCOME10"
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl font-mono uppercase"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">نوع الخصم</label>
                  <select
                    value={newPromoType}
                    onChange={(e) => setNewPromoType(e.target.value as 'percentage' | 'fixed')}
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl"
                  >
                    <option value="percentage">نسبة مئوية (%)</option>
                    <option value="fixed">مبلغ ثابت ({editableSettings.currency})</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">قيمة الخصم</label>
                  <input
                    type="number"
                    min={1}
                    value={newPromoValue}
                    onChange={(e) => setNewPromoValue(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl font-mono"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddPromoCode}
                  className="px-4 py-2 bg-[#0F172A] hover:bg-stone-800 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer h-[38px]"
                >
                  <Plus className="w-3.5 h-3.5 text-[#86EFAC]" />
                  <span>إضافة الكود</span>
                </button>
              </div>

              {(editableSettings.promoCodes || []).length > 0 && (
                <div className="space-y-2">
                  {(editableSettings.promoCodes || []).map((promo) => (
                    <div
                      key={promo.code}
                      className="flex items-center justify-between p-3 rounded-xl border border-stone-200 bg-white text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-black text-sm px-2.5 py-1 rounded-lg bg-blue-50 text-[#2563EB]">
                          {promo.code}
                        </span>
                        <span className="font-bold text-stone-800">
                          خصم{' '}
                          {promo.type === 'percentage'
                            ? `${promo.value}%`
                            : `${promo.value} ${editableSettings.currency}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleTogglePromoCode(promo.code)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                            promo.active
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-stone-100 text-stone-500'
                          }`}
                        >
                          {promo.active ? 'مفعّل' : 'معطّل'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePromoCode(promo.code)}
                          className="p-1.5 text-stone-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Store Policies Column */}
          <div className="bg-white p-6 rounded-3xl border border-stone-200 space-y-4 h-fit">
            <h3 className="text-sm font-bold text-stone-900 border-b border-stone-100 pb-2">
              سياسات المتجر والضمان
            </h3>
            <p className="text-xs text-stone-500">
              تظهر هذه السياسات للعملاء عند النقر على أيقونة السياسات في المتجر:
            </p>
            <div className="space-y-3">
              {editablePolicies.map((pol, idx) => (
                <div key={pol.id} className="space-y-1">
                  <label className="block text-xs font-bold text-stone-800">{pol.title}</label>
                  <textarea
                    rows={3}
                    value={pol.content}
                    onChange={(e) => {
                      const updated = [...editablePolicies];
                      updated[idx] = { ...pol, content: e.target.value };
                      setEditablePolicies(updated);
                    }}
                    className="w-full p-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl leading-relaxed focus:bg-white focus:outline-none"
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleSavePolicies}
              className="w-full py-2.5 bg-[#0F172A] hover:bg-stone-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 text-[#86EFAC]" />
              <span>حفظ السياسات</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL: ORDER DETAILS */}
      {selectedOrderDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-stone-950/70 backdrop-blur-xs">
          <div className="fixed inset-0" onClick={() => setSelectedOrderDetail(null)} aria-hidden="true" />
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden z-10 border border-stone-200 my-auto p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  تفاصيل الطلب #{selectedOrderDetail.id}
                </h3>
                <p className="text-xs text-stone-500">
                  {selectedOrderDetail.timestamp}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrderDetail(null)}
                className="w-8 h-8 rounded-full bg-stone-100 text-stone-600 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs bg-stone-50 p-4 rounded-2xl border border-stone-200">
              <div><strong>العميل:</strong> {selectedOrderDetail.customerName}</div>
              <div><strong>الجوال:</strong> <span className="font-mono" dir="ltr">{selectedOrderDetail.customerPhone}</span></div>
              <div><strong>العنوان:</strong> {selectedOrderDetail.city} — {selectedOrderDetail.deliveryAddress}</div>
              {selectedOrderDetail.googleMapsUrl && (
                <div>
                  <strong>موقع GPS للعميل:</strong>{' '}
                  <a
                    href={selectedOrderDetail.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline font-bold inline-flex items-center gap-1"
                  >
                    <span>فتح الموقع على Google Maps 📍</span>
                  </a>
                </div>
              )}
              <div><strong>طريقة الدفع:</strong> {selectedOrderDetail.paymentMethod}</div>
              {selectedOrderDetail.landmarkNotes && <div><strong>ملاحظات العميل:</strong> {selectedOrderDetail.landmarkNotes}</div>}
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              <div className="text-xs font-bold text-stone-700">المنتجات المطلوبة:</div>
              {selectedOrderDetail.items && selectedOrderDetail.items.length > 0 ? (
                selectedOrderDetail.items.map((item, idx) => (
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
                <div className="p-3 bg-stone-50 rounded-xl text-xs font-mono">{selectedOrderDetail.itemsSummary}</div>
              )}
            </div>

            <div className="border-t border-stone-200 pt-3 space-y-1 text-xs">
              <div className="flex justify-between text-stone-600">
                <span>المجموع الفرعي:</span>
                <span className="font-mono">{selectedOrderDetail.subtotal.toLocaleString('en-US')} {settings.currency}</span>
              </div>
              {Boolean(selectedOrderDetail.discountAmount && selectedOrderDetail.discountAmount > 0) && (
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>الخصم ({selectedOrderDetail.discountCode}):</span>
                  <span className="font-mono">-{selectedOrderDetail.discountAmount?.toLocaleString('en-US')} {settings.currency}</span>
                </div>
              )}
              <div className="flex justify-between text-stone-600">
                <span>الشحن:</span>
                <span className="font-mono">{selectedOrderDetail.shippingFee.toLocaleString('en-US')} {settings.currency}</span>
              </div>
              <div className="flex justify-between text-sm font-black text-stone-900 pt-1">
                <span>الإجمالي النهائي:</span>
                <span className="font-mono">{selectedOrderDetail.grandTotal.toLocaleString('en-US')} {settings.currency}</span>
              </div>
            </div>

            {/* Courier & Delivery Assignment */}
            <div className="space-y-2.5 text-xs bg-stone-50 p-4 rounded-2xl border border-stone-200">
              <div className="font-bold text-stone-800 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-blue-600" />
                <span>بيانات الشحن والتوصيل (المندوب / شركة الشحن):</span>
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
                onClick={() => handleSaveCourierDetails(selectedOrderDetail.id)}
                className="w-full py-1.5 bg-stone-800 hover:bg-stone-900 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                تحديث وحفظ بيانات الشحن
              </button>
              <button
                type="button"
                onClick={() => handleDispatchToDriver(selectedOrderDetail)}
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
                  onClick={() => setInvoiceOrder(selectedOrderDetail)}
                  className="flex-1 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span>عرض وطباعة الفاتورة (ZATCA)</span>
                </button>

                {selectedOrderDetail.paymentMethod === 'Moyasar' && selectedOrderDetail.status !== 'Cancelled' && (
                  <button
                    type="button"
                    disabled={isRefunding}
                    onClick={() => handleRefundOrder(selectedOrderDetail)}
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
                  onClick={() => handleContactCustomerWhatsApp(selectedOrderDetail)}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>مراسلة العميل عبر واتساب</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOrderDetail(null)}
                  className="px-4 py-2.5 bg-stone-100 text-stone-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ZATCA Tax Invoice Modal */}
      <InvoiceModal
        isOpen={Boolean(invoiceOrder)}
        onClose={() => setInvoiceOrder(null)}
        order={invoiceOrder}
        settings={editableSettings}
      />

      {/* Driver Cash Settlement Ledger Modal */}
      <DriverSettlementModal
        isOpen={isSettlementOpen}
        onClose={() => setIsSettlementOpen(false)}
        orders={orders}
        settings={editableSettings}
        onUpdateOrders={onUpdateOrders}
      />

      {/* MODAL: ADD / EDIT PRODUCT */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-stone-950/70 backdrop-blur-xs">
          <div className="fixed inset-0" onClick={() => setIsProductModalOpen(false)} aria-hidden="true" />

          <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden z-10 border border-stone-200 my-auto p-6 sm:p-8 space-y-5 max-h-[92vh] overflow-y-auto animate-in zoom-in-95">
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
                    ارفع صور المنتج من جهازك أو أضف الرابط، وسينعكس التحديث فوراً
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

            {productFormError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{productFormError}</span>
              </div>
            )}

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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                    سعر الخصم ({settings.currency})
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={productForm.salePrice}
                    onChange={(e) => setProductForm({ ...productForm, salePrice: Number(e.target.value) })}
                    placeholder="0 بدون خصم"
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-800 mb-1">
                    الكمية المتوفرة (اختياري)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={productForm.stockQuantity}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        stockQuantity: e.target.value === '' ? '' : Number(e.target.value),
                      })
                    }
                    placeholder="غير محدود"
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

              {/* Device Image Uploader + URL + Multi-Image Gallery */}
              <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-2xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="font-bold text-stone-800">صور المنتج (رفع من الجهاز أو الكاميرا)</label>
                  <div className="flex items-center gap-2">
                    <label className="px-3 py-1.5 bg-[#2563EB] hover:bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingProductImg ? 'جاري ضغط الصورة...' : 'رفع صورة من جهازك'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleProductImageUpload(e, false)}
                        className="hidden"
                      />
                    </label>
                    <label className="px-3 py-1.5 bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer">
                      <Plus className="w-3.5 h-3.5" />
                      <span>صورة إضافية</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleProductImageUpload(e, true)}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <input
                  type="text"
                  value={productForm.imageUrl}
                  onChange={(e) => setProductForm({ ...productForm, imageUrl: e.target.value })}
                  placeholder="أو الصق رابط صورة مباشر https://..."
                  className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-stone-900 font-mono text-xs"
                  dir="ltr"
                />

                {/* Gallery Thumbnails */}
                {productForm.galleryImages.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    {productForm.galleryImages.map((img, i) => (
                      <div key={i} className="relative w-14 h-14 rounded-xl overflow-hidden border border-stone-300 bg-white group">
                        <img src={img} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => {
                            const nextGallery = productForm.galleryImages.filter((_, idx) => idx !== i);
                            setProductForm({
                              ...productForm,
                              galleryImages: nextGallery,
                              imageUrl: productForm.imageUrl === img ? nextGallery[0] || '' : productForm.imageUrl,
                            });
                          }}
                          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center text-[10px] cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Extra Gallery Image via URL */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={extraGalleryUrl}
                    onChange={(e) => setExtraGalleryUrl(e.target.value)}
                    placeholder="إضافة رابط صورة إضافية لمعرض المنتج..."
                    className="flex-1 px-3 py-1.5 bg-white border border-stone-200 rounded-xl font-mono text-[11px]"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!extraGalleryUrl.trim()) return;
                      setProductForm((prev) => ({
                        ...prev,
                        galleryImages: [...prev.galleryImages, extraGalleryUrl.trim()],
                      }));
                      setExtraGalleryUrl('');
                    }}
                    className="px-3 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl font-bold text-[11px] cursor-pointer"
                  >
                    إضافة للمعرض
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-stone-800">وصف المنتج ومميزاته</label>
                  <button
                    type="button"
                    onClick={handleGenerateAIProductCopy}
                    disabled={generatingProductAI}
                    className="text-[11px] font-bold text-[#2563EB] hover:bg-blue-50 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {generatingProductAI ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="w-3.5 h-3.5" />
                    )}
                    <span>كتابة الوصف بالذكاء الاصطناعي ✨</span>
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  placeholder="اكتب وصفاً واضحاً للمنتج، الخامات، أو المميزات..."
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={productForm.inStock}
                    onChange={(e) => setProductForm({ ...productForm, inStock: e.target.checked })}
                    className="rounded text-[#2563EB]"
                  />
                  <span className="font-bold text-stone-800">المنتج متوفر في المخزون وجاهز للطلب</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={productForm.featured}
                    onChange={(e) => setProductForm({ ...productForm, featured: e.target.checked })}
                    className="rounded text-amber-500"
                  />
                  <span className="font-bold text-stone-800 flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-current" />
                    <span>تمييز المنتج (الأكثر طلباً)</span>
                  </span>
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
