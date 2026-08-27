export type UserRole = "admin" | "teacher" | "parent" | "student" | "staff";
export type PermissionLevel = "full" | "view" | "edit" | "deny";

export interface User {
  uid: string;
  username?: string;
  pin?: string;
  email?: string;
  profile: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    gender?: string;
    profileImage?: string;
    emergencyPhone?: string;
    parentPhone?: string;
  };
  role: UserRole;
  adminRole?: string;
  classes?: string[];
  subjects?: string[];
  classTeacherOf?: string;
  classId?: string;
  assignedRoles?: string[];
  departmentHeadOf?: string;
  childrenIds?: string[];
  parentUids?: string[];
  canCreateNews?: boolean;
  permissions?: Record<string, PermissionLevel>;
  signupCode?: string;
  secretCode?: string;
  dateOfBirth?: any;
  walletBalance?: number;
  dailyArrears?: number;
  termArrears?: Record<string, number>;
  onScholarship?: boolean;
  onDiscount?: boolean;
  discountAmount?: number;
  takesBus?: boolean;
  busLocation?: string;
  isFeeding?: boolean;
  takesExtraClasses?: boolean;
  status: "active" | "archived" | "disabled" | string;
  archivedAt?: any;
  archivedInYear?: string;
}

export const roles: { name: string; role: UserRole; icon: string }[] = [
  { name: "Admins", role: "admin", icon: "shield-checkmark" },
  { name: "Teachers", role: "teacher", icon: "people" },
  { name: "Staff", role: "staff", icon: "briefcase" },
  { name: "Parents", role: "parent", icon: "home" },
  { name: "Students", role: "student", icon: "school" },
];

export const PERMISSION_KEYS = [
  { key: "news", label: "News & Announcements" },
  { key: "manage-fees", label: "Manage Fees & Billing" },
  { key: "manage-sales", label: "Financial Records (Sales)" },
  { key: "feeding", label: "Feeding Recording" },
  { key: "record-bus-fee", label: "Bus Fee Recording" },
  { key: "record-extra-classes", label: "Extra Classes Recording" },
  { key: "attendance", label: "Attendance Management" },
  { key: "academic-records", label: "Academic Records" },
  { key: "scores", label: "Scores & Grading" },
  { key: "behavioral-records", label: "Behavioral Records" },
  { key: "assignments", label: "Assignments & Homework" },
  { key: "staff-payroll", label: "Staff Payroll" },
  { key: "expenditure", label: "Expenditure" },
  { key: "manage-users", label: "Manage Users" },
  { key: "timetables", label: "Timetable Management" },
  { key: "academic-calendar", label: "Academic Calendar" },
  { key: "settings", label: "School Settings & Rates" },
  { key: "student-groups", label: "Student Study Groups" },
  { key: "parent-chat", label: "Parent Communication" },
  { key: "staff-chat", label: "Internal Staff Chat" },
];

export const PERMISSION_LEVELS: { label: string; value: PermissionLevel }[] = [
  { label: "Full Control", value: "full" },
  { label: "View Only", value: "view" },
  { label: "Can Edit", value: "edit" },
  { label: "Deny Access", value: "deny" },
];

export type AssignmentModalType =
  | "none"
  | "assign_as"
  | "class_teacher"
  | "dept_head"
  | "permissions"
  | "other"
  | "edit_profile"
  | "upgrade_staff"
  | "manage_classes"
  | "manage_subjects"
  | "promote_repeat";

export interface AssignmentModalState {
  type: AssignmentModalType;
  target: User | null;
}
