import * as Notifications from "expo-notifications";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEY = "personal_timetable_cache";
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * Syncs personal study alarms from Firestore to the local device.
 * Call this on login or app start.
 */
export const syncPersonalAlarms = async (userId: string) => {
  try {
    const timetableRef = doc(db, "personal_timetables", userId);
    const docSnap = await getDoc(timetableRef);

    if (!docSnap.exists()) return;

    const data = docSnap.data();
    
    // Save to local cache for offline/quick access
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));

    // Cancel all previous to avoid duplicates
    await Notifications.cancelAllScheduledNotificationsAsync();

    const dayMap: { [key: string]: number } = {
      "Sunday": 1, "Monday": 2, "Tuesday": 3, "Wednesday": 4, "Thursday": 5, "Friday": 6, "Saturday": 7,
    };

    for (const day of DAYS) {
      const expoDayIndex = dayMap[day];
      const morning = data[day]?.morning || [];
      const evening = data[day]?.evening || [];
      const entries = [...morning, ...evening];

      for (const entry of entries) {
        if (!entry.time || !entry.subject) continue;

        const [hours, minutes] = entry.time.split(":").map(Number);
        
        // Trigger 5 minutes before
        let notifyHours = hours;
        let notifyMinutes = minutes - 5;
        if (notifyMinutes < 0) {
          notifyMinutes += 60;
          notifyHours -= 1;
          if (notifyHours < 0) notifyHours = 23;
        }

        await Notifications.scheduleNotificationAsync({
          content: {
            title: `Study Time: ${entry.subject} 📚`,
            body: `Your session starts in 5 minutes (${entry.time}).`,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
            categoryIdentifier: "personal_timetable",
          },
          trigger: {
            channelId: "alarms", // Match the channel created in _layout.tsx
            weekday: expoDayIndex,
            hour: notifyHours,
            minute: notifyMinutes,
            repeats: true,
          },
        });
      }
    }
    console.log("✅ Study alarms synced for device");
  } catch (error) {
    console.error("❌ Failed to sync study alarms:", error);
  }
};
