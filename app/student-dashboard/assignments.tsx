import {
    addDoc,
    collection,
    getDocs,
    query,
    serverTimestamp,
    Timestamp,
    where,
} from "firebase/firestore";
import React, { useCallback, useEffect, useState, memo } from "react";
import moment from "moment";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Linking,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    SafeAreaView,
    StatusBar,
    RefreshControl,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebaseConfig";
import SVGIcon from "../../components/SVGIcon";
import { useRouter } from "expo-router";
import * as Animatable from "react-native-animatable";
import * as Clipboard from "expo-clipboard";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";
import { useToast } from "../../contexts/ToastContext";
import { Assignment, Question, VisualItem } from "../../types/assignments";
import QuestionResponseItem from "../../components/student-dashboard/assignments/QuestionResponseItem";
import AssignmentCard from "../../components/student-dashboard/assignments/AssignmentCard";

export default function Assignments() {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(null);
  const [viewingDetails, setViewingDetails] = useState<Assignment | null>(null);
  const [answers, setAnswers] = useState<Record<number, any>>({});

  const fetchAssignments = useCallback(async (isRefreshing = false) => {
    const studentClassId = appUser?.classId;
    if (!studentClassId || !appUser?.uid) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (!isRefreshing) setLoading(true);
    try {
      const q = query(
        collection(db, "assignments"),
        where("classId", "==", studentClassId),
      );
      const snapshot = await getDocs(q);
      const allAssignments = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as any),
      })) as Assignment[];

      const subQ = query(
        collection(db, "submissions"),
        where("studentId", "==", appUser.uid),
      );
      const subSnapshot = await getDocs(subQ);
      const submittedAssignmentIds = subSnapshot.docs.map(
        (doc) => (doc.data() as any).assignmentId,
      );

      const pendingAssignments = allAssignments.filter(
        (assignment) => !submittedAssignmentIds.includes(assignment.id),
      );

      // Sort by newest first
      setAssignments(pendingAssignments.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
    } catch (error: any) {
      console.error("Fetch Assignments Error:", error);
      showToast({ message: "Failed to load assignments.", type: "error" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [appUser?.classId, appUser?.uid]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAssignments(true);
  };

  const handleStartAssignment = (item: Assignment) => {
    setActiveAssignment(item);
    setAnswers({});
  };

  const handleUpdateAnswer = useCallback((qIdx: number, val: any) => {
    setAnswers((prev) => ({ ...prev, [qIdx]: val }));
  }, []);

  const handleSubmitResponses = async () => {
    if (!activeAssignment || !appUser) return;

    const questionCount = activeAssignment.questions?.length || 0;
    const isPreschool = activeAssignment.type === "preschool";
    const isMathematics = activeAssignment.type === "mathematics";

    if (!isPreschool && activeAssignment.questions) {
      const answeredCount = Object.keys(answers).length;

      let allAnswered = answeredCount === questionCount;

      // Deep check for math answers
      if (allAnswered && isMathematics) {
        for (let i = 0; i < questionCount; i++) {
          const ans = answers[i];
          const mathAns = typeof ans === 'object' && !Array.isArray(ans) ? ans.answer : ans;
          if (!mathAns || (Array.isArray(mathAns) && mathAns.length === 0)) {
            allAnswered = false;
            break;
          }
        }
      }

      if (!allAnswered) {
        return showToast({
          message: "Please answer all questions before submitting.",
          type: "warning",
        });
      }
    }

    setSubmitting(true);
    try {
      const studentName = `${appUser.profile?.firstName || 'Student'} ${appUser.profile?.lastName || ''}`.trim();
      
      const submissionData = {
        submissionKey: `${activeAssignment.id}_${appUser.uid}`,
        assignmentId: activeAssignment.id,
        assignmentTitle: activeAssignment.title,
        assignmentCode: activeAssignment.code,
        studentId: appUser.uid,
        studentName,
        type: activeAssignment.type,
        classId: activeAssignment.classId,
        subjectId: activeAssignment.subjectId,
        teacherId: activeAssignment.teacherId,
        responses: answers,
        contentHtml: null,
        fileUrl: null,
        fileName: null,
        isLate: false,
        marked: false,
        submittedAt: serverTimestamp(),
      };

      await addDoc(collection(db, "submissions"), submissionData);
      showToast({
        message: "Your assignment has been submitted successfully!",
        type: "success"
      });
      setActiveAssignment(null);
      fetchAssignments();
    } catch (error: any) {
      showToast({ message: error.message || "Failed to submit assignment", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (ts?: Timestamp) => {
    if (!ts) return "Soon";
    try {
      return moment(ts.toDate()).format("MMM DD, YYYY");
    } catch (e) {
      return "Soon";
    }
  };

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    showToast({ message: "Assignment code copied to clipboard!", type: "success" });
  };

  const renderAssignmentItem = ({ item, index }: { item: Assignment, index: number }) => (
    <AssignmentCard item={item} index={index} onStart={handleStartAssignment} />
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <SVGIcon name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Assignments 📚</Text>
          <Text style={styles.headerSubtitle}>Your pending tasks</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <FlatList
          data={assignments}
          keyExtractor={(item) => item.id}
          renderItem={renderAssignmentItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <SVGIcon name="checkmark-seal" size={60} color="#CBD5E1" />
              </View>
              <Text style={styles.emptyText}>
                All caught up! No pending assignments.
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* VIEW STANDARD ASSIGNMENT DETAILS MODAL - REMOVED STANDARD TYPE */}

      {/* DO INTERACTIVE ASSIGNMENT MODAL */}
      <Modal visible={!!activeAssignment} animationType="slide" onRequestClose={() => setActiveAssignment(null)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeaderInner}>
            <Text style={[styles.modalTitleInner, activeAssignment?.type === 'preschool' && { fontSize: 24 }]}>{activeAssignment?.title}</Text>
            <TouchableOpacity onPress={() => setActiveAssignment(null)} style={styles.modalCloseBtn}>
              <SVGIcon name="close" size={activeAssignment?.type === 'preschool' ? 32 : 24} color="#1E293B" />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {activeAssignment?.description ? (
                <View style={[
                  styles.assignmentDescriptionBox,
                  activeAssignment?.type === 'preschool' ? { padding: 20 } : { padding: 12, backgroundColor: '#F8FAFC' }
                ]}>
                  <Text style={[
                    styles.assignmentDescriptionText,
                    activeAssignment?.type === 'preschool' ? { fontSize: 20, fontWeight: '800', color: COLORS.primary, lineHeight: 28 } : { fontSize: 14, color: '#475569', fontWeight: '600' }
                  ]}>{activeAssignment.description}</Text>
                </View>
              ) : null}
              {activeAssignment?.questions?.map((q, qIdx) => (
                <QuestionResponseItem
                  key={qIdx}
                  q={q}
                  qIdx={qIdx}
                  type={activeAssignment.type}
                  answer={answers[qIdx]}
                  setAnswer={(val) => handleUpdateAnswer(qIdx, val)}
                />
              ))}
            </ScrollView>
          </KeyboardAvoidingView>

          <View style={styles.modalFooterInner}>
            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.7 }, activeAssignment?.type === 'preschool' && { padding: 22 }]}
              onPress={handleSubmitResponses}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Text style={[styles.submitBtnText, activeAssignment?.type === 'preschool' && { fontSize: 20 }]}>Submit Assignment</Text>
                  <SVGIcon name="checkmark-done-circle" size={activeAssignment?.type === 'preschool' ? 28 : 20} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { padding: 20, flexDirection: 'row', alignItems: 'center', gap: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#1E293B' },
  headerSubtitle: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { padding: 20, paddingBottom: 100 },
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 20, marginBottom: 15, ...SHADOWS.small, borderWidth: 1, borderColor: '#F1F5F9' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '800', color: '#1E293B', flex: 1, marginRight: 10 },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  typeText: { fontSize: 10, fontWeight: '900' },
  detailsRow: { flexDirection: 'row', gap: 20, marginBottom: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 14, gap: 10 },
  actionButtonText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyIconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyText: { color: '#94A3B8', fontWeight: '600', fontSize: 15, textAlign: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  detailsModal: { backgroundColor: '#fff', borderRadius: 25, padding: 25, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#1E293B' },
  sectionLabel: { fontSize: 14, fontWeight: '800', color: COLORS.primary, marginBottom: 10, marginTop: 5 },
  detailsDescription: { fontSize: 15, color: '#475569', lineHeight: 22, marginBottom: 20 },
  attachmentBox: { backgroundColor: '#F8FAFC', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#E2E8F0' },
  downloadBtn: { backgroundColor: COLORS.secondary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, gap: 8, marginTop: 5 },
  downloadBtnText: { color: '#fff', fontWeight: '800' },
  detailsFooter: { marginTop: 20, gap: 15 },
  tipBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EEF2FF', padding: 12, borderRadius: 10 },
  tipText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  closeBtn: { backgroundColor: '#1E293B', padding: 16, borderRadius: 15, alignItems: 'center' },
  closeBtnText: { color: '#fff', fontWeight: '800' },
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeaderInner: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalTitleInner: { fontSize: 18, fontWeight: '900', color: '#1E293B', flex: 1 },
  modalCloseBtn: { padding: 5 },
  modalScroll: { padding: 20 },
  assignmentDescriptionBox: {
    backgroundColor: '#EEF2FF',
    padding: 15,
    borderRadius: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.primary + '20',
  },
  assignmentDescriptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    lineHeight: 22,
  },
  modalFooterInner: { padding: 20, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  submitBtn: { backgroundColor: COLORS.secondary, padding: 18, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' }
});
