import React from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { SHADOWS } from "../../constants/theme";
import SVGIcon from "../SVGIcon";

interface AcademicReportPreviewProps {
  primary: string;
  schoolLogo: any;
  reportType: string;
  studentName: string;
  className: string;
  classIdState: string;
  academicYearState: string;
  overallPosition: string;
  attendance: string;
  isFullReport: boolean;
  subjectsData: any[];
  TRS: string | number;
  TAS: string | number;
  AGGREGATE: string | number;
  isPreschool: boolean;
  conduct: string;
  attitude: string;
  interest: string;
  physicalDev: any;
  preschoolAssessments: Record<string, string>;
  teacherRemarks: string;
  adminRemarks: string;
  nextTermBegins: string;
  promotedTo: string;
  adminSig: any;
  isReportApproved?: boolean;
  generating: boolean;
  generatePDF: () => void;
  refreshing?: boolean;
  refresh?: () => void;
  hideDownload?: boolean;
}

export const AcademicReportPreview: React.FC<AcademicReportPreviewProps> = ({
  primary,
  schoolLogo,
  reportType,
  studentName,
  className,
  classIdState,
  academicYearState,
  overallPosition,
  attendance,
  isFullReport,
  subjectsData,
  TRS,
  TAS,
  AGGREGATE,
  isPreschool,
  conduct,
  attitude,
  interest,
  physicalDev,
  preschoolAssessments,
  teacherRemarks,
  adminRemarks,
  nextTermBegins,
  promotedTo,
  adminSig,
  isReportApproved = false,
  generating,
  generatePDF,
  refreshing,
  refresh,
  hideDownload = false,
}) => {
  return (
    <ScrollView
      contentContainerStyle={{ padding: 15 }}
      refreshControl={
        refresh && (
          <RefreshControl
            refreshing={refreshing || false}
            onRefresh={refresh}
            colors={[primary]}
            tintColor={primary}
          />
        )
      }
    >
      <Animatable.View animation="fadeInUp" duration={600} style={styles.paper}>
        {/* Draft Watermark */}
        {!isReportApproved && (
          <View style={styles.watermarkContainer} pointerEvents="none">
            <Text style={styles.watermarkText}>DRAFT</Text>
          </View>
        )}

        {/* Letterhead */}
        <View style={styles.paperLetterhead}>
          {schoolLogo && (
            <>
              <Image
                source={schoolLogo}
                style={styles.paperLogo}
                resizeMode="contain"
              />
              <View style={styles.verticalDivider} />
            </>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.paperSchoolName, { color: primary }]}>
              {SCHOOL_CONFIG.fullName.toUpperCase()}
            </Text>
            {SCHOOL_CONFIG.motto && (
              <Text style={styles.paperSchoolMotto}>
                "{SCHOOL_CONFIG.motto}"
              </Text>
            )}
            <Text style={styles.paperSchoolInfo}>{SCHOOL_CONFIG.address}</Text>
            <Text style={styles.paperSchoolContact}>
              {SCHOOL_CONFIG.hotline ? `Tel: ${SCHOOL_CONFIG.hotline}` : ""}
              {SCHOOL_CONFIG.hotline && SCHOOL_CONFIG.email ? "  |  " : ""}
              {SCHOOL_CONFIG.email ? `Email: ${SCHOOL_CONFIG.email}` : ""}
            </Text>
          </View>
        </View>

        <View style={styles.headerSeparatorContainer}>
          <View
            style={[styles.headerSeparatorPrimary, { backgroundColor: primary }]}
          />
          <View
            style={[
              styles.headerSeparatorSecondary,
              { backgroundColor: "#fb7185" },
            ]}
          />
        </View>

        <View style={styles.reportTitleContainer}>
          <Text style={styles.reportTitleText}>
            {reportType.toUpperCase()} PROGRESS REPORT
          </Text>
        </View>

        <View style={styles.paperInfoGrid}>
          {[
            { label: "STUDENT NAME", value: studentName },
            { label: "CLASS / GRADE", value: className || classIdState },
            { label: "ACADEMIC YEAR", value: academicYearState },
            { label: "TERM / PERIOD", value: reportType },
            { label: "OVERALL POSITION", value: overallPosition, highlight: true },
            { label: "ATTENDANCE", value: attendance || "N/A" },
          ].map((item, idx) => (
            <View key={idx} style={styles.paperInfoItem}>
              <View style={styles.paperInfoLabelContainer}>
                <Text style={styles.paperInfoLabel}>{item.label}</Text>
              </View>
              <View style={styles.paperInfoValueContainer}>
                <Text
                  style={[
                    styles.paperInfoValue,
                    item.highlight && { color: "#e11d48", fontWeight: "900" },
                  ]}
                >
                  {(item.value || "N/A").toUpperCase()}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Table */}
        <View style={styles.paperTable}>
          <View style={[styles.paperTableHeader, { backgroundColor: primary }]}>
            <Text
              style={[styles.paperHeaderCell, { flex: 2, textAlign: "left" }]}
            >
              SUBJECT
            </Text>
            {isFullReport && (
              <>
                <Text style={styles.paperHeaderCell}>CLS</Text>
                <Text style={styles.paperHeaderCell}>EXM</Text>
              </>
            )}
            <Text style={styles.paperHeaderCell}>TOT</Text>
            <Text style={styles.paperHeaderCell}>GRD</Text>
            <Text style={[styles.paperHeaderCell, { flex: 1.5 }]}>REMARK</Text>
          </View>
          {subjectsData.length === 0 ? (
            <View style={{ padding: 20, alignItems: "center" }}>
              <Text style={{ color: "#94A3B8" }}>No records found</Text>
            </View>
          ) : (
            subjectsData.map((s, i) => (
              <View
                key={i}
                style={[
                  styles.paperTableRow,
                  i % 2 !== 0 && { backgroundColor: "#F8FAFC" },
                ]}
              >
                <Text
                  style={[
                    styles.paperCell,
                    { flex: 2, textAlign: "left", fontWeight: "800" },
                  ]}
                >
                  {s.subject}
                </Text>
                {isFullReport && (
                  <>
                    <Text style={styles.paperCell}>
                      {isNaN(Number(s.classScore))
                        ? s.classScore
                        : Number(s.classScore).toFixed(0)}
                    </Text>
                    <Text style={styles.paperCell}>
                      {isNaN(Number(s.examsScore))
                        ? s.examsScore
                        : Number(s.examsScore).toFixed(0)}
                    </Text>
                  </>
                )}
                <Text
                  style={[
                    styles.paperCell,
                    { fontWeight: "900", color: primary },
                  ]}
                >
                  {isNaN(Number(s.total))
                    ? s.total
                    : Number(s.total).toFixed(1)}
                </Text>
                <Text style={[styles.paperCell, { fontWeight: "700" }]}>
                  {s.grade}
                </Text>
                <Text style={[styles.paperCell, { flex: 1.5, fontSize: 8 }]}>
                  {s.remark}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Summary Sections */}
        <View style={styles.paperSummaryRow}>
          <View style={styles.summaryContainer}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>TOTAL RAW SCORE</Text>
              <Text style={styles.summaryValue}>{TRS}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>AVERAGE SCORE</Text>
              <Text style={styles.summaryValue}>{TAS}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>OVERALL AGGREGATE</Text>
              <Text style={[styles.summaryValue, { color: "#e11d48" }]}>
                {AGGREGATE}
              </Text>
            </View>
          </View>
        </View>

        {isPreschool && preschoolAssessments && (
          <View style={styles.paperRemarksSection}>
            <View style={styles.remarksBox}>
              <View style={styles.remarksHeader}>
                <Text style={styles.remarksHeaderTitle}>DEVELOPMENTAL & SKILLS ASSESSMENT</Text>
              </View>
              <View style={[styles.behaviorGrid, { flexWrap: 'wrap', gap: 10 }]}>
                {Object.entries(preschoolAssessments).map(([skill, rating], idx) => (
                  <View key={idx} style={{ width: '47%', borderBottomWidth: 0.5, borderBottomColor: '#F1F5F9', paddingVertical: 4, flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={[styles.behaviorLabel, { marginBottom: 0, fontSize: 6 }]}>{skill.toUpperCase()}</Text>
                    <Text style={[styles.behaviorValue, { color: primary, fontSize: 8 }]}>{String(rating).toUpperCase()}</Text>
                  </View>
                ))}
              </View>
            </View>

            {physicalDev && (
              <View style={styles.remarksBox}>
                <View style={styles.remarksHeader}>
                  <Text style={styles.remarksHeaderTitle}>PHYSICAL DEVELOPMENT</Text>
                </View>
                <View style={styles.behaviorGrid}>
                  <View style={styles.behaviorItem}>
                    <Text style={styles.behaviorLabel}>HEIGHT (CM)</Text>
                    <Text style={styles.behaviorValue}>{physicalDev.height || "-"}</Text>
                  </View>
                  <View style={styles.behaviorItem}>
                    <Text style={styles.behaviorLabel}>WEIGHT (KG)</Text>
                    <Text style={styles.behaviorValue}>{physicalDev.weight || "-"}</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        <View style={styles.paperRemarksSection}>
          {isFullReport && !isPreschool && (
            <View style={styles.remarksBox}>
              <View style={styles.remarksHeader}>
                <Text style={styles.remarksHeaderTitle}>BEHAVIORAL RATINGS</Text>
              </View>
              <View style={styles.behaviorGrid}>
                <View style={styles.behaviorItem}>
                  <Text style={styles.behaviorLabel}>CONDUCT</Text>
                  <Text style={styles.behaviorValue}>{conduct.toUpperCase()}</Text>
                </View>
                <View style={styles.behaviorItem}>
                  <Text style={styles.behaviorLabel}>ATTITUDE</Text>
                  <Text style={styles.behaviorValue}>{attitude.toUpperCase()}</Text>
                </View>
                <View style={styles.behaviorItem}>
                  <Text style={styles.behaviorLabel}>INTEREST</Text>
                  <Text style={styles.behaviorValue}>{interest.toUpperCase()}</Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.remarksBox}>
            <View style={styles.remarksHeader}>
              <Text style={styles.remarksHeaderTitle}>TEACHER'S REMARKS</Text>
            </View>
            <Text style={styles.remarksText}>
              {teacherRemarks || "SATISFACTORY PERFORMANCE."}
            </Text>
          </View>

          <View style={styles.remarksBox}>
            <View style={styles.remarksHeader}>
              <Text style={styles.remarksHeaderTitle}>ADMINISTRATIVE REMARKS</Text>
            </View>
            <Text style={styles.remarksText}>
              {adminRemarks || "KEEP UP THE HARD WORK."}
            </Text>
          </View>

          <View style={styles.statusBox}>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>NEXT TERM BEGINS:</Text>
              <Text style={styles.statusValue}>
                {nextTermBegins.toUpperCase() || "TBA"}
              </Text>
            </View>
            {isFullReport && promotedTo ? (
              <View style={[styles.statusItem, { alignItems: "flex-end" }]}>
                <Text style={styles.statusLabel}>PROMOTED TO:</Text>
                <Text style={[styles.statusValue, { color: "#059669" }]}>
                  {promotedTo.toUpperCase()}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.paperSigRow}>
            <View style={{ flex: 1 }} />
            <View style={styles.paperSigItem}>
              {adminSig ? (
                <Image
                  source={
                    typeof adminSig === "string" ? { uri: adminSig } : adminSig
                  }
                  style={styles.paperSigImg}
                />
              ) : (
                <View style={styles.paperSigSpace} />
              )}
              <View style={styles.paperSigLine} />
              <Text style={styles.paperSigLabel}>HEAD OF INSTITUTION / ADMIN</Text>
            </View>
          </View>
        </View>

        {!hideDownload && (
          <TouchableOpacity
            style={[styles.downloadBtn, { backgroundColor: primary }]}
            onPress={generatePDF}
            disabled={generating}
          >
            {generating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <SVGIcon name="download" size={20} color="#fff" />
                <Text style={styles.downloadBtnText}>
                  Generate Official PDF
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </Animatable.View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  paper: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 4,
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    position: "relative",
    overflow: "hidden",
  },
  watermarkContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    transform: [{ rotate: "-35deg" }],
  },
  watermarkText: {
    fontSize: 120,
    fontWeight: "900",
    color: "rgba(226, 232, 240, 0.4)",
    letterSpacing: 10,
  },
  paperLetterhead: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  paperLogo: { width: 65, height: 65 },
  verticalDivider: {
    width: 1,
    height: 45,
    backgroundColor: "#E2E8F0",
    marginHorizontal: 15,
  },
  paperSchoolName: { fontSize: 16, fontWeight: "900" },
  paperSchoolMotto: {
    fontSize: 9,
    fontStyle: "italic",
    color: "#64748B",
    marginTop: 2,
  },
  paperSchoolInfo: {
    fontSize: 9,
    color: "#475569",
    marginTop: 2,
  },
  paperSchoolContact: {
    fontSize: 9,
    color: "#475569",
    marginTop: 2,
  },
  headerSeparatorContainer: {
    marginBottom: 15,
  },
  headerSeparatorPrimary: {
    height: 2,
    width: "100%",
  },
  headerSeparatorSecondary: {
    height: 1,
    width: "100%",
    marginTop: 2,
  },
  reportTitleContainer: {
    backgroundColor: "#1E293B",
    paddingVertical: 8,
    alignItems: "center",
    marginBottom: 15,
  },
  reportTitleText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },
  paperDivider: { height: 2, backgroundColor: "#1E293B", marginVertical: 10 },
  paperInfoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 20,
    borderRadius: 4,
    overflow: "hidden",
  },
  paperInfoItem: {
    width: "33.33%",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
  },
  paperInfoLabelContainer: {
    backgroundColor: "#F8FAFC",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
  },
  paperInfoLabel: {
    fontSize: 7,
    fontWeight: "900",
    color: "#64748B",
    letterSpacing: 0.5,
  },
  paperInfoValueContainer: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    minHeight: 30,
    justifyContent: "center",
  },
  paperInfoValue: {
    fontSize: 10,
    fontWeight: "700",
    color: "#1E293B",
  },
  paperTable: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 10,
    borderRadius: 4,
    overflow: "hidden",
  },
  paperTableHeader: {
    flexDirection: "row",
    backgroundColor: "#1E293B",
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
  },
  paperTableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
  },
  paperCell: {
    flex: 1,
    padding: 8,
    fontSize: 10,
    textAlign: "center",
    color: "#475569",
  },
  paperHeaderCell: {
    flex: 1,
    padding: 8,
    fontSize: 10,
    textAlign: "center",
    color: "#fff",
    fontWeight: "900",
  },
  paperSummaryRow: {
    marginBottom: 20,
  },
  summaryContainer: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 6,
    padding: 10,
    justifyContent: "space-between",
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 8,
    fontWeight: "900",
    color: "#64748B",
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "900",
    color: "#1E293B",
  },
  summaryDivider: {
    width: 1,
    height: "100%",
    backgroundColor: "#E2E8F0",
    marginHorizontal: 5,
  },
  paperRemarksSection: {
    paddingTop: 5,
    marginBottom: 15,
  },
  remarksBox: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 4,
    overflow: "hidden",
  },
  remarksHeader: {
    backgroundColor: "#F8FAFC",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
  },
  remarksHeaderTitle: {
    fontSize: 7,
    fontWeight: "900",
    color: "#64748B",
  },
  remarksText: {
    padding: 8,
    fontSize: 10,
    color: "#475569",
    fontStyle: "italic",
    lineHeight: 14,
  },
  behaviorGrid: {
    flexDirection: "row",
    padding: 8,
    gap: 15,
  },
  behaviorItem: {
    flex: 1,
  },
  behaviorLabel: {
    fontSize: 7,
    fontWeight: "900",
    color: "#94A3B8",
    marginBottom: 2,
  },
  behaviorValue: {
    fontSize: 10,
    fontWeight: "700",
    color: "#1E293B",
  },
  statusBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#F0FDFA",
    borderWidth: 1,
    borderColor: "#CCFBF1",
    padding: 10,
    borderRadius: 4,
    marginTop: 5,
  },
  statusItem: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 7,
    fontWeight: "900",
    color: "#0D9488",
    marginBottom: 2,
  },
  statusValue: {
    fontSize: 10,
    fontWeight: "900",
    color: "#0F766E",
  },
  paperSectionTitle: {
    fontSize: 9,
    fontWeight: "900",
    color: "#1E293B",
    textDecorationLine: "underline",
    marginBottom: 5,
  },
  paperRemarkLine: { fontSize: 11, color: "#475569" },
  paperRemarkText: { fontSize: 11, color: "#475569", fontStyle: "italic" },
  paperNextTerm: { flexDirection: "row", marginTop: 10, gap: 5 },
  paperNextTermLabel: { fontSize: 10, fontWeight: "900" },
  paperNextTermVal: { fontSize: 10, fontWeight: "700", color: "#2e86de" },
  paperSigRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
  },
  paperSigItem: { width: 150, alignItems: "center" },
  paperSigImg: {
    width: "100%",
    height: 60,
    resizeMode: "contain",
    marginBottom: -5,
  },
  paperSigSpace: { height: 60 },
  paperSigLine: {
    width: "100%",
    height: 1,
    backgroundColor: "#1E293B",
    marginTop: 2,
    marginBottom: 4,
  },
  paperSigLabel: { fontSize: 7, fontWeight: "800", color: "#64748B" },
  downloadBtn: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  downloadBtnText: {
    color: "#fff",
    fontWeight: "900",
    marginLeft: 10,
    fontSize: 14,
  },
});
