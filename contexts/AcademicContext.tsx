import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { AppState, AppStateStatus } from "react-native";
import { db } from "../firebaseConfig";
import { useAuth } from "./AuthContext";

export interface AcademicConfig {
  academicYear: string;
  currentTerm: string;
  termStart: any;
  termEnd: any;
  nextTermBegins: string;
  schoolName: string;
  extraClassesRate: number;
  loading: boolean;
}

const AcademicContext = createContext<AcademicConfig | undefined>(undefined);

export const AcademicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { firebaseUser } = useAuth();
  const [config, setConfig] = useState<AcademicConfig>({
    academicYear: "",
    currentTerm: "",
    termStart: null,
    termEnd: null,
    nextTermBegins: "",
    schoolName: "",
    extraClassesRate: 0,
    loading: true,
  });

  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const startListener = () => {
      if (!firebaseUser) {
        console.log("[AcademicContext] No user, skipping listener.");
        setConfig(prev => ({ ...prev, loading: false }));
        return;
      }

      if (unsubRef.current) return;

      const configRef = doc(db, "school_settings", "academic_config");
      console.log("[AcademicContext] Subscribing to global academic config...");

      unsubRef.current = onSnapshot(configRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setConfig({
            academicYear: data.academicYear || "",
            currentTerm: data.currentTerm || "",
            termStart: data.termStart,
            termEnd: data.termEnd,
            nextTermBegins: data.nextTermBegins || "",
            schoolName: data.schoolName || "",
            extraClassesRate: data.extraClassesRate || 0,
            loading: false,
          });
        } else {
          console.warn("[AcademicContext] No academic_config document found");
          setConfig(prev => ({ ...prev, loading: false }));
        }
      }, (error) => {
        console.error("[AcademicContext] Error fetching:", error);
        setConfig(prev => ({ ...prev, loading: false }));
      });
    };

    const stopListener = () => {
      if (unsubRef.current) {
        console.log("[AcademicContext] Unsubscribing from academic config...");
        unsubRef.current();
        unsubRef.current = null;
      }
    };

    // Handle AppState changes for background/foreground
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        startListener();
      } else if (nextAppState.match(/inactive|background/)) {
        stopListener();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Initial start
    startListener();

    return () => {
      subscription.remove();
      stopListener();
    };
  }, [firebaseUser]);

  return (
    <AcademicContext.Provider value={config}>
      {children}
    </AcademicContext.Provider>
  );
};

export const useAcademicConfig = () => {
  const context = useContext(AcademicContext);
  if (context === undefined) {
    throw new Error("useAcademicConfig must be used within an AcademicProvider");
  }
  return context;
};
