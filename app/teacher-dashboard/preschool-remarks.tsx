import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  query,
  serverTimestamp,
  setDoc,
  where,
  getDocsFromServer,
} from "firebase/firestore";
import React, { useEffect, useState, useMemo } from "react";
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
  Dimensions,
} from "react-native";
import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { db } from "../../firebaseConfig";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";
import { sortClasses, getTeacherClasses } from "../../lib/classHelpers";

const { width } = Dimensions.get("window");

const PRESCHOOL_KEYWORDS = ["CRECHE", "NURSERY", "KG", "KINDERGARTEN", "TODDLER", "PLAYGROUND", "CLASS A", "CLASS B", "LEVEL A", "LEVEL B"];

const isPreschoolClass = (name: string) => {
  const n = name.toUpperCase();
  return PRESCHOOL_KEYWORDS.some(kw => n.includes(kw));
};

const CATEGORIES = [
  {
    name: "PHYSICAL DEVELOPMENT",
    items: [
      { id: "throw_catch_kick", label: "Can throw, catch and kick a ball" },
      { id: "outdoor_play", label: "Active and enjoys outdoor play" },
      { id: "coordination", label: "Shows good physical co-ordination" },
    ],
  },
  {
    name: "HEALTH",
    items: [
      { id: "clean_clothes", label: "Wears clean clothes" },
      { id: "bladder_control", label: "Good control of bladder" },
      { id: "toilet_habits", label: "Attends Toilet at acceptable place and times" },
      { id: "eats_tidily", label: "Eats tidily and independently" },
      { id: "washes_hands", label: "Washes and cleans hands after toilet, meals play" },
    ],
  },
  {
    name: "EMOTIONAL AND SOCIAL DEVELOPMENT",
    items: [
      { id: "cheerful", label: "Remain cheerful?" },
      { id: "cooperation", label: "Mix with others and show co-operation?" },
      { id: "confidence", label: "Show confidence during different situations?" },
      { id: "aggression", label: "Show aggression?" },
    ],
  },
  {
    name: "COGNITIVE AND LANGUAGE DEVELOPMENT",
    items: [
      { id: "concentration", label: "Concentration – follows activity to conclusion" },
      { id: "rhymes_songs", label: "Can recite rhymes and sing action songs" },
      { id: "questions_reports", label: "Ask questions and describe an activity and reports" },
      { id: "common_objects", label: "Tell name, sex, age and common objects" },
      { id: "puzzles", label: "Solve simple puzzles (sorting, matching)" },
      { id: "simple_words", label: "Understand and use simple words/sentences/gestures" },
      { id: "blocks_logos", label: "Scribble/paint and construct with blocks, logos etc" },
      { id: "fill_pour_polish", label: "Can fill, pour, polish, fold and thread" },
      { id: "patterns", label: "Scribble, do patterns" },
      { id: "pictures", label: "Describes pictures" },
    ],
  },
  {
    name: "MUSIC, ART AND CREATIVITY",
    items: [
      { id: "music_dance", label: "Enjoys Music, dancing, dramatisation, modelling and moulding" },
      { id: "painting_pasting", label: "Enjoys painting, finger painting, tearing and pasting" },
      { id: "body_parts", label: "Can recognise and mention some part of man" },
    ],
  },
];

interface StudentRecord {
  studentId: string;
  fullName: string;
  assessments: Record<string, string>;
  teacherRemarks: string;
}

