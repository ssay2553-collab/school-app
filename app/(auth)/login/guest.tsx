import { useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import { SHADOWS } from "../../../constants/theme";
import { auth, db } from "../../../firebaseConfig";
import { SCHOOL_CONFIG } from "../../../constants/Config";
import SVGIcon from "../../../components/SVGIcon";

export default function GuestLogin() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const schoolName = SCHOOL_CONFIG.name;
  const primary = SCHOOL_CONFIG.primaryColor;
  const surface = SCHOOL_CONFIG.surfaceColor;

  const handleGuestLogin = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;

      if (!user) {
        Alert.alert(
          "No Session Found", 
          "Please register your details first to explore as a guest.",
          [{ text: "Go to Signup", onPress: () => router.push("/(auth)/signup/guest") }]
        );
        setLoading(false);
        return;
      }

      // Check if a guest document exists in Firestore for this UID
      const userDoc = await getDoc(doc(db, "users", user.uid));
      
      if (userDoc.exists() && userDoc.data().role === "guest") {
        router.replace("/guest-dashboard");
      } else {
        Alert.alert(
          "Profile Missing", 
          "You are signed in but haven't registered your guest info yet.",
          [{ text: "Register Info", onPress: () => router.push("/(auth)/signup/guest") }]
        );
      }
    } catch (err) {
      console.error("Guest Login Error:", err);
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
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
              <SVGIcon name="flash" size={32} color={primary} />
            </View>
            <Text style={styles.title}>Guest Access</Text>
            <Text style={styles.subtitle}>Enter the {schoolName} portal</Text>
          </Animatable.View>

          <Animatable.View animation="fadeInUp" duration={800} style={styles.card}>
            <Text style={styles.infoText}>
              If you have already registered your name and phone number, you can proceed to the dashboard.
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
                  <Text style={styles.buttonText}>Enter Dashboard</Text>
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
                Need to register? <Text style={[styles.signupLink, { color: primary }]}>Sign Up</Text>
              </Text>
            </TouchableOpacity>
          </Animatable.View>

          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
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
  header: { marginBottom: 40, alignItems: 'center' },
  logoBadge: { width: 64, height: 64, borderRadius: 20, justifyContent: "center", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 28, fontWeight: "bold", color: "#0F172A" },
  subtitle: { fontSize: 16, color: "#64748B", marginTop: 4 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24, ...SHADOWS.medium, borderWidth: 1, borderColor: '#F1F5F9' },
  infoText: { fontSize: 15, color: "#475569", textAlign: 'center', lineHeight: 22, marginBottom: 30 },
  button: { padding: 18, borderRadius: 16, flexDirection: 'row', alignItems: "center", justifyContent: "center", ...SHADOWS.medium },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  signupBtn: { marginTop: 25, alignItems: 'center' },
  signupText: { color: "#64748B", fontSize: 14 },
  signupLink: { fontWeight: "bold" },
  backBtn: { marginTop: 30, alignItems: 'center' },
  backText: { color: "#94A3B8", fontSize: 14, fontWeight: '600' }
});
