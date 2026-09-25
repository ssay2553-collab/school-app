export const normalizeCategory = (p: any) => {
  if (!p) return "tuition";
  const type = (p.type || "").toLowerCase();
  const otherCat = (p.otherCategory || "").toLowerCase().trim();

  // Explicitly check for payment suffixes first
  if (type.endsWith("_payment")) {
    const cat = type.replace("_payment", "");
    if (isolatedKeys.includes(cat)) return cat;
    if (otherCat) return otherCat;
    if (cat === "tuition" || cat === "tuition_credit" || cat === "credit") return "tuition";
    if (cat === "other" || cat === "other charges") return "tuition";
    return cat;
  }

  // Explicit check for tuition types
  if (type.includes("tuition")) return "tuition";

  // If it's a known non-hardcoded bill, use otherCategory or type
  if (type === "other" && otherCat) return otherCat;
  if (type === "other charges") {
    if (otherCat) return otherCat;
    return "other charges";
  }

  const cand = (p.type || p.category || p.purpose || p.memo || "tuition")
    .toString()
    .toLowerCase()
    .trim();
  const cleaned = cand.replace(/[^a-z0-9]/g, "");

  if (cleaned.includes("pta")) return "pta";
  if (cleaned.includes("maintenance")) return "maintenance";
  if (cleaned.includes("admission")) return "admission";
  if (cleaned.includes("book") || cleaned.includes("books")) return "books";
  if (cleaned.includes("uniform")) return "uniform";

  if (otherCat) return otherCat;
  if (cleaned.includes("othercharges") || cleaned.includes("otherfees")) return "other charges";
  if (cleaned.includes("other")) return "tuition";

  // Fallback for custom labels
  if (type !== "" && type !== "tuition" && !isolatedKeys.includes(type)) return type;

  return "tuition";
};

/**
 * Determines if a fee record entry represents a payment (money in)
 * or a charge/bill (money owed).
 */
export const isPaymentEntry = (p: any): boolean => {
  if (!p) return true;

  if (typeof p.isPayment === "boolean") return p.isPayment;
  if (p.isBill === true || p.isCharge === true) return false;

  const method = (p.method || p.paymentMethod || "").toLowerCase().trim();
  const type = (p.type || "").toLowerCase().trim();
  const receivedFrom = (p.receivedFrom || "").toLowerCase().trim();

  // Explicit payment type suffixes or credit types
  if (type.endsWith("_payment") || type === "tuition_credit" || type === "credit") {
    return true;
  }

  // Explicit billing or charge methods/sources
  if (
    method === "bulk charge" ||
    method === "individual charge" ||
    method === "system billing" ||
    method.includes("charge") ||
    method.includes("bill") ||
    receivedFrom === "system billing"
  ) {
    return false;
  }

  // Known fee category types that represent bills when logged without '_payment' suffix
  const billingCategories = [
    "pta",
    "maintenance",
    "admission",
    "books",
    "uniform",
    "other",
    "bus",
    "feeding",
    "extra_classes",
  ];
  if (billingCategories.includes(type)) {
    return false;
  }

  // Tuition type logic
  if (type === "tuition") {
    return (
      !method.includes("bill") &&
      !method.includes("charge") &&
      method !== "system billing"
    );
  }

  // Fallback for payment methods
  const paymentMethods = ["cash", "momo", "cheque", "e-cash", "bank", "transfer", "mobile money"];
  if (paymentMethods.some((pm) => method.includes(pm))) {
    return true;
  }

  return true;
};

export const termOrder = ["Term 1", "Term 2", "Term 3"];

/**
 * Strict waterfall settlement order after tuition:
 * 1. Maintenance
 * 2. PTA
 * 3. Dynamic custom categories / other charges
 * 4. Admission
 * 5. Books
 * 6. Uniform
 */
export const waterfallOrder = [
  "maintenance",
  "pta",
  "admission",
  "books",
  "uniform",
];

export const isolatedKeys = ["maintenance", "pta", "admission", "books", "uniform"];

export const getFullWaterfallOrder = (dynamicCategories: string[]) => {
  const custom = dynamicCategories.filter(
    (c) =>
      ![
        "tuition",
        "maintenance",
        "pta",
        "admission",
        "books",
        "uniform",
        "other charges",
        "other",
        "arrears",
        "surplus",
      ].includes(c.toLowerCase().trim())
  );
  return [
    "maintenance",
    "pta",
    ...custom,
    "admission",
    "books",
    "uniform",
  ];
};

