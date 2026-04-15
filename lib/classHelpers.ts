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
 * Standardized scale: 80-100(1), 70-79(2), 60-69(3), 55-59(4), 50-54(5), 45-49(6), 40-44(7), 35-39(8), 0-34(9)
 */
export const getGradeDetails = (score: number) => {
  const s = Math.round(score || 0);
  if (s >= 80) return { grade: "1", aggregate: 1, remark: "Highest" };
  if (s >= 70) return { grade: "2", aggregate: 2, remark: "Higher" };
  if (s >= 60) return { grade: "3", aggregate: 3, remark: "High" };
  if (s >= 55) return { grade: "4", aggregate: 4, remark: "High Average" };
  if (s >= 50) return { grade: "5", aggregate: 5, remark: "Average" };
  if (s >= 45) return { grade: "6", aggregate: 6, remark: "Low Average" };
  if (s >= 40) return { grade: "7", aggregate: 7, remark: "Low" };
  if (s >= 35) return { grade: "8", aggregate: 8, remark: "Lower" };
  return { grade: "9", aggregate: 9, remark: "Lowest" };
};

/**
 * Calculates the TRS (Total Raw Score), TAS (Total Aggregate Score - Core 3 + Best 3),
 * and Aggregate (Sum of grades - Core 3 + Best 3) based on standard education metrics.
 *
 * @param subjects Array of subject objects with 'subject', 'total' (score), and 'grade' (string/number)
 */
export const calculatePerformanceFromList = (subjects: any[]) => {
  if (!subjects || subjects.length === 0) {
    return { trs: "0.00", tas: "0.00", aggregate: 54 }; // 6 subjects * Grade 9
  }

  const coreList = ["Mathematics", "Science", "English", "Social Studies"]; // Standard 4 cores or 3?
  // Most Ghana systems use 4 cores for JHS/SHS.
  // Let's stick to what was there but maybe make it more robust.
  const targetCores = ["mathematics", "science", "english"];

  // 1. TRS: Sum of ALL scores
  const trsValue = subjects.reduce((acc, curr) => acc + (parseFloat(curr.total) || 0), 0);

  // Split into Core and Others
  const cores = subjects.filter((s) =>
    targetCores.some((c) => s.subject.toLowerCase() === c.toLowerCase())
  );

  const others = subjects
    .filter(
      (s) => !targetCores.some((c) => s.subject.toLowerCase() === c.toLowerCase())
    )
    .sort((a, b) => (parseFloat(a.total) || 0) - (parseFloat(b.total) || 0)); // For TAS we want highest scores

  const othersForGrade = [...subjects]
    .filter(
      (s) => !targetCores.some((c) => s.subject.toLowerCase() === c.toLowerCase())
    )
    .sort((a, b) => (parseInt(a.grade) || 9) - (parseInt(b.grade) || 9)); // For Aggregate we want lowest grades

  // Aggregate (3 Cores + Best 3 Electives)
  const coreGradeSum = cores.reduce((a, c) => a + (parseInt(c.grade) || 9), 0);
  const electiveGradeSum = othersForGrade
    .slice(0, 3)
    .reduce((a, c) => a + (parseInt(c.grade) || 9), 0);

  const missingCoresCount = Math.max(0, 3 - cores.length);
  const missingElectivesCount = Math.max(0, 3 - othersForGrade.length);
  const aggregate = coreGradeSum + electiveGradeSum + (missingCoresCount + missingElectivesCount) * 9;

  // TAS (3 Cores + Best 3 Scores)
  // Re-sort others for highest scores
  const othersForScore = others.reverse();

  const coreScoreSum = cores.reduce((a, c) => a + (parseFloat(c.total) || 0), 0);
  const electiveScoreSum = othersForScore
    .slice(0, 3)
    .reduce((a, c) => a + (parseFloat(c.total) || 0), 0);
  const tasValue = coreScoreSum + electiveScoreSum;

  return {
    trs: trsValue.toFixed(2),
    tas: tasValue.toFixed(2),
    aggregate
  };
};

/**
 * Legacy support for simple grade string calculation
 */
/**
 * Calculates the TRS (Total Raw Score), TAS (Total Aggregate Score - 6 subjects),
 * and Aggregate (Sum of grades - 6 subjects) based on GES standards.
 */
export const calculatePerformanceMetrics = (subjects: Record<string, { grade: number, score: number }>) => {
  const coreList = ["mathematics", "science", "english"];

  // 1. TRS: Sum of ALL scores
  const trs = Object.values(subjects).reduce((acc, curr) => acc + (curr.score || 0), 0);

  // Split into Core and Electives
  const coreEntries = Object.keys(subjects)
    .filter(k => coreList.includes(k.toLowerCase()))
    .map(k => subjects[k]);

  const electiveEntries = Object.keys(subjects)
    .filter(k => !coreList.includes(k.toLowerCase()))
    .map(k => subjects[k])
    .sort((a, b) => a.grade - b.grade); // Lower grade is better

  // 2. Aggregate (Best 6 Grades)
  // Logic: Sum of 3 Cores + Best 3 Electives. Missing cores/electives count as Grade 9.
  const coreGradeSum = coreEntries.reduce((a, b) => a + b.grade, 0) + (Math.max(0, 3 - coreEntries.length) * 9);
  const electiveGradeSum = electiveEntries.slice(0, 3).reduce((a, b) => a + b.grade, 0) + (Math.max(0, 3 - electiveEntries.length) * 9);
  const aggregate = coreGradeSum + electiveGradeSum;

  // 3. TAS (Best 6 Raw Scores)
  const coreScoreSum = coreEntries.reduce((a, b) => a + b.score, 0);
  const electiveScoreSum = electiveEntries.slice(0, 3).reduce((a, b) => a + b.score, 0);
  const tas = coreScoreSum + electiveScoreSum;

  return {
    trs: trs.toFixed(2),
    tas: tas.toFixed(2),
    aggregate
  };
};
