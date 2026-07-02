import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getDocsFromServer,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
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
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { db } from "../../firebaseConfig";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";
import { sortClasses, getTeacherClasses } from "../../lib/classHelpers";

interface ClassData {
  id: string;
  name: string;
  classTeacherId?: string;
}

interface BehavioralRecord {
  studentId: string;
  fullName: string;
  conduct: string;
  interest: string;
  attitude: string;
  teacherRemarks: string;
  promotedTo?: string;
  attendanceTotal?: string;
  attendanceOutOf?: string;
  // Preschool extensions
  physicalDev?: {
    date1?: string;
    height1?: string;
    weight1?: string;
    date2?: string;
    height2?: string;
    weight2?: string;
    date3?: string;
    height3?: string;
    weight3?: string;
  };
  assessments?: Record<string, string>;
}

const PRESCHOOL_ASSESSMENTS = [
  {
    id: "canThrowCatchKick",
    label: "Can throw, catch and kick a ball",
    category: "PHYSICAL DEVELOPMENT",
  },
  {
    id: "activeOutdoorPlay",
    label: "Active and enjoys outdoor play",
    category: "PHYSICAL DEVELOPMENT",
  },
  {
    id: "goodPhysicalCoordination",
    label: "Shows good physical co-ordination",
    category: "PHYSICAL DEVELOPMENT",
  },
  {
    id: "wearsCleanClothes",
    label: "Wears clean clothes",
    category: "HEALTH",
  },
  {
    id: "bladderControl",
    label: "Good control of bladder",
    category: "HEALTH",
  },
  {
    id: "attendsToilet",
    label: "Attends Toilet at acceptable place and times",
    category: "HEALTH",
  },
  {
    id: "eatsTidily",
    label: "Eats tidily and independently",
    category: "HEALTH",
  },
  {
    id: "washesHands",
    label: "Washes and cleans hands after toilet, meals play",
    category: "HEALTH",
  },
  {
    id: "remainCheerful",
    label: "Remain cheerful?",
    category: "EMOTIONAL AND SOCIAL DEVELOPMENT",
  },
  {
    id: "mixWithOthers",
    label: "Mix with others and show co-operation?",
    category: "EMOTIONAL AND SOCIAL DEVELOPMENT",
  },
  {
    id: "showConfidence",
    label: "Show confidence during different situations?",
    category: "EMOTIONAL AND SOCIAL DEVELOPMENT",
  },
  {
    id: "showAggression",
    label: "Show aggression?",
    category: "EMOTIONAL AND SOCIAL DEVELOPMENT",
  },
  {
    id: "concentration",
    label: "Concentration - follows activity to conclusion",
    category: "COGNITIVE AND LANGUAGE DEVELOPMENT",
  },
  {
    id: "reciteRhymes",
    label: "Can recite rhymes and sing action songs",
    category: "COGNITIVE AND LANGUAGE DEVELOPMENT",
  },
  {
    id: "askQuestions",
    label: "Ask questions and describe an activity and reports",
    category: "COGNITIVE AND LANGUAGE DEVELOPMENT",
  },
  {
    id: "tellNameAge",
    label: "Tell name, sex, age and common objects",
    category: "COGNITIVE AND LANGUAGE DEVELOPMENT",
  },
  {
    id: "solvePuzzles",
    label: "Solve simple puzzles (sorting, matching)",
    category: "COGNITIVE AND LANGUAGE DEVELOPMENT",
  },
  {
    id: "understandWords",
    label: "Understand and use simple words/sentences/gestures",
    category: "COGNITIVE AND LANGUAGE DEVELOPMENT",
  },
  {
    id: "scribblePaint",
    label: "Scribble/paint and construct with blocks, logos etc",
    category: "COGNITIVE AND LANGUAGE DEVELOPMENT",
  },
  {
    id: "fillPourPolish",
    label: "Can fill, pour, polish, fold and thread",
    category: "COGNITIVE AND LANGUAGE DEVELOPMENT",
  },
  {
    id: "scribblePatterns",
    label: "Scribble, do patterns",
    category: "COGNITIVE AND LANGUAGE DEVELOPMENT",
  },
  {
    id: "describePictures",
    label: "Describes pictures",
    category: "COGNITIVE AND LANGUAGE DEVELOPMENT",
  },
  {
    id: "enjoysMusic",
    label: "Enjoys Music, dancing, dramatisation, modelling and moulding",
    category: "MUSIC, ART AND CREATIVITY",
  },
  {
    id: "enjoysPainting",
    label: "Enjoys painting, finger painting, tearing and pasting",
    category: "MUSIC, ART AND CREATIVITY",
  },
  {
    id: "recognisePartMan",
    label: "Can recognise and mention some part of man",
    category: "MUSIC, ART AND CREATIVITY",
  },
];

