import * as DocumentPicker from "expo-document-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import {
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { COLORS, SHADOWS, SIZES } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { auth, db, storage } from "../../firebaseConfig";

export default function SubmitAssignment() {
  const router = useRouter();
  const { showToast } = useToast();
  const { prefillNoteId, prefillTitle, prefillContent } = useLocalSearchParams();

  const [assignmentCode, setAssignmentCode] = useState("");
  const [note, setNote] = useState(prefillTitle ? `Attached Note: ${prefillTitle}` : "");
  const [file, setFile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  const primary = SCHOOL_CONFIG.primaryColor;
  const surface = SCHOOL_CONFIG.surfaceColor;

  const studentId = auth.currentUser?.uid;

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "image/*",
          "video/mp4",
        ],
      });

      if (result.canceled) return;

      const picked = result.assets[0];
      setFile(picked);
    } catch (error) {
      console.log("Error picking file", error);
      showToast({ message: "Error picking file", type: "error" });
    }
  };

  const goToNotes = () => {
    router.push("/student-dashboard/note");
  };

  const handleSubmit = async () => {
    if (!assignmentCode.trim() || (!file && !prefillNoteId) || !studentId) {
      showToast({ message: "Assignment code and a submission (file or note) are required.", type: "error" });
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

      // 2. Handle Upload or Rich-Text submission
      let submissionData: any = {
        assignmentId,
        studentId,
        schoolId: SCHOOL_CONFIG.schoolId,
        studentName: auth.currentUser?.displayName || "Student",
        submittedAt: serverTimestamp(),
        status: "submitted",
        note: note,
        assignmentTitle: assignmentData.title,
      };

      if (prefillNoteId && prefillContent) {
        // Rich Text Note submission
        submissionData.type = "rich-text";
        submissionData.contentHtml = prefillContent;
        submissionData.noteId = prefillNoteId;
      } else if (file) {
        // File submission
        const response = await fetch(file.uri);
        const blob = await response.blob();
        const fileRef = ref(storage, `submissions/${assignmentId}/${studentId}_${Date.now()}`);
        await uploadBytes(fileRef, blob);
        const fileUrl = await getDownloadURL(fileRef);

        submissionData.type = "file";
        submissionData.fileUrl = fileUrl;
        submissionData.fileName = file.name;
      }

      // 3. Save Submission
      await addDoc(collection(db, "submissions"), submissionData);

      showToast({ message: "Assignment submitted successfully!", type: "success" });

      // Give the user a moment to see the success message before redirecting
      setTimeout(() => {
        router.replace("/student-dashboard");
      }, 1500);

    } catch (error) {
      console.error("Submission error:", error);
      showToast({ message: "Failed to submit assignment. Please check your connection.", type: "error" });
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
        <Text style={styles.title}>Submit Assignment</Text>
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

          <Text style={styles.label}>Submission Type</Text>

          {prefillNoteId ? (
            <View style={styles.noteBox}>
              <View style={styles.noteHeader}>
                <SVGIcon name="document-text" size={20} color={primary} />
                <Text style={styles.noteTitle}>{prefillTitle || "Attached Note"}</Text>
              </View>
              <Text style={styles.noteSubtitle}>Note content will be submitted as your assignment.</Text>
              <TouchableOpacity onPress={() => router.setParams({ prefillNoteId: "", prefillTitle: "", prefillContent: "" })}>
                <Text style={{color: COLORS.error, fontSize: 12, fontWeight: '700', marginTop: 10}}>Remove Note Attachment</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.uploadOptions}>
              <TouchableOpacity style={styles.uploadBtn} onPress={pickFile}>
                <SVGIcon name="cloud-upload-outline" size={32} color={primary} />
                <Text style={styles.uploadText}>{file ? file.name : "Select File"}</Text>
              </TouchableOpacity>

              <Text style={styles.orText}>OR</Text>

              <TouchableOpacity style={[styles.noteBtn, {borderColor: primary}]} onPress={goToNotes}>
                <SVGIcon name="journal-outline" size={24} color={primary} />
                <Text style={[styles.noteBtnText, {color: primary}]}>Attach from Notes</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={[styles.label, { marginTop: 20 }]}>Comment (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Add a comment to your teacher..."
            multiline
            numberOfLines={4}
            value={note}
            onChangeText={setNote}
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
                <Text style={styles.submitBtnText}>Submit Assignment</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
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
  uploadBtn: {
    width: '100%',
    height: 120,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  uploadText: {
    marginTop: 10,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '700',
  },
  orText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
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
  messageBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    gap: 12,
    borderWidth: 1,
  },
  successBanner: {
    backgroundColor: "#ecfdf5",
    borderColor: "#10b981",
  },
  errorBanner: {
    backgroundColor: "#fef2f2",
    borderColor: "#ef4444",
  },
  infoBanner: {
    backgroundColor: "#eff6ff",
    borderColor: "#3b82f6",
  },
  messageText: {
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
});
