import { LinearGradient } from "expo-linear-gradient";
import * as Print from "expo-print";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import { SafeAreaView } from "react-native-safe-area-context";
import { ClassSelectorModal } from "../../components/admin-dashboard/ClassSelectorModal";
import { FeeDailyTransactionsModal } from "../../components/admin-dashboard/FeeDailyTransactionsModal";
import { FeePaymentModal } from "../../components/admin-dashboard/FeePaymentModal";
import { FeeStatsDashboard } from "../../components/admin-dashboard/FeeStatsDashboard";
import { FeeStudentCard } from "../../components/admin-dashboard/FeeStudentCard";
import SVGIcon from "../../components/SVGIcon";
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
  const feePermission = appUser?.permissions?.["manage-fees"] || "deny";
  const canView =
    isSuperAdmin ||
    feePermission === "full" ||
    feePermission === "view" ||
    feePermission === "edit";
  const canEdit =
    isSuperAdmin || feePermission === "full" || feePermission === "edit";

  const primaryBrand =
    SCHOOL_CONFIG.primaryColor || COLORS.primary || VIBE.primary;
  const secondaryBrand = SCHOOL_CONFIG.secondaryColor || primaryBrand;

  const [selectorModal, setSelectorModal] = useState<{
    visible: boolean;
    type: "class" | "year" | "term" | null;
  }>({ visible: false, type: null });
  const [billModalVisible, setBillModalVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [discountModalVisible, setDiscountModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentDraft | null>(
    null,
  );
  const [paymentAmount, setPaymentAmount] = useState("");
  const [receivedFrom, setReceivedFrom] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "Cash" | "Cheque" | "E-cash" | "Momo"
  >("Cash");
  const [paymentDate, setPaymentDate] = useState(new Date());

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
    isConfigMissing,
    students,
    loading,
    refreshing,
    fetchStudents,
    handleRefresh,
    fetchingMore,
  } = useManageFees({
    appUser,
    showToast,
    acadConfig,
    canEdit,
    isSuperAdmin,
  });

  const { stats } = useFeeStats(academicYear, term, selectedClassId, showArchived);

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

  const exportPDF = async () => {
    const className =
      classes.find((c) => c.id === selectedClassId)?.name || "Class";
    const ITEMS_PER_PAGE = 20;
    const pages: any[] = [];

    for (let i = 0; i < filteredStudents.length; i += ITEMS_PER_PAGE) {
      pages.push(filteredStudents.slice(i, i + ITEMS_PER_PAGE));
    }

    const html = `
      <html>
        <head>
          <style>
            @page {
              size: A4;
              margin: 0;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              height: auto !important;
              min-height: 100% !important;
              overflow: visible !important;
              display: block !important;
              background-color: white;
            }
            body { font-family: sans-serif; color: #333; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 14px; }
            .page {
              padding: 15mm;
              width: 210mm;
              min-height: 297mm;
              box-sizing: border-box;
              display: block;
              page-break-after: always;
              page-break-inside: avoid;
              overflow: visible !important;
              position: relative;
              background-color: white;
            }
            .page:last-child {
              page-break-after: avoid;
            }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; table-layout: fixed; }
            th, td { border: 1px solid #ddd; padding: 10px 8px; text-align: left; font-size: 11px; word-wrap: break-word; }
            th { background-color: #f8f9fa; font-weight: bold; text-transform: uppercase; color: #444; }
            .header { text-align: center; margin-bottom: 25px; border-bottom: 3px solid ${primaryBrand}; padding-bottom: 15px; }
            .summary { margin-top: 30px; border-top: 2px solid #eee; padding-top: 15px; background-color: #fdfdfd; padding: 15px; border-radius: 5px; }
            .summary p { margin: 5px 0; font-size: 13px; }
            .footer { text-align: center; font-size: 10px; color: #999; margin-top: 30px; position: absolute; bottom: 15mm; left: 0; right: 0; }
            .student-name { font-weight: 600; color: #222; }
            .amount-cell { text-align: right; font-family: monospace; font-size: 12px; }
          </style>
        </head>
        <body>
          ${pages
            .map(
              (pageStudents: StudentDraft[], idx: number) => `
            <div class="page">
              <div class="header">
                <h1 style="margin: 0; color: ${primaryBrand};">${SCHOOL_CONFIG.name}</h1>
                <h2 style="margin: 5px 0; color: #666;">Fee Status Report - ${className}</h2>
                <p style="margin: 0; font-size: 12px; color: #888;">${academicYear} - ${term} | Page ${idx + 1} of ${pages.length}</p>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>ID</th>
                    <th>Billed</th>
                    <th>Paid</th>
                    <th>Discount</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  ${pageStudents
                    .map(
                      (s: StudentDraft) => `
                    <tr>
                      <td>${s.fullName}</td>
                      <td>${s.studentID}</td>
                      <td>₵${(s.termBill || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td>₵${(s.amountPaid || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td>₵${(s.discount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td style="font-weight: bold; color: ${s.currentBalance > 0 ? "#EF4444" : "#10B981"};">
                        ₵${(s.currentBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  `,
                    )
                    .join("")}
                </tbody>
              </table>

              ${
                idx === pages.length - 1
                  ? `
                <div class="summary">
                  <p><strong>Total Expected:</strong> ₵${stats.expected.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  <p><strong>Total Received:</strong> ₵${stats.received.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  <p><strong>Total Discounts:</strong> ₵${stats.totalDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  <p><strong>Total Outstanding:</strong> ₵${stats.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
              `
                  : ""
              }
              <div class="footer">
                Printed on ${new Date().toLocaleString()}<br/>
                Powered by EduEaz
              </div>
            </div>
          `,
            )
            .join("")}
        </body>
      </html>
    `;

    try {
      if (Platform.OS === "web") {
        await Print.printAsync({ html });
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(uri);
      }
    } catch (error) {
      console.error(error);
      showToast({ message: "Failed to export PDF", type: "error" });
    }
  };

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
        onHistoryPress={() => {
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
      <Animated.View style={styles.header}>
        <LinearGradient
          colors={[primaryBrand, secondaryBrand]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.headerTop, { minHeight: headerHeight }]}
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
            <View style={{ width: 44 }} />
          </View>
          <Animated.View
            style={[
              styles.selectorGrid,
              {
                opacity: selectorGridOpacity,
                height: selectorGridHeight,
                overflow: "hidden",
              },
            ]}
          >
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
          </Animated.View>
        </LinearGradient>
      </Animated.View>

      <View style={styles.mainBody}>
        <FlatList
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false },
          )}
          scrollEventThrottle={16}
          ListHeaderComponent={() => (
            <>
              <View style={styles.searchStrip}>
                <TouchableOpacity
                  activeOpacity={1}
                  style={styles.searchBar}
                  onPress={() => {}}
                >
                  <SVGIcon name="search" size={18} color={VIBE.muted} />
                  <TextInput
                    placeholder="Search..."
                    style={styles.searchInput}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholderTextColor={VIBE.muted}
                    underlineColorAndroid="transparent"
                  />
                </TouchableOpacity>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.searchActionsScroll}
                  contentContainerStyle={styles.searchActionsContainer}
                >
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
                    onPress={() =>
                      router.push({
                        pathname: "/admin-dashboard/FeeReports",
                        params: {
                          classId: selectedClassId,
                          academicYear,
                          term,
                        },
                      })
                    }
                    style={styles.refreshRound}
                  >
                    <SVGIcon name="print" size={18} color={VIBE.primary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleRefresh}
                    style={styles.refreshRound}
                  >
                    <SVGIcon name="refresh" size={18} color={VIBE.primary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setDailyModalVisible(true)}
                    style={styles.refreshRound}
                  >
                    <SVGIcon name="calendar" size={18} color={VIBE.secondary} />
                  </TouchableOpacity>

                  {isSuperAdmin && (
                    <TouchableOpacity
                      onPress={handleNormalizeDiscounts}
                      style={[
                        styles.refreshRound,
                        { backgroundColor: VIBE.info + "10" },
                      ]}
                    >
                      <SVGIcon name="sync" size={18} color={VIBE.info} />
                      {inconsistentCount > 0 && (
                        <View
                          style={{
                            position: "absolute",
                            top: -2,
                            right: -2,
                            backgroundColor: VIBE.danger,
                            borderRadius: 8,
                            minWidth: 16,
                            height: 16,
                            justifyContent: "center",
                            alignItems: "center",
                            paddingHorizontal: 4,
                          }}
                        >
                          <Text
                            style={{ color: "#fff", fontSize: 8, fontWeight: "900" }}
                          >
                            {inconsistentCount}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )}
                </ScrollView>
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
                    onPress={toggleSelectAll}
                  >
                    <SVGIcon
                      name={
                        filteredStudents.length > 0 &&
                        filteredStudents.every((s) => selectedStudentUids.has(s.uid))
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
                    onPress={toggleSelectAll}
                  >
                    <SVGIcon
                      name={
                        filteredStudents.length > 0 &&
                        filteredStudents.every((s) => selectedStudentUids.has(s.uid))
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
          )}
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

        {activeMode === "billing" &&
          selectedStudentUids.size > 0 &&
          canEdit && (
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
                  <SVGIcon
                    name="checkmark-done-circle"
                    size={22}
                    color="#fff"
                  />
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
      </View>

      {/* Selector Modal */}
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

      {/* Payment Modal */}
      <FeePaymentModal
        visible={paymentModalVisible}
        onClose={() => {
          setPaymentModalVisible(false);
          setSelectedStudent(null);
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
        onConfirm={() =>
          handleLogPayment(
            selectedStudent,
            paymentAmount,
            receivedFrom,
            paymentMethod,
            paymentDate,
            () => setPaymentModalVisible(false),
          )
        }
        onDeletePayment={(p) =>
          handleDeletePayment(selectedStudent, p, () =>
            setPaymentModalVisible(false),
          )
        }
        saving={saving}
        canEdit={canEdit}
      />

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
                onPress={() => saveFees(() => setBillModalVisible(false))}
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
                onPress={() =>
                  saveDiscounts(() => setDiscountModalVisible(false))
                }
                style={[styles.alertBtnPri, { backgroundColor: VIBE.success }]}
              >
                <Text style={styles.alertBtnTextPri}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Daily Transactions Modal */}
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
