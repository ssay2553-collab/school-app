import { collection, query, where, getDocs, getDoc, doc } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { sendNotification } from "./notificationService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import moment from "moment";

const FEE_REMINDER_MONTH_KEY = "LAST_MONTHLY_FEE_REMINDER_MONTH";

export interface FeeReminderResult {
  sentCount: number;
  message: string;
}

/**
 * Sends fee debt reminders to parents for all students with outstanding balances.
 * Operates client-side using Firestore notifications without Cloud Functions.
 */
export async function broadcastFeeReminders(senderUid?: string, senderName?: string): Promise<FeeReminderResult> {
  let count = 0;
  try {
    // 1. Query studentFeeRecords where balance > 0
    const recordsSnap = await getDocs(
      query(collection(db, "studentFeeRecords"), where("balance", ">", 0))
    );

    // Map student ID to fee debt info
    const debtMap = new Map<string, { studentName: string; balance: number; arrears: number; parentUids: string[] }>();

    recordsSnap.docs.forEach((dDoc) => {
      const record = dDoc.data();
      const studentUid = record.studentUid || dDoc.id;
      debtMap.set(studentUid, {
        studentName: record.studentName || "your child",
        balance: record.balance || 0,
        arrears: 0,
        parentUids: record.parentUids || [],
      });
    });

    // 2. Also query students in users collection who have dailyArrears or balance
    const studentsSnap = await getDocs(
      query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("status", "in", ["active", "pending_activation"])
      )
    );

    studentsSnap.docs.forEach((sDoc) => {
      const sData = sDoc.data();
      const uid = sDoc.id;
      const arrears = sData.dailyArrears || 0;
      const tuitionBalance = sData.balance || 0;
      const parentUids = sData.parentUids || [];
      const sName = `${sData.profile?.firstName || ""} ${sData.profile?.lastName || ""}`.trim() || "your child";

      if (debtMap.has(uid)) {
        const existing = debtMap.get(uid)!;
        existing.arrears = arrears;
        if (parentUids.length > 0) existing.parentUids = parentUids;
        if (sName) existing.studentName = sName;
      } else if (tuitionBalance > 0 || arrears > 0) {
        debtMap.set(uid, {
          studentName: sName,
          balance: tuitionBalance,
          arrears: arrears,
          parentUids: parentUids,
        });
      }
    });

    // 3. Send notifications to parents
    for (const [studentUid, info] of debtMap.entries()) {
      let parentUids = info.parentUids;

      if (!parentUids || parentUids.length === 0) {
        const studentDoc = await getDoc(doc(db, "users", studentUid));
        if (studentDoc.exists()) {
          parentUids = studentDoc.data()?.parentUids || [];
        }
      }

      if (!parentUids || parentUids.length === 0) continue;

      const totalDebt = info.balance;
      const serviceDebt = info.arrears;

      let body = "";
      if (totalDebt > 0 && serviceDebt > 0) {
        body = `Gentle reminder: ${info.studentName} has an outstanding tuition balance of ₵${totalDebt.toFixed(2)} and daily service arrears of ₵${serviceDebt.toFixed(2)}.`;
      } else if (totalDebt > 0) {
        body = `Gentle reminder: ${info.studentName} has an outstanding tuition balance of ₵${totalDebt.toFixed(2)}.`;
      } else if (serviceDebt > 0) {
        body = `Gentle reminder: ${info.studentName} has daily service arrears (Feeding/Bus) of ₵${serviceDebt.toFixed(2)}.`;
      } else {
        continue;
      }

      for (const pUid of parentUids) {
        await sendNotification({
          recipientId: pUid,
          senderId: senderUid || "system",
          senderName: senderName || "School Financial Office",
          type: "payment",
          title: "Fee Arrears Notice 💳",
          body,
          data: { type: "fee_reminder", studentUid, totalDebt, serviceDebt },
        });
        count++;
      }
    }

    return { sentCount: count, message: `Successfully sent fee debt reminders to ${count} parent account(s).` };
  } catch (err: any) {
    console.error("Error broadcasting fee reminders:", err);
    throw err;
  }
}

/**
 * Automatic Monthly Check: Runs once per month per client session.
 */
export async function checkAndSendMonthlyFeeReminders(userRole?: string) {
  try {
    const currentMonth = moment().format("YYYY-MM");
    const lastSentMonth = await AsyncStorage.getItem(FEE_REMINDER_MONTH_KEY);

    if (lastSentMonth === currentMonth) {
      return; // Already dispatched for this month
    }

    if (userRole === "admin" || userRole === "staff" || userRole === "parent") {
      console.log(`[Fee Reminder] Executing monthly fee debt check for ${currentMonth}...`);
      await broadcastFeeReminders("system", "Monthly Accounts Reminder");
      await AsyncStorage.setItem(FEE_REMINDER_MONTH_KEY, currentMonth);
    }
  } catch (e) {
    console.error("Failed automated monthly fee debt check:", e);
  }
}
