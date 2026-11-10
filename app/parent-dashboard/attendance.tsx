import {
  collection,
  doc,
  getDoc,
  getDocsFromServer,
  query,
  where,
} from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SHADOWS, COLORS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { db } from "../../firebaseConfig";
import { useRouter } from "expo-router";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";

const getTodayKey = () => new Date().toISOString().split("T")[0];

interface StudentAttendanceData {
  id: string;
  name: string;
  className: string;
  classId: string;
  todayStatus: "present" | "absent" | "not_marked";
  arrivalMode?: string;
  broughtBy?: string;
  presentCount: number;
  absentCount: number;
  totalDays: number;
  attendancePercent: number;
}

export default function AttendanceScreen() {
  const { appUser } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const acadConfig = useAcademicConfig();

  const [studentAttendances, setStudentAttendances] = useState<StudentAttendanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedYear, setSelectedYear] = useState("");
  const [selectedTerm, setSelectedTerm] = useState<"Term 1" | "Term 2" | "Term 3">("Term 1");

  const todayKey = useMemo(() => getTodayKey(), []);
  const primary = SCHOOL_CONFIG.primaryColor || COLORS.primary;
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = -1; i <= 1; i++) {
      const start = currentYear + i;
      years.push(`${start}/${start + 1}`);
    }
    return years;
  }, []);

  const terms: ("Term 1" | "Term 2" | "Term 3")[] = ["Term 1", "Term 2", "Term 3"];

  useEffect(() => {
    if (acadConfig.academicYear) {
      setSelectedYear(acadConfig.academicYear);
    } else {
      const now = new Date();
      const yearStr =
        now.getMonth() >= 7
          ? `${now.getFullYear()}/${now.getFullYear() + 1}`
          : `${now.getFullYear() - 1}/${now.getFullYear()}`;
      setSelectedYear(yearStr);
    }
    if (acadConfig.currentTerm) {
      setSelectedTerm(acadConfig.currentTerm as any);
    }
  }, [acadConfig.academicYear, acadConfig.currentTerm]);

  const fetchChildrenAttendance = useCallback(
    async (isRefresh = false) => {
      if (!appUser || appUser.role !== "parent" || !selectedYear) {
        setLoading(false);
        return;
      }

      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        let childUids: string[] =
          appUser.childrenIds ||
          (appUser as any).childrenIds ||
          (appUser.profile as any)?.childrenIds ||
          [];

        // Always attempt to fetch the latest parent doc to get updated childrenIds
        try {
          const parentSnap = await getDoc(doc(db, "users", appUser.uid));
          if (parentSnap.exists()) {
            const pData = parentSnap.data();
            const freshChildren =
              pData.childrenIds || pData.profile?.childrenIds;
            if (Array.isArray(freshChildren) && freshChildren.length > 0) {
              childUids = freshChildren;
            }
          }
        } catch (e) {
          console.warn("Could not fetch fresh parent document:", e);
        }

        // Fallback search if childUids is still empty
        if (childUids.length === 0 && appUser.email) {
          try {
            const fallbackQ = query(
              collection(db, "users"),
              where("role", "==", "student"),
              where("parentEmail", "==", appUser.email)
            );
            const fallbackSnap = await getDocsFromServer(fallbackQ);
            childUids = fallbackSnap.docs.map((d) => d.id);
          } catch (e) {
            console.warn("Fallback student query failed:", e);
          }
        }

        if (childUids.length === 0) {
          if (isMounted.current) {
            setStudentAttendances([]);
            setLoading(false);
            setRefreshing(false);
          }
          return;
        }

        const cleanYear = selectedYear.replace(/\//g, "-");
        const cleanTerm = selectedTerm.replace(/\s/g, "");

        const attendancePromises = childUids.map(async (studentId) => {
          let studentData: any = null;
          try {
            const studentSnap = await getDoc(doc(db, "users", studentId));
            if (studentSnap.exists()) {
              studentData = studentSnap.data();
            }
          } catch (e) {
            console.error(`Error loading student ${studentId}:`, e);
          }

          if (!studentData) return null;

          const profile = studentData.profile || {};
          const studentName =
            `${profile.firstName || ""} ${profile.lastName || ""}`.trim() ||
            studentData.name ||
            "Student";
          const classId = studentData.classId || "";

          let className = profile.class || studentData.className || "";
          if (!className && classId) {
            try {
              const classSnap = await getDoc(doc(db, "classes", classId));
              if (classSnap.exists()) {
                className = classSnap.data().name || "";
              }
            } catch (e) {
              console.warn("Could not fetch class name:", e);
            }
          }

          // 1. Fetch Today's Attendance status
          let todayStatus: "present" | "absent" | "not_marked" = "not_marked";
          let arrivalMode = "";
          let broughtBy = "";

          if (classId) {
            const todayAttendanceId = `${classId}_${cleanYear}_${cleanTerm}_${todayKey}`;
            try {
              const todaySnap = await getDoc(
                doc(db, "attendance", todayAttendanceId)
              );
              if (todaySnap.exists()) {
                const record =
                  todaySnap.data().students?.[studentId] || {};
                todayStatus = record.status || "not_marked";
                arrivalMode = record.arrivalMode || "";
                broughtBy = record.broughtBy || "";
              }
            } catch (e) {
              console.warn("Could not fetch today's attendance doc:", e);
            }
          }

          // 2. Fetch Term Cumulative Summary
          let presentCount = 0;
          let absentCount = 0;

          const summaryId = `${studentId}_${cleanYear}_${cleanTerm}`;
          try {
            const summarySnap = await getDoc(
              doc(db, "attendanceSummary", summaryId)
            );
            if (
              summarySnap.exists() &&
              summarySnap.data().present !== undefined
            ) {
              const sData = summarySnap.data();
              presentCount = sData.present || 0;
              absentCount = sData.absent || 0;
            } else if (classId) {
              // Fallback: Query all class attendance docs for selected year & term
              const attQuery = query(
                collection(db, "attendance"),
                where("classId", "==", classId),
                where("academicYear", "==", selectedYear),
                where("term", "==", selectedTerm)
              );
              const attSnap = await getDocsFromServer(attQuery);
              attSnap.forEach((attDoc) => {
                const stRecord = attDoc.data().students?.[studentId];
                if (stRecord?.status === "present") presentCount++;
                if (stRecord?.status === "absent") absentCount++;
              });
            }
          } catch (e) {
            console.warn("Error fetching attendance summary:", e);
          }

          const totalDays = presentCount + absentCount;
          const attendancePercent =
            totalDays === 0
              ? 0
              : Math.round((presentCount / totalDays) * 100);

          return {
            id: studentId,
            name: studentName,
            className: className || "Enrolled Student",
            classId,
            todayStatus,
            arrivalMode,
            broughtBy,
            presentCount,
            absentCount,
            totalDays,
            attendancePercent,
          } as StudentAttendanceData;
        });

        const resolved = (await Promise.all(attendancePromises)).filter(
          Boolean
        ) as StudentAttendanceData[];

        if (isMounted.current) {
          setStudentAttendances(resolved);
        }
      } catch (err) {
        console.error("Failed to fetch children attendance:", err);
        if (isMounted.current) {
          showToast({
            message: "Failed to load attendance records.",
            type: "error",
          });
        }
      } finally {
        if (isMounted.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [appUser, selectedYear, selectedTerm, todayKey, showToast]
  );

  useEffect(() => {
    fetchChildrenAttendance();
  }, [fetchChildrenAttendance]);

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <SVGIcon name="arrow-back" size={24} color={primary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: primary }]}>
            Ward Attendance 📅
          </Text>
          <Text style={styles.subtitle}>{new Date().toDateString()}</Text>
        </View>
      </View>

      <FlatList
        data={studentAttendances}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchChildrenAttendance(true)}
            colors={[primary]}
          />
        }
        ListHeaderComponent={
          <View style={styles.filterSection}>
            <Text style={styles.sectionLabel}>ACADEMIC YEAR</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {availableYears.map((year) => (
                <TouchableOpacity
                  key={year}
                  style={[
                    styles.chip,
                    selectedYear === year && {
                      backgroundColor: primary,
                      borderColor: primary,
                    },
                  ]}
                  onPress={() => setSelectedYear(year)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedYear === year && { color: "#fff" },
                    ]}
                  >
                    {year}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.sectionLabel, { marginTop: 15 }]}>
              SELECT TERM
            </Text>
            <View style={styles.termRow}>
              {terms.map((term) => (
                <TouchableOpacity
                  key={term}
                  style={[
                    styles.termBtn,
                    selectedTerm === term && {
                      backgroundColor: primary,
                      borderColor: primary,
                    },
                  ]}
                  onPress={() => setSelectedTerm(term)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.termBtnText,
                      selectedTerm === term && { color: "#fff" },
                    ]}
                  >
                    {term}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const rateColor =
            item.totalDays === 0
              ? "#94A3B8"
              : item.attendancePercent >= 75
              ? "#10B981"
              : item.attendancePercent >= 50
              ? "#F59E0B"
              : "#EF4444";

          return (
            <View style={styles.cardWrapper}>
              {/* Main Card */}
              <View style={styles.card}>
                {/* Child Header */}
                <View style={styles.cardHeader}>
                  <View style={[styles.avatar, { backgroundColor: primary + "15" }]}>
                    <Text style={[styles.avatarText, { color: primary }]}>
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.name}</Text>
                    <Text style={styles.className}>{item.className}</Text>
                  </View>
                </View>

                {/* Term Attendance Summary Box */}
                <View style={styles.summaryBox}>
                  <View style={styles.summaryTopRow}>
                    <View style={styles.rateBadge}>
                      <Text style={[styles.rateValue, { color: rateColor }]}>
                        {item.attendancePercent}%
                      </Text>
                      <Text style={styles.rateLabel}>ATTENDANCE RATE</Text>
                    </View>

                    <View style={styles.periodTag}>
                      <Text style={styles.periodTagText}>
                        {selectedTerm} • {selectedYear}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.statsRow}>
                    <View style={styles.statCol}>
                      <Text style={[styles.statNum, { color: "#10B981" }]}>
                        {item.presentCount}
                      </Text>
                      <Text style={styles.statTitle}>DAYS PRESENT</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statCol}>
                      <Text style={[styles.statNum, { color: "#EF4444" }]}>
                        {item.absentCount}
                      </Text>
                      <Text style={styles.statTitle}>DAYS ABSENT</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statCol}>
                      <Text style={[styles.statNum, { color: "#1E293B" }]}>
                        {item.totalDays}
                      </Text>
                      <Text style={styles.statTitle}>TOTAL DAYS</Text>
                    </View>
                  </View>
                </View>

                {/* Today's Roll Call Status Banner */}
                {item.todayStatus === "absent" && (
                  <Animatable.View animation="shake" style={styles.absentAlert}>
                    <SVGIcon name="warning" size={20} color="#B91C1C" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.absentAlertTitle}>
                        Absence Recorded Today
                      </Text>
                      <Text style={styles.absentAlertSub}>
                        Please notify the administration why {item.name.split(" ")[0]} is absent.
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() =>
                        router.push({
                          pathname: "/parent-dashboard/chat-with-admin",
                          params: { studentId: item.id, studentName: item.name },
                        })
                      }
                      style={styles.chatBtn}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.chatBtnText}>STATE REASON</Text>
                    </TouchableOpacity>
                  </Animatable.View>
                )}

                {item.todayStatus === "present" && (
                  <Animatable.View animation="fadeIn" style={styles.presentInfo}>
                    <SVGIcon name="school" size={20} color="#047857" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.presentInfoTitle}>
                        {item.name.split(" ")[0]} is Present Today
                      </Text>
                      <Text style={styles.presentInfoSub}>
                        {item.arrivalMode
                          ? `Arrived via ${item.arrivalMode.replace("_", " ")}${
                              item.broughtBy ? ` (Brought by: ${item.broughtBy})` : ""
                            }.`
                          : "Roll call taken. Learning and fun are underway!"}
                      </Text>
                    </View>
                  </Animatable.View>
                )}

                {item.todayStatus === "not_marked" && (
                  <View style={styles.neutralInfo}>
                    <SVGIcon name="calendar-outline" size={18} color="#64748B" />
                    <Text style={styles.neutralInfoText}>
                      No roll call taken for today (Weekend / Holiday / Pending).
                    </Text>
                  </View>
                )}

                {/* Action to view full detailed transcript */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.detailBtn}
                  onPress={() =>
                    router.push({
                      pathname: "/admin-dashboard/student-attendance-details",
                      params: {
                        studentId: item.id,
                        classId: item.classId,
                        studentName: item.name,
                        academicYear: selectedYear,
                        term: selectedTerm,
                      },
                    })
                  }
                >
                  <Text style={[styles.detailBtnText, { color: primary }]}>
                    VIEW FULL ATTENDANCE TRANSCRIPT
                  </Text>
                  <SVGIcon name="chevron-forward" size={16} color={primary} />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyCenter}>
            <View style={styles.emptyIcon}>
              <SVGIcon name="calendar" size={56} color="#CBD5E1" />
            </View>
            <Text style={styles.emptyText}>No Linked Wards Found</Text>
            <Text style={styles.emptySub}>
              Ensure your parent account is linked to your child's student profile in settings.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    padding: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  headerText: { flex: 1 },
  title: { fontSize: 22, fontWeight: "900" },
  subtitle: { fontSize: 13, color: "#64748B", fontWeight: "700", marginTop: 2 },
  filterSection: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
  },
  chipRow: { paddingVertical: 4, paddingHorizontal: 2 },
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#fff",
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...SHADOWS.small,
  },
  chipText: { fontSize: 13, fontWeight: "800", color: "#64748B" },
  termRow: { flexDirection: "row", gap: 10 },
  termBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.small,
  },
  termBtnText: { fontSize: 13, fontWeight: "800", color: "#64748B" },
  cardWrapper: { marginBottom: 20 },
  card: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 24,
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  avatarText: { fontSize: 22, fontWeight: "900" },
  name: { fontSize: 18, fontWeight: "900", color: "#1E293B" },
  className: { fontSize: 13, fontWeight: "700", color: "#64748B", marginTop: 2 },
  summaryBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 15,
  },
  summaryTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  rateBadge: { alignItems: "flex-start" },
  rateValue: { fontSize: 32, fontWeight: "900", lineHeight: 36 },
  rateLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "#64748B",
    letterSpacing: 0.8,
    marginTop: 2,
  },
  periodTag: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  periodTagText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#334155",
    textTransform: "uppercase",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  statCol: { flex: 1, alignItems: "center" },
  statNum: { fontSize: 20, fontWeight: "900" },
  statTitle: {
    fontSize: 9,
    fontWeight: "900",
    color: "#64748B",
    marginTop: 2,
    letterSpacing: 0.5,
  },
  statDivider: { width: 1, height: 28, backgroundColor: "#CBD5E1" },
  absentAlert: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: 18,
    padding: 14,
    marginBottom: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  absentAlertTitle: { fontSize: 13, fontWeight: "900", color: "#991B1B" },
  absentAlertSub: {
    fontSize: 11,
    fontWeight: "600",
    color: "#B91C1C",
    marginTop: 2,
    lineHeight: 14,
  },
  chatBtn: {
    backgroundColor: "#B91C1C",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  chatBtnText: { fontSize: 10, fontWeight: "900", color: "#fff" },
  presentInfo: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 18,
    padding: 14,
    marginBottom: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  presentInfoTitle: { fontSize: 13, fontWeight: "900", color: "#065F46" },
  presentInfoSub: {
    fontSize: 11,
    fontWeight: "600",
    color: "#047857",
    marginTop: 2,
    lineHeight: 14,
  },
  neutralInfo: {
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    padding: 12,
    marginBottom: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  neutralInfoText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    flex: 1,
  },
  detailBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 6,
  },
  detailBtnText: { fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },
  emptyCenter: { alignItems: "center", marginTop: 60, paddingHorizontal: 40 },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyText: {
    color: "#1E293B",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  emptySub: {
    color: "#94A3B8",
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 18,
  },
});

