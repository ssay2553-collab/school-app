import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { FirebaseApp, getApps, initializeApp } from "firebase/app";

import * as firebaseAuth from "firebase/auth";
import { 
  Auth, 
  getAuth, 
  initializeAuth,
} from "firebase/auth";

import {
  Firestore,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  memoryLocalCache,
} from "firebase/firestore";

import { FirebaseStorage, getStorage } from "firebase/storage";
import { Functions, getFunctions } from "firebase/functions";

const getReactNativePersistence = (firebaseAuth as any).getReactNativePersistence;

const extra = Constants.expoConfig?.extra;
const firebaseConfig = extra?.firebase;

if (!firebaseConfig) {
  throw new Error("❌ Firebase config missing from app.config.js extra block");
}

let app: FirebaseApp;
const apps = getApps();

if (apps.length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  const currentApp = apps[0];
  if (currentApp.options.projectId !== firebaseConfig.projectId) {
    const appName = "school-" + (extra?.schoolId || "default");
    const existing = apps.find((a) => a.name === appName);
    app = existing ?? initializeApp(firebaseConfig, appName);
  } else {
    app = currentApp;
  }
}

let authInstance: Auth;
try {
  if (Platform.OS !== 'web') {
    authInstance = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } else {
    authInstance = getAuth(app);
  }
} catch (e) {
  authInstance = getAuth(app);
}

export const auth: Auth = authInstance;

let dbInstance: Firestore;
try {
  const isWeb = Platform.OS === 'web';
  
  /**
   * FIX: The Firebase JS SDK v10+ persistentLocalCache() relies on IndexedDB,
   * which is missing in React Native (Android/iOS) and some Electron/Web environments.
   * We force memoryLocalCache() to avoid the "unimplemented" warning.
   */
  const cache = memoryLocalCache();
  
  // CRITICAL: Use long-polling and disable auto-detect to prevent 400 Bad Request in Electron
  dbInstance = initializeFirestore(app, {
    localCache: cache,
    experimentalForceLongPolling: isWeb,
    experimentalAutoDetectLongPolling: false,
  });
  
  console.log(`[Firebase] Firestore initialized. Persistence: Memory-Only (Platform: ${Platform.OS})`);
} catch (e) {
  console.warn("[Firebase] Re-using existing Firestore instance.");
  dbInstance = getFirestore(app);
}

export const db: Firestore = dbInstance;
export const storage: FirebaseStorage = getStorage(app);
export const functions: Functions = getFunctions(app);

export async function AuthUser(forceAnonymous = false) {
  if (auth.currentUser) return auth.currentUser;
  if (forceAnonymous) {
    try {
      const { signInAnonymously } = await import("firebase/auth");
      const cred = await signInAnonymously(auth);
      return cred.user;
    } catch (error) {
      console.error("❌ Anonymous sign-in failed:", error);
      return null;
    }
  }
  return null;
}
