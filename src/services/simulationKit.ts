/**
 * Quick-eCommerce Simulation Kit
 *
 * Automated simulation framework representing both personas:
 * 1. BusinessOwnerSimulator: Store setup, catalog & inventory management, promo codes, order progression, driver dispatch & COD cash settlement.
 * 2. ShopperSimulator: Store slug resolution, Arabic product search, variant selection, stock boundary enforcement, coupon discounts, multi-step checkout, and order tracking.
 * 3. SimulationKitRunner: Automated execution of the entire lifecycle covering all edge cases.
 */

import { StoreManager } from './storeManager';
import { StoreInstance, Product, Order, PromoCode, OrderStatus } from '../types/store';
import { normalizeArabicDigits, normalizeSaudiPhoneNumber } from '../utils/digits';
import { buildWhatsAppInvoiceMessage } from '../utils/whatsappInvoice';
import { generateDriverWhatsAppMessage, generateDriverWhatsAppUrl } from '../utils/driverDispatch';

export interface SimulationStepResult {
  step: number;
  name: string;
  persona: 'merchant' | 'shopper' | 'system';
  passed: boolean;
  message?: string;
  durationMs: number;
  data?: any;
}

export interface SimulationReport {
  success: boolean;
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  durationMs: number;
  steps: SimulationStepResult[];
  storeId?: string;
  orderId?: string;
  diagnostics: string[];
}

/**
 * Business Owner Persona Simulator
 */
export class BusinessOwnerSimulator {
  private store: StoreInstance | null = null;

  constructor(existingStore?: StoreInstance) {
    if (existingStore) {
      this.store = existingStore;
    }
  }

  get currentStore(): StoreInstance | null {
    return this.store;
  }

  /**
   * 1. Create a brand new merchant store
   */
  createStore(params: {
    storeName: string;
    slug?: string;
    tagline?: string;
    whatsappNumber: string;
    currency?: string;
    freeShippingThreshold?: number;
    standardShippingRate?: number;
    city?: string;
    storePickupAddress?: string;
  }): StoreInstance {
    const store = StoreManager.createStore({
      storeName: params.storeName,
      slug: params.slug,
      ownerId: 'merchant_sim_' + Math.random().toString(36).substring(2, 7),
      tagline: params.tagline || 'متجر تجريبي للمحاكاة',
      whatsappNumber: params.whatsappNumber,
      currency: params.currency || 'ر.س',
      primaryColor: '#0f172a',
      accentColor: '#10b981',
      backgroundColor: '#f8fafc',
      logoLetter: params.storeName.charAt(0) || 'M',
      freeShippingThreshold: params.freeShippingThreshold ?? 250,
      standardShippingRate: params.standardShippingRate ?? 25,
    });

    if (params.city || params.storePickupAddress) {
      store.settings = {
        ...store.settings,
        city: params.city || 'الرياض',
        storePickupAddress: params.storePickupAddress || 'طريق الملك فهد، حي الصحافة، الرياض',
      };
      StoreManager.updateStore(store);
    }

    this.store = store;
    return store;
  }

  /**
   * 2. Add product to merchant catalog with variant and inventory tracking
   */
  addProduct(productData: {
    name: string;
    category: string;
    price: number;
    salePrice?: number;
    variants?: string[];
    stockQuantity?: number;
    inStock?: boolean;
    description?: string;
  }): Product {
    if (!this.store) throw new Error('Store has not been initialized yet');

    const newProd: Product = {
      id: `prod_${Math.random().toString(36).substring(2, 9)}`,
      name: productData.name,
      category: productData.category,
      price: productData.price,
      salePrice: productData.salePrice,
      variants: productData.variants || [],
      imageUrl: '',
      galleryImages: [],
      description: productData.description || 'منتج عالي الجودة',
      featured: true,
      inStock: productData.inStock !== false,
      stockQuantity: productData.stockQuantity,
    };

    const updatedProducts = [...(this.store.products || []), newProd];
    this.store.products = updatedProducts;
    StoreManager.updateStore(this.store);

    return newProd;
  }

