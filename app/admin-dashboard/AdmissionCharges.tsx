import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
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
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StatusBar,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { ClassSelectorModal } from "../../components/admin-dashboard/ClassSelectorModal";
import SVGIcon from "../../components/SVGIcon";
import { VIBE, styles } from "../../constants/admin-dashboard/ManageFeesStyles";
import { SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import {
    Student,
    useAdmissionCharges,
} from "../../hooks/admin-dashboard/useAdmissionCharges";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";
import { getStudentFinalEmail } from "../../utils/authUnify";

const THEME = {
  primary: "#6366F1", // Admission Indigo
  secondary: "#4F46E5",
};

const AdmissionStudentCard = React.memo(
  ({
    item,
    onPress,
  }: {
    item: Student;
    onPress: (student: Student) => void;
  }) => {
    const isolatedTotal =
      (item.admissionBalance || 0) +
      (item.ptaBalance || 0) +
      (item.maintenanceBalance || 0) +
      (item.booksBalance || 0) +
      (item.uniformBalance || 0) +
      (item.otherBalance || 0);
    const tuitionBalance = Math.max(
      0,
      (item.walletBalance || 0) - isolatedTotal,
    );

    return (
      <View style={styles.cardWrapper}>
        <TouchableOpacity
          style={[
            styles.financeCard,
            Platform.OS === "web" && ({ cursor: "pointer" } as any),
          ]}
          activeOpacity={0.7}
          onPress={() => onPress(item)}
        >
          <View style={styles.cardContent}>
            <View style={styles.leftSection}>
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: THEME.primary + "15" },
                ]}
              >
                <Text style={[styles.avatarText, { color: THEME.primary }]}>
                  {item.fullName.charAt(0)}
                </Text>
              </View>
              <View style={styles.mainInfo}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 2,
                  }}
                >
                  <Text style={styles.studentName} numberOfLines={1}>
                    {item.fullName}
                  </Text>
                  {item.admissionBill > 0 && (
                    <View
                      style={{
                        backgroundColor: VIBE.success,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 6,
                      }}
                    >
                      <Text
                        style={{
                          color: "#fff",
                          fontSize: 8,
                          fontWeight: "900",
                        }}
                      >
                        NEW
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.tuitionBreakdown}>
                  <View style={styles.breakdownItem}>
                    <Text style={styles.breakdownLabel}>TUITION</Text>
                    <Text style={styles.breakdownValue}>
                      ₵{tuitionBalance.toFixed(0)}
                    </Text>
                  </View>
                  <View style={styles.breakdownItem}>
                    <Text style={styles.breakdownLabel}>ADMISSION BILL</Text>
                    <Text style={styles.breakdownValue}>
                      ₵{item.admissionBill.toFixed(0)}
                    </Text>
                  </View>
                </View>

                <View style={styles.debtBox}>
                  <Text
                    style={[
                      styles.debtLabel,
                      {
                        color:
                          item.admissionBalance > 0
                            ? VIBE.danger
                            : VIBE.success,
                      },
                    ]}
                  >
                    {item.admissionBalance > 0 ? "Admission Owed: " : "Paid: "}
                  </Text>
                  <Text
                    style={[
                      styles.debtValue,
                      {
                        color:
                          item.admissionBalance > 0
                            ? VIBE.danger
                            : VIBE.success,
                      },
                    ]}
                  >
                    ₵
                    {item.admissionBalance > 0
                      ? (item.admissionBalance || 0).toFixed(0)
                      : (item.admissionPaid || 0).toFixed(0)}
                  </Text>
                </View>
              </View>
            </View>
            <SVGIcon name="chevron-forward" size={20} color={VIBE.muted} />
          </View>
        </TouchableOpacity>
      </View>
    );
  },
);

