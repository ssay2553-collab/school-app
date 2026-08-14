import { useRouter } from "expo-router";
import moment from "moment";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { COLORS } from "../../constants/theme";
import { useAcademicConfig } from "../../contexts/AcademicContext";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { generateFinancialSummaryPDF } from "../../utils/pdfGenerator";
import { useFinancialData, CategorySummary } from "../../hooks/useFinancialData";
import styles, { VIBE } from "./FinancialSummary.styles";

export default function FinancialSummary() {
  const router = useRouter();
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const acadConfig = useAcademicConfig();

  const {
    loading,
    refreshing,
    categories,
    dailyTotals,
    ledgerItems,
    feeStats,
    lastUpdated,
    loadSummaries
  } = useFinancialData(acadConfig, showToast);

  // ACCESS CONTROL
  const currentUserRole = appUser?.adminRole?.toLowerCase() || "";
  const isSuperAdmin = [
    "proprietor", "proprietress", "manager", "headmaster", "headmistress",
    "administrator", "director", "accountant", "bursar", "admin", "super admin", "superadmin",
  ].includes(currentUserRole);

  const [viewMode, setViewMode] = useState<"categories" | "daily">("categories");

  const handleBack = () => router.replace("/admin-dashboard");

  useEffect(() => {
    if (appUser && !isSuperAdmin) {
      showToast({ message: "Access Denied", type: "error" });
      handleBack();
    }
  }, [appUser, isSuperAdmin]);

  const generatePDF = async () => {
    try {
      const feeCat = categories.find((c) => c.name === "General Student Fees");
      const dailyCats = categories.filter((c) => ["Feeding Fees", "Bus Fees", "Extra Classes"].includes(c.name));
      const expenditureCat = categories.find((c) => c.name === "Expenditure");

      const totalGeneralFees = feeCat?.allPeriodsTotal || 0;
      const totalDaily = dailyCats.reduce((acc, cat) => acc + cat.allPeriodsTotal, 0);
      const totalExpenditure = expenditureCat?.allPeriodsTotal || 0;
      const netBalance = totalGeneralFees - totalExpenditure;

      await generateFinancialSummaryPDF(
        {
          totalFees: totalGeneralFees,
          totalDailyPayments: totalDaily,
          totalExpenditure,
          netBalance,
          totalBilled: feeStats.billed,
          totalPaid: feeStats.paid,
          totalOutstanding: feeStats.balance,
          totalDiscount: feeStats.discount,
          discountCount: feeStats.discountCount,
          ledgerItems: ledgerItems,
          categories: categories.map((cat) => ({
            name: cat.name,
            count: cat.term.count,
            total: cat.allPeriodsTotal,
            today: cat.today.total,
            week: cat.week.total,
            month: cat.month.total,
            term: cat.term.total,
          })),
          currencySymbol: SCHOOL_CONFIG.currencySymbol || "GHS",
        },
        SCHOOL_CONFIG.fullName,
        SCHOOL_CONFIG.hotline,
        SCHOOL_CONFIG.email,
        SCHOOL_CONFIG.address,
      );
    } catch (error) {
      showToast({ message: "Failed to generate PDF.", type: "error" });
    }
  };

  const renderCategoryCard = (category: CategorySummary) => {
    const periods = [
      { label: "Today", data: category.today },
      { label: "Week", data: category.week },
      { label: "Month", data: category.month },
      { label: "Term", data: category.term },
    ];

    return (
      <View key={category.name} style={styles.categoryCard}>
        <View style={styles.categoryHeader}>
          <View style={[styles.categoryIconBox, { backgroundColor: category.color + "10" }]}>
            <SVGIcon name={category.icon} size={24} color={category.color} />
          </View>
          <View style={styles.categoryTitleRow}>
            <View>
              <Text style={styles.categoryName}>{category.name}</Text>
              <Text style={styles.categoryTermLabel}>Current Term Total</Text>
            </View>
            <Text style={[styles.categoryTotal, { color: category.color }]}>
              ₵{category.allPeriodsTotal.toLocaleString()}
            </Text>
          </View>
        </View>
        <View style={styles.periodsGrid}>
          {periods.map((period) => (
            <View key={period.label} style={styles.periodItem}>
              <Text style={styles.periodLabel}>{period.label}</Text>
              <Text style={styles.periodValue}>₵{period.data.total.toLocaleString()}</Text>
              <View style={styles.periodBadge}>
                <Text style={styles.periodCount}>{period.data.count}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderDailyTotals = () => {
    return (
      <View style={styles.dailyTotalsContainer}>
        {dailyTotals.map((item) => {
          const dailyTotalRevenue = item.generalFees + item.feeding + item.bus + item.extra;
          return (
            <View key={item.date} style={styles.dailyRow}>
              <View style={styles.dailyHeader}>
                <View>
                  <Text style={styles.dailyDate}>{moment(item.date).format("ddd, MMM DD")}</Text>
                  <Text style={styles.dailyYear}>{moment(item.date).format("YYYY")}</Text>
                </View>
                <View style={styles.dailySummaryRight}>
                  <Text style={[styles.dailyRevenue, { color: VIBE.success }]}>
                    Total: +₵{dailyTotalRevenue.toLocaleString()}
                  </Text>
                </View>
              </View>
              <View style={styles.dailyGrid}>
                {["Feeding", "Bus", "Extra", "Gen. Fees"].map((label, idx) => {
                    const vals = [item.feeding, item.bus, item.extra, item.generalFees];
                    return (
                        <View key={label} style={styles.dailyStat}>
                            <Text style={styles.dailyStatLabel}>{label}</Text>
                            <Text style={styles.dailyStatValue} numberOfLines={1} adjustsFontSizeToFit>₵{vals[idx].toLocaleString()}</Text>
                        </View>
                    )
                })}
                <View style={[styles.dailyNetBadge, { backgroundColor: VIBE.success + "10" }]}>
                   <Text style={[styles.dailyNetText, { color: VIBE.success, fontWeight: '700' }]}>REVENUE</Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  if (!isSuperAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.centerText}>Checking access...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const feeCat = categories.find((c) => c.name === "General Student Fees");
  const expenditureCat = categories.find((c) => c.name === "Expenditure");
  const totalRevenue = feeCat?.allPeriodsTotal || 0;
  const totalExpenditure = expenditureCat?.allPeriodsTotal || 0;
  const netBalance = totalRevenue - totalExpenditure;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom", "left", "right"]}>
      <StatusBar barStyle="dark-content" />
      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={[0]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadSummaries(true)} />}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <SVGIcon name="arrow-back" size={22} color={COLORS.primary} />
            </TouchableOpacity>
            <View style={styles.headerTitle}>
              <Text style={styles.headerTitleText} numberOfLines={1}>Financial Summary</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>Detailed breakdown</Text>
            </View>
            <View style={styles.headerActions}>
                <TouchableOpacity onPress={() => loadSummaries(true)} style={styles.actionIconButton}>
                    <SVGIcon name="refresh" size={18} color={VIBE.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={generatePDF} style={styles.actionIconButton}>
                    <SVGIcon name="download" size={18} color={VIBE.info} />
                </TouchableOpacity>
                <View style={[styles.actionIconButton, { backgroundColor: VIBE.bg }]}>
                    <SVGIcon name="shield-checkmark" size={18} color={VIBE.muted} />
                </View>
            </View>
          </View>

          {/* Overall Summary */}
          <View style={styles.overviewSection}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>📊 Financial Overview</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {acadConfig.termStart && (
                    <Text style={styles.dateRangeText}>
                      {moment(acadConfig.termStart.toDate ? acadConfig.termStart.toDate() : acadConfig.termStart).format("MMM D")} - {moment(acadConfig.termEnd.toDate ? acadConfig.termEnd.toDate() : acadConfig.termEnd).format("MMM D, YYYY")}
                    </Text>
                  )}
                  {lastUpdated && (
                    <Text style={[styles.dateRangeText, { color: VIBE.info }]}>• Updated {moment(lastUpdated).fromNow()}</Text>
                  )}
                </View>
              </View>
              <View style={styles.periodIndicator}>
                <Text style={styles.periodIndicatorText}>{acadConfig.currentTerm || "Current Term"}</Text>
              </View>
            </View>

            <View style={styles.overviewCards}>
              <View style={[styles.mainBalanceCard, { backgroundColor: netBalance >= 0 ? VIBE.chart1 : VIBE.danger }]}>
                <View style={styles.mainBalanceHeader}>
                   <Text style={styles.mainBalanceLabel}>Net Financial Standing</Text>
                   <SVGIcon name={netBalance >= 0 ? "trending-up" : "trending-down"} size={20} color="#ffffff80" />
                </View>
                <Text style={styles.mainBalanceValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                  ₵{netBalance.toLocaleString()}
                </Text>
                <View style={styles.mainBalanceFooter}>
                  <Text style={styles.mainBalanceSubtext}>General Fees (₵{totalRevenue.toLocaleString()}) - Expenditure (₵{totalExpenditure.toLocaleString()})</Text>
                </View>
              </View>
              <View style={styles.secondaryOverviewRow}>
                <View style={[styles.secondaryCard, { borderLeftColor: VIBE.success }]}>
                  <Text style={styles.secondaryLabel}>General Fees Received</Text>
                  <Text style={[styles.secondaryValue, { color: VIBE.success }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                    ₵{totalRevenue.toLocaleString()}
                  </Text>
                </View>
                <View style={[styles.secondaryCard, { borderLeftColor: VIBE.danger }]}>
                  <Text style={styles.secondaryLabel}>Total Expenses</Text>
                  <Text style={[styles.secondaryValue, { color: VIBE.danger }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                    ₵{totalExpenditure.toLocaleString()}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Toggle & Content */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity style={[styles.toggleBtn, viewMode === "categories" && styles.toggleBtnActive]} onPress={() => setViewMode("categories")}>
              <Text style={[styles.toggleText, viewMode === "categories" && styles.toggleTextActive]}>Categories</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleBtn, viewMode === "daily" && styles.toggleBtnActive]} onPress={() => setViewMode("daily")}>
              <Text style={[styles.toggleText, viewMode === "daily" && styles.toggleTextActive]}>Daily Totals</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            {viewMode === "categories" ? (
              <>
                <Text style={styles.sectionTitle}>📋 Category Breakdown</Text>
                <Text style={styles.sectionSubtitle}>Each category with Today, Week, Month, Term breakdown</Text>
                {categories.map(renderCategoryCard)}
              </>
            ) : (
              <>
                <Text style={styles.sectionTitle}>📅 Daily Performance</Text>
                <Text style={styles.sectionSubtitle}>Revenue for the last 3 months</Text>
                {renderDailyTotals()}
              </>
            )}
          </View>

          {/* Health & Ledger */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📈 Financial Health</Text>
            <View style={styles.healthCard}>
              <View style={styles.healthRow}>
                <Text style={styles.healthLabel}>Expense Ratio</Text>
                <Text style={[styles.healthValue, { color: netBalance >= 0 ? VIBE.success : VIBE.danger }]}>
                  {totalRevenue > 0 ? ((totalExpenditure / totalRevenue) * 100).toFixed(1) : 0}%
                </Text>
              </View>
              <View style={styles.healthBarContainer}>
                <View style={[styles.healthBar, { width: `${totalRevenue > 0 ? Math.min((totalExpenditure / totalRevenue) * 100, 100) : 0}%`, backgroundColor: netBalance >= 0 ? VIBE.success : VIBE.danger }]} />
              </View>
              <Text style={styles.healthFooter}>
                {netBalance >= 0 ? `Expenditure accounts for ${totalRevenue > 0 ? ((totalExpenditure / totalRevenue) * 100).toFixed(1) : 0}% of general revenue.` : "Expenditures exceed general revenue."}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🧾 Detailed Ledger (Term)</Text>
            <View style={styles.healthCard}>
                <View style={[styles.ledgerRow, { borderBottomWidth: 1, borderBottomColor: VIBE.bg, paddingBottom: 8, marginBottom: 8 }]}>
                    <Text style={[styles.periodLabel, { flex: 2, textAlign: 'left' }]}>ITEM</Text>
                    <Text style={[styles.periodLabel, { flex: 1.2, textAlign: 'right' }]}>BILLED</Text>
                    <Text style={[styles.periodLabel, { flex: 1.2, textAlign: 'right' }]}>PAID</Text>
                    <Text style={[styles.periodLabel, { flex: 1.2, textAlign: 'right' }]}>BAL.</Text>
                </View>
                {ledgerItems.map(item => (
                    <View key={item.name} style={[styles.ledgerRow, { marginVertical: 4 }]}>
                        <Text style={[styles.ledgerValue, { flex: 2, fontSize: 13, textAlign: 'left' }]}>{item.name}</Text>
                        <Text style={[styles.ledgerValue, { flex: 1.2, fontSize: 13, textAlign: 'right', fontWeight: '700' }]}>₵{item.billed.toLocaleString()}</Text>
                        <Text style={[styles.ledgerValue, { flex: 1.2, fontSize: 13, textAlign: 'right', color: VIBE.success, fontWeight: '700' }]}>₵{item.paid.toLocaleString()}</Text>
                        <Text style={[styles.ledgerValue, { flex: 1.2, fontSize: 13, textAlign: 'right', color: item.balance > 0 ? VIBE.danger : VIBE.success, fontWeight: '700' }]}>₵{item.balance.toLocaleString()}</Text>
                    </View>
                ))}
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚡ Quick Actions</Text>
            <View style={styles.quickActionsRow}>
              <TouchableOpacity style={styles.quickActionBtn} onPress={() => router.push("/shared/daily-financials" as any)}>
                <SVGIcon name="receipt" size={20} color={VIBE.primary} />
                <Text style={[styles.quickActionText, { color: VIBE.primary }]}>Record Fees</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickActionBtn} onPress={handleBack}>
                <SVGIcon name="arrow-back" size={20} color={VIBE.muted} />
                <Text style={[styles.quickActionText, { color: VIBE.muted }]}>Go Back</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
