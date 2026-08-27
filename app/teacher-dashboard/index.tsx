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
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  Alert as RNAlert,
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

export default function TeacherDashboard() {
  const router = useRouter();
  const { appUser, firebaseUser, loading: authLoading } = useAuth();
  const config = useSchoolConfig();
  const { width: windowWidth } = useWindowDimensions();

  const [assignmentCount, setAssignmentCount] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { totalUnread, submissionUnread } = useUnreadCounts();

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
    if (!teacherUid) return;
    try {
      const q = query(
        collection(db, "assignments"),
        where("teacherId", "==", teacherUid),
      );
      const snap = await getCountFromServer(q);
      if (isMounted.current) {
        setAssignmentCount(snap.data().count);
      }
    } catch (e) {
      console.error("Error fetching teacher stats:", e);
    }
  }, [appUser?.uid, firebaseUser?.uid]);

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
          route: { pathname: "/teacher-dashboard/profile-edit", params: { focus: "work" } } as any,
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
      title: "CAMPUS LIFE 🌳",
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

  const isSmallScreen = windowWidth < 380;

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

  const renderItem = (item: any, index: number) => {
    if (item.hidden) return null;

    return (
      <Animatable.View
        animation="bounceIn"
        duration={800}
        delay={index * 50}
        key={item.title}
        style={[styles.cardWrapper, { width: cardWidth }]}
      >
        <TouchableOpacity
          style={[styles.menuCard, { borderBottomColor: "rgba(0,0,0,0.1)" }]}
          onPress={() => {
            if (isNavigating.current || !item.route) return;
            isNavigating.current = true;
            router.push(item.route as any);
            setTimeout(() => { isNavigating.current = false; }, 500);
          }}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[item.color, item.color]}
            style={styles.cardGradient}
          >
            <View
              style={[
                styles.iconBox,
                {
                  backgroundColor: "rgba(255,255,255,0.2)",
                  width: isSmallScreen ? 50 : 60,
                  height: isSmallScreen ? 50 : 60,
                  borderRadius: isSmallScreen ? 18 : 22,
                },
              ]}
            >
              <SVGIcon
                name={item.icon}
                size={numColumns > 3 ? 36 : isSmallScreen ? 26 : 30}
                color="#FFFFFF"
              />
            </View>
            <View style={styles.cardInfo}>
              <Text
                style={[
                  styles.menuText,
                  { fontSize: isSmallScreen ? 13 : 15, color: "#FFFFFF" },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {item.title}
              </Text>
              <Text
                style={[
                  styles.menuSubtitle,
                  {
                    color: "rgba(255,255,255,0.8)",
                    fontSize: isSmallScreen ? 9 : 10,
                  },
                ]}
                numberOfLines={1}
              >
                {item.subtitle}
              </Text>
            </View>
            {item.route &&
            (String(item.route).includes("chat") ||
              String(item.route).includes("group")) &&
            totalUnread > 0 ? (
              <View style={styles.badgePos}>
                <UnreadBadge count={totalUnread} />
              </View>
            ) : null}
            {item.title === "Grading" && submissionUnread > 0 ? (
              <View style={styles.badgePos}>
                <UnreadBadge count={submissionUnread} />
              </View>
            ) : null}
          </LinearGradient>
        </TouchableOpacity>
      </Animatable.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: "#FDFCF0" }]}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <LinearGradient
          colors={[brandPrimary, brandSecondary]}
          style={styles.header}
        >
          <View style={styles.blob1} />
          <View style={styles.blob2} />

          <SafeAreaView edges={["top"]}>
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

            <View style={styles.headerRow}>
              <View style={styles.teacherInfo}>
                <TouchableOpacity
                  onPress={() => router.push("/teacher-dashboard/profile-edit")}
                  style={[
                    styles.profileBtn,
                    {
                      width: isSmallScreen ? 60 : 80,
                      height: isSmallScreen ? 60 : 80,
                      borderRadius: isSmallScreen ? 30 : 40,
                    },
                  ]}
                >
                  {appUser?.profile?.profileImage ? (
                    <Image
                      source={{ uri: appUser.profile.profileImage }}
                      style={styles.profileImg}
                    />
                  ) : (
                    <View style={styles.profilePlaceholder}>
                      <Text
                        style={[
                          styles.profilePlaceholderText,
                          { fontSize: isSmallScreen ? 24 : 32 },
                        ]}
                      >
                        {appUser?.profile?.firstName?.[0] || "T"}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
                <View style={{ marginLeft: isSmallScreen ? 10 : 15, flex: 1 }}>
                  <Text style={styles.welcomeText}>GOOD DAY, EDUCATOR! 🍎</Text>
                  <Text
                    style={[
                      styles.teacherName,
                      { fontSize: isSmallScreen ? 24 : 32 },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {appUser?.profile?.firstName || "Instructor"}
                  </Text>

                  <View style={styles.statusBadge}>
                    <SVGIcon name="checkmark-seal" size={12} color="#fff" />
                    <Text style={styles.statusBadgeText}>ACTIVE PORTAL</Text>
                  </View>
                </View>
              </View>

              <View style={styles.headerActions}>
                {appUser?.role === "admin" && (
                  <TouchableOpacity
                    onPress={() => router.push("/admin-dashboard")}
                    style={[
                      styles.actionBtn,
                      {
                        width: "auto",
                        paddingHorizontal: 10,
                        flexDirection: "row",
                        gap: 6,
                      },
                    ]}
                  >
                    <SVGIcon name="shield-checkmark" size={20} color="#fff" />
                    <Text
                      style={{ color: "#fff", fontSize: 10, fontWeight: "900" }}
                    >
                      ADMIN
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => router.push("/teacher-dashboard/settings")}
                  style={styles.actionBtn}
                >
                  <SVGIcon name="settings-outline" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.statsGrid}>
              <TouchableOpacity
                onPress={() => router.push("/teacher-dashboard/manage-assignments")}
                style={[
                  styles.statCard,
                  { backgroundColor: "rgba(255,255,255,0.15)" },
                ]}
              >
                <View
                  style={[styles.statIconBox, { backgroundColor: "#FFD93D" }]}
                >
                  <SVGIcon name="document-text" size={18} color="#4338ca" />
                </View>
                <View>
                  <Text style={styles.statLabel}>POSTED TASKS</Text>
                  <Text style={styles.statValue}>{assignmentCount ?? "0"}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push({ pathname: "/teacher-dashboard/profile-edit", params: { focus: "work" } })}
                style={[
                  styles.statCard,
                  { backgroundColor: "rgba(255,255,255,0.15)" },
                ]}
              >
                <View
                  style={[styles.statIconBox, { backgroundColor: "#6BCB77" }]}
                >
                  <SVGIcon name="people" size={18} color="#fff" />
                </View>
                <View>
                  <Text style={styles.statLabel}>CLASSES</Text>
                  <Text style={styles.statValue}>
                    {getTeacherClasses(appUser).length}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </LinearGradient>

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
                    renderItem(item, sIndex * 4 + iIndex),
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
  header: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: "hidden",
    ...SHADOWS.medium,
  },
  blob1: {
    position: "absolute",
    top: -20,
    right: -20,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  blob2: {
    position: "absolute",
    bottom: -40,
    left: -30,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Platform.OS === "web" ? 20 : 0,
  },
  teacherInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
  welcomeText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "900",
    letterSpacing: 1,
  },
  teacherName: { fontSize: 32, fontWeight: "900", color: "#fff", marginTop: 2 },
  statusBadge: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 8,
    alignSelf: "flex-start",
    alignItems: "center",
    gap: 6,
  },
  statusBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  profileBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#fff",
    overflow: "hidden",
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.5)",
    ...SHADOWS.medium,
  },
  profileImg: { width: "100%", height: "100%" },
  profilePlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  profilePlaceholderText: { color: "#4338ca", fontWeight: "900", fontSize: 32 },
  headerActions: { flexDirection: "row", gap: 10, alignItems: "center" },
  actionBtn: {
    height: 44,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
    marginTop: 25,
    paddingHorizontal: 5,
  },
  statCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 15,
    borderRadius: 20,
  },
  statIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  statLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  statValue: { color: "#fff", fontSize: 20, fontWeight: "900" },
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
  cardWrapper: { marginBottom: 10 },
  menuCard: {
    borderRadius: 24,
    overflow: "hidden",
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    borderBottomWidth: 4,
    minHeight: 130,
    width: "100%",
  },
  cardGradient: {
    flex: 1,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBox: {
    width: 65,
    height: 65,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  cardInfo: { alignItems: "center" },
  menuText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1E293B",
    textAlign: "center",
  },
  menuSubtitle: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: "hidden",
  },
  badgePos: { position: "absolute", top: 15, right: 15 },
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
