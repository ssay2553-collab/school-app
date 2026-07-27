import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../firebaseConfig";

/**
 * Hook to fetch fee statistics.
 * Optimized to use Firestore query-level filtering by classId when applicable.
 */
export const useFeeStats = (
  academicYear: string,
  term: string,
  selectedClassId: string,
  showArchived: boolean = false,
) => {
  const [stats, setStats] = useState({
    expected: 0,
    received: 0,
    balance: 0,
    totalDiscount: 0,
  });
  const [totalDiscountCommitted, setTotalDiscountCommitted] = useState(0);

  useEffect(() => {
    if (!academicYear || !term) return;

    // Query for student records in the specific term
    let qRecords = query(
      collection(db, "studentFeeRecords"),
      where("academicYear", "==", academicYear),
      where("term", "==", term),
    );
    if (selectedClassId !== "all") {
      qRecords = query(qRecords, where("classId", "==", selectedClassId));
    }

    // Query for students to ensure we count those without records this term
    const statusList = ["active", "pending_activation"];
    if (showArchived) statusList.push("archived");

    let qUsers = query(
      collection(db, "users"),
      where("role", "==", "student"),
      where("status", "in", statusList),
    );
    if (selectedClassId !== "all") {
      qUsers = query(qUsers, where("classId", "==", selectedClassId));
    }

    let records: any[] = [];
    let users: any[] = [];

    const calculate = () => {
      let expected = 0;
      let received = 0;
      let totalDiscount = 0;

      const userMap = new Map();
      users.forEach((u) => userMap.set(u.id, u));

      const processedUids = new Set();

      records.forEach((data) => {
        const user = userMap.get(data.studentUid);
        if (!user || user.onScholarship) return;
        processedUids.add(data.studentUid);

        // In the cumulative model:
        // 'totalPayable' is (Arrears + Term Bill + Other Bills)
        // 'balance' is (totalPayable - Total Payments - Discounts)
        // We want the Dashboard to reflect:
        // Expected = Total Payable
        // Received = amountPaid + other category payments
        // Discount = data.discount
        // Balance = data.balance

        const studentExpected = data.totalPayable || 0;
        const studentDiscount = data.discount || 0;

        expected += studentExpected - studentDiscount;
        received += (data.totalPayable || 0) - (data.balance || 0) - (data.discount || 0);
        totalDiscount += studentDiscount;
      });

      // Include students who don't have a record for this specific term yet
      users.forEach((user) => {
        if (!processedUids.has(user.id) && !user.onScholarship) {
          // If no record, we use the wallet balance as the primary indicator
          expected += user.walletBalance || 0;
        }
      });

      setStats({
        expected,
        received,
        balance: expected - received,
        totalDiscount,
      });
      setTotalDiscountCommitted(totalDiscount);
    };

    const unsubRecords = onSnapshot(
      qRecords,
      (snap) => {
        records = snap.docs.map((d) => d.data());
        calculate();
      },
      (err) => console.error("Records stats error:", err),
    );

    const unsubUsers = onSnapshot(
      qUsers,
      (snap) => {
        users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        calculate();
      },
      (err) => console.error("Users stats error:", err),
    );

    return () => {
      unsubRecords();
      unsubUsers();
    };
  }, [academicYear, term, selectedClassId, showArchived]);

  return { stats, totalDiscountCommitted };
};
