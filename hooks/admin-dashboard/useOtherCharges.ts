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
  otherPaid: number;
  otherBill: number;
  otherBalance: number;
  walletBalance: number;
  admissionBalance?: number;
  ptaBalance?: number;
  maintenanceBalance?: number;
  booksBalance?: number;
  uniformBalance?: number;
};

interface UseOtherChargesProps {
  appUser: any;
  acadConfig: any;
  showToast: (props: { message: string; type: "success" | "error" | "info" | "warning" }) => void;
  selectedClassId: string;
  searchQuery: string;
}

export const useOtherCharges = ({
  appUser,
  acadConfig,
  showToast,
  selectedClassId,
  searchQuery,
}: UseOtherChargesProps) => {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalBilled: 0, totalCollected: 0 });
  const [appliedCharges, setAppliedCharges] = useState<any[]>([]);
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
      const year = acadConfig.academicYear;
      if (!year) return;

      let q = query(
        collection(db, "feePayments"),
        where("type", "in", ["other", "other_payment"]),
        where("academicYear", "==", year)
      );

      if (selectedClassId !== "all") {
        q = query(q, where("classId", "==", selectedClassId));
      }

      const snap = await getDocsFromServer(q);

      let totalCollected = 0;
      let totalBilled = 0;
      const groups: Record<string, { category: string, amount: number, date: string, count: number }> = {};

      snap.docs.forEach((doc) => {
        const data = doc.data();
        if (data.type === "other_payment") {
          totalCollected += data.amount || 0;
        }
        if (data.type === "other") {
          totalBilled += data.amount || 0;
          const cat = data.otherCategory || "Other";
          if (!groups[cat]) {
            groups[cat] = { category: cat, amount: data.amount, date: data.date, count: 0 };
          }
          groups[cat].count++;
        }
      });

      setStats({ totalBilled: totalBilled, totalCollected: totalCollected });
      setAppliedCharges(Object.values(groups).sort((a, b) => b.date.localeCompare(a.date)));
    } catch (e) {
      console.error("Error fetching other charges stats:", e);
    }
  }, [acadConfig.academicYear, selectedClassId]);

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
            otherPaid: data.otherPaid || 0,
            otherBill: data.otherBill || 0,
            otherBalance: data.otherBalance || 0,
            walletBalance: data.walletBalance || 0,
            admissionBalance: data.admissionBalance || 0,
            ptaBalance: data.ptaBalance || 0,
            maintenanceBalance: data.maintenanceBalance || 0,
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

  const fetchPaymentHistory = useCallback(async (studentUid: string) => {
    setLoadingHistory(true);
    try {
      const q = query(
        collection(db, "feePayments"),
        where("studentUid", "==", studentUid),
        where("type", "in", ["other", "other_payment"])
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
      const serial = `OTH-PAY-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

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
        type: "other_payment",
        academicYear: acadConfig.academicYear,
        term: acadConfig.currentTerm,
      };

      batch.set(doc(db, "feePayments", serial), paymentEntry);

      batch.update(doc(db, "users", student.uid), {
        otherPaid: increment(amount),
        otherBalance: increment(-amount),
        walletBalance: increment(-amount),
      });

      const year = acadConfig.academicYear?.replace(/\//g, "-");
      const term = acadConfig.currentTerm?.replace(/\s/g, "");
      const recordId = `${student.uid}_${year}_${term}`;

      batch.set(
        doc(db, "studentFeeRecords", recordId),
        {
          studentUid: student.uid,
          studentName: student.fullName,
          classId: student.classId,
          className: student.className,
          academicYear: acadConfig.academicYear,
          term: acadConfig.currentTerm,
          otherPaid: increment(amount),
          otherBalance: increment(-amount),
          balance: increment(-amount),
          payments: arrayUnion(paymentEntry),
          lastUpdated: serverTimestamp(),
        },
        { merge: true }
      );

      await batch.commit();

      // Propagate changes to future terms
      propagateArrears(student.uid, acadConfig.academicYear, acadConfig.currentTerm, -amount, 'payment', 'other');

      sendNotification({
        recipientId: student.uid,
        senderId: appUser?.uid || "admin",
        senderName: appUser?.displayName || "Administrator",
        title: "Other Fees Payment Received - Thank You!",
        body: `Thank you! We've received a payment of ${SCHOOL_CONFIG.currencySymbol}${amount.toLocaleString()} for ${student.fullName} towards miscellaneous charges. We appreciate your promptness!`,
        type: "payment",
      }).catch((e) => console.error(e));

      showToast({ message: `Payment recorded: ${serial}`, type: "success" });
      fetchStats();
      fetchStudents(true);
      return true;
    } catch (e) {
      console.error(e);
      showToast({ message: "Failed to record payment", type: "error" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const applyOtherCharge = async (chargeType: string, chargeAmount: string) => {
    if (!acadConfig.academicYear || !acadConfig.currentTerm) {
      showToast({ message: "Academic config missing. Cannot apply charge.", type: "error" });
      return false;
    }
    const val = parseFloat(chargeAmount);
    if (!chargeType.trim() || isNaN(val) || val <= 0) {
      showToast({ message: "Invalid details", type: "error" });
      return false;
    }
    if (selectedClassId === "all") {
      showToast({ message: "Please select a specific class first", type: "error" });
      return false;
    }

    // Check if this specific category already has a bill for this class/term
    const qExisting = query(
      collection(db, "feePayments"),
      where("type", "==", "other"),
      where("classId", "==", selectedClassId),
      where("academicYear", "==", acadConfig.academicYear),
      where("term", "==", acadConfig.currentTerm),
      where("otherCategory", "==", chargeType.trim())
    );
    const existingSnap = await getDocsFromServer(qExisting);
    const existingBillsMap = new Map<string, any>();
    existingSnap.docs.forEach(d => {
      existingBillsMap.set(d.data().studentUid, { id: d.id, ...d.data() });
    });

    setSaving(true);
    try {
      const q = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("classId", "==", selectedClassId),
        where("status", "in", ["active", "pending_activation"])
      );
      const snap = await getDocsFromServer(q);

      const batch = writeBatch(db);
      const year = acadConfig.academicYear?.replace(/\//g, "-");
      const term = acadConfig.currentTerm?.replace(/\s/g, "");

      snap.docs.forEach((sDoc) => {
        const s = sDoc.data();
        const existing = existingBillsMap.get(sDoc.id);
        const oldAmount = existing ? existing.amount : 0;
        const diff = val - oldAmount;

        if (diff === 0 && existing) return;

        const serial = existing ? existing.id : `BILL-OTH-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const recordId = `${sDoc.id}_${year}_${term}`;

        const billData = {
          amount: val,
          method: "Bulk Charge",
          receivedFrom: chargeType.trim(),
          updatedBy: appUser?.adminRole || "Admin",
          adminUid: appUser?.uid || "unknown",
          createdAt: new Date().toISOString(),
          receiptNo: serial,
          date: moment().format("YYYY-MM-DD"),
          studentUid: sDoc.id,
          studentName: `${s.profile?.firstName || ""} ${s.profile?.lastName || ""}`.trim(),
          classId: selectedClassId,
          className: s.className,
          type: "other",
          otherCategory: chargeType.trim(),
          academicYear: acadConfig.academicYear,
          term: acadConfig.currentTerm,
        };

        batch.set(doc(db, "feePayments", serial), billData);

        batch.update(sDoc.ref, {
          otherBill: increment(diff),
          otherBalance: increment(diff),
          walletBalance: increment(diff),
        });

        if (existing) {
          batch.update(doc(db, "studentFeeRecords", recordId), {
            otherBill: increment(diff),
            otherBalance: increment(diff),
            balance: increment(diff),
            lastUpdated: serverTimestamp(),
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
              otherBill: increment(val),
              otherBalance: increment(val),
              balance: increment(val),
              payments: arrayUnion(billData),
              lastUpdated: serverTimestamp(),
            },
            { merge: true }
          );
        }

        if (!existing) {
          sendNotification({
            recipientId: sDoc.id,
            senderId: appUser?.uid || "admin",
            senderName: appUser?.displayName || "Administrator",
            title: "New Fee Item Billed",
            body: `An amount of ${SCHOOL_CONFIG.currencySymbol}${val.toLocaleString()} for '${chargeType}' has been added to the bill.`,
            type: "payment",
          }).catch((err) => console.error("Bulk notification error:", err));
        }
      });

      await batch.commit();

      // Propagate changes to future terms for each student
      snap.docs.forEach((sDoc) => {
        const s = sDoc.data();
        const existing = existingBillsMap.get(sDoc.id);
        const oldAmount = existing ? existing.amount : 0;
        const diff = val - oldAmount;
        if (diff !== 0) {
          propagateArrears(sDoc.id, acadConfig.academicYear, acadConfig.currentTerm, diff, 'bill', 'other');
        }
      });

      showToast({ message: existingSnap.empty ? `Billed ${snap.size} students for ${chargeType}` : `Updated '${chargeType}' for ${snap.size} students`, type: "success" });
      fetchStats();
      fetchStudents(true);
      return true;
    } catch (e) {
      console.error(e);
      showToast({ message: "Failed to apply bulk charges", type: "error" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCharge = async (category: string) => {
    setSaving(true);
    try {
      const q = query(
        collection(db, "feePayments"),
        where("classId", "==", selectedClassId),
        where("type", "==", "other"),
        where("otherCategory", "==", category),
        where("academicYear", "==", acadConfig.academicYear)
      );
      const snap = await getDocsFromServer(q);

      const batch = writeBatch(db);
      const year = acadConfig.academicYear?.replace(/\//g, "-");
      const term = acadConfig.currentTerm?.replace(/\s/g, "");

      for (const d of snap.docs) {
        const data = d.data();
        const studentUid = data.studentUid;
        const amount = data.amount;
        const recordId = `${studentUid}_${year}_${term}`;

        batch.update(doc(db, "users", studentUid), {
          otherBill: increment(-amount),
          otherBalance: increment(-amount),
          walletBalance: increment(-amount),
        });

        batch.set(
          doc(db, "studentFeeRecords", recordId),
          {
            otherBill: increment(-amount),
            otherBalance: increment(-amount),
            balance: increment(-amount),
            payments: arrayRemove(data),
          },
          { merge: true }
        );

        batch.delete(d.ref);
      }

      await batch.commit();

      // Propagate changes to future terms for each affected student
      snap.docs.forEach((d) => {
        const data = d.data();
        propagateArrears(data.studentUid, acadConfig.academicYear, acadConfig.currentTerm, -data.amount, 'bill', 'other');
      });

      showToast({ message: `Charge '${category}' removed`, type: "success" });
      fetchStats();
      fetchStudents(true);
      return true;
    } catch (e) {
      console.error(e);
      showToast({ message: "Delete failed", type: "error" });
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
      const isPayment = (payment.type || "").toLowerCase() === "other_payment";

      if (isPayment) {
        batch.update(doc(db, "studentFeeRecords", recordId), {
          otherPaid: increment(-amount),
          otherBalance: increment(amount),
          balance: increment(amount),
        });
        batch.update(doc(db, "users", student.uid), {
          otherPaid: increment(-amount),
          otherBalance: increment(amount),
          walletBalance: increment(amount),
        });
      } else {
        batch.update(doc(db, "studentFeeRecords", recordId), {
          otherBill: increment(-amount),
          otherBalance: increment(-amount),
          balance: increment(-amount),
        });
        batch.update(doc(db, "users", student.uid), {
          otherBill: increment(-amount),
          otherBalance: increment(-amount),
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
        propagateArrears(student.uid, acadConfig.academicYear, acadConfig.currentTerm, amount, 'payment', 'other');
      } else {
        propagateArrears(student.uid, acadConfig.academicYear, acadConfig.currentTerm, -amount, 'bill', 'other');
      }

      showToast({ message: "Transaction reverted successfully", type: "success" });
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

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStudents(true);
    fetchStats();
  }, [fetchStudents, fetchStats]);

  useEffect(() => {
    const delay = setTimeout(() => {
      fetchStudents(true);
    }, 400);
    return () => clearTimeout(delay);
  }, [selectedClassId, searchQuery, acadConfig.academicYear, fetchStudents]);

  useEffect(() => {
    fetchStats();
  }, [selectedClassId, acadConfig.academicYear, fetchStats]);

  return {
    loading,
    refreshing,
    saving,
    students,
    classes,
    stats,
    appliedCharges,
    history,
    loadingHistory,
    fetchStudents,
    fetchPaymentHistory,
    handleLogPayment,
    applyOtherCharge,
    handleDeleteCharge,
    handleDeletePayment,
    handleRefresh,
  };
};
