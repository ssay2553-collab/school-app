import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  StyleSheet,
  Text,
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
import DateTimePicker from "@react-native-community/datetimepicker";
import { AppUser } from "../../types/users";
import { useDailyAttendance } from "../../hooks/teacher-dashboard/useDailyAttendance";

const CONTENT_MAX_WIDTH = 1200;

const AttendanceStudentCard = React.memo(({
  item,
  index,
  status,
  isUnsaved,
  isOfficialClassTeacher,
  markLocal
}: {
  item: AppUser,
  index: number,
  status: string,
  isUnsaved: boolean,
  isOfficialClassTeacher: boolean,
  markLocal: (id: string, status: "present" | "absent" | "late") => void
}) => {
  const cardStatusStyle = status === "present" ? styles.presentCard : status === "absent" ? styles.absentCard : status === "late" ? styles.lateCard : {};

  return (
    <Animatable.View
      animation="fadeInUp"
      delay={Math.min(index * 50, 500)}
      duration={400}
      style={[styles.card, cardStatusStyle, isUnsaved && styles.unsavedCard]}
    >
      <View style={styles.cardInfo}>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>
            {item.profile?.firstName?.[0] || ""}{item.profile?.lastName?.[0] || ""}
          </Text>
        </View>
        <View style={{ flex: 1, marginLeft: 15 }}>
          <Text style={styles.name}>{item.profile?.firstName || "Student"} {item.profile?.lastName || ""}</Text>
          <View style={styles.statusBadge}>
             <View style={[styles.statusDot, { backgroundColor: status === "present" ? "#10B981" : status === "absent" ? "#EF4444" : status === "late" ? "#F59E0B" : "#94A3B8" }]} />
             <Text style={styles.statusLabel}>{(status || "NOT_MARKED").toUpperCase()}</Text>
             {isUnsaved && <Text style={styles.unsavedTag}> • Unsaved</Text>}
          </View>
        </View>
      </View>

      {isOfficialClassTeacher && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, status === "present" && styles.presentActive]}
            onPress={() => markLocal(item.uid, "present")}
            activeOpacity={0.7}
          >
            <SVGIcon name="checkmark-circle" size={18} color={status === 'present' ? '#fff' : '#10B981'} />
            <Text style={[styles.actionBtnText, status === "present" && {color: "#fff"}]}>Present</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, status === "late" && styles.lateActive]}
            onPress={() => markLocal(item.uid, "late")}
            activeOpacity={0.7}
          >
            <SVGIcon name="time" size={18} color={status === 'late' ? '#fff' : '#F59E0B'} />
            <Text style={[styles.actionBtnText, status === "late" && {color: "#fff"}]}>Late</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, status === "absent" && styles.absentActive]}
            onPress={() => markLocal(item.uid, "absent")}
            activeOpacity={0.7}
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
    saveToFirestore,
  } = useDailyAttendance(params.classId || null, params.date || moment().format("YYYY-MM-DD"));

  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleBack = useCallback(() => {
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
    const newDate = moment(selectedDate).add(days, 'days').format("YYYY-MM-DD");
    setSelectedDate(newDate);
  };

  const renderStudentItem = useCallback(({ item, index }: { item: AppUser, index: number }) => {
    const status = localAttendance[item.uid]?.status ?? "not_marked";
    const isUnsaved = localAttendance[item.uid]?.status !== serverAttendance[item.uid]?.status;

    return (
      <AttendanceStudentCard
        item={item}
        index={index}
        status={status}
        isUnsaved={isUnsaved}
        isOfficialClassTeacher={isOfficialClassTeacher}
        markLocal={markLocal}
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
              onChange={(e) => setSelectedDate(e.target.value)}
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
          style={[styles.dateNavBtn, moment(selectedDate).isSame(moment(), 'day') && { opacity: 0.3 }]}
          disabled={moment(selectedDate).isSame(moment(), 'day')}
        >
          <SVGIcon name="chevron-forward" size={20} color="#64748B" />
        </TouchableOpacity>
      </View>

      {Platform.OS !== 'web' && showDatePicker && (
        <DateTimePicker
          value={moment(selectedDate).toDate()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={new Date()}
          onChange={(event: any, date?: Date) => {
            setShowDatePicker(false);
            if (date) {
              setSelectedDate(moment(date).format("YYYY-MM-DD"));
            }
          }}
        />
      )}

      <View style={styles.filterArea}>
        <ScrollView
          horizontal={!isLargeScreen}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.classScroll, isLargeScreen && styles.classScrollWrap]}
        >
          {availableClasses.map(c => (
            <TouchableOpacity key={c.id} onPress={() => setClassId(c.id)} style={[styles.classChip, classId === c.id && styles.classChipActive]}>
              <Text style={[styles.classChipText, classId === c.id && styles.classChipTextActive]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );

  const noClassesAssigned = availableClasses.length === 0 && !loading;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.7}>
            <SVGIcon name="arrow-back" size={24} color="#1E293B" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Daily Attendance</Text>
            <Text style={styles.subtitle}>
              {academicYear} • {term} {students.length > 0 ? `• ${students.length} Students` : ""}
            </Text>
          </View>
        </View>
      </View>

      {noClassesAssigned ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <View style={styles.mainContent}>
            <View style={styles.center}>
              <SVGIcon name="alert-circle-outline" size={64} color="#94A3B8" />
              <Text style={[styles.emptyText, { marginTop: 16, textAlign: 'center', paddingHorizontal: 40 }]}>
                No classes assigned to you for {SCHOOL_CONFIG.name}. Please contact your administrator to assign your classes.
              </Text>
              <TouchableOpacity
                style={[styles.backBtn, { marginTop: 20, width: 'auto', paddingHorizontal: 20 }]}
                onPress={handleBack}
              >
                <Text style={styles.backBtnText}>Go Back</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.list,
            { alignSelf: 'center', width: '100%', maxWidth: CONTENT_MAX_WIDTH }
          ]}
          key={numColumns}
          data={students}
          renderItem={renderStudentItem}
          keyExtractor={item => item.uid}
          numColumns={numColumns}
          columnWrapperStyle={numColumns > 1 ? { gap: 16 } : null}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No students found in this class.</Text>
            </View>
          }
          showsVerticalScrollIndicator={true}
          removeClippedSubviews={true}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      )}

      {hasUnsavedChanges && (
        <Animatable.View animation="slideInUp" duration={400} style={styles.footerAction}>
          <TouchableOpacity style={styles.saveBtn} onPress={saveToFirestore} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <SVGIcon name="cloud-upload" size={20} color="#fff" />
                <Text style={styles.saveBtnText}>Save Changes Now</Text>
              </>
            )}
          </TouchableOpacity>
        </Animatable.View>
      )}
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
  classScrollWrap: { flexWrap: 'wrap', flexDirection: 'row', justifyContent: 'center' },
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
  emptyText: { color: '#94A3B8', fontWeight: '600' }
});
