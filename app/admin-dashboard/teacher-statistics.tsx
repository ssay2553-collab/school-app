import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  collection,
  getDocsFromServer,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  doc,
  getDoc,
  getCountFromServer,
  getDocs
} from "firebase/firestore";
import React, { useEffect, useState, useCallback, useRef } from "react";
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
  AppState,
  Platform
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { COLORS, SHADOWS } from "../../constants/theme";
import { db } from "../../firebaseConfig";
import { useAuth } from "../../contexts/AuthContext";
import { getTeacherClasses } from "../../lib/classHelpers";
import moment from "moment";

const { width } = Dimensions.get("window");

interface TeacherStats {
  uid: string;
  fullName: string;
  email: string;
  profileImage?: string;
  totalAssignments: number;
  totalGroups: number;
  totalTopics: number;
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
  topicBreakdown: {
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

      // 0. Fetch metadata once
      const classesSnap = await getDocsFromServer(collection(db, "classes"));
      const classMap: Record<string, string> = {};
      classesSnap.forEach((doc: any) => {
        const data = doc.data() as any;
        classMap[doc.id] = data.name || data.className || doc.id;
      });

      // 1. Batch Fetch all required collections for the school
      const [teacherSnap, allAssignmentsSnap, allGroupsSnap, allTopicsSnap] = await Promise.all([
        getDocsFromServer(query(collection(db, "users"), where("role", "==", "teacher"))),
        getDocsFromServer(collection(db, "assignments")),
        getDocsFromServer(collection(db, "studentGroups")),
        getDocsFromServer(collection(db, "weeklyTopics")),
      ]);

      // 2. Map data to teachers in memory (O(1) lookup)
      const assignmentMap: Record<string, any[]> = {};
      allAssignmentsSnap.docs.forEach((d: any) => {
        const data = d.data();
        if (!assignmentMap[data.teacherId]) assignmentMap[data.teacherId] = [];
        assignmentMap[data.teacherId].push(data);
      });

      const groupMap: Record<string, any[]> = {};
      allGroupsSnap.docs.forEach((d: any) => {
        const data = d.data();
        if (!groupMap[data.teacherId]) groupMap[data.teacherId] = [];
        groupMap[data.teacherId].push(data);
      });

      const topicMap: Record<string, any[]> = {};
      allTopicsSnap.docs.forEach((d: any) => {
        const data = d.data();
        if (!topicMap[data.teacherId]) topicMap[data.teacherId] = [];
        topicMap[data.teacherId].push(data);
      });

      // 3. Assemble final teacher list
      const teacherList: TeacherStats[] = teacherSnap.docs.map(tDoc => {
        const t = { uid: tDoc.id, ...tDoc.data() } as any;
        const tAssignments = assignmentMap[t.uid] || [];
        const tGroups = groupMap[t.uid] || [];
        const tTopics = topicMap[t.uid] || [];

        // Calculate assignment breakdown
        const breakdownMap: Record<string, number> = {};
        tAssignments.forEach(a => {
          const key = `${a.classId}|||${a.subjectId || a.subject}`;
          breakdownMap[key] = (breakdownMap[key] || 0) + 1;
        });

        const assignmentBreakdown = Object.entries(breakdownMap).map(([key, count]) => {
          const [classId, subject] = key.split("|||");
          return { subject, className: classMap[classId] || classId, count };
        });

        // Calculate topic breakdown
        const topicBreakdownMap: Record<string, number> = {};
        tTopics.forEach(top => {
          const key = `${top.classId}|||${top.subject}`;
          topicBreakdownMap[key] = (topicBreakdownMap[key] || 0) + 1;
        });

        const topicBreakdown = Object.entries(topicBreakdownMap).map(([key, count]) => {
          const [classId, subject] = key.split("|||");
          return { subject, className: classMap[classId] || classId, count };
        });

        const teacherClasses = getTeacherClasses(t);
        const usageScore = Math.min(100, (tAssignments.length * 8) + (tGroups.length * 12) + (tTopics.length * 15));

        return {
          uid: t.uid,
          fullName: `${t.profile?.firstName || ""} ${t.profile?.lastName || ""}`.trim() || "Teacher",
          email: t.profile?.email || "",
          profileImage: t.profile?.profileImage,
          totalAssignments: tAssignments.length,
          totalGroups: tGroups.length,
          totalTopics: tTopics.length,
          lastActive: t.lastActive,
          onlineTimeMinutes: t.onlineTimeMinutes || 0,
          usageScore,
          assignedClasses: teacherClasses.map((cid: string) => classMap[cid] || cid),
          groups: tGroups.map(g => ({
            name: g.name || "Unnamed Group",
            className: classMap[g.classId] || g.classId || "General",
            memberCount: (g.studentIds || []).length
          })),
          assignmentBreakdown,
          topicBreakdown
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
          <Text style={styles.statValue}>{item.totalTopics}</Text>
          <Text style={styles.statLabel}>Topics</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{item.totalGroups}</Text>
          <Text style={styles.statLabel}>Groups</Text>
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

              <Text style={styles.sectionTitle}>Weekly Lesson Plans</Text>
              <View style={styles.breakdownList}>
                {selectedTeacher?.topicBreakdown && selectedTeacher.topicBreakdown.length > 0 ? (
                  selectedTeacher.topicBreakdown.map((item, idx) => (
                    <View key={idx} style={styles.breakdownItem}>
                      <View style={styles.breakdownInfo}>
                        <Text style={styles.breakdownClass}>{item.className}</Text>
                        <Text style={styles.breakdownSubject}>{item.subject}</Text>
                      </View>
                      <View style={[styles.countBadge, { backgroundColor: primary + "20" }]}>
                        <Text style={[styles.countText, { color: primary }]}>{item.count} Weeks</Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.noDataBox}>
                    <Text style={styles.noDataText}>No weekly topics recorded.</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  headerGradient: {
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  backBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#FFFFFF",
    flex: 1,
    marginLeft: 15,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    lineHeight: 20,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: "#64748B",
    fontWeight: "600",
  },
  listContent: {
    padding: 20,
    paddingBottom: 100,
  },
  teacherCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  teacherInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "bold",
  },
  teacherName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1E293B",
  },
  teacherEmail: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  usageBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  usageText: {
    fontSize: 12,
    fontWeight: "800",
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 15,
    marginBottom: 20,
  },
  statBox: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1E293B",
  },
  statLabel: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "700",
    marginTop: 4,
    textTransform: "uppercase",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  lastActive: {
    fontSize: 12,
    color: "#94A3B8",
  },
  viewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  viewBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  emptyCenter: {
    alignItems: "center",
    marginTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: "#94A3B8",
    marginTop: 15,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#1E293B",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1E293B",
    marginTop: 20,
    marginBottom: 12,
  },
  tagContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  classTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  classTagText: {
    fontSize: 13,
    fontWeight: "700",
  },
  emptyTextSmall: {
    fontSize: 13,
    color: "#94A3B8",
    fontStyle: "italic",
  },
  breakdownList: {
    gap: 12,
  },
  breakdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  breakdownInfo: {
    flex: 1,
  },
  breakdownClass: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E293B",
  },
  breakdownSubject: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 70,
    alignItems: "center",
  },
  countText: {
    fontSize: 12,
    fontWeight: "800",
  },
  noDataBox: {
    padding: 20,
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  noDataText: {
    fontSize: 13,
    color: "#94A3B8",
  },
  closeModalBtn: {
    marginVertical: 30,
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    ...SHADOWS.medium,
  },
  closeModalBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
});
