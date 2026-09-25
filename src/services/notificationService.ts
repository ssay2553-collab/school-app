import {
  collection,
  addDoc,
  serverTimestamp,
  getDoc,
  doc,
  query,
  where,
  getDocs,
  writeBatch,
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
 * Marks notifications as read for a specific user and optionally a specific type.
 */
export async function markNotificationsAsRead(recipientId: string, type?: NotificationType) {
  try {
    let q = query(
      collection(db, "notifications"),
      where("recipientId", "==", recipientId),
      where("read", "==", false)
    );

    if (type) {
      q = query(q, where("type", "==", type));
    }

    const snapshot = await getDocs(q);
    if (snapshot.empty) return;

    const batch = writeBatch(db);
    snapshot.docs.forEach((d) => {
      batch.update(d.ref, {
        read: true,
        readAt: serverTimestamp()
      });
    });

    await batch.commit();
  } catch (error) {
    console.error("Error marking notifications as read:", error);
  }
}

/**
 * Helper to fetch a user's push token and details if needed
 */
export async function getUserData(uid: string) {
  const userDoc = await getDoc(doc(db, "users", uid));
  return userDoc.exists() ? userDoc.data() : null;
}

/**
 * Sends payment received notifications to BOTH the student AND all of their parents.
 */
export async function notifyStudentAndParentsPayment({
  studentUid,
  studentName,
  amount,
  receiptNo,
  paymentType,
  senderUid,
  senderName,
}: {
  studentUid: string;
  studentName: string;
  amount: number;
  receiptNo?: string;
  paymentType?: string;
  senderUid?: string;
  senderName?: string;
}) {
  try {
    const studentDoc = await getDoc(doc(db, "users", studentUid));
    let parentUids: string[] = [];
    if (studentDoc.exists()) {
      parentUids = studentDoc.data()?.parentUids || [];
    }

    const recipients = Array.from(new Set([studentUid, ...parentUids]));
    const title = "Fee Payment Received - Thank You! 💳";
    const receiptText = receiptNo ? ` (Receipt: #${receiptNo})` : "";
    const typeLabel = paymentType ? ` for ${paymentType}` : "";
    const body = `Payment Received! We have recorded a payment of ₵${amount.toLocaleString()} for ${studentName}${typeLabel}${receiptText}. Thank you for your prompt payment!`;

    for (const recipientId of recipients) {
      sendNotification({
        recipientId,
        senderId: senderUid || "admin",
        senderName: senderName || "School Financial Office",
        title,
        body,
        type: "payment",
        data: { studentUid, amount, receiptNo, paymentType }
      });
    }
  } catch (e) {
    console.error("Error sending payment notifications to student & parents:", e);
  }
}
