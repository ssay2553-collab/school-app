import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system";
import { isNative } from "./platform";

function ensureDataUri(base64: string, mimeType = "image/png") {
  return base64.startsWith("data:")
    ? base64
    : `data:${mimeType};base64,${base64}`;
}

// Read an asset (module or Asset) and return a data URI string with base64 content.
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
    return ensureDataUri(base64);
  }

  const asset = Asset.fromModule(assetModuleOrAsset);
  const uri =
    asset.uri || asset.localUri || asset?.default || assetModuleOrAsset;
  if (!uri) throw new Error("Asset URI not available");

  const resp = await fetch(uri);
  const buffer = await resp.arrayBuffer();
  const bytes = new Uint8Array(buffer);

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

  const base64 =
    typeof btoa !== "undefined"
      ? btoa(binary)
      : Buffer.from(binary, "binary").toString("base64");

  return ensureDataUri(base64);
}

export default { readAssetAsBase64 };
