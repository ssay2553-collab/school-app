export const createResolvers = (
  studentNameMap: Map<string, string>,
  studentIDMap: Map<string, string>,
  validStudentIds: Set<string>
) => {
  const resolveUid = (
    uidOrId: string | undefined,
    name?: string,
    docId?: string
  ) => {
    if (!uidOrId || uidOrId === "undefined" || uidOrId === "null") {
      // Robustness fallback: Try to extract UID from docId if present (UID_AY_TERM)
      if (docId) {
        const firstPart = docId.split("_")[0];
        if (firstPart && validStudentIds.has(firstPart)) return firstPart;
      }
      // Name fallback for older records that might only have a name
      if (name) {
        const cleanedName = name.toLowerCase().trim();
        const fromName = studentNameMap.get(cleanedName);
        if (fromName) return fromName;
      }
      return null;
    }

    const trimmed = String(uidOrId).trim();
    if (validStudentIds.has(trimmed)) return trimmed;

    // Last resort fallbacks for documents that might still have a studentID or name
    const fromID = studentIDMap.get(trimmed.toLowerCase());
    if (fromID) return fromID;

    if (name) {
      const cleanedName = name.toLowerCase().trim();
      const fromName = studentNameMap.get(cleanedName);
      if (fromName) return fromName;
    }

    return null;
  };

  const resolvePaymentUid = (
    p: any,
    fallbackUid?: string,
    recordDocId?: string
  ) => {
    const uidFromPayment = p?.studentUid || p?.studentID || p?.studentId;
    const name = p?.studentName || p?.receivedFrom || p?.paidBy;
    const resolved = resolveUid(uidFromPayment, name, recordDocId);
    if (resolved) return resolved;
    if (fallbackUid) return fallbackUid;
    return null;
  };

  return { resolveUid, resolvePaymentUid };
};
