import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";

/**
 * Triggered when new news is posted.
 * For birthdays, it targets specific groups:
 * 1. Classmates of the celebrant
 * 2. Parents of the celebrant
 * 3. All teachers and admins
 * 
 * SILENT WISHES: If silentWish is true, it skips notifications entirely.
 */
export const onNewNewsBroadcast = onDocumentCreated("news/{newsId}", async (event) => {
  const newsData = event.data?.data();
  if (!newsData) return;

  const { title, content, audience, isBirthday } = newsData;
  const silentWish = newsData.silentWish === true;
  const newsId = event.params.newsId;
  const db = admin.firestore();

  // If it's a silent wish, we just stop here. No notifications created or sent.
  if (silentWish) {
    console.log(`[News] Silent wish detected for ${title}. Skipping notifications.`);
    return;
  }

  try {
    await event.data?.ref.update({
      lastNotifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const recipients = new Set<string>();
    const tokens: string[] = [];

    if (isBirthday === true) {
      const { celebrantClassId, celebrantParentUids, celebrantUid } = newsData;
      
      // 1. Get Classmates (Students in the same class)
      if (celebrantClassId) {
        const classmates = await db.collection("users")
          .where("role", "==", "student")
          .where("classId", "==", celebrantClassId)
          .get();
        classmates.forEach(doc => recipients.add(doc.id));
      }

      // 2. Get Linked Parents
      if (celebrantParentUids && Array.isArray(celebrantParentUids)) {
        celebrantParentUids.forEach((uid: string) => recipients.add(uid));
      }

      // 3. Get All Teachers and Admins
      const staff = await db.collection("users")
        .where("role", "in", ["teacher", "admin"])
        .get();
      staff.forEach(doc => recipients.add(doc.id));

      // Always include the student themselves
      if (celebrantUid) recipients.add(celebrantUid);

    } else {
      // Standard News Logic
      let userQuery;
      if (audience === "all") {
        userQuery = db.collection("users");
      } else {
        userQuery = db.collection("users").where("role", "==", audience);
      }
      const snapshot = await userQuery.get();
      snapshot.forEach(doc => recipients.add(doc.id));
    }

    if (recipients.size === 0) return;

    // Process in batches of 500
    const recipientIds = Array.from(recipients);
    for (let i = 0; i < recipientIds.length; i += 500) {
      const batchIds = recipientIds.slice(i, i + 500);
      const batch = db.batch();
      
      const usersSnap = await db.collection("users").where(admin.firestore.FieldPath.documentId(), "in", batchIds).get();
      
      usersSnap.forEach(userDoc => {
        const userData = userDoc.data();
        if (userData.fcmToken) tokens.push(userData.fcmToken);

        const notifRef = db.collection("notifications").doc();
        batch.set(notifRef, {
          recipientId: userDoc.id,
          title: isBirthday ? "Birthday Celebration! 🎂" : "School Announcement: " + title,
          body: isBirthday ? `Join us in wishing ${title.replace("🎂 ", "")}` : content.substring(0, 100),
          type: "news",
          newsId: newsId,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          read: false,
        });
      });
      await batch.commit();
    }

    // Push Notifications
    if (tokens.length > 0) {
      const message = {
        notification: {
          title: isBirthday ? "Celebration Time! 🎂" : "School Announcement 📢",
          body: isBirthday ? `It's someone's special day! Open to see who.` : title,
        },
        data: { type: "news_update", newsId: newsId },
        tokens: tokens.slice(0, 500), // Note: multicast limit is 500
      };
      await admin.messaging().sendEachForMulticast(message);
    }

  } catch (error) {
    console.error("Error broadcasting news:", error);
  }
});

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
