import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../firebaseConfig";

export const useFeeStats = (academicYear: string, term: string, selectedClassId: string) => {
  const [stats, setStats] = useState({
    expected: 0,
    received: 0,
    balance: 0,
    totalDiscount: 0,
  });
  const [totalDiscountCommitted, setTotalDiscountCommitted] = useState(0);

  useEffect(() => {
    if (!academicYear || !term) return;

    const q = query(
      collection(db, "studentFeeRecords"),
      where("academicYear", "==", academicYear),
      where("term", "==", term),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        let expected = 0;
        let received = 0;
        let totalDiscount = 0;

        snap.docs.forEach((d) => {
          const data = d.data() as any;
          if (selectedClassId === "all" || data.classId === selectedClassId) {
            // Tuition
            expected += (data.termBill || 0) + (data.arrears || 0);
            received += data.amountPaid || 0;
            totalDiscount += data.discount || 0;

            // PTA
            expected += data.ptaBill || 0;
            received += data.ptaPaid || 0;

            // Maintenance
            expected += data.maintenanceBill || 0;
            received += data.maintenancePaid || 0;

            // Admission
            expected += data.admissionBill || 0;
            received += data.admissionPaid || 0;

            // Books
            expected += data.booksBill || 0;
            received += data.booksPaid || 0;

            // Uniform
            expected += data.uniformBill || 0;
            received += data.uniformPaid || 0;

            // Other
            expected += data.otherBill || 0;
            received += data.otherPaid || 0;
          }
        });
        setStats({
          expected,
          received,
          balance: expected - totalDiscount - received,
          totalDiscount,
        });
        setTotalDiscountCommitted(totalDiscount);
      },
      (err) => console.error("Stats listener error:", err),
    );

    return () => unsub();
  }, [academicYear, term, selectedClassId]);

  return { stats, totalDiscountCommitted };
};
