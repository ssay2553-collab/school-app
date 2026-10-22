import {
    collection,
    doc,
    getDoc,
    getDocsFromServer,
    query,
    serverTimestamp,
    setDoc,
    where,
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CurriculumType } from "../../constants/Curriculum";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { db } from "../../firebaseConfig";
import {
    dedupeSubjects,
    getTeacherClasses,
    sortClasses,
} from "../../lib/classHelpers";
import { scheduleTimetableReminders } from "../../src/services/timetableScheduler";

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

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export const ensureValidPeriod = (p?: Partial<Period>): Period => ({
  id:
    p?.id && typeof p.id === "string" && p.id.trim().length > 0
      ? p.id
      : Date.now().toString() + Math.random().toString(36).substring(2, 9),
  subject: p?.subject && typeof p.subject === "string" ? p.subject : "",
  startTime: p?.startTime && typeof p.startTime === "string" ? p.startTime : "",
  endTime: p?.endTime && typeof p.endTime === "string" ? p.endTime : "",
  isCustom: Boolean(p?.isCustom),
});

const sanitizeDayArray = (list?: any[], targetLength = 12): Period[] => {
  const arr = Array.isArray(list) ? list : [];
  const len = Math.max(arr.length, targetLength);
  const result: Period[] = [];
  for (let i = 0; i < len; i++) {
    result.push(ensureValidPeriod(arr[i]));
  }
  return result;
};

const sanitizeDaysMap = (
  daysObj?: any,
  targetLength = 12,
): Record<string, Period[]> => {
  const result: Record<string, Period[]> = {};
  DAYS.forEach((day) => {
    const rawList = daysObj && typeof daysObj === "object" ? daysObj[day] : [];
    result[day] = sanitizeDayArray(rawList, targetLength);
  });
  return result;
};

