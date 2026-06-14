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
  arrayUnion,
  startAfter,
  where,
  writeBatch,
  documentId,
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
  primary: "#6366F1",
  secondary: "#F59E0B",
  success: "#10B981",
  danger: "#EF4444",
  info: "#3B82F6",
  purple: "#8B5CF6",
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  text: "#1E293B",
  muted: "#64748B",
  border: "#E2E8F0",
};

const PAGE_SIZE = 50;

type Student = {
  uid: string;
  fullName: string;
  classId: string;
  className: string;
  admissionFeePaid: number;
  admissionFeeBill: number;
  admissionBalance: number;
  walletBalance: number;
};

export default function AdmissionCharges() {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const acadConfig = useAcademicConfig();

  const primaryBrand = SCHOOL_CONFIG.primaryColor || COLORS.primary || VIBE.primary;
  const secondaryBrand = SCHOOL_CONFIG.secondaryColor || primaryBrand;

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [students, setStudents] = useState<Student[]>([]);

  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [receivedFrom, setReceivedFrom] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Cheque" | "E-cash" | "Momo">("Cash");
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [stats, setStats] = useState<any>({
    totalRevenue: 0,
    term1Count: 0,
    term1Revenue: 0,
    term2Count: 0,
    term2Revenue: 0,
    term3Count: 0,
    term3Revenue: 0,
  });
  const [activeTab, setActiveTab] = useState<"payment" | "billing">("payment");
  const [billAmount, setBillAmount] = useState("");
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);

  const lastVisibleRef = useRef<any>(null);
  const hasMoreRef = useRef(true);
  const isFetchingRef = useRef(false);

  const fetchStats = async () => {
    try {
      const year = acadConfig.academicYear;
      if (!year) return;

      const q = query(
        collection(db, "feePayments"),
        where("type", "in", ["admission", "admission_payment"]),
        where("academicYear", "==", year)
      );
      const snap = await getDocsFromServer(q);

      let totalCollected = 0;
      let totalBilled = 0;
      let t1Uids = new Set();
      let t2Uids = new Set();
      let t3Uids = new Set();
      let t1Rev = 0;
      let t2Rev = 0;
      let t3Rev = 0;

      snap.docs.forEach(doc => {
        const data = doc.data();
        const termStr = data.term?.toLowerCase() || "";
        const isT1 = termStr.includes("1");
        const isT2 = termStr.includes("2");
        const isT3 = termStr.includes("3");

        if (data.type === "admission_payment") {
          totalCollected += (data.amount || 0);
          if (isT1) t1Rev += data.amount;
          if (isT2) t2Rev += data.amount;
          if (isT3) t3Rev += data.amount;
        }

        if (data.type === "admission") {
          totalBilled += (data.amount || 0);
          if (isT1) t1Uids.add(data.studentUid);
          if (isT2) t2Uids.add(data.studentUid);
          if (isT3) t3Uids.add(data.studentUid);
        }
      });

      setStats({
        totalRevenue: totalCollected,
        totalDebt: totalBilled - totalCollected,
        term1Count: t1Uids.size,
        term1Revenue: t1Rev,
        term2Count: t2Uids.size,
        term2Revenue: t2Rev,
        term3Count: t3Uids.size,
        term3Revenue: t3Rev,
      });
    } catch (e) {
      console.error("Error fetching admission stats:", e);
    }
  };

  const fetchAdmittedStudents = useCallback(async (termName: string) => {
    setLoading(true);
    setStudents([]);
    try {
      const year = acadConfig.academicYear;
      const q = query(
        collection(db, "feePayments"),
        where("type", "==", "admission"),
        where("academicYear", "==", year),
        where("term", "==", termName)
      );
      const snap = await getDocsFromServer(q);
      const uids = Array.from(new Set(snap.docs.map(d => d.data().studentUid)));

      if (uids.length === 0) {
        setStudents([]);
        return;
      }

      const studentList: Student[] = [];
      for (let i = 0; i < uids.length; i += 30) {
        const batchUids = uids.slice(i, i + 30);
        const uq = query(collection(db, "users"), where(documentId(), "in", batchUids));
        const uSnap = await getDocsFromServer(uq);
        uSnap.docs.forEach(d => {
          const data = d.data();
          studentList.push({
            uid: d.id,
            fullName: `${data.profile?.firstName || ""} ${data.profile?.lastName || ""}`.trim() || "Student",
            classId: data.classId || "unknown",
            className: data.className || "Class",
            admissionFeePaid: data.admissionFeePaid || 0,
            admissionFeeBill: data.admissionFeeBill || 0,
            admissionBalance: data.admissionBalance || 0,
            walletBalance: data.walletBalance || 0,
          });
        });
      }
      setStudents(studentList.sort((a, b) => a.fullName.localeCompare(b.fullName)));
    } catch (e) {
      console.error(e);
      showToast({ message: "Failed to fetch admitted students", type: "error" });
    } finally {
      setLoading(false);
    }
  }, [acadConfig.academicYear]);

  useEffect(() => {
    fetchStats();
  }, [acadConfig.academicYear]);

  const fetchStudents = useCallback(async (isFirstLoad = false) => {
    if (!searchQuery.trim() && !isFirstLoad) {
      setStudents([]);
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
          admissionFeePaid: data.admissionFeePaid || 0,
          admissionFeeBill: data.admissionFeeBill || 0,
          admissionBalance: data.admissionBalance || 0,
          walletBalance: data.walletBalance || 0,
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
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      setSelectedTerm(null);
      const delayDebounceFn = setTimeout(() => {
        fetchStudents(true);
      }, 500);
      return () => clearTimeout(delayDebounceFn);
    } else if (!selectedTerm) {
      setStudents([]);
    }
  }, [searchQuery]);

  const handleRefresh = () => {
    setRefreshing(true);
    if (selectedTerm) {
      fetchAdmittedStudents(selectedTerm);
    } else if (searchQuery.trim().length >= 2) {
      fetchStudents(true);
    }
    fetchStats();
  };

  const filteredStudents = useMemo(() => {
    const lower = searchQuery.toLowerCase();
    if (selectedTerm) {
      return students.filter(s => s.fullName.toLowerCase().includes(lower));
    }
    if (!searchQuery.trim()) return [];
    return students.filter(s => s.fullName.toLowerCase().includes(lower));
  }, [students, searchQuery, selectedTerm]);

  const fetchPaymentHistory = async (studentUid: string) => {
    setLoadingHistory(true);
    try {
      const q = query(
        collection(db, "feePayments"),
        where("studentUid", "==", studentUid),
        where("type", "==", "admission")
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

  const handleLogPayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0 || !selectedStudent || !receivedFrom.trim()) {
      return showToast({ message: "Please enter valid payment details", type: "error" });
    }

    setSaving(true);
    try {
      const batch = writeBatch(db);
      const serial = `ADM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

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
        type: "admission_payment",
        academicYear: acadConfig.academicYear,
        term: acadConfig.currentTerm,
      };

      // 1. Record the Payment
      batch.set(doc(db, "feePayments", serial), paymentEntry);

      // 2. Update student record
      batch.update(doc(db, "users", selectedStudent.uid), {
        admissionFeePaid: increment(amount),
        admissionBalance: increment(-amount),
      });

      // 3. Update ledger (studentFeeRecords)
      const year = acadConfig.academicYear?.replace(/\//g, "-");
      const term = acadConfig.currentTerm?.replace(/\s/g, "");
      const recordId = `${selectedStudent.uid}_${year}_${term}`;

      batch.set(doc(db, "studentFeeRecords", recordId), {
        admissionPaid: increment(amount),
        admissionBalance: increment(-amount),
        payments: arrayUnion(paymentEntry),
        lastUpdated: serverTimestamp(),
      }, { merge: true });

      await batch.commit();

      // Send notification to parent
      try {
        await sendNotification({
          recipientId: selectedStudent.uid,
          senderId: appUser?.uid || "admin",
          senderName: "School Finance",
          title: "Admission Payment Received",
          body: `An admission payment of ${SCHOOL_CONFIG.currencySymbol}${amount.toLocaleString()} has been recorded for ${selectedStudent.fullName}.`,
          type: "payment",
          data: {
            studentUid: selectedStudent.uid,
            amount,
            type: "admission_payment"
          }
        });
      } catch (notifErr) {
        console.error("Failed to send admission notification:", notifErr);
      }

      showToast({ message: `Admission payment recorded: ${serial}`, type: "success" });
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

  const handleLogBill = async () => {
    const amount = parseFloat(billAmount);
    if (isNaN(amount) || amount <= 0 || !selectedStudent) {
      return showToast({ message: "Please enter a valid billing amount", type: "error" });
    }

    setSaving(true);
    try {
      const batch = writeBatch(db);
      const serial = `BILL-ADM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const billEntry = {
        amount,
        method: "Admission Bill",
        receivedFrom: "System Billing",
        updatedBy: appUser?.adminRole || "Admin",
        adminUid: appUser?.uid || "unknown",
        createdAt: new Date().toISOString(),
        receiptNo: serial,
        date: moment().format("YYYY-MM-DD"),
        studentUid: selectedStudent.uid,
        studentName: selectedStudent.fullName,
        classId: selectedStudent.classId,
        className: selectedStudent.className,
        type: "admission",
        academicYear: acadConfig.academicYear,
        term: acadConfig.currentTerm,
      };

      // 1. Record the Bill
      batch.set(doc(db, "feePayments", serial), billEntry);

      // 2. Update student record
      batch.update(doc(db, "users", selectedStudent.uid), {
        admissionFeeBill: increment(amount),
        admissionBalance: increment(amount),
      });

      // 3. Update ledger (studentFeeRecords)
      const year = acadConfig.academicYear?.replace(/\//g, "-");
      const term = acadConfig.currentTerm?.replace(/\s/g, "");
      const recordId = `${selectedStudent.uid}_${year}_${term}`;

      batch.set(doc(db, "studentFeeRecords", recordId), {
        admissionBalance: increment(amount),
        payments: arrayUnion(billEntry),
        lastUpdated: serverTimestamp(),
      }, { merge: true });

      await batch.commit();

      showToast({ message: `Admission bill created: ${serial}`, type: "success" });
      setPaymentModalVisible(false);
      setBillAmount("");
      fetchStats();
      fetchStudents(true);
    } catch (e) {
      console.error(e);
      showToast({ message: "Failed to create bill", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const renderStudentItem = ({ item }: { item: Student }) => (
    <Animatable.View animation="fadeInUp" duration={400} style={styles.cardWrapper}>
      <TouchableOpacity
        style={styles.studentCard}
        onPress={() => {
          setSelectedStudent(item);
          setPaymentAmount("");
          setReceivedFrom("");
          setPaymentModalVisible(true);
          fetchPaymentHistory(item.uid);
        }}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.fullName.charAt(0)}</Text>
        </View>
        <View style={styles.studentInfo}>
          <Text style={styles.studentName}>{item.fullName}</Text>
          <Text style={styles.studentClass}>{item.className}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: VIBE.info + "15", marginRight: 8 }]}>
              <Text style={[styles.badgeText, { color: VIBE.info }]}>
                Bill: ₵{(item.admissionFeeBill || 0).toFixed(2)}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: VIBE.success + "15", marginRight: 8 }]}>
              <Text style={[styles.badgeText, { color: VIBE.success }]}>
                Paid: ₵{(item.admissionFeePaid || 0).toFixed(2)}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: (item.admissionBalance > 0) ? VIBE.danger + "15" : VIBE.purple + "15" }]}>
              <Text style={[styles.badgeText, { color: (item.admissionBalance > 0) ? VIBE.danger : VIBE.purple }]}>
                Owed: ₵{Math.max(0, item.admissionBalance || 0).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
        <SVGIcon name="chevron-forward" size={20} color={VIBE.muted} />
      </TouchableOpacity>
    </Animatable.View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <LinearGradient
          colors={[primaryBrand, secondaryBrand]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerTop}
        >
          <View style={styles.navBar}>
            <TouchableOpacity onPress={() => router.push("/admin-dashboard/StudentCharges")} style={styles.headerIconBtn}>
              <SVGIcon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.titleCenter}>
              <Text style={styles.headerTitle}>Admission Fees</Text>
              <Text style={styles.headerSub}>ENROLLMENT BILLING</Text>
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
        <View style={[styles.statCard, { backgroundColor: VIBE.primary }]}>
          <Text style={styles.statLabel}>Revenue</Text>
          <Text style={styles.statValue}>₵{stats.totalRevenue.toLocaleString()}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: VIBE.danger }]}>
          <Text style={styles.statLabel}>Outstanding</Text>
          <Text style={styles.statValue}>₵{(stats.totalDebt || 0).toLocaleString()}</Text>
        </View>
      </View>

      <View style={[styles.statsRow, { marginTop: 10 }]}>
        <View style={styles.statGrid}>
          {[1, 2, 3].map(t => {
            const termName = `Term ${t}`;
            const isActive = selectedTerm === termName;
            return (
              <TouchableOpacity
                key={t}
                style={[styles.miniStat, isActive && styles.activeMiniStat]}
                onPress={() => {
                  if (isActive) {
                    setSelectedTerm(null);
                    setStudents([]);
                  } else {
                    setSelectedTerm(termName);
                    setSearchQuery("");
                    fetchAdmittedStudents(termName);
                  }
                }}
              >
                <Text style={[styles.miniLabel, isActive && styles.activeMiniLabel]}>Term {t}</Text>
                <Text style={[styles.miniValue, isActive && styles.activeMiniValue]}>{stats[`term${t}Count`]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {selectedTerm && (
        <View style={styles.termInfoBar}>
          <View style={styles.termInfoLeft}>
            <Text style={styles.termInfoLabel}>ADMITTED IN {selectedTerm.toUpperCase()}</Text>
            <Text style={styles.termInfoRevenue}>Term Collection: ₵{stats[`term${selectedTerm.slice(-1)}Revenue`].toLocaleString()}</Text>
          </View>
          <TouchableOpacity onPress={() => { setSelectedTerm(null); setStudents([]); }} style={styles.clearTermBtn}>
            <SVGIcon name="close-circle" size={24} color={VIBE.danger} />
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={filteredStudents}
        renderItem={renderStudentItem}
        keyExtractor={item => item.uid}
        contentContainerStyle={styles.listContent}
        onEndReached={() => !selectedTerm && fetchStudents()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[VIBE.primary]} />
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={VIBE.primary} style={{ marginTop: 50 }} />
          ) : searchQuery.length < 2 && !selectedTerm ? (
            <View style={styles.emptyWrap}>
              <SVGIcon name="search" size={64} color="#CBD5E1" />
              <Text style={styles.emptyText}>Search or select a term to view students</Text>
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <SVGIcon name="person" size={64} color="#CBD5E1" />
              <Text style={styles.emptyText}>No students found</Text>
            </View>
          )
        }
      />

      {/* Payment Modal */}
      <Modal visible={paymentModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.overlay}>
          <View style={styles.modalBody}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{selectedStudent?.fullName}</Text>
                <Text style={styles.modalSubtitle}>ADMISSION FEE PAYMENT</Text>
              </View>
              <TouchableOpacity onPress={() => setPaymentModalVisible(false)} style={styles.closeBtn}>
                <SVGIcon name="close" size={24} color={VIBE.muted} />
              </TouchableOpacity>
            </View>

            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, activeTab === "payment" && styles.activeTab]}
                onPress={() => setActiveTab("payment")}
              >
                <Text style={[styles.tabText, activeTab === "payment" && styles.activeTabText]}>PAYMENT</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === "billing" && styles.activeTab]}
                onPress={() => setActiveTab("billing")}
              >
                <Text style={[styles.tabText, activeTab === "billing" && styles.activeTabText]}>BILLING</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              {activeTab === "payment" ? (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Amount to Pay (₵)</Text>
                    <TextInput
                      style={styles.mainInput}
                      placeholder="0.00"
                      keyboardType="numeric"
                      value={paymentAmount}
                      onChangeText={setPaymentAmount}
                      placeholderTextColor={VIBE.muted}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Received From</Text>
                    <TextInput
                      style={styles.subInput}
                      placeholder="Payer Name"
                      value={receivedFrom}
                      onChangeText={setReceivedFrom}
                      placeholderTextColor={VIBE.muted}
                    />
                  </View>

                  <Text style={styles.inputLabel}>Payment Method</Text>
                  <View style={styles.methodGrid}>
                    {["Cash", "Cheque", "Momo", "E-cash"].map(m => (
                      <TouchableOpacity
                        key={m}
                        style={[styles.methodBtn, paymentMethod === m && styles.activeMethod]}
                        onPress={() => setPaymentMethod(m as any)}
                      >
                        <Text style={[styles.methodText, paymentMethod === m && styles.activeMethodText]}>{m}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity style={styles.submitBtn} onPress={handleLogPayment} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>CONFIRM PAYMENT</Text>}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Admission Fee Amount (₵)</Text>
                    <TextInput
                      style={styles.mainInput}
                      placeholder="0.00"
                      keyboardType="numeric"
                      value={billAmount}
                      onChangeText={setBillAmount}
                      placeholderTextColor={VIBE.muted}
                    />
                  </View>
                  <TouchableOpacity style={[styles.submitBtn, { backgroundColor: VIBE.secondary }]} onPress={handleLogBill} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>INITIATE BILLING</Text>}
                  </TouchableOpacity>
                </>
              )}

              <View style={styles.historySection}>
                <Text style={styles.sectionTitle}>Payment History</Text>
                {loadingHistory ? (
                  <ActivityIndicator color={VIBE.primary} />
                ) : history.length > 0 ? (
                  history.map((h, i) => (
                    <View key={i} style={styles.historyItem}>
                      <View>
                        <Text style={styles.historyAmt}>₵{h.amount.toFixed(2)}</Text>
                        <Text style={styles.historyDate}>{moment(h.createdAt).format("MMM DD, YYYY")}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={styles.historyMethod}>{h.method}</Text>
                        <Text style={styles.historyReceipt}>{h.receiptNo}</Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noHistory}>No previous admission payments</Text>
                )}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VIBE.bg },
  header: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    ...SHADOWS.medium,
    paddingBottom: 20,
    zIndex: 10,
  },
  headerTop: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  navBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  titleCenter: { alignItems: "center" },
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#fff" },
  headerSub: { fontSize: 10, fontWeight: "800", color: "rgba(255,255,255,0.7)", letterSpacing: 2 },
  searchStrip: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginTop: -25,
    gap: 10,
  },
  searchBar: {
    flex: 1,
    height: 50,
    backgroundColor: "#fff",
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: VIBE.border,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 14, fontWeight: "600", color: VIBE.text },
  refreshRound: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: VIBE.border,
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginTop: 20,
    gap: 12,
  },
  statCard: {
    flex: 1.2,
    padding: 15,
    borderRadius: 20,
    justifyContent: "center",
    ...SHADOWS.small,
  },
  statLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValue: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 4,
  },
  statGrid: {
    flex: 2,
    flexDirection: "row",
    gap: 8,
  },
  miniStat: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: VIBE.border,
    alignItems: "center",
    justifyContent: "center",
  },
  miniLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: VIBE.muted,
    textTransform: "uppercase",
  },
  miniValue: {
    fontSize: 14,
    fontWeight: "900",
    color: VIBE.text,
    marginTop: 2,
  },
  activeMiniStat: {
    backgroundColor: VIBE.primary,
    borderColor: VIBE.primary,
  },
  activeMiniLabel: {
    color: "rgba(255,255,255,0.8)",
  },
  activeMiniValue: {
    color: "#fff",
  },
  termInfoBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginTop: 15,
    padding: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: VIBE.border,
    ...SHADOWS.small,
  },
  termInfoLeft: {
    flex: 1,
  },
  termInfoLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: VIBE.muted,
    letterSpacing: 1,
  },
  termInfoRevenue: {
    fontSize: 14,
    fontWeight: "900",
    color: VIBE.success,
    marginTop: 2,
  },
  clearTermBtn: {
    padding: 5,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: VIBE.bg,
    borderRadius: 15,
    padding: 5,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: "#fff",
    ...SHADOWS.small,
  },
  tabText: {
    fontSize: 12,
    fontWeight: "800",
    color: VIBE.muted,
  },
  activeTabText: {
    color: VIBE.primary,
  },
  listContent: { padding: 20, paddingTop: 20 },
  cardWrapper: { marginBottom: 12 },
  studentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 20,
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: VIBE.border,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: VIBE.primary + "10",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { fontSize: 22, fontWeight: "900", color: VIBE.primary },
  studentInfo: { flex: 1, marginLeft: 15 },
  studentName: { fontSize: 16, fontWeight: "800", color: VIBE.text },
  studentClass: { fontSize: 12, color: VIBE.muted, fontWeight: "600", marginTop: 2 },
  badgeRow: { flexDirection: "row", marginTop: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: "800" },
  emptyWrap: { alignItems: "center", marginTop: 100, opacity: 0.5 },
  emptyText: { fontSize: 18, fontWeight: "900", color: "#94A3B8", marginTop: 20 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBody: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 25,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
  },
  modalTitle: { fontSize: 20, fontWeight: "900", color: VIBE.text },
  modalSubtitle: { fontSize: 10, fontWeight: "800", color: VIBE.muted, letterSpacing: 1 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: VIBE.bg, justifyContent: "center", alignItems: "center" },
  inputGroup: { marginBottom: 20 },
  inputLabel: { fontSize: 12, fontWeight: "800", color: VIBE.muted, marginBottom: 8, marginLeft: 5 },
  mainInput: {
    backgroundColor: VIBE.bg,
    borderRadius: 20,
    padding: 20,
    fontSize: 28,
    fontWeight: "900",
    color: VIBE.primary,
    borderWidth: 1,
    borderColor: VIBE.border,
    textAlign: "center",
  },
  subInput: {
    backgroundColor: VIBE.bg,
    borderRadius: 15,
    padding: 15,
    fontSize: 16,
    fontWeight: "700",
    color: VIBE.text,
    borderWidth: 1,
    borderColor: VIBE.border,
  },
  methodGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 25 },
  methodBtn: {
    flex: 1,
    minWidth: "45%",
    height: 50,
    borderRadius: 15,
    backgroundColor: VIBE.bg,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: VIBE.border,
  },
  activeMethod: { backgroundColor: VIBE.primary, borderColor: VIBE.primary },
  methodText: { fontSize: 14, fontWeight: "800", color: VIBE.muted },
  activeMethodText: { color: "#fff" },
  submitBtn: {
    backgroundColor: VIBE.primary,
    height: 65,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.medium,
  },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 1 },
  historySection: { marginTop: 30, borderTopWidth: 1, borderTopColor: VIBE.border, paddingTop: 25 },
  sectionTitle: { fontSize: 16, fontWeight: "900", color: VIBE.text, marginBottom: 15 },
  historyItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: VIBE.bg,
    padding: 15,
    borderRadius: 15,
    marginBottom: 10,
  },
  historyAmt: { fontSize: 16, fontWeight: "900", color: VIBE.text },
  historyDate: { fontSize: 11, color: VIBE.muted, fontWeight: "600" },
  historyMethod: { fontSize: 12, fontWeight: "800", color: VIBE.primary },
  historyReceipt: { fontSize: 10, color: VIBE.muted, fontWeight: "700" },
  noHistory: { textAlign: "center", color: VIBE.muted, fontStyle: "italic", marginTop: 10 },
});
