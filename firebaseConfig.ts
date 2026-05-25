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
  const isWeb = Platform.OS === "web";
  const isElectron =
    isWeb &&
    typeof window !== "undefined" &&
    navigator.userAgent.toLowerCase().includes("electron");

  /**
   * PERSISTENCE:
   * - Web/PWA/Electron: Use IndexedDB (persistentLocalCache) for speed and offline.
   * - React Native: Must use Memory-Only (memoryLocalCache) to avoid errors.
   */
  const cache = isWeb
    ? persistentLocalCache({
        tabManager: undefined // Use default multiple tab manager for PWA
      })
    : memoryLocalCache();

  /**
   * TRANSPORT:
   * - Web/PWA: Force long polling to avoid WebSocket issues on restricted networks/WiFi.
   */
  const firestoreSettings = {
    localCache: cache,
    experimentalForceLongPolling: isWeb,
    // Enable more robust persistence on mobile browsers
    ignoreUndefinedProperties: true,
  };

  try {
    dbInstance = initializeFirestore(app, firestoreSettings);
    console.log(
      `[Firebase] Firestore Initialized: ${firebaseConfig.projectId} (${Platform.OS}${
        isElectron ? "-electron" : ""
      }). Cache: ${isWeb ? "IndexedDB" : "Memory"}`
    );
  } catch (e) {
    console.warn("[Firebase] Firestore already initialized. Fetching existing instance...");
    dbInstance = getFirestore(app);
    // Note: We don't need to re-apply settings here as they are persistent for the app instance
  }
} catch (e) {
  console.error("[Firebase] Error initializing Firestore:", e);
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
