import { useRouter } from "expo-router";
import { signInAnonymously } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
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
import { COLORS, SHADOWS } from "../../../constants/theme";
import { auth, db } from "../../../firebaseConfig";
import Constants from 'expo-constants';
import SVGIcon from "../../../components/SVGIcon";

export default function GuestSignup() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const schoolId = Constants.expoConfig?.extra?.schoolId || 'afahjoy';
  const isBeano = schoolId === 'beano';

  const handleGuestSignup = async () => {
    if (!fullName || !phone) {
      return Alert.alert("Required Information", "Please provide your name and phone number to continue.");
    }

    const phoneRegex = /^[0-9]{10,15}$/;
    if (!phoneRegex.test(phone.trim())) {
      return Alert.alert("Invalid Phone", "Please enter a valid phone number.");
    }

    setLoading(true);
    try {
      const userCredential = await signInAnonymously(auth);
      const userId = userCredential.user.uid;

      await setDoc(doc(db, "users", userId), {
        uid: userId,
        role: "guest",
        isAnonymous: true,
        profile: {
          fullName: fullName.trim(),
          phone: phone.trim(),
        },
        status: "active",
        createdAt: serverTimestamp(),
      });

      Alert.alert("Success", "Your guest profile has been created successfully.", [
        { text: "Go to Dashboard", onPress: () => router.replace("/guest-dashboard") }
      ]);
    } catch (err: any) {
      console.error("Guest Signup Error:", err);
      Alert.alert("Error", "Could not create guest account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, isBeano && { backgroundColor: '#FDF7FF' }]}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          <Animatable.View animation="fadeInDown" duration={800} style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
               <SVGIcon name="arrow-back" size={24} color={isBeano ? COLORS.primary : "#0F172A"} />
            </TouchableOpacity>
            <Text style={[styles.title, isBeano && { color: COLORS.primary }]}>Guest Registration</Text>
            <Text style={styles.subtitle}>Enter your details to register interest</Text>
          </Animatable.View>

          <Animatable.View animation="fadeInUp" duration={800} style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>FULL NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. John Doe"
                placeholderTextColor="#94A3B8"
                value={fullName}
                onChangeText={setFullName}
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

            <TouchableOpacity 
              style={[styles.button, { backgroundColor: COLORS.primary }, loading && { opacity: 0.7 }]} 
              onPress={handleGuestSignup} 
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.buttonText}>Register Details</Text>
                  <View style={{ marginLeft: 8 }}>
                    <SVGIcon name="person" size={18} color="#fff" />
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
                Already registered? <Text style={[styles.signupLink, { color: COLORS.primary }]}>Log In as Guest</Text>
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
  header: { marginBottom: 30, marginTop: 10, alignItems: 'center' },
  backBtn: { alignSelf: 'flex-start', marginBottom: 10 },
  title: { fontSize: 28, fontWeight: "bold", color: "#0F172A" },
  subtitle: { fontSize: 16, color: "#64748B", marginTop: 4, textAlign: 'center' },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 11, fontWeight: "800", color: "#475569", marginBottom: 8, letterSpacing: 1 },
  input: { backgroundColor: "#F1F5F9", borderRadius: 14, padding: 14, fontSize: 16, color: "#1E293B" },
  button: { padding: 18, borderRadius: 16, flexDirection: 'row', alignItems: "center", justifyContent: "center", marginTop: 10, ...SHADOWS.medium },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 25 },
  loginLinkBtn: { alignItems: 'center' },
  signupText: { color: "#64748B", fontSize: 14 },
  signupLink: { fontWeight: "bold" },
});
