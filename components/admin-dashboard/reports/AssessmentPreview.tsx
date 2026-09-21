import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

interface Props {
  primary: string;
  studentName: string;
  className: string;
  classIdState: string;
  academicYearState: string;
  reportNumber?: number;
  reportType: string;
  overallPosition: string;
  subjectsData: any[];
  TRS: string | number;
  TAS: string | number;
  AGGREGATE: string | number;
  teacherRemarks: string;
  adminSig: any;
}

export const AssessmentPreview: React.FC<Props> = ({
  primary,
  studentName,
  className,
  classIdState,
  academicYearState,
  reportNumber,
  reportType,
  overallPosition,
  subjectsData,
  TRS,
  TAS,
  AGGREGATE,
  teacherRemarks,
  adminSig,
}) => {
  const typeLabel = reportType === "Trial Test" ? "TEST" : reportType === "Mid-Term" ? "MID-TERM" : "CAT";
  const assessmentTitle = reportType === "Mid-Term" ? "MID-TERM" : `${typeLabel} ${reportNumber || 1}`;

  return (
    <View>
      <View style={styles.reportTitleContainer}>
        <Text style={styles.reportTitleText}>{assessmentTitle} PROGRESS REPORT</Text>
      </View>

      <View style={styles.paperInfoGrid}>
        {[
          { label: "STUDENT NAME", value: studentName },
          { label: "CLASS / GRADE", value: className || classIdState },
          { label: "ACADEMIC YEAR", value: academicYearState },
          { label: "ASSESSMENT", value: assessmentTitle },
          { label: "OVERALL POSITION", value: overallPosition, highlight: true },
          { label: "TERM AVG", value: String(TAS) },
        ].map((item, idx) => (
          <View key={idx} style={styles.paperInfoItem}>
            <View style={styles.paperInfoLabelContainer}>
              <Text style={styles.paperInfoLabel}>{item.label}</Text>
            </View>
            <View style={styles.paperInfoValueContainer}>
              <Text style={[styles.paperInfoValue, item.highlight && { color: "#e11d48", fontWeight: "900" }]}>
                {(item.value || "N/A").toUpperCase()}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.paperTable}>
        <View style={[styles.paperTableHeader, { backgroundColor: primary }]}>
          <Text style={[styles.paperHeaderCell, { flex: 2, textAlign: "left" }]}>SUBJECT</Text>
          <Text style={styles.paperHeaderCell}>SCORE</Text>
          <Text style={[styles.paperHeaderCell, { flex: 1.5 }]}>GRADE</Text>
        </View>
        {!subjectsData || subjectsData.length === 0 ? (
          <View style={{ padding: 20, alignItems: "center" }}><Text style={{ color: "#94A3B8" }}>No records found</Text></View>
        ) : (
          subjectsData.map((s, i) => (
            <View key={i} style={[styles.paperTableRow, i % 2 !== 0 && { backgroundColor: "#F8FAFC" }]}>
              <Text style={[styles.paperCell, { flex: 2, textAlign: "left", fontWeight: "800" }]}>{s.subject}</Text>
              <Text style={[styles.paperCell, { fontWeight: "900", color: primary }]}>
                {isNaN(Number(s.total)) ? s.total : Number(s.total).toFixed(1)}
              </Text>
              <Text style={[styles.paperCell, { flex: 1.5, fontWeight: "700" }]}>{s.grade} ({s.remark})</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.paperSummaryRow}>
        <View style={styles.summaryContainer}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>TOTAL SCORE</Text>
            <Text style={styles.summaryValue}>{TRS}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>TERM AVG</Text>
            <Text style={[styles.summaryValue, { color: primary }]}>{TAS}</Text>
          </View>
        </View>
      </View>

      <View style={styles.paperRemarksSection}>
        <View style={styles.remarksBox}>
          <View style={styles.remarksHeader}>
            <Text style={styles.remarksHeaderTitle}>REMARKS</Text>
          </View>
          <Text style={styles.remarksText}>{teacherRemarks || "GOOD PROGRESS SO FAR. KEEP IT UP."}</Text>
        </View>

        <View style={styles.paperSigRow}>
          <View style={styles.paperSigItem}>
            {adminSig ? (
              <Image source={typeof adminSig === "string" ? { uri: adminSig } : adminSig} style={styles.paperSigImg} />
            ) : (
              <View style={styles.paperSigSpace} />
            )}
            <View style={styles.paperSigLine} />
            <Text style={styles.paperSigLabel}>HEAD OF INSTITUTION / ADMIN</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  reportTitleContainer: { backgroundColor: "#1E293B", paddingVertical: 8, alignItems: "center", marginBottom: 15 },
  reportTitleText: { color: "#fff", fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  paperInfoGrid: { flexDirection: "row", flexWrap: "wrap", borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 20, borderRadius: 4, overflow: "hidden" },
  paperInfoItem: { width: "33.33%", borderRightWidth: 1, borderBottomWidth: 1, borderColor: "#E2E8F0" },
  paperInfoLabelContainer: { backgroundColor: "#F8FAFC", paddingVertical: 4, paddingHorizontal: 8, borderBottomWidth: 1, borderColor: "#F1F5F9" },
  paperInfoLabel: { fontSize: 7, fontWeight: "900", color: "#64748B", letterSpacing: 0.5 },
  paperInfoValueContainer: { paddingVertical: 6, paddingHorizontal: 8, minHeight: 30, justifyContent: "center" },
  paperInfoValue: { fontSize: 10, fontWeight: "700", color: "#1E293B" },
  paperTable: { borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 10, borderRadius: 4, overflow: "hidden" },
  paperTableHeader: { flexDirection: "row", backgroundColor: "#1E293B", borderBottomWidth: 1, borderColor: "#E2E8F0" },
  paperHeaderCell: { flex: 1, padding: 8, fontSize: 10, textAlign: "center", color: "#fff", fontWeight: "900" },
  paperTableRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#F1F5F9" },
  paperCell: { flex: 1, padding: 8, fontSize: 10, textAlign: "center", color: "#475569" },
  paperSummaryRow: { marginBottom: 20 },
  summaryContainer: { flexDirection: "row", backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 6, padding: 10, justifyContent: "space-between" },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryLabel: { fontSize: 8, fontWeight: "900", color: "#64748B", marginBottom: 2 },
  summaryValue: { fontSize: 14, fontWeight: "900", color: "#1E293B" },
  summaryDivider: { width: 1, height: "100%", backgroundColor: "#E2E8F0", marginHorizontal: 5 },
  paperRemarksSection: { paddingTop: 5, marginBottom: 15 },
  remarksBox: { marginBottom: 12, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 4, overflow: "hidden" },
  remarksHeader: { backgroundColor: "#F8FAFC", paddingVertical: 4, paddingHorizontal: 8, borderBottomWidth: 1, borderColor: "#E2E8F0" },
  remarksHeaderTitle: { fontSize: 7, fontWeight: "900", color: "#64748B" },
  remarksText: { padding: 8, fontSize: 10, color: "#475569", fontStyle: "italic", lineHeight: 14 },
  paperSigRow: { flexDirection: "row", justifyContent: "center", marginTop: 15 },
  paperSigItem: { width: 200, alignItems: "center" },
  paperSigImg: { width: "100%", height: 80, resizeMode: "contain", marginBottom: -5 },
  paperSigSpace: { height: 80 },
  paperSigLine: { width: "100%", height: 1, backgroundColor: "#1E293B", marginTop: 2, marginBottom: 4 },
  paperSigLabel: { fontSize: 7, fontWeight: "800", color: "#64748B" },
});
