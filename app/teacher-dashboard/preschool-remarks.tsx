import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useBehavioralRecords, BehavioralRecord } from "../../hooks/teacher-dashboard/useBehavioralRecords";
import { useRef, useEffect } from "react";

const PRESCHOOL_ASSESSMENTS = [
  { id: "throw_catch_kick", label: "Can throw, catch and kick a ball", category: "PHYSICAL DEVELOPMENT" },
  { id: "outdoor_play", label: "Active and enjoys outdoor play", category: "PHYSICAL DEVELOPMENT" },
  { id: "coordination", label: "Shows good physical co-ordination", category: "PHYSICAL DEVELOPMENT" },
  { id: "clean_clothes", label: "Wears clean clothes", category: "HEALTH" },
  { id: "bladder_control", label: "Good control of bladder", category: "HEALTH" },
  { id: "toilet_habits", label: "Attends Toilet at acceptable place and times", category: "HEALTH" },
  { id: "eats_tidily", label: "Eats tidily and independently", category: "HEALTH" },
  { id: "washes_hands", label: "Washes and cleans hands after toilet, meals play", category: "HEALTH" },
  { id: "cheerful", label: "Remain cheerful?", category: "EMOTIONAL AND SOCIAL DEVELOPMENT" },
  { id: "cooperation", label: "Mix with others and show co-operation?", category: "EMOTIONAL AND SOCIAL DEVELOPMENT" },
  { id: "confidence", label: "Show confidence during different situations?", category: "EMOTIONAL AND SOCIAL DEVELOPMENT" },
  { id: "aggression", label: "Show aggression?", category: "EMOTIONAL AND SOCIAL DEVELOPMENT" },
  { id: "concentration", label: "Concentration - follows activity to conclusion", category: "COGNITIVE AND LANGUAGE DEVELOPMENT" },
  { id: "rhymes_songs", label: "Can recite rhymes and sing action songs", category: "COGNITIVE AND LANGUAGE DEVELOPMENT" },
  { id: "questions_reports", label: "Ask questions and describe an activity and reports", category: "COGNITIVE AND LANGUAGE DEVELOPMENT" },
  { id: "common_objects", label: "Tell name, sex, age and common objects", category: "COGNITIVE AND LANGUAGE DEVELOPMENT" },
  { id: "puzzles", label: "Solve simple puzzles (sorting, matching)", category: "COGNITIVE AND LANGUAGE DEVELOPMENT" },
  { id: "simple_words", label: "Understand and use simple words/sentences/gestures", category: "COGNITIVE AND LANGUAGE DEVELOPMENT" },
  { id: "blocks_logos", label: "Scribble/paint and construct with blocks, logos etc", category: "COGNITIVE AND LANGUAGE DEVELOPMENT" },
  { id: "fill_pour_polish", label: "Can fill, pour, polish, fold and thread", category: "COGNITIVE AND LANGUAGE DEVELOPMENT" },
  { id: "patterns", label: "Scribble, do patterns", category: "COGNITIVE AND LANGUAGE DEVELOPMENT" },
  { id: "pictures", label: "Describes pictures", category: "COGNITIVE AND LANGUAGE DEVELOPMENT" },
  { id: "music_dance", label: "Enjoys Music, dancing, dramatisation, modelling and moulding", category: "MUSIC, ART AND CREATIVITY" },
  { id: "painting_pasting", label: "Enjoys painting, finger painting, tearing and pasting", category: "MUSIC, ART AND CREATIVITY" },
  { id: "body_parts", label: "Can recognise and mention some part of man", category: "MUSIC, ART AND CREATIVITY" },
];

const isPreschoolClass = (name: string) => {
  const n = name.toUpperCase();
  return (
    n.includes("CRECHE") || n.includes("NURSERY") || n.includes("KG") ||
    n.includes("KINDERGARTEN") || n.includes("TODDLER") || n.includes("PLAYGROUND") ||
    n === "CLASS A" || n === "CLASS B" || n === "LEVEL A" || n === "LEVEL B"
  );
};

