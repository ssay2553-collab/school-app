import React, { useState, useEffect, useCallback, useRef } from "react";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { initializeApp, deleteApp } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  startAfter,
  where,
  writeBatch,
  documentId,
  Timestamp,
} from "firebase/firestore";
import moment from "moment";
import { db, storage } from "../../firebaseConfig";
import { sendNotification, notifyStudentAndParentsPayment } from "../../src/services/notificationService";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { sortClasses } from "../../lib/classHelpers";
import { propagateArrears } from "../../utils/financeUtils";
import { Alert, Platform } from "react-native";
import { getStudentFinalEmail } from "../../utils/authUnify";

const PAGE_SIZE = 50;

export type Student = {
  uid: string;
  fullName: string;
  classId: string;
  className: string;
  admissionPaid: number;
  admissionBill: number;
  admissionBalance: number;
  walletBalance: number;
  ptaBalance?: number;
  maintenanceBalance?: number;
  booksBalance?: number;
  uniformBalance?: number;
  otherBalance?: number;
};

interface UseAdmissionChargesProps {
  appUser: any;
  acadConfig: any;
  showToast: (props: { message: string; type: "success" | "error" | "info" }) => void;
  selectedClassId: string;
  searchQuery: string;
  selectedTerm: string | null;
}

