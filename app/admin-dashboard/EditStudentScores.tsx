import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocsFromServer,
  query,
  serverTimestamp,
  where,
  writeBatch,
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
    BackHandler,
    FlatList,
    Platform,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebaseConfig";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";
import {
  calculateCompetitionRanking,
  sortClasses,
} from "../../lib/classHelpers";
import { useToast } from "../../contexts/ToastContext";

// Components
import { StudentScoreCard, ReportType } from "../../components/admin-dashboard/StudentScoreCard";
import { ScoreFilterSection } from "../../components/admin-dashboard/ScoreFilterSection";

interface SubjectInfo {
  name: string;
  status: string;
  reportType: ReportType;
  hasBehavioral?: boolean;
}

export default function EditStudentScores() {
  const router = useRouter();
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const acadConfig = useAcademicConfig();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [listLoading, setListLoading] = useState(false);

  const primary = SCHOOL_CONFIG.primaryColor;
  const secondary = SCHOOL_CONFIG.secondaryColor;

  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);

  // Selections
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [subjects, setSubjects] = useState<SubjectInfo[]>([]);
  const [selectedReportType, setSelectedReportType] =
    useState<ReportType>("End of Term");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(true);

  // Local derived values for active period (Read-only)
  const selectedYear = acadConfig.academicYear || "";
  const term = acadConfig.currentTerm || "";

  const [recordId, setRecordId] = useState<string | null>(null);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [visibleStudents, setVisibleStudents] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const masterDataRef = useRef<Record<string, any>>({});
  const initialDataRef = useRef<string>("");

  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(allStudents) !== initialDataRef.current;
  }, [allStudents]);

  const filteredStudents = useMemo(() => {
    if (!searchQuery) return allStudents;
    const q = searchQuery.toLowerCase();
    return allStudents.filter(
      (s) =>
        s.fullName?.toLowerCase().includes(q) ||
        s.studentId?.toLowerCase().includes(q),
    );
  }, [allStudents, searchQuery]);

  useEffect(() => {
    const onBackPress = () => {
      if (allStudents.length > 0 && JSON.stringify(allStudents) !== initialDataRef.current) {
        if (Platform.OS === "web") {
          if (window.confirm("You have modified scores. Are you sure you want to exit without saving?")) {
            router.back();
          }
        } else {
          Alert.alert(
            "Unsaved Changes",
            "You have modified scores. Are you sure you want to exit without saving?",
            [
              { text: "Stay", style: "cancel" },
              { text: "Exit", style: "destructive", onPress: () => router.back() }
            ]
          );
        }
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [allStudents]);

  const loadClasses = async () => {
    try {
      const snap = await getDocsFromServer(collection(db, "classes") as any);
      const list = snap.docs.map((d) => ({
        id: d.id,
        name: (d.data() as any).name || d.id,
      }));
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
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
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
        where("reportType", "==", selectedReportType),
      );
      const snap = await getDocsFromServer(q);
      const subsList: SubjectInfo[] = snap.docs
        .map((d) => {
          const data = d.data() as any;
          return {
            name: data.subject,
            status: data.status || "pending",
            reportType: data.reportType || "End of Term",
            hasBehavioral: data.containsBehavioralData,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      setSubjects(subsList);
      if (subsList.length > 0) {
        if (
          !selectedSubject ||
          !subsList.find((s) => s.name === selectedSubject)
        ) {
          setSelectedSubject(subsList[0].name);
        }
      } else {
        setSelectedSubject("");
      }
    } catch (err) {
      console.error("fetchSubjects Error:", err);
    }
  }, [
    selectedClassId,
    selectedYear,
    term,
    selectedReportType,
    selectedSubject,
  ]);

  useEffect(() => {
    if (selectedClassId && selectedYear && term) {
      fetchSubjects();
    }
  }, [selectedClassId, selectedYear, term, selectedReportType, fetchSubjects]);

  const loadSubmission = async () => {
    if (!selectedClassId || !selectedSubject || !selectedYear || !term)
      return showToast({
        message: "Please select Year, Class and Subject.",
        type: "error",
      });
    setListLoading(true);
    try {
      const yearSlug = selectedYear.replace(/\//g, "-");
      const reportSlug = selectedReportType.replace(/\s+/g, "");
      const docId = `${selectedClassId}_${selectedSubject.replace(/\s+/g, "")}_${yearSlug}_${term.replace(/\s+/g, "")}_${reportSlug}`;
      const snap = await getDoc(doc(db, "academicRecords", docId));
      if (snap.exists()) {
        setRecordId(snap.id);
        const students = (snap.data() as any).students || [];
        masterDataRef.current = {};
        setAllStudents(students);
        initialDataRef.current = JSON.stringify(students);
        setVisibleStudents(students.slice(0, PAGE_SIZE));
        setPage(1);
      } else {
        showToast({
          message: `No submissions found for ${selectedSubject} in the selected period.`,
          type: "info",
        });
        setRecordId(null);
        setAllStudents([]);
        setVisibleStudents([]);
      }
    } catch (err) {
      console.error(err);
      showToast({ message: "Failed to load records.", type: "error" });
    } finally {
      setListLoading(false);
    }
  };

  const loadMoreStudents = useCallback(() => {
    setVisibleStudents((prev) => {
      if (prev.length >= filteredStudents.length) return prev;
      const nextPage = Math.floor(prev.length / PAGE_SIZE) + 1;
      setPage(nextPage);
      return filteredStudents.slice(0, nextPage * PAGE_SIZE);
    });
  }, [filteredStudents]);

  const onUpdateRef = useCallback((id: string, updated: any) => {
    masterDataRef.current[id] = updated;
    setAllStudents(prev => {
      const index = prev.findIndex(s => s.studentId === id);
      if (index === -1) return prev;
      const next = [...prev];
      next[index] = updated;
      return next;
    });
  }, []);

  const classStats = useMemo(() => {
    if (allStudents.length === 0) return { avg: "0.00", graded: 0, high: "0.00" };
    const scores = allStudents
      .map(s => parseFloat(s.finalScore) || 0)
      .filter(s => s > 0);

    const graded = scores.length;
    const totalScore = allStudents.reduce((sum, s) => sum + (parseFloat(s.finalScore) || 0), 0);
    const high = scores.length > 0 ? Math.max(...scores).toFixed(2) : "0.00";

    return {
      avg: (totalScore / allStudents.length).toFixed(2),
      graded,
      high
    };
  }, [allStudents]);

  useEffect(() => {
    setVisibleStudents(filteredStudents.slice(0, page * PAGE_SIZE));
  }, [filteredStudents, page]);

  const approveAndSave = async () => {
    if (!recordId || allStudents.length === 0) return;
    const studentsToSave = allStudents.map(
      (s) => masterDataRef.current[s.studentId] || s,
    );

    if (selectedReportType === "End of Term") {
      const invalid = studentsToSave.find((s) => parseFloat(s.classScore) > 50);
      if (invalid)
        return showToast({
          message: `${invalid.fullName}'s Class Score must not be above 50%.`,
          type: "error",
        });
    }

    setSaving(true);
    try {
      const batch = writeBatch(db);
      const recordRef = doc(db, "academicRecords", recordId);

      const subjectScoresList = studentsToSave.map((s) => ({
        id: s.studentId,
        total: parseFloat(s.finalScore) || 0,
      }));

      batch.update(recordRef, {
        students: studentsToSave.map((s) => {
          const rankInfo = calculateCompetitionRanking(
            subjectScoresList,
            s.studentId,
          );
          return {
            ...s,
            position: `${rankInfo.rank}/${rankInfo.total}`,
          };
        }),
        status: "approved",
        approvedAt: serverTimestamp(),
        approvedBy: appUser?.uid,
      });

      studentsToSave.forEach((student) => {
        const yearSlug = selectedYear.replace(/\//g, "_");
        const termSlug = term.replace(/\s+/g, "");
        const summaryId = `${student.studentId}_${yearSlug}_${termSlug}`;
        const summaryRef = doc(db, "academicRecordsSummary", summaryId);
        const subjectKey = selectedSubject.replace(/\s+/g, "_");

        const rankInfo = calculateCompetitionRanking(
          subjectScoresList,
          student.studentId,
        );

        batch.set(
          summaryRef,
          {
            studentId: student.studentId,
            classId: selectedClassId,
            academicYear: selectedYear,
            term: term,
            scores: {
              [subjectKey]: {
                finalScore: parseFloat(student.finalScore) || 0,
                grade: student.grade,
                position: `${rankInfo.rank}/${rankInfo.total}`,
                reportType: selectedReportType,
                lastUpdated: serverTimestamp(),
              },
            },
          },
          { merge: true },
        );
      });

      await batch.commit();
      await updateOverallRankings();

      initialDataRef.current = JSON.stringify(studentsToSave);
      setAllStudents(studentsToSave);
      showToast({
        message: "Scores updated and records marked as approved.",
        type: "success",
      });
      fetchSubjects();
    } catch (err) {
      console.error(err);
      showToast({ message: "Update failed.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const updateOverallRankings = async () => {
    try {
      const qAll = query(
        collection(db, "academicRecords"),
        where("classId", "==", selectedClassId),
        where("academicYear", "==", selectedYear),
        where("term", "==", term),
        where("reportType", "==", selectedReportType),
        where("status", "==", "approved"),
      );

      const allSnap = await getDocsFromServer(qAll);
      const studentTotals: Record<string, number> = {};
      const studentNames: Record<string, string> = {};

      allSnap.docs.forEach((d) => {
        const data = d.data();
        (data.students || []).forEach((s: any) => {
          studentTotals[s.studentId] =
            (studentTotals[s.studentId] || 0) + (parseFloat(s.finalScore) || 0);
          if (!studentNames[s.studentId]) studentNames[s.studentId] = s.fullName;
        });
      });

      const rankedData = Object.entries(studentTotals).map(([id, total]) => ({
        id,
        total,
      }));

      const batch = writeBatch(db);
      rankedData.forEach((item) => {
        const rankInfo = calculateCompetitionRanking(rankedData, item.id);
        const reportId = `${item.id}_${selectedYear}_${term}_${selectedReportType.replace(/\s+/g, "")}`.replace(/\//g, "-");

        batch.set(
          doc(db, "student-reports", reportId),
          {
            overallPosition: `${rankInfo.rank}/${rankInfo.total}`,
            totalScore: item.total,
            studentId: item.id,
            studentName: studentNames[item.id],
            classId: selectedClassId,
            academicYear: selectedYear,
            term,
            reportType: selectedReportType,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      });

      await batch.commit();
    } catch (e) {
      console.error("Error updating overall rankings:", e);
    }
  };

  const handleDeleteRecord = async () => {
    if (!recordId) return;

    const performDelete = async () => {
      setDeleting(true);
      try {
        await deleteDoc(doc(db, "academicRecords", recordId));
        setRecordId(null);
        setAllStudents([]);
        setVisibleStudents([]);
        showToast({
          message: "The records have been removed successfully.",
          type: "success",
        });
        fetchSubjects();
      } catch (err) {
        showToast({ message: "Could not delete records.", type: "error" });
      } finally {
        setDeleting(false);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("This will permanently delete this subject's scores for this class.")) {
        performDelete();
      }
    } else {
      Alert.alert(
        "Delete Records?",
        "This will permanently delete this subject's scores for this class.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete Permanently",
            style: "destructive",
            onPress: performDelete,
          },
        ],
      );
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    await loadClasses();
    await fetchSubjects();
    setLoading(false);
  };

  if (loading || acadConfig.loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={primary} />
      </View>
    );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[primary, secondary]} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <SVGIcon name="arrow-back" color="#fff" size={24} />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {SCHOOL_CONFIG.fullName}
            </Text>
            <View style={styles.statusRow}>
              <Text style={styles.headerSub}>Admin Score Editor</Text>
              {hasUnsavedChanges && (
                <View style={styles.unsavedDot} />
              )}
            </View>
          </View>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshBtn}>
            <SVGIcon name="refresh" color="#fff" size={22} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <FlatList
        data={visibleStudents}
        keyExtractor={(item) => item.studentId}
        onEndReached={loadMoreStudents}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <ScoreFilterSection
              showFilters={showFilters}
              setShowFilters={setShowFilters}
              selectedYear={selectedYear}
              term={term}
              selectedReportType={selectedReportType}
              setSelectedReportType={setSelectedReportType}
              selectedClassId={selectedClassId}
              setSelectedClassId={setSelectedClassId}
              classes={classes}
              selectedSubject={selectedSubject}
              setSelectedSubject={setSelectedSubject}
              subjects={subjects}
              loadSubmission={loadSubmission}
              listLoading={listLoading}
              recordId={recordId}
              primary={primary}
            />

            {recordId && (
              <Animatable.View
                animation="fadeIn"
                style={styles.searchContainer}
              >
                <View style={styles.searchBar}>
                  <SVGIcon name="search-outline" size={20} color="#94A3B8" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search student by name or ID..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholderTextColor="#94A3B8"
                    clearButtonMode="while-editing"
                  />
                  {searchQuery !== "" && Platform.OS !== 'ios' && (
                    <TouchableOpacity onPress={() => setSearchQuery("")}>
                      <SVGIcon
                        name="close-circle-outline"
                        size={20}
                        color="#94A3B8"
                      />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{allStudents.length}</Text>
                    <Text style={styles.statLabel}>Total</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{classStats.graded}</Text>
                    <Text style={styles.statLabel}>Graded</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: primary }]}>{classStats.avg}</Text>
                    <Text style={styles.statLabel}>Avg</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: "#10B981" }]}>{classStats.high}</Text>
                    <Text style={styles.statLabel}>High</Text>
                  </View>
                </View>
              </Animatable.View>
            )}
          </>
        }
        renderItem={({ item }) => (
          <StudentScoreCard
            item={item}
            onUpdateRef={onUpdateRef}
            primary={primary}
            reportType={selectedReportType}
          />
        )}
        ListEmptyComponent={
          recordId ? (
            <View style={styles.empty}>
              <View style={styles.emptyIconCircle}>
                <SVGIcon name="search-outline" size={40} color="#CBD5E1" />
              </View>
              <Text style={styles.emptyTitle}>No Results Found</Text>
              <Text style={styles.emptyText}>
                We couldn't find any students matching "{searchQuery}".
              </Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <View style={styles.emptyIconCircle}>
                <SVGIcon name="document-text" size={40} color="#CBD5E1" />
              </View>
              <Text style={styles.emptyTitle}>Ready to Edit</Text>
              <Text style={styles.emptyText}>
                Select class and subject to begin updating student scores.
              </Text>
            </View>
          )
        }
        contentContainerStyle={{ paddingBottom: 120 }}
      />

      {recordId && allStudents.length > 0 ? (
        <Animatable.View animation="slideInUp" style={styles.footer}>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={handleDeleteRecord}
            disabled={saving || deleting}
          >
            {deleting ? (
              <ActivityIndicator color="#EF4444" />
            ) : (
              <SVGIcon name="trash-outline" size={24} color="#EF4444" />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: primary }]}
            onPress={approveAndSave}
            disabled={saving || deleting}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.btnContent}>
                <Text style={styles.saveBtnText}>Approve & Save Changes</Text>
                <SVGIcon
                  name="checkmark-done-circle"
                  size={22}
                  color="#fff"
                  style={{ marginLeft: 10 }}
                />
              </View>
            )}
          </TouchableOpacity>
        </Animatable.View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    paddingTop: Platform.OS === "android" ? 45 : 60,
    paddingHorizontal: 25,
    paddingBottom: 40,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
    ...SHADOWS.large,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  refreshBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  titleContainer: { flex: 1, alignItems: "center" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  unsavedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F87171",
    marginTop: 2,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  headerSub: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    marginTop: 2,
  },
  searchContainer: {
    marginTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 50,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...SHADOWS.small,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: "#1E293B",
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    marginTop: 15,
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    ...SHADOWS.small,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1E293B",
  },
  statLabel: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "800",
    textTransform: "uppercase",
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: "#E2E8F0",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 35 : 20,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    ...SHADOWS.large,
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },
  deleteBtn: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "#FEF2F2",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FEE2E2",
  },
  saveBtn: {
    flex: 1,
    height: 58,
    borderRadius: 18,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.medium,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  empty: { alignItems: "center", marginTop: 80, paddingHorizontal: 40 },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1E293B",
    marginBottom: 10,
  },
  emptyText: {
    color: "#94A3B8",
    fontWeight: "600",
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
  },
});
