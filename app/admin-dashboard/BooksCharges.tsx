import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  collection,
  getDocsFromServer,
  query,
  where,
} from "firebase/firestore";
import moment from "moment";
import React, { useCallback, useMemo, useState } from "react";
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
  Dimensions,
} from "react-native";
import * as Animatable from "react-native-animatable";
import { SafeAreaView } from "react-native-safe-area-context";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { db } from "../../firebaseConfig";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";
import { ClassSelectorModal } from "../../components/admin-dashboard/ClassSelectorModal";
import { VIBE, styles } from "../../constants/admin-dashboard/ManageFeesStyles";
import { useBooksCharges, Student } from "../../hooks/admin-dashboard/useBooksCharges";
import { useRef, useEffect } from "react";

const { width } = Dimensions.get("window");

const THEME = {
  primary: "#3B82F6", // Books Blue
  secondary: "#2563EB",
};

const BooksStudentCard = React.memo(({
  item,
  onPress,
}: {
  item: Student;
  onPress: (student: Student) => void;
}) => {
  const isolatedTotal = (item.admissionBalance || 0) + (item.ptaBalance || 0) +
                        (item.maintenanceBalance || 0) + (item.booksBalance || 0) +
                        (item.uniformBalance || 0) + (item.otherBalance || 0);
  const tuitionBalance = Math.max(0, (item.walletBalance || 0) - isolatedTotal);

  return (
    <Animatable.View animation="fadeInUp" duration={400} style={styles.cardWrapper}>
      <TouchableOpacity
        style={styles.financeCard}
        onPress={() => onPress(item)}
      >
        <View style={styles.cardContent}>
          <View style={styles.leftSection}>
            <View style={[styles.avatar, { backgroundColor: THEME.primary + "15" }]}>
              <Text style={[styles.avatarText, { color: THEME.primary }]}>{item.fullName.charAt(0)}</Text>
            </View>
            <View style={styles.mainInfo}>
              <Text style={styles.studentName} numberOfLines={1}>{item.fullName}</Text>

              <View style={styles.tuitionBreakdown}>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>TUITION</Text>
                  <Text style={styles.breakdownValue}>₵{tuitionBalance.toFixed(0)}</Text>
                </View>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>BOOKS BILL</Text>
                  <Text style={styles.breakdownValue}>₵{item.booksBill.toFixed(0)}</Text>
                </View>
              </View>

              <View style={styles.debtBox}>
                <Text style={[styles.debtLabel, { color: item.booksBalance > 0 ? VIBE.danger : VIBE.success }]}>
                  {item.booksBalance > 0 ? "Books Owed: " : "Paid: "}
                </Text>
                <Text style={[styles.debtValue, { color: item.booksBalance > 0 ? VIBE.danger : VIBE.success }]}>
                  ₵{Math.max(0, item.booksBalance || 0).toFixed(0)}
                </Text>
              </View>
            </View>
          </View>
          <SVGIcon name="chevron-forward" size={20} color={VIBE.muted} />
        </View>
      </TouchableOpacity>
    </Animatable.View>
  );
});

