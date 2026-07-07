import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocsFromServer,
  query,
  setDoc,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getTeacherClasses, sortClasses } from '../../lib/classHelpers';
import { CurriculumType } from '../../constants/Curriculum';

export type Period = {
  id: string;
  subject: string;
  startTime: string;
  endTime: string;
  isCustom: boolean;
};

export type ClassData = {
  id: string;
  name: string;
  curriculum?: CurriculumType;
};

export const useManageTimetable = () => {
  const { appUser } = useAuth();
  const { showToast } = useToast();

  const [classes, setClasses] = useState<ClassData[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [curriculum, setCurriculum] = useState<CurriculumType>(appUser?.curriculum || "GES");
  const [timetableDays, setTimetableDays] = useState<Record<string, Period[]>>({});
  const [numColumns, setNumColumns] = useState(6);
  const [customSubjects, setCustomSubjects] = useState<string[]>([]);

  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);

  const generateId = () => Date.now().toString() + Math.random().toString(36).substring(2, 9);

  // Fetch classes
  useEffect(() => {
    const fetchClasses = async () => {
      if (!appUser) return;
      setLoadingClasses(true);
      try {
        const classIds = getTeacherClasses(appUser);
        if (classIds.length === 0) {
          setLoadingClasses(false);
          return;
        }

        const q = query(collection(db, "classes"), where("__name__", "in", classIds.slice(0, 10)));
        const snap = await getDocsFromServer(q);
        const list = snap.docs.map(d => ({
          id: d.id,
          name: (d.data() as any).name || d.id,
          curriculum: (d.data() as any).curriculum
        }));
        const sorted = sortClasses(list);
        setClasses(sorted);
        if (sorted.length > 0 && !selectedClass) {
          setSelectedClass(sorted[0].id);
          if (sorted[0].curriculum) setCurriculum(sorted[0].curriculum);
        }
      } catch (err) {
        console.error("fetchClasses error:", err);
      } finally {
        setLoadingClasses(false);
      }
    };
    fetchClasses();
  }, [appUser, selectedClass]);

  // Load timetable data
  const loadTimetable = useCallback(async (classId: string) => {
    if (!classId) return;
    setLoadingData(true);
    try {
      const docRef = doc(db, "timetables", classId);
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        const data = snap.data();
        setNumColumns(data.numColumns || 6);
        setTimetableDays(data.days || {});
        if (data.curriculum) setCurriculum(data.curriculum);
      } else {
        // Initialize empty timetable
        const initialDays: Record<string, Period[]> = {};
        ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].forEach(day => {
          initialDays[day] = Array.from({ length: 12 }, () => ({
            id: generateId(),
            subject: "",
            startTime: "",
            endTime: "",
            isCustom: false
          }));
        });
        setTimetableDays(initialDays);
        setNumColumns(6);
      }
    } catch (err) {
      console.error("loadTimetable error:", err);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (selectedClass) {
      loadTimetable(selectedClass);
      const cls = classes.find(c => c.id === selectedClass);
      if (cls?.curriculum) setCurriculum(cls.curriculum);
    }
  }, [selectedClass, loadTimetable, classes]);

  const updatePeriod = useCallback((day: string, col: number, updates: Partial<Period>) => {
    setTimetableDays(prev => {
      const newDay = [...(prev[day] || [])];
      newDay[col] = { ...newDay[col], ...updates };
      return { ...prev, [day]: newDay };
    });
  }, []);

  const saveTimetable = async () => {
    if (!selectedClass) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "timetables", selectedClass), {
        classId: selectedClass,
        days: timetableDays,
        numColumns,
        curriculum,
        lastUpdated: serverTimestamp(),
        updatedBy: appUser?.uid
      });
      showToast({ message: "Timetable saved successfully!", type: "success" });
    } catch (err) {
      console.error("saveTimetable error:", err);
      showToast({ message: "Failed to save timetable.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return {
    classes,
    selectedClass,
    setSelectedClass,
    curriculum,
    setCurriculum,
    timetableDays,
    numColumns,
    setNumColumns,
    loadingClasses,
    loadingData,
    saving,
    updatePeriod,
    saveTimetable,
    customSubjects,
    setCustomSubjects,
    generateId,
  };
};
