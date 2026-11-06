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

  // Check if Teacher on Duty is active (expires in future)
  if ((user as any).isTeacherOnDuty && (user as any).teacherOnDutyExpiresAt) {
    const expiresAt = (user as any).teacherOnDutyExpiresAt.toMillis
      ? (user as any).teacherOnDutyExpiresAt.toMillis()
      : new Date((user as any).teacherOnDutyExpiresAt).getTime();
    if (expiresAt > Date.now()) {
      return true; // Teacher on Duty has permission for all classes!
    }
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
export const getAutoRemarks = (
  aggregate: number,
  isTeacher: boolean = false,
) => {
  const agg = aggregate || 54;
  let remark = "";

  if (agg <= 10) {
    remark = isTeacher
      ? "An exceptionally brilliant student. Maintains high standards in all learning areas."
      : "An outstanding academic record. Your consistent excellence across all subjects is highly commendable. Keep it up!";
  } else if (agg <= 20) {
    remark = isTeacher
      ? "A very diligent and hardworking student. Shows great interest in all subjects."
      : "A very strong overall performance. You have demonstrated high competence in most areas. Maintain this focus.";
  } else if (agg <= 30) {
    remark = isTeacher
      ? "Good performance. Can do better if more attention is paid to details."
      : "A good performance overall. However, there is still room to convert your potentials into higher grades with extra effort.";
  } else if (agg <= 40) {
    remark = isTeacher
      ? "Average performance. Needs to be more serious with academic work."
      : "Average performance. You need to put in more study hours, especially in your core subjects, to improve your standing.";
  } else if (agg <= 50) {
    remark = isTeacher
      ? "Performance is below average. Requires intensive study and supervision."
      : "Performance is below expectations. You are capable of better results if you minimize distractions and focus on your studies.";
  } else {
    remark = isTeacher
      ? "Poor performance. Needs to repeat or seek remedial help."
      : "A very weak performance this term. Intensive remedial support and a change in study habits are urgently required.";
  }
  return remark;
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

