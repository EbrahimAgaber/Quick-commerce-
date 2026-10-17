import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { 
  StoreSettings, 
  Product, 
  Order, 
  StorePolicy, 
  CartItem,
  MerchantUser,
  StoreInstance,
  PromoCode
} from './types/store';
import { StoreStorage, DEFAULT_PRODUCTS, MODERN_RETAIL_THEME, safeSetLocalStorage } from './services/storeStorage';
import { StoreManager } from './services/storeManager';
import { AuthService } from './services/authService';
import { onFirebaseAuthStateChanged } from './services/firebase';
import { injectBrandThemeStyles } from './utils/themeInjector';
import { matchesSearch } from './utils/arabicSearch';
import { parseStoreRouteFromLocation } from './utils/urlRouter';

// Core Storefront Layout & Components (Eagerly loaded for instant First Contentful Paint)
import { Navbar, AppViewMode, DevicePreviewMode } from './components/layout/Navbar';
import { AnnouncementBar } from './components/layout/AnnouncementBar';
import { HeroBanner } from './components/storefront/HeroBanner';
import { CategoryFilter } from './components/storefront/CategoryFilter';
import { ProductGrid } from './components/storefront/ProductGrid';
import { ProductModal } from './components/storefront/ProductModal';
import { CartDrawer } from './components/storefront/CartDrawer';
import { OrderSuccessModal } from './components/storefront/OrderSuccessModal';
import { MerchantAuthGate } from './components/auth/MerchantAuthGate';
import { Footer } from './components/layout/Footer';
import { Plus, Sparkles, RotateCcw, Eye, EyeOff, Package, ShoppingBag, Store, Loader2 } from 'lucide-react';

// Code-Split Heavy Merchant & Secondary Modals via React.lazy
const SaaSLandingPage = lazy(() =>
  import('./components/layout/SaaSLandingPage').then((m) => ({ default: m.SaaSLandingPage }))
);
const StoreDashboard = lazy(() =>
  import('./components/builder/StoreDashboard').then((m) => ({ default: m.StoreDashboard }))
);
const StoreOnboardingWizard = lazy(() =>
  import('./components/builder/StoreOnboardingWizard').then((m) => ({ default: m.StoreOnboardingWizard }))
);
const BrandCustomizerModal = lazy(() =>
  import('./components/admin/BrandCustomizerModal').then((m) => ({ default: m.BrandCustomizerModal }))
);
const AuthModal = lazy(() =>
  import('./components/auth/AuthModal').then((m) => ({ default: m.AuthModal }))
);
const CheckoutModal = lazy(() =>
  import('./components/storefront/CheckoutModal').then((m) => ({ default: m.CheckoutModal }))
);
const OrderTrackerModal = lazy(() =>
  import('./components/storefront/OrderTrackerModal').then((m) => ({ default: m.OrderTrackerModal }))
);
const StorePoliciesModal = lazy(() =>
  import('./components/storefront/StorePoliciesModal').then((m) => ({ default: m.StorePoliciesModal }))
);

