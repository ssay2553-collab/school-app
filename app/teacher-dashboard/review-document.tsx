import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  BackHandler,
} from "react-native";
import RichTextEditor, {
  RichTextEditorRef,
} from "../../components/RichTextEditor";
import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebaseConfig";
import { useCallback, useMemo } from "react";

import { useToast } from "../../contexts/ToastContext";

export default function ReviewDocument() {
  const { submissionId } = useLocalSearchParams();
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [submission, setSubmission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [marks, setMarks] = useState("");
  const [feedback, setFeedback] = useState("");
  const editorRef = useRef<RichTextEditorRef>(null);

  const hasUnsavedChanges = useMemo(() => {
    return marks !== (submission?.marks?.toString() || "") || feedback !== (submission?.feedback || "");
  }, [marks, feedback, submission]);

  const handleBack = useCallback(() => {
    if (hasUnsavedChanges) {
      Alert.alert(
        "Discard Changes?",
        "You have unsaved changes in your review. Are you sure you want to discard them?",
        [
          { text: "Keep Reviewing", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/teacher-dashboard");
              }
            },
          },
        ]
      );
      return true;
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/teacher-dashboard");
    }
    return true;
  }, [hasUnsavedChanges, router]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      handleBack
    );
    return () => backHandler.remove();
  }, [handleBack]);

  const handleRework = async () => {
    if (!feedback) {
      showToast({
        message: "Feedback Required: Please explain what needs correction.",
        type: "info",
      });
      return;
    }

    setSaving(true);
    try {
      const docRef = doc(db, "submissions", submissionId as string);
      const updatedContent = await editorRef.current?.getHTML();

      await updateDoc(docRef, {
        feedback,
        status: "rework",
        marked: false,
        contentHtml: updatedContent || submission.contentHtml,
        updatedAt: serverTimestamp(),
      });

      showToast({
        message: "Rework Sent: Student has been asked to revise.",
        type: "success",
      });
      router.back();
    } catch (error) {
      console.error(error);
      showToast({
        message: "Error: Failed to request rework.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const fetchSubmission = async () => {
      if (!submissionId) return;
      try {
        const docRef = doc(db, "submissions", submissionId as string);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSubmission(data);
          setMarks(data.marks?.toString() || "");
          setFeedback(data.feedback || "");
        } else {
          showToast({
            message: "Error: Submission not found",
            type: "error",
          });
          router.back();
        }
      } catch (error) {
        console.error("Error fetching submission:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubmission();
  }, [submissionId]);

  const handleSaveGrade = async () => {
    if (!marks || isNaN(Number(marks))) {
      showToast({
        message: "Invalid Marks: Please enter a numeric value for marks.",
        type: "info",
      });
      return;
    }

    setSaving(true);
    try {
      const docRef = doc(db, "submissions", submissionId as string);
      const updatedContent = await editorRef.current?.getHTML();

      await updateDoc(docRef, {
        marks: Number(marks),
        feedback,
        marked: true,
        status: "graded",
        markedAt: serverTimestamp(),
        contentHtml: updatedContent || submission.contentHtml,
      });

      // Notify parent/student
      if (submission.studentId) {
        const studentSnap = await getDoc(
          doc(db, "users", submission.studentId),
        );
        if (studentSnap.exists()) {
          const studentData = studentSnap.data() as any;
          const parentUids = studentData.parentUids || [];
          for (const pUid of parentUids) {
            await addDoc(collection(db, "notifications"), {
              recipientId: pUid,
              title: "Assignment Graded",
              body: `${submission.studentName}'s ${submission.noteTitle || "work"} has been graded: ${marks} marks.`,
              type: "grade",
              timestamp: serverTimestamp(),
              studentId: submission.studentId,
              read: false,
            });
          }
        }
      }

      showToast({
        message: "Success: Grade and feedback saved successfully!",
        type: "success",
      });
      router.back();
    } catch (error) {
      console.error("Error saving grade:", error);
      showToast({
        message: "Error: Failed to save grade.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
        >
          <SVGIcon name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review Submission</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.infoCard}>
          <Text style={styles.studentName}>{submission?.studentName}</Text>
          <Text style={styles.assignmentTitle}>
            {submission?.noteTitle || "Untitled Note"}
          </Text>
          <Text style={styles.subjectText}>
            {submission?.subjectId || "Rich Text Submission"}
          </Text>
        </View>

        <View style={styles.editorContainer}>
          <Text style={styles.sectionLabel}>DOCUMENT CONTENT</Text>
          <View style={styles.editorInnerWrapper}>
            <RichTextEditor
              ref={editorRef}
              initialContent={submission?.contentHtml}
              enableTeacherTools={true}
            />
          </View>
          <Text style={{ fontSize: 11, color: "#64748B", marginTop: 10, fontStyle: 'italic' }}>
            💡 Select text to highlight or add comments. Corrections are saved when you complete the review.
          </Text>
        </View>

        <View style={styles.gradingCard}>
          <Text style={styles.sectionLabel}>GRADING & FEEDBACK</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Marks Scored</Text>
            <TextInput
              style={styles.marksInput}
              value={marks}
              onChangeText={setMarks}
              keyboardType="numeric"
              placeholder="0"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Teacher's Feedback</Text>
            <TextInput
              style={styles.feedbackInput}
              value={feedback}
              onChangeText={setFeedback}
              multiline
              placeholder="Write your comments here..."
            />
          </View>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveGrade}
            disabled={saving}
          >
            <LinearGradient
              colors={[COLORS.primary, "#4F46E5"]}
              style={styles.gradient}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <SVGIcon name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.saveButtonText}>Complete Review</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveButton, { marginTop: 10, opacity: saving ? 0.6 : 1 }]}
            onPress={handleRework}
            disabled={saving}
          >
            <LinearGradient colors={["#f59e0b", "#d97706"]} style={styles.gradient}>
              <SVGIcon name="refresh" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Request Rework</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 50 : 20,
    paddingBottom: 15,
    backgroundColor: "#fff",
    ...SHADOWS.small,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1E293B",
  },
  scrollContent: {
    padding: 20,
  },
  infoCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
    ...SHADOWS.small,
  },
  studentName: {
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.primary,
  },
  assignmentTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    marginTop: 4,
  },
  subjectText: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "600",
  },
  editorContainer: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 15,
    marginBottom: 20,
    ...SHADOWS.small,
  },
  editorInnerWrapper: {
    minHeight: Platform.OS === "web" ? 700 : 500,
    maxHeight: Platform.OS === "web" ? 1200 : 600,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    overflow: "hidden",
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#94A3B8",
    letterSpacing: 1.5,
    marginBottom: 15,
  },
  gradingCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 20,
    marginBottom: 30,
    ...SHADOWS.small,
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 8,
  },
  marksInput: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 12,
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.primary,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  feedbackInput: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: "#1E293B",
    minHeight: 100,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  saveButton: {
    marginTop: 10,
    borderRadius: 15,
    overflow: "hidden",
  },
  gradient: {
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
});
