import { DeliveryCaptain } from '../types/captain';
import { isSameSaudiCity } from '../utils/cityUtils';
import { normalizeArabicDigits } from '../utils/digits';
import { db, isFirebaseConfigured } from './firebase';
import { collection, doc, getDocs, setDoc, updateDoc } from 'firebase/firestore';

const CAPTAINS_STORAGE_KEY = 'quick_ecommerce_captains_v2';
const ACTIVE_CAPTAIN_SESSION_KEY = 'quick_active_captain_id';
export const DEFAULT_PLATFORM_FEE_PERCENT = 2.0; // Standard 2% platform commission (1% - 2.5% customizable)

// 100% Dynamic: No hardcoded demo drivers
const DEFAULT_CAPTAINS: DeliveryCaptain[] = [];

export class CaptainService {
  private static cachedCaptains: DeliveryCaptain[] | null = null;
  private static hasFetchedCloud: boolean = false;

  /**
   * Retrieves all captains from local storage cache, dynamically populated by real registrations
   */
  static getAllCaptains(): DeliveryCaptain[] {
    if (this.cachedCaptains) return this.cachedCaptains;
    if (typeof window === 'undefined') return DEFAULT_CAPTAINS;

    try {
      const raw = localStorage.getItem(CAPTAINS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.cachedCaptains = parsed;
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error reading captains from localStorage:', e);
    }

    this.cachedCaptains = [];
    return [];
  }

  /**
   * Fetches latest registered captains from Firestore collection 'captains'
   */
  static async fetchCaptainsFromCloud(): Promise<DeliveryCaptain[]> {
    const localList = this.getAllCaptains();
    if (!isFirebaseConfigured || typeof window === 'undefined') {
      return localList;
    }

    try {
      const captainsCol = collection(db, 'captains');
      const snap = await getDocs(captainsCol);
      if (!snap.empty) {
        const cloudList: DeliveryCaptain[] = [];
        snap.forEach((d) => {
          const data = d.data() as DeliveryCaptain;
          if (data && data.id) {
            cloudList.push(data);
          }
        });

        // Merge cloud with local
        const mergedMap = new Map<string, DeliveryCaptain>();
        localList.forEach((c) => mergedMap.set(c.id, c));
        cloudList.forEach((c) => mergedMap.set(c.id, c));
        const merged = Array.from(mergedMap.values());

        this.cachedCaptains = merged;
        this.saveAllCaptains(merged);
        this.hasFetchedCloud = true;
        return merged;
      }
    } catch (err) {
      console.warn('Firestore captains fetch notice:', err);
    }

    return localList;
  }

  /**
   * Saves captains list to localStorage and memory cache
   */
  static saveAllCaptains(captains: DeliveryCaptain[]): void {
    this.cachedCaptains = captains;
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(CAPTAINS_STORAGE_KEY, JSON.stringify(captains));
      window.dispatchEvent(new CustomEvent('quick_captains_updated', { detail: captains }));
    } catch (e) {
      console.warn('Failed to save captains cache:', e);
    }
  }

  static getCaptainById(id: string): DeliveryCaptain | null {
    const all = this.getAllCaptains();
    return all.find((c) => c.id === id) || null;
  }

  static getCaptainByPhone(phone: string): DeliveryCaptain | null {
    const cleanPhone = normalizeArabicDigits(phone).replace(/\D/g, '');
    const all = this.getAllCaptains();
    return all.find((c) => c.phone.replace(/\D/g, '') === cleanPhone) || null;
  }

  static getActiveSessionCaptain(): DeliveryCaptain | null {
    if (typeof window === 'undefined') return null;
    const activeId = localStorage.getItem(ACTIVE_CAPTAIN_SESSION_KEY);
    if (!activeId) return null;
    return this.getCaptainById(activeId);
  }

  static setActiveSessionCaptain(captainId: string | null): void {
    if (typeof window === 'undefined') return;
    if (captainId) {
      localStorage.setItem(ACTIVE_CAPTAIN_SESSION_KEY, captainId);
    } else {
      localStorage.removeItem(ACTIVE_CAPTAIN_SESSION_KEY);
    }
  }

