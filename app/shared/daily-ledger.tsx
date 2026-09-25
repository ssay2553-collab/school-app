import { useRouter } from "expo-router";
import { useRef } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
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
import {
  DailyCategory,
  DailyLedgerStudentRow,
  useDailyFeesLedger,
} from "../../hooks/shared/useDailyFeesLedger";
import { generateFeeReportPDF } from "../../utils/pdfGenerator";

const { width } = Dimensions.get("window");

const VIBE = {
  primary: SCHOOL_CONFIG.primaryColor || COLORS.primary || "#4F46E5",
  secondary: "#F59E0B",
  success: "#10B981",
  info: "#0EA5E9",
  purple: "#8B5CF6",
  danger: "#EF4444",
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
};

export default function DailyFeesLedgerScreen() {
  const router = useRouter();
  const isNavigating = useRef(false);

  const {
    canView,
    loading,
    refreshing,
    onRefresh,
    activeCategory,
    setActiveCategory,
    selectedClassId,
    setSelectedClassId,
    searchQuery,
    setSearchQuery,
    classes,
    ledgerRows,
    summaryTotals,
    academicYear,
    currentTerm,
  } = useDailyFeesLedger();

  const handleBack = () => {
    if (isNavigating.current) return;
    isNavigating.current = true;
    router.replace("/shared/daily-financials");
    setTimeout(() => {
      isNavigating.current = false;
    }, 500);
  };

  const getCategoryTitle = (cat: DailyCategory) => {
    switch (cat) {
      case "feeding":
        return "Feeding Fees Ledger";
      case "bus":
        return "Bus Fees Ledger";
      case "extra":
        return "Extra Classes Ledger";
      case "all":
        return "Combined Daily Fees Ledger";
    }
  };

  const handleExportPDF = async () => {
    try {
      const selectedClassName =
        selectedClassId === "all"
          ? "All Classes"
          : classes.find((c) => c.id === selectedClassId)?.name || "Class";

      const groupedData: Record<string, any[]> = {};

      ledgerRows.forEach((r) => {
        const groupName = r.className || selectedClassName;
        if (!groupedData[groupName]) {
          groupedData[groupName] = [];
        }
        groupedData[groupName].push({
          fullName: `${r.fullName} (${r.totalDaysBilled}d billed / ${r.daysPaid}d paid)`,
          studentID: r.studentID,
          totalPayable: r.totalBilledAmount,
          discount: 0,
          amountPaid: r.amountPaid,
          balance: r.arrearsAmount,
        });
      });

      await generateFeeReportPDF(
        {
          academicYear: academicYear || "Current Year",
          term: currentTerm || "Current Term",
          currencySymbol: SCHOOL_CONFIG.currencySymbol || "GHS",
          groupedData,
          schoolTotals: {
            payable: summaryTotals.totalBilled,
            discount: 0,
            paid: summaryTotals.totalPaid,
            balance: summaryTotals.totalArrears,
          },
        },
        SCHOOL_CONFIG.fullName || "EduEaz",
        SCHOOL_CONFIG.hotline || "",
        SCHOOL_CONFIG.email || "",
        SCHOOL_CONFIG.address || "",
      );
    } catch (e) {
      console.error("Failed to export daily fees ledger PDF:", e);
    }
  };

  if (!canView) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.errorContainer}>
          <SVGIcon name="lock-closed" size={60} color={VIBE.danger} />
          <Text style={styles.errorTitle}>Access Denied</Text>
          <Text style={styles.errorSub}>
            You do not have permission to view the Daily Fees Ledger.
          </Text>
          <TouchableOpacity style={styles.errorButton} onPress={handleBack}>
            <Text style={styles.errorButtonText}>Back to Daily Financials</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const renderStudentTableRow = ({ item }: { item: DailyLedgerStudentRow }) => {
    return (
      <Animatable.View animation="fadeInUp" duration={300} style={styles.tr}>
        {/* Student Name & Class */}
        <View style={[styles.td, { flex: 2.5 }]}>
          <Text style={styles.studentNameText} numberOfLines={1}>
            {item.fullName}
          </Text>
          <View style={styles.studentSubRow}>
            <Text style={styles.studentIdText}>{item.studentID}</Text>
            <Text style={styles.dotSeparator}>•</Text>
            <Text style={styles.classNameText}>{item.className}</Text>
          </View>
        </View>

        {/* Daily Rate */}
        <View style={[styles.td, { flex: 1.2 }]}>
          <Text style={styles.rateText}>₵{item.dailyRate.toFixed(2)}</Text>
          <Text style={styles.subText}>per day</Text>
        </View>

        {/* Total Billed */}
        <View style={[styles.td, { flex: 1.5 }]}>
          <Text style={styles.billedText}>₵{item.totalBilledAmount.toFixed(2)}</Text>
          <Text style={styles.subText}>{item.totalDaysBilled} days</Text>
        </View>

        {/* Amount Paid & Days Covered */}
        <View style={[styles.td, { flex: 1.8 }]}>
          <Text style={styles.paidText}>₵{item.amountPaid.toFixed(2)}</Text>
          <View style={styles.pillBadgeSuccess}>
            <Text style={styles.pillBadgeSuccessText}>
              {item.daysPaid} {item.daysPaid === 1 ? "day" : "days"} covered
            </Text>
          </View>
        </View>

        {/* Arrears Amount & Days Owed */}
        <View style={[styles.td, { flex: 2, alignItems: "flex-end" }]}>
          {item.isFullyPaid ? (
            <View style={styles.paidBadge}>
              <SVGIcon name="checkmark-circle" size={14} color={VIBE.success} />
              <Text style={styles.paidBadgeText}>PAID</Text>
            </View>
          ) : (
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.arrearsText}>₵{item.arrearsAmount.toFixed(2)}</Text>
              <View style={styles.pillBadgeDanger}>
                <Text style={styles.pillBadgeDangerText}>
                  {item.daysArrears} {item.daysArrears === 1 ? "day" : "days"} arrears
                </Text>
              </View>
            </View>
          )}
        </View>
      </Animatable.View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <SVGIcon name="arrow-back" size={24} color={VIBE.text} />
          </TouchableOpacity>
          <View style={styles.headerTitle}>
            <Text style={styles.headerTitleText}>
              {getCategoryTitle(activeCategory)}
            </Text>
            <Text style={styles.headerSubtitle}>
              Dedicated Per-Class Daily Billing & Arrears Ledger
            </Text>
          </View>

          <TouchableOpacity
            style={styles.exportBtn}
            onPress={handleExportPDF}
            disabled={ledgerRows.length === 0}
          >
            <SVGIcon name="document-text" size={18} color="#fff" />
            <Text style={styles.exportBtnText}>Export</Text>
          </TouchableOpacity>
        </View>

        {/* Academic Term Info Pill */}
        <View style={styles.termInfoBanner}>
          <SVGIcon name="calendar-outline" size={16} color={VIBE.primary} />
          <Text style={styles.termInfoText}>
            {academicYear || "Academic Year"} — {currentTerm || "Current Term"}
          </Text>
        </View>
      </View>

      {/* Category Tabs */}
      <View style={styles.categoryBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[
            { id: "feeding", label: "Feeding Fees", icon: "restaurant" },
            { id: "bus", label: "Bus Fees", icon: "bus" },
            { id: "extra", label: "Extra Classes", icon: "book" },
            { id: "all", label: "All Daily Charges", icon: "grid" },
          ].map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryChip,
                activeCategory === cat.id && styles.categoryChipActive,
              ]}
              onPress={() => setActiveCategory(cat.id as DailyCategory)}
            >
              <SVGIcon
                name={cat.icon}
                size={16}
                color={activeCategory === cat.id ? "#fff" : VIBE.muted}
              />
              <Text
                style={[
                  styles.categoryChipText,
                  activeCategory === cat.id && styles.categoryChipTextActive,
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Main Content */}
      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={VIBE.primary} />
          <Text style={styles.loadingText}>Calculating daily ledger metrics...</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Summary Cards */}
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { borderColor: VIBE.primary + "30" }]}>
              <Text style={styles.statLabel}>Total Billed</Text>
              <Text style={[styles.statValue, { color: VIBE.primary }]}>
                ₵{summaryTotals.totalBilled.toFixed(2)}
              </Text>
              <Text style={styles.statSub}>{summaryTotals.studentCount} Students</Text>
            </View>

            <View style={[styles.statCard, { borderColor: VIBE.success + "30" }]}>
              <Text style={styles.statLabel}>Amount Paid</Text>
              <Text style={[styles.statValue, { color: VIBE.success }]}>
                ₵{summaryTotals.totalPaid.toFixed(2)}
              </Text>
              <Text style={styles.statSub}>{summaryTotals.totalPaidDays} Total Days Covered</Text>
            </View>

            <View style={[styles.statCard, { borderColor: VIBE.danger + "30" }]}>
              <Text style={styles.statLabel}>Total Arrears</Text>
              <Text style={[styles.statValue, { color: VIBE.danger }]}>
                ₵{summaryTotals.totalArrears.toFixed(2)}
              </Text>
              <Text style={styles.statSub}>{summaryTotals.totalArrearsDays} Total Days Owed</Text>
            </View>
          </View>

          {/* Class Filter Bar */}
          <View style={styles.filterSection}>
            <View style={styles.searchBar}>
              <SVGIcon name="search" size={18} color={VIBE.muted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search student or ID..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor={VIBE.muted}
              />
              {searchQuery !== "" && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <SVGIcon name="close-circle" size={18} color={VIBE.muted} />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.pickerContainer}>
              <Text style={styles.pickerLabel}>Class Filter:</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 4 }}
              >
                <TouchableOpacity
                  style={[
                    styles.classChip,
                    selectedClassId === "all" && styles.classChipActive,
                  ]}
                  onPress={() => setSelectedClassId("all")}
                >
                  <Text
                    style={[
                      styles.classChipText,
                      selectedClassId === "all" && styles.classChipTextActive,
                    ]}
                  >
                    All Classes
                  </Text>
                </TouchableOpacity>

                {classes.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.classChip,
                      selectedClassId === c.id && styles.classChipActive,
                    ]}
                    onPress={() => setSelectedClassId(c.id)}
                  >
                    <Text
                      style={[
                        styles.classChipText,
                        selectedClassId === c.id && styles.classChipTextActive,
                      ]}
                    >
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          {/* Table Container */}
          <View style={styles.tableCard}>
            <View style={styles.tableHeaderSection}>
              <Text style={styles.tableTitle}>
                {selectedClassId === "all"
                  ? "All Students Daily Fee Ledger"
                  : `${classes.find((c) => c.id === selectedClassId)?.name || "Class"} Daily Ledger`}
              </Text>
              <Text style={styles.tableSubtitle}>
                {ledgerRows.length} Students Listed
              </Text>
            </View>

            {/* Horizontal Scroll Table Wrapper */}
            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
              <View style={{ minWidth: 700 }}>
                {/* Table Header Row */}
                <View style={styles.th}>
                  <Text style={[styles.thText, { flex: 2.5 }]}>STUDENT & CLASS</Text>
                  <Text style={[styles.thText, { flex: 1.2 }]}>DAILY RATE</Text>
                  <Text style={[styles.thText, { flex: 1.5 }]}>TOTAL BILLED</Text>
                  <Text style={[styles.thText, { flex: 1.8 }]}>PAID (DAYS COVERED)</Text>
                  <Text style={[styles.thText, { flex: 2, textAlign: "right" }]}>
                    ARREARS (DAYS OWED)
                  </Text>
                </View>

                {/* Table Body */}
                {ledgerRows.length > 0 ? (
                  <FlatList
                    data={ledgerRows}
                    keyExtractor={(item) => item.studentUid}
                    renderItem={renderStudentTableRow}
                    scrollEnabled={false}
                  />
                ) : (
                  <View style={styles.emptyTable}>
                    <SVGIcon name="folder-open-outline" size={40} color={VIBE.muted} />
                    <Text style={styles.emptyTableText}>
                      No daily fee records found for this selection.
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VIBE.bg },
  header: {
    backgroundColor: VIBE.surface,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: VIBE.border,
    ...SHADOWS.small,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: VIBE.bg,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { flex: 1, marginLeft: 12 },
  headerTitleText: { fontSize: 18, fontWeight: "900", color: VIBE.text },
  headerSubtitle: { fontSize: 11, fontWeight: "600", color: VIBE.muted },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: VIBE.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  exportBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  termInfoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: VIBE.primary + "10",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 10,
  },
  termInfoText: { fontSize: 12, fontWeight: "700", color: VIBE.primary },

  // Category Selector Bar
  categoryBar: {
    backgroundColor: VIBE.surface,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: VIBE.border,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: VIBE.bg,
    marginRight: 8,
  },
  categoryChipActive: { backgroundColor: VIBE.primary },
  categoryChipText: { fontSize: 12, fontWeight: "700", color: VIBE.muted },
  categoryChipTextActive: { color: "#fff" },

  // Stats Grid
  statsGrid: {
    flexDirection: "row",
    padding: 16,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: VIBE.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    ...SHADOWS.small,
  },
  statLabel: { fontSize: 11, fontWeight: "700", color: VIBE.muted },
  statValue: { fontSize: 16, fontWeight: "900", marginVertical: 4 },
  statSub: { fontSize: 10, fontWeight: "600", color: VIBE.muted },

  // Filter Section
  filterSection: { paddingHorizontal: 16, marginBottom: 12 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: VIBE.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: VIBE.border,
    marginBottom: 10,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 13, color: VIBE.text },
  pickerContainer: { flexDirection: "row", alignItems: "center", gap: 8 },
  pickerLabel: { fontSize: 12, fontWeight: "700", color: VIBE.muted },
  classChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: VIBE.surface,
    borderWidth: 1,
    borderColor: VIBE.border,
    marginRight: 6,
  },
  classChipActive: { backgroundColor: VIBE.primary, borderColor: VIBE.primary },
  classChipText: { fontSize: 12, fontWeight: "600", color: VIBE.text },
  classChipTextActive: { color: "#fff" },

  // Table Styling
  tableCard: {
    backgroundColor: VIBE.surface,
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: VIBE.border,
    overflow: "hidden",
    ...SHADOWS.small,
  },
  tableHeaderSection: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: VIBE.border,
    backgroundColor: VIBE.bg,
  },
  tableTitle: { fontSize: 14, fontWeight: "800", color: VIBE.text },
  tableSubtitle: { fontSize: 11, color: VIBE.muted, fontWeight: "600" },

  th: {
    flexDirection: "row",
    backgroundColor: VIBE.primary + "10",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: VIBE.border,
  },
  thText: {
    fontSize: 10,
    fontWeight: "900",
    color: VIBE.primary,
    letterSpacing: 0.5,
  },

  tr: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: VIBE.border,
  },
  td: { justifyContent: "center" },

  studentNameText: { fontSize: 13, fontWeight: "800", color: VIBE.text },
  studentSubRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  studentIdText: { fontSize: 10, fontWeight: "600", color: VIBE.muted },
  dotSeparator: { fontSize: 10, color: VIBE.muted },
  classNameText: { fontSize: 10, fontWeight: "700", color: VIBE.primary },

  rateText: { fontSize: 12, fontWeight: "800", color: VIBE.text },
  billedText: { fontSize: 12, fontWeight: "800", color: VIBE.text },
  paidText: { fontSize: 12, fontWeight: "800", color: VIBE.success },
  arrearsText: { fontSize: 12, fontWeight: "800", color: VIBE.danger },
  subText: { fontSize: 10, color: VIBE.muted, fontWeight: "600" },

  pillBadgeSuccess: {
    backgroundColor: VIBE.success + "15",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
    alignSelf: "flex-start",
  },
  pillBadgeSuccessText: { fontSize: 9, fontWeight: "800", color: VIBE.success },

  pillBadgeDanger: {
    backgroundColor: VIBE.danger + "15",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
    alignSelf: "flex-end",
  },
  pillBadgeDangerText: { fontSize: 9, fontWeight: "800", color: VIBE.danger },

  paidBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: VIBE.success + "15",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  paidBadgeText: { fontSize: 10, fontWeight: "900", color: VIBE.success },

  emptyTable: {
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTableText: { fontSize: 12, color: VIBE.muted, fontWeight: "600", marginTop: 8 },

  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: { marginTop: 10, fontSize: 12, color: VIBE.muted, fontWeight: "600" },

  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorTitle: { fontSize: 20, fontWeight: "900", color: VIBE.text, marginTop: 12 },
  errorSub: { fontSize: 12, color: VIBE.muted, textAlign: "center", marginTop: 6, marginBottom: 20 },
  errorButton: {
    backgroundColor: VIBE.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  errorButtonText: { color: "#fff", fontWeight: "800", fontSize: 13 },
});
