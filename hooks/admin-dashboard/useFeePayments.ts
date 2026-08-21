import { useState, useEffect } from "react";
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
} from "firebase/firestore";
import moment from "moment";
import { Alert, Platform } from "react-native";
import { db } from "../../firebaseConfig";
import { StudentDraft } from "../../constants/admin-dashboard/ManageFeesTypes";
import { sendNotification } from "../../src/services/notificationService";
import { propagateArrears } from "../../utils/financeUtils";

interface UseFeePaymentsProps {
  appUser: any;
  showToast: (props: { message: string; type: "success" | "error" | "info" }) => void;
  academicYear: string;
  term: string;
  fetchStudents: (silent?: boolean) => Promise<void>;
  canEdit: boolean;
}

export const useFeePayments = ({
  appUser,
  showToast,
  academicYear,
  term,
  fetchStudents,
  canEdit,
}: UseFeePaymentsProps) => {
  const [saving, setSaving] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [dailyModalVisible, setDailyModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentDraft | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [receivedFrom, setReceivedFrom] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Cheque" | "E-cash" | "Momo">("Cash");
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [selectedDailyDate, setSelectedDailyDate] = useState(new Date());
  const [dailyPayments, setDailyPayments] = useState<any[]>([]);
  const [loadingDaily, setLoadingDaily] = useState(false);

  const isConfigMissing = !academicYear || !term;

  const fetchDailyPayments = async (date: Date, year?: string, termStr?: string) => {
    setLoadingDaily(true);
    try {
      const dateString = moment(date).format("YYYY-MM-DD");
      let q = query(collection(db, "feePayments"), where("date", "==", dateString));

      if (year && year !== "all") {
        q = query(q, where("academicYear", "==", year));
      }
      if (termStr && termStr !== "all") {
        q = query(q, where("term", "==", termStr));
      }

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
      fetchDailyPayments(selectedDailyDate, academicYear, term);
    }
  }, [dailyModalVisible, selectedDailyDate, academicYear, term]);

  const handleLogPayment = async () => {
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
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Invalid payment amount");
      }

      const cleanYear = academicYear.replace(/\//g, "-");
      const cleanTerm = term.replace(/\s/g, "");
      const recordId = `${selectedStudent.uid}_${cleanYear}_${cleanTerm}`;
      const receiptNo = `REC-${Date.now().toString().slice(-6)}`;

      const safePaymentDate = paymentDate instanceof Date && !isNaN(paymentDate.getTime())
        ? paymentDate
        : new Date();
      const paymentDateStr = moment(safePaymentDate).format("YYYY-MM-DD");

      const batch = writeBatch(db);
      const globalPaymentRef = doc(collection(db, "feePayments"), receiptNo);

      const paymentObj = {
        amount,
        method: paymentMethod || "Cash",
        receivedFrom: (receivedFrom || "Unknown").trim(),
        updatedBy: appUser?.adminRole || "Admin",
        adminUid: appUser?.uid || "unknown",
        createdAt: new Date().toISOString(),
        receiptNo,
        date: paymentDateStr,
        academicYear,
        term,
        type: "tuition",
      };

      let remainingPayment = amount;
      const allocations: Record<string, number> = {};

      const currentTuitionDebt = Math.max(0, (Number(selectedStudent.currentBalance) || 0) -
        (Number(selectedStudent.ptaBalance) || 0) -
        (Number(selectedStudent.admissionBalance) || 0) -
        (Number(selectedStudent.maintenanceBalance) || 0) -
        (Number(selectedStudent.booksBalance) || 0) -
        (Number(selectedStudent.uniformBalance) || 0) -
        (Number(selectedStudent.otherBalance) || 0));

      const tuitionToPay = Math.min(remainingPayment, currentTuitionDebt);
      remainingPayment -= tuitionToPay;
      allocations.tuition = tuitionToPay;

      const feeRecordUpdate: any = {
        studentUid: selectedStudent.uid,
        studentName: selectedStudent.fullName || "Student",
        classId: selectedStudent.classId || "unknown",
        className: selectedStudent.className || "Class",
        academicYear,
        term,
        amountPaid: increment(tuitionToPay),
        balance: increment(-amount),
        lastUpdated: serverTimestamp(),
      };

      const userUpdate: any = {
        walletBalance: increment(-amount),
      };

      const categories = [
        { key: "admission", field: "admission" },
        { key: "pta", field: "pta" },
        { key: "maintenance", field: "maintenance" },
        { key: "books", field: "books" },
        { key: "uniform", field: "uniform" },
        { key: "other", field: "other" }
      ];

      for (const cat of categories) {
        const balanceKey = `${cat.key}Balance` as keyof StudentDraft;
        const catBalance = Number(selectedStudent[balanceKey]) || 0;
        if (remainingPayment > 0 && catBalance > 0) {
          const settlement = Math.min(remainingPayment, catBalance);
          remainingPayment -= settlement;
          allocations[cat.key] = settlement;

          feeRecordUpdate[`${cat.key}Paid`] = increment(settlement);
          feeRecordUpdate[`${cat.key}Balance`] = increment(-settlement);
          userUpdate[`${cat.key}Balance`] = increment(-settlement);
          userUpdate[`${cat.key}Paid`] = increment(settlement);
        }
      }

      const paymentObjWithAlloc = { ...paymentObj, allocations };
      feeRecordUpdate.payments = arrayUnion(paymentObjWithAlloc);

      if (!selectedStudent.hasRecordInTerm) {
        feeRecordUpdate.arrears = Number(selectedStudent.previousBalance) || 0;
        feeRecordUpdate.termBill = 0;
        feeRecordUpdate.createdAt = serverTimestamp();
      }

      batch.set(doc(db, "studentFeeRecords", recordId), feeRecordUpdate, { merge: true });
      batch.update(doc(db, "users", selectedStudent.uid), userUpdate);

      batch.set(globalPaymentRef, {
        ...paymentObjWithAlloc,
        studentUid: selectedStudent.uid,
        studentName: selectedStudent.fullName || "Student",
        classId: selectedStudent.classId || "unknown",
        className: selectedStudent.className || "Class",
      });

      await batch.commit();

      setPaymentModalVisible(false);
      setPaymentAmount("");
      setReceivedFrom("");
      setPaymentMethod("Cash");
      setPaymentDate(new Date());
      setSelectedStudent(null);

      showToast({ message: `Payment of ₵${amount.toFixed(2)} logged successfully`, type: "success" });

      setTimeout(() => {
        propagateArrears(selectedStudent.uid, academicYear, term, -amount, 'payment').catch(e => console.error("Propagation error:", e));

        if (selectedStudent.uid) {
          sendNotification({
            recipientId: selectedStudent.uid,
            senderId: appUser?.uid || "admin",
            senderName: appUser?.displayName || "Administrator",
            title: "Fee Payment Received - Thank You!",
            body: `Thank you! We've received a payment of ₵${amount.toLocaleString()} for ${selectedStudent.fullName}. We appreciate your promptness! Receipt: ${receiptNo}`,
            type: "payment",
          }).catch(e => console.error("Notification error:", e));
        }
        fetchStudents(true);
      }, 500);

    } catch (error) {
      console.error("Log Payment Error:", error);
      showToast({ message: "Failed to log payment", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePayment = async (student: StudentDraft | null, payment: any) => {
    if (!canEdit || !student) return;

    const performDelete = async () => {
      setSaving(true);
      try {
        const cleanYear = academicYear.replace(/\//g, "-");
        const cleanTerm = term.replace(/\s/g, "");
        const recordId = `${student.uid}_${cleanYear}_${cleanTerm}`;
        const batch = writeBatch(db);
        const amount = Number(payment.amount) || 0;
        const type = (payment.type || "tuition").toLowerCase();

        const isPayment = type.endsWith("_payment") || type === "tuition" || type === "tuition_credit";

        const feeRecordUpdate: any = {
          payments: arrayRemove(payment),
          lastUpdated: serverTimestamp(),
        };

        const userUpdate: any = {};

        if (isPayment) {
          feeRecordUpdate.balance = increment(amount);
          userUpdate.walletBalance = increment(amount);

          if (payment.allocations) {
            Object.entries(payment.allocations).forEach(([cat, val]) => {
              const v = Number(val);
              if (cat === "tuition") {
                feeRecordUpdate.amountPaid = increment(-v);
              } else {
                feeRecordUpdate[`${cat}Paid`] = increment(-v);
                feeRecordUpdate[`${cat}Balance`] = increment(v);
                userUpdate[`${cat}Balance`] = increment(v);
                userUpdate[`${cat}Paid`] = increment(-v);
              }
            });
          } else {
            if (type === "tuition" || type === "tuition_credit") {
              feeRecordUpdate.amountPaid = increment(-amount);
            } else if (type === "pta_payment") {
              feeRecordUpdate.ptaPaid = increment(-amount);
              feeRecordUpdate.ptaBalance = increment(amount);
              userUpdate.ptaBalance = increment(amount);
              userUpdate.ptaPaid = increment(-amount);
            } else if (type === "maintenance_payment") {
              feeRecordUpdate.maintenancePaid = increment(-amount);
              feeRecordUpdate.maintenanceBalance = increment(amount);
              userUpdate.maintenanceBalance = increment(amount);
              userUpdate.maintenancePaid = increment(-amount);
            } else if (type === "admission_payment") {
              feeRecordUpdate.admissionPaid = increment(-amount);
              feeRecordUpdate.admissionBalance = increment(amount);
              userUpdate.admissionBalance = increment(amount);
              userUpdate.admissionPaid = increment(-amount);
            } else if (type === "books_payment") {
              feeRecordUpdate.booksPaid = increment(-amount);
              feeRecordUpdate.booksBalance = increment(amount);
              userUpdate.booksBalance = increment(amount);
              userUpdate.booksPaid = increment(-amount);
            } else if (type === "uniform_payment") {
              feeRecordUpdate.uniformPaid = increment(-amount);
              feeRecordUpdate.uniformBalance = increment(amount);
              userUpdate.uniformBalance = increment(amount);
              userUpdate.uniformPaid = increment(-amount);
            } else if (type === "other_payment") {
              feeRecordUpdate.otherPaid = increment(-amount);
              feeRecordUpdate.otherBalance = increment(amount);
              userUpdate.otherBalance = increment(amount);
              userUpdate.otherPaid = increment(-amount);
            } else {
              feeRecordUpdate.amountPaid = increment(-amount);
            }
          }
        } else {
          feeRecordUpdate.balance = increment(-amount);
          userUpdate.walletBalance = increment(-amount);

          if (type === "pta") {
            feeRecordUpdate.ptaBill = increment(-amount);
            feeRecordUpdate.ptaBalance = increment(-amount);
            userUpdate.ptaBill = increment(-amount);
            userUpdate.ptaBalance = increment(-amount);
          } else if (type === "maintenance") {
            feeRecordUpdate.maintenanceBill = increment(-amount);
            feeRecordUpdate.maintenanceBalance = increment(-amount);
            userUpdate.maintenanceBill = increment(-amount);
            userUpdate.maintenanceBalance = increment(-amount);
          } else if (type === "admission") {
            feeRecordUpdate.admissionBill = increment(-amount);
            feeRecordUpdate.admissionBalance = increment(-amount);
            userUpdate.admissionFeeBill = increment(-amount);
            userUpdate.admissionBalance = increment(-amount);
          } else if (type === "books") {
            feeRecordUpdate.booksBill = increment(-amount);
            feeRecordUpdate.booksBalance = increment(-amount);
            userUpdate.booksBill = increment(-amount);
            userUpdate.booksBalance = increment(-amount);
          } else if (type === "uniform") {
            feeRecordUpdate.uniformBill = increment(-amount);
            feeRecordUpdate.uniformBalance = increment(-amount);
            userUpdate.uniformBill = increment(-amount);
            userUpdate.uniformBalance = increment(-amount);
          } else if (type === "other") {
            feeRecordUpdate.otherBill = increment(-amount);
            feeRecordUpdate.otherBalance = increment(-amount);
            userUpdate.otherBill = increment(-amount);
            userUpdate.otherBalance = increment(-amount);
          }
        }

        batch.update(doc(db, "studentFeeRecords", recordId), feeRecordUpdate);
        batch.update(doc(db, "users", student.uid), userUpdate);

        if (payment.receiptNo) {
          const q = query(
            collection(db, "feePayments"),
            where("receiptNo", "==", payment.receiptNo),
            where("studentUid", "==", student?.uid)
          );
          const snap = await getDocsFromServer(q);
          snap.forEach((d) => {
            batch.delete(d.ref);
          });
        }

        await batch.commit();
        fetchStudents(true);
        showToast({ message: isPayment ? "Payment reversed." : "Charge removed.", type: "success" });

        const propagationAmount = isPayment ? amount : -amount;
        const propType = isPayment ? 'payment' : 'bill';

        let category: string | undefined = undefined;
        if (type === "pta_payment" || type === "pta") category = "pta";
        else if (type === "maintenance_payment" || type === "maintenance") category = "maintenance";
        else if (type === "admission_payment" || type === "admission") category = "admission";
        else if (type === "books_payment" || type === "books") category = "books";
        else if (type === "uniform_payment" || type === "uniform") category = "uniform";
        else if (type === "other_payment" || type === "other") category = "other";

        propagateArrears(student.uid, academicYear, term, propagationAmount, propType, category).catch(console.error);
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

  return {
    saving,
    paymentModalVisible,
    setPaymentModalVisible,
    dailyModalVisible,
    setDailyModalVisible,
    selectedStudent,
    setSelectedStudent,
    paymentAmount,
    setPaymentAmount,
    receivedFrom,
    setReceivedFrom,
    paymentMethod,
    setPaymentMethod,
    paymentDate,
    setPaymentDate,
    selectedDailyDate,
    setSelectedDailyDate,
    dailyPayments,
    loadingDaily,
    handleLogPayment,
    handleDeletePayment,
  };
};
