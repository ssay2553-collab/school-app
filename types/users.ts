// users.ts

export type UserRole = "guest" | "admin" | "teacher" | "parent" | "student";

export type PermissionLevel = "full" | "view" | "edit" | "deny";

export interface UserProfile {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  profileImage?: string;
  signatureUrl?: string;
}

export interface AppUser {
  uid: string;

  // Core identity
  role: UserRole;
  isAnonymous?: boolean;

  // Profile
  profile?: UserProfile;
  dateOfBirth?: any; // Firestore Timestamp

  // Account state
  status?: "active" | "approved" | "pending" | "disabled" | string;

  // Permissions
  canCreateNews?: boolean;

  // Updated: Flexible admin roles and permission mapping
  adminRole?: string;
  permissions?: Record<string, PermissionLevel>;

  // Teacher only
  classes?: string[];
  subjects?: string[];
  departments?: string[];
  classTeacherOf?: string;
  assignedRoles?: string[];

  // Student only
  classId?: string;
  parentUids?: string[];
  parentLinkCode?: string;

  // Parent only
  childrenIds?: string[];
  childrenClassIds?: string[];

  // Metadata
  createdAt?: any;
}
