import { useState, useMemo, useEffect, useCallback } from "react";
import {
    collection,
    onSnapshot,
    query,
    where,
    getDocsFromServer,
    doc,
    getDoc,
    writeBatch,
    increment,
    serverTimestamp,
    setDoc,
    Timestamp,
    getDocs
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { useAcademicConfig } from "../useAcademicConfig";
import { getTeacherClasses, sortClasses } from "../../lib/classHelpers";
import { SCHOOL_CONFIG } from "../../constants/Config";
import moment from "moment";

export type DailyRecord = {
  id: string;
  studentUid: string;
  studentName: string;
  classId: string;
  className: string;
  date: string;
  extraClassesFee: number;
  feedingFee: number;
  busFee: number;
  otherFees: number;
  otherFeesDescription: string;
  total: number;
  recordedBy: string;
  recordedByUid: string;
  createdAt: Timestamp;
  extraPaid?: boolean;
  extraPaidAmount?: number;
  feedingPaid?: boolean;
  busPaid?: boolean;
};

export type StudentRecord = {
  uid: string;
  fullName: string;
  classId: string;
  className: string;
  takesExtraClasses: boolean;
  dailyArrears?: number;
  termArrears?: Record<string, number>;
};

export type TabType = "record" | "history" | "reports";

export const useExtraClassesFeeLogic = () => {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const acadConfig = useAcademicConfig();

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

  const extraClassesPermission =
    appUser?.permissions?.["record-extra-classes"] || "deny";

  const teacherClasses = useMemo(() => getTeacherClasses(appUser), [appUser]);

  const canView =
    isSuperAdmin ||
    teacherClasses.length > 0 ||
    extraClassesPermission === "full" ||
    extraClassesPermission === "view" ||
    extraClassesPermission === "edit";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("record");

  const [selectedDate, setSelectedDate] = useState(new Date());
  const isPastDate = moment(selectedDate).isBefore(moment(), "day");

  const canEdit =
    (isSuperAdmin ||
      teacherClasses.length > 0 ||
      extraClassesPermission === "full" ||
      extraClassesPermission === "edit") &&
    !isPastDate;

  const [selectedClassId, setSelectedClassId] = useState<string>(
    teacherClasses.length > 0 && !isSuperAdmin
      ? teacherClasses[0] || ""
      : "all",
  );

  const effectiveClassIds = useMemo(() => {
    if (isSuperAdmin) {
      return selectedClassId === "all" ? [] : [selectedClassId];
    }
    if (teacherClasses.length > 0) {
      return selectedClassId === "all" ? teacherClasses : [selectedClassId];
    }
    return [];
  }, [isSuperAdmin, selectedClassId, teacherClasses]);

  const [searchQuery, setSearchQuery] = useState("");
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, any>>({});
  const [extraClassesAmount, setExtraClassesAmount] = useState("");
  const [classRates, setClassRates] = useState<Record<string, number>>({});
  const [overrideMap, setOverrideMap] = useState<Record<string, string | undefined>>({});

  const currentClassRate = useMemo(() => {
    if (selectedClassId === "all")
      return SCHOOL_CONFIG.defaultExtraClassesRate || 0;
    const rate = classRates[selectedClassId] || 0;
    return rate || SCHOOL_CONFIG.defaultExtraClassesRate || 0;
  }, [selectedClassId, classRates]);

  useEffect(() => {
    const loadClassRates = async () => {
      try {
        const docRef = doc(db, "school_settings", "extra_classes_rates");
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const rates = snap.data() as Record<string, number>;
          setClassRates(rates);
        }
      } catch (e) {
        console.error("Error loading extra classes rates:", e);
      }
    };
    loadClassRates();
  }, []);

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

  useEffect(() => {
    const loadStudents = async () => {
      try {
        let baseQuery = query(
          collection(db, "users"),
          where("role", "==", "student"),
          where("status", "in", ["active", "pending_activation"]),
          where("takesExtraClasses", "==", true),
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
            takesExtraClasses: data.takesExtraClasses || false,
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
        console.error("Error loading attendance for extra classes screen:", e);
        setAttendanceMap({});
      }
    };
    loadAttendance();
  }, [effectiveClassIds, selectedDate, acadConfig]);

  const filteredStudents = useMemo(() => {
    const low = searchQuery.toLowerCase();
    return students.filter((s) => {
      return (
        s.fullName.toLowerCase().includes(low) ||
        s.className.toLowerCase().includes(low)
      );
    });
  }, [students, searchQuery]);

  const getExistingRecord = useCallback(
    (studentUid: string) => {
      const dateStr = moment(selectedDate).format("YYYY-MM-DD");
      return dailyRecords.find(
        (r) => r.studentUid === studentUid && r.date === dateStr,
      );
    },
    [dailyRecords, selectedDate],
  );

  const stats = useMemo(() => {
    const extraRecords = dailyRecords.filter(
      (r) => (Number(r.extraClassesFee) || 0) > 0,
    );
    const paidRecords = extraRecords.filter((r) => r.extraPaid === true);
    const totalExtraClasses = paidRecords.reduce(
      (sum, r) => sum + (Number(r.extraClassesFee) || 0),
      0,
    );
    return {
      totalExtraClasses,
      recordsCount: paidRecords.length,
    };
  }, [dailyRecords]);

  const handleSaveClassRate = async () => {
    if (!isSuperAdmin) {
      showToast({ message: "Access Denied: Only admins can update rates.", type: "error" });
      return;
    }
    const classAmount = parseFloat(extraClassesAmount);
    if (!classAmount || classAmount <= 0) {
      showToast({ message: "Enter a valid extra classes rate.", type: "error" });
      return;
    }
    if (selectedClassId === "all") {
      showToast({ message: "Please select a specific class to update its rate.", type: "error" });
      return;
    }

    setSaving(true);
    try {
      const docRef = doc(db, "school_settings", "extra_classes_rates");
      await setDoc(docRef, { [selectedClassId]: classAmount }, { merge: true });
      setClassRates((prev) => ({ ...prev, [selectedClassId]: classAmount }));
      setExtraClassesAmount("");
      showToast({
        message: `Default extra classes rate for ${classes.find((c) => c.id === selectedClassId)?.name} updated to ₵${classAmount}.`,
        type: "success",
      });
    } catch (e) {
      console.error("Error updating default extra classes rate:", e);
      showToast({ message: "Failed to update rate.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDisburseToStaff = async () => {
    if (!isSuperAdmin) {
      showToast({ message: "Access Denied: Only super admins can disburse.", type: "error" });
      return;
    }

    setSaving(true);
    try {
      const q = query(
        collection(db, "dailyFinancials"),
        where("extraClassesFee", ">", 0),
        where("extraPaid", "==", true),
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        showToast({ message: "No accumulated extra classes fees to disburse.", type: "info" });
        setSaving(false);
        return;
      }

      let batch = writeBatch(db);
      let count = 0;
      const totalToDisburse = stats.totalExtraClasses;

      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        batch.update(docSnap.ref, {
          extraClassesFee: 0,
          total: increment(-(data.extraClassesFee || 0)),
          disbursedAt: serverTimestamp(),
          disbursedBy: appUser?.uid,
        });

        count++;
        if (count >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }

      if (count > 0) await batch.commit();

      showToast({
        message: `Successfully disbursed ₵${totalToDisburse.toFixed(2)} and cleared accumulated fees.`,
        type: "success",
      });
    } catch (e) {
      console.error("Error disbursing fees:", e);
      showToast({ message: "Failed to disburse fees.", type: "error" });
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
    const student = students.find((s) => s.uid === uid);
    const classAmount =
      parseFloat(extraClassesAmount) ||
      classRates[student?.classId || ""] ||
      SCHOOL_CONFIG.defaultExtraClassesRate ||
      0;
    if (!classAmount || classAmount <= 0) {
      showToast({ message: "Set extra classes fee amount first.", type: "error" });
      return;
    }
    const dateStr = moment(selectedDate).format("YYYY-MM-DD");
    const docId = `${uid}_${dateStr}`;

    setSaving(true);
    try {
      const ops: Array<{ ref: any; data: any }> = [];
      const totalPaid = overrideAmountStr ? parseFloat(overrideAmountStr) || 0 : classAmount;
      const paidToday = Math.min(classAmount, totalPaid);

      const existingRecord = getExistingRecord(uid);
      const oldExtraFee = existingRecord?.extraClassesFee || 0;
      const todayRef = doc(db, "dailyFinancials", docId);
      const todayData: any = {
        studentUid: uid,
        studentName: student?.fullName || "Student",
        classId: student?.classId || "unknown",
        className: student?.className || "Class",
        date: dateStr,
        academicYear: acadConfig.academicYear,
        term: acadConfig.currentTerm,
        extraClassesFee: classAmount,
        total: increment(classAmount - oldExtraFee),
        extraPaid: true,
        extraPaidAmount: totalPaid,
        extraPaidAt: serverTimestamp(),
        recordedBy: appUser?.fullName || appUser?.adminRole || "Admin",
        recordedByUid: appUser?.uid || "unknown",
        updatedAt: serverTimestamp(),
      };
      if (!existingRecord) {
        todayData.createdAt = serverTimestamp();
        todayData.feedingFee = 0;
        todayData.busFee = 0;
        todayData.otherFees = 0;
      }
      ops.push({ ref: todayRef, data: todayData });

      if (overrideAmountStr) {
        let extra = totalPaid - paidToday;
        let dayIndex = 1;
        const maxSpreadDays = 30;
        while (extra > 0 && dayIndex <= maxSpreadDays) {
          const nextDate = moment(selectedDate).add(dayIndex, "days");
          const nextDateStr = nextDate.format("YYYY-MM-DD");
          const ref = doc(db, "dailyFinancials", `${uid}_${nextDateStr}`);
          const amountForDay = Math.min(classAmount, extra);
          const data: any = {
            studentUid: uid,
            studentName: student?.fullName || "Student",
            classId: student?.classId || "unknown",
            className: student?.className || "Class",
            date: nextDateStr,
            academicYear: acadConfig.academicYear,
            term: acadConfig.currentTerm,
            extraClassesFee: amountForDay,
            total: increment(amountForDay),
            extraPaid: true,
            extraPaidAt: serverTimestamp(),
            recordedBy: appUser?.fullName || appUser?.adminRole || "Admin",
            recordedByUid: appUser?.uid || "unknown",
            updatedAt: serverTimestamp(),
            feedingFee: 0,
            busFee: 0,
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
    const student = students.find((s) => s.uid === uid);
    const classAmount =
      parseFloat(extraClassesAmount) ||
      classRates[student?.classId || ""] ||
      SCHOOL_CONFIG.defaultExtraClassesRate ||
      0;
    if (!classAmount || classAmount <= 0) {
      showToast({ message: "Set extra classes fee amount first.", type: "error" });
      return;
    }

    const existingRecord = getExistingRecord(uid);
    const isCurrentlyUnpaid =
      existingRecord &&
      (existingRecord.extraClassesFee || 0) > 0 &&
      !existingRecord.extraPaid;

    setSaving(true);
    try {
      const dateStr = moment(selectedDate).format("YYYY-MM-DD");
      const ref = doc(db, "dailyFinancials", `${uid}_${dateStr}`);

      const newFee = isCurrentlyUnpaid ? 0 : classAmount;
      const oldFee = existingRecord?.extraClassesFee || 0;

      const data: any = {
        studentUid: uid,
        studentName: student?.fullName || "Student",
        classId: student?.classId || "unknown",
        className: student?.className || "Class",
        date: dateStr,
        academicYear: acadConfig.academicYear,
        term: acadConfig.currentTerm,
        extraClassesFee: newFee,
        total: increment(newFee - oldFee),
        extraPaid: false,
        extraPaidAmount: 0,
        extraPaidAt: null,
        recordedBy: appUser?.fullName || appUser?.adminRole || "Admin",
        recordedByUid: appUser?.uid || "unknown",
        updatedAt: serverTimestamp(),
      };
      if (!existingRecord) {
        data.createdAt = serverTimestamp();
        data.feedingFee = 0;
        data.busFee = 0;
        data.otherFees = 0;
      }
      await setDoc(ref, data, { merge: true } as any);

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
    classes,
    students,
    filteredStudents,
    dailyRecords,
    attendanceMap,
    extraClassesAmount,
    setExtraClassesAmount,
    classRates,
    currentClassRate,
    overrideMap,
    setOverrideMap,
    stats,
    teacherClasses,
    getExistingRecord,
    handleSaveClassRate,
    handleDisburseToStaff,
    markStudentPaid,
    markStudentNotPaid,
  };
};
