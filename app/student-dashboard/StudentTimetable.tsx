import { doc, getDocFromCache, getDocFromServer } from "firebase/firestore";
import React, { useCallback, useEffect, useState, useMemo } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { db } from "../../firebaseConfig";
import { SCHOOL_CONFIG } from "../../constants/Config";

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
  timetableDays?: TimetableDays;
  otherActivities?: Lesson[];
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const SUBJECT_COLORS: Record<string, string> = {
  "Mathematics": "#E0F2FE", "English": "#FEE2E2", "Science": "#DCFCE7",
  "Social Studies": "#FEF9C3", "Computing": "#F3E8FF", "RME": "#FFEDD5",
  "Creative Arts": "#FAE8FF", "French": "#F1F5F9", "History": "#FEF3C7",
  "Career Technology": "#E0E7FF", "Break": "#F1F5F9", "Lunch": "#F1F5F9",
  "Physical Education": "#ECFDF5", "ICT": "#E0F2FE", "Biology": "#DCFCE7",
  "Chemistry": "#FEF9C3", "Physics": "#F3E8FF", "Economics": "#FFEDD5",
  "Business Studies": "#E0E7FF", "Geography": "#ECFDF5", "DEFAULT": "#F8FAFC"
};

const getSubjectColor = (subject: string) => SUBJECT_COLORS[subject] || SUBJECT_COLORS.DEFAULT;

// RAM Optimization: Memoize the card component
const TimetableCard = React.memo(({ item, type = 'lesson' }: { item: Lesson, type?: 'lesson' | 'other' }) => {
  const brandColor = COLORS.brandPrimary || COLORS.primary;
  const bgColor = getSubjectColor(item.subject);
  const isOther = type === 'other';
  
  return (
    <View style={[
      styles.lessonCard, 
      { backgroundColor: isOther ? '#F1F5F9' : (bgColor === "#F8FAFC" ? "#fff" : bgColor) },
      isOther && { borderStyle: 'dashed' }
    ]}>
      <View style={[styles.timeColumn, { borderRightColor: 'rgba(0,0,0,0.05)' }]}>
        <Text style={styles.startTime}>{item.startTime.split(' ')[0]}</Text>
        <Text style={styles.amPm}>{item.startTime.split(' ')[1]}</Text>
      </View>
      <View style={styles.lessonInfo}>
        <Text style={[styles.lessonSubject, isOther && { color: '#64748B' }]}>{item.subject}</Text>
        <View style={styles.durationRow}>
          <SVGIcon name="time-outline" size={12} color={isOther ? "#94A3B8" : "#64748B"} />
          <Text style={styles.durationText}>{item.startTime} – {item.endTime}</Text>
        </View>
      </View>
      <View style={[styles.statusIndicator, { backgroundColor: isOther ? '#94A3B8' : brandColor }]} />
    </View>
  );
});

export default function StudentTimetable() {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const [timetable, setTimetable] = useState<ClassTimetable | null>(null);
  const [selectedDay, setSelectedDay] = useState("");
  const [loading, setLoading] = useState(true);

  const brandColor = COLORS.brandPrimary || COLORS.primary;
  const surface = SCHOOL_CONFIG.surfaceColor;

  useEffect(() => {
    const today = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date());
    setSelectedDay(DAYS.includes(today) ? today : "Monday");
  }, []);

  const fetchTimetable = useCallback(async () => {
    if (!appUser?.classId) {
      setLoading(false);
      return;
    }

    const timetableRef = doc(db, "timetables", appUser.classId);

    try {
      // COST OPTIMIZATION: Try cache first to save on Firestore read billing
      try {
        const cacheSnap = await getDocFromCache(timetableRef);
        if (cacheSnap.exists()) {
          setTimetable(cacheSnap.data() as ClassTimetable);
          setLoading(false);
          // Background sync
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

  const currentLessons = useMemo(() => 
    timetable?.timetableDays?.[selectedDay] || [], 
  [timetable, selectedDay]);
  
  const otherActs = useMemo(() => 
    timetable?.otherActivities || [], 
  [timetable]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: surface }]}>
        <ActivityIndicator size="large" color={brandColor} />
        <Text style={{ marginTop: 10, color: '#64748B' }}>Syncing your schedule...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: surface }]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.classHeader}>My Timetable</Text>
        <SVGIcon name="calendar" size={24} color={brandColor} />
      </View>

      <View style={{ marginBottom: 20, paddingHorizontal: 16 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daySelector}>
          {DAYS.map((day) => (
            <TouchableOpacity
              key={day}
              onPress={() => setSelectedDay(day)}
              style={[styles.dayTab, selectedDay === day && { backgroundColor: brandColor, borderColor: brandColor }]}
            >
              <Text style={[styles.dayTabText, selectedDay === day && styles.activeDayTabText]}>
                {day.substring(0, 3)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        removeClippedSubviews={true} // RAM Optimization
      >
        <View style={styles.dayBlock}>
          <Text style={styles.dayTitle}>{selectedDay} Lessons</Text>
          
          {currentLessons.length === 0 && otherActs.length === 0 ? (
            <View style={styles.emptyState}>
              <SVGIcon name="cafe" size={60} color="#CBD5E1" />
              <Text style={styles.emptyText}>No lessons scheduled today.</Text>
            </View>
          ) : (
            <>
              {currentLessons.map((lesson, index) => (
                <TimetableCard key={`lesson-${index}`} item={lesson} />
              ))}

              {otherActs.length > 0 && (
                <View style={{ marginTop: 20 }}>
                  <Text style={[styles.dayTitle, { fontSize: 14 }]}>Daily Events & Breaks</Text>
                  {otherActs.map((act, index) => (
                    <TimetableCard key={`act-${index}`} item={act} type="other" />
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 10 },
  classHeader: { fontSize: 22, fontWeight: "900", color: "#1E293B" },
  daySelector: { paddingVertical: 5 },
  dayTab: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 15, backgroundColor: "#fff", marginRight: 10, borderWidth: 1, borderColor: "#E2E8F0", ...SHADOWS.small },
  dayTabText: { fontSize: 13, fontWeight: "700", color: "#64748B" },
  activeDayTabText: { color: "#fff" },
  dayBlock: { flex: 1 },
  dayTitle: { fontSize: 18, fontWeight: "900", color: "#475569", marginBottom: 15, marginTop: 10 },
  lessonCard: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 20, backgroundColor: "#fff", marginBottom: 12, ...SHADOWS.small, borderWidth: 1, borderColor: 'rgba(0,0,0,0.03)' },
  timeColumn: { width: 65, borderRightWidth: 1, alignItems: 'center', marginRight: 15, paddingRight: 10 },
  startTime: { fontSize: 16, fontWeight: '900', color: '#1E293B' },
  amPm: { fontSize: 9, fontWeight: 'bold', color: '#94A3B8', textTransform: 'uppercase' },
  lessonInfo: { flex: 1 },
  lessonSubject: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  durationText: { fontSize: 12, color: "#64748B", fontWeight: '500' },
  statusIndicator: { width: 4, height: 30, borderRadius: 2, marginLeft: 10 },
  emptyState: { alignItems: "center", marginTop: 60 },
  emptyText: { fontSize: 14, color: "#94A3B8", marginTop: 10, fontWeight: '500' },
});
