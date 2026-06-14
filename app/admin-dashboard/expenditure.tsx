import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocsFromServer,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import moment from "moment";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebaseConfig";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";

import { useToast } from "../../contexts/ToastContext";

// Guarded import for native-only library
const DateTimePicker =
  Platform.OS !== "web"
    ? require("@react-native-community/datetimepicker").default
    : null;

const CACHE_EXPIRY = 1000 * 60 * 60 * 24; // 24 Hours

const EXPENDITURE_STRUCTURE: Record<string, string[]> = {
  "Staff & Payroll": [
    "Salaries",
    "Wages (casual workers)",
    "Teacher allowances",
    "Overtime payments",
    "SSNIT / pension contributions",
    "Staff welfare",
    "Bonuses",
    "Recruitment expenses",
    "Staff training",
  ],
  "Academic & Teaching": [
    "Textbooks",
    "Exercise books",
    "Teaching aids",
    "Printing & photocopying",
    "Examination materials",
    "Laboratory materials",
    "Curriculum materials",
    "Educational software subscriptions",
  ],
  Utilities: [
    "Electricity",
    "Water",
    "Internet",
    "Telephone",
    "Generator fuel",
    "Waste collection",
  ],
  "Maintenance & Repairs": [
    "Building maintenance",
    "Plumbing",
    "Electrical repairs",
    "Furniture repairs",
    "Air conditioner servicing",
    "Painting",
    "Cleaning supplies",
  ],
  "ICT & Technology": [
    "Computers",
    "Printers",
    "Software licenses",
    "Website hosting",
    "App subscriptions",
    "Network equipment",
    "Repairs",
    "CCTV",
  ],
  Administration: [
    "Office stationery",
    "Printing",
    "Postage",
    "Bank charges",
    "Office equipment",
    "Meetings",
    "Licenses & registrations",
  ],
  "Transport & Logistics": [
    "Fuel",
    "Vehicle maintenance",
    "Vehicle insurance",
    "Driver allowance",
    "School bus operations",
  ],
  "Student Welfare": [
    "Student feeding",
    "Medical support",
    "Student activities",
    "Awards",
    "Counseling",
  ],
  "Events & Programs": [
    "Speech & prize giving",
    "Sports",
    "Excursions",
    "Graduation",
    "Orientation",
    "Cultural activities",
  ],
  "Security & Safety": [
    "Security personnel",
    "CCTV maintenance",
    "Fire extinguishers",
    "Insurance",
    "Emergency expenses",
  ],
  "Assets & Capital Projects": [
    "Land",
    "Building projects",
    "Furniture",
    "Vehicles",
    "Equipment purchase",
  ],
  "Marketing & Admissions": [
    "Advertising",
    "Flyers",
    "Social media",
    "Website promotion",
    "Admissions campaigns",
  ],
  "Regulatory & Compliance": [
    "Government fees",
    "Accreditation",
    "Audit fees",
    "Legal services",
  ],
  "Miscellaneous / Emergency": [
    "Emergency purchases",
    "Miscellaneous",
    "Contingency",
  ],
};

const EXPENDITURE_CATEGORIES = Object.keys(EXPENDITURE_STRUCTURE);

type Expenditure = {
  id: string;
  item: string;
  category?: string;
  subCategory?: string;
  amount: number;
  date: string;
  adminName: string;
  adminRole: string;
  status: "open" | "closed";
  academicYear: string;
  term: string;
  createdAt: any;
};

type GroupedExpenditure = {
  item: string;
  displayItem: string;
  monthTotal: number;
  termTotal: number;
  count: number;
};

