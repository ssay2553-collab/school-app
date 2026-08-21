import {
  collection,
  addDoc,
  serverTimestamp,
  getDoc,
  doc,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";

export type NotificationType =
  | "chat"
  | "assignment"
  | "submission"
  | "score"
  | "news"
  | "attendance"
  | "attendance_reminder"
  | "behavior"
  | "payment";

export interface NotificationPayload {
  recipientId: string;
  senderId: string;
  senderName: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
}

/**
 * Creates a notification document in Firestore.
 * This will trigger a Cloud Function (if enabled) or be picked up by the client listener.
 */
export async function sendNotification(payload: NotificationPayload) {
  try {
    const notificationsRef = collection(db, "notifications");
    await addDoc(notificationsRef, {
      ...payload,
      read: false,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error sending notification:", error);
  }
}

/**
 * Helper to fetch a user's push token and details if needed
 */
export async function getUserData(uid: string) {
  const userDoc = await getDoc(doc(db, "users", uid));
  return userDoc.exists() ? userDoc.data() : null;
}
