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

export const safeSpeak = (text: string, options?: any) => {
  try {
    const Speech = getSpeechModule();
    if (Speech && typeof Speech.speak === 'function') {
      Speech.speak(text, {
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
