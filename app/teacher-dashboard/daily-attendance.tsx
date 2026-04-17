import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  startAfter,
  where,
  writeBatch
} from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from "react-native";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebaseConfig";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Animatable from "react-native-animatable";
import { useRouter } from "expo-router";
import moment from "moment";
import { SVGIcon } from "../../components/SVGIcon";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";

const FILTERS_KEY = "@attendance_filters_v1";

const sortClasses = (list: any[]) => {
  return [...list].sort((a, b) => {
    const nameA = (a.name || "").toUpperCase();
    const nameB = (b.name || "").toUpperCase();
    const levelOrder: Record<string, number> = {
      'CRECHE': 1, 'NURSERY': 2, 'KG': 3, 'CLASS': 4, 'PRIMARY': 4, 'GRADE': 4, 'BASIC': 4, 'JHS': 5, 'SHS': 6
    };
    const getPriority = (name: string) => {
      for (const key in levelOrder) {
        if (name.includes(key)) return levelOrder[key];
      }
      return 10;
    };
    const prioA = getPriority(nameA);
    const prioB = getPriority(nameB);
    if (prioA !== prioB) return prioA - prioB;
    const numA = parseInt(nameA.replace(/[^0-9]/g, "")) || 0;
    const numB = parseInt(nameB.replace(/[^0-9]/g, "")) || 0;
    if (numA !== numB) return numA - numB;
    return nameA.localeCompare(nameB);
  });
};

