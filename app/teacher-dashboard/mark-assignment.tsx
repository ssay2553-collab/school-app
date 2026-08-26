import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Timestamp } from "firebase/firestore";
import moment from "moment";
import React, { useCallback, useEffect } from "react";
import {
  ActivityIndicator,
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
  BackHandler,
} from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useToast } from "../../contexts/ToastContext";
import { useMarkAssignment, Submission, Assignment } from "../../hooks/teacher-dashboard/useMarkAssignment";
import MathCanvas from "../../components/MathCanvas";
import { useRef } from "react";

/* ---------------- HELPERS ---------------- */

const formatDate = (ts: any) => {
  if (!ts) return "date unknown";
  try {
    if (typeof ts.toDate === "function") {
      return moment(ts.toDate()).format("DD MMM, YYYY");
    }
    if (ts instanceof Date) {
      return moment(ts).format("DD MMM, YYYY");
    }
    if (ts.seconds !== undefined) {
      return moment(ts.seconds * 1000).format("DD MMM, YYYY");
    }
  } catch (e) {
    return "invalid date";
  }
  return "date unknown";
};

/* ---------------- SUB-COMPONENT ---------------- */

const SubmissionItem = React.memo(({
  item,
  assignment,
  onMark,
  qScoreValue,
  standardMarkValue,
  feedbackValue,
  answerKey,
  onUpdateQScore,
  onUpdateStandardMark,
  onUpdateFeedback
}: {
  item: Submission;
  assignment: Assignment | null;
  onMark: (sub: Submission) => void;
  qScoreValue: Record<number, string>;
  standardMarkValue: string;
  feedbackValue: string;
  answerKey: any;
  onUpdateQScore: (subId: string, qIdx: number, text: string) => void;
  onUpdateStandardMark: (subId: string, text: string) => void;
  onUpdateFeedback: (subId: string, text: string) => void;
}) => {
  const { showToast } = useToast();
  const calculateTotal = () => {
    if (item.type === "preschool") return standardMarkValue || "0";
    return Object.values(qScoreValue || {}).reduce(
      (acc, curr) => acc + (Number(curr) || 0),
      0,
    );
  };

  const isInteractive = item.type === "mcq" || item.type === "short_answer" || item.type === "mathematics";
  const isDirectGrade = item.type === "preschool";

  return (
    <View style={styles.subCard}>
      <View style={styles.subHeader}>
        <View style={styles.studentInfo}>
          <View style={[styles.avatar, { backgroundColor: COLORS.primary + "15" }]}>
            <Text style={styles.avatarText}>
              {(item.studentName?.charAt(0) || "S").toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.student}>{item.studentName || "Student"}</Text>
            <Text style={styles.submissionDate}>
              {item.type === 'preschool' ? 'Preschool Activity' : 'Assignment'} • Submitted {formatDate(item.submittedAt)}
            </Text>
          </View>
        </View>
        {item.isLate && (
          <View style={styles.lateBadge}>
            <Text style={styles.lateText}>LATE</Text>
          </View>
        )}
      </View>

      {item.type === "preschool" && (
        <View style={[styles.responsesBox, { marginBottom: 20 }]}>
          <Text style={styles.responseLabel}>PRESCHOOL PERFORMANCE</Text>
          <Text style={{ fontSize: 13, color: '#64748B', marginBottom: 15, lineHeight: 20 }}>
            Review the child's interactive engagement below. Preschool activities are graded holistically.
          </Text>
          {assignment?.questions?.map((q: any, idx) => {
            const correctAnswer = answerKey?.answers?.find((a: any) => a.id === q.id || a.questionIndex === idx)?.answer;
            return (
              <View key={idx} style={[styles.responseItem, { backgroundColor: COLORS.primary + '05', borderColor: COLORS.primary + '10' }]}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <SVGIcon name={q.type ? (q.type.includes('identify') ? 'eye' : 'star') : 'star'} size={14} color={COLORS.primary} />
                    <Text style={[styles.qText, { marginBottom: 0 }]}>{q.text}</Text>
                  </View>
                  <View style={styles.answerRow}>
                    <Text style={[styles.aText, { fontWeight: '700', color: COLORS.secondary }]}>
                      Student: {item.responses?.[idx] || "Completed"}
                    </Text>
                  </View>
                  {correctAnswer && (
                    <View style={[styles.answerRow, { marginTop: 4 }]}>
                      <Text style={[styles.aText, { color: '#10b981', fontWeight: '600' }]}>
                        Correct: {correctAnswer}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {isInteractive && (
        <View style={styles.responsesBox}>
          <Text style={styles.responseLabel}>DETAILED REVIEW</Text>
          {assignment?.questions?.map((q: any, idx) => {
            const correctAnswer = answerKey?.answers?.find((a: any) => a.id === q.id || a.questionIndex === idx)?.answer;
            const response = item.responses?.[idx] ?? item.responses?.[String(idx)];

            // Logic for Mathematics
            const isMath = item.type === 'mathematics';
            let studentMathAnswer = null;
            if (isMath) {
              if (Array.isArray(response)) {
                studentMathAnswer = response;
              } else if (response && typeof response === 'object') {
                studentMathAnswer = response.answer || [];
              } else {
                studentMathAnswer = [{ type: 'text', value: String(response || ''), id: 'ans' }];
              }
            }

            const studentMathWorking = isMath && (response && typeof response === 'object' && !Array.isArray(response))
              ? response.working
              : null;

            // Logic for MCQ
            const isMCQ = item.type === 'mcq' || (item.type === 'mathematics' && q.options?.length > 0);
            const studentSelection = isMCQ ? (typeof response === 'object' ? response?.answer : response) : null;

            return (
              <View key={idx} style={styles.responseItemContainer}>
                <View style={styles.questionMain}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.qText}>{`${idx + 1}. ${q.text}`}</Text>

                    {/* Visual Group for Math Questions */}
                    {(q.visualGroup && q.visualGroup.length > 0) ? (
                      <View style={styles.visualGroupPreview}>
                        <MathCanvas visualGroup={q.visualGroup} onChange={() => {}} readOnly={true} minHeight={40} />
                      </View>
                    ) : null}

                    {/* MCQ Options Display */}
                    {(isMCQ && q.options) ? (
                      <View style={styles.optionsReviewList}>
                        {q.options.map((opt: string, oIdx: number) => {
                          const isSelected = studentSelection === opt;
                          const isCorrect = correctAnswer === opt;
                          return (
                            <View
                              key={oIdx}
                              style={[
                                styles.optionReviewItem,
                                isSelected && styles.optionSelected,
                                isCorrect && styles.optionCorrect,
                                isSelected && isCorrect && styles.optionPerfect
                              ]}
                            >
                              <View style={[styles.optionDot, isSelected && styles.dotSelected, isCorrect && styles.dotCorrect]} />
                              <Text style={[styles.optionReviewText, (isSelected || isCorrect) && styles.textBold]}>{opt}</Text>
                              {isSelected ? <Text style={styles.badgeSmall}>STUDENT</Text> : null}
                              {isCorrect ? <Text style={[styles.badgeSmall, { backgroundColor: '#10b981' }]}>KEY</Text> : null}
                            </View>
                          );
                        })}
                      </View>
                    ) : null}

                    {/* Short Answer / Standard Display */}
                    {(!isMCQ && !isMath) ? (
                      <View style={styles.textResponseBox}>
                        <Text style={styles.responseLabelMini}>STUDENT RESPONSE:</Text>
                        <Text style={styles.aTextLarge}>{response || "No answer provided"}</Text>
                      </View>
                    ) : null}

                    {/* Math Specific Display */}
                    {(isMath && !isMCQ) ? (
                      <View style={styles.mathResponseContainer}>
                         <Text style={styles.responseLabelMini}>STUDENT SOLUTION:</Text>
                         <MathCanvas
                            visualGroup={studentMathAnswer}
                            onChange={() => {}}
                            readOnly={true}
                            minHeight={60}
                            placeholder="No solution provided."
                          />
                      </View>
                    ) : null}

                    {/* Working Steps (Common for Math/Short Answer if enabled) */}
                    {studentMathWorking ? (
                      <View style={styles.workingReviewBox}>
                        <Text style={styles.responseLabelMini}>WORKING STEPS:</Text>
                        <MathCanvas
                          visualGroup={Array.isArray(studentMathWorking) ? studentMathWorking : [{ type: 'text', value: String(studentMathWorking), id: 'work' }]}
                          onChange={() => {}}
                          readOnly={true}
                          minHeight={80}
                          placeholder="No working steps provided."
                        />
                      </View>
                    ) : null}

                    {/* Correct Key for Non-MCQ */}
                    {(!isMCQ && correctAnswer) ? (
                      <View style={styles.keyReviewBox}>
                        <Text style={[styles.responseLabelMini, { color: '#059669' }]}>CORRECT / SAMPLE ANSWER:</Text>
                        <Text style={styles.keyText}>{correctAnswer}</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.qScoreWrapper}>
                    <Text style={styles.qScoreLabel}>SCORE</Text>
                    <TextInput
                      style={styles.qScoreInput}
                      keyboardType="numeric"
                      placeholder="0"
                      value={String(qScoreValue?.[idx] || "")}
                      onChangeText={(t) => onUpdateQScore(item.id, idx, t)}
                    />
                    <TouchableOpacity
                      style={styles.quickFullScore}
                      onPress={() => onUpdateQScore(item.id, idx, String(q.points || 1))}
                    >
                      <SVGIcon name="checkmark-circle" size={16} color={COLORS.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}

          <View style={styles.totalSumRow}>
            <View style={styles.totalStats}>
                <Text style={styles.totalSumText}>Total Points:</Text>
                <Text style={styles.totalSumValue}>{String(calculateTotal())}</Text>
            </View>
          </View>
        </View>
      )}

      {isDirectGrade && (
        <View style={styles.standardMarkRow}>
          <View>
            <Text style={styles.scoreLabelHeader}>Overall Performance</Text>
            <Text style={styles.scoreSubLabel}>Grade (0-100 or Points)</Text>
          </View>
          <TextInput
            style={styles.totalInput}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor="#94A3B8"
            value={standardMarkValue}
            onChangeText={(t) => onUpdateStandardMark(item.id, t)}
          />
        </View>
      )}

      <View style={styles.feedbackSection}>
        <Text style={styles.label}>TEACHER'S FEEDBACK</Text>
        <TextInput
          style={styles.feedbackInput}
          placeholder="Add comments or feedback for the student/parent..."
          multiline
          value={feedbackValue}
          onChangeText={(t) => onUpdateFeedback(item.id, t)}
        />
      </View>

      <TouchableOpacity
        style={[styles.saveSubmitBtn, { backgroundColor: COLORS.primary }]}
        onPress={() => onMark(item)}
        activeOpacity={0.8}
      >
        <LinearGradient colors={[COLORS.primary, "#4F46E5"]} style={styles.btnGradient}>
          <SVGIcon name="checkmark-done-circle" size={18} color="#fff" />
          <Text style={styles.saveSubmitBtnText}>Submit Grade</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
});

/* ---------------- SCREEN ---------------- */

export default function MarkAssignment() {
  const router = useRouter();
  const {
    availableClasses,
    selectedClass,
    setSelectedClass,
    selectedSubject,
    setSelectedSubject,
    assignments,
    selectedAssignment,
    setSelectedAssignment,
    submissions,
    qScoreInputs,
    standardMarksInput,
    feedbackInputs,
    answerKey,
    loading,
    refreshing,
    fetchingSubmissions,
    onRefresh,
    submitMark,
    updateQScore,
    updateStandardMark,
    updateFeedback,
    subjects,
  } = useMarkAssignment();
  const isNavigating = useRef(false);

  const handleBack = useCallback(() => {
    if (isNavigating.current) return true;
    isNavigating.current = true;
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/teacher-dashboard");
    }
    return true;
  }, [router]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", handleBack);
    return () => backHandler.remove();
  }, [handleBack]);

  const renderSubmission = useCallback(({ item }: { item: Submission }) => {
    if (item.type === "rich-text") {
      return (
        <View style={styles.subCard}>
          <View style={styles.subHeader}>
            <View style={styles.studentInfo}>
              <View style={[styles.avatar, { backgroundColor: COLORS.primary + "15" }]}>
                <Text style={styles.avatarText}>
                  {(item.studentName?.charAt(0) || "S").toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={styles.student}>{item.studentName || "Student"}</Text>
                <Text style={styles.submissionDate}>
                  Rich Text Submission • {formatDate(item.submittedAt)}
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.fileLink, { backgroundColor: COLORS.primary + "05", borderColor: COLORS.primary + "20" }]}
            onPress={() => {
              if (isNavigating.current) return;
              isNavigating.current = true;
              router.push({
                pathname: "/teacher-dashboard/review-document",
                params: { submissionId: item.id }
              });
              setTimeout(() => { isNavigating.current = false; }, 500);
            }}
          >
            <View style={[styles.fileIconBox, { backgroundColor: COLORS.primary + "15" }]}>
              <SVGIcon name="document-text" size={20} color={COLORS.primary} />
            </View>
            <Text style={[styles.linkText, { color: COLORS.primary }]}>Open & Review Rich Text</Text>
            <SVGIcon name="chevron-forward" size={16} color={COLORS.primary} style={{ marginLeft: "auto" }} />
          </TouchableOpacity>

          <Text style={{ fontSize: 12, color: "#64748B", fontStyle: "italic", textAlign: "center" }}>
            Review content, add comments, and grade in the document editor.
          </Text>
        </View>
      );
    }

    return (
      <SubmissionItem
        item={item}
        assignment={selectedAssignment}
        onMark={submitMark}
        qScoreValue={qScoreInputs[item.id]}
        standardMarkValue={standardMarksInput[item.id] || ""}
        feedbackValue={feedbackInputs[item.id] || ""}
        answerKey={answerKey}
        onUpdateQScore={updateQScore}
        onUpdateStandardMark={updateStandardMark}
        onUpdateFeedback={updateFeedback}
      />
    );
  }, [selectedAssignment, submitMark, qScoreInputs, standardMarksInput, feedbackInputs, answerKey, updateQScore, updateStandardMark, updateFeedback, router]);

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
            onPress={handleBack}
            style={styles.backBtn}
          >
            <SVGIcon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Grading Center</Text>
          <SVGIcon name="library" size={24} color={COLORS.secondary} />
        </View>
      </View>

      <FlatList
        ListHeaderComponent={
          <Animatable.View animation="fadeInDown" duration={500} style={styles.configCard}>
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
              {subjects.map((s: string) => (
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
                <Text style={[styles.emptyHint, { color: COLORS.secondary, fontWeight: '700' }]}>
                  {selectedSubject ? "No assignments found for this subject" : "Select a subject to view assignments"}
                </Text>
              )}
            </ScrollView>
          </Animatable.View>
        }
        data={submissions}
        keyExtractor={(item) => item.id}
        renderItem={renderSubmission}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={5}
        ListEmptyComponent={() => (
          <View style={styles.emptyBox}>
            {fetchingSubmissions ? (
              <ActivityIndicator size="large" color={COLORS.primary} />
            ) : (
              <Animatable.View animation="zoomIn" duration={500} style={styles.emptyAnim}>
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
    paddingBottom: 40,
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
    marginBottom: 0,
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
    marginTop: -30,
    marginBottom: 15,
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
    marginTop: 25,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  totalSumText: { fontSize: 13, color: "#64748B", fontWeight: "700" },
  totalSumValue: {
    fontSize: 28,
    fontWeight: "900",
    color: COLORS.primary,
    marginLeft: 12,
  },
  responseItemContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...SHADOWS.small,
  },
  questionMain: {
    padding: 20,
    flexDirection: 'row',
  },
  optionsReviewList: {
    marginTop: 15,
    gap: 8,
  },
  optionReviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  optionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '05',
  },
  optionCorrect: {
    borderColor: '#10b981',
    backgroundColor: '#10b981' + '05',
  },
  optionPerfect: {
    borderColor: '#10b981',
    backgroundColor: '#10b981' + '15',
  },
  optionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#CBD5E1',
  },
  dotSelected: { backgroundColor: COLORS.primary },
  dotCorrect: { backgroundColor: '#10b981' },
  optionReviewText: {
    fontSize: 13,
    color: '#475569',
    flex: 1,
  },
  textBold: { fontWeight: '700', color: '#1E293B' },
  badgeSmall: {
    fontSize: 8,
    fontWeight: '900',
    color: '#fff',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  textResponseBox: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  responseLabelMini: {
    fontSize: 9,
    fontWeight: '900',
    color: '#94A3B8',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  aTextLarge: {
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '600',
    lineHeight: 22,
  },
  mathResponseContainer: {
    marginTop: 15,
    gap: 8,
  },
  workingReviewBox: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  keyReviewBox: {
    marginTop: 15,
    padding: 12,
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  keyText: {
    fontSize: 14,
    color: '#065F46',
    fontWeight: '700',
  },
  visualGroupPreview: {
    marginTop: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  quickFullScore: {
    marginTop: 8,
    padding: 6,
    backgroundColor: COLORS.primary + '10',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#F1F5F9',
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
