import { Picker } from "@react-native-picker/picker";
import { collection, query, where } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import SVGIcon from "../../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../../constants/theme";
import { db } from "../../../firebaseConfig";
import { getDocsCacheFirst } from "../../../lib/firestoreHelpers";

interface AttendanceDoc {
  date: string;
  classId: string;
  academicYear: string;
  term: string;
  students: {
    [studentId: string]: {
      status: "present" | "absent";
    };
  };
}

export default function StudentAttendanceSummaryScreen({
  route,
  navigation,
}: any) {
  const { studentId, classId, studentName, initialYear, initialTerm } =
    route.params;

  const [selectedYear, setSelectedYear] = useState(initialYear || "");
  const [selectedTerm, setSelectedTerm] = useState(initialTerm || "Term 1");
  const [presentCount, setPresentCount] = useState(0);
  const [absentCount, setAbsentCount] = useState(0);
  const [loading, setLoading] = useState(true);

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
      const now = new Date();
      const yearStr =
        now.getMonth() >= 7
          ? `${now.getFullYear()}/${now.getFullYear() + 1}`
          : `${now.getFullYear() - 1}/${now.getFullYear()}`;
      setSelectedYear(yearStr);
    }
  }, [selectedYear]);

  useEffect(() => {
    if (!studentId || !classId || !selectedYear || !selectedTerm) return;

    const fetchAttendanceSummary = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "attendance"),
          where("classId", "==", classId),
          where("academicYear", "==", selectedYear),
          where("term", "==", selectedTerm),
        );

        const snapshot = await getDocsCacheFirst(q);

        let present = 0;
        let absent = 0;

        snapshot.forEach((doc) => {
          const data = doc.data() as AttendanceDoc;
          const status = data.students?.[studentId]?.status;
          if (status === "present") present++;
          else if (status === "absent") absent++;
        });

        setPresentCount(present);
        setAbsentCount(absent);
      } catch (error) {
        console.error("Error fetching attendance summary:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendanceSummary();
  }, [studentId, classId, selectedYear, selectedTerm]);

  const totalDays = presentCount + absentCount;
  const attendancePercent =
    totalDays === 0 ? 0 : Math.round((presentCount / totalDays) * 100);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <SVGIcon name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Attendance Analysis</Text>
      </View>

      <View style={styles.filterCard}>
        <View style={styles.pickerRow}>
          <View style={[styles.pickerBox, { flex: 1 }]}>
            <Text style={styles.miniLabel}>ACADEMIC YEAR</Text>
            <Picker
              selectedValue={selectedYear}
              onValueChange={setSelectedYear}
              style={styles.picker}
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
              style={styles.picker}
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
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.name}>{studentName || "Student"}</Text>
          <Text style={styles.periodText}>
            {selectedTerm} • {selectedYear}
          </Text>

          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>PRESENT</Text>
              <Text style={[styles.statValue, { color: "green" }]}>
                {presentCount}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>ABSENT</Text>
              <Text style={[styles.statValue, { color: "red" }]}>
                {absentCount}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>TOTAL DAYS</Text>
              <Text style={styles.statValue}>{totalDays}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.percentContainer}>
            <Text style={styles.percentLabel}>Term Attendance Rate</Text>
            <Text
              style={[
                styles.percent,
                { color: attendancePercent > 75 ? "green" : COLORS.primary },
              ]}
            >
              {attendancePercent}%
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { padding: 50, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    paddingTop: 40,
  },
  backBtn: { marginRight: 15 },
  title: { fontSize: 22, fontWeight: "900", color: COLORS.primary },
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
    height: 55,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  picker: { height: 50, marginLeft: -8 },
  miniLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: COLORS.primary,
    position: "absolute",
    top: 6,
    left: 12,
    zIndex: 1,
    textTransform: "uppercase",
  },
  card: {
    backgroundColor: "#fff",
    margin: 20,
    borderRadius: 24,
    padding: 25,
    ...SHADOWS.medium,
  },
  name: {
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
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 30,
  },
  statItem: { alignItems: "center", flex: 1 },
  statLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#94A3B8",
    marginBottom: 8,
  },
  statValue: { fontSize: 24, fontWeight: "900", color: "#1E293B" },
  divider: { height: 1, backgroundColor: "#F1F5F9", marginVertical: 25 },
  percentContainer: { alignItems: "center" },
  percentLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748B",
    marginBottom: 10,
    textTransform: "uppercase",
  },
  percent: { fontSize: 48, fontWeight: "900" },
});