  /**
   * 3. Update stock quantity or availability
   */
  updateProductStock(productId: string, stockQuantity: number, inStock?: boolean): Product {
    if (!this.store) throw new Error('Store has not been initialized yet');

    const prod = (this.store.products || []).find((p) => p.id === productId);
    if (!prod) throw new Error(`Product ${productId} not found`);

    prod.stockQuantity = stockQuantity;
    prod.inStock = typeof inStock === 'boolean' ? inStock : stockQuantity > 0;

    StoreManager.updateStore(this.store);
    return prod;
  }

  /**
   * 4. Configure promotional coupons
   */
  addPromoCode(promo: PromoCode): void {
    if (!this.store) throw new Error('Store has not been initialized yet');

    const currentPromos = this.store.settings.promoCodes || [];
    const filtered = currentPromos.filter((p) => p.code.toUpperCase() !== promo.code.toUpperCase());
    this.store.settings.promoCodes = [...filtered, promo];

    StoreManager.updateStore(this.store);
  }

  /**
   * 5. Get current orders list
   */
  getOrders(): Order[] {
    if (!this.store) return [];
    const refreshed = StoreManager.getStoreById(this.store.id);
    if (refreshed) {
      this.store = refreshed;
    }
    return this.store.orders || [];
  }

  /**
   * 6. Advance order status through fulfillment lifecycle
   */
  async advanceOrderStatus(orderId: string, nextStatus: OrderStatus): Promise<Order> {
    if (!this.store) throw new Error('Store has not been initialized yet');

    const order = (this.store.orders || []).find((o) => o.id === orderId);
    if (!order) throw new Error(`Order ${orderId} not found in store`);

    const updatedOrder: Order = {
      ...order,
      status: nextStatus,
      trackingNotes: `تم تحديث حالة الطلب إلى: ${nextStatus} بواسطة مدير المتجر`,
    };

    await StoreManager.updateOrderInStore(this.store.id, updatedOrder);
    // Refresh local store pointer
    const refreshed = StoreManager.getStoreById(this.store.id);
    if (refreshed) this.store = refreshed;

    return updatedOrder;
  }

  /**
   * 7. Assign driver and generate WhatsApp dispatch link
   */
  async dispatchDriver(params: {
    orderId: string;
    driverName: string;
    driverPhone: string;
    driverFee?: number;
  }): Promise<{ updatedOrder: Order; whatsappUrl: string; message: string }> {
    if (!this.store) throw new Error('Store has not been initialized yet');

    const order = (this.store.orders || []).find((o) => o.id === params.orderId);
    if (!order) throw new Error(`Order ${params.orderId} not found`);

    const updatedOrder: Order = {
      ...order,
      status: 'Out for Delivery',
      courierName: params.driverName,
      courierPhone: params.driverPhone,
      driverDeliveredAt: undefined,
      driverSettled: false,
    };

    await StoreManager.updateOrderInStore(this.store.id, updatedOrder);

    const message = generateDriverWhatsAppMessage({
      order: updatedOrder,
      storeSettings: this.store.settings,
      driverFee: params.driverFee,
    });

    const whatsappUrl = generateDriverWhatsAppUrl({
      driverPhone: params.driverPhone,
      message,
    });

    return { updatedOrder, whatsappUrl, message };
  }

  /**
   * 8. Driver Cash on Delivery (COD) collection and settlement
   */
  async settleDriverCash(orderId: string, cashCollected: number): Promise<Order> {
    if (!this.store) throw new Error('Store has not been initialized yet');

    const order = (this.store.orders || []).find((o) => o.id === orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);

    const updatedOrder: Order = {
      ...order,
      status: 'Delivered',
      driverCashCollected: cashCollected,
      driverDeliveredAt: new Date().toISOString(),
      driverSettled: true,
      trackingNotes: `تم تسليم الطلب للعميل واستلام مبلغ ${cashCollected} ${this.store.settings.currency} وتصفية حساب السائق بنجاح.`,
    };

    await StoreManager.updateOrderInStore(this.store.id, updatedOrder);
    return updatedOrder;
  }
}

