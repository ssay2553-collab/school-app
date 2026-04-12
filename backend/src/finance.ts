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
  const isSuperAdmin = ["proprietor", "headmaster", "ceo"].includes(
    callerData?.adminRole?.toLowerCase() || "",
  );
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
