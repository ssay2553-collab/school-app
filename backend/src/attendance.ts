import * as admin from "firebase-admin";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";

/**
 * Triggered when an attendance document is created or updated.
 * Notifies parents if a student is marked present or absent.
 */
export const onAttendanceUpdate = onDocumentWritten("attendance/{attendanceId}", async (event) => {
  const newValue = event.data?.after.data();
  const previousValue = event.data?.before.data();

  if (!newValue) return; // Document was deleted

  const students = newValue.students || {};
  const prevStudents = previousValue?.students || {};
  const attendanceDate = newValue.date || new Date().toISOString().split("T")[0];
  const formattedDate = new Date(attendanceDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  for (const studentId in students) {
    const currentStatus = students[studentId].status;
    const previousStatus = prevStudents[studentId]?.status;

    // Notify if status changed (or is new)
    if (currentStatus !== previousStatus && (currentStatus === "present" || currentStatus === "absent")) {
      try {
        const studentDoc = await admin.firestore().doc(`users/${studentId}`).get();
        const studentData = studentDoc.data();
        
        if (!studentData || !studentData.parentUids || studentData.parentUids.length === 0) continue;

        const studentName = `${studentData.profile?.firstName || "Your child"}`;
        const parentUids: string[] = studentData.parentUids;

        const tokens: string[] = [];
        for (const parentUid of parentUids) {
          const parentDoc = await admin.firestore().doc(`users/${parentUid}`).get();
          const parentData = parentDoc.data();
          if (parentData?.fcmToken) {
            tokens.push(parentData.fcmToken);
          }
        }

        if (tokens.length > 0) {
          let title = "";
          let body = "";

          if (currentStatus === "present") {
            title = "Attendance Update: Present ✅";
            body = `${studentName} has arrived safely and is marked PRESENT for school today, ${formattedDate}.`;
          } else {
            title = "Attendance Alert: Absent ⚠️";
            body = `${studentName} was marked ABSENT for ${formattedDate}. Please chat with the teacher to provide a reason.`;
          }

          await admin.messaging().sendEachForMulticast({
            notification: { title, body },
            data: { 
              studentId, 
              type: "attendance_notification", 
              status: currentStatus, 
              date: attendanceDate 
            },
            tokens: tokens,
          });
          console.log(`Notification sent for ${studentName} (${currentStatus})`);
        }
      } catch (error) {
        console.error("Error sending attendance notification:", error);
      }
    }
  }
});

export const remindTeachersAttendance = onSchedule("30 8,9 * * 1-5", async (event) => {
  const db = admin.firestore();
  const todayKey = new Date().toISOString().split("T")[0];
  try {
    const classesSnap = await db.collection("classes").get();
    const attendanceSnap = await db.collection("attendance").where("date", "==", todayKey).get();
    const markedClassIds = new Set(attendanceSnap.docs.map(d => d.data().classId));

    for (const classDoc of classesSnap.docs) {
      if (!markedClassIds.has(classDoc.id)) {
        const teacherId = classDoc.data().classTeacherId;
        if (!teacherId) continue;
        const teacherDoc = await db.collection("users").doc(teacherId).get();
        if (teacherDoc.data()?.fcmToken) {
          await admin.messaging().send({
            notification: { title: "Attendance Reminder 📝", body: `Please mark today's attendance for ${classDoc.data().name || classDoc.id}.` },
            token: teacherDoc.data()?.fcmToken,
          });
        }
      }
    }
  } catch (error) { console.error(error); }
});
