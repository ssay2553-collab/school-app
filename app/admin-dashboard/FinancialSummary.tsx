import * as Print from "expo-print";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import {
  collection,
  getDocsFromServer,
  query,
  where,
} from "firebase/firestore";
import moment from "moment";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAcademicConfig } from "../../contexts/AcademicContext";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { db } from "../../firebaseConfig";

const { width } = Dimensions.get("window");

const VIBE = {
  primary: "#4F46E5", // Indigo
  secondary: "#F59E0B", // Amber
  success: "#10B981", // Emerald
  info: "#0EA5E9", // Sky
  purple: "#8B5CF6", // Violet
  danger: "#EF4444", // Rose
  bg: "#F8FAFC", // Lighter Slate
  surface: "#FFFFFF",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
  card: "#FFFFFF",
  chart1: "#6366F1",
  chart2: "#A855F7",
  chart3: "#EC4899",
};

type PeriodData = {
  label: string;
  total: number;
  count: number;
};

type CategorySummary = {
  name: string;
  icon: string;
  color: string;
  today: PeriodData;
  week: PeriodData;
  month: PeriodData;
  term: PeriodData;
  allPeriodsTotal: number;
};

type DailyTotal = {
  date: string;
  feeding: number;
  bus: number;
  extra: number;
  generalFees: number;
  expenditure: number;
  totalRevenue: number;
};

