import Constants from "expo-constants";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system";
import * as Print from "expo-print";
import { useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    getDocsFromServer,
    query,
    where,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Alert, Platform } from "react-native";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { getSchoolLogo } from "../../constants/Logos";
import { getSchoolSignature } from "../../constants/Signatures";
import { COLORS } from "../../constants/theme";
import { db } from "../../firebaseConfig";
import {
    calculateCompetitionRanking,
    calculatePerformanceFromList,
    calculateStudentTotalScore,
    getAutoRemarks,
    getGradeDetails,
} from "../../lib/classHelpers";
import { generateAcademicReportHtml } from "../../lib/reportTemplates";
import { useAcademicConfig } from "../useAcademicConfig";

export type ReportType = "End of Term" | "Mid-Term" | "Mock Exams";

interface UseAcademicRecordDetailsProps {
  studentId?: string;
  term?: string;
  classId?: string;
  academicYear?: string;
  reportType?: ReportType;
}

export const useAcademicRecordDetails = (
  props?: UseAcademicRecordDetailsProps,
) => {
  const params = useLocalSearchParams();

  const studentId = props?.studentId || (params.studentId as string);
  const termState = props?.term || (params.term as string);
  const classIdState = props?.classId || (params.classId as string);
  const academicYearState =
    props?.academicYear || (params.academicYear as string);
  const reportType =
    props?.reportType || (params.reportType as ReportType) || "End of Term";

  const isFullReport = reportType === "End of Term";

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [className, setClassName] = useState("");
  const [subjectsData, setSubjectsData] = useState<any[]>([]);

  const [adminRemarks, setAdminRemarks] = useState("");
  const [teacherRemarks, setTeacherRemarks] = useState("");
  const [conduct, setConduct] = useState("Excellent");
  const [attitude, setAttitude] = useState("Very Positive");
  const [interest, setInterest] = useState("High");
  const [promotedTo, setPromotedTo] = useState("");
  const [nextTermBegins, setNextTermBegins] = useState("");
  const [attendance, setAttendance] = useState("");

  const [isPreschool, setIsPreschool] = useState(false);
  const [preschoolAssessments, setPreschoolAssessments] = useState<any>(null);
  const [physicalDev, setPhysicalDev] = useState<any>(null);
  const [activeClassId, setActiveClassId] = useState(classIdState);
  const [reportStatus, setReportStatus] = useState("pending");
  const [isReportApproved, setIsReportApproved] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const schoolId = (
    Constants.expoConfig?.extra?.schoolId || "afahjoy"
  ).toLowerCase();
  const schoolLogo = getSchoolLogo(schoolId);
  const defaultSchoolSig = getSchoolSignature(schoolId);
  const primary = SCHOOL_CONFIG.primaryColor || COLORS.primary;

  const [adminSig, setAdminSig] = useState(defaultSchoolSig);
  const [overallPosition, setOverallPosition] = useState<string>("-");

  const acadConfig = useAcademicConfig();

  const fetchAllData = async (isManualRefresh = false) => {
    if (!studentId || !termState || !academicYearState) return;
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      // 1. Fetch Academic Scores (Historical safe - query by studentId)
      const qScores = query(
        collection(db, "academicRecords"),
        where("studentIds", "array-contains", studentId),
        where("academicYear", "==", academicYearState),
        where("term", "==", termState),
        where("reportType", "==", reportType),
      );

      const scoresSnap = await getDocsFromServer(qScores);

      // Resolve historical classId from records
      let effectiveClassId = "";
      scoresSnap.docs.forEach((d) => {
        if (!effectiveClassId) effectiveClassId = (d.data() as any).classId;
      });

      if (!effectiveClassId) effectiveClassId = classIdState;

      const reportId =
        `${studentId}_${academicYearState}_${termState}_${reportType.replace(/\s+/g, "")}`.replace(
          /\//g,
          "-",
        );

      // 2. Fetch Report Metadata (Resolves overrides and historical classId)
      let r: any = null;
      try {
        const reportSnap = await getDoc(doc(db, "student-reports", reportId));
        if (reportSnap.exists()) {
          r = reportSnap.data();
          if (r.classId) effectiveClassId = r.classId;
          setReportStatus(r.status || "pending");
          setIsReportApproved(r.status === "approved");
        } else {
          setReportStatus("pending");
          setIsReportApproved(false);
          // Fallback to summary for classId if report doc doesn't exist
          const summaryId = `${studentId}_${academicYearState.replace(/\//g, "_")}_${termState.replace(/\s+/g, "")}`;
          const summarySnap = await getDoc(
            doc(db, "academicRecordsSummary", summaryId),
          );
          if (summarySnap.exists()) {
            effectiveClassId = summarySnap.data().classId || effectiveClassId;
          }
        }
      } catch (e) {
        // If permission denied (common for parents on unapproved reports), continue with defaults
        setReportStatus("pending");
        setIsReportApproved(false);
      }

      setActiveClassId(effectiveClassId);

      const resultsMap = new Map();
      let nameFound = "";

      scoresSnap.docs.forEach((d) => {
        const data = d.data() as any;
        // Important: Parents can only see records that have been approved by the admin.
        if (data.status !== "approved") return;
        const subjectName = data.subject;
        if (!subjectName) return;

        const studentsList = Array.isArray(data.students) ? data.students : [];

        const subjectRankData = calculateCompetitionRanking(
          studentsList.map((s: any) => ({
            id: s.studentId,
            total: calculateStudentTotalScore(s, reportType),
          })),
          studentId,
        );
        const posInSub = subjectRankData.rank;

        const studentEntry = studentsList.find(
          (s: any) => s.studentId === studentId,
        );
        if (studentEntry) {
          if (!nameFound) nameFound = studentEntry.fullName;
          const scoreValue = calculateStudentTotalScore(
            studentEntry,
            reportType,
          );

          const gradeObj = getGradeDetails(scoreValue);
          resultsMap.set(subjectName, {
            subject: subjectName,
            classScore: studentEntry.classScore || "-",
            examsScore:
              reportType === "End of Term"
                ? studentEntry.exam50 || 0
                : studentEntry.examsMark || 0,
            total: scoreValue,
            grade: gradeObj.grade,
            aggregate: gradeObj.aggregate,
            remark: gradeObj.remark,
            pos: posInSub,
          });
        }
      });

      setStudentName(nameFound);
      const finalSubjects = Array.from(resultsMap.values());
      setSubjectsData(finalSubjects);

      // Local Aggregate calculation for remarks
      const { aggregate: localAggregateInitial } =
        calculatePerformanceFromList(finalSubjects);

      // Overall Position Calculation
      let computedPosition = "-";
      try {
        let allStudents: Record<string, { total: number }> = {};
        scoresSnap.docs.forEach((d) => {
          const students = Array.isArray(d.data().students)
            ? d.data().students
            : [];
          students.forEach((s: any) => {
            if (!allStudents[s.studentId])
              allStudents[s.studentId] = { total: 0 };
            allStudents[s.studentId].total += calculateStudentTotalScore(
              s,
              reportType,
            );
          });
        });
        const rankedData = Object.entries(allStudents).map(
          ([id, data]: any) => ({ id, total: data.total }),
        );
        const overallRankInfo = calculateCompetitionRanking(
          rankedData,
          studentId,
        );
        if (overallRankInfo.rank > 0)
          computedPosition = `${overallRankInfo.rank}/${overallRankInfo.total}`;
      } catch (e) {
        console.error("Error calculating overall position:", e);
      }
      setOverallPosition(computedPosition);

      // Fetch class details
      let currentIsPreschool = false;
      try {
        const classDoc = await getDoc(doc(db, "classes", effectiveClassId));
        if (classDoc.exists()) {
          const classData: any = classDoc.data();
          setClassName(classData.className || classData.name || classIdState);
          const n = (classData.name || "").toUpperCase();
          currentIsPreschool =
            n.includes("CRECHE") ||
            n.includes("NURSERY") ||
            n.includes("KG") ||
            n.includes("KINDERGARTEN") ||
            n.includes("TODDLER") ||
            n.includes("PLAYGROUND") ||
            ["CLASS A", "CLASS B", "LEVEL A", "LEVEL B"].includes(n) ||
            (classData.department || "").toLowerCase() === "pre-school";
          setIsPreschool(currentIsPreschool);
        } else {
          setClassName(classIdState);
        }
      } catch (e) {
        setClassName(classIdState);
      }

      // Local Aggregate calculation for remarks
      const { aggregate: localAggregate } = calculatePerformanceFromList(
        finalSubjects,
        currentIsPreschool,
      );

      // Use bundled local school signature asset (Removed Firestore fetch to ensure reliability)
      setAdminSig(defaultSchoolSig);

      if (isFullReport) {
        const yearSlug = academicYearState.replace(/\//g, "-");
        const termSlug = termState.replace(/\s+/g, "");
        const behDocId = `behavioral_${effectiveClassId}_${yearSlug}_${termSlug}`;
        const behSnap = await getDoc(doc(db, "behavioralRecords", behDocId));

        if (behSnap.exists()) {
          const behData = behSnap.data();
          const studentBeh = (behData.students || []).find(
            (s: any) => s.studentId === studentId,
          );
          if (studentBeh) {
            setConduct(studentBeh.conduct || "Excellent");
            setAttitude(studentBeh.attitude || "Positive");
            setInterest(studentBeh.interest || "N/A");
            setTeacherRemarks(studentBeh.teacherRemarks || "");
            setPromotedTo(studentBeh.promotedTo || "");
            if (studentBeh.assessments)
              setPreschoolAssessments(studentBeh.assessments);
            if (studentBeh.physicalDev) setPhysicalDev(studentBeh.physicalDev);
          }
        }

        // Attendance
        try {
          const qAtt = query(
            collection(db, "attendance"),
            where("classId", "==", effectiveClassId),
            where("academicYear", "==", academicYearState),
            where("term", "==", termState),
          );
          const attSnap = await getDocs(qAtt);
          if (!attSnap.empty) {
            let presentCount = 0;
            let totalDays = attSnap.docs.length;
            attSnap.docs.forEach((d) => {
              const dayData = d.data();
              if (dayData.students?.[studentId]?.status === "present")
                presentCount++;
            });
            setAttendance(`${presentCount} / ${totalDays}`);
          }
        } catch (e) {}

        if (r) {
          // Respect overrides from student-reports
          if (r.overallPosition) setOverallPosition(r.overallPosition);
          if (r.promotedTo) setPromotedTo(r.promotedTo);

          if (r.adminRemarks) {
            setAdminRemarks(r.adminRemarks);
          } else {
            setAdminRemarks(getAutoRemarks(localAggregate, false));
          }

          if (r.teacherRemarks) {
            setTeacherRemarks(r.teacherRemarks);
          } else if (!teacherRemarks) {
            setTeacherRemarks(getAutoRemarks(localAggregate, true));
          }

          if (r.nextTermBegins) {
            setNextTermBegins(r.nextTermBegins);
          } else if (acadConfig.nextTermBegins) {
            setNextTermBegins(acadConfig.nextTermBegins);
          }
        } else {
          // If report record doesn't exist, set auto remarks
          setAdminRemarks(getAutoRemarks(localAggregate, false));
          if (!teacherRemarks) {
            setTeacherRemarks(getAutoRemarks(localAggregate, true));
          }
          if (acadConfig.nextTermBegins)
            setNextTermBegins(acadConfig.nextTermBegins);
        }
      }
    } catch (err) {
      console.error("Error in fetchAllData:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [
    studentId,
    termState,
    classIdState,
    academicYearState,
    reportType,
    acadConfig.nextTermBegins,
  ]);

  const refresh = () => fetchAllData(true);

  const {
    trs: TRS,
    tas: TAS,
    aggregate: AGGREGATE,
  } = useMemo(
    () => calculatePerformanceFromList(subjectsData, isPreschool),
    [subjectsData, isPreschool],
  );

  const generatePDF = async () => {
    if (subjectsData.length === 0) {
      Alert.alert("No Data", "No records found.");
      return;
    }
    if (generating) return;
    setGenerating(true);

    try {
      let logoDataUri = "";
      let sigDataUri = "";

      const getBase64FromUri = async (uri: any): Promise<string> => {
        if (!uri) return "";
        if (typeof uri === "string") {
          if (uri.startsWith("data:")) return uri;

          if (Platform.OS === "web") {
            const absoluteUri =
              uri.startsWith("http") || uri.startsWith("data:")
                ? uri
                : new URL(uri, window.location.origin).href;
            const response = await fetch(absoluteUri);
            const blob = await response.blob();
            return await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          }

          if (uri.startsWith("http")) {
            const tempPath = `${FileSystem.cacheDirectory}temp_${Math.random().toString(36).substring(7)}.png`;
            const downloaded = await FileSystem.downloadAsync(uri, tempPath);
            const b64 = await FileSystem.readAsStringAsync(downloaded.uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            return `data:image/png;base64,${b64}`;
          }

          const b64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          return `data:image/png;base64,${b64}`;
        }

        try {
          const asset = Asset.fromModule(uri as any);
          if (!asset.localUri && !asset.uri) await asset.downloadAsync();
          const finalUri = asset.localUri || asset.uri;
          if (!finalUri) return "";
          return await getBase64FromUri(finalUri);
        } catch (e) {
          console.warn("Asset conversion failed, falling back to source uri:", e, uri);
          if (typeof uri === "object" && (uri?.uri || uri?.localUri)) {
            return await getBase64FromUri(uri.uri || uri.localUri);
          }
          return "";
        }
      };

      try {
        logoDataUri = await getBase64FromUri(schoolLogo);
      } catch (e) {
        console.warn("Logo conversion failed:", e);
      }

      if (adminSig) {
        try {
          sigDataUri = await getBase64FromUri(adminSig);
        } catch (e) {
          console.warn("Signature conversion failed:", e);
        }
      }

      const qrData = `VERIFY-${studentId}-${academicYearState.replace(/\//g, "-")}-${termState.replace(/\s+/g, "")}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrData}`;
      const qrDataUri = await getBase64FromUri(qrUrl);

      const html = generateAcademicReportHtml({
        logoDataUri,
        sigDataUri,
        studentName,
        className,
        academicYearState,
        termState,
        overallPosition,
        attendance,
        reportType,
        isFullReport,
        subjectsData,
        TRS,
        TAS,
        AGGREGATE,
        isPreschool,
        conduct,
        attitude,
        interest,
        physicalDev,
        preschoolAssessments,
        teacherRemarks,
        adminRemarks,
        nextTermBegins,
        promotedTo,
        qrDataUri,
      });

      if (Platform.OS !== "web") {
        const { uri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(uri);
      } else {
        await Print.printAsync({ html });
      }
    } catch (err) {
      console.error("PDF generation error:", err);
      Alert.alert("Error", "PDF generation failed");
    } finally {
      setGenerating(false);
    }
  };

  return {
    loading,
    generating,
    studentName,
    className,
    subjectsData,
    adminRemarks,
    teacherRemarks,
    conduct,
    attitude,
    interest,
    promotedTo,
    nextTermBegins,
    attendance,
    adminSig,
    overallPosition,
    isPreschool,
    preschoolAssessments,
    physicalDev,
    primary,
    schoolLogo,
    isFullReport,
    TRS,
    TAS,
    AGGREGATE,
    generatePDF,
    classIdState: activeClassId,
    academicYearState,
    isReportApproved,
    reportStatus,
    refreshing,
    refresh,
  };
};
