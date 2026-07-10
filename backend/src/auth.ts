import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";

// Ensure admin is initialized in this module context
if (admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * Manually repairs a failed migration by moving data from an old Temp ID to a new Auth UID.
 * Useful for students who signed up before the migration logic was implemented.
 */
export const repairStudentMigration = onCall({
  maxInstances: 5,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }

  const { targetUid, oldUid } = request.data;
  if (!targetUid || !oldUid) {
    throw new HttpsError("invalid-argument", "Both targetUid and oldUid are required.");
  }

  const db = admin.firestore();
  const batch = db.batch();

  try {
    // 1. Fetch Target User to ensure they exist and get their name
    const targetSnap = await db.collection("users").doc(targetUid).get();
    if (!targetSnap.exists) {
      throw new HttpsError("not-found", "Target student not found.");
    }
    const targetData = targetSnap.data();
    const fullName = `${targetData?.profile?.firstName || ""} ${targetData?.profile?.lastName || ""}`.trim();

    // 2. Migrate studentFeeRecords
    const feeRecordsSnap = await db.collection("studentFeeRecords")
      .where("studentUid", "==", oldUid)
      .get();

    for (const recordDoc of feeRecordsSnap.docs) {
      const d = recordDoc.data();
      const cleanYear = (d.academicYear || "").replace(/\//g, "-");
      const cleanTerm = (d.term || "").replace(/\s/g, "");
      const newRecordId = `${targetUid}_${cleanYear}_${cleanTerm}`;

      batch.set(db.collection("studentFeeRecords").doc(newRecordId), {
        ...d,
        studentUid: targetUid,
        studentName: fullName,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });
      batch.delete(recordDoc.ref);
    }

    // 3. Update feePayments
    const feePaymentsSnap = await db.collection("feePayments")
      .where("studentUid", "==", oldUid)
      .get();
    for (const paymentDoc of feePaymentsSnap.docs) {
      batch.update(paymentDoc.ref, {
        studentUid: targetUid,
        studentName: fullName
      });
    }

    // 4. Update dailyFinancials
    const dailyFinSnap = await db.collection("dailyFinancials")
      .where("studentUid", "==", oldUid)
      .get();
    for (const finDoc of dailyFinSnap.docs) {
      const d = finDoc.data();
      const newFinId = `${targetUid}_${d.date}`;
      batch.set(db.collection("dailyFinancials").doc(newFinId), {
        ...d,
        studentUid: targetUid,
        studentName: fullName,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      batch.delete(finDoc.ref);
    }

    // 5. Migrate Attendance Summary
    const attSummarySnap = await db.collection("attendanceSummary")
      .where("studentId", "==", oldUid)
      .get();
    for (const summaryDoc of attSummarySnap.docs) {
      const d = summaryDoc.data();
      const newSummaryId = `${targetUid}_${(d.academicYear || "").replace(/\//g, "-")}_${(d.term || "").replace(/\s/g, "")}`;
      batch.set(db.collection("attendanceSummary").doc(newSummaryId), {
        ...d,
        studentId: targetUid,
      });
      batch.delete(summaryDoc.ref);
    }

    // 6. Migrate Academic Records Summary
    const acadSummarySnap = await db.collection("academicRecordsSummary")
      .where("studentId", "==", oldUid)
      .get();
    for (const summaryDoc of acadSummarySnap.docs) {
      const d = summaryDoc.data();
      const newSummaryId = `${targetUid}_${(d.academicYear || "").replace(/\//g, "_")}_${(d.term || "").replace(/\s/g, "")}`;
      batch.set(db.collection("academicRecordsSummary").doc(newSummaryId), {
        ...d,
        studentId: targetUid,
      });
      batch.delete(summaryDoc.ref);
    }

    // 7. Bulk Update simple references (studentId field)
    const collectionsToUpdate = [
      "scores", "submissions", "behavioralRecords", "student-reports", "student_notes", "notifications", "activity_logs"
    ];
    for (const col of collectionsToUpdate) {
      const snap = await db.collection(col).where(col === "student_notes" || col === "activity_logs" ? "uid" : "studentId", "==", oldUid).get();
      snap.forEach(doc => {
        batch.update(doc.ref, { [col === "student_notes" || col === "activity_logs" ? "uid" : "studentId"]: targetUid });
      });
    }

    await batch.commit();
    return { success: true, message: `Successfully migrated records from ${oldUid} to ${targetUid}` };

  } catch (error: any) {
    console.error("repairStudentMigration Error:", error);
    throw new HttpsError("internal", error.message || "Repair failed.");
  }
});

/**
 * Custom auth for non-teaching staff using Username and 4-digit PIN.
 */
export const loginWithPin = onCall({
  maxInstances: 10,
  // Note: invoker "public" is set via CLI or during deployment for V2
}, async (request) => {
  const data = request.data;
  const username = data?.username;
  const pin = data?.pin;

  if (!username || !pin) {
    throw new HttpsError("invalid-argument", "Username and PIN are required.");
  }

  const db = admin.firestore();
  const auth = admin.auth();

  try {
    const usernameStr = String(username).trim().toLowerCase();
    const pinStr = String(pin).trim();

    // Query for the user by username
    const userQuery = await db.collection("users")
      .where("username", "==", usernameStr)
      .limit(5)
      .get();

    if (userQuery.empty) {
      throw new HttpsError("not-found", "No account found with that username.");
    }

    // Filter results for matching PIN and login status
    let matchingUser = null;
    let isDisabled = false;

    for (const doc of userQuery.docs) {
      const userData = doc.data();
      if (String(userData.pin) === pinStr) {
        if (userData.hasLoginEnabled === true) {
          matchingUser = doc;
          break;
        } else {
          isDisabled = true;
        }
      }
    }

    if (!matchingUser) {
      if (isDisabled) {
        throw new HttpsError("permission-denied", "This account's login is currently disabled.");
      }
      throw new HttpsError("unauthenticated", "Incorrect PIN.");
    }

    const uid = matchingUser.id;

    // Create a custom token.
    // This requires the "Service Account Token Creator" role on the service account.
    try {
      const customToken = await auth.createCustomToken(uid);
      return { token: customToken };
    } catch (tokenErr: any) {
      console.error("CRITICAL: Token Generation Failed.", {
        error: tokenErr.message,
        code: tokenErr.code,
        uid: uid
      });
      // Return a more descriptive internal error to help the dev
      throw new HttpsError(
        "internal",
        `Auth Server Error: ${tokenErr.message}. Ensure 'Service Account Token Creator' role is assigned in IAM.`
      );
    }

  } catch (error: any) {
    if (error instanceof HttpsError) throw error;
    console.error("LoginWithPin System Error:", error);
    throw new HttpsError("internal", error.message || "An unexpected internal error occurred.");
  }
});

/**
 * Completes student signup by merging a pre-registered (pending) profile
 * or initializing a new one from a signup code.
 */
export const completeStudentSignup = onCall({
  maxInstances: 10,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated to complete signup.");
  }

  const { uid } = request.auth;
  const data = request.data;

  const {
    form,
    pendingDocId,
    codeDocId,
    profileImageUrl,
    cleanCode,
  } = data;

  const db = admin.firestore();

  try {
    const batch = db.batch();

    let preRegisteredData: any = null;
    if (pendingDocId) {
      const pendingSnap = await db.collection("users").doc(pendingDocId).get();
      if (pendingSnap.exists) {
        preRegisteredData = pendingSnap.data();
      }
    }

    const userData = {
      uid: uid,
      role: "student",
      status: "active",
      classId: preRegisteredData?.classId || form.selectedClassId,
      gender: form.gender || preRegisteredData?.profile?.gender || "",
      secretCode: cleanCode,
      parentLinkCode: preRegisteredData?.parentLinkCode || Math.random().toString(36).substring(2, 8).toUpperCase(),
      parentUids: preRegisteredData?.parentUids || [],
      dateOfBirth: form.dateOfBirth ? admin.firestore.Timestamp.fromDate(new Date(form.dateOfBirth)) : (preRegisteredData?.dateOfBirth || null),
      walletBalance: preRegisteredData?.walletBalance || 0,
      profile: {
        firstName: form.firstName.trim() || preRegisteredData?.profile?.firstName,
        lastName: form.lastName.trim() || preRegisteredData?.profile?.lastName,
        email: form.email,
        phone: preRegisteredData?.profile?.phone || "",
        gender: form.gender || preRegisteredData?.profile?.gender || "",
        profileImage: profileImageUrl || preRegisteredData?.profile?.profileImage || null,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      claimedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    batch.set(db.collection("users").doc(uid), userData);

    if (pendingDocId) {
      batch.delete(db.collection("users").doc(pendingDocId));

      // 1. Migrate studentFeeRecords (Key: {studentUid}_{year}_{term})
      const feeRecordsSnap = await db.collection("studentFeeRecords")
        .where("studentUid", "==", pendingDocId)
        .get();

      for (const recordDoc of feeRecordsSnap.docs) {
        const d = recordDoc.data();
        const cleanYear = (d.academicYear || "").replace(/\//g, "-");
        const cleanTerm = (d.term || "").replace(/\s/g, "");
        const newRecordId = `${uid}_${cleanYear}_${cleanTerm}`;

        batch.set(db.collection("studentFeeRecords").doc(newRecordId), {
          ...d,
          studentUid: uid,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        });
        batch.delete(recordDoc.ref);
      }

      // 2. Update feePayments (studentUid & studentName field)
      const feePaymentsSnap = await db.collection("feePayments")
        .where("studentUid", "==", pendingDocId)
        .get();
      for (const paymentDoc of feePaymentsSnap.docs) {
        batch.update(paymentDoc.ref, {
          studentUid: uid,
          studentName: `${userData.profile.firstName} ${userData.profile.lastName}`
        });
      }

      // 3. Update dailyFinancials (Key: {studentUid}_{dateStr})
      const dailyFinSnap = await db.collection("dailyFinancials")
        .where("studentUid", "==", pendingDocId)
        .get();
      for (const finDoc of dailyFinSnap.docs) {
        const d = finDoc.data();
        const newFinId = `${uid}_${d.date}`;
        batch.set(db.collection("dailyFinancials").doc(newFinId), {
          ...d,
          studentUid: uid,
          studentName: `${userData.profile.firstName} ${userData.profile.lastName}`,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        batch.delete(finDoc.ref);
      }

      // 4. Migrate Attendance (attendance & attendanceSummary)
      const classId = preRegisteredData?.classId || form.selectedClassId;

      // attendanceSummary: {studentId}_{year}_{term}
      const attSummarySnap = await db.collection("attendanceSummary")
        .where("studentId", "==", pendingDocId)
        .get();
      for (const summaryDoc of attSummarySnap.docs) {
        const d = summaryDoc.data();
        const newSummaryId = `${uid}_${(d.academicYear || "").replace(/\//g, "-")}_${(d.term || "").replace(/\s/g, "")}`;
        batch.set(db.collection("attendanceSummary").doc(newSummaryId), {
          ...d,
          studentId: uid,
        });
        batch.delete(summaryDoc.ref);
      }

      // attendance: Update student key in 'students' map
      const attendanceSnap = await db.collection("attendance")
        .where("classId", "==", classId)
        .get();
      for (const attDoc of attendanceSnap.docs) {
        const d = attDoc.data();
        if (d.students && d.students[pendingDocId]) {
          const studentData = d.students[pendingDocId];
          batch.update(attDoc.ref, {
            [`students.${uid}`]: studentData,
            [`students.${pendingDocId}`]: admin.firestore.FieldValue.delete(),
          });
        }
      }

      // 5. Migrate Academic Records (academicRecords & academicRecordsSummary)
      const acadSummarySnap = await db.collection("academicRecordsSummary")
        .where("studentId", "==", pendingDocId)
        .get();
      for (const summaryDoc of acadSummarySnap.docs) {
        const d = summaryDoc.data();
        const newSummaryId = `${uid}_${(d.academicYear || "").replace(/\//g, "_")}_${(d.term || "").replace(/\s/g, "")}`;
        batch.set(db.collection("academicRecordsSummary").doc(newSummaryId), {
          ...d,
          studentId: uid,
        });
        batch.delete(summaryDoc.ref);
      }

      const academicSnap = await db.collection("academicRecords")
        .where("classId", "==", classId)
        .get();
      for (const acadDoc of academicSnap.docs) {
        const d = acadDoc.data();
        if (Array.isArray(d.students)) {
          const updatedStudents = d.students.map((s: any) => {
            if (s.studentId === pendingDocId) {
              return { ...s, studentId: uid };
            }
            return s;
          });
          batch.update(acadDoc.ref, { students: updatedStudents });
        }
      }

      // 6. Scores, Submissions, Reports
      const scoresSnap = await db.collection("scores").where("studentId", "==", pendingDocId).get();
      for (const doc of scoresSnap.docs) batch.update(doc.ref, { studentId: uid });

      const subSnap = await db.collection("submissions").where("studentId", "==", pendingDocId).get();
      for (const doc of subSnap.docs) batch.update(doc.ref, { studentId: uid });

      const behaviorSnap = await db.collection("behavioralRecords").where("studentId", "==", pendingDocId).get();
      for (const doc of behaviorSnap.docs) batch.update(doc.ref, { studentId: uid });

      const reportsSnap = await db.collection("student-reports").where("studentId", "==", pendingDocId).get();
      for (const doc of reportsSnap.docs) batch.update(doc.ref, { studentId: uid });

      // 7. Student Groups
      const groupsSnap = await db.collection("studentGroups").where("studentIds", "array-contains", pendingDocId).get();
      for (const groupDoc of groupsSnap.docs) {
        const d = groupDoc.data();
        const updatedIds = (d.studentIds || []).map((id: string) => id === pendingDocId ? uid : id);
        batch.update(groupDoc.ref, { studentIds: updatedIds });
      }

      // 8. Update Parents' childrenIds
      const parentsSnap = await db.collection("users").where("childrenIds", "array-contains", pendingDocId).get();
      for (const parentDoc of parentsSnap.docs) {
        const pData = parentDoc.data();
        const childrenIds = pData?.childrenIds || [];
        const updatedChildrenIds = childrenIds.map((id: string) => id === pendingDocId ? uid : id);
        batch.update(parentDoc.ref, { childrenIds: updatedChildrenIds });
      }

      // 9. Miscellaneous (Notifications, Notes, Activity Logs)
      const notifSnap = await db.collection("notifications").where("recipientId", "==", pendingDocId).get();
      for (const doc of notifSnap.docs) batch.update(doc.ref, { recipientId: uid });

      const notesSnap = await db.collection("student_notes").where("uid", "==", pendingDocId).get();
      for (const doc of notesSnap.docs) batch.update(doc.ref, { uid: uid });

      const logsSnap = await db.collection("activity_logs").where("uid", "==", pendingDocId).get();
      for (const doc of logsSnap.docs) batch.update(doc.ref, { uid: uid });

    } else if (codeDocId) {
      batch.update(db.collection("signupCodes").doc(codeDocId), {
        used: true,
        usedBy: uid,
        usedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    await batch.commit();
    return { success: true };

  } catch (error: any) {
    console.error("completeStudentSignup Error:", error);
    throw new HttpsError("internal", error.message || "Failed to complete signup.");
  }
});
