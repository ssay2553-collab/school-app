import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  collection,
  doc,
  getDocsFromServer,
  query,
  where,
  writeBatch,
  serverTimestamp,
  arrayUnion,
  increment,
  arrayRemove,
  onSnapshot
} from "firebase/firestore";
import moment from "moment";
import { db } from "../../firebaseConfig";
import { StudentDraft, FILTERS_PERSISTENCE_KEY } from "../../constants/admin-dashboard/ManageFeesTypes";
import { sortClasses } from "../../lib/classHelpers";
import { sendNotification } from "../../src/services/notificationService";
import { Alert, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFeeStudents } from "./useFeeStudents";

interface UseManageFeesProps {
  appUser: any;
  showToast: (props: { message: string; type: "success" | "error" | "info" }) => void;
  acadConfig: any;
  canEdit: boolean;
  isSuperAdmin: boolean;
}

export const useManageFees = ({
  appUser,
  showToast,
  acadConfig,
  canEdit,
  isSuperAdmin,
}: UseManageFeesProps) => {
  const [saving, setSaving] = useState(false);
  const [activeMode, setActiveMode] = useState<"billing" | "payment" | "discounts">("payment");
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "debt" | "cleared">("debt");
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [selectedStudentUids, setSelectedStudentUids] = useState<Set<string>>(new Set());

  const [termBillAmount, setTermBillAmount] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [individualBillOverrides, setIndividualBillOverridesState] = useState<Record<string, string>>({});
  const individualBillOverridesRef = useRef<Record<string, string>>({});
  const [individualDiscountOverrides, setIndividualDiscountOverrides] = useState<Record<string, string>>({});

  const [classes, setClasses] = useState<{ id: string; name: string; department?: string | null }[]>([]);
  const academicYear = acadConfig.academicYear || "";
  const term = acadConfig.currentTerm || "";

  const {
    students,
    loading,
    refreshing,
    fetchStudents,
    handleRefresh,
    fetchingMore,
  } = useFeeStudents(
    selectedClassId,
    academicYear,
    term,
    classes,
    showArchived
  );

  const [dailyModalVisible, setDailyModalVisible] = useState(false);
  const [selectedDailyDate, setSelectedDailyDate] = useState(new Date());
  const [dailyPayments, setDailyPayments] = useState<any[]>([]);
  const [loadingDaily, setLoadingDaily] = useState(false);

  const setIndividualBillOverrides = useCallback((update: any) => {
    setIndividualBillOverridesState((prev) => {
      const next = typeof update === "function" ? update(prev) : update;
      individualBillOverridesRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    setSelectedStudentUids(new Set());
    setIndividualBillOverrides({});
    setIndividualDiscountOverrides({});
    setTermBillAmount("");
    setDiscountAmount("");
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

  const isConfigMissing = !academicYear || !term;

  const filteredStudents = useMemo(() => {
    const searchLower = searchQuery.toLowerCase().trim();

    return students.filter((s) => {
      // 1. Scholarship exemption: Scholarship students are exempted from billing/payments list
      if (s.onScholarship) return false;

      // 2. Search filter
      const matchesSearch = !searchLower ||
        (s.fullName || "").toLowerCase().includes(searchLower) ||
        (s.studentID || "").toLowerCase().includes(searchLower) ||
        s.payments?.some(
          (p: any) =>
            p.receiptNo?.toLowerCase().includes(searchLower) ||
            p.createdAt?.toLowerCase().includes(searchLower),
        );

      if (!matchesSearch) return false;

      // 3. Discount Mode filtering:
      // If we are in discounts mode and NOT searching, show only those on the discount profile.
      // If searching, show all matches (excluding scholarships).
      if (activeMode === "discounts") {
        return searchLower ? true : !!s.onDiscount;
      }

      // 4. Status filter (only for non-discount modes)
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

  const fetchDailyPayments = async (date: Date) => {
    setLoadingDaily(true);
    try {
      const dateString = moment(date).format("YYYY-MM-DD");
      const q = query(collection(db, "feePayments"), where("date", "==", dateString));
      const snap = await getDocsFromServer(q as any);
      const payments = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));
      payments.sort((a: any, b: any) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
      setDailyPayments(payments);
    } catch (error) {
      console.error("Error fetching daily payments:", error);
      showToast({ message: "Failed to fetch daily payments", type: "error" });
    } finally {
      setLoadingDaily(false);
    }
  };

  useEffect(() => {
    if (dailyModalVisible) {
      fetchDailyPayments(selectedDailyDate);
    }
  }, [dailyModalVisible, selectedDailyDate]);

  const handleLogPayment = async (
    selectedStudent: StudentDraft | null,
    paymentAmount: string,
    receivedFrom: string,
    paymentMethod: string,
    paymentDate: Date,
    onSuccess: () => void
  ) => {
    if (!canEdit) {
      showToast({ message: "Access Denied: You don't have permission to log payments.", type: "error" });
      return;
    }
    if (!selectedStudent || !paymentAmount || parseFloat(paymentAmount) <= 0) {
      showToast({ message: "Invalid payment details", type: "error" });
      return;
    }
    if (isConfigMissing) {
      showToast({ message: "Academic config missing. Cannot log term payment.", type: "error" });
      return;
    }

    setSaving(true);
    try {
      const amount = parseFloat(paymentAmount);
      const cleanYear = academicYear.replace(/\//g, "-");
      const cleanTerm = term.replace(/\s/g, "");
      const recordId = `${selectedStudent.uid}_${cleanYear}_${cleanTerm}`;
      const receiptNo = `REC-${Date.now().toString().slice(-6)}`;
      const paymentDateStr = moment(paymentDate).format("YYYY-MM-DD");

      const paymentObj = {
        amount,
        method: paymentMethod,
        receivedFrom: receivedFrom || "Guardian",
        date: paymentDateStr,
        createdAt: new Date().toISOString(),
        receiptNo,
        academicYear,
        term,
      };

      const batch = writeBatch(db);
      const globalPaymentRef = doc(collection(db, "feePayments"));
      batch.set(globalPaymentRef, {
        ...paymentObj,
        studentUid: selectedStudent.uid,
        studentName: selectedStudent.fullName,
        classId: selectedStudent.classId,
        className: selectedStudent.className,
      });

      const recordRef = doc(db, "studentFeeRecords", recordId);
      const newPaid = (selectedStudent.amountPaid || 0) + amount;
      const newBalance = (selectedStudent.currentBalance || 0) - amount;

      // Ensure critical fields are present even if document is created via payment
      const feeRecordUpdate: any = {
        studentUid: selectedStudent.uid,
        studentName: selectedStudent.fullName,
        classId: selectedStudent.classId,
        className: selectedStudent.className,
        academicYear,
        term,
        amountPaid: newPaid,
        balance: newBalance,
        payments: arrayUnion(paymentObj),
        lastUpdated: serverTimestamp(),
      };

      // If it's a new record (no bill yet), set arrears to current wallet balance (before payment)
      if (!selectedStudent.hasRecordInTerm) {
        feeRecordUpdate.arrears = selectedStudent.previousBalance || 0;
        feeRecordUpdate.termBill = 0;
        feeRecordUpdate.createdAt = serverTimestamp();
      }

      batch.set(recordRef, feeRecordUpdate, { merge: true });

      batch.update(doc(db, "users", selectedStudent.uid), {
        walletBalance: increment(-amount),
      });

      await batch.commit();
      showToast({ message: `Payment of ₵${amount} logged successfully`, type: "success" });

      if (selectedStudent.uid) {
        sendNotification({
          recipientId: selectedStudent.uid,
          senderId: appUser?.uid || "admin",
          senderName: appUser?.displayName || "Administrator",
          title: "Fee Payment Received",
          body: `A payment of ₵${amount} has been received for ${selectedStudent.fullName}. Receipt: ${receiptNo}`,
          type: "payment",
        });
      }
      onSuccess();
      fetchStudents(true);
    } catch (error) {
      console.error(error);
      showToast({ message: "Failed to log payment", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePayment = async (selectedStudent: StudentDraft | null, payment: any, onSuccess: () => void) => {
    if (!canEdit) return;

    const performDelete = async () => {
      setSaving(true);
      try {
        const cleanYear = academicYear.replace(/\//g, "-");
        const cleanTerm = term.replace(/\s/g, "");
        const recordId = `${selectedStudent?.uid}_${cleanYear}_${cleanTerm}`;
        const batch = writeBatch(db);

        // 1. Update the student fee record (array and totals)
        batch.update(doc(db, "studentFeeRecords", recordId), {
          payments: arrayRemove(payment),
          amountPaid: increment(-payment.amount),
          balance: increment(payment.amount),
          lastUpdated: serverTimestamp(),
        });

        // 2. Reverse the wallet balance
        batch.update(doc(db, "users", selectedStudent?.uid!), {
          walletBalance: increment(payment.amount),
        });

        // 3. Delete the global payment document if receiptNo exists
        if (payment.receiptNo) {
          const q = query(
            collection(db, "feePayments"),
            where("receiptNo", "==", payment.receiptNo),
            where("studentUid", "==", selectedStudent?.uid)
          );
          const snap = await getDocsFromServer(q);
          snap.forEach((d) => {
            batch.delete(d.ref);
          });
        }

        await batch.commit();
        fetchStudents(true);
        onSuccess();
        showToast({ message: "Payment reversed.", type: "success" });
      } catch (e) {
        console.error("Delete Payment Error:", e);
        showToast({ message: "Deletion failed", type: "error" });
      } finally {
        setSaving(false);
      }
    };

    const msg = "Are you sure you want to delete this payment record? This will reverse the balance.";
    const title = "Confirm Deletion";

    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${msg}`)) {
        await performDelete();
      }
    } else {
      Alert.alert(title, msg, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: performDelete,
        },
      ]);
    }
  };

  const handleNormalizeDiscounts = async () => {
    if (!isSuperAdmin) return;
    const targets = students.filter((s) => !s.onDiscount && (s.discount || 0) > 0 && s.hasRecordInTerm);
    if (targets.length === 0) {
      showToast({ message: "No inconsistent records found.", type: "info" });
      return;
    }

    Alert.alert("Fix Inconsistencies?", `Found ${targets.length} students with discounts despite having "Discount Profile" disabled. Remove these manual discounts and reverse balances?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Fix All",
        onPress: async () => {
          setSaving(true);
          try {
            const batch = writeBatch(db);
            const cleanYear = academicYear.replace(/\//g, "-");
            const cleanTerm = term.replace(/\s/g, "");
            for (const s of targets) {
              const disc = s.discount || 0;
              const recordId = `${s.uid}_${cleanYear}_${cleanTerm}`;
              batch.update(doc(db, "studentFeeRecords", recordId), { discount: 0, balance: increment(disc) });
              batch.update(doc(db, "users", s.uid), { walletBalance: increment(disc) });
            }
            await batch.commit();
            fetchStudents(true);
            showToast({ message: "Records normalized.", type: "success" });
          } catch (e) {
            console.error(e);
            showToast({ message: "Fix failed", type: "error" });
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const saveFees = async (onSuccess: () => void) => {
    if (!canEdit) {
      showToast({ message: "Access Denied: You don't have permission to modify billing.", type: "error" });
      return;
    }
    if (isConfigMissing) {
      showToast({ message: "Action blocked: Academic year and term must be configured before billing.", type: "error" });
      return;
    }
    setSaving(true);
    try {
      const batch = writeBatch(db);
      const selectedUids = Array.from(selectedStudentUids);
      const latestOverrides = individualBillOverridesRef.current;

      for (const uid of selectedUids) {
        const s = students.find((stud) => stud.uid === uid);
        if (!s || s.onScholarship) continue;

        const adjustmentStr = latestOverrides[uid] || termBillAmount;
        const adjustment = parseFloat(adjustmentStr);
        if (isNaN(adjustment) || adjustment === 0) continue;

        const cleanYear = academicYear.replace(/\//g, "-");
        const cleanTerm = term.replace(/\s/g, "");
        const recordId = `${uid}_${cleanYear}_${cleanTerm}`;
        const totalPaid = s.hasRecordInTerm ? s.amountPaid || 0 : 0;
        const arrears = s.previousBalance || 0;

        let discount = s.discount || 0;
        if (s.onDiscount && s.discountAmount && !s.hasRecordInTerm) {
          discount = s.discountAmount;
        }

        const currentBill = s.hasRecordInTerm ? s.termBill || 0 : 0;
        const currentEditCount = s.editCount || 0;

        if (currentEditCount >= 5) {
          showToast({ message: `Student ${s.fullName} has reached the limit of 5 edits this term.`, type: "error" });
          continue;
        }

        const newBill = currentBill + adjustment;
        const newBalance = arrears + newBill - discount - totalPaid;
        const totalPayable = arrears + newBill;

        if (isNaN(newBalance)) continue;

        const feeRecordData: any = {
          studentUid: uid,
          studentName: s.fullName,
          classId: s.classId,
          className: s.className,
          academicYear,
          term,
          termBill: newBill,
          arrears: arrears,
          discount: discount,
          amountPaid: totalPaid,
          balance: newBalance,
          totalPayable: totalPayable,
          editCount: currentEditCount + 1,
          lastUpdated: serverTimestamp(),
        };

        if (!s.hasRecordInTerm) {
          feeRecordData.payments = [];
          feeRecordData.createdAt = serverTimestamp();
        }

        batch.set(doc(db, "studentFeeRecords", recordId), feeRecordData, { merge: true });
        const walletAdjustment = adjustment - (s.hasRecordInTerm ? 0 : discount);
        batch.update(doc(db, "users", uid), { walletBalance: increment(walletAdjustment) });
      }
      await batch.commit();
      onSuccess();
      setSelectedStudentUids(new Set());
      setIndividualBillOverrides({});
      fetchStudents(true);
      showToast({ message: "Billing updated successfully.", type: "success" });
    } catch (e) {
      console.error(e);
      showToast({ message: "Save failed", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const saveDiscounts = async (onSuccess: () => void) => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const batch = writeBatch(db);
      const selectedUids = Array.from(selectedStudentUids);
      for (const uid of selectedUids) {
        const s = students.find((stud) => stud.uid === uid);
        if (!s) continue;
        const discStr = individualDiscountOverrides[uid] || discountAmount;
        const disc = parseFloat(discStr);
        if (isNaN(disc) || disc === 0) continue;

        const cleanYear = academicYear.replace(/\//g, "-");
        const cleanTerm = term.replace(/\s/g, "");
        const recordId = `${uid}_${cleanYear}_${cleanTerm}`;

        if (!s.hasRecordInTerm) {
          batch.set(doc(db, "studentFeeRecords", recordId), {
            studentUid: uid,
            studentName: s.fullName,
            classId: s.classId,
            className: s.className,
            academicYear,
            term,
            termBill: 0,
            arrears: s.previousBalance || 0,
            discount: disc,
            amountPaid: 0,
            balance: (s.previousBalance || 0) - disc,
            totalPayable: s.previousBalance || 0,
            editCount: 1,
            createdAt: serverTimestamp(),
            lastUpdated: serverTimestamp(),
            payments: [],
          });
        } else {
          batch.update(doc(db, "studentFeeRecords", recordId), {
            discount: increment(disc),
            balance: increment(-disc),
            lastUpdated: serverTimestamp(),
          });
        }
        batch.update(doc(db, "users", uid), { walletBalance: increment(-disc) });
      }
      await batch.commit();
      onSuccess();
      setSelectedStudentUids(new Set());
      setIndividualDiscountOverrides({});
      fetchStudents(true);
      showToast({ message: "Discounts applied.", type: "success" });
    } catch (e) {
      console.error(e);
      showToast({ message: "Failed to apply discounts", type: "error" });
    } finally {
      setSaving(false);
    }
  };

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

  return {
    saving,
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
    termBillAmount,
    setTermBillAmount,
    discountAmount,
    setDiscountAmount,
    individualBillOverrides,
    setIndividualBillOverrides,
    individualDiscountOverrides,
    setIndividualDiscountOverrides,
    classes,
    academicYear,
    term,
    filteredStudents,
    totalProfileDiscountsSum,
    inconsistentCount,
    dailyModalVisible,
    setDailyModalVisible,
    selectedDailyDate,
    setSelectedDailyDate,
    dailyPayments,
    loadingDaily,
    handleLogPayment,
    handleDeletePayment,
    handleNormalizeDiscounts,
    saveFees,
    saveDiscounts,
    toggleSelectAll,
    toggleStudentSelection,
    isConfigMissing,
    students,
    loading,
    refreshing,
    fetchStudents,
    handleRefresh,
    fetchingMore,
  };
};
