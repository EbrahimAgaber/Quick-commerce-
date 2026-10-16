import React, { useState, useEffect, useMemo } from 'react';
import { 
  StoreSettings, 
  Product, 
  Order, 
  StorePolicy, 
  CartItem,
  MerchantUser,
  StoreInstance
} from './types/store';
import { StoreStorage, DEFAULT_PRODUCTS, MODERN_RETAIL_THEME } from './services/storeStorage';
import { StoreManager } from './services/storeManager';
import { AuthService } from './services/authService';
import { onFirebaseAuthStateChanged } from './services/firebase';
import { injectBrandThemeStyles } from './utils/themeInjector';
import { matchesSearch } from './utils/arabicSearch';

// Layout & Components
import { Navbar, AppViewMode, DevicePreviewMode } from './components/layout/Navbar';
import { AnnouncementBar } from './components/layout/AnnouncementBar';
import { HeroBanner } from './components/storefront/HeroBanner';
import { CategoryFilter } from './components/storefront/CategoryFilter';
import { ProductGrid } from './components/storefront/ProductGrid';
import { ProductModal } from './components/storefront/ProductModal';
import { CartDrawer } from './components/storefront/CartDrawer';
import { CheckoutModal } from './components/storefront/CheckoutModal';
import { OrderSuccessModal } from './components/storefront/OrderSuccessModal';
import { OrderTrackerModal } from './components/storefront/OrderTrackerModal';
import { StorePoliciesModal } from './components/storefront/StorePoliciesModal';
import { BrandCustomizerModal } from './components/admin/BrandCustomizerModal';
import { StoreOnboardingWizard } from './components/builder/StoreOnboardingWizard';
import { StoreDashboard } from './components/builder/StoreDashboard';
import { SheetSimulator } from './components/admin/SheetSimulator';
import { AppsScriptHub } from './components/admin/AppsScriptHub';
import { AuthModal } from './components/auth/AuthModal';
import { Footer } from './components/layout/Footer';
import { QaReadinessDashboard } from './components/qa/QaReadinessDashboard';
import { FreeHostingModal } from './components/admin/FreeHostingModal';
import { Plus, Sparkles, RotateCcw, Eye, EyeOff } from 'lucide-react';

