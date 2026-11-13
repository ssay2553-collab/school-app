import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Stack,
  useRootNavigationState,
  useRouter,
  useSegments,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import * as Notifications from "expo-notifications";

import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { ThemeProvider } from "../contexts/ThemeContext";
import { ToastProvider } from "../contexts/ToastContext";
import { AcademicProvider } from "../contexts/AcademicContext";

import DevSchoolSwitcher from "./DevSchoolSwitcher";
import { PWAInstallPrompt } from "../components/PWAInstallPrompt";
import { GlobalNotificationListener } from "../components/GlobalNotificationListener";
import { auth } from "../firebaseConfig";

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
    const isLanding =
      !segment ||
      segment === "index" ||
      segment === "" ||
      segment === "(index)";
    const inAuthGroup = segment === "(auth)";
    const isAbout = segment === "about";

    if (!appUser && !isLanding && !inAuthGroup && !isAbout) {
      router.replace("/");
    }

    if (appUser && inAuthGroup) {
      const role = (appUser.role || "").toLowerCase();
      const adminRole = (appUser.adminRole || "").toLowerCase();

      const isAdmin = role.includes("admin") || adminRole !== "";
      const isTeacher =
        role === "teacher" ||
        role === "staff" ||
        (appUser.classes || []).length > 0 ||
        (appUser.subjects || []).length > 0;
      const isParent = role === "parent";
      const isStudent = role === "student";

      if (isAdmin) {
        router.replace("/admin-dashboard");
      } else if (isTeacher) {
        router.replace("/teacher-dashboard");
      } else if (isStudent) {
        router.replace("/student-dashboard");
      } else if (isParent) {
        router.replace("/parent-dashboard");
      } else {
        // Invalid or missing role while in auth group -> sign out so user can log in/sign up without looping
        auth.signOut().catch(() => {});
      }
    }
  }, [appUser, loading, segments, navigationState?.key]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: "Welcome" }} />
      <Stack.Screen name="(auth)" options={{ title: "Authentication" }} />
      <Stack.Screen
        name="admin-dashboard"
        options={{ title: "Admin Portal" }}
      />
      <Stack.Screen
        name="teacher-dashboard"
        options={{ title: "Teacher Portal" }}
      />
      <Stack.Screen
        name="student-dashboard"
        options={{ title: "Student Portal" }}
      />
      <Stack.Screen
        name="parent-dashboard"
        options={{ title: "Parent Portal" }}
      />
      <Stack.Screen
        name="staff-dashboard"
        options={{ title: "Staff Portal" }}
      />
      <Stack.Screen
        name="shared/web-view"
        options={{ title: "Web Content", presentation: "modal" }}
      />
      <Stack.Screen name="modal" options={{ presentation: "modal" }} />
      <Stack.Screen name="+not-found" options={{ title: "Not Found" }} />
    </Stack>
  );
}

function MainLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Register Service Worker for PWA updates
    if (Platform.OS === "web" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/service-worker.js")
          .then((registration) => {
            console.log("SW registered: ", registration);

            // Check for updates on page load/access
            registration.update();

            registration.onupdatefound = () => {
              const installingWorker = registration.installing;
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (
                    installingWorker.state === "installed" &&
                    navigator.serviceWorker.controller
                  ) {
                    // New content is available; skip waiting and refresh.
                    console.log("New content is available; skipping waiting...");
                    if (registration.waiting) {
                      registration.waiting.postMessage({
                        type: "SKIP_WAITING",
                      });
                    }
                    window.location.reload();
                  }
                };
              }
            };
          })
          .catch((registrationError) => {
            console.log("SW registration failed: ", registrationError);
          });

        // Register Firebase Messaging Service Worker for PWA background notifications
        navigator.serviceWorker
          .register("/firebase-messaging-sw.js", { scope: "/" })
          .then((fcmReg) => {
            console.log("FCM SW registered: ", fcmReg.scope);
          })
          .catch((err) => {
            console.log("FCM SW registration failed: ", err);
          });
      });
    }

    const init = async () => {
      // NUCLEAR RESET: Run this once to clear the IBS stickiness
      if (__DEV__) {
        console.log(
          "[System] Performing memory reset to clear old school data...",
        );
        await AsyncStorage.removeItem("DEV_SCHOOL_ID");
      }

      // Extended splash time to 3 seconds
      setTimeout(() => setReady(true), 3000);
    };
    init();
  }, []);

  if (!ready) return <SplashScreen />;

  return (
    <>
      <StatusBar style="dark" />
      <RouteGuard />
      <DevSchoolSwitcher />
      <PWAInstallPrompt />
      <GlobalNotificationListener />
    </>
  );
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[System Error Boundary Caught]:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Something went wrong ⚠️</Text>
          <Text style={styles.errorSubtitle}>
            {this.state.error?.message || "An unexpected system error occurred."}
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={styles.retryBtnText}>Reload App 🔄</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function Layout() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <GestureHandlerRootView style={styles.root}>
          <AuthProvider>
            <AcademicProvider>
              <ThemeProvider>
                <ToastProvider>
                  <MainLayout />
                </ToastProvider>
              </ThemeProvider>
            </AcademicProvider>
          </AuthProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#fff",
  },
  splashContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  splashImage: {
    width: "70%",
    height: "70%",
  },
  errorContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 24,
  },
  retryBtn: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryBtnText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
});
