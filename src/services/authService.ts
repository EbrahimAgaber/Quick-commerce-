import { MerchantUser } from '../types/store';
import { 
  signInWithGoogle, 
  signInWithEmail,
  registerWithEmail,
  signOutFromFirebase, 
  auth, 
  mapFirebaseUser,
  isFirebaseConfigured
} from './firebase';

const AUTH_STORAGE_KEY = 'storelink_current_merchant';

/**
 * Safely retrieves the currently authenticated merchant.
 * Returns null for unauthenticated visitors so anonymous users
 * cannot bypass route guards or access store management controls.
 */
export const getCurrentMerchant = (): MerchantUser | null => {
  if (auth.currentUser) {
    return mapFirebaseUser(auth.currentUser);
  }
  return AuthService.getCurrentUser();
};

const LOCAL_ACCOUNTS_KEY = 'storelink_local_accounts_v2';

interface LocalAccountRecord {
  user: MerchantUser;
  passwordHash: string;
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`storelink_salt_${password}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function getLocalAccounts(): Record<string, LocalAccountRecord> {
  try {
    const raw = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalAccounts(accounts: Record<string, LocalAccountRecord>): void {
  try {
    localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (e) {
    console.warn('Could not persist local account', e);
  }
}

export class AuthService {
  static getCurrentUser(): MerchantUser | null {
    // 1. Check live Firebase Auth user first
    if (auth.currentUser) {
      const mapped = mapFirebaseUser(auth.currentUser);
      return mapped;
    }

    // 2. Check cached session while Firebase Auth initializes
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as MerchantUser;
        // Never allow legacy fake/demo IDs
        if (
          parsed &&
          parsed.id &&
          parsed.id !== 'user_ebrahim_01' &&
          !parsed.email?.includes('merchant.demo@')
        ) {
          return parsed;
        }
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Error reading auth state', e);
    }

    return null;
  }

  static setCurrentUser(user: MerchantUser | null): void {
    if (user) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
    window.dispatchEvent(new Event('storelink_auth_changed'));
  }

  static async loginWithGoogle(): Promise<MerchantUser> {
    const merchant = await signInWithGoogle();
    this.setCurrentUser(merchant);
    return merchant;
  }

  static async loginWithEmail(email: string, password: string): Promise<MerchantUser> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      throw new Error('يرجى إدخال البريد الإلكتروني وكلمة المرور.');
    }
    if (isFirebaseConfigured) {
      const merchant = await signInWithEmail(cleanEmail, password);
      this.setCurrentUser(merchant);
      return merchant;
    }

    // Fallback when Firebase .env keys are not yet configured in local environment
    const accounts = getLocalAccounts();
    const record = accounts[cleanEmail];
    if (!record) {
      throw new Error('لا يوجد حساب مسجل بهذا البريد الإلكتروني. يرجى إنشاء حساب جديد أولاً.');
    }
    const hashed = await hashPassword(password);
    if (record.passwordHash !== hashed) {
      throw new Error('كلمة المرور غير صحيحة.');
    }
    this.setCurrentUser(record.user);
    return record.user;
  }

  static async registerWithEmail(name: string, email: string, password: string): Promise<MerchantUser> {
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanName || !cleanEmail || password.length < 6) {
      throw new Error('يرجى إدخال الاسم والبريد الإلكتروني وكلمة مرور لا تقل عن 6 أحرف.');
    }
    if (isFirebaseConfigured) {
      const merchant = await registerWithEmail(cleanName, cleanEmail, password);
      this.setCurrentUser(merchant);
      return merchant;
    }

    // Fallback when Firebase .env keys are not yet configured in local environment
    const accounts = getLocalAccounts();
    if (accounts[cleanEmail]) {
      throw new Error('هذا البريد الإلكتروني مسجل مسبقاً. يرجى تسجيل الدخول.');
    }
    const hashed = await hashPassword(password);
    const newMerchant: MerchantUser = {
      id: `merchant_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      name: cleanName,
      email: cleanEmail,
      createdAt: new Date().toISOString(),
    };
    accounts[cleanEmail] = { user: newMerchant, passwordHash: hashed };
    saveLocalAccounts(accounts);
    this.setCurrentUser(newMerchant);
    return newMerchant;
  }

  static async logout(): Promise<void> {
    try {
      await signOutFromFirebase();
    } catch (e) {
      console.warn('Firebase logout notice:', e);
    }
    this.setCurrentUser(null);
  }
}