export default function ExpenditureScreen() {
  const router = useRouter();
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const acadConfig = useAcademicConfig();
  const insets = useSafeAreaInsets();

  // Access Control
  const isTeacherRole = appUser?.role?.toLowerCase() === "teacher";
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
  const expPermission = appUser?.permissions?.["expenditure"] || "deny";
  const canView =
    isSuperAdmin ||
    expPermission === "full" ||
    expPermission === "view" ||
    expPermission === "edit";
  const canEdit =
    isSuperAdmin || expPermission === "full" || expPermission === "edit";

  // Brand Fallbacks
  const primaryBrand =
    SCHOOL_CONFIG.primaryColor || COLORS.primary || "#2e86de";
  const secondaryBrand = SCHOOL_CONFIG.secondaryColor || primaryBrand;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expenditures, setExpenditures] = useState<Expenditure[]>([]);
  const [serverTotal, setServerTotal] = useState(0);

  const [selectedYear, setSelectedYear] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("");
  const [isPreviousTerm, setIsPreviousTerm] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [itemDate, setItemDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // View mode: 'detailed' or 'summary'
  const [viewMode, setViewMode] = useState<"detailed" | "summary">("detailed");

  useEffect(() => {
    if (appUser && !canView) {
      showToast({
        message:
          "Access Denied: You do not have permission to view expenditures.",
        type: "error",
      });
      router.replace("/admin-dashboard");
    }
  }, [appUser, canView]);

  useEffect(() => {
    const onBackPress = () => {
      if (modalVisible) {
        setModalVisible(false);
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress,
    );
    return () => subscription.remove();
  }, [modalVisible]);

  useEffect(() => {
    if (!acadConfig.loading) {
      setSelectedYear(acadConfig.academicYear || "");
      setSelectedTerm(acadConfig.currentTerm || "");
      if (!acadConfig.academicYear || !acadConfig.currentTerm) {
        setLoading(false);
      }
    }
  }, [acadConfig]);

  useEffect(() => {
    if (!selectedYear || !selectedTerm) {
      setLoading(false);
      return;
    }

    // Only show full-screen loading if we don't have any expenditures yet
    // This prevents the "refresh" flicker when adding items or background syncing
    if (expenditures.length === 0) {
      setLoading(true);
    }

    const q = query(
      collection(db, "expenditures"),
      where("academicYear", "==", selectedYear),
      where("term", "==", selectedTerm),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      q,
      { includeMetadataChanges: true }, // Ensure PWA shows local changes immediately
      (snapshot) => {
        const list = snapshot.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            ...data,
            amount: Number(data.amount) || 0,
            item: data.item || "Unnamed Expense",
            category: data.category || "",
            subCategory: data.subCategory || "",
            date: data.date || "N/A",
            adminName: data.adminName || "Admin",
            adminRole: data.adminRole || "Staff",
            createdAt: data.createdAt || null,
          } as Expenditure;
        });

        // Local sort to ensure pending items (with null createdAt) appear at top immediately in PWA
        const sorted = list.sort((a, b) => {
          const getMillis = (ts: any) =>
            ts?.toMillis ? ts.toMillis() : Date.now() + 10000;
          return getMillis(b.createdAt) - getMillis(a.createdAt);
        });

        // Ensure uniqueness and valid data
        const uniqueList = Array.from(
          new Map(sorted.map((item) => [item.id, item])).values(),
        );
        setExpenditures(uniqueList);

        // Update total spending locally from the current list
        const total = uniqueList.reduce(
          (sum, item) => sum + (item.amount || 0),
          0,
        );
        setServerTotal(total);

        setLoading(false);
        setRefreshing(false);
      },
      (error) => {
        console.error("Expenditure snapshot error:", error);
        setLoading(false);
        setRefreshing(false);
      },
    );

    return () => unsubscribe();
  }, [selectedYear, selectedTerm]);

  // Manual fetch for pull-to-refresh (forces server fetch)
  const fetchExpenditures = useCallback(
    async (force = false) => {
      if (!selectedYear || !selectedTerm) return;
      setRefreshing(true);
      try {
        const q = query(
          collection(db, "expenditures"),
          where("academicYear", "==", selectedYear),
          where("term", "==", selectedTerm),
          orderBy("createdAt", "desc"),
        );

        const snap = await getDocsFromServer(q as any);
        const list = snap.docs.map(
          (d) => ({ id: d.id, ...(d.data() as any) }) as Expenditure,
        );
        const uniqueList = Array.from(
          new Map(list.map((item) => [item.id, item])).values(),
        );
        setExpenditures(uniqueList);
        const total = uniqueList.reduce(
          (sum, item) => sum + (item.amount || 0),
          0,
        );
        setServerTotal(total);
      } catch (e) {
        console.error("fetchExpenditures error:", e);
      } finally {
        setRefreshing(false);
      }
    },
    [selectedYear, selectedTerm],
  );

  const fetchPreviousTerm = () => {
    if (!acadConfig.academicYear || !acadConfig.currentTerm) return;

    let prevTerm = "";
    let prevYear = acadConfig.academicYear;

    if (
      acadConfig.currentTerm.toLowerCase().includes("term 3") ||
      acadConfig.currentTerm.toLowerCase().includes("3rd")
    ) {
      prevTerm = "Term 2";
    } else if (
      acadConfig.currentTerm.toLowerCase().includes("term 2") ||
      acadConfig.currentTerm.toLowerCase().includes("2nd")
    ) {
      prevTerm = "Term 1";
    } else {
      // If it's Term 1, go back to previous year Term 3
      const yearParts = acadConfig.academicYear.split("/");
      if (yearParts.length === 2) {
        const startYear = parseInt(yearParts[0]);
        const endYear = parseInt(yearParts[1]);
        prevYear = `${startYear - 1}/${endYear - 1}`;
        prevTerm = "Term 3";
      }
    }

    if (prevTerm) {
      setSelectedYear(prevYear);
      setSelectedTerm(prevTerm);
      setIsPreviousTerm(true);
      showToast({
        message: `Viewing Archive: ${prevYear} - ${prevTerm}`,
        type: "info",
      });
    }
  };

  const resetToCurrentTerm = () => {
    setSelectedYear(acadConfig.academicYear || "");
    setSelectedTerm(acadConfig.currentTerm || "");
    setIsPreviousTerm(false);
  };

  const addExpenditure = async () => {
    if (!canEdit)
      return showToast({
        message: "You don't have permission to add entries.",
        type: "error",
      });

    const cleanItemName = itemName.trim();
    const cleanAmount = parseFloat(amount);

    if (!cleanItemName || isNaN(cleanAmount))
      return showToast({
        message: "Please provide a valid item name and amount.",
        type: "error",
      });

    if (!appUser)
      return showToast({ message: "Session expired.", type: "error" });

    setSaving(true);
    try {
      await addDoc(collection(db, "expenditures"), {
        item: cleanItemName,
        category: category.trim(),
        subCategory: subCategory.trim(),
        amount: cleanAmount,
        date:
          itemDate instanceof Date
            ? itemDate.toISOString().split("T")[0]
            : itemDate,
        adminName: appUser?.profile?.firstName || "Admin",
        adminRole: appUser?.adminRole || "Administrator",
        status: "open",
        academicYear: selectedYear,
        term: selectedTerm,
        createdAt: serverTimestamp(),
      });

      setModalVisible(false);
      setItemName("");
      setCategory("");
      setSubCategory("");
      setAmount("");
      showToast({
        message: "Expenditure added successfully.",
        type: "success",
      });
    } catch (e) {
      showToast({ message: "Save failed.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpenditure = (item: Expenditure) => {
    if (!canEdit) return;

    const performDelete = async () => {
      setDeletingId(item.id);
      try {
        // Perform direct client-side deletion
        await deleteDoc(doc(db, "expenditures", item.id));

        // Optional: Log to activity_logs for audit since we're doing it client-side
        try {
          await addDoc(collection(db, "activity_logs"), {
            action: "DELETE_EXPENDITURE",
            performedBy: appUser?.uid,
            adminName: appUser?.profile?.firstName || "Unknown Admin",
            details: {
              item: item.item,
              amount: item.amount,
              expenditureDate: item.date,
            },
            timestamp: serverTimestamp(),
          });
        } catch (logErr) {
          console.warn(
            "Audit log failed, but expenditure was deleted:",
            logErr,
          );
        }

        showToast({ message: "Entry deleted successfully.", type: "success" });
      } catch (e: any) {
        console.error("Delete error:", e);
        showToast({
          message: e.message || "Could not delete entry.",
          type: "error",
        });
      } finally {
        setDeletingId(null);
      }
    };

    if (Platform.OS === "web") {
      if (
        window.confirm(
          `Are you sure you want to remove "${item.item}"? This action cannot be undone.`,
        )
      ) {
        performDelete();
      }
    } else {
      Alert.alert(
        "Confirm Delete",
        `Are you sure you want to remove "${item.item}"? This action cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: performDelete,
          },
        ],
      );
    }
  };

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
            You do not have the required permissions to view expenditures.
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

  const isConfigMissing = !selectedYear || !selectedTerm;

  // Helper function to normalize item names for grouping
  // Groups all payroll-related items under "Payroll"
  const normalizeItemKey = (
    itemName: string,
  ): { key: string; displayItem: string } => {
    const lower = itemName.toLowerCase().trim();

    // Payroll-related keywords - all will be grouped as "Payroll"
    const payrollKeywords = [
      "payroll",
      "salary",
      "salaries",
      "wages",
      "wage",
      "staff salary",
      "staff salaries",
      "staff wages",
      "employee salary",
      "employee salaries",
      "employee wages",
      "teacher salary",
      "teacher salaries",
      "teacher wages",
      "staff payroll",
      "salary payment",
      "salary payments",
      "wage payment",
      "wage payments",
      "monthly salary",
      "monthly wages",
      "staff compensation",
      "employee compensation",
      "payroll expense",
      "payroll expenses",
      "salary expense",
      "salary expenses",
    ];

    // Check if the item matches any payroll keyword
    for (const keyword of payrollKeywords) {
      if (
        lower === keyword ||
        lower.includes(keyword) ||
        lower.includes(keyword + " ") ||
        lower.includes(" " + keyword)
      ) {
        return { key: "__payroll__", displayItem: "Payroll" };
      }
    }

    // For non-payroll items, use the lowercase trimmed name as key
    return { key: lower, displayItem: itemName.trim() };
  };

  // Compute grouped expenditure summary (case-insensitive)
  const groupedSummary = useMemo((): GroupedExpenditure[] => {
    if (expenditures.length === 0) return [];

    const now = moment();
    const currentMonthStart = now.clone().startOf("month");

    // Group by normalized item key
    const grouped = new Map<
      string,
      {
        displayItem: string;
        monthTotal: number;
        termTotal: number;
        count: number;
      }
    >();

    expenditures.forEach((exp) => {
      const { key: itemKey, displayItem } =
        exp.category && exp.category.trim() !== ""
          ? {
              key: exp.category.toLowerCase().trim(),
              displayItem: exp.category.trim(),
            }
          : normalizeItemKey(exp.item);
      const existing = grouped.get(itemKey);

      if (!existing) {
        grouped.set(itemKey, {
          displayItem,
          monthTotal: 0,
          termTotal: 0,
          count: 0,
        });
      }

      const group = grouped.get(itemKey)!;
      group.count += 1;
      group.termTotal += exp.amount || 0;

      // Check if expense is within current month
      const expDate = moment(exp.date);
      if (expDate.isSameOrAfter(currentMonthStart)) {
        group.monthTotal += exp.amount || 0;
      }
    });

    // Convert to array and sort by termTotal descending
    return Array.from(grouped.entries())
      .map(([item, data]) => ({
        item,
        displayItem: data.displayItem,
        monthTotal: data.monthTotal,
        termTotal: data.termTotal,
        count: data.count,
      }))
      .sort((a, b) => b.termTotal - a.termTotal);
  }, [expenditures]);

  const summaryTotal = useMemo(() => {
    return groupedSummary.reduce((sum, item) => sum + item.termTotal, 0);
  }, [groupedSummary]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      <LinearGradient
        colors={[primaryBrand, "#1E293B"]}
        style={styles.headerGradient}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <SVGIcon name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Expenditures</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {!isConfigMissing && !isPreviousTerm && (
              <TouchableOpacity
                onPress={fetchPreviousTerm}
                style={styles.smallActionBtn}
              >
                <SVGIcon name="time-outline" size={18} color="#fff" />
              </TouchableOpacity>
            )}
            {canEdit && !isConfigMissing && !isPreviousTerm && (
              <TouchableOpacity
                onPress={() => setModalVisible(true)}
                style={styles.addBtn}
              >
                <SVGIcon name="add" size={24} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryContent}>
            <Text style={styles.summaryLabel}>TOTAL PERIOD SPENDING</Text>
            <Text style={styles.summaryValue}>
              ₵
              {(serverTotal || 0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </Text>
          </View>

          <View style={styles.viewToggleCompact}>
            <TouchableOpacity
              style={[
                styles.toggleItem,
                viewMode === "detailed" && styles.toggleItemActive,
              ]}
              onPress={() => setViewMode("detailed")}
            >
              <SVGIcon name="list" size={14} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleItem,
                viewMode === "summary" && styles.toggleItemActive,
              ]}
              onPress={() => setViewMode("summary")}
            >
              <SVGIcon name="pie-chart" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.compactFilterRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{selectedYear || "N/A"}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{selectedTerm || "N/A"}</Text>
          </View>
          {isPreviousTerm && (
            <TouchableOpacity
              onPress={resetToCurrentTerm}
              style={styles.archiveBadge}
            >
              <SVGIcon name="refresh" size={12} color="#fff" />
              <Text style={styles.archiveText}>ARCHIVE - Return</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {isConfigMissing ? (
        <View style={styles.emptyContainer}>
          <SVGIcon name="settings-outline" size={80} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>Configuration Required</Text>
          <TouchableOpacity
            style={[
              styles.saveBtn,
              { backgroundColor: primaryBrand, width: 200, marginTop: 20 },
            ]}
            onPress={() => router.push("/academic-calendar")}
          >
            <Text style={styles.saveBtnText}>Go to Calendar</Text>
          </TouchableOpacity>
        </View>
      ) : viewMode === "summary" ? (
        // Summary View - Grouped Expenditures
        <FlatList
          data={groupedSummary}
          keyExtractor={(item) => item.item}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchExpenditures(true)}
              colors={[primaryBrand]}
            />
          }
          contentContainerStyle={styles.listContent}
          removeClippedSubviews={Platform.OS === "android"}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <SVGIcon name="receipt" size={80} color="#CBD5E1" />
              <Text style={styles.emptyText}>No expenses recorded.</Text>
            </View>
          }
          ListHeaderComponent={
            groupedSummary.length > 0 ? (
              <View style={styles.summaryHeader}>
                <Text style={styles.summaryHeaderText}>
                  BULK EXPENDITURE SUMMARY
                </Text>
                <Text style={styles.summarySubHeader}>
                  Case-insensitive grouping • {groupedSummary.length} categories
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item, index }) => (
            <Animatable.View
              animation="fadeInUp"
              duration={400}
              delay={index * 50}
              style={styles.summaryCard}
            >
              <View style={styles.summaryCardHeader}>
                <View style={styles.summaryItemInfo}>
                  <Text style={styles.summaryItemName}>{item.displayItem}</Text>
                  <Text style={styles.summaryItemCount}>
                    {item.count} transaction{item.count !== 1 ? "s" : ""}
                  </Text>
                </View>
                <View style={styles.summaryAmounts}>
                  <View style={styles.summaryAmountRow}>
                    <Text style={styles.summaryAmountLabel}>This Month:</Text>
                    <Text style={styles.summaryMonthAmount}>
                      ₵
                      {item.monthTotal.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </Text>
                  </View>
                  <View style={styles.summaryAmountRow}>
                    <Text style={styles.summaryAmountLabel}>This Term:</Text>
                    <Text style={styles.summaryTermAmount}>
                      ₵
                      {item.termTotal.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </Text>
                  </View>
                </View>
              </View>
              {/* Progress bar showing proportion of term total */}
              {summaryTotal > 0 && (
                <View style={styles.progressBarContainer}>
                  <View
                    style={[
                      styles.progressBar,
                      {
                        width: `${Math.max((item.termTotal / summaryTotal) * 100, 2)}%`,
                        backgroundColor:
                          index % 2 === 0 ? primaryBrand : secondaryBrand,
                      },
                    ]}
                  />
                </View>
              )}
            </Animatable.View>
          )}
        />
      ) : (
        // Detailed View - Individual Expenditures
        <FlatList
          data={expenditures}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchExpenditures(true)}
              colors={[primaryBrand]}
            />
          }
          contentContainerStyle={styles.listContent}
          removeClippedSubviews={Platform.OS === "android"}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <SVGIcon name="receipt" size={80} color="#CBD5E1" />
              <Text style={styles.emptyText}>No expenses recorded.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Animatable.View
              animation="fadeInUp"
              duration={400}
              style={styles.card}
            >
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  {item.category ? (
                    <Text style={styles.categoryBadgeText}>
                      {item.category.toUpperCase()}
                      {item.subCategory ? ` • ${item.subCategory.toUpperCase()}` : ""}
                    </Text>
                  ) : null}
                  <Text style={styles.itemTitle}>
                    {item.item || "Unnamed Expense"}
                  </Text>
                  <View style={styles.dateRow}>
                    <SVGIcon
                      name="calendar"
                      size={12}
                      color={COLORS.gray || "#9ca3af"}
                    />
                    <Text style={styles.dateText}>{item.date || "N/A"}</Text>
                  </View>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 15,
                  }}
                >
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.itemAmount}>
                      ₵
                      {(item.amount || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </Text>
                    <View style={styles.adminBadge}>
                      <Text style={styles.adminText}>
                        {item.adminName} • {item.adminRole}
                      </Text>
                    </View>
                  </View>
                  {canEdit && (
                    <TouchableOpacity
                      onPress={() => handleDeleteExpenditure(item)}
                      style={styles.deleteBtn}
                      disabled={deletingId === item.id}
                    >
                      {deletingId === item.id ? (
                        <ActivityIndicator size="small" color="#EF4444" />
                      ) : (
                        <SVGIcon
                          name="trash-outline"
                          size={20}
                          color="#EF4444"
                        />
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </Animatable.View>
          )}
        />
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Expense</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <SVGIcon name="close-circle" size={32} color="#CBD5E1" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalInputWrapper}>
              <Text style={styles.modalInputLabel}>CATEGORY</Text>
              <View style={styles.categoryChipContainer}>
                {EXPENDITURE_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryChip,
                      category === cat && {
                        backgroundColor: primaryBrand,
                        borderColor: primaryBrand,
                      },
                    ]}
                    onPress={() => {
                      setCategory(cat);
                      setSubCategory("");
                    }}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        category === cat && { color: "#fff" },
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={[styles.modalInput, { marginTop: 8 }]}
                placeholder="Or type custom category..."
                value={category}
                onChangeText={setCategory}
                placeholderTextColor="#94A3B8"
              />
            </View>

            {category && EXPENDITURE_STRUCTURE[category] && (
              <View style={styles.modalInputWrapper}>
                <Text style={styles.modalInputLabel}>SUB-CATEGORY</Text>
                <View style={styles.categoryChipContainer}>
                  {EXPENDITURE_STRUCTURE[category].map((sub) => (
                    <TouchableOpacity
                      key={sub}
                      style={[
                        styles.categoryChip,
                        subCategory === sub && {
                          backgroundColor: secondaryBrand,
                          borderColor: secondaryBrand,
                        },
                      ]}
                      onPress={() => setSubCategory(sub)}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          subCategory === sub && { color: "#fff" },
                        ]}
                      >
                        {sub}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={[styles.modalInput, { marginTop: 8 }]}
                  placeholder="Or type custom sub-category..."
                  value={subCategory}
                  onChangeText={setSubCategory}
                  placeholderTextColor="#94A3B8"
                />
              </View>
            )}

            <View style={styles.modalInputWrapper}>
              <Text style={styles.modalInputLabel}>WHAT WAS PURCHASED?</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Printer Toner"
                value={itemName}
                onChangeText={setItemName}
                placeholderTextColor="#94A3B8"
              />
            </View>
            <View style={styles.modalInputWrapper}>
              <Text style={styles.modalInputLabel}>AMOUNT (₵)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="0.00"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.modalInputWrapper}>
              <Text style={styles.modalInputLabel}>DATE OF EXPENDITURE</Text>
              {Platform.OS === "web" ? (
                <View
                  style={[
                    styles.modalInput,
                    { flexDirection: "row", alignItems: "center", gap: 10 },
                  ]}
                >
                  <SVGIcon
                    name="calendar-outline"
                    size={18}
                    color={primaryBrand}
                  />
                  <TextInput
                    style={
                      {
                        flex: 1,
                        backgroundColor: "transparent",
                        fontSize: 16,
                        fontWeight: "600",
                        color: "#1E293B",
                        outlineStyle: "none",
                      } as any
                    }
                    defaultValue={itemDate.toISOString().split("T")[0]}
                    onChangeText={(val) => {
                      const parsed = moment(
                        val,
                        [
                          "YYYY-MM-DD",
                          "DD-MM-YYYY",
                          "MM-DD-YYYY",
                          "DD/MM/YYYY",
                          "MM/DD/YYYY",
                        ],
                        true,
                      );
                      if (parsed.isValid()) {
                        setItemDate(parsed.toDate());
                      }
                    }}
                    {...({ type: "date" } as any)}
                  />
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={[
                      styles.modalInput,
                      { flexDirection: "row", alignItems: "center", gap: 10 },
                    ]}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <SVGIcon
                      name="calendar-outline"
                      size={18}
                      color={primaryBrand}
                    />
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "600",
                        color: "#1E293B",
                      }}
                    >
                      {itemDate.toLocaleDateString()}
                    </Text>
                  </TouchableOpacity>

                  {showDatePicker && DateTimePicker && (
                    <DateTimePicker
                      value={itemDate}
                      mode="date"
                      display="default"
                      onChange={(event: any, selectedDate?: Date) => {
                        setShowDatePicker(false);
                        if (selectedDate) setItemDate(selectedDate);
                      }}
                      maximumDate={new Date()}
                    />
                  )}
                </>
              )}
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: secondaryBrand }]}
              onPress={addExpenditure}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Save Entry</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  headerGradient: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#fff" },
  backBtn: { padding: 5 },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: 12,
    borderRadius: 12,
  },
  summaryContent: { flex: 1 },
  summaryLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  summaryValue: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
  },
  viewToggleCompact: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: 2,
  },
  toggleItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  toggleItemActive: {
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  compactFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  archiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F59E0B",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  archiveText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  smallActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: { padding: 16, paddingBottom: 100 },
  // Summary view styles
  summaryHeader: {
    alignItems: "center",
    marginBottom: 16,
    paddingVertical: 12,
  },
  summaryHeaderText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1E293B",
    letterSpacing: 0.5,
  },
  summarySubHeader: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
  },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...SHADOWS.small,
  },
  summaryCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  summaryItemInfo: {
    flex: 1,
  },
  summaryItemName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    textTransform: "capitalize",
  },
  summaryItemCount: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  summaryAmounts: {
    alignItems: "flex-end",
  },
  summaryAmountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  summaryAmountLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
  },
  summaryMonthAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#059669",
  },
  summaryTermAmount: {
    fontSize: 16,
    fontWeight: "800",
    color: "#2e86de",
  },
  progressBarContainer: {
    marginTop: 12,
    height: 4,
    backgroundColor: "#E2E8F0",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 2,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    ...SHADOWS.small,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemTitle: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
  dateRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  dateText: { fontSize: 12, color: "#64748B", marginLeft: 4 },
  itemAmount: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.primary || "#2e86de",
  },
  adminBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  adminText: { fontSize: 10, color: "#64748B", fontWeight: "600" },
  deleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
  },
  // (duplicate removed) - single `addBtn` definition exists above for header compact button
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
    marginTop: 20,
  },
  emptyText: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#1E293B" },
  modalInputWrapper: { marginBottom: 20 },
  modalInputLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#94A3B8",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  modalInput: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#1E293B",
  },
  saveBtn: {
    height: 55,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  categoryChipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
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
