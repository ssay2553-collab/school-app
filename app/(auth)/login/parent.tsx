import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import React, { useState, useEffect, useRef } from "react";
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
    View,
    Keyboard,
} from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../../constants/Config";
import { getSchoolLogo } from "../../../constants/Logos";
import { SHADOWS, COLORS } from "../../../constants/theme";
import { auth, db } from "../../../firebaseConfig";
import Constants from "expo-constants";
import { LinearGradient } from "expo-linear-gradient";

export default function ParentLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const emailInputRef = useRef<TextInput>(null);

  const schoolId = SCHOOL_CONFIG.schoolId;
  const schoolLogo = getSchoolLogo(schoolId);
  
  const primary = SCHOOL_CONFIG.primaryColor;
  const secondary = SCHOOL_CONFIG.secondaryColor;
  const surface = SCHOOL_CONFIG.surfaceColor;

  // Fix for Electron/Web interaction issues after logout
  useEffect(() => {
    const timer = setTimeout(() => {
        emailInputRef.current?.focus();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleLogin = async (e?: any) => {
    // Fix: Blur focus on web/electron to prevent aria-hidden/focus conflict
    if (Platform.OS === 'web' && e?.currentTarget?.blur) {
      e.currentTarget.blur();
    }
    
    Keyboard.dismiss();
    setErrorMessage(null);
    if (!email.trim() || !password.trim()) {
      return setErrorMessage("Credentials required.");
    }
    
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      
      const userDoc = await getDoc(doc(db, "users", cred.user.uid));
      if (!userDoc.exists() || userDoc.data()?.role !== "parent") {
          await auth.signOut();
          throw new Error("This account is not registered as a parent.");
      }

      router.replace("/parent-dashboard");
    } catch (error: any) {
      console.error("Login error:", error.code);
      let message = error.message || "An error occurred.";
      if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password") {
        message = "Invalid email or password.";
      }
      setErrorMessage(message);
      if (Platform.OS !== 'web') Alert.alert("Login Error", message);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (route: string, e?: any) => {
    // Fix: Blur focus on web/electron to prevent aria-hidden/focus conflict
    if (Platform.OS === 'web' && e?.currentTarget?.blur) {
      e.currentTarget.blur();
    }
    router.push(route as any);
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
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"} 
          style={styles.keyboardView}
        >
          <ScrollView 
              contentContainerStyle={styles.scrollContent} 
              keyboardShouldPersistTaps="handled"
          >
            <Animatable.View animation="fadeInDown" duration={800} style={styles.header}>
              <View style={[styles.logoContainer, { backgroundColor: surface }]}>
                <Image source={schoolLogo} style={styles.logo} resizeMode="contain" />
              </View>
              <Text style={styles.title}>Parent Portal</Text>
              <Text style={styles.subtitle}>Secure access to academic records</Text>
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
                <Text style={styles.label}>PARENT EMAIL</Text>
                <TextInput 
                  ref={emailInputRef}
                  style={styles.input} 
                  placeholder="parent@school.com" 
                  placeholderTextColor="#94A3B8" 
                  autoCapitalize="none" 
                  value={email} 
                  onChangeText={setEmail} 
                  keyboardType="email-address" 
                  editable={!loading} 
                  autoComplete="email"
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
                      onChangeText={setPassword} 
                      editable={!loading} 
                      autoComplete="password"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                    <SVGIcon name={showPassword ? "eye-off" : "eye"} size={22} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity 
                  style={[styles.button, { backgroundColor: primary }, loading && { opacity: 0.7 }]} 
                  onPress={(e) => handleLogin(e)} 
                  disabled={loading}
                  activeOpacity={0.8}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
              </TouchableOpacity>

              <View style={styles.cardFooter}>
                  <View style={styles.signupWrapper}>
                    <Text style={styles.signupLabel}>New parent?</Text>
                    <TouchableOpacity 
                      onPress={(e) => handleNavigate("/(auth)/signup/parent", e)} 
                      style={[styles.joinButton, { borderColor: primary }]}
                    >
                        <Text style={[styles.joinButtonText, { color: primary }]}>Register My Account 📝</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity onPress={(e) => handleNavigate("/(auth)/forgot-password", e)}>
                      <Text style={styles.forgotText}>Forgot password?</Text>
                  </TouchableOpacity>
              </View>
            </Animatable.View>

            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backText}>Switch Portal</Text>
            </TouchableOpacity>
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
  keyboardView: { flex: 1, pointerEvents: 'auto' } as any,
  scrollContent: { padding: 24, flexGrow: 1, justifyContent: "center" },
  header: { marginBottom: 30, alignItems: "center" },
  logoContainer: { width: 80, height: 80, marginBottom: 16, borderRadius: 40, padding: 10, justifyContent: 'center', alignItems: 'center', ...SHADOWS.medium },
  logo: { width: "100%", height: "100%" },
  title: { fontSize: 32, fontWeight: "900", color: "#fff" },
  subtitle: { fontSize: 16, color: "rgba(255,255,255,0.8)", marginTop: 4, textAlign: 'center', fontWeight: '600' },
  errorBanner: { backgroundColor: "#EF4444", flexDirection: "row", alignItems: "center", padding: 15, borderRadius: 12, marginBottom: 20 },
  errorText: { color: "#fff", flex: 1, marginHorizontal: 10, fontSize: 14, fontWeight: "600" },
  card: { backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 24, padding: 24, ...SHADOWS.medium },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 11, fontWeight: "800", color: "#475569", marginBottom: 8, letterSpacing: 1 },
  input: { backgroundColor: "#F1F5F9", borderRadius: 14, padding: 14, fontSize: 16, color: "#1E293B", borderWidth: 1, borderColor: '#E2E8F0' },
  passwordContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#F1F5F9", borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  passwordInput: { flex: 1, padding: 14, fontSize: 16, color: "#1E293B" },
  eyeIcon: { paddingHorizontal: 14 },
  button: { padding: 18, borderRadius: 16, alignItems: "center", marginTop: 10, ...SHADOWS.medium },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  cardFooter: { marginTop: 25, gap: 20, alignItems: 'center' },
  signupWrapper: { width: '100%', alignItems: 'center', gap: 10 },
  signupLabel: { color: "#64748B", fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  joinButton: { 
    width: '100%', 
    padding: 16, 
    borderRadius: 18, 
    borderWidth: 2.5, 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: '#fff',
    ...SHADOWS.small,
  },
  joinButtonText: { fontSize: 15, fontWeight: '800' },
  forgotText: { color: "#94A3B8", fontSize: 13, fontWeight: "700", textTransform: 'uppercase' },
  backBtn: { marginTop: 30, alignItems: 'center', padding: 10 },
  backText: { color: "rgba(255,255,255,0.6)", fontSize: 14, fontWeight: "600" },
});
