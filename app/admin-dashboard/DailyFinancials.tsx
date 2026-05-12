import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import moment from "moment";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Swipeable, RectButton } from "react-native-gesture-handler";
import * as Animatable from "react-native-animatable";
import { SafeAreaView } from "react-native-safe-area-context";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { db } from "../../firebaseConfig";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";
import { sortClasses } from "../../lib/classHelpers";
import { getDocsCacheFirst } from "../../lib/firestoreHelpers";

const { width } = Dimensions.get("window");

const VIBE = {
  primary: "#6366F1",
  success: "#10B981",
  danger: "#EF4444",
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  text: "#1E293B",
  muted: "#64748B",
  border: "#E2E8F0",
};

const OTHER_CATEGORIES = [
  "Admission",
  "Books fee",
  "Uniform",
  "PTA Dues",
  "Boarding Fee",
  "Other",
];

type Student = {
  uid: string;
  fullName: string;
  classId: string;
  className: string;
  takesBus: boolean;
  isFeeding: boolean;
  takesExtraClasses: boolean;
  busLocation?: string;
  walletBalance: number;
  paidToday?: boolean;
  isAbsent?: boolean;
  paymentDocId?: string;
  otherPaymentsCount?: number;
};

type AggregateData = {
  day: number;
  week: number;
  month: number;
};

