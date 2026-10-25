import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StoreSettings, Product, Order, StorePolicy, OrderStatus, MerchantUser, PromoCode } from '../../types/store';
import { uploadImageToServer } from '../../utils/imageUploader';
import { normalizeArabicDigits, toWhatsAppNumber } from '../../utils/digits';
import { requestAIGeneration } from '../../services/aiService';
import { StoreManager, CloudSyncStatus, generateUniqueProductId } from '../../services/storeManager';
import { StoreBackupRestoreModal } from './StoreBackupRestoreModal';
import { AuthService } from '../../services/authService';
import { auth } from '../../services/firebase';
import { InvoiceModal, PrintDocumentFormat } from '../storefront/InvoiceModal';
import { DriverSettlementModal } from '../driver/DriverSettlementModal';
import { MerchantCaptainsDirectory } from '../admin/MerchantCaptainsDirectory';
import { OrderDetailModal } from './dashboard/OrderDetailModal';
import { ProductEditorModal } from './dashboard/ProductEditorModal';
import { OrdersTab } from './dashboard/OrdersTab';
import { ProductsTab } from './dashboard/ProductsTab';
import { SettingsTab } from './dashboard/SettingsTab';
import { WhatsAppConnectModal } from './dashboard/WhatsAppConnectModal';
import { WhatsAppClientBridge } from '../../services/whatsAppClientBridge';
import { 
  playOrderNotificationSound,
  NotificationHub,
  requestDesktopNotificationPermission
} from '../../services/notificationService';
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
  MapPin,
  CreditCard,
  Lock,
  ShieldCheck,
  Volume2,
  Send,
  CheckCircle2,
  Radio,
  Globe,
  ExternalLink,
  Share2,
  Smartphone,
  FileSpreadsheet
} from 'lucide-react';
import { buildShareableStoreUrl } from '../../utils/urlRouter';
import { generateAIOptimizedSEO, SAUDI_CITIES_GEO } from '../../utils/seoManager';
import { buildMerchantCustomerUpdateMessage } from '../../utils/whatsappInvoice';
import { CsvProductImportModal } from './CsvProductImportModal';
import { exportProductsToCsv } from '../../utils/csvProductParser';

interface StoreDashboardProps {
  storeId?: string;
  storeSlug: string;
  settings: StoreSettings;
  products: Product[];
  orders: Order[];
  policies: StorePolicy[];
  onUpdateSlug?: (newSlug: string) => Promise<{ success: boolean; error?: string }>;
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
  onUpdateSlug,
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

