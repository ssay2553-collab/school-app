import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Platform,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import { SafeAreaView } from "react-native-safe-area-context";
import SVGIcon from "../../components/SVGIcon";
import UnreadBadge from "../../components/UnreadBadge";
import { useSchoolConfig } from "../../constants/Config";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { auth } from "../../firebaseConfig";
import useUnreadCounts from "../../hooks/useUnreadCounts";
import { copyToClipboard } from "../../utils/copyToClipboard";

export default function StudentDashboard() {
  const { appUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const config = useSchoolConfig();
  const { width: windowWidth } = useWindowDimensions();

  const brandPrimary = config.brandPrimary || COLORS.primary || "#6366F1";
  const brandSecondary =
    config.brandSecondary || config.secondaryColor || "#4338ca";
  const surface = config.surfaceColor || "#F8FAFC";

  const [refreshing, setRefreshing] = useState(false);
  const { totalUnread } = useUnreadCounts();

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleLogout = () => {
    const performLogout = async () => {
      try {
        await signOut(auth);
        router.replace("/");
      } catch (err) {
        Alert.alert("Error", "Logout failed.");
      }
    };

    if (Platform.OS === "web") {
      if (
        window.confirm(
          "Are you sure you want to sign out of the student portal?",
        )
      ) {
        performLogout();
      }
    } else {
      Alert.alert("Logout", "Are you sure you want to sign out?", [
        { text: "Cancel", style: "cancel" },
        { text: "Log Out", style: "destructive", onPress: performLogout },
      ]);
    }
  };

  const sections = [
    {
      title: "LEARNING HUB 📚",
      color: brandPrimary,
      items: [
        {
          title: "Homework",
          subtitle: "Fun tasks!",
          icon: "document-text",
          color: "#FF6B6B",
          path: "/student-dashboard/assignments",
        },
        {
          title: "Submit Work",
          subtitle: "Magic upload",
          icon: "cloud-upload",
          color: "#4D96FF",
          path: "/student-dashboard/submit-assignment",
        },
        {
          title: "My Stars",
          subtitle: "Check scores",
          icon: "star",
          color: "#FFD93D",
          path: "/student-dashboard/assignment-scores",
        },
        {
          title: "Class Times",
          subtitle: "What's next?",
          icon: "time",
          color: "#6BCB77",
          path: "/student-dashboard/StudentTimetable",
        },
      ],
    },
    {
      title: "MY WORLD 🌍",
      color: "#4ECDC4",
      items: [
        {
          title: "Calendar",
          subtitle: "School Events",
          icon: "calendar-outline",
          color: "#f97316",
          path: "/academic-calendar",
        },
        {
          title: "My Plan",
          subtitle: "Daily routine",
          icon: "alarm",
          color: "#FF9F43",
          path: "/student-dashboard/personal-timetable",
        },
        {
          title: "Magic Notes",
          subtitle: "Great ideas",
          icon: "pencil",
          color: "#6BCB77",
          path: "/student-dashboard/note",
        },
        {
          title: "Attendance",
          subtitle: "My records",
          icon: "checkmark-circle",
          color: "#4D96FF",
          path: "/student-dashboard/daily-attendance",
        },
      ],
    },
    {
      title: "COMMUNITY 🚀",
      color: "#FFD93D",
      items: [
        {
          title: "My Teams",
          icon: "people",
          subtitle: "Study together",
          color: "#F368E0",
          path: "/student-dashboard/StudentGroups",
        },
        {
          title: "News Box",
          subtitle: "Important info",
          icon: "megaphone",
          color: "#54a0ff",
          path: "/student-dashboard/NewsScreen",
        },
        {
          title: "Play Games",
          subtitle: "Learn & Play",
          icon: "game-controller",
          color: "#FF6B6B",
          path: "/student-dashboard/games",
        },
        {
          title: "Fact Finder",
          subtitle: "Search anything",
          icon: "search",
          color: "#4ECDC4",
          path: "/student-dashboard/search",
        },
      ],
    },
  ];

  if (authLoading || !appUser) {
    return (
      <View style={[styles.center, { backgroundColor: surface }]}>
        <ActivityIndicator size="large" color={brandPrimary} />
      </View>
    );
  }

  const isDesktop =
    Platform.OS === "web" ||
    Platform.OS === "windows" ||
    Platform.OS === "macos";
  const linkedParentsCount = appUser.parentUids?.length || 0;
  const isCodeLocked = linkedParentsCount >= 2;

  const renderItem = (item: any, index: number) => (
    <View
      key={item.title}
      style={[
        styles.cardWrapper,
        {
          width:
            windowWidth > 768
              ? (Math.min(1100, windowWidth) - 100) / 4
              : (windowWidth - 55) / 2,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.menuCard}
        onPress={() => router.push(item.path as any)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconBox, { backgroundColor: item.color + "15" }]}>
          <SVGIcon
            name={item.icon}
            size={windowWidth > 768 ? 32 : 28}
            color={item.color}
          />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.menuText}>{item.title}</Text>
          <Text style={styles.menuSubtitle} numberOfLines={1}>
            {item.subtitle}
          </Text>
        </View>
        {item.path &&
        (item.path.includes("chat") || item.path.includes("Group")) &&
        totalUnread > 0 ? (
          <View style={{ position: "absolute", top: 10, right: 12 }}>
            <UnreadBadge count={totalUnread} />
          </View>
        ) : null}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: surface }]}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <LinearGradient
          colors={[brandPrimary, brandSecondary]}
          style={styles.header}
        >
          <SafeAreaView edges={["top"]}>
            <View style={styles.headerRow}>
              <View style={styles.studentInfo}>
                <TouchableOpacity
                  onPress={() => router.push("/student-dashboard/settings")}
                  style={styles.profileBtn}
                >
                  {appUser?.profile?.profileImage ? (
                    <Image
                      source={{ uri: appUser.profile.profileImage }}
                      style={styles.profileImg}
                    />
                  ) : (
                    <View style={styles.profilePlaceholder}>
                      <Text style={styles.profilePlaceholderText}>
                        {appUser?.profile?.firstName?.[0] || "S"}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
                <View style={{ marginLeft: 15 }}>
                  <Text style={styles.welcomeText}>
                    {config.name.toUpperCase()} STUDENT
                  </Text>
                  <Text style={styles.studentName}>
                    {appUser?.profile?.firstName || "Student"}
                  </Text>

                  {/* AUTO-HIDE LOGIC: Hide code if 2 parents are linked */}
                  {!isCodeLocked ? (
                    <TouchableOpacity
                      onPress={async () => {
                        const code = appUser?.parentLinkCode;
                        if (!code) return;
                        const ok = await copyToClipboard(code);
                        if (ok) {
                          if (Platform.OS === "web")
                            window.alert("Family code copied to clipboard");
                          else
                            Alert.alert(
                              "Copied",
                              "Family code copied to clipboard.",
                            );
                        } else {
                          Alert.alert(
                            "Copy Failed",
                            "Unable to copy code to clipboard.",
                          );
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <Animatable.View
                        animation="pulse"
                        iterationCount="infinite"
                        style={[styles.codeBadge, styles.codeBadgeClickable]}
                      >
                        <Text style={styles.codeLabel}>FAMILY CODE: </Text>
                        <Text style={styles.codeValue}>
                          {appUser?.parentLinkCode || "------"}
                        </Text>
                      </Animatable.View>
                    </TouchableOpacity>
                  ) : (
                    <View
                      style={[
                        styles.codeBadge,
                        {
                          backgroundColor: "#10B98130",
                          borderColor: "#10B98150",
                        },
                      ]}
                    >
                      <SVGIcon
                        name="checkmark-circle"
                        size={12}
                        color="#10B981"
                      />
                      <Text
                        style={[
                          styles.codeValue,
                          { color: "#10B981", marginLeft: 5 },
                        ]}
                      >
                        FAMILY LINK SECURED
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.headerActions}>
                {isDesktop && (
                  <>
                    <TouchableOpacity
                      onPress={() =>
                        router.canGoBack() ? router.back() : router.replace("/")
                      }
                      style={styles.actionBtn}
                    >
                      <SVGIcon name="arrow-back" size={20} color="#fff" />
                      <Text style={styles.btnText}>BACK</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleLogout}
                      style={[styles.actionBtn, styles.exitBtn]}
                    >
                      <SVGIcon name="log-out-outline" size={20} color="#fff" />
                      <Text style={styles.btnText}>EXIT</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>

        <View style={styles.contentContainer}>
          <View style={styles.content}>
            {sections.map((section, sIndex) => (
              <View key={section.title} style={{ marginBottom: 35 }}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: section.color }]}>
                    {section.title}
                  </Text>
                  <View
                    style={[
                      styles.sectionLine,
                      { backgroundColor: section.color + "30" },
                    ]}
                  />
                </View>
                <View style={styles.grid}>
                  {section.items.map((item, iIndex) =>
                    renderItem(item, sIndex * 4 + iIndex),
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
    paddingHorizontal: 25,
    paddingBottom: 45,
    borderBottomLeftRadius: 45,
    borderBottomRightRadius: 45,
    ...SHADOWS.medium,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Platform.OS === "web" ? 20 : 0,
  },
  studentInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
  welcomeText: {
    fontSize: 10,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  studentName: { fontSize: 24, fontWeight: "900", color: "#fff", marginTop: 2 },
  codeBadge: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginTop: 8,
    alignSelf: "flex-start",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  codeBadgeClickable: {
    // web-only cursor hint; ignored on native
    ...(Platform.OS === "web" ? { cursor: "pointer" as any } : {}),
  },
  codeLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "800",
  },
  codeValue: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "900",
    letterSpacing: 2,
  },
  profileBtn: {
    width: 65,
    height: 65,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.2)",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  profileImg: { width: "100%", height: "100%" },
  profilePlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  profilePlaceholderText: { color: "#fff", fontWeight: "bold", fontSize: 24 },
  headerActions: { flexDirection: "row", gap: 10, alignItems: "center" },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  exitBtn: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderColor: "rgba(255,255,255,0.3)",
  },
  btnText: { fontSize: 11, fontWeight: "800", color: "#fff" },
  contentContainer: { alignItems: "center", width: "100%" },
  content: {
    paddingHorizontal: 20,
    marginTop: 25,
    width: "100%",
    maxWidth: 1100,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    gap: 10,
  },
  sectionTitle: { fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  sectionLine: { flex: 1, height: 1, borderRadius: 1 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    gap: 15,
  },
  cardWrapper: { marginBottom: 5 },
  menuCard: {
    backgroundColor: "#fff",
    borderRadius: 25,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    minHeight: 130,
    width: "100%",
  },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  cardInfo: { alignItems: "center" },
  menuText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#334155",
    textAlign: "center",
  },
  menuSubtitle: {
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 2,
    fontWeight: "600",
  },
});
