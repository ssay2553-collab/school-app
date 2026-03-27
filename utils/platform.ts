import { Platform } from "react-native";

export const isWeb = Platform.OS === "web";
export const isIOS = Platform.OS === "ios";
export const isAndroid = Platform.OS === "android";
export const isNative = isIOS || isAndroid;
export const isElectron =
  typeof navigator !== "undefined" &&
  /Electron/.test(navigator.userAgent || "");

export default {
  isWeb,
  isIOS,
  isAndroid,
  isNative,
  isElectron,
};
