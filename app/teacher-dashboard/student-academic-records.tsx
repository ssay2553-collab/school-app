import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
    collection,
    doc,
    documentId,
    getDoc,
    getDocsFromServer,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
} from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
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
  catA: string;
  catB: string;
  groupWork: string;
  projectWork: string;
  total60: number;
  classScore: string;
  examsMark: string;
  exam50: string;
  finalScore: string;
  grade: string;
  conduct: string;
  interest: string;
  attitude: string;
  teacherRemarks: string;
}

export default function StudentAcademicRecords() {
  const router = useRouter();
  const { appUser } = useAuth();
  const acadConfig = useAcademicConfig();

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [teacherClasses, setTeacherClasses] = useState<ClassData[]>([]);
  const [uploadingSig, setUploadingSig] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState<string>(
    (appUser?.profile as any)?.signatureUrl || "",
  );

  const academicYears = useMemo(() => {
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
  const [term, setTerm] = useState("");
  const [reportType, setReportType] = useState<ReportType>("End of Term");

  const [allStudents, setAllStudents] = useState<StudentScoreRecord[]>([]);
  const [visibleStudents, setVisibleStudents] = useState<StudentScoreRecord[]>(
    [],
  );
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // Sync with global academic config
  useEffect(() => {
    if (!acadConfig.loading) {
      setSelectedYear(acadConfig.academicYear);
      setTerm(acadConfig.currentTerm);
    }
  }, [acadConfig]);

  const isClassTeacher = useMemo(() => {
    const selectedClass = teacherClasses.find((c) => c.id === selectedClassId);
    return selectedClass?.classTeacherId === appUser?.uid;
  }, [selectedClassId, teacherClasses, appUser]);

  const calculateScores = useCallback(
    (student: StudentScoreRecord, type: ReportType) => {
      const updated = { ...student };
      if (type === "End of Term") {
        const catA = parseFloat(updated.catA) || 0;
        const catB = parseFloat(updated.catB) || 0;
        const groupWork = parseFloat(updated.groupWork) || 0;
        const projectWork = parseFloat(updated.projectWork) || 0;

        const total60 = catA + catB + groupWork + projectWork;
        updated.total60 = total60;
        updated.classScore = (total60 * (50 / 60)).toFixed(2);

        const examsMark = parseFloat(updated.examsMark) || 0;
        updated.exam50 = (examsMark * 0.5).toFixed(2);

        const finalScoreNum =
          parseFloat(updated.classScore) + parseFloat(updated.exam50);
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
            name: d.data().name || d.id,
            classTeacherId: d.data().classTeacherId,
          }));
          const sorted = sortClasses(list);
          setTeacherClasses(sorted);
          if (sorted.length > 0 && !selectedClassId)
            setSelectedClassId(sorted[0].id);
        }
        // Removed Class Teacher Signature logic to reduce RAM usage and ensure consistency with official reports
        setSignatureUrl("");
      } catch (err) {
        console.error("fetchTeacherMetadata Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTeacherMetadata();
  }, [appUser]);

  useEffect(() => {
    if (!selectedClassId || !selectedSubject || !selectedYear || !term) return;
    const syncRecords = async () => {
      setSyncing(true);
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
          setVisibleStudents(loadedStudents.slice(0, PAGE_SIZE));
        } else {
          const q = query(
            collection(db, "users"),
            where("role", "==", "student"),
            where("classId", "==", selectedClassId),
          );
          const snap = await getDocsFromServer(q);
          const list: StudentScoreRecord[] = snap.docs.map((d) => ({
            studentId: d.id,
            fullName:
              `${d.data().profile?.firstName || ""} ${d.data().profile?.lastName || ""}`.trim(),
            catA: "",
            catB: "",
            groupWork: "",
            projectWork: "",
            total60: 0,
            classScore: "0",
            examsMark: "",
            exam50: "0",
            finalScore: "0",
            grade: "N/A",
            conduct: "Excellent",
            interest: "High",
            attitude: "Positive",
            teacherRemarks: "",
          }));
          setAllStudents(list);
          setVisibleStudents(list.slice(0, PAGE_SIZE));
        }
        setPage(1);
      } catch (err) {
        console.error("syncRecords Error:", err);
      } finally {
        setSyncing(false);
      }
    };
    syncRecords();
  }, [
    selectedClassId,
    selectedSubject,
    selectedYear,
    term,
    reportType,
    calculateScores,
  ]);

  const updateStudentScore = (
    studentId: string,
    field: keyof StudentScoreRecord,
    value: string,
  ) => {
    const updatedAll = allStudents.map((s) => {
      if (s.studentId === studentId) {
        let updated = { ...s, [field]: value } as StudentScoreRecord;
        if (
          ["catA", "catB", "groupWork", "projectWork", "examsMark"].includes(
            field,
          )
        ) {
          updated = calculateScores(updated, reportType);
        }
        return updated;
      }
      return s;
    });
    setAllStudents(updatedAll);
    setVisibleStudents(updatedAll.slice(0, page * PAGE_SIZE));
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setVisibleStudents(allStudents.slice(0, nextPage * PAGE_SIZE));
    setPage(nextPage);
  };

  const saveRecord = async () => {
    if (!selectedClassId || !selectedSubject || !term || !selectedYear)
      return Alert.alert("Error", "Missing fields.");
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
        containsBehavioralData: isClassTeacher && reportType === "End of Term",
      });
      Alert.alert("Success", "Academic ledger saved successfully.");
      router.back();
    } catch (err) {
      Alert.alert("Error", "Failed to save records.");
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
        Alert.alert("Success", "Signature uploaded successfully!");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to upload signature.");
    } finally {
      setUploadingSig(false);
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
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
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
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {isClassTeacher && (
          <Animatable.View animation="fadeInDown" style={styles.signatureCard}>
            <View style={styles.sigHeader}>
              <SVGIcon name="brush-outline" size={20} color={COLORS.primary} />
              <Text style={styles.sigTitle}>Teacher's Digital Signature</Text>
            </View>
            <Text style={styles.sigSubtitle}>
              Required for official terminal reports
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
                style={[
                  styles.sigUploadBtn,
                  { backgroundColor: COLORS.primary },
                ]}
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
        )}

        <Animatable.View animation="fadeInDown" style={styles.configCard}>
          <Text style={styles.sectionLabel}>LEDGER CONFIGURATION</Text>
          <Text style={styles.label}>
            ACADEMIC YEAR{" "}
            {selectedYear === acadConfig.academicYear && "(CURRENT)"}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bubbleRow}
          >
            {academicYears.map((y) => (
              <TouchableOpacity
                key={y}
                onPress={() => setSelectedYear(y)}
                style={[
                  styles.bubble,
                  selectedYear === y && styles.bubbleActive,
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    selectedYear === y && styles.bubbleTextActive,
                  ]}
                >
                  {y}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.label}>
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
                onPress={() => setTerm(t)}
                style={[styles.bubble, term === t && styles.bubbleActive]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    term === t && styles.bubbleTextActive,
                  ]}
                >
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.label}>REPORT TYPE</Text>
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
            {visibleStudents.map((student) => (
              <Animatable.View
                key={student.studentId}
                animation="fadeInUp"
                style={styles.studentCard}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.studentName}>{student.fullName}</Text>
                  <View style={styles.gradeBadge}>
                    <Text style={styles.gradeText}>{student.grade}</Text>
                  </View>
                </View>
                <View style={styles.scoresGrid}>
                  {reportType === "End of Term" ? (
                    <>
                      <View style={styles.scoreInput}>
                        <Text style={styles.scoreLabel}>CAT A (15)</Text>
                        <TextInput
                          value={student.catA}
                          onChangeText={(v) =>
                            updateStudentScore(student.studentId, "catA", v)
                          }
                          keyboardType="numeric"
                          style={styles.input}
                        />
                      </View>
                      <View style={styles.scoreInput}>
                        <Text style={styles.scoreLabel}>CAT B (15)</Text>
                        <TextInput
                          value={student.catB}
                          onChangeText={(v) =>
                            updateStudentScore(student.studentId, "catB", v)
                          }
                          keyboardType="numeric"
                          style={styles.input}
                        />
                      </View>
                      <View style={styles.scoreInput}>
                        <Text style={styles.scoreLabel}>GROUP (15)</Text>
                        <TextInput
                          value={student.groupWork}
                          onChangeText={(v) =>
                            updateStudentScore(
                              student.studentId,
                              "groupWork",
                              v,
                            )
                          }
                          keyboardType="numeric"
                          style={styles.input}
                        />
                      </View>
                      <View style={styles.scoreInput}>
                        <Text style={styles.scoreLabel}>PROJECT (15)</Text>
                        <TextInput
                          value={student.projectWork}
                          onChangeText={(v) =>
                            updateStudentScore(
                              student.studentId,
                              "projectWork",
                              v,
                            )
                          }
                          keyboardType="numeric"
                          style={styles.input}
                        />
                      </View>
                      <View style={styles.scoreInput}>
                        <Text style={styles.scoreLabel}>EXAMS (100)</Text>
                        <TextInput
                          value={student.examsMark}
                          onChangeText={(v) =>
                            updateStudentScore(
                              student.studentId,
                              "examsMark",
                              v,
                            )
                          }
                          keyboardType="numeric"
                          style={styles.input}
                        />
                      </View>
                      <View style={styles.totalBox}>
                        <Text style={styles.totalLabel}>TOTAL (100)</Text>
                        <Text style={styles.totalVal}>
                          {student.finalScore}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <View style={[styles.scoreInput, { flex: 1 }]}>
                      <Text style={styles.scoreLabel}>TOTAL SCORE</Text>
                      <TextInput
                        value={student.examsMark}
                        onChangeText={(v) =>
                          updateStudentScore(student.studentId, "examsMark", v)
                        }
                        keyboardType="numeric"
                        style={styles.input}
                      />
                    </View>
                  )}
                </View>
                {isClassTeacher && reportType === "End of Term" && (
                  <View style={styles.behavioralGrid}>
                    <View style={styles.scoreInput}>
                      <Text style={styles.scoreLabel}>CONDUCT</Text>
                      <TextInput
                        value={student.conduct}
                        onChangeText={(v) =>
                          updateStudentScore(student.studentId, "conduct", v)
                        }
                        style={styles.input}
                      />
                    </View>
                    <View style={styles.scoreInput}>
                      <Text style={styles.scoreLabel}>INTEREST</Text>
                      <TextInput
                        value={student.interest}
                        onChangeText={(v) =>
                          updateStudentScore(student.studentId, "interest", v)
                        }
                        style={styles.input}
                      />
                    </View>
                    <View style={styles.scoreInput}>
                      <Text style={styles.scoreLabel}>ATTITUDE</Text>
                      <TextInput
                        value={student.attitude}
                        onChangeText={(v) =>
                          updateStudentScore(student.studentId, "attitude", v)
                        }
                        style={styles.input}
                      />
                    </View>
                    <View style={[styles.scoreInput, { width: "100%" }]}>
                      <Text style={styles.scoreLabel}>TEACHER REMARKS</Text>
                      <TextInput
                        value={student.teacherRemarks}
                        onChangeText={(v) =>
                          updateStudentScore(
                            student.studentId,
                            "teacherRemarks",
                            v,
                          )
                        }
                        style={styles.input}
                        multiline
                      />
                    </View>
                  </View>
                )}
              </Animatable.View>
            ))}
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
          <Ionicons name="checkmark-done" size={24} color="#fff" />
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
});
