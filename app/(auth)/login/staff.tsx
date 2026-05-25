import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
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
import { auth } from "../../../firebaseConfig";

export default function StaffLogin() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const { showToast } = useToast();
  const schoolName = SCHOOL_CONFIG.name;
  const primary = SCHOOL_CONFIG.primaryColor;
  const surface = SCHOOL_CONFIG.surfaceColor;

  const handleStaffLogin = async () => {
    if (!email.trim() || !password) {
      showToast({ message: "Enter your email and password", type: "error" });
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      showToast({ message: "Welcome back!", type: "success" });
      router.replace("/staff-dashboard");
    } catch (err: any) {
      console.error("Staff Login Error:", err);
      let errorMessage = "Login failed. Check credentials.";
      if (err.code === 'auth/invalid-credential') {
        errorMessage = "Invalid email or password.";
      }
      showToast({ message: errorMessage, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: surface }]}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>

          <Animatable.View animation="fadeInDown" duration={800} style={styles.header}>
            <View style={[styles.logoBadge, { backgroundColor: primary + '15' }]}>
              <SVGIcon name="briefcase" size={32} color={primary} />
            </View>
            <Text style={styles.title}>Staff Portal</Text>
            <Text style={styles.subtitle}>Enter your credentials to access {schoolName}</Text>
          </Animatable.View>

          <Animatable.View animation="fadeInUp" duration={800} style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>EMAIL ADDRESS</Text>
              <TextInput
                style={styles.input}
                placeholder="staff@edueaz.com"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>PASSWORD</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!loading}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: primary, marginTop: 10 }]}
              onPress={handleStaffLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Secure Sign In</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/(auth)/token-reset")}
              style={styles.forgotBtn}
            >
              <Text style={styles.forgotText}>Forgot Password? (Use Reset Token)</Text>
            </TouchableOpacity>

            <View style={styles.infoBanner}>
                <SVGIcon name="information-circle" size={16} color="#64748B" />
                <Text style={styles.infoText}>
                    Non-teaching staff accounts are managed by the administration.
                </Text>
            </View>
          </Animatable.View>

          <TouchableOpacity
            onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace("/(auth)/login");
            }}
            style={styles.backBtn}
          >
            <Text style={styles.backText}>Go Back</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  scrollContent: { padding: 24, flexGrow: 1, justifyContent: 'center' },
  header: { marginBottom: 30, alignItems: 'center' },
  logoBadge: { width: 64, height: 64, borderRadius: 20, justifyContent: "center", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 28, fontWeight: "bold", color: "#0F172A" },
  subtitle: { fontSize: 16, color: "#64748B", marginTop: 4, textAlign: 'center' },
  card: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24, ...SHADOWS.medium, borderWidth: 1, borderColor: '#F1F5F9' },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 11, fontWeight: "800", color: "#475569", marginBottom: 8, letterSpacing: 1 },
  input: { backgroundColor: "#F1F5F9", borderRadius: 14, padding: 14, fontSize: 16, color: "#1E293B" },
  button: { padding: 18, borderRadius: 16, flexDirection: 'row', alignItems: "center", justifyContent: "center", ...SHADOWS.medium },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  infoBanner: { flexDirection: 'row', alignItems: 'center', marginTop: 20, gap: 8, paddingHorizontal: 10 },
  infoText: { fontSize: 12, color: "#64748B", flex: 1 },
  forgotBtn: { marginTop: 16, alignItems: 'center' },
  forgotText: { color: "#64748B", fontSize: 14, fontWeight: '500' },
  backBtn: { marginTop: 30, alignItems: 'center' },
  backText: { color: "#94A3B8", fontSize: 14, fontWeight: '600' }
});
