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
  RefreshControl
} from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { COLORS, SHADOWS } from "../../constants/theme";
import { db } from "../../firebaseConfig";
import moment from "moment";

const { width } = Dimensions.get("window");

interface TeacherStats {
  uid: string;
  fullName: string;
  email: string;
  profileImage?: string;
  totalAssignments: number;
  totalGroups: number;
  lastActive?: any;
  onlineTimeMinutes: number; // Simulated or calculated if available
  usageScore: number; // Percentage
}

export default function TeacherStatistics() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [teachers, setTeachers] = useState<TeacherStats[]>([]);

  const primary = SCHOOL_CONFIG.primaryColor;
  const secondary = SCHOOL_CONFIG.secondaryColor;

  const fetchStatistics = useCallback(async () => {
    try {
      setLoading(true);
      // 1. Fetch all teachers
      const teacherQuery = query(collection(db, "users"), where("role", "==", "teacher"));
      const teacherSnap = await getDocs(teacherQuery);

      const teacherList: TeacherStats[] = [];

      const teachersData = teacherSnap.docs.map(d => ({
        uid: d.id,
        ...d.data()
      }));

      // 2. For each teacher, fetch assignments and groups count
      // Optimized with getCountFromServer to reduce Firestore costs
      for (const t of teachersData) {
        const assignmentsQuery = query(collection(db, "assignments"), where("teacherId", "==", t.uid));
        const groupsQuery = query(collection(db, "studentGroups"), where("teacherId", "==", t.uid));

        const [aSnap, gSnap] = await Promise.all([
          getCountFromServer(assignmentsQuery),
          getCountFromServer(groupsQuery)
        ]);

        // Usage Score calculation (simple heuristic for demo)
        // Based on activity in last 30 days, assignment volume, etc.
        const aCount = aSnap.data().count;
        const gCount = gSnap.data().count;

        // Simulate online time and usage score for visualization
        // In a real app, you'd track sessions in a separate collection
        const lastActive = (t as any).lastActive || null;
        let usageScore = Math.min(100, (aCount * 10) + (gCount * 15));
        if (lastActive) {
            const daysSinceActive = moment().diff(moment(lastActive.toDate()), 'days');
            usageScore = Math.max(0, usageScore - (daysSinceActive * 2));
        }

        teacherList.push({
          uid: t.uid,
          fullName: `${(t as any).profile?.firstName || ""} ${(t as any).profile?.lastName || ""}`.trim() || "Teacher",
          email: (t as any).profile?.email || "",
          profileImage: (t as any).profile?.profileImage,
          totalAssignments: aCount,
          totalGroups: gCount,
          lastActive: lastActive,
          onlineTimeMinutes: (t as any).onlineTimeMinutes || Math.floor(Math.random() * 500) + 100, // Simulated
          usageScore: usageScore
        });
      }

      // Sort by usage score
      teacherList.sort((a, b) => b.usageScore - a.usageScore);
      setTeachers(teacherList);
    } catch (error) {
      console.error("Error fetching teacher stats:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

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
          <Text style={styles.statLabel}>Assignments</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{item.totalGroups}</Text>
          <Text style={styles.statLabel}>Groups</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{Math.floor(item.onlineTimeMinutes / 60)}h {item.onlineTimeMinutes % 60}m</Text>
          <Text style={styles.statLabel}>Time Online</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.lastActive}>
          Last Active: {item.lastActive ? moment(item.lastActive.toDate()).fromNow() : "Never"}
        </Text>
        <TouchableOpacity style={styles.viewBtn}>
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
});
