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
} from "firebase/firestore";
import moment from "moment";
import { db } from "../../firebaseConfig";
import { sendNotification } from "../../src/services/notificationService";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { sortClasses } from "../../lib/classHelpers";
import { propagateArrears } from "../../utils/financeUtils";


const PAGE_SIZE = 50;

export type Student = {
  uid: string;
  fullName: string;
  classId: string;
  className: string;
  ptaPaid: number;
  ptaBill: number;
  ptaBalance: number;
  walletBalance: number;
  admissionBalance?: number;
  maintenanceBalance?: number;
  booksBalance?: number;
  uniformBalance?: number;
  otherBalance?: number;
  exemptions?: string[];
};

interface UsePTAChargesProps {
  appUser: any;
  acadConfig: any;
  showToast: (props: { message: string; type: "success" | "error" | "info" | "warning" }) => void;
  selectedClassId: string;
}

export const usePTACharges = ({
  appUser,
  acadConfig,
  showToast,
  selectedClassId,
}: UsePTAChargesProps) => {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalBilled: 0, totalCollected: 0 });
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // UI state migrated from component
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [receivedFrom, setReceivedFrom] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Cheque" | "E-cash" | "Momo">("Cash");
  const [chargeAmount, setChargeAmount] = useState("");

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
      const q = query(
        collection(db, "feePayments"),
        where("type", "in", ["pta", "pta_payment"]),
        where("academicYear", "==", acadConfig.academicYear),
        where("term", "==", acadConfig.currentTerm)
      );
      const snap = await getDocsFromServer(q);
      let collected = 0;
      let billed = 0;
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.type === "pta_payment") collected += data.amount || 0;
        if (data.type === "pta") billed += data.amount || 0;
      });
      if (isMounted.current) {
        setStats({ totalCollected: collected, totalBilled: billed });
      }
    } catch (e) {
      if (isMounted.current) console.error("Error fetching PTA stats:", e);
    }
  }, [acadConfig.academicYear, acadConfig.currentTerm]);

  const fetchStudents = useCallback(
    async (isFirstLoad = false) => {
      if (isFetchingRef.current) return;
      if (!isFirstLoad && !hasMoreRef.current) return;

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
        if (snap.empty) {
          hasMoreRef.current = false;
          if (isFirstLoad) setStudents([]);
          return;
        }

        const batch: Student[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            uid: d.id,
            fullName: `${data.profile?.firstName || ""} ${data.profile?.lastName || ""}`.trim() || "Student",
            classId: data.classId || "unknown",
            className: data.className || "Class",
            ptaPaid: data.ptaPaid || 0,
            ptaBill: data.ptaBill || 0,
            ptaBalance: data.ptaBalance || 0,
            walletBalance: data.walletBalance || 0,
            admissionBalance: data.admissionBalance || 0,
            maintenanceBalance: data.maintenanceBalance || 0,
            booksBalance: data.booksBalance || 0,
            uniformBalance: data.uniformBalance || 0,
            otherBalance: data.otherBalance || 0,
            exemptions: data.exemptions || [],
          };
        });

        if (isMounted.current) {
          lastVisibleRef.current = snap.docs[snap.docs.length - 1];
          hasMoreRef.current = snap.docs.length === PAGE_SIZE;
          setStudents((prev) => (isFirstLoad ? batch : [...prev, ...batch]));
        }
      } catch (e) {
        if (isMounted.current) {
          console.error(e);
          showToast({ message: "Failed to fetch students", type: "error" });
        }
      } finally {
        isFetchingRef.current = false;
        if (isMounted.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [selectedClassId, showToast]
  );

  const fetchPaymentHistory = useCallback(async (studentUid: string) => {
    setLoadingHistory(true);
    try {
      const q = query(
        collection(db, "feePayments"),
        where("studentUid", "==", studentUid),
        where("type", "in", ["pta", "pta_payment"])
      );
      const snap = await getDocsFromServer(q);
      const list = snap.docs.map((d) => d.data());
      setHistory(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const handleLogPayment = async (
    student: Student,
    amount: number,
    receivedFrom: string,
    paymentMethod: string
  ) => {
    if (!acadConfig.academicYear || !acadConfig.currentTerm) {
      showToast({ message: "Academic config missing. Cannot log payment.", type: "error" });
      return false;
    }
    if (amount <= 0 || !receivedFrom.trim()) {
      showToast({ message: "Invalid details", type: "error" });
      return false;
    }

    setSaving(true);
    try {
      const batch = writeBatch(db);
      const year = acadConfig.academicYear?.replace(/\//g, "-");
      const term = acadConfig.currentTerm?.replace(/\s/g, "");
      const recordId = `${student.uid}_${year}_${term}`;
      const serial = `PTA-PAY-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const paymentEntry = {
        amount,
        method: paymentMethod,
        receivedFrom: receivedFrom.trim(),
        updatedBy: appUser?.adminRole || "Admin",
        adminUid: appUser?.uid || "unknown",
        createdAt: new Date().toISOString(),
        receiptNo: serial,
        date: moment().format("YYYY-MM-DD"),
        studentUid: student.uid,
        studentName: student.fullName,
        classId: student.classId,
        className: student.className,
        type: "pta_payment",
        academicYear: acadConfig.academicYear,
        term: acadConfig.currentTerm,
      };

      batch.set(doc(db, "feePayments", serial), paymentEntry);

      batch.set(
        doc(db, "studentFeeRecords", recordId),
        {
          studentUid: student.uid,
          studentName: student.fullName,
          classId: student.classId,
          className: student.className,
          academicYear: acadConfig.academicYear,
          term: acadConfig.currentTerm,
          ptaBalance: increment(-amount),
          ptaPaid: increment(amount),
          balance: increment(-amount),
          payments: arrayUnion(paymentEntry),
          lastUpdated: serverTimestamp(),
        },
        { merge: true }
      );

      batch.update(doc(db, "users", student.uid), {
        ptaBalance: increment(-amount),
        ptaPaid: increment(amount),
        walletBalance: increment(-amount),
      });

      await batch.commit();

      propagateArrears(student.uid, acadConfig.academicYear, acadConfig.currentTerm, -amount, 'payment', 'pta').catch(console.error);

      sendNotification({
        recipientId: student.uid,
        senderId: appUser?.uid || "admin",
        senderName: appUser?.displayName || "Administrator",
        title: "PTA Payment Received",
        body: `A PTA payment of ${SCHOOL_CONFIG.currencySymbol}${amount.toLocaleString()} has been recorded for ${student.fullName}.`,
        type: "payment",
      }).catch((e) => console.error(e));

      showToast({ message: "Payment recorded", type: "success" });
      fetchStudents(true);
      fetchStats();
      return true;
    } catch (e) {
      console.error(e);
      showToast({ message: "Failed to record payment", type: "error" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const applyBulkCharge = async (chargeAmount: string) => {
    if (!acadConfig.academicYear || !acadConfig.currentTerm) {
      showToast({ message: "Academic config missing. Cannot apply charge.", type: "error" });
      return false;
    }
    const val = parseFloat(chargeAmount);
    if (isNaN(val) || val <= 0) {
      showToast({ message: "Invalid amount", type: "error" });
      return false;
    }
    if (selectedClassId === "all") {
      showToast({ message: "Please select a specific class first", type: "error" });
      return false;
    }

    setSaving(true);
    try {
      // Fetch existing bills for this class/term
      const qExisting = query(
        collection(db, "feePayments"),
        where("type", "==", "pta"),
        where("classId", "==", selectedClassId),
        where("academicYear", "==", acadConfig.academicYear),
        where("term", "==", acadConfig.currentTerm)
      );
      const existingSnap = await getDocsFromServer(qExisting);
      const existingBillsMap = new Map<string, any>();
      existingSnap.docs.forEach(d => {
        existingBillsMap.set(d.data().studentUid, { id: d.id, ...d.data() });
      });

      const q = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("classId", "==", selectedClassId),
        where("status", "in", ["active", "pending_activation"])
      );
      const snap = await getDocsFromServer(q);

      if (snap.empty) {
        setSaving(false);
        showToast({ message: "No active students in this class", type: "warning" });
        return false;
      }

      // Filter out exempted students
      const targetDocs = snap.docs.filter(d => {
        const exemptions = d.data().exemptions || [];
        return !exemptions.includes('pta');
      });

      if (targetDocs.length === 0) {
        setSaving(false);
        showToast({ message: "All students in this class are exempted from PTA dues", type: "info" });
        return true;
      }

      const year = acadConfig.academicYear?.replace(/\//g, "-");
      const term = acadConfig.currentTerm?.replace(/\s/g, "");

      const CHUNK_SIZE = 150; // 3 operations per student, 150*3 = 450 < 500
      const docs = targetDocs;

      for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
        const chunk = docs.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);

        chunk.forEach((sDoc) => {
          const s = sDoc.data();
          const existing = existingBillsMap.get(sDoc.id);
          const oldAmount = existing ? existing.amount : 0;
          const diff = val - oldAmount;

          if (diff === 0) return;

          const serial = existing ? existing.id : `PTA-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
          const recordId = `${sDoc.id}_${year}_${term}`;

          const billData = {
            amount: val,
            method: "Bulk Charge",
            receivedFrom: "PTA Dues",
            updatedBy: appUser?.adminRole || "Admin",
            adminUid: appUser?.uid || "unknown",
            createdAt: new Date().toISOString(),
            receiptNo: serial,
            date: moment().format("YYYY-MM-DD"),
            studentUid: sDoc.id,
            studentName: `${s.profile?.firstName || ""} ${s.profile?.lastName || ""}`.trim(),
            classId: selectedClassId,
            className: s.className,
            type: "pta",
            academicYear: acadConfig.academicYear,
            term: acadConfig.currentTerm,
          };

          batch.set(doc(db, "feePayments", serial), billData);

          if (existing) {
            batch.update(doc(db, "studentFeeRecords", recordId), {
              ptaBill: increment(diff),
              ptaBalance: increment(diff),
              balance: increment(diff),
              lastUpdated: serverTimestamp(),
              // Remove the old charge from the array and add the new one to keep history clean
              payments: arrayUnion(billData)
            });
          } else {
            batch.set(
              doc(db, "studentFeeRecords", recordId),
              {
                studentUid: sDoc.id,
                studentName: `${s.profile?.firstName || ""} ${s.profile?.lastName || ""}`.trim(),
                classId: selectedClassId,
                className: s.className,
                academicYear: acadConfig.academicYear,
                term: acadConfig.currentTerm,
                ptaBill: increment(val),
                ptaBalance: increment(val),
                balance: increment(val),
                ptaPaid: 0, // Ensure paid is not touched
                payments: arrayUnion(billData),
                lastUpdated: serverTimestamp(),
              },
              { merge: true }
            );
          }

          batch.update(sDoc.ref, {
            ptaBalance: increment(diff),
            ptaBill: increment(diff),
            walletBalance: increment(diff),
          });
        });

        await batch.commit();
      }

      showToast({ message: `PTA charges applied to ${snap.size} students`, type: "success" });

      // Propagate bulk charges
      snap.docs.forEach(sDoc => {
        const existing = existingBillsMap.get(sDoc.id);
        const oldAmount = existing ? existing.amount : 0;
        const diff = val - oldAmount;
        if (Math.abs(diff) > 0.01) {
          propagateArrears(sDoc.id, acadConfig.academicYear, acadConfig.currentTerm, diff, 'bill', 'pta').catch(console.error);
        }
      });

      fetchStats();
      fetchStudents(true);
      return true;
    } catch (e) {
      console.error(e);
      showToast({ message: "Operation failed", type: "error" });
      return false;
    } finally {
      setSaving(false);
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
      const amount = Number(payment.amount) || 0;
      const isPayment = (payment.type || "").toLowerCase() === "pta_payment";

      if (isPayment) {
        batch.update(doc(db, "studentFeeRecords", recordId), {
          ptaPaid: increment(-amount),
          ptaBalance: increment(amount),
          balance: increment(amount),
        });
        batch.update(doc(db, "users", student.uid), {
          ptaPaid: increment(-amount),
          ptaBalance: increment(amount),
          walletBalance: increment(amount),
        });
      } else {
        batch.update(doc(db, "studentFeeRecords", recordId), {
          ptaBill: increment(-amount),
          ptaBalance: increment(-amount),
          balance: increment(-amount),
        });
        batch.update(doc(db, "users", student.uid), {
          ptaBill: increment(-amount),
          ptaBalance: increment(-amount),
          walletBalance: increment(-amount),
        });
      }

      batch.update(doc(db, "studentFeeRecords", recordId), {
        payments: arrayRemove(payment),
        lastUpdated: serverTimestamp(),
      });

      if (payment.receiptNo) {
        batch.delete(doc(db, "feePayments", payment.receiptNo));
      }

      await batch.commit();
      showToast({ message: "Transaction reverted successfully", type: "success" });

      // Propagate deletion
      const propagationAmount = isPayment ? amount : -amount;
      const propType = isPayment ? 'payment' : 'bill';
      propagateArrears(student.uid, acadConfig.academicYear, acadConfig.currentTerm, propagationAmount, propType, 'pta').catch(console.error);

      fetchStats();
      fetchStudents(true);
      return true;
    } catch (err) {
      console.error("Delete transaction error:", err);
      showToast({ message: "Failed to revert transaction", type: "error" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const toggleExemption = async (studentId: string, type: string, isExempted: boolean) => {
    setSaving(true);
    try {
      const studentRef = doc(db, "users", studentId);
      await writeBatch(db).update(studentRef, {
        exemptions: isExempted ? arrayUnion(type) : arrayRemove(type)
      }).commit();

      showToast({
        message: isExempted ? `Student exempted from ${type.toUpperCase()}` : `Exemption removed for ${type.toUpperCase()}`,
        type: "success"
      });
      fetchStudents(true);
      return true;
    } catch (e) {
      console.error(e);
      showToast({ message: "Failed to update exemption", type: "error" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStudents(true);
    fetchStats();
  }, [fetchStudents, fetchStats]);

  const handleConfirmPayment = async () => {
    if (!selectedStudent) return;
    const amount = parseFloat(paymentAmount);
    const success = await handleLogPayment(selectedStudent, amount, receivedFrom, paymentMethod);
    if (success) {
      setPaymentModalVisible(false);
      setPaymentAmount("");
      setReceivedFrom("");
    }
  };

  const handleApplyBulkCharge = async () => {
    const success = await applyBulkCharge(chargeAmount);
    if (success) {
      setChargeAmount("");
    }
  };

  const confirmDeletePayment = (payment: any) => {
    if (!selectedStudent) return;
    const msg = "Are you sure you want to delete this transaction? This will automatically adjust the student's balance.";

    const proceed = async () => {
      const success = await handleDeletePayment(selectedStudent, payment);
      if (success) setPaymentModalVisible(false);
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
    setPaymentAmount("");
    setReceivedFrom("");
    setPaymentMethod("Cash");
    setSelectedStudent(student);
    setPaymentModalVisible(true);
    fetchPaymentHistory(student.uid);
  };

  useEffect(() => {
    fetchStudents(true);
    fetchStats();
  }, [selectedClassId, acadConfig.academicYear, acadConfig.currentTerm, fetchStudents, fetchStats]);

  return {
    loading,
    refreshing,
    saving,
    students,
    classes,
    stats,
    history,
    loadingHistory,
    fetchStudents,
    fetchPaymentHistory,
    handleLogPayment,
    applyBulkCharge,
    toggleExemption,
    handleDeletePayment,
    handleRefresh,

    // UI state & handlers
    paymentModalVisible,
    setPaymentModalVisible,
    selectedStudent,
    setSelectedStudent,
    paymentAmount,
    setPaymentAmount,
    receivedFrom,
    setReceivedFrom,
    paymentMethod,
    setPaymentMethod,
    chargeAmount,
    setChargeAmount,
    handleConfirmPayment,
    handleApplyBulkCharge,
    confirmDeletePayment,
    openPaymentModal,
  };
};