export default function AdmissionCharges() {
  const { width } = useWindowDimensions();
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const acadConfig = useAcademicConfig();
  const isMounted = useRef(true);
  const isNavigating = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  if (acadConfig.loading || !appUser) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator size="large" color={THEME.primary} />
      </View>
    );
  }

  const [selectedClassId, setSelectedClassId] = useState("all");
  const [classModalVisible, setClassModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);

  // Registration Modal State
  const [registerModalVisible, setRegisterModalVisible] = useState(false);
  const [regFullName, setRegFullName] = useState("");
  const [regClassId, setRegClassId] = useState("");
  const [regClassName, setRegClassName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("123456");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regParent1Name, setRegParent1Name] = useState("");
  const [regParent1Phone, setRegParent1Phone] = useState("");
  const [regParent2Name, setRegParent2Name] = useState("");
  const [regParent2Phone, setRegParent2Phone] = useState("");
  const [regParentLinkCode, setRegParentLinkCode] = useState("");
  const [isUsernameCustom, setIsUsernameCustom] = useState(false);

  const {
    loading,
    refreshing,
    saving,
    students,
    classes,
    stats,
    handleRefresh,
    fetchStudents,
    paymentModalVisible,
    setPaymentModalVisible,
    selectedStudent,
    setSelectedStudent,
    paymentAmount,
    setPaymentAmount,
    receivedFrom,
    setReceivedFrom,
    paymentMethod,
    setPaymentMethod,
    history,
    loadingHistory,
    activeTab,
    setActiveTab,
    billAmount,
    setBillAmount,
    handleLogPayment,
    handleLogBill,
    openPaymentModal,
    deletePayment,
    handleBulkImport,
    handleRegisterStudent,
  } = useAdmissionCharges({
    appUser,
    acadConfig,
    showToast,
    selectedClassId,
    searchQuery,
    selectedTerm,
  });

  const openRegisterModal = useCallback(() => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const initialClass = classes.find((c) => c.id === selectedClassId) || classes[0];
    setRegParentLinkCode(code);
    setRegClassId(initialClass?.id || "");
    setRegClassName(initialClass?.name || "");
    setRegFullName("");
    setRegUsername("");
    setRegPassword("123456");
    setRegParent1Name("");
    setRegParent1Phone("");
    setRegParent2Name("");
    setRegParent2Phone("");
    setIsUsernameCustom(false);
    setRegisterModalVisible(true);
  }, [selectedClassId, classes]);

  const handleFullNameChange = (text: string) => {
    setRegFullName(text);
    if (!isUsernameCustom) {
      const autoUser = text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, ".")
        .replace(/^\.|\.$/g, "");
      setRegUsername(autoUser);
    }
  };

  const handleUsernameChange = (text: string) => {
    setRegUsername(text);
    setIsUsernameCustom(true);
  };

  const handleRegisterSubmit = async () => {
    if (!regFullName.trim()) {
      showToast({ message: "Please enter student's full name", type: "error" });
      return;
    }
    if (!regClassName && !regClassId) {
      showToast({ message: "Please select a class name", type: "error" });
      return;
    }
    if (!regParent1Name.trim()) {
      showToast({ message: "Please enter Parent 1 name", type: "error" });
      return;
    }
    if (!regParent1Phone.trim()) {
      showToast({ message: "Please enter Parent 1 phone number", type: "error" });
      return;
    }

    const success = await handleRegisterStudent({
      fullName: regFullName,
      classId: regClassId,
      className: regClassName,
      username: regUsername,
      password: regPassword,
      parent1Name: regParent1Name,
      parent1Phone: regParent1Phone,
      parent2Name: regParent2Name,
      parent2Phone: regParent2Phone,
      parentLinkCode: regParentLinkCode,
    });

    if (success) {
      setRegisterModalVisible(false);
    }
  };

  const filteredStudents = useMemo(() => {
    const lower = searchQuery.toLowerCase().trim();
    if (!lower) return students;
    return students.filter((s) => s.fullName.toLowerCase().includes(lower));
  }, [students, searchQuery]);

  const handleDeletePayment = (payment: any) => {
    if (!selectedStudent || !isMounted.current) return;

    const confirmDeletion = async () => {
      const success = await deletePayment(selectedStudent, payment);
      if (success && isMounted.current) setPaymentModalVisible(false);
    };

    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        "Are you sure you want to delete this transaction? This will automatically adjust the student's balance.",
      );
      if (confirmed) {
        confirmDeletion();
      }
    } else {
      Alert.alert(
        "Confirm Deletion",
        "Are you sure you want to delete this transaction? This will automatically adjust the student's balance.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: confirmDeletion,
          },
        ],
      );
    }
  };

  const handleStudentPress = useCallback(
    (student: Student) => {
      openPaymentModal(student);
    },
    [openPaymentModal],
  );

  const renderStudentItem = useCallback(
    ({ item }: { item: Student }) => (
      <AdmissionStudentCard item={item} onPress={handleStudentPress} />
    ),
    [handleStudentPress],
  );

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <LinearGradient
          colors={[THEME.primary, THEME.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerTop}
        >
          <View style={styles.navBar}>
            <TouchableOpacity
              onPress={() => {
                if (isNavigating.current) return;
                isNavigating.current = true;
                router.push("/admin-dashboard/StudentCharges");
                setTimeout(() => {
                  isNavigating.current = false;
                }, 500);
              }}
              style={styles.headerIconBtn}
              activeOpacity={0.7}
            >
              <SVGIcon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.titleCenter}>
              <Text style={styles.headerTitle}>Admission Fees</Text>
              <Text style={styles.headerSub}>ENROLLMENT BILLING</Text>
            </View>
            <TouchableOpacity
              onPress={() => setClassModalVisible(true)}
              style={styles.headerIconBtn}
              activeOpacity={0.7}
            >
              <SVGIcon name="funnel-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.selectorGrid}>
            <TouchableOpacity
              style={styles.glassPill}
              onPress={() => setClassModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.glassLabel}>FILTER BY CLASS</Text>
              <Text style={styles.glassValue} numberOfLines={1}>
                {selectedClassId === "all"
                  ? "All Classes"
                  : classes.find((c) => c.id === selectedClassId)?.name ||
                    "Select Class"}
              </Text>
            </TouchableOpacity>
            <View style={styles.glassPill}>
              <Text style={styles.glassLabel}>ACADEMIC YEAR</Text>
              <Text style={styles.glassValue}>
                {acadConfig?.academicYear || "---"}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.searchStrip}>
          <View style={styles.searchBar}>
            <SVGIcon name="search" size={18} color={VIBE.muted} />
            <TextInput
              placeholder="Search students..."
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={VIBE.muted}
            />
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              onPress={openRegisterModal}
              style={[
                styles.refreshRound,
                {
                  width: "auto",
                  paddingHorizontal: 12,
                  flexDirection: "row",
                  gap: 6,
                  backgroundColor: THEME.primary,
                },
              ]}
              activeOpacity={0.7}
            >
              <SVGIcon name="person-add" size={18} color="#fff" />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "800",
                  color: "#fff",
                }}
              >
                New Student
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleBulkImport}
              style={[
                styles.refreshRound,
                {
                  width: "auto",
                  paddingHorizontal: 12,
                  flexDirection: "row",
                  gap: 6,
                },
              ]}
              activeOpacity={0.7}
            >
              <SVGIcon name="cloud-upload" size={18} color={THEME.primary} />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "800",
                  color: THEME.primary,
                }}
              >
                CSV
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleRefresh}
              style={styles.refreshRound}
              activeOpacity={0.7}
            >
              <SVGIcon name="refresh" size={18} color={THEME.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <FlatList
        data={filteredStudents}
        renderItem={renderStudentItem}
        keyExtractor={(item) => item.uid}
        contentContainerStyle={styles.flatListContent}
        onEndReached={() => !selectedTerm && fetchStudents()}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === "android"}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[THEME.primary]}
          />
        }
        ListHeaderComponent={
          <>
            <View
              style={[
                styles.statsDashboard,
                {
                  paddingHorizontal: 20,
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 12,
                  marginTop: 10,
                  paddingBottom: 15,
                },
              ]}
            >
              <LinearGradient
                colors={[THEME.primary, THEME.secondary]}
                style={[
                  styles.statBox,
                  { width: Math.max(150, (width - 52) / 2) },
                ]}
              >
                <Text style={styles.statLabel}>TERM BILLED</Text>
                <Text style={styles.statValue}>
                  ₵{(stats.totalBilled || 0).toLocaleString()}
                </Text>
                <SVGIcon
                  name="receipt"
                  size={24}
                  color="rgba(255,255,255,0.3)"
                  style={styles.statIcon}
                />
              </LinearGradient>
              <LinearGradient
                colors={[VIBE.success, "#059669"]}
                style={[
                  styles.statBox,
                  { width: Math.max(150, (width - 52) / 2) },
                ]}
              >
                <Text style={styles.statLabel}>TERM COLLECTED</Text>
                <Text style={styles.statValue}>
                  ₵{(stats.totalCollected || 0).toLocaleString()}
                </Text>
                <SVGIcon
                  name="cash"
                  size={24}
                  color="rgba(255,255,255,0.3)"
                  style={styles.statIcon}
                />
              </LinearGradient>
            </View>

            <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
              <Text style={styles.listTitle}>TERM-SPECIFIC ADMISSIONS</Text>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                {[1, 2, 3].map((t) => {
                  const termName = `Term ${t}`;
                  const isActive = selectedTerm === termName;
                  return (
                    <TouchableOpacity
                      key={t}
                      activeOpacity={0.8}
                      style={{
                        flex: 1,
                        backgroundColor: isActive ? THEME.primary : "#fff",
                        padding: 12,
                        borderRadius: 15,
                        borderWidth: 1,
                        borderColor: isActive ? THEME.primary : VIBE.border,
                        alignItems: "center",
                        ...SHADOWS.small,
                        ...Platform.select({
                          web: { cursor: "pointer" } as any,
                          default: {},
                        }),
                      }}
                      onPress={() => {
                        if (isActive) {
                          setSelectedTerm(null);
                        } else {
                          setSelectedTerm(termName);
                          setSearchQuery("");
                        }
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "800",
                          color: isActive ? "#fff" : VIBE.muted,
                        }}
                      >
                        TERM {t}
                      </Text>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "900",
                          color: isActive ? "#fff" : VIBE.text,
                          marginTop: 2,
                        }}
                      >
                        {stats[`term${t}Count`]}
                      </Text>
                      <Text
                        style={{
                          fontSize: 9,
                          fontWeight: "700",
                          color: isActive
                            ? "rgba(255,255,255,0.8)"
                            : VIBE.success,
                          marginTop: 1,
                        }}
                      >
                        ₵{stats[`term${t}Revenue`].toLocaleString()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {selectedTerm && (
              <View style={[styles.filterInfoBar, { marginBottom: 20 }]}>
                <Text style={styles.filterInfoText}>
                  Showing: {selectedTerm.toUpperCase()} ADMISSIONS
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedTerm(null);
                  }}
                  activeOpacity={0.7}
                >
                  <SVGIcon name="close-circle" size={20} color={VIBE.danger} />
                </TouchableOpacity>
              </View>
            )}

            <Text
              style={[
                styles.listTitle,
                { marginHorizontal: 20, marginBottom: 15 },
              ]}
            >
              STUDENT DIRECTORY
            </Text>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator
              size="large"
              color={THEME.primary}
              style={{ marginTop: 50 }}
            />
          ) : (
            <View style={styles.emptyWrap}>
              <SVGIcon
                name={
                  selectedTerm || selectedClassId !== "all"
                    ? "person"
                    : "search"
                }
                size={64}
                color="#CBD5E1"
              />
              <Text style={styles.emptyText}>
                {selectedTerm
                  ? "No students found for this term"
                  : selectedClassId !== "all"
                    ? "No admitted students found for this class"
                    : searchQuery.length < 2
                      ? "Search for a student to bill"
                      : "No students found matching your search"}
              </Text>
            </View>
          )
        }
      />

      <ClassSelectorModal
        visible={classModalVisible}
        onClose={() => setClassModalVisible(false)}
        classes={classes}
        selectedClassId={selectedClassId}
        onSelect={setSelectedClassId}
      />

      {/* Payment/Billing Modal */}
      <Modal visible={paymentModalVisible} transparent animationType="none">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.overlay}
        >
          <View style={styles.sheetBody}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>
                  {selectedStudent?.fullName}
                </Text>
                <Text
                  style={{ fontSize: 10, fontWeight: "800", color: VIBE.muted }}
                >
                  ADMISSION FEE MGMT
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setPaymentModalVisible(false)}
                style={styles.closeRound}
                activeOpacity={0.7}
              >
                <SVGIcon name="close" size={24} color={VIBE.muted} />
              </TouchableOpacity>
            </View>

            <View style={styles.modeTabs}>
              <TouchableOpacity
                style={[
                  styles.modeTab,
                  activeTab === "payment" && styles.activeModeTab,
                ]}
                activeOpacity={0.7}
                onPress={() => setActiveTab("payment")}
              >
                <SVGIcon
                  name="cash-outline"
                  size={18}
                  color={activeTab === "payment" ? "#fff" : VIBE.muted}
                />
                <Text
                  style={[
                    styles.modeTabText,
                    activeTab === "payment" && { color: "#fff" },
                  ]}
                >
                  PAYMENT
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modeTab,
                  activeTab === "billing" && styles.activeModeTab,
                ]}
                activeOpacity={0.7}
                onPress={() => setActiveTab("billing")}
              >
                <SVGIcon
                  name="receipt-outline"
                  size={18}
                  color={activeTab === "billing" ? "#fff" : VIBE.muted}
                />
                <Text
                  style={[
                    styles.modeTabText,
                    activeTab === "billing" && { color: "#fff" },
                  ]}
                >
                  BILLING
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
            >
              {activeTab === "payment" ? (
                <>
                  <View style={{ gap: 15, marginBottom: 25 }}>
                    <Text style={styles.breakdownLabel}>AMOUNT TO PAY (₵)</Text>
                    <TextInput
                      style={styles.pillInput}
                      placeholder="0.00"
                      keyboardType="numeric"
                      value={paymentAmount}
                      onChangeText={setPaymentAmount}
                    />

                    <Text style={styles.breakdownLabel}>RECEIVED FROM</Text>
                    <TextInput
                      style={[styles.pillInput, { fontSize: 16 }]}
                      placeholder="Payer Name"
                      value={receivedFrom}
                      onChangeText={setReceivedFrom}
                    />
                  </View>

                  <Text style={styles.breakdownLabel}>PAYMENT METHOD</Text>
                  <View style={styles.methodGrid}>
                    {["Cash", "Cheque", "Momo", "E-cash"].map((m) => (
                      <TouchableOpacity
                        key={m}
                        activeOpacity={0.7}
                        style={[
                          styles.methodBtn,
                          paymentMethod === m && {
                            backgroundColor: THEME.primary,
                            borderColor: THEME.primary,
                          },
                          Platform.OS === "web" &&
                            ({ cursor: "pointer" } as any),
                        ]}
                        onPress={() => setPaymentMethod(m as any)}
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
                    onPress={handleLogPayment}
                    disabled={saving}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={[THEME.primary, THEME.secondary]}
                      style={[
                        styles.saveBtn,
                        Platform.OS === "web" && ({ cursor: "pointer" } as any),
                      ]}
                    >
                      {saving ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Text style={styles.saveBtnText}>
                            CONFIRM PAYMENT
                          </Text>
                          <SVGIcon
                            name="checkmark-circle"
                            size={20}
                            color="#fff"
                          />
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={{ gap: 15, marginBottom: 25 }}>
                    <Text style={styles.breakdownLabel}>
                      ADMISSION FEE AMOUNT (₵)
                    </Text>
                    <TextInput
                      style={styles.pillInput}
                      placeholder="0.00"
                      keyboardType="numeric"
                      value={billAmount}
                      onChangeText={setBillAmount}
                    />
                  </View>
                  <TouchableOpacity
                    onPress={handleLogBill}
                    disabled={saving}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={[VIBE.purple, "#7C3AED"]}
                      style={[
                        styles.saveBtn,
                        Platform.OS === "web" && ({ cursor: "pointer" } as any),
                      ]}
                    >
                      {saving ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Text style={styles.saveBtnText}>
                            INITIATE BILLING
                          </Text>
                          <SVGIcon name="receipt" size={20} color="#fff" />
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}

              <View style={styles.historyBlock}>
                <Text style={styles.blockTitle}>Transaction History</Text>
                {loadingHistory ? (
                  <ActivityIndicator
                    color={THEME.primary}
                    style={{ marginTop: 20 }}
                  />
                ) : history.length > 0 ? (
                  history.map((h, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.transactionTile}
                      activeOpacity={0.7}
                      onPress={() => {
                        if (isNavigating.current) return;
                        isNavigating.current = true;
                        setPaymentModalVisible(false);
                        router.push({
                          pathname: "/shared/receipt-view",
                          params: {
                            type: h.type === "admission" ? "bill" : "payment",
                            studentId: selectedStudent?.uid,
                            paymentId: h.receiptNo,
                            year: h.academicYear,
                            term: h.term,
                          },
                        });
                        setTimeout(() => {
                          isNavigating.current = false;
                        }, 800);
                      }}
                      onLongPress={() => handleDeletePayment(h)}
                    >
                      <View style={styles.tileHeader}>
                        <Text
                          style={[
                            styles.tileAmt,
                            {
                              color:
                                h.type === "admission"
                                  ? VIBE.purple
                                  : VIBE.success,
                            },
                          ]}
                        >
                          ₵{h.amount.toLocaleString()}
                        </Text>
                        <View
                          style={{
                            backgroundColor:
                              h.type === "admission"
                                ? VIBE.purple + "15"
                                : VIBE.success + "15",
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 8,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 9,
                              fontWeight: "900",
                              color:
                                h.type === "admission"
                                  ? VIBE.purple
                                  : VIBE.success,
                            }}
                          >
                            {h.type === "admission" ? "BILL" : "PAYMENT"}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.tileDetail}>{h.method}</Text>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginTop: 10,
                        }}
                      >
                        <Text style={styles.tileDate}>
                          {moment(h.createdAt).format("MMM DD, YYYY • HH:mm")}
                        </Text>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              handleDeletePayment(h);
                            }}
                            style={{ padding: 4 }}
                            activeOpacity={0.7}
                          >
                            <SVGIcon
                              name="trash"
                              size={16}
                              color={VIBE.danger}
                            />
                          </TouchableOpacity>
                          <SVGIcon
                            name="eye-outline"
                            size={14}
                            color={VIBE.muted}
                          />
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.noHistory}>
                    No previous admission transactions
                  </Text>
                )}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Student Registration Modal */}
      <Modal visible={registerModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.overlay}
        >
          <View style={[styles.sheetBody, { maxHeight: "90%" }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Register Student</Text>
                <Text
                  style={{ fontSize: 10, fontWeight: "800", color: VIBE.muted }}
                >
                  DIRECT ENROLLMENT & ACCOUNT CREATION
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setRegisterModalVisible(false)}
                style={styles.closeRound}
                activeOpacity={0.7}
              >
                <SVGIcon name="close" size={24} color={VIBE.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40, gap: 16 }}
            >
              {/* Student Details */}
              <View style={{ gap: 12 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "900",
                    color: THEME.primary,
                    letterSpacing: 1,
                  }}
                >
                  STUDENT DETAILS
                </Text>

                <View>
                  <Text style={styles.breakdownLabel}>STUDENT FULL NAME *</Text>
                  <TextInput
                    style={[styles.pillInput, { fontSize: 15 }]}
                    placeholder="e.g. Kofi Mensah"
                    value={regFullName}
                    onChangeText={handleFullNameChange}
                  />
                </View>

                <View>
                  <Text style={styles.breakdownLabel}>CLASS NAME *</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                  >
                    {classes.map((c) => {
                      const isSelected = regClassName === c.name || regClassId === c.id;
                      return (
                        <TouchableOpacity
                          key={c.id || c.name}
                          activeOpacity={0.7}
                          onPress={() => {
                            setRegClassId(c.id);
                            setRegClassName(c.name);
                          }}
                          style={{
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            borderRadius: 20,
                            backgroundColor: isSelected
                              ? THEME.primary
                              : VIBE.light,
                            borderWidth: 1.5,
                            borderColor: isSelected
                              ? THEME.primary
                              : VIBE.border,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: isSelected ? "900" : "700",
                              color: isSelected ? "#fff" : VIBE.text,
                            }}
                          >
                            {c.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                <View>
                  <Text style={styles.breakdownLabel}>AUTO-GENERATED USERNAME *</Text>
                  <TextInput
                    style={[styles.pillInput, { fontSize: 15 }]}
                    placeholder="e.g. kofi.mensah"
                    value={regUsername}
                    onChangeText={handleUsernameChange}
                    autoCapitalize="none"
                  />
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "700",
                      color: VIBE.muted,
                      marginTop: 4,
                      marginLeft: 4,
                    }}
                  >
                    Login Email:{" "}
                    {getStudentFinalEmail(regUsername || "username")}
                  </Text>
                </View>

                <View>
                  <Text style={styles.breakdownLabel}>PASSWORD *</Text>
                  <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#FFFFFF",
                    borderWidth: 1,
                    borderColor: "#E2E8F0",
                    borderRadius: 16,
                    paddingHorizontal: 14,
                    height: 54,
                  }}>
                    <TextInput
                      style={[styles.pillInput, { flex: 1, borderWidth: 0, padding: 0, height: "100%", backgroundColor: "transparent", fontSize: 15 }]}
                      placeholder="Default: 123456"
                      value={regPassword}
                      onChangeText={setRegPassword}
                      secureTextEntry={!showRegPassword}
                    />
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <TouchableOpacity onPress={() => setShowRegPassword(!showRegPassword)} activeOpacity={0.7}>
                        <SVGIcon name={showRegPassword ? "eye-off" : "eye"} size={20} color="#64748B" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setRegPassword("")} activeOpacity={0.7}>
                        <SVGIcon name="close" size={18} color="#64748B" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>

              {/* Parent Info Section */}
              <View style={{ gap: 12, marginTop: 8 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "900",
                    color: THEME.primary,
                    letterSpacing: 1,
                  }}
                >
                  PARENT / GUARDIAN DETAILS
                </Text>

                <View>
                  <Text style={styles.breakdownLabel}>PARENT 1 NAME *</Text>
                  <TextInput
                    style={[styles.pillInput, { fontSize: 15 }]}
                    placeholder="Father/Mother/Guardian 1 Name"
                    value={regParent1Name}
                    onChangeText={setRegParent1Name}
                  />
                </View>

                <View>
                  <Text style={styles.breakdownLabel}>PARENT 1 PHONE NUMBER *</Text>
                  <TextInput
                    style={[styles.pillInput, { fontSize: 15 }]}
                    placeholder="e.g. 0241234567"
                    keyboardType="phone-pad"
                    value={regParent1Phone}
                    onChangeText={setRegParent1Phone}
                  />
                </View>

                <View>
                  <Text style={styles.breakdownLabel}>PARENT 2 NAME (OPTIONAL)</Text>
                  <TextInput
                    style={[styles.pillInput, { fontSize: 15 }]}
                    placeholder="Second Parent/Guardian Name"
                    value={regParent2Name}
                    onChangeText={setRegParent2Name}
                  />
                </View>

                <View>
                  <Text style={styles.breakdownLabel}>
                    PARENT 2 PHONE NUMBER (OPTIONAL)
                  </Text>
                  <TextInput
                    style={[styles.pillInput, { fontSize: 15 }]}
                    placeholder="e.g. 0501234567"
                    keyboardType="phone-pad"
                    value={regParent2Phone}
                    onChangeText={setRegParent2Phone}
                  />
                </View>
              </View>

              {/* System Auto-Generated Data Box */}
              <View
                style={{
                  backgroundColor: VIBE.light,
                  borderRadius: 16,
                  padding: 14,
                  gap: 10,
                  marginTop: 8,
                  borderWidth: 1,
                  borderColor: VIBE.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "900",
                    color: VIBE.muted,
                    letterSpacing: 1,
                  }}
                >
                  SYSTEM AUTO-GENERATED DATA
                </Text>

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <View>
                    <Text style={{ fontSize: 10, color: VIBE.muted, fontWeight: "700" }}>
                      DATE OF ADMISSION
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "800",
                        color: VIBE.text,
                        marginTop: 2,
                      }}
                    >
                      {moment().format("MMM DD, YYYY")}
                    </Text>
                  </View>

                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontSize: 10, color: VIBE.muted, fontWeight: "700" }}>
                      STUDENT / PARENT LINK CODE
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 2,
                      }}
                    >
                      <View
                        style={{
                          backgroundColor: THEME.primary + "20",
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 6,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "900",
                            color: THEME.primary,
                          }}
                        >
                          {regParentLinkCode}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          const code = Math.random()
                            .toString(36)
                            .substring(2, 8)
                            .toUpperCase();
                          setRegParentLinkCode(code);
                        }}
                        activeOpacity={0.7}
                      >
                        <SVGIcon name="refresh" size={16} color={THEME.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                onPress={handleRegisterSubmit}
                disabled={saving}
                activeOpacity={0.8}
                style={{ marginTop: 10 }}
              >
                <LinearGradient
                  colors={[THEME.primary, THEME.secondary]}
                  style={[
                    styles.saveBtn,
                    Platform.OS === "web" && ({ cursor: "pointer" } as any),
                  ]}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.saveBtnText}>
                        REGISTER & ENROLL STUDENT
                      </Text>
                      <SVGIcon name="person-add" size={20} color="#fff" />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
