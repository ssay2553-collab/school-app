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
} from "firebase/firestore";
import moment from "moment";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
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

const VIBE = {
  primary: "#EF4444", // Maintenance Color
  secondary: "#DC2626",
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  text: "#1E293B",
  muted: "#64748B",
  border: "#E2E8F0",
  success: "#10B981",
};

export default function MaintenanceCharges() {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const acadConfig = useAcademicConfig();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [chargeAmount, setChargeAmount] = useState("");
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "classes"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, name: d.data().name, ...d.data() }));
      const sorted = sortClasses(list);
      setClasses(sorted);
      if (sorted.length > 0 && !selectedClassId) setSelectedClassId(sorted[0].id);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (selectedClassId) fetchStudents();
  }, [selectedClassId]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("classId", "==", selectedClassId),
        where("status", "in", ["active", "pending_activation"])
      );
      const snap = await getDocsFromServer(q);
      const list = snap.docs.map((d) => ({
        uid: d.id,
        fullName: `${d.data().profile?.firstName || ""} ${d.data().profile?.lastName || ""}`.trim(),
        ...d.data(),
      }));
      setStudents(list.sort((a, b) => a.fullName.localeCompare(b.fullName)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const applyBulkCharge = async () => {
    const val = parseFloat(chargeAmount);
    if (isNaN(val) || val <= 0) return showToast({ message: "Invalid amount", type: "error" });
    if (students.length === 0) return showToast({ message: "No students in class", type: "error" });

    setSaving(true);
    try {
      const batch = writeBatch(db);
      const year = acadConfig.academicYear?.replace(/\//g, "-");
      const term = acadConfig.currentTerm?.replace(/\s/g, "");

      for (const s of students) {
        const recordId = `${s.uid}_${year}_${term}`;
        const serial = `MNT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

        // Track as a charge entry
        batch.set(doc(db, "feePayments", serial), {
          amount: val,
          method: "Bulk Charge",
          receivedFrom: "Maintenance Fee",
          updatedBy: appUser?.adminRole || "Admin",
          adminUid: appUser?.uid || "unknown",
          createdAt: new Date().toISOString(),
          receiptNo: serial,
          date: moment().format("YYYY-MM-DD"),
          studentUid: s.uid,
          studentName: s.fullName,
          classId: s.classId,
          className: s.className,
          type: "maintenance",
          academicYear: acadConfig.academicYear,
          term: acadConfig.currentTerm,
        });

        batch.set(doc(db, "studentFeeRecords", recordId), {
          maintenanceBalance: increment(val),
          lastUpdated: serverTimestamp(),
        }, { merge: true });

        batch.update(doc(db, "users", s.uid), {
          maintenanceBalance: increment(val),
        });
      }

      await batch.commit();

      // Notify parents of charge
      Promise.allSettled(students.map(s =>
        sendNotification({
          recipientId: s.uid,
          senderId: appUser?.uid || "admin",
          senderName: "School Finance",
          title: "Maintenance Fee Applied",
          body: `A maintenance fee of ${SCHOOL_CONFIG.currencySymbol}${val.toLocaleString()} has been applied to ${s.fullName}.`,
          type: "payment",
          data: {
            studentUid: s.uid,
            amount: val,
            type: "maintenance_charge"
          }
        })
      )).catch(err => console.error("Bulk Maintenance notification error:", err));

      showToast({ message: `Maintenance charges applied to ${students.length} students`, type: "success" });
      setChargeAmount("");
    } catch (e) {
      console.error(e);
      showToast({ message: "Operation failed", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleLogPayment = async () => {
    const val = parseFloat(paymentAmount);
    if (isNaN(val) || val <= 0 || !selectedStudent) return;

    setSaving(true);
    try {
      const batch = writeBatch(db);
      const recordId = `${selectedStudent.uid}_${acadConfig.academicYear?.replace(/\//g, "-")}_${acadConfig.currentTerm?.replace(/\s/g, "")}`;
      const serial = `MNT-PAY-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      batch.set(doc(db, "feePayments", serial), {
        amount: val,
        method: "Cash",
        receivedFrom: selectedStudent.fullName,
        updatedBy: appUser?.adminRole || "Admin",
        adminUid: appUser?.uid || "unknown",
        createdAt: new Date().toISOString(),
        receiptNo: serial,
        date: moment().format("YYYY-MM-DD"),
        studentUid: selectedStudent.uid,
        studentName: selectedStudent.fullName,
        classId: selectedStudent.classId,
        className: selectedStudent.className,
        type: "maintenance_payment",
        academicYear: acadConfig.academicYear,
        term: acadConfig.currentTerm,
      });

      batch.update(doc(db, "studentFeeRecords", recordId), {
        maintenanceBalance: increment(-val),
        maintenancePaid: increment(val),
        lastUpdated: serverTimestamp(),
      });

      batch.update(doc(db, "users", selectedStudent.uid), {
        maintenanceBalance: increment(-val),
      });

      await batch.commit();

      // Notify parent of payment
      try {
        await sendNotification({
          recipientId: selectedStudent.uid,
          senderId: appUser?.uid || "admin",
          senderName: "School Finance",
          title: "Maintenance Payment Received",
          body: `A maintenance payment of ${SCHOOL_CONFIG.currencySymbol}${val.toLocaleString()} has been recorded for ${selectedStudent.fullName}.`,
          type: "payment",
          data: {
            studentUid: selectedStudent.uid,
            amount: val,
            type: "maintenance_payment"
          }
        });
      } catch (notifErr) {
        console.error("Failed to send maintenance payment notification:", notifErr);
      }

      showToast({ message: "Payment recorded", type: "success" });
      setPaymentModalVisible(false);
      setPaymentAmount("");
      fetchStudents();
    } catch (e) {
      console.error(e);
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
              <Text style={styles.headerTitle}>Maintenance</Text>
              <Text style={styles.headerSub}>FACILITY BILLING</Text>
            </View>
            <View style={{ width: 44 }} />
          </View>
        </LinearGradient>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.classScroll} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
          {classes.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.classChip, selectedClassId === c.id && styles.activeClassChip]}
              onPress={() => setSelectedClassId(c.id)}
            >
              <Text style={[styles.classChipText, selectedClassId === c.id && styles.activeClassChipText]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.bulkRow}>
        <TextInput
          style={styles.bulkInput}
          placeholder="Apply Maintenance Fee (₵)"
          keyboardType="numeric"
          value={chargeAmount}
          onChangeText={setChargeAmount}
        />
        <TouchableOpacity style={styles.bulkBtn} onPress={applyBulkCharge} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.bulkBtnText}>BILL CLASS</Text>}
        </TouchableOpacity>
      </View>

      <FlatList
        data={students}
        keyExtractor={(item) => item.uid}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Animatable.View animation="fadeInUp" duration={400} style={styles.studentCard}>
            <View style={styles.studentInfo}>
              <Text style={styles.studentName}>{item.fullName}</Text>
              <Text style={styles.walletLabel}>Maint. Arrears: ₵{(item.maintenanceBalance || 0).toFixed(2)}</Text>
            </View>
            <TouchableOpacity
              style={styles.payBtn}
              onPress={() => {
                setSelectedStudent(item);
                setPaymentModalVisible(true);
              }}
            >
              <Text style={styles.payBtnText}>PAY</Text>
            </TouchableOpacity>
          </Animatable.View>
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={VIBE.primary} style={{ marginTop: 50 }} />
          ) : (
            <View style={styles.emptyWrap}>
              <SVGIcon name="construct" size={64} color="#CBD5E1" />
              <Text style={styles.emptyText}>No students in this class</Text>
            </View>
          )
        }
      />

      <Modal visible={paymentModalVisible} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modalBody}>
            <Text style={styles.modalTitle}>Receive Payment</Text>
            <Text style={styles.modalStudent}>{selectedStudent?.fullName}</Text>
            <TextInput
              style={styles.paymentInput}
              placeholder="0.00"
              keyboardType="numeric"
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              autoFocus
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setPaymentModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleLogPayment} disabled={saving}>
                <Text style={styles.confirmBtnText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VIBE.bg },
  header: { backgroundColor: "#fff", borderBottomLeftRadius: 30, borderBottomRightRadius: 30, ...SHADOWS.medium, paddingBottom: 20 },
  headerTop: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 25, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  navBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 15 },
  headerIconBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  titleCenter: { alignItems: "center" },
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#fff" },
  headerSub: { fontSize: 10, fontWeight: "800", color: "rgba(255,255,255,0.7)", letterSpacing: 2 },
  classScroll: { marginTop: -20 },
  classChip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12, backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: VIBE.border },
  activeClassChip: { backgroundColor: VIBE.primary, borderColor: VIBE.primary },
  classChipText: { fontSize: 13, fontWeight: "700", color: VIBE.muted },
  activeClassChipText: { color: "#fff" },
  bulkRow: { flexDirection: "row", padding: 20, gap: 10 },
  bulkInput: { flex: 1, height: 50, backgroundColor: "#fff", borderRadius: 15, paddingHorizontal: 15, fontSize: 14, fontWeight: "600", ...SHADOWS.small, borderWidth: 1, borderColor: VIBE.border },
  bulkBtn: { backgroundColor: VIBE.primary, height: 50, paddingHorizontal: 20, borderRadius: 15, justifyContent: "center", alignItems: "center", ...SHADOWS.medium },
  bulkBtnText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  listContent: { padding: 20, paddingTop: 0 },
  studentCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", padding: 15, borderRadius: 18, marginBottom: 10, ...SHADOWS.small, borderWidth: 1, borderColor: VIBE.border },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 15, fontWeight: "800", color: VIBE.text },
  walletLabel: { fontSize: 11, fontWeight: "700", color: VIBE.primary, marginTop: 2 },
  payBtn: { backgroundColor: VIBE.success, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10 },
  payBtnText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  emptyWrap: { alignItems: "center", marginTop: 80, opacity: 0.5 },
  emptyText: { fontSize: 16, fontWeight: "900", color: "#94A3B8", marginTop: 15 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 20 },
  modalBody: { backgroundColor: "#fff", borderRadius: 30, padding: 30, alignItems: "center" },
  modalTitle: { fontSize: 18, fontWeight: "900", color: VIBE.text },
  modalStudent: { fontSize: 14, color: VIBE.muted, marginTop: 5, marginBottom: 20 },
  paymentInput: { width: "100%", height: 60, backgroundColor: "#F8FAFC", borderRadius: 15, textAlign: "center", fontSize: 24, fontWeight: "900", color: VIBE.primary, marginBottom: 25, borderWidth: 1, borderColor: VIBE.border },
  modalBtnRow: { flexDirection: "row", gap: 15, width: "100%" },
  cancelBtn: { flex: 1, height: 50, backgroundColor: "#F1F5F9", borderRadius: 15, justifyContent: "center", alignItems: "center" },
  cancelBtnText: { fontSize: 14, fontWeight: "800", color: VIBE.muted },
  confirmBtn: { flex: 1, height: 50, backgroundColor: VIBE.primary, borderRadius: 15, justifyContent: "center", alignItems: "center" },
  confirmBtnText: { fontSize: 14, fontWeight: "800", color: "#fff" },
});
