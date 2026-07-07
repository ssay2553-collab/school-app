import { useRouter } from "expo-router";
import { signInAnonymously } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../../constants/Config";
import { SHADOWS } from "../../../constants/theme";
import { useToast } from "../../../contexts/ToastContext";
import { auth, db } from "../../../firebaseConfig";

export default function GuestSignup() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const primary = SCHOOL_CONFIG.primaryColor;
  const surface = SCHOOL_CONFIG.surfaceColor;

  const handleGuestSignup = async () => {
    if (!fullName.trim() || !phone.trim()) {
      showToast({
        message: "Please enter your name and phone number.",
        type: "error",
      });
      return;
    }

    setLoading(true);
    try {
      // 1. Sign in anonymously
      const userCredential = await signInAnonymously(auth);
      const uid = userCredential.user.uid;

      // 2. Create guest profile in Firestore
      await setDoc(doc(db, "users", uid), {
        uid,
        fullName: fullName.trim(),
        displayName: fullName.trim(),
        phone: phone.trim(),
        role: "guest",
        isGuest: true,
        createdAt: serverTimestamp(),
        schoolId: SCHOOL_CONFIG.schoolId || "default",
      });

      showToast({
        message: "Welcome! You are now signed in as a guest.",
        type: "success",
      });

      router.replace("/guest-dashboard");
    } catch (err: any) {
      console.error("Guest Signup Error:", err);
      showToast({
        message: err.message || "Could not complete registration.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: surface }]}>
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
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace("/(auth)/login/guest");
                }
              }}
              style={styles.backBtn}
            >
              <SVGIcon name="arrow-back" size={24} color="#0F172A" />
            </TouchableOpacity>

            <View style={[styles.iconBadge, { backgroundColor: primary + "15" }]}>
              <SVGIcon name="person-add" size={32} color={primary} />
            </View>

            <Text style={styles.title}>Guest Registration</Text>
            <Text style={styles.subtitle}>
              Register to explore {SCHOOL_CONFIG.name}
            </Text>
          </Animatable.View>

          <Animatable.View
            animation="fadeInUp"
            duration={800}
            style={styles.card}
          >
            <View style={styles.infoBanner}>
              <SVGIcon name="information-circle" size={20} color={primary} />
              <Text style={styles.infoBannerText}>
                Provide your details to get temporary access to our campus information and admission resources.
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>FULL NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. John Doe"
                placeholderTextColor="#94A3B8"
                value={fullName}
                onChangeText={setFullName}
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>PHONE NUMBER</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 08012345678"
                placeholderTextColor="#94A3B8"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                editable={!loading}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: primary },
                loading && { opacity: 0.7 },
              ]}
              onPress={handleGuestSignup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.buttonText}>Start Exploring</Text>
                  <View style={{ marginLeft: 8 }}>
                    <SVGIcon name="rocket" size={18} color="#fff" />
                  </View>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              onPress={() => router.push("/(auth)/login/guest")}
              style={styles.loginLinkBtn}
            >
              <Text style={styles.signupText}>
                Already registered?{" "}
                <Text style={[styles.signupLink, { color: primary }]}>
                  Guest Login
                </Text>
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
  safeArea: { flex: 1 },
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
    backgroundColor: "#F1F5F9",
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
  inputGroup: { marginBottom: 20 },
  label: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
    marginBottom: 8,
    letterSpacing: 1,
  },
  input: {
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    color: "#1E293B",
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
  divider: { height: 1, backgroundColor: "#F1F5F9", marginVertical: 25 },
  loginLinkBtn: { alignItems: "center" },
  signupText: { color: "#64748B", fontSize: 14 },
  signupLink: { fontWeight: "bold" },
});
