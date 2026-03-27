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
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ScrollView,
} from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../../constants/Config";
import { getSchoolLogo } from "../../../constants/Logos";
import { SHADOWS, COLORS } from "../../../constants/theme";
import { auth, db } from "../../../firebaseConfig";
import Constants from "expo-constants";
import { LinearGradient } from "expo-linear-gradient";

export default function TeacherLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const schoolId = Constants.expoConfig?.extra?.schoolId || "school";
  const schoolLogo = getSchoolLogo(schoolId);
  
  const primary = SCHOOL_CONFIG.primaryColor;
  const secondary = SCHOOL_CONFIG.secondaryColor;
  const surface = SCHOOL_CONFIG.surfaceColor;

  const handleLogin = async () => {
    setErrorMessage(null);
    if (!email.trim() || !password.trim()) {
      return setErrorMessage("Please enter your credentials.");
    }
    
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      
      const userDoc = await getDoc(doc(db, "users", cred.user.uid));
      if (!userDoc.exists() || userDoc.data()?.role !== "teacher") {
          await auth.signOut();
          throw new Error("This account is not registered as a teacher.");
      }

      router.replace("/teacher-dashboard");
    } catch (error: any) {
      console.error("Login error:", error.code);
      let message = error.message || "Login failed.";
      if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password") {
        message = "Invalid email or password.";
      }
      setErrorMessage(message);
      if (Platform.OS !== 'web') Alert.alert("Login Error", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <LinearGradient
        colors={[primary, secondary]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={styles.topHeader}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backIconButton}>
                <SVGIcon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.replace("/")} style={styles.homeShortcut}>
                <SVGIcon name="home-outline" size={20} color="#fff" />
                <Text style={styles.homeShortcutText}>Welcome Hub</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <Animatable.View animation="fadeInDown" duration={800} style={styles.header}>
              <View style={[styles.logoContainer, { backgroundColor: surface }]}>
                <Image source={schoolLogo} style={styles.logo} resizeMode="contain" />
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

            <Animatable.View animation="fadeInUp" duration={800} style={styles.card}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>TEACHER EMAIL</Text>
                <TextInput
                  style={styles.input}
                  placeholder="teacher@school.com"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={(v) => { setErrorMessage(null); setEmail(v); }}
                  keyboardType="email-address"
                  editable={!loading}
                  autoComplete="off"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>PASSWORD</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="••••••••"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={(v) => { setErrorMessage(null); setPassword(v); }}
                    editable={!loading}
                    autoComplete="off"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                    <SVGIcon name={showPassword ? "eye-off" : "eye"} size={22} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.button, { backgroundColor: primary }, loading && { opacity: 0.7 }]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.push("/(auth)/forgot-password")} style={styles.forgotBtn}>
                <Text style={styles.forgotText}>Reset Password</Text>
              </TouchableOpacity>
            </Animatable.View>

            <Animatable.View animation="fadeIn" delay={500} style={styles.footer}>
              <TouchableOpacity onPress={() => router.push("/(auth)/signup/teacher")} style={styles.signupBtn}>
                <Text style={styles.signupText}>
                  Need an account? <Text style={[styles.signupLink, { color: primary }]}>Register as Teacher</Text>
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Text style={styles.backText}>Switch Portal</Text>
              </TouchableOpacity>
            </Animatable.View>
            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    height: 60,
  },
  backIconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  homeShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 12,
  },
  homeShortcutText: {
    marginLeft: 8,
    fontWeight: '800',
    fontSize: 13,
    color: '#fff'
  },
  scrollContent: { padding: 24, paddingTop: 10, flexGrow: 1, justifyContent: "center" },
  header: { marginBottom: 30, alignItems: "center" },
  logoContainer: { width: 80, height: 80, marginBottom: 16, borderRadius: 40, padding: 10, justifyContent: 'center', alignItems: 'center', ...SHADOWS.medium },
  logo: { width: "100%", height: "100%" },
  title: { fontSize: 28, fontWeight: "bold", color: "#fff" },
  subtitle: { fontSize: 16, color: "rgba(255,255,255,0.8)", marginTop: 4, textAlign: 'center' },
  errorBanner: { backgroundColor: "#EF4444", flexDirection: "row", alignItems: "center", padding: 15, borderRadius: 12, marginBottom: 20 },
  errorText: { color: "#fff", flex: 1, marginHorizontal: 10, fontSize: 14, fontWeight: "600" },
  card: { backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 24, padding: 24, ...SHADOWS.medium },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 11, fontWeight: "800", color: "#475569", marginBottom: 8, letterSpacing: 1 },
  input: { backgroundColor: "#F1F5F9", borderRadius: 14, padding: 14, fontSize: 16, color: "#1E293B" },
  passwordContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#F1F5F9", borderRadius: 14 },
  passwordInput: { flex: 1, padding: 14, fontSize: 16, color: "#1E293B" },
  eyeIcon: { paddingHorizontal: 14 },
  button: { padding: 18, borderRadius: 16, alignItems: "center", marginTop: 10, ...SHADOWS.medium },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  forgotBtn: { marginTop: 20, alignItems: "center" },
  forgotText: { color: "#64748B", fontSize: 14, fontWeight: "500" },
  footer: { marginTop: 30, alignItems: "center" },
  signupBtn: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 100, backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#E2E8F0", ...SHADOWS.small },
  signupText: { color: "#64748B", fontSize: 14 },
  signupLink: { fontWeight: "bold" },
  backBtn: { marginTop: 20, padding: 10 },
  backText: { color: "rgba(255,255,255,0.6)", fontSize: 14, fontWeight: "600" },
});
