import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  doc,
  getDoc,
  getCountFromServer
} from "firebase/firestore";
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
  Dimensions,
  Image,
  ScrollView,
  RefreshControl,
  Modal,
  AppState
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { COLORS, SHADOWS } from "../../constants/theme";
import { db } from "../../firebaseConfig";
import { useAuth } from "../../contexts/AuthContext";
import moment from "moment";

const { width } = Dimensions.get("window");

interface TeacherStats {
  uid: string;
  fullName: string;
  email: string;
  profileImage?: string;
  totalAssignments: number;
  totalGroups: number;
  totalLessonPlans: number;
  weeklyTopics: {
    subject: string,
    topic: string,
    className: string,
    strand?: string,
    duration?: string,
    plan?: any
  }[];
  lastActive?: any;
  onlineTimeMinutes: number; // Simulated or calculated if available
  usageScore: number; // Percentage
  assignedClasses: string[];
  groups: { name: string, className: string, memberCount: number }[];
  assignmentBreakdown: {
    subject: string;
    className: string;
    count: number;
  }[];
}

export default function TeacherStatistics() {
  const router = useRouter();
  const { appUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [teachers, setTeachers] = useState<TeacherStats[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherStats | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const lastFetchRef = useRef<number>(0);

  const CACHE_KEY = `teacher_stats_${SCHOOL_CONFIG.schoolId}`;
  const CACHE_EXPIRY = 12 * 60 * 60 * 1000; // 12 hours cache

  const primary = SCHOOL_CONFIG.primaryColor;
  const secondary = SCHOOL_CONFIG.secondaryColor;

  const getStartOfWeek = () => {
    const now = new Date();
    const day = now.getDay(); // 0 (Sun) to 6 (Sat)
    const diff = now.getDate() - day;
    const startOfWeek = new Date(now.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);
    return startOfWeek;
  };

  const fetchStatistics = useCallback(async () => {
    if (!appUser) return;
    try {
      setLoading(true);
      const startOfWeek = getStartOfWeek();

      // 0. Fetch metadata once
      const classesSnap = await getDocs(collection(db, "classes"));
      const classMap: Record<string, string> = {};
      classesSnap.forEach(doc => {
        classMap[doc.id] = doc.data().name || doc.data().className || doc.id;
      });

      // 1. Batch Fetch all required collections for the school
      const [teacherSnap, allAssignmentsSnap, allGroupsSnap, weeklyLessonsSnap] = await Promise.all([
        getDocs(query(collection(db, "users"), where("role", "==", "teacher"), where("schoolId", "==", SCHOOL_CONFIG.schoolId))),
        getDocs(query(collection(db, "assignments"), where("schoolId", "==", SCHOOL_CONFIG.schoolId))),
        getDocs(query(collection(db, "studentGroups"), where("schoolId", "==", SCHOOL_CONFIG.schoolId))),
        getDocs(query(collection(db, "pedagogy_vault"), where("schoolId", "==", SCHOOL_CONFIG.schoolId), where("createdAt", ">=", Timestamp.fromDate(startOfWeek)), orderBy("createdAt", "desc")))
      ]);

      // 2. Map data to teachers in memory (O(1) lookup)
      const assignmentMap: Record<string, any[]> = {};
      allAssignmentsSnap.docs.forEach(d => {
        const data = d.data();
        if (!assignmentMap[data.teacherId]) assignmentMap[data.teacherId] = [];
        assignmentMap[data.teacherId].push(data);
      });

      const groupMap: Record<string, any[]> = {};
      allGroupsSnap.docs.forEach(d => {
        const data = d.data();
        if (!groupMap[data.teacherId]) groupMap[data.teacherId] = [];
        groupMap[data.teacherId].push(data);
      });

      const lessonsMap: Record<string, any[]> = {};
      weeklyLessonsSnap.docs.forEach(d => {
        const data = d.data();
        if (!lessonsMap[data.userId]) lessonsMap[data.userId] = [];
        lessonsMap[data.userId].push(data);
      });

      // 3. Assemble final teacher list
      const teacherList: TeacherStats[] = teacherSnap.docs.map(tDoc => {
        const t = { uid: tDoc.id, ...tDoc.data() } as any;
        const tAssignments = assignmentMap[t.uid] || [];
        const tGroups = groupMap[t.uid] || [];
        const tLessons = lessonsMap[t.uid] || [];

        // Calculate breakdown
        const breakdownMap: Record<string, number> = {};
        tAssignments.forEach(a => {
          const key = `${a.classId}|||${a.subjectId}`;
          breakdownMap[key] = (breakdownMap[key] || 0) + 1;
        });

        const assignmentBreakdown = Object.entries(breakdownMap).map(([key, count]) => {
          const [classId, subject] = key.split("|||");
          return { subject, className: classMap[classId] || classId, count };
        });

        // Group topics (Keep latest per subject/class)
        const topicsMap: Record<string, any> = {};
        tLessons.forEach(data => {
          const key = `${data.subject}|||${data.classLevel}`;
          if (!topicsMap[key]) {
            topicsMap[key] = {
              subject: data.subject,
              topic: data.topic,
              className: classMap[data.classLevel] || data.classLevel,
              strand: data.strand,
              duration: data.duration,
              plan: data.plan
            };
          }
        });

        const usageScore = Math.min(100, (tAssignments.length * 10) + (tGroups.length * 15) + (tLessons.length * 20));

        return {
          uid: t.uid,
          fullName: `${t.profile?.firstName || ""} ${t.profile?.lastName || ""}`.trim() || "Teacher",
          email: t.profile?.email || "",
          profileImage: t.profile?.profileImage,
          totalAssignments: tAssignments.length,
          totalGroups: tGroups.length,
          totalLessonPlans: tLessons.length,
          weeklyTopics: Object.values(topicsMap),
          lastActive: t.lastActive,
          onlineTimeMinutes: t.onlineTimeMinutes || 0,
          usageScore,
          assignedClasses: (t.classes || []).map((cid: string) => classMap[cid] || cid),
          groups: tGroups.map(g => ({
            name: g.name || "Unnamed Group",
            className: classMap[g.classId] || g.classId || "General",
            memberCount: (g.studentIds || []).length
          })),
          assignmentBreakdown
        };
      });

      teacherList.sort((a, b) => b.usageScore - a.usageScore);
      setTeachers(teacherList);
      lastFetchRef.current = Date.now();

      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        data: teacherList
      }));
    } catch (error) {
      console.error("Error fetching teacher stats:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [appUser, CACHE_KEY]);

  const loadCachedData = async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const { timestamp, data } = JSON.parse(cached);
        const age = Date.now() - timestamp;

        setTeachers(data);
        lastFetchRef.current = timestamp;

        if (age < CACHE_EXPIRY) {
          setLoading(false);
          return true;
        }
      }
    } catch (e) {
      console.error("Cache load error:", e);
    }
    return false;
  };

  useEffect(() => {
    if (!appUser) return;

    const init = async () => {
      const isCacheValid = await loadCachedData();
      if (!isCacheValid) {
        fetchStatistics();
      }
    };
    init();

    // Re-fetch when app comes to foreground if cache is old
    const subscription = AppState.addEventListener("change", nextAppState => {
      if (nextAppState === "active" && appUser) {
        const age = Date.now() - lastFetchRef.current;
        if (age > CACHE_EXPIRY) {
          fetchStatistics();
        }
      }
    });

    return () => subscription.remove();
  }, [fetchStatistics, appUser]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStatistics();
  };

  const renderTeacherItem = ({ item, index }: { item: TeacherStats, index: number }) => (
    <Animatable.View animation="fadeInUp" delay={index * 100} style={styles.teacherCard}>
      <View style={styles.cardHeader}>
        <View style={styles.teacherInfo}>
          {item.profileImage ? (
            <Image source={{ uri: item.profileImage }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: primary + "20" }]}>
              <Text style={[styles.avatarText, { color: primary }]}>{item.fullName.charAt(0)}</Text>
            </View>
          )}
          <View>
            <Text style={styles.teacherName}>{item.fullName}</Text>
            <Text style={styles.teacherEmail}>{item.email}</Text>
          </View>
        </View>
        <View style={[styles.usageBadge, { backgroundColor: getUsageColor(item.usageScore) + "15" }]}>
          <Text style={[styles.usageText, { color: getUsageColor(item.usageScore) }]}>{Math.round(item.usageScore)}% Usage</Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{item.totalAssignments}</Text>
          <Text style={styles.statLabel}>Tasks</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{item.totalLessonPlans}</Text>
          <Text style={styles.statLabel}>Lessons</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{item.totalGroups}</Text>
          <Text style={styles.statLabel}>Groups</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{Math.floor(item.onlineTimeMinutes / 60)}h</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.lastActive}>
          Last Active: {item.lastActive ? moment(item.lastActive.toDate()).fromNow() : "Never"}
        </Text>
        <TouchableOpacity style={styles.viewBtn} onPress={() => setSelectedTeacher(item)}>
            <Text style={[styles.viewBtnText, { color: primary }]}>Detailed Report</Text>
            <SVGIcon name="chevron-forward" size={16} color={primary} />
        </TouchableOpacity>
      </View>
    </Animatable.View>
  );

  const getUsageColor = (score: number) => {
    if (score > 80) return "#10B981"; // Emerald
    if (score > 50) return "#3B82F6"; // Blue
    if (score > 20) return "#F59E0B"; // Amber
    return "#EF4444"; // Red
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={primary} />
        <Text style={styles.loadingText}>Analyzing Teacher Performance...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[primary, "#1E293B"]} style={styles.headerGradient}>
        <View style={styles.headerTitleRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <SVGIcon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Teacher Analytics</Text>
          <SVGIcon name="analytics" size={24} color={secondary} />
        </View>
        <Text style={styles.headerSubtitle}>Performance and engagement overview across all departments.</Text>
      </LinearGradient>

      <FlatList
        data={teachers}
        keyExtractor={(item) => item.uid}
        renderItem={renderTeacherItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyCenter}>
            <SVGIcon name="people" size={64} color="#CBD5E1" />
            <Text style={styles.emptyText}>No teacher data available.</Text>
          </View>
        }
      />

      <Modal
        visible={!!selectedTeacher}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedTeacher(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{selectedTeacher?.fullName}</Text>
                <Text style={styles.modalSubtitle}>Teacher Activity Report</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedTeacher(null)}>
                <SVGIcon name="close-circle" size={28} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionTitle}>Assigned Classes</Text>
              <View style={styles.tagContainer}>
                {selectedTeacher?.assignedClasses && selectedTeacher.assignedClasses.length > 0 ? (
                  selectedTeacher.assignedClasses.map((c, i) => (
                    <View key={i} style={[styles.classTag, { backgroundColor: primary + "10" }]}>
                      <Text style={[styles.classTagText, { color: primary }]}>{c}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyTextSmall}>No classes assigned</Text>
                )}
              </View>

              <Text style={styles.sectionTitle}>Assignment Distribution</Text>
              <View style={styles.breakdownList}>
                {selectedTeacher?.assignmentBreakdown && selectedTeacher.assignmentBreakdown.length > 0 ? (
                  selectedTeacher.assignmentBreakdown.map((item, idx) => (
                    <View key={idx} style={styles.breakdownItem}>
                      <View style={styles.breakdownInfo}>
                        <Text style={styles.breakdownClass}>{item.className}</Text>
                        <Text style={styles.breakdownSubject}>{item.subject}</Text>
                      </View>
                      <View style={[styles.countBadge, { backgroundColor: secondary + "20" }]}>
                        <Text style={[styles.countText, { color: secondary }]}>{item.count} Tasks</Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.noDataBox}>
                    <Text style={styles.noDataText}>No assignments posted yet.</Text>
                  </View>
                )}
              </View>

              <Text style={styles.sectionTitle}>Student Groups</Text>
              <View style={styles.breakdownList}>
                {selectedTeacher?.groups && selectedTeacher.groups.length > 0 ? (
                  selectedTeacher.groups.map((group, idx) => (
                    <View key={idx} style={styles.breakdownItem}>
                      <View style={styles.breakdownInfo}>
                        <Text style={styles.breakdownClass}>{group.name}</Text>
                        <Text style={styles.breakdownSubject}>{group.className}, {group.memberCount} members</Text>
                      </View>
                      <View style={[styles.countBadge, { backgroundColor: primary + "15" }]}>
                        <SVGIcon name="people" size={14} color={primary} />
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.noDataBox}>
                    <Text style={styles.noDataText}>No groups created yet.</Text>
                  </View>
                )}
              </View>

              <Text style={styles.sectionTitle}>Weekly Lesson Plans</Text>
              <View style={styles.plansList}>
                {selectedTeacher?.weeklyTopics && selectedTeacher.weeklyTopics.length > 0 ? (
                  selectedTeacher.weeklyTopics.map((plan, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.planCard}
                      onPress={() => setSelectedPlan(plan)}
                    >
                      <View style={styles.planHeader}>
                        <Text style={styles.planClassText}>{plan.className}</Text>
                        <Text style={styles.planSubject}>{plan.subject}</Text>
                      </View>
                      <Text style={styles.planTopic}>{plan.topic}</Text>
                      <View style={styles.planFooter}>
                        <Text style={styles.viewPlanText}>Tap to view full objectives & content</Text>
                        <SVGIcon name="eye-outline" size={14} color={primary} />
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.noPlans}>
                    <Text style={styles.noPlansText}>No lesson plans generated this week.</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={[styles.closeModalBtn, { backgroundColor: primary }]}
                onPress={() => setSelectedTeacher(null)}
              >
                <Text style={styles.closeModalBtnText}>Done</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Lesson Plan Detail Modal */}
      <Modal
        visible={!!selectedPlan}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPlan(null)}
      >
        <View style={styles.planDetailOverlay}>
          <View style={styles.planDetailContent}>
            <View style={styles.planDetailHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailSubject}>{selectedPlan?.subject}</Text>
                <Text style={styles.detailTopic}>{selectedPlan?.topic}</Text>
                <Text style={styles.detailMeta}>{selectedPlan?.className} • {selectedPlan?.duration}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedPlan(null)} style={styles.closeDetailBtn}>
                <SVGIcon name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
              {selectedPlan?.strand && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Strand</Text>
                  <Text style={styles.detailValue}>{selectedPlan.strand}</Text>
                </View>
              )}

              {selectedPlan?.plan?.objectives && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Learning Objectives</Text>
                  {selectedPlan.plan.objectives.map((obj: string, i: number) => (
                    <View key={i} style={styles.bulletItem}>
                      <Text style={styles.bullet}>•</Text>
                      <Text style={styles.bulletText}>{obj}</Text>
                    </View>
                  ))}
                </View>
              )}

              {selectedPlan?.plan?.teachingActivities && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Teaching Activities</Text>
                  {selectedPlan.plan.teachingActivities.map((act: string, i: number) => (
                    <View key={i} style={styles.bulletItem}>
                      <Text style={styles.bullet}>{i + 1}.</Text>
                      <Text style={styles.bulletText}>{act}</Text>
                    </View>
                  ))}
                </View>
              )}

              {selectedPlan?.plan?.assessment && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Assessment</Text>
                  {selectedPlan.plan.assessment.map((ass: string, i: number) => (
                    <View key={i} style={styles.bulletItem}>
                      <Text style={styles.bullet}>✓</Text>
                      <Text style={styles.bulletText}>{ass}</Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 15, fontSize: 14, color: "#64748B", fontWeight: "600" },
  headerGradient: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    ...SHADOWS.medium,
  },
  headerTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 22, fontWeight: "900", color: "#fff" },
  headerSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.7)", fontWeight: "500", lineHeight: 18 },
  listContent: { padding: 16, paddingBottom: 40 },
  teacherCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  teacherInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
  avatar: { width: 50, height: 50, borderRadius: 16, marginRight: 15 },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  avatarText: { fontSize: 20, fontWeight: "bold" },
  teacherName: { fontSize: 17, fontWeight: "800", color: "#1E293B" },
  teacherEmail: { fontSize: 12, color: "#94A3B8", fontWeight: "600", marginTop: 2 },
  usageBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  usageText: { fontSize: 11, fontWeight: "900" },
  statsGrid: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderRadius: 20,
    padding: 15,
    marginBottom: 15,
  },
  statBox: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 18, fontWeight: "900", color: "#1E293B" },
  statLabel: { fontSize: 10, fontWeight: "700", color: "#94A3B8", marginTop: 4, textTransform: "uppercase" },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 15,
  },
  lastActive: { fontSize: 11, color: "#94A3B8", fontWeight: "600" },
  viewBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  viewBtnText: { fontSize: 12, fontWeight: "800" },
  emptyCenter: { alignItems: "center", justifyContent: "center", marginTop: 100 },
  emptyText: { color: "#94A3B8", marginTop: 15, fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  modalTitle: { fontSize: 20, fontWeight: "900", color: "#1E293B" },
  modalSubtitle: { fontSize: 13, color: "#64748B", fontWeight: "600" },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: "#64748B", textTransform: "uppercase", marginTop: 20, marginBottom: 12, letterSpacing: 0.5 },
  tagContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  classTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  classTagText: { fontSize: 12, fontWeight: "700" },
  breakdownList: { gap: 10 },
  breakdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  breakdownInfo: { flex: 1 },
  breakdownClass: { fontSize: 14, fontWeight: "700", color: "#1E293B" },
  breakdownSubject: { fontSize: 12, color: "#64748B", fontWeight: "600" },
  countBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  countText: { fontSize: 11, fontWeight: "800" },
  plansList: { gap: 12 },
  planCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingBottom: 4,
  },
  planClassText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#1E293B",
    textTransform: "uppercase",
  },
  planSubject: { fontSize: 10, fontWeight: "800", color: "#64748B", textTransform: "uppercase" },
  planTopic: { fontSize: 15, fontWeight: "700", color: "#1E293B" },
  planFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  viewPlanText: { fontSize: 11, color: "#94A3B8", fontWeight: "600" },
  closeModalBtn: {
    marginTop: 30,
    height: 55,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.medium,
    marginBottom: 20,
  },
  closeModalBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  noPlans: { padding: 20, alignItems: "center" },
  noPlansText: { color: "#94A3B8", fontWeight: "600", fontSize: 13 },
  noDataBox: { padding: 15, alignItems: "center" },
  noDataText: { color: "#94A3B8", fontSize: 13, fontWeight: "600" },
  emptyTextSmall: { fontSize: 13, color: "#94A3B8", fontWeight: "600", fontStyle: "italic" },

  // Detail Modal Styles
  planDetailOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    padding: 20,
  },
  planDetailContent: {
    backgroundColor: "#fff",
    borderRadius: 24,
    maxHeight: "80%",
    padding: 24,
  },
  planDetailHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 15,
    marginBottom: 15,
  },
  detailSubject: { fontSize: 12, fontWeight: "800", color: "#64748B", textTransform: "uppercase" },
  detailTopic: { fontSize: 20, fontWeight: "900", color: "#1E293B", marginVertical: 4 },
  detailMeta: { fontSize: 13, color: "#94A3B8", fontWeight: "600" },
  closeDetailBtn: { padding: 5 },
  detailSection: { marginTop: 20 },
  detailLabel: { fontSize: 11, fontWeight: "900", color: "#64748B", textTransform: "uppercase", marginBottom: 8, letterSpacing: 0.5 },
  detailValue: { fontSize: 15, color: "#334155", fontWeight: "500", lineHeight: 22 },
  bulletItem: { flexDirection: "row", marginBottom: 8, paddingRight: 10 },
  bullet: { fontSize: 14, color: "#64748B", width: 25, fontWeight: "bold" },
  bulletText: { flex: 1, fontSize: 14, color: "#334155", lineHeight: 20, fontWeight: "500" },
});
