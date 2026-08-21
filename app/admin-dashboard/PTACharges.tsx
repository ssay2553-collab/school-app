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
  Dimensions,
} from "react-native";
import * as Animatable from "react-native-animatable";
import { SafeAreaView } from "react-native-safe-area-context";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";
import { usePTACharges, Student } from "../../hooks/admin-dashboard/usePTACharges";

import { VIBE, styles } from "../../constants/admin-dashboard/ManageFeesStyles";
import { SHADOWS } from "../../constants/theme";
import { ClassSelectorModal } from "../../components/admin-dashboard/ClassSelectorModal";

const { width } = Dimensions.get("window");

const THEME = {
  primary: "#F59E0B", // PTA Orange
  secondary: "#D97706",
};

const PTAStudentCard = React.memo(({
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
    <Animatable.View animation="fadeInUp" duration={400} style={styles.cardWrapper}>
      <TouchableOpacity
        style={styles.financeCard}
        onPress={() => onPress(item)}
      >
        <View style={styles.cardContent}>
          <View style={styles.leftSection}>
            <View style={[styles.avatar, { backgroundColor: THEME.primary + "15" }]}>
              <SVGIcon name="people-outline" size={24} color={THEME.primary} />
            </View>
            <View style={styles.mainInfo}>
              <Text style={styles.studentName} numberOfLines={1}>{item.fullName}</Text>

              <View style={styles.tuitionBreakdown}>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>TUITION</Text>
                  <Text style={styles.breakdownValue}>₵{tuitionBalance.toFixed(0)}</Text>
                </View>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>PTA BILLED</Text>
                  <Text style={styles.breakdownValue}>₵{item.ptaBill.toFixed(0)}</Text>
                </View>
              </View>

              <View style={styles.debtBox}>
                <Text style={[styles.debtLabel, { color: item.ptaBalance > 0 ? VIBE.danger : VIBE.success }]}>
                  {item.ptaBalance > 0 ? "PTA Arrears: " : "Cleared: "}
                </Text>
                <Text style={[styles.debtValue, { color: item.ptaBalance > 0 ? VIBE.danger : VIBE.success }]}>
                  ₵{Math.abs(item.ptaBalance).toLocaleString()}
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

export default function PTACharges() {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const acadConfig = useAcademicConfig();

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
    history,
    loadingHistory,
    fetchStudents,
    handleRefresh,

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
    chargeAmount,
    setChargeAmount,
    handleConfirmPayment,
    handleApplyBulkCharge,
    confirmDeletePayment,
    openPaymentModal,
  } = usePTACharges({
    appUser,
    acadConfig,
    showToast,
    selectedClassId,
  });

  const filteredStudents = useMemo(() => {
    const lower = searchQuery.toLowerCase();
    return students.filter(s => s.fullName.toLowerCase().includes(lower));
  }, [students, searchQuery]);

  const renderStudentItem = useCallback(({ item }: { item: Student }) => (
    <PTAStudentCard item={item} onPress={openPaymentModal} />
  ), [openPaymentModal]);


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
            <TouchableOpacity onPress={() => router.back()} style={styles.headerIconBtn}>
              <SVGIcon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.titleCenter}>
              <Text style={styles.headerTitle}>PTA Dues</Text>
              <Text style={styles.headerSub}>ASSOCIATION BILLING</Text>
            </View>
            <TouchableOpacity onPress={() => setClassModalVisible(true)} style={styles.headerIconBtn}>
              <SVGIcon name="funnel-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.selectorGrid}>
            <TouchableOpacity style={styles.glassPill} onPress={() => setClassModalVisible(true)}>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[THEME.primary]} />}
        ListHeaderComponent={
          <>
            <View style={[styles.statsDashboard, { paddingHorizontal: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 }]}>
               <LinearGradient colors={[THEME.primary, THEME.secondary]} style={[styles.statBox, { width: (width - 52)/2 }]}>
                  <Text style={styles.statLabel}>TERM BILLED</Text>
                  <Text style={styles.statValue}>₵{stats.totalBilled.toLocaleString()}</Text>
                  <SVGIcon name="receipt" size={24} color="rgba(255,255,255,0.3)" style={styles.statIcon} />
               </LinearGradient>
               <LinearGradient colors={[VIBE.success, "#059669"]} style={[styles.statBox, { width: (width - 52)/2 }]}>
                  <Text style={styles.statLabel}>TERM COLLECTED</Text>
                  <Text style={styles.statValue}>₵{stats.totalCollected.toLocaleString()}</Text>
                  <SVGIcon name="cash" size={24} color="rgba(255,255,255,0.3)" style={styles.statIcon} />
               </LinearGradient>
            </View>

            <View style={{ paddingHorizontal: 20, marginBottom: 25 }}>
              <Text style={styles.listTitle}>APPLY PTA DUE (CLASS BULK)</Text>
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
                   }}
                   disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <SVGIcon name="add-circle-outline" size={20} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 }}>APPLY BULK PTA DUE</Text>
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
        }
        ListEmptyComponent={
          loading ? <ActivityIndicator size="large" color={THEME.primary} style={{ marginTop: 50 }} /> : (
            <View style={styles.emptyWrap}>
              <SVGIcon name="people-outline" size={64} color="#CBD5E1" />
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

      <Modal visible={paymentModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
          <View style={styles.sheetBody}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>{selectedStudent?.fullName}</Text>
                <Text style={{ fontSize: 10, fontWeight: '800', color: VIBE.muted }}>PTA PAYMENT</Text>
              </View>
              <TouchableOpacity onPress={() => setPaymentModalVisible(false)} style={styles.closeRound}>
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
                    style={[styles.methodBtn, paymentMethod === m && { backgroundColor: THEME.primary, borderColor: THEME.primary }]}
                    onPress={() => setPaymentMethod(m as any)}
                  >
                    <Text style={[styles.methodText, paymentMethod === m && { color: "#fff" }]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity onPress={handleConfirmPayment} disabled={saving}>
                <LinearGradient colors={[THEME.primary, THEME.secondary]} style={styles.saveBtn}>
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
                      onPress={() => {
                        setPaymentModalVisible(false);
                        router.push({
                          pathname: "/shared/receipt-view",
                          params: {
                            type: h.type === 'pta' ? 'bill' : 'payment',
                            studentId: selectedStudent?.uid,
                            paymentId: h.receiptNo,
                            year: h.academicYear,
                            term: h.term
                          }
                        });
                      }}
                      onLongPress={() => confirmDeletePayment(h)}
                    >
                      <View style={styles.tileHeader}>
                        <Text style={[styles.tileAmt, { color: h.type === 'pta' ? VIBE.info : VIBE.success }]}>
                          ₵{h.amount.toLocaleString()}
                        </Text>
                        <View style={{ backgroundColor: h.type === 'pta' ? VIBE.info + '15' : VIBE.success + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                           <Text style={{ fontSize: 9, fontWeight: '900', color: h.type === 'pta' ? VIBE.info : VIBE.success }}>
                             {h.type === 'pta' ? 'BILL' : 'PAYMENT'}
                           </Text>
                        </View>
                      </View>
                      <Text style={styles.tileDetail}>{h.method}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            confirmDeletePayment(h);
                          }}
                          style={{ padding: 4 }}
                        >
                          <SVGIcon name="trash" size={16} color={VIBE.danger} />
                        </TouchableOpacity>
                        <SVGIcon name="eye-outline" size={14} color={VIBE.muted} />
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
