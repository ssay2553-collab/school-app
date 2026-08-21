import { useState } from "react";
import {
  doc,
  writeBatch,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { Alert } from "react-native";
import { db } from "../../firebaseConfig";
import { StudentDraft } from "../../constants/admin-dashboard/ManageFeesTypes";
import { propagateArrears } from "../../utils/financeUtils";

interface UseFeeDiscountsProps {
  students: StudentDraft[];
  academicYear: string;
  term: string;
  fetchStudents: (silent?: boolean) => Promise<void>;
  showToast: (props: { message: string; type: "success" | "error" | "info" }) => void;
  canEdit: boolean;
  isSuperAdmin: boolean;
}

export const useFeeDiscounts = ({
  students,
  academicYear,
  term,
  fetchStudents,
  showToast,
  canEdit,
  isSuperAdmin,
}: UseFeeDiscountsProps) => {
  const [saving, setSaving] = useState(false);
  const [discountModalVisible, setDiscountModalVisible] = useState(false);
  const [discountAmount, setDiscountAmount] = useState("");
  const [individualDiscountOverrides, setIndividualDiscountOverrides] = useState<Record<string, string>>({});

  const saveDiscounts = async (selectedStudentUids: Set<string>) => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const selectedUids = Array.from(selectedStudentUids);
      const cleanYear = academicYear.replace(/\//g, "-");
      const cleanTerm = term.replace(/\s/g, "");

      const CHUNK_SIZE = 200;
      for (let i = 0; i < selectedUids.length; i += CHUNK_SIZE) {
        const chunk = selectedUids.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);

        for (const uid of chunk) {
          const s = students.find((stud) => stud.uid === uid);
          if (!s) continue;
          const discStr = individualDiscountOverrides[uid] || discountAmount;
          const disc = parseFloat(discStr);
          if (isNaN(disc) || disc === 0) continue;

          const recordId = `${uid}_${cleanYear}_${cleanTerm}`;

          const profileDiscount = (!s.hasRecordInTerm && s.onDiscount && s.discountAmount) ? s.discountAmount : 0;
          const totalDiscountToApply = disc + profileDiscount;

          if (!s.hasRecordInTerm) {
            batch.set(doc(db, "studentFeeRecords", recordId), {
              studentUid: uid,
              studentName: s.fullName,
              classId: s.classId,
              className: s.className,
              academicYear,
              term,
              termBill: 0,
              arrears: s.previousBalance || 0,
              discount: totalDiscountToApply,
              amountPaid: 0,
              balance: (s.previousBalance || 0) - totalDiscountToApply,
              totalPayable: s.previousBalance || 0,
              editCount: 1,
              createdAt: serverTimestamp(),
              lastUpdated: serverTimestamp(),
              payments: [],
            });
          } else {
            batch.update(doc(db, "studentFeeRecords", recordId), {
              discount: increment(disc),
              balance: increment(-disc),
              lastUpdated: serverTimestamp(),
            });
          }
          batch.update(doc(db, "users", uid), { walletBalance: increment(-totalDiscountToApply) });
        }
        await batch.commit();
      }

      setDiscountModalVisible(false);
      setIndividualDiscountOverrides({});
      fetchStudents(true);

      selectedUids.forEach(uid => {
        const s = students.find(stud => stud.uid === uid);
        if (s) {
          const disc = parseFloat(individualDiscountOverrides[uid] || discountAmount);
          if (!isNaN(disc) && Math.abs(disc) > 0.01) {
            propagateArrears(uid, academicYear, term, -disc, 'payment').catch(console.error);
          }
        }
      });

      showToast({ message: "Discounts applied.", type: "success" });
    } catch (e) {
      console.error(e);
      showToast({ message: "Failed to apply discounts", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleNormalizeDiscounts = async () => {
    if (!isSuperAdmin) return;
    const targets = students.filter((s) => !s.onDiscount && (s.discount || 0) > 0 && s.hasRecordInTerm);
    if (targets.length === 0) {
      showToast({ message: "No inconsistent records found.", type: "info" });
      return;
    }

    Alert.alert("Fix Inconsistencies?", `Found ${targets.length} students with discounts despite having "Discount Profile" disabled. Remove these manual discounts and reverse balances?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Fix All",
        onPress: async () => {
          setSaving(true);
          try {
            const cleanYear = academicYear.replace(/\//g, "-");
            const cleanTerm = term.replace(/\s/g, "");

            const CHUNK_SIZE = 200;
            for (let i = 0; i < targets.length; i += CHUNK_SIZE) {
              const chunk = targets.slice(i, i + CHUNK_SIZE);
              const batch = writeBatch(db);
              for (const s of chunk) {
                const disc = s.discount || 0;
                const recordId = `${s.uid}_${cleanYear}_${cleanTerm}`;
                batch.update(doc(db, "studentFeeRecords", recordId), { discount: 0, balance: increment(disc) });
                batch.update(doc(db, "users", s.uid), { walletBalance: increment(disc) });
              }
              await batch.commit();
            }

            fetchStudents(true);
            showToast({ message: "Records normalized.", type: "success" });
          } catch (e) {
            console.error(e);
            showToast({ message: "Fix failed", type: "error" });
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  return {
    saving,
    discountModalVisible,
    setDiscountModalVisible,
    discountAmount,
    setDiscountAmount,
    individualDiscountOverrides,
    setIndividualDiscountOverrides,
    saveDiscounts,
    handleNormalizeDiscounts,
  };
};
