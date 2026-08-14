import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system";
import { isNative } from "./platform";

/**
 * Converts a raw Base64 string into a PNG data URI.
 */
function ensurePngDataUri(base64: string): string {
  if (base64.startsWith("data:")) {
    return base64;
  }

  return `data:image/png;base64,${base64}`;
}

/**
 * Gets an Expo Asset from either:
 * - require("./assets/reports/school.png")
 * - an existing Expo Asset object
 */
function resolveAsset(assetModuleOrAsset: any): Asset {
  if (assetModuleOrAsset instanceof Asset) {
    return assetModuleOrAsset;
  }

  return Asset.fromModule(assetModuleOrAsset);
}

/**
 * Reads a locally bundled PNG asset and returns it as a
 * Base64 data URI.
 *
 * Works on:
 * - Android
 * - iOS
 * - Web
 *
 * Example:
 *
 * const background = await readAssetAsBase64(
 *   require("../assets/reports/afahjoy.png")
 * );
 */
export async function readAssetAsBase64(
  assetModuleOrAsset: any,
): Promise<string> {
  if (!assetModuleOrAsset) {
    throw new Error("No asset was provided.");
  }

  const asset = resolveAsset(assetModuleOrAsset);

  // ---------------------------------------------------------
  // NATIVE: Android / iOS
  // ---------------------------------------------------------
  if (isNative) {
    await asset.downloadAsync();

    const uri = asset.localUri || asset.uri;

    if (!uri) {
      throw new Error("Could not resolve the local PNG asset URI.");
    }

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: "base64",
    });

    if (!base64) {
      throw new Error("The PNG asset returned empty Base64 data.");
    }

    return ensurePngDataUri(base64);
  }

  // ---------------------------------------------------------
  // WEB
  // ---------------------------------------------------------
  const uri = asset.uri || asset.localUri;

  if (!uri) {
    throw new Error("Could not resolve the web PNG asset URI.");
  }

  const response = await fetch(uri);

  if (!response.ok) {
    throw new Error(
      `Failed to load PNG asset: ${response.status} ${response.statusText}`,
    );
  }

  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Convert the binary data to a Base64-compatible binary string
  // in chunks to avoid exceeding JavaScript's argument limit.
  let binary = "";

  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(
      i,
      Math.min(i + chunkSize, bytes.length),
    );

    binary += String.fromCharCode(...chunk);
  }

  let base64: string;

  if (typeof btoa === "function") {
    base64 = btoa(binary);
  } else {
    // Buffer is available in some Expo/Node-compatible environments.
    base64 = Buffer.from(binary, "binary").toString("base64");
  }

  if (!base64) {
    throw new Error("Failed to convert PNG asset to Base64.");
  }

  return ensurePngDataUri(base64);
}

export default {
  readAssetAsBase64,
};