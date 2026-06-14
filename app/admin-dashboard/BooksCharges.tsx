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
  onSnapshot,
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
  primary: "#3B82F6", // Books Color
  secondary: "#2563EB",
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  text: "#1E293B",
  muted: "#64748B",
  border: "#E2E8F0",
  success: "#10B981",
  danger: "#EF4444",
  info: "#3B82F6",
};

const PAGE_SIZE = 50;

type Student = {
  uid: string;
  fullName: string;
  classId: string;
  className: string;
  booksBill: number;
  booksPaid: number;
  booksBalance: number;
};

export default function BooksCharges() {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const acadConfig = useAcademicConfig();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<{ id: string, name: string }[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

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
      const q = query(
        collection(db, "feePayments"),
        where("type", "in", ["books", "books_payment"]),
        where("academicYear", "==", acadConfig.academicYear),
        where("term", "==", acadConfig.currentTerm)
      );
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

    // Require a search query to load students (prevent auto-listing)
    if (searchQuery.length < 2) {
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

  const fetchClasses = async () => {
    try {
      const snap = await getDocsFromServer(collection(db, "classes"));
      const list = snap.docs.map(d => ({
        id: d.id,
        name: d.data().name || d.id
      })).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      setClasses(list);
    } catch (e) {
      console.error(e);
    }
  };

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

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    fetchStats();
  }, [acadConfig.academicYear, acadConfig.currentTerm]);

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
      s.className.toLowerCase().includes(lower) ||
      s.uid.toLowerCase().includes(lower)
    );
  }, [students, searchQuery]);

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
        method: "Bill",
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
        payments: arrayUnion(billEntry),
        lastUpdated: serverTimestamp(),
      }, { merge: true });

      batch.update(doc(db, "users", selectedStudent.uid), {
        booksBalance: increment(val),
        booksBill: increment(val),
      });

      await batch.commit();

      try {
        await sendNotification({
          recipientId: selectedStudent.uid,
          senderId: appUser?.uid || "admin",
          senderName: "School Finance",
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
        payments: arrayUnion(paymentEntry),
        lastUpdated: serverTimestamp(),
      }, { merge: true });

      batch.update(doc(db, "users", selectedStudent.uid), {
        booksPaid: increment(val),
        booksBalance: increment(-val),
      });

      await batch.commit();

      try {
        await sendNotification({
          recipientId: selectedStudent.uid,
          senderId: appUser?.uid || "admin",
          senderName: "School Finance",
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
              <Text style={styles.headerTitle}>Books Fee</Text>
              <Text style={styles.headerSub}>TEXTBOOKS & TOOLS</Text>
            </View>
            <View style={{ width: 44 }} />
          </View>
        </LinearGradient>

        <View style={styles.searchStrip}>
          <View style={styles.searchBar}>
            <SVGIcon name="search" size={18} color={VIBE.muted} />
            <TextInput
              placeholder="Search by name or ID..."
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={VIBE.muted}
            />
            {searchQuery !== "" && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <SVGIcon name="close" size={20} color={VIBE.muted} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshRound}>
            <SVGIcon name="refresh" size={18} color={VIBE.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.classTabs}
          contentContainerStyle={styles.classTabsContent}
        >
          <TouchableOpacity
            style={[styles.classTab, selectedClassId === "all" && styles.activeClassTab]}
            onPress={() => setSelectedClassId("all")}
          >
            <Text style={[styles.classTabText, selectedClassId === "all" && styles.activeClassTabText]}>All Students</Text>
          </TouchableOpacity>
          {classes.map(c => (
            <TouchableOpacity
              key={c.id}
              style={[styles.classTab, selectedClassId === c.id && styles.activeClassTab]}
              onPress={() => setSelectedClassId(c.id)}
            >
              <Text style={[styles.classTabText, selectedClassId === c.id && styles.activeClassTabText]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: VIBE.primary, flex: 1.5 }]}>
          <Text style={styles.statLabel}>Term Billed</Text>
          <Text style={styles.statValue}>₵{stats.totalBilled.toLocaleString()}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: VIBE.success, flex: 1 }]}>
          <Text style={styles.statLabel}>Collected</Text>
          <Text style={styles.statValue}>₵{stats.totalCollected.toLocaleString()}</Text>
        </View>
      </View>

      <FlatList
        data={filteredStudents}
        keyExtractor={item => item.uid}
        contentContainerStyle={styles.listContent}
        onEndReached={() => fetchStudents()}
        ListHeaderComponent={
          filteredStudents.length > 0 ? (
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderText}>
                {searchQuery.length >= 2 ? `Results for "${searchQuery}"` :
                 selectedClassId === "all" ? "All Students" : `Class: ${classes.find(c => c.id === selectedClassId)?.name || ""}`}
              </Text>
              <Text style={styles.listHeaderCount}>{filteredStudents.length} Students</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.studentCard}
            onPress={() => {
              setSelectedStudent(item);
              setModalVisible(true);
              fetchPaymentHistory(item.uid);
            }}
          >
            <View style={styles.avatar}>
              <SVGIcon name="book" size={24} color={VIBE.primary} />
            </View>
            <View style={styles.studentInfo}>
              <Text style={styles.studentName}>{item.fullName}</Text>
              <Text style={styles.studentClass}>{item.className}</Text>
              <View style={styles.badgeRow}>
                <View style={[styles.badge, { backgroundColor: VIBE.info + "15", marginRight: 8 }]}>
                  <Text style={[styles.badgeText, { color: VIBE.info }]}>Bill: ₵{(item.booksBill || 0).toFixed(2)}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: VIBE.success + "15", marginRight: 8 }]}>
                  <Text style={[styles.badgeText, { color: VIBE.success }]}>Paid: ₵{(item.booksPaid || 0).toFixed(2)}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: (item.booksBalance > 0) ? VIBE.danger + "15" : VIBE.primary + "15" }]}>
                  <Text style={[styles.badgeText, { color: (item.booksBalance > 0) ? VIBE.danger : VIBE.primary }]}>Owed: ₵{Math.max(0, item.booksBalance || 0).toFixed(2)}</Text>
                </View>
              </View>
            </View>
            <SVGIcon name="chevron-forward" size={20} color={VIBE.muted} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={VIBE.primary} style={{ marginTop: 50 }} />
          ) : (searchQuery.length < 2) ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <SVGIcon name="search" size={40} color={VIBE.muted} />
              </View>
              <Text style={styles.emptyText}>Search for a student</Text>
              <Text style={styles.emptySub}>Enter a name or ID to manage book fees</Text>
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <View style={[styles.emptyIcon, { backgroundColor: VIBE.danger + "10" }]}>
                <SVGIcon name="alert-circle" size={40} color={VIBE.danger} />
              </View>
              <Text style={styles.emptyText}>No students found</Text>
              <Text style={styles.emptySub}>Try adjusting your search or filters</Text>
            </View>
          )
        }
      />

      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.overlay}>
          <View style={styles.modalBody}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{selectedStudent?.fullName}</Text>
                <Text style={styles.modalSubtitle}>BOOKS & RESOURCES</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
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
                    <Text style={styles.label}>Amount to Pay (₵)</Text>
                    <TextInput
                      style={styles.mainInput}
                      placeholder="0.00"
                      keyboardType="numeric"
                      value={paymentAmount}
                      onChangeText={setPaymentAmount}
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Received From</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="Payer Name"
                      value={receivedFrom}
                      onChangeText={setReceivedFrom}
                    />
                  </View>
                  <Text style={styles.label}>Payment Method</Text>
                  <View style={styles.methodGrid}>
                    {["Cash", "Momo", "Cheque", "E-cash"].map(m => (
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
                    <Text style={styles.label}>Book Title / Description</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="e.g. Maths Mastery Vol 1"
                      value={bookTitle}
                      onChangeText={setBookTitle}
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Price (₵)</Text>
                    <TextInput
                      style={styles.mainInput}
                      placeholder="0.00"
                      keyboardType="numeric"
                      value={billAmount}
                      onChangeText={setBillAmount}
                    />
                  </View>
                  <TouchableOpacity style={[styles.submitBtn, { backgroundColor: VIBE.secondary }]} onPress={handleBillBook} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>APPLY CHARGE</Text>}
                  </TouchableOpacity>
                </>
              )}

              <View style={styles.historySection}>
                <Text style={styles.sectionTitle}>Transaction History</Text>
                {loadingHistory ? (
                  <ActivityIndicator color={VIBE.primary} />
                ) : history.length > 0 ? (
                  history.map((h, i) => (
                    <View key={i} style={styles.historyItem}>
                      <View>
                        <Text style={styles.historyAmt}>₵{h.amount.toFixed(2)}</Text>
                        <Text style={styles.historyDate}>{moment(h.createdAt).format("MMM DD, YYYY")}</Text>
                        <Text style={styles.historyType}>{h.type === 'books' ? 'Billing' : 'Payment'}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={styles.historyMethod}>{h.method}</Text>
                        <Text style={styles.historyReceipt}>{h.receiptNo}</Text>
                      </View>
                    </View>
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
  classTabs: { marginTop: 15 },
  classTabsContent: { paddingHorizontal: 20, gap: 10, paddingBottom: 5 },
  classTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: VIBE.bg, borderWidth: 1, borderColor: VIBE.border },
  activeClassTab: { backgroundColor: VIBE.primary, borderColor: VIBE.primary },
  classTabText: { fontSize: 12, fontWeight: "700", color: VIBE.muted },
  activeClassTabText: { color: "#fff" },
  statsRow: { flexDirection: "row", paddingHorizontal: 20, marginTop: 20, gap: 12 },
  statCard: { padding: 15, borderRadius: 20, justifyContent: "center", ...SHADOWS.small },
  statLabel: { color: "rgba(255,255,255,0.8)", fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  statValue: { color: "#fff", fontSize: 20, fontWeight: "900", marginTop: 4 },
  listContent: { padding: 20, paddingTop: 30 },
  studentCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", padding: 15, borderRadius: 20, marginBottom: 12, ...SHADOWS.small, borderWidth: 1, borderColor: VIBE.border },
  avatar: { width: 45, height: 45, borderRadius: 15, backgroundColor: VIBE.primary + "15", justifyContent: "center", alignItems: "center" },
  studentInfo: { flex: 1, marginLeft: 15 },
  studentName: { fontSize: 15, fontWeight: "800", color: VIBE.text },
  studentClass: { fontSize: 11, color: VIBE.muted, fontWeight: "600", marginTop: 2 },
  badgeRow: { flexDirection: "row", marginTop: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 9, fontWeight: "800" },
  listHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 15, paddingHorizontal: 5 },
  listHeaderText: { fontSize: 11, fontWeight: "800", color: VIBE.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  listHeaderCount: { fontSize: 10, fontWeight: "700", color: VIBE.primary, backgroundColor: VIBE.primary + "10", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5 },
  emptyWrap: { alignItems: "center", marginTop: 60, paddingHorizontal: 40 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: VIBE.bg, justifyContent: "center", alignItems: "center", marginBottom: 15 },
  emptyText: { fontSize: 16, fontWeight: "900", color: VIBE.text, textAlign: "center" },
  emptySub: { fontSize: 13, color: VIBE.muted, fontWeight: "600", marginTop: 5, textAlign: "center" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBody: { backgroundColor: "#fff", borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 25, maxHeight: "90%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 25 },
  modalTitle: { fontSize: 20, fontWeight: "900", color: VIBE.text },
  modalSubtitle: { fontSize: 10, fontWeight: "800", color: VIBE.muted, letterSpacing: 1 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: VIBE.bg, justifyContent: "center", alignItems: "center" },
  tabContainer: { flexDirection: "row", backgroundColor: VIBE.bg, borderRadius: 15, padding: 5, marginBottom: 20 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 12 },
  activeTab: { backgroundColor: "#fff", ...SHADOWS.small },
  tabText: { fontSize: 12, fontWeight: "800", color: VIBE.muted },
  activeTabText: { color: VIBE.primary },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 12, fontWeight: "800", color: VIBE.muted, marginBottom: 8, marginLeft: 5 },
  mainInput: { backgroundColor: VIBE.bg, borderRadius: 20, padding: 20, fontSize: 28, fontWeight: "900", color: VIBE.primary, borderWidth: 1, borderColor: VIBE.border, textAlign: "center" },
  modalInput: { backgroundColor: VIBE.bg, borderRadius: 15, padding: 15, fontSize: 16, fontWeight: "700", color: VIBE.text, borderWidth: 1, borderColor: VIBE.border },
  methodGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 25 },
  methodBtn: { flex: 1, minWidth: "45%", height: 50, borderRadius: 15, backgroundColor: VIBE.bg, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: VIBE.border },
  activeMethod: { backgroundColor: VIBE.primary, borderColor: VIBE.primary },
  methodText: { fontSize: 14, fontWeight: "800", color: VIBE.muted },
  activeMethodText: { color: "#fff" },
  submitBtn: { backgroundColor: VIBE.primary, height: 65, borderRadius: 25, justifyContent: "center", alignItems: "center", ...SHADOWS.medium },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 1 },
  historySection: { marginTop: 30, borderTopWidth: 1, borderTopColor: VIBE.border, paddingTop: 25 },
  sectionTitle: { fontSize: 16, fontWeight: "900", color: VIBE.text, marginBottom: 15 },
  historyItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: VIBE.bg, padding: 15, borderRadius: 15, marginBottom: 10 },
  historyAmt: { fontSize: 16, fontWeight: "900", color: VIBE.text },
  historyDate: { fontSize: 11, color: VIBE.muted, fontWeight: "600" },
  historyType: { fontSize: 9, color: VIBE.muted, fontWeight: "900", textTransform: "uppercase", marginTop: 2 },
  historyMethod: { fontSize: 12, fontWeight: "800", color: VIBE.primary },
  historyReceipt: { fontSize: 10, color: VIBE.muted, fontWeight: "700" },
  noHistory: { textAlign: "center", color: VIBE.muted, fontStyle: "italic", marginTop: 10 },
});
