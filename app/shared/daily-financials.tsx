import { useRouter } from "expo-router";
import {
  collection,
  getDocsFromServer,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import moment from "moment";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { db } from "../../firebaseConfig";
import { sortClasses, getTeacherClasses } from "../../lib/classHelpers";

const { width } = Dimensions.get("window");

const VIBE = {
  primary: "#4F46E5",
  secondary: "#F59E0B",
  success: "#10B981",
  info: "#0EA5E9",
  purple: "#8B5CF6",
  bg: "#F1F5F9",
  surface: "#FFFFFF",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
  cardBg: "#FFFFFF",
};

type CategoryStats = {
  feeding: number;
  bus: number;
  extraClasses: number;
  totalStudents: number;
  recordedToday: number;
};

type BusLocationGroup = {
  location: string;
  count: number;
  students: string[];
};

export default function DailyFinancials() {
  const router = useRouter();
  const { appUser } = useAuth();
  const { showToast } = useToast();

  const isTeacherRole = appUser?.role === "teacher";

  // ACCESS CONTROL LOGIC
  const currentUserRole = appUser?.adminRole?.toLowerCase() || "";
  const isSuperAdmin = [
    "proprietor",
    "proprietress",
    "manager",
    "headmaster",
    "headmistress",
    "administrator",
    "director",
    "accountant",
    "bursar",
    "admin",
    "super admin",
    "superadmin",
  ].includes(currentUserRole);

  const feedingPermission = appUser?.permissions?.["feeding"] || "deny";
  const busFeePermission = appUser?.permissions?.["record-bus-fee"] || "deny";
  const extraClassesPermission =
    appUser?.permissions?.["record-extra-classes"] || "deny";

  const canView =
    isSuperAdmin ||
    feedingPermission !== "deny" ||
    busFeePermission !== "deny" ||
    extraClassesPermission !== "deny";

  const canViewFeeding =
    isSuperAdmin || feedingPermission !== "deny";
  const canViewBus =
    isSuperAdmin || busFeePermission !== "deny";
  const canViewExtraClasses =
    isSuperAdmin || extraClassesPermission !== "deny";

  const handleBack = () => {
    if (appUser?.role === "admin") {
      router.replace("/admin-dashboard");
    } else if (appUser?.role === "teacher") {
      router.replace("/teacher-dashboard");
    } else if (appUser?.role === "staff") {
      router.replace("/staff-dashboard");
    } else {
      router.back();
    }
  };

  useEffect(() => {
    if (appUser && !canView) {
      showToast({
        message:
          "Access Denied: You do not have permission to view Daily Financials.",
        type: "error",
      });
      handleBack();
    }
  }, [appUser, canView]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Determine initial class selection and assigned classes
  const teacherClasses = useMemo(() => {
    return getTeacherClasses(appUser);
  }, [appUser]);

  const [selectedClassId, setSelectedClassId] = useState<string>(
    !isSuperAdmin && teacherClasses.length > 0 ? "all" : "all"
  );
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);

  // Derived effective class IDs for queries
  const effectiveClassIds = useMemo(() => {
    if (isSuperAdmin) {
      return selectedClassId === "all" ? [] : [selectedClassId];
    }
    // For teachers/staff, if "all" is selected, use all their assigned classes
    return selectedClassId === "all" ? teacherClasses : [selectedClassId];
  }, [isSuperAdmin, selectedClassId, teacherClasses]);

  const [stats, setStats] = useState<CategoryStats>({
    feeding: 0,
    bus: 0,
    extraClasses: 0,
    totalStudents: 0,
    recordedToday: 0,
  });
  const [busLocations, setBusLocations] = useState<BusLocationGroup[]>([]);

  // Load classes
  useEffect(() => {
    const q = collection(db, "classes");
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        name: (d.data() as any).name || d.id,
      }));
      setClasses(sortClasses(list));
    });
    return () => unsub();
  }, []);

  // Load stats for selected date
  const loadStats = useCallback(async () => {
    try {
      const dateStr = moment(selectedDate).format("YYYY-MM-DD");

      // Build base query for students
      let studentQuery = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("status", "in", ["active", "pending_activation"]),
      );

      if (effectiveClassIds.length > 0) {
        if (effectiveClassIds.length === 1) {
          studentQuery = query(
            studentQuery,
            where("classId", "==", effectiveClassIds[0]),
          );
        } else {
          studentQuery = query(
            studentQuery,
            where("classId", "in", effectiveClassIds),
          );
        }
      } else if (!isSuperAdmin) {
        // If not super admin and no classes assigned, stats are zero
        setStats({
          feeding: 0,
          bus: 0,
          extraClasses: 0,
          totalStudents: 0,
          recordedToday: 0,
        });
        setBusLocations([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const studentSnap = await getDocsFromServer(studentQuery as any);
      const students = studentSnap.docs.map((d) => d.data() as any);

      // Count students by category
      const feedingCount = students.filter((s) => s.isFeeding).length;
      const busCount = students.filter((s) => s.takesBus).length;
      const extraClassesCount = students.filter(
        (s) => s.takesExtraClasses,
      ).length;

      // Get today's records
      let recordsQuery = query(
        collection(db, "dailyFinancials"),
        where("date", "==", dateStr),
      );

      if (effectiveClassIds.length > 0) {
        if (effectiveClassIds.length === 1) {
          recordsQuery = query(
            recordsQuery,
            where("classId", "==", effectiveClassIds[0]),
          );
        } else {
          recordsQuery = query(
            recordsQuery,
            where("classId", "in", effectiveClassIds),
          );
        }
      }

      const recordsSnap = await getDocsFromServer(recordsQuery as any);
      const recordedToday = recordsSnap.docs.length;

      // Get bus locations grouping
      const locationMap = new Map<string, string[]>();
      students
        .filter((s) => s.takesBus)
        .forEach((s) => {
          const loc = s.busLocation || "No Location";
          if (!locationMap.has(loc)) {
            locationMap.set(loc, []);
          }
          locationMap
            .get(loc)!
            .push(
              `${s.profile?.firstName || ""} ${s.profile?.lastName || ""}`.trim(),
            );
        });

      const busLocGroups: BusLocationGroup[] = [];
      locationMap.forEach((studentsList, location) => {
        busLocGroups.push({
          location,
          count: studentsList.length,
          students: studentsList,
        });
      });
      busLocGroups.sort((a, b) => a.location.localeCompare(b.location));

      setStats({
        feeding: feedingCount,
        bus: busCount,
        extraClasses: extraClassesCount,
        totalStudents: students.length,
        recordedToday,
      });
      setBusLocations(busLocGroups);
    } catch (e) {
      console.error("Error loading stats:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate, selectedClassId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const canAccessStats = isSuperAdmin || teacherClasses.length > 0;

  const renderCategoryCard = (
    title: string,
    subtitle: string,
    count: number,
    icon: string,
    color: string,
    route: string,
    canAccess: boolean,
  ) => (
    <TouchableOpacity
      style={styles.categoryCard}
      onPress={() => router.push(route as any)}
      activeOpacity={0.7}
    >
      <View style={[styles.categoryIconBox, { backgroundColor: color + "10" }]}>
        <SVGIcon name={icon} size={28} color={color} />
      </View>
      <View style={styles.categoryInfo}>
        <Text style={styles.categoryTitle}>{title}</Text>
        <Text style={styles.categorySubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.categoryRight}>
        {isSuperAdmin && (
          <View style={styles.categoryBadge}>
            <Text style={[styles.categoryBadgeText, { color }]}>{count}</Text>
            <Text style={styles.categoryBadgeLabel}>Students</Text>
          </View>
        )}
        <View style={styles.chevronBox}>
          <SVGIcon name="chevron-forward" size={18} color={VIBE.muted} />
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderBusLocationCard = (group: BusLocationGroup) => (
    <TouchableOpacity
      key={group.location}
      style={styles.locationCard}
      onPress={() => router.push("/shared/bus-fees" as any)}
    >
      <View style={styles.locationIconBox}>
        <SVGIcon name="bus" size={20} color={VIBE.info} />
      </View>
      <View style={styles.locationInfo}>
        <Text style={styles.locationName}>{group.location}</Text>
        <Text style={styles.locationCount}>{group.count} students</Text>
      </View>
      <SVGIcon name="chevron-forward" size={18} color={VIBE.muted} />
    </TouchableOpacity>
  );

  if (!canView) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.errorContainer}>
          <SVGIcon
            name="lock-closed"
            size={60}
            color={COLORS.secondary || "#c53b59"}
          />
          <Text style={styles.errorTitle}>Access Denied</Text>
          <Text style={styles.errorSub}>
            You do not have the required permissions to view Daily Financials.
          </Text>
          <TouchableOpacity style={styles.errorButton} onPress={handleBack}>
            <Text style={styles.errorButtonText}>Return to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
        >
          <SVGIcon name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.headerTitleText}>Daily Financials</Text>
          <Text style={styles.headerSubtitle}>
            Record feeding, bus & extra classes fees
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowDatePicker(true)}
          style={styles.dateButton}
        >
          <SVGIcon name="calendar" size={20} color={COLORS.primary} />
          <Text style={styles.dateButtonText}>
            {moment(selectedDate).format("MMM DD")}
          </Text>
        </TouchableOpacity>
      </View>

      {showDatePicker && (
        <View style={styles.datePickerContainer}>
          {/* Simple date picker would go here - using platform default */}
        </View>
      )}

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await loadStats();
              }}
            />
          }
        >
          {/* Class Filter - Admin or assigned teacher */}
          {(isSuperAdmin || teacherClasses.length > 0) && (
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Filter by Class:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity
                  style={[
                    styles.classChip,
                    selectedClassId === "all" && {
                      backgroundColor: COLORS.primary,
                    },
                  ]}
                  onPress={() => setSelectedClassId("all")}
                >
                  <Text
                    style={[
                      styles.classChipText,
                      selectedClassId === "all" && { color: "#fff" },
                    ]}
                  >
                    {isSuperAdmin ? "All Classes" : "My Classes"}
                  </Text>
                </TouchableOpacity>
                {classes
                  .filter((c) => isSuperAdmin || teacherClasses.includes(c.id))
                  .map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.classChip,
                        selectedClassId === c.id && {
                          backgroundColor: COLORS.primary,
                        },
                      ]}
                      onPress={() => setSelectedClassId(c.id)}
                    >
                      <Text
                        style={[
                          styles.classChipText,
                          selectedClassId === c.id && { color: "#fff" },
                        ]}
                      >
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </ScrollView>
            </View>
          )}

          {/* Summary Stats - Admin or assigned teacher */}
          {canAccessStats && (
            <>
              <View style={styles.summaryRow}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>{stats.totalStudents}</Text>
                  <Text style={styles.summaryLabel}>Total Students</Text>
                </View>
                <View
                  style={[
                    styles.summaryCard,
                    { backgroundColor: VIBE.success + "08" },
                  ]}
                >
                  <Text style={[styles.summaryValue, { color: VIBE.success }]}>
                    {stats.feeding}
                  </Text>
                  <Text style={styles.summaryLabel}>Feeding</Text>
                </View>
                <View
                  style={[
                    styles.summaryCard,
                    { backgroundColor: VIBE.info + "08" },
                  ]}
                >
                  <Text style={[styles.summaryValue, { color: VIBE.info }]}>
                    {stats.bus}
                  </Text>
                  <Text style={styles.summaryLabel}>Bus</Text>
                </View>
                <View
                  style={[
                    styles.summaryCard,
                    { backgroundColor: VIBE.purple + "08" },
                  ]}
                >
                  <Text style={[styles.summaryValue, { color: VIBE.purple }]}>
                    {stats.extraClasses}
                  </Text>
                  <Text style={styles.summaryLabel}>Extra Classes</Text>
                </View>
              </View>

              <View
                style={[
                  styles.summaryCard,
                  {
                    marginHorizontal: 16,
                    marginBottom: 16,
                    marginTop: 16,
                    backgroundColor: VIBE.primary + "08",
                  },
                ]}
              >
                <Text style={[styles.summaryValue, { color: VIBE.primary }]}>
                  {stats.recordedToday}
                </Text>
                <Text style={styles.summaryLabel}>Recorded Today</Text>
              </View>
            </>
          )}

          {/* Category Cards - Only show categories user has permission for */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fee Categories</Text>
            <Text style={styles.sectionSubtitle}>
              Select a category to record fees
            </Text>

            {/* Feeding Fees - only if user has permission */}
            {canViewFeeding &&
              renderCategoryCard(
                "Feeding Fees",
                "Daily meal fees",
                stats.feeding,
                "restaurant",
                VIBE.success,
                "/shared/feeding-fees",
                true,
              )}

            {/* Bus Fees - only if user has permission */}
            {canViewBus &&
              renderCategoryCard(
                "Bus Fees",
                "Transportation fees",
                stats.bus,
                "bus",
                VIBE.info,
                "/shared/bus-fees",
                true,
              )}

            {/* Extra Classes - only if user has permission */}
            {canViewExtraClasses &&
              renderCategoryCard(
                "Extra Classes",
                "Additional classes fees",
                stats.extraClasses,
                "book",
                VIBE.purple,
                "/shared/extra-classes-fees",
                true,
              )}
          </View>

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.quickActionsRow}>
              <TouchableOpacity
                style={styles.quickActionBtn}
                onPress={handleBack}
              >
                <SVGIcon name="arrow-back" size={20} color={VIBE.muted} />
                <Text style={[styles.quickActionText, { color: VIBE.muted }]}>
                  Go Back
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VIBE.bg },
  centerContent: { flex: 1, justifyContent: "center", alignItems: "center" },
  centerText: { marginTop: 16, color: VIBE.muted, fontSize: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: VIBE.surface,
    borderBottomWidth: 1,
    borderBottomColor: VIBE.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: VIBE.bg,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  headerTitle: { flex: 1 },
  headerTitleText: { fontSize: 20, fontWeight: "800", color: VIBE.text },
  headerSubtitle: { fontSize: 12, color: VIBE.muted, marginTop: 1 },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: VIBE.primary + "10",
    borderRadius: 12,
    gap: 6,
  },
  dateButtonText: { fontSize: 13, fontWeight: "700", color: VIBE.primary },
  datePickerContainer: { padding: 16 },
  filterSection: {
    paddingVertical: 16,
    paddingLeft: 20,
    backgroundColor: VIBE.surface,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: VIBE.muted,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  classChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: VIBE.bg,
    marginRight: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  classChipText: { fontSize: 13, fontWeight: "600", color: VIBE.muted },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: VIBE.surface,
    padding: 16,
    borderRadius: 20,
    alignItems: "flex-start",
    ...SHADOWS.medium,
  },
  summaryValue: { fontSize: 24, fontWeight: "900", color: VIBE.text },
  summaryLabel: {
    fontSize: 11,
    color: VIBE.muted,
    marginTop: 4,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  section: { padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: VIBE.text },
  sectionSubtitle: {
    fontSize: 14,
    color: VIBE.muted,
    marginTop: 4,
    marginBottom: 16,
  },
  categoryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: VIBE.surface,
    padding: 16,
    borderRadius: 24,
    marginBottom: 16,
    ...SHADOWS.medium,
  },
  categoryIconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  categoryInfo: { flex: 1 },
  categoryTitle: { fontSize: 16, fontWeight: "800", color: VIBE.text },
  categorySubtitle: { fontSize: 13, color: VIBE.muted, marginTop: 2 },
  categoryRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  categoryBadge: { alignItems: "flex-end" },
  categoryBadgeText: { fontSize: 18, fontWeight: "900" },
  categoryBadgeLabel: { fontSize: 10, color: VIBE.muted, fontWeight: "600" },
  chevronBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: VIBE.bg,
    justifyContent: "center",
    alignItems: "center",
  },
  locationsList: {
    backgroundColor: VIBE.surface,
    borderRadius: 20,
    padding: 8,
    ...SHADOWS.small,
  },
  locationCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: VIBE.bg,
    borderRadius: 14,
    marginBottom: 8,
  },
  locationIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: VIBE.info + "15",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  locationInfo: { flex: 1 },
  locationName: { fontSize: 14, fontWeight: "700", color: VIBE.text },
  locationCount: { fontSize: 12, color: VIBE.muted, marginTop: 2 },
  quickActionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: VIBE.surface,
    padding: 16,
    borderRadius: 18,
    ...SHADOWS.medium,
  },
  quickActionText: { fontSize: 14, fontWeight: "700" },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1E293B",
    marginTop: 20,
  },
  errorSub: {
    fontSize: 16,
    color: "#64748B",
    textAlign: "center",
    marginTop: 10,
    marginBottom: 30,
  },
  errorButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 25,
    paddingVertical: 15,
    borderRadius: 15,
    ...SHADOWS.medium,
  },
  errorButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
});
