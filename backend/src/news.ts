import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";

/**
 * Triggered when new news is posted.
 * ... Disabled to reduce costs. Notifications should be handled by the app.
 */
/*
export const onNewNewsBroadcast = onDocumentCreated("news/{newsId}", async (event) => {
  ...
});
*/

/**
 * Scheduled function to handle recurring notifications and auto-deletion.
 */
export const processNewsLifecycle = onSchedule("every day 00:00", async () => {
  const db = admin.firestore();
  const today = new Date();

  try {
    const newsSnapshot = await db.collection("news").get();
    
    for (const newsDoc of newsSnapshot.docs) {
      const newsData = newsDoc.data();
      if (newsData.isBirthday) continue; // Birthdays handled by birthdays.ts cleanup

      const expiryDate = newsData.expiryDate?.toDate();
      if (expiryDate) {
        const deleteThreshold = new Date(expiryDate);
        deleteThreshold.setDate(deleteThreshold.getDate() + 7);

        if (today > deleteThreshold) {
          await newsDoc.ref.delete();
          continue;
        }
      }
    }
  } catch (error) {
    console.error("Error in processNewsLifecycle:", error);
  }
});
