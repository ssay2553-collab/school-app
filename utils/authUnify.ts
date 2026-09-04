import { SCHOOL_CONFIG } from "../constants/Config";

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
