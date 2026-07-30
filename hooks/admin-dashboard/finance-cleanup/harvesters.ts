import { StudentPayment, StudentRecord } from "./types";
import { normalizeCategory, isolatedKeys } from "./utils";

export const harvestStudentData = (
  recordsSnap: any,
  paymentsSnap: any,
  usersSnap: any,
  recordUpdates: Map<string, any>,
  paymentUpdates: Map<string, any>,
  resolveUid: (uid: any, name?: string, docId?: string) => string | null,
  resolvePaymentUid: (p: any, fallbackUid?: string, recordDocId?: string) => string | null
) => {
  const recordsByStudent: Record<string, StudentRecord[]> = {};
  recordsSnap.docs.forEach((d: any) => {
    const data = d.data();
    const fixed = recordUpdates.get(d.id);
    const uid = fixed?.studentUid || resolveUid(data.studentUid, data.studentName, d.id);
    if (uid) {
      if (!recordsByStudent[uid]) recordsByStudent[uid] = [];
      recordsByStudent[uid].push({ id: d.id, ref: d.ref, data: { ...data, ...fixed } });
    }
  });

  const paymentsByStudent: Record<string, StudentPayment[]> = {};
  const knownPaymentIdsByStudent: Record<string, Set<string>> = {};

  const addPayment = (uid: string, p: any, sourceId?: string) => {
    if (!uid || uid === "undefined") return;
    if (!paymentsByStudent[uid]) paymentsByStudent[uid] = [];
    if (!knownPaymentIdsByStudent[uid]) knownPaymentIdsByStudent[uid] = new Set();

    // Prioritize receiptNo or explicit ID for deduplication
    const pId = String(
      p.receiptNo ||
        p.id ||
        sourceId ||
        `legacy-${uid}-${p.amount ?? p.amountPaid ?? p.value ?? ""}-${p.date || p.createdAt || ""}-${paymentsByStudent[uid].length}`
    );

    if (!knownPaymentIdsByStudent[uid].has(pId)) {
      const cloned = { ...p, id: pId, _category: p._category || normalizeCategory(p) };
      paymentsByStudent[uid].push(cloned);
      knownPaymentIdsByStudent[uid].add(pId);
    }
  };

  // 1. Harvest from feePayments collection
  paymentsSnap.docs.forEach((d: any) => {
    const data = d.data();
    const fixed = paymentUpdates.get(d.id);
    const merged = { ...data, ...fixed };
    const uid = resolvePaymentUid(merged, undefined, d.id);
    if (uid) addPayment(uid, merged, d.id);
  });

  // 2. Harvest from embedded payments in studentFeeRecords
  recordsSnap.docs.forEach((d: any) => {
    const data = d.data();
    const fixed = recordUpdates.get(d.id);
    const merged = { ...data, ...fixed };
    const recordUid = merged.studentUid || resolveUid(merged.studentUid, merged.studentName, d.id);
    if (!recordUid) return;

    if (Array.isArray(merged.payments)) {
      merged.payments.forEach((p: any) => {
        const pUid = resolvePaymentUid(p, recordUid, d.id);
        if (pUid) {
          // If embedded payment lacks year/term, inherit from parent record
          const pWithContext = {
            ...p,
            academicYear: p.academicYear || merged.academicYear,
            term: p.term || merged.term,
            studentFeeRecordId: d.id
          };
          addPayment(pUid, pWithContext);
        }
      });
    }
  });

  // 3. Harvest from legacy user payments
  usersSnap.docs.forEach((d: any) => {
    const data = d.data();
    if (Array.isArray(data.payments)) {
      data.payments.forEach((p: any) => {
        const pUid = resolvePaymentUid(p, d.id);
        if (pUid) addPayment(pUid, p);
      });
    }
  });

  // 4. SMART LEGACY MIGRATION:
  // Compare total reported amountPaid vs total explicit payments to avoid double counting.
  Object.keys(recordsByStudent).forEach(uid => {
    const studentRecords = recordsByStudent[uid];
    const studentPayments = paymentsByStudent[uid] || [];

    const getTuitionTotal = (payments: any[]) => payments
      .filter(p => !isolatedKeys.includes(p._category || normalizeCategory(p)))
      .reduce((sum, p) => sum + Number(p.amount ?? p.amountPaid ?? p.value ?? 0), 0);

    const totalExplicitTuition = getTuitionTotal(studentPayments);
    const totalReportedTuition = studentRecords.reduce((sum, r) => sum + Number(r.data.amountPaid || 0), 0);

    // Only add legacy payments if there's a deficit in explicit records
    if (totalReportedTuition > totalExplicitTuition + 0.01) {
      let diff = totalReportedTuition - totalExplicitTuition;

      // Sort records by academic year and term to attribute legacy payments chronologically
      const sortedRecords = [...studentRecords].sort((a, b) => {
        const ayA = a.data.academicYear || "";
        const ayB = b.data.academicYear || "";
        if (ayA !== ayB) return ayA.localeCompare(ayB);
        const getTermIdx = (t: string) => (t || "").toLowerCase().includes("1") ? 0 : (t || "").toLowerCase().includes("2") ? 1 : 2;
        return getTermIdx(a.data.term) - getTermIdx(b.data.term);
      });

      for (const record of sortedRecords) {
        if (diff <= 0.01) break;
        const recordReported = Number(record.data.amountPaid || 0);
        const recordExplicit = (record.data.payments || [])
          .filter((p: any) => !isolatedKeys.includes(normalizeCategory(p)))
          .reduce((sum: number, p: any) => sum + Number(p.amount || p.amountPaid || 0), 0);

        if (recordReported > recordExplicit + 0.01) {
          const amountToAdd = Math.min(diff, recordReported - recordExplicit);
          addPayment(uid, {
            amount: amountToAdd,
            type: "tuition_payment",
            date: record.data.date || record.data.createdAt || new Date().toISOString(),
            method: "Legacy Migration",
            receiptNo: `LEGACY-TUI-${record.id}`,
            note: "Recovered from legacy amountPaid field",
            academicYear: record.data.academicYear,
            term: record.data.term
          });
          diff -= amountToAdd;
        }
      }
    }

    // Repeat for category payments (PTA, Maintenance, etc.)
    isolatedKeys.forEach(key => {
      const getCategoryTotal = (payments: any[]) => payments
        .filter(p => (p._category || normalizeCategory(p)) === key)
        .reduce((sum, p) => sum + Number(p.amount ?? p.amountPaid ?? p.value ?? 0), 0);

      const totalExplicitCat = getCategoryTotal(studentPayments);
      const totalReportedCat = studentRecords.reduce((sum, r) => sum + Number(r.data[`${key}Paid`] || 0), 0);

      if (totalReportedCat > totalExplicitCat + 0.01) {
        let diff = totalReportedCat - totalExplicitCat;
        for (const record of studentRecords) {
          if (diff <= 0.01) break;
          const recordReported = Number(record.data[`${key}Paid`] || 0);
          const recordExplicit = (record.data.payments || [])
            .filter((p: any) => normalizeCategory(p) === key)
            .reduce((sum: number, p: any) => sum + Number(p.amount || p.amountPaid || 0), 0);

          if (recordReported > recordExplicit + 0.01) {
            const amountToAdd = Math.min(diff, recordReported - recordExplicit);
            addPayment(uid, {
              amount: amountToAdd,
              type: key,
              date: record.data.date || record.data.createdAt || new Date().toISOString(),
              method: "Legacy Migration",
              receiptNo: `LEGACY-${key.toUpperCase()}-${record.id}`,
              note: `Recovered from legacy ${key}Paid field`,
              academicYear: record.data.academicYear,
              term: record.data.term
            });
            diff -= amountToAdd;
          }
        }
      }
    });
  });

  return { recordsByStudent, paymentsByStudent };
};
