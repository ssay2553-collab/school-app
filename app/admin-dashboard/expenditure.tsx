import AsyncStorage from "@react-native-async-storage/async-storage";
import { Picker } from "@react-native-picker/picker";
import { LinearGradient } from "expo-linear-gradient";
import {
  addDoc,
  collection,
  getAggregateFromServer,
  sum,
  orderBy,
  query,
  serverTimestamp,
  where,
  getDocsFromServer
} from "firebase/firestore";
import React, { useEffect, useMemo, useState, useCallback } from "react";
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
import * as Animatable from "react-native-animatable";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebaseConfig";
import { getDocsCacheFirst } from "../../lib/firestoreHelpers";
import SVGIcon from "../../components/SVGIcon";
import { useRouter } from "expo-router";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";

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
  
  // Access Control
  const currentUserRole = appUser?.adminRole?.toLowerCase() || "";
  const isSuperAdmin = ["proprietor", "headmaster"].includes(currentUserRole);
  const expPermission = appUser?.permissions?.["expenditure"] || "deny";
  const canView = isSuperAdmin || expPermission === "full" || expPermission === "view" || expPermission === "edit";
  const canEdit = isSuperAdmin || expPermission === "full" || expPermission === "edit";

  useEffect(() => {
    if (appUser && !canView) {
      Alert.alert("Access Denied", "You do not have permission to view expenditures.");
      router.replace("/admin-dashboard");
    }
  }, [appUser, canView]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expenditures, setExpenditures] = useState<Expenditure[]>([]);
  const [serverTotal, setServerTotal] = useState(0);
  
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("");

  const [modalVisible, setModalVisible] = useState(false);
  const [itemName, setItemName] = useState("");
  const [amount, setAmount] = useState("");
  const [itemDate] = useState(new Date().toISOString().split('T')[0]);

  // Sync with global academic config
  useEffect(() => {
    if (!acadConfig.loading) {
      setSelectedYear(acadConfig.academicYear);
      setSelectedTerm(acadConfig.currentTerm);
      if (!acadConfig.academicYear || !acadConfig.currentTerm) {
        setLoading(false);
      }
    }
  }, [acadConfig]);

  const fetchExpenditures = useCallback(async (isRefresh = false) => {
    if (!selectedYear || !selectedTerm) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const cacheKey = `EXP_CACHE_V4_${selectedYear}_${selectedTerm}`;

    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached && !isRefresh) {
        try {
            const { list, total, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_EXPIRY) {
              setExpenditures(list || []);
              setServerTotal(total || 0);
              setLoading(false);
              return;
            }
        } catch (e) {}
      }

      const q = query(
        collection(db, "expenditures"),
        where("academicYear", "==", selectedYear),
        where("term", "==", selectedTerm),
        orderBy("createdAt", "desc")
      );

      const [aggSnap, docSnap] = await Promise.all([
        getAggregateFromServer(q, { total: sum("amount") }),
        isRefresh ? getDocsFromServer(q) : getDocsCacheFirst(q as any)
      ]);

      const total = aggSnap.data().total || 0;
      const list = docSnap.docs.map(d => ({ id: d.id, ...d.data() } as Expenditure));
      const uniqueList = Array.from(new Map(list.map(item => [item.id, item])).values());
      
      setServerTotal(total);
      setExpenditures(uniqueList);

      await AsyncStorage.setItem(cacheKey, JSON.stringify({
        list: uniqueList,
        total,
        timestamp: Date.now()
      }));

    } catch (error) {
      console.error("Fetch expenditures error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedYear, selectedTerm]);

  useEffect(() => {
    if (selectedYear && selectedTerm) {
      fetchExpenditures();
    }
  }, [fetchExpenditures, selectedYear, selectedTerm]);

  const addExpenditure = async () => {
    if (!canEdit) return Alert.alert("Denied", "You don't have permission to add entries.");
    if (!itemName.trim() || !amount.trim()) return Alert.alert("Required", "Please fill all fields");
    if (!appUser) return Alert.alert("Auth Error", "Session expired.");
    if (!selectedYear || !selectedTerm) return Alert.alert("Config Missing", "Please set academic year and term.");
    
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
      
      const cacheKey = `EXP_CACHE_V4_${selectedYear}_${selectedTerm}`;
      await AsyncStorage.removeItem(cacheKey);
      
      setModalVisible(false);
      setItemName("");
      setAmount("");
      fetchExpenditures(true);
    } catch (e) {
      Alert.alert("Error", "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  if (!canView) return null;

  const isConfigMissing = !selectedYear || !selectedTerm;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <LinearGradient colors={[COLORS.primary, "#1E293B"]} style={styles.headerGradient}>
        <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
               <SVGIcon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Expenditures</Text>
            <View style={{ width: 24 }} />
        </View>

        <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>TOTAL PERIOD SPENDING</Text>
            <Text style={styles.summaryValue}>₵{(serverTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
            {!isConfigMissing && (
              <Animatable.View animation="pulse" iterationCount="infinite" style={[styles.periodBadge, { backgroundColor: COLORS.secondary }]}>
                  <Text style={styles.periodText}>{selectedYear} • {selectedTerm}</Text>
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
      </LinearGradient>

      {isConfigMissing ? (
        <View style={styles.emptyContainer}>
          <SVGIcon name="settings-outline" size={80} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>Configuration Required</Text>
          <TouchableOpacity 
            style={[styles.saveBtn, { backgroundColor: COLORS.primary, width: 200, marginTop: 20 }]} 
            onPress={() => router.push("/academic-calendar")}
          >
            <Text style={styles.saveBtnText}>Go to Calendar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={expenditures}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchExpenditures(true)} colors={[COLORS.primary]} />}
          contentContainerStyle={styles.listContent}
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
                      <SVGIcon name="calendar" size={12} color={COLORS.gray} />
                      <Text style={styles.dateText}>{item.date || "N/A"}</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.itemAmount}>₵{(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                  <View style={styles.adminBadge}>
                    <Text style={styles.adminText}>{item.adminName} • {item.adminRole}</Text>
                  </View>
                </View>
              </View>
            </Animatable.View>
          )}
        />
      )}

      {canEdit && !isConfigMissing && (
        <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
          <LinearGradient colors={[COLORS.secondary, "#d97706"]} style={styles.fabGradient}>
              <SVGIcon name="create" size={30} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
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
                <TextInput style={styles.modalInput} placeholder="e.g. Printer Toner" value={itemName} onChangeText={setItemName} />
            </View>
            <View style={styles.modalInputWrapper}>
                <Text style={styles.modalInputLabel}>AMOUNT (₵)</Text>
                <TextInput style={styles.modalInput} placeholder="0.00" keyboardType="numeric" value={amount} onChangeText={setAmount} />
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={addExpenditure} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Entry</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
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
  listContent: { padding: 16, paddingBottom: 100 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 12, ...SHADOWS.small },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  dateText: { fontSize: 12, color: '#64748B', marginLeft: 4 },
  itemAmount: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  adminBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  adminText: { fontSize: 10, color: '#64748B', fontWeight: '600' },
  fab: { position: 'absolute', bottom: 30, right: 30, width: 65, height: 65, borderRadius: 32.5, ...SHADOWS.medium },
  fabGradient: { flex: 1, borderRadius: 32.5, alignItems: 'center', justifyContent: 'center' },
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
  saveBtn: { backgroundColor: COLORS.secondary, height: 55, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
