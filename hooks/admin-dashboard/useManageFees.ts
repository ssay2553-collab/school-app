import { useState, useCallback, useMemo, useEffect } from "react";
import {
  collection,
  onSnapshot
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { StudentDraft, FILTERS_PERSISTENCE_KEY } from "../../constants/admin-dashboard/ManageFeesTypes";
import { sortClasses } from "../../lib/classHelpers";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFeeStudents } from "./useFeeStudents";
import { useFeeBilling } from "./useFeeBilling";
import { useFeePayments } from "./useFeePayments";
import { useFeeDiscounts } from "./useFeeDiscounts";

interface UseManageFeesProps {
  appUser: any;
  showToast: (props: { message: string; type: "success" | "error" | "info" }) => void;
  acadConfig: any;
}

export const useManageFees = ({
  appUser,
  showToast,
  acadConfig,
}: UseManageFeesProps) => {
  // ACCESS CONTROL LOGIC
  const currentUserRole = appUser?.adminRole?.toLowerCase() || "";
  const isSuperAdmin = useMemo(() => [
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
  ].includes(currentUserRole), [currentUserRole]);

  const feePermission = appUser?.permissions?.["manage-fees"] || "deny";
  const canView = useMemo(() =>
    isSuperAdmin ||
    feePermission === "full" ||
    feePermission === "view" ||
    feePermission === "edit", [isSuperAdmin, feePermission]);

  const canEdit = useMemo(() =>
    isSuperAdmin || feePermission === "full" || feePermission === "edit", [isSuperAdmin, feePermission]);

  const [activeMode, setActiveMode] = useState<"billing" | "payment" | "discounts">("payment");
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "debt" | "cleared">("all");
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [selectedStudentUids, setSelectedStudentUids] = useState<Set<string>>(new Set());

  const [classes, setClasses] = useState<{ id: string; name: string; department?: string | null }[]>([]);
  const academicYear = acadConfig.academicYear || "";
  const term = acadConfig.currentTerm || "";
  const isConfigMissing = !academicYear || !term;

  // MODAL STATES
  const [selectorModal, setSelectorModal] = useState<{
    visible: boolean;
    type: "class" | "year" | "term" | null;
  }>({ visible: false, type: null });

  useEffect(() => {
    setSelectedStudentUids(new Set());
  }, [activeMode]);

  useEffect(() => {
    const q = collection(db, "classes");
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          name: (d.data() as any).name || d.id,
          department: (d.data() as any).department || null,
        }));
        setClasses(sortClasses(list));
      },
      (err) => console.error("Classes listener error:", err),
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const init = async () => {
      const saved = await AsyncStorage.getItem(FILTERS_PERSISTENCE_KEY);
      if (saved) {
        try {
          const { classId } = JSON.parse(saved);
          if (classId) {
            setSelectedClassId(classId);
          }
        } catch {
          setSelectedClassId("all");
        }
      }
    };
    init();
  }, []);

  const {
    students,
    loading,
    refreshing,
    fetchStudents,
    handleRefresh,
    fetchingMore,
  } = useFeeStudents(selectedClassId, academicYear, term, classes, showArchived);

  const billing = useFeeBilling({
    students,
    academicYear,
    term,
    fetchStudents,
    showToast,
    canEdit,
  });

  const payments = useFeePayments({
    appUser,
    showToast,
    academicYear,
    term,
    fetchStudents,
    canEdit,
  });

  const discounts = useFeeDiscounts({
    students,
    academicYear,
    term,
    fetchStudents,
    showToast,
    canEdit,
    isSuperAdmin,
  });

  const filteredStudents = useMemo(() => {
    const searchLower = searchQuery.toLowerCase().trim();

    return students.filter((s: StudentDraft) => {
      const matchesSearch = !searchLower ||
        (s.fullName || "").toLowerCase().includes(searchLower) ||
        (s.studentID || "").toLowerCase().includes(searchLower) ||
        s.payments?.some(
          (p: any) =>
            p.receiptNo?.toLowerCase().includes(searchLower) ||
            p.createdAt?.toLowerCase().includes(searchLower),
        );

      if (!matchesSearch) return false;

      if (activeMode === "discounts") {
        return searchLower ? true : !!s.onDiscount;
      }

      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "cleared"
            ? (s.currentBalance || 0) <= 0
            : (s.currentBalance || 0) > 0;

      return matchesStatus;
    });
  }, [students, searchQuery, statusFilter, activeMode]);

  const totalProfileDiscountsSum = useMemo(() => {
    if (activeMode !== "discounts") return 0;
    return filteredStudents.reduce((acc, s) => acc + Number(s.discount || 0), 0);
  }, [filteredStudents, activeMode]);

  const inconsistentCount = useMemo(() => {
    return students.filter(
      (s) => !s.onDiscount && (s.discount || 0) > 0 && s.hasRecordInTerm,
    ).length;
  }, [students]);

  const toggleSelectAll = () => {
    const allSelected = filteredStudents.length > 0 && filteredStudents.every((s) => selectedStudentUids.has(s.uid));
    setSelectedStudentUids(new Set(allSelected ? [] : filteredStudents.map((s) => s.uid)));
  };

  const toggleStudentSelection = (uid: string) => {
    setSelectedStudentUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const isSaving = billing.saving || payments.saving || discounts.saving;

  return {
    activeMode,
    setActiveMode,
    searchQuery,
    setSearchQuery,
    showArchived,
    setShowArchived,
    statusFilter,
    setStatusFilter,
    selectedClassId,
    setSelectedClassId,
    selectedStudentUids,
    setSelectedStudentUids,
    classes,
    academicYear,
    term,
    filteredStudents,
    totalProfileDiscountsSum,
    inconsistentCount,
    toggleSelectAll,
    toggleStudentSelection,
    isConfigMissing,
    students,
    loading,
    refreshing,
    fetchStudents,
    handleRefresh,
    fetchingMore,
    selectorModal,
    setSelectorModal,
    canView,
    canEdit,
    isSuperAdmin,
    ...billing,
    ...payments,
    ...discounts,
    saving: isSaving,
  };
};
