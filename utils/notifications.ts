import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { getApp } from "firebase/app";
import { getMessaging, getToken } from "firebase/messaging";

export async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.log("ℹ️ Web Push not supported in this browser.");
      return null;
    }

    try {
      const permission = await window.Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn("❌ Web notification permission not granted.");
        return null;
      }

      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      console.log("✅ Service Worker registered for Web Push:", registration);

      const app = getApp();
      const messaging = getMessaging(app);

      const token = await getToken(messaging, {
        serviceWorkerRegistration: registration,
        vapidKey: Constants.expoConfig?.extra?.firebase?.vapidKey || undefined
      });

      console.log("✅ Web FCM Push Token generated:", token);
      return token || null;
    } catch (e) {
      console.error("❌ Failed to register web push notifications:", e);
      return null;
    }
  }

  // SILENT RETURN: Push tokens don't exist on Simulators
  if (!Device.isDevice) {
    console.log("ℹ️ Push Notifications skipped: Environment is Simulator.");
    return null;
  }

  let token;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== "granted") {
    console.warn("❌ Push permission not granted");
    return null;
  }
  
  try {
    const projectId = 
      Constants?.expoConfig?.extra?.eas?.projectId ?? 
      Constants?.easConfig?.projectId;

    if (!projectId || typeof projectId !== 'string') {
      console.warn("❌ Missing or invalid EAS Project ID for push tokens. Make sure it's set in app.config.js");
      return null;
    }

    token = (await Notifications.getExpoPushTokenAsync({
      projectId,
    })).data;
    
    console.log("✅ Push Token generated:", token);
  } catch (e) {
    console.error("❌ Failed to get push token:", e);
  }

  return token;
}
