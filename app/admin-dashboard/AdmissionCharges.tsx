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
  arrayRemove,
  startAfter,
  where,
  writeBatch,
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
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { db } from "../../firebaseConfig";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";
import { sendNotification } from "../../src/services/notificationService";
import { ClassSelectorModal } from "../../components/admin-dashboard/ClassSelectorModal";
import { VIBE, styles } from "../../constants/admin-dashboard/ManageFeesStyles";

const { width } = Dimensions.get("window");
const PAGE_SIZE = 50;

type Student = {
  uid: string;
  fullName: string;
  classId: string;
  className: string;
  admissionPaid: number;
  admissionBill: number;
  admissionBalance: number;
  walletBalance: number;
  // Isolated Balances
  ptaBalance?: number;
  maintenanceBalance?: number;
  booksBalance?: number;
  uniformBalance?: number;
  otherBalance?: number;
};

const THEME = {
  primary: "#6366F1", // Admission Indigo
  secondary: "#4F46E5",
};

export default function AdmissionCharges() {
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
  const [stats, setStats] = useState<any>({
    totalCollected: 0,
    totalBilled: 0,
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

      let q = query(
        collection(db, "feePayments"),
        where("type", "in", ["admission", "admission_payment"]),
        where("academicYear", "==", year)
      );

      if (selectedClassId !== "all") {
        q = query(q, where("classId", "==", selectedClassId));
      }

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
        totalCollected: totalCollected,
        totalBilled: totalBilled,
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

  const fetchAdmittedStudents = useCallback(async (termName?: string) => {
    setLoading(true);
    setStudents([]);
    try {
      const year = acadConfig.academicYear;
      if (!year) return;

      let q = query(
        collection(db, "feePayments"),
        where("type", "in", ["admission", "admission_payment"]),
        where("academicYear", "==", year)
      );

      if (selectedClassId !== "all") {
        q = query(q, where("classId", "==", selectedClassId));
      }

      const snap = await getDocsFromServer(q);

      let uids: string[] = [];
      if (termName) {
        const targetNum = termName.match(/\d/)?.[0];
        uids = Array.from(new Set(
          snap.docs
            .filter(d => {
              const docTerm = (d.data().term || "").toLowerCase();
              return targetNum ? docTerm.includes(targetNum) : docTerm === termName.toLowerCase();
            })
            .map(d => d.data().studentUid)
        ));
      } else {
        uids = Array.from(new Set(snap.docs.map(d => d.data().studentUid)));
      }

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
            admissionPaid: data.admissionPaid || 0,
            admissionBill: data.admissionBill || 0,
            admissionBalance: data.admissionBalance || 0,
            walletBalance: data.walletBalance || 0,
            ptaBalance: data.ptaBalance || 0,
            maintenanceBalance: data.maintenanceBalance || 0,
            booksBalance: data.booksBalance || 0,
            uniformBalance: data.uniformBalance || 0,
            otherBalance: data.otherBalance || 0,
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
  }, [acadConfig.academicYear, selectedClassId, showToast]);

  useEffect(() => {
    fetchStats();
  }, [acadConfig.academicYear, selectedClassId]);

  const fetchStudents = useCallback(async (isFirstLoad = false) => {
    if (isFetchingRef.current) return;
    if (!isFirstLoad && !hasMoreRef.current) return;

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
          admissionPaid: data.admissionPaid || 0,
          admissionBill: data.admissionBill || 0,
          admissionBalance: data.admissionBalance || 0,
          walletBalance: data.walletBalance || 0,
          ptaBalance: data.ptaBalance || 0,
          maintenanceBalance: data.maintenanceBalance || 0,
          booksBalance: data.booksBalance || 0,
          uniformBalance: data.uniformBalance || 0,
          otherBalance: data.otherBalance || 0,
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
  }, [selectedClassId, searchQuery, showToast]);

  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      if (selectedTerm) setSelectedTerm(null);
      fetchStudents(true);
    } else if (selectedTerm) {
      fetchAdmittedStudents(selectedTerm);
    } else if (selectedClassId !== "all") {
      fetchAdmittedStudents();
    } else {
      setStudents([]);
    }
  }, [selectedClassId, selectedTerm, searchQuery, fetchStudents, fetchAdmittedStudents]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "classes"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, name: d.data().name, ...d.data() }));
      setClasses(list.sort((a, b) => a.name.localeCompare(b.name)));
    });
    return () => unsub();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    if (selectedTerm) {
      fetchAdmittedStudents(selectedTerm);
    } else {
      fetchStudents(true);
    }
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
        where("type", "in", ["admission", "admission_payment"])
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

      batch.set(doc(db, "feePayments", serial), paymentEntry);

      batch.update(doc(db, "users", selectedStudent.uid), {
        admissionPaid: increment(amount),
        admissionBalance: increment(-amount),
        walletBalance: increment(-amount),
      });

      const year = acadConfig.academicYear?.replace(/\//g, "-");
      const term = acadConfig.currentTerm?.replace(/\s/g, "");
      const recordId = `${selectedStudent.uid}_${year}_${term}`;

      batch.set(doc(db, "studentFeeRecords", recordId), {
        admissionPaid: increment(amount),
        admissionBalance: increment(-amount),
        balance: increment(-amount),
        payments: arrayUnion(paymentEntry),
        lastUpdated: serverTimestamp(),
      }, { merge: true });

      await batch.commit();

      try {
        await sendNotification({
          recipientId: selectedStudent.uid,
          senderId: appUser?.uid || "admin",
          senderName: appUser?.displayName || "Administrator",
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

      batch.set(doc(db, "feePayments", serial), billEntry);

      batch.update(doc(db, "users", selectedStudent.uid), {
        admissionBill: increment(amount),
        admissionBalance: increment(amount),
        walletBalance: increment(amount),
      });

      const year = acadConfig.academicYear?.replace(/\//g, "-");
      const term = acadConfig.currentTerm?.replace(/\s/g, "");
      const recordId = `${selectedStudent.uid}_${year}_${term}`;

      batch.set(doc(db, "studentFeeRecords", recordId), {
        admissionBill: increment(amount),
        admissionBalance: increment(amount),
        balance: increment(amount),
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
        const isPayment = (payment.type || "").toLowerCase() === "admission_payment";

        if (isPayment) {
          batch.update(doc(db, "studentFeeRecords", recordId), {
            admissionPaid: increment(-amount),
            admissionBalance: increment(amount),
            balance: increment(amount),
          });
          batch.update(doc(db, "users", selectedStudent.uid), {
            admissionPaid: increment(-amount),
            admissionBalance: increment(amount),
            walletBalance: increment(amount),
          });
        } else {
          batch.update(doc(db, "studentFeeRecords", recordId), {
            admissionBill: increment(-amount),
            admissionBalance: increment(-amount),
            balance: increment(-amount),
          });
          batch.update(doc(db, "users", selectedStudent.uid), {
            admissionBill: increment(-amount),
            admissionBalance: increment(-amount),
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
        if (selectedTerm) fetchAdmittedStudents(selectedTerm);
        else fetchStudents(true);
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

  const renderStudentItem = ({ item }: { item: Student }) => {
    const isolatedTotal = (item.admissionBalance || 0) + (item.ptaBalance || 0) +
                          (item.maintenanceBalance || 0) + (item.booksBalance || 0) +
                          (item.uniformBalance || 0) + (item.otherBalance || 0);
    const tuitionBalance = Math.max(0, (item.walletBalance || 0) - isolatedTotal);

    return (
      <Animatable.View animation="fadeInUp" duration={400} style={styles.cardWrapper}>
        <TouchableOpacity
          style={styles.financeCard}
          onPress={() => {
            setSelectedStudent(item);
            setPaymentAmount("");
            setReceivedFrom("");
            setPaymentModalVisible(true);
            fetchPaymentHistory(item.uid);
          }}
        >
          <View style={styles.cardContent}>
            <View style={styles.leftSection}>
              <View style={[styles.avatar, { backgroundColor: THEME.primary + "15" }]}>
                <Text style={[styles.avatarText, { color: THEME.primary }]}>{item.fullName.charAt(0)}</Text>
              </View>
              <View style={styles.mainInfo}>
                <Text style={styles.studentName} numberOfLines={1}>{item.fullName}</Text>

                <View style={styles.tuitionBreakdown}>
                  <View style={styles.breakdownItem}>
                    <Text style={styles.breakdownLabel}>TUITION</Text>
                    <Text style={styles.breakdownValue}>₵{tuitionBalance.toFixed(0)}</Text>
                  </View>
                  <View style={styles.breakdownItem}>
                    <Text style={styles.breakdownLabel}>ADMISSION BILL</Text>
                    <Text style={styles.breakdownValue}>₵{item.admissionBill.toFixed(0)}</Text>
                  </View>
                </View>

                <View style={styles.debtBox}>
                  <Text style={[styles.debtLabel, { color: item.admissionBalance > 0 ? VIBE.danger : VIBE.success }]}>
                    {item.admissionBalance > 0 ? "Admission Owed: " : "Paid: "}
                  </Text>
                  <Text style={[styles.debtValue, { color: item.admissionBalance > 0 ? VIBE.danger : VIBE.success }]}>
                    ₵{Math.max(0, item.admissionBalance || 0).toFixed(0)}
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
            <TouchableOpacity onPress={() => setClassModalVisible(true)} style={styles.headerIconBtn}>
              <SVGIcon name="funnel-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.selectorGrid}>
            <TouchableOpacity style={styles.glassPill} onPress={() => setClassModalVisible(true)}>
              <Text style={styles.glassLabel}>FILTER BY CLASS</Text>
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
        onEndReached={() => !selectedTerm && fetchStudents()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[THEME.primary]} />
        }
        ListHeaderComponent={
          <>
            <View style={[styles.statsDashboard, { paddingHorizontal: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10, paddingBottom: 15 }]}>
              <LinearGradient colors={[THEME.primary, THEME.secondary]} style={[styles.statBox, { width: (width - 52)/2 }]}>
                <Text style={styles.statLabel}>TERM BILLED</Text>
                <Text style={styles.statValue}>₵{(stats.totalBilled || 0).toLocaleString()}</Text>
                <SVGIcon name="receipt" size={24} color="rgba(255,255,255,0.3)" style={styles.statIcon} />
              </LinearGradient>
              <LinearGradient colors={[VIBE.success, "#059669"]} style={[styles.statBox, { width: (width - 52)/2 }]}>
                <Text style={styles.statLabel}>TERM COLLECTED</Text>
                <Text style={styles.statValue}>₵{(stats.totalCollected || 0).toLocaleString()}</Text>
                <SVGIcon name="cash" size={24} color="rgba(255,255,255,0.3)" style={styles.statIcon} />
              </LinearGradient>
            </View>

            <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
              <Text style={styles.listTitle}>TERM-SPECIFIC ADMISSIONS</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                {[1, 2, 3].map(t => {
                  const termName = `Term ${t}`;
                  const isActive = selectedTerm === termName;
                  return (
                    <TouchableOpacity
                      key={t}
                      style={{
                        flex: 1,
                        backgroundColor: isActive ? THEME.primary : '#fff',
                        padding: 12,
                        borderRadius: 15,
                        borderWidth: 1,
                        borderColor: isActive ? THEME.primary : VIBE.border,
                        alignItems: 'center',
                        ...SHADOWS.small
                      }}
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
                      <Text style={{ fontSize: 10, fontWeight: '800', color: isActive ? '#fff' : VIBE.muted }}>TERM {t}</Text>
                      <Text style={{ fontSize: 16, fontWeight: '900', color: isActive ? '#fff' : VIBE.text, marginTop: 2 }}>
                        {stats[`term${t}Count`]}
                      </Text>
                      <Text style={{ fontSize: 9, fontWeight: '700', color: isActive ? 'rgba(255,255,255,0.8)' : VIBE.success, marginTop: 1 }}>
                        ₵{stats[`term${t}Revenue`].toLocaleString()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {selectedTerm && (
              <View style={[styles.filterInfoBar, { marginBottom: 20 }]}>
                <Text style={styles.filterInfoText}>Showing: {selectedTerm.toUpperCase()} ADMISSIONS</Text>
                <TouchableOpacity onPress={() => { setSelectedTerm(null); setStudents([]); }}>
                  <SVGIcon name="close-circle" size={20} color={VIBE.danger} />
                </TouchableOpacity>
              </View>
            )}

            <Text style={[styles.listTitle, { marginHorizontal: 20, marginBottom: 15 }]}>STUDENT DIRECTORY</Text>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={THEME.primary} style={{ marginTop: 50 }} />
          ) : (
            <View style={styles.emptyWrap}>
              <SVGIcon name={selectedTerm || selectedClassId !== "all" ? "person" : "search"} size={64} color="#CBD5E1" />
              <Text style={styles.emptyText}>
                {selectedTerm
                  ? "No students found for this term"
                  : selectedClassId !== "all"
                    ? "No admitted students found for this class"
                    : searchQuery.length < 2
                      ? "Search for a student to bill"
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

      {/* Payment/Billing Modal */}
      <Modal visible={paymentModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.overlay}>
          <View style={styles.sheetBody}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>{selectedStudent?.fullName}</Text>
                <Text style={{ fontSize: 10, fontWeight: '800', color: VIBE.muted }}>ADMISSION FEE MGMT</Text>
              </View>
              <TouchableOpacity onPress={() => setPaymentModalVisible(false)} style={styles.closeRound}>
                <SVGIcon name="close" size={24} color={VIBE.muted} />
              </TouchableOpacity>
            </View>

            <View style={styles.modeTabs}>
              <TouchableOpacity
                style={[styles.modeTab, activeTab === "payment" && styles.activeModeTab]}
                onPress={() => setActiveTab("payment")}
              >
                <SVGIcon name="cash-outline" size={18} color={activeTab === "payment" ? "#fff" : VIBE.muted} />
                <Text style={[styles.modeTabText, activeTab === "payment" && { color: "#fff" }]}>PAYMENT</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeTab, activeTab === "billing" && styles.activeModeTab]}
                onPress={() => setActiveTab("billing")}
              >
                <SVGIcon name="receipt-outline" size={18} color={activeTab === "billing" ? "#fff" : VIBE.muted} />
                <Text style={[styles.modeTabText, activeTab === "billing" && { color: "#fff" }]}>BILLING</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              {activeTab === "payment" ? (
                <>
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
                </>
              ) : (
                <>
                  <View style={{ gap: 15, marginBottom: 25 }}>
                    <Text style={styles.breakdownLabel}>ADMISSION FEE AMOUNT (₵)</Text>
                    <TextInput
                      style={styles.pillInput}
                      placeholder="0.00"
                      keyboardType="numeric"
                      value={billAmount}
                      onChangeText={setBillAmount}
                    />
                  </View>
                  <TouchableOpacity onPress={handleLogBill} disabled={saving}>
                    <LinearGradient colors={[VIBE.purple, "#7C3AED"]} style={styles.saveBtn}>
                      {saving ? <ActivityIndicator color="#fff" /> : (
                        <>
                          <Text style={styles.saveBtnText}>INITIATE BILLING</Text>
                          <SVGIcon name="receipt" size={20} color="#fff" />
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}

              <View style={styles.historyBlock}>
                <Text style={styles.blockTitle}>Transaction History</Text>
                {loadingHistory ? (
                  <ActivityIndicator color={THEME.primary} style={{ marginTop: 20 }} />
                ) : history.length > 0 ? (
                  history.map((h, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.transactionTile}
                      onPress={() => {
                        setPaymentModalVisible(false);
                        router.push({
                          pathname: "/shared/receipt-view",
                          params: {
                            type: h.type === 'admission' ? 'bill' : 'payment',
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
                        <Text style={[styles.tileAmt, { color: h.type === 'admission' ? VIBE.purple : VIBE.success }]}>
                          ₵{h.amount.toLocaleString()}
                        </Text>
                        <View style={{ backgroundColor: h.type === 'admission' ? VIBE.purple + '15' : VIBE.success + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                          <Text style={{ fontSize: 9, fontWeight: '900', color: h.type === 'admission' ? VIBE.purple : VIBE.success }}>
                            {h.type === 'admission' ? 'BILL' : 'PAYMENT'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.tileDetail}>{h.method}</Text>
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
                  ))
                ) : (
                  <Text style={styles.noHistory}>No previous admission transactions</Text>
                )}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