  /**
   * Dynamic Real Captain Registration
   * Creates new captain record in 'pending_activation' status with a unique activation code
   */
  static async registerCaptain(params: {
    name: string;
    phone: string;
    city: string;
    vehicleType: 'car' | 'motorcycle' | 'van';
    idNumber?: string;
    iban?: string;
  }): Promise<{ success: boolean; captain?: DeliveryCaptain; error?: string }> {
    const cleanName = params.name.trim();
    const cleanPhone = normalizeArabicDigits(params.phone).replace(/\D/g, '');
    if (!cleanName || cleanName.length < 2) {
      return { success: false, error: 'يرجى كتابة الاسم الكامل للكابتن.' };
    }
    if (cleanPhone.length < 8) {
      return { success: false, error: 'يرجى إدخال رقم جوال سعودي صحيح للتواصل.' };
    }

    const all = this.getAllCaptains();
    const existing = all.find((c) => c.phone.replace(/\D/g, '') === cleanPhone);
    if (existing) {
      return {
        success: false,
        error: 'رقم الجوال مسجل مسبقاً. يرجى تسجيل الدخول باستخدام كود التفعيل المعتمد.',
      };
    }

    const uniqueId = `cap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    // System creates unique activation reference code for this registration (e.g. ACT-ALU-8391)
    const cityPrefix = params.city.replace(/[^A-Za-z\u0600-\u06FF]/g, '').slice(0, 3) || 'SA';
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const generatedActivationCode = `CAP-${randomSuffix}`;

    const newCaptain: DeliveryCaptain = {
      id: uniqueId,
      name: cleanName,
      phone: cleanPhone,
      city: params.city.trim(),
      vehicleType: params.vehicleType,
      idNumber: params.idNumber?.trim() || '',
      iban: params.iban?.trim() || '',
      status: 'pending_activation',
      activationCode: generatedActivationCode,
      platformFeePercent: DEFAULT_PLATFORM_FEE_PERCENT,
      completedDeliveries: 0,
      totalDeliveryFeesEarned: 0,
      totalPlatformCommission: 0,
      registeredAt: new Date().toISOString(),
    };

    all.push(newCaptain);
    this.saveAllCaptains(all);
    this.setActiveSessionCaptain(newCaptain.id);

    // Save to Firestore if connected
    if (isFirebaseConfigured && typeof window !== 'undefined') {
      try {
        const docRef = doc(db, 'captains', newCaptain.id);
        await setDoc(docRef, newCaptain);
      } catch (err) {
        console.warn('Firestore captain registration notice:', err);
      }
    }

    return {
      success: true,
      captain: newCaptain,
    };
  }

  /**
   * Activates a captain account using the activation code given by the platform owner
   */
  static activateCaptain(
    captainIdOrPhone: string,
    enteredCode: string,
    customFeePercent?: number
  ): { success: boolean; captain?: DeliveryCaptain; error?: string } {
    const cleanCode = enteredCode.trim().toUpperCase();
    if (!cleanCode) {
      return { success: false, error: 'يرجى إدخال كود التفعيل الممنوح لك من إدارة المنصة.' };
    }

    const all = this.getAllCaptains();
    const captainIdx = all.findIndex(
      (c) =>
        c.id === captainIdOrPhone ||
        c.phone.replace(/\D/g, '') === normalizeArabicDigits(captainIdOrPhone).replace(/\D/g, '')
    );

    if (captainIdx < 0) {
      return { success: false, error: 'لم يتم العثور على حساب كابتن مسجل بهذا الرقم.' };
    }

    const captain = all[captainIdx];

    // Strict verification: only the captain's designated activation code issued by the platform owner is valid
    const isSpecificCode = Boolean(
      captain.activationCode && cleanCode === captain.activationCode.toUpperCase()
    );

    if (!isSpecificCode) {
      return {
        success: false,
        error: 'كود التفعيل المدخل غير صحيح. يرجى التواصل مع إدارة المنصة للاتفاق على الرسوم والحصول على كود التفعيل المعتمد.',
      };
    }

    captain.status = 'active';
    captain.activatedAt = new Date().toISOString();
    captain.lastActiveAt = new Date().toISOString();
    if (typeof customFeePercent === 'number' && customFeePercent >= 0.5 && customFeePercent <= 10) {
      captain.platformFeePercent = customFeePercent;
    }

    all[captainIdx] = captain;
    this.saveAllCaptains(all);
    this.setActiveSessionCaptain(captain.id);

    // Sync to Firestore
    if (isFirebaseConfigured && typeof window !== 'undefined') {
      try {
        const docRef = doc(db, 'captains', captain.id);
        updateDoc(docRef, {
          status: 'active',
          activatedAt: captain.activatedAt,
          lastActiveAt: captain.lastActiveAt,
          platformFeePercent: captain.platformFeePercent,
        }).catch(console.warn);
      } catch (e) {
        console.warn('Firestore captain activation sync:', e);
      }
    }

    return {
      success: true,
      captain,
    };
  }

  /**
   * Platform Owner Action:
   * Directly activates a registered captain, assigns agreed fee percentage, and produces WhatsApp message with code
   */
  static ownerActivateCaptain(
    captainId: string,
    agreedFeePercent: number = 2.0
  ): {
    success: boolean;
    captain?: DeliveryCaptain;
    activationCode?: string;
    whatsAppUrl?: string;
    error?: string;
  } {
    const all = this.getAllCaptains();
    const idx = all.findIndex((c) => c.id === captainId);
    if (idx < 0) return { success: false, error: 'الكابتن غير موجود' };

    const captain = all[idx];
    const code = captain.activationCode || `CAP-${Math.floor(1000 + Math.random() * 9000)}`;

    captain.status = 'active';
    captain.activationCode = code;
    captain.platformFeePercent = Math.max(0.5, Math.min(10, agreedFeePercent));
    captain.activatedAt = new Date().toISOString();
    captain.lastActiveAt = new Date().toISOString();

    all[idx] = captain;
    this.saveAllCaptains(all);

    // Sync to Firestore
    if (isFirebaseConfigured && typeof window !== 'undefined') {
      try {
        const docRef = doc(db, 'captains', captain.id);
        updateDoc(docRef, {
          status: 'active',
          activationCode: code,
          platformFeePercent: captain.platformFeePercent,
          activatedAt: captain.activatedAt,
          lastActiveAt: captain.lastActiveAt,
        }).catch(console.warn);
      } catch (e) {
        console.warn('Firestore captain update error:', e);
      }
    }

    // Build WhatsApp Message with the code and direct login link
    const cleanPhone = captain.phone.replace(/\D/g, '');
    const intlPhone = cleanPhone.startsWith('966') ? cleanPhone : `966${cleanPhone.replace(/^0+/, '')}`;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://quick-ecommerce-saas-app.web.app';
    const message = encodeURIComponent(
      `السلام عليكم كابتن ${captain.name} 🌟\nيسر إدارة منصة Quick E-Commerce إبلاغك باعتماد وتفعيل حسابك ككابتن توصيل في مدينة (${captain.city}) بنجاح!\n━━━━━━━━━━━━━━━━━━━━\n🔑 كود التفعيل الخاص بك: ${code}\n💰 نسبة رسوم المنصة المتفق عليها: ${captain.platformFeePercent}%\n🚗 يمكنك الآن تسجيل الدخول واستقبال طلبات التوصيل عبر الرابط:\n${origin}/?view=captain\n━━━━━━━━━━━━━━━━━━━━\nنتمنى لك كل التوفيق والرزق الوفير!`
    );
    const whatsAppUrl = `https://wa.me/${intlPhone}?text=${message}`;

    return {
      success: true,
      captain,
      activationCode: code,
      whatsAppUrl,
    };
  }

