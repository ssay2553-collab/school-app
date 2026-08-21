import { useState, useRef } from "react";
import {
  doc,
  writeBatch,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { StudentDraft } from "../../constants/admin-dashboard/ManageFeesTypes";
import { propagateArrears } from "../../utils/financeUtils";

interface UseFeeBillingProps {
  students: StudentDraft[];
  academicYear: string;
  term: string;
  fetchStudents: (silent?: boolean) => Promise<void>;
  showToast: (props: { message: string; type: "success" | "error" | "info" }) => void;
  canEdit: boolean;
}

export const useFeeBilling = ({
  students,
  academicYear,
  term,
  fetchStudents,
  showToast,
  canEdit,
}: UseFeeBillingProps) => {
  const [saving, setSaving] = useState(false);
  const [billModalVisible, setBillModalVisible] = useState(false);
  const [termBillAmount, setTermBillAmount] = useState("");
  const [individualBillOverrides, setIndividualBillOverridesState] = useState<Record<string, string>>({});
  const individualBillOverridesRef = useRef<Record<string, string>>({});

  const setIndividualBillOverrides = (update: any) => {
    setIndividualBillOverridesState((prev) => {
      const next = typeof update === "function" ? update(prev) : update;
      individualBillOverridesRef.current = next;
      return next;
    });
  };

  const saveFees = async (selectedStudentUids: Set<string>) => {
    if (!canEdit) {
      showToast({ message: "Access Denied: You don't have permission to modify billing.", type: "error" });
      return;
    }
    const isConfigMissing = !academicYear || !term;
    if (isConfigMissing) {
      showToast({ message: "Action blocked: Academic year and term must be configured before billing.", type: "error" });
      return;
    }
    setSaving(true);
    try {
      const selectedUids = Array.from(selectedStudentUids);
      const latestOverrides = individualBillOverridesRef.current;
      const cleanYear = academicYear.replace(/\//g, "-");
      const cleanTerm = term.replace(/\s/g, "");

      const CHUNK_SIZE = 200;
      for (let i = 0; i < selectedUids.length; i += CHUNK_SIZE) {
        const chunk = selectedUids.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);

        for (const uid of chunk) {
          const s = students.find((stud) => stud.uid === uid);
          if (!s || s.onScholarship) continue;

          const adjustmentStr = latestOverrides[uid] || termBillAmount;
          const adjustment = parseFloat(adjustmentStr);
          if (isNaN(adjustment) || adjustment === 0) continue;

          const recordId = `${uid}_${cleanYear}_${cleanTerm}`;
          let discount = s.discount || 0;
          if (s.onDiscount && s.discountAmount && !s.hasRecordInTerm) {
            discount = s.discountAmount;
          }

          const currentBill = s.hasRecordInTerm ? s.termBill || 0 : 0;
          const newBill = currentBill + adjustment;

          const profileDiscount = (!s.hasRecordInTerm && s.onDiscount && s.discountAmount) ? s.discountAmount : 0;
          const newBalance = (s.currentBalance || 0) + adjustment - profileDiscount;
          const totalPayable = (s.hasRecordInTerm ? (s.totalPayable || 0) : (s.previousBalance || 0)) + adjustment;

          if (isNaN(newBalance)) continue;

          const feeRecordData: any = {
            studentUid: uid,
            studentName: s.fullName,
            classId: s.classId,
            className: s.className,
            academicYear,
            term,
            termBill: newBill,
            arrears: s.previousBalance || 0,
            discount: (s.discount || 0) + profileDiscount,
            amountPaid: s.amountPaid || 0,
            balance: newBalance,
            totalPayable: totalPayable,
            editCount: (s.editCount || 0) + 1,
            lastUpdated: serverTimestamp(),
            ptaPaid: s.ptaPaid || 0,
            ptaBalance: s.ptaBalance || 0,
            ptaBill: s.ptaBill || 0,
            maintenancePaid: s.maintenancePaid || 0,
            maintenanceBalance: s.maintenanceBalance || 0,
            maintenanceBill: s.maintenanceBill || 0,
            admissionPaid: s.admissionPaid || 0,
            admissionBalance: s.admissionBalance || 0,
            admissionBill: s.admissionBill || 0,
            booksPaid: s.booksPaid || 0,
            booksBalance: s.booksBalance || 0,
            booksBill: s.booksBill || 0,
            uniformPaid: s.uniformPaid || 0,
            uniformBalance: s.uniformBalance || 0,
            uniformBill: s.uniformBill || 0,
            otherPaid: s.otherPaid || 0,
            otherBalance: s.otherBalance || 0,
            otherBill: s.otherBill || 0,
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
      }

      setBillModalVisible(false);
      setIndividualBillOverrides({});
      fetchStudents(true);

      selectedUids.forEach(uid => {
        const s = students.find(stud => stud.uid === uid);
        if (s) {
          const adj = parseFloat(latestOverrides[uid] || termBillAmount);
          if (!isNaN(adj) && Math.abs(adj) > 0.01) {
            propagateArrears(uid, academicYear, term, adj, 'bill').catch(console.error);
          }
        }
      });

      showToast({ message: "Billing updated successfully.", type: "success" });
    } catch (e) {
      console.error("Save Fees Error:", e);
      showToast({ message: "Save failed", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return {
    saving,
    billModalVisible,
    setBillModalVisible,
    termBillAmount,
    setTermBillAmount,
    individualBillOverrides,
    setIndividualBillOverrides,
    saveFees,
  };
};
