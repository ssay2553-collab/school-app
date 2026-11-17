import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { analyzeSubjectPerformance } from "../../../lib/classHelpers";
import SVGIcon from "../../SVGIcon";

interface SubjectDiagnosticsCardProps {
  subjectsData: any[];
  previousSubjectsData?: any[];
  primary?: string;
  isParentView?: boolean;
  onChatTeacher?: () => void;
  onViewTopics?: () => void;
}

export const SubjectDiagnosticsCard: React.FC<SubjectDiagnosticsCardProps> = ({
  subjectsData,
  previousSubjectsData,
  primary = "#1E293B",
  isParentView = false,
  onChatTeacher,
  onViewTopics,
}) => {
  if (!subjectsData || subjectsData.length === 0) return null;

  const analysis = analyzeSubjectPerformance(subjectsData, previousSubjectsData);
  const {
    weakSubjects,
    decliningSubjects,
    improvedSubjects,
    strongSubjects,
    averageScore,
    previousAverageScore,
    averageChange,
    overallTrend,
  } = analysis;

  return (
    <View style={styles.cardContainer}>
      {/* Header */}
      <View style={[styles.headerBanner, { backgroundColor: primary }]}>
        <SVGIcon name="analytics" size={18} color="#fff" />
        <View style={{ flex: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={styles.headerTitle}>SUBJECT DIAGNOSTICS & COMPARATIVE PROGRESS</Text>
          {averageChange !== undefined && (
            <View
              style={[
                styles.trendHeaderBadge,
                { backgroundColor: averageChange >= 0 ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)" },
              ]}
            >
              <Text
                style={[
                  styles.trendHeaderBadgeText,
                  { color: averageChange >= 0 ? "#86EFAC" : "#FCA5A5" },
                ]}
              >
                {averageChange >= 0 ? `+${averageChange}% Overall` : `${averageChange}% Overall`}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.cardBody}>
        {/* DECLINING SUBJECTS ALERT (COMPARATIVE DROP) */}
        {decliningSubjects.length > 0 && (
          <View style={[styles.warningBox, { backgroundColor: "#FFF1F2", borderColor: "#FDA4AF", marginBottom: 10 }]}>
            <View style={styles.warningHeader}>
              <SVGIcon name="trending-down" size={18} color="#9F1239" />
              <Text style={[styles.warningTitle, { color: "#9F1239" }]}>
                DECLINING PERFORMANCE ALERT ({decliningSubjects.length} SUBJECTS DROPPED)
              </Text>
            </View>
            <Text style={[styles.warningSubText, { color: "#881337" }]}>
              Comparative checks against previous performance reveal a drop in the following subject(s). Prompt intervention is needed to reverse this decline:
            </Text>

            <View style={{ gap: 8, marginTop: 8 }}>
              {decliningSubjects.map((item, idx) => (
                <View key={idx} style={[styles.subjectItemCard, { borderColor: "#FECDD3" }]}>
                  <View style={styles.subjectHeaderRow}>
                    <Text style={styles.subjectNameText}>{item.subject}</Text>
                    <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                      {item.previousScore !== undefined && (
                        <Text style={styles.prevScoreText}>
                          Was {item.previousScore}%
                        </Text>
                      )}
                      <View style={[styles.scoreBadge, { backgroundColor: "#FFE4E6" }]}>
                        <Text style={[styles.scoreBadgeText, { color: "#9F1239" }]}>
                          Now {item.score}% ({item.scoreChange}%)
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={[styles.recommendationBox, { backgroundColor: "#FFF1F2" }]}>
                    <Text style={[styles.recommendationLabel, { color: "#9F1239" }]}>🔻 DECLINE REMEDIATION:</Text>
                    <Text style={[styles.recommendationText, { color: "#881337" }]}>{item.recommendation}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* WEAK SUBJECTS WARNING BOX */}
        {weakSubjects.length > 0 ? (
          <View style={styles.warningBox}>
            <View style={styles.warningHeader}>
              <SVGIcon name="alert-circle" size={18} color="#991B1B" />
              <Text style={styles.warningTitle}>
                SUBJECTS NEEDING IMMEDIATE ATTENTION ({weakSubjects.length})
              </Text>
            </View>
            <Text style={styles.warningSubText}>
              The student is performing below expectation in the following subject(s). Targeted practice and home supervision are required:
            </Text>

            <View style={{ gap: 8, marginTop: 8 }}>
              {weakSubjects.map((item, idx) => (
                <View key={idx} style={styles.subjectItemCard}>
                  <View style={styles.subjectHeaderRow}>
                    <Text style={styles.subjectNameText}>{item.subject}</Text>
                    <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                      {item.scoreChange !== undefined && (
                        <View
                          style={[
                            styles.trendPill,
                            { backgroundColor: item.scoreChange >= 0 ? "#DCFCE7" : "#FEE2E2" },
                          ]}
                        >
                          <Text
                            style={[
                              styles.trendPillText,
                              { color: item.scoreChange >= 0 ? "#166534" : "#991B1B" },
                            ]}
                          >
                            {item.scoreChange >= 0 ? `+${item.scoreChange}%` : `${item.scoreChange}%`}
                          </Text>
                        </View>
                      )}
                      <View style={[styles.scoreBadge, { backgroundColor: item.score < 40 ? "#FEE2E2" : "#FEF3C7" }]}>
                        <Text style={[styles.scoreBadgeText, { color: item.score < 40 ? "#991B1B" : "#92400E" }]}>
                          {item.score}%
                        </Text>
                      </View>
                      <View style={[styles.gradeBadge, { backgroundColor: item.score < 40 ? "#991B1B" : "#D97706" }]}>
                        <Text style={styles.gradeBadgeText}>{item.grade}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.recommendationBox}>
                    <Text style={styles.recommendationLabel}>💡 BEST WAY FORWARD:</Text>
                    <Text style={styles.recommendationText}>{item.recommendation}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* ACTION PLAN GUIDANCE */}
            <View style={styles.actionPlanBox}>
              <Text style={styles.actionPlanTitle}>🎯 RECOMMENDED PARENT & TEACHER ACTION PLAN:</Text>
              <View style={styles.bulletRow}>
                <Text style={styles.bulletNum}>1.</Text>
                <Text style={styles.bulletText}>
                  <Text style={{ fontWeight: "800" }}>Daily Homework & Revision Routine:</Text> Establish a quiet 1.5 - 2 hour study window every evening for practice drills in weak/declining subjects.
                </Text>
              </View>
              <View style={styles.bulletRow}>
                <Text style={styles.bulletNum}>2.</Text>
                <Text style={styles.bulletText}>
                  <Text style={{ fontWeight: "800" }}>Follow Class Weekly Topics:</Text> Review ongoing class schemes under EduEaz's Weekly Topics to align home revision with school syllabus.
                </Text>
              </View>
              <View style={styles.bulletRow}>
                <Text style={styles.bulletNum}>3.</Text>
                <Text style={styles.bulletText}>
                  <Text style={{ fontWeight: "800" }}>Teacher Check-in & Extra Support:</Text> Consult with the subject teacher for tailored study sheets and after-school remedial guidance.
                </Text>
              </View>
            </View>
          </View>
        ) : (
          /* STRONG PERFORMANCE SUCCESS BOX */
          <View style={styles.successBox}>
            <View style={styles.warningHeader}>
              <SVGIcon name="checkmark-circle" size={18} color="#166534" />
              <Text style={styles.successTitle}>STRONG ACADEMIC PERFORMANCE</Text>
            </View>
            <Text style={styles.successSubText}>
              No critical weak subjects identified! The student maintains a solid average of {averageScore}% {previousAverageScore !== undefined ? `(compared to ${previousAverageScore}% previously)` : ""}.
            </Text>

            {improvedSubjects.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.strongHeader}>📈 Notable Subject Growth:</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                  {improvedSubjects.map((s, idx) => (
                    <View key={idx} style={[styles.strongChip, { backgroundColor: "#DCFCE7" }]}>
                      <Text style={[styles.strongChipText, { color: "#166534" }]}>
                        {s.subject} ({s.score}%, +{s.scoreChange}%)
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {strongSubjects.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.strongHeader}>🌟 Key Strengths:</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                  {strongSubjects.map((s, idx) => (
                    <View key={idx} style={styles.strongChip}>
                      <Text style={styles.strongChipText}>
                        {s.subject} ({s.score}%)
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* PARENT QUICK ACTION BUTTONS */}
        {isParentView && (
          <View style={styles.parentActionRow}>
            {onChatTeacher && (
              <TouchableOpacity style={[styles.parentBtn, { backgroundColor: primary }]} onPress={onChatTeacher}>
                <SVGIcon name="chatbubbles" size={16} color="#fff" />
                <Text style={styles.parentBtnText}>Chat with Class Teacher</Text>
              </TouchableOpacity>
            )}
            {onViewTopics && (
              <TouchableOpacity style={[styles.parentBtn, { backgroundColor: "#8B5CF6" }]} onPress={onViewTopics}>
                <SVGIcon name="book-outline" size={16} color="#fff" />
                <Text style={styles.parentBtnText}>View Weekly Topics</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    marginVertical: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  headerBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },
  trendHeaderBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  trendHeaderBadgeText: {
    fontSize: 8,
    fontWeight: "900",
  },
  cardBody: {
    padding: 10,
  },
  warningBox: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FCD34D",
    borderRadius: 6,
    padding: 10,
  },
  warningHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  warningTitle: {
    fontSize: 10,
    fontWeight: "900",
    color: "#991B1B",
  },
  warningSubText: {
    fontSize: 9,
    color: "#78350F",
    lineHeight: 13,
  },
  subjectItemCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 6,
    padding: 8,
  },
  subjectHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  subjectNameText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#1E293B",
  },
  prevScoreText: {
    fontSize: 8,
    fontWeight: "700",
    color: "#64748B",
  },
  trendPill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  trendPillText: {
    fontSize: 8,
    fontWeight: "900",
  },
  scoreBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  scoreBadgeText: {
    fontSize: 10,
    fontWeight: "900",
  },
  gradeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  gradeBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#fff",
  },
  recommendationBox: {
    marginTop: 6,
    backgroundColor: "#FEF3C7",
    padding: 6,
    borderRadius: 4,
  },
  recommendationLabel: {
    fontSize: 8,
    fontWeight: "900",
    color: "#92400E",
    marginBottom: 2,
  },
  recommendationText: {
    fontSize: 9,
    fontWeight: "600",
    color: "#78350F",
    lineHeight: 13,
  },
  actionPlanBox: {
    marginTop: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 6,
    padding: 8,
  },
  actionPlanTitle: {
    fontSize: 9,
    fontWeight: "900",
    color: "#1E293B",
    marginBottom: 6,
  },
  bulletRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 4,
  },
  bulletNum: {
    fontSize: 9,
    fontWeight: "900",
    color: "#2563EB",
  },
  bulletText: {
    flex: 1,
    fontSize: 9,
    color: "#334155",
    lineHeight: 13,
  },
  successBox: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#86EFAC",
    borderRadius: 6,
    padding: 10,
  },
  successTitle: {
    fontSize: 10,
    fontWeight: "900",
    color: "#166534",
  },
  successSubText: {
    fontSize: 9,
    color: "#14532D",
    lineHeight: 13,
  },
  strongHeader: {
    fontSize: 9,
    fontWeight: "900",
    color: "#166534",
  },
  strongChip: {
    backgroundColor: "#E0E7FF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  strongChipText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#3730A3",
  },
  parentActionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  parentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 6,
  },
  parentBtnText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
  },
});
