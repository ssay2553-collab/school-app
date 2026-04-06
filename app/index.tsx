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

  const {
    schoolId,
    primaryColor,
    secondaryColor,
    surfaceColor,
    fullName,
    motto,
  } = config;

  const finalPrimary = primaryColor || COLORS.primary || "#2e86de";
  const finalSecondary = secondaryColor || finalPrimary;
  const finalSurface = surfaceColor || "#FFFFFF";

  const logo = getSchoolLogo(schoolId);
  const isWeb = Platform.OS === "web";

  const handleGetStarted = () => {
    if (appUser) {
      switch (appUser.role) {
        case "admin":
          return router.replace("/admin-dashboard");
        case "teacher":
          return router.replace("/teacher-dashboard");
        case "student":
          return router.replace("/student-dashboard");
        case "parent":
          return router.replace("/parent-dashboard");
        case "guest":
          return router.replace("/guest-dashboard");
        default:
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

      {/* Dynamic Brand Background */}
      <LinearGradient
        colors={[finalPrimary, finalSecondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Decorative Elements */}
      <View
        style={[
          styles.circleDecorator,
          { top: -100, right: -100, backgroundColor: "rgba(255,255,255,0.1)" },
        ]}
      />
      <View
        style={[
          styles.circleDecorator,
          { bottom: -150, left: -150, backgroundColor: "rgba(0,0,0,0.05)" },
        ]}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom + 20,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerSpacer} />

        <View style={styles.mainContent}>
          <Animatable.View
            animation={isWeb ? undefined : "zoomIn"}
            duration={1200}
            style={styles.logoContainer}
          >
            <View style={styles.glassLogo}>
              <View style={[styles.innerLogo, { backgroundColor: "#FFFFFF" }]}>
                <Image
                  source={logo}
                  style={styles.logo as any}
                  resizeMode="contain"
                />
              </View>
            </View>
          </Animatable.View>

          <View style={styles.textSection}>
            <Animatable.View
              animation={isWeb ? undefined : "fadeInDown"}
              delay={200}
              style={styles.badge}
            >
              <Text style={styles.badgeText}>OFFICIAL PORTAL</Text>
            </Animatable.View>

            <Animatable.Text
              animation={isWeb ? undefined : "fadeInUp"}
              delay={400}
              style={styles.schoolName}
            >
              {fullName}
            </Animatable.Text>

            <Animatable.View
              animation={isWeb ? undefined : "fadeInUp"}
              delay={600}
              style={styles.platformBadge}
            >
              <Text style={styles.platformText}>
                Multi-function Academic Management Platform
              </Text>
            </Animatable.View>

            <Animatable.View
              animation={isWeb ? undefined : "fadeInUp"}
              delay={800}
              style={styles.mottoContainer}
            >
              <View style={styles.mottoLine} />
              <Text style={styles.mottoText}>{motto?.toUpperCase()}</Text>
              <View style={styles.mottoLine} />
            </Animatable.View>
          </View>

          <Animatable.View
            animation={isWeb ? undefined : "fadeInUp"}
            delay={1000}
            style={styles.buttonWrapper}
          >
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: finalSurface }]}
              onPress={handleGetStarted}
              activeOpacity={0.8}
            >
              <View style={styles.btnContent}>
                <Text style={[styles.primaryBtnText, { color: finalPrimary }]}>
                  ENTER CAMPUS
                </Text>
                <LinearGradient
                  colors={[finalPrimary, finalSecondary]}
                  style={styles.iconCircle}
                >
                  <SVGIcon name="arrow-forward" size={18} color="#fff" />
                </LinearGradient>
              </View>
            </TouchableOpacity>

            <Text style={styles.secureText}>
              <SVGIcon
                name="lock-closed"
                size={10}
                color="rgba(255,255,255,0.6)"
              />{" "}
              SECURE CLOUD ACCESS
            </Text>
          </Animatable.View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            POWERED BY <Text style={styles.footerBrand}>EduEaz</Text>
          </Text>
          <View style={styles.versionBadge}>
            <Text style={styles.versionText}>v1.2.0 • PRO</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  circleDecorator: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "space-between",
  },
  headerSpacer: {
    height: 40,
  },
  mainContent: {
    alignItems: "center",
    paddingHorizontal: 30,
  },
  logoContainer: {
    marginBottom: 40,
    // Avoid strict style typing issues by only adding web-specific props at runtime
    // (StyleSheet typings can reject web-only keys like `cursor`).
    ...(Platform.OS === "web" ? ({ cursor: "default" } as any) : {}),
  },
  glassLogo: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  innerLogo: {
    width: "100%",
    height: "100%",
    borderRadius: 75,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.large,
  },
  logo: { width: "75%", height: "75%" },

  textSection: { alignItems: "center", marginBottom: 50 },
  badge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 15,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#fff",
    letterSpacing: 1.5,
  },
  schoolName: {
    fontSize: 28,
    fontWeight: "900",
    color: "#fff",
    textAlign: "center",
    letterSpacing: 0.5,
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  platformBadge: {
    marginTop: 15,
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  platformText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "600",
    textAlign: "center",
  },
  mottoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
  },
  mottoLine: {
    width: 20,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.3)",
    marginHorizontal: 10,
  },
  mottoText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "700",
    letterSpacing: 1,
  },

  buttonWrapper: {
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
  },
  primaryBtn: {
    width: "100%",
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    ...SHADOWS.medium,
  },
  btnContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 25,
    alignItems: "center",
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.small,
  },
  secureText: {
    marginTop: 15,
    fontSize: 10,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "600",
    letterSpacing: 1,
  },

  footer: {
    alignItems: "center",
    paddingBottom: 20,
  },
  footerText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
  },
  footerBrand: {
    color: "#fff",
    fontWeight: "800",
  },
  versionBadge: {
    marginTop: 5,
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  versionText: {
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(255,255,255,0.5)",
  },
});
