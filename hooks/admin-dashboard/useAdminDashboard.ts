import { useState, useEffect, useCallback, useRef } from "react";
import { useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { useAuth } from "../../contexts/AuthContext";
import { useSchoolConfig } from "../../constants/Config";
import useUnreadCounts from "../useUnreadCounts";
import { useDataFreshness } from "../useDataFreshness";
import { COLORS } from "../../constants/theme";

export const useAdminDashboard = () => {
  const router = useRouter();
  const { appUser, loading: authLoading } = useAuth();
  const config = useSchoolConfig();
  const { width: windowWidth } = useWindowDimensions();
  const { totalUnread } = useUnreadCounts();

  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const brandPrimary = config.brandPrimary || COLORS.primary || "#6366F1";
  const brandSecondary = config.brandSecondary || config.secondaryColor || "#4338ca";
  const surface = config.surfaceColor || "#F8FAFC";

  useEffect(() => {
    let isMounted = true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const q = query(
      collection(db, "academic_calendar"),
      where("date", ">=", Timestamp.fromDate(today)),
      orderBy("date", "asc"),
      limit(2)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        if (!isMounted) return;
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setUpcomingEvents(list);
        setEventsLoading(false);
      },
      (err) => {
        if (!isMounted) return;
        console.error("Error fetching upcoming events:", err);
        setEventsLoading(false);
      }
    );
    return () => { isMounted = false; unsub(); };
  }, []);

  const { refresh } = useDataFreshness(
    useCallback(async () => {
      // Real-time via onSnapshot
    }, []),
    {
      refreshOnFocus: true,
      minRefreshInterval: 10000,
    }
  );

  const getColumns = () => {
    if (windowWidth >= 1200) return 5;
    if (windowWidth >= 900) return 4;
    if (windowWidth >= 600) return 3;
    return 2;
  };

  const numColumns = getColumns();
  const gap = 12;
  const sidePadding = 20;
  const totalGapSpace = (numColumns - 1) * gap;
  const availableWidth = Math.min(1200, windowWidth) - sidePadding * 2;
  const cardWidth = (availableWidth - totalGapSpace) / numColumns;
  const isSmallScreen = windowWidth < 380;

  return {
    router,
    appUser,
    authLoading,
    config,
    windowWidth,
    totalUnread,
    upcomingEvents,
    eventsLoading,
    refreshing,
    setRefreshing,
    brandPrimary,
    brandSecondary,
    surface,
    numColumns,
    cardWidth,
    isSmallScreen,
  };
};
