import { AppUser } from "../types/users";

/**
 * Standardizes isClassTeacher logic to match firestore.rules
 * A user is a class teacher if:
 * 1. They are signed in (user object exists)
 * 2. They have a teacher, admin, or staff role
 * 3. The classId matches their 'classTeacherOf' property OR is in their 'classes' array
 */
export const isClassTeacher = (
  user: AppUser | null | undefined,
  classId: string,
): boolean => {
  if (!user || !classId) return false;

  const role = user.role?.toLowerCase();
  const isAdmin =
    role === "admin" ||
    role === "superadmin" ||
    role === "super admin" ||
    !!(user as any).adminRole;
  const isTeacher = role === "teacher";
  const isStaff = role === "staff";

  if (!isAdmin && !isTeacher && !isStaff) return false;

  // Admins have universal access to mark attendance
  if (isAdmin) return true;

  // Check if Teacher on Duty is active
  if ((user as any)?.isTeacherOnDuty) {
    return true; // Teacher on Duty has permission for all classes!
  }

  const classTeacherOf = user.classTeacherOf;
  const classes = user.classes || [];

  return classTeacherOf === classId || classes.includes(classId);
};

/**
 * Returns all class IDs associated with a teacher or staff member.
 * Combines classTeacherOf and the classes array.
 */
export const getTeacherClasses = (
  user: AppUser | null | undefined,
): string[] => {
  if (!user) return [];
  const list = [...(user.classes || [])];
  if (user.classTeacherOf && !list.includes(user.classTeacherOf)) {
    list.push(user.classTeacherOf);
  }
  return list;
};

export const normalizeSubjectName = (
  subject: string | null | undefined,
): string => {
  return typeof subject === "string" ? subject.trim().replace(/\s+/g, " ") : "";
};

