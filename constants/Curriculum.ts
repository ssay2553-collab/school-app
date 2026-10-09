export const GES_SUBJECTS = [
  "Mathematics",
  "Science",
  "Social Studies",
  "Computing",
  "RME",
  "History",
  "Career Technology",
  "Creative Arts",
  "English",
  "French",
  "Asante Twi",
  "Akuapem Twi",
  "Fante",
  "Ga",
  "Ewe",
  "Dangme",
  "Physical Education",
];

export const CAMBRIDGE_SUBJECTS = [
  "Mathematics",
  "English",
  "Science",
  "Biology",
  "Chemistry",
  "Physics",
  "Global Perspectives",
  "ICT",
  "Art & Design",
  "Geography",
  "History",
  "Economics",
  "Business Studies",
  "Literature in English",
  "French",
  "Physical Education",
];

export const MONTESSORI_SUBJECTS = [
  "Practical Life",
  "Sensorial",
  "Language",
  "Mathematics",
  "Culture",
];

export const COMMON_ACTIVITIES = [
  "Break",
  "Lunch",
  "Library",
  "Assembly",
  "Worship",
  "Club",
];

export type CurriculumType = "GES" | "Cambridge" | "Montessori";

/**
 * GES/NaCCA Class Levels with age ranges and curriculum descriptions
 */
export const CLASS_LEVELS = {
  "Creche": {
    ageRange: "1-3 years",
    level: "creche",
    description: "Creche (Level A)",
  },
  "Nursery 2": {
    ageRange: "3-4 years",
    level: "creche",
    description: "Nursery 1 and 2 (Level B)",
  },
  "KG 1": {
    ageRange: "4-5 years",
    level: "creche",
    description: "Kindergarten 1 (Level C)",
  },
  "KG 2": {
    ageRange: "5-6 years",
    level: "creche",
    description: "Kindergarten 2 (Level D)",
  },
  "Basic 1": {
    ageRange: "6-7 years",
    level: "early_grade",
    description: "Lower Primary - Foundation literacy and numeracy (Level 1)",
  },
  "Basic 2": {
    ageRange: "7-8 years",
    level: "early_grade",
    description: "Lower Primary - Building foundational skills (Level 2)",
  },
  "Basic 3": {
    ageRange: "8-9 years",
    level: "early_grade",
    description: "Lower Primary - Transition to intermediate (Level 3)",
  },
  "Basic 4": {
    ageRange: "9-10 years",
    level: "upper_primary",
    description: "Upper Primary - Intermediate concepts (Level 4)",
  },
  "Basic 5": {
    ageRange: "10-11 years",
    level: "upper_primary",
    description: "Upper Primary - Advanced foundational skills (Level 5)",
  },
  "Basic 6": {
    ageRange: "11-12 years",
    level: "upper_primary",
    description: "Upper Primary - Preparation for JHS (Level 6)",
  },
  "JHS 1": {
    ageRange: "12-13 years",
    level: "jhs",
    description: "Junior High 1 - Beginning of secondary education (Level 7)",
  },
  "JHS 2": {
    ageRange: "13-14 years",
    level: "jhs",
    description: "Junior High 2 - Intermediate secondary concepts (Level 8)",
  },
  "JHS 3": {
    ageRange: "14-15 years",
    level: "jhs",
    description: "Junior High 3 - BECE preparation year (Level 9)",
  },
  "SHS 1": {
    ageRange: "15-16 years",
    level: "shs",
    description: "Senior High - First year secondary education",
  },
  "SHS 2": {
    ageRange: "16-17 years",
    level: "shs",
    description: "Senior High - Advanced secondary concepts",
  },
  "SHS 3": {
    ageRange: "17-18 years",
    level: "shs",
    description: "Senior High - WASSCE preparation year",
  },
};

export const ASSESSMENT_CRITERIA = {
  exemplary:
    "Exceeds expectations - demonstrates deep understanding and can apply knowledge in new contexts",
  proficient:
    "Meets expectations - demonstrates solid understanding and can apply knowledge appropriately",
  developing:
    "Approaching expectations - demonstrates partial understanding with some gaps",
  beginning:
    "Below expectations - demonstrates minimal understanding and requires significant support",
};

/**
 * Centralized normalization for class levels (e.g., level A->Creche, level 5->Basic 5, custom name + level -> standard class)
 */
