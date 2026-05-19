import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  collection,
  getCountFromServer,
  query,
  where,
} from "firebase/firestore";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
  View
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

const STATS_CACHE_KEY = "@admin_dashboard_stats_cache_v2";
let dashboardStatsMemoryCache: any = null;
let lastDashboardScrollY = 0;

// Cache bust timestamp - cleared when tab regains focus
let cacheBustTimestamp = Date.now();

type Stats = {
  totalStudents: number;
  totalStaff: number;
  loading: boolean;
};

export default function AdminDashboard() {
  const router = useRouter();
  const { appUser, loading: authLoading } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const config = useSchoolConfig();
  const { width: windowWidth } = useWindowDimensions();

  const brandPrimary = config.brandPrimary || COLORS.primary || "#6366F1";
  const brandSecondary =
    config.brandSecondary || config.secondaryColor || "#4338ca";
  const surface = config.surfaceColor || "#F8FAFC";

  const [stats, setStats] = useState<Stats>(
    (dashboardStatsMemoryCache as Stats) || {
      totalStudents: 0,
      totalStaff: 0,
      loading: true,
    },
  );
  const [refreshing, setRefreshing] = useState(false);
  const { totalUnread } = useUnreadCounts();

  useEffect(() => {
    if (lastDashboardScrollY > 0) {
      const timer = setTimeout(() => {
        scrollRef.current?.scrollTo({
          y: lastDashboardScrollY,
          animated: false,
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleScroll = (event: any) => {
    lastDashboardScrollY = event.nativeEvent.contentOffset.y;
  };

  const fetchStats = useCallback(
    async (force = false) => {
      if (!force && dashboardStatsMemoryCache) return;

      try {
        if (force) setRefreshing(true);
        else if (!dashboardStatsMemoryCache)
          setStats((prev: Stats) => ({ ...prev, loading: true }));

        const schoolId = config.schoolId;
        const studentsQuery = query(
          collection(db, "users"),
          where("role", "==", "student"),
          where("status", "in", ["active", "pending_activation"]),
        );
        const teacherQuery = query(
          collection(db, "users"),
          where("role", "==", "teacher"),
        );
        const ntQuery = query(collection(db, "nonTeachingStaff"));

        const [studentsSnap, teacherSnap, ntSnap] = await Promise.all([
          getCountFromServer(studentsQuery),
          getCountFromServer(teacherQuery),
          getCountFromServer(ntQuery),
        ]);

        const data = {
          totalStudents: (studentsSnap.data() as any).count || 0,
          totalStaff:
            ((teacherSnap.data() as any).count || 0) +
            ((ntSnap.data() as any).count || 0),
        };

        setStats({ ...data, loading: false });
        dashboardStatsMemoryCache = { ...data, loading: false };
      } catch (error) {
        setStats((prev: Stats) => ({ ...prev, loading: false }));
      } finally {
        setRefreshing(false);
      }
    },
    [config.schoolId],
  );

  // Use data freshness hook to refresh on focus/visibility change
  const { refresh } = useDataFreshness(
    useCallback(async () => {
      // Clear memory cache when refreshing
      dashboardStatsMemoryCache = null;
      await fetchStats(true);
    }, [fetchStats]),
    {
      refreshOnFocus: true,
      minRefreshInterval: 10000, // 10 seconds
      clearMemoryCache: true,
    },
  );

  // Listen for cache clear events
  useEffect(() => {
    const handleClearCache = () => {
      dashboardStatsMemoryCache = null;
      cacheBustTimestamp = Date.now();
    };

    if (Platform.OS === "web") {
      window.addEventListener("edueaz:clearMemoryCache", handleClearCache);
      window.addEventListener("edueaz:clearAllCaches", handleClearCache);
    }

    return () => {
      if (Platform.OS === "web") {
        window.removeEventListener("edueaz:clearMemoryCache", handleClearCache);
        window.removeEventListener("edueaz:clearAllCaches", handleClearCache);
      }
    };
  }, []);

  useEffect(() => {
    fetchStats(false);
  }, [fetchStats]);

  const sections = [
    {
      title: "SCHOOL OPS 🏫",
      color: brandPrimary,
      items: [
        {
          title: "User Directory",
          subtitle: "Manage people",
          route: "/admin-dashboard/manage-users",
          icon: "people",
          color: "#6366f1",
        },
        {
          title: "Class Registry",
          subtitle: "Setup classes",
          route: "/admin-dashboard/create-class",
          icon: "school",
          color: "#8b5cf6",
        },
        {
          title: "Access Tokens",
          subtitle: "Signup codes",
          route: "/admin-dashboard/generate-code",
          icon: "key",
          color: "#ec4899",
        },
        {
          title: "Attendance",
          subtitle: "Daily logs",
          route: "/admin-dashboard/attendance-overview",
          icon: "checkmark-circle",
          color: "#10b981",
        },
        {
          title: "Teacher Stats",
          subtitle: "Performance",
          route: "/admin-dashboard/teacher-statistics",
          icon: "analytics",
          color: "#f59e0b",
        },
      ],
    },
    {
      title: "FINANCE HUB 💰",
      color: "#10b981",
      items: [
        {
          title: "Daily Financials",
          subtitle: "Money tracking",
          route: "/admin-dashboard/DailyFinancials",
          icon: "calculator",
          color: "#10b981",
        },
        ...(appUser?.role?.toLowerCase() !== "teacher"
          ? [
              {
                title: "Student Fees",
                subtitle: "Billing center",
                route: "/admin-dashboard/ManageFees",
                icon: "cash",
                color: "#f59e0b",
              },
            ]
          : []),
        {
          title: "Expenses",
          subtitle: "Outflow logs",
          route: "/admin-dashboard/expenditure",
          icon: "trending-down",
          color: "#ef4444",
        },
        {
          title: "Payroll",
          subtitle: "Staff salaries",
          route: "/admin-dashboard/staff-payroll",
          icon: "wallet",
          color: "#0ea5e9",
        },
      ],
    },
    {
      title: "ACADEMIC MGMT 🎓",
      color: "#A55EEA",
      items: [
        {
          title: "Groups",
          subtitle: "Collaborations",
          route: "/teacher-dashboard/create-student-group",
          icon: "chatbubbles",
          color: "#06b6d4",
        },
        {
          title: "Results",
          subtitle: "View records",
          route: "/admin-dashboard/view-academic-records",
          icon: "library",
          color: "#6366f1",
        },
        {
          title: "Edit Scores",
          subtitle: "Score correction",
          route: "/admin-dashboard/EditStudentScores",
          icon: "create",
          color: "#06b6d4",
        },
        {
          title: "Timetables",
          subtitle: "Schedules",
          route: "/admin-dashboard/CreateLessonTimetable",
          icon: "calendar",
          color: "#84cc16",
        },
        {
          title: "Calendar",
          subtitle: "Events & Terms",
          route: "/academic-calendar",
          icon: "calendar-outline",
          color: "#f97316",
        },
      ],
    },
    {
      title: "COMMUNICATION 📣",
      color: "#FFD93D",
      items: [
        {
          title: "Announcements",
          subtitle: "Post news",
          route: "/admin-dashboard/news",
          icon: "megaphone",
          color: "#f43f5e",
        },
        {
          title: "Staff Chat",
          subtitle: "Internal",
          route: "/admin-dashboard/staff-chat",
          icon: "chatbubbles",
          color: "#6366f1",
        },
        {
          title: "Parent Chat",
          subtitle: "Parent comms",
          route: "/admin-dashboard/chat-with-parent",
          icon: "chatbubble-ellipses",
          color: "#3b82f6",
        },
        {
          title: "Guest Inquiry",
          subtitle: "Public chats",
          route: "/admin-dashboard/guest-chat",
          icon: "chatbubbles",
          color: "#14b8a6",
        },
        {
          title: "Media Library",
          subtitle: "Photo gallery",
          route: "/admin-dashboard/gallery-upload",
          icon: "images",
          color: "#a855f7",
        },
        {
          title: "FAQ & Help",
          subtitle: "Manage help",
          route: "/admin-dashboard/FAQEditor",
          icon: "help-circle",
          color: "#eab308",
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
    return (
      <Animatable.View
        animation="bounceIn"
        duration={800}
        delay={index * 50}
        key={item.title}
        style={[styles.cardWrapper, { width: cardWidth }]}
      >
        <TouchableOpacity
          style={[styles.menuCard, { borderBottomColor: item.color + "40" }]}
          onPress={() => router.push(item.route as any)}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={["#FFFFFF", item.color + "05"]}
            style={styles.cardGradient}
          >
            <View
              style={[
                styles.iconBox,
                {
                  backgroundColor: item.color + "20",
                  width: isSmallScreen ? 50 : 60,
                  height: isSmallScreen ? 50 : 60,
                  borderRadius: isSmallScreen ? 18 : 22,
                },
              ]}
            >
              <SVGIcon
                name={item.icon}
                size={numColumns > 3 ? 36 : isSmallScreen ? 26 : 30}
                color={item.color}
              />
            </View>
            <View style={styles.cardInfo}>
              <Text
                style={[styles.menuText, { fontSize: isSmallScreen ? 13 : 15 }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {item.title}
              </Text>
              <Text
                style={[
                  styles.menuSubtitle,
                  { color: item.color, fontSize: isSmallScreen ? 9 : 10 },
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
          </LinearGradient>
        </TouchableOpacity>
      </Animatable.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: "#FDFCF0" }]}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchStats(true)}
          />
        }
      >
        <LinearGradient
          colors={[brandPrimary, brandSecondary]}
          style={styles.header}
        >
          <View style={styles.blob1} />
          <View style={styles.blob2} />

          <SafeAreaView edges={["top"]}>
            <View style={styles.headerRow}>
              <View style={styles.adminInfo}>
                <TouchableOpacity
                  onPress={() => router.push("/admin-dashboard/settings")}
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
                        {appUser?.profile?.firstName?.[0] || "A"}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
                <View style={{ marginLeft: isSmallScreen ? 10 : 15, flex: 1 }}>
                  <Text style={styles.welcomeText}>
                    WELCOME BACK, CHIEF! 🛡️
                  </Text>
                  <Text
                    style={[
                      styles.adminName,
                      { fontSize: isSmallScreen ? 24 : 32 },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {appUser?.profile?.firstName || "Admin"}
                  </Text>

                  <View style={styles.roleBadge}>
                    <SVGIcon name="shield-checkmark" size={12} color="#fff" />
                    <Text style={styles.roleBadgeText}>
                      {appUser?.adminRole || "Super Admin"}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.headerActions}>
                {appUser?.role === "admin" &&
                  (appUser?.assignedRoles?.includes("Teacher") ||
                    appUser?.classTeacherOf) && (
                    <TouchableOpacity
                      onPress={() => router.push("/teacher-dashboard")}
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
                      <SVGIcon name="school" size={20} color="#fff" />
                      <Text
                        style={{
                          color: "#fff",
                          fontSize: 10,
                          fontWeight: "900",
                        }}
                      >
                        TEACHER
                      </Text>
                    </TouchableOpacity>
                  )}
                <TouchableOpacity
                  onPress={() => router.push("/admin-dashboard/settings")}
                  style={styles.actionBtn}
                >
                  <SVGIcon name="settings-outline" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.statsGrid}>
              <View
                style={[
                  styles.statCard,
                  { backgroundColor: "rgba(255,255,255,0.15)" },
                ]}
              >
                <View
                  style={[styles.statIconBox, { backgroundColor: "#FFD93D" }]}
                >
                  <SVGIcon name="people" size={18} color="#4338ca" />
                </View>
                <View>
                  <Text style={styles.statLabel}>STUDENTS</Text>
                  <Text style={styles.statValue}>
                    {stats.loading ? "--" : stats.totalStudents}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.statCard,
                  { backgroundColor: "rgba(255,255,255,0.15)" },
                ]}
              >
                <View
                  style={[styles.statIconBox, { backgroundColor: "#6BCB77" }]}
                >
                  <SVGIcon name="briefcase" size={18} color="#fff" />
                </View>
                <View>
                  <Text style={styles.statLabel}>TOTAL STAFF</Text>
                  <Text style={styles.statValue}>
                    {stats.loading ? "--" : stats.totalStaff}
                  </Text>
                </View>
              </View>
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
  adminInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
  welcomeText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "900",
    letterSpacing: 1,
  },
  adminName: { fontSize: 32, fontWeight: "900", color: "#fff", marginTop: 2 },
  roleBadge: {
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
  roleBadgeText: {
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
    ...SHADOWS.small,
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
    backgroundColor: "#fff",
    borderRadius: 24,
    overflow: "hidden",
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: "#E2E8F0",
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
    ...SHADOWS.small,
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
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: "hidden",
  },
  badgePos: { position: "absolute", top: 15, right: 15 },
});