export const useAdmissionCharges = ({
  appUser,
  acadConfig,
  showToast,
  selectedClassId,
  searchQuery,
  selectedTerm,
}: UseAdmissionChargesProps) => {
  const [loading, setLoading] = useState(false);
  const isImportingRef = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    totalCollected: 0,
    totalBilled: 0,
    term1Count: 0,
    term1Revenue: 0,
    term2Count: 0,
    term2Revenue: 0,
    term3Count: 0,
    term3Revenue: 0,
  });
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // UI State migrated from component
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [receivedFrom, setReceivedFrom] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Cheque" | "E-cash" | "Momo">("Cash");
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<"payment" | "billing">("payment");
  const [billAmount, setBillAmount] = useState("");

  const lastVisibleRef = useRef<any>(null);
  const hasMoreRef = useRef(true);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "classes"), (snap) => {
      if (!isMounted.current) return;
      const list = snap.docs.map((d) => ({ id: d.id, name: d.data().name, ...d.data() }));
      setClasses(sortClasses(list));
    });
    return () => unsub();
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const year = acadConfig.academicYear;
      if (!year) return;

      let q = query(
        collection(db, "feePayments"),
        where("type", "in", ["admission", "admission_payment"]),
        where("academicYear", "==", year)
      );

      if (selectedClassId !== "all") {
        q = query(q, where("classId", "==", selectedClassId));
      }

      const snap = await getDocs(q);

      let uQuery = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("isNewAdmission", "==", true)
      );
      if (selectedClassId !== "all") {
        uQuery = query(uQuery, where("classId", "==", selectedClassId));
      }
      const uSnap = await getDocs(uQuery);

      let totalCollected = 0;
      let totalBilled = 0;
      let t1Uids = new Set();
      let t2Uids = new Set();
      let t3Uids = new Set();
      let t1Rev = 0;
      let t2Rev = 0;
      let t3Rev = 0;

      uSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.admissionAcademicYear && data.admissionAcademicYear !== year) return;
        const termStr = (data.admissionTerm || "Term 1").toLowerCase();
        const isT1 = termStr.includes("1");
        const isT2 = termStr.includes("2");
        const isT3 = termStr.includes("3");

        if (isT1) t1Uids.add(doc.id);
        if (isT2) t2Uids.add(doc.id);
        if (isT3) t3Uids.add(doc.id);
      });

      snap.docs.forEach(doc => {
        const data = doc.data();
        const termStr = data.term?.toLowerCase() || "";
        const isT1 = termStr.includes("1");
        const isT2 = termStr.includes("2");
        const isT3 = termStr.includes("3");

        if (data.type === "admission_payment") {
          totalCollected += (data.amount || 0);
          if (isT1) t1Rev += data.amount;
          if (isT2) t2Rev += data.amount;
          if (isT3) t3Rev += data.amount;
        }

        if (data.type === "admission") {
          totalBilled += (data.amount || 0);
        }
        if (data.type === "admission" || data.type === "admission_payment") {
          if (isT1) t1Uids.add(data.studentUid);
          if (isT2) t2Uids.add(data.studentUid);
          if (isT3) t3Uids.add(data.studentUid);
        }
      });

      if (isMounted.current) {
        setStats({
          totalCollected,
          totalBilled,
          term1Count: t1Uids.size,
          term1Revenue: t1Rev,
          term2Count: t2Uids.size,
          term2Revenue: t2Rev,
          term3Count: t3Uids.size,
          term3Revenue: t3Rev,
        });
      }
    } catch (e) {
      if (isMounted.current) console.error("Error fetching admission stats:", e);
    }
  }, [acadConfig.academicYear, selectedClassId]);

  const fetchAdmittedStudents = useCallback(async (termName?: string) => {
    setLoading(true);
    setStudents([]);
    try {
      const year = acadConfig.academicYear;
      if (!year) return;

      let q = query(
        collection(db, "feePayments"),
        where("type", "in", ["admission", "admission_payment"]),
        where("academicYear", "==", year)
      );

      if (selectedClassId !== "all") {
        q = query(q, where("classId", "==", selectedClassId));
      }

      const snap = await getDocs(q);

      let uQuery = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("isNewAdmission", "==", true)
      );
      if (selectedClassId !== "all") {
        uQuery = query(uQuery, where("classId", "==", selectedClassId));
      }
      const uSnap = await getDocs(uQuery);

      let uids = new Set<string>();

      uSnap.docs.forEach(d => {
        const data = d.data();
        if (data.admissionAcademicYear && data.admissionAcademicYear !== year) return;
        const docTerm = (data.admissionTerm || "").toLowerCase();
        if (termName) {
          const targetNum = termName.match(/\d/)?.[0];
          const matches = targetNum ? docTerm.includes(targetNum) : docTerm === termName.toLowerCase();
          if (matches || !docTerm) uids.add(d.id);
        } else {
          uids.add(d.id);
        }
      });

      if (termName) {
        const targetNum = termName.match(/\d/)?.[0];
        snap.docs.forEach(d => {
          const data = d.data();
          const docTerm = (data.term || "").toLowerCase();
          const matches = targetNum ? docTerm.includes(targetNum) : docTerm === termName.toLowerCase();
          if (matches && data.studentUid) {
            uids.add(data.studentUid);
          }
        });
      } else {
        snap.docs.forEach(d => {
          if (d.data().studentUid) uids.add(d.data().studentUid);
        });
      }

      const uidList = Array.from(uids);
      if (uidList.length === 0) {
        if (isMounted.current) {
          setStudents([]);
        }
        return;
      }

      const studentList: Student[] = [];
      for (let i = 0; i < uidList.length; i += 30) {
        if (!isMounted.current) return;
        const batchUids = uidList.slice(i, i + 30);
        const uq = query(collection(db, "users"), where(documentId(), "in", batchUids));
        const batchUSnap = await getDocs(uq);
        batchUSnap.docs.forEach(d => {
          const data = d.data();
          studentList.push({
            uid: d.id,
            fullName: `${data.profile?.firstName || ""} ${data.profile?.lastName || ""}`.trim() || "Student",
            classId: data.classId || "unknown",
            className: data.className || "Class",
            admissionPaid: data.admissionPaid || 0,
            admissionBill: data.admissionBill || data.admissionFee || 0,
            admissionBalance: data.admissionBalance || 0,
            walletBalance: data.walletBalance || 0,
            ptaBalance: data.ptaBalance || 0,
            maintenanceBalance: data.maintenanceBalance || 0,
            booksBalance: data.booksBalance || 0,
            uniformBalance: data.uniformBalance || 0,
            otherBalance: data.otherBalance || 0,
          });
        });
      }
      if (isMounted.current) {
        setStudents(studentList.sort((a, b) => a.fullName.localeCompare(b.fullName)));
      }
    } catch (e) {
      if (isMounted.current) {
        console.error(e);
        showToast({ message: "Failed to fetch admitted students", type: "error" });
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [acadConfig.academicYear, selectedClassId, showToast]);

  const fetchStudents = useCallback(async (isFirstLoad = false) => {
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

      const snap = await getDocs(q);
      if (snap.empty) {
        if (isMounted.current) {
          hasMoreRef.current = false;
          if (isFirstLoad) setStudents([]);
        }
        return;
      }

      const batch: Student[] = snap.docs.map(d => {
        const data = d.data();
        return {
          uid: d.id,
          fullName: `${data.profile?.firstName || ""} ${data.profile?.lastName || ""}`.trim() || "Student",
          classId: data.classId || "unknown",
          className: data.className || "Class",
          admissionPaid: data.admissionPaid || 0,
          admissionBill: data.admissionBill || 0,
          admissionBalance: data.admissionBalance || 0,
          walletBalance: data.walletBalance || 0,
          ptaBalance: data.ptaBalance || 0,
          maintenanceBalance: data.maintenanceBalance || 0,
          booksBalance: data.booksBalance || 0,
          uniformBalance: data.uniformBalance || 0,
          otherBalance: data.otherBalance || 0,
        };
      });

      if (isMounted.current) {
        lastVisibleRef.current = snap.docs[snap.docs.length - 1];
        hasMoreRef.current = snap.docs.length === PAGE_SIZE;
        setStudents(prev => isFirstLoad ? batch : [...prev, ...batch]);
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
  }, [selectedClassId, searchQuery, showToast]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      fetchStudents(true);
    } else if (selectedTerm) {
      fetchAdmittedStudents(selectedTerm);
    } else if (selectedClassId !== "all") {
      fetchAdmittedStudents();
    } else {
      setStudents([]);
    }
  }, [selectedClassId, selectedTerm, searchQuery, fetchStudents, fetchAdmittedStudents]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    if (selectedTerm) {
      fetchAdmittedStudents(selectedTerm);
    } else {
      fetchStudents(true);
    }
    fetchStats();
  }, [selectedTerm, fetchAdmittedStudents, fetchStudents, fetchStats]);

  const fetchPaymentHistory = async (studentUid: string) => {
    setLoadingHistory(true);
    try {
      const q = query(
        collection(db, "feePayments"),
        where("studentUid", "==", studentUid),
        where("type", "in", ["admission", "admission_payment"])
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => d.data());
      if (isMounted.current) {
        setHistory(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      }
    } catch (e) {
      if (isMounted.current) console.error(e);
    } finally {
      if (isMounted.current) setLoadingHistory(false);
    }
  };

  const logPayment = async (
    student: Student,
    amount: number,
    receivedFrom: string,
    paymentMethod: string
  ) => {
    if (!acadConfig.academicYear || !acadConfig.currentTerm) {
      showToast({ message: "Academic config missing. Cannot log payment.", type: "error" });
      return false;
    }
    setSaving(true);
    try {
      const year = acadConfig.academicYear?.replace(/\//g, "-");
      const term = acadConfig.currentTerm?.replace(/\s/g, "");
      const recordId = `${student.uid}_${year}_${term}`;

      // Fetch real-time studentFeeRecord for the current term to get accurate admissionBalance
      const recordSnap = await getDoc(doc(db, "studentFeeRecords", recordId));
      const recordData = recordSnap.exists() ? (recordSnap.data() as any) : null;

      const currentCatBalance = recordData
        ? (recordData.admissionBalance !== undefined
            ? recordData.admissionBalance
            : ((recordData.admissionBill || 0) - (recordData.admissionPaid || 0)))
        : (student.admissionBalance !== undefined
            ? student.admissionBalance
            : ((student.admissionBill || 0) - (student.admissionPaid || 0)));

      const batch = writeBatch(db);
      const serial = `ADM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      // INDEPENDENT PAYMENT LOGIC:
      // If payment exceeds current balance, auto-bill the difference so walletBalance impact is only the debt portion.
      const billNeeded = Math.max(0, amount - Math.max(0, currentCatBalance));
      const debtPaid = amount - billNeeded;
      const walletImpact = -debtPaid;

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
        type: "admission_payment",
        academicYear: acadConfig.academicYear,
        term: acadConfig.currentTerm,
        autoBilledAmount: billNeeded, // Store for accurate reversal
      };

      batch.set(doc(db, "feePayments", serial), paymentEntry);

      batch.update(doc(db, "users", student.uid), {
        admissionPaid: increment(amount),
        admissionBill: increment(billNeeded),
        admissionBalance: increment(billNeeded - amount),
        walletBalance: increment(walletImpact),
      });

      // Calculate total record balance update
      // Since this is a category payment, it reduces the specific category balance
      // AND the overall record balance.
      batch.set(doc(db, "studentFeeRecords", recordId), {
        studentUid: student.uid,
        studentName: student.fullName,
        classId: student.classId,
        className: student.className,
        academicYear: acadConfig.academicYear,
        term: acadConfig.currentTerm,
        admissionPaid: increment(amount),
        admissionBill: increment(billNeeded),
        admissionBalance: increment(billNeeded - amount),
        balance: increment(billNeeded - amount),
        payments: arrayUnion(paymentEntry),
        lastUpdated: serverTimestamp(),
      }, { merge: true });

      await batch.commit();

      // Propagate changes to future terms
      if (billNeeded > 0) {
        propagateArrears(student.uid, acadConfig.academicYear, acadConfig.currentTerm, billNeeded, 'bill', 'admission');
      }
      propagateArrears(student.uid, acadConfig.academicYear, acadConfig.currentTerm, -amount, 'payment', 'admission');

      try {
        await notifyStudentAndParentsPayment({
          studentUid: student.uid,
          studentName: student.fullName,
          amount,
          paymentType: "Admission Fee",
          senderUid: appUser?.uid || "admin",
          senderName: appUser?.displayName || "School Accounts",
        });
      } catch (notifErr) {
        console.error("Failed to send admission notification:", notifErr);
      }

      showToast({ message: `Admission payment recorded: ${serial}`, type: "success" });
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
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0 || !selectedStudent || !receivedFrom.trim()) {
      showToast({ message: "Please enter valid payment details", type: "error" });
      return;
    }

    const success = await logPayment(selectedStudent, amount, receivedFrom, paymentMethod);
    if (success) {
      setPaymentModalVisible(false);
      setPaymentAmount("");
      setReceivedFrom("");
    }
  };

  const logBill = async (student: Student, amount: number) => {
    if (!acadConfig.academicYear || !acadConfig.currentTerm) {
      showToast({ message: "Academic config missing. Cannot log bill.", type: "error" });
      return false;
    }
    setSaving(true);
    try {
      // Check for existing bill for this student and current term/year
      const qExisting = query(
        collection(db, "feePayments"),
        where("type", "==", "admission"),
        where("studentUid", "==", student.uid),
        where("academicYear", "==", acadConfig.academicYear),
        where("term", "==", acadConfig.currentTerm)
      );
      const existingSnap = await getDocs(qExisting);
      const existing = existingSnap.empty ? null : { id: existingSnap.docs[0].id, ...(existingSnap.docs[0].data() as any) };

      const oldAmount = existing ? (existing.amount || 0) : 0;
      const diff = amount - oldAmount;

      if (diff === 0 && existing) {
        showToast({ message: "Bill amount is the same", type: "info" });
        return true;
      }

      const batch = writeBatch(db);
      const serial = existing ? existing.id : `BILL-ADM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const billEntry = {
        amount,
        method: "Admission Bill",
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
        type: "admission",
        academicYear: acadConfig.academicYear,
        term: acadConfig.currentTerm,
      };

      batch.set(doc(db, "feePayments", serial), billEntry);

      batch.update(doc(db, "users", student.uid), {
        admissionBill: increment(diff),
        admissionBalance: increment(diff),
        walletBalance: increment(diff),
      });

      const year = acadConfig.academicYear?.replace(/\//g, "-");
      const term = acadConfig.currentTerm?.replace(/\s/g, "");
      const recordId = `${student.uid}_${year}_${term}`;

      if (existing) {
        batch.update(doc(db, "studentFeeRecords", recordId), {
          admissionBill: increment(diff),
          admissionBalance: increment(diff),
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
          admissionBill: increment(amount),
          admissionBalance: increment(amount),
          balance: increment(amount),
          payments: arrayUnion(billEntry),
          lastUpdated: serverTimestamp(),
        }, { merge: true });
      }

      await batch.commit();

      // Propagate changes to future terms
      propagateArrears(student.uid, acadConfig.academicYear, acadConfig.currentTerm, diff, 'bill', 'admission');

      showToast({ message: existing ? `Admission bill updated` : `Admission bill created: ${serial}`, type: "success" });
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
    const amount = parseFloat(billAmount);
    if (isNaN(amount) || amount <= 0 || !selectedStudent) {
      showToast({ message: "Please enter a valid billing amount", type: "error" });
      return;
    }

    const success = await logBill(selectedStudent, amount);
    if (success) {
      setPaymentModalVisible(false);
      setBillAmount("");
    }
  };

  const deletePayment = async (student: Student, payment: any) => {
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
      const autoBilled = Number(payment.autoBilledAmount) || 0;
      const debtPortion = amount - autoBilled;
      const isPayment = (payment.type || "").toLowerCase() === "admission_payment";

      if (isPayment) {
        batch.update(doc(db, "studentFeeRecords", recordId), {
          admissionPaid: increment(-amount),
          admissionBill: increment(-autoBilled),
          admissionBalance: increment(debtPortion),
          balance: increment(debtPortion),
        });
        batch.update(doc(db, "users", student.uid), {
          admissionPaid: increment(-amount),
          admissionBill: increment(-autoBilled),
          admissionBalance: increment(debtPortion),
          walletBalance: increment(debtPortion),
        });
      } else {
        batch.update(doc(db, "studentFeeRecords", recordId), {
          admissionBill: increment(-amount),
          admissionBalance: increment(-amount),
          balance: increment(-amount),
        });
        batch.update(doc(db, "users", student.uid), {
          admissionBill: increment(-amount),
          admissionBalance: increment(-amount),
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

      // Propagate changes to future terms
      if (isPayment) {
        if (autoBilled > 0) {
            propagateArrears(student.uid, acadConfig.academicYear, acadConfig.currentTerm, -autoBilled, 'bill', 'admission');
        }
        propagateArrears(student.uid, acadConfig.academicYear, acadConfig.currentTerm, amount, 'payment', 'admission');
      } else {
        propagateArrears(student.uid, acadConfig.academicYear, acadConfig.currentTerm, -amount, 'bill', 'admission');
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

  const openPaymentModal = (student: Student) => {
    setSelectedStudent(student);
    setPaymentModalVisible(true);
    fetchPaymentHistory(student.uid);
  };

  const handleBulkImport = async () => {
    if (isImportingRef.current || loading) return;
    isImportingRef.current = true;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "text/comma-separated-values",
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets.length) return;

      setLoading(true);
      const fileUri = result.assets[0].uri;

      let csvText = "";
      if (Platform.OS === 'web') {
        const asset = result.assets[0];
        if ((asset as any).file) {
          csvText = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsText((asset as any).file);
          });
        } else {
          const response = await fetch(fileUri);
          csvText = await response.text();
        }
      } else {
        csvText = await FileSystem.readAsStringAsync(fileUri);
      }

      const rows = csvText.split(/\r?\n|\r/).filter((line) => line.trim() !== "");
      if (rows.length < 2) throw new Error("CSV file is empty or missing data.");

      const userData = rows.slice(1);

      let count = 0;
      let activatedCount = 0;
      let pendingCount = 0;
      let studentIncrement = 0;
      let importErrors: string[] = [];

      const firebaseConfig = (SCHOOL_CONFIG as any).firebase;
      if (!firebaseConfig || !firebaseConfig.apiKey) {
        throw new Error("Invalid school configuration: Firebase credentials missing.");
      }

      const secondaryAppName = `bulk-import-adm-${Date.now()}`;
      const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);

      const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

      try {
        const CHUNK_SIZE = 450;
        for (let i = 0; i < userData.length; i += CHUNK_SIZE) {
          const chunk = userData.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(db);
          let chunkStudentIncrement = 0;

          for (const row of chunk) {
            const values = row.split(/[,;\t]/).map(v => v.trim().replace(/^"|"$/g, ''));

            if (values.length < 2) continue;

            const firstName = values[0];
            const lastName = values[1];
            const gender = values[2] || "";
            const extraInput = values[3];

            const cleanString = (val: string) => {
              if (!val) return "";
              const cleaned = val.trim().replace(/^"|"$/g, '');
              if (cleaned.toUpperCase().includes("E+")) {
                const num = Number(cleaned);
                return isNaN(num) ? cleaned : num.toLocaleString("fullwide", { useGrouping: false });
              }
              return cleaned;
            };

            const emergencyPhone = cleanString(values[4] || "");
            const parentPhone = cleanString(values[5] || "");
            const rawEmail = cleanString(values[6] || "");
            const password = cleanString(values[7] || "");

            if (!firstName || !lastName || firstName.toLowerCase() === "firstname") continue;

            const email = getStudentFinalEmail(rawEmail);

            let authUid = "";
            let signupCode = "";
            let status = "pending_activation";

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (email && password && password.length >= 6) {
              if (!emailRegex.test(email)) {
                importErrors.push(`${firstName} ${lastName}: Invalid email "${email}"`);
                signupCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                pendingCount++;
              } else {
                try {
                  const userCred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
                  authUid = userCred.user.uid;
                  status = "active";
                  activatedCount++;
                } catch (authError: any) {
                  const errorCode = (authError as any).code || 'auth-error';
                  if (errorCode === 'auth/email-already-in-use') {
                    importErrors.push(`${firstName} ${lastName}: Email "${email}" is already taken.`);
                  } else {
                    importErrors.push(`${firstName} ${lastName} (${email}): ${errorCode}`);
                  }
                  signupCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                  pendingCount++;
                }
              }
            } else {
              signupCode = Math.random().toString(36).substring(2, 8).toUpperCase();
              pendingCount++;
            }

            const tempId = authUid || doc(collection(db, "users")).id;

            const newUserDoc: any = {
              uid: tempId,
              role: "student",
              status: status,
              profile: { firstName, lastName, gender, emergencyPhone, parentPhone },
              createdAt: Timestamp.now(),
              parentLinkCode: generateCode(),
            };

            if (email) {
              newUserDoc.email = email.toLowerCase();
              newUserDoc.profile.email = email.toLowerCase();
            }
            if (authUid) {
              newUserDoc.authUid = authUid;
              newUserDoc.hasLoginEnabled = true;
            }

            let importClassId = "";
            if (extraInput) {
              const matchedClass = classes.find(
                (c) => c.name.toLowerCase() === extraInput.toLowerCase() || c.id === extraInput,
              );
              importClassId = matchedClass ? matchedClass.id : "";
            } else {
              importClassId = selectedClassId === "all" ? "" : selectedClassId;
            }
            newUserDoc.classId = importClassId;
            chunkStudentIncrement++;

            if (signupCode) {
              newUserDoc.signupCode = signupCode;
              const codeData: any = {
                code: signupCode,
                intendedForRole: "student",
                used: false,
                createdBy: appUser?.uid,
                createdAt: serverTimestamp(),
                classId: importClassId,
              };
              batch.set(doc(db, "signupCodes", signupCode), codeData);
            }

            batch.set(doc(db, "users", tempId), newUserDoc);
            count++;
          }

          if (chunkStudentIncrement > 0) {
            const statsRef = doc(db, "stats", "global");
            batch.set(statsRef, { totalStudents: increment(chunkStudentIncrement) }, { merge: true });
            studentIncrement += chunkStudentIncrement;
          }
          await batch.commit();
        }

        if (count > 0) {
          let summaryMsg = `Successfully imported ${count} student(s).`;
          if (activatedCount > 0) summaryMsg += `\n- ${activatedCount} Active (Login enabled)`;
          if (pendingCount > 0) summaryMsg += `\n- ${pendingCount} Pending Activation`;

          if (importErrors.length > 0) {
            Alert.alert(
              "Import Completed with Warnings",
              `${summaryMsg}\n\nSome accounts could not be activated:\n${importErrors.slice(0, 5).join("\n")}${importErrors.length > 5 ? "\n..." : ""}`,
              [{ text: "OK" }]
            );
          } else {
            showToast?.({ message: summaryMsg, type: "success" });
          }
          handleRefresh();
        }
      } finally {
        await deleteApp(secondaryApp);
      }
    } catch (error: any) {
      console.error(error);
      showToast?.({ message: `Import Failed: ${error.message}`, type: "error" });
    } finally {
      setLoading(false);
      isImportingRef.current = false;
    }
  };

  const handleRegisterStudent = useCallback(
    async (params: {
      fullName: string;
      classId?: string;
      className?: string;
      username: string;
      password?: string;
      parent1Name: string;
      parent1Phone: string;
      parent2Name?: string;
      parent2Phone?: string;
      parentLinkCode?: string;
    }) => {
      setSaving(true);
      try {
        const {
          fullName,
          classId: inputClassId = "",
          className: inputClassName = "",
          username,
          password = "123456",
          parent1Name,
          parent1Phone,
          parent2Name = "",
          parent2Phone = "",
          parentLinkCode: customCode,
        } = params;

        const trimmedFullName = fullName.trim();
        if (!trimmedFullName) throw new Error("Student full name is required.");

        // Resolve class by name or ID for unambiguous identification
        const matchedClass = classes.find(
          (c) =>
            (inputClassId && c.id === inputClassId) ||
            (inputClassName && c.name.toLowerCase() === inputClassName.toLowerCase()) ||
            (inputClassId && c.name.toLowerCase() === inputClassId.toLowerCase()),
        );

        const classId = matchedClass ? matchedClass.id : inputClassId;
        const className = matchedClass ? matchedClass.name : (inputClassName || inputClassId);

        if (!className && !classId) throw new Error("Please select a valid class name.");

        const autoUser = trimmedFullName
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, "")
          .replace(/\s+/g, ".")
          .replace(/^\.|\.$/g, "");
        const cleanUsername = username.trim() || autoUser;
        if (!cleanUsername) throw new Error("Username is required.");

        const nameParts = trimmedFullName.split(/\s+/);
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || firstName;

        const email = getStudentFinalEmail(cleanUsername);
        const cleanPassword = password.trim() || "123456";

        const firebaseConfig = (SCHOOL_CONFIG as any).firebase;
        if (!firebaseConfig || !firebaseConfig.apiKey) {
          throw new Error("Invalid school configuration: Firebase credentials missing.");
        }

        const secondaryAppName = `reg-student-${Date.now()}`;
        const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
        const secondaryAuth = getAuth(secondaryApp);

        const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();
        const studentCode = customCode || generateCode();
        const parentLinkCode = studentCode;

        let authUid = "";
        let status = "pending_activation";
        let hasLoginEnabled = false;

        try {
          const userCred = await createUserWithEmailAndPassword(
            secondaryAuth,
            email,
            cleanPassword,
          );
          authUid = userCred.user.uid;
          status = "active";
          hasLoginEnabled = true;
        } catch (authError: any) {
          const errorCode = authError?.code || "auth-error";
          if (errorCode === "auth/email-already-in-use") {
            throw new Error(`Username "${cleanUsername}" (${email}) is already taken.`);
          } else if (errorCode === "auth/weak-password") {
            throw new Error("Password must be at least 6 characters long.");
          } else {
            console.warn("Auth registration fallback:", authError);
          }
        } finally {
          await deleteApp(secondaryApp);
        }

        const tempId = authUid || doc(collection(db, "users")).id;
        const now = Timestamp.now();
        const dateStr = moment().format("YYYY-MM-DD");

        const newUserDoc: any = {
          uid: tempId,
          role: "student",
          status: status,
          email: email.toLowerCase(),
          hasLoginEnabled: hasLoginEnabled,
          classId: classId,
          className: className,
          parentLinkCode: parentLinkCode,
          studentCode: studentCode,
          signupCode: parentLinkCode,
          createdAt: now,
          dateOfAdmission: now,
          admissionDate: dateStr,
          isNewAdmission: true,
          admissionAcademicYear: acadConfig.academicYear || moment().year().toString(),
          admissionTerm: acadConfig.currentTerm || "Term 1",
          profile: {
            firstName,
            lastName,
            fullName: `${firstName} ${lastName}`.trim(),
            email: email.toLowerCase(),
            parentName: parent1Name.trim(),
            parentPhone: parent1Phone.trim(),
            parent2Name: parent2Name.trim(),
            parent2Phone: parent2Phone.trim(),
            emergencyPhone: (parent1Phone || parent2Phone || "").trim(),
          },
        };

        if (authUid) {
          newUserDoc.authUid = authUid;
        }

        const batch = writeBatch(db);
        batch.set(doc(db, "users", tempId), newUserDoc);

        const paymentId = doc(collection(db, "feePayments")).id;
        const admissionRecord = {
          id: paymentId,
          studentUid: tempId,
          classId: classId,
          className: className,
          academicYear: acadConfig.academicYear || moment().year().toString(),
          term: acadConfig.currentTerm || "Term 1",
          type: "admission",
          amount: 0,
          createdAt: serverTimestamp(),
        };
        batch.set(doc(db, "feePayments", paymentId), admissionRecord);

        const codeData: any = {
          code: parentLinkCode,
          intendedForRole: "student",
          used: hasLoginEnabled,
          createdBy: appUser?.uid,
          createdAt: serverTimestamp(),
          classId: classId,
          className: className,
        };
        batch.set(doc(db, "signupCodes", parentLinkCode), codeData);

        const statsRef = doc(db, "stats", "global");
        batch.set(statsRef, { totalStudents: increment(1) }, { merge: true });

        await batch.commit();

        showToast?.({
          message: `Student "${trimmedFullName}" registered in ${className}!`,
          type: "success",
        });

        const alertMsg = `Student Registered!\n\nName: ${trimmedFullName}\nClass: ${className}\nUsername: ${cleanUsername}\nEmail: ${email}\nPassword: ${cleanPassword}\nParent Link Code: ${parentLinkCode}\nDate of Admission: ${moment().format("MMM DD, YYYY")}`;

        if (Platform.OS === "web") {
          alert(alertMsg);
        } else {
          Alert.alert("Registration Successful", alertMsg, [{ text: "OK" }]);
        }

        handleRefresh();
        return true;
      } catch (error: any) {
        console.error("Student registration error:", error);
        showToast?.({
          message: error.message || "Failed to register student",
          type: "error",
        });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [appUser?.uid, classes, showToast, handleRefresh],
  );

  return {
    loading,
    refreshing,
    saving,
    students,
    classes,
    stats,
    handleRefresh,
    logPayment,
    logBill,
    deletePayment,
    fetchStudents,
    handleBulkImport,
    handleRegisterStudent,

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
    history,
    loadingHistory,
    activeTab,
    setActiveTab,
    billAmount,
    setBillAmount,
    handleLogPayment,
    handleLogBill,
    openPaymentModal,
  };
};

