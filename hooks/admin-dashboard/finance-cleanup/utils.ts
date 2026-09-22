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
export const waterfallOrder = [
  "admission",
  "pta",
  "maintenance",
  "books",
  "uniform",
];
export const isolatedKeys = waterfallOrder;

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
    ...isolatedKeys.map(k => `${k}Paid`)
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
