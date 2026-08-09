import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";

/**
 * Manually triggered task to delete archived students after 3 years.
 * Moved from scheduled to callable to reduce background costs.
 */
export const purgeOldArchivedUsers = onCall({ invoker: "public" }, async (req) => {
  const auth = req.auth;
  if (!auth) throw new HttpsError("unauthenticated", "Auth required.");

  const db = admin.firestore();
  const callerDoc = await db.collection("users").doc(auth.uid).get();
  if (callerDoc.data()?.role !== "admin") throw new HttpsError("permission-denied", "Admin only.");

  const firebaseAuth = admin.auth();

  // Calculate the date 3 years ago
  const threeYearsAgo = new Date();
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
  const cutoff = admin.firestore.Timestamp.fromDate(threeYearsAgo);

  try {
    const snapshot = await db
      .collection("users")
      .where("status", "==", "archived")
      .where("archivedAt", "<", cutoff)
      .limit(500)
      .get();

    if (snapshot.empty) return { success: true, count: 0 };

    let count = 0;
    const deletePromises = snapshot.docs.map(async (doc) => {
      const uid = doc.id;
      try {
        await firebaseAuth.deleteUser(uid);
      } catch (authErr: any) {
        if (authErr.code !== "auth/user-not-found") console.error(`Error deleting Auth user ${uid}:`, authErr);
      }
      await doc.ref.delete();
      count++;
    });

    await Promise.all(deletePromises);
    return { success: true, count };
  } catch (error: any) {
    throw new HttpsError("internal", error.message);
  }
});
