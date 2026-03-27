import AsyncStorage from "@react-native-async-storage/async-storage";
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
    collection,
    doc,
    getDoc,
    getDocsFromServer,
    query,
    serverTimestamp,
    updateDoc,
    where,
    deleteDoc,
} from "firebase/firestore";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebaseConfig";
import { sortClasses, calculateGrade } from "../../lib/classHelpers";
import { getDocsCacheFirst } from "../../lib/firestoreHelpers";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";

type ReportType = "End of Term" | "Mid-Term" | "Mock Exams";

interface SubjectInfo {
  name: string;
  status: string;
  reportType: ReportType;
  hasBehavioral?: boolean;
}

const StudentScoreCard = React.memo(
  ({
    item,
    onUpdate,
    primary,
    reportType,
  }: {
    item: any;
    onUpdate: (id: string, field: string, value: string) => void;
    primary: string;
    reportType: ReportType;
  }) => (
    <Animatable.View animation="fadeInUp" duration={500} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.avatarBox, { backgroundColor: primary + "15" }]}>
          <Text style={[styles.avatarText, { color: primary }]}>{item.fullName?.charAt(0) || "S"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.studentName}>{item.fullName}</Text>
          <Text style={styles.studentIdLabel}>ID: {item.studentId}</Text>
        </View>
      </View>
      
      {reportType === "End of Term" ? (
        <View style={styles.scoreGrid}>
          <View style={styles.gridSection}>
            <Text style={styles.sectionLabel}>CONTINUOUS ASSESSMENT (60%)</Text>
            <View style={styles.gridRow}>
              <View style={styles.inputCol}>
                <Text style={styles.miniHeader}>CAT A</Text>
                <TextInput
                  style={styles.gridInput}
                  keyboardType="numeric"
                  value={String(item.catA || "")}
                  onChangeText={(v) => onUpdate(item.studentId, "catA", v)}
                />
              </View>
              <View style={styles.inputCol}>
                <Text style={styles.miniHeader}>CAT B</Text>
                <TextInput
                  style={styles.gridInput}
                  keyboardType="numeric"
                  value={String(item.catB || "")}
                  onChangeText={(v) => onUpdate(item.studentId, "catB", v)}
                />
              </View>
              <View style={styles.inputCol}>
                <Text style={styles.miniHeader}>GRP</Text>
                <TextInput
                  style={styles.gridInput}
                  keyboardType="numeric"
                  value={String(item.groupWork || "")}
                  onChangeText={(v) => onUpdate(item.studentId, "groupWork", v)}
                />
              </View>
              <View style={styles.inputCol}>
                <Text style={styles.miniHeader}>PRJ</Text>
                <TextInput
                  style={styles.gridInput}
                  keyboardType="numeric"
                  value={String(item.projectWork || "")}
                  onChangeText={(v) => onUpdate(item.studentId, "projectWork", v)}
                />
              </View>
              <View style={styles.valueCol}>
                <Text style={styles.miniHeader}>50% WT</Text>
                <View style={[styles.gridValueBox, { backgroundColor: primary + "10" }]}>
                   <Text style={[styles.gridValueText, { color: primary }]}>{item.classScore}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.gridDivider} />

          <View style={styles.gridSection}>
            <Text style={styles.sectionLabel}>FINAL EXAMS & GRADING</Text>
            <View style={styles.gridRow}>
              <View style={[styles.inputCol, { flex: 1.5 }]}>
                <Text style={styles.miniHeader}>EXAMS (100)</Text>
                <TextInput
                  style={[styles.gridInput, { height: 44 }]}
                  keyboardType="numeric"
                  value={String(item.examsMark || "")}
                  onChangeText={(v) => onUpdate(item.studentId, "examsMark", v)}
                />
              </View>
              <View style={styles.valueCol}>
                <Text style={styles.miniHeader}>50% WT</Text>
                <View style={[styles.gridValueBox, { backgroundColor: "#ecfdf5" }]}>
                   <Text style={[styles.gridValueText, { color: "#059669" }]}>{item.exam50}</Text>
                </View>
              </View>
              <View style={styles.valueCol}>
                <Text style={styles.miniHeader}>TOTAL</Text>
                <View style={[styles.gridValueBox, { backgroundColor: "#fffbeb" }]}>
                   <Text style={[styles.gridValueText, { color: "#d97706" }]}>{item.finalScore}</Text>
                </View>
              </View>
              <View style={styles.valueCol}>
                <Text style={styles.miniHeader}>GRADE</Text>
                <View style={[styles.gridValueBox, { backgroundColor: "#f0f9ff" }]}>
                   <Text style={[styles.gridValueText, { color: "#0284c7" }]}>{item.grade}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.scoreGrid}>
           <Text style={styles.sectionLabel}>RAW SCORE ASSESSMENT</Text>
           <View style={styles.gridRow}>
              <View style={{ flex: 2 }}>
                <Text style={styles.miniHeader}>EXAMINATION SCORE (100)</Text>
                <TextInput
                  style={[styles.gridInput, { height: 48, fontSize: 18, textAlign: "left", paddingHorizontal: 15 }]}
                  keyboardType="numeric"
                  value={String(item.examsMark || "")}
                  onChangeText={(v) => onUpdate(item.studentId, "examsMark", v)}
                  placeholder="0.00"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 15 }}>
                <Text style={styles.miniHeader}>GRADE</Text>
                <View style={[styles.gridValueBox, { height: 48, backgroundColor: "#f0f9ff" }]}>
                   <Text style={[styles.gridValueText, { color: "#0284c7", fontSize: 20 }]}>{item.grade}</Text>
                </View>
              </View>
           </View>
        </View>
      )}

      {item.teacherRemarks ? (
        <View style={[styles.remarksBox, { borderLeftColor: primary }]}>
          <Text style={styles.remarksLabel}>TEACHER&apos;S REMARKS</Text>
          <Text style={styles.remarksText}>{item.teacherRemarks}</Text>
        </View>
      ) : null}
    </Animatable.View>
  ),
);

