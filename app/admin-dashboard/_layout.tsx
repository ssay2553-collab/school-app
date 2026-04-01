import { Slot, useRouter } from "expo-router";
import { useEffect } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  Platform
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../contexts/AuthContext";
import { auth } from "../../firebaseConfig";
import { signOut } from "firebase/auth";
import { SHADOWS, COLORS } from "../../constants/theme";
import { SCHOOL_CONFIG } from "../../constants/Config";
import SVGIcon from "../../components/SVGIcon";

export default function DashboardLayout() {
  const { appUser, loading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const primary = SCHOOL_CONFIG.primaryColor || COLORS.primary || "#2e86de";
  const secondary = SCHOOL_CONFIG.secondaryColor || primary;
  const headerText = '#fff';
  const portalTagColor = 'rgba(255,255,255,0.8)';

  const isSyncing = loading || (!!auth.currentUser && !appUser);

  useEffect(() => {
    if (isSyncing) return;
    if (!appUser) {
      router.replace("/");
      return;
    }
    const isAuthorized = appUser.role === "admin" && !!appUser.adminRole;
    if (!isAuthorized) {
      router.replace("/");
    }
  }, [appUser, isSyncing, router]);

  const performLogout = async () => {
    try {
      await signOut(auth);
      if (Platform.OS === 'web') {
        localStorage.clear();
        sessionStorage.clear();
      }
      router.replace("/");
    } catch (error) {
      console.error("Logout error:", error);
      if (Platform.OS !== 'web') Alert.alert("Error", "Failed to log out.");
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm("Are you sure you want to log out of the admin portal?")) {
        performLogout();
      }
    } else {
      Alert.alert("Logout", "Are you sure you want to log out of the admin portal?", [
        { text: "Cancel", style: "cancel" },
        { text: "Log Out", style: "destructive", onPress: performLogout }
      ]);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/admin-dashboard");
    }
  };

  if (isSyncing) {
    return (
      <View style={[styles.centered, { backgroundColor: primary }]}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={[styles.loadingText, { color: '#fff' }]}>Synchronizing Admin Portal...</Text>
      </View>
    );
  }

  if (!appUser || appUser.role !== "admin" || !appUser.adminRole) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: '#F8FAFC' }]}>
      {/* 
          On Web/PWA, we want a sticky header that respects the top safe area 
          (notch) but doesn't feel disconnected.
      */}
      <LinearGradient 
        colors={[primary, secondary]} 
        style={[
          styles.headerGradient, 
          { paddingTop: insets.top > 0 ? insets.top : 10 }
        ]}
      >
        <View style={styles.header}>
          <View style={styles.schoolInfo}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.schoolName, { color: headerText }]} numberOfLines={1}>
                {SCHOOL_CONFIG.fullName}
              </Text>
              <Text style={[styles.adminTag, { color: portalTagColor }]}>
                {appUser.adminRole} Portal
              </Text>
            </View>
          </View>
          
          <View style={styles.headerActions}>
             {Platform.OS === 'web' && (
               <TouchableOpacity onPress={handleBack} style={styles.actionBtn}>
                 <SVGIcon name="arrow-back" size={18} color="#fff" />
                 <Text style={styles.btnText}>BACK</Text>
               </TouchableOpacity>
             )}
             <TouchableOpacity onPress={handleLogout} style={[styles.actionBtn, styles.exitBtn]}>
               <SVGIcon name="log-out-outline" size={18} color="#fff" />
               <Text style={styles.btnText}>{Platform.OS === 'web' ? 'EXIT' : 'LOGOUT'}</Text>
             </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* 
          Main content area. 
          We use a flex: 1 View to ensure it takes up the remaining space.
          The children (screens) are responsible for their own safe area padding at the bottom.
      */}
      <View style={styles.content}>
        <Slot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    // Fix for Safari height issues
    height: Platform.OS === 'web' ? '100vh' : '100%',
  },
  headerGradient: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    ...SHADOWS.medium,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  schoolInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  schoolName: { fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  adminTag: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  headerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  actionBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(255,255,255,0.12)', 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: 8, 
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)'
  },
  exitBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.25)' },
  btnText: { fontSize: 10, fontWeight: '900', color: '#fff' },
  content: { 
    flex: 1,
  },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 15, fontSize: 14, fontWeight: '500' }
});
