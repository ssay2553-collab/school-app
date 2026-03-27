import { collection, query, Timestamp, where } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { getDocsCacheFirst } from "../lib/firestoreHelpers";
import { NewsItem } from "../types/news";

export async function fetchNewsForAudience(
  audience: string,
): Promise<NewsItem[]> {
  try {
    const q = query(
      collection(db, "news"),
      where("audience", "in", ["all", audience]),
    );

    const snapshot = await getDocsCacheFirst(q);

    const now = new Date();
    const news = (
      snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as NewsItem[]
    ).filter((item) => {
      if (!item.expiryDate) return true;
      // Convert Firestore timestamp to Date
      const expiry =
        item.expiryDate instanceof Timestamp
          ? item.expiryDate.toDate()
          : new Date(item.expiryDate?.seconds * 1000);
      return expiry > now;
    });

    // Sort newest first
    return news.sort(
      (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0),
    );
  } catch (error) {
    console.error("Failed to fetch news:", error);
    return [];
  }
}

export async function fetchCategories() {
  try {
    const q = collection(db, "newscategories");

    const snapshot = await getDocsCacheFirst(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    return [];
  }
}
