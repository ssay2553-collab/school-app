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
  name: data.name || Constants.expoConfig?.name || "Adehyeemba",
  fullName: data.fullName || data.schoolFullName || "Adehyeemba Preparatory School",
  motto: data.motto || "Edwumaden Ho Wo Mfaso",
  hotline: data.hotline || data.schoolHotline || "+233545404397",
  address: data.address || data.schoolAddress || "Awutu Bawjiase",
  email: data.email || data.schoolEmail || "",

  // Brand Colors
  primaryColor: data.primaryColor || "#2c0964",
  secondaryColor: data.secondaryColor || data.primaryColor || "#dd4364",
  surfaceColor: data.surfaceColor || "#dcabf3",

  brandPrimary: data.brandPrimary || data.primaryColor || "#cc315f",
  brandSecondary: data.brandSecondary || data.secondaryColor || data.primaryColor || "#140e53",

  firebase: data.firebase || {},
});

// Initial config based on build-time injection
export const SCHOOL_CONFIG = mapConfig(extra.schoolId || "eagles", extra);

/**
 * Helper to get the current school ID.
 * In __DEV__, it checks for an AsyncStorage override first.
 */
export const getActiveSchoolId = async () => {
  if (__DEV__) {
    const override = await AsyncStorage.getItem("DEV_SCHOOL_ID");
    if (override) return override;
  }
  return extra.schoolId || "eagles";
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
            setConfig(mapConfig(extra.schoolId || "eagles", extra));
        }
      }
    };
    loadOverride();
  }, []);

  return config;
};
