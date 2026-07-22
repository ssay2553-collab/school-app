import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * Scheduled task to remind parents about outstanding fees.
 * Runs on the 26th and 27th of every month at 3 PM.
 * KEEPING THIS as it involves cross-referencing multiple collections and
 * mass messaging which is better handled in the background.
 */
export const sendFeeReminders = onSchedule("0 15 26,27 * *", async (event) => {
  const db = admin.firestore();

  try {
    const recordsSnap = await db.collection("studentFeeRecords").where("balance", ">", 0).get();
    // const arrearsStudentsSnap = await db.collection("users").where("role", "==", "student").where("dailyArrears", ">", 0).get();

    const notificationsMap = new Map<string, { name: string, balance: number, arrears: number, parentUids: string[] }>();

    for (const doc of recordsSnap.docs) {
      const record = doc.data();
      notificationsMap.set(record.studentUid, {
        name: record.studentName || "your child",
        balance: record.balance || 0,
        arrears: 0,
        parentUids: []
      });
    }

    for (const [studentUid, info] of notificationsMap) {
      let parentUids = info.parentUids;
      if (parentUids.length === 0) {
        const studentDoc = await db.collection("users").doc(studentUid).get();
        const studentData = studentDoc.data();
        parentUids = studentData?.parentUids || [];
        info.arrears = studentData?.dailyArrears || 0;
      }

      if (parentUids.length === 0) continue;

      const tokens: string[] = [];
      for (const pUid of parentUids) {
        const parentDoc = await db.collection("users").doc(pUid).get();
        if (parentDoc.exists && parentDoc.data()?.fcmToken) {
          tokens.push(parentDoc.data()?.fcmToken);
        }
      }

      if (tokens.length > 0) {
        const totalDebt = info.balance; // Only Tuition/Fees
        const serviceDebt = info.arrears; // Only Feeding/Bus

        let body = `Gentle reminder: ${info.name} has outstanding fees.`;

        if (totalDebt > 0 && serviceDebt > 0) {
          body = `Gentle reminder: ${info.name} has a tuition balance of ₵${totalDebt.toFixed(2)} and daily service arrears of ₵${serviceDebt.toFixed(2)}.`;
        } else if (totalDebt > 0) {
          body = `Gentle reminder: ${info.name} has an outstanding tuition balance of ₵${totalDebt.toFixed(2)}.`;
        } else if (serviceDebt > 0) {
          body = `Gentle reminder: ${info.name} has daily service arrears (Feeding/Bus) of ₵${serviceDebt.toFixed(2)}.`;
        } else {
          continue; // Nothing to remind about
        }

        await admin.messaging().sendEachForMulticast({
          notification: { title: "Fee Reminder 🔔", body: body },
          data: { type: "fee_reminder", studentUid },
          tokens: tokens,
        });
      }
    }
  } catch (error) {
    console.error("Error in sendFeeReminders function:", error);
  }
});

/**
 * Deletes an expenditure entry and logs the action for audit.
 * KEEPING THIS for secure audit trail.
 */
export const deleteExpenditure = onCall({ invoker: "public" }, async (req) => {
  const auth = req.auth;
  if (!auth) throw new HttpsError("unauthenticated", "Auth required.");

  const { expenditureId } = req.data || {};
  if (!expenditureId) throw new HttpsError("invalid-argument", "Missing expenditureId.");

  const db = admin.firestore();
  const callerDoc = await db.collection("users").doc(auth.uid).get();
  const callerData = callerDoc.data();

  const isSuperAdmin = [
    "proprietor",
    "proprietress",
    "manager",
    "headmaster",
    "headmistress",
    "administrator",
    "director",
    "accountant",
    "bursar",
    "admin",
    "super admin",
    "superadmin",
  ].includes(callerData?.adminRole?.toLowerCase() || "");
  const canDelete = isSuperAdmin || callerData?.permissions?.["expenditure"] === "full";

  if (!canDelete) throw new HttpsError("permission-denied", "Unauthorized.");

  try {
    const expRef = db.collection("expenditures").doc(expenditureId);
    const expDoc = await expRef.get();
    if (!expDoc.exists) throw new HttpsError("not-found", "Not found.");

    const expData = expDoc.data();
    await expRef.delete();

    await db.collection("auditLogs").add({
      action: "DELETE_EXPENDITURE",
      performedBy: auth.uid,
      details: { item: expData?.item, amount: expData?.amount },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { status: 200, message: "Success" };
  } catch (error: any) {
    throw new HttpsError("internal", error.message);
  }
});

/**
 * Daily Arrears Task: Process students who missed payment for services.
 * KEEPING THIS as it runs at 10 PM and modifies financial data across the entire student body.
 */
export const processDailyArrears = onSchedule("0 22 * * *", async (event) => {
  const db = admin.firestore();
  const today = new Date().toISOString().split("T")[0];

  try {
    const configSnap = await db.doc("school_settings/academic_config").get();
    const config = configSnap.data();
    if (!config) return;

    const studentsSnap = await db.collection("users").where("role", "==", "student").where("status", "==", "active").get();
    const paymentsSnap = await db.collection("feePayments").where("date", "==", today).get();

    const paidFeedingUids = new Set();
    const paidBusUids = new Set();
    const paidExtraUids = new Set();

    paymentsSnap.forEach((doc) => {
      const data = doc.data();
      if (data.type === "feeding") paidFeedingUids.add(data.studentUid);
      if (data.type === "bus") paidBusUids.add(data.studentUid);
      if (data.type === "extra") paidExtraUids.add(data.studentUid);
    });

    const batch = db.batch();
    let count = 0;

    for (const studentDoc of studentsSnap.docs) {
      const student = studentDoc.data();
      const uid = studentDoc.id;

      let added = 0;
      if (student.isFeeding && !paidFeedingUids.has(uid)) added += config.dailyFeedingFee || 0;
      if (student.takesBus && !paidBusUids.has(uid)) added += config.dailyBusFee || 0;
      if (student.isExtraClasses && !paidExtraUids.has(uid)) added += config.dailyExtraClassesFee || 0;

      if (added > 0) {
        batch.update(studentDoc.ref, {
          dailyArrears: admin.firestore.FieldValue.increment(added),
          walletBalance: admin.firestore.FieldValue.increment(added)
        });

        count++;
      }
    }

    if (count > 0) await batch.commit();
  } catch (error) {
    console.error("Error in processDailyArrears:", error);
  }
});
