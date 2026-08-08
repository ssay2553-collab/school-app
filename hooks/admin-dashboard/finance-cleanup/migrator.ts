import { serverTimestamp, doc, getDoc } from "firebase/firestore";
import { db } from "../../../firebaseConfig";
import { mergeFinancialData } from "./utils";

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
    set: (ref: any, data: any, options?: any) => void;
    delete: (ref: any) => void;
  },
  getOpCount: () => number,
  incrementOpCount: (n: number) => void
) => {
  let orphanedRecordsCount = 0;
  let fixedRecordsCount = 0;
  let orphanedPaymentsCount = 0;
  let dailyFinancialsFixedCount = 0;

  // Track the final merged state of every record key (UID_AY_TERM)
  const consolidatedRecords = new Map<string, any>();
  const recordsToDelete = new Set<any>();

  // 1. PHASE 1: Consolidation and Strongest-Value Resolution
  for (const d of recordsSnap.docs) {
    const data = d.data();
    const id = d.id;
    const parts = id.split("_");
    const currentUidInId = parts[0];
    const resolvedUid = resolveUid(data.studentUid || currentUidInId, data.studentName, id);

    if (!resolvedUid) {
      orphanedRecordsCount++;
      continue;
    }

    const academicYear = data.academicYear || (parts.length >= 2 ? parts[1].replace(/-/g, "/") : null);
    const term = data.term || (parts.length >= 3 ? parts[2] : null);

    if (academicYear && term) {
      const cleanYear = academicYear.replace(/\//g, "-");
      const cleanTerm = term.replace(/\s/g, "");
      const newDocId = `${resolvedUid}_${cleanYear}_${cleanTerm}`;

      // If we already have a version of this record in our consolidation map, merge them
      const existing = consolidatedRecords.get(newDocId);
      if (existing) {
        consolidatedRecords.set(newDocId, mergeFinancialData(existing, data));
      } else {
        consolidatedRecords.set(newDocId, {
          ...data,
          studentUid: resolvedUid,
          academicYear,
          term
        });
      }

      // If the current document ID isn't the canonical ID or uses the wrong UID, mark it for deletion
      if (id !== newDocId) {
        recordsToDelete.add(d.ref);
      }
    }
  }

  // 2. PHASE 2: Execution (Write Consolidated, then Delete)
  const writtenKeys = new Set<string>();
  for (const [newId, mergedData] of consolidatedRecords.entries()) {
    if (getOpCount() >= 450) await commitBatch();
    currentBatch.set(doc(db, "studentFeeRecords", newId), {
      ...mergedData,
      lastUpdated: serverTimestamp(),
    }, { merge: true });
    incrementOpCount(1);
    writtenKeys.add(newId);
    fixedRecordsCount++;
  }

  // PHASE 3: VERIFICATION - Only delete if a canonical record exists
  for (const ref of recordsToDelete) {
    const id = ref.id;
    const parts = id.split("_");
    const resolvedUid = resolveUid(parts[0], undefined, id);

    if (resolvedUid) {
      const year = (parts.length >= 2 ? parts[1].replace(/\//g, "-") : "");
      const term = (parts.length >= 3 ? parts[2].replace(/\s/g, "") : "");
      const canonicalId = `${resolvedUid}_${year}_${term}`;

      // Check if we just wrote it in this batch or if it already exists in the map
      if (writtenKeys.has(canonicalId) || consolidatedRecords.has(canonicalId)) {
        if (getOpCount() >= 450) await commitBatch();
        currentBatch.delete(ref);
        incrementOpCount(1);
      }
    }
  }

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
