import { useLocalSearchParams, useRouter } from "expo-router";
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import React, { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { COLORS, SHADOWS } from "../../constants/theme";
import { auth, db } from "../../firebaseConfig";
import { sendNotification } from "../../src/services/notificationService";
import * as Animatable from "react-native-animatable";
import { useToast } from "../../contexts/ToastContext";

export default function SubmitNote() {
  const router = useRouter();
  const { showToast } = useToast();
  const { prefillNoteId, prefillTitle, prefillContent } = useLocalSearchParams();

  const [assignmentCode, setAssignmentCode] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const primary = SCHOOL_CONFIG.primaryColor;

  const studentId = auth.currentUser?.uid;

  const goToNotes = () => {
    router.push("/student-dashboard/note");
  };

  const handleSubmit = async () => {
    if (!assignmentCode.trim() || !prefillNoteId || !studentId) {
      showToast({ message: "Assignment code and a note attachment are required.", type: "error" });
      return;
    }

    setLoading(true);

    try {
      // 1. Verify Assignment Code
      const q = query(
        collection(db, "assignments"),
        where("code", "==", assignmentCode.trim().toUpperCase())
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        setLoading(false);
        showToast({ message: "Invalid assignment code. Please check and try again.", type: "error" });
        return;
      }

      const assignmentDoc = snap.docs[0];
      const assignmentId = assignmentDoc.id;
      const assignmentData = assignmentDoc.data() as any;

      // 2. Prepare submission data
      const submissionData: any = {
        assignmentId,
        studentId,
        studentName: auth.currentUser?.displayName || "Student",
        submittedAt: serverTimestamp(),
        status: "submitted",
        note: comment, // Using 'note' field for teacher comment to maintain compatibility with existing submission structure
        assignmentTitle: assignmentData.title,
        type: "rich-text",
        contentHtml: prefillContent,
        noteId: prefillNoteId,
        marked: false,
      };

      // 3. Save Submission
      await addDoc(collection(db, "submissions"), submissionData);

      // 4. Notify Teacher
      if (assignmentData.teacherId) {
        await sendNotification({
          recipientId: assignmentData.teacherId,
          senderId: studentId,
          senderName: submissionData.studentName,
          type: "submission",
          title: "New Note Submission",
          body: `${submissionData.studentName} submitted a note for ${assignmentData.title}`,
          data: { assignmentId, studentId }
        });
      }

      setShowSuccess(true);

      setTimeout(() => {
        router.replace("/student-dashboard");
      }, 3000);

    } catch (error) {
      console.error("Submission error:", error);
      showToast({ message: "Failed to submit note. Please check your connection.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <SVGIcon name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.title}>Submit Note</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.label}>Assignment Code</Text>
          <TextInput
            style={styles.input}
            placeholder="ENTER CODE (e.g. MATH-101)"
            value={assignmentCode}
            onChangeText={(t) => setAssignmentCode(t.toUpperCase())}
            autoCapitalize="characters"
          />

          <Text style={styles.label}>Selected Note</Text>

          {prefillNoteId ? (
            <View style={styles.noteBox}>
              <View style={styles.noteHeader}>
                <SVGIcon name="document-text" size={20} color={primary} />
                <Text style={styles.noteTitle}>{prefillTitle || "Attached Note"}</Text>
              </View>
              <Text style={styles.noteSubtitle}>This note will be submitted as your work.</Text>
              <TouchableOpacity onPress={() => router.setParams({ prefillNoteId: "", prefillTitle: "", prefillContent: "" })}>
                <Text style={{color: COLORS.error, fontSize: 12, fontWeight: '700', marginTop: 10}}>Remove Attachment</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.uploadOptions}>
              <TouchableOpacity style={[styles.noteBtn, {borderColor: primary}]} onPress={goToNotes}>
                <SVGIcon name="journal-outline" size={24} color={primary} />
                <Text style={[styles.noteBtnText, {color: primary}]}>Attach from My Notes</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={[styles.label, { marginTop: 20 }]}>Comment (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Add a comment for your teacher..."
            multiline
            numberOfLines={4}
            value={comment}
            onChangeText={setComment}
          />

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: primary }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <SVGIcon name="send-outline" size={20} color="#fff" />
                <Text style={styles.submitBtnText}>Submit Note</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Success Animation Modal */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={styles.successOverlay}>
          <Animatable.View
            animation="zoomIn"
            duration={1000}
            style={styles.successCircle}
          >
            <Animatable.View
              animation="rotate"
              iterationCount="infinite"
              duration={4000}
              easing="linear"
              style={styles.successRing}
            />
            <SVGIcon name="checkmark-circle" size={100} color="#fff" />
          </Animatable.View>

          <Animatable.View
            animation="fadeInUp"
            delay={500}
            style={{ alignItems: 'center' }}
          >
            <Text style={styles.successTitle}>Note Submitted!</Text>
            <Text style={styles.successSubtitle}>Your note has been sent to your teacher.</Text>

            <View style={styles.xpBadge}>
              <Text style={styles.xpText}>+20 XP Collected</Text>
            </View>
          </Animatable.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  successOverlay: {
    flex: 1,
    backgroundColor: "rgba(30, 41, 59, 0.95)",
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  successCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 40,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15,
  },
  successRing: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 4,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderStyle: 'dashed',
  },
  successTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#fff",
    textAlign: "center",
    marginBottom: 10,
  },
  successSubtitle: {
    fontSize: 16,
    color: "#CBD5E1",
    textAlign: "center",
    fontWeight: "600",
    lineHeight: 24,
  },
  xpBadge: {
    marginTop: 30,
    backgroundColor: "#F59E0B",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 100,
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  xpText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 14,
    textTransform: "uppercase",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  title: { fontSize: 20, fontWeight: "900", color: "#1E293B" },
  content: { padding: 20 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    ...SHADOWS.medium,
  },
  label: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748B",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: "#F1F5F9",
    borderRadius: 16,
    padding: 15,
    fontSize: 16,
    color: "#1E293B",
    fontWeight: "600",
    marginBottom: 20,
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  uploadOptions: {
    alignItems: 'center',
    gap: 15,
  },
  noteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 55,
    borderRadius: 16,
    borderWidth: 2,
    gap: 10,
  },
  noteBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
  noteBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    padding: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 5,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
  },
  noteSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  submitBtn: {
    height: 55,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
    ...SHADOWS.medium,
  },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
