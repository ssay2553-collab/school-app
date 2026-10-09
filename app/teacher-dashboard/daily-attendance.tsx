import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Platform,
  useWindowDimensions,
} from "react-native";
import { COLORS, SHADOWS } from "../../constants/theme";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { useAuth } from "../../contexts/AuthContext";
import * as Animatable from "react-native-animatable";
import { useRouter, useLocalSearchParams } from "expo-router";
import moment from "moment";
import SVGIcon from "../../components/SVGIcon";
const DateTimePicker = Platform.OS !== 'web' ? require('@react-native-community/datetimepicker').default : null;
import { AppUser } from "../../types/users";
import { useDailyAttendance } from "../../hooks/teacher-dashboard/useDailyAttendance";
import { useRef } from "react";

const CONTENT_MAX_WIDTH = 1200;

const ArrivalModeModal = ({
  visible,
  student,
  currentMode,
  currentBroughtBy,
  onClose,
  onSave
}: {
  visible: boolean;
  student: AppUser | null;
  currentMode?: string;
  currentBroughtBy?: string;
  onClose: () => void;
  onSave: (mode: string, broughtBy: string) => void;
}) => {
  const [mode, setMode] = useState(currentMode || "school_bus");
  const [broughtBy, setBroughtBy] = useState(currentBroughtBy || "");

  useEffect(() => {
    if (visible) {
      setMode(currentMode || "school_bus");
      setBroughtBy(currentBroughtBy || "");
    }
  }, [visible, currentMode, currentBroughtBy]);

  if (!visible || !student) return null;

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Arrival & Transport Details</Text>
          <TouchableOpacity onPress={onClose}>
            <SVGIcon name="close" size={22} color="#64748B" />
          </TouchableOpacity>
        </View>
        <Text style={styles.modalSub}>
          How did {student.profile?.firstName} arrive at school today?
        </Text>

        <View style={styles.modeGrid}>
          {[
            { id: "school_bus", label: "School Bus", icon: "bus" },
            { id: "parent", label: "Parent / Guardian", icon: "people" },
            { id: "walk", label: "Walking", icon: "walk" },
            { id: "public_transit", label: "Public Transit", icon: "car" },
            { id: "other", label: "Other", icon: "ellipsis-horizontal" },
          ].map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[styles.modeCard, mode === m.id && styles.modeCardActive]}
              onPress={() => setMode(m.id)}
            >
              <SVGIcon name={m.icon as any} size={20} color={mode === m.id ? "#fff" : COLORS.primary} />
              <Text style={[styles.modeCardText, mode === m.id && styles.modeCardTextActive]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.inputLabel}>Brought By / Driver / Details (Optional)</Text>
        <TextInput
          style={styles.textInput}
          placeholder="e.g. Father, Mother, Driver Uncle John"
          placeholderTextColor="#94A3B8"
          value={broughtBy}
          onChangeText={setBroughtBy}
        />

        <View style={styles.modalActions}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.saveModalBtn}
            onPress={() => {
              onSave(mode, broughtBy);
              onClose();
            }}
          >
            <Text style={styles.saveModalBtnText}>Save Details</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const AttendanceStudentCard = React.memo(({
  item,
  index,
  statusData,
  isUnsaved,
  isOfficialClassTeacher,
  markLocal,
  onOpenArrivalModal
}: {
  item: AppUser,
  index: number,
  statusData: { status?: string; arrivalMode?: string; broughtBy?: string },
  isUnsaved: boolean,
  isOfficialClassTeacher: boolean,
  markLocal: (id: string, status: "present" | "absent" | "late") => void,
  onOpenArrivalModal: (student: AppUser) => void
}) => {
  const status = statusData.status || "not_marked";
  const arrivalMode = statusData.arrivalMode;
  const broughtBy = statusData.broughtBy;
  const cardStatusStyle = status === "present" ? styles.presentCard : status === "absent" ? styles.absentCard : status === "late" ? styles.lateCard : {};

  return (
    <Animatable.View
      animation="fadeInUp"
      delay={Math.min(index * 30, 300)}
      duration={400}
      useNativeDriver
      style={[styles.card, cardStatusStyle, isUnsaved && styles.unsavedCard]}
    >
      <View style={styles.cardInfo}>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>
            {item.profile?.firstName?.[0] || ""}{item.profile?.lastName?.[0] || ""}
          </Text>
        </View>
        <View style={{ flex: 1, marginLeft: 15 }}>
          <Text style={styles.name} numberOfLines={1}>{item.profile?.firstName || "Student"} {item.profile?.lastName || ""}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            <View style={styles.statusBadge}>
               <View style={[styles.statusDot, { backgroundColor: status === "present" ? "#10B981" : status === "absent" ? "#EF4444" : status === "late" ? "#F59E0B" : "#94A3B8" }]} />
               <Text style={styles.statusLabel}>{status.toUpperCase()}</Text>
               {isUnsaved && <Text style={styles.unsavedTag}> • Unsaved</Text>}
            </View>

            <TouchableOpacity
              style={styles.transportTag}
              onPress={() => onOpenArrivalModal(item)}
              activeOpacity={0.7}
            >
              <SVGIcon name={arrivalMode === 'school_bus' ? 'bus' : arrivalMode === 'parent' ? 'people' : 'car'} size={12} color={COLORS.primary} />
              <Text style={styles.transportTagText}>
                {arrivalMode === 'school_bus' ? 'Bus' : arrivalMode === 'parent' ? 'Parent' : arrivalMode === 'walk' ? 'Walk' : arrivalMode === 'public_transit' ? 'Public' : arrivalMode === 'other' ? 'Other' : 'Set Transport'}
                {broughtBy ? ` (${broughtBy})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {isOfficialClassTeacher && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, status === "present" && styles.presentActive]}
            onPress={() => markLocal(item.uid, "present")}
            activeOpacity={0.6}
          >
            <SVGIcon name="checkmark-circle" size={18} color={status === 'present' ? '#fff' : '#10B981'} />
            <Text style={[styles.actionBtnText, status === "present" && {color: "#fff"}]}>Present</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, status === "late" && styles.lateActive]}
            onPress={() => markLocal(item.uid, "late")}
            activeOpacity={0.6}
          >
            <SVGIcon name="time" size={18} color={status === 'late' ? '#fff' : '#F59E0B'} />
            <Text style={[styles.actionBtnText, status === "late" && {color: "#fff"}]}>Late</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, status === "absent" && styles.absentActive]}
            onPress={() => markLocal(item.uid, "absent")}
            activeOpacity={0.6}
          >
            <SVGIcon name="close-circle" size={18} color={status === 'absent' ? '#fff' : '#EF4444'} />
            <Text style={[styles.actionBtnText, status === "absent" && {color: "#fff"}]}>Absent</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animatable.View>
  );
});

export default function DailyAttendanceScreen() {
  const { width } = useWindowDimensions();

  const webInputStyle = Platform.OS === 'web' ? {
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #E2E8F0',
    fontSize: '16px',
    width: '100%',
    marginBottom: '10px'
  } : {};

  const isLargeScreen = width > 768;
  const isExtraLargeScreen = width > 1100;
  const numColumns = isExtraLargeScreen ? 3 : isLargeScreen ? 2 : 1;

  const { appUser } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{
    classId?: string;
    date?: string;
    fromAdmin?: string;
    className?: string;
    academicYear?: string;
    term?: string;
  }>();

  const {
    students,
    loading,
    saving,
    classId,
    setClassId,
    selectedDate,
    setSelectedDate,
    availableClasses,
    localAttendance,
    serverAttendance,
    hasUnsavedChanges,
    isOfficialClassTeacher,
    academicYear,
    term,
    markLocal,
    updateArrivalDetails,
    saveToFirestore,
  } = useDailyAttendance(params.classId || null, params.date || moment().format("YYYY-MM-DD"));

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [arrivalModalVisible, setArrivalModalVisible] = useState(false);
  const [activeStudentForArrival, setActiveStudentForArrival] = useState<AppUser | null>(null);

  const isMounted = useRef(true);
  const isNavigating = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const handleBack = useCallback(() => {
    if (isNavigating.current) return;
    isNavigating.current = true;
    const isAdmin = appUser?.role?.toLowerCase() === "admin" ||
                    appUser?.role?.toLowerCase() === "superadmin" ||
                    !!(appUser as any)?.adminRole;

    if (params.fromAdmin === "true") {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace({
          pathname: "/admin-dashboard/attendance-details",
          params: {
            classId: params.classId,
            className: params.className,
            date: params.date,
            academicYear: params.academicYear,
            term: params.term
          }
        });
      }
      return;
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      if (isAdmin) {
        router.replace("/admin-dashboard/attendance-overview");
      } else {
        router.replace("/teacher-dashboard");
      }
    }
  }, [router, params, appUser]);

  useEffect(() => {
    const onBackPress = () => {
      if (hasUnsavedChanges) {
        Alert.alert(
          "Unsaved Changes",
          "You have unsaved attendance data. Are you sure you want to leave?",
          [
            { text: "Stay", style: "cancel" },
            {
              text: "Leave",
              style: "destructive",
              onPress: handleBack
            }
          ]
        );
        return true;
      }
      handleBack();
      return true;
    };

    const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => subscription.remove();
  }, [hasUnsavedChanges, handleBack]);

  const changeDate = (days: number) => {
    if (isNavigating.current) return;
    isNavigating.current = true;
    const newDate = moment(selectedDate).add(days, 'days').format("YYYY-MM-DD");
    setSelectedDate(newDate);
    setTimeout(() => { isNavigating.current = false; }, 500);
  };

  const isToday = useMemo(() => moment(selectedDate).isSame(moment(), 'day'), [selectedDate]);

  const renderStudentItem = useCallback(({ item, index }: { item: AppUser, index: number }) => {
    const studentRecord = localAttendance[item.uid] || {};
    const studentStatus = studentRecord.status ?? "not_marked";
    const studentIsUnsaved = studentStatus !== (serverAttendance[item.uid]?.status ?? "not_marked") ||
                             studentRecord.arrivalMode !== (serverAttendance[item.uid]?.arrivalMode ?? undefined) ||
                             studentRecord.broughtBy !== (serverAttendance[item.uid]?.broughtBy ?? undefined);

    return (
      <AttendanceStudentCard
        item={item}
        index={index}
        statusData={studentRecord}
        isUnsaved={studentIsUnsaved}
        isOfficialClassTeacher={isOfficialClassTeacher}
        markLocal={markLocal}
        onOpenArrivalModal={(student) => {
          setActiveStudentForArrival(student);
          setArrivalModalVisible(true);
        }}
      />
    );
  }, [localAttendance, serverAttendance, isOfficialClassTeacher, markLocal]);

  if (loading && students.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ marginTop: 10, color: '#64748B' }}>Loading Class List...</Text>
      </View>
    );
  }

  const renderHeader = () => (
    <View style={styles.mainContent}>
      <View style={styles.dateBar}>
        <TouchableOpacity onPress={() => changeDate(-1)} style={styles.dateNavBtn}>
          <SVGIcon name="chevron-back" size={20} color="#64748B" />
        </TouchableOpacity>

        {Platform.OS === 'web' ? (
          <View style={styles.dateDisplay}>
            <SVGIcon name="calendar-outline" size={18} color={COLORS.primary} />
            <input
              type="date"
              value={selectedDate}
              max={moment().format("YYYY-MM-DD")}
              onChange={(e) => {
                if (isNavigating.current) return;
                isNavigating.current = true;
                setSelectedDate(e.target.value);
                setTimeout(() => { isNavigating.current = false; }, 500);
              }}
              style={{
                border: 'none',
                background: 'none',
                fontSize: '14px',
                color: '#1E293B',
                fontWeight: '800',
                fontFamily: 'inherit',
                outline: 'none',
                cursor: 'pointer'
              }}
            />
          </View>
        ) : (
          <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateDisplay}>
            <SVGIcon name="calendar-outline" size={18} color={COLORS.primary} />
            <Text style={styles.dateText}>{moment(selectedDate).format("dddd, MMMM D, YYYY")}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={() => changeDate(1)}
          style={[styles.dateNavBtn, isToday && { opacity: 0.3 }]}
          disabled={isToday}
        >
          <SVGIcon name="chevron-forward" size={20} color="#64748B" />
        </TouchableOpacity>
      </View>

      <View style={styles.filterArea}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.classScroll}>
          {availableClasses.map(c => (
            <TouchableOpacity
              key={c.id}
              style={[styles.classChip, classId === c.id && styles.classChipActive]}
              onPress={() => {
                if (isNavigating.current) return;
                isNavigating.current = true;
                setClassId(c.id);
                setTimeout(() => { isNavigating.current = false; }, 500);
              }}
            >
              <Text style={[styles.classChipText, classId === c.id && styles.classChipTextActive]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Daily Attendance</Text>
            <Text style={styles.subtitle}>
              {availableClasses.find(c => c.id === classId)?.name || "Select Class"} • {academicYear} ({term})
            </Text>
          </View>
        </View>
      </View>

      <FlatList
        data={students}
        keyExtractor={item => item.uid}
        renderItem={renderStudentItem}
        contentContainerStyle={styles.list}
        numColumns={numColumns}
        key={numColumns}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No students found in this class.</Text>
          </View>
        }
      />

      {isOfficialClassTeacher && (
        <View style={styles.footerAction}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
            onPress={saveToFirestore}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <SVGIcon name="save" size={20} color="#fff" />
                <Text style={styles.saveBtnText}>Save Attendance & Transport</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      <ArrivalModeModal
        visible={arrivalModalVisible}
        student={activeStudentForArrival}
        currentMode={activeStudentForArrival ? localAttendance[activeStudentForArrival.uid]?.arrivalMode : undefined}
        currentBroughtBy={activeStudentForArrival ? localAttendance[activeStudentForArrival.uid]?.broughtBy : undefined}
        onClose={() => {
          setArrivalModalVisible(false);
          setActiveStudentForArrival(null);
        }}
        onSave={(mode, broughtBy) => {
          if (activeStudentForArrival) {
            updateArrivalDetails(activeStudentForArrival.uid, mode, broughtBy);
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 300 },
  header: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', zIndex: 10 },
  headerInner: { flexDirection: 'row', alignItems: 'center', padding: 20, maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center', width: '100%' },
  mainContent: { width: '100%', maxWidth: CONTENT_MAX_WIDTH },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  backBtnText: { color: '#1E293B', fontWeight: '800', fontSize: 14 },
  title: { fontSize: 20, fontWeight: '900', color: '#1E293B' },
  subtitle: { fontSize: 12, color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  dateBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, backgroundColor: '#fff', margin: 15, borderRadius: 18, ...SHADOWS.small, maxWidth: 600, alignSelf: 'center', width: '92%' },
  dateNavBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  dateDisplay: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateText: { fontSize: 14, fontWeight: '800', color: '#1E293B' },
  filterArea: { paddingBottom: 15, width: '100%' },
  classScroll: { paddingHorizontal: 20, gap: 12 },
  classChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 15, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  classChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  classChipText: { fontSize: 13, fontWeight: '800', color: '#64748B' },
  classChipTextActive: { color: '#fff' },
  list: { padding: 20, paddingBottom: 120 },
  card: { backgroundColor: '#fff', borderRadius: 22, padding: 16, marginBottom: 15, ...SHADOWS.small, borderWidth: 1, borderColor: '#F1F5F9', flex: 1, minWidth: 300 },
  presentCard: { borderColor: '#10B981', backgroundColor: '#F0FDF4' },
  absentCard: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  lateCard: { borderColor: '#F59E0B', backgroundColor: '#FFFBEB' },
  unsavedCard: { borderStyle: 'dashed', borderWidth: 2 },
  cardInfo: { flexDirection: 'row', alignItems: 'center' },
  avatarPlaceholder: { width: 50, height: 50, borderRadius: 18, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 16, fontWeight: '900', color: COLORS.primary },
  name: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusLabel: { fontSize: 10, fontWeight: '900', color: '#64748B', letterSpacing: 0.5 },
  unsavedTag: { fontSize: 10, fontWeight: '900', color: COLORS.primary },
  transportTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  transportTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primary,
  },
  actions: { flexDirection: 'row', marginTop: 15, gap: 10 },
  actionBtn: { flex: 1, height: 48, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#F8FAFC' },
  actionBtnText: { fontSize: 12, fontWeight: '800' },
  presentActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
  absentActive: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
  lateActive: { backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
  footerAction: { position: 'absolute', bottom: 25, left: 20, right: 20, ...SHADOWS.large, alignItems: 'center' },
  saveBtn: { backgroundColor: COLORS.primary, height: 65, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, width: '100%', maxWidth: 400 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#94A3B8', fontWeight: '600' },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 450,
    ...SHADOWS.large,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1E293B',
  },
  modalSub: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 20,
    fontWeight: '600',
  },
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  modeCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  modeCardActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  modeCardText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B',
  },
  modeCardTextActive: {
    color: '#fff',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 15,
    height: 50,
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#475569',
  },
  saveModalBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveModalBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#fff',
  },
});
