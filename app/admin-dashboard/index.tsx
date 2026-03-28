import AsyncStorage from "@react-native-async-storage/async-storage";
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
    Dimensions,
    Image,
    Platform,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import { SafeAreaView } from "react-native-safe-area-context";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebaseConfig";

const { width } = Dimensions.get("window");
const STATS_CACHE_KEY = "@admin_dashboard_stats_cache_v2";
// Persistence variables outside the component to survive re-mounts
let dashboardStatsMemoryCache: any = null;
let lastDashboardScrollY = 0;

type Stats = {
  totalStudents: number;
  totalStaff: number;
  loading: boolean;
};

export default function AdminDashboard() {
  const router = useRouter();
  const { appUser, loading: authLoading } = useAuth();
  const scrollRef = useRef<ScrollView>(null);

  // Added fallbacks for Android stability
  const primary = SCHOOL_CONFIG.primaryColor || COLORS.primary || "#2e86de";
  const secondary = SCHOOL_CONFIG.secondaryColor || primary;
  const surface = SCHOOL_CONFIG.surfaceColor || "#FFFFFF";

  const [stats, setStats] = useState<Stats>(
    (dashboardStatsMemoryCache as Stats) || {
      totalStudents: 0,
      totalStaff: 0,
      loading: true,
    },
  );
  const [refreshing, setRefreshing] = useState(false);
  // Restore scroll position on mount
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

  const fetchStats = useCallback(async (force = false) => {
    if (!force && dashboardStatsMemoryCache) {
      return;
    }

    if (!force) {
      const cached = await AsyncStorage.getItem(STATS_CACHE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const data = parsed?.data;
          if (data) {
            const newStats = { ...data, loading: false };
            setStats(newStats);
            dashboardStatsMemoryCache = newStats;
            return;
          }
        } catch (e) {
          console.log("Cache parse error", e);
        }
      }
    }

    try {
      if (force) setRefreshing(true);
      else if (!dashboardStatsMemoryCache)
        setStats((prev: Stats) => ({ ...prev, loading: true }));

      const studentsQuery = query(
        collection(db, "users"),
        where("role", "==", "student"),
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
        totalStudents: studentsSnap.data().count || 0,
        totalStaff:
          (teacherSnap.data().count || 0) + (ntSnap.data().count || 0),
      };

      const finalStats = { ...data, loading: false };
      setStats(finalStats);
      dashboardStatsMemoryCache = finalStats;
      await AsyncStorage.setItem(
        STATS_CACHE_KEY,
        JSON.stringify({ data, timestamp: Date.now() }),
      );
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      setStats((prev: Stats) => ({ ...prev, loading: false }));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats(false);
  }, [fetchStats]);

  const onRefresh = () => {
    fetchStats(true);
  };

  const sections = [
    {
      title: "Organization",
      items: [
        {
          title: "User Directory",
          route: "/admin-dashboard/manage-users",
          icon: "people",
          color: "#6366f1",
        },
        {
          title: "Class Registry",
          route: "/admin-dashboard/create-class",
          icon: "school",
          color: "#8b5cf6",
        },
        {
          title: "Access Tokens",
          route: "/admin-dashboard/generate-code",
          icon: "key",
          color: "#ec4899",
        },
        {
          title: "Attendance",
          route: "/admin-dashboard/attendance-overview",
          icon: "checkmark-circle",
          color: "#10b981",
        },
      ],
    },
    {
      title: "Finance",
      items: [
        {
          title: "Student Fees",
          route: "/admin-dashboard/ManageFees",
          icon: "cash",
          color: "#f59e0b",
        },
        {
          title: "Expenses",
          route: "/admin-dashboard/expenditure",
          icon: "trending-down",
          color: "#ef4444",
        },
        {
          title: "Payroll",
          route: "/admin-dashboard/staff-payroll",
          icon: "wallet",
          color: "#0ea5e9",
        },
      ],
    },
    {
      title: "Academics",
      items: [
        {
          title: "Student Results",
          route: "/admin-dashboard/view-academic-records",
          icon: "library",
          color: "#6366f1",
        },
        {
          title: "Edit Scores",
          route: "/admin-dashboard/EditStudentScores",
          icon: "create",
          color: "#06b6d4",
        },
        {
          title: "Timetables",
          route: "/admin-dashboard/CreateLessonTimetable",
          icon: "calendar",
          color: "#84cc16",
        },
        {
          title: "Academic Calendar",
          route: "/academic-calendar",
          icon: "calendar-outline",
          color: "#f97316",
        },
      ],
    },
    {
      title: "Media & Communication",
      items: [
        {
          title: "Announcements",
          route: "/admin-dashboard/news",
          icon: "megaphone",
          color: "#f43f5e",
        },
        {
          title: "Parent Chat",
          route: "/admin-dashboard/chat-with-parent",
          icon: "chatbubble-ellipses",
          color: "#3b82f6",
        },
        {
          title: "Guest Inquiries",
          route: "/admin-dashboard/guest-chat",
          icon: "chatbubbles",
          color: "#14b8a6",
        },
        {
          title: "Media Library",
          route: "/admin-dashboard/gallery-upload",
          icon: "images",
          color: "#a855f7",
        },
        {
          title: "FAQ & Help",
          route: "/admin-dashboard/FAQEditor",
          icon: "help-circle",
          color: "#eab308",
        },
      ],
    },
  ];

  if (authLoading) {
    return (
      <View style={[styles.center, { backgroundColor: surface }]}>
        <ActivityIndicator size="large" color={primary} />
      </View>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: surface }]}
      edges={["bottom", "left", "right"]}
    >
      <StatusBar barStyle="light-content" />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
            colors={[primary]}
          />
        }
        contentContainerStyle={styles.scrollContent}
        removeClippedSubviews={Platform.OS === "android"}
      >
        <LinearGradient
          colors={[primary, secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerTop}>
            <View style={styles.headerProfileInfo}>
              <TouchableOpacity
                onPress={() => router.push("/admin-dashboard/settings")}
                style={styles.profileAvatarBox}
              >
                {appUser?.profile?.profileImage ? (
                  <Image
                    source={{ uri: appUser.profile.profileImage }}
                    style={styles.profileImg}
                  />
                ) : (
                  <View style={styles.profilePlaceholder}>
                    <Text style={styles.profilePlaceholderText}>
                      {appUser?.profile?.firstName?.[0] || "A"}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <View>
                <Text style={styles.welcomeText}>DASHBOARD</Text>
                <Text style={styles.adminName}>
                  {appUser?.profile?.firstName || "Admin"}
                </Text>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>
                    {appUser?.adminRole || "Super Admin"}
                  </Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/admin-dashboard/settings")}
              style={styles.settingsBtn}
            >
              <SVGIcon name="settings-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.statsGrid}>
            <Animatable.View
              animation={dashboardStatsMemoryCache ? undefined : "fadeInLeft"}
              duration={800}
              style={[
                styles.statCard,
                { backgroundColor: "rgba(255,255,255,0.15)" },
              ]}
            >
              <View
                style={[
                  styles.statIconBox,
                  { backgroundColor: COLORS.yellow || "#f1c40f" },
                ]}
              >
                <SVGIcon name="people" size={20} color="#fff" />
              </View>
              <View>
                <Text style={styles.statLabel}>STUDENTS</Text>
                <Text style={styles.statValue}>
                  {stats.loading && !refreshing
                    ? "--"
                    : stats.totalStudents || 0}
                </Text>
              </View>
            </Animatable.View>
            <Animatable.View
              animation={dashboardStatsMemoryCache ? undefined : "fadeInRight"}
              duration={800}
              style={[
                styles.statCard,
                { backgroundColor: "rgba(255,255,255,0.15)" },
              ]}
            >
              <View
                style={[
                  styles.statIconBox,
                  { backgroundColor: COLORS.success || "#05ac5b" },
                ]}
              >
                <SVGIcon name="briefcase" size={20} color="#fff" />
              </View>
              <View>
                <Text style={styles.statLabel}>STAFF</Text>
                <Text style={styles.statValue}>
                  {stats.loading && !refreshing ? "--" : stats.totalStaff || 0}
                </Text>
              </View>
            </Animatable.View>
          </View>
        </LinearGradient>

        <View style={styles.mainContent}>
          {sections.map((section, sIndex) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={styles.grid}>
                {section.items.map((item, index) => (
                  <Animatable.View
                    key={item.title}
                    animation={dashboardStatsMemoryCache ? undefined : "zoomIn"}
                    duration={400}
                    delay={sIndex * 100 + index * 50}
                    style={styles.gridItemWrapper}
                  >
                    <TouchableOpacity
                      style={styles.gridItem}
                      onPress={() => router.push(item.route as any)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.itemIconBox,
                          { backgroundColor: (item.color || "#000") + "10" },
                        ]}
                      >
                        <SVGIcon
                          name={item.icon}
                          size={26}
                          color={item.color}
                        />
                      </View>
                      <Text style={styles.itemTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                    </TouchableOpacity>
                  </Animatable.View>
                ))}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.footerSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { paddingBottom: 40 },
  header: {
    paddingTop: Platform.OS === "ios" ? 20 : 50,
    paddingHorizontal: 25,
    paddingBottom: 45,
    borderBottomLeftRadius: 45,
    borderBottomRightRadius: 45,
    ...SHADOWS.medium,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 35,
  },
  headerProfileInfo: { flexDirection: "row", gap: 15, alignItems: "center" },
  profileAvatarBox: {
    width: 60,
    height: 60,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  profileImg: { width: "100%", height: "100%" },
  profilePlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  profilePlaceholderText: { color: "#fff", fontSize: 24, fontWeight: "bold" },
  welcomeText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  adminName: { color: "#fff", fontSize: 22, fontWeight: "900", marginTop: 2 },
  roleBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 5,
    alignSelf: "flex-start",
  },
  roleBadgeText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  settingsBtn: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  statsGrid: { flexDirection: "row", gap: 15, marginTop: 20 },
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
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontWeight: "bold",
  },
  statValue: { color: "#fff", fontSize: 18, fontWeight: "900" },
  mainContent: { paddingHorizontal: 20, paddingTop: 30 },
  section: { marginBottom: 30 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.text || "#1f2937",
    marginBottom: 15,
    letterSpacing: 1,
    opacity: 0.6,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -8 },
  gridItemWrapper: { width: "50%", padding: 8 },
  gridItem: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    alignItems: "center",
    ...SHADOWS.small,
  },
  itemIconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text || "#1f2937",
  },
  footerSpace: { height: 40 },
});
