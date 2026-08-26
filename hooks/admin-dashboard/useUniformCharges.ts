import { useState, useCallback, useRef, useEffect } from "react";
import { Alert, Platform } from "react-native";
import {
  collection,
  doc,
  getDocsFromServer,
  increment,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  startAfter,
  where,
  writeBatch,
  arrayUnion,
  arrayRemove,
  documentId,
} from "firebase/firestore";
import moment from "moment";
import { db } from "../../firebaseConfig";
import { sendNotification } from "../../src/services/notificationService";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { sortClasses } from "../../lib/classHelpers";
import { propagateArrears } from "../../utils/financeUtils";


const PAGE_SIZE = 50;

const UNIFORM_TYPES = [
  { id: "main", label: "Main Uniform", icon: "shirt" },
  { id: "lacoste", label: "Lacoste/T-Shirt", icon: "ribbon" },
  { id: "friday", label: "Friday Wear", icon: "color-palette" },
  { id: "pe", label: "PE Kit", icon: "fitness" },
  { id: "other", label: "Other", icon: "ellipsis-horizontal" },
];

export type Student = {
  uid: string;
  fullName: string;
  classId: string;
  className: string;
  uniformPaid: number;
  uniformBill: number;
  uniformBalance: number;
  walletBalance: number;
  ptaBalance?: number;
  admissionBalance?: number;
  maintenanceBalance?: number;
  booksBalance?: number;
  otherBalance?: number;
};

