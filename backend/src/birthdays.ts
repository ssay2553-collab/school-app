import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall } from "firebase-functions/v2/https";

/**
 * Common logic to check and post birthdays.
 * Runs in GMT (Ghana Time) which is same as UTC.
 */
async function performBirthdayCheck() {
  const db = admin.firestore();
  const now = new Date();
  
  // Ghana is UTC+0. 
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  const currentYear = now.getFullYear();

  console.log(`[Birthdays] Checking for celebrants on ${currentMonth}/${currentDay}`);

  const studentsSnap = await db.collection("users")
    .where("role", "==", "student")
    .get();

  if (studentsSnap.empty) return { success: true, count: 0 };

  const celebrants: any[] = [];
  
  for (const docSnap of studentsSnap.docs) {
    const data = docSnap.data();
    let dob: Date | null = null;
    
    if (data.dateOfBirth) {
      if (typeof data.dateOfBirth.toDate === "function") {
        dob = data.dateOfBirth.toDate();
      } else if (data.dateOfBirth instanceof admin.firestore.Timestamp) {
        dob = data.dateOfBirth.toDate();
      } else {
        dob = new Date(data.dateOfBirth);
      }
    }

    if (dob && !isNaN(dob.getTime()) && dob.getMonth() + 1 === currentMonth && dob.getDate() === currentDay) {
      celebrants.push({
        id: docSnap.id,
        ...data,
        fullName: `${data.profile?.firstName || "Student"} ${data.profile?.lastName || ""}`.trim(),
        firstName: data.profile?.firstName || "Student"
      });
    }
  }

  if (celebrants.length === 0) return { success: true, count: 0 };

  // Duration: 15 hours from posting
  const expiryDate = new Date(now.getTime() + 15 * 60 * 60 * 1000);
  const messages = [
      `🎉 A very warm Happy Birthday! 🎂 The entire school family is celebrating you today. May your year be filled with bright smiles, new discoveries, and endless joy. Keep shining! 🌟`,
      `🌈 Wishing you a magical birthday filled with laughter and love! 🎈 We are so proud of your journey here. Have a fantastic day and a brilliant year ahead! 🎊`,
      `✨ Huge birthday cheers! 🍰 May your special day be as amazing as you are. Wishing you success in all your studies and happiness in everything you do! 🎓`
  ];

  // 1. Post individual silent wishes for the feed
  for (const celebrant of celebrants) {
    const newsId = `bday_${celebrant.id}_${currentYear}`;
    const existing = await db.collection("news").doc(newsId).get();
    
    if (!existing.exists) {
      await db.collection("news").doc(newsId).set({
        title: `🎂 Happy Birthday, ${celebrant.firstName}!`,
        content: messages[Math.floor(Math.random() * messages.length)],
        mediaUrl: celebrant.profile?.profileImage || null,
        mediaType: "image",
        category: "Celebration",
        audience: "all", 
        author: "School Administration",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiryDate: admin.firestore.Timestamp.fromDate(expiryDate),
        isBirthday: true, 
        silentWish: true, // Don't trigger individual notifications yet
        celebrantUid: celebrant.id,
        celebrantName: celebrant.fullName,
        celebrantClassId: celebrant.classId || null,
        celebrantParentUids: celebrant.parentUids || [],
      });
    }
  }

  // 2. Post ONE summary notification for teachers/admins/parents
  const summaryId = `bday_summary_${currentMonth}_${currentDay}_${currentYear}`;
  const existingSummary = await db.collection("news").doc(summaryId).get();

  if (!existingSummary.exists) {
    let summaryTitle = "";
    let summaryContent = "";

    if (celebrants.length === 1) {
      summaryTitle = `🎂 Birthday Celebration: ${celebrants[0].firstName}!`;
      summaryContent = `Today we celebrate ${celebrants[0].fullName}! Join us in wishing them a wonderful day. 🎉`;
    } else {
      const names = celebrants.map(c => c.firstName).join(", ");
      summaryTitle = `🎂 Today's Birthdays: ${celebrants.length} Celebrants!`;
      summaryContent = `Huge birthday cheers to ${names}! We are so proud to have you all in our school family. Have a magical day! 🎈✨`;
    }

    await db.collection("news").doc(summaryId).set({
      title: summaryTitle,
      content: summaryContent,
      category: "Celebration",
      audience: "all",
      author: "School Administration",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiryDate: admin.firestore.Timestamp.fromDate(expiryDate),
      isBirthday: true,
      isSummary: true,
      silentWish: false, // THIS triggers the single notification
      celebrantCount: celebrants.length,
      // For the notification logic in news.ts to reach everyone
      celebrantClassIds: Array.from(new Set(celebrants.map(c => c.classId).filter(Boolean))),
      celebrantParentUids: Array.from(new Set(celebrants.flatMap(c => c.parentUids || []))),
    });
  }

  return { success: true, count: celebrants.length };
}

/**
 * Runs daily at 6:00 AM UTC (same as GMT/Ghana Time)
 */
export const checkStudentBirthdays = onSchedule("every day 06:00", async () => {
  await performBirthdayCheck();
});

/**
 * Daily cleanup at 11:00 PM to remove today's birthday posts
 */
export const cleanupExpiredBirthdays = onSchedule("every day 23:00", async () => {
    const db = admin.firestore();
    const snap = await db.collection("news")
        .where("isBirthday", "==", true)
        .get();
    
    const now = new Date();
    const batch = db.batch();
    let deletedCount = 0;

    snap.forEach(doc => {
        const data = doc.data();
        const expiry = data.expiryDate?.toDate();
        if (expiry && expiry < now) {
            batch.delete(doc.ref);
            deletedCount++;
        }
    });

    if (deletedCount > 0) {
        await batch.commit();
        console.log(`[Birthdays] Cleaned up ${deletedCount} expired posts.`);
    }
});

/**
 * Manual trigger for Admins
 */
export const triggerBirthdayCheckManually = onCall(async (request) => {
  if (!request.auth) throw new Error("Unauthorized");
  const userDoc = await admin.firestore().collection("users").doc(request.auth.uid).get();
  if (userDoc.data()?.role !== "admin") throw new Error("Permission Denied");
  return await performBirthdayCheck();
});
