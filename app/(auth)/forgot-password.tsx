import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { sendPasswordResetEmail } from "firebase/auth";
import { collection, getDocs, limit, or, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
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
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useToast } from "../../contexts/ToastContext";
import { auth, db, functions } from "../../firebaseConfig";
import { getParentFinalEmail, getStudentFinalEmail } from "../../utils/authUnify";

type ResetMode = "email" | "token";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { showToast } = useToast();

  const [mode, setMode] = useState<ResetMode>("email");

  // Form State
  const [emailInput, setEmailInput] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const primary = SCHOOL_CONFIG.primaryColor || COLORS.primary || "#6366F1";
  const secondary = SCHOOL_CONFIG.secondaryColor || primary;
  const brandPrimary = SCHOOL_CONFIG.brandPrimary || primary;

  /**
   * Auto-resolves user input (Email, Username, or Phone) to a valid Auth Email.
   */
  const resolveTargetEmail = async (input: string): Promise<string> => {
    const clean = input.trim();
    if (!clean) return "";

    if (clean.includes("@")) {
      return clean.toLowerCase();
    }

    // Standard student and parent domain resolutions
    const studentEmail = getStudentFinalEmail(clean);
    const parentEmail = getParentFinalEmail(clean);

    try {
      const usersRef = collection(db, "users");
      const q = query(
        usersRef,
        or(
          where("profile.email", "==", studentEmail),
          where("email", "==", studentEmail),
          where("profile.email", "==", parentEmail),
          where("email", "==", parentEmail),
          where("username", "==", clean.toLowerCase()),
          where("profile.username", "==", clean.toLowerCase())
        ),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const uData = snap.docs[0].data();
        return uData?.profile?.email || uData?.email || studentEmail;
      }
    } catch (err) {
      console.warn("Firestore resolution error:", err);
    }

    return studentEmail;
  };

  /**
   * Method 1: Send Firebase Password Reset Email
   */
  const handleEmailReset = async () => {
    if (!emailInput.trim()) {
      showToast({ message: "Please enter your email address or username.", type: "error" });
      return;
    }

    setLoading(true);
    try {
      const targetEmail = await resolveTargetEmail(emailInput);
      await sendPasswordResetEmail(auth, targetEmail);
      showToast({
        message: `Password reset link sent to ${targetEmail}. Please check your inbox!`,
        type: "success",
      });
      router.back();
    } catch (error: any) {
      console.error("Email reset error:", error);
      let msg = error.message || "Failed to send reset email.";
      if (error.code === "auth/user-not-found") {
        msg = "No account found matching this email or username.";
      } else if (error.code === "auth/invalid-email") {
        msg = "Invalid email format. Please check your input.";
      }
      showToast({ message: msg, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Method 2: Reset Password via Admin-Provided Code / Token
   */
  const handleTokenReset = async () => {
    if (!emailInput.trim() || !tokenInput.trim() || !newPassword.trim()) {
      showToast({ message: "Please fill in all required fields.", type: "error" });
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast({ message: "Passwords do not match.", type: "error" });
      return;
    }

    if (newPassword.length < 6) {
      showToast({ message: "Password must be at least 6 characters.", type: "error" });
      return;
    }

    setLoading(true);
    try {
      const targetEmail = await resolveTargetEmail(emailInput);
      const cleanToken = tokenInput.trim().toUpperCase();

      // Search Firestore user document
      const usersRef = collection(db, "users");
      const q = query(
        usersRef,
        or(
          where("profile.email", "==", targetEmail),
          where("email", "==", targetEmail)
        ),
        limit(1)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        throw new Error("No user record found with this email or identifier.");
      }

      const userDoc = snap.docs[0];
      const userData = userDoc.data();
      const storedToken = (userData.signupCode || userData.secretCode || "").toUpperCase();

      if (!storedToken || storedToken !== cleanToken) {
        throw new Error("Invalid reset token. Please check your admin code.");
      }

      // Call secure Cloud Function to update Auth password
      const updatePasswordFn = httpsCallable(functions, "resetUserPasswordWithToken");
      await updatePasswordFn({
        uid: userDoc.id,
        token: cleanToken,
        newPassword: newPassword,
      });

      showToast({ message: "Password reset successfully! You can now sign in.", type: "success" });
      router.back();
    } catch (error: any) {
      console.error("Token reset error:", error);
      showToast({ message: error.message || "Failed to reset password.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[primary, secondary]} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.topHeader}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <SVGIcon name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <Animatable.View animation="fadeInDown" style={styles.header}>
              <Text style={styles.title}>Account Recovery</Text>
              <Text style={styles.subtitle}>Choose your preferred reset method below</Text>
            </Animatable.View>

            {/* SEGMENTED CONTROL */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tabButton, mode === "email" && styles.activeTab]}
                onPress={() => setMode("email")}
                activeOpacity={0.8}
              >
                <SVGIcon
                  name="mail"
                  size={18}
                  color={mode === "email" ? brandPrimary : "#64748B"}
                />
                <Text
                  style={[
                    styles.tabText,
                    mode === "email" && { color: brandPrimary, fontWeight: "800" },
                  ]}
                >
                  Email Reset Link
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabButton, mode === "token" && styles.activeTab]}
                onPress={() => setMode("token")}
                activeOpacity={0.8}
              >
                <SVGIcon
                  name="key"
                  size={18}
                  color={mode === "token" ? brandPrimary : "#64748B"}
                />
                <Text
                  style={[
                    styles.tabText,
                    mode === "token" && { color: brandPrimary, fontWeight: "800" },
                  ]}
                >
                  Admin Token / Code
                </Text>
              </TouchableOpacity>
            </View>

            {/* FORM CARD */}
            <Animatable.View animation="fadeInUp" style={styles.card}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>EMAIL ADDRESS OR USERNAME</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. user@school.com or student handle"
                  placeholderTextColor="#94A3B8"
                  value={emailInput}
                  onChangeText={setEmailInput}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!loading}
                />
              </View>

              {mode === "token" && (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>RESET TOKEN (SIGNUP CODE)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. AB1234"
                      placeholderTextColor="#94A3B8"
                      value={tokenInput}
                      onChangeText={setTokenInput}
                      autoCapitalize="characters"
                      editable={!loading}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>NEW PASSWORD</Text>
                    <View style={styles.passwordWrapper}>
                      <TextInput
                        style={styles.passwordInput}
                        placeholder="••••••••"
                        placeholderTextColor="#94A3B8"
                        secureTextEntry={!showPassword}
                        value={newPassword}
                        onChangeText={setNewPassword}
                        editable={!loading}
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                        style={styles.eyeIcon}
                      >
                        <SVGIcon
                          name={showPassword ? "eye-off" : "eye"}
                          size={22}
                          color="#94A3B8"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>CONFIRM NEW PASSWORD</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="••••••••"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry={!showPassword}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      editable={!loading}
                    />
                  </View>
                </>
              )}

              <TouchableOpacity
                style={[styles.button, { backgroundColor: brandPrimary }]}
                onPress={mode === "email" ? handleEmailReset : handleTokenReset}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>
                    {mode === "email" ? "Send Reset Email Link" : "Update Password"}
                  </Text>
                )}
              </TouchableOpacity>
            </Animatable.View>

            <TouchableOpacity onPress={() => router.back()} style={styles.footerBack}>
              <Text style={styles.footerBackText}>Back to Sign In</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topHeader: { padding: 20 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: { padding: 24, flexGrow: 1 },
  header: { marginBottom: 20, alignItems: "center" },
  title: { fontSize: 30, fontWeight: "900", color: "#fff" },
  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    marginTop: 6,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 18,
    padding: 4,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
  },
  activeTab: {
    backgroundColor: "#ffffff",
    ...SHADOWS.small,
  },
  tabText: {
    fontSize: 13,
    color: "#ffffff",
    fontWeight: "600",
  },
  card: { backgroundColor: "#fff", borderRadius: 24, padding: 24, ...SHADOWS.medium },
  inputGroup: { marginBottom: 18 },
  label: { fontSize: 11, fontWeight: "900", color: "#475569", marginBottom: 8, letterSpacing: 1 },
  input: {
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    color: "#1E293B",
  },
  passwordWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
  },
  passwordInput: { flex: 1, padding: 14, fontSize: 15, color: "#1E293B" },
  eyeIcon: { paddingHorizontal: 14 },
  button: {
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 10,
    ...SHADOWS.medium,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  footerBack: { marginTop: 25, alignItems: "center" },
  footerBackText: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: "700" },
});
