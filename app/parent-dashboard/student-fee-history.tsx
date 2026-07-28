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
    View,
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
  const [showFullHistory, setShowFullHistory] = useState(false);

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
    if (!selectedChildId) return;
    if (!showFullHistory && (!selectedYear || !selectedTerm)) return;

    setFetchingRecord(true);
    // Clear previous state to avoid leakage
    setRecord(null);
    setAllTransactions([]);

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
      },
    );

    let q;
    if (showFullHistory) {
      q = query(
        collection(db, "feePayments"),
        where("studentUid", "==", selectedChildId)
      );
    } else {
      q = query(
        collection(db, "feePayments"),
        where("studentUid", "==", selectedChildId),
        where("academicYear", "==", selectedYear),
        where("term", "==", selectedTerm),
      );
    }

    const unsubTransactions = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAllTransactions(list);
        setFetchingRecord(false);
      },
      (err) => {
        console.warn("Transactions listener failed:", err);
        setFetchingRecord(false);
      },
    );

    return () => {
      unsubRecord();
      unsubTransactions();
    };
  }, [selectedChildId, selectedYear, selectedTerm, showFullHistory]);

  const ledgerTransactions = useMemo(() => {
    const merged = [...allTransactions];
    const existingIds = new Set<string>(allTransactions.map((t: any) => String(t.receiptNo || t.id)));

    // If not in full history mode, ensure the ledger list matches the record summary
    if (!showFullHistory && record) {
      const categories = [
        { key: 'tuition', paid: record.amountPaid || 0 },
        { key: 'pta', paid: record.ptaPaid || 0 },
        { key: 'maintenance', paid: record.maintenancePaid || 0 },
        { key: 'admission', paid: record.admissionPaid || 0 },
        { key: 'books', paid: record.booksPaid || 0 },
        { key: 'uniform', paid: record.uniformPaid || 0 },
        { key: 'other', paid: record.otherPaid || 0 },
      ];

      categories.forEach(cat => {
        const currentCatSum = merged.reduce((sum: number, t: any) => {
          const type = (t.type || "tuition").toLowerCase();
          const category = type.replace("_payment", "").replace("_credit", "");
          const isPayment = type.endsWith("_payment") || type === "tuition" || type === "tuition_credit";
          return (category === cat.key && isPayment) ? sum + (Number(t.amount) || 0) : sum;
        }, 0);

        if (cat.paid > currentCatSum + 0.01) {
          merged.push({
            id: `adjustment-${cat.key}`,
            amount: cat.paid - currentCatSum,
            type: cat.key === 'tuition' ? 'tuition' : `${cat.key}_payment`,
            receiptNo: `ADJ-${cat.key.toUpperCase()}`,
            date: record.createdAt || moment().format("YYYY-MM-DD"),
            academicYear: selectedYear,
            term: selectedTerm,
            receivedFrom: "Historical Record",
            method: "Migration",
            isAdjustment: true,
          });
        }
      });
    }

    return merged.sort((a: any, b: any) => {
      const dateA = a.createdAt || a.timestamp?.toDate?.() || a.date || 0;
      const dateB = b.createdAt || b.timestamp?.toDate?.() || b.date || 0;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  }, [allTransactions, record, showFullHistory, selectedYear, selectedTerm]);

  const paymentLedgerEntries = useMemo(() => {
    return ledgerTransactions
      .map((payment: any, index: number) => {
        const timestampValue =
          payment.createdAt ||
          payment.timestamp?.toDate?.() ||
          payment.date ||
          payment.paymentDate ||
          payment.timestamp;
        const parsedDate = moment(timestampValue);
        const installmentSource =
          payment.installmentLabel ||
          payment.installmentName ||
          payment.installment ||
          payment.installmentNo ||
          payment.installmentNumber;
        const installmentLabel =
          installmentSource !== undefined && installmentSource !== ""
            ? String(installmentSource)
            : payment.isInstallment || payment.paymentPlan
              ? `Installment ${index + 1}`
              : null;

        return {
          ...payment,
          _title:
            payment.otherCategory?.toUpperCase() ||
            payment.type
              ?.replace("_payment", "")
              .replace("_", " ")
              .toUpperCase() ||
            "FEE PAYMENT",
          _installmentLabel: installmentLabel,
          _displayDate: parsedDate.isValid()
            ? parsedDate.format("MMM DD, YYYY")
            : "Pending",
          _displayTime: parsedDate.isValid() ? parsedDate.format("h:mm A") : "",
          _method: payment.method || payment.paymentMethod || "Cash",
          _receivedFrom:
            payment.receivedFrom ||
            payment.paidBy ||
            payment.customerName ||
            "School account",
        };
      })
      .sort((a: any, b: any) => {
        const aTime = new Date(
          a.createdAt || a.timestamp?.toDate?.() || a.date || 0,
        ).getTime();
        const bTime = new Date(
          b.createdAt || b.timestamp?.toDate?.() || b.date || 0,
        ).getTime();
        return bTime - aTime;
      });
  }, [ledgerTransactions]);

  const ledgerSummary = useMemo(() => {
    const totalPaid = paymentLedgerEntries.reduce(
      (sum, payment: any) => sum + (Number(payment.amount) || 0),
      0,
    );
    const installmentCount =
      paymentLedgerEntries.filter((payment: any) => payment._installmentLabel)
        .length || paymentLedgerEntries.length;
    const lastPayment = paymentLedgerEntries[0];

    return {
      totalPaid,
      installmentCount,
      lastPaymentDate: lastPayment?._displayDate || "No payments yet",
    };
  }, [paymentLedgerEntries]);

  const rawSummary = useMemo(() => {
    // 1. Initialize with tuition (term bill - discount) and arrears
    const summary: Record<string, { billed: number; paid: number }> = {
      tuition: {
        billed: Math.max(0, (record?.termBill || 0) - (record?.discount || 0)),
        paid: 0,
      },
    };

    if (record?.arrears > 0) {
      summary["arrears"] = { billed: record.arrears, paid: 0 };
    }

    // 2. Aggregate Transactions for all categories - Filtered by current selection
    // We only want to count payments that belong to THIS specific bill period in the summary table
    const relevantTransactions = allTransactions.filter((t: any) =>
      t.academicYear === selectedYear && t.term === selectedTerm
    );

    relevantTransactions.forEach((t: any) => {
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
        if (category === "tuition" && summary["arrears"]) {
          // If there are arrears, apply tuition payment to arrears first for display logic
          let amt = t.amount || 0;
          const toArrears = Math.min(amt, summary["arrears"].billed - summary["arrears"].paid);
          summary["arrears"].paid += toArrears;
          summary["tuition"].paid += (amt - toArrears);
        } else {
          summary[category].paid += t.amount || 0;
        }
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
          bill: record.booksBill || 0, paid: record.booksPaid || 0 },
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

      // Special handling for tuition/arrears match with record.amountPaid
      // record.amountPaid is total tuition paid (incl arrears)
      const totalTuitionPaidInSummary = summary.tuition.paid + (summary.arrears?.paid || 0);
      if (record.amountPaid > totalTuitionPaidInSummary) {
        let diff = record.amountPaid - totalTuitionPaidInSummary;
        if (summary.arrears) {
           const extraToArrears = Math.min(diff, summary.arrears.billed - summary.arrears.paid);
           summary.arrears.paid += extraToArrears;
           diff -= extraToArrears;
        }
        summary.tuition.paid += diff;
      }

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
              "arrears"
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
        summary["other"].paid = Math.max(
          summary["other"].paid,
          record.otherPaid || 0,
        );
      }
    }
    return summary;
  }, [allTransactions, record, selectedYear, selectedTerm]);

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

            {totalBalance <= 0 && (
              <Animatable.View
                animation="bounceIn"
                style={styles.celebrationBox}
              >
                <SVGIcon name="checkmark-done-circle" size={24} color="#059669" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.celebrationTitle}>Balance Cleared!</Text>
                  <Text style={styles.celebrationSub}>
                    Thank you for your promptness. Your account is fully settled for this term!
                  </Text>
                </View>
              </Animatable.View>
            )}

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

        {/* Payment Ledger for Parents */}
        {selectedChildId && (paymentLedgerEntries.length > 0 || showFullHistory) && (
          <View style={styles.historyContainer}>
            <View style={styles.ledgerHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyTitle}>
                  {showFullHistory ? "ALL PAYMENTS" : "PAYMENT LEDGER"}
                </Text>
                <Text style={styles.ledgerCaption}>
                  {showFullHistory
                    ? "Full transaction history for this student"
                    : "Installments and payment history for this term"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowFullHistory(!showFullHistory)}
                style={[
                  styles.ledgerBadge,
                  showFullHistory && { backgroundColor: primary },
                ]}
              >
                <Text
                  style={[
                    styles.ledgerBadgeText,
                    showFullHistory && { color: "#fff" },
                  ]}
                >
                  {showFullHistory ? "View Term Only" : "View All"}
                </Text>
              </TouchableOpacity>
            </View>

            {paymentLedgerEntries.length > 0 ? (
              <>
                <View style={styles.ledgerSummaryCard}>
                  <View style={styles.ledgerSummaryItem}>
                    <Text style={styles.ledgerSummaryLabel}>
                      {showFullHistory ? "LIFETIME PAID" : "TOTAL PAID"}
                    </Text>
                    <Text style={styles.ledgerSummaryValue}>
                      ₵{ledgerSummary.totalPaid.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.ledgerSummaryItem}>
                    <Text style={styles.ledgerSummaryLabel}>LAST PAYMENT</Text>
                    <Text style={styles.ledgerSummaryValue}>
                      {ledgerSummary.lastPaymentDate}
                    </Text>
                  </View>
                </View>

                {paymentLedgerEntries.map((payment: any, idx: number) => (
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
                          year: payment.academicYear || selectedYear,
                          term: payment.term || selectedTerm,
                        },
                      });
                    }}
                  >
                    <View style={styles.paymentLead}>
                      <View style={styles.iconCircle}>
                        <SVGIcon name="receipt" size={20} color={primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.paymentLabel}>
                          {payment._title}
                          {payment._installmentLabel
                            ? ` • ${payment._installmentLabel}`
                            : ""}
                        </Text>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Text style={styles.paymentDate}>
                            {payment._displayDate}
                          </Text>
                          {showFullHistory && (
                            <View style={styles.miniBadge}>
                              <Text style={styles.miniBadgeText}>
                                {payment.academicYear} • {payment.term}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.paymentMeta}>
                          {payment._method}
                          {payment.receiptNo ? ` • ${payment.receiptNo}` : ""}
                          {" • "}
                          {payment._receivedFrom}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.paymentTail}>
                      <Text style={styles.paymentValue}>
                        ₵{Number(payment.amount || 0).toFixed(2)}
                      </Text>
                      <SVGIcon name="chevron-forward" size={16} color="#94A3B8" />
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            ) : (
              <View style={styles.emptyLedger}>
                <Text style={styles.emptyLedgerText}>
                  No payments recorded for this period.
                </Text>
              </View>
            )}
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

  celebrationBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#10B981",
    borderRadius: 12,
    padding: 15,
    marginTop: 20,
    gap: 12,
  },
  celebrationTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#065F46",
  },
  celebrationSub: {
    fontSize: 11,
    fontWeight: "600",
    color: "#047857",
    marginTop: 2,
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
  ledgerHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    gap: 10,
  },
  historyTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#64748B",
    letterSpacing: 1,
  },
  ledgerCaption: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 4,
  },
  ledgerBadge: {
    backgroundColor: "#E0F2FE",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ledgerBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: COLORS.primary,
  },
  ledgerSummaryCard: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    marginBottom: 12,
    gap: 12,
  },
  ledgerSummaryItem: {
    flex: 1,
  },
  ledgerSummaryLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.8,
  },
  ledgerSummaryValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 4,
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
  paymentMeta: {
    fontSize: 10,
    color: "#94A3B8",
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
  miniBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: "#E2E8F0",
  },
  miniBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#475569",
  },
  emptyLedger: {
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
  },
  emptyLedgerText: {
    color: "#94A3B8",
    fontSize: 13,
  },
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
