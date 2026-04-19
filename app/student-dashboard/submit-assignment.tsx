import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
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
import { auth, db, storage } from "../../firebaseConfig";

export default function SubmitAssignment() {
  const router = useRouter();
  const [assignmentCode, setAssignmentCode] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<any>(null);
  const [loading, setLoading] = useState(false);

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
    }
  };

  const goToNotes = () => {
    router.push("/student-dashboard/note");
  };

  const handleSubmit = async () => {
    if (!assignmentCode.trim() || !file || !studentId) {
      return Alert.alert("Error", "Assignment code and a file are required. To submit written content, please use the Notes dashboard.");
    }

    setLoading(true);

    try {
      const q = query(
        collection(db, "assignments"),
        where("code", "==", assignmentCode.trim())
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        Alert.alert("Invalid Code", "Assignment not found.");
        setLoading(false);
        return;
      }

      const assignmentDoc = snapshot.docs[0];
      const assignment = assignmentDoc.data();

      // Fetch student name
      let studentName = "Student";
      try {
        const studentSnap = await getDoc(doc(db, "users", studentId));
        if (studentSnap.exists()) {
          studentName = studentSnap.data()?.profile?.firstName
            ? `${studentSnap.data().profile.firstName} ${studentSnap.data().profile.lastName || ""}`
            : studentSnap.data().fullName || studentSnap.data().name || "Student";
        }
      } catch (err) {
        console.log("Error fetching student name", err);
      }

      const deadline: Timestamp | undefined = assignment.dueDate || assignment.deadline;
      if (deadline && new Date() > deadline.toDate()) {
        Alert.alert("Submission Closed", "The deadline has passed.");
        setLoading(false);
        return;
      }

      const submissionId = `${assignmentDoc.id}_${studentId}`;
      let downloadURL = "";
      let fileName = "";

      if (file) {
        fileName = file.name || file.fileName || `submission_${Date.now()}`;
        const fileRef = ref(
          storage,
          `submissions/${assignmentDoc.id}/${studentId}_${fileName}`
        );
        const response = await fetch(file.uri);
        const blob = await response.blob();
        await uploadBytes(fileRef, blob, { contentType: blob.type });
        downloadURL = await getDownloadURL(fileRef);
      }

      await addDoc(collection(db, "submissions"), {
        submissionKey: submissionId,
        assignmentId: assignmentDoc.id,
        assignmentTitle: assignment.title || "Untitled",
        assignmentCode: assignment.code,
        studentId,
        studentName,
        type: assignment.type || "standard",
        classId: assignment.classId,
        subjectId: assignment.subjectId,
        teacherId: assignment.teacherId,
        fileUrl: downloadURL || null,
        fileName: fileName || null,
        contentHtml: null,
        responses: null,
        note,
        isLate: false,
        marked: false,
        submittedAt: serverTimestamp(),
      });

      Alert.alert("Success", "Assignment submitted successfully!");
      router.back();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: surface }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <SVGIcon name="arrow-back" size={24} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.header}>Submit Assignment</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Assignment Code</Text>
          <View style={styles.inputWrapper}>
             <SVGIcon name="key" size={18} color="#94A3B8" style={styles.inputIcon} />
             <TextInput
              style={styles.input}
              placeholder="Enter code (e.g. HW-123)"
              placeholderTextColor="#94A3B8"
              value={assignmentCode}
              onChangeText={setAssignmentCode}
              autoCapitalize="characters"
            />
          </View>

          <Text style={styles.label}>Submission Method</Text>
          <View style={styles.methodRow}>
            <TouchableOpacity
              style={[styles.methodBtn, file && { borderColor: primary, backgroundColor: primary + '08' }]}
              onPress={pickFile}
            >
              <SVGIcon name="cloud-upload" size={24} color={file ? primary : "#64748B"} />
              <Text style={[styles.methodBtnText, file && { color: primary }]}>
                {file ? "File Selected" : "Upload File"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.methodBtn}
              onPress={goToNotes}
            >
              <SVGIcon name="document-text" size={24} color="#64748B" />
              <Text style={styles.methodBtnText}>
                From Notes
              </Text>
            </TouchableOpacity>
          </View>

          {file && (
            <View style={styles.filePreview}>
              <SVGIcon name="attach" size={18} color={primary} />
              <Text style={styles.fileName} numberOfLines={1}>{file.name || file.fileName}</Text>
              <TouchableOpacity onPress={() => setFile(null)}>
                <SVGIcon name="close-circle" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.label}>Note (optional)</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Add a message for your teacher..."
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={4}
            value={note}
            onChangeText={setNote}
          />

          <TouchableOpacity
            style={[styles.button, { backgroundColor: primary }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.buttonText}>Submit Assignment</Text>
                <SVGIcon name="send" size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <SVGIcon name="information-circle" size={20} color="#1E40AF" />
          <Text style={styles.infoText}>
            To submit written content (Rich Text), please use the "Academic Notes" dashboard. You can create a note and then tap "Submit to Teacher".
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
  backBtn: { marginRight: 15, padding: 5 },
  header: { fontSize: 24, fontWeight: "800", color: "#0F172A" },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 20, ...SHADOWS.medium },
  label: { fontSize: 13, fontWeight: "700", color: "#64748B", marginBottom: 8, marginTop: 15 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 12, paddingHorizontal: 15 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, height: 50, fontSize: 15, color: "#1E293B", fontWeight: '600' },
  methodRow: { flexDirection: "row", gap: 12, marginTop: 5 },
  methodBtn: { flex: 1, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center", backgroundColor: '#fff', gap: 8 },
  methodBtnText: { color: "#64748B", fontWeight: "700", fontSize: 13 },
  filePreview: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, marginTop: 15, gap: 8 },
  fileName: { flex: 1, color: "#334155", fontWeight: "600", fontSize: 14 },
  textArea: { backgroundColor: '#F1F5F9', borderRadius: 12, padding: 15, fontSize: 15, color: "#1E293B", textAlignVertical: 'top', minHeight: 100 },
  button: { height: 55, borderRadius: 16, marginTop: 30, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, ...SHADOWS.medium },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  infoBox: { marginTop: 30, padding: 16, backgroundColor: "#EFF6FF", borderRadius: 16, flexDirection: 'row', gap: 12 },
  infoText: { flex: 1, color: "#1E40AF", fontSize: 13, lineHeight: 20, fontWeight: '500' },
});

