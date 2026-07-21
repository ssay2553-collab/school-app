import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../SVGIcon";
import { getGradeDetails } from "../../lib/classHelpers";
import { useToast } from "../../contexts/ToastContext";

export type ReportType = "End of Term" | "Mid-Term" | "Mock Exams";

interface StudentScoreCardProps {
  item: any;
  onUpdateRef: (id: string, updated: any) => void;
  primary: string;
  reportType: ReportType;
}

export const StudentScoreCard = React.memo(
  ({
    item,
    onUpdateRef,
    primary,
    reportType,
  }: StudentScoreCardProps) => {
    const { showToast } = useToast();
    const [localItem, setLocalItem] = useState(item);

    useEffect(() => {
      setLocalItem(item);
    }, [item]);

    const handleUpdate = (field: string, v: string) => {
      setLocalItem((prev: any) => {
        const updated = { ...prev, [field]: v };
        if (reportType === "End of Term") {
          if (field === "classScore" && parseFloat(v) > 50) {
            return prev;
          }
          const classScoreRaw = parseFloat(updated.classScore) || 0;
          updated.classScore50 = classScoreRaw.toFixed(2);
          const examsMark = parseFloat(updated.examsMark) || 0;
          updated.exam50 = (examsMark * 0.5).toFixed(2);
          updated.finalScore = (
            parseFloat(updated.classScore50) + parseFloat(updated.exam50)
          ).toFixed(2);
          const gradeInfo = getGradeDetails(parseFloat(updated.finalScore));
          updated.grade = gradeInfo.grade;
          updated.remarks = gradeInfo.remark;
        } else {
          const examsMark = parseFloat(updated.examsMark) || 0;
          updated.finalScore = examsMark.toFixed(2);
          const gradeInfo = getGradeDetails(examsMark);
          updated.grade = gradeInfo.grade;
          updated.remarks = gradeInfo.remark;
          updated.classScore = "";
          updated.classScore50 = "0";
          updated.exam50 = "0";
        }

        // Notify parent of the update to trigger unsaved changes state
        onUpdateRef(item.studentId, updated);
        return updated;
      });
    };

    const isModified = useMemo(() => {
      return JSON.stringify(localItem) !== JSON.stringify(item);
    }, [localItem, item]);

    return (
      <Animatable.View
        animation="fadeInUp"
        duration={500}
        style={[
          styles.card,
          isModified && { borderColor: primary, borderWidth: 1.5, shadowColor: primary, shadowOpacity: 0.1 }
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.avatarBox, { backgroundColor: primary + "15" }]}>
            <Text style={[styles.avatarText, { color: primary }]}>
              {localItem.fullName?.charAt(0) || "S"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.studentName}>{localItem.fullName}</Text>
              {isModified && (
                <View style={[styles.modifiedDot, { backgroundColor: primary }]} />
              )}
            </View>
            <View style={styles.idBadge}>
              <Text style={styles.studentIdLabel}>ID: {localItem.studentId}</Text>
            </View>
          </View>
          {localItem.grade ? (
            <View style={[styles.gradeBadge, { backgroundColor: "#f0f9ff" }]}>
              <Text style={[styles.gradeBadgeText, { color: "#0284c7" }]}>
                {localItem.grade}
              </Text>
            </View>
          ) : null}
        </View>

        {reportType === "End of Term" ? (
          <View style={styles.scoreGrid}>
            <View style={styles.gridSection}>
              <View style={styles.sectionHeaderRow}>
                <SVGIcon name="document-text-outline" size={14} color="#64748B" />
                <Text style={styles.sectionLabel}>
                  CLASS ASSESSMENT
                </Text>
              </View>
              <View style={styles.gridRow}>
                <View style={[styles.inputCol, { flex: 2 }]}>
                  <Text style={styles.miniHeader}>SCORE (MAX 50)</Text>
                  <TextInput
                    style={styles.gridInput}
                    keyboardType="numeric"
                    value={String(localItem.classScore || "")}
                    placeholder="0.00"
                    selectTextOnFocus
                    onChangeText={(v) => {
                      if (parseFloat(v) > 50) {
                        showToast({ message: "Class Score must not be above 50%", type: "error" });
                        return;
                      }
                      handleUpdate("classScore", v);
                    }}
                  />
                </View>
                <View style={styles.valueCol}>
                  <Text style={styles.miniHeader}>50% WT</Text>
                  <View
                    style={[
                      styles.gridValueBox,
                      { backgroundColor: primary + "10" },
                    ]}
                  >
                    <Text style={[styles.gridValueText, { color: primary }]}>
                      {localItem.classScore50}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.gridDivider} />

            <View style={styles.gridSection}>
              <View style={styles.sectionHeaderRow}>
                <SVGIcon name="school-outline" size={14} color="#64748B" />
                <Text style={styles.sectionLabel}>FINAL EXAMINATION</Text>
              </View>
              <View style={styles.gridRow}>
                <View style={[styles.inputCol, { flex: 1.5 }]}>
                  <Text style={styles.miniHeader}>EXAMS (100)</Text>
                  <TextInput
                    style={[styles.gridInput]}
                    keyboardType="numeric"
                    value={String(localItem.examsMark || "")}
                    placeholder="0.00"
                    selectTextOnFocus
                    onChangeText={(v) => handleUpdate("examsMark", v)}
                  />
                </View>
                <View style={styles.valueCol}>
                  <Text style={styles.miniHeader}>50% WT</Text>
                  <View
                    style={[
                      styles.gridValueBox,
                      { backgroundColor: "#ecfdf5" }]}
                  >
                    <Text style={[styles.gridValueText, { color: "#059669" }]}>
                      {localItem.exam50}
                    </Text>
                  </View>
                </View>
                <View style={styles.valueCol}>
                  <Text style={styles.miniHeader}>TOTAL</Text>
                  <View
                    style={[
                      styles.gridValueBox,
                      { backgroundColor: "#fffbeb" }]}
                  >
                    <Text style={[styles.gridValueText, { color: "#d97706" }]}>
                      {localItem.finalScore}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.scoreGrid}>
            <View style={styles.sectionHeaderRow}>
              <SVGIcon name="analytics-outline" size={14} color="#64748B" />
              <Text style={styles.sectionLabel}>RAW SCORE ASSESSMENT</Text>
            </View>
            <View style={styles.gridRow}>
              <View style={{ flex: 2 }}>
                <Text style={styles.miniHeader}>EXAMINATION SCORE (100)</Text>
                <TextInput
                  style={[
                    styles.gridInput,
                    {
                      height: 48,
                      fontSize: 18,
                      textAlign: "left",
                      paddingHorizontal: 15,
                    },
                  ]}
                  keyboardType="numeric"
                  value={String(localItem.examsMark || "")}
                  onChangeText={(v) => handleUpdate("examsMark", v)}
                  placeholder="0.00"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 15 }}>
                <Text style={styles.miniHeader}>GRADE</Text>
                <View
                  style={[
                    styles.gridValueBox,
                    { height: 48, backgroundColor: "#f0f9ff" },
                  ]}
                >
                  <Text
                    style={[
                      styles.gridValueText,
                      { color: "#0284c7", fontSize: 20 },
                    ]}
                  >
                    {localItem.grade}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {localItem.teacherRemarks ? (
          <View style={[styles.remarksBox, { borderLeftColor: primary }]}>
            <Text style={styles.remarksLabel}>TEACHER&apos;S REMARKS</Text>
            <Text style={styles.remarksText}>{localItem.teacherRemarks}</Text>
          </View>
        ) : null}
      </Animatable.View>
    );
  },
);

