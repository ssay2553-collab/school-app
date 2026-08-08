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
  maintenancePaid: number;
  maintenanceBill: number;
  maintenanceBalance: number;
  walletBalance: number;
  admissionBalance?: number;
  ptaBalance?: number;
  otherBalance?: number;
  booksBalance?: number;
  uniformBalance?: number;
};

interface UseMaintenanceChargesProps {
  appUser: any;
  acadConfig: any;
  showToast: (props: { message: string; type: "success" | "error" | "warning" | "info" }) => void;
  selectedClassId: string;
  searchQuery: string;
}

export const useMaintenanceCharges = ({
  appUser,
  acadConfig,
  showToast,
  selectedClassId,
  searchQuery,
}: UseMaintenanceChargesProps) => {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalBilled: 0, totalCollected: 0 });

  const lastVisibleRef = useRef<any>(null);
  const hasMoreRef = useRef(true);
  const isFetchingRef = useRef(false);

  // Initialize classes
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
        where("type", "in", ["maintenance", "maintenance_payment"]),
        where("academicYear", "==", acadConfig.academicYear),
        where("term", "==", acadConfig.currentTerm)
      );
      const snap = await getDocsFromServer(q);
      let collected = 0;
      let billed = 0;
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.type === "maintenance_payment") collected += data.amount || 0;
        if (data.type === "maintenance") billed += data.amount || 0;
      });
      setStats({ totalCollected: collected, totalBilled: billed });
    } catch (e) {
      console.error("Error fetching Maintenance stats:", e);
    }
  }, [acadConfig.academicYear, acadConfig.currentTerm]);

  const fetchStudents = useCallback(
    async (isFirstLoad = false) => {
      if (isFetchingRef.current) return;

      if (searchQuery.length < 2 && selectedClassId === "all") {
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
            maintenancePaid: data.maintenancePaid || 0,
            maintenanceBill: data.maintenanceBill || 0,
            maintenanceBalance: data.maintenanceBalance || 0,
            walletBalance: data.walletBalance || 0,
            admissionBalance: data.admissionBalance || 0,
            ptaBalance: data.ptaBalance || 0,
            otherBalance: data.otherBalance || 0,
            booksBalance: data.booksBalance || 0,
            uniformBalance: data.uniformBalance || 0,
          };
        });

        lastVisibleRef.current = snap.docs[snap.docs.length - 1];
        hasMoreRef.current = snap.docs.length === PAGE_SIZE;
        setStudents((prev) => (isFirstLoad ? batch : [...prev, ...batch]));
      } catch (e) {
        console.error(e);
        showToast({ message: "Failed to fetch students", type: "error" });
      } finally {
        isFetchingRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedClassId, searchQuery, showToast]
  );

  useEffect(() => {
    const delay = setTimeout(() => {
      fetchStudents(true);
    }, 400);
    return () => clearTimeout(delay);
  }, [selectedClassId, searchQuery, acadConfig.academicYear, acadConfig.currentTerm, fetchStudents]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStudents(true);
    fetchStats();
  }, [fetchStudents, fetchStats]);

  const handleLogPayment = async (
    student: Student,
    amount: number,
    receivedFrom: string,
    paymentMethod: string
  ) => {
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
      const serial = `MNT-PAY-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

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
        type: "maintenance_payment",
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
          maintenanceBalance: increment(-amount),
          maintenancePaid: increment(amount),
          balance: increment(-amount),
          payments: arrayUnion(paymentEntry),
          lastUpdated: serverTimestamp(),
        },
        { merge: true }
      );

      batch.update(doc(db, "users", student.uid), {
        maintenanceBalance: increment(-amount),
        maintenancePaid: increment(amount),
        walletBalance: increment(-amount),
      });

      await batch.commit();

      propagateArrears(student.uid, acadConfig.academicYear, acadConfig.currentTerm, -amount, 'payment', 'maintenance').catch(console.error);

      sendNotification({
        recipientId: student.uid,
        senderId: appUser?.uid || "admin",
        senderName: appUser?.profile?.firstName || "School Admin",
        title: "Maintenance Payment Received",
        body: `A maintenance payment of ${SCHOOL_CONFIG.currencySymbol}${amount.toLocaleString()} has been recorded for ${student.fullName}.`,
        type: "payment",
      }).catch((e) => console.error(e));

      showToast({ message: "Payment recorded", type: "success" });
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

  const applyBulkCharge = async (amount: number) => {
    if (amount <= 0) {
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
        where("type", "==", "maintenance"),
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

      const year = acadConfig.academicYear?.replace(/\//g, "-");
      const term = acadConfig.currentTerm?.replace(/\s/g, "");
      const docs = snap.docs;
      const CHUNK_SIZE = 150;

      for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
        const chunk = docs.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);

        chunk.forEach((sDoc) => {
          const s = sDoc.data();
          const existing = existingBillsMap.get(sDoc.id);
          const oldAmount = existing ? existing.amount : 0;
          const diff = amount - oldAmount;

          if (diff === 0) return;

          const serial = existing ? existing.id : `MNT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
          const recordId = `${sDoc.id}_${year}_${term}`;

          const billData = {
            amount,
            method: "Bulk Charge",
            receivedFrom: "Maintenance Fee",
            updatedBy: appUser?.adminRole || "Admin",
            adminUid: appUser?.uid || "unknown",
            createdAt: new Date().toISOString(),
            receiptNo: serial,
            date: moment().format("YYYY-MM-DD"),
            studentUid: sDoc.id,
            studentName: `${s.profile?.firstName || ""} ${s.profile?.lastName || ""}`.trim(),
            classId: selectedClassId,
            className: s.className,
            type: "maintenance",
            academicYear: acadConfig.academicYear,
            term: acadConfig.currentTerm,
          };

          batch.set(doc(db, "feePayments", serial), billData);

          if (existing) {
            batch.update(doc(db, "studentFeeRecords", recordId), {
              maintenanceBill: increment(diff),
              maintenanceBalance: increment(diff),
              balance: increment(diff),
              lastUpdated: serverTimestamp(),
              // Append to payments list so reconciler sees the latest charge amount
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
                maintenanceBill: increment(amount),
                maintenanceBalance: increment(amount),
                balance: increment(amount),
                maintenancePaid: 0,
                payments: arrayUnion(billData),
                lastUpdated: serverTimestamp(),
              },
              { merge: true }
            );
          }

          batch.update(sDoc.ref, {
            maintenanceBalance: increment(diff),
            maintenanceBill: increment(diff),
            walletBalance: increment(diff),
          });
        });

        await batch.commit();
      }

      showToast({ message: `Maintenance charges applied to ${snap.size} students`, type: "success" });

      // Propagate bulk charges
      snap.docs.forEach(sDoc => {
        const existing = existingBillsMap.get(sDoc.id);
        const oldAmount = existing ? existing.amount : 0;
        const diff = amount - oldAmount;
        if (Math.abs(diff) > 0.01) {
          propagateArrears(sDoc.id, acadConfig.academicYear, acadConfig.currentTerm, diff, 'bill', 'maintenance').catch(console.error);
        }
      });

      handleRefresh();
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
      const isPayment = (payment.type || "").toLowerCase() === "maintenance_payment";

      if (isPayment) {
        batch.update(doc(db, "studentFeeRecords", recordId), {
          maintenancePaid: increment(-amount),
          maintenanceBalance: increment(amount),
          balance: increment(amount),
        });
        batch.update(doc(db, "users", student.uid), {
          maintenancePaid: increment(-amount),
          maintenanceBalance: increment(amount),
          walletBalance: increment(amount),
        });
      } else {
        batch.update(doc(db, "studentFeeRecords", recordId), {
          maintenanceBill: increment(-amount),
          maintenanceBalance: increment(-amount),
          balance: increment(-amount),
        });
        batch.update(doc(db, "users", student.uid), {
          maintenanceBill: increment(-amount),
          maintenanceBalance: increment(-amount),
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
      propagateArrears(student.uid, acadConfig.academicYear, acadConfig.currentTerm, propagationAmount, propType, 'maintenance').catch(console.error);

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
    handleLogPayment,
    applyBulkCharge,
    handleDeletePayment,
    fetchStudents,
  };
};
