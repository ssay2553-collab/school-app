// utils/logAction.ts
import { addDoc, collection, getFirestore, serverTimestamp } from "firebase/firestore";
import { auth } from "../firebaseConfig";

export const logAction = async (action: string) => {
  try {
    const db = getFirestore();
    const user = auth.currentUser;

    if (!user) return;

    await addDoc(collection(db, "activity_logs"), {
      teacherId: user.uid,
      action,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error logging action:", error);
  }
};
