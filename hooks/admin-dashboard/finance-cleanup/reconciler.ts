import { serverTimestamp } from "firebase/firestore";
import { StudentRecord, StudentPayment } from "./types";
import {
  isolatedKeys,
  normalizeCategory,
  getTermIndex,
  isPaymentEntry,
  waterfallOrder,
} from "./utils";

export const reconcileStudentBalances = (
  uid: string,
  studentRecords: StudentRecord[],
  studentPayments: StudentPayment[],
  recordUpdates: Map<string, any>,
  userUpdates: Map<string, any>,
  fixedRecordsCount: number
) => {
  // 1. Filter out non-payment entries from actual payment sums
  const actualPayments = studentPayments.filter(isPaymentEntry);
  const chargeEntries = studentPayments.filter(p => !isPaymentEntry(p));

  // 2. Sort records chronologically
  const sortedRecords = [...studentRecords].sort((a, b) => {
    const ay = a.data.academicYear || "";
    const by = b.data.academicYear || "";
    if (ay !== by) return ay.localeCompare(by);
    return getTermIndex(a.data.term || "") - getTermIndex(b.data.term || "");
  });

  // 3. Group payments by Year/Term
  const paymentsByTerm: Record<string, StudentPayment[]> = {};
  const unallocatedPayments: StudentPayment[] = [];

  actualPayments.forEach((p) => {
    const ay = p.academicYear;
    const term = p.term;
    if (ay && term) {
      const key = `${ay}_${term}`;
      if (!paymentsByTerm[key]) paymentsByTerm[key] = [];
      paymentsByTerm[key].push(p);
    } else {
      unallocatedPayments.push(p);
    }
  });

  // 4. Group charges by Year/Term to ensure they are reflected in Bill fields
  const chargesByTerm: Record<string, StudentPayment[]> = {};
  chargeEntries.forEach(c => {
    const key = `${c.academicYear}_${c.term}`;
    if (!chargesByTerm[key]) chargesByTerm[key] = [];
    chargesByTerm[key].push(c);
  });

  // 5. Initialize pools for unallocated money (money not tied to a specific term)
  let unallocatedTuition = unallocatedPayments
    .filter(p => !isolatedKeys.includes(p._category || normalizeCategory(p)))
    .reduce((sum, p) => sum + Number(p.amount ?? p.amountPaid ?? p.value ?? 0), 0);

  const unallocatedCategory: Record<string, number> = {};
  isolatedKeys.forEach(k => {
    unallocatedCategory[k] = unallocatedPayments
      .filter(p => (p._category || normalizeCategory(p)) === k)
      .reduce((sum, p) => sum + Number(p.amount ?? p.amountPaid ?? p.value ?? 0), 0);
  });

  // 6. Track cumulative state
  let cumulativeTuitionBill = 0;
  let cumulativeTuitionPaid = 0;

  const cumulativeCategoryBill: Record<string, number> = {};
  const cumulativeCategoryPaid: Record<string, number> = {};
  isolatedKeys.forEach(k => {
    cumulativeCategoryBill[k] = 0;
    cumulativeCategoryPaid[k] = 0;
  });

  let reconciledCount = 0;
  let lastFinalBalance = 0;

  if (sortedRecords.length === 0) {
    const totalPaidAll = actualPayments.reduce((sum, p) => sum + Number(p.amount ?? p.amountPaid ?? p.value ?? 0), 0);
    const totalChargesAll = chargeEntries.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
    userUpdates.set(uid, {
      walletBalance: totalChargesAll - totalPaidAll,
      financeLastReconciled: serverTimestamp(),
    });
    return 0;
  }

  // 7. Iterate through terms
  for (const record of sortedRecords) {
    const data = record.data;
    const ay = data.academicYear;
    const term = data.term;
    const key = `${ay}_${term}`;
    const termSpecificPayments = paymentsByTerm[key] || [];
    const termSpecificCharges = chargesByTerm[key] || [];

    const safeNum = (val: any) => {
      const n = Number(val);
      return isNaN(n) ? 0 : n;
    };

    const updates: any = {
      lastUpdated: serverTimestamp(),
      payments: studentPayments, // Keep the full history including charges
      discount: safeNum(data.discount),
    };

    // --- TUITION ---
    // Bill from record might be manually adjusted, but also check for bulk tuition charges
    const extraTuitionCharges = termSpecificCharges
       .filter(c => !isolatedKeys.includes(c._category || normalizeCategory(c)))
       .reduce((sum, c) => sum + Number(c.amount ?? 0), 0);

    const termGrossTuition = safeNum(data.termBill);
    const termNetTuition = termGrossTuition - safeNum(data.discount);

    // Arrears = What was owed before this term - What was paid before this term
    const currentTuitionArrears = Math.max(0, cumulativeTuitionBill - cumulativeTuitionPaid);

    // Apply unallocated money to existing tuition arrears
    if (currentTuitionArrears > 0 && unallocatedTuition > 0) {
      const amountToApply = Math.min(currentTuitionArrears, unallocatedTuition);
      unallocatedTuition -= amountToApply;
      cumulativeTuitionPaid += amountToApply;
    }

    // Now process this term's bill
    cumulativeTuitionBill += termNetTuition;

    // Direct payments for this term
    const termTuitionPayment = termSpecificPayments
      .filter(p => !isolatedKeys.includes(p._category || normalizeCategory(p)))
      .reduce((sum, p) => sum + Number(p.amount ?? p.amountPaid ?? p.value ?? 0), 0);

    cumulativeTuitionPaid += termTuitionPayment;

    // WATERFALL: If we have excess tuition payment, move it to unallocatedTuition pool to settle categories
    const tuitionExcess = Math.max(0, cumulativeTuitionPaid - cumulativeTuitionBill);
    if (tuitionExcess > 0) {
      unallocatedTuition += tuitionExcess;
      cumulativeTuitionPaid -= tuitionExcess;
    }

    updates.amountPaid = termTuitionPayment;
    updates.termBill = termGrossTuition;

    // --- CATEGORIES ---
    let totalTermCategoryBill = 0;
    let currentTotalCategoryArrears = 0;

    // Sort keys to respect waterfall order
    waterfallOrder.forEach(k => {
      // Sum of charges in feePayments for this category/term
      const totalChargesInTerm = termSpecificCharges
        .filter(c => (c._category || normalizeCategory(c)) === k)
        .reduce((sum, c) => sum + Number(c.amount ?? 0), 0);

      // Use the higher of the record's bill or the sum of charges found
      const termBill = Math.max(safeNum(data[`${k}Bill`]), totalChargesInTerm);
      totalTermCategoryBill += termBill;

      const catArrears = Math.max(0, cumulativeCategoryBill[k] - cumulativeCategoryPaid[k]);

      // Apply unallocated category-specific money first
      if (catArrears > 0 && unallocatedCategory[k] > 0) {
        const amountToApply = Math.min(catArrears, unallocatedCategory[k]);
        unallocatedCategory[k] -= amountToApply;
        cumulativeCategoryPaid[k] += amountToApply;
      }

      // Apply unallocated tuition/general money to category arrears
      if (catArrears > 0 && unallocatedTuition > 0) {
        const amountToApply = Math.min(catArrears, unallocatedTuition);
        unallocatedTuition -= amountToApply;
        cumulativeCategoryPaid[k] += amountToApply;
      }

      cumulativeCategoryBill[k] += termBill;

      const termCatPayment = termSpecificPayments
        .filter(p => (p._category || normalizeCategory(p)) === k)
        .reduce((sum, p) => sum + Number(p.amount ?? p.amountPaid ?? p.value ?? 0), 0);

      cumulativeCategoryPaid[k] += termCatPayment;

      // WATERFALL: If we have excess category payment, move it to general pool
      const catExcess = Math.max(0, cumulativeCategoryPaid[k] - cumulativeCategoryBill[k]);
      if (catExcess > 0) {
        unallocatedTuition += catExcess;
        cumulativeCategoryPaid[k] -= catExcess;
      }

      // Final attempt to settle this term's category bill with remaining general pool
      const remainingCatDebt = Math.max(0, cumulativeCategoryBill[k] - cumulativeCategoryPaid[k]);
      if (remainingCatDebt > 0 && unallocatedTuition > 0) {
        const spillover = Math.min(remainingCatDebt, unallocatedTuition);
        cumulativeCategoryPaid[k] += spillover;
        unallocatedTuition -= spillover;
      }

      updates[`${k}Paid`] = termCatPayment; // Physical term payment
      updates[`${k}Bill`] = termBill;
      updates[`${k}Balance`] = cumulativeCategoryBill[k] - cumulativeCategoryPaid[k] - unallocatedCategory[k];

      currentTotalCategoryArrears += Math.max(0, (cumulativeCategoryBill[k] - termBill) - (cumulativeCategoryPaid[k] - termCatPayment));
    });

    // --- SUMMARY ---
    const recordTuitionArrears = Math.max(0, (cumulativeTuitionBill - termNetTuition) - (cumulativeTuitionPaid - termTuitionPayment));
    const totalRecordArrears = recordTuitionArrears + currentTotalCategoryArrears;

    const totalPaymentsAllTime = actualPayments.reduce((s, p) => s + Number(p.amount ?? p.amountPaid ?? p.value ?? 0), 0);
    const totalBillsAllTime = cumulativeTuitionBill + Object.values(cumulativeCategoryBill).reduce((a, b) => a + b, 0);

    const recordBalance = totalBillsAllTime - totalPaymentsAllTime;

    updates.arrears = totalRecordArrears;
    updates.balance = recordBalance;
    updates.totalPayable = totalRecordArrears + termGrossTuition + totalTermCategoryBill;

    // Check if update is needed
    const needsUpdate =
      isNaN(Number(data.balance)) ||
      Math.abs(safeNum(data.amountPaid) - updates.amountPaid) > 0.01 ||
      Math.abs(safeNum(data.balance) - updates.balance) > 0.01 ||
      Math.abs(safeNum(data.arrears) - updates.arrears) > 0.01 ||
      (fixedRecordsCount > 0 && !!recordUpdates.get(record.id));

    if (needsUpdate) {
      recordUpdates.set(record.id, { ...(recordUpdates.get(record.id) || {}), ...updates });
      reconciledCount++;
    }

    lastFinalBalance = recordBalance;
  }

  // 8. Update User Profile
  const finalUserUpdates: any = {
    walletBalance: lastFinalBalance,
    financeLastReconciled: serverTimestamp(),
  };

  // Sync category balances to user profile
  waterfallOrder.forEach((k) => {
    finalUserUpdates[`${k}Balance`] =
      cumulativeCategoryBill[k] -
      cumulativeCategoryPaid[k] -
      unallocatedCategory[k];
    finalUserUpdates[`${k}Paid`] = cumulativeCategoryPaid[k] + unallocatedCategory[k];
    finalUserUpdates[`${k}Bill`] = cumulativeCategoryBill[k];
  });

  userUpdates.set(uid, finalUserUpdates);

  return reconciledCount;
};
