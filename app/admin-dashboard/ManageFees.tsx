import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { LinearGradient } from "expo-linear-gradient";
import * as Print from "expo-print";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDocsFromServer,
  increment,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  startAfter,
  where,
  writeBatch,
} from "firebase/firestore";
import moment from "moment";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
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
import { db } from "../../firebaseConfig";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";
import { sortClasses } from "../../lib/classHelpers";

import { useToast } from "../../contexts/ToastContext";

import { sendNotification } from "../../src/services/notificationService";

const { width, height } = Dimensions.get("window");

const VIBE = {
  primary: "#6366F1",
  secondary: "#F59E0B",
  success: "#10B981",
  danger: "#EF4444",
  info: "#3B82F6",
  purple: "#8B5CF6",
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  text: "#1E293B",
  muted: "#64748B",
  border: "#E2E8F0",
};

const FILTERS_PERSISTENCE_KEY = "@manage_fees_filters_v14";
const PAGE_SIZE = 50;

type StudentDraft = {
  uid: string;
  studentID: string;
  fullName: string;
  classId: string;
  className: string;
  previousBalance: number;
  amountPaid: number;
  currentBalance: number;
  hasRecordInTerm: boolean;
  payments: any[];
  termBill: number;
  discount?: number;
  editCount: number;
  onDiscount?: boolean;
  discountAmount?: number;
  onScholarship?: boolean;
  ptaBalance: number;
  admissionBalance: number;
  maintenanceBalance: number;
  booksBalance: number;
  uniformBalance: number;
  otherBalance: number;
};

