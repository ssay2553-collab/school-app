import { Picker } from "@react-native-picker/picker";
import { Asset } from "expo-asset";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system";
import * as Print from "expo-print";
import {
    collection,
    doc,
    documentId,
    getDoc,
    getDocsFromServer,
    query,
    where
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { getSchoolLogo } from "../../constants/Logos";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { db } from "../../firebaseConfig";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";
import { getGradeDetails, calculatePerformanceFromList } from "../../lib/classHelpers";
import { getDocsCacheFirst } from "../../lib/firestoreHelpers";
import { shareFile } from "../../utils/shareUtils";

const TERMS = ["Term 1", "Term 2", "Term 3"];
type ReportType = "End of Term" | "Mid-Term" | "Mock Exams";

export default function StudentAcademicReport() {
  const { appUser } = useAuth();
  const acadConfig = useAcademicConfig();
  const { showToast } = useToast();

  const [children, setChildren] = useState<any[]>([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("Term 1");
  const [selectedReportType, setSelectedReportType] =
    useState<ReportType>("End of Term");

  const primary = SCHOOL_CONFIG.primaryColor;
  const schoolId = (
    Constants.expoConfig?.extra?.schoolId || "afahjoy"
  ).toLowerCase();
  const schoolLogo = getSchoolLogo(schoolId);

  const academicYears = useMemo(() => {
    const start = 2022; // Extended history start
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = start; y <= currentYear + 1; y++) {
      years.push(`${y}/${y + 1}`);
    }
    // Ensure the current active year from config is always present
    if (acadConfig.academicYear && !years.includes(acadConfig.academicYear)) {
      years.push(acadConfig.academicYear);
    }
    return Array.from(new Set(years)).sort().reverse();
  }, [acadConfig.academicYear]);

  const [selectedYear, setSelectedYear] = useState("");
  const [hasSetDefaults, setHasSetDefaults] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [subjectsData, setSubjectsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchingReport, setFetchingReport] = useState(false);
  const [overallPosition, setOverallPosition] = useState("N/A");

  const [teacherSig, setTeacherSig] = useState("");
  const [adminSig, setAdminSig] = useState("");

  useEffect(() => {
    if (!appUser || appUser.role !== "parent") return;
    const fetchData = async () => {
      const ids = (appUser as any).childrenIds || [];
      if (ids.length > 0) {
        try {
          const q = query(
            collection(db, "users"),
            where(documentId(), "in", ids),
          );
          const snap = await getDocsCacheFirst(q);
          const list = snap.docs.map((d) => ({
            id: d.id,
            name: `${(d.data() as any).profile?.firstName || ""} ${(d.data() as any).profile?.lastName || ""}`.trim(),
            classId: (d.data() as any).classId || (d.data() as any).profile?.classId || "",
          }));
          setChildren(list);
          if (list.length > 0) setSelectedChildId(list[0].id);
        } catch (e) {
          console.error("Error fetching children:", e);
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [appUser]);

  // Unified effect to sync with global academic config and set fallback defaults
  useEffect(() => {
    if (acadConfig.loading) return;

    if (acadConfig.academicYear && !hasSetDefaults) {
      console.log("[Report] Setting defaults from config:", acadConfig.academicYear, acadConfig.currentTerm);
      setSelectedYear(acadConfig.academicYear);
      setSelectedTerm(acadConfig.currentTerm || "Term 1");
      setHasSetDefaults(true);
    } else if (!selectedYear && academicYears.length > 0 && !hasSetDefaults) {
      console.log("[Report] Setting fallback default year:", academicYears[0]);
      setSelectedYear(academicYears[0]);
      setSelectedTerm("Term 1");
      setHasSetDefaults(true);
    }
  }, [acadConfig, academicYears, hasSetDefaults]);

  useEffect(() => {
    if (selectedChildId && selectedYear && selectedTerm && selectedReportType) {
      loadReport();
    }
  }, [selectedChildId, selectedYear, selectedTerm, selectedReportType]);

  const [className, setClassName] = useState("");

  const loadReport = async () => {
    if (!selectedChildId) {
      return showToast({ message: "Please select a student first.", type: "error" });
    }
    if (!selectedYear) {
      return showToast({ message: "Please select an academic year.", type: "error" });
    }

    setFetchingReport(true);
    setReport(null);
    setSubjectsData([]);
    setClassName("");

    try {
      const child = children.find((c) => c.id === selectedChildId);
      const classId = child?.classId;

      console.log(`[Report] Loading for child: ${selectedChildId}, Class: ${classId}, Year: ${selectedYear}, Term: ${selectedTerm}, Type: ${selectedReportType}`);

      if (!classId) {
        showToast({ message: "This student is not assigned to a class. Please contact the school administrator.", type: "error" });
        setFetchingReport(false);
        return;
      }

      const qScores = query(
        collection(db, "academicRecords"),
        where("classId", "==", classId),
        where("academicYear", "==", selectedYear),
        where("term", "==", selectedTerm),
        where("reportType", "==", selectedReportType),
        where("status", "==", "approved"),
      );

      // Always fetch from server for reports to ensure we get latest approved data
      const scoresSnap = await getDocsFromServer(qScores);
      console.log(`[Report] Found ${scoresSnap.size} approved subject records.`);

      let results: any[] = [];

      scoresSnap.docs.forEach((d) => {
        const data = d.data() as any;
        const studentsList = data.students || [];

        const sortedBySubject = [...studentsList].sort((a, b) => {
          const valA = parseFloat(
            a.finalScore ??
              (
                parseFloat(a.classScore || 0) + parseFloat(a.exam50 || 0)
              ).toFixed(2),
          );
          const valB = parseFloat(
            b.finalScore ??
              (
                parseFloat(b.classScore || 0) + parseFloat(b.exam50 || 0)
              ).toFixed(2),
          );
          return valB - valA;
        });
        const posInSub =
          sortedBySubject.findIndex((s) => s.studentId === selectedChildId) + 1;

        const studentEntry = studentsList.find(
          (s: any) => s.studentId === selectedChildId,
        );

        if (studentEntry) {
          const scoreValue = parseFloat(
            studentEntry.finalScore ??
              (
                parseFloat(studentEntry.classScore || 0) +
                parseFloat(studentEntry.exam50 || 0)
              ).toFixed(2),
          );

          const gradeObj = getGradeDetails(scoreValue);
          results.push({
            subject: data.subject,
            classScore: studentEntry.classScore || "-",
            examsScore: studentEntry.exam50 || studentEntry.examsMark || 0,
            total: scoreValue,
            grade: gradeObj.grade,
            aggregate: gradeObj.aggregate,
            remark: gradeObj.remark,
            pos: posInSub,
          });
        }
      });

      if (scoresSnap.size === 0) {
        console.warn(`[Report] No approved academic records found for Class: ${classId}, Year: ${selectedYear}, Term: ${selectedTerm}`);
        showToast({ message: "No approved academic records found for this period.", type: "info" });
        setFetchingReport(false);
        return;
      }

      if (results.length === 0) {
        console.warn(`[Report] No entry found for student ${selectedChildId} in ${scoresSnap.size} approved subject records.`);
        showToast({ message: "Your child was not found in the approved records for this period.", type: "error" });
        setFetchingReport(false);
        return;
      }

      setSubjectsData(results);

      // Fetch overall position ranking
      try {
        const qAllReports = query(
          collection(db, "academicRecords"),
          where("classId", "==", classId),
          where("academicYear", "==", selectedYear),
          where("term", "==", selectedTerm),
          where("reportType", "==", selectedReportType),
          where("status", "==", "approved"),
        );
        const allSnap = await getDocsFromServer(qAllReports);
        const studentTotals: { [id: string]: number } = {};
        allSnap.docs.forEach((d) => {
          const dData = d.data() as any;
          (dData.students || []).forEach((s: any) => {
            const val = parseFloat(
              s.finalScore ??
                (parseFloat(s.classScore || 0) + parseFloat(s.exam50 || 0)),
            );
            studentTotals[s.studentId] = (studentTotals[s.studentId] || 0) + val;
          });
        });
        const sortedTotals = Object.entries(studentTotals).sort(
          (a, b) => b[1] - a[1],
        );
        const rank =
          sortedTotals.findIndex(([id]) => id === selectedChildId) + 1;
        const totalInClass = sortedTotals.length;
        setOverallPosition(rank > 0 ? `${rank}/${totalInClass}` : "N/A");
      } catch (e) {
        console.warn("Ranking error:", e);
        setOverallPosition("N/A");
      }

      // Fetch class name
      try {
        const classDoc = await getDoc(doc(db, "classes", classId));
        if (classDoc.exists()) {
          const classData: any = classDoc.data();
          setClassName(classData.className || classData.name || classId);
        } else {
          setClassName(classId);
        }
      } catch (e) {
        setClassName(classId);
      }

      // Fetch Head of Institution Signature
      const qAdmin = query(
        collection(db, "users"),
        where("role", "==", "admin"),
      );

      const adminSnap = await getDocsFromServer(qAdmin);
      const headAdmin = adminSnap.docs.find((d) => {
        const r = ((d.data() as any).adminRole || "").toLowerCase();
        return [
          "proprietor",
          "head",
          "ceo",
          "principal",
          "director",
          "administrator",
          "bursar",
          "owner",
          "manager",
        ].some((title) => r.includes(title));
      });

      if (headAdmin && (headAdmin.data() as any).profile?.signatureUrl) {
        setAdminSig((headAdmin.data() as any).profile?.signatureUrl);
      } else {
        const anySigAdmin = adminSnap.docs.find(
          (d) => (d.data() as any).profile?.signatureUrl,
        );
        if (anySigAdmin) {
          setAdminSig((anySigAdmin.data() as any).profile?.signatureUrl);
        }
      }

      const reportId =
        `${selectedChildId}_${selectedYear}_${selectedTerm}_${selectedReportType.replace(/\s+/g, "")}`.replace(
          /\//g,
          "-",
        );
      const snap = await getDoc(doc(db, "student-reports", reportId));
      if (snap.exists()) {
        setReport(snap.data() as any);
      } else {
        setReport({ studentName: child.name, classId });
      }
    } catch (err) {
      console.error("Load report error:", err);
      showToast({ message: "Failed to load report.", type: "error" });
    } finally {
      setFetchingReport(false);
    }
  };

  const { trs: TRS, tas: TAS, aggregate: unifiedAggregate } = useMemo(() => {
    return calculatePerformanceFromList(subjectsData);
  }, [subjectsData]);

  const downloadPDF = async () => {
    if (subjectsData.length === 0) return;
    const isFullReport = selectedReportType === "End of Term";

    try {
      let logoDataUri = "";
      let adminSigDataUri = "";

      const getBase64FromUri = async (uri: string) => {
        if (!uri) return "";
        try {
          if (Platform.OS === "web") {
            const resp = await fetch(uri);
            const blob = await resp.blob();
            return new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          } else {
            const tempPath = `${FileSystem.cacheDirectory}temp_${Math.random().toString(36).substring(7)}.png`;
            const downloaded = await FileSystem.downloadAsync(uri, tempPath);
            const b64 = await FileSystem.readAsStringAsync(downloaded.uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            return `data:image/png;base64,${b64}`;
          }
        } catch (e) {
          console.warn("Base64 conversion failed for", uri, e);
          return uri;
        }
      };

      // Logo conversion
      try {
        const asset = Asset.fromModule(schoolLogo);
        if (!asset.localUri && !asset.uri) await asset.downloadAsync();
        logoDataUri = await getBase64FromUri(asset.localUri || asset.uri);
      } catch (e) {
        console.warn("Logo conversion failed", e);
      }

      // Signatures conversion
      if (adminSig) {
        adminSigDataUri = await getBase64FromUri(adminSig);
      }

      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=VERIFY-${selectedChildId}`;
      const qrDataUri = await getBase64FromUri(qrUrl);

      const generatedOn = new Date().toLocaleString();

      const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <style>
        @page { size: A4; margin: 12mm; }
        body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; margin:0; color:#0f172a; background:#fff; }
        .paper { max-width: 794px; margin: 0 auto; padding: 26px 28px; position: relative; }

        .header-table { width: 100%; border-bottom: 2pt solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; }
        .header-logo { width: 80px; vertical-align: middle; }
        .header-text { text-align: left; padding-left: 20px; vertical-align: middle; }
        .school-name { font-size: 22pt; font-weight: 900; margin: 0; text-transform: uppercase; color: #0f172a; }
        .school-info { font-size: 9pt; margin: 2px 0; font-weight: 600; color: #475569; }

        .title { text-align:center; font-weight:900; margin: 20px 0; font-size: 14pt; letter-spacing: 1.5pt; text-transform: uppercase; }

        .info-grid { width: 100%; border-collapse: collapse; margin-bottom: 25px; border: 1pt solid #E2E8F0; }
        .info-grid td { padding: 8pt 12pt; font-size: 10pt; border: 1pt solid #E2E8F0; }
        .label-cell { background-color: #F8FAFC; color: #64748B; font-weight: 800; width: 20%; font-size: 8pt; text-transform: uppercase; }
        .value-cell { width: 30%; font-weight: 700; color: #1E293B; }

        table.results { width: 100%; border-collapse: collapse; margin-bottom: 25px; table-layout: fixed; border: 1pt solid #0b1220; }
        table.results th { background-color: #1E293B !important; -webkit-print-color-adjust: exact; color: #fff; padding: 10pt 5pt; font-size: 9pt; border: 1pt solid #334155; text-transform: uppercase; }
        table.results td { padding: 8pt 5pt; font-size: 10pt; border: 1pt solid #E2E8F0; text-align: center; font-weight: 600; color: #1E293B; }
        table.results tr:nth-child(even) { background-color: #F8FAFC; }
        .subj-name { text-align: left !important; padding-left: 12pt !important; font-weight: 800; text-transform: uppercase; }

        .summary-box { border: 1pt solid #E2E8F0; padding: 12pt; margin-bottom: 20px; background-color: #F1F5F9; border-radius: 4pt; }
        .summary-text { font-size: 11pt; font-weight: 900; margin: 0; color: #1E293B; text-align: center; }

        .remarks-box { margin-top: 10pt; border: 1pt solid #E2E8F0; padding: 12pt; border-radius: 4pt; background-color: #F8FAFC; }
        .remark-line { margin-bottom: 8pt; font-size: 10pt; line-height: 1.4; color: #334155; }
        .remark-header { font-weight: 900; color: #1E293B; margin-right: 8pt; font-size: 8.5pt; text-transform: uppercase; }

        .footer { display:flex; justify-content:space-between; align-items:flex-end; margin-top:30px; }
        .sig-section { width: 40%; text-align: center; }
        .sig-image { height: 45pt; object-fit: contain; margin-bottom: -5pt; max-width: 90%; }
        .sig-line { border-top: 1pt solid #1E293B; width: 85%; margin: 5pt auto; }
        .sig-label { font-size: 8.5pt; font-weight: 800; text-transform: uppercase; color: #64748B; }

        .qr-section { text-align: right; width: 20%; }
        .qr-img { width: 50pt; height: 50pt; opacity: 0.8; }
      </style>
    </head>
    <body>
      <div class="paper">
        <table class="header-table">
          <tr>
            <td class="header-logo">
              ${logoDataUri ? `<img src="${logoDataUri}" style="width: 80px; height: 80px;" />` : ""}
            </td>
            <td class="header-text">
              <h1 class="school-name">${SCHOOL_CONFIG.fullName}</h1>
              <p class="school-info">${SCHOOL_CONFIG.address || ""}</p>
              <p class="school-info">Contact: ${SCHOOL_CONFIG.hotline || ""} | Email: ${SCHOOL_CONFIG.email || ""}</p>
            </td>
          </tr>
        </table>

        <div class="title">${selectedReportType} Progress Report</div>

        <table class="info-grid">
          <tr>
            <td class="label-cell">Student Name</td><td class="value-cell">${report?.studentName || children.find((c) => c.id === selectedChildId)?.name}</td>
            <td class="label-cell">Class/Grade</td><td class="value-cell">${className}</td>
          </tr>
          <tr>
            <td class="label-cell">Academic Year</td><td class="value-cell">${selectedYear}</td>
            <td class="label-cell">Term/Period</td><td class="value-cell">${selectedTerm}</td>
          </tr>
          <tr>
            <td class="label-cell">Aggregate</td><td class="value-cell">${unifiedAggregate}</td>
            <td class="label-cell">Position</td><td class="value-cell">${overallPosition}</td>
          </tr>
          <tr>
            <td class="label-cell">Generated</td><td class="value-cell">${generatedOn}</td>
            <td class="label-cell">Status</td><td class="value-cell">Approved</td>
          </tr>
        </table>

        <table class="results">
          <thead>
            <tr>
              <th style="width: 30%;">Subject</th>
              ${isFullReport ? '<th style="width: 10%;">Class</th><th style="width: 10%;">Exams</th><th style="width: 10%;">Total</th>' : '<th style="width: 10%;">Total</th>'}
              <th style="width: 8%;">Grade</th>
              <th style="width: 8%;">Pos.</th>
              <th style="width: 24%;">Remark</th>
            </tr>
          </thead>
          <tbody>
          ${subjectsData
            .map((s) => {
              const classScoreDisplay = isNaN(Number(s.classScore)) ? s.classScore : Number(s.classScore).toFixed(1);
              const examsScoreDisplay = isNaN(Number(s.examsScore)) ? s.examsScore : Number(s.examsScore).toFixed(1);
              const totalDisplay = isNaN(Number(s.total)) ? s.total : Number(s.total).toFixed(1);
              return `
            <tr>
              <td class="subj-name">${s.subject}</td>
              ${isFullReport ? `
                <td>${classScoreDisplay}</td>
                <td>${examsScoreDisplay}</td>
                <td style="font-weight: 900;">${totalDisplay}</td>
              ` : `<td>${totalDisplay}</td>`}
              <td>${s.grade}</td>
              <td>${s.pos}</td>
              <td style="font-size: 9pt; text-align: left; padding-left: 5pt;">${s.remark}</td>
            </tr>`;
            }).join("")}
          </tbody>
        </table>

        <div class="summary-box">
          <p class="summary-text">TRS: ${TRS} | TAS: ${TAS} | AGGREGATE: ${unifiedAggregate}</p>
        </div>

        <div class="remarks-box">
          ${isFullReport && report?.assessment ? `<div class="remark-line"><span class="remark-header">BEHAVIORAL:</span> Conduct: <b>${report.assessment.conduct}</b> | Attitude: <b>${report.assessment.attitude}</b> | Interest: <b>${report.assessment.interest || "N/A"}</b></div>` : ""}
          <div class="remark-line"><span class="remark-header">CLASS TEACHER:</span> ${report?.teacherRemarks || "Satisfactory performance."}</div>
          <div class="remark-line"><span class="remark-header">ADMINISTRATIVE:</span> ${report?.adminRemarks || "Keep up the hard work."}</div>
          <div class="remark-line"><span class="remark-header">NEXT TERM BEGINS:</span> <b>${report?.nextTermBegins || "TBA"}</b></div>
          ${report?.promotedTo ? `<div class="remark-line"><span class="remark-header">PROMOTED TO:</span> <b>${report.promotedTo}</b></div>` : ""}
        </div>

        <div class="footer">
          <div class="sig-section" style="width: 60%; text-align: left;">
            ${adminSigDataUri ? `<img src="${adminSigDataUri}" class="sig-image" style="margin-left: 20px;" />` : '<div style="height:45pt;"></div>'}
            <div class="sig-line" style="width: 80%; margin-left: 0;"></div>
            <div class="sig-label" style="margin-left: 20px;">Head of Institution</div>
          </div>
          <div class="qr-section">
            <img src="${qrDataUri}" class="qr-img"/>
            <div style="font-size:7pt; color:#64748B; margin-top:4pt;">Verify Report</div>
          </div>
        </div>
      </div>
    </body>
    </html>
    `;

      if (Platform.OS !== "web") {
        const { uri } = await Print.printToFileAsync({ html });
        await shareFile(
          uri,
          `${selectedReportType.replace(/\s+/g, "_")}_Report.pdf`,
        );
      } else {
        await Print.printAsync({ html });
      }
    } catch (e) {
      console.error("PDF generation error:", e);
      showToast({ message: "Could not generate PDF.", type: "error" });
    }
  };

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={primary} />
      </View>
    );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 50 }}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Academic Reports</Text>
          <Text style={styles.headerSubtitle}>
            View and download terminal progress sheets
          </Text>
        </View>

        <View style={styles.selectorCard}>
          <Text style={styles.label}>Select Student</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {children.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.chip,
                  selectedChildId === c.id && {
                    backgroundColor: primary,
                    borderColor: primary,
                  },
                ]}
                onPress={() => setSelectedChildId(c.id)}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedChildId === c.id && { color: "#fff" },
                  ]}
                >
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Report Type</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {["End of Term", "Mid-Term", "Mock Exams"].map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.chip,
                  selectedReportType === type && {
                    backgroundColor: primary,
                    borderColor: primary,
                  },
                ]}
                onPress={() => setSelectedReportType(type as ReportType)}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedReportType === type && { color: "#fff" },
                  ]}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.pickerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Year</Text>
              <View style={styles.pickerBox}>
                <Picker
                  selectedValue={selectedYear}
                  onValueChange={setSelectedYear}
                  style={styles.picker}
                >
                  {academicYears.map((y) => (
                    <Picker.Item key={y} label={y} value={y} />
                  ))}
                </Picker>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Term</Text>
              <View style={styles.pickerBox}>
                <Picker
                  selectedValue={selectedTerm}
                  onValueChange={setSelectedTerm}
                  style={styles.picker}
                >
                  {TERMS.map((t) => (
                    <Picker.Item key={t} label={t} value={t} />
                  ))}
                </Picker>
              </View>
            </View>
          </View>

          {/* Load Report functionality is now automated via useEffect */}
        </View>

        {fetchingReport && (
          <View style={{ padding: 40, alignItems: "center" }}>
            <ActivityIndicator color={primary} size="large" />
            <Text style={{ marginTop: 10, color: "#64748B", fontWeight: "600" }}>Fetching Report Data...</Text>
          </View>
        )}

        {!fetchingReport && subjectsData.length === 0 && selectedChildId && (
          <View style={{ padding: 40, alignItems: "center" }}>
            <Text style={{ color: "#64748B", textAlign: "center", fontWeight: "600" }}>
              No approved academic records found for this period.
            </Text>
          </View>
        )}

        {!fetchingReport && subjectsData.length > 0 && (
          <Animatable.View
            animation="fadeInUp"
            duration={600}
            style={styles.paper}
          >
            {/* Letterhead */}
            <View style={styles.paperLetterhead}>
              <Image
                source={schoolLogo}
                style={styles.paperLogo}
                resizeMode="contain"
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.paperSchoolName}>
                  {SCHOOL_CONFIG.fullName}
                </Text>
                <Text style={styles.paperReportType}>
                  {selectedReportType.toUpperCase()} PROGRESS REPORT
                </Text>
                <Text style={styles.paperSchoolInfo}>
                  {SCHOOL_CONFIG.hotline} | {SCHOOL_CONFIG.email}
                </Text>
              </View>
            </View>

            <View style={styles.paperDivider} />

            <View style={styles.paperInfoGrid}>
              <View style={styles.paperInfoItem}>
                <Text style={styles.paperInfoLabel}>STUDENT:</Text>
                <Text style={styles.paperInfoValue}>
                  {report?.studentName ||
                    children.find((c) => c.id === selectedChildId)?.name}
                </Text>
              </View>
              <View style={styles.paperInfoItem}>
                <Text style={styles.paperInfoLabel}>CLASS:</Text>
                <Text style={styles.paperInfoValue}>
                  {className || report?.classId || "N/A"}
                </Text>
              </View>
              <View style={styles.paperInfoItem}>
                <Text style={styles.paperInfoLabel}>YEAR:</Text>
                <Text style={styles.paperInfoValue}>{selectedYear}</Text>
              </View>
              <View style={styles.paperInfoItem}>
                <Text style={styles.paperInfoLabel}>TERM:</Text>
                <Text style={styles.paperInfoValue}>{selectedTerm}</Text>
              </View>
              <View style={styles.paperInfoItem}>
                <Text style={styles.paperInfoLabel}>POSITION:</Text>
                <Text style={styles.paperInfoValue}>{overallPosition}</Text>
              </View>
            </View>

            {/* Table */}
            <View style={styles.paperTable}>
              <View style={styles.paperTableHeader}>
                <Text style={[styles.paperHeaderCell, { flex: 2, textAlign: "left" }]}>SUBJECT</Text>
                {selectedReportType === "End of Term" && (
                  <>
                    <Text style={styles.paperHeaderCell}>CLS</Text>
                    <Text style={styles.paperHeaderCell}>EXM</Text>
                  </>
                )}
                <Text style={styles.paperHeaderCell}>TOT</Text>
                <Text style={styles.paperHeaderCell}>GRD</Text>
                <Text style={[styles.paperHeaderCell, { flex: 1.5 }]}>REMARK</Text>
              </View>
              {subjectsData.map((s, i) => (
                <View
                  key={i}
                  style={[
                    styles.paperTableRow,
                    i % 2 !== 0 && { backgroundColor: "#F8FAFC" },
                  ]}
                >
                  <Text
                    style={[
                      styles.paperCell,
                      { flex: 2, textAlign: "left", fontWeight: "800" },
                    ]}
                  >
                    {s.subject}
                  </Text>
                  {selectedReportType === "End of Term" && (
                    <>
                      <Text style={styles.paperCell}>
                        {isNaN(Number(s.classScore)) ? s.classScore : Number(s.classScore).toFixed(0)}
                      </Text>
                      <Text style={styles.paperCell}>
                        {isNaN(Number(s.examsScore)) ? s.examsScore : Number(s.examsScore).toFixed(0)}
                      </Text>
                    </>
                  )}
                  <Text
                    style={[
                      styles.paperCell,
                      { fontWeight: "900", color: primary },
                    ]}
                  >
                    {isNaN(Number(s.total)) ? s.total : Number(s.total).toFixed(1)}
                  </Text>
                  <Text style={[styles.paperCell, { fontWeight: "700" }]}>
                    {s.grade}
                  </Text>
                  <Text style={[styles.paperCell, { flex: 1.5, fontSize: 8 }]}>{s.remark}</Text>
                </View>
              ))}
            </View>

            <View style={styles.paperSummaryRow}>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[styles.paperSummaryLabel, { fontSize: 9 }]}>
                  TRS: <Text style={{ color: "#1E293B" }}>{TRS}</Text> | TAS:{" "}
                  <Text style={{ color: "#1E293B" }}>{TAS}</Text>
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 }}>
                  <Text style={styles.paperSummaryLabel}>OVERALL AGGREGATE:</Text>
                  <Text style={styles.paperSummaryValue}>{unifiedAggregate}</Text>
                </View>
              </View>
            </View>

            <View style={styles.paperRemarksSection}>
              {selectedReportType === "End of Term" && report?.assessment && (
                <>
                  <Text style={styles.paperSectionTitle}>BEHAVIORAL RATINGS</Text>
                  <Text style={styles.paperRemarkLine}>
                    Conduct: <Text style={{ fontWeight: "700" }}>{report.assessment.conduct}</Text> | Attitude:{" "}
                    <Text style={{ fontWeight: "700" }}>{report.assessment.attitude}</Text> | Interest:{" "}
                    <Text style={{ fontWeight: "700" }}>{report.assessment.interest || "N/A"}</Text>
                  </Text>
                </>
              )}

              <Text style={[styles.paperSectionTitle, { marginTop: 10 }]}>TEACHER'S REMARKS</Text>
              <Text style={styles.paperRemarkText}>
                {report?.teacherRemarks || "Satisfactory performance."}
              </Text>

              <Text style={[styles.paperSectionTitle, { marginTop: 10 }]}>ADMIN REMARKS</Text>
              <Text style={styles.paperRemarkText}>
                {report?.adminRemarks || "Keep up the hard work."}
              </Text>

              <View style={styles.paperNextTerm}>
                <Text style={styles.paperNextTermLabel}>
                  NEXT TERM BEGINS:
                </Text>
                <Text style={styles.paperNextTermVal}>
                  {report?.nextTermBegins || "TBA"}
                </Text>
              </View>

              {report?.promotedTo ? (
                <View style={[styles.paperNextTerm, { marginTop: 5 }]}>
                  <Text style={styles.paperNextTermLabel}>PROMOTED TO:</Text>
                  <Text style={[styles.paperNextTermVal, { color: "#10b981" }]}>
                    {report.promotedTo}
                  </Text>
                </View>
              ) : null}

              {/* Signature Preview */}
              <View style={styles.paperSigRow}>
                <View style={{ flex: 1 }} />
                <View style={styles.paperSigItem}>
                  {adminSig ? (
                    <Image
                      source={{ uri: adminSig }}
                      style={styles.paperSigImg}
                    />
                  ) : (
                    <View style={styles.paperSigSpace} />
                  )}
                  <View style={styles.paperSigLine} />
                  <Text style={styles.paperSigLabel}>Head of Institution</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.downloadBtn, { backgroundColor: primary }]}
              onPress={downloadPDF}
            >
              <SVGIcon name="download" size={20} color="#fff" />
              <Text style={styles.downloadBtnText}>Generate Official PDF</Text>
            </TouchableOpacity>
          </Animatable.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    padding: 25,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
  },
  headerTitle: { fontSize: 24, fontWeight: "900", color: "#1E293B" },
  headerSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 4,
    fontWeight: "600",
  },
  selectorCard: {
    backgroundColor: "#fff",
    padding: 20,
    margin: 15,
    borderRadius: 24,
    ...SHADOWS.small,
  },
  label: {
    fontSize: 10,
    fontWeight: "900",
    color: "#94A3B8",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  chipRow: { paddingBottom: 15, gap: 10 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 15,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  chipText: { fontSize: 12, color: "#475569", fontWeight: "700" },
  pickerRow: { flexDirection: "row", gap: 15 },
  pickerBox: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    height: 50,
    justifyContent: "center",
  },
  picker: { height: 50 },
  viewBtn: {
    padding: 18,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 25,
    ...SHADOWS.small,
  },
  viewBtnText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  paper: {
    backgroundColor: "#fff",
    margin: 15,
    padding: 20,
    borderRadius: 4,
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  paperLetterhead: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  paperLogo: { width: 50, height: 50, marginRight: 15 },
  paperSchoolName: { fontSize: 16, fontWeight: "900", color: "#1E293B" },
  paperSchoolInfo: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
    marginTop: 2,
  },
  paperReportType: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
    marginTop: 2,
  },
  paperDivider: { height: 2, backgroundColor: "#1E293B", marginVertical: 10 },
  paperInfoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 15,
  },
  paperInfoItem: { width: "47%", marginBottom: 5 },
  paperInfoLabel: { fontSize: 8, fontWeight: "900", color: "#94A3B8" },
  paperInfoValue: { fontSize: 11, fontWeight: "700", color: "#1E293B" },
  paperTable: { borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 15 },
  paperTableHeader: {
    flexDirection: "row",
    backgroundColor: "#1E293B",
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
  },
  paperTableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
  },
  paperCell: { flex: 1, padding: 8, fontSize: 10, textAlign: "center", color: "#475569" },
  paperHeaderCell: {
    flex: 1,
    padding: 8,
    fontSize: 10,
    textAlign: "center",
    color: "#fff",
    fontWeight: "900",
  },
  paperSummaryRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
    marginBottom: 15,
  },
  paperSummaryLabel: { fontSize: 10, fontWeight: "900", color: "#64748B" },
  paperSummaryValue: { fontSize: 18, fontWeight: "900", color: "#ef4444" },
  paperRemarksSection: {
    borderTopWidth: 1,
    borderColor: "#E2E8F0",
    paddingTop: 15,
    marginBottom: 15,
  },
  paperSectionTitle: {
    fontSize: 9,
    fontWeight: "900",
    color: "#1E293B",
    textDecorationLine: "underline",
    marginBottom: 5,
  },
  paperRemarkLine: { fontSize: 11, color: "#475569" },
  paperRemarkText: { fontSize: 11, color: "#475569", fontStyle: "italic" },
  paperNextTerm: { flexDirection: "row", marginTop: 10, gap: 5 },
  paperNextTermLabel: { fontSize: 10, fontWeight: "900" },
  paperNextTermVal: { fontSize: 10, fontWeight: "700", color: COLORS.primary },
  paperSigRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    gap: 20,
  },
  paperSigItem: { flex: 1, alignItems: "center" },
  paperSigImg: { width: "100%", height: 40, resizeMode: "contain" },
  paperSigSpace: { height: 40 },
  paperSigLine: {
    width: "100%",
    height: 1,
    backgroundColor: "#1E293B",
    marginVertical: 4,
  },
  paperSigLabel: { fontSize: 8, fontWeight: "800", color: "#64748B" },
  downloadBtn: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  downloadBtnText: {
    color: "#fff",
    fontWeight: "900",
    marginLeft: 10,
    fontSize: 14,
  },
});
