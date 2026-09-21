import { useCallback, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { useAcademicConfig } from "../useAcademicConfig";
import { CleanupReport } from "./finance-cleanup/types";
import { createResolvers } from "./finance-cleanup/resolvers";
import { reconcileStudentBalances } from "./finance-cleanup/reconciler";
import { harvestStudentData } from "./finance-cleanup/harvesters";

export const useFinanceCleanup = (showToast: (props: any) => void) => {
  const acadConfig = useAcademicConfig();
  const [cleaning, setCleaning] = useState(false);
  const [report, setReport] = useState<CleanupReport | null>(null);

  const runCleanup = useCallback(async (targetStudentId?: string) => {
    setCleaning(true);
    setReport(null);
    let currentBatch = writeBatch(db);
    let opCount = 0;

    const commitBatch = async () => {
      if (opCount > 0) {
        await currentBatch.commit();
        currentBatch = writeBatch(db);
        opCount = 0;
      }
    };

    try {
      console.log(targetStudentId ? `Starting financial data integrity scan for student: ${targetStudentId}` : "Starting financial data integrity scan...");

      let recordsSnap, paymentsSnap, usersSnap;
      let aliases: string[] = [];

      if (targetStudentId) {
        const userDoc = await getDoc(doc(db, "users", targetStudentId));
        if (!userDoc.exists()) throw new Error("Student not found");
        const userData = userDoc.data();
        aliases = [targetStudentId];
        if (userData?.migratedFrom) aliases.push(userData.migratedFrom);
        const sID = userData?.profile?.studentID || userData?.studentID || userData?.studentId;
        if (sID) aliases.push(String(sID));

        [recordsSnap, paymentsSnap, usersSnap] = await Promise.all([
          getDocs(query(collection(db, "studentFeeRecords"), where("studentUid", "in", aliases))),
          getDocs(query(collection(db, "feePayments"), where("studentUid", "in", aliases))),
          getDocs(query(collection(db, "users"), where("__name__", "in", aliases))),
        ]);
      } else {
        [recordsSnap, paymentsSnap, usersSnap] = await Promise.all([
          getDocs(collection(db, "studentFeeRecords")),
          getDocs(collection(db, "feePayments")),
          getDocs(query(collection(db, "users"), where("role", "==", "student"))),
        ]);
      }

      const validStudentIds = new Set(usersSnap.docs.map((d) => d.id));
      const studentNameMap = new Map<string, string>();
      const studentIDMap = new Map<string, string>();

      usersSnap.docs.forEach((d) => {
        const data = d.data();
        const firstName = (data.profile?.firstName || "").trim().toLowerCase();
        const lastName = (data.profile?.lastName || "").trim().toLowerCase();
        const fullName = `${firstName} ${lastName}`.trim();
        const fullNameReverse = `${lastName} ${firstName}`.trim();
        if (fullName) studentNameMap.set(fullName, d.id);
        if (fullNameReverse && fullNameReverse !== fullName)
          studentNameMap.set(fullNameReverse, d.id);
        const studentID = data.profile?.studentID || data.studentID || data.studentId;
        if (studentID) studentIDMap.set(String(studentID).trim().toLowerCase(), d.id);
      });

      const { resolveUid, resolvePaymentUid } = createResolvers(
        studentNameMap,
        studentIDMap,
        validStudentIds
      );

      const recordUpdates = new Map<string, any>();
      const paymentUpdates = new Map<string, any>();
      const userUpdates = new Map<string, any>();

      // 4. Data Harvesting
      const { recordsByStudent, paymentsByStudent } = harvestStudentData(
        recordsSnap,
        paymentsSnap,
        usersSnap,
        recordUpdates,
        paymentUpdates,
        resolveUid,
        resolvePaymentUid
      );

      // 5. Balance Reconciliation
      let reconciledBalancesCount = 0;
      let missingCodesFixed = 0;
      const allStudentUids = new Set([...Object.keys(recordsByStudent), ...Object.keys(paymentsByStudent)]);

      // Include students from usersSnap who might not have any records/payments yet
      usersSnap.docs.forEach(d => allStudentUids.add(d.id));

      for (const uid of allStudentUids) {
        // Ensure student has link codes
        const userDoc = usersSnap.docs.find(d => d.id === uid);
        if (userDoc) {
          const userData = userDoc.data();
          if (userData.role === 'student') {
            let needsUpdate = false;
            const existingUpdates = userUpdates.get(uid) || {};

            if (!userData.parentLinkCode) {
              existingUpdates.parentLinkCode = Math.random().toString(36).substring(2, 8).toUpperCase();
              needsUpdate = true;
            }

            if (userData.status === 'pending_activation' && !userData.signupCode) {
              existingUpdates.signupCode = Math.random().toString(36).substring(2, 8).toUpperCase();
              needsUpdate = true;
            }

            if (needsUpdate) {
              userUpdates.set(uid, existingUpdates);
              missingCodesFixed++;
            }
          }
        }

        reconciledBalancesCount += reconcileStudentBalances(
          uid,
          recordsByStudent[uid] || [],
          paymentsByStudent[uid] || [],
          recordUpdates,
          userUpdates,
          0 // fixedRecordsCount is now 0 as we don't do identity migration here
        );
      }

      // 6. Batch Commit
      for (const [id, updates] of recordUpdates.entries()) {
        currentBatch.update(doc(db, "studentFeeRecords", id), updates);
        opCount++;
        if (opCount >= 450) await commitBatch();
      }
      for (const [id, updates] of paymentUpdates.entries()) {
        currentBatch.update(doc(db, "feePayments", id), updates);
        opCount++;
        if (opCount >= 450) await commitBatch();
      }
      for (const [uid, updates] of userUpdates.entries()) {
        if (validStudentIds.has(uid)) {
          currentBatch.update(doc(db, "users", uid), updates);
          opCount++;
          if (opCount >= 450) await commitBatch();
        }
      }
      await commitBatch();

      setReport({
        orphanedRecords: 0,
        fixedRecords: recordUpdates.size,
        orphanedPayments: 0,
        deletedPayments: 0,
        reconciledBalances: reconciledBalancesCount,
        dailyFinancialsFixed: 0,
      });

      showToast({ message: `Cleanup complete. Reconciled ${reconciledBalancesCount} balances.`, type: "success" });
    } catch (error) {
      console.error("Cleanup error:", error);
      showToast({ message: "Cleanup failed: " + (error as Error).message, type: "error" });
    } finally {
      setCleaning(false);
    }
  }, [showToast, acadConfig]);

  return { cleaning, runCleanup, report };
};

