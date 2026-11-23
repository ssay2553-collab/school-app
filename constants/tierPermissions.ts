export type SchoolCategory = "core" | "nova" | "premium" | "platinum";

export const BLOCKED_FEATURES_BY_TIER: Record<SchoolCategory, Set<string>> = {
  core: new Set([
    // Admin dashboard features blocked in Core
    "admin_staff_chat",
    "admin_teacher_stats",
    "admin_staff_attendance",
    "admin_payroll",
    "admin_groups",
    "admin_timetable",
    "admin_news",

    // Teacher dashboard features blocked in Core
    "teacher_my_classes",
    "teacher_timetable",
    "teacher_note",
    "teacher_weekly_topics",
    "teacher_student_profile",
    "teacher_assignments",
    "teacher_grading",
    "teacher_study_group",
    "teacher_staff_attendance",
    "teacher_coding_robotics",
    "teacher_curriculum_pdf",
    "teacher_pedagogy_resources",
    "teacher_broadcasts",
    "teacher_staff_chat",
    "teacher_parent_chat",

    // Student dashboard blocked in Core
    "student_dashboard",

    // Parent dashboard features blocked in Core (academic reports now enabled for Core)
    "parent_news",
    "parent_chat_teacher",
    "parent_weekly_topics",
  ]),

  nova: new Set([
    // Admin features blocked in Nova
    "admin_payroll",
    "admin_staff_chat",

    // Teacher features blocked in Nova (staff attendance enabled for Nova)
    "teacher_study_group",
    "teacher_broadcasts",
    "teacher_staff_chat",
    "teacher_parent_chat",

    // Parent features blocked in Nova
    "parent_chat_teacher",
  ]),

  premium: new Set([]),

  platinum: new Set([
    // Admin dashboard features blocked in Platinum
    "admin_daily_financials",
    "admin_other_charges",
    "admin_financial_summary",

    // Teacher features blocked in Platinum
    "teacher_behavioral_remarks",

    // Parent features blocked in Platinum
    "parent_behavioral_remarks",
  ]),
};

/**
 * Normalizes category string to valid SchoolCategory.
 */
export const normalizeCategory = (cat?: string): SchoolCategory => {
  if (!cat) return "premium";
  const lower = cat.trim().toLowerCase();
  if (lower.includes("core")) return "core";
  if (lower.includes("nova")) return "nova";
  if (lower.includes("platinum")) return "platinum";
  if (lower.includes("premium")) return "premium";
  return "premium";
};

/**
 * Returns true if the given feature is enabled for the specified school category.
 */
export const isFeatureEnabled = (
  category: string | undefined | null,
  featureId: string,
): boolean => {
  const normCat = normalizeCategory(category || undefined);
  const blockedSet = BLOCKED_FEATURES_BY_TIER[normCat] || BLOCKED_FEATURES_BY_TIER.platinum;
  return !blockedSet.has(featureId);
};
