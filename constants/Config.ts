import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect } from "react";

/**
 * Centralized branding configuration.
 * Supports build-time injection (Production) and runtime switching (Dev).
 */

const extra = Constants.expoConfig?.extra || {};
const schoolData = extra.schoolData || {};

// Map a raw data object to the structured SCHOOL_CONFIG format
// This handles both the build-time 'extra' object keys and individual school object keys
const mapConfig = (id: string, data: any) => ({
  schoolId: id,
  name: data.name || Constants.expoConfig?.name || "School Management",
  fullName: data.fullName || data.schoolFullName || "EduEase School Management System",
  motto: data.motto || "",
  hotline: data.hotline || data.schoolHotline || "",
  address: data.address || data.schoolAddress || "",
  email: data.email || data.schoolEmail || "",

  // Brand Colors
  primaryColor: data.primaryColor || "#0F172A",
  secondaryColor: data.secondaryColor || data.primaryColor || "#64748B",
  surfaceColor: data.surfaceColor || "#F8FAFC",

  brandPrimary: data.brandPrimary || data.primaryColor || "#0F172A",
  brandSecondary: data.brandSecondary || data.secondaryColor || data.primaryColor || "#64748B",

  firebase: data.firebase || {},
});

// Initial config based on build-time injection
export const SCHOOL_CONFIG = mapConfig(extra.schoolId || "beano", extra);

/**
 * Helper to get the current school ID.
 * In __DEV__, it checks for an AsyncStorage override first.
 */
export const getActiveSchoolId = async () => {
  if (__DEV__) {
    const override = await AsyncStorage.getItem("DEV_SCHOOL_ID");
    if (override) return override;
  }
  return extra.schoolId || "beano";
};

/**
 * Hook for dynamic configuration updates in the UI.
 * In __DEV__, it will update if the school is switched via the Dev Hub.
 */
export const useSchoolConfig = () => {
  const [config, setConfig] = useState(SCHOOL_CONFIG);

  useEffect(() => {
    const loadOverride = async () => {
      if (__DEV__) {
        const overrideId = await AsyncStorage.getItem("DEV_SCHOOL_ID");
        if (overrideId && schoolData[overrideId]) {
          setConfig(mapConfig(overrideId, schoolData[overrideId]));
        } else {
            // If no override, ensure we are using the build-time default
            setConfig(mapConfig(extra.schoolId || "beano", extra));
        }
      }
    };
    loadOverride();
  }, []);

  return config;
};
