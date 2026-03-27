import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";

export async function registerForPushNotificationsAsync() {
  // SILENT RETURN: Push tokens don't exist on Web, Electron, or Simulators
  if (Platform.OS === 'web' || !Device.isDevice) {
    console.log("ℹ️ Push Notifications skipped: Environment is Web/Electron or Simulator.");
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
