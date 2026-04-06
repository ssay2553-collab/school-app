import * as ExpoClipboard from "expo-clipboard";
import { Platform } from "react-native";

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (Platform.OS === "web") {
      // Prefer modern async clipboard API
      const nav: any = typeof navigator !== "undefined" ? navigator : null;
      if (
        nav &&
        nav.clipboard &&
        typeof nav.clipboard.writeText === "function"
      ) {
        await nav.clipboard.writeText(text);
        return true;
      }

      // Fallback for older browsers
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "");
      el.style.position = "absolute";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return !!ok;
    }

    // Native platforms (iOS / Android / Windows / macOS / Electron) - use expo-clipboard
    await ExpoClipboard.setStringAsync(text);
    return true;
  } catch (err) {
    console.warn("copyToClipboard failed:", err);
    return false;
  }
}

export default copyToClipboard;