export const dedupeSubjects = (
  subjects: Array<string | null | undefined>,
): string[] => {
  const seen = new Set<string>();

  return (subjects || [])
    .map((subject) => normalizeSubjectName(subject))
    .filter((subject): subject is string => Boolean(subject))
    .filter((subject) => {
      const key = subject.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
};

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
      CRECHE: 1,
      NURSERY: 2,
      KG: 3,
      KINDERGARTEN: 3,
      CLASS: 4,
      PRIMARY: 4,
      GRADE: 4,
      BASIC: 4,
      JHS: 5,
      "JUNIOR HIGH": 5,
      SHS: 6,
      "SENIOR HIGH": 6,
    };

    const getLevelPriority = (name: string) => {
      // Check for keywords in order of specificity
      if (name.includes("SHS")) return levelOrder["SHS"];
      if (name.includes("JHS")) return levelOrder["JHS"];
      if (name.includes("KG")) return levelOrder["KG"];

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
 * Calculates grade details based on score and total score (maxScore).
 * Automatically scales percentage: (score / maxScore) * 100
 * Standardized scale: 80-100%(1), 70-79%(2), 60-69%(3), 55-59%(4), 50-54%(5), 45-49%(6), 40-44%(7), 35-39%(8), 0-34%(9)
 */
export const getGradeDetails = (score: number, maxScore: number = 100) => {
  const max = maxScore && maxScore > 0 ? maxScore : 100;
  const percentage = (Math.max(0, score || 0) / max) * 100;
  const s = Math.round(percentage);

  if (s >= 80)
    return { grade: "1", aggregate: 1, remark: "Highest", label: "Excellent" };
  if (s >= 70)
    return { grade: "2", aggregate: 2, remark: "Higher", label: "Very Good" };
  if (s >= 60)
    return { grade: "3", aggregate: 3, remark: "High", label: "Good" };
  if (s >= 55)
    return {
      grade: "4",
      aggregate: 4,
      remark: "High Average",
      label: "Credit",
    };
  if (s >= 50)
    return { grade: "5", aggregate: 5, remark: "Average", label: "Pass" };
  if (s >= 45)
    return { grade: "6", aggregate: 6, remark: "Low Average", label: "Pass" };
  if (s >= 40)
    return { grade: "7", aggregate: 7, remark: "Low", label: "Weak" };
  if (s >= 35)
    return { grade: "8", aggregate: 8, remark: "Lower", label: "Very Weak" };
  return { grade: "9", aggregate: 9, remark: "Lowest", label: "Fail" };
};

/**
 * Generates automated remarks based on aggregate score or average performance.
 * Suitable for Admin and Class Teacher remarks.
 */
export interface SubjectTrendItem {
  subject: string;
  score: number;
  previousScore?: number;
  scoreChange?: number;
  trend: "improved" | "declined" | "stable" | "new";
  grade: string;
  previousGrade?: string;
  recommendation: string;
}

export interface SubjectAnalysis {
  weakSubjects: SubjectTrendItem[];
  decliningSubjects: SubjectTrendItem[];
  improvedSubjects: SubjectTrendItem[];
  strongSubjects: SubjectTrendItem[];
  averageScore: number;
  previousAverageScore?: number;
  averageChange?: number;
  overallTrend: "improved" | "declined" | "stable" | "new";
}

/**
 * Subject-specific remediation advice generator for parents and teachers.
 */
export const getSubjectRemediationAdvice = (subjectName: string): string => {
  const s = (subjectName || "").toLowerCase();
  if (s.includes("math") || s.includes("arithmetic") || s.includes("algebra") || s.includes("geometry") || s.includes("quant")) {
    return "Requires daily 20-minute timed problem drills, focused practice on word problems, basic formulas, and multiplication tables.";
  }
  if (s.includes("sci") || s.includes("physic") || s.includes("chem") || s.includes("bio") || s.includes("nature") || s.includes("environ")) {
    return "Encourage diagram drawing, reviewing daily experiment/class notes, and using visual concept summaries.";
  }
  if (s.includes("eng") || s.includes("read") || s.includes("lang") || s.includes("lit") || s.includes("french") || s.includes("twi") || s.includes("ghanaian") || s.includes("verbal")) {
    return "Daily reading for 30 minutes, keeping a vocabulary/spelling notebook, and writing short weekly summary paragraphs.";
  }
  if (s.includes("social") || s.includes("history") || s.includes("geography") || s.includes("civic") || s.includes("rme") || s.includes("relig") || s.includes("citizenship")) {
    return "Review class topic summaries regularly and practice answering structured essay and past exam questions.";
  }
  if (s.includes("ict") || s.includes("comp") || s.includes("cod") || s.includes("tech") || s.includes("robot")) {
    return "Combine practical computer/device drills with key terminology revision and practical exercises.";
  }
  if (s.includes("creative") || s.includes("art") || s.includes("draw") || s.includes("music") || s.includes("bdt")) {
    return "Encourage project practice, sketch drawing, and hands-on assignment completion.";
  }
  return "Dedicated daily revision, extra practice exercises, and focused consultation with the subject teacher.";
};

/**
 * Compares current performance against previous performance to isolate trends, declining subjects, weak subjects, and growth.
 */
export const analyzeSubjectPerformance = (
  subjects: any[],
  previousSubjects?: any[],
): SubjectAnalysis => {
  if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
    return {
      weakSubjects: [],
      decliningSubjects: [],
      improvedSubjects: [],
      strongSubjects: [],
      averageScore: 0,
      overallTrend: "new",
    };
  }

  const parseSubjectList = (list: any[]) => {
    return list.map((s) => {
      const rawScore = parseFloat(s.total ?? s.score ?? s.examsScore ?? 0);
      const score = isNaN(rawScore) ? 0 : rawScore;
      const name = String(s.subject || s.name || s.subjectName || "Subject").trim();
      const grade = String(s.grade || s.gradeName || "").toUpperCase();
      return { name, score, grade };
    });
  };

  const currentList = parseSubjectList(subjects);
  const prevList = previousSubjects && Array.isArray(previousSubjects) ? parseSubjectList(previousSubjects) : [];

  const prevMap = new Map<string, { score: number; grade: string }>();
  prevList.forEach((p) => {
    prevMap.set(p.name.toLowerCase(), { score: p.score, grade: p.grade });
  });

  const totalCurrentSum = currentList.reduce((acc, c) => acc + c.score, 0);
  const averageScore = Math.round(currentList.length > 0 ? totalCurrentSum / currentList.length : 0);

  let totalPrevSum = 0;
  let prevCount = 0;

  const analyzedList: SubjectTrendItem[] = currentList.map((c) => {
    const prevKey = c.name.toLowerCase();
    const prevData = prevMap.get(prevKey);
    let previousScore: number | undefined = undefined;
    let previousGrade: string | undefined = undefined;
    let scoreChange: number | undefined = undefined;
    let trend: "improved" | "declined" | "stable" | "new" = "new";

    if (prevData !== undefined) {
      previousScore = Math.round(prevData.score);
      previousGrade = prevData.grade;
      scoreChange = Math.round(c.score - prevData.score);
      totalPrevSum += prevData.score;
      prevCount++;

      if (scoreChange >= 5) trend = "improved";
      else if (scoreChange <= -5) trend = "declined";
      else trend = "stable";
    }

    return {
      subject: c.name,
      score: Math.round(c.score),
      previousScore,
      scoreChange,
      trend,
      grade: c.grade || (c.score < 40 ? "F9" : c.score < 50 ? "E8" : "D7"),
      previousGrade,
      recommendation: getSubjectRemediationAdvice(c.name),
    };
  });

  const previousAverageScore = prevCount > 0 ? Math.round(totalPrevSum / prevCount) : undefined;
  const averageChange = previousAverageScore !== undefined ? averageScore - previousAverageScore : undefined;

  let overallTrend: "improved" | "declined" | "stable" | "new" = "new";
  if (averageChange !== undefined) {
    if (averageChange >= 3) overallTrend = "improved";
    else if (averageChange <= -3) overallTrend = "declined";
    else overallTrend = "stable";
  }

  // Declining subjects (scoreChange <= -5)
  const decliningSubjects = analyzedList.filter((s) => s.trend === "declined").sort((a, b) => (a.scoreChange || 0) - (b.scoreChange || 0));

  // Improved subjects (scoreChange >= 5)
  const improvedSubjects = analyzedList.filter((s) => s.trend === "improved").sort((a, b) => (b.scoreChange || 0) - (a.scoreChange || 0));

  // Weak subjects: currentScore < 50 or failing grade
  const weakList = analyzedList.filter((s) => {
    const isFailingGrade = ["F9", "E8", "D7", "E", "F", "9", "8", "7", "WEAK", "FAIL", "NEEDS IMPROVEMENT"].includes(s.grade);
    return s.score < 50 || isFailingGrade;
  }).sort((a, b) => a.score - b.score);

  let weakSubjects = weakList;
  if (weakSubjects.length === 0 && averageScore < 60 && analyzedList.length > 2) {
    weakSubjects = [...analyzedList].sort((a, b) => a.score - b.score).slice(0, 2);
  }

  // Strong subjects: currentScore >= 70 or high grade
  const strongSubjects = analyzedList.filter((s) => {
    const isHighGrade = ["A1", "B2", "B3", "A", "B", "1", "2", "3", "EXCELLENT", "VERY GOOD"].includes(s.grade);
    return s.score >= 70 || isHighGrade;
  }).sort((a, b) => b.score - a.score);

  return {
    weakSubjects,
    decliningSubjects,
    improvedSubjects,
    strongSubjects,
    averageScore,
    previousAverageScore,
    averageChange,
    overallTrend,
  };
};

/**
 * Generates automated, vivid remarks comparing previous performance to current performance.
 * Suitable for Admin and Class Teacher remarks.
 */
export const getAutoRemarks = (
  aggregate: number,
  isTeacher: boolean = false,
  subjects?: any[],
  previousSubjects?: any[],
) => {
  const agg = aggregate || 54;

  if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
    if (agg <= 10) {
      return isTeacher
        ? "An exceptionally brilliant student. Maintains high standards in all learning areas."
        : "An outstanding academic record. Your consistent excellence across all subjects is highly commendable. Keep it up!";
    } else if (agg <= 20) {
      return isTeacher
        ? "A very diligent and hardworking student. Shows great interest in all subjects."
        : "A very strong overall performance. You have demonstrated high competence in most areas. Maintain this focus.";
    } else if (agg <= 30) {
      return isTeacher
        ? "Good performance overall. Can achieve higher grades if more attention is paid to details."
        : "A good performance overall. However, there is still room to convert your potentials into higher grades with extra effort.";
    } else if (agg <= 40) {
      return isTeacher
        ? "Average performance. Needs to be more serious with academic work and revision."
        : "Average performance. You need to put in more study hours, especially in core subjects, to improve your standing.";
    } else if (agg <= 50) {
      return isTeacher
        ? "Performance is below average. Requires intensive study and home supervision."
        : "Performance is below expectations. Minimizing distractions and focusing on weak areas will yield better results.";
    } else {
      return isTeacher
        ? "Poor performance this term. Urgent remedial support required across subjects."
        : "A very weak performance this term. Intensive remedial support and a change in study habits are urgently required.";
    }
  }

  const analysis = analyzeSubjectPerformance(subjects, previousSubjects);
  const { weakSubjects, decliningSubjects, improvedSubjects, strongSubjects, averageScore, averageChange } = analysis;

  const improvedStr = improvedSubjects.length > 0
    ? improvedSubjects.slice(0, 2).map((s) => `${s.subject} (${s.score}%, +${s.scoreChange}%)`).join(", ")
    : "";

  const decliningStr = decliningSubjects.length > 0
    ? decliningSubjects.slice(0, 3).map((s) => `${s.subject} (dropped from ${s.previousScore}% to ${s.score}%)`).join(", ")
    : "";

  const weakStr = weakSubjects.length > 0
    ? weakSubjects.map((s) => `${s.subject} (${s.score}%)`).join(", ")
    : "";

  const strongStr = strongSubjects.length > 0
    ? strongSubjects.slice(0, 3).map((s) => `${s.subject} (${s.score}%)`).join(", ")
    : "";

  if (isTeacher) {
    let msg = "";
    if (decliningSubjects.length > 0) {
      if (improvedSubjects.length > 0) {
        msg += `Commendable growth achieved in ${improvedStr}. `;
      }
      msg += `However, a noticeable drop in performance is observed in ${decliningStr}. Urgent action required: mandatory daily problem-solving drills, extra homework supervision, and targeted remedial sessions.`;
      return msg;
    } else if (weakSubjects.length > 0) {
      if (strongSubjects.length > 0) {
        msg += `Demonstrates commendable effort in ${strongStr}. `;
      }
      msg += `However, struggles significantly in ${weakStr}. Recommended Action: Enrollment in after-school remedial guidance, daily problem-solving drills, and structured home study.`;
      return msg;
    } else if (improvedSubjects.length > 0) {
      return `Impressive academic growth this term with an overall average increase of +${averageChange}%, featuring strong gains in ${improvedStr}. Keep up the excellent momentum!`;
    } else if (strongSubjects.length > 0) {
      return `An outstanding and highly disciplined student. Consistently excels across learning areas, especially in ${strongStr}. Keep up the exemplary performance!`;
    } else {
      return `Satisfactory effort shown overall with an average score of ${averageScore}%. Encouraged to maintain steady study habits and aim higher next term.`;
    }
  } else {
    // Admin Remarks
    let msg = "";
    if (decliningSubjects.length > 0) {
      if (improvedSubjects.length > 0) {
        msg += `Praiseworthy progress recorded in ${improvedStr}. `;
      }
      msg += `However, comparative evaluation reveals a sharp decline in ${decliningStr}. Immediate parent-teacher collaboration and daily supervised home study are strongly advised to reverse this trend.`;
      return msg;
    } else if (weakSubjects.length > 0) {
      if (strongSubjects.length > 0) {
        msg += `Impressive results achieved in ${strongStr}. `;
      }
      msg += `However, urgent academic focus is required in ${weakStr}. With daily supervised practice, teacher check-ins, and active parent monitoring in these specific subjects, top honors can be achieved next term.`;
      return msg;
    } else if (improvedSubjects.length > 0) {
      return `A commendable academic upward trend this term (+${averageChange}% average gain), highlighted by notable progress in ${improvedStr}. Consistently building solid academic mastery.`;
    } else if (strongSubjects.length > 0) {
      return `An exceptional academic record with strong mastery in ${strongStr}. Demonstrates high standards of academic discipline and excellence across all subjects.`;
    } else {
      return `A fair performance this term with an overall average of ${averageScore}%. Regular home revision and active participation in class activities are recommended for further progress.`;
    }
  }
};

