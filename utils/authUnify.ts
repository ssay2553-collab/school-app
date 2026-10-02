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

