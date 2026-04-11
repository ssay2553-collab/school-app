import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  getDocsFromServer
} from "firebase/firestore";
import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
  RefreshControl
} from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Animatable from "react-native-animatable";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebaseConfig";
import { getDocsCacheFirst } from "../../lib/firestoreHelpers";
import SVGIcon from "../../components/SVGIcon";
import { useRouter } from "expo-router";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebaseConfig";

const CACHE_EXPIRY = 1000 * 60 * 60 * 24; // 24 Hours

type Expenditure = {
  id: string;
  item: string;
  amount: number;
  date: string;
  adminName: string;
  adminRole: string;
  status: "open" | "closed";
  academicYear: string;
  term: string;
  createdAt: any;
};

export default function ExpenditureScreen() {
  const router = useRouter();
  const { appUser } = useAuth();
  const acadConfig = useAcademicConfig();
  const insets = useSafeAreaInsets();
  
  // Access Control
  const currentUserRole = appUser?.adminRole?.toLowerCase() || "";
  const isSuperAdmin = ["proprietor", "headmaster", "ceo"].includes(currentUserRole);
  const expPermission = appUser?.permissions?.["expenditure"] || "deny";
  const canView = isSuperAdmin || expPermission === "full" || expPermission === "view" || expPermission === "edit";
  const canEdit = isSuperAdmin || expPermission === "full" || expPermission === "edit";

  // Brand Fallbacks
  const primaryBrand = SCHOOL_CONFIG.primaryColor || COLORS.primary || "#2e86de";
  const secondaryBrand = SCHOOL_CONFIG.secondaryColor || primaryBrand;

  useEffect(() => {
    if (appUser && !canView) {
      Alert.alert("Access Denied", "You do not have permission to view expenditures.");
      router.replace("/admin-dashboard");
    }
  }, [appUser, canView]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expenditures, setExpenditures] = useState<Expenditure[]>([]);
  const [serverTotal, setServerTotal] = useState(0);
  
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("");
  const [isPreviousTerm, setIsPreviousTerm] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [itemName, setItemName] = useState("");
  const [amount, setAmount] = useState("");
  const [itemDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (!acadConfig.loading) {
      setSelectedYear(acadConfig.academicYear || "");
      setSelectedTerm(acadConfig.currentTerm || "");
      if (!acadConfig.academicYear || !acadConfig.currentTerm) {
        setLoading(false);
      }
    }
  }, [acadConfig]);

  useEffect(() => {
    if (!selectedYear || !selectedTerm) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, "expenditures"),
      where("academicYear", "==", selectedYear),
      where("term", "==", selectedTerm),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Expenditure);
        // Ensure uniqueness and valid data
        const uniqueList = Array.from(new Map(list.map((item) => [item.id, item])).values());
        setExpenditures(uniqueList);

        // Update total spending locally from the current list
        const total = uniqueList.reduce((sum, item) => sum + (item.amount || 0), 0);
        setServerTotal(total);

        setLoading(false);
        setRefreshing(false);
      },
      (error) => {
        console.error("Expenditure snapshot error:", error);
        setLoading(false);
        setRefreshing(false);
      }
    );

    return () => unsubscribe();
  }, [selectedYear, selectedTerm]);

  const fetchPreviousTerm = () => {
    if (!acadConfig.academicYear || !acadConfig.currentTerm) return;

    let prevTerm = "";
    let prevYear = acadConfig.academicYear;

    if (acadConfig.currentTerm.toLowerCase().includes("term 3") || acadConfig.currentTerm.toLowerCase().includes("3rd")) {
      prevTerm = "Term 2";
    } else if (acadConfig.currentTerm.toLowerCase().includes("term 2") || acadConfig.currentTerm.toLowerCase().includes("2nd")) {
      prevTerm = "Term 1";
    } else {
      // If it's Term 1, go back to previous year Term 3
      const yearParts = acadConfig.academicYear.split("/");
      if (yearParts.length === 2) {
        const startYear = parseInt(yearParts[0]);
        const endYear = parseInt(yearParts[1]);
        prevYear = `${startYear - 1}/${endYear - 1}`;
        prevTerm = "Term 3";
      }
    }

    if (prevTerm) {
      setSelectedYear(prevYear);
      setSelectedTerm(prevTerm);
      setIsPreviousTerm(true);
      Alert.alert("Viewing Archive", `Showing records for ${prevYear} - ${prevTerm}`);
    }
  };

  const resetToCurrentTerm = () => {
    setSelectedYear(acadConfig.academicYear || "");
    setSelectedTerm(acadConfig.currentTerm || "");
    setIsPreviousTerm(false);
  };

  const addExpenditure = async () => {
    if (!canEdit) return Alert.alert("Denied", "You don't have permission to add entries.");
    if (!itemName.trim() || !amount.trim()) return Alert.alert("Required", "Please fill all fields");
    if (!appUser) return Alert.alert("Auth Error", "Session expired.");
    
    setSaving(true);
    try {
      await addDoc(collection(db, "expenditures"), {
        item: itemName.trim(),
        amount: parseFloat(amount),
        date: itemDate,
        adminName: appUser?.profile?.firstName || 'Admin',
        adminRole: appUser?.adminRole || "Administrator",
        status: "open",
        academicYear: selectedYear,
        term: selectedTerm,
        createdAt: serverTimestamp(),
      });

      setModalVisible(false);
      setItemName("");
      setAmount("");
    } catch (e) {
      Alert.alert("Error", "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpenditure = (item: Expenditure) => {
    if (!canEdit) return;

    Alert.alert(
      "Confirm Delete",
      `Are you sure you want to remove "${item.item}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeletingId(item.id);
            try {
              const deleteFn = httpsCallable(functions, "deleteExpenditure");
              await deleteFn({ expenditureId: item.id });
            } catch (e: any) {
              console.error("Delete function error:", e);
              Alert.alert("Error", e.message || "Could not delete entry.");
            } finally {
              setDeletingId(null);
            }
          }
        }
      ]
    );
  };

  if (!canView) return null;

  const isConfigMissing = !selectedYear || !selectedTerm;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      
      <LinearGradient colors={[primaryBrand, "#1E293B"]} style={styles.headerGradient}>
        <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
               <SVGIcon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Expenditures</Text>
            {canEdit && !isConfigMissing && !isPreviousTerm ? (
              <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addBtn}>
                 <SVGIcon name="add" size={28} color="#fff" />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 24 }} />
            )}
        </View>

        <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>TOTAL PERIOD SPENDING</Text>
            <Text style={styles.summaryValue}>₵{(serverTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
            {!isConfigMissing && (
              <Animatable.View animation="pulse" iterationCount="infinite" style={[styles.periodBadge, { backgroundColor: isPreviousTerm ? "#F59E0B" : secondaryBrand }]}>
                  <Text style={styles.periodText}>{selectedYear} • {selectedTerm} {isPreviousTerm ? "(ARCHIVE)" : ""}</Text>
              </Animatable.View>
            )}
        </View>

        <View style={styles.filterRow}>
          <View style={[styles.pickerBox, { flex: 1.2 }]}>
            <Text style={styles.miniLabel}>ACADEMIC YEAR</Text>
            <View style={styles.lockedValue}><Text style={styles.lockedValueText}>{selectedYear || "Not Set"}</Text></View>
          </View>
          <View style={[styles.pickerBox, { flex: 1, marginLeft: 12 }]}>
            <Text style={styles.miniLabel}>TERM</Text>
            <View style={styles.lockedValue}><Text style={styles.lockedValueText}>{selectedTerm || "Not Set"}</Text></View>
          </View>
        </View>

        {!isConfigMissing && (
          <View style={styles.historyToggleRow}>
             {isPreviousTerm ? (
               <TouchableOpacity style={styles.historyBtn} onPress={resetToCurrentTerm}>
                  <SVGIcon name="refresh" size={14} color="#fff" />
                  <Text style={styles.historyBtnText}>Return to Current Term</Text>
               </TouchableOpacity>
             ) : (
               <TouchableOpacity style={styles.historyBtn} onPress={fetchPreviousTerm}>
                  <SVGIcon name="time-outline" size={14} color="#fff" />
                  <Text style={styles.historyBtnText}>View Previous Term Records</Text>
               </TouchableOpacity>
             )}
          </View>
        )}
      </LinearGradient>

      {isConfigMissing ? (
        <View style={styles.emptyContainer}>
          <SVGIcon name="settings-outline" size={80} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>Configuration Required</Text>
          <TouchableOpacity 
            style={[styles.saveBtn, { backgroundColor: primaryBrand, width: 200, marginTop: 20 }]} 
            onPress={() => router.push("/academic-calendar")}
          >
            <Text style={styles.saveBtnText}>Go to Calendar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={expenditures}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchExpenditures(true)} colors={[primaryBrand]} />}
          contentContainerStyle={styles.listContent}
          removeClippedSubviews={Platform.OS === 'android'}
          ListEmptyComponent={
              <View style={styles.emptyContainer}>
                  <SVGIcon name="receipt" size={80} color="#CBD5E1" />
                  <Text style={styles.emptyText}>No expenses recorded.</Text>
              </View>
          }
          renderItem={({ item }) => (
            <Animatable.View animation="fadeInUp" duration={400} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{item.item || "Unnamed Expense"}</Text>
                  <View style={styles.dateRow}>
                      <SVGIcon name="calendar" size={12} color={COLORS.gray || "#9ca3af"} />
                      <Text style={styles.dateText}>{item.date || "N/A"}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.itemAmount}>₵{(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                    <View style={styles.adminBadge}>
                      <Text style={styles.adminText}>{item.adminName} • {item.adminRole}</Text>
                    </View>
                  </View>
                  {canEdit && (
                    <TouchableOpacity
                      onPress={() => handleDeleteExpenditure(item)}
                      style={styles.deleteBtn}
                      disabled={deletingId === item.id}
                    >
                      {deletingId === item.id ? (
                        <ActivityIndicator size="small" color="#EF4444" />
                      ) : (
                        <SVGIcon name="trash-outline" size={20} color="#EF4444" />
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </Animatable.View>
          )}
        />
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Expense</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><SVGIcon name="close-circle" size={32} color="#CBD5E1" /></TouchableOpacity>
            </View>
            <View style={styles.modalInputWrapper}>
                <Text style={styles.modalInputLabel}>WHAT WAS PURCHASED?</Text>
                <TextInput style={styles.modalInput} placeholder="e.g. Printer Toner" value={itemName} onChangeText={setItemName} placeholderTextColor="#94A3B8" />
            </View>
            <View style={styles.modalInputWrapper}>
                <Text style={styles.modalInputLabel}>AMOUNT (₵)</Text>
                <TextInput style={styles.modalInput} placeholder="0.00" keyboardType="numeric" value={amount} onChangeText={setAmount} placeholderTextColor="#94A3B8" />
            </View>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: secondaryBrand }]} onPress={addExpenditure} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Entry</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  headerGradient: { padding: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  backBtn: { padding: 5 },
  summaryBox: { alignItems: 'center', marginBottom: 25 },
  summaryLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  summaryValue: { color: '#fff', fontSize: 34, fontWeight: '900', marginTop: 5 },
  periodBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginTop: 10 },
  periodText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  filterRow: { flexDirection: 'row', alignItems: 'center' },
  pickerBox: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 10 },
  miniLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: '800', marginBottom: 4 },
  lockedValue: { height: 25, justifyContent: 'center' },
  lockedValueText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  historyToggleRow: { marginTop: 15, flexDirection: 'row', justifyContent: 'center' },
  historyBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, gap: 6 },
  historyBtnText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  listContent: { padding: 16, paddingBottom: 100 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 12, ...SHADOWS.small },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  dateText: { fontSize: 12, color: '#64748B', marginLeft: 4 },
  itemAmount: { fontSize: 18, fontWeight: '800', color: COLORS.primary || "#2e86de" },
  adminBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  adminText: { fontSize: 10, color: '#64748B', fontWeight: '600' },
  deleteBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center' },
  addBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginTop: 20 },
  emptyText: { fontSize: 14, color: '#64748B', textAlign: 'center', marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B' },
  modalInputWrapper: { marginBottom: 20 },
  modalInputLabel: { fontSize: 11, fontWeight: '800', color: '#94A3B8', marginBottom: 8, letterSpacing: 0.5 },
  modalInput: { backgroundColor: '#F1F5F9', borderRadius: 12, padding: 16, fontSize: 16, color: '#1E293B' },
  saveBtn: { height: 55, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