const isPreschoolClass = (name: string) => {
  const n = name.toUpperCase();
  return (
    n.includes("CRECHE") ||
    n.includes("NURSERY") ||
    n.includes("KG") ||
    n.includes("KINDERGARTEN") ||
    n.includes("TODDLER") ||
    n.includes("PLAYGROUND") ||
    n === "CLASS A" ||
    n === "CLASS B" ||
    n === "LEVEL A" ||
    n === "LEVEL B"
  );
};

const StudentBehavioralCard = React.memo(
  ({
    student,
    onUpdate,
  }: {
    student: BehavioralRecord;
    onUpdate: (id: string, field: keyof BehavioralRecord, val: any) => void;
  }) => {
    return (
      <View style={styles.studentCard}>
        <Text style={styles.studentName}>{student.fullName}</Text>

        <View style={styles.grid}>
          <View style={styles.inputBox}>
            <Text style={styles.label}>CONDUCT</Text>
            <TextInput
              value={student.conduct}
              onChangeText={(v) => onUpdate(student.studentId, "conduct", v)}
              style={styles.input}
              placeholder="e.g. Excellent"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.label}>INTEREST</Text>
            <TextInput
              value={student.interest}
              onChangeText={(v) => onUpdate(student.studentId, "interest", v)}
              style={styles.input}
              placeholder="e.g. Reading"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.label}>ATTITUDE</Text>
            <TextInput
              value={student.attitude}
              onChangeText={(v) => onUpdate(student.studentId, "attitude", v)}
              style={styles.input}
              placeholder="e.g. Positive"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.label}>PROMOTED TO</Text>
            <TextInput
              value={student.promotedTo}
              onChangeText={(v) => onUpdate(student.studentId, "promotedTo", v)}
              style={styles.input}
              placeholder="Next Class"
            />
          </View>
        </View>

        <View style={styles.fullWidthInput}>
          <Text style={styles.label}>TEACHER'S REMARKS</Text>
          <TextInput
            value={student.teacherRemarks}
            onChangeText={(v) =>
              onUpdate(student.studentId, "teacherRemarks", v)
            }
            style={[styles.input, { minHeight: 60 }]}
            multiline
            placeholder="General comments on student's performance..."
          />
        </View>
      </View>
    );
  },
);

