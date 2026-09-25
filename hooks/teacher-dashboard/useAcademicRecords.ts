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
import { sendNotification } from '../../src/services/notificationService';

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
  remarks?: string;
  maxScore?: number;
  status?: string;
}

export const useAcademicRecords = () => {
  const { appUser, firebaseUser } = useAuth();
  const acadConfig = useAcademicConfig();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [teacherClasses, setTeacherClasses] = useState<{ id: string; name: string; classTeacherId?: string }[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [reportType, setReportType] = useState<ReportType>("End of Term");
  const [reportNumber, setReportNumber] = useState(1);
  const [maxScore, setMaxScore] = useState<number>(100);
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

  const calculateScores = useCallback((student: StudentScoreRecord, type: ReportType, customMaxScore?: number) => {
    const updated = { ...student };
    const effectiveMaxScore = customMaxScore || maxScore || 100;
    if (type === "End of Term") {
      const classScoreRaw = parseFloat(updated.classScore) || 0;
      updated.classScore50 = classScoreRaw.toFixed(2);
      const examsMark = parseFloat(updated.examsMark) || 0;
      updated.exam50 = (examsMark * 0.5).toFixed(2);
      const finalScoreNum = parseFloat(updated.classScore50) + parseFloat(updated.exam50);
      updated.finalScore = finalScoreNum.toFixed(2);
      const gradeInfo = getGradeDetails(finalScoreNum, 100);
      updated.grade = gradeInfo.grade;
      updated.remarks = gradeInfo.remark;
      updated.maxScore = 100;
    } else {
      const examsMark = parseFloat(updated.examsMark) || 0;
      updated.finalScore = examsMark.toFixed(2);
      const gradeInfo = getGradeDetails(examsMark, effectiveMaxScore);
      updated.grade = gradeInfo.grade;
      updated.remarks = gradeInfo.remark;
      updated.maxScore = effectiveMaxScore;
      updated.classScore = "";
      updated.classScore50 = "0";
      updated.exam50 = "0";
    }
    return updated;
  }, [maxScore]);

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
            maxScore: reportType === "End of Term" ? 100 : maxScore,
            status: "draft",
          } as StudentScoreRecord;
        }).filter((s): s is StudentScoreRecord => s !== null);

        let docMaxScore = 100;
        if (docSnap.exists()) {
          const data = docSnap.data();
          docMaxScore = Number(data.maxScore) || 100;
          if (reportType !== "End of Term") {
            setMaxScore(docMaxScore);
          }
          const savedStudents = Array.isArray(data.students) ? data.students : [];

          // Merge logic: Use saved data if available, otherwise use default from class list
          const mergedStudents = activeClassStudents.map(activeStudent => {
            const saved = savedStudents.find((s: any) => s.studentId === activeStudent.studentId);
            if (saved) {
              return {
                ...calculateScores(saved, reportType, docMaxScore),
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

  const handleMaxScoreChange = useCallback((newMax: number) => {
    setMaxScore(newMax);
    setAllStudents(prev => prev.map(s => calculateScores(s, reportType, newMax)));
  }, [calculateScores, reportType]);

  const updateStudentScore = useCallback((studentId: string, field: keyof StudentScoreRecord, value: string) => {
    setAllStudents(prev => prev.map(s => {
      if (s.studentId !== studentId) return s;
      if (field === "classScore" && parseFloat(value) > 50) {
        showToast({ message: "Max 50% for Class Score", type: "error" });
        return s;
      }
      if (field === "examsMark") {
        if (reportType === "End of Term" && parseFloat(value) > 100) {
          showToast({ message: "Max score for End of Term Exam is 100", type: "error" });
          return s;
        }
        if (reportType !== "End of Term" && parseFloat(value) > maxScore) {
          showToast({ message: `Score cannot exceed total marks (${maxScore})`, type: "error" });
          return s;
        }
      }
      let updated = { ...s, [field]: value } as StudentScoreRecord;
      if (["classScore", "examsMark"].includes(field)) {
        updated = calculateScores(updated, reportType, maxScore);
      }
      return updated;
    }));
  }, [calculateScores, reportType, maxScore, showToast]);

  const saveRecord = async () => {
    if (!selectedClassId) {
      showToast({ message: "Please select a class before saving.", type: "error" });
      return false;
    }
    if (!selectedSubject) {
      showToast({ message: "Please select a subject before saving.", type: "error" });
      return false;
    }
    if (!academicYear || !term) {
      showToast({ message: "Academic year or term configuration is missing.", type: "error" });
      return false;
    }
    if (!firebaseUser?.uid) {
      showToast({ message: "Authentication error. Please re-login.", type: "error" });
      return false;
    }
    if (!allStudents || allStudents.length === 0) {
      showToast({ message: "No student records found to save.", type: "error" });
      return false;
    }

    try {
      setSaving(true);
      const batch = writeBatch(db);
      const yearSlug = academicYear.replace(/\//g, "-");
      const reportSlug = reportType.replace(/\s+/g, "");
      const numSuffix = ["Class Assessment Task (CAT)", "Trial Test", "Mock Exams"].includes(reportType) ? `_${reportNumber}` : "";
      const docId = `${selectedClassId}_${selectedSubject.replace(/\s+/g, "")}_${yearSlug}_${term.replace(/\s+/g, "")}_${reportSlug}${numSuffix}`;

      const effectiveMax = reportType === "End of Term" ? 100 : maxScore;

      const updatedStudents = allStudents.map(s => {
        const isFilled = reportType === "End of Term"
          ? s.classScore && s.classScore.trim() !== "" && s.examsMark && s.examsMark.trim() !== ""
          : s.examsMark && s.examsMark.trim() !== "";

        if (s.status === "approved") return s;

        return {
          ...s,
          maxScore: effectiveMax,
          status: isFilled ? "pending" : "draft"
        };
      });

      const overallStatus = updatedStudents.every(s => s.status === "approved")
        ? "approved"
        : updatedStudents.some(s => s.status === "approved")
          ? "partially_approved"
          : updatedStudents.every(s => s.status === "draft")
            ? "draft"
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
        maxScore: effectiveMax,
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

      // Send notifications to parents for non-draft students in chunks of 30
      try {
        const filledStudentIds = updatedStudents
          .filter(s => s.status !== "draft")
          .map(s => s.studentId);

        if (filledStudentIds.length > 0) {
          const staffName = `${appUser?.profile?.firstName || ''} ${appUser?.profile?.lastName || ''}`.trim() || "Teacher";

          for (let i = 0; i < filledStudentIds.length; i += 30) {
            const chunk = filledStudentIds.slice(i, i + 30);
            const qUsers = query(
              collection(db, "users"),
              where(documentId(), "in", chunk)
            );
            const snapUsers = await getDocs(qUsers);

            snapUsers.docs.forEach(uDoc => {
              const uData = uDoc.data();
              const parentUids = uData?.parentUids;
              if (Array.isArray(parentUids) && parentUids.length > 0) {
                const studentName = `${uData.profile?.firstName || ''} ${uData.profile?.lastName || ''}`.trim() || "Your ward";
                parentUids.forEach(parentId => {
                  sendNotification({
                    recipientId: parentId,
                    senderId: firebaseUser.uid,
                    senderName: staffName,
                    type: "score",
                    title: "New Exam Report Available 📊",
                    body: `${studentName}'s ${reportType} score for ${selectedSubject} (${term}, ${academicYear}) is now available.`,
                    data: {
                      studentId: uDoc.id,
                      classId: selectedClassId,
                      subject: selectedSubject,
                      academicYear,
                      term,
                      reportType
                    }
                  });
                });
              }
            });
          }
        }
      } catch (notifErr) {
        console.error("Error sending score notifications to parents:", notifErr);
      }

      if (isMounted.current) {
        setAllStudents(updatedStudents);
        setServerStudents(JSON.parse(JSON.stringify(updatedStudents)));
        setRecordStatus(overallStatus);
        showToast({ message: "Saved successfully.", type: "success" });
      }
      return true;
    } catch (err: any) {
      if (isMounted.current) {
        console.error("Save Record Error:", err);
        const errMsg = err?.message?.includes("permission-denied")
          ? "Permission denied. Ensure you are assigned as class teacher."
          : "Save failed. Please check network connection.";
        showToast({ message: errMsg, type: "error" });
      }
      return false;
    } finally {
      if (isMounted.current) {
        setSaving(false);
      }
    }
  };

  const hasUnsavedChanges = useMemo(() => JSON.stringify(allStudents) !== JSON.stringify(serverStudents), [allStudents, serverStudents]);

  return {
    loading,
    syncing,
    saving,
    teacherClasses,
    selectedClassId,
    setSelectedClassId,
    selectedSubject,
    setSelectedSubject,
    reportType,
    setReportType,
    reportNumber,
    setReportNumber,
    maxScore,
    handleMaxScoreChange,
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
