import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  collection,
  getDocsFromServer,
  query,
  where,
} from "firebase/firestore";
import moment from "moment";
import React, { useCallback, useState, useMemo } from "react";
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
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SVGIcon from "../../components/SVGIcon";
import { COLORS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { db } from "../../firebaseConfig";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";
import { useUniformCharges, Student } from "../../hooks/admin-dashboard/useUniformCharges";

import { ClassSelectorModal } from "../../components/admin-dashboard/ClassSelectorModal";
import { styles as sharedStyles, VIBE as sharedVibe } from "../../constants/admin-dashboard/ManageFeesStyles";

const VIBE = {
  ...sharedVibe,
  primary: "#10B981", // Uniforms Color
  secondary: "#059669",
};

const UNIFORM_TYPES = [
  { id: "main", label: "Main Uniform", icon: "shirt" },
  { id: "lacoste", label: "Lacoste/T-Shirt", icon: "ribbon" },
  { id: "friday", label: "Friday Wear", icon: "color-palette" },
  { id: "pe", label: "PE Kit", icon: "fitness" },
  { id: "other", label: "Other", icon: "ellipsis-horizontal" },
];

export default function UniformCharges() {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const acadConfig = useAcademicConfig();

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
    handleDeletePayment,
    fetchStudents,
  } = useUniformCharges({
    appUser,
    acadConfig,
    showToast,
    selectedClassId,
    searchQuery,
  });

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedType, setSelectedType] = useState("main");
  const [amount, setAmount] = useState("");
  const [receivedFrom, setReceivedFrom] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingPurchases, setLoadingPurchases] = useState(false);

  const fetchPurchases = async (typeId: string) => {
    setLoadingPurchases(true);
    setPurchases([]);
    try {
      if (!acadConfig.academicYear || !acadConfig.currentTerm) return;
      const q = query(
        collection(db, "feePayments"),
        where("type", "==", "uniform"),
        where("subType", "==", typeId),
        where("academicYear", "==", acadConfig.academicYear),
        where("term", "==", acadConfig.currentTerm)
      );
      const snap = await getDocsFromServer(q);
      const list = snap.docs.map(d => ({ id: d.id, createdAt: d.data().createdAt, ...d.data() }));
      setPurchases(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (e) {
      console.error("Error fetching purchases:", e);
    } finally {
      setLoadingPurchases(false);
    }
  };

  const fetchPaymentHistory = async (studentUid: string) => {
    setLoadingHistory(true);
    try {
      const q = query(
        collection(db, "feePayments"),
        where("studentUid", "==", studentUid),
        where("type", "==", "uniform")
      );
      const snap = await getDocsFromServer(q);
      const list = snap.docs.map(d => d.data());
      setHistory(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const onLogPayment = async () => {
    const val = parseFloat(amount);
    if (!selectedStudent) return;
    const typeLabel = UNIFORM_TYPES.find(t => t.id === selectedType)?.label || "Uniform";
    const success = await handleLogPayment(selectedStudent, val, receivedFrom, selectedType, typeLabel);
    if (success) {
      setPaymentModalVisible(false);
      setAmount("");
      setReceivedFrom("");
    }
  };

  const onDeletePress = (payment: any) => {
    if (!selectedStudent) return;
    const msg = "Are you sure you want to delete this transaction? This will automatically adjust the student's records.";

    if (Platform.OS === "web") {
      if (window.confirm(`Confirm Deletion\n\n${msg}`)) {
        handleDeletePayment(selectedStudent, payment).then(success => {
          if (success) setPaymentModalVisible(false);
        });
      }
    } else {
      Alert.alert("Confirm Deletion", msg, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: async () => {
          const success = await handleDeletePayment(selectedStudent, payment);
          if (success) {
            setPaymentModalVisible(false);
          }
        }},
      ]);
    }
  };

  const filteredStudents = useMemo(() => {
    if (!students) return [];
    const lower = searchQuery.toLowerCase();
    return students.filter(s => s && s.fullName && s.fullName.toLowerCase().includes(lower));
  }, [students, searchQuery]);

  const renderItem = useCallback(({ item }: { item: any }) => {
    if (activeFilter) {
      return (
        <TouchableOpacity
          style={sharedStyles.financeCard}
          onPress={() => {
            router.push({
              pathname: "/shared/receipt-view",
              params: {
                type: 'payment',
                studentId: item.studentUid,
                paymentId: item.receiptNo,
                year: item.academicYear,
                term: item.term
              }
            });
          }}
        >
          <View style={sharedStyles.cardContent}>
            <View style={sharedStyles.leftSection}>
              <View style={[sharedStyles.avatar, { backgroundColor: VIBE.primary + '15' }]}>
                <Text style={[sharedStyles.avatarText, { color: VIBE.primary }]}>{item.studentName?.charAt(0)}</Text>
              </View>
              <View style={sharedStyles.mainInfo}>
                <Text style={sharedStyles.studentName}>{item.studentName}</Text>
                <Text style={sharedStyles.debtLabel}>{item.className} • {moment(item.createdAt).format("MMM DD, HH:mm")}</Text>
                <Text style={sharedStyles.dailyReceipt}>{item.receiptNo}</Text>
              </View>
            </View>
            <View style={sharedStyles.rightSection}>
              <Text style={sharedStyles.dailyAmount}>₵{item.amount.toLocaleString()}</Text>
              <SVGIcon name="eye-outline" size={14} color={VIBE.muted} style={{ marginTop: 4 }} />
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    const isolatedTotal = (item.ptaBalance || 0) + (item.admissionBalance || 0) +
                          (item.maintenanceBalance || 0) + (item.booksBalance || 0) +
                          (item.uniformBalance || 0) + (item.otherBalance || 0);
    const tuitionBalance = Math.max(0, (item.walletBalance || 0) - (isolatedTotal - (item.uniformBalance || 0)));

    return (
      <TouchableOpacity
        style={sharedStyles.financeCard}
        onPress={() => {
          setSelectedStudent(item);
          setPaymentModalVisible(true);
          fetchPaymentHistory(item.uid);
        }}
      >
        <View style={sharedStyles.cardContent}>
          <View style={sharedStyles.leftSection}>
            <View style={[sharedStyles.avatar, { backgroundColor: VIBE.primary + '15' }]}>
              <Text style={[sharedStyles.avatarText, { color: VIBE.primary }]}>{item.fullName.charAt(0)}</Text>
            </View>
            <View style={sharedStyles.mainInfo}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={sharedStyles.studentName}>{item.fullName}</Text>
                <View style={[sharedStyles.filterChip, { backgroundColor: tuitionBalance > 0 ? VIBE.danger + '10' : VIBE.success + '10', borderColor: 'transparent' }]}>
                  <Text style={[sharedStyles.filterChipText, { color: tuitionBalance > 0 ? VIBE.danger : VIBE.success }]}>
                    Tuition: ₵{tuitionBalance.toFixed(0)}
                  </Text>
                </View>
              </View>
              <Text style={sharedStyles.debtLabel}>{item.className}</Text>
              <View style={sharedStyles.tuitionBreakdown}>
                <View style={sharedStyles.breakdownItem}>
                  <Text style={sharedStyles.breakdownLabel}>TOTAL UNIFORM</Text>
                  <Text style={[sharedStyles.breakdownValue, { color: VIBE.info }]}>₵{(item.uniformPaid || 0).toFixed(0)}</Text>
                </View>
              </View>
            </View>
          </View>
          <View style={{ marginLeft: 10 }}>
            <SVGIcon name="cart-outline" size={24} color={VIBE.primary} />
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [activeFilter, router]);

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <StatusBar barStyle="dark-content" />
      <View style={sharedStyles.header}>
        <LinearGradient
          colors={[VIBE.primary, VIBE.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={sharedStyles.headerTop}
        >
          <View style={sharedStyles.navBar}>
            <TouchableOpacity onPress={() => router.push("/admin-dashboard/StudentCharges")} style={sharedStyles.headerIconBtn}>
              <SVGIcon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={sharedStyles.titleCenter}>
              <Text style={sharedStyles.headerTitle}>Uniforms</Text>
              <Text style={sharedStyles.headerSub}>WEAR & GEAR</Text>
            </View>
            <TouchableOpacity onPress={() => setClassModalVisible(true)} style={sharedStyles.headerIconBtn}>
              <SVGIcon name="funnel-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={sharedStyles.glassPill}
            onPress={() => setClassModalVisible(true)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <SVGIcon name="layers-outline" size={14} color="rgba(255,255,255,0.8)" style={{ marginRight: 6 }} />
              <Text style={sharedStyles.glassLabel}>FILTER BY CLASS</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={sharedStyles.glassValue}>
                {selectedClassId === "all" ? "All Classes" : classes.find(c => c.id === selectedClassId)?.name || "Select Class"}
              </Text>
              <SVGIcon name="chevron-down" size={18} color="rgba(255,255,255,0.6)" />
            </View>
          </TouchableOpacity>
        </LinearGradient>

        <View style={sharedStyles.searchStrip}>
          <View style={sharedStyles.searchBar}>
            <SVGIcon name="search" size={18} color={VIBE.muted} />
            <TextInput
              placeholder="Search students..."
              style={sharedStyles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={VIBE.muted}
            />
          </View>
          <TouchableOpacity onPress={handleRefresh} style={sharedStyles.refreshRound}>
            <SVGIcon name="refresh" size={18} color={VIBE.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={sharedStyles.statsDashboard}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={[sharedStyles.statBox, { backgroundColor: VIBE.primary, flex: 1.5, width: 'auto' }]}>
            <Text style={sharedStyles.statLabel}>Term Total</Text>
            <Text style={sharedStyles.statValue}>₵{stats.totalCollected.toLocaleString()}</Text>
          </View>
          <View style={[sharedStyles.statBox, { backgroundColor: VIBE.info, flex: 1, width: 'auto' }]}>
            <Text style={sharedStyles.statLabel}>Trans.</Text>
            <Text style={sharedStyles.statValue}>{stats.count}</Text>
          </View>
        </View>
      </View>

      <View style={sharedStyles.breakdownContainer}>
        <Text style={sharedStyles.sectionLabel}>Revenue Breakdown</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sharedStyles.breakdownScroll}>
          {UNIFORM_TYPES.map(type => (
            <TouchableOpacity
              key={type.id}
              style={[sharedStyles.breakdownCard, activeFilter === type.id && sharedStyles.activeBreakdownCard]}
              onPress={() => {
                if (activeFilter === type.id) {
                  setActiveFilter(null);
                  setPurchases([]);
                } else {
                  setActiveFilter(type.id);
                  setSearchQuery("");
                  fetchPurchases(type.id);
                }
              }}
            >
              <View style={[sharedStyles.typeIconWrap, { backgroundColor: activeFilter === type.id ? "#fff" : VIBE.primary + "10" }]}>
                <SVGIcon name={type.icon} size={16} color={activeFilter === type.id ? VIBE.primary : VIBE.primary} />
              </View>
              <View>
                <Text style={[sharedStyles.breakdownLabel, activeFilter === type.id && sharedStyles.activeBreakdownLabel]}>{type.label}</Text>
                <Text style={[sharedStyles.breakdownValue, activeFilter === type.id && sharedStyles.activeBreakdownValue]}>₵{(stats.breakdown?.[type.id] || 0).toLocaleString()}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {activeFilter && (
        <View style={sharedStyles.filterInfoBar}>
          <Text style={sharedStyles.filterInfoText}>Showing {UNIFORM_TYPES.find(t => t.id === activeFilter)?.label} purchases</Text>
          <TouchableOpacity onPress={() => setActiveFilter(null)}>
            <SVGIcon name="close-circle" size={20} color={VIBE.muted} />
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={activeFilter ? purchases : filteredStudents}
        keyExtractor={item => item.uid || item.id}
        renderItem={renderItem}
        contentContainerStyle={sharedStyles.flatListContent}
        onEndReached={() => !activeFilter && fetchStudents()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[VIBE.primary]} />}
        removeClippedSubviews={Platform.OS === "android"}
        ListEmptyComponent={
          (loading || loadingPurchases) ? (
            <ActivityIndicator size="large" color={VIBE.primary} style={{ marginTop: 50 }} />
          ) : (searchQuery.length < 2 && !activeFilter && selectedClassId === "all") ? (
            <View style={sharedStyles.emptyWrap}>
              <SVGIcon name="search" size={64} color="#CBD5E1" />
              <Text style={sharedStyles.emptyText}>Search students to begin</Text>
            </View>
          ) : (
            <View style={sharedStyles.emptyWrap}>
              <SVGIcon name={activeFilter ? "receipt" : selectedClassId !== "all" ? "person" : "shirt"} size={64} color="#CBD5E1" />
              <Text style={sharedStyles.emptyText}>
                {activeFilter
                  ? "No purchases found for this category"
                  : selectedClassId !== "all"
                    ? "No students with uniform records in this class"
                    : "No students found"}
              </Text>
            </View>
          )
        }
      />

      <Modal visible={paymentModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={sharedStyles.overlay}>
          <View style={sharedStyles.sheetBody}>
            <View style={sharedStyles.sheetHandle} />
            <View style={sharedStyles.sheetHeader}>
              <View>
                <Text style={sharedStyles.sheetTitle}>{selectedStudent?.fullName}</Text>
                <Text style={sharedStyles.glassLabel}>UNIFORM PURCHASE</Text>
              </View>
              <TouchableOpacity onPress={() => setPaymentModalVisible(false)} style={sharedStyles.closeRound}>
                <SVGIcon name="close" size={24} color={VIBE.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={sharedStyles.glassLabel}>Select Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 25 }} contentContainerStyle={{ gap: 10 }}>
                {UNIFORM_TYPES.map(t => (
                  <TouchableOpacity
                    key={t.id}
                    style={[sharedStyles.methodBtn, selectedType === t.id && { backgroundColor: VIBE.primary, borderColor: VIBE.primary }, { flexDirection: 'row', gap: 8, paddingHorizontal: 15 }]}
                    onPress={() => setSelectedType(t.id)}
                  >
                    <SVGIcon name={t.icon} size={20} color={selectedType === t.id ? "#fff" : VIBE.muted} />
                    <Text style={[sharedStyles.methodText, selectedType === t.id && { color: "#fff" }]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: 15, marginBottom: 25 }}>
                <View style={{ flex: 1 }}>
                  <Text style={sharedStyles.glassLabel}>Price (₵)</Text>
                  <TextInput
                    style={sharedStyles.pillInput}
                    placeholder="0.00"
                    keyboardType="numeric"
                    value={amount}
                    onChangeText={setAmount}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={sharedStyles.glassLabel}>Payer Name</Text>
                  <TextInput
                    style={[sharedStyles.pillInput, { fontSize: 16 }]}
                    placeholder="Student/Parent"
                    value={receivedFrom}
                    onChangeText={setReceivedFrom}
                  />
                </View>
              </View>

              <TouchableOpacity style={[sharedStyles.saveBtn, { backgroundColor: VIBE.primary }]} onPress={onLogPayment} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={sharedStyles.saveBtnText}>RECORD PURCHASE</Text>}
              </TouchableOpacity>

              <View style={sharedStyles.historyBlock}>
                <Text style={sharedStyles.blockTitle}>Recent Uniform Purchases</Text>
                {loadingHistory ? (
                  <ActivityIndicator color={VIBE.primary} />
                ) : history.length > 0 ? (
                  history.map((h, i) => (
                    <TouchableOpacity
                      key={i}
                      style={sharedStyles.transactionTile}
                      onPress={() => {
                        setPaymentModalVisible(false);
                        router.push({
                          pathname: "/shared/receipt-view",
                          params: {
                            type: 'payment',
                            studentId: selectedStudent?.uid,
                            paymentId: h.receiptNo,
                            year: h.academicYear,
                            term: h.term
                          }
                        });
                      }}
                      onLongPress={() => onDeletePress(h)}
                    >
                      <View style={sharedStyles.tileHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={sharedStyles.tileAmt}>₵{h.amount.toFixed(2)}</Text>
                          <View style={[sharedStyles.filterChip, { backgroundColor: VIBE.primary + '15', borderColor: 'transparent' }]}>
                            <Text style={[sharedStyles.filterChipText, { color: VIBE.primary }]}>
                              {h.subTypeLabel || 'UNIFORM'}
                            </Text>
                          </View>
                        </View>
                        <Text style={sharedStyles.methodText}>{h.method}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <Text style={sharedStyles.tileDate}>{moment(h.createdAt).format("MMM DD, YYYY")}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text style={sharedStyles.dailyReceipt}>{h.receiptNo}</Text>
                          <SVGIcon name="eye-outline" size={14} color={VIBE.muted} />
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={sharedStyles.noHistory}>No previous uniform transactions</Text>
                )}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ClassSelectorModal
        visible={classModalVisible}
        onClose={() => setClassModalVisible(false)}
        classes={classes}
        selectedClassId={selectedClassId}
        onSelect={setSelectedClassId}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: sharedVibe.bg },
});
