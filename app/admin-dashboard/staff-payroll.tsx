import AsyncStorage from "@react-native-async-storage/async-storage";
import { Picker } from "@react-native-picker/picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
    addDoc,
    collection,
    doc,
    getAggregateFromServer,
    getDocs,
    limit,
    query,
    serverTimestamp,
    sum,
    updateDoc,
    where,
} from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    RefreshControl,
    SafeAreaView,
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
import { db } from "../../firebaseConfig";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";

const CACHE_KEY = "STAFF_PAYROLL_CACHE_V3";

type Staff = {
  id: string;
  name: string;
  role: "Teacher" | "Non-Teaching";
  salary: number;
  approved?: boolean;
};

export default function StaffPayrollScreen() {
  const router = useRouter();
  const { appUser } = useAuth();
  const acadConfig = useAcademicConfig();
  
  // Access Control
  const currentUserRole = appUser?.adminRole?.toLowerCase() || "";
  const isSuperAdmin = ["proprietor", "headmaster"].includes(currentUserRole);
  const payrollPermission = appUser?.permissions?.["staff-payroll"] || "deny";
  const canView = isSuperAdmin || payrollPermission === "full" || payrollPermission === "view" || payrollPermission === "edit";
  const canEditSalary = isSuperAdmin || payrollPermission === "full" || payrollPermission === "edit";

  useEffect(() => {
    if (appUser && !canView) {
      Alert.alert("Access Denied", "You do not have permission to view staff payroll.");
      router.replace("/admin-dashboard");
    }
  }, [appUser, canView]);

  const [staff, setStaff] = useState<Staff[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [schoolTotalPayroll, setSchoolTotalPayroll] = useState(0);

  const [selectedYear, setSelectedYear] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");

  const [editingSalaries, setEditingSalaries] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Add Staff Modal
  const [showAddModal, setShowAddStaffModal] = useState(false);
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffSalary, setNewStaffSalary] = useState("");
  const [addingStaff, setAddingStaff] = useState(false);

  // Sync with global academic config
  useEffect(() => {
    if (!acadConfig.loading) {
      setSelectedYear(acadConfig.academicYear || "");
      setSelectedTerm(acadConfig.currentTerm || "");
    }
  }, [acadConfig]);


  useEffect(() => {
    if (!canView || !appUser) return;

    // Load from cache first for instant UI
    const loadCache = async () => {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setStaff(parsed);
          const salaries: Record<string, string> = {};
          parsed.forEach((s: Staff) => (salaries[s.id] = (s.salary || 0).toString()));
          setEditingSalaries(salaries);
          setLoadingStaff(false);
        } catch (e) {}
      }
    };
    loadCache();

    // Single real-time listener for all roles (Saves Cost & is Smooth)
    const q = query(
      collection(db, "users"),
      where("role", "in", ["admin", "teacher", "staff"]),
      where("status", "==", "active"),
      limit(300)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const combined = snapshot.docs.map((d) => {
        const data = d.data();
        const role = data.role === "admin" ? "Administrator" : (data.role === "teacher" ? "Teacher" : "Non-Teaching");
        return {
          id: d.id,
          name: `${data.profile?.firstName ?? ""} ${data.profile?.lastName ?? ""}`.trim() || d.id,
          role: role as any,
          salary: data.salary ?? 0,
          approved: true,
        };
      }).sort((a, b) => a.name.localeCompare(b.name));

      setStaff(combined);

      // Calculate total commitment locally (FREE - no extra server hits)
      const total = combined.reduce((acc, curr) => acc + (curr.salary || 0), 0);
      setSchoolTotalPayroll(total);

      // Update local state for editing
      const salaries: Record<string, string> = {};
      combined.forEach((s) => (salaries[s.id] = (s.salary || 0).toString()));
      setEditingSalaries(prev => ({ ...salaries, ...prev })); // Keep active edits

      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(combined));
      setLoadingStaff(false);
      setRefreshing(false);
    }, (err) => {
      console.error("Staff snapshot error:", err);
      setLoadingStaff(false);
      setRefreshing(false);
    });

    return () => unsubscribe();
  }, [canView, appUser]);

  const handleUpdateSalary = async (item: Staff) => {
    const val = editingSalaries[item.id];
    const newSalary = parseFloat(val);
    if (isNaN(newSalary) || !canEditSalary) return;

    setUpdatingId(item.id);
    try {
      await updateDoc(doc(db, "users", item.id), { salary: newSalary });
      // Total will auto-update via onSnapshot listener
      Alert.alert("Success", "Salary updated.");
    } catch (error) {
      console.error("Update salary error:", error);
      Alert.alert("Error", "Update failed.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleAddNonTeaching = async () => {
    if (!canEditSalary) return Alert.alert("Denied", "You don't have permission to add staff.");
    if (!newStaffName || !newStaffSalary) return Alert.alert("Required", "Please fill all fields.");
    setAddingStaff(true);
    try {
      const names = newStaffName.trim().split(" ");
      const firstName = names[0];
      const lastName = names.slice(1).join(" ") || "Staff";

      await addDoc(collection(db, "users"), {
        role: "staff",
        schoolId: appUser?.schoolId || "default",
        status: "active",
        salary: parseFloat(newStaffSalary),
        profile: {
          firstName,
          lastName,
          email: `${firstName.toLowerCase()}.${Date.now()}@staff.com`, // Placeholder email
        },
        createdAt: serverTimestamp(),
      });
      setShowAddStaffModal(false);
      setNewStaffName("");
      setNewStaffSalary("");
      // Fetch will happen automatically via onSnapshot
      Alert.alert("Success", "Staff registered.");
    } catch { Alert.alert("Error", "Could not add staff."); } finally { setAddingStaff(false); }
  };

  const handlePostToExpenditure = async () => {
    if (!selectedMonth) return Alert.alert("Required", "Select a month first.");
    if (!selectedYear || !selectedTerm) return Alert.alert("Config Error", "Academic year and term must be set in settings.");
    
    setIsFinalizing(true);
    try {
      const itemLabel = `Staff Payroll - ${selectedMonth} ${selectedYear}`;
      const q = query(collection(db, "expenditures"), where("item", "==", itemLabel), where("academicYear", "==", selectedYear), where("term", "==", selectedTerm));
      const existing = await getDocs(q);
      if (!existing.empty) {
        setIsFinalizing(false);
        return Alert.alert("Already Posted", "This payroll period has already been recorded in expenditures.");
      }
      await addDoc(collection(db, "expenditures"), {
        item: itemLabel,
        amount: schoolTotalPayroll,
        date: new Date().toISOString().split("T")[0],
        adminName: `${appUser?.profile?.firstName || "Admin"}`,
        adminRole: appUser?.adminRole || "Admin",
        status: "open",
        academicYear: selectedYear,
        term: selectedTerm,
        createdAt: serverTimestamp(),
      });
      Alert.alert("Success", "Payroll posted to expenditures.");
    } finally { setIsFinalizing(false); }
  };

  if (!canView) return null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[COLORS.primary, "#1E293B"]} style={styles.headerGradient}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <SVGIcon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Staff Payroll</Text>
          {canEditSalary ? (
            <TouchableOpacity onPress={() => setShowAddStaffModal(true)} style={styles.addBtn}>
              <SVGIcon name="add" size={28} color="#fff" />
            </TouchableOpacity>
          ) : (
            <SVGIcon name="cash" size={28} color="#fff" />
          )}
        </View>

        <View style={styles.summaryArea}>
          <Text style={styles.summaryLabel}>TOTAL MONTHLY COMMITMENT</Text>
          <Text style={styles.summaryValue}>₵ {schoolTotalPayroll.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
        </View>

        <View style={styles.filterRow}>
          <View style={[styles.pickerBox, { flex: 1.2 }]}>
            <Text style={styles.miniLabel}>YEAR</Text>
            <View style={styles.lockedValue}><Text style={styles.lockedValueText}>{selectedYear || "..."}</Text></View>
          </View>
          <View style={[styles.pickerBox, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.miniLabel}>TERM</Text>
            <View style={styles.lockedValue}><Text style={styles.lockedValueText}>{selectedTerm || "..."}</Text></View>
          </View>
          <View style={[styles.pickerBox, { flex: 1.2, marginLeft: 8 }]}>
            <Text style={styles.miniLabel}>MONTH</Text>
            <Picker selectedValue={selectedMonth} onValueChange={setSelectedMonth} style={[styles.picker, Platform.OS === 'web' && { color: '#fff', backgroundColor: 'transparent', border: 'none' } as any]} dropdownIconColor="#fff">
              <Picker.Item label="Select..." value="" color={Platform.OS === 'web' ? '#000' : 'rgba(255,255,255,0.6)'} />
              {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((m) => (
                <Picker.Item key={m} label={m} value={m} color={Platform.OS === 'web' ? '#000' : '#0F172A'} style={{ fontSize: 12 }} />
              ))}
            </Picker>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        {(selectedMonth !== "" && selectedYear !== "" && canEditSalary) && (
          <Animatable.View animation="fadeInDown" style={styles.postBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerSubtitle}>Ready to finalize {selectedMonth}?</Text>
              <Text style={styles.bannerTitle}>Commit to Expenditures</Text>
            </View>
            <TouchableOpacity style={styles.postBtn} onPress={handlePostToExpenditure} disabled={isFinalizing}>
               {isFinalizing ? <ActivityIndicator color="#fff" /> : <Text style={styles.postBtnText}>POST NOW</Text>}
            </TouchableOpacity>
          </Animatable.View>
        )}

        {loadingStaff ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
        ) : (
          <FlatList
            data={staff}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(true)} colors={[COLORS.primary]} tintColor={COLORS.primary} />}
            renderItem={({ item }) => (
              <Animatable.View animation="fadeInUp" duration={500} style={styles.card}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.staffName}>{item.name}</Text>
                  <Text style={styles.staffRole}>{item.role}</Text>
                </View>
                <View style={styles.salaryAction}>
                  <TextInput
                    style={[styles.salaryInput, !canEditSalary && { backgroundColor: '#F1F5F9', color: '#64748B' }]}
                    value={editingSalaries[item.id] || ""}
                    onChangeText={(val) => setEditingSalaries((prev) => ({ ...prev, [item.id]: val }))}
                    keyboardType="numeric"
                    editable={canEditSalary}
                  />
                  {canEditSalary && (
                    <TouchableOpacity 
                      onPress={() => handleUpdateSalary(item)} 
                      style={[styles.updateBtn, updatingId === item.id && { opacity: 0.5 }]}
                      disabled={updatingId === item.id}
                    >
                      {updatingId === item.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <SVGIcon name="checkmark" size={14} color="#fff" />
                          <Text style={styles.updateBtnText}>SAVE</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </Animatable.View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <SVGIcon name="people-outline" size={60} color="#CBD5E1" />
                <Text style={styles.emptyText}>No active staff members found.</Text>
              </View>
            }
          />
        )}
      </View>

      {/* Add Staff Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
           <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                 <Text style={styles.modalTitle}>Register Non-Teaching Staff</Text>
                 <TouchableOpacity onPress={() => setShowAddStaffModal(false)}><SVGIcon name="close" size={24} color="#64748B" /></TouchableOpacity>
              </View>
              <View style={styles.modalBody}>
                 <Text style={styles.inputLabel}>FULL NAME</Text>
                 <TextInput style={styles.modalInput} value={newStaffName} onChangeText={setNewStaffName} placeholder="e.g. Ama Serwaa" />
                 <Text style={styles.inputLabel}>MONTHLY SALARY (₵)</Text>
                 <TextInput style={styles.modalInput} value={newStaffSalary} onChangeText={setNewStaffSalary} placeholder="0.00" keyboardType="numeric" />
                 <TouchableOpacity style={styles.modalBtn} onPress={handleAddNonTeaching} disabled={addingStaff}>
                    {addingStaff ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnText}>SAVE STAFF RECORD</Text>}
                 </TouchableOpacity>
              </View>
           </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerGradient: { paddingHorizontal: 25, paddingBottom: 30, paddingTop: Platform.OS === 'android' ? 40 : 20, borderBottomLeftRadius: 35, borderBottomRightRadius: 35, ...SHADOWS.medium },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 25 },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 0.5 },
  summaryArea: { alignItems: 'center', marginBottom: 25 },
  summaryLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 5 },
  summaryValue: { color: '#fff', fontSize: 28, fontWeight: '900' },
  filterRow: { flexDirection: 'row', alignItems: 'center' },
  pickerBox: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 15, padding: 10 },
  miniLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 8, fontWeight: '900', marginBottom: 4 },
  picker: { height: 35, color: '#fff', fontSize: 12 },
  lockedValue: { height: 35, justifyContent: 'center' },
  lockedValueText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  content: { flex: 1 },
  postBanner: { margin: 20, marginBottom: 10, padding: 15, backgroundColor: COLORS.secondary, borderRadius: 20, flexDirection: 'row', alignItems: 'center', ...SHADOWS.medium },
  bannerSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '800' },
  bannerTitle: { color: '#fff', fontSize: 15, fontWeight: '900' },
  postBtn: { backgroundColor: '#fff', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12 },
  postBtnText: { color: COLORS.secondary, fontSize: 12, fontWeight: '900' },
  card: { marginHorizontal: 20, marginBottom: 12, padding: 15, backgroundColor: '#fff', borderRadius: 20, flexDirection: 'row', alignItems: 'center', ...SHADOWS.small },
  staffName: { fontSize: 15, fontWeight: '800', color: '#1E293B' },
  staffRole: { fontSize: 11, color: '#64748B', fontWeight: '700', marginTop: 2 },
  salaryAction: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  salaryInput: { width: 80, height: 40, backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', textAlign: 'center', fontSize: 14, fontWeight: '900', color: COLORS.primary },
  updateBtn: { paddingHorizontal: 12, height: 40, borderRadius: 10, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center' },
  updateBtnText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  addBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#94A3B8', marginTop: 15, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#1E293B' },
  modalBody: { gap: 15 },
  inputLabel: { fontSize: 10, fontWeight: '900', color: '#94A3B8', letterSpacing: 1 },
  modalInput: { backgroundColor: '#F8FAFC', height: 55, borderRadius: 15, paddingHorizontal: 15, borderWidth: 1, borderColor: '#E2E8F0', fontSize: 16, fontWeight: '600' },
  modalBtn: { backgroundColor: COLORS.primary, height: 55, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  modalBtnText: { color: '#fff', fontSize: 15, fontWeight: '900' }
});
