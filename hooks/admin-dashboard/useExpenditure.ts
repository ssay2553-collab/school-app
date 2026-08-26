import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocsFromServer,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore';
import moment from 'moment';
import { useRef } from 'react';
import { db } from '../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { useAcademicConfig } from '../useAcademicConfig';
import { useToast } from '../../contexts/ToastContext';
import { Expenditure, GroupedExpenditure } from '../../constants/admin-dashboard/ExpenditureConstants';

export function useExpenditure() {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const acadConfig = useAcademicConfig();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expenditures, setExpenditures] = useState<Expenditure[]>([]);
  const [serverTotal, setServerTotal] = useState(0);

  const [selectedYear, setSelectedYear] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("");
  const [isPreviousTerm, setIsPreviousTerm] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (!acadConfig.loading) {
      if (isMounted.current) {
        setSelectedYear(acadConfig.academicYear || "");
        setSelectedTerm(acadConfig.currentTerm || "");
      }
      if (!acadConfig.academicYear || !acadConfig.currentTerm) {
        if (isMounted.current) setLoading(false);
      }
    }
  }, [acadConfig]);

  useEffect(() => {
    if (!selectedYear || !selectedTerm) {
      if (isMounted.current) setLoading(false);
      return;
    }

    if (expenditures.length === 0) {
      if (isMounted.current) setLoading(true);
    }

    const q = query(
      collection(db, "expenditures"),
      where("academicYear", "==", selectedYear),
      where("term", "==", selectedTerm),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot) => {
        const list = snapshot.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            ...data,
            amount: Number(data.amount) || 0,
            item: data.item || "Unnamed Expense",
            category: data.category || "",
            subCategory: data.subCategory || "",
            date: data.date || "N/A",
            adminName: data.adminName || "Admin",
            adminRole: data.adminRole || "Staff",
            receiptUrl: data.receiptUrl || "",
            createdAt: data.createdAt || null,
          } as Expenditure;
        });

        const sorted = list.sort((a, b) => {
          const getMillis = (ts: any) =>
            ts?.toMillis ? ts.toMillis() : Date.now() + 10000;
          return getMillis(b.createdAt) - getMillis(a.createdAt);
        });

        const uniqueList = Array.from(
          new Map(sorted.map((item) => [item.id, item])).values(),
        );

        if (isMounted.current) {
          setExpenditures(uniqueList);

          const total = uniqueList.reduce(
            (sum, item) => sum + (item.amount || 0),
            0,
          );
          setServerTotal(total);

          setLoading(false);
          setRefreshing(false);
        }
      },
      (error) => {
        if (isMounted.current) {
          console.error("Expenditure snapshot error:", error);
          setLoading(false);
          setRefreshing(false);
        }
      },
    );

    return () => unsubscribe();
  }, [selectedYear, selectedTerm]);

  const fetchExpenditures = useCallback(
    async (force = false) => {
      if (!selectedYear || !selectedTerm) return;
      setRefreshing(true);
      try {
        const q = query(
          collection(db, "expenditures"),
          where("academicYear", "==", selectedYear),
          where("term", "==", selectedTerm),
          orderBy("createdAt", "desc"),
        );

        const snap = await getDocsFromServer(q as any);
        const list = snap.docs.map(
          (d) => ({ id: d.id, ...(d.data() as any) }) as Expenditure,
        );
        const uniqueList = Array.from(
          new Map(list.map((item) => [item.id, item])).values(),
        );
        if (isMounted.current) {
          setExpenditures(uniqueList);
          const total = uniqueList.reduce(
            (sum, item) => sum + (item.amount || 0),
            0,
          );
          setServerTotal(total);
        }
      } catch (e) {
        if (isMounted.current) console.error("fetchExpenditures error:", e);
      } finally {
        if (isMounted.current) setRefreshing(false);
      }
    },
    [selectedYear, selectedTerm],
  );

  const fetchPreviousTerm = useCallback(() => {
    if (!acadConfig.academicYear || !acadConfig.currentTerm) return;

    let prevTerm = "";
    let prevYear = acadConfig.academicYear;

    if (
      acadConfig.currentTerm.toLowerCase().includes("term 3") ||
      acadConfig.currentTerm.toLowerCase().includes("3rd")
    ) {
      prevTerm = "Term 2";
    } else if (
      acadConfig.currentTerm.toLowerCase().includes("term 2") ||
      acadConfig.currentTerm.toLowerCase().includes("2nd")
    ) {
      prevTerm = "Term 1";
    } else {
      const yearParts = acadConfig.academicYear.split("/");
      if (yearParts.length === 2) {
        const startYear = parseInt(yearParts[0]);
        const endYear = parseInt(yearParts[1]);
        prevYear = `${startYear - 1}/${endYear - 1}`;
        prevTerm = "Term 3";
      }
    }

    if (prevTerm) {
      setSelectedYear(prevYear);
      setSelectedTerm(prevTerm);
      setIsPreviousTerm(true);
      showToast({
        message: `Viewing Archive: ${prevYear} - ${prevTerm}`,
        type: "info",
      });
    }
  }, [acadConfig, showToast]);

  const resetToCurrentTerm = useCallback(() => {
    setSelectedYear(acadConfig.academicYear || "");
    setSelectedTerm(acadConfig.currentTerm || "");
    setIsPreviousTerm(false);
  }, [acadConfig]);

  const addExpenditure = async (data: {
    itemName: string;
    category: string;
    subCategory: string;
    amount: string;
    itemDate: Date;
    receiptUrl?: string;
  }) => {
    const cleanItemName = data.itemName.trim();
    const cleanAmount = parseFloat(data.amount);

    if (!cleanItemName || isNaN(cleanAmount)) {
      showToast({
        message: "Please provide a valid item name and amount.",
        type: "error",
      });
      return false;
    }

    if (!appUser) {
      showToast({ message: "Session expired.", type: "error" });
      return false;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, "expenditures"), {
        item: cleanItemName,
        category: data.category.trim(),
        subCategory: data.subCategory.trim(),
        amount: cleanAmount,
        date: data.itemDate instanceof Date
            ? data.itemDate.toISOString().split("T")[0]
            : data.itemDate,
        receiptUrl: data.receiptUrl || "",
        adminName: appUser?.profile?.firstName || "Admin",
        adminRole: appUser?.adminRole || "Administrator",
        status: "open",
        academicYear: selectedYear,
        term: selectedTerm,
        createdAt: serverTimestamp(),
      });

      showToast({
        message: "Expenditure added successfully.",
        type: "success",
      });
      return true;
    } catch (e) {
      showToast({ message: "Save failed.", type: "error" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteExpenditure = async (item: Expenditure) => {
    setDeletingId(item.id);
    try {
      await deleteDoc(doc(db, "expenditures", item.id));

      try {
        await addDoc(collection(db, "activity_logs"), {
          action: "DELETE_EXPENDITURE",
          performedBy: appUser?.uid,
          adminName: appUser?.profile?.firstName || "Unknown Admin",
          details: {
            item: item.item,
            amount: item.amount,
            expenditureDate: item.date,
          },
          timestamp: serverTimestamp(),
        });
      } catch (logErr) {
        console.warn("Audit log failed, but expenditure was deleted:", logErr);
      }

      showToast({ message: "Entry deleted successfully.", type: "success" });
      return true;
    } catch (e: any) {
      console.error("Delete error:", e);
      showToast({
        message: e.message || "Could not delete entry.",
        type: "error",
      });
      return false;
    } finally {
      setDeletingId(null);
    }
  };

  const normalizeItemKey = (
    itemName: string,
  ): { key: string; displayItem: string } => {
    const lower = itemName.toLowerCase().trim();
    const payrollKeywords = [
      "payroll", "salary", "salaries", "wages", "wage", "staff salary", "staff salaries", "staff wages",
      "employee salary", "employee salaries", "employee wages", "teacher salary", "teacher salaries",
      "teacher wages", "staff payroll", "salary payment", "salary payments", "wage payment", "wage payments",
      "monthly salary", "monthly wages", "staff compensation", "employee compensation", "payroll expense",
      "payroll expenses", "salary expense", "salary expenses",
    ];

    for (const keyword of payrollKeywords) {
      if (
        lower === keyword ||
        lower.includes(keyword) ||
        lower.includes(keyword + " ") ||
        lower.includes(" " + keyword)
      ) {
        return { key: "__payroll__", displayItem: "Payroll" };
      }
    }
    return { key: lower, displayItem: itemName.trim() };
  };

  const groupedSummary = useMemo((): GroupedExpenditure[] => {
    if (expenditures.length === 0) return [];

    const now = moment();
    const currentMonthStart = now.clone().startOf("month");

    const grouped = new Map<
      string,
      {
        displayItem: string;
        monthTotal: number;
        termTotal: number;
        count: number;
      }
    >();

    expenditures.forEach((exp) => {
      const { key: itemKey, displayItem } =
        exp.category && exp.category.trim() !== ""
          ? {
              key: exp.category.toLowerCase().trim(),
              displayItem: exp.category.trim(),
            }
          : normalizeItemKey(exp.item);
      const existing = grouped.get(itemKey);

      if (!existing) {
        grouped.set(itemKey, {
          displayItem,
          monthTotal: 0,
          termTotal: 0,
          count: 0,
        });
      }

      const group = grouped.get(itemKey)!;
      group.count += 1;
      group.termTotal += exp.amount || 0;

      const expDate = moment(exp.date);
      if (expDate.isSameOrAfter(currentMonthStart)) {
        group.monthTotal += exp.amount || 0;
      }
    });

    return Array.from(grouped.entries())
      .map(([item, data]) => ({
        item,
        displayItem: data.displayItem,
        monthTotal: data.monthTotal,
        termTotal: data.termTotal,
        count: data.count,
      }))
      .sort((a, b) => b.termTotal - a.termTotal);
  }, [expenditures]);

  const summaryTotal = useMemo(() => {
    return groupedSummary.reduce((sum, item) => sum + item.termTotal, 0);
  }, [groupedSummary]);

  return {
    loading,
    refreshing,
    saving,
    deletingId,
    expenditures,
    serverTotal,
    selectedYear,
    selectedTerm,
    isPreviousTerm,
    groupedSummary,
    summaryTotal,
    fetchExpenditures,
    fetchPreviousTerm,
    resetToCurrentTerm,
    addExpenditure,
    deleteExpenditure,
  };
}