export const normalizeClassLevel = (classInput: string | number | { level?: any; name?: string }): string => {
  if (!classInput) return "";

  let raw = "";
  if (typeof classInput === "object" && classInput !== null) {
    if (classInput.level !== undefined && classInput.level !== null && classInput.level !== "") {
      raw = String(classInput.level);
    } else if (classInput.name) {
      raw = String(classInput.name);
    }
  } else {
    raw = String(classInput);
  }

  const str = raw.trim().toUpperCase();

  // Direct Level Mapping (A-D, 1-9)
  if (str === "A") return "Creche";
  if (str === "B") return "Nursery 2";
  if (str === "C") return "KG 1";
  if (str === "D") return "KG 2";
  if (str === "1") return "Basic 1";
  if (str === "2") return "Basic 2";
  if (str === "3") return "Basic 3";
  if (str === "4") return "Basic 4";
  if (str === "5") return "Basic 5";
  if (str === "6") return "Basic 6";
  if (str === "7") return "JHS 1";
  if (str === "8") return "JHS 2";
  if (str === "9") return "JHS 3";

  const cleaned = raw
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Try exact match first
  if (CLASS_LEVELS[cleaned as keyof typeof CLASS_LEVELS]) {
    return cleaned;
  }

  // Try case-insensitive match
  const found = Object.keys(CLASS_LEVELS).find(
    (key) => key.toLowerCase() === cleaned.toLowerCase(),
  );
  if (found) return found;

  const low = cleaned.toLowerCase();

  if (/\b(b1|basic 1|class 1|primary 1|grade 1)\b/i.test(low)) return "Basic 1";
  if (/\b(b2|basic 2|class 2|primary 2|grade 2)\b/i.test(low)) return "Basic 2";
  if (/\b(b3|basic 3|class 3|primary 3|grade 3)\b/i.test(low)) return "Basic 3";
  if (/\b(b4|basic 4|class 4|primary 4|grade 4)\b/i.test(low)) return "Basic 4";
  if (/\b(b5|basic 5|class 5|primary 5|grade 5)\b/i.test(low)) return "Basic 5";
  if (/\b(b6|basic 6|class 6|primary 6|grade 6)\b/i.test(low)) return "Basic 6";

  if (/\b(b7|basic 7|jhs 1|jhs1|j\.h\.s 1)\b/i.test(low)) return "JHS 1";
  if (/\b(b8|basic 8|jhs 2|jhs2|j\.h\.s 2)\b/i.test(low)) return "JHS 2";
  if (/\b(b9|basic 9|jhs 3|jhs3|j\.h\.s 3)\b/i.test(low)) return "JHS 3";

  if (/\b(shs 1|shs1)\b/i.test(low)) return "SHS 1";
  if (/\b(shs 2|shs2)\b/i.test(low)) return "SHS 2";
  if (/\b(shs 3|shs3)\b/i.test(low)) return "SHS 3";

  return cleaned;
};

/**
 * Get class level info with fallback
 */
export const getClassLevelInfo = (classInput: string | number | { level?: any; name?: string }) => {
  const normalizedLevel = normalizeClassLevel(classInput);
  if (CLASS_LEVELS[normalizedLevel as keyof typeof CLASS_LEVELS]) {
    return CLASS_LEVELS[normalizedLevel as keyof typeof CLASS_LEVELS];
  }

  const lower = normalizedLevel.toLowerCase();
  if (lower.includes("nursery") || lower.includes("creche"))
    return {
      ageRange: "1-4 years",
      level: "creche",
      description: "Early Childhood Education",
    };
  if (lower.includes("kg1") || lower.includes("kg 1"))
    return {
      ageRange: "4-5 years",
      level: "creche",
      description: "Kindergarten 1",
    };
  if (lower.includes("kg2") || lower.includes("kg 2"))
    return {
      ageRange: "5-6 years",
      level: "creche",
      description: "Kindergarten 2",
    };
  return {
    ageRange: "Unknown",
    level: "unknown",
    description: "Class level not in NaCCA system",
  };
};

/**
 * Format class level for display
 */
export const formatClassLevel = (classInput: string | number | { level?: any; name?: string }): string => {
  const normalized = normalizeClassLevel(classInput);
  const info = getClassLevelInfo(normalized);
  return `${normalized} (${info.ageRange})`;
};
