import { MerchantUser } from '../types/store';
import { signInWithGoogle, signOutFromFirebase } from './firebase';

const AUTH_STORAGE_KEY = 'storelink_current_merchant';

export const DEFAULT_MERCHANT: MerchantUser = {
  id: 'user_ebrahim_01',
  name: 'إبراهيم جابر (Ebrahim Gaber)',
  email: 'ea.gaber10@gmail.com',
  createdAt: '2026-10-15T12:00:00Z',
};

export class AuthService {
  static getCurrentUser(): MerchantUser | null {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Error reading auth state', e);
    }
    // Default logged in as the primary store owner (Simpler Ebrahim)
    this.setCurrentUser(DEFAULT_MERCHANT);
    return DEFAULT_MERCHANT;
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

  static login(email: string, _password?: string): MerchantUser {
    const user: MerchantUser = {
      id: `user_${Math.random().toString(36).substring(2, 9)}`,
      name: email.split('@')[0],
      email: email.trim(),
      createdAt: new Date().toISOString(),
    };
    this.setCurrentUser(user);
    return user;
  }

  static register(name: string, email: string): MerchantUser {
    const user: MerchantUser = {
      id: `user_${Math.random().toString(36).substring(2, 9)}`,
      name: name.trim(),
      email: email.trim(),
      createdAt: new Date().toISOString(),
    };
    this.setCurrentUser(user);
    return user;
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

