import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import SVGIcon from "../../components/SVGIcon";
import { SHADOWS, COLORS } from "../../constants/theme";
import { db } from "../../firebaseConfig";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { getDocsCacheFirst } from "../../lib/firestoreHelpers";
import * as Animatable from "react-native-animatable";
import moment from "moment";

interface StudentDetail {
  id: string;
  name: string;
  status: "present" | "absent" | "not_marked";
  markedAt?: string;
}

export default function AttendanceDetails() {
  const router = useRouter();
  const { classId, className, date, academicYear, term } = useLocalSearchParams<{
    classId: string;
    className: string;
    date: string;
    academicYear: string;
    term: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentDetail[]>([]);
  const [filter, setFilter] = useState<"all" | "present" | "absent">("all");

  const primary = SCHOOL_CONFIG.primaryColor;

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Students in Class (Cache-First)
      const q = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("classId", "==", classId)
      );
      const studentsSnap = await getDocsCacheFirst(q as any);
      const studentList = studentsSnap.docs.map(d => ({
        id: d.id,
        name: `${(d.data() as any).profile?.firstName || ""} ${(d.data() as any).profile?.lastName || ""}`.trim() || d.id,
        status: "not_marked" as const
      }));

      // 2. Fetch Attendance Record (Try server for latest, but fallback to cache)
      // Note: We use the same ID format as in teacher-dashboard/daily-attendance.tsx
      const cleanYear = (academicYear || "").replace(/\//g, "-");
      const cleanTerm = (term || "").replace(/\s/g, "");
      const attendanceId = `${classId}_${cleanYear}_${cleanTerm}_${date}`;

      const attRef = doc(db, "attendance", attendanceId);
      const attSnap = await getDoc(attRef); // Fresh fetch for accuracy

      const attendanceData = attSnap.exists() ? (attSnap.data() as any).students || {} : {};

      // 3. Merge
      const merged = studentList.map(s => ({
        ...s,
        status: attendanceData[s.id]?.status || "not_marked",
        markedAt: attendanceData[s.id]?.markedAt
      })).sort((a, b) => a.name.localeCompare(b.name));

      setStudents(merged);
    } catch (error) {
      console.error("Fetch Details Error:", error);
    } finally {
      setLoading(false);
    }
  }, [classId, date, academicYear, term]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const filteredStudents = students.filter(s => {
    if (filter === "all") return true;
    return s.status === filter;
  });

  const stats = {
    total: students.length,
    present: students.filter(s => s.status === "present").length,
    absent: students.filter(s => s.status === "absent").length,
    notMarked: students.filter(s => s.status === "not_marked").length
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <SVGIcon name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{className}</Text>
          <Text style={styles.subtitle}>{moment(date).format("dddd, MMM Do")}</Text>
        </View>
      </View>

      <View style={styles.filterBar}>
        <FilterChip label="All" count={stats.total} active={filter === "all"} onPress={() => setFilter("all")} color="#64748B" />
        <FilterChip label="Present" count={stats.present} active={filter === "present"} onPress={() => setFilter("present")} color="#10B981" />
        <FilterChip label="Absent" count={stats.absent} active={filter === "absent"} onPress={() => setFilter("absent")} color="#EF4444" />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={primary} /></View>
      ) : (
        <FlatList
          data={filteredStudents}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <Animatable.View animation="fadeInUp" duration={300} delay={index * 30} style={styles.studentCard}>
              <View style={[styles.statusIndicator, { backgroundColor: item.status === "present" ? "#10B981" : item.status === "absent" ? "#EF4444" : "#CBD5E1" }]} />
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{item.name}</Text>
                {item.markedAt && (
                  <Text style={styles.markedTime}>Marked {moment(item.markedAt).format("h:mm A")}</Text>
                )}
              </View>
              <View style={[styles.statusBadge, { backgroundColor: item.status === "present" ? "#F0FDF4" : item.status === "absent" ? "#FEF2F2" : "#F8FAFC" }]}>
                <Text style={[styles.statusText, { color: item.status === "present" ? "#10B981" : item.status === "absent" ? "#EF4444" : "#94A3B8" }]}>
                  {item.status.replace("_", " ").toUpperCase()}
                </Text>
              </View>
            </Animatable.View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <SVGIcon name="people-outline" size={48} color="#CBD5E1" />
              <Text style={styles.emptyText}>No students found</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const FilterChip = ({ label, count, active, onPress, color }: any) => (
  <TouchableOpacity
    onPress={onPress}
    style={[styles.chip, active && { backgroundColor: color, borderColor: color }]}
  >
    <Text style={[styles.chipText, active && { color: "#fff" }]}>{label}</Text>
    <View style={[styles.countBadge, { backgroundColor: active ? 'rgba(255,255,255,0.2)' : '#F1F5F9' }]}>
      <Text style={[styles.countText, active && { color: "#fff" }]}>{count}</Text>
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  title: { fontSize: 20, fontWeight: '900', color: '#1E293B' },
  subtitle: { fontSize: 13, color: '#64748B', fontWeight: '700' },
  filterBar: { flexDirection: 'row', padding: 15, gap: 10, backgroundColor: '#fff' },
  chip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', gap: 6 },
  chipText: { fontSize: 12, fontWeight: '800', color: '#64748B' },
  countBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  countText: { fontSize: 10, fontWeight: '900', color: '#64748B' },
  list: { padding: 15 },
  studentCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 18, marginBottom: 10, ...SHADOWS.small },
  statusIndicator: { width: 4, height: 30, borderRadius: 2, marginRight: 15 },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  markedTime: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  statusText: { fontSize: 10, fontWeight: '900' },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#94A3B8', marginTop: 10, fontWeight: '600' }
});
