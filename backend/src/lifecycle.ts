import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";

/**
 * Scheduled task to automatically delete archived students after 3 years.
 * Runs once every day at midnight.
 */
export const purgeOldArchivedUsers = onSchedule("0 0 * * *", async () => {
  const db = admin.firestore();
  const auth = admin.auth();

  // Calculate the date 3 years ago
  const threeYearsAgo = new Date();
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
  const cutoff = admin.firestore.Timestamp.fromDate(threeYearsAgo);

  try {
    console.log("Starting purge of archived users older than 3 years...");

    // Find students who were archived more than 3 years ago
    const snapshot = await db
      .collection("users")
      .where("status", "==", "archived")
      .where("archivedAt", "<", cutoff)
      .limit(500) // Process in chunks to avoid timeouts/memory issues
      .get();

    if (snapshot.empty) {
      console.log("No old archived users found to purge.");
      return;
    }

    const deletePromises = snapshot.docs.map(async (doc) => {
      const uid = doc.id;
      try {
        // 1. Delete from Firebase Auth
        await auth.deleteUser(uid);
      } catch (authErr: any) {
        // If user already doesn't exist in Auth, just log it and continue to Firestore deletion
        if (authErr.code !== "auth/user-not-found") {
          console.error(`Error deleting Auth user ${uid}:`, authErr);
        }
      }

      // 2. Delete the Firestore document
      await doc.ref.delete();
      console.log(`Purged archived user: ${uid}`);
    });

    await Promise.all(deletePromises);
    console.log(`Successfully purged ${snapshot.size} users.`);
  } catch (error) {
    console.error("Error in purgeOldArchivedUsers:", error);
  }
});
