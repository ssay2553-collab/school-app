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
import { SafeAreaView } from "react-native-safe-area-context";
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
    <View style={styles.container}>
      <LinearGradient colors={[primary, secondary]} style={styles.headerGradient}>
        <SafeAreaView edges={['top', 'left', 'right']}>
          <View style={styles.header}>
            <View style={styles.schoolInfo}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.schoolName, { color: headerText }]} numberOfLines={1}>{SCHOOL_CONFIG.fullName}</Text>
                <Text style={[styles.adminTag, { color: portalTagColor }]}>{appUser.adminRole}</Text>
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

      <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
        <Slot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGradient: {
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    ...SHADOWS.small,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  schoolInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 15 },
  schoolName: { fontSize: 14, fontWeight: '900' },
  adminTag: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  headerActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  actionBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(255,255,255,0.15)', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 10, 
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  exitBtn: { backgroundColor: 'rgba(255,255,255,0.25)', borderColor: 'rgba(255,255,255,0.3)' },
  btnText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  logoutBtn: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 15, fontSize: 14, fontWeight: '500' }
});
