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
 * Calculates grade details based on total score (0-100)
 * Uses the standard scale: 90-100(1), 80-89(2), 70-79(3), etc.
 */
export const getGradeDetails = (score: number) => {
  const s = Math.round(score || 0);
  if (s >= 90) return { grade: "1", aggregate: 1, remark: "Highest" };
  if (s >= 80) return { grade: "2", aggregate: 2, remark: "Higher" };
  if (s >= 70) return { grade: "3", aggregate: 3, remark: "High" };
  if (s >= 60) return { grade: "4", aggregate: 4, remark: "High Average" };
  if (s >= 55) return { grade: "5", aggregate: 5, remark: "Average" };
  if (s >= 50) return { grade: "6", aggregate: 6, remark: "Low Average" };
  if (s >= 40) return { grade: "7", aggregate: 7, remark: "Low" };
  if (s >= 35) return { grade: "8", aggregate: 8, remark: "Lower" };
  return { grade: "9", aggregate: 9, remark: "Lowest" };
};

/**
 * Legacy support for simple grade string calculation
 */
export const calculateGrade = (score: number): string => {
  return getGradeDetails(score).grade;
};
