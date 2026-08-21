import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  FlatList,
  Platform,
  RefreshControl,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import { SafeAreaView } from "react-native-safe-area-context";

// Components
import { ClassSelectorModal } from "../../components/admin-dashboard/ClassSelectorModal";
import { FeeDailyTransactionsModal } from "../../components/admin-dashboard/FeeDailyTransactionsModal";
import { FeePaymentModal } from "../../components/admin-dashboard/FeePaymentModal";
import { FeeStatsDashboard } from "../../components/admin-dashboard/FeeStatsDashboard";
import { FeeStudentCard } from "../../components/admin-dashboard/FeeStudentCard";
import { FeeConfirmModal } from "../../components/admin-dashboard/FeeConfirmModal";
import { FeeHeader } from "../../components/admin-dashboard/FeeHeader";
import { FeeSearchStrip } from "../../components/admin-dashboard/FeeSearchStrip";
import { FeeModeTabs } from "../../components/admin-dashboard/FeeModeTabs";
import { FeeBulkActionStrip } from "../../components/admin-dashboard/FeeBulkActionStrip";
import SVGIcon from "../../components/SVGIcon";

// Constants & Hooks
import { VIBE, styles } from "../../constants/admin-dashboard/ManageFeesStyles";
import { StudentDraft } from "../../constants/admin-dashboard/ManageFeesTypes";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { COLORS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { useFeeStats } from "../../hooks/admin-dashboard/useFeeStats";
import { useManageFees } from "../../hooks/admin-dashboard/useManageFees";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";

export default function ManageFees() {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const acadConfig = useAcademicConfig();
  const scrollY = useRef(new Animated.Value(0)).current;

  const {
    saving,
    activeMode,
    setActiveMode,
    searchQuery,
    setSearchQuery,
    showArchived,
    setShowArchived,
    statusFilter,
    setStatusFilter,
    selectedClassId,
    setSelectedClassId,
    selectedStudentUids,
    termBillAmount,
    setTermBillAmount,
    discountAmount,
    setDiscountAmount,
    individualBillOverrides,
    setIndividualBillOverrides,
    individualDiscountOverrides,
    setIndividualDiscountOverrides,
    classes,
    academicYear,
    term,
    filteredStudents,
    totalProfileDiscountsSum,
    inconsistentCount,
    dailyModalVisible,
    setDailyModalVisible,
    selectedDailyDate,
    setSelectedDailyDate,
    dailyPayments,
    loadingDaily,
    handleLogPayment,
    handleDeletePayment,
    handleNormalizeDiscounts,
    saveFees,
    saveDiscounts,
    toggleSelectAll,
    toggleStudentSelection,
    setSelectedStudentUids,
    isConfigMissing,
    students,
    loading,
    refreshing,
    fetchStudents,
    handleRefresh,
    fetchingMore,
    selectorModal,
    setSelectorModal,
    billModalVisible,
    setBillModalVisible,
    paymentModalVisible,
    setPaymentModalVisible,
    discountModalVisible,
    setDiscountModalVisible,
    selectedStudent,
    setSelectedStudent,
    paymentAmount,
    setPaymentAmount,
    receivedFrom,
    setReceivedFrom,
    paymentMethod,
    setPaymentMethod,
    paymentDate,
    setPaymentDate,
    canView,
    canEdit,
    isSuperAdmin,
  } = useManageFees({
    appUser,
    showToast,
    acadConfig,
  });

  const { stats } = useFeeStats(
    academicYear,
    term,
    selectedClassId,
    showArchived,
  );

  const primaryBrand =
    SCHOOL_CONFIG.primaryColor || COLORS.primary || VIBE.primary;
  const secondaryBrand = SCHOOL_CONFIG.secondaryColor || primaryBrand;

  const headerHeight = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [135, 75],
    extrapolate: "clamp",
  });

  const selectorGridOpacity = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const selectorGridHeight = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [45, 0],
    extrapolate: "clamp",
  });

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
        setPaymentAmount("");
        setReceivedFrom("");
        setPaymentMethod("Cash");
        setPaymentDate(new Date());
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

  const renderStudentItem = ({ item }: { item: StudentDraft }) => {
    return (
      <FeeStudentCard
        item={item}
        isSelected={selectedStudentUids.has(item.uid)}
        activeMode={activeMode}
        onPress={() => {
          if (activeMode === "billing" || activeMode === "discounts") {
            toggleStudentSelection(item.uid);
          } else {
            setPaymentAmount("");
            setReceivedFrom("");
            setPaymentMethod("Cash");
            setSelectedStudent(item);
            setPaymentDate(new Date());
            setPaymentModalVisible(true);
          }
        }}
        canEdit={canEdit}
        individualBillOverrides={individualBillOverrides}
        termBillAmount={termBillAmount}
        setIndividualBillOverrides={setIndividualBillOverrides}
        individualDiscountOverrides={individualDiscountOverrides}
        discountAmount={discountAmount}
        setIndividualDiscountOverrides={setIndividualDiscountOverrides}
        onViewLedger={() => {
          router.push({
            pathname: "/admin-dashboard/student-fee-history",
            params: { studentId: item.uid, academicYear, term },
          });
        }}
      />
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
      <FeeHeader
        primaryBrand={primaryBrand}
        secondaryBrand={secondaryBrand}
        headerHeight={headerHeight}
        selectorGridOpacity={selectorGridOpacity}
        selectorGridHeight={selectorGridHeight}
        onBack={() => router.replace("/admin-dashboard")}
        onSelectClass={() => setSelectorModal({ visible: true, type: "class" })}
        selectedClassId={selectedClassId}
        classes={classes}
        academicYear={academicYear}
        term={term}
      />

      <View style={styles.mainBody}>
        <FlatList
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false },
          )}
          scrollEventThrottle={16}
          ListHeaderComponent={
            <>
              <FeeSearchStrip
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                showArchived={showArchived}
                setShowArchived={setShowArchived}
                onPrintReports={() =>
                  router.push({
                    pathname: "/admin-dashboard/FeeReports",
                    params: { classId: selectedClassId, academicYear, term },
                  })
                }
                onRefresh={handleRefresh}
                onShowDaily={() => setDailyModalVisible(true)}
                onNormalize={handleNormalizeDiscounts}
                isSuperAdmin={isSuperAdmin}
                inconsistentCount={inconsistentCount}
              />

              {!isConfigMissing && (
                <FeeModeTabs
                  activeMode={activeMode}
                  setActiveMode={setActiveMode}
                />
              )}

              {isConfigMissing && (
                <View style={styles.warningStrip}>
                  <SVGIcon name="alert-circle" size={18} color="#92400E" />
                  <Text style={styles.warningText}>
                    Academic configuration is missing. Term-based billing is
                    disabled.
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push("/academic-calendar")}
                  >
                    <Text style={styles.warningLink}>Configure Now</Text>
                  </TouchableOpacity>
                </View>
              )}

              {!isConfigMissing && activeMode !== "payment" && (
                <FeeBulkActionStrip
                  activeMode={activeMode}
                  amount={
                    activeMode === "billing" ? termBillAmount : discountAmount
                  }
                  setAmount={
                    activeMode === "billing"
                      ? setTermBillAmount
                      : setDiscountAmount
                  }
                  canEdit={canEdit}
                  onToggleSelectAll={toggleSelectAll}
                  filteredStudents={filteredStudents}
                  selectedStudentUids={selectedStudentUids}
                />
              )}

              <FeeStatsDashboard
                stats={stats}
                activeMode={activeMode}
                studentsCount={students.length}
                searchQuery={searchQuery}
                totalProfileDiscountsSum={totalProfileDiscountsSum}
                filteredStudentsCount={filteredStudents.length}
              />

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
            </>
          }
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

        {activeMode !== "payment" &&
          selectedStudentUids.size > 0 &&
          canEdit && (
            <Animatable.View animation="bounceIn" style={styles.fabWrap}>
              <TouchableOpacity
                style={styles.mainFab}
                onPress={() =>
                  activeMode === "billing"
                    ? setBillModalVisible(true)
                    : setDiscountModalVisible(true)
                }
              >
                <LinearGradient
                  colors={
                    activeMode === "billing"
                      ? [VIBE.primary, VIBE.purple]
                      : [VIBE.success, VIBE.info]
                  }
                  style={styles.fabGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.fabText}>
                    APPLY{" "}
                    {activeMode === "billing" ? "BILLS" : "DISCOUNTS"} (
                    {selectedStudentUids.size})
                  </Text>
                  <SVGIcon
                    name={
                      activeMode === "billing"
                        ? "checkmark-done-circle"
                        : "pricetag"
                    }
                    size={22}
                    color="#fff"
                  />
                </LinearGradient>
              </TouchableOpacity>
            </Animatable.View>
          )}
      </View>

      <ClassSelectorModal
        visible={selectorModal.visible && selectorModal.type === "class"}
        onClose={() => setSelectorModal({ visible: false, type: null })}
        classes={classes}
        selectedClassId={selectedClassId}
        onSelect={(id) => {
          setSelectedClassId(id);
          setSelectorModal({ visible: false, type: null });
        }}
      />

      <FeePaymentModal
        visible={paymentModalVisible}
        onClose={() => {
          setPaymentModalVisible(false);
          setSelectedStudent(null);
          setPaymentAmount("");
          setReceivedFrom("");
          setPaymentMethod("Cash");
          setPaymentDate(new Date());
        }}
        selectedStudent={selectedStudent}
        paymentAmount={paymentAmount}
        setPaymentAmount={setPaymentAmount}
        receivedFrom={receivedFrom}
        setReceivedFrom={setReceivedFrom}
        paymentDate={paymentDate}
        setPaymentDate={setPaymentDate}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        onConfirm={handleLogPayment}
        onDeletePayment={(payment) =>
          handleDeletePayment(selectedStudent, payment)
        }
        saving={saving}
        canEdit={canEdit}
      />

      <FeeConfirmModal
        visible={billModalVisible}
        title="Bulk Billing?"
        message={`Apply these adjustments to ${selectedStudentUids.size} accounts?`}
        onConfirm={() => saveFees(selectedStudentUids)}
        onCancel={() => setBillModalVisible(false)}
        confirmColor={VIBE.primary}
      />

      <FeeConfirmModal
        visible={discountModalVisible}
        title="Apply Discounts?"
        message={`Apply discounts to ${selectedStudentUids.size} selected students?\nThis will reduce their outstanding balance.`}
        onConfirm={() => saveDiscounts(selectedStudentUids)}
        onCancel={() => setDiscountModalVisible(false)}
        confirmColor={VIBE.success}
      />

      <FeeDailyTransactionsModal
        visible={dailyModalVisible}
        onClose={() => setDailyModalVisible(false)}
        selectedDate={selectedDailyDate}
        onDateChange={setSelectedDailyDate}
        dailyPayments={dailyPayments}
        loading={loadingDaily}
      />
    </SafeAreaView>
  );
}
