import * as ImagePicker from "expo-image-picker";
import {
  collection,
  doc,
  getDoc,
  getDocsFromServer,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Platform } from "react-native";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { db } from "../../firebaseConfig";
import {
  calculateCompetitionRanking,
  getAutoRemarks,
  getGradeDetails,
  sortClasses,
} from "../../lib/classHelpers";
import { useAcademicConfig } from "../useAcademicConfig";

const storage = getStorage();

export type ReportType = "End of Term" | "Mid-Term" | "Mock Exams";

export interface ScoreData {
  id: string;
  studentId: string;
  fullName: string;
  total: number;
  position: number;
  grade: string;
  aggregate?: number; // Sum of grades (1-9) for Core 3 + Best 3
  tas?: number; // Sum of raw scores for Core 3 + Best 3
  conduct?: string;
  attitude?: string;
  interest?: string;
  teacherRemarks?: string;
}

export interface ClassStats {
  average: number;
  passRate: number;
  studentCount: number;
}

export function useViewAcademicRecords() {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const acadConfig = useAcademicConfig();

  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [fetchingSubjects, setFetchingSubjects] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [uploadingSig, setUploadingSig] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState<string>(
    (appUser?.profile as any)?.signatureUrl || "",
  );

  const [classes, setClasses] = useState<any[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);

  const primary = SCHOOL_CONFIG.primaryColor || "#2e86de";

  const availableYears = useMemo(() => {
    const start = 2024;
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = start; y <= currentYear + 3; y++) {
      years.push(`${y}/${y + 1}`);
    }
    if (acadConfig.academicYear && !years.includes(acadConfig.academicYear)) {
      years.push(acadConfig.academicYear);
    }
    return Array.from(new Set(years)).sort().reverse();
  }, [acadConfig.academicYear]);

  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [term, setTerm] = useState("");
  const [selectedReportType, setSelectedReportType] =
    useState<ReportType>("End of Term");

  const [studentScores, setStudentScores] = useState<ScoreData[]>([]);
  const [stats, setStats] = useState<ClassStats | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Metadata Editor State
  const [metadataModalVisible, setMetadataModalVisible] = useState(false);
  const [editingStudent, setEditingStudent] = useState<ScoreData | null>(null);
  const [mConduct, setConduct] = useState("Excellent");
  const [mAttitude, setAttitude] = useState("Very Positive");
  const [mInterest, setInterest] = useState("High");
  const [mPromotedTo, setPromotedTo] = useState("");
  const [mNextTermBegins, setNextTermBegins] = useState("");
  const [globalNextTermBegins, setGlobalNextTermBegins] = useState("");
  const [globalPromotedTo, setGlobalPromotedTo] = useState("");
  const [showNextTermPicker, setShowNextTermPicker] = useState(false);
  const [showGlobalNextTermPicker, setShowGlobalNextTermPicker] = useState(false);
  const [mAdminRemarks, setAdminRemarks] = useState("");
  const [mTeacherRemarks, setTeacherRemarks] = useState("");

  const [recalculating, setRecalculating] = useState(false);

  // Sync with global academic config
  useEffect(() => {
    if (!acadConfig.loading) {
      setSelectedYear(acadConfig.academicYear);
      setTerm(acadConfig.currentTerm);
    }
  }, [acadConfig]);

  // Use onSnapshot for real-time subject list updates
  useEffect(() => {
    if (!selectedClassId || !selectedYear || !term) return;

    setFetchingSubjects(true);
    const q = query(
      collection(db, "academicRecords"),
      where("classId", "==", selectedClassId),
      where("academicYear", "==", selectedYear),
      where("term", "==", term),
      where("reportType", "==", selectedReportType),
      where("status", "==", "approved"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const subs = snap.docs.map((d) => (d.data() as any).subject).sort();
        setAvailableSubjects(subs);

        if (subs.length > 0) {
          if (!selectedSubject || !subs.includes(selectedSubject)) {
            setSelectedSubject(subs[0]);
          }
        } else {
          setSelectedSubject("");
        }
        setFetchingSubjects(false);
        setRefreshing(false);
      },
      (error) => {
        console.error("onSnapshot Error:", error);
        setFetchingSubjects(false);
        setRefreshing(false);
      },
    );

    return () => unsubscribe();
  }, [selectedClassId, selectedYear, term, selectedReportType]);

  const loadData = useCallback(async () => {
    if (!selectedClassId || !selectedSubject) {
      return showToast({
        message: "Please select a class and an approved subject.",
        type: "error",
      });
    }

    setListLoading(true);
    setHasSearched(true);

    try {
      // 1. Fetch ALL approved records for this class to calculate aggregates
      const allRecordsSnap = await getDocsFromServer(
        query(
          collection(db, "academicRecords"),
          where("classId", "==", selectedClassId),
          where("academicYear", "==", selectedYear),
          where("term", "==", term),
          where("status", "==", "approved"),
        ),
      );

      // Map to store every student's data across all subjects
      const studentPerformanceMap: Record<
        string,
        {
          fullName: string;
          subjects: Record<string, { grade: number; score: number }>;
          subjectScore?: number;
        }
      > = {};
      const coreSubjects = ["mathematics", "science", "english"];

      allRecordsSnap.docs.forEach((doc) => {
        const data = doc.data() as any;
        const subName = (data.subject || "").toLowerCase();
        const students = data.students || [];

        students.forEach((s: any) => {
          if (!studentPerformanceMap[s.studentId]) {
            studentPerformanceMap[s.studentId] = {
              fullName: s.fullName,
              subjects: {},
            };
          }

          let scoreValue = 0;
          if (data.reportType === "End of Term") {
            scoreValue = parseFloat(
              s.finalScore ||
                (
                  parseFloat(s.classScore || 0) + parseFloat(s.exam50 || 0)
                ).toFixed(2),
            );
          } else {
            scoreValue = parseFloat(s.finalScore || s.examsMark || 0);
          }

          const grade = parseInt(getGradeDetails(scoreValue).grade) || 9;
          studentPerformanceMap[s.studentId].subjects[subName] = {
            grade,
            score: scoreValue,
          };

          if (subName === selectedSubject.toLowerCase()) {
            studentPerformanceMap[s.studentId].subjectScore = scoreValue;
          }
        });
      });

      const processed = Object.keys(studentPerformanceMap)
        .filter((sid) => studentPerformanceMap[sid].subjectScore !== undefined)
        .map((sid) => {
          const p = studentPerformanceMap[sid];
          const subs = p.subjects;

          // Core 3
          const coreEntries = Object.keys(subs)
            .filter((k) => coreSubjects.includes(k))
            .map((k) => subs[k]);

          // Best 3 Electives
          const electiveEntries = Object.keys(subs)
            .filter((k) => !coreSubjects.includes(k))
            .map((k) => subs[k])
            .sort((a, b) => a.grade - b.grade); // Sort by grade (lower is better)

          const coreGradeSum =
            coreEntries.reduce((a, b) => a + b.grade, 0) +
            Math.max(0, 3 - coreEntries.length) * 9;
          const electiveGradeSum =
            electiveEntries.slice(0, 3).reduce((a, b) => a + b.grade, 0) +
            Math.max(0, 3 - electiveEntries.length) * 9;
          const aggregate = coreGradeSum + electiveGradeSum;

          const coreScoreSum = coreEntries.reduce((a, b) => a + b.score, 0);
          const electiveScoreSum = electiveEntries
            .slice(0, 3)
            .reduce((a, b) => a + b.score, 0);
          const tas = coreScoreSum + electiveScoreSum;

          return {
            id: sid,
            studentId: sid,
            fullName: p.fullName,
            total: p.subjectScore || 0,
            grade: getGradeDetails(p.subjectScore || 0).grade,
            aggregate: aggregate,
            tas: tas,
          };
        })
        .sort((a, b) => b.total - a.total)
        .map((s, i) => ({ ...s, position: i + 1 }));

      setStudentScores(processed);

      if (processed.length > 0) {
        const sumValue = processed.reduce(
          (acc: number, curr: any) => acc + curr.total,
          0,
        );
        setStats({
          average: parseFloat((sumValue / processed.length).toFixed(2)),
          studentCount: processed.length,
          passRate: 100,
        });
      } else {
        setStats(null);
      }
    } catch (e) {
      console.error("Load Data Error:", e);
      showToast({ message: "Could not fetch records.", type: "error" });
    } finally {
      setListLoading(false);
    }
  }, [
    selectedClassId,
    selectedSubject,
    selectedYear,
    term,
    selectedReportType,
    showToast
  ]);

  const loadClassesList = async () => {
    try {
      const snap = await getDocsFromServer(collection(db, "classes") as any);
      const list = snap.docs.map((d) => ({
        id: d.id,
        name: (d.data() as any)?.name || d.id,
      }));
      const sorted = sortClasses(list);
      setClasses(sorted);
      if (sorted.length > 0 && !selectedClassId)
        setSelectedClassId(sorted[0].id);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const init = async () => {
      await loadClassesList();
      setLoading(false);
    };
    init();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
  };

  const handleEditMetadata = async (student: ScoreData) => {
    setEditingStudent(student);

    // 1. Initial Defaults
    setConduct("Excellent");
    setAttitude("Very Positive");
    setInterest("High");
    setTeacherRemarks("");
    setPromotedTo("");
    setNextTermBegins("");

    // 2. Fetch Behavioral Records from Teacher Module (Source of truth for conduct/remarks)
    try {
      const yearSlug = selectedYear.replace(/\//g, "-");
      const termSlug = term.replace(/\s+/g, "");
      const behDocId = `behavioral_${selectedClassId}_${yearSlug}_${termSlug}`;
      const behSnap = await getDoc(doc(db, "behavioralRecords", behDocId));

      if (behSnap.exists()) {
        const behData = behSnap.data();
        const studentBeh = (behData.students || []).find(
          (s: any) => s.studentId === student.studentId,
        );
        if (studentBeh) {
          if (studentBeh.conduct) setConduct(studentBeh.conduct);
          if (studentBeh.attitude) setAttitude(studentBeh.attitude);
          if (studentBeh.interest) setInterest(studentBeh.interest);
          if (studentBeh.teacherRemarks)
            setTeacherRemarks(studentBeh.teacherRemarks);
          if (studentBeh.promotedTo) setPromotedTo(studentBeh.promotedTo);
        }
      }
    } catch (e) {
      console.log("Error fetching behavioral defaults:", e);
    }

    // Auto-generate admin remarks based on OVERALL Aggregate performance
    const agg = student.aggregate || 54;
    const autoAdminRemarks = getAutoRemarks(agg, false);
    const autoTeacherRemarks = getAutoRemarks(agg, true);

    setAdminRemarks(autoAdminRemarks);
    setTeacherRemarks(autoTeacherRemarks);

    setMetadataModalVisible(true);

    // 3. Fetch existing metadata from student-reports if it exists (Admin overrides)
    try {
      const reportId =
        `${student.studentId}_${selectedYear}_${term}_${selectedReportType.replace(/\s+/g, "")}`.replace(
          /\//g,
          "-",
        );
      const snap = await getDoc(doc(db, "student-reports", reportId));
      if (snap.exists()) {
        const d = snap.data() as any;
        if (d.assessment?.conduct) setConduct(d.assessment.conduct);
        if (d.assessment?.attitude) setAttitude(d.assessment.attitude);
        if (d.assessment?.interest) setInterest(d.assessment.interest);
        if (d.promotedTo) setPromotedTo(d.promotedTo);
        if (d.nextTermBegins) setNextTermBegins(d.nextTermBegins);
        // Only override auto-remarks if they actually exist in DB
        if (d.adminRemarks) setAdminRemarks(d.adminRemarks);
        if (d.teacherRemarks) setTeacherRemarks(d.teacherRemarks);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const saveMetadata = async () => {
    if (!editingStudent) return;
    setSavingMetadata(true);
    try {
      const reportId =
        `${editingStudent.studentId}_${selectedYear}_${term}_${selectedReportType.replace(/\s+/g, "")}`.replace(
          /\//g,
          "-",
        );
      await setDoc(
        doc(db, "student-reports", reportId),
        {
          studentId: editingStudent.studentId,
          studentName: editingStudent.fullName,
          academicYear: selectedYear,
          term: term,
          reportType: selectedReportType,
          classId: selectedClassId,
          assessment: {
            conduct: mConduct,
            attitude: mAttitude,
            interest: mInterest,
          },
          promotedTo: mPromotedTo,
          nextTermBegins: mNextTermBegins,
          adminRemarks: mAdminRemarks,
          teacherRemarks: mTeacherRemarks,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      setMetadataModalVisible(false);
      showToast({
        message: "Terminal metadata saved for " + editingStudent.fullName,
        type: "success",
      });
    } catch (e) {
      console.error(e);
      showToast({ message: "Failed to save metadata.", type: "error" });
    } finally {
      setSavingMetadata(false);
    }
  };

  const handleUploadSignature = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [2, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets[0].uri) {
        setUploadingSig(true);
        const uri = result.assets[0].uri;
        const response = await fetch(uri);
        const blob = await response.blob();
        const storageRef = ref(storage, `signatures/${appUser?.uid}`);
        await uploadBytes(storageRef, blob);
        const downloadURL = await getDownloadURL(storageRef);

        await updateDoc(doc(db, "users", appUser!.uid), {
          "profile.signatureUrl": downloadURL,
        });
        setSignatureUrl(downloadURL);
        showToast({
          message: "Institution signature updated successfully!",
          type: "success",
        });
      }
    } catch (error) {
      console.error(error);
      showToast({ message: "Failed to upload signature.", type: "error" });
    } finally {
      setUploadingSig(false);
    }
  };

  const performBulkUpdate = async () => {
    if (studentScores.length === 0) return;
    setListLoading(true);
    try {
      const batch = writeBatch(db);
      for (const student of studentScores) {
        const reportId =
          `${student.studentId}_${selectedYear}_${term}_${selectedReportType.replace(/\s+/g, "")}`.replace(
            /\//g,
            "-",
          );

        // Fetch existing report to see if we should preserve existing remarks
        const reportRef = doc(db, "student-reports", reportId);
        const reportSnap = await getDoc(reportRef);
        const existingData = reportSnap.exists() ? reportSnap.data() : {};

        const agg = student.aggregate || 54;
        const autoAdminRemarks = getAutoRemarks(agg, false);
        const autoTeacherRemarks = getAutoRemarks(agg, true);

        batch.set(
          reportRef,
          {
            nextTermBegins: globalNextTermBegins,
            promotedTo: globalPromotedTo || mPromotedTo,
            adminRemarks: existingData.adminRemarks || autoAdminRemarks,
            teacherRemarks: existingData.teacherRemarks || autoTeacherRemarks,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      }
      await batch.commit();
      showToast({
        message: "Settings applied to all students.",
        type: "success",
      });
    } catch (e) {
      console.error(e);
      showToast({
        message: "Bulk update failed.",
        type: "error",
      });
    } finally {
      setListLoading(false);
    }
  };

  const handleBulkUpdate = () => {
    if (Platform.OS === "web") {
      if (
        window.confirm(
          "This will apply 'Next Term Begins' and 'Promoted To' values to ALL students. Remarks will be auto-generated for those without existing ones. Continue?",
        )
      ) {
        performBulkUpdate();
      }
    } else {
      Alert.alert(
        "Bulk Update",
        "This will apply 'Next Term Begins' and 'Promoted To' values to ALL students. Remarks will be auto-generated for those without existing ones. Continue?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Apply to All",
            onPress: performBulkUpdate,
          },
        ],
      );
    }
  };

  const recalculateRankings = async () => {
    if (!selectedClassId || !selectedYear || !term) {
      return showToast({
        message: "Please select Class, Year and Term first.",
        type: "error",
      });
    }

    const performRecalculate = async () => {
      setRecalculating(true);
      try {
        const qAll = query(
          collection(db, "academicRecords"),
          where("classId", "==", selectedClassId),
          where("academicYear", "==", selectedYear),
          where("term", "==", term),
          where("reportType", "==", selectedReportType),
          where("status", "==", "approved"),
        );

        const allSnap = await getDocsFromServer(qAll);
        if (allSnap.empty) {
          showToast({
            message: "No approved records found to recalculate.",
            type: "info",
          });
          setRecalculating(false);
          return;
        }

        const batch = writeBatch(db);
        const studentTotals: Record<string, number> = {};
        const studentNames: Record<string, string> = {};

        // 1. Process each subject record for subject-level ranking & summary
        allSnap.docs.forEach((subjectDoc) => {
          const data = subjectDoc.data();
          const students = data.students || [];
          const subjectName = data.subject;
          const subjectKey = subjectName.replace(/\s+/g, "_");

          const subjectScoresList = students.map((s: any) => ({
            id: s.studentId,
            total: parseFloat(s.finalScore) || 0,
          }));

          const updatedStudents = students.map((s: any) => {
            const rankInfo = calculateCompetitionRanking(
              subjectScoresList,
              s.studentId,
            );
            const posStr = `${rankInfo.rank}/${rankInfo.total}`;

            // Track for overall rank
            studentTotals[s.studentId] =
              (studentTotals[s.studentId] || 0) +
              (parseFloat(s.finalScore) || 0);
            if (!studentNames[s.studentId])
              studentNames[s.studentId] = s.fullName;

            // Update Summary doc too
            const yearSlug = selectedYear.replace(/\//g, "_");
            const termSlug = term.replace(/\s+/g, "");
            const summaryId = `${s.studentId}_${yearSlug}_${termSlug}`;
            const summaryRef = doc(db, "academicRecordsSummary", summaryId);

            batch.set(
              summaryRef,
              {
                studentId: s.studentId,
                classId: selectedClassId,
                academicYear: selectedYear,
                term: term,
                scores: {
                  [subjectKey]: {
                    finalScore: parseFloat(s.finalScore) || 0,
                    grade: s.grade,
                    position: posStr,
                    reportType: selectedReportType,
                    lastUpdated: serverTimestamp(),
                  },
                },
              },
              { merge: true },
            );

            return { ...s, position: posStr };
          });

          batch.update(subjectDoc.ref, { students: updatedStudents });
        });

        // 2. Process Overall Rankings
        const overallRankData = Object.entries(studentTotals).map(
          ([id, total]) => ({
            id,
            total,
          }),
        );

        overallRankData.forEach((item) => {
          const rankInfo = calculateCompetitionRanking(overallRankData, item.id);
          const reportId =
            `${item.id}_${selectedYear}_${term}_${selectedReportType.replace(/\s+/g, "")}`.replace(
              /\//g,
              "-",
            );

          batch.set(
            doc(db, "student-reports", reportId),
            {
              overallPosition: `${rankInfo.rank}/${rankInfo.total}`,
              totalScore: item.total,
              studentId: item.id,
              studentName: studentNames[item.id],
              classId: selectedClassId,
              academicYear: selectedYear,
              term,
              reportType: selectedReportType,
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
        });

        await batch.commit();
        showToast({
          message: "All class rankings successfully recalculated.",
          type: "success",
        });
        if (selectedSubject) loadData();
      } catch (e) {
        console.error("Recalculation error:", e);
        showToast({ message: "Failed to recalculate rankings.", type: "error" });
      } finally {
        setRecalculating(false);
      }
    };

    if (Platform.OS === "web") {
      if (
        window.confirm(
          "This will re-calculate both subject-level and overall positions for all approved records in this class and term. Continue?",
        )
      ) {
        performRecalculate();
      }
    } else {
      Alert.alert(
        "Recalculate Rankings",
        "This will re-calculate both subject-level and overall positions for all approved records in this class and term. Continue?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Recalculate", onPress: performRecalculate },
        ],
      );
    }
  };

  return {
    loading,
    listLoading,
    fetchingSubjects,
    refreshing,
    savingMetadata,
    uploadingSig,
    signatureUrl,
    classes,
    availableSubjects,
    selectedClassId,
    setSelectedClassId,
    selectedYear,
    setSelectedYear,
    selectedSubject,
    setSelectedSubject,
    term,
    setTerm,
    selectedReportType,
    setSelectedReportType,
    studentScores,
    stats,
    hasSearched,
    metadataModalVisible,
    setMetadataModalVisible,
    editingStudent,
    mConduct,
    setConduct,
    mAttitude,
    setAttitude,
    mInterest,
    setInterest,
    mPromotedTo,
    setPromotedTo,
    mNextTermBegins,
    setNextTermBegins,
    showNextTermPicker,
    setShowNextTermPicker,
    mAdminRemarks,
    setAdminRemarks,
    mTeacherRemarks,
    setTeacherRemarks,
    loadData,
    onRefresh,
    handleEditMetadata,
    saveMetadata,
    handleUploadSignature,
    handleBulkUpdate,
    recalculateRankings,
    recalculating,
    availableYears,
    acadConfig,
    primary,
    globalNextTermBegins,
    setGlobalNextTermBegins,
    globalPromotedTo,
    setGlobalPromotedTo,
    showGlobalNextTermPicker,
    setShowGlobalNextTermPicker
  };
}
