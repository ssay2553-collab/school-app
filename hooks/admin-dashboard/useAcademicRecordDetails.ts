import { Asset } from "expo-asset";
import Constants from "expo-constants";
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

export type ReportType = "End of Term" | "Mid-Term" | "Mock Exams";

interface UseAcademicRecordDetailsProps {
    studentId?: string;
    term?: string;
    classId?: string;
    academicYear?: string;
    reportType?: ReportType;
}

export const useAcademicRecordDetails = (props?: UseAcademicRecordDetailsProps) => {
    const params = useLocalSearchParams();

    const studentId = props?.studentId || (params.studentId as string);
    const termState = props?.term || (params.term as string);
    const classIdState = props?.classId || (params.classId as string);
    const academicYearState = props?.academicYear || (params.academicYear as string);
    const reportType = props?.reportType || (params.reportType as ReportType) || "End of Term";

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

    const [adminSig, setAdminSig] = useState("");
    const [overallPosition, setOverallPosition] = useState<string>("-");

    const [isPreschool, setIsPreschool] = useState(false);
    const [preschoolAssessments, setPreschoolAssessments] = useState<Record<string, string>>({});
    const [physicalDev, setPhysicalDev] = useState<Record<string, string>>({});

    const primary = SCHOOL_CONFIG.primaryColor || COLORS.primary || "#2e86de";
    const schoolId = (Constants.expoConfig?.extra?.schoolId || "afahjoy").toLowerCase();
    const schoolLogo = getSchoolLogo(schoolId);

    useEffect(() => {
        const fetchAllData = async () => {
            if (!studentId || !termState || !classIdState || !academicYearState) return;
            setLoading(true);
            try {
                // Fetch Academic Scores
                const qScores = query(
                    collection(db, "academicRecords"),
                    where("classId", "==", classIdState),
                    where("academicYear", "==", academicYearState),
                    where("term", "==", termState),
                    where("reportType", "==", reportType),
                    where("status", "==", "approved"),
                );

                const scoresSnap = await getDocsFromServer(qScores);
                const resultsMap = new Map();
                let nameFound = "";

                scoresSnap.docs.forEach((d) => {
                    const data = d.data() as any;
                    const subjectName = data.subject;
                    if (!subjectName) return;

                    const studentsList = data.students || [];

                    const subjectRankData = calculateCompetitionRanking(
                        studentsList.map((s: any) => ({
                            id: s.studentId,
                            total: calculateStudentTotalScore(s, reportType),
                        })),
                        studentId,
                    );
                    const posInSub = subjectRankData.rank;

                    const studentEntry = studentsList.find((s: any) => s.studentId === studentId);
                    if (studentEntry) {
                        if (!nameFound) nameFound = studentEntry.fullName;
                        const scoreValue = calculateStudentTotalScore(studentEntry, reportType);

                        const gradeObj = getGradeDetails(scoreValue);
                        resultsMap.set(subjectName, {
                            subject: subjectName,
                            classScore: studentEntry.classScore || "-",
                            examsScore: reportType === "End of Term" ? studentEntry.exam50 || 0 : studentEntry.examsMark || 0,
                            total: scoreValue,
                            grade: gradeObj.grade,
                            aggregate: gradeObj.aggregate,
                            remark: gradeObj.remark,
                            pos: posInSub,
                        });
                    }
                });

                setStudentName(nameFound);
                setSubjectsData(Array.from(resultsMap.values()));

                // Overall Position Calculation
                let computedPosition = "-";
                try {
                    let allStudents: Record<string, { total: number }> = {};
                    scoresSnap.docs.forEach((d) => {
                        (d.data().students || []).forEach((s: any) => {
                            if (!allStudents[s.studentId]) allStudents[s.studentId] = { total: 0 };
                            allStudents[s.studentId].total += calculateStudentTotalScore(s, reportType);
                        });
                    });
                    const rankedData = Object.entries(allStudents).map(([id, data]: any) => ({ id, total: data.total }));
                    const overallRankInfo = calculateCompetitionRanking(rankedData, studentId);
                    if (overallRankInfo.rank > 0) computedPosition = `${overallRankInfo.rank}/${overallRankInfo.total}`;
                } catch (e) {
                    console.error("Error calculating overall position:", e);
                }
                setOverallPosition(computedPosition);

                // Fetch class details
                try {
                    const classDoc = await getDoc(doc(db, "classes", classIdState));
                    if (classDoc.exists()) {
                        const classData: any = classDoc.data();
                        setClassName(classData.className || classData.name || classIdState);
                        const n = (classData.name || "").toUpperCase();
                        const isPre = n.includes("CRECHE") || n.includes("NURSERY") || n.includes("KG") ||
                            n.includes("KINDERGARTEN") || n.includes("TODDLER") || n.includes("PLAYGROUND") ||
                            ["CLASS A", "CLASS B", "LEVEL A", "LEVEL B"].includes(n) || (classData.department || "").toLowerCase() === "pre-school";
                        setIsPreschool(isPre);
                    } else {
                        setClassName(classIdState);
                    }
                } catch (e) {
                    setClassName(classIdState);
                }

                // Fetch Admin Signature
                const qAdmin = query(collection(db, "users"), where("role", "==", "admin"));
                const adminSnap = await getDocsFromServer(qAdmin);
                const headAdmin = adminSnap.docs.find((d) => {
                    const r = ((d.data() as any).adminRole || "").toLowerCase();
                    return ["proprietor", "proprietress", "headmaster", "headmistress", "principal", "director", "administrator", "manager"].some((title) => r.includes(title));
                });

                if (headAdmin && (headAdmin.data() as any).profile?.signatureUrl) {
                    setAdminSig((headAdmin.data() as any).profile?.signatureUrl);
                } else {
                    const anySigAdmin = adminSnap.docs.find((d) => (d.data() as any).profile?.signatureUrl);
                    if (anySigAdmin) setAdminSig((anySigAdmin.data() as any).profile?.signatureUrl);
                }

                if (isFullReport) {
                    const yearSlug = academicYearState.replace(/\//g, "-");
                    const termSlug = termState.replace(/\s+/g, "");
                    const behDocId = `behavioral_${classIdState}_${yearSlug}_${termSlug}`;
                    const behSnap = await getDoc(doc(db, "behavioralRecords", behDocId));

                    if (behSnap.exists()) {
                        const behData = behSnap.data();
                        const studentBeh = (behData.students || []).find((s: any) => s.studentId === studentId);
                        if (studentBeh) {
                            setConduct(studentBeh.conduct || "Excellent");
                            setAttitude(studentBeh.attitude || "Positive");
                            setInterest(studentBeh.interest || "N/A");
                            setTeacherRemarks(studentBeh.teacherRemarks || "");
                            setPromotedTo(studentBeh.promotedTo || "");
                            if (studentBeh.assessments) setPreschoolAssessments(studentBeh.assessments);
                            if (studentBeh.physicalDev) setPhysicalDev(studentBeh.physicalDev);
                        }
                    }

                    // Attendance
                    try {
                        const qAtt = query(collection(db, "attendance"), where("classId", "==", classIdState), where("academicYear", "==", academicYearState), where("term", "==", termState));
                        const attSnap = await getDocs(qAtt);
                        if (!attSnap.empty) {
                            let presentCount = 0;
                            let totalDays = attSnap.docs.length;
                            attSnap.docs.forEach((d) => {
                                const dayData = d.data();
                                if (dayData.students?.[studentId]?.status === "present") presentCount++;
                            });
                            setAttendance(`${presentCount} / ${totalDays}`);
                        }
                    } catch (e) { }

                    const reportId = `${studentId}_${academicYearState}_${termState}_${reportType.replace(/\s+/g, "")}`.replace(/\//g, "-");
                    const reportSnap = await getDoc(doc(db, "student-reports", reportId));
                    if (reportSnap.exists()) {
                        const r = reportSnap.data() as any;
                        if (r.adminRemarks) {
                            setAdminRemarks(r.adminRemarks);
                        } else {
                            setAdminRemarks(getAutoRemarks(AGGREGATE, false));
                        }

                        if (r.teacherRemarks) {
                            setTeacherRemarks(r.teacherRemarks);
                        } else if (!teacherRemarks) {
                            setTeacherRemarks(getAutoRemarks(AGGREGATE, true));
                        }

                        if (r.nextTermBegins) setNextTermBegins(r.nextTermBegins);
                    } else {
                        // If report record doesn't exist, set auto remarks
                        setAdminRemarks(getAutoRemarks(AGGREGATE, false));
                        if (!teacherRemarks) {
                            setTeacherRemarks(getAutoRemarks(AGGREGATE, true));
                        }
                    }
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchAllData();
    }, [studentId, termState, classIdState, academicYearState, reportType]);

    const { trs: TRS, tas: TAS, aggregate: AGGREGATE } = useMemo(() => calculatePerformanceFromList(subjectsData), [subjectsData]);

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

            const getBase64FromUri = async (uri: string) => {
                if (Platform.OS === "web") {
                    try {
                        const resp = await fetch(uri);
                        const blob = await resp.blob();
                        return new Promise<string>((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result as string);
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                        });
                    } catch (e) { return uri; }
                } else {
                    try {
                        const tempPath = `${FileSystem.cacheDirectory}temp_${Math.random().toString(36).substring(7)}.png`;
                        const downloaded = await FileSystem.downloadAsync(uri, tempPath);
                        const b64 = await FileSystem.readAsStringAsync(downloaded.uri, { encoding: FileSystem.EncodingType.Base64 });
                        return `data:image/png;base64,${b64}`;
                    } catch (e) { return uri; }
                }
            };

            try {
                const asset = Asset.fromModule(schoolLogo);
                if (!asset.localUri && !asset.uri) await asset.downloadAsync();
                logoDataUri = await getBase64FromUri(asset.localUri || asset.uri);
            } catch (e) { }

            if (adminSig) sigDataUri = await getBase64FromUri(adminSig);

            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=VERIFY-${studentId}`;
            const qrDataUri = await getBase64FromUri(qrUrl);

            const html = generateAcademicReportHtml({
                logoDataUri, sigDataUri, studentName, className, academicYearState, termState,
                overallPosition, attendance, reportType, isFullReport, subjectsData,
                TRS, TAS, AGGREGATE, isPreschool, conduct, attitude, interest, physicalDev,
                preschoolAssessments, teacherRemarks, adminRemarks, nextTermBegins, promotedTo, qrDataUri
            });

            if (Platform.OS !== "web") {
                const { uri } = await Print.printToFileAsync({ html });
                await Sharing.shareAsync(uri);
            } else {
                await Print.printAsync({ html });
            }
        } catch (err) {
            Alert.alert("Error", "PDF generation failed");
        } finally {
            setGenerating(false);
        }
    };

    return {
        loading, generating, studentName, className, subjectsData, adminRemarks, teacherRemarks,
        conduct, attitude, interest, promotedTo, nextTermBegins, attendance, adminSig, overallPosition,
        isPreschool, preschoolAssessments, physicalDev, primary, schoolLogo, isFullReport, TRS, TAS, AGGREGATE,
        generatePDF, classIdState, academicYearState
    };
};
