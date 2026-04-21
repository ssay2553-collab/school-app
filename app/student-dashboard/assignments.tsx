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

interface Question {
  text: string;
  options?: string[];
}

interface Assignment {
  id: string;
  title: string;
  subjectId: string;
  classId: string;
  type: "standard" | "mcq" | "short_answer";
  description?: string;
  fileUrl?: string;
  fileName?: string;
  teacherId: string;
  code: string;
  createdAt: Timestamp;
  dueDate?: Timestamp;
  questions?: Question[];
}

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
  const [answers, setAnswers] = useState<Record<number, string>>({});

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

  const handleUpdateAnswer = useCallback((qIdx: number, val: string) => {
    setAnswers((prev) => ({ ...prev, [qIdx]: val }));
  }, []);

  const handleSubmitResponses = async () => {
    if (!activeAssignment || !appUser) return;

    const questionCount = activeAssignment.questions?.length || 0;
    if (
      activeAssignment.questions &&
      Object.keys(answers).length < questionCount
    ) {
      return showToast({
        message: "Please answer all questions before submitting.",
        type: "warning"
      });
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
        type: activeAssignment.type || "standard",
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
      return ts.toDate().toLocaleDateString();
    } catch (e) {
      return "Soon";
    }
  };

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    showToast({ message: "Assignment code copied to clipboard!", type: "success" });
  };

  const renderAssignmentItem = ({ item, index }: { item: Assignment, index: number }) => {
    const assignmentType = item.type || "standard";

    return (
      <Animatable.View animation="fadeInUp" delay={index * 100} style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.title}>{item.title}</Text>
          <View style={[styles.typeBadge, { backgroundColor: assignmentType === 'standard' ? '#EEF2FF' : '#F0FDF4' }]}>
            <Text style={[styles.typeText, { color: assignmentType === 'standard' ? '#4F46E5' : '#10B981' }]}>
              {assignmentType.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.detailsRow}>
          <View style={styles.infoRow}>
            <SVGIcon name="library" size={14} color={COLORS.primary} />
            <Text style={styles.infoText}>{item.subjectId}</Text>
          </View>
          <View style={styles.infoRow}>
            <SVGIcon name="calendar" size={14} color="#94A3B8" />
            <Text style={styles.infoText}>Due: {formatDate(item.dueDate)}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: assignmentType === "standard" ? COLORS.primary : COLORS.secondary }]}
          onPress={() => assignmentType === "standard" ? setViewingDetails(item) : handleStartAssignment(item)}
        >
          <Text style={styles.actionButtonText}>
            {assignmentType === "standard" ? "View & Download" : "Start Now"}
          </Text>
          <SVGIcon name="arrow-forward" size={16} color="#fff" />
        </TouchableOpacity>
      </Animatable.View>
    );
  };

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
                <SVGIcon name="checkmark-done-circle" size={60} color="#CBD5E1" />
              </View>
              <Text style={styles.emptyText}>All caught up! No pending assignments.</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* VIEW STANDARD ASSIGNMENT DETAILS MODAL */}
      <Modal visible={!!viewingDetails} animationType="fade" transparent onRequestClose={() => setViewingDetails(null)}>
        <View style={styles.overlay}>
          <View style={styles.detailsModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{viewingDetails?.title}</Text>
              <TouchableOpacity onPress={() => setViewingDetails(null)}>
                <SVGIcon name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionLabel}>Instructions:</Text>
              <Text style={styles.detailsDescription}>
                {viewingDetails?.description || "No description provided."}
              </Text>

              {viewingDetails?.fileUrl && (
                <View style={styles.attachmentBox}>
                  <Text style={styles.sectionLabel}>Resources:</Text>
                  <TouchableOpacity
                    style={styles.downloadBtn}
                    onPress={() => Linking.openURL(viewingDetails.fileUrl!)}
                  >
                    <SVGIcon name="cloud-upload" size={18} color="#fff" />
                    <Text style={styles.downloadBtnText}>Download Study File</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>

            <View style={styles.detailsFooter}>
              <TouchableOpacity
                style={styles.tipBox}
                onPress={() => copyToClipboard(viewingDetails?.code || "")}
                activeOpacity={0.7}
              >
                <SVGIcon name="information-circle" size={16} color={COLORS.primary} />
                <Text style={styles.tipText}>Use code <Text style={{fontWeight: '900'}}>{viewingDetails?.code}</Text> to submit (Tap to copy).</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setViewingDetails(null)}>
                <Text style={styles.closeBtnText}>I'll start now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* DO INTERACTIVE ASSIGNMENT MODAL */}
      <Modal visible={!!activeAssignment} animationType="slide" onRequestClose={() => setActiveAssignment(null)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeaderInner}>
            <Text style={styles.modalTitleInner}>{activeAssignment?.title}</Text>
            <TouchableOpacity onPress={() => setActiveAssignment(null)} style={styles.modalCloseBtn}>
              <SVGIcon name="close" size={24} color="#1E293B" />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={handleSubmitResponses}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Text style={styles.submitBtnText}>Submit Assignment</Text>
                  <SVGIcon name="checkmark-done-circle" size={20} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const QuestionResponseItem = memo(({
  q,
  qIdx,
  type,
  answer,
  setAnswer
}: {
  q: Question;
  qIdx: number;
  type: string;
  answer: string;
  setAnswer: (val: string) => void;
}) => {
  return (
    <View style={styles.questionBox}>
      <Text style={styles.questionText}>{qIdx + 1}. {q.text}</Text>
      {type === "mcq" ? (
        <View style={styles.optionsList}>
          {q.options?.map((opt, oIdx) => (
            <TouchableOpacity
              key={oIdx}
              style={[styles.optionBtn, answer === opt && styles.optionBtnSelected]}
              onPress={() => setAnswer(opt)}
            >
              <View style={[styles.radio, answer === opt && styles.radioSelected]} />
              <Text style={[styles.optionLabel, answer === opt && styles.optionLabelSelected]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <TextInput
          style={styles.answerInput}
          placeholder="Type your answer here..."
          placeholderTextColor="#94A3B8"
          multiline
          value={answer || ""}
          onChangeText={setAnswer}
        />
      )}
    </View>
  );
});

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
  questionBox: { marginBottom: 25, backgroundColor: '#F8FAFC', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  questionText: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginBottom: 15 },
  optionsList: { gap: 12 },
  optionBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  optionBtnSelected: { borderColor: COLORS.secondary, backgroundColor: COLORS.secondary + '05' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#CBD5E1' },
  radioSelected: { borderColor: COLORS.secondary, backgroundColor: COLORS.secondary },
  optionLabel: { fontSize: 14, color: '#475569', fontWeight: '600' },
  optionLabelSelected: { color: COLORS.secondary, fontWeight: '800' },
  answerInput: { backgroundColor: '#fff', borderRadius: 12, padding: 15, fontSize: 15, minHeight: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: '#E2E8F0' },
  modalFooterInner: { padding: 20, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  submitBtn: { backgroundColor: COLORS.secondary, padding: 18, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' }
});