const AssessmentItem = React.memo(({ item, student, onUpdate }: { item: any, student: BehavioralRecord, onUpdate: (id: string, field: keyof BehavioralRecord, val: any) => void }) => {
  const updateAssessment = (grade: string) => {
    const current = student.assessments || {};
    onUpdate(student.studentId, "assessments", { ...current, [item.id]: grade });
  };

  return (
    <View style={styles.tableRow}>
      <Text style={styles.itemLabelText}>{item.label}</Text>
      <View style={styles.gradeOptions}>
        {['VG', 'G', 'NES'].map(grade => (
          <TouchableOpacity
            key={grade}
            onPress={() => updateAssessment(grade)}
            style={styles.checkArea}
          >
            <View style={[
              styles.radioCircle,
              student.assessments?.[item.id] === grade && styles.radioCircleActive
            ]}>
              {student.assessments?.[item.id] === grade && <View style={styles.radioInner} />}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
});

export default function PreschoolRemarks() {
  const router = useRouter();
  const {
    loading,
    syncing,
    myClasses,
    selectedClassId,
    setSelectedClassId,
    allStudents,
    updateRecord,
    saveRecords,
    academicYear,
    term,
  } = useBehavioralRecords();

  const [selectedStudentId, setSelectedStudentId] = useState("");
  const isMounted = useRef(true);
  const isNavigating = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const currentStudent = allStudents.find(s => s.studentId === (selectedStudentId || allStudents[0]?.studentId));
  const selectedClass = myClasses.find(c => c.id === selectedClassId);
  const selectedClassName = selectedClass?.name || "";
  const isPreschool = selectedClass?.department === "Pre-School" || isPreschoolClass(selectedClassName);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  const assessmentGroups = PRESCHOOL_ASSESSMENTS.reduce((acc, curr) => {
    if (!acc[curr.category]) acc[curr.category] = [];
    acc[curr.category].push(curr);
    return acc;
  }, {} as Record<string, typeof PRESCHOOL_ASSESSMENTS>);

  const updatePhysical = (field: string, val: string) => {
    if (!currentStudent) return;
    const current = currentStudent.physicalDev || {};
    updateRecord(currentStudent.studentId, "physicalDev", { ...current, [field]: val });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.headerCompact}>
        <TouchableOpacity
          onPress={() => {
            if (isNavigating.current) return;
            isNavigating.current = true;
            router.back();
          }}
          style={styles.backBtn}
        >
          <SVGIcon name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 15 }}>
          <Text style={styles.headerTitleDark}>Behavioral Remarks</Text>
          <Text style={styles.headerSubtitleDark}>{academicYear} • {term}</Text>
        </View>
        <TouchableOpacity onPress={saveRecords} style={styles.headerSaveBtn}><Text style={styles.headerSaveText}>SAVE ALL</Text></TouchableOpacity>
      </View>

      <View style={styles.topSelectors}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.classScroll}>
          {myClasses.map(c => (
            <TouchableOpacity key={c.id} onPress={() => setSelectedClassId(c.id)} style={[styles.classTab, selectedClassId === c.id && styles.classTabActive]}>
              <Text style={[styles.classTabText, selectedClassId === c.id && styles.classTabTextActive]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.studentScroll}>
          {allStudents.map(s => (
            <TouchableOpacity
              key={s.studentId}
              onPress={() => {
                if (isNavigating.current) return;
                isNavigating.current = true;
                setSelectedStudentId(s.studentId);
                setTimeout(() => { isNavigating.current = false; }, 500);
              }}
              style={[styles.studentTab, (selectedStudentId || allStudents[0]?.studentId) === s.studentId && styles.studentTabActive]}
            >
              <Text style={[styles.studentTabText, (selectedStudentId || allStudents[0]?.studentId) === s.studentId && styles.studentTabTextActive]}>{s.fullName.split(' ')[0]}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {syncing ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.primary} /><Text style={styles.syncText}>Syncing records...</Text></View>
      ) : currentStudent ? (
        <ScrollView style={styles.mainScroll} contentContainerStyle={{ paddingBottom: 120 }} removeClippedSubviews={true}>
          <View style={styles.studentHeader}>
            <Text style={styles.studentFullName}>{currentStudent.fullName}</Text>
            {isPreschool && (
              <View style={styles.gradingKey}>
                <Text style={styles.keyItem}><Text style={styles.keyBold}>VG:</Text> Very Good</Text>
                <Text style={styles.keyItem}><Text style={styles.keyBold}>G:</Text> Good</Text>
                <Text style={styles.keyItem}><Text style={styles.keyBold}>NES:</Text> Needs Effort</Text>
              </View>
            )}
          </View>

          {!isPreschool ? (
            <View style={styles.standardRemarks}>
              <View style={styles.grid}>
                <View style={styles.inputBox}><Text style={styles.label}>CONDUCT</Text><TextInput value={currentStudent.conduct} onChangeText={(v) => updateRecord(currentStudent.studentId, "conduct", v)} style={styles.input} placeholder="e.g. Excellent" /></View>
                <View style={styles.inputBox}><Text style={styles.label}>INTEREST</Text><TextInput value={currentStudent.interest} onChangeText={(v) => updateRecord(currentStudent.studentId, "interest", v)} style={styles.input} placeholder="e.g. Reading" /></View>
                <View style={styles.inputBox}><Text style={styles.label}>ATTITUDE</Text><TextInput value={currentStudent.attitude} onChangeText={(v) => updateRecord(currentStudent.studentId, "attitude", v)} style={styles.input} placeholder="e.g. Positive" /></View>
                <View style={styles.inputBox}><Text style={styles.label}>PROMOTED TO</Text><TextInput value={currentStudent.promotedTo} onChangeText={(v) => updateRecord(currentStudent.studentId, "promotedTo", v)} style={styles.input} placeholder="Next Class" /></View>
              </View>
            </View>
          ) : (
            <View style={styles.preschoolContent}>
              <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>PHYSICAL DEVELOPMENT (H/W)</Text></View>
              <View style={styles.hwGrid}>
                <View style={styles.hwRow}>
                  <View style={{ flex: 1.5 }}>
                    <Text style={styles.hwLabel}>DATE</Text>
                    <TextInput style={styles.hwInputSingle} placeholder="Date" value={currentStudent.physicalDev?.date} onChangeText={(v) => updatePhysical("date", v)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.hwLabel}>HEIGHT (m)</Text>
                    <TextInput style={styles.hwInputSingle} placeholder="Height" value={currentStudent.physicalDev?.height} onChangeText={(v) => updatePhysical("height", v)} keyboardType="numeric" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.hwLabel}>WEIGHT (kg)</Text>
                    <TextInput style={styles.hwInputSingle} placeholder="Weight" value={currentStudent.physicalDev?.weight} onChangeText={(v) => updatePhysical("weight", v)} keyboardType="numeric" />
                  </View>
                </View>
              </View>

              <View style={styles.tableContainer}>
                {Object.entries(assessmentGroups).map(([category, items]) => (
                  <View key={category} style={styles.categorySection}>
                    <View style={styles.tableHeadRow}><Text style={styles.categoryNameText}>{category}</Text><View style={styles.headGrades}><Text style={styles.headGradeLabel}>VG</Text><Text style={styles.headGradeLabel}>G</Text><Text style={styles.headGradeLabel}>NES</Text></View></View>
                    {items.map(item => <AssessmentItem key={item.id} item={item} student={currentStudent} onUpdate={updateRecord} />)}
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.remarksSection}>
            <Text style={styles.remarksLabel}>TEACHER'S GENERAL REMARKS</Text>
            <TextInput style={styles.remarksInput} multiline placeholder="General comments on conduct and performance..." value={currentStudent.teacherRemarks} onChangeText={(t) => updateRecord(currentStudent.studentId, "teacherRemarks", t)} />
          </View>
        </ScrollView>
      ) : (
        <View style={styles.emptyState}><Text style={styles.emptyStateText}>No students found</Text></View>
      )}

      {allStudents.length > 0 && (
        <TouchableOpacity onPress={saveRecords} style={styles.fabSave}>
          <LinearGradient colors={[COLORS.primary, "#4F46E5"]} style={styles.fabGrad}><SVGIcon name="cloud-upload" size={24} color="#fff" /><Text style={styles.fabText}>SAVE ALL RECORDS</Text></LinearGradient>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerCompact: { flexDirection: "row", alignItems: "center", padding: 15, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  backBtn: { padding: 5 },
  headerTitleDark: { fontSize: 18, fontWeight: "900", color: "#1E293B" },
  headerSubtitleDark: { fontSize: 12, color: "#64748B", fontWeight: "700" },
  headerSaveBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10 },
  headerSaveText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  topSelectors: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  classScroll: { paddingHorizontal: 15, paddingVertical: 10 },
  classTab: { paddingHorizontal: 15, paddingVertical: 6, borderRadius: 20, backgroundColor: "#F1F5F9", marginRight: 10, borderWidth: 1, borderColor: "#E2E8F0" },
  classTabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  classTabText: { fontSize: 12, fontWeight: "700", color: "#64748B" },
  classTabTextActive: { color: "#fff" },
  studentScroll: { paddingHorizontal: 15, paddingBottom: 10 },
  studentTab: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, backgroundColor: "#fff", marginRight: 8, borderWidth: 1, borderColor: "#CBD5E1" },
  studentTabActive: { backgroundColor: "#1E293B", borderColor: "#1E293B" },
  studentTabText: { fontSize: 11, fontWeight: "700", color: "#64748B" },
  studentTabTextActive: { color: "#fff" },
  mainScroll: { flex: 1 },
  studentHeader: { padding: 20, backgroundColor: "#fff", marginBottom: 10 },
  studentFullName: { fontSize: 22, fontWeight: "900", color: "#1E293B", marginBottom: 5 },
  gradingKey: { flexDirection: "row", gap: 15 },
  keyItem: { fontSize: 10, color: "#64748B" },
  keyBold: { fontWeight: "900", color: "#475569" },
  standardRemarks: { padding: 20, backgroundColor: "#fff" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  inputBox: { width: "48%", marginBottom: 15 },
  label: { fontSize: 10, fontWeight: "900", color: "#94A3B8", marginBottom: 5 },
  input: { backgroundColor: "#F8FAFC", borderRadius: 10, padding: 12, fontSize: 13, fontWeight: "700", color: "#1E293B", borderWidth: 1, borderColor: "#E2E8F0" },
  preschoolContent: { backgroundColor: "#fff" },
  sectionHeader: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: "#F8FAFC", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  sectionTitle: { fontSize: 11, fontWeight: "900", color: COLORS.primary },
  hwGrid: { padding: 20 },
  hwRow: { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 12 },
  hwLabel: { fontSize: 10, fontWeight: "900", color: "#94A3B8", marginBottom: 5, textTransform: 'uppercase' },
  hwInputSingle: { backgroundColor: "#F1F5F9", borderRadius: 10, padding: 10, fontSize: 13, fontWeight: "700", color: "#1E293B", borderWidth: 1, borderColor: "#E2E8F0" },
  tableContainer: { backgroundColor: "#fff" },
  categorySection: { marginBottom: 10 },
  tableHeadRow: { flexDirection: "row", backgroundColor: "#F1F5F9", padding: 12, alignItems: "center" },
  categoryNameText: { flex: 1, fontSize: 11, fontWeight: "900", color: COLORS.primary },
  headGrades: { flexDirection: "row", width: 120, justifyContent: "space-between" },
  headGradeLabel: { width: 35, textAlign: "center", fontSize: 10, fontWeight: "900", color: "#64748B" },
  tableRow: { flexDirection: "row", padding: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
  itemLabelText: { flex: 1, fontSize: 12, color: "#334155", fontWeight: "600", paddingRight: 10 },
  gradeOptions: { flexDirection: "row", width: 120, justifyContent: "space-between" },
  checkArea: { width: 35, alignItems: "center", justifyContent: "center" },
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#CBD5E1", alignItems: "center", justifyContent: "center" },
  radioCircleActive: { borderColor: COLORS.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  remarksSection: { padding: 20, backgroundColor: "#fff", marginTop: 10 },
  remarksLabel: { fontSize: 11, fontWeight: "900", color: "#64748B", marginBottom: 10 },
  remarksInput: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, padding: 15, fontSize: 14, color: "#1E293B", minHeight: 100, textAlignVertical: "top" },
  fabSave: { position: "absolute", bottom: 30, left: 20, right: 20, borderRadius: 20, ...SHADOWS.large, overflow: "hidden" },
  fabGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 18, gap: 12 },
  fabText: { color: "#fff", fontWeight: "900", fontSize: 15, letterSpacing: 1 },
  syncText: { marginTop: 10, color: "#64748B", fontWeight: "700" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyStateText: { fontSize: 14, color: "#64748B", textAlign: "center", marginTop: 10 },
});
