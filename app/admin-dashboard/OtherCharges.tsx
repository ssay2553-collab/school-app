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
import React, { useEffect, useState } from "react";
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
  primary: "#8B5CF6", // Other Charges Color
  secondary: "#7C3AED",
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  text: "#1E293B",
  muted: "#64748B",
  border: "#E2E8F0",
  success: "#10B981",
};

export default function OtherCharges() {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const acadConfig = useAcademicConfig();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [chargeType, setChargeType] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");

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

  const applyOtherCharge = async () => {
    const val = parseFloat(chargeAmount);
    if (!chargeType.trim() || isNaN(val) || val <= 0) return showToast({ message: "Invalid details", type: "error" });
    if (students.length === 0) return showToast({ message: "No students", type: "error" });

    setSaving(true);
    try {
      const batch = writeBatch(db);
      const year = acadConfig.academicYear?.replace(/\//g, "-");
      const term = acadConfig.currentTerm?.replace(/\s/g, "");

      for (const s of students) {
        const recordId = `${s.uid}_${year}_${term}`;
        const serial = `OTH-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

        batch.set(doc(db, "feePayments", serial), {
          amount: val,
          method: "Bulk Charge",
          receivedFrom: chargeType.trim(),
          updatedBy: appUser?.adminRole || "Admin",
          adminUid: appUser?.uid || "unknown",
          createdAt: new Date().toISOString(),
          receiptNo: serial,
          date: moment().format("YYYY-MM-DD"),
          studentUid: s.uid,
          studentName: s.fullName,
          classId: s.classId,
          className: s.className,
          type: "other",
          otherCategory: chargeType.trim(),
          academicYear: acadConfig.academicYear,
          term: acadConfig.currentTerm,
        });

        batch.set(doc(db, "studentFeeRecords", recordId), {
          otherBalance: increment(val),
          otherBill: increment(val),
          balance: increment(val),
          lastUpdated: serverTimestamp(),
        }, { merge: true });

        batch.update(doc(db, "users", s.uid), {
          otherBalance: increment(val),
          otherBill: increment(val),
          walletBalance: increment(val),
        });
      }

      await batch.commit();

      // Notify parents
      Promise.allSettled(students.map(s =>
        sendNotification({
          recipientId: s.uid,
          senderId: appUser?.uid || "admin",
          senderName: "School Finance",
          title: `New Charge: ${chargeType.trim()}`,
          body: `A charge of ${SCHOOL_CONFIG.currencySymbol}${val.toLocaleString()} has been applied to ${s.fullName}.`,
          type: "payment",
          data: {
            studentUid: s.uid,
            amount: val,
            type: "other_charge",
            category: chargeType.trim()
          }
        })
      )).catch(err => console.error("Bulk Other notification error:", err));

      showToast({ message: `${chargeType} applied to ${students.length} students`, type: "success" });
      setChargeAmount("");
      setChargeType("");
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
            <TouchableOpacity onPress={() => router.back()} style={styles.headerIconBtn}>
              <SVGIcon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.titleCenter}>
              <Text style={styles.headerTitle}>Other Fees</Text>
              <Text style={styles.headerSub}>GRADUATION & SPECIAL</Text>
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

      <View style={styles.bulkBody}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Charge Description</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Graduation Gown Fee"
            value={chargeType}
            onChangeText={setChargeType}
          />
        </View>
        <View style={styles.inputRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Amount (₵)</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              keyboardType="numeric"
              value={chargeAmount}
              onChangeText={setChargeAmount}
            />
          </View>
          <TouchableOpacity style={styles.applyBtn} onPress={applyOtherCharge} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.applyBtnText}>BILL CLASS</Text>}
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={students}
        keyExtractor={(item) => item.uid}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.studentCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.fullName.charAt(0)}</Text>
            </View>
            <View style={styles.studentInfo}>
              <Text style={styles.studentName}>{item.fullName}</Text>
              <Text style={styles.balanceLabel}>Other Bal: ₵{(item.otherBalance || 0).toFixed(2)}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={VIBE.primary} style={{ marginTop: 50 }} />
          ) : (
            <View style={styles.emptyWrap}>
              <SVGIcon name="layers-outline" size={64} color="#CBD5E1" />
              <Text style={styles.emptyText}>No students selected</Text>
            </View>
          )
        }
      />
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
  bulkBody: { padding: 20 },
  inputGroup: { marginBottom: 15 },
  label: { fontSize: 11, fontWeight: "900", color: VIBE.muted, marginBottom: 8, textTransform: "uppercase" },
  input: { backgroundColor: "#fff", height: 50, borderRadius: 15, paddingHorizontal: 15, fontSize: 14, fontWeight: "600", ...SHADOWS.small, borderWidth: 1, borderColor: VIBE.border },
  inputRow: { flexDirection: "row", gap: 15, alignItems: "flex-end" },
  applyBtn: { backgroundColor: VIBE.primary, height: 50, paddingHorizontal: 25, borderRadius: 15, justifyContent: "center", alignItems: "center", ...SHADOWS.medium },
  applyBtnText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  listContent: { padding: 20, paddingTop: 0 },
  studentCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", padding: 15, borderRadius: 18, marginBottom: 10, ...SHADOWS.small, borderWidth: 1, borderColor: VIBE.border },
  avatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: VIBE.primary + "15", justifyContent: "center", alignItems: "center" },
  avatarText: { fontSize: 18, fontWeight: "900", color: VIBE.primary },
  studentInfo: { flex: 1, marginLeft: 15 },
  studentName: { fontSize: 15, fontWeight: "800", color: VIBE.text },
  balanceLabel: { fontSize: 11, fontWeight: "700", color: VIBE.muted, marginTop: 2 },
  emptyWrap: { alignItems: "center", marginTop: 60, opacity: 0.5 },
  emptyText: { fontSize: 16, fontWeight: "900", color: "#94A3B8", marginTop: 15 },
});
