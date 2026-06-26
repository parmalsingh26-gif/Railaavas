import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDyYAMkVDlEUtyoM61aqYXTft1IJ5dQ63c",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "railaavas.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "railaavas",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "railaavas.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1015851340129",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1015851340129:web:ad6b5a46b56fc556f53520"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google", error);
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
