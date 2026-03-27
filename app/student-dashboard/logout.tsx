import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { COLORS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";

export default function StudentDashboardLayout() {
  const { appUser, loading } = useAuth();
  const router = useRouter();

  // 🔐 Protect student routes
  useEffect(() => {
    if (!loading) {
      if (!appUser) {
        router.replace("/(auth)/login");
      } else if (appUser.role !== "student") {
        router.replace("/(auth)/login");
      }
    }
  }, [appUser, loading, router]); // ✅ added router as dependency

  // ⏳ Loading state
  if (loading || !appUser) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: COLORS.background,
        }}
      >
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="assignments" />
      <Stack.Screen name="submit-assignment" />
      <Stack.Screen name="StudentGroups" />
      <Stack.Screen name="group-chat" />
      <Stack.Screen name="NewsScreen" />
      <Stack.Screen name="note" />
      <Stack.Screen name="games" />
      <Stack.Screen name="search" />
      <Stack.Screen name="upgrade" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}
