import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Tabs, useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import React, { useEffect } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { getSchoolLogo } from "../../constants/Logos";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { auth } from "../../firebaseConfig";
import SVGIcon from "../../components/SVGIcon";

// Configure how notifications behave when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: false,
    shouldShowList: false,
  }),
});

export default function StudentDashboardLayout() {
  const router = useRouter();
  const { appUser, loading } = useAuth();
  const schoolId = Constants.expoConfig?.extra?.schoolId || "afahjoy";
  const schoolLogo = getSchoolLogo(schoolId);
  const primary = SCHOOL_CONFIG.primaryColor || COLORS.primary;
  const secondary = SCHOOL_CONFIG.secondaryColor;

  useEffect(() => {
    if (!loading && appUser && appUser.role !== "student" && appUser.role !== "admin") {
      Alert.alert("Access Denied", "You are not authorized to access the Student Portal.");
      router.replace("/");
    }
  }, [appUser, loading]);

  useEffect(() => {
    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;

        if (data?.type === "group_message") {
          router.push({
            pathname: "/student-dashboard/GroupChat",
            params: { groupId: (data as any).groupId },
          } as any);
        } else if (data?.type === "assignment") {
          router.push("/student-dashboard/assignments");
        }
      });

    return () => {
      responseSubscription.remove();
    };
  }, [router]);

  const performLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/");
    } catch (err) {
      console.error("Sign out failed:", err);
      if (Platform.OS === 'web') {
          alert("Failed to sign out. Please try again.");
      } else {
          Alert.alert("Error", "Failed to sign out. Please try again.");
      }
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm("Are you sure you want to log out of the student portal?")) {
        performLogout();
      }
    } else {
      Alert.alert(
        "Logout",
        "Are you sure you want to log out of the student portal?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Log Out", style: "destructive", onPress: performLogout },
        ],
      );
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/student-dashboard");
    }
  };

  if (loading || !appUser) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: primary }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (appUser.role !== "student" && appUser.role !== "admin") {
    return null;
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={[primary, secondary]} style={styles.headerGradient}>
        <SafeAreaView>
          <View style={styles.header}>
            <View style={styles.schoolInfo}>
              <Image
                source={schoolLogo}
                style={styles.miniLogo}
                resizeMode="contain"
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.schoolName} numberOfLines={1}>
                  {SCHOOL_CONFIG.fullName}
                </Text>
                <Text style={styles.portalTag}>Student Learning Portal 🎓</Text>
              </View>
            </View>

            <View style={styles.headerActions}>
               <TouchableOpacity onPress={handleBack} style={styles.actionBtn}>
                 <SVGIcon name="arrow-back" size={20} color="#fff" />
                 <Text style={styles.btnText}>BACK</Text>
               </TouchableOpacity>
               <TouchableOpacity onPress={handleLogout} style={[styles.actionBtn, styles.exitBtn]}>
                 <SVGIcon name="log-out-outline" size={20} color="#fff" />
                 <Text style={styles.btnText}>EXIT</Text>
               </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Home" }} />
        <Tabs.Screen name="daily-attendance" options={{ href: null }} />
        <Tabs.Screen name="assignments" options={{ href: null }} />
        <Tabs.Screen name="submit-assignment" options={{ href: null }} />
        <Tabs.Screen name="assignment-scores" options={{ href: null }} />
        <Tabs.Screen name="StudentTimetable" options={{ href: null }} />
        <Tabs.Screen name="personal-timetable" options={{ href: null }} />
        <Tabs.Screen name="note" options={{ href: null }} />
        <Tabs.Screen name="StudentGroups" options={{ href: null }} />
        <Tabs.Screen name="NewsScreen" options={{ href: null }} />
        <Tabs.Screen name="settings" options={{ href: null }} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  headerGradient: {
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    ...SHADOWS.small,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    paddingTop: Platform.OS === "android" ? 40 : 10,
  },
  schoolInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 15,
  },
  miniLogo: {
    width: 38,
    height: 38,
    marginRight: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 4,
  },
  schoolName: {
    fontSize: 14,
    fontWeight: "900",
    color: "#fff",
  },
  portalTag: {
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: 'rgba(255,255,255,0.8)'
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center'
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 10, 
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  exitBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  btnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff'
  },
  logoutBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
});
