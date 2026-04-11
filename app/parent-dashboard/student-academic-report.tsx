import { Picker } from "@react-native-picker/picker";
import Constants from "expo-constants";
import * as Print from "expo-print";
import {
    collection,
    doc,
    documentId,
    getDoc,
    getDocs,
    query,
    where,
    limit,
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    SafeAreaView,
    StatusBar,
    Platform
} from "react-native";
import * as Animatable from "react-native-animatable";
import { Asset } from "expo-asset";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { getSchoolLogo } from "../../constants/Logos";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebaseConfig";
import { shareFile } from "../../utils/shareUtils";
import { Ionicons } from "@expo/vector-icons";
import { getGradeDetails } from "../../lib/classHelpers";
import { getDocsCacheFirst } from "../../lib/firestoreHelpers";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";

const TERMS = ["Term 1", "Term 2", "Term 3"];
type ReportType = "End of Term" | "Mid-Term" | "Mock Exams";


export default function StudentAcademicReport() {
  const { appUser } = useAuth();
  const { acadConfig } = useAcademicConfig();

  const [children, setChildren] = useState<any[]>([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("Term 1");
  const [selectedReportType, setSelectedReportType] = useState<ReportType>("End of Term");

  const primary = SCHOOL_CONFIG.primaryColor;
  const schoolId = (Constants.expoConfig?.extra?.schoolId || "afahjoy").toLowerCase();
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
          const q = query(collection(db, "users"), where(documentId(), "in", ids));
          const snap = await getDocsCacheFirst(q);
          const list = snap.docs.map((d) => ({
            id: d.id,
            name: `${d.data().profile?.firstName || ""} ${d.data().profile?.lastName || ""}`.trim(),
            classId: d.data().profile?.classId || ""
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
      const child = children.find(c => c.id === selectedChildId);
      const classId = child?.classId;

      const qScores = query(
        collection(db, "academicRecords"), 
        where("classId", "==", classId), 
        where("academicYear", "==", selectedYear),
        where("term", "==", selectedTerm), 
        where("reportType", "==", selectedReportType),
        where("status", "==", "approved")
      );
      
      const scoresSnap = await getDocsCacheFirst(qScores);
      let results: any[] = [];

      scoresSnap.docs.forEach(d => {
          const data = d.data();
          const studentsList = data.students || [];
          
          const sortedBySubject = [...studentsList].sort((a, b) => {
             const valA = parseFloat(a.finalScore || (parseFloat(a.classScore || 0) + parseFloat(a.exam50 || 0)).toFixed(2));
             const valB = parseFloat(b.finalScore || (parseFloat(b.classScore || 0) + parseFloat(b.exam50 || 0)).toFixed(2));
             return valB - valA;
          });
          const posInSub = sortedBySubject.findIndex(s => s.studentId === selectedChildId) + 1;

          const studentEntry = studentsList.find((s: any) => s.studentId === selectedChildId);
          if (studentEntry) {
              const scoreValue = parseFloat(studentEntry.finalScore || (parseFloat(studentEntry.classScore || 0) + parseFloat(studentEntry.exam50 || 0)).toFixed(2));
              const gradeObj = getGradeDetails(scoreValue);
              results.push({
                  subject: data.subject,
                  classScore: studentEntry.classScore || "-",
                  examsScore: studentEntry.exam50 || studentEntry.examsMark || 0,
                  total: scoreValue,
                  grade: gradeObj.grade,
                  aggregate: gradeObj.aggregate,
                  remark: gradeObj.remark,
                  pos: posInSub
              });
          }
      });

      if (results.length === 0) {
        Alert.alert("Not Ready", "No approved academic records found for this period.");
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
          if (teacherSnap.exists()) setTeacherSig(teacherSnap.data().profile?.signatureUrl || "");
        }
      }

      const qAdmin = query(collection(db, "users"), where("role", "==", "admin"), where("adminRole", "in", ["proprietor", "headmaster", "ceo"]), limit(1));
      const adminSnap = await getDocsCacheFirst(qAdmin);
      if (!adminSnap.empty) {
        setAdminSig(adminSnap.docs[0].data().profile?.signatureUrl || "");
      }

      const reportId = `${selectedChildId}_${selectedYear}_${selectedTerm}_${selectedReportType.replace(/\s+/g, "")}`.replace(/\//g, "-");
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
      .filter((s) =>
        !coreList.some((c) => s.subject.toLowerCase() === c.toLowerCase()),
      )
      .sort((a, b) => (parseInt(a.grade) || 9) - (parseInt(b.grade) || 9));

    const coreSum = cores.reduce((a, c) => a + (parseInt(c.grade) || 9), 0);
    const electiveSum = others
      .slice(0, 3)
      .reduce((a, c) => a + (parseInt(c.grade) || 9), 0);

    const missingCoresCount = Math.max(0, 3 - cores.length);
    const missingElectivesCount = Math.max(0, 3 - others.length);

    return coreSum + electiveSum + (missingCoresCount + missingElectivesCount) * 9;
  }, [subjectsData]);

  const downloadPDF = async () => {
    if (subjectsData.length === 0) return;
    const isFullReport = selectedReportType === "End of Term";
    
    try {
      const logoAsset = Asset.fromModule(schoolLogo);
      if (!logoAsset.localUri) {
        await logoAsset.downloadAsync();
      }
      const logoUri = logoAsset.localUri || logoAsset.uri;

      const html = `
        <html>
          <head>
            <style>
              body { font-family: 'Helvetica', sans-serif; padding: 20px; color: #1e293b; line-height: 1.4; }
              .letterhead { text-align: center; border-bottom: 3px double #1e293b; padding-bottom: 15px; margin-bottom: 20px; display: flex; align-items: center; justify-content: center; gap: 20px; }
              .logo { width: 80px; height: 80px; }
              .school-details h1 { font-size: 24px; margin: 0; color: #1e293b; text-transform: uppercase; }
              .school-details p { margin: 2px 0; font-size: 12px; font-weight: 600; color: #64748b; }
              .report-title { text-align: center; font-size: 16px; font-weight: 900; margin: 15px 0; text-decoration: underline; text-transform: uppercase; }
              .info-table { width: 100%; margin-bottom: 20px; border-collapse: collapse; }
              .info-table td { padding: 5px; font-size: 12px; border: 1px solid #e2e8f0; }
              .label { font-weight: 800; background: #f8fafc; width: 25%; }
              .value { width: 25%; font-weight: 600; }
              table.results { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
              table.results th { background: #1e293b; color: #fff; padding: 10px 5px; font-size: 10px; text-transform: uppercase; border: 1px solid #000; }
              table.results td { border: 1px solid #000; padding: 8px 5px; text-align: center; font-size: 11px; font-weight: 600; }
              .subject-cell { text-align: left !important; font-weight: 800; padding-left: 10px !important; }
              .remarks-section { margin-top: 20px; }
              .remark-row { margin-bottom: 10px; font-size: 12px; }
              .remark-label { font-weight: 800; text-decoration: underline; margin-right: 10px; }
              .footer-grid { display: flex; justify-content: center; margin-top: 40px; }
              .sig-box { text-align: center; padding-top: 5px; font-size: 11px; font-weight: 800; border-top: 1px solid #000; position: relative; width: 60%; }
              .sig-img { height: 45px; object-fit: contain; margin-bottom: 5px; }
              .verification-footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; }
              .verify-text { font-size: 8px; color: #64748b; line-height: 1.2; }
              .qr-code { width: 60px; height: 60px; }
            </style>
          </head>
          <body>
            <div style="width: 210mm; min-height: 297mm; padding: 20mm; margin: auto; background: white; box-sizing: border-box; position: relative;">
            <div class="letterhead">
              <img src="${logoUri}" class="logo" />
              <div class="school-details">
                <h1>${SCHOOL_CONFIG.fullName}</h1>
                <p>${SCHOOL_CONFIG.address || 'Academic Excellence & Integrity'}</p>
                <p>Contact: ${SCHOOL_CONFIG.hotline || ''} | Email: ${SCHOOL_CONFIG.email || ''}</p>
              </div>
            </div>

            <div class="report-title">${selectedReportType} Progress Report Sheet</div>

            <table class="info-table">
              <tr>
                <td class="label">STUDENT NAME</td><td class="value">${report?.studentName || children.find(c=>c.id===selectedChildId)?.name}</td>
                <td class="label">CLASS / GRADE</td><td class="value">${report?.classId || ''}</td>
              </tr>
              <tr>
                <td class="label">ACADEMIC YEAR</td><td class="value">${selectedYear}</td>
                <td class="label">TERM / PERIOD</td><td class="value">${selectedTerm}</td>
              </tr>
              <tr>
                 <td class="label">OVERALL AGGREGATE</td><td class="value">${unifiedAggregate}</td>
                 ${isFullReport ? `<td class="label">PROMOTED TO</td><td class="value">${report?.promotedTo || 'N/A'}</td>` : `<td></td><td></td>`}
              </tr>
            </table>

            <table class="results">
              <thead>
                <tr>
                  <th style="width: 30%;">Subject</th>
                  <th>Class Score</th>
                  <th>Exams Score</th>
                  <th>Total</th>
                  <th>Grade</th>
                  <th>Grade Remarks</th>
                  <th>Pos</th>
                </tr>
              </thead>
              <tbody>
                ${subjectsData.map(s => `
                  <tr>
                    <td class="subject-cell">${s.subject}</td>
                    <td>${s.classScore}</td>
                    <td>${s.examsScore}</td>
                    <td style="font-weight: 900;">${s.total}</td>
                    <td>${s.grade}</td>
                    <td style="font-size: 9px;">${s.remark}</td>
                    <td>${s.pos}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            ${isFullReport ? `
            <div class="remarks-section">
              <div class="remark-row"><span class="remark-label">BEHAVIORAL ASSESSMENT:</span> Conduct: <b>${report?.assessment?.conduct || 'N/A'}</b> | Attitude: <b>${report?.assessment?.attitude || 'N/A'}</b> | Interest: <b>${report?.assessment?.interest || 'N/A'}</b></div>
              <div class="remark-row"><span class="remark-label">TEACHER'S REMARKS:</span> ${report?.teacherRemarks || 'Satisfactory.'}</div>
              <div class="remark-row"><span class="remark-label">ADMINISTRATIVE REMARKS:</span> ${report?.adminRemarks || 'Commendable.'}</div>
              <div class="remark-row"><span class="remark-label">NEXT TERM BEGINS:</span> ${report?.nextTermBegins || 'TBA'}</div>
            </div>
            ` : ''}

            <div class="footer-grid">
              <div class="sig-box">
                ${adminSig ? `<img src="${adminSig}" class="sig-img" /><br/>` : '<div style="height:45px;"></div>'}
                HEAD OF INSTITUTION'S SIGNATURE & STAMP
              </div>
            </div>

            <div class="verification-footer">
              <div class="verify-text">
                <b>DIGITALLY VERIFIED DOCUMENT</b><br/>
                Student ID: ${selectedChildId}<br/>
                Ref: ${selectedYear.replace("/", "")}-${selectedTerm.replace(" ", "")}-${selectedReportType.substring(0, 1)}<br/>
                Generated on: ${new Date().toLocaleDateString()}
              </div>
              <img class="qr-code" src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=VERIFY-${selectedChildId}-${selectedYear}-${selectedTerm}" />
            </div>
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      await shareFile(uri, `${selectedReportType.replace(/\s+/g, "_")}_Report.pdf`);
    } catch (e) {
      console.error("PDF generation error:", e);
      Alert.alert("Error", "Could not generate PDF.");
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={primary} /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 50 }}>
        <View style={styles.header}>
            <Text style={styles.headerTitle}>Academic Reports</Text>
            <Text style={styles.headerSubtitle}>View and download terminal progress sheets</Text>
        </View>

        <View style={styles.selectorCard}>
          <Text style={styles.label}>Select Student</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {children.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.chip, selectedChildId === c.id && { backgroundColor: primary, borderColor: primary }]}
                onPress={() => setSelectedChildId(c.id)}
              >
                <Text style={[styles.chipText, selectedChildId === c.id && { color: "#fff" }]}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Report Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {["End of Term", "Mid-Term", "Mock Exams"].map((type) => (
                  <TouchableOpacity 
                      key={type}
                      style={[styles.chip, selectedReportType === type && { backgroundColor: primary, borderColor: primary }]}
                      onPress={() => setSelectedReportType(type as ReportType)}
                  >
                      <Text style={[styles.chipText, selectedReportType === type && { color: '#fff' }]}>{type}</Text>
                  </TouchableOpacity>
              ))}
          </ScrollView>

          <View style={styles.pickerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Year</Text>
              <View style={styles.pickerBox}>
                  <Picker selectedValue={selectedYear} onValueChange={setSelectedYear} style={styles.picker}>
                      {academicYears.map(y => <Picker.Item key={y} label={y} value={y} />)}
                  </Picker>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Term</Text>
              <View style={styles.pickerBox}>
                  <Picker selectedValue={selectedTerm} onValueChange={setSelectedTerm} style={styles.picker}>
                      {TERMS.map(t => <Picker.Item key={t} label={t} value={t} />)}
                  </Picker>
              </View>
            </View>
          </View>

          <TouchableOpacity style={[styles.viewBtn, { backgroundColor: primary }]} onPress={loadReport} disabled={fetchingReport}>
            {fetchingReport ? <ActivityIndicator color="#fff" /> : <Text style={styles.viewBtnText}>Generate Report Card</Text>}
          </TouchableOpacity>
        </View>

        {subjectsData.length > 0 && (
          <Animatable.View animation="fadeInUp" duration={600} style={styles.paper}>
            {/* Letterhead */}
            <View style={styles.paperLetterhead}>
              <Image source={schoolLogo} style={styles.paperLogo} resizeMode="contain" />
              <View style={{ flex: 1 }}>
                <Text style={styles.paperSchoolName}>{SCHOOL_CONFIG.fullName}</Text>
                <Text style={styles.paperReportType}>{selectedReportType.toUpperCase()} PROGRESS REPORT</Text>
              </View>
            </View>

            <View style={styles.paperDivider} />

            <View style={styles.paperInfoGrid}>
                <View style={styles.paperInfoItem}><Text style={styles.paperInfoLabel}>STUDENT:</Text><Text style={styles.paperInfoValue}>{report?.studentName || children.find(c=>c.id===selectedChildId)?.name}</Text></View>
                <View style={styles.paperInfoItem}><Text style={styles.paperInfoLabel}>CLASS:</Text><Text style={styles.paperInfoValue}>{report?.classId || 'N/A'}</Text></View>
                <View style={styles.paperInfoItem}><Text style={styles.paperInfoLabel}>YEAR:</Text><Text style={styles.paperInfoValue}>{selectedYear}</Text></View>
                <View style={styles.paperInfoItem}><Text style={styles.paperInfoLabel}>TERM:</Text><Text style={styles.paperInfoValue}>{selectedTerm}</Text></View>
            </View>

            {/* Table */}
            <View style={styles.paperTable}>
              <View style={styles.paperTableHeader}>
                <Text style={[styles.paperCell, { flex: 3, textAlign: 'left' }]}>SUBJECT</Text>
                <Text style={styles.paperCell}>SCORE</Text>
                <Text style={styles.paperCell}>GRD</Text>
                <Text style={styles.paperCell}>POS</Text>
              </View>
              {subjectsData.map((s, i) => (
                <View key={i} style={[styles.paperTableRow, i % 2 !== 0 && { backgroundColor: '#F8FAFC' }]}>
                  <Text style={[styles.paperCell, { flex: 3, textAlign: 'left', fontWeight: '800' }]}>{s.subject}</Text>
                  <Text style={[styles.paperCell, { fontWeight: '900', color: primary }]}>{s.total}</Text>
                  <Text style={[styles.paperCell, { fontWeight: '700' }]}>{s.grade}</Text>
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
                    <Text style={styles.paperRemarkLine}>Conduct: <Text style={{fontWeight:'700'}}>{report.assessment.conduct}</Text> | Attitude: <Text style={{fontWeight:'700'}}>{report.assessment.attitude}</Text></Text>
                    
                    <Text style={[styles.paperSectionTitle, {marginTop:10}]}>ADMIN REMARKS</Text>
                    <Text style={styles.paperRemarkText}>{report.adminRemarks || "Satisfactory."}</Text>

                    <View style={styles.paperNextTerm}>
                        <Text style={styles.paperNextTermLabel}>NEXT TERM BEGINS:</Text>
                        <Text style={styles.paperNextTermVal}>{report.nextTermBegins || 'TBA'}</Text>
                    </View>
                </View>
            )}

            <TouchableOpacity style={[styles.downloadBtn, { backgroundColor: primary }]} onPress={downloadPDF}>
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
  header: { padding: 25, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#E2E8F0' },
  headerTitle: { fontSize: 24, fontWeight: "900", color: "#1E293B" },
  headerSubtitle: { fontSize: 13, color: "#64748B", marginTop: 4, fontWeight: '600' },
  selectorCard: { backgroundColor: "#fff", padding: 20, margin: 15, borderRadius: 24, ...SHADOWS.small },
  label: { fontSize: 10, fontWeight: "900", color: "#94A3B8", marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  chipRow: { paddingBottom: 15, gap: 10 },
  chip: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 15, backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#E2E8F0" },
  chipText: { fontSize: 12, color: "#475569", fontWeight: "700" },
  pickerRow: { flexDirection: "row", gap: 15 },
  pickerBox: { backgroundColor: '#F1F5F9', borderRadius: 12, height: 50, justifyContent: 'center' },
  picker: { height: 50 },
  viewBtn: { padding: 18, borderRadius: 18, alignItems: "center", marginTop: 25, ...SHADOWS.small },
  viewBtnText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  paper: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 20,
    borderRadius: 4,
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: '#CBD5E1'
  },
  paperLetterhead: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  paperLogo: { width: 50, height: 50, marginRight: 15 },
  paperSchoolName: { fontSize: 16, fontWeight: '900', color: '#1E293B' },
  paperReportType: { fontSize: 10, fontWeight: '800', color: '#64748B', marginTop: 2 },
  paperDivider: { height: 2, backgroundColor: '#1E293B', marginVertical: 10 },
  paperInfoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 15 },
  paperInfoItem: { width: '47%', marginBottom: 5 },
  paperInfoLabel: { fontSize: 8, fontWeight: '900', color: '#94A3B8' },
  paperInfoValue: { fontSize: 11, fontWeight: '700', color: '#1E293B' },
  paperTable: { borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 15 },
  paperTableHeader: { flexDirection: 'row', backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderColor: '#E2E8F0' },
  paperTableRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#F1F5F9' },
  paperCell: { flex: 1, padding: 8, fontSize: 10, textAlign: 'center' },
  paperSummaryRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginBottom: 15 },
  paperSummaryLabel: { fontSize: 10, fontWeight: '900', color: '#64748B' },
  paperSummaryValue: { fontSize: 18, fontWeight: '900', color: '#ef4444' },
  paperRemarksSection: { borderTopWidth: 1, borderColor: '#E2E8F0', paddingTop: 15, marginBottom: 15 },
  paperSectionTitle: { fontSize: 9, fontWeight: '900', color: '#1E293B', textDecorationLine: 'underline', marginBottom: 5 },
  paperRemarkLine: { fontSize: 11, color: '#475569' },
  paperRemarkText: { fontSize: 11, color: '#475569', fontStyle: 'italic' },
  paperNextTerm: { flexDirection: 'row', marginTop: 10, gap: 5 },
  paperNextTermLabel: { fontSize: 10, fontWeight: '900' },
  paperNextTermVal: { fontSize: 10, fontWeight: '700', color: COLORS.primary },
  downloadBtn: { flexDirection: "row", padding: 16, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 10 },
  downloadBtnText: { color: "#fff", fontWeight: "900", marginLeft: 10, fontSize: 14 },
});
