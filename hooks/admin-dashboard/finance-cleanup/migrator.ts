import { serverTimestamp, doc } from "firebase/firestore";
import { db } from "../../../firebaseConfig";

export const migrateStudentIdentity = async (
  recordsSnap: any,
  paymentsSnap: any,
  dailySnap: any,
  resolveUid: (uid: any, name?: string, docId?: string) => string | null,
  acadConfig: { academicYear: string; currentTerm: string },
  recordUpdates: Map<string, any>,
  paymentUpdates: Map<string, any>,
  commitBatch: () => Promise<void>,
  currentBatch: {
    update: (ref: any, data: any) => void;
    set: (ref: any, data: any) => void;
    delete: (ref: any) => void;
  },
  getOpCount: () => number,
  incrementOpCount: (n: number) => void
) => {
  let orphanedRecordsCount = 0;
  let fixedRecordsCount = 0;
  let orphanedPaymentsCount = 0;
  let dailyFinancialsFixedCount = 0;

  // 1. Metadata Cleanup Phase (studentFeeRecords)
  recordsSnap.docs.forEach((d: any) => {
    const data = d.data();
    const id = d.id;
    const currentUid = data.studentUid || id.split("_")[0];
    const resolvedUid = resolveUid(currentUid, data.studentName, id);

    if (
      !data.academicYear ||
      !data.term ||
      !data.studentUid ||
      (resolvedUid && resolvedUid !== data.studentUid)
    ) {
      orphanedRecordsCount++;
      const parts = id.split("_");
      if (parts.length >= 3) {
        const academicYearStr = parts[1].replace(/-/g, "/");
        const termStr = parts[2];
        if (
          resolvedUid &&
          academicYearStr.includes("/") &&
          termStr.toLowerCase().includes("term")
        ) {
          recordUpdates.set(id, {
            academicYear: academicYearStr,
            term: termStr,
            studentUid: resolvedUid,
            lastUpdated: serverTimestamp(),
          });
          fixedRecordsCount++;
        }
      } else if (resolvedUid) {
        recordUpdates.set(id, {
          studentUid: resolvedUid,
          lastUpdated: serverTimestamp(),
        });
        fixedRecordsCount++;
      }
    }
  });

  // 2. Payment Integrity Phase
  paymentsSnap.docs.forEach((d: any) => {
    const data = d.data();
    const resolvedUid = resolveUid(
      data.studentUid || data.studentID || data.studentId,
      data.studentName || data.receivedFrom || data.paidBy
    );
    if (
      resolvedUid &&
      resolvedUid !== (data.studentUid || data.studentID || data.studentId)
    ) {
      paymentUpdates.set(d.id, {
        studentUid: resolvedUid,
        lastUpdated: serverTimestamp(),
      });
    }
    if (!resolvedUid) orphanedPaymentsCount++;
  });

  // 3. Daily Financials Healing
  const dailyMigrated = new Set<string>();
  for (const d of dailySnap.docs) {
    const data = d.data();
    const currentUid = data.studentUid || d.id.split("_")[0];
    const resolvedUid = resolveUid(currentUid, data.studentName, d.id);

    if (resolvedUid && resolvedUid !== currentUid) {
      const dateStr = data.date || d.id.split("_")[1];
      if (dateStr) {
        const newDocId = `${resolvedUid}_${dateStr}`;
        if (!dailyMigrated.has(newDocId)) {
          if (getOpCount() >= 450) await commitBatch();
          currentBatch.set(doc(db, "dailyFinancials", newDocId), {
            ...data,
            studentUid: resolvedUid,
            migratedFrom: d.id,
            lastUpdated: serverTimestamp(),
          });
          currentBatch.delete(d.ref);
          dailyFinancialsFixedCount++;
          dailyMigrated.add(newDocId);
          incrementOpCount(2);
        }
      }
    }

    if (!data.academicYear || !data.term) {
      const academicYear = data.academicYear || acadConfig.academicYear;
      const term = data.term || acadConfig.currentTerm;
      if (academicYear && term) {
        const currentId = dailyMigrated.has(
          `${resolvedUid || currentUid}_${data.date}`
        )
          ? `${resolvedUid || currentUid}_${data.date}`
          : d.id;
        currentBatch.update(doc(db, "dailyFinancials", currentId), {
          academicYear,
          term,
          lastUpdated: serverTimestamp(),
        });
        dailyFinancialsFixedCount++;
        incrementOpCount(1);
        if (getOpCount() >= 450) await commitBatch();
      }
    }
  }

  return {
    orphanedRecordsCount,
    fixedRecordsCount,
    orphanedPaymentsCount,
    dailyFinancialsFixedCount,
  };
};
