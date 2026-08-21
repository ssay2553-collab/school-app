import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { collection, getDocs, query, where } from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
  BackHandler,
} from "react-native";
import * as Animatable from "react-native-animatable";
import { SafeAreaView } from "react-native-safe-area-context";
import SVGIcon from "../../components/SVGIcon";
import { LessonCard } from "../../components/teacher-dashboard/LessonCard";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebaseConfig";
import { getTeacherClasses, sortClasses } from "../../lib/classHelpers";
import { scheduleTimetableReminders } from "../../src/services/timetableScheduler";

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

const { width } = Dimensions.get("window");
const isLargeScreen = width > 768;

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export default function TeacherTimetable() {
  const router = useRouter();
  const { appUser } = useAuth();
  const [timetables, setTimetables] = useState<Record<string, ClassTimetable>>(
    {},
  );
  const [classNames, setClassNames] = useState<Record<string, string>>({});
  const [selectedDay, setSelectedDay] = useState("");
  const [loading, setLoading] = useState(true);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/teacher-dashboard");
    }
    return true;
  }, [router]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      handleBack,
    );
    return () => backHandler.remove();
  }, [handleBack]);

  const brandColor = COLORS.brandPrimary || COLORS.primary || "#2e86de";
  const secondaryColor = COLORS.brandSecondary || COLORS.secondary || "#1E293B";

  const teacherClasses = useMemo(() => getTeacherClasses(appUser), [appUser]);

  const isClassTeacher = useMemo(() => {
    return (
      appUser?.assignedRoles?.includes("Class Teacher") ||
      teacherClasses.length > 0
    );
  }, [appUser, teacherClasses]);

  useEffect(() => {
    const today = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(
      new Date(),
    );
    setSelectedDay(DAYS.includes(today) ? today : "Monday");
  }, []);

  const fetchTimetablesAndNames = useCallback(async () => {
    if (teacherClasses.length === 0) {
      setLoading(false);
      return;
    }

    try {
      const classes: string[] = [...teacherClasses];

      const ttResult: Record<string, ClassTimetable> = {};
      const nameResult: Record<string, string> = {};

      const classChunks = [];
      for (let i = 0; i < classes.length; i += 30) {
        classChunks.push(classes.slice(i, i + 30));
      }

      for (const chunk of classChunks) {
        const classesQuery = query(
          collection(db, "classes"),
          where("__name__", "in", chunk),
        );
        const classSnaps = await getDocs(classesQuery);

        const teacherCurriculum = appUser?.curriculum || "GES";
        const role = (appUser?.role || "").toLowerCase();
        const adminRole = (appUser?.adminRole || "").toLowerCase();
        const isAdmin = [
          "admin",
          "headmaster",
          "headmistress",
          "proprietor",
          "proprietress",
          "secretary",
          "manager",
          "director",
        ].some((r) => role.includes(r) || adminRole.includes(r));

        classSnaps.forEach((doc) => {
          const data = doc.data() as any;
          const classCurriculum = data.curriculum || "GES";
          // Only show classes matching teacher's curriculum, or all for admins
          if (isAdmin || classCurriculum === teacherCurriculum) {
            nameResult[doc.id] = data.name || doc.id;
          }
        });

        const ttQuery = query(
          collection(db, "timetables"),
          where("__name__", "in", chunk),
        );
        const ttSnaps = await getDocs(ttQuery);
        ttSnaps.forEach((doc) => {
          ttResult[doc.id] = doc.data() as ClassTimetable;
        });
      }

      setTimetables(ttResult);
      setClassNames(nameResult);

      // Schedule reminders for all lessons in all assigned classes
      const allLessons: any[] = [];
      Object.keys(ttResult).forEach((classId) => {
        const tt = ttResult[classId];
        if (tt.timetableDays) {
          Object.keys(tt.timetableDays).forEach((day) => {
            tt.timetableDays![day].forEach((lesson) => {
              allLessons.push({ ...lesson, day });
            });
          });
        }
      });
      scheduleTimetableReminders(allLessons);
    } catch (error) {
      console.error("Teacher timetable fetch error:", error);
    } finally {
      setLoading(false);
    }
  }, [teacherClasses, appUser?.curriculum, appUser?.role, appUser?.adminRole]);

  useEffect(() => {
    fetchTimetablesAndNames();
  }, [fetchTimetablesAndNames]);

  const sortedClassIds = useMemo(() => {
    const list = Object.keys(classNames).map((id) => ({
      id,
      name: classNames[id],
    }));
    const sorted = sortClasses(list);
    return sorted.map((c) => c.id);
  }, [classNames]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={brandColor} />
        <Text style={{ marginTop: 10, color: "#64748B" }}>
          Optimizing schedule...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[brandColor, "#1E293B"]}
        style={styles.headerGradient}
      >
        <View style={styles.headerTitleRow}>
          <View>
            <Text style={styles.headerTitle}>Work Schedule</Text>
            {isClassTeacher && (
              <Text style={styles.headerSub}>Class Teacher Mode Enabled</Text>
            )}
          </View>
          <SVGIcon name="calendar" size={24} color={secondaryColor} />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.daySelector}
        >
          {DAYS.map((day) => (
            <TouchableOpacity
              key={day}
              onPress={() => setSelectedDay(day)}
              style={[
                styles.dayTab,
                selectedDay === day && {
                  backgroundColor: "#fff",
                  borderColor: "#fff",
                },
              ]}
            >
              <Text
                style={[
                  styles.dayTabText,
                  selectedDay === day && { color: brandColor },
                ]}
              >
                {day.substring(0, 3).toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        removeClippedSubviews={Platform.OS === "android"}
      >
        {isClassTeacher && (
          <TouchableOpacity
            style={[styles.manageBtn, { borderColor: brandColor }]}
            onPress={() => router.push("/teacher-dashboard/manage-timetable")}
          >
            <SVGIcon name="create" size={20} color={brandColor} />
            <Text style={[styles.manageBtnText, { color: brandColor }]}>
              Manage Class Timetable
            </Text>
          </TouchableOpacity>
        )}

        {sortedClassIds.length === 0 ? (
          <View style={styles.emptyState}>
            <SVGIcon name="calendar" size={60} color="#CBD5E1" />
            <Text style={styles.emptyText}>
              No classes assigned to your portal.
            </Text>
          </View>
        ) : (
          <View style={isLargeScreen ? styles.grid : null}>
            {sortedClassIds.map((classId, index) => {
              const lessons =
                timetables[classId]?.timetableDays?.[selectedDay] || [];
              const otherActs = timetables[classId]?.otherActivities || [];
              const isAssignedClass = teacherClasses.includes(classId);

              if (
                lessons.length === 0 &&
                otherActs.length === 0 &&
                !isAssignedClass
              )
                return null;

              return (
                <Animatable.View
                  animation="fadeInUp"
                  delay={index * 50}
                  key={classId}
                  style={[
                    styles.classSection,
                    isLargeScreen && styles.gridItem,
                  ]}
                >
                  <View style={styles.classHeader}>
                    <View
                      style={[
                        styles.classIcon,
                        { backgroundColor: brandColor + "10" },
                      ]}
                    >
                      <SVGIcon name="people" size={18} color={brandColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.classTitle}>
                        {classNames[classId]}
                      </Text>
                      {isAssignedClass && (
                        <Text style={styles.myClassTag}>My Assigned Class</Text>
                      )}
                    </View>
                  </View>

                  {lessons.map((lesson, idx) => (
                    <LessonCard
                      key={`lesson-${idx}`}
                      lesson={lesson}
                      brandColor={brandColor}
                    />
                  ))}

                  {otherActs.map((act, idx) => (
                    <LessonCard
                      key={`act-${idx}`}
                      lesson={act}
                      brandColor={brandColor}
                      type="other"
                    />
                  ))}

                  {lessons.length === 0 &&
                    otherActs.length === 0 &&
                    isAssignedClass && (
                      <View style={styles.emptyDayBox}>
                        <Text style={styles.emptyDayText}>
                          No schedule for this day yet.
                        </Text>
                      </View>
                    )}
                </Animatable.View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerGradient: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 25,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    ...SHADOWS.medium,
  },
  headerTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: { fontSize: 24, fontWeight: "900", color: "#fff" },
  headerSub: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "700",
    marginTop: -2,
    textTransform: "uppercase",
  },
  daySelector: { paddingVertical: 5 },
  dayTab: {
    width: 60,
    height: 45,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginRight: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  dayTabText: {
    fontSize: 12,
    fontWeight: "900",
    color: "rgba(255,255,255,0.6)",
  },
  manageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 15,
    borderRadius: 15,
    borderWidth: 2,
    borderStyle: "dashed",
    marginBottom: 25,
    backgroundColor: "#fff",
  },
  manageBtnText: { marginLeft: 10, fontWeight: "800", fontSize: 14 },
  classSection: { marginBottom: 30 },
  classHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    gap: 12,
  },
  classIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  classTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1E293B",
    textTransform: "uppercase",
  },
  myClassTag: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "800",
    textTransform: "uppercase",
    marginTop: 2,
  },
  emptyState: { alignItems: "center", marginTop: 60 },
  emptyText: {
    fontSize: 14,
    color: "#94A3B8",
    marginTop: 10,
    fontWeight: "500",
  },
  emptyDayBox: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 15,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyDayText: { color: "#94A3B8", fontSize: 13, fontWeight: "600" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 20,
  },
  gridItem: {
    width: (width - 60) / 2,
  },
});
