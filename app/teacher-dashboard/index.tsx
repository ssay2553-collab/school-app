import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  collection,
  getCountFromServer,
  query,
  where,
} from "firebase/firestore";
import React, { useCallback, useEffect, useState } from "react";
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

export default function TeacherDashboard() {
  const router = useRouter();
  const { appUser, loading: authLoading } = useAuth();
  const config = useSchoolConfig();
  const { width: windowWidth } = useWindowDimensions();

  const [assignmentCount, setAssignmentCount] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { totalUnread, submissionUnread } = useUnreadCounts();

  const brandPrimary = config.brandPrimary || COLORS.primary || "#6366F1";
  const brandSecondary =
    config.brandSecondary || config.secondaryColor || "#4338ca";
  const surface = config.surfaceColor || "#F8FAFC";

  const isAdmin = appUser?.role === "admin";
  const canFeeding =
    appUser?.permissions?.["feeding"] === "full" ||
    appUser?.permissions?.["feeding"] === "edit";
  const canBus =
    appUser?.permissions?.["record-bus-fee"] === "full" ||
    appUser?.permissions?.["record-bus-fee"] === "edit";
  const hasFinancialAccess = isAdmin || canFeeding || canBus;

  const fetchStats = useCallback(async () => {
    if (!appUser?.uid) return;
    try {
      const q = query(
        collection(db, "assignments"),
        where("teacherId", "==", appUser.uid),
      );
      const snap = await getCountFromServer(q);
      setAssignmentCount(snap.data().count);
    } catch (e) {
      console.error("Error fetching teacher stats:", e);
    }
  }, [appUser?.uid]);

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

  const sections = [
    {
      title: "CLASSROOM HUB 🏫",
      color: brandPrimary,
      items: [
        {
          title: "Student List",
          subtitle: "Profiles & Info",
          route: "/teacher-dashboard/students-list",
          icon: "people",
          color: "#6366f1",
        },
        {
          title: "Attendance",
          subtitle: "Daily tracking",
          route: "/teacher-dashboard/daily-attendance",
          icon: "checkmark-done-circle",
          color: "#10b981",
        },
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
          title: "Daily Financials",
          subtitle: "Fee recording",
          route: "/admin-dashboard/DailyFinancials",
          icon: "calculator",
          color: "#10b981",
          hidden: !hasFinancialAccess,
        },
        {
          title: "My Notes",
          subtitle: "Scratchpad",
          route: "/teacher-dashboard/note",
          icon: "document-text",
          color: "#6366f1",
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
          title: "Class Remarks",
          subtitle: "Conduct logs",
          route: "/teacher-dashboard/behavioral-records",
          icon: "chatbubble-ellipses",
          color: "#10b981",
        },
        {
          title: "Assignments",
          subtitle: "Upload tasks",
          route: "/teacher-dashboard/upload-assignment",
          icon: "cloud-upload",
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
          title: "Pedagogy",
          subtitle: "Curriculum",
          route: "/teacher-dashboard/pedagogy-vault",
          icon: "briefcase",
          color: "#10b981",
        },
        {
          title: "AI Planner",
          subtitle: "Lesson aid",
          route: "/teacher-dashboard/ai-lesson-planner",
          icon: "sparkles",
          color: "#8b5cf6",
        },
        {
          title: "AI Search",
          subtitle: "Fact finder",
          route: "/ai-search",
          icon: "search",
          color: "#0ea5e9",
        },
        {
          title: "Coding Hub",
          subtitle: "Robotics & AI",
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
          title: "School Gallery",
          subtitle: "Memories",
          route: "/teacher-dashboard/gallery",
          icon: "images",
          color: "#8b5cf6",
        },
        {
          title: "Staff Chat",
          subtitle: "Internal",
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
          style={[styles.menuCard, { borderBottomColor: item.color + "40" }]}
          onPress={() => item.route && router.push(item.route as any)}
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
            <View style={styles.headerRow}>
              <View style={styles.teacherInfo}>
                <TouchableOpacity
                  onPress={() => router.push("/teacher-dashboard/settings")}
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
              <View
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
                  <SVGIcon name="people" size={18} color="#fff" />
                </View>
                <View>
                  <Text style={styles.statLabel}>CLASSES</Text>
                  <Text style={styles.statValue}>
                    {appUser?.classes?.length ||
                      (appUser?.classTeacherOf ? 1 : 0)}
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
