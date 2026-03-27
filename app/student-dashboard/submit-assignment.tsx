import * as DocumentPicker from "expo-document-picker";
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
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { COLORS, SHADOWS, SIZES } from "../../constants/theme";
import { auth, db, storage } from "../../firebaseConfig";

export default function SubmitAssignment() {
  const [assignmentCode, setAssignmentCode] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<any>(null);
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
      const response = await fetch(picked.uri);
      const blob = await response.blob();

      if (blob.size > 15 * 1024 * 1024) {
        Alert.alert("File too large", "Maximum allowed size is 15MB.");
        return;
      }

      setFile(picked);
    } catch (error) {
      console.log("Error picking file", error);
    }
  };

  const handleSubmit = async () => {
    if (!assignmentCode.trim() || !file || !studentId) {
      return Alert.alert("Error", "Assignment code and file are required.");
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

      // Fetch student name for the submission record
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
      
      const fileName = file.name || file.fileName || `submission_${Date.now()}`;
      const fileRef = ref(
        storage,
        `submissions/${assignmentDoc.id}/${studentId}_${fileName}`
      );
      
      const response = await fetch(file.uri);
      const blob = await response.blob();
      await uploadBytes(fileRef, blob, { contentType: blob.type });
      const downloadURL = await getDownloadURL(fileRef);

      await addDoc(collection(db, "submissions"), {
        submissionKey: submissionId,
        assignmentId: assignmentDoc.id,
        assignmentCode: assignment.code,
        studentId,
        studentName,
        type: assignment.type || "standard",
        classId: assignment.classId,
        subjectId: assignment.subjectId,
        teacherId: assignment.teacherId,
        fileUrl: downloadURL,
        fileName: fileName,
        note,
        isLate: false,
        marked: false,
        submittedAt: serverTimestamp(),
      });

      Alert.alert("Success", "Assignment submitted successfully!");
      setAssignmentCode("");
      setNote("");
      setFile(null);
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
      <Text style={styles.label}>Note (optional)</Text>
      <TextInput
        style={[styles.input, { height: 80 }]}
        placeholder="Message to teacher"
        multiline
        value={note}
        onChangeText={setNote}
      />
      <TouchableOpacity
        style={[styles.button, { backgroundColor: COLORS.accent }]}
        onPress={pickFile}
      >
        <Text style={styles.buttonText}>
          {file ? "Change File" : "Select File"}
        </Text>
      </TouchableOpacity>
      {file && <Text style={styles.fileName}>📎 {file.name || file.fileName}</Text>}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: COLORS.background },
  header: { fontSize: SIZES.extraLarge, fontWeight: "bold", marginBottom: 20, color: COLORS.primary },
  label: { fontSize: SIZES.medium, marginTop: 10, color: COLORS.primary, fontWeight: "bold" },
  input: { borderWidth: 1, borderColor: COLORS.gray, borderRadius: 8, padding: 10, backgroundColor: COLORS.white },
  button: { paddingVertical: 12, borderRadius: 8, marginTop: 12, alignItems: "center", ...SHADOWS.medium },
  buttonText: { color: COLORS.white, fontSize: SIZES.medium, fontWeight: "bold" },
  fileName: { marginTop: 6, textAlign: "center", color: COLORS.gray },
});
