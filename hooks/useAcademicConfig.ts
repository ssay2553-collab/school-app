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
      const isFromCache = docSnap.metadata.fromCache;

      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log(`[AcademicConfig] Data received from ${isFromCache ? 'cache' : 'server'}`);
        setConfig({
          academicYear: data.academicYear || "",
          currentTerm: data.currentTerm || "Term 1",
          termStart: data.termStart,
          termEnd: data.termEnd,
          schoolName: data.schoolName || "",
          loading: false,
        });
      } else {
        // Only stop loading if we are sure it doesn't exist on the server.
        // If it's just a cache miss, stay in loading state until the server responds.
        if (!isFromCache) {
          console.warn(`[AcademicConfig] Document DEFINITIVELY missing on server in project: ${db.app.options.projectId}`);
          setConfig(prev => ({ ...prev, loading: false }));
        } else {
          console.log("[AcademicConfig] Cache miss, waiting for server...");
        }
      }
    }, (error) => {
      console.error("[AcademicConfig] Error fetching:", error);
      setConfig(prev => ({ ...prev, loading: false }));
    });

    return () => unsub();
  }, []);

  return config;
};
