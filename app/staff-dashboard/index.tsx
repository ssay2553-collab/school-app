import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import React, { useCallback, useState } from "react";
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
  ActivityIndicator
} from "react-native";
import * as Animatable from "react-native-animatable";
import { SafeAreaView } from "react-native-safe-area-context";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { getSchoolLogo } from "../../constants/Logos";
import { SHADOWS, COLORS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { auth } from "../../firebaseConfig";

import { AdminEventStats } from "../../components/admin-dashboard/AdminEventStats";
import DashboardHeader from "../../components/DashboardHeader";
import StationaryBackground from "../../components/StationaryBackground";
import { useUpcomingEvents } from "../../hooks/useUpcomingEvents";

const { width } = Dimensions.get("window");

export default function StaffDashboard() {
  const { showToast } = useToast();
  const { appUser } = useAuth();
  const router = useRouter();
  const { upcomingEvents, loading: eventsLoading } = useUpcomingEvents(2);

  const brandPrimary = SCHOOL_CONFIG.brandPrimary || COLORS.primary || "#6366F1";
  const brandSecondary = SCHOOL_CONFIG.brandSecondary || "#4338ca";

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

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
          title: "Staff Support",
          subtitle: appUser?.adminRole || "Support center",
          route: "/admin-dashboard/staff-chat",
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
                width: isSmallScreen ? 42 : 48,
                height: isSmallScreen ? 42 : 48,
                borderRadius: isSmallScreen ? 14 : 16,
              },
            ]}
          >
            <SVGIcon
              name={item.icon}
              size={numColumns > 3 ? 24 : isSmallScreen ? 20 : 22}
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
      <StationaryBackground />
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
        <DashboardHeader
          brandPrimary={brandPrimary}
          brandSecondary={brandSecondary}
          appUser={appUser}
          isSmallScreen={isSmallScreen}
          welcomeText="WELCOME BACK,"
          roleTag="Staff"
          onProfilePress={() => router.push("/teacher-dashboard/profile-edit")}
          onSettingsPress={() => router.push("/teacher-dashboard/settings")}
          onAdminDashboardPress={() => router.push("/admin-dashboard")}
          showAdminButton={appUser?.role === "admin"}
        >
          <AdminEventStats
            upcomingEvents={upcomingEvents}
            loading={eventsLoading}
            brandPrimary={brandPrimary}
            onViewAll={() => router.push("/academic-calendar")}
            onEventPress={() => router.push("/academic-calendar")}
          />
        </DashboardHeader>

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
    minHeight: 110,
    width: "100%",
  },
  cardGradient: {
    flex: 1,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBox: {
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
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
