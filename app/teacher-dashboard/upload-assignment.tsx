import { SVGIcon } from "../../components/SVGIcon";
import * as DocumentPicker from "expo-document-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  addDoc,
  collection,
  documentId,
  getDocsFromServer,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import React, { useEffect, useState, useCallback, memo } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db, storage } from "../../firebaseConfig";
import { sortClasses } from "../../lib/classHelpers";
import moment from "moment";

// Guarded import for native-only library
const DateTimePicker = Platform.OS !== 'web' ? require('@react-native-community/datetimepicker').default : null;

interface ClassData {
  id: string;
  name: string;
}

type AssignmentType = "standard" | "mcq" | "short_answer";

interface Question {
  text: string;
  options: string[];
}

export default function UploadAssignment() {
  const router = useRouter();
  const { appUser } = useAuth();

  const [loading, setLoading] = useState(false);
  const [fetchingMetadata, setFetchingMetadata] = useState(true);
  const [teacherClasses, setTeacherClasses] = useState<ClassData[]>([]);

  // Form State
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<AssignmentType>("standard");
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 86400000 * 7)); // Default 1 week
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<"date" | "time">("date");

  // File Upload State
  const [file, setFile] = useState<DocumentPicker.DocumentPickerResult | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Interactive Questions - Separated states for different types
  const [mcqQuestions, setMcqQuestions] = useState<Question[]>([]);
  const [shortAnswerQuestions, setShortAnswerQuestions] = useState<Question[]>([]);

  // Derived current questions based on type
  const questions = type === "mcq" ? mcqQuestions : shortAnswerQuestions;
  
  // Wrapper setter to update the correct state based on current type
  const setQuestions = useCallback((val: React.SetStateAction<Question[]>) => {
    if (type === "mcq") {
      setMcqQuestions(val);
    } else {
      setShortAnswerQuestions(val);
    }
  }, [type]);

  useEffect(() => {
    if (!appUser) {
      setFetchingMetadata(false);
      return;
    }
    
    const fetchData = async () => {
      setFetchingMetadata(true);
      try {
        const classIds = appUser.classes || [];
        if (classIds.length > 0) {
          const results: any[] = [];
          for (let i = 0; i < classIds.length; i += 10) {
            const chunk = classIds.slice(i, i + 10);
            const q = query(collection(db, "classes"), where(documentId(), "in", chunk));
            const snap = await getDocsFromServer(q);
            results.push(...snap.docs.map(d => ({ id: d.id, name: d.data().name || d.id })));
          }
          
          const sorted = sortClasses(results);
          setTeacherClasses(sorted);
          if (sorted.length > 0) setSelectedClassId(sorted[0].id);
        }
        if (appUser.subjects && appUser.subjects.length > 0) {
          setSelectedSubject(appUser.subjects[0]);
        }
      } catch (err) {
        console.error("fetchData Error:", err);
      } finally {
        setFetchingMetadata(false);
      }
    };
    fetchData();
  }, [appUser]);

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (event.type === "dismissed") return;

    if (selectedDate) {
      const newDate = new Date(dueDate.getTime());
      if (Platform.OS === "ios") {
        setDueDate(selectedDate);
      } else {
        if (pickerMode === "date") {
          newDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
          setDueDate(newDate);
          setPickerMode("time");
          setTimeout(() => setShowDatePicker(true), 150);
        } else {
          newDate.setHours(selectedDate.getHours(), selectedDate.getMinutes());
          setDueDate(newDate);
        }
      }
    }
  };

  const handleWebDateChange = (val: string) => {
    // Try multiple formats to be robust against manual user input
    const parsed = moment(val, ["YYYY-MM-DD", "DD-MM-YYYY", "MM-DD-YYYY", "DD/MM/YYYY", "MM/DD/YYYY"], true);
    if (parsed.isValid()) {
      const next = new Date(dueDate);
      next.setFullYear(parsed.year(), parsed.month(), parsed.date());
      setDueDate(next);
    }
  };

  const handleWebTimeChange = (val: string) => {
    const parsed = moment(val, ["HH:mm", "h:mm A", "H:mm"], true);
    if (parsed.isValid()) {
      const next = new Date(dueDate);
      next.setHours(parsed.hour(), parsed.minute());
      setDueDate(next);
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });
      if (!result.canceled) {
        setFile(result);
      }
    } catch (err) {
      console.error("PickDocument Error:", err);
    }
  };

  const addQuestion = useCallback(() => {
    setQuestions(prev => [...prev, { text: "", options: ["", ""] }]);
  }, [setQuestions]);

  const updateQuestion = useCallback((index: number, text: string) => {
    setQuestions(prev => prev.map((q, i) => i === index ? { ...q, text } : q));
  }, [setQuestions]);

  const updateOption = useCallback((qIndex: number, oIndex: number, text: string) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i === qIndex) {
        const newOptions = [...q.options];
        newOptions[oIndex] = text;
        return { ...q, options: newOptions };
      }
      return q;
    }));
  }, [setQuestions]);

  const addOption = useCallback((qIndex: number) => {
    setQuestions(prev => prev.map((q, i) => 
      i === qIndex ? { ...q, options: [...q.options, ""] } : q
    ));
  }, [setQuestions]);

  const removeQuestion = useCallback((index: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== index));
  }, [setQuestions]);

  const handleUpload = async () => {
    if (!title || !selectedClassId || !selectedSubject) {
      return Alert.alert("Error", "Please fill in all required fields.");
    }

    if (type === "standard" && !file && !description) {
      return Alert.alert("Error", "Please provide either instructions or a file.");
    }

    if ((type === "mcq" || type === "short_answer") && questions.length === 0) {
      return Alert.alert("Error", "Please add at least one question.");
    }

    setLoading(true);
    try {
      let fileUrl = "";
      let fileName = "";

      if (file && !file.canceled && file.assets && file.assets[0]) {
        setUploadingFile(true);
        const asset = file.assets[0];
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const storageRef = ref(storage, `assignments/${Date.now()}_${asset.name}`);
        await uploadBytes(storageRef, blob);
        fileUrl = await getDownloadURL(storageRef);
        fileName = asset.name;
        setUploadingFile(false);
      }

      const assignmentData = {
        title,
        description,
        type,
        classId: selectedClassId,
        subjectId: selectedSubject,
        teacherId: appUser?.uid,
        fileUrl,
        fileName,
        questions: type === "standard" ? null : questions,
        dueDate: dueDate,
        createdAt: serverTimestamp(),
        code: Math.random().toString(36).substring(2, 8).toUpperCase(),
      };

      await addDoc(collection(db, "assignments"), assignmentData);
      Alert.alert("Success", "Assignment posted successfully!", [
        { text: "OK", onPress: () => router.back() }
      ]);
    } catch (err) {
      console.error("handleUpload Error:", err);
      Alert.alert("Error", "Failed to post assignment.");
    } finally {
      setLoading(false);
      setUploadingFile(false);
    }
  };

  if (fetchingMetadata) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  const webDateValue = moment(dueDate).format("YYYY-MM-DD");
  const webTimeValue = moment(dueDate).format("HH:mm");

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[COLORS.primary, "#1E293B"]} style={styles.headerGradient}>
        <View style={styles.headerTitleRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><SVGIcon name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
          <Text style={styles.headerTitle}>Post Assignment</Text>
          <SVGIcon name="cloud-upload" size={24} color={COLORS.secondary} />
        </View>
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
          
          <Animatable.View animation="fadeInUp" style={styles.card}>
            <Text style={styles.sectionLabel}>Assignment Details</Text>
            
            <Text style={styles.inputLabel}>Title *</Text>
            <TextInput style={styles.input} placeholder="e.g. Algebra Homework 1" value={title} onChangeText={setTitle} />

            <Text style={styles.inputLabel}>Class *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bubbleRow}>
              {teacherClasses.map((cls) => (
                <TouchableOpacity key={cls.id} onPress={() => setSelectedClassId(cls.id)} style={[styles.bubble, selectedClassId === cls.id && styles.bubbleActive]}>
                  <Text style={[styles.bubbleText, selectedClassId === cls.id && styles.bubbleTextActive]}>{cls.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>Subject *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bubbleRow}>
              {(appUser?.subjects || []).map((s: string) => (
                <TouchableOpacity key={s} onPress={() => setSelectedSubject(s)} style={[styles.bubble, selectedSubject === s && styles.bubbleActive]}>
                  <Text style={[styles.bubbleText, selectedSubject === s && styles.bubbleTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>Type</Text>
            <View style={styles.typeRow}>
              {(["standard", "mcq", "short_answer"] as AssignmentType[]).map((t) => (
                <TouchableOpacity key={t} onPress={() => setType(t)} style={[styles.typeBtn, type === t && styles.typeBtnActive]}>
                  <Text style={[styles.typeBtnText, type === t && styles.typeBtnTextActive]}>{t.replace("_", " ").toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Due Date & Time *</Text>
            <View style={styles.dateTimeRow}>
              {Platform.OS === "web" ? (
                <>
                  <View style={[styles.datePickerBtn, { flex: 1.2 }]}>
                    <SVGIcon name="calendar-outline" size={18} color={COLORS.primary} />
                    <TextInput
                      style={styles.webInput}
                      defaultValue={webDateValue}
                      onChangeText={handleWebDateChange}
                      {...({ type: 'date' } as any)}
                    />
                  </View>
                  <View style={[styles.datePickerBtn, { flex: 1 }]}>
                    <SVGIcon name="time-outline" size={18} color={COLORS.primary} />
                    <TextInput
                      style={styles.webInput}
                      defaultValue={webTimeValue}
                      onChangeText={handleWebTimeChange}
                      {...({ type: 'time' } as any)}
                    />
                  </View>
                </>
              ) : (
                <>
                  <TouchableOpacity 
                    onPress={() => { setPickerMode("date"); setShowDatePicker(true); }} 
                    style={[styles.datePickerBtn, { flex: 1.2 }]}
                  >
                    <SVGIcon name="calendar-outline" size={18} color={COLORS.primary} />
                    <Text style={styles.datePickerText}>{dueDate.toLocaleDateString()}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    onPress={() => { setPickerMode("time"); setShowDatePicker(true); }} 
                    style={[styles.datePickerBtn, { flex: 1 }]}
                  >
                    <SVGIcon name="time-outline" size={18} color={COLORS.primary} />
                    <Text style={styles.datePickerText}>
                      {dueDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {showDatePicker && DateTimePicker && (
              <DateTimePicker
                value={dueDate}
                mode={Platform.OS === "ios" ? "datetime" : pickerMode}
                display="default"
                onChange={onDateChange}
              />
            )}
          </Animatable.View>

          {type === "standard" ? (
            <Animatable.View animation="fadeInUp" style={styles.card}>
              <Text style={styles.sectionLabel}>Content & Resources</Text>
              <Text style={styles.inputLabel}>Instructions / Description</Text>
              <TextInput style={[styles.input, { height: 100 }]} multiline placeholder="Provide instructions for the students..." value={description} onChangeText={setDescription} />
              
              <Text style={styles.inputLabel}>Attachment (Optional)</Text>
              <TouchableOpacity style={styles.uploadBtn} onPress={pickDocument}>
                <SVGIcon name="document-attach" size={24} color={COLORS.primary} />
                <Text style={styles.uploadBtnText}>{file && !file.canceled ? file.assets?.[0]?.name : "Select Document"}</Text>
              </TouchableOpacity>
            </Animatable.View>
          ) : (
            <Animatable.View animation="fadeInUp" style={styles.card}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>Interactive Questions</Text>
                <TouchableOpacity onPress={addQuestion} style={styles.addBtn}><SVGIcon name="add-circle" size={24} color={COLORS.primary} /></TouchableOpacity>
              </View>

              {questions.map((q, qIndex) => (
                <QuestionItem
                  key={qIndex}
                  q={q}
                  qIndex={qIndex}
                  type={type}
                  updateQuestion={updateQuestion}
                  removeQuestion={removeQuestion}
                  updateOption={updateOption}
                  addOption={addOption}
                />
              ))}
            </Animatable.View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.7 }]} onPress={handleUpload} disabled={loading || uploadingFile}>
          <LinearGradient colors={[COLORS.primary, "#4F46E5"]} style={styles.submitBtnGradient}>
            {loading || uploadingFile ? <ActivityIndicator color="#fff" /> : (
              <><Text style={styles.submitBtnText}>Post Assignment</Text><SVGIcon name="send" size={20} color="#fff" style={{ marginLeft: 10 }} /></>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const QuestionItem = memo(({
  q,
  qIndex,
  type,
  updateQuestion,
  removeQuestion,
  updateOption,
  addOption
}: {
  q: Question;
  qIndex: number;
  type: AssignmentType;
  updateQuestion: (index: number, text: string) => void;
  removeQuestion: (index: number) => void;
  updateOption: (qIndex: number, oIndex: number, text: string) => void;
  addOption: (qIndex: number) => void;
}) => {
  return (
    <View style={styles.questionCard}>
      <View style={styles.qHeader}>
        <Text style={styles.qIndex}>Question {qIndex + 1}</Text>
        <TouchableOpacity onPress={() => removeQuestion(qIndex)}>
          <SVGIcon name="trash-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>
      <TextInput
        style={styles.input}
        placeholder="Type question..."
        value={q.text}
        onChangeText={(t) => updateQuestion(qIndex, t)}
      />

      {type === "mcq" && (
        <View style={styles.optionsContainer}>
          {q.options.map((opt, oIndex) => (
            <View key={oIndex} style={styles.optionRow}>
              <View style={styles.bullet} />
              <TextInput
                style={styles.optionInput}
                placeholder={`Option ${oIndex + 1}`}
                value={opt}
                onChangeText={(t) => updateOption(qIndex, oIndex, t)}
              />
            </View>
          ))}
          <TouchableOpacity onPress={() => addOption(qIndex)} style={styles.addOptionBtn}>
            <Text style={styles.addOptionText}>+ Add Option</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerGradient: { paddingTop: 20, paddingHorizontal: 20, paddingBottom: 30, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, ...SHADOWS.medium },
  headerTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 24, fontWeight: "900", color: "#fff" },
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 20, marginBottom: 20, ...SHADOWS.small },
  sectionLabel: { fontSize: 14, fontWeight: "900", color: COLORS.primary, marginBottom: 15, letterSpacing: 0.5 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 },
  inputLabel: { fontSize: 12, fontWeight: "700", color: "#64748B", marginBottom: 8, marginTop: 10 },
  input: { backgroundColor: "#F1F5F9", borderRadius: 12, padding: 12, fontSize: 15, color: "#1E293B", borderWidth: 1, borderColor: "#E2E8F0" },
  bubbleRow: { gap: 10, paddingVertical: 5 },
  bubble: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 15, borderWidth: 1.5, borderColor: "#F1F5F9", backgroundColor: "#F8FAFC" },
  bubbleActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  bubbleText: { fontSize: 12, fontWeight: "800", color: "#64748B" },
  bubbleTextActive: { color: "#fff" },
  typeRow: { flexDirection: "row", gap: 10, marginTop: 5 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: "#E2E8F0", alignItems: "center" },
  typeBtnActive: { backgroundColor: COLORS.secondary + "15", borderColor: COLORS.secondary },
  typeBtnText: { fontSize: 10, fontWeight: "900", color: "#64748B" },
  typeBtnTextActive: { color: COLORS.secondary },
  dateTimeRow: { flexDirection: "row", gap: 10, marginTop: 5 },
  datePickerBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#F1F5F9", borderRadius: 12, padding: 12, gap: 8, borderWidth: 1, borderColor: "#E2E8F0" },
  datePickerText: { fontSize: 14, color: "#1E293B", fontWeight: "700" },
  webInput: { 
    flex: 1, 
    fontSize: 14, 
    color: "#1E293B", 
    fontWeight: "700", 
    backgroundColor: 'transparent',
    borderWidth: 0,
    outlineStyle: 'none' as any
  },
  uploadBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderStyle: "dashed", borderWidth: 2, borderColor: COLORS.primary, borderRadius: 12, padding: 20, marginTop: 10, gap: 10 },
  uploadBtnText: { color: COLORS.primary, fontWeight: "800", fontSize: 14 },
  questionCard: { backgroundColor: "#F8FAFC", borderRadius: 15, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: "#E2E8F0" },
  qHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  qIndex: { fontSize: 12, fontWeight: "900", color: COLORS.primary },
  optionsContainer: { marginTop: 15, gap: 10 },
  optionRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  bullet: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.secondary },
  optionInput: { flex: 1, backgroundColor: "#fff", borderRadius: 8, padding: 8, fontSize: 14, borderWidth: 1, borderColor: "#E2E8F0" },
  addOptionBtn: { padding: 5 },
  addOptionText: { fontSize: 12, fontWeight: "700", color: COLORS.secondary },
  footer: { padding: 20, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  submitBtn: { borderRadius: 16, overflow: "hidden" },
  submitBtnGradient: { padding: 18, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  submitBtnText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  addBtn: { padding: 5 }
});
