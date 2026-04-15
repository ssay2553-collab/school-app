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
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import RichTextEditor from "../../components/RichTextEditor";
import { COLORS, SHADOWS, SIZES } from "../../constants/theme";
import { auth, db, storage } from "../../firebaseConfig";

export default function SubmitAssignment() {
  const router = useRouter();
  const [assignmentCode, setAssignmentCode] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<any>(null);
  const [richText, setRichText] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [loading, setLoading] = useState(false);

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
      setRichText(""); // Clear rich text if file is picked
    } catch (error) {
      console.log("Error picking file", error);
    }
  };

  const handleSubmit = async () => {
    if (!assignmentCode.trim() || (!file && !richText) || !studentId) {
      return Alert.alert("Error", "Assignment code and either a file or written content are required.");
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
          studentName = studentSnap.data().fullName || studentSnap.data().name || "Student";
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
        assignmentCode: assignment.code,
        studentId,
        studentName,
        type: richText ? "rich-text" : (assignment.type || "standard"),
        classId: assignment.classId,
        subjectId: assignment.subjectId,
        teacherId: assignment.teacherId,
        fileUrl: downloadURL || null,
        fileName: fileName || null,
        contentHtml: richText || null,
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
    <View style={styles.container}>
      <Text style={styles.header}>Submit Assignment 📤</Text>

      <Text style={styles.label}>Assignment Code</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter assignment code"
        value={assignmentCode}
        onChangeText={setAssignmentCode}
        autoCapitalize="characters"
      />

      <Text style={styles.label}>Submission Method</Text>
      <View style={styles.methodRow}>
        <TouchableOpacity
          style={[styles.methodBtn, !richText && styles.activeMethod]}
          onPress={pickFile}
        >
          <Text style={[styles.methodBtnText, !richText && styles.activeMethodText]}>
            {file ? "File Selected" : "Upload File"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.methodBtn, richText !== "" && styles.activeMethod]}
          onPress={() => setShowEditor(true)}
        >
          <Text style={[styles.methodBtnText, richText !== "" && styles.activeMethodText]}>
            {richText ? "Edit Writing" : "Write Online"}
          </Text>
        </TouchableOpacity>
      </View>

      {file && <Text style={styles.fileName}>📎 {file.name || file.fileName}</Text>}
      {richText !== "" && <Text style={styles.fileName}>📝 Rich Text Content Ready</Text>}

      <Text style={styles.label}>Note (optional)</Text>
      <TextInput
        style={[styles.input, { height: 80 }]}
        placeholder="Message to teacher"
        multiline
        value={note}
        onChangeText={setNote}
      />

      <TouchableOpacity
        style={[styles.button, { backgroundColor: COLORS.primary }]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.white} />
        ) : (
          <Text style={styles.buttonText}>Submit Assignment</Text>
        )}
      </TouchableOpacity>

      <Modal visible={showEditor} animationType="slide">
        <View style={{ flex: 1, paddingTop: 50 }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Write Assignment</Text>
            <TouchableOpacity onPress={() => setShowEditor(false)}>
              <Text style={{ color: COLORS.primary, fontWeight: "bold" }}>Done</Text>
            </TouchableOpacity>
          </View>
          <RichTextEditor
            initialContent={richText}
            onChange={(html: string) => {
              setRichText(html);
              if (html) setFile(null); // Clear file if writing is used
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: COLORS.background },
  header: { fontSize: SIZES.extraLarge, fontWeight: "bold", marginBottom: 20, color: COLORS.primary },
  label: { fontSize: SIZES.medium, marginTop: 15, color: COLORS.primary, fontWeight: "bold", marginBottom: 5 },
  input: { borderWidth: 1, borderColor: COLORS.gray, borderRadius: 8, padding: 10, backgroundColor: COLORS.white },
  methodRow: { flexDirection: "row", gap: 10, marginTop: 5 },
  methodBtn: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: COLORS.primary, alignItems: "center" },
  activeMethod: { backgroundColor: COLORS.primary },
  methodBtnText: { color: COLORS.primary, fontWeight: "bold" },
  activeMethodText: { color: "#fff" },
  button: { paddingVertical: 15, borderRadius: 8, marginTop: 25, alignItems: "center", ...SHADOWS.medium },
  buttonText: { color: COLORS.white, fontSize: SIZES.medium, fontWeight: "bold" },
  fileName: { marginTop: 10, color: COLORS.secondary, fontWeight: "600" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", padding: 20, borderBottomWidth: 1, borderBottomColor: "#eee" },
  modalTitle: { fontSize: 18, fontWeight: "bold" },
});