/**
 * Shopper Persona Simulator
 */
export class ShopperSimulator {
  private activeStore: StoreInstance | null = null;

  /**
   * 1. Browse and resolve store by slug or ID
   */
  locateStore(storeSlugOrId: string): StoreInstance | null {
    const store =
      StoreManager.getStoreBySlug(storeSlugOrId) ||
      StoreManager.getStoreById(storeSlugOrId);

    if (store) {
      this.activeStore = store;
    }
    return store;
  }

  /**
   * 2. Search products (Arabic text fuzzy / partial match)
   */
  searchCatalog(query: string): Product[] {
    if (!this.activeStore) throw new Error('No store loaded for shopper');
    const cleanQ = query.trim().toLowerCase();
    if (!cleanQ) return this.activeStore.products || [];

    return (this.activeStore.products || []).filter((p) => {
      return (
        p.name.toLowerCase().includes(cleanQ) ||
        p.category.toLowerCase().includes(cleanQ) ||
        (p.description && p.description.toLowerCase().includes(cleanQ))
      );
    });
  }

  /**
   * 3. Calculate Cart totals with promo code and delivery choice
   */
  calculateCart(params: {
    items: { product: Product; variant?: string; quantity: number }[];
    promoCode?: string;
    deliveryType?: 'delivery' | 'pickup';
  }): {
    subtotal: number;
    discountAmount: number;
    shippingFee: number;
    grandTotal: number;
    appliedPromo?: PromoCode;
    error?: string;
  } {
    if (!this.activeStore) throw new Error('No store loaded for shopper');

    let subtotal = 0;
    for (const item of params.items) {
      const price =
        typeof item.product.salePrice === 'number' &&
        item.product.salePrice > 0 &&
        item.product.salePrice < item.product.price
          ? item.product.salePrice
          : item.product.price;
      subtotal += price * item.quantity;
    }

    let discountAmount = 0;
    let appliedPromo: PromoCode | undefined;
    let error: string | undefined;

    if (params.promoCode) {
      const cleanCode = params.promoCode.trim().toUpperCase();
      const promos = this.activeStore.settings.promoCodes || [];
      const match = promos.find((p) => p.code.toUpperCase() === cleanCode && p.active !== false);

      if (!match) {
        error = 'كود الخصم غير صحيح أو غير مفعل';
      } else {
        const isExpired = match.expiryDate && new Date(match.expiryDate).getTime() < Date.now();
        const meetsMin = !match.minOrderAmount || subtotal >= match.minOrderAmount;

        if (isExpired) {
          error = 'كود الخصم منتهي الصلاحية';
        } else if (!meetsMin) {
          error = `الحد الأدنى لتطبيق هذا الكوبون هو ${match.minOrderAmount} ${this.activeStore.settings.currency}`;
        } else {
          appliedPromo = match;
          if (match.type === 'percentage') {
            discountAmount = Math.round((subtotal * match.value) / 100);
          } else {
            discountAmount = Math.min(subtotal, match.value);
          }
        }
      }
    }

    const isPickup = params.deliveryType === 'pickup';
    let shippingFee = isPickup
      ? 0
      : typeof this.activeStore.settings.shippingFee === 'number'
      ? this.activeStore.settings.shippingFee
      : 25;

    if (
      !isPickup &&
      typeof this.activeStore.settings.freeShippingThreshold === 'number' &&
      this.activeStore.settings.freeShippingThreshold > 0 &&
      subtotal >= this.activeStore.settings.freeShippingThreshold
    ) {
      shippingFee = 0;
    }

    const grandTotal = Math.max(0, subtotal - discountAmount + shippingFee);

    return {
      subtotal,
      discountAmount,
      shippingFee,
      grandTotal,
      appliedPromo,
      error,
    };
  }

