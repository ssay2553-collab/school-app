import * as Speech from 'expo-speech';

/**
 * A safe wrapper around expo-speech to prevent bundling errors
 * and runtime crashes if the module is not properly linked.
 */
export const safeSpeak = (text: string, options?: Speech.SpeechSpeakOptions) => {
  try {
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
    if (Speech && typeof Speech.stop === 'function') {
      Speech.stop();
    }
  } catch (error) {
    console.warn("Speech stop failed:", error);
  }
};
