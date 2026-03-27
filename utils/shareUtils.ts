import * as Sharing from "expo-sharing";
import { isNative } from "./platform";

/**
 * Share a file URI across platforms.
 * On native: uses expo-sharing.
 * On web/Electron renderer: attempts navigator.share, otherwise falls back to a download link.
 */
export async function shareFile(uri: string, filename = "file") {
  if (isNative) {
    try {
      await Sharing.shareAsync(uri);
      return true;
    } catch {
      console.warn("expo-sharing failed, falling back to web download");
    }
  }

  // Try navigator.share if available and supports files (modern browsers)
  try {
    if (
      typeof navigator !== "undefined" &&
      (navigator as any).canShare &&
      (navigator as any).share
    ) {
      // navigator.share with files is not widely supported; fallthrough to download if unsupported
      try {
        // Attempt to fetch the file and create a File object
        const resp = await fetch(uri);
        const blob = await resp.blob();
        const filesArray: any = [new File([blob], filename)];
        if ((navigator as any).canShare({ files: filesArray })) {
          await (navigator as any).share({ files: filesArray });
          return true;
        }
      } catch {
        // ignore and fall back
      }
    }
  } catch {
    // ignore
  }

  // Last-resort: create an anchor and download the file
  try {
    const resp = await fetch(uri);
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error("shareFile fallback failed", err);
    return false;
  }
}

export default { shareFile };
