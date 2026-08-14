import { useState, useCallback, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { collection, query, where, getDocsFromServer } from "firebase/firestore";
import moment from "moment";
import { db } from "../firebaseConfig";
import { VIBE } from "../app/admin-dashboard/FinancialSummary.styles";

const CACHE_KEY = "financial_summary_cache_v1";
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

export type PeriodData = {
  label: string;
  total: number;
  count: number;
};

export type CategorySummary = {
  name: string;
  icon: string;
  color: string;
  today: PeriodData;
  week: PeriodData;
  month: PeriodData;
  term: PeriodData;
  allPeriodsTotal: number;
};

export type DailyTotal = {
  date: string;
  feeding: number;
  bus: number;
  extra: number;
  generalFees: number;
  expenditure: number;
};

export type FeeStats = {
  billed: number;
  paid: number;
  balance: number;
  discount: number;
  discountCount: number;
};

export type LedgerItem = {
    name: string;
    billed: number;
    paid: number;
    balance: number;
};

export const useFinancialData = (acadConfig: any, showToast: any) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [dailyTotals, setDailyTotals] = useState<DailyTotal[]>([]);
  const [ledgerItems, setLedgerItems] = useState<LedgerItem[]>([]);
  const [feeStats, setFeeStats] = useState<FeeStats>({
    billed: 0,
    paid: 0,
    balance: 0,
    discount: 0,
    discountCount: 0,
  });
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const loadSummaries = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);

      if (!forceRefresh) {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const isExpired = Date.now() - timestamp > CACHE_DURATION;

          if (!isExpired) {
            setCategories(data.categories);
            setDailyTotals(data.dailyTotals);
            setLedgerItems(data.ledgerItems);
            setFeeStats(data.feeStats);
            setLastUpdated(timestamp);
            setLoading(false);
            return;
          }
        }
      }

      const baseDate = moment();

      // Parse Academic Config Dates
      const configStart = acadConfig.termStart
        ? moment(acadConfig.termStart.toDate ? acadConfig.termStart.toDate() : acadConfig.termStart)
        : null;
      const configEnd = acadConfig.termEnd
        ? moment(acadConfig.termEnd.toDate ? acadConfig.termEnd.toDate() : acadConfig.termEnd)
        : null;

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

      const [dailySnap, feeSnap, expSnap, scholarshipSnap, allFeeRecordsSnap] = await Promise.all([
        getDocsFromServer(dailyQuery as any),
        getDocsFromServer(feeQuery as any),
        getDocsFromServer(expQuery as any),
        getDocsFromServer(query(collection(db, "users"), where("role", "==", "student"), where("onScholarship", "==", true)) as any),
        (acadConfig.academicYear && acadConfig.currentTerm)
          ? getDocsFromServer(query(collection(db, "studentFeeRecords"), where("academicYear", "==", acadConfig.academicYear), where("term", "==", acadConfig.currentTerm)) as any)
          : Promise.resolve({ docs: [] } as any),
      ]);

      const scholarshipUids = new Set(scholarshipSnap.docs.map(d => d.id));

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
          };
        }
        return dailyTotalsMap[date];
      };

      dailySnap.docs.forEach((doc) => {
        const data = doc.data() as any;
        const date = data.date;
        const daily = getOrCreateDaily(date);

        const matchesTerm = (acadConfig.academicYear && acadConfig.currentTerm)
          ? (data.academicYear === acadConfig.academicYear && data.term === acadConfig.currentTerm)
          : isInRange(date, ranges.term);

        if (data.feedingFee > 0 && data.feedingPaid === true) {
          const cat = catResults["Feeding Fees"];
          if (isInRange(date, ranges.today)) { cat.today.total += data.feedingFee; cat.today.count++; }
          if (isInRange(date, ranges.week)) { cat.week.total += data.feedingFee; cat.week.count++; }
          if (isInRange(date, ranges.month)) { cat.month.total += data.feedingFee; cat.month.count++; }
          if (matchesTerm) { cat.term.total += data.feedingFee; cat.term.count++; }
          daily.feeding += data.feedingFee;
        }
        if (data.busFee > 0 && data.busPaid === true) {
          const cat = catResults["Bus Fees"];
          if (isInRange(date, ranges.today)) { cat.today.total += data.busFee; cat.today.count++; }
          if (isInRange(date, ranges.week)) { cat.week.total += data.busFee; cat.week.count++; }
          if (isInRange(date, ranges.month)) { cat.month.total += data.busFee; cat.month.count++; }
          if (matchesTerm) { cat.term.total += data.busFee; cat.term.count++; }
          daily.bus += data.busFee;
        }
        if (data.extraClassesFee > 0 && data.extraPaid === true) {
          const cat = catResults["Extra Classes"];
          if (isInRange(date, ranges.today)) { cat.today.total += data.extraClassesFee; cat.today.count++; }
          if (isInRange(date, ranges.week)) { cat.week.total += data.extraClassesFee; cat.week.count++; }
          if (isInRange(date, ranges.month)) { cat.month.total += data.extraClassesFee; cat.month.count++; }
          if (matchesTerm) { cat.term.total += data.extraClassesFee; cat.term.count++; }
          daily.extra += data.extraClassesFee;
        }
      });

      feeSnap.docs.forEach((doc) => {
        const data = doc.data() as any;
        const date = data.date;
        const amount = data.amount || 0;
        const method = data.method || "";
        const daily = getOrCreateDaily(date);

        const isDebtEntry =
          method.toLowerCase().includes("charge") ||
          method.toLowerCase().includes("bill") ||
          method === "System Billing";

        if (isDebtEntry || scholarshipUids.has(data.studentUid)) return;

        daily.generalFees += amount;
        const cat = catResults["General Student Fees"];
        if (isInRange(date, ranges.today)) { cat.today.total += amount; cat.today.count++; }
        if (isInRange(date, ranges.week)) { cat.week.total += amount; cat.week.count++; }
        if (isInRange(date, ranges.month)) { cat.month.total += amount; cat.month.count++; }

        const matchesTerm = (acadConfig.academicYear && acadConfig.currentTerm)
          ? (data.academicYear === acadConfig.academicYear && data.term === acadConfig.currentTerm)
          : isInRange(date, ranges.term);

        if (matchesTerm) { cat.term.total += amount; cat.term.count++; }
      });

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

        const matchesTerm = (acadConfig.academicYear && acadConfig.currentTerm)
          ? (data.academicYear === acadConfig.academicYear && data.term === acadConfig.currentTerm)
          : isInRange(date, ranges.term);

        if (matchesTerm) { cat.term.total += amount; cat.term.count++; }
      });

      const ledgerMap: Record<string, { billed: number; paid: number; balance: number }> = {
        "Tuition": { billed: 0, paid: 0, balance: 0 },
        "Admission": { billed: 0, paid: 0, balance: 0 },
        "PTA": { billed: 0, paid: 0, balance: 0 },
        "Maintenance": { billed: 0, paid: 0, balance: 0 },
        "Books": { billed: 0, paid: 0, balance: 0 },
        "Uniforms": { billed: 0, paid: 0, balance: 0 },
        "Other": { billed: 0, paid: 0, balance: 0 },
      };

      let authoritativeBilled = 0;
      let authoritativePaid = 0;
      let authoritativeBalance = 0;
      let authoritativeDiscount = 0;
      let authoritativeDiscountCount = 0;

      if (acadConfig.academicYear && acadConfig.currentTerm) {
        allFeeRecordsSnap.docs.forEach((doc: any) => {
          const data = doc.data() as any;
          if (scholarshipUids.has(data.studentUid)) return;

          authoritativeBilled += (data.totalPayable || 0);
          ledgerMap["Tuition"].billed += (data.billAmount || 0);
          ledgerMap["Tuition"].paid += (data.amountPaid || 0);
          ledgerMap["Tuition"].balance += (data.balance || 0);
          ledgerMap["Admission"].billed += (data.admissionBill || 0);
          ledgerMap["Admission"].paid += (data.admissionPaid || 0);
          ledgerMap["Admission"].balance += (data.admissionBalance || 0);
          ledgerMap["PTA"].billed += (data.ptaBill || 0);
          ledgerMap["PTA"].paid += (data.ptaPaid || 0);
          ledgerMap["PTA"].balance += (data.ptaBalance || 0);
          ledgerMap["Maintenance"].billed += (data.maintenanceBill || 0);
          ledgerMap["Maintenance"].paid += (data.maintenancePaid || 0);
          ledgerMap["Maintenance"].balance += (data.maintenanceBalance || 0);
          ledgerMap["Books"].billed += (data.booksBill || 0);
          ledgerMap["Books"].paid += (data.booksPaid || 0);
          ledgerMap["Books"].balance += (data.booksBalance || 0);
          ledgerMap["Uniforms"].billed += (data.uniformBill || 0);
          ledgerMap["Uniforms"].paid += (data.uniformPaid || 0);
          ledgerMap["Uniforms"].balance += (data.uniformBalance || 0);
          ledgerMap["Other"].billed += (data.otherBill || 0);
          ledgerMap["Other"].paid += (data.otherPaid || 0);
          ledgerMap["Other"].balance += (data.otherBalance || 0);

          const received = (data.amountPaid || 0) + (data.ptaPaid || 0) + (data.maintenancePaid || 0) + (data.admissionPaid || 0) + (data.booksPaid || 0) + (data.uniformPaid || 0) + (data.otherPaid || 0);
          authoritativePaid += received;
          authoritativeBalance += (data.balance || 0);
          authoritativeDiscount += (data.discount || 0);
          if ((data.discount || 0) > 0) authoritativeDiscountCount++;
        });

        catResults["General Student Fees"].term.total = authoritativePaid;
      }

      const finalLedger = Object.keys(ledgerMap).map(name => ({ name, ...ledgerMap[name] }));
      const finalStats = {
        billed: authoritativeBilled,
        paid: authoritativePaid,
        balance: authoritativeBalance,
        discount: authoritativeDiscount,
        discountCount: authoritativeDiscountCount,
      };

      const finalResults = Object.values(catResults).map(cat => ({ ...cat, allPeriodsTotal: cat.term.total }));
      const finalDailyTotals = Object.values(dailyTotalsMap).sort((a, b) => b.date.localeCompare(a.date));

      setCategories(finalResults);
      setDailyTotals(finalDailyTotals);
      setLedgerItems(finalLedger);
      setFeeStats(finalStats);

      const cacheData = { categories: finalResults, dailyTotals: finalDailyTotals, ledgerItems: finalLedger, feeStats: finalStats };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ data: cacheData, timestamp: Date.now() }));
      setLastUpdated(Date.now());
    } catch (e) {
      console.error("Error loading summaries:", e);
      showToast({ message: "Failed to load financial summaries.", type: "error" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [acadConfig, showToast]);

  useEffect(() => { loadSummaries(); }, [loadSummaries]);

  return { loading, refreshing, categories, dailyTotals, ledgerItems, feeStats, lastUpdated, loadSummaries };
};
