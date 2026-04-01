import { LinearGradient } from "expo-linear-gradient";
import { Tabs, useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import React from "react";
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { auth } from "../../firebaseConfig";

export default function TeacherDashboardLayout() {
  const router = useRouter();
  const { appUser } = useAuth();
  const insets = useSafeAreaInsets();

  const primary = SCHOOL_CONFIG.primaryColor || COLORS.primary;
  const secondary = SCHOOL_CONFIG.secondaryColor || primary;

  const isWeb = Platform.OS === "web";

  const handleLogout = () => {
    const performLogout = async () => {
      try {
        await signOut(auth);

        if (isWeb) {
          localStorage.clear();
          sessionStorage.clear();
        }

        router.replace("/");
      } catch (err) {
        if (isWeb) {
          alert("Failed to sign out. Please try again.");
        } else {
          Alert.alert("Error", "Failed to sign out. Please try again.");
        }
      }
    };

    if (isWeb) {
      if (window.confirm("Are you sure you want to log out?")) {
        performLogout();
      }
    } else {
      Alert.alert("Logout", "Are you sure you want to log out?", [
        { text: "Cancel", style: "cancel" },
        { text: "Log Out", style: "destructive", onPress: performLogout },
      ]);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/teacher-dashboard");
    }
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <LinearGradient
        colors={[primary, secondary]}
        style={[styles.headerGradient, { paddingTop: insets.top + 10 }]}
      >
        <View style={styles.header}>
          <View style={styles.schoolInfo}>
            <View style={{ flex: 1 }}>
              <Text style={styles.schoolName} numberOfLines={1}>
                {SCHOOL_CONFIG.fullName}
              </Text>
              <Text style={styles.portalTag}>
                {appUser?.profile?.firstName || "Instructor"} Portal
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            {isWeb && (
              <TouchableOpacity onPress={handleBack} style={styles.actionBtn}>
                <SVGIcon name="arrow-back" size={18} color="#fff" />
                <Text style={styles.btnText}>BACK</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={handleLogout}
              style={[styles.actionBtn, styles.exitBtn]}
            >
              <SVGIcon name="log-out-outline" size={18} color="#fff" />
              <Text style={styles.btnText}>{isWeb ? "EXIT" : "LOGOUT"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* CONTENT */}
      <View style={styles.content}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: { display: "none" },
          }}
        >
          <Tabs.Screen name="index" options={{ title: "Home" }} />
          <Tabs.Screen name="teacher-timetable" options={{ href: null }} />
          <Tabs.Screen name="settings" options={{ href: null }} />
          <Tabs.Screen
            name="student-academic-records"
            options={{ href: null }}
          />
        </Tabs>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    minHeight: "100%", // ✅ FIXED (removed 100vh)
    backgroundColor: "#F8FAFC",
  },

  headerGradient: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    ...SHADOWS.medium,
    zIndex: 10,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 15,
  },

  schoolInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },

  schoolName: {
    fontSize: 13,
    fontWeight: "900",
    color: "#fff",
  },

  portalTag: {
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "rgba(255,255,255,0.8)",
  },

  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8, // ✅ safer than gap
  },

  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    columnGap: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },

  exitBtn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderColor: "rgba(255,255,255,0.25)",
  },

  btnText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#fff",
  },

  content: {
    flex: 1,
    overflow: "hidden", // ✅ prevents Safari scroll glitches
  },
});
