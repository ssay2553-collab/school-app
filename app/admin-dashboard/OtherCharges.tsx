import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import moment from "moment";
import React, { useState, useCallback, useMemo } from "react";
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
import * as Animatable from "react-native-animatable";
import { SafeAreaView } from "react-native-safe-area-context";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";
import { useOtherCharges, Student } from "../../hooks/admin-dashboard/useOtherCharges";
import { VIBE, styles } from "../../constants/admin-dashboard/ManageFeesStyles";
import { SHADOWS } from "../../constants/theme";
import { useRef, useEffect } from "react";
import { ClassSelectorModal } from "../../components/admin-dashboard/ClassSelectorModal";

const THEME = {
  primary: "#8B5CF6", // Purple for Other Charges
  secondary: "#7C3AED",
};

const OtherStudentCard = React.memo(({
  item,
  onPress,
}: {
  item: Student;
  onPress: (student: Student) => void;
}) => {
  const isolatedTotal = (item.ptaBalance || 0) + (item.admissionBalance || 0) +
                        (item.maintenanceBalance || 0) + (item.booksBalance || 0) +
                        (item.uniformBalance || 0) + (item.otherBalance || 0);
  const tuitionBalance = Math.max(0, (item.walletBalance || 0) - isolatedTotal);

  return (
    <Animatable.View animation="fadeInUp" duration={400} style={styles.cardWrapper} useNativeDriver={false}>
      <TouchableOpacity
        style={[styles.financeCard, Platform.OS === 'web' && { cursor: 'pointer' } as any]}
        activeOpacity={0.7}
        onPress={() => onPress(item)}
      >
        <View style={styles.cardContent}>
          <View style={styles.leftSection}>
            <View style={[styles.avatar, { backgroundColor: THEME.primary + "15" }]}>
              <SVGIcon name="layers-outline" size={24} color={THEME.primary} />
            </View>
            <View style={styles.mainInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.studentName} numberOfLines={1}>{item.fullName}</Text>
                {item.exemptions?.some(e => e.startsWith('other:')) && (
                  <View style={{ backgroundColor: VIBE.warning + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={{ color: VIBE.warning, fontSize: 8, fontWeight: '900' }}>EXEMPTIONS</Text>
                  </View>
                )}
              </View>

              <View style={styles.tuitionBreakdown}>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>TUITION</Text>
                  <Text style={styles.breakdownValue}>₵{tuitionBalance.toFixed(0)}</Text>
                </View>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>OTHER BILLED</Text>
                  <Text style={styles.breakdownValue}>₵{item.otherBill.toFixed(0)}</Text>
                </View>
              </View>

              <View style={styles.debtBox}>
                <Text style={[styles.debtLabel, { color: item.otherBalance > 0 ? VIBE.danger : VIBE.success }]}>
                  {item.otherBalance > 0 ? "Owed Other: " : "Cleared: "}
                </Text>
                <Text style={[styles.debtValue, { color: item.otherBalance > 0 ? VIBE.danger : VIBE.success }]}>
                  ₵{Math.abs(item.otherBalance).toLocaleString()}
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

export default function OtherCharges() {
  const { width } = useWindowDimensions();
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

  const [selectedClassId, setSelectedClassId] = useState("all");
  const [classModalVisible, setClassModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [modalMode, setModalMode] = useState<"payment" | "charge">("payment");

  const {
    loading,
    refreshing,
    saving,
    students,
    classes,
    stats,
    appliedCharges,
    history,
    loadingHistory,
    fetchStudents,
    handleLogPayment,
    applyOtherCharge,
    applyStudentOtherCharge,
    confirmDeleteCharge,
    confirmDeletePayment,
    handleRefresh,
    toggleExemption,

    // UI States & Handlers
    paymentModalVisible,
    setPaymentModalVisible,
    selectedStudent,
    paymentAmount,
    setPaymentAmount,
    receivedFrom,
    setReceivedFrom,
    paymentMethod,
    setPaymentMethod,
    chargeType,
    setChargeType,
    chargeAmount,
    setChargeAmount,
    openPaymentModal,
  } = useOtherCharges({
    appUser,
    acadConfig,
    showToast,
    selectedClassId,
    searchQuery,
  });

  const filteredStudents = useMemo(() => {
    const lower = searchQuery.toLowerCase();
    return students.filter(s => s.fullName.toLowerCase().includes(lower));
  }, [students, searchQuery]);

  const handleOpenModal = useCallback((student: Student) => {
    setModalMode("payment");
    openPaymentModal(student);
  }, [openPaymentModal]);

  const renderStudentItem = useCallback(({ item }: { item: Student }) => (
    <OtherStudentCard item={item} onPress={handleOpenModal} />
  ), [handleOpenModal]);

  const ListHeader = useMemo(() => (
    <>
      <View style={[styles.statsDashboard, { paddingHorizontal: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }]}>
         <LinearGradient colors={[THEME.primary, THEME.secondary]} style={[styles.statBox, { width: Math.max(150, (width - 52)/2) }]}>
            <Text style={styles.statLabel}>TOTAL BILLED</Text>
            <Text style={styles.statValue}>₵{stats.totalBilled.toLocaleString()}</Text>
            <SVGIcon name="receipt" size={24} color="rgba(255,255,255,0.3)" style={styles.statIcon} />
         </LinearGradient>
         <LinearGradient colors={[VIBE.success, "#059669"]} style={[styles.statBox, { width: Math.max(150, (width - 52)/2) }]}>
            <Text style={styles.statLabel}>COLLECTED</Text>
            <Text style={styles.statValue}>₵{stats.totalCollected.toLocaleString()}</Text>
            <SVGIcon name="cash" size={24} color="rgba(255,255,255,0.3)" style={styles.statIcon} />
         </LinearGradient>
      </View>

      <View style={{ paddingHorizontal: 20, marginBottom: 25 }}>
        <Text style={styles.listTitle}>BILL NEW ITEM (CLASS BULK)</Text>
        <View style={{ marginTop: 10 }}>
          <View style={[styles.bulkInputContainer, { paddingHorizontal: 12, height: 54 }]}>
            <TextInput
              style={[styles.bulkInput, { flex: 2, fontSize: 14 }]}
              placeholder="Charge Item (e.g. Exam)"
              value={chargeType}
              onChangeText={setChargeType}
              placeholderTextColor={VIBE.muted}
            />
            <View style={{ width: 1, height: 25, backgroundColor: VIBE.border, marginHorizontal: 10 }} />
            <TextInput
              style={[styles.bulkInput, { flex: 1, fontSize: 14, textAlign: 'center' }]}
              placeholder="Amount"
              keyboardType="numeric"
              value={chargeAmount}
              onChangeText={setChargeAmount}
              placeholderTextColor={VIBE.muted}
            />
          </View>

          <TouchableOpacity
             onPress={applyOtherCharge}
             style={{
               marginTop: 10,
               backgroundColor: THEME.primary,
               height: 50,
               borderRadius: 15,
               flexDirection: 'row',
               justifyContent: 'center',
               alignItems: 'center',
               gap: 8,
               ...SHADOWS.small,
               ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} })
             }}
             activeOpacity={0.8}
             disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <SVGIcon name="add-circle-outline" size={20} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 }}>APPLY BULK CHARGE</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
        {selectedClassId === "all" && (
          <Text style={{ fontSize: 10, color: VIBE.danger, marginTop: 8, fontWeight: "700" }}>
            * Select a specific class to enable bulk billing
          </Text>
        )}
      </View>

      {appliedCharges.length > 0 && (
        <View style={styles.breakdownContainer}>
          <Text style={styles.listTitle}>APPLIED CHARGES ({selectedClassId === "all" ? "TOTAL" : classes.find(c => c.id === selectedClassId)?.name})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.breakdownScroll}>
            {appliedCharges.map((item, idx) => (
              <View key={idx} style={styles.breakdownCard}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.summaryBreakdownLabel} numberOfLines={1}>{item.category}</Text>
                    {selectedClassId !== "all" && (
                      <TouchableOpacity onPress={() => confirmDeleteCharge(item.category)} activeOpacity={0.7}>
                        <SVGIcon name="close-circle" size={16} color={VIBE.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.summaryBreakdownValue}>₵{item.amount.toLocaleString()}</Text>
                  <Text style={{ fontSize: 9, color: VIBE.muted, fontWeight: '700' }}>{item.count} students</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      <Text style={[styles.listTitle, { marginHorizontal: 20, marginTop: 25, marginBottom: 15 }]}>STUDENT DIRECTORY</Text>
    </>
  ), [stats, chargeType, setChargeType, chargeAmount, setChargeAmount, applyOtherCharge, saving, selectedClassId, appliedCharges, classes, confirmDeleteCharge, THEME, width]);

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <LinearGradient
          colors={[THEME.primary, THEME.secondary]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.headerTop}
        >
          <View style={styles.navBar}>
            <TouchableOpacity
              onPress={() => {
                if (isNavigating.current) return;
                isNavigating.current = true;
                router.back();
                setTimeout(() => { isNavigating.current = false; }, 500);
              }}
              style={styles.headerIconBtn}
              activeOpacity={0.7}
            >
              <SVGIcon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.titleCenter}>
              <Text style={styles.headerTitle}>Other Charges</Text>
              <Text style={styles.headerSub}>GRADUATION & SPECIALS</Text>
            </View>
            <TouchableOpacity onPress={() => setClassModalVisible(true)} style={styles.headerIconBtn} activeOpacity={0.7}>
              <SVGIcon name="funnel-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.selectorGrid}>
            <TouchableOpacity style={styles.glassPill} onPress={() => setClassModalVisible(true)} activeOpacity={0.8}>
              <Text style={styles.glassLabel}>TARGET CLASS</Text>
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
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshRound} activeOpacity={0.7}>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[THEME.primary]} />}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={THEME.primary} style={{ marginTop: 50 }} />
          ) : (
            <View style={styles.emptyWrap}>
              <SVGIcon name="search" size={64} color="#CBD5E1" />
              <Text style={styles.emptyText}>
                {searchQuery.length < 2 && selectedClassId === "all"
                  ? "Search for a student to manage other fees"
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

      <Modal visible={paymentModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
          <View style={styles.sheetBody}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>{selectedStudent?.fullName}</Text>
                <Text style={{ fontSize: 10, fontWeight: '800', color: VIBE.muted }}>MANAGE OTHER FEES</Text>
              </View>
              <TouchableOpacity onPress={() => setPaymentModalVisible(false)} style={styles.closeRound} activeOpacity={0.7}>
                <SVGIcon name="close" size={24} color={VIBE.muted} />
              </TouchableOpacity>
            </View>

            <View style={[styles.modeTabs, { marginBottom: 20 }]}>
              <TouchableOpacity
                style={[styles.modeTab, modalMode === "payment" && styles.activeModeTab]}
                activeOpacity={0.7}
                onPress={() => setModalMode("payment")}
              >
                <SVGIcon name="cash-outline" size={18} color={modalMode === "payment" ? "#fff" : VIBE.muted} />
                <Text style={[styles.modeTabText, modalMode === "payment" && { color: "#fff" }]}>PAYMENT</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeTab, modalMode === "charge" && styles.activeModeTab]}
                activeOpacity={0.7}
                onPress={() => setModalMode("charge")}
              >
                <SVGIcon name="add-circle-outline" size={18} color={modalMode === "charge" ? "#fff" : VIBE.muted} />
                <Text style={[styles.modeTabText, modalMode === "charge" && { color: "#fff" }]}>BILL ITEM</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              {modalMode === "payment" ? (
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
                    {["Cash", "Cheque", "Momo", "E-cash"].map(m => (
                      <TouchableOpacity
                        key={m}
                        activeOpacity={0.7}
                        style={[
                          styles.methodBtn,
                          paymentMethod === m && { backgroundColor: THEME.primary, borderColor: THEME.primary },
                          Platform.OS === 'web' && { cursor: 'pointer' } as any
                        ]}
                        onPress={() => setPaymentMethod(m as any)}
                      >
                        <Text style={[styles.methodText, paymentMethod === m && { color: "#fff" }]}>{m}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity onPress={handleLogPayment} disabled={saving} activeOpacity={0.8}>
                    <LinearGradient colors={[THEME.primary, THEME.secondary]} style={[styles.saveBtn, Platform.OS === 'web' && { cursor: 'pointer' } as any]}>
                      {saving ? <ActivityIndicator color="#fff" /> : (
                        <>
                          <Text style={styles.saveBtnText}>CONFIRM PAYMENT</Text>
                          <SVGIcon name="checkmark-circle" size={20} color="#fff" />
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                  <View style={{ marginTop: 20, padding: 15, backgroundColor: VIBE.light, borderRadius: 15 }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: VIBE.dark, marginBottom: 10 }}>Active Exemptions</Text>
                    {selectedStudent?.exemptions?.filter(e => e.startsWith('other:')).length === 0 ? (
                      <Text style={{ fontSize: 10, color: VIBE.muted, fontStyle: 'italic' }}>No active exemptions for other charges</Text>
                    ) : (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {selectedStudent?.exemptions?.filter(e => e.startsWith('other:')).map((e, idx) => (
                          <TouchableOpacity
                            key={idx}
                            onPress={() => toggleExemption(selectedStudent.uid, e, false)}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                              backgroundColor: VIBE.warning + '20',
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 8,
                              borderWidth: 1,
                              borderColor: VIBE.warning + '40'
                            }}
                          >
                            <Text style={{ fontSize: 10, fontWeight: '700', color: VIBE.warning }}>{e.replace('other:', '')}</Text>
                            <SVGIcon name="close-circle" size={12} color={VIBE.warning} />
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                </>
              ) : (
                <>
                  <View style={{ gap: 15, marginBottom: 25 }}>
                    <Text style={styles.breakdownLabel}>ITEM DESCRIPTION (e.g. Graduation Fee)</Text>
                    <TextInput
                      style={[styles.pillInput, { fontSize: 16 }]}
                      placeholder="Description"
                      value={chargeType}
                      onChangeText={setChargeType}
                    />

                    <Text style={styles.breakdownLabel}>CHARGE AMOUNT (₵)</Text>
                    <TextInput
                      style={styles.pillInput}
                      placeholder="0.00"
                      keyboardType="numeric"
                      value={chargeAmount}
                      onChangeText={setChargeAmount}
                    />
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      onPress={() => selectedStudent && applyStudentOtherCharge(selectedStudent)}
                      disabled={saving}
                      activeOpacity={0.8}
                      style={{ flex: 2 }}
                    >
                      <LinearGradient colors={[VIBE.purple, "#6D28D9"]} style={[styles.saveBtn, Platform.OS === 'web' && { cursor: 'pointer' } as any]}>
                        {saving ? <ActivityIndicator color="#fff" /> : (
                          <>
                            <Text style={styles.saveBtnText}>ADD CHARGE</Text>
                            <SVGIcon name="add-circle" size={20} color="#fff" />
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>

                    {chargeType.trim().length > 0 && (
                      <TouchableOpacity
                        onPress={() => {
                          const type = `other:${chargeType.trim()}`;
                          const isExempted = selectedStudent?.exemptions?.includes(type);
                          toggleExemption(selectedStudent!.uid, type, !isExempted);
                        }}
                        disabled={saving}
                        activeOpacity={0.8}
                        style={{
                          flex: 1,
                          backgroundColor: selectedStudent?.exemptions?.includes(`other:${chargeType.trim()}`) ? VIBE.warning : VIBE.light,
                          borderRadius: 15,
                          justifyContent: 'center',
                          alignItems: 'center',
                          borderWidth: 1,
                          borderColor: VIBE.border
                        }}
                      >
                        <Text style={{
                          fontSize: 10,
                          fontWeight: '900',
                          color: selectedStudent?.exemptions?.includes(`other:${chargeType.trim()}`) ? '#fff' : VIBE.muted,
                          textAlign: 'center'
                        }}>
                          {selectedStudent?.exemptions?.includes(`other:${chargeType.trim()}`) ? 'EXEMPTED' : 'EXEMPT'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {chargeType.length > 0 && chargeAmount.length > 0 && (
                    <Text style={{ fontSize: 10, color: VIBE.muted, textAlign: 'center', marginTop: 10, fontWeight: '700' }}>
                      * This will add '{chargeType}' to {selectedStudent?.fullName}'s bill
                    </Text>
                  )}
                </>
              )}

              <View style={styles.historyBlock}>
                <Text style={styles.blockTitle}>Transaction History</Text>
                {loadingHistory ? <ActivityIndicator color={THEME.primary} style={{ marginTop: 20 }} /> : (
                  history.length > 0 ? history.map((h, i) => (
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
                            type: h.type === 'other' ? 'bill' : 'payment',
                            studentId: selectedStudent?.uid,
                            paymentId: h.receiptNo,
                            year: h.academicYear,
                            term: h.term
                          }
                        });
                        setTimeout(() => { isNavigating.current = false; }, 800);
                      }}
                      onLongPress={() => confirmDeletePayment(h)}
                    >
                      <View style={styles.tileHeader}>
                        <Text style={[styles.tileAmt, { color: h.type === 'other' ? VIBE.info : VIBE.success }]}>
                          ₵{h.amount.toLocaleString()}
                        </Text>
                        <View style={{ backgroundColor: h.type === 'other' ? VIBE.info + '15' : VIBE.success + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                           <Text style={{ fontSize: 9, fontWeight: '900', color: h.type === 'other' ? VIBE.info : VIBE.success }}>
                             {h.type === 'other' ? 'BILL' : 'PAYMENT'}
                           </Text>
                        </View>
                      </View>
                      <Text style={styles.tileDetail}>{h.otherCategory || h.method || h.receivedFrom}</Text>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                         <Text style={styles.tileDate}>{moment(h.createdAt).format("MMM DD, YYYY • HH:mm")}</Text>
                         <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              confirmDeletePayment(h);
                            }}
                            activeOpacity={0.7}
                            style={{ padding: 4 }}
                          >
                            <SVGIcon name="trash" size={16} color={VIBE.danger} />
                          </TouchableOpacity>
                          <SVGIcon name="eye-outline" size={14} color={VIBE.muted} />
                        </View>
                      </View>
                    </TouchableOpacity>
                  )) : <Text style={styles.noHistory}>No history available</Text>
                )}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
