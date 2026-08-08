import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  or,
} from "firebase/firestore";
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
import { db, functions } from "../../firebaseConfig";
import { useToast } from "../../contexts/ToastContext";
import { httpsCallable } from "firebase/functions";

export default function TokenResetScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const primary = SCHOOL_CONFIG.primaryColor || COLORS.primary || "#6366F1";
  const secondary = SCHOOL_CONFIG.secondaryColor || primary;

  const handleReset = async () => {
    if (!email.trim() || !token.trim() || !newPassword.trim()) {
      showToast({ message: "Please fill in all fields.", type: "error" });
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
      const cleanEmail = email.trim().toLowerCase();
      const cleanToken = token.trim().toUpperCase();

      // Find user by email
      const usersRef = collection(db, "users");
      const q = query(
        usersRef,
        or(
          where("profile.email", "==", cleanEmail),
          where("email", "==", cleanEmail)
        )
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        throw new Error("No user found with this email address.");
      }

      const userDoc = snap.docs[0];
      const userData = userDoc.data();

      // Verify token
      const storedToken = userData.signupCode || userData.secretCode;
      if (storedToken !== cleanToken) {
        throw new Error("Invalid reset token. Please contact your administrator.");
      }

      // Call Cloud Function to update password
      // Using the specialized token-based reset function which validates the token server-side
      const updatePasswordFn = httpsCallable(functions, "resetUserPasswordWithToken");
      await updatePasswordFn({
        uid: userDoc.id,
        token: cleanToken,
        newPassword: newPassword,
      });

      showToast({ message: "Password updated successfully!", type: "success" });
      router.replace("/(auth)/login/teacher"); // Default to teacher, user can navigate back
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
          behavior={Platform.OS === "ios" ? "padding" : undefined}
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
              <Text style={styles.title}>Secure Reset</Text>
              <Text style={styles.subtitle}>Reset your password using your admin-provided token</Text>
            </Animatable.View>

            <Animatable.View animation="fadeInUp" style={styles.card}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>EMAIL ADDRESS</Text>
                <TextInput
                  style={styles.input}
                  placeholder="your@email.com"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>RESET TOKEN (SIGNUP CODE)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. AB1234"
                  placeholderTextColor="#94A3B8"
                  value={token}
                  onChangeText={setToken}
                  autoCapitalize="characters"
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
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                    <SVGIcon name={showPassword ? "eye-off" : "eye"} size={22} color="#94A3B8" />
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
                />
              </View>

              <TouchableOpacity
                style={[styles.button, { backgroundColor: primary }]}
                onPress={handleReset}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Update Password</Text>}
              </TouchableOpacity>
            </Animatable.View>
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
  title: { fontSize: 32, fontWeight: "900", color: "#fff" },
  subtitle: { fontSize: 16, color: "rgba(255,255,255,0.8)", textAlign: "center", marginTop: 8 },
  card: { backgroundColor: "#fff", borderRadius: 24, padding: 24, ...SHADOWS.medium },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 11, fontWeight: "900", color: "#475569", marginBottom: 8, letterSpacing: 1 },
  input: { backgroundColor: "#F1F5F9", borderRadius: 14, padding: 14, fontSize: 16, color: "#1E293B" },
  passwordWrapper: { flexDirection: "row", alignItems: "center", backgroundColor: "#F1F5F9", borderRadius: 14 },
  passwordInput: { flex: 1, padding: 14, fontSize: 16, color: "#1E293B" },
  eyeIcon: { paddingHorizontal: 14 },
  button: { padding: 18, borderRadius: 16, alignItems: "center", marginTop: 10, ...SHADOWS.medium },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
