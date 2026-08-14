import { Picker } from "@react-native-picker/picker";
import Constants from "expo-constants";
import {
  collection,
  documentId,
  getDocsFromServer,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
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
import { SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { db } from "../../firebaseConfig";
import {
  ReportType,
  useAcademicRecordDetails,
} from "../../hooks/admin-dashboard/useAcademicRecordDetails";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";

const TERMS = ["Term 1", "Term 2", "Term 3"];

export default function StudentAcademicReport() {
  const { appUser } = useAuth();
  const acadConfig = useAcademicConfig();
  const { showToast } = useToast();

  const [children, setChildren] = useState<any[]>([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("Term 1");
  const [selectedReportType, setSelectedReportType] =
    useState<ReportType>("End of Term");

  const primary = SCHOOL_CONFIG.primaryColor;
  const schoolId = (
    Constants.expoConfig?.extra?.schoolId || "afahjoy"
  ).toLowerCase();
  const schoolLogo = getSchoolLogo(schoolId);

  const academicYears = useMemo(() => {
    const start = 2024; // Extended history start
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

  const [selectedYear, setSelectedYear] = useState("");
  const [hasSetDefaults, setHasSetDefaults] = useState(false);

  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [reportHistory, setReportHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const {
    loading: fetchingReport,
    generating,
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
    generatePDF,
    classIdState,
  } = useAcademicRecordDetails({
    studentId: selectedChildId,
    term: selectedTerm,
    classId: children.find((c) => c.id === selectedChildId)?.classId,
    academicYear: selectedYear,
    reportType: selectedReportType,
  });

  const fetchHistory = async () => {
    if (!selectedChildId) {
      showToast({ message: "Please select a student first", type: "info" });
      return;
    }
    setHistoryModalVisible(true);
    setLoadingHistory(true);
    try {
      const q = query(
        collection(db, "student-reports"),
        where("studentId", "==", selectedChildId),
        where("status", "==", "approved"),
      );
      const snap = await getDocsFromServer(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) => {
        if (a.academicYear !== b.academicYear)
          return b.academicYear.localeCompare(a.academicYear);
        if (a.term !== b.term) return b.term.localeCompare(a.term);
        return (a.reportType || "").localeCompare(b.reportType || "");
      });
      setReportHistory(list);
    } catch (e) {
      console.error(e);
      showToast({ message: "Failed to load history", type: "error" });
    } finally {
      setLoadingHistory(false);
    }
  };

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appUser || appUser.role !== "parent") return;
    const fetchData = async () => {
      const ids = (appUser as any).childrenIds || [];
      if (ids.length > 0) {
        try {
          const q = query(
            collection(db, "users"),
            where(documentId(), "in", ids),
          );
          const snap = await getDocsFromServer(q as any);
          const list = snap.docs.map((d) => {
            const data = d.data() as any;
            return {
              id: d.id,
              name: `${data.profile?.firstName || ""} ${data.profile?.lastName || ""}`.trim(),
              classId: data.classId || data.profile?.classId || "",
            };
          });
          setChildren(list);
          if (list.length > 0) setSelectedChildId(list[0].id);
        } catch (e) {
          console.error("Error fetching children:", e);
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [appUser]);

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
  }, [acadConfig, academicYears, hasSetDefaults]);

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={primary} />
      </View>
    );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 50 }}
      >
        <View style={styles.header}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Academic Reports</Text>
              <Text style={styles.headerSubtitle}>
                View terminal progress sheets
              </Text>
            </View>
            <TouchableOpacity style={styles.historyBtn} onPress={fetchHistory}>
              <SVGIcon name="calendar" size={18} color={primary} />
              <Text style={[styles.historyBtnText, { color: primary }]}>
                History
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.selectorCard}>
          <Text style={styles.label}>Select Student</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {children.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.chip,
                  selectedChildId === c.id && {
                    backgroundColor: primary,
                    borderColor: primary,
                  },
                ]}
                onPress={() => setSelectedChildId(c.id)}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedChildId === c.id && { color: "#fff" },
                  ]}
                >
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Report Type</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {["End of Term", "Mid-Term", "Mock Exams"].map((type) => (
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

        {fetchingReport && (
          <View style={{ padding: 40, alignItems: "center" }}>
            <ActivityIndicator color={primary} size="large" />
            <Text
              style={{ marginTop: 10, color: "#64748B", fontWeight: "600" }}
            >
              Fetching Report Data...
            </Text>
          </View>
        )}

        {!fetchingReport && subjectsData.length === 0 && selectedChildId && (
          <View style={{ padding: 40, alignItems: "center" }}>
            <Text
              style={{
                color: "#64748B",
                textAlign: "center",
                fontWeight: "600",
              }}
            >
              No approved academic records found for this period.
            </Text>
          </View>
        )}

        {!fetchingReport && subjectsData.length > 0 && (
          <AcademicReportPreview
            primary={primary}
            schoolLogo={schoolLogo}
            reportType={selectedReportType}
            studentName={studentName}
            className={className}
            classIdState={classIdState}
            academicYearState={selectedYear}
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
            generating={generating}
            generatePDF={generatePDF}
            hideDownload={true}
          />
        )}
      </ScrollView>

      <Modal
        visible={historyModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setHistoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report History</Text>
              <TouchableOpacity onPress={() => setHistoryModalVisible(false)}>
                <SVGIcon name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            {loadingHistory ? (
              <ActivityIndicator
                size="large"
                color={primary}
                style={{ margin: 40 }}
              />
            ) : reportHistory.length === 0 ? (
              <View style={{ padding: 40, alignItems: "center" }}>
                <Text style={{ color: "#64748B", fontWeight: "600" }}>
                  No previous reports found.
                </Text>
              </View>
            ) : (
              <FlatList
                data={reportHistory}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.historyItem}
                    onPress={() => {
                      setSelectedYear(item.academicYear);
                      setSelectedTerm(item.term);
                      if (
                        ["End of Term", "Mid-Term", "Mock Exams"].includes(
                          item.reportType,
                        )
                      ) {
                        setSelectedReportType(item.reportType as ReportType);
                      }
                      setHistoryModalVisible(false);
                    }}
                  >
                    <View style={styles.historyItemIcon}>
                      <SVGIcon name="document-text" size={20} color={primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyItemTitle}>
                        {item.reportType}
                      </Text>
                      <Text style={styles.historyItemSubtitle}>
                        {item.academicYear} • {item.term}
                      </Text>
                    </View>
                    <SVGIcon name="chevron-forward" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                )}
                contentContainerStyle={{ padding: 15, paddingBottom: 40 }}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    padding: 25,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
  },
  headerTitle: { fontSize: 24, fontWeight: "900", color: "#1E293B" },
  headerSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 4,
    fontWeight: "600",
  },
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
  historyBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  historyBtnText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: "800",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    height: "70%",
    ...SHADOWS.medium,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 24,
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1E293B",
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#F8FAFC",
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  historyItemIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    ...SHADOWS.small,
  },
  historyItemTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E293B",
  },
  historyItemSubtitle: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "700",
    marginTop: 2,
  },
});
