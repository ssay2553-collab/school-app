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
  arrayUnion,
  arrayRemove,
  onSnapshot,
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
  booksBill: number;
  booksPaid: number;
  booksBalance: number;
  walletBalance: number;
  admissionBalance?: number;
  ptaBalance?: number;
  maintenanceBalance?: number;
  uniformBalance?: number;
  otherBalance?: number;
};

const THEME = {
  primary: "#3B82F6", // Books Blue
  secondary: "#2563EB",
};

export default function BooksCharges() {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const acadConfig = useAcademicConfig();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<{ id: string, name: string }[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [classModalVisible, setClassModalVisible] = useState(false);

  const [activeTab, setActiveTab] = useState<"payment" | "billing">("payment");
  const [bookTitle, setBookTitle] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [receivedFrom, setReceivedFrom] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Momo" | "Cheque" | "E-cash">("Cash");

  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [stats, setStats] = useState({ totalBilled: 0, totalCollected: 0 });

  const lastVisibleRef = useRef<any>(null);
  const hasMoreRef = useRef(true);
  const isFetchingRef = useRef(false);

  const fetchStats = async () => {
    try {
      if (!acadConfig.academicYear || !acadConfig.currentTerm) return;
      let q = query(
        collection(db, "feePayments"),
        where("type", "in", ["books", "books_payment"]),
        where("academicYear", "==", acadConfig.academicYear),
        where("term", "==", acadConfig.currentTerm)
      );

      if (selectedClassId !== "all") {
        q = query(q, where("classId", "==", selectedClassId));
      }

      const snap = await getDocsFromServer(q);
      let billed = 0;
      let collected = 0;
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.type === "books") billed += (data.amount || 0);
        if (data.type === "books_payment") collected += (data.amount || 0);
      });
      setStats({ totalBilled: billed, totalCollected: collected });
    } catch (e) {
      console.error("Error fetching books stats:", e);
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
      const batch: Student[] = snap.docs.map(d => {
        const data = d.data();
        return {
          uid: d.id,
          fullName: `${data.profile?.firstName || ""} ${data.profile?.lastName || ""}`.trim() || "Student",
          classId: data.classId || "unknown",
          className: data.className || "Class",
          booksBill: data.booksBill || 0,
          booksPaid: data.booksPaid || 0,
          booksBalance: data.booksBalance || 0,
          walletBalance: data.walletBalance || 0,
          admissionBalance: data.admissionBalance || 0,
          ptaBalance: data.ptaBalance || 0,
          maintenanceBalance: data.maintenanceBalance || 0,
          uniformBalance: data.uniformBalance || 0,
          otherBalance: data.otherBalance || 0,
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
  }, [selectedClassId, searchQuery]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "classes"), (snap) => {
      const list = snap.docs.map(d => ({
        id: d.id,
        name: d.data().name || d.id
      })).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      setClasses(list);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    fetchStats();
  }, [acadConfig.academicYear, acadConfig.currentTerm, selectedClassId]);

  useEffect(() => {
    const delay = setTimeout(() => {
      fetchStudents(true);
    }, 400);
    return () => clearTimeout(delay);
  }, [selectedClassId, searchQuery]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStudents(true);
    fetchStats();
  };

  const filteredStudents = useMemo(() => {
    const lower = searchQuery.toLowerCase();
    return students.filter(s =>
      s.fullName.toLowerCase().includes(lower) ||
      s.className.toLowerCase().includes(lower)
    );
  }, [students, searchQuery]);

  const fetchPaymentHistory = async (studentUid: string) => {
    setLoadingHistory(true);
    try {
      const q = query(
        collection(db, "feePayments"),
        where("studentUid", "==", studentUid),
        where("type", "in", ["books", "books_payment"])
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

  const handleBillBook = async () => {
    const val = parseFloat(billAmount);
    if (!bookTitle.trim() || isNaN(val) || val <= 0 || !selectedStudent) {
      return showToast({ message: "Incomplete details", type: "error" });
    }

    setSaving(true);
    try {
      const batch = writeBatch(db);
      const serial = `BKS-BILL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const year = acadConfig.academicYear?.replace(/\//g, "-");
      const term = acadConfig.currentTerm?.replace(/\s/g, "");
      const recordId = `${selectedStudent.uid}_${year}_${term}`;

      const billEntry = {
        amount: val,
        method: "Book Charge",
        receivedFrom: bookTitle.trim(),
        updatedBy: appUser?.adminRole || "Admin",
        adminUid: appUser?.uid || "unknown",
        createdAt: new Date().toISOString(),
        receiptNo: serial,
        date: moment().format("YYYY-MM-DD"),
        studentUid: selectedStudent.uid,
        studentName: selectedStudent.fullName,
        classId: selectedStudent.classId,
        className: selectedStudent.className,
        type: "books",
        academicYear: acadConfig.academicYear,
        term: acadConfig.currentTerm,
      };

      batch.set(doc(db, "feePayments", serial), billEntry);

      batch.set(doc(db, "studentFeeRecords", recordId), {
        booksBalance: increment(val),
        booksBill: increment(val),
        balance: increment(val),
        payments: arrayUnion(billEntry),
        lastUpdated: serverTimestamp(),
      }, { merge: true });

      batch.update(doc(db, "users", selectedStudent.uid), {
        booksBalance: increment(val),
        booksBill: increment(val),
        walletBalance: increment(val),
      });

      await batch.commit();

      try {
        await sendNotification({
          recipientId: selectedStudent.uid,
          senderId: appUser?.uid || "admin",
          senderName: appUser?.displayName || "Administrator",
          title: "New Book Charge",
          body: `A charge of ${SCHOOL_CONFIG.currencySymbol}${val.toLocaleString()} has been added for "${bookTitle}" for ${selectedStudent.fullName}.`,
          type: "payment",
          data: {
            studentUid: selectedStudent.uid,
            amount: val,
            type: "book_charge",
            item: bookTitle
          }
        });
      } catch (notifErr) {
        console.error("Failed to send books notification:", notifErr);
      }

      showToast({ message: `Billed for ${bookTitle}`, type: "success" });
      setModalVisible(false);
      setBookTitle("");
      setBillAmount("");
      fetchStudents(true);
      fetchStats();
    } catch (e) {
      console.error(e);
      showToast({ message: "Billing failed", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleLogPayment = async () => {
    const val = parseFloat(paymentAmount);
    if (isNaN(val) || val <= 0 || !selectedStudent || !receivedFrom.trim()) {
      return showToast({ message: "Incomplete details", type: "error" });
    }

    setSaving(true);
    try {
      const batch = writeBatch(db);
      const serial = `BKS-PAY-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const year = acadConfig.academicYear?.replace(/\//g, "-");
      const term = acadConfig.currentTerm?.replace(/\s/g, "");
      const recordId = `${selectedStudent.uid}_${year}_${term}`;

      const paymentEntry = {
        amount: val,
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
        type: "books_payment",
        academicYear: acadConfig.academicYear,
        term: acadConfig.currentTerm,
      };

      batch.set(doc(db, "feePayments", serial), paymentEntry);

      batch.set(doc(db, "studentFeeRecords", recordId), {
        booksPaid: increment(val),
        booksBalance: increment(-val),
        balance: increment(-val),
        payments: arrayUnion(paymentEntry),
        lastUpdated: serverTimestamp(),
      }, { merge: true });

      batch.update(doc(db, "users", selectedStudent.uid), {
        booksPaid: increment(val),
        booksBalance: increment(-val),
        walletBalance: increment(-val),
      });

      await batch.commit();

      try {
        await sendNotification({
          recipientId: selectedStudent.uid,
          senderId: appUser?.uid || "admin",
          senderName: appUser?.displayName || "Administrator",
          title: "Book Payment Received",
          body: `A book payment of ${SCHOOL_CONFIG.currencySymbol}${val.toLocaleString()} has been recorded for ${selectedStudent.fullName}.`,
          type: "payment",
          data: {
            studentUid: selectedStudent.uid,
            amount: val,
            type: "book_payment"
          }
        });
      } catch (notifErr) {
        console.error("Failed to send books payment notification:", notifErr);
      }

      showToast({ message: "Payment recorded", type: "success" });
      setModalVisible(false);
      setPaymentAmount("");
      setReceivedFrom("");
      fetchStudents(true);
      fetchStats();
    } catch (e) {
      console.error(e);
      showToast({ message: "Payment failed", type: "error" });
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
        const isPayment = (payment.type || "").toLowerCase() === "books_payment";

        if (isPayment) {
          batch.update(doc(db, "studentFeeRecords", recordId), {
            booksPaid: increment(-amount),
            booksBalance: increment(amount),
            balance: increment(amount),
          });
          batch.update(doc(db, "users", selectedStudent.uid), {
            booksPaid: increment(-amount),
            booksBalance: increment(amount),
            walletBalance: increment(amount),
          });
        } else {
          batch.update(doc(db, "studentFeeRecords", recordId), {
            booksBill: increment(-amount),
            booksBalance: increment(-amount),
            balance: increment(-amount),
          });
          batch.update(doc(db, "users", selectedStudent.uid), {
            booksBill: increment(-amount),
            booksBalance: increment(-amount),
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
        setModalVisible(false);
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
            setModalVisible(true);
            fetchPaymentHistory(item.uid);
          }}
        >
          <View style={styles.cardContent}>
            <View style={styles.leftSection}>
              <View style={[styles.avatar, { backgroundColor: THEME.primary + "15" }]}>
                <SVGIcon name="book" size={24} color={THEME.primary} />
              </View>
              <View style={styles.mainInfo}>
                <Text style={styles.studentName} numberOfLines={1}>{item.fullName}</Text>

                <View style={styles.tuitionBreakdown}>
                  <View style={styles.breakdownItem}>
                    <Text style={styles.breakdownLabel}>TUITION</Text>
                    <Text style={styles.breakdownValue}>₵{tuitionBalance.toFixed(0)}</Text>
                  </View>
                  <View style={styles.breakdownItem}>
                    <Text style={styles.breakdownLabel}>BOOKS BILL</Text>
                    <Text style={styles.breakdownValue}>₵{(item.booksBill || 0).toFixed(0)}</Text>
                  </View>
                </View>

                <View style={styles.debtBox}>
                  <Text style={[styles.debtLabel, { color: item.booksBalance > 0 ? VIBE.danger : VIBE.success }]}>
                    {item.booksBalance > 0 ? "Books Owed: " : "Paid: "}
                  </Text>
                  <Text style={[styles.debtValue, { color: item.booksBalance > 0 ? VIBE.danger : VIBE.success }]}>
                    ₵{Math.max(0, item.booksBalance || 0).toFixed(0)}
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
              <Text style={styles.headerTitle}>Books Fee</Text>
              <Text style={styles.headerSub}>TEXTBOOKS & TOOLS</Text>
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
        onEndReached={() => fetchStudents()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[THEME.primary]} />
        }
        ListHeaderComponent={
          <>
            <View style={[styles.statsDashboard, { paddingHorizontal: 20, flexDirection: 'row', gap: 12, marginTop: 10, paddingBottom: 15 }]}>
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
            <Text style={[styles.listTitle, { marginHorizontal: 20, marginBottom: 15 }]}>STUDENT DIRECTORY</Text>
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
                  ? "Search for a student to manage book fees"
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

      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.overlay}>
          <View style={styles.sheetBody}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>{selectedStudent?.fullName}</Text>
                <Text style={{ fontSize: 10, fontWeight: '800', color: VIBE.muted }}>BOOKS & RESOURCES MGMT</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeRound}>
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
                    {["Cash", "Momo", "Cheque", "E-cash"].map(m => (
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
                    <Text style={styles.breakdownLabel}>BOOK TITLE / DESCRIPTION</Text>
                    <TextInput
                      style={[styles.pillInput, { fontSize: 16 }]}
                      placeholder="e.g. Maths Mastery Vol 1"
                      value={bookTitle}
                      onChangeText={setBookTitle}
                    />
                    <Text style={styles.breakdownLabel}>PRICE (₵)</Text>
                    <TextInput
                      style={styles.pillInput}
                      placeholder="0.00"
                      keyboardType="numeric"
                      value={billAmount}
                      onChangeText={setBillAmount}
                    />
                  </View>
                  <TouchableOpacity onPress={handleBillBook} disabled={saving}>
                    <LinearGradient colors={[VIBE.purple, "#7C3AED"]} style={styles.saveBtn}>
                      {saving ? <ActivityIndicator color="#fff" /> : (
                        <>
                          <Text style={styles.saveBtnText}>APPLY CHARGE</Text>
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
                        setModalVisible(false);
                        router.push({
                          pathname: "/shared/receipt-view",
                          params: {
                            type: h.type === 'books' ? 'bill' : 'payment',
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
                        <Text style={[styles.tileAmt, { color: h.type === 'books' ? VIBE.purple : VIBE.success }]}>
                          ₵{h.amount.toLocaleString()}
                        </Text>
                        <View style={{ backgroundColor: h.type === 'books' ? VIBE.purple + '15' : VIBE.success + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                          <Text style={{ fontSize: 9, fontWeight: '900', color: h.type === 'books' ? VIBE.purple : VIBE.success }}>
                            {h.type === 'books' ? 'BILL' : 'PAYMENT'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.tileDetail}>{h.receivedFrom || h.method}</Text>
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
                  <Text style={styles.noHistory}>No previous book transactions</Text>
                )}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