export default function App() {
  // Merchant User & Multi-Store Management
  const [currentUser, setCurrentUser] = useState<MerchantUser | null>(() => AuthService.getCurrentUser());
  const [allStores, setAllStores] = useState<StoreInstance[]>(() => StoreManager.getAllStores());
  const [activeStore, setActiveStore] = useState<StoreInstance>(() => StoreManager.getActiveStore());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isShopperPreviewOnly, setIsShopperPreviewOnly] = useState(false);

  // Active Store Database States
  const [settings, setSettings] = useState<StoreSettings>(() => activeStore.settings || StoreStorage.getSettings());
  const [products, setProducts] = useState<Product[]>(() => activeStore.products || StoreStorage.getProducts());
  const [orders, setOrders] = useState<Order[]>(() => activeStore.orders || StoreStorage.getOrders());
  const [policies, setPolicies] = useState<StorePolicy[]>(() => activeStore.policies || StoreStorage.getPolicies());

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
          name: fbUser.displayName || fbUser.email?.split('@')[0] || 'تاجر Quick E-Commerce',
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

  // Inject custom typography and brand colors whenever settings.brandTheme changes
  useEffect(() => {
    if (settings.brandTheme) {
      injectBrandThemeStyles(settings.brandTheme);
    }
  }, [settings.brandTheme]);

  // Handle URL parameters: ?store=<slug_or_id> and ?view=storefront|dashboard|sheet
  useEffect(() => {
    const resolveStoreFromUrl = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const storeParam = params.get('store');
        if (storeParam) {
          // 1. Try local memory
          let found = StoreManager.getStoreBySlug(storeParam) || StoreManager.getStoreById(storeParam);
          if (!found) {
            // 2. Fetch from Cloud Firestore across all devices
            found = await StoreManager.fetchStoreFromFirestore(storeParam);
          }
          if (found) {
            handleSelectStore(found.id);
          }
        }
      } catch (e) {
        console.warn('URL routing notice:', e);
      }
    };

    resolveStoreFromUrl();
  }, []);

  // UI View Modes - default to 'storefront' so anyone clicking the link sees the live e-commerce website
  const [viewMode, setViewMode] = useState<AppViewMode>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlView = params.get('view') as AppViewMode;
      if (urlView === 'dashboard' || urlView === 'sheet' || urlView === 'script' || urlView === 'storefront' || urlView === 'qa') {
        return urlView;
      }
    } catch {}
    return 'storefront';
  });
  const [devicePreview, setDevicePreview] = useState<DevicePreviewMode>('desktop');

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  // Cart State (Persisted in session/local)
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('storelink_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [orderNotes, setOrderNotes] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem('storelink_cart', JSON.stringify(cart));
    } catch (e) {
      console.warn('Cart persistence failed', e);
    }
  }, [cart]);

  // Modals
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isTrackerOpen, setIsTrackerOpen] = useState(false);
  const [trackerInitialId, setTrackerInitialId] = useState('');
  const [isPoliciesOpen, setIsPoliciesOpen] = useState(false);
  const [isBrandStudioOpen, setIsBrandStudioOpen] = useState(false);
  const [isNewStoreWizardOpen, setIsNewStoreWizardOpen] = useState(false);
  const [isFreeHostingOpen, setIsFreeHostingOpen] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

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
      // Category match
      if (activeCategory !== 'all' && p.category !== activeCategory) {
        return false;
      }
      // Search query match
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
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx].quantity += quantity;
        return updated;
      }
      return [...prev, { product, selectedVariant: variant, quantity }];
    });
  };

  const handleQuickAdd = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!product.inStock) return;
    const defaultVariant = product.variants && product.variants.length > 0 ? product.variants[0] : '';
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
        updated[index].quantity = newQty;
        return updated;
      });
    }
  };

  const handleRemoveItem = (index: number) => {
    setCart((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Checkout Success handler
  const handleOrderSuccess = (order: Order) => {
    StoreStorage.addOrder(order);
    setOrders(StoreStorage.getOrders());
    setCart([]);
    setIsCheckoutOpen(false);
    setIsCartOpen(false);
    setCompletedOrder(order);
  };

  const handleSelectStore = (storeId: string) => {
    StoreManager.setActiveStoreId(storeId);
    const store = StoreManager.getStoreById(storeId);
    if (store) {
      setActiveStore(store);
      setSettings(store.settings);
      setProducts(store.products);
      setOrders(store.orders);
      setPolicies(store.policies);
      StoreStorage.saveSettings(store.settings);
      StoreStorage.saveProducts(store.products);
      StoreStorage.saveOrders(store.orders);
      StoreStorage.savePolicies(store.policies);
    }
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

  // Sync from live Google Apps Script
  const handleSyncLiveData = (liveData: {
    settings?: Partial<StoreSettings>;
    products?: Product[];
    policies?: StorePolicy[];
  }) => {
    if (liveData.settings) {
      const merged = { ...settings, ...liveData.settings };
      handleUpdateSettings(merged);
    }
    if (liveData.products && liveData.products.length > 0) {
      handleUpdateProducts(liveData.products);
    }
    if (liveData.policies && liveData.policies.length > 0) {
      handleUpdatePolicies(liveData.policies);
    }
  };

  // Open Order Tracker with specific ID
  const handleOpenTrackerWithId = (orderId: string) => {
    setTrackerInitialId(orderId);
    setIsTrackerOpen(true);
  };

  const brand = settings.brandTheme || MODERN_RETAIL_THEME;

  return (
    <div 
      className="min-h-screen flex flex-col transition-colors duration-300"
      style={{
        backgroundColor: brand.backgroundColor || '#F8FAFC',
        color: brand.primaryColor || '#0F172A',
        fontFamily: brand.fontFamily ? `'${brand.fontFamily}', sans-serif` : 'Cairo, sans-serif',
      }}
    >
      {/* Merchant Shopper Preview Toggle Toast (If merchant is in preview mode) */}
      {currentUser && (
        <div className="bg-stone-900 text-white text-xs px-4 py-1.5 flex items-center justify-between z-50">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              {isShopperPreviewOnly ? 'وضع معاينة العميل (متجر نقي بدون أدوات الإدارة)' : 'وضع التاجر مفعّل'}
            </span>
          </div>
          <button
            onClick={() => setIsShopperPreviewOnly(!isShopperPreviewOnly)}
            className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-[11px] font-bold transition-colors cursor-pointer"
          >
            {isShopperPreviewOnly ? (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span>إظهار شريط التاجر</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>معاينة كمتسوق</span>
              </>
            )}
          </button>
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
        allStores={allStores}
        activeStoreId={activeStore.id}
        onSelectStore={handleSelectStore}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={() => {
          AuthService.logout();
          setCurrentUser(null);
        }}
        isShopperPreviewOnly={isShopperPreviewOnly}
        onOpenFreeHosting={() => setIsFreeHostingOpen(true)}
      />

      {/* VIEW MODE 1: BUSINESS OWNER DASHBOARD (QUICK E-COMMERCE HUB) */}
      {viewMode === 'dashboard' && (
        <main className="flex-1 w-full py-6">
          <StoreDashboard
            settings={settings}
            products={products}
            orders={orders}
            policies={policies}
            onUpdateSettings={handleUpdateSettings}
            onUpdateProducts={handleUpdateProducts}
            onUpdateOrders={handleUpdateOrders}
            onUpdatePolicies={handleUpdatePolicies}
            onResetDefault={handleResetDefault}
            onViewStorefront={() => setViewMode('storefront')}
            onOpenBrandStudio={() => setIsBrandStudioOpen(true)}
            onOpenNewStoreWizard={() => setIsNewStoreWizardOpen(true)}
            onSyncLiveData={handleSyncLiveData}
            currentUser={currentUser}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            onOpenFreeHosting={() => setIsFreeHostingOpen(true)}
          />
        </main>
      )}

      {/* VIEW MODE 2: CUSTOMER STOREFRONT */}
      {viewMode === 'storefront' && (
        <>
          <AnnouncementBar settings={settings} />

          {/* If mobile frame preview selected, wrap in simulated phone bezel */}
          {devicePreview === 'mobile' ? (
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
                    isMerchantLoggedIn={currentUser !== null && !isShopperPreviewOnly}
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
            <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
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
                isMerchantLoggedIn={currentUser !== null && !isShopperPreviewOnly}
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

                {/* Empty Catalog Quick Starter State */}
                {products.length === 0 ? (
                  <div className="py-16 text-center space-y-4 bg-white rounded-3xl border p-8 max-w-lg mx-auto shadow-xs" style={{ borderColor: brand.neutralColor }}>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto" style={{ backgroundColor: `${brand.accentColor}15`, color: brand.accentColor }}>
                      <Sparkles className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold" style={{ color: brand.primaryColor }}>
                        المتجر فارغ وجاهز لإضافة منتجاتك الخاصة
                      </h3>
                      <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto leading-relaxed">
                        يمكنك إضافة منتجاتك المخصصة من خلال جدول بيانات Google Sheet أو استعادة التشكيلة الافتراضية النموذجية.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                      <button
                        onClick={() => setViewMode('sheet')}
                        className="px-4 py-2.5 text-white rounded-xl text-xs font-bold shadow-xs transition-transform active:scale-95 flex items-center gap-1.5 cursor-pointer"
                        style={{ backgroundColor: brand.accentColor }}
                      >
                        <Plus className="w-4 h-4" />
                        <span>إضافة منتج من جدول البيانات</span>
                      </button>

                      <button
                        onClick={handleLoadDefaultProducts}
                        className="px-4 py-2.5 rounded-xl text-xs font-semibold border bg-white hover:bg-stone-50 text-stone-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                        style={{ borderColor: brand.neutralColor }}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>تحميل التشكيلة الافتراضية النموذجية</span>
                      </button>
                    </div>
                  </div>
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

          <Footer
            settings={settings}
            onOpenPolicies={() => setIsPoliciesOpen(true)}
            onOpenTracker={() => {
              setTrackerInitialId('');
              setIsTrackerOpen(true);
            }}
            onOpenBrandStudio={() => setIsBrandStudioOpen(true)}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            isMerchantLoggedIn={currentUser !== null}
          />
        </>
      )}

      {/* VIEW MODE 3: GOOGLE SHEET SIMULATOR (DATABASE TABS) */}
      {viewMode === 'sheet' && (
        <main className="flex-1 w-full bg-stone-100 py-6">
          <SheetSimulator
            settings={settings}
            products={products}
            orders={orders}
            policies={policies}
            onUpdateSettings={handleUpdateSettings}
            onUpdateProducts={handleUpdateProducts}
            onUpdateOrders={handleUpdateOrders}
            onUpdatePolicies={handleUpdatePolicies}
            onResetDefault={handleResetDefault}
            onSwitchToStore={() => setViewMode('storefront')}
            onOpenAppsScriptHub={() => setViewMode('script')}
            onOpenBrandStudio={() => setIsBrandStudioOpen(true)}
          />
        </main>
      )}

      {/* VIEW MODE 4: GOOGLE APPS SCRIPT ENGINE & LIVE SYNC */}
      {viewMode === 'script' && (
        <main className="flex-1 w-full bg-stone-50 py-6">
          <AppsScriptHub
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onSyncLiveData={handleSyncLiveData}
          />
        </main>
      )}

      {/* VIEW MODE 5: QA READINESS AUDIT & 210 USER JOURNEYS */}
      {viewMode === 'qa' && (
        <main className="flex-1 w-full bg-stone-100">
          <QaReadinessDashboard
            settings={settings}
            onBackToStorefront={() => setViewMode('storefront')}
            onBackToDashboard={() => setViewMode('dashboard')}
            onOpenBrandStudio={() => setIsBrandStudioOpen(true)}
            onOpenNewStoreWizard={() => setIsNewStoreWizardOpen(true)}
            onOpenCart={() => setIsCartOpen(true)}
            onOpenCheckout={() => setIsCheckoutOpen(true)}
            onOpenTracker={() => {
              setTrackerInitialId('');
              setIsTrackerOpen(true);
            }}
            onOpenPolicies={() => setIsPoliciesOpen(true)}
          />
        </main>
      )}

      {/* MODALS */}
      {/* 1. New Store Onboarding Wizard */}
      {isNewStoreWizardOpen && (
        <StoreOnboardingWizard
          isOpen={isNewStoreWizardOpen}
          onClose={() => setIsNewStoreWizardOpen(false)}
          currentSettings={settings}
          onComplete={(newSettings, initialProds) => {
            const newStore = StoreManager.createStore({
              storeName: newSettings.storeName,
              storeSubtitle: newSettings.storeSubtitle,
              ownerId: currentUser?.id || 'guest',
              tagline: newSettings.tagline,
              whatsappNumber: newSettings.whatsappNumber,
              currency: newSettings.currency,
              primaryColor: newSettings.brandTheme?.primaryColor || '#0F172A',
              accentColor: newSettings.brandTheme?.accentColor || '#2563EB',
              backgroundColor: newSettings.brandTheme?.backgroundColor || '#F8FAFC',
              logoLetter: newSettings.logoLetter || 'A',
              googleSheetUrl: newSettings.googleWebAppUrl,
              initialProducts: initialProds && initialProds.length > 0 ? initialProds : products,
            });
            handleSelectStore(newStore.id);
            setIsNewStoreWizardOpen(false);
            setViewMode('dashboard');
          }}
        />
      )}

      {/* 2. Brand & Setup Studio Modal */}
      {isBrandStudioOpen && (
        <BrandCustomizerModal
          isOpen={isBrandStudioOpen}
          onClose={() => setIsBrandStudioOpen(false)}
          settings={settings}
          onSaveSettings={handleUpdateSettings}
          onResetToDefault={handleResetDefault}
          onClearAllProducts={handleClearAllProducts}
        />
      )}

      {/* 3. Product Detail Modal */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          settings={settings}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={handleAddToCart}
          onOpenSizeGuide={() => setIsPoliciesOpen(true)}
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
      />

      {/* 5. Checkout Modal */}
      {isCheckoutOpen && (
        <CheckoutModal
          isOpen={isCheckoutOpen}
          onClose={() => setIsCheckoutOpen(false)}
          items={cart}
          settings={settings}
          orderNotes={orderNotes}
          onOrderSuccess={handleOrderSuccess}
        />
      )}

      {/* 6. Order Success Celebration Modal */}
      {completedOrder && (
        <OrderSuccessModal
          order={completedOrder}
          settings={settings}
          onClose={() => setCompletedOrder(null)}
          onTrackOrder={handleOpenTrackerWithId}
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

      {/* 9. Merchant User Auth Modal (Login / Register / Switch Account) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(user) => {
          setCurrentUser(user);
          setIsAuthModalOpen(false);
        }}
      />

      {/* 10. Free Hosting & Deployment Guide Modal */}
      <FreeHostingModal
        isOpen={isFreeHostingOpen}
        onClose={() => setIsFreeHostingOpen(false)}
        storeName={settings.storeName}
      />
    </div>
  );
}