interface UseUniformChargesProps {
  appUser: any;
  acadConfig: any;
  showToast: (props: { message: string; type: "success" | "error" | "info" }) => void;
  selectedClassId: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const useUniformCharges = ({
  appUser,
  acadConfig,
  showToast,
  selectedClassId,
  searchQuery,
  setSearchQuery,
}: UseUniformChargesProps) => {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    totalCollected: 0,
    count: 0,
    breakdown: {
      main: 0,
      lacoste: 0,
      friday: 0,
      pe: 0,
      other: 0,
    },
  });
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // UI States
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedType, setSelectedType] = useState("main");
  const [amount, setAmount] = useState("");
  const [receivedFrom, setReceivedFrom] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingPurchases, setLoadingPurchases] = useState(false);

  const lastVisibleRef = useRef<any>(null);
  const hasMoreRef = useRef(true);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "classes"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, name: d.data().name, ...d.data() }));
      setClasses(sortClasses(list));
    });
    return () => unsub();
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      if (!acadConfig.academicYear || !acadConfig.currentTerm) return;
      let q = query(
        collection(db, "feePayments"),
        where("type", "==", "uniform"),
        where("academicYear", "==", acadConfig.academicYear),
        where("term", "==", acadConfig.currentTerm)
      );

      if (selectedClassId !== "all") {
        q = query(q, where("classId", "==", selectedClassId));
      }

      const snap = await getDocsFromServer(q);
      let total = 0;
      let breakdown: any = {
        main: 0,
        lacoste: 0,
        friday: 0,
        pe: 0,
        other: 0,
      };

      snap.docs.forEach((d) => {
        const data = d.data();
        const amt = data.amount || 0;
        total += amt;
        if (data.subType && breakdown[data.subType] !== undefined) {
          breakdown[data.subType] += amt;
        } else {
          breakdown.other += amt;
        }
      });
      if (isMounted.current) {
        setStats({ totalCollected: total, count: snap.docs.length, breakdown });
      }
    } catch (e) {
      if (isMounted.current) console.error("Error fetching uniform stats:", e);
    }
  }, [acadConfig.academicYear, acadConfig.currentTerm, selectedClassId]);

  const fetchPurchases = useCallback(async (typeId: string) => {
    setLoadingPurchases(true);
    setPurchases([]);
    try {
      if (!acadConfig.academicYear || !acadConfig.currentTerm) return;
      const q = query(
        collection(db, "feePayments"),
        where("type", "==", "uniform"),
        where("subType", "==", typeId),
        where("academicYear", "==", acadConfig.academicYear),
        where("term", "==", acadConfig.currentTerm)
      );
      const snap = await getDocsFromServer(q);
      const list = snap.docs.map(d => ({ id: d.id, createdAt: d.data().createdAt, ...d.data() }));
      if (isMounted.current) {
        setPurchases(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      }
    } catch (e) {
      if (isMounted.current) console.error("Error fetching purchases:", e);
    } finally {
      if (isMounted.current) setLoadingPurchases(false);
    }
  }, [acadConfig.academicYear, acadConfig.currentTerm]);

  const fetchPaymentHistory = useCallback(async (studentUid: string) => {
    setLoadingHistory(true);
    try {
      const q = query(
        collection(db, "feePayments"),
        where("studentUid", "==", studentUid),
        where("type", "==", "uniform")
      );
      const snap = await getDocsFromServer(q);
      const list = snap.docs.map(d => d.data());
      setHistory(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const fetchUniformStudents = useCallback(async () => {
    setLoading(true);
    setStudents([]);
    try {
      const year = acadConfig.academicYear;
      if (!year) return;

      let q = query(
        collection(db, "feePayments"),
        where("type", "==", "uniform"),
        where("academicYear", "==", year)
      );

      if (selectedClassId !== "all") {
        q = query(q, where("classId", "==", selectedClassId));
      }

      const snap = await getDocsFromServer(q);
      const uids = Array.from(new Set(snap.docs.map((d) => d.data().studentUid)));

      if (uids.length === 0) {
        setStudents([]);
        return;
      }

      const list: Student[] = [];
      for (let i = 0; i < uids.length; i += 30) {
        const batch = uids.slice(i, i + 30);
        const uq = query(collection(db, "users"), where(documentId(), "in", batch));
        const uSnap = await getDocsFromServer(uq);
        uSnap.docs.forEach((d) => {
          const data = d.data();
          list.push({
            uid: d.id,
            fullName: `${data.profile?.firstName || ""} ${data.profile?.lastName || ""}`.trim(),
            classId: data.classId || "unknown",
            className: data.className || "Class",
            uniformPaid: data.uniformPaid || 0,
            uniformBill: data.uniformBill || 0,
            uniformBalance: data.uniformBalance || 0,
            walletBalance: data.walletBalance || 0,
            ptaBalance: data.ptaBalance || 0,
            admissionBalance: data.admissionBalance || 0,
            maintenanceBalance: data.maintenanceBalance || 0,
            booksBalance: data.booksBalance || 0,
            otherBalance: data.otherBalance || 0,
          });
        });
      }
      if (isMounted.current) {
        setStudents(list.sort((a, b) => a.fullName.localeCompare(b.fullName)));
      }
    } catch (e) {
      if (isMounted.current) {
        console.error(e);
        showToast({ message: "Failed to fetch uniform students", type: "error" });
      }
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [acadConfig.academicYear, selectedClassId, showToast]);

  const fetchStudents = useCallback(
    async (isFirstLoad = false) => {
      if (isFetchingRef.current) return;
      if (!isFirstLoad && !hasMoreRef.current) return;

      if (searchQuery.trim().length < 2) {
        if (isFirstLoad) {
          setStudents([]);
          setLoading(false);
        }
        return;
      }

      isFetchingRef.current = true;
      if (isFirstLoad) {
        setLoading(true);
        lastVisibleRef.current = null;
        hasMoreRef.current = true;
      }

      try {
        let q = query(
          collection(db, "users"),
          where("role", "==", "student"),
          where("status", "in", ["active", "pending_activation"]),
          limit(PAGE_SIZE)
        );

        if (selectedClassId !== "all") {
          q = query(q, where("classId", "==", selectedClassId));
        }

        if (!isFirstLoad && lastVisibleRef.current) {
          q = query(q, startAfter(lastVisibleRef.current));
        }

        const snap = await getDocsFromServer(q);
        const batch: Student[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            uid: d.id,
            fullName: `${data.profile?.firstName || ""} ${data.profile?.lastName || ""}`.trim(),
            classId: data.classId || "unknown",
            className: data.className || "Class",
            uniformPaid: data.uniformPaid || 0,
            uniformBill: data.uniformBill || 0,
            uniformBalance: data.uniformBalance || 0,
            walletBalance: data.walletBalance || 0,
            ptaBalance: data.ptaBalance || 0,
            admissionBalance: data.admissionBalance || 0,
            maintenanceBalance: data.maintenanceBalance || 0,
            booksBalance: data.booksBalance || 0,
            otherBalance: data.otherBalance || 0,
          };
        });

        if (isMounted.current) {
          lastVisibleRef.current = snap.docs[snap.docs.length - 1];
          hasMoreRef.current = snap.docs.length === PAGE_SIZE;
          setStudents((prev) => (isFirstLoad ? batch : [...prev, ...batch]));
        }
      } catch (e) {
        if (isMounted.current) console.error(e);
      } finally {
        isFetchingRef.current = false;
        if (isMounted.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [selectedClassId, searchQuery]
  );

  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      fetchStudents(true);
    } else if (selectedClassId !== "all") {
      fetchUniformStudents();
    } else {
      setStudents([]);
    }
  }, [selectedClassId, searchQuery, fetchStudents, fetchUniformStudents]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    if (searchQuery.trim().length >= 2) {
      fetchStudents(true);
    } else if (selectedClassId !== "all") {
      fetchUniformStudents();
    }
    fetchStats();
  }, [searchQuery, selectedClassId, fetchStudents, fetchUniformStudents, fetchStats]);

  const logPayment = async (
    student: Student,
    amountVal: number,
    receivedFromVal: string,
    selectedTypeVal: string,
    typeLabel: string
  ) => {
    if (!acadConfig.academicYear || !acadConfig.currentTerm) {
      showToast({ message: "Academic config missing. Cannot log payment.", type: "error" });
      return false;
    }
    if (amountVal <= 0 || !receivedFromVal.trim()) {
      showToast({ message: "Incomplete details", type: "error" });
      return false;
    }

    setSaving(true);
    try {
      // Check for existing uniform record of the same subType for this student/term
      const qExisting = query(
        collection(db, "feePayments"),
        where("type", "==", "uniform"),
        where("studentUid", "==", student.uid),
        where("subType", "==", selectedTypeVal),
        where("academicYear", "==", acadConfig.academicYear),
        where("term", "==", acadConfig.currentTerm)
      );
      const existingSnap = await getDocsFromServer(qExisting);
      const existing = existingSnap.empty ? null : { id: existingSnap.docs[0].id, ...(existingSnap.docs[0].data() as any) };

      const oldAmount = existing ? (existing.amount || 0) : 0;
      const diff = amountVal - oldAmount;

      if (diff === 0 && existing) {
        showToast({ message: "Amount is the same as existing record", type: "info" });
        setSaving(false);
        return true;
      }

      const batch = writeBatch(db);
      const serial = existing ? existing.id : `UNI-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const entry = {
        amount: amountVal,
        method: "Cash",
        receivedFrom: receivedFromVal.trim(),
        updatedBy: appUser?.adminRole || "Admin",
        adminUid: appUser?.uid || "unknown",
        createdAt: new Date().toISOString(),
        receiptNo: serial,
        date: moment().format("YYYY-MM-DD"),
        studentUid: student.uid,
        studentName: student.fullName,
        classId: student.classId,
        className: student.className,
        type: "uniform",
        subType: selectedTypeVal,
        subTypeLabel: typeLabel,
        academicYear: acadConfig.academicYear,
        term: acadConfig.currentTerm,
      };

      batch.set(doc(db, "feePayments", serial), entry);

      const year = acadConfig.academicYear?.replace(/\//g, "-");
      const term = acadConfig.currentTerm?.replace(/\s/g, "");
      const recordId = `${student.uid}_${year}_${term}`;

      if (existing) {
        batch.update(doc(db, "studentFeeRecords", recordId), {
          uniformPaid: increment(diff),
          uniformBill: increment(diff),
          uniformBalance: increment(0),
          lastUpdated: serverTimestamp(),
        });
      } else {
        batch.set(
          doc(db, "studentFeeRecords", recordId),
          {
            studentUid: student.uid,
            studentName: student.fullName,
            classId: student.classId,
            className: student.className,
            academicYear: acadConfig.academicYear,
            term: acadConfig.currentTerm,
            uniformPaid: increment(amountVal),
            uniformBill: increment(amountVal),
            uniformBalance: increment(0),
            balance: increment(0),
            payments: arrayUnion(entry),
            lastUpdated: serverTimestamp(),
          },
          { merge: true }
        );
      }

      batch.update(doc(db, "users", student.uid), {
        uniformPaid: increment(diff),
        uniformBill: increment(diff),
      });

      await batch.commit();

      if (Math.abs(diff) >= 0.01) {
        propagateArrears(student.uid, acadConfig.academicYear, acadConfig.currentTerm, diff, 'bill', 'uniform').catch(console.error);
        propagateArrears(student.uid, acadConfig.academicYear, acadConfig.currentTerm, -diff, 'payment', 'uniform').catch(console.error);
      }

      try {
        await sendNotification({
          recipientId: student.uid,
          senderId: appUser?.uid || "admin",
          senderName: appUser?.displayName || "Administrator",
          title: "Uniform Payment Recorded",
          body: `A payment for ${typeLabel} (${SCHOOL_CONFIG.currencySymbol}${amountVal.toLocaleString()}) has been recorded for ${student.fullName}.`,
          type: "payment",
          data: {
            studentUid: student.uid,
            amount: amountVal,
            type: "uniform_payment",
            item: typeLabel,
          },
        });
      } catch (notifErr) {
        console.error("Failed to send uniform notification:", notifErr);
      }

      showToast({ message: `${typeLabel} recorded: ${serial}`, type: "success" });
      handleRefresh();
      return true;
    } catch (e) {
      console.error(e);
      showToast({ message: "Failed to record payment", type: "error" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleLogPayment = async () => {
    if (!selectedStudent) return;
    const val = parseFloat(amount);
    const typeLabel = UNIFORM_TYPES.find(t => t.id === selectedType)?.label || "Uniform";
    const success = await logPayment(selectedStudent, val, receivedFrom, selectedType, typeLabel);
    if (success) {
      setPaymentModalVisible(false);
      setAmount("");
      setReceivedFrom("");
    }
  };

  const handleDeletePayment = async (student: Student, payment: any) => {
    const year = acadConfig.academicYear?.replace(/\//g, "-");
    const term = acadConfig.currentTerm?.replace(/\s/g, "");

    if (!year || !term) {
      showToast({
        message: "Action blocked: Academic year and term must be configured.",
        type: "error",
      });
      return false;
    }

    setSaving(true);
    try {
      const recordId = `${student.uid}_${year}_${term}`;
      const batch = writeBatch(db);
      const amountVal = Number(payment.amount) || 0;

      batch.update(doc(db, "studentFeeRecords", recordId), {
        uniformPaid: increment(-amountVal),
        uniformBill: increment(-amountVal),
        uniformBalance: increment(0),
        payments: arrayRemove(payment),
        lastUpdated: serverTimestamp(),
      });
      batch.update(doc(db, "users", student.uid), {
        uniformPaid: increment(-amountVal),
        uniformBill: increment(-amountVal),
      });

      if (payment.receiptNo) {
        batch.delete(doc(db, "feePayments", payment.receiptNo));
      }

      await batch.commit();

      if (Math.abs(amountVal) >= 0.01) {
        propagateArrears(student.uid, acadConfig.academicYear, acadConfig.currentTerm, -amountVal, 'bill', 'uniform').catch(console.error);
        propagateArrears(student.uid, acadConfig.academicYear, acadConfig.currentTerm, amountVal, 'payment', 'uniform').catch(console.error);
      }

      showToast({ message: "Transaction reverted successfully", type: "success" });
      handleRefresh();
      return true;
    } catch (err) {
      console.error("Delete transaction error:", err);
      showToast({ message: "Failed to revert transaction", type: "error" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const confirmDeletePayment = (payment: any) => {
    if (!selectedStudent) return;
    const msg = "Are you sure you want to delete this transaction? This will automatically adjust the student's records.";

    const proceed = async () => {
      const success = await handleDeletePayment(selectedStudent, payment);
      if (success) {
        setPaymentModalVisible(false);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm(`Confirm Deletion\n\n${msg}`)) proceed();
    } else {
      Alert.alert("Confirm Deletion", msg, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: proceed },
      ]);
    }
  };

  const openPaymentModal = (student: Student) => {
    setSelectedStudent(student);
    setPaymentModalVisible(true);
    fetchPaymentHistory(student.uid);
  };

  const handleToggleFilter = (typeId: string | null) => {
    if (!typeId || activeFilter === typeId) {
      setActiveFilter(null);
      setPurchases([]);
    } else {
      setActiveFilter(typeId);
      setSearchQuery("");
      fetchPurchases(typeId);
    }
  };

  return {
    loading,
    refreshing,
    saving,
    students,
    classes,
    stats,
    handleRefresh,
    handleLogPayment,
    handleDeletePayment,
    confirmDeletePayment,
    fetchStudents,

    // UI state & handlers
    paymentModalVisible,
    setPaymentModalVisible,
    selectedStudent,
    setSelectedStudent,
    selectedType,
    setSelectedType,
    amount,
    setAmount,
    receivedFrom,
    setReceivedFrom,
    activeFilter,
    setActiveFilter,
    purchases,
    history,
    loadingHistory,
    loadingPurchases,
    openPaymentModal,
    handleToggleFilter,
  };
};