export const useManageTimetable = () => {
  const { appUser } = useAuth();
  const { showToast } = useToast();

  const [classes, setClasses] = useState<ClassData[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [curriculum, setCurriculum] = useState<CurriculumType>(
    appUser?.curriculum || "GES",
  );
  const [timetableDays, setTimetableDays] = useState<Record<string, Period[]>>(
    {},
  );
  const [numColumns, setNumColumnsState] = useState(6);
  const [customSubjects, setCustomSubjects] = useState<string[]>([]);

  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const generateId = () =>
    Date.now().toString() + Math.random().toString(36).substring(2, 9);

  const setNumColumns = useCallback((newCols: number) => {
    const validCols = Math.max(1, Math.min(20, newCols));
    setNumColumnsState(validCols);
    setTimetableDays((prev) => sanitizeDaysMap(prev, Math.max(validCols, 12)));
  }, []);

  // Extract subjects specified in teacher profile
  const userTeacherSubjects = useMemo(() => {
    const list1 = Array.isArray(appUser?.subjects) ? appUser.subjects : [];
    const list2 = Array.isArray((appUser?.profile as any)?.subjects)
      ? (appUser?.profile as any).subjects
      : [];
    return dedupeSubjects([...list1, ...list2]);
  }, [appUser]);

  useEffect(() => {
    if (userTeacherSubjects.length > 0) {
      setCustomSubjects((prev) =>
        dedupeSubjects([...prev, ...userTeacherSubjects]),
      );
    }
  }, [userTeacherSubjects]);

  // Fetch classes
  useEffect(() => {
    const fetchClasses = async () => {
      if (!appUser) return;
      setLoadingClasses(true);
      try {
        const role = appUser.role?.toLowerCase();
        const isAdmin =
          role === "admin" ||
          role === "superadmin" ||
          role === "super admin" ||
          !!(appUser as any).adminRole;

        let list: ClassData[] = [];

        if (isAdmin) {
          // Admins can manage all classes
          const snap = await getDocsFromServer(collection(db, "classes"));
          list = snap.docs.map((d) => ({
            id: d.id,
            name: (d.data() as any).name || d.id,
            curriculum: (d.data() as any).curriculum,
          }));
        } else {
          const classIds = getTeacherClasses(appUser);
          if (classIds.length === 0) {
            setLoadingClasses(false);
            return;
          }

          // Use in query for specific classes, Firestore limit is 30 for 'in'
          const q = query(
            collection(db, "classes"),
            where("__name__", "in", classIds.slice(0, 30)),
          );
          const snap = await getDocsFromServer(q);
          list = snap.docs.map((d) => ({
            id: d.id,
            name: (d.data() as any).name || d.id,
            curriculum: (d.data() as any).curriculum,
          }));
        }

        if (isMounted.current) {
          const sorted = sortClasses(list);
          setClasses(sorted);
          if (sorted.length > 0 && !selectedClass) {
            setSelectedClass(sorted[0].id);
            if (sorted[0].curriculum) setCurriculum(sorted[0].curriculum);
          }
        }
      } catch (err) {
        if (isMounted.current) console.error("fetchClasses error:", err);
      } finally {
        if (isMounted.current) setLoadingClasses(false);
      }
    };
    fetchClasses();
  }, [appUser, selectedClass]);

  // Load timetable data
  const loadTimetable = useCallback(
    async (classId: string) => {
      if (!classId) return;
      setLoadingData(true);
      try {
        const docRef = doc(db, "timetables", classId);
        const snap = await getDoc(docRef);

        let classSubjects: string[] = [];
        try {
          const classSnap = await getDoc(doc(db, "classes", classId));
          if (classSnap.exists()) {
            const cData = classSnap.data();
            if (Array.isArray(cData.subjects)) {
              classSubjects = cData.subjects.filter(
                (s: any) => typeof s === "string" && s.trim().length > 0,
              );
            }
          }
        } catch (e) {
          console.warn("Could not load class subjects:", e);
        }

        if (!isMounted.current) return;

        const savedPeriodSubjects: string[] = [];

        if (snap.exists()) {
          const data = snap.data();
          const cols = Number(data.numColumns) || 6;
          setNumColumnsState(cols);
          setTimetableDays(sanitizeDaysMap(data.days, Math.max(cols, 12)));
          if (data.curriculum) setCurriculum(data.curriculum);

          if (data.days && typeof data.days === "object") {
            Object.values(data.days).forEach((periodList: any) => {
              if (Array.isArray(periodList)) {
                periodList.forEach((p: any) => {
                  if (p && typeof p.subject === "string" && p.subject.trim()) {
                    savedPeriodSubjects.push(p.subject.trim());
                  }
                });
              }
            });
          }

          const savedCustom = Array.isArray(data.customSubjects)
            ? data.customSubjects
            : [];

          setCustomSubjects((prev) => [
            ...new Set([
              ...prev,
              ...userTeacherSubjects,
              ...classSubjects,
              ...savedCustom,
              ...savedPeriodSubjects,
            ]),
          ]);
        } else {
          // Initialize empty timetable
          setNumColumnsState(6);
          setTimetableDays(sanitizeDaysMap({}, 12));

          setCustomSubjects((prev) => [
            ...new Set([...prev, ...userTeacherSubjects, ...classSubjects]),
          ]);
        }
      } catch (err) {
        if (isMounted.current) console.error("loadTimetable error:", err);
      } finally {
        if (isMounted.current) setLoadingData(false);
      }
    },
    [userTeacherSubjects],
  );

  useEffect(() => {
    if (selectedClass) {
      loadTimetable(selectedClass);
      const cls = classes.find((c) => c.id === selectedClass);
      if (cls?.curriculum) setCurriculum(cls.curriculum);
    }
  }, [selectedClass, loadTimetable, classes]);

  const updatePeriod = useCallback(
    (day: string, col: number, updates: Partial<Period>) => {
      setTimetableDays((prev) => {
        const dayList = [...(prev[day] || [])];
        while (dayList.length <= col) {
          dayList.push(ensureValidPeriod());
        }
        dayList[col] = ensureValidPeriod({ ...dayList[col], ...updates });
        return { ...prev, [day]: dayList };
      });
    },
    [],
  );

  const updateColumnPeriod = useCallback(
    (col: number, updates: Partial<Period>) => {
      setTimetableDays((prev) => {
        const next = { ...prev };
        DAYS.forEach((day) => {
          const dayList = [...(next[day] || [])];
          while (dayList.length <= col) {
            dayList.push(ensureValidPeriod());
          }
          dayList[col] = ensureValidPeriod({ ...dayList[col], ...updates });
          next[day] = dayList;
        });
        return next;
      });
    },
    [],
  );

  const saveTimetable = async () => {
    if (!selectedClass) return;
    setSaving(true);
    try {
      const cleanDays: Record<string, Period[]> = {};
      const usedSubjects = new Set<string>();

      DAYS.forEach((day) => {
        const dayList = timetableDays[day] || [];
        const cleanList: Period[] = [];
        const targetLen = Math.max(numColumns, dayList.length);
        for (let i = 0; i < targetLen; i++) {
          const p = ensureValidPeriod(dayList[i]);
          cleanList.push(p);
          if (p.subject && p.subject.trim()) {
            usedSubjects.add(p.subject.trim());
          }
        }
        cleanDays[day] = cleanList;
      });

      const allCustomSubjects = [
        ...new Set([...customSubjects, ...Array.from(usedSubjects)]),
      ];

      const payload = {
        classId: selectedClass,
        days: cleanDays,
        numColumns,
        curriculum: curriculum || "GES",
        customSubjects: allCustomSubjects,
        lastUpdated: serverTimestamp(),
        updatedBy: appUser?.uid || "teacher",
      };

      await setDoc(doc(db, "timetables", selectedClass), payload, {
        merge: true,
      });

      // After saving to DB, schedule local reminders for valid lessons
      const flatLessons: any[] = [];
      DAYS.forEach((day) => {
        (cleanDays[day] || []).slice(0, numColumns).forEach((period) => {
          if (
            period.subject &&
            period.subject.trim() &&
            period.startTime &&
            period.endTime
          ) {
            flatLessons.push({
              subject: period.subject.trim(),
              startTime: period.startTime.trim(),
              endTime: period.endTime.trim(),
              day: day,
            });
          }
        });
      });

      await scheduleTimetableReminders(flatLessons);

      if (isMounted.current) {
        showToast({
          message: "Timetable saved and reminders scheduled! 🎉",
          type: "success",
        });
      }
    } catch (err: any) {
      if (isMounted.current) {
        console.error("saveTimetable error:", err);
        showToast({
          message: `Failed to save timetable: ${err?.message || "Error"}`,
          type: "error",
        });
      }
    } finally {
      if (isMounted.current) {
        setSaving(false);
      }
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
    updateColumnPeriod,
    saveTimetable,
    customSubjects,
    setCustomSubjects,
    generateId,
  };
};
