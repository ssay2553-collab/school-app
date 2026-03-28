import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    startAfter,
    Timestamp,
    updateDoc,
    where,
} from "firebase/firestore";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Linking,
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
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebaseConfig";

/* ---------------- TYPES ---------------- */

interface Question {
  text: string;
  options?: string[];
}

interface Assignment {
  id: string;
  title: string;
  deadline?: Timestamp;
  type?: "standard" | "mcq" | "short_answer";
  questions?: Question[];
  subjectId: string;
}

interface Submission {
  id: string;
  studentId: string;
  studentName: string;
  fileUrl?: string;
  responses?: Record<number, string>;
  type: "standard" | "mcq" | "short_answer";
  marked: boolean;
  marks?: number;
  questionScores?: Record<number, number>;
  isLate?: boolean;
  submittedAt?: Timestamp;
}

interface ClassInfo {
  id: string;
  name: string;
}

/* ---------------- SCREEN ---------------- */

export default function MarkAssignment() {
  const { appUser } = useAuth();
  const router = useRouter();
  const teacherId = appUser?.uid;

  const [availableClasses, setAvailableClasses] = useState<ClassInfo[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] =
    useState<Assignment | null>(null);

  const [submissions, setSubmissions] = useState<Submission[]>([]);

  const [qScoreInputs, setQScoreInputs] = useState<
    Record<string, Record<number, string>>
  >({});
  const [standardMarksInput, setStandardMarksInput] = useState<
    Record<string, string>
  >({});
  const [feedbackInputs, setFeedbackInputs] = useState<Record<string, string>>(
    {},
  );

  const [loading, setLoading] = useState(false);
  const [, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [, setFetchingNames] = useState(true);
  const [fetchingSubmissions, setFetchingSubmissions] = useState(false);

  const lastVisibleRef = useRef<any>(null);
  const hasMoreRef = useRef(true);
  const isFetchingRef = useRef(false);

  /* ---------------- FETCH CLASS NAMES ---------------- */
  useEffect(() => {
    if (!appUser || !appUser.classes || appUser.classes.length === 0) {
      setFetchingNames(false);
      return;
    }

    const fetchNames = async () => {
      try {
        const classInfos: ClassInfo[] = [];
        for (const classId of appUser.classes || []) {
          const classSnap = await getDoc(doc(db, "classes", classId));
          if (classSnap.exists()) {
            classInfos.push({
              id: classId,
              name: classSnap.data().name || classId,
            });
          } else {
            classInfos.push({ id: classId, name: classId });
          }
        }
        setAvailableClasses(classInfos);
        if (classInfos.length > 0) setSelectedClass(classInfos[0].id);
      } catch (err) {
        console.error("Error fetching class names:", err);
      } finally {
        setFetchingNames(false);
      }
    };

    fetchNames();
  }, [appUser]);

  useEffect(() => {
    const firstSub = appUser?.subjects?.[0];
    if (firstSub) {
      setSelectedSubject(firstSub);
    }
  }, [appUser]);

  /* ---------------- FETCH ASSIGNMENTS ---------------- */
  const fetchAssignments = useCallback(
    async (isFirstLoad = false) => {
      if (!selectedClass || !selectedSubject || !teacherId) {
        if (isFirstLoad) {
          setAssignments([]);
          lastVisibleRef.current = null;
          hasMoreRef.current = false;
        }
        return;
      }

      if (isFetchingRef.current) return;
      if (!isFirstLoad && !hasMoreRef.current) return;

      isFetchingRef.current = true;
      if (isFirstLoad) {
        setLoading(true);
        lastVisibleRef.current = null;
      } else {
        setLoadingMore(true);
      }

      try {
        const queryConstraints: any[] = [
          where("classId", "==", selectedClass),
          where("subjectId", "==", selectedSubject),
          where("teacherId", "==", teacherId),
          orderBy("createdAt", "desc"),
          limit(10),
        ];

        if (!isFirstLoad && lastVisibleRef.current) {
          queryConstraints.push(startAfter(lastVisibleRef.current));
        }

        const q = query(collection(db, "assignments"), ...queryConstraints);
        const snap = await getDocs(q);

        const data = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Assignment[];

        if (isFirstLoad) {
          setAssignments(data);
          if (data.length > 0) setSelectedAssignment(data[0]);
          else setSelectedAssignment(null);
        } else {
          setAssignments((prev) => [...prev, ...data]);
        }

        lastVisibleRef.current = snap.docs[snap.docs.length - 1] || null;
        hasMoreRef.current = snap.docs.length === 10;
      } catch (e: any) {
        console.error("fetchAssignments Error:", e);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
        isFetchingRef.current = false;
      }
    },
    [selectedClass, selectedSubject, teacherId],
  );

  useEffect(() => {
    fetchAssignments(true);
  }, [fetchAssignments]);

  const onRefresh = () => {
    if (isFetchingRef.current) return;
    setRefreshing(true);
    fetchAssignments(true);
  };

  /* ---------------- FETCH SUBMISSIONS (RELIABLE) ---------------- */
  useEffect(() => {
    if (!selectedAssignment) {
      setSubmissions([]);
      return;
    }

    const fetchSubs = async () => {
      setFetchingSubmissions(true);
      try {
        const q = query(
          collection(db, "submissions"),
          where("assignmentId", "==", selectedAssignment.id),
          where("marked", "==", false),
        );

        const snap = await getDocs(q);
        const fetchedSubmissions = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Submission[];

        fetchedSubmissions.sort(
          (a, b) =>
            (b.submittedAt?.toMillis() || 0) - (a.submittedAt?.toMillis() || 0),
        );

        setSubmissions(fetchedSubmissions);

        const initialQInputs: Record<string, Record<number, string>> = {};
        fetchedSubmissions.forEach((sub) => {
          if (sub.responses) {
            initialQInputs[sub.id] = {};
            Object.keys(sub.responses).forEach((key) => {
              initialQInputs[sub.id][parseInt(key)] = "";
            });
          }
        });
        setQScoreInputs(initialQInputs);
      } catch (e: any) {
        console.error("Fetch submissions error:", e);
      } finally {
        setFetchingSubmissions(false);
      }
    };

    fetchSubs();
  }, [selectedAssignment]);

  /* ---------------- MARK SUBMISSION & NOTIFY PARENT ---------------- */
  const submitMark = async (sub: Submission) => {
    let totalScore = 0;
    const finalQuestionScores: Record<number, number> = {};

    if (sub.type === "standard") {
      const val = standardMarksInput[sub.id];
      if (!val || isNaN(Number(val))) {
        return Alert.alert("Invalid Score", "Please enter a numeric score.");
      }
      totalScore = Number(val);
    } else {
      const submissionQInputs = qScoreInputs[sub.id] || {};
      const questionIndices = Object.keys(sub.responses || {});

      for (const idx of questionIndices) {
        const i = parseInt(idx);
        const scoreStr = submissionQInputs[i];
        if (!scoreStr || isNaN(Number(scoreStr))) {
          return Alert.alert("Incomplete", `Please score question ${i + 1}.`);
        }
        const score = Number(scoreStr);
        finalQuestionScores[i] = score;
        totalScore += score;
      }
    }

    try {
      await updateDoc(doc(db, "submissions", sub.id), {
        marks: totalScore,
        questionScores: finalQuestionScores,
        marked: true,
        feedback: feedbackInputs[sub.id] || "",
        markedAt: serverTimestamp(),
      });

      const studentSnap = await getDoc(doc(db, "users", sub.studentId));
      if (studentSnap.exists()) {
        const studentData = studentSnap.data();
        const parentUids = studentData.parentUids || [];

        if (parentUids.length > 0) {
          for (const pUid of parentUids) {
            await addDoc(collection(db, "notifications"), {
              recipientId: pUid,
              title: "New Assignment Grade",
              body: `${sub.studentName} scored ${totalScore} in their ${selectedAssignment?.title || "assignment"}.`,
              type: "grade",
              timestamp: serverTimestamp(),
              studentId: sub.studentId,
              read: false,
            });
          }
        }
      }

      setSubmissions((prev) => prev.filter((s) => s.id !== sub.id));
      Alert.alert(
        "Success",
        `Assignment marked! Total Score: ${totalScore}. Parent has been notified.`,
      );
    } catch (error) {
      console.error("Marking Error:", error);
      Alert.alert("Error", "Failed to submit marks.");
    }
  };

  const updateQScore = (subId: string, qIdx: number, text: string) => {
    setQScoreInputs((prev) => ({
      ...prev,
      [subId]: {
        ...(prev[subId] || {}),
        [qIdx]: text,
      },
    }));
  };

  const calculateTotal = (sub: Submission) => {
    if (sub.type === "standard") return standardMarksInput[sub.id] || "0";
    const inputs = qScoreInputs[sub.id] || {};
    return Object.values(inputs).reduce(
      (acc, curr) => acc + (Number(curr) || 0),
      0,
    );
  };

  const renderSubmission = ({
    item,
    index,
  }: {
    item: Submission;
    index: number;
  }) => (
    <Animatable.View
      animation="fadeInUp"
      duration={500}
      delay={index * 100}
      key={item.id}
      style={styles.subCard}
    >
      <View style={styles.subHeader}>
        <View style={styles.studentInfo}>
          <View
            style={[styles.avatar, { backgroundColor: COLORS.primary + "15" }]}
          >
            <Text style={styles.avatarText}>
              {(item.studentName?.charAt(0) || "S").toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.student}>{item.studentName || "Student"}</Text>
            <Text style={styles.submissionDate}>
              Submitted{" "}
              {item.submittedAt
                ? new Date(item.submittedAt.toDate()).toLocaleDateString()
                : "date unknown"}
            </Text>
          </View>
        </View>
        {item.isLate && (
          <View style={styles.lateBadge}>
            <Text style={styles.lateText}>LATE</Text>
          </View>
        )}
      </View>

      {item.type === "standard" ? (
        <View>
          <TouchableOpacity
            style={styles.fileLink}
            onPress={() => item.fileUrl && Linking.openURL(item.fileUrl)}
          >
            <View
              style={[
                styles.fileIconBox,
                { backgroundColor: COLORS.secondary + "15" },
              ]}
            >
              <SVGIcon
                name="document-text"
                size={20}
                color={COLORS.secondary}
              />
            </View>
            <Text style={styles.linkText}>View Submission File</Text>
            <SVGIcon
              name="chevron-forward"
              size={16}
              color={COLORS.secondary}
              style={{ marginLeft: "auto" }}
            />
          </TouchableOpacity>

          <View style={styles.standardMarkRow}>
            <View>
              <Text style={styles.scoreLabelHeader}>Total Marks</Text>
              <Text style={styles.scoreSubLabel}>Enter numeric value</Text>
            </View>
            <TextInput
              style={styles.totalInput}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#94A3B8"
              value={standardMarksInput[item.id] || ""}
              onChangeText={(t) =>
                setStandardMarksInput((p) => ({ ...p, [item.id]: t }))
              }
            />
          </View>
        </View>
      ) : (
        <View style={styles.responsesBox}>
          <Text style={styles.responseLabel}>DETAILED REVIEW</Text>
          {selectedAssignment?.questions?.map((q, idx) => (
            <View key={idx} style={styles.responseItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.qText}>
                  {idx + 1}. {q.text}
                </Text>
                <View style={styles.answerRow}>
                  <SVGIcon name="checkmark-circle" size={14} color="#10b981" />
                  <Text style={styles.aText}>
                    {item.responses?.[idx] || "No answer provided"}
                  </Text>
                </View>
              </View>
              <View style={styles.qScoreWrapper}>
                <Text style={styles.qScoreLabel}>SCORE</Text>
                <TextInput
                  style={styles.qScoreInput}
                  keyboardType="numeric"
                  placeholder="0"
                  value={qScoreInputs[item.id]?.[idx] || ""}
                  onChangeText={(t) => updateQScore(item.id, idx, t)}
                />
              </View>
            </View>
          ))}

          <View style={styles.totalSumRow}>
            <Text style={styles.totalSumText}>Total Calculated Score:</Text>
            <Text style={styles.totalSumValue}>{calculateTotal(item)}</Text>
          </View>
        </View>
      )}

      <View style={styles.feedbackSection}>
        <Text style={styles.label}>TEACHER'S FEEDBACK</Text>
        <TextInput
          style={styles.feedbackInput}
          placeholder="Add comments or feedback for the student/parent..."
          multiline
          value={feedbackInputs[item.id] || ""}
          onChangeText={(t) =>
            setFeedbackInputs((prev) => ({ ...prev, [item.id]: t }))
          }
        />
      </View>

      <TouchableOpacity
        style={[styles.saveSubmitBtn, { backgroundColor: COLORS.primary }]}
        onPress={() => submitMark(item)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[COLORS.primary, "#4F46E5"]}
          style={styles.btnGradient}
        >
          <SVGIcon name="checkmark-done-circle" size={18} color="#fff" />
          <Text style={styles.saveSubmitBtnText}>Submit Grade</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animatable.View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.headerArea}>
        <LinearGradient
          colors={[COLORS.primary, "#1E293B"]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <SVGIcon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Grading Center</Text>
          <SVGIcon name="library" size={24} color={COLORS.secondary} />
        </View>

        <Animatable.View animation="fadeInDown" style={styles.configCard}>
          <Text style={styles.sectionLabel}>GRADING CONFIGURATION</Text>

          <Text style={styles.label}>TARGET CLASS</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bubbleRow}
          >
            {availableClasses.map((cls) => (
              <TouchableOpacity
                key={cls.id}
                onPress={() => {
                  setSelectedClass(cls.id);
                  setSelectedAssignment(null);
                }}
                style={[
                  styles.bubble,
                  selectedClass === cls.id && {
                    backgroundColor: COLORS.primary,
                    borderColor: COLORS.primary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    selectedClass === cls.id && { color: "#fff" },
                  ]}
                >
                  {cls.name}
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
                onPress={() => {
                  setSelectedSubject(s);
                  setSelectedAssignment(null);
                }}
                style={[
                  styles.bubble,
                  selectedSubject === s && {
                    backgroundColor: COLORS.primary,
                    borderColor: COLORS.primary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    selectedSubject === s && { color: "#fff" },
                  ]}
                >
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>ASSIGNMENT TITLE</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bubbleRow}
          >
            {loading ? (
              <ActivityIndicator
                size="small"
                color={COLORS.primary}
                style={{ marginLeft: 10 }}
              />
            ) : assignments.length > 0 ? (
              assignments.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  onPress={() => setSelectedAssignment(a)}
                  style={[
                    styles.bubble,
                    selectedAssignment?.id === a.id && {
                      backgroundColor: COLORS.secondary,
                      borderColor: COLORS.secondary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.bubbleText,
                      selectedAssignment?.id === a.id && { color: "#fff" },
                    ]}
                  >
                    {a.title}
                  </Text>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.emptyHint}>No assignments found</Text>
            )}
          </ScrollView>
        </Animatable.View>
      </View>

      <FlatList
        data={submissions}
        keyExtractor={(item) => item.id}
        renderItem={renderSubmission}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={() => (
          <View style={styles.emptyBox}>
            {fetchingSubmissions ? (
              <ActivityIndicator size="large" color={COLORS.primary} />
            ) : (
              <Animatable.View animation="zoomIn" style={styles.emptyAnim}>
                <View style={styles.emptyIconCircle}>
                  <SVGIcon name="document-text" size={60} color="#CBD5E1" />
                </View>
                <Text style={styles.emptyTitle}>No Submissions Found</Text>
                <Text style={styles.emptyText}>
                  {!selectedAssignment
                    ? "Start by selecting a class, subject, and then choose an assignment title."
                    : "Excellent work! There are no unmarked submissions pending for this assignment."}
                </Text>
              </Animatable.View>
            )}
          </View>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  headerArea: {
    paddingBottom: 30,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    ...SHADOWS.medium,
    overflow: "hidden",
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 15,
    marginBottom: 20,
    zIndex: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 22, fontWeight: "900", color: "#fff" },
  configCard: {
    backgroundColor: "#fff",
    borderRadius: 25,
    padding: 20,
    marginHorizontal: 15,
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: COLORS.primary,
    letterSpacing: 1.5,
    marginBottom: 15,
    opacity: 0.8,
  },
  label: {
    fontSize: 9,
    fontWeight: "900",
    color: "#64748B",
    marginBottom: 6,
    marginTop: 10,
    textTransform: "uppercase",
  },
  bubbleRow: { paddingVertical: 5 },
  bubble: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#F1F5F9",
    backgroundColor: "#F8FAFC",
    marginRight: 10,
    ...SHADOWS.small,
  },
  bubbleText: { fontSize: 13, fontWeight: "800", color: "#64748B" },
  emptyHint: {
    fontSize: 12,
    color: "#94A3B8",
    fontStyle: "italic",
    marginLeft: 10,
    marginTop: 5,
  },
  listContent: { padding: 15, paddingBottom: 40 },
  subCard: {
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 22,
    marginBottom: 20,
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  subHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  studentInfo: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: { color: COLORS.primary, fontWeight: "900", fontSize: 18 },
  student: { fontSize: 17, fontWeight: "800", color: "#1E293B" },
  submissionDate: { fontSize: 11, color: "#94A3B8", marginTop: 2 },
  lateBadge: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  lateText: { fontSize: 10, color: "#EF4444", fontWeight: "900" },
  fileLink: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  fileIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  linkText: {
    color: COLORS.secondary,
    fontWeight: "800",
    fontSize: 14,
  },
  standardMarkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 15,
    borderTopWidth: 1.5,
    borderTopColor: "#F1F5F9",
    borderStyle: "dashed",
  },
  scoreLabelHeader: { fontSize: 15, fontWeight: "800", color: "#1E293B" },
  scoreSubLabel: { fontSize: 11, color: "#94A3B8", marginTop: 2 },
  totalInput: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    width: 90,
    padding: 12,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "900",
    color: COLORS.primary,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  responsesBox: { marginTop: 5 },
  responseLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#94A3B8",
    marginBottom: 15,
    letterSpacing: 1,
  },
  responseItem: {
    padding: 18,
    backgroundColor: "#F8FAFC",
    borderRadius: 20,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  qText: { fontSize: 14, color: "#1E293B", fontWeight: "700", marginBottom: 6 },
  answerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  aText: { fontSize: 13, color: "#64748B", flex: 1 },
  qScoreWrapper: { width: 65, alignItems: "center", marginLeft: 15 },
  qScoreLabel: {
    fontSize: 8,
    color: COLORS.primary,
    fontWeight: "900",
    marginBottom: 4,
  },
  qScoreInput: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    width: 55,
    padding: 8,
    textAlign: "center",
    fontWeight: "900",
    fontSize: 16,
    color: COLORS.primary,
  },
  totalSumRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 15,
    paddingHorizontal: 10,
  },
  totalSumText: { fontSize: 13, color: "#64748B", fontWeight: "700" },
  totalSumValue: {
    fontSize: 24,
    fontWeight: "900",
    color: COLORS.primary,
    marginLeft: 10,
  },
  feedbackSection: {
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  feedbackInput: {
    backgroundColor: "#F8FAFC",
    borderRadius: 15,
    padding: 15,
    fontSize: 14,
    color: "#1E293B",
    height: 80,
    textAlignVertical: "top",
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  saveSubmitBtn: {
    borderRadius: 20,
    marginTop: 20,
    overflow: "hidden",
    ...SHADOWS.medium,
  },
  btnGradient: {
    padding: 18,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  saveSubmitBtnText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: 0.5,
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyAnim: { alignItems: "center" },
  emptyIconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    ...SHADOWS.small,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1E293B",
    marginBottom: 10,
  },
  emptyText: {
    textAlign: "center",
    color: "#64748B",
    fontSize: 14,
    lineHeight: 22,
  },
});
