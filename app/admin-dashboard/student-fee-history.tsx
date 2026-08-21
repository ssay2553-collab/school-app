import DateTimePicker from "@react-native-community/datetimepicker";
import moment from "moment";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import LedgerFilters from "../../components/admin-dashboard/fee-history/LedgerFilters";
import LedgerReceipt from "../../components/admin-dashboard/fee-history/LedgerReceipt";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useStudentFeeHistory } from "../../hooks/admin-dashboard/useStudentFeeHistory";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";

export default function StudentFeeHistoryScreen() {
  const acadConfig = useAcademicConfig();
  const {
    classes,
    students,
    selectedYear,
    setSelectedYear,
    selectedTerm,
    setSelectedTerm,
    selectedClassId,
    setSelectedClassId,
    selectedStudentUid,
    setSelectedStudentUid,
    record,
    loading,
    fetchingStudents,
    fetchingRecord,
    saving,
    deleting,
    categorySummary,
    totals,
    availableYears,
    showFullHistory,
    setShowFullHistory,
    refreshing,
    refresh,
    router,
    paymentModalVisible,
    setPaymentModalVisible,
    paymentAmount,
    setPaymentAmount,
    receivedFrom,
    setReceivedFrom,
    paymentDate,
    setPaymentDate,
    showDatePicker,
    setShowDatePicker,
    paymentMethod,
    setPaymentMethod,
    searchQuery,
    setSearchQuery,
    paymentLedgerEntries,
    ledgerSummary,
    onLogPayment,
    handleBack,
    onRevertPayment,
  } = useStudentFeeHistory();

  const primary = SCHOOL_CONFIG.primaryColor || COLORS.primary;
  const secondary = SCHOOL_CONFIG.secondaryColor || COLORS.secondary;

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={primary} />
      </View>
    );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View
        style={StyleSheet.flatten([
          styles.navBar,
          { backgroundColor: primary },
        ])}
      >
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backIcon}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <SVGIcon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Fee Ledger</Text>
        <TouchableOpacity
          onPress={() => setPaymentModalVisible(true)}
          disabled={!selectedStudentUid}
          style={styles.paymentIcon}
        >
          <SVGIcon
            name="cash"
            size={24}
            color={selectedStudentUid ? "#fff" : "rgba(255,255,255,0.3)"}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            colors={[primary]}
            tintColor={primary}
          />
        }
      >
        <LedgerFilters
          availableYears={availableYears}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          selectedTerm={selectedTerm}
          setSelectedTerm={setSelectedTerm}
          classes={classes}
          selectedClassId={selectedClassId}
          setSelectedClassId={setSelectedClassId}
          students={students}
          selectedStudentUid={selectedStudentUid}
          setSelectedStudentUid={setSelectedStudentUid}
          fetchingStudents={fetchingStudents}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          primary={primary}
          secondary={secondary}
          acadConfig={acadConfig}
        />

        <View style={styles.mainContent}>
          {fetchingRecord || deleting ? (
            <ActivityIndicator
              size="large"
              color={primary}
              style={{ marginTop: 50 }}
            />
          ) : record ? (
            <LedgerReceipt
              record={record}
              categorySummary={categorySummary}
              totalBilled={totals.totalBilled}
              totalPaid={totals.totalPaid}
              totalBalance={totals.totalBalance}
              selectedStudentUid={selectedStudentUid}
              selectedYear={selectedYear}
              selectedTerm={selectedTerm}
              primary={primary}
              router={router}
            />
          ) : (
            selectedStudentUid && (
              <View style={styles.emptyState}>
                <SVGIcon name="alert-circle" size={64} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>No record found</Text>
                <Text style={styles.emptySub}>
                  No financial data for the selected period.
                </Text>
                <TouchableOpacity
                  style={[styles.saveBtn, { marginTop: 20, height: 48, paddingHorizontal: 30 }]}
                  onPress={refresh}
                >
                  <Text style={styles.saveBtnText}>RELOAD DATA</Text>
                </TouchableOpacity>
              </View>
            )
          )}

          {/* Recent Transactions List */}
          {selectedStudentUid && (
            <View style={styles.transactionsContainer}>
              <View style={styles.ledgerHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>
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
                      style={styles.paymentRow}
                      onLongPress={() => onRevertPayment(payment)}
                      onPress={() => {
                        router.push({
                          pathname: "/shared/receipt-view",
                          params: {
                            type: "payment",
                            studentId: selectedStudentUid,
                            paymentId: payment.receiptNo,
                            year: payment.academicYear || selectedYear,
                            term: payment.term || selectedTerm,
                          },
                        });
                      }}
                    >
                      <View style={styles.paymentInfo}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <Text style={styles.paymentMain}>
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
                          <Text style={styles.paymentSub}>
                            {payment.receiptNo} • {payment._displayDate}
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
                          {payment._method} • {payment._receivedFrom}
                        </Text>
                      </View>
                      <View style={styles.paymentAction}>
                        <Text
                          style={[
                            styles.paymentAmt,
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
        </View>
      </ScrollView>

      {/* Payment Modal */}
      <Modal visible={paymentModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.overlay}
        >
          <View style={styles.paymentModal}>
            <View style={styles.modalTopRow}>
              <Text style={styles.modalStudentName}>Record Payment</Text>
              <TouchableOpacity
                onPress={() => setPaymentModalVisible(false)}
                style={styles.closeRound}
              >
                <SVGIcon name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
            >
              <View style={styles.modalInputs}>
                <TextInput
                  style={styles.pillInput}
                  placeholder={`Amount (${SCHOOL_CONFIG.currencySymbol})`}
                  keyboardType="numeric"
                  value={paymentAmount}
                  onChangeText={setPaymentAmount}
                  placeholderTextColor="#64748B"
                />
                <TextInput
                  style={styles.pillInput}
                  placeholder="Received From"
                  value={receivedFrom}
                  onChangeText={setReceivedFrom}
                  placeholderTextColor="#64748B"
                />
                {Platform.OS === "web" ? (
                  <View
                    style={[styles.pillInput, { justifyContent: "center" }]}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: "#1E293B",
                          fontSize: 14,
                          marginRight: 10,
                        }}
                      >
                        Date:
                      </Text>
                      <input
                        type="date"
                        value={moment(paymentDate).format("YYYY-MM-DD")}
                        onChange={(e) =>
                          setPaymentDate(new Date(e.target.value))
                        }
                        style={{
                          flex: 1,
                          border: "none",
                          background: "none",
                          fontSize: 16,
                          fontWeight: "700",
                          color: "#1E293B",
                          outline: "none",
                        }}
                      />
                      <SVGIcon name="calendar" size={18} color={primary} />
                    </View>
                  </View>
                ) : (
                  <>
                    <TouchableOpacity
                      style={[styles.pillInput, { justifyContent: "center" }]}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            color: paymentDate ? "#1E293B" : "#64748B",
                            fontSize: 14,
                          }}
                        >
                          Date: {moment(paymentDate).format("DD MMM, YYYY")}
                        </Text>
                        <SVGIcon name="calendar" size={18} color={primary} />
                      </View>
                    </TouchableOpacity>

                    {showDatePicker && (
                      <DateTimePicker
                        value={paymentDate}
                        mode="date"
                        display="default"
                        onChange={(event, selectedDate) => {
                          setShowDatePicker(Platform.OS === "ios");
                          if (selectedDate) {
                            setPaymentDate(selectedDate);
                          }
                        }}
                      />
                    )}
                  </>
                )}
              </View>
              <View style={styles.methodGrid}>
                {["Cash", "Cheque", "Momo", "E-cash"].map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.methodBtn,
                      paymentMethod === m && { backgroundColor: primary },
                    ]}
                    onPress={() => setPaymentMethod(m as any)}
                  >
                    <Text
                      style={[
                        styles.methodText,
                        paymentMethod === m && { color: "#fff" },
                      ]}
                    >
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: primary }]}
                onPress={onLogPayment}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>CONFIRM PAYMENT</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#E2E8F0" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  navBar: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  navTitle: { fontSize: 18, fontWeight: "900", color: "#fff" },
  backIcon: { width: 40 },
  paymentIcon: { width: 40, alignItems: "flex-end", marginRight: 10 },
  scrollContent: { paddingBottom: 40 },
  mainContent: { padding: 15 },
  transactionsContainer: {
    marginTop: 30,
    paddingHorizontal: 5,
  },
  sectionTitle: {
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
  ledgerHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    gap: 10,
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
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 16,
    marginBottom: 10,
    ...SHADOWS.small,
  },
  paymentInfo: { flex: 1 },
  paymentMain: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E293B",
  },
  paymentSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  paymentMeta: {
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 2,
  },
  paymentAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  paymentAmt: {
    fontSize: 15,
    fontWeight: "900",
    color: "#10B981",
  },
  emptyState: { alignItems: "center", marginTop: 60 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#475569",
    marginTop: 15,
  },
  emptySub: { fontSize: 13, color: "#94A3B8", marginTop: 5 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.6)",
    justifyContent: "flex-end",
  },
  paymentModal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 45,
    borderTopRightRadius: 45,
    padding: 30,
    maxHeight: "90%",
  },
  modalTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 35,
  },
  modalStudentName: { fontSize: 20, fontWeight: "900", color: "#1E293B" },
  closeRound: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
  },
  modalInputs: { gap: 15, marginBottom: 30 },
  pillInput: {
    backgroundColor: "#F8FAFC",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    fontSize: 20,
    fontWeight: "900",
    color: "#1E293B",
  },
  methodGrid: { flexDirection: "row", gap: 10, marginBottom: 30 },
  methodBtn: {
    flex: 1,
    height: 48,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  methodText: { fontSize: 12, fontWeight: "800", color: "#64748B" },
  saveBtn: {
    height: 64,
    borderRadius: 24,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1,
  },
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
});
