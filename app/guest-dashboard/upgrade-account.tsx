import { useRouter } from "expo-router";
import React from "react";
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { COLORS, SIZES } from "../../constants/theme";

export default function UpgradeAccountScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upgrade Account</Text>
      <Text style={styles.subtitle}>
        Choose your permanent role to complete registration.
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/(auth)/signup/parent")}
      >
        <Text style={styles.buttonText}>Upgrade to Parent</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/(auth)/signup/student")}
      >
        <Text style={styles.buttonText}>Upgrade to Student</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: COLORS.secondary }]}
        onPress={() => router.push("/(auth)/signup/teacher")}
      >
        <Text style={styles.buttonText}>Upgrade to Teacher</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => router.back()}
      >
        <Text style={styles.backText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: SIZES.extraLarge,
    fontWeight: "bold",
    color: COLORS.primary,
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: SIZES.medium,
    color: COLORS.gray,
    marginBottom: 30,
    textAlign: "center",
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 15,
  },
  buttonText: {
    color: "#fff",
    fontSize: SIZES.medium,
    fontWeight: "600",
  },
  backButton: {
    marginTop: 10,
    alignItems: "center",
  },
  backText: {
    color: COLORS.gray,
    fontSize: SIZES.medium,
  },
});
