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
