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
  const safeNum = (val: any) => {
    const n = Number(val);
    return isNaN(n) ? 0 : n;
  };

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

  // 5. Initialize pools for unallocated money
  const detectedCategories = new Set<string>();
  studentPayments.forEach(p => {
    const cat = normalizeCategory(p);
    if (cat !== 'tuition' && !isolatedKeys.includes(cat) && cat !== 'other charges') {
      detectedCategories.add(cat);
    }
  });
  const dynamicCategories = Array.from(detectedCategories);
  const fullWaterfall = [...waterfallOrder, ...dynamicCategories];

  let unallocatedTuition = unallocatedPayments
    .filter(p => !fullWaterfall.includes(normalizeCategory(p)))
    .reduce((sum, p) => sum + Number(p.amount ?? p.amountPaid ?? p.value ?? 0), 0);

  const unallocatedCategoryPool: Record<string, number> = {};
  fullWaterfall.forEach(k => {
    unallocatedCategoryPool[k] = unallocatedPayments
      .filter(p => normalizeCategory(p) === k)
      .reduce((sum, p) => sum + Number(p.amount ?? p.amountPaid ?? p.value ?? 0), 0);
  });

  // 6. Track cumulative state
  let cumulativeTuitionBill = 0;
  let cumulativeTuitionPaid = 0;

  const cumulativeCategoryBillPool: Record<string, number> = {};
  const cumulativeCategoryPaidPool: Record<string, number> = {};
  fullWaterfall.forEach(k => {
    cumulativeCategoryBillPool[k] = 0;
    cumulativeCategoryPaidPool[k] = 0;
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

    const prevCumulativeTuitionPaid = cumulativeTuitionPaid;
    const prevCumulativeCategoryPaid: Record<string, number> = {};
    fullWaterfall.forEach(k => prevCumulativeCategoryPaid[k] = cumulativeCategoryPaidPool[k]);

    const updates: any = {
      lastUpdated: serverTimestamp(),
      payments: studentPayments, // Keep the full history including charges
      discount: safeNum(data.discount),
    };

    // --- TUITION ---
    // Bill from record might be manually adjusted, but also check for bulk tuition charges
    const extraTuitionCharges = termSpecificCharges
       .filter(c => normalizeCategory(c) === 'tuition')
       .reduce((sum, c) => sum + Number(c.amount ?? 0), 0);

    const termGrossTuition = Math.max(safeNum(data.termBill), extraTuitionCharges);
    const termNetTuition = termGrossTuition - safeNum(data.discount);

    // Arrears = What was owed before this term - What was paid before this term
    const recordTuitionArrears = Math.max(0, cumulativeTuitionBill - cumulativeTuitionPaid);

    // Now process this term's debt pool
    cumulativeTuitionBill += termNetTuition;

    // 1. Apply unallocated money to existing tuition debt (Arrears + Current Bill)
    let tuitionDebt = Math.max(0, cumulativeTuitionBill - cumulativeTuitionPaid);
    if (tuitionDebt > 0 && unallocatedTuition > 0) {
      const amountToApply = Math.min(tuitionDebt, unallocatedTuition);
      unallocatedTuition -= amountToApply;
      cumulativeTuitionPaid += amountToApply;
    }

    // 2. Add direct payments for this term
    const termTuitionPayment = termSpecificPayments
      .filter(p => !isolatedKeys.includes(p._category || normalizeCategory(p)))
      .reduce((sum, p) => sum + Number(p.amount ?? p.amountPaid ?? p.value ?? 0), 0);

    cumulativeTuitionPaid += termTuitionPayment;

    // 3. WATERFALL: If we have excess tuition payment, move it to unallocatedTuition pool to settle categories
    const tuitionExcess = Math.max(0, cumulativeTuitionPaid - cumulativeTuitionBill);
    if (tuitionExcess > 0) {
      unallocatedTuition += tuitionExcess;
      cumulativeTuitionPaid -= tuitionExcess;
    }

    updates.termBill = termGrossTuition;

    // --- CATEGORIES ---
    let totalTermCategoryBill = 0;
    let currentTotalCategoryArrears = 0;

    // Tracking for record.other fields
    let termOtherPaid = 0;
    let termOtherBill = 0;
    let termOtherBalance = 0;

    // Sort keys to respect waterfall order
    fullWaterfall.forEach(k => {
      const isHardcoded = isolatedKeys.includes(k);

      // Sum of charges in feePayments for this category/term
      const totalChargesInTerm = termSpecificCharges
        .filter(c => normalizeCategory(c) === k)
        .reduce((sum, c) => sum + Number(c.amount ?? 0), 0);

      // Use the higher of the record's bill or the sum of charges found
      // If it's dynamic, it only exists in feePayments charges
      const termBill = isHardcoded ? Math.max(safeNum(data[`${k}Bill`]), totalChargesInTerm) : totalChargesInTerm;
      totalTermCategoryBill += termBill;

      const catArrears = Math.max(0, cumulativeCategoryBillPool[k] - cumulativeCategoryPaidPool[k]);
      currentTotalCategoryArrears += catArrears;

      cumulativeCategoryBillPool[k] += termBill;

      // 1. Apply unallocated category-specific money first
      let catDebt = Math.max(0, cumulativeCategoryBillPool[k] - cumulativeCategoryPaidPool[k]);
      if (catDebt > 0 && unallocatedCategoryPool[k] > 0) {
        const amountToApply = Math.min(catDebt, unallocatedCategoryPool[k]);
        unallocatedCategoryPool[k] -= amountToApply;
        cumulativeCategoryPaidPool[k] += amountToApply;
        catDebt -= amountToApply;
      }

      // 2. Apply unallocated tuition/general money to category debt
      if (catDebt > 0 && unallocatedTuition > 0) {
        const amountToApply = Math.min(catDebt, unallocatedTuition);
        unallocatedTuition -= amountToApply;
        cumulativeCategoryPaidPool[k] += amountToApply;
        catDebt -= amountToApply;
      }

      // 3. Add direct payments for this term
      const termCatPayment = termSpecificPayments
        .filter(p => normalizeCategory(p) === k)
        .reduce((sum, p) => sum + Number(p.amount ?? p.amountPaid ?? p.value ?? 0), 0);

      cumulativeCategoryPaidPool[k] += termCatPayment;

      // 4. WATERFALL: If we have excess category payment, move it to general pool
      const catExcess = Math.max(0, cumulativeCategoryPaidPool[k] - cumulativeCategoryBillPool[k]);
      if (catExcess > 0) {
        unallocatedTuition += catExcess;
        cumulativeCategoryPaidPool[k] -= catExcess;
      }

      // 5. Final attempt to settle this term's category bill with remaining general pool
      const remainingCatDebt = Math.max(0, cumulativeCategoryBillPool[k] - cumulativeCategoryPaidPool[k]);
      if (remainingCatDebt > 0 && unallocatedTuition > 0) {
        const spillover = Math.min(remainingCatDebt, unallocatedTuition);
        cumulativeCategoryPaidPool[k] += spillover;
        unallocatedTuition -= spillover;
      }

      const allocatedPaid = cumulativeCategoryPaidPool[k] - prevCumulativeCategoryPaid[k];
      const catBalance = cumulativeCategoryBillPool[k] - cumulativeCategoryPaidPool[k] - unallocatedCategoryPool[k];

      if (isHardcoded) {
        updates[`${k}Paid`] = allocatedPaid;
        updates[`${k}Bill`] = termBill;
        updates[`${k}Balance`] = catBalance;
      } else {
        termOtherPaid += allocatedPaid;
        termOtherBill += termBill;
        termOtherBalance += catBalance;
      }
    });

    // Return any remaining unallocated general money back to cumulativeTuitionPaid so it's included in updates.amountPaid
    if (unallocatedTuition > 0) {
      cumulativeTuitionPaid += unallocatedTuition;
      unallocatedTuition = 0;
    }

    updates.amountPaid = cumulativeTuitionPaid - prevCumulativeTuitionPaid;
    updates.otherPaid = termOtherPaid;
    updates.otherBill = termOtherBill;
    updates.otherBalance = termOtherBalance;

    // --- SUMMARY ---
    // Correct Arrears: Amount owed from PREVIOUS terms only (captured during loop)
    const totalRecordArrears = recordTuitionArrears + currentTotalCategoryArrears;

    const totalPaymentsAllTime = actualPayments.reduce((s, p) => s + Number(p.amount ?? p.amountPaid ?? p.value ?? 0), 0);
    const totalBillsAllTime = cumulativeTuitionBill + Object.values(cumulativeCategoryBillPool).reduce((a, b) => a + b, 0);

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
  let finalOtherBalance = 0;
  let finalOtherPaid = 0;
  let finalOtherBill = 0;

  fullWaterfall.forEach((k) => {
    const isHardcoded = isolatedKeys.includes(k);
    const catBalance =
      cumulativeCategoryBillPool[k] -
      cumulativeCategoryPaidPool[k] -
      unallocatedCategoryPool[k];
    const catPaid = cumulativeCategoryPaidPool[k] + unallocatedCategoryPool[k];
    const catBill = cumulativeCategoryBillPool[k];

    if (isHardcoded) {
      finalUserUpdates[`${k}Balance`] = catBalance;
      finalUserUpdates[`${k}Paid`] = catPaid;
      finalUserUpdates[`${k}Bill`] = catBill;
    } else {
      finalOtherBalance += catBalance;
      finalOtherPaid += catPaid;
      finalOtherBill += catBill;
    }
  });

  finalUserUpdates.otherBalance = finalOtherBalance;
  finalUserUpdates.otherPaid = finalOtherPaid;
  finalUserUpdates.otherBill = finalOtherBill;

  userUpdates.set(uid, finalUserUpdates);

  return reconciledCount;
};
