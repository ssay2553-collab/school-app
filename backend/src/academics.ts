import * as admin from "firebase-admin";
import {
    onDocumentCreated,
    onDocumentWritten,
} from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";

/**
 * Triggered when a new assignment is created.
 */
export const onNewAssignment = onDocumentCreated(
  "assignments/{assignmentId}",
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    
    const { title, classId, subjectId, dueDate } = data;
    const db = admin.firestore();

    try {
      let deadlineStr = "Soon";
      if (dueDate) {
        const due = (dueDate as admin.firestore.Timestamp).toDate();
        const now = new Date();
        const diffMs = due.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        deadlineStr = diffDays > 0 ? `in ${diffDays} days` : "Today";
      }

      const studentsSnap = await db.collection("users")
        .where("role", "==", "student")
        .where("classId", "==", classId)
        .get();

      if (studentsSnap.empty) return;

      const studentTokens: string[] = [];
      const parentUids = new Set<string>();

      studentsSnap.forEach((doc) => {
        const sData = doc.data();
        if (sData.fcmToken) studentTokens.push(sData.fcmToken);
        if (sData.parentUids) {
          sData.parentUids.forEach((pUid: string) => parentUids.add(pUid));
        }
      });

      if (studentTokens.length > 0) {
        await admin.messaging().sendEachForMulticast({
          notification: { 
            title: `New Assignment: ${subjectId} 📚`, 
            body: `${title}. Due ${deadlineStr}.` 
          },
          data: { type: "assignment", classId },
          tokens: studentTokens,
        });
      }

      if (parentUids.size > 0) {
        const parentTokens: string[] = [];
        const parentChunks = Array.from(parentUids);
        
        for (let i = 0; i < parentChunks.length; i += 30) {
          const chunk = parentChunks.slice(i, i + 30);
          const parentsSnap = await db.collection("users")
            .where(admin.firestore.FieldPath.documentId(), "in", chunk)
            .get();
          
          parentsSnap.forEach(pDoc => {
            const pData = pDoc.data();
            if (pData.fcmToken) parentTokens.push(pData.fcmToken);
          });
        }

        if (parentTokens.length > 0) {
          await admin.messaging().sendEachForMulticast({
            notification: {
              title: `Assignment Notice: ${subjectId} 🔔`,
              body: `A new task has been posted for your child. It is due ${deadlineStr}.`,
            },
            data: { type: "parent_assignment_alert", classId },
            tokens: parentTokens,
          });
        }
      }

      const managersSnap = await db.collection("users")
        .where("role", "==", "admin")
        .where("adminRole", "in", ["Headmaster", "Proprietor", "CEO", "Assistant Headmaster"])
        .get();

      const managerTokens: string[] = [];
      managersSnap.forEach(doc => {
        const mData = doc.data();
        if (mData.fcmToken) managerTokens.push(mData.fcmToken);
      });

      if (managerTokens.length > 0) {
        await admin.messaging().sendEachForMulticast({
          notification: {
            title: `Staff Activity: ${subjectId} 📈`,
            body: `A teacher posted a new assignment for ${classId}. Due ${deadlineStr}.`,
          },
          data: { type: "admin_assignment_monitor", classId },
          tokens: managerTokens,
        });
      }

    } catch (error) {
      console.error("Assignment notification error:", error);
    }
  },
);

/**
 * Triggered when a student submits an assignment.
 */
export const onNewSubmission = onDocumentCreated(
  "submissions/{submissionId}",
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const { studentId, studentName, subjectId, assignmentId, classId, teacherId } = data;
    const db = admin.firestore();

    try {
      // 1. Notify Parent(s)
      const studentSnap = await db.collection("users").doc(studentId).get();
      if (studentSnap.exists) {
        const sData = studentSnap.data();
        const parentUids = sData?.parentUids || [];

        if (parentUids.length > 0) {
          const parentTokens: string[] = [];
          for (let i = 0; i < parentUids.length; i += 30) {
            const chunk = parentUids.slice(i, i + 30);
            const parentsSnap = await db.collection("users")
              .where(admin.firestore.FieldPath.documentId(), "in", chunk)
              .get();

            parentsSnap.forEach((pDoc: any) => {
              const pData = pDoc.data();
              if (pData.fcmToken) parentTokens.push(pData.fcmToken);
            });
          }

          if (parentTokens.length > 0) {
            await admin.messaging().sendEachForMulticast({
              notification: {
                title: "Assignment Submitted ✅",
                body: `${studentName} has successfully submitted the ${subjectId} assignment.`,
              },
              data: { type: "submission_alert", studentId, assignmentId },
              tokens: parentTokens,
            });
          }
        }
      }

      // 2. Notify Teacher (Only on the FIRST submission to avoid spamming)
      if (teacherId) {
        const countSnap = await db.collection("submissions")
          .where("assignmentId", "==", assignmentId)
          .count()
          .get();

        if (countSnap.data().count === 1) {
          const teacherSnap = await db.collection("users").doc(teacherId).get();
          if (teacherSnap.exists) {
            const tData = teacherSnap.data();
            if (tData?.fcmToken) {
              await admin.messaging().send({
                notification: {
                  title: "First Submission Received! 📥",
                  body: `${studentName} is the first to submit ${subjectId} for ${classId}. Check the dashboard for others.`,
                },
                data: { type: "teacher_submission_alert", assignmentId },
                token: tData.fcmToken,
              });
            }
          }
        }
      }
    } catch (error) {
      console.error("Submission notification error:", error);
    }
  },
);

/**
 * Scheduled function to delete expired assignments.
 */
