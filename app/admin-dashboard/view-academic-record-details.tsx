import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import SVGIcon from "../../components/SVGIcon";
import { AcademicReportPreview } from "../../components/admin-dashboard/AcademicReportPreview";
import {
  ReportType,
  useAcademicRecordDetails,
} from "../../hooks/admin-dashboard/useAcademicRecordDetails";
import { useRef, useEffect } from "react";

export default function ViewAcademicRecordDetails() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const reportType = (params.reportType as ReportType) || "End of Term";
  const isNavigating = useRef(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const handleBack = () => {
    if (isNavigating.current) return;
    isNavigating.current = true;
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/admin-dashboard/view-academic-records");
    }
  };

  const {
    loading,
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
    primary,
    schoolLogo,
    isFullReport,
    TRS,
    TAS,
    AGGREGATE,
    generatePDF,
    classIdState,
    academicYearState,
    refreshing,
    refresh,
    isReportApproved,
    reportStatus,
  } = useAcademicRecordDetails();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navBar}>
        <View style={styles.navLeft}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backBtn}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <SVGIcon name="arrow-back" size={24} color="#1E293B" />
          </TouchableOpacity>
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={styles.navTitle}>Report Preview</Text>
              {!loading && (
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: isReportApproved ? "#DCFCE7" : "#FEF3C7",
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: isReportApproved ? "#22C55E" : "#F59E0B" },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusBadgeText,
                      { color: isReportApproved ? "#166534" : "#92400E" },
                    ]}
                  >
                    {reportStatus.toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.navSubtitle}>
              {studentName || "Academic Record"}
            </Text>
          </View>
        </View>

        <View style={styles.navRight}>
          <TouchableOpacity
            onPress={refresh}
            style={styles.iconBtn}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#64748B" />
            ) : (
              <SVGIcon name="refresh" size={20} color="#64748B" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={generatePDF}
            style={[styles.downloadHeaderBtn, { backgroundColor: primary }]}
            disabled={generating}
          >
            {generating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <SVGIcon name="download" size={18} color="#fff" />
                <Text style={styles.downloadHeaderText}>GENERATE PDF</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primary} />
          <Text style={styles.loadingText}>Loading report details...</Text>
        </View>
      ) : (
        <AcademicReportPreview
          primary={primary}
          schoolLogo={schoolLogo}
          reportType={reportType}
          studentName={studentName}
          className={className}
          classIdState={classIdState}
          academicYearState={academicYearState}
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
          generating={generating}
          generatePDF={generatePDF}
          refreshing={refreshing}
          refresh={refresh}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  navBar: {
    height: 70,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    zIndex: 10,
  },
  navLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  navRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  navTitle: { fontSize: 16, fontWeight: "900", color: "#1E293B" },
  navSubtitle: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
    marginTop: -2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  downloadHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 8,
  },
  downloadHeaderText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 15,
  },
  loadingText: { fontSize: 14, color: "#64748B", fontWeight: "600" },
});
