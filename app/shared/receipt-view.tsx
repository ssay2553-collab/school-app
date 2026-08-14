import Constants from "expo-constants";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    increment,
    query,
    runTransaction,
    where
} from "firebase/firestore";
import moment from "moment";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
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
import { getSchoolLogo } from "../../constants/Logos";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { db } from "../../firebaseConfig";
import { generateFeeReceiptPDF, generateFeeStatementPDF } from "../../utils/pdfGenerator";

const { width } = Dimensions.get("window");

export default function ReceiptViewScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { appUser } = useAuth();
  const { showToast } = useToast();

  const { type, studentId, year, term, paymentId } = params;

  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<any>(null);
  const [payment, setPayment] = useState<any>(null);
  const [studentData, setStudentData] = useState<any>(null);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);

  const schoolId = (
    Constants.expoConfig?.extra?.schoolId || "school"
  ).toLowerCase();
  const schoolLogo = getSchoolLogo(schoolId);
  const primary = SCHOOL_CONFIG.primaryColor || COLORS.primary;
  const secondary = SCHOOL_CONFIG.secondaryColor || COLORS.secondary;

  useEffect(() => {
    const fetchData = async () => {
      if (!studentId) return;
      setLoading(true);
      try {
        // Fetch Student Data
        const sDoc = await getDoc(doc(db, "users", studentId as string));
        if (sDoc.exists()) setStudentData(sDoc.data());

        if (type === "bill") {
          const cleanYear = (year as string).replace(/\//g, "-");
          const cleanTerm = (term as string).replace(/\s/g, "");
          const recordId = `${studentId}_${cleanYear}_${cleanTerm}`;
          const rDoc = await getDoc(doc(db, "studentFeeRecords", recordId));
          if (rDoc.exists()) setRecord(rDoc.data());

          // Also fetch transactions for this period to ensure breakdown is accurate
          const q = query(
            collection(db, "feePayments"),
            where("studentUid", "==", studentId),
            where("academicYear", "==", year),
            where("term", "==", term),
          );
          const tSnap = await getDocs(q);
          setAllTransactions(
            tSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
          );
        } else if (type === "payment" && paymentId) {
          const pDoc = await getDoc(
            doc(db, "feePayments", paymentId as string),
          );
          if (pDoc.exists()) setPayment(pDoc.data());
        }
      } catch (err) {
        console.error("Error fetching receipt data:", err);
        showToast({ message: "Failed to load receipt details", type: "error" });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [type, studentId, year, term, paymentId]);

  const nameMap: Record<string, string> = {
    tuition: "Tuition Fees",
    pta: "PTA Dues",
    maintenance: "Maintenance Fee",
    admission: "Admission Fee",
    books: "Books Fee",
    uniform: "Uniform Fee",
    other: "Other Charges",
    arrears: "Arrears / Previous Balance",
    tuition_payment: "Tuition Payment",
    pta_payment: "PTA Dues Payment",
    maintenance_payment: "Maintenance Fee Payment",
    admission_payment: "Admission Fee Payment",
    books_payment: "Books Payment",
    uniform_payment: "Uniform Payment",
    other_payment: "Other Charges Payment",
    tuition_credit: "Tuition Credit / Overpayment",
  };

  const formatType = (rawType: string, otherCategory?: string) => {
    if (otherCategory) return otherCategory;
    if (!rawType) return "Fee Payment";
    const normalized = rawType.toLowerCase();
    if (nameMap[normalized]) return nameMap[normalized];
    return normalized
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const categorySummary = useMemo(() => {
    if (type !== "bill") return [];

    // 1. Initialize with tuition (term bill - discount) and arrears
    const summary: Record<string, { billed: number; paid: number }> = {
      tuition: {
        billed: Math.max(
          0,
          (Number(record?.termBill) || 0) - (Number(record?.discount) || 0),
        ),
        paid: 0,
      },
    };

    if (record?.arrears && Number(record.arrears) !== 0) {
      summary["arrears"] = { billed: Number(record.arrears), paid: 0 };
    }

    // 2. Aggregate Transactions for all categories
    allTransactions.forEach((t: any) => {
      const type = (t.type || "tuition").toLowerCase();
      const method = (t.method || "").toLowerCase();
      const receivedFrom = (t.receivedFrom || "").toLowerCase();

      // STRICT PAYMENT IDENTIFICATION (Aligns with reconciler.ts)
      const isPayment = (
        !(method === "bulk charge" || method === "system billing" || receivedFrom === "system billing" || method.includes("bill")) &&
        (type.endsWith("_payment") || type === "tuition" || type === "tuition_credit" || !["pta", "maintenance", "admission", "books", "uniform", "other"].includes(type) || method !== "bulk charge")
      );

      // CATEGORY NORMALIZATION (Aligns with reconciler.ts)
      let category = "tuition";
      if (type.endsWith("_payment")) {
        category = type.replace("_payment", "");
      } else if (type.endsWith("_credit")) {
        category = type.replace("_credit", "");
      } else {
        const cand = (t.type || t.category || t.purpose || t.memo || "tuition").toString().toLowerCase().trim();
        const cleaned = cand.replace(/[^a-z0-9]/g, "");
        if (cleaned.includes("pta")) category = "pta";
        else if (cleaned.includes("maintenance")) category = "maintenance";
        else if (cleaned.includes("admission")) category = "admission";
        else if (cleaned.includes("book") || cleaned.includes("books")) category = "books";
        else if (cleaned.includes("uniform")) category = "uniform";
        else if (cleaned.includes("other")) category = (t.otherCategory || "other").trim().toLowerCase();
        else category = "tuition";
      }

      if (!summary[category]) summary[category] = { billed: 0, paid: 0 };

      // Only sum payments from transactions - bills come from record or transactions
      if (isPayment) {
        if (category === "tuition" && summary["arrears"]) {
          let amt = Number(t.amount) || 0;
          const toArrears = Math.min(amt, summary["arrears"].billed - summary["arrears"].paid);
          summary["arrears"].paid += toArrears;
          summary["tuition"].paid += (amt - toArrears);
        } else {
          summary[category].paid += Number(t.amount) || 0;
        }
      } else {
        // If it's not a payment, it's a bill/charge
        summary[category].billed += Number(t.amount) || 0;
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

      // Special handling for tuition/arrears match with record.amountPaid
      const totalTuitionPaidInSummary = summary.tuition.paid + (summary.arrears?.paid || 0);
      if (record.amountPaid > totalTuitionPaidInSummary + 0.01) {
        let diff = record.amountPaid - totalTuitionPaidInSummary;
        if (summary.arrears) {
           const extraToArrears = Math.min(diff, summary.arrears.billed - summary.arrears.paid);
           summary.arrears.paid += extraToArrears;
           diff -= extraToArrears;
        }
        summary.tuition.paid += diff;
      }

      // Ensure total paid across all summary items reflects record.amountPaid + others
      // to bridge any migration gaps shown as "Historical Record" in ledger views
    }

    // Return all items with non-zero billed or paid for the statement view
    return Object.entries(summary)
      .filter(([_, vals]) => Math.abs(vals.billed) >= 0.01 || Math.abs(vals.paid) >= 0.01)
      .map(([cat, vals]) => ({
        name:
          nameMap[cat] ||
          cat.charAt(0).toUpperCase() + cat.slice(1).replace(/_/g, " "),
        billed: vals.billed,
        paid: vals.paid,
        balance: vals.billed - vals.paid,
      }));
  }, [record, allTransactions, type]);

  const totals = useMemo(() => {
    if (type !== "bill") return { billed: 0, paid: 0, balance: 0 };

    const totalBilled = categorySummary.reduce((acc, curr) => acc + curr.billed, 0);
    const totalPaid = categorySummary.reduce((acc, curr) => acc + curr.paid, 0);

    // UI/UX Consistency: Ensure the total reflects the sum of displayed line items.
    // This prevents "₵0.00" appearing when individual items show balances.
    const netBalance = totalBilled - totalPaid;

    return { billed: totalBilled, paid: totalPaid, balance: netBalance };
  }, [categorySummary, type]);


  const handleDelete = async () => {
    if (appUser?.role !== "admin") return;

    const isBill = type === "bill";
    const title = isBill ? "Delete Bill?" : "Delete Payment?";
    const message = isBill
      ? "This will remove the term record and reset all balances for this period. Are you sure?"
      : "This will remove the payment and update the student's debt balance. This cannot be undone.";

    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setLoading(true);
          try {
            if (isBill) {
              const cleanYear = (year as string).replace(/\//g, "-");
              const cleanTerm = (term as string).replace(/\s/g, "");
              const recordId = `${studentId}_${cleanYear}_${cleanTerm}`;
              await deleteDoc(doc(db, "studentFeeRecords", recordId));
              showToast({
                message: "Bill record deleted successfully",
                type: "success",
              });
            } else {
              // Atomic transaction to delete payment and revert balance
              await runTransaction(db, async (transaction) => {
                const pDocRef = doc(db, "feePayments", paymentId as string);
                const pSnap = await transaction.get(pDocRef);
                if (!pSnap.exists()) throw "Payment not found";

                const pData = pSnap.data();
                const amt = Number(pData.amount) || 0;
                const pType = (pData.type || "tuition").toLowerCase();
                const cleanYear = (pData.academicYear as string).replace(
                  /\//g,
                  "-",
                );
                const cleanTerm = (pData.term as string).replace(/\s/g, "");
                const recordId = `${studentId}_${cleanYear}_${cleanTerm}`;

                // 1. Revert Global Wallet Balance
                const userRef = doc(db, "users", studentId as string);
                transaction.update(userRef, {
                  walletBalance: increment(amt),
                });

                // 2. Revert Term Record Balance
                const rRef = doc(db, "studentFeeRecords", recordId);
                const rSnap = await transaction.get(rRef);

                if (rSnap.exists()) {
                  const updateData: any = {};
                  if (
                    pType === "tuition" ||
                    pType === "tuition_payment" ||
                    pType === "tuition_credit"
                  ) {
                    updateData.amountPaid = increment(-amt);
                    updateData.balance = increment(amt);
                  } else {
                    const cat = pType.replace("_payment", "");
                    updateData[`${cat}Paid`] = increment(-amt);
                    updateData[`${cat}Balance`] = increment(amt);
                  }
                  transaction.update(rRef, updateData);
                }

                // 3. Delete the actual payment
                transaction.delete(pDocRef);
              });
              showToast({
                message: "Payment deleted and balance reverted",
                type: "success",
              });
            }
            router.back();
          } catch (err) {
            console.error("Delete error:", err);
            showToast({ message: "Failed to delete record", type: "error" });
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const generatePDF = async () => {
    const sName = studentData
      ? `${studentData.profile?.firstName || ""} ${studentData.profile?.lastName || ""}`.trim()
      : "Student";

    try {
      if (type === "bill") {
        await generateFeeStatementPDF(
          {
            studentName: sName,
            studentClass: studentData?.className || "N/A",
            academicYear: (year || record?.academicYear) as string,
            term: (term || record?.term) as string,
            categorySummary: categorySummary.map((i) => ({
              name: i.name,
              billed: i.billed,
              paid: i.paid,
              balance: i.balance,
            })),
            totals: {
              billed: totals.billed,
              paid: totals.paid,
              balance: totals.balance,
            },
            discount: Number(record?.discount) || 0,
            currencySymbol: SCHOOL_CONFIG.currencySymbol,
          },
          SCHOOL_CONFIG.fullName,
          SCHOOL_CONFIG.hotline,
          SCHOOL_CONFIG.email,
          SCHOOL_CONFIG.address,
          SCHOOL_CONFIG.motto,
          getSchoolLogo(SCHOOL_CONFIG.schoolId),
        );
      } else if (payment) {
        await generateFeeReceiptPDF(
          {
            studentName: sName,
            studentClass: studentData?.className || "N/A",
            academicYear: (year || record?.academicYear) as string,
            term: (term || record?.term) as string,
            receiptNo: payment.receiptNo || paymentId,
            date: moment(payment.createdAt || payment.timestamp?.toDate()).format(
              "DD/MM/YYYY hh:mm A",
            ),
            category: formatType(payment.type, payment.otherCategory),
            amount: Number(payment.amount) || 0,
            method: payment.method || "CASH",
            receivedFrom: payment.receivedFrom || "SELF",
            processedBy: payment.updatedBy || "ADMIN",
            currencySymbol: SCHOOL_CONFIG.currencySymbol,
          },
          SCHOOL_CONFIG.fullName,
          SCHOOL_CONFIG.hotline,
          SCHOOL_CONFIG.email,
          SCHOOL_CONFIG.address,
          SCHOOL_CONFIG.motto,
          getSchoolLogo(SCHOOL_CONFIG.schoolId),
        );
      }
    } catch (e) {
      console.error("PDF generation error:", e);
      showToast({ message: "Failed to generate PDF", type: "error" });
    }
  };

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={primary} />
      </View>
    );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[primary, secondary]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <SVGIcon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {type === "bill" ? "Fee Statement" : "Payment Receipt"}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {appUser?.role === "admin" && (
              <TouchableOpacity
                onPress={handleDelete}
                style={[
                  styles.printBtn,
                  { backgroundColor: "rgba(255,50,50,0.3)" },
                ]}
              >
                <SVGIcon name="trash" size={22} color="#fff" />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={generatePDF} style={styles.printBtn}>
              <SVGIcon name="download" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content}>
        <Animatable.View animation="fadeInUp" style={styles.receiptCard}>
          <View style={[styles.cardHeader, { flexDirection: "row-reverse" }]}>
            <Image
              source={schoolLogo}
              style={[styles.logo, { marginRight: 0, marginLeft: 15 }]}
              resizeMode="contain"
            />
            <View style={{ flex: 1, alignItems: "flex-end" }}>
              <Text style={[styles.schoolName, { color: primary, textAlign: "right" }]}>
                {SCHOOL_CONFIG.fullName.toUpperCase()}
              </Text>
              {SCHOOL_CONFIG.motto ? (
                <Text style={[styles.schoolMotto, { textAlign: "right" }]}>"{SCHOOL_CONFIG.motto}"</Text>
              ) : null}
              <Text style={[styles.schoolContactText, { textAlign: "right" }]}>
                {SCHOOL_CONFIG.address}
              </Text>
              <Text style={[styles.schoolContactText, { textAlign: "right" }]}>
                {SCHOOL_CONFIG.hotline}{" "}
                {SCHOOL_CONFIG.email ? ` | ${SCHOOL_CONFIG.email}` : ""}
              </Text>
            </View>
          </View>
          <View style={[styles.typeBadge, { alignSelf: "flex-end", backgroundColor: primary + "10" }]}>
            <Text style={[styles.receiptType, { color: primary }]}>
              {type === "bill" ? "OFFICIAL FEE STATEMENT" : "OFFICIAL PAYMENT RECEIPT"}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>STUDENT</Text>
              <Text style={styles.value}>
                {studentData
                  ? `${studentData.profile?.firstName || ""} ${studentData.profile?.lastName || ""}`
                  : "Student"}
              </Text>
              <Text style={styles.subValue}>
                {studentData?.className || "Class N/A"}
              </Text>
            </View>
            <View style={{ flex: 1, alignItems: "flex-end" }}>
              <Text style={styles.label}>
                {type === "bill" ? "STATEMENT DATE" : "PAYMENT DATE"}
              </Text>
              <Text style={styles.value}>
                {moment(
                  type === "payment" ? (payment?.createdAt || payment?.timestamp?.toDate()) : undefined,
                ).format("DD/MM/YYYY")}
              </Text>
              <Text style={styles.subValue}>
                {moment(
                  type === "payment" ? (payment?.createdAt || payment?.timestamp?.toDate()) : undefined,
                ).format("hh:mm A")}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>ACADEMIC PERIOD</Text>
              <Text style={styles.value}>{term || record?.term}</Text>
              <Text style={styles.subValue}>
                {year || record?.academicYear}
              </Text>
            </View>
            {type === "payment" && (
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <Text style={styles.label}>RECEIPT #</Text>
                <Text style={[styles.value, { color: primary }]}>
                  #{payment?.receiptNo || "N/A"}
                </Text>
              </View>
            )}
          </View>

          <View
            style={[
              styles.mainSection,
              { backgroundColor: type === "bill" ? "#F8FAFC" : "#F0FDF4" },
            ]}
          >
            {type === "bill" ? (
              <>
                <View style={styles.tableHeader}>
                  <Text style={[styles.th, { flex: 2.2 }]}>DESCRIPTION</Text>
                  <Text style={[styles.th, { flex: 1.2, textAlign: "right" }]}>
                    BILLED
                  </Text>
                  <Text style={[styles.th, { flex: 1.2, textAlign: "right" }]}>
                    PAID
                  </Text>
                  <Text style={[styles.th, { flex: 1.2, textAlign: "right" }]}>
                    BALANCE
                  </Text>
                </View>
                {categorySummary.length > 0 ? (
                  categorySummary.map((item, idx) => (
                    <View key={idx} style={styles.itemRow}>
                      <Text style={[styles.itemName, { flex: 2.2 }]}>
                        {item.name.toUpperCase()}
                      </Text>
                      <Text
                        style={[
                          styles.itemVal,
                          { flex: 1.2, textAlign: "right" },
                        ]}
                      >
                        {SCHOOL_CONFIG.currencySymbol}{item.billed.toFixed(2)}
                      </Text>
                      <Text
                        style={[
                          styles.itemVal,
                          { flex: 1.2, textAlign: "right", color: "#10B981" },
                        ]}
                      >
                        {SCHOOL_CONFIG.currencySymbol}{item.paid.toFixed(2)}
                      </Text>
                      <Text
                        style={[
                          styles.itemVal,
                          { flex: 1.2, textAlign: "right", fontWeight: "900", color: item.balance > 0 ? "#EF4444" : "#10B981" },
                        ]}
                      >
                        {SCHOOL_CONFIG.currencySymbol}{item.balance.toFixed(2)}
                      </Text>
                    </View>
                  ))
                ) : (
                  <View style={{ paddingVertical: 20, alignItems: "center" }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "700",
                        color: "#10B981",
                      }}
                    >
                      ALL FEES PAID FOR THIS TERM
                    </Text>
                  </View>
                )}

                {record?.discount > 0 && (
                  <View style={[styles.itemRow, { backgroundColor: '#F0FDFA', borderBottomColor: '#CCFBF1' }]}>
                    <Text style={[styles.itemName, { flex: 2.2, color: '#0D9488' }]}>
                      TERM DISCOUNT
                    </Text>
                    <Text
                      style={[
                        styles.itemVal,
                        { flex: 1.2, textAlign: "right", color: '#0D9488' },
                      ]}
                    >
                      ({SCHOOL_CONFIG.currencySymbol}{Number(record.discount).toFixed(2)})
                    </Text>
                    <Text
                      style={[
                        styles.itemVal,
                        { flex: 1.2, textAlign: "right", color: '#0D9488' },
                      ]}
                    >
                      -
                    </Text>
                    <Text
                      style={[
                        styles.itemVal,
                        { flex: 1.2, textAlign: "right", fontWeight: "900", color: '#0D9488' },
                      ]}
                    >
                      CREDIT
                    </Text>
                  </View>
                )}
                <View style={styles.totalSection}>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>TOTAL BILLED</Text>
                    <Text style={styles.totalValue}>
                      {SCHOOL_CONFIG.currencySymbol}{totals.billed.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>TOTAL PAID</Text>
                    <Text style={[styles.totalValue, { color: "#10B981" }]}>
                      {SCHOOL_CONFIG.currencySymbol}{totals.paid.toFixed(2)}
                    </Text>
                  </View>
                  <View style={[styles.totalRow, styles.grandTotal]}>
                    <Text style={styles.grandLabel}>NET BALANCE DUE</Text>
                    <Text style={[styles.grandValue, { color: totals.balance > 0 ? "#EF4444" : "#10B981" }]}>
                      {SCHOOL_CONFIG.currencySymbol}{totals.balance.toFixed(2)}
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.sectionTitle}>TRANSACTION SUMMARY</Text>
                <View style={styles.receiptDetailRow}>
                  <Text style={styles.receiptDetailLabel}>Category</Text>
                  <Text style={styles.receiptDetailValue}>
                    {formatType(payment?.type, payment?.otherCategory)}
                  </Text>
                </View>
                <View style={styles.receiptDetailRow}>
                  <Text style={styles.receiptDetailLabel}>Amount Paid</Text>
                  <Text
                    style={[
                      styles.receiptDetailValue,
                      { color: "#10B981", fontSize: 20, fontWeight: "900" },
                    ]}
                  >
                    {SCHOOL_CONFIG.currencySymbol}{Number(payment?.amount || 0).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.receiptDetailRow}>
                  <Text style={styles.receiptDetailLabel}>Method</Text>
                  <Text style={styles.receiptDetailValue}>
                    {payment?.method?.toUpperCase() || "CASH"}
                  </Text>
                </View>
                <View style={styles.receiptDetailRow}>
                  <Text style={styles.receiptDetailLabel}>Received From</Text>
                  <Text style={styles.receiptDetailValue}>
                    {payment?.receivedFrom?.toUpperCase() || "SELF"}
                  </Text>
                </View>
                <View style={styles.receiptDetailRow}>
                  <Text style={styles.receiptDetailLabel}>Attendant</Text>
                  <Text style={styles.receiptDetailValue}>
                    {payment?.updatedBy?.toUpperCase() || "STAFF"}
                  </Text>
                </View>

                <View style={styles.thankYouBox}>
                  <Text style={styles.thankYouText}>
                    Thank you for your prompt payment! We truly appreciate your support.
                  </Text>
                </View>
              </>
            )}
          </View>

          <View style={styles.footer}>
            <SVGIcon
              name="checkmark-done-circle"
              size={40}
              color={type === "bill" ? "#FCA5A5" : "#86EFAC"}
            />
            <Text style={styles.footerText}>Verified Official Document</Text>
          </View>
        </Animatable.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    paddingBottom: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    ...SHADOWS.medium,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 10 : 40,
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
  printBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  content: { padding: 20 },
  receiptCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 25,
    ...SHADOWS.large,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  logo: { width: 70, height: 70, marginRight: 15 },
  schoolName: { fontSize: 18, fontWeight: "900", marginBottom: 2 },
  schoolMotto: {
    fontSize: 10,
    fontStyle: "italic",
    color: "#64748B",
    marginBottom: 4,
    fontWeight: "600",
  },
  schoolContactText: {
    fontSize: 10,
    color: "#475569",
    fontWeight: "500",
    lineHeight: 14,
  },
  typeBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 6,
  },
  receiptType: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 1,
  },
  divider: { height: 1, backgroundColor: "#E2E8F0", marginVertical: 15 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  label: { fontSize: 9, fontWeight: "900", color: "#94A3B8", marginBottom: 4 },
  value: { fontSize: 14, fontWeight: "800", color: "#1E293B" },
  subValue: { fontSize: 10, color: "#64748B", fontWeight: "600" },
  mainSection: {
    padding: 18,
    borderRadius: 20,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: "#64748B",
    marginBottom: 20,
    textAlign: "center",
    letterSpacing: 2,
    textTransform: "uppercase",
  },

  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#CBD5E1",
    paddingBottom: 8,
    marginBottom: 10,
  },
  th: { fontSize: 9, fontWeight: "900", color: "#475569" },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.03)",
  },
  itemName: { fontSize: 11, fontWeight: "700", color: "#475569" },
  itemVal: { fontSize: 11, fontWeight: "600", color: "#1E293B" },

  totalSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: "#1E293B",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  totalLabel: { fontSize: 10, fontWeight: "800", color: "#64748B" },
  totalValue: { fontSize: 12, fontWeight: "700", color: "#1E293B" },
  grandTotal: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderStyle: "dashed",
    borderTopColor: "#CBD5E1",
  },
  grandLabel: { fontSize: 13, fontWeight: "900", color: "#1E293B" },
  grandValue: { fontSize: 16, fontWeight: "900", color: "#1E293B" },

  receiptDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  receiptDetailLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#166534",
    textTransform: "uppercase",
  },
  receiptDetailValue: { fontSize: 13, fontWeight: "700", color: "#14532d" },
  thankYouBox: {
    marginTop: 20,
    padding: 15,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#BBF7D0",
    borderRadius: 12,
    alignItems: "center",
  },
  thankYouText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#166534",
    fontStyle: "italic",
  },

  footer: { marginTop: 30, alignItems: "center", gap: 8 },
  footerText: { fontSize: 10, fontWeight: "700", color: "#94A3B8" },
});