export default function App() {
  // Merchant User & Multi-Store Management
  const [currentUser, setCurrentUser] = useState<MerchantUser | null>(() => AuthService.getCurrentUser());
  const [allStores, setAllStores] = useState<StoreInstance[]>(() => StoreManager.getAllStores());
  const [activeStore, setActiveStore] = useState<StoreInstance>(() => StoreManager.getActiveStore());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');
  const [isShopperPreviewOnly, setIsShopperPreviewOnly] = useState(false);

  // Storefront Cloud Resolution States (Prevents flash of default demo store)
  const initialRoute = useMemo(() => parseStoreRouteFromLocation(), []);
  const [isResolvingStore, setIsResolvingStore] = useState<boolean>(() => {
    if (!initialRoute.storeSlug) return false;
    const cached =
      StoreManager.getStoreBySlug(initialRoute.storeSlug) ||
      StoreManager.getStoreById(initialRoute.storeSlug);
    return !cached;
  });
  const [storeNotFound, setStoreNotFound] = useState(false);

  // Active Store Database States
  const [settings, setSettings] = useState<StoreSettings>(() => activeStore.settings || StoreStorage.getSettings());
  const [products, setProducts] = useState<Product[]>(() => activeStore.products || StoreStorage.getProducts());
  const [orders, setOrders] = useState<Order[]>(() => activeStore.orders || StoreStorage.getOrders());
  const [policies, setPolicies] = useState<StorePolicy[]>(() => activeStore.policies || StoreStorage.getPolicies());

  // Only stores belonging to the currently logged-in merchant
  const merchantStores = useMemo(
    () => StoreManager.getMerchantStores(currentUser?.id),
    [allStores, currentUser]
  );

  // Strict ownership check: merchant controls only appear if the logged-in user owns the active store
  const isStoreOwner = Boolean(currentUser && activeStore.ownerId === currentUser.id);

  // Listen to local storage & cross-tab sync events
  useEffect(() => {
    const handleDbSync = () => {
      setSettings(StoreStorage.getSettings());
      setProducts(StoreStorage.getProducts());
      setOrders(StoreStorage.getOrders());
      setPolicies(StoreStorage.getPolicies());
    };

    const handleAuthChange = () => {
      setCurrentUser(AuthService.getCurrentUser());
    };

    const handleStoresChange = () => {
      const stores = StoreManager.getAllStores();
      setAllStores(stores);
      const curr = StoreManager.getActiveStore();
      setActiveStore(curr);
    };

    const unsubscribeFb = onFirebaseAuthStateChanged((fbUser) => {
      if (fbUser) {
        const merchant: MerchantUser = {
          id: fbUser.uid,
          name: fbUser.displayName || fbUser.email?.split('@')[0] || 'تاجر',
          email: fbUser.email || '',
          avatarUrl: fbUser.photoURL || undefined,
          createdAt: new Date().toISOString()
        };
        AuthService.setCurrentUser(merchant);
        setCurrentUser(merchant);

        // Fetch any cloud stores created by this merchant
        StoreManager.fetchUserStoresFromFirestore(fbUser.uid).catch(console.warn);
      }
    });

    window.addEventListener('storelink_db_updated', handleDbSync);
    window.addEventListener('storelink_auth_changed', handleAuthChange);
    window.addEventListener('storelink_stores_changed', handleStoresChange);

    return () => {
      unsubscribeFb();
      window.removeEventListener('storelink_db_updated', handleDbSync);
      window.removeEventListener('storelink_auth_changed', handleAuthChange);
      window.removeEventListener('storelink_stores_changed', handleStoresChange);
    };
  }, []);

  // Real-time Orders Subscription for Store Owners
  useEffect(() => {
    if (!isStoreOwner || !activeStore.id) return;

    const unsubscribeOrders = StoreManager.subscribeToStoreOrders(
      activeStore.id,
      (liveOrders) => {
        setOrders(liveOrders);
      }
    );

    return () => {
      if (unsubscribeOrders) unsubscribeOrders();
    };
  }, [isStoreOwner, activeStore.id]);

  // Inject custom typography and brand colors whenever settings.brandTheme changes
  useEffect(() => {
    if (settings.brandTheme) {
      injectBrandThemeStyles(settings.brandTheme);
    }
  }, [settings.brandTheme]);

  // UI View Modes:
  // - If `?store=<slug>` or `/s/<slug>` is present in the URL, open the customer's pure `'storefront'` directly.
  // - If visiting root `/` without `?store=`, show the SaaS platform `'landing'` page.
  const [viewMode, setViewMode] = useState<AppViewMode>(() => {
    if (initialRoute.viewParam === 'dashboard') return 'dashboard';
    if (initialRoute.storeSlug || initialRoute.viewParam === 'storefront') return 'storefront';
    return 'landing';
  });
  const [devicePreview, setDevicePreview] = useState<DevicePreviewMode>('desktop');

  // Modals State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isTrackerOpen, setIsTrackerOpen] = useState(false);
  const [trackerInitialId, setTrackerInitialId] = useState('');
  const [isPoliciesOpen, setIsPoliciesOpen] = useState(false);
  const [isBrandStudioOpen, setIsBrandStudioOpen] = useState(false);
  const [isNewStoreWizardOpen, setIsNewStoreWizardOpen] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  const handleSelectStore = (storeId: string) => {
    StoreManager.setActiveStoreId(storeId);
    const store = StoreManager.getStoreById(storeId);
    if (store) {
      setActiveStore(store);
      setSettings(store.settings);
      setProducts(store.products);
      setOrders(store.orders);
      setPolicies(store.policies);
      StoreStorage.hydrateStore({
        settings: store.settings,
        products: store.products,
        orders: store.orders,
        policies: store.policies,
      });
    }
  };

  // Handle URL parameters: ?store=<slug_or_id>&product=<product_id> or /s/<slug>
  useEffect(() => {
    const resolveStoreFromUrl = async () => {
      try {
        const { storeSlug, productId } = parseStoreRouteFromLocation();
        if (!storeSlug) return;

        // 1. Check local cache for instant render
        const localMatch =
          StoreManager.getStoreBySlug(storeSlug) || StoreManager.getStoreById(storeSlug);

        if (localMatch) {
          handleSelectStore(localMatch.id);
          setViewMode('storefront');
          if (productId) {
            const p = localMatch.products.find((item) => item.id === productId);
            if (p) setSelectedProduct(p);
          }
          // Refresh catalog from Cloud Firestore in background so returning shoppers get latest prices/products
          StoreManager.fetchStoreFromFirestore(storeSlug)
            .then((freshStore) => {
              if (freshStore) {
                handleSelectStore(freshStore.id);
                if (productId) {
                  const freshP = freshStore.products.find((item) => item.id === productId);
                  if (freshP) setSelectedProduct(freshP);
                }
              }
            })
            .catch(() => {});
          return;
        }

        // 2. First visit on this device -> Fetch from Cloud Firestore with skeleton loader
        setIsResolvingStore(true);
        setStoreNotFound(false);
        const cloudStore = await StoreManager.fetchStoreFromFirestore(storeSlug);
        setIsResolvingStore(false);

        if (cloudStore) {
          handleSelectStore(cloudStore.id);
          setViewMode('storefront');
          if (productId) {
            const p = cloudStore.products.find((item) => item.id === productId);
            if (p) setSelectedProduct(p);
          }
        } else {
          setStoreNotFound(true);
        }
      } catch (e) {
        setIsResolvingStore(false);
        console.warn('URL routing notice:', e);
      }
    };

    resolveStoreFromUrl();
  }, []);

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  // Store-Scoped Cart State (Prevents cart items from Store A leaking into Store B)
  const cartStorageKey = `storelink_cart_${activeStore.id}`;
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(`storelink_cart_${activeStore.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [orderNotes, setOrderNotes] = useState('');

  // Reload store-scoped cart when switching activeStore.id
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`storelink_cart_${activeStore.id}`);
      setCart(saved ? JSON.parse(saved) : []);
      setAppliedPromo(null);
    } catch {
      setCart([]);
    }
  }, [activeStore.id]);

  // Persist cart to store-scoped localStorage key
  useEffect(() => {
    safeSetLocalStorage(cartStorageKey, JSON.stringify(cart));
  }, [cart, cartStorageKey]);

  // Derived Category Lists & Counts
  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map((p) => p.category))).filter(Boolean);
    return cats;
  }, [products]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: products.length };
    products.forEach((p) => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    return counts;
  }, [products]);

  // Filtered Products using Arabic diacritic-tolerant fuzzy normalization
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (activeCategory !== 'all' && p.category !== activeCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const matches = matchesSearch(searchQuery, [
          p.name,
          p.category,
          p.description,
          p.fabricComposition,
          p.colorName,
          ...(p.variants || []),
        ]);
        if (!matches) return false;
      }
      return true;
    });
  }, [products, activeCategory, searchQuery]);

  // Cart Calculations
  const cartCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => {
      const price = item.product.salePrice ?? item.product.price;
      return acc + price * item.quantity;
    }, 0);
  }, [cart]);

  // Cart handlers
  const handleAddToCart = (product: Product, variant: string, quantity: number) => {
    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (item) => item.product.id === product.id && item.selectedVariant === variant
      );
      const maxAllowed =
        product.stockQuantity !== undefined && product.stockQuantity > 0
          ? product.stockQuantity
          : 99;
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx].quantity = Math.min(maxAllowed, updated[existingIdx].quantity + quantity);
        return updated;
      }
      return [...prev, { product, selectedVariant: variant, quantity: Math.min(maxAllowed, quantity) }];
    });
  };

  // Smart Quick Add: If product has multiple variants, open ProductModal so buyer picks their option
  const handleQuickAdd = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!product.inStock) return;
    if (product.variants && product.variants.length > 1) {
      setSelectedProduct(product);
      return;
    }
    const defaultVariant = product.variants && product.variants.length > 0 ? product.variants[0] : 'الخيار الافتراضي';
    handleAddToCart(product, defaultVariant, 1);
    setJustAddedId(product.id);
    setTimeout(() => setJustAddedId(null), 1200);
  };

  const handleUpdateQuantity = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(index);
    } else {
      setCart((prev) => {
        const updated = [...prev];
        const maxStock = updated[index].product.stockQuantity;
        updated[index].quantity = maxStock !== undefined ? Math.min(maxStock, newQty) : newQty;
        return updated;
      });
    }
  };

  const handleRemoveItem = (index: number) => {
    setCart((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Checkout Success handler
  const handleOrderSuccess = (order: Order) => {
    StoreManager.submitOrderToStore(activeStore.id, order);
    setOrders(StoreStorage.getOrders());
    setProducts(StoreStorage.getProducts());
    setActiveStore(StoreManager.getActiveStore());
    setAllStores(StoreManager.getAllStores());
    setCart([]);
    setAppliedPromo(null);
    setIsCheckoutOpen(false);
    setIsCartOpen(false);
    setCompletedOrder(order);
  };

  // Admin DB Updaters
  const handleUpdateSettings = (newSettings: StoreSettings) => {
    StoreStorage.saveSettings(newSettings);
    setSettings(newSettings);
    const updatedStore: StoreInstance = { ...activeStore, settings: newSettings };
    StoreManager.updateStore(updatedStore);
    setActiveStore(updatedStore);
    setAllStores(StoreManager.getAllStores());
  };

  const handleUpdateProducts = (newProducts: Product[]) => {
    StoreStorage.saveProducts(newProducts);
    setProducts(newProducts);
    const updatedStore: StoreInstance = { ...activeStore, products: newProducts };
    StoreManager.updateStore(updatedStore);
    setActiveStore(updatedStore);
    setAllStores(StoreManager.getAllStores());
  };

  const handleUpdateOrders = (newOrders: Order[]) => {
    newOrders.forEach((updatedOrder) => {
      const prev = orders.find((o) => o.id === updatedOrder.id);
      if (!prev || prev.status !== updatedOrder.status || prev.trackingNotes !== updatedOrder.trackingNotes) {
        StoreManager.updateOrderInStore(activeStore.id, updatedOrder);
      }
    });
    StoreStorage.saveOrders(newOrders);
    setOrders(newOrders);
    const updatedStore: StoreInstance = { ...activeStore, orders: newOrders };
    StoreManager.updateStore(updatedStore);
    setActiveStore(updatedStore);
    setAllStores(StoreManager.getAllStores());
  };

  const handleUpdatePolicies = (newPolicies: StorePolicy[]) => {
    StoreStorage.savePolicies(newPolicies);
    setPolicies(newPolicies);
    const updatedStore: StoreInstance = { ...activeStore, policies: newPolicies };
    StoreManager.updateStore(updatedStore);
    setActiveStore(updatedStore);
    setAllStores(StoreManager.getAllStores());
  };

  const handleResetDefault = () => {
    StoreStorage.resetToDefault();
    setSettings(StoreStorage.getSettings());
    setProducts(StoreStorage.getProducts());
    setOrders(StoreStorage.getOrders());
    setPolicies(StoreStorage.getPolicies());
    const updatedStore: StoreInstance = {
      ...activeStore,
      settings: StoreStorage.getSettings(),
      products: StoreStorage.getProducts(),
      orders: StoreStorage.getOrders(),
      policies: StoreStorage.getPolicies(),
    };
    StoreManager.updateStore(updatedStore);
    setActiveStore(updatedStore);
    setAllStores(StoreManager.getAllStores());
  };

  const handleClearAllProducts = () => {
    handleUpdateProducts([]);
  };

  const handleLoadDefaultProducts = () => {
    handleUpdateProducts(DEFAULT_PRODUCTS);
  };

  const handleOpenTrackerWithId = (orderId: string) => {
    setTrackerInitialId(orderId);
    setIsTrackerOpen(true);
  };

  // Wizard completion handler (respects empty vs sample catalog choice & custom slug)
  const handleWizardComplete = (
    newSettings: StoreSettings,
    initialProds?: Product[],
    customSlug?: string
  ) => {
    const newStore = StoreManager.createStore({
      storeName: newSettings.storeName,
      storeSubtitle: newSettings.storeSubtitle,
      slug: customSlug,
      businessType: newSettings.businessType,
      ownerId: currentUser?.id || 'guest',
      tagline: newSettings.tagline,
      whatsappNumber: newSettings.whatsappNumber,
      currency: newSettings.currency,
      primaryColor: newSettings.brandTheme?.primaryColor || '#0F172A',
      accentColor: newSettings.brandTheme?.accentColor || '#2563EB',
      backgroundColor: newSettings.brandTheme?.backgroundColor || '#F8FAFC',
      logoLetter: newSettings.logoLetter || 'S',
      freeShippingThreshold: newSettings.freeShippingThreshold,
      standardShippingRate: newSettings.standardShippingRate,
      initialProducts: initialProds ?? [],
    });
    handleSelectStore(newStore.id);
    setIsNewStoreWizardOpen(false);
    setViewMode('dashboard');
  };

  // Auth Success handler (awaits Firestore stores before deciding whether to open Wizard or Dashboard)
  const handleAuthSuccess = async (user: MerchantUser) => {
    setCurrentUser(user);
    setIsAuthModalOpen(false);
    try {
      const cloudStores = await StoreManager.fetchUserStoresFromFirestore(user.id);
      const owned = cloudStores.length > 0 ? cloudStores : StoreManager.getMerchantStores(user.id);
      if (owned.length > 0) {
        handleSelectStore(owned[0].id);
        setViewMode('dashboard');
      } else {
        setIsNewStoreWizardOpen(true);
      }
    } catch {
      const owned = StoreManager.getMerchantStores(user.id);
      if (owned.length > 0) {
        handleSelectStore(owned[0].id);
        setViewMode('dashboard');
      } else {
        setIsNewStoreWizardOpen(true);
      }
    }
  };

  const brand = settings.brandTheme || MODERN_RETAIL_THEME;

  // STORE LOADING SKELETON (When resolving a cloud store on first visit)
  if (isResolvingStore) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#0F172A] text-white flex items-center justify-center shadow-lg mb-4 animate-pulse">
          <Loader2 className="w-7 h-7 animate-spin text-[#86EFAC]" />
        </div>
        <h2 className="text-base sm:text-lg font-bold text-stone-900">جاري تحميل المتجر...</h2>
        <p className="text-xs text-stone-500 mt-1">يرجى الانتظار لحظات لتجهيز قائمة المنتجات</p>
      </div>
    );
  }

  // STORE NOT FOUND SCREEN (When an invalid `?store=` slug is visited)
  if (storeNotFound) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-white rounded-3xl border border-stone-200 p-8 shadow-sm space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <Store className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-black text-stone-900">عذراً، هذا المتجر غير موجود</h2>
          <p className="text-xs text-stone-500 leading-relaxed">
            الرابط الذي قمت بزيارته غير مرتبط بأي متجر نشط حالياً. تأكد من صحة الرابط أو أنشئ متجرك الإلكتروني مجاناً.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
            <button
              onClick={() => {
                setStoreNotFound(false);
                window.history.replaceState({}, '', '/');
                setViewMode('landing');
              }}
              className="px-5 py-2.5 bg-[#0F172A] hover:bg-stone-800 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              العودة للصفحة الرئيسية للمنصة
            </button>
          </div>
        </div>
      </div>
    );
  }

  // VIEW MODE 0: SAAS LANDING PAGE (Root `/` when no `?store=` is specified)
  if (viewMode === 'landing') {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen bg-[#0F172A] flex items-center justify-center text-white">
            <Loader2 className="w-6 h-6 animate-spin text-[#86EFAC]" />
          </div>
        }
      >
        <SaaSLandingPage
          currentUser={currentUser}
          merchantStores={merchantStores}
          onOpenAuth={() => {
            setAuthInitialMode('login');
            setIsAuthModalOpen(true);
          }}
          onStartCreateStore={() => {
            if (!currentUser) {
              setAuthInitialMode('register');
              setIsAuthModalOpen(true);
            } else {
              setIsNewStoreWizardOpen(true);
            }
          }}
          onOpenDashboard={() => {
            if (merchantStores.length > 0) {
              handleSelectStore(merchantStores[0].id);
            }
            setViewMode('dashboard');
          }}
          onPreviewDemoStore={() => {
            setViewMode('storefront');
          }}
        />

        {isNewStoreWizardOpen && (
          <StoreOnboardingWizard
            isOpen={isNewStoreWizardOpen}
            onClose={() => setIsNewStoreWizardOpen(false)}
            currentSettings={settings}
            onComplete={handleWizardComplete}
          />
        )}

        {isAuthModalOpen && (
          <AuthModal
            isOpen={isAuthModalOpen}
            initialMode={authInitialMode}
            onClose={() => setIsAuthModalOpen(false)}
            onSuccess={handleAuthSuccess}
          />
        )}
      </Suspense>
    );
  }

  return (
    <div 
      className="min-h-screen flex flex-col transition-colors duration-300"
      style={{
        backgroundColor: brand.backgroundColor || '#F8FAFC',
        color: brand.primaryColor || '#0F172A',
        fontFamily: brand.fontFamily ? `'${brand.fontFamily}', sans-serif` : 'Cairo, sans-serif',
      }}
    >
      {/* Merchant Shopper Preview Toggle Toast (Strictly shown ONLY to the verified store owner) */}
      {isStoreOwner && (
        <div className="bg-stone-900 text-white text-xs px-4 py-1.5 flex items-center justify-between z-50">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              {isShopperPreviewOnly ? 'وضع معاينة المتسوق (كما يراه عملاؤك تماماً)' : 'وضع مالك المتجر مفعّل'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('landing')}
              className="px-2.5 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-stone-200 text-[11px] font-medium transition-colors cursor-pointer"
            >
              الرئيسية للمنصة
            </button>
            <button
              onClick={() => setIsShopperPreviewOnly(!isShopperPreviewOnly)}
              className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-[11px] font-bold transition-colors cursor-pointer"
            >
              {isShopperPreviewOnly ? (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>إظهار أدوات الإدارة</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>معاينة كمتسوق</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Top Navigation */}
      <Navbar
        settings={settings}
        cartCount={cartCount}
        cartTotal={cartTotal}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenTracker={() => {
          setTrackerInitialId('');
          setIsTrackerOpen(true);
        }}
        onOpenPolicies={() => setIsPoliciesOpen(true)}
        onOpenBrandStudio={() => setIsBrandStudioOpen(true)}
        onOpenNewStoreWizard={() => setIsNewStoreWizardOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        devicePreview={devicePreview}
        onDevicePreviewChange={setDevicePreview}
        currentUser={currentUser}
        isStoreOwner={isStoreOwner}
        merchantStores={merchantStores}
        activeStoreId={activeStore.id}
        activeStoreSlug={activeStore.slug}
        onSelectStore={handleSelectStore}
        onOpenAuth={() => {
          setAuthInitialMode('login');
          setIsAuthModalOpen(true);
        }}
        onLogout={() => {
          AuthService.logout();
          setCurrentUser(null);
          setViewMode('landing');
        }}
        isShopperPreviewOnly={isShopperPreviewOnly}
      />

      {/* VIEW MODE 1: BUSINESS OWNER DASHBOARD (SIMPLE MERCHANT HUB) */}
      {viewMode === 'dashboard' && (
        <main className="flex-1 w-full py-4 sm:py-6">
          {!currentUser ? (
            <MerchantAuthGate
              settings={settings}
              onOpenAuth={() => {
                setAuthInitialMode('login');
                setIsAuthModalOpen(true);
              }}
              onBackToStore={() => setViewMode('storefront')}
              targetViewName="لوحة تحكم المتجر"
            />
          ) : (
            <Suspense
              fallback={
                <div className="py-20 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-[#2563EB]" />
                </div>
              }
            >
              <StoreDashboard
                storeSlug={activeStore.slug}
                settings={settings}
                products={products}
                orders={orders}
                policies={policies}
                onUpdateSettings={handleUpdateSettings}
                onUpdateProducts={handleUpdateProducts}
                onUpdateOrders={handleUpdateOrders}
                onUpdatePolicies={handleUpdatePolicies}
                onViewStorefront={() => setViewMode('storefront')}
                onOpenBrandStudio={() => setIsBrandStudioOpen(true)}
                onOpenNewStoreWizard={() => setIsNewStoreWizardOpen(true)}
                currentUser={currentUser}
              />
            </Suspense>
          )}
        </main>
      )}

      {/* VIEW MODE 2: CUSTOMER STOREFRONT */}
      {viewMode === 'storefront' && (
        <>
          <AnnouncementBar settings={settings} />

          {/* If mobile frame preview selected by owner, wrap in simulated phone bezel */}
          {isStoreOwner && !isShopperPreviewOnly && devicePreview === 'mobile' ? (
            <div className="flex-1 py-8 px-4 flex justify-center bg-stone-300/60">
              <div 
                className="w-[390px] min-h-[844px] rounded-[44px] shadow-2xl border-8 border-stone-800 overflow-hidden flex flex-col relative"
                style={{ backgroundColor: brand.backgroundColor || '#F8FAFC' }}
              >
                {/* Simulated Phone Notch */}
                <div className="h-6 bg-stone-800 w-36 mx-auto rounded-b-2xl flex items-center justify-center">
                  <div className="w-10 h-1 bg-stone-700 rounded-full" />
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <HeroBanner
                    settings={settings}
                    onExploreClick={() => {
                      const el = document.getElementById('catalog-section');
                      el?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    onOpenBrandStudio={() => setIsBrandStudioOpen(true)}
                    onOpenTracker={() => {
                      setTrackerInitialId('');
                      setIsTrackerOpen(true);
                    }}
                    isMerchantLoggedIn={isStoreOwner && !isShopperPreviewOnly}
                  />

                  {categories.length > 0 && (
                    <CategoryFilter
                      categories={categories}
                      activeCategory={activeCategory}
                      onSelectCategory={setActiveCategory}
                      categoryCounts={categoryCounts}
                      brandTheme={brand}
                    />
                  )}

                  <ProductGrid
                    products={filteredProducts}
                    settings={settings}
                    onSelectProduct={setSelectedProduct}
                    onQuickAdd={handleQuickAdd}
                    justAddedId={justAddedId}
                    onResetFilters={() => {
                      setActiveCategory('all');
                      setSearchQuery('');
                    }}
                    isFiltered={activeCategory !== 'all' || !!searchQuery}
                  />
                </div>

                {/* Simulated Phone Home Indicator */}
                <div className="h-4 flex items-center justify-center">
                  <div className="w-24 h-1 bg-stone-400 rounded-full" />
                </div>
              </div>
            </div>
          ) : (
            <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full pb-24 sm:pb-8">
              <HeroBanner
                settings={settings}
                onExploreClick={() => {
                  const el = document.getElementById('catalog-section');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                onOpenBrandStudio={() => setIsBrandStudioOpen(true)}
                onOpenTracker={() => {
                  setTrackerInitialId('');
                  setIsTrackerOpen(true);
                }}
                isMerchantLoggedIn={isStoreOwner && !isShopperPreviewOnly}
              />

              <div id="catalog-section">
                {categories.length > 0 && (
                  <CategoryFilter
                    categories={categories}
                    activeCategory={activeCategory}
                    onSelectCategory={setActiveCategory}
                    categoryCounts={categoryCounts}
                    brandTheme={brand}
                  />
                )}

                {/* Empty Catalog State: strictly separated between Store Owner vs. Customer Visitor */}
                {products.length === 0 ? (
                  isStoreOwner && !isShopperPreviewOnly ? (
                    <div className="py-16 text-center space-y-4 bg-white rounded-3xl border p-8 max-w-lg mx-auto shadow-xs" style={{ borderColor: brand.neutralColor }}>
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto" style={{ backgroundColor: `${brand.accentColor}15`, color: brand.accentColor }}>
                        <Sparkles className="w-7 h-7" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold" style={{ color: brand.primaryColor }}>
                          متجرك جاهز لإضافة منتجاتك الأولى
                        </h3>
                        <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto leading-relaxed">
                          أضف منتجاتك وأسعارها وصورها بسهولة من لوحة تحكم المتجر أو قم بتحميل تشكيلة نموذجية للتجربة.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                        <button
                          onClick={() => setViewMode('dashboard')}
                          className="px-4 py-2.5 text-white rounded-xl text-xs font-bold shadow-xs transition-transform active:scale-95 flex items-center gap-1.5 cursor-pointer"
                          style={{ backgroundColor: brand.accentColor }}
                        >
                          <Plus className="w-4 h-4" />
                          <span>إضافة منتجات من لوحة التحكم</span>
                        </button>

                        <button
                          onClick={handleLoadDefaultProducts}
                          className="px-4 py-2.5 rounded-xl text-xs font-semibold border bg-white hover:bg-stone-50 text-stone-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                          style={{ borderColor: brand.neutralColor }}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>تحميل تشكيلة نموذجية</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-16 text-center space-y-3 bg-white rounded-3xl border p-8 max-w-md mx-auto shadow-xs" style={{ borderColor: brand.neutralColor }}>
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto" style={{ backgroundColor: `${brand.accentColor}15`, color: brand.accentColor }}>
                        <Package className="w-6 h-6" />
                      </div>
                      <h3 className="text-base font-bold" style={{ color: brand.primaryColor }}>
                        تشكيلة جديدة قريباً
                      </h3>
                      <p className="text-xs text-stone-500 max-w-xs mx-auto leading-relaxed">
                        يتم حالياً تجهيز وإضافة المنتجات الجديدة في {settings.storeName}. يرجى زيارة المتجر قريباً!
                      </p>
                    </div>
                  )
                ) : (
                  <ProductGrid
                    products={filteredProducts}
                    settings={settings}
                    onSelectProduct={setSelectedProduct}
                    onQuickAdd={handleQuickAdd}
                    justAddedId={justAddedId}
                    onResetFilters={() => {
                      setActiveCategory('all');
                      setSearchQuery('');
                    }}
                    isFiltered={activeCategory !== 'all' || !!searchQuery}
                  />
                )}
              </div>
            </main>
          )}

          {/* Sticky Mobile Bottom Cart Bar for High Mobile Conversion */}
          {cartCount > 0 && !isCartOpen && !isCheckoutOpen && (
            <div className="fixed bottom-4 inset-x-4 z-40 sm:hidden animate-in fade-in">
              <button
                onClick={() => setIsCartOpen(true)}
                className="w-full py-3.5 px-5 rounded-2xl text-white shadow-xl flex items-center justify-between font-bold text-sm active:scale-95 transition-transform cursor-pointer"
                style={{ backgroundColor: brand.primaryColor }}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-6 h-6 rounded-full text-xs font-black flex items-center justify-center"
                    style={{ backgroundColor: brand.accentColor, color: '#ffffff' }}
                  >
                    {cartCount}
                  </span>
                  <span>عرض السلة وإتمام الطلب</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono">
                  <span>{cartTotal.toLocaleString('en-US')}</span>
                  <span>{settings.currency}</span>
                  <ShoppingBag className="w-4 h-4 mr-1" style={{ color: brand.highlightColor || '#86EFAC' }} />
                </div>
              </button>
            </div>
          )}

          <Footer
            settings={settings}
            onOpenPolicies={() => setIsPoliciesOpen(true)}
            onOpenTracker={() => {
              setTrackerInitialId('');
              setIsTrackerOpen(true);
            }}
          />
        </>
      )}

      {/* MODALS */}
      <Suspense fallback={null}>
        {/* 1. New Store Onboarding Wizard */}
        {isNewStoreWizardOpen && (
          <StoreOnboardingWizard
            isOpen={isNewStoreWizardOpen}
            onClose={() => setIsNewStoreWizardOpen(false)}
            currentSettings={settings}
            onComplete={handleWizardComplete}
          />
        )}

        {/* 2. Brand & Setup Studio Modal (Store Owner Only) */}
        {isBrandStudioOpen && isStoreOwner && (
          <BrandCustomizerModal
            isOpen={isBrandStudioOpen}
            onClose={() => setIsBrandStudioOpen(false)}
            settings={settings}
            onSaveSettings={handleUpdateSettings}
            onResetToDefault={handleResetDefault}
            onClearAllProducts={handleClearAllProducts}
          />
        )}

        {/* 5. Checkout Modal */}
        {isCheckoutOpen && (
          <CheckoutModal
            isOpen={isCheckoutOpen}
            onClose={() => setIsCheckoutOpen(false)}
            items={cart}
            settings={settings}
            orderNotes={orderNotes}
            appliedPromo={appliedPromo}
            onOrderSuccess={handleOrderSuccess}
          />
        )}

        {/* 7. Live Order Tracker Modal */}
        {isTrackerOpen && (
          <OrderTrackerModal
            isOpen={isTrackerOpen}
            onClose={() => {
              setIsTrackerOpen(false);
              setTrackerInitialId('');
            }}
            storeId={activeStore.id}
            orders={orders}
            settings={settings}
            initialOrderId={trackerInitialId}
          />
        )}

        {/* 8. Store Policies & Specs Modal */}
        {isPoliciesOpen && (
          <StorePoliciesModal
            isOpen={isPoliciesOpen}
            onClose={() => setIsPoliciesOpen(false)}
            policies={policies}
          />
        )}

        {/* 9. Merchant User Auth Modal */}
        {isAuthModalOpen && (
          <AuthModal
            isOpen={isAuthModalOpen}
            initialMode={authInitialMode}
            onClose={() => setIsAuthModalOpen(false)}
            onSuccess={handleAuthSuccess}
          />
        )}
      </Suspense>

      {/* 3. Product Detail Modal */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          settings={settings}
          storeSlug={activeStore.slug}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={handleAddToCart}
        />
      )}

      {/* 4. Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onProceedToCheckout={() => {
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
        settings={settings}
        orderNotes={orderNotes}
        onOrderNotesChange={setOrderNotes}
        appliedPromo={appliedPromo}
        onApplyPromo={setAppliedPromo}
      />

      {/* 6. Order Success Celebration Modal */}
      {completedOrder && (
        <OrderSuccessModal
          order={completedOrder}
          settings={settings}
          onClose={() => setCompletedOrder(null)}
          onTrackOrder={handleOpenTrackerWithId}
        />
      )}
    </div>
  );
}
