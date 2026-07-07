import { useRouter } from "expo-router";
import { signInWithCustomToken } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
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
import SVGIcon from "../../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../../constants/Config";
import { SHADOWS } from "../../../constants/theme";
import { useToast } from "../../../contexts/ToastContext";
import { auth, db, functions } from "../../../firebaseConfig";

export default function GuestLogin() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const { showToast } = useToast();
  const schoolName = SCHOOL_CONFIG.name;
  const primary = SCHOOL_CONFIG.primaryColor;
  const surface = SCHOOL_CONFIG.surfaceColor;

  const handleGuestLogin = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;

      if (!user) {
        showToast({ message: "Please register your details first to explore as a guest.", type: "error" });
        router.push("/(auth)/signup/guest");
        return;
      }

      // Check if a guest document exists in Firestore for this UID
      const userDoc = await getDoc(doc(db, "users", user.uid));
      
      if (userDoc.exists() && (userDoc.data().role === "guest" || userDoc.data().role === "applicant")) {
        router.replace("/guest-dashboard");
      } else {
        showToast({ message: "You are signed in but haven't registered your guest info yet.", type: "error" });
        router.push("/(auth)/signup/guest");
      }
    } catch (err) {
      console.error("Guest Login Error:", err);
      showToast({ message: "An unexpected error occurred. Please try again.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: surface }]}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topHeader}>
            <TouchableOpacity
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace("/(auth)/login");
              }}
              style={styles.backBtnCircle}
            >
              <SVGIcon name="arrow-back" size={24} color={primary} />
            </TouchableOpacity>
          </View>

          <Animatable.View animation="fadeInDown" duration={800} style={styles.header}>
            <View style={[styles.logoBadge, { backgroundColor: primary + '15' }]}>
              <SVGIcon name="flash" size={32} color={primary} />
            </View>
            <Text style={styles.title}>Guest Access</Text>
            <Text style={styles.subtitle}>Welcome to {schoolName}</Text>
          </Animatable.View>

          <Animatable.View animation="fadeInUp" duration={800} style={styles.card}>
            <Text style={styles.infoText}>
              Explore our campus features, admission details, and school information as a guest.
            </Text>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: primary }]}
              onPress={handleGuestLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.buttonText}>Enter Guest Portal</Text>
                  <View style={{ marginLeft: 8 }}>
                    <SVGIcon name="arrow-forward" size={20} color="#fff" />
                  </View>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/(auth)/signup/guest")}
              style={styles.signupBtn}
            >
              <Text style={styles.signupText}>
                New visitor? <Text style={[styles.signupLink, { color: primary }]}>Register here</Text>
              </Text>
            </TouchableOpacity>
          </Animatable.View>

            <TouchableOpacity
              onPress={() => router.replace("/")}
              style={styles.backBtn}
            >
              <Text style={styles.backText}>Return to Home</Text>
            </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  scrollContent: { padding: 24, flexGrow: 1 },
  topHeader: {
    paddingBottom: 20,
    flexDirection: 'row',
  },
  backBtnCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: { marginBottom: 20, alignItems: 'center' },
  logoBadge: { width: 64, height: 64, borderRadius: 20, justifyContent: "center", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 28, fontWeight: "bold", color: "#0F172A" },
  subtitle: { fontSize: 16, color: "#64748B", marginTop: 4 },
  tabContainer: { flexDirection: 'row', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabText: { fontSize: 14, color: '#94A3B8', fontWeight: '500' },
  card: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24, ...SHADOWS.medium, borderWidth: 1, borderColor: '#F1F5F9' },
  infoText: { fontSize: 15, color: "#475569", textAlign: 'center', lineHeight: 22, marginBottom: 30 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 11, fontWeight: "800", color: "#475569", marginBottom: 8, letterSpacing: 1 },
  input: { backgroundColor: "#F1F5F9", borderRadius: 14, padding: 14, fontSize: 16, color: "#1E293B" },
  button: { padding: 18, borderRadius: 16, flexDirection: 'row', alignItems: "center", justifyContent: "center", ...SHADOWS.medium },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  signupBtn: { marginTop: 25, alignItems: 'center' },
  signupText: { color: "#64748B", fontSize: 14 },
  signupLink: { fontWeight: "bold" },
  backBtn: { marginTop: 30, alignItems: 'center' },
  backText: { color: "#94A3B8", fontSize: 14, fontWeight: '600' }
});
