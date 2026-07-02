import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  getDocsFromServer,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
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
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { db } from "../../firebaseConfig";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";
import { getGradeDetails, sortClasses } from "../../lib/classHelpers";

type ReportType = "End of Term" | "Mid-Term" | "Mock Exams";

interface StudentScoreRecord {
  studentId: string;
  fullName: string;
  classScore: string;
  classScore50: string;
  examsMark: string;
  exam50: string;
  finalScore: string;
  grade: string;
}

interface ClassData {
  id: string;
  name: string;
  classTeacherId?: string;
}

// --- Reusable Components ---

const SelectionGroup = React.memo(
  ({
    label,
    items,
    selectedId,
    onSelect,
    getLabel = (item) => item,
    getId = (item) => item,
  }: {
    label: string;
    items: any[];
    selectedId: string;
    onSelect: (id: any) => void;
    getLabel?: (item: any) => string;
    getId?: (item: any) => string;
  }) => (
    <View style={styles.selectionWrapper}>
      <Text style={styles.label}>{label}</Text>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={items}
        keyExtractor={(item) => getId(item)}
        contentContainerStyle={styles.bubbleRow}
        renderItem={({ item }) => {
          const id = getId(item);
          const active = selectedId === id;
          return (
            <TouchableOpacity
              onPress={() => onSelect(id)}
              style={[styles.bubble, active && styles.bubbleActive]}
            >
              <Text style={[styles.bubbleText, active && styles.bubbleTextActive]}>
                {getLabel(item)}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  ),
);

const StudentCard = React.memo(
  ({
    student,
    onUpdate,
    reportType,
  }: {
    student: StudentScoreRecord;
    onUpdate: (id: string, field: keyof StudentScoreRecord, val: string) => void;
    reportType: ReportType;
  }) => {
    const isEOT = reportType === "End of Term";

    return (
      <View style={styles.studentCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.studentName}>{student.fullName}</Text>
          <View style={styles.gradeBadge}>
            <Text style={styles.gradeText}>{student.grade}</Text>
          </View>
        </View>
        <View style={styles.scoresGrid}>
          {isEOT && (
            <View style={[styles.scoreInput, { flex: 1 }]}>
              <Text style={styles.scoreLabel}>CLASS SCORE (MAX 50)</Text>
              <TextInput
                value={student.classScore}
                onChangeText={(v) => onUpdate(student.studentId, "classScore", v)}
                keyboardType="numeric"
                placeholder="0.0"
                style={styles.input}
              />
            </View>
          )}
          <View style={[styles.scoreInput, { flex: 1 }]}>
            <Text style={styles.scoreLabel}>
              {isEOT ? "EXAMS SCORE (MAX 100)" : "EXAMINATION SCORE"}
            </Text>
            <TextInput
              value={student.examsMark}
              onChangeText={(v) => onUpdate(student.studentId, "examsMark", v)}
              keyboardType="numeric"
              placeholder="0.0"
              style={styles.input}
            />
          </View>
          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>FINAL SCORE</Text>
            <Text style={styles.totalVal}>{student.finalScore}</Text>
          </View>
        </View>
      </View>
    );
  },
);

export default function StudentAcademicRecords() {
  const router = useRouter();
  const { appUser } = useAuth();
  const acadConfig = useAcademicConfig();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [teacherClasses, setTeacherClasses] = useState<ClassData[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [reportType, setReportType] = useState<ReportType>("End of Term");

  const selectedYear = acadConfig.academicYear || "";
  const term = acadConfig.currentTerm || "";

  const [allStudents, setAllStudents] = useState<StudentScoreRecord[]>([]);
  const [serverStudents, setServerStudents] = useState<StudentScoreRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const calculateScores = useCallback((student: StudentScoreRecord, type: ReportType) => {
    const updated = { ...student };
    if (type === "End of Term") {
      const classScoreRaw = parseFloat(updated.classScore) || 0;
      updated.classScore50 = classScoreRaw.toFixed(2);
      const examsMark = parseFloat(updated.examsMark) || 0;
      updated.exam50 = (examsMark * 0.5).toFixed(2);
      const finalScoreNum = parseFloat(updated.classScore50) + parseFloat(updated.exam50);
      updated.finalScore = finalScoreNum.toFixed(2);
      updated.grade = getGradeDetails(finalScoreNum).grade;
    } else {
      const examsMark = parseFloat(updated.examsMark) || 0;
      updated.finalScore = examsMark.toFixed(2);
      updated.grade = getGradeDetails(examsMark).grade;
      updated.classScore = "";
      updated.classScore50 = "0";
      updated.exam50 = "0";
    }
    return updated;
  }, []);

  const syncRecords = useCallback(async () => {
    if (!selectedClassId || !selectedSubject || !selectedYear || !term) {
      setAllStudents([]);
      return;
    }
    setSyncing(true);
    setError(null);
    try {
      const yearSlug = selectedYear.replace(/\//g, "-");
      const reportSlug = reportType.replace(/\s+/g, "");
      const docId = `${selectedClassId}_${selectedSubject.replace(/\s+/g, "")}_${yearSlug}_${term.replace(/\s+/g, "")}_${reportSlug}`;
      const docSnap = await getDoc(doc(db, "academicRecords", docId));

      if (docSnap.exists()) {
        const data = docSnap.data();
        const loadedStudents = (data.students || []).map((s: StudentScoreRecord) =>
          calculateScores(s, reportType),
        );
        setAllStudents(loadedStudents);
        setServerStudents(JSON.parse(JSON.stringify(loadedStudents)));
      } else {
        const q = query(
          collection(db, "users"),
          where("role", "==", "student"),
          where("classId", "==", selectedClassId),
        );
        const snap = await getDocs(q);
        const list: StudentScoreRecord[] = snap.docs
          .map((d: any) => {
            const data = d.data();
            if (!["active", "pending_activation", "pending"].includes(data.status)) return null;
            return {
              studentId: d.id,
              fullName: `${data.profile?.firstName || ""} ${data.profile?.lastName || ""}`.trim() || "Unknown Student",
              classScore: "",
              classScore50: "0",
              examsMark: "",
              exam50: "0",
              finalScore: "0",
              grade: "N/A",
            };
          })
          .filter((s): s is StudentScoreRecord => s !== null)
          .sort((a, b) => a.fullName.localeCompare(b.fullName));

        setAllStudents(list);
        setServerStudents(JSON.parse(JSON.stringify(list)));
      }
    } catch (err) {
      console.error("syncRecords error:", err);
      setError("Unable to load student list. Please check your connection.");
    } finally {
      setSyncing(false);
    }
  }, [selectedClassId, selectedSubject, selectedYear, term, reportType, calculateScores]);

  useEffect(() => {
    if (!appUser) return;
    const fetchMetadata = async () => {
      setLoading(true);
      try {
        const classIds = appUser.classes || [];
        if (classIds.length > 0) {
          const q = query(collection(db, "classes"), where(documentId(), "in", classIds));
          const snap = await getDocsFromServer(q);
          const list = snap.docs.map((d) => ({
            id: d.id,
            name: (d.data() as any).name || d.id,
            classTeacherId: (d.data() as any).classTeacherId,
          }));
          const sorted = sortClasses(list);
          setTeacherClasses(sorted);
          if (sorted.length > 0 && !selectedClassId) setSelectedClassId(sorted[0].id);
        }
        if (appUser.subjects && appUser.subjects.length > 0 && !selectedSubject) setSelectedSubject(appUser.subjects[0]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchMetadata();
  }, [appUser]);

  useEffect(() => {
    syncRecords();
  }, [syncRecords]);

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(allStudents) !== JSON.stringify(serverStudents),
    [allStudents, serverStudents],
  );

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/teacher-dashboard");
  }, [router]);

  useEffect(() => {
    const onBackPress = () => {
      if (hasUnsavedChanges) {
        Alert.alert("Unsaved Changes", "Discard modifications?", [
          { text: "Stay", style: "cancel" },
          { text: "Discard", style: "destructive", onPress: handleBack },
        ]);
        return true;
      }
      handleBack();
      return true;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [hasUnsavedChanges, handleBack]);

  const updateStudentScore = useCallback(
    (studentId: string, field: keyof StudentScoreRecord, value: string) => {
      setAllStudents((prev) =>
        prev.map((s) => {
          if (s.studentId !== studentId) return s;
          if (field === "classScore" && parseFloat(value) > 50) {
            showToast({ message: "Max 50% for Class Score", type: "error" });
            return s;
          }
          let updated = { ...s, [field]: value } as StudentScoreRecord;
          if (["classScore", "examsMark"].includes(field)) {
            updated = calculateScores(updated, reportType);
          }
          return updated;
        }),
      );
    },
    [calculateScores, reportType, showToast],
  );

  const saveRecord = async () => {
    if (!selectedClassId || !selectedSubject || !term || !selectedYear) {
      showToast({ message: "Missing fields.", type: "error" });
      return;
    }
    try {
      const batch = writeBatch(db);
      const yearSlug = selectedYear.replace(/\//g, "-");
      const reportSlug = reportType.replace(/\s+/g, "");
      const docId = `${selectedClassId}_${selectedSubject.replace(/\s+/g, "")}_${yearSlug}_${term.replace(/\s+/g, "")}_${reportSlug}`;

      batch.set(doc(db, "academicRecords", docId), {
        docId,
        teacherId: appUser?.uid,
        classId: selectedClassId,
        className: teacherClasses.find((c) => c.id === selectedClassId)?.name || selectedClassId,
        subject: selectedSubject,
        academicYear: selectedYear,
        term,
        reportType,
        students: allStudents,
        timestamp: serverTimestamp(),
        status: "pending",
        containsBehavioralData: false,
      });

      allStudents.forEach((student) => {
        const summaryId = `${student.studentId}_${selectedYear.replace(/\//g, "_")}_${term.replace(/\s+/g, "")}`;
        batch.set(
          doc(db, "academicRecordsSummary", summaryId),
          {
            studentId: student.studentId,
            classId: selectedClassId,
            academicYear: selectedYear,
            term,
            scores: {
              [selectedSubject.replace(/\s+/g, "_")]: {
                finalScore: parseFloat(student.finalScore) || 0,
                grade: student.grade,
                reportType,
                status: "pending",
                lastUpdated: serverTimestamp(),
              },
            },
          },
          { merge: true },
        );
      });

      await batch.commit();
      setServerStudents(JSON.parse(JSON.stringify(allStudents)));
      showToast({ message: "Saved successfully.", type: "success" });
      router.back();
    } catch (err) {
      showToast({ message: "Save failed.", type: "error" });
    }
  };

  const renderHeader = () => (
    <>
      <Animatable.View animation="fadeInDown" duration={500} style={styles.configCard}>
        <Text style={styles.sectionLabel}>LEDGER CONFIGURATION</Text>
        <View style={styles.lockedConfigRow}>
          <View style={styles.lockedConfigItem}>
            <Text style={styles.miniLabel}>ACADEMIC YEAR</Text>
            <View style={styles.lockedBadge}>
              <Text style={styles.lockedBadgeText}>{selectedYear || "---"}</Text>
            </View>
          </View>
          <View style={styles.lockedConfigItem}>
            <Text style={styles.miniLabel}>CURRENT TERM</Text>
            <View style={styles.lockedBadge}>
              <Text style={styles.lockedBadgeText}>{term || "---"}</Text>
            </View>
          </View>
        </View>

        <SelectionGroup
          label="REPORT TYPE"
          items={["End of Term", "Mid-Term", "Mock Exams"]}
          selectedId={reportType}
          onSelect={setReportType}
        />
        <SelectionGroup
          label="TARGET CLASS"
          items={teacherClasses}
          selectedId={selectedClassId}
          onSelect={setSelectedClassId}
          getLabel={(item) => item.name}
          getId={(item) => item.id}
        />
        <SelectionGroup
          label="SUBJECT"
          items={appUser?.subjects || []}
          selectedId={selectedSubject}
          onSelect={setSelectedSubject}
        />
      </Animatable.View>

      <View style={styles.listHeaderContainer}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>STUDENT PERFORMANCE LIST</Text>
          <Text style={styles.listCount}>{allStudents.length} Students</Text>
        </View>
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={syncRecords} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>RETRY</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </>
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <SVGIcon name="people-outline" size={48} color="#CBD5E1" />
      <Text style={styles.emptyStateText}>
        {!selectedSubject
          ? "Please select a subject first"
          : "No active students found in this class"}
      </Text>
    </View>
  );

  if (loading || acadConfig.loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[COLORS.primary, "#1E293B"]} style={styles.headerGradient}>
        <View style={styles.headerTitleRow}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <SVGIcon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 15 }}>
            <Text style={styles.headerTitle}>Academic Ledger</Text>
            <Text style={styles.headerSubtitle}>{selectedYear} • {term}</Text>
          </View>
          <SVGIcon name="journal" size={24} color={COLORS.secondary} />
        </View>
      </LinearGradient>

      {syncing ? (
        <View style={styles.syncBox}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={styles.syncText}>Syncing Ledger Data...</Text>
        </View>
      ) : (
        <FlatList
          data={allStudents}
          keyExtractor={(item) => item.studentId}
          renderItem={({ item }) => (
            <StudentCard
              student={item}
              onUpdate={updateStudentScore}
              reportType={reportType}
            />
          )}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={!syncing ? renderEmpty : null}
          contentContainerStyle={styles.listContent}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
        />
      )}

      <TouchableOpacity onPress={saveRecord} style={styles.saveFab}>
        <LinearGradient colors={[COLORS.primary, "#4F46E5"]} style={styles.fabGrad}>
          <Text style={styles.saveFabText}>SAVE PERFORMANCE LEDGER</Text>
          <SVGIcon name="checkmark-done" size={24} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerGradient: {
    padding: 25,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    ...SHADOWS.medium,
  },
  headerTitleRow: { flexDirection: "row", alignItems: "center" },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 22, fontWeight: "900", color: "#fff" },
  headerSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.7)", fontWeight: "700" },
  configCard: {
    backgroundColor: "#fff",
    margin: 20,
    padding: 20,
    borderRadius: 24,
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  selectionWrapper: { marginTop: 15 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: COLORS.primary,
    letterSpacing: 1,
    marginBottom: 15,
  },
  label: { fontSize: 10, fontWeight: "900", color: "#94A3B8", marginBottom: 10 },
  bubbleRow: { gap: 10, paddingBottom: 5 },
  bubble: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 15,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginRight: 8,
  },
  bubbleActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  bubbleText: { fontSize: 12, color: "#475569", fontWeight: "700" },
  bubbleTextActive: { color: "#fff" },
  lockedConfigRow: { flexDirection: "row", gap: 15, marginBottom: 5 },
  lockedConfigItem: { flex: 1 },
  miniLabel: { fontSize: 9, fontWeight: "900", color: "#94A3B8", marginBottom: 6 },
  lockedBadge: {
    backgroundColor: "#F1F5F9",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  lockedBadgeText: { fontSize: 13, fontWeight: "800", color: COLORS.primary },
  syncBox: { padding: 50, alignItems: "center" },
  syncText: { marginTop: 15, color: "#64748B", fontWeight: "700" },
  listContent: { padding: 20, paddingBottom: 120 },
  listHeaderContainer: { marginBottom: 15 },
  listHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  listTitle: { fontSize: 12, fontWeight: "900", color: "#64748B" },
  listCount: { fontSize: 12, fontWeight: "800", color: COLORS.primary },
  studentCard: {
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 20,
    marginBottom: 15,
    ...SHADOWS.small,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 },
  studentName: { fontSize: 15, fontWeight: "800", color: "#1E293B" },
  gradeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: "#F1F5F9" },
  gradeText: { fontSize: 12, fontWeight: "900", color: COLORS.primary },
  scoresGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  scoreInput: { width: "47%", marginBottom: 10 },
  scoreLabel: { fontSize: 9, fontWeight: "900", color: "#94A3B8", marginBottom: 5 },
  input: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  totalBox: {
    width: "47%",
    backgroundColor: COLORS.primary + "10",
    padding: 10,
    borderRadius: 10,
    justifyContent: "center",
  },
  totalLabel: { fontSize: 9, fontWeight: "900", color: COLORS.primary },
  totalVal: { fontSize: 16, fontWeight: "900", color: COLORS.primary },
  saveFab: {
    position: "absolute",
    bottom: 30,
    left: 20,
    right: 20,
    borderRadius: 20,
    overflow: "hidden",
    ...SHADOWS.large,
  },
  fabGrad: {
    padding: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 15,
  },
  saveFabText: { color: "#fff", fontWeight: "900", fontSize: 16, letterSpacing: 1 },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    backgroundColor: "#fff",
    borderRadius: 20,
    ...SHADOWS.small,
  },
  emptyStateText: {
    marginTop: 15,
    color: "#64748B",
    fontWeight: "700",
    fontSize: 14,
    textAlign: "center",
  },
  errorBox: {
    padding: 15,
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  errorText: { color: "#EF4444", fontWeight: "600", fontSize: 12 },
  retryBtn: { marginTop: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#EF4444", borderRadius: 6 },
  retryBtnText: { color: "#fff", fontWeight: "800", fontSize: 10 },
});
