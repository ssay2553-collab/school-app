import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocFromServer,
  getDocsFromServer,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { useAcademicConfig } from '../useAcademicConfig';
import { useToast } from '../../contexts/ToastContext';
import { getGradeDetails, sortClasses } from '../../lib/classHelpers';

export type ReportType = "End of Term" | "Mid-Term" | "Mock Exams";

export interface StudentScoreRecord {
  studentId: string;
  fullName: string;
  classScore: string;
  classScore50: string;
  examsMark: string;
  exam50: string;
  finalScore: string;
  grade: string;
}

export const useAcademicRecords = () => {
  const { appUser, firebaseUser } = useAuth();
  const acadConfig = useAcademicConfig();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [teacherClasses, setTeacherClasses] = useState<{ id: string; name: string; classTeacherId?: string }[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [reportType, setReportType] = useState<ReportType>("End of Term");
  const [allStudents, setAllStudents] = useState<StudentScoreRecord[]>([]);
  const [serverStudents, setServerStudents] = useState<StudentScoreRecord[]>([]);
  const [recordStatus, setRecordStatus] = useState<string>("pending");

  const academicYear = acadConfig.academicYear || "";
  const term = acadConfig.currentTerm || "";

  const calculateScores = useCallback((student: StudentScoreRecord, type: ReportType) => {
    const updated = { ...student };
    if (type === "End of Term") {
      const classScoreRaw = parseFloat(updated.classScore) || 0;
      updated.classScore50 = classScoreRaw.toFixed(2);
      const examsMark = parseFloat(updated.examsMark) || 0;
      updated.exam50 = (examsMark * 0.5).toFixed(2);
      const finalScoreNum = parseFloat(updated.classScore50) + parseFloat(updated.exam50);
      updated.finalScore = finalScoreNum.toFixed(2);
      updated.grade = getGradeDetails(finalScoreNum).grade;
    } else {
      const examsMark = parseFloat(updated.examsMark) || 0;
      updated.finalScore = examsMark.toFixed(2);
      updated.grade = getGradeDetails(examsMark).grade;
      updated.classScore = "";
      updated.classScore50 = "0";
      updated.exam50 = "0";
    }
    return updated;
  }, []);

  useEffect(() => {
    if (!appUser) return;
    const fetchMetadata = async () => {
      setLoading(true);
      try {
        const classIds = appUser.classes || [];
        if (classIds.length > 0) {
          const q = query(collection(db, "classes"), where(documentId(), "in", classIds));
          const snap = await getDocsFromServer(q);
          const list = snap.docs.map(d => ({
            id: d.id,
            name: (d.data() as any).name || d.id,
            classTeacherId: (d.data() as any).classTeacherId,
          }));
          const sorted = sortClasses(list);
          setTeacherClasses(sorted);
          if (sorted.length > 0 && !selectedClassId) setSelectedClassId(sorted[0].id);
        }

        const availableSubjects = appUser.subjects || [];
        if (availableSubjects.length > 0) {
          if (!selectedSubject || !availableSubjects.includes(selectedSubject)) {
             setSelectedSubject(availableSubjects[0]);
          }
        }
      } catch (err) {
        console.error("fetchMetadata error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMetadata();
  }, [appUser]);

  useEffect(() => {
    let isMounted = true;

    const performSync = async () => {
      if (!selectedClassId || !selectedSubject || !academicYear || !term) {
        setAllStudents([]);
        setServerStudents([]);
        return;
      }

      setSyncing(true);
      // Immediately clear students to avoid showing stale data from previous class
      setAllStudents([]);
      setServerStudents([]);

      try {
        const yearSlug = academicYear.replace(/\//g, "-");
        const reportSlug = reportType.replace(/\s+/g, "");
        const docId = `${selectedClassId}_${selectedSubject.replace(/\s+/g, "")}_${yearSlug}_${term.replace(/\s+/g, "")}_${reportSlug}`;

        // Force server fetch to ensure we don't get cached data from a different class/context
        const docSnap = await getDocFromServer(doc(db, "academicRecords", docId)).catch(() => getDoc(doc(db, "academicRecords", docId)));

        if (!isMounted) return;

        if (docSnap.exists()) {
          const data = docSnap.data();
          const loadedStudents = (data.students || []).map((s: StudentScoreRecord) => calculateScores(s, reportType));
          setAllStudents(loadedStudents);
          setServerStudents(JSON.parse(JSON.stringify(loadedStudents)));
          setRecordStatus(data.status || "pending");
        } else {
          setRecordStatus("pending");
          // If no ledger exists, fetch students of the selected class
          // We use the same query pattern as Daily Attendance to ensure compatibility with indexes
          const q = query(
            collection(db, "users"),
            where("role", "==", "student"),
            where("classId", "==", selectedClassId)
          );
          const snap = await getDocsFromServer(q);

          if (!isMounted) return;

          const list = snap.docs.map((d: any) => {
            const data = d.data();
            // Filter by status manually to match Daily Attendance logic and avoid rule complexity
            const status = data.status || (data.profile && data.profile.status) || "active";
            if (!["active", "pending_activation"].includes(status)) return null;

            return {
              studentId: d.id,
              fullName: `${data.profile?.firstName || ""} ${data.profile?.lastName || ""}`.trim() || "Unknown Student",
              classScore: "",
              classScore50: "0",
              examsMark: "",
              exam50: "0",
              finalScore: "0",
              grade: "N/A",
            };
          }).filter((s): s is StudentScoreRecord => s !== null).sort((a, b) => a.fullName.localeCompare(b.fullName));

          setAllStudents(list);
          setServerStudents(JSON.parse(JSON.stringify(list)));
        }
      } catch (err) {
        console.error("syncRecords error:", err);
      } finally {
        if (isMounted) setSyncing(false);
      }
    };

    performSync();

    return () => {
      isMounted = false;
    };
  }, [selectedClassId, selectedSubject, academicYear, term, reportType, calculateScores]);

  const updateStudentScore = useCallback((studentId: string, field: keyof StudentScoreRecord, value: string) => {
    setAllStudents(prev => prev.map(s => {
      if (s.studentId !== studentId) return s;
      if (field === "classScore" && parseFloat(value) > 50) {
        showToast({ message: "Max 50% for Class Score", type: "error" });
        return s;
      }
      let updated = { ...s, [field]: value } as StudentScoreRecord;
      if (["classScore", "examsMark"].includes(field)) {
        updated = calculateScores(updated, reportType);
      }
      return updated;
    }));
  }, [calculateScores, reportType, showToast]);

  const saveRecord = async () => {
    if (!selectedClassId || !selectedSubject || !term || !academicYear || !firebaseUser?.uid) return;
    try {
      const batch = writeBatch(db);
      const yearSlug = academicYear.replace(/\//g, "-");
      const reportSlug = reportType.replace(/\s+/g, "");
      const docId = `${selectedClassId}_${selectedSubject.replace(/\s+/g, "")}_${yearSlug}_${term.replace(/\s+/g, "")}_${reportSlug}`;

      batch.set(doc(db, "academicRecords", docId), {
        docId,
        teacherId: firebaseUser.uid,
        classId: selectedClassId,
        className: teacherClasses.find(c => c.id === selectedClassId)?.name || selectedClassId,
        subject: selectedSubject,
        academicYear,
        term,
        reportType,
        students: allStudents,
        studentIds: allStudents.map(s => s.studentId),
        timestamp: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: "pending",
        containsBehavioralData: false,
      });

      allStudents.forEach(student => {
        const summaryId = `${student.studentId}_${academicYear.replace(/\//g, "_")}_${term.replace(/\s+/g, "")}`;
        const subjectKey = `${selectedSubject.replace(/\s+/g, "_")}_${reportType.replace(/\s+/g, "")}`;
        batch.set(doc(db, "academicRecordsSummary", summaryId), {
          teacherId: firebaseUser.uid,
          studentId: student.studentId,
          classId: selectedClassId,
          academicYear,
          term,
          scores: {
            [subjectKey]: {
              finalScore: parseFloat(student.finalScore) || 0,
              grade: student.grade,
              reportType,
              status: "pending",
              lastUpdated: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
          },
        }, { merge: true });
      });

      await batch.commit();
      setServerStudents(JSON.parse(JSON.stringify(allStudents)));
      showToast({ message: "Saved successfully.", type: "success" });
      return true;
    } catch (err) {
      console.error("Save Record Error:", err);
      showToast({ message: "Save failed.", type: "error" });
      return false;
    }
  };

  const hasUnsavedChanges = useMemo(() => JSON.stringify(allStudents) !== JSON.stringify(serverStudents), [allStudents, serverStudents]);

  return {
    loading,
    syncing,
    teacherClasses,
    selectedClassId,
    setSelectedClassId,
    selectedSubject,
    setSelectedSubject,
    reportType,
    setReportType,
    allStudents,
    updateStudentScore,
    saveRecord,
    hasUnsavedChanges,
    academicYear,
    term,
    subjects: appUser?.subjects || [],
    recordStatus,
  };
};
