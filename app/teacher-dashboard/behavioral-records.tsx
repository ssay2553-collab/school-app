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
import { sortClasses } from "../../lib/classHelpers";

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
}

const StudentBehavioralCard = React.memo(
  ({
    student,
    onUpdate,
  }: {
    student: BehavioralRecord;
    onUpdate: (id: string, field: keyof BehavioralRecord, val: string) => void;
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
        // Fetch classes where current user is the class teacher
        const q = query(
          collection(db, "classes"),
          where("classTeacherId", "==", appUser.uid),
        );
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
        console.error(err);
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
          // Fetch students with a simpler query to ensure it hits existing indexes
          const q = query(
            collection(db, "users"),
            where("role", "==", "student"),
            where("classId", "==", selectedClassId),
          );
          const snap = await getDocs(q);
          const mapped = snap.docs.map((d: any) => {
            const data = d.data() as any;
            // Filter out archived students client-side
            if (data.status === "archived") return null;

            return {
              studentId: d.id,
              fullName:
                `${data.profile?.firstName || ""} ${data.profile?.lastName || ""}`.trim() ||
                "Unknown Student",
              conduct: "Good",
              interest: "N/A",
              attitude: "Positive",
              teacherRemarks: "",
              promotedTo: "", // always string
            } as BehavioralRecord;
          });
          const filtered = mapped.filter(
            (s): s is BehavioralRecord => s !== null,
          );
          filtered.sort((a, b) => a.fullName.localeCompare(b.fullName));
          setAllStudents(filtered);
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
    value: string,
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
          allStudents.map((student) => (
            <StudentBehavioralCard
              key={student.studentId}
              student={student}
              onUpdate={updateRecord}
            />
          ))
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