  // Order Detail Modal & Local Tracking Notes
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<Order | null>(null);
  const [localTrackingNotes, setLocalTrackingNotes] = useState<Record<string, string>>({});
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);
  const [invoiceInitialFormat, setInvoiceInitialFormat] = useState<PrintDocumentFormat>('a4');
  const [isSettlementOpen, setIsSettlementOpen] = useState(false);
  const [showCsvImportModal, setShowCsvImportModal] = useState(false);
  const [isBackupRestoreModalOpen, setIsBackupRestoreModalOpen] = useState(false);
  const [isWhatsAppConnectOpen, setIsWhatsAppConnectOpen] = useState(false);
  const [isWhatsAppConnected, setIsWhatsAppConnected] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [newOrderBanner, setNewOrderBanner] = useState<string | null>(null);

  // Check initial WhatsApp connection status
  useEffect(() => {
    WhatsAppClientBridge.getStatus().then((res) => {
      setIsWhatsAppConnected(res.status === 'connected');
    });
  }, []);

  // Notification Hub State & Testing Handlers
  const [desktopPermission, setDesktopPermission] = useState<NotificationPermission>(() => {
    return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default';
  });
  const [testTelegramLoading, setTestTelegramLoading] = useState(false);
  const [testTelegramStatus, setTestTelegramStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [testWebhookLoading, setTestWebhookLoading] = useState(false);
  const [testWebhookStatus, setTestWebhookStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [testSoundPlayed, setTestSoundPlayed] = useState(false);

  const handleRequestDesktopPermission = async () => {
    const granted = await requestDesktopNotificationPermission();
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setDesktopPermission(Notification.permission);
    }
    if (granted) {
      setEditableSettings((prev) => ({ ...prev, enableDesktopNotifications: true }));
    }
  };

  const handleTestSound = () => {
    playOrderNotificationSound();
    setTestSoundPlayed(true);
    setTimeout(() => setTestSoundPlayed(false), 2000);
  };

  const handleTestTelegram = async () => {
    if (!editableSettings.telegramBotToken || !editableSettings.telegramChatId) {
      setTestTelegramStatus({
        type: 'error',
        message: 'يرجى إدخال Bot Token و Chat ID أولاً لتجربة الاتصال.',
      });
      return;
    }
    setTestTelegramLoading(true);
    setTestTelegramStatus(null);
    const res = await NotificationHub.sendTestTelegram(
      editableSettings.telegramBotToken,
      editableSettings.telegramChatId,
      editableSettings
    );
    setTestTelegramLoading(false);
    if (res.success) {
      setTestTelegramStatus({
        type: 'success',
        message: 'تم إرسال إشعار تجريبي ناجح إلى محادثتك في تليجرام! ⚡',
      });
    } else {
      setTestTelegramStatus({
        type: 'error',
        message: res.error || 'فشل إرسال الإشعار. تأكد من صحة التوكن ورقم المحادثة.',
      });
    }
  };

  const handleTestWebhook = async () => {
    if (!editableSettings.notificationWebhookUrl) {
      setTestWebhookStatus({
        type: 'error',
        message: 'يرجى إدخال رابط Webhook أولاً لتجربة الاتصال.',
      });
      return;
    }
    setTestWebhookLoading(true);
    setTestWebhookStatus(null);
    const res = await NotificationHub.sendTestWebhook(
      editableSettings.notificationWebhookUrl,
      editableSettings
    );
    setTestWebhookLoading(false);
    if (res.success) {
      setTestWebhookStatus({
        type: 'success',
        message: 'تم استقبال استجابة ناجحة من رابط الويب هوك (HTTP 200 OK)! ⚡',
      });
    } else {
      setTestWebhookStatus({
        type: 'error',
        message: res.error || 'تعذر الاتصال بالرابط المحدد.',
      });
    }
  };

  // In-dashboard banner when new orders arrive (audio chime is raised once by NotificationHub.alertMerchantLocally)
  const prevOrdersCountRef = useRef<number>(orders.length);
  useEffect(() => {
    if (orders.length > prevOrdersCountRef.current) {
      const latest = orders[0];
      setNewOrderBanner(`وصل طلب جديد #${latest?.id || ''} بقيمة ${latest?.grandTotal || 0} ${editableSettings.currency}`);
      setTimeout(() => setNewOrderBanner(null), 6000);
    }
    prevOrdersCountRef.current = orders.length;
  }, [orders.length, editableSettings.currency]);

  // Product Management Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [uploadingStoreLogo, setUploadingStoreLogo] = useState(false);

  const brand = settings.brandTheme || {
    primaryColor: '#0F172A',
    accentColor: '#2563EB',
    highlightColor: '#86EFAC',
    backgroundColor: '#F8FAFC',
    neutralColor: '#E2E8F0',
    textColor: '#0F172A',
  };

  const cleanSlug = storeSlug || 'aurora';
  const storeUrl = buildShareableStoreUrl(cleanSlug, undefined, settings.customDomain);

  const [customSlugInput, setCustomSlugInput] = useState(storeSlug || 'aurora');
  const [slugFeedback, setSlugFeedback] = useState<{ status: 'idle' | 'valid' | 'error'; message?: string }>({ status: 'idle' });
  const [isSavingSlug, setIsSavingSlug] = useState(false);
  const [isAiOptimizingSeo, setIsAiOptimizingSeo] = useState(false);

  useEffect(() => {
    if (storeSlug) {
      setCustomSlugInput(storeSlug);
    }
  }, [storeSlug]);

  const handleForceSync = async () => {
    if (!storeId) return;
    const activeStore = StoreManager.getStoreById(storeId);
    if (!activeStore) return;
    if (!auth.currentUser) {
      setSyncMessage('⚠️ أنت لست مسجلاً الدخول، سجل دخولك لتتمكن من نشر متجرك للعملاء.');
      setTimeout(() => setSyncMessage(null), 4000);
      return;
    }
    setSyncMessage('🔄 جاري نشر وتحديث كافة المنتجات سحابياً...');
    const ok = await StoreManager.syncStoreToFirestore({
      ...activeStore,
      products,
      settings,
      policies,
    });
    if (ok) {
      setSyncMessage('✅ تم نشر وتحديث كافة المنتجات سحابياً بنجاح!');
    } else {
      setSyncMessage('❌ تعذر النشر السحابي، تحقق من اتصال الإنترنت.');
    }
    setTimeout(() => setSyncMessage(null), 3500);
  };

  const handleCopyLink = () => {
    if (storeId) {
      const activeStore = StoreManager.getStoreById(storeId);
      if (activeStore && auth.currentUser) {
        StoreManager.syncStoreToFirestore({
          ...activeStore,
          products,
          settings,
          policies,
        }).catch(console.warn);
      }
    }
    navigator.clipboard.writeText(storeUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSaveCustomSlug = async () => {
    const clean = customSlugInput
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (!clean || clean.length < 3) {
      setSlugFeedback({
        status: 'error',
        message: 'الرابط يجب أن يتكون من 3 أحرف إنجليزية أو أرقام على الأقل.',
      });
      return;
    }
    if (clean === storeSlug) {
      setSlugFeedback({ status: 'valid', message: 'هذا هو رابط متجرك الحالي بالفعل.' });
      return;
    }

    setIsSavingSlug(true);
    setSlugFeedback({ status: 'idle' });
    try {
      if (onUpdateSlug) {
        const res = await onUpdateSlug(clean);
        if (res.success) {
          setSlugFeedback({ status: 'valid', message: '🎉 تم تحديث رابط المتجر بنجاح!' });
          setSyncMessage('🎉 تم تحديث وتفعيل رابط متجرك الجديد!');
          setTimeout(() => setSyncMessage(null), 3000);
        } else {
          setSlugFeedback({ status: 'error', message: res.error || 'تعذر تحديث الرابط.' });
        }
      }
    } catch (e: any) {
      setSlugFeedback({ status: 'error', message: e?.message || 'تعذر تحديث الرابط.' });
    } finally {
      setIsSavingSlug(false);
    }
  };

  const handleAiOptimizeSeo = () => {
    setIsAiOptimizingSeo(true);
    setTimeout(() => {
      const optimized = generateAIOptimizedSEO({
        id: storeId || 'store',
        slug: storeSlug,
        ownerId: currentUser?.id || 'merchant',
        createdAt: new Date().toISOString(),
        settings: editableSettings,
        products,
        orders,
        policies,
      });

      setEditableSettings((prev) => ({
        ...prev,
        metaTitle: optimized.metaTitle,
        metaDescription: optimized.metaDescription,
        metaKeywords: optimized.metaKeywords,
        heroTitle: optimized.heroTitle,
        heroSubtitle: optimized.heroSubtitle,
        announcementText: optimized.announcementText,
        geoCity: optimized.geoCity,
      }));

      setIsAiOptimizingSeo(false);
      setSyncMessage('✨ تم توليد وضبط محركات البحث (SEO) والظهور الجغرافي بالذكاء الاصطناعي بنجاح!');
      setTimeout(() => setSyncMessage(null), 3500);
    }, 400);
  };


  // Strictly deduplicated orders (eliminates duplicate order records across all metrics and views)
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

  // Accurate Metrics (Excludes Cancelled, Returned, and Refunded orders from Revenue)
  const validOrders = useMemo(
    () =>
      dedupedOrders.filter(
        (o) => o.status !== 'Cancelled' && o.status !== 'Returned' && o.status !== 'Refunded'
      ),
    [dedupedOrders]
  );
  const totalRevenue = useMemo(
    () =>
      Math.round(
        validOrders.reduce((sum, o) => {
          const net = (Number(o.grandTotal) || 0) - (Number(o.refundedAmount) || 0);
          return sum + Math.max(0, net);
        }, 0) * 100
      ) / 100,
    [validOrders]
  );
  const deliveredOrders = useMemo(() => dedupedOrders.filter((o) => o.status === 'Delivered').length, [dedupedOrders]);
  const inStockProducts = useMemo(() => products.filter((p) => p.inStock).length, [products]);

  const handleOrderStatusChange = (orderId: string, newStatus: OrderStatus, restockOnReturn?: boolean) => {
    const nowIso = new Date().toISOString();
    const updated = orders.map((o) => {
      if (o.id !== orderId) return o;
      const isDelivered = newStatus === 'Delivered';
      const isReturned = newStatus === 'Returned';
      const isPaid = newStatus === 'Paid';
      const isCOD = o.paymentMethod.toLowerCase().includes('cod') || o.paymentMethod.includes('استلام');

      return {
        ...o,
        status: newStatus,
        paidAt: isPaid ? (o.paidAt || nowIso) : o.paidAt,
        paymentStatus: isPaid ? ('paid' as const) : o.paymentStatus,
        bankTransferVerifiedAt: isPaid && o.bankTransferReceiptUrl ? (o.bankTransferVerifiedAt || nowIso) : o.bankTransferVerifiedAt,
        trackingNotes:
          isPaid && o.bankTransferReceiptUrl
            ? 'تم التحقق من إيصال التحويل البنكي واعتماد الدفع بنجاح — الطلب قيد التجهيز ✅'
            : o.trackingNotes,
        driverDeliveredAt: isDelivered ? (o.driverDeliveredAt || nowIso) : o.driverDeliveredAt,
        driverCashCollected: isDelivered && isCOD ? o.grandTotal : o.driverCashCollected,
        returnEligibleUntil: isDelivered
          ? new Date(new Date(nowIso).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
          : o.returnEligibleUntil,
        returnedAt: isReturned ? nowIso : o.returnedAt,
        returnStatus: isReturned ? 'completed' : o.returnStatus,
      };
    });

    onUpdateOrders(updated);

    // If restock requested on return, also increment product stock in state
    if (newStatus === 'Returned' && restockOnReturn) {
      const targetOrder = orders.find((o) => o.id === orderId);
      if (targetOrder && Array.isArray(targetOrder.items)) {
        const updatedProds = products.map((prod) => {
          const item = targetOrder.items.find((i) => i.productId === prod.id);
          if (item && typeof prod.stockQuantity === 'number') {
            const newStock = prod.stockQuantity + item.quantity;
            return {
              ...prod,
              stockQuantity: newStock,
              inStock: newStock > 0,
            };
          }
          return prod;
        });
        onUpdateProducts(updatedProds);
      }
    }

    if (selectedOrderDetail && selectedOrderDetail.id === orderId) {
      const updatedItem = updated.find((o) => o.id === orderId);
      if (updatedItem) setSelectedOrderDetail(updatedItem);
    }

    setSyncMessage(
      newStatus === 'Delivered'
        ? '✅ تم تأكيد توصيل الطلب وتحديث التتبع السحابي'
        : newStatus === 'Paid'
        ? '✅ تم اعتماد الإيصال وتأكيد دفع الطلب بنجاح!'
        : '📦 تم تحديث حالة الطلب بنجاح'
    );
    setTimeout(() => setSyncMessage(null), 2500);
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

  const handleSaveCourierDetails = (
    orderId: string,
    courierDetails: { 
      courierName: string; 
      courierPhone?: string; 
      trackingNumber: string; 
      trackingUrl?: string; 
      labelUrl?: string; 
      estimatedDeliveryDate?: string; 
    }
  ) => {
    const updated = orders.map((o) => (o.id === orderId ? {
      ...o,
      ...courierDetails,
    } : o));
    onUpdateOrders(updated);
    if (selectedOrderDetail && selectedOrderDetail.id === orderId) {
      setSelectedOrderDetail({
        ...selectedOrderDetail,
        ...courierDetails,
      });
    }
    setSyncMessage('🚚 تم حفظ وتحديث بيانات الشحن والتوصيل بنجاح');
    setTimeout(() => setSyncMessage(null), 2500);
  };

  const handleDispatchToDriver = async (order: Order) => {
    const driverPhone = editableSettings.driverPhone || order.courierPhone || prompt('أدخل رقم جوال المندوب (مثال: 9665XXXXXXXX):');
    if (!driverPhone) return;

    const cleanPhone = toWhatsAppNumber(driverPhone);
    const origin = window.location.origin;
    const targetStore = storeSlug || storeId || '';
    const driverLink = `${origin}/?store=${encodeURIComponent(targetStore)}&driver=${encodeURIComponent(order.id)}`;

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

    // Attempt background WhatsApp dispatch if connected
    if (isWhatsAppConnected) {
      setSyncMessage('⏳ جاري إرسال تفاصيل الشحنة للمندوب في الخلفية تلقائياً...');
      const sendResult = await WhatsAppClientBridge.sendMessage(cleanPhone, msg);
      if (sendResult.success) {
        setSyncMessage(`⚡ تم إرسال مهمة التوصيل للطلب #${order.id} إلى جوال المندوب في الخلفية بنجاح!`);
        setTimeout(() => setSyncMessage(null), 3500);

        // Update order status to Out for Delivery
        if (order.status === 'Received' || order.status === 'In Progress') {
          handleOrderStatusChange(order.id, 'Out for Delivery');
          if (selectedOrderDetail && selectedOrderDetail.id === order.id) {
            setSelectedOrderDetail({ ...selectedOrderDetail, status: 'Out for Delivery' });
          }
        }
        return;
      } else {
        // Fallback with user feedback
        console.warn('Background WhatsApp send failed:', sendResult.error);
        setSyncMessage('⚠️ تعذر الإرسال في الخلفية، سيتم فتح الرابط المباشر للواتساب.');
        setTimeout(() => setSyncMessage(null), 3000);
      }
    }

    // Default or Fallback: Direct WhatsApp link
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
      const updated = orders.map((o) => (o.id === order.id ? {
        ...o,
        status: 'Refunded' as OrderStatus,
        returnStatus: 'completed' as const,
        returnedAt: new Date().toISOString(),
        refundedAmount: order.grandTotal,
        refundedAt: new Date().toISOString(),
      } : o));
      onUpdateOrders(updated);
      if (selectedOrderDetail && selectedOrderDetail.id === order.id) {
        setSelectedOrderDetail({
          ...selectedOrderDetail,
          status: 'Refunded',
          returnStatus: 'completed' as const,
          returnedAt: new Date().toISOString(),
        });
      }
      alert('تم استرجاع المبلغ بنجاح عبر ميسر وتحديث حالة الطلب إلى مسترد.');
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
    const cleanPhone = toWhatsAppNumber(ord.customerPhone);
    const msg = buildMerchantCustomerUpdateMessage(ord, editableSettings, storeSlug || ord.storeSlug);
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  };

  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (p: Product) => {
    setEditingProduct(p);
    setIsProductModalOpen(true);
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

  const handleImportCsvProducts = (importedProducts: Product[], mode: 'append' | 'replace') => {
    let finalProducts: Product[];
    if (mode === 'replace') {
      finalProducts = importedProducts;
    } else {
      const existingMap = new Map(products.map((p) => [p.id, p]));
      importedProducts.forEach((p) => {
        existingMap.set(p.id, p);
      });
      finalProducts = Array.from(existingMap.values());
    }
    onUpdateProducts(finalProducts);
    setSyncMessage(`🎉 تم استيراد وتحديث ${importedProducts.length} منتج بنجاح!`);
    setTimeout(() => setSyncMessage(null), 3500);
  };

  const handleExportProductsCSV = () => {
    if (products.length === 0) return;
    const csvContent = exportProductsToCsv(products);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const cleanSlug = (storeSlug || 'store').replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `products-${cleanSlug}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleStoreLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingStoreLogo(true);
    try {
      const uploadedLogoUrl = await uploadImageToServer(file, {
        maxWidth: 400,
        maxHeight: 400,
        quality: 0.9,
        prefix: 'logo',
      });
      setEditableSettings((prev) => ({ ...prev, logoUrl: uploadedLogoUrl }));
    } catch {
      // Ignore
    } finally {
      setUploadingStoreLogo(false);
      e.target.value = '';
    }
  };

  const handleDownloadBackupJson = async () => {
    const ok = await StoreManager.downloadStoreBackupJson(storeId);
    if (ok) {
      setSyncMessage('📦 تم تحميل النسخة الاحتياطية للمتجر (JSON) بنجاح!');
      setTimeout(() => setSyncMessage(null), 3000);
    }
  };

  const handleRestoreComplete = (restoredStore: any) => {
    if (restoredStore.settings) {
      setEditableSettings({ ...restoredStore.settings });
      onUpdateSettings(restoredStore.settings);
    }
    if (Array.isArray(restoredStore.products)) {
      onUpdateProducts([...restoredStore.products]);
    }
    if (Array.isArray(restoredStore.orders)) {
      onUpdateOrders([...restoredStore.orders]);
    }
    if (Array.isArray(restoredStore.policies)) {
      setEditablePolicies([...restoredStore.policies]);
      onUpdatePolicies(restoredStore.policies);
    }
    setSyncMessage('🎉 تم استعادة النسخة الاحتياطية وحفظها محلياً على السيرفر بنجاح!');
    setTimeout(() => setSyncMessage(null), 3500);
  };

  const handleAddPromoCode = (code: string, type: 'percentage' | 'fixed', value: number) => {
    const cleanCode = code.trim().toUpperCase().replace(/\s+/g, '');
    if (!cleanCode || value <= 0) return;
    const existing = editableSettings.promoCodes || [];
    if (existing.some((p) => p.code.toUpperCase() === cleanCode)) return;

    const updatedPromos: PromoCode[] = [
      ...existing,
      {
        code: cleanCode,
        type,
        value: Number(value),
        active: true,
      },
    ];
    const nextSettings = { ...editableSettings, promoCodes: updatedPromos };
    setEditableSettings(nextSettings);
    onUpdateSettings(nextSettings);
    setSyncMessage(`🎟️ تم تفعيل كود الخصم ${cleanCode} بنجاح!`);
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
    const normalizedSettings = {
      ...editableSettings,
      whatsappNumber: toWhatsAppNumber(editableSettings.whatsappNumber),
    };
    setEditableSettings(normalizedSettings);
    onUpdateSettings(normalizedSettings);
    setSyncMessage('✅ تم حفظ إعدادات المتجر والشحن والدفع بنجاح!');
    setTimeout(() => setSyncMessage(null), 3000);
  };

  const handleSavePolicies = () => {
    onUpdatePolicies(editablePolicies);
    setSyncMessage('✅ تم حفظ سياسات المتجر والضمان بنجاح!');
    setTimeout(() => setSyncMessage(null), 3000);
  };

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
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  حالة التخزين: محفوظ محلياً على السيرفر 🟢 (آمن وغير مقيد بحجم المتصفح)
                </span>
                {/* Live Cloud Sync Badge */}
                <button
                  type="button"
                  onClick={handleForceSync}
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 border transition-colors cursor-pointer ${
                    cloudSyncStatus === 'syncing'
                      ? 'bg-amber-50 text-amber-700 border-amber-200 cursor-wait'
                      : cloudSyncStatus === 'error' || cloudSyncStatus === 'local_only'
                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                  }`}
                  title={cloudSyncStatus === 'synced' ? 'المتجر منشور سحابياً بالكامل - اضغط للتحديث الفوري' : 'اضغط لنشر ومزامنة كافة المنتجات سحابياً الآن'}
                >
                  {cloudSyncStatus === 'syncing' ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>جاري الحفظ سحابياً...</span>
                    </>
                  ) : cloudSyncStatus === 'error' || cloudSyncStatus === 'local_only' ? (
                    <>
                      <CloudOff className="w-3 h-3" />
                      <span>محفوظ محلياً (اضغط للنشر)</span>
                    </>
                  ) : (
                    <>
                      <Cloud className="w-3 h-3 text-emerald-600" />
                      <span>منشور سحابياً ✓</span>
                    </>
                  )}
                </button>
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

            <button
              onClick={() => setActiveTab('settings')}
              className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#2563EB] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-blue-200"
              title="تخصيص الرابط أو ربط دومين خاص"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>تخصيص الرابط / دومين خاص</span>
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
        <OrdersTab
          orders={orders}
          settings={editableSettings}
          brand={brand}
          onOrderStatusChange={handleOrderStatusChange}
          onDispatchToDriver={handleDispatchToDriver}
          onContactCustomerWhatsApp={handleContactCustomerWhatsApp}
          onSelectOrderDetail={(ord) => setSelectedOrderDetail(ord)}
          onOpenInvoice={(ord, fmt) => {
            setInvoiceInitialFormat(fmt || 'a4');
            setInvoiceOrder(ord);
          }}
          onOpenSettlement={() => setIsSettlementOpen(true)}
          onExportCSV={handleExportOrdersCSV}
          localTrackingNotes={localTrackingNotes}
          onTrackingNoteChange={(id, note) => setLocalTrackingNotes((prev) => ({ ...prev, [id]: note }))}
          onCommitTrackingNote={handleCommitTrackingNote}
          onOpenWhatsAppConnect={() => setIsWhatsAppConnectOpen(true)}
          isWhatsAppConnected={isWhatsAppConnected}
        />
      )}

      {/* TAB 2: PRODUCTS MANAGEMENT */}
      {activeTab === 'products' && (
        <ProductsTab
          products={products}
          settings={editableSettings}
          onExportCSV={handleExportProductsCSV}
          onOpenCsvImport={() => setShowCsvImportModal(true)}
          onDownloadBackupJson={handleDownloadBackupJson}
          onOpenRestoreBackupModal={() => setIsBackupRestoreModalOpen(true)}
          onClearCatalog={() => {
            if (confirm('هل أنت متأكد من رغبتك في حذف كافة المنتجات وتفريغ الكتالوج؟ لا يمكن التراجع عن هذا الإجراء.')) {
              onUpdateProducts([]);
              setSyncMessage('🗑️ تم تفريغ كتالوج المنتجات بنجاح');
              setTimeout(() => setSyncMessage(null), 2500);
            }
          }}
          onOpenAddProduct={handleOpenAddProduct}
          onOpenEditProduct={handleOpenEditProduct}
          onDeleteProduct={handleDeleteProduct}
          onToggleProductStock={handleToggleProductStock}
        />
      )}

      {/* TAB 3: STORE SETTINGS, SHIPPING, PROMO CODES & POLICIES */}
      {activeTab === 'settings' && (
        <SettingsTab
          editableSettings={editableSettings}
          setEditableSettings={setEditableSettings}
          brand={brand}
          storeSlug={storeSlug}
          customSlugInput={customSlugInput}
          setCustomSlugInput={setCustomSlugInput}
          slugFeedback={slugFeedback}
          setSlugFeedback={setSlugFeedback}
          isSavingSlug={isSavingSlug}
          onSaveCustomSlug={handleSaveCustomSlug}
          isAiOptimizingSeo={isAiOptimizingSeo}
          onAiOptimizeSeo={handleAiOptimizeSeo}
          uploadingStoreLogo={uploadingStoreLogo}
          onStoreLogoUpload={handleStoreLogoUpload}
          testSoundPlayed={testSoundPlayed}
          onTestSound={handleTestSound}
          desktopPermission={desktopPermission}
          onRequestDesktopPermission={handleRequestDesktopPermission}
          testTelegramLoading={testTelegramLoading}
          testTelegramStatus={testTelegramStatus}
          onTestTelegram={handleTestTelegram}
          testWebhookLoading={testWebhookLoading}
          testWebhookStatus={testWebhookStatus}
          onTestWebhook={handleTestWebhook}
          editablePolicies={editablePolicies}
          setEditablePolicies={setEditablePolicies}
          onSavePolicies={handleSavePolicies}
          onSaveSettingsForm={handleSaveSettingsForm}
          onAddPromoCode={handleAddPromoCode}
          onTogglePromoCode={handleTogglePromoCode}
          onDeletePromoCode={handleDeletePromoCode}
          onDownloadBackupJson={handleDownloadBackupJson}
          onOpenRestoreBackupModal={() => setIsBackupRestoreModalOpen(true)}
          onExportCSV={handleExportProductsCSV}
          onOpenWhatsAppConnect={() => setIsWhatsAppConnectOpen(true)}
          isWhatsAppConnected={isWhatsAppConnected}
        />
      )}

      {/* MODAL: ONE-CLICK STORE BACKUP RESTORE */}
      <StoreBackupRestoreModal
        isOpen={isBackupRestoreModalOpen}
        onClose={() => setIsBackupRestoreModalOpen(false)}
        currentStoreId={storeId}
        onRestoreComplete={handleRestoreComplete}
      />

      {/* MODAL: ORDER DETAILS */}
      <OrderDetailModal
        isOpen={Boolean(selectedOrderDetail)}
        onClose={() => setSelectedOrderDetail(null)}
        order={selectedOrderDetail}
        settings={editableSettings}
        onStatusChange={handleOrderStatusChange}
        onSaveCourier={handleSaveCourierDetails}
        onDispatchToDriver={handleDispatchToDriver}
        onOpenInvoice={(ord, fmt) => {
          setInvoiceInitialFormat(fmt || 'a4');
          setInvoiceOrder(ord);
        }}
        onRefundOrder={handleRefundOrder}
        onContactWhatsApp={handleContactCustomerWhatsApp}
        isRefunding={isRefunding}
        isWhatsAppConnected={isWhatsAppConnected}
      />


      {/* ZATCA Tax Invoice & Shipping Label Modal */}
      <InvoiceModal
        isOpen={Boolean(invoiceOrder)}
        onClose={() => setInvoiceOrder(null)}
        order={invoiceOrder}
        settings={editableSettings}
        initialFormat={invoiceInitialFormat}
      />

      {/* Driver Cash Settlement Ledger Modal */}
      <DriverSettlementModal
        isOpen={isSettlementOpen}
        onClose={() => setIsSettlementOpen(false)}
        orders={dedupedOrders}
        settings={editableSettings}
        onUpdateOrders={onUpdateOrders}
      />

      {/* Bulk CSV Product Import Modal */}
      <CsvProductImportModal
        isOpen={showCsvImportModal}
        onClose={() => setShowCsvImportModal(false)}
        onImport={handleImportCsvProducts}
        existingCount={products.length}
      />

      {/* MODAL: ADD / EDIT PRODUCT */}
      <ProductEditorModal
        isOpen={isProductModalOpen}
        onClose={() => {
          setIsProductModalOpen(false);
          setEditingProduct(null);
        }}
        editingProduct={editingProduct}
        settings={editableSettings}
        onSaveProduct={(productData) => {
          const isEditingExisting = Boolean(editingProduct && editingProduct.id);
          if (isEditingExisting && editingProduct) {
            const targetId = String(editingProduct.id);
            const updated = products.map((p) =>
              p.id === targetId
                ? (JSON.parse(
                    JSON.stringify({
                      ...p,
                      ...productData,
                      id: targetId,
                    })
                  ) as Product)
                : p
            );
            onUpdateProducts(updated);
            setEditingProduct(null);
            setSyncMessage('✨ تم تحديث بيانات المنتج وحفظها على السيرفر المحلي بنجاح!');
          } else {
            const uniqueId = generateUniqueProductId(products);
            const { id: _ignoredId, ...cleanProductData } = productData;
            const newP: Product = JSON.parse(
              JSON.stringify({
                ...cleanProductData,
                id: uniqueId,
              })
            );
            onUpdateProducts([...products, newP]);
            setEditingProduct(null);
            setSyncMessage('🎉 تم إضافة المنتج الجديد للمتجر وحفظه على السيرفر المحلي بنجاح!');
          }
          setTimeout(() => setSyncMessage(null), 3000);
        }}
      />

      {/* MODAL: WHATSAPP QR CODE CONNECT */}
      <WhatsAppConnectModal
        isOpen={isWhatsAppConnectOpen}
        onClose={() => setIsWhatsAppConnectOpen(false)}
        brandTheme={brand}
        onConnectionChange={(connected) => setIsWhatsAppConnected(connected)}
      />

    </div>
  );
};
