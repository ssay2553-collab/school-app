import { useRouter } from "expo-router";
import { sendPasswordResetEmail } from "firebase/auth";
import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import * as Animatable from "react-native-animatable";
import { COLORS, SIZES } from "../../constants/theme";
import { auth } from "../../firebaseConfig";
import { useToast } from "../../contexts/ToastContext";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const handleResetPassword = async () => {
    if (!email.trim()) {
      showToast({ message: "Please enter your email address.", type: "error" });
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      showToast({ message: "A link to reset your password has been sent to your email address.", type: "success" });
      router.back();
    } catch (error: any) {
      console.error(error);
      showToast({ message: error.message || "Could not send reset email.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
        <Animatable.View animation="fadeInDown" style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
                <Text style={styles.backButton}>Back to Login</Text>
            </TouchableOpacity>
        </Animatable.View>

        <View style={styles.content}>
            <Text style={styles.title}>Forgot Your Password?</Text>
            <Text style={styles.subtitle}>
                No problem! Enter your email below and we will send you a link to reset it.
            </Text>

            <TextInput
                style={styles.input}
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor={COLORS.gray}
            />

            <TouchableOpacity
                style={styles.button}
                onPress={handleResetPassword}
                disabled={loading}
            >
                {loading ? (
                <ActivityIndicator color={COLORS.white} />
                ) : (
                <Text style={styles.buttonText}>Reset Password</Text>
                )}
            </TouchableOpacity>
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 20,
  },
  header: {
    position: 'absolute',
    top: 50,
    left: 20,
  },
  backButton: {
      color: COLORS.primary,
      fontSize: SIZES.medium
  },
  content: {
      flex: 1,
      justifyContent: 'center',
  },
  title: {
    fontSize: SIZES.extraLarge,
    fontWeight: "bold",
    color: COLORS.primary,
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: SIZES.medium,
    color: COLORS.gray,
    textAlign: "center",
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  input: {
    height: 50,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 20,
    backgroundColor: COLORS.white,
  },
  button: {
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: {
    color: COLORS.white,
    fontWeight: "bold",
    fontSize: SIZES.medium,
  },
});
