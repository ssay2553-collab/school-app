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
 * Helper to normalize subject names to match keys in GES_CURRICULUM_DATA
 */
export const normalizeSubjectKey = (subject?: string): string => {
  if (!subject) return "";
  const low = subject.trim().toLowerCase();

  if (low === "rme" || low.includes("religious") || low.includes("moral")) return "Religious and Moral Education (RME)";
  if (low.startsWith("math")) return "Mathematics";
  if (low.includes("science")) return "Science";
  if (low.includes("english")) return "English";
  if (low.includes("comp") || low.includes("ict")) return "Computing";
  if (low.includes("social")) return "Social Studies";
  if (low.includes("history")) return "History";
  if (low.includes("career")) return "Career Technology";
  if (low.includes("creative")) return "Creative Arts";
  if (low.includes("french")) return "French";
  if (low.includes("physic") || low.includes("p.e") || low === "pe") return "Physical Education";
  if (low.includes("twi") || low.includes("fante") || low.includes("ga") || low.includes("ewe") || low.includes("dangme") || low.includes("ghanaian")) return "Ghanaian Language";

  return subject.trim();
};

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

  // Clean code string
  const rawCode = code.trim().toUpperCase().replace(/[\s\-_.]+$/g, '');

  // Normalize prefix: J1 -> B7, J2 -> B8, J3 -> B9
  const normalizeCode = (c: string) => {
    return c
      .replace(/^J1\./, 'B7.')
      .replace(/^J2\./, 'B8.')
      .replace(/^J3\./, 'B9.')
      .replace(/^JHS1\./, 'B7.')
      .replace(/^JHS2\./, 'B8.')
      .replace(/^JHS3\./, 'B9.');
  };

  const normalizedInput = normalizeCode(rawCode);
  const alphaNumericInput = normalizedInput.replace(/[^A-Z0-9]/g, '');

  const isMatch = (itemCode: string) => {
    const rawItem = itemCode.trim().toUpperCase();
    const normItem = normalizeCode(rawItem);

    if (normItem === normalizedInput || rawItem === rawCode) return true;

    const itemAlpha = normItem.replace(/[^A-Z0-9]/g, '');
    if (alphaNumericInput.length >= 4 && itemAlpha === alphaNumericInput) return true;

    return false;
  };

  // 1. If subject is provided, try searching within that subject first
  if (subject) {
    const searchSubject = normalizeSubjectKey(subject);
    const subjectData = GES_CURRICULUM_DATA[searchSubject] || GES_CURRICULUM_DATA[subject];

    if (subjectData) {
      // 1a. If classLevel is provided, try exact match in that class
      if (classLevel) {
        const normalizedInputLevel = normalizeClassLevel(classLevel);
        const classData = subjectData[normalizedInputLevel];
        if (classData) {
          const match = classData.find(item => isMatch(item.code));
          if (match) return match;
        }
      }

      // 1b. Search across all classes for this subject
      for (const level in subjectData) {
        const match = subjectData[level].find(item => isMatch(item.code));
        if (match) return match;
      }
    }
  }

  // 2. Global search across all subjects and all levels (Final Fallback)
  for (const sub in GES_CURRICULUM_DATA) {
    const subData = GES_CURRICULUM_DATA[sub];
    for (const level in subData) {
      const match = subData[level].find(item => isMatch(item.code));
      if (match) return match;
    }
  }

  return null;
};
