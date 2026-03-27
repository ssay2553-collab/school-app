import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
  ActivityIndicator,
  Dimensions,
  Platform
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Animatable from "react-native-animatable";
import { collection, query, where, getCountFromServer } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { SCHOOL_CONFIG } from "../../constants/Config";
import SVGIcon from "../../components/SVGIcon";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 55) / 2;

export default function TeacherDashboard() {
  const router = useRouter();
  const { appUser, loading } = useAuth();
  const [assignmentCount, setAssignmentCount] = useState<number | null>(null);

  const primary = SCHOOL_CONFIG.primaryColor;
  const surface = SCHOOL_CONFIG.surfaceColor;

  useEffect(() => {
    if (appUser?.uid) {
      const fetchStats = async () => {
        try {
          const q = query(collection(db, "assignments"), where("teacherId", "==", appUser.uid));
          const snap = await getCountFromServer(q);
          setAssignmentCount(snap.data().count);
        } catch (e) {
          console.error("Error fetching teacher stats:", e);
        }
      };
      fetchStats();
    }
  }, [appUser?.uid]);

  const sections = [
    {
      title: "CLASSROOM MANAGEMENT",
      items: [
        { title: "Student List", subtitle: "Profiles & Info", route: "/teacher-dashboard/students-list", icon: "people", color: "#6366f1" },
        { title: "Attendance", subtitle: "Daily tracking", route: "/teacher-dashboard/daily-attendance", icon: "checkmark-done-circle", color: "#10b981" },
        { title: "Timetable", subtitle: "My schedule", route: "/teacher-dashboard/teacher-timetable", icon: "calendar", color: "#f59e0b" },
        { title: "Tokens", subtitle: "Student codes", route: "/teacher-dashboard/generate-student-code", icon: "key", color: "#ec4899" },
      ],
    },
    {
      title: "ACADEMICS",
      items: [
        { title: "Term Records", subtitle: "Manage grades", route: "/teacher-dashboard/student-academic-records", icon: "library", color: "#8b5cf6" },
        { title: "Assignments", subtitle: "Upload tasks", route: "/teacher-dashboard/upload-assignment", icon: "cloud-upload", color: "#a855f7" },
        { title: "Grading", subtitle: "Mark submissions", route: "/teacher-dashboard/mark-assignment", icon: "create", color: "#ef4444" },
        { title: "Groups", subtitle: "Study teams", route: "/teacher-dashboard/create-student-group", icon: "chatbubbles", color: "#06b6d4" },
      ],
    },
    {
      title: "SCHOOL LIFE",
      items: [
        { title: "Academic Calendar", subtitle: "Events & Holidays", route: "/academic-calendar", icon: "calendar-outline", color: "#f97316" },
        { title: "Broadcasts", subtitle: "Global news", route: "/teacher-dashboard/news-screen", icon: "megaphone", color: "#f43f5e" },
        { title: "Parent Chat", subtitle: "Direct messages", route: "/teacher-dashboard/chat-with-parent", icon: "chatbubble-ellipses", color: "#3b82f6" },
      ],
    },
  ];

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: surface }]}>
        <ActivityIndicator size="large" color={primary} />
      </View>
    );
  }

  // Fix: Ensure card background contrasts with the screen background
  const isSurfaceLight = surface.toLowerCase() === "#ffffff" || surface.toLowerCase() === "white" || surface.toLowerCase() === "#fafafa";
  const cardBg = "#FFFFFF"; 
  const cardBorder = isSurfaceLight ? "#F1F5F9" : "rgba(0,0,0,0.05)";

  const renderItem = (item: any, index: number) => (
    <Animatable.View
      animation="fadeInUp"
      duration={600}
      delay={index * 80}
      key={item.title}
      style={styles.cardWrapper}
    >
      <TouchableOpacity
        style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}
        onPress={() => item.route && router.push(item.route as any)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconBox, { backgroundColor: item.color + '15' }]}>
          <SVGIcon name={item.icon} size={26} color={item.color} />
        </View>
        <View style={styles.cardTextContent}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardSubtitle} numberOfLines={1}>{item.subtitle}</Text>
        </View>
        <View style={styles.chevronBox}>
          <SVGIcon name="chevron-forward" size={14} color="#CBD5E1" />
        </View>
      </TouchableOpacity>
    </Animatable.View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: surface }]}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.welcome}>Good day,</Text>
            <Text style={[styles.nameText, { color: "#0F172A" }]}>
              {appUser?.profile?.firstName || "Instructor"} 👋
            </Text>
          </View>
          <TouchableOpacity 
            onPress={() => router.push("/teacher-dashboard/settings")}
            style={styles.settingsBtn}
          >
            <View style={[styles.settingsIconBg, { backgroundColor: primary + '15' }]}>
               <SVGIcon name="settings-outline" size={24} color={primary} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={[styles.statsOverview, { backgroundColor: cardBg, borderColor: cardBorder }]}>
           <View style={[styles.statItem, { borderLeftColor: primary }]}>
              <Text style={styles.statLabel}>ASSIGNMENTS</Text>
              <Text style={styles.statValue}>{assignmentCount ?? "..."} Posted</Text>
           </View>
           <View style={[styles.statItem, { borderLeftColor: '#10b981' }]}>
              <Text style={styles.statLabel}>PORTAL STATUS</Text>
              <Text style={styles.statValue}>Active</Text>
           </View>
        </View>

        {sections.map((section, sIdx) => (
          <View key={section.title} style={styles.section}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <View style={styles.sectionLine} />
            </View>
            <View style={styles.grid}>
              {section.items.map((item, iIdx) => renderItem(item, sIdx * 4 + iIdx))}
            </View>
          </View>
        ))}
        
        <View style={styles.footerSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { padding: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
  },
  welcome: { fontSize: 14, color: "#94A3B8", fontWeight: "600" },
  nameText: { fontSize: 28, fontWeight: "900", marginTop: 2 },
  settingsBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.small,
  },
  settingsIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  statsOverview: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 15,
    marginBottom: 30,
    ...SHADOWS.small,
    borderWidth: 1,
  },
  statItem: {
    flex: 1,
    paddingLeft: 15,
    borderLeftWidth: 3,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#94A3B8',
    letterSpacing: 1
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 2
  },
  section: {
    marginBottom: 25,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: "#94A3B8",
    letterSpacing: 1.2,
    marginRight: 10
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0'
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  cardWrapper: {
    width: CARD_WIDTH,
    marginBottom: 15,
  },
  card: {
    borderRadius: 24,
    padding: 16,
    minHeight: 135,
    justifyContent: "space-between",
    ...SHADOWS.medium,
    borderWidth: 1,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  cardTextContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1E293B",
    lineHeight: 20
  },
  cardSubtitle: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 3,
    fontWeight: '500'
  },
  chevronBox: {
    alignSelf: 'flex-end',
    marginTop: 5
  },
  footerSpace: { height: 40 },
});
