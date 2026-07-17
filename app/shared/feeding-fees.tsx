import { useRouter } from "expo-router";
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
    updateDoc,
    where,
    writeBatch,
} from "firebase/firestore";
import moment from "moment";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Platform,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import { SafeAreaView } from "react-native-safe-area-context";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { db } from "../../firebaseConfig";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";
import { getTeacherClasses, isClassTeacher } from "../../lib/classHelpers";

// Guarded import for native-only library
const DateTimePicker =
  Platform.OS !== "web"
    ? require("@react-native-community/datetimepicker").default
    : null;

const { width } = Dimensions.get("window");

const VIBE = {
  primary: COLORS.primary || "#4F46E5",
  secondary: COLORS.secondary || "#F59E0B",
  success: "#10B981",
  danger: "#EF4444",
  info: "#3B82F6",
  purple: "#8B5CF6",
  bg: "#F1F5F9",
  surface: "#FFFFFF",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
};

type DailyRecord = {
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

type StudentRecord = {
  uid: string;
  fullName: string;
  classId: string;
  className: string;
  isFeeding: boolean;
};

// Student payment tracking not required separately; dailyFinancials holds feedingPaid

type TabType = "record" | "history" | "reports";

export default function FeedingFees() {
  const router = useRouter();
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const acadConfig = useAcademicConfig();

  // ACCESS CONTROL LOGIC
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

  // Class teacher check
  const teacherClasses = useMemo(() => getTeacherClasses(appUser), [appUser]);

  const handleBack = () => {
    router.replace("/shared/daily-financials");
  };

  useEffect(() => {
    if (appUser && !canView) {
      showToast({
        message:
          "Access Denied: You do not have permission to view Feeding Fees.",
        type: "error",
      });
      handleBack();
    }
  }, [appUser, canView]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("record");

  // Filters
  const [selectedDate, setSelectedDate] = useState(new Date());
  const isPastDate = moment(selectedDate).isBefore(moment(), "day");
  const canEdit =
    (isSuperAdmin ||
      feedingPermission === "full" ||
      feedingPermission === "edit") &&
    !isPastDate;
  const [showDatePicker, setShowDatePicker] = useState(false);

  const changeDate = (days: number) => {
    setSelectedDate(moment(selectedDate).add(days, "days").toDate());
  };

  // Determine initial class selection
  const [selectedClassId, setSelectedClassId] = useState<string>(
    teacherClasses.length > 0 && !isSuperAdmin
      ? teacherClasses[0] || ""
      : "all",
  );

  const isUserClassTeacher = useMemo(() => {
    if (!appUser || !selectedClassId || selectedClassId === "all") return false;
    return isClassTeacher(appUser, selectedClassId);
  }, [appUser, selectedClassId]);
  const [searchQuery, setSearchQuery] = useState("");
  const [attendanceMap, setAttendanceMap] = useState<Record<string, any>>({});
  const [feedingAmount, setFeedingAmount] = useState("");
  const [classRates, setClassRates] = useState<Record<string, number>>({});
  const [overrideMap, setOverrideMap] = useState<
    Record<string, string | undefined>
  >({});

  // Data
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>([]);

  // Stats calculation
  const stats = useMemo(() => {
    const feedingRecords = dailyRecords.filter((r) => (r.feedingFee || 0) > 0);
    return {
      totalFeeding: feedingRecords.reduce(
        (acc, curr) => acc + (curr.feedingFee || 0),
        0,
      ),
      recordsCount: feedingRecords.length,
    };
  }, [dailyRecords]);

  const currentClassRate = useMemo(() => {
    if (selectedClassId === "all") return SCHOOL_CONFIG.defaultFeedingRate || 0;
    return classRates[selectedClassId] || SCHOOL_CONFIG.defaultFeedingRate || 0;
  }, [selectedClassId, classRates]);

  // Derived effective class IDs for queries
  const effectiveClassIds = useMemo(() => {
    if (isSuperAdmin) {
      return selectedClassId === "all" ? [] : [selectedClassId];
    }
    if (teacherClasses.length > 0) {
      return selectedClassId === "all" ? teacherClasses : [selectedClassId];
    }
    return [];
  }, [isSuperAdmin, selectedClassId, teacherClasses]);

  // Load classes and rates
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

  // Load students
  useEffect(() => {
    const loadStudents = async () => {
      try {
        let baseQuery = query(
          collection(db, "users"),
          where("role", "==", "student"),
          where("status", "in", ["active", "pending_activation"]),
          // Only show students marked for feeding
          where("isFeeding", "==", true),
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
          // If not super admin and no classes assigned, return empty
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

  // Load daily records for selected date in real-time
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

  // Load attendance for selected class/date so we can skip absent students
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
          // Fallback: Query by classId and date
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

  // Filter students by search
  const filteredStudents = useMemo(() => {
    const low = searchQuery.toLowerCase();
    return students.filter((s) => {
      return (
        s.fullName.toLowerCase().includes(low) ||
        s.className.toLowerCase().includes(low)
      );
    });
  }, [students, searchQuery]);

  // Get existing record for a student on selected date
  const getExistingRecord = useCallback(
    (studentUid: string) => {
      const dateStr = moment(selectedDate).format("YYYY-MM-DD");
      return dailyRecords.find(
        (r) => r.studentUid === studentUid && r.date === dateStr,
      );
    },
    [dailyRecords, selectedDate],
  );

  // Toggle student selection
  const toggleStudentSelection = (uid: string) => {
    // no-op: selection removed in simplified UI (we apply class amount to class)
  };

  // Save current feeding rate for the class in school_settings
  const handleSaveClassRate = async () => {
    if (!isSuperAdmin) {
      showToast({
        message: "Access Denied: Only admins can update rates.",
        type: "error",
      });
      return;
    }
    const classAmount = parseFloat(feedingAmount);
    if (!classAmount || classAmount <= 0) {
      showToast({
        message: "Enter a valid feeding rate.",
        type: "error",
      });
      return;
    }

    if (selectedClassId === "all") {
      showToast({
        message: "Please select a specific class to update its rate.",
        type: "error",
      });
      return;
    }

    setSaving(true);
    try {
      const docRef = doc(db, "school_settings", "feeding_rates");
      await setDoc(docRef, { [selectedClassId]: classAmount }, { merge: true });
      setClassRates((prev) => ({ ...prev, [selectedClassId]: classAmount }));
      setFeedingAmount("");
      showToast({
        message: `Default feeding rate for ${classes.find((c) => c.id === selectedClassId)?.name} updated to ₵${classAmount}.`,
        type: "success",
      });
    } catch (e) {
      console.error("Error updating default feeding rate:", e);
      showToast({ message: "Failed to update rate.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleRecordForAll = async () => {
    if (!canEdit) {
      showToast({
        message: "Access Denied: You don't have permission.",
        type: "error",
      });
      return;
    }

    setSaving(true);
    try {
      const dateStr = moment(selectedDate).format("YYYY-MM-DD");
      const recordsMap = new Map(dailyRecords.map((r) => [r.studentUid, r]));
      let batch = writeBatch(db);
      let opCount = 0;

      for (const student of students) {
        const uid = student.uid;
        if (attendanceMap[uid]?.status === "absent") continue;

        const rate =
          classRates[student.classId] || SCHOOL_CONFIG.defaultFeedingRate || 0;
        if (rate <= 0) continue;

        const existingRecord = recordsMap.get(uid);
        if (existingRecord) continue; // Skip if already recorded

        const docId = `${uid}_${dateStr}`;
        const recordData: any = {
          studentUid: uid,
          studentName: student.fullName,
          classId: student.classId,
          className: student.className,
          date: dateStr,
          feedingFee: rate,
          total: increment(rate),
          feedingPaid: false,
          feedingPaidAmount: 0,
          recordedBy: appUser?.adminRole || "Admin",
          recordedByUid: appUser?.uid || "unknown",
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          busFee: 0,
          extraClassesFee: 0,
          otherFees: 0,
          otherFeesDescription: "",
        };

        batch.set(doc(db, "dailyFinancials", docId), recordData, {
          merge: true,
        } as any);

        opCount++;

        if (opCount >= 200) {
          // Lower limit because we do 2 ops per student
          await batch.commit();
          batch = writeBatch(db);
          opCount = 0;
        }
      }

      if (opCount > 0) await batch.commit();

      showToast({
        message: `Recorded feeding for ${opCount} students using current rates.`,
        type: "success",
      });
    } catch (e) {
      console.error("Error recording for all:", e);
      showToast({ message: "Failed to record for all.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  // Helper to chunk and commit writeBatch ops if needed
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

  // Mark a student paid for selected date; if overrideAmount > classAmount, spread extra to future days
  const markStudentPaid = async (uid: string, overrideAmountStr?: string) => {
    const classAmount =
      parseFloat(feedingAmount) ||
      classRates[selectedClassId] ||
      SCHOOL_CONFIG.defaultFeedingRate ||
      0;
    if (!classAmount || classAmount <= 0) {
      showToast({ message: "Set class feeding amount first.", type: "error" });
      return;
    }
    const dateStr = moment(selectedDate).format("YYYY-MM-DD");
    const docId = `${uid}_${dateStr}`;

    setSaving(true);
    try {
      const student = students.find((s) => s.uid === uid);
      const ops: Array<{ ref: any; data: any }> = [];

      const overrideAmount = overrideAmountStr
        ? parseFloat(overrideAmountStr) || 0
        : classAmount;
      const paidToday = Math.min(classAmount, overrideAmount);

      // set today's record as paid
      const existingRecord = dailyRecords.find((r) => r.studentUid === uid);
      const oldFee = existingRecord?.feedingFee || 0;
      const feeDiff = classAmount - oldFee;

      const todayRef = doc(db, "dailyFinancials", docId);
      const todayData: any = {
        studentUid: uid,
        studentName: student?.fullName || "Student",
        classId: student?.classId || "unknown",
        className: student?.className || "Class",
        date: dateStr,
        feedingFee: classAmount,
        total: increment(feeDiff),
        feedingPaid: true,
        feedingPaidAmount: overrideAmount,
        feedingPaidAt: serverTimestamp(),
        recordedBy: appUser?.adminRole || "Admin",
        recordedByUid: appUser?.uid || "unknown",
        updatedAt: serverTimestamp(),
      };

      if (!existingRecord) {
        todayData.createdAt = serverTimestamp();
        todayData.busFee = 0;
        todayData.extraClassesFee = 0;
        todayData.otherFees = 0;
      }
      ops.push({ ref: todayRef, data: todayData });

      // If override > classAmount, spread extra to future days
      if (overrideAmountStr) {
        let extra = overrideAmount - paidToday;
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
            feedingFee: amountForDay,
            total: increment(amountForDay),
            feedingPaid: true,
            feedingPaidAmount: amountForDay,
            feedingPaidAt: serverTimestamp(),
            recordedBy: appUser?.adminRole || "Admin",
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

  // Mark a student not-paid (set feedingPaid false and ensure feedingFee = class amount)
  // If already recorded as unpaid, this will "un-record" them (set feedingFee to 0) to assume they are not in school
  const markStudentNotPaid = async (uid: string) => {
    const classAmount =
      parseFloat(feedingAmount) ||
      classRates[selectedClassId] ||
      SCHOOL_CONFIG.defaultFeedingRate ||
      0;
    if (!classAmount || classAmount <= 0) {
      showToast({ message: "Set class feeding amount first.", type: "error" });
      return;
    }

    const existingRecord = getExistingRecord(uid);
    const isCurrentlyUnpaid =
      existingRecord &&
      existingRecord.feedingFee > 0 &&
      !existingRecord.feedingPaid;

    setSaving(true);
    try {
      const student = students.find((s) => s.uid === uid);
      const dateStr = moment(selectedDate).format("YYYY-MM-DD");
      const ref = doc(db, "dailyFinancials", `${uid}_${dateStr}`);

      const newFee = isCurrentlyUnpaid ? 0 : classAmount;
      const oldFee = existingRecord?.feedingFee || 0;
      const feeDiff = newFee - oldFee;

      const data: any = {
        studentUid: uid,
        studentName: student?.fullName || "Student",
        classId: student?.classId || "unknown",
        className: student?.className || "Class",
        date: dateStr,
        feedingFee: newFee,
        total: increment(feeDiff),
        feedingPaid: false,
        feedingPaidAmount: 0,
        updatedAt: serverTimestamp(),
      };

      if (!existingRecord) {
        data.createdAt = serverTimestamp();
        data.busFee = 0;
        data.extraClassesFee = 0;
        data.otherFees = 0;
        data.otherFeesDescription = "";
      }
      data.recordedBy = appUser?.adminRole || "Admin";
      data.recordedByUid = appUser?.uid || "unknown";
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

  // Render statistics card
  const renderStatsCard = (
    title: string,
    value: string | number,
    icon: string,
    color: string,
    isCurrency: boolean = true,
  ) => (
    <View
      style={[
        styles.statsCard,
        { borderLeftColor: color, backgroundColor: VIBE.surface },
      ]}
    >
      <View style={[styles.statsIconBox, { backgroundColor: color + "15" }]}>
        <SVGIcon name={icon} size={20} color={color} />
      </View>
      <View style={styles.statsInfo}>
        <Text style={styles.statsLabel}>{title}</Text>
        <Text style={[styles.statsValue, { color: VIBE.text }]}>
          {isCurrency ? `₵${Number(value).toFixed(2)}` : value}
        </Text>
      </View>
    </View>
  );

  // Render record item
  const renderRecordItem = ({ item }: { item: DailyRecord }) => (
    <Animatable.View animation="fadeInUp" duration={300}>
      <View style={styles.recordCard}>
        <View
          style={[
            styles.recordStatus,
            {
              backgroundColor:
                item.feedingFee > 0 ? VIBE.success + "20" : VIBE.muted + "20",
            },
          ]}
        />
        <View style={styles.recordContent}>
          <Text style={styles.recordStudentName} numberOfLines={1}>
            {item.studentName}
          </Text>
          <Text style={styles.recordClass}>{item.className}</Text>
          <View style={styles.recordDetails}>
            <View style={styles.recordFeeItem}>
              <SVGIcon name="restaurant" size={14} color={VIBE.success} />
              <Text style={styles.recordFeeText}>₵{item.feedingFee}</Text>
            </View>
          </View>
          <View style={styles.recordTotal}>
            <Text style={styles.recordTotalLabel}>Total:</Text>
            <Text style={[styles.recordTotalValue, { color: VIBE.primary }]}>
              ₵{item.total.toFixed(2)}
            </Text>
          </View>
        </View>
        <View style={styles.recordMeta}>
          <Text style={styles.recordRecordedBy}>{item.recordedBy}</Text>
        </View>
      </View>
    </Animatable.View>
  );

  if (!canView) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.errorContainer}>
          <SVGIcon
            name="lock-closed"
            size={60}
            color={COLORS.secondary || "#c53b59"}
          />
          <Text style={styles.errorTitle}>Access Denied</Text>
          <Text style={styles.errorSub}>
            You do not have the required permissions to view feeding fees.
          </Text>
          <TouchableOpacity style={styles.errorButton} onPress={handleBack}>
            <Text style={styles.errorButtonText}>Back to Daily Financials</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <SVGIcon name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.headerTitleText}>Feeding Fees</Text>
          <Text style={styles.headerSubtitle}>Record daily meal fees</Text>
        </View>
        <View style={styles.dateNavContainer}>
          <TouchableOpacity
            onPress={() => changeDate(-1)}
            style={styles.dateNavButton}
          >
            <SVGIcon name="chevron-back" size={18} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            style={styles.dateButton}
          >
            <SVGIcon name="calendar" size={20} color={COLORS.primary} />
            <Text style={styles.dateButtonText}>
              {moment(selectedDate).format("MMM DD, YYYY")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => changeDate(1)}
            style={styles.dateNavButton}
          >
            <SVGIcon name="chevron-forward" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Past Date Banner */}
      {isPastDate && (
        <View style={styles.pastDateBanner}>
          <SVGIcon name="eye-outline" size={18} color={VIBE.muted} />
          <Text style={styles.pastDateBannerText}>
            View Only Mode (Historical Record)
          </Text>
        </View>
      )}

      {showDatePicker && DateTimePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event: any, date?: Date) => {
            setShowDatePicker(false);
            if (date) setSelectedDate(date);
          }}
        />
      )}

      {/* Tabs */}
      <View style={styles.tabBar}>
        {(["record", "history", "reports"] as TabType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tab,
              activeTab === tab && { backgroundColor: COLORS.primary + "10" },
            ]}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab && {
                  color: COLORS.primary,
                  fontWeight: "700",
                },
              ]}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <>
          {activeTab === "record" && (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => setRefreshing(false)}
                />
              }
            >
              {/* Statistics */}
              <View style={styles.statsRow}>
                {renderStatsCard(
                  "Total Feeding Collected",
                  stats.totalFeeding,
                  "restaurant",
                  VIBE.success,
                )}
                {renderStatsCard(
                  "Students Paid",
                  stats.recordsCount,
                  "people",
                  VIBE.primary,
                  false,
                )}
              </View>

              {/* Filters */}
              <View style={styles.filterSection}>
                <View style={styles.searchBar}>
                  <SVGIcon name="search" size={20} color={VIBE.muted} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search students..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholderTextColor={VIBE.muted}
                  />
                  {searchQuery !== "" && (
                    <TouchableOpacity onPress={() => setSearchQuery("")}>
                      <SVGIcon
                        name="close-circle"
                        size={18}
                        color={VIBE.muted}
                      />
                    </TouchableOpacity>
                  )}
                </View>


                <View style={styles.pickerContainer}>
                  <Text style={styles.pickerLabel}>Select Class</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 4 }}
                  >
                    {isSuperAdmin && (
                      <TouchableOpacity
                        style={[
                          styles.classChip,
                          selectedClassId === "all" && styles.classChipActive,
                        ]}
                        onPress={() => setSelectedClassId("all")}
                      >
                        <Text
                          style={[
                            styles.classChipText,
                            selectedClassId === "all" &&
                              styles.classChipTextActive,
                          ]}
                        >
                          All Classes
                        </Text>
                      </TouchableOpacity>
                    )}
                    {(isSuperAdmin
                      ? classes
                      : classes.filter((c) => teacherClasses.includes(c.id))
                    ).map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        style={[
                          styles.classChip,
                          selectedClassId === c.id && styles.classChipActive,
                        ]}
                        onPress={() => setSelectedClassId(c.id)}
                      >
                        <Text
                          style={[
                            styles.classChipText,
                            selectedClassId === c.id &&
                              styles.classChipTextActive,
                          ]}
                        >
                          {c.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              {/* Recording Form */}
              <View style={styles.formSection}>
                <View style={styles.formHeader}>
                  <View>
                    <Text style={styles.formTitle}>Daily Billing</Text>
                    <Text style={styles.formSubtitle}>
                      Manage rates and record for students
                    </Text>
                  </View>
                  <View style={styles.rateInfo}>
                    <Text style={styles.rateLabel}>Current Rate:</Text>
                    <Text style={styles.rateValue}>₵{currentClassRate}</Text>
                  </View>
                </View>

                {/* Rate Management (Super Admin only) */}
                {isSuperAdmin && selectedClassId !== "all" && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>
                      Set Default Rate for{" "}
                      {classes.find((c) => c.id === selectedClassId)?.name} (₵)
                    </Text>
                    <View style={styles.amountInputContainer}>
                      <SVGIcon name="cash" size={20} color={VIBE.secondary} />
                      <TextInput
                        style={styles.amountInput}
                        placeholder="0.00"
                        value={feedingAmount}
                        onChangeText={setFeedingAmount}
                        keyboardType="numeric"
                        placeholderTextColor={VIBE.muted}
                      />
                      <TouchableOpacity
                        style={[
                          styles.miniBtn,
                          { backgroundColor: VIBE.secondary },
                        ]}
                        onPress={handleSaveClassRate}
                        disabled={saving}
                      >
                        <Text style={styles.miniBtnText}>Update</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Student List */}
                <View style={styles.studentListHeader}>
                  <Text style={styles.studentListTitle}>Students List</Text>
                  <Text style={styles.studentCount}>
                    {filteredStudents.length} Students
                  </Text>
                </View>

                {filteredStudents.length > 0 ? (
                  filteredStudents.map((item) => {
                    const existingRecord = getExistingRecord(item.uid);
                    const isPaid = existingRecord?.feedingPaid === true;
                    const isAbsent =
                      attendanceMap[item.uid]?.status === "absent";

                    return (
                      <View
                        key={item.uid}
                        style={[
                          styles.studentCard,
                          isPaid && styles.studentCardPaid,
                          isAbsent && styles.studentCardAbsent,
                        ]}
                      >
                        <View style={styles.studentCardMain}>
                          <View
                            style={[
                              styles.studentAvatar,
                              isPaid && {
                                backgroundColor: VIBE.success + "20",
                              },
                              isAbsent && {
                                backgroundColor: VIBE.danger + "10",
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.studentAvatarText,
                                isPaid && { color: VIBE.success },
                                isAbsent && { color: VIBE.danger },
                              ]}
                            >
                              {item.fullName.charAt(0)}
                            </Text>
                          </View>
                          <View style={styles.studentInfo}>
                            <View style={styles.studentNameRow}>
                              <Text
                                style={styles.studentName}
                                numberOfLines={1}
                              >
                                {item.fullName}
                              </Text>
                            </View>
                            <View style={styles.studentMetaRow}>
                              <Text style={styles.studentClass}>
                                {item.className}
                              </Text>
                              {isAbsent ? (
                                <View
                                  style={[
                                    styles.statusBadge,
                                    { backgroundColor: VIBE.danger + "15" },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.statusBadgeText,
                                      { color: VIBE.danger },
                                    ]}
                                  >
                                    Absent
                                  </Text>
                                </View>
                              ) : existingRecord &&
                                (existingRecord.feedingFee || 0) > 0 ? (
                                <View
                                  style={[
                                    styles.statusBadge,
                                    {
                                      backgroundColor: isPaid
                                        ? VIBE.success + "15"
                                        : VIBE.secondary + "15",
                                    },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.statusBadgeText,
                                      {
                                        color: isPaid
                                          ? VIBE.success
                                          : VIBE.secondary,
                                      },
                                    ]}
                                  >
                                    {isPaid ? "Paid" : "Recorded"}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          </View>
                        </View>

                        <View style={styles.studentActions}>
                          <TouchableOpacity
                            style={[
                              styles.actionBtn,
                              styles.actionBtnPaid,
                              isPaid && styles.actionBtnActivePaid,
                              (!canEdit || isAbsent) && { opacity: 0.5 },
                            ]}
                            onPress={async () => {
                              if (!canEdit) return;
                              if (isAbsent) {
                                showToast({
                                  message: "Student is absent.",
                                  type: "error",
                                });
                                return;
                              }
                              const override = overrideMap[item.uid];
                              await markStudentPaid(item.uid, override);
                              setOverrideMap((m) => ({
                                ...m,
                                [item.uid]: undefined,
                              }));
                            }}
                            onLongPress={() => {
                              if (!canEdit) return;
                              setOverrideMap((m) => ({
                                ...m,
                                [item.uid]: m[item.uid] ? undefined : "",
                              }));
                            }}
                            disabled={!canEdit}
                          >
                            <SVGIcon
                              name="checkmark"
                              size={18}
                              color={isPaid ? "#fff" : VIBE.success}
                            />
                            <Text
                              style={[
                                styles.actionBtnText,
                                { color: isPaid ? "#fff" : VIBE.success },
                              ]}
                            >
                              Paid
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.actionBtn,
                              styles.actionBtnUnpaid,
                              existingRecord &&
                                (existingRecord.feedingFee || 0) > 0 &&
                                !isPaid &&
                                styles.actionBtnActiveUnpaid,
                              (!canEdit || isAbsent) && { opacity: 0.5 },
                            ]}
                            onPress={async () => {
                              if (!canEdit) return;
                              if (isAbsent) {
                                showToast({
                                  message: "Student is absent.",
                                  type: "error",
                                });
                                return;
                              }
                              await markStudentNotPaid(item.uid);
                            }}
                            disabled={!canEdit}
                          >
                            <SVGIcon
                              name="close"
                              size={18}
                              color={
                                existingRecord &&
                                (existingRecord.feedingFee || 0) > 0 &&
                                !isPaid
                                  ? "#fff"
                                  : VIBE.danger
                              }
                            />
                            <Text
                              style={[
                                styles.actionBtnText,
                                {
                                  color:
                                    existingRecord &&
                                    (existingRecord.feedingFee || 0) > 0 &&
                                    !isPaid
                                      ? "#fff"
                                      : VIBE.danger,
                                },
                              ]}
                            >
                              Unpaid
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {overrideMap[item.uid] !== undefined && (
                          <View style={styles.overrideContainer}>
                            <TextInput
                              value={overrideMap[item.uid]}
                              onChangeText={(val) =>
                                setOverrideMap((m) => ({
                                  ...m,
                                  [item.uid]: val,
                                }))
                              }
                              placeholder="Override amount (₵)"
                              keyboardType="numeric"
                              style={styles.overrideInput}
                              autoFocus
                            />
                          </View>
                        )}
                      </View>
                    );
                  })
                ) : (
                  <View style={styles.emptyResults}>
                    <SVGIcon name="search" size={32} color={VIBE.muted} />
                    <Text style={styles.emptyResultsText}>
                      No students found
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>
          )}

          {activeTab === "history" && (
            <View style={{ flex: 1 }}>
              {/* Statistics Summary for History */}
              <View style={[styles.statsRow, { paddingBottom: 8 }]}>
                {renderStatsCard(
                  "Day Total",
                  stats.totalFeeding,
                  "restaurant",
                  VIBE.success,
                )}
                {renderStatsCard(
                  "Records",
                  stats.recordsCount,
                  "people",
                  VIBE.primary,
                  false,
                )}
              </View>

              <FlatList
                data={dailyRecords.filter((r) => (r.feedingFee || 0) > 0)}
                keyExtractor={(item) => item.id}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => setRefreshing(false)}
                  />
                }
                renderItem={renderRecordItem}
                contentContainerStyle={{ padding: 16, paddingTop: 8 }}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <SVGIcon
                      name="document-text-outline"
                      size={48}
                      color={VIBE.muted}
                    />
                    <Text style={styles.emptyText}>
                      No records for this date
                    </Text>
                  </View>
                }
              />
            </View>
          )}

          {activeTab === "reports" && (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 16 }}
            >
              <View style={styles.reportCard}>
                <Text style={styles.reportTitle}>Feeding Fees Summary</Text>
                <Text style={styles.reportDate}>
                  {moment(selectedDate).format("MMMM DD, YYYY")}
                </Text>

                <View style={styles.reportStats}>
                  <View style={styles.reportRow}>
                    <Text style={styles.reportLabel}>
                      Total Feeding Collected
                    </Text>
                    <Text style={[styles.reportValue, { color: VIBE.success }]}>
                      ₵{stats.totalFeeding.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.reportRow}>
                    <Text style={styles.reportLabel}>Students Paid</Text>
                    <Text style={[styles.reportValue, { color: VIBE.primary }]}>
                      {stats.recordsCount}
                    </Text>
                  </View>
                </View>

                <View style={styles.reportMeta}>
                  <Text style={styles.reportMetaText}>
                    Class:{" "}
                    {selectedClassId === "all"
                      ? teacherClasses.length > 0 && !isSuperAdmin
                        ? "Assigned Classes"
                        : "All Classes"
                      : classes.find((c) => c.id === selectedClassId)?.name ||
                        "Unknown"}
                  </Text>
                </View>
              </View>
            </ScrollView>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VIBE.bg },
  centerContent: { flex: 1, justifyContent: "center", alignItems: "center" },
  centerText: { marginTop: 16, color: VIBE.muted, fontSize: 16 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: VIBE.surface,
    borderBottomWidth: 1,
    borderBottomColor: VIBE.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: VIBE.bg,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  headerTitle: { flex: 1 },
  headerTitleText: { fontSize: 20, fontWeight: "900", color: VIBE.text },
  headerSubtitle: { fontSize: 13, color: VIBE.muted, marginTop: 1 },
  dateNavContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 8,
  },
  dateNavButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: VIBE.primary + "10",
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: VIBE.primary + "10",
    borderRadius: 12,
    gap: 6,
  },
  dateButtonText: { fontSize: 13, fontWeight: "700", color: VIBE.primary },

  // Tabs
  tabBar: {
    flexDirection: "row",
    backgroundColor: VIBE.surface,
    paddingHorizontal: 16,
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: VIBE.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 10,
    backgroundColor: VIBE.bg,
  },
  tabText: { fontSize: 13, fontWeight: "600", color: VIBE.muted },

  // Stats
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    padding: 16,
  },
  statsCard: {
    flex: 1,
    minWidth: width < 380 ? "100%" : 150,
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 20,
    borderLeftWidth: 5,
    backgroundColor: VIBE.surface,
    ...SHADOWS.small,
  },
  statsIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  statsInfo: { flex: 1 },
  statsLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: VIBE.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statsValue: {
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2,
  },

  // Filters
  filterSection: { paddingHorizontal: 16, paddingBottom: 16 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: VIBE.surface,
    paddingHorizontal: 16,
    borderRadius: 16,
    height: 48,
    borderWidth: 1,
    borderColor: VIBE.border,
    ...SHADOWS.small,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: VIBE.text,
    fontWeight: "500",
  },
  arrearsFilterRow: {
    flexDirection: "row",
    marginTop: 12,
  },
  arrearsToggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: VIBE.surface,
    borderWidth: 1,
    borderColor: VIBE.border,
    gap: 8,
  },
  arrearsToggleActive: {
    backgroundColor: VIBE.secondary,
    borderColor: VIBE.secondary,
  },
  arrearsToggleText: {
    fontSize: 12,
    fontWeight: "700",
    color: VIBE.muted,
  },
  arrearsToggleTextActive: {
    color: "#fff",
  },
  pickerContainer: { marginTop: 16 },
  pickerLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: VIBE.text,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  classChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: VIBE.surface,
    marginRight: 8,
    borderWidth: 1,
    borderColor: VIBE.border,
  },
  classChipActive: {
    backgroundColor: VIBE.primary,
    borderColor: VIBE.primary,
  },
  classChipText: { fontSize: 13, fontWeight: "600", color: VIBE.muted },
  classChipTextActive: { color: "#fff" },

  // Form Section
  formSection: {
    backgroundColor: VIBE.surface,
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: VIBE.border,
    ...SHADOWS.medium,
  },
  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  formTitle: { fontSize: 18, fontWeight: "900", color: VIBE.text },
  formSubtitle: { fontSize: 13, color: VIBE.muted, marginTop: 2 },
  rateInfo: {
    backgroundColor: VIBE.bg,
    padding: 8,
    borderRadius: 10,
    alignItems: "flex-end",
  },
  rateLabel: { fontSize: 10, fontWeight: "700", color: VIBE.muted },
  rateValue: { fontSize: 14, fontWeight: "800", color: VIBE.primary },

  // Input Group
  inputGroup: { marginBottom: 20 },
  inputLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: VIBE.text,
    marginBottom: 8,
  },
  amountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: VIBE.bg,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 52,
    borderWidth: 1,
    borderColor: VIBE.border,
  },
  amountInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: VIBE.text,
    fontWeight: "700",
  },
  miniBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  miniBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },

  // Student List
  studentListHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: VIBE.border,
  },
  studentListTitle: { fontSize: 15, fontWeight: "800", color: VIBE.text },
  studentCount: { fontSize: 12, fontWeight: "600", color: VIBE.muted },

  studentCard: {
    backgroundColor: VIBE.surface,
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: VIBE.border,
    ...SHADOWS.small,
  },
  studentCardPaid: {
    borderColor: VIBE.success + "40",
    backgroundColor: VIBE.success + "05",
  },
  studentCardAbsent: {
    opacity: 0.8,
    backgroundColor: VIBE.bg,
  },
  studentCardMain: {
    flexDirection: "row",
    alignItems: "center",
  },
  studentAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: VIBE.primary + "10",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  studentAvatarText: { fontSize: 18, fontWeight: "900", color: VIBE.primary },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 15, fontWeight: "700", color: VIBE.text, flex: 1 },
  studentNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  arrearsBadge: {
    backgroundColor: VIBE.danger + "10",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: VIBE.danger + "30",
  },
  arrearsText: { fontSize: 10, fontWeight: "800", color: VIBE.danger },
  studentMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 8,
  },
  studentClass: { fontSize: 12, color: VIBE.muted, fontWeight: "500" },

  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  studentActions: {
    flexDirection: "row",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: VIBE.border,
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
  },
  actionBtnPaid: { borderColor: VIBE.success, backgroundColor: "#fff" },
  actionBtnUnpaid: { borderColor: VIBE.danger, backgroundColor: "#fff" },
  actionBtnActivePaid: { backgroundColor: VIBE.success },
  actionBtnActiveUnpaid: { backgroundColor: VIBE.danger },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  overrideContainer: { marginTop: 12 },
  overrideInput: {
    backgroundColor: VIBE.bg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: VIBE.text,
    borderWidth: 1,
    borderColor: VIBE.primary + "40",
    fontWeight: "600",
  },

  emptyResults: { alignItems: "center", padding: 20 },
  emptyResultsText: { marginTop: 8, color: VIBE.muted, fontSize: 14 },

  // Save Button
  saveButton: {
    flexDirection: "row",
    backgroundColor: VIBE.primary,
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    gap: 10,
    ...SHADOWS.medium,
  },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  // Record Item
  recordCard: {
    flexDirection: "row",
    backgroundColor: VIBE.surface,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: VIBE.border,
    ...SHADOWS.small,
  },
  recordStatus: {
    width: 6,
    borderRadius: 3,
    marginRight: 16,
    alignSelf: "stretch",
  },
  recordContent: { flex: 1 },
  recordStudentName: { fontSize: 16, fontWeight: "800", color: VIBE.text },
  recordClass: {
    fontSize: 13,
    color: VIBE.muted,
    marginTop: 2,
    fontWeight: "500",
  },
  recordDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  recordFeeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: VIBE.bg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  recordFeeText: { fontSize: 13, fontWeight: "700", color: VIBE.text },
  recordTotal: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: VIBE.border,
  },
  recordTotalLabel: { fontSize: 13, fontWeight: "600", color: VIBE.muted },
  recordTotalValue: { fontSize: 18, fontWeight: "900", marginLeft: 4 },
  recordMeta: {
    justifyContent: "center",
    paddingLeft: 12,
    alignItems: "flex-end",
  },
  recordRecordedBy: {
    fontSize: 10,
    color: VIBE.muted,
    fontWeight: "700",
    textTransform: "uppercase",
  },

  // Empty State
  emptyState: { alignItems: "center", padding: 60 },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: VIBE.muted,
    fontWeight: "700",
  },

  // Report Card
  reportCard: {
    backgroundColor: VIBE.surface,
    borderRadius: 24,
    padding: width < 380 ? 16 : 24,
    borderWidth: 1,
    borderColor: VIBE.border,
    ...SHADOWS.medium,
  },
  reportTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: VIBE.text,
    textAlign: "center",
  },
  reportDate: {
    fontSize: 15,
    color: VIBE.muted,
    textAlign: "center",
    marginTop: 6,
    fontWeight: "600",
  },
  reportStats: { marginTop: 24, gap: 16 },
  reportRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: VIBE.border,
    gap: 12,
  },
  reportLabel: { flex: 1, fontSize: 14, color: VIBE.muted, fontWeight: "600" },
  reportValue: { fontSize: 16, fontWeight: "900", color: VIBE.text },
  reportMeta: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: VIBE.border,
  },
  reportMetaText: {
    fontSize: 13,
    color: VIBE.muted,
    textAlign: "center",
    fontWeight: "600",
  },
  pastDateBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: VIBE.border,
    paddingVertical: 6,
    gap: 8,
  },
  pastDateBannerText: {
    fontSize: 12,
    fontWeight: "700",
    color: VIBE.muted,
    textTransform: "uppercase",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1E293B",
    marginTop: 20,
  },
  errorSub: {
    fontSize: 16,
    color: "#64748B",
    textAlign: "center",
    marginTop: 10,
    marginBottom: 30,
  },
  errorButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 25,
    paddingVertical: 15,
    borderRadius: 15,
    ...SHADOWS.medium,
  },
  errorButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
});
