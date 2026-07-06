import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { collection, doc, documentId, getDoc, getDocsFromServer, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    Image,
    Platform,
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
  const [hasPreschoolChild, setHasPreschoolChild] = useState(false);

  const {
    brandPrimary,
    brandSecondary,
    surfaceColor,
    schoolId,
    name: schoolName,
  } = config;
  const schoolLogo = getSchoolLogo(schoolId);

  const PRESCHOOL_KEYWORDS = ["CRECHE", "NURSERY", "KG", "KINDERGARTEN", "TODDLER", "PLAYGROUND", "LEVEL A", "LEVEL B", "LEVEL C", "LEVEL D", "CLASS A", "CLASS B", "CLASS C", "CLASS D"];

  useEffect(() => {
    if (!appUser) return;
    const fetchProfile = async () => {
      try {
        const snap = await getDoc(doc(db, "users", appUser.uid));
        if (snap.exists()) {
          const userData = snap.data() as any;
          const p = userData.profile;
          if (p) setFullName(`${p.firstName || ""} ${p.lastName || ""}`);

          // Check for preschool children
          const childrenIds = userData.childrenIds || [];
          if (childrenIds.length > 0) {
            const q = query(collection(db, "users"), where(documentId(), "in", childrenIds));
            const cSnap = await getDocsFromServer(q);
            const classIds = cSnap.docs.map(d => (d.data() as any).classId).filter(id => !!id);

            if (classIds.length > 0) {
              const cq = query(collection(db, "classes"), where(documentId(), "in", classIds));
              const clSnap = await getDocsFromServer(cq);

              const hasPreschool = clSnap.docs.some(d => {
                const cData = d.data() as any;
                const dept = (cData.department || "").toLowerCase();
                const level = String(cData.level || "").toUpperCase();
                const className = (cData.name || "").toUpperCase();

                if (dept === "pre-school") return true;
                if (["A", "B", "C", "D"].includes(level)) return true;

                const keywords = ["CRECHE", "NURSERY", "KG", "KINDERGARTEN", "TODDLER", "PLAYGROUND"];
                return keywords.some(kw => className.includes(kw));
              });
              setHasPreschoolChild(hasPreschool);
            }
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [appUser]);

  const handleCall = async (number: string) => {
    const cleanNumber = number.replace(/[^0-9+]/g, "");
    const url = `tel:${cleanNumber}`;
    try {
      const { Linking, Alert } = require("react-native");
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        if (Platform.OS === 'web') {
           window.alert("Phone calls are not supported on this device.");
        } else {
           Alert.alert("Info", "Phone calls are not supported on this device.");
        }
      }
    } catch (err) {
      console.error("Linking error:", err);
    }
  };

  const phoneNumbers = config.hotline
    ? config.hotline.split("/").map((n: string) => n.trim()).filter((n: string) => !!n)
    : [];

  const sections = [
    {
      title: "STUDENT MONITORING 📊",
      color: "#4ECDC4",
      items: [
        {
          title: "Academic Reports",
          subtitle: "Terminal results",
          icon: "document-text",
          color: "#6366f1",
          path: "/parent-dashboard/student-academic-report",
        },
        ...(hasPreschoolChild ? [{
          title: "Preschool Remarks",
          subtitle: "Behavioral records",
          icon: "happy-outline",
          color: "#ec4899",
          path: "/parent-dashboard/preschool-remarks",
        }] : []),
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
      title: "FINANCE & NEWS 💰",
      color: "#FFD93D",
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
          subtitle: "Balance breakdown",
          icon: "receipt",
          color: "#f59e0b",
          path: "/parent-dashboard/student-fee-history",
        },
        {
          title: "Payment Receipts",
          subtitle: "Transaction history",
          icon: "document-attach-outline",
          color: "#10b981",
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
      title: "COMMUNICATION 🚀",
      color: "#FF9F43",
      items: [
        {
          title: "Teachers",
          subtitle: "Chat with staff",
          icon: "chatbubbles",
          color: "#3b82f6",
          path: "/parent-dashboard/chat-with-teacher",
        },
        {
          title: "Admin Support",
          subtitle: "Office enquiries",
          icon: "shield-checkmark",
          color: "#ec4899",
          path: "/parent-dashboard/chat-with-admin",
        },
      ],
    },
    {
      title: "EXPLORE CAMPUS 🏫",
      color: brandPrimary,
      items: [
        {
          title: "School Gallery",
          subtitle: "Campus tour",
          icon: "images",
          color: "#6366f1",
          path: "/parent-dashboard/gallery",
        },
        {
          title: "Common FAQ",
          subtitle: "Helpful info",
          icon: "help-circle",
          color: "#f59e0b",
          path: "/parent-dashboard/FAQ",
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

  const getColumns = () => {
    if (width >= 1200) return 5;
    if (width >= 900) return 4;
    if (width >= 600) return 3;
    return 2;
  };

  const numColumns = getColumns();
  const gap = 12;
  const sidePadding = 20;
  const totalGapSpace = (numColumns - 1) * gap;
  const availableWidth = Math.min(1200, width) - sidePadding * 2;
  const cardWidth = (availableWidth - totalGapSpace) / numColumns;
  const isSmallScreen = width < 380;

  const renderCard = (item: any, index: number) => (
    <Animatable.View
      animation="bounceIn"
      duration={800}
      delay={index * 50}
      key={item.title}
      style={{ width: cardWidth, marginBottom: 10 }}
    >
      <TouchableOpacity
        style={[styles.menuCard, { borderBottomColor: item.color + "40" }]}
        onPress={() => router.push(item.path as any)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={["#FFFFFF", item.color + "05"]}
          style={styles.cardGradient}
        >
          <View
            style={[
              styles.iconBox,
              {
                backgroundColor: item.color + "20",
                width: isSmallScreen ? 50 : 60,
                height: isSmallScreen ? 50 : 60,
                borderRadius: isSmallScreen ? 18 : 22,
              },
            ]}
          >
            <SVGIcon
              name={item.icon}
              size={numColumns > 3 ? 36 : isSmallScreen ? 26 : 30}
              color={item.color}
            />
          </View>
          <View style={styles.cardInfo}>
            <Text
              style={[
                styles.menuText,
                { fontSize: isSmallScreen ? 13 : 15 },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {item.title}
            </Text>
            <Text
              style={[
                styles.menuSubtitle,
                { color: item.color, fontSize: isSmallScreen ? 9 : 10 },
              ]}
              numberOfLines={1}
            >
              {item.subtitle}
            </Text>
          </View>
          {item.path && item.path.includes("chat") && totalUnread > 0 ? (
            <View style={styles.badgePos}>
              <UnreadBadge count={totalUnread} />
            </View>
          ) : null}
        </LinearGradient>
      </TouchableOpacity>
    </Animatable.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: "#FDFCF0" }]}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <LinearGradient
          colors={[brandPrimary, brandSecondary]}
          style={styles.header}
        >
          <View style={styles.blob1} />
          <View style={styles.blob2} />

          <SafeAreaView edges={["top"]}>
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
                <SVGIcon name="settings-outline" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.heroSection}>
              <View style={{ flex: 1 }}>
                <Text style={styles.welcomeText}>WELCOME BACK,</Text>
                <Text
                  style={[styles.nameText, { fontSize: isSmallScreen ? 24 : 32 }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {fullName?.split(" ")[0] || "Parent"}
                </Text>
              </View>
              <View style={styles.statusBadge}>
                <SVGIcon name="checkmark-seal" size={12} color="#fff" />
                <Text style={styles.statusText}>PARENT PORTAL</Text>
              </View>
            </View>

            <Animatable.View animation="fadeInUp" delay={400} style={styles.headerContactInfo}>
              <View style={styles.headerContactItem}>
                <SVGIcon name="location-outline" size={14} color="#fff" />
                <Text style={[styles.headerContactText, { flex: 1 }]} numberOfLines={1}>
                  {config.address}
                </Text>
              </View>
              <View style={styles.headerContactRow}>
                {phoneNumbers.map((phone: string, index: number) => (
                  <TouchableOpacity
                    key={phone}
                    style={styles.headerContactItem}
                    onPress={() => handleCall(phone)}
                    activeOpacity={0.7}
                  >
                    <SVGIcon name="call" size={13} color="#fff" />
                    <Text style={styles.headerContactText}>{phone}</Text>
                  </TouchableOpacity>
                ))}
                {config.email && (
                  <View style={styles.headerContactItem}>
                    <SVGIcon name="mail-outline" size={13} color="#fff" />
                    <Text style={styles.headerContactText}>{config.email}</Text>
                  </View>
                )}
              </View>
            </Animatable.View>
          </SafeAreaView>
        </LinearGradient>

        <View style={styles.contentContainer}>
          <View style={styles.mainContent}>
            {sections.map((section, sIndex) => (
              <View key={section.title} style={{ marginBottom: 40 }}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.dot, { backgroundColor: section.color }]} />
                  <Text style={[styles.sectionTitle, { color: section.color }]}>
                    {section.title}
                  </Text>
                </View>
                <View style={styles.grid}>
                  {section.items.map((item, index) =>
                    renderCard(item, index + sIndex * 3),
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { flexGrow: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: "hidden",
    ...SHADOWS.medium,
  },
  blob1: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  blob2: {
    position: 'absolute',
    bottom: -40,
    left: -30,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
    paddingTop: Platform.OS === "web" ? 20 : 0,
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
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  heroSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  welcomeText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "900",
    letterSpacing: 1,
  },
  nameText: { fontSize: 32, fontWeight: "900", color: "#fff", marginTop: 2 },
  statusBadge: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: "center",
    gap: 6,
  },
  statusText: { color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  contentContainer: { alignItems: "center", width: "100%" },
  mainContent: {
    paddingHorizontal: 20,
    marginTop: 25,
    width: "100%",
    maxWidth: 1100,
  },
  headerContactInfo: {
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.2)",
    gap: 12,
  },
  headerContactItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerContactText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    opacity: 0.9,
  },
  headerContactRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 12,
    paddingHorizontal: 10,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  sectionTitle: { fontSize: 18, fontWeight: "900", letterSpacing: 0.5 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
  },
  menuCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    overflow: "hidden",
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderBottomWidth: 4,
    minHeight: 130,
    width: "100%",
  },
  cardGradient: {
    flex: 1,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBox: {
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  cardInfo: { alignItems: "center" },
  menuText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1E293B",
    textAlign: "center",
  },
  menuSubtitle: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: "800",
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden'
  },
  badgePos: { position: "absolute", top: 15, right: 15 },
});

