import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  collection,
  getDocsFromServer,
  query,
  where,
} from "firebase/firestore";
import moment from "moment";
import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
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
import { COLORS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { db } from "../../firebaseConfig";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";
import { useMaintenanceCharges, Student } from "../../hooks/admin-dashboard/useMaintenanceCharges";


import { VIBE, styles } from "../../constants/admin-dashboard/ManageFeesStyles";
import { SHADOWS } from "../../constants/theme";
import { ClassSelectorModal } from "../../components/admin-dashboard/ClassSelectorModal";

const THEME = {
  primary: "#EF4444", // Maintenance Color
  secondary: "#DC2626",
};

export default function MaintenanceCharges() {
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

  const {
    loading,
    refreshing,
    saving,
    students,
    classes,
    stats,
    handleRefresh,
    handleLogPayment,
    handleApplyBulkCharge,
    confirmDeletePayment,
    fetchStudents,
    toggleExemption,

    // UI state & handlers
    paymentModalVisible,
    setPaymentModalVisible,
    selectedStudent,
    paymentAmount,
    setPaymentAmount,
    receivedFrom,
    setReceivedFrom,
    paymentMethod,
    setPaymentMethod,
    history,
    loadingHistory,
    chargeAmount,
    setChargeAmount,
    openPaymentModal,
  } = useMaintenanceCharges({
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

  const renderStudentItem = useCallback(({ item }: { item: Student }) => {
    const isolatedTotal = (item.ptaBalance || 0) + (item.admissionBalance || 0) +
                          (item.maintenanceBalance || 0) + (item.booksBalance || 0) +
                          (item.uniformBalance || 0) + (item.otherBalance || 0);
    const tuitionBalance = Math.max(0, (item.walletBalance || 0) - isolatedTotal);

    return (
      <Animatable.View animation="fadeInUp" duration={400} style={styles.cardWrapper} useNativeDriver={false}>
        <TouchableOpacity
          style={[styles.financeCard, Platform.OS === 'web' && { cursor: 'pointer' } as any]}
          activeOpacity={0.7}
          onPress={() => openPaymentModal(item)}
        >
          <View style={styles.cardContent}>
            <View style={styles.leftSection}>
              <View style={[styles.avatar, { backgroundColor: THEME.primary + "15" }]}>
                <SVGIcon name="construct-outline" size={24} color={THEME.primary} />
              </View>
              <View style={styles.mainInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.studentName} numberOfLines={1}>{item.fullName}</Text>
                  {item.exemptions?.includes('maintenance') && (
                    <View style={{ backgroundColor: VIBE.warning + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                      <Text style={{ color: VIBE.warning, fontSize: 8, fontWeight: '900' }}>EXEMPTED</Text>
                    </View>
                  )}
                </View>

                <View style={styles.tuitionBreakdown}>
                  <View style={styles.breakdownItem}>
                    <Text style={styles.breakdownLabel}>TUITION</Text>
                    <Text style={styles.breakdownValue}>₵{tuitionBalance.toFixed(0)}</Text>
                  </View>
                  <View style={styles.breakdownItem}>
                    <Text style={styles.breakdownLabel}>MAINT. BILLED</Text>
                    <Text style={styles.breakdownValue}>₵{item.maintenanceBill.toFixed(0)}</Text>
                  </View>
                </View>

                <View style={styles.debtBox}>
                  <Text style={[styles.debtLabel, { color: item.maintenanceBalance > 0 ? VIBE.danger : VIBE.success }]}>
                    {item.maintenanceBalance > 0 ? "Maint. Arrears: " : "Cleared: "}
                  </Text>
                  <Text style={[styles.debtValue, { color: item.maintenanceBalance > 0 ? VIBE.danger : VIBE.success }]}>
                    ₵{Math.abs(item.maintenanceBalance).toLocaleString()}
                  </Text>
                </View>
              </View>
            </View>
            <SVGIcon name="chevron-forward" size={20} color={VIBE.muted} />
          </View>
        </TouchableOpacity>
      </Animatable.View>
    );
  }, [openPaymentModal, THEME.primary]);

  const ListHeader = useMemo(() => (
    <>
      <View style={[styles.statsDashboard, { paddingHorizontal: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 }]}>
         <LinearGradient colors={[THEME.primary, THEME.secondary]} style={[styles.statBox, { width: Math.max(150, (width - 52)/2) }]}>
            <Text style={styles.statLabel}>TERM BILLED</Text>
            <Text style={styles.statValue}>₵{stats.totalBilled.toLocaleString()}</Text>
            <SVGIcon name="receipt" size={24} color="rgba(255,255,255,0.3)" style={styles.statIcon} />
         </LinearGradient>
         <LinearGradient colors={[VIBE.success, "#059669"]} style={[styles.statBox, { width: Math.max(150, (width - 52)/2) }]}>
            <Text style={styles.statLabel}>TERM COLLECTED</Text>
            <Text style={styles.statValue}>₵{stats.totalCollected.toLocaleString()}</Text>
            <SVGIcon name="cash" size={24} color="rgba(255,255,255,0.3)" style={styles.statIcon} />
         </LinearGradient>
      </View>

      <View style={{ paddingHorizontal: 20, marginBottom: 25 }}>
        <Text style={styles.listTitle}>APPLY MAINTENANCE FEE (CLASS BULK)</Text>
        <View style={{ marginTop: 10 }}>
          <View style={[styles.bulkInputContainer, { paddingHorizontal: 12, height: 54 }]}>
            <TextInput
              style={[styles.bulkInput, { flex: 1, fontSize: 14 }]}
              placeholder="Enter Amount (₵)"
              keyboardType="numeric"
              value={chargeAmount}
              onChangeText={setChargeAmount}
              placeholderTextColor={VIBE.muted}
            />
          </View>
          <TouchableOpacity
             onPress={handleApplyBulkCharge}
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
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 }}>APPLY BULK MAINTENANCE</Text>
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

      <Text style={[styles.listTitle, { marginHorizontal: 20, marginBottom: 15 }]}>STUDENT DIRECTORY</Text>
    </>
  ), [stats, chargeAmount, setChargeAmount, handleApplyBulkCharge, saving, selectedClassId, THEME, width]);

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
              <Text style={styles.headerTitle}>Maintenance</Text>
              <Text style={styles.headerSub}>FACILITY BILLING</Text>
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
              <Text style={styles.glassLabel}>TERM / YEAR</Text>
              <Text style={styles.glassValue}>{acadConfig?.currentTerm || "---"}</Text>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[THEME.primary]} />}
        removeClippedSubviews={Platform.OS === "android"}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={THEME.primary} style={{ marginTop: 50 }} />
          ) : (
            <View style={styles.emptyWrap}>
              <SVGIcon name="search" size={64} color="#CBD5E1" />
              <Text style={styles.emptyText}>
                {searchQuery.length < 2 && selectedClassId === "all"
                  ? "Search for a student to manage maintenance fees"
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
                <Text style={{ fontSize: 10, fontWeight: '800', color: VIBE.muted }}>MAINTENANCE PAYMENT</Text>
              </View>
              <TouchableOpacity onPress={() => setPaymentModalVisible(false)} style={styles.closeRound} activeOpacity={0.7}>
                <SVGIcon name="close" size={24} color={VIBE.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
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

              <View style={{ marginVertical: 20, padding: 15, backgroundColor: VIBE.light, borderRadius: 15, borderStyle: 'dashed', borderWidth: 1, borderColor: VIBE.border }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: VIBE.dark }}>Individual Exemption</Text>
                    <Text style={{ fontSize: 10, color: VIBE.muted }}>Exclude from bulk maintenance billing</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => selectedStudent && toggleExemption(selectedStudent.uid, 'maintenance', !selectedStudent.exemptions?.includes('maintenance'))}
                    activeOpacity={0.7}
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: selectedStudent?.exemptions?.includes('maintenance') ? VIBE.warning : '#CBD5E1',
                      justifyContent: 'center',
                      paddingHorizontal: 2
                    }}
                  >
                    <View style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: '#fff',
                      alignSelf: selectedStudent?.exemptions?.includes('maintenance') ? 'flex-end' : 'flex-start'
                    }} />
                  </TouchableOpacity>
                </View>
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
                            type: h.type === 'maintenance' ? 'bill' : 'payment',
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
                        <Text style={[styles.tileAmt, { color: h.type === 'maintenance' ? VIBE.info : VIBE.success }]}>
                          ₵{h.amount.toLocaleString()}
                        </Text>
                        <View style={{ backgroundColor: h.type === 'maintenance' ? VIBE.info + '15' : VIBE.success + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                           <Text style={{ fontSize: 9, fontWeight: '900', color: h.type === 'maintenance' ? VIBE.info : VIBE.success }}>
                             {h.type === 'maintenance' ? 'BILL' : 'PAYMENT'}
                           </Text>
                        </View>
                      </View>
                      <Text style={styles.tileDetail}>{h.method || h.receivedFrom}</Text>
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
