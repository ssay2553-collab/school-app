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

      <LinearGradient
        colors={[finalPrimary, finalSecondary]}
        style={StyleSheet.absoluteFill}
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
        <View style={styles.mainContent}>
          <Animatable.View
            animation={isWeb ? undefined : "zoomIn"}
            duration={1000}
            style={styles.logoContainer}
          >
            <View style={styles.glassLogo}>
              <View
                style={[styles.innerLogo, { backgroundColor: finalSurface }]}
              >
                <Image source={logo} style={styles.logo} resizeMode="contain" />
              </View>
            </View>
          </Animatable.View>

          <View style={styles.textSection}>
            <Animatable.Text
              animation={isWeb ? undefined : "fadeInUp"}
              delay={300}
              style={styles.welcomeText}
            >
              WELCOME TO
            </Animatable.Text>

            <Animatable.Text
              animation={isWeb ? undefined : "fadeInUp"}
              delay={500}
              style={styles.schoolName}
            >
              {fullName}
            </Animatable.Text>

            <View style={styles.mottoContainer}>
              <View style={styles.dot} />
              <Text style={styles.mottoText}>{motto}</Text>
              <View style={styles.dot} />
            </View>
          </View>

          <View style={styles.buttonWrapper}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleGetStarted}
              activeOpacity={0.9}
            >
              <View style={styles.btnContent}>
                <Text style={[styles.primaryBtnText, { color: finalPrimary }]}>
                  ENTER CAMPUS
                </Text>
                <View
                  style={[styles.iconCircle, { backgroundColor: finalPrimary }]}
                >
                  <SVGIcon name="chevron-forward" size={18} color="#fff" />
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Powered by <Text style={styles.footerBrand}>EduEaz</Text>
          </Text>
          <Text style={styles.versionText}>v1.2.0</Text>
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: "space-between",
  },
  mainContent: {
    alignItems: "center",
    paddingHorizontal: 30,
  },
  logoContainer: { marginBottom: 30 },
  glassLogo: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    padding: 10,
  },
  innerLogo: {
    width: "100%",
    height: "100%",
    borderRadius: 70,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.medium,
  },
  logo: { width: "80%", height: "80%" },

  textSection: { alignItems: "center", marginBottom: 40 },
  welcomeText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    letterSpacing: 3,
  },
  schoolName: {
    fontSize: 24,
    fontWeight: "900",
    color: "#fff",
    textAlign: "center",
    marginTop: 10,
  },
  mottoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#fff",
    marginHorizontal: 5,
  },
  mottoText: {
    fontSize: 12,
    color: "#fff",
  },

  buttonWrapper: {
    width: "100%",
    maxWidth: 320,
  },
  primaryBtn: {
    height: 55,
    borderRadius: 30,
    backgroundColor: "#fff",
    justifyContent: "center",
  },
  btnContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    alignItems: "center",
  },
  primaryBtnText: {
    fontWeight: "800",
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },

  footer: {
    alignItems: "center",
    marginBottom: 10,
  },
  footerText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
  },
  footerBrand: {
    color: "#fff",
    fontWeight: "bold",
  },
  versionText: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
  },
});
