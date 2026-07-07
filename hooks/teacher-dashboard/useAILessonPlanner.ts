import { useState, useEffect, useCallback, useMemo } from "react";
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../firebaseConfig";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { getTeacherClasses, sortClasses } from "../../lib/classHelpers";
import {
  CLASS_LEVELS,
  getClassLevelInfo,
  getCurriculumIndicators,
  getCurriculumLabels,
  getCurriculumStrands,
} from "../../constants/Curriculum";

const NACCA_CLASS_LEVELS = Object.keys(CLASS_LEVELS);

export const useAILessonPlanner = () => {
  const { appUser } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [weeklyUsage, setWeeklyUsage] = useState<Record<string, number>>({});
  const [availableClasses, setAvailableClasses] = useState<
    { id: string; name: string }[]
  >([]);
  const [generatedPlan, setGeneratedPlan] = useState<any>(null);
  const [editingField, setEditingField] = useState<{
    key: string;
    title: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [suggestedStrands, setSuggestedStrands] = useState<string[]>([]);
  const [suggestedIndicators, setSuggestedIndicators] = useState<{
    contentStandard: string;
    indicators: string[];
  } | null>(null);
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);

  const teacherSubjects = appUser?.subjects || [];
  const curriculum = appUser?.curriculum || "GES";
  const labels = getCurriculumLabels(curriculum);

  const [form, setForm] = useState({
    subject: teacherSubjects.length === 1 ? teacherSubjects[0] : "",
    strand: "",
    topic: "",
    classLevel: "",
    duration: "60 mins",
  });

  const fetchClasses = useCallback(async () => {
    const classIds = getTeacherClasses(appUser);
    if (classIds.length === 0) return;
    try {
      const q = query(
        collection(db, "classes"),
        where("__name__", "in", classIds),
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((doc) => ({
        id: doc.id,
        name: (doc.data() as any).name,
      }));
      const sorted = sortClasses(list);
      setAvailableClasses(sorted);

      if (sorted.length === 1) {
        setForm((prev) => ({ ...prev, classLevel: sorted[0].id }));
      }
    } catch (err) {
      console.error("Error fetching classes:", err);
    }
  }, [appUser]);

  const getStartOfWeek = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day;
    const startOfWeek = new Date(now.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);
    return startOfWeek;
  };

  const fetchWeeklyUsage = useCallback(async () => {
    if (!appUser?.uid) return;
    try {
      const startOfWeek = getStartOfWeek();
      const q = query(
        collection(db, "ai_generations"),
        where("userId", "==", appUser.uid),
        where("createdAt", ">=", Timestamp.fromDate(startOfWeek)),
      );
      const querySnapshot = await getDocs(q);

      const usage: Record<string, number> = {};
      querySnapshot.forEach((doc) => {
        const data = doc.data() as any;
        usage[data.subject] = (usage[data.subject] || 0) + 1;
      });
      setWeeklyUsage(usage);
    } catch (error) {
      console.error("Error fetching usage:", error);
    }
  }, [appUser?.uid]);

  useEffect(() => {
    if (appUser?.uid) {
      fetchWeeklyUsage();
      fetchClasses();
    }
  }, [appUser?.uid, fetchWeeklyUsage, fetchClasses]);

  useEffect(() => {
    if (form.subject && form.classLevel) {
      const strands = getCurriculumStrands(
        curriculum,
        form.subject,
        form.classLevel,
      );
      setSuggestedStrands(strands);
      setSuggestedIndicators(null);
      setSelectedIndicators([]);
    } else {
      setSuggestedStrands([]);
      setSuggestedIndicators(null);
      setSelectedIndicators([]);
    }
  }, [form.subject, form.classLevel, curriculum]);

  useEffect(() => {
    if (form.subject && form.classLevel && form.strand) {
      const standards = getCurriculumIndicators(
        curriculum,
        form.subject,
        form.classLevel,
        form.strand,
      );
      setSuggestedIndicators(standards);
      setSelectedIndicators([]);
    } else {
      setSuggestedIndicators(null);
      setSelectedIndicators([]);
    }
  }, [form.strand, form.subject, form.classLevel, curriculum]);

  const selectedClassName = useMemo(() =>
    availableClasses.find((c) => c.id === form.classLevel)?.name ||
    NACCA_CLASS_LEVELS.find((c) => c === form.classLevel) ||
    "", [availableClasses, form.classLevel]);

  const classLevelInfo = useMemo(() => getClassLevelInfo(
    selectedClassName || form.classLevel,
  ), [selectedClassName, form.classLevel]);

  const handleGenerate = async () => {
    if (teacherSubjects.length === 0) {
      showToast({
        message: "You have no subjects assigned to your profile. Please contact the administrator.",
        type: "error",
      });
      return;
    }

    if (
      !form.subject ||
      !form.strand ||
      !form.topic ||
      !form.classLevel ||
      !form.duration
    ) {
      showToast({ message: "Please fill in all details.", type: "error" });
      return;
    }

    if (suggestedIndicators && selectedIndicators.length === 0) {
      showToast({
        message: "Please select at least one learning indicator.",
        type: "error",
      });
      return;
    }

    const currentUsage = weeklyUsage[form.subject] || 0;
    if (currentUsage >= 3) {
      showToast({
        message: `You have reached your limit of 3 generations for ${form.subject} this week.`,
        type: "error",
      });
      return;
    }

    setLoading(true);

    try {
      const genFn = httpsCallable(functions, "generateLessonPlan");

      const { data } = await genFn({
        subject: form.subject,
        strand: form.strand,
        topic: form.topic,
        classLevel: selectedClassName || form.classLevel,
        duration: form.duration,
        ageRange: classLevelInfo.ageRange,
        curriculum: curriculum,
        selectedIndicators:
          selectedIndicators.length > 0
            ? selectedIndicators
            : suggestedIndicators?.indicators || [],
        contentStandard: suggestedIndicators?.contentStandard || "",
      });

      setGeneratedPlan(data);
      fetchWeeklyUsage();
    } catch (error: any) {
      console.error("AI Error:", error);
      let msg = "Could not generate plan. Please try again.";
      if (error.code === "resource-exhausted") msg = error.message;
      showToast({ message: msg, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToVault = async () => {
    if (!generatedPlan) return;

    try {
      setLoading(true);
      const selectedClassName =
        availableClasses.find((c) => c.id === form.classLevel)?.name ||
        form.classLevel;

      await addDoc(collection(db, "pedagogy_vault"), {
        userId: appUser?.uid,
        subject: form.subject,
        topic: form.topic,
        strand: form.strand,
        classLevel: selectedClassName,
        duration: form.duration,
        plan: generatedPlan,
        curriculum: curriculum,
        classLevelInfo: classLevelInfo,
        createdAt: serverTimestamp(),
      });
      showToast({
        message: "Lesson plan saved to the Pedagogy Vault.",
        type: "success",
      });
    } catch (error) {
      console.error("Save error:", error);
      showToast({ message: "Could not save to vault.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const openEditor = (key: string, title: string) => {
    const currentItems = generatedPlan[key] || [];
    if (typeof currentItems === "string") {
      setEditValue(currentItems);
    } else if (Array.isArray(currentItems)) {
      setEditValue(currentItems.join("\n"));
    } else {
      setEditValue(JSON.stringify(currentItems, null, 2));
    }
    setEditingField({ key, title });
  };

  const saveEdit = () => {
    if (editingField) {
      const currentVal = generatedPlan[editingField.key];
      let newValue: any;

      if (typeof currentVal === "string") {
        newValue = editValue;
      } else if (Array.isArray(currentVal)) {
        newValue = editValue.split("\n").filter((line) => line.trim() !== "");
      } else {
        try {
          newValue = JSON.parse(editValue);
        } catch {
          newValue = editValue;
        }
      }

      setGeneratedPlan({
        ...generatedPlan,
        [editingField.key]: newValue,
      });
      setEditingField(null);
    }
  };

  const remaining = 3 - (weeklyUsage[form.subject] || 0);

  return {
    loading,
    weeklyUsage,
    availableClasses,
    generatedPlan,
    setGeneratedPlan,
    editingField,
    setEditingField,
    editValue,
    setEditValue,
    suggestedStrands,
    suggestedIndicators,
    selectedIndicators,
    setSelectedIndicators,
    form,
    setForm,
    teacherSubjects,
    curriculum,
    labels,
    selectedClassName,
    classLevelInfo,
    handleGenerate,
    handleSaveToVault,
    openEditor,
    saveEdit,
    remaining,
    NACCA_CLASS_LEVELS
  };
};
