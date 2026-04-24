import { collection, query, where } from "firebase/firestore";
import { useRouter } from "expo-router";
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
  RefreshControl,
  Platform,
  useWindowDimensions,
} from "react-native";
import SVGIcon from "../../components/SVGIcon";
import { SHADOWS, COLORS } from "../../constants/theme";
import { db } from "../../firebaseConfig";
import { sortClasses } from "../../lib/classHelpers";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { useAuth } from "../../contexts/AuthContext";
import moment from "moment";
import { LinearGradient } from "expo-linear-gradient";
import * as Animatable from "react-native-animatable";
import { getDocsCacheFirst } from "../../lib/firestoreHelpers";

import { useAcademicConfig } from "../../hooks/useAcademicConfig";

interface ClassStat {
  id: string;
  name: string;
  totalStudents: number;
  present: number;
  absent: number;
  marked: boolean;
}

const CLASS_COLORS = [
  "#6366F1", "#EC4899", "#F59E0B", "#10B981", "#8B5CF6", 
  "#3B82F6", "#F43F5E", "#06B6D4", "#84CC16", "#D946EF",
  "#F97316", "#14B8A6"
];

export default function AttendanceOverview() {
  const router = useRouter();
  const { appUser } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(moment().format("YYYY-MM-DD"));
  
  const acadConfig = useAcademicConfig();
  const [classStats, setClassStats] = useState<ClassStat[]>([]);
  const [totals, setTotals] = useState({
    schoolTotal: 0,
    schoolPresent: 0,
    schoolAbsent: 0
  });

  const isDesktop = windowWidth > 1000;
  const numColumns = isDesktop ? 4 : (windowWidth > 600 ? 2 : 1);

  const primary = SCHOOL_CONFIG.primaryColor;
  const brandPrimary = SCHOOL_CONFIG.brandPrimary;
  const brandSecondary = SCHOOL_CONFIG.brandSecondary;

  /**
   * COST OPTIMIZATION:
   * 1. Uses getDocsCacheFirst for Classes and Students (Static/Semi-static data).
   * 2. Only fetches Attendance records (Dynamic data) from server when needed.
   */
  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!appUser) return;
    if (!forceRefresh) setLoading(true);

    try {
      // 1. Fetch Classes (Cache-First)
      const classesSnap = await getDocsCacheFirst(collection(db, "classes") as any);
      let classList = classesSnap.docs.map(d => ({
        id: d.id,
        name: (d.data() as any).name || d.id,
        totalStudents: 0,
        present: 0,
        absent: 0,
        marked: false
      }));

      // 2. Fetch Students (Cache-First) - This is the most expensive read, now optimized
      const studentsQuery = query(collection(db, "users"), where("role", "==", "student"));
      const studentsSnap = await getDocsCacheFirst(studentsQuery as any);
      
      const studentCounts: Record<string, number> = {};
      let globalStudentTotal = 0;

      studentsSnap.forEach(doc => {
        const data = doc.data() as any;
        if (data.classId) {
          studentCounts[data.classId] = (studentCounts[data.classId] || 0) + 1;
          globalStudentTotal++;
        }
      });

      // 3. Fetch Attendance (Server-side for accurate daily tracking)
      const attendanceQuery = query(
        collection(db, "attendance"),
        where("date", "==", selectedDate)
      );
      // For attendance, we don't use cache-first by default to ensure we see the latest marks
      const attendanceSnap = await getDocsCacheFirst(attendanceQuery as any); 
      
      const attendanceMap: Record<string, { present: number, absent: number }> = {};

      attendanceSnap.forEach(doc => {
        const data = doc.data() as any;
        const cid = data.classId;
        const students = data.students || {};
        let p = 0, a = 0;
        
        Object.values(students).forEach((s: any) => {
          if (s.status === "present") p++;
          else if (s.status === "absent") a++;
        });
        
        attendanceMap[cid] = { present: p, absent: a };
      });

      let globalPresent = 0;
      let globalAbsent = 0;

      const finalStats = classList.map(cls => {
        const att = attendanceMap[cls.id];
        const totalInClass = studentCounts[cls.id] || 0;
        if (att) { globalPresent += att.present; globalAbsent += att.absent; }

        return {
          ...cls,
          totalStudents: totalInClass,
          present: att ? att.present : 0,
          absent: att ? att.absent : 0,
          marked: !!att
        };
      });

      setClassStats(sortClasses(finalStats));
      setTotals({ schoolTotal: globalStudentTotal, schoolPresent: globalPresent, schoolAbsent: globalAbsent });
    } catch (error) { 
      console.error("Attendance Fetch Error:", error); 
    } finally { 
      setLoading(false); 
      setRefreshing(false); 
    }
  }, [selectedDate, appUser]);

  useEffect(() => { fetchData(false); }, [fetchData]);

  const changeDate = (days: number) => {
    setSelectedDate(moment(selectedDate).add(days, 'days').format("YYYY-MM-DD"));
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(true);
  };

  if (!appUser) return null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.headerWrapper}>
        <LinearGradient 
          colors={[brandPrimary, brandSecondary]} 
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} 
          style={styles.header}
        >
          <View style={[styles.headerContent, isDesktop && styles.maxContainer]}>
            <View style={styles.headerTop}>
              <TouchableOpacity onPress={() => router.back()} style={styles.miniBtn}>
                <SVGIcon name="arrow-back" size={20} color="#fff" />
              </TouchableOpacity>
              <View style={styles.titleCenter}>
                <Text style={styles.headerTitle}>Attendance Tracking</Text>
                <Text style={styles.headerDate}>{moment(selectedDate).format("dddd, MMM Do, YYYY")}</Text>
              </View>
              <TouchableOpacity onPress={onRefresh} style={styles.miniBtn}>
                <SVGIcon name="refresh" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.statsStrip}>
              <View style={[styles.statPill, { backgroundColor: '#fff' }]}>
                <Text style={[styles.pillValue, { color: primary }]}>{totals.schoolTotal}</Text>
                <Text style={[styles.pillLabel, { color: COLORS.muted }]}>TOTAL</Text>
              </View>
              <View style={[styles.statPill, { backgroundColor: COLORS.green }]}>
                <Text style={[styles.pillValue, { color: '#fff' }]}>{totals.schoolPresent}</Text>
                <Text style={[styles.pillLabel, { color: 'rgba(255,255,255,0.8)' }]}>PRESENT</Text>
              </View>
              <View style={[styles.statPill, { backgroundColor: COLORS.danger }]}>
                <Text style={[styles.pillValue, { color: '#fff' }]}>{totals.schoolAbsent}</Text>
                <Text style={[styles.pillLabel, { color: 'rgba(255,255,255,0.8)' }]}>ABSENT</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>

      <View style={[styles.dateControlContainer, isDesktop && styles.maxContainer]}>
        <View style={styles.dateControl}>
          <TouchableOpacity onPress={() => changeDate(-1)} style={styles.dateBtn}>
            <SVGIcon name="chevron-back" size={18} color={primary} />
          </TouchableOpacity>
          <View style={styles.dateDisplay}>
            <SVGIcon name="calendar" size={16} color={primary} />
            <Text style={styles.dateText}>{moment(selectedDate).isSame(moment(), 'day') ? "Today" : moment(selectedDate).format("ddd, MMM DD")}</Text>
          </View>
          <TouchableOpacity onPress={() => changeDate(1)} style={styles.dateBtn}>
            <SVGIcon name="chevron-forward" size={18} color={primary} />
          </TouchableOpacity>
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}><ActivityIndicator size="large" color={primary} /></View>
      ) : (
        <FlatList
          key={numColumns} 
          data={classStats}
          keyExtractor={item => item.id}
          numColumns={numColumns}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[primary]} />}
          contentContainerStyle={[styles.list, isDesktop && styles.maxContainer]}
          columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
          renderItem={({ item, index }) => {
            const cardColor = CLASS_COLORS[index % CLASS_COLORS.length];
            const attendanceRate = item.totalStudents > 0 ? (item.present / item.totalStudents) : 0;
            
            return (
              <Animatable.View 
                animation="fadeInUp" 
                duration={400} 
                delay={index * 20} 
                style={[styles.cardContainer, numColumns > 1 && { width: `${100 / numColumns - 2}%` }]}
              >
                <TouchableOpacity 
                  style={[styles.classCard, { backgroundColor: cardColor + '05' }]} 
                  activeOpacity={0.9}
                  onPress={() => router.push({
                    pathname: "/admin-dashboard/attendance-details",
                    params: {
                      classId: item.id,
                      className: item.name,
                      date: selectedDate,
                      academicYear: acadConfig.academicYear,
                      term: acadConfig.currentTerm
                    }
                  })}
                >
                  <View style={[styles.cardHeaderStrip, { backgroundColor: cardColor }]}>
                    <SVGIcon name="school" size={18} color="#fff" />
                    <Text style={styles.classNameWhite} numberOfLines={1}>{item.name}</Text>
                    <View style={styles.whiteStatusBadge}>
                      <Text style={[styles.statusTextMini, { color: cardColor }]}>
                        {item.marked ? "MARKED" : "NOT MARKED"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardBody}>
                    <View style={styles.mainMetrics}>
                      <View style={styles.metric}>
                        <Text style={[styles.metricVal, { color: cardColor }]}>{item.present}</Text>
                        <Text style={styles.metricLab}>Present</Text>
                      </View>
                      <View style={styles.metricSep} />
                      <View style={styles.metric}>
                        <Text style={[styles.metricVal, { color: '#EF4444' }]}>{item.absent}</Text>
                        <Text style={styles.metricLab}>Absent</Text>
                      </View>
                      <View style={styles.metricSep} />
                      <View style={styles.metric}>
                        <Text style={[styles.metricVal, { color: '#64748B' }]}>{item.totalStudents}</Text>
                        <Text style={styles.metricLab}>Total</Text>
                      </View>
                    </View>

                    <View style={styles.progressSection}>
                      <View style={styles.progressInfo}>
                        <Text style={[styles.rateText, { color: cardColor }]}>{item.totalStudents > 0 ? Math.round((item.present / item.totalStudents) * 100) : 0}% Present</Text>
                      </View>
                      <View style={styles.barContainer}>
                        <View style={styles.barBg}>
                          <View style={[styles.barFill, { backgroundColor: cardColor, width: `${attendanceRate * 100}%` }]} />
                        </View>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              </Animatable.View>
            );
          }}
          ListEmptyComponent={<View style={styles.empty}><SVGIcon name="people" size={64} color="#CBD5E1" /><Text style={styles.emptyTitle}>No Records Found</Text></View>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  maxContainer: { maxWidth: 1400, alignSelf: 'center', width: '100%' },
  headerWrapper: { borderBottomLeftRadius: 25, borderBottomRightRadius: 25, ...SHADOWS.medium, overflow: 'hidden' },
  header: { paddingHorizontal: 20, paddingVertical: 20, paddingTop: Platform.OS === 'ios' ? 10 : 30 },
  headerContent: { width: '100%' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  miniBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  titleCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#fff' },
  headerDate: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '600', marginTop: 2 },
  statsStrip: { flexDirection: 'row', gap: 12, marginTop: 10 },
  statPill: { flex: 1, padding: 12, borderRadius: 18, alignItems: 'center', ...SHADOWS.small },
  pillValue: { fontSize: 18, fontWeight: '900' },
  pillLabel: { fontSize: 8, fontWeight: '900', marginTop: 2, letterSpacing: 0.5 },
  dateControlContainer: { padding: 15 },
  dateControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 20, padding: 5, ...SHADOWS.small, borderWidth: 1, borderColor: '#F1F5F9' },
  dateBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  dateDisplay: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  dateText: { fontSize: 15, fontWeight: '800', color: '#1E293B' },
  list: { padding: 15, paddingBottom: 100 },
  columnWrapper: { justifyContent: 'space-between' },
  cardContainer: { marginBottom: 15 },
  classCard: { borderRadius: 25, overflow: 'hidden', ...SHADOWS.small, borderWidth: 1, borderColor: '#F1F5F9' },
  cardHeaderStrip: { flexDirection: 'row', alignItems: 'center', padding: 15, gap: 10 },
  classNameWhite: { flex: 1, fontSize: 16, fontWeight: '900', color: '#fff' },
  whiteStatusBadge: { backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusTextMini: { fontSize: 9, fontWeight: '900' },
  cardBody: { padding: 20, backgroundColor: '#fff' },
  mainMetrics: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  metric: { alignItems: 'center', flex: 1 },
  metricVal: { fontSize: 20, fontWeight: '900' },
  metricLab: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 2 },
  metricSep: { width: 1, height: 30, backgroundColor: '#F1F5F9' },
  progressSection: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 15 },
  progressInfo: { marginBottom: 8 },
  rateText: { fontSize: 12, fontWeight: '800' },
  barContainer: { height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden' },
  barBg: { flex: 1, backgroundColor: '#F1F5F9' },
  barFill: { height: '100%', borderRadius: 4 },
  empty: { alignItems: 'center', marginTop: 100 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#94A3B8', marginTop: 15 },
});
