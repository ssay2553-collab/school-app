import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";

/**
 * Scheduled function to check for upcoming academic calendar events.
 * Runs once every day at 06:00 AM.
 * Sends notifications 7 days before, 3 days before, and on the day of the event.
 */
export const processCalendarReminders = onSchedule("06 00 * * *", async () => {
  const db = admin.firestore();
  const now = new Date();
  
  // Set time to midnight for consistent day-based calculation
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  try {
    // We only care about events in the next 8 days
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 8);

    const snapshot = await db.collection("academic_calendar")
      .where("date", ">=", admin.firestore.Timestamp.fromDate(today))
      .where("date", "<=", admin.firestore.Timestamp.fromDate(nextWeek))
      .get();

    if (snapshot.empty) return;

    for (const eventDoc of snapshot.docs) {
      const event = eventDoc.data();
      const eventDate = event.date.toDate();
      const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
      
      // Calculate difference in days
      const diffTime = eventDay.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let reminderType = "";
      if (diffDays === 7) reminderType = "1 week away";
      else if (diffDays === 3) reminderType = "3 days away";
      else if (diffDays === 0) reminderType = "Today";

      if (reminderType) {
        await notifyEvent(eventDoc.id, event, reminderType);
      }
    }
  } catch (error) {
    console.error("Error processing calendar reminders:", error);
  }
});

async function notifyEvent(eventId: string, event: any, reminderType: string) {
  const db = admin.firestore();
  const { title, visibility, type } = event;

  console.log(`Sending reminder for [${title}] - ${reminderType}`);

  // 1. Determine roles to notify
  const targetRoles: string[] = ["admin"]; // Admins always get notified
  if (visibility === "all") {
    targetRoles.push("teacher", "parent", "student");
  } else if (visibility === "teachers") {
    targetRoles.push("teacher");
  } else if (visibility === "parents") {
    targetRoles.push("parent", "student");
  }

  // 2. Fetch target users
  const userSnapshot = await db.collection("users")
    .where("role", "in", targetRoles)
    .get();

  if (userSnapshot.empty) return;

  const tokens: string[] = [];
  const batch = db.batch();
  let count = 0;

  const notificationTitle = reminderType === "Today" 
    ? `📅 Event Today: ${title}`
    : `🔔 Upcoming ${type}: ${title}`;
  
  const notificationBody = reminderType === "Today"
    ? `The scheduled event "${title}" is happening today.`
    : `Reminder: The "${title}" is scheduled for ${reminderType}.`;

  for (const userDoc of userSnapshot.docs) {
    const userData = userDoc.data();
    
    // Collect tokens
    if (userData.fcmToken) {
      tokens.push(userData.fcmToken);
    }

    // Create in-app notification
    const notifRef = db.collection("notifications").doc();
    batch.set(notifRef, {
      recipientId: userDoc.id,
      title: notificationTitle,
      body: notificationBody,
      type: "calendar",
      eventId: eventId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      read: false,
    });

    count++;
    if (count === 500) {
      await batch.commit();
      count = 0;
    }
  }

  if (count > 0) await batch.commit();

  // 3. Send Push Notifications
  if (tokens.length > 0) {
    // Messaging chunks are limited to 500 tokens
    const chunks = [];
    for (let i = 0; i < tokens.length; i += 500) {
      chunks.push(tokens.slice(i, i + 500));
    }

    for (const chunk of chunks) {
      const message = {
        notification: {
          title: notificationTitle,
          body: notificationBody,
        },
        data: {
          type: "calendar_event",
          eventId: eventId,
        },
        tokens: chunk,
      };
      await admin.messaging().sendEachForMulticast(message);
    }
  }
}
