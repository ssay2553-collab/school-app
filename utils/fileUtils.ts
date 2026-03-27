import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system";
import { isNative } from "./platform";

// Read an asset (module or Asset) and return base64 string of its contents.
export async function readAssetAsBase64(
  assetModuleOrAsset: any,
): Promise<string> {
  if (isNative) {
    const asset = Asset.fromModule(assetModuleOrAsset);
    await asset.downloadAsync();
    const uri = asset.localUri || asset.uri;
    if (!uri) throw new Error("Asset URI not available");
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: "base64",
    });
    return base64;
  }

  // Web / Electron renderer: assetModuleOrAsset is typically a URL (string) or a module with default export
  const url =
    typeof assetModuleOrAsset === "string"
      ? assetModuleOrAsset
      : assetModuleOrAsset?.default || assetModuleOrAsset;

  const resp = await fetch(url);
  const buffer = await resp.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Convert to base64 in chunks to avoid stack limits
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      Array.prototype.slice.call(
        bytes,
        i,
        Math.min(i + chunkSize, bytes.length),
      ),
    );
  }
  // btoa is available in browsers and Electron renderer
  const base64 =
    typeof btoa !== "undefined"
      ? btoa(binary)
      : Buffer.from(binary, "binary").toString("base64");
  return base64;
}

export default { readAssetAsBase64 };
