import { normalizeClassLevel } from "./Curriculum";
import { GES_CURRICULUM_DATA as MODULAR_DATA } from "./ges-curriculum";

export interface GESIndicator {
  code: string;
  strand: string;
  subStrand: string;
  contentStandard: string;
  indicator: string;
  objectives: string;
}

/**
 * Aggregated GES/NaCCA Curriculum Data
 */
export const GES_CURRICULUM_DATA = MODULAR_DATA;


/**
 * Looks up a GES/NaCCA indicator based on the code and context.
 * This version is extremely robust, handling common aliases and searching globally if needed.
 */
export const lookupGESIndicator = (
  code: string,
  subject?: string,
  classLevel?: string
): GESIndicator | null => {
  if (!code) return null;

  const normalizedCode = code.trim().toUpperCase();

  // 1. If subject is provided, try searching within that subject first
  if (subject) {
    // Handle common subject aliases
    let searchSubject = subject;
    const lowSub = subject.toLowerCase();
    if (lowSub.startsWith("math")) searchSubject = "Mathematics";
    else if (lowSub.includes("science")) searchSubject = "Science";
    else if (lowSub.includes("english")) searchSubject = "English";
    else if (lowSub.includes("comp")) searchSubject = "Computing";

    const subjectData = GES_CURRICULUM_DATA[searchSubject];
    if (subjectData) {
      // 1a. If classLevel is provided, try exact match in that class
      if (classLevel) {
        const normalizedInputLevel = normalizeClassLevel(classLevel);
        const classData = subjectData[normalizedInputLevel];
        if (classData) {
          const match = classData.find(item => item.code.toUpperCase() === normalizedCode);
          if (match) return match;
        }
      }

      // 1b. Search across all classes for this subject
      for (const level in subjectData) {
        const match = subjectData[level].find(item => item.code.toUpperCase() === normalizedCode);
        if (match) return match;
      }
    }
  }

  // 2. Global search across all subjects and all levels (Final Fallback)
  // This handles cases where the wrong subject is selected but the code is valid
  for (const sub in GES_CURRICULUM_DATA) {
    const subData = GES_CURRICULUM_DATA[sub];
    for (const level in subData) {
      const match = subData[level].find(item => item.code.toUpperCase() === normalizedCode);
      if (match) return match;
    }
  }

  return null;
};