export const getSettlementOrder = (dynamicCategories: string[] = []) => {
  return ["tuition", ...getFullWaterfallOrder(dynamicCategories)];
};

/**
 * Returns numeric rank for category ordering:
 * 1. Previous terms arrears (if there is)
 * 2. Tuition fee
 * 3. Maintenance
 * 4. PTA
 * 5. Categories of billed items from 'other charges' (custom categories)
 * 6. Admission
 * 7. Books
 * 8. Uniform
 * 9. Surplus (overpayment credit)
 */
export const getCategoryRank = (cat: string): number => {
  const lower = (cat || "").toLowerCase().trim();
  if (lower === "arrears") return 1;
  if (lower === "tuition") return 2;
  if (lower === "maintenance") return 3;
  if (lower === "pta") return 4;
  if (lower === "admission") return 6;
  if (lower === "books") return 7;
  if (lower === "uniform") return 8;
  if (lower === "surplus") return 9;
  return 5;
};

export const categoryNameMap: Record<string, string> = {
  tuition: "Tuition Fees",
  maintenance: "Maintenance Fee",
  pta: "PTA Dues",
  "other charges": "Other Charges",
  admission: "Admission Fee",
  books: "Books Fee",
  uniform: "Uniform Fee",
  arrears: "Previous Terms Arrears",
  surplus: "Surplus",
  tuition_payment: "Tuition Payment",
  maintenance_payment: "Maintenance Fee Payment",
  pta_payment: "PTA Dues Payment",
  "other charges_payment": "Other Charges Payment",
  admission_payment: "Admission Fee Payment",
  books_payment: "Books Payment",
  uniform_payment: "Uniform Payment",
  tuition_credit: "Tuition Credit / Overpayment",
};

