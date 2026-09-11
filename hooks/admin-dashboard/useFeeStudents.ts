import { useCallback, useEffect, useRef, useState } from "react";
import { collection, getDocs, limit, query, startAfter, where, onSnapshot } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "../../firebaseConfig";
import { StudentDraft, FILTERS_PERSISTENCE_KEY, PAGE_SIZE } from "../../constants/admin-dashboard/ManageFeesTypes";

export const useFeeStudents = (
  selectedClassId: string,
  academicYear: string,
  term: string,
  classes: any[],
  showArchived: boolean,
) => {
  const [students, setStudents] = useState<StudentDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const lastVisibleRef = useRef<any>(null);
  const hasMoreRef = useRef(true);
  const isFetchingRef = useRef(false);
  const requestIdRef = useRef(0);

  const fetchStudents = useCallback(
    async (isFirstLoad = false) => {
      if (!selectedClassId) {
        setLoading(false);
        setRefreshing(false);
        setFetchingMore(false);
        return;
      }

      if (!isFirstLoad && isFetchingRef.current) return;
      if (!isFirstLoad && !hasMoreRef.current) return;

      const myRequestId = ++requestIdRef.current;
      isFetchingRef.current = true;

      if (isFirstLoad) {
        setLoading(true);
        lastVisibleRef.current = null;
        hasMoreRef.current = true;
      } else {
        setFetchingMore(true);
      }

      try {
        const statusList = ["active", "pending_activation"];
        if (showArchived) statusList.push("archived");

        let baseQuery = query(
          collection(db, "users"),
          where("role", "==", "student"),
          where("status", "in", statusList),
        );

        if (selectedClassId !== "all") {
          baseQuery = query(baseQuery, where("classId", "==", selectedClassId));
        }

        let q = query(baseQuery, limit(PAGE_SIZE));
        if (!isFirstLoad && lastVisibleRef.current)
          q = query(q, startAfter(lastVisibleRef.current));

        // Use getDocs for intelligent caching
        const snap = await getDocs(q as any);

        if (!snap || myRequestId !== requestIdRef.current) return;

        if (snap.empty) {
          hasMoreRef.current = false;
          if (isFirstLoad) setStudents([]);
          return;
        }

        const studentDocs = snap.docs;
        const studentIds = studentDocs.map((d) => d.id);

        // Step 1: Create initial batch with basic user info
        let initialBatch: StudentDraft[] = studentDocs.map((d) => {
          const userData = d.data() as any;
          return {
            uid: d.id,
            studentID: userData.profile?.studentID || "",
            fullName:
              `${userData.profile?.firstName || ""} ${userData.profile?.lastName || ""}`.trim() ||
              "Student",
            classId: userData.classId || "unknown",
            className:
              classes.find((c) => c.id === userData.classId)?.name || "Class",
            previousBalance: userData.walletBalance || 0,
            amountPaid: 0,
            currentBalance: userData.walletBalance || 0,
            hasRecordInTerm: false,
            payments: [],
            termBill: 0,
            editCount: 0,
            onDiscount: userData.onDiscount,
            discountAmount: userData.discountAmount,
            onScholarship: userData.onScholarship,
            ptaBalance: userData.ptaBalance ?? 0,
            admissionBalance: userData.admissionBalance ?? 0,
            maintenanceBalance: userData.maintenanceBalance ?? 0,
            booksBalance: userData.booksBalance ?? 0,
            uniformBalance: userData.uniformBalance ?? 0,
            otherBalance: userData.otherBalance ?? 0,
          };
        });

        initialBatch.sort((a, b) => a.fullName.localeCompare(b.fullName));
        lastVisibleRef.current = snap.docs[snap.docs.length - 1];
        hasMoreRef.current = snap.docs.length === PAGE_SIZE;

        // Show students immediately
        setStudents((prev) => (isFirstLoad ? initialBatch : [...prev, ...initialBatch]));

        if (isFirstLoad) {
          setLoading(false);
        } else {
          setFetchingMore(false);
        }

        // Step 2: Fetch Fee Records in background
        if (studentIds.length > 0 && academicYear && term) {
          const chunks = [];
          for (let i = 0; i < studentIds.length; i += 10)
            chunks.push(studentIds.slice(i, i + 10));

          const validChunks = chunks.filter((c) => c.length > 0);
          Promise.all(
            validChunks.map(async (chunk) => {
              const qFees = query(
                collection(db, "studentFeeRecords"),
                where("studentUid", "in", chunk),
                where("academicYear", "==", academicYear),
                where("term", "==", term),
              );
              try {
                return await getDocs(qFees as any);
              } catch (error) {
                console.warn("Fees fetch failed:", error);
                throw error;
              }
            }),
          ).then((feesSnaps) => {
            if (myRequestId !== requestIdRef.current) return;

            const feesMap = new Map();
            feesSnaps.forEach((fsnap) =>
              fsnap.docs.forEach((d) =>
                feesMap.set((d.data() as any).studentUid, d.data()),
              ),
            );

            // Update state with enriched fee data
            setStudents((prev) =>
              prev.map((s) => {
                const feeData = feesMap.get(s.uid) as any;
                if (!feeData) return s;

                const walletBalance = s.currentBalance;
                const termImpact =
                  (feeData.termBill || 0) +
                  (feeData.ptaBill || 0) +
                  (feeData.maintenanceBill || 0) +
                  (feeData.admissionBill || 0) +
                  (feeData.booksBill || 0) +
                  (feeData.uniformBill || 0) +
                  (feeData.otherBill || 0) -
                  (feeData.amountPaid || 0) -
                  (feeData.ptaPaid || 0) -
                  (feeData.maintenancePaid || 0) -
                  (feeData.admissionPaid || 0) -
                  (feeData.booksPaid || 0) -
                  (feeData.uniformPaid || 0) -
                  (feeData.otherPaid || 0) -
                  (feeData.discount || 0);

                return {
                  ...s,
                  previousBalance: walletBalance - termImpact,
                  amountPaid: feeData.amountPaid || 0,
                  hasRecordInTerm: true,
                  payments: feeData.payments || [],
                  termBill: feeData.termBill || 0,
                  ptaBill: feeData.ptaBill || 0,
                  maintenanceBill: feeData.maintenanceBill || 0,
                  admissionBill: feeData.admissionBill || 0,
                  booksBill: feeData.booksBill || 0,
                  uniformBill: feeData.uniformBill || 0,
                  otherBill: feeData.otherBill || 0,
                  discount: feeData.discount || 0,
                  ptaPaid: feeData.ptaPaid || 0,
                  maintenancePaid: feeData.maintenancePaid || 0,
                  admissionPaid: feeData.admissionPaid || 0,
                  booksPaid: feeData.booksPaid || 0,
                  uniformPaid: feeData.uniformPaid || 0,
                  otherPaid: feeData.otherPaid || 0,
                  totalPayable: feeData.totalPayable || walletBalance,
                  editCount: feeData.editCount || 0,
                };
              }),
            );
          });
        }

        AsyncStorage.setItem(
          FILTERS_PERSISTENCE_KEY,
          JSON.stringify({ classId: selectedClassId }),
        );
      } catch (e) {
        if (myRequestId === requestIdRef.current) {
          console.error("Fetch students error:", e);
        }
      } finally {
        if (myRequestId === requestIdRef.current) {
          isFetchingRef.current = false;
          // Note: setLoading(false) moved up to Step 1 for "Quick Load"
        }
      }
    },
    [selectedClassId, academicYear, term, classes, showArchived],
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStudents(true);
  }, [fetchStudents]);

  useEffect(() => {
    if (selectedClassId) {
      fetchStudents(true);
    }
  }, [selectedClassId, academicYear, term, showArchived]);

  // Real-time listener for users in the current batch to ensure walletBalance and statuses are always fresh
  useEffect(() => {
    if (students.length === 0) return;

    const studentIds = students.map(s => s.uid);
    const chunks = [];
    for (let i = 0; i < studentIds.length; i += 10) {
      chunks.push(studentIds.slice(i, i + 10));
    }

    const unsubs = chunks.map(chunk => {
      const q = query(collection(db, "users"), where("__name__", "in", chunk));
      return onSnapshot(q, (snap) => {
        setStudents(prev => {
          let updated = false;
          const next = prev.map(s => {
            const doc = snap.docs.find(d => d.id === s.uid);
            if (doc) {
              const userData = doc.data();
              if (s.currentBalance !== userData.walletBalance) {
                updated = true;
                // Re-calculate arrears based on new walletBalance
                const termImpact =
                  (s.termBill || 0) +
                  (s.ptaBill || 0) +
                  (s.maintenanceBill || 0) +
                  (s.admissionBill || 0) +
                  (s.booksBill || 0) +
                  (s.uniformBill || 0) +
                  (s.otherBill || 0) -
                  (s.amountPaid || 0) -
                  (s.ptaPaid || 0) -
                  (s.maintenancePaid || 0) -
                  (s.admissionPaid || 0) -
                  (s.booksPaid || 0) -
                  (s.uniformPaid || 0) -
                  (s.otherPaid || 0) -
                  (s.discount || 0);
                return {
                  ...s,
                  currentBalance: userData.walletBalance || 0,
                  previousBalance: (userData.walletBalance || 0) - termImpact,
                  ptaBalance: userData.ptaBalance || 0,
                  admissionBalance: userData.admissionBalance || 0,
                  maintenanceBalance: userData.maintenanceBalance || 0,
                  booksBalance: userData.booksBalance || 0,
                  uniformBalance: userData.uniformBalance || 0,
                  otherBalance: userData.otherBalance || 0,
                };
              }
            }
            return s;
          });
          return updated ? next : prev;
        });
      });
    });

    return () => unsubs.forEach(unsub => unsub());
  }, [students.map(s => s.uid).join(',')]);

  return {
    students,
    loading,
    fetchingMore,
    refreshing,
    fetchStudents,
    handleRefresh,
  };
};
