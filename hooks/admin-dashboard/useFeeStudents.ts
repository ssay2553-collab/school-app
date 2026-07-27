import { useCallback, useEffect, useRef, useState } from "react";
import { collection, getDocsFromCache, getDocsFromServer, limit, query, startAfter, where } from "firebase/firestore";
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

        // Use getDocsFromServer to bypass stale local cache and get fresh data
        let snap;
        try {
          snap = await getDocsFromServer(q as any);
        } catch (error) {
          console.warn("Failed to fetch from server, falling back to cache:", error);
          snap = await getDocsFromCache(q as any);
        }

        if (myRequestId !== requestIdRef.current) return;

        if (snap.empty) {
          hasMoreRef.current = false;
          if (isFirstLoad) setStudents([]);
          return;
        }

        const studentDocs = snap.docs;
        const studentIds = studentDocs.map((d) => d.id);

        let feesMap = new Map();
        if (studentIds.length > 0 && academicYear && term) {
          const chunks = [];
          for (let i = 0; i < studentIds.length; i += 10)
            chunks.push(studentIds.slice(i, i + 10));

          const validChunks = chunks.filter((c) => c.length > 0);
          const feesSnaps = await Promise.all(
            validChunks.map(async (chunk) => {
              const qFees = query(
                collection(db, "studentFeeRecords"),
                where("studentUid", "in", chunk),
                where("academicYear", "==", academicYear),
                where("term", "==", term),
              );
              try {
                return await getDocsFromServer(qFees as any);
              } catch (error) {
                console.warn("Fees fetch from server failed, falling back to cache:", error);
                return await getDocsFromCache(qFees as any);
              }
            }),
          );

          if (myRequestId !== requestIdRef.current) return;

          feesSnaps.forEach((fsnap) =>
            fsnap.docs.forEach((d) =>
              feesMap.set((d.data() as any).studentUid, d.data()),
            ),
          );
        }

        let batch: StudentDraft[] = studentDocs.map((d) => {
          const feeData = feesMap.get(d.id) as any;
          const userData = d.data() as any;
          const currentBalance = userData.walletBalance || 0;

          return {
            uid: d.id,
            studentID: userData.profile?.studentID || "",
            fullName:
              `${userData.profile?.firstName || ""} ${userData.profile?.lastName || ""}`.trim() ||
              "Student",
            classId: userData.classId || "unknown",
            className:
              classes.find((c) => c.id === userData.classId)?.name || "Class",
            // Arrears now represents accumulated tuition debt from previous terms
            previousBalance: feeData ? (feeData.arrears || 0) : (userData.walletBalance || 0),
            // Global total paid (tuition)
            amountPaid: feeData ? (feeData.amountPaid || 0) : 0,
            // The record balance is now the definitive running total (Total Bills - Total Payments)
            currentBalance: feeData ? (feeData.balance || 0) : (userData.walletBalance || 0),
            hasRecordInTerm: !!feeData,
            payments: feeData?.payments || [],
            termBill: feeData?.termBill || 0,
            ptaBill: feeData?.ptaBill || 0,
            maintenanceBill: feeData?.maintenanceBill || 0,
            admissionBill: feeData?.admissionBill || 0,
            booksBill: feeData?.booksBill || 0,
            uniformBill: feeData?.uniformBill || 0,
            otherBill: feeData?.otherBill || 0,
            discount: feeData?.discount || 0,
            // Category paid and balance fields are now also running totals
            ptaPaid: feeData?.ptaPaid || 0,
            maintenancePaid: feeData?.maintenancePaid || 0,
            admissionPaid: feeData?.admissionPaid || 0,
            booksPaid: feeData?.booksPaid || 0,
            uniformPaid: feeData?.uniformPaid || 0,
            otherPaid: feeData?.otherPaid || 0,
            totalPayable: feeData?.totalPayable || 0,
            editCount: feeData?.editCount || 0,
            onDiscount: userData.onDiscount,
            discountAmount: userData.discountAmount,
            onScholarship: userData.onScholarship,
            // Wallet-level category fields
            ptaBalance: userData.ptaBalance || 0,
            admissionBalance: userData.admissionBalance || 0,
            maintenanceBalance: userData.maintenanceBalance || 0,
            booksBalance: userData.booksBalance || 0,
            uniformBalance: userData.uniformBalance || 0,
            otherBalance: userData.otherBalance || 0,
          };
        });

        batch.sort((a, b) => a.fullName.localeCompare(b.fullName));

        lastVisibleRef.current = snap.docs[snap.docs.length - 1];
        hasMoreRef.current = snap.docs.length === PAGE_SIZE;

        setStudents((prev) => (isFirstLoad ? batch : [...prev, ...batch]));

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
          setLoading(false);
          setFetchingMore(false);
          setRefreshing(false);
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

  return {
    students,
    loading,
    fetchingMore,
    refreshing,
    fetchStudents,
    handleRefresh,
  };
};