export default function ManageFees() {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
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
  ].includes(currentUserRole);
  const feePermission = appUser?.permissions?.["manage-fees"] || "deny";
  const canView =
    isSuperAdmin ||
    feePermission === "full" ||
    feePermission === "view" ||
    feePermission === "edit";
  const canEdit =
    isSuperAdmin || feePermission === "full" || feePermission === "edit";

  // Stabilize inputs using refs for batch updates to prevent render-loops during typing
  const individualBillOverridesRef = useRef<Record<string, string>>({});
  const [individualBillOverrides, setIndividualBillOverridesState] = useState<
    Record<string, string>
  >({});

  const setIndividualBillOverrides = useCallback((update: any) => {
    setIndividualBillOverridesState((prev) => {
      const next = typeof update === "function" ? update(prev) : update;
      individualBillOverridesRef.current = next;
      return next;
    });
  }, []);

  // Brand Fallbacks
  const primaryBrand =
    SCHOOL_CONFIG.primaryColor || COLORS.primary || VIBE.primary;
  const secondaryBrand = SCHOOL_CONFIG.secondaryColor || primaryBrand;

  const [loading, setLoading] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeMode, setActiveMode] = useState<
    "billing" | "payment" | "discounts"
  >("payment");

  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "debt" | "cleared">(
    "all",
  );
  const [classes, setClasses] = useState<
    { id: string; name: string; department?: string | null }[]
  >([]);
  const [students, setStudents] = useState<StudentDraft[]>([]);
  const [selectedStudentUids, setSelectedStudentUids] = useState<Set<string>>(
    new Set(),
  );

  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [academicYear, setAcademicYear] = useState("");
  const [term, setTerm] = useState<string>("");
  const [termBillAmount, setTermBillAmount] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [individualDiscountOverrides, setIndividualDiscountOverrides] =
    useState<Record<string, string>>({});
  const [totalDiscountCommitted, setTotalDiscountCommitted] = useState(0);
  const [discountModalVisible, setDiscountModalVisible] = useState(false);
  const [selectedDiscountStudent, setSelectedDiscountStudent] =
    useState<StudentDraft | null>(null);

  const [selectorModal, setSelectorModal] = useState<{
    visible: boolean;
    type: "class" | "year" | "term" | null;
  }>({ visible: false, type: null });
  const [billModalVisible, setBillModalVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentDraft | null>(
    null,
  );
  const [paymentAmount, setPaymentAmount] = useState("");
  const [receivedFrom, setReceivedFrom] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "Cash" | "Cheque" | "E-cash" | "Momo"
  >("Cash");

  const [stats, setStats] = useState({
    expected: 0,
    received: 0,
    balance: 0,
    totalDiscount: 0,
  });

  // Daily Payments States
  const [dailyModalVisible, setDailyModalVisible] = useState(false);
  const [selectedDailyDate, setSelectedDailyDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dailyPayments, setDailyPayments] = useState<any[]>([]);
  const [loadingDaily, setLoadingDaily] = useState(false);

  useEffect(() => {
    if (appUser && !canView) {
      showToast({
        message:
          "Access Denied: You do not have permission to view fees management.",
        type: "error",
      });
      router.replace("/admin-dashboard");
    }
  }, [appUser, canView]);

  useEffect(() => {
    const onBackPress = () => {
      if (selectorModal.visible) {
        setSelectorModal({ visible: false, type: null });
        return true;
      }
      if (billModalVisible) {
        setBillModalVisible(false);
        return true;
      }
      if (paymentModalVisible) {
        setPaymentModalVisible(false);
        setSelectedStudent(null);
        return true;
      }
      if (dailyModalVisible) {
        setDailyModalVisible(false);
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress,
    );
    return () => subscription.remove();
  }, [
    selectorModal.visible,
    billModalVisible,
    paymentModalVisible,
    dailyModalVisible,
  ]);

  const lastVisibleRef = useRef<any>(null);
  const hasMoreRef = useRef(true);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    if (!acadConfig.loading) {
      setAcademicYear(acadConfig.academicYear || "");
      setTerm(acadConfig.currentTerm || "");
    }
  }, [acadConfig]);

  const isConfigMissing = !academicYear || !term;

  // 1. Real-time Classes Listener
  useEffect(() => {
    const q = collection(db, "classes");
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          name: (d.data() as any).name || d.id,
          department: (d.data() as any).department || null,
        }));
        setClasses(sortClasses(list));
      },
      (err) => console.error("Classes listener error:", err),
    );

    return () => unsub();
  }, []);

  // 2. Real-time Global Stats Listener
  useEffect(() => {
    if (!academicYear || !term) return;

    const q = query(
      collection(db, "studentFeeRecords"),
      where("academicYear", "==", academicYear),
      where("term", "==", term),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        let expected = 0;
        let received = 0;
        let totalDiscount = 0;

        snap.docs.forEach((d) => {
          const data = d.data() as any;
          // Filter by class in memory to keep the listener broad and efficient
          if (selectedClassId === "all" || data.classId === selectedClassId) {
            expected += (data.termBill || 0) + (data.arrears || 0);
            received += data.amountPaid || 0;
            totalDiscount += data.discount || 0;
          }
        });
        setStats({
          expected,
          received,
          balance: expected - received,
          totalDiscount,
        });
        setTotalDiscountCommitted(totalDiscount);
      },
      (err) => console.error("Stats listener error:", err),
    );

    return () => unsub();
  }, [academicYear, term, selectedClassId]);

  const filteredStudents = useMemo(() => {
    const searchLower = searchQuery.toLowerCase();
    return students.filter((s) => {
      const matchesName = (s.fullName || "").toLowerCase().includes(searchLower);
      const matchesID = (s.studentID || "").toLowerCase().includes(searchLower);
      const matchesSerial = s.payments?.some(
        (p) =>
          p.receiptNo?.toLowerCase().includes(searchLower) ||
          p.createdAt?.toLowerCase().includes(searchLower),
      );
      const matchesSearch = matchesName || matchesID || matchesSerial;
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "cleared"
            ? (s.currentBalance || 0) <= 0
            : (s.currentBalance || 0) > 0;

      const matchesMode = activeMode === "discounts" ? !!s.onDiscount : true;

      return matchesSearch && matchesStatus && matchesMode;
    });
  }, [students, searchQuery, statusFilter, activeMode]);

  const totalProfileDiscountsSum = useMemo(() => {
    if (activeMode !== "discounts") return 0;
    return filteredStudents.reduce((acc, s) => acc + (s.discountAmount || 0), 0);
  }, [filteredStudents, activeMode]);

  const loadClasses = async () => {
    try {
      const snap = await getDocsFromServer(collection(db, "classes") as any);
      const list = snap.docs.map((d) => ({
        id: d.id,
        name: (d.data() as any).name || d.id,
      }));
      const sorted = sortClasses(list);
      setClasses(sorted);
      return sorted;
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  useEffect(() => {
    const init = async () => {
      const saved = await AsyncStorage.getItem(FILTERS_PERSISTENCE_KEY);
      if (saved) {
        try {
          const { classId } = JSON.parse(saved);
          setSelectedClassId(classId || "all");
        } catch {
          setSelectedClassId("all");
        }
      } else {
        setSelectedClassId("all");
      }
      setLoading(false);
    };
    init();
  }, []);

  const fetchStudents = useCallback(
    async (isFirstLoad = false) => {
      if (!selectedClassId || isFetchingRef.current)
        return;
      if (!isFirstLoad && !hasMoreRef.current) return;

      isFetchingRef.current = true;
      if (isFirstLoad) {
        setLoading(true);
        lastVisibleRef.current = null;
        hasMoreRef.current = true;
      } else setFetchingMore(true);

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

        // Force server fetch to ensure real-time accuracy and avoid PWA cache issues
        const snap = await getDocsFromServer(q as any);
        if (snap.empty) {
          hasMoreRef.current = false;
          if (isFirstLoad) setStudents([]);
          return;
        }

        // No longer filtering out students on scholarship
        const studentDocs = snap.docs;
        const studentIds = studentDocs.map((d) => d.id);

        let feesMap = new Map();
        if (studentIds.length > 0 && academicYear && term) {
          const chunks = [];
          for (let i = 0; i < studentIds.length; i += 10)
            chunks.push(studentIds.slice(i, i + 10));

          // Safety check for Firestore 'in' query
          const validChunks = chunks.filter((c) => c.length > 0);
          const feesSnaps = await Promise.all(
            validChunks.map((chunk) =>
              getDocsFromServer(
                query(
                  collection(db, "studentFeeRecords"),
                  where("studentUid", "in", chunk),
                  where("academicYear", "==", academicYear),
                  where("term", "==", term),
                ) as any,
              ),
            ),
          );
          feesSnaps.forEach((fsnap) =>
            fsnap.docs.forEach((d) =>
              feesMap.set((d.data() as any).studentUid, d.data()),
            ),
          );
        }

        let batch: StudentDraft[] = studentDocs.map((d) => {
          const feeData = feesMap.get(d.id) as any;
          const userData = d.data() as any;

          // tuition-specific outstanding balance
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
            previousBalance: feeData
              ? feeData.arrears || 0
              : userData.walletBalance || 0,
            amountPaid: feeData ? feeData.amountPaid || 0 : 0,
            currentBalance: currentBalance,
            hasRecordInTerm: !!feeData,
            payments: feeData?.payments || [],
            termBill: feeData?.termBill || 0,
            discount: feeData?.discount || 0,
            editCount: feeData?.editCount || 0,
            onDiscount: userData.onDiscount,
            discountAmount: userData.discountAmount,
            onScholarship: userData.onScholarship,
            ptaBalance: userData.ptaBalance || 0,
            admissionBalance: userData.admissionBalance || 0,
            maintenanceBalance: userData.maintenanceBalance || 0,
            booksBalance: userData.booksBalance || 0,
            uniformBalance: userData.uniformBalance || 0,
            otherBalance: userData.otherBalance || 0,
          };
        });

        // Sort by name in memory since we removed server-side orderBy
        batch.sort((a, b) => a.fullName.localeCompare(b.fullName));

        lastVisibleRef.current = snap.docs[snap.docs.length - 1];
        hasMoreRef.current = snap.docs.length === PAGE_SIZE;
        setStudents((prev) => (isFirstLoad ? batch : [...prev, ...batch]));

        AsyncStorage.setItem(
          FILTERS_PERSISTENCE_KEY,
          JSON.stringify({ classId: selectedClassId }),
        );
      } catch (e) {
        console.error("Fetch students error:", e);
      } finally {
        isFetchingRef.current = false;
        setLoading(false);
        setFetchingMore(false);
        setRefreshing(false);
      }
    },
    [selectedClassId, academicYear, term, classes, showArchived],
  );

  const configKey = `${selectedClassId}_${academicYear}_${term}_${showArchived}`;

  useEffect(() => {
    if (selectedClassId) {
      setStudents([]);
      setLoading(true);
      fetchStudents(true);
    }
  }, [configKey]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStudents(true);
  };

  const fetchDailyPayments = async (date: Date) => {
    setLoadingDaily(true);
    const dateStr = moment(date).format("YYYY-MM-DD");
    try {
      const q = query(
        collection(db, "feePayments"),
        where("date", "==", dateStr),
      );
      const snap = await getDocsFromServer(q);
      const list = snap.docs.map((d) => d.data() as any);
      setDailyPayments(list);
    } catch (e) {
      console.error(e);
      showToast({ message: "Failed to fetch daily payments", type: "error" });
    } finally {
      setLoadingDaily(false);
    }
  };

  useEffect(() => {
    if (dailyModalVisible) {
      fetchDailyPayments(selectedDailyDate);
    }
  }, [dailyModalVisible, selectedDailyDate]);

  const exportPDF = async () => {
    const className =
      classes.find((c) => c.id === selectedClassId)?.name || "Class";
    const html = `
      <html>
        <head>
          <style>
            body { font-family: 'Helvetica'; padding: 20px; color: #1E293B; }
            .header { text-align: center; border-bottom: 2px solid #6366F1; padding-bottom: 10px; margin-bottom: 20px; }
            .title { font-size: 22px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background: #6366F1; color: white; padding: 10px; text-align: left; font-size: 12px; }
            td { border-bottom: 1px solid #E2E8F0; padding: 10px; font-size: 11px; }
            .summary { margin-top: 20px; text-align: right; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">${SCHOOL_CONFIG.fullName}</div>
            <div>Fee Status Report: ${className} - ${term} ${academicYear}</div>
          </div>
          <table>
            <thead><tr><th>Student</th><th>Prev. Arrears</th><th>Term Bill</th><th>Discount</th><th>Total Paid</th><th>Balance</th></tr></thead>
            <tbody>
              ${filteredStudents
                .map(
                  (s) => `
                <tr>
                  <td>${s.fullName}</td>
                  <td>${(s.previousBalance || 0).toFixed(2)}</td>
                  <td>${(s.termBill || 0).toFixed(2)}</td>
                  <td>${(s.discount || 0).toFixed(2)}</td>
                  <td>${(s.amountPaid || 0).toFixed(2)}</td>
                  <td style="color: ${(s.currentBalance || 0) > 0 ? "red" : "green"}">${(s.currentBalance || 0).toFixed(2)}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
          <div class="summary">
            <div>Total Expected: ₵${stats.expected.toFixed(2)}</div>
            <div>Total Discounts: ₵${(stats.totalDiscount || 0).toFixed(2)}</div>
            <div>Total Collected: ₵${stats.received.toFixed(2)}</div>
            <div>Total Outstanding: ₵${stats.balance.toFixed(2)}</div>
          </div>
        </body>
      </html>
    `;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri);
    } catch {
      showToast({ message: "Export failed", type: "error" });
    }
  };

  const saveFees = async () => {
    if (!canEdit) {
      showToast({
        message: "Access Denied: You don't have permission to modify billing.",
        type: "error",
      });
      return;
    }
    if (isConfigMissing) {
      showToast({
        message: "Action blocked: Academic year and term must be configured before billing.",
        type: "error",
      });
      return;
    }
    setSaving(true);
    try {
      const batch = writeBatch(db);
      const cleanYear = academicYear.replace(/\//g, "-");
      const cleanTerm = term.replace(/\s/g, "");
      const selectedUids = Array.from(selectedStudentUids);

      // Use the ref for the latest data to avoid closure issues or stale state
      const latestOverrides = individualBillOverridesRef.current;

      for (const uid of selectedUids) {
        const s = students.find((stud) => stud.uid === uid);
        if (!s || s.onScholarship) continue;

        const adjustmentStr = latestOverrides[uid] || termBillAmount;
        const adjustment = parseFloat(adjustmentStr);
        if (isNaN(adjustment) || adjustment === 0) continue;

        const recordId = `${uid}_${cleanYear}_${cleanTerm}`;
        const totalPaid = s.hasRecordInTerm ? s.amountPaid || 0 : 0;
        const arrears = s.previousBalance || 0;

        // Automated profile-based discount
        let discount = s.discount || 0;
        if (s.onDiscount && s.discountAmount && !s.hasRecordInTerm) {
          discount = s.discountAmount;
        }

        const currentBill = s.hasRecordInTerm ? s.termBill || 0 : 0;
        const currentEditCount = s.editCount || 0;

        if (currentEditCount >= 5) {
          showToast({
            message: `Student ${s.fullName} has reached the limit of 5 edits this term.`,
            type: "error",
          });
          continue;
        }

        // Correct balance calculation: Arrears (debt before this term) + New Total Bill - Discount - Amount Paid this term
        const newBill = currentBill + adjustment;
        const newBalance = arrears + newBill - discount - totalPaid;
        const totalPayable = arrears + newBill;

        if (isNaN(newBalance)) {
          console.error(`Invalid balance calculation for student ${uid}`);
          continue;
        }

        const feeRecordData: any = {
          studentUid: uid,
          studentName: s.fullName,
          classId: s.classId,
          className: s.className,
          academicYear,
          term,
          termBill: newBill,
          arrears: arrears,
          discount: discount,
          amountPaid: totalPaid,
          balance: newBalance,
          totalPayable: totalPayable,
          editCount: currentEditCount + 1,
          lastUpdated: serverTimestamp(),
        };

        // Initialize metadata for new term records
        if (!s.hasRecordInTerm) {
          feeRecordData.payments = [];
          feeRecordData.createdAt = serverTimestamp();
        }

        batch.set(doc(db, "studentFeeRecords", recordId), feeRecordData, {
          merge: true,
        });

        // Use atomic increment for walletBalance to support high concurrency and OtherCharges parity
        const walletAdjustment = adjustment - (s.hasRecordInTerm ? 0 : discount);
        batch.update(doc(db, "users", uid), {
          walletBalance: increment(walletAdjustment),
        });
      }
      await batch.commit();
      setBillModalVisible(false);
      setSelectedStudentUids(new Set());
      setIndividualBillOverrides({});
      fetchStudents(true);
      Alert.alert("Success", "Billing updated successfully.");
    } catch (e) {
      console.error(e);
      showToast({ message: "Save failed", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleLogPayment = async () => {
    if (!canEdit)
      return showToast({
        message: "You don't have permission to record payments.",
        type: "error",
      });
    if (isConfigMissing) {
      return showToast({
        message: "Action blocked: Academic year and term must be configured.",
        type: "error",
      });
    }
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || !selectedStudent || !receivedFrom.trim())
      return showToast({ message: "Incomplete data", type: "error" });
    setSaving(true);
    try {
      const recordId = `${selectedStudent.uid}_${academicYear.replace(/\//g, "-")}_${term.replace(/\s+/g, "")}`;
      const batch = writeBatch(db);

      // Calculate Tuition balance
      const tuitionArrears = selectedStudent.previousBalance || 0;
      const tuitionBill = selectedStudent.termBill || 0;
      const tuitionDiscount = selectedStudent.discount || 0;
      const tuitionPaid = selectedStudent.amountPaid || 0;
      const tuitionDue = tuitionArrears + tuitionBill - tuitionDiscount - tuitionPaid;

      let remainingAmount = amount;
      let tuitionContribution = 0;

      if (remainingAmount > 0) {
        tuitionContribution = Math.min(remainingAmount, Math.max(0, tuitionDue));
        remainingAmount -= tuitionContribution;
      }

      // 1. Record Tuition Payment (if any)
      if (tuitionContribution > 0) {
        const serial = `RC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const entry = {
          amount: tuitionContribution,
          method: paymentMethod,
          receivedFrom: receivedFrom.trim(),
          updatedBy: appUser?.adminRole || "Admin",
          adminUid: appUser?.uid || "unknown",
          createdAt: new Date().toISOString(),
          receiptNo: serial,
          date: moment().format("YYYY-MM-DD"),
          studentUid: selectedStudent.uid,
          studentName: selectedStudent.fullName,
          classId: selectedStudent.classId,
          className: selectedStudent.className,
          academicYear,
          term,
          type: "tuition",
        };

        if (!selectedStudent.hasRecordInTerm) {
          batch.set(doc(db, "studentFeeRecords", recordId), {
            studentUid: selectedStudent.uid,
            studentName: selectedStudent.fullName,
            classId: selectedStudent.classId,
            className: selectedStudent.className,
            academicYear,
            term,
            termBill: 0,
            arrears: tuitionArrears,
            amountPaid: tuitionContribution,
            balance: (tuitionArrears - tuitionContribution) + selectedStudent.ptaBalance + selectedStudent.maintenanceBalance + selectedStudent.admissionBalance + selectedStudent.booksBalance + selectedStudent.uniformBalance + selectedStudent.otherBalance,
            totalPayable: tuitionArrears + selectedStudent.ptaBalance + selectedStudent.maintenanceBalance + selectedStudent.admissionBalance + selectedStudent.booksBalance + selectedStudent.uniformBalance + selectedStudent.otherBalance,
            payments: [entry],
            editCount: 0,
            createdAt: serverTimestamp(),
            lastUpdated: serverTimestamp(),
          });
        } else {
          batch.update(doc(db, "studentFeeRecords", recordId), {
            amountPaid: increment(tuitionContribution),
            balance: increment(-tuitionContribution),
            payments: arrayUnion(entry),
            lastUpdated: serverTimestamp(),
          });
        }
        batch.set(doc(db, "feePayments", serial), entry);
      }

      // 2. Waterfall Allocation for Overpayment
      if (remainingAmount > 0) {
        // Targeted allocations for isolated balances first (Alignment with student-fee-history.tsx)
        const isolatedTargets = [
          { key: "pta", balance: selectedStudent.ptaBalance, field: "ptaBalance", paidField: "ptaPaid" },
          { key: "maintenance", balance: selectedStudent.maintenanceBalance, field: "maintenanceBalance", paidField: "maintenancePaid" },
          { key: "admission", balance: selectedStudent.admissionBalance, field: "admissionBalance", paidField: "admissionPaid" },
          { key: "books", balance: selectedStudent.booksBalance, field: "booksBalance", paidField: "booksPaid" },
          { key: "uniform", balance: selectedStudent.uniformBalance, field: "uniformBalance", paidField: "uniformPaid" },
          { key: "other", balance: selectedStudent.otherBalance, field: "otherBalance", paidField: "otherPaid" },
        ];

        for (const target of isolatedTargets) {
          if (remainingAmount <= 0) break;
          if (target.balance > 0) {
            const allocation = Math.min(remainingAmount, target.balance);
            const subSerial = `RC-${target.key.toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
            const subEntry = {
              amount: allocation,
              method: paymentMethod,
              receivedFrom: receivedFrom.trim(),
              updatedBy: appUser?.adminRole || "Admin",
              adminUid: appUser?.uid || "unknown",
              createdAt: new Date().toISOString(),
              receiptNo: subSerial,
              date: moment().format("YYYY-MM-DD"),
              studentUid: selectedStudent.uid,
              studentName: selectedStudent.fullName,
              classId: selectedStudent.classId,
              className: selectedStudent.className,
              academicYear,
              term,
              type: `${target.key}_payment`,
            };

            batch.set(doc(db, "feePayments", subSerial), subEntry);
            batch.update(doc(db, "studentFeeRecords", recordId), {
              [target.field]: increment(-allocation),
              [target.paidField]: increment(allocation),
              balance: increment(-allocation),
              payments: arrayUnion(subEntry),
              lastUpdated: serverTimestamp(),
            });

            // Update user document for specific balance
            batch.update(doc(db, "users", selectedStudent.uid), {
              [target.field]: increment(-allocation),
            });

            remainingAmount -= allocation;
          }
        }

        // Legacy/Generic waterfall for non-isolated categories
        if (remainingAmount > 0) {
          const q = query(
            collection(db, "feePayments"),
            where("studentUid", "==", selectedStudent.uid),
            where("academicYear", "==", academicYear),
            where("term", "==", term)
          );
          const snap = await getDocsFromServer(q);
          const payments = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));

          const categoryMap: Record<string, { billed: number; paid: number }> = {};
          payments.forEach(p => {
            const type = p.type || "other";
            const category = type.replace("_payment", "");
            const isPayment = type.endsWith("_payment");

            if (!categoryMap[category]) categoryMap[category] = { billed: 0, paid: 0 };
            if (isPayment) categoryMap[category].paid += p.amount;
            else if (!["tuition", "pta", "maintenance", "admission", "books", "uniform", "other"].includes(type))
              categoryMap[category].billed += p.amount;
          });

          const categories = Object.keys(categoryMap).filter(
            cat => !["tuition", "pta", "maintenance", "admission", "books", "uniform", "other"].includes(cat)
          );

          for (const cat of categories) {
            if (remainingAmount <= 0) break;
            const due = categoryMap[cat].billed - categoryMap[cat].paid;
            if (due > 0) {
              const allocation = Math.min(remainingAmount, due);
              const subSerial = `RC-${cat.toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
              const subEntry = {
                amount: allocation,
                method: paymentMethod,
                receivedFrom: receivedFrom.trim(),
                updatedBy: appUser?.adminRole || "Admin",
                adminUid: appUser?.uid || "unknown",
                createdAt: new Date().toISOString(),
                receiptNo: subSerial,
                date: moment().format("YYYY-MM-DD"),
                studentUid: selectedStudent.uid,
                studentName: selectedStudent.fullName,
                classId: selectedStudent.classId,
                className: selectedStudent.className,
                academicYear,
                term,
                type: `${cat}_payment`,
              };

              batch.set(doc(db, "feePayments", subSerial), subEntry);
              batch.update(doc(db, "studentFeeRecords", recordId), {
                amountPaid: increment(allocation),
                balance: increment(-allocation),
                payments: arrayUnion(subEntry),
                lastUpdated: serverTimestamp(),
              });
              remainingAmount -= allocation;
            }
          }
        }

        // 3. If still remaining, add to tuition as credit
        if (remainingAmount > 0) {
          const creditSerial = `RC-CR-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
          const creditEntry = {
            amount: remainingAmount,
            method: paymentMethod,
            receivedFrom: receivedFrom.trim(),
            updatedBy: appUser?.adminRole || "Admin",
            adminUid: appUser?.uid || "unknown",
            createdAt: new Date().toISOString(),
            receiptNo: creditSerial,
            date: moment().format("YYYY-MM-DD"),
            studentUid: selectedStudent.uid,
            studentName: selectedStudent.fullName,
            classId: selectedStudent.classId,
            className: selectedStudent.className,
            academicYear,
            term,
            type: "tuition_credit",
          };

          batch.update(doc(db, "studentFeeRecords", recordId), {
            amountPaid: increment(remainingAmount),
            balance: increment(-remainingAmount),
            payments: arrayUnion(creditEntry),
            lastUpdated: serverTimestamp(),
          });
          batch.set(doc(db, "feePayments", creditSerial), creditEntry);
          remainingAmount = 0;
        }
      }

      batch.update(doc(db, "users", selectedStudent.uid), {
        walletBalance: increment(-amount),
      });

      await batch.commit();

      // Send client-side notification to parent
      try {
        // Collect allocation summary for notification
        const allocations = [];
        if (tuitionContribution > 0) allocations.push(`Tuition: ${SCHOOL_CONFIG.currencySymbol}${tuitionContribution.toLocaleString()}`);

        // Re-calculate or track isolated allocations for the message
        const isolatedTargetsNotify = [
          { key: "PTA", balance: selectedStudent.ptaBalance },
          { key: "Maintenance", balance: selectedStudent.maintenanceBalance },
          { key: "Admission", balance: selectedStudent.admissionBalance },
          { key: "Books", balance: selectedStudent.booksBalance },
          { key: "Uniform", balance: selectedStudent.uniformBalance },
          { key: "Other", balance: selectedStudent.otherBalance },
        ];

        let tempRemaining = amount - tuitionContribution;
        for (const target of isolatedTargetsNotify) {
          if (tempRemaining <= 0) break;
          if (target.balance > 0) {
            const alloc = Math.min(tempRemaining, target.balance);
            allocations.push(`${target.key}: ${SCHOOL_CONFIG.currencySymbol}${alloc.toLocaleString()}`);
            tempRemaining -= alloc;
          }
        }

        if (tempRemaining > 0) {
          allocations.push(`Credit/Other: ${SCHOOL_CONFIG.currencySymbol}${tempRemaining.toLocaleString()}`);
        }

        const allocationText = allocations.length > 0 ? `\n\nAllocated to:\n- ${allocations.join("\n- ")}` : "";

        await sendNotification({
          recipientId: selectedStudent.uid,
          senderId: appUser?.uid || "admin",
          senderName: "School Finance",
          title: "Fee Payment Received",
          body: `A payment of ${SCHOOL_CONFIG.currencySymbol}${amount.toLocaleString()} has been recorded for ${selectedStudent.fullName}.${allocationText}`,
          type: "payment",
          data: {
            studentUid: selectedStudent.uid,
            amount,
            academicYear,
            term
          }
        });
      } catch (notifErr) {
        console.error("Failed to send payment notification:", notifErr);
      }

      setPaymentAmount("");
      setReceivedFrom("");
      setPaymentModalVisible(false);
      fetchStudents(true);
      showToast({
        message: `Payment processed and allocated.`,
        type: "success",
      });
    } catch (e: any) {
      console.error("Payment logging error:", e);
      showToast({
        message: `Payment failed: ${e.message || "Unknown error"}`,
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePayment = (payment: any) => {
    if (!selectedStudent) return;
    Alert.alert(
      "Confirm Deletion",
      "Are you sure you want to delete this transaction? This will automatically adjust the student's balance.",
      [
        { text: "Keep Transaction", style: "cancel" },
        {
          text: "Delete Permanently",
          style: "destructive",
          onPress: async () => {
            if (isConfigMissing) {
              return showToast({
                message: "Action blocked: Academic year and term must be configured.",
                type: "error",
              });
            }
            setSaving(true);
            try {
              const recordId = `${selectedStudent.uid}_${academicYear.replace(/\//g, "-")}_${term.replace(/\s+/g, "")}`;
              const batch = writeBatch(db);
              const amount = Number(payment.amount) || 0;
              const isPayment = (payment.type || "tuition").toLowerCase().endsWith("_payment") || (payment.type || "tuition").toLowerCase() === "tuition";

              if (isPayment) {
                // Reverting a payment INCREASES the debt
                batch.update(doc(db, "studentFeeRecords", recordId), {
                  amountPaid: increment(-amount),
                  balance: increment(amount),
                });

                // Handle isolated category reversions
                const type = (payment.type || "").toLowerCase();
                if (type === "pta_payment") {
                  batch.update(doc(db, "studentFeeRecords", recordId), {
                    ptaBalance: increment(amount),
                    ptaPaid: increment(-amount),
                  });
                  batch.update(doc(db, "users", selectedStudent.uid), {
                    ptaBalance: increment(amount),
                  });
                } else if (type === "maintenance_payment") {
                  batch.update(doc(db, "studentFeeRecords", recordId), {
                    maintenanceBalance: increment(amount),
                    maintenancePaid: increment(-amount),
                  });
                  batch.update(doc(db, "users", selectedStudent.uid), {
                    maintenanceBalance: increment(amount),
                  });
                } else if (type === "admission_payment") {
                  batch.update(doc(db, "studentFeeRecords", recordId), {
                    admissionBalance: increment(amount),
                    admissionPaid: increment(-amount),
                  });
                  batch.update(doc(db, "users", selectedStudent.uid), {
                    admissionBalance: increment(amount),
                  });
                } else if (type === "books_payment") {
                  batch.update(doc(db, "studentFeeRecords", recordId), {
                    booksBalance: increment(amount),
                    booksPaid: increment(-amount),
                  });
                  batch.update(doc(db, "users", selectedStudent.uid), {
                    booksBalance: increment(amount),
                  });
                } else if (type === "uniform_payment") {
                  batch.update(doc(db, "studentFeeRecords", recordId), {
                    uniformBalance: increment(amount),
                    uniformPaid: increment(-amount),
                  });
                  batch.update(doc(db, "users", selectedStudent.uid), {
                    uniformBalance: increment(amount),
                  });
                } else if (type === "other_payment") {
                  batch.update(doc(db, "studentFeeRecords", recordId), {
                    otherBalance: increment(amount),
                    otherPaid: increment(-amount),
                  });
                  batch.update(doc(db, "users", selectedStudent.uid), {
                    otherBalance: increment(amount),
                  });
                }

                batch.update(doc(db, "users", selectedStudent.uid), {
                  walletBalance: increment(amount),
                });
              } else {
                // Reverting a bill (charge) DECREASES the debt
                batch.update(doc(db, "studentFeeRecords", recordId), {
                  balance: increment(-amount),
                });
                batch.update(doc(db, "users", selectedStudent.uid), {
                  walletBalance: increment(-amount),
                });
              }

              batch.update(doc(db, "studentFeeRecords", recordId), {
                payments: arrayRemove(payment),
              });

              // Also delete from dedicated feePayments collection
              if (payment.receiptNo) {
                batch.delete(doc(db, "feePayments", payment.receiptNo));
              }

              await batch.commit();
              fetchStudents(true);
              setPaymentModalVisible(false);
              showToast({
                message: "Transaction reverted and balance updated.",
                type: "success",
              });
            } catch {
              showToast({ message: "Failed to delete", type: "error" });
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  const saveDiscounts = async () => {
    if (!canEdit) {
      showToast({
        message:
          "Access Denied: You don't have permission to modify discounts.",
        type: "error",
      });
      return;
    }
    if (isConfigMissing) {
      showToast({
        message: "Action blocked: Academic year and term must be configured.",
        type: "error",
      });
      return;
    }
    setSaving(true);
    try {
      const batch = writeBatch(db);
      const cleanYear = academicYear.replace(/\//g, "-");
      const cleanTerm = term.replace(/\s/g, "");
      const selectedUids = Array.from(selectedStudentUids);

      for (const uid of selectedUids) {
        const s = students.find((stud) => stud.uid === uid);
        if (!s || s.onScholarship) continue;

        const discountStr = individualDiscountOverrides[uid] || discountAmount;
        const discountValue = parseFloat(discountStr);
        if (isNaN(discountValue) || discountValue <= 0) continue;

        const recordId = `${uid}_${cleanYear}_${cleanTerm}`;
        const totalPaid = s.hasRecordInTerm ? s.amountPaid || 0 : 0;
        const arrears = s.previousBalance || 0;
        const currentBill = s.hasRecordInTerm ? s.termBill || 0 : 0;
        const currentEditCount = s.editCount || 0;

        if (currentEditCount >= 5) {
          showToast({
            message: `Student ${s.fullName} has reached the limit of 5 edits this term.`,
            type: "error",
          });
          continue;
        }

        // Balance calculation: Arrears + Term Bill - Discount - Amount Paid
        const newBalance = arrears + currentBill - discountValue - totalPaid;
        const totalPayable = arrears + currentBill;

        if (isNaN(newBalance)) {
          console.error(`Invalid balance calculation for student ${uid}`);
          continue;
        }

        const feeRecordData: any = {
          studentUid: uid,
          studentName: s.fullName,
          classId: s.classId,
          className: s.className,
          academicYear,
          term,
          termBill: currentBill,
          arrears: arrears,
          amountPaid: totalPaid,
          balance: newBalance,
          totalPayable: totalPayable,
          discount: discountValue,
          editCount: currentEditCount + 1,
          lastUpdated: serverTimestamp(),
        };

        // Initialize metadata for new term records
        if (!s.hasRecordInTerm) {
          feeRecordData.payments = [];
          feeRecordData.createdAt = serverTimestamp();
        }

        batch.set(doc(db, "studentFeeRecords", recordId), feeRecordData, {
          merge: true,
        });

        // Use atomic increment for discount changes to ensure walletBalance parity
        const currentDiscount = s.discount || 0;
        const discountChange = discountValue - currentDiscount;
        batch.update(doc(db, "users", uid), {
          walletBalance: increment(-discountChange),
        });
      }
      await batch.commit();
      setDiscountModalVisible(false);
      setSelectedStudentUids(new Set());
      setIndividualDiscountOverrides({});
      setDiscountAmount("");
      fetchStudents(true);
      showToast({
        message: "Discounts applied successfully.",
        type: "success",
      });
    } catch (e) {
      console.error(e);
      showToast({ message: "Failed to apply discounts", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const renderStudentItem = ({ item }: { item: StudentDraft }) => {
    const isSelected = selectedStudentUids.has(item.uid);
    const hasDebt = (item.currentBalance || 0) > 0;

    // In "adjustment" mode, we show what is being added/deducted rather than the total
    const currentBillValue =
      individualBillOverrides[item.uid] ?? termBillAmount;

    const hasActiveBill =
      !!currentBillValue && parseFloat(String(currentBillValue)) !== 0;
    const hasOverride = individualBillOverrides[item.uid] !== undefined;
    const isEditLocked = item.editCount >= 5;

    return (
      <Animatable.View
        animation="fadeInUp"
        duration={400}
        style={styles.cardWrapper}
      >
        <TouchableOpacity
          style={[styles.financeCard, isSelected && styles.selectedCard]}
          activeOpacity={0.8}
          onPress={() => {
            if (activeMode === "billing" || activeMode === "discounts") {
              setSelectedStudentUids((prev) => {
                const next = new Set(prev);
                if (next.has(item.uid)) next.delete(item.uid);
                else next.add(item.uid);
                return next;
              });
            } else {
              setSelectedStudent(item);
              setPaymentModalVisible(true);
            }
          }}
        >
          <View
            style={[
              styles.statusIndicator,
              { backgroundColor: hasDebt ? VIBE.danger : VIBE.success },
            ]}
          />
          <View style={styles.cardContent}>
            <View style={styles.leftSection}>
              <View
                style={[
                  styles.avatar,
                  {
                    backgroundColor: hasDebt
                      ? VIBE.danger + "10"
                      : VIBE.success + "10",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.avatarText,
                    { color: hasDebt ? VIBE.danger : VIBE.success },
                  ]}
                >
                  {(item.fullName || "S").charAt(0)}
                </Text>
              </View>
              <View style={styles.mainInfo}>
                <Text style={styles.studentName} numberOfLines={1}>
                  {item.fullName}
                </Text>
                {item.studentID ? (
                  <Text style={{ fontSize: 10, color: VIBE.primary, fontWeight: "800" }}>
                    ID: {item.studentID}
                  </Text>
                ) : null}
                <View style={styles.debtBox}>
                  <Text
                    style={[
                      styles.debtLabel,
                      { color: hasDebt ? VIBE.danger : VIBE.success },
                    ]}
                  >
                    {hasDebt ? "Outstanding: " : "Cleared"}
                  </Text>
                  <Text
                    style={[
                      styles.debtValue,
                      { color: hasDebt ? VIBE.danger : VIBE.success },
                    ]}
                  >
                    ₵
                    {Math.abs(item.currentBalance || 0).toLocaleString(
                      undefined,
                      { minimumFractionDigits: 2 },
                    )}
                  </Text>
                </View>
                {item.termBill > 0 && (
                  <Text
                    style={{
                      fontSize: 10,
                      color: VIBE.muted,
                      fontWeight: "700",
                      marginTop: 2,
                    }}
                  >
                    Term Bill: ₵{item.termBill.toFixed(2)}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.rightSection}>
              {activeMode === "billing" ? (
                <View style={{ alignItems: "flex-end" }}>
                  <View
                    style={[
                      styles.billingBubble,
                      hasActiveBill && styles.billingBubbleActive,
                      hasOverride && styles.billingBubbleOverride,
                    ]}
                  >
                    <Text
                      style={[
                        styles.bubbleSym,
                        (hasActiveBill || hasOverride) && styles.textWhite,
                      ]}
                    >
                      ₵
                    </Text>
                    <TextInput
                      style={[
                        styles.bubbleInput,
                        (hasActiveBill || hasOverride) && styles.textWhite,
                      ]}
                      placeholder="+/- ₵"
                      placeholderTextColor={
                        hasActiveBill ? "rgba(255,255,255,0.6)" : VIBE.muted
                      }
                      value={currentBillValue ? String(currentBillValue) : ""}
                      onChangeText={(v) =>
                        setIndividualBillOverrides(
                          (p: Record<string, string>) => ({
                            ...p,
                            [item.uid]: v,
                          }),
                        )
                      }
                      keyboardType="numbers-and-punctuation"
                      editable={canEdit && !isEditLocked}
                    />
                  </View>
                  {isEditLocked && (
                    <Text
                      style={{
                        fontSize: 8,
                        color: VIBE.danger,
                        fontWeight: "700",
                        marginTop: 2,
                      }}
                    >
                      EDIT LIMIT REACHED
                    </Text>
                  )}
                </View>
              ) : activeMode === "discounts" ? (
                <View style={{ alignItems: "flex-end" }}>
                  <View
                    style={[
                      styles.billingBubble,
                      (!!individualDiscountOverrides[item.uid] || !!discountAmount) && {
                        backgroundColor: VIBE.success,
                        borderColor: VIBE.success,
                      },
                      !!individualDiscountOverrides[item.uid] && styles.billingBubbleOverride,
                    ]}
                  >
                    <Text
                      style={[
                        styles.bubbleSym,
                        (!!individualDiscountOverrides[item.uid] || !!discountAmount) && styles.textWhite,
                        { color: (!!individualDiscountOverrides[item.uid] || !!discountAmount) ? "#fff" : VIBE.success }
                      ]}
                    >
                      -
                    </Text>
                    <TextInput
                      style={[
                        styles.bubbleInput,
                        (!!individualDiscountOverrides[item.uid] || !!discountAmount) && styles.textWhite,
                      ]}
                      placeholder="₵"
                      placeholderTextColor={
                        (!!individualDiscountOverrides[item.uid] || !!discountAmount)
                          ? "rgba(255,255,255,0.6)"
                          : VIBE.muted
                      }
                      value={
                        individualDiscountOverrides[item.uid] !== undefined
                          ? String(individualDiscountOverrides[item.uid])
                          : ""
                      }
                      onChangeText={(v) =>
                        setIndividualDiscountOverrides((p) => ({
                          ...p,
                          [item.uid]: v,
                        }))
                      }
                      keyboardType="numeric"
                      editable={canEdit && !isEditLocked}
                    />
                  </View>
                  <Text
                    style={{
                      fontSize: 9,
                      color: VIBE.muted,
                      fontWeight: "700",
                      marginTop: 4,
                    }}
                  >
                    PROFILE: ₵{(item.discountAmount || 0).toFixed(2)}
                  </Text>
                  {isEditLocked && (
                    <Text
                      style={{
                        fontSize: 8,
                        color: VIBE.danger,
                        fontWeight: "700",
                        marginTop: 2,
                      }}
                    >
                      EDIT LIMIT REACHED
                    </Text>
                  )}
                </View>
              ) : (
                <View style={styles.actionIcons}>
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push({
                        pathname: "/admin-dashboard/student-fee-history",
                        params: { studentId: item.uid, academicYear, term },
                      });
                    }}
                    style={styles.historyCircle}
                  >
                    <SVGIcon name="time" size={18} color={VIBE.primary} />
                  </TouchableOpacity>
                  <SVGIcon name="chevron-forward" size={18} color="#CBD5E1" />
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Animatable.View>
    );
  };

  if (!appUser || !canView) {
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
            You do not have the required permissions to manage fees.
          </Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => router.replace("/admin-dashboard")}
          >
            <Text style={styles.errorButtonText}>Return to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <LinearGradient
          colors={[primaryBrand, secondaryBrand]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerTop}
        >
          <View style={styles.navBar}>
            <TouchableOpacity
              onPress={() => router.replace("/admin-dashboard")}
              style={styles.headerIconBtn}
            >
              <SVGIcon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.titleCenter}>
              <Text style={styles.headerTitle}>Finance Central</Text>
              <Text style={styles.headerSub}>ADMINISTRATION</Text>
            </View>
            <TouchableOpacity
              onPress={() => setDailyModalVisible(true)}
              style={styles.headerIconBtn}
            >
              <SVGIcon name="calendar-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.selectorGrid}>
            <TouchableOpacity
              style={styles.glassPill}
              onPress={() => setSelectorModal({ visible: true, type: "class" })}
            >
              <Text style={styles.glassLabel}>TARGET CLASS</Text>
              <Text style={styles.glassValue} numberOfLines={1}>
                {selectedClassId === "all"
                  ? "All Classes"
                  : classes.find((c) => c.id === selectedClassId)?.name ||
                    "Select Class"}
              </Text>
            </TouchableOpacity>
            <View style={styles.glassPill}>
              <Text style={styles.glassLabel}>ACADEMIC YEAR</Text>
              <Text style={styles.glassValue}>{academicYear || "Not Set"}</Text>
            </View>
            <View style={styles.glassPill}>
              <Text style={styles.glassLabel}>TERM</Text>
              <Text style={styles.glassValue}>{term || "Not Set"}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.searchStrip}>
          <View style={styles.searchBar}>
            <SVGIcon name="search" size={18} color={VIBE.muted} />
            <TextInput
              placeholder="Search name or receipt..."
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={VIBE.muted}
            />
          </View>

          <TouchableOpacity
            onPress={() => setShowArchived(!showArchived)}
            style={[
              styles.archiveToggle,
              showArchived && { backgroundColor: COLORS.secondary },
            ]}
          >
            <SVGIcon
              name="archive"
              size={18}
              color={showArchived ? "#fff" : VIBE.muted}
            />
            <Text
              style={[
                styles.archiveToggleText,
                { color: showArchived ? "#fff" : VIBE.muted },
              ]}
            >
              {showArchived ? "ACTIVE" : "ARCHIVE"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleRefresh}
            style={styles.refreshRound}
          >
            <SVGIcon name="refresh" size={18} color={VIBE.primary} />
          </TouchableOpacity>
        </View>

        {!isConfigMissing && (
          <View style={styles.modeToggleArea}>
            <View style={styles.modeTabs}>
              <TouchableOpacity
                style={[
                  styles.modeTab,
                  activeMode === "payment" && styles.activeModeTab,
                ]}
                onPress={() => setActiveMode("payment")}
              >
                <SVGIcon
                  name="cash"
                  size={18}
                  color={activeMode === "payment" ? "#fff" : VIBE.muted}
                />
                <Text
                  style={[
                    styles.modeTabText,
                    activeMode === "payment" && { color: "#fff" },
                  ]}
                >
                  PAYMENTS
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modeTab,
                  activeMode === "billing" && styles.activeModeTab,
                ]}
                onPress={() => setActiveMode("billing")}
              >
                <SVGIcon
                  name="document-text"
                  size={18}
                  color={activeMode === "billing" ? "#fff" : VIBE.muted}
                />
                <Text
                  style={[
                    styles.modeTabText,
                    activeMode === "billing" && { color: "#fff" },
                  ]}
                >
                  BILLING
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modeTab,
                  activeMode === "discounts" && styles.activeModeTab,
                ]}
                onPress={() => setActiveMode("discounts")}
              >
                <SVGIcon
                  name="pricetag"
                  size={18}
                  color={activeMode === "discounts" ? "#fff" : VIBE.muted}
                />
                <Text
                  style={[
                    styles.modeTabText,
                    activeMode === "discounts" && { color: "#fff" },
                  ]}
                >
                  DISCOUNTS
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <View style={styles.mainBody}>
        {isConfigMissing && (
          <View style={styles.warningStrip}>
            <SVGIcon name="alert-circle" size={18} color="#92400E" />
            <Text style={styles.warningText}>
              Academic configuration is missing. Term-based billing is disabled.
            </Text>
            <TouchableOpacity onPress={() => router.push("/academic-calendar")}>
              <Text style={styles.warningLink}>Configure Now</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isConfigMissing && activeMode === "billing" ? (
            <View style={styles.bulkActionStrip}>
              <View style={styles.bulkInputContainer}>
                <Text style={styles.bulkSym}>₵</Text>
                <TextInput
                  placeholder="Bulk Bill (+/-)"
                  placeholderTextColor={VIBE.muted}
                  style={styles.bulkInput}
                  keyboardType="numbers-and-punctuation"
                  value={termBillAmount}
                  onChangeText={setTermBillAmount}
                  editable={canEdit}
                />
              </View>
              <TouchableOpacity
                style={styles.checkAllBtn}
                onPress={() => {
                  const allSelected =
                    filteredStudents.length > 0 &&
                    filteredStudents.every((s) =>
                      selectedStudentUids.has(s.uid),
                    );
                  setSelectedStudentUids(
                    new Set(
                      allSelected ? [] : filteredStudents.map((s) => s.uid),
                    ),
                  );
                }}
              >
                <SVGIcon
                  name={
                    filteredStudents.length > 0 &&
                    filteredStudents.every((s) =>
                      selectedStudentUids.has(s.uid),
                    )
                      ? "checkbox"
                      : "square"
                  }
                  size={28}
                  color={VIBE.primary}
                />
                <Text style={styles.checkAllText}>SELECT ALL</Text>
              </TouchableOpacity>
            </View>
          ) : activeMode === "discounts" ? (
            <View style={styles.bulkActionStrip}>
              <View style={styles.bulkInputContainer}>
                <Text style={[styles.bulkSym, { color: VIBE.success }]}>-</Text>
                <TextInput
                  placeholder="Bulk Discount (₵)"
                  placeholderTextColor={VIBE.muted}
                  style={styles.bulkInput}
                  keyboardType="numbers-and-punctuation"
                  value={discountAmount}
                  onChangeText={setDiscountAmount}
                  editable={canEdit}
                />
              </View>
              <TouchableOpacity
                style={styles.checkAllBtn}
                onPress={() => {
                  const allSelected =
                    filteredStudents.length > 0 &&
                    filteredStudents.every((s) =>
                      selectedStudentUids.has(s.uid),
                    );
                  setSelectedStudentUids(
                    new Set(
                      allSelected ? [] : filteredStudents.map((s) => s.uid),
                    ),
                  );
                }}
              >
                <SVGIcon
                  name={
                    filteredStudents.length > 0 &&
                    filteredStudents.every((s) =>
                      selectedStudentUids.has(s.uid),
                    )
                      ? "checkbox"
                      : "square"
                  }
                  size={28}
                  color={VIBE.success}
                />
                <Text style={styles.checkAllText}>SELECT ALL</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.listHeaderRow}>
            <Text style={styles.listTitle}>Student Directory</Text>
            <View style={styles.filterChips}>
              {["all", "debt", "cleared"].map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[
                    styles.filterChip,
                    statusFilter === f && {
                      backgroundColor: VIBE.primary,
                      borderColor: VIBE.primary,
                    },
                  ]}
                  onPress={() => setStatusFilter(f as any)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      statusFilter === f && { color: "#fff" },
                    ]}
                  >
                    {f === "cleared" ? "PAID" : f.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={true}
            contentContainerStyle={{ paddingHorizontal: 0 }}
            style={{ width: "100%" }}
          >
            <View style={{ minWidth: Math.max(width, 1100) }}>
              <FlatList
                ListHeaderComponent={() => {
                  if (
                    activeMode === "payment" &&
                    students.length > 0 &&
                    !searchQuery
                  ) {
                    return (
                      <View style={{ zIndex: 10 }}>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.statsDashboard}
                        >
                          <Animatable.View
                            animation="zoomIn"
                            style={[styles.statBox, { backgroundColor: VIBE.info }]}
                          >
                            <Text style={styles.statLabel}>EXPECTED</Text>
                            <Text style={styles.statValue}>
                              ₵{stats.expected.toLocaleString()}
                            </Text>
                            <View style={styles.statIcon}>
                              <SVGIcon
                                name="analytics"
                                size={24}
                                color="rgba(255,255,255,0.3)"
                              />
                            </View>
                          </Animatable.View>
                          <Animatable.View
                            animation="zoomIn"
                            delay={100}
                            style={[
                              styles.statBox,
                              { backgroundColor: VIBE.success },
                            ]}
                          >
                            <Text style={styles.statLabel}>RECEIVED</Text>
                            <Text style={styles.statValue}>
                              ₵{stats.received.toLocaleString()}
                            </Text>
                            <View style={styles.statIcon}>
                              <SVGIcon
                                name="wallet"
                                size={24}
                                color="rgba(255,255,255,0.3)"
                              />
                            </View>
                          </Animatable.View>
                          <Animatable.View
                            animation="zoomIn"
                            delay={150}
                            style={[styles.statBox, { backgroundColor: VIBE.purple }]}
                          >
                            <Text style={styles.statLabel}>DISCOUNTS</Text>
                            <Text style={styles.statValue}>
                              ₵{stats.totalDiscount.toLocaleString()}
                            </Text>
                            <View style={styles.statIcon}>
                              <SVGIcon
                                name="pricetag"
                                size={24}
                                color="rgba(255,255,255,0.3)"
                              />
                            </View>
                          </Animatable.View>
                          <Animatable.View
                            animation="zoomIn"
                            delay={200}
                            style={[
                              styles.statBox,
                              { backgroundColor: VIBE.danger },
                            ]}
                          >
                            <Text style={styles.statLabel}>OUTSTANDING</Text>
                            <Text style={styles.statValue}>
                              ₵{stats.balance.toLocaleString()}
                            </Text>
                            <View style={styles.statIcon}>
                              <SVGIcon
                                name="alert-circle"
                                size={24}
                                color="rgba(255,255,255,0.3)"
                              />
                            </View>
                          </Animatable.View>
                        </ScrollView>
                      </View>
                    );
                  }
                  if (activeMode === "discounts" && filteredStudents.length > 0) {
                    return (
                      <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
                        <Animatable.View
                          animation="fadeInDown"
                          style={[
                            styles.statBox,
                            {
                              backgroundColor: VIBE.success,
                              width: "100%",
                              height: 90,
                              borderRadius: 20,
                            },
                          ]}
                        >
                          <Text style={styles.statLabel}>
                            TOTAL ESTIMATED DISCOUNTS (LISTED)
                          </Text>
                          <Text style={[styles.statValue, { fontSize: 24 }]}>
                            ₵
                            {totalProfileDiscountsSum.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}
                          </Text>
                          <View style={styles.statIcon}>
                            <SVGIcon
                              name="pricetag"
                              size={28}
                              color="rgba(255,255,255,0.3)"
                            />
                          </View>
                        </Animatable.View>
                      </View>
                    );
                  }
                  return null;
                }}
                data={filteredStudents}
                extraData={{
                  activeMode,
                  termBillAmount,
                  individualBillOverrides,
                  selectedStudentUids,
                }}
                keyExtractor={(item) => item.uid}
                onEndReached={() => fetchStudents(false)}
                renderItem={renderStudentItem}
                contentContainerStyle={styles.flatListContent}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    colors={[VIBE.primary]}
                  />
                }
                removeClippedSubviews={Platform.OS === "android"}
                ListEmptyComponent={
                  !loading ? (
                    <View style={styles.emptyWrap}>
                      <SVGIcon name="people" size={64} color="#CBD5E1" />
                      <Text style={styles.emptyText}>No records found</Text>
                    </View>
                  ) : (
                    <ActivityIndicator
                      size="large"
                      color={VIBE.primary}
                      style={{ marginTop: 50 }}
                    />
                  )
                }
              />
            </View>
          </ScrollView>
        </View>
      )}

      {activeMode === "billing" && selectedStudentUids.size > 0 && canEdit && (
        <Animatable.View animation="bounceIn" style={styles.fabWrap}>
          <TouchableOpacity
            style={styles.mainFab}
            onPress={() => setBillModalVisible(true)}
          >
            <LinearGradient
              colors={[VIBE.primary, VIBE.purple]}
              style={styles.fabGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.fabText}>
                APPLY BILLS ({selectedStudentUids.size})
              </Text>
              <SVGIcon name="checkmark-done-circle" size={22} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </Animatable.View>
      )}

      {activeMode === "discounts" &&
        selectedStudentUids.size > 0 &&
        canEdit && (
          <Animatable.View animation="bounceIn" style={styles.fabWrap}>
            <TouchableOpacity
              style={styles.mainFab}
              onPress={() => setDiscountModalVisible(true)}
            >
              <LinearGradient
                colors={[VIBE.success, VIBE.info]}
                style={styles.fabGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.fabText}>
                  APPLY DISCOUNTS ({selectedStudentUids.size})
                </Text>
                <SVGIcon name="pricetag" size={22} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </Animatable.View>
        )}

      {/* Selector Modal */}
      <Modal visible={selectorModal.visible} transparent animationType="slide">
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setSelectorModal({ visible: false, type: null })}
        >
          <View style={styles.sheetBody}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Select Class</Text>
            <ScrollView>
              <TouchableOpacity
                style={[
                  styles.sheetItem,
                  selectedClassId === "all" && styles.activeSheetItem,
                ]}
                onPress={() => {
                  setSelectedClassId("all");
                  setSelectorModal({ visible: false, type: null });
                }}
              >
                <Text
                  style={[
                    styles.sheetItemText,
                    selectedClassId === "all" && styles.activeSheetItemText,
                  ]}
                >
                  All Classes
                </Text>
              </TouchableOpacity>
              {classes.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.sheetItem,
                    selectedClassId === c.id && styles.activeSheetItem,
                  ]}
                  onPress={() => {
                    setSelectedClassId(c.id);
                    setSelectorModal({ visible: false, type: null });
                  }}
                >
                  <Text
                    style={[
                      styles.sheetItemText,
                      selectedClassId === c.id && styles.activeSheetItemText,
                    ]}
                  >
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Payment Modal */}
      <Modal visible={paymentModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.overlay}
        >
          <View style={styles.paymentModal}>
            <View style={styles.modalTopRow}>
              <Text style={styles.modalStudentName}>
                {selectedStudent?.fullName || "Student Profile"}
              </Text>
              <TouchableOpacity
                onPress={() => setPaymentModalVisible(false)}
                style={styles.closeRound}
              >
                <SVGIcon name="close" size={24} color={VIBE.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
            >
              <View style={styles.modalInputs}>
                <TextInput
                  style={styles.pillInput}
                  placeholder="Amount (₵)"
                  keyboardType="numeric"
                  value={paymentAmount}
                  onChangeText={setPaymentAmount}
                  editable={canEdit}
                  placeholderTextColor={VIBE.muted}
                />
                <TextInput
                  style={styles.pillInput}
                  placeholder="Received From"
                  value={receivedFrom}
                  onChangeText={setReceivedFrom}
                  editable={canEdit}
                  placeholderTextColor={VIBE.muted}
                />
              </View>
              <View style={styles.methodGrid}>
                {["Cash", "Cheque", "Momo", "E-cash"].map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.methodBtn,
                      paymentMethod === m && { backgroundColor: VIBE.primary },
                    ]}
                    onPress={() => setPaymentMethod(m as any)}
                    disabled={!canEdit}
                  >
                    <Text
                      style={[
                        styles.methodText,
                        paymentMethod === m && { color: "#fff" },
                      ]}
                    >
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: VIBE.primary }]}
                onPress={handleLogPayment}
                disabled={saving || !canEdit}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>CONFIRM PAYMENT</Text>
                )}
              </TouchableOpacity>

              <View style={styles.historyBlock}>
                <View style={styles.historyHeader}>
                  <Text style={styles.blockTitle}>Term Transactions</Text>
                </View>
                {selectedStudent?.payments?.length ? (
                  selectedStudent.payments
                    .slice()
                    .reverse()
                    .map((p, i) => (
                      <View
                        key={p.receiptNo || i}
                        style={styles.transactionTile}
                      >
                        <View style={{ flex: 1 }}>
                          <View style={styles.tileHeader}>
                            <View>
                              <Text style={styles.tileAmt}>
                                ₵{(p.amount || 0).toFixed(2)}
                              </Text>
                              <Text
                                style={{
                                  fontSize: 9,
                                  fontWeight: "800",
                                  color: VIBE.muted,
                                }}
                              >
                                {p.receiptNo || "N/A"}
                              </Text>
                            </View>
                            <TouchableOpacity
                              onPress={() => handleDeletePayment(p)}
                            >
                              <SVGIcon
                                name="trash"
                                size={16}
                                color={VIBE.danger}
                              />
                            </TouchableOpacity>
                          </View>
                          <Text style={styles.tileDetail}>
                            {p.method} • Received from {p.receivedFrom}
                          </Text>
                          <Text style={styles.tileDate}>
                            {p.createdAt
                              ? new Date(p.createdAt).toLocaleDateString()
                              : "N/A"}{" "}
                            at{" "}
                            {p.createdAt
                              ? new Date(p.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}
                          </Text>
                        </View>
                      </View>
                    ))
                ) : (
                  <Text style={styles.noHistory}>
                    No payments recorded this term.
                  </Text>
                )}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Confirmation Modal for Billing */}
      <Modal visible={billModalVisible} transparent animationType="fade">
        <View style={styles.overlayCenter}>
          <View style={styles.alertCard}>
            <Text style={styles.alertTitle}>Bulk Billing?</Text>
            <Text style={styles.alertText}>
              Apply these adjustments to {selectedStudentUids.size} accounts?
            </Text>
            <View style={styles.alertBtnRow}>
              <TouchableOpacity
                onPress={() => setBillModalVisible(false)}
                style={styles.alertBtnSec}
              >
                <Text style={styles.alertBtnTextSec}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveFees}
                style={[styles.alertBtnPri, { backgroundColor: VIBE.primary }]}
              >
                <Text style={styles.alertBtnTextPri}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Discount Modal */}
      <Modal visible={discountModalVisible} transparent animationType="fade">
        <View style={styles.overlayCenter}>
          <View style={styles.alertCard}>
            <Text style={styles.alertTitle}>Apply Discounts?</Text>
            <Text style={styles.alertText}>
              Apply discounts to {selectedStudentUids.size} selected students?
              {"\n"}This will reduce their outstanding balance.
            </Text>
            <View style={styles.alertBtnRow}>
              <TouchableOpacity
                onPress={() => setDiscountModalVisible(false)}
                style={styles.alertBtnSec}
              >
                <Text style={styles.alertBtnTextSec}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveDiscounts}
                style={[styles.alertBtnPri, { backgroundColor: VIBE.success }]}
              >
                <Text style={styles.alertBtnTextPri}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Daily Payments Modal */}
      <Modal visible={dailyModalVisible} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.sheetBody, { height: "90%", maxHeight: "90%" }]}>
            <View style={styles.modalTopRow}>
              <Text style={styles.modalStudentName}>Daily Collections</Text>
              <TouchableOpacity
                onPress={() => setDailyModalVisible(false)}
                style={styles.closeRound}
              >
                <SVGIcon name="close" size={24} color={VIBE.muted} />
              </TouchableOpacity>
            </View>

            {Platform.OS === "web" ? (
              <input
                type="date"
                value={moment(selectedDailyDate).format("YYYY-MM-DD")}
                onChange={(e) => {
                  const date = new Date(e.target.value);
                  if (!isNaN(date.getTime())) {
                    setSelectedDailyDate(date);
                  }
                }}
                style={{
                  width: "100%",
                  padding: "15px",
                  borderRadius: "15px",
                  border: `1px solid ${VIBE.border}`,
                  fontSize: "16px",
                  marginBottom: "20px",
                  backgroundColor: VIBE.bg,
                  color: VIBE.text,
                  fontFamily: "inherit",
                  outline: "none",
                }}
              />
            ) : (
              <TouchableOpacity
                style={styles.dateSelector}
                onPress={() => setShowDatePicker(true)}
              >
                <SVGIcon name="calendar" size={20} color={VIBE.primary} />
                <Text style={styles.dateText}>
                  {moment(selectedDailyDate).format("MMMM Do, YYYY")}
                </Text>
                <SVGIcon name="chevron-down" size={20} color={VIBE.muted} />
              </TouchableOpacity>
            )}

            {showDatePicker && Platform.OS !== "web" && (
              <DateTimePicker
                value={selectedDailyDate}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setShowDatePicker(false);
                  if (date) setSelectedDailyDate(date);
                }}
              />
            )}

            <View style={styles.dailyTotalCard}>
              <Text style={styles.dailyTotalLabel}>TOTAL COLLECTED</Text>
              <Text style={styles.dailyTotalValue}>
                ₵
                {dailyPayments
                  .reduce((acc, p) => acc + (p.amount || 0), 0)
                  .toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>
            </View>

            {loadingDaily ? (
              <ActivityIndicator
                size="large"
                color={VIBE.primary}
                style={{ marginTop: 40 }}
              />
            ) : (
              <FlatList
                data={dailyPayments}
                keyExtractor={(item, index) =>
                  item.receiptNo || index.toString()
                }
                contentContainerStyle={{ paddingBottom: 20 }}
                renderItem={({ item }) => (
                  <View style={styles.dailyPaymentItem}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={styles.dailyStudentName}>
                          {item.studentName}
                        </Text>
                        {item.type && item.type !== "tuition" && (
                          <View style={{
                            backgroundColor: VIBE.primary + "15",
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 6,
                          }}>
                            <Text style={{
                              fontSize: 9,
                              fontWeight: "900",
                              color: VIBE.primary,
                              textTransform: "uppercase"
                            }}>
                              {item.type}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.dailyStudentClass}>
                        {item.className || "N/A"}
                      </Text>
                      <Text style={styles.dailyReceipt}>
                        {item.receiptNo} • {item.method}
                      </Text>
                    </View>
                    <Text style={styles.dailyAmount}>
                      ₵{(item.amount || 0).toFixed(2)}
                    </Text>
                  </View>
                )}
                ListEmptyComponent={() => (
                  <View style={styles.emptyWrap}>
                    <SVGIcon name="cash" size={48} color="#CBD5E1" />
                    <Text style={styles.emptyText}>
                      No payments on this day.
                    </Text>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VIBE.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    ...SHADOWS.medium,
  },
  headerTop: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 10 : 30,
    paddingBottom: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  titleCenter: { alignItems: "center" },
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#fff" },
  headerSub: {
    fontSize: 10,
    fontWeight: "800",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 2,
  },
  selectorGrid: { flexDirection: "row", gap: 10 },
  glassPill: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 15,
    padding: 10,
  },
  glassLabel: {
    fontSize: 8,
    fontWeight: "900",
    color: "rgba(255,255,255,0.6)",
    marginBottom: 2,
  },
  glassValue: { fontSize: 13, fontWeight: "800", color: "#fff" },
  searchStrip: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginTop: -20,
    alignItems: "center",
    gap: 10,
    marginBottom: 15,
  },
  archiveToggle: {
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    ...SHADOWS.small,
  },
  archiveToggleText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  searchBar: {
    flex: 1,
    height: 50,
    backgroundColor: "#fff",
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    ...SHADOWS.medium,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    fontWeight: "600",
    color: VIBE.text,
  },
  refreshRound: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.small,
  },
  modeToggleArea: { paddingHorizontal: 20, marginBottom: 20 },
  modeTabs: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 5,
    ...SHADOWS.small,
  },
  modeTab: {
    flex: 1,
    height: 45,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  activeModeTab: { backgroundColor: VIBE.primary, ...SHADOWS.medium },
  modeTabText: { fontSize: 12, fontWeight: "800", color: VIBE.muted },
  statsDashboard: { paddingHorizontal: 20, paddingBottom: 30, gap: 15 },
  statBox: {
    width: 180,
    height: 110,
    borderRadius: 30,
    padding: 20,
    justifyContent: "center",
    // Ensure the stat boxes sit above list items on platforms that need elevation/zIndex
    zIndex: 2,
    elevation: 3,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 1,
  },
  statValue: { fontSize: 20, fontWeight: "900", color: "#fff", marginTop: 5 },
  statIcon: { position: "absolute", bottom: 15, right: 15 },
  mainBody: { flex: 1 },
  bulkActionStrip: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: "center",
    gap: 15,
  },
  bulkInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    height: 56,
    borderRadius: 20,
    paddingHorizontal: 20,
    ...SHADOWS.small,
  },
  bulkSym: {
    fontSize: 18,
    fontWeight: "900",
    color: VIBE.primary,
    marginRight: 10,
  },
  bulkInput: { flex: 1, fontSize: 16, fontWeight: "700", color: VIBE.text },
  checkAllBtn: { alignItems: "center", gap: 4 },
  checkAllText: { fontSize: 9, fontWeight: "900" },
  listHeaderRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  listTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: VIBE.muted,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  filterChips: { flexDirection: "row", gap: 8 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: VIBE.border,
  },
  filterChipText: { fontSize: 10, fontWeight: "900", color: VIBE.muted },
  flatListContent: { paddingHorizontal: 20, paddingBottom: 120 },
  cardWrapper: { marginBottom: 15 },
  financeCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 14,
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: VIBE.border,
  },
  selectedCard: {
    borderColor: VIBE.primary,
    backgroundColor: VIBE.primary + "05",
  },
  statusIndicator: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
    borderTopLeftRadius: 25,
    borderBottomLeftRadius: 25,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  leftSection: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { fontSize: 20, fontWeight: "900" },
  mainInfo: { flex: 1, marginLeft: 15, minWidth: 0 },
  studentName: { fontSize: 16, fontWeight: "800", color: VIBE.text },
  debtBox: { flexDirection: "row", alignItems: "center", marginTop: 3 },
  debtLabel: { fontSize: 12, fontWeight: "600" },
  debtValue: { fontSize: 12, fontWeight: "800" },
  rightSection: {
    marginLeft: 10,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  billingBubble: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 15,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    width: 80,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.small,
  },
  billingBubbleActive: {
    backgroundColor: VIBE.primary,
    borderColor: VIBE.primary,
  },
  billingBubbleOverride: {
    backgroundColor: VIBE.purple,
    borderColor: VIBE.purple,
  },
  bubbleSym: {
    fontSize: 14,
    fontWeight: "900",
    color: VIBE.muted,
    marginRight: 4,
  },
  bubbleInput: {
    fontSize: 14,
    fontWeight: "bold",
    color: VIBE.text,
    textAlign: "center",
    minWidth: 40,
    flexShrink: 1,
    padding: 0,
    ...(Platform.OS === "android" ? {} : { letterSpacing: 0.5 }),
  },
  actionIcons: { flexDirection: "row", alignItems: "center", gap: 12 },
  historyCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: VIBE.bg,
  },
  fabWrap: { position: "absolute", bottom: 30, left: 20, right: 20 },
  mainFab: {
    height: 64,
    borderRadius: 24,
    overflow: "hidden",
    ...SHADOWS.large,
  },
  fabGrad: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  fabText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.6)",
    justifyContent: "flex-end",
  },
  overlayCenter: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.8)",
    justifyContent: "center",
    padding: 25,
  },
  sheetBody: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 25,
    maxHeight: "80%",
  },
  sheetHandle: {
    width: 40,
    height: 5,
    backgroundColor: VIBE.border,
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: VIBE.text,
    textAlign: "center",
    marginBottom: 25,
  },
  sheetItem: {
    padding: 20,
    borderRadius: 18,
    marginBottom: 8,
    backgroundColor: VIBE.bg,
  },
  activeSheetItem: { backgroundColor: VIBE.primary },
  sheetItemText: {
    fontSize: 16,
    fontWeight: "700",
    color: VIBE.text,
    textAlign: "center",
  },
  activeSheetItemText: { color: "#fff" },
  paymentModal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 45,
    borderTopRightRadius: 45,
    padding: 30,
    maxHeight: "90%",
  },
  modalTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 35,
  },
  modalStudentName: { fontSize: 20, fontWeight: "900", color: VIBE.text },
  closeRound: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: VIBE.bg,
    justifyContent: "center",
    alignItems: "center",
  },
  modalInputs: { gap: 15, marginBottom: 30 },
  pillInput: {
    backgroundColor: VIBE.bg,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: VIBE.border,
    fontSize: 20,
    fontWeight: "900",
    color: VIBE.text,
  },
  methodGrid: { flexDirection: "row", gap: 10, marginBottom: 30 },
  methodBtn: {
    flex: 1,
    height: 48,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: VIBE.border,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: VIBE.bg,
  },
  methodText: { fontSize: 12, fontWeight: "800", color: VIBE.muted },
  saveBtn: {
    height: 64,
    borderRadius: 24,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    ...SHADOWS.medium,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1,
  },
  historyBlock: {
    marginTop: 40,
    borderTopWidth: 1,
    borderTopColor: VIBE.border,
    paddingTop: 35,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
  },
  blockTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: VIBE.text,
    letterSpacing: 0.5,
  },
  viewFullText: { fontSize: 13, fontWeight: "800" },
  transactionTile: {
    backgroundColor: VIBE.bg,
    padding: 20,
    borderRadius: 24,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: VIBE.border,
  },
  tileHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  tileAmt: { fontSize: 18, fontWeight: "900", color: VIBE.primary },
  tileDetail: { fontSize: 13, color: VIBE.text, fontWeight: "700" },
  tileDate: {
    fontSize: 11,
    color: VIBE.muted,
    fontWeight: "800",
    marginTop: 8,
  },
  noHistory: {
    textAlign: "center",
    color: VIBE.muted,
    marginTop: 20,
    fontStyle: "italic",
  },
  alertCard: {
    backgroundColor: "#fff",
    width: "100%",
    borderRadius: 35,
    padding: 30,
    alignItems: "center",
  },
  alertTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: VIBE.text,
    marginBottom: 12,
  },
  alertText: {
    fontSize: 14,
    color: VIBE.muted,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 35,
  },
  alertBtnRow: { flexDirection: "row", gap: 15 },
  alertBtnPri: {
    flex: 1.5,
    height: 60,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.medium,
  },
  alertBtnSec: {
    flex: 1,
    height: 60,
    backgroundColor: VIBE.bg,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  alertBtnTextPri: { color: "#fff", fontWeight: "900", fontSize: 16 },
  alertBtnTextSec: { color: VIBE.text, fontWeight: "800", fontSize: 16 },
  emptyWrap: { alignItems: "center", marginTop: 100, opacity: 0.5 },
  emptyText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#94A3B8",
    marginTop: 20,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    marginTop: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1E293B",
    marginTop: 20,
    marginBottom: 10,
  },
  linkBtn: {
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 20,
    marginTop: 20,
    ...SHADOWS.medium,
  },
  linkBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  textWhite: { color: "#fff" },
  dateSelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: VIBE.bg,
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    gap: 12,
  },
  dateText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: VIBE.text,
  },
  dailyTotalCard: {
    backgroundColor: VIBE.primary + "10",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
  },
  dailyTotalLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: VIBE.primary,
    ...(Platform.OS !== "android" && { letterSpacing: 1 }),
  },
  dailyTotalValue: {
    fontSize: 24,
    fontWeight: "900",
    color: VIBE.primary,
    marginTop: 5,
  },
  dailyPaymentItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    backgroundColor: "#fff",
    borderRadius: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: VIBE.border,
  },
  dailyStudentName: {
    fontSize: 14,
    fontWeight: "800",
    color: VIBE.text,
  },
  dailyStudentClass: {
    fontSize: 11,
    color: VIBE.muted,
    fontWeight: "700",
    marginTop: 2,
  },
  dailyReceipt: {
    fontSize: 10,
    color: VIBE.muted,
    marginTop: 4,
  },
  dailyAmount: {
    fontSize: 16,
    fontWeight: "900",
    color: VIBE.success,
  },
  warningStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    padding: 12,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 20,
    borderRadius: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  warningText: {
    flex: 1,
    fontSize: 11,
    color: "#92400E",
    fontWeight: "700",
  },
  warningLink: {
    fontSize: 11,
    color: VIBE.primary,
    fontWeight: "900",
    textDecorationLine: "underline",
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
