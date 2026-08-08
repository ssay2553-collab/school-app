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
  onUpdateQScore: (subId: string, qIdx: number, text: string) => void;
  onUpdateStandardMark: (subId: string, text: string) => void;
  onUpdateFeedback: (subId: string, text: string) => void;
}) => {
  const { showToast } = useToast();
  const calculateTotal = () => {
    if (item.type === "standard") return standardMarkValue || "0";
    return Object.values(qScoreValue || {}).reduce(
      (acc, curr) => acc + (Number(curr) || 0),
      0,
    );
  };

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
              Submitted {formatDate(item.submittedAt)}
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
            onPress={() => {
              if (item.fileUrl) {
                Linking.openURL(item.fileUrl).catch(() => {
                  showToast({ message: "Could not open the submission file.", type: "error" });
                });
              }
            }}
          >
            <View style={[styles.fileIconBox, { backgroundColor: COLORS.secondary + "15" }]}>
              <SVGIcon name="document-text" size={20} color={COLORS.secondary} />
            </View>
            <Text style={styles.linkText}>View Submission File</Text>
            <SVGIcon name="chevron-forward" size={16} color={COLORS.secondary} style={{ marginLeft: "auto" }} />
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
              value={standardMarkValue}
              onChangeText={(t) => onUpdateStandardMark(item.id, t)}
            />
          </View>
        </View>
      ) : (
        <View style={styles.responsesBox}>
          <Text style={styles.responseLabel}>DETAILED REVIEW</Text>
          {assignment?.questions?.map((q, idx) => (
            <View key={idx} style={styles.responseItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.qText}>{idx + 1}. {q.text}</Text>
                <View style={styles.answerRow}>
                  <SVGIcon name="checkmark-circle" size={14} color="#10b981" />
                  <Text style={styles.aText}>{item.responses?.[idx] || "No answer provided"}</Text>
                </View>
              </View>
              <View style={styles.qScoreWrapper}>
                <Text style={styles.qScoreLabel}>SCORE</Text>
                <TextInput
                  style={styles.qScoreInput}
                  keyboardType="numeric"
                  placeholder="0"
                  value={qScoreValue?.[idx] || ""}
                  onChangeText={(t) => onUpdateQScore(item.id, idx, t)}
                />
              </View>
            </View>
          ))}

          <View style={styles.totalSumRow}>
            <Text style={styles.totalSumText}>Total Calculated Score:</Text>
            <Text style={styles.totalSumValue}>{calculateTotal()}</Text>
          </View>
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

  const handleBack = useCallback(() => {
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
            onPress={() => router.push({
              pathname: "/teacher-dashboard/review-document",
              params: { submissionId: item.id }
            })}
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
        onUpdateQScore={updateQScore}
        onUpdateStandardMark={updateStandardMark}
        onUpdateFeedback={updateFeedback}
      />
    );
  }, [selectedAssignment, submitMark, qScoreInputs, standardMarksInput, feedbackInputs, updateQScore, updateStandardMark, updateFeedback, router]);

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
                <Text style={styles.emptyHint}>No assignments found</Text>
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
