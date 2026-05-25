import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import {
    ActivityIndicator,
    Image,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from "react-native";
import * as Animatable from "react-native-animatable";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import SVGIcon from "../components/SVGIcon";
import { useSchoolConfig } from "../constants/Config";
import { getSchoolLogo } from "../constants/Logos";
import { COLORS, SHADOWS } from "../constants/theme";
import { useAuth } from "../contexts/AuthContext";

export default function WelcomeScreen() {
  const router = useRouter();
  const { appUser, loading } = useAuth();
  const config = useSchoolConfig();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const isSmallScreen = windowWidth < 380;
  const isWeb = Platform.OS === "web";

  const {
    schoolId,
    primaryColor,
    secondaryColor,
    surfaceColor,
    fullName,
    motto,
  } = config;

  const finalPrimary = primaryColor || COLORS.primary || "#6366F1";
  const finalSecondary = secondaryColor || "#4338ca";
  const finalSurface = surfaceColor || "#FFFFFF";

  const logo = getSchoolLogo(schoolId);

  const handleGetStarted = () => {
    if (appUser) {
      const role = (appUser.role || "").toLowerCase();
      const adminRole = (appUser.adminRole || "").toLowerCase();

      const isAdmin = role.includes("admin") || adminRole !== "";
      const isTeacher =
        role === "teacher" ||
        role === "staff" ||
        !!(
          appUser.classes?.length ||
          appUser.subjects?.length ||
          appUser.classTeacherOf
        );
      const isParent = role === "parent";
      const isStudent = role === "student";
      const isGuest = role === "guest";

      if (isAdmin) {
        return router.replace("/admin-dashboard");
      } else if (isTeacher) {
        return router.replace("/teacher-dashboard");
      } else if (isStudent) {
        return router.replace("/student-dashboard");
      } else if (isParent) {
        return router.replace("/parent-dashboard");
      } else if (isGuest) {
        return router.replace("/guest-dashboard");
      } else {
        return router.replace("/(auth)/login");
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
    <View style={[styles.container, { backgroundColor: finalSurface }]}>
      <StatusBar style="light" />

      {/* Elegant Mesh Background */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: finalPrimary }]}>
        <LinearGradient
            colors={[finalPrimary, finalSecondary]}
            style={StyleSheet.absoluteFill}
        />

        {/* Animated Background Blobs */}
        <Animatable.View
            animation="pulse"
            iterationCount="infinite"
            duration={8000}
            style={[styles.blob, {
                top: -windowHeight * 0.1,
                right: -windowWidth * 0.2,
                width: windowWidth * 0.8,
                height: windowWidth * 0.8,
                backgroundColor: 'rgba(255,255,255,0.1)'
            }]}
        />
        <Animatable.View
            animation="pulse"
            iterationCount="infinite"
            duration={10000}
            delay={1000}
            style={[styles.blob, {
                bottom: -windowHeight * 0.15,
                left: -windowWidth * 0.3,
                width: windowWidth * 1.2,
                height: windowWidth * 1.2,
                backgroundColor: 'rgba(255,255,255,0.05)'
            }]}
        />
        <View style={[styles.blob, {
            top: windowHeight * 0.3,
            left: -windowWidth * 0.1,
            width: 100,
            height: 100,
            backgroundColor: 'rgba(255,255,255,0.08)'
        }]} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 40,
            paddingBottom: insets.bottom + 40,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mainContent}>
          {/* Logo Section with Glow */}
          <Animatable.View
            animation="zoomIn"
            duration={1500}
            style={styles.logoWrapper}
          >
            <View style={styles.logoGlow} />
            <View style={styles.logoCircle}>
                <Image
                  source={logo}
                  style={styles.logo as any}
                  resizeMode="contain"
                />
            </View>
          </Animatable.View>

          {/* Text Section */}
          <View style={styles.contentCard}>
            <Animatable.View animation="fadeInDown" delay={500} style={styles.portalBadge}>
                <Text style={styles.portalBadgeText}>PREMIUM CAMPUS ACCESS</Text>
            </Animatable.View>

            <Animatable.Text
              animation="fadeInUp"
              delay={700}
              style={[styles.title, { fontSize: isSmallScreen ? 24 : 32 }]}
            >
              {fullName}
            </Animatable.Text>

            <Animatable.View animation="fadeInUp" delay={900} style={styles.mottoBox}>
                <View style={styles.line} />
                <Text style={styles.mottoText}>{motto || "Nurturing Excellence"}</Text>
                <View style={styles.line} />
            </Animatable.View>

            <Animatable.Text animation="fadeInUp" delay={1100} style={styles.description}>
                Multi-Functional Academic Management Platform
            </Animatable.Text>
          </View>

          {/* Action Section */}
          <Animatable.View
            animation="fadeInUp"
            delay={1300}
            style={styles.actionContainer}
          >
            <TouchableOpacity
              style={[styles.mainButton, { backgroundColor: '#FFFFFF' }]}
              onPress={handleGetStarted}
              activeOpacity={0.9}
            >
              <Text style={[styles.buttonText, { color: finalPrimary }]}>
                ENTER PORTAL
              </Text>
              <View style={[styles.buttonIcon, { backgroundColor: finalPrimary }]}>
                <SVGIcon name="chevron-forward" size={18} color="#fff" />
              </View>
            </TouchableOpacity>

            <View style={styles.securityInfo}>
                <SVGIcon name="shield-checkmark" size={14} color="rgba(255,255,255,0.6)" />
                <Text style={styles.securityText}>AES-256 ENCRYPTED CLOUD STORAGE</Text>
            </View>
          </Animatable.View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
            <Text style={styles.poweredBy}>
                Powered by <Text style={styles.brandName}>EduEaz</Text>
            </Text>
            <View style={styles.vBadge}>
                <Text style={styles.vText}>ENTERPRISE EDITION v1.2</Text>
            </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  blob: {
    position: 'absolute',
    borderRadius: 1000,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 30,
    justifyContent: 'space-between',
  },
  mainContent: {
    alignItems: 'center',
    width: '100%',
  },
  logoWrapper: {
    marginBottom: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.3)',
    ...SHADOWS.large,
  },
  logoCircle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 5,
    ...SHADOWS.medium,
  },
  logo: { width: '100%', height: '100%' },
  contentCard: {
    alignItems: 'center',
    width: '100%',
    marginBottom: 60,
  },
  portalBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginBottom: 20,
  },
  portalBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  title: {
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 15,
    letterSpacing: -0.5,
  },
  mottoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  line: {
    width: 30,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 12,
  },
  mottoText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '700',
    fontStyle: 'italic',
  },
  description: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 280,
    fontWeight: '500',
  },
  actionContainer: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  mainButton: {
    width: '100%',
    height: 64,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 25,
    paddingRight: 8,
    ...SHADOWS.large,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  buttonIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 8,
  },
  securityText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  footer: {
    alignItems: 'center',
    marginTop: 40,
  },
  poweredBy: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
  },
  brandName: {
    color: '#fff',
    fontWeight: '900',
  },
  vBadge: {
    marginTop: 8,
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  vText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
