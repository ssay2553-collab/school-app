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
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  const insets = useSafeAreaInsets();

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

  const selectedClassName = useMemo(() => {
    return classes.find((c) => c.id === selectedClassId)?.name || selectedClassId;
  }, [classes, selectedClassId]);

  const [subjects, setSubjects] = useState<SubjectInfo[]>([]);
  const [selectedReportType, setSelectedReportType] =
    useState<ReportType>("End of Term");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(true);

  // Unsaved Changes check
  const confirmDiscard = (onConfirm: () => void) => {
    if (hasUnsavedChanges) {
      if (Platform.OS === "web") {
        if (window.confirm("You have unsaved changes. Discard them?")) {
          onConfirm();
        }
      } else {
        Alert.alert(
          "Unsaved Changes",
          "You have modified scores. Switching will discard these changes.",
          [
            { text: "Stay", style: "cancel" },
            { text: "Discard", style: "destructive", onPress: onConfirm }
          ]
        );
      }
    } else {
      onConfirm();
    }
  };

  const handleBack = () => {
    confirmDiscard(() => {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/admin-dashboard");
      }
    });
  };

  // Local derived values for active period (Read-only)
  const selectedYear = acadConfig.academicYear || "";
  const term = acadConfig.currentTerm || "";

  const [recordId, setRecordId] = useState<string | null>(null);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [visibleStudents, setVisibleStudents] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const masterDataRef = useRef<Record<string, any>>({});
  const initialDataRef = useRef<string>("[]");
  const initialDataMapRef = useRef<Map<string, string>>(new Map());

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
      if (hasUnsavedChanges) {
        if (Platform.OS === "web") {
          return false; // Browser handles its own back confirm if we use beforeunload, but standard back button won't trigger this anyway
        }
        Alert.alert(
          "Unsaved Changes",
          "You have modified scores. Are you sure you want to exit without saving?",
          [
            { text: "Stay", style: "cancel" },
            { text: "Exit", style: "destructive", onPress: () => router.back() }
          ]
        );
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [hasUnsavedChanges, router]);

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

  const loadSubmission = async (subjectOverride?: string) => {
    const subject = subjectOverride || selectedSubject;
    if (!selectedClassId || !subject || !selectedYear || !term)
      return showToast({
        message: "Please select Year, Class and Subject.",
        type: "error",
      });
    setListLoading(true);
    try {
      const yearSlug = selectedYear.replace(/\//g, "-");
      const reportSlug = selectedReportType.replace(/\s+/g, "");
      const docId = `${selectedClassId}_${subject.replace(/\s+/g, "")}_${yearSlug}_${term.replace(/\s+/g, "")}_${reportSlug}`;
      const snap = await getDoc(doc(db, "academicRecords", docId));
      if (snap.exists()) {
        setRecordId(snap.id);
        const data = snap.data() as any;
        const students = Array.isArray(data.students) ? data.students : [];
        masterDataRef.current = {};
        setAllStudents(students);
        initialDataRef.current = JSON.stringify(students);

        // Populate initial data map for per-student modification tracking
        initialDataMapRef.current.clear();
        students.forEach((s: any) => {
          if (s && s.studentId) {
            initialDataMapRef.current.set(s.studentId, JSON.stringify(s));
          }
        });

        setVisibleStudents(students.slice(0, PAGE_SIZE));
        setPage(1);
      } else {
        showToast({
          message: `No submissions found for ${selectedSubject} in the selected period.`,
          type: "info",
        });
        setRecordId(null);
        setAllStudents([]);
        initialDataRef.current = "[]";
        initialDataMapRef.current.clear();
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
        status: studentsToSave.every(s => s.status === "approved") ? "approved" : "partially_approved",
        approvedAt: serverTimestamp(),
        approvedBy: appUser?.uid,
      });

      studentsToSave.forEach((student) => {
        const yearSlug = selectedYear.replace(/\//g, "_");
        const termSlug = term.replace(/\s+/g, "");
        const summaryId = `${student.studentId}_${yearSlug}_${termSlug}`;
        const summaryRef = doc(db, "academicRecordsSummary", summaryId);
        const subjectKey = `${selectedSubject.replace(/\s+/g, "_")}_${selectedReportType.replace(/\s+/g, "")}`;

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
                status: student.status || "pending",
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

      // Update the map after successful save
      initialDataMapRef.current.clear();
      studentsToSave.forEach((s: any) => {
        initialDataMapRef.current.set(s.studentId, JSON.stringify(s));
      });

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
        const studentsArr = Array.isArray(data.students) ? data.students : [];
        studentsArr.forEach((s: any) => {
          if (s && s.studentId) {
            studentTotals[s.studentId] =
              (studentTotals[s.studentId] || 0) + (parseFloat(s.finalScore) || 0);
            if (!studentNames[s.studentId]) studentNames[s.studentId] = s.fullName;
          }
        });
      });

      const rankedData = Object.entries(studentTotals).map(([id, total]) => ({
        id,
        total,
      }));

      const batch = writeBatch(db);

      // Get current statuses of students to determine if overall report should be approved
      const studentStatusMap = new Map<string, string>();
      allSnap.docs.forEach((d) => {
        const data = d.data();
        (data.students || []).forEach((s: any) => {
          if (s.studentId) studentStatusMap.set(s.studentId, s.status || "pending");
        });
      });

      rankedData.forEach((item) => {
        const rankInfo = calculateCompetitionRanking(rankedData, item.id);
        const reportId = `${item.id}_${selectedYear}_${term}_${selectedReportType.replace(/\s+/g, "")}`.replace(/\//g, "-");

        // The overall report is only "approved" if all its components are approved.
        // For simplicity here, we'll mark the overall status based on the current subject's view
        // OR let the specific student's status drive it.
        const currentStudentStatus = studentStatusMap.get(item.id) || "pending";

        batch.set(
          doc(db, "student-reports", reportId),
          {
            overallPosition: `${rankInfo.rank}/${rankInfo.total}`,
            totalScore: item.total,
            status: currentStudentStatus === "approved" ? "approved" : "pending",
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
        initialDataRef.current = "[]";
        initialDataMapRef.current.clear();
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

      <FlatList
        data={visibleStudents}
        keyExtractor={(item) => item.studentId}
        onEndReached={loadMoreStudents}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <LinearGradient colors={[primary, secondary]} style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 10 }]}>
              <View style={styles.headerTop}>
                <TouchableOpacity
                  onPress={handleBack}
                  style={styles.headerBtn}
                >
                  <SVGIcon name="arrow-back" color="#fff" size={22} />
                </TouchableOpacity>
                <View style={styles.titleContainer}>
                  <Text style={styles.headerTitle} numberOfLines={1}>
                    {selectedSubject || "Score Editor"}
                  </Text>
                  <View style={styles.statusRow}>
                    <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
                    <Text style={styles.headerSub} numberOfLines={1}>{selectedClassName || 'No Class Selected'}</Text>
                    {hasUnsavedChanges && (
                      <View style={styles.unsavedBadge}>
                        <Text style={styles.unsavedText}>UNSAVED</Text>
                      </View>
                    )}
                  </View>
                </View>
                <TouchableOpacity onPress={handleRefresh} style={styles.headerBtn}>
                  <SVGIcon name="refresh" color="#fff" size={20} />
                </TouchableOpacity>
              </View>

              {subjects.length > 0 && (
                <Animatable.View animation="fadeIn" duration={600} style={styles.subjectScrollContainer}>
                  <View style={styles.subjectHeaderRow}>
                    <Text style={styles.subjectLabel}>SUBMITTED SUBJECTS</Text>
                    <View style={styles.subjectCountBadge}>
                        <Text style={styles.subjectCountText}>{subjects.length}</Text>
                    </View>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.subjectScrollContent}
                  >
                    {subjects.map((s) => (
                      <TouchableOpacity
                        key={s.name}
                        style={[
                          styles.subjectChip,
                          s.status === 'approved' ? styles.approvedChip : styles.pendingChip,
                          selectedSubject === s.name && styles.activeSubjectChip
                        ]}
                        onPress={() => {
                          if (selectedSubject === s.name) return;
                          confirmDiscard(() => {
                            setSelectedSubject(s.name);
                            loadSubmission(s.name);
                          });
                        }}
                      >
                        <View style={[
                          styles.statusDotSmall,
                          { backgroundColor: s.status === 'approved' ? '#10B981' : '#F59E0B' }
                        ]} />
                        <Text style={[
                          styles.subjectChipText,
                          selectedSubject === s.name ? { color: primary } : { color: '#fff' }
                        ]}>
                          {s.name}
                        </Text>
                        {s.status === 'approved' && (
                          <SVGIcon
                            name="checkmark-circle"
                            size={14}
                            color={selectedSubject === s.name ? primary : "#10B981"}
                            style={{ marginLeft: 6 }}
                          />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </Animatable.View>
              )}
            </LinearGradient>
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
              loadSubmission={() => confirmDiscard(loadSubmission)}
              listLoading={listLoading}
              recordId={recordId}
              primary={primary}
            />

            {recordId && (
              <Animatable.View
                animation="fadeIn"
                style={styles.searchSection}
              >
                <View style={styles.searchBar}>
                  <SVGIcon name="search" size={18} color="#94A3B8" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search student name..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholderTextColor="#94A3B8"
                    clearButtonMode="while-editing"
                  />
                </View>

                <View style={styles.statsContainer}>
                  <View style={styles.statBox}>
                    <Text style={styles.statVal}>{allStudents.length}</Text>
                    <Text style={styles.statLab}>Students</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statBox}>
                    <Text style={[styles.statVal, { color: primary }]}>{classStats.avg}</Text>
                    <Text style={styles.statLab}>Average</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statBox}>
                    <Text style={[styles.statVal, { color: "#10B981" }]}>{classStats.high}</Text>
                    <Text style={styles.statLab}>Highest</Text>
                  </View>
                </View>
              </Animatable.View>
            )}
          </>
        }
        renderItem={({ item }) => {
          const originalJson = initialDataMapRef.current.get(item.studentId);
          const isModified = JSON.stringify(item) !== originalJson;

          return (
            <StudentScoreCard
              item={item}
              onUpdateRef={onUpdateRef}
              primary={primary}
              reportType={selectedReportType}
              isModified={isModified}
            />
          );
        }}
        ListEmptyComponent={
          recordId ? (
            <View style={styles.empty}>
              <View style={[styles.emptyIconCircle, { backgroundColor: '#F1F5F9' }]}>
                <SVGIcon name="search" size={32} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>No matching students</Text>
              <Text style={styles.emptyText}>
                Try a different search term or check filters.
              </Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <View style={[styles.emptyIconCircle, { backgroundColor: primary + '10' }]}>
                <SVGIcon name="document-text" size={32} color={primary} />
              </View>
              <Text style={styles.emptyTitle}>Ready to begin</Text>
              <Text style={styles.emptyText}>
                Use the filters above to load a class subject.
              </Text>
            </View>
          )
        }
        contentContainerStyle={{ paddingBottom: 120 }}
      />

      {recordId && allStudents.length > 0 ? (
        <Animatable.View
          animation="slideInUp"
          duration={400}
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, 16) }
          ]}
        >
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={handleDeleteRecord}
            disabled={saving || deleting}
          >
            {deleting ? (
              <ActivityIndicator color="#EF4444" />
            ) : (
              <SVGIcon name="trash" size={22} color="#EF4444" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.approveAllBtn, { borderColor: primary }]}
            onPress={() => {
              const updated = allStudents.map(s => ({ ...s, status: "approved" }));
              setAllStudents(updated);
              // Update master ref as well
              updated.forEach(s => {
                masterDataRef.current[s.studentId] = s;
              });
              showToast({ message: "All students marked for approval. Click Save to commit.", type: "info" });
            }}
            disabled={saving || deleting}
          >
            <SVGIcon name="checkmark-done-circle" size={20} color={primary} />
            <Text style={[styles.approveAllText, { color: primary }]}>Approve All</Text>
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
                <Text style={styles.saveBtnText}>Save Changes</Text>
                <SVGIcon
                  name="cloud-upload"
                  size={20}
                  color="#fff"
                  style={{ marginLeft: 8 }}
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
    paddingHorizontal: 20,
    paddingBottom: 25,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    ...SHADOWS.medium,
  },
  subjectScrollContainer: {
    marginTop: 20,
  },
  subjectHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8
  },
  subjectLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  subjectCountBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  subjectCountText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
  subjectScrollContent: {
    paddingRight: 20,
    paddingBottom: 4
  },
  subjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    marginRight: 10,
    borderWidth: 1.5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  approvedChip: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  pendingChip: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  activeSubjectChip: {
    backgroundColor: '#fff',
    borderColor: '#fff',
    ...SHADOWS.medium,
  },
  subjectChipText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3
  },
  statusDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  titleContainer: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: 10,
    justifyContent: 'center'
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    maxWidth: '100%',
    flexWrap: 'nowrap'
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  unsavedBadge: {
    backgroundColor: "#F87171",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    flexShrink: 0,
  },
  unsavedText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900'
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.3,
    textAlign: 'center'
  },
  headerSub: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "700",
    flexShrink: 1,
  },
  searchSection: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 48,
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
  statsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    marginTop: 12,
    backgroundColor: "#fff",
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    ...SHADOWS.small,
  },
  statBox: {
    alignItems: "center",
    flex: 1
  },
  statVal: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1E293B",
  },
  statLab: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "700",
    textTransform: "uppercase",
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: "#F1F5F9",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    ...SHADOWS.large,
  },
  deleteBtn: {
    width: 48,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#FEF2F2",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FEE2E2",
  },
  approveAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: '#fff',
  },
  approveAllText: {
    fontSize: 13,
    fontWeight: '800',
  },
  saveBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.small,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  btnContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { alignItems: "center", marginTop: 60, paddingHorizontal: 40 },
  emptyIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1E293B",
    marginBottom: 6,
  },
  emptyText: {
    color: "#94A3B8",
    fontWeight: "500",
    textAlign: "center",
    fontSize: 13,
    lineHeight: 18,
  },
});
