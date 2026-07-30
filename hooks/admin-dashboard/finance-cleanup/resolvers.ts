export const createResolvers = (
  studentNameMap: Map<string, string>,
  studentIDMap: Map<string, string>,
  claimedMapping: Map<string, string>,
  validStudentIds: Set<string>
) => {
  const resolveUid = (
    uidOrId: string | undefined,
    name?: string,
    docId?: string
  ) => {
    if (!uidOrId || uidOrId === "undefined" || uidOrId === "null") {
      if (name) {
        const cleanedName = name.toLowerCase().trim();
        const fromName = studentNameMap.get(cleanedName);
        if (fromName) return claimedMapping.get(fromName) || fromName;
      }
      if (docId) {
        const firstPart = docId.split("_")[0];
        if (firstPart) {
          const fromID = studentIDMap.get(firstPart.toLowerCase().trim());
          if (fromID) return claimedMapping.get(fromID) || fromID;
          if (validStudentIds.has(firstPart))
            return claimedMapping.get(firstPart) || firstPart;
        }
      }
      return null;
    }

    const trimmed = String(uidOrId).trim();
    if (validStudentIds.has(trimmed))
      return claimedMapping.get(trimmed) || trimmed;

    const fromID = studentIDMap.get(trimmed.toLowerCase());
    if (fromID) return claimedMapping.get(fromID) || fromID;

    if (name) {
      const cleanedName = name.toLowerCase().trim();
      const fromName = studentNameMap.get(cleanedName);
      if (fromName) return claimedMapping.get(fromName) || fromName;
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
