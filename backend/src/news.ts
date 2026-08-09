import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";

/**
 * Manually triggered cleanup for expired news.
 * Moved from scheduled to callable to reduce background costs.
 */
export const runNewsMaintenance = onCall({ invoker: "public" }, async (req) => {
  const auth = req.auth;
  if (!auth) throw new HttpsError("unauthenticated", "Auth required.");

  const db = admin.firestore();
  const callerDoc = await db.collection("users").doc(auth.uid).get();
  if (callerDoc.data()?.role !== "admin") throw new HttpsError("permission-denied", "Admin only.");

  const today = new Date();
  let count = 0;

  try {
    const newsSnapshot = await db.collection("news").get();
    
    for (const newsDoc of newsSnapshot.docs) {
      const newsData = newsDoc.data();
      if (newsData.isBirthday) continue;

      const expiryDate = newsData.expiryDate?.toDate();
      if (expiryDate) {
        const deleteThreshold = new Date(expiryDate);
        deleteThreshold.setDate(deleteThreshold.getDate() + 7);

        if (today > deleteThreshold) {
          await newsDoc.ref.delete();
          count++;
        }
      }
    }
    return { success: true, deleted: count };
  } catch (error: any) {
    throw new HttpsError("internal", error.message);
  }
});
