import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";
import { Colors, ThemeColors } from "../constants/theme";

/* ===========================
   TYPES
=========================== */

export type ThemeContextValue = {
  theme: ThemeColors;
  isDarkMode: boolean;
  toggleTheme: () => void;
};

/* ===========================
   CONTEXT
=========================== */

const ThemeContext = createContext<ThemeContextValue>({
  theme: Colors.light,
  isDarkMode: false,
  toggleTheme: () => {},
});

/* ===========================
   PROVIDER
=========================== */

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const systemScheme = useColorScheme() === "dark" ? "dark" : "light";

  // null = follow system
  const [manualTheme, setManualTheme] = useState<"light" | "dark" | null>(null);

  const activeScheme = manualTheme ?? systemScheme;
  const isDarkMode = activeScheme === "dark";

  /* ✅ FIX: memoize toggleTheme */
  const toggleTheme = useCallback(() => {
    setManualTheme((prev) => {
      if (prev === null) {
        return systemScheme === "dark" ? "light" : "dark";
      }
      return prev === "dark" ? "light" : "dark";
    });
  }, [systemScheme]);

  /* ✅ FIXED dependency list */
  const value = useMemo(
    () => ({
      theme: Colors[activeScheme],
      isDarkMode,
      toggleTheme,
    }),
    [activeScheme, isDarkMode, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

/* ===========================
   HOOK
=========================== */

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export default ThemeProvider;
