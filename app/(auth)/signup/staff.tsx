import Constants from "expo-constants";
import { useRouter } from "expo-router";
import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../../constants/theme";

export default function StaffSignup() {
  const router = useRouter();
  const schoolId = Constants.expoConfig?.extra?.schoolId || "afahjoy";
  const isBeano = schoolId === "beano";

  return (
    <SafeAreaView
      style={[styles.safeArea, isBeano && { backgroundColor: "#FDF7FF" }]}
    >
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Animatable.View
            animation="fadeInDown"
            duration={800}
            style={styles.header}
          >
            <TouchableOpacity
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace("/(auth)/login/staff");
              }}
              style={styles.backBtn}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <SVGIcon
                name="arrow-back"
                size={24}
                color={isBeano ? COLORS.primary : "#0F172A"}
              />
            </TouchableOpacity>
            <View
              style={[
                styles.iconBadge,
                {
                  backgroundColor: COLORS.primary + "15",
                },
              ]}
            >
              <SVGIcon name="briefcase" size={32} color={COLORS.primary} />
            </View>
            <Text style={[styles.title, isBeano && { color: COLORS.primary }]}>
              Staff Access
            </Text>
            <Text style={styles.subtitle}>
              Standardized Authentication Transition
            </Text>
          </Animatable.View>

          <Animatable.View
            animation="fadeInUp"
            duration={800}
            style={styles.card}
          >
            <View style={styles.infoBanner}>
              <SVGIcon
                name="shield-checkmark"
                size={24}
                color={COLORS.primary}
              />
              <Text style={styles.infoBannerText}>
                The PIN-based registration system has been retired in favor of
                secure Email/Password authentication.
              </Text>
            </View>

            <View style={styles.instructionBox}>
              <Text style={styles.instructionTitle}>How to get access:</Text>
              <Text style={styles.instructionText}>
                1. Contact your school administrator.{"\n"}
                2. Provide your official email address.{"\n"}
                3. The administrator will provision your account and provide
                your login credentials.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: COLORS.primary }]}
              onPress={() => router.replace("/(auth)/login/staff")}
            >
              <Text style={styles.buttonText}>Go to Staff Login</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                {
                  backgroundColor: "#fff",
                  borderWidth: 1,
                  borderColor: "#E2E8F0",
                  marginTop: 12,
                },
              ]}
              onPress={() => router.replace("/(auth)/login")}
            >
              <Text style={[styles.buttonText, { color: "#64748B" }]}>
                Other Portals
              </Text>
            </TouchableOpacity>
          </Animatable.View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  container: { flex: 1 },
  scrollContent: { padding: 24 },
  header: { marginBottom: 30, marginTop: 10, alignItems: "center" },
  backBtn: { alignSelf: "flex-start", marginBottom: 10 },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: { fontSize: 28, fontWeight: "bold", color: "#0F172A" },
  subtitle: {
    fontSize: 16,
    color: "#64748B",
    marginTop: 4,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: COLORS.primary + "10",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 10,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: "#475569",
    lineHeight: 20,
  },
  instructionBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  instructionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 22,
  },
  button: {
    padding: 18,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    ...SHADOWS.medium,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
