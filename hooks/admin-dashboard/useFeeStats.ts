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
        // Exclude if student is on scholarship or not in the currently filtered student list
        if (!user || user.onScholarship) return;

        processedUids.add(data.studentUid);

        // Tuition/General + Other categories
        const studentGross =
          (data.termBill || 0) +
          (data.arrears || 0) +
          (data.ptaBill || 0) +
          (data.maintenanceBill || 0) +
          (data.admissionBill || 0) +
          (data.booksBill || 0) +
          (data.uniformBill || 0) +
          (data.otherBill || 0);

        const studentDiscount = data.discount || 0;

        // Net Expected = Gross - Discount
        expected += studentGross - studentDiscount;

        received +=
          (data.amountPaid || 0) +
          (data.ptaPaid || 0) +
          (data.maintenancePaid || 0) +
          (data.admissionPaid || 0) +
          (data.booksPaid || 0) +
          (data.uniformPaid || 0) +
          (data.otherPaid || 0);

        totalDiscount += studentDiscount;
      });

      // Include students who don't have a record for this specific term yet
      users.forEach((user) => {
        if (!processedUids.has(user.id) && !user.onScholarship) {
          // For students without a term record, their expected amount is their current wallet balance (arrears)
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
