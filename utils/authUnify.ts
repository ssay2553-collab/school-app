import { SCHOOL_CONFIG } from "../constants/Config";
import {
  collection,
  doc,
  DocumentData,
  DocumentSnapshot,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebaseConfig";

/**
 * Standardizes email construction for student usernames.
 * Ensures consistent domain across signup and login.
 */
export const getStudentFinalEmail = (input: string): string => {
  const cleanInput = (input || "").trim().toLowerCase().replace(/\s+/g, "");
  if (!cleanInput) return "";

  if (cleanInput.includes("@")) {
    return cleanInput;
  }

  const domainSlug = (SCHOOL_CONFIG.schoolId || 'student')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  return `${cleanInput}@${domainSlug}.edueaz.com`;
};

/**
 * Standardizes email construction for parent handles (phone, username, or name).
 * Ensures consistent domain for parents logging in without personal emails.
 */
export const getParentFinalEmail = (input: string): string => {
  const cleanInput = (input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (!cleanInput) return "";

  if ((input || "").includes("@")) {
    return (input || "").trim().toLowerCase();
  }

  const domainSlug = (SCHOOL_CONFIG.schoolId || 'school')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  return `${cleanInput}@parents.${domainSlug}.edueaz.com`;
};

/**
 * Validates basic email format.
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export interface ResolvedUserResult {
  userDoc: DocumentSnapshot<DocumentData> | null;
  userData: DocumentData | null;
  docId: string | null;
}

/**
 * Robustly fetches a user document from Firestore using multiple fallbacks.
 * Handles cases where:
 * 1. User document ID matches Auth UID (`doc(db, "users", uid)`).
 * 2. User document ID is custom/generated (e.g., `tempId` or legacy ID) and stores Auth UID in `uid` field.
 * 3. User document stores Auth UID in `authUid` field.
 * 4. User document matches `profile.email` or `email`.
 */
export const fetchUserDocAndData = async (
  uid: string,
  userEmail?: string
): Promise<ResolvedUserResult> => {
  if (!uid) {
    return { userDoc: null, userData: null, docId: null };
  }

  try {
    // 1. Direct document lookup by Auth UID
    const userDocRef = doc(db, "users", uid);
    const directSnap = await getDoc(userDocRef);

    if (directSnap.exists()) {
      const data = directSnap.data();
      const hasRoleInfo = !!(data?.role || data?.profile?.role || data?.adminRole);
      // If direct doc exists and contains role info, return immediately
      if (hasRoleInfo) {
        return { userDoc: directSnap, userData: data, docId: directSnap.id };
      }
    }

    // 2. Fallback query by `uid` field
    const qUid = query(
      collection(db, "users"),
      where("uid", "==", uid),
      limit(1)
    );
    const uidSnap = await getDocs(qUid);
    if (!uidSnap.empty) {
      const matched = uidSnap.docs[0];
      return { userDoc: matched, userData: matched.data(), docId: matched.id };
    }

    // 3. Fallback query by `authUid` field
    const qAuth = query(
      collection(db, "users"),
      where("authUid", "==", uid),
      limit(1)
    );
    const authSnap = await getDocs(qAuth);
    if (!authSnap.empty) {
      const matched = authSnap.docs[0];
      return { userDoc: matched, userData: matched.data(), docId: matched.id };
    }

    // 4. Fallback query by email if provided
    if (userEmail && userEmail.trim()) {
      const cleanEmail = userEmail.trim().toLowerCase();
      const qEmail = query(
        collection(db, "users"),
        where("profile.email", "==", cleanEmail),
        limit(1)
      );
      const emailSnap = await getDocs(qEmail);
      if (!emailSnap.empty) {
        const matched = emailSnap.docs[0];
        return { userDoc: matched, userData: matched.data(), docId: matched.id };
      }

      const qTopEmail = query(
        collection(db, "users"),
        where("email", "==", cleanEmail),
        limit(1)
      );
      const topEmailSnap = await getDocs(qTopEmail);
      if (!topEmailSnap.empty) {
        const matched = topEmailSnap.docs[0];
        return { userDoc: matched, userData: matched.data(), docId: matched.id };
      }
    }

    // 5. If direct doc existed (even if missing explicit role fields), return it as last resort
    if (directSnap.exists()) {
      return { userDoc: directSnap, userData: directSnap.data(), docId: directSnap.id };
    }
  } catch (err) {
    console.error("Error resolving user document in fetchUserDocAndData:", err);
  }

  return { userDoc: null, userData: null, docId: null };
};

/**
 * Robustly checks if a user (AppUser or Firestore data) has administrative privileges.
 */
export const isAdminUser = (user: any): boolean => {
  if (!user) return false;
  const role = (user.role || user.profile?.role || "").toLowerCase().trim();
  const adminRole = (user.adminRole || user.profile?.adminRole || "").toLowerCase().trim();
  const permissions = user.permissions || user.profile?.permissions || {};

  return (
    role.includes("admin") ||
    role.includes("super") ||
    role === "manager" ||
    adminRole !== "" ||
    role === "staff" ||
    role === "proprietor" ||
    role === "proprietress" ||
    role === "principal" ||
    role === "headmaster" ||
    role === "headmistress" ||
    role === "bursar" ||
    role === "accountant" ||
    role === "coordinator" ||
    permissions['manage-users'] === 'full' ||
    permissions['manage-fees'] === 'full'
  );
};

/**
 * Robustly checks if a user is a teacher or staff.
 */
export const isTeacherUser = (user: any): boolean => {
  if (!user) return false;
  const role = (user.role || user.profile?.role || "").toLowerCase().trim();
  const assignedRoles = user.assignedRoles || user.profile?.assignedRoles || [];
  return (
    role === "teacher" ||
    role === "staff" ||
    assignedRoles.includes("teacher") ||
    assignedRoles.includes("staff") ||
    (user.classes && user.classes.length > 0) ||
    (user.subjects && user.subjects.length > 0)
  );
};

/**
 * Robustly checks if a user is a parent.
 */
export const isParentUser = (user: any): boolean => {
  if (!user) return false;
  const role = (user.role || user.profile?.role || "").toLowerCase().trim();
  const assignedRoles = user.assignedRoles || user.profile?.assignedRoles || [];
  const childrenIds = user.childrenIds || user.profile?.childrenIds || [];
  return (
    role === "parent" ||
    assignedRoles.includes("parent") ||
    childrenIds.length > 0
  );
};

/**
 * Checks if a user is both a teacher and a parent (dual-role).
 */
export const isDualRoleTeacherParent = (user: any): boolean => {
  if (!user) return false;
  return isTeacherUser(user) && isParentUser(user);
};

/**
 * Robustly retrieves the profile image URL for any user object, doc, or profile data,
 * checking all possible field variations across platforms and roles.
 */
export const getProfileImageUrl = (userOrProfile: any): string | undefined => {
  if (!userOrProfile) return undefined;
  const profile = userOrProfile.profile || userOrProfile;
  return (
    profile?.profileImage ||
    profile?.photoURL ||
    userOrProfile.photoURL ||
    userOrProfile.profileImage ||
    profile?.profile_image ||
    undefined
  );
};



