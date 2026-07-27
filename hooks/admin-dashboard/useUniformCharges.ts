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

export type Student = {
  uid: string;
  fullName: string;
  classId: string;
  className: string;
  uniformPaid: number;
  uniformBill: number;
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
}

export const useUniformCharges = ({
  appUser,
  acadConfig,
  showToast,
  selectedClassId,
  searchQuery,
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
      setStats({ totalCollected: total, count: snap.docs.length, breakdown });
    } catch (e) {
      console.error("Error fetching uniform stats:", e);
    }
  }, [acadConfig.academicYear, acadConfig.currentTerm, selectedClassId]);

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
            walletBalance: data.walletBalance || 0,
            ptaBalance: data.ptaBalance || 0,
            admissionBalance: data.admissionBalance || 0,
            maintenanceBalance: data.maintenanceBalance || 0,
            booksBalance: data.booksBalance || 0,
            otherBalance: data.otherBalance || 0,
          });
        });
      }
      setStudents(list.sort((a, b) => a.fullName.localeCompare(b.fullName)));
    } catch (e) {
      console.error(e);
      showToast({ message: "Failed to fetch uniform students", type: "error" });
    } finally {
      setLoading(false);
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
            walletBalance: data.walletBalance || 0,
            ptaBalance: data.ptaBalance || 0,
            admissionBalance: data.admissionBalance || 0,
            maintenanceBalance: data.maintenanceBalance || 0,
            booksBalance: data.booksBalance || 0,
            otherBalance: data.otherBalance || 0,
          };
        });

        lastVisibleRef.current = snap.docs[snap.docs.length - 1];
        hasMoreRef.current = snap.docs.length === PAGE_SIZE;
        setStudents((prev) => (isFirstLoad ? batch : [...prev, ...batch]));
      } catch (e) {
        console.error(e);
      } finally {
        isFetchingRef.current = false;
        setLoading(false);
        setRefreshing(false);
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

  const handleLogPayment = async (
    student: Student,
    amount: number,
    receivedFrom: string,
    selectedType: string,
    typeLabel: string
  ) => {
    if (!acadConfig.academicYear || !acadConfig.currentTerm) {
      showToast({ message: "Academic config missing. Cannot log payment.", type: "error" });
      return false;
    }
    if (amount <= 0 || !receivedFrom.trim()) {
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
        where("subType", "==", selectedType),
        where("academicYear", "==", acadConfig.academicYear),
        where("term", "==", acadConfig.currentTerm)
      );
      const existingSnap = await getDocsFromServer(qExisting);
      const existing = existingSnap.empty ? null : { id: existingSnap.docs[0].id, ...(existingSnap.docs[0].data() as any) };

      const oldAmount = existing ? (existing.amount || 0) : 0;
      const diff = amount - oldAmount;

      if (diff === 0 && existing) {
        showToast({ message: "Amount is the same as existing record", type: "info" });
        setSaving(false);
        return true;
      }

      const batch = writeBatch(db);
      const serial = existing ? existing.id : `UNI-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const entry = {
        amount,
        method: "Cash",
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
        type: "uniform",
        subType: selectedType,
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
            uniformPaid: increment(amount),
            uniformBill: increment(amount),
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

      // Propagate changes to future terms
      if (Math.abs(diff) >= 0.01) {
        propagateArrears(student.uid, acadConfig.academicYear, acadConfig.currentTerm, diff, 'bill', 'uniform');
        propagateArrears(student.uid, acadConfig.academicYear, acadConfig.currentTerm, -diff, 'payment', 'uniform');
      }

      try {
        await sendNotification({
          recipientId: student.uid,
          senderId: appUser?.uid || "admin",
          senderName: appUser?.displayName || "Administrator",
          title: "Uniform Payment Recorded",
          body: `A payment for ${typeLabel} (${SCHOOL_CONFIG.currencySymbol}${amount.toLocaleString()}) has been recorded for ${student.fullName}.`,
          type: "payment",
          data: {
            studentUid: student.uid,
            amount: amount,
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

      batch.update(doc(db, "studentFeeRecords", recordId), {
        uniformPaid: increment(-amount),
        uniformBill: increment(-amount),
        payments: arrayRemove(payment),
        lastUpdated: serverTimestamp(),
      });
      batch.update(doc(db, "users", student.uid), {
        uniformPaid: increment(-amount),
        uniformBill: increment(-amount),
      });

      if (payment.receiptNo) {
        batch.delete(doc(db, "feePayments", payment.receiptNo));
      }

      await batch.commit();

      // Propagate changes to future terms
      if (Math.abs(amount) >= 0.01) {
        propagateArrears(student.uid, acadConfig.academicYear, acadConfig.currentTerm, -amount, 'bill', 'uniform');
        propagateArrears(student.uid, acadConfig.academicYear, acadConfig.currentTerm, amount, 'payment', 'uniform');
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
    fetchStudents,
  };
};
