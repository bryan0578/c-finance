import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
  const shouldRedirect =
    typeof window !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(window.navigator.userAgent) || window.innerWidth < 768);

  if (shouldRedirect) {
    await signInWithRedirect(auth, googleProvider);
    return;
  }

  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/web-storage-unsupported' ||
      code === 'auth/operation-not-supported-in-this-environment'
    ) {
      await signInWithRedirect(auth, googleProvider);
      return;
    }
    throw error;
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
    throw error;
  }
};
