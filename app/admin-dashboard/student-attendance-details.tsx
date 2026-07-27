import { Picker } from "@react-native-picker/picker";
import { doc, onSnapshot } from "firebase/firestore";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
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

export default function StudentAttendanceDetails() {
  const router = useRouter();
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
  const [presentCount, setPresentCount] = useState(0);
  const [absentCount, setAbsentCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const primary = SCHOOL_CONFIG.primaryColor || COLORS.primary;

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
    if (!studentId || !selectedYear || !selectedTerm) return;

    setLoading(true);
    const cleanYear = selectedYear.replace(/\//g, "-");
    const cleanTerm = selectedTerm.replace(/\s/g, "");
    const summaryId = `${studentId}_${cleanYear}_${cleanTerm}`;
    const summaryRef = doc(db, "attendanceSummary", summaryId);

    const unsubscribe = onSnapshot(summaryRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPresentCount(data.present || 0);
        setAbsentCount(data.absent || 0);
      } else {
        setPresentCount(0);
        setAbsentCount(0);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error listening to attendance summary:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [studentId, selectedYear, selectedTerm]);

  const totalDays = presentCount + absentCount;
  const attendancePercent =
    totalDays === 0 ? 0 : Math.round((presentCount / totalDays) * 100);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <SVGIcon name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <View>
            <Text style={styles.title}>Attendance Analysis</Text>
            <Text style={styles.subtitle}>{studentName}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
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
            <ActivityIndicator size="large" color={primary} />
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
                <Text style={[styles.statValue, { color: "#10B981" }]}>
                  {presentCount}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>ABSENT</Text>
                <Text style={[styles.statValue, { color: "#EF4444" }]}>
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
                  { color: attendancePercent > 75 ? "#10B981" : primary },
                ]}
              >
                {attendancePercent}%
              </Text>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  title: { fontSize: 20, fontWeight: "900", color: "#1E293B" },
  subtitle: { fontSize: 13, color: '#64748B', fontWeight: '700' },
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
    color: "#64748B",
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
