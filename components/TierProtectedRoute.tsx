import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import SVGIcon from "./SVGIcon";
import { useAcademicConfig } from "../hooks/useAcademicConfig";
import { isFeatureEnabled } from "../constants/tierPermissions";
import { SCHOOL_CONFIG } from "../constants/Config";

interface TierProtectedRouteProps {
  featureId: string;
  children: React.ReactNode;
}

export const TierProtectedRoute: React.FC<TierProtectedRouteProps> = ({ featureId, children }) => {
  const acadConfig = useAcademicConfig();
  const router = useRouter();

  if (acadConfig.loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={SCHOOL_CONFIG.primaryColor || "#6366F1"} />
      </View>
    );
  }

  if (!isFeatureEnabled(acadConfig.category, featureId)) {
    const categoryName = (acadConfig.category || "CORE").toUpperCase();

    return (
      <SafeAreaView style={styles.center}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <SVGIcon name="lock-closed" size={36} color="#EF4444" />
          </View>
          <Text style={styles.title}>Feature Restricted</Text>
          <Text style={styles.message}>
            This feature is not included in your school's current plan ({categoryName}). Please contact your school administrator to upgrade access.
          </Text>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/");
              }
            }}
          >
            <SVGIcon name="arrow-back" size={18} color="#fff" />
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FDFCF0",
    padding: 24,
  },
  card: {
    alignItems: "center",
    maxWidth: 380,
    backgroundColor: "#ffffff",
    padding: 28,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FEF2F2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1E293B",
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  backBtn: {
    backgroundColor: SCHOOL_CONFIG.primaryColor || "#6366F1",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
  },
});
