import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocFromServer,
  getDocs,
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

export type ReportType = "End of Term" | "Mid-Term" | "Mock Exams" | "Class Assessment Task (CAT)" | "Trial Test";

export interface StudentScoreRecord {
  studentId: string;
  fullName: string;
  classScore: string;
  classScore50: string;
  examsMark: string;
  exam50: string;
  finalScore: string;
  grade: string;
  status?: string;
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
  const [reportNumber, setReportNumber] = useState(1);
  const [allStudents, setAllStudents] = useState<StudentScoreRecord[]>([]);
  const [serverStudents, setServerStudents] = useState<StudentScoreRecord[]>([]);
  const [recordStatus, setRecordStatus] = useState<string>("pending");
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

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
          const snap = await getDocs(q);
          const list = snap.docs.map(d => ({
            id: d.id,
            name: (d.data() as any).name || d.id,
            classTeacherId: (d.data() as any).classTeacherId,
          }));
          if (isMounted.current) {
            const sorted = sortClasses(list);
            setTeacherClasses(sorted);
            if (sorted.length > 0 && !selectedClassId) setSelectedClassId(sorted[0].id);
          }
        }

        const availableSubjects = appUser.subjects || [];
        if (availableSubjects.length > 0 && isMounted.current) {
          if (!selectedSubject || !availableSubjects.includes(selectedSubject)) {
             setSelectedSubject(availableSubjects[0]);
          }
        }
      } catch (err) {
        if (isMounted.current) console.error("fetchMetadata error:", err);
      } finally {
        if (isMounted.current) setLoading(false);
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
        const isNumbered = ["Class Assessment Task (CAT)", "Trial Test", "Mock Exams"].includes(reportType);
        const numSuffix = isNumbered ? `_${reportNumber || 1}` : "";
        const docId = `${selectedClassId}_${selectedSubject.replace(/\s+/g, "")}_${yearSlug}_${term.replace(/\s+/g, "")}_${reportSlug}${numSuffix}`;

        let docSnap = await getDoc(doc(db, "academicRecords", docId));
        if (!docSnap.exists() && isNumbered && Number(reportNumber) === 1) {
          const legacyDocId = `${selectedClassId}_${selectedSubject.replace(/\s+/g, "")}_${yearSlug}_${term.replace(/\s+/g, "")}_${reportSlug}`;
          docSnap = await getDoc(doc(db, "academicRecords", legacyDocId));
        }

        if (!isMounted) return;

        // Fetch current active students in the class to ensure anyone newly added is included
        const qUsers = query(
          collection(db, "users"),
          where("role", "==", "student"),
          where("classId", "==", selectedClassId)
        );
        const userSnap = await getDocs(qUsers);

        if (!isMounted) return;

        const activeClassStudents = userSnap.docs.map((d: any) => {
          const data = d.data();
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
            status: "draft",
          } as StudentScoreRecord;
        }).filter((s): s is StudentScoreRecord => s !== null);

        if (docSnap.exists()) {
          const data = docSnap.data();
          const savedStudents = Array.isArray(data.students) ? data.students : [];

          // Merge logic: Use saved data if available, otherwise use default from class list
          const mergedStudents = activeClassStudents.map(activeStudent => {
            const saved = savedStudents.find((s: any) => s.studentId === activeStudent.studentId);
            if (saved) {
              return {
                ...calculateScores(saved, reportType),
                status: saved.status || "pending"
              };
            }
            return activeStudent;
          }).sort((a, b) => a.fullName.localeCompare(b.fullName));

          setAllStudents(mergedStudents);
          setServerStudents(JSON.parse(JSON.stringify(mergedStudents)));
          setRecordStatus(data.status || "pending");
        } else {
          setRecordStatus("pending");
          const sortedList = activeClassStudents.sort((a, b) => a.fullName.localeCompare(b.fullName));
          setAllStudents(sortedList);
          setServerStudents(JSON.parse(JSON.stringify(sortedList)));
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
  }, [selectedClassId, selectedSubject, academicYear, term, reportType, reportNumber, calculateScores]);

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
      const numSuffix = ["Class Assessment Task (CAT)", "Trial Test", "Mock Exams"].includes(reportType) ? `_${reportNumber}` : "";
      const docId = `${selectedClassId}_${selectedSubject.replace(/\s+/g, "")}_${yearSlug}_${term.replace(/\s+/g, "")}_${reportSlug}${numSuffix}`;

      const updatedStudents = allStudents.map(s => {
        const isFilled = reportType === "End of Term"
          ? s.classScore && s.classScore.trim() !== "" && s.examsMark && s.examsMark.trim() !== ""
          : s.examsMark && s.examsMark.trim() !== "";

        if (s.status === "approved") return s;

        return {
          ...s,
          status: isFilled ? "pending" : "draft"
        };
      });

      const overallStatus = updatedStudents.every(s => s.status === "approved")
        ? "approved"
        : updatedStudents.some(s => s.status === "approved")
          ? "partially_approved"
          : "pending";

      batch.set(doc(db, "academicRecords", docId), {
        docId,
        teacherId: firebaseUser.uid,
        classId: selectedClassId,
        className: teacherClasses.find(c => c.id === selectedClassId)?.name || selectedClassId,
        subject: selectedSubject,
        academicYear,
        term,
        reportType,
        reportNumber: ["Class Assessment Task (CAT)", "Trial Test", "Mock Exams"].includes(reportType) ? reportNumber : null,
        students: updatedStudents,
        studentIds: updatedStudents.map(s => s.studentId),
        status: overallStatus,
        timestamp: serverTimestamp(),
        updatedAt: serverTimestamp(),
        containsBehavioralData: false,
      });

      updatedStudents.forEach(student => {
        if (student.status === "draft") return; // Don't update summary for drafts

        const summaryId = `${student.studentId}_${academicYear.replace(/\//g, "_")}_${term.replace(/\s+/g, "")}`;
        const typeKey = reportType.replace(/\s+/g, "");
        const subKey = ["Class Assessment Task (CAT)", "Trial Test", "Mock Exams"].includes(reportType) ? `${typeKey}${reportNumber}` : typeKey;
        const subjectKey = `${selectedSubject.replace(/\s+/g, "_")}_${subKey}`;
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
              status: student.status,
              lastUpdated: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
          },
        }, { merge: true });
      });

      await batch.commit();
      if (isMounted.current) {
        setAllStudents(updatedStudents);
        setServerStudents(JSON.parse(JSON.stringify(updatedStudents)));
        setRecordStatus(overallStatus);
        showToast({ message: "Saved successfully.", type: "success" });
      }
      return true;
    } catch (err) {
      if (isMounted.current) {
        console.error("Save Record Error:", err);
        showToast({ message: "Save failed.", type: "error" });
      }
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
    reportNumber,
    setReportNumber,
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
