import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
    collection,
    doc,
    getDoc,
    getDocsFromServer,
    onSnapshot,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
    writeBatch,
} from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    RefreshControl,
    SafeAreaView,
    ScrollView,
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
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebaseConfig";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";
import { getGradeDetails, sortClasses } from "../../lib/classHelpers";
import { getDocsCacheFirst } from "../../lib/firestoreHelpers";

const storage = getStorage();

type ReportType = "End of Term" | "Mid-Term" | "Mock Exams";

interface ScoreData {
  id: string;
  studentId: string;
  fullName: string;
  total: number;
  position: number;
  grade: string;
  aggregate?: number; // Sum of grades (1-9) for Core 3 + Best 3
  tas?: number; // Sum of raw scores for Core 3 + Best 3
  conduct?: string;
  attitude?: string;
  interest?: string;
  teacherRemarks?: string;
}

interface ClassStats {
  average: number;
  passRate: number;
  studentCount: number;
}

const StudentItem = React.memo(
  ({
    item,
    onPress,
    onEditMetadata,
    primary,
  }: {
    item: ScoreData;
    onPress: () => void;
    onEditMetadata: () => void;
    primary: string;
  }) => (
    <Animatable.View
      animation="fadeInUp"
      duration={400}
      style={styles.studentCard}
    >
      <TouchableOpacity
        style={styles.cardInner}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={[styles.posBadge, { backgroundColor: primary + "10" }]}>
          <Text style={[styles.posText, { color: primary }]}>
            #{item.position}
          </Text>
        </View>
        <View style={{ flex: 1, marginLeft: 15 }}>
          <Text style={styles.name}>{item.fullName}</Text>
          <Text style={styles.idSub}>ID: {item.studentId.substring(0, 8)}</Text>
          {item.teacherRemarks ? (
            <Text style={styles.remarkPreview} numberOfLines={1}>
              Teacher: {item.teacherRemarks}
            </Text>
          ) : null}
        </View>
        <View style={styles.scoreInfo}>
          <Text style={[styles.score, { color: primary }]}>{item.total}</Text>
          <View style={[styles.gradeBadge, { backgroundColor: "#f1f5f9" }]}>
            <Text style={styles.gradeText}>{item.grade}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.editBtn} onPress={onEditMetadata}>
          <SVGIcon name="create-outline" color={primary} size={22} />
        </TouchableOpacity>
        <SVGIcon name="chevron-forward" color="#CBD5E1" size={18} />
      </TouchableOpacity>
    </Animatable.View>
  ),
);
StudentItem.displayName = "StudentItem";