export default function PreschoolRemarks() {
  const router = useRouter();
  const { appUser, loading: authLoading } = useAuth();
  const acadConfig = useAcademicConfig();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [preschoolClasses, setPreschoolClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [allStudents, setAllStudents] = useState<StudentRecord[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");

  const selectedYear = acadConfig.academicYear || "";
  const term = acadConfig.currentTerm || "";

  const isAuthorized = useMemo(() => {
    if (!appUser) return false;
    if (appUser.role === "admin") return true;

    const teacherClasses = getTeacherClasses(appUser);
    return teacherClasses.length > 0;
  }, [appUser]);

  useEffect(() => {
    if (!appUser || !isAuthorized) {
      if (!authLoading && !appUser) setLoading(false);
      return;
    }
    const fetchPreschoolClasses = async () => {
      try {
        const userRole = (appUser.role || "").toLowerCase();
        let q;

        if (userRole === "admin") {
          q = query(collection(db, "classes"));
        } else {
          const teacherClasses = getTeacherClasses(appUser);
          if (teacherClasses.length === 0) {
            setLoading(false);
            return;
          }
          q = query(collection(db, "classes"), where("__name__", "in", teacherClasses.slice(0, 30)));
        }

        const snap = await getDocsFromServer(q);
        const list = snap.docs
          .map((d) => ({
            id: d.id,
            name: (d.data() as any).name || d.id,
          }))
          .filter(c => isPreschoolClass(c.name));

        const sorted = sortClasses(list);
        setPreschoolClasses(sorted);
        if (sorted.length > 0) setSelectedClassId(sorted[0].id);
      } catch (err) {
        console.error("fetchPreschoolClasses error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPreschoolClasses();
  }, [appUser, isAuthorized]);

  useEffect(() => {
    if (!selectedClassId || !selectedYear || !term) return;
    const syncRecords = async () => {
      setSyncing(true);
      try {
        const yearSlug = selectedYear.replace(/\//g, "-");
        const docId = `behavioral_${selectedClassId}_${yearSlug}_${term.replace(/\s+/g, "")}`;
        const docSnap = await getDoc(doc(db, "behavioralRecords", docId));

        if (docSnap.exists()) {
          const data = docSnap.data();
          const students = data.students || [];
          setAllStudents(students);
          if (students.length > 0) setSelectedStudentId(students[0].studentId);
        } else {
          const q = query(
            collection(db, "users"),
            where("role", "==", "student"),
            where("classId", "==", selectedClassId),
          );
          const snap = await getDocsFromServer(q);
          const mapped = snap.docs
            .map((d: any) => ({ uid: d.id, ...d.data() }))
            .filter((data: any) => ["active", "pending_activation"].includes(data.status))
            .map((data: any) => ({
              studentId: data.uid,
              fullName: `${data.profile?.firstName || ""} ${data.profile?.lastName || ""}`.trim() || "Unknown Student",
              assessments: {},
              teacherRemarks: "",
            }));

          mapped.sort((a, b) => a.fullName.localeCompare(b.fullName));
          setAllStudents(mapped);
          if (mapped.length > 0) setSelectedStudentId(mapped[0].studentId);
        }
      } catch (err) {
        console.error("syncRecords Error:", err);
        showToast({ message: "Error loading students.", type: "error" });
      } finally {
        setSyncing(false);
      }
    };
    syncRecords();
  }, [selectedClassId, selectedYear, term]);

  const updateAssessment = (studentId: string, itemId: string, grade: string) => {
    setAllStudents(prev => prev.map(s => {
      if (s.studentId === studentId) {
        return {
          ...s,
          assessments: { ...s.assessments, [itemId]: grade }
        };
      }
      return s;
    }));
  };

  const updateRemarks = (studentId: string, text: string) => {
    setAllStudents(prev => prev.map(s => {
      if (s.studentId === studentId) {
        return { ...s, teacherRemarks: text };
      }
      return s;
    }));
  };

  const saveRecords = async () => {
    if (!selectedClassId || !selectedYear || !term) return;
    try {
      const yearSlug = selectedYear.replace(/\//g, "-");
      const docId = `behavioral_${selectedClassId}_${yearSlug}_${term.replace(/\s+/g, "")}`;
      await setDoc(doc(db, "behavioralRecords", docId), {
        docId,
        classId: selectedClassId,
        academicYear: selectedYear,
        term,
        students: allStudents,
        studentIds: allStudents.map((s) => s.studentId),
        updatedBy: appUser?.uid,
        timestamp: serverTimestamp(),
      });
      showToast({ message: "Preschool remarks saved!", type: "success" });
    } catch (err) {
      showToast({ message: "Save failed", type: "error" });
    }
  };

  if (loading || acadConfig.loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (preschoolClasses.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerCompact}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <SVGIcon name="arrow-back" size={24} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.headerTitleDark}>Preschool Remarks</Text>
        </View>
        <View style={styles.emptyState}>
          <SVGIcon name="lock-closed" size={60} color="#CBD5E1" />
          <Text style={styles.emptyStateTitle}>Access Restricted</Text>
          <Text style={styles.emptyStateText}>
            This screen is only accessible to teachers assigned to Preschool classes (Creche, Nursery, KG, etc.).
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentStudent = allStudents.find(s => s.studentId === selectedStudentId);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.headerCompact}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <SVGIcon name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 15 }}>
          <Text style={styles.headerTitleDark}>Preschool Remarks</Text>
          <Text style={styles.headerSubtitleDark}>{selectedYear} • {term}</Text>
        </View>
        <TouchableOpacity onPress={saveRecords} style={styles.headerSaveBtn}>
          <Text style={styles.headerSaveText}>SAVE</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.topSelectors}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.classScroll}>
          {preschoolClasses.map(c => (
            <TouchableOpacity
              key={c.id}
              onPress={() => setSelectedClassId(c.id)}
              style={[styles.classTab, selectedClassId === c.id && styles.classTabActive]}
            >
              <Text style={[styles.classTabText, selectedClassId === c.id && styles.classTabTextActive]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.studentScroll}>
          {allStudents.map(s => (
            <TouchableOpacity
              key={s.studentId}
              onPress={() => setSelectedStudentId(s.studentId)}
              style={[styles.studentTab, selectedStudentId === s.studentId && styles.studentTabActive]}
            >
              <Text style={[styles.studentTabText, selectedStudentId === s.studentId && styles.studentTabTextActive]}>
                {s.fullName.split(' ')[0]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {syncing ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={styles.syncText}>Syncing records...</Text>
        </View>
      ) : currentStudent ? (
        <ScrollView style={styles.mainScroll} contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={styles.studentHeader}>
            <Text style={styles.studentFullName}>{currentStudent.fullName}</Text>
            <View style={styles.gradingKey}>
              <Text style={styles.keyItem}><Text style={styles.keyBold}>VG:</Text> Very Good</Text>
              <Text style={styles.keyItem}><Text style={styles.keyBold}>G:</Text> Good</Text>
              <Text style={styles.keyItem}><Text style={styles.keyBold}>NES:</Text> Needs Effort</Text>
            </View>
          </View>

          <View style={styles.tableContainer}>
            {CATEGORIES.map(cat => (
              <View key={cat.name} style={styles.categorySection}>
                <View style={styles.tableHeadRow}>
                  <Text style={styles.categoryNameText}>{cat.name}</Text>
                  <View style={styles.headGrades}>
                    <Text style={styles.headGradeLabel}>VG</Text>
                    <Text style={styles.headGradeLabel}>G</Text>
                    <Text style={styles.headGradeLabel}>NES</Text>
                  </View>
                </View>
                {cat.items.map(item => (
                  <View key={item.id} style={styles.tableRow}>
                    <Text style={styles.itemLabelText}>{item.label}</Text>
                    <View style={styles.gradeOptions}>
                      {['VG', 'G', 'NES'].map(grade => (
                        <TouchableOpacity
                          key={grade}
                          onPress={() => updateAssessment(currentStudent.studentId, item.id, grade)}
                          style={styles.checkArea}
                        >
                          <View style={[
                            styles.radioCircle,
                            currentStudent.assessments[item.id] === grade && styles.radioCircleActive
                          ]}>
                            {currentStudent.assessments[item.id] === grade && <View style={styles.radioInner} />}
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>

          <View style={styles.remarksSection}>
            <Text style={styles.remarksLabel}>TEACHER'S GENERAL REMARKS</Text>
            <TextInput
              style={styles.remarksInput}
              multiline
              placeholder="Enter general comments about the student's progress..."
              value={currentStudent.teacherRemarks}
              onChangeText={(t) => updateRemarks(currentStudent.studentId, t)}
            />
          </View>
        </ScrollView>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No students found in this class.</Text>
        </View>
      )}

      {allStudents.length > 0 && (
        <TouchableOpacity onPress={saveRecords} style={styles.fabSave}>
          <LinearGradient colors={[COLORS.primary, "#4F46E5"]} style={styles.fabGrad}>
            <SVGIcon name="cloud-upload" size={24} color="#fff" />
            <Text style={styles.fabText}>SAVE ALL RECORDS</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerCompact: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backBtn: { padding: 5 },
  headerTitleDark: { fontSize: 18, fontWeight: "900", color: "#1E293B" },
  headerSubtitleDark: { fontSize: 12, color: "#64748B", fontWeight: "700" },
  headerSaveBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 10,
  },
  headerSaveText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  topSelectors: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  classScroll: { paddingHorizontal: 15, paddingVertical: 10 },
  classTab: {
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  classTabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  classTabText: { fontSize: 12, fontWeight: "700", color: "#64748B" },
  classTabTextActive: { color: "#fff" },
  studentScroll: { paddingHorizontal: 15, paddingBottom: 10 },
  studentTab: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#fff",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  studentTabActive: { backgroundColor: "#1E293B", borderColor: "#1E293B" },
  studentTabText: { fontSize: 11, fontWeight: "700", color: "#64748B" },
  studentTabTextActive: { color: "#fff" },
  mainScroll: { flex: 1 },
  studentHeader: { padding: 20, backgroundColor: "#fff", marginBottom: 10 },
  studentFullName: { fontSize: 22, fontWeight: "900", color: "#1E293B", marginBottom: 5 },
  gradingKey: { flexDirection: "row", gap: 15 },
  keyItem: { fontSize: 10, color: "#64748B" },
  keyBold: { fontWeight: "900", color: "#475569" },
  tableContainer: { backgroundColor: "#fff" },
  categorySection: { marginBottom: 20 },
  tableHeadRow: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    padding: 12,
    alignItems: "center",
  },
  categoryNameText: { flex: 1, fontSize: 12, fontWeight: "900", color: COLORS.primary },
  headGrades: { flexDirection: "row", width: 120, justifyContent: "space-between" },
  headGradeLabel: { width: 35, textAlign: "center", fontSize: 10, fontWeight: "900", color: "#64748B" },
  tableRow: {
    flexDirection: "row",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    alignItems: "center",
  },
  itemLabelText: { flex: 1, fontSize: 12, color: "#334155", fontWeight: "600", paddingRight: 10 },
  gradeOptions: { flexDirection: "row", width: 120, justifyContent: "space-between" },
  checkArea: { width: 35, alignItems: "center", justifyContent: "center" },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  radioCircleActive: { borderColor: COLORS.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  remarksSection: { padding: 20, backgroundColor: "#fff", marginTop: 10 },
  remarksLabel: { fontSize: 11, fontWeight: "900", color: "#64748B", marginBottom: 10 },
  remarksInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 15,
    fontSize: 14,
    color: "#1E293B",
    minHeight: 100,
    textAlignVertical: "top",
  },
  fabSave: {
    position: "absolute",
    bottom: 30,
    left: 20,
    right: 20,
    borderRadius: 20,
    ...SHADOWS.large,
    overflow: "hidden",
  },
  fabGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    gap: 12,
  },
  fabText: { color: "#fff", fontWeight: "900", fontSize: 15, letterSpacing: 1 },
  syncText: { marginTop: 10, color: "#64748B", fontWeight: "700" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyStateTitle: { fontSize: 20, fontWeight: "900", color: "#1E293B", marginTop: 20 },
  emptyStateText: { fontSize: 14, color: "#64748B", textAlign: "center", marginTop: 10 },
});
