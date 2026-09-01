import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import { useRef, useEffect } from "react";
import SVGIcon from "../../components/SVGIcon";
import { AcademicFilterCard } from "../../components/admin-dashboard/AcademicFilterCard";
import { AcademicSignatureCard } from "../../components/admin-dashboard/AcademicSignatureCard";
import { AcademicStudentItem } from "../../components/admin-dashboard/AcademicStudentItem";
import { AcademicMetadataModal } from "../../components/admin-dashboard/AcademicMetadataModal";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { SHADOWS } from "../../constants/theme";
import { ScoreData, useViewAcademicRecords } from "../../hooks/admin-dashboard/useViewAcademicRecords";

export default function ViewAcademicRecords() {
  const router = useRouter();
  const isNavigating = useRef(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const {
    loading,
    listLoading,
    fetchingSubjects,
    refreshing,
    savingMetadata,
    classes,
    availableSubjects,
    selectedClassId,
    setSelectedClassId,
    selectedYear,
    setSelectedYear,
    selectedSubject,
    setSelectedSubject,
    term,
    setTerm,
    selectedReportType,
    setSelectedReportType,
    studentScores,
    stats,
    hasSearched,
    metadataModalVisible,
    setMetadataModalVisible,
    editingStudent,
    mConduct,
    setConduct,
    mAttitude,
    setAttitude,
    mInterest,
    setInterest,
    mPromotedTo,
    setPromotedTo,
    mNextTermBegins,
    setNextTermBegins,
    showNextTermPicker,
    setShowNextTermPicker,
    mAdminRemarks,
    setAdminRemarks,
    mTeacherRemarks,
    setTeacherRemarks,
    loadData,
    onRefresh,
    handleEditMetadata,
    saveMetadata,
    handleBulkUpdate,
    recalculateRankings,
    recalculating,
    availableYears,
    acadConfig,
    primary,
    globalNextTermBegins,
    setGlobalNextTermBegins,
    globalPromotedTo,
    setGlobalPromotedTo,
    showGlobalNextTermPicker,
    setShowGlobalNextTermPicker
  } = useViewAcademicRecords();

  const secondary = SCHOOL_CONFIG.secondaryColor || "#c53b59";

  const handleBack = () => {
    if (isNavigating.current) return;
    isNavigating.current = true;
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/admin-dashboard");
    }
  };

  const renderStudentItem = useCallback(
    ({ item }: { item: ScoreData }) => (
      <AcademicStudentItem
        item={item}
        primary={primary}
        onEditMetadata={() => handleEditMetadata(item)}
        onPress={() => {
          if (isNavigating.current) return;
          isNavigating.current = true;
          router.push({
            pathname: "/admin-dashboard/view-academic-record-details",
            params: {
              studentId: item.studentId,
              term,
              classId: selectedClassId,
              academicYear: selectedYear,
              subject: selectedSubject,
              reportType: selectedReportType,
            },
          });
          setTimeout(() => { isNavigating.current = false; }, 500);
        }}
      />
    ),
    [
      primary,
      term,
      selectedClassId,
      selectedYear,
      selectedSubject,
      selectedReportType,
      router,
      handleEditMetadata
    ],
  );

  const ListHeader = useMemo(
    () => (
      <View>
        <LinearGradient colors={[primary, secondary]} style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              onPress={handleBack}
              style={styles.miniBackBtn}
            >
              <SVGIcon name="arrow-back" color="#fff" size={24} />
            </TouchableOpacity>
            <View style={styles.titleContainer}>
              <Text style={styles.schoolNameMini} numberOfLines={1}>
                {SCHOOL_CONFIG.fullName}
              </Text>
              <Text style={styles.mottoMini}>Approved Academic Ledger</Text>
            </View>
            <View style={{ width: 44 }} />
          </View>
        </LinearGradient>

        <AcademicFilterCard
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          availableYears={availableYears}
          acadConfig={acadConfig}
          term={term}
          setTerm={setTerm}
          selectedReportType={selectedReportType}
          setSelectedReportType={setSelectedReportType}
          classes={classes}
          selectedClassId={selectedClassId}
          setSelectedClassId={setSelectedClassId}
          availableSubjects={availableSubjects}
          selectedSubject={selectedSubject}
          setSelectedSubject={setSelectedSubject}
          fetchingSubjects={fetchingSubjects}
          listLoading={listLoading}
          loadData={loadData}
          primary={primary}
          globalNextTermBegins={globalNextTermBegins}
          setGlobalNextTermBegins={setGlobalNextTermBegins}
          globalPromotedTo={globalPromotedTo}
          setGlobalPromotedTo={setGlobalPromotedTo}
          showGlobalNextTermPicker={showGlobalNextTermPicker}
          setShowGlobalNextTermPicker={setShowGlobalNextTermPicker}
        />

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.recalcBtn, { borderColor: primary }]}
            onPress={recalculateRankings}
            disabled={recalculating}
          >
            {recalculating ? (
              <ActivityIndicator size="small" color={primary} />
            ) : (
              <>
                <SVGIcon name="refresh-circle" size={20} color={primary} />
                <Text style={[styles.recalcBtnText, { color: primary }]}>
                  Recalculate Class Rankings
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {stats && studentScores.length > 0 && (
          <Animatable.View animation="fadeIn" style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statVal}>{stats.average}</Text>
              <Text style={styles.statLabel}>Avg Score</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statVal}>{stats.studentCount}</Text>
              <Text style={styles.statLabel}>Students</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statVal}>{stats.passRate}%</Text>
              <Text style={styles.statLabel}>Completion</Text>
            </View>
          </Animatable.View>
        )}
      </View>
    ),
    [
      primary,
      secondary,
      selectedYear,
      term,
      selectedReportType,
      selectedClassId,
      classes,
      availableSubjects,
      selectedSubject,
      fetchingSubjects,
      listLoading,
      stats,
      studentScores,
      acadConfig,
      availableYears,
      handleBulkUpdate,
      loadData,
      router,
      setSelectedClassId,
      setSelectedSubject,
      setSelectedYear,
      setTerm,
      setSelectedReportType,
      recalculateRankings,
      recalculating,
      globalNextTermBegins,
      setGlobalNextTermBegins,
      globalPromotedTo,
      setGlobalPromotedTo,
      showGlobalNextTermPicker,
      setShowGlobalNextTermPicker
    ],
  );

  if (loading) {
    return (
      <View style={styles.loadingCenter}>
        <ActivityIndicator size="large" color={primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <FlatList
        data={studentScores}
        renderItem={renderStudentItem}
        keyExtractor={(item) => item.studentId}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={primary}
          />
        }
        ListEmptyComponent={
          hasSearched && !listLoading ? (
            <View style={styles.emptyContainer}>
              <SVGIcon name="document-text" size={64} color="#CBD5E1" />
              <Text style={styles.emptyText}>
                No scores recorded for this subject.
              </Text>
            </View>
          ) : null
        }
      />

      <AcademicMetadataModal
        visible={metadataModalVisible}
        onClose={() => setMetadataModalVisible(false)}
        editingStudent={editingStudent}
        mConduct={mConduct}
        setConduct={setConduct}
        mAttitude={mAttitude}
        setAttitude={setAttitude}
        mInterest={mInterest}
        setInterest={setInterest}
        mPromotedTo={mPromotedTo}
        setPromotedTo={setPromotedTo}
        mAdminRemarks={mAdminRemarks}
        setAdminRemarks={setAdminRemarks}
        mTeacherRemarks={mTeacherRemarks}
        setTeacherRemarks={setTeacherRemarks}
        saveMetadata={saveMetadata}
        savingMetadata={savingMetadata}
        primary={primary}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  loadingCenter: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    paddingTop: Platform.OS === "android" ? 40 : 20,
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  miniBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
      default: {}
    }),
  },
  titleContainer: { alignItems: "center", flex: 1 },
  schoolNameMini: { color: "#fff", fontSize: 16, fontWeight: "800" },
  mottoMini: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  statsContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginTop: 15,
    borderRadius: 20,
    padding: 20,
    justifyContent: "space-around",
    ...SHADOWS.small,
  },
  statItem: { alignItems: "center" },
  statVal: { fontSize: 18, fontWeight: "900", color: "#1E293B" },
  statLabel: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "700",
    marginTop: 4,
  },
  statDivider: { width: 1, height: 30, backgroundColor: "#F1F5F9" },
  emptyContainer: { alignItems: "center", marginTop: 60 },
  emptyText: {
    color: "#94A3B8",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 15,
  },
  actionRow: {
    paddingHorizontal: 20,
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  recalcBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: "#fff",
    gap: 8,
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
      default: {}
    }),
  },
  recalcBtnText: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
