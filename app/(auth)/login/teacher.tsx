import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

export default function TeacherLoginScreen() {
  const router = useRouter();
  const { height, width } = useWindowDimensions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const schoolId = SCHOOL_CONFIG.schoolId || "school";
  const schoolLogo = getSchoolLogo(schoolId);

  const primary = SCHOOL_CONFIG.primaryColor || COLORS.primary || "#6366F1";
  const secondary = SCHOOL_CONFIG.secondaryColor || primary;
  const surface = SCHOOL_CONFIG.surfaceColor || "#FFFFFF";

  const isWeb = Platform.OS === "web";

  const handleLogin = async () => {
    setErrorMessage(null);
    if (!email.trim() || !password.trim()) {
      return setErrorMessage("Please enter your credentials.");
    }

    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password,
      );

      const userDoc = await getDoc(doc(db, "users", cred.user.uid));
      const userData = userDoc.data();
      const role = userData?.role || userData?.profile?.role;

      if (!userDoc.exists() || role !== "teacher") {
        await auth.signOut();
        throw new Error("This account is not registered as a teacher.");
      }

      router.replace("/teacher-dashboard");
    } catch (error: any) {
      console.error("Login error:", error.code);
      let message = error.message || "Login failed.";
      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/wrong-password"
      ) {
        message = "Invalid email or password.";
      }
      setErrorMessage(message);
      if (!isWeb) Alert.alert("Login Error", message);
    } finally {
      setLoading(false);
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
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
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

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
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

            {errorMessage && (
              <Animatable.View animation="shake" style={styles.errorBanner}>
                <SVGIcon name="close-circle" size={20} color="#fff" />
                <Text style={styles.errorText}>{errorMessage}</Text>
                <TouchableOpacity onPress={() => setErrorMessage(null)}>
                  <SVGIcon name="close" size={20} color="#fff" />
                </TouchableOpacity>
              </Animatable.View>
            )}

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
                    setErrorMessage(null);
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
                      setErrorMessage(null);
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
                onPress={() => router.push("/(auth)/forgot-password")}
                style={styles.forgotBtn}
              >
                <Text style={styles.forgotText}>Reset Password</Text>
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
    paddingHorizontal: 20,
    paddingTop: 20,
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
