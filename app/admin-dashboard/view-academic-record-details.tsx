import Constants from "expo-constants";
import * as Print from "expo-print";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  doc,
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
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  StatusBar
} from "react-native";
import * as Animatable from "react-native-animatable";
import { Asset } from "expo-asset";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { getSchoolLogo } from "../../constants/Logos";
import { COLORS, SHADOWS } from "../../constants/theme";
import { db } from "../../firebaseConfig";
import { shareFile } from "../../utils/shareUtils";
import SVGIcon from "../../components/SVGIcon";

type ReportType = "End of Term" | "Mid-Term" | "Mock Exams";

const getGradeInfo = (score: number) => {
  const s = score || 0;
  if (s >= 80) return { aggregate: 1, grade: "A1", remark: "Excellent" };
  if (s >= 75) return { aggregate: 2, grade: "B2", remark: "Very Good" };
  if (s >= 70) return { aggregate: 3, grade: "B3", remark: "Good" };
  if (s >= 65) return { aggregate: 4, grade: "C4", remark: "Credit" };
  if (s >= 60) return { aggregate: 5, grade: "C5", remark: "Credit" };
  if (s >= 55) return { aggregate: 6, grade: "C6", remark: "Credit" };
  if (s >= 50) return { aggregate: 7, grade: "D7", remark: "Pass" };
  if (s >= 40) return { aggregate: 8, grade: "E8", remark: "Pass" };
  return { aggregate: 9, grade: "F9", remark: "Fail" };
};

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
          where("status", "==", "approved")
        );
        
        const scoresSnap = await getDocs(qScores);
        let studentResults: any[] = [];
        let nameFound = "";

        scoresSnap.docs.forEach(d => {
            const data = d.data();
            const studentsList = data.students || [];
            
            const sortedBySubject = [...studentsList].sort((a, b) => {
               const valA = parseFloat(a.finalScore || (parseFloat(a.classScore || 0) + parseFloat(a.exam50 || 0)).toFixed(2));
               const valB = parseFloat(b.finalScore || (parseFloat(b.classScore || 0) + parseFloat(b.exam50 || 0)).toFixed(2));
               return valB - valA;
            });
            const posInSub = sortedBySubject.findIndex(s => s.studentId === studentId) + 1;

            const studentEntry = studentsList.find((s: any) => s.studentId === studentId);
            if (studentEntry) {
                if (!nameFound) nameFound = studentEntry.fullName;
                const scoreValue = parseFloat(studentEntry.finalScore || (parseFloat(studentEntry.classScore || 0) + parseFloat(studentEntry.exam50 || 0)).toFixed(2));
                const gradeObj = getGradeInfo(scoreValue);
                studentResults.push({
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

        setStudentName(nameFound);
        setSubjectsData(studentResults);

        // Fetch Metadata & Signatures
        const classSnap = await getDoc(doc(db, "classes", classIdState));
        if (classSnap.exists()) {
          const classTeacherId = classSnap.data().classTeacherId;
          if (classTeacherId) {
            const teacherSnap = await getDoc(doc(db, "users", classTeacherId));
            if (teacherSnap.exists()) setTeacherSig(teacherSnap.data().profile?.signatureUrl || "");
          }
        }

        // Fetch Head of Institution Signature (Admin with role proprietor/headmaster)
        const qAdmin = query(collection(db, "users"), where("role", "==", "admin"), where("adminRole", "in", ["proprietor", "headmaster", "ceo"]), limit(1));
        const adminSnap = await getDocs(qAdmin);
        if (!adminSnap.empty) {
          setAdminSig(adminSnap.docs[0].data().profile?.signatureUrl || "");
        }

        if (isFullReport) {
            const reportId = `${studentId}_${academicYearState}_${termState}_${reportType.replace(/\s+/g, "")}`.replace(/\//g, "-");
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
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    fetchAllData();
  }, [studentId, termState, classIdState, academicYearState, reportType]);

  const unifiedAggregate = useMemo(() => {
    if (subjectsData.length === 0) return 0;
    const coreList = ["Mathematics", "Science", "English", "Social Studies"];
    const cores = subjectsData.filter(s => coreList.some(c => s.subject.toLowerCase().includes(c.toLowerCase())));
    const electives = subjectsData.filter(s => !coreList.some(c => s.subject.toLowerCase().includes(c.toLowerCase())))
                                .sort((a, b) => a.aggregate - b.aggregate);
    
    const coreSum = cores.reduce((a, c) => a + (c.aggregate || 9), 0);
    const electiveSum = electives.slice(0, 2).reduce((a, c) => a + (c.aggregate || 9), 0);
    
    const missingCoresCount = Math.max(0, 4 - cores.length);
    return coreSum + electiveSum + (missingCoresCount * 9);
  }, [subjectsData]);

  const generatePDF = async () => {
    if (subjectsData.length === 0) return Alert.alert("No Data", "No records found.");
    if (generating) return;

    setGenerating(true);
    
    try {
      const asset = Asset.fromModule(schoolLogo);
      if (!asset.localUri) await asset.downloadAsync();
      const logoUri = asset.localUri || asset.uri;

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
              .footer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; }
              .sig-box { text-align: center; padding-top: 5px; font-size: 11px; font-weight: 800; border-top: 1px solid #000; position: relative; }
              .sig-img { height: 40px; object-fit: contain; margin-bottom: 5px; }
            </style>
          </head>
          <body>
            <div class="letterhead">
              <img src="${logoUri}" class="logo" />
              <div class="school-details">
                <h1>${SCHOOL_CONFIG.fullName}</h1>
                <p>${SCHOOL_CONFIG.address || 'Academic Excellence & Integrity'}</p>
                <p>Contact: ${SCHOOL_CONFIG.hotline || ''} | Email: ${SCHOOL_CONFIG.email || ''}</p>
              </div>
            </div>

            <div class="report-title">${reportType} Progress Report Sheet</div>

            <table class="info-table">
              <tr>
                <td class="label">STUDENT NAME</td><td class="value">${studentName}</td>
                <td class="label">CLASS / GRADE</td><td class="value">${classIdState}</td>
              </tr>
              <tr>
                <td class="label">ACADEMIC YEAR</td><td class="value">${academicYearState}</td>
                <td class="label">TERM / PERIOD</td><td class="value">${termState}</td>
              </tr>
              <tr>
                 <td class="label">OVERALL AGGREGATE</td><td class="value">${unifiedAggregate}</td>
                 ${isFullReport ? `<td class="label">PROMOTED TO</td><td class="value">${promotedTo || 'N/A'}</td>` : `<td></td><td></td>`}
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
              <div class="remark-row"><span class="remark-label">BEHAVIORAL ASSESSMENT:</span> Conduct: <b>${conduct}</b> | Attitude: <b>${attitude}</b> | Interest: <b>${interest}</b></div>
              <div class="remark-row"><span class="remark-label">TEACHER'S REMARKS:</span> ${teacherRemarks || 'A very good performance. Keep it up.'}</div>
              <div class="remark-row"><span class="remark-label">ADMINISTRATIVE REMARKS:</span> ${adminRemarks || 'Satisfactory progress. Hard work is encouraged.'}</div>
              <div class="remark-row"><span class="remark-label">NEXT TERM BEGINS:</span> ${nextTermBegins || 'To be communicated'}</div>
            </div>
            ` : ''}

            <div class="footer-grid">
              <div class="sig-box">
                ${teacherSig ? `<img src="${teacherSig}" class="sig-img" /><br/>` : '<div style="height:40px;"></div>'}
                CLASS TEACHER'S SIGNATURE
              </div>
              <div class="sig-box">
                ${adminSig ? `<img src="${adminSig}" class="sig-img" /><br/>` : '<div style="height:40px;"></div>'}
                HEAD OF INSTITUTION'S SIGNATURE & STAMP
              </div>
            </div>
          </body>
        </html>
      `;
      
      const result = await Print.printToFileAsync({ html });
      if (result && result.uri) {
        await shareFile(result.uri, `Report_${studentName.replace(/\s+/g, "_")}_${termState}.pdf`);
      }
    } catch (error) {
      console.error("PDF generation error:", error);
      Alert.alert("Error", "Failed to generate PDF.");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={primary} /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backIcon}>
          <SVGIcon name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>{reportType} Report Sheet</Text>
        <TouchableOpacity onPress={generatePDF} style={styles.printIcon} disabled={generating}>
          {generating ? <ActivityIndicator size="small" color={primary} /> : <SVGIcon name="print" size={24} color={primary} />}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Animatable.View animation="fadeInUp" duration={600} style={styles.paper}>
          {/* Letterhead */}
          <View style={styles.letterhead}>
            <Image source={schoolLogo} style={styles.logo} resizeMode="contain" />
            <View style={styles.schoolDetails}>
              <Text style={styles.schoolNameText}>{SCHOOL_CONFIG.fullName}</Text>
              <Text style={styles.schoolAddress}>{SCHOOL_CONFIG.address || "Quality Education for All"}</Text>
              <Text style={styles.reportTitleText}>{reportType.toUpperCase()} PROGRESS REPORT</Text>
            </View>
          </View>

          <View style={styles.headerLine} />

          {/* Info Grid */}
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}><Text style={styles.infoLabel}>NAME:</Text><Text style={styles.infoValue}>{studentName}</Text></View>
            <View style={styles.infoItem}><Text style={styles.infoLabel}>CLASS:</Text><Text style={styles.infoValue}>{classIdState}</Text></View>
            <View style={styles.infoItem}><Text style={styles.infoLabel}>YEAR:</Text><Text style={styles.infoValue}>{academicYearState}</Text></View>
            <View style={styles.infoItem}><Text style={styles.infoLabel}>TERM:</Text><Text style={styles.infoValue}>{termState}</Text></View>
          </View>

          {/* Results Table */}
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.subCell, { color: '#fff' }]}>SUBJECT</Text>
              <Text style={[styles.cell, styles.numCell, { color: '#fff' }]}>CLASS</Text>
              <Text style={[styles.cell, styles.numCell, { color: '#fff' }]}>EXAM</Text>
              <Text style={[styles.cell, styles.numCell, { color: '#fff' }]}>TOTAL</Text>
              <Text style={[styles.cell, styles.numCell, { color: '#fff' }]}>GRD</Text>
              <Text style={[styles.cell, styles.remCell, { color: '#fff' }]}>REMARKS</Text>
              <Text style={[styles.cell, styles.posCell, { color: '#fff' }]}>POS</Text>
            </View>
            {subjectsData.map((s, i) => (
              <View key={i} style={[styles.tableRow, i % 2 !== 0 && { backgroundColor: '#F8FAFC' }]}>
                <Text style={[styles.cell, styles.subCell, { fontWeight: '800' }]}>{s.subject}</Text>
                <Text style={[styles.cell, styles.numCell]}>{s.classScore}</Text>
                <Text style={[styles.cell, styles.numCell]}>{s.examsScore}</Text>
                <Text style={[styles.cell, styles.numCell, { fontWeight: '900', color: primary }]}>{s.total}</Text>
                <Text style={[styles.cell, styles.numCell, { fontWeight: '800' }]}>{s.grade}</Text>
                <Text style={[styles.cell, styles.remCell, { fontSize: 9 }]}>{s.remark}</Text>
                <Text style={[styles.cell, styles.posCell]}>{s.pos}</Text>
              </View>
            ))}
          </View>

          {/* Performance Summary */}
          <View style={styles.summarySection}>
             <View style={styles.summaryItem}><Text style={styles.summaryLabel}>OVERALL AGGREGATE:</Text><Text style={styles.summaryVal}>{unifiedAggregate}</Text></View>
             {isFullReport && <View style={styles.summaryItem}><Text style={styles.summaryLabel}>PROMOTED TO:</Text><Text style={styles.summaryVal}>{promotedTo || 'N/A'}</Text></View>}
          </View>

          {/* Assessments & Remarks - Only for End of Term */}
          {isFullReport && (
            <View style={styles.remarksSection}>
              <Text style={styles.sectionHeading}>BEHAVIORAL RATINGS</Text>
              <View style={styles.ratingRow}>
                <Text style={styles.ratingText}>Conduct: <Text style={styles.boldText}>{conduct}</Text></Text>
                <Text style={styles.ratingText}>Attitude: <Text style={styles.boldText}>{attitude}</Text></Text>
                <Text style={styles.ratingText}>Interest: <Text style={styles.boldText}>{interest}</Text></Text>
              </View>

              <Text style={[styles.sectionHeading, { marginTop: 15 }]}>TEACHER'S REMARKS</Text>
              <View style={styles.remarkBox}><Text style={styles.remarkText}>{teacherRemarks || "A satisfactory performance. Maintain the effort."}</Text></View>

              <Text style={[styles.sectionHeading, { marginTop: 15 }]}>ADMINISTRATIVE REMARKS</Text>
              <View style={styles.remarkBox}><Text style={styles.remarkText}>{adminRemarks || "Performance is commendable. Aim for higher marks next term."}</Text></View>

              <View style={styles.nextTermRow}>
                <Text style={styles.nextTermLabel}>NEXT TERM BEGINS:</Text>
                <Text style={styles.nextTermVal}>{nextTermBegins || 'To be communicated'}</Text>
              </View>
            </View>
          )}

          {/* Signatures */}
          <View style={[styles.footer, !isFullReport && { marginTop: 80 }]}>
            <View style={styles.sigContainer}>
               {teacherSig ? (
                 <Image source={{ uri: teacherSig }} style={styles.sigImgUI} resizeMode="contain" />
               ) : <View style={{ height: 40 }} />}
               <View style={styles.sigLine} />
               <Text style={styles.sigLabel}>CLASS TEACHER</Text>
            </View>
            <View style={styles.sigContainer}>
               {adminSig ? (
                 <Image source={{ uri: adminSig }} style={styles.sigImgUI} resizeMode="contain" />
               ) : <View style={{ height: 40 }} />}
               <View style={styles.sigLine} />
               <Text style={styles.sigLabel}>HEAD OF INSTITUTION</Text>
            </View>
          </View>

          <View style={styles.watermark}>
            <SVGIcon name="ribbon" size={120} color="rgba(0,0,0,0.03)" />
          </View>
        </Animatable.View>
        
        <View style={styles.noticeBox}>
          <SVGIcon name="information-circle" size={16} color="#64748B" />
          <Text style={styles.noticeText}>This is a read-only document. Adjustments must be done in the Academic Ledger.</Text>
        </View>

        <TouchableOpacity 
          style={[styles.downloadBtn, { backgroundColor: primary }]} 
          onPress={generatePDF}
          disabled={generating}
        >
          {generating ? <ActivityIndicator color="#fff" /> : (
            <>
              <SVGIcon name="download" size={22} color="#fff" />
              <Text style={styles.downloadBtnText}>Download PDF Report</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#E2E8F0" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  navBar: { height: 60, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, borderBottomWidth: 1, borderColor: '#CBD5E1' },
  navTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
  backIcon: { width: 40 },
  printIcon: { width: 40, alignItems: 'flex-end' },
  scrollContent: { padding: 12, paddingBottom: 40 },
  paper: {
    backgroundColor: '#fff',
    borderRadius: 2,
    padding: 25,
    ...SHADOWS.medium,
    minHeight: 842, // Approx A4 ratio
    borderWidth: 1,
    borderColor: '#94A3B8',
    overflow: 'hidden'
  },
  letterhead: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  logo: { width: 70, height: 70, marginRight: 20 },
  schoolDetails: { flex: 1 },
  schoolNameText: { fontSize: 20, fontWeight: '900', color: '#1E293B', textTransform: 'uppercase' },
  schoolAddress: { fontSize: 11, color: '#64748B', fontWeight: '600', marginTop: 2 },
  reportTitleText: { fontSize: 13, fontWeight: '800', color: '#1E293B', marginTop: 8, letterSpacing: 1 },
  headerLine: { height: 3, backgroundColor: '#1E293B', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#1E293B', borderStyle: 'double' },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20, borderBottomWidth: 1, borderTopWidth: 1, borderColor: '#E2E8F0', paddingVertical: 10 },
  infoItem: { width: '50%', flexDirection: 'row', marginBottom: 5 },
  infoLabel: { fontSize: 10, fontWeight: '900', color: '#64748B', width: 60 },
  infoValue: { fontSize: 11, fontWeight: '700', color: '#1E293B', flex: 1 },
  table: { borderWidth: 1, borderColor: '#000', marginBottom: 20 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#1E293B' },
  tableRow: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#E2E8F0' },
  cell: { padding: 8, fontSize: 10, textAlign: 'center', borderRightWidth: 1, borderColor: '#E2E8F0' },
  subCell: { flex: 3, textAlign: 'left' },
  numCell: { flex: 1 },
  remCell: { flex: 2 },
  posCell: { flex: 0.8, borderRightWidth: 0 },
  summarySection: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F1F5F9', padding: 12, borderRadius: 4, marginBottom: 20 },
  summaryItem: { flexDirection: 'row', alignItems: 'center' },
  summaryLabel: { fontSize: 10, fontWeight: '900', color: '#64748B', marginRight: 8 },
  summaryVal: { fontSize: 15, fontWeight: '900', color: '#1E293B' },
  remarksSection: { marginBottom: 30 },
  sectionHeading: { fontSize: 10, fontWeight: '900', color: '#1E293B', textDecorationLine: 'underline', marginBottom: 8 },
  ratingRow: { flexDirection: 'row', gap: 20, marginBottom: 15 },
  ratingText: { fontSize: 11, color: '#475569' },
  boldText: { fontWeight: '800', color: '#1E293B' },
  remarkBox: { padding: 10, backgroundColor: '#F8FAFC', borderRadius: 4, borderWidth: 1, borderColor: '#E2E8F0', minHeight: 45 },
  remarkText: { fontSize: 11, color: '#475569', fontStyle: 'italic' },
  nextTermRow: { flexDirection: 'row', marginTop: 20, alignItems: 'center' },
  nextTermLabel: { fontSize: 11, fontWeight: '900', color: '#1E293B', marginRight: 10 },
  nextTermVal: { fontSize: 11, fontWeight: '800', color: SCHOOL_CONFIG.primaryColor || (COLORS as any)?.primary || "#2e86de" },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 40 },
  sigContainer: { width: '45%', alignItems: 'center' },
  sigLine: { width: '100%', height: 1, backgroundColor: '#000', marginBottom: 8 },
  sigLabel: { fontSize: 9, fontWeight: '900', color: '#64748B' },
  sigImgUI: { width: '80%', height: 40, marginBottom: 5 },
  watermark: { position: 'absolute', top: '40%', left: '20%', zIndex: -1 },
  noticeBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 15, paddingHorizontal: 5 },
  noticeText: { fontSize: 11, color: '#64748B', flex: 1 },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 25,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
    ...SHADOWS.small
  },
  downloadBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800'
  },
});
