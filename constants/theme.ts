// constants/theme.ts

import Constants from "expo-constants";
import { Platform } from "react-native";

/* -----------------------------------------------------
   DYNAMIC BRAND COLORS
----------------------------------------------------- */
const primaryColor = Constants.expoConfig?.extra?.primaryColor || "#2e86de";
const secondaryColor =
  Constants.expoConfig?.extra?.secondaryColor || "#c53b59ff";
const brandPrimary = Constants.expoConfig?.extra?.brandPrimary || primaryColor;
const brandSecondary =
  Constants.expoConfig?.extra?.brandSecondary || secondaryColor;
const surfaceColor = Constants.expoConfig?.extra?.surfaceColor || "#fefefe";

/* -----------------------------------------------------
   SHADOWS
----------------------------------------------------- */
export const SHADOWS = {
  light: Platform.select({
    web: { boxShadow: "0 1px 2px rgba(0,0,0,0.05)" },
    default: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    }
  }) as any,
  small: Platform.select({
    web: { boxShadow: "0 2px 3px rgba(0,0,0,0.1)" },
    default: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 2,
    }
  }) as any,
  medium: Platform.select({
    web: { boxShadow: "0 4px 6px rgba(0,0,0,0.1)" },
    default: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
      elevation: 3,
    }
  }) as any,
  large: Platform.select({
    web: { boxShadow: "0 6px 8px rgba(0,0,0,0.15)" },
    default: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 5,
    }
  }) as any,
};

/* -----------------------------------------------------
   PALETTE
----------------------------------------------------- */
const highlightColor = "#f1c40f";
const accentColor = "#c74a31";
const greenColor = "#05ac5b";
const purpleColor = "#6d28d9";
const darkColor = "#0f1314";
const tertiaryColor = "#5bc0de";
const orangeColor = "#f0ad4e";
const blueColor = "#0275d8";
const yellowColor = "#ffd700";

/* -----------------------------------------------------
   LIGHT / DARK THEMES
----------------------------------------------------- */
export const Colors: Record<"light" | "dark", any> = {
  light: {
    text: "#1f2937",
    background: surfaceColor,
    backgroundPrimary: surfaceColor,
    backgroundSecondary: surfaceColor,
    card: "#ffffff",
    inputBackground: "#ffffff",
    border: "#d1d5db",
    primary: primaryColor,
    secondary: secondaryColor,
    brandPrimary: brandPrimary,
    brandSecondary: brandSecondary,
    surface: surfaceColor,
    tertiary: tertiaryColor,
    accent: accentColor,
    highlight: highlightColor,
    green: greenColor,
    purple: purpleColor,
    dark: darkColor,
    orange: orangeColor,
    blue: blueColor,
    yellow: yellowColor,
    gray: "#9ca3af",
    darkGray: "#4b5563",
    lightGray: "#e5e7eb",
    white: "#ffffff",
    black: "#000000",
    success: greenColor,
    danger: "#c74a31",
  },
  dark: {
    text: "#f3f4f6",
    background: "#0f1314",
    backgroundPrimary: "#1a1a1a",
    backgroundSecondary: "#121212",
    card: "#1f1f1f",
    inputBackground: "#1a1a1a",
    border: "#374151",
    primary: primaryColor,
    secondary: secondaryColor,
    brandPrimary: brandPrimary,
    brandSecondary: brandSecondary,
    surface: "#0f1314",
    tertiary: "#4db8da",
    accent: "#c74a31",
    highlight: "#f1c40f",
    green: "#22c55e",
    purple: "#611efcff",
    dark: "#000000",
    orange: "#ec9a29",
    blue: "#2a9df4",
    yellow: "#ffc300",
    gray: "#6b7280",
    darkGray: "#d1d5db",
    lightGray: "#374151",
    white: "#ffffff",
    black: "#000000",
    success: "#22c55e",
    danger: "#fb7185",
  },
};

export const COLORS = {
  ...Colors.light,
};

/* -----------------------------------------------------
   FONT CONFIG
----------------------------------------------------- */
const professionalFontStack = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export const FONTS = Platform.select({
  web: {
    sans: { regular: professionalFontStack, bold: professionalFontStack },
    body: professionalFontStack,
    heading: professionalFontStack,
  },
  ios: {
    sans: { regular: "System", bold: "System-Bold" },
    body: "System",
    heading: "System-Bold",
  },
  android: {
    sans: { regular: "normal", bold: "bold" },
    body: "normal",
    heading: "bold",
  },
  default: {
    sans: { regular: "normal", bold: "bold" },
    body: "normal",
    heading: "bold",
  },
});

// Backwards-compatible alias expected by some files
export const Fonts = {
  // spread the FONTS object (it may be platform-specific)
  ...(FONTS as any),
  // common convenience families used across the app
  rounded:
    (FONTS as any)?.sans?.regular ??
    Platform.select({ ios: "System", android: "normal", default: "System" }),
  mono: Platform.select({
    ios: "Menlo",
    android: "monospace",
    default: "monospace",
  }),
};

/* -----------------------------------------------------
   SIZES
----------------------------------------------------- */
export const SIZES = {
  base: 8,
  small: 12,
  medium: 16,
  large: 20,
  xLarge: 24,
  extraLarge: 28,
  padding: 16,
  radius: 12,
  // common heading / body sizes referenced in components
  h1: 30,
  h2: 24,
  h3: 20,
  body1: 16,
  body2: 14,
  body3: 12,
  body4: 11,
  body5: 10,
};

// Type exported for ThemeContext and consumers
export type ThemeColors = typeof Colors.light;

const theme = {
  COLORS,
  SIZES,
  FONTS,
  SHADOWS,
};

export default theme;
