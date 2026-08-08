import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import {
  Image,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SVGIcon from "../../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../../constants/Config";
import { getSchoolLogo } from "../../../constants/Logos";
import { SHADOWS } from "../../../constants/theme";

export default function LoginSelectionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const schoolId = SCHOOL_CONFIG.schoolId;
  const schoolLogo = getSchoolLogo(schoolId);

  const primary = SCHOOL_CONFIG.primaryColor;
  const secondary = SCHOOL_CONFIG.secondaryColor;
  const brandPrimary = SCHOOL_CONFIG.brandPrimary;
  const brandSecondary = SCHOOL_CONFIG.brandSecondary;
  const surface = SCHOOL_CONFIG.surfaceColor;

  const options = [
    {
      title: "Administrator",
      role: "Management",
      route: "/(auth)/login/admin",
      icon: "shield-checkmark",
      color: brandPrimary,
    },
    {
      title: "Staff Member",
      role: "Academics",
      route: "/(auth)/login/teacher",
      icon: "school",
      color: primary,
    },
    {
      title: "Student Portal",
      role: "Learning",
      route: "/(auth)/login/student",
      icon: "person",
      color: secondary === "#000000" ? brandPrimary : secondary,
    },
    {
      title: "Parent Access",
      role: "Guardian",
      route: "/(auth)/login/parent",
      icon: "people",
      color: primary,
    },
  ];

  const navigateToHub = () => {
    router.replace("/");
  };

  return (
    <View style={[styles.container, { backgroundColor: surface }]}>
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <View style={styles.headerWrapper}>
        <LinearGradient
          colors={[brandPrimary, brandSecondary]}
          style={styles.heroGradient}
        >
          <View style={[styles.safeHeader, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity
              onPress={navigateToHub}
              style={[styles.backBtn, { top: insets.top + 10 }]}
              activeOpacity={0.8}
            >
              <SVGIcon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>

            <Animatable.View
              animation={isWeb ? undefined : "fadeInDown"}
              duration={800}
              style={styles.logoCircle}
            >
              <View style={[styles.innerLogo, { backgroundColor: surface }]}>
                <Image
                  source={schoolLogo}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
            </Animatable.View>

            <Animatable.Text
              animation={isWeb ? undefined : "fadeInUp"}
              delay={200}
              style={styles.heroTitle}
            >
              IDENTITY GATEWAY
            </Animatable.Text>

            <Animatable.Text
              animation={isWeb ? undefined : "fadeInUp"}
              delay={300}
              style={styles.heroSubtitle}
            >
              SELECT YOUR PORTAL TO CONTINUE
            </Animatable.Text>
          </View>
        </LinearGradient>
      </View>

      {/* CONTENT */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.mainWrapper}>
          <Animatable.View
            animation={isWeb ? undefined : "fadeInUp"}
            delay={400}
            style={styles.grid}
          >
            {options.map((opt) => (
              <TouchableOpacity
                key={opt.title}
                style={styles.portalCard}
                onPress={() => router.push(opt.route as any)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: opt.color + "15" },
                  ]}
                >
                  <SVGIcon name={opt.icon} size={28} color={opt.color} />
                </View>

                <View style={styles.cardInfo}>
                  <Text style={styles.optTitle}>{opt.title}</Text>
                  <Text style={styles.optRole}>{opt.role}</Text>
                </View>

                <View style={[styles.arrowBox, { backgroundColor: surface }]}>
                  <SVGIcon name="chevron-forward" size={16} color={opt.color} />
                </View>
              </TouchableOpacity>
            ))}
          </Animatable.View>

          <Animatable.View
            animation={isWeb ? undefined : "fadeIn"}
            delay={800}
            style={styles.footer}
          >
            <Text style={styles.guestPrompt}>Visitor or Applicant?</Text>

            <TouchableOpacity
              style={styles.guestButton}
              onPress={() => router.push("/(auth)/login/guest")}
              activeOpacity={0.8}
            >
              <SVGIcon name="help-circle" size={20} color={primary} />
              <Text style={[styles.guestButtonText, { color: primary }]}>
                Explore as Guest
              </Text>
            </TouchableOpacity>

            <View style={styles.brandFooter}>
              <Text style={styles.footerBrandText}>EDUEAZ CORE</Text>
            </View>
          </Animatable.View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: "100%",
  },

  headerWrapper: {
    overflow: "hidden",
    minHeight: 280,
  },

  heroGradient: {
    flex: 1,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },

  safeHeader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 20,
  },

  backBtn: {
    position: "absolute",
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },

  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.2)",
    padding: 8,
    marginBottom: 20,
    ...SHADOWS.medium,
  },

  innerLogo: {
    width: "100%",
    height: "100%",
    borderRadius: 42,
    padding: 15,
    justifyContent: "center",
    alignItems: "center",
  },

  logo: {
    width: "100%",
    height: "100%",
  },

  heroTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 2,
    textTransform: "uppercase",
  },

  heroSubtitle: {
    fontSize: 10,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "700",
    marginTop: 8,
    letterSpacing: 1.5,
    textAlign: "center",
  },

  scrollContent: {
    flexGrow: 1,
  },

  mainWrapper: {
    paddingHorizontal: 25,
    paddingTop: 30,
  },

  grid: {
    rowGap: 16,
  },

  portalCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 24,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#f1f5f9",
    ...SHADOWS.small,
  },

  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },

  cardInfo: {
    flex: 1,
    marginLeft: 16,
  },

  optTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1e293b",
  },

  optRole: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
    fontWeight: "600",
  },

  arrowBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },

  footer: {
    marginTop: 40,
    alignItems: "center",
    rowGap: 15,
  },

  guestPrompt: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "700",
  },

  guestButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingVertical: 14,
    paddingHorizontal: 25,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#f1f5f9",
    columnGap: 10,
    ...SHADOWS.small,
  },

  guestButtonText: {
    fontSize: 15,
    fontWeight: "800",
  },

  brandFooter: {
    marginTop: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
  },

  footerBrandText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#94a3b8",
    letterSpacing: 2,
  },
});
