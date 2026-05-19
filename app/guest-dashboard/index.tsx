import { useRouter } from "expo-router";
import React, { useState, useCallback } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
  Dimensions,
  Platform,
  RefreshControl,
  Image,
  Linking,
  Alert
} from "react-native";
import { useToast } from "../../contexts/ToastContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Animatable from "react-native-animatable";
import Constants from "expo-constants";
import { signOut } from "firebase/auth";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { getSchoolLogo } from "../../constants/Logos";
import { COLORS, SHADOWS } from "../../constants/theme";
import { auth } from "../../firebaseConfig";
import { useAuth } from "../../contexts/AuthContext";

const { width } = Dimensions.get("window");

export default function GuestDashboard() {
  const { showToast } = useToast();
  const { appUser } = useAuth();
  const router = useRouter();
  const schoolId = SCHOOL_CONFIG.schoolId;
  const schoolLogo = getSchoolLogo(schoolId);
  const schoolName = SCHOOL_CONFIG.name;
  
  const brandPrimary = SCHOOL_CONFIG.brandPrimary;
  const brandSecondary = SCHOOL_CONFIG.brandSecondary;
  const surface = SCHOOL_CONFIG.surfaceColor;

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm("Are you sure you want to exit the guest portal?")) {
        signOut(auth).then(() => router.replace("/"));
      }
      return;
    }

    Alert.alert("Sign Out", "Are you sure you want to exit the guest portal?", [
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

  const handleCall = async (number: string) => {
    const cleanNumber = number.replace(/[^0-9+]/g, "");
    const url = `tel:${cleanNumber}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        showToast({
          message: "Phone calls are not supported on this device.",
          type: "info",
        });
      }
    } catch (err) {
      console.error("Linking error:", err);
      showToast({ message: "Could not open dialer.", type: "error" });
    }
  };

  const phoneNumbers = SCHOOL_CONFIG.hotline
    .split("/")
    .map((n: string) => n.trim())
    .filter((n: string) => !!n);

  const isAdmin = appUser?.role === "admin";
  const canFeeding = appUser?.permissions?.["feeding"] === "full" || appUser?.permissions?.["feeding"] === "edit";
  const canBus = appUser?.permissions?.["record-bus-fee"] === "full" || appUser?.permissions?.["record-bus-fee"] === "edit";
  const hasFinancialAccess = isAdmin || canFeeding || canBus;

  const sections = [
    {
      title: "ADMISSIONS & ENQUIRY 🚀",
      color: "#4ECDC4",
      items: [
        {
          title: "Direct Inquiry",
          subtitle: "Chat with staff",
          route: "/guest-dashboard/chat-with-admin",
          icon: "chatbubbles",
          color: "#10b981",
        },
        {
          title: "Membership",
          subtitle: "Full registration",
          route: "/guest-dashboard/upgrade-account",
          icon: "flash",
          color: "#ec4899",
        },
        {
          title: "Daily Financials",
          subtitle: "Fee recording",
          route: "/admin-dashboard/DailyFinancials",
          icon: "calculator",
          color: "#10b981",
          hidden: !hasFinancialAccess,
        },
      ],
    },
    {
      title: "EXPLORE CAMPUS 🏫",
      color: brandPrimary,
      items: [
        {
          title: "Academic Gallery",
          subtitle: "Campus tour",
          route: "/guest-dashboard/gallery",
          icon: "images",
          color: "#6366f1",
        },
        {
          title: "Common Questions",
          subtitle: "Helpful FAQs",
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
              <TouchableOpacity onPress={handleLogout} style={styles.settingsBtn}>
                <SVGIcon name="log-out-outline" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.heroSection}>
              <View>
                <Text style={styles.welcomeText}>WELCOME TO OUR PORTAL,</Text>
                <Text
                  style={[styles.nameText, { fontSize: isSmallScreen ? 24 : 32 }]}
                >
                  Guest Explorer
                </Text>
              </View>
              <View style={styles.statusBadge}>
                <SVGIcon name="rocket" size={12} color="#fff" />
                <Text style={styles.statusText}>EXPLORER</Text>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>

        <View style={styles.contentContainer}>
          <View style={styles.mainContent}>
            <Animatable.View
              animation="fadeInUp"
              duration={1000}
              style={styles.infoCard}
            >
              <View style={styles.infoRow}>
                <View
                  style={[
                    styles.infoIcon,
                    { backgroundColor: brandPrimary + "15" },
                  ]}
                >
                  <SVGIcon
                    name="location-outline"
                    size={18}
                    color={brandPrimary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>LOCATION</Text>
                  <Text style={styles.infoValue}>{SCHOOL_CONFIG.address}</Text>
                </View>
              </View>
              <View style={[styles.infoRow, { marginTop: 15 }]}>
                <View
                  style={[
                    styles.infoIcon,
                    { backgroundColor: brandPrimary + "15" },
                  ]}
                >
                  <SVGIcon name="mail-outline" size={18} color={brandPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>EMAIL US</Text>
                  <Text style={styles.infoValue}>
                    {SCHOOL_CONFIG.email || "info@school.edu"}
                  </Text>
                </View>
              </View>
            </Animatable.View>

            <View style={styles.callCardContainer}>
              {phoneNumbers.map((phone: string, index: number) => (
                <Animatable.View
                  key={phone}
                  animation="fadeInLeft"
                  duration={800}
                  delay={200 + index * 100}
                  style={styles.callCard}
                >
                  <View
                    style={[styles.callIconBox, { backgroundColor: "#ef444415" }]}
                  >
                    <SVGIcon name="megaphone" size={24} color="#ef4444" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.callTitle}>Admissions Hotline</Text>
                    <Text style={styles.callPhone}>{phone}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.callActionBtn}
                    onPress={() => handleCall(phone)}
                  >
                    <Text style={styles.callActionText}>Call</Text>
                  </TouchableOpacity>
                </Animatable.View>
              ))}
            </View>

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
  infoCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 24,
    marginBottom: 25,
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 15 },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 1,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
    marginTop: 1,
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
  callCardContainer: { marginBottom: 30, gap: 12 },
  callCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 24,
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  callIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  callTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    textTransform: "uppercase",
  },
  callPhone: { fontSize: 16, fontWeight: "800", color: "#1E293B", marginTop: 2 },
  callActionBtn: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 10,
  },
  callActionText: { color: "#fff", fontWeight: "700", fontSize: 12 },
});