  /**
   * 4. Place order through the hardened StoreManager checkout pipeline
   */
  async submitCheckout(params: {
    items: { productId: string; variant?: string; qty: number }[];
    customerName: string;
    customerPhone: string;
    city: string;
    deliveryAddress: string;
    landmarkNotes?: string;
    googleMapsUrl?: string;
    deliveryType?: 'delivery' | 'pickup';
    paymentMethod: 'cod' | 'bank_transfer' | 'card' | 'apple_pay' | 'stc_pay';
    promoCode?: string;
    bankTransferReceiptUrl?: string;
    bankTransferReceiptFileName?: string;
    bankTransferSenderName?: string;
  }): Promise<{ success: boolean; order?: Order; error?: string }> {
    if (!this.activeStore) throw new Error('No store loaded for shopper');

    const result = await StoreManager.submitOrderToServer({
      storeId: this.activeStore.id,
      items: params.items,
      customer: {
        name: params.customerName,
        phone: params.customerPhone,
        city: params.city,
        address: params.deliveryAddress,
        landmark: params.landmarkNotes,
        googleMapsUrl: params.googleMapsUrl,
        deliveryType: params.deliveryType || 'delivery',
      },
      paymentMethod: params.paymentMethod,
      promoCode: params.promoCode,
      bankTransferReceiptUrl:
        params.bankTransferReceiptUrl ??
        (params.paymentMethod === 'bank_transfer'
          ? 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
          : undefined),
      bankTransferReceiptFileName: params.bankTransferReceiptFileName,
      bankTransferSenderName: params.bankTransferSenderName,
    });

    if (result.success && result.order) {
      const fresh = StoreManager.getStoreById(this.activeStore.id);
      if (fresh) this.activeStore = fresh;
    }

    return result;
  }

  /**
   * 5. Track existing order
   */
  async trackOrder(orderId: string): Promise<Order | null> {
    if (!this.activeStore) throw new Error('No store loaded for shopper');
    const freshStore = StoreManager.getStoreById(this.activeStore.id) || this.activeStore;
    return await StoreManager.lookupOrderById(
      freshStore.id,
      orderId,
      freshStore.orders || []
    );
  }

  /**
   * 6. Generate WhatsApp invoice message for this shopper
   */
  buildInvoice(order: Order): string {
    if (!this.activeStore) throw new Error('No store loaded for shopper');
    return buildWhatsAppInvoiceMessage(order, this.activeStore.settings);
  }
}

/**
 * Comprehensive Simulation Kit Runner
 * Runs the entire lifecycle, verifying all edge cases and boundary assertions.
 */
