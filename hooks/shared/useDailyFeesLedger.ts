import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocsFromServer,
  query,
  where,
} from "firebase/firestore";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { db } from "../../firebaseConfig";
import { sortClasses } from "../../lib/classHelpers";
import { useAcademicConfig } from "../useAcademicConfig";

export type DailyCategory = "feeding" | "bus" | "extra" | "all";

export type DailyLedgerStudentRow = {
  studentUid: string;
  fullName: string;
  studentID: string;
  classId: string;
  className: string;
  dailyRate: number;
  totalBilledAmount: number;
  totalDaysBilled: number;
  amountPaid: number;
  daysPaid: number;
  arrearsAmount: number;
  daysArrears: number;
  isFullyPaid: boolean;
};

export const useDailyFeesLedger = () => {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const acadConfig = useAcademicConfig();

  // Access control
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

  const feedingPermission = appUser?.permissions?.["feeding"] || "deny";
  const busPermission = appUser?.permissions?.["record-bus-fee"] || "deny";
  const extraPermission = appUser?.permissions?.["record-extra-classes"] || "deny";

  const canView =
    isSuperAdmin ||
    feedingPermission !== "deny" ||
    busPermission !== "deny" ||
    extraPermission !== "deny";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [activeCategory, setActiveCategory] = useState<DailyCategory>("feeding");
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Data state
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [dailyRecords, setDailyRecords] = useState<any[]>([]);

  // Rates
  const [feedingRates, setFeedingRates] = useState<Record<string, number>>({});
  const [busRates, setBusRates] = useState<Record<string, number>>({});
  const [extraRates, setExtraRates] = useState<Record<string, number>>({});

  // 1. Fetch Classes & Rates
  const loadInitialData = useCallback(async () => {
    try {
      // Classes
      const classesSnap = await getDocsFromServer(collection(db, "classes"));
      const classList = classesSnap.docs.map((d) => ({
        id: d.id,
        name: (d.data() as any).name || d.id,
      }));
      setClasses(sortClasses(classList));

      // Rates
      const [feedingSnap, busSnap, extraSnap] = await Promise.all([
        getDoc(doc(db, "school_settings", "feeding_rates")),
        getDoc(doc(db, "school_settings", "bus_rates")),
        getDoc(doc(db, "school_settings", "extra_classes_rates")),
      ]);

      if (feedingSnap.exists()) {
        setFeedingRates(feedingSnap.data() as Record<string, number>);
      }
      if (busSnap.exists()) {
        setBusRates(busSnap.data() as Record<string, number>);
      }
      if (extraSnap.exists()) {
        setExtraRates(extraSnap.data() as Record<string, number>);
      }
    } catch (e) {
      console.error("Error loading initial ledger data:", e);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // 2. Fetch Students & Daily Records
  const fetchData = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      // Students query
      let studentQ = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("status", "in", ["active", "pending_activation"]),
      );
      if (selectedClassId !== "all") {
        studentQ = query(studentQ, where("classId", "==", selectedClassId));
      }

      // Daily records query
      let recordsQ = collection(db, "dailyFinancials") as any;
      if (acadConfig.academicYear && acadConfig.currentTerm) {
        recordsQ = query(
          recordsQ,
          where("academicYear", "==", acadConfig.academicYear),
          where("term", "==", acadConfig.currentTerm),
        );
      }
      if (selectedClassId !== "all") {
        recordsQ = query(recordsQ, where("classId", "==", selectedClassId));
      }

      const [studentsSnap, recordsSnap] = await Promise.all([
        getDocsFromServer(studentQ),
        getDocsFromServer(recordsQ),
      ]);

      const studentList = studentsSnap.docs.map((d) => ({
        uid: d.id,
        ...(d.data() as any),
      }));

      const recordList = recordsSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));

      setStudents(studentList);
      setDailyRecords(recordList);
    } catch (e) {
      console.error("Error fetching daily ledger data:", e);
      showToast({ message: "Failed to load daily ledger data.", type: "error" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canView, selectedClassId, acadConfig, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Helper to determine rate per student/class
  const getDailyRateForStudent = useCallback(
    (student: any, category: DailyCategory): number => {
      const classId = student.classId || "";
      if (category === "feeding") {
        return (
          feedingRates[classId] ||
          SCHOOL_CONFIG.defaultFeedingRate ||
          10
        );
      }
      if (category === "bus") {
        const dest = student.busLocation;
        if (dest && busRates[dest]) return busRates[dest];
        return busRates[classId] || SCHOOL_CONFIG.defaultBusRate || 10;
      }
      if (category === "extra") {
        return (
          extraRates[classId] ||
          SCHOOL_CONFIG.defaultExtraClassesRate ||
          10
        );
      }
      // "all" category total rate
      const fRate = feedingRates[classId] || SCHOOL_CONFIG.defaultFeedingRate || 10;
      const bRate = busRates[classId] || SCHOOL_CONFIG.defaultBusRate || 10;
      const eRate = extraRates[classId] || SCHOOL_CONFIG.defaultExtraClassesRate || 10;
      return fRate + bRate + eRate;
    },
    [feedingRates, busRates, extraRates],
  );

  // Compute table rows
  const ledgerRows = useMemo<DailyLedgerStudentRow[]>(() => {
    const classNameMap: Record<string, string> = {};
    classes.forEach((c) => {
      classNameMap[c.id] = c.name;
    });

    return students
      .map((student) => {
        const uid = student.uid;
        const classId = student.classId || "unknown";
        const className = classNameMap[classId] || student.className || "Class";
        const fullName =
          `${student.profile?.firstName || ""} ${student.profile?.lastName || ""}`.trim() ||
          student.fullName ||
          "Student";
        const studentID = student.profile?.studentID || "N/A";

        const dailyRate = getDailyRateForStudent(student, activeCategory);

        // Filter student's daily records
        const studentRecs = dailyRecords.filter((r) => r.studentUid === uid);

        let billedSum = 0;
        let paidSum = 0;
        let daysBilled = 0;

        studentRecs.forEach((r) => {
          if (activeCategory === "feeding") {
            const fee = Number(r.feedingFee) || 0;
            if (fee > 0) {
              billedSum += fee;
              daysBilled += 1;
              if (r.feedingPaid) {
                paidSum += r.feedingPaidAmount || fee;
              }
            }
          } else if (activeCategory === "bus") {
            const fee = Number(r.busFee) || 0;
            if (fee > 0) {
              billedSum += fee;
              daysBilled += 1;
              if (r.busPaid) {
                paidSum += r.busPaidAmount || fee;
              }
            }
          } else if (activeCategory === "extra") {
            const fee = Number(r.extraClassesFee) || 0;
            if (fee > 0) {
              billedSum += fee;
              daysBilled += 1;
              if (r.extraPaid) {
                paidSum += r.extraPaidAmount || fee;
              }
            }
          } else {
            // "all"
            const fFee = Number(r.feedingFee) || 0;
            const bFee = Number(r.busFee) || 0;
            const eFee = Number(r.extraClassesFee) || 0;
            const totFee = fFee + bFee + eFee;

            if (totFee > 0) {
              billedSum += totFee;
              daysBilled += 1;
              let p = 0;
              if (r.feedingPaid) p += r.feedingPaidAmount || fFee;
              if (r.busPaid) p += r.busPaidAmount || bFee;
              if (r.extraPaid) p += r.extraPaidAmount || eFee;
              paidSum += p;
            }
          }
        });

        const arrearsAmount = Math.max(0, billedSum - paidSum);
        const effectiveRate = dailyRate > 0 ? dailyRate : 1;

        const daysPaid = Math.floor(paidSum / effectiveRate);
        const daysArrears = Math.ceil(arrearsAmount / effectiveRate);
        const isFullyPaid = arrearsAmount <= 0.01;

        return {
          studentUid: uid,
          fullName,
          studentID,
          classId,
          className,
          dailyRate,
          totalBilledAmount: billedSum,
          totalDaysBilled: daysBilled,
          amountPaid: paidSum,
          daysPaid,
          arrearsAmount,
          daysArrears,
          isFullyPaid,
        };
      })
      .filter((row) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          row.fullName.toLowerCase().includes(q) ||
          row.studentID.toLowerCase().includes(q) ||
          row.className.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [students, classes, dailyRecords, activeCategory, searchQuery, getDailyRateForStudent]);

  // Totals for current view
  const summaryTotals = useMemo(() => {
    let billed = 0;
    let paid = 0;
    let arrears = 0;
    let totalPaidDays = 0;
    let totalArrearsDays = 0;

    ledgerRows.forEach((r) => {
      billed += r.totalBilledAmount;
      paid += r.amountPaid;
      arrears += r.arrearsAmount;
      totalPaidDays += r.daysPaid;
      totalArrearsDays += r.daysArrears;
    });

    return {
      totalBilled: billed,
      totalPaid: paid,
      totalArrears: arrears,
      totalPaidDays,
      totalArrearsDays,
      studentCount: ledgerRows.length,
    };
  }, [ledgerRows]);

  return {
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
    academicYear: acadConfig.academicYear,
    currentTerm: acadConfig.currentTerm,
  };
};
