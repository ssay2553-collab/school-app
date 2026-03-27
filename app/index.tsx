import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import * as Animatable from "react-native-animatable";

import SVGIcon from "../components/SVGIcon";
import { useSchoolConfig } from "../constants/Config";
import { getSchoolLogo } from "../constants/Logos";
import { SHADOWS, COLORS } from "../constants/theme";
import { useAuth } from "../contexts/AuthContext";

const { width, height } = Dimensions.get("window");

export default function WelcomeScreen() {
  const router = useRouter();
  const { appUser, loading } = useAuth();
  const config = useSchoolConfig();

  // Extract all brand colors
  const {
    schoolId,
    primaryColor,
    secondaryColor,
    surfaceColor,
    fullName,
    motto,
  } = config;

  // Added safety fallbacks to prevent Android native crashes on null/undefined colors
  const finalPrimary = primaryColor || COLORS.primary || "#2e86de";
  const finalSecondary = secondaryColor || finalPrimary;
  const finalSurface = surfaceColor || "#FFFFFF";

  const logo = getSchoolLogo(schoolId);

  const handleGetStarted = () => {
    if (appUser) {
      switch (appUser.role) {
        case "admin": router.replace("/admin-dashboard"); break;
        case "teacher": router.replace("/teacher-dashboard"); break;
        case "student": router.replace("/student-dashboard"); break;
        case "parent": router.replace("/parent-dashboard"); break;
        case "guest": router.replace("/guest-dashboard"); break;
        default: router.replace("/(auth)/login");
      }
    } else {
      router.push("/(auth)/login");
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: finalSurface }]}>
        <ActivityIndicator size="large" color={finalPrimary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <LinearGradient
        colors={[finalPrimary, finalSecondary]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.mainContent}>
          
          <Animatable.View 
            animation="zoomIn" 
            duration={1500} 
            style={styles.logoContainer}
          >
            <View style={[styles.glassLogo, { borderColor: 'rgba(255,255,255,0.3)' }]}>
              <View style={[styles.innerLogo, { backgroundColor: finalSurface }]}>
                <Image source={logo} style={styles.logo} resizeMode="contain" />
              </View>
            </View>
          </Animatable.View>

          <View style={styles.textSection}>
            <Animatable.Text 
              animation="fadeInUp" 
              delay={500} 
              duration={1000} 
              style={[styles.welcomeText, { color: 'rgba(255,255,255,0.8)' }]}
            >
              WELCOME TO
            </Animatable.Text>
            
            <Animatable.Text 
              animation="fadeInUp" 
              delay={700} 
              duration={1000} 
              style={styles.schoolName}
            >
              {fullName}
            </Animatable.Text>

            <Animatable.View 
              animation="fadeIn" 
              delay={1200} 
              style={styles.mottoContainer}
            >
              <View style={[styles.dot, { backgroundColor: 'rgba(255,255,255,0.6)' }]} />
              <Text style={styles.mottoText}>{motto}</Text>
              <View style={[styles.dot, { backgroundColor: 'rgba(255,255,255,0.6)' }]} />
            </Animatable.View>
          </View>

          <Animatable.View 
            animation="zoomIn" 
            delay={1500} 
            duration={800} 
            style={styles.buttonWrapper}
          >
            <TouchableOpacity 
              style={styles.primaryBtn}
              onPress={(e) => {
                if (Platform.OS === 'web') {
                  (e as any).currentTarget?.blur?.();
                }
                handleGetStarted();
              }}
              activeOpacity={0.9}
            >
              <View style={styles.btnContent}>
                <Text style={[styles.primaryBtnText, { color: finalPrimary }]}>ENTER CAMPUS</Text>
                <View style={[styles.iconCircle, { backgroundColor: finalPrimary }]}>
                   <SVGIcon name="chevron-forward" size={18} color="#fff" />
                </View>
              </View>
            </TouchableOpacity>
          </Animatable.View>

        </View>

        <Animatable.View 
          animation="fadeIn" 
          delay={2000} 
          style={styles.footer}
        >
          <Text style={styles.footerText}>
            Powered by <Text style={styles.footerBrand}>EduEaz</Text>
          </Text>
          <Text style={styles.versionText}>v1.2.0</Text>
        </Animatable.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  safeArea: { flex: 1 },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  logoContainer: { marginBottom: 40 },
  glassLogo: {
    width: Platform.OS === 'web' ? 220 : 160,
    height: Platform.OS === 'web' ? 220 : 160,
    borderRadius: Platform.OS === 'web' ? 110 : 80,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    padding: 10,
  },
  innerLogo: {
    width: '100%',
    height: '100%',
    borderRadius: Platform.OS === 'web' ? 100 : 70,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  logo: { width: '85%', height: '85%' },
  textSection: { alignItems: 'center', marginBottom: 60 },
  welcomeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 4,
    marginBottom: 8,
  },
  schoolName: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 36,
    textTransform: 'uppercase',
    letterSpacing: 1,
    ...(Platform.OS === 'web' 
      ? { textShadow: '0 5px 15px rgba(0,0,0,0.2)' }
      : {
          textShadowColor: 'rgba(0,0,0,0.2)',
          textShadowOffset: { width: 0, height: 5 },
          textShadowRadius: 10,
        }
    ),
  },
  mottoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    gap: 10,
  },
  dot: { width: 4, height: 4, borderRadius: 2 },
  mottoText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  buttonWrapper: { width: '100%', maxWidth: 350 },
  primaryBtn: {
    width: '100%',
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    ...SHADOWS.large,
  },
  btnContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 25,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: { paddingBottom: 30, alignItems: 'center' },
  footerText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    letterSpacing: 1,
  },
  footerBrand: { color: '#fff', fontWeight: '900' },
  versionText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 4,
    fontWeight: '700',
  },
});
