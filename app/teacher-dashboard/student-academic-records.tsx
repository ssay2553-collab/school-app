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
  setDoc,
  where
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { db } from "../../firebaseConfig";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";
import { getGradeDetails, sortClasses } from "../../lib/classHelpers";

const storage = getStorage();

interface ClassData {
  id: string;
  name: string;
  classTeacherId?: string;
}

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

// Optimized Student Card Component
const StudentCard = React.memo(
  ({
    student,
    onUpdate,
    reportType,
    isClassTeacher,
    primaryColor,
  }: {
    student: StudentScoreRecord;
    onUpdate: (
      id: string,
      field: keyof StudentScoreRecord,
      val: string,
    ) => void;
    reportType: ReportType;
    isClassTeacher: boolean;
    primaryColor: string;
  }) => {
    return (
      <View style={styles.studentCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.studentName}>{student.fullName}</Text>
          <View style={styles.gradeBadge}>
            <Text style={styles.gradeText}>{student.grade}</Text>
          </View>
        </View>
        <View style={styles.scoresGrid}>
          {/* Add your conditional rendering or other content here. The stray fragment was removed. */}
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
          <View style={[styles.scoreInput, { flex: 1 }]}>
            <Text style={styles.scoreLabel}>EXAMS SCORE (MAX 100)</Text>
            <TextInput
              value={student.examsMark}
              onChangeText={(v) => onUpdate(student.studentId, "examsMark", v)}
              keyboardType="numeric"
              placeholder="0.0"
              style={styles.input}
            />
          </View>
          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>TOTAL (100%)</Text>
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

  // State for selections
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [reportType, setReportType] = useState<ReportType>("End of Term");

  // Local derived values for active period
  const selectedYear = acadConfig.academicYear || "";
  const term = acadConfig.currentTerm || "";

  const [allStudents, setAllStudents] = useState<StudentScoreRecord[]>([]);
  const [serverStudents, setServerStudents] = useState<StudentScoreRecord[]>(
    [],
  );
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15; // Increased page size slightly since rendering is now efficient

  const calculateScores = useCallback(
    (student: StudentScoreRecord, type: ReportType) => {
      const updated = { ...student };
      if (type === "End of Term") {
        const classScoreRaw = parseFloat(updated.classScore) || 0;
        updated.classScore50 = classScoreRaw.toFixed(2); // Directly use the score as it's already capped at 50

        const examsMark = parseFloat(updated.examsMark) || 0;
        updated.exam50 = (examsMark * 0.5).toFixed(2);

        const finalScoreNum =
          parseFloat(updated.classScore50) + parseFloat(updated.exam50);
        updated.finalScore = finalScoreNum.toFixed(2);
        updated.grade = getGradeDetails(finalScoreNum).grade;
      } else {
        const examsMark = parseFloat(updated.examsMark) || 0;
        updated.grade = getGradeDetails(examsMark).grade;
      }
      return updated;
    },
    [],
  );

  const syncRecords = useCallback(async () => {
    // If we don't have these core values, we can't fetch or save a specific record
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
        const loadedStudents = (data.students || []).map(
          (s: StudentScoreRecord) => calculateScores(s, reportType),
        );
        setAllStudents(loadedStudents);
        setServerStudents(JSON.parse(JSON.stringify(loadedStudents)));
      } else {
        // Fetch all students in this class.
        // Filtering by role and classId is usually indexed.
        // We filter status in-memory to avoid "Missing Index" errors with complex where/in queries.
        const q = query(
          collection(db, "users"),
          where("role", "==", "student"),
          where("classId", "==", selectedClassId)
        );

        const snap = await getDocs(q);
        const list: StudentScoreRecord[] = snap.docs
          .map((d: any) => {
            const data = d.data() as any;
            // Only include active or pending students
            if (!["active", "pending_activation"].includes(data.status)) return null;

            return {
              studentId: d.id,
              fullName:
                `${data.profile?.firstName || ""} ${data.profile?.lastName || ""}`.trim() || "Unknown Student",
              classScore: "",
              classScore50: "0",
              examsMark: "",
              exam50: "0",
              finalScore: "0",
              grade: "N/A",
            };
          })
          .filter((s: StudentScoreRecord | null): s is StudentScoreRecord => s !== null)
          .sort((a: StudentScoreRecord, b: StudentScoreRecord) => a.fullName.localeCompare(b.fullName));

        setAllStudents(list);
        setServerStudents(JSON.parse(JSON.stringify(list)));
      }
      setPage(1);
    } catch (err: any) {
      console.error("syncRecords Error:", err);
      setError("Unable to load student list. This might be a connection issue or a missing database index.");
      showToast({ message: "Error loading students.", type: "error" });
    } finally {
      setSyncing(false);
    }
  }, [
    selectedClassId,
    selectedSubject,
    selectedYear,
    term,
    reportType,
    calculateScores,
    showToast
  ]);

  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(allStudents) !== JSON.stringify(serverStudents);
  }, [allStudents, serverStudents]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/teacher-dashboard");
    }
  }, [router]);

  useEffect(() => {
    const onBackPress = () => {
      if (hasUnsavedChanges) {
        Alert.alert(
          "Unsaved Changes",
          "You have modified student scores. Are you sure you want to discard them?",
          [
            { text: "Stay", style: "cancel" },
            { text: "Discard", style: "destructive", onPress: handleBack },
          ],
        );
        return true;
      }
      handleBack();
      return true;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [hasUnsavedChanges, handleBack]);

  const visibleStudents = useMemo(() => {
    return allStudents.slice(0, page * PAGE_SIZE);
  }, [allStudents, page]);

  const isClassTeacher = useMemo(() => {
    const selectedClass = teacherClasses.find((c) => c.id === selectedClassId);
    return selectedClass?.classTeacherId === appUser?.uid;
  }, [selectedClassId, teacherClasses, appUser]);

  useEffect(() => {
    if (!appUser) return;
    const fetchTeacherMetadata = async () => {
      setLoading(true);
      try {
        const classIds = appUser.classes || [];
        if (classIds.length > 0) {
          const q = query(
            collection(db, "classes"),
            where(documentId(), "in", classIds),
          );
          const snap = await getDocsFromServer(q);
          const list = snap.docs.map((d) => ({
            id: d.id,
            name: (d.data() as any).name || d.id,
            classTeacherId: (d.data() as any).classTeacherId,
          }));
          const sorted = sortClasses(list);
          setTeacherClasses(sorted);
          if (sorted.length > 0 && !selectedClassId)
            setSelectedClassId(sorted[0].id);
        }

        // Auto-select first subject if none selected
        if (appUser.subjects && appUser.subjects.length > 0 && !selectedSubject) {
          setSelectedSubject(appUser.subjects[0]);
        }
      } catch (err) {
        console.error("fetchTeacherMetadata Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTeacherMetadata();
  }, [appUser]);

  useEffect(() => {
    syncRecords();
  }, [syncRecords]);

  const updateStudentScore = useCallback(
    (studentId: string, field: keyof StudentScoreRecord, value: string) => {
      setAllStudents((prev) =>
        prev.map((s) => {
          if (s.studentId === studentId) {
            if (field === "classScore" && parseFloat(value) > 50) {
              showToast({
                message: "Class Score must not be above 50%",
                type: "error",
              });
              return s;
            }

            let updated = { ...s, [field]: value } as StudentScoreRecord;
            if (["classScore", "examsMark"].includes(field)) {
              updated = calculateScores(updated, reportType);
            }
            return updated;
          }
          return s;
        }),
      );
    },
    [calculateScores, reportType],
  );

  const loadMore = () => {
    setPage((p) => p + 1);
  };

  const saveRecord = async () => {
    if (!selectedClassId || !selectedSubject || !term || !selectedYear) {
      showToast({ message: "Missing fields.", type: "error" });
      return;
    }
    try {
      const yearSlug = selectedYear.replace(/\//g, "-");
      const reportSlug = reportType.replace(/\s+/g, "");
      const docId = `${selectedClassId}_${selectedSubject.replace(/\s+/g, "")}_${yearSlug}_${term.replace(/\s+/g, "")}_${reportSlug}`;
      await setDoc(doc(db, "academicRecords", docId), {
        docId,
        teacherId: appUser?.uid,
        classId: selectedClassId,
        className:
          teacherClasses.find((c) => c.id === selectedClassId)?.name ||
          selectedClassId,
        subject: selectedSubject,
        academicYear: selectedYear,
        term,
        reportType,
        students: allStudents,
        timestamp: serverTimestamp(),
        status: "pending",
      });
      setServerStudents(JSON.parse(JSON.stringify(allStudents)));
      showToast({
        message: "Academic ledger saved successfully.",
        type: "success",
      });
      router.back();
    } catch (err) {
      showToast({ message: "Failed to save records.", type: "error" });
    }
  };

  if (loading || acadConfig.loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[COLORS.primary, "#1E293B"]}
        style={styles.headerGradient}
      >
        <View style={styles.headerTitleRow}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <SVGIcon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 15 }}>
            <Text style={styles.headerTitle}>Academic Ledger</Text>
            <Text style={styles.headerSubtitle}>
              {selectedYear} • {term}
            </Text>
          </View>
          <SVGIcon name="journal" size={24} color={COLORS.secondary} />
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        removeClippedSubviews={true} // Performance optimization for Android
      >
        <Animatable.View
          animation="fadeInDown"
          duration={500}
          style={styles.configCard}
        >
          <Text style={styles.sectionLabel}>LEDGER CONFIGURATION</Text>

          <View style={styles.lockedConfigRow}>
            <View style={styles.lockedConfigItem}>
              <Text style={styles.miniLabel}>ACADEMIC YEAR</Text>
              <View style={styles.lockedBadge}>
                <Text style={styles.lockedBadgeText}>
                  {selectedYear || "---"}
                </Text>
              </View>
            </View>
            <View style={styles.lockedConfigItem}>
              <Text style={styles.miniLabel}>CURRENT TERM</Text>
              <View style={styles.lockedBadge}>
                <Text style={styles.lockedBadgeText}>{term || "---"}</Text>
              </View>
            </View>
          </View>

          <Text style={[styles.label, { marginTop: 15 }]}>REPORT TYPE</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bubbleRow}
          >
            {(["End of Term", "Mid-Term", "Mock Exams"] as ReportType[]).map(
              (type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setReportType(type)}
                  style={[
                    styles.bubble,
                    reportType === type && {
                      backgroundColor: COLORS.secondary,
                      borderColor: COLORS.secondary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.bubbleText,
                      reportType === type && styles.bubbleTextActive,
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ),
            )}
          </ScrollView>
          <Text style={styles.label}>TARGET CLASS</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bubbleRow}
          >
            {teacherClasses.map((c) => (
              <TouchableOpacity
                key={c.id}
                onPress={() => setSelectedClassId(c.id)}
                style={[
                  styles.bubble,
                  selectedClassId === c.id && styles.bubbleActive,
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    selectedClassId === c.id && styles.bubbleTextActive,
                  ]}
                >
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.label}>SUBJECT</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bubbleRow}
          >
            {(appUser?.subjects || []).map((s: string) => (
              <TouchableOpacity
                key={s}
                onPress={() => setSelectedSubject(s)}
                style={[
                  styles.bubble,
                  selectedSubject === s && styles.bubbleActive,
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    selectedSubject === s && styles.bubbleTextActive,
                  ]}
                >
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animatable.View>

        {syncing ? (
          <View style={styles.syncBox}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.syncText}>Syncing Ledger Data...</Text>
          </View>
        ) : (
          <View style={styles.recordsList}>
            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>STUDENT PERFORMANCE LIST</Text>
              <Text style={styles.listCount}>
                {allStudents.length} Students
              </Text>
            </View>

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity onPress={() => syncRecords()} style={styles.retryBtn}>
                  <Text style={styles.retryBtnText}>RETRY</Text>
                </TouchableOpacity>
              </View>
            )}

            {!error && allStudents.length === 0 ? (
              <View style={styles.emptyState}>
                <SVGIcon name="people-outline" size={48} color="#CBD5E1" />
                <Text style={styles.emptyStateText}>
                  {!selectedSubject ? "Please select a subject first" :
                   !selectedYear ? "Academic Year not set in Admin Settings" :
                   "No active students found in this class"}
                </Text>
              </View>
            ) : (
              visibleStudents.map((student) => (
                <StudentCard
                  key={student.studentId}
                  student={student}
                  onUpdate={updateStudentScore}
                  reportType={reportType}
                  isClassTeacher={isClassTeacher}
                  primaryColor={COLORS.primary}
                />
              ))
            )}
            {allStudents.length > visibleStudents.length && (
              <TouchableOpacity onPress={loadMore} style={styles.loadMoreBtn}>
                <Text style={styles.loadMoreText}>LOAD MORE STUDENTS</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity onPress={saveRecord} style={styles.saveFab}>
        <LinearGradient
          colors={[COLORS.primary, "#4F46E5"]}
          style={styles.fabGrad}
        >
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
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "700",
  },
  signatureCard: {
    backgroundColor: "#fff",
    margin: 20,
    padding: 20,
    borderRadius: 24,
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  sigHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  sigTitle: { fontSize: 16, fontWeight: "800", color: "#1E293B" },
  sigSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 15,
    fontWeight: "600",
  },
  sigContent: { alignItems: "center" },
  sigImage: {
    width: "100%",
    height: 100,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  sigPlaceholder: {
    width: "100%",
    height: 100,
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    borderStyle: "dashed",
    borderWidth: 2,
    borderColor: "#CBD5E1",
    justifyContent: "center",
    alignItems: "center",
  },
  sigPlaceholderText: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 8,
    fontWeight: "700",
  },
  sigUploadBtn: {
    marginTop: 15,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  sigUploadBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  configCard: {
    backgroundColor: "#fff",
    margin: 20,
    padding: 20,
    borderRadius: 24,
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: COLORS.primary,
    letterSpacing: 1,
    marginBottom: 15,
  },
  label: {
    fontSize: 10,
    fontWeight: "900",
    color: "#94A3B8",
    marginBottom: 10,
  },
  bubbleRow: { gap: 10, paddingBottom: 15 },
  bubble: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 15,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  bubbleActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  bubbleText: { fontSize: 12, color: "#475569", fontWeight: "700" },
  bubbleTextActive: { color: "#fff" },
  lockedConfigRow: { flexDirection: "row", gap: 15, marginBottom: 5 },
  lockedConfigItem: { flex: 1 },
  miniLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "#94A3B8",
    marginBottom: 6,
  },
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
  recordsList: { padding: 20 },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  listTitle: { fontSize: 12, fontWeight: "900", color: "#64748B" },
  listCount: { fontSize: 12, fontWeight: "800", color: COLORS.primary },
  studentCard: {
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 20,
    marginBottom: 15,
    ...SHADOWS.small,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  studentName: { fontSize: 15, fontWeight: "800", color: "#1E293B" },
  gradeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },
  gradeText: { fontSize: 12, fontWeight: "900", color: COLORS.primary },
  scoresGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  scoreInput: { width: "47%", marginBottom: 10 },
  scoreLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "#94A3B8",
    marginBottom: 5,
  },
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
  behavioralGrid: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: "#F1F5F9",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  loadMoreBtn: { padding: 15, alignItems: "center" },
  loadMoreText: { fontSize: 12, fontWeight: "900", color: COLORS.primary },
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
  saveFabText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: 1,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    backgroundColor: "#fff",
    borderRadius: 20,
    marginTop: 10,
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
    padding: 20,
    backgroundColor: "#FEF2F2",
    borderRadius: 15,
    alignItems: "center",
    marginBottom: 20,
  },
  errorText: {
    color: "#EF4444",
    fontWeight: "600",
    textAlign: "center",
    fontSize: 12,
  },
  retryBtn: {
    marginTop: 10,
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: "#EF4444",
    borderRadius: 8,
  },
  retryBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 11,
  },
});
