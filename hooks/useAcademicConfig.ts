import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";

export interface AcademicConfig {
  academicYear: string;
  currentTerm: string;
  termStart: any;
  termEnd: any;
  loading: boolean;
}

export const useAcademicConfig = () => {
  const [config, setConfig] = useState<AcademicConfig>({
    academicYear: "",
    currentTerm: "Term 1",
    termStart: null,
    termEnd: null,
    loading: true,
  });

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "school_settings", "academic_config"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setConfig({
          academicYear: data.academicYear || "",
          currentTerm: data.currentTerm || "Term 1",
          termStart: data.termStart,
          termEnd: data.termEnd,
          loading: false,
        });
      } else {
        setConfig(prev => ({ ...prev, loading: false }));
      }
    }, (error) => {
      console.error("Error fetching academic config:", error);
      setConfig(prev => ({ ...prev, loading: false }));
    });

    return () => unsub();
  }, []);

  return config;
};
