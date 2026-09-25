import { serverTimestamp } from "firebase/firestore";
import { StudentRecord, StudentPayment } from "./types";
import {
  isolatedKeys,
  normalizeCategory,
  getTermIndex,
  isPaymentEntry,
  getFullWaterfallOrder,
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
    if (!['tuition', ...isolatedKeys].includes(cat)) {
      detectedCategories.add(cat);
    }
  });
  const dynamicCategories = Array.from(detectedCategories);
  const fullWaterfall = getFullWaterfallOrder(dynamicCategories);
  const settlementOrder = ['tuition', ...fullWaterfall];

  // Cumulative tracking pools
  const cumulativeBillPool: Record<string, number> = {};
  const cumulativePaidPool: Record<string, number> = {};
  settlementOrder.forEach(k => {
    cumulativeBillPool[k] = 0;
    cumulativePaidPool[k] = 0;
  });

  // Start with unallocated general payments pool
  let generalPool = unallocatedPayments.reduce((sum, p) => sum + Number(p.amount ?? p.amountPaid ?? p.value ?? 0), 0);

  let reconciledCount = 0;
  let lastFinalBalance = 0;
  let lastSurplus = 0;

  if (sortedRecords.length === 0) {
    const totalPaidAll = actualPayments.reduce((sum, p) => sum + Number(p.amount ?? p.amountPaid ?? p.value ?? 0), 0);
    const totalChargesAll = chargeEntries.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
    const balance = Math.max(0, totalChargesAll - totalPaidAll);
    const surplus = Math.max(0, totalPaidAll - totalChargesAll);
    userUpdates.set(uid, {
      walletBalance: balance,
      surplus: surplus,
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

    const prevPaidPool: Record<string, number> = {};
    settlementOrder.forEach(k => prevPaidPool[k] = cumulativePaidPool[k]);

    // 1. Calculate Arrears from previous terms before adding current bills
    const currentArrearsPool: Record<string, number> = {};
    let totalTermArrears = 0;
    settlementOrder.forEach(k => {
      const arr = Math.max(0, cumulativeBillPool[k] - cumulativePaidPool[k]);
      currentArrearsPool[k] = arr;
      totalTermArrears += arr;
    });

    // 2. Add current term specific payments to the general pool for allocation
    const termDirectPaymentSum = termSpecificPayments.reduce((sum, p) => sum + Number(p.amount ?? p.amountPaid ?? p.value ?? 0), 0);
    generalPool += termDirectPaymentSum;

    // 3. Settle Arrears first in strict full waterfall order
    settlementOrder.forEach(k => {
      if (generalPool > 0 && currentArrearsPool[k] > 0) {
        const allocation = Math.min(generalPool, currentArrearsPool[k]);
        cumulativePaidPool[k] += allocation;
        generalPool -= allocation;
      }
    });

    // 4. Determine current term bills
    const currentTermBills: Record<string, number> = {};

    // Tuition specific bill
    const extraTuitionCharges = termSpecificCharges
       .filter(c => normalizeCategory(c) === 'tuition')
       .reduce((sum, c) => sum + Number(c.amount ?? 0), 0);
    const termGrossTuition = Math.max(safeNum(data.termBill), extraTuitionCharges);
    currentTermBills['tuition'] = Math.max(0, termGrossTuition - safeNum(data.discount));

    // Category bills
    settlementOrder.forEach(k => {
      if (k === 'tuition') return;
      const isHardcoded = isolatedKeys.includes(k);
      const totalChargesInTerm = termSpecificCharges
        .filter(c => normalizeCategory(c) === k)
        .reduce((sum, c) => sum + Number(c.amount ?? 0), 0);
      currentTermBills[k] = isHardcoded ? Math.max(safeNum(data[`${k}Bill`]), totalChargesInTerm) : totalChargesInTerm;
    });

    // If data.otherBill exceeds explicit custom charges, assign the unassigned difference to 'other charges'
    const totalCustomCharges = settlementOrder
      .filter(k => k !== 'tuition' && !isolatedKeys.includes(k) && k !== 'other charges' && k !== 'other')
      .reduce((sum, k) => sum + (currentTermBills[k] || 0), 0);
    const unassignedOtherBill = Math.max(0, safeNum(data.otherBill) - totalCustomCharges);
    if (unassignedOtherBill > 0) {
      currentTermBills['other charges'] = Math.max(currentTermBills['other charges'] || 0, unassignedOtherBill);
    }

    // 5. Add current term bills to cumulative bills
    settlementOrder.forEach(k => {
      cumulativeBillPool[k] += currentTermBills[k];
    });

    // 6. Settle current term bills in strict sequence
    settlementOrder.forEach(k => {
      const currentDebt = Math.max(0, cumulativeBillPool[k] - cumulativePaidPool[k]);
      if (generalPool > 0 && currentDebt > 0) {
        const allocation = Math.min(generalPool, currentDebt);
        cumulativePaidPool[k] += allocation;
        generalPool -= allocation;
      }
    });

    // 7. Prepare Updates Object
    const updates: any = {
      lastUpdated: serverTimestamp(),
      payments: studentPayments,
      discount: safeNum(data.discount),
    };

    let termOtherPaid = 0;
    let termOtherBill = 0;
    let termOtherBalance = 0;

    settlementOrder.forEach(k => {
      const allocatedPaid = Math.max(0, cumulativePaidPool[k] - prevPaidPool[k]);
      const catBalance = Math.max(0, cumulativeBillPool[k] - cumulativePaidPool[k]);

      if (k === 'tuition') {
        updates.amountPaid = allocatedPaid;
        updates.termBill = termGrossTuition;
        updates.balance = catBalance;
      } else if (isolatedKeys.includes(k)) {
        updates[`${k}Paid`] = allocatedPaid;
        updates[`${k}Bill`] = currentTermBills[k];
        updates[`${k}Balance`] = catBalance;
      } else {
        termOtherPaid += allocatedPaid;
        termOtherBill += currentTermBills[k];
        termOtherBalance += catBalance;
      }
    });

    updates.otherPaid = termOtherPaid;
    updates.otherBill = termOtherBill;
    updates.otherBalance = termOtherBalance;

    // Total record summary fields
    const totalTermCategoryBill = Object.keys(currentTermBills)
      .filter(k => k !== 'tuition')
      .reduce((sum, k) => sum + currentTermBills[k], 0);

    const totalRecordBalance = settlementOrder.reduce((sum, k) => sum + Math.max(0, cumulativeBillPool[k] - cumulativePaidPool[k]), 0);

    updates.arrears = Math.max(0, totalTermArrears);
    updates.balance = Math.max(0, totalRecordBalance);
    updates.surplus = Math.max(0, generalPool);
    updates.totalPayable = Math.max(0, totalTermArrears + termGrossTuition + totalTermCategoryBill);

    const needsUpdate =
      isNaN(Number(data.balance)) ||
      Math.abs(safeNum(data.balance) - updates.balance) > 0.01 ||
      Math.abs(safeNum(data.arrears) - updates.arrears) > 0.01 ||
      Math.abs(safeNum(data.surplus) - updates.surplus) > 0.01 ||
      (fixedRecordsCount > 0 && !!recordUpdates.get(record.id));

    if (needsUpdate) {
      recordUpdates.set(record.id, { ...(recordUpdates.get(record.id) || {}), ...updates });
      reconciledCount++;
    }

    lastFinalBalance = totalRecordBalance;
    lastSurplus = generalPool;
  }

  // 8. Update User Profile
  const finalUserUpdates: any = {
    walletBalance: Math.max(0, lastFinalBalance),
    surplus: Math.max(0, lastSurplus),
    financeLastReconciled: serverTimestamp(),
  };

  settlementOrder.forEach((k) => {
    if (k === 'tuition') return;
    const catBalance = Math.max(0, cumulativeBillPool[k] - cumulativePaidPool[k]);
    const catPaid = cumulativePaidPool[k];
    const catBill = cumulativeBillPool[k];

    if (isolatedKeys.includes(k)) {
      finalUserUpdates[`${k}Balance`] = catBalance;
      finalUserUpdates[`${k}Paid`] = catPaid;
      finalUserUpdates[`${k}Bill`] = catBill;
    }
  });

  let finalOtherBalance = 0;
  let finalOtherPaid = 0;
  let finalOtherBill = 0;
  dynamicCategories.forEach(k => {
    finalOtherBalance += Math.max(0, cumulativeBillPool[k] - cumulativePaidPool[k]);
    finalOtherPaid += cumulativePaidPool[k];
    finalOtherBill += cumulativeBillPool[k];
  });

  finalUserUpdates.otherBalance = finalOtherBalance;
  finalUserUpdates.otherPaid = finalOtherPaid;
  finalUserUpdates.otherBill = finalOtherBill;

  userUpdates.set(uid, finalUserUpdates);

  return reconciledCount;
};
