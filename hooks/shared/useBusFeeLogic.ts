import {
    collection,
    doc,
    getDoc,
    getDocsFromServer,
    increment,
    onSnapshot,
    query,
    serverTimestamp,
    setDoc,
    Timestamp,
    where,
    writeBatch,
} from "firebase/firestore";
import moment from "moment";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { db } from "../../firebaseConfig";
import {
    getTeacherClasses,
    sortClasses
} from "../../lib/classHelpers";
import { useAcademicConfig } from "../useAcademicConfig";
import { useSchoolOperations } from "../useSchoolOperations";

export type DailyRecord = {
  id: string;
  studentUid: string;
  studentName: string;
  classId: string;
  className: string;
  date: string;
  busFee: number;
  feedingFee: number;
  extraClassesFee: number;
  otherFees: number;
  otherFeesDescription: string;
  total: number;
  recordedBy: string;
  recordedByUid: string;
  createdAt: Timestamp;
  feedingPaid?: boolean;
  busPaid?: boolean;
  busPaidAmount?: number;
  extraPaid?: boolean;
};

export type StudentRecord = {
  uid: string;
  fullName: string;
  classId: string;
  className: string;
  takesBus: boolean;
  busLocation?: string;
  dailyArrears?: number;
  termArrears?: Record<string, number>;
};

export type TabType = "record" | "history" | "reports";