StudentScoreCard.displayName = "StudentScoreCard";

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 20,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  avatarBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  avatarText: { fontSize: 20, fontWeight: "900" },
  modifiedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  studentName: { fontSize: 17, fontWeight: "800", color: "#1E293B" },
  studentIdLabel: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "600",
    marginTop: 2,
  },
  idBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  gradeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    minWidth: 40,
    alignItems: "center",
  },
  gradeBadgeText: {
    fontSize: 16,
    fontWeight: "900",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  scoreGrid: { marginTop: 0 },
  gridSection: { marginBottom: 15 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#64748B",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  gridRow: { flexDirection: "row", gap: 10 },
  inputCol: { flex: 1 },
  valueCol: { flex: 1, alignItems: "center" },
  miniHeader: {
    fontSize: 8,
    fontWeight: "900",
    color: "#94A3B8",
    textAlign: "center",
    marginBottom: 5,
    textTransform: "uppercase",
  },
  gridInput: {
    height: 40,
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    textAlign: "center",
    fontWeight: "900",
    fontSize: 14,
    color: "#1E293B",
  },
  gridValueBox: {
    height: 40,
    width: "100%",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  gridValueText: { fontSize: 13, fontWeight: "900" },
  gridDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 15,
    borderStyle: "dashed",
    borderRadius: 1,
  },
  remarksBox: {
    marginTop: 5,
    padding: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderLeftWidth: 4,
  },
  remarksLabel: {
    fontSize: 8,
    fontWeight: "900",
    color: "#94A3B8",
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  remarksText: {
    fontSize: 12,
    color: "#475569",
    fontStyle: "italic",
    fontWeight: "600",
  },
});
