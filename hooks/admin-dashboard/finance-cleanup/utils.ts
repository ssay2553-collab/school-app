export const normalizeCategory = (p: any) => {
  if (!p) return "tuition";
  const type = (p.type || "").toLowerCase();

  // Explicitly check for payment suffixes first to ensure we don't misidentify them
  if (type.endsWith("_payment")) {
    const cat = type.replace("_payment", "");
    if (isolatedKeys.includes(cat)) return cat;
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
  if (cleaned.includes("other")) return "other";
  return "tuition";
};

/**
 * Determines if a fee record entry represents a payment (money in)
 * or a charge/bill (money owed).
 */
export const isPaymentEntry = (p: any): boolean => {
  if (!p) return true;
  const method = (p.method || "").toLowerCase();
  const type = (p.type || "").toLowerCase();
  const receivedFrom = (p.receivedFrom || "").toLowerCase();

  // Bulk Charges and specific category bill types are NOT payments
  if (
    method === "bulk charge" ||
    method === "system billing" ||
    receivedFrom === "system billing" ||
    method.includes("bill")
  )
    return false;

  // If it ends with _payment, it's definitely a payment
  if (type.endsWith("_payment")) return true;

  // Tuition is usually a payment unless specified as a bill in method
  if (type === "tuition") {
    return (
      method !== "bill" &&
      !method.includes("charge") &&
      method !== "system billing"
    );
  }

  // Fallback for older records: if type is an isolated key (e.g. "pta"),
  // and method is "bulk charge", it's a bill.
  if (isolatedKeys.includes(type) && method === "bulk charge") return false;

  return true;
};

export const termOrder = ["Term 1", "Term 2", "Term 3"];
export const waterfallOrder = [
  "admission",
  "pta",
  "maintenance",
  "books",
  "uniform",
  "other",
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

  // Fields that represent cumulative totals should be summed when merging two separate accounts
  const sumKeys = [
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

    if (sumKeys.includes(key)) {
      // Sum the totals (e.g., if one account had 100 paid and other had 50, total is 150)
      merged[key] = v1 + v2;
    } else if (key.endsWith("Bill")) {
      // Bills are usually constant for a term, take the highest (max) to avoid doubling
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