export const useBusFeeLogic = () => {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const acadConfig = useAcademicConfig();
  const { getOperationalStatus } = useSchoolOperations();

  const currentUserRole = appUser?.adminRole?.toLowerCase() || "";
  const isSuperAdmin = [
    "proprietor",
    "proprietress",
    "manager",
    "headmaster",
    "headmistress",
    "administrator",
    "director",
    "accountant",
    "bursar",
    "admin",
    "super admin",
    "superadmin",
  ].includes(currentUserRole);

  const busPermission = appUser?.permissions?.["record-bus-fee"] || "deny";

  const canView =
    isSuperAdmin ||
    busPermission === "full" ||
    busPermission === "view" ||
    busPermission === "edit";

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("record");

  const canEdit =
    (isSuperAdmin || busPermission === "full" || busPermission === "edit") &&
    !moment(selectedDate).isBefore(moment(), "day");

  const isPastDate = moment(selectedDate).isBefore(moment(), "day");

  const teacherClasses = useMemo(() => getTeacherClasses(appUser), [appUser]);

  const [selectedClassId, setSelectedClassId] = useState<string>(
    teacherClasses.length > 0 && !isSuperAdmin
      ? teacherClasses[0] || ""
      : "all",
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyArrears, setShowOnlyArrears] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState<string | null>(
    null,
  );

  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, any>>({});
  const [locationRates, setLocationRates] = useState<Record<string, number>>(
    {},
  );
  const [busAmount, setBusAmount] = useState("");
  const [selectedLocationForRate, setSelectedLocationForRate] =
    useState<string>("");
  const [overrideMap, setOverrideMap] = useState<
    Record<string, string | undefined>
  >({});
  const [selectedStudentUids, setSelectedStudentUids] = useState<Set<string>>(
    new Set(),
  );
  const [bulkBillAmount, setBulkBillAmount] = useState("");

  const effectiveClassIds = useMemo(() => {
    if (isSuperAdmin) {
      return selectedClassId === "all" ? [] : [selectedClassId];
    }
    if (teacherClasses.length > 0) {
      return selectedClassId === "all" ? teacherClasses : [selectedClassId];
    }
    return [];
  }, [isSuperAdmin, selectedClassId, teacherClasses]);

  // Load classes
  useEffect(() => {
    const q = collection(db, "classes");
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        name: (d.data() as any).name || d.id,
      }));
      setClasses(sortClasses(list));
    });
    return () => unsub();
  }, []);

  // Load students
  useEffect(() => {
    const loadStudents = async () => {
      try {
        let baseQuery = query(
          collection(db, "users"),
          where("role", "==", "student"),
          where("status", "in", ["active", "pending_activation"]),
          where("takesBus", "==", true),
        );

        if (effectiveClassIds.length > 0) {
          if (effectiveClassIds.length === 1) {
            baseQuery = query(
              baseQuery,
              where("classId", "==", effectiveClassIds[0]),
            );
          } else {
            baseQuery = query(
              baseQuery,
              where("classId", "in", effectiveClassIds),
            );
          }
        } else if (!isSuperAdmin) {
          setStudents([]);
          return;
        }

        const snap = await getDocsFromServer(baseQuery as any);
        const studentList: StudentRecord[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            uid: d.id,
            fullName:
              `${data.profile?.firstName || ""} ${data.profile?.lastName || ""}`.trim() ||
              "Student",
            classId: data.classId || "unknown",
            className:
              classes.find((c) => c.id === data.classId)?.name || "Class",
            takesBus: data.takesBus || false,
            busLocation: data.busLocation || "",
            dailyArrears: data.dailyArrears || 0,
            termArrears: data.termArrears || {},
          };
        });

        studentList.sort((a, b) => a.fullName.localeCompare(b.fullName));
        setStudents(studentList);
      } catch (e) {
        console.error("Error loading students:", e);
      }
    };
    loadStudents();
  }, [effectiveClassIds, classes, isSuperAdmin]);

  // Load daily records
  useEffect(() => {
    if (!selectedDate) return;
    setLoading(true);

    const dateStr = moment(selectedDate).format("YYYY-MM-DD");
    let baseQuery = query(
      collection(db, "dailyFinancials"),
      where("date", "==", dateStr),
    );

    if (effectiveClassIds.length > 0) {
      if (effectiveClassIds.length === 1) {
        baseQuery = query(
          baseQuery,
          where("classId", "==", effectiveClassIds[0]),
        );
      } else {
        baseQuery = query(baseQuery, where("classId", "in", effectiveClassIds));
      }
    } else if (!isSuperAdmin) {
      setDailyRecords([]);
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      baseQuery as any,
      (snap: any) => {
        const records: DailyRecord[] = snap.docs.map((d: any) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setDailyRecords(records);
        setLoading(false);
        setRefreshing(false);
      },
      (err: any) => {
        console.error("Error listening to daily records:", err);
        setLoading(false);
        setRefreshing(false);
      },
    );

    return () => unsub();
  }, [selectedDate, effectiveClassIds, isSuperAdmin]);

  // Load attendance
  useEffect(() => {
    const loadAttendance = async () => {
      try {
        if (effectiveClassIds.length !== 1) {
          setAttendanceMap({});
          return;
        }
        const effectiveClassId = effectiveClassIds[0];
        const cleanDate = moment(selectedDate).format("YYYY-MM-DD");
        const acadYear = (acadConfig.academicYear || "").replace(/\//g, "-");
        const term = (acadConfig.currentTerm || "").replace(/\s/g, "");
        const attendanceId = `${effectiveClassId}_${acadYear}_${term}_${cleanDate}`;
        const ref = doc(db, "attendance", attendanceId);
        const snap = await getDoc(ref as any);
        if (snap.exists()) {
          const data = snap.data() as any;
          setAttendanceMap(data.students || {});
        } else {
          const q = query(
            collection(db, "attendance"),
            where("classId", "==", effectiveClassId),
            where("date", "==", cleanDate),
          );
          const querySnap = await getDocsFromServer(q);
          if (!querySnap.empty) {
            const data = querySnap.docs[0].data() as any;
            setAttendanceMap(data.students || {});
          } else {
            setAttendanceMap({});
          }
        }
      } catch (e) {
        console.error("Error loading attendance for bus screen:", e);
        setAttendanceMap({});
      }
    };
    loadAttendance();
  }, [effectiveClassIds, selectedDate, acadConfig]);

  // Load location rates
  useEffect(() => {
    const loadLocationRates = async () => {
      try {
        const docRef = doc(db, "school_settings", "bus_rates");
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const rates = snap.data() as Record<string, number>;
          setLocationRates(rates);
        }
      } catch (e) {
        console.error("Error loading bus rates:", e);
      }
    };
    loadLocationRates();
  }, []);

  const uniqueLocations = useMemo(() => {
    const locs = new Set<string>();
    students.forEach((s) => {
      if (s.busLocation) locs.add(s.busLocation);
    });
    return Array.from(locs).sort();
  }, [students]);

  const filteredStudents = useMemo(() => {
    const low = searchQuery.toLowerCase();
    return students.filter((s) => {
      const matchesSearch =
        s.fullName.toLowerCase().includes(low) ||
        s.className.toLowerCase().includes(low) ||
        (s.busLocation && s.busLocation.toLowerCase().includes(low));

      const matchesArrears = showOnlyArrears ? (s.dailyArrears || 0) > 0 : true;

      if (selectedDestination) {
        return (
          matchesSearch &&
          matchesArrears &&
          s.busLocation === selectedDestination
        );
      }
      return matchesSearch && matchesArrears;
    });
  }, [students, searchQuery, selectedDestination, showOnlyArrears]);

  const stats = useMemo(() => {
    const busRecords = dailyRecords.filter((r) => (r.busFee || 0) > 0);
    const paidRecords = busRecords.filter((r) => r.busPaid === true);
    const totalBus = paidRecords.reduce(
      (sum, r) => sum + (r.busPaidAmount ?? r.busFee ?? 0),
      0,
    );
    return {
      totalBus,
      recordsCount: paidRecords.length,
    };
  }, [dailyRecords]);

  const getExistingRecord = useCallback(
    (studentUid: string) => {
      const dateStr = moment(selectedDate).format("YYYY-MM-DD");
      return dailyRecords.find(
        (r) => r.studentUid === studentUid && r.date === dateStr,
      );
    },
    [dailyRecords, selectedDate],
  );

  const handleSaveLocationRate = async () => {
    if (!isSuperAdmin) {
      showToast({
        message: "Access Denied: Only admins can update rates.",
        type: "error",
      });
      return;
    }
    const rate = parseFloat(busAmount);
    if (!rate || rate <= 0) {
      showToast({ message: "Enter a valid bus rate.", type: "error" });
      return;
    }
    if (!selectedLocationForRate) {
      showToast({
        message: "Please select a location to update its rate.",
        type: "error",
      });
      return;
    }

    setSaving(true);
    try {
      const docRef = doc(db, "school_settings", "bus_rates");
      await setDoc(
        docRef,
        { [selectedLocationForRate]: rate },
        { merge: true },
      );
      setLocationRates((prev) => ({
        ...prev,
        [selectedLocationForRate]: rate,
      }));
      setBusAmount("");
      showToast({
        message: `Default bus rate for ${selectedLocationForRate} updated to ₵${rate}.`,
        type: "success",
      });
    } catch (e) {
      console.error("Error updating default bus rate:", e);
      showToast({ message: "Failed to update rate.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const commitPaidSpreads = async (ops: Array<{ ref: any; data: any }>) => {
    let batch = writeBatch(db);
    let count = 0;
    for (const op of ops) {
      batch.set(op.ref, op.data, { merge: true } as any);
      count++;
      if (count >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    }
    if (count > 0) await batch.commit();
  };

  const markStudentPaid = async (uid: string, overrideAmountStr?: string) => {
    if (!canEdit) return;
    const student = students.find((s) => s.uid === uid);
    const rate =
      locationRates[student?.busLocation || ""] ||
      SCHOOL_CONFIG.defaultBusRate ||
      0;

    if (!rate || rate <= 0) {
      showToast({
        message: "No bus rate set for this location.",
        type: "error",
      });
      return;
    }
    const existingRecord = dailyRecords.find((r) => r.studentUid === uid);
    if ((existingRecord as any)?.isAdvanceCovered) {
      showToast({
        message:
          "Advance Paid: Auto-assigned advance records cannot be modified.",
        type: "warning",
      });
      return;
    }
    const dateStr = moment(selectedDate).format("YYYY-MM-DD");
    const docId = `${uid}_${dateStr}`;

    setSaving(true);
    try {
      const ops: Array<{ ref: any; data: any }> = [];
      const overrideAmount = overrideAmountStr
        ? parseFloat(overrideAmountStr) || 0
        : rate;
      const paidToday = Math.min(rate, overrideAmount);
      const existingRecord = dailyRecords.find((r) => r.studentUid === uid);
      const oldFee = existingRecord?.busFee || 0;
      const feeDiff = rate - oldFee;
      const wasUnpaid =
        existingRecord &&
        (existingRecord.busFee || 0) > 0 &&
        !existingRecord.busPaid;

      const todayRef = doc(db, "dailyFinancials", docId);
      const todayData: any = {
        studentUid: uid,
        studentName: student?.fullName || "Student",
        classId: student?.classId || "unknown",
        className: student?.className || "Class",
        date: dateStr,
        academicYear: acadConfig.academicYear,
        term: acadConfig.currentTerm,
        busFee: rate,
        total: increment(feeDiff),
        busPaid: true,
        busPaidAmount: overrideAmount,
        busPaidAt: serverTimestamp(),
        recordedBy: appUser?.fullName || appUser?.adminRole || "Admin",
        recordedByUid: appUser?.uid || "unknown",
        updatedAt: serverTimestamp(),
      };

      if (!existingRecord) {
        todayData.createdAt = serverTimestamp();
        todayData.feedingFee = 0;
        todayData.extraClassesFee = 0;
        todayData.otherFees = 0;
        todayData.otherFeesDescription = "";
      }
      ops.push({ ref: todayRef, data: todayData });

      if (wasUnpaid) {
        const acadYear = (acadConfig.academicYear || "").replace(
          /[\/\s]/g,
          "_",
        );
        const currentTerm = (acadConfig.currentTerm || "").replace(
          /[\/\s]/g,
          "_",
        );
        const termKey = `${acadYear}_${currentTerm}`;
        const userRef = doc(db, "users", uid);
        const userUpdate: any = {
          dailyArrears: increment(-rate),
          updatedAt: serverTimestamp(),
        };
        if (termKey && termKey !== "_") {
          userUpdate[`termArrears.${termKey}`] = increment(-rate);
        }
        ops.push({ ref: userRef, data: userUpdate });

        setStudents((prev) =>
          prev.map((s) => {
            if (s.uid === uid) {
              return {
                ...s,
                dailyArrears: Math.max(0, (s.dailyArrears || 0) - rate),
              };
            }
            return s;
          }),
        );
      }

      if (overrideAmountStr) {
        let extra = overrideAmount - paidToday;
        let dayIndex = 1;
        const maxSpreadDays = 30;
        while (extra > 0 && dayIndex <= maxSpreadDays) {
          const nextDate = moment(selectedDate).add(dayIndex, "days");
          const nextDateStr = nextDate.format("YYYY-MM-DD");
          const ref = doc(db, "dailyFinancials", `${uid}_${nextDateStr}`);
          const amountForDay = Math.min(rate, extra);
          const data: any = {
            studentUid: uid,
            studentName: student?.fullName || "Student",
            classId: student?.classId || "unknown",
            className: student?.className || "Class",
            date: nextDateStr,
            academicYear: acadConfig.academicYear,
            term: acadConfig.currentTerm,
            busFee: amountForDay,
            total: increment(amountForDay),
            busPaid: true,
            busPaidAmount: amountForDay,
            busPaidAt: serverTimestamp(),
            recordedBy: appUser?.fullName || appUser?.adminRole || "Admin",
            recordedByUid: appUser?.uid || "unknown",
            updatedAt: serverTimestamp(),
            feedingFee: 0,
            extraClassesFee: 0,
            otherFees: 0,
            otherFeesDescription: "",
          };
          ops.push({ ref, data });
          extra -= amountForDay;
          dayIndex++;
        }
      }

      await commitPaidSpreads(ops);
      showToast({ message: "Marked Paid.", type: "success" });
    } catch (e) {
      console.error("Error marking student paid:", e);
      showToast({ message: "Failed to mark paid.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const markStudentNotPaid = async (uid: string) => {
    if (!canEdit) return;
    const student = students.find((s) => s.uid === uid);
    const rate =
      locationRates[student?.busLocation || ""] ||
      SCHOOL_CONFIG.defaultBusRate ||
      0;

    if (!rate || rate <= 0) {
      showToast({
        message: "No bus rate set for this location.",
        type: "error",
      });
      return;
    }

    const existingRecord = getExistingRecord(uid);
    if ((existingRecord as any)?.isAdvanceCovered) {
      showToast({
        message:
          "Advance Paid: Auto-assigned advance records cannot be modified.",
        type: "warning",
      });
      return;
    }

    const isCurrentlyUnpaid =
      existingRecord && existingRecord.busFee > 0 && !existingRecord.busPaid;
    const wasPaid = existingRecord && existingRecord.busPaid === true;

    setSaving(true);
    try {
      const dateStr = moment(selectedDate).format("YYYY-MM-DD");
      const ref = doc(db, "dailyFinancials", `${uid}_${dateStr}`);
      const newFee = isCurrentlyUnpaid ? 0 : rate;
      const oldFee = existingRecord?.busFee || 0;
      const feeDiff = newFee - oldFee;

      const data: any = {
        studentUid: uid,
        studentName: student?.fullName || "Student",
        classId: student?.classId || "unknown",
        className: student?.className || "Class",
        date: dateStr,
        academicYear: acadConfig.academicYear,
        term: acadConfig.currentTerm,
        busFee: newFee,
        total: increment(feeDiff),
        busPaid: false,
        busPaidAmount: 0,
        recordedBy: appUser?.fullName || appUser?.adminRole || "Admin",
        recordedByUid: appUser?.uid || "unknown",
        updatedAt: serverTimestamp(),
      };

      if (!existingRecord) {
        data.createdAt = serverTimestamp();
        data.feedingFee = 0;
        data.extraClassesFee = 0;
        data.otherFees = 0;
        data.otherFeesDescription = "";
      }
      data.busPaidAt = null;

      await setDoc(ref, data, { merge: true } as any);

      let arrearsDelta = 0;
      if (isCurrentlyUnpaid) {
        arrearsDelta = -rate;
      } else if (wasPaid) {
        arrearsDelta = rate;
      } else {
        arrearsDelta = rate;
      }

      if (arrearsDelta !== 0) {
        const acadYear = (acadConfig.academicYear || "").replace(
          /[\/\s]/g,
          "_",
        );
        const currentTerm = (acadConfig.currentTerm || "").replace(
          /[\/\s]/g,
          "_",
        );
        const termKey = `${acadYear}_${currentTerm}`;
        const userRef = doc(db, "users", uid);
        const userUpdate: any = {
          dailyArrears: increment(arrearsDelta),
          updatedAt: serverTimestamp(),
        };
        if (termKey && termKey !== "_") {
          userUpdate[`termArrears.${termKey}`] = increment(arrearsDelta);
        }
        await setDoc(userRef, userUpdate, { merge: true } as any);

        setStudents((prev) =>
          prev.map((s) => {
            if (s.uid === uid) {
              return {
                ...s,
                dailyArrears: Math.max(0, (s.dailyArrears || 0) + arrearsDelta),
              };
            }
            return s;
          }),
        );
      }

      showToast({
        message: isCurrentlyUnpaid ? "Record cleared." : "Marked Not Paid.",
        type: "success",
      });
    } catch (e) {
      console.error("Error marking student not paid:", e);
      showToast({ message: "Failed to update record.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleBulkBill = async () => {
    if (selectedStudentUids.size === 0) return;
    const amount = parseFloat(bulkBillAmount);
    if (isNaN(amount) || amount <= 0) {
      showToast({ message: "Enter a valid billing amount.", type: "error" });
      return;
    }

    setSaving(true);
    try {
      const dateStr = moment(selectedDate).format("YYYY-MM-DD");
      const batch = writeBatch(db);
      const selectedUids = Array.from(selectedStudentUids);
      const acadYear = (acadConfig.academicYear || "").replace(/[\/\s]/g, "_");
      const currentTerm = (acadConfig.currentTerm || "").replace(
        /[\/\s]/g,
        "_",
      );
      const termKey = `${acadYear}_${currentTerm}`;

      for (const uid of selectedUids) {
        const student = students.find((s) => s.uid === uid);
        const existingRecord = dailyRecords.find((r) => r.studentUid === uid);
        const oldFee = existingRecord?.busFee || 0;
        const feeDiff = amount - oldFee;
        const docId = `${uid}_${dateStr}`;
        const ref = doc(db, "dailyFinancials", docId);

        const data: any = {
          studentUid: uid,
          studentName: student?.fullName || "Student",
          classId: student?.classId || "unknown",
          className: student?.className || "Class",
          date: dateStr,
          academicYear: acadConfig.academicYear,
          term: acadConfig.currentTerm,
          busFee: amount,
          total: increment(feeDiff),
          recordedBy: appUser?.fullName || appUser?.adminRole || "Admin",
          recordedByUid: appUser?.uid || "unknown",
          updatedAt: serverTimestamp(),
        };

        if (!existingRecord) {
          data.createdAt = serverTimestamp();
          data.busPaid = false;
          data.busPaidAmount = 0;
          data.feedingFee = 0;
          data.extraClassesFee = 0;
          data.otherFees = 0;
          data.otherFeesDescription = "";
        }

        batch.set(ref, data, { merge: true } as any);

        const wasPaid = existingRecord?.busPaid === true;
        const arrearsDelta = wasPaid ? amount : amount - oldFee;
        if (arrearsDelta !== 0) {
          const userRef = doc(db, "users", uid);
          const userUpdate: any = {
            dailyArrears: increment(arrearsDelta),
            updatedAt: serverTimestamp(),
          };
          if (termKey && termKey !== "_") {
            userUpdate[`termArrears.${termKey}`] = increment(arrearsDelta);
          }
          batch.set(userRef, userUpdate, { merge: true } as any);
        }
      }

      await batch.commit();
      showToast({
        message: `Billed ${selectedStudentUids.size} students successfully.`,
        type: "success",
      });
      setSelectedStudentUids(new Set());
      setBulkBillAmount("");
    } catch (e) {
      console.error("Bulk billing error:", e);
      showToast({ message: "Bulk billing failed.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const toggleStudentSelection = (uid: string) => {
    setSelectedStudentUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const handleSelectAll = (filtered: StudentRecord[]) => {
    const allSelected =
      filtered.length > 0 &&
      filtered.every((s) => selectedStudentUids.has(s.uid));
    if (allSelected) {
      setSelectedStudentUids(new Set());
    } else {
      setSelectedStudentUids(new Set(filtered.map((s) => s.uid)));
    }
  };

  const handleAdvancePayment = async (studentUid: string, amount: number) => {
    const student = students.find((s) => s.uid === studentUid);
    const rate =
      locationRates[student?.busLocation || ""] ||
      SCHOOL_CONFIG.defaultBusRate ||
      10;

    if (!student || !rate || rate <= 0 || amount <= 0) {
      showToast({
        message: "Invalid payment amount or bus rate.",
        type: "error",
      });
      return;
    }

    setSaving(true);
    try {
      const currentArrears = student.dailyArrears || 0;
      const arrearsToClear = Math.min(currentArrears, amount);
      const remainingForDays = amount - arrearsToClear;

      const ops: Array<{ ref: any; data: any }> = [];
      const acadYear = (acadConfig.academicYear || "").replace(/[\/\s]/g, "_");
      const currentTerm = (acadConfig.currentTerm || "").replace(
        /[\/\s]/g,
        "_",
      );
      const termKey = `${acadYear}_${currentTerm}`;
      const triggerDateStr = moment(selectedDate).format("YYYY-MM-DD");

      if (arrearsToClear > 0) {
        const userRef = doc(db, "users", studentUid);
        const userUpdate: any = {
          dailyArrears: increment(-arrearsToClear),
          updatedAt: serverTimestamp(),
        };
        if (termKey && termKey !== "_") {
          userUpdate[`termArrears.${termKey}`] = increment(-arrearsToClear);
        }
        ops.push({ ref: userRef, data: userUpdate });
      }

      let daysAssigned = 0;
      if (remainingForDays > 0) {
        let calendarOffset = 0;
        const maxDaysToSearch = 120;
        let unallocatedRemaining = remainingForDays;

        while (unallocatedRemaining > 0 && calendarOffset < maxDaysToSearch) {
          const targetMoment = moment(selectedDate).add(calendarOffset, "days");
          const dayOfWeek = targetMoment.day();

          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            const dateStr = targetMoment.format("YYYY-MM-DD");
            const opStatus = getOperationalStatus(dateStr);

            if (!opStatus.isBlocked) {
              const docRef = doc(
                db,
                "dailyFinancials",
                `${studentUid}_${dateStr}`,
              );
              const isTriggerDay = calendarOffset === 0;

              const existingRecord = isTriggerDay
                ? getExistingRecord(studentUid)
                : null;
              const oldFee = existingRecord?.busFee || 0;

              const paidAmountForDay = isTriggerDay ? remainingForDays : 0;

              const dayData: any = {
                studentUid,
                studentName: student.fullName || "Student",
                classId: student.classId || "unknown",
                className: student.className || "Class",
                date: dateStr,
                academicYear: acadConfig.academicYear,
                term: acadConfig.currentTerm,
                busFee: rate,
                total: increment(
                  isTriggerDay ? remainingForDays - oldFee : rate,
                ),
                busPaid: true,
                busPaidAmount: paidAmountForDay,
                busPaidAt: serverTimestamp(),
                recordedBy: appUser?.fullName || appUser?.adminRole || "Admin",
                recordedByUid: appUser?.uid || "unknown",
                updatedAt: serverTimestamp(),
              };

              if (isTriggerDay) {
                dayData.isAdvancePaymentTrigger = true;
                dayData.advanceTotalPaid = remainingForDays;
              } else {
                dayData.isAdvanceCovered = true;
                dayData.advanceTriggerDate = triggerDateStr;
              }

              if (!existingRecord && isTriggerDay) {
                dayData.createdAt = serverTimestamp();
                dayData.feedingFee = 0;
                dayData.extraClassesFee = 0;
                dayData.otherFees = 0;
                dayData.otherFeesDescription = "";
              }

              ops.push({ ref: docRef, data: dayData });
              unallocatedRemaining -= rate;
              daysAssigned++;
            }
          }
          calendarOffset++;
        }
      }

      await commitPaidSpreads(ops);

      setStudents((prev) =>
        prev.map((s) => {
          if (s.uid === studentUid) {
            return {
              ...s,
              dailyArrears: Math.max(0, currentArrears - arrearsToClear),
            };
          }
          return s;
        }),
      );

      let msg = "";
      if (arrearsToClear > 0 && daysAssigned > 0) {
        msg = `Cleared ₵${arrearsToClear.toFixed(2)} arrears and auto-assigned ${daysAssigned} ${daysAssigned === 1 ? "day" : "days"} as PAID.`;
      } else if (arrearsToClear > 0) {
        msg = `Cleared ₵${arrearsToClear.toFixed(2)} towards student arrears. Remaining arrears: ₵${(currentArrears - arrearsToClear).toFixed(2)}.`;
      } else {
        msg = `Bulk payment of ₵${amount.toFixed(2)} recorded on today's total! Auto-assigned ${daysAssigned} ${daysAssigned === 1 ? "day" : "days"} as PAID.`;
      }

      showToast({ message: msg, type: "success" });
    } catch (e) {
      console.error("Error processing advance payment:", e);
      showToast({ message: "Failed to process payment.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return {
    appUser,
    canView,
    canEdit,
    isPastDate,
    isSuperAdmin,
    selectedDate,
    setSelectedDate,
    loading,
    refreshing,
    setRefreshing,
    saving,
    activeTab,
    setActiveTab,
    selectedClassId,
    setSelectedClassId,
    searchQuery,
    setSearchQuery,
    showOnlyArrears,
    setShowOnlyArrears,
    selectedDestination,
    setSelectedDestination,
    classes,
    students,
    filteredStudents,
    dailyRecords,
    attendanceMap,
    locationRates,
    uniqueLocations,
    busAmount,
    setBusAmount,
    selectedLocationForRate,
    setSelectedLocationForRate,
    overrideMap,
    setOverrideMap,
    stats,
    teacherClasses,
    getExistingRecord,
    handleSaveLocationRate,
    markStudentPaid,
    markStudentNotPaid,
    selectedStudentUids,
    setSelectedStudentUids,
    bulkBillAmount,
    setBulkBillAmount,
    handleBulkBill,
    toggleStudentSelection,
    handleSelectAll,
    handleAdvancePayment,
  };
};
