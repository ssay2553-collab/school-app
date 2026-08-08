import { Picker } from "@react-native-picker/picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocsFromServer,
  query,
  where,
  documentId,
} from "firebase/firestore";
import React, { useEffect, useState, useMemo } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
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

const { width } = Dimensions.get("window");

const isPreschoolClass = (classData: any) => {
  if (!classData) return false;
  const dept = (classData.department || "").toLowerCase();
  const level = String(classData.level || "").toUpperCase();
  const name = (classData.name || "").toUpperCase();

  if (dept === "pre-school") return true;
  if (["A", "B", "C", "D"].includes(level)) return true;

  const keywords = ["CRECHE", "NURSERY", "KG", "KINDERGARTEN", "TODDLER", "PLAYGROUND"];
  return keywords.some(kw => name.includes(kw));
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

const TERMS = ["Term 1", "Term 2", "Term 3"];

export default function PreschoolRemarksParent() {
  const router = useRouter();
  const { appUser } = useAuth();
  const acadConfig = useAcademicConfig();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("Term 1");
  const [selectedYear, setSelectedYear] = useState("");
  const [remarksData, setRemarksData] = useState<any>(null);

  const academicYears = useMemo(() => {
    const start = 2024;
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = start; y <= currentYear + 1; y++) {
      years.push(`${y}/${y + 1}`);
    }
    if (acadConfig.academicYear && !years.includes(acadConfig.academicYear)) {
      years.push(acadConfig.academicYear);
    }
    return Array.from(new Set(years)).sort().reverse();
  }, [acadConfig.academicYear]);

  useEffect(() => {
    if (acadConfig.academicYear) {
      setSelectedYear(acadConfig.academicYear);
      setSelectedTerm(acadConfig.currentTerm || "Term 1");
    }
  }, [acadConfig]);

  useEffect(() => {
    if (!appUser || appUser.role !== "parent") return;
    const fetchChildren = async () => {
      const ids = (appUser as any).childrenIds || [];
      if (ids.length > 0) {
        try {
          const q = query(collection(db, "users"), where(documentId(), "in", ids));
          const snap = await getDocsFromServer(q);

          // Also fetch classes to verify preschool status
          const classIds = snap.docs.map(d => (d.data() as any).classId).filter(id => !!id);
          let classMap: Record<string, any> = {};
          if (classIds.length > 0) {
            const cq = query(collection(db, "classes"), where(documentId(), "in", classIds));
            const cSnap = await getDocsFromServer(cq);
            cSnap.docs.forEach(d => {
              classMap[d.id] = { id: d.id, ...d.data() };
            });
          }

          const list = snap.docs.map((d) => {
            const data = d.data() as any;
            const classData = classMap[data.classId];
            return {
              id: d.id,
              name: `${data.profile?.firstName || ""} ${data.profile?.lastName || ""}`.trim(),
              classId: data.classId,
              className: classData?.name || data.classId,
              isPreschool: isPreschoolClass(classData),
            };
          }).filter(c => c.isPreschool);

          setChildren(list);
          if (list.length > 0) setSelectedChildId(list[0].id);
        } catch (e) {
          console.error("Error fetching children:", e);
        }
      }
      setLoading(false);
    };
    fetchChildren();
  }, [appUser]);

  useEffect(() => {
    if (selectedChildId && selectedYear && selectedTerm) {
      fetchRemarks();
    }
  }, [selectedChildId, selectedYear, selectedTerm]);

  const fetchRemarks = async () => {
    setFetching(true);
    setRemarksData(null);
    try {
      const child = children.find(c => c.id === selectedChildId);
      if (!child) return;

      const yearSlug = selectedYear.replace(/\//g, "-");
      const docId = `behavioral_${child.classId}_${yearSlug}_${selectedTerm.replace(/\s+/g, "")}`;
      const docSnap = await getDoc(doc(db, "behavioralRecords", docId));

      if (docSnap.exists()) {
        const data = docSnap.data();
        const studentRemark = (data.students || []).find((s: any) => s.studentId === selectedChildId);
        if (studentRemark) {
          setRemarksData(studentRemark);
        }
      }
    } catch (err) {
      console.error("Fetch remarks error:", err);
    } finally {
      setFetching(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (children.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <SVGIcon name="arrow-back" size={24} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Behavioral Remarks</Text>
        </View>
        <View style={styles.emptyState}>
          <SVGIcon name="information-circle" size={60} color="#CBD5E1" />
          <Text style={styles.emptyStateTitle}>No Behavioral Records</Text>
          <Text style={styles.emptyStateText}>
            This screen is only for students in preschool levels (Creche, Nursery, KG, Level A-D). None of your children appear to be in these levels.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const selectedChild = children.find(c => c.id === selectedChildId);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <SVGIcon name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 15 }}>
          <Text style={styles.headerTitle}>Behavioral Remarks</Text>
          <Text style={styles.headerSubtitle}>Progress Monitoring</Text>
        </View>
      </View>

      <ScrollView style={styles.mainScroll} contentContainerStyle={{ paddingBottom: 50 }}>
        <View style={styles.selectorCard}>
          <View style={styles.pickerBox}>
            <Text style={styles.miniLabel}>Select Child</Text>
            <Picker
              selectedValue={selectedChildId}
              onValueChange={setSelectedChildId}
              style={styles.picker}
            >
              {children.map((c) => (
                <Picker.Item key={c.id} label={c.name} value={c.id} />
              ))}
            </Picker>
          </View>

          <View style={styles.pickerRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.pickerBox}>
                <Text style={styles.miniLabel}>Academic Year</Text>
                <Picker
                  selectedValue={selectedYear}
                  onValueChange={setSelectedYear}
                  style={styles.picker}
                >
                  {academicYears.map((y) => (
                    <Picker.Item key={y} label={y} value={y} />
                  ))}
                </Picker>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.pickerBox}>
                <Text style={styles.miniLabel}>Term</Text>
                <Picker
                  selectedValue={selectedTerm}
                  onValueChange={setSelectedTerm}
                  style={styles.picker}
                >
                  {TERMS.map((t) => (
                    <Picker.Item key={t} label={t} value={t} />
                  ))}
                </Picker>
              </View>
            </View>
          </View>
        </View>

        {fetching ? (
          <View style={{ padding: 40, alignItems: "center" }}>
            <ActivityIndicator color={COLORS.primary} size="large" />
            <Text style={{ marginTop: 10, color: "#64748B" }}>Fetching remarks...</Text>
          </View>
        ) : remarksData ? (
          <AnimatableView animation="fadeIn" style={styles.reportContainer}>
            <View style={styles.studentInfoBar}>
              <Text style={styles.studentName}>{selectedChild?.name}</Text>
              <Text style={styles.className}>{selectedChild?.className}</Text>
            </View>

            <View style={styles.categoryBlock}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryTitle}>PHYSICAL DEVELOPMENT (H/W)</Text>
              </View>
              <View style={styles.hwInfoContainer}>
                <View style={styles.hwInfoItem}>
                  <Text style={styles.hwInfoLabel}>DATE</Text>
                  <Text style={styles.hwInfoValue}>{remarksData.physicalDev?.date || "-"}</Text>
                </View>
                <View style={styles.hwInfoItem}>
                  <Text style={styles.hwInfoLabel}>HEIGHT (m)</Text>
                  <Text style={styles.hwInfoValue}>{remarksData.physicalDev?.height || "-"}</Text>
                </View>
                <View style={styles.hwInfoItem}>
                  <Text style={styles.hwInfoLabel}>WEIGHT (kg)</Text>
                  <Text style={styles.hwInfoValue}>{remarksData.physicalDev?.weight || "-"}</Text>
                </View>
              </View>
            </View>

            {CATEGORIES.map(cat => (
              <View key={cat.name} style={styles.categoryBlock}>
                <View style={styles.categoryHeader}>
                  <Text style={styles.categoryTitle}>{cat.name}</Text>
                </View>
                {cat.items.map(item => (
                  <View key={item.id} style={styles.remarkRow}>
                    <Text style={styles.itemLabel}>{item.label}</Text>
                    <View style={styles.gradeBadge}>
                      <Text style={[
                        styles.gradeText,
                        remarksData.assessments?.[item.id] === 'VG' && { color: '#10b981' },
                        remarksData.assessments?.[item.id] === 'NES' && { color: '#f43f5e' },
                      ]}>
                        {remarksData.assessments?.[item.id] || "N/A"}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ))}

            <View style={styles.generalRemarksBox}>
              <Text style={styles.remarksLabel}>TEACHER'S GENERAL REMARKS</Text>
              <View style={styles.remarksContent}>
                <Text style={styles.remarksText}>
                  {remarksData.teacherRemarks || "No general remarks provided yet."}
                </Text>
              </View>
            </View>

            <View style={styles.gradingLegend}>
              <Text style={styles.legendTitle}>Grading Key:</Text>
              <View style={styles.legendRow}>
                <Text style={styles.legendItem}><Text style={{ fontWeight: '800', color: '#10b981' }}>VG:</Text> Very Good</Text>
                <Text style={styles.legendItem}><Text style={{ fontWeight: '800', color: COLORS.primary }}>G:</Text> Good</Text>
                <Text style={styles.legendItem}><Text style={{ fontWeight: '800', color: '#f43f5e' }}>NES:</Text> Needs Effort</Text>
              </View>
            </View>
          </AnimatableView>
        ) : (
          <View style={styles.noDataBox}>
            <SVGIcon name="document-text-outline" size={50} color="#CBD5E1" />
            <Text style={styles.noDataText}>No behavioral remarks found for this child in the selected period.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const AnimatableView = (props: any) => {
  const [Component, setComponent] = useState<any>(View);
  useEffect(() => {
    try {
      const Animatable = require("react-native-animatable");
      setComponent(Animatable.View);
    } catch (e) {}
  }, []);
  return <Component {...props} />;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#1E293B" },
  headerSubtitle: { fontSize: 12, color: "#64748B", fontWeight: "700" },
  mainScroll: { flex: 1 },
  selectorCard: {
    backgroundColor: "#fff",
    padding: 20,
    margin: 15,
    borderRadius: 20,
    ...SHADOWS.small,
  },
  miniLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "#94A3B8",
    position: "absolute",
    top: 12,
    left: 12,
    zIndex: 1,
    textTransform: "uppercase",
  },
  pickerBox: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    minHeight: 65,
    justifyContent: "center",
    marginBottom: 15,
    paddingTop: 12,
    position: 'relative'
  },
  picker: { height: 50, marginLeft: -10 },
  pickerRow: { flexDirection: "row", gap: 15 },
  reportContainer: { margin: 15, marginTop: 0 },
  studentInfoBar: {
    backgroundColor: "#1E293B",
    padding: 15,
    borderRadius: 15,
    marginBottom: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  studentName: { fontSize: 16, fontWeight: "900", color: "#fff" },
  className: { fontSize: 12, fontWeight: "700", color: "#94A3B8" },
  hwInfoContainer: {
    flexDirection: "row",
    padding: 15,
    backgroundColor: "#fff",
    justifyContent: "space-between",
  },
  hwInfoItem: {
    flex: 1,
    alignItems: "center",
  },
  hwInfoLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "#94A3B8",
    marginBottom: 4,
  },
  hwInfoValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
  },
  categoryBlock: {
    backgroundColor: "#fff",
    borderRadius: 20,
    marginBottom: 15,
    overflow: "hidden",
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  categoryHeader: {
    backgroundColor: "#F1F5F9",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  categoryTitle: { fontSize: 11, fontWeight: "900", color: COLORS.primary, letterSpacing: 0.5 },
  remarkRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
  },
  itemLabel: { flex: 1, fontSize: 13, color: "#334155", fontWeight: "600" },
  gradeBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 45,
    alignItems: "center",
  },
  gradeText: { fontSize: 12, fontWeight: "900", color: "#64748B" },
  generalRemarksBox: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  remarksLabel: { fontSize: 11, fontWeight: "900", color: "#64748B", marginBottom: 12, letterSpacing: 1 },
  remarksContent: {
    backgroundColor: "#F8FAFC",
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  remarksText: { fontSize: 14, color: "#1E293B", fontStyle: "italic", lineHeight: 20 },
  gradingLegend: {
    padding: 15,
    backgroundColor: "#F1F5F9",
    borderRadius: 15,
    marginBottom: 20,
  },
  legendTitle: { fontSize: 11, fontWeight: "800", color: "#64748B", marginBottom: 8 },
  legendRow: { flexDirection: "row", justifyContent: "space-between" },
  legendItem: { fontSize: 11, color: "#475569" },
  noDataBox: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  noDataText: {
    marginTop: 15,
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    fontWeight: "600",
    lineHeight: 20,
  },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyStateTitle: { fontSize: 20, fontWeight: "900", color: "#1E293B", marginTop: 20 },
  emptyStateText: { fontSize: 14, color: "#64748B", textAlign: "center", marginTop: 10, lineHeight: 22 },
});
