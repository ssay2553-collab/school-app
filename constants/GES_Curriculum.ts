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

  if (low.includes("social") || low.includes("our world") || low.includes("owop")) return "Social Studies";
  if (low === "rme" || low.includes("religious") || low.includes("moral")) return "Religious and Moral Education (RME)";
  if (low.startsWith("math")) return "Mathematics";
  if (low.includes("science")) return "Science";
  if (low.includes("english")) return "English";
  if (low.includes("comp") || low.includes("ict")) return "Computing";
  if (low.includes("history")) return "History";
  if (low.includes("career") || low.includes("design and tech")) return "Career Technology";
  if (low.includes("creative")) return "Creative Arts";
  if (low.includes("french")) return "French";
  if (low.includes("physic") || low.includes("p.e") || low === "pe" || low.includes("phe")) return "Physical Education";
  if (low.includes("twi") || low.includes("fante") || low.includes("ga") || low.includes("ewe") || low.includes("dangme") || low.includes("ghanaian")) return "Ghanaian Language";

  return subject.trim();
};

/**
 * Looks up a GES/NaCCA indicator based on the code and context.
 * This version handles SBC (B1-B6) and CCP (B7-B9) formats seamlessly.
 */
export const lookupGESIndicator = (
  code: string,
  subject?: string,
  classLevel?: string
): GESIndicator | null => {
  if (!code) return null;

  // Clean code string
  const rawCode = code.trim().toUpperCase().replace(/[\s\-_.]+$/g, '');

  // Normalize prefix: J1/JHS1 -> B7, J2/JHS2 -> B8, J3/JHS3 -> B9
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

  // 3. Dynamic Fallback: If it looks like a valid NaCCA code (e.g. starts with B, J, S, K, P and has dots)
  if (/^[B|J|S|K|P]\d+[\.\d+]+/i.test(rawCode)) {
    return generateDynamicGESIndicator(rawCode, subject, classLevel);
  }

  return null;
};

/**
 * Dynamically generates a valid GESIndicator for any valid NaCCA code format if not present in static database.
 */
export const generateDynamicGESIndicator = (
  code: string,
  subject?: string,
  classLevel?: string
): GESIndicator => {
  const cleanCode = code.trim().toUpperCase();
  const parts = cleanCode.split('.');
  const normSubject = normalizeSubjectKey(subject) || "General Subject";

  const strandNum = parts[1] || "1";
  const subStrandNum = parts[2] || "1";
  const stdNum = parts[3] || "1";
  const indNum = parts[4] || "1";

  let strand = `Strand ${strandNum}`;
  if (normSubject.includes("Science")) {
    const sciStrands: Record<string, string> = {
      "1": "Diversity of Matter",
      "2": "Cycles",
      "3": "Systems",
      "4": "Forces and Energy",
      "5": "Humans and the Environment"
    };
    strand = sciStrands[strandNum] || `Science Strand ${strandNum}`;
  } else if (normSubject.includes("Math")) {
    const mathStrands: Record<string, string> = {
      "1": "Number",
      "2": "Algebra",
      "3": "Geometry and Measurement",
      "4": "Data"
    };
    strand = mathStrands[strandNum] || `Mathematics Strand ${strandNum}`;
  } else if (normSubject.includes("English")) {
    const engStrands: Record<string, string> = {
      "1": "Oral Language",
      "2": "Reading",
      "3": "Writing",
      "4": "Using Writing Conventions",
      "5": "Extensive Reading / Literature"
    };
    strand = engStrands[strandNum] || `English Strand ${strandNum}`;
  } else if (normSubject.includes("Computing") || normSubject.includes("ICT")) {
    const ictStrands: Record<string, string> = {
      "1": "Introduction to Computing",
      "2": "Productivity Software",
      "3": "Communication Networks",
      "4": "Computational Thinking and Programming"
    };
    strand = ictStrands[strandNum] || `Computing Strand ${strandNum}`;
  } else if (normSubject.includes("Our World") || normSubject.includes("OWOP")) {
    const owopStrands: Record<string, string> = {
      "1": "All About Us",
      "2": "All Around Us",
      "3": "Our Beliefs and Values",
      "4": "Our Nation Ghana",
      "5": "My Global Community"
    };
    strand = owopStrands[strandNum] || `OWOP Strand ${strandNum}`;
  } else if (normSubject.includes("Social Studies")) {
    const socialStrands: Record<string, string> = {
      "1": "Environment",
      "2": "Governance, Politics and Stability",
      "3": "Social Development",
      "4": "Culture and National Identity",
      "5": "Socio-Economic Development"
    };
    strand = socialStrands[strandNum] || `Social Studies Strand ${strandNum}`;
  } else if (normSubject.includes("Religious") || normSubject.includes("RME")) {
    const rmeStrands: Record<string, string> = {
      "1": "God, His Creation and Attributes",
      "2": "Religious Practices and Observances",
      "3": "Family and Community",
      "4": "Religious Leaders and Moral Life"
    };
    strand = rmeStrands[strandNum] || `RME Strand ${strandNum}`;
  } else if (normSubject.includes("History")) {
    const historyStrands: Record<string, string> = {
      "1": "History as a Subject",
      "2": "My Country Ghana",
      "3": "Europeans in Ghana",
      "4": "Colonisation and Independence of Ghana",
      "5": "The Republics"
    };
    strand = historyStrands[strandNum] || `History Strand ${strandNum}`;
  } else if (normSubject.includes("Career")) {
    const careerStrands: Record<string, string> = {
      "1": "Health and Safety",
      "2": "Materials for Production",
      "3": "Tools, Equipment and Processes",
      "4": "Design and Technology",
      "5": "Entrepreneurship"
    };
    strand = careerStrands[strandNum] || `Career Technology Strand ${strandNum}`;
  } else if (normSubject.includes("Creative")) {
    const creativeStrands: Record<string, string> = {
      "1": "Design / Visual Arts",
      "2": "Performing Arts"
    };
    strand = creativeStrands[strandNum] || `Creative Arts Strand ${strandNum}`;
  } else if (normSubject.includes("French")) {
    const frenchStrands: Record<string, string> = {
      "1": "Compréhension Orale et Écrite",
      "2": "Expression Orale et Écrite"
    };
    strand = frenchStrands[strandNum] || `French Strand ${strandNum}`;
  } else if (normSubject.includes("Physical") || normSubject.includes("PE")) {
    const peStrands: Record<string, string> = {
      "1": "Motor Skills and Movement Patterns",
      "2": "Movement Concepts",
      "3": "Physical Fitness and Health",
      "4": "Safety and Personal Responsibility"
    };
    strand = peStrands[strandNum] || `Physical Education Strand ${strandNum}`;
  } else if (normSubject.includes("Ghanaian Language") || normSubject.includes("Twi") || normSubject.includes("Fante") || normSubject.includes("Ga") || normSubject.includes("Ewe")) {
    const langStrands: Record<string, string> = {
      "1": "Oral Language",
      "2": "Reading",
      "3": "Writing",
      "4": "Language Structures / Grammar",
      "5": "Culture"
    };
    strand = langStrands[strandNum] || `Ghanaian Language Strand ${strandNum}`;
  }

  return {
    code: cleanCode,
    strand,
    subStrand: `Sub-strand ${strandNum}.${subStrandNum} (${normSubject})`,
    contentStandard: `Demonstrate understanding of content standard ${stdNum} in ${normSubject}`,
    indicator: `Indicator ${indNum}: Key learning competencies and activities for ${cleanCode}`,
    objectives: `Explore and master learning objectives associated with ${normSubject} indicator ${cleanCode}.`
  };
};
