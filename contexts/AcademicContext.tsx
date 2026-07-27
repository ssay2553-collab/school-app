import React, { createContext, useContext, useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";

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

  useEffect(() => {
    const configRef = doc(db, "school_settings", "academic_config");

    console.log("[AcademicContext] Subscribing to global academic config...");

    const unsub = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log("[AcademicContext] Data received:", data);
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
        console.warn("[AcademicContext] No academic_config document found at school_settings/academic_config");
        setConfig(prev => ({ ...prev, loading: false }));
      }
    }, (error) => {
      console.error("[AcademicContext] Error fetching:", error);
      setConfig(prev => ({ ...prev, loading: false }));
    });

    return () => unsub();
  }, []);

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