export default function DailyFinancials() {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const acadConfig = useAcademicConfig();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"summary" | "feeding" | "bus" | "extra" | "other">("summary");
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("all");

  const [selectedDate, setSelectedDate] = useState(moment().format("YYYY-MM-DD"));
  const [paymentAmount, setPaymentAmount] = useState("");
  const [feedingRate, setFeedingRate] = useState<number>(0);
  const [extraClassesRate, setExtraClassesRate] = useState<number>(0);
  const [otherChargeName, setOtherChargeName] = useState("");
  const [otherPaymentRef, setOtherPaymentRef] = useState("");
  const [selectedOtherCategory, setSelectedOtherCategory] = useState<string>("Admission");
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudentForOther, setSelectedStudentForOther] = useState<Student | null>(null);
  const [editOtherModal, setEditOtherModal] = useState<{ visible: boolean; student: Student | null }>({
    visible: false,
    student: null,
  });
  const [loadingUids, setLoadingUids] = useState<Set<string>>(new Set());

  // Bus specific
  const [busLocations, setBusLocations] = useState<string[]>([]);
  const [busRates, setBusRates] = useState<Record<string, number>>({});
  const [selectedLocation, setSelectedLocation] = useState<string>("all");

  // Aggregates & Prepayment
  const [aggregates, setAggregates] = useState<AggregateData>({ day: 0, week: 0, month: 0 });
  const [globalAggregates, setGlobalAggregates] = useState<AggregateData>({ day: 0, week: 0, month: 0 });
  const [expenditureAggregates, setExpenditureAggregates] = useState<AggregateData>({ day: 0, week: 0, month: 0 });
  const [revenueBreakdown, setRevenueBreakdown] = useState<Record<string, number>>({});
  const [showGlobalSummary, setShowGlobalSummary] = useState(false);
  const [prepaymentModal, setPrepaymentModal] = useState<{ visible: boolean; student: Student | null }>({
    visible: false,
    student: null,
  });
  const [prepayAmount, setPrepayAmount] = useState("");

  // Permissions & Audit
  const isTeacherRole = appUser?.role?.toLowerCase() === "teacher";
  const isAdmin = (appUser?.role?.toLowerCase() === "admin" || !!appUser?.adminRole);
  const isSuperAdmin = [
    "proprietor",
    "proprietress",
    "manager",
    "headmaster",
    "headmistress",
    "administrator",
    "director",
  ].includes(appUser?.adminRole?.toLowerCase() || "");
  const adminName = `${appUser?.profile?.firstName || ''} ${appUser?.profile?.lastName || ''}`.trim() || "Admin";
  const updatedBy = `${adminName} (${appUser?.adminRole || appUser?.role || 'Staff'})`;
  const isToday = selectedDate === moment().format("YYYY-MM-DD");

  const tabColors: Record<string, { primary: string, secondary: string }> = {
    summary: { primary: "#6366F1", secondary: "#4F46E5" },
    feeding: { primary: "#F59E0B", secondary: "#D97706" }, // Amber
    bus: { primary: "#3B82F6", secondary: "#2563EB" },    // Blue
    extra: { primary: "#8B5CF6", secondary: "#7C3AED" },  // Violet
    other: { primary: "#10B981", secondary: "#059669" },  // Emerald
  };

  const activeColor = (tabColors[activeTab] || { primary: VIBE.primary }).primary;
  const secondaryColor = (tabColors[activeTab] || { secondary: "#4F46E5" }).secondary;

  const canFeeding = isSuperAdmin || appUser?.permissions?.["feeding"] === "full" || appUser?.permissions?.["feeding"] === "edit";
  const canBus = isSuperAdmin || appUser?.permissions?.["record-bus-fee"] === "full" || appUser?.permissions?.["record-bus-fee"] === "edit";
  // Support both old and new permission keys during transition
  const canExtraClasses = isSuperAdmin ||
    appUser?.permissions?.["record-extra-classes"] === "full" || appUser?.permissions?.["record-extra-classes"] === "edit" ||
    appUser?.permissions?.["record-class-fee"] === "full" || appUser?.permissions?.["record-class-fee"] === "edit";

  const canManageSales = isSuperAdmin || appUser?.permissions?.["manage-sales"] === "full" || appUser?.permissions?.["manage-sales"] === "edit";

  const canEditFeedingRate = isSuperAdmin || appUser?.permissions?.["edit-feeding-rate"] === "edit";
  const canEditBusRate = isSuperAdmin || appUser?.permissions?.["edit-bus-rate"] === "edit";
  const canEditExtraClassesRate = isSuperAdmin ||
    appUser?.permissions?.["edit-extra-classes-rate"] === "edit" ||
    appUser?.permissions?.["edit-class-fee-rate"] === "edit";

  const canViewSummary = isSuperAdmin || appUser?.permissions?.["financial-summary"] === "view" || appUser?.permissions?.["financial-summary"] === "full";

  useEffect(() => {
    if (!isAdmin && !canFeeding && !canBus && !canExtraClasses && !canManageSales) {
      showToast({ message: "Access Denied: You do not have permission to view financials.", type: "error" });
      router.back();
    }
  }, [canFeeding, canBus, canExtraClasses, canManageSales, isAdmin]);

  useEffect(() => {
    if (!canViewSummary && activeTab === "summary") {
      if (canFeeding) setActiveTab("feeding");
      else if (canBus) setActiveTab("bus");
      else if (canExtraClasses) setActiveTab("extra");
      else if (canManageSales) setActiveTab("other");
    }
  }, [canViewSummary, canFeeding, canBus, canExtraClasses, canManageSales, activeTab]);

  const fetchBusRates = async () => {
    try {
      const docRef = doc(db, "school_settings", "bus_rates");
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setBusRates(snap.data() as Record<string, number>);
      }

      // Also fetch feeding rate and class fee rate
      const configRef = doc(db, "school_settings", "academic_config");
      const configSnap = await getDoc(configRef);
      if (configSnap.exists()) {
        const configData = configSnap.data();
        const fRate = configData.feedingRate || 0;
        const eRate = configData.extraClassesRate || 0;
        setFeedingRate(fRate);
        setExtraClassesRate(eRate);

        if (activeTab === "feeding") {
          setPaymentAmount(fRate.toString());
        } else if (activeTab === "extra") {
          setPaymentAmount(eRate.toString());
        }
      }
    } catch (e) {
      console.error("Error fetching rates:", e);
    }
  };

  const updateFeedingRate = async (amount: string) => {
    if (!canEditFeedingRate) return;
    setPaymentAmount(amount); // Optimistic update
    const val = parseFloat(amount);
    if (isNaN(val)) return;

    try {
      const docRef = doc(db, "school_settings", "academic_config");
      await setDoc(docRef, { feedingRate: val }, { merge: true });
      setFeedingRate(val);
      showToast({ message: "Feeding rate updated", type: "success" });
    } catch (e) {
      console.error(e);
      showToast({ message: "Failed to update feeding rate", type: "error" });
    }
  };

  const updateExtraClassesRate = async (amount: string) => {
    if (!canEditExtraClassesRate) return;
    setPaymentAmount(amount); // Optimistic update
    const val = parseFloat(amount);
    if (isNaN(val)) return;

    try {
      const docRef = doc(db, "school_settings", "academic_config");
      await setDoc(docRef, { extraClassesRate: val }, { merge: true });
      setExtraClassesRate(val);
      showToast({ message: "Extra classes rate updated", type: "success" });
    } catch (e) {
      console.error(e);
      showToast({ message: "Failed to update extra classes rate", type: "error" });
    }
  };

  const updateBusRate = async (location: string, amount: string) => {
    if (!canEditBusRate || location === "all") return;

    const val = parseFloat(amount);
    // Optimistic update
    setBusRates(prev => ({ ...prev, [location]: isNaN(val) ? 0 : val }));

    if (isNaN(val)) return;

    try {
      const docRef = doc(db, "school_settings", "bus_rates");
      await setDoc(docRef, { [location]: val }, { merge: true });
      showToast({ message: "Rate updated", type: "success" });
    } catch (e) {
      console.error(e);
      showToast({ message: "Failed to update rate", type: "error" });
    }
  };

  const fetchClasses = async () => {
    try {
      const snap = await getDocsCacheFirst(collection(db, "classes") as any);
      const list = snap.docs.map((d) => ({
        id: d.id,
        name: (d.data() as any).name || d.id,
      }));
      setClasses(sortClasses(list));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAggregates = async (type: string) => {
    try {
      const today = selectedDate;
      const startOfWeek = moment(selectedDate).startOf("isoWeek").format("YYYY-MM-DD");
      const startOfMonth = moment(selectedDate).startOf("month").format("YYYY-MM-DD");

      if (type === "summary") {
        // Fetch ALL revenue for the month
        const revQ = query(collection(db, "feePayments"), where("date", ">=", startOfMonth));
        const revSnap = await getDocs(revQ);

        let rD = 0, rW = 0, rM = 0;
        let breakdown: Record<string, number> = { tuition: 0, feeding: 0, bus: 0, extra: 0, other: 0 };

        revSnap.forEach(d => {
          const data = d.data();
          if (data.method === "Credit Deduction") return;
          const amt = data.amount || 0;
          const date = data.date;
          const t = data.type || "other";

          if (date === today) {
            rD += amt;
            breakdown[t] = (breakdown[t] || 0) + amt;
          }
          if (date >= startOfWeek) rW += amt;
          rM += amt;
        });

        setGlobalAggregates({ day: rD, week: rW, month: rM });
        setAggregates({ day: rD, week: rW, month: rM });
        setRevenueBreakdown(breakdown);

        // Fetch expenditures
        const expQ = query(collection(db, "expenditures"), where("date", ">=", startOfMonth));
        const expSnap = await getDocs(expQ);
        let eD = 0, eW = 0, eM = 0;
        expSnap.forEach(d => {
          const data = d.data();
          const amt = data.amount || 0;
          const date = data.date;
          if (date === today) eD += amt;
          if (date >= startOfWeek) eW += amt;
          eM += amt;
        });
        setExpenditureAggregates({ day: eD, week: eW, month: eM });
        return;
      }

      const q = query(
        collection(db, "feePayments"),
        where("type", "==", type),
        where("date", ">=", startOfMonth)
      );

      const snap = await getDocs(q);
      let dayTotal = 0;
      let weekTotal = 0;
      let monthTotal = 0;

      const standardCategories = ["Admission", "Books fee", "Uniform", "PTA Dues", "Boarding Fee"];

      snap.forEach((doc) => {
        const data = doc.data();
        if (data.method === "Credit Deduction") return;

        if (type === "other") {
          if (selectedOtherCategory === "Other") {
            if (standardCategories.includes(data.description)) return;
          } else {
            if (data.description !== selectedOtherCategory) return;
          }
        }

        const amount = data.amount || 0;
        const date = data.date;

        if (date === today) dayTotal += amount;
        if (date >= startOfWeek) weekTotal += amount;
        if (date >= startOfMonth) monthTotal += amount;
      });

      setAggregates({ day: dayTotal, week: weekTotal, month: monthTotal });
    } catch (e) {
      console.error("Error fetching aggregates:", e);
    }
  };

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === "summary") {
        await fetchAggregates("summary");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      let q = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("status", "in", ["active", "pending_activation"])
      );

      const snap = await getDocs(q);

      // Fetch target date's feeding and class fee payments
      const targetDate = selectedDate;
      const pq = query(
        collection(db, "feePayments"),
        where("date", "==", targetDate),
        where("type", "in", ["feeding", "extra", "bus", "other"])
      );
      const pSnap = await getDocs(pq);
      const paidFeedingMap = new Map<string, string>();
      const paidExtraMap = new Map<string, string>();
      const paidBusMap = new Map<string, string>();
      const paidOtherMap = new Map<string, { id: string; description: string }[]>(); // Map studentUid to array of payment objects

      pSnap.docs.forEach(d => {
        const data = d.data();
        if (data.type === "feeding") paidFeedingMap.set(data.studentUid, d.id);
        if (data.type === "extra") paidExtraMap.set(data.studentUid, d.id);
        if (data.type === "bus") paidBusMap.set(data.studentUid, d.id);
        if (data.type === "other") {
          const existing = paidOtherMap.get(data.studentUid) || [];
          paidOtherMap.set(data.studentUid, [...existing, { id: d.id, description: data.description || "" }]);
        }
      });

      // Fetch target date's attendance to mark absent students
      const attendanceQuery = query(
        collection(db, "attendance"),
        where("date", "==", targetDate)
      );
      const aSnap = await getDocs(attendanceQuery);
      const absentUids = new Set();
      aSnap.forEach(doc => {
        const data = doc.data();
        Object.keys(data.students || {}).forEach(sUid => {
          if (data.students[sUid].status === "absent") {
            absentUids.add(sUid);
          }
        });
      });

      const list = snap.docs.map((d) => {
        const data = d.data() as any;
        const uid = d.id;
        let isPaid = false;
        let paymentDocId = undefined;
        let otherPaymentsCount = 0;

        if (activeTab === "feeding") {
          isPaid = paidFeedingMap.has(uid);
          paymentDocId = paidFeedingMap.get(uid);
        } else if (activeTab === "extra") {
          isPaid = paidExtraMap.has(uid);
          paymentDocId = paidExtraMap.get(uid);
        } else if (activeTab === "bus") {
          isPaid = paidBusMap.has(uid);
          paymentDocId = paidBusMap.get(uid);
        } else if (activeTab === "other") {
          const others = paidOtherMap.get(uid) || [];
          const standardCategories = ["Admission", "Books fee", "Uniform", "PTA Dues", "Boarding Fee"];

          const matchingOthers = others.filter(o => {
            if (selectedOtherCategory === "Other") {
              return !standardCategories.includes(o.description);
            }
            return o.description === selectedOtherCategory;
          });

          isPaid = matchingOthers.length > 0;
          paymentDocId = matchingOthers[0]?.id;
          otherPaymentsCount = matchingOthers.length;
        }

        return {
          uid,
          fullName: `${data.profile?.firstName || ""} ${data.profile?.lastName || ""}`.trim(),
          classId: data.classId || "",
          className: "", // Will fill below
          takesBus: !!data.takesBus,
          isFeeding: !!data.isFeeding,
          takesExtraClasses: !!data.takesExtraClasses,
          busLocation: data.busLocation || "",
          walletBalance: data.walletBalance || 0,
          paidToday: isPaid,
          paymentDocId,
          otherPaymentsCount,
          isAbsent: absentUids.has(uid),
        };
      });

      // deduplicate by uid to prevent UI glitches if Firebase returns redundant docs
      const uniqueList = Array.from(new Map(list.map(s => [s.uid, s])).values());
      setStudents(uniqueList);

      const locations = Array.from(new Set(list.filter(s => s.takesBus && s.busLocation).map(s => s.busLocation as string))).sort();
      setBusLocations(locations);

      if (activeTab === "feeding" || activeTab === "bus" || activeTab === "extra" || activeTab === "other") {
        fetchAggregates(activeTab);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, selectedDate, selectedOtherCategory]);

  useEffect(() => {
    fetchClasses();
    fetchBusRates();
    fetchStudents();
  }, [fetchStudents]);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (activeTab === "bus") {
        const matchesLocation = selectedLocation === "all" || s.busLocation === selectedLocation;
        return s.takesBus && matchesLocation;
      }

      if (activeTab === "feeding") {
        const matchesClass = selectedClassId === "all" || s.classId === selectedClassId;
        return s.isFeeding && matchesClass;
      }

      if (activeTab === "extra") {
        const matchesClass = selectedClassId === "all" || s.classId === selectedClassId;
        return s.takesExtraClasses && matchesClass;
      }

      if (activeTab === "other") {
        // In "Other" tab, only show students who have recorded payments for this date,
        // OR the specifically selected student from search
        const hasPayment = s.paidToday;
        const matchesSearch = searchQuery.length > 2 && s.fullName.toLowerCase().includes(searchQuery.toLowerCase());
        const isSelected = selectedStudentForOther?.uid === s.uid;
        return hasPayment || matchesSearch || isSelected;
      }

      const matchesClass = selectedClassId === "all" || s.classId === selectedClassId;
      const matchesSearch = !searchQuery || s.fullName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesClass && matchesSearch;
    });
  }, [students, selectedClassId, selectedLocation, activeTab, searchQuery, selectedStudentForOther]);

  const toggleSelect = (uid: string) => {
    // No longer used, but kept for compatibility if needed or until fully cleaned up
  };

  const handleRecordPayments = async () => {
    // No longer used in favor of individual recording
  };

  const handleAddPrepayment = async () => {
    const amount = parseFloat(prepayAmount);
    const student = prepaymentModal.student;
    if (!student || isNaN(amount) || amount <= 0) return;
    if (!isToday) return showToast({ message: "Prepayments must be recorded on the current date.", type: "error" });

    setSaving(true);
    try {
      const batch = writeBatch(db);
      const serial = `PRE-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      // Prepayment is recorded as a negative increment to walletBalance (credit)
      batch.update(doc(db, "users", student.uid), {
        walletBalance: increment(-amount)
      });

      const entry = {
        amount,
        schoolId: SCHOOL_CONFIG.schoolId,
        method: "Cash",
        description: "Prepayment / Credit Top-up",
        receivedFrom: "Prepayment",
        updatedBy: updatedBy,
        adminUid: appUser?.uid || "unknown",
        createdAt: new Date().toISOString(),
        receiptNo: serial,
        date: selectedDate,
        studentUid: student.uid,
        studentName: student.fullName,
        classId: student.classId,
        className: classes.find(c => c.id === student.classId)?.name || "N/A",
        type: "feeding", // Use 'feeding' type to include in feeding aggregates
      };
      batch.set(doc(db, "feePayments", serial), entry);

      await batch.commit();
      showToast({ message: `₵${amount} credited to ${student.fullName}`, type: "success" });
      setPrepaymentModal({ visible: false, student: null });
      setPrepayAmount("");
      fetchStudents();
    } catch (e) {
      console.error(e);
      showToast({ message: "Failed to record prepayment", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePayment = async (student: Student, targetPaidStatus?: boolean) => {
    if (!isToday) return showToast({ message: "Previous records cannot be modified.", type: "error" });
    if (student.isAbsent) return showToast({ message: "Student is marked as absent.", type: "error" });

    const isPaid = student.paidToday;
    // If target state is already reached, do nothing.
    // EXCEPT for 'other' tab where we allow multiple records.
    if (activeTab !== "other" && targetPaidStatus !== undefined && isPaid === targetPaidStatus) return;

    setLoadingUids(prev => new Set(prev).add(student.uid));

    try {
      const batch = writeBatch(db);
      const academicYear = acadConfig.academicYear;
      const term = acadConfig.currentTerm;
      const cleanYear = academicYear?.replace(/\//g, "-");
      const cleanTerm = term?.replace(/\s+/g, "");
      const recordId = `${student.uid}_${cleanYear}_${cleanTerm}`;

      if (isPaid && activeTab !== "other") {
        if (!student.paymentDocId) {
            throw new Error("Payment record not found");
        }

        const paymentRef = doc(db, "feePayments", student.paymentDocId);
        const pSnap = await getDoc(paymentRef);
        if (!pSnap.exists()) {
             throw new Error("Payment record no longer exists");
        }
        const pData = pSnap.data();
        const amount = pData.amount || 0;
        const isCreditDeduction = pData.method === "Credit Deduction";

        batch.delete(paymentRef);
        batch.update(doc(db, "users", student.uid), {
          walletBalance: increment(-amount)
        });

        await batch.commit();

        // Optimistic Local Update
        setStudents(prev => prev.map(s => s.uid === student.uid ? {
            ...s,
            paidToday: false,
            paymentDocId: undefined,
            walletBalance: s.walletBalance - amount
        } : s));

        if (!isCreditDeduction) {
            setAggregates(prev => ({
                day: prev.day - amount,
                week: prev.week - amount,
                month: prev.month - amount
            }));
        }

        showToast({ message: `Payment removed for ${student.fullName}`, type: "success" });
      } else {
        let chargeAmount = parseFloat(paymentAmount);
        let chargeName = "";
        if (activeTab === "feeding") chargeName = "Feeding Fee";
        else if (activeTab === "bus") chargeName = "Bus Fee";
        else if (activeTab === "extra") chargeName = "Extra Classes";
        else {
          chargeName = selectedOtherCategory === "Other" ? otherPaymentRef : selectedOtherCategory;
        }

        if (activeTab === "bus") {
          chargeAmount = busRates[student.busLocation || ""] || 0;
        }

        if (chargeAmount <= 0) {
            throw new Error("Please set a valid amount first.");
        }

        if (activeTab === "other" && selectedOtherCategory === "Other" && !otherPaymentRef.trim()) {
            throw new Error("Enter payment reference (e.g. Books)");
        }

        const serial = `${activeTab === 'feeding' ? 'FD' : activeTab === 'bus' ? 'BS' : activeTab === 'extra' ? 'EX' : 'OT'}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        let isCreditDeduction = (activeTab === "feeding" || activeTab === "extra" || activeTab === "bus") && student.walletBalance < 0;

        let paymentEntry = {
          amount: chargeAmount,
          schoolId: SCHOOL_CONFIG.schoolId,
          method: isCreditDeduction ? "Credit Deduction" : "Daily Charge",
          description: chargeName + (activeTab === "bus" ? ` (${student.busLocation})` : ""),
          receivedFrom: isCreditDeduction ? "Prepaid Balance" : "Daily Recording",
          updatedBy: updatedBy,
          adminUid: appUser?.uid || "unknown",
          createdAt: new Date().toISOString(),
          receiptNo: serial,
          date: selectedDate,
          studentUid: student.uid,
          studentName: student.fullName,
          classId: student.classId,
          className: classes.find(c => c.id === student.classId)?.name || "N/A",
          type: activeTab,
        };

        batch.update(doc(db, "users", student.uid), {
          walletBalance: increment(chargeAmount)
        });

        batch.set(doc(db, "feePayments", serial), paymentEntry);
        await batch.commit();

        // Optimistic Local Update
        setStudents(prev => prev.map(s => s.uid === student.uid ? {
            ...s,
            paidToday: true,
            paymentDocId: serial,
            otherPaymentsCount: (s.otherPaymentsCount || 0) + 1,
            walletBalance: s.walletBalance + chargeAmount
        } : s));

        if (!isCreditDeduction) {
            setAggregates(prev => ({
                day: prev.day + chargeAmount,
                week: prev.week + chargeAmount,
                month: prev.month + chargeAmount
            }));
        }

        if (activeTab === "other") {
            setOtherPaymentRef("");
            setSelectedStudentForOther(null);
            setSearchQuery("");
        }

        showToast({ message: `Payment recorded for ${student.fullName}`, type: "success" });
      }
    } catch (e: any) {
      console.error(e);
      showToast({ message: e.message || "Operation failed", type: "error" });
    } finally {
      setLoadingUids(prev => {
        const next = new Set(prev);
        next.delete(student.uid);
        return next;
      });
    }
  };

  const renderStudent = ({ item }: { item: Student }) => {
    const className = classes.find(c => c.id === item.classId)?.name || "No Class";
    const hasCredit = item.walletBalance < 0;
    const isPaid = item.paidToday;
    const isAbsent = item.isAbsent;
    const isProcessing = loadingUids.has(item.uid);
    const isSelection = activeTab === "other" && selectedStudentForOther?.uid === item.uid;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => {
          if (isAbsent) return;
          if (activeTab === "other") {
              setEditOtherModal({ visible: true, student: item });
          } else if (canFeeding) {
            setPrepaymentModal({ visible: true, student: item });
          }
        }}
      >
        <View
          style={[
            styles.studentCard,
            isAbsent && styles.absentStudentCard,
            isSelection && { borderColor: activeColor, backgroundColor: activeColor + '10' }
          ]}
        >
          <View style={styles.studentInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={[styles.studentName, isAbsent && styles.absentText]}>{item.fullName}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Text style={styles.studentClass}>{className}</Text>
                  {isSelection && <Text style={{ fontSize: 10, fontWeight: '900', color: activeColor }}>SELECTED FOR RECORDING</Text>}
                  {activeTab === "bus" && item.busLocation && (
                    <>
                      <View style={{ width: 1, height: 10, backgroundColor: VIBE.border }} />
                      <Text style={[styles.studentClass, { color: activeColor }]}>{item.busLocation}</Text>
                    </>
                  )}
                  {hasCredit && (
                    <>
                      <View style={{ width: 1, height: 10, backgroundColor: VIBE.border }} />
                      <Text style={[styles.studentClass, { color: VIBE.success, fontWeight: '800' }]}>
                        Credit: ₵{Math.abs(item.walletBalance).toFixed(2)}
                      </Text>
                    </>
                  )}
                </View>
              </View>

              {!isAbsent && isToday ? (
                activeTab === "other" ? (
                  isSelection ? (
                    <View style={[styles.recordBtnSmall, { backgroundColor: activeColor }]}>
                        <Text style={styles.recordBtnSmallText}>TAP TO RECORD</Text>
                    </View>
                  ) : isPaid ? (
                    <View style={[styles.statusBadge, { backgroundColor: activeColor + '20' }]}>
                        <Text style={[styles.statusBadgeText, { color: activeColor }]}>
                            {item.otherPaymentsCount && item.otherPaymentsCount > 1
                                ? `${item.otherPaymentsCount} RECORDS`
                                : "RECORDED"}
                        </Text>
                    </View>
                  ) : null
                ) : (
                  <View style={styles.statusToggleContainer}>
                    {isProcessing ? (
                      <View style={{ width: 120, height: 32, justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator size="small" color={VIBE.primary} />
                      </View>
                    ) : (
                      <>
                        <TouchableOpacity
                          style={[
                            styles.statusToggleBtn,
                            !isPaid ? styles.statusToggleActive_Unpaid : styles.statusToggleInactive
                          ]}
                          onPress={() => handleTogglePayment(item, false)}
                          disabled={isProcessing}
                        >
                          <Text style={[
                            styles.statusToggleText,
                            !isPaid ? styles.statusToggleTextActive : styles.statusToggleTextInactive
                          ]}>NOT PAID</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.statusToggleBtn,
                            isPaid ? { backgroundColor: activeColor } : styles.statusToggleInactive
                          ]}
                          onPress={() => handleTogglePayment(item, true)}
                          disabled={isProcessing}
                        >
                          <Text style={[
                            styles.statusToggleText,
                            isPaid ? styles.statusToggleTextActive : styles.statusToggleTextInactive
                          ]}>PAID</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                )
              ) : isAbsent ? (
                <View style={[styles.statusBadge, styles.absentBadge]}>
                  <Text style={styles.statusBadgeText}>ABSENT</Text>
                </View>
              ) : !isToday ? (
                <View style={[styles.statusBadge, isPaid ? { backgroundColor: activeColor + '20' } : styles.unpaidBadge]}>
                  <Text style={[styles.statusBadgeText, isPaid && { color: activeColor }]}>{isPaid ? "PAID" : "NOT PAID"}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <LinearGradient
          colors={[activeColor, secondaryColor]}
          style={styles.headerGradient}
        >
          <View style={styles.nav}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <SVGIcon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.headerTitle}>Daily Financials</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '800' }}>{acadConfig.academicYear} • {acadConfig.currentTerm}</Text>
            </View>
            <View style={{ width: 44 }} />
          </View>

          <View style={styles.dateSelector}>
            <TouchableOpacity onPress={() => setSelectedDate(prev => moment(prev).subtract(1, 'day').format("YYYY-MM-DD"))} style={styles.dateNav}>
              <SVGIcon name="chevron-back" size={20} color="#fff" />
            </TouchableOpacity>

            <View style={styles.dateInfo}>
              <SVGIcon name="calendar" size={16} color="#fff" />
              <Text style={styles.dateLabel}>{moment(selectedDate).format("ddd, MMM Do YYYY")}</Text>
              {isToday && <View style={styles.todayBadge}><Text style={styles.todayText}>TODAY</Text></View>}
            </View>

            <TouchableOpacity
              onPress={() => setSelectedDate(prev => moment(prev).add(1, 'day').format("YYYY-MM-DD"))}
              style={[styles.dateNav, moment(selectedDate).isSame(moment(), 'day') && { opacity: 0.3 }]}
              disabled={moment(selectedDate).isSame(moment(), 'day')}
            >
              <SVGIcon name="chevron-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.tabs}>
            {[
              { id: "summary", label: "Summary", icon: "analytics", allowed: canViewSummary },
              { id: "feeding", label: "Feeding", icon: "restaurant", allowed: canFeeding },
              { id: "bus", label: "Bus Fee", icon: "bus", allowed: canBus },
              { id: "extra", label: "Extra Classes", icon: "school", allowed: canExtraClasses },
              { id: "other", label: "Others", icon: "options", allowed: canManageSales },
            ].filter(t => t.allowed).map((tab) => {
              const isSelected = activeTab === tab.id;
              const tabColor = tabColors[tab.id].primary;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[
                    styles.tab,
                    isSelected && { backgroundColor: tabColor, borderColor: tabColor }
                  ]}
                  onPress={() => {
                    if (tab.id === "other" && activeTab === "other") {
                      setShowCategoryMenu(true);
                    } else {
                      setActiveTab(tab.id as any);
                    }
                  }}
                >
                  <SVGIcon
                    name={tab.icon as any}
                    size={18}
                    color={isSelected ? "#fff" : "rgba(255,255,255,0.6)"}
                  />
                  <Text style={[
                    styles.tabText,
                    isSelected && { color: "#fff" }
                  ]}>
                    {tab.id === "other" && activeTab === "other" ? selectedOtherCategory : tab.label}
                  </Text>
                  {tab.id === "other" && activeTab === "other" && (
                    <SVGIcon name="chevron-down" size={12} color="#fff" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </LinearGradient>

        <View style={styles.searchBar}>
          <SVGIcon name="search" size={20} color={activeColor} />
          <TextInput
            placeholder="Search student name..."
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={(val) => {
                setSearchQuery(val);
                if (activeTab === "other" && val.length > 2) {
                    const found = students.find(s => s.fullName.toLowerCase().includes(val.toLowerCase()));
                    if (found) setSelectedStudentForOther(found);
                }
            }}
          />
          {activeTab === "other" && selectedStudentForOther && (
              <TouchableOpacity onPress={() => {
                  setSelectedStudentForOther(null);
                  setSearchQuery("");
              }}>
                  <SVGIcon name="close-circle" size={20} color={VIBE.danger} />
              </TouchableOpacity>
          )}
        </View>

        {activeTab !== "other" && (
            <View style={[styles.searchBar, { marginTop: 15 }]}>
                <SVGIcon name={activeTab === "bus" ? "bus" : activeTab === "extra" ? "school" : "cash"} size={20} color={activeColor} />
                <TextInput
                    placeholder={
                        activeTab === "bus"
                            ? "Destination Rate (₵)"
                            : activeTab === "feeding"
                                ? "Daily Feeding Rate (₵)"
                                : activeTab === "extra"
                                    ? "Extra Classes Rate (₵)"
                                    : "Set Payable Amount (₵)"
                    }
                    style={styles.searchInput}
                    keyboardType="numeric"
                    value={
                        activeTab === "bus"
                            ? (busRates[selectedLocation] || 0).toString()
                            : activeTab === "extra"
                                ? extraClassesRate.toString()
                                : paymentAmount
                    }
                    onChangeText={(val) => {
                        if (activeTab === "bus") {
                            updateBusRate(selectedLocation, val);
                        } else if (activeTab === "feeding") {
                            updateFeedingRate(val);
                        } else if (activeTab === "extra") {
                            updateExtraClassesRate(val);
                        } else {
                            setPaymentAmount(val);
                        }
                    }}
                    editable={
                        (activeTab === "feeding" ? canEditFeedingRate : activeTab === "extra" ? canEditExtraClassesRate : canEditBusRate) &&
                        (activeTab !== "bus" || selectedLocation !== "all")
                    }
                />
                {!(activeTab === "feeding" ? canEditFeedingRate : activeTab === "extra" ? canEditExtraClassesRate : canEditBusRate) && <SVGIcon name="lock-closed" size={18} color={VIBE.muted} />}
            </View>
        )}

        {activeTab === "bus" ? (
          <View style={styles.filterRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.classFilters}>
              <TouchableOpacity
                style={[styles.classChip, selectedLocation === "all" && { backgroundColor: activeColor, borderColor: activeColor }]}
                onPress={() => setSelectedLocation("all")}
              >
                <Text style={[styles.classChipText, selectedLocation === "all" && styles.activeClassChipText]}>
                  All Destinations
                </Text>
              </TouchableOpacity>
              {busLocations.map((loc) => (
                <TouchableOpacity
                  key={loc}
                  style={[styles.classChip, selectedLocation === loc && { backgroundColor: activeColor, borderColor: activeColor }]}
                  onPress={() => setSelectedLocation(loc)}
                >
                  <Text style={[styles.classChipText, selectedLocation === loc && styles.activeClassChipText]}>
                    {loc}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : (
          <View style={styles.filterRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.classFilters}>
              <TouchableOpacity
                style={[styles.classChip, selectedClassId === "all" && { backgroundColor: activeColor, borderColor: activeColor }]}
                onPress={() => setSelectedClassId("all")}
              >
                <Text style={[styles.classChipText, selectedClassId === "all" && styles.activeClassChipText]}>
                  All Classes
                </Text>
              </TouchableOpacity>
              {classes.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.classChip, selectedClassId === c.id && { backgroundColor: activeColor, borderColor: activeColor }]}
                  onPress={() => setSelectedClassId(c.id)}
                >
                  <Text style={[styles.classChipText, selectedClassId === c.id && styles.activeClassChipText]}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {isToday && (
          <View style={styles.secondaryActions}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: VIBE.muted }}>
                Tap a student to record prepayment
            </Text>
          </View>
        )}

        {(activeTab === "feeding" || activeTab === "bus" || activeTab === "extra" || activeTab === "other") && (
            <View style={styles.aggregateStrip}>
                <View style={styles.aggBox}>
                    <Text style={styles.aggLabel}>TODAY</Text>
                    <Text style={[styles.aggValue, { color: activeColor }]}>₵{aggregates.day.toFixed(2)}</Text>
                </View>
                <View style={[styles.aggBox, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: VIBE.border }]}>
                    <Text style={styles.aggLabel}>THIS WEEK</Text>
                    <Text style={[styles.aggValue, { color: activeColor }]}>₵{aggregates.week.toFixed(2)}</Text>
                </View>
                <View style={styles.aggBox}>
                    <Text style={styles.aggLabel}>THIS MONTH</Text>
                    <Text style={[styles.aggValue, { color: activeColor }]}>₵{aggregates.month.toFixed(2)}</Text>
                </View>
            </View>
        )}
      </View>

      {activeTab === "summary" ? (
        <ScrollView
          style={styles.summaryDashboard}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchStudents} />}
        >
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Revenue Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Revenue (Today)</Text>
              <Text style={styles.summaryValue}>₵{globalAggregates.day.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Revenue (Weekly)</Text>
              <Text style={styles.summaryValue}>₵{globalAggregates.week.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Revenue (Monthly)</Text>
              <Text style={[styles.summaryValue, { color: VIBE.primary, fontSize: 16 }]}>₵{globalAggregates.month.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Expenditure Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Spent (Today)</Text>
              <Text style={styles.summaryValue}>₵{expenditureAggregates.day.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Spent (Weekly)</Text>
              <Text style={styles.summaryValue}>₵{expenditureAggregates.week.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Spent (Monthly)</Text>
              <Text style={[styles.summaryValue, { color: VIBE.danger, fontSize: 16 }]}>₵{expenditureAggregates.month.toFixed(2)}</Text>
            </View>
          </View>

          <LinearGradient
            colors={[VIBE.primary, secondaryColor]}
            style={styles.cashPositionCard}
          >
            <Text style={styles.cashPositionTitle}>Net Cash Position</Text>
            <View style={styles.cashPositionRow}>
              <Text style={styles.cashPositionLabel}>Net Position (Today)</Text>
              <Text style={styles.cashPositionValue}>₵{(globalAggregates.day - expenditureAggregates.day).toFixed(2)}</Text>
            </View>
            <View style={styles.cashPositionRow}>
              <Text style={styles.cashPositionLabel}>Net Position (Weekly)</Text>
              <Text style={styles.cashPositionValue}>₵{(globalAggregates.week - expenditureAggregates.week).toFixed(2)}</Text>
            </View>
            <View style={styles.cashPositionRow}>
              <Text style={styles.cashPositionLabel}>Net Position (Monthly)</Text>
              <Text style={[styles.cashPositionValue, { fontSize: 20, fontWeight: '900' }]}>
                ₵{(globalAggregates.month - expenditureAggregates.month).toFixed(2)}
              </Text>
            </View>
          </LinearGradient>

          <View style={styles.breakdownCard}>
            <Text style={styles.summaryTitle}>Revenue Breakdown (Today)</Text>
            {Object.entries(revenueBreakdown).map(([type, amount]) => (
              <View key={type} style={styles.breakdownItem}>
                <View style={styles.breakdownInfo}>
                  <SVGIcon
                    name={type === 'feeding' ? 'restaurant' : type === 'bus' ? 'bus' : type === 'extra' ? 'school' : type === 'tuition' ? 'cash' : 'options'}
                    size={16}
                    color={VIBE.muted}
                  />
                  <Text style={styles.breakdownLabel}>{type}</Text>
                </View>
                <Text style={styles.breakdownValue}>₵{amount.toFixed(2)}</Text>
              </View>
            ))}
            {Object.keys(revenueBreakdown).length === 0 && (
              <Text style={{ textAlign: 'center', color: VIBE.muted, fontStyle: 'italic' }}>No collections today</Text>
            )}
          </View>
          <View style={{ height: 100 }} />
        </ScrollView>
      ) : (
        <FlatList
          data={filteredStudents}
          keyExtractor={(item) => item.uid}
          renderItem={renderStudent}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchStudents} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {students.length === 0
                  ? "No students found in the database"
                  : activeTab === 'feeding'
                    ? "No students are enrolled in the feeding program. Enroll them in Manage Users."
                    : activeTab === 'extra'
                      ? "No students are enrolled for extra classes. Enroll them in Manage Users."
                      : activeTab === 'bus'
                        ? "No students are assigned to the school bus."
                        : activeTab === 'other'
                          ? "Search for a student to record an 'Other' payment. Only students with payments for this date will appear in the list below."
                          : "No students match the current filters"}
              </Text>
              {students.length > 0 && (activeTab === 'feeding' || activeTab === 'extra') && (
                <TouchableOpacity
                  style={[styles.emptyActionBtn, { backgroundColor: activeColor }]}
                  onPress={() => router.push("/admin-dashboard/manage-users")}
                >
                  <Text style={styles.emptyActionText}>Go to Manage Users</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      <View style={[styles.footer, { height: 0, padding: 0, overflow: 'hidden' }]}>
        <View style={styles.inputRow}>
        </View>
      </View>

      {/* Edit Other Modal */}
      <Modal
        visible={editOtherModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditOtherModal({ visible: false, student: null })}
      >
        <View style={styles.modalOverlay}>
            <TouchableOpacity
                activeOpacity={1}
                style={StyleSheet.absoluteFill}
                onPress={() => setEditOtherModal({ visible: false, student: null })}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ width: '100%', alignItems: 'center', justifyContent: 'center' }}
            >
                <View style={[styles.prepaymentCard, { width: '90%' }]}>
                    <View style={styles.prepaymentHeader}>
                        <Text style={styles.prepaymentTitle}>Record {selectedOtherCategory === 'Other' ? 'Other Payment' : selectedOtherCategory}</Text>
                        <Text style={styles.prepaymentSub}>{editOtherModal.student?.fullName}</Text>
                    </View>

                    {selectedOtherCategory === "Other" ? (
                      <TextInput
                        placeholder="Reference (e.g. Uniform, Books)"
                        style={[styles.prepaymentInput, { fontSize: 18, height: 50, marginBottom: 10, color: activeColor }]}
                        value={otherPaymentRef}
                        onChangeText={setOtherPaymentRef}
                        placeholderTextColor={VIBE.muted}
                      />
                    ) : (
                      <View style={[styles.prepaymentInputContainer, { height: 50, marginBottom: 10, justifyContent: 'center' }]}>
                        <Text style={{ color: activeColor, fontWeight: '800', fontSize: 18 }}>{selectedOtherCategory}</Text>
                      </View>
                    )}

                    <TextInput
                        placeholder="Amount (₵)"
                        style={[styles.prepaymentInput, { color: activeColor }]}
                        keyboardType="numeric"
                        value={paymentAmount}
                        onChangeText={setPaymentAmount}
                        placeholderTextColor={VIBE.muted}
                    />

                        <TouchableOpacity
                            style={[styles.prepayBtn, { backgroundColor: activeColor }, (saving || !editOtherModal.student) && { opacity: 0.7 }]}
                            onPress={async () => {
                                if (!editOtherModal.student) return;
                                setSaving(true);
                                try {
                                    await handleTogglePayment(editOtherModal.student, true);
                                    setEditOtherModal({ visible: false, student: null });
                                    setPaymentAmount("");
                                    setOtherPaymentRef("");
                                } finally {
                                    setSaving(false);
                                }
                            }}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.prepayBtnText}>Record Payment</Text>
                            )}
                        </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Prepayment Modal */}
      <Modal
        visible={prepaymentModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setPrepaymentModal({ visible: false, student: null })}
      >
        <View style={styles.modalOverlay}>
            <TouchableOpacity
                activeOpacity={1}
                style={StyleSheet.absoluteFill}
                onPress={() => setPrepaymentModal({ visible: false, student: null })}
            />
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ width: '100%', alignItems: 'center', justifyContent: 'center' }}
            >
                <View style={[styles.prepaymentCard, { width: '90%' }]}>
                    <View style={styles.prepaymentHeader}>
                        <Text style={styles.prepaymentTitle}>Record Prepayment</Text>
                        <Text style={styles.prepaymentSub}>{prepaymentModal.student?.fullName}</Text>
                    </View>

                    <TextInput
                        placeholder="Amount (₵)"
                        style={styles.prepaymentInput}
                        keyboardType="numeric"
                        value={prepayAmount}
                        onChangeText={setPrepayAmount}
                        placeholderTextColor={VIBE.muted}
                    />

                    <TouchableOpacity
                        style={[styles.prepayBtn, (saving || !prepaymentModal.student) && { opacity: 0.7 }]}
                        onPress={handleAddPrepayment}
                        disabled={saving}
                    >
                        {saving ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.prepayBtnText}>Confirm Prepayment</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Category Selection Modal */}
      <Modal
        visible={showCategoryMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCategoryMenu(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            activeOpacity={1}
            style={StyleSheet.absoluteFill}
            onPress={() => setShowCategoryMenu(false)}
          />
          <View style={styles.prepaymentCard}>
            <Text style={styles.prepaymentTitle}>Select Category</Text>
            <View style={{ marginTop: 15 }}>
              {OTHER_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryItem,
                    selectedOtherCategory === cat && { backgroundColor: activeColor + '10', borderColor: activeColor }
                  ]}
                  onPress={() => {
                    setSelectedOtherCategory(cat);
                    setShowCategoryMenu(false);
                  }}
                >
                  <Text style={[styles.categoryItemText, selectedOtherCategory === cat && { color: activeColor }]}>{cat}</Text>
                  {selectedOtherCategory === cat && <SVGIcon name="checkmark" size={20} color={activeColor} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VIBE.bg },
  header: { backgroundColor: "#fff", ...SHADOWS.small },
  headerGradient: { padding: 20, paddingBottom: 15, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 15 },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "900" },
  dateSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.1)', padding: 10, borderRadius: 15, marginBottom: 15 },
  dateNav: { padding: 5 },
  dateInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateLabel: { color: '#fff', fontSize: 14, fontWeight: '800' },
  todayBadge: { backgroundColor: VIBE.success, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  todayText: { color: '#fff', fontSize: 8, fontWeight: '900' },
  tabs: { flexDirection: "row", gap: 10 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.1)" },
  activeTab: { backgroundColor: "#fff" },
  tabText: { color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: "700" },
  activeTabText: { color: VIBE.primary },
  searchBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, marginTop: -25, backgroundColor: "#fff", marginHorizontal: 20, borderRadius: 20, height: 50, ...SHADOWS.medium },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 14, fontWeight: "600" },
  filterRow: { flexDirection: 'row', alignItems: 'center' },
  secondaryActions: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 10, justifyContent: 'flex-end' },
  selectAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: VIBE.primary + '15', borderWidth: 1, borderColor: VIBE.primary + '30' },
  selectAllText: { fontSize: 10, fontWeight: '900', color: VIBE.primary },
  filterBtn: { padding: 5 },
  classFilters: { flex: 1, paddingHorizontal: 20, paddingVertical: 15 },
  classChip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: VIBE.border, marginRight: 10 },
  activeClassChip: { backgroundColor: VIBE.primary, borderColor: VIBE.primary },
  classChipText: { fontSize: 12, fontWeight: "700", color: VIBE.muted },
  activeClassChipText: { color: "#fff" },
  aggregateStrip: { flexDirection: 'row', backgroundColor: VIBE.bg, marginHorizontal: 20, marginBottom: 15, borderRadius: 15, padding: 10, borderWidth: 1, borderColor: VIBE.border },
  aggBox: { flex: 1, alignItems: 'center' },
  aggLabel: { fontSize: 8, fontWeight: '900', color: VIBE.muted, marginBottom: 2 },
  aggValue: { fontSize: 14, fontWeight: '900', color: VIBE.text },
  listContent: { padding: 20, paddingBottom: 150 },
  studentCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", padding: 15, borderRadius: 20, marginBottom: 10, borderWidth: 1, borderColor: VIBE.border },
  selectedCard: { borderColor: VIBE.primary, backgroundColor: VIBE.primary + "05" },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 15, fontWeight: "800", color: VIBE.text },
  studentClass: { fontSize: 12, color: VIBE.muted, marginTop: 2 },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1.5,
    minWidth: 80,
    alignItems: 'center',
    marginLeft: 10,
  },
  statusToggleContainer: {
    flexDirection: 'row',
    backgroundColor: VIBE.bg,
    borderRadius: 10,
    padding: 2,
    borderWidth: 1,
    borderColor: VIBE.border,
    width: 130,
  },
  statusToggleBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusToggleActive_Unpaid: {
    backgroundColor: VIBE.danger,
  },
  statusToggleActive_Paid: {
    backgroundColor: VIBE.success,
  },
  statusToggleInactive: {
    backgroundColor: 'transparent',
  },
  statusToggleText: {
    fontSize: 8,
    fontWeight: '900',
  },
  statusToggleTextActive: {
    color: '#fff',
  },
  statusToggleTextInactive: {
    color: VIBE.muted,
  },
  paidToggle: {
    backgroundColor: VIBE.success,
    borderColor: VIBE.success,
  },
  unpaidToggle: {
    backgroundColor: 'transparent',
    borderColor: VIBE.danger,
  },
  toggleBtnText: {
    fontSize: 10,
    fontWeight: '900',
  },
  paidToggleText: {
    color: '#fff',
  },
  unpaidToggleText: {
    color: VIBE.danger,
  },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  paidBadge: { backgroundColor: VIBE.success + '20' },
  unpaidBadge: { backgroundColor: VIBE.danger + '20' },
  absentBadge: { backgroundColor: VIBE.muted + '20' },
  absentText: { color: VIBE.muted, textDecorationLine: 'line-through' },
  absentStudentCard: { backgroundColor: VIBE.bg, opacity: 0.6 },
  statusBadgeText: { fontSize: 8, fontWeight: '900', color: VIBE.text },
  checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: VIBE.border, justifyContent: "center", alignItems: "center" },
  checkboxActive: { backgroundColor: VIBE.primary, borderColor: VIBE.primary },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", padding: 20, borderTopLeftRadius: 30, borderTopRightRadius: 30, ...SHADOWS.large },
  inputRow: { flexDirection: "row", gap: 10, marginBottom: 15 },
  footerInput: { flex: 1, height: 50, backgroundColor: VIBE.bg, borderRadius: 15, paddingHorizontal: 15, fontSize: 16, fontWeight: "700", borderWidth: 1, borderColor: VIBE.border },
  recordBtnSmall: {
    backgroundColor: VIBE.primary,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordBtnSmallText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  recordBtn: { height: 56, backgroundColor: VIBE.primary, borderRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, ...SHADOWS.medium },
  recordBtnText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  emptyContainer: { alignItems: "center", marginTop: 50, paddingHorizontal: 40 },
  emptyText: { color: VIBE.muted, fontWeight: "700", textAlign: 'center', lineHeight: 20 },
  emptyActionBtn: { marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: VIBE.primary, borderRadius: 12 },
  emptyActionText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  prepaymentCard: { backgroundColor: '#fff', borderRadius: 25, padding: 25, ...SHADOWS.large },
  prepaymentHeader: { marginBottom: 20 },
  prepaymentTitle: { fontSize: 18, fontWeight: '900', color: VIBE.text },
  prepaymentSub: { fontSize: 14, color: VIBE.muted, fontWeight: '700' },
  prepaymentInputContainer: { height: 60, backgroundColor: VIBE.bg, borderRadius: 15, paddingHorizontal: 20, marginBottom: 15, justifyContent: 'center' },
  prepaymentInput: { height: 60, backgroundColor: VIBE.bg, borderRadius: 15, paddingHorizontal: 20, fontSize: 24, fontWeight: '900', color: VIBE.primary, marginBottom: 15 },
  coverageText: { fontSize: 12, fontWeight: '800', color: VIBE.muted, textAlign: 'center', marginBottom: 20 },
  prepayBtn: { height: 56, backgroundColor: VIBE.success, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  prepayBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: VIBE.border,
    marginBottom: 10,
  },
  categoryItemText: {
    fontSize: 16,
    fontWeight: '700',
    color: VIBE.text,
  },
  summaryDashboard: { padding: 20 },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 25,
    padding: 20,
    marginBottom: 20,
    ...SHADOWS.small,
  },
  summaryTitle: { fontSize: 18, fontWeight: '900', color: VIBE.text, marginBottom: 15 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { fontSize: 14, fontWeight: '700', color: VIBE.muted },
  summaryValue: { fontSize: 14, fontWeight: '800', color: VIBE.text },
  cashPositionCard: {
    backgroundColor: VIBE.primary,
    borderRadius: 25,
    padding: 20,
    marginBottom: 20,
    ...SHADOWS.medium,
  },
  cashPositionTitle: { color: '#fff', fontSize: 18, fontWeight: '900', marginBottom: 15 },
  cashPositionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  cashPositionLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '700' },
  cashPositionValue: { color: '#fff', fontSize: 14, fontWeight: '800' },
  breakdownCard: { backgroundColor: '#fff', borderRadius: 25, padding: 20, marginBottom: 20, ...SHADOWS.small },
  breakdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  breakdownInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  breakdownLabel: { fontSize: 14, fontWeight: '700', color: VIBE.text, textTransform: 'capitalize' },
  breakdownValue: { fontSize: 14, fontWeight: '900', color: VIBE.primary },
});