StudentScoreCard.displayName = "StudentScoreCard";

export default function EditStudentScores() {
  const router = useRouter();
  const { appUser } = useAuth();
  const acadConfig = useAcademicConfig();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [listLoading, setListLoading] = useState(false);

  const primary = SCHOOL_CONFIG.primaryColor;
  const secondary = SCHOOL_CONFIG.secondaryColor;

  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);

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
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [subjects, setSubjects] = useState<SubjectInfo[]>([]);
  const [term, setTerm] = useState<string>("");
  const [selectedReportType, setSelectedReportType] = useState<ReportType>("End of Term");

  const [recordId, setRecordId] = useState<string | null>(null);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [visibleStudents, setVisibleStudents] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const allStudentsRef = useRef<any[]>([]);

  // Sync with global academic config
  useEffect(() => {
    if (!acadConfig.loading) {
      setSelectedYear(acadConfig.academicYear);
      setTerm(acadConfig.currentTerm);
    }
  }, [acadConfig]);

  const loadClasses = async () => {
    try {
      const snap = await getDocsCacheFirst(collection(db, "classes") as any);
      const list = snap.docs.map((d) => ({ id: d.id, name: d.data().name || d.id }));
      const sorted = sortClasses(list);
      setClasses(sorted);
      return sorted;
    } catch (err) {
      console.error("Error loading classes:", err);
      return [];
    }
  };

  useEffect(() => {
    if (!appUser) return;
    const init = async () => {
      try {
        const list = await loadClasses();
        if (list.length > 0) setSelectedClassId(list[0].id);
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    init();
  }, [appUser]);

  const fetchSubjects = useCallback(async () => {
    if (!selectedClassId || !selectedYear || !term) return;
    try {
      const q = query(
        collection(db, "academicRecords"),
        where("classId", "==", selectedClassId),
        where("academicYear", "==", selectedYear),
        where("term", "==", term),
        where("reportType", "==", selectedReportType)
      );
      const snap = await getDocsFromServer(q);
      const subsList: SubjectInfo[] = snap.docs.map((d) => ({
        name: d.data().subject,
        status: d.data().status || "pending",
        reportType: d.data().reportType || "End of Term",
        hasBehavioral: d.data().containsBehavioralData,
      })).sort((a, b) => a.name.localeCompare(b.name));
      setSubjects(subsList);
      if (subsList.length > 0) {
        if (!selectedSubject || !subsList.find((s) => s.name === selectedSubject)) {
          setSelectedSubject(subsList[0].name);
        }
      } else {
        setSelectedSubject("");
      }
    } catch (err) { 
      console.error("fetchSubjects Error:", err); 
    }
  }, [selectedClassId, selectedYear, term, selectedReportType, selectedSubject]);

  useEffect(() => {
    if (selectedClassId && selectedYear && term) {
      fetchSubjects();
    }
  }, [selectedClassId, selectedYear, term, selectedReportType, fetchSubjects]);

  const loadSubmission = async () => {
    if (!selectedClassId || !selectedSubject || !selectedYear || !term) return Alert.alert("Selection Required", "Please select Year, Class and Subject.");
    setListLoading(true);
    try {
      const yearSlug = selectedYear.replace(/\//g, "-");
      const reportSlug = selectedReportType.replace(/\s+/g, "");
      const docId = `${selectedClassId}_${selectedSubject.replace(/\s+/g, "")}_${yearSlug}_${term.replace(/\s+/g, "")}_${reportSlug}`;
      const snap = await getDoc(doc(db, "academicRecords", docId));
      if (snap.exists()) {
        setRecordId(snap.id);
        const students = snap.data().students || [];
        setAllStudents(students);
        setVisibleStudents(students.slice(0, PAGE_SIZE));
        setPage(1);
      } else {
        Alert.alert("No Records", `No submissions found for ${selectedSubject} in the selected period.`);
        setRecordId(null); setAllStudents([]); setVisibleStudents([]);
      }
    } catch (err) { console.error(err); Alert.alert("Error", "Failed to load records."); } finally { setListLoading(false); }
  };

  const reportTypeToSlug = (type: string) => type.replace(/\s+/g, "");

  useEffect(() => { allStudentsRef.current = allStudents; }, [allStudents]);

  const loadMoreStudents = useCallback(() => {
    setVisibleStudents((prev) => {
      if (prev.length >= allStudentsRef.current.length) return prev;
      const nextPage = Math.floor(prev.length / PAGE_SIZE) + 1;
      setPage(nextPage);
      return allStudentsRef.current.slice(0, nextPage * PAGE_SIZE);
    });
  }, []);

  const updateStudentScore = useCallback((studentId: string, field: string, value: string) => {
    setAllStudents((prev) => prev.map((s) => {
      if (s.studentId === studentId) {
        const updated = { ...s, [field]: value };
        if (selectedReportType === "End of Term") {
          const catA = parseFloat(updated.catA) || 0;
          const catB = parseFloat(updated.catB) || 0;
          const gWork = parseFloat(updated.groupWork) || 0;
          const pWork = parseFloat(updated.projectWork) || 0;
          updated.total60 = catA + catB + gWork + pWork;
          updated.classScore = (updated.total60 * (50 / 60)).toFixed(2);
          const examsMark = parseFloat(updated.examsMark) || 0;
          updated.exam50 = (examsMark * 0.5).toFixed(2);
          updated.finalScore = (parseFloat(updated.classScore) + parseFloat(updated.exam50)).toFixed(2);
          updated.grade = calculateGrade(parseFloat(updated.finalScore));
        } else {
          const examsMark = parseFloat(updated.examsMark) || 0;
          updated.grade = calculateGrade(examsMark);
        }
        return updated;
      }
      return s;
    }));
  }, [selectedReportType]);

  useEffect(() => { setVisibleStudents(allStudents.slice(0, page * PAGE_SIZE)); }, [allStudents, page]);

  const approveAndSave = async () => {
    if (!recordId || allStudents.length === 0) return;
    if (selectedReportType === "End of Term") {
      const invalid = allStudents.find((s) => s.total60 > 60);
      if (invalid) return Alert.alert("Error", `${invalid.fullName}'s Total exceeds 60.`);
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, "academicRecords", recordId), {
        students: allStudents,
        status: "approved",
        approvedAt: serverTimestamp(),
        approvedBy: appUser?.uid,
      });
      Alert.alert("Approved", "Scores updated and records marked as approved.");
      fetchSubjects();
    } catch (err) { console.error(err); Alert.alert("Error", "Update failed."); } finally { setSaving(false); }
  };

  const handleDeleteRecord = async () => {
    if (!recordId) return;
    Alert.alert("Delete Records?", "This will permanently delete this subject's scores for this class.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete Permanently", style: "destructive", onPress: async () => {
          setDeleting(true);
          try {
            await deleteDoc(doc(db, "academicRecords", recordId));
            setRecordId(null); setAllStudents([]); setVisibleStudents([]);
            Alert.alert("Deleted", "The records have been removed successfully.");
            fetchSubjects();
          } catch (err) { Alert.alert("Error", "Could not delete records."); } finally { setDeleting(false); }
        }
      }
    ]);
  };

  const handleRefresh = async () => {
    setLoading(true);
    await loadClasses();
    await fetchSubjects();
    setLoading(false);
  };

  if (loading || acadConfig.loading) return <View style={styles.center}><ActivityIndicator size="large" color={primary}/></View>;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[primary, secondary]} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><SVGIcon name="arrow-back" color="#fff" size={24}/></TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>{SCHOOL_CONFIG.fullName}</Text>
            <Text style={styles.headerSub}>Admin Score Editor</Text>
          </View>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshBtn}><SVGIcon name="refresh" color="#fff" size={22}/></TouchableOpacity>
        </View>
      </LinearGradient>

      <FlatList
        data={visibleStudents}
        keyExtractor={(item) => item.studentId}
        onEndReached={loadMoreStudents}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Animatable.View animation="fadeInDown" style={styles.filterSection}>
            <View style={styles.filterRow}>
              <View style={styles.pickerBox}>
                <Text style={styles.miniLabel}>ACADEMIC YEAR {selectedYear === acadConfig.academicYear ? "(CURRENT)" : ""}</Text>
                <Picker selectedValue={selectedYear} onValueChange={setSelectedYear} style={styles.picker} dropdownIconColor={primary}>
                  {availableYears.map(y => <Picker.Item key={y} label={y} value={y} color="#0F172A" />)}
                </Picker>
              </View>
              <View style={styles.pickerBox}>
                <Text style={styles.miniLabel}>TERM {term === acadConfig.currentTerm ? "(CURRENT)" : ""}</Text>
                <Picker selectedValue={term} onValueChange={(t: any) => setTerm(t)} style={styles.picker} dropdownIconColor={primary}>
                  <Picker.Item label="Term 1" value="Term 1" color="#0F172A" />
                  <Picker.Item label="Term 2" value="Term 2" color="#0F172A" />
                  <Picker.Item label="Term 3" value="Term 3" color="#0F172A" />
                </Picker>
              </View>
            </View>

            <View style={[styles.pickerBox, { width: "100%", marginTop: 12 }]}>
              <Text style={styles.miniLabel}>REPORT TYPE</Text>
              <Picker selectedValue={selectedReportType} onValueChange={(v) => setSelectedReportType(v as ReportType)} style={styles.picker} dropdownIconColor={primary}>
                <Picker.Item label="End of Term" value="End of Term" color="#0F172A" />
                <Picker.Item label="Mid-Term" value="Mid-Term" color="#0F172A" />
                <Picker.Item label="Mock Exams" value="Mock Exams" color="#0F172A" />
              </Picker>
            </View>

            <View style={[styles.pickerBox, { width: "100%", marginTop: 12 }]}>
              <Text style={styles.miniLabel}>TARGET CLASS</Text>
              <Picker selectedValue={selectedClassId} onValueChange={setSelectedClassId} style={styles.picker} dropdownIconColor={primary}>
                {classes.map(c => <Picker.Item key={c.id} label={c.name} value={c.id} color="#0F172A" />)}
              </Picker>
            </View>

            <View style={[styles.pickerBox, { width: "100%", marginTop: 12 }]}>
              <Text style={styles.miniLabel}>PENDING SUBMISSIONS</Text>
              <Picker selectedValue={selectedSubject} onValueChange={setSelectedSubject} style={styles.picker} dropdownIconColor={primary}>
                {subjects.length > 0 ? subjects.map(s => <Picker.Item key={s.name} label={`${s.name} (${s.status.toUpperCase()})`} value={s.name} color="#0F172A" />) : <Picker.Item label="No Submissions Found" value="" color="#94A3B8" />}
              </Picker>
            </View>

            <TouchableOpacity style={[styles.loadBtn, { backgroundColor: primary }]} onPress={loadSubmission} disabled={listLoading}>
              {listLoading ? <ActivityIndicator color="#fff" /> : <View style={styles.btnContent}><Text style={styles.loadBtnText}>Load Records</Text><SVGIcon name="cloud-download" size={20} color="#fff" style={{ marginLeft: 8 }} /></View>}
            </TouchableOpacity>
          </Animatable.View>
        }
        renderItem={({ item }) => (
          <StudentScoreCard item={item} onUpdate={updateStudentScore} primary={primary} reportType={selectedReportType} />
        )}
        ListEmptyComponent={recordId ? null : (
          <View style={styles.empty}>
            <View style={styles.emptyIconCircle}>
              <SVGIcon name="document-text" size={40} color="#CBD5E1"/>
            </View>
            <Text style={styles.emptyTitle}>Ready to Edit</Text>
            <Text style={styles.emptyText}>Select class and subject to begin updating student scores.</Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 120 }}
      />

      {recordId && allStudents.length > 0 ? (
        <Animatable.View animation="slideInUp" style={styles.footer}>
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteRecord} disabled={saving || deleting}>{deleting ? <ActivityIndicator color="#EF4444" /> : <SVGIcon name="trash-outline" size={24} color="#EF4444" />}</TouchableOpacity>
          <TouchableOpacity style={[styles.saveBtn, { backgroundColor: primary }]} onPress={approveAndSave} disabled={saving || deleting}>{saving ? <ActivityIndicator color="#fff" /> : <View style={styles.btnContent}><Text style={styles.saveBtnText}>Approve & Save Changes</Text><SVGIcon name="checkmark-done-circle" size={22} color="#fff" style={{ marginLeft: 10 }} /></View>}</TouchableOpacity>
        </Animatable.View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { paddingTop: Platform.OS === "android" ? 45 : 60, paddingHorizontal: 25, paddingBottom: 40, borderBottomLeftRadius: 35, borderBottomRightRadius: 35, ...SHADOWS.large },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 20 },
  backBtn: { width: 48, height: 48, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" },
  refreshBtn: { width: 48, height: 48, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" },
  titleContainer: { flex: 1, alignItems: "center" },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "900", letterSpacing: 0.5 },
  headerSub: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "700", textTransform: "uppercase", marginTop: 2 },
  filterSection: { padding: 25, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F1F5F9", marginBottom: 10 },
  filterRow: { flexDirection: "row", gap: 15 },
  pickerBox: { flex: 1, height: 70, backgroundColor: "#F8FAFC", borderRadius: 15, borderWidth: 1, borderColor: "#E2E8F0", paddingTop: 24, paddingHorizontal: 5 },
  miniLabel: { fontSize: 9, fontWeight: "900", color: "#94A3B8", position: "absolute", top: 8, left: 15, zIndex: 10, letterSpacing: 0.5 },
  picker: { color: "#1E293B", ...Platform.select({ web: { height: 40, backgroundColor: "transparent", borderWidth: 0, outlineStyle: "none" } }) } as any,
  loadBtn: { height: 54, borderRadius: 16, marginTop: 15, flexDirection: "row", justifyContent: "center", alignItems: "center", ...SHADOWS.small },
  btnContent: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  loadBtnText: { color: "#fff", fontWeight: "900", fontSize: 15, letterSpacing: 0.5 },
  card: { backgroundColor: "#fff", marginHorizontal: 15, marginBottom: 15, padding: 20, borderRadius: 24, ...SHADOWS.small, borderWidth: 1, borderColor: "#F1F5F9" },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  avatarBox: { width: 48, height: 48, borderRadius: 14, justifyContent: "center", alignItems: "center", marginRight: 15 },
  avatarText: { fontSize: 20, fontWeight: "900" },
  studentName: { fontSize: 17, fontWeight: "800", color: "#1E293B" },
  studentIdLabel: { fontSize: 11, color: "#94A3B8", fontWeight: "600", marginTop: 2 },
  scoreGrid: { marginTop: 0 },
  gridSection: { marginBottom: 15 },
  sectionLabel: { fontSize: 9, fontWeight: "900", color: "#64748B", marginBottom: 12, letterSpacing: 1 },
  gridRow: { flexDirection: "row", gap: 10 },
  inputCol: { flex: 1 },
  valueCol: { flex: 1, alignItems: "center" },
  miniHeader: { fontSize: 8, fontWeight: "900", color: "#94A3B8", textAlign: "center", marginBottom: 5, textTransform: "uppercase" },
  gridInput: { height: 40, backgroundColor: "#F8FAFC", borderRadius: 10, borderWidth: 1, borderColor: "#E2E8F0", textAlign: "center", fontWeight: "900", fontSize: 14, color: "#1E293B" },
  gridValueBox: { height: 40, width: "100%", borderRadius: 10, justifyContent: "center", alignItems: "center" },
  gridValueText: { fontSize: 13, fontWeight: "900" },
  gridDivider: { height: 1, backgroundColor: "#F1F5F9", marginVertical: 15, borderStyle: "dashed", borderRadius: 1 },
  remarksBox: { marginTop: 5, padding: 12, backgroundColor: "#F8FAFC", borderRadius: 12, borderLeftWidth: 4 },
  remarksLabel: { fontSize: 8, fontWeight: "900", color: "#94A3B8", marginBottom: 4, letterSpacing: 0.5 },
  remarksText: { fontSize: 12, color: "#475569", fontStyle: "italic", fontWeight: "600" },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", padding: 20, paddingBottom: Platform.OS === "ios" ? 35 : 20, borderTopWidth: 1, borderTopColor: "#F1F5F9", ...SHADOWS.large, flexDirection: "row", alignItems: "center", gap: 15 },
  deleteBtn: { width: 58, height: 58, borderRadius: 18, backgroundColor: "#FEF2F2", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#FEE2E2" },
  saveBtn: { flex: 1, height: 58, borderRadius: 18, flexDirection: "row", justifyContent: "center", alignItems: "center", ...SHADOWS.medium },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "900", letterSpacing: 0.5 },
  empty: { alignItems: "center", marginTop: 80, paddingHorizontal: 40 },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center", marginBottom: 20 },
  emptyTitle: { fontSize: 18, fontWeight: "900", color: "#1E293B", marginBottom: 10 },
  emptyText: { color: "#94A3B8", fontWeight: "600", textAlign: "center", fontSize: 14, lineHeight: 20 }
});
