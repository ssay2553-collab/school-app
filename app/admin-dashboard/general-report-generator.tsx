import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Clipboard,
    Image,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { getSchoolLogo } from "../../constants/Logos";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAcademicConfig } from "../../contexts/AcademicContext";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import {
    AIAnswerResponse,
    answerAIQuestion,
    fetchTermReportMetrics,
    generateAIReport,
    GeneratedAIReport,
    ReportType,
    TermReportMetrics,
} from "../../src/services/aiReportService";
import { generateAIReportPDF } from "../../utils/pdfGenerator";

const PRESET_QUESTIONS = [
  { icon: "💰", label: "Financial Performance", question: "What was our total financial performance this term?" },
  { icon: "📈", label: "Population Growth", question: "Did our student population increase?" },
  { icon: "⚠️", label: "Attention Areas", question: "Which areas require management attention?" },
  { icon: "📊", label: "Prev Term Comparison", question: "How did we perform compared with the previous term?" },
  { icon: "🎯", label: "Next Term Priorities", question: "What should management prioritise next term?" },
];

export default function GeneralReportGenerator() {
  const router = useRouter();
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const acadConfig = useAcademicConfig();
  const isNavigating = useRef(false);

  const primaryColor = SCHOOL_CONFIG.primaryColor || COLORS.primary || "#2e86de";
  const secondaryColor = SCHOOL_CONFIG.secondaryColor || primaryColor;
  const schoolLogoAsset = getSchoolLogo(SCHOOL_CONFIG.schoolId);

  const [activeTab, setActiveTab] = useState<"reports" | "qa">("reports");
  const [selectedReportType, setSelectedReportType] = useState<ReportType>("end_of_term");
  const [term, setTerm] = useState<string>(acadConfig.currentTerm || "Term 1");
  const [academicYear, setAcademicYear] = useState<string>(
    acadConfig.academicYear || "2025/2026",
  );

  // REPORT GENERATOR STATE
  const [generating, setGenerating] = useState<boolean>(false);
  const [progressStep, setProgressStep] = useState<string>("");
  const [report, setReport] = useState<GeneratedAIReport | null>(null);

  // EDITABLE REPORT STATE
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editedTitle, setEditedTitle] = useState<string>("");
  const [editedExecutiveSummary, setEditedExecutiveSummary] = useState<string>("");
  const [editedMarkdownContent, setEditedMarkdownContent] = useState<string>("");
  const [editedRecommendations, setEditedRecommendations] = useState<string[]>([]);

  // Q&A ASSISTANT STATE
  const [customQuestion, setCustomQuestion] = useState<string>("");
  const [askingQuestion, setAskingQuestion] = useState<boolean>(false);
  const [qaAnswer, setQaAnswer] = useState<AIAnswerResponse | null>(null);
  const [cachedMetrics, setCachedMetrics] = useState<TermReportMetrics | null>(null);

  const handleBack = () => {
    if (isNavigating.current) return;
    isNavigating.current = true;
    router.replace("/admin-dashboard");
  };

  const getOrFetchMetrics = async (): Promise<TermReportMetrics> => {
    if (cachedMetrics && cachedMetrics.term === term && cachedMetrics.academicYear === academicYear) {
      return cachedMetrics;
    }
    const metrics = await fetchTermReportMetrics(term, academicYear, SCHOOL_CONFIG.fullName);
    setCachedMetrics(metrics);
    return metrics;
  };

  const handleGenerateReport = async () => {
    setGenerating(true);
    setReport(null);
    setIsEditing(false);
    try {
      setProgressStep("1/3 Aggregating live student, attendance & financial metrics...");
      const metrics = await getOrFetchMetrics();

      setProgressStep("2/3 Analyzing executive insights & strategic metrics...");
      await new Promise((r) => setTimeout(r, 600));

      setProgressStep("3/3 Finalizing report structure & formatting...");
      const aiReport = await generateAIReport(selectedReportType, metrics);

      setReport(aiReport);
      setEditedTitle(aiReport.title);
      setEditedExecutiveSummary(aiReport.executiveSummary);
      setEditedMarkdownContent(aiReport.markdownContent);
      setEditedRecommendations(aiReport.recommendations || []);

      showToast({ message: "Executive Administrative Report generated successfully.", type: "success" });
    } catch (error) {
      console.error("AI Report generation error:", error);
      showToast({ message: "Failed to generate report. Please retry.", type: "error" });
    } finally {
      setGenerating(false);
      setProgressStep("");
    }
  };

  const handleAskQuestion = async (queryText?: string) => {
    const qToAsk = (queryText || customQuestion).trim();
    if (!qToAsk) {
      showToast({ message: "Please type or select a question.", type: "info" });
      return;
    }

    setAskingQuestion(true);
    setQaAnswer(null);
    try {
      const metrics = await getOrFetchMetrics();
      const answer = await answerAIQuestion(qToAsk, metrics);
      setQaAnswer(answer);
      if (!queryText) setCustomQuestion("");
    } catch (e) {
      console.error("Error asking AI question:", e);
      showToast({ message: "Failed to answer question. Please retry.", type: "error" });
    } finally {
      setAskingQuestion(false);
    }
  };

  const syncEditedReport = (): GeneratedAIReport | null => {
    if (!report) return null;
    const updated: GeneratedAIReport = {
      ...report,
      title: editedTitle,
      executiveSummary: editedExecutiveSummary,
      markdownContent: editedMarkdownContent,
      recommendations: editedRecommendations,
    };
    setReport(updated);
    return updated;
  };

  const handleSaveEdits = () => {
    syncEditedReport();
    setIsEditing(false);
    showToast({ message: "Report edits saved! 💾", type: "success" });
  };

  const handleExportPDF = async () => {
    const currentReport = syncEditedReport() || report;
    if (!currentReport) return;

    try {
      await generateAIReportPDF(
        currentReport,
        SCHOOL_CONFIG.fullName,
        SCHOOL_CONFIG.hotline,
        SCHOOL_CONFIG.email,
        SCHOOL_CONFIG.address,
        SCHOOL_CONFIG.motto,
        schoolLogoAsset,
      );
      showToast({ message: "PDF saved & exported successfully! 📄", type: "success" });
    } catch (error) {
      console.error("PDF export error:", error);
      showToast({ message: "Failed to export PDF.", type: "error" });
    }
  };

  const handleExportQAPDF = async () => {
    if (!qaAnswer) return;
    const tempReport: GeneratedAIReport = {
      title: `Executive Q&A Analysis: ${qaAnswer.question}`,
      reportType: "general_term",
      generatedAt: new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
      executiveSummary: qaAnswer.directAnswer,
      markdownContent: `## Executive Analysis\n${qaAnswer.directAnswer}\n\n### Key Management Takeaways\n${qaAnswer.takeaways.map((t) => `- ${t}`).join("\n")}`,
      keyStats: qaAnswer.keyMetrics.map((km) => ({ label: km.label, value: km.value, change: km.badge })),
      highlights: qaAnswer.takeaways,
      recommendations: [qaAnswer.suggestedAction],
    };

    try {
      await generateAIReportPDF(
        tempReport,
        SCHOOL_CONFIG.fullName,
        SCHOOL_CONFIG.hotline,
        SCHOOL_CONFIG.email,
        SCHOOL_CONFIG.address,
        SCHOOL_CONFIG.motto,
        schoolLogoAsset,
      );
      showToast({ message: "Q&A Analysis PDF exported! 📄", type: "success" });
    } catch (e) {
      showToast({ message: "Failed to export PDF.", type: "error" });
    }
  };

  const handleCopyText = () => {
    const currentReport = syncEditedReport() || report;
    if (!currentReport) return;

    const fullText = `${currentReport.title}\n${currentReport.generatedAt}\n\nEXECUTIVE SUMMARY:\n${currentReport.executiveSummary}\n\n${currentReport.markdownContent}`;
    Clipboard.setString(fullText);
    showToast({ message: "Report copied to clipboard! 📋", type: "info" });
  };

  const handleCopyQA = () => {
    if (!qaAnswer) return;
    const fullText = `Q: ${qaAnswer.question}\n\nA: ${qaAnswer.directAnswer}\n\nKey Action: ${qaAnswer.suggestedAction}`;
    Clipboard.setString(fullText);
    showToast({ message: "Q&A answer copied! 📋", type: "info" });
  };

  const addRecommendation = () => {
    setEditedRecommendations((prev) => [...prev, "New custom recommendation point"]);
  };

  const updateRecommendation = (index: number, value: string) => {
    setEditedRecommendations((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const removeRecommendation = (index: number) => {
    setEditedRecommendations((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <View style={[styles.header, { backgroundColor: primaryColor }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <SVGIcon name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>Executive Administration Portal</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>OFFICIAL</Text>
            </View>
          </View>
          <Text style={styles.headerSubtitle}>
            Reports & Interactive Executive Assistant for school leadership
          </Text>
        </View>
      </View>

      {/* TOP TAB SWITCHER */}
      <View style={styles.tabSwitcherRow}>
        <TouchableOpacity
          onPress={() => setActiveTab("reports")}
          style={[styles.tabBtn, activeTab === "reports" && { backgroundColor: primaryColor }]}
        >
          <SVGIcon name="document-text-outline" size={16} color={activeTab === "reports" ? "#fff" : "#475569"} />
          <Text style={[styles.tabBtnText, activeTab === "reports" && { color: "#fff" }]}>
            Executive Reports
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab("qa")}
          style={[styles.tabBtn, activeTab === "qa" && { backgroundColor: primaryColor }]}
        >
          <SVGIcon name="chatbubble-ellipses-outline" size={16} color={activeTab === "qa" ? "#fff" : "#475569"} />
          <Text style={[styles.tabBtnText, activeTab === "qa" && { color: "#fff" }]}>
            Executive Assistant & Q&A
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* TERM & YEAR SELECTOR */}
        <View style={styles.filterRow}>
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Term</Text>
            <View style={styles.pillRow}>
              {["Term 1", "Term 2", "Term 3"].map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setTerm(t)}
                  style={[
                    styles.pill,
                    term === t && { backgroundColor: primaryColor, borderColor: primaryColor },
                  ]}
                >
                  <Text style={[styles.pillText, term === t && { color: "#fff" }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Academic Year</Text>
            <View style={styles.pillRow}>
              {["2025/2026", "2026/2027", "2027/2028"].map((y) => (
                <TouchableOpacity
                  key={y}
                  onPress={() => setAcademicYear(y)}
                  style={[
                    styles.pill,
                    academicYear === y && { backgroundColor: primaryColor, borderColor: primaryColor },
                  ]}
                >
                  <Text style={[styles.pillText, academicYear === y && { color: "#fff" }]}>{y}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* TAB 1: EXECUTIVE REPORTS */}
        {activeTab === "reports" && (
          <View>
            <Text style={styles.sectionHeading}>SELECT REPORT TYPE</Text>
            <View style={styles.typeGrid}>
              <TouchableOpacity
                onPress={() => setSelectedReportType("end_of_term")}
                style={[
                  styles.typeCard,
                  selectedReportType === "end_of_term" && {
                    borderColor: primaryColor,
                    backgroundColor: "#F0F7FF",
                  },
                ]}
              >
                <Text style={styles.typeIcon}>🎓</Text>
                <Text style={styles.typeTitle}>End of Term Report</Text>
                <Text style={styles.typeDesc}>
                  11-section formal administrative report with attendance, new admissions, financials & academic performance
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setSelectedReportType("financial")}
                style={[
                  styles.typeCard,
                  selectedReportType === "financial" && {
                    borderColor: primaryColor,
                    backgroundColor: "#F0F7FF",
                  },
                ]}
              >
                <Text style={styles.typeIcon}>💰</Text>
                <Text style={styles.typeTitle}>Financial Report</Text>
                <Text style={styles.typeDesc}>
                  Revenue collections vs previous term, fee arrears & operational expenditure analysis
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setSelectedReportType("general_term")}
                style={[
                  styles.typeCard,
                  selectedReportType === "general_term" && {
                    borderColor: primaryColor,
                    backgroundColor: "#F0F7FF",
                  },
                ]}
              >
                <Text style={styles.typeIcon}>📋</Text>
                <Text style={styles.typeTitle}>General Term Report</Text>
                <Text style={styles.typeDesc}>
                  Student population breakdown, attendance trends, academics & school activity logs
                </Text>
              </TouchableOpacity>
            </View>

            {/* GENERATE BUTTON */}
            <TouchableOpacity
              onPress={handleGenerateReport}
              disabled={generating}
              style={[styles.generateBtn, { backgroundColor: primaryColor }]}
            >
              {generating ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <SVGIcon name="sparkles" size={20} color="#fff" />
              )}
              <Text style={styles.generateBtnText}>
                {generating ? "Generating Executive Report..." : "Generate Executive Report"}
              </Text>
            </TouchableOpacity>

            {generating && (
              <View style={styles.progressBox}>
                <ActivityIndicator color={primaryColor} size="small" />
                <Text style={styles.progressText}>{progressStep}</Text>
              </View>
            )}

            {/* REPORT VIEW & EDIT PANEL */}
            {report && (
              <View style={styles.reportPanel}>
                <View style={styles.toolbar}>
                  <TouchableOpacity
                    onPress={() => {
                      if (isEditing) {
                        handleSaveEdits();
                      } else {
                        setIsEditing(true);
                      }
                    }}
                    style={[
                      styles.toolBtn,
                      isEditing ? { backgroundColor: "#16A34A" } : { backgroundColor: primaryColor },
                    ]}
                  >
                    <SVGIcon name={isEditing ? "checkmark-circle" : "create-outline"} size={16} color="#fff" />
                    <Text style={styles.toolBtnText}>{isEditing ? "Save Edits 💾" : "Edit Report ✏️"}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={handleExportPDF} style={[styles.toolBtn, { backgroundColor: "#0284C7" }]}>
                    <SVGIcon name="document-text-outline" size={16} color="#fff" />
                    <Text style={styles.toolBtnText}>Save / Export PDF 📄</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={handleCopyText} style={[styles.toolBtn, { backgroundColor: "#475569" }]}>
                    <SVGIcon name="copy-outline" size={16} color="#fff" />
                    <Text style={styles.toolBtnText}>Copy 📋</Text>
                  </TouchableOpacity>
                </View>

                {isEditing ? (
                  <View style={styles.editSection}>
                    <Text style={styles.editSectionHeader}>✏️ EDIT REPORT DETAILS BEFORE SAVING</Text>

                    <Text style={styles.inputLabel}>Report Title</Text>
                    <TextInput
                      style={styles.textInput}
                      value={editedTitle}
                      onChangeText={setEditedTitle}
                      placeholder="Report Title"
                    />

                    <Text style={styles.inputLabel}>Executive Summary</Text>
                    <TextInput
                      style={[styles.textInput, styles.multilineInput]}
                      value={editedExecutiveSummary}
                      onChangeText={setEditedExecutiveSummary}
                      multiline
                      numberOfLines={4}
                    />

                    <Text style={styles.inputLabel}>Main Report Content & Details</Text>
                    <TextInput
                      style={[styles.textInput, styles.largeMultilineInput]}
                      value={editedMarkdownContent}
                      onChangeText={setEditedMarkdownContent}
                      multiline
                      numberOfLines={10}
                    />

                    <View style={styles.recHeaderRow}>
                      <Text style={styles.inputLabel}>Strategic Recommendations</Text>
                      <TouchableOpacity onPress={addRecommendation} style={styles.addBtn}>
                        <Text style={styles.addBtnText}>+ Add Point</Text>
                      </TouchableOpacity>
                    </View>

                    {editedRecommendations.map((rec, rIdx) => (
                      <View key={rIdx} style={styles.recEditRow}>
                        <TextInput
                          style={[styles.textInput, { flex: 1 }]}
                          value={rec}
                          onChangeText={(txt) => updateRecommendation(rIdx, txt)}
                        />
                        <TouchableOpacity onPress={() => removeRecommendation(rIdx)} style={styles.removeBtn}>
                          <SVGIcon name="trash-outline" size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  /* EXACT DOCUMENT PREVIEW MATCH */
                  <View style={styles.docPreviewContainer}>
                    {/* OFFICIAL LETTERHEAD PREVIEW CARD */}
                    <View style={styles.previewLetterhead}>
                      <View style={styles.letterheadContent}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.letterheadSchoolName, { color: primaryColor }]}>
                            {SCHOOL_CONFIG.fullName.toUpperCase()}
                          </Text>
                          {SCHOOL_CONFIG.motto ? (
                            <Text style={styles.letterheadMotto}>"{SCHOOL_CONFIG.motto}"</Text>
                          ) : null}
                          <Text style={styles.letterheadContact}>
                            {[
                              SCHOOL_CONFIG.address,
                              SCHOOL_CONFIG.hotline ? `Tel: ${SCHOOL_CONFIG.hotline}` : null,
                              SCHOOL_CONFIG.email ? `Email: ${SCHOOL_CONFIG.email}` : null,
                            ]
                              .filter(Boolean)
                              .join("   |   ")}
                          </Text>
                        </View>
                        {schoolLogoAsset ? (
                          <Image
                            source={schoolLogoAsset}
                            style={styles.letterheadLogo}
                            resizeMode="contain"
                          />
                        ) : null}
                      </View>
                      <View style={[styles.letterheadBarPrimary, { backgroundColor: primaryColor }]} />
                      <View style={[styles.letterheadBarSecondary, { backgroundColor: secondaryColor }]} />
                    </View>

                    {/* REPORT TITLE BANNER PREVIEW */}
                    <View style={[styles.previewBanner, { backgroundColor: primaryColor }]}>
                      <Text style={styles.previewBannerTitle}>{report.title}</Text>
                    </View>
                    <Text style={styles.reportMeta}>Generated on: {report.generatedAt}</Text>

                    {/* KEY METRICS GRID PREVIEW */}
                    {report.keyStats && (
                      <View style={styles.statsGrid}>
                        {report.keyStats.map((stat, idx) => (
                          <View key={idx} style={styles.statCard}>
                            <Text style={styles.statLabel}>{stat.label}</Text>
                            <Text style={styles.statValue}>{stat.value}</Text>
                            {stat.change && <Text style={styles.statChange}>{stat.change}</Text>}
                          </View>
                        ))}
                      </View>
                    )}

                    {/* EXECUTIVE SUMMARY PREVIEW */}
                    <View style={[styles.summaryBox, { borderLeftColor: primaryColor }]}>
                      <Text style={[styles.summaryTitle, { color: primaryColor }]}>EXECUTIVE SUMMARY</Text>
                      <Text style={styles.summaryText}>{report.executiveSummary}</Text>
                    </View>

                    {/* MARKDOWN CONTENT PREVIEW */}
                    <View style={styles.markdownBox}>
                      {report.markdownContent.split("\n\n").map((paragraph, pIdx) => {
                        if (paragraph.startsWith("## ")) {
                          return (
                            <View key={pIdx} style={styles.h2Container}>
                              <Text style={[styles.h2, { color: primaryColor }]}>
                                {paragraph.replace("## ", "")}
                              </Text>
                            </View>
                          );
                        }
                        if (paragraph.startsWith("### ")) {
                          return (
                            <Text key={pIdx} style={[styles.h3, { color: secondaryColor }]}>
                              {paragraph.replace("### ", "")}
                            </Text>
                          );
                        }
                        if (paragraph.includes("*Suggestion:*") || paragraph.includes("*Commentary:*") || paragraph.includes("*AI Suggestion:*") || paragraph.includes("*AI Commentary:*")) {
                          return (
                            <View key={pIdx} style={styles.aiSuggestionBox}>
                              <Text style={styles.aiSuggestionTitle}>💡 SUGGESTION</Text>
                              <Text style={styles.aiSuggestionText}>
                                {paragraph.replace(/\*AI Suggestion:\*|\*AI Commentary:\*|\*Suggestion:\*|\*Commentary:\*/g, "").trim()}
                              </Text>
                            </View>
                          );
                        }
                        return (
                          <Text key={pIdx} style={styles.bodyText}>
                            {paragraph.replace(/\*\*/g, "")}
                          </Text>
                        );
                      })}
                    </View>

                    {/* STRATEGIC RECOMMENDATIONS PREVIEW */}
                    {report.recommendations && report.recommendations.length > 0 && (
                      <View style={styles.recBox}>
                        <Text style={styles.recTitle}>💡 STRATEGIC RECOMMENDATIONS</Text>
                        {report.recommendations.map((rec, rIdx) => (
                          <View key={rIdx} style={styles.recItem}>
                            <Text style={styles.recDot}>•</Text>
                            <Text style={styles.recText}>{rec}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* OFFICIAL SIGN-OFF BLOCK PREVIEW */}
                    <View style={styles.signoffBox}>
                      <Text style={styles.signoffTitle}>OFFICIAL ADMINISTRATIVE SIGN-OFF & APPROVAL</Text>
                      <View style={styles.signoffRow}>
                        <View style={styles.signoffCol}>
                          <View style={styles.signatureLine} />
                          <Text style={styles.signoffLabel}>Prepared by: Headmaster / Administrator</Text>
                        </View>
                        <View style={styles.signoffCol}>
                          <View style={styles.signatureLine} />
                          <Text style={styles.signoffLabel}>Reviewed by: Proprietor / Board Chair</Text>
                        </View>
                      </View>
                      <View style={[styles.signoffRow, { marginTop: 12 }]}>
                        <View style={styles.signoffCol}>
                          <View style={[styles.signatureLine, { width: "70%" }]} />
                          <Text style={styles.signoffLabel}>Date: ____________________</Text>
                        </View>
                        <View style={styles.stampBox}>
                          <Text style={styles.stampText}>Official School Stamp</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* TAB 2: AI EXECUTIVE ASSISTANT (Q&A) */}
        {activeTab === "qa" && (
          <View style={styles.qaContainer}>
            <Text style={styles.sectionHeading}>ASK EXECUTIVE QUESTIONS</Text>
            <Text style={styles.qaSubheading}>
              Select a quick query or ask custom questions regarding financials, enrollment, performance & priorities.
            </Text>

            {/* PRESET CHIPS */}
            <View style={styles.chipGrid}>
              {PRESET_QUESTIONS.map((pq, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => handleAskQuestion(pq.question)}
                  disabled={askingQuestion}
                  style={styles.chipBtn}
                >
                  <Text style={styles.chipIcon}>{pq.icon}</Text>
                  <Text style={styles.chipText}>{pq.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* CUSTOM QUESTION BOX */}
            <View style={styles.customQueryBox}>
              <TextInput
                style={styles.queryInput}
                placeholder="Ask any administrative or financial question..."
                value={customQuestion}
                onChangeText={setCustomQuestion}
                onSubmitEditing={() => handleAskQuestion()}
              />
              <TouchableOpacity
                onPress={() => handleAskQuestion()}
                disabled={askingQuestion}
                style={[styles.askBtn, { backgroundColor: primaryColor }]}
              >
                {askingQuestion ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <SVGIcon name="send" size={16} color="#fff" />
                )}
              </TouchableOpacity>
            </View>

            {askingQuestion && (
              <View style={styles.progressBox}>
                <ActivityIndicator color={primaryColor} size="small" />
                <Text style={styles.progressText}>Analyzing school data & formulating response...</Text>
              </View>
            )}

            {/* ANSWER CARD */}
            {qaAnswer && (
              <View style={styles.answerCard}>
                <View style={styles.answerHeaderRow}>
                  <Text style={styles.answerQuestion}>Q: {qaAnswer.question}</Text>
                  <View style={styles.actionRow}>
                    <TouchableOpacity onPress={handleExportQAPDF} style={styles.iconActionBtn}>
                      <SVGIcon name="document-text-outline" size={16} color={primaryColor} />
                      <Text style={[styles.iconActionText, { color: primaryColor }]}>Export PDF</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleCopyQA} style={styles.iconActionBtn}>
                      <SVGIcon name="copy-outline" size={16} color="#475569" />
                      <Text style={[styles.iconActionText, { color: "#475569" }]}>Copy</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* METRIC BADGES */}
                {qaAnswer.keyMetrics && (
                  <View style={styles.badgeRow}>
                    {qaAnswer.keyMetrics.map((km, idx) => (
                      <View key={idx} style={styles.metricBadge}>
                        <Text style={styles.metricBadgeLabel}>{km.label}</Text>
                        <Text style={styles.metricBadgeVal}>{km.value}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* DIRECT ANSWER */}
                <View style={styles.answerBox}>
                  <Text style={styles.answerText}>{qaAnswer.directAnswer}</Text>
                </View>

                {/* TAKEAWAYS */}
                {qaAnswer.takeaways && qaAnswer.takeaways.length > 0 && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.takeawaysHeading}>KEY TAKEAWAYS & DATA POINTS</Text>
                    {qaAnswer.takeaways.map((t, idx) => (
                      <View key={idx} style={styles.recItem}>
                        <Text style={styles.recDot}>•</Text>
                        <Text style={styles.recText}>{t}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* SUGGESTED ACTION */}
                {qaAnswer.suggestedAction && (
                  <View style={styles.actionCallout}>
                    <Text style={styles.actionTitle}>🎯 SUGGESTED MANAGEMENT ACTION</Text>
                    <Text style={styles.actionText}>{qaAnswer.suggestedAction}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
  },
  badge: {
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 11,
    color: "rgba(255,255,255,0.85)",
    marginTop: 2,
  },
  tabSwitcherRow: {
    flexDirection: "row",
    backgroundColor: "#E2E8F0",
    padding: 4,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
  },
  scrollContent: {
    padding: 16,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  qaSubheading: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 14,
    lineHeight: 16,
  },
  typeGrid: {
    gap: 10,
    marginBottom: 16,
  },
  typeCard: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 14,
    ...SHADOWS.small,
  },
  typeIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  typeTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  typeDesc: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
    lineHeight: 16,
  },
  filterRow: {
    gap: 12,
    marginBottom: 16,
  },
  filterGroup: {
    gap: 6,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  pillRow: {
    flexDirection: "row",
    gap: 8,
  },
  pill: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    ...SHADOWS.medium,
  },
  generateBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
  },
  progressBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
  },
  progressText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1E40AF",
  },
  reportPanel: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...SHADOWS.small,
  },
  toolbar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 12,
  },
  toolBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  toolBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#fff",
  },
  editSection: {
    gap: 12,
  },
  editSectionHeader: {
    fontSize: 12,
    fontWeight: "900",
    color: "#2563EB",
    letterSpacing: 0.5,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
    marginBottom: -4,
  },
  textInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: "#0F172A",
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  largeMultilineInput: {
    minHeight: 180,
    textAlignVertical: "top",
  },
  recHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  addBtn: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  addBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2563EB",
  },
  recEditRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  removeBtn: {
    padding: 8,
  },
  docPreviewContainer: {
    gap: 12,
  },
  previewLetterhead: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
  },
  letterheadContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 12,
  },
  letterheadSchoolName: {
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  letterheadMotto: {
    fontSize: 9.5,
    fontStyle: "italic",
    color: "#64748B",
    marginTop: 2,
  },
  letterheadContact: {
    fontSize: 9,
    color: "#475569",
    marginTop: 4,
  },
  letterheadLogo: {
    width: 48,
    height: 48,
  },
  letterheadBarPrimary: {
    height: 3,
    borderRadius: 2,
  },
  letterheadBarSecondary: {
    height: 1.5,
    borderRadius: 1,
    marginTop: 2,
    width: "80%",
  },
  previewBanner: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  previewBannerTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  reportMeta: {
    fontSize: 10,
    color: "#64748B",
    marginTop: -4,
    marginBottom: 8,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 10,
    borderRadius: 8,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 2,
  },
  statChange: {
    fontSize: 9,
    fontWeight: "700",
    color: "#16A34A",
    marginTop: 2,
  },
  summaryBox: {
    backgroundColor: "#EFF6FF",
    borderLeftWidth: 4,
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 12,
    color: "#1E3A8A",
    lineHeight: 18,
  },
  markdownBox: {
    gap: 10,
    marginBottom: 12,
  },
  h2Container: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#E2E8F0",
    paddingBottom: 4,
    marginTop: 10,
  },
  h2: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  h3: {
    fontSize: 12,
    fontWeight: "800",
    marginTop: 6,
  },
  bodyText: {
    fontSize: 12,
    color: "#334155",
    lineHeight: 18,
  },
  aiSuggestionBox: {
    backgroundColor: "#FFFBEB",
    borderLeftWidth: 3,
    borderLeftColor: "#F59E0B",
    padding: 10,
    borderRadius: 6,
    marginVertical: 4,
  },
  aiSuggestionTitle: {
    fontSize: 9.5,
    fontWeight: "900",
    color: "#B45309",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  aiSuggestionText: {
    fontSize: 11.5,
    color: "#78350F",
    lineHeight: 17,
  },
  recBox: {
    backgroundColor: "#F0FDF4",
    borderLeftWidth: 4,
    borderLeftColor: "#16A34A",
    padding: 12,
    borderRadius: 6,
  },
  recTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: "#166534",
    marginBottom: 8,
  },
  recItem: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 4,
  },
  recDot: {
    fontSize: 14,
    color: "#166534",
    fontWeight: "900",
  },
  recText: {
    fontSize: 12,
    color: "#14532D",
    flex: 1,
    lineHeight: 17,
  },
  signoffBox: {
    backgroundColor: "#FAF5FF",
    borderWidth: 1,
    borderColor: "#E9D5FF",
    borderRadius: 10,
    padding: 14,
    marginTop: 16,
  },
  signoffTitle: {
    fontSize: 10,
    fontWeight: "900",
    color: "#6B21A8",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  signoffRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
  },
  signoffCol: {
    flex: 1,
  },
  signatureLine: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#94A3B8",
    height: 24,
    marginBottom: 4,
  },
  signoffLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#334155",
  },
  stampBox: {
    width: 110,
    height: 55,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    borderStyle: "dashed",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  stampText: {
    fontSize: 8.5,
    fontWeight: "800",
    color: "#94A3B8",
    textTransform: "uppercase",
  },
  qaContainer: {
    marginTop: 4,
  },
  chipGrid: {
    gap: 8,
    marginBottom: 16,
  },
  chipBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
    ...SHADOWS.small,
  },
  chipIcon: {
    fontSize: 16,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E293B",
  },
  customQueryBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 8,
    marginBottom: 16,
  },
  queryInput: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
    paddingVertical: 8,
  },
  askBtn: {
    padding: 10,
    borderRadius: 8,
  },
  answerCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
    ...SHADOWS.small,
  },
  answerHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  answerQuestion: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    flex: 1,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metricBadge: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  metricBadgeLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
  },
  metricBadgeVal: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 2,
  },
  answerBox: {
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#2563EB",
  },
  answerText: {
    fontSize: 12,
    color: "#1E293B",
    lineHeight: 18,
  },
  takeawaysHeading: {
    fontSize: 10,
    fontWeight: "900",
    color: "#64748B",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  actionCallout: {
    backgroundColor: "#F0FDF4",
    borderLeftWidth: 4,
    borderLeftColor: "#16A34A",
    padding: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  actionTitle: {
    fontSize: 10,
    fontWeight: "900",
    color: "#166534",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#14532D",
  },
  iconActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  iconActionText: {
    fontSize: 10,
    fontWeight: "800",
  },
  actionRow: {
    flexDirection: "row",
    gap: 6,
  },
});
