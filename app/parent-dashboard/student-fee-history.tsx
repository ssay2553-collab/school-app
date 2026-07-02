import { Picker } from "@react-native-picker/picker";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import moment from "moment";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { db } from "../../firebaseConfig";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";

const { width } = Dimensions.get("window");

export default function StudentFeeHistory() {
  const { studentId: paramStudentId } = useLocalSearchParams();
  const router = useRouter();
  const { appUser } = useAuth();
  const acadConfig = useAcademicConfig();
  const { showToast } = useToast();

  const primary = SCHOOL_CONFIG.primaryColor || COLORS.primary;
  const secondary = SCHOOL_CONFIG.secondaryColor || COLORS.secondary;

  const availableYears = useMemo(() => {
    const start = 2024;
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = start; y <= currentYear + 3; y++) {
      years.push(`${y}/${y + 1}`);
    }
    if (acadConfig.academicYear && !years.includes(acadConfig.academicYear)) {
      years.push(acadConfig.academicYear);
    }
    return Array.from(new Set(years)).sort().reverse();
  }, [acadConfig.academicYear]);

  const [selectedYear, setSelectedYear] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("Term 1");
  const [loading, setLoading] = useState(true);
  const [fetchingRecord, setFetchingRecord] = useState(false);
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>(
    (paramStudentId as string) || "",
  );
  const [studentData, setStudentData] = useState<any>(null);
  const [record, setRecord] = useState<any>(null);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);

  // Sync with global academic config
  useEffect(() => {
    if (!acadConfig.loading) {
      setSelectedYear(acadConfig.academicYear);
      setSelectedTerm(acadConfig.currentTerm);
    }
  }, [acadConfig]);

  useEffect(() => {
    if (!appUser || appUser.role !== "parent") return;
    const fetchChildren = async () => {
      const ids = appUser.childrenIds || [];
      if (ids.length === 0) {
        setLoading(false);
        return;
      }
      try {
        const q = query(
          collection(db, "users"),
          where(documentId(), "in", ids.slice(0, 30)),
        );
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => ({
          id: d.id,
          name: `${(d.data() as any).profile?.firstName || ""} ${(d.data() as any).profile?.lastName || ""}`.trim(),
        }));
        setChildren(list);
        if (list.length > 0)
          setSelectedChildId((prev: string) => prev || list[0].id);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    fetchChildren();
  }, [appUser]);

  useEffect(() => {
    if (!selectedChildId) return;
    const loadStudentData = async () => {
      const studentDoc = await getDoc(doc(db, "users", selectedChildId));
      if (studentDoc.exists()) setStudentData(studentDoc.data() as any);
    };
    loadStudentData();
  }, [selectedChildId]);

  useEffect(() => {
    if (!selectedChildId || !selectedYear || !selectedTerm) return;
    setFetchingRecord(true);
    const cleanYear = selectedYear.replace(/\//g, "-");
    const cleanTerm = selectedTerm.replace(/\s/g, "");
    const recordId = `${selectedChildId}_${cleanYear}_${cleanTerm}`;

    const unsubRecord = onSnapshot(
      doc(db, "studentFeeRecords", recordId),
      (snap) => {
        setRecord(snap.exists() ? (snap.data() as any) : null);
      },
      (err) => {
        console.warn("Fee record listener failed:", err);
        setRecord(null);
      }
    );

    const q = query(
      collection(db, "feePayments"),
      where("studentUid", "==", selectedChildId),
      where("academicYear", "==", selectedYear),
      where("term", "==", selectedTerm),
    );

    const unsubTransactions = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAllTransactions(
        list.sort(
          (a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
      );
      setFetchingRecord(false);
    }, (err) => {
      console.warn("Transactions listener failed:", err);
      setFetchingRecord(false);
    });

    return () => {
      unsubRecord();
      unsubTransactions();
    };
  }, [selectedChildId, selectedYear, selectedTerm]);

  const rawSummary = useMemo(() => {
    // 1. Initialize with tuition (term bill + arrears - discount)
    const summary: Record<string, { billed: number; paid: number }> = {
      tuition: {
        billed:
          (record?.termBill || 0) +
          (record?.arrears || 0) -
          (record?.discount || 0),
        paid: 0,
      },
    };

    // 2. Aggregate Transactions for all categories
    allTransactions.forEach((t: any) => {
      const type = (t.type || "tuition").toLowerCase();
      const isPayment =
        type.endsWith("_payment") ||
        type === "tuition" ||
        type === "tuition_credit";
      let category = type.replace("_payment", "").replace("_credit", "");

      // Handle specific "Other" categories
      if (type === "other") {
        category = (t.otherCategory || "other").toLowerCase();
      }

      if (!summary[category]) summary[category] = { billed: 0, paid: 0 };

      // Only sum payments from transactions - bills come from record or transactions
      if (isPayment) {
        summary[category].paid += t.amount || 0;
      } else if (type === "other") {
        // For 'other' type, we sum the billed amount from transactions to get specific names
        summary[category].billed += t.amount || 0;
      }
    });

    // 3. Reflect Record "Base" Totals for isolated categories
    if (record) {
      const isolated = [
        { key: "pta", bill: record.ptaBill || 0, paid: record.ptaPaid || 0 },
        {
          key: "maintenance",
          bill: record.maintenanceBill || 0,
          paid: record.maintenancePaid || 0,
        },
        {
          key: "admission",
          bill: record.admissionBill || 0,
          paid: record.admissionPaid || 0,
        },
        {
          key: "books",
          bill: record.booksBill || 0,
          paid: record.booksPaid || 0,
        },
        {
          key: "uniform",
          bill: record.uniformBill || 0,
          paid: record.uniformPaid || 0,
        },
      ];

      isolated.forEach((cat) => {
        if (!summary[cat.key]) summary[cat.key] = { billed: 0, paid: 0 };
        summary[cat.key].billed = Math.max(summary[cat.key].billed, cat.bill);
        summary[cat.key].paid = Math.max(summary[cat.key].paid, cat.paid);
      });

      // Special handling for 'other' to ensure it matches record.otherBill and avoids double counting
      const specificOtherBilled = Object.entries(summary)
        .filter(
          ([k]) =>
            ![
              "tuition",
              "pta",
              "maintenance",
              "admission",
              "books",
              "uniform",
              "other",
            ].includes(k),
        )
        .reduce((sum, [_, v]) => sum + v.billed, 0);

      const unnamedOtherBill = Math.max(
        0,
        (record.otherBill || 0) - specificOtherBilled,
      );

      if (unnamedOtherBill > 0 || record.otherPaid > 0) {
        if (!summary["other"]) summary["other"] = { billed: 0, paid: 0 };
        summary["other"].billed = Math.max(
          summary["other"].billed,
          unnamedOtherBill,
        );
        summary["other"].paid = Math.max(summary["other"].paid, record.otherPaid || 0);
      }

      summary.tuition.paid = Math.max(
        summary.tuition.paid,
        record.amountPaid || 0,
      );
    }
    return summary;
  }, [allTransactions, record]);

  const categorySummary = useMemo(() => {
    const filtered: Record<string, { billed: number; paid: number }> = {};
    Object.entries(rawSummary).forEach(([cat, vals]) => {
      if (vals.billed > 0 || vals.paid > 0) {
        filtered[cat] = vals;
      }
    });
    return filtered;
  }, [rawSummary]);

  const { totalBilled, totalPaid, totalBalance } = useMemo(() => {
    const billed = Object.values(categorySummary).reduce(
      (acc, curr: any) => acc + curr.billed,
      0,
    );
    const paid = Object.values(categorySummary).reduce(
      (acc, curr: any) => acc + curr.paid,
      0,
    );
    return {
      totalBilled: billed,
      totalPaid: paid,
      totalBalance: billed - paid,
    };
  }, [categorySummary]);

  if (loading || acadConfig.loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={primary} />
      </View>
    );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[primary, secondary]} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <SVGIcon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={styles.headerTitle}>Financial Statement</Text>
            <Text style={styles.headerSub}>Transaction Ledger</Text>
          </View>
        </View>
        <View style={styles.filterRow}>
          <View style={[styles.pickerBox, { flex: 1.2 }]}>
            <Text style={styles.miniLabel}>
              ACADEMIC YEAR{" "}
              {selectedYear === acadConfig.academicYear ? "(CURRENT)" : ""}
            </Text>
            <Picker
              selectedValue={selectedYear}
              onValueChange={setSelectedYear}
              style={[
                styles.picker,
                Platform.OS === "web" &&
                  ({
                    color: "#fff",
                    backgroundColor: "transparent",
                    outline: "none",
                    border: "none",
                  } as any),
              ]}
              dropdownIconColor="#fff"
            >
              {availableYears.map((y) => (
                <Picker.Item
                  key={y}
                  label={y}
                  value={y}
                  color={Platform.OS === "web" ? "#000" : "#0F172A"}
                />
              ))}
            </Picker>
          </View>
          <View style={[styles.pickerBox, { flex: 1, marginLeft: 10 }]}>
            <Text style={styles.miniLabel}>
              TERM {selectedTerm === acadConfig.currentTerm ? "(CURRENT)" : ""}
            </Text>
            <Picker
              selectedValue={selectedTerm}
              onValueChange={setSelectedTerm}
              style={[
                styles.picker,
                Platform.OS === "web" &&
                  ({
                    color: "#fff",
                    backgroundColor: "transparent",
                    outline: "none",
                    border: "none",
                  } as any),
              ]}
              dropdownIconColor="#fff"
            >
              <Picker.Item
                label="Term 1"
                value="Term 1"
                color={Platform.OS === "web" ? "#000" : "#0F172A"}
              />
              <Picker.Item
                label="Term 2"
                value="Term 2"
                color={Platform.OS === "web" ? "#000" : "#0F172A"}
              />
              <Picker.Item
                label="Term 3"
                value="Term 3"
                color={Platform.OS === "web" ? "#000" : "#0F172A"}
              />
            </Picker>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {children.length > 1 && (
          <View style={styles.selectorWrapper}>
            <Text style={styles.sectionLabel}>SELECT CHILD</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.selectorScroll}
            >
              {children.map((c: any) => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setSelectedChildId(c.id)}
                  style={[
                    styles.childChip,
                    selectedChildId === c.id && {
                      backgroundColor: primary,
                      borderColor: primary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.childChipText,
                      selectedChildId === c.id && { color: "#fff" },
                    ]}
                  >
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {fetchingRecord ? (
          <ActivityIndicator color={primary} style={{ marginTop: 40 }} />
        ) : record ? (
          <Animatable.View
            animation="fadeInUp"
            duration={600}
            style={styles.receiptPaper}
          >
            <View style={styles.paperDivider} />
            <View style={styles.receiptHeaderRow}>
              <Text style={styles.receiptTitleText}>
                TERM BILL & PAYMENT BREAKDOWN
              </Text>
              <TouchableOpacity
                onPress={() => {
                  router.push({
                    pathname: "/shared/receipt-view",
                    params: {
                      type: "bill",
                      studentId: selectedChildId,
                      year: selectedYear,
                      term: selectedTerm,
                    },
                  });
                }}
                style={styles.viewOfficialBtn}
              >
                <SVGIcon name="document-text" size={18} color={primary} />
                <Text style={[styles.viewOfficialText, { color: primary }]}>
                  OFFICIAL BILL
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.paperInfoGrid}>
              <View style={styles.paperInfoItem}>
                <Text style={styles.paperInfoLabel}>STUDENT:</Text>
                <Text style={styles.paperInfoValue}>{record.studentName}</Text>
              </View>
              <View style={styles.paperInfoItem}>
                <Text style={styles.paperInfoLabel}>CLASS:</Text>
                <Text style={styles.paperInfoValue}>
                  {record.className || "N/A"}
                </Text>
              </View>
              <View style={styles.paperInfoItem}>
                <Text style={styles.paperInfoLabel}>PERIOD:</Text>
                <Text style={styles.paperInfoValue}>
                  {record.term} • {record.academicYear}
                </Text>
              </View>
              <View style={styles.paperInfoItem}>
                <Text style={styles.paperInfoLabel}>DATE:</Text>
                <Text style={styles.paperInfoValue}>
                  {moment().format("DD/MM/YYYY")}
                </Text>
              </View>
            </View>

            {/* Invoice Table Breakdown */}
            <View style={styles.invoiceTable}>
              <View style={styles.invoiceHeader}>
                <Text style={[styles.invoiceTh, { flex: 2 }]}>DESCRIPTION</Text>
                <Text
                  style={[styles.invoiceTh, { flex: 1.2, textAlign: "right" }]}
                >
                  BILLED
                </Text>
                <Text
                  style={[styles.invoiceTh, { flex: 1.2, textAlign: "right" }]}
                >
                  PAID
                </Text>
                <Text
                  style={[styles.invoiceTh, { flex: 1.2, textAlign: "right" }]}
                >
                  BALANCE
                </Text>
              </View>
              {Object.entries(categorySummary).map(([cat, vals]: any) => (
                <View key={cat} style={styles.invoiceRow}>
                  <Text
                    style={[styles.invoiceTd, { flex: 2, fontWeight: "800" }]}
                  >
                    {cat.toUpperCase()}
                  </Text>
                  <Text
                    style={[
                      styles.invoiceTd,
                      { flex: 1.2, textAlign: "right" },
                    ]}
                  >
                    ₵{vals.billed.toFixed(2)}
                  </Text>
                  <Text
                    style={[
                      styles.invoiceTd,
                      { flex: 1.2, textAlign: "right", color: "#10B981" },
                    ]}
                  >
                    ₵{vals.paid.toFixed(2)}
                  </Text>
                  <Text
                    style={[
                      styles.invoiceTd,
                      { flex: 1.2, textAlign: "right", fontWeight: "900" },
                    ]}
                  >
                    ₵{(vals.billed - vals.paid).toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Summary */}
            <View style={styles.totalsSection}>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>TOTAL BILLED:</Text>
                <Text style={styles.totalsValue}>
                  ₵ {totalBilled.toFixed(2)}
                </Text>
              </View>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>TOTAL PAID:</Text>
                <Text style={[styles.totalsValue, { color: "#10B981" }]}>
                  ₵ {totalPaid.toFixed(2)}
                </Text>
              </View>
              <View style={styles.grandTotalRow}>
                <Text style={styles.grandTotalLabel}>NET BALANCE:</Text>
                <Text
                  style={[
                    styles.grandTotalValue,
                    { color: totalBalance > 0 ? "#EF4444" : "#10B981" },
                  ]}
                >
                  ₵ {totalBalance.toFixed(2)}
                </Text>
              </View>
            </View>

            <View style={styles.paperFooter}>
              <Text style={styles.footerNote}>
                Computer generated. No signature required.
              </Text>
              <Text style={styles.footerCopyright}>
                © {moment().year()} {SCHOOL_CONFIG.fullName}
              </Text>
            </View>

            <View style={styles.watermark}>
              <SVGIcon
                name="checkmark-done-circle"
                size={120}
                color="rgba(0,0,0,0.02)"
              />
            </View>
          </Animatable.View>
        ) : (
          selectedChildId && (
            <View style={styles.emptyContainer}>
              <SVGIcon name="alert-circle" size={64} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No record found</Text>
              <Text style={styles.emptySub}>
                No financial data exists for this student in {selectedTerm}{" "}
                {selectedYear}.
              </Text>
            </View>
          )
        )}

        {/* Payment History List for Parents */}
        {selectedChildId && allTransactions.length > 0 && (
          <View style={styles.historyContainer}>
            <Text style={styles.historyTitle}>PAYMENT HISTORY</Text>
            {allTransactions.map((payment: any, idx: number) => (
              <TouchableOpacity
                key={payment.id || idx}
                style={styles.paymentCard}
                onPress={() => {
                  router.push({
                    pathname: "/shared/receipt-view",
                    params: {
                      type: "payment",
                      studentId: selectedChildId,
                      paymentId: payment.id,
                      year: selectedYear,
                      term: selectedTerm,
                    },
                  });
                }}
              >
                <View style={styles.paymentLead}>
                  <View style={styles.iconCircle}>
                    <SVGIcon name="receipt" size={20} color={primary} />
                  </View>
                  <View>
                    <Text style={styles.paymentLabel}>
                      {payment.otherCategory?.toUpperCase() ||
                       payment.type?.replace('_payment', '').replace('_', ' ').toUpperCase() ||
                       "FEE PAYMENT"}
                    </Text>
                    <Text style={styles.paymentDate}>
                      {moment(payment.timestamp?.toDate()).format(
                        "MMM DD, YYYY",
                      )}{" "}
                      • {payment.receiptNo}
                    </Text>
                  </View>
                </View>
                <View style={styles.paymentTail}>
                  <Text style={styles.paymentValue}>
                    ₵{payment.amount.toFixed(2)}
                  </Text>
                  <SVGIcon name="chevron-forward" size={16} color="#94A3B8" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    paddingBottom: 25,
    ...SHADOWS.medium,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 25,
    paddingTop: Platform.OS === "ios" ? 10 : 40,
    marginBottom: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "900", color: "#fff" },
  headerSub: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  logoMini: { width: 32, height: 32 },
  filterRow: { flexDirection: "row", paddingHorizontal: 25, gap: 10 },
  pickerBox: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 14,
    height: 60,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 5,
  },
  picker: { height: 40, color: "#fff", marginLeft: -10, marginTop: 15 },
  miniLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "rgba(255,255,255,0.8)",
    position: "absolute",
    top: 8,
    left: 14,
    zIndex: 1,
    letterSpacing: 0.5,
  },
  scrollContent: { padding: 20 },
  selectorWrapper: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#94A3B8",
    marginBottom: 12,
    letterSpacing: 1,
  },
  selectorScroll: { gap: 10 },
  childChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 15,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...SHADOWS.small,
  },
  childChipText: { fontSize: 13, fontWeight: "700", color: "#64748B" },

  // Real Receipt UI Styles
  receiptPaper: {
    backgroundColor: "#fff",
    borderRadius: 4,
    padding: 25,
    ...SHADOWS.medium,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    overflow: "hidden",
    minHeight: 600,
    position: "relative",
  },
  paperDivider: { height: 2, backgroundColor: "#1E293B", marginVertical: 10 },
  receiptHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  receiptTitleText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#1E293B",
    letterSpacing: 2,
  },
  viewOfficialBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  viewOfficialText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  paperInfoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 25,
  },
  paperInfoItem: { width: "48%" },
  paperInfoLabel: { fontSize: 8, fontWeight: "900", color: "#94A3B8" },
  paperInfoValue: { fontSize: 11, fontWeight: "700", color: "#1E293B" },

  invoiceTable: { marginBottom: 30, marginTop: 10 },
  invoiceHeader: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#1E293B",
  },
  invoiceTh: { fontSize: 10, fontWeight: "900", color: "#1E293B" },
  invoiceRow: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    alignItems: "center",
  },
  invoiceTd: { fontSize: 11, color: "#1E293B" },

  totalsSection: { borderTopWidth: 1, borderTopColor: "#000", paddingTop: 15 },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 20,
    marginBottom: 6,
  },
  totalsLabel: { fontSize: 10, fontWeight: "800", color: "#64748B" },
  totalsValue: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1E293B",
    width: 100,
    textAlign: "right",
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 20,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderStyle: "dashed",
  },
  grandTotalLabel: { fontSize: 12, fontWeight: "900", color: "#1E293B" },
  grandTotalValue: {
    fontSize: 14,
    fontWeight: "900",
    width: 100,
    textAlign: "right",
  },

  paperFooter: { marginTop: 50, alignItems: "center" },
  footerNote: { fontSize: 9, color: "#94A3B8", fontStyle: "italic" },
  footerCopyright: {
    fontSize: 9,
    fontWeight: "800",
    color: "#CBD5E1",
    marginTop: 4,
  },
  historyContainer: {
    padding: 20,
    marginTop: 10,
  },
  historyTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#64748B",
    marginBottom: 15,
    letterSpacing: 1,
  },
  paymentCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 18,
    marginBottom: 12,
    ...SHADOWS.small,
  },
  paymentLead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  paymentLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E293B",
  },
  paymentDate: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  paymentTail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  paymentValue: {
    fontSize: 15,
    fontWeight: "900",
    color: "#10B981",
  },
  watermark: { position: "absolute", bottom: 100, right: 20, opacity: 0.5 },
  summaryContainer: {
    marginBottom: 25,
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  summaryTitle: {
    fontSize: 10,
    fontWeight: "900",
    color: "#64748B",
    marginBottom: 10,
    letterSpacing: 1,
  },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  summaryCard: {
    flex: 1,
    minWidth: "30%",
    backgroundColor: "#fff",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#eee",
  },
  catLabel: {
    fontSize: 8,
    fontWeight: "900",
    color: COLORS.primary,
    marginBottom: 4,
  },
  catRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  catSub: { fontSize: 8, color: "#94A3B8", fontWeight: "600" },
  catVal: { fontSize: 9, fontWeight: "700", color: "#1E293B" },
  emptyContainer: {
    alignItems: "center",
    marginTop: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#475569",
    marginTop: 15,
  },
  emptySub: {
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 18,
  },
});
