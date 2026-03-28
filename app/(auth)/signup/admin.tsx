import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
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
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../../constants/Config";
import { SHADOWS } from "../../../constants/theme";
import { auth, db } from "../../../firebaseConfig";

export default function AdminSignup() {
  const router = useRouter();

  const schoolName = Constants.expoConfig?.name || "School";
  const schoolEmail =
    Constants.expoConfig?.extra?.schoolEmail || "admin@school.com";

  const primary = SCHOOL_CONFIG.primaryColor;
  const surface = SCHOOL_CONFIG.surfaceColor;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<"Male" | "Female" | "">("");
  const [adminRole, setAdminRole] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const notify = (title: string, message: string) => {
    setErrorMessage(`${title}: ${message}`);
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        window.alert(`${title}\n\n${message}`);
      }
    } else {
      Alert.alert(title, message);
    }
  };

  const handleSignup = async () => {
    setErrorMessage(null);
    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !email.trim() ||
      !phone.trim() ||
      !gender ||
      !adminRole.trim() ||
      !password ||
      !confirmPassword
    ) {
      return notify("Missing Fields", "Please fill all required fields.");
    }

    if (password !== confirmPassword) {
      return notify("Error", "Passwords do not match.");
    }

    if (password.length < 6) {
      return notify("Security", "Password must be at least 6 characters.");
    }

    setLoading(true);
    try {
      // 1. Check Global Admin Limit (Max 4)
      const adminCountSnap = await getCountFromServer(
        collection(db, "adminRoles"),
      );
      if (adminCountSnap.data().count >= 4) {
        setLoading(false);
        return notify(
          "Limit Reached",
          "This school has reached the maximum number of administrator accounts (4).",
        );
      }

      // 2. Check Role Uniqueness (Case-Insensitive)
      const normalizedRole = adminRole.trim().toLowerCase();
      const roleRef = doc(db, "adminRoles", normalizedRole);
      const roleSnap = await getDoc(roleRef);
      if (roleSnap.exists()) {
        setLoading(false);
        return notify(
          "Role Taken",
          `The role "${adminRole}" is already assigned to another user.`,
        );
      }

      const cleanEmail = email.trim().toLowerCase();
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        password,
      );
      const userId = userCredential.user.uid;

      // Ensure the newly created user has a fresh ID token before making
      // Firestore writes that depend on request.auth in security rules.
      // Without this, Firestore may evaluate the write as unauthenticated
      // (race condition) and reject the creation of /users/{uid}.
      await userCredential.user.getIdToken(true);

      const batch = writeBatch(db);

      // Default permissions for Proprietor/Headmaster
      const isSuperAdmin = ["proprietor", "headmaster"].includes(
        normalizedRole,
      );
      const defaultPermission = isSuperAdmin ? "full" : "deny";

      // User Profile
      batch.set(doc(db, "users", userId), {
        uid: userId,
        role: "admin",
        profile: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: cleanEmail,
          phone: phone.trim(),
          gender: gender,
        },
        adminRole: adminRole.trim(),
        permissions: {
          "manage-fees": defaultPermission,
          "staff-payroll": defaultPermission,
          expenditure: defaultPermission,
          "manage-users": defaultPermission,
        },
        status: "active",
        createdAt: serverTimestamp(),
      });

      // Unique role check (using normalized ID)
      batch.set(roleRef, {
        uid: userId,
        roleName: normalizedRole,
        assignedAt: serverTimestamp(),
      });

      await batch.commit();

      notify("Success", "Administrative account created successfully.");
      setTimeout(() => {
        router.replace("/(auth)/login/admin");
      }, 1000);
    } catch (err: any) {
      let msg = err.message || "An unknown error occurred.";
      if (err.code === "auth/email-already-in-use") {
        msg = "This email is already registered.";
      }
      notify("Registration Failed", msg);
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
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Animatable.View
            animation="fadeInDown"
            duration={800}
            style={styles.header}
          >
            <Text style={styles.title}>{schoolName} Admin</Text>
            <Text style={styles.subtitle}>
              Register as a school administrator (Max 4)
            </Text>
          </Animatable.View>

          {errorMessage && (
            <Animatable.View animation="shake" style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </Animatable.View>
          )}

          <Animatable.View
            animation="fadeInUp"
            duration={800}
            style={styles.card}
          >
            <View style={styles.inputGroup}>
              <Text style={styles.label}>FIRST NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="John"
                placeholderTextColor="#94A3B8"
                value={firstName}
                onChangeText={setFirstName}
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>LAST NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="Doe"
                placeholderTextColor="#94A3B8"
                value={lastName}
                onChangeText={setLastName}
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>EMAIL ADDRESS</Text>
              <TextInput
                style={styles.input}
                placeholder={schoolEmail}
                placeholderTextColor="#94A3B8"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>PHONE NUMBER</Text>
              <TextInput
                style={styles.input}
                placeholder="024 XXX XXXX"
                placeholderTextColor="#94A3B8"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>GENDER</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={gender}
                  onValueChange={(val) => setGender(val)}
                  enabled={!loading}
                >
                  <Picker.Item label="Select Gender" value="" color="#94A3B8" />
                  <Picker.Item label="Male" value="Male" />
                  <Picker.Item label="Female" value="Female" />
                </Picker>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                OFFICIAL ROLE (e.g. Proprietor, Bursar)
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Type your role..."
                placeholderTextColor="#94A3B8"
                value={adminRole}
                onChangeText={setAdminRole}
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>PASSWORD</Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="••••••••"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={22}
                    color="#94A3B8"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>CONFIRM PASSWORD</Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="••••••••"
                  placeholderTextColor="#94A3B8"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  editable={!loading}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeIcon}
                >
                  <Ionicons
                    name={
                      showConfirmPassword ? "eye-off-outline" : "eye-outline"
                    }
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
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.buttonText}>Complete Registration</Text>
                  <SVGIcon
                    name="arrow-forward"
                    size={18}
                    color="#fff"
                    style={{ marginLeft: 8 }}
                  />
                </>
              )}
            </TouchableOpacity>
          </Animatable.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  scrollContent: { padding: 20 },
  header: { marginBottom: 30, alignItems: "center" },
  title: { fontSize: 28, fontWeight: "800", color: "#1E293B" },
  subtitle: { fontSize: 16, color: "#64748B", marginTop: 5 },
  errorBox: {
    backgroundColor: "#FEE2E2",
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#EF4444",
  },
  errorText: { color: "#991B1B", fontWeight: "600", fontSize: 14 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    ...SHADOWS.medium,
  },
  inputGroup: { marginBottom: 20 },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    marginBottom: 8,
    letterSpacing: 1,
  },
  input: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#1E293B",
  },
  pickerContainer: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    overflow: "hidden",
  },
  passwordWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
  },
  passwordInput: { flex: 1, padding: 16, fontSize: 16, color: "#1E293B" },
  eyeIcon: { padding: 10 },
  button: {
    height: 60,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "700" },
});