  /**
   * Get all captains with 'pending_activation' for the platform owner to approve
   */
  static getPendingCaptains(): DeliveryCaptain[] {
    const all = this.getAllCaptains();
    return all.filter((c) => c.status === 'pending_activation');
  }

  /**
   * Find verified active captains in a specific city for a merchant
   */
  static getCaptainsByCity(cityName: string): DeliveryCaptain[] {
    const all = this.getAllCaptains();
    return all.filter((c) => c.status === 'active' && isSameSaudiCity(c.city, cityName));
  }

  /**
   * Complete delivery and compute platform commission percentage (e.g. 1% - 2.5%)
   */
  static recordDeliveryCompletion(
    captainId: string,
    orderId: string,
    deliveryFee: number = 25
  ): {
    success: boolean;
    platformCommission: number;
    captainNetEarnings: number;
    error?: string;
  } {
    const all = this.getAllCaptains();
    const idx = all.findIndex((c) => c.id === captainId);
    if (idx < 0) {
      return { success: false, platformCommission: 0, captainNetEarnings: 0, error: 'الكابتن غير موجود' };
    }

    const captain = all[idx];
    const feeRate = (captain.platformFeePercent || DEFAULT_PLATFORM_FEE_PERCENT) / 100;
    const platformCommission = Number((deliveryFee * feeRate).toFixed(2));
    const captainNetEarnings = Number((deliveryFee - platformCommission).toFixed(2));

    // Idempotency guard: prevent duplicate credit if orderId was already recorded
    const completedIds: string[] = Array.isArray((captain as any).completedOrderIds)
      ? (captain as any).completedOrderIds
      : [];
    if (orderId && completedIds.includes(orderId)) {
      return {
        success: true,
        platformCommission,
        captainNetEarnings,
      };
    }
    if (orderId) {
      (captain as any).completedOrderIds = [...completedIds, orderId];
    }

    captain.completedDeliveries = (captain.completedDeliveries || 0) + 1;
    captain.totalDeliveryFeesEarned = Number(
      ((captain.totalDeliveryFeesEarned || 0) + deliveryFee).toFixed(2)
    );
    captain.totalPlatformCommission = Number(
      ((captain.totalPlatformCommission || 0) + platformCommission).toFixed(2)
    );
    captain.lastActiveAt = new Date().toISOString();

    all[idx] = captain;
    this.saveAllCaptains(all);

    // Sync to Firestore
    if (isFirebaseConfigured && typeof window !== 'undefined') {
      try {
        const docRef = doc(db, 'captains', captain.id);
        updateDoc(docRef, {
          completedDeliveries: captain.completedDeliveries,
          totalDeliveryFeesEarned: captain.totalDeliveryFeesEarned,
          totalPlatformCommission: captain.totalPlatformCommission,
          lastActiveAt: captain.lastActiveAt,
        }).catch(console.warn);
      } catch (e) {
        console.warn('Firestore update stats error:', e);
      }
    }

    return {
      success: true,
      platformCommission,
      captainNetEarnings,
    };
  }
}
