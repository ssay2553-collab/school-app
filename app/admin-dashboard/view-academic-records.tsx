import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import { AcademicFilterCard } from "../../components/admin-dashboard/AcademicFilterCard";
import { AcademicSignatureCard } from "../../components/admin-dashboard/AcademicSignatureCard";
import { AcademicStudentItem } from "../../components/admin-dashboard/AcademicStudentItem";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { COLORS, SHADOWS } from "../../constants/theme";
import { ScoreData, useViewAcademicRecords } from "../../hooks/admin-dashboard/useViewAcademicRecords";

export default function ViewAcademicRecords() {
  const router = useRouter();
  const {
    loading,
    listLoading,
    fetchingSubjects,
    refreshing,
    savingMetadata,
    uploadingSig,
    signatureUrl,
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
    mAdminRemarks,
    setAdminRemarks,
    mTeacherRemarks,
    setTeacherRemarks,
    loadData,
    onRefresh,
    handleEditMetadata,
    saveMetadata,
    handleUploadSignature,
    handleBulkUpdate,
    availableYears,
    acadConfig,
    primary
  } = useViewAcademicRecords();

  const secondary = SCHOOL_CONFIG.secondaryColor || "#c53b59";

  const renderStudentItem = useCallback(
    ({ item }: { item: ScoreData }) => (
      <AcademicStudentItem
        item={item}
        primary={primary}
        onEditMetadata={() => handleEditMetadata(item)}
        onPress={() =>
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
          })
        }
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
              onPress={() => router.back()}
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

        <AcademicSignatureCard
          signatureUrl={signatureUrl}
          uploadingSig={uploadingSig}
          handleUploadSignature={handleUploadSignature}
          primary={primary}
        />

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
          handleBulkUpdate={handleBulkUpdate}
          primary={primary}
        />

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
      signatureUrl,
      uploadingSig,
      availableYears,
      handleBulkUpdate,
      handleUploadSignature,
      loadData,
      router,
      setSelectedClassId,
      setSelectedSubject,
      setSelectedYear,
      setTerm,
      setSelectedReportType
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

      <Modal visible={metadataModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Terminal Metadata</Text>
                <Text style={styles.modalSubtitle}>
                  {editingStudent?.fullName}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setMetadataModalVisible(false)}
                style={styles.closeBtn}
              >
                <SVGIcon name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.modalScroll}
            >
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>CONDUCT</Text>
                <TextInput
                  style={styles.textInput}
                  value={mConduct}
                  onChangeText={setConduct}
                  placeholder="e.g. Excellent"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>ATTITUDE</Text>
                <TextInput
                  style={styles.textInput}
                  value={mAttitude}
                  onChangeText={setAttitude}
                  placeholder="e.g. Very Positive"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>INTEREST</Text>
                <TextInput
                  style={styles.textInput}
                  value={mInterest}
                  onChangeText={setInterest}
                  placeholder="e.g. High"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  PROMOTED / REPEATED TO (Global)
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={mPromotedTo}
                  onChangeText={setPromotedTo}
                  placeholder="e.g. Promoted to Basic 5"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>NEXT TERM BEGINS (Global)</Text>
                <TextInput
                  style={styles.textInput}
                  value={mNextTermBegins}
                  onChangeText={setNextTermBegins}
                  placeholder="e.g. 15th Jan, 2025"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>TEACHER'S REMARKS</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  multiline
                  numberOfLines={3}
                  value={mTeacherRemarks}
                  onChangeText={setTeacherRemarks}
                  placeholder="Enter class teacher assessment..."
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>ADMINISTRATIVE REMARKS</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  multiline
                  numberOfLines={3}
                  value={mAdminRemarks}
                  onChangeText={setAdminRemarks}
                  placeholder="Enter official school remarks..."
                />
              </View>

              <TouchableOpacity
                style={[styles.saveMetadataBtn, { backgroundColor: primary }]}
                onPress={saveMetadata}
                disabled={savingMetadata}
              >
                {savingMetadata ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveMetadataBtnText}>
                    Save Final Metadata
                  </Text>
                )}
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 25,
    paddingTop: 25,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 15,
  },
  modalTitle: { fontSize: 18, fontWeight: "900", color: "#1E293B" },
  modalSubtitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary || "#2e86de",
    marginTop: 2,
  },
  modalScroll: { paddingTop: 10 },
  closeBtn: { width: 40, height: 40, alignItems: "flex-end" },
  inputGroup: { marginBottom: 15 },
  inputLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#94A3B8",
    marginBottom: 8,
    letterSpacing: 1,
  },
  textInput: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    fontSize: 14,
    color: "#1E293B",
    fontWeight: "600",
  },
  textArea: { textAlignVertical: "top", minHeight: 80 },
  saveMetadataBtn: {
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 15,
    ...SHADOWS.small,
  },
  saveMetadataBtnText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: 0.5,
  },
});