export const deleteExpiredAssignments = onSchedule("0 0 * * *", async () => {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();
  try {
    const expiredSnap = await db.collection("assignments").where("dueDate", "<", now).get();
    if (expiredSnap.empty) return;
    const batch = db.batch();
    expiredSnap.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  } catch (error) {
    console.error("Error deleting expired assignments:", error);
  }
});

/**
 * Scheduled function to delete archived students older than 5 years.
 * Runs at 2 AM every day.
 */
export const purgeOldArchivedStudents = onSchedule("0 2 * * *", async () => {
  const db = admin.firestore();
  
  // Cutoff is 5 years ago from today
  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  const cutoff = admin.firestore.Timestamp.fromDate(fiveYearsAgo);

  try {
    const oldSnap = await db.collection("users")
      .where("status", "==", "archived")
      .where("archivedAt", "<", cutoff)
      .limit(500)
      .get();

    if (oldSnap.empty) return;

    const batch = db.batch();
    oldSnap.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    
    console.log(`Successfully purged ${oldSnap.size} archived student records older than 5 years.`);
  } catch (error) {
    console.error("Error purging old archived students:", error);
  }
});

/**
 * Scheduled function to delete expired submissions.
 */
export const deleteExpiredSubmissions = onSchedule("0 1 * * *", async () => {
  const db = admin.firestore();
  try {
    const cutoff = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 100 * 24 * 60 * 60 * 1000));
    const expiredSnap = await db.collection("submissions").where("markedAt", "<", cutoff).get();
    if (expiredSnap.empty) return;
    const batch = db.batch();
    expiredSnap.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  } catch (error) {
    console.error("Error deleting expired submissions:", error);
  }
});

/**
 * Scheduled function to notify teachers 10 minutes before lesson starts.
 */
export const notifyUpcomingLessons = onSchedule("* * * * *", async () => {
  const db = admin.firestore();
  const now = new Date();
  const targetTime = new Date(now.getTime() + 10 * 60000); 
  const dayName = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(targetTime);
  let hours = targetTime.getHours();
  const minutes = targetTime.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  const timeStr = `${hours}:${minutes} ${ampm}`;

  try {
    const timetablesSnap = await db.collection("timetables").get();
    for (const timetableDoc of timetablesSnap.docs) {
      const classId = timetableDoc.id;
      const data = timetableDoc.data();
      const periods = data.timetableDays?.[dayName] || [];
      const upcomingPeriods = periods.filter((p: any) => p.startTime?.trim() === timeStr);
      for (const period of upcomingPeriods) {
        const subject = period.subject;
        const teachersSnap = await db.collection("users")
          .where("role", "==", "teacher")
          .where("classes", "array-contains", classId)
          .get();
        const tokens: string[] = [];
        teachersSnap.forEach((doc) => {
          const teacherData = doc.data();
          if (teacherData.subjects?.includes(subject) && teacherData.fcmToken) {
            tokens.push(teacherData.fcmToken);
          }
        });
        if (tokens.length > 0) {
          await admin.messaging().sendEachForMulticast({
            notification: {
              title: "Class Starting Soon! 🔔",
              body: `Your ${subject} lesson for ${classId} starts in 10 minutes (${timeStr}).`,
            },
            data: { type: "timetable_reminder", classId, subject },
            tokens: tokens,
          });
        }
      }
    }
  } catch (error) {
    console.error("Error in notifyUpcomingLessons:", error);
  }
});

/**
 * STUDENT STATS UPDATE: Updates the 'stats/global' document.
 */
export const onStudentStatsUpdate = onDocumentWritten(
  "users/{userId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const db = admin.firestore();

    const isStudent = (doc: any) => doc?.role === "student";
    const oldS = isStudent(before) ? before : null;
    const newS = isStudent(after) ? after : null;

    if (!oldS && !newS) return;

    // Correct Global Stats Path as requested
    const globalStatsRef = db.doc("stats/global");

    const updateGlobalStats = async (diff: any) => {
      await globalStatsRef.set({
        totalStudents: admin.firestore.FieldValue.increment(diff.t || 0),
        maleCount: admin.firestore.FieldValue.increment(diff.m || 0),
        femaleCount: admin.firestore.FieldValue.increment(diff.f || 0),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      console.log("Global stats updated:", diff);
    };

    if (!oldS && newS) {
      // CREATION
      await updateGlobalStats({
        t: 1,
        m: newS.gender === "Male" ? 1 : 0,
        f: newS.gender === "Female" ? 1 : 0,
      });
    } else if (oldS && !newS) {
      // DELETION
      await updateGlobalStats({
        t: -1,
        m: oldS.gender === "Male" ? -1 : 0,
        f: oldS.gender === "Female" ? -1 : 0,
      });
    } else if (oldS && newS && oldS.gender !== newS.gender) {
      // GENDER CHANGE
      await updateGlobalStats({
        t: 0,
        m: newS.gender === "Male" ? 1 : -1,
        f: newS.gender === "Female" ? 1 : -1,
      });
    }
  },
);

/**
 * Attendance Summary Aggregator
 */
export const onAttendanceUpdateSummary = onDocumentCreated(
  "attendance/{attendanceId}",
  async (event) => {
    const data = event.data?.data();
    if (!data?.students) return;
    for (const studentId in data.students) {
      const status = data.students[studentId].status;
      await admin.firestore().doc(`users/${studentId}`).update({
        [`attendanceSummary.${status}`]: admin.firestore.FieldValue.increment(1),
      }).catch(() => null);
    }
  },
);