export default function DailyAttendanceScreen() {
  const { appUser } = useAuth();
  const router = useRouter();
  const acadConfig = useAcademicConfig();

  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);

  const [classId, setClassId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(moment().format("YYYY-MM-DD"));
  const [academicYear, setAcademicYear] = useState("");
  const [term, setTerm] = useState<string>("");
  const [availableClasses, setAvailableClasses] = useState<{ id: string; name: string; classTeacherId?: string }[]>([]);
  
  const [localAttendance, setLocalAttendance] = useState<Record<string, any>>({});
  const [serverAttendance, setServerAttendance] = useState<Record<string, any>>({});

  const lastVisibleRef = useRef<any>(null);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);

  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(localAttendance) !== JSON.stringify(serverAttendance);
  }, [localAttendance, serverAttendance]);

  useEffect(() => {
    const onBackPress = () => {
      if (hasUnsavedChanges) {
        Alert.alert(
          "Unsaved Changes",
          "You have unsaved attendance data. Are you sure you want to leave?",
          [
            { text: "Stay", style: "cancel" },
            {
              text: "Leave",
              style: "destructive",
              onPress: () => router.back()
            }
          ]
        );
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => subscription.remove();
  }, [hasUnsavedChanges]);

  const isOfficialClassTeacher = useMemo(() => {
    if (!classId || !appUser) return false;
    const selectedClass = availableClasses.find(c => c.id === classId);
    return selectedClass?.classTeacherId === appUser.uid || appUser.classTeacherOf === classId || appUser.role === "admin";
  }, [classId, availableClasses, appUser]);

  useEffect(() => {
    if (!appUser) return;
    const loadClasses = async () => {
      try {
        let q;
        if (appUser.role === "admin") {
            q = query(collection(db, "classes"));
        } else {
            const teacherClasses = appUser.classes || [];
            if (teacherClasses.length === 0) {
              setLoading(false);
              return;
            }
            // Firestore 'in' query limit is 30.
            const chunkedClasses = teacherClasses.slice(0, 30);
            q = query(collection(db, "classes"), where("__name__", "in", chunkedClasses));
        }
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({
          id: d.id,
          name: d.data().name || d.id,
          classTeacherId: d.data().classTeacherId
        }));
        const sorted = sortClasses(list);
        setAvailableClasses(sorted);

        if (sorted.length > 0) {
          setClassId(prev => prev || sorted[0].id);
        } else {
          setLoading(false);
        }
      } catch (e) {
        console.error("Load classes error:", e);
        setLoading(false);
      }
    };
    loadClasses();
  }, [appUser]);

  const fetchStudents = useCallback(async (isFirstLoad = false) => {
    if (!classId) {
      if (isFirstLoad) setLoading(false);
      return;
    }
    if (!isFirstLoad && (!hasMoreRef.current || loadingMoreRef.current)) return;

    if (isFirstLoad) { setLoading(true); lastVisibleRef.current = null; hasMoreRef.current = true; }
    else { setLoadingMore(true); loadingMoreRef.current = true; }

    try {
      const constraints: any[] = [where("role", "==", "student"), where("classId", "==", classId), limit(30)];
      if (!isFirstLoad && lastVisibleRef.current) constraints.push(startAfter(lastVisibleRef.current));
      
      const q = query(collection(db, "users"), ...constraints);
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      const newLastVisible = snap.docs[snap.docs.length - 1] || null;
      const newHasMore = snap.docs.length === 30;

      setStudents(prev => isFirstLoad ? data : [...prev, ...data]);
      lastVisibleRef.current = newLastVisible;
      hasMoreRef.current = newHasMore;
    } catch (e) {
        console.error("Fetch students error:", e);
    } finally { setLoading(false); setLoadingMore(false); loadingMoreRef.current = false; }
  }, [classId]);

  useEffect(() => { fetchStudents(true); }, [classId, fetchStudents]);

  useEffect(() => {
    if (!classId || !academicYear || !term || !selectedDate) return;
    const loadAttendance = async () => {
      try {
        const cleanYear = academicYear.replace(/\//g, "-");
        const cleanTerm = term.replace(/\s/g, "");
        const attendanceId = `${classId}_${cleanYear}_${cleanTerm}_${selectedDate}`;
        
        const ref = doc(db, "attendance", attendanceId);
        const snap = await getDoc(ref);
        const data = snap.exists() ? snap.data() : { students: {} };
        setServerAttendance(data.students || {});
        setLocalAttendance(data.students || {});
      } catch (e) { console.error(e); }
    };
    loadAttendance();
  }, [classId, selectedDate, academicYear, term]);

  const changeDate = (days: number) => {
    const newDate = moment(selectedDate).add(days, 'days').format("YYYY-MM-DD");
    setSelectedDate(newDate);
  };

  const markLocal = (studentId: string, status: "present" | "absent") => {
    if (!isOfficialClassTeacher) return Alert.alert("Restricted", "Only assigned Class Teacher/Admin can mark attendance.");
    
    setLocalAttendance(prev => ({
      ...prev,
      [studentId]: { status, markedAt: new Date().toISOString() }
    }));
  };

  const saveToFirestore = async () => {
    if (!classId || !appUser || !academicYear || !term) return;
    setSaving(true);
    try {
      const cleanYear = academicYear.replace(/\//g, "-");
      const cleanTerm = term.replace(/\s/g, "");
      const attendanceId = `${classId}_${cleanYear}_${cleanTerm}_${selectedDate}`;
      
      const batch = writeBatch(db);
      const ref = doc(db, "attendance", attendanceId);
      
      batch.set(ref, {
        classId,
        date: selectedDate,
        academicYear,
        term,
        markedBy: appUser.uid,
        lastUpdated: serverTimestamp(),
        students: localAttendance
      }, { merge: true });

      await batch.commit();
      setServerAttendance(localAttendance);
      Alert.alert("Success", "Attendance saved for " + moment(selectedDate).format("MMM Do"));
    } catch (e) {
      Alert.alert("Error", "Failed to save. Check your connection.");
    } finally {
      setSaving(false);
    }
  };

  const renderStudentItem = ({ item, index }: { item: any, index: number }) => {
    const status = localAttendance[item.id]?.status ?? "not_marked";
    const isUnsaved = localAttendance[item.id]?.status !== serverAttendance[item.id]?.status;
    const cardStatusStyle = status === "present" ? styles.presentCard : status === "absent" ? styles.absentCard : {};

    return (
      <Animatable.View
        animation="fadeInUp"
        delay={Math.min(index * 50, 500)}
        duration={400}
        style={[styles.card, cardStatusStyle, isUnsaved && styles.unsavedCard]}
      >
        <View style={styles.cardInfo}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {item.profile?.firstName?.[0] || ""}{item.profile?.lastName?.[0] || ""}
            </Text>
          </View>
          <View style={{ flex: 1, marginLeft: 15 }}>
            <Text style={styles.name}>{item.profile?.firstName || "Student"} {item.profile?.lastName || ""}</Text>
            <View style={styles.statusBadge}>
               <View style={[styles.statusDot, { backgroundColor: status === "present" ? "#10B981" : status === "absent" ? "#EF4444" : "#94A3B8" }]} />
               <Text style={styles.statusLabel}>{(status || "NOT_MARKED").toUpperCase()}</Text>
               {isUnsaved && <Text style={styles.unsavedTag}> • Unsaved</Text>}
            </View>
          </View>
        </View>

        {isOfficialClassTeacher && (
          <View style={styles.actions}>
            <TouchableOpacity 
              style={[styles.actionBtn, status === "present" && styles.presentActive]} 
              onPress={() => markLocal(item.id, "present")}
              activeOpacity={0.7}
            >
              <SVGIcon name="checkmark-circle" size={20} color={status === 'present' ? '#fff' : '#10B981'} />
              <Text style={[styles.actionBtnText, status === "present" && {color: "#fff"}]}>Present</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionBtn, status === "absent" && styles.absentActive]} 
              onPress={() => markLocal(item.id, "absent")}
              activeOpacity={0.7}
            >
              <SVGIcon name="close-circle" size={20} color={status === 'absent' ? '#fff' : '#EF4444'} />
              <Text style={[styles.actionBtnText, status === "absent" && {color: "#fff"}]}>Absent</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animatable.View>
    );
  };

  if (loading && students.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ marginTop: 10, color: '#64748B' }}>Loading Class List...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}><SVGIcon name="arrow-back" size={24} color="#1E293B" /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Daily Attendance</Text>
          <Text style={styles.subtitle}>{academicYear} • {term}</Text>
        </View>
      </View>

      <View style={styles.dateBar}>
         <TouchableOpacity onPress={() => changeDate(-1)} style={styles.dateNavBtn}><SVGIcon name="chevron-back" size={20} color="#64748B" /></TouchableOpacity>
         <View style={styles.dateDisplay}>
            <SVGIcon name="calendar-outline" size={18} color={COLORS.primary} />
            <Text style={styles.dateText}>{moment(selectedDate).format("dddd, MMMM D, YYYY")}</Text>
         </View>
         <TouchableOpacity onPress={() => changeDate(1)} style={styles.dateNavBtn}><SVGIcon name="chevron-forward" size={20} color="#64748B" /></TouchableOpacity>
      </View>

      <View style={styles.filterArea}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.classScroll}>
           {availableClasses.map(c => (
             <TouchableOpacity key={c.id} onPress={() => setClassId(c.id)} style={[styles.classChip, classId === c.id && styles.classChipActive]}>
                <Text style={[styles.classChipText, classId === c.id && styles.classChipTextActive]}>{c.name}</Text>
             </TouchableOpacity>
           ))}
        </ScrollView>
      </View>

      <FlatList
        data={students}
        renderItem={renderStudentItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        onEndReached={() => fetchStudents()}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ padding: 20 }} color={COLORS.primary} /> : null}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>No students found in this class.</Text></View>}
      />

      {hasUnsavedChanges && (
        <Animatable.View animation="slideInUp" duration={400} style={styles.footerAction}>
           <TouchableOpacity style={styles.saveBtn} onPress={saveToFirestore} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <><SVGIcon name="cloud-upload" size={20} color="#fff" /><Text style={styles.saveBtnText}>Save Changes Now</Text></>}
           </TouchableOpacity>
        </Animatable.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  title: { fontSize: 20, fontWeight: '900', color: '#1E293B' },
  subtitle: { fontSize: 12, color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  dateBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, backgroundColor: '#fff', margin: 15, borderRadius: 18, ...SHADOWS.small },
  dateNavBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  dateDisplay: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateText: { fontSize: 14, fontWeight: '800', color: '#1E293B' },
  filterArea: { backgroundColor: '#fff', paddingBottom: 15 },
  classScroll: { paddingHorizontal: 20, gap: 12 },
  classChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 15, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  classChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  classChipText: { fontSize: 13, fontWeight: '800', color: '#64748B' },
  classChipTextActive: { color: '#fff' },
  list: { padding: 20, paddingBottom: 100 },
  card: { backgroundColor: '#fff', borderRadius: 22, padding: 16, marginBottom: 15, ...SHADOWS.small, borderWidth: 1, borderColor: '#F1F5F9' },
  presentCard: { borderColor: '#10B981', backgroundColor: '#F0FDF4' },
  absentCard: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  unsavedCard: { borderStyle: 'dashed', borderWidth: 2 },
  cardInfo: { flexDirection: 'row', alignItems: 'center' },
  avatarPlaceholder: { width: 50, height: 50, borderRadius: 18, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 16, fontWeight: '900', color: COLORS.primary },
  name: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusLabel: { fontSize: 10, fontWeight: '900', color: '#64748B', letterSpacing: 0.5 },
  unsavedTag: { fontSize: 10, fontWeight: '900', color: COLORS.primary },
  actions: { flexDirection: 'row', marginTop: 15, gap: 10 },
  actionBtn: { flex: 1, height: 48, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F8FAFC' },
  actionBtnText: { fontSize: 14, fontWeight: '800' },
  presentActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
  absentActive: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
  footerAction: { position: 'absolute', bottom: 25, left: 20, right: 20, ...SHADOWS.large },
  saveBtn: { backgroundColor: COLORS.primary, height: 65, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#94A3B8', fontWeight: '600' }
});
