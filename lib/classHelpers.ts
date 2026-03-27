/**
 * Sorts educational classes logically based on school levels and numeric grades.
 * Expected Order: Creche -> Nursery -> KG -> Class/Primary/Grade 1-6 -> JHS 1-3 -> SHS 1-3
 */
export const sortClasses = <T extends { name: string }>(list: T[]): T[] => {
  return [...list].sort((a, b) => {
    const nameA = (a.name || "").toUpperCase();
    const nameB = (b.name || "").toUpperCase();

    // Priority Map for different levels
    const levelOrder: Record<string, number> = {
      'CRECHE': 1,
      'NURSERY': 2,
      'KG': 3,
      'KINDERGARTEN': 3,
      'CLASS': 4,
      'PRIMARY': 4,
      'GRADE': 4,
      'BASIC': 4,
      'JHS': 5,
      'JUNIOR HIGH': 5,
      'SHS': 6,
      'SENIOR HIGH': 6
    };

    const getLevelPriority = (name: string) => {
      // Check for keywords in order of specificity
      if (name.includes('SHS')) return levelOrder['SHS'];
      if (name.includes('JHS')) return levelOrder['JHS'];
      if (name.includes('KG')) return levelOrder['KG'];
      
      for (const key in levelOrder) {
        if (name.includes(key)) return levelOrder[key];
      }
      return 10; // Default for unknown names
    };

    const prioA = getLevelPriority(nameA);
    const prioB = getLevelPriority(nameB);

    if (prioA !== prioB) return prioA - prioB;

    // If same level (e.g. both are 'CLASS' or 'JHS'), compare numbers
    const numA = parseInt(nameA.replace(/[^0-9]/g, "")) || 0;
    const numB = parseInt(nameB.replace(/[^0-9]/g, "")) || 0;

    if (numA !== numB) return numA - numB;

    // If numbers are the same (e.g. Class 1A vs Class 1B), compare alphabetically
    return nameA.localeCompare(nameB);
  });
};

/**
 * Calculates grade based on total score (0-100)
 */
export const calculateGrade = (score: number): string => {
  if (score >= 80) return "A1";
  if (score >= 70) return "B2";
  if (score >= 60) return "B3";
  if (score >= 55) return "C4";
  if (score >= 50) return "C5";
  if (score >= 45) return "C6";
  if (score >= 40) return "D7";
  if (score >= 35) return "E8";
  return "F9";
};
