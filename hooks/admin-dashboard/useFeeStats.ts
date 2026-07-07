import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../firebaseConfig";

/**
 * Hook to fetch fee statistics.
 * Optimized to use Firestore query-level filtering by classId when applicable.
 */
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

    // Start with a base query for the specific term/year
    let q = query(
      collection(db, "studentFeeRecords"),
      where("academicYear", "==", academicYear),
      where("term", "==", term),
    );

    // Optimization: Filter by class at the database level if a specific class is selected.
    // This significantly reduces data transfer and client-side processing.
    if (selectedClassId !== "all") {
      q = query(q, where("classId", "==", selectedClassId));
    }

    const unsub = onSnapshot(
      q,
      (snap) => {
        let expected = 0;
        let received = 0;
        let totalDiscount = 0;

        snap.docs.forEach((d) => {
          const data = d.data() as any;

          // Tuition/General
          expected += (data.termBill || 0) + (data.arrears || 0);
          received += data.amountPaid || 0;
          totalDiscount += data.discount || 0;

          // Other categories
          expected += (data.ptaBill || 0) + (data.maintenanceBill || 0) +
                      (data.admissionBill || 0) + (data.booksBill || 0) +
                      (data.uniformBill || 0) + (data.otherBill || 0);

          received += (data.ptaPaid || 0) + (data.maintenancePaid || 0) +
                      (data.admissionPaid || 0) + (data.booksPaid || 0) +
                      (data.uniformPaid || 0) + (data.otherPaid || 0);
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
