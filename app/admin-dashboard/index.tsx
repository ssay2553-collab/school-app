import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SHADOWS } from "../../constants/theme";
import { getTeacherClasses } from "../../lib/classHelpers";
import { AdminHeader } from "../../components/admin-dashboard/AdminHeader";
import { AdminEventStats } from "../../components/admin-dashboard/AdminEventStats";
import { AdminMenuCard } from "../../components/admin-dashboard/AdminMenuCard";
import { useAdminDashboard } from "../../hooks/admin-dashboard/useAdminDashboard";

let lastDashboardScrollY = 0;

export default function AdminDashboard() {
  const {
    router,
    appUser,
    authLoading,
    totalUnread,
    upcomingEvents,
    eventsLoading,
    refreshing,
    brandPrimary,
    brandSecondary,
    surface,
    numColumns,
    cardWidth,
    isSmallScreen,
  } = useAdminDashboard();

  const scrollRef = useRef<ScrollView>(null);
  const isNavigating = useRef(false);

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
        ...(appUser?.role?.toLowerCase() !== "teacher"
          ? [
              {
                title: "Student Fees",
                subtitle: "Billing center",
                route: "/admin-dashboard/ManageFees",
                icon: "cash",
                color: "#f59e0b",
              },
              {
                title: "Student Charges",
                subtitle: "PTA, Uniform, Books",
                route: "/admin-dashboard/StudentCharges",
                icon: "card",
                color: "#6366f1",
              },
              {
                title: "Daily Financials",
                subtitle: "Feeding, Bus & Extra fees",
                route: "/shared/daily-financials",
                icon: "receipt",
                color: "#10b981",
              },
              {
                title: "Financial Summary",
                subtitle: "Reports & Analytics",
                route: "/admin-dashboard/FinancialSummary",
                icon: "analytics",
                color: "#4F46E5",
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
          route: "/teacher-dashboard/manage-timetable",
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
          subtitle: "Staff Messaging",
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
            onRefresh={() => {}}
          />
        }
      >
        <AdminHeader
          brandPrimary={brandPrimary}
          brandSecondary={brandSecondary}
          appUser={appUser}
          isSmallScreen={isSmallScreen}
          onProfilePress={() => router.push("/admin-dashboard/settings")}
          onSettingsPress={() => router.push("/admin-dashboard/settings")}
          onTeacherDashboardPress={() => router.push("/teacher-dashboard")}
          showTeacherButton={
            appUser?.role === "admin" &&
            (appUser?.assignedRoles?.includes("Teacher") ||
              getTeacherClasses(appUser).length > 0)
          }
        >
          <AdminEventStats
            upcomingEvents={upcomingEvents}
            loading={eventsLoading}
            brandPrimary={brandPrimary}
            onViewAll={() => router.push("/academic-calendar")}
            onEventPress={() => router.push("/academic-calendar")}
          />
        </AdminHeader>

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
                  {section.items.map((item, iIndex) => (
                    <AdminMenuCard
                      key={item.title}
                      item={item}
                      index={sIndex * 4 + iIndex}
                      cardWidth={cardWidth}
                      isSmallScreen={isSmallScreen}
                      numColumns={numColumns}
                      totalUnread={totalUnread}
                      onPress={() => {
                        if (isNavigating.current) return;
                        isNavigating.current = true;
                        router.push(item.route as any);
                        setTimeout(() => { isNavigating.current = false; }, 500);
                      }}
                    />
                  ))}
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
});
