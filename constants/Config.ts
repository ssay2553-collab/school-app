import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect } from "react";

/**
 * Centralized branding configuration.
 */

const extra = Constants.expoConfig?.extra || {};
const schoolData = extra.schoolData || {};

const mapConfig = (id: string, data: any) => ({
  schoolId: id,
  name: data.name || data.schoolName || "School App",
  fullName: data.fullName || data.schoolFullName || "Educational Center",
  motto: data.motto || "",
  hotline: data.hotline || data.schoolHotline || "",
  address: data.address || data.schoolAddress || "",
  email: data.email || data.schoolEmail || "",

  primaryColor: data.primaryColor || "#2c0964",
  secondaryColor: data.secondaryColor || data.primaryColor || "#dd4364",
  surfaceColor: data.surfaceColor || "#dcabf3",
  brandPrimary: data.brandPrimary || data.primaryColor || "#cc315f",
  brandSecondary: data.brandSecondary || data.secondaryColor || data.primaryColor || "#140e53",

  firebase: data.firebase || {},
});

// BUILD_ID is what comes from your 'npm run' command / process.env.SCHOOL_ID
const BUILD_ID = extra.schoolId || "eagles";
export const SCHOOL_CONFIG = mapConfig(BUILD_ID, extra);

/**
 * Helper to get the current school ID.
 * Forces the build-time ID to win if it's explicitly set.
 */
export const getActiveSchoolId = async () => {
  if (__DEV__) {
    const override = await AsyncStorage.getItem("DEV_SCHOOL_ID");
    
    // If we have an override (like IBS) but it doesn't match the current build (like Beano),
    // we MUST clear it to fix the UI sync issue.
    if (override && override !== BUILD_ID) {
       console.log(`[Config] Syncing: Removing stale override '${override}' to use build '${BUILD_ID}'`);
       await AsyncStorage.removeItem("DEV_SCHOOL_ID");
       return BUILD_ID;
    }
    
    if (override) return override;
  }
  return BUILD_ID;
};

/**
 * Hook for dynamic configuration updates.
 * This will now force a reset if the internal screens don't match the App Title/Icon.
 */
export const useSchoolConfig = () => {
  const [config, setConfig] = useState(SCHOOL_CONFIG);

  useEffect(() => {
    const syncConfig = async () => {
      if (__DEV__) {
        const overrideId = await AsyncStorage.getItem("DEV_SCHOOL_ID");
        
        // AGGRESSIVE RESET: If the override exists but doesn't match the current build,
        // it means the user switched schools via script, so we clear the cache.
        if (overrideId && overrideId !== BUILD_ID) {
            await AsyncStorage.removeItem("DEV_SCHOOL_ID");
            setConfig(SCHOOL_CONFIG);
            return;
        }

        if (overrideId && schoolData[overrideId]) {
          setConfig(mapConfig(overrideId, schoolData[overrideId]));
        } else {
          setConfig(SCHOOL_CONFIG);
        }
      }
    };
    syncConfig();
  }, []);

  return config;
};
