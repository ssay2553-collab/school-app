import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    Image,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import UnreadBadge from "../../components/UnreadBadge";
import { useSchoolConfig } from "../../constants/Config";
import { getSchoolLogo } from "../../constants/Logos";
import { SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebaseConfig";
import useUnreadCounts from "../../hooks/useUnreadCounts";

const { width } = Dimensions.get("window");

export default function ParentDashboard() {
  const router = useRouter();
  const { appUser } = useAuth();
  const config = useSchoolConfig();
  const { totalUnread } = useUnreadCounts();

  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);

  const {
    brandPrimary,
    brandSecondary,
    surfaceColor,
    schoolId,
    name: schoolName,
  } = config;
  const schoolLogo = getSchoolLogo(schoolId);

  useEffect(() => {
    if (!appUser) return;
    const fetchProfile = async () => {
      try {
        const snap = await getDoc(doc(db, "users", appUser.uid));
        if (snap.exists()) {
          const p = (snap.data() as any).profile;
          if (p) setFullName(`${p.firstName || ""} ${p.lastName || ""}`);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [appUser]);

  const sections = [
    {
      title: "STUDENT MONITORING",
      items: [
        {
          title: "Academic Reports",
          subtitle: "Terminal results",
          icon: "document-text",
          color: "#6366f1",
          path: "/parent-dashboard/student-academic-report",
        },
        {
          title: "Recent Scores",
          subtitle: "Assignment marks",
          icon: "ribbon",
          color: "#f43f5e",
          path: "/parent-dashboard/assignment-scores",
        },
        {
          title: "Attendance",
          subtitle: "Daily tracking",
          icon: "calendar",
          color: "#10b981",
          path: "/parent-dashboard/attendance",
        },
      ],
    },
    {
      title: "FINANCE & NEWS",
      items: [
        {
          title: "Academic Calendar",
          subtitle: "Events & Holidays",
          icon: "calendar-outline",
          color: "#f97316",
          path: "/academic-calendar",
        },
        {
          title: "Fee Ledger",
          subtitle: "Payments & balance",
          icon: "receipt",
          color: "#f59e0b",
          path: "/parent-dashboard/student-fee-history",
        },
        {
          title: "School News",
          subtitle: "Announcements",
          icon: "megaphone",
          color: "#8b5cf6",
          path: "/parent-dashboard/NewsScreen",
        },
      ],
    },
    {
      title: "COMMUNICATION",
      items: [
        {
          title: "Teachers",
          subtitle: "Chat with instructors",
          icon: "chatbubbles",
          color: "#3b82f6",
          path: "/parent-dashboard/chat-with-teacher",
        },
        {
          title: "Admin Support",
          subtitle: "Office inquiries",
          icon: "shield-checkmark",
          color: "#ec4899",
          path: "/parent-dashboard/chat-with-admin",
        },
      ],
    },
  ];

  if (loading)
    return (
      <View style={[styles.center, { backgroundColor: surfaceColor }]}>
        <ActivityIndicator size="large" color={brandPrimary} />
      </View>
    );

  const renderCard = (item: any, index: number) => (
    <Animatable.View
      animation="fadeInUp"
      duration={600}
      delay={index * 100}
      key={item.title}
      style={styles.cardWrapper}
    >
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(item.path as any)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconBox, { backgroundColor: item.color + "15" }]}>
          <SVGIcon name={item.icon} size={26} color={item.color} />
        </View>
        <View style={styles.cardTextContent}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardSubtitle} numberOfLines={1}>
            {item.subtitle}
          </Text>
        </View>
        <View style={styles.chevronBox}>
          {item.path && item.path.includes("chat") && totalUnread > 0 ? (
            <View style={{ marginRight: 8 }}>
              <UnreadBadge count={totalUnread} />
            </View>
          ) : null}
          <SVGIcon name="chevron-forward" size={16} color="#CBD5E1" />
        </View>
      </TouchableOpacity>
    </Animatable.View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: surfaceColor }]}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <LinearGradient
          colors={[brandPrimary, brandSecondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.topBar}>
            <View style={styles.schoolBadge}>
              <Image
                source={schoolLogo}
                style={styles.schoolLogoMini}
                resizeMode="contain"
              />
              <Text style={styles.schoolNameMini}>{schoolName}</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/parent-dashboard/settings")}
              style={styles.settingsBtn}
            >
              <SVGIcon name="settings" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.heroSection}>
            <View>
              <Text style={styles.welcomeText}>Welcome back,</Text>
              <Text style={styles.nameText}>{fullName || "Parent"}</Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: "rgba(255,255,255,0.2)" },
              ]}
            >
              <View style={[styles.dot, { backgroundColor: "#fff" }]} />
              <Text style={[styles.statusText, { color: "#fff" }]}>
                Parent Portal
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.mainContent}>
          {sections.map((section, sIndex) => (
            <View key={section.title} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <View style={styles.sectionLine} />
              </View>
              <View style={styles.grid}>
                {section.items.map((item, index) =>
                  renderCard(item, index + sIndex * 3),
                )}
              </View>
            </View>
          ))}

          <View style={styles.footerInfo}>
            <SVGIcon name="information-circle" size={16} color="#94A3B8" />
            <Text style={styles.footerText}>
              Select a module to view student details
            </Text>
          </View>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { paddingBottom: 20 },
  header: {
    paddingTop: Platform.OS === "ios" ? 10 : 20,
    paddingHorizontal: 25,
    paddingBottom: 40,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
    ...SHADOWS.medium,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
  },
  schoolBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  schoolLogoMini: { width: 18, height: 18, marginRight: 8 },
  schoolNameMini: {
    fontSize: 11,
    fontWeight: "800",
    color: "#fff",
    textTransform: "uppercase",
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  heroSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  welcomeText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "600",
  },
  nameText: { fontSize: 28, fontWeight: "900", color: "#fff", marginTop: 2 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  mainContent: {
    paddingHorizontal: 20,
    marginTop: 30,
  },
  section: { marginBottom: 30 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: "#94A3B8",
    letterSpacing: 1.2,
    marginRight: 10,
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: "#E2E8F0" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  cardWrapper: {
    width: (width - 55) / 2,
    marginBottom: 15,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    minHeight: 140,
    justifyContent: "space-between",
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  cardTextContent: { flex: 1 },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1E293B",
    lineHeight: 20,
  },
  cardSubtitle: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 4,
    fontWeight: "500",
  },
  chevronBox: { alignSelf: "flex-end", marginTop: 5 },
  footerInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    opacity: 0.7,
  },
  footerText: {
    fontSize: 12,
    color: "#94A3B8",
    marginLeft: 6,
    fontWeight: "500",
  },
});