const PreschoolBehavioralCard = React.memo(
  ({
    student,
    onUpdate,
  }: {
    student: BehavioralRecord;
    onUpdate: (id: string, field: keyof BehavioralRecord, val: any) => void;
  }) => {
    const updateAssessment = (id: string, val: string) => {
      const current = student.assessments || {};
      onUpdate(student.studentId, "assessments", { ...current, [id]: val });
    };

    const updatePhysical = (field: string, val: string) => {
      const current = student.physicalDev || {};
      onUpdate(student.studentId, "physicalDev", { ...current, [field]: val });
    };

    const assessmentGroups = PRESCHOOL_ASSESSMENTS.reduce((acc, curr) => {
      if (!acc[curr.category]) acc[curr.category] = [];
      acc[curr.category].push(curr);
      return acc;
    }, {} as Record<string, typeof PRESCHOOL_ASSESSMENTS>);

    return (
      <View style={styles.studentCard}>
        <Text style={styles.studentName}>{student.fullName}</Text>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>PHYSICAL DEVELOPMENT (H/W)</Text>
        </View>

        <View style={styles.hwGrid}>
          <View style={styles.hwRow}>
            <Text style={[styles.hwLabel, { flex: 1 }]}>DATE</Text>
            <TextInput
              style={styles.hwInput}
              placeholder="1st"
              value={student.physicalDev?.date1}
              onChangeText={(v) => updatePhysical("date1", v)}
            />
            <TextInput
              style={styles.hwInput}
              placeholder="2nd"
              value={student.physicalDev?.date2}
              onChangeText={(v) => updatePhysical("date2", v)}
            />
            <TextInput
              style={styles.hwInput}
              placeholder="3rd"
              value={student.physicalDev?.date3}
              onChangeText={(v) => updatePhysical("date3", v)}
            />
          </View>
          <View style={styles.hwRow}>
            <Text style={[styles.hwLabel, { flex: 1 }]}>HEIGHT</Text>
            <TextInput
              style={styles.hwInput}
              placeholder="..."
              value={student.physicalDev?.height1}
              onChangeText={(v) => updatePhysical("height1", v)}
            />
            <TextInput
              style={styles.hwInput}
              placeholder="..."
              value={student.physicalDev?.height2}
              onChangeText={(v) => updatePhysical("height2", v)}
            />
            <TextInput
              style={styles.hwInput}
              placeholder="..."
              value={student.physicalDev?.height3}
              onChangeText={(v) => updatePhysical("height3", v)}
            />
          </View>
          <View style={styles.hwRow}>
            <Text style={[styles.hwLabel, { flex: 1 }]}>WEIGHT</Text>
            <TextInput
              style={styles.hwInput}
              placeholder="..."
              value={student.physicalDev?.weight1}
              onChangeText={(v) => updatePhysical("weight1", v)}
            />
            <TextInput
              style={styles.hwInput}
              placeholder="..."
              value={student.physicalDev?.weight2}
              onChangeText={(v) => updatePhysical("weight2", v)}
            />
            <TextInput
              style={styles.hwInput}
              placeholder="..."
              value={student.physicalDev?.weight3}
              onChangeText={(v) => updatePhysical("weight3", v)}
            />
          </View>
        </View>

        <View style={styles.gradingLegend}>
          <Text style={styles.legendText}>
            VG = Very Good | G = Good | NES = Needs effort
          </Text>
        </View>

        {Object.entries(assessmentGroups).map(([category, items]) => (
          <View key={category} style={styles.assessmentSection}>
            <Text style={styles.categoryTitle}>{category}</Text>
            {items.map((item) => (
              <View key={item.id} style={styles.assessmentRow}>
                <Text style={styles.assessmentLabel}>{item.label}</Text>
                <View style={styles.optionsRow}>
                  {["VG", "G", "NES"].map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => updateAssessment(item.id, opt)}
                      style={[
                        styles.optionBtn,
                        student.assessments?.[item.id] === opt &&
                          styles.optionBtnActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          student.assessments?.[item.id] === opt &&
                            styles.optionTextActive,
                        ]}
                      >
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.fullWidthInput}>
          <Text style={styles.label}>GENERAL REMARKS AND CONDUCT</Text>
          <TextInput
            value={student.teacherRemarks}
            onChangeText={(v) =>
              onUpdate(student.studentId, "teacherRemarks", v)
            }
            style={[styles.input, { minHeight: 60 }]}
            multiline
            placeholder="General comments..."
          />
        </View>
      </View>
    );
  },
);

export default function BehavioralRecords() {
  const router = useRouter();
  const { appUser } = useAuth();
  const acadConfig = useAcademicConfig();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [myClasses, setMyClasses] = useState<ClassData[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [allStudents, setAllStudents] = useState<BehavioralRecord[]>([]);

  const selectedYear = acadConfig.academicYear || "";
  const term = acadConfig.currentTerm || "";

  useEffect(() => {
    if (!appUser) return;
    const fetchMyClasses = async () => {
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
          // Limit to 30 as per Firestore 'in' operator
          q = query(collection(db, "classes"), where("__name__", "in", teacherClasses.slice(0, 30)));
        }

        const snap = await getDocsFromServer(q);
        const list = snap.docs.map((d) => ({
          id: d.id,
          name: (d.data() as any).name || d.id,
          classTeacherId: (d.data() as any).classTeacherId,
        }));
        const sorted = sortClasses(list);
        setMyClasses(sorted);
        if (sorted.length > 0) setSelectedClassId(sorted[0].id);
      } catch (err) {
        console.error("fetchMyClasses error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMyClasses();
  }, [appUser]);

  useEffect(() => {
    if (!selectedClassId || !selectedYear || !term) return;
    const syncRecords = async () => {
      setSyncing(true);
      try {
        const yearSlug = selectedYear.replace(/\//g, "-");
        const docId = `behavioral_${selectedClassId}_${yearSlug}_${term.replace(/\s+/g, "")}`;
        const docSnap = await getDoc(doc(db, "behavioralRecords", docId));

        if (docSnap.exists()) {
          setAllStudents(docSnap.data().students || []);
        } else {
          // Fetch students with the same logic as attendance
          const q = query(
            collection(db, "users"),
            where("role", "==", "student"),
            where("classId", "==", selectedClassId),
          );
          const snap = await getDocsFromServer(q);
          const mapped = snap.docs
            .map((d: any) => ({ uid: d.id, ...d.data() }))
            .filter((data: any) => ["active", "pending_activation"].includes(data.status))
            .map((data: any) => {
              return {
                studentId: data.uid,
                fullName:
                  `${data.profile?.firstName || ""} ${data.profile?.lastName || ""}`.trim() ||
                  "Unknown Student",
                conduct: "Good",
                interest: "N/A",
                attitude: "Positive",
                teacherRemarks: "",
                promotedTo: "",
              } as BehavioralRecord;
            });

          mapped.sort((a, b) => a.fullName.localeCompare(b.fullName));
          setAllStudents(mapped);
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

  const updateRecord = (
    studentId: string,
    field: keyof BehavioralRecord,
    value: any,
  ) => {
    setAllStudents((prev) =>
      prev.map((s) =>
        s.studentId === studentId ? { ...s, [field]: value } : s,
      ),
    );
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
      showToast({ message: "Behavioral records saved!", type: "success" });
      router.back();
    } catch (err) {
      showToast({ message: "Save failed", type: "error" });
    }
  };

  if (loading || acadConfig.loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[COLORS.primary, "#1E293B"]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <SVGIcon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 15 }}>
            <Text style={styles.headerTitle}>Class Teacher Remarks</Text>
            <Text style={styles.headerSubtitle}>
              {selectedYear} • {term}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        {myClasses.length > 1 && (
          <View style={styles.classSelector}>
            {myClasses.map((c) => (
              <TouchableOpacity
                key={c.id}
                onPress={() => setSelectedClassId(c.id)}
                style={[
                  styles.classTab,
                  selectedClassId === c.id && styles.classTabActive,
                ]}
              >
                <Text
                  style={[
                    styles.classTabText,
                    selectedClassId === c.id && styles.classTabTextActive,
                  ]}
                >
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {syncing ? (
          <View style={styles.syncBox}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.syncText}>Loading student records...</Text>
          </View>
        ) : allStudents.length === 0 ? (
          <View style={styles.emptyState}>
            <SVGIcon name="people-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyStateText}>
              {!selectedClassId
                ? "No class selected"
                : "No students found in this class"}
            </Text>
          </View>
        ) : (
          allStudents.map((student) => {
            const className =
              myClasses.find((c) => c.id === selectedClassId)?.name || "";
            return isPreschoolClass(className) ? (
              <PreschoolBehavioralCard
                key={student.studentId}
                student={student}
                onUpdate={updateRecord}
              />
            ) : (
              <StudentBehavioralCard
                key={student.studentId}
                student={student}
                onUpdate={updateRecord}
              />
            );
          })
        )}
      </ScrollView>

      <TouchableOpacity onPress={saveRecords} style={styles.saveBtn}>
        <LinearGradient
          colors={[COLORS.primary, "#4F46E5"]}
          style={styles.saveGrad}
        >
          <Text style={styles.saveBtnText}>SAVE CLASS REMARKS</Text>
          <SVGIcon name="checkmark-done" size={24} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    padding: 25,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    ...SHADOWS.medium,
  },
  headerContent: { flexDirection: "row", alignItems: "center" },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#fff" },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "700",
  },
  classSelector: { flexDirection: "row", gap: 10, marginBottom: 20 },
  classTab: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  classTabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  classTabText: { fontSize: 12, fontWeight: "700", color: "#64748B" },
  classTabTextActive: { color: "#fff" },
  studentCard: {
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 20,
    marginBottom: 15,
    ...SHADOWS.small,
  },
  studentName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1E293B",
    marginBottom: 15,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  inputBox: { width: "48%", marginBottom: 10 },
  fullWidthInput: { width: "100%", marginTop: 5 },
  label: { fontSize: 9, fontWeight: "900", color: "#94A3B8", marginBottom: 5 },
  input: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  sectionHeader: {
    marginTop: 10,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingBottom: 5,
  },
  sectionTitle: { fontSize: 11, fontWeight: "900", color: COLORS.primary },
  hwGrid: { marginBottom: 15 },
  hwRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 5,
  },
  hwLabel: { fontSize: 10, fontWeight: "800", color: "#64748B" },
  hwInput: {
    width: 60,
    backgroundColor: "#F1F5F9",
    borderRadius: 6,
    padding: 5,
    fontSize: 11,
    textAlign: "center",
    fontWeight: "700",
    color: "#1E293B",
  },
  gradingLegend: {
    padding: 8,
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    marginBottom: 15,
  },
  legendText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
    textAlign: "center",
  },
  assessmentSection: { marginBottom: 20 },
  categoryTitle: {
    fontSize: 10,
    fontWeight: "900",
    color: "#475569",
    marginBottom: 10,
    backgroundColor: "#F1F5F9",
    padding: 5,
    borderRadius: 4,
  },
  assessmentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  assessmentLabel: { flex: 1, fontSize: 11, fontWeight: "600", color: "#334155" },
  optionsRow: { flexDirection: "row", gap: 5 },
  optionBtn: {
    width: 35,
    height: 25,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  optionBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  optionText: { fontSize: 9, fontWeight: "800", color: "#64748B" },
  optionTextActive: { color: "#fff" },
  syncBox: { padding: 50, alignItems: "center" },
  syncText: { marginTop: 15, color: "#64748B", fontWeight: "700" },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    backgroundColor: "#fff",
    borderRadius: 20,
    marginTop: 20,
    ...SHADOWS.small,
  },
  emptyStateText: {
    marginTop: 15,
    color: "#64748B",
    fontWeight: "700",
    fontSize: 14,
    textAlign: "center",
  },
  saveBtn: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    borderRadius: 20,
    overflow: "hidden",
    ...SHADOWS.large,
  },
  saveGrad: {
    padding: 18,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  saveBtnText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 15,
    letterSpacing: 1,
  },
});
