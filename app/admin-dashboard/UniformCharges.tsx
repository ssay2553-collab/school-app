import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  collection,
  doc,
  getDocsFromServer,
  increment,
  limit,
  query,
  serverTimestamp,
  startAfter,
  where,
  writeBatch,
} from "firebase/firestore";
import moment from "moment";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import { SafeAreaView } from "react-native-safe-area-context";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { db } from "../../firebaseConfig";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";

import { sendNotification } from "../../src/services/notificationService";

const VIBE = {
  primary: "#10B981", // Uniforms Color
  secondary: "#059669",
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  text: "#1E293B",
  muted: "#64748B",
  border: "#E2E8F0",
  success: "#10B981",
  info: "#3B82F6",
};

const UNIFORM_TYPES = [
  { id: "main", label: "Main Uniform", icon: "shirt" },
  { id: "lacoste", label: "Lacoste/T-Shirt", icon: "ribbon" },
  { id: "friday", label: "Friday Wear", icon: "color-palette" },
  { id: "pe", label: "PE Kit", icon: "fitness" },
  { id: "other", label: "Other", icon: "ellipsis-horizontal" },
];

const PAGE_SIZE = 50;

export default function UniformCharges() {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const acadConfig = useAcademicConfig();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedType, setSelectedType] = useState("main");
  const [amount, setAmount] = useState("");
  const [receivedFrom, setReceivedFrom] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    totalCollected: 0,
    count: 0,
    breakdown: {
      main: 0,
      lacoste: 0,
      friday: 0,
      pe: 0,
      other: 0
    }
  });

  const lastVisibleRef = useRef<any>(null);
  const hasMoreRef = useRef(true);
  const isFetchingRef = useRef(false);

  const fetchStats = async () => {
    try {
      if (!acadConfig.academicYear || !acadConfig.currentTerm) return;
      const q = query(
        collection(db, "feePayments"),
        where("type", "==", "uniform"),
        where("academicYear", "==", acadConfig.academicYear),
        where("term", "==", acadConfig.currentTerm)
      );
      const snap = await getDocsFromServer(q);
      let total = 0;
      let breakdown: any = {
        main: 0,
        lacoste: 0,
        friday: 0,
        pe: 0,
        other: 0
      };

      snap.docs.forEach(d => {
        const data = d.data();
        const amt = data.amount || 0;
        total += amt;
        if (data.subType && breakdown[data.subType] !== undefined) {
          breakdown[data.subType] += amt;
        } else {
          breakdown.other += amt;
        }
      });
      setStats({ totalCollected: total, count: snap.docs.length, breakdown });
    } catch (e) {
      console.error("Error fetching uniform stats:", e);
    }
  };

  const fetchPurchases = async (typeId: string) => {
    setLoading(true);
    setPurchases([]);
    try {
      if (!acadConfig.academicYear || !acadConfig.currentTerm) return;
      const q = query(
        collection(db, "feePayments"),
        where("type", "==", "uniform"),
        where("subType", "==", typeId),
        where("academicYear", "==", acadConfig.academicYear),
        where("term", "==", acadConfig.currentTerm)
      );
      const snap = await getDocsFromServer(q);
      const list = snap.docs.map(d => ({ id: d.id, createdAt: d.data().createdAt, ...d.data() }));
      setPurchases(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (e) {
      console.error("Error fetching purchases:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = useCallback(async (isFirstLoad = false) => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      if (isFirstLoad) {
        setStudents([]);
        setLoading(false);
      }
      return;
    }
    if (isFetchingRef.current) return;
    if (!isFirstLoad && !hasMoreRef.current) return;

    isFetchingRef.current = true;
    if (isFirstLoad) {
      setLoading(true);
      lastVisibleRef.current = null;
      hasMoreRef.current = true;
    }

    try {
      let q = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("status", "in", ["active", "pending_activation"]),
        limit(PAGE_SIZE)
      );

      if (!isFirstLoad && lastVisibleRef.current) {
        q = query(q, startAfter(lastVisibleRef.current));
      }

      const snap = await getDocsFromServer(q);
      const batch = snap.docs.map(d => ({
        uid: d.id,
        fullName: `${d.data().profile?.firstName || ""} ${d.data().profile?.lastName || ""}`.trim(),
        ...d.data()
      }));

      lastVisibleRef.current = snap.docs[snap.docs.length - 1];
      hasMoreRef.current = snap.docs.length === PAGE_SIZE;
      setStudents(prev => isFirstLoad ? batch : [...prev, ...batch]);
    } catch (e) {
      console.error(e);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (acadConfig.academicYear) {
      fetchStats();
    }
  }, [acadConfig.academicYear, acadConfig.currentTerm]);

  useEffect(() => {
    if (activeFilter) {
      fetchPurchases(activeFilter);
    }
  }, [activeFilter, acadConfig.academicYear, acadConfig.currentTerm]);

  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      setActiveFilter(null);
      const delayDebounceFn = setTimeout(() => {
        fetchStudents(true);
      }, 500);
      return () => clearTimeout(delayDebounceFn);
    } else if (!activeFilter) {
      setStudents([]);
      setLoading(false);
    }
  }, [searchQuery]);

  const handleRefresh = () => {
    setRefreshing(true);
    if (activeFilter) {
      fetchPurchases(activeFilter);
    } else if (searchQuery.trim().length >= 2) {
      fetchStudents(true);
    } else {
      setRefreshing(false);
    }
    fetchStats();
  };

  const filteredStudents = useMemo(() => {
    const lower = searchQuery.toLowerCase();
    return students.filter(s => s.fullName.toLowerCase().includes(lower));
  }, [students, searchQuery]);

  const handleLogPayment = async () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0 || !selectedStudent || !receivedFrom.trim()) {
      return showToast({ message: "Incomplete details", type: "error" });
    }

    setSaving(true);
    try {
      const batch = writeBatch(db);
      const serial = `UNI-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const typeLabel = UNIFORM_TYPES.find(t => t.id === selectedType)?.label;

      const entry = {
        amount: val,
        method: "Cash", // Default or could add selector
        receivedFrom: receivedFrom.trim(),
        updatedBy: appUser?.adminRole || "Admin",
        adminUid: appUser?.uid || "unknown",
        createdAt: new Date().toISOString(),
        receiptNo: serial,
        date: moment().format("YYYY-MM-DD"),
        studentUid: selectedStudent.uid,
        studentName: selectedStudent.fullName,
        classId: selectedStudent.classId,
        className: selectedStudent.className,
        type: "uniform",
        subType: selectedType,
        subTypeLabel: typeLabel,
        academicYear: acadConfig.academicYear,
        term: acadConfig.currentTerm,
      };

      batch.set(doc(db, "feePayments", serial), entry);

      // Isolated balance tracking for uniforms
      const year = acadConfig.academicYear?.replace(/\//g, "-");
      const term = acadConfig.currentTerm?.replace(/\s/g, "");
      const recordId = `${selectedStudent.uid}_${year}_${term}`;

      batch.set(doc(db, "studentFeeRecords", recordId), {
        uniformBalance: increment(val),
        uniformBill: increment(val),
        balance: increment(val),
        lastUpdated: serverTimestamp(),
      }, { merge: true });

      batch.update(doc(db, "users", selectedStudent.uid), {
        uniformBalance: increment(val),
        uniformBill: increment(val),
        walletBalance: increment(val),
      });

      await batch.commit();

      // Send notification to parent
      try {
        await sendNotification({
          recipientId: selectedStudent.uid,
          senderId: appUser?.uid || "admin",
          senderName: "School Finance",
          title: "Uniform Payment Recorded",
          body: `A payment for ${typeLabel} (${SCHOOL_CONFIG.currencySymbol}${val.toLocaleString()}) has been recorded for ${selectedStudent.fullName}.`,
          type: "payment",
          data: {
            studentUid: selectedStudent.uid,
            amount: val,
            type: "uniform_payment",
            item: typeLabel
          }
        });
      } catch (notifErr) {
        console.error("Failed to send uniform notification:", notifErr);
      }

      showToast({ message: `${typeLabel} recorded: ${serial}`, type: "success" });
      setPaymentModalVisible(false);
      setAmount("");
      setReceivedFrom("");
      fetchStats();
    } catch (e) {
      console.error(e);
      showToast({ message: "Failed to record payment", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <LinearGradient
          colors={[VIBE.primary, VIBE.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerTop}
        >
          <View style={styles.navBar}>
            <TouchableOpacity onPress={() => router.push("/admin-dashboard/StudentCharges")} style={styles.headerIconBtn}>
              <SVGIcon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.titleCenter}>
              <Text style={styles.headerTitle}>Uniforms</Text>
              <Text style={styles.headerSub}>WEAR & GEAR</Text>
            </View>
            <View style={{ width: 44 }} />
          </View>
        </LinearGradient>

        <View style={styles.searchStrip}>
          <View style={styles.searchBar}>
            <SVGIcon name="search" size={18} color={VIBE.muted} />
            <TextInput
              placeholder="Search students..."
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={VIBE.muted}
            />
          </View>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshRound}>
            <SVGIcon name="refresh" size={18} color={VIBE.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: VIBE.primary, flex: 1.5 }]}>
          <Text style={styles.statLabel}>Term Total</Text>
          <Text style={styles.statValue}>₵{stats.totalCollected.toLocaleString()}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: VIBE.info, flex: 1 }]}>
          <Text style={styles.statLabel}>Trans.</Text>
          <Text style={styles.statValue}>{stats.count}</Text>
        </View>
      </View>

      <View style={styles.breakdownContainer}>
        <Text style={styles.sectionLabel}>Revenue Breakdown</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.breakdownScroll}>
          {UNIFORM_TYPES.map(type => (
            <TouchableOpacity
              key={type.id}
              style={[styles.breakdownCard, activeFilter === type.id && styles.activeBreakdownCard]}
              onPress={() => {
                if (activeFilter === type.id) {
                  setActiveFilter(null);
                  setPurchases([]);
                } else {
                  setActiveFilter(type.id);
                  setSearchQuery("");
                }
              }}
            >
              <View style={[styles.typeIconWrap, { backgroundColor: activeFilter === type.id ? "#fff" : VIBE.primary + "10" }]}>
                <SVGIcon name={type.icon} size={16} color={activeFilter === type.id ? VIBE.primary : VIBE.primary} />
              </View>
              <View>
                <Text style={[styles.breakdownLabel, activeFilter === type.id && styles.activeBreakdownLabel]}>{type.label}</Text>
                <Text style={[styles.breakdownValue, activeFilter === type.id && styles.activeBreakdownValue]}>₵{(stats.breakdown?.[type.id] || 0).toLocaleString()}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {activeFilter && (
        <View style={styles.filterInfoBar}>
          <Text style={styles.filterInfoText}>Showing {UNIFORM_TYPES.find(t => t.id === activeFilter)?.label} purchases</Text>
          <TouchableOpacity onPress={() => setActiveFilter(null)}>
            <SVGIcon name="close-circle" size={20} color={VIBE.muted} />
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={activeFilter ? purchases : filteredStudents}
        keyExtractor={item => item.uid || item.id}
        contentContainerStyle={styles.listContent}
        onEndReached={() => !activeFilter && fetchStudents()}
        renderItem={({ item }) => {
          if (activeFilter) {
            return (
              <View style={styles.purchaseCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.studentName?.charAt(0)}</Text>
                </View>
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{item.studentName}</Text>
                  <Text style={styles.studentClass}>{item.className} • {moment(item.createdAt).format("MMM DD, HH:mm")}</Text>
                  <Text style={styles.receiptNo}>{item.receiptNo}</Text>
                </View>
                <View style={styles.purchaseAmount}>
                  <Text style={styles.amountText}>₵{item.amount.toLocaleString()}</Text>
                </View>
              </View>
            );
          }
          return (
            <TouchableOpacity
              style={styles.studentCard}
              onPress={() => {
                setSelectedStudent(item);
                setPaymentModalVisible(true);
              }}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.fullName.charAt(0)}</Text>
              </View>
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{item.fullName}</Text>
                <Text style={styles.studentClass}>{item.className}</Text>
              </View>
              <SVGIcon name="cart-outline" size={24} color={VIBE.primary} />
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={VIBE.primary} style={{ marginTop: 50 }} />
          ) : (searchQuery.length < 2 && !activeFilter) ? (
            <View style={styles.emptyWrap}>
              <SVGIcon name="search" size={64} color="#CBD5E1" />
              <Text style={styles.emptyText}>Search students to begin</Text>
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <SVGIcon name={activeFilter ? "receipt" : "shirt"} size={64} color="#CBD5E1" />
              <Text style={styles.emptyText}>{activeFilter ? "No purchases found for this category" : "No students found"}</Text>
            </View>
          )
        }
      />

      <Modal visible={paymentModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.overlay}>
          <View style={styles.modalBody}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{selectedStudent?.fullName}</Text>
                <Text style={styles.modalSubtitle}>UNIFORM PURCHASE</Text>
              </View>
              <TouchableOpacity onPress={() => setPaymentModalVisible(false)} style={styles.closeBtn}>
                <SVGIcon name="close" size={24} color={VIBE.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Select Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll} contentContainerStyle={{ gap: 10 }}>
                {UNIFORM_TYPES.map(t => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.typeBtn, selectedType === t.id && styles.activeTypeBtn]}
                    onPress={() => setSelectedType(t.id)}
                  >
                    <SVGIcon name={t.icon} size={20} color={selectedType === t.id ? "#fff" : VIBE.muted} />
                    <Text style={[styles.typeText, selectedType === t.id && styles.activeTypeText]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.inputRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Price (₵)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="0.00"
                    keyboardType="numeric"
                    value={amount}
                    onChangeText={setAmount}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 15 }}>
                  <Text style={styles.label}>Payer Name</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Student/Parent"
                    value={receivedFrom}
                    onChangeText={setReceivedFrom}
                  />
                </View>
              </View>

              <TouchableOpacity style={styles.submitBtn} onPress={handleLogPayment} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>RECORD PURCHASE</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VIBE.bg },
  header: { backgroundColor: "#fff", borderBottomLeftRadius: 30, borderBottomRightRadius: 30, ...SHADOWS.medium, paddingBottom: 20 },
  headerTop: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 25, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  navBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerIconBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  titleCenter: { alignItems: "center" },
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#fff" },
  headerSub: { fontSize: 10, fontWeight: "800", color: "rgba(255,255,255,0.7)", letterSpacing: 2 },
  searchStrip: { flexDirection: "row", paddingHorizontal: 20, marginTop: -25, gap: 10 },
  searchBar: { flex: 1, height: 50, backgroundColor: "#fff", borderRadius: 25, flexDirection: "row", alignItems: "center", paddingHorizontal: 20, ...SHADOWS.medium, borderWidth: 1, borderColor: VIBE.border },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 14, fontWeight: "600", color: VIBE.text },
  refreshRound: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", ...SHADOWS.medium, borderWidth: 1, borderColor: VIBE.border },
  listContent: { padding: 20, paddingTop: 30 },
  studentCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", padding: 15, borderRadius: 20, marginBottom: 12, ...SHADOWS.small, borderWidth: 1, borderColor: VIBE.border },
  avatar: { width: 45, height: 45, borderRadius: 15, backgroundColor: VIBE.primary + "15", justifyContent: "center", alignItems: "center" },
  avatarText: { fontSize: 20, fontWeight: "900", color: VIBE.primary },
  studentInfo: { flex: 1, marginLeft: 15 },
  studentName: { fontSize: 15, fontWeight: "800", color: VIBE.text },
  studentClass: { fontSize: 11, color: VIBE.muted, fontWeight: "600", marginTop: 2 },
  emptyWrap: { alignItems: "center", marginTop: 100, opacity: 0.5 },
  emptyText: { fontSize: 16, fontWeight: "900", color: "#94A3B8", marginTop: 15 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBody: { backgroundColor: "#fff", borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 25, maxHeight: "80%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 25 },
  modalTitle: { fontSize: 18, fontWeight: "900", color: VIBE.text },
  modalSubtitle: { fontSize: 10, fontWeight: "800", color: VIBE.muted, letterSpacing: 1 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: VIBE.bg, justifyContent: "center", alignItems: "center" },
  label: { fontSize: 11, fontWeight: "900", color: VIBE.muted, marginBottom: 10, textTransform: "uppercase" },
  typeScroll: { marginBottom: 25 },
  typeBtn: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12, backgroundColor: VIBE.bg, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: VIBE.border },
  activeTypeBtn: { backgroundColor: VIBE.primary, borderColor: VIBE.primary },
  typeText: { fontSize: 13, fontWeight: "700", color: VIBE.muted },
  activeTypeText: { color: "#fff" },
  inputRow: { flexDirection: "row", marginBottom: 25 },
  modalInput: { backgroundColor: VIBE.bg, borderRadius: 15, padding: 15, fontSize: 16, fontWeight: "700", color: VIBE.text, borderWidth: 1, borderColor: VIBE.border },
  submitBtn: { backgroundColor: VIBE.primary, height: 60, borderRadius: 20, justifyContent: "center", alignItems: "center", ...SHADOWS.medium, marginBottom: 20 },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  statsRow: { flexDirection: "row", paddingHorizontal: 20, marginTop: 20, gap: 12 },
  statCard: { padding: 15, borderRadius: 20, justifyContent: "center", ...SHADOWS.small },
  statLabel: { color: "rgba(255,255,255,0.8)", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  statValue: { color: "#fff", fontSize: 20, fontWeight: "900", marginTop: 4 },
  sectionLabel: { fontSize: 10, fontWeight: "900", color: VIBE.muted, marginLeft: 20, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 },
  breakdownContainer: { marginTop: 15 },
  breakdownScroll: { paddingHorizontal: 20, gap: 10, paddingBottom: 5 },
  breakdownCard: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: VIBE.border,
    minWidth: 120,
    ...SHADOWS.small,
  },
  typeIconWrap: { width: 32, height: 32, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  activeBreakdownCard: { backgroundColor: VIBE.primary, borderColor: VIBE.primary },
  activeBreakdownLabel: { color: "rgba(255,255,255,0.8)" },
  activeBreakdownValue: { color: "#fff" },
  filterInfoBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: 20, marginTop: 15, padding: 10, backgroundColor: VIBE.bg, borderRadius: 10, borderWidth: 1, borderColor: VIBE.border },
  filterInfoText: { fontSize: 12, fontWeight: "700", color: VIBE.muted },
  purchaseCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", padding: 15, borderRadius: 20, marginBottom: 12, ...SHADOWS.small, borderWidth: 1, borderColor: VIBE.border },
  receiptNo: { fontSize: 9, fontWeight: "800", color: VIBE.primary, marginTop: 4, textTransform: "uppercase" },
  purchaseAmount: { alignItems: "flex-end" },
  amountText: { fontSize: 16, fontWeight: "900", color: VIBE.text },
  breakdownLabel: { fontSize: 9, fontWeight: "800", color: VIBE.muted, textTransform: "uppercase" },
  breakdownValue: { fontSize: 14, fontWeight: "900", color: VIBE.text, marginTop: 1 },
});
