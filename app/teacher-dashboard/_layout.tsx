import { Tabs, useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import React from "react";
import {
    Alert,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { auth } from "../../firebaseConfig";
import SVGIcon from "../../components/SVGIcon";

export default function TeacherDashboardLayout() {
  const router = useRouter();
  const { appUser } = useAuth();
  const primary = SCHOOL_CONFIG.primaryColor || COLORS.primary;
  const secondary = SCHOOL_CONFIG.secondaryColor;

  const handleLogout = () => {
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

    if (Platform.OS === 'web') {
      if (window.confirm("Are you sure you want to log out of the teacher portal?")) {
        performLogout();
      }
    } else {
      Alert.alert(
        "Logout",
        "Are you sure you want to log out of the teacher portal?",
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
      router.replace("/teacher-dashboard");
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={[primary, secondary]} style={styles.headerGradient}>
        <SafeAreaView>
          <View style={styles.header}>
            <View style={styles.schoolInfo}>
              <View style={{ flex: 1 }}>
                <Text style={styles.schoolName} numberOfLines={1}>
                  {SCHOOL_CONFIG.fullName}
                </Text>
                <Text style={styles.portalTag}>{appUser?.profile?.firstName || 'Instructor'} Portal</Text>
              </View>
            </View>
            
            <View style={styles.headerActions}>
               {Platform.OS === 'web' && (
                 <>
                   <TouchableOpacity onPress={handleBack} style={styles.actionBtn}>
                     <SVGIcon name="arrow-back" size={20} color="#fff" />
                     <Text style={styles.btnText}>BACK</Text>
                   </TouchableOpacity>
                   <TouchableOpacity onPress={handleLogout} style={[styles.actionBtn, styles.exitBtn]}>
                     <SVGIcon name="log-out-outline" size={20} color="#fff" />
                     <Text style={styles.btnText}>EXIT</Text>
                   </TouchableOpacity>
                 </>
               )}
               {Platform.OS !== 'web' && (
                 <TouchableOpacity onPress={handleLogout} style={[styles.actionBtn, styles.exitBtn]}>
                   <SVGIcon name="log-out-outline" size={20} color="#fff" />
                   <Text style={styles.btnText}>LOGOUT</Text>
                 </TouchableOpacity>
               )}
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
        <Tabs.Screen name="teacher-timetable" options={{ href: null }} />
        <Tabs.Screen name="settings" options={{ href: null }} />
        <Tabs.Screen name="student-academic-records" options={{ href: null }} />
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
