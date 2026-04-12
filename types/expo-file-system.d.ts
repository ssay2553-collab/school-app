declare module "expo-file-system" {
  // Minimal ambient declarations to satisfy legacy usages in the codebase.
  // The real package provides richer types at runtime; this file only fixes TS errors.

  export const cacheDirectory: string | null;
  export const documentDirectory: string | null;

  export enum EncodingType {
    Base64 = "base64",
  }

  // Optional newer Paths namespace used in some codepaths
  export namespace Paths {
    const cache: string;
    const document: string;
  }

  // Minimal File helper type for the newer File API used in some files
  export class File {
    constructor(uri: string);
    uri: string;
    base64(): Promise<string>;
    move(dest: File): Promise<void>;
    static downloadFileAsync(
      url: string,
      dest: File,
    ): Promise<{ base64: () => Promise<string>; uri: string }>;
  }

  export function readAsStringAsync(
    uri: string,
    options?: { encoding?: string },
  ): Promise<string>;
  export function copyAsync(options: {
    from: string;
    to: string;
  }): Promise<void>;
  export function moveAsync(options: {
    from: string;
    to: string;
  }): Promise<{ uri?: string }>;
  export function downloadAsync(
    url: string,
    fileUri: string,
  ): Promise<{ uri: string }>;
}
