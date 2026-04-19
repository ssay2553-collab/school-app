import { Stack, useRouter } from "expo-router";
import React from "react";
import { TouchableOpacity, View, Image, Text, StyleSheet, Alert, Platform } from "react-native";
import { auth } from "../../firebaseConfig";
import { signOut } from "firebase/auth";
import { SHADOWS } from "../../constants/theme";
import { getSchoolLogo } from "../../constants/Logos";
import { SCHOOL_CONFIG } from "../../constants/Config";
import Constants from 'expo-constants';
import SVGIcon from "../../components/SVGIcon";

export default function GuestDashboardLayout() {
  const router = useRouter();
  const schoolId = Constants.expoConfig?.extra?.schoolId || 'school';
  const schoolLogo = getSchoolLogo(schoolId);
  const primary = SCHOOL_CONFIG.primaryColor;

  const performLogout = async () => {
    try {
      await signOut(auth);
      if (Platform.OS === 'web') {
        localStorage.clear();
        sessionStorage.clear();
      }
      router.replace("/");
    } catch {
      if (Platform.OS !== 'web') Alert.alert("Error", "Could not sign out.");
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm("Are you sure you want to exit the guest portal?")) {
        performLogout();
      }
    } else {
      Alert.alert("Sign Out", "Are you sure you want to exit the guest portal?", [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Sign Out", 
          style: "destructive", 
          onPress: performLogout
        }
      ]);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Branded Guest Header */}
      <View style={styles.header}>
        <View style={styles.schoolInfo}>
          <Image source={schoolLogo} style={styles.miniLogo} resizeMode="contain" />
          <View>
            <Text style={styles.schoolName}>{SCHOOL_CONFIG.name}</Text>
            <Text style={[styles.portalTag, { color: primary }]}>Guest Explorer</Text>
          </View>
        </View>
        
        <View style={styles.headerActions}>
           {Platform.OS === 'web' && (
             <>
               <TouchableOpacity onPress={handleBack} style={styles.actionBtn}>
                 <SVGIcon name="arrow-back" size={20} color={primary} />
                 <Text style={[styles.btnText, { color: primary }]}>BACK</Text>
               </TouchableOpacity>
               <TouchableOpacity onPress={handleLogout} style={[styles.actionBtn, styles.exitBtn]}>
                 <SVGIcon name="log-out-outline" size={20} color="#fff" />
                 <Text style={styles.btnText}>EXIT</Text>
               </TouchableOpacity>
             </>
           )}
           {Platform.OS !== 'web' && (
             <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
               <SVGIcon name="log-out" size={24} color={primary} />
             </TouchableOpacity>
           )}
        </View>
      </View>

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#F8FAFC' }
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="chat-with-admin" />
        <Stack.Screen name="FAQ" />
        <Stack.Screen name="gallery" />
        <Stack.Screen name="upgrade-account" />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    ...SHADOWS.small,
    paddingTop: Platform.OS === 'android' ? 40 : 10,
  },
  schoolInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniLogo: {
    width: 36,
    height: 36,
    marginRight: 12,
  },
  schoolName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  portalTag: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center'
  },
  actionBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(0,0,0,0.05)', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 10, 
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)'
  },
  exitBtn: { 
    backgroundColor: '#ef4444', 
    borderColor: '#dc2626' 
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
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  }
});
