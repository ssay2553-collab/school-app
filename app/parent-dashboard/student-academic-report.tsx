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
import { db } from "../../firebaseConfig";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";
import { getGradeDetails } from "../../lib/classHelpers";
import { getDocsCacheFirst } from "../../lib/firestoreHelpers";
import { shareFile } from "../../utils/shareUtils";

const TERMS = ["Term 1", "Term 2", "Term 3"];
type ReportType = "End of Term" | "Mid-Term" | "Mock Exams";

export default function StudentAcademicReport() {
  const { appUser } = useAuth();
  const acadConfig = useAcademicConfig();

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
  const [report, setReport] = useState<any>(null);
  const [subjectsData, setSubjectsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchingReport, setFetchingReport] = useState(false);

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
            name: `${d.data().profile?.firstName || ""} ${d.data().profile?.lastName || ""}`.trim(),
            classId: d.data().profile?.classId || "",
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

  // Sync with global academic config (initial load only)
  useEffect(() => {
    if (!acadConfig.loading && !selectedYear && acadConfig.academicYear) {
      setSelectedYear(acadConfig.academicYear);
      setSelectedTerm(acadConfig.currentTerm);
    }
  }, [acadConfig, selectedYear]);

  const loadReport = async () => {
    if (!selectedChildId || !selectedYear) return;
    setFetchingReport(true);
    setReport(null);
    setSubjectsData([]);

    try {
      const child = children.find((c) => c.id === selectedChildId);
      const classId = child?.classId;

      const qScores = query(
        collection(db, "academicRecords"),
        where("classId", "==", classId),
        where("academicYear", "==", selectedYear),
        where("term", "==", selectedTerm),
        where("reportType", "==", selectedReportType),
        where("status", "==", "approved"),
      );

      const scoresSnap = await getDocsCacheFirst(qScores);
      let results: any[] = [];

      scoresSnap.docs.forEach((d) => {
        const data = d.data();
        const studentsList = data.students || [];

        const sortedBySubject = [...studentsList].sort((a, b) => {
          const valA = parseFloat(
            a.finalScore ||
              (
                parseFloat(a.classScore || 0) + parseFloat(a.exam50 || 0)
              ).toFixed(2),
          );
          const valB = parseFloat(
            b.finalScore ||
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
            studentEntry.finalScore ||
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

      if (results.length === 0) {
        Alert.alert(
          "Not Ready",
          "No approved academic records found for this period.",
        );
        setFetchingReport(false);
        return;
      }

      setSubjectsData(results);

      // Fetch Metadata & Signatures
      const classSnap = await getDoc(doc(db, "classes", classId));
      if (classSnap.exists()) {
        const classTeacherId = classSnap.data().classTeacherId;
        if (classTeacherId) {
          const teacherSnap = await getDoc(doc(db, "users", classTeacherId));
          if (teacherSnap.exists())
            setTeacherSig(teacherSnap.data().profile?.signatureUrl || "");
        }
      }

      // Fetch Head of Institution Signature - Robust matching for various admin titles
      const qAdmin = query(
        collection(db, "users"),
        where("role", "==", "admin"),
      );

      const adminSnap = await getDocsFromServer(qAdmin);
      const headAdmin = adminSnap.docs.find((d) => {
        const r = (d.data().adminRole || "").toLowerCase();
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

      if (headAdmin && headAdmin.data().profile?.signatureUrl) {
        setAdminSig(headAdmin.data().profile?.signatureUrl);
      } else {
        const anySigAdmin = adminSnap.docs.find(
          (d) => d.data().profile?.signatureUrl,
        );
        if (anySigAdmin) {
          setAdminSig(anySigAdmin.data().profile?.signatureUrl);
        }
      }

      const reportId =
        `${selectedChildId}_${selectedYear}_${selectedTerm}_${selectedReportType.replace(/\s+/g, "")}`.replace(
          /\//g,
          "-",
        );
      const snap = await getDoc(doc(db, "student-reports", reportId));
      if (snap.exists()) {
        setReport(snap.data());
      } else {
        setReport({ studentName: child.name, classId });
      }
    } catch (err) {
      console.error("Load report error:", err);
      Alert.alert("Error", "Failed to load report.");
    } finally {
      setFetchingReport(false);
    }
  };

  const unifiedAggregate = useMemo(() => {
    if (subjectsData.length === 0) return 0;
    const coreList = ["Mathematics", "Science", "English"];

    const cores = subjectsData.filter((s) =>
      coreList.some((c) => s.subject.toLowerCase() === c.toLowerCase()),
    );

    const others = subjectsData
      .filter(
        (s) =>
          !coreList.some((c) => s.subject.toLowerCase() === c.toLowerCase()),
      )
      .sort((a, b) => (parseInt(a.grade) || 9) - (parseInt(b.grade) || 9));

    const coreSum = cores.reduce((a, c) => a + (parseInt(c.grade) || 9), 0);
    const electiveSum = others
      .slice(0, 3)
      .reduce((a, c) => a + (parseInt(c.grade) || 9), 0);

    const missingCoresCount = Math.max(0, 3 - cores.length);
    const missingElectivesCount = Math.max(0, 3 - others.length);

    return (
      coreSum + electiveSum + (missingCoresCount + missingElectivesCount) * 9
    );
  }, [subjectsData]);

  const downloadPDF = async () => {
    if (subjectsData.length === 0) return;
    const isFullReport = selectedReportType === "End of Term";

    try {
      let logoDataUri = "";
      let sigDataUri = "";

      if (Platform.OS !== "web") {
        // Mobile: Convert to Base64 for PDF engine reliability
        try {
          const asset = Asset.fromModule(schoolLogo);
          if (!asset.localUri) await asset.downloadAsync();
          const logoFile = new (FileSystem as any).File(
            asset.localUri || asset.uri,
          );
          const base64Logo = await logoFile.base64();
          logoDataUri = `data:image/png;base64,${base64Logo}`;
        } catch (e) {
          console.warn("Logo conversion failed", e);
        }

        if (adminSig) {
          try {
            const destSig = new (FileSystem as any).File(
              FileSystem.Paths.cache,
              "temp_sig_parent.png",
            );
            const downloaded = await (FileSystem as any).File.downloadFileAsync(
              adminSig,
              destSig,
            );
            const base64Sig = await downloaded.base64();
            sigDataUri = `data:image/png;base64,${base64Sig}`;
          } catch (e) {
            console.warn("Signature conversion failed", e);
          }
        }
      } else {
        const asset = Asset.fromModule(schoolLogo);
        logoDataUri = asset.uri;
        sigDataUri = adminSig;
      }

      const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <style>
            @page { size: A4; margin: 15mm; }
            body { font-family: 'Helvetica', 'Arial', sans-serif; margin: 0; padding: 0; color: #1E293B; background-color: #fff; }
            .container { width: 100%; box-sizing: border-box; position: relative; }

            .header-table { width: 100%; border-bottom: 2pt solid #1E293B; padding-bottom: 15px; margin-bottom: 20px; }
            .header-logo { width: 80px; vertical-align: middle; }
            .header-text { text-align: left; padding-left: 20px; vertical-align: middle; }
            .school-name { font-size: 22pt; font-weight: 900; margin: 0; text-transform: uppercase; color: #1E293B; }
            .school-info { font-size: 9pt; margin: 2px 0; font-weight: 600; color: #64748B; }

            .report-title { text-align: center; font-size: 14pt; font-weight: 900; margin: 20px 0; color: #1E293B; letter-spacing: 1.5pt; text-transform: uppercase; }

            .info-grid { width: 100%; border-collapse: collapse; margin-bottom: 25px; border: 1pt solid #E2E8F0; }
            .info-grid td { padding: 8pt 12pt; font-size: 10pt; border: 1pt solid #E2E8F0; }
            .label-cell { background-color: #F8FAFC; color: #64748B; font-weight: 800; width: 20%; font-size: 8pt; text-transform: uppercase; }
            .value-cell { width: 30%; font-weight: 700; color: #1E293B; }

            .results-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; table-layout: fixed; }
            .results-table th { background-color: #1E293B !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; color: #fff !important; padding: 10pt 5pt; font-size: 9pt; border: 1pt solid #334155; text-transform: uppercase; }
            .results-table td { padding: 8pt 5pt; font-size: 10pt; border: 1pt solid #E2E8F0; text-align: center; font-weight: 600; color: #1E293B; }
            .results-table tr:nth-child(even) { background-color: #F8FAFC !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .subj-name { text-align: left !important; padding-left: 12pt !important; font-weight: 800; text-transform: uppercase; color: #0F172A; }

            .summary-box { border: 1pt solid #E2E8F0; padding: 12pt; margin-bottom: 20px; background-color: #F1F5F9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; border-radius: 4pt; }
            .summary-text { font-size: 11pt; font-weight: 900; margin: 0; color: #1E293B; text-align: center; }

            .remarks-box { margin-top: 10pt; border: 1pt solid #E2E8F0; padding: 12pt; border-radius: 4pt; background-color: #F8FAFC !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .remark-line { margin-bottom: 10pt; font-size: 10pt; line-height: 1.5; color: #334155; }
            .remark-header { font-weight: 900; color: #1E293B; margin-right: 8pt; font-size: 8.5pt; text-transform: uppercase; }

            .footer-table { width: 100%; margin-top: 40pt; }
            .sig-section { text-align: center; vertical-align: bottom; }
            .sig-line { border-top: 1pt solid #1E293B; width: 80%; margin: 5pt auto; }
            .sig-label { font-size: 9pt; font-weight: 800; text-transform: uppercase; color: #64748B; }
            .sig-image { height: 45pt; object-fit: contain; margin-bottom: -5pt; }

            .verified-footer { margin-top: 50pt; border-top: 1pt solid #E2E8F0; padding-top: 10pt; }
            .footer-flex { display: flex; justify-content: space-between; align-items: center; }
            .footer-meta { font-size: 8pt; color: #94A3B8; line-height: 1.4; }
            .qr-img { width: 50pt; height: 50pt; opacity: 0.8; }

            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; }
          </style>
        </head>
        <body>
          <div class="container">
            <table class="header-table">
              <tr>
                <td class="header-logo">
                  ${logoDataUri ? `<img src="${logoDataUri}" style="width: 80px; height: 80px;" />` : ""}
                </td>
                <td class="header-text">
                  <h1 class="school-name">${SCHOOL_CONFIG.fullName}</h1>
                  <p class="school-info">${SCHOOL_CONFIG.address || "Quality Education & Discipline"}</p>
                  <p class="school-info">Contact: ${SCHOOL_CONFIG.hotline || ""} | Email: ${SCHOOL_CONFIG.email || ""}</p>
                </td>
              </tr>
            </table>

            <div class="report-title">${selectedReportType} PROGRESS REPORT</div>

            <table class="info-grid">
              <tr>
                <td class="label-cell">Student Name</td><td class="value-cell">${report?.studentName || children.find((c) => c.id === selectedChildId)?.name}</td>
                <td class="label-cell">Class/Grade</td><td class="value-cell">${report?.classId || ""}</td>
              </tr>
              <tr>
                <td class="label-cell">Academic Year</td><td class="value-cell">${selectedYear}</td>
                <td class="label-cell">Term/Period</td><td class="value-cell">${selectedTerm}</td>
              </tr>
              <tr>
                <td class="label-cell">Aggregate</td><td class="value-cell" style="font-size: 14pt;">${unifiedAggregate}</td>
                <td class="label-cell">Promoted To</td><td class="value-cell">${report?.promotedTo || "N/A"}</td>
              </tr>
            </table>

            <table class="results-table">
              <thead>
                <tr>
                  <th style="width: 30%;">Subject</th>
                  <th style="width: 10%;">Class</th>
                  <th style="width: 10%;">Exams</th>
                  <th style="width: 10%;">Total</th>
                  <th style="width: 8%;">Grade</th>
                  <th style="width: 8%;">Pos.</th>
                  <th style="width: 24%;">Remark</th>
                </tr>
              </thead>
              <tbody>
                ${subjectsData
                  .map(
                    (s) => `
                  <tr>
                    <td class="subj-name">${s.subject}</td>
                    <td>${s.classScore}</td>
                    <td>${s.examsScore}</td>
                    <td style="font-weight: 900;">${s.total}</td>
                    <td>${s.grade}</td>
                    <td>${s.pos}</td>
                    <td style="font-size: 9pt; text-align: left; padding-left: 5pt;">${s.remark}</td>
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
            </table>

            <div class="summary-box">
              <p class="summary-text">OFFICIAL AGGREGATE: ${unifiedAggregate}</p>
            </div>

            ${
              isFullReport
                ? `
              <div class="remarks-box">
                <div class="remark-line"><span class="remark-header">BEHAVIORAL:</span> Conduct: <b>${report?.assessment?.conduct || "N/A"}</b> | Attitude: <b>${report?.assessment?.attitude || "N/A"}</b> | Interest: <b>${report?.assessment?.interest || "N/A"}</b></div>
                <div class="remark-line"><span class="remark-header">CLASS TEACHER:</span> ${report?.teacherRemarks || "Satisfactory performance."}</div>
                <div class="remark-line"><span class="remark-header">ADMINISTRATIVE:</span> ${report?.adminRemarks || "Keep up the hard work."}</div>
                <div class="remark-line"><span class="remark-header">NEXT TERM BEGINS:</span> <b>${report?.nextTermBegins || "To be communicated"}</b></div>
              </div>
            `
                : ""
            }

            <table class="footer-table">
              <tr>
                <td class="sig-section" style="width: 50%;"></td>
                <td class="sig-section" style="width: 50%;">
                  ${sigDataUri ? `<img src="${sigDataUri}" class="sig-image" />` : '<div style="height:45pt;"></div>'}
                  <div class="sig-line"></div>
                  <div class="sig-label">Head of Institution's Signature & Stamp</div>
                </td>
              </tr>
            </table>

            <div class="verified-footer">
              <div class="footer-flex">
                <div class="footer-meta">
                  <b>DIGITALLY VERIFIED ACADEMIC RECORD</b><br/>
                  Ref: ${selectedChildId.substring(0, 8)}-${selectedYear.replace("/", "")}<br/>
                  Date: ${new Date().toLocaleDateString()}
                </div>
                <img class="qr-img" src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=VERIFY-${selectedChildId}" />
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
      Alert.alert("Error", "Could not generate PDF.");
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

          <TouchableOpacity
            style={[styles.viewBtn, { backgroundColor: primary }]}
            onPress={loadReport}
            disabled={fetchingReport}
          >
            {fetchingReport ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.viewBtnText}>Generate Report Card</Text>
            )}
          </TouchableOpacity>
        </View>

        {subjectsData.length > 0 && (
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
                  {report?.classId || "N/A"}
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
            </View>

            {/* Table */}
            <View style={styles.paperTable}>
              <View style={styles.paperTableHeader}>
                <Text
                  style={[styles.paperCell, { flex: 3, textAlign: "left" }]}
                >
                  SUBJECT
                </Text>
                <Text style={styles.paperCell}>SCORE</Text>
                <Text style={styles.paperCell}>GRD</Text>
                <Text style={styles.paperCell}>POS</Text>
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
                      { flex: 3, textAlign: "left", fontWeight: "800" },
                    ]}
                  >
                    {s.subject}
                  </Text>
                  <Text
                    style={[
                      styles.paperCell,
                      { fontWeight: "900", color: primary },
                    ]}
                  >
                    {s.total}
                  </Text>
                  <Text style={[styles.paperCell, { fontWeight: "700" }]}>
                    {s.grade}
                  </Text>
                  <Text style={styles.paperCell}>{s.pos}</Text>
                </View>
              ))}
            </View>

            <View style={styles.paperSummaryRow}>
              <Text style={styles.paperSummaryLabel}>OVERALL AGGREGATE:</Text>
              <Text style={styles.paperSummaryValue}>{unifiedAggregate}</Text>
            </View>

            {selectedReportType === "End of Term" && report?.assessment && (
              <View style={styles.paperRemarksSection}>
                <Text style={styles.paperSectionTitle}>BEHAVIORAL RATINGS</Text>
                <Text style={styles.paperRemarkLine}>
                  Conduct:{" "}
                  <Text style={{ fontWeight: "700" }}>
                    {report.assessment.conduct}
                  </Text>{" "}
                  | Attitude:{" "}
                  <Text style={{ fontWeight: "700" }}>
                    {report.assessment.attitude}
                  </Text>
                </Text>

                <Text style={[styles.paperSectionTitle, { marginTop: 10 }]}>
                  ADMIN REMARKS
                </Text>
                <Text style={styles.paperRemarkText}>
                  {report.adminRemarks || "Satisfactory."}
                </Text>

                <View style={styles.paperNextTerm}>
                  <Text style={styles.paperNextTermLabel}>
                    NEXT TERM BEGINS:
                  </Text>
                  <Text style={styles.paperNextTermVal}>
                    {report.nextTermBegins || "TBA"}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.downloadBtn, { backgroundColor: primary }]}
              onPress={downloadPDF}
            >
              <SVGIcon name="download" size={20} color="#fff" />
              <Text style={styles.downloadBtnText}>Save Official PDF</Text>
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
    backgroundColor: "#F8FAFC",
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
  },
  paperTableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
  },
  paperCell: { flex: 1, padding: 8, fontSize: 10, textAlign: "center" },
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
