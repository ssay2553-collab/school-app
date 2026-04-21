import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    query,
    serverTimestamp,
    updateDoc,
    where
} from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { db } from "../../firebaseConfig";
import { getDocsCacheFirst } from "../../lib/firestoreHelpers";

type ClassItem = {
  id: string;
  name: string;
  order: number;
  level: string | number;
  department: string;
  stats?: { total: number; male: number; female: number };
};

const resolveDepartmentByLevel = (level: string | number): string => {
  const l = String(level).toUpperCase();
  if (["A", "B", "C", "D"].includes(l)) return "Pre-School";

  const numLevel = parseInt(l);
  if (numLevel >= 1 && numLevel <= 3) return "Lower Primary";
  if (numLevel >= 4 && numLevel <= 6) return "Upper Primary";
  if (numLevel >= 7 && numLevel <= 9) return "JHS";
  return "Unknown";
};

const getLevelValue = (level: string | number): number => {
  const l = String(level).toUpperCase();
  if (l === "A") return 0.1;
  if (l === "B") return 0.2;
  if (l === "C") return 0.3;
  if (l === "D") return 0.4;
  return parseInt(l) || 99;
};

export default function ClassManagementScreen() {
  const { appUser, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [newClassName, setNewClassName] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newClassLevel, setNewClassLevel] = useState<string | number | null>(null);
  const [newClassNameInput, setNewClassNameInput] = useState("");

  const levels = ["A", "B", "C", "D", 1, 2, 3, 4, 5, 6, 7, 8, 9];

  // GRANT ACCESS TO ALL ADMIN USERS (Proprietor, Headmaster, etc. all have role === 'admin')
  const isAuthorized = useMemo(() => appUser?.role?.toLowerCase() === 'admin', [appUser]);

  const fetchData = useCallback(async () => {
    if (!isAuthorized) return;
    setLoading(true);
    try {
      const classesSnap = await getDocsCacheFirst(collection(db, "classes") as any);
      const baseClasses = classesSnap.docs
        .map((d, i) => ({
          id: d.id,
          ...d.data(),
          order: (d.data() as any).order ?? i,
        }) as ClassItem)
        .filter((c: any) => !c.schoolId || c.schoolId === SCHOOL_CONFIG.schoolId);

      const studentsQuery = query(collection(db, "users"), where("role", "==", "student"));
      const studentsSnap = await getDocsCacheFirst(studentsQuery as any);

      const counts: Record<string, { total: number; male: number; female: number }> = {};
      studentsSnap.docs.forEach((d) => {
        const data = d.data() as any;
        const cid = data.classId;
        const gender = data.gender;
        if (!cid) return;
        if (!counts[cid]) counts[cid] = { total: 0, male: 0, female: 0 };
        counts[cid].total++;
        if (gender === "Male") counts[cid].male++;
        else if (gender === "Female") counts[cid].female++;
      });

      const merged = baseClasses.map((c) => ({
        ...c,
        stats: counts[c.id] || { total: 0, male: 0, female: 0 },
      }));

      setClasses(merged.sort((a, b) => getLevelValue(a.level) - getLevelValue(b.level)));
    } catch (e) {
      console.error(e);
      showToast({ message: "Failed to load class data.", type: "error" });
    } finally {
      setLoading(false);
    }
  }, [isAuthorized]);

  useEffect(() => {
    if (!authLoading) {
      if (isAuthorized) {
        fetchData();
      } else {
        setLoading(false);
      }
    }
  }, [authLoading, isAuthorized, fetchData]);

  const saveClassName = async () => {
    if (!editingClass || !newClassName.trim()) return;
    try {
      await updateDoc(doc(db, "classes", editingClass.id), { name: newClassName.trim() });
      setClasses((p) => p.map((c) => c.id === editingClass.id ? { ...c, name: newClassName.trim() } : c));
      setEditingClass(null);
      setNewClassName("");
      showToast({ message: "Class updated.", type: "success" });
    } catch {
      showToast({ message: "Update failed.", type: "error" });
    }
  };

  const addClass = async () => {
    if (!newClassNameInput.trim() || !newClassLevel) {
      showToast({ message: "Please enter a name and select a level.", type: "error" });
      return;
    }
    setLoading(true);
    try {
      const department = resolveDepartmentByLevel(newClassLevel);
      const ref = await addDoc(collection(db, "classes"), {
        name: newClassNameInput.trim(),
        level: newClassLevel,
        department,
        schoolId: SCHOOL_CONFIG.schoolId,
        order: classes.length,
        createdAt: serverTimestamp(),
      });

      const newClass: ClassItem = {
        id: ref.id,
        name: newClassNameInput.trim(),
        level: newClassLevel,
        department,
        order: classes.length,
        stats: { total: 0, male: 0, female: 0 },
      };

      setClasses((p) => [...p, newClass].sort((a, b) => getLevelValue(a.level) - getLevelValue(b.level)));
      setShowAddModal(false);
      setNewClassLevel(null);
      setNewClassNameInput("");
      showToast({ message: "Class created.", type: "success" });
    } catch {
      showToast({ message: "Failed to create class.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const deleteClass = async (cls: ClassItem) => {
    const performDelete = async () => {
      try {
        await deleteDoc(doc(db, "classes", cls.id));
        setClasses((p) => p.filter((c) => c.id !== cls.id));
        showToast({ message: `${cls.name} deleted successfully.`, type: "success" });
      } catch (e) {
        console.error("Delete failed:", e);
        showToast({ message: "Delete failed.", type: "error" });
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Are you sure you want to delete ${cls.name}?`)) {
        performDelete();
      }
    } else {
      Alert.alert("Confirm Delete", `Delete ${cls.name}?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: performDelete },
      ]);
    }
  };

  const departmentsOrder = ["Pre-School", "Lower Primary", "Upper Primary", "JHS"];
  const classesByDept = useMemo(() => classes.reduce((acc, c) => {
      if (!acc[c.department]) acc[c.department] = [];
      acc[c.department].push(c);
      return acc;
    }, {} as Record<string, ClassItem[]>), [classes]);

  if (authLoading || (loading && isAuthorized))
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );

  if (!isAuthorized)
    return (
      <View style={styles.center}>
        <SVGIcon name="alert-circle" size={50} color={COLORS.danger} />
        <Text style={{ marginTop: 10, fontWeight: "bold" }}>Access Denied</Text>
        <Text style={{ color: "#64748B", marginTop: 5 }}>Only administrators can manage classes.</Text>
      </View>
    );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
          <SVGIcon name="add-circle" size={24} color="#fff" />
          <Text style={styles.addBtnText}>Create New Class</Text>
        </TouchableOpacity>

        {departmentsOrder.map((dept) => {
          const deptClasses = classesByDept[dept];
          if (!deptClasses) return null;
          return (
            <View key={dept} style={{ marginBottom: 20 }}>
              <View style={styles.deptHeader}>
                <Text style={styles.departmentTitle}>{dept.toUpperCase()}</Text>
                <View style={styles.deptLine} />
              </View>
              {deptClasses.map((cls) => (
                <View key={cls.id} style={styles.classRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.className}>{cls.name}</Text>
                    <View style={styles.statsRow}>
                      <View style={styles.statChip}>
                        <SVGIcon name="people" size={12} color={COLORS.primary} />
                        <Text style={styles.statVal}>{cls.stats?.total || 0} Students</Text>
                      </View>
                      <View style={[styles.statChip, { backgroundColor: "#E0F2FE" }]}>
                        <Text style={[styles.statVal, { color: "#0369A1" }]}>M: {cls.stats?.male || 0}</Text>
                      </View>
                      <View style={[styles.statChip, { backgroundColor: "#FCE7F3" }]}>
                        <Text style={[styles.statVal, { color: "#BE185D" }]}>F: {cls.stats?.female || 0}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.actions}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => { setEditingClass(cls); setNewClassName(cls.name); }}>
                      <SVGIcon name="create" size={18} color={COLORS.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => deleteClass(cls)}>
                      <SVGIcon name="trash" size={18} color={COLORS.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          );
        })}

        <Modal visible={!!editingClass || showAddModal} transparent animationType="slide">
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{editingClass ? "Rename Class" : "New Class Definition"}</Text>
              <Text style={styles.modalLabel}>DISPLAY NAME</Text>
              <TextInput placeholder="e.g. Primary 1 Gold" value={editingClass ? newClassName : newClassNameInput} onChangeText={editingClass ? setNewClassName : setNewClassNameInput} style={styles.modalInput} />
              {!editingClass && (
                <>
                  <Text style={styles.modalLabel}>ACADEMIC LEVEL</Text>
                  <View style={styles.levelGrid}>
                    {levels.map((lvl) => (
                      <TouchableOpacity key={lvl} onPress={() => setNewClassLevel(lvl)} style={[styles.levelBtn, newClassLevel === lvl && styles.levelBtnActive]}>
                        <Text style={[styles.levelBtnText, newClassLevel === lvl && styles.levelBtnTextActive]}>{lvl}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setEditingClass(null); setShowAddModal(false); setNewClassLevel(null); setNewClassNameInput(""); }}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={editingClass ? saveClassName : addClass}>
                  <Text style={styles.confirmBtnText}>{editingClass ? "Save Changes" : "Create Class"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 100 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  addBtn: { backgroundColor: COLORS.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 16, borderRadius: 15, marginBottom: 30, ...SHADOWS.medium },
  addBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold", marginLeft: 10 },
  deptHeader: { flexDirection: "row", alignItems: "center", marginBottom: 15, marginTop: 10 },
  departmentTitle: { fontSize: 12, fontWeight: "900", color: "#64748B", letterSpacing: 1 },
  deptLine: { flex: 1, height: 1, backgroundColor: "#E2E8F0", marginLeft: 10 },
  classRow: { backgroundColor: "#fff", padding: 15, borderRadius: 18, flexDirection: "row", alignItems: "center", marginBottom: 12, ...SHADOWS.small },
  className: { fontSize: 16, fontWeight: "800", color: "#1E293B" },
  statsRow: { flexDirection: "row", marginTop: 8, gap: 8 },
  statChip: { flexDirection: "row", alignItems: "center", backgroundColor: "#F1F5F9", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
  statVal: { fontSize: 10, fontWeight: "700", color: "#64748B" },
  actions: { flexDirection: "row", gap: 10 },
  actionBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#F8FAFC", justifyContent: "center", alignItems: "center" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 },
  modalContent: { backgroundColor: "#fff", borderRadius: 25, padding: 25, ...SHADOWS.large },
  modalTitle: { fontSize: 20, fontWeight: "900", color: "#1E293B", marginBottom: 20 },
  modalLabel: { fontSize: 10, fontWeight: "900", color: "#94A3B8", marginBottom: 8, marginTop: 15 },
  modalInput: { backgroundColor: "#F8FAFC", padding: 15, borderRadius: 12, fontSize: 16, fontWeight: "700", borderWidth: 1, borderColor: "#E2E8F0" },
  levelGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  levelBtn: { width: 45, height: 45, borderRadius: 12, backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "transparent" },
  levelBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  levelBtnText: { fontSize: 14, fontWeight: "800", color: "#64748B" },
  levelBtnTextActive: { color: "#fff" },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 30 },
  cancelBtn: { flex: 1, padding: 15, borderRadius: 12, alignItems: "center", backgroundColor: "#F1F5F9" },
  cancelBtnText: { fontWeight: "700", color: "#64748B" },
  confirmBtn: { flex: 2, padding: 15, borderRadius: 12, alignItems: "center", backgroundColor: COLORS.primary },
  confirmBtnText: { fontWeight: "900", color: "#fff" },
});
