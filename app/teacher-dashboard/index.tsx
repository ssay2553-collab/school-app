import { useRouter } from "expo-router";
import {
    collection,
    getCountFromServer,
    onSnapshot,
    query,
    where,
} from "firebase/firestore";
import moment from "moment";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import { AdminEventStats } from "../../components/admin-dashboard/AdminEventStats";
import DashboardHeader from "../../components/DashboardHeader";
import StationaryBackground from "../../components/StationaryBackground";
import SVGIcon from "../../components/SVGIcon";
import { MetroTile } from "../../components/teacher-dashboard/MetroTile";
import { useSchoolConfig } from "../../constants/Config";
import { isFeatureEnabled } from "../../constants/tierPermissions";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebaseConfig";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";
import { useDataFreshness } from "../../hooks/useDataFreshness";
import { useSchoolOperations } from "../../hooks/useSchoolOperations";
import useUnreadCounts from "../../hooks/useUnreadCounts";
import { useUpcomingEvents } from "../../hooks/useUpcomingEvents";
import { getTeacherClasses } from "../../lib/classHelpers";

export default function TeacherDashboard() {
  const router = useRouter();
  const { appUser, firebaseUser, loading: authLoading } = useAuth();
  const acadConfig = useAcademicConfig();
  const config = useSchoolConfig();
  const { width: windowWidth } = useWindowDimensions();

  const [assignmentCount, setAssignmentCount] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const { totalUnread, submissionUnread, assignmentUnread } = useUnreadCounts();
  const { upcomingEvents, loading: eventsLoading } = useUpcomingEvents(2);
  const { getOperationalStatus } = useSchoolOperations();

  // Attendance Alert Logic
  const [missingAttendance, setMissingAttendance] = useState<string[]>([]);
  const [isAlertVisible, setIsAlertVisible] = useState(false);
  const isNavigating = useRef(false);
  const isMounted = useRef(true);

  const teacherClasses = useMemo(() => getTeacherClasses(appUser), [appUser]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!appUser?.uid || teacherClasses.length === 0) return;

    const opStatus = getOperationalStatus();
    const isWeekend = moment().day() === 0 || moment().day() === 6;

    if (opStatus.isBlocked || isWeekend) {
      setMissingAttendance([]);
      setIsAlertVisible(false);
      return;
    }

    const today = moment().format("YYYY-MM-DD");
    const q = query(
      collection(db, "attendance"),
      where("date", "==", today),
      where("classId", "in", teacherClasses.slice(0, 30)),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const currentOpStatus = getOperationalStatus();
        const currentIsWeekend = moment().day() === 0 || moment().day() === 6;

        if (currentOpStatus.isBlocked || currentIsWeekend) {
          setMissingAttendance([]);
          setIsAlertVisible(false);
          return;
        }

        const markedClassIds = snap.docs.map((d) => d.data().classId);
        const unmarked = teacherClasses.filter(
          (id) => !markedClassIds.includes(id),
        );

        const now = new Date();
        const hour = now.getHours();
        const inTimeWindow = hour >= 6 && hour < 10;

        setMissingAttendance(unmarked);
        setIsAlertVisible(unmarked.length > 0 && inTimeWindow);
      },
      (err) => {
        if (err.code === "permission-denied") return;
        console.error("Attendance alert listener error:", err);
      },
    );

    return () => unsub();
  }, [appUser?.uid, teacherClasses, getOperationalStatus]);

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
      if (e.code === "permission-denied") return;
      console.error("Error fetching teacher stats:", e);
    }
  }, [appUser?.uid, firebaseUser]);

  useDataFreshness(
    useCallback(async () => {
      await fetchStats();
    }, [fetchStats]),
    {
      refreshOnFocus: true,
      minRefreshInterval: 10000,
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

  // Well-Balanced Categorization to Prevent Overcrowding
  const rawSections = useMemo(
    () => [
      {
        id: "classroom",
        title: "CLASSROOM HUB",
        color: "#00838F", // Warm Deep Teal
        items: [
          {
            title: "Students Attendance",
            subtitle: "Daily tracking",
            route: "/teacher-dashboard/daily-attendance",
            icon: "checkmark-done-circle",
            color: "#2E7D32", // Warm Emerald Green
            isWide: true,
          },
          {
            title: "Timetable",
            subtitle: "My schedule",
            route: "/teacher-dashboard/teacher-timetable",
            icon: "calendar",
            color: "#1565C0", // Warm Royal Sapphire
            featureId: "teacher_timetable",
          },
          {
            title: "My Classes",
            subtitle: "Set subjects",
            route: "/teacher-dashboard/profile-edit?focus=work",
            icon: "book",
            color: "#E65100", // Warm Terracotta
            featureId: "teacher_my_classes",
          },
          ...(isAssignedTeacher && (hasFinancialAccess || canEditFinancials)
            ? [
                {
                  title: "Daily Financials",
                  subtitle: "Feeding, Bus & Extra",
                  route: "/shared/daily-financials",
                  icon: "receipt",
                  color: "#00838F", // Warm Teal
                },
              ]
            : []),
          {
            title: "Staff Attendance",
            subtitle: "GPS Check-In",
            route: "/shared/scan-attendance",
            icon: "checkmark-done-circle",
            color: "#388E3C", // Warm Forest Green
            featureId: "teacher_staff_attendance",
          },
          {
            title: "Student Profiles",
            subtitle: "Edit Student Info",
            route: "/teacher-dashboard/manage-students",
            icon: "person",
            color: "#D84315", // Warm Coral
            isWide: true,
            featureId: "teacher_student_profile",
          },
        ],
      },
      {
        id: "academics",
        title: "ACADEMICS & GRADING",
        color: "#D84315", // Warm Coral
        items: [
          {
            title: "Term Records",
            subtitle: "Manage grades",
            route: "/teacher-dashboard/student-academic-records",
            icon: "library",
            color: "#4527A0", // Warm Deep Violet
          },
          {
            title: "Behavioral Remarks",
            subtitle: "Conduct logs",
            route: "/teacher-dashboard/preschool-remarks",
            icon: "chatbubble-ellipses",
            color: "#0277BD", // Warm Ocean Blue
          },
          {
            title: "Exam Reports",
            subtitle: "Approved reports",
            route: "/teacher-dashboard/student-academic-report",
            icon: "document-text",
            color: "#2E7D32", // Warm Emerald
          },
          {
            title: "Grading",
            subtitle: "Mark work",
            route: "/teacher-dashboard/mark-assignment",
            icon: "create",
            color: "#C62828", // Warm Crimson
            featureId: "teacher_grading",
          },
          {
            title: "Assignments",
            subtitle: "Manage & Upload",
            route: "/teacher-dashboard/manage-assignments",
            icon: "document-text",
            color: "#AD1457", // Warm Mulberry
            isWide: true,
            featureId: "teacher_assignments",
          },
        ],
      },
      {
        id: "resources",
        title: "LESSONS & RESOURCES",
        color: "#6A1B9A", // Warm Plum
        items: [
          {
            title: "Weekly Topics",
            subtitle: "Lesson Planning",
            route: "/teacher-dashboard/weekly-topics",
            icon: "book",
            color: "#C62828", // Warm Crimson
            isWide: true,
            featureId: "teacher_weekly_topics",
          },
          {
            title: "My Notes",
            subtitle: "Scratchpad",
            route: "/teacher-dashboard/note",
            icon: "document-text",
            color: "#6A1B9A", // Warm Plum
            featureId: "teacher_note",
          },
          {
            title: "Coding & Robotics",
            subtitle: "Robotics & Projects",
            route: "/coding-robotics",
            icon: "code-slash",
            color: "#5E35B1", // Warm Violet
            featureId: "teacher_coding_robotics",
          },
          {
            title: "Curriculum PDFs",
            subtitle: "Offline library",
            route: "/teacher-dashboard/curriculum-pdf-viewer",
            icon: "document-text",
            color: "#1565C0", // Warm Royal Blue
            featureId: "teacher_curriculum_pdf",
          },
          {
            title: "Pedagogy & Resources",
            subtitle: "Exam links & guides",
            route: "/teacher-dashboard/pedagogy",
            icon: "bulb",
            color: "#E65100", // Warm Terracotta
            isWide: true,
            featureId: "teacher_pedagogy_resources",
          },
        ],
      },
      {
        id: "communication",
        title: "COMMUNICATION & CAMPUS",
        color: "#F57F17", // Warm Gold
        items: [
          {
            title: "Parent Chat",
            subtitle: "Direct comms",
            route: "/teacher-dashboard/chat-with-parent",
            icon: "chatbubble-ellipses",
            color: "#00838F", // Warm Teal
            featureId: "teacher_parent_chat",
          },
          {
            title: "Staff Chat",
            subtitle: "Staff Messaging",
            route: "/teacher-dashboard/staff-chat",
            icon: "chatbubbles",
            color: "#1565C0", // Warm Royal Blue
            isWide: true,
            featureId: "teacher_staff_chat",
          },
          {
            title: "Study Groups",
            subtitle: "Collaborations",
            route: "/teacher-dashboard/create-student-group",
            icon: "chatbubbles",
            color: "#00838F", // Warm Deep Teal
            featureId: "teacher_study_group",
          },
          {
            title: "Broadcasts",
            subtitle: "School news",
            route: "/teacher-dashboard/news-screen",
            icon: "megaphone",
            color: "#C62828", // Warm Crimson
            featureId: "teacher_broadcasts",
          },
          {
            title: "Calendar",
            subtitle: "Events & Terms",
            route: "/academic-calendar",
            icon: "calendar-outline",
            color: "#E65100", // Warm Terracotta
          },
        ],
      },
    ],
    [isAssignedTeacher, hasFinancialAccess, canEditFinancials],
  );

  const categories = useMemo(
    () => [
      { id: "ALL", label: "All Tools" },
      { id: "classroom", label: "Classroom" },
      { id: "academics", label: "Academics" },
      { id: "resources", label: "Lessons & Resources" },
      { id: "communication", label: "Campus & Comms" },
    ],
    [],
  );

  const filteredSections = useMemo(() => {
    return rawSections
      .map((section) => {
        if (selectedCategory !== "ALL" && section.id !== selectedCategory) {
          return null;
        }

        let enabledItems = section.items.filter(
          (item) =>
            !item.featureId ||
            isFeatureEnabled(acadConfig.category, item.featureId),
        );

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          enabledItems = enabledItems.filter(
            (item) =>
              item.title.toLowerCase().includes(q) ||
              item.subtitle.toLowerCase().includes(q),
          );
        }

        return {
          ...section,
          items: enabledItems,
        };
      })
      .filter(
        (section) =>
          section !== null && section.items.length > 0,
      ) as {
        id: string;
        title: string;
        color: string;
        items: any[];
      }[];
  }, [rawSections, selectedCategory, searchQuery, acadConfig.category]);

  if (authLoading || !appUser) {
    return (
      <View style={[styles.center, { backgroundColor: surface }]}>
        <ActivityIndicator size="large" color={brandPrimary} />
      </View>
    );
  }

  // Calculate Windows 8 Tile Dimensions
  const getColumns = () => {
    if (windowWidth >= 1200) return 6;
    if (windowWidth >= 900) return 4;
    if (windowWidth >= 600) return 4;
    return 2;
  };

  const numColumns = getColumns();
  const gap = 10;
  const sidePadding = 20;
  const totalGapSpace = (numColumns - 1) * gap;
  const availableWidth = Math.min(1200, windowWidth) - sidePadding * 2;
  const unitTileWidth = (availableWidth - totalGapSpace) / numColumns;
  const tileHeight = 105;
  const isSmallScreen = windowWidth < 380;

  return (
    <View style={[styles.container, { backgroundColor: "#FFFDF5" }]}>
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
              iterationCount={3}
              style={styles.attendanceAlertBanner}
            >
              <View style={styles.alertLeft}>
                <SVGIcon name="alert-circle" size={20} color="#fff" />
                <View>
                  <Text style={styles.alertTitle}>Attendance Missing!</Text>
                  <Text style={styles.alertSubtitle}>
                    {missingAttendance.length}{" "}
                    {missingAttendance.length === 1 ? "class" : "classes"}{" "}
                    remaining for today.
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.alertActionBtn}
                onPress={() =>
                  router.push("/teacher-dashboard/daily-attendance")
                }
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

        {/* WINDOWS 8 WARM METRO START TILES GRID WITH QUICK NAV */}
        <View style={styles.contentContainer}>
          <View style={styles.content}>
            {/* SEARCH & CATEGORY FILTER BAR */}
            <View style={styles.navBarContainer}>
              <View style={styles.searchBox}>
                <SVGIcon name="search" size={18} color="#94A3B8" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search tools & features..."
                  placeholderTextColor="#94A3B8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <SVGIcon name="close-circle" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryScroll}
              >
                {categories.map((cat) => {
                  const active = selectedCategory === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryChip,
                        active && {
                          backgroundColor: brandPrimary,
                          borderColor: brandPrimary,
                        },
                      ]}
                      onPress={() => setSelectedCategory(cat.id)}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          active && { color: "#FFFFFF", fontWeight: "900" },
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {filteredSections.length === 0 ? (
              <View style={styles.emptySearchContainer}>
                <SVGIcon name="search-outline" size={40} color="#CBD5E1" />
                <Text style={styles.emptySearchTitle}>No matching tools found</Text>
                <Text style={styles.emptySearchSub}>
                  Try clearing your search or switching categories.
                </Text>
                <TouchableOpacity
                  style={[styles.resetSearchBtn, { backgroundColor: brandPrimary }]}
                  onPress={() => {
                    setSearchQuery("");
                    setSelectedCategory("ALL");
                  }}
                >
                  <Text style={styles.resetSearchText}>Show All Tools</Text>
                </TouchableOpacity>
              </View>
            ) : (
              filteredSections.map((section, sIndex) => (
                <View key={section.title} style={{ marginBottom: 35 }}>
                  <View style={styles.sectionHeader}>
                    <View
                      style={[
                        styles.sectionBar,
                        { backgroundColor: section.color },
                      ]}
                    />
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                    <View style={styles.countBadge}>
                      <Text style={styles.countBadgeText}>{section.items.length}</Text>
                    </View>
                  </View>

                  <View style={styles.metroGrid}>
                    {section.items.map((item, iIndex) => {
                      const isWideTile = Boolean(item.isWide && numColumns > 1);
                      const calcWidth = isWideTile
                        ? unitTileWidth * 2 + gap
                        : unitTileWidth;

                      return (
                        <MetroTile
                          key={item.title}
                          item={item}
                          index={sIndex * 4 + iIndex}
                          tileWidth={calcWidth}
                          tileHeight={tileHeight}
                          totalUnread={totalUnread}
                          submissionUnread={submissionUnread}
                          assignmentUnread={assignmentUnread}
                          onPress={() => {
                            if (isNavigating.current || !item.route) return;
                            isNavigating.current = true;
                            router.push(item.route as any);
                            setTimeout(() => {
                              isNavigating.current = false;
                            }, 500);
                          }}
                        />
                      );
                    })}
                  </View>
                </View>
              ))
            )}
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
    marginTop: 20,
    width: "100%",
    maxWidth: 1200,
  },
  navBarContainer: {
    marginBottom: 20,
    gap: 12,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
    ...SHADOWS.medium,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1E293B",
    fontWeight: "600",
    padding: 0,
  },
  categoryScroll: {
    paddingVertical: 4,
    gap: 8,
    alignItems: "center",
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.medium,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 10,
  },
  sectionBar: {
    width: 4,
    height: 18,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#2D3748",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  countBadge: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
  },
  metroGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  emptySearchContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptySearchTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1E293B",
    marginTop: 12,
  },
  emptySearchSub: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 16,
  },
  resetSearchBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  resetSearchText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  attendanceAlertBanner: {
    backgroundColor: "rgba(229, 20, 0, 0.85)",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    ...SHADOWS.medium,
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
    textTransform: "uppercase",
  },
  alertSubtitle: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 11,
    fontWeight: "700",
  },
  alertActionBtn: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  alertActionText: {
    color: "#E51400",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
});
