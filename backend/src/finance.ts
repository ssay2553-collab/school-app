import * as admin from "firebase-admin";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";

// Ensure admin SDK is initialized (safe to call multiple times)
if (admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * Triggered when a payment is added or updated in studentFeeRecords.
 */
export const onPaymentReceived = onDocumentUpdated(
  "studentFeeRecords/{recordId}",
  async (event) => {
    const newValue = event.data?.after.data();
    const previousValue = event.data?.before.data();

    if (!newValue || !previousValue) return;

    // Detect if amountPaid has increased
    if (newValue.amountPaid > previousValue.amountPaid) {
      const paymentAmount = newValue.amountPaid - previousValue.amountPaid;
      const studentUid = newValue.studentUid;
      const studentName = newValue.studentName || "your child";

      try {
        // 1. Get Student to find Parents
        const studentDoc = await admin
          .firestore()
          .doc(`users/${studentUid}`)
          .get();
        const studentData = studentDoc.data();

        if (!studentData || !studentData.parentUids) return;

        const parentUids: string[] = studentData.parentUids;

        // 2. Fetch Parent Tokens
        const tokens: string[] = [];
        for (const uid of parentUids) {
          const parentDoc = await admin.firestore().doc(`users/${uid}`).get();
          if (parentDoc.exists && parentDoc.data()?.fcmToken) {
            tokens.push(parentDoc.data()?.fcmToken);
          }
        }

        if (tokens.length === 0) return;

        // 3. Send Notification
        const message = {
          notification: {
            title: "Payment Received ✅",
            body: `Receipt: ₵${paymentAmount.toFixed(2)} received for ${studentName}. New balance: ₵${newValue.balance.toFixed(2)}.`,
          },
          data: { type: "fee_payment" },
          tokens: tokens,
        };

        await admin.messaging().sendEachForMulticast(message);
      } catch (error) {
        console.error("Error sending payment notification:", error);
      }
    }
  },
);

/**
 * Scheduled task to remind parents about outstanding fees.
 * Runs on the 26th and 27th of every month at 3 PM (15:00).
 * Cron format: "minute hour day month dayOfWeek"
 */
export const sendFeeReminders = onSchedule("0 15 26,27 * *", async (event) => {
  const db = admin.firestore();

  try {
    // 1. Fetch all records with a balance > 0
    const recordsSnap = await db
      .collection("studentFeeRecords")
      .where("balance", ">", 0)
      .get();

    if (recordsSnap.empty) {
      console.log("No outstanding fee records found.");
      return;
    }

    // 2. Process each record
    for (const doc of recordsSnap.docs) {
      const record = doc.data();
      const studentUid = record.studentUid;
      const balance = record.balance;
      const studentName = record.studentName || "your child";

      // 3. Find parent(s) for this student
      const studentDoc = await db.collection("users").doc(studentUid).get();
      const studentData = studentDoc.data();

      if (
        !studentData ||
        !studentData.parentUids ||
        studentData.parentUids.length === 0
      )
        continue;

      const tokens: string[] = [];
      for (const pUid of studentData.parentUids) {
        const parentDoc = await db.collection("users").doc(pUid).get();
        const parentData = parentDoc.data();
        if (parentData?.fcmToken) {
          tokens.push(parentData.fcmToken);
        }
      }

      if (tokens.length > 0) {
        const message = {
          notification: {
            title: "Fee Reminder 🔔",
            body: `Gentle reminder: ${studentName} has an outstanding balance of ₵${balance.toFixed(2)}. Please settle to avoid inconvenience.`,
          },
          data: { type: "fee_reminder" },
          tokens: tokens,
        };

        await admin.messaging().sendEachForMulticast(message);
        console.log(
          `Sent reminder for student ${studentName} to ${tokens.length} parents.`,
        );
      }
    }
  } catch (error) {
    console.error("Error in sendFeeReminders function:", error);
  }
});

/**
 * Deletes an expenditure entry and logs the action for audit.
 * payload: { expenditureId: string }
 */
export const deleteExpenditure = onCall(async (req) => {
  const auth = req.auth;
  if (!auth) throw new HttpsError("unauthenticated", "Auth required.");

  const { expenditureId } = req.data || {};
  if (!expenditureId)
    throw new HttpsError("invalid-argument", "Missing expenditureId.");

  const db = admin.firestore();

  // 1. Verify Caller is an Admin
  const callerDoc = await db.collection("users").doc(auth.uid).get();
  const callerData = callerDoc.data();
  const expPermission = callerData?.permissions?.["expenditure"] || "deny";
  const isSuperAdmin = [
    "proprietor",
    "proprietress",
    "manager",
    "headmaster",
    "headmistress",
    "administrator",
    "director",
  ].includes(callerData?.adminRole?.toLowerCase() || "");
  const canDelete =
    isSuperAdmin || expPermission === "full" || expPermission === "edit";

  if (!canDelete) {
    throw new HttpsError(
      "permission-denied",
      "Unauthorized to delete expenditures.",
    );
  }

  try {
    const expRef = db.collection("expenditures").doc(expenditureId);
    const expDoc = await expRef.get();

    if (!expDoc.exists) {
      throw new HttpsError("not-found", "Expenditure record not found.");
    }

    const expData = expDoc.data();

    // 2. Perform Deletion
    await expRef.delete();

    // 3. Log the Deletion for audit (Optional but highly recommended)
    await db.collection("auditLogs").add({
      action: "DELETE_EXPENDITURE",
      performedBy: auth.uid,
      adminName: callerData?.profile?.firstName || "Unknown Admin",
      details: {
        item: expData?.item,
        amount: expData?.amount,
        expenditureDate: expData?.date,
      },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Expenditure ${expenditureId} deleted by ${auth.uid}`);
    return { status: 200, message: "Expenditure deleted successfully." };
  } catch (error: any) {
    console.error("deleteExpenditure error:", error);
    throw new HttpsError("internal", error.message || "Deletion failed.");
  }
});

/**
 * Daily Arrears Task: Process students who were marked present or not marked
 * and have not paid for feeding or bus today.
 */
export const processDailyArrears = onSchedule("0 22 * * *", async (event) => {
  const db = admin.firestore();
  const today = new Date().toISOString().split("T")[0];

  try {
    // 1. Fetch Academic Config for current rates and terms
    const configSnap = await db.doc("school_settings/academic_config").get();
    const config = configSnap.data();
    if (!config) return;

    const feedingRate = config.feedingRate || 0;
    const extraClassesRate = config.extraClassesRate || 0;
    const academicYear = config.academicYear;
    const term = config.currentTerm;

    if (!academicYear || !term) return;

    // 2. Fetch all active students
    const studentsSnap = await db
      .collection("users")
      .where("role", "==", "student")
      .where("status", "in", ["active", "pending_activation"])
      .get();

    // 3. Fetch today's payments to identify who already paid or is exempted
    const paymentsSnap = await db
      .collection("feePayments")
      .where("date", "==", today)
      .get();

    const paidFeedingUids = new Set();
    const paidBusUids = new Set();
    const paidExtraUids = new Set();

    paymentsSnap.forEach((doc) => {
      const data = doc.data();
      if (data.type === "feeding") paidFeedingUids.add(data.studentUid);
      if (data.type === "bus") paidBusUids.add(data.studentUid);
      if (data.type === "extra") paidExtraUids.add(data.studentUid);
    });

    // 4. Fetch today's attendance to identify absent students
    const attendanceSnap = await db
      .collection("attendance")
      .where("date", "==", today)
      .get();

    const absentUids = new Set();
    attendanceSnap.forEach((doc) => {
      const data = doc.data();
      Object.keys(data.students || {}).forEach((sUid) => {
        if (data.students[sUid].status === "absent") {
          absentUids.add(sUid);
        }
      });
    });

    // 5. Fetch Bus Rates
    const busRatesSnap = await db.doc("school_settings/bus_rates").get();
    const busRates = busRatesSnap.data() || {};

    const batch = db.batch();
    let count = 0;

    for (const studentDoc of studentsSnap.docs) {
      const student = studentDoc.data();
      const uid = studentDoc.id;

      // Skip if absent
      if (absentUids.has(uid)) continue;

      // --- FEEDING ARREARS ---
      if (student.isFeeding && !paidFeedingUids.has(uid) && feedingRate > 0) {
        const serial = `FD-ARR-${uid}-${today}`;
        const recordId = `${uid}_${academicYear.replace(/\//g, "-")}_${term.replace(/\s+/g, "")}`;

        batch.update(db.collection("users").doc(uid), {
          walletBalance: admin.firestore.FieldValue.increment(feedingRate),
        });

        batch.set(
          db.collection("studentFeeRecords").doc(recordId),
          {
            termBill: admin.firestore.FieldValue.increment(feedingRate),
            balance: admin.firestore.FieldValue.increment(feedingRate),
            totalPayable: admin.firestore.FieldValue.increment(feedingRate),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );

        batch.set(db.collection("feePayments").doc(serial), {
          amount: feedingRate,
          schoolId: student.schoolId || "lilies",
          method: "Arrears",
          description: "Feeding Fee (Auto-Arrears)",
          updatedBy: "System (Auto-Task)",
          createdAt: new Date().toISOString(),
          receiptNo: serial,
          date: today,
          studentUid: uid,
          studentName: `${student.profile?.firstName || ""} ${student.profile?.lastName || ""}`.trim(),
          classId: student.classId,
          type: "feeding",
        });
        count++;
      }

      // --- BUS ARREARS ---
      const busRate = busRates[student.busLocation || ""] || 0;
      if (student.takesBus && !paidBusUids.has(uid) && busRate > 0) {
        const serial = `BS-ARR-${uid}-${today}`;
        const recordId = `${uid}_${academicYear.replace(/\//g, "-")}_${term.replace(/\s+/g, "")}`;

        batch.update(db.collection("users").doc(uid), {
          walletBalance: admin.firestore.FieldValue.increment(busRate),
        });

        batch.set(
          db.collection("studentFeeRecords").doc(recordId),
          {
            termBill: admin.firestore.FieldValue.increment(busRate),
            balance: admin.firestore.FieldValue.increment(busRate),
            totalPayable: admin.firestore.FieldValue.increment(busRate),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );

        batch.set(db.collection("feePayments").doc(serial), {
          amount: busRate,
          schoolId: student.schoolId || "lilies",
          method: "Arrears",
          description: `Bus Fee (${student.busLocation}) (Auto-Arrears)`,
          updatedBy: "System (Auto-Task)",
          createdAt: new Date().toISOString(),
          receiptNo: serial,
          date: today,
          studentUid: uid,
          studentName: `${student.profile?.firstName || ""} ${student.profile?.lastName || ""}`.trim(),
          classId: student.classId,
          type: "bus",
        });
        count++;
      }

      // --- EXTRA CLASSES ARREARS ---
      if (student.takesExtraClasses && !paidExtraUids.has(uid) && extraClassesRate > 0) {
        const serial = `EX-ARR-${uid}-${today}`;
        const recordId = `${uid}_${academicYear.replace(/\//g, "-")}_${term.replace(/\s+/g, "")}`;

        batch.update(db.collection("users").doc(uid), {
          walletBalance: admin.firestore.FieldValue.increment(extraClassesRate),
        });

        batch.set(
          db.collection("studentFeeRecords").doc(recordId),
          {
            termBill: admin.firestore.FieldValue.increment(extraClassesRate),
            balance: admin.firestore.FieldValue.increment(extraClassesRate),
            totalPayable: admin.firestore.FieldValue.increment(extraClassesRate),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );

        batch.set(db.collection("feePayments").doc(serial), {
          amount: extraClassesRate,
          schoolId: student.schoolId || "lilies",
          method: "Arrears",
          description: "Extra Classes (Auto-Arrears)",
          updatedBy: "System (Auto-Task)",
          createdAt: new Date().toISOString(),
          receiptNo: serial,
          date: today,
          studentUid: uid,
          studentName: `${student.profile?.firstName || ""} ${student.profile?.lastName || ""}`.trim(),
          classId: student.classId,
          type: "extra",
        });
        count++;
      }

      if (count > 400) {
        // Firestore batch limit is 500
        await batch.commit();
        count = 0;
      }
    }

    if (count > 0) await batch.commit();
    console.log("Daily arrears processing completed.");
  } catch (error) {
    console.error("Error in processDailyArrears:", error);
  }
});
