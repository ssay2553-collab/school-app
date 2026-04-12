import { Asset } from "expo-asset";
import Constants from "expo-constants";
import * as Print from "expo-print";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    getDocsFromServer,
    limit,
    query,
    where,
} from "firebase/firestore";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { getSchoolLogo } from "../../constants/Logos";
import { COLORS, SHADOWS } from "../../constants/theme";
import { db } from "../../firebaseConfig";

import { getGradeDetails } from "../../lib/classHelpers";
import { getDocsCacheFirst } from "../../lib/firestoreHelpers";

type ReportType = "End of Term" | "Mid-Term" | "Mock Exams";

export default function ViewAcademicRecordDetails() {
  const params = useLocalSearchParams();
  const router = useRouter();

  const studentId = params.studentId as string;
  const termState = params.term as string;
  const classIdState = params.classId as string;
  const academicYearState = params.academicYear as string;
  const reportType = (params.reportType as ReportType) || "End of Term";

  const isFullReport = reportType === "End of Term";

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [subjectsData, setSubjectsData] = useState<any[]>([]);

  const [adminRemarks, setAdminRemarks] = useState("");
  const [teacherRemarks, setTeacherRemarks] = useState("");
  const [conduct, setConduct] = useState("Excellent");
  const [attitude, setAttitude] = useState("Very Positive");
  const [interest, setInterest] = useState("High");
  const [promotedTo, setPromotedTo] = useState("");
  const [nextTermBegins, setNextTermBegins] = useState("");

  const [teacherSig, setTeacherSig] = useState("");
  const [adminSig, setAdminSig] = useState("");

  const primary = SCHOOL_CONFIG.primaryColor || COLORS.primary || "#2e86de";
  const schoolId = (
    Constants.expoConfig?.extra?.schoolId || "afahjoy"
  ).toLowerCase();
  const schoolLogo = getSchoolLogo(schoolId);

  useEffect(() => {
    const fetchAllData = async () => {
      if (!studentId || !termState || !classIdState || !academicYearState)
        return;
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

        const scoresSnap = await getDocsCacheFirst(qScores);
        let studentResults: any[] = [];
        let nameFound = "";

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
            sortedBySubject.findIndex((s) => s.studentId === studentId) + 1;

          const studentEntry = studentsList.find(
            (s: any) => s.studentId === studentId,
          );
          if (studentEntry) {
            if (!nameFound) nameFound = studentEntry.fullName;
            const scoreValue = parseFloat(
              studentEntry.finalScore ||
                (
                  parseFloat(studentEntry.classScore || 0) +
                  parseFloat(studentEntry.exam50 || 0)
                ).toFixed(2),
            );
            const gradeObj = getGradeDetails(scoreValue);
            studentResults.push({
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

        setStudentName(nameFound);
        setSubjectsData(studentResults);

        // Fetch Head of Institution Signature
        const qAdmin = query(
          collection(db, "users"),
          where("role", "==", "admin"),
        );

        const adminSnap = await getDocsFromServer(qAdmin);

        const headAdmin = adminSnap.docs.find(d => {
          const r = (d.data().adminRole || "").toLowerCase();
          return ["proprietor", "head", "ceo", "principal", "director", "administrator", "bursar", "owner", "manager"].some(title => r.includes(title));
        });

        if (headAdmin && headAdmin.data().profile?.signatureUrl) {
          setAdminSig(headAdmin.data().profile?.signatureUrl);
        } else {
          const anySigAdmin = adminSnap.docs.find(d => d.data().profile?.signatureUrl);
          if (anySigAdmin) {
            setAdminSig(anySigAdmin.data().profile?.signatureUrl);
          }
        }

        if (isFullReport) {
          const reportId =
            `${studentId}_${academicYearState}_${termState}_${reportType.replace(/\s+/g, "")}`.replace(
              /\//g,
              "-",
            );
          const reportSnap = await getDoc(doc(db, "student-reports", reportId));
          if (reportSnap.exists()) {
            const r = reportSnap.data();
            setAdminRemarks(r.adminRemarks || "");
            setTeacherRemarks(r.teacherRemarks || "");
            setConduct(r.assessment?.conduct || "Excellent");
            setAttitude(r.assessment?.attitude || "Very Positive");
            setInterest(r.assessment?.interest || "High");
            setPromotedTo(r.promotedTo || "");
            setNextTermBegins(r.nextTermBegins || "");
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

  const AGGREGATE = useMemo(() => {
    if (subjectsData.length === 0) return 0;
    const coreList = ["Mathematics", "Science", "English"];
    const cores = subjectsData.filter((s) =>
      coreList.some((c) => s.subject.toLowerCase() === c.toLowerCase()),
    );
    const others = subjectsData
      .filter((s) =>
        !coreList.some((c) => s.subject.toLowerCase() === c.toLowerCase()),
      )
      .sort((a, b) => (parseInt(a.grade) || 9) - (parseInt(b.grade) || 9));

    const coreSum = cores.reduce((a, c) => a + (parseInt(c.grade) || 9), 0);
    const electiveSum = others.slice(0, 3).reduce((a, c) => a + (parseInt(c.grade) || 9), 0);
    const missingCoresCount = Math.max(0, 3 - cores.length);
    const missingElectivesCount = Math.max(0, 3 - others.length);

    return coreSum + electiveSum + (missingCoresCount + missingElectivesCount) * 9;
  }, [subjectsData]);

  const TAS = useMemo(() => {
    const coreList = ["Mathematics", "Science", "English"];
    const cores = subjectsData.filter((s) => coreList.some((c) => s.subject.toLowerCase() === c.toLowerCase()));
    const others = subjectsData
      .filter((s) => !coreList.some((c) => s.subject.toLowerCase() === c.toLowerCase()))
      .sort((a, b) => b.total - a.total);
    const coreTotal = cores.reduce((a, c) => a + (parseFloat(c.total) || 0), 0);
    const electiveTotal = others.slice(0, 3).reduce((a, c) => a + (parseFloat(c.total) || 0), 0);
    return (coreTotal + electiveTotal).toFixed(2);
  }, [subjectsData]);

  const TRS = useMemo(() => {
    return subjectsData.reduce((acc, curr) => acc + (parseFloat(curr.total) || 0), 0).toFixed(2);
  }, [subjectsData]);

  const generatePDF = async () => {
    if (subjectsData.length === 0) return Alert.alert("No Data", "No records found.");
    if (generating) return;
    setGenerating(true);

    try {
      let logoDataUri = "";
      let sigDataUri = "";

      if (Platform.OS !== "web") {
        try {
          const asset = Asset.fromModule(schoolLogo);
          if (!asset.localUri) await asset.downloadAsync();
          const base64Logo = await FileSystem.readAsStringAsync(asset.localUri || asset.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          logoDataUri = `data:image/png;base64,${base64Logo}`;
        } catch (e) { console.warn("Logo conversion failed", e); }

        if (adminSig) {
          try {
            const { uri: localSig } = await FileSystem.downloadAsync(adminSig, FileSystem.cacheDirectory + "temp_sig.png");
            const base64Sig = await FileSystem.readAsStringAsync(localSig, { encoding: FileSystem.EncodingType.Base64 });
            sigDataUri = `data:image/png;base64,${base64Sig}`;
          } catch (e) { console.warn("Signature conversion failed", e); }
        }
      } else {
        logoDataUri = Asset.fromModule(schoolLogo).uri;
        sigDataUri = adminSig;
      }

      const pdfHtmlContent = `
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
          </style>
        </head>
        <body>
          <div class="container">
            <table class="header-table">
              <tr>
                <td class="header-logo">
                  ${logoDataUri ? `<img src="${logoDataUri}" style="width: 80px; height: 80px;" />` : ''}
                </td>
                <td class="header-text">
                  <h1 class="school-name">${SCHOOL_CONFIG.fullName}</h1>
                  <p class="school-info">${SCHOOL_CONFIG.address || "Quality Education & Discipline"}</p>
                  <p class="school-info">Contact: ${SCHOOL_CONFIG.hotline || ""} | Email: ${SCHOOL_CONFIG.email || ""}</p>
                </td>
              </tr>
            </table>
            <div class="report-title">${reportType} PROGRESS REPORT</div>
            <table class="info-grid">
              <tr>
                <td class="label-cell">Student Name</td><td class="value-cell">${studentName}</td>
                <td class="label-cell">Class/Grade</td><td class="value-cell">${classIdState}</td>
              </tr>
              <tr>
                <td class="label-cell">Academic Year</td><td class="value-cell">${academicYearState}</td>
                <td class="label-cell">Term/Period</td><td class="value-cell">${termState}</td>
              </tr>
              <tr>
                <td class="label-cell">Total Raw Score</td><td class="value-cell">${TRS}</td>
                <td class="label-cell">Aggregate</td><td class="value-cell" style="font-size: 14pt;">${AGGREGATE}</td>
              </tr>
              <tr>
                 <td class="label-cell">Promoted To</td><td class="value-cell">${promotedTo || "N/A"}</td>
                 <td class="label-cell">Student ID</td><td class="value-cell">${studentId.substring(0, 10)}</td>
              </tr>
            </table>
            <table class="results-table">
              <thead>
                <tr>
                  <th style="width: 30%;">Subject</th>
                  ${isFullReport ? '<th style="width: 10%;">Class</th><th style="width: 10%;">Exams</th><th style="width: 10%;">Total</th>' : '<th style="width: 12%;">Score</th>'}
                  <th style="width: 8%;">Grade</th><th style="width: 8%;">Pos.</th><th style="width: 24%;">Remark</th>
                </tr>
              </thead>
              <tbody>
                ${subjectsData.map(s => `
                  <tr>
                    <td class="subj-name">${s.subject}</td>
                    ${isFullReport ? `<td>${s.classScore}</td><td>${s.examsScore}</td><td style="font-weight: 900;">${s.total}</td>` : `<td style="font-weight: 900;">${s.total}</td>`}
                    <td>${s.grade}</td><td>${s.pos}</td><td style="font-size: 9pt; text-align: left; padding-left: 5pt;">${s.remark}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="summary-box"><p class="summary-text">OFFICIAL AGGREGATE: ${AGGREGATE} | TRS: ${TRS} | TAS: ${TAS}</p></div>
            ${isFullReport ? `
              <div class="remarks-box">
                <div class="remark-line"><span class="remark-header">BEHAVIORAL:</span> Conduct: <b>${conduct}</b> | Attitude: <b>${attitude}</b> | Interest: <b>${interest}</b></div>
                <div class="remark-line"><span class="remark-header">CLASS TEACHER:</span> ${teacherRemarks || "Satisfactory performance."}</div>
                <div class="remark-line"><span class="remark-header">ADMINISTRATIVE:</span> ${adminRemarks || "Keep up the hard work."}</div>
                <div class="remark-line"><span class="remark-header">NEXT TERM BEGINS:</span> <b>${nextTermBegins || "To be communicated"}</b></div>
              </div>
            ` : ""}
            <table class="footer-table">
              <tr>
                <td style="width: 50%;"></td>
                <td class="sig-section" style="width: 50%;">
                  ${sigDataUri ? `<img src="${sigDataUri}" class="sig-image" />` : '<div style="height:45pt;"></div>'}
                  <div class="sig-line"></div>
                  <div class="sig-label">Head of Institution's Signature & Stamp</div>
                </td>
              </tr>
            </table>
            <div class="verified-footer"><div class="footer-flex"><div class="footer-meta"><b>DIGITALLY VERIFIED ACADEMIC RECORD</b><br/>Ref: ${studentId.substring(0, 8)}-${academicYearState.replace("/", "")}<br/>Date: ${new Date().toLocaleDateString()}</div><img class="qr-img" src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=VERIFY-${studentId}" /></div></div>
          </div>
        </body>
        </html>
      `;

      const safeName = studentName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      const fileName = `Report_${safeName}_${termState.replace(/[^a-z0-9]/gi, "_")}.pdf`;

      if (Platform.OS !== "web") {
        const result = await Print.printToFileAsync({ html: pdfHtmlContent });
        const newUri = FileSystem.documentDirectory + fileName;
        await FileSystem.moveAsync({ from: result.uri, to: newUri });
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(newUri);
      } else {
        await Print.printAsync({ html: pdfHtmlContent });
      }
    } catch (error) {
      console.error("PDF error:", error);
      Alert.alert("Error", "Failed to generate PDF.");
    } finally { setGenerating(false); }
  };

  if (loading) return (
    <View style={styles.center}><ActivityIndicator size="large" color={primary} /></View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backIcon}>
          <SVGIcon name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>{reportType} Report Sheet</Text>
        <TouchableOpacity onPress={generatePDF} style={styles.printIcon} disabled={generating}>
          {generating ? <ActivityIndicator size="small" color={primary} /> : <SVGIcon name="download" size={24} color={primary} />}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Animatable.View animation="fadeInUp" duration={600} style={styles.paper}>
          <View style={styles.letterhead}>
            <Image source={schoolLogo} style={styles.logo} resizeMode="contain" />
            <View style={styles.schoolDetails}>
              <Text style={styles.schoolNameText}>{SCHOOL_CONFIG.fullName}</Text>
              <Text style={styles.schoolAddress}>{SCHOOL_CONFIG.address || "Quality Education for All"}</Text>
              <Text style={styles.reportTitleText}>{reportType.toUpperCase()} PROGRESS REPORT</Text>
            </View>
          </View>
          <View style={styles.headerLine} />

          <View style={styles.infoGrid}>
            <View style={styles.infoItem}><Text style={styles.infoLabel}>NAME:</Text><Text style={styles.infoValue}>{studentName}</Text></View>
            <View style={styles.infoItem}><Text style={styles.infoLabel}>CLASS:</Text><Text style={styles.infoValue}>{classIdState}</Text></View>
            <View style={styles.infoItem}><Text style={styles.infoLabel}>YEAR:</Text><Text style={styles.infoValue}>{academicYearState}</Text></View>
            <View style={styles.infoItem}><Text style={styles.infoLabel}>TERM:</Text><Text style={styles.infoValue}>{termState}</Text></View>
          </View>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.subCell, { color: "#fff" }]}>SUBJECT</Text>
              {isFullReport ? (
                <><Text style={[styles.cell, styles.numCell, { color: "#fff" }]}>CLASS</Text><Text style={[styles.cell, styles.numCell, { color: "#fff" }]}>EXAM</Text><Text style={[styles.cell, styles.numCell, { color: "#fff" }]}>TOTAL</Text></>
              ) : <Text style={[styles.cell, styles.numCell, { color: "#fff" }]}>SCORE</Text>}
              <Text style={[styles.cell, styles.numCell, { color: "#fff" }]}>GRD</Text><Text style={[styles.cell, styles.posCell, { color: "#fff" }]}>POS</Text><Text style={[styles.cell, styles.remCell, { color: "#fff" }]}>REMARKS</Text>
            </View>
            {subjectsData.map((s, i) => (
              <View key={i} style={[styles.tableRow, i % 2 !== 0 && { backgroundColor: "#F8FAFC" }]}>
                <Text style={[styles.cell, styles.subCell, { fontWeight: "800" }]}>{s.subject}</Text>
                {isFullReport ? (
                  <><Text style={[styles.cell, styles.numCell]}>{s.classScore}</Text><Text style={[styles.cell, styles.numCell]}>{s.examsScore}</Text><Text style={[styles.cell, styles.numCell, { fontWeight: "900", color: primary }]}>{s.total}</Text></>
                ) : <Text style={[styles.cell, styles.numCell, { fontWeight: "900", color: primary }]}>{s.total}</Text>}
                <Text style={[styles.cell, styles.numCell, { fontWeight: "800" }]}>{s.grade}</Text><Text style={[styles.cell, styles.posCell]}>{s.pos}</Text><Text style={[styles.cell, styles.remCell, { fontSize: 9, textAlign: 'left', paddingLeft: 4 }]}>{s.remark}</Text>
              </View>
            ))}
          </View>

          <View style={styles.summarySection}>
            <View style={styles.summaryItem}><Text style={styles.summaryLabel}>TRS:</Text><Text style={styles.summaryVal}>{TRS}</Text></View>
            <View style={styles.summaryItem}><Text style={styles.summaryLabel}>TAS:</Text><Text style={styles.summaryVal}>{TAS}</Text></View>
            <View style={styles.summaryItem}><Text style={styles.summaryLabel}>AGGREGATE:</Text><Text style={styles.summaryVal}>{AGGREGATE}</Text></View>
          </View>

          {isFullReport && (
            <View style={styles.remarksSection}>
              <Text style={styles.sectionHeading}>BEHAVIORAL RATINGS</Text>
              <View style={styles.ratingRow}>
                <Text style={styles.ratingText}>Conduct: <Text style={styles.boldText}>{conduct}</Text></Text>
                <Text style={styles.ratingText}>Attitude: <Text style={styles.boldText}>{attitude}</Text></Text>
                <Text style={styles.ratingText}>Interest: <Text style={styles.boldText}>{interest}</Text></Text>
              </View>
              <Text style={[styles.sectionHeading, { marginTop: 15 }]}>TEACHER'S REMARKS</Text>
              <View style={styles.remarkBox}><Text style={styles.remarkText}>{teacherRemarks || "Satisfactory performance."}</Text></View>
              <Text style={[styles.sectionHeading, { marginTop: 15 }]}>ADMINISTRATIVE REMARKS</Text>
              <View style={styles.remarkBox}><Text style={styles.remarkText}>{adminRemarks || "Performance is commendable."}</Text></View>
              <View style={styles.nextTermRow}><Text style={styles.nextTermLabel}>NEXT TERM BEGINS:</Text><Text style={styles.nextTermVal}>{nextTermBegins || "To be communicated"}</Text></View>
            </View>
          )}

          <View style={[styles.footer, !isFullReport && { marginTop: 80 }]}>
            <View style={[styles.sigContainer, { width: '100%' }]}>
              {adminSig ? <Image source={{ uri: adminSig }} style={styles.sigImgUI} resizeMode="contain" /> : <View style={{ height: 40 }} />}
              <View style={styles.sigLine} />
              <Text style={styles.sigLabel}>HEAD OF INSTITUTION</Text>
            </View>
          </View>
          <View style={styles.watermark}><SVGIcon name="ribbon" size={120} color="rgba(0,0,0,0.03)" /></View>
        </Animatable.View>

        <TouchableOpacity style={[styles.downloadBtn, { backgroundColor: primary }]} onPress={generatePDF} disabled={generating}>
          {generating ? <ActivityIndicator color="#fff" /> : <><SVGIcon name="download" size={22} color="#fff" /><Text style={styles.downloadBtnText}>Download PDF Report</Text></>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#E2E8F0" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  navBar: { height: 60, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, borderBottomWidth: 1, borderColor: "#CBD5E1" },
  navTitle: { fontSize: 16, fontWeight: "800", color: "#1E293B" },
  backIcon: { width: 40 },
  printIcon: { width: 40, alignItems: "flex-end" },
  scrollContent: { padding: 12, paddingBottom: 40 },
  paper: { backgroundColor: "#fff", borderRadius: 2, padding: 25, ...SHADOWS.medium, minHeight: 842, borderWidth: 1, borderColor: "#94A3B8", overflow: "hidden" },
  letterhead: { flexDirection: "row", alignItems: "center", marginBottom: 15 },
  logo: { width: 70, height: 70, marginRight: 20 },
  schoolDetails: { flex: 1 },
  schoolNameText: { fontSize: 20, fontWeight: "900", color: "#1E293B", textTransform: "uppercase" },
  schoolAddress: { fontSize: 11, color: "#64748B", fontWeight: "600", marginTop: 2 },
  reportTitleText: { fontSize: 13, fontWeight: "800", color: "#1E293B", marginTop: 8, letterSpacing: 1 },
  headerLine: { height: 3, backgroundColor: "#1E293B", marginBottom: 15 },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 20, borderBottomWidth: 1, borderTopWidth: 1, borderColor: "#E2E8F0", paddingVertical: 10 },
  infoItem: { width: "50%", flexDirection: "row", marginBottom: 5 },
  infoLabel: { fontSize: 10, fontWeight: "900", color: "#64748B", width: 60 },
  infoValue: { fontSize: 11, fontWeight: "700", color: "#1E293B", flex: 1 },
  table: { borderWidth: 1, borderColor: "#000", marginBottom: 20 },
  tableHeader: { flexDirection: "row", backgroundColor: "#1E293B" },
  tableRow: { flexDirection: "row", borderTopWidth: 1, borderColor: "#E2E8F0" },
  cell: { padding: 8, fontSize: 10, textAlign: "center", borderRightWidth: 1, borderColor: "#E2E8F0" },
  subCell: { flex: 3, textAlign: "left" },
  numCell: { flex: 1 },
  remCell: { flex: 2 },
  posCell: { flex: 0.8, borderRightWidth: 0 },
  summarySection: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#F1F5F9", padding: 12, borderRadius: 4, marginBottom: 20 },
  summaryItem: { flexDirection: "row", alignItems: "center" },
  summaryLabel: { fontSize: 10, fontWeight: "900", color: "#64748B", marginRight: 8 },
  summaryVal: { fontSize: 15, fontWeight: "900", color: "#1E293B" },
  remarksSection: { marginBottom: 30 },
  sectionHeading: { fontSize: 10, fontWeight: "900", color: "#1E293B", textDecorationLine: "underline", marginBottom: 8 },
  ratingRow: { flexDirection: "row", gap: 20, marginBottom: 15 },
  ratingText: { fontSize: 11, color: "#475569" },
  boldText: { fontWeight: "800", color: "#1E293B" },
  remarkBox: { padding: 10, backgroundColor: "#F8FAFC", borderRadius: 4, borderWidth: 1, borderColor: "#E2E8F0", minHeight: 45 },
  remarkText: { fontSize: 11, color: "#475569", fontStyle: "italic" },
  nextTermRow: { flexDirection: "row", marginTop: 20, alignItems: "center" },
  nextTermLabel: { fontSize: 11, fontWeight: "900", color: "#1E293B", marginRight: 10 },
  nextTermVal: { fontSize: 11, fontWeight: "800", color: SCHOOL_CONFIG.primaryColor || "#2e86de" },
  footer: { flexDirection: "row", justifyContent: "space-between", marginTop: 40 },
  sigContainer: { width: "45%", alignItems: "center" },
  sigLine: { width: "60%", height: 1, backgroundColor: "#000", marginBottom: 8 },
  sigLabel: { fontSize: 9, fontWeight: "900", color: "#64748B" },
  sigImgUI: { width: "80%", height: 40, marginBottom: 5 },
  watermark: { position: "absolute", top: "40%", left: "20%", zIndex: -1 },
  downloadBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 25, paddingVertical: 16, borderRadius: 12, gap: 10, ...SHADOWS.small },
  downloadBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
