import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";
import { useToast } from "../../contexts/ToastContext";

// Components
import { StudentScoreCard } from "../../components/admin-dashboard/StudentScoreCard";
import { ScoreFilterSection } from "../../components/admin-dashboard/ScoreFilterSection";
import { EditScoresStats } from "../../components/edit-scores/EditScoresStats";

// Hooks
import { useEditScoresLogic } from "../../hooks/admin-dashboard/useEditScoresLogic";

export default function EditStudentScores() {
  const router = useRouter();
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const acadConfig = useAcademicConfig();
  const insets = useSafeAreaInsets();
  const isNavigating = useRef(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const {
    loading,
    saving,
    deleting,
    listLoading,
    classes,
    selectedClassId,
    setSelectedClassId,
    selectedSubject,
    setSelectedSubject,
    subjects,
    selectedReportType,
    setSelectedReportType,
    searchQuery,
    setSearchQuery,
    recordId,
    allStudents,
    visibleStudents,
    loadSubmission,
    loadMoreStudents,
    onUpdateRef,
    approveAndSave,
    deleteSubmission,
    classStats,
    hasUnsavedChanges,
    selectedClassName,
    selectedYear,
    term,
  } = useEditScoresLogic({ appUser, acadConfig, showToast });

  const primary = SCHOOL_CONFIG.primaryColor;
  const secondary = SCHOOL_CONFIG.secondaryColor;

  const confirmDiscard = (onConfirm: () => void) => {
    if (hasUnsavedChanges) {
      if (Platform.OS === "web") {
        if (window.confirm("You have unsaved changes. Discard them?")) {
          onConfirm();
        }
      } else {
        Alert.alert(
          "Unsaved Changes",
          "You have modified scores. Switching will discard these changes.",
          [
            { text: "Stay", style: "cancel" },
            { text: "Discard", style: "destructive", onPress: onConfirm },
          ]
        );
      }
    } else {
      onConfirm();
    }
  };

  const handleBack = () => {
    confirmDiscard(() => {
      if (isNavigating.current) return;
      isNavigating.current = true;
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/admin-dashboard");
      }
    });
  };

  const handleDeleteRecord = () => {
    if (!recordId) return;

    if (Platform.OS === "web") {
      if (
        window.confirm(
          "This will permanently delete this subject's scores for this class."
        )
      ) {
        deleteSubmission();
      }
    } else {
      Alert.alert(
        "Delete Records?",
        "This will permanently delete this subject's scores for this class.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete Permanently",
            style: "destructive",
            onPress: deleteSubmission,
          },
        ]
      );
    }
  };

  useEffect(() => {
    const onBackPress = () => {
      if (hasUnsavedChanges) {
        if (Platform.OS === "web") return false;
        Alert.alert(
          "Unsaved Changes",
          "You have modified scores. Are you sure you want to exit without saving?",
          [
            { text: "Stay", style: "cancel" },
            { text: "Exit", style: "destructive", onPress: () => router.back() },
          ]
        );
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [hasUnsavedChanges, router]);

  if (loading || acadConfig.loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={primary} />
      </View>
    );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <FlatList
        data={visibleStudents}
        keyExtractor={(item) => item.studentId}
        onEndReached={loadMoreStudents}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <LinearGradient
              colors={[primary, secondary]}
              style={[
                styles.header,
                { paddingTop: Math.max(insets.top, 20) + 10 },
              ]}
            >
              <View style={styles.headerTop}>
                <TouchableOpacity onPress={handleBack} style={styles.headerBtn}>
                  <SVGIcon name="arrow-back" color="#fff" size={22} />
                </TouchableOpacity>
                <View style={styles.titleContainer}>
                  <Text style={styles.headerTitle} numberOfLines={1}>
                    {selectedSubject || "Score Editor"}
                  </Text>
                  <View style={styles.statusRow}>
                    <View
                      style={[styles.statusDot, { backgroundColor: "#10B981" }]}
                    />
                    <Text style={styles.headerSub} numberOfLines={1}>
                      {selectedClassName || "No Class Selected"}
                    </Text>
                    {hasUnsavedChanges && (
                      <View style={styles.unsavedBadge}>
                        <Text style={styles.unsavedText}>UNSAVED</Text>
                      </View>
                    )}
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => loadSubmission()}
                  style={styles.headerBtn}
                >
                  <SVGIcon name="refresh" color="#fff" size={20} />
                </TouchableOpacity>
              </View>

              {subjects.length > 0 && (
                <Animatable.View
                  animation="fadeIn"
                  duration={600}
                  style={styles.subjectScrollContainer}
                >
                  <View style={styles.subjectHeaderRow}>
                    <Text style={styles.subjectLabel}>SUBMITTED SUBJECTS</Text>
                    <View style={styles.subjectCountBadge}>
                      <Text style={styles.subjectCountText}>
                        {subjects.length}
                      </Text>
                    </View>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.subjectScrollContent}
                  >
                    {subjects.map((s) => (
                      <TouchableOpacity
                        key={s.name}
                        style={[
                          styles.subjectChip,
                          s.status === "approved"
                            ? styles.approvedChip
                            : styles.pendingChip,
                          selectedSubject === s.name && styles.activeSubjectChip,
                        ]}
                        onPress={() => {
                          if (selectedSubject === s.name) return;
                          confirmDiscard(() => {
                            setSelectedSubject(s.name);
                            loadSubmission(s.name);
                          });
                        }}
                      >
                        <View
                          style={[
                            styles.statusDotSmall,
                            {
                              backgroundColor:
                                s.status === "approved" ? "#10B981" : "#F59E0B",
                            },
                          ]}
                        />
                        <Text
                          style={[
                            styles.subjectChipText,
                            selectedSubject === s.name
                              ? { color: primary }
                              : { color: "#fff" },
                          ]}
                        >
                          {s.name}
                        </Text>
                        {s.status === "approved" && (
                          <SVGIcon
                            name="checkmark-circle"
                            size={14}
                            color={
                              selectedSubject === s.name ? primary : "#10B981"
                            }
                            style={{ marginLeft: 6 }}
                          />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </Animatable.View>
              )}
            </LinearGradient>

            <ScoreFilterSection
              showFilters={true}
              setShowFilters={() => {}}
              selectedYear={selectedYear}
              term={term}
              selectedReportType={selectedReportType}
              setSelectedReportType={setSelectedReportType}
              selectedClassId={selectedClassId}
              setSelectedClassId={setSelectedClassId}
              classes={classes}
              selectedSubject={selectedSubject}
              setSelectedSubject={setSelectedSubject}
              subjects={subjects}
              loadSubmission={() => confirmDiscard(loadSubmission)}
              listLoading={listLoading}
              recordId={recordId}
              primary={primary}
            />

            {recordId && (
              <Animatable.View animation="fadeIn" style={styles.contentPadding}>
                <View style={styles.searchBar}>
                  <SVGIcon name="search" size={18} color="#94A3B8" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search student name..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholderTextColor="#94A3B8"
                    clearButtonMode="while-editing"
                  />
                </View>

                <EditScoresStats
                  stats={classStats}
                  totalStudents={allStudents.length}
                  primary={primary}
                />
              </Animatable.View>
            )}
          </>
        }
        renderItem={({ item }) => (
          <StudentScoreCard
            item={item}
            onUpdateRef={onUpdateRef}
            primary={primary}
            reportType={selectedReportType}
          />
        )}
        ListEmptyComponent={
          recordId ? (
            <View style={styles.empty}>
              <View
                style={[styles.emptyIconCircle, { backgroundColor: "#F1F5F9" }]}
              >
                <SVGIcon name="search" size={32} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>No matching students</Text>
              <Text style={styles.emptyText}>
                Try a different search term or check filters.
              </Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <View
                style={[
                  styles.emptyIconCircle,
                  { backgroundColor: primary + "10" },
                ]}
              >
                <SVGIcon name="document-text" size={32} color={primary} />
              </View>
              <Text style={styles.emptyTitle}>Ready to begin</Text>
              <Text style={styles.emptyText}>
                Use the filters above to load a class subject.
              </Text>
            </View>
          )
        }
        contentContainerStyle={{ paddingBottom: 120 }}
      />

      {recordId && allStudents.length > 0 && (
        <Animatable.View
          animation="slideInUp"
          duration={400}
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={handleDeleteRecord}
            disabled={saving || deleting}
          >
            {deleting ? (
              <ActivityIndicator color="#EF4444" />
            ) : (
              <SVGIcon name="trash" size={22} color="#EF4444" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: primary }]}
            onPress={approveAndSave}
            disabled={saving || deleting}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.btnContent}>
                <Text style={styles.saveBtnText}>Save Changes</Text>
                <SVGIcon
                  name="cloud-upload"
                  size={20}
                  color="#fff"
                  style={{ marginLeft: 8 }}
                />
              </View>
            )}
          </TouchableOpacity>
        </Animatable.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 25,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    ...SHADOWS.medium,
  },
  subjectScrollContainer: {
    marginTop: 20,
  },
  subjectHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  subjectLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  subjectCountBadge: {
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  subjectCountText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "900",
  },
  subjectScrollContent: {
    paddingRight: 20,
    paddingBottom: 4,
  },
  subjectChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    marginRight: 10,
    borderWidth: 1.5,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderColor: "rgba(255,255,255,0.1)",
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
      default: {}
    }),
  },
  approvedChip: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  pendingChip: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  activeSubjectChip: {
    backgroundColor: "#fff",
    borderColor: "#fff",
    ...SHADOWS.medium,
  },
  subjectChipText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  statusDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
      default: {}
    }),
  },
  titleContainer: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: 10,
    justifyContent: "center",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    maxWidth: "100%",
    flexWrap: "nowrap",
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  unsavedBadge: {
    backgroundColor: "#F87171",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    flexShrink: 0,
  },
  unsavedText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "900",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  headerSub: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "700",
    flexShrink: 1,
  },
  contentPadding: {
    paddingHorizontal: 16,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
    ...SHADOWS.small,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: "#1E293B",
    fontWeight: "600",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    ...SHADOWS.large,
  },
  deleteBtn: {
    width: 48,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#FEF2F2",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FEE2E2",
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
      default: {}
    }),
  },
  saveBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.small,
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
      default: {}
    }),
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  btnContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { alignItems: "center", marginTop: 60, paddingHorizontal: 40 },
  emptyIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1E293B",
    marginBottom: 6,
  },
  emptyText: {
    color: "#94A3B8",
    fontWeight: "500",
    textAlign: "center",
    fontSize: 13,
    lineHeight: 18,
  },
});
