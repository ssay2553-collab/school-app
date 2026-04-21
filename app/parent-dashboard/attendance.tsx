import { doc, getDocFromCache, getDocFromServer } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { SHADOWS, COLORS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { db } from "../../firebaseConfig";
import { useRouter } from "expo-router";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";

const getTodayKey = () => new Date().toISOString().split("T")[0];

interface StudentAttendance {
  id: string;
  name: string;
  status: string;
  date: string;
  classId: string;
}

export default function AttendanceScreen() {
  const { appUser } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [studentAttendances, setStudentAttendances] = useState<StudentAttendance[]>([]);
  const [loading, setLoading] = useState(true);

  const todayKey = useMemo(() => getTodayKey(), []);
  
  const currentYear = useMemo(() => {
    const now = new Date();
    return now.getMonth() >= 7 ? `${now.getFullYear()}/${now.getFullYear() + 1}` : `${now.getFullYear() - 1}/${now.getFullYear()}`;
  }, []);
  const currentTerm = "Term 1"; 

  useEffect(() => {
    if (!appUser || appUser.role !== "parent") {
      setLoading(false);
      return;
    }

    const fetchChildrenAttendance = async () => {
      try {
        setLoading(true);
        const childUids = appUser.childrenIds || [];
        
        if (childUids.length === 0) {
          setStudentAttendances([]);
          setLoading(false);
          return;
        }

        const attendancePromises = childUids.map(async (studentId) => {
          const studentRef = doc(db, "users", studentId);
          let studentSnap;
          try {
            studentSnap = await getDocFromCache(studentRef);
          } catch {
            studentSnap = await getDocFromServer(studentRef);
          }

          if (!studentSnap.exists()) return null;
          const studentData = studentSnap.data() as any;
          const { classId, profile } = studentData;
          if (!classId || !profile) return null;

          const cleanYear = currentYear.replace(/\//g, "-");
          const cleanTerm = currentTerm.replace(/\s/g, "");
          const attendanceId = `${classId}_${cleanYear}_${cleanTerm}_${todayKey}`;
          const attendanceRef = doc(db, "attendance", attendanceId);
          
          let attendanceSnap;
          try {
            attendanceSnap = await getDocFromCache(attendanceRef);
          } catch {
            attendanceSnap = await getDocFromServer(attendanceRef);
          }

          let status = "not_marked";
          if (attendanceSnap.exists()) {
            status = (attendanceSnap.data() as any).students?.[studentId]?.status ?? "not_marked";
          }

          return {
            id: studentId,
            name: `${profile.firstName || ""} ${profile.lastName || ""}`.trim(),
            status,
            date: todayKey,
            classId
          };
        });

        const resolved = (await Promise.all(attendancePromises)).filter(Boolean) as StudentAttendance[];
        setStudentAttendances(resolved);
      } catch (err) {
        console.error(err);
        showToast({ message: "Failed to fetch attendance records.", type: "error" });
      } finally {
        setLoading(false);
      }
    };

    fetchChildrenAttendance();
  }, [appUser, todayKey, currentYear, currentTerm]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <SVGIcon name="arrow-back" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: COLORS.primary }]}>Daily Attendance</Text>
            <Text style={styles.subtitle}>{new Date().toDateString()}</Text>
          </View>
      </View>

      <FlatList
        data={studentAttendances}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20 }}
        renderItem={({ item }) => (
          <TouchableOpacity 
            activeOpacity={0.7}
            style={styles.card}
            onPress={() => router.push({
                pathname: "/attendance/summary",
                params: { 
                    studentId: item.id, 
                    classId: item.classId, 
                    studentName: item.name,
                    initialYear: currentYear,
                    initialTerm: currentTerm
                }
            })}
          >
            <View style={styles.cardHeader}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.name}</Text>
                    <View style={styles.statusRow}>
                        <View style={[styles.dot, { backgroundColor: item.status === 'present' ? '#10B981' : item.status === 'absent' ? '#EF4444' : '#94A3B8' }]} />
                        <Text style={[styles.statusText, { color: item.status === 'present' ? '#10B981' : item.status === 'absent' ? '#EF4444' : '#64748B' }]}>
                            {item.status.toUpperCase().replace("_", " ")}
                        </Text>
                    </View>
                </View>
                <View style={styles.actionIcon}>
                    <Text style={styles.viewLabel}>SUMMARY</Text>
                    <SVGIcon name="chevron-forward" size={18} color="#CBD5E1" />
                </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyCenter}>
            <View style={styles.emptyIcon}>
                <SVGIcon name="calendar" size={64} color="#CBD5E1" />
            </View>
            <Text style={styles.emptyText}>No records found for today.</Text>
            <Text style={styles.emptySub}>Attendance might not be marked yet.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FDFDFD" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  headerText: { flex: 1 },
  title: { fontSize: 22, fontWeight: "900" },
  subtitle: { fontSize: 13, color: '#64748B', fontWeight: '700', marginTop: 2 },
  card: { backgroundColor: "#fff", padding: 18, borderRadius: 24, marginBottom: 15, ...SHADOWS.small, borderWidth: 1, borderColor: '#F1F5F9' },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: COLORS.primary + '15', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { fontSize: 20, fontWeight: 'bold', color: COLORS.primary },
  name: { fontSize: 17, fontWeight: "800", color: "#1E293B" },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  actionIcon: { alignItems: 'center', flexDirection: 'row' },
  viewLabel: { fontSize: 10, fontWeight: '900', color: '#CBD5E1', marginRight: 5 },
  emptyCenter: { alignItems: 'center', marginTop: 100, paddingHorizontal: 40 },
  emptyIcon: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyText: { color: '#1E293B', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  emptySub: { color: '#94A3B8', marginTop: 8, fontSize: 14, fontWeight: '600', textAlign: 'center' }
});
