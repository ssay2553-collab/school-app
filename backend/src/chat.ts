import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";

/**
 * Manual cleanup for chat messages and inactive tokens.
 * Moved from scheduled to callable to reduce unnecessary hourly Firestore reads.
 */
export const runChatMaintenance = onCall({ invoker: "public" }, async (req) => {
  const auth = req.auth;
  if (!auth) throw new HttpsError("unauthenticated", "Auth required.");

  const db = admin.firestore();
  const callerDoc = await db.collection("users").doc(auth.uid).get();
  if (callerDoc.data()?.role !== "admin") throw new HttpsError("permission-denied", "Admin only.");

  let deletedMessages = 0;
  let clearedTokens = 0;

  // 1. Delete old messages (7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoffMessages = admin.firestore.Timestamp.fromDate(sevenDaysAgo);

  try {
    const directChatsSnap = await db.collection("directMessages").get();
    for (const chatDoc of directChatsSnap.docs) {
      const messagesRef = chatDoc.ref.collection("messages");
      const oldMessagesSnap = await messagesRef
        .where("createdAt", "<", cutoffMessages)
        .get();
      if (!oldMessagesSnap.empty) {
        const batch = db.batch();
        oldMessagesSnap.forEach((doc) => {
          batch.delete(doc.ref);
          deletedMessages++;
        });
        await batch.commit();
      }
    }

    const studentGroupsSnap = await db.collection("studentGroups").get();
    for (const groupDoc of studentGroupsSnap.docs) {
      const messagesRef = groupDoc.ref.collection("messages");
      const oldMessagesSnap = await messagesRef
        .where("createdAt", "<", cutoffMessages)
        .get();
      if (!oldMessagesSnap.empty) {
        const batch = db.batch();
        oldMessagesSnap.forEach((doc) => {
          batch.delete(doc.ref);
          deletedMessages++;
        });
        await batch.commit();
      }
    }
  } catch (e) {
    console.error("Old message cleanup error:", e);
  }

  // 2. Token auto-delete after 1 hour of inactivity
  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);
  const cutoffTokens = admin.firestore.Timestamp.fromDate(oneHourAgo);

  try {
    const usersWithTokens = await db
      .collection("users")
      .where("fcmToken", "!=", null)
      .where("tokenLastActive", "<", cutoffTokens)
      .get();

    if (!usersWithTokens.empty) {
      const batch = db.batch();
      usersWithTokens.forEach((doc) => {
        batch.update(doc.ref, {
          fcmToken: admin.firestore.FieldValue.delete(),
          tokenLastActive: admin.firestore.FieldValue.delete(),
        });
        clearedTokens++;
      });
      await batch.commit();
    }
  } catch (e) {
    console.error("Token cleanup error:", e);
  }

  return { success: true, deletedMessages, clearedTokens };
});
