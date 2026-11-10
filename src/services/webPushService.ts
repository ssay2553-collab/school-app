import { arrayUnion, doc, updateDoc } from "firebase/firestore";
import { Platform } from "react-native";
import { db } from "../../firebaseConfig";

/**
 * Registers the Web Push FCM token for the currently authenticated user in Firestore.
 * This token allows background push notifications to be sent to the OS notification shade
 * when the PWA / tab is closed.
 */
export async function registerWebPushToken(uid: string): Promise<string | null> {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return null;
  }

  if (!("serviceWorker" in navigator) || !("Notification" in window)) {
    console.log("[WebPush] Notifications or ServiceWorker not supported by browser.");
    return null;
  }

  try {
    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }

    if (permission !== "granted") {
      console.log("[WebPush] Notification permission was not granted.");
      return null;
    }

    // Register service worker if not already registered
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/",
    });
    console.log("[WebPush] ServiceWorker registered with scope:", registration.scope);

    // Dynamically import firebase/messaging to ensure compatibility across platforms
    const { getMessaging, getToken } = await import("firebase/messaging");
    const { getApp } = await import("firebase/app");

    const app = getApp();
    const messaging = getMessaging(app);

    // Retrieve FCM token using service worker registration
    const currentToken = await getToken(messaging, {
      serviceWorkerRegistration: registration,
    });

    if (currentToken) {
      console.log("[WebPush] FCM Token generated successfully:", currentToken.substring(0, 15) + "...");

      // Save FCM token to user document in Firestore
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, {
        fcmTokens: arrayUnion(currentToken),
        lastPushTokenUpdate: new Date().toISOString(),
      });

      return currentToken;
    } else {
      console.log("[WebPush] No registration token available. Request permission to generate one.");
      return null;
    }
  } catch (error) {
    console.warn("[WebPush] Error registering Web Push Token:", error);
    return null;
  }
}

/**
 * Subscribes to foreground push notifications when the PWA tab is active.
 */
export async function setupForegroundPushListener(
  onNotificationReceived: (payload: any) => void,
): Promise<(() => void) | null> {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return null;
  }

  try {
    const { getMessaging, onMessage } = await import("firebase/messaging");
    const { getApp } = await import("firebase/app");

    const app = getApp();
    const messaging = getMessaging(app);

    const unsubscribe = onMessage(messaging, (payload) => {
      console.log("[WebPush] Foreground push notification received:", payload);
      onNotificationReceived(payload);
    });

    return unsubscribe;
  } catch (e) {
    console.warn("[WebPush] Could not setup foreground push listener:", e);
    return null;
  }
}
