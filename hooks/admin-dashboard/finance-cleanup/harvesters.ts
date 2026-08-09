import { StudentPayment, StudentRecord } from "./types";
import { normalizeCategory, isolatedKeys, mergeFinancialData } from "./utils";

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

      const ay = (data.academicYear || fixed?.academicYear || "").replace(/\//g, "-");
      const term = (data.term || fixed?.term || "").replace(/\s/g, "");

      const existingIdx = recordsByStudent[uid].findIndex(r => {
        const rAy = (r.data.academicYear || "").replace(/\//g, "-");
        const rTerm = (r.data.term || "").replace(/\s/g, "");
        return rAy === ay && rTerm === term;
      });

      const entry = { id: d.id, ref: d.ref, data: { ...data, ...fixed } };

      if (existingIdx === -1) {
        recordsByStudent[uid].push(entry);
      } else {
        // Instead of picking one, MERGE the financial data from both records.
        // This ensures that if payments were recorded on both accounts, they are summed.
        recordsByStudent[uid][existingIdx].data = mergeFinancialData(
          recordsByStudent[uid][existingIdx].data,
          entry.data
        );
      }
    }
  });

  const paymentsByStudent: Record<string, StudentPayment[]> = {};
  const knownPaymentIdsByStudent: Record<string, Set<string>> = {};

  const addPayment = (uid: string, p: any, sourceId?: string) => {
    if (!uid || uid === "undefined") return;
    if (!paymentsByStudent[uid]) paymentsByStudent[uid] = [];
    if (!knownPaymentIdsByStudent[uid]) knownPaymentIdsByStudent[uid] = new Set();

    // Prioritize receiptNo or explicit ID for deduplication
    const pCategory = p._category || normalizeCategory(p);
    const pAmount = Number(p.amount ?? p.amountPaid ?? p.value ?? 0);

    // Normalize dates to prevent duplicates from different formats (Timestamp vs String)
    const getSafeDate = (dateVal: any) => {
      if (!dateVal) return "";
      if (typeof dateVal === 'string') return dateVal;
      if (dateVal && typeof dateVal.toDate === 'function') return dateVal.toDate().toISOString();
      if (dateVal && dateVal.seconds) return new Date(dateVal.seconds * 1000).toISOString();
      return String(dateVal);
    };
    const pDate = getSafeDate(p.date || p.createdAt);

    // Enhanced Deduplication check: receiptNo/id or (amount + date + category)
    const isDuplicate = paymentsByStudent[uid].some(existing => {
      if (p.receiptNo && existing.receiptNo === p.receiptNo) return true;
      if (p.id && existing.id === p.id) return true;

      const existingAmount = Number(existing.amount ?? existing.amountPaid ?? existing.value ?? 0);
      const existingDate = getSafeDate(existing.date || existing.createdAt);
      const existingCategory = existing._category || normalizeCategory(existing);

      return Math.abs(existingAmount - pAmount) < 0.01 &&
             existingDate === pDate &&
             existingCategory === pCategory;
    });

    if (!isDuplicate) {
      const pId = String(
        p.receiptNo ||
          p.id ||
          sourceId ||
          `legacy-${uid}-${pAmount}-${pDate}-${paymentsByStudent[uid].length}`
      );
      const cloned = { ...p, id: pId, _category: pCategory };
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
        // Skip legacy-migration payments created by previous runs of this tool.
        // This allows the harvester to re-calculate the gap accurately on every scan.
        if (p.receiptNo?.toString().startsWith("LEGACY-")) return;

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
