import { useRouter } from "expo-router";
import moment from "moment";
import { useCallback, useEffect, useState } from "react";
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
import { COLORS, SHADOWS } from "../../constants/theme";
import { useToast } from "../../contexts/ToastContext";
import { useFeedingFeeLogic, DailyRecord, TabType } from "../../hooks/shared/useFeedingFeeLogic";
import { VIBE } from "../../components/feeding-fees/FeedingFeeConstants";
import { FeedingFeeStats } from "../../components/feeding-fees/FeedingFeeStats";
import { StudentRow } from "../../components/feeding-fees/StudentRow";

// Guarded import for native-only library
const DateTimePicker =
  Platform.OS !== "web"
    ? require("@react-native-community/datetimepicker").default
    : null;

const { width } = Dimensions.get("window");

export default function FeedingFees() {
  const router = useRouter();
  const { showToast } = useToast();

  const {
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
  } = useFeedingFeeLogic();

  const handleBack = () => {
    router.replace("/shared/daily-financials");
  };

  useEffect(() => {
    if (appUser && !canView) {
      showToast({
        message: "Access Denied: You do not have permission to view Feeding Fees.",
        type: "error",
      });
      handleBack();
    }
  }, [appUser, canView]);

  const [showDatePicker, setShowDatePicker] = useState(false);

  const changeDate = (days: number) => {
    setSelectedDate(moment(selectedDate).add(days, "days").toDate());
  };

  const renderRecordItem = useCallback(({ item }: { item: DailyRecord }) => (
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
  ), []);

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
          <Text style={styles.headerSubtitle}>
            Record daily meal payments
          </Text>
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
              <FeedingFeeStats totalFeeding={stats.totalFeeding} recordsCount={stats.recordsCount} />

              {/* Filters */}
              <View style={styles.filterSection}>
                <View style={styles.searchBar}>
                  <SVGIcon name="search" size={20} color={VIBE.muted} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search students or class..."
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

                {/* Class Selection Filter */}
                <View style={styles.pickerContainer}>
                  <Text style={styles.pickerLabel}>Select Class</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 4 }}
                  >
                    {(isSuperAdmin || teacherClasses.length > 1) && (
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
                          {isSuperAdmin ? "All Classes" : "All Assigned Classes"}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {classes
                      .filter((c) =>
                        isSuperAdmin || teacherClasses.includes(c.id)
                      )
                      .map((c) => (
                        <TouchableOpacity
                          key={c.id}
                          style={[
                            styles.classChip,
                            selectedClassId === c.id &&
                              styles.classChipActive,
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
                </View>

                {/* Rate Management (Super Admin only) */}
                {isSuperAdmin && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>
                      Update Rate for Class
                    </Text>
                    <View style={styles.amountInputContainer}>
                      <SVGIcon name="cash" size={20} color={VIBE.info} />
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
                          { backgroundColor: VIBE.info },
                        ]}
                        onPress={handleSaveClassRate}
                        disabled={saving}
                      >
                        <Text style={styles.miniBtnText}>Update</Text>
                      </TouchableOpacity>
                    </View>
                    {selectedClassId === "all" && (
                      <Text style={styles.rateHint}>Select a specific class to update its rate</Text>
                    )}
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
                  filteredStudents.map((item) => (
                    <StudentRow
                      key={item.uid}
                      item={item}
                      existingRecord={getExistingRecord(item.uid)}
                      attendanceStatus={attendanceMap[item.uid]?.status}
                      rate={classRates[item.classId] || 0}
                      canEdit={canEdit}
                      overrideValue={overrideMap[item.uid]}
                      onMarkPaid={markStudentPaid}
                      onMarkNotPaid={markStudentNotPaid}
                      onSetOverride={(uid, val) => setOverrideMap(m => ({...m, [uid]: val}))}
                    />
                  ))
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
              <FeedingFeeStats totalFeeding={stats.totalFeeding} recordsCount={stats.recordsCount} />
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
                    <Text style={styles.reportLabel}>Total Feeding Collected</Text>
                    <Text style={[styles.reportValue, { color: VIBE.success }]}>
                      ₵{stats.totalFeeding.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.reportRow}>
                    <Text style={styles.reportLabel}>Records Count</Text>
                    <Text style={[styles.reportValue, { color: VIBE.primary }]}>
                      {stats.recordsCount}
                    </Text>
                  </View>
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
    alignItems: "center",
    marginBottom: 20,
  },
  formTitle: { fontSize: 18, fontWeight: "900", color: VIBE.text },
  formSubtitle: { fontSize: 13, color: VIBE.muted, marginTop: 2 },

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
  rateHint: {
    fontSize: 12,
    color: VIBE.muted,
    fontStyle: "italic",
    marginTop: 4,
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

  emptyResults: { alignItems: "center", padding: 20 },
  emptyResultsText: { marginTop: 8, color: VIBE.muted, fontSize: 14 },

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
