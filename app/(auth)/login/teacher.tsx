import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, collection, query, where, limit, getDocs, or } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../../constants/Config";
import { getSchoolLogo } from "../../../constants/Logos";
import { COLORS, SHADOWS } from "../../../constants/theme";
import { auth, db, functions } from "../../../firebaseConfig";
import { useToast } from "../../../contexts/ToastContext";
import { getTeacherClasses } from "../../../lib/classHelpers";

export default function TeacherLoginScreen() {
  const router = useRouter();
  const { height, width } = useWindowDimensions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { showToast } = useToast();

  const schoolId = SCHOOL_CONFIG.schoolId || "school";
  const schoolLogo = getSchoolLogo(schoolId);

  const primary = SCHOOL_CONFIG.primaryColor || COLORS.primary || "#6366F1";
  const secondary = SCHOOL_CONFIG.secondaryColor || primary;
  const surface = SCHOOL_CONFIG.surfaceColor || "#FFFFFF";

  const isWeb = Platform.OS === "web";

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showToast({ message: "Please enter your credentials.", type: "error" });
      return;
    }

    setLoading(true);
    const finalEmail = email.trim().toLowerCase();

    try {
      // 1. Try standard login
      const cred = await signInWithEmailAndPassword(auth, finalEmail, password);
      await finishLogin(cred.user.uid);
    } catch (error: any) {
      console.log("Standard login failed, checking for Token Login...");

      try {
        // 2. Secondary check: Token Login
        const cleanToken = password.trim().toUpperCase();
        const usersRef = collection(db, "users");
        const q = query(
          usersRef,
          or(
            where("profile.email", "==", finalEmail),
            where("email", "==", finalEmail)
          ),
          limit(1)
        );
        const snap = await getDocs(q);

        if (!snap.empty) {
          const userDoc = snap.docs[0];
          const userData = userDoc.data();
          const storedToken = userData.signupCode || userData.secretCode;

          if (storedToken && (storedToken === cleanToken || storedToken === password.trim())) {
            showToast({ message: "Token matched! Syncing access...", type: "info" });

            // Call Cloud Function to update password to match the token for future logins
            const updatePasswordFn = httpsCallable(functions, "resetUserPasswordWithToken");
            await updatePasswordFn({
              uid: userDoc.id,
              token: storedToken, // Use the stored token (could be case sensitive in some contexts)
              newPassword: password.trim(), // Reset password to what they typed
            });

            // Now sign in with the new password
            const cred = await signInWithEmailAndPassword(auth, finalEmail, password.trim());
            await finishLogin(cred.user.uid);
            return;
          }
        }
      } catch (tokenErr) {
        console.error("Token login attempt failed:", tokenErr);
      }

      // If both fail, show original error
      let message = error.message || "Login failed.";
      if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password") {
        message = "Invalid email or password.";
      }
      showToast({ message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const finishLogin = async (uid: string) => {
    let userDoc = await getDoc(doc(db, "users", uid));
    let userData = userDoc.data();

    if (!userDoc.exists()) {
      // Fallback: Check for staff with legacy IDs mapped via authUid
      const q = query(
        collection(db, "users"),
        where("authUid", "==", uid),
        limit(1)
      );
      const querySnap = await getDocs(q);
      if (!querySnap.empty) {
        userDoc = querySnap.docs[0];
        userData = userDoc.data();
      } else {
        await auth.signOut();
        throw new Error("User record not found. Please ensure your registration was completed successfully.");
      }
    }

    const role = (userData?.role || userData?.profile?.role || "").toLowerCase();
    const adminRole = (userData?.adminRole || userData?.profile?.adminRole || "").toLowerCase();

    // Hybrid logic: Allow if they are explicitly a teacher OR an admin with teaching duties
    const isTeacher =
      role === "teacher" ||
      getTeacherClasses(userData as any).length > 0 ||
      (userData?.subjects || []).length > 0 ||
      (userData?.profile?.subjects || []).length > 0;
    const isAdmin = role === "admin" || adminRole !== "";
    const isParent = role === "parent";
    const isStudent = role === "student";

    if (isTeacher) {
      router.replace("/teacher-dashboard");
    } else if (isAdmin) {
      showToast({ message: "Accessing Management Portal...", type: "info" });
      router.replace("/admin-dashboard");
    } else if (isParent) {
      showToast({ message: "Redirecting to Parent Portal...", type: "info" });
      router.replace("/parent-dashboard");
    } else if (isStudent) {
      showToast({ message: "Redirecting to Student Portal...", type: "info" });
      router.replace("/student-dashboard");
    } else {
      await auth.signOut();
      throw new Error("This account does not have teacher access privileges.");
    }
  };

  return (
    <View
      style={[
        styles.container,
        isWeb && { height: "calc(var(--vh)*100)" as any, width: "100%" },
      ]}
    >
      <StatusBar barStyle="light-content" />

      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={[primary, secondary]}
          style={{ flex: 1 }}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </View>

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.topHeader}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backIconButton}
              >
                <SVGIcon name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.replace("/")}
                style={styles.homeShortcut}
              >
                <SVGIcon name="home-outline" size={20} color="#fff" />
                <Text style={styles.homeShortcutText}>Hub</Text>
              </TouchableOpacity>
            </View>

            <Animatable.View
              animation={isWeb ? undefined : "fadeInDown"}
              duration={800}
              style={[styles.header, isWeb && { opacity: 1 }]}
            >
              <View style={[styles.logoContainer, { backgroundColor: "#fff" }]}>
                <Image
                  source={schoolLogo}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.title}>Teacher Portal</Text>
              <Text style={styles.subtitle}>Sign in to manage academics</Text>
            </Animatable.View>

            <Animatable.View
              animation={isWeb ? undefined : "fadeInUp"}
              duration={800}
              style={[styles.card, isWeb && { opacity: 1 }]}
            >
              <View style={styles.inputGroup}>
                <Text style={styles.label}>TEACHER EMAIL</Text>
                <TextInput
                  style={styles.input}
                  placeholder="teacher@school.com"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={(v) => {
                    setEmail(v);
                  }}
                  keyboardType="email-address"
                  editable={!loading}
                  autoComplete="off"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>PASSWORD</Text>
                <View style={{ position: "relative" }}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="••••••••"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={(v) => {
                      setPassword(v);
                    }}
                    editable={!loading}
                    autoComplete="off"
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

              <TouchableOpacity
                style={[
                  styles.button,
                  { backgroundColor: primary },
                  loading && { opacity: 0.7 },
                ]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Sign In</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push("/(auth)/token-reset")}
                style={styles.forgotBtn}
              >
                <Text style={styles.forgotText}>Reset Password (Token)</Text>
              </TouchableOpacity>
            </Animatable.View>

            <View style={styles.footer}>
              <TouchableOpacity
                onPress={() => router.push("/(auth)/signup/teacher")}
                style={styles.signupBtn}
              >
                <Text style={styles.signupText}>
                  Need an account?{" "}
                  <Text style={[styles.signupLink, { color: primary }]}>
                    Register here
                  </Text>
                </Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 20,
    height: 70,
  },
  backIconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  homeShortcut: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 12,
  },
  homeShortcutText: {
    marginLeft: 8,
    fontWeight: "800",
    fontSize: 13,
    color: "#fff",
  },
  scrollContent: {
    padding: 24,
    paddingTop: 10,
    flexGrow: 1,
    justifyContent: "center",
  },
  header: { marginBottom: 30, alignItems: "center" },
  logoContainer: {
    width: 80,
    height: 80,
    marginBottom: 16,
    borderRadius: 40,
    padding: 10,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.medium,
  },
  logo: { width: "100%", height: "100%" },
  title: { fontSize: 28, fontWeight: "bold", color: "#fff" },
  subtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
    textAlign: "center",
  },
  errorBanner: {
    backgroundColor: "#EF4444",
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
  },
  errorText: {
    color: "#fff",
    flex: 1,
    marginHorizontal: 10,
    fontSize: 14,
    fontWeight: "600",
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 24,
    padding: 24,
    ...SHADOWS.medium,
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
  passwordInput: {
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    padding: 14,
    paddingRight: 50,
    fontSize: 16,
    color: "#1E293B",
    width: "100%",
  },
  eyeIcon: { position: "absolute", right: 14, top: 12 },
  button: {
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 10,
    ...SHADOWS.medium,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  forgotBtn: { marginTop: 20, alignItems: "center" },
  forgotText: { color: "#64748B", fontSize: 14, fontWeight: "500" },
  footer: { marginTop: 30, alignItems: "center" },
  signupBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 100,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    ...SHADOWS.small,
  },
  signupText: { color: "#64748B", fontSize: 14 },
  signupLink: { fontWeight: "bold" },
});
