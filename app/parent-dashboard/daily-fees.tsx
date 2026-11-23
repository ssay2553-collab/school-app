import { Picker } from "@react-native-picker/picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  getDocsFromServer,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import moment from "moment";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebaseConfig";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";

export type DailyChild = {
  id: string;
  name: string;
  classId: string;
  className: string;
  isFeeding: boolean;
  isBus: boolean;
  busLocation?: string;
  takesExtraClasses: boolean;
  dailyArrears: number;
};

export default function ParentDailyFeesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { appUser } = useAuth();
  const acadConfig = useAcademicConfig();

  const primary = SCHOOL_CONFIG.primaryColor || COLORS.primary;
  const secondary = SCHOOL_CONFIG.secondaryColor || COLORS.secondary;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [children, setChildren] = useState<DailyChild[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>(
    (params.studentId as string) || ""
  );

  const [feedingRates, setFeedingRates] = useState<Record<string, number>>({});
  const [busRates, setBusRates] = useState<Record<string, number>>({});
  const [extraRates, setExtraRates] = useState<Record<string, number>>({});

  const [todayRecord, setTodayRecord] = useState<any>(null);
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);

  // 1. Fetch Children & Rates
  const loadInitialData = useCallback(async () => {
    if (!appUser || appUser.role !== "parent") return;
    const childrenIds = appUser.childrenIds || [];
    if (childrenIds.length === 0) {
      setLoading(false);
      return;
    }

    try {
      // Rates & Classes in parallel
      const [feedingSnap, busSnap, extraSnap, classesSnap] = await Promise.all([
        getDoc(doc(db, "school_settings", "feeding_rates")),
        getDoc(doc(db, "school_settings", "bus_rates")),
        getDoc(doc(db, "school_settings", "extra_classes_rates")),
        getDocsFromServer(collection(db, "classes")),
      ]);

      if (feedingSnap.exists()) setFeedingRates(feedingSnap.data() as Record<string, number>);
      if (busSnap.exists()) setBusRates(busSnap.data() as Record<string, number>);
      if (extraSnap.exists()) setExtraRates(extraSnap.data() as Record<string, number>);

      const classMap: Record<string, string> = {};
      classesSnap.docs.forEach((d) => {
        classMap[d.id] = (d.data() as any).name || d.id;
      });

      // Children docs
      const childrenQ = query(
        collection(db, "users"),
        where(documentId(), "in", childrenIds.slice(0, 30))
      );
      const cSnap = await getDocsFromServer(childrenQ);

      const parsedChildren: DailyChild[] = cSnap.docs.map((d) => {
        const data = d.data() as any;
        const profile = data.profile || {};
        const cId = data.classId || "";
        return {
          id: d.id,
          name: `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || "Student",
          classId: cId,
          className: classMap[cId] || data.className || "Class",
          isFeeding: data.isFeeding === true,
          isBus: data.isBus === true || !!data.busLocation,
          busLocation: data.busLocation || "",
          takesExtraClasses: data.takesExtraClasses === true,
          dailyArrears: Math.max(0, data.dailyArrears || 0),
        };
      });

      setChildren(parsedChildren);
      if (!selectedChildId && parsedChildren.length > 0) {
        setSelectedChildId(parsedChildren[0].id);
      }
    } catch (err) {
      console.error("Error loading parent daily fees initial data:", err);
    } finally {
      setLoading(false);
    }
  }, [appUser, selectedChildId]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const selectedChild = useMemo(() => {
    return children.find((c) => c.id === selectedChildId) || children[0] || null;
  }, [children, selectedChildId]);

  // Calculated rates for selected child
  const childRates = useMemo(() => {
    if (!selectedChild) return { feeding: 0, bus: 0, extra: 0, combined: 0 };
    const cId = selectedChild.classId;
    const bLoc = selectedChild.busLocation;

    const feeding = selectedChild.isFeeding
      ? feedingRates[cId] || SCHOOL_CONFIG.defaultFeedingRate || 10
      : 0;
    const bus = selectedChild.isBus
      ? (bLoc && busRates[bLoc]) || busRates[cId] || SCHOOL_CONFIG.defaultBusRate || 15
      : 0;
    const extra = selectedChild.takesExtraClasses
      ? extraRates[cId] || SCHOOL_CONFIG.defaultExtraClassesRate || 10
      : 0;

    return {
      feeding,
      bus,
      extra,
      combined: feeding + bus + extra,
    };
  }, [selectedChild, feedingRates, busRates, extraRates]);

  // 2. Fetch Records for Selected Child
  const fetchChildDailyRecords = useCallback(async () => {
    if (!selectedChildId) return;
    try {
      const todayStr = moment().format("YYYY-MM-DD");

      // Query dailyFinancials for history
      const historyQ = query(
        collection(db, "dailyFinancials"),
        where("studentUid", "==", selectedChildId),
        limit(30)
      );
      const snap = await getDocs(historyQ);
      const records = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));

      // Sort by date desc locally
      records.sort((a, b) => {
        const tA = moment(a.date || 0).valueOf();
        const tB = moment(b.date || 0).valueOf();
        return tB - tA;
      });

      const todayRec = records.find((r) => r.date === todayStr) || null;
      setTodayRecord(todayRec);
      setHistoryRecords(records);
    } catch (err) {
      console.error("Error fetching child daily records:", err);
    }
  }, [selectedChildId]);

  useEffect(() => {
    fetchChildDailyRecords();
  }, [fetchChildDailyRecords]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInitialData();
    await fetchChildDailyRecords();
    setRefreshing(false);
  };

  // Status computation for Today
  const todayStatusInfo = useMemo(() => {
    if (!selectedChild) return { status: "NONE", label: "No Child Selected", color: COLORS.textMuted };

    const arrears = selectedChild.dailyArrears || 0;

    if (todayRecord) {
      if (todayRecord.isAdvanceCovered) {
        return {
          status: "ADVANCE",
          label: "ADVANCE COVERED 🔵",
          color: "#0EA5E9",
          desc: "Today's daily fee is covered by an advance payment.",
        };
      }

      // Check if paid today
      const fPaid = !selectedChild.isFeeding || todayRecord.feedingPaid;
      const bPaid = !selectedChild.isBus || todayRecord.busPaid;
      const ePaid = !selectedChild.takesExtraClasses || todayRecord.extraPaid;

      if (fPaid && bPaid && ePaid) {
        return {
          status: "PAID",
          label: "PAID TODAY 🟢",
          color: "#10B981",
          desc: "All daily collection fees for today have been settled.",
        };
      } else {
        return {
          status: "UNPAID",
          label: "NOT PAID / OWING TODAY 🔴",
          color: "#EF4444",
          desc: "Daily fees for today remain unpaid and have been added to arrears.",
        };
      }
    }

    if (arrears > 0) {
      return {
        status: "UNPAID",
        label: "OUTSTANDING ARREARS 🔴",
        color: "#EF4444",
        desc: "You have unpaid daily fee arrears from previous days.",
      };
    }

    return {
      status: "CLEARED",
      label: "NO ARREARS 🟢",
      color: "#10B981",
      desc: "All daily collection fees are fully up to date.",
    };
  }, [selectedChild, todayRecord]);

  // Accumulated Amount to Pay Next Day
  const nextDayAccumulatedAmount = useMemo(() => {
    if (!selectedChild) return 0;
    const currentArrears = Math.max(0, selectedChild.dailyArrears || 0);
    const dailyRate = childRates.combined;
    // Accumulated amount = Current Arrears + Next Day's Daily Rate
    return currentArrears + dailyRate;
  }, [selectedChild, childRates]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: "#F8FAFC" }]}>
        <ActivityIndicator size="large" color={primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient colors={[primary, secondary]} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <SVGIcon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={styles.headerTitle}>Daily Collection Fees</Text>
            <Text style={styles.headerSub}>Feeding, Bus & Extra Classes</Text>
          </View>
        </View>

        {/* Child Picker if multiple children */}
        {children.length > 1 && (
          <View style={styles.pickerBox}>
            <Text style={styles.pickerLabel}>SELECT STUDENT</Text>
            <Picker
              selectedValue={selectedChildId}
              onValueChange={(val) => setSelectedChildId(val)}
              style={[
                styles.picker,
                Platform.OS === "web" &&
                  ({
                    color: "#fff",
                    backgroundColor: "transparent",
                    outline: "none",
                    border: "none",
                  } as any),
              ]}
              dropdownIconColor="#fff"
            >
              {children.map((c) => (
                <Picker.Item key={c.id} label={`${c.name} (${c.className})`} value={c.id} />
              ))}
            </Picker>
          </View>
        )}
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[primary]} />
        }
      >
        {selectedChild ? (
          <View style={styles.content}>
            {/* Child Profile Banner */}
            <Animatable.View animation="fadeInDown" style={styles.childCard}>
              <View style={styles.childIconBox}>
                <SVGIcon name="person" size={24} color={primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.childName}>{selectedChild.name}</Text>
                <Text style={styles.childClass}>Class: {selectedChild.className}</Text>
              </View>
              <View style={[styles.arrearsBadge, { backgroundColor: selectedChild.dailyArrears > 0 ? "#FEF2F2" : "#ECFDF5" }]}>
                <Text style={[styles.arrearsBadgeText, { color: selectedChild.dailyArrears > 0 ? "#EF4444" : "#10B981" }]}>
                  {selectedChild.dailyArrears > 0
                    ? `Arrears: ₵${selectedChild.dailyArrears.toFixed(2)}`
                    : "Arrears: ₵0.00"}
                </Text>
              </View>
            </Animatable.View>

            {/* Enrolled Daily Collection Items (The 3 Items) */}
            <View style={styles.sectionHeader}>
              <SVGIcon name="options-outline" size={20} color={primary} />
              <Text style={styles.sectionTitle}>Enrolled Daily Collection Items</Text>
            </View>

            <View style={styles.itemsGrid}>
              {/* Feeding Item */}
              <View style={[styles.itemCard, selectedChild.isFeeding ? styles.itemActive : styles.itemInactive]}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemEmoji}>🍲</Text>
                  <View style={[styles.statusDot, { backgroundColor: selectedChild.isFeeding ? "#10B981" : "#94A3B8" }]} />
                </View>
                <Text style={styles.itemTitle}>Feeding Fee</Text>
                <Text style={styles.itemSubtitle}>
                  {selectedChild.isFeeding ? "Active Enrolled" : "Not Enrolled"}
                </Text>
                {selectedChild.isFeeding && (
                  <Text style={styles.itemRate}>₵{childRates.feeding.toFixed(2)} / day</Text>
                )}
              </View>

              {/* Bus Item */}
              <View style={[styles.itemCard, selectedChild.isBus ? styles.itemActive : styles.itemInactive]}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemEmoji}>🚌</Text>
                  <View style={[styles.statusDot, { backgroundColor: selectedChild.isBus ? "#10B981" : "#94A3B8" }]} />
                </View>
                <Text style={styles.itemTitle}>Bus Shuttle</Text>
                <Text style={styles.itemSubtitle}>
                  {selectedChild.isBus
                    ? selectedChild.busLocation
                      ? `Route: ${selectedChild.busLocation}`
                      : "Active Shuttle"
                    : "Not Enrolled"}
                </Text>
                {selectedChild.isBus && (
                  <Text style={styles.itemRate}>₵{childRates.bus.toFixed(2)} / day</Text>
                )}
              </View>

              {/* Extra Classes Item */}
              <View style={[styles.itemCard, selectedChild.takesExtraClasses ? styles.itemActive : styles.itemInactive]}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemEmoji}>📚</Text>
                  <View style={[styles.statusDot, { backgroundColor: selectedChild.takesExtraClasses ? "#10B981" : "#94A3B8" }]} />
                </View>
                <Text style={styles.itemTitle}>Extra Classes</Text>
                <Text style={styles.itemSubtitle}>
                  {selectedChild.takesExtraClasses ? "Active Enrolled" : "Not Enrolled"}
                </Text>
                {selectedChild.takesExtraClasses && (
                  <Text style={styles.itemRate}>₵{childRates.extra.toFixed(2)} / day</Text>
                )}
              </View>
            </View>

            {/* Combined Rate Banner */}
            <View style={styles.combinedRateCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.combinedLabel}>TOTAL COMBINED DAILY RATE</Text>
                <Text style={styles.combinedDesc}>Sum of active daily collection fees per school day</Text>
              </View>
              <Text style={styles.combinedValue}>₵{childRates.combined.toFixed(2)} / day</Text>
            </View>

            {/* Today's Status Banner */}
            <View style={styles.sectionHeader}>
              <SVGIcon name="calendar-outline" size={20} color={primary} />
              <Text style={styles.sectionTitle}>Today's Collection Status ({moment().format("MMM DD, YYYY")})</Text>
            </View>

            <View style={[styles.todayCard, { borderLeftColor: todayStatusInfo.color }]}>
              <View style={styles.todayHeader}>
                <Text style={[styles.todayStatusText, { color: todayStatusInfo.color }]}>
                  {todayStatusInfo.label}
                </Text>
              </View>
              <Text style={styles.todayDesc}>{todayStatusInfo.desc}</Text>
            </View>

            {/* NOT PAID & ACCUMULATED AMOUNT TO PAY NEXT DAY CARD */}
            {(todayStatusInfo.status === "UNPAID" || selectedChild.dailyArrears > 0) && (
              <Animatable.View animation="pulse" iterationCount={1} style={styles.arrearsAlertContainer}>
                <LinearGradient colors={["#FEF2F2", "#FFF1F2"]} style={styles.arrearsAlertGradient}>
                  <View style={styles.alertHeaderRow}>
                    <View style={styles.alertIconBox}>
                      <SVGIcon name="alert-circle" size={24} color="#EF4444" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.alertTitle}>Unpaid Daily Fee Notice ⚠️</Text>
                      <Text style={styles.alertSub}>Accumulated payment breakdown</Text>
                    </View>
                  </View>

                  {/* Arrears Breakdown Table */}
                  <View style={styles.breakdownBox}>
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>Current Unpaid Arrears (To Date):</Text>
                      <Text style={styles.breakdownVal}>₵{selectedChild.dailyArrears.toFixed(2)}</Text>
                    </View>
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>Daily Rate (Next School Day):</Text>
                      <Text style={styles.breakdownVal}>+ ₵{childRates.combined.toFixed(2)}</Text>
                    </View>
                    <View style={styles.divider} />

                    {/* Highlighted Accumulated Amount Next Day */}
                    <View style={styles.nextDayHighlightBox}>
                      <Text style={styles.nextDayTitle}>ACCUMULATED AMOUNT TO PAY NEXT DAY 📅</Text>
                      <Text style={styles.nextDayAmount}>
                        ₵{nextDayAccumulatedAmount.toFixed(2)}
                      </Text>
                      <Text style={styles.nextDayExplanation}>
                        Includes existing arrears of ₵{selectedChild.dailyArrears.toFixed(2)} plus tomorrow's daily rate of ₵{childRates.combined.toFixed(2)}.
                      </Text>
                    </View>
                  </View>
                </LinearGradient>
              </Animatable.View>
            )}

            {/* Advance Payment Details (if any advance trigger or coverage) */}
            {todayRecord?.isAdvancePaymentTrigger && (
              <View style={styles.advanceCard}>
                <View style={styles.advanceHeader}>
                  <SVGIcon name="shield-checkmark" size={20} color="#0EA5E9" />
                  <Text style={styles.advanceTitle}>Advance Payment Record 🔵</Text>
                </View>
                <Text style={styles.advanceText}>
                  Total Advance Paid: <Text style={styles.bold}>₵{todayRecord.advanceTotalPaid?.toFixed(2) || "0.00"}</Text>
                </Text>
                <Text style={styles.advanceSubtext}>
                  This bulk payment automatically covers upcoming school days.
                </Text>
              </View>
            )}

            {/* Daily History Timeline */}
            <View style={styles.sectionHeader}>
              <SVGIcon name="time-outline" size={20} color={primary} />
              <Text style={styles.sectionTitle}>Recent Daily Transactions History</Text>
            </View>

            {historyRecords.length === 0 ? (
              <View style={styles.emptyCard}>
                <SVGIcon name="receipt-outline" size={32} color={COLORS.textMuted} />
                <Text style={styles.emptyText}>No recent daily collection transactions found.</Text>
              </View>
            ) : (
              historyRecords.map((item) => {
                const dateFormatted = moment(item.date).format("ddd, MMM DD, YYYY");
                const isPaid = item.feedingPaid || item.busPaid || item.extraPaid || item.isAdvanceCovered;
                const totalAmt = item.total || (item.feedingFee || 0) + (item.busFee || 0) + (item.extraClassesFee || 0);

                return (
                  <View key={item.id} style={styles.historyCard}>
                    <View style={styles.historyTop}>
                      <View>
                        <Text style={styles.historyDate}>{dateFormatted}</Text>
                        <Text style={styles.historyRecorder}>Logged by: {item.recordedBy || "Staff"}</Text>
                      </View>
                      <View style={[styles.historyStatusBadge, { backgroundColor: isPaid ? "#ECFDF5" : "#FEF2F2" }]}>
                        <Text style={[styles.historyStatusText, { color: isPaid ? "#10B981" : "#EF4444" }]}>
                          {item.isAdvanceCovered ? "ADVANCE" : isPaid ? "PAID" : "UNPAID"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.historyDetailsRow}>
                      {item.feedingFee > 0 && (
                        <Text style={styles.historyTag}>🍲 Feeding: ₵{item.feedingFee}</Text>
                      )}
                      {item.busFee > 0 && (
                        <Text style={styles.historyTag}>🚌 Bus: ₵{item.busFee}</Text>
                      )}
                      {item.extraClassesFee > 0 && (
                        <Text style={styles.historyTag}>📚 Extra: ₵{item.extraClassesFee}</Text>
                      )}
                    </View>

                    <View style={styles.historyBottom}>
                      <Text style={styles.historyTotalLabel}>Total Daily Fee:</Text>
                      <Text style={styles.historyTotalVal}>₵{Number(totalAmt).toFixed(2)}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No child profile found.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { paddingBottom: 40 },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 40 : 15,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...SHADOWS.medium,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#fff",
  },
  headerSub: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.85)",
  },
  pickerBox: {
    marginTop: 15,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  pickerLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 0.5,
    marginTop: 4,
  },
  picker: {
    color: "#fff",
    height: 40,
  },
  content: {
    padding: 20,
  },
  childCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 20,
    ...SHADOWS.small,
  },
  childIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
  },
  childName: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0F172A",
  },
  childClass: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  arrearsBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  arrearsBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 15,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#0F172A",
  },
  itemsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  itemCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    ...SHADOWS.small,
  },
  itemActive: {
    borderColor: "#10B981",
    backgroundColor: "#F0FDF4",
  },
  itemInactive: {
    borderColor: "#E2E8F0",
    opacity: 0.7,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  itemEmoji: {
    fontSize: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  itemSubtitle: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 2,
  },
  itemRate: {
    fontSize: 12,
    fontWeight: "900",
    color: "#059669",
    marginTop: 8,
  },
  combinedRateCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    marginBottom: 20,
  },
  combinedLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "#3730A3",
  },
  combinedDesc: {
    fontSize: 11,
    fontWeight: "600",
    color: "#4338CA",
  },
  combinedValue: {
    fontSize: 16,
    fontWeight: "900",
    color: "#312E81",
  },
  todayCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    borderLeftWidth: 5,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 20,
    ...SHADOWS.small,
  },
  todayHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  todayStatusText: {
    fontSize: 14,
    fontWeight: "900",
  },
  todayDesc: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "600",
  },
  arrearsAlertContainer: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#FCA5A5",
    marginBottom: 20,
    ...SHADOWS.medium,
  },
  arrearsAlertGradient: {
    padding: 18,
  },
  alertHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  alertIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#991B1B",
  },
  alertSub: {
    fontSize: 12,
    fontWeight: "600",
    color: "#991B1B",
    opacity: 0.8,
  },
  breakdownBox: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FECDD3",
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  breakdownLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },
  breakdownVal: {
    fontSize: 14,
    fontWeight: "900",
    color: "#0F172A",
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 10,
  },
  nextDayHighlightBox: {
    backgroundColor: "#FEF2F2",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: "#EF4444",
    alignItems: "center",
  },
  nextDayTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: "#991B1B",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  nextDayAmount: {
    fontSize: 26,
    fontWeight: "900",
    color: "#DC2626",
    marginVertical: 2,
  },
  nextDayExplanation: {
    fontSize: 11,
    fontWeight: "600",
    color: "#7F1D1D",
    textAlign: "center",
    marginTop: 4,
  },
  advanceCard: {
    backgroundColor: "#F0F9FF",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#BAE6FD",
    marginBottom: 20,
  },
  advanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  advanceTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#0369A1",
  },
  advanceText: {
    fontSize: 13,
    color: "#0284C7",
  },
  advanceSubtext: {
    fontSize: 11,
    color: "#0369A1",
    marginTop: 4,
  },
  bold: { fontWeight: "900" },
  historyCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 10,
    ...SHADOWS.small,
  },
  historyTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  historyDate: {
    fontSize: 14,
    fontWeight: "900",
    color: "#0F172A",
  },
  historyRecorder: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  historyStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  historyStatusText: {
    fontSize: 10,
    fontWeight: "900",
  },
  historyDetailsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  historyTag: {
    fontSize: 11,
    fontWeight: "700",
    color: "#334155",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  historyBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 8,
  },
  historyTotalLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  historyTotalVal: {
    fontSize: 14,
    fontWeight: "900",
    color: "#0F172A",
  },
  emptyCard: {
    padding: 30,
    backgroundColor: "#fff",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyText: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
    marginTop: 8,
  },
});
