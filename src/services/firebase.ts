import { initializeApp, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as fbSignOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  User as FirebaseUser,
  Auth
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc,
  Firestore
} from 'firebase/firestore';
import { MerchantUser } from '../types/store';

// Resolved configuration from secure VITE_ environment variables
export const resolvedFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'impressive-toolbox-3lcf1.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'impressive-toolbox-3lcf1',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'impressive-toolbox-3lcf1.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

export const firestoreDatabaseId = 
  import.meta.env.VITE_FIREBASE_DATABASE_ID || 
  '(default)';

export const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';
export const isProduction = import.meta.env.PROD;

export const isFirebaseConfigured = Boolean(
  resolvedFirebaseConfig.apiKey && 
  resolvedFirebaseConfig.apiKey !== 'your-firebase-api-key'
);

export const hasFirebaseMisconfiguration = isProduction && !isFirebaseConfigured && !isDemoMode;
if (hasFirebaseMisconfiguration) {
  console.error(
    'CRITICAL: Production build detected without valid VITE_FIREBASE_* environment variables and without VITE_DEMO_MODE=true.'
  );
}

// Initialize Firebase safely so missing env vars during initial setup never crash the app
const app: FirebaseApp = initializeApp(
  isFirebaseConfigured
    ? resolvedFirebaseConfig
    : {
        ...resolvedFirebaseConfig,
        apiKey: 'AIzaSyDummyKeyForBuildSafety00000000000',
      }
);

export const db: Firestore = getFirestore(app, firestoreDatabaseId);
export const auth: Auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Maps a Firebase Auth User object to internal MerchantUser format
 */
export function mapFirebaseUser(fbUser: FirebaseUser): MerchantUser {
  return {
    id: fbUser.uid,
    name: fbUser.displayName || fbUser.email?.split('@')[0] || 'تاجر Quick E-Commerce',
    email: fbUser.email || '',
    avatarUrl: fbUser.photoURL || undefined,
    createdAt: fbUser.metadata?.creationTime || new Date().toISOString()
  };
}

/**
 * Syncs the authenticated merchant profile to Firestore /merchants/{uid}
 */
async function syncMerchantProfileToFirestore(merchant: MerchantUser): Promise<void> {
  if (!isFirebaseConfigured) return;
  try {
    const merchantRef = doc(db, 'merchants', merchant.id);
    await setDoc(merchantRef, {
      id: merchant.id,
      name: merchant.name,
      email: merchant.email,
      avatarUrl: merchant.avatarUrl || '',
      createdAt: merchant.createdAt
    }, { merge: true });
  } catch (err) {
    console.warn('Could not save merchant record to Firestore:', err);
  }
}

/**
 * Sign in with Google Popup and upsert merchant profile
 */
export async function signInWithGoogle(): Promise<MerchantUser> {
  if (!isFirebaseConfigured) {
    throw new Error('FIREBASE_NOT_CONFIGURED');
  }
  const result = await signInWithPopup(auth, googleProvider);
  const merchant = mapFirebaseUser(result.user);
  await syncMerchantProfileToFirestore(merchant);
  return merchant;
}

/**
 * Sign in with Email & Password via Firebase Auth
 */
export async function signInWithEmail(email: string, password: string): Promise<MerchantUser> {
  if (!isFirebaseConfigured) {
    throw new Error('FIREBASE_NOT_CONFIGURED');
  }
  const result = await signInWithEmailAndPassword(auth, email.trim(), password);
  const merchant = mapFirebaseUser(result.user);
  await syncMerchantProfileToFirestore(merchant);
  return merchant;
}

/**
 * Register a new Merchant account with Email, Password & Display Name via Firebase Auth
 */
export async function registerWithEmail(name: string, email: string, password: string): Promise<MerchantUser> {
  if (!isFirebaseConfigured) {
    throw new Error('FIREBASE_NOT_CONFIGURED');
  }
  const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (name.trim()) {
    await updateProfile(result.user, { displayName: name.trim() });
  }
  const merchant: MerchantUser = {
    id: result.user.uid,
    name: name.trim() || result.user.email?.split('@')[0] || 'تاجر',
    email: result.user.email || email.trim(),
    createdAt: new Date().toISOString(),
  };
  await syncMerchantProfileToFirestore(merchant);
  return merchant;
}

/**
 * Retrieves the current user's Firebase ID Token for authenticated API calls
 */
export async function getFirebaseIdToken(): Promise<string | null> {
  if (!auth.currentUser) return null;
  try {
    return await auth.currentUser.getIdToken();
  } catch {
    return null;
  }
}

/**
 * Sign out from Firebase Auth
 */
export async function signOutFromFirebase(): Promise<void> {
  try {
    await fbSignOut(auth);
  } catch (e) {
    console.warn('Firebase signOut notice:', e);
  }
}

/**
 * Subscribe to Firebase Auth state
 */
export function onFirebaseAuthStateChanged(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Sends a password reset email via Firebase Auth
 */
export async function sendPasswordReset(email: string): Promise<void> {
  if (!isFirebaseConfigured) {
    if (!isDemoMode) {
      throw new Error('FIREBASE_NOT_CONFIGURED');
    }
    return;
  }
  await sendPasswordResetEmail(auth, email.trim());
}

/**
 * Sends email verification to the currently logged in merchant
 */
export async function sendCurrentEmailVerification(): Promise<void> {
  if (!auth.currentUser) throw new Error('NO_USER_LOGGED_IN');
  await sendEmailVerification(auth.currentUser);
}

/**
 * Checks whether the currently logged in merchant's email is verified
 */
export function isCurrentEmailVerified(): boolean {
  if (isDemoMode && !isFirebaseConfigured) return true;
  return Boolean(auth.currentUser?.emailVerified);
}
