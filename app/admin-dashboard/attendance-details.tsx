import { collection, doc, onSnapshot, getDocsFromServer, query, where, limit } from "firebase/firestore";
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
  RefreshControl,
} from "react-native";
import SVGIcon from "../../components/SVGIcon";
import { SHADOWS, COLORS } from "../../constants/theme";
import { db } from "../../firebaseConfig";
import { SCHOOL_CONFIG } from "../../constants/Config";
import * as Animatable from "react-native-animatable";
import moment from "moment";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";

interface StudentDetail {
  id: string;
  name: string;
  status: "present" | "absent" | "late" | "not_marked";
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

  const acadConfig = useAcademicConfig();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [students, setStudents] = useState<StudentDetail[]>([]);
  const [filter, setFilter] = useState<"all" | "present" | "absent" | "late">("all");

  const primary = SCHOOL_CONFIG.primaryColor;

  useEffect(() => {
    setLoading(true);

    // 1. Listen to Students in Class
    const studentsQuery = query(
      collection(db, "users"),
      where("role", "==", "student"),
      where("classId", "==", classId),
      where("status", "in", ["active", "pending_activation"])
    );

    const unsubscribeStudents = onSnapshot(studentsQuery, (studentsSnap) => {
      const studentList = studentsSnap.docs
        .map(d => ({ id: d.id, ...(d.data() as any) } as any))
        .map(d => ({
          id: d.id,
          name: `${d.profile?.firstName || ""} ${d.profile?.lastName || ""}`.trim() || d.id,
          status: "not_marked" as const
        }));

      // 2. Resolve Attendance and Listen
      const activeYear = academicYear || acadConfig.academicYear;
      const activeTerm = term || acadConfig.currentTerm;

      if (!activeYear || !activeTerm) {
        if (acadConfig.loading) return;
        // Fallback search if no config
        const attQuery = query(
          collection(db, "attendance"),
          where("date", "==", date),
          where("classId", "==", classId)
        );
        onSnapshot(attQuery, (attSnap) => {
          const attendanceData = attSnap.empty ? {} : (attSnap.docs[0].data().students || {});
          const merged = studentList.map(s => ({
            ...s,
            status: attendanceData[s.id]?.status || "not_marked",
            markedAt: attendanceData[s.id]?.markedAt
          })).sort((a, b) => a.name.localeCompare(b.name));
          setStudents(merged);
          setLoading(false);
          setRefreshing(false);
        });
        return;
      }

      const cleanYear = activeYear.replace(/\//g, "-");
      const cleanTerm = activeTerm.replace(/\s/g, "");
      const attendanceId = `${classId}_${cleanYear}_${cleanTerm}_${date}`;
      const attRef = doc(db, "attendance", attendanceId);

      const unsubscribeAttendance = onSnapshot(attRef, (attSnap) => {
        const attendanceData = attSnap.exists() ? (attSnap.data().students || {}) : {};
        const merged = studentList.map(s => ({
          ...s,
          status: attendanceData[s.id]?.status || "not_marked",
          markedAt: attendanceData[s.id]?.markedAt
        })).sort((a, b) => a.name.localeCompare(b.name));

        setStudents(merged);
        setLoading(false);
        setRefreshing(false);
      });

      return () => unsubscribeAttendance();
    });

    return () => unsubscribeStudents();
  }, [classId, date, academicYear, term, acadConfig.academicYear, acadConfig.currentTerm, acadConfig.loading]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await getDocsFromServer(query(collection(db, "users"), where("classId", "==", classId), limit(1)));
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  const filteredStudents = students.filter(s => {
    if (filter === "all") return true;
    return s.status === filter;
  });

  const stats = {
    total: students.length,
    present: students.filter(s => s.status === "present").length,
    absent: students.filter(s => s.status === "absent").length,
    late: students.filter(s => s.status === "late").length,
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
        <TouchableOpacity
          onPress={() => router.push({
            pathname: "/teacher-dashboard/daily-attendance",
            params: {
              classId,
              date,
              fromAdmin: "true",
              className,
              academicYear,
              term
            }
          })}
          style={[styles.editBtn, { backgroundColor: primary + "10" }]}
        >
          <SVGIcon name="create-outline" size={20} color={primary} />
          <Text style={[styles.editBtnText, { color: primary }]}>Edit</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterBar}>
        <FilterChip label="All" count={stats.total} active={filter === "all"} onPress={() => setFilter("all")} color="#64748B" />
        <FilterChip label="Present" count={stats.present} active={filter === "present"} onPress={() => setFilter("present")} color="#10B981" />
        <FilterChip label="Late" count={stats.late} active={filter === "late"} onPress={() => setFilter("late")} color="#F59E0B" />
        <FilterChip label="Absent" count={stats.absent} active={filter === "absent"} onPress={() => setFilter("absent")} color="#EF4444" />
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}><ActivityIndicator size="large" color={primary} /></View>
      ) : (
        <FlatList
          data={filteredStudents}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[primary]} />
          }
          renderItem={({ item, index }) => (
            <Animatable.View animation="fadeInUp" duration={300} delay={index * 30} style={styles.studentCard}>
              <TouchableOpacity
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                onPress={() => router.push({
                  pathname: "/admin-dashboard/student-attendance-details",
                  params: {
                    studentId: item.id,
                    studentName: item.name,
                    classId,
                    academicYear,
                    term
                  }
                })}
              >
                <View style={[styles.statusIndicator, { backgroundColor: item.status === "present" ? "#10B981" : item.status === "absent" ? "#EF4444" : item.status === "late" ? "#F59E0B" : "#CBD5E1" }]} />
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{item.name}</Text>
                  {item.markedAt && (
                    <Text style={styles.markedTime}>Marked {moment(item.markedAt).format("h:mm A")}</Text>
                  )}
                </View>
                <View style={[styles.statusBadge, { backgroundColor: item.status === "present" ? "#F0FDF4" : item.status === "absent" ? "#FEF2F2" : item.status === "late" ? "#FFFBEB" : "#F8FAFC" }]}>
                  <Text style={[styles.statusText, { color: item.status === "present" ? "#10B981" : item.status === "absent" ? "#EF4444" : item.status === "late" ? "#F59E0B" : "#94A3B8" }]}>
                    {item.status.replace("_", " ").toUpperCase()}
                  </Text>
                </View>
              </TouchableOpacity>
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
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
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
