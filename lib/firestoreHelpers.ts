import {
    getDocsFromServer,
    Query,
    QuerySnapshot,
} from "firebase/firestore";

/**
 * @deprecated Use getDocsFromServer directly.
 * This helper originally attempted getDocsFromCache but caused stale data issues in PWAs.
 * It is now a direct wrapper for getDocsFromServer to ensure data freshness.
 */
export async function getDocsCacheFirst(q: Query): Promise<QuerySnapshot> {
  return await getDocsFromServer(q as any);
}

export default {
  getDocsCacheFirst,
};
