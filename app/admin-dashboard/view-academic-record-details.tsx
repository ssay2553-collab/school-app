import { Asset } from "expo-asset";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system";
import * as Print from "expo-print";
import { useLocalSearchParams, useRouter } from "expo-router";
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
import {
    ActivityIndicator,
    Alert,
    Image,
    Platform,
    SafeAreaView,
    ScrollView,
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
import { getGradeDetails, calculatePerformanceFromList } from "../../lib/classHelpers";
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
  const [className, setClassName] = useState("");
  const [subjectsData, setSubjectsData] = useState<any[]>([]);

  const [adminRemarks, setAdminRemarks] = useState("");
  const [teacherRemarks, setTeacherRemarks] = useState("");
  const [conduct, setConduct] = useState("Excellent");
  const [attitude, setAttitude] = useState("Very Positive");
  const [interest, setInterest] = useState("High");
  const [promotedTo, setPromotedTo] = useState("");
  const [nextTermBegins, setNextTermBegins] = useState("");

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

        // Fetch class details
        try {
          const classDoc = await getDoc(doc(db, "classes", classIdState));
          if (classDoc.exists()) {
            const classData: any = classDoc.data();
            setClassName(classData.className || classData.name || classIdState);
          } else {
            setClassName(classIdState);
          }
        } catch (e) {
          setClassName(classIdState);
        }

        // Fetch Head of Institution Signature
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

  const { trs: TRS, tas: TAS, aggregate: AGGREGATE } = useMemo(() => {
    return calculatePerformanceFromList(subjectsData);
  }, [subjectsData]);

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
          } catch (e) {
            console.warn("Base64 fetch failed for", uri, e);
            return uri;
          }
        } else {
          try {
            const tempPath = `${FileSystem.cacheDirectory}temp_${Math.random().toString(36).substring(7)}.png`;
            const downloaded = await FileSystem.downloadAsync(uri, tempPath);
            const b64 = await FileSystem.readAsStringAsync(downloaded.uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            return `data:image/png;base64,${b64}`;
          } catch (e) {
            console.warn("Base64 mobile failed for", uri, e);
            return uri;
          }
        }
      };

      // Logo conversion
      try {
        const asset = Asset.fromModule(schoolLogo);
        if (!asset.localUri && !asset.uri) await asset.downloadAsync();
        logoDataUri = await getBase64FromUri(asset.localUri || asset.uri);
      } catch (e) {}

      // Signatures conversion
      if (adminSig) sigDataUri = await getBase64FromUri(adminSig);

      // 🧠 CALCULATE OVERALL POSITION
      let overallPosition = "-";
      try {
        const qAll = query(
          collection(db, "academicRecords"),
          where("classId", "==", classIdState),
          where("academicYear", "==", academicYearState),
          where("term", "==", termState),
          where("reportType", "==", reportType),
          where("status", "==", "approved"),
        );
        const snap = await getDocs(qAll);
        let allStudents: any = {};
        snap.docs.forEach((doc) => {
          const data = doc.data();
          (data.students || []).forEach((s: any) => {
            if (!allStudents[s.studentId]) {
              allStudents[s.studentId] = { name: s.fullName, total: 0 };
            }
            const score =
              parseFloat(s.finalScore) ||
              parseFloat(s.classScore || 0) + parseFloat(s.exam50 || 0);
            allStudents[s.studentId].total += score;
          });
        });
        const ranked = Object.entries(allStudents).sort(
          (a: any, b: any) => b[1].total - a[1].total,
        );
        const index = ranked.findIndex(([id]) => id === studentId);
        if (index !== -1) overallPosition = `${index + 1}/${ranked.length}`;
      } catch (e) {
        console.log("Ranking error:", e);
      }

      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=VERIFY-${studentId}`;
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

        <div class="title">${reportType} Progress Report</div>

        <table class="info-grid">
          <tr>
            <td class="label-cell">Student Name</td><td class="value-cell">${studentName}</td>
            <td class="label-cell">Class/Grade</td><td class="value-cell">${className}</td>
          </tr>
          <tr>
            <td class="label-cell">Academic Year</td><td class="value-cell">${academicYearState}</td>
            <td class="label-cell">Term/Period</td><td class="value-cell">${termState}</td>
          </tr>
          <tr>
            <td class="label-cell">Position</td><td class="value-cell">${overallPosition}</td>
            <td class="label-cell">Generated</td><td class="value-cell">${generatedOn}</td>
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
          <p class="summary-text">TRS: ${TRS} | TAS: ${TAS} | AGGREGATE: ${AGGREGATE}</p>
        </div>

        <div class="remarks-box">
          ${isFullReport ? `<div class="remark-line"><span class="remark-header">BEHAVIORAL:</span> Conduct: <b>${conduct}</b> | Attitude: <b>${attitude}</b> | Interest: <b>${interest}</b></div>` : ""}
          <div class="remark-line"><span class="remark-header">CLASS TEACHER:</span> ${teacherRemarks || "Satisfactory performance."}</div>
          <div class="remark-line"><span class="remark-header">ADMINISTRATIVE:</span> ${adminRemarks || "Keep up the hard work."}</div>
          <div class="remark-line"><span class="remark-header">NEXT TERM BEGINS:</span> <b>${nextTermBegins || "TBA"}</b></div>
          ${promotedTo ? `<div class="remark-line"><span class="remark-header">PROMOTED TO:</span> <b>${promotedTo}</b></div>` : ""}
        </div>

        <div class="footer">
          <div class="sig-section" style="width: 60%; text-align: left;">
            ${sigDataUri ? `<img src="${sigDataUri}" class="sig-image" style="margin-left: 20px;" />` : '<div style="height:45pt;"></div>'}
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
        await Sharing.shareAsync(uri);
      } else {
        await Print.printAsync({ html });
      }
    } catch (err) {
      console.log(err);
      Alert.alert("Error", "PDF generation failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <SVGIcon name="chevron-left" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Academic Record Preview</Text>
        <TouchableOpacity
          onPress={generatePDF}
          style={[styles.downloadHeaderBtn, { backgroundColor: primary }]}
          disabled={generating}
        >
          {generating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <SVGIcon name="download" size={18} color="#fff" />
              <Text style={styles.downloadHeaderText}>PDF</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 15 }}>
        {loading ? (
          <ActivityIndicator size="large" color={primary} style={{ marginTop: 50 }} />
        ) : (
          <Animatable.View animation="fadeInUp" duration={600} style={styles.paper}>
            {/* Letterhead */}
            <View style={styles.paperLetterhead}>
              <Image source={schoolLogo} style={styles.paperLogo} resizeMode="contain" />
              <View style={{ flex: 1 }}>
                <Text style={styles.paperSchoolName}>{SCHOOL_CONFIG.fullName}</Text>
                <Text style={styles.paperReportType}>
                  {reportType.toUpperCase()} PROGRESS REPORT
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
                <Text style={styles.paperInfoValue}>{studentName || "N/A"}</Text>
              </View>
              <View style={styles.paperInfoItem}>
                <Text style={styles.paperInfoLabel}>CLASS:</Text>
                <Text style={styles.paperInfoValue}>{className || classIdState}</Text>
              </View>
              <View style={styles.paperInfoItem}>
                <Text style={styles.paperInfoLabel}>YEAR:</Text>
                <Text style={styles.paperInfoValue}>{academicYearState}</Text>
              </View>
              <View style={styles.paperInfoItem}>
                <Text style={styles.paperInfoLabel}>TERM:</Text>
                <Text style={styles.paperInfoValue}>{termState}</Text>
              </View>
            </View>

            {/* Table */}
            <View style={styles.paperTable}>
              <View style={styles.paperTableHeader}>
                <Text style={[styles.paperHeaderCell, { flex: 2, textAlign: "left" }]}>SUBJECT</Text>
                {isFullReport && (
                  <>
                    <Text style={styles.paperHeaderCell}>CLS</Text>
                    <Text style={styles.paperHeaderCell}>EXM</Text>
                  </>
                )}
                <Text style={styles.paperHeaderCell}>TOT</Text>
                <Text style={styles.paperHeaderCell}>GRD</Text>
                <Text style={[styles.paperHeaderCell, { flex: 1.5 }]}>REMARK</Text>
              </View>
              {subjectsData.length === 0 ? (
                <View style={{ padding: 20, alignItems: "center" }}>
                  <Text style={{ color: "#94A3B8" }}>No records found</Text>
                </View>
              ) : (
                subjectsData.map((s, i) => (
                  <View key={i} style={[styles.paperTableRow, i % 2 !== 0 && { backgroundColor: "#F8FAFC" }]}>
                    <Text style={[styles.paperCell, { flex: 2, textAlign: "left", fontWeight: "800" }]}>
                      {s.subject}
                    </Text>
                    {isFullReport && (
                      <>
                        <Text style={styles.paperCell}>
                          {isNaN(Number(s.classScore)) ? s.classScore : Number(s.classScore).toFixed(0)}
                        </Text>
                        <Text style={styles.paperCell}>
                          {isNaN(Number(s.examsScore)) ? s.examsScore : Number(s.examsScore).toFixed(0)}
                        </Text>
                      </>
                    )}
                    <Text style={[styles.paperCell, { fontWeight: "900", color: primary }]}>
                      {isNaN(Number(s.total)) ? s.total : Number(s.total).toFixed(1)}
                    </Text>
                    <Text style={[styles.paperCell, { fontWeight: "700" }]}>{s.grade}</Text>
                    <Text style={[styles.paperCell, { flex: 1.5, fontSize: 8 }]}>{s.remark}</Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.paperSummaryRow}>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[styles.paperSummaryLabel, { fontSize: 9 }]}>
                  TRS: <Text style={{ color: "#1E293B" }}>{TRS}</Text> | TAS:{" "}
                  <Text style={{ color: "#1E293B" }}>{TAS}</Text>
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 }}>
                  <Text style={styles.paperSummaryLabel}>OVERALL AGGREGATE:</Text>
                  <Text style={styles.paperSummaryValue}>{AGGREGATE}</Text>
                </View>
              </View>
            </View>

            <View style={styles.paperRemarksSection}>
              {isFullReport && (
                <>
                  <Text style={styles.paperSectionTitle}>BEHAVIORAL RATINGS</Text>
                  <Text style={styles.paperRemarkLine}>
                    Conduct: <Text style={{ fontWeight: "700" }}>{conduct}</Text> | Attitude:{" "}
                    <Text style={{ fontWeight: "700" }}>{attitude}</Text> | Interest:{" "}
                    <Text style={{ fontWeight: "700" }}>{interest}</Text>
                  </Text>
                </>
              )}

              <Text style={[styles.paperSectionTitle, { marginTop: 10 }]}>TEACHER'S REMARKS</Text>
              <Text style={styles.paperRemarkText}>{teacherRemarks || "Satisfactory performance."}</Text>

              <Text style={[styles.paperSectionTitle, { marginTop: 10 }]}>ADMIN REMARKS</Text>
              <Text style={styles.paperRemarkText}>{adminRemarks || "Keep up the hard work."}</Text>

              <View style={styles.paperNextTerm}>
                <Text style={styles.paperNextTermLabel}>NEXT TERM BEGINS:</Text>
                <Text style={styles.paperNextTermVal}>{nextTermBegins || "TBA"}</Text>
              </View>

              {promotedTo ? (
                <View style={[styles.paperNextTerm, { marginTop: 5 }]}>
                  <Text style={styles.paperNextTermLabel}>PROMOTED TO:</Text>
                  <Text style={[styles.paperNextTermVal, { color: "#10b981" }]}>
                    {promotedTo}
                  </Text>
                </View>
              ) : null}

              {/* Signature Preview */}
              <View style={styles.paperSigRow}>
                <View style={{ flex: 1 }} />
                <View style={styles.paperSigItem}>
                  {adminSig ? (
                    <Image source={{ uri: adminSig }} style={styles.paperSigImg} />
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
              onPress={generatePDF}
              disabled={generating}
            >
              {generating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <SVGIcon name="download" size={20} color="#fff" />
                  <Text style={styles.downloadBtnText}>Generate Official PDF</Text>
                </>
              )}
            </TouchableOpacity>
          </Animatable.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  navBar: {
    height: 65,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
  },
  backBtn: { padding: 8 },
  navTitle: { fontSize: 16, fontWeight: "800", color: "#1E293B" },
  downloadHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  downloadHeaderText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  paper: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 4,
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  paperLetterhead: { flexDirection: "row", alignItems: "center", marginBottom: 15 },
  paperLogo: { width: 50, height: 50, marginRight: 15 },
  paperSchoolName: { fontSize: 16, fontWeight: "900", color: "#1E293B" },
  paperSchoolInfo: { fontSize: 8, fontWeight: "600", color: "#64748B", marginTop: 2 },
  paperReportType: { fontSize: 10, fontWeight: "800", color: "#64748B", marginTop: 2 },
  paperDivider: { height: 2, backgroundColor: "#1E293B", marginVertical: 10 },
  paperInfoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 15 },
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
  paperTableRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#F1F5F9" },
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
  paperRemarksSection: { borderTopWidth: 1, borderColor: "#E2E8F0", paddingTop: 15, marginBottom: 15 },
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
  paperSigRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 20, gap: 20 },
  paperSigItem: { flex: 1, alignItems: "center" },
  paperSigImg: { width: "100%", height: 40, resizeMode: "contain" },
  paperSigSpace: { height: 40 },
  paperSigLine: { width: "100%", height: 1, backgroundColor: "#1E293B", marginVertical: 4 },
  paperSigLabel: { fontSize: 8, fontWeight: "800", color: "#64748B" },
  downloadBtn: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  downloadBtnText: { color: "#fff", fontWeight: "900", marginLeft: 10, fontSize: 14 },
});
