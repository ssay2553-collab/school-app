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
    discount: number;
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

      const [dailySnap, feeSnap, expSnap, studentsSnap, allFeeRecordsSnap] = await Promise.all([
        getDocsFromServer(dailyQuery as any),
        getDocsFromServer(feeQuery as any),
        getDocsFromServer(expQuery as any),
        getDocsFromServer(query(collection(db, "users"), where("role", "==", "student")) as any),
        (acadConfig.academicYear && acadConfig.currentTerm)
          ? getDocsFromServer(query(collection(db, "studentFeeRecords"), where("academicYear", "==", acadConfig.academicYear), where("term", "==", acadConfig.currentTerm)) as any)
          : Promise.resolve({ docs: [] } as any),
      ]);

      const validStudentUids = new Set(
        studentsSnap.docs
          .filter((d: any) => {
            const data = d.data();
            return ["active", "pending_activation"].includes(data.status);
          })
          .map((d: any) => d.id)
      );

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

        if (isDebtEntry || !validStudentUids.has(data.studentUid)) return;

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

      const ledgerMap: Record<string, { billed: number; discount: number; paid: number; balance: number }> = {
        "Tuition": { billed: 0, discount: 0, paid: 0, balance: 0 },
        "Admission": { billed: 0, discount: 0, paid: 0, balance: 0 },
        "PTA": { billed: 0, discount: 0, paid: 0, balance: 0 },
        "Maintenance": { billed: 0, discount: 0, paid: 0, balance: 0 },
        "Books": { billed: 0, discount: 0, paid: 0, balance: 0 },
        "Uniforms": { billed: 0, discount: 0, paid: 0, balance: 0 },
        "Other": { billed: 0, discount: 0, paid: 0, balance: 0 },
      };

      let authoritativeBilled = 0;
      let authoritativePaid = 0;
      let authoritativeBalance = 0;
      let authoritativeDiscount = 0;
      let authoritativeDiscountCount = 0;

      if (acadConfig.academicYear && acadConfig.currentTerm) {
        const recordsMap = new Map();
        allFeeRecordsSnap.docs.forEach((doc: any) => {
          const d = doc.data();
          recordsMap.set(d.studentUid, d);
        });

        studentsSnap.docs.forEach((sDoc: any) => {
          const sData = sDoc.data();
          // Filter: Active students
          if (!["active", "pending_activation"].includes(sData.status)) return;

          const data = recordsMap.get(sDoc.id);

          const termBill = data?.termBill || 0;
          const ptaBill = data?.ptaBill || 0;
          const maintenanceBill = data?.maintenanceBill || 0;
          const admissionBill = data?.admissionBill || 0;
          const booksBill = data?.booksBill || 0;
          const uniformBill = data?.uniformBill || 0;
          const otherBill = data?.otherBill || 0;

          // Arrears is either from the record or student wallet (if no record exists)
          const arrears = data ? (data.arrears || 0) : (sData.walletBalance || 0);
          const discount = data?.discount || 0;

          const tuitionPaid = data?.amountPaid || 0;
          const ptaPaid = data?.ptaPaid || 0;
          const maintenancePaid = data?.maintenancePaid || 0;
          const admissionPaid = data?.admissionPaid || 0;
          const booksPaid = data?.booksPaid || 0;
          const uniformPaid = data?.uniformPaid || 0;
          const otherPaid = data?.otherPaid || 0;

          const studentTotalBilled = arrears + termBill + ptaBill + maintenanceBill + admissionBill + booksBill + uniformBill + otherBill;
          const studentTotalPaid = tuitionPaid + ptaPaid + maintenancePaid + admissionPaid + booksPaid + uniformPaid + otherPaid;

          // Total Balance = Payable - Discount - Paid
          const studentTotalBalance = studentTotalBilled - discount - studentTotalPaid;

          authoritativeBilled += studentTotalBilled;
          authoritativePaid += studentTotalPaid;
          authoritativeBalance += studentTotalBalance;
          authoritativeDiscount += discount;
          if (discount > 0) authoritativeDiscountCount++;

          // Categorized balances
          const ptaBalance = ptaBill - ptaPaid;
          const maintenanceBalance = maintenanceBill - maintenancePaid;
          const admissionBalance = admissionBill - admissionPaid;
          const booksBalance = booksBill - booksPaid;
          const uniformBalance = uniformBill - uniformPaid;
          const otherBalance = otherBill - otherPaid;

          const othersTotalBalance = ptaBalance + maintenanceBalance + admissionBalance + booksBalance + uniformBalance + otherBalance;

          // Tuition absorbs Arrears and Discounts in this view
          const tuitionBalance = studentTotalBalance - othersTotalBalance;

          ledgerMap["Tuition"].billed += termBill + arrears;
          ledgerMap["Tuition"].discount += discount;
          ledgerMap["Tuition"].paid += tuitionPaid;
          ledgerMap["Tuition"].balance += tuitionBalance;

          ledgerMap["Admission"].billed += admissionBill;
          ledgerMap["Admission"].paid += admissionPaid;
          ledgerMap["Admission"].balance += admissionBalance;

          ledgerMap["PTA"].billed += ptaBill;
          ledgerMap["PTA"].paid += ptaPaid;
          ledgerMap["PTA"].balance += ptaBalance;

          ledgerMap["Maintenance"].billed += maintenanceBill;
          ledgerMap["Maintenance"].paid += maintenancePaid;
          ledgerMap["Maintenance"].balance += maintenanceBalance;

          ledgerMap["Books"].billed += booksBill;
          ledgerMap["Books"].paid += booksPaid;
          ledgerMap["Books"].balance += booksBalance;

          ledgerMap["Uniforms"].billed += uniformBill;
          ledgerMap["Uniforms"].paid += uniformPaid;
          ledgerMap["Uniforms"].balance += uniformBalance;

          ledgerMap["Other"].billed += otherBill;
          ledgerMap["Other"].paid += otherPaid;
          ledgerMap["Other"].balance += otherBalance;
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
