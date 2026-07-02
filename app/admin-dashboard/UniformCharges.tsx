import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  collection,
  doc,
  getDocsFromServer,
  increment,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  startAfter,
  where,
  writeBatch,
  arrayUnion,
  arrayRemove,
  documentId,
} from "firebase/firestore";
import moment from "moment";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { sortClasses } from "../../lib/classHelpers";
import { sendNotification } from "../../src/services/notificationService";

import { ClassSelectorModal } from "../../components/admin-dashboard/ClassSelectorModal";
import { styles as sharedStyles, VIBE as sharedVibe } from "../../constants/admin-dashboard/ManageFeesStyles";

const VIBE = {
  ...sharedVibe,
  primary: "#10B981", // Uniforms Color
  secondary: "#059669",
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
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("all");
  const [classModalVisible, setClassModalVisible] = useState(false);
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
      let q = query(
        collection(db, "feePayments"),
        where("type", "==", "uniform"),
        where("academicYear", "==", acadConfig.academicYear),
        where("term", "==", acadConfig.currentTerm)
      );

      if (selectedClassId !== "all") {
        q = query(q, where("classId", "==", selectedClassId));
      }

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

  const fetchPaymentHistory = async (studentUid: string) => {
    setLoadingHistory(true);
    try {
      const q = query(
        collection(db, "feePayments"),
        where("studentUid", "==", studentUid),
        where("type", "==", "uniform")
      );
      const snap = await getDocsFromServer(q);
      const list = snap.docs.map(d => d.data());
      setHistory(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchUniformStudents = useCallback(async () => {
    setLoading(true);
    setStudents([]);
    try {
      const year = acadConfig.academicYear;
      if (!year) return;

      let q = query(
        collection(db, "feePayments"),
        where("type", "==", "uniform"),
        where("academicYear", "==", year)
      );

      if (selectedClassId !== "all") {
        q = query(q, where("classId", "==", selectedClassId));
      }

      const snap = await getDocsFromServer(q);
      const uids = Array.from(new Set(snap.docs.map(d => d.data().studentUid)));

      if (uids.length === 0) {
        setStudents([]);
        return;
      }

      const list: any[] = [];
      for (let i = 0; i < uids.length; i += 30) {
        const batch = uids.slice(i, i + 30);
        const uq = query(collection(db, "users"), where(documentId(), "in", batch));
        const uSnap = await getDocsFromServer(uq);
        uSnap.docs.forEach(d => {
          const data = d.data();
          list.push({
            uid: d.id,
            fullName: `${data.profile?.firstName || ""} ${data.profile?.lastName || ""}`.trim(),
            ...data
          });
        });
      }
      setStudents(list.sort((a, b) => a.fullName.localeCompare(b.fullName)));
    } catch (e) {
      console.error(e);
      showToast({ message: "Failed to fetch uniform students", type: "error" });
    } finally {
      setLoading(false);
    }
  }, [acadConfig.academicYear, selectedClassId]);

  const fetchStudents = useCallback(async (isFirstLoad = false) => {
    if (isFetchingRef.current) return;
    if (!isFirstLoad && !hasMoreRef.current) return;

    // IMPORTANT: General billing list only shows students when searching
    if (searchQuery.trim().length < 2) {
      if (isFirstLoad) {
        setStudents([]);
        setLoading(false);
      }
      return;
    }

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

      if (selectedClassId !== "all") {
        q = query(q, where("classId", "==", selectedClassId));
      }

      if (!isFirstLoad && lastVisibleRef.current) {
        q = query(q, startAfter(lastVisibleRef.current));
      }

      const snap = await getDocsFromServer(q);
      const batch = snap.docs.map(d => {
        const data = d.data();
        return {
          uid: d.id,
          fullName: `${data.profile?.firstName || ""} ${data.profile?.lastName || ""}`.trim(),
          ...data
        };
      });

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
  }, [selectedClassId]);

  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      if (activeFilter) setActiveFilter(null);
      fetchStudents(true);
    } else if (selectedClassId !== "all") {
      fetchUniformStudents();
    } else {
      setStudents([]);
    }
  }, [selectedClassId, searchQuery]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "classes"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, name: d.data().name, ...d.data() }));
      setClasses(sortClasses(list));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (acadConfig.academicYear) {
      fetchStats();
    }
  }, [acadConfig.academicYear, acadConfig.currentTerm, selectedClassId]);

  useEffect(() => {
    if (activeFilter) {
      fetchPurchases(activeFilter);
    }
  }, [activeFilter, acadConfig.academicYear, acadConfig.currentTerm]);

  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      setActiveFilter(null);
    }
  }, [searchQuery]);

  const handleRefresh = () => {
    setRefreshing(true);
    if (activeFilter) {
      fetchPurchases(activeFilter);
    } else if (searchQuery.trim().length >= 2) {
      fetchStudents(true);
    } else if (selectedClassId !== "all") {
      fetchUniformStudents();
    }
    fetchStats();
  };

  const filteredStudents = useMemo(() => {
    if (!students) return [];
    const lower = searchQuery.toLowerCase();
    return students.filter(s => s && s.fullName && s.fullName.toLowerCase().includes(lower));
  }, [students, searchQuery]);

  const handleDeletePayment = (payment: any) => {
    if (!selectedStudent) return;

    const performDeletion = async () => {
      const year = acadConfig.academicYear?.replace(/\//g, "-");
      const term = acadConfig.currentTerm?.replace(/\s/g, "");

      if (!year || !term) {
        return showToast({
          message: "Action blocked: Academic year and term must be configured.",
          type: "error",
        });
      }

      setSaving(true);
      try {
        const recordId = `${selectedStudent.uid}_${year}_${term}`;
        const batch = writeBatch(db);
        const amount = Number(payment.amount) || 0;

        // For Uniforms, the payment and billing are simultaneous.
        // So we reduce BOTH uniformPaid AND uniformBill.
        // Wallet balance remains unchanged as it was never truly increased/decreased (net zero impact).
        batch.update(doc(db, "studentFeeRecords", recordId), {
          uniformPaid: increment(-amount),
          uniformBill: increment(-amount),
          payments: arrayRemove(payment),
          lastUpdated: serverTimestamp(),
        });
        batch.update(doc(db, "users", selectedStudent.uid), {
          uniformPaid: increment(-amount),
          uniformBill: increment(-amount),
        });

        if (payment.receiptNo) {
          batch.delete(doc(db, "feePayments", payment.receiptNo));
        }

        await batch.commit();
        showToast({ message: "Transaction reverted successfully", type: "success" });
        setPaymentModalVisible(false);
        fetchStats();
      } catch (err) {
        console.error("Delete transaction error:", err);
        showToast({ message: "Failed to revert transaction", type: "error" });
      } finally {
        setSaving(false);
      }
    };

    const msg = "Confirm Deletion\n\nAre you sure you want to delete this transaction? This will automatically adjust the student's records.";
    if (Platform.OS === "web") {
      if (window.confirm(msg)) performDeletion();
    } else {
      Alert.alert("Confirm Deletion", msg, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: performDeletion },
      ]);
    }
  };

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
        uniformPaid: increment(val),
        uniformBill: increment(val),
        balance: increment(0),
        payments: arrayUnion(entry),
        lastUpdated: serverTimestamp(),
      }, { merge: true });

      batch.update(doc(db, "users", selectedStudent.uid), {
        uniformPaid: increment(val),
        uniformBill: increment(val),
        walletBalance: increment(0),
      });

      await batch.commit();

      // Send notification to parent
      try {
        await sendNotification({
          recipientId: selectedStudent.uid,
          senderId: appUser?.uid || "admin",
          senderName: appUser?.displayName || "Administrator",
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
      <View style={sharedStyles.header}>
        <LinearGradient
          colors={[VIBE.primary, VIBE.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={sharedStyles.headerTop}
        >
          <View style={sharedStyles.navBar}>
            <TouchableOpacity onPress={() => router.push("/admin-dashboard/StudentCharges")} style={sharedStyles.headerIconBtn}>
              <SVGIcon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={sharedStyles.titleCenter}>
              <Text style={sharedStyles.headerTitle}>Uniforms</Text>
              <Text style={sharedStyles.headerSub}>WEAR & GEAR</Text>
            </View>
            <TouchableOpacity onPress={() => setClassModalVisible(true)} style={sharedStyles.headerIconBtn}>
              <SVGIcon name="funnel-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={sharedStyles.glassPill}
            onPress={() => setClassModalVisible(true)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <SVGIcon name="layers-outline" size={14} color="rgba(255,255,255,0.8)" style={{ marginRight: 6 }} />
              <Text style={sharedStyles.glassLabel}>FILTER BY CLASS</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={sharedStyles.glassValue}>
                {selectedClassId === "all" ? "All Classes" : classes.find(c => c.id === selectedClassId)?.name || "Select Class"}
              </Text>
              <SVGIcon name="chevron-down" size={18} color="rgba(255,255,255,0.6)" />
            </View>
          </TouchableOpacity>
        </LinearGradient>

        <View style={sharedStyles.searchStrip}>
          <View style={sharedStyles.searchBar}>
            <SVGIcon name="search" size={18} color={VIBE.muted} />
            <TextInput
              placeholder="Search students..."
              style={sharedStyles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={VIBE.muted}
            />
          </View>
          <TouchableOpacity onPress={handleRefresh} style={sharedStyles.refreshRound}>
            <SVGIcon name="refresh" size={18} color={VIBE.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={sharedStyles.statsDashboard}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={[sharedStyles.statBox, { backgroundColor: VIBE.primary, flex: 1.5, width: 'auto' }]}>
            <Text style={sharedStyles.statLabel}>Term Total</Text>
            <Text style={sharedStyles.statValue}>₵{stats.totalCollected.toLocaleString()}</Text>
          </View>
          <View style={[sharedStyles.statBox, { backgroundColor: VIBE.info, flex: 1, width: 'auto' }]}>
            <Text style={sharedStyles.statLabel}>Trans.</Text>
            <Text style={sharedStyles.statValue}>{stats.count}</Text>
          </View>
        </View>
      </View>

      <View style={sharedStyles.breakdownContainer}>
        <Text style={sharedStyles.sectionLabel}>Revenue Breakdown</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sharedStyles.breakdownScroll}>
          {UNIFORM_TYPES.map(type => (
            <TouchableOpacity
              key={type.id}
              style={[sharedStyles.breakdownCard, activeFilter === type.id && sharedStyles.activeBreakdownCard]}
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
              <View style={[sharedStyles.typeIconWrap, { backgroundColor: activeFilter === type.id ? "#fff" : VIBE.primary + "10" }]}>
                <SVGIcon name={type.icon} size={16} color={activeFilter === type.id ? VIBE.primary : VIBE.primary} />
              </View>
              <View>
                <Text style={[sharedStyles.breakdownLabel, activeFilter === type.id && sharedStyles.activeBreakdownLabel]}>{type.label}</Text>
                <Text style={[sharedStyles.breakdownValue, activeFilter === type.id && sharedStyles.activeBreakdownValue]}>₵{(stats.breakdown?.[type.id] || 0).toLocaleString()}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {activeFilter && (
        <View style={sharedStyles.filterInfoBar}>
          <Text style={sharedStyles.filterInfoText}>Showing {UNIFORM_TYPES.find(t => t.id === activeFilter)?.label} purchases</Text>
          <TouchableOpacity onPress={() => setActiveFilter(null)}>
            <SVGIcon name="close-circle" size={20} color={VIBE.muted} />
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={activeFilter ? purchases : filteredStudents}
        keyExtractor={item => item.uid || item.id}
        contentContainerStyle={sharedStyles.flatListContent}
        onEndReached={() => !activeFilter && fetchStudents()}
        renderItem={({ item }) => {
          if (activeFilter) {
            return (
              <TouchableOpacity
                style={sharedStyles.financeCard}
                onPress={() => {
                  router.push({
                    pathname: "/shared/receipt-view",
                    params: {
                      type: 'payment',
                      studentId: item.studentUid,
                      paymentId: item.receiptNo,
                      year: item.academicYear,
                      term: item.term
                    }
                  });
                }}
              >
                <View style={sharedStyles.cardContent}>
                  <View style={sharedStyles.leftSection}>
                    <View style={[sharedStyles.avatar, { backgroundColor: VIBE.primary + '15' }]}>
                      <Text style={[sharedStyles.avatarText, { color: VIBE.primary }]}>{item.studentName?.charAt(0)}</Text>
                    </View>
                    <View style={sharedStyles.mainInfo}>
                      <Text style={sharedStyles.studentName}>{item.studentName}</Text>
                      <Text style={sharedStyles.debtLabel}>{item.className} • {moment(item.createdAt).format("MMM DD, HH:mm")}</Text>
                      <Text style={sharedStyles.dailyReceipt}>{item.receiptNo}</Text>
                    </View>
                  </View>
                  <View style={sharedStyles.rightSection}>
                    <Text style={sharedStyles.dailyAmount}>₵{item.amount.toLocaleString()}</Text>
                    <SVGIcon name="eye-outline" size={14} color={VIBE.muted} style={{ marginTop: 4 }} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          }

          // Tuition balance logic
          const isolatedTotal = (item.ptaBalance || 0) + (item.admissionBalance || 0) +
                                (item.maintenanceBalance || 0) + (item.booksBalance || 0) +
                                (item.uniformBalance || 0) + (item.otherBalance || 0);
          const tuitionBalance = Math.max(0, (item.walletBalance || 0) - (isolatedTotal - (item.uniformBalance || 0)));

          return (
            <TouchableOpacity
              style={sharedStyles.financeCard}
              onPress={() => {
                setSelectedStudent(item);
                setPaymentModalVisible(true);
                fetchPaymentHistory(item.uid);
              }}
            >
              <View style={sharedStyles.cardContent}>
                <View style={sharedStyles.leftSection}>
                  <View style={[sharedStyles.avatar, { backgroundColor: VIBE.primary + '15' }]}>
                    <Text style={[sharedStyles.avatarText, { color: VIBE.primary }]}>{item.fullName.charAt(0)}</Text>
                  </View>
                  <View style={sharedStyles.mainInfo}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={sharedStyles.studentName}>{item.fullName}</Text>
                      <View style={[sharedStyles.filterChip, { backgroundColor: tuitionBalance > 0 ? VIBE.danger + '10' : VIBE.success + '10', borderColor: 'transparent' }]}>
                        <Text style={[sharedStyles.filterChipText, { color: tuitionBalance > 0 ? VIBE.danger : VIBE.success }]}>
                          Tuition: ₵{tuitionBalance.toFixed(0)}
                        </Text>
                      </View>
                    </View>
                    <Text style={sharedStyles.debtLabel}>{item.className}</Text>
                    <View style={sharedStyles.tuitionBreakdown}>
                      <View style={sharedStyles.breakdownItem}>
                        <Text style={sharedStyles.breakdownLabel}>TOTAL UNIFORM</Text>
                        <Text style={[sharedStyles.breakdownValue, { color: VIBE.info }]}>₵{(item.uniformPaid || 0).toFixed(0)}</Text>
                      </View>
                    </View>
                  </View>
                </View>
                <View style={{ marginLeft: 10 }}>
                  <SVGIcon name="cart-outline" size={24} color={VIBE.primary} />
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={VIBE.primary} style={{ marginTop: 50 }} />
          ) : (searchQuery.length < 2 && !activeFilter && selectedClassId === "all") ? (
            <View style={sharedStyles.emptyWrap}>
              <SVGIcon name="search" size={64} color="#CBD5E1" />
              <Text style={sharedStyles.emptyText}>Search students to begin</Text>
            </View>
          ) : (
            <View style={sharedStyles.emptyWrap}>
              <SVGIcon name={activeFilter ? "receipt" : selectedClassId !== "all" ? "person" : "shirt"} size={64} color="#CBD5E1" />
              <Text style={sharedStyles.emptyText}>
                {activeFilter
                  ? "No purchases found for this category"
                  : selectedClassId !== "all"
                    ? "No students with uniform records in this class"
                    : "No students found"}
              </Text>
            </View>
          )
        }
      />

      <Modal visible={paymentModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={sharedStyles.overlay}>
          <View style={sharedStyles.sheetBody}>
            <View style={sharedStyles.sheetHandle} />
            <View style={sharedStyles.sheetHeader}>
              <View>
                <Text style={sharedStyles.sheetTitle}>{selectedStudent?.fullName}</Text>
                <Text style={sharedStyles.glassLabel}>UNIFORM PURCHASE</Text>
              </View>
              <TouchableOpacity onPress={() => setPaymentModalVisible(false)} style={sharedStyles.closeRound}>
                <SVGIcon name="close" size={24} color={VIBE.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={sharedStyles.glassLabel}>Select Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 25 }} contentContainerStyle={{ gap: 10 }}>
                {UNIFORM_TYPES.map(t => (
                  <TouchableOpacity
                    key={t.id}
                    style={[sharedStyles.methodBtn, selectedType === t.id && { backgroundColor: VIBE.primary, borderColor: VIBE.primary }, { flexDirection: 'row', gap: 8, paddingHorizontal: 15 }]}
                    onPress={() => setSelectedType(t.id)}
                  >
                    <SVGIcon name={t.icon} size={20} color={selectedType === t.id ? "#fff" : VIBE.muted} />
                    <Text style={[sharedStyles.methodText, selectedType === t.id && { color: "#fff" }]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: 15, marginBottom: 25 }}>
                <View style={{ flex: 1 }}>
                  <Text style={sharedStyles.glassLabel}>Price (₵)</Text>
                  <TextInput
                    style={sharedStyles.pillInput}
                    placeholder="0.00"
                    keyboardType="numeric"
                    value={amount}
                    onChangeText={setAmount}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={sharedStyles.glassLabel}>Payer Name</Text>
                  <TextInput
                    style={[sharedStyles.pillInput, { fontSize: 16 }]}
                    placeholder="Student/Parent"
                    value={receivedFrom}
                    onChangeText={setReceivedFrom}
                  />
                </View>
              </View>

              <TouchableOpacity style={[sharedStyles.saveBtn, { backgroundColor: VIBE.primary }]} onPress={handleLogPayment} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={sharedStyles.saveBtnText}>RECORD PURCHASE</Text>}
              </TouchableOpacity>

              <View style={sharedStyles.historyBlock}>
                <Text style={sharedStyles.blockTitle}>Recent Uniform Purchases</Text>
                {loadingHistory ? (
                  <ActivityIndicator color={VIBE.primary} />
                ) : history.length > 0 ? (
                  history.map((h, i) => (
                    <TouchableOpacity
                      key={i}
                      style={sharedStyles.transactionTile}
                      onPress={() => {
                        setPaymentModalVisible(false);
                        router.push({
                          pathname: "/shared/receipt-view",
                          params: {
                            type: 'payment',
                            studentId: selectedStudent?.uid,
                            paymentId: h.receiptNo,
                            year: h.academicYear,
                            term: h.term
                          }
                        });
                      }}
                      onLongPress={() => handleDeletePayment(h)}
                    >
                      <View style={sharedStyles.tileHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={sharedStyles.tileAmt}>₵{h.amount.toFixed(2)}</Text>
                          <View style={[sharedStyles.filterChip, { backgroundColor: VIBE.primary + '15', borderColor: 'transparent' }]}>
                            <Text style={[sharedStyles.filterChipText, { color: VIBE.primary }]}>
                              {h.subTypeLabel || 'UNIFORM'}
                            </Text>
                          </View>
                        </View>
                        <Text style={sharedStyles.methodText}>{h.method}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <Text style={sharedStyles.tileDate}>{moment(h.createdAt).format("MMM DD, YYYY")}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text style={sharedStyles.dailyReceipt}>{h.receiptNo}</Text>
                          <SVGIcon name="eye-outline" size={14} color={VIBE.muted} />
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={sharedStyles.noHistory}>No previous uniform transactions</Text>
                )}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ClassSelectorModal
        visible={classModalVisible}
        onClose={() => setClassModalVisible(false)}
        classes={classes}
        selectedClassId={selectedClassId}
        onSelect={setSelectedClassId}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: sharedVibe.bg },
});
