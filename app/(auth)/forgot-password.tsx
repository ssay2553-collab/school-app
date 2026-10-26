import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { sendPasswordResetEmail } from "firebase/auth";
import { collection, getDocs, limit, or, query, where, setDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
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
   * Method 1: Send Firebase Password Reset Email or Create Admin Reset Request
   */
  const handleEmailReset = async () => {
    if (!emailInput.trim()) {
      showToast({ message: "Please enter your email address or username.", type: "error" });
      return;
    }

    setLoading(true);
    try {
      const cleanInput = emailInput.trim();
      const targetEmail = await resolveTargetEmail(cleanInput);

      // Search Firestore to see if user exists
      let userDoc: any = null;
      let userData: any = null;

      try {
        const usersRef = collection(db, "users");
        const q = query(
          usersRef,
          or(
            where("profile.email", "==", targetEmail),
            where("email", "==", targetEmail),
            where("username", "==", cleanInput.toLowerCase()),
            where("profile.username", "==", cleanInput.toLowerCase())
          ),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          userDoc = snap.docs[0];
          userData = userDoc.data();
        }
      } catch (err) {
        console.warn("User lookup error:", err);
      }

      // Check if it's a real external email or synthetic student handle
      const isSynthetic = targetEmail.includes(".edueaz.com") || !targetEmail.includes("@");

      if (isSynthetic || userData?.role === "student") {
        // Create Password Reset Request in Firestore for School Super Admin
        const studentUid = userDoc?.id || "unknown";
        const studentName =
          userData?.profile?.fullName ||
          `${userData?.profile?.firstName || ""} ${userData?.profile?.lastName || ""}`.trim() ||
          cleanInput;

        const reqRef = doc(collection(db, "passwordResetRequests"));
        await setDoc(reqRef, {
          requestId: reqRef.id,
          studentUid: studentUid,
          studentName: studentName,
          identifier: cleanInput,
          targetEmail: targetEmail,
          status: "pending",
          schoolId: SCHOOL_CONFIG.schoolId || "school",
          createdAt: serverTimestamp(),
        });

        // Create Notification for Admin
        const notifRef = doc(collection(db, "notifications"));
        await setDoc(notifRef, {
          id: notifRef.id,
          title: "🔑 Student Password Reset Request",
          body: `Password reset requested for student ${studentName} (${cleanInput}). Please approve in Manage Users.`,
          type: "password_reset_request",
          recipientRole: "admin",
          schoolId: SCHOOL_CONFIG.schoolId || "school",
          studentUid: studentUid,
          requestId: reqRef.id,
          read: false,
          createdAt: serverTimestamp(),
        });

        showToast({
          message: "Password reset request submitted! The administrators have been notified.",
          type: "success",
        });
        router.back();
        return;
      }

      // External email address -> Send standard Firebase reset email
      await sendPasswordResetEmail(auth, targetEmail);
      showToast({
        message: `Password reset link sent to ${targetEmail}. Please check your inbox!`,
        type: "success",
      });
      router.back();
    } catch (error: any) {
      console.error("Email reset error:", error);
      showToast({ message: error.message || "Failed to send reset request.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Method 2: Reset Password via Admin-Provided Code / Link Code
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
      const cleanInput = emailInput.trim();
      const cleanToken = tokenInput.trim().toUpperCase();
      const targetEmail = await resolveTargetEmail(cleanInput);

      // Try Cloud Function if deployed first
      try {
        const updatePasswordFn = httpsCallable(functions, "resetUserPasswordWithToken");
        await updatePasswordFn({
          identifier: cleanInput,
          token: cleanToken,
          newPassword: newPassword,
        });

        showToast({ message: "Password reset successfully! You can now sign in.", type: "success" });
        router.back();
        return;
      } catch (cfErr) {
        console.warn("Cloud function unavailable, trying client-side verification:", cfErr);
      }

      // Client-Side Link Code Verification
      const usersRef = collection(db, "users");
      const q = query(
        usersRef,
        or(
          where("profile.email", "==", targetEmail),
          where("email", "==", targetEmail),
          where("username", "==", cleanInput.toLowerCase()),
          where("parentLinkCode", "==", cleanToken),
          where("signupCode", "==", cleanToken)
        ),
        limit(1)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        throw new Error("No user record found matching this code or identifier.");
      }

      const userDoc = snap.docs[0];
      const userData = userDoc.data();
      const storedToken = (
        userData.signupCode ||
        userData.secretCode ||
        userData.parentLinkCode ||
        ""
      )
        .toString()
        .trim()
        .toUpperCase();

      if (!storedToken || storedToken !== cleanToken) {
        throw new Error("Invalid Link Code. Please check your official school code.");
      }

      const studentName =
        userData?.profile?.fullName ||
        `${userData?.profile?.firstName || ""} ${userData?.profile?.lastName || ""}`.trim() ||
        cleanInput;

      // Update student's Firestore user document with the new password
      await updateDoc(doc(db, "users", userDoc.id), {
        resetPassword: newPassword.trim(),
        tempPassword: newPassword.trim(),
        resetPasswordPending: false,
        updatedAt: serverTimestamp(),
      });

      // Send Admin Notification alert that the student reset password via Link Code
      const notifRef = doc(collection(db, "notifications"));
      await setDoc(notifRef, {
        id: notifRef.id,
        title: "🔑 Link Code Password Reset",
        body: `Student ${studentName} (${cleanInput}) successfully reset their password using valid Link Code ${cleanToken}.`,
        type: "password_reset_notice",
        recipientRole: "admin",
        schoolId: SCHOOL_CONFIG.schoolId || "school",
        studentUid: userDoc.id,
        read: false,
        createdAt: serverTimestamp(),
      });

      showToast({
        message: "Password reset successfully! You can now log in with your new password.",
        type: "success",
      });

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
