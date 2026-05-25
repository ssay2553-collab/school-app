import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";

export interface AcademicConfig {
  academicYear: string;
  currentTerm: string;
  termStart: any;
  termEnd: any;
  schoolName: string;
  loading: boolean;
}

export const useAcademicConfig = () => {
  const [config, setConfig] = useState<AcademicConfig>({
    academicYear: "",
    currentTerm: "Term 1",
    termStart: null,
    termEnd: null,
    schoolName: "",
    loading: true,
  });

  useEffect(() => {
    const configRef = doc(db, "school_settings", "academic_config");

    console.log(`[AcademicConfig] Subscribing to: school_settings/academic_config in project: ${db.app.options.projectId}`);

    const unsub = onSnapshot(configRef, { includeMetadataChanges: true }, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log(`[AcademicConfig] Data received from ${docSnap.metadata.fromCache ? 'cache' : 'server'}`);
        setConfig({
          academicYear: data.academicYear || "",
          currentTerm: data.currentTerm || "Term 1",
          termStart: data.termStart,
          termEnd: data.termEnd,
          schoolName: data.schoolName || "",
          loading: false,
        });
      } else {
        const source = docSnap.metadata.fromCache ? 'cache' : 'server';
        console.warn(`[AcademicConfig] Document missing in project: ${db.app.options.projectId} (Source: ${source})`);
        setConfig(prev => ({ ...prev, loading: false }));
      }
    }, (error) => {
      console.error("[AcademicConfig] Error fetching:", error);
      setConfig(prev => ({ ...prev, loading: false }));
    });

    return () => unsub();
  }, []);

  return config;
};
