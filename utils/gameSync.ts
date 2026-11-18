import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebaseConfig";

const GAME_KEYS = [
  "@quiz_level",
  "@word_level",
  "@scramble_level",
  "@math_level",
  "@writing_count",
  "@unlocked_stickers",
  "@formwords_score",
  "@idioms_score",
  "@spelling_score",
  "@bonus_points",
];

export const isUid = (str?: string): boolean => {
  if (!str) return true;
  const s = str.trim();
  return /^[a-zA-Z0-9_-]{20,36}$/.test(s);
};

export const getStudentNameFromUser = (user: any): string => {
  if (!user) return "Super Student";
  const fullName = user.fullName;
  const profileName = `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}`.trim();
  const name = (fullName || profileName || user.displayName || "").trim();
  if (name && !isUid(name)) {
    return name;
  }
  return "Super Student";
};

export const addGamePoints = async (points: number) => {
  if (!points || points <= 0) return;
  try {
    const existing = await AsyncStorage.getItem("@bonus_points");
    const currentBonus = existing ? JSON.parse(existing) : 0;
    const newBonus = currentBonus + points;
    await AsyncStorage.setItem("@bonus_points", JSON.stringify(newBonus));
  } catch (e) {
    console.error("Error adding game points:", e);
  }
};

export const syncAchievementsToCloud = async (
  studentId: string,
  displayName?: string,
  classId?: string,
  pointsEarned?: number
) => {
  if (!studentId) return;

  try {
    if (pointsEarned && pointsEarned > 0) {
      await addGamePoints(pointsEarned);
    }

    const cleanName = (displayName && !isUid(displayName)) ? displayName.trim() : "Super Student";
    const data: Record<string, any> = {
      updatedAt: serverTimestamp(),
      studentId,
      studentName: cleanName,
      classId: classId || "N/A",
    };

    let totalScore = 0;

    for (const key of GAME_KEYS) {
      const value = await AsyncStorage.getItem(key);
      if (value !== null) {
        const parsed = JSON.parse(value);
        data[key.replace("@", "")] = parsed;

        // Scoring algorithm for leaderboard
        if (key === "@writing_count") totalScore += (parsed || 0) * 2;
        else if (key === "@unlocked_stickers") totalScore += Array.isArray(parsed) ? parsed.length * 10 : 0;
        else if (key === "@bonus_points" || key === "@formwords_score" || key === "@idioms_score" || key === "@spelling_score") totalScore += (parsed || 0);
        else totalScore += Math.max(0, ((parsed || 1) - 1) * 50); // Levels
      }
    }

    // Read existing Firestore document to prevent overwriting higher scores with lower local scores
    const docSnap = await getDoc(doc(db, "gameAchievements", studentId));
    if (docSnap.exists()) {
      const existingData = docSnap.data();
      if (existingData.totalScore && existingData.totalScore > totalScore) {
        totalScore = existingData.totalScore;
      }
      if (existingData.studentName && existingData.studentName !== "Super Student" && cleanName === "Super Student") {
        data.studentName = existingData.studentName;
      }
    }

    data.totalScore = totalScore;

    if (Object.keys(data).length > 3) {
      await setDoc(doc(db, "gameAchievements", studentId), data, { merge: true });
      console.log("Achievements & Leaderboard score synced to cloud:", totalScore);
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