/**
 * Calculates the TRS (Total Raw Score), TAS (Total Aggregate Score - Core + Best Electives),
 * and Aggregate (Sum of grades - Core + Best Electives) based on standard education metrics.
 *
 * @param subjects Array of subject objects with 'subject', 'total' (score), and 'grade' (string/number)
 * @param isPreschool Whether to skip the "Best Electives" penalty logic
 * @param skipAggregate Whether to skip grade-based aggregate calculation (returns 0 for aggregate if true)
 */
export const calculatePerformanceFromList = (
  subjects: any[],
  isPreschool: boolean = false,
  skipAggregate: boolean = false,
) => {
  if (!subjects || subjects.length === 0) {
    return { trs: "0.00", tas: "0.00", aggregate: isPreschool ? 0 : 54 };
  }

  // 1. TRS (Total Raw Score): Total score for all accumulated scores per subjects
  const trsValue = subjects.reduce(
    (acc, curr) => acc + (parseFloat(curr.total) || 0),
    0,
  );

  if (skipAggregate) {
    return {
      trs: trsValue.toFixed(2),
      tas: trsValue.toFixed(2),
      aggregate: 0,
    };
  }

  if (isPreschool) {
    // For Preschool: Sum everything
    const aggregate = subjects.reduce(
      (acc, curr) => acc + (parseInt(curr.aggregate || curr.grade) || 9),
      0,
    );
    return {
      trs: trsValue.toFixed(2),
      tas: trsValue.toFixed(2),
      aggregate,
    };
  }

  // Define potential core subjects
  const targetCores = [
    "mathematics",
    "maths",
    "core mathematics",
    "core maths",
    "science",
    "integrated science",
    "general science",
    "english",
    "english language",
    "social studies",
  ];

  const isCoreSubject = (subjName: string) => {
    const name = (subjName || "").toLowerCase().trim();
    return targetCores.some(
      (c) => name === c || name.startsWith(c) || c.startsWith(name),
    );
  };

  // Split into Core and Electives
  const cores = subjects.filter((s) => isCoreSubject(s.subject));
  const electives = subjects.filter((s) => !isCoreSubject(s.subject));

  // Determine 6 subjects for Aggregate calculation: 4 cores + 2 best electives (or 3 cores + 3 best electives)
  const coreCount = Math.min(cores.length, 4);
  const selectedCores = cores.slice(0, coreCount);

  const electiveCount = Math.max(0, 6 - coreCount);
  const sortedElectives = [...electives].sort((a, b) => {
    const gradeA = parseInt(a.aggregate || a.grade) || 9;
    const gradeB = parseInt(b.aggregate || b.grade) || 9;
    if (gradeA !== gradeB) return gradeA - gradeB;
    return (parseFloat(b.total) || 0) - (parseFloat(a.total) || 0);
  });

  const selectedElectives = sortedElectives.slice(0, electiveCount);

  // The six subjects forming the Aggregate score
  const aggregateSubjects = [...selectedCores, ...selectedElectives];

  // 2. TAS (Total Aggregate Score): Sum of raw scores of ONLY the six subjects forming the Aggregate score
  const tasValue = aggregateSubjects.reduce(
    (a, c) => a + (parseFloat(c.total) || 0),
    0,
  );

  // 3. AGGREGATE (Overall Grade Aggregate): Sum of grades of ONLY the six subjects forming the Aggregate score
  const gradeSum = aggregateSubjects.reduce(
    (a, c) => a + (parseInt(c.aggregate || c.grade) || 9),
    0,
  );

  // Missing subjects penalty (if student has fewer than 6 subjects total)
  const missingSubjectsCount = Math.max(0, 6 - aggregateSubjects.length);
  const aggregate = gradeSum + missingSubjectsCount * 9;

  return {
    trs: trsValue.toFixed(2),
    tas: tasValue.toFixed(2),
    aggregate,
  };
};

