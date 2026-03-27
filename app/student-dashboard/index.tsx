import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Dimensions,
  Image,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG, useSchoolConfig } from "../../constants/Config";
import { SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 65) / 2;

export default function StudentDashboard() {
  const { appUser } = useAuth();
  const router = useRouter();
  const config = useSchoolConfig();

  const brandPrimary = config.brandPrimary;
  const brandSecondary = config.brandSecondary;
  const surface = config.surfaceColor;

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const sections = [
    {
      title: "LEARNING HUB 📚",
      color: brandPrimary,
      items: [
        { title: "Homework", subtitle: "Fun tasks!", icon: "document-text", color: "#FF6B6B", path: "/student-dashboard/assignments" },
        { title: "Submit Work", subtitle: "Magic upload", icon: "cloud-upload", color: "#4D96FF", path: "/student-dashboard/submit-assignment" },
        { title: "My Stars", subtitle: "Check scores", icon: "star", color: "#FFD93D", path: "/student-dashboard/assignment-scores" },
        { title: "Class Times", subtitle: "What's next?", icon: "time", color: "#6BCB77", path: "/student-dashboard/StudentTimetable" },
      ]
    },
    {
      title: "MY WORLD 🌍",
      color: "#4ECDC4",
      items: [
        { title: "Calendar", subtitle: "School Events", icon: "calendar-outline", color: "#f97316", path: "/academic-calendar" },
        { title: "My Plan", subtitle: "Daily routine", icon: "alarm", color: "#FF9F43", path: "/student-dashboard/personal-timetable" },
        { title: "Magic Notes", subtitle: "Great ideas", icon: "pencil", color: "#6BCB77", path: "/student-dashboard/note" },
        { title: "Attendance", subtitle: "My records", icon: "checkmark-circle", color: "#4D96FF", path: "/student-dashboard/daily-attendance" },
      ]
    },
    {
      title: "COMMUNITY 🚀",
      color: "#FFD93D",
      items: [
        { title: "My Teams", icon: "people", subtitle: "Study together", color: "#F368E0", path: "/student-dashboard/StudentGroups" },
        { title: "News Box", subtitle: "Important info", icon: "megaphone", color: "#54a0ff", path: "/student-dashboard/NewsScreen" },
        { title: "Play Games", subtitle: "Learn & Play", icon: "game-controller", color: "#FF6B6B", path: "/student-dashboard/games" },
        { title: "Fact Finder", subtitle: "Search anything", icon: "search", color: "#4ECDC4", path: "/student-dashboard/search" },
      ]
    }
  ];

  const cardBg = "#FFFFFF"; 
  const cardBorder = "#F1F5F9";

  const renderItem = (item: any, index: number) => (
    <Animatable.View
      key={item.title}
      animation="zoomIn"
      duration={500}
      delay={index * 50}
      style={styles.cardWrapper}
    >
      <TouchableOpacity
        style={[styles.menuCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
        onPress={() => router.push(item.path as any)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconBox, { backgroundColor: item.color + "15" }]}>
          <SVGIcon name={item.icon} size={28} color={item.color} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.menuText}>{item.title}</Text>
          <Text style={styles.menuSubtitle} numberOfLines={1}>{item.subtitle}</Text>
        </View>
      </TouchableOpacity>
    </Animatable.View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: surface }]}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <LinearGradient
          colors={[brandPrimary, brandSecondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.welcomeText}>{config.name.toUpperCase()} PORTAL</Text>
              <Text style={styles.studentName}>{appUser?.profile?.firstName || "Student"}</Text>
            </View>
            <TouchableOpacity onPress={() => router.push("/student-dashboard/settings")} style={styles.profileBtn}>
              {appUser?.profile?.profileImage ? (
                <Image source={{ uri: appUser.profile.profileImage }} style={styles.profileImg} />
              ) : (
                <Image source={require("../../assets/default-avatar.png")} style={styles.profileImg} />
              )}
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {sections.map((section, sIndex) => (
            <View key={section.title} style={section.title.includes("HUB") ? styles.section : { marginBottom: 30 }}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: section.color }]}>{section.title}</Text>
                <View style={[styles.sectionLine, { backgroundColor: section.color + '30' }]} />
              </View>
              <View style={styles.grid}>
                {section.items.map((item, iIndex) => renderItem(item, sIndex * 4 + iIndex))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 20,
    paddingHorizontal: 25,
    paddingBottom: 40,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    ...SHADOWS.medium,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  welcomeText: { fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: "900", letterSpacing: 2 },
  studentName: { fontSize: 26, fontWeight: "900", color: "#fff", marginTop: 4 },
  profileBtn: { width: 50, height: 50, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", overflow: "hidden", borderWidth: 2, borderColor: "rgba(255,255,255,0.3)" },
  profileImg: { width: "100%", height: "100%" },
  content: { paddingHorizontal: 20, marginTop: 25 },
  section: { marginBottom: 30 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 10 },
  sectionTitle: { fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  sectionLine: { flex: 1, height: 1, borderRadius: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 15 },
  cardWrapper: { width: CARD_WIDTH, marginBottom: 5 },
  menuCard: {
    width: '100%',
    borderRadius: 25,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.small,
    borderWidth: 1,
    minHeight: 130
  },
  iconBox: { width: 50, height: 50, borderRadius: 18, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  cardInfo: { alignItems: 'center' },
  menuText: { fontSize: 14, fontWeight: "800", color: "#334155", textAlign: "center" },
  menuSubtitle: { fontSize: 10, color: "#94A3B8", marginTop: 2, fontWeight: '600' },
});
