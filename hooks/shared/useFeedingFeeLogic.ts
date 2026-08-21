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
    Timestamp
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { useAcademicConfig } from "../useAcademicConfig";
import { getTeacherClasses, isClassTeacher } from "../../lib/classHelpers";
import { SCHOOL_CONFIG } from "../../constants/Config";
import moment from "moment";

export type DailyRecord = {
  id: string;
  studentUid: string;
  studentName: string;
  classId: string;
  className: string;
  date: string;
  feedingFee: number;
  busFee: number;
  extraClassesFee: number;
  otherFees: number;
  otherFeesDescription: string;
  total: number;
  recordedBy: string;
  recordedByUid: string;
  createdAt: Timestamp;
  feedingPaid?: boolean;
  feedingPaidAmount?: number;
  busPaid?: boolean;
  extraPaid?: boolean;
};

export type StudentRecord = {
  uid: string;
  fullName: string;
  classId: string;
  className: string;
  isFeeding: boolean;
  dailyArrears?: number;
  termArrears?: Record<string, number>;
};

export type TabType = "record" | "history" | "reports";

export const useFeedingFeeLogic = () => {
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

  const feedingPermission = appUser?.permissions?.["feeding"] || "deny";

  const canView =
    isSuperAdmin ||
    feedingPermission === "full" ||
    feedingPermission === "view" ||
    feedingPermission === "edit";

  const teacherClasses = useMemo(() => getTeacherClasses(appUser), [appUser]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("record");

  const [selectedDate, setSelectedDate] = useState(new Date());
  const isPastDate = moment(selectedDate).isBefore(moment(), "day");
  const canEdit =
    (isSuperAdmin || feedingPermission === "full" || feedingPermission === "edit") &&
    !isPastDate;

  const [selectedClassId, setSelectedClassId] = useState<string>(
    teacherClasses.length > 0 && !isSuperAdmin
      ? teacherClasses[0] || ""
      : "all",
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [attendanceMap, setAttendanceMap] = useState<Record<string, any>>({});
  const [feedingAmount, setFeedingAmount] = useState("");
  const [classRates, setClassRates] = useState<Record<string, number>>({});
  const [overrideMap, setOverrideMap] = useState<Record<string, string | undefined>>({});

  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>([]);

  const stats = useMemo(() => {
    const feedingRecords = dailyRecords.filter((r) => (r.feedingFee || 0) > 0);
    return {
      totalFeeding: feedingRecords.reduce((acc, curr) => acc + (curr.feedingFee || 0), 0),
      recordsCount: feedingRecords.length,
    };
  }, [dailyRecords]);

  const currentClassRate = useMemo(() => {
    if (selectedClassId === "all") return SCHOOL_CONFIG.defaultFeedingRate || 0;
    return classRates[selectedClassId] || SCHOOL_CONFIG.defaultFeedingRate || 0;
  }, [selectedClassId, classRates]);

  const effectiveClassIds = useMemo(() => {
    if (isSuperAdmin) {
      return selectedClassId === "all" ? [] : [selectedClassId];
    }
    if (teacherClasses.length > 0) {
      return selectedClassId === "all" ? teacherClasses : [selectedClassId];
    }
    return [];
  }, [isSuperAdmin, selectedClassId, teacherClasses]);

  useEffect(() => {
    const loadClasses = async () => {
      try {
        const snap = await getDocsFromServer(collection(db, "classes") as any);
        const classList = snap.docs.map((d: any) => ({
          id: d.id,
          name: d.data().name || "Unnamed Class",
        }));
        setClasses(classList);
      } catch (e) {
        console.error("Error loading classes:", e);
      }
    };

    const loadRates = async () => {
      try {
        const ref = doc(db, "school_settings", "feeding_rates");
        const snap = await getDoc(ref as any);
        if (snap.exists()) {
          setClassRates(snap.data() as Record<string, number>);
        }
      } catch (e) {
        console.error("Error loading feeding rates:", e);
      }
    };

    loadClasses();
    loadRates();
  }, []);

  useEffect(() => {
    const loadStudents = async () => {
      try {
        let baseQuery = query(
          collection(db, "users"),
          where("role", "==", "student"),
          where("status", "in", ["active", "pending_activation"]),
          where("isFeeding", "==", true),
        );

        if (effectiveClassIds.length > 0) {
          if (effectiveClassIds.length === 1) {
            baseQuery = query(baseQuery, where("classId", "==", effectiveClassIds[0]));
          } else {
            baseQuery = query(baseQuery, where("classId", "in", effectiveClassIds));
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
            fullName: `${data.profile?.firstName || ""} ${data.profile?.lastName || ""}`.trim() || "Student",
            classId: data.classId || "unknown",
            className: classes.find((c) => c.id === data.classId)?.name || "Class",
            isFeeding: data.isFeeding || false,
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
    let baseQuery = query(collection(db, "dailyFinancials"), where("date", "==", dateStr));

    if (effectiveClassIds.length > 0) {
      if (effectiveClassIds.length === 1) {
        baseQuery = query(baseQuery, where("classId", "==", effectiveClassIds[0]));
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
        console.error("Error loading attendance for feeding screen:", e);
        setAttendanceMap({});
      }
    };
    loadAttendance();
  }, [effectiveClassIds, selectedDate, acadConfig]);

  const filteredStudents = useMemo(() => {
    const low = searchQuery.toLowerCase();
    return students.filter((s) =>
      s.fullName.toLowerCase().includes(low) ||
      s.className.toLowerCase().includes(low)
    );
  }, [students, searchQuery]);

  const handleSaveClassRate = async () => {
    if (!isSuperAdmin) {
      showToast({ message: "Access Denied: Only admins can update rates.", type: "error" });
      return;
    }
    const rate = parseFloat(feedingAmount);
    if (!rate || rate <= 0) {
      showToast({ message: "Enter a valid feeding rate.", type: "error" });
      return;
    }
    if (selectedClassId === "all") {
      showToast({ message: "Please select a specific class to update its rate.", type: "error" });
      return;
    }

    setSaving(true);
    try {
      const docRef = doc(db, "school_settings", "feeding_rates");
      await setDoc(docRef, { [selectedClassId]: rate }, { merge: true });
      setClassRates((prev) => ({ ...prev, [selectedClassId]: rate }));
      setFeedingAmount("");
      showToast({
        message: `Default feeding rate for this class updated to ₵${rate}.`,
        type: "success",
      });
    } catch (e) {
      console.error("Error updating default feeding rate:", e);
      showToast({ message: "Failed to update rate.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const getExistingRecord = useCallback((studentUid: string) => {
    const dateStr = moment(selectedDate).format("YYYY-MM-DD");
    return dailyRecords.find((r) => r.studentUid === studentUid && r.date === dateStr);
  }, [dailyRecords, selectedDate]);

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
    const rate = classRates[student?.classId || ""] || SCHOOL_CONFIG.defaultFeedingRate || 0;
    if (!rate || rate <= 0) {
      showToast({ message: "No feeding rate set for this class.", type: "error" });
      return;
    }
    const dateStr = moment(selectedDate).format("YYYY-MM-DD");
    const docId = `${uid}_${dateStr}`;

    setSaving(true);
    try {
      const ops: Array<{ ref: any; data: any }> = [];
      const overrideAmount = overrideAmountStr ? parseFloat(overrideAmountStr) || 0 : rate;
      const paidToday = Math.min(rate, overrideAmount);
      const existingRecord = dailyRecords.find((r) => r.studentUid === uid);
      const oldFee = existingRecord?.feedingFee || 0;
      const feeDiff = rate - oldFee;

      const todayRef = doc(db, "dailyFinancials", docId);
      const todayData: any = {
        studentUid: uid,
        studentName: student?.fullName || "Student",
        classId: student?.classId || "unknown",
        className: student?.className || "Class",
        date: dateStr,
        academicYear: acadConfig.academicYear,
        term: acadConfig.currentTerm,
        feedingFee: rate,
        total: increment(feeDiff),
        feedingPaid: true,
        feedingPaidAmount: overrideAmount,
        feedingPaidAt: serverTimestamp(),
        recordedBy: appUser?.fullName || appUser?.adminRole || "Admin",
        recordedByUid: appUser?.uid || "unknown",
        updatedAt: serverTimestamp(),
      };

      if (!existingRecord) {
        todayData.createdAt = serverTimestamp();
        todayData.busFee = 0;
        todayData.extraClassesFee = 0;
        todayData.otherFees = 0;
        todayData.otherFeesDescription = "";
      }
      ops.push({ ref: todayRef, data: todayData });

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
            feedingFee: amountForDay,
            total: increment(amountForDay),
            feedingPaid: true,
            feedingPaidAmount: amountForDay,
            feedingPaidAt: serverTimestamp(),
            recordedBy: appUser?.fullName || appUser?.adminRole || "Admin",
            recordedByUid: appUser?.uid || "unknown",
            updatedAt: serverTimestamp(),
            busFee: 0,
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
    const student = students.find((s) => s.uid === uid);
    const rate = classRates[student?.classId || ""] || SCHOOL_CONFIG.defaultFeedingRate || 0;
    if (!rate || rate <= 0) {
      showToast({ message: "No feeding rate set for this class.", type: "error" });
      return;
    }
    const existingRecord = getExistingRecord(uid);
    const isCurrentlyUnpaid = existingRecord && existingRecord.feedingFee > 0 && !existingRecord.feedingPaid;

    setSaving(true);
    try {
      const dateStr = moment(selectedDate).format("YYYY-MM-DD");
      const ref = doc(db, "dailyFinancials", `${uid}_${dateStr}`);
      const newFee = isCurrentlyUnpaid ? 0 : rate;
      const oldFee = existingRecord?.feedingFee || 0;
      const feeDiff = newFee - oldFee;

      const data: any = {
        studentUid: uid,
        studentName: student?.fullName || "Student",
        classId: student?.classId || "unknown",
        className: student?.className || "Class",
        date: dateStr,
        academicYear: acadConfig.academicYear,
        term: acadConfig.currentTerm,
        feedingFee: newFee,
        total: increment(feeDiff),
        feedingPaid: false,
        feedingPaidAmount: 0,
        recordedBy: appUser?.fullName || appUser?.adminRole || "Admin",
        recordedByUid: appUser?.uid || "unknown",
        updatedAt: serverTimestamp(),
      };

      if (!existingRecord) {
        data.createdAt = serverTimestamp();
        data.busFee = 0;
        data.extraClassesFee = 0;
        data.otherFees = 0;
        data.otherFeesDescription = "";
      }
      data.feedingPaidAt = null;

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
    classRates,
    feedingAmount,
    setFeedingAmount,
    overrideMap,
    setOverrideMap,
    stats,
    teacherClasses,
    currentClassRate,
    handleSaveClassRate,
    markStudentPaid,
    markStudentNotPaid,
    getExistingRecord,
  };
};
