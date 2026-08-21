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
  booksBill: number;
  booksPaid: number;
  booksBalance: number;
  walletBalance: number;
  admissionBalance?: number;
  ptaBalance?: number;
  maintenanceBalance?: number;
  uniformBalance?: number;
  otherBalance?: number;
};

interface UseBooksChargesProps {
  appUser: any;
  acadConfig: any;
  showToast: (props: { message: string; type: "success" | "error" | "info" }) => void;
  selectedClassId: string;
  searchQuery: string;
}

export const useBooksCharges = ({
  appUser,
  acadConfig,
  showToast,
  selectedClassId,
  searchQuery,
}: UseBooksChargesProps) => {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalBilled: 0, totalCollected: 0 });

  // UI state migrated from component
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<"payment" | "billing">("payment");
  const [bookTitle, setBookTitle] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [receivedFrom, setReceivedFrom] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Momo" | "Cheque" | "E-cash">("Cash");
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

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
        where("type", "in", ["books", "books_payment"]),
        where("academicYear", "==", acadConfig.academicYear),
        where("term", "==", acadConfig.currentTerm)
      );

      if (selectedClassId !== "all") {
        q = query(q, where("classId", "==", selectedClassId));
      }

      const snap = await getDocsFromServer(q);
      let billed = 0;
      let collected = 0;
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.type === "books") billed += (data.amount || 0);
        if (data.type === "books_payment") collected += (data.amount || 0);
      });
      setStats({ totalBilled: billed, totalCollected: collected });
    } catch (e) {
      console.error("Error fetching books stats:", e);
    }
  }, [acadConfig.academicYear, acadConfig.currentTerm, selectedClassId]);

  const fetchStudents = useCallback(async (isFirstLoad = false) => {
    if (isFetchingRef.current) return;

    if (searchQuery.trim().length < 2 && selectedClassId === "all") {
      if (isFirstLoad) {
        setStudents([]);
        setLoading(false);
      }
      return;
    }

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
      const batch: Student[] = snap.docs.map(d => {
        const data = d.data();
        return {
          uid: d.id,
          fullName: `${data.profile?.firstName || ""} ${data.profile?.lastName || ""}`.trim() || "Student",
          classId: data.classId || "unknown",
          className: data.className || "Class",
          booksBill: data.booksBill || 0,
          booksPaid: data.booksPaid || 0,
          booksBalance: data.booksBalance || 0,
          walletBalance: data.walletBalance || 0,
          admissionBalance: data.admissionBalance || 0,
          ptaBalance: data.ptaBalance || 0,
          maintenanceBalance: data.maintenanceBalance || 0,
          uniformBalance: data.uniformBalance || 0,
          otherBalance: data.otherBalance || 0,
        };
      });

      lastVisibleRef.current = snap.docs[snap.docs.length - 1];
      hasMoreRef.current = snap.docs.length === PAGE_SIZE;
      setStudents(prev => isFirstLoad ? batch : [...prev, ...batch]);
    } catch (e) {
      console.error(e);
      showToast({ message: "Failed to fetch students", type: "error" });
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedClassId, searchQuery, showToast]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchStudents(true);
  }, [selectedClassId, searchQuery, fetchStudents]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStudents(true);
    fetchStats();
  }, [fetchStudents, fetchStats]);

  const fetchPaymentHistory = async (studentUid: string) => {
    setLoadingHistory(true);
    try {
      const q = query(
        collection(db, "feePayments"),
        where("studentUid", "==", studentUid),
        where("type", "in", ["books", "books_payment"])
      );
      const snap = await getDocsFromServer(q);
      const list = snap.docs.map(d => d.data());
      setHistory(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const logPayment = async (
    student: Student,
    amountVal: number,
    receivedFromVal: string,
    paymentMethodVal: string
  ) => {
    if (!acadConfig.academicYear || !acadConfig.currentTerm) {
      showToast({ message: "Academic config missing. Cannot log payment.", type: "error" });
      return false;
    }
    setSaving(true);
    try {
      const batch = writeBatch(db);
      const serial = `BK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const paymentEntry = {
        amount: amountVal,
        method: paymentMethodVal,
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
        type: "books_payment",
        academicYear: acadConfig.academicYear,
        term: acadConfig.currentTerm,
      };

      batch.set(doc(db, "feePayments", serial), paymentEntry);

      batch.update(doc(db, "users", student.uid), {
        booksPaid: increment(amountVal),
        booksBalance: increment(-amountVal),
        walletBalance: increment(-amountVal),
      });

      const year = acadConfig.academicYear?.replace(/\//g, "-");
      const term = acadConfig.currentTerm?.replace(/\s/g, "");
      const recordId = `${student.uid}_${year}_${term}`;

      batch.set(doc(db, "studentFeeRecords", recordId), {
        studentUid: student.uid,
        studentName: student.fullName,
        classId: student.classId,
        className: student.className,
        academicYear: acadConfig.academicYear,
        term: acadConfig.currentTerm,
        booksPaid: increment(amountVal),
        booksBalance: increment(-amountVal),
        balance: increment(-amountVal),
        payments: arrayUnion(paymentEntry),
        lastUpdated: serverTimestamp(),
      }, { merge: true });

      await batch.commit();

      propagateArrears(student.uid, acadConfig.academicYear, acadConfig.currentTerm, -amountVal, 'payment', 'books');

      try {
        await sendNotification({
          recipientId: student.uid,
          senderId: appUser?.uid || "admin",
          senderName: appUser?.displayName || "Administrator",
          title: "Books Payment Received",
          body: `A books payment of ${SCHOOL_CONFIG.currencySymbol}${amountVal.toLocaleString()} has been recorded for ${student.fullName}.`,
          type: "payment",
          data: {
            studentUid: student.uid,
            amount: amountVal,
            type: "books_payment"
          }
        });
      } catch (notifErr) {
        console.error("Failed to send books notification:", notifErr);
      }

      showToast({ message: `Payment recorded: ${serial}`, type: "success" });
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
    const amountVal = parseFloat(paymentAmount);
    if (isNaN(amountVal) || amountVal <= 0 || !selectedStudent || !receivedFrom.trim()) {
      return showToast({ message: "Please enter valid payment details", type: "error" });
    }
    const success = await logPayment(selectedStudent, amountVal, receivedFrom, paymentMethod);
    if (success) {
      setModalVisible(false);
      setPaymentAmount("");
      setReceivedFrom("");
    }
  };

  const logBill = async (student: Student, amountVal: number, bookTitleVal: string) => {
    if (!acadConfig.academicYear || !acadConfig.currentTerm) {
      showToast({ message: "Academic config missing. Cannot log bill.", type: "error" });
      return false;
    }
    setSaving(true);
    try {
      const qExisting = query(
        collection(db, "feePayments"),
        where("type", "==", "books"),
        where("studentUid", "==", student.uid),
        where("academicYear", "==", acadConfig.academicYear),
        where("term", "==", acadConfig.currentTerm),
        where("method", "==", bookTitleVal || "Books Charge")
      );
      const existingSnap = await getDocsFromServer(qExisting);
      const existing = existingSnap.empty ? null : { id: existingSnap.docs[0].id, ...(existingSnap.docs[0].data() as any) };

      const oldAmount = existing ? (existing.amount || 0) : 0;
      const diff = amountVal - oldAmount;

      if (diff === 0 && existing) {
        showToast({ message: "Bill amount is the same", type: "info" });
        return true;
      }

      const batch = writeBatch(db);
      const serial = existing ? existing.id : `BILL-BK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const billEntry = {
        amount: amountVal,
        method: bookTitleVal || "Books Charge",
        receivedFrom: "System Billing",
        updatedBy: appUser?.adminRole || "Admin",
        adminUid: appUser?.uid || "unknown",
        createdAt: new Date().toISOString(),
        receiptNo: serial,
        date: moment().format("YYYY-MM-DD"),
        studentUid: student.uid,
        studentName: student.fullName,
        classId: student.classId,
        className: student.className,
        type: "books",
        academicYear: acadConfig.academicYear,
        term: acadConfig.currentTerm,
      };

      batch.set(doc(db, "feePayments", serial), billEntry);

      batch.update(doc(db, "users", student.uid), {
        booksBill: increment(diff),
        booksBalance: increment(diff),
        walletBalance: increment(diff),
      });

      const year = acadConfig.academicYear?.replace(/\//g, "-");
      const term = acadConfig.currentTerm?.replace(/\s/g, "");
      const recordId = `${student.uid}_${year}_${term}`;

      if (existing) {
        batch.update(doc(db, "studentFeeRecords", recordId), {
          booksBill: increment(diff),
          booksBalance: increment(diff),
          balance: increment(diff),
          lastUpdated: serverTimestamp(),
        });
      } else {
        batch.set(doc(db, "studentFeeRecords", recordId), {
          studentUid: student.uid,
          studentName: student.fullName,
          classId: student.classId,
          className: student.className,
          academicYear: acadConfig.academicYear,
          term: acadConfig.currentTerm,
          booksBill: increment(amountVal),
          booksBalance: increment(amountVal),
          balance: increment(amountVal),
          payments: arrayUnion(billEntry),
          lastUpdated: serverTimestamp(),
        }, { merge: true });
      }

      await batch.commit();

      propagateArrears(student.uid, acadConfig.academicYear, acadConfig.currentTerm, diff, 'bill', 'books');

      showToast({ message: existing ? `Bill updated` : `Bill created: ${serial}`, type: "success" });
      handleRefresh();
      return true;
    } catch (e) {
      console.error(e);
      showToast({ message: "Failed to create bill", type: "error" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleLogBill = async () => {
    const amountVal = parseFloat(billAmount);
    if (isNaN(amountVal) || amountVal <= 0 || !selectedStudent) {
      return showToast({ message: "Please enter a valid billing amount", type: "error" });
    }
    const success = await logBill(selectedStudent, amountVal, bookTitle);
    if (success) {
      setModalVisible(false);
      setBillAmount("");
      setBookTitle("");
    }
  };

  const deletePayment = async (student: Student, payment: any) => {
    const year = acadConfig.academicYear?.replace(/\//g, "-");
    const term = acadConfig.currentTerm?.replace(/\s/g, "");

    if (!year || !term) {
      showToast({ message: "Academic config missing", type: "error" });
      return false;
    }

    setSaving(true);
    try {
      const recordId = `${student.uid}_${year}_${term}`;
      const batch = writeBatch(db);
      const amountVal = Number(payment.amount) || 0;
      const isPayment = payment.type === "books_payment";

      if (isPayment) {
        batch.update(doc(db, "studentFeeRecords", recordId), {
          booksPaid: increment(-amountVal),
          booksBalance: increment(amountVal),
          balance: increment(amountVal),
        });
        batch.update(doc(db, "users", student.uid), {
          booksPaid: increment(-amountVal),
          booksBalance: increment(amountVal),
          walletBalance: increment(amountVal),
        });
      } else {
        batch.update(doc(db, "studentFeeRecords", recordId), {
          booksBill: increment(-amountVal),
          booksBalance: increment(-amountVal),
          balance: increment(-amountVal),
        });
        batch.update(doc(db, "users", student.uid), {
          booksBill: increment(-amountVal),
          booksBalance: increment(-amountVal),
          walletBalance: increment(-amountVal),
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

      const propagationAmount = isPayment ? amountVal : -amountVal;
      const propType = isPayment ? 'payment' : 'bill';
      propagateArrears(student.uid, acadConfig.academicYear, acadConfig.currentTerm, propagationAmount, propType, 'books');

      showToast({ message: "Transaction reverted", type: "success" });
      handleRefresh();
      return true;
    } catch (err) {
      console.error(err);
      showToast({ message: "Failed to revert", type: "error" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const confirmDeletePayment = (payment: any) => {
    if (!selectedStudent) return;
    const msg = "Are you sure you want to delete this transaction?";

    const proceed = async () => {
      const success = await deletePayment(selectedStudent, payment);
      if (success) setModalVisible(false);
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

  const openStudentModal = (student: Student) => {
    setSelectedStudent(student);
    setPaymentAmount("");
    setReceivedFrom("");
    setModalVisible(true);
    fetchPaymentHistory(student.uid);
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
    handleLogBill,
    confirmDeletePayment,
    fetchStudents,

    // UI state & handlers
    selectedStudent,
    modalVisible,
    setModalVisible,
    activeTab,
    setActiveTab,
    bookTitle,
    setBookTitle,
    billAmount,
    setBillAmount,
    paymentAmount,
    setPaymentAmount,
    receivedFrom,
    setReceivedFrom,
    paymentMethod,
    setPaymentMethod,
    history,
    loadingHistory,
    openStudentModal,
  };
};
