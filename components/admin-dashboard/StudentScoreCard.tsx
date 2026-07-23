import React, { useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet, Text, TextInput, View } from "react-native";
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
  isModified?: boolean;
}

export const StudentScoreCard = React.memo(
  ({
    item,
    onUpdateRef,
    primary,
    reportType,
    isModified = false,
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

    return (
      <Animatable.View
        animation="fadeInUp"
        duration={500}
        style={[
          styles.card,
          isModified && { borderColor: primary, borderWidth: 1.5, backgroundColor: "#fff" }
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.avatarBox, { backgroundColor: primary + "10" }]}>
            <Text style={[styles.avatarText, { color: primary }]}>
              {localItem.fullName?.charAt(0) || "S"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.studentName} numberOfLines={1}>{localItem.fullName}</Text>
              {isModified && (
                <View style={[styles.modifiedBadge, { backgroundColor: primary }]}>
                  <Text style={styles.modifiedText}>EDITED</Text>
                </View>
              )}
            </View>
            <Text style={styles.studentIdLabel}>ID: {localItem.studentId}</Text>
          </View>
          <View style={styles.headerRight}>
             {localItem.grade ? (
              <View style={[styles.gradeBadge, { backgroundColor: "#EEF2FF" }]}>
                <Text style={[styles.gradeBadgeText, { color: "#4F46E5" }]}>
                  {localItem.grade}
                </Text>
              </View>
            ) : null}
            {localItem.position && (
               <View style={styles.positionBadge}>
                  <SVGIcon name="ribbon" size={12} color="#94A3B8" />
                  <Text style={styles.positionText}>{localItem.position}</Text>
               </View>
            )}
          </View>
        </View>

        {reportType === "End of Term" ? (
          <View style={styles.scoreGrid}>
            <View style={styles.gridRow}>
              <View style={styles.inputSection}>
                <Text style={styles.sectionLabel}>CLASS (50%)</Text>
                <TextInput
                  style={styles.scoreInput}
                  keyboardType="numeric"
                  value={String(localItem.classScore || "")}
                  placeholder="0.0"
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

              <View style={styles.inputSection}>
                <Text style={styles.sectionLabel}>EXAMS (100)</Text>
                <TextInput
                  style={styles.scoreInput}
                  keyboardType="numeric"
                  value={String(localItem.examsMark || "")}
                  placeholder="0.0"
                  selectTextOnFocus
                  onChangeText={(v) => handleUpdate("examsMark", v)}
                />
              </View>

              <View style={styles.totalSection}>
                <Text style={styles.sectionLabel}>FINAL</Text>
                <View style={[styles.totalBox, { backgroundColor: primary + "08" }]}>
                  <Text style={[styles.totalText, { color: primary }]}>{localItem.finalScore || "0.00"}</Text>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.scoreGrid}>
            <View style={styles.gridRow}>
              <View style={[styles.inputSection, { flex: 2 }]}>
                <Text style={styles.sectionLabel}>EXAMINATION SCORE (100)</Text>
                <TextInput
                  style={[styles.scoreInput, { textAlign: 'left', paddingLeft: 15 }]}
                  keyboardType="numeric"
                  value={String(localItem.examsMark || "")}
                  onChangeText={(v) => handleUpdate("examsMark", v)}
                  placeholder="0.00"
                />
              </View>
              <View style={[styles.totalSection, { flex: 1 }]}>
                <Text style={styles.sectionLabel}>TOTAL</Text>
                <View style={[styles.totalBox, { backgroundColor: "#F0FDF4" }]}>
                  <Text style={[styles.totalText, { color: "#16A34A" }]}>{localItem.finalScore || "0.00"}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {localItem.teacherRemarks ? (
          <View style={styles.remarksContainer}>
            <SVGIcon name="chatbubble-ellipses" size={14} color="#94A3B8" />
            <Text style={styles.remarksText} numberOfLines={2}>
              {localItem.teacherRemarks}
            </Text>
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
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
    }),
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: { fontSize: 18, fontWeight: "800" },
  headerRight: {
    alignItems: 'flex-end',
    gap: 4
  },
  modifiedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  modifiedText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
  },
  studentName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1E293B",
    maxWidth: '70%'
  },
  studentIdLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
    marginTop: 2,
  },
  gradeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 36,
    alignItems: "center",
  },
  gradeBadgeText: {
    fontSize: 14,
    fontWeight: "900",
  },
  positionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  positionText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  scoreGrid: {
    marginTop: 0
  },
  gridRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: 'flex-end'
  },
  inputSection: {
    flex: 1,
  },
  totalSection: {
    flex: 0.8,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#94A3B8",
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  scoreInput: {
    height: 44,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    textAlign: "center",
    fontWeight: "800",
    fontSize: 16,
    color: "#1E293B",
  },
  totalBox: {
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  totalText: {
    fontSize: 16,
    fontWeight: "900"
  },
  remarksContainer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center'
  },
  remarksText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
    fontStyle: "italic",
    flex: 1
  },
});
