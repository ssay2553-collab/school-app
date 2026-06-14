import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  arrayUnion,
  collection,
  doc,
  getDocsFromServer,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import moment from "moment";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  SectionList,
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

const VIBE = {
  primary: "#F59E0B", // PTA Color
  secondary: "#D97706",
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  text: "#1E293B",
  muted: "#64748B",
  border: "#E2E8F0",
  danger: "#EF4444",
  success: "#10B981",
  info: "#3B82F6",
};

type Student = {
  uid: string;
  fullName: string;
  classId: string;
  className: string;
  ptaPaid: number;
  ptaBill: number;
  ptaBalance: number;
};

export default function PTACharges() {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const acadConfig = useAcademicConfig();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("all");
  const [students, setStudents] = useState<Student[]>([]);
  const [excludedUids, setExcludedUids] = useState<Set<string>>(new Set());
  const [ptaAmount, setPtaAmount] = useState("");
  const [classModalVisible, setClassModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [receivedFrom, setReceivedFrom] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Cheque" | "E-cash" | "Momo">("Cash");
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<"payment" | "billing">("payment");
  const [billAmount, setBillAmount] = useState("");
  const [stats, setStats] = useState<any>({
    totalCollected: 0,
    totalBilled: 0,
    count: 0
  });

  const fetchStats = async () => {
    try {
      if (!acadConfig.academicYear || !acadConfig.currentTerm) return;
      const q = query(
        collection(db, "feePayments"),
        where("type", "in", ["pta", "pta_payment"]),
        where("academicYear", "==", acadConfig.academicYear),
        where("term", "==", acadConfig.currentTerm)
      );
      const snap = await getDocsFromServer(q);
      let collected = 0;
      let billed = 0;
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.type === "pta_payment") collected += (data.amount || 0);
        if (data.type === "pta") billed += (data.amount || 0);
      });
      setStats({ totalCollected: collected, totalBilled: billed, count: snap.docs.length });
    } catch (e) {
      console.error("Error fetching PTA stats:", e);
    }
  };

  // Brand colors
  const primaryBrand = SCHOOL_CONFIG.primaryColor || COLORS.primary || VIBE.primary;

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "classes"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, name: d.data().name, ...d.data() }));
      setClasses(sortClasses(list));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (selectedClassId !== "all" || searchQuery.length >= 2) {
      fetchStudents();
    } else {
      setStudents([]);
      setLoading(false);
    }
  }, [selectedClassId, searchQuery]);

  useEffect(() => {
    if (acadConfig.academicYear) {
      fetchStats();
    }
  }, [acadConfig.academicYear, acadConfig.currentTerm]);

  const sections = useMemo(() => {
    if (students.length === 0) return [];

    let filtered = students;
    if (searchQuery.length >= 2) {
      const lower = searchQuery.toLowerCase();
      filtered = students.filter(s => s.fullName.toLowerCase().includes(lower));
    }

    if (selectedClassId !== "all") {
      const cls = classes.find((c) => c.id === selectedClassId);
      return [
        {
          title: cls?.name || "Selected Class",
          data: filtered,
        },
      ];
    }

    const grouped = classes
      .map((cls) => ({
        title: cls.name,
        data: filtered.filter((s) => s.classId === cls.id),
      }))
      .filter((section) => section.data.length > 0);

    const assignedClassIds = new Set(classes.map((c) => c.id));
    const unassigned = filtered.filter((s) => !assignedClassIds.has(s.classId));
    if (unassigned.length > 0) {
      grouped.push({
        title: "Other / Unassigned",
        data: unassigned,
      });
    }

    return grouped;
  }, [classes, students, selectedClassId, searchQuery]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      let q = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("status", "in", ["active", "pending_activation"])
      );

      if (selectedClassId !== "all") {
        q = query(q, where("classId", "==", selectedClassId));
      } else if (searchQuery.length < 2) {
        setStudents([]);
        setLoading(false);
        return;
      }

      const snap = await getDocsFromServer(q);
      const list: Student[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          uid: d.id,
          fullName: `${data.profile?.firstName || ""} ${data.profile?.lastName || ""}`.trim(),
          classId: data.classId || "unknown",
          className: data.className || "Class",
          ptaPaid: data.ptaPaid || 0,
          ptaBill: data.ptaBill || 0,
          ptaBalance: data.ptaBalance || 0,
          ...data,
        };
      });
      setStudents(list.sort((a, b) => a.fullName.localeCompare(b.fullName)));
      setExcludedUids(new Set());
    } catch (e) {
      console.error(e);
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
        where("type", "in", ["pta", "pta_payment"])
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
      const serial = `PTA-PAY-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

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
        type: "pta_payment",
        academicYear: acadConfig.academicYear,
        term: acadConfig.currentTerm,
      };

      // 1. Record the Payment
      batch.set(doc(db, "feePayments", serial), paymentEntry);

      // 2. Update student record
      batch.update(doc(db, "users", selectedStudent.uid), {
        ptaPaid: increment(amount),
        ptaBalance: increment(-amount),
      });

      // 3. Update ledger (studentFeeRecords)
      const year = acadConfig.academicYear?.replace(/\//g, "-");
      const term = acadConfig.currentTerm?.replace(/\s/g, "");
      const recordId = `${selectedStudent.uid}_${year}_${term}`;

      batch.set(doc(db, "studentFeeRecords", recordId), {
        ptaPaid: increment(amount),
        ptaBalance: increment(-amount),
        payments: arrayUnion(paymentEntry),
        lastUpdated: serverTimestamp(),
      }, { merge: true });

      await batch.commit();

      try {
        await sendNotification({
          recipientId: selectedStudent.uid,
          senderId: appUser?.uid || "admin",
          senderName: "School Finance",
          title: "PTA Payment Received",
          body: `A PTA payment of ${SCHOOL_CONFIG.currencySymbol}${amount.toLocaleString()} has been recorded for ${selectedStudent.fullName}.`,
          type: "payment",
          data: {
            studentUid: selectedStudent.uid,
            amount,
            type: "pta_payment"
          }
        });
      } catch (notifErr) {
        console.error("Failed to send PTA notification:", notifErr);
      }

      showToast({ message: `PTA payment recorded: ${serial}`, type: "success" });
      setPaymentModalVisible(false);
      setPaymentAmount("");
      setReceivedFrom("");
      fetchStudents();
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
      const serial = `PTA-BILL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const billEntry = {
        amount,
        method: "PTA Bill",
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
        type: "pta",
        academicYear: acadConfig.academicYear,
        term: acadConfig.currentTerm,
      };

      // 1. Record the Bill
      batch.set(doc(db, "feePayments", serial), billEntry);

      // 2. Update student record
      batch.update(doc(db, "users", selectedStudent.uid), {
        ptaBill: increment(amount),
        ptaBalance: increment(amount),
      });

      // 3. Update ledger (studentFeeRecords)
      const year = acadConfig.academicYear?.replace(/\//g, "-");
      const term = acadConfig.currentTerm?.replace(/\s/g, "");
      const recordId = `${selectedStudent.uid}_${year}_${term}`;

      batch.set(doc(db, "studentFeeRecords", recordId), {
        ptaBalance: increment(amount),
        payments: arrayUnion(billEntry),
        lastUpdated: serverTimestamp(),
      }, { merge: true });

      await batch.commit();

      showToast({ message: `PTA bill created: ${serial}`, type: "success" });
      setPaymentModalVisible(false);
      setBillAmount("");
      fetchStudents();
    } catch (e) {
      console.error(e);
      showToast({ message: "Failed to create bill", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const toggleExclude = (uid: string) => {
    setExcludedUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const applyPtaDues = async () => {
    const amount = parseFloat(ptaAmount);
    if (isNaN(amount) || amount <= 0) {
      return showToast({ message: "Enter a valid amount", type: "error" });
    }

    const targetStudents = students.filter((s) => !excludedUids.has(s.uid));
    if (targetStudents.length === 0) {
      return showToast({ message: "No students selected", type: "error" });
    }

    setSaving(true);
    try {
      const batch = writeBatch(db);
      const year = acadConfig.academicYear?.replace(/\//g, "-");
      const term = acadConfig.currentTerm?.replace(/\s/g, "");

      for (const s of targetStudents) {
        const recordId = `${s.uid}_${year}_${term}`;
        const serial = `PTA-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

        // Add to feePayments for tracking
        const entry = {
          amount,
          method: "Bulk Bill",
          receivedFrom: "PTA Dues",
          updatedBy: appUser?.adminRole || "Admin",
          adminUid: appUser?.uid || "unknown",
          createdAt: new Date().toISOString(),
          receiptNo: serial,
          date: moment().format("YYYY-MM-DD"),
          studentUid: s.uid,
          studentName: s.fullName,
          classId: s.classId,
          className: s.className,
          type: "pta",
          academicYear: acadConfig.academicYear,
          term: acadConfig.currentTerm,
        };

        batch.set(doc(db, "feePayments", serial), entry);

        // Update fee record balance (adding to debt)
        batch.set(
          doc(db, "studentFeeRecords", recordId),
          {
            ptaBalance: increment(amount),
            payments: arrayUnion(entry),
            lastUpdated: serverTimestamp(),
          },
          { merge: true }
        );

        // Update user wallet and PTA tracking
        batch.update(doc(db, "users", s.uid), {
          ptaBalance: increment(amount),
          ptaBill: increment(amount),
        });
      }

      await batch.commit();

      // Send notifications to all target students' parents
      // Using Promise.allSettled to not fail the whole process if notifications fail
      Promise.allSettled(targetStudents.map(s =>
        sendNotification({
          recipientId: s.uid,
          senderId: appUser?.uid || "admin",
          senderName: "School Finance",
          title: "New PTA Due",
          body: `A PTA due of ${SCHOOL_CONFIG.currencySymbol}${amount.toLocaleString()} has been billed to ${s.fullName}.`,
          type: "payment",
          data: {
            studentUid: s.uid,
            amount,
            type: "pta_charge"
          }
        })
      )).catch(err => console.error("Bulk PTA notification error:", err));

      showToast({ message: `Applied PTA Dues to ${targetStudents.length} students`, type: "success" });
      setPtaAmount("");
      fetchStudents();
    } catch (e) {
      console.error(e);
      showToast({ message: "Failed to apply dues", type: "error" });
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
              <Text style={styles.headerTitle}>PTA Dues</Text>
              <Text style={styles.headerSub}>BULK BILLING</Text>
            </View>
            <View style={{ width: 44 }} />
          </View>

          <TouchableOpacity style={styles.classPicker} onPress={() => setClassModalVisible(true)}>
            <Text style={styles.classLabel}>TARGET CLASS</Text>
            <View style={styles.classValueRow}>
              <Text style={styles.classValue}>
                {selectedClassId === "all" ? "Search or select class" : classes.find(c => c.id === selectedClassId)?.name}
              </Text>
              <SVGIcon name="chevron-down" size={20} color="#fff" />
            </View>
          </TouchableOpacity>
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
          <TouchableOpacity onPress={() => { fetchStudents(); fetchStats(); }} style={styles.refreshRound}>
            <SVGIcon name="refresh" size={18} color={VIBE.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.bulkBox}>
          <View style={styles.inputWrap}>
            <Text style={styles.currency}>₵</Text>
            <TextInput
              style={styles.bulkInput}
              placeholder="Enter Amount"
              keyboardType="numeric"
              value={ptaAmount}
              onChangeText={setPtaAmount}
            />
          </View>
          <TouchableOpacity style={styles.applyBtn} onPress={applyPtaDues} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.applyBtnText}>APPLY TO LIST</Text>}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: VIBE.primary, flex: 1.5 }]}>
          <Text style={styles.statLabel}>Term Collected</Text>
          <Text style={styles.statValue}>₵{stats.totalCollected.toLocaleString()}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: VIBE.secondary, flex: 1 }]}>
          <Text style={styles.statLabel}>Term Billed</Text>
          <Text style={styles.statValue}>₵{stats.totalBilled.toLocaleString()}</Text>
        </View>
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>
          Billing List ({students.length - excludedUids.size})
        </Text>
        <Text style={styles.listSub}>Tap 'X' to exclude student, or tap card for payment</Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.uid}
        contentContainerStyle={styles.scrollContent}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderTitle}>{title}</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const isExcluded = excludedUids.has(item.uid);
          return (
            <Animatable.View
              animation="fadeInRight"
              duration={400}
              style={[styles.studentItem, isExcluded && styles.excludedItem]}
            >
              <TouchableOpacity
                style={styles.studentDetails}
                onPress={() => {
                  setSelectedStudent(item);
                  setPaymentAmount("");
                  setReceivedFrom("");
                  setPaymentModalVisible(true);
                  fetchPaymentHistory(item.uid);
                }}
              >
                <Text style={[styles.studentName, isExcluded && styles.excludedText]}>{item.fullName}</Text>
                <Text style={styles.studentClass}>{item.className}</Text>
                <View style={styles.badgeRow}>
                  <View style={[styles.badge, { backgroundColor: VIBE.info + "15", marginRight: 8 }]}>
                    <Text style={[styles.badgeText, { color: VIBE.info }]}>
                      Bill: ₵{(item.ptaBill || 0).toFixed(2)}
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: VIBE.success + "15", marginRight: 8 }]}>
                    <Text style={[styles.badgeText, { color: VIBE.success }]}>
                      Paid: ₵{(item.ptaPaid || 0).toFixed(2)}
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: (item.ptaBalance > 0) ? VIBE.danger + "15" : VIBE.primary + "15" }]}>
                    <Text style={[styles.badgeText, { color: (item.ptaBalance > 0) ? VIBE.danger : VIBE.primary }]}>
                      Owed: ₵{Math.max(0, item.ptaBalance || 0).toFixed(2)}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => toggleExclude(item.uid)}
                style={[styles.removeBtn]}
              >
                <SVGIcon
                  name={isExcluded ? "add-circle" : "close-circle"}
                  size={24}
                  color={isExcluded ? VIBE.success : VIBE.danger}
                />
              </TouchableOpacity>
            </Animatable.View>
          );
        }}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={VIBE.primary} style={{ marginTop: 50 }} />
          ) : (selectedClassId === "all" && searchQuery.length < 2) ? (
            <View style={styles.emptyWrap}>
              <SVGIcon name="search" size={60} color="#CBD5E1" />
              <Text style={styles.emptyText}>Search students or select a class</Text>
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <SVGIcon name="people" size={60} color="#CBD5E1" />
              <Text style={styles.emptyText}>No students found</Text>
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
                <Text style={styles.modalSubtitle}>PTA DUES MANAGEMENT</Text>
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
                    <Text style={styles.inputLabel}>PTA Due Amount (₵)</Text>
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
                <Text style={styles.sectionTitle}>Transaction History</Text>
                {loadingHistory ? (
                  <ActivityIndicator color={VIBE.primary} />
                ) : history.length > 0 ? (
                  history.map((h, i) => (
                    <View key={i} style={styles.historyItem}>
                      <View>
                        <Text style={styles.historyAmt}>₵{h.amount.toFixed(2)}</Text>
                        <Text style={styles.historyDate}>{moment(h.createdAt).format("MMM DD, YYYY")}</Text>
                        <Text style={styles.historyType}>{h.type === 'pta' ? 'Billing' : 'Payment'}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={styles.historyMethod}>{h.method}</Text>
                        <Text style={styles.historyReceipt}>{h.receiptNo}</Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noHistory}>No previous PTA transactions</Text>
                )}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={classModalVisible} transparent animationType="slide">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setClassModalVisible(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Select Class</Text>
            <ScrollView>
              <TouchableOpacity
                style={[styles.sheetItem, selectedClassId === "all" && styles.activeSheetItem]}
                onPress={() => {
                  setSelectedClassId("all");
                  setClassModalVisible(false);
                }}
              >
                <Text style={[styles.sheetItemText, selectedClassId === "all" && styles.activeSheetItemText]}>All Classes</Text>
              </TouchableOpacity>
              {classes.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.sheetItem, selectedClassId === c.id && styles.activeSheetItem]}
                  onPress={() => {
                    setSelectedClassId(c.id);
                    setClassModalVisible(false);
                  }}
                >
                  <Text style={[styles.sheetItemText, selectedClassId === c.id && styles.activeSheetItemText]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VIBE.bg },
  header: { backgroundColor: "#fff", borderBottomLeftRadius: 30, borderBottomRightRadius: 30, ...SHADOWS.medium, paddingBottom: 20 },
  headerTop: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 25, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  navBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  headerIconBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  titleCenter: { alignItems: "center" },
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#fff" },
  headerSub: { fontSize: 10, fontWeight: "800", color: "rgba(255,255,255,0.7)", letterSpacing: 2 },
  classPicker: { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 15, padding: 12 },
  classLabel: { fontSize: 8, fontWeight: "900", color: "rgba(255,255,255,0.6)", marginBottom: 4 },
  classValueRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  classValue: { fontSize: 16, fontWeight: "800", color: "#fff" },
  searchStrip: { flexDirection: "row", paddingHorizontal: 20, marginTop: -25, gap: 10, zIndex: 100 },
  searchBar: { flex: 1, height: 50, backgroundColor: "#fff", borderRadius: 25, flexDirection: "row", alignItems: "center", paddingHorizontal: 20, ...SHADOWS.medium, borderWidth: 1, borderColor: VIBE.border },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 14, fontWeight: "600", color: VIBE.text },
  refreshRound: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", ...SHADOWS.medium, borderWidth: 1, borderColor: VIBE.border },
  bulkBox: { flexDirection: "row", paddingHorizontal: 20, marginTop: 15, gap: 10 },
  inputWrap: { flex: 1, height: 50, backgroundColor: "#fff", borderRadius: 25, flexDirection: "row", alignItems: "center", paddingHorizontal: 20, ...SHADOWS.medium, borderWidth: 1, borderColor: VIBE.border },
  currency: { fontSize: 18, fontWeight: "900", color: VIBE.primary, marginRight: 8 },
  bulkInput: { flex: 1, fontSize: 16, fontWeight: "700", color: VIBE.text },
  applyBtn: { backgroundColor: VIBE.primary, height: 50, paddingHorizontal: 20, borderRadius: 25, justifyContent: "center", alignItems: "center", ...SHADOWS.medium },
  applyBtnText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  statsRow: { flexDirection: "row", paddingHorizontal: 20, marginTop: 20, gap: 12 },
  statCard: { padding: 15, borderRadius: 20, justifyContent: "center", ...SHADOWS.small },
  statLabel: { color: "rgba(255,255,255,0.8)", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  statValue: { color: "#fff", fontSize: 20, fontWeight: "900", marginTop: 4 },
  listHeader: { padding: 20, paddingBottom: 10 },
  listTitle: { fontSize: 16, fontWeight: "900", color: VIBE.text },
  listSub: { fontSize: 11, fontWeight: "600", color: VIBE.muted, marginTop: 2 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  studentItem: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", padding: 15, borderRadius: 18, marginBottom: 10, ...SHADOWS.small, borderWidth: 1, borderColor: VIBE.border },
  excludedItem: { opacity: 0.5, backgroundColor: "#F1F5F9", borderColor: "transparent" },
  studentDetails: { flex: 1 },
  studentName: { fontSize: 15, fontWeight: "800", color: VIBE.text },
  excludedText: { textDecorationLine: "line-through" },
  studentClass: { fontSize: 11, color: VIBE.muted, fontWeight: "600", marginTop: 2 },
  removeBtn: { padding: 5 },
  badgeRow: { flexDirection: "row", marginTop: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: "800" },
  emptyWrap: { alignItems: "center", marginTop: 100, opacity: 0.5 },
  emptyText: { fontSize: 16, fontWeight: "900", color: "#94A3B8", marginTop: 15 },
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
  inputLabel: { fontSize: 12, fontWeight: "800", color: VIBE.muted, marginBottom: 8, marginLeft: 5 },
  mainInput: { backgroundColor: VIBE.bg, borderRadius: 20, padding: 20, fontSize: 28, fontWeight: "900", color: VIBE.primary, borderWidth: 1, borderColor: VIBE.border, textAlign: "center" },
  subInput: { backgroundColor: VIBE.bg, borderRadius: 15, padding: 15, fontSize: 16, fontWeight: "700", color: VIBE.text, borderWidth: 1, borderColor: VIBE.border },
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
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 25, maxHeight: "70%" },
  sheetTitle: { fontSize: 18, fontWeight: "900", color: VIBE.text, textAlign: "center", marginBottom: 20 },
  sheetItem: { padding: 18, borderRadius: 15, marginBottom: 8, backgroundColor: "#F8FAFC" },
  activeSheetItem: { backgroundColor: VIBE.primary },
  sheetItemText: { fontSize: 15, fontWeight: "700", color: VIBE.text, textAlign: "center" },
  activeSheetItemText: { color: "#fff" },
  sectionHeader: {
    backgroundColor: "#F1F5F9",
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginTop: 15,
    marginBottom: 5,
    borderRadius: 10,
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: VIBE.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});
