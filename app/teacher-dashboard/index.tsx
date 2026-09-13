import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  collection,
  getCountFromServer,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import { SafeAreaView } from "react-native-safe-area-context";
import SVGIcon from "../../components/SVGIcon";
import UnreadBadge from "../../components/UnreadBadge";
import { useSchoolConfig } from "../../constants/Config";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebaseConfig";
import { useDataFreshness } from "../../hooks/useDataFreshness";
import useUnreadCounts from "../../hooks/useUnreadCounts";
import { getTeacherClasses } from "../../lib/classHelpers";
import moment from "moment";
import { AdminEventStats } from "../../components/admin-dashboard/AdminEventStats";
import { AdminMenuCard } from "../../components/admin-dashboard/AdminMenuCard";
import DashboardHeader from "../../components/DashboardHeader";
import StationaryBackground from "../../components/StationaryBackground";
import { useUpcomingEvents } from "../../hooks/useUpcomingEvents";

export default function TeacherDashboard() {
  const router = useRouter();
  const { appUser, firebaseUser, loading: authLoading } = useAuth();
  const config = useSchoolConfig();
  const { width: windowWidth } = useWindowDimensions();

  const [assignmentCount, setAssignmentCount] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { totalUnread, submissionUnread } = useUnreadCounts();
  const { upcomingEvents, loading: eventsLoading } = useUpcomingEvents(2);

  // Attendance Alert Logic
  const [missingAttendance, setMissingAttendance] = useState<string[]>([]);
  const [isAlertVisible, setIsAlertVisible] = useState(false);
  const isNavigating = useRef(false);
  const isMounted = useRef(true);

  const teacherClasses = useMemo(() => getTeacherClasses(appUser), [appUser]);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (!appUser?.uid || teacherClasses.length === 0) return;

    const today = moment().format("YYYY-MM-DD");
    const q = query(
      collection(db, "attendance"),
      where("date", "==", today),
      where("classId", "in", teacherClasses.slice(0, 30))
    );

    const unsub = onSnapshot(q, (snap) => {
      const markedClassIds = snap.docs.map(d => d.data().classId);
      const unmarked = teacherClasses.filter(id => !markedClassIds.includes(id));

      // Check time window (6 AM - 10 AM)
      const now = new Date();
      const hour = now.getHours();
      const inTimeWindow = hour >= 6 && hour < 10;

      setMissingAttendance(unmarked);
      setIsAlertVisible(unmarked.length > 0 && inTimeWindow);
    }, (err) => {
      // Ignore permission errors during sign-out
      if (err.code === 'permission-denied') return;
      console.error("Attendance alert listener error:", err);
    });

    return () => unsub();
  }, [appUser?.uid, teacherClasses]);

  const brandPrimary = config.brandPrimary || COLORS.primary || "#6366F1";
  const brandSecondary =
    config.brandSecondary || config.secondaryColor || "#4338ca";
  const surface = config.surfaceColor || "#F8FAFC";

  const isAdmin = appUser?.role === "admin";
  const canFeeding =
    appUser?.permissions?.["feeding"] === "full" ||
    appUser?.permissions?.["feeding"] === "edit" ||
    appUser?.permissions?.["feeding"] === "view";
  const canBus =
    appUser?.permissions?.["record-bus-fee"] === "full" ||
    appUser?.permissions?.["record-bus-fee"] === "edit" ||
    appUser?.permissions?.["record-bus-fee"] === "view";
  const canExtraClasses =
    appUser?.permissions?.["record-extra-classes"] === "full" ||
    appUser?.permissions?.["record-extra-classes"] === "edit" ||
    appUser?.permissions?.["record-extra-classes"] === "view";
  const hasFinancialAccess = isAdmin || canFeeding || canBus || canExtraClasses;
  const canEditFinancials =
    appUser?.permissions?.["feeding"] === "full" ||
    appUser?.permissions?.["feeding"] === "edit" ||
    appUser?.permissions?.["record-bus-fee"] === "full" ||
    appUser?.permissions?.["record-bus-fee"] === "edit" ||
    appUser?.permissions?.["record-extra-classes"] === "full" ||
    appUser?.permissions?.["record-extra-classes"] === "edit";

  const fetchStats = useCallback(async () => {
    const teacherUid = appUser?.uid || firebaseUser?.uid;
    if (!teacherUid || !firebaseUser) return;
    try {
      const q = query(
        collection(db, "assignments"),
        where("teacherId", "==", teacherUid),
      );
      const snap = await getCountFromServer(q);
      if (isMounted.current && firebaseUser) {
        setAssignmentCount(snap.data().count);
      }
    } catch (e: any) {
      // Ignore permission errors during sign-out
      if (e.code === 'permission-denied') return;
      console.error("Error fetching teacher stats:", e);
    }
  }, [appUser?.uid, firebaseUser]);

  // Use data freshness hook to refresh on focus/visibility change
  const { refresh } = useDataFreshness(
    useCallback(async () => {
      await fetchStats();
    }, [fetchStats]),
    {
      refreshOnFocus: true,
      minRefreshInterval: 10000, // 10 seconds
      clearMemoryCache: true,
    },
  );

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  }, [fetchStats]);

  const isAssignedTeacher = getTeacherClasses(appUser).length > 0;

  const sections = [
    {
      title: "CLASSROOM HUB 🏫",
      color: brandPrimary,
      items: [
        {
          title: "Attendance",
          subtitle: "Daily tracking",
          route: "/teacher-dashboard/daily-attendance",
          icon: "checkmark-done-circle",
          color: "#10b981",
        },
        {
          title: "My Classes",
          subtitle: "Set subjects",
          route: "/teacher-dashboard/profile-edit?focus=work",
          icon: "book",
          color: "#F59E0B",
        },
        ...(isAssignedTeacher && (hasFinancialAccess || canEditFinancials)
          ? [
              {
                title: "Daily Financials",
                subtitle: "Feeding, Bus & Extra fees",
                route: "/shared/daily-financials",
                icon: "receipt",
                color: "#10b981",
              },
            ]
          : []),
        {
          title: "Timetable",
          subtitle: "My schedule",
          route: "/teacher-dashboard/teacher-timetable",
          icon: "calendar",
          color: "#f59e0b",
        },
        {
          title: "Tokens",
          subtitle: "Student codes",
          route: "/teacher-dashboard/generate-student-code",
          icon: "key",
          color: "#ec4899",
        },

        {
          title: "My Notes",
          subtitle: "Scratchpad",
          route: "/teacher-dashboard/note",
          icon: "document-text",
          color: "#6366f1",
        },
        {
          title: "Weekly Topics",
          subtitle: "Lesson Planning",
          route: "/teacher-dashboard/weekly-topics",
          icon: "book",
          color: "#f59e0b",
        },
      ],
    },
    {
      title: "TEACHING TOOLS 🍎",
      color: "#A55EEA",
      items: [
        {
          title: "Term Records",
          subtitle: "Manage grades",
          route: "/teacher-dashboard/student-academic-records",
          icon: "library",
          color: "#8b5cf6",
        },
        {
          title: "Behavioral Remarks",
          subtitle: "Child conduct logs",
          route: "/teacher-dashboard/preschool-remarks",
          icon: "chatbubble-ellipses",
          color: "#10b981",
        },
        {
          title: "Assignments",
          subtitle: "Manage & Upload",
          route: "/teacher-dashboard/manage-assignments",
          icon: "document-text",
          color: "#a855f7",
        },
        {
          title: "Grading",
          subtitle: "Mark work",
          route: "/teacher-dashboard/mark-assignment",
          icon: "create",
          color: "#ef4444",
        },
        {
          title: "Study Groups",
          subtitle: "Collaborations",
          route: "/teacher-dashboard/create-student-group",
          icon: "chatbubbles",
          color: "#06b6d4",
        },
        {
          title: "TLM Hub",
          subtitle: "Materials",
          route: "/teacher-dashboard/tlm-hub",
          icon: "library",
          color: "#f59e0b",
        },
        {
          title: "Coding & Robotics",
          subtitle: "Robotics & Projects",
          route: "/coding-robotics",
          icon: "code-slash",
          color: "#6366f1",
        },
      ],
    },
    {
      title: "CAMPUS LIFE 📣",
      color: "#FFD93D",
      items: [
        {
          title: "Calendar",
          subtitle: "Events & Terms",
          route: "/academic-calendar",
          icon: "calendar-outline",
          color: "#f97316",
        },
        {
          title: "Broadcasts",
          subtitle: "School news",
          route: "/teacher-dashboard/news-screen",
          icon: "megaphone",
          color: "#f43f5e",
        },
        {
          title: "Staff Chat",
          subtitle: "Staff Messaging",
          route: "/teacher-dashboard/staff-chat",
          icon: "chatbubbles",
          color: "#6366f1",
        },
        {
          title: "Parent Chat",
          subtitle: "Direct comms",
          route: "/teacher-dashboard/chat-with-parent",
          icon: "chatbubble-ellipses",
          color: "#3b82f6",
        },
      ],
    },
  ];

  if (authLoading || !appUser) {
    return (
      <View style={[styles.center, { backgroundColor: surface }]}>
        <ActivityIndicator size="large" color={brandPrimary} />
      </View>
    );
  }

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

  return (
    <View style={[styles.container, { backgroundColor: "#FDFCF0" }]}>
      <StationaryBackground />
      <StatusBar barStyle="light-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <DashboardHeader
          brandPrimary={brandPrimary}
          brandSecondary={brandSecondary}
          appUser={appUser}
          isSmallScreen={isSmallScreen}
          welcomeText="GOOD DAY, EDUCATOR! 🍎"
          roleTag="Teacher"
          onProfilePress={() => router.push("/teacher-dashboard/profile-edit")}
          onSettingsPress={() => router.push("/teacher-dashboard/settings")}
          onAdminDashboardPress={() => router.push("/admin-dashboard")}
          showAdminButton={appUser?.role === "admin"}
        >
          {isAlertVisible && (
            <Animatable.View
              animation="pulse"
              iterationCount="infinite"
              style={styles.attendanceAlertBanner}
            >
              <View style={styles.alertLeft}>
                <SVGIcon name="alert-circle" size={20} color="#fff" />
                <View>
                  <Text style={styles.alertTitle}>Attendance Missing!</Text>
                  <Text style={styles.alertSubtitle}>
                    {missingAttendance.length} {missingAttendance.length === 1 ? 'class' : 'classes'} remaining for today.
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.alertActionBtn}
                onPress={() => router.push("/teacher-dashboard/daily-attendance")}
              >
                <Text style={styles.alertActionText}>MARK NOW</Text>
              </TouchableOpacity>
            </Animatable.View>
          )}

          <AdminEventStats
            upcomingEvents={upcomingEvents}
            loading={eventsLoading}
            brandPrimary={brandPrimary}
            onViewAll={() => router.push("/academic-calendar")}
            onEventPress={() => router.push("/academic-calendar")}
          />
        </DashboardHeader>

        <View style={styles.contentContainer}>
          <View style={styles.content}>
            {sections.map((section, sIndex) => (
              <View key={section.title} style={{ marginBottom: 40 }}>
                <View style={styles.sectionHeader}>
                  <View
                    style={[styles.dot, { backgroundColor: section.color }]}
                  />
                  <Text style={[styles.sectionTitle, { color: section.color }]}>
                    {section.title}
                  </Text>
                </View>
                <View style={styles.grid}>
                  {section.items.map((item, iIndex) =>
                    <AdminMenuCard
                      key={item.title}
                      item={item}
                      index={sIndex * 4 + iIndex}
                      cardWidth={cardWidth}
                      isSmallScreen={isSmallScreen}
                      numColumns={numColumns}
                      totalUnread={totalUnread}
                      onPress={() => {
                        if (isNavigating.current || !item.route) return;
                        isNavigating.current = true;
                        router.push(item.route as any);
                        setTimeout(() => { isNavigating.current = false; }, 500);
                      }}
                    />
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { flexGrow: 1 },
  contentContainer: { alignItems: "center", width: "100%" },
  content: {
    paddingHorizontal: 20,
    marginTop: 25,
    width: "100%",
    maxWidth: 1100,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 12,
    paddingHorizontal: 10,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  sectionTitle: { fontSize: 18, fontWeight: "900", letterSpacing: 0.5 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
  },
  attendanceAlertBanner: {
    backgroundColor: "rgba(255, 217, 61, 0.3)", // Soft yellow/gold semi-transparent
    borderRadius: 18,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.4)",
    ...SHADOWS.small,
  },
  alertLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  alertTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
  },
  alertSubtitle: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 10,
    fontWeight: "700",
  },
  alertActionBtn: {
    backgroundColor: "#FFD93D",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  alertActionText: {
    color: "#4338ca",
    fontSize: 10,
    fontWeight: "900",
  },
});
