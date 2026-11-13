import { useEffect, useState, useRef } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { calculateFeeBreakdown } from "./finance-cleanup/utils";

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
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

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
      let totalExpected = 0;
      let totalReceived = 0;
      let totalDiscount = 0;

      const userMap = new Map();
      users.forEach((u) => userMap.set(u.id, u));

      const processedUids = new Set();

      records.forEach((data) => {
        const user = userMap.get(data.studentUid);
        if (!user) return;
        processedUids.add(data.studentUid);

        const breakdown = calculateFeeBreakdown(data, data.payments || []);

        totalExpected += breakdown.totals.billed;
        totalReceived += breakdown.totals.paid;
        totalDiscount += breakdown.totals.discount;
      });

      // Include students who don't have a record for this specific term yet
      users.forEach((user) => {
        if (!processedUids.has(user.id)) {
          // For students without a term record, walletBalance represents their starting arrears (Gross)
          totalExpected += user.walletBalance || 0;
        }
      });

      if (isMounted.current) {
        setStats({
          expected: totalExpected,
          received: totalReceived,
          totalDiscount,
          balance: totalExpected - totalDiscount - totalReceived,
        });
        setTotalDiscountCommitted(totalDiscount);
      }
    };

    const unsubRecords = onSnapshot(
      qRecords,
      (snap) => {
        if (!isMounted.current) return;
        records = snap.docs.map((d) => d.data());
        calculate();
      },
      (err) => {
        if (isMounted.current) console.error("Records stats error:", err);
      },
    );

    const unsubUsers = onSnapshot(
      qUsers,
      (snap) => {
        if (!isMounted.current) return;
        users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        calculate();
      },
      (err) => {
        if (isMounted.current) console.error("Users stats error:", err);
      },
    );

    return () => {
      unsubRecords();
      unsubUsers();
    };
  }, [academicYear, term, selectedClassId, showArchived]);

  return { stats, totalDiscountCommitted };
};
