import React, { useState, useEffect, useMemo, useRef, Suspense, lazy } from 'react';
import { MotionConfig } from 'motion/react';
import { 
  StoreSettings, 
  Product, 
  Order, 
  StorePolicy, 
  CartItem,
  MerchantUser,
  StoreInstance,
  PromoCode,
  getProductUnitMeta
} from './types/store';
import { StoreStorage, DEFAULT_PRODUCTS, MODERN_RETAIL_THEME, safeSetLocalStorage } from './services/storeStorage';
import { StoreManager } from './services/storeManager';
import { AuthService } from './services/authService';
import { onFirebaseAuthStateChanged, auth } from './services/firebase';
import { injectBrandThemeStyles } from './utils/themeInjector';
import { initializeMarketingPixels } from './utils/analytics';
import { matchesSearch } from './utils/arabicSearch';
import { parseStoreRouteFromLocation } from './utils/urlRouter';
import { injectStoreSEO, injectPlatformSEO } from './utils/seoManager';
import { isPlatformSuperOwner } from './utils/security';

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
import { OrderNotificationToast } from './components/common/OrderNotificationToast';
import { NotificationHub } from './services/notificationService';
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
const DriverDispatchView = lazy(() =>
  import('./components/driver/DriverDispatchView').then((m) => ({ default: m.DriverDispatchView }))
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
const CaptainPortalModal = lazy(() =>
  import('./components/captain/CaptainPortalModal').then((m) => ({ default: m.CaptainPortalModal }))
);
const PlatformOwnerPortalModal = lazy(() =>
  import('./components/admin/PlatformOwnerPortalModal').then((m) => ({ default: m.PlatformOwnerPortalModal }))
);

export default function App() {
  // Merchant User & Multi-Store Management
  const [currentUser, setCurrentUser] = useState<MerchantUser | null>(() => AuthService.getCurrentUser());
  const [allStores, setAllStores] = useState<StoreInstance[]>(() => StoreManager.getAllStores());
  // When the URL targets a specific store that is already cached, start with THAT store
  // (never the last-active/demo store) so the shopper never sees a wrong store name flash.
  const [activeStore, setActiveStore] = useState<StoreInstance>(() => {
    try {
      const route = parseStoreRouteFromLocation();
      const slug = route.storeSlug;
      const routed = slug
        ? StoreManager.getStoreBySlug(slug) || StoreManager.getStoreById(slug)
        : route.customDomainHostname
          ? StoreManager.getStoreByCustomDomain(route.customDomainHostname)
          : null;
      if (routed) {
        StoreManager.setActiveStoreId(routed.id);
        return routed;
      }
    } catch {}
    return StoreManager.getActiveStore();
  });
  // Tracks the store the UI is currently bound to, so background sync events can't swap in another store.
  const activeStoreIdRef = useRef<string>(activeStore.id);
  useEffect(() => {
    activeStoreIdRef.current = activeStore.id;
  }, [activeStore.id]);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');
  const [isShopperPreviewOnly, setIsShopperPreviewOnly] = useState(false);

  // Storefront Cloud Resolution States (Prevents flash of default demo store)
  const initialRoute = useMemo(() => parseStoreRouteFromLocation(), []);
  const [isResolvingStore, setIsResolvingStore] = useState<boolean>(() => {
    if (initialRoute.storeSlug) {
      const cached =
        StoreManager.getStoreBySlug(initialRoute.storeSlug) ||
        StoreManager.getStoreById(initialRoute.storeSlug);
      return !cached;
    }
    if (initialRoute.customDomainHostname) {
      const domainMatch = StoreManager.getStoreByCustomDomain(initialRoute.customDomainHostname);
      return !domainMatch;
    }
    return false;
  });
  const [storeNotFound, setStoreNotFound] = useState(false);
  const [activeDriverOrderId, setActiveDriverOrderId] = useState<string | null>(() => initialRoute.driverOrderId);

  // Active Store Database States
  const [settings, setSettings] = useState<StoreSettings>(() => activeStore.settings || StoreStorage.getSettings());
  const [products, setProducts] = useState<Product[]>(() => Array.isArray(activeStore.products) ? activeStore.products : StoreStorage.getProducts());
  const [orders, setOrders] = useState<Order[]>(() => Array.isArray(activeStore.orders) ? activeStore.orders : StoreStorage.getOrders());
  const [policies, setPolicies] = useState<StorePolicy[]>(() => Array.isArray(activeStore.policies) ? activeStore.policies : StoreStorage.getPolicies());

  // Only stores belonging to the currently logged-in merchant
  const merchantStores = useMemo(
    () => StoreManager.getMerchantStores(currentUser?.id),
    [allStores, currentUser]
  );

  // Strict ownership check: merchant controls only appear if the logged-in user owns the active store
  const isStoreOwner = Boolean(currentUser && activeStore.ownerId === currentUser.id);

  // Google Maps Platform Quota Exceeded In-App Banner State
  const [isGmpQuotaExceeded, setIsGmpQuotaExceeded] = useState(false);
  useEffect(() => {
    const handler = () => setIsGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handler);
    return () => window.removeEventListener('gmp-quota-exceeded', handler);
  }, []);

  // Emergency reset detection & Initial StoreStorage hydration
  useEffect(() => {
    if (typeof window !== 'undefined' && (window.location.search.includes('reset=true') || window.location.search.includes('repair=true'))) {
      StoreManager.resetCorruptedStorage();
      window.history.replaceState({}, '', window.location.pathname);
      window.location.reload();
      return;
    }

    if (activeStore && activeStore.settings) {
      StoreStorage.hydrateStore({
        settings: activeStore.settings,
        products: activeStore.products || [],
        orders: activeStore.orders || [],
        policies: activeStore.policies || [],
      });
    }

    // Hydrate from Local Server Database (/api/store/data -> /data/stores.json)
    // so products & settings persist across Edge, Chrome, and browser cache clears
    StoreManager.fetchStoresFromLocalServer()
      .then((serverData) => {
        if (serverData?.stores && serverData.stores.length > 0) {
          setAllStores(StoreManager.getAllStores());
          const currentBoundId = activeStoreIdRef.current;
          const matchingStore =
            serverData.stores.find((s) => s.id === currentBoundId) ||
            (currentBoundId === 'store_aurora_01'
              ? serverData.stores.find((s) => s.id !== 'store_aurora_01') || serverData.stores[0]
              : null);
          if (matchingStore) {
            activeStoreIdRef.current = matchingStore.id;
            setActiveStore(matchingStore);
            setSettings(matchingStore.settings);
            setProducts(matchingStore.products || []);
            setOrders(matchingStore.orders || []);
            setPolicies(matchingStore.policies || []);
            StoreStorage.hydrateStore({
              settings: matchingStore.settings,
              products: matchingStore.products || [],
              orders: matchingStore.orders || [],
              policies: matchingStore.policies || [],
            });
          }
        }
      })
      .catch(() => {});
  }, []);

  // Listen to local storage & cross-tab sync events
  useEffect(() => {
    const handleDbSync = () => {
      // Ignore storage snapshots that belong to a different store (prevents demo/other store flash)
      const bound = StoreManager.getStoreById(activeStoreIdRef.current);
      if (bound && StoreManager.getActiveStore().id !== bound.id) return;
      if (bound) {
        setSettings(bound.settings || StoreStorage.getSettings());
        setProducts(bound.products || []);
        setOrders(bound.orders || []);
        setPolicies(bound.policies || []);
      } else {
        setSettings(StoreStorage.getSettings());
        setProducts(StoreStorage.getProducts());
        setOrders(StoreStorage.getOrders());
        setPolicies(StoreStorage.getPolicies());
      }
    };

    const handleAuthChange = () => {
      setCurrentUser(AuthService.getCurrentUser());
    };

    const handleStoresChange = () => {
      const stores = StoreManager.getAllStores();
      setAllStores(stores);
      // Stay on the store the UI is bound to (handleSelectStore updates the ref on explicit switches)
      const curr = StoreManager.getStoreById(activeStoreIdRef.current) || StoreManager.getActiveStore();
      if (curr) {
        setActiveStore(curr);
        setSettings(curr.settings || StoreStorage.getSettings());
        setProducts(curr.products || []);
        setOrders(curr.orders || []);
        setPolicies(curr.policies || []);
      }
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

        // Claim any onboarding guest stores created before login
        StoreManager.claimGuestStores(fbUser.uid);

        // Fetch any cloud stores created by this merchant
        StoreManager.fetchUserStoresFromFirestore(fbUser.uid).then((stores) => {
          if (stores.length > 0) {
            const currentActive = StoreManager.getActiveStore();
            if (currentActive.ownerId !== fbUser.uid || currentActive.id === 'store_aurora_01') {
              handleSelectStore(stores[0].id);
            }
          }
        }).catch(console.warn);
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
    if (!activeStore.id || activeStore.id === 'store_aurora_01') return;

    // ONLY subscribe and alert if a real merchant is logged in on this device and NOT in shopper preview!
    if (!currentUser || isShopperPreviewOnly) return;
    const isOwner = Boolean(
      activeStore.ownerId === currentUser.id ||
      activeStore.ownerId === 'merchant_user' ||
      activeStore.ownerId === 'guest'
    );
    if (!isOwner) return;

    const unsubscribeOrders = StoreManager.subscribeToStoreOrders(
      activeStore.id,
      (liveOrders, _newCount, newOrders) => {
        if (liveOrders && liveOrders.length > 0) {
          setOrders(liveOrders);
          StoreStorage.saveOrders(liveOrders);
        }
        // Merchant-device alerts (toast/chime/desktop) for orders that arrived after the listener started
        (newOrders || []).forEach((o) => NotificationHub.alertMerchantLocally(o, activeStore.settings || settings));
      }
    );

    return () => {
      if (unsubscribeOrders) unsubscribeOrders();
    };
  }, [currentUser, isStoreOwner, activeStore.id, activeStore.ownerId]);

  // Inject custom typography and brand colors whenever settings.brandTheme changes
  useEffect(() => {
    if (settings.brandTheme) {
      injectBrandThemeStyles(settings.brandTheme);
    }
  }, [settings.brandTheme]);

  // Initialize third-party marketing tags (GA4, Facebook Pixel, TikTok, Snapchat) safely
  useEffect(() => {
    if (settings) {
      initializeMarketingPixels(settings);
    }
  }, [settings]);

  // UI View Modes:
  // - Persists dashboard/storefront view across dev reloads via sessionStorage when no explicit URL param overrides it.
  // - If `?store=<slug>` or `/s/<slug>` is present in the URL, open the customer's pure `'storefront'` directly.
  // - If visiting root `/` without `?store=`, show the SaaS platform `'landing'` page.
  const [viewMode, setViewModeState] = useState<AppViewMode>(() => {
    if (initialRoute.viewParam === 'dashboard') return 'dashboard';
    if (initialRoute.storeSlug || initialRoute.customDomainHostname || initialRoute.viewParam === 'storefront') return 'storefront';
    try {
      const savedView = sessionStorage.getItem('storelink_active_view_mode') as AppViewMode | null;
      if (savedView === 'dashboard' || savedView === 'storefront') {
        return savedView;
      }
    } catch {}
    return 'landing';
  });

  const setViewMode = (nextMode: AppViewMode) => {
    setViewModeState(nextMode);
    try {
      sessionStorage.setItem('storelink_active_view_mode', nextMode);
    } catch {}
  };
  const [devicePreview, setDevicePreview] = useState<DevicePreviewMode>('desktop');

  // Modals State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Inject Dynamic SEO, Open Graph, Saudi GEO tags and JSON-LD structured data
  // Cleanly separates SaaS platform metadata from individual merchant storefronts
  useEffect(() => {
    if (viewMode === 'landing') {
      injectPlatformSEO();
    } else if (viewMode === 'storefront' && activeStore && settings) {
      injectStoreSEO(
        { ...activeStore, settings, products },
        { activeProduct: selectedProduct }
      );
    } else if (viewMode === 'dashboard') {
      document.title = `لوحة التحكم | ${settings?.storeName || 'StoreLink'}`;
    }
  }, [viewMode, activeStore, settings, products, selectedProduct]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isTrackerOpen, setIsTrackerOpen] = useState(() => Boolean(initialRoute.trackOrderId));
  const [trackerInitialId, setTrackerInitialId] = useState(() => initialRoute.trackOrderId || '');
  const [isPoliciesOpen, setIsPoliciesOpen] = useState(false);
  const [isCaptainPortalOpen, setIsCaptainPortalOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return (
        params.get('view') === 'captain' ||
        params.get('captain') === 'true' ||
        params.get('driver') === 'register' ||
        window.location.pathname.startsWith('/captain')
      );
    }
    return false;
  });
  const [isPlatformOwnerPortalOpen, setIsPlatformOwnerPortalOpen] = useState(false);

  // Auto-open platform owner portal on URL request ONLY if logged in as platform owner
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const isOwnerUrl =
        params.get('view') === 'platform-owner' ||
        params.get('platform_owner') === 'true' ||
        window.location.pathname.startsWith('/platform-admin');

      if (isOwnerUrl && isPlatformSuperOwner(currentUser)) {
        setIsPlatformOwnerPortalOpen(true);
      }
    }
  }, [currentUser]);
  const [isBrandStudioOpen, setIsBrandStudioOpen] = useState(false);
  const [isNewStoreWizardOpen, setIsNewStoreWizardOpen] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  const handleSelectStore = (storeId: string) => {
    const store = StoreManager.getStoreById(storeId);
    if (store) activeStoreIdRef.current = store.id;
    StoreManager.setActiveStoreId(storeId);
    if (store) {
      const currentOrders = StoreStorage.getOrders();
      const resolvedOrders = store.orders?.length ? store.orders : currentOrders;
      setActiveStore({
        ...store,
        orders: resolvedOrders,
      });
      setSettings(store.settings);
      setProducts(store.products || []);
      setOrders(resolvedOrders);
      setPolicies(store.policies || []);
      StoreStorage.hydrateStore({
        settings: store.settings,
        products: store.products || [],
        orders: resolvedOrders,
        policies: store.policies || [],
      });
    }
  };

  // Handle URL parameters: ?store=<slug_or_id>&product=<product_id> or /s/<slug> or ?track=<order_id>
  useEffect(() => {
    const resolveStoreFromUrl = async () => {
      try {
        const route = parseStoreRouteFromLocation();
        const { storeSlug, productId, trackOrderId, viewParam, driverOrderId, customDomainHostname } = route;

        setActiveDriverOrderId(driverOrderId);

        if (trackOrderId) {
          setTrackerInitialId(trackOrderId);
          setIsTrackerOpen(true);
        } else {
          setIsTrackerOpen(false);
        }

        let targetSlugOrId = storeSlug;
        if (!targetSlugOrId && customDomainHostname) {
          const domainMatch =
            StoreManager.getStoreByCustomDomain(customDomainHostname) ||
            (await StoreManager.fetchStoreByCustomDomainFromFirestore(customDomainHostname));
          if (domainMatch) {
            targetSlugOrId = domainMatch.slug || domainMatch.id;
          }
        }

        if (viewParam === 'dashboard') {
          setViewMode('dashboard');
        } else if (targetSlugOrId || viewParam === 'storefront') {
          setViewMode('storefront');
        } else if (viewParam === 'landing') {
          setViewMode('landing');
        }

        if (!productId) {
          setSelectedProduct(null);
        }

        if (!targetSlugOrId) return;

        // 1. Check local cache for instant render
        const localMatch =
          StoreManager.getStoreBySlug(targetSlugOrId) || StoreManager.getStoreById(targetSlugOrId);

        if (localMatch) {
          handleSelectStore(localMatch.id);
          setViewMode('storefront');
          if (productId) {
            const p = (localMatch.products || []).find((item) => item.id === productId);
            if (p) setSelectedProduct(p);
          }
          // Refresh catalog from Cloud Firestore in background so returning shoppers get latest prices/products
          StoreManager.fetchStoreFromFirestore(targetSlugOrId)
            .then((freshStore) => {
              if (freshStore) {
                const localProds = localMatch.products || [];
                const freshProds = freshStore.products || [];
                let resolvedProds = freshProds;
                if (freshProds.length === 0 && localProds.length > 0) {
                  resolvedProds = localProds;
                  if (auth.currentUser && (localMatch.ownerId === auth.currentUser.uid || localMatch.ownerId === 'guest')) {
                    StoreManager.syncStoreToFirestore({ ...localMatch, products: localProds }).catch(console.warn);
                  }
                }
                setActiveStore((prev) => ({
                  ...freshStore,
                  products: resolvedProds,
                  orders: prev.orders?.length ? prev.orders : freshStore.orders || [],
                }));
                setSettings(freshStore.settings);
                setProducts(resolvedProds);
                setPolicies(freshStore.policies || []);
                if (freshStore.orders && freshStore.orders.length > 0) {
                  setOrders(freshStore.orders);
                }
                if (productId) {
                  const freshP = (freshStore.products || []).find((item) => item.id === productId);
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
        const cloudStore = await StoreManager.fetchStoreFromFirestore(targetSlugOrId);
        setIsResolvingStore(false);

        if (cloudStore) {
          handleSelectStore(cloudStore.id);
          setViewMode('storefront');
          if (productId) {
            const p = (cloudStore.products || []).find((item) => item.id === productId);
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
    window.addEventListener('popstate', resolveStoreFromUrl);
    return () => {
      window.removeEventListener('popstate', resolveStoreFromUrl);
    };
  }, []);

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  // Store-Scoped Cart State (Prevents cart items from Store A leaking into Store B)
  const cartStorageKey = `storelink_cart_${activeStore.id}`;
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(`storelink_cart_${activeStore.id}`);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => item && item.product && typeof item.product === 'object' && item.product.id);
      }
      return [];
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
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setCart(parsed.filter((item) => item && item.product && typeof item.product === 'object' && item.product.id));
        } else {
          setCart([]);
        }
      } else {
        setCart([]);
      }
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
    return (cart || []).reduce((acc, item) => acc + (Number(item?.quantity) || 0), 0);
  }, [cart]);

  const cartTotal = useMemo(() => {
    return (cart || []).reduce((acc, item) => {
      if (!item?.product) return acc;
      const hasSale =
        typeof item.product.salePrice === 'number' &&
        item.product.salePrice > 0 &&
        item.product.salePrice < item.product.price;
      const price = (hasSale && typeof item.product.salePrice === 'number') ? item.product.salePrice : (item.product.price || 0);
      return acc + price * (Number(item.quantity) || 1);
    }, 0);
  }, [cart]);

  // Cart handlers
  const handleAddToCart = (product: Product, variant: string, quantity: number, replaceExisting = false) => {
    const cleanVariant = (!variant || variant === 'الخيار الافتراضي') ? '' : variant;
    setCart((prev) => {
      const existingIdx = prev.findIndex((item) => {
        const itemVar = (!item.selectedVariant || item.selectedVariant === 'الخيار الافتراضي') ? '' : item.selectedVariant;
        return item.product.id === product.id && itemVar === cleanVariant;
      });
      const maxAllowed =
        product.stockQuantity !== undefined && product.stockQuantity > 0
          ? product.stockQuantity
          : 99;
      if (existingIdx >= 0) {
        const updated = [...prev];
        const nextQty = replaceExisting
          ? quantity
          : updated[existingIdx].quantity + quantity;
        updated[existingIdx] = {
          ...updated[existingIdx],
          selectedVariant: cleanVariant,
          quantity: Math.min(maxAllowed, nextQty),
        };
        return updated;
      }
      return [...prev, { product, selectedVariant: cleanVariant, quantity: Math.min(maxAllowed, quantity) }];
    });
  };

  // Smart Quick Add: If product has multiple variants or is sold by weight/fraction, open ProductModal so buyer picks their option
  const handleQuickAdd = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!product.inStock) return;
    const realVariants = (product.variants || []).filter((v) => v && v !== 'الخيار الافتراضي');
    const unitMeta = getProductUnitMeta(product.unit);
    const isFractional = Boolean(unitMeta?.allowDecimal || ['kg', 'meter', 'liter', 'tola'].includes(product.unit || ''));
    const hasFractionalStep = (product.quantityStep !== undefined && product.quantityStep < 1) || (product.minQuantity !== undefined && product.minQuantity < 1);

    // If product has multiple variants or is fractional (e.g. nuts by kg, perfumes by tola), open modal for precision choice
    if (realVariants.length > 1 || isFractional || hasFractionalStep) {
      setSelectedProduct(product);
      return;
    }

    const defaultVariant = realVariants.length > 0 ? realVariants[0] : '';
    const initialQty = product.minQuantity && product.minQuantity > 0 ? product.minQuantity : 1;
    handleAddToCart(product, defaultVariant, initialQty);
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
    // Re-read THIS store only; never fall back to the last-active/demo store after checkout
    const updatedStore = StoreManager.getStoreById(activeStore.id);
    if (updatedStore) {
      setOrders(updatedStore.orders || []);
      setProducts(updatedStore.products || []);
      setActiveStore(updatedStore);
    } else {
      setOrders((prev) => {
        const cleanId = order.id.toUpperCase().trim();
        const exists = prev.some((o) => o.id.toUpperCase().trim() === cleanId);
        return exists ? prev.map((o) => (o.id.toUpperCase().trim() === cleanId ? order : o)) : [order, ...prev];
      });
    }
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
    setActiveStore((prev) => {
      const updatedStore: StoreInstance = { ...prev, settings: newSettings };
      StoreManager.updateStore(updatedStore, { immediateSync: true });
      return updatedStore;
    });
    setAllStores(StoreManager.getAllStores());
  };

  const handleUpdateProducts = (newProducts: Product[]) => {
    const clonedProducts: Product[] = JSON.parse(JSON.stringify(newProducts || []));
    StoreStorage.saveProducts(clonedProducts);
    setProducts(clonedProducts);
    setActiveStore((prev) => {
      const updatedStore: StoreInstance = { ...prev, products: clonedProducts };
      StoreManager.updateStore(updatedStore, { immediateSync: true });
      return updatedStore;
    });
    setAllStores(StoreManager.getAllStores());
  };

  const handleUpdateOrders = (newOrders: Order[]) => {
    newOrders.forEach((updatedOrder) => {
      const prev = orders.find((o) => o.id === updatedOrder.id);
      if (!prev || JSON.stringify(prev) !== JSON.stringify(updatedOrder)) {
        StoreManager.updateOrderInStore(activeStore.id, updatedOrder);
      }
    });
    StoreStorage.saveOrders(newOrders);
    setOrders(newOrders);
    setActiveStore((prev) => {
      const updatedStore: StoreInstance = { ...prev, orders: newOrders };
      StoreManager.updateStore(updatedStore);
      return updatedStore;
    });
    setAllStores(StoreManager.getAllStores());
  };

  const handleUpdatePolicies = (newPolicies: StorePolicy[]) => {
    StoreStorage.savePolicies(newPolicies);
    setPolicies(newPolicies);
    setActiveStore((prev) => {
      const updatedStore: StoreInstance = { ...prev, policies: newPolicies };
      StoreManager.updateStore(updatedStore);
      return updatedStore;
    });
    setAllStores(StoreManager.getAllStores());
  };

  const handleUpdateStoreSlug = async (newSlug: string) => {
    const res = await StoreManager.updateStoreSlug(activeStore.id, newSlug);
    if (res.success && res.updatedStore) {
      setActiveStore(res.updatedStore);
      setAllStores(StoreManager.getAllStores());
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        if (url.searchParams.has('store')) {
          url.searchParams.set('store', res.updatedStore.slug);
          window.history.replaceState({}, '', url.toString());
        }
      }
    }
    return res;
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
      ownerId: auth.currentUser?.uid || currentUser?.id || 'guest',
      tagline: newSettings.tagline,
      whatsappNumber: newSettings.whatsappNumber,
      currency: newSettings.currency,
      primaryColor: newSettings.brandTheme?.primaryColor || '#0F172A',
      accentColor: newSettings.brandTheme?.accentColor || '#2563EB',
      backgroundColor: newSettings.brandTheme?.backgroundColor || '#F8FAFC',
      logoLetter: newSettings.logoLetter || 'S',
      logoUrl: newSettings.logoUrl,
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
    const claimed = StoreManager.claimGuestStores(user.id);
    for (const s of claimed) {
      StoreManager.syncStoreToFirestore(s).catch(console.warn);
    }
    setAllStores(StoreManager.getAllStores());
    try {
      await StoreManager.fetchUserStoresFromFirestore(user.id);
    } catch (e) {
      console.warn('Error fetching user stores from firestore:', e);
    }
    const allUserStores = StoreManager.getMerchantStores(user.id);
    setAllStores(StoreManager.getAllStores());
    if (allUserStores.length > 0) {
      const currentActive = StoreManager.getActiveStore();
      const targetStore = allUserStores.find((s) => s.id === currentActive.id) || allUserStores[0];
      handleSelectStore(targetStore.id);
      setViewMode('dashboard');
    } else {
      setIsNewStoreWizardOpen(true);
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
          onOpenCaptainPortal={() => setIsCaptainPortalOpen(true)}
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

        {isCaptainPortalOpen && (
          <CaptainPortalModal
            isOpen={isCaptainPortalOpen}
            onClose={() => setIsCaptainPortalOpen(false)}
          />
        )}
      </Suspense>
    );
  }

  // Driver 1-Tap Mobile View Route (?driver=<orderId>)
  if (activeDriverOrderId) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-stone-950 text-white flex items-center justify-center p-4"><Loader2 className="w-8 h-8 animate-spin text-emerald-400" /></div>}>
        <DriverDispatchView orderId={activeDriverOrderId} storeId={initialRoute.storeSlug || activeStore.id} />
      </Suspense>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
    <div 
      className="min-h-screen flex flex-col transition-colors duration-300"
      style={{
        backgroundColor: brand.backgroundColor || '#F8FAFC',
        color: brand.primaryColor || '#0F172A',
        fontFamily: brand.fontFamily ? `'${brand.fontFamily}', sans-serif` : 'Cairo, sans-serif',
      }}
    >
      {/* Google Maps Platform Quota Exceeded Sticky Notice Banner */}
      {isGmpQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

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
        onOpenCaptainPortal={() => setIsCaptainPortalOpen(true)}
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
                storeId={activeStore.id}
                storeSlug={activeStore.slug}
                settings={settings}
                products={products}
                orders={orders}
                policies={policies}
                onUpdateSlug={handleUpdateStoreSlug}
                onUpdateSettings={handleUpdateSettings}
                onUpdateProducts={handleUpdateProducts}
                onUpdateOrders={handleUpdateOrders}
                onUpdatePolicies={handleUpdatePolicies}
                onViewStorefront={() => setViewMode('storefront')}
                onOpenBrandStudio={() => setIsBrandStudioOpen(true)}
                onOpenNewStoreWizard={() => setIsNewStoreWizardOpen(true)}
                currentUser={currentUser}
                onOpenCaptainPortal={() => setIsCaptainPortalOpen(true)}
                onOpenPlatformOwnerPortal={() => setIsPlatformOwnerPortalOpen(true)}
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
            onOpenCaptainPortal={() => setIsCaptainPortalOpen(true)}
            isStoreOwner={isStoreOwner}
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
            storeId={activeStore.id}
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
            storeName={settings.storeName}
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

        {/* 11. Delivery Captain Network Portal (Phase 4) */}
        {isCaptainPortalOpen && (
          <CaptainPortalModal
            isOpen={isCaptainPortalOpen}
            onClose={() => setIsCaptainPortalOpen(false)}
          />
        )}

        {/* 12. Dedicated Platform Owner Super-Admin Portal (Phase 3) */}
        {isPlatformOwnerPortalOpen && (
          <PlatformOwnerPortalModal
            isOpen={isPlatformOwnerPortalOpen}
            onClose={() => setIsPlatformOwnerPortalOpen(false)}
            settings={settings}
            storeSlug={activeStore.slug}
            currentUser={currentUser}
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
          onAddToCart={(prod, variant, qty) => {
            // When buyer adds from the detailed modal, replace or set the exact configured quantity and open cart drawer for immediate visual confirmation
            handleAddToCart(prod, variant, qty, true);
            setIsCartOpen(true);
          }}
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
        storeId={activeStore.id}
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

      {/* 10. Floating Multi-Channel Order Notification Toast - Merchant Only */}
      {currentUser && !isShopperPreviewOnly && (
        <OrderNotificationToast
          onSelectOrder={(_orderId) => {
            setViewMode('dashboard');
          }}
        />
      )}
    </div>
    </MotionConfig>
  );
}
