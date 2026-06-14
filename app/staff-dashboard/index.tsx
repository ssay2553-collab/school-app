import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { useCallback, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import { SafeAreaView } from "react-native-safe-area-context";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { getSchoolLogo } from "../../constants/Logos";
import { SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { auth } from "../../firebaseConfig";

const { width } = Dimensions.get("window");

export default function StaffDashboard() {
  const { showToast } = useToast();
  const { appUser } = useAuth();
  const router = useRouter();
  const schoolLogo = getSchoolLogo(SCHOOL_CONFIG.schoolId);
  const schoolName = SCHOOL_CONFIG.name;

  const brandPrimary = SCHOOL_CONFIG.brandPrimary;
  const brandSecondary = SCHOOL_CONFIG.brandSecondary;

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleLogout = () => {
    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to log out?")) {
        signOut(auth).then(() => router.replace("/"));
      }
      return;
    }

    Alert.alert("Sign Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut(auth);
            router.replace("/");
          } catch (err) {
            console.error(err);
            showToast({ message: "Could not sign out.", type: "error" });
          }
        },
      },
    ]);
  };

  const isAdmin = appUser?.role === "admin";
  const canFeeding =
    appUser?.permissions?.["feeding"] === "full" ||
    appUser?.permissions?.["feeding"] === "edit" ||
    appUser?.permissions?.["feeding"] === "view";
  const canBus =
    appUser?.permissions?.["record-bus-fee"] === "full" ||
    appUser?.permissions?.["record-bus-fee"] === "edit" ||
    appUser?.permissions?.["record-bus-fee"] === "view";
  const canExtraClasses =
    appUser?.permissions?.["record-extra-classes"] === "full" ||
    appUser?.permissions?.["record-extra-classes"] === "edit" ||
    appUser?.permissions?.["record-extra-classes"] === "view";
  const hasFinancialAccess = isAdmin || canFeeding || canBus || canExtraClasses;
  const canEditFinancials =
    appUser?.permissions?.["feeding"] === "full" ||
    appUser?.permissions?.["feeding"] === "edit" ||
    appUser?.permissions?.["record-bus-fee"] === "full" ||
    appUser?.permissions?.["record-bus-fee"] === "edit" ||
    appUser?.permissions?.["record-extra-classes"] === "full" ||
    appUser?.permissions?.["record-extra-classes"] === "edit";

  const sections = [
    {
      title: "STAFF UTILITIES 🛠️",
      color: "#4ECDC4",
      items: [
        {
          title: "Chat with Admin",
          subtitle: appUser?.adminRole || "Staff Support",
          route: "/guest-dashboard/chat-with-admin",
          icon: "chatbubbles",
          color: "#6366f1",
        },
        ...(hasFinancialAccess || canEditFinancials
          ? [
              {
                title: "Daily Financials",
                subtitle: "Feeding, Bus & Extra fees",
                route: "/shared/daily-financials",
                icon: "receipt",
                color: "#10b981",
              },
            ]
          : []),
      ],
    },
    {
      title: "INFORMATION 🏫",
      color: brandPrimary,
      items: [
        {
          title: "School Gallery",
          subtitle: "Campus updates",
          route: "/guest-dashboard/gallery",
          icon: "images",
          color: "#ec4899",
        },
        {
          title: "FAQs",
          subtitle: "Staff guidelines",
          route: "/guest-dashboard/FAQ",
          icon: "help-circle",
          color: "#f59e0b",
        },
      ],
    },
  ];

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
        onPress={() => router.push(item.route as any)}
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
              style={[styles.menuText, { fontSize: isSmallScreen ? 13 : 15 }]}
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
        </LinearGradient>
      </TouchableOpacity>
    </Animatable.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: "#FDFCF0" }]}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={brandPrimary}
            colors={[brandPrimary]}
          />
        }
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
                onPress={handleLogout}
                style={styles.settingsBtn}
              >
                <SVGIcon name="log-out-outline" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.heroSection}>
              <View>
                <Text style={styles.welcomeText}>WELCOME BACK,</Text>
                <Text
                  style={[
                    styles.nameText,
                    { fontSize: isSmallScreen ? 24 : 32 },
                  ]}
                >
                  {appUser?.displayName || "Staff Member"}
                </Text>
              </View>
              <View style={styles.statusBadge}>
                <SVGIcon name="briefcase" size={12} color="#fff" />
                <Text style={styles.statusText}>
                  {appUser?.adminRole?.toUpperCase() || "STAFF"}
                </Text>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>

        <View style={styles.contentContainer}>
          <View style={styles.mainContent}>
            {sections.map((section, sIndex) => (
              <View key={section.title} style={{ marginBottom: 40 }}>
                <View style={styles.sectionHeader}>
                  <View
                    style={[styles.dot, { backgroundColor: section.color }]}
                  />
                  <Text style={[styles.sectionTitle, { color: section.color }]}>
                    {section.title}
                  </Text>
                </View>
                <View style={styles.grid}>
                  {section.items
                    .filter((item: any) => !item.hidden)
                    .map((item, index) => renderCard(item, index + sIndex * 2))}
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
    position: "absolute",
    top: -20,
    right: -20,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  blob2: {
    position: "absolute",
    bottom: -40,
    left: -30,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.05)",
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
  statusText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  contentContainer: { alignItems: "center", width: "100%" },
  mainContent: {
    paddingHorizontal: 20,
    marginTop: 25,
    width: "100%",
    maxWidth: 1100,
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
    ...SHADOWS.small,
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
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: "hidden",
  },
});
