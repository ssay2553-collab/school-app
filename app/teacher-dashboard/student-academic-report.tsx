import { Picker } from "@react-native-picker/picker";
import Constants from "expo-constants";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  collection,
  documentId,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { AcademicReportPreview } from "../../components/admin-dashboard/AcademicReportPreview";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { getSchoolLogo } from "../../constants/Logos";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebaseConfig";
import {
  ReportType,
  useAcademicRecordDetails,
} from "../../hooks/admin-dashboard/useAcademicRecordDetails";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";
import { getTeacherClasses, sortClasses } from "../../lib/classHelpers";

const TERMS = ["Term 1", "Term 2", "Term 3"];

export default function TeacherStudentAcademicReport() {
  const router = useRouter();
  const { appUser } = useAuth();
  const acadConfig = useAcademicConfig();
  const isNavigating = useRef(false);

  // Teacher classes and student state
  const [classesLoading, setClassesLoading] = useState(true);
  const [teacherClassesList, setTeacherClassesList] = useState<{ id: string; name: string }[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");

  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsList, setStudentsList] = useState<{ id: string; name: string }[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");

  // Report filters
  const [selectedTerm, setSelectedTerm] = useState("Term 1");
  const [selectedReportType, setSelectedReportType] = useState<ReportType>("End of Term");
  const [selectedReportNumber, setSelectedReportNumber] = useState(1);
  const [selectedYear, setSelectedYear] = useState("");
  const [hasSetDefaults, setHasSetDefaults] = useState(false);

  const primary = SCHOOL_CONFIG.primaryColor || COLORS.primary;
  const schoolId = (
    Constants.expoConfig?.extra?.schoolId || "afahjoy"
  ).toLowerCase();
  const schoolLogo = getSchoolLogo(schoolId);

  const assignedClassIds = useMemo(() => getTeacherClasses(appUser), [appUser]);

  const academicYears = useMemo(() => {
    const start = 2024;
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = start; y <= currentYear + 1; y++) {
      years.push(`${y}/${y + 1}`);
    }
    if (acadConfig.academicYear && !years.includes(acadConfig.academicYear)) {
      years.push(acadConfig.academicYear);
    }
    return Array.from(new Set(years)).sort().reverse();
  }, [acadConfig.academicYear]);

  // Set default year and term from academic config
  useEffect(() => {
    if (acadConfig.loading) return;

    if (acadConfig.academicYear && !hasSetDefaults) {
      setSelectedYear(acadConfig.academicYear);
      setSelectedTerm(acadConfig.currentTerm || "Term 1");
      setHasSetDefaults(true);
    } else if (!selectedYear && academicYears.length > 0 && !hasSetDefaults) {
      setSelectedYear(academicYears[0]);
      setSelectedTerm("Term 1");
      setHasSetDefaults(true);
    }
  }, [acadConfig, academicYears, hasSetDefaults, selectedYear]);

  // 1. Fetch assigned classes for teacher
  useEffect(() => {
    let isMounted = true;
    const fetchClasses = async () => {
      if (!appUser || assignedClassIds.length === 0) {
        if (isMounted) {
          setTeacherClassesList([]);
          setClassesLoading(false);
        }
        return;
      }

      setClassesLoading(true);
      try {
        const q = query(
          collection(db, "classes"),
          where(documentId(), "in", assignedClassIds.slice(0, 30))
        );
        const snap = await getDocs(q);
        if (!isMounted) return;

        const list = snap.docs.map((d) => ({
          id: d.id,
          name: (d.data() as any).name || (d.data() as any).className || d.id,
        }));
        const sorted = sortClasses(list);
        setTeacherClassesList(sorted);
        if (sorted.length > 0 && !selectedClassId) {
          setSelectedClassId(sorted[0].id);
        }
      } catch (err) {
        console.error("Error fetching teacher classes:", err);
      } finally {
        if (isMounted) setClassesLoading(false);
      }
    };

    fetchClasses();
    return () => { isMounted = false; };
  }, [appUser, assignedClassIds]);

  // 2. Fetch students for the selected class
  useEffect(() => {
    let isMounted = true;
    const fetchStudents = async () => {
      if (!selectedClassId || !assignedClassIds.includes(selectedClassId)) {
        if (isMounted) {
          setStudentsList([]);
          setSelectedStudentId("");
        }
        return;
      }

      setStudentsLoading(true);
      setStudentsList([]);
      setSelectedStudentId("");

      try {
        const q = query(
          collection(db, "users"),
          where("role", "==", "student"),
          where("classId", "==", selectedClassId)
        );
        const snap = await getDocs(q);
        if (!isMounted) return;

        const list = snap.docs
          .map((d) => {
            const data = d.data() as any;
            const status = data.status || data.profile?.status || "active";
            if (!["active", "pending_activation"].includes(status)) return null;

            return {
              id: d.id,
              name: `${data.profile?.firstName || ""} ${data.profile?.lastName || ""}`.trim() || "Unknown Student",
            };
          })
          .filter((s): s is { id: string; name: string } => s !== null)
          .sort((a, b) => a.name.localeCompare(b.name));

        setStudentsList(list);
        if (list.length > 0) {
          setSelectedStudentId(list[0].id);
        }
      } catch (err) {
        console.error("Error fetching class students:", err);
      } finally {
        if (isMounted) setStudentsLoading(false);
      }
    };

    fetchStudents();
    return () => { isMounted = false; };
  }, [selectedClassId, assignedClassIds]);

  // 3. Fetch report details using hook
  const {
    loading: fetchingReport,
    studentName,
    className,
    subjectsData,
    adminRemarks,
    teacherRemarks,
    conduct,
    attitude,
    interest,
    promotedTo,
    nextTermBegins,
    attendance,
    adminSig,
    overallPosition,
    isPreschool,
    preschoolAssessments,
    physicalDev,
    isFullReport,
    TRS,
    TAS,
    AGGREGATE,
    classIdState,
    isReportApproved,
    reportStatus,
    refresh,
    refreshing,
  } = useAcademicRecordDetails({
    studentId: selectedStudentId,
    term: selectedTerm,
    classId: selectedClassId,
    academicYear: selectedYear,
    reportType: selectedReportType,
    reportNumber: selectedReportNumber,
  });

  const handleBack = () => {
    if (isNavigating.current) return;
    isNavigating.current = true;
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/teacher-dashboard");
    }
    setTimeout(() => { isNavigating.current = false; }, 500);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[primary, "#1E293B"]} style={styles.headerGradient}>
        <View style={styles.headerTitleRow}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <SVGIcon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 15 }}>
            <Text style={styles.headerTitle}>Student Exam Reports</Text>
            <Text style={styles.headerSubtitle}>
              Class Results & Performance Reports
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        {/* Selector Card */}
        <View style={styles.selectorCard}>
          {/* Class Selection */}
          <Text style={styles.label}>My Class</Text>
          {classesLoading ? (
            <ActivityIndicator size="small" color={primary} style={{ marginVertical: 10 }} />
          ) : teacherClassesList.length === 0 ? (
            <View style={styles.noticeBox}>
              <Text style={styles.noticeText}>
                No assigned classes found. Please contact an administrator to assign you to a class.
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {teacherClassesList.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.chip,
                    selectedClassId === c.id && {
                      backgroundColor: primary,
                      borderColor: primary,
                    },
                  ]}
                  onPress={() => setSelectedClassId(c.id)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedClassId === c.id && { color: "#fff" },
                    ]}
                  >
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Student Selection */}
          {selectedClassId ? (
            <>
              <Text style={styles.label}>Select Student</Text>
              {studentsLoading ? (
                <ActivityIndicator size="small" color={primary} style={{ marginVertical: 10 }} />
              ) : studentsList.length === 0 ? (
                <View style={styles.noticeBox}>
                  <Text style={styles.noticeText}>No active students found in this class.</Text>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}
                >
                  {studentsList.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      style={[
                        styles.chip,
                        selectedStudentId === s.id && {
                          backgroundColor: primary,
                          borderColor: primary,
                        },
                      ]}
                      onPress={() => setSelectedStudentId(s.id)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selectedStudentId === s.id && { color: "#fff" },
                        ]}
                      >
                        {s.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </>
          ) : null}

          {/* Report Type */}
          <Text style={styles.label}>Report Type</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {["End of Term", "Mid-Term", "Mock Exams", "Class Assessment Task (CAT)", "Trial Test"].map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.chip,
                  selectedReportType === type && {
                    backgroundColor: primary,
                    borderColor: primary,
                  },
                ]}
                onPress={() => setSelectedReportType(type as ReportType)}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedReportType === type && { color: "#fff" },
                  ]}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {["Class Assessment Task (CAT)", "Trial Test", "Mock Exams"].includes(selectedReportType) && (
            <>
              <Text style={styles.label}>Assessment Number</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[
                      styles.chip,
                      selectedReportNumber === n && {
                        backgroundColor: primary,
                        borderColor: primary,
                      },
                    ]}
                    onPress={() => setSelectedReportNumber(n)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedReportNumber === n && { color: "#fff" },
                      ]}
                    >
                      {n}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {/* Year & Term Pickers */}
          <View style={styles.pickerRow}>
            <View style={[styles.pickerBox, { flex: 1 }]}>
              <Text style={styles.miniLabel}>Year</Text>
              <Picker
                selectedValue={selectedYear}
                onValueChange={setSelectedYear}
                style={[styles.picker, { marginLeft: -10 }]}
              >
                {academicYears.map((y) => (
                  <Picker.Item key={y} label={y} value={y} />
                ))}
              </Picker>
            </View>
            <View style={[styles.pickerBox, { flex: 1 }]}>
              <Text style={styles.miniLabel}>Term</Text>
              <Picker
                selectedValue={selectedTerm}
                onValueChange={setSelectedTerm}
                style={[styles.picker, { marginLeft: -10 }]}
              >
                {TERMS.map((t) => (
                  <Picker.Item key={t} label={t} value={t} />
                ))}
              </Picker>
            </View>
          </View>
        </View>

        {/* Loading Report State */}
        {Boolean(fetchingReport && selectedStudentId) && (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={primary} size="large" />
            <Text style={styles.loadingText}>Fetching Exam Report...</Text>
          </View>
        )}

        {/* Empty State when no student selected or no records found */}
        {Boolean(!fetchingReport && selectedStudentId && subjectsData.length === 0) && (
          <View style={styles.emptyBox}>
            <SVGIcon name="document-text" size={48} color="#CBD5E1" />
            <Text style={styles.emptyText}>
              No exam record found for this student in the selected period.
            </Text>
          </View>
        )}

        {/* RESTRICTED: Admin Approval Pending */}
        {Boolean(!fetchingReport && selectedStudentId && subjectsData.length > 0 && !isReportApproved) && (
          <View style={styles.pendingApprovalCard}>
            <View style={styles.pendingIconBox}>
              <SVGIcon name="lock-closed" size={44} color="#D97706" />
            </View>
            <Text style={styles.pendingTitle}>Approval Pending</Text>
            <Text style={styles.pendingMessage}>
              This exam report has not been approved by the Administrator yet.
            </Text>
            <Text style={styles.pendingSubText}>
              Teachers can only access exam report details once an Administrator reviews and approves the results.
            </Text>
            <View style={styles.statusBadgePending}>
              <SVGIcon name="time-outline" size={16} color="#D97706" />
              <Text style={styles.statusBadgeTextPending}>STATUS: {(reportStatus || "PENDING").toUpperCase()}</Text>
            </View>
          </View>
        )}

        {/* APPROVED REPORT VIEW (NO Printing, Sharing or PDF Download) */}
        {Boolean(!fetchingReport && selectedStudentId && subjectsData.length > 0 && isReportApproved) && (
          <AcademicReportPreview
            primary={primary}
            schoolLogo={schoolLogo}
            reportType={selectedReportType}
            studentName={studentName}
            className={className}
            classIdState={classIdState}
            academicYearState={selectedYear}
            termState={selectedTerm}
            overallPosition={overallPosition}
            attendance={attendance}
            isFullReport={isFullReport}
            subjectsData={subjectsData}
            TRS={TRS}
            TAS={TAS}
            AGGREGATE={AGGREGATE}
            isPreschool={isPreschool}
            conduct={conduct}
            attitude={attitude}
            interest={interest}
            physicalDev={physicalDev}
            preschoolAssessments={preschoolAssessments}
            teacherRemarks={teacherRemarks}
            adminRemarks={adminRemarks}
            nextTermBegins={nextTermBegins}
            promotedTo={promotedTo}
            adminSig={adminSig}
            isReportApproved={isReportApproved}
            refreshing={refreshing}
            refresh={refresh}
            hideDownload={true}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  headerGradient: {
    padding: 25,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    ...SHADOWS.medium,
  },
  headerTitleRow: { flexDirection: "row", alignItems: "center" },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 22, fontWeight: "900", color: "#fff" },
  headerSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.7)", fontWeight: "700" },
  selectorCard: {
    backgroundColor: "#fff",
    padding: 20,
    margin: 15,
    borderRadius: 24,
    ...SHADOWS.small,
  },
  label: {
    fontSize: 10,
    fontWeight: "900",
    color: "#94A3B8",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  chipRow: { paddingBottom: 15, gap: 10 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 15,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  chipText: { fontSize: 12, color: "#475569", fontWeight: "700" },
  pickerRow: { flexDirection: "row", gap: 15 },
  pickerBox: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    minHeight: 65,
    justifyContent: "center",
    paddingTop: 12,
    position: "relative",
  },
  picker: { height: 50 },
  miniLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "#94A3B8",
    position: "absolute",
    top: 12,
    left: 12,
    zIndex: 1,
    textTransform: "uppercase",
  },
  noticeBox: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: 12,
    borderRadius: 12,
    marginBottom: 15,
  },
  noticeText: {
    fontSize: 12,
    color: "#B45309",
    fontWeight: "600",
  },
  loadingBox: { padding: 40, alignItems: "center" },
  loadingText: { marginTop: 10, color: "#64748B", fontWeight: "600" },
  emptyBox: {
    padding: 40,
    alignItems: "center",
    backgroundColor: "#fff",
    margin: 15,
    borderRadius: 24,
    ...SHADOWS.small,
  },
  emptyText: {
    marginTop: 12,
    color: "#64748B",
    textAlign: "center",
    fontWeight: "600",
  },
  pendingApprovalCard: {
    backgroundColor: "#fff",
    margin: 15,
    padding: 25,
    borderRadius: 24,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FEF3C7",
    ...SHADOWS.medium,
  },
  pendingIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FFFBEB",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  pendingTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1E293B",
    marginBottom: 8,
  },
  pendingMessage: {
    fontSize: 14,
    color: "#B45309",
    textAlign: "center",
    fontWeight: "700",
    lineHeight: 20,
    marginBottom: 8,
  },
  pendingSubText: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  statusBadgePending: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  statusBadgeTextPending: {
    fontSize: 11,
    fontWeight: "900",
    color: "#B45309",
  },
});
