import { Stack, useRouter, useSegments, useRootNavigationState } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Image, Platform, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import * as Notifications from "expo-notifications";

import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { ThemeProvider, useTheme } from "../contexts/ThemeContext";

import DevSchoolSwitcher from "./DevSchoolSwitcher";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

function SplashScreen() {
  return (
    <View style={styles.splashContainer}>
      <Image
        source={require("../assets/brand.png")}
        style={styles.splashImage}
        resizeMode="contain"
      />
    </View>
  );
}

function RouteGuard() {
  const { appUser, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (!navigationState?.key || loading) return;

    const segment = segments?.[0];
    const isLanding = !segment || segment === "index" || segment === "" || segment === "(index)";
    const inAuthGroup = segment === "(auth)";

    if (!appUser && !isLanding && !inAuthGroup) {
      router.replace("/");
    }

    if (appUser && inAuthGroup) {
        switch (appUser.role) {
          case "admin": router.replace("/admin-dashboard"); break;
          case "teacher": router.replace("/teacher-dashboard"); break;
          case "student": router.replace("/student-dashboard"); break;
          case "parent": router.replace("/parent-dashboard"); break;
          case "guest": router.replace("/guest-dashboard"); break;
          default: router.replace("/");
        }
    }
  }, [appUser, loading, segments, navigationState?.key]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: "Welcome" }} />
      <Stack.Screen name="(auth)" options={{ title: "Authentication" }} />
      <Stack.Screen name="admin-dashboard" options={{ title: "Admin Portal" }} />
      <Stack.Screen name="teacher-dashboard" options={{ title: "Teacher Portal" }} />
      <Stack.Screen name="student-dashboard" options={{ title: "Student Portal" }} />
      <Stack.Screen name="parent-dashboard" options={{ title: "Parent Portal" }} />
      <Stack.Screen name="guest-dashboard" options={{ title: "Guest Portal" }} />
      <Stack.Screen name="modal" options={{ presentation: "modal" }} />
      <Stack.Screen name="+not-found" options={{ title: "Not Found" }} />
    </Stack>
  );
}

function MainLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Extended splash time to 3 seconds
    const timer = setTimeout(() => setReady(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (!ready) return <SplashScreen />;

  return (
    <>
      <StatusBar style="dark" />
      <RouteGuard />
      {/* Dev Switcher is hidden internally in non-dev builds */}
      <DevSchoolSwitcher />
    </>
  );
}

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#fff" }}>
      <AuthProvider>
        <ThemeProvider>
          <MainLayout />
        </ThemeProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splashContainer: { flex: 1, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center" },
  splashImage: { width: "70%", height: "70%" },
});