/**
 * Standard Competition Ranking (1, 2, 2, 4)
 * Handles ties by giving them the same rank and skipping subsequent ranks.
 */
export const calculateCompetitionRanking = (
  students: { id: string; total: number }[],
  targetId: string,
) => {
  if (!students.length) return { rank: 0, total: 0 };

  const sorted = [...students].sort((a, b) => b.total - a.total);
  let rank = 1;
  let targetRank = 0;

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].total < sorted[i - 1].total) {
      rank = i + 1;
    }
    if (sorted[i].id === targetId) {
      targetRank = rank;
      break;
    }
  }

  return { rank: targetRank, total: sorted.length };
};

/**
 * Calculates a student's total score for a subject based on report type.
 */
export const calculateStudentTotalScore = (
  s: any,
  reportType: string,
): number => {
  if (reportType === "End of Term") {
    // Priority: finalScore > classScore + exam50
    if (
      s.finalScore !== undefined &&
      s.finalScore !== null &&
      s.finalScore !== ""
    ) {
      return parseFloat(s.finalScore) || 0;
    }
    const classScore = parseFloat(s.classScore || 0);
    const exam50 = parseFloat(s.exam50 || 0);
    return parseFloat((classScore + exam50).toFixed(2));
  } else {
    // Mid-term / Mock
    if (
      s.finalScore !== undefined &&
      s.finalScore !== null &&
      s.finalScore !== ""
    ) {
      return parseFloat(s.finalScore) || 0;
    }
    return parseFloat(s.examsMark || 0);
  }
};

