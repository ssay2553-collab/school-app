import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import moment from "moment";
import {
    ActivityIndicator,
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
import { SHADOWS } from "../../constants/theme";
import { useReceiptView } from "../../hooks/useReceiptView";

const { width } = Dimensions.get("window");

export default function ReceiptViewScreen() {
  const params = useLocalSearchParams();
  const { type, studentId, year, term, paymentId } = params;

  const {
    loading,
    record,
    payment,
    studentData,
    categorySummary,
    totals,
    handleDelete,
    generatePDF,
    formatType,
    schoolLogo,
    primary,
    secondary,
    appUser,
  } = useReceiptView({
    type: type as string,
    studentId: studentId as string,
    year: year as string,
    term: term as string,
    paymentId: paymentId as string,
  });

  const router = useRouter();

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
