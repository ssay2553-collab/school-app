import { doc, getDocFromCache, getDocFromServer } from "firebase/firestore";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { db } from "../../firebaseConfig";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { useRouter } from "expo-router";

interface Lesson {
  id: string;
  subject: string;
  startTime: string;
  endTime: string;
}

interface TimetableDays {
  [day: string]: Lesson[];
}

interface ClassTimetable {
  days?: TimetableDays;
  numColumns?: number;
  otherActivities?: Lesson[];
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const SUBJECT_COLORS: Record<string, { bg: string, border: string }> = {
  "Mathematics": { bg: "#E0F2FE", border: "#0EA5E9" },
  "English": { bg: "#FEE2E2", border: "#EF4444" },
  "Science": { bg: "#DCFCE7", border: "#22C55E" },
  "Social Studies": { bg: "#FEF9C3", border: "#EAB308" },
  "Computing": { bg: "#F3E8FF", border: "#A855F7" },
  "RME": { bg: "#FFEDD5", border: "#F97316" },
  "Creative Arts": { bg: "#FAE8FF", border: "#D946EF" },
  "French": { bg: "#F1F5F9", border: "#64748B" },
  "History": { bg: "#FEF3C7", border: "#F59E0B" },
  "Career Technology": { bg: "#E0E7FF", border: "#6366F1" },
  "Break": { bg: "#F1F5F9", border: "#CBD5E1" },
  "Lunch": { bg: "#F1F5F9", border: "#CBD5E1" },
  "Physical Education": { bg: "#ECFDF5", border: "#10B981" },
  "ICT": { bg: "#E0F2FE", border: "#0EA5E9" },
  "Biology": { bg: "#DCFCE7", border: "#22C55E" },
  "Chemistry": { bg: "#FEF9C3", border: "#EAB308" },
  "Physics": { bg: "#F3E8FF", border: "#A855F7" },
  "Economics": { bg: "#FFEDD5", border: "#F97316" },
  "Business Studies": { bg: "#E0E7FF", border: "#6366F1" },
  "Geography": { bg: "#ECFDF5", border: "#10B981" },
  "DEFAULT": { bg: "#F8FAFC", border: "#E2E8F0" }
};

const getSubjectStyles = (subject: string) => SUBJECT_COLORS[subject] || SUBJECT_COLORS.DEFAULT;

const COLUMN_WIDTH = 150;
const DAY_COLUMN_WIDTH = 100;

export default function StudentTimetable() {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [timetable, setTimetable] = useState<ClassTimetable | null>(null);
  const [loading, setLoading] = useState(true);

  const brandColor = COLORS.brandPrimary || COLORS.primary || "#2e86de";
  const surface = SCHOOL_CONFIG.surfaceColor || "#fff";

  const fetchTimetable = useCallback(async () => {
    if (!appUser?.classId) {
      setLoading(false);
      return;
    }

    const timetableRef = doc(db, "timetables", appUser.classId);

    try {
      try {
        const cacheSnap = await getDocFromCache(timetableRef);
        if (cacheSnap.exists()) {
          setTimetable(cacheSnap.data() as ClassTimetable);
          setLoading(false);
          getDocFromServer(timetableRef).then(snap => {
            if (snap.exists()) setTimetable(snap.data() as ClassTimetable);
          }).catch(() => null);
          return;
        }
      } catch { /* Cache miss */ }

      const serverSnap = await getDocFromServer(timetableRef);
      if (serverSnap.exists()) {
        setTimetable(serverSnap.data() as ClassTimetable);
      }
    } catch (error) {
      console.error("Timetable fetch error:", error);
      showToast({ message: "Failed to load timetable.", type: "error" });
    } finally {
      setLoading(false);
    }
  }, [appUser?.classId]);

  useEffect(() => {
    fetchTimetable();
  }, [fetchTimetable]);

  const numColumns = timetable?.numColumns || 6;
  const timetableDays = timetable?.days || {};

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: surface }]}>
        <ActivityIndicator size="large" color={brandColor} />
        <Text style={{ marginTop: 10, color: '#64748B' }}>Syncing your schedule...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: surface }]} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <View style={[styles.header, { borderLeftWidth: 5, borderLeftColor: brandColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <SVGIcon name="arrow-back" size={24} color={brandColor} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Timetable</Text>
        <SVGIcon name="calendar" size={24} color={brandColor} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* Header Row */}
          <View style={styles.gridHeader}>
            <View style={[styles.gridCell, { width: DAY_COLUMN_WIDTH, backgroundColor: "#F1F5F9", height: 110 }]}>
              <Text style={styles.gridHeaderText}>DAY</Text>
            </View>
            {Array.from({ length: numColumns }).map((_, i) => {
              // Use Monday's times as representative for headers
              const firstDayPeriod = timetableDays["Monday"]?.[i];
              return (
                <View key={i} style={[styles.gridCell, { width: COLUMN_WIDTH, backgroundColor: "#F1F5F9", height: 110 }]}>
                  <Text style={styles.gridHeaderText}>PERIOD {i + 1}</Text>
                  <View style={styles.timeControlRow}>
                    <Text style={styles.timeText}>{firstDayPeriod?.startTime || "Start"}</Text>
                    <Text style={{fontSize: 10, color: "#94A3B8"}}>-</Text>
                    <Text style={styles.timeText}>{firstDayPeriod?.endTime || "End"}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {DAYS.map(day => (
              <View key={day} style={styles.gridRow}>
                <View style={[styles.gridCell, { width: DAY_COLUMN_WIDTH, backgroundColor: "#fff" }]}>
                  <Text style={styles.dayText}>{day.substring(0, 3).toUpperCase()}</Text>
                </View>
                {Array.from({ length: numColumns }).map((_, i) => {
                  const period = timetableDays[day]?.[i] || { subject: "" };
                  const subjectName = period.subject;
                  const styles_ = getSubjectStyles(subjectName);
                  const isNotEmpty = !!subjectName;

                  return (
                    <View
                      key={i}
                      style={[
                        styles.gridCell,
                        {
                          width: COLUMN_WIDTH,
                          backgroundColor: styles_.bg,
                          borderBottomWidth: 1,
                          borderBottomColor: '#E2E8F0',
                          borderLeftWidth: isNotEmpty ? 4 : 0,
                          borderLeftColor: styles_.border,
                        }
                      ]}
                    >
                      <Text style={[styles.periodText, !subjectName && { color: "#CBD5E1" }]} numberOfLines={2}>
                        {subjectName || "-"}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ))}

            {timetable?.otherActivities && timetable.otherActivities.length > 0 && (
                <View style={styles.otherSection}>
                    <Text style={styles.otherTitle}>DAILY EVENTS & BREAKS</Text>
                    {timetable.otherActivities.map((act, idx) => (
                        <View key={idx} style={styles.otherRow}>
                            <View style={[styles.otherIcon, { backgroundColor: brandColor + '15' }]}>
                                <SVGIcon name="time-outline" size={16} color={brandColor} />
                            </View>
                            <View>
                                <Text style={styles.otherSubject}>{act.subject}</Text>
                                <Text style={styles.otherTime}>{act.startTime} – {act.endTime}</Text>
                            </View>
                        </View>
                    ))}
                </View>
            )}
          </ScrollView>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerInfo}>Swipe horizontally to see all periods</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    height: 65,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    ...SHADOWS.small,
  },
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#1E293B" },
  backBtn: { padding: 5 },
  gridHeader: { flexDirection: "row" },
  gridRow: { flexDirection: "row" },
  gridCell: {
    height: 90,
    padding: 10,
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#E2E8F0",
    position: 'relative'
  },
  gridHeaderText: { fontSize: 11, fontWeight: "900", color: "#64748B" },
  timeControlRow: {
    alignItems: 'center',
    marginTop: 8
  },
  timeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B'
  },
  dayText: { fontSize: 13, fontWeight: "900", color: "#1E293B" },
  periodText: { fontSize: 13, fontWeight: "800", textAlign: "center", color: "#1E293B" },
  subjectAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  otherSection: { padding: 20, backgroundColor: "#F8FAFC" },
  otherTitle: { fontSize: 11, fontWeight: "900", color: "#64748B", marginBottom: 15, letterSpacing: 1 },
  otherRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  otherIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  otherSubject: { fontSize: 14, fontWeight: "800", color: "#1E293B" },
  otherTime: { fontSize: 12, color: "#64748B", fontWeight: '600', marginTop: 2 },
  footer: { padding: 10, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  footerInfo: { fontSize: 10, color: '#94A3B8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }
});
