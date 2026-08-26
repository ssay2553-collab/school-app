import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useAcademicRecords, StudentScoreRecord, ReportType } from "../../hooks/teacher-dashboard/useAcademicRecords";
import { useRef } from "react";

const SelectionGroup = React.memo(({ label, items, selectedId, onSelect, getLabel = (item) => item, getId = (item) => item }: { label: string; items: any[]; selectedId: string; onSelect: (id: any) => void; getLabel?: (item: any) => string; getId?: (item: any) => string; }) => (
  <View style={styles.selectionWrapper}>
    <Text style={styles.label}>{label}</Text>
    <FlatList horizontal showsHorizontalScrollIndicator={false} data={items} keyExtractor={(item) => getId(item)} contentContainerStyle={styles.bubbleRow} renderItem={({ item }) => {
      const id = getId(item);
      const active = selectedId === id;
      return (
        <TouchableOpacity onPress={() => onSelect(id)} style={[styles.bubble, active && styles.bubbleActive]}>
          <Text style={[styles.bubbleText, active && styles.bubbleTextActive]}>{getLabel(item)}</Text>
        </TouchableOpacity>
      );
    }} />
  </View>
));

const StudentCard = React.memo(({ student, onUpdate, reportType, disabled }: { student: StudentScoreRecord; onUpdate: (id: string, field: keyof StudentScoreRecord, val: string) => void; reportType: ReportType; disabled?: boolean; }) => {
  const isEOT = reportType === "End of Term";
  return (
    <View style={[styles.studentCard, disabled && { opacity: 0.7 }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.studentName}>{student.fullName}</Text>
        <View style={styles.gradeBadge}><Text style={styles.gradeText}>{student.grade}</Text></View>
      </View>
      <View style={styles.scoresGrid}>
        {isEOT && (
          <View style={[styles.scoreInput, { flex: 1 }]}><Text style={styles.scoreLabel}>CLASS SCORE (50)</Text><TextInput value={student.classScore} onChangeText={(v) => onUpdate(student.studentId, "classScore", v)} keyboardType="numeric" placeholder="0.0" style={styles.input} editable={!disabled} /></View>
        )}
        <View style={[styles.scoreInput, { flex: 1 }]}><Text style={styles.scoreLabel}>{isEOT ? "EXAMS (100)" : "EXAM SCORE"}</Text><TextInput value={student.examsMark} onChangeText={(v) => onUpdate(student.studentId, "examsMark", v)} keyboardType="numeric" placeholder="0.0" style={styles.input} editable={!disabled} /></View>
        <View style={styles.totalBox}><Text style={styles.totalLabel}>FINAL</Text><Text style={styles.totalVal}>{student.finalScore}</Text></View>
      </View>
    </View>
  );
});

export default function StudentAcademicRecords() {
  const router = useRouter();
  const {
    loading,
    syncing,
    teacherClasses,
    selectedClassId,
    setSelectedClassId,
    selectedSubject,
    setSelectedSubject,
    reportType,
    setReportType,
    allStudents,
    updateStudentScore,
    saveRecord,
    hasUnsavedChanges,
    academicYear,
    term,
    subjects,
    recordStatus,
  } = useAcademicRecords();

  const isApproved = recordStatus === "approved";
  const isNavigating = useRef(false);

  const handleBack = useCallback(() => {
    if (isNavigating.current) return;
    isNavigating.current = true;
    if (router.canGoBack()) router.back();
    else router.replace("/teacher-dashboard");
  }, [router]);

  useEffect(() => {
    const onBackPress = () => {
      if (hasUnsavedChanges) {
        Alert.alert("Unsaved Changes", "Discard modifications?", [{ text: "Stay", style: "cancel" }, { text: "Discard", style: "destructive", onPress: handleBack }]);
        return true;
      }
      handleBack();
      return true;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [hasUnsavedChanges, handleBack]);

  const handleSave = async () => {
    if (isApproved) {
      Alert.alert("Locked", "This record has been approved by the Admin and cannot be edited.");
      return;
    }
    const success = await saveRecord();
    if (success) router.back();
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  const renderHeader = () => (
    <>
      <Animatable.View animation="fadeInDown" duration={500} style={styles.configCard}>
        <View style={styles.statusRow}>
          <Text style={styles.sectionLabel}>LEDGER CONFIGURATION</Text>
          {isApproved && (
            <View style={styles.approvedBadge}>
              <SVGIcon name="checkmark-circle" size={14} color="#059669" />
              <Text style={styles.approvedText}>APPROVED & LOCKED</Text>
            </View>
          )}
        </View>
        <View style={styles.lockedConfigRow}>
          <View style={styles.lockedConfigItem}><Text style={styles.miniLabel}>YEAR</Text><View style={styles.lockedBadge}><Text style={styles.lockedBadgeText}>{academicYear || "---"}</Text></View></View>
          <View style={styles.lockedConfigItem}><Text style={styles.miniLabel}>TERM</Text><View style={styles.lockedBadge}><Text style={styles.lockedBadgeText}>{term || "---"}</Text></View></View>
        </View>
        <SelectionGroup label="REPORT TYPE" items={["End of Term", "Mid-Term", "Mock Exams"]} selectedId={reportType} onSelect={setReportType} />
        <SelectionGroup label="CLASS" items={teacherClasses} selectedId={selectedClassId} onSelect={setSelectedClassId} getLabel={(item) => item.name} getId={(item) => item.id} />
        <SelectionGroup label="SUBJECT" items={subjects} selectedId={selectedSubject} onSelect={setSelectedSubject} />
      </Animatable.View>
      <View style={styles.listHeaderContainer}><View style={styles.listHeader}><Text style={styles.listTitle}>STUDENT PERFORMANCE LIST</Text><Text style={styles.listCount}>{allStudents.length} Students</Text></View></View>
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[COLORS.primary, "#1E293B"]} style={styles.headerGradient}>
        <View style={styles.headerTitleRow}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}><SVGIcon name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 15 }}>
            <Text style={styles.headerTitle}>Academic Ledger</Text>
            <Text style={styles.headerSubtitle}>{academicYear} • {term}</Text>
          </View>
        </View>
      </LinearGradient>

      {syncing ? (
        <View style={styles.syncBox}><ActivityIndicator color={COLORS.primary} /><Text style={styles.syncText}>Syncing Ledger Data...</Text></View>
      ) : (
        <FlatList
          data={allStudents}
          keyExtractor={(item) => item.studentId}
          renderItem={({ item }) => <StudentCard student={item} onUpdate={updateStudentScore} reportType={reportType} disabled={isApproved} />}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={<View style={styles.emptyState}><SVGIcon name="people-outline" size={48} color="#CBD5E1" /><Text style={styles.emptyStateText}>{!selectedSubject ? "Select subject" : "No students found"}</Text></View>}
          contentContainerStyle={styles.listContent}
          removeClippedSubviews={true}
          initialNumToRender={10}
        />
      )}

      <TouchableOpacity onPress={handleSave} style={[styles.saveFab, isApproved && { opacity: 0.5 }]} disabled={isApproved}>
        <LinearGradient colors={isApproved ? ["#94A3B8", "#64748B"] : [COLORS.primary, "#4F46E5"]} style={styles.fabGrad}>
          <Text style={styles.saveFabText}>{isApproved ? "LEDGER APPROVED & LOCKED" : "SAVE PERFORMANCE LEDGER"}</Text>
          <SVGIcon name={isApproved ? "lock-closed" : "checkmark-done"} size={24} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerGradient: { padding: 25, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, ...SHADOWS.medium },
  headerTitleRow: { flexDirection: "row", alignItems: "center" },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 22, fontWeight: "900", color: "#fff" },
  headerSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.7)", fontWeight: "700" },
  configCard: { backgroundColor: "#fff", margin: 20, padding: 20, borderRadius: 24, ...SHADOWS.small, borderWidth: 1, borderColor: "#E2E8F0" },
  selectionWrapper: { marginTop: 15 },
  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 },
  approvedBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#ECFDF5", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4 },
  approvedText: { fontSize: 10, fontWeight: "900", color: "#059669" },
  sectionLabel: { fontSize: 10, fontWeight: "900", color: COLORS.primary, letterSpacing: 1 },
  label: { fontSize: 10, fontWeight: "900", color: "#94A3B8", marginBottom: 10 },
  bubbleRow: { gap: 10, paddingBottom: 5 },
  bubble: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 15, backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#E2E8F0", marginRight: 8 },
  bubbleActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  bubbleText: { fontSize: 12, color: "#475569", fontWeight: "700" },
  bubbleTextActive: { color: "#fff" },
  lockedConfigRow: { flexDirection: "row", gap: 15, marginBottom: 5 },
  lockedConfigItem: { flex: 1 },
  miniLabel: { fontSize: 9, fontWeight: "900", color: "#94A3B8", marginBottom: 6 },
  lockedBadge: { backgroundColor: "#F1F5F9", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0" },
  lockedBadgeText: { fontSize: 13, fontWeight: "800", color: COLORS.primary },
  syncBox: { padding: 50, alignItems: "center" },
  syncText: { marginTop: 15, color: "#64748B", fontWeight: "700" },
  listContent: { padding: 20, paddingBottom: 120 },
  listHeaderContainer: { marginBottom: 15 },
  listHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  listTitle: { fontSize: 12, fontWeight: "900", color: "#64748B" },
  listCount: { fontSize: 12, fontWeight: "800", color: COLORS.primary },
  studentCard: { backgroundColor: "#fff", padding: 18, borderRadius: 20, marginBottom: 15, ...SHADOWS.small },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 },
  studentName: { fontSize: 15, fontWeight: "800", color: "#1E293B" },
  gradeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: "#F1F5F9" },
  gradeText: { fontSize: 12, fontWeight: "900", color: COLORS.primary },
  scoresGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  scoreInput: { width: "47%", marginBottom: 10 },
  scoreLabel: { fontSize: 9, fontWeight: "900", color: "#94A3B8", marginBottom: 5 },
  input: { backgroundColor: "#F8FAFC", borderRadius: 10, padding: 10, fontSize: 14, fontWeight: "700", color: "#1E293B", borderWidth: 1, borderColor: "#E2E8F0" },
  totalBox: { width: "47%", backgroundColor: COLORS.primary + "10", padding: 10, borderRadius: 10, justifyContent: "center" },
  totalLabel: { fontSize: 9, fontWeight: "900", color: COLORS.primary },
  totalVal: { fontSize: 16, fontWeight: "900", color: COLORS.primary },
  saveFab: { position: "absolute", bottom: 30, left: 20, right: 20, borderRadius: 20, overflow: "hidden", ...SHADOWS.large },
  fabGrad: { padding: 20, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 15 },
  saveFabText: { color: "#fff", fontWeight: "900", fontSize: 16, letterSpacing: 1 },
  emptyState: { alignItems: "center", justifyContent: "center", padding: 40, backgroundColor: "#fff", borderRadius: 20, ...SHADOWS.small },
  emptyStateText: { marginTop: 15, color: "#64748B", fontWeight: "700", fontSize: 14, textAlign: "center" },
});
