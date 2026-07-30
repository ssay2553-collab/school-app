import { useState, useCallback, useRef, useEffect } from "react";
import {
  collection,
  doc,
  getDocsFromServer,
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

      const snap = await getDocsFromServer(q);

      let totalCollected = 0;
      let totalBilled = 0;
      let t1Uids = new Set();
      let t2Uids = new Set();
      let t3Uids = new Set();
      let t1Rev = 0;
      let t2Rev = 0;
      let t3Rev = 0;

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
          if (isT1) t1Uids.add(data.studentUid);
          if (isT2) t2Uids.add(data.studentUid);
          if (isT3) t3Uids.add(data.studentUid);
        }
      });

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
    } catch (e) {
      console.error("Error fetching admission stats:", e);
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

      const snap = await getDocsFromServer(q);

      let uids: string[] = [];
      if (termName) {
        const targetNum = termName.match(/\d/)?.[0];
        uids = Array.from(new Set(
          snap.docs
            .filter(d => {
              const docTerm = (d.data().term || "").toLowerCase();
              return targetNum ? docTerm.includes(targetNum) : docTerm === termName.toLowerCase();
            })
            .map(d => d.data().studentUid)
        ));
      } else {
        uids = Array.from(new Set(snap.docs.map(d => d.data().studentUid)));
      }

      if (uids.length === 0) {
        setStudents([]);
        return;
      }

      const studentList: Student[] = [];
      for (let i = 0; i < uids.length; i += 30) {
        const batchUids = uids.slice(i, i + 30);
        const uq = query(collection(db, "users"), where(documentId(), "in", batchUids));
        const uSnap = await getDocsFromServer(uq);
        uSnap.docs.forEach(d => {
          const data = d.data();
          studentList.push({
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
          });
        });
      }
      setStudents(studentList.sort((a, b) => a.fullName.localeCompare(b.fullName)));
    } catch (e) {
      console.error(e);
      showToast({ message: "Failed to fetch admitted students", type: "error" });
    } finally {
      setLoading(false);
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

      const snap = await getDocsFromServer(q);
      if (snap.empty) {
        hasMoreRef.current = false;
        if (isFirstLoad) setStudents([]);
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
      const batch = writeBatch(db);
      const serial = `ADM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

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
      };

      batch.set(doc(db, "feePayments", serial), paymentEntry);

      batch.update(doc(db, "users", student.uid), {
        admissionPaid: increment(amount),
        admissionBalance: increment(-amount),
        walletBalance: increment(-amount),
      });

      const year = acadConfig.academicYear?.replace(/\//g, "-");
      const term = acadConfig.currentTerm?.replace(/\s/g, "");
      const recordId = `${student.uid}_${year}_${term}`;

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
        admissionBalance: increment(-amount),
        balance: increment(-amount),
        payments: arrayUnion(paymentEntry),
        lastUpdated: serverTimestamp(),
      }, { merge: true });

      await batch.commit();

      // Propagate changes to future terms
      propagateArrears(student.uid, acadConfig.academicYear, acadConfig.currentTerm, -amount, 'payment', 'admission');

      try {
        await sendNotification({
          recipientId: student.uid,
          senderId: appUser?.uid || "admin",
          senderName: appUser?.displayName || "Administrator",
          title: "Admission Payment Received",
          body: `An admission payment of ${SCHOOL_CONFIG.currencySymbol}${amount.toLocaleString()} has been recorded for ${student.fullName}.`,
          type: "payment",
          data: {
            studentUid: student.uid,
            amount,
            type: "admission_payment"
          }
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
      const existingSnap = await getDocsFromServer(qExisting);
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
      const isPayment = (payment.type || "").toLowerCase() === "admission_payment";

      if (isPayment) {
        batch.update(doc(db, "studentFeeRecords", recordId), {
          admissionPaid: increment(-amount),
          admissionBalance: increment(amount),
          balance: increment(amount),
        });
        batch.update(doc(db, "users", student.uid), {
          admissionPaid: increment(-amount),
          admissionBalance: increment(amount),
          walletBalance: increment(amount),
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
      const propagationAmount = isPayment ? amount : -amount;
      const propType = isPayment ? 'payment' : 'bill';
      propagateArrears(student.uid, acadConfig.academicYear, acadConfig.currentTerm, propagationAmount, propType, 'admission');

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
  };
};
