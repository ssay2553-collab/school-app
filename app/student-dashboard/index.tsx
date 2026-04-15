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
          title: "Study Hub",
          subtitle: "Past Questions",
          icon: "library",
          color: "#A55EEA",
          path: "/student-dashboard/study-resources",
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
    <Animatable.View
      animation="bounceIn"
      duration={800}
      delay={index * 50}
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
        style={[styles.menuCard, { borderBottomColor: item.color + "40" }]}
        onPress={() => router.push(item.path as any)}
        activeOpacity={0.8}
      >
        <LinearGradient
            colors={['#FFFFFF', item.color + '05']}
            style={styles.cardGradient}
        >
            <View style={[styles.iconBox, { backgroundColor: item.color + "20" }]}>
              <SVGIcon
                name={item.icon}
                size={windowWidth > 768 ? 36 : 32}
                color={item.color}
              />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.menuText}>{item.title}</Text>
              <Text style={[styles.menuSubtitle, { color: item.color }]}>
                {item.subtitle}
              </Text>
            </View>
            {item.path &&
            (item.path.includes("chat") || item.path.includes("Group")) &&
            totalUnread > 0 ? (
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
          <View style={styles.blob1} />
          <View style={styles.blob2} />

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
                    HI THERE, EXPLORER! 👋
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
                            window.alert("Magic code copied! ✨");
                          else
                            Alert.alert(
                              "Copied!",
                              "Your magic code is ready to share. ✨",
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
                        <Text style={styles.codeLabel}>MAGIC CODE: </Text>
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
                          backgroundColor: "rgba(255,255,255,0.3)",
                          borderColor: "rgba(255,255,255,0.4)",
                        },
                      ]}
                    >
                      <SVGIcon
                        name="heart"
                        size={12}
                        color="#fff"
                      />
                      <Text
                        style={[
                          styles.codeValue,
                          { color: "#fff", marginLeft: 5, fontSize: 10 },
                        ]}
                      >
                        FAMILY CONNECTED!
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
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleLogout}
                      style={[styles.actionBtn, styles.exitBtn]}
                    >
                      <SVGIcon name="log-out-outline" size={20} color="#fff" />
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
              <View key={section.title} style={{ marginBottom: 40 }}>
                <View style={styles.sectionHeader}>
                    <View style={[styles.dot, { backgroundColor: section.color }]} />
                  <Text style={[styles.sectionTitle, { color: section.color }]}>
                    {section.title}
                  </Text>
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
    paddingBottom: 60,
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 50,
    overflow: 'hidden',
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Platform.OS === "web" ? 20 : 0,
  },
  studentInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
  welcomeText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "900",
    letterSpacing: 1,
  },
  studentName: { fontSize: 32, fontWeight: "900", color: "#fff", marginTop: 2 },
  codeBadge: {
    flexDirection: "row",
    backgroundColor: "#FFD93D",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 12,
    alignSelf: "flex-start",
    alignItems: "center",
    ...SHADOWS.small,
  },
  codeBadgeClickable: {
    ...(Platform.OS === "web" ? { cursor: "pointer" as any } : {}),
  },
  codeLabel: {
    fontSize: 10,
    color: "#4338ca",
    fontWeight: "900",
  },
  codeValue: {
    fontSize: 14,
    color: "#4338ca",
    fontWeight: "900",
    letterSpacing: 1,
  },
  profileBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#fff",
    overflow: "hidden",
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.5)",
    ...SHADOWS.medium,
  },
  profileImg: { width: "100%", height: "100%" },
  profilePlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  profilePlaceholderText: { color: "#4338ca", fontWeight: "900", fontSize: 32 },
  headerActions: { flexDirection: "row", gap: 10, alignItems: "center" },
  actionBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: 'center',
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  exitBtn: {
    backgroundColor: "rgba(255,0,0,0.2)",
  },
  contentContainer: { alignItems: "center", width: "100%" },
  content: {
    paddingHorizontal: 20,
    marginTop: -30, // Pull content up into the header curve
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
    justifyContent: "flex-start",
    gap: 20,
  },
  cardWrapper: { marginBottom: 10 },
  menuCard: {
    backgroundColor: "#fff",
    borderRadius: 35,
    overflow: 'hidden',
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderBottomWidth: 6, // 3D effect
    minHeight: 150,
    width: "100%",
  },
  cardGradient: {
    flex: 1,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBox: {
    width: 65,
    height: 65,
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
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden'
  },
  badgePos: { position: "absolute", top: 15, right: 15 },
});
