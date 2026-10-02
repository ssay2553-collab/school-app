import * as DocumentPicker from "expo-document-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState, useCallback, memo } from "react";
import {
  ActivityIndicator,
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
  BackHandler,
} from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useToast } from "../../contexts/ToastContext";
import moment from "moment";
import { useUploadAssignment, Question, AssignmentType } from "../../hooks/teacher-dashboard/useUploadAssignment";
import PreschoolFields from "../../components/teacher-dashboard/upload-assignment/components/PreschoolFields";
import MathematicsFields from "../../components/teacher-dashboard/upload-assignment/components/MathematicsFields";
import FormattedText from "../../components/FormattedText";
import SpecialCharToolbar from "../../components/teacher-dashboard/upload-assignment/components/SpecialCharToolbar";
import { useRef } from "react";

// Guarded import for native-only library
const DateTimePicker = Platform.OS !== 'web' ? require('@react-native-community/datetimepicker').default : null;

const webInputStyle = Platform.OS === 'web' ? {
  border: 'none',
  background: 'none',
  fontSize: '14px',
  color: '#1E293B',
  fontWeight: '700',
  fontFamily: 'inherit',
  outline: 'none',
  cursor: 'pointer',
  width: '100%'
} : {};

/* =========================================================
   SUB-COMPONENT: HEADER
   ========================================================= */
const Header = memo(({ onBack }: { onBack: () => void }) => (
  <LinearGradient colors={[COLORS.primary, "#1E293B"]} style={styles.headerGradient}>
    <View style={styles.headerTitleRow}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <SVGIcon name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Post Assignment</Text>
      <SVGIcon name="cloud-upload" size={24} color={COLORS.secondary} />
    </View>
  </LinearGradient>
));

/* =========================================================
   SUB-COMPONENT: ASSIGNMENT DETAILS CARD
   ========================================================= */
