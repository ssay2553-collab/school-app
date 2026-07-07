import { useAcademicConfig as useGlobalAcademicConfig } from "../contexts/AcademicContext";

/**
 * Hook to access the global academic configuration.
 * This is now a wrapper around AcademicContext to avoid redundant listeners.
 */
export const useAcademicConfig = () => {
  return useGlobalAcademicConfig();
};