export async function runFullSimulationKit(): Promise<SimulationReport> {
  const startTime = Date.now();
  const steps: SimulationStepResult[] = [];
  const diagnostics: string[] = [];

  const recordStep = (
    stepNum: number,
    name: string,
    persona: 'merchant' | 'shopper' | 'system',
    action: () => boolean | Promise<boolean>,
    data?: any
  ): Promise<boolean> => {
    const t0 = Date.now();
    return Promise.resolve()
      .then(action)
      .then((passed) => {
        steps.push({
          step: stepNum,
          name,
          persona,
          passed,
          durationMs: Date.now() - t0,
          data,
        });
        return passed;
      })
      .catch((err) => {
        steps.push({
          step: stepNum,
          name,
          persona,
          passed: false,
          durationMs: Date.now() - t0,
          message: err?.message || String(err),
          data,
        });
        diagnostics.push(`[Step ${stepNum}] ${name} failed: ${err?.message || err}`);
        return false;
      });
  };

  const merchant = new BusinessOwnerSimulator();
  const shopper = new ShopperSimulator();

  let testStore: StoreInstance | null = null;
  let inStockProduct: Product | null = null;
  let outOfStockProduct: Product | null = null;
  let limitedStockProduct: Product | null = null;
  let createdOrderId: string = '';

  // Step 1: Merchant creates store
  await recordStep(1, 'Merchant Onboarding & Store Initialization', 'merchant', () => {
    testStore = merchant.createStore({
      storeName: 'محاكاة عبايات النخبة',
      slug: 'elite-abayas-' + Math.floor(1000 + Math.random() * 9000),
      tagline: 'أرقى تصاميم العبايات الخليجية',
      whatsappNumber: '٠٥٠١٢٣٤٥٦٧', // Eastern Arabic test
      currency: 'ر.س',
      freeShippingThreshold: 300,
      standardShippingRate: 30,
      city: 'الرياض',
      storePickupAddress: 'الرياض - حي الصحافة - مجمع النخبة التجاري',
    });
    return !!testStore && testStore.slug.startsWith('elite-abayas');
  });

  if (!testStore) {
    return {
      success: false,
      totalSteps: 1,
      passedSteps: 0,
      failedSteps: 1,
      durationMs: Date.now() - startTime,
      steps,
      diagnostics: ['Failed to initialize merchant store'],
    };
  }

  // Step 2: Merchant adds products with variants & stock bounds
  await recordStep(2, 'Merchant Catalog Setup (In Stock & Limited Stock)', 'merchant', () => {
    inStockProduct = merchant.addProduct({
      name: 'عباية حرير كريب ملكي',
      category: 'عبايات',
      price: 350,
      salePrice: 280,
      variants: ['مقاس 52', 'مقاس 54', 'مقاس 56'],
      stockQuantity: 20,
      inStock: true,
      description: 'قماش كريب ملكي كوري فاخر مع تطريز يدوي ناعم',
    });

    limitedStockProduct = merchant.addProduct({
      name: 'طرحة ليزر كويتية',
      category: 'طرح',
      price: 60,
      variants: ['أسود', 'كحلي'],
      stockQuantity: 3, // Limited to 3 items
      inStock: true,
    });

    outOfStockProduct = merchant.addProduct({
      name: 'عطر شتاء خاص نفد بالكامل',
      category: 'عطور',
      price: 180,
      stockQuantity: 0,
      inStock: false,
    });

    return !!inStockProduct && !!limitedStockProduct && !!outOfStockProduct;
  });

  // Step 3: Merchant configures coupon codes (percentage, fixed, min order, expired)
  await recordStep(3, 'Merchant Promo Codes Configuration', 'merchant', () => {
    // 20% off
    merchant.addPromoCode({
      code: 'WELCOME20',
      type: 'percentage',
      value: 20,
      active: true,
    });

    // 50 SAR off on orders >= 200
    merchant.addPromoCode({
      code: 'SAVE50',
      type: 'fixed',
      value: 50,
      minOrderAmount: 200,
      active: true,
    });

    // Expired code
    merchant.addPromoCode({
      code: 'EXPIRED2020',
      type: 'percentage',
      value: 50,
      expiryDate: '2020-01-01T00:00:00Z',
      active: true,
    });

    const promos = merchant.currentStore?.settings.promoCodes || [];
    return promos.length === 3;
  });

  // Step 4: Shopper resolves store by slug
  await recordStep(4, 'Shopper Store Slug Resolution', 'shopper', () => {
    const resolved = shopper.locateStore((testStore as StoreInstance).slug);
    return !!resolved && resolved.id === (testStore as StoreInstance).id;
  });

  // Step 5: Shopper searches catalog in Arabic
  await recordStep(5, 'Shopper Arabic Catalog Search & Filtering', 'shopper', () => {
    const searchResults = shopper.searchCatalog('حرير');
    const categoryResults = shopper.searchCatalog('طرح');
    return searchResults.length >= 1 && categoryResults.length >= 1;
  });

  // Step 6: Edge Case - Out of stock purchase attempt must be gracefully rejected
  await recordStep(6, 'Edge Case: Out-of-Stock Purchase Rejection', 'system', async () => {
    const res = await shopper.submitCheckout({
      items: [{ productId: (outOfStockProduct as Product).id, qty: 1 }],
      customerName: 'فهد المطيري',
      customerPhone: '0509998877',
      city: 'الرياض',
      deliveryAddress: 'حي النرجس',
      paymentMethod: 'cod',
    });
    // Expected to fail with an Arabic error message
    return res.success === false && typeof res.error === 'string' && res.error.length > 0;
  });

  // Step 7: Edge Case - Exceeding available inventory must be gracefully rejected
  await recordStep(7, 'Edge Case: Inventory Boundary Over-order Rejection', 'system', async () => {
    // limitedStockProduct only has 3 units, request 10
    const res = await shopper.submitCheckout({
      items: [{ productId: (limitedStockProduct as Product).id, qty: 10 }],
      customerName: 'سارة العتيبي',
      customerPhone: '0551112233',
      city: 'الرياض',
      deliveryAddress: 'حي الملقا',
      paymentMethod: 'cod',
    });
    // Expected to fail gracefully
    return res.success === false && typeof res.error === 'string' && res.error.includes('غير متوفرة');
  });

  // Step 8: Edge Case - Expired coupon code handling
  await recordStep(8, 'Edge Case: Expired Promo Code Neutralization', 'shopper', () => {
    const calc = shopper.calculateCart({
      items: [{ product: inStockProduct as Product, quantity: 1 }],
      promoCode: 'EXPIRED2020',
    });
    // Expired code should either return error or discount should be 0
    return calc.discountAmount === 0 && (!!calc.error || !calc.appliedPromo);
  });

  // Step 9: Edge Case - Coupon code below minimum order amount
  await recordStep(9, 'Edge Case: Promo Code Minimum Spend Threshold', 'shopper', () => {
    // limitedStockProduct price is 60, SAVE50 requires minOrderAmount of 200
    const calc = shopper.calculateCart({
      items: [{ product: limitedStockProduct as Product, quantity: 1 }],
      promoCode: 'SAVE50',
    });
    return calc.discountAmount === 0 && (!!calc.error || !calc.appliedPromo);
  });

  // Step 10: Successful Coupon Application (Percentage & Fixed)
  await recordStep(10, 'Valid Coupon Calculation (Percentage & Fixed)', 'shopper', () => {
    // inStockProduct salePrice is 280. WELCOME20 gives 20% = 56 SAR discount
    const calcPerc = shopper.calculateCart({
      items: [{ product: inStockProduct as Product, quantity: 1 }],
      promoCode: 'WELCOME20',
    });
    const percExpected = Math.round((280 * 20) / 100);

    // SAVE50 on 280 gives 50 SAR discount
    const calcFixed = shopper.calculateCart({
      items: [{ product: inStockProduct as Product, quantity: 1 }],
      promoCode: 'SAVE50',
    });

    return calcPerc.discountAmount === percExpected && calcFixed.discountAmount === 50;
  });

  // Step 11: Edge Case - Eastern Arabic Phone Normalization & Store Pickup
  await recordStep(11, 'Edge Case: Eastern Arabic Digits & Store Pickup Checkout', 'shopper', async () => {
    const res = await shopper.submitCheckout({
      items: [{ productId: (inStockProduct as Product).id, variant: 'مقاس 54', qty: 1 }],
      customerName: 'نورة بنت عبدالله',
      customerPhone: '٠٥٥١٢٣٩٨٧٦', // Eastern Arabic digits
      city: 'الرياض',
      deliveryAddress: 'استلام ذاتي',
      deliveryType: 'pickup',
      paymentMethod: 'bank_transfer',
      promoCode: 'WELCOME20',
    });

    if (res.success && res.order) {
      // Shipping must be 0 for pickup
      const isShippingZero = res.order.shippingFee === 0;
      // Phone must be normalized to standard digits
      const isPhoneNormalized = res.order.customerPhone.startsWith('0551239876') || res.order.customerPhone === '0551239876';
      return isShippingZero && isPhoneNormalized;
    }
    return false;
  });

  // Step 12: Successful Standard COD Checkout with Stock Decrement Assertion
  await recordStep(12, 'Shopper Standard Checkout & Stock Auto-Decrement', 'shopper', async () => {
    const initialLimitedStock = (limitedStockProduct as Product).stockQuantity || 3;

    const res = await shopper.submitCheckout({
      items: [
        { productId: (inStockProduct as Product).id, variant: 'مقاس 52', qty: 1 },
        { productId: (limitedStockProduct as Product).id, variant: 'أسود', qty: 1 },
      ],
      customerName: 'عبدالرحمن الشهري',
      customerPhone: '+966504443322',
      city: 'الرياض',
      deliveryAddress: 'حي الياسمين، شارع أنس بن مالك',
      landmarkNotes: 'فيلا رقم 14 بجوار المسجد',
      googleMapsUrl: 'https://maps.google.com/?q=24.8190,46.6340',
      paymentMethod: 'cod',
      promoCode: 'SAVE50',
    });

    if (res.success && res.order) {
      createdOrderId = res.order.id;

      // Verify stock was decremented on limitedStockProduct
      const updatedStore = StoreManager.getStoreById((testStore as StoreInstance).id);
      const updatedProd = (updatedStore?.products || []).find((p) => p.id === (limitedStockProduct as Product).id);
      const stockDecremented = (updatedProd?.stockQuantity || 0) === initialLimitedStock - 1;

      return stockDecremented && res.order.grandTotal > 0 && res.order.paymentMethod === 'cod';
    }
    return false;
  });

  // Step 13: Merchant Receives & Inspects Order
  await recordStep(13, 'Merchant Order Verification & Status Flow (Received -> In Progress)', 'merchant', async () => {
    const orders = merchant.getOrders();
    const targetOrder = orders.find((o) => o.id === createdOrderId);
    if (!targetOrder) return false;

    const updated = await merchant.advanceOrderStatus(createdOrderId, 'In Progress');
    return updated.status === 'In Progress';
  });

  // Step 14: Merchant Dispatches Driver with 1-Tap WhatsApp Link
  await recordStep(14, 'Merchant 1-Tap WhatsApp Driver Dispatch', 'merchant', async () => {
    const dispatchRes = await merchant.dispatchDriver({
      orderId: createdOrderId,
      driverName: 'الكابتن محمد علي',
      driverPhone: '0507776655',
      driverFee: 25,
    });

    const isOutForDelivery = dispatchRes.updatedOrder.status === 'Out for Delivery';
    const hasWhatsAppUrl = dispatchRes.whatsappUrl.includes('api.whatsapp.com') || dispatchRes.whatsappUrl.includes('wa.me');
    const hasOrderInMsg = dispatchRes.message.includes(createdOrderId);

    return isOutForDelivery && hasWhatsAppUrl && hasOrderInMsg;
  });

  // Step 15: Driver COD Collection and Accounting Settlement
  await recordStep(15, 'Driver COD Cash Collection & Settlement', 'merchant', async () => {
    const targetOrder = merchant.getOrders().find((o) => o.id === createdOrderId);
    if (!targetOrder) return false;

    const settledOrder = await merchant.settleDriverCash(createdOrderId, targetOrder.grandTotal);
    return settledOrder.status === 'Delivered' && settledOrder.driverSettled === true;
  });

  // Step 16: Shopper Order Tracking & WhatsApp Invoice Validation
  await recordStep(16, 'Shopper Order Tracking & WhatsApp Invoice Generation', 'shopper', async () => {
    // Test tracking with exact ID and with '#' prefix and lowercase
    const orderExact = await shopper.trackOrder(createdOrderId);
    const orderWithHash = await shopper.trackOrder(`#${createdOrderId.toLowerCase()}`);

    if (!orderExact || !orderWithHash) return false;

    const invoiceText = shopper.buildInvoice(orderExact);
    const containsStoreName = invoiceText.includes('محاكاة عبايات النخبة');
    const containsOrderId = invoiceText.includes(createdOrderId);

    return containsStoreName && containsOrderId && orderExact.status === 'Delivered';
  });

  const totalSteps = steps.length;
  const passedSteps = steps.filter((s) => s.passed).length;
  const failedSteps = totalSteps - passedSteps;

  return {
    success: failedSteps === 0,
    totalSteps,
    passedSteps,
    failedSteps,
    durationMs: Date.now() - startTime,
    steps,
    storeId: (testStore as any)?.id,
    orderId: createdOrderId,
    diagnostics,
  };
}
