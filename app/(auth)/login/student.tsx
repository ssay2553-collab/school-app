import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
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
import { auth, db } from "../../../firebaseConfig";
import { useToast } from "../../../contexts/ToastContext";

export default function StudentLoginScreen() {
  const router = useRouter();
  const { height, width } = useWindowDimensions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { showToast } = useToast();

  const schoolId = SCHOOL_CONFIG.schoolId;
  const schoolLogo = getSchoolLogo(schoolId);

  const primary = SCHOOL_CONFIG.primaryColor || COLORS.primary || "#6366F1";
  const secondary = SCHOOL_CONFIG.secondaryColor || primary;
  const surface = SCHOOL_CONFIG.surfaceColor || "#FFFFFF";

  const isWeb = Platform.OS === "web";

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showToast({ message: "Type your credentials first! 🚀", type: "error" });
      return;
    }

    setLoading(true);
    try {
      let finalEmail = email.trim().toLowerCase();
      if (!finalEmail.includes("@")) {
        // Apply the same auto-formatting used in signup
        finalEmail = `${finalEmail}@${SCHOOL_CONFIG.schoolId || 'student'}.edueaz.com`;
      }

      const cred = await signInWithEmailAndPassword(
        auth,
        finalEmail,
        password,
      );

      const userDoc = await getDoc(doc(db, "users", cred.user.uid));
      const userData = userDoc.data();
      const rawRole = userData?.role || userData?.profile?.role;
      const role = typeof rawRole === 'string' ? rawRole.toLowerCase() : "";

      if (!userDoc.exists() || role !== "student") {
        await auth.signOut();
        throw new Error("This account is not registered as a student.");
      }

      router.replace("/student-dashboard");
    } catch (error: any) {
      console.error("Login error:", error.code);
      let message = error.message || "An error occurred during login.";
      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/wrong-password"
      ) {
        message = "Oops! Wrong email or password. Try again! ✨";
      }
      showToast({ message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
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
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View style={styles.topHeader}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backIconButton}
            >
              <SVGIcon name="arrow-back" size={24} color={primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.replace("/")}
              style={styles.homeShortcut}
            >
              <SVGIcon name="home-outline" size={20} color={primary} />
              <Text style={[styles.homeShortcutText, { color: primary }]}>
                Portal
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animatable.View
              animation={isWeb ? undefined : "bounceInDown"}
              duration={1000}
              style={[styles.header, isWeb && { opacity: 1 }]}
            >
              <View style={[styles.logoContainer, { backgroundColor: "#fff" }]}>
                <Image
                  source={schoolLogo}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.title}>Student Portal</Text>
              <Text style={styles.subtitle}>
                Time for some magic learning! 🎓
              </Text>
            </Animatable.View>

            <Animatable.View
              animation={isWeb ? undefined : "fadeInUp"}
              duration={800}
              style={[styles.card, isWeb && { opacity: 1 }]}
            >
              <View style={styles.inputGroup}>
                <Text style={styles.label}>EMAIL OR USERNAME</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. kojo123"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  editable={!loading}
                  autoComplete="off"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>MY SECRET PASSWORD</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="••••••••"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
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
                  <Text style={styles.buttonText}>Let's Go! 🚀</Text>
                )}
              </TouchableOpacity>

              <View style={styles.cardFooter}>
                <View style={styles.signupWrapper}>
                  <Text style={styles.signupLabel}>New to the school?</Text>
                  <TouchableOpacity
                    onPress={() => router.push("/(auth)/signup/student")}
                    style={[styles.joinButton, { borderColor: primary }]}
                  >
                    <Text style={[styles.joinButtonText, { color: primary }]}>
                      Join your Class 🎓
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  onPress={() => router.push("/(auth)/forgot-password")}
                >
                  <Text style={styles.forgotText}>Lost my password</Text>
                </TouchableOpacity>
              </View>
            </Animatable.View>

            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
            >
              <Text style={styles.backText}>Go Back</Text>
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: "100%", minHeight: "100%" },
  topHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    height: 60,
  },
  backIconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.small,
  },
  homeShortcut: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 12,
    ...SHADOWS.small,
  },
  homeShortcutText: {
    marginLeft: 8,
    fontWeight: "800",
    fontSize: 13,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 10,
    flexGrow: 1,
    justifyContent: "center",
  },
  header: { marginBottom: 30, alignItems: "center" },
  logoContainer: {
    width: 90,
    height: 90,
    marginBottom: 16,
    borderRadius: 45,
    padding: 15,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.medium,
  },
  logo: { width: "100%", height: "100%" },
  title: { fontSize: 32, fontWeight: "900", color: "#fff" },
  subtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
    textAlign: "center",
    fontWeight: "600",
  },
  errorBanner: {
    backgroundColor: "#FF6B6B",
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderRadius: 20,
    marginBottom: 20,
  },
  errorText: {
    color: "#fff",
    flex: 1,
    marginHorizontal: 10,
    fontSize: 14,
    fontWeight: "bold",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    padding: 24,
    ...SHADOWS.large,
    borderWidth: 3,
    borderColor: "#F1F5F9",
  },
  inputGroup: { marginBottom: 20 },
  label: {
    fontSize: 11,
    fontWeight: "900",
    color: "#475569",
    marginBottom: 8,
    letterSpacing: 1.5,
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    padding: 16,
    fontSize: 16,
    color: "#1E293B",
    borderWidth: 2,
    borderColor: "#F1F5F9",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#F1F5F9",
  },
  passwordInput: { flex: 1, padding: 16, fontSize: 16, color: "#1E293B" },
  eyeIcon: { paddingHorizontal: 16 },
  button: {
    padding: 20,
    borderRadius: 20,
    alignItems: "center",
    marginTop: 10,
    ...SHADOWS.medium,
  },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "900" },
  cardFooter: { marginTop: 25, gap: 20, alignItems: "center" },
  signupWrapper: { width: "100%", alignItems: "center", gap: 10 },
  signupLabel: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  joinButton: {
    width: "100%",
    padding: 16,
    borderRadius: 18,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    ...SHADOWS.small,
  },
  joinButtonText: { fontSize: 16, fontWeight: "900" },
  forgotText: { color: "#94A3B8", fontSize: 14, fontWeight: "700" },
  backBtn: { marginTop: 25, alignItems: "center" },
  backText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase",
  },
});
