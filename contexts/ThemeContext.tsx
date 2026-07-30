import React, {
  createContext,
  ReactNode,
  useContext,
  useMemo,
} from "react";
import { Colors, ThemeColors } from "../constants/theme";

/* ===========================
   TYPES
=========================== */

export type ThemeContextValue = {
  theme: ThemeColors;
};

/* ===========================
   CONTEXT
=========================== */

const ThemeContext = createContext<ThemeContextValue>({
  theme: Colors.light,
});

/* ===========================
   PROVIDER
=========================== */

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // Always use light theme
  const activeScheme = "light";

  const value = useMemo(
    () => ({
      theme: Colors[activeScheme],
    }),
    [activeScheme],
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
