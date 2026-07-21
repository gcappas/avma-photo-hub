import { initializeApp } from "firebase/app";
import { getAuth, OAuthProvider, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";

// TODO: Replace with your actual Firebase project config after running `firebase init`
const firebaseConfig = {
  apiKey: "AIzaSyC1Jo9eA9p70i5D-hp7c7PSUqsoNJanbPs",
  authDomain: "avma-photo-hub-2026.firebaseapp.com",
  projectId: "avma-photo-hub-2026",
  storageBucket: "avma-photo-hub-2026.firebasestorage.app",
  messagingSenderId: "127021636361",
  appId: "1:127021636361:web:bffc3e1c129b855367d1d8"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Configure Microsoft Provider
export const microsoftProvider = new OAuthProvider('microsoft.com');
microsoftProvider.setCustomParameters({
  prompt: 'consent',
  tenant: 'common' // Use specific tenant ID if restricting to a single organization
});


