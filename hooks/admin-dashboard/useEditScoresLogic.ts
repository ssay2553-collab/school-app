import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocsFromServer,
  query,
  where,
  writeBatch,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { sortClasses, calculateCompetitionRanking } from "../../lib/classHelpers";
import { ReportType } from "../../components/admin-dashboard/StudentScoreCard";

interface SubjectInfo {
  name: string;
  status: string;
  reportType: ReportType;
  hasBehavioral?: boolean;
}

interface UseEditScoresLogicProps {
  appUser: any;
  acadConfig: any;
  showToast: (options: { message: string; type: "success" | "error" | "info" | "warning" }) => void;
}

export const useEditScoresLogic = ({ appUser, acadConfig, showToast }: UseEditScoresLogicProps) => {
  const [loading, setLoading] = useState(true);
  const [fetchingSubjects, setFetchingSubjects] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [listLoading, setListLoading] = useState(false);

  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [subjects, setSubjects] = useState<SubjectInfo[]>([]);
  const [selectedReportType, setSelectedReportType] = useState<ReportType>("End of Term");
  const [searchQuery, setSearchQuery] = useState("");

  const [recordId, setRecordId] = useState<string | null>(null);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [visibleStudents, setVisibleStudents] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const masterDataRef = useRef<Record<string, any>>({});
  const initialDataRef = useRef<string>("[]");
  const initialDataMapRef = useRef<Map<string, string>>(new Map());

  const selectedYear = acadConfig.academicYear || "";
  const term = acadConfig.currentTerm || "";

  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(allStudents) !== initialDataRef.current;
  }, [allStudents]);

  const selectedClassName = useMemo(() => {
    return classes.find((c) => c.id === selectedClassId)?.name || selectedClassId;
  }, [classes, selectedClassId]);

  const filteredStudents = useMemo(() => {
    if (!searchQuery) return allStudents;
    const q = searchQuery.toLowerCase();
    return allStudents.filter(
      (s) =>
        s.fullName?.toLowerCase().includes(q) ||
        s.studentId?.toLowerCase().includes(q)
    );
  }, [allStudents, searchQuery]);

  const loadClasses = async () => {
    try {
      const snap = await getDocsFromServer(collection(db, "classes") as any);
      const list = snap.docs.map((d) => ({
        id: d.id,
        name: (d.data() as any).name || d.id,
      }));
      const sorted = sortClasses(list);
      setClasses(sorted);
      return sorted;
    } catch (err) {
      console.error("Error loading classes:", err);
      return [];
    }
  };

  useEffect(() => {
    if (!appUser) return;
    let isMounted = true;
    const init = async () => {
      try {
        const list = await loadClasses();
        if (list.length > 0 && isMounted) setSelectedClassId(list[0].id);
      } catch (err) {
        if (isMounted) console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    init();
    return () => { isMounted = false; };
  }, [appUser]);

  const fetchSubjects = useCallback(async () => {
    if (!selectedClassId || !selectedYear || !term) return;
    setFetchingSubjects(true);
    try {
      const q = query(
        collection(db, "academicRecords"),
        where("classId", "==", selectedClassId),
        where("academicYear", "==", selectedYear),
        where("term", "==", term),
        where("reportType", "==", selectedReportType)
      );
      const snap = await getDocsFromServer(q);
      const subsList: SubjectInfo[] = snap.docs
        .map((d) => {
          const data = d.data() as any;
          return {
            name: data.subject,
            status: data.status || "pending",
            reportType: data.reportType || "End of Term",
            hasBehavioral: data.containsBehavioralData,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      if (isMounted.current) {
        setSubjects(subsList);
        if (subsList.length > 0) {
          if (!selectedSubject || !subsList.find((s) => s.name === selectedSubject)) {
            setSelectedSubject(subsList[0].name);
          }
        } else {
          setSelectedSubject("");
        }
        setFetchingSubjects(false);
      }
    } catch (err) {
      if (isMounted.current) {
        console.error("fetchSubjects Error:", err);
        setFetchingSubjects(false);
      }
    }
  }, [selectedClassId, selectedYear, term, selectedReportType, selectedSubject]);

  useEffect(() => {
    if (selectedClassId && selectedYear && term) {
      fetchSubjects();
    }
  }, [selectedClassId, selectedYear, term, selectedReportType, fetchSubjects]);

  const loadSubmission = async (subjectOverride?: string) => {
    const subject = subjectOverride || selectedSubject;
    if (!selectedClassId || !subject || !selectedYear || !term) {
      return showToast({
        message: "Please select Year, Class and Subject.",
        type: "error",
      });
    }
    setListLoading(true);
    try {
      const yearSlug = selectedYear.replace(/\//g, "-");
      const reportSlug = selectedReportType.replace(/\s+/g, "");
      const docId = `${selectedClassId}_${subject.replace(/\s+/g, "")}_${yearSlug}_${term.replace(/\s+/g, "")}_${reportSlug}`;
      const snap = await getDoc(doc(db, "academicRecords", docId));
      if (snap.exists()) {
        setRecordId(snap.id);
        const data = snap.data() as any;
        const students = Array.isArray(data.students) ? data.students : [];
        masterDataRef.current = {};
        setAllStudents(students);
        initialDataRef.current = JSON.stringify(students);
        initialDataMapRef.current.clear();
        students.forEach((s: any) => {
          if (s && s.studentId) {
            initialDataMapRef.current.set(s.studentId, JSON.stringify(s));
          }
        });
        setVisibleStudents(students.slice(0, PAGE_SIZE));
        if (isMounted.current) {
          setPage(1);
        }
      } else {
        if (isMounted.current) {
          showToast({
            message: `No submissions found for ${selectedSubject} in the selected period.`,
            type: "info",
          });
          setRecordId(null);
          setAllStudents([]);
          initialDataRef.current = "[]";
          initialDataMapRef.current.clear();
          setVisibleStudents([]);
        }
      }
    } catch (err) {
      if (isMounted.current) {
        console.error(err);
        showToast({ message: "Failed to load records.", type: "error" });
      }
    } finally {
      if (isMounted.current) {
        setListLoading(false);
      }
    }
  };

  const loadMoreStudents = useCallback(() => {
    setVisibleStudents((prev) => {
      if (prev.length >= filteredStudents.length) return prev;
      const nextPage = Math.floor(prev.length / PAGE_SIZE) + 1;
      setPage(nextPage);
      return filteredStudents.slice(0, nextPage * PAGE_SIZE);
    });
  }, [filteredStudents]);

  useEffect(() => {
    setVisibleStudents(filteredStudents.slice(0, page * PAGE_SIZE));
  }, [filteredStudents, page]);

  const onUpdateRef = useCallback((id: string, updated: any) => {
    masterDataRef.current[id] = updated;
    setAllStudents((prev) => {
      const index = prev.findIndex((s) => s.studentId === id);
      if (index === -1) return prev;
      const next = [...prev];
      next[index] = updated;
      return next;
    });
  }, []);

  const approveAndSave = async () => {
    if (!recordId || allStudents.length === 0) return;
    const studentsToSave = allStudents.map(
      (s) => masterDataRef.current[s.studentId] || s
    );

    if (selectedReportType === "End of Term") {
      const invalid = studentsToSave.find((s) => parseFloat(s.classScore) > 50);
      if (invalid) {
        return showToast({
          message: `${invalid.fullName}'s Class Score must not be above 50%.`,
          type: "error",
        });
      }
    }

    setSaving(true);
    try {
      const batch = writeBatch(db);
      const recordRef = doc(db, "academicRecords", recordId);

      const subjectScoresList = studentsToSave.map((s) => ({
        id: s.studentId,
        total: parseFloat(s.finalScore) || 0,
      }));

      batch.update(recordRef, {
        students: studentsToSave.map((s) => {
          const rankInfo = calculateCompetitionRanking(
            subjectScoresList,
            s.studentId
          );
          return {
            ...s,
            position: `${rankInfo.rank}/${rankInfo.total}`,
          };
        }),
        status: studentsToSave.every((s) => s.status === "approved")
          ? "approved"
          : "partially_approved",
        approvedAt: serverTimestamp(),
        approvedBy: appUser?.uid,
      });

      studentsToSave.forEach((student) => {
        const yearSlug = selectedYear.replace(/\//g, "_");
        const termSlug = term.replace(/\s+/g, "");
        const summaryId = `${student.studentId}_${yearSlug}_${termSlug}`;
        const summaryRef = doc(db, "academicRecordsSummary", summaryId);
        const subjectKey = `${selectedSubject.replace(/\s+/g, "_")}_${selectedReportType.replace(/\s+/g, "")}`;

        const rankInfo = calculateCompetitionRanking(
          subjectScoresList,
          student.studentId
        );

        batch.set(
          summaryRef,
          {
            studentId: student.studentId,
            classId: selectedClassId,
            academicYear: selectedYear,
            term: term,
            scores: {
              [subjectKey]: {
                finalScore: parseFloat(student.finalScore) || 0,
                grade: student.grade,
                position: `${rankInfo.rank}/${rankInfo.total}`,
                reportType: selectedReportType,
                status: student.status || "pending",
                lastUpdated: serverTimestamp(),
              },
            },
          },
          { merge: true }
        );
      });

      await batch.commit();

      if (isMounted.current) {
        initialDataRef.current = JSON.stringify(studentsToSave);
        initialDataMapRef.current.clear();
        studentsToSave.forEach((s: any) => {
          initialDataMapRef.current.set(s.studentId, JSON.stringify(s));
        });

        setAllStudents(studentsToSave);
        showToast({
          message: "Scores updated and records marked as approved.",
          type: "success",
        });
        fetchSubjects();
      }
    } catch (err) {
      if (isMounted.current) {
        console.error(err);
        showToast({ message: "Update failed.", type: "error" });
      }
    } finally {
      if (isMounted.current) {
        setSaving(false);
      }
    }
  };

  const deleteSubmission = async () => {
    if (!recordId) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "academicRecords", recordId));
      showToast({ message: "Submission record deleted successfully.", type: "success" });
      setRecordId(null);
      setAllStudents([]);
      setVisibleStudents([]);
      fetchSubjects();
    } catch (err) {
      console.error(err);
      showToast({ message: "Deletion failed.", type: "error" });
    } finally {
      setDeleting(false);
    }
  };

  const classStats = useMemo(() => {
    if (allStudents.length === 0) return { avg: "0.00", graded: 0, high: "0.00" };
    const scores = allStudents
      .map((s) => parseFloat(s.finalScore) || 0)
      .filter((s) => s > 0);

    const graded = scores.length;
    const totalScore = allStudents.reduce((sum, s) => sum + (parseFloat(s.finalScore) || 0), 0);
    const high = scores.length > 0 ? Math.max(...scores).toFixed(2) : "0.00";

    return {
      avg: (totalScore / allStudents.length).toFixed(2),
      graded,
      high,
    };
  }, [allStudents]);

  return {
    loading,
    saving,
    deleting,
    listLoading,
    classes,
    selectedClassId,
    setSelectedClassId,
    selectedSubject,
    setSelectedSubject,
    subjects,
    selectedReportType,
    setSelectedReportType,
    searchQuery,
    setSearchQuery,
    recordId,
    allStudents,
    visibleStudents,
    loadSubmission,
    loadMoreStudents,
    onUpdateRef,
    approveAndSave,
    deleteSubmission,
    classStats,
    hasUnsavedChanges,
    selectedClassName,
    selectedYear,
    term
  };
};