export default function FinancialSummary() {
  const router = useRouter();
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const acadConfig = useAcademicConfig();

  // ACCESS CONTROL - Only superadmins
  const currentUserRole = appUser?.adminRole?.toLowerCase() || "";
  const isSuperAdmin = [
    "proprietor",
    "proprietress",
    "manager",
    "headmaster",
    "headmistress",
    "administrator",
    "director",
    "accountant",
    "bursar",
    "admin",
    "super admin",
    "superadmin",
  ].includes(currentUserRole);

  const generatePDF = async () => {
    try {
      const feeCat = categories.find((c) => c.name === "General Student Fees");
      const dailyCats = categories.filter((c) => ["Feeding Fees", "Bus Fees", "Extra Classes"].includes(c.name));
      const expenditureCat = categories.find((c) => c.name === "Expenditure");

      const totalFees = feeCat?.allPeriodsTotal || 0;
      const totalDaily = dailyCats.reduce((acc, cat) => acc + cat.allPeriodsTotal, 0);
      const totalExpenditure = expenditureCat?.allPeriodsTotal || 0;

      // Expenditure deducted from fees totals and not daily financials sum
      const netFees = totalFees - totalExpenditure;
      const netBalance = netFees + totalDaily;

      const html = `
      <html>
        <head>
          <style>
            @page {
              size: A4;
              margin: 0;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              height: auto !important;
              min-height: 100% !important;
              overflow: visible !important;
              display: block !important;
              background-color: white;
            }
            body { font-family: 'Helvetica'; color: #1E293B; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .page {
              padding: 20mm;
              width: 210mm;
              min-height: 297mm;
              box-sizing: border-box;
              display: block;
              page-break-after: always;
              page-break-inside: avoid;
              overflow: visible !important;
              position: relative;
              background-color: white;
            }
            .page:last-child {
              page-break-after: avoid;
            }
            .header { text-align: center; border-bottom: 2px solid #4F46E5; padding-bottom: 10px; margin-bottom: 20px; }
            .school-name { font-size: 24px; font-weight: bold; margin: 0; color: #4F46E5; }
            .report-title { font-size: 18px; font-weight: bold; margin: 10px 0; text-transform: uppercase; }
            .date-range { font-size: 12px; color: #64748B; margin-bottom: 20px; }

            .overview-container { display: flex; justify-content: space-between; margin-bottom: 30px; gap: 10px; }
            .overview-card { flex: 1; padding: 15px; border-radius: 8px; border: 1px solid #E2E8F0; text-align: center; }
            .overview-label { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #64748B; margin-bottom: 5px; }
            .overview-value { font-size: 18px; font-weight: 800; }

            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { background-color: #F8FAFC; border-bottom: 2px solid #E2E8F0; padding: 12px 8px; text-align: left; font-size: 12px; font-weight: bold; }
            td { border-bottom: 1px solid #F1F5F9; padding: 10px 8px; font-size: 12px; }
            .amount { text-align: right; font-family: 'Courier'; }

            .category-row { font-weight: bold; background-color: #F8FAFC; }
            .total-row { font-weight: bold; border-top: 2px solid #1E293B; }
            .net-surplus { color: #10B981; }
            .net-deficit { color: #EF4444; }

            .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #94A3B8; border-top: 1px solid #E2E8F0; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="header">
              <h1 class="school-name">${SCHOOL_CONFIG.fullName}</h1>
              <p style="margin: 5px 0; font-size: 12px;">${SCHOOL_CONFIG.address}</p>
              <div class="report-title">Financial Summary Report</div>
              <div class="date-range">Generated on: ${moment().format("MMMM Do YYYY, h:mm a")}</div>
            </div>

            <div class="overview-container">
              <div class="overview-card">
                <div class="overview-label">Total Fees Received</div>
                <div class="overview-value" style="color: #10B981">₵${totalFees.toLocaleString()}</div>
              </div>
              <div class="overview-card">
                <div class="overview-label">Total Expenditure</div>
                <div class="overview-value" style="color: #EF4444">₵${totalExpenditure.toLocaleString()}</div>
              </div>
              <div class="overview-card" style="background-color: ${netBalance >= 0 ? "#F0FDF4" : "#FEF2F2"}">
                <div class="overview-label">Net Financial Position</div>
                <div class="overview-value ${netBalance >= 0 ? "net-surplus" : "net-deficit"}">₵${netBalance.toLocaleString()}</div>
              </div>
            </div>

            <h3 style="font-size: 14px; margin-bottom: 10px;">Category Breakdown (Current Term)</h3>
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th style="text-align:center">Transactions</th>
                  <th style="text-align:right">Total Amount (₵)</th>
                </tr>
              </thead>
              <tbody>
                ${categories.map(cat => `
                  <tr>
                    <td>${cat.name}</td>
                    <td style="text-align:center">${cat.term.count}</td>
                    <td class="amount">₵${cat.allPeriodsTotal.toLocaleString()}</td>
                  </tr>
                `).join("")}
                <tr class="total-row">
                  <td colspan="2">NET TERM BALANCE</td>
                  <td class="amount ${netBalance >= 0 ? "net-surplus" : "net-deficit"}">₵${netBalance.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>

            <div class="footer">
              <p>This is a computer-generated financial report from EduEaz Platform.</p>
              <p>Net Position = (Fees - Expenditure) + Daily Financials (Feeding, Bus, Extra)</p>
              <p>&copy; ${new Date().getFullYear()} ${SCHOOL_CONFIG.name}. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
      `;

      if (Platform.OS === "web") {
        await Print.printAsync({ html });
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        if (Platform.OS === "ios") {
          await Sharing.shareAsync(uri);
        } else {
          await Sharing.shareAsync(uri, {
            mimeType: "application/pdf",
            dialogTitle: "Share Financial Summary",
            UTI: "com.adobe.pdf",
          });
        }
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      showToast({
        message: "Failed to generate PDF report.",
        type: "error",
      });
    }
  };

  const handleBack = () => {
    router.replace("/admin-dashboard");
  };

  useEffect(() => {
    if (appUser && !isSuperAdmin) {
      showToast({
        message: "Access Denied: Only super admins can view this summary.",
        type: "error",
      });
      handleBack();
    }
  }, [appUser, isSuperAdmin]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [dailyTotals, setDailyTotals] = useState<DailyTotal[]>([]);
  const [viewMode, setViewMode] = useState<"categories" | "daily">("categories");

  const loadSummaries = useCallback(async () => {
    try {
      setLoading(true);
      const baseDate = moment(selectedDate);

      // Parse Academic Config Dates
      const configStart = acadConfig.termStart
        ? moment(acadConfig.termStart.toDate ? acadConfig.termStart.toDate() : acadConfig.termStart)
        : null;
      const configEnd = acadConfig.termEnd
        ? moment(acadConfig.termEnd.toDate ? acadConfig.termEnd.toDate() : acadConfig.termEnd)
        : null;

      // Define date ranges
      const ranges = {
        today: {
          start: baseDate.clone().startOf("day").format("YYYY-MM-DD"),
          end: baseDate.clone().endOf("day").format("YYYY-MM-DD"),
        },
        week: {
          start: baseDate.clone().startOf("week").format("YYYY-MM-DD"),
          end: baseDate.clone().endOf("week").format("YYYY-MM-DD"),
        },
        month: {
          start: baseDate.clone().startOf("month").format("YYYY-MM-DD"),
          end: baseDate.clone().endOf("month").format("YYYY-MM-DD"),
        },
        term: {
          start: configStart ? configStart.format("YYYY-MM-DD") : baseDate.clone().subtract(3, "months").startOf("month").format("YYYY-MM-DD"),
          end: configEnd ? configEnd.format("YYYY-MM-DD") : baseDate.clone().endOf("month").format("YYYY-MM-DD"),
        },
      };

      const termStart = ranges.term.start;
      const termEnd = ranges.term.end;

      // 1. Fetch all data for the term period in parallel
      // Use academic tags for fees and expenditures to align with Finance Central
      const feeQuery = (acadConfig.academicYear && acadConfig.currentTerm)
        ? query(
            collection(db, "feePayments"),
            where("academicYear", "==", acadConfig.academicYear),
            where("term", "==", acadConfig.currentTerm)
          )
        : query(
            collection(db, "feePayments"),
            where("date", ">=", termStart),
            where("date", "<=", termEnd)
          );

      const expQuery = (acadConfig.academicYear && acadConfig.currentTerm)
        ? query(
            collection(db, "expenditures"),
            where("academicYear", "==", acadConfig.academicYear),
            where("term", "==", acadConfig.currentTerm)
          )
        : query(
            collection(db, "expenditures"),
            where("date", ">=", termStart),
            where("date", "<=", termEnd)
          );

      const dailyQuery = (acadConfig.academicYear && acadConfig.currentTerm)
        ? query(
            collection(db, "dailyFinancials"),
            where("academicYear", "==", acadConfig.academicYear),
            where("term", "==", acadConfig.currentTerm)
          )
        : query(
            collection(db, "dailyFinancials"),
            where("date", ">=", termStart),
            where("date", "<=", termEnd)
          );

      const [dailySnap, feeSnap, expSnap, scholarshipSnap] = await Promise.all([
        getDocsFromServer(dailyQuery as any),
        getDocsFromServer(feeQuery as any),
        getDocsFromServer(expQuery as any),
        getDocsFromServer(query(collection(db, "users"), where("role", "==", "student"), where("onScholarship", "==", true)) as any),
      ]);

      const scholarshipUids = new Set(scholarshipSnap.docs.map(d => d.id));

      // Initialize results mapping
      const catResults: Record<string, CategorySummary> = {
        "General Student Fees": {
          name: "General Student Fees",
          icon: "cash",
          color: VIBE.primary,
          today: { label: "Today", total: 0, count: 0 },
          week: { label: "This Week", total: 0, count: 0 },
          month: { label: "This Month", total: 0, count: 0 },
          term: { label: "This Term", total: 0, count: 0 },
          allPeriodsTotal: 0,
        },
        "Feeding Fees": {
          name: "Feeding Fees",
          icon: "restaurant",
          color: VIBE.success,
          today: { label: "Today", total: 0, count: 0 },
          week: { label: "This Week", total: 0, count: 0 },
          month: { label: "This Month", total: 0, count: 0 },
          term: { label: "This Term", total: 0, count: 0 },
          allPeriodsTotal: 0,
        },
        "Bus Fees": {
          name: "Bus Fees",
          icon: "bus",
          color: VIBE.info,
          today: { label: "Today", total: 0, count: 0 },
          week: { label: "This Week", total: 0, count: 0 },
          month: { label: "This Month", total: 0, count: 0 },
          term: { label: "This Term", total: 0, count: 0 },
          allPeriodsTotal: 0,
        },
        "Extra Classes": {
          name: "Extra Classes",
          icon: "book",
          color: VIBE.purple,
          today: { label: "Today", total: 0, count: 0 },
          week: { label: "This Week", total: 0, count: 0 },
          month: { label: "This Month", total: 0, count: 0 },
          term: { label: "This Term", total: 0, count: 0 },
          allPeriodsTotal: 0,
        },
        "Expenditure": {
          name: "Expenditure",
          icon: "card",
          color: VIBE.danger,
          today: { label: "Today", total: 0, count: 0 },
          week: { label: "This Week", total: 0, count: 0 },
          month: { label: "This Month", total: 0, count: 0 },
          term: { label: "This Term", total: 0, count: 0 },
          allPeriodsTotal: 0,
        },
      };

      const isInRange = (date: string, range: { start: string; end: string }) =>
        date >= range.start && date <= range.end;

      // Initialize daily totals map
      const dailyTotalsMap: Record<string, DailyTotal> = {};

      const getOrCreateDaily = (date: string) => {
        if (!dailyTotalsMap[date]) {
          dailyTotalsMap[date] = {
            date,
            feeding: 0,
            bus: 0,
            extra: 0,
            generalFees: 0,
            expenditure: 0,
            totalRevenue: 0,
          };
        }
        return dailyTotalsMap[date];
      };

      // Process dailyFinancials (Feeding, Bus, Extra)
      dailySnap.docs.forEach((doc) => {
        const data = doc.data() as any;
        const date = data.date;
        const daily = getOrCreateDaily(date);

        const matchesTerm = (acadConfig.academicYear && acadConfig.currentTerm)
          ? (data.academicYear === acadConfig.academicYear && data.term === acadConfig.currentTerm)
          : isInRange(date, ranges.term);

        // Feeding
        if (data.feedingFee > 0 && data.feedingPaid === true) {
          const cat = catResults["Feeding Fees"];
          if (isInRange(date, ranges.today)) { cat.today.total += data.feedingFee; cat.today.count++; }
          if (isInRange(date, ranges.week)) { cat.week.total += data.feedingFee; cat.week.count++; }
          if (isInRange(date, ranges.month)) { cat.month.total += data.feedingFee; cat.month.count++; }
          if (matchesTerm) { cat.term.total += data.feedingFee; cat.term.count++; }
          daily.feeding += data.feedingFee;
          // Not adding to daily.totalRevenue as per requirement
        }
        // Bus
        if (data.busFee > 0 && data.busPaid === true) {
          const cat = catResults["Bus Fees"];
          if (isInRange(date, ranges.today)) { cat.today.total += data.busFee; cat.today.count++; }
          if (isInRange(date, ranges.week)) { cat.week.total += data.busFee; cat.week.count++; }
          if (isInRange(date, ranges.month)) { cat.month.total += data.busFee; cat.month.count++; }
          if (matchesTerm) { cat.term.total += data.busFee; cat.term.count++; }
          daily.bus += data.busFee;
          // Not adding to daily.totalRevenue as per requirement
        }
        // Extra
        if (data.extraClassesFee > 0 && data.extraPaid === true) {
          const cat = catResults["Extra Classes"];
          if (isInRange(date, ranges.today)) { cat.today.total += data.extraClassesFee; cat.today.count++; }
          if (isInRange(date, ranges.week)) { cat.week.total += data.extraClassesFee; cat.week.count++; }
          if (isInRange(date, ranges.month)) { cat.month.total += data.extraClassesFee; cat.month.count++; }
          if (matchesTerm) { cat.term.total += data.extraClassesFee; cat.term.count++; }
          daily.extra += data.extraClassesFee;
          // Not adding to daily.totalRevenue as per requirement
        }
      });

      // Process feePayments (Tuition & Student Charges)
      feeSnap.docs.forEach((doc) => {
        const data = doc.data() as any;
        const date = data.date;
        const amount = data.amount || 0;
        const type = data.type || "tuition";
        const method = data.method || "";
        const daily = getOrCreateDaily(date);

        // Skip debt creation entries (Bulk Charges, Bills, System Billing) - only count actual payments
        const isDebtEntry =
          method.toLowerCase().includes("charge") ||
          method.toLowerCase().includes("bill") ||
          method === "System Billing";

        if (isDebtEntry || scholarshipUids.has(data.studentUid)) return;

        // Group all student ledger payments into General Student Fees
        const catKey = "General Student Fees";
        daily.generalFees += amount;
        daily.totalRevenue += amount;

        const cat = catResults[catKey];
        if (cat) {
          if (isInRange(date, ranges.today)) {
            cat.today.total += amount;
            cat.today.count++;
          }
          if (isInRange(date, ranges.week)) {
            cat.week.total += amount;
            cat.week.count++;
          }
          if (isInRange(date, ranges.month)) {
            cat.month.total += amount;
            cat.month.count++;
          }

          // Use tag matching if available to capture pre-payments/archived items correctly
          const matchesTerm = (acadConfig.academicYear && acadConfig.currentTerm)
            ? (data.academicYear === acadConfig.academicYear && data.term === acadConfig.currentTerm)
            : isInRange(date, ranges.term);

          if (matchesTerm) {
            cat.term.total += amount;
            cat.term.count++;
          }
        }
      });

      // Process expenditures
      expSnap.docs.forEach((doc) => {
        const data = doc.data() as any;
        const date = data.date;
        const amount = data.amount || 0;
        const daily = getOrCreateDaily(date);
        daily.expenditure += amount;

        const cat = catResults["Expenditure"];
        if (isInRange(date, ranges.today)) { cat.today.total += amount; cat.today.count++; }
        if (isInRange(date, ranges.week)) { cat.week.total += amount; cat.week.count++; }
        if (isInRange(date, ranges.month)) { cat.month.total += amount; cat.month.count++; }

        // Use tag matching if available to capture expenditure alignment correctly
        const matchesTerm = (acadConfig.academicYear && acadConfig.currentTerm)
          ? (data.academicYear === acadConfig.academicYear && data.term === acadConfig.currentTerm)
          : isInRange(date, ranges.term);

        if (matchesTerm) { cat.term.total += amount; cat.term.count++; }
      });

      // Set authoritative totals (using the Term total)
      // To ensure "General Student Fees" matches ManageFees (useFeeStats),
      // we perform a final authoritative sum from studentFeeRecords for the Term total.
      if (acadConfig.academicYear && acadConfig.currentTerm) {
        const recordsQuery = query(
          collection(db, "studentFeeRecords"),
          where("academicYear", "==", acadConfig.academicYear),
          where("term", "==", acadConfig.currentTerm)
        );
        const recordsSnap = await getDocsFromServer(recordsQuery as any);
        let authoritativeTermTotal = 0;
        let authoritativeTermCount = 0;

        recordsSnap.docs.forEach(doc => {
          const data = doc.data() as any;
          if (scholarshipUids.has(data.studentUid)) return;

          const received = (data.amountPaid || 0) +
            (data.ptaPaid || 0) +
            (data.maintenancePaid || 0) +
            (data.admissionPaid || 0) +
            (data.booksPaid || 0) +
            (data.uniformPaid || 0) +
            (data.otherPaid || 0);

          if (received > 0) {
            authoritativeTermTotal += received;
            authoritativeTermCount++;
          }
        });

        catResults["General Student Fees"].term.total = authoritativeTermTotal;
        catResults["General Student Fees"].term.count = authoritativeTermCount;
      }

      const finalResults = Object.values(catResults).map(cat => ({
        ...cat,
        allPeriodsTotal: cat.term.total
      }));

      setCategories(finalResults);
      setDailyTotals(Object.values(dailyTotalsMap).sort((a, b) => b.date.localeCompare(a.date)));
    } catch (e) {
      console.error("Error loading summaries:", e);
      showToast({
        message: "Failed to load financial summaries.",
        type: "error",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate, showToast, acadConfig]);


  useEffect(() => {
    loadSummaries();
  }, [loadSummaries]);

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
          <View
            style={[
              styles.categoryIconBox,
              { backgroundColor: category.color + "10" },
            ]}
          >
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
              <Text style={styles.periodValue}>
                ₵{period.data.total.toLocaleString()}
              </Text>
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
          const dailyNetFromFees = item.totalRevenue - item.expenditure;
          const dailyFinancialsSum = item.feeding + item.bus + item.extra;
          const totalDailyNet = dailyNetFromFees + dailyFinancialsSum;
          const isProfit = totalDailyNet >= 0;

          return (
            <View key={item.date} style={styles.dailyRow}>
              <View style={styles.dailyHeader}>
                <View>
                  <Text style={styles.dailyDate}>
                    {moment(item.date).format("ddd, MMM DD")}
                  </Text>
                  <Text style={styles.dailyYear}>
                    {moment(item.date).format("YYYY")}
                  </Text>
                </View>
                <View style={styles.dailySummaryRight}>
                  <Text style={[styles.dailyRevenue, { color: VIBE.success }]}>
                    Fees: +₵{item.totalRevenue.toLocaleString()}
                  </Text>
                  <Text style={[styles.dailyExpense, { color: VIBE.danger }]}>
                    Exp: -₵{item.expenditure.toLocaleString()}
                  </Text>
                </View>
              </View>

              <View style={styles.dailyGrid}>
                <View style={styles.dailyStat}>
                  <Text style={styles.dailyStatLabel}>Feeding</Text>
                  <Text style={styles.dailyStatValue} numberOfLines={1} adjustsFontSizeToFit>₵{item.feeding.toLocaleString()}</Text>
                </View>
                <View style={styles.dailyStat}>
                  <Text style={styles.dailyStatLabel}>Bus</Text>
                  <Text style={styles.dailyStatValue} numberOfLines={1} adjustsFontSizeToFit>₵{item.bus.toLocaleString()}</Text>
                </View>
                <View style={styles.dailyStat}>
                  <Text style={styles.dailyStatLabel}>Extra</Text>
                  <Text style={styles.dailyStatValue} numberOfLines={1} adjustsFontSizeToFit>₵{item.extra.toLocaleString()}</Text>
                </View>
                <View style={styles.dailyStat}>
                  <Text style={styles.dailyStatLabel}>Gen. Fees</Text>
                  <Text style={styles.dailyStatValue} numberOfLines={1} adjustsFontSizeToFit>₵{item.generalFees.toLocaleString()}</Text>
                </View>
                <View style={[styles.dailyNetBadge, { backgroundColor: isProfit ? VIBE.success + "15" : VIBE.danger + "15" }]}>
                   <Text style={[styles.dailyNetText, { color: isProfit ? VIBE.success : VIBE.danger }]}>
                    {isProfit ? "NET +" : "NET -"}₵{Math.abs(totalDailyNet).toLocaleString()}
                  </Text>
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
  const dailyCats = categories.filter((c) => ["Feeding Fees", "Bus Fees", "Extra Classes"].includes(c.name));
  const expenditureCat = categories.find((c) => c.name === "Expenditure");

  const totalFees = feeCat?.allPeriodsTotal || 0;
  const totalDailyFinancials = dailyCats.reduce((acc, cat) => acc + cat.allPeriodsTotal, 0);
  const totalExpenditure = expenditureCat?.allPeriodsTotal || 0;

  // Expenditure deducted from fees totals and not daily financials sum
  const netFees = totalFees - totalExpenditure;
  const netBalance = netFees + totalDailyFinancials;

  // totalRevenue for the "other fees summation" card should exclude daily financials
  const totalRevenue = totalFees;

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <SVGIcon name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.headerTitleText}>Financial Summary</Text>
          <Text style={styles.headerSubtitle}>
            Detailed breakdown by category
          </Text>
        </View>
        <TouchableOpacity
          onPress={generatePDF}
          style={[styles.adminBadge, { backgroundColor: VIBE.info, marginRight: 8 }]}
        >
          <SVGIcon name="download" size={14} color="#fff" />
          <Text style={styles.adminBadgeText}>EXPORT</Text>
        </TouchableOpacity>
        <View style={styles.adminBadge}>
          <SVGIcon name="shield-checkmark" size={14} color="#fff" />
          <Text style={styles.adminBadgeText}>ADMIN</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await loadSummaries();
              }}
            />
          }
        >
          {/* Overall Summary */}
          <View style={styles.overviewSection}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>📊 Financial Overview</Text>
                {acadConfig.termStart && (
                  <Text style={styles.dateRangeText}>
                    {moment(acadConfig.termStart.toDate ? acadConfig.termStart.toDate() : acadConfig.termStart).format("MMM D")} - {moment(acadConfig.termEnd.toDate ? acadConfig.termEnd.toDate() : acadConfig.termEnd).format("MMM D, YYYY")}
                  </Text>
                )}
              </View>
              <View style={styles.periodIndicator}>
                <Text style={styles.periodIndicatorText}>{acadConfig.currentTerm || "Current Term"}</Text>
              </View>
            </View>
            <View style={styles.overviewCards}>
              <View
                style={[
                  styles.mainBalanceCard,
                  {
                    backgroundColor: netBalance >= 0 ? VIBE.chart1 : VIBE.danger,
                  },
                ]}
              >
                <View style={styles.mainBalanceHeader}>
                   <Text style={styles.mainBalanceLabel}>Net Financial Position</Text>
                   <SVGIcon name={netBalance >= 0 ? "trending-up" : "trending-down"} size={20} color="#ffffff80" />
                </View>
                <Text
                  style={styles.mainBalanceValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                >
                  ₵{netBalance.toLocaleString()}
                </Text>
                <View style={styles.mainBalanceFooter}>
                  <Text style={styles.mainBalanceSubtext}>(Fees - Expenditure) + Daily Financials (₵{totalDailyFinancials.toLocaleString()})</Text>
                </View>
              </View>

              <View style={styles.secondaryOverviewRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[
                    styles.secondaryCard,
                    { borderLeftColor: VIBE.success },
                  ]}
                >
                  <Text style={styles.secondaryLabel} numberOfLines={1}>
                    Total Fees Received
                  </Text>
                  <Text
                    style={[styles.secondaryValue, { color: VIBE.success }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    ₵{totalRevenue.toLocaleString()}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[
                    styles.secondaryCard,
                    { borderLeftColor: VIBE.danger },
                  ]}
                >
                  <Text style={styles.secondaryLabel} numberOfLines={1}>
                    Total Expenses
                  </Text>
                  <Text
                    style={[styles.secondaryValue, { color: VIBE.danger }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    ₵{totalExpenditure.toLocaleString()}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* View Toggle */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === "categories" && styles.toggleBtnActive]}
              onPress={() => setViewMode("categories")}
            >
              <Text style={[styles.toggleText, viewMode === "categories" && styles.toggleTextActive]}>Categories</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === "daily" && styles.toggleBtnActive]}
              onPress={() => setViewMode("daily")}
            >
              <Text style={[styles.toggleText, viewMode === "daily" && styles.toggleTextActive]}>Daily Totals</Text>
            </TouchableOpacity>
          </View>

          {/* Dynamic Content */}
          <View style={styles.section}>
            {viewMode === "categories" ? (
              <>
                <Text style={styles.sectionTitle}>📋 Category Breakdown</Text>
                <Text style={styles.sectionSubtitle}>
                  Each category with Today, Week, Month, Term breakdown
                </Text>
                {categories.map((category) => renderCategoryCard(category))}
              </>
            ) : (
              <>
                <Text style={styles.sectionTitle}>📅 Daily Performance</Text>
                <Text style={styles.sectionSubtitle}>
                  Revenue vs Expenditure for the last 3 months
                </Text>
                {renderDailyTotals()}
              </>
            )}
          </View>

          {/* Financial Health */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📈 Financial Health</Text>
            <View style={styles.healthCard}>
              <View style={styles.healthRow}>
                <Text style={styles.healthLabel}>Expense Ratio</Text>
                <Text
                  style={[
                    styles.healthValue,
                    { color: netBalance >= 0 ? VIBE.success : VIBE.danger },
                  ]}
                >
                  {totalRevenue > 0
                    ? ((totalExpenditure / totalRevenue) * 100).toFixed(1)
                    : 0}
                  %
                </Text>
              </View>
              <View style={styles.healthBarContainer}>
                <View
                  style={[
                    styles.healthBar,
                    {
                      width: `${totalRevenue > 0 ? Math.min((totalExpenditure / totalRevenue) * 100, 100) : 0}%`,
                      backgroundColor:
                        netBalance >= 0 ? VIBE.success : VIBE.danger,
                    },
                  ]}
                />
              </View>
              <Text style={styles.healthFooter}>
                {netBalance >= 0
                  ? `Expenditure accounts for ${totalRevenue > 0 ? ((totalExpenditure / totalRevenue) * 100).toFixed(1) : 0}% of total revenue.`
                  : "Expenditures exceed total revenue. Financial adjustment may be required."}
              </Text>
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚡ Quick Actions</Text>
            <View style={styles.quickActionsRow}>
              <TouchableOpacity
                style={styles.quickActionBtn}
                onPress={() => router.push("/shared/daily-financials" as any)}
              >
                <SVGIcon name="receipt" size={20} color={VIBE.primary} />
                <Text style={[styles.quickActionText, { color: VIBE.primary }]}>
                  Record Fees
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickActionBtn}
                onPress={handleBack}
              >
                <SVGIcon name="arrow-back" size={20} color={VIBE.muted} />
                <Text style={[styles.quickActionText, { color: VIBE.muted }]}>
                  Go Back
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VIBE.bg },
  centerContent: { flex: 1, justifyContent: "center", alignItems: "center" },
  centerText: { marginTop: 16, color: VIBE.muted, fontSize: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: VIBE.surface,
    borderBottomWidth: 1,
    borderBottomColor: VIBE.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: VIBE.bg,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  headerTitle: { flex: 1 },
  headerTitleText: { fontSize: 20, fontWeight: "800", color: VIBE.text },
  headerSubtitle: { fontSize: 12, color: VIBE.muted, marginTop: 1 },
  adminBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: VIBE.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 4,
  },
  adminBadgeText: { fontSize: 10, fontWeight: "900", color: "#fff" },
  dateRangeText: {
    fontSize: 12,
    color: VIBE.muted,
    fontWeight: "600",
    marginTop: -2,
  },
  overviewSection: { padding: 20 },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  periodIndicator: {
    backgroundColor: VIBE.bg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: VIBE.border,
  },
  periodIndicatorText: {
    fontSize: 11,
    fontWeight: "700",
    color: VIBE.muted,
  },
  mainBalanceCard: {
    width: "100%",
    padding: 24,
    borderRadius: 28,
    ...SHADOWS.medium,
    marginBottom: 12,
    minHeight: 140,
    justifyContent: "center",
    elevation: 8,
  },
  mainBalanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  mainBalanceLabel: {
    color: "#ffffffCC",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  mainBalanceValue: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "900",
  },
  mainBalanceFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#ffffff20",
  },
  mainBalanceSubtext: {
    color: "#ffffffB3",
    fontSize: 12,
    fontWeight: "600",
  },
  secondaryOverviewRow: {
    flexDirection: "row",
    width: "100%",
    gap: 12,
    marginTop: 8,
  },
  secondaryCard: {
    flex: 1,
    backgroundColor: VIBE.surface,
    padding: 16,
    borderRadius: 24,
    borderLeftWidth: 6,
    justifyContent: "center",
    minHeight: 100,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  secondaryLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: VIBE.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  secondaryValue: {
    fontSize: 22,
    fontWeight: "900",
    includeFontPadding: false,
  },
  section: { paddingHorizontal: 20, paddingBottom: 20 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: VIBE.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: VIBE.muted,
    marginBottom: 16,
  },
  overviewCards: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 12,
  },
  overviewCard: {
    flex: 1,
    minWidth: "45%",
    padding: 20,
    borderRadius: 24,
    justifyContent: "center",
  },
  overviewLabel: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  overviewValue: {
    fontSize: 22,
    fontWeight: "900",
  },
  categoryCard: {
    backgroundColor: VIBE.surface,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    ...SHADOWS.medium,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  categoryIconBox: {
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  categoryTitleRow: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryName: {
    fontSize: 17,
    fontWeight: "800",
    color: VIBE.text,
  },
  categoryTermLabel: {
    fontSize: 11,
    color: VIBE.muted,
    fontWeight: "600",
    marginTop: 1,
  },
  categoryTotal: {
    fontSize: 20,
    fontWeight: "900",
  },
  periodsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  periodItem: {
    flex: 1,
    backgroundColor: VIBE.bg,
    padding: 12,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  periodLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: VIBE.muted,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  periodValue: {
    fontSize: 13,
    fontWeight: "800",
    color: VIBE.text,
    includeFontPadding: false,
  },
  periodBadge: {
    backgroundColor: VIBE.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  periodCount: {
    fontSize: 9,
    fontWeight: "700",
    color: VIBE.primary,
  },
  healthCard: {
    backgroundColor: VIBE.surface,
    padding: 20,
    borderRadius: 24,
    ...SHADOWS.medium,
  },
  healthRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  healthLabel: { fontSize: 15, fontWeight: "800", color: VIBE.text },
  healthValue: { fontSize: 16, fontWeight: "900" },
  healthBarContainer: {
    height: 10,
    backgroundColor: VIBE.bg,
    borderRadius: 5,
    overflow: "hidden",
    marginBottom: 14,
  },
  healthBar: {
    height: "100%",
    borderRadius: 5,
  },
  healthFooter: {
    fontSize: 12,
    color: VIBE.muted,
    fontWeight: "600",
    lineHeight: 18,
  },
  quickActionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: VIBE.surface,
    padding: 16,
    borderRadius: 18,
    ...SHADOWS.medium,
  },
  quickActionText: { fontSize: 14, fontWeight: "700" },

  // New Styles
  toggleContainer: {
    flexDirection: "row",
    backgroundColor: VIBE.border,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 4,
    height: 48,
  },
  toggleBtn: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
  },
  toggleBtnActive: {
    backgroundColor: VIBE.surface,
    ...SHADOWS.medium,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "700",
    color: VIBE.muted,
  },
  toggleTextActive: {
    color: VIBE.primary,
  },
  dailyTotalsContainer: {
    marginTop: 10,
  },
  dailyRow: {
    backgroundColor: VIBE.surface,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: VIBE.bg,
  },
  dailyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: VIBE.bg,
    marginBottom: 16,
  },
  dailyDate: {
    fontSize: 17,
    fontWeight: "800",
    color: VIBE.text,
  },
  dailyYear: {
    fontSize: 12,
    color: VIBE.muted,
    fontWeight: "600",
  },
  dailySummaryRight: {
    alignItems: "flex-end",
  },
  dailyRevenue: {
    fontSize: 16,
    fontWeight: "900",
  },
  dailyExpense: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  dailyGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 16,
    columnGap: 8,
  },
  dailyStat: {
    width: "30%",
  },
  dailyStatLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: VIBE.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dailyStatValue: {
    fontSize: 14,
    fontWeight: "700",
    color: VIBE.text,
    marginTop: 4,
    includeFontPadding: false,
  },
  dailyNetBadge: {
    width: "100%",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  dailyNetText: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.5,
    includeFontPadding: false,
  },
});
