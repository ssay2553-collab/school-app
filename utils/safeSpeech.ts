/**
 * A safe wrapper around expo-speech to prevent bundling errors
 * and runtime crashes if the module is not properly linked or installed.
 */

// We import the type only to maintain IDE support;
// type imports are stripped during bundling and won't cause resolution errors.
import type * as SpeechType from 'expo-speech';

const getSpeechModule = (): typeof SpeechType | null => {
  try {
    // We use require instead of a static import to prevent the bundler
    // from failing if the package is missing in the build environment.
    return require('expo-speech');
  } catch (error) {
    console.warn("expo-speech module not found");
    return null;
  }
};

/**
 * Strips emoji characters and unicode pictographs from text before speaking
 * so that Text-to-Speech (TTS) engines do not pronounce emoji names out loud
 * (e.g. reading 🍎 as "Red Apple" or 🦁 as "Lion" and revealing game answers).
 */
export const stripEmojis = (text: string): string => {
  if (!text) return "";
  try {
    return text
      .replace(/[\u{1F300}-\u{1FAFF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}]/gu, '')
      .replace(/\p{Extended_Pictographic}/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  } catch (error) {
    return text
      .replace(/[\u{1F300}-\u{1FAFF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE0F}\u{200D}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
};

export const safeSpeak = (text: string, options?: any) => {
  try {
    if (!text) return;
    const cleanedText = stripEmojis(text);
    if (!cleanedText) return;

    const Speech = getSpeechModule();
    if (Speech && typeof Speech.speak === 'function') {
      Speech.speak(cleanedText, {
        rate: 0.9,
        ...options,
      });
    }
  } catch (error) {
    console.warn("Speech synthesis failed:", error);
  }
};

export const safeStop = () => {
  try {
    const Speech = getSpeechModule();
    if (Speech && typeof Speech.stop === 'function') {
      Speech.stop();
    }
  } catch (error) {
    console.warn("Speech stop failed:", error);
  }
};
