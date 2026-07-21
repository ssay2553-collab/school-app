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
  "Basic 1": {
    ageRange: "6-7 years",
    level: "early_grade",
    description: "Lower Primary - Foundation literacy and numeracy",
  },
  "Basic 2": {
    ageRange: "7-8 years",
    level: "early_grade",
    description: "Lower Primary - Building foundational skills",
  },
  "Basic 3": {
    ageRange: "8-9 years",
    level: "early_grade",
    description: "Lower Primary - Transition to intermediate",
  },
  "Basic 4": {
    ageRange: "9-10 years",
    level: "upper_primary",
    description: "Upper Primary - Intermediate concepts",
  },
  "Basic 5": {
    ageRange: "10-11 years",
    level: "upper_primary",
    description: "Upper Primary - Advanced foundational skills",
  },
  "Basic 6": {
    ageRange: "11-12 years",
    level: "upper_primary",
    description: "Upper Primary - Preparation for JHS",
  },
  "JHS 1": {
    ageRange: "12-13 years",
    level: "jhs",
    description: "Junior High - Beginning of secondary education",
  },
  "JHS 2": {
    ageRange: "13-14 years",
    level: "jhs",
    description: "Junior High - Intermediate secondary concepts",
  },
  "JHS 3": {
    ageRange: "14-15 years",
    level: "jhs",
    description: "Junior High - BECE preparation year",
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
 * Centralized normalization for class levels (e.g., "basic-1" -> "Basic 1")
 */
export const normalizeClassLevel = (classLevel: string): string => {
  if (!classLevel) return classLevel;

  const cleaned = classLevel
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

  return found || cleaned;
};

/**
 * Get class level info with fallback
 */
export const getClassLevelInfo = (classLevel: string) => {
  const normalizedLevel = normalizeClassLevel(classLevel);
  if (CLASS_LEVELS[normalizedLevel as keyof typeof CLASS_LEVELS]) {
    return CLASS_LEVELS[normalizedLevel as keyof typeof CLASS_LEVELS];
  }

  const lower = normalizedLevel.toLowerCase();
  if (lower.includes("nursery"))
    return {
      ageRange: "3-4 years",
      level: "creche",
      description: "Early Childhood Education",
    };
  if (lower.includes("kg1"))
    return {
      ageRange: "4-5 years",
      level: "creche",
      description: "Kindergarten 1",
    };
  if (lower.includes("kg2"))
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
export const formatClassLevel = (classLevel: string): string => {
  const normalized = normalizeClassLevel(classLevel);
  const info = getClassLevelInfo(normalized);
  return `${normalized} (${info.ageRange})`;
};
