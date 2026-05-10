import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { signInWithCustomToken } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
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
import { COLORS, SHADOWS } from "../../../constants/theme";
import { useToast } from "../../../contexts/ToastContext";
import { auth, db, functions } from "../../../firebaseConfig";

export default function GuestSignup() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const schoolId = Constants.expoConfig?.extra?.schoolId || "afahjoy";
  const isBeano = schoolId === "beano";

  const handleStaffSignup = async () => {
    if (!username.trim() || pin.length !== 4) {
      showToast({
        message: "Please enter a valid username and 4-digit PIN.",
        type: "error",
      });
      return;
    }

    setLoading(true);
    try {
      // First, verify the staff document exists with matching credentials
      const q = query(
        collection(db, "users"),
        where("username", "==", username.trim().toLowerCase()),
        where("role", "==", "staff"),
        where("schoolId", "==", schoolId),
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setLoading(false);
        showToast({
          message:
            "No staff account found with this username. Please contact your administrator.",
          type: "error",
        });
        return;
      }

      let staffDoc = null;
      let staffData = null;

      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data.pin === pin) {
          staffDoc = doc;
          staffData = data;
          break;
        }
      }

      if (!staffDoc || !staffData) {
        setLoading(false);
        showToast({
          message:
            "Incorrect PIN. Please try again or contact your administrator.",
          type: "error",
        });
        return;
      }

      // Check if staff account has login enabled
      if (!staffData.hasLoginEnabled) {
        setLoading(false);
        showToast({
          message:
            "Your account is not yet enabled for login. Please contact your administrator.",
          type: "error",
        });
        return;
      }

      // Use the loginWithPin cloud function to authenticate
      const loginWithPin = httpsCallable(functions, "loginWithPin");
      const result = await loginWithPin({ username: username.trim(), pin });
      const { token } = result.data as { token: string };

      if (token) {
        await signInWithCustomToken(auth, token);
        showToast({
          message: `Welcome, ${staffData.profile?.firstName || "Staff Member"}!`,
          type: "success",
        });
        router.replace("/guest-dashboard");
      }
    } catch (err: any) {
      console.error("Staff Signup Error:", err);
      showToast({
        message:
          err.message || "Could not verify credentials. Please try again.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, isBeano && { backgroundColor: "#FDF7FF" }]}
    >
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Animatable.View
            animation="fadeInDown"
            duration={800}
            style={styles.header}
          >
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
            >
              <SVGIcon
                name="arrow-back"
                size={24}
                color={isBeano ? COLORS.primary : "#0F172A"}
              />
            </TouchableOpacity>
            <View
              style={[
                styles.iconBadge,
                {
                  backgroundColor: isBeano
                    ? COLORS.primary + "15"
                    : COLORS.primary + "15",
                },
              ]}
            >
              <SVGIcon
                name="briefcase"
                size={32}
                color={isBeano ? COLORS.primary : COLORS.primary}
              />
            </View>
            <Text style={[styles.title, isBeano && { color: COLORS.primary }]}>
              Staff Access
            </Text>
            <Text style={styles.subtitle}>
              Non-teaching staff sign in with credentials
            </Text>
          </Animatable.View>

          <Animatable.View
            animation="fadeInUp"
            duration={800}
            style={styles.card}
          >
            <View style={styles.infoBanner}>
              <SVGIcon
                name="information-circle"
                size={20}
                color={COLORS.primary}
              />
              <Text style={styles.infoBannerText}>
                Your administrator should have provided you with a username and
                PIN. Enter them below to access the staff portal.
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>USERNAME</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. j.doe"
                placeholderTextColor="#94A3B8"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>4-DIGIT PIN</Text>
              <TextInput
                style={styles.input}
                placeholder="••••"
                placeholderTextColor="#94A3B8"
                value={pin}
                onChangeText={(v) =>
                  setPin(v.replace(/[^0-9]/g, "").slice(0, 4))
                }
                keyboardType="number-pad"
                secureTextEntry
                editable={!loading}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: COLORS.primary },
                loading && { opacity: 0.7 },
              ]}
              onPress={handleStaffSignup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.buttonText}>Sign In</Text>
                  <View style={{ marginLeft: 8 }}>
                    <SVGIcon name="log-in" size={18} color="#fff" />
                  </View>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              onPress={() => router.push("/(auth)/login/guest")}
              style={styles.loginLinkBtn}
            >
              <Text style={styles.signupText}>
                Not a staff member?{" "}
                <Text style={[styles.signupLink, { color: COLORS.primary }]}>
                  Guest Access
                </Text>
              </Text>
            </TouchableOpacity>
          </Animatable.View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  container: { flex: 1 },
  scrollContent: { padding: 24 },
  header: { marginBottom: 30, marginTop: 10, alignItems: "center" },
  backBtn: { alignSelf: "flex-start", marginBottom: 10 },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: { fontSize: 28, fontWeight: "bold", color: "#0F172A" },
  subtitle: {
    fontSize: 16,
    color: "#64748B",
    marginTop: 4,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: COLORS.primary + "10",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 10,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: "#475569",
    lineHeight: 20,
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
  button: {
    padding: 18,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    ...SHADOWS.medium,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  divider: { height: 1, backgroundColor: "#F1F5F9", marginVertical: 25 },
  loginLinkBtn: { alignItems: "center" },
  signupText: { color: "#64748B", fontSize: 14 },
  signupLink: { fontWeight: "bold" },
});
