import {
    Query,
    QuerySnapshot,
    getDocsFromCache,
    getDocsFromServer,
} from "firebase/firestore";

/**
 * Try to read a query from the local cache first, then fall back to server.
 * This version includes a safety fallback if the cache is empty or throws.
 */
export async function getDocsCacheFirst(q: Query): Promise<QuerySnapshot> {
  try {
    const snap = await getDocsFromCache(q as any);
    // If the cache is empty, we must go to the server
    if (snap.empty) {
      return await getDocsFromServer(q as any);
    }
    return snap as QuerySnapshot;
  } catch (err) {
    // If cache access fails (e.g. on Electron/Web protocols), always fallback to server
    return await getDocsFromServer(q as any);
  }
}

export default {
  getDocsCacheFirst,
};
