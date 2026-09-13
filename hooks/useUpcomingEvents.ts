import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebaseConfig";

export const useUpcomingEvents = (limitCount = 2) => {
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const q = query(
      collection(db, "academic_calendar"),
      where("date", ">=", Timestamp.fromDate(today)),
      orderBy("date", "asc"),
      limit(limitCount)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        if (!isMounted) return;
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setUpcomingEvents(list);
        setLoading(false);
      },
      (err) => {
        if (!isMounted) return;
        console.error("Error fetching upcoming events:", err);
        setLoading(false);
      }
    );
    return () => { isMounted = false; unsub(); };
  }, [limitCount]);

  return { upcomingEvents, loading };
};
