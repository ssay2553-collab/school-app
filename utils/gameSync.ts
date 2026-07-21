import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebaseConfig";

const GAME_KEYS = [
  "@quiz_level",
  "@word_level",
  "@scramble_level",
  "@writing_count",
  "@unlocked_stickers",
];

export const syncAchievementsToCloud = async (studentId: string, displayName?: string, classId?: string) => {
  if (!studentId) return;

  try {
    const data: Record<string, any> = {
      updatedAt: serverTimestamp(),
      studentId,
      studentName: displayName || "Super Student",
      classId: classId || "N/A",
    };

    let totalScore = 0;

    for (const key of GAME_KEYS) {
      const value = await AsyncStorage.getItem(key);
      if (value !== null) {
        const parsed = JSON.parse(value);
        data[key.replace("@", "")] = parsed;

        // Simple scoring algorithm for leaderboard
        if (key === "@writing_count") totalScore += parsed * 2;
        else if (key === "@unlocked_stickers") totalScore += parsed.length * 10;
        else totalScore += (parsed - 1) * 50; // Levels
      }
    }

    data.totalScore = totalScore;

    if (Object.keys(data).length > 3) {
      await setDoc(doc(db, "gameAchievements", studentId), data, { merge: true });
      console.log("Achievements synced to cloud");
    }
  } catch (error) {
    console.error("Error syncing achievements:", error);
  }
};

export const fetchAchievementsFromCloud = async (studentId: string) => {
  if (!studentId) return null;

  try {
    const docSnap = await getDoc(doc(db, "gameAchievements", studentId));
    if (docSnap.exists()) {
      const data = docSnap.data();
      for (const key of GAME_KEYS) {
        const fieldName = key.replace("@", "");
        if (data[fieldName] !== undefined) {
          await AsyncStorage.setItem(key, JSON.stringify(data[fieldName]));
        }
      }
      return data;
    }
  } catch (error) {
    console.error("Error fetching achievements:", error);
  }
  return null;
};
