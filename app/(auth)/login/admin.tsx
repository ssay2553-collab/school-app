import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  Dimensions,
} from "react-native";
import * as Animatable from "react-native-animatable";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import SVGIcon from "../../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../../constants/Config";
import { SHADOWS } from "../../../constants/theme";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../../firebaseConfig";
import { StatusBar } from "expo-status-bar";
import { useToast } from "../../../contexts/ToastContext";

const { height } = Dimensions.get("window");

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();

  // Brand Colors
  const primary = SCHOOL_CONFIG.primaryColor;
  const secondary = SCHOOL_CONFIG.secondaryColor;
  const brandPrimary = SCHOOL_CONFIG.brandPrimary;
  const brandSecondary = SCHOOL_CONFIG.brandSecondary;
  const surface = SCHOOL_CONFIG.surfaceColor;

  const handleLogin = async () => {
    if (!email || !password) {
      showToast({ message: "Please fill in all fields", type: "error" });
      return;
    }
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);

      const userDoc = await getDoc(doc(db, "users", cred.user.uid));
      const userData = userDoc.data();
      const rawRole = userData?.role || userData?.profile?.role || userData?.adminRole;
      const role = typeof rawRole === 'string' ? rawRole.toLowerCase() : "";

      // Allow "admin" or "super-admin" or similar roles
      if (!userDoc.exists() || !role.includes("admin")) {
          await auth.signOut();
          throw new Error("This account does not have admin privileges.");
      }

      router.replace("/admin-dashboard");
    } catch (error: any) {
      console.error("Admin login error:", error);
      let message = error.message || "Login Failed";
      if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password") {
        message = "Invalid email or password.";
      }
      showToast({ message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <LinearGradient
        colors={[primary, secondary]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerContainer}>
          <View style={styles.navRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
              <SVGIcon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.replace("/")} style={styles.iconBtn}>
              <SVGIcon name="home" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <Animatable.View animation="zoomIn" duration={1000} style={styles.logoCircle}>
            <View style={[styles.innerCircle, { backgroundColor: surface }]}>
              <SVGIcon name="shield-checkmark" size={40} color={brandPrimary} />
            </View>
          </Animatable.View>

          <Animatable.Text animation="fadeInUp" delay={300} style={styles.headerTitle}>ADMIN PORTAL</Animatable.Text>
          <Animatable.Text animation="fadeInUp" delay={400} style={styles.headerSubtitle}>MANAGEMENT AUTHENTICATION</Animatable.Text>
        </View>

        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"} 
          style={{ flex: 1 }}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent} 
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.formWrapper}>
              <Animatable.View animation="fadeInUp" delay={500} style={styles.formCard}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: primary }]}>EMAIL ADDRESS</Text>
                  <View style={[styles.inputContainer, { backgroundColor: surface }]}>
                    <SVGIcon name="mail" size={20} color="#94A3B8" />
                    <TextInput
                      style={styles.input}
                      placeholder="admin@school.com"
                      placeholderTextColor="#94A3B8"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: primary }]}>PASSWORD</Text>
                  <View style={[styles.inputContainer, { backgroundColor: surface }]}>
                    <SVGIcon name="lock-closed" size={20} color="#94A3B8" />
                    <TextInput
                      style={styles.input}
                      placeholder="••••••••"
                      placeholderTextColor="#94A3B8"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity 
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeBtn}
                    >
                      <SVGIcon 
                        name={showPassword ? "eye-off" : "eye"} 
                        size={20} 
                        color="#94A3B8" 
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity 
                  style={[styles.loginBtn, { backgroundColor: brandPrimary }]} 
                  onPress={handleLogin}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <Text style={styles.loginBtnText}>SECURE SIGN IN</Text>
                      <View style={styles.btnIconCircle}>
                        <SVGIcon name="arrow-forward" size={16} color={brandPrimary} />
                      </View>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push("/(auth)/forgot-password")}
                  style={styles.forgotBtn}
                >
                  <Text style={styles.forgotText}>Reset Password</Text>
                </TouchableOpacity>
              </Animatable.View>

              <View style={styles.signupSeparator}>
                <View style={styles.line} />
                <Text style={styles.orText}>OR</Text>
                <View style={styles.line} />
              </View>

              <View style={styles.secondaryActions}>
                <TouchableOpacity 
                  onPress={() => router.push("/(auth)/signup/admin")}
                  style={[styles.signupBtn, { borderColor: brandPrimary }]}
                  activeOpacity={0.7}
                >
                  <SVGIcon name="person-add" size={20} color={brandPrimary} />
                  <Text style={[styles.signupBtnText, { color: brandPrimary }]}>
                    CREATE ACCOUNT
                  </Text>
                </TouchableOpacity>
              </View>

              <Animatable.View animation="fadeIn" delay={800} style={styles.helpFooter}>
                <Text style={styles.helpText}>Authorized Personnel Only</Text>
                <View style={styles.divider} />
                <Text style={styles.versionText}>EduEaze Core v1.2.0</Text>
              </Animatable.View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  headerContainer: {
    height: height * 0.35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navRow: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 50 : 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 8,
    marginBottom: 15,
    ...SHADOWS.medium,
  },
  innerCircle: {
    width: '100%',
    height: '100%',
    borderRadius: 37,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 2,
  },
  headerSubtitle: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '800',
    marginTop: 5,
    letterSpacing: 1.5,
  },
  scrollContent: { flexGrow: 1 },
  formWrapper: {
    paddingHorizontal: 25,
    paddingTop: 10,
    paddingBottom: 40,
  },
  formCard: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 30,
    padding: 25,
    gap: 20,
    ...SHADOWS.medium,
  },
  inputGroup: { gap: 8 },
  label: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginLeft: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    borderRadius: 18,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  input: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  eyeBtn: {
    padding: 10,
  },
  loginBtn: {
    height: 65,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    gap: 15,
    ...SHADOWS.large,
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  btnIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  forgotBtn: {
    marginTop: 15,
    alignItems: 'center',
  },
  forgotText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },
  signupSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 25,
    paddingHorizontal: 10,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  orText: {
    marginHorizontal: 15,
    fontSize: 12,
    color: '#fff',
    fontWeight: '800',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 12,
  },
  signupBtn: {
    flex: 1,
    height: 60,
    borderRadius: 20,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  signupBtnText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  helpFooter: {
    marginTop: 40,
    alignItems: 'center',
  },
  helpText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '700',
    letterSpacing: 1,
  },
  divider: {
    width: 40,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginVertical: 15,
  },
  versionText: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '800',
    letterSpacing: 1,
  },
});