/**
 * Legacy support for simple grade string calculation
 */
/**
 * Calculates the TRS (Total Raw Score), TAS (Total Aggregate Score - 6 subjects),
 * and Aggregate (Sum of grades - 6 subjects) based on standard education metrics.
 */
export const calculatePerformanceMetrics = (
  subjects: Record<string, { grade: number; score: number }>,
) => {
  const coreList = [
    "mathematics",
    "maths",
    "core mathematics",
    "core maths",
    "science",
    "integrated science",
    "general science",
    "english",
    "english language",
    "social studies",
  ];

  // 1. TRS: Sum of ALL scores
  const trs = Object.values(subjects).reduce(
    (acc, curr) => acc + (curr.score || 0),
    0,
  );

  const isCore = (key: string) => {
    const k = key.toLowerCase().trim();
    return coreList.some((c) => k === c || k.startsWith(c) || c.startsWith(k));
  };

  // Split into Core and Electives
  const coreEntries = Object.keys(subjects)
    .filter((k) => isCore(k))
    .map((k) => subjects[k]);

  const electiveEntries = Object.keys(subjects)
    .filter((k) => !isCore(k))
    .map((k) => subjects[k]);

  const coreCount = Math.min(coreEntries.length, 4);
  const selectedCores = coreEntries.slice(0, coreCount);

  const electiveCount = Math.max(0, 6 - coreCount);
  const sortedElectives = [...electiveEntries].sort((a, b) => {
    const gradeDiff = (a.grade || 9) - (b.grade || 9);
    if (gradeDiff !== 0) return gradeDiff;
    return (b.score || 0) - (a.score || 0);
  });

  const selectedElectives = sortedElectives.slice(0, electiveCount);

  // The six subjects forming the Aggregate score
  const aggregateSubjects = [...selectedCores, ...selectedElectives];

  // 2. TAS (Total Aggregate Score): Sum of raw scores of ONLY the six subjects
  const tas = aggregateSubjects.reduce((a, b) => a + (b.score || 0), 0);

  // 3. Aggregate: Sum of grades of ONLY the six subjects
  const gradeSum = aggregateSubjects.reduce((a, b) => a + (b.grade || 9), 0);
  const missingSubjectsCount = Math.max(0, 6 - aggregateSubjects.length);
  const aggregate = gradeSum + missingSubjectsCount * 9;

  return {
    trs: trs.toFixed(2),
    tas: tas.toFixed(2),
    aggregate,
  };
};

/**
 * Safely converts any date format (Timestamp, Date, ISO string, seconds object, number)
 * into a JS Date object without throwing "toDate is not a function".
 */
export const parseDateSafely = (raw: any): Date | null => {
  if (!raw) return null;
  if (typeof raw.toDate === "function") {
    try {
      const result = raw.toDate();
      if (result instanceof Date && !isNaN(result.getTime())) return result;
    } catch (e) {
      // Fallback
    }
  }
  if (raw instanceof Date) {
    return isNaN(raw.getTime()) ? null : raw;
  }
  if (typeof raw === "number") {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof raw === "object" && raw.seconds !== undefined) {
    const d = new Date(raw.seconds * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof raw === "string") {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