export const getCategoryDisplayName = (cat: string, otherCategory?: string) => {
  if (otherCategory) return otherCategory;
  if (!cat) return "Fee Category";
  const lower = cat.toLowerCase().trim();
  if (categoryNameMap[lower]) return categoryNameMap[lower];
  return lower
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export interface CategorySummaryItem {
  id: string;
  name: string;
  billed: number;
  paid: number;
  balance: number;
}

export interface FeeBreakdownResult {
  categorySummary: CategorySummaryItem[];
  totals: {
    billed: number;
    paid: number;
    balance: number;
  };
  rawSummary: Record<string, { billed: number; paid: number }>;
}

export const calculateFeeBreakdown = (
  record: any,
  transactions: any[]
): FeeBreakdownResult => {
  const summary: Record<string, { billed: number; paid: number }> = {};

  // 1. Check for Previous Terms Arrears
  const arrearsVal = Math.max(0, Number(record?.arrears) || 0);
  if (arrearsVal > 0) {
    summary["arrears"] = { billed: arrearsVal, paid: 0 };
  }

  // 2. Initialize Tuition
  summary["tuition"] = { billed: 0, paid: 0 };

  const waterfallPool: number[] = [];

  // 3. Process transactions (charges and payments)
  (transactions || []).forEach((t: any) => {
    const isPayment = isPaymentEntry(t);
    const category = normalizeCategory(t);
    const amount = Math.max(0, Number(t.amount ?? t.amountPaid ?? t.value) || 0);

    if (amount <= 0) return;

    if (!summary[category]) {
      summary[category] = { billed: 0, paid: 0 };
    }

    if (isPayment) {
      if (category === "tuition") {
        waterfallPool.push(amount);
      } else {
        summary[category].paid += amount;
      }
    } else {
      summary[category].billed += amount;
    }
  });

  // 4. Incorporate hardcoded bills from the record doc
  if (record) {
    const baseTuitionBilled = Math.max(
      0,
      (Number(record.termBill) || 0) - (Number(record.discount) || 0)
    );
    summary["tuition"].billed = Math.max(summary["tuition"].billed, baseTuitionBilled);

    const isolatedFields = [
      { key: "maintenance", bill: record.maintenanceBill || 0 },
      { key: "pta", bill: record.ptaBill || 0 },
      { key: "admission", bill: record.admissionBill || 0 },
      { key: "books", bill: record.booksBill || 0 },
      { key: "uniform", bill: record.uniformBill || 0 },
    ];

    isolatedFields.forEach(({ key, bill }) => {
      const b = Math.max(0, Number(bill) || 0);
      if (!summary[key]) summary[key] = { billed: 0, paid: 0 };
      summary[key].billed = Math.max(summary[key].billed, b);
    });

    const otherB = Math.max(0, Number(record.otherBill) || 0);
    if (otherB > 0) {
      // Calculate total billed across explicit custom categories (e.g. examination, mock, bus, etc.)
      const fixedKeys = [
        "tuition",
        "maintenance",
        "pta",
        "admission",
        "books",
        "uniform",
        "arrears",
        "surplus",
        "other charges",
        "other",
      ];
      const explicitCustomBilled = Object.keys(summary)
        .filter((k) => !fixedKeys.includes(k.toLowerCase().trim()))
        .reduce((sum, k) => sum + (summary[k].billed || 0), 0);

      // Only bill unassigned difference to 'other charges' if record.otherBill exceeds explicit custom charges
      const unassignedOtherBilled = Math.max(0, otherB - explicitCustomBilled);
      if (unassignedOtherBilled > 0) {
        if (!summary["other charges"]) summary["other charges"] = { billed: 0, paid: 0 };
        summary["other charges"].billed = Math.max(
          summary["other charges"].billed,
          unassignedOtherBilled
        );
      }
    }
  }

  // 5. Virtual Waterfall Settlement (general pool)
  let generalPool = Math.max(0, waterfallPool.reduce((a, b) => a + b, 0));

  // Sequence:
  // 1. Arrears
  if (summary["arrears"] && generalPool > 0) {
    const due = Math.max(0, summary["arrears"].billed - summary["arrears"].paid);
    const settle = Math.min(generalPool, due);
    summary["arrears"].paid += settle;
    generalPool -= settle;
  }

  // 2. Tuition Fee
  if (summary["tuition"] && generalPool > 0) {
    const due = Math.max(0, summary["tuition"].billed - summary["tuition"].paid);
    const settle = Math.min(generalPool, due);
    summary["tuition"].paid += settle;
    generalPool -= settle;
  }

  // 3. Maintenance Fee
  if (summary["maintenance"] && generalPool > 0) {
    const due = Math.max(0, summary["maintenance"].billed - summary["maintenance"].paid);
    const settle = Math.min(generalPool, due);
    summary["maintenance"].paid += settle;
    generalPool -= settle;
  }

  // 4. PTA Dues
  if (summary["pta"] && generalPool > 0) {
    const due = Math.max(0, summary["pta"].billed - summary["pta"].paid);
    const settle = Math.min(generalPool, due);
    summary["pta"].paid += settle;
    generalPool -= settle;
  }

  // 5. Dynamic Categories / 'other charges'
  const fixedCategories = [
    "arrears",
    "tuition",
    "maintenance",
    "pta",
    "admission",
    "books",
    "uniform",
    "surplus",
  ];
  const customCategories = Object.keys(summary)
    .filter((c) => !fixedCategories.includes(c))
    .sort();

  customCategories.forEach((cat) => {
    if (summary[cat] && generalPool > 0) {
      const due = Math.max(0, summary[cat].billed - summary[cat].paid);
      const settle = Math.min(generalPool, due);
      summary[cat].paid += settle;
      generalPool -= settle;
    }
  });

  // 6. Admission Fee
  if (summary["admission"] && generalPool > 0) {
    const due = Math.max(0, summary["admission"].billed - summary["admission"].paid);
    const settle = Math.min(generalPool, due);
    summary["admission"].paid += settle;
    generalPool -= settle;
  }

  // 7. Books Fee
  if (summary["books"] && generalPool > 0) {
    const due = Math.max(0, summary["books"].billed - summary["books"].paid);
    const settle = Math.min(generalPool, due);
    summary["books"].paid += settle;
    generalPool -= settle;
  }

  // 8. Uniform Fee
  if (summary["uniform"] && generalPool > 0) {
    const due = Math.max(0, summary["uniform"].billed - summary["uniform"].paid);
    const settle = Math.min(generalPool, due);
    summary["uniform"].paid += settle;
    generalPool -= settle;
  }

  // 9. Surplus (Overpayment balance)
  if (generalPool > 0) {
    summary["surplus"] = { billed: 0, paid: generalPool };
  }

  // 6. Format and Sort Category Summary Items
  const categorySummaryItems: CategorySummaryItem[] = Object.entries(summary)
    .filter(([_, vals]) => Math.max(0, vals.billed) >= 0.01 || Math.max(0, vals.paid) >= 0.01)
    .map(([cat, vals]) => {
      const billed = Math.max(0, vals.billed);
      const paid = Math.max(0, vals.paid);
      const balance = Math.max(0, billed - paid);
      return {
        id: cat,
        name: getCategoryDisplayName(cat),
        billed,
        paid,
        balance,
      };
    })
    .sort((a, b) => {
      const rankA = getCategoryRank(a.id);
      const rankB = getCategoryRank(b.id);
      if (rankA !== rankB) return rankA - rankB;
      return a.name.localeCompare(b.name);
    });

  // Re-build rawSummary as an object ordered by category rank
  const orderedRawSummary: Record<string, { billed: number; paid: number }> = {};
  categorySummaryItems.forEach((item) => {
    orderedRawSummary[item.id] = { billed: item.billed, paid: item.paid };
  });

  // 7. Calculate Totals with NO negative calculations
  const totalBilled = categorySummaryItems.reduce(
    (acc, item) => acc + (item.id === "surplus" ? 0 : item.billed),
    0
  );
  const totalPaid = categorySummaryItems.reduce((acc, item) => acc + item.paid, 0);
  const totalBalance = Math.max(0, totalBilled - totalPaid);

  return {
    categorySummary: categorySummaryItems,
    totals: {
      billed: totalBilled,
      paid: totalPaid,
      balance: totalBalance,
    },
    rawSummary: orderedRawSummary,
  };
};

export const getTermIndex = (t: string) => {
  const lower = (t || "").toLowerCase();
  if (lower.includes("1")) return 0;
  if (lower.includes("2")) return 1;
  if (lower.includes("3")) return 2;
  return termOrder.indexOf(t);
};

/**
 * Merges two financial data objects, preserving the strongest (highest) values
 * for bills and payments, and deduplicating embedded payment arrays.
 */
export const mergeFinancialData = (target: any, source: any) => {
  const merged = { ...target };
  const financialKeys = [
    "termBill",
    "amountPaid",
    "discount",
    "arrears",
    "balance",
    "totalPayable",
  ];

  // Fields that represent cumulative totals should NOT be summed when merging duplicate term records
  // because the reconciler will re-calculate the true total from explicit payment documents.
  // Using Math.max prevents doubling up when duplicate student identity records exist for the same term.
  const maxKeys = [
    "amountPaid",
    "discount",
    ...isolatedKeys.map((k) => `${k}Paid`),
  ];

  isolatedKeys.forEach((k) => {
    financialKeys.push(`${k}Bill`);
    financialKeys.push(`${k}Paid`);
    financialKeys.push(`${k}Balance`);
  });

  financialKeys.forEach((key) => {
    const v1 = Number(target[key] || 0);
    const v2 = Number(source[key] || 0);

    if (maxKeys.includes(key) || key.endsWith("Bill")) {
      // Use the maximum value to avoid doubling up when two records represent the same term/identity
      merged[key] = Math.max(v1, v2);
    } else {
      // For balances and other fields, take the most significant value
      if (v2 > v1) merged[key] = v2;
    }
  });

  if (Array.isArray(source.payments)) {
    if (!Array.isArray(merged.payments)) merged.payments = [];
    source.payments.forEach((p: any) => {
      const isDup = merged.payments.some((ep: any) => {
        const pAmount = Number(p.amount ?? p.amountPaid ?? 0);
        const epAmount = Number(ep.amount ?? ep.amountPaid ?? 0);

        const getSafeDate = (d: any) => {
          if (!d) return "";
          if (typeof d === "string") return d;
          if (d.toDate && typeof d.toDate === "function")
            return d.toDate().toISOString();
          if (d.seconds) return new Date(d.seconds * 1000).toISOString();
          return String(d);
        };

        return (
          Math.abs(pAmount - epAmount) < 0.01 &&
          getSafeDate(p.date || p.createdAt) ===
            getSafeDate(ep.date || ep.createdAt) &&
          (p.type || p.category) === (ep.type || ep.category)
        );
      });
      if (!isDup) merged.payments.push(p);
    });
  }
  return merged;
};