const AssignmentDetailsCard = memo(({
  title, setTitle,
  teacherClasses, selectedClassId, setSelectedClassId,
  subjects, selectedSubject, setSelectedSubject,
  type, setType,
  dueDate, handleWebDateChange, handleWebTimeChange,
  showDatePicker, setShowDatePicker, pickerMode, setPickerMode, onDateChange
}: any) => {
  const webDateValue = moment(dueDate).format("YYYY-MM-DD");
  const webTimeValue = moment(dueDate).format("HH:mm");

  return (
    <Animatable.View animation="fadeInUp" style={styles.card}>
      <Text style={styles.sectionLabel}>Assignment Details</Text>

      <Text style={styles.inputLabel}>Title *</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Algebra Homework 1"
        value={title}
        onChangeText={setTitle}
      />

      <Text style={styles.inputLabel}>Class *</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bubbleRow}>
        {teacherClasses.map((cls: any) => (
          <TouchableOpacity
            key={cls.id}
            onPress={() => setSelectedClassId(cls.id)}
            style={[styles.bubble, selectedClassId === cls.id && styles.bubbleActive]}
          >
            <Text style={[styles.bubbleText, selectedClassId === cls.id && styles.bubbleTextActive]}>{cls.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.inputLabel}>Subject *</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bubbleRow}>
        {subjects.map((s: string) => (
          <TouchableOpacity
            key={s}
            onPress={() => setSelectedSubject(s)}
            style={[styles.bubble, selectedSubject === s && styles.bubbleActive]}
          >
            <Text style={[styles.bubbleText, selectedSubject === s && styles.bubbleTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.inputLabel}>Type</Text>
      <View style={styles.typeRow}>
        {(["mcq", "short_answer", "preschool", "mathematics", "rich-text"] as AssignmentType[]).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setType(t)}
            style={[styles.typeBtn, type === t && styles.typeBtnActive]}
          >
            <Text style={[styles.typeBtnText, type === t && styles.typeBtnTextActive]}>
              {t === 'rich-text' ? 'ESSAY' : t.replace("_", " ").toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.inputLabel}>Due Date & Time *</Text>
      <View style={styles.dateTimeRow}>
        {Platform.OS === "web" ? (
          <>
            <View style={[styles.datePickerBtn, { flex: 1.2 }]}>
              <SVGIcon name="calendar-outline" size={18} color={COLORS.primary} />
              <input
                type="date"
                value={webDateValue}
                onChange={(e) => handleWebDateChange(e.target.value)}
                style={webInputStyle}
              />
            </View>
            <View style={[styles.datePickerBtn, { flex: 1 }]}>
              <SVGIcon name="time-outline" size={18} color={COLORS.primary} />
              <input
                type="time"
                value={webTimeValue}
                onChange={(e) => handleWebTimeChange(e.target.value)}
                style={webInputStyle}
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
              <Text style={styles.datePickerText}>{moment(dueDate).format("DD MMM, YYYY")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { setPickerMode("time"); setShowDatePicker(true); }}
              style={[styles.datePickerBtn, { flex: 1 }]}
            >
              <SVGIcon name="time-outline" size={18} color={COLORS.primary} />
              <Text style={styles.datePickerText}>
                {moment(dueDate).format("hh:mm A")}
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
  );
});

/* =========================================================
   SUB-COMPONENT: QUESTION ITEM
   ========================================================= */
const QuestionItem = memo(({
  q, qIndex, type, updateQuestion, removeQuestion, updateOption, addOption, updatePreschoolQuestion, updateMathematicsQuestion
}: any) => {
  const [activeInputTarget, setActiveInputTarget] = useState<{ type: 'question' | 'option'; index?: number }>({ type: 'question' });
  const [questionSelection, setQuestionSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const [optionSelections, setOptionSelections] = useState<{ [key: number]: { start: number; end: number } }>({});

  const handleInsertChar = useCallback((char: string) => {
    let text = "";
    let selection = { start: 0, end: 0 };
    let isOption = false;
    let optIndex = 0;

    if (activeInputTarget.type === 'option' && activeInputTarget.index !== undefined) {
      isOption = true;
      optIndex = activeInputTarget.index;
      text = q.options?.[optIndex] || "";
      const savedSel = optionSelections[optIndex];
      selection = savedSel ?? { start: text.length, end: text.length };
    } else {
      text = q.text || "";
      selection = questionSelection ?? { start: text.length, end: text.length };
    }

    const start = Math.min(selection.start, selection.end);
    const end = Math.max(selection.start, selection.end);
    const hasSelection = start !== end;
    const selectedText = text.slice(start, end);

    let newText = "";
    let newCursorPos = start + char.length;

    // Handle Brackets
    if (char === "( )" || char === "[ ]" || char === "{ }" || char === "< >" || char === "“ ”" || char === "« »") {
      const openBracket = char.charAt(0);
      const closeBracket = char.charAt(char.length - 1);
      if (hasSelection) {
        const wrapped = `${openBracket}${selectedText}${closeBracket}`;
        newText = text.slice(0, start) + wrapped + text.slice(end);
        newCursorPos = start + wrapped.length;
      } else {
        const wrapped = `${openBracket}${closeBracket}`;
        newText = text.slice(0, start) + wrapped + text.slice(end);
        newCursorPos = start + 1; // position cursor inside brackets
      }
    }
    // Handle Formatting
    else if (char.includes("<b>") || char.includes("<u>")) {
      const tag = char.includes("<b>") ? "b" : "u";
      if (hasSelection) {
        const wrapped = `<${tag}>${selectedText}</${tag}>`;
        newText = text.slice(0, start) + wrapped + text.slice(end);
        newCursorPos = start + wrapped.length;
      } else {
        const defaultWord = tag === "b" ? "bold" : "underlined";
        const wrapped = `<${tag}>${defaultWord}</${tag}>`;
        const prefix = start > 0 && text.charAt(start - 1) !== ' ' ? ' ' : '';
        newText = text.slice(0, start) + prefix + wrapped + text.slice(end);
        newCursorPos = start + prefix.length + wrapped.length;
      }
    }
    // Handle Character or Accent
    else {
      const rawInserted = text.slice(0, start) + char + text.slice(end);
      newText = rawInserted.normalize("NFC");
      newCursorPos = start + char.length;
    }

    if (isOption) {
      updateOption(qIndex, optIndex, newText);
      setOptionSelections((prev) => ({
        ...prev,
        [optIndex]: { start: newCursorPos, end: newCursorPos },
      }));
    } else {
      updateQuestion(qIndex, newText);
      setQuestionSelection({ start: newCursorPos, end: newCursorPos });
    }
  }, [
    activeInputTarget,
    q.options,
    q.text,
    qIndex,
    questionSelection,
    optionSelections,
    updateOption,
    updateQuestion,
  ]);

  const targetLabel = activeInputTarget.type === 'option' && activeInputTarget.index !== undefined
    ? `Option ${activeInputTarget.index + 1}`
    : "Question Text";

  const isSupportedType = type === "mcq" || type === "short_answer" || type === "rich-text";

  return (
    <View style={styles.questionCard}>
      <View style={styles.qHeader}>
        <Text style={styles.qIndex}>{type === 'preschool' ? 'Preschool' : type === 'mathematics' ? 'Mathematics' : type === 'rich-text' ? 'Essay Prompt' : 'Standard'} Q{qIndex + 1}</Text>
        <TouchableOpacity onPress={() => removeQuestion(qIndex)}>
          <SVGIcon name="trash-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      {type === "preschool" ? (
        <PreschoolFields q={q} qIndex={qIndex} updatePreschoolQuestion={updatePreschoolQuestion} styles={styles} />
      ) : type === "mathematics" ? (
        <MathematicsFields
          q={q}
          qIndex={qIndex}
          updateMathematicsQuestion={updateMathematicsQuestion}
          updateOption={updateOption}
          addOption={addOption}
          styles={styles}
        />
      ) : (
        <>
          <View style={styles.questionLabelRow}>
            <Text style={styles.inputLabel}>Question Text / Instructions</Text>
          </View>

          {isSupportedType && (
            <SpecialCharToolbar
              onInsertChar={handleInsertChar}
              targetName={targetLabel}
            />
          )}

          <TextInput
            style={styles.input}
            placeholder={
              type === 'short_answer'
                ? "e.g. State the capital of <b>Ghana</b> (Class 1) or identify <u>sukuu</u>."
                : type === 'rich-text'
                ? "Write essay prompt or instructions..."
                : type === 'preschool'
                ? "e.g. A _ C"
                : "Type question..."
            }
            value={q.text}
            onChangeText={(t) => updateQuestion(qIndex, t)}
            onFocus={() => setActiveInputTarget({ type: 'question' })}
            onSelectionChange={(e) => setQuestionSelection(e.nativeEvent.selection)}
            multiline
          />

          {q.text && (q.text.includes('<') || q.text.includes('*')) ? (
            <View style={styles.previewBox}>
              <Text style={styles.previewLabel}>Student View Preview:</Text>
              <FormattedText text={q.text} style={styles.previewText} />
            </View>
          ) : null}

          {(type === "mcq") && (
            <View style={styles.optionsContainer}>
              <Text style={styles.inputLabel}>Options (Choices)</Text>
              {q.options?.map((opt: string, oIndex: number) => (
                <View key={oIndex} style={styles.optionRow}>
                  <View style={styles.bullet} />
                  <TextInput
                    style={styles.optionInput}
                    placeholder={`Option ${oIndex + 1}`}
                    value={opt}
                    onChangeText={(t) => updateOption(qIndex, oIndex, t)}
                    onFocus={() => setActiveInputTarget({ type: 'option', index: oIndex })}
                    onSelectionChange={(e) => setOptionSelections((prev) => ({ ...prev, [oIndex]: e.nativeEvent.selection }))}
                  />
                </View>
              ))}
              <TouchableOpacity onPress={() => addOption(qIndex)} style={styles.addOptionBtn}>
                <Text style={styles.addOptionText}>+ Add Option</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </View>
  );
});

/* =========================================================
   MAIN COMPONENT: UPLOAD ASSIGNMENT
   ========================================================= */
export default function UploadAssignment() {
  const router = useRouter();
  const { showToast } = useToast();

  const {
    loading, fetchingMetadata, teacherClasses, selectedClassId, setSelectedClassId,
    selectedSubject, setSelectedSubject, title, setTitle, description, setDescription,
    type, setType, dueDate, setDueDate, file, setFile, uploadingFile, questions,
    hasUnsavedChanges, addQuestion, updateQuestion, updateOption, addOption,
    removeQuestion, handleUpload, handleWebDateChange, handleWebTimeChange,
    subjects, updatePreschoolQuestion, updateMathematicsQuestion
  } = useUploadAssignment();

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<"date" | "time">("date");
  const [backPressCount, setBackPressCount] = useState(0);
  const isNavigating = useRef(false);

  const handleBack = useCallback(() => {
    if (isNavigating.current) return true;
    if (hasUnsavedChanges && backPressCount === 0) {
      setBackPressCount(1);
      showToast({ message: "Discard changes? Tap back again to confirm.", type: "info" });
      setTimeout(() => setBackPressCount(0), 3000);
      return true;
    }
    isNavigating.current = true;
    if (router.canGoBack()) router.back();
    else router.replace("/teacher-dashboard");
    return true;
  }, [hasUnsavedChanges, backPressCount, router, showToast]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", handleBack);
    return () => backHandler.remove();
  }, [handleBack]);

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (event.type === "dismissed") return;
    if (selectedDate) {
      const newDate = new Date(dueDate.getTime());
      if (Platform.OS === "ios") setDueDate(selectedDate);
      else {
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

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
      if (!result.canceled) setFile(result);
    } catch (err) { console.error("PickDocument Error:", err); }
  };

  const onPost = async () => {
    const success = await handleUpload();
    if (success) router.replace("/teacher-dashboard");
  };

  if (fetchingMetadata) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Header onBack={handleBack} />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 12, paddingBottom: 100 }}>
          
          <AssignmentDetailsCard
            title={title} setTitle={setTitle}
            teacherClasses={teacherClasses} selectedClassId={selectedClassId} setSelectedClassId={setSelectedClassId}
            subjects={subjects} selectedSubject={selectedSubject} setSelectedSubject={setSelectedSubject}
            type={type} setType={setType}
            dueDate={dueDate} handleWebDateChange={handleWebDateChange} handleWebTimeChange={handleWebTimeChange}
            showDatePicker={showDatePicker} setShowDatePicker={setShowDatePicker}
            pickerMode={pickerMode} setPickerMode={setPickerMode} onDateChange={onDateChange}
          />

          <Animatable.View animation="fadeInUp" style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Interactive Questions</Text>
              <TouchableOpacity onPress={addQuestion} style={styles.addBtn}><SVGIcon name="add-circle" size={24} color={COLORS.primary} /></TouchableOpacity>
            </View>

            {questions.map((q: Question, qIndex: number) => (
              <QuestionItem
                key={q.id || qIndex}
                q={q}
                qIndex={qIndex}
                type={type}
                updateQuestion={updateQuestion}
                removeQuestion={removeQuestion}
                updateOption={updateOption}
                addOption={addOption}
                updatePreschoolQuestion={updatePreschoolQuestion}
                updateMathematicsQuestion={updateMathematicsQuestion}
              />
            ))}

            <TouchableOpacity
              onPress={addQuestion}
              style={styles.addQuestionFooterBtn}
            >
              <SVGIcon name="add-circle" size={32} color={COLORS.primary} />
            </TouchableOpacity>
          </Animatable.View>

        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.7 }]} onPress={onPost} disabled={loading || uploadingFile}>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerGradient: { paddingTop: 20, paddingHorizontal: 20, paddingBottom: 30, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, ...SHADOWS.medium },
  headerTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 24, fontWeight: "900", color: "#fff" },
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 12, marginBottom: 20, ...SHADOWS.small },
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
  uploadBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderStyle: "dashed", borderWidth: 2, borderColor: COLORS.primary, borderRadius: 12, padding: 20, marginTop: 10, gap: 10 },
  uploadBtnText: { color: COLORS.primary, fontWeight: "800", fontSize: 14 },
  questionCard: { backgroundColor: "#F8FAFC", borderRadius: 15, padding: 8, marginBottom: 15, borderWidth: 1, borderColor: "#E2E8F0" },
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
  addBtn: { padding: 5 },
  smallBubble: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: '#F1F5F9', marginRight: 8, gap: 6, borderWidth: 1, borderColor: '#E2E8F0' },
  smallBubbleActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  smallBubbleText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  smallBubbleTextActive: { color: '#fff' },
  groupLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addQuestionFooterBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 5,
  },
  questionLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  formatToolbar: {
    flexDirection: 'row',
    gap: 6,
  },
  formatChip: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  formatChipText: {
    fontSize: 11,
    color: COLORS.primary,
  },
  formatHintBox: {
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  formatHintText: {
    fontSize: 12,
    color: '#0369A1',
    lineHeight: 16,
  },
  previewBox: {
    marginTop: 8,
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  previewText: {
    fontSize: 14,
    color: '#1E293B',
    lineHeight: 20,
  },
});