export default function ViewAcademicRecords() {
  const router = useRouter();
  const { appUser } = useAuth();
  const acadConfig = useAcademicConfig();

  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [fetchingSubjects, setFetchingSubjects] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [uploadingSig, setUploadingSig] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState<string>(
    (appUser?.profile as any)?.signatureUrl || "",
  );

  const [classes, setClasses] = useState<any[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);

  const primary = SCHOOL_CONFIG.primaryColor || "#2e86de";
  const secondary = SCHOOL_CONFIG.secondaryColor || "#c53b59";

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
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [term, setTerm] = useState("");
  const [selectedReportType, setSelectedReportType] =
    useState<ReportType>("End of Term");

  const [studentScores, setStudentScores] = useState<ScoreData[]>([]);
  const [stats, setStats] = useState<ClassStats | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Metadata Editor State
  const [metadataModalVisible, setMetadataModalVisible] = useState(false);
  const [editingStudent, setEditingStudent] = useState<ScoreData | null>(null);
  const [mConduct, setConduct] = useState("Excellent");
  const [mAttitude, setAttitude] = useState("Very Positive");
  const [mInterest, setInterest] = useState("High");
  const [mPromotedTo, setPromotedTo] = useState("");
  const [mNextTermBegins, setNextTermBegins] = useState("");
  const [mAdminRemarks, setAdminRemarks] = useState("");
  const [mTeacherRemarks, setTeacherRemarks] = useState("");

  // Sync with global academic config
  useEffect(() => {
    if (!acadConfig.loading) {
      setSelectedYear(acadConfig.academicYear);
      setTerm(acadConfig.currentTerm);
    }
  }, [acadConfig]);

  // Use onSnapshot for real-time subject list updates
  useEffect(() => {
    if (!selectedClassId || !selectedYear || !term) return;

    setFetchingSubjects(true);
    const q = query(
      collection(db, "academicRecords"),
      where("classId", "==", selectedClassId),
      where("academicYear", "==", selectedYear),
      where("term", "==", term),
      where("reportType", "==", selectedReportType),
      where("status", "==", "approved"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const subs = snap.docs.map((d) => d.data().subject).sort();
        setAvailableSubjects(subs);

        if (subs.length > 0) {
          if (!selectedSubject || !subs.includes(selectedSubject)) {
            setSelectedSubject(subs[0]);
          }
        } else {
          setSelectedSubject("");
        }
        setFetchingSubjects(false);
        setRefreshing(false);
      },
      (error) => {
        console.error("onSnapshot Error:", error);
        setFetchingSubjects(false);
        setRefreshing(false);
      },
    );

    return () => unsubscribe();
  }, [selectedClassId, selectedYear, term, selectedReportType]);

  const loadData = useCallback(async () => {
    if (!selectedClassId || !selectedSubject) {
      return Alert.alert(
        "Selection Required",
        "Please select a class and an approved subject.",
      );
    }

    setListLoading(true);
    setHasSearched(true);

    try {
      // 1. Fetch ALL approved records for this class to calculate aggregates
      const allRecordsSnap = await getDocsFromServer(
        query(
          collection(db, "academicRecords"),
          where("classId", "==", selectedClassId),
          where("academicYear", "==", selectedYear),
          where("term", "==", term),
          where("status", "==", "approved"),
        ),
      );

      // Map to store every student's data across all subjects
      const studentPerformanceMap: Record<
        string,
        {
          fullName: string;
          subjects: Record<string, { grade: number; score: number }>;
          subjectScore?: number;
        }
      > = {};
      const coreSubjects = ["mathematics", "science", "english"];

      allRecordsSnap.docs.forEach((doc) => {
        const data = doc.data();
        const subName = (data.subject || "").toLowerCase();
        const students = data.students || [];

        students.forEach((s: any) => {
          if (!studentPerformanceMap[s.studentId]) {
            studentPerformanceMap[s.studentId] = {
              fullName: s.fullName,
              subjects: {},
            };
          }

          let scoreValue = 0;
          if (data.reportType === "End of Term") {
            scoreValue = parseFloat(
              s.finalScore ||
                (
                  parseFloat(s.classScore || 0) + parseFloat(s.exam50 || 0)
                ).toFixed(2),
            );
          } else {
            scoreValue = parseFloat(s.examsMark || 0);
          }

          const grade = parseInt(getGradeDetails(scoreValue).grade) || 9;
          studentPerformanceMap[s.studentId].subjects[subName] = {
            grade,
            score: scoreValue,
          };

          if (subName === selectedSubject.toLowerCase()) {
            studentPerformanceMap[s.studentId].subjectScore = scoreValue;
          }
        });
      });

      const processed = Object.keys(studentPerformanceMap)
        .filter((sid) => studentPerformanceMap[sid].subjectScore !== undefined)
        .map((sid) => {
          const p = studentPerformanceMap[sid];
          const subs = p.subjects;

          // Core 3
          const coreEntries = Object.keys(subs)
            .filter((k) => coreSubjects.includes(k))
            .map((k) => subs[k]);

          // Best 3 Electives
          const electiveEntries = Object.keys(subs)
            .filter((k) => !coreSubjects.includes(k))
            .map((k) => subs[k])
            .sort((a, b) => a.grade - b.grade); // Sort by grade (lower is better)

          const coreGradeSum =
            coreEntries.reduce((a, b) => a + b.grade, 0) +
            Math.max(0, 3 - coreEntries.length) * 9;
          const electiveGradeSum =
            electiveEntries.slice(0, 3).reduce((a, b) => a + b.grade, 0) +
            Math.max(0, 3 - electiveEntries.length) * 9;
          const aggregate = coreGradeSum + electiveGradeSum;

          const coreScoreSum = coreEntries.reduce((a, b) => a + b.score, 0);
          const electiveScoreSum = electiveEntries
            .slice(0, 3)
            .reduce((a, b) => a + b.score, 0);
          const tas = coreScoreSum + electiveScoreSum;

          return {
            id: sid,
            studentId: sid,
            fullName: p.fullName,
            total: p.subjectScore || 0,
            grade: getGradeDetails(p.subjectScore || 0).grade,
            aggregate: aggregate,
            tas: tas,
          };
        })
        .sort((a, b) => b.total - a.total)
        .map((s, i) => ({ ...s, position: i + 1 }));

      setStudentScores(processed);

      if (processed.length > 0) {
        const sumValue = processed.reduce(
          (acc: number, curr: any) => acc + curr.total,
          0,
        );
        setStats({
          average: parseFloat((sumValue / processed.length).toFixed(2)),
          studentCount: processed.length,
          passRate: 100,
        });
      } else {
        setStats(null);
      }
    } catch (e) {
      console.error("Load Data Error:", e);
      Alert.alert("Error", "Could not fetch records.");
    } finally {
      setListLoading(false);
    }
  }, [
    selectedClassId,
    selectedSubject,
    selectedYear,
    term,
    selectedReportType,
  ]);

  const loadClassesList = async () => {
    try {
      const snap = await getDocsCacheFirst(collection(db, "classes") as any);
      const list = snap.docs.map((d) => ({
        id: d.id,
        name: d.data()?.name || d.id,
      }));
      const sorted = sortClasses(list);
      setClasses(sorted);
      if (sorted.length > 0 && !selectedClassId)
        setSelectedClassId(sorted[0].id);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const init = async () => {
      await loadClassesList();
      setLoading(false);
    };
    init();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    // onSnapshot will handle the update
  };

  const handleEditMetadata = async (student: ScoreData) => {
    setEditingStudent(student);

    // Default values from teacher submission if they exist
    setConduct(student.conduct || "Excellent");
    setAttitude(student.attitude || "Very Positive");
    setInterest(student.interest || "High");
    setTeacherRemarks(student.teacherRemarks || "");
    setPromotedTo("");
    setNextTermBegins("");
    // Auto-generate admin remarks based on OVERALL Aggregate performance
    let autoRemarks = "";
    const agg = student.aggregate || 54;

    if (agg <= 10) {
      autoRemarks =
        "An outstanding academic record. Your consistent excellence across all subjects is highly commendable. Keep it up!";
    } else if (agg <= 20) {
      autoRemarks =
        "A very strong overall performance. You have demonstrated high competence in most areas. Maintain this focus.";
    } else if (agg <= 30) {
      autoRemarks =
        "A good performance overall. However, there is still room to convert your potentials into higher grades with extra effort.";
    } else if (agg <= 40) {
      autoRemarks =
        "Average performance. You need to put in more study hours, especially in your core subjects, to improve your standing.";
    } else if (agg <= 50) {
      autoRemarks =
        "Performance is below expectations. You are capable of better results if you minimize distractions and focus on your studies.";
    } else {
      autoRemarks =
        "A very weak performance this term. Intensive remedial support and a change in study habits are urgently required.";
    }

    setAdminRemarks(autoRemarks);

    setMetadataModalVisible(true);

    // Fetch existing metadata from student-reports if it exists (overrides teacher defaults)
    try {
      const reportId =
        `${student.studentId}_${selectedYear}_${term}_${selectedReportType.replace(/\s+/g, "")}`.replace(
          /\//g,
          "-",
        );
      const snap = await getDoc(doc(db, "student-reports", reportId));
      if (snap.exists()) {
        const d = snap.data();
        if (d.assessment?.conduct) setConduct(d.assessment.conduct);
        if (d.assessment?.attitude) setAttitude(d.assessment.attitude);
        if (d.assessment?.interest) setInterest(d.assessment.interest);
        if (d.promotedTo) setPromotedTo(d.promotedTo);
        if (d.nextTermBegins) setNextTermBegins(d.nextTermBegins);
        if (d.adminRemarks) setAdminRemarks(d.adminRemarks);
        if (d.teacherRemarks) setTeacherRemarks(d.teacherRemarks);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const saveMetadata = async () => {
    if (!editingStudent) return;
    setSavingMetadata(true);
    try {
      const reportId =
        `${editingStudent.studentId}_${selectedYear}_${term}_${selectedReportType.replace(/\s+/g, "")}`.replace(
          /\//g,
          "-",
        );
      await setDoc(
        doc(db, "student-reports", reportId),
        {
          studentId: editingStudent.studentId,
          studentName: editingStudent.fullName,
          academicYear: selectedYear,
          term: term,
          reportType: selectedReportType,
          classId: selectedClassId,
          assessment: {
            conduct: mConduct,
            attitude: mAttitude,
            interest: mInterest,
          },
          promotedTo: mPromotedTo,
          nextTermBegins: mNextTermBegins,
          adminRemarks: mAdminRemarks,
          teacherRemarks: mTeacherRemarks,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      setMetadataModalVisible(false);
      Alert.alert(
        "Success",
        "Terminal metadata saved for " + editingStudent.fullName,
      );
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to save metadata.");
    } finally {
      setSavingMetadata(false);
    }
  };

  const handleUploadSignature = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [2, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets[0].uri) {
        setUploadingSig(true);
        const uri = result.assets[0].uri;
        const response = await fetch(uri);
        const blob = await response.blob();
        const storageRef = ref(storage, `signatures/${appUser?.uid}`);
        await uploadBytes(storageRef, blob);
        const downloadURL = await getDownloadURL(storageRef);

        await updateDoc(doc(db, "users", appUser!.uid), {
          "profile.signatureUrl": downloadURL,
        });
        setSignatureUrl(downloadURL);
        Alert.alert("Success", "Institution signature updated successfully!");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to upload signature.");
    } finally {
      setUploadingSig(false);
    }
  };

  const renderStudentItem = useCallback(
    ({ item }: { item: ScoreData }) => (
      <StudentItem
        item={item}
        primary={primary}
        onEditMetadata={() => handleEditMetadata(item)}
        onPress={() =>
          router.push({
            pathname: "/admin-dashboard/view-academic-record-details",
            params: {
              studentId: item.studentId,
              term,
              classId: selectedClassId,
              academicYear: selectedYear,
              subject: selectedSubject,
              reportType: selectedReportType,
            },
          })
        }
      />
    ),
    [
      primary,
      term,
      selectedClassId,
      selectedYear,
      selectedSubject,
      selectedReportType,
      router,
    ],
  );

  const ListHeader = useMemo(
    () => (
      <View>
        <LinearGradient colors={[primary, secondary]} style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.miniBackBtn}
            >
              <SVGIcon name="arrow-back" color="#fff" size={24} />
            </TouchableOpacity>
            <View style={styles.titleContainer}>
              <Text style={styles.schoolNameMini} numberOfLines={1}>
                {SCHOOL_CONFIG.fullName}
              </Text>
              <Text style={styles.mottoMini}>Approved Academic Ledger</Text>
            </View>
            <View style={{ width: 44 }} />
          </View>
        </LinearGradient>

        <Animatable.View animation="fadeInDown" style={styles.signatureCard}>
          <View style={styles.sigHeader}>
            <SVGIcon
              name="shield-checkmark-outline"
              size={20}
              color={primary}
            />
            <Text style={styles.sigTitle}>
              Institution's Official Signature
            </Text>
          </View>
          <Text style={styles.sigSubtitle}>
            Tip: Sign on plain white paper and{" "}
            <Text style={{ fontWeight: "bold", color: primary }}>
              apply the school stamp
            </Text>{" "}
            over it before uploading for a professional look.
          </Text>
          <View style={styles.sigContent}>
            {signatureUrl ? (
              <Image
                source={{ uri: signatureUrl }}
                style={styles.sigImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.sigPlaceholder}>
                <SVGIcon name="image-outline" size={32} color="#94A3B8" />
                <Text style={styles.sigPlaceholderText}>
                  No Signature Uploaded
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.sigUploadBtn, { backgroundColor: primary }]}
              onPress={handleUploadSignature}
              disabled={uploadingSig}
            >
              {uploadingSig ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.sigUploadBtnText}>
                  {signatureUrl ? "Replace Signature" : "Upload Signature"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </Animatable.View>

        <Animatable.View animation="fadeInDown" style={styles.filterCard}>
          <Text style={styles.sectionLabel}>LEDGER SCOPE</Text>

          <Text style={styles.bubbleLabel}>
            ACADEMIC YEAR{" "}
            {selectedYear === acadConfig.academicYear && "(CURRENT)"}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bubbleRow}
          >
            {availableYears.map((y) => (
              <TouchableOpacity
                key={y}
                onPress={() => setSelectedYear(y)}
                style={[
                  styles.bubble,
                  selectedYear === y && {
                    backgroundColor: primary,
                    borderColor: primary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    selectedYear === y && { color: "#fff" },
                  ]}
                >
                  {y}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.bubbleLabel}>
            TERM {term === acadConfig.currentTerm && "(CURRENT)"}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bubbleRow}
          >
            {["Term 1", "Term 2", "Term 3"].map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setTerm(t as any)}
                style={[
                  styles.bubble,
                  term === t && {
                    backgroundColor: primary,
                    borderColor: primary,
                  },
                ]}
              >
                <Text
                  style={[styles.bubbleText, term === t && { color: "#fff" }]}
                >
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.bubbleLabel}>REPORT TYPE</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bubbleRow}
          >
            {(["End of Term", "Mid-Term", "Mock Exams"] as ReportType[]).map(
              (type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setSelectedReportType(type)}
                  style={[
                    styles.bubble,
                    selectedReportType === type && {
                      backgroundColor: primary,
                      borderColor: primary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.bubbleText,
                      selectedReportType === type && { color: "#fff" },
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ),
            )}
          </ScrollView>

          <Text style={styles.bubbleLabel}>CLASSROOM</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bubbleRow}
          >
            {classes.map((cls) => (
              <TouchableOpacity
                key={cls.id}
                onPress={() => setSelectedClassId(cls.id)}
                style={[
                  styles.bubble,
                  selectedClassId === cls.id && {
                    backgroundColor: primary,
                    borderColor: primary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    selectedClassId === cls.id && { color: "#fff" },
                  ]}
                >
                  {cls.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.bubbleLabel}>APPROVED SUBJECTS</Text>
          <View style={styles.subjectSelectBox}>
            {fetchingSubjects ? (
              <ActivityIndicator color={primary} size="small" />
            ) : availableSubjects.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.bubbleRow}
              >
                {availableSubjects.map((sub) => (
                  <TouchableOpacity
                    key={sub}
                    onPress={() => setSelectedSubject(sub)}
                    style={[
                      styles.subBubble,
                      selectedSubject === sub && {
                        backgroundColor: "#f0f9ff",
                        borderColor: primary,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.subBubbleText,
                        selectedSubject === sub && {
                          color: primary,
                          fontWeight: "bold",
                        },
                      ]}
                    >
                      {sub}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.noApprovedBox}>
                <SVGIcon name="alert-circle" size={20} color="#94A3B8" />
                <Text style={styles.noApprovedText}>
                  No approved records for this selection.
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            onPress={loadData}
            disabled={listLoading || !selectedSubject}
            style={[
              styles.searchBtn,
              { backgroundColor: primary },
              (!selectedSubject || listLoading) && { opacity: 0.6 },
            ]}
          >
            {listLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.btnRow}>
                <Text style={styles.searchBtnText}>View Ledger</Text>
                <SVGIcon name="arrow-forward" color="#fff" size={20} />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={async () => {
              if (studentScores.length === 0) return;
              Alert.alert(
                "Bulk Update",
                "This will apply the current 'Next Term Begins' and 'Promoted To' values to ALL students in this list. Continue?",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Apply to All",
                    onPress: async () => {
                      setListLoading(true);
                      try {
                        const batch = writeBatch(db);
                        for (const student of studentScores) {
                          const reportId =
                            `${student.studentId}_${selectedYear}_${term}_${selectedReportType.replace(/\s+/g, "")}`.replace(
                              /\//g,
                              "-",
                            );

                          // Auto-generate remarks for each student in the loop based on their AGGREGATE
                          let autoRemarks = "";
                          const agg = student.aggregate || 54;
                          if (agg <= 10)
                            autoRemarks =
                              "An outstanding academic record. Your consistent excellence across all subjects is highly commendable. Keep it up!";
                          else if (agg <= 20)
                            autoRemarks =
                              "A very strong overall performance. You have demonstrated high competence in most areas. Maintain this focus.";
                          else if (agg <= 30)
                            autoRemarks =
                              "A good performance overall. However, there is still room to convert your potentials into higher grades with extra effort.";
                          else if (agg <= 40)
                            autoRemarks =
                              "Average performance. You need to put in more study hours, especially in your core subjects, to improve your standing.";
                          else if (agg <= 50)
                            autoRemarks =
                              "Performance is below expectations. You are capable of better results if you minimize distractions and focus on your studies.";
                          else
                            autoRemarks =
                              "A very weak performance this term. Intensive remedial support and a change in study habits are urgently required.";

                          batch.set(
                            doc(db, "student-reports", reportId),
                            {
                              nextTermBegins: mNextTermBegins,
                              promotedTo: mPromotedTo,
                              adminRemarks: autoRemarks,
                              updatedAt: serverTimestamp(),
                            },
                            { merge: true },
                          );
                        }
                        await batch.commit();
                        Alert.alert(
                          "Success",
                          "Settings applied to all students in this view.",
                        );
                      } catch (e) {
                        console.error(e);
                        Alert.alert("Error", "Bulk update failed.");
                      } finally {
                        setListLoading(false);
                      }
                    },
                  },
                ],
              );
            }}
            style={[styles.bulkBtn, { borderColor: primary }]}
          >
            <SVGIcon name="copy-outline" size={18} color={primary} />
            <Text style={[styles.bulkBtnText, { color: primary }]}>
              Apply Reopening & Auto-Remarks to All
            </Text>
          </TouchableOpacity>
        </Animatable.View>

        {stats && studentScores.length > 0 && (
          <Animatable.View animation="fadeIn" style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statVal}>{stats.average}</Text>
              <Text style={styles.statLabel}>Avg Score</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statVal}>{stats.studentCount}</Text>
              <Text style={styles.statLabel}>Students</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statVal}>{stats.passRate}%</Text>
              <Text style={styles.statLabel}>Completion</Text>
            </View>
          </Animatable.View>
        )}
      </View>
    ),
    [
      primary,
      secondary,
      selectedYear,
      term,
      selectedReportType,
      selectedClassId,
      classes,
      availableSubjects,
      selectedSubject,
      fetchingSubjects,
      listLoading,
      stats,
      studentScores,
      acadConfig,
      signatureUrl,
      uploadingSig,
    ],
  );

  if (loading) {
    return (
      <View style={styles.loadingCenter}>
        <ActivityIndicator size="large" color={primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <FlatList
        data={studentScores}
        renderItem={renderStudentItem}
        keyExtractor={(item) => item.studentId}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={primary}
          />
        }
        ListEmptyComponent={
          hasSearched && !listLoading ? (
            <View style={styles.emptyContainer}>
              <SVGIcon name="document-text" size={64} color="#CBD5E1" />
              <Text style={styles.emptyText}>
                No scores recorded for this subject.
              </Text>
            </View>
          ) : null
        }
      />

      <Modal visible={metadataModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Terminal Metadata</Text>
                <Text style={styles.modalSubtitle}>
                  {editingStudent?.fullName}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setMetadataModalVisible(false)}
                style={styles.closeBtn}
              >
                <SVGIcon name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.modalScroll}
            >
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>CONDUCT</Text>
                <TextInput
                  style={styles.textInput}
                  value={mConduct}
                  onChangeText={setConduct}
                  placeholder="e.g. Excellent"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>ATTITUDE</Text>
                <TextInput
                  style={styles.textInput}
                  value={mAttitude}
                  onChangeText={setAttitude}
                  placeholder="e.g. Very Positive"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>INTEREST</Text>
                <TextInput
                  style={styles.textInput}
                  value={mInterest}
                  onChangeText={setInterest}
                  placeholder="e.g. High"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  PROMOTED / REPEATED TO (Global)
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={mPromotedTo}
                  onChangeText={setPromotedTo}
                  placeholder="e.g. Promoted to Basic 5"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>NEXT TERM BEGINS (Global)</Text>
                <TextInput
                  style={styles.textInput}
                  value={mNextTermBegins}
                  onChangeText={setNextTermBegins}
                  placeholder="e.g. 15th Jan, 2025"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>TEACHER'S REMARKS</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  multiline
                  numberOfLines={3}
                  value={mTeacherRemarks}
                  onChangeText={setTeacherRemarks}
                  placeholder="Enter class teacher assessment..."
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>ADMINISTRATIVE REMARKS</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  multiline
                  numberOfLines={3}
                  value={mAdminRemarks}
                  onChangeText={setAdminRemarks}
                  placeholder="Enter official school remarks..."
                />
              </View>

              <TouchableOpacity
                style={[styles.saveMetadataBtn, { backgroundColor: primary }]}
                onPress={saveMetadata}
                disabled={savingMetadata}
              >
                {savingMetadata ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveMetadataBtnText}>
                    Save Final Metadata
                  </Text>
                )}
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  loadingCenter: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    paddingTop: Platform.OS === "android" ? 40 : 20,
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  miniBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  titleContainer: { alignItems: "center", flex: 1 },
  schoolNameMini: { color: "#fff", fontSize: 16, fontWeight: "800" },
  mottoMini: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  filterCard: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginTop: 15,
    borderRadius: 25,
    padding: 20,
    ...SHADOWS.medium,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#64748B",
    letterSpacing: 1.5,
    marginBottom: 15,
  },
  bubbleLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#94A3B8",
    marginBottom: 8,
    marginTop: 5,
  },
  bubbleRow: { paddingBottom: 12, gap: 10 },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  bubbleText: { fontSize: 12, fontWeight: "700", color: "#475569" },
  subjectSelectBox: { minHeight: 60, justifyContent: "center" },
  subBubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 5,
  },
  subBubbleText: { fontSize: 13, color: "#64748B" },
  noApprovedBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  noApprovedText: { fontSize: 12, color: "#94A3B8", fontWeight: "600" },
  searchBtn: {
    height: 56,
    borderRadius: 18,
    marginTop: 15,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.small,
  },
  btnRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  searchBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  statsContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginTop: 15,
    borderRadius: 20,
    padding: 20,
    justifyContent: "space-around",
    ...SHADOWS.small,
  },
  statItem: { alignItems: "center" },
  statVal: { fontSize: 18, fontWeight: "900", color: "#1E293B" },
  statLabel: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "700",
    marginTop: 4,
  },
  statDivider: { width: 1, height: 30, backgroundColor: "#F1F5F9" },
  studentCard: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 18,
    ...SHADOWS.small,
  },
  cardInner: { flexDirection: "row", alignItems: "center", padding: 15 },
  posBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  posText: { fontSize: 16, fontWeight: "900" },
  name: { fontSize: 15, fontWeight: "800", color: "#1E293B" },
  idSub: { fontSize: 11, color: "#94A3B8", marginTop: 2, fontWeight: "600" },
  remarkPreview: {
    fontSize: 10,
    color: "#64748B",
    marginTop: 4,
    fontStyle: "italic",
  },
  scoreInfo: { alignItems: "flex-end", marginRight: 15 },
  score: { fontSize: 17, fontWeight: "900" },
  gradeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  gradeText: { fontSize: 10, fontWeight: "800", color: "#64748B" },
  editBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  emptyContainer: { alignItems: "center", marginTop: 60 },
  emptyText: {
    color: "#94A3B8",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 15,
  },

  signatureCard: {
    backgroundColor: "#fff",
    margin: 20,
    padding: 20,
    borderRadius: 24,
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: -40,
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
    height: 80,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  sigPlaceholder: {
    width: "100%",
    height: 80,
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

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 25,
    paddingTop: 25,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 15,
  },
  modalTitle: { fontSize: 18, fontWeight: "900", color: "#1E293B" },
  modalSubtitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary || "#2e86de",
    marginTop: 2,
  },
  modalScroll: { paddingTop: 10 },
  closeBtn: { width: 40, height: 40, alignItems: "flex-end" },
  inputGroup: { marginBottom: 15 },
  inputLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#94A3B8",
    marginBottom: 8,
    letterSpacing: 1,
  },
  textInput: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    fontSize: 14,
    color: "#1E293B",
    fontWeight: "600",
  },
  textArea: { textAlignVertical: "top", minHeight: 80 },
  bulkBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 15,
    padding: 15,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  bulkBtnText: {
    fontSize: 13,
    fontWeight: "800",
  },
  saveMetadataBtn: {
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 15,
    ...SHADOWS.small,
  },
  saveMetadataBtnText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: 0.5,
  },
});
