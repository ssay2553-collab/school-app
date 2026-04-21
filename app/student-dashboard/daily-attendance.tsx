import { useRouter } from "expo-router";
import { collection, query, where } from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import SVGIcon from "../../components/SVGIcon";
import { SHADOWS, COLORS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { db } from "../../firebaseConfig";
import { getDocsCacheFirst } from "../../lib/firestoreHelpers";

interface AttendanceDoc {
  students: {
    [studentId: string]: {
      status: "present" | "absent";
    };
  };
}

export default function StudentAttendanceScreen() {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const [presentCount, setPresentCount] = useState(0);
  const [absentCount, setAbsentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedYear, setSelectedYear] = useState("");
  const [selectedTerm, setSelectedTerm] = useState<
    "Term 1" | "Term 2" | "Term 3"
  >("Term 1");

  const brandColor = COLORS.brandPrimary || COLORS.primary;

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = -1; i <= 1; i++) {
      const start = currentYear + i;
      years.push(`${start}/${start + 1}`);
    }
    return years;
  }, []);

  const terms = ["Term 1", "Term 2", "Term 3"];

  useEffect(() => {
    const now = new Date();
    const yearStr =
      now.getMonth() >= 7
        ? `${now.getFullYear()}/${now.getFullYear() + 1}`
        : `${now.getFullYear() - 1}/${now.getFullYear()}`;
    setSelectedYear(yearStr);
  }, []);

  const fetchAttendanceSummary = useCallback(
    async (isRefresh = false) => {
      if (!appUser?.uid || !appUser.classId || !selectedYear) {
        setLoading(false);
        return;
      }

      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const q = query(
          collection(db, "attendance"),
          where("classId", "==", appUser.classId),
          where("academicYear", "==", selectedYear),
          where("term", "==", selectedTerm),
        );

        const snapshot = await getDocsCacheFirst(q);

        let present = 0;
        let absent = 0;

        snapshot.forEach((doc) => {
          const data = doc.data() as any;
          const status = data.students?.[appUser.uid]?.status;

          if (status === "present") present++;
          if (status === "absent") absent++;
        });

        setPresentCount(present);
        setAbsentCount(absent);
      } catch (error) {
        console.error("Error fetching attendance summary:", error);
        showToast({ message: "Failed to load attendance data.", type: "error" });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [appUser?.uid, appUser?.classId, selectedYear, selectedTerm],
  );

  useEffect(() => {
    fetchAttendanceSummary();
  }, [fetchAttendanceSummary]);

  const totalDays = presentCount + absentCount;
  const attendancePercent =
    totalDays === 0 ? 0 : Math.round((presentCount / totalDays) * 100);

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={brandColor} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchAttendanceSummary(true)}
            colors={[brandColor]}
          />
        }
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.header, { color: brandColor }]}>
              My Attendance 📅
            </Text>
            <Text style={styles.subHeader}>Track your school days!</Text>
          </View>
          <View
            style={[
              styles.analysisBtn,
              { backgroundColor: brandColor },
            ]}
          >
            <SVGIcon name="analytics" size={18} color="#fff" />
          </View>
        </View>

        <View style={styles.filterSection}>
          <Text style={styles.sectionLabel}>Academic Year</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {availableYears.map((year) => (
              <TouchableOpacity
                key={year}
                style={[
                  styles.chip,
                  selectedYear === year && { backgroundColor: brandColor, borderColor: brandColor }
                ]}
                onPress={() => setSelectedYear(year)}
              >
                <Text style={[styles.chipText, selectedYear === year && { color: "#fff" }]}>{year}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.sectionLabel, { marginTop: 15 }]}>Select Term</Text>
          <View style={styles.termRow}>
            {terms.map((term) => (
              <TouchableOpacity
                key={term}
                style={[
                  styles.termBtn,
                  selectedTerm === term && { backgroundColor: brandColor, borderColor: brandColor }
                ]}
                onPress={() => setSelectedTerm(term as any)}
              >
                <Text style={[styles.termBtnText, selectedTerm === term && { color: "#fff" }]}>{term}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.summaryCard}>
          <View
            style={[
              styles.percentCircle,
              { borderColor: (brandColor || "#000") + "15", backgroundColor: (brandColor || "#000") + "08" },
            ]}
          >
            <Text
              style={[
                styles.percentText,
                { color: brandColor },
              ]}
            >
              {attendancePercent}%
            </Text>
            <Text style={styles.percentLabel}>{selectedTerm}</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: "#10B981" }]}>
                {presentCount}
              </Text>
              <Text style={styles.statLabel}>Present</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: "#EF4444" }]}>
                {absentCount}
              </Text>
              <Text style={styles.statLabel}>Absent</Text>
            </View>
          </View>
        </View>

        <View style={styles.infoBox}>
          <SVGIcon
            name="information-circle"
            size={20}
            color={brandColor}
          />
          <Text style={styles.infoText}>
            Attendance is tracked for the selected period. Use the selectors above to view other terms or years.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FDFDFD" },
  scrollContent: { padding: 20 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
  },
  header: { fontSize: 24, fontWeight: "900" },
  subHeader: { fontSize: 14, color: "#64748B", marginTop: 4 },
  analysisBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.small,
  },
  filterSection: {
    marginBottom: 25,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
  },
  chipRow: {
    paddingVertical: 5,
    paddingHorizontal: 2,
  },
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 15,
    backgroundColor: "#fff",
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...SHADOWS.small,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
  termRow: {
    flexDirection: "row",
    gap: 10,
  },
  termBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 15,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.small,
  },
  termBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 30,
    alignItems: "center",
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  percentCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
    ...SHADOWS.small,
  },
  percentText: { fontSize: 36, fontWeight: "900" },
  percentLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "800",
    textTransform: "uppercase",
    marginTop: 4,
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-around",
    alignItems: "center",
    paddingTop: 10,
  },
  statBox: { alignItems: "center" },
  statValue: { fontSize: 28, fontWeight: "900" },
  statLabel: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 4,
    fontWeight: "700",
  },
  divider: { width: 1, height: 40, backgroundColor: "#F1F5F9" },
  infoBox: {
    marginTop: 25,
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: "#475569",
    lineHeight: 18,
    fontWeight: "600",
  },
});
