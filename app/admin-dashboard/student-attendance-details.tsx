import { Picker } from "@react-native-picker/picker";
import { collection, doc, onSnapshot, query, where, getDoc } from "firebase/firestore";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  SafeAreaView,
  StatusBar,
} from "react-native";
import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { db } from "../../firebaseConfig";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";
import Constants from "expo-constants";
import moment from "moment";

interface SessionLogItem {
  date: string; // YYYY-MM-DD
  dayName: string; // Monday, Tuesday, etc.
  formattedDate: string;
  isMarked: boolean;
  status: "present" | "late" | "absent" | "excused" | "unmarked";
  arrivalMode?: string;
  broughtBy?: string;
  markedBy?: string;
}

export default function StudentAttendanceDetails() {
  const router = useRouter();
  const acadConfig = useAcademicConfig();

  const params = useLocalSearchParams<{
    studentId: string;
    studentName: string;
    classId: string;
    academicYear?: string;
    term?: string;
  }>();

  const { studentId, studentName, classId, academicYear, term } = params;

  const [selectedYear, setSelectedYear] = useState(academicYear || "");
  const [selectedTerm, setSelectedTerm] = useState(term || "Term 1");

  // Metrics state
  const [totalSchoolDays, setTotalSchoolDays] = useState(0);
  const [markedDaysCount, setMarkedDaysCount] = useState(0);
  const [unmarkedDaysCount, setUnmarkedDaysCount] = useState(0);
  const [presentCount, setPresentCount] = useState(0);
  const [lateCount, setLateCount] = useState(0);
  const [absentCount, setAbsentCount] = useState(0);
  const [excusedCount, setExcusedCount] = useState(0);
  const [sessionLogs, setSessionLogs] = useState<SessionLogItem[]>([]);
  const [holidays, setHolidays] = useState<{ date: string; title: string }[]>([]);

  const [loading, setLoading] = useState(true);
  const isMounted = useRef(true);
  const isNavigating = useRef(false);

  const schoolId = (Constants.expoConfig?.extra?.schoolId || SCHOOL_CONFIG.schoolId || 'school').toLowerCase();
  const primary = SCHOOL_CONFIG.primaryColor || COLORS.primary;

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

  useEffect(() => {
    if (!selectedYear) {
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
    }
    if (!selectedTerm && acadConfig.currentTerm) {
      setSelectedTerm(acadConfig.currentTerm);
    }
  }, [acadConfig.academicYear, acadConfig.currentTerm]);

  // 1. Fetch holidays from teacherAttendanceConfig
  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const configRef = doc(db, "teacherAttendanceConfig", schoolId);
        const snap = await getDoc(configRef);
        if (snap.exists() && snap.data().holidays) {
          setHolidays(snap.data().holidays);
        }
      } catch (e) {
        console.warn("Could not fetch holidays config:", e);
      }
    };
    fetchHolidays();
  }, [schoolId]);

  // Helper to check if a date is an official school holiday
  const checkIsHoliday = (dateStr: string) => {
    const check = moment(dateStr, "YYYY-MM-DD");
    return holidays.some((h) => {
      if (h.date && h.date === dateStr) return true;
      const s = (h as any).startDate || h.date;
      const e = (h as any).endDate || h.date;
      if (s && e) {
        return check.isBetween(moment(s, "YYYY-MM-DD"), moment(e, "YYYY-MM-DD"), "day", "[]");
      }
      return false;
    });
  };

  // 2. Main Attendance Resolution
  useEffect(() => {
    if (!studentId || !selectedYear || !selectedTerm) return;

    setLoading(true);

    // Determine official termStart and termEnd dates from school config
    let startDate = moment().startOf("month");
    if (acadConfig.termStart) {
      const ts = acadConfig.termStart.toDate ? acadConfig.termStart.toDate() : acadConfig.termStart;
      if (moment(ts).isValid()) {
        startDate = moment(ts);
      }
    }

    let endDate = moment(); // up to today
    if (acadConfig.termEnd) {
      const te = acadConfig.termEnd.toDate ? acadConfig.termEnd.toDate() : acadConfig.termEnd;
      if (moment(te).isValid() && moment(te).isBefore(moment(), "day")) {
        endDate = moment(te);
      }
    }

    // Build the list of official school weekdays (excluding weekends & holidays)
    const schoolWeekdays: string[] = [];
    const curr = moment(startDate);

    while (curr.isSameOrBefore(endDate, "day")) {
      const dayOfWeek = curr.day(); // 0 = Sun, 6 = Sat
      const dStr = curr.format("YYYY-MM-DD");

      // Exclude Saturdays (6) and Sundays (0) and declared official holidays
      if (dayOfWeek >= 1 && dayOfWeek <= 5 && !checkIsHoliday(dStr)) {
        schoolWeekdays.push(dStr);
      }
      curr.add(1, "day");
    }

    // Query attendance documents for classId in selected year and term
    const attQuery = classId
      ? query(
          collection(db, "attendance"),
          where("classId", "==", classId),
          where("academicYear", "==", selectedYear),
          where("term", "==", selectedTerm)
        )
      : query(
          collection(db, "attendance"),
          where("academicYear", "==", selectedYear),
          where("term", "==", selectedTerm)
        );

    const unsubscribe = onSnapshot(
      attQuery,
      (snapshot) => {
        if (!isMounted.current) return;

        // Map of date -> Attendance doc data
        const attendanceByDate: Record<string, any> = {};
        snapshot.docs.forEach((docSnap) => {
          const dData = docSnap.data();
          if (dData.date) {
            attendanceByDate[dData.date] = dData;
          }
        });

        let pCount = 0;
        let lCount = 0;
        let aCount = 0;
        let eCount = 0;
        let markedCount = 0;

        const logs: SessionLogItem[] = [];

        // Traverse all official school weekdays in session
        schoolWeekdays.forEach((dateStr) => {
          const attDoc = attendanceByDate[dateStr];
          const formattedDate = moment(dateStr, "YYYY-MM-DD").format("ddd, MMM DD, YYYY");
          const dayName = moment(dateStr, "YYYY-MM-DD").format("dddd");

          if (attDoc) {
            markedCount++;
            const stRec = attDoc.students?.[studentId];
            const rawStatus = (stRec?.status || "").toLowerCase();

            let status: SessionLogItem["status"] = "unmarked";
            if (rawStatus === "present") {
              pCount++;
              status = "present";
            } else if (rawStatus === "late") {
              lCount++;
              status = "late";
            } else if (rawStatus === "absent") {
              aCount++;
              status = "absent";
            } else if (rawStatus === "excused" || rawStatus === "permission") {
              eCount++;
              status = "excused";
            } else {
              // Roll call was taken for class, but student was not individually marked or absent
              aCount++;
              status = "absent";
            }

            logs.push({
              date: dateStr,
              dayName,
              formattedDate,
              isMarked: true,
              status,
              arrivalMode: stRec?.arrivalMode,
              broughtBy: stRec?.broughtBy,
              markedBy: attDoc.updatedBy || attDoc.markedBy,
            });
          } else {
            // Teacher did NOT mark roll call on this school weekday
            logs.push({
              date: dateStr,
              dayName,
              formattedDate,
              isMarked: false,
              status: "unmarked",
            });
          }
        });

        // Sort logs descending (most recent date first)
        logs.sort((a, b) => b.date.localeCompare(a.date));

        const totalInSession = schoolWeekdays.length;
        const unmarkedCount = Math.max(0, totalInSession - markedCount);

        setTotalSchoolDays(totalInSession);
        setMarkedDaysCount(markedCount);
        setUnmarkedDaysCount(unmarkedCount);
        setPresentCount(pCount);
        setLateCount(lCount);
        setAbsentCount(aCount);
        setExcusedCount(eCount);
        setSessionLogs(logs);
        setLoading(false);
      },
      (error) => {
        if (isMounted.current) {
          console.error("Error fetching student attendance analysis:", error);
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, [studentId, classId, selectedYear, selectedTerm, acadConfig.termStart, acadConfig.termEnd, holidays]);

  const attendancePercent =
    totalSchoolDays === 0
      ? 0
      : Math.round(((presentCount + lateCount) / totalSchoolDays) * 100);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (isNavigating.current) return;
            isNavigating.current = true;
            router.back();
          }}
          style={styles.backBtn}
        >
          <SVGIcon name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Individual Student Attendance</Text>
          <Text style={styles.subtitle}>{studentName || "Student"}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Term & Year Filter */}
        <View style={styles.filterCard}>
          <View style={styles.pickerRow}>
            <View style={[styles.pickerBox, { flex: 1 }]}>
              <Text style={styles.miniLabel}>ACADEMIC YEAR</Text>
              <Picker
                selectedValue={selectedYear}
                onValueChange={setSelectedYear}
                style={[styles.picker, { marginLeft: -10 }]}
              >
                {availableYears.map((y) => (
                  <Picker.Item key={y} label={y} value={y} />
                ))}
              </Picker>
            </View>
            <View style={[styles.pickerBox, { flex: 1, marginLeft: 10 }]}>
              <Text style={styles.miniLabel}>TERM</Text>
              <Picker
                selectedValue={selectedTerm}
                onValueChange={(v) => setSelectedTerm(v as any)}
                style={[styles.picker, { marginLeft: -10 }]}
              >
                <Picker.Item label="Term 1" value="Term 1" />
                <Picker.Item label="Term 2" value="Term 2" />
                <Picker.Item label="Term 3" value="Term 3" />
              </Picker>
            </View>
          </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={primary} />
            <Text style={styles.loadingText}>Analyzing School Session Attendance...</Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20 }}>
            {/* Main Overview Card */}
            <View style={styles.summaryCard}>
              <Text style={styles.studentNameHeader}>{studentName || "Student"}</Text>
              <Text style={styles.periodText}>
                {selectedTerm} • {selectedYear}
              </Text>

              <View style={styles.rateBadgeBox}>
                <Text style={styles.rateLabel}>TERM ATTENDANCE RATE</Text>
                <Text
                  style={[
                    styles.ratePercent,
                    {
                      color:
                        attendancePercent >= 80
                          ? "#10B981"
                          : attendancePercent >= 65
                          ? "#F59E0B"
                          : "#EF4444",
                    },
                  ]}
                >
                  {attendancePercent}%
                </Text>
              </View>

              {/* 6 Grid Stat Badges */}
              <View style={styles.statsGrid}>
                <View style={[styles.statBox, { backgroundColor: "#F1F5F9" }]}>
                  <SVGIcon name="calendar" size={18} color="#475569" />
                  <Text style={styles.statVal}>{totalSchoolDays}</Text>
                  <Text style={styles.statLbl}>Days in Session</Text>
                </View>

                <View style={[styles.statBox, { backgroundColor: "#ECFDF5" }]}>
                  <SVGIcon name="checkmark-circle" size={18} color="#10B981" />
                  <Text style={[styles.statVal, { color: "#10B981" }]}>{presentCount}</Text>
                  <Text style={styles.statLbl}>Times Present</Text>
                </View>

                <View style={[styles.statBox, { backgroundColor: "#FFFBEB" }]}>
                  <SVGIcon name="time" size={18} color="#D97706" />
                  <Text style={[styles.statVal, { color: "#D97706" }]}>{lateCount}</Text>
                  <Text style={styles.statLbl}>Times Late</Text>
                </View>

                <View style={[styles.statBox, { backgroundColor: "#FEF2F2" }]}>
                  <SVGIcon name="close-circle" size={18} color="#EF4444" />
                  <Text style={[styles.statVal, { color: "#EF4444" }]}>{absentCount}</Text>
                  <Text style={styles.statLbl}>Times Absent</Text>
                </View>

                <View style={[styles.statBox, { backgroundColor: "#EFF6FF" }]}>
                  <SVGIcon name="document-text" size={18} color="#2563EB" />
                  <Text style={[styles.statVal, { color: "#2563EB" }]}>{markedDaysCount}</Text>
                  <Text style={styles.statLbl}>Marked Roll Calls</Text>
                </View>

                <View style={[styles.statBox, { backgroundColor: "#FFF7ED" }]}>
                  <SVGIcon name="alert-circle" size={18} color="#EA580C" />
                  <Text style={[styles.statVal, { color: "#EA580C" }]}>{unmarkedDaysCount}</Text>
                  <Text style={styles.statLbl}>Unmarked Days</Text>
                </View>
              </View>

              {unmarkedDaysCount > 0 && (
                <View style={styles.unmarkedAlertBox}>
                  <SVGIcon name="information-circle" size={16} color="#EA580C" />
                  <Text style={styles.unmarkedAlertText}>
                    Teacher did not take roll call on <Text style={{ fontWeight: "900" }}>{unmarkedDaysCount} school weekday{unmarkedDaysCount > 1 ? "s" : ""}</Text> (excluding weekends & holidays).
                  </Text>
                </View>
              )}
            </View>

            {/* Daily History Session Timeline */}
            <View style={styles.historyContainer}>
              <View style={styles.historyHeader}>
                <SVGIcon name="list" size={18} color="#1E293B" />
                <Text style={styles.historyTitle}>Official School Session Timeline</Text>
                <Text style={styles.historyCount}>({sessionLogs.length} Days)</Text>
              </View>

              {sessionLogs.length === 0 ? (
                <View style={styles.emptyCard}>
                  <SVGIcon name="calendar-outline" size={36} color="#CBD5E1" />
                  <Text style={styles.emptyText}>
                    No school session days calculated for this term period yet.
                  </Text>
                </View>
              ) : (
                sessionLogs.map((log) => {
                  const isUnmarked = !log.isMarked || log.status === "unmarked";
                  const isPresent = log.status === "present";
                  const isLate = log.status === "late";
                  const isAbsent = log.status === "absent";
                  const isExcused = log.status === "excused";

                  const bg = isUnmarked
                    ? "#FFF7ED"
                    : isPresent
                    ? "#ECFDF5"
                    : isLate
                    ? "#FFFBEB"
                    : isAbsent
                    ? "#FEF2F2"
                    : "#EFF6FF";

                  const fg = isUnmarked
                    ? "#EA580C"
                    : isPresent
                    ? "#059669"
                    : isLate
                    ? "#D97706"
                    : isAbsent
                    ? "#DC2626"
                    : "#2563EB";

                  const badgeLabel = isUnmarked
                    ? "UNMARKED (No Roll Call)"
                    : log.status.toUpperCase();

                  return (
                    <View key={log.date} style={styles.logCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.logDate}>{log.formattedDate}</Text>
                        {Boolean(log.arrivalMode) && (
                          <Text style={styles.logSub}>
                            Arrival: {log.arrivalMode?.replace(/_/g, " ")}
                            {Boolean(log.broughtBy) && ` (${log.broughtBy})`}
                          </Text>
                        )}
                        {isUnmarked && (
                          <Text style={[styles.logSub, { color: "#EA580C", fontWeight: "700" }]}>
                            Attendance was not taken by teacher on this weekday
                          </Text>
                        )}
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: bg }]}>
                        <Text style={[styles.statusText, { color: fg }]}>
                          {badgeLabel}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { padding: 50, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, fontSize: 13, color: "#64748B", fontWeight: "600" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
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
  title: { fontSize: 18, fontWeight: "900", color: "#1E293B" },
  subtitle: { fontSize: 13, color: "#64748B", fontWeight: "700" },
  filterCard: {
    margin: 20,
    padding: 15,
    backgroundColor: "#fff",
    borderRadius: 20,
    ...SHADOWS.small,
  },
  pickerRow: { flexDirection: "row" },
  pickerBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    minHeight: 65,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingTop: 12,
  },
  picker: { height: 50, width: "100%" },
  miniLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "#64748B",
    position: "absolute",
    top: 12,
    left: 12,
    zIndex: 1,
    textTransform: "uppercase",
  },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 22,
    ...SHADOWS.medium,
    marginBottom: 20,
  },
  studentNameHeader: {
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
    color: "#1E293B",
  },
  periodText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    textAlign: "center",
    marginTop: 4,
    textTransform: "uppercase",
  },
  rateBadgeBox: {
    alignItems: "center",
    marginVertical: 18,
    padding: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
  },
  rateLabel: { fontSize: 10, fontWeight: "900", color: "#64748B", letterSpacing: 0.5 },
  ratePercent: { fontSize: 40, fontWeight: "900", marginTop: 2 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  statBox: {
    width: "48%",
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
  },
  statVal: { fontSize: 22, fontWeight: "900", color: "#1E293B", marginVertical: 2 },
  statLbl: { fontSize: 10, fontWeight: "700", color: "#64748B", textAlign: "center" },
  unmarkedAlertBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF7ED",
    borderRadius: 12,
    padding: 12,
    marginTop: 15,
    borderWidth: 1,
    borderColor: "#FFEDD5",
  },
  unmarkedAlertText: {
    marginLeft: 8,
    fontSize: 12,
    color: "#C2410C",
    flex: 1,
    lineHeight: 16,
  },
  historyContainer: {
    marginTop: 10,
  },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  historyTitle: { fontSize: 15, fontWeight: "800", color: "#1E293B", marginLeft: 8 },
  historyCount: { fontSize: 12, fontWeight: "600", color: "#64748B", marginLeft: 6 },
  logCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...SHADOWS.small,
  },
  logDate: { fontSize: 14, fontWeight: "800", color: "#1E293B" },
  logSub: { fontSize: 11, color: "#64748B", marginTop: 2, fontWeight: "500" },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: { fontSize: 11, fontWeight: "800" },
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { marginTop: 10, fontSize: 13, color: "#64748B", fontWeight: "600", textAlign: "center" },
});