export default function BooksCharges() {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const acadConfig = useAcademicConfig();
  const isMounted = useRef(true);
  const isNavigating = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  if (acadConfig.loading || !appUser) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={THEME.primary} />
      </View>
    );
  }

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [classModalVisible, setClassModalVisible] = useState(false);

  const {
    loading,
    refreshing,
    saving,
    students,
    classes,
    stats,
    handleRefresh,
    handleLogPayment,
    handleLogBill,
    confirmDeletePayment,
    fetchStudents,

    // UI state & handlers
    selectedStudent,
    modalVisible,
    setModalVisible,
    activeTab,
    setActiveTab,
    bookTitle,
    setBookTitle,
    billAmount,
    setBillAmount,
    paymentAmount,
    setPaymentAmount,
    receivedFrom,
    setReceivedFrom,
    paymentMethod,
    setPaymentMethod,
    history,
    loadingHistory,
    openStudentModal,
  } = useBooksCharges({
    appUser,
    acadConfig,
    showToast,
    selectedClassId,
    searchQuery,
  });

  const filteredStudents = useMemo(() => {
    const lower = searchQuery.toLowerCase().trim();
    if (!lower) return students;
    return students.filter(s => s.fullName.toLowerCase().includes(lower));
  }, [students, searchQuery]);

  const renderStudentItem = useCallback(({ item }: { item: Student }) => (
    <BooksStudentCard item={item} onPress={openStudentModal} />
  ), [openStudentModal]);


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
              }}
              style={styles.headerIconBtn}
            >
              <SVGIcon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.titleCenter}>
              <Text style={styles.headerTitle}>Books & Stationery</Text>
              <Text style={styles.headerSub}>INVENTORY BILLING</Text>
            </View>
            <TouchableOpacity onPress={() => setClassModalVisible(true)} style={styles.headerIconBtn}>
              <SVGIcon name="funnel-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.selectorGrid}>
            <TouchableOpacity style={styles.glassPill} onPress={() => setClassModalVisible(true)}>
              <Text style={styles.glassLabel}>FILTER BY CLASS</Text>
              <Text style={styles.glassValue} numberOfLines={1}>
                {selectedClassId === "all" ? "All Classes" : classes.find(c => c.id === selectedClassId)?.name || "Select Class"}
              </Text>
            </TouchableOpacity>
            <View style={styles.glassPill}>
              <Text style={styles.glassLabel}>ACADEMIC YEAR</Text>
              <Text style={styles.glassValue}>{acadConfig?.academicYear || "---"}</Text>
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
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshRound}>
            <SVGIcon name="refresh" size={18} color={THEME.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={filteredStudents}
        renderItem={renderStudentItem}
        keyExtractor={item => item.uid}
        contentContainerStyle={styles.flatListContent}
        onEndReached={() => fetchStudents()}
        removeClippedSubviews={Platform.OS === "android"}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[THEME.primary]} />
        }
        ListHeaderComponent={
          <>
            <View style={[styles.statsDashboard, { paddingHorizontal: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10, paddingBottom: 15 }]}>
              <LinearGradient colors={[THEME.primary, THEME.secondary]} style={[styles.statBox, { width: (width - 52)/2 }]}>
                <Text style={styles.statLabel}>TERM BILLED</Text>
                <Text style={styles.statValue}>₵{(stats.totalBilled || 0).toLocaleString()}</Text>
                <SVGIcon name="receipt" size={24} color="rgba(255,255,255,0.3)" style={styles.statIcon} />
              </LinearGradient>
              <LinearGradient colors={[VIBE.success, "#059669"]} style={[styles.statBox, { width: (width - 52)/2 }]}>
                <Text style={styles.statLabel}>TERM COLLECTED</Text>
                <Text style={styles.statValue}>₵{(stats.totalCollected || 0).toLocaleString()}</Text>
                <SVGIcon name="cash" size={24} color="rgba(255,255,255,0.3)" style={styles.statIcon} />
              </LinearGradient>
            </View>
            <Text style={[styles.listTitle, { marginHorizontal: 20, marginBottom: 15 }]}>STUDENT DIRECTORY</Text>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={THEME.primary} style={{ marginTop: 50 }} />
          ) : (
            <View style={styles.emptyWrap}>
              <SVGIcon name="search" size={64} color="#CBD5E1" />
              <Text style={styles.emptyText}>No students found</Text>
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

      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
          <View style={styles.sheetBody}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>{selectedStudent?.fullName}</Text>
                <Text style={{ fontSize: 10, fontWeight: '800', color: VIBE.muted }}>BOOKS & STATIONERY MGMT</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeRound}>
                <SVGIcon name="close" size={24} color={VIBE.muted} />
              </TouchableOpacity>
            </View>

            <View style={styles.modeTabs}>
              <TouchableOpacity
                style={[styles.modeTab, activeTab === "payment" && styles.activeModeTab]}
                onPress={() => setActiveTab("payment")}
              >
                <SVGIcon name="cash-outline" size={18} color={activeTab === "payment" ? "#fff" : VIBE.muted} />
                <Text style={[styles.modeTabText, activeTab === "payment" && { color: "#fff" }]}>PAYMENT</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeTab, activeTab === "billing" && styles.activeModeTab]}
                onPress={() => setActiveTab("billing")}
              >
                <SVGIcon name="receipt-outline" size={18} color={activeTab === "billing" ? "#fff" : VIBE.muted} />
                <Text style={[styles.modeTabText, activeTab === "billing" && { color: "#fff" }]}>BILLING</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
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
                    {["Cash", "Momo", "Cheque", "E-cash"].map(m => (
                      <TouchableOpacity
                        key={m}
                        style={[styles.methodBtn, paymentMethod === m && { backgroundColor: THEME.primary, borderColor: THEME.primary }]}
                        onPress={() => setPaymentMethod(m as any)}
                      >
                        <Text style={[styles.methodText, paymentMethod === m && { color: "#fff" }]}>{m}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity onPress={handleLogPayment} disabled={saving}>
                    <LinearGradient colors={[THEME.primary, THEME.secondary]} style={styles.saveBtn}>
                      {saving ? <ActivityIndicator color="#fff" /> : (
                        <>
                          <Text style={styles.saveBtnText}>CONFIRM PAYMENT</Text>
                          <SVGIcon name="checkmark-circle" size={20} color="#fff" />
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={{ gap: 15, marginBottom: 25 }}>
                    <Text style={styles.breakdownLabel}>ITEM / BOOK TITLE</Text>
                    <TextInput
                      style={[styles.pillInput, { fontSize: 16 }]}
                      placeholder="e.g. Science Textbook Vol 1"
                      value={bookTitle}
                      onChangeText={setBookTitle}
                    />
                    <Text style={styles.breakdownLabel}>CHARGE AMOUNT (₵)</Text>
                    <TextInput
                      style={styles.pillInput}
                      placeholder="0.00"
                      keyboardType="numeric"
                      value={billAmount}
                      onChangeText={setBillAmount}
                    />
                  </View>
                  <TouchableOpacity onPress={handleLogBill} disabled={saving}>
                    <LinearGradient colors={[VIBE.purple, "#7C3AED"]} style={styles.saveBtn}>
                      {saving ? <ActivityIndicator color="#fff" /> : (
                        <>
                          <Text style={styles.saveBtnText}>APPLY CHARGE</Text>
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
                  <ActivityIndicator color={THEME.primary} style={{ marginTop: 20 }} />
                ) : history.length > 0 ? (
                  history.map((h, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.transactionTile}
                      onPress={() => {
                        setModalVisible(false);
                        if (isNavigating.current) return;
                        isNavigating.current = true;
                        router.push({
                          pathname: "/shared/receipt-view",
                          params: {
                            type: h.type === 'books' ? 'bill' : 'payment',
                            studentId: selectedStudent?.uid,
                            paymentId: h.receiptNo,
                            year: h.academicYear,
                            term: h.term
                          }
                        });
                        setTimeout(() => { isNavigating.current = false; }, 500);
                      }}
                      onLongPress={() => confirmDeletePayment(h)}
                    >
                      <View style={styles.tileHeader}>
                        <Text style={[styles.tileAmt, { color: h.type === 'books' ? VIBE.purple : VIBE.success }]}>
                          ₵{h.amount.toLocaleString()}
                        </Text>
                        <View style={{ backgroundColor: h.type === 'books' ? VIBE.purple + '15' : VIBE.success + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                          <Text style={{ fontSize: 9, fontWeight: '900', color: h.type === 'books' ? VIBE.purple : VIBE.success }}>
                            {h.type === 'books' ? 'BILL' : 'PAYMENT'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.tileDetail}>{h.method}</Text>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                        <Text style={styles.tileDate}>{moment(h.createdAt).format("MMM DD, YYYY • HH:mm")}</Text>
                        <SVGIcon name="eye-outline" size={14} color={VIBE.muted} />
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.noHistory}>No previous book transactions</Text>
                )}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
