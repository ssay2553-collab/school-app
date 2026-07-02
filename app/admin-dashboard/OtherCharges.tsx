import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  collection,
  doc,
  getDocsFromServer,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
  limit,
  startAfter,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import moment from "moment";
import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
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
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
} from "react-native";
import * as Animatable from "react-native-animatable";
import { SafeAreaView } from "react-native-safe-area-context";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { db } from "../../firebaseConfig";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";
import { sortClasses } from "../../lib/classHelpers";
import { sendNotification } from "../../src/services/notificationService";

import { VIBE, styles } from "../../constants/admin-dashboard/ManageFeesStyles";
import { ClassSelectorModal } from "../../components/admin-dashboard/ClassSelectorModal";

const { width } = Dimensions.get("window");
const PAGE_SIZE = 50;

type Student = {
  uid: string;
  fullName: string;
  classId: string;
  className: string;
  otherPaid: number;
  otherBill: number;
  otherBalance: number;
  walletBalance: number;
  admissionBalance?: number;
  ptaBalance?: number;
  maintenanceBalance?: number;
  booksBalance?: number;
  uniformBalance?: number;
};

const THEME = {
  primary: "#8B5CF6", // Purple for Other Charges
  secondary: "#7C3AED",
};

export default function OtherCharges() {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const acadConfig = useAcademicConfig();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("all");
  const [classModalVisible, setClassModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [students, setStudents] = useState<Student[]>([]);

  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [receivedFrom, setReceivedFrom] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Cheque" | "E-cash" | "Momo">("Cash");
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [chargeType, setChargeType] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");
  const [appliedCharges, setAppliedCharges] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalBilled: 0, totalCollected: 0 });

  const lastVisibleRef = useRef<any>(null);
  const hasMoreRef = useRef(true);
  const isFetchingRef = useRef(false);

  // Initialize classes
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "classes"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, name: d.data().name, ...d.data() }));
      setClasses(sortClasses(list));
    });
    return () => unsub();
  }, []);

  const fetchStats = async () => {
    try {
      const year = acadConfig.academicYear;
      if (!year) return;

      let q = query(
        collection(db, "feePayments"),
        where("type", "in", ["other", "other_payment"]),
        where("academicYear", "==", year)
      );

      if (selectedClassId !== "all") {
        q = query(q, where("classId", "==", selectedClassId));
      }

      const snap = await getDocsFromServer(q);

      let totalCollected = 0;
      let totalBilled = 0;
      const groups: Record<string, { category: string, amount: number, date: string, count: number }> = {};

      snap.docs.forEach(doc => {
        const data = doc.data();
        if (data.type === "other_payment") {
          totalCollected += (data.amount || 0);
        }
        if (data.type === "other") {
          totalBilled += (data.amount || 0);
          const cat = data.otherCategory || "Other";
          if (!groups[cat]) {
            groups[cat] = { category: cat, amount: data.amount, date: data.date, count: 0 };
          }
          groups[cat].count++;
        }
      });

      setStats({ totalBilled: totalBilled, totalCollected: totalCollected });
      setAppliedCharges(Object.values(groups).sort((a, b) => b.date.localeCompare(a.date)));
    } catch (e) {
      console.error("Error fetching other charges stats:", e);
    }
  };

  const fetchStudents = useCallback(async (isFirstLoad = false) => {
    if (isFetchingRef.current) return;

    if (searchQuery.length < 2 && selectedClassId === "all") {
      if (isFirstLoad) {
        setStudents([]);
        setLoading(false);
      }
      return;
    }

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

      if (selectedClassId !== "all") {
        q = query(q, where("classId", "==", selectedClassId));
      }

      if (!isFirstLoad && lastVisibleRef.current) {
        q = query(q, startAfter(lastVisibleRef.current));
      }

      const snap = await getDocsFromServer(q);
      if (snap.empty) {
        hasMoreRef.current = false;
        if (isFirstLoad) setStudents([]);
        return;
      }

      const batch: Student[] = snap.docs.map(d => {
        const data = d.data();
        return {
          uid: d.id,
          fullName: `${data.profile?.firstName || ""} ${data.profile?.lastName || ""}`.trim() || "Student",
          classId: data.classId || "unknown",
          className: data.className || "Class",
          otherPaid: data.otherPaid || 0,
          otherBill: data.otherBill || 0,
          otherBalance: data.otherBalance || 0,
          walletBalance: data.walletBalance || 0,
          admissionBalance: data.admissionBalance || 0,
          ptaBalance: data.ptaBalance || 0,
          maintenanceBalance: data.maintenanceBalance || 0,
          booksBalance: data.booksBalance || 0,
          uniformBalance: data.uniformBalance || 0,
        };
      });

      lastVisibleRef.current = snap.docs[snap.docs.length - 1];
      hasMoreRef.current = snap.docs.length === PAGE_SIZE;
      setStudents(prev => isFirstLoad ? batch : [...prev, ...batch]);
    } catch (e) {
      console.error(e);
      showToast({ message: "Failed to fetch students", type: "error" });
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedClassId]);

  useEffect(() => {
    const delay = setTimeout(() => {
      fetchStudents(true);
    }, 400);
    return () => clearTimeout(delay);
  }, [selectedClassId, searchQuery, acadConfig.academicYear]);

  useEffect(() => {
    fetchStats();
  }, [selectedClassId, acadConfig.academicYear]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStudents(true);
    fetchStats();
  };

  const filteredStudents = useMemo(() => {
    const lower = searchQuery.toLowerCase();
    return students.filter(s => s.fullName.toLowerCase().includes(lower));
  }, [students, searchQuery]);

  const fetchPaymentHistory = async (studentUid: string) => {
    setLoadingHistory(true);
    try {
      const q = query(
        collection(db, "feePayments"),
        where("studentUid", "==", studentUid),
        where("type", "in", ["other", "other_payment"])
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
        const isPayment = (payment.type || "").toLowerCase() === "other_payment";

        if (isPayment) {
          batch.update(doc(db, "studentFeeRecords", recordId), {
            otherPaid: increment(-amount),
            otherBalance: increment(amount),
            balance: increment(amount),
          });
          batch.update(doc(db, "users", selectedStudent.uid), {
            otherPaid: increment(-amount),
            otherBalance: increment(amount),
            walletBalance: increment(amount),
          });
        } else {
          batch.update(doc(db, "studentFeeRecords", recordId), {
            otherBill: increment(-amount),
            otherBalance: increment(-amount),
            balance: increment(-amount),
          });
          batch.update(doc(db, "users", selectedStudent.uid), {
            otherBill: increment(-amount),
            otherBalance: increment(-amount),
            walletBalance: increment(-amount),
          });
        }

        batch.update(doc(db, "studentFeeRecords", recordId), {
          payments: arrayRemove(payment),
          lastUpdated: serverTimestamp(),
        });

        if (payment.receiptNo) {
          batch.delete(doc(db, "feePayments", payment.receiptNo));
        }

        await batch.commit();
        showToast({ message: "Transaction reverted successfully", type: "success" });
        setPaymentModalVisible(false);
        fetchStats();
        fetchStudents(true);
      } catch (err) {
        console.error("Delete transaction error:", err);
        showToast({ message: "Failed to revert transaction", type: "error" });
      } finally {
        setSaving(false);
      }
    };

    Alert.alert("Confirm Deletion", "Are you sure you want to delete this transaction? This will automatically adjust the student's balance.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: performDeletion },
    ]);
  };

  const handleLogPayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0 || !selectedStudent || !receivedFrom.trim()) {
      return showToast({ message: "Invalid details", type: "error" });
    }

    setSaving(true);
    try {
      const batch = writeBatch(db);
      const serial = `OTH-PAY-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const paymentEntry = {
        amount,
        method: paymentMethod,
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
        type: "other_payment",
        academicYear: acadConfig.academicYear,
        term: acadConfig.currentTerm,
      };

      batch.set(doc(db, "feePayments", serial), paymentEntry);

      batch.update(doc(db, "users", selectedStudent.uid), {
        otherPaid: increment(amount),
        otherBalance: increment(-amount),
        walletBalance: increment(-amount),
      });

      const year = acadConfig.academicYear?.replace(/\//g, "-");
      const term = acadConfig.currentTerm?.replace(/\s/g, "");
      const recordId = `${selectedStudent.uid}_${year}_${term}`;

      batch.set(doc(db, "studentFeeRecords", recordId), {
        otherPaid: increment(amount),
        otherBalance: increment(-amount),
        balance: increment(-amount),
        payments: arrayUnion(paymentEntry),
        lastUpdated: serverTimestamp(),
      }, { merge: true });

      await batch.commit();

      sendNotification({
        recipientId: selectedStudent.uid,
        senderId: appUser?.uid || "admin",
        senderName: appUser?.displayName || "Administrator",
        title: "Other Fees Payment Received",
        body: `A payment of ${SCHOOL_CONFIG.currencySymbol}${amount.toLocaleString()} has been recorded for ${selectedStudent.fullName}.`,
        type: "payment",
      }).catch(e => console.error(e));

      showToast({ message: `Payment recorded: ${serial}`, type: "success" });
      setPaymentModalVisible(false);
      setPaymentAmount("");
      setReceivedFrom("");
      fetchStats();
      fetchStudents(true);
    } catch (e) {
      console.error(e);
      showToast({ message: "Failed to record payment", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const applyOtherCharge = async () => {
    const val = parseFloat(chargeAmount);
    if (!chargeType.trim() || isNaN(val) || val <= 0) return showToast({ message: "Invalid details", type: "error" });
    if (selectedClassId === "all") return showToast({ message: "Please select a specific class first", type: "error" });

    if (appliedCharges.some(c => c.category.toLowerCase() === chargeType.trim().toLowerCase())) {
      return showToast({ message: "This item already exists for this class", type: "error" });
    }

    setSaving(true);
    try {
      const q = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("classId", "==", selectedClassId),
        where("status", "in", ["active", "pending_activation"])
      );
      const snap = await getDocsFromServer(q);

      const batch = writeBatch(db);
      const year = acadConfig.academicYear?.replace(/\//g, "-");
      const term = acadConfig.currentTerm?.replace(/\s/g, "");

      snap.docs.forEach(sDoc => {
        const s = sDoc.data();
        const serial = `BILL-OTH-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const recordId = `${sDoc.id}_${year}_${term}`;

        const billData = {
          amount: val,
          method: "Bulk Charge",
          receivedFrom: chargeType.trim(),
          updatedBy: appUser?.adminRole || "Admin",
          adminUid: appUser?.uid || "unknown",
          createdAt: new Date().toISOString(),
          receiptNo: serial,
          date: moment().format("YYYY-MM-DD"),
          studentUid: sDoc.id,
          studentName: `${s.profile?.firstName || ""} ${s.profile?.lastName || ""}`.trim(),
          classId: selectedClassId,
          className: s.className,
          type: "other",
          otherCategory: chargeType.trim(),
          academicYear: acadConfig.academicYear,
          term: acadConfig.currentTerm,
        };

        batch.set(doc(db, "feePayments", serial), billData);

        batch.update(sDoc.ref, {
          otherBill: increment(val),
          otherBalance: increment(val),
          walletBalance: increment(val),
        });

        batch.set(doc(db, "studentFeeRecords", recordId), {
          otherBill: increment(val),
          otherBalance: increment(val),
          balance: increment(val),
          payments: arrayUnion(billData),
          lastUpdated: serverTimestamp(),
        }, { merge: true });

        sendNotification({
          recipientId: sDoc.id,
          senderId: appUser?.uid || "admin",
          senderName: appUser?.displayName || "Administrator",
          title: "New Fee Item Billed",
          body: `An amount of ${SCHOOL_CONFIG.currencySymbol}${val.toLocaleString()} for '${chargeType}' has been added to the bill.`,
          type: "payment",
        }).catch(err => console.error("Bulk notification error:", err));
      });

      await batch.commit();
      showToast({ message: `Billed ${snap.size} students for ${chargeType}`, type: "success" });
      setChargeType("");
      setChargeAmount("");
      fetchStats();
      fetchStudents(true);
    } catch (e) {
      console.error(e);
      showToast({ message: "Failed to apply bulk charges", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCharge = async (category: string) => {
    const performDelete = async () => {
      setSaving(true);
      try {
        const q = query(
          collection(db, "feePayments"),
          where("classId", "==", selectedClassId),
          where("type", "==", "other"),
          where("otherCategory", "==", category),
          where("academicYear", "==", acadConfig.academicYear)
        );
        const snap = await getDocsFromServer(q);

        const batch = writeBatch(db);
        const year = acadConfig.academicYear?.replace(/\//g, "-");
        const term = acadConfig.currentTerm?.replace(/\s/g, "");

        for (const d of snap.docs) {
          const data = d.data();
          const studentUid = data.studentUid;
          const amount = data.amount;
          const recordId = `${studentUid}_${year}_${term}`;

          batch.update(doc(db, "users", studentUid), {
            otherBill: increment(-amount),
            otherBalance: increment(-amount),
            walletBalance: increment(-amount),
          });

          batch.set(doc(db, "studentFeeRecords", recordId), {
            otherBill: increment(-amount),
            otherBalance: increment(-amount),
            balance: increment(-amount),
            payments: arrayRemove(data),
          }, { merge: true });

          batch.delete(d.ref);
        }

        await batch.commit();
        showToast({ message: `Charge '${category}' removed`, type: "success" });
        fetchStats();
        fetchStudents(true);
      } catch (e) {
        console.error(e);
        showToast({ message: "Delete failed", type: "error" });
      } finally {
        setSaving(false);
      }
    };

    Alert.alert(
      "Reverse Charge",
      `Delete '${category}' and reverse balances for all students in this class?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete & Reverse", style: "destructive", onPress: performDelete },
      ]
    );
  };

  const renderStudentItem = ({ item }: { item: Student }) => {
    const isolatedTotal = (item.ptaBalance || 0) + (item.admissionBalance || 0) +
                          (item.maintenanceBalance || 0) + (item.booksBalance || 0) +
                          (item.uniformBalance || 0) + (item.otherBalance || 0);
    const tuitionBalance = Math.max(0, (item.walletBalance || 0) - isolatedTotal);

    return (
      <Animatable.View animation="fadeInUp" duration={400} style={styles.cardWrapper}>
        <TouchableOpacity
          style={styles.financeCard}
          onPress={() => {
            setSelectedStudent(item);
            setPaymentModalVisible(true);
            fetchPaymentHistory(item.uid);
          }}
        >
          <View style={styles.cardContent}>
            <View style={styles.leftSection}>
              <View style={[styles.avatar, { backgroundColor: THEME.primary + "15" }]}>
                <SVGIcon name="layers-outline" size={24} color={THEME.primary} />
              </View>
              <View style={styles.mainInfo}>
                <Text style={styles.studentName} numberOfLines={1}>{item.fullName}</Text>

                <View style={styles.tuitionBreakdown}>
                  <View style={styles.breakdownItem}>
                    <Text style={styles.breakdownLabel}>TUITION</Text>
                    <Text style={styles.breakdownValue}>₵{tuitionBalance.toFixed(0)}</Text>
                  </View>
                  <View style={styles.breakdownItem}>
                    <Text style={styles.breakdownLabel}>OTHER BILLED</Text>
                    <Text style={styles.breakdownValue}>₵{item.otherBill.toFixed(0)}</Text>
                  </View>
                </View>

                <View style={styles.debtBox}>
                  <Text style={[styles.debtLabel, { color: item.otherBalance > 0 ? VIBE.danger : VIBE.success }]}>
                    {item.otherBalance > 0 ? "Owed Other: " : "Cleared: "}
                  </Text>
                  <Text style={[styles.debtValue, { color: item.otherBalance > 0 ? VIBE.danger : VIBE.success }]}>
                    ₵{Math.abs(item.otherBalance).toLocaleString()}
                  </Text>
                </View>
              </View>
            </View>
            <SVGIcon name="chevron-forward" size={20} color={VIBE.muted} />
          </View>
        </TouchableOpacity>
      </Animatable.View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <LinearGradient
          colors={[THEME.primary, THEME.secondary]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.headerTop}
        >
          <View style={styles.navBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerIconBtn}>
              <SVGIcon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.titleCenter}>
              <Text style={styles.headerTitle}>Other Charges</Text>
              <Text style={styles.headerSub}>GRADUATION & SPECIALS</Text>
            </View>
            <TouchableOpacity onPress={() => setClassModalVisible(true)} style={styles.headerIconBtn}>
              <SVGIcon name="funnel-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.selectorGrid}>
            <TouchableOpacity style={styles.glassPill} onPress={() => setClassModalVisible(true)}>
              <Text style={styles.glassLabel}>TARGET CLASS</Text>
              <Text style={styles.glassValue} numberOfLines={1}>
                {selectedClassId === "all" ? "All Classes" : classes.find(c => c.id === selectedClassId)?.name || "Select Class"}
              </Text>
            </TouchableOpacity>
            <View style={styles.glassPill}>
              <Text style={styles.glassLabel}>ACADEMIC YEAR</Text>
              <Text style={styles.glassValue}>{acadConfig.academicYear || "---"}</Text>
            </View>
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
            <SVGIcon name="refresh" size={18} color={THEME.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={filteredStudents}
        renderItem={renderStudentItem}
        keyExtractor={item => item.uid}
        contentContainerStyle={styles.flatListContent}
        onEndReached={() => fetchStudents()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[THEME.primary]} />}
        ListHeaderComponent={
          <>
            <View style={[styles.statsDashboard, { paddingHorizontal: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }]}>
               <LinearGradient colors={[THEME.primary, THEME.secondary]} style={[styles.statBox, { width: (width - 52)/2 }]}>
                  <Text style={styles.statLabel}>TOTAL BILLED</Text>
                  <Text style={styles.statValue}>₵{stats.totalBilled.toLocaleString()}</Text>
                  <SVGIcon name="receipt" size={24} color="rgba(255,255,255,0.3)" style={styles.statIcon} />
               </LinearGradient>
               <LinearGradient colors={[VIBE.success, "#059669"]} style={[styles.statBox, { width: (width - 52)/2 }]}>
                  <Text style={styles.statLabel}>COLLECTED</Text>
                  <Text style={styles.statValue}>₵{stats.totalCollected.toLocaleString()}</Text>
                  <SVGIcon name="cash" size={24} color="rgba(255,255,255,0.3)" style={styles.statIcon} />
               </LinearGradient>
            </View>

            <View style={{ paddingHorizontal: 20, marginBottom: 25 }}>
              <Text style={styles.listTitle}>BILL NEW ITEM (CLASS BULK)</Text>
              <View style={[styles.bulkInputContainer, { marginTop: 10 }]}>
                <TextInput
                  style={[styles.bulkInput, { flex: 2 }]}
                  placeholder="Description (e.g. Graduation)"
                  value={chargeType}
                  onChangeText={setChargeType}
                  placeholderTextColor={VIBE.muted}
                />
                <View style={{ width: 1, height: 30, backgroundColor: VIBE.border, marginHorizontal: 10 }} />
                <TextInput
                  style={[styles.bulkInput, { flex: 1 }]}
                  placeholder="Amt"
                  keyboardType="numeric"
                  value={chargeAmount}
                  onChangeText={setChargeAmount}
                  placeholderTextColor={VIBE.muted}
                />
                <TouchableOpacity
                   onPress={applyOtherCharge}
                   style={{ backgroundColor: THEME.primary, width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}
                >
                  <SVGIcon name="add" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              {selectedClassId === "all" && (
                <Text style={{ fontSize: 10, color: VIBE.danger, marginTop: 8, fontWeight: "700" }}>
                  * Select a specific class to enable bulk billing
                </Text>
              )}
            </View>

            {appliedCharges.length > 0 && (
              <View style={styles.breakdownContainer}>
                <Text style={styles.listTitle}>APPLIED CHARGES ({selectedClassId === "all" ? "TOTAL" : classes.find(c => c.id === selectedClassId)?.name})</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.breakdownScroll}>
                  {appliedCharges.map((item, idx) => (
                    <View key={idx} style={styles.breakdownCard}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={styles.summaryBreakdownLabel} numberOfLines={1}>{item.category}</Text>
                          {selectedClassId !== "all" && (
                            <TouchableOpacity onPress={() => handleDeleteCharge(item.category)}>
                              <SVGIcon name="close-circle" size={16} color={VIBE.danger} />
                            </TouchableOpacity>
                          )}
                        </View>
                        <Text style={styles.summaryBreakdownValue}>₵{item.amount.toLocaleString()}</Text>
                        <Text style={{ fontSize: 9, color: VIBE.muted, fontWeight: '700' }}>{item.count} students</Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            <Text style={[styles.listTitle, { marginHorizontal: 20, marginTop: 25, marginBottom: 15 }]}>STUDENT DIRECTORY</Text>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={THEME.primary} style={{ marginTop: 50 }} />
          ) : (
            <View style={styles.emptyWrap}>
              <SVGIcon name="search" size={64} color="#CBD5E1" />
              <Text style={styles.emptyText}>
                {searchQuery.length < 2 && selectedClassId === "all"
                  ? "Search for a student to manage other fees"
                  : "No students found matching your search"}
              </Text>
            </View>
          )
        }
      />

      <ClassSelectorModal
        visible={classModalVisible}
        onClose={() => setClassModalVisible(false)}
        classes={classes}
        selectedClassId={selectedClassId}
        onSelect={setSelectedClassId}
      />

      <Modal visible={paymentModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.overlay}>
          <View style={styles.sheetBody}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>{selectedStudent?.fullName}</Text>
                <Text style={{ fontSize: 10, fontWeight: '800', color: VIBE.muted }}>OTHER FEES PAYMENT</Text>
              </View>
              <TouchableOpacity onPress={() => setPaymentModalVisible(false)} style={styles.closeRound}>
                <SVGIcon name="close" size={24} color={VIBE.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              <View style={{ gap: 15, marginBottom: 25 }}>
                <Text style={styles.breakdownLabel}>AMOUNT TO PAY (₵)</Text>
                <TextInput
                  style={styles.pillInput}
                  placeholder="0.00"
                  keyboardType="numeric"
                  value={paymentAmount}
                  onChangeText={setPaymentAmount}
                />

                <Text style={styles.breakdownLabel}>RECEIVED FROM</Text>
                <TextInput
                  style={[styles.pillInput, { fontSize: 16 }]}
                  placeholder="Payer Name"
                  value={receivedFrom}
                  onChangeText={setReceivedFrom}
                />
              </View>

              <Text style={styles.breakdownLabel}>PAYMENT METHOD</Text>
              <View style={styles.methodGrid}>
                {["Cash", "Cheque", "Momo", "E-cash"].map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.methodBtn, paymentMethod === m && { backgroundColor: THEME.primary, borderColor: THEME.primary }]}
                    onPress={() => setPaymentMethod(m as any)}
                  >
                    <Text style={[styles.methodText, paymentMethod === m && { color: "#fff" }]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity onPress={handleLogPayment} disabled={saving}>
                <LinearGradient colors={[THEME.primary, THEME.secondary]} style={styles.saveBtn}>
                  {saving ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <Text style={styles.saveBtnText}>CONFIRM PAYMENT</Text>
                      <SVGIcon name="checkmark-circle" size={20} color="#fff" />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.historyBlock}>
                <Text style={styles.blockTitle}>Transaction History</Text>
                {loadingHistory ? <ActivityIndicator color={THEME.primary} style={{ marginTop: 20 }} /> : (
                  history.length > 0 ? history.map((h, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.transactionTile}
                      onPress={() => {
                        setPaymentModalVisible(false);
                        router.push({
                          pathname: "/shared/receipt-view",
                          params: {
                            type: h.type === 'other' ? 'bill' : 'payment',
                            studentId: selectedStudent?.uid,
                            paymentId: h.receiptNo,
                            year: h.academicYear,
                            term: h.term
                          }
                        });
                      }}
                      onLongPress={() => handleDeletePayment(h)}
                    >
                      <View style={styles.tileHeader}>
                        <Text style={[styles.tileAmt, { color: h.type === 'other' ? VIBE.info : VIBE.success }]}>
                          ₵{h.amount.toLocaleString()}
                        </Text>
                        <View style={{ backgroundColor: h.type === 'other' ? VIBE.info + '15' : VIBE.success + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                           <Text style={{ fontSize: 9, fontWeight: '900', color: h.type === 'other' ? VIBE.info : VIBE.success }}>
                             {h.type === 'other' ? 'BILL' : 'PAYMENT'}
                           </Text>
                        </View>
                      </View>
                      <Text style={styles.tileDetail}>{h.otherCategory || h.method || h.receivedFrom}</Text>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                         <Text style={styles.tileDate}>{moment(h.createdAt).format("MMM DD, YYYY • HH:mm")}</Text>
                         <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              handleDeletePayment(h);
                            }}
                            style={{ padding: 4 }}
                          >
                            <SVGIcon name="trash" size={16} color={VIBE.danger} />
                          </TouchableOpacity>
                          <SVGIcon name="eye-outline" size={14} color={VIBE.muted} />
                        </View>
                      </View>
                    </TouchableOpacity>
                  )) : <Text style={styles.noHistory}>No history available</Text>
                )}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
