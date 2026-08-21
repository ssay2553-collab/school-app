import { Picker } from "@react-native-picker/picker";
import { LinearGradient } from "expo-linear-gradient";
import moment from "moment";
import {
    ActivityIndicator,
    Platform,
    RefreshControl,
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
import { useAcademicConfig } from "../../hooks/useAcademicConfig";
import { useParentFeeHistory } from "../../hooks/useParentFeeHistory";

export default function StudentFeeHistory() {
  const acadConfig = useAcademicConfig();
  const {
    selectedYear,
    setSelectedYear,
    selectedTerm,
    setSelectedTerm,
    record,
    loading,
    fetchingRecord,
    categorySummary,
    totals,
    availableYears,
    showFullHistory,
    setShowFullHistory,
    refreshing,
    refresh,
    children,
    selectedChildId,
    setSelectedChildId,
    paymentLedgerEntries,
    ledgerSummary,
    handleBack,
    router,
  } = useParentFeeHistory();

  const primary = SCHOOL_CONFIG.primaryColor || COLORS.primary;
  const secondary = SCHOOL_CONFIG.secondaryColor || COLORS.secondary;
  const { totalBilled, totalPaid, totalBalance } = totals;

  if (loading || (selectedChildId && fetchingRecord && !record))
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
            onPress={handleBack}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            colors={[primary]}
            tintColor={primary}
          />
        }
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

            {/* Financial Statement Table */}
            <View style={styles.invoiceTable}>
              <View style={styles.invoiceHeader}>
                <Text style={[styles.invoiceTh, { flex: 2 }]}>DESCRIPTION</Text>
                <Text style={[styles.invoiceTh, { flex: 1.2, textAlign: 'right' }]}>BILLED</Text>
                <Text style={[styles.invoiceTh, { flex: 1.2, textAlign: 'right' }]}>PAID</Text>
                <Text style={[styles.invoiceTh, { flex: 1.2, textAlign: 'right' }]}>BALANCE</Text>
              </View>
              {Object.entries(categorySummary)
                .sort(([a], [b]) => {
                  if (a === 'arrears') return -1;
                  if (b === 'arrears') return 1;
                  if (a === 'tuition') return -1;
                  if (b === 'tuition') return 1;
                  return a.localeCompare(b);
                })
                .map(([cat, vals]: any) => {
                  const balance = (vals.billed || 0) - (vals.paid || 0);
                  return (
                    <View key={cat} style={[styles.invoiceRow, cat === 'arrears' && { backgroundColor: '#FFF7ED' }]}>
                      <Text style={[styles.invoiceTd, { flex: 2, fontWeight: '700', fontSize: 10, color: cat === 'arrears' ? '#C2410C' : '#1E293B' }]}>
                        {cat === 'arrears' ? 'PREVIOUS ARREARS' : cat.toUpperCase()}
                      </Text>
                      <Text style={[styles.invoiceTd, { flex: 1.2, textAlign: 'right' }]}>{SCHOOL_CONFIG.currencySymbol}{vals.billed.toFixed(2)}</Text>
                      <Text style={[styles.invoiceTd, { flex: 1.2, textAlign: 'right', color: "#10B981" }]}>{SCHOOL_CONFIG.currencySymbol}{vals.paid.toFixed(2)}</Text>
                      <Text style={[styles.invoiceTd, { flex: 1.2, textAlign: 'right', color: balance > 0 ? "#EF4444" : "#10B981", fontWeight: '700' }]}>
                        {SCHOOL_CONFIG.currencySymbol}{balance.toFixed(2)}
                      </Text>
                    </View>
                  );
                })}

              {/* Added Discount Row */}
              {record.discount > 0 && (
                <View style={[styles.invoiceRow, { backgroundColor: '#F0FDFA' }]}>
                  <Text style={[styles.invoiceTd, { flex: 2, fontWeight: '700', fontSize: 10, color: '#0D9488' }]}>TERM DISCOUNT</Text>
                  <Text style={[styles.invoiceTd, { flex: 1.2, textAlign: 'right', color: '#0D9488' }]}>({SCHOOL_CONFIG.currencySymbol}{record.discount.toFixed(2)})</Text>
                  <Text style={[styles.invoiceTd, { flex: 1.2, textAlign: 'right' }]}>-</Text>
                  <Text style={[styles.invoiceTd, { flex: 1.2, textAlign: 'right', color: '#0D9488', fontWeight: '700' }]}>CREDIT</Text>
                </View>
              )}
            </View>

            {/* Summary */}
            <View style={styles.totalsSection}>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>TOTAL BILLED:</Text>
                <Text style={styles.totalsValue}>
                  {SCHOOL_CONFIG.currencySymbol} {totalBilled.toFixed(2)}
                </Text>
              </View>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>TOTAL PAID:</Text>
                <Text style={[styles.totalsValue, { color: "#10B981" }]}>
                  {SCHOOL_CONFIG.currencySymbol} {totalPaid.toFixed(2)}
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
                  {SCHOOL_CONFIG.currencySymbol} {totalBalance.toFixed(2)}
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
              <TouchableOpacity
                style={[styles.childChip, { marginTop: 20, backgroundColor: primary, borderColor: primary }]}
                onPress={refresh}
              >
                <Text style={[styles.childChipText, { color: '#fff' }]}>TRY REFRESHING</Text>
              </TouchableOpacity>
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
                      {SCHOOL_CONFIG.currencySymbol}{ledgerSummary.totalPaid.toFixed(2)}
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
                          paymentId: payment.receiptNo || payment.id,
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
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <Text style={styles.paymentLabel}>
                            {payment._title}
                            {payment._installmentLabel
                              ? ` • ${payment._installmentLabel}`
                              : ""}
                          </Text>
                          <View
                            style={{
                              backgroundColor: payment._isPayment
                                ? "#ECFDF5"
                                : "#FEF2F2",
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderRadius: 6,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 8,
                                fontWeight: "900",
                                color: payment._isPayment
                                  ? "#10B981"
                                  : "#EF4444",
                              }}
                            >
                              {payment._isPayment ? "PAYMENT" : "BILL"}
                            </Text>
                          </View>
                        </View>
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
                      <Text
                        style={[
                          styles.paymentValue,
                          !payment._isPayment && { color: "#EF4444" },
                        ]}
                      >
                        {SCHOOL_CONFIG.currencySymbol}{Number(payment.amount || 0).toFixed(2)}
                      </Text>
                      <SVGIcon
                        name="chevron-forward"
                        size={16}
                        color="#94A3B8"
                      />
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
    minHeight: 65,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 12,
    paddingTop: 12,
    position: "relative",
  },
  picker: { height: 45, color: "#fff", width: '100%', marginLeft: -10 },
  miniLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "rgba(255,255,255,0.8)",
    position: "absolute",
    top: 12,
    left: 14,
    zIndex: 1,
    letterSpacing: 0.5,
    textTransform: 'uppercase'
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
