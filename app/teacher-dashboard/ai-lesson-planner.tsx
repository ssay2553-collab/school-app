import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from "firebase/firestore";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
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
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import {
  CLASS_LEVELS,
  getClassLevelInfo,
  getCurriculumIndicators,
  getCurriculumLabels,
  getCurriculumStrands,
} from "../../constants/Curriculum";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { db } from "../../firebaseConfig";
import { sortClasses } from "../../utils/classSorting";

import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebaseConfig";

const { width } = Dimensions.get("window");
const isLargeScreen = width > 768;

// NaCCA-aligned class level options
const NACCA_CLASS_LEVELS = Object.keys(CLASS_LEVELS);

export default function AILessonPlanner() {
  const router = useRouter();
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const primary = SCHOOL_CONFIG.primaryColor;

  const teacherSubjects = appUser?.subjects || [];
  const curriculum = appUser?.curriculum || "GES";
  const labels = getCurriculumLabels(curriculum);

  const [loading, setLoading] = useState(false);
  const [weeklyUsage, setWeeklyUsage] = useState<Record<string, number>>({});
  const [availableClasses, setAvailableClasses] = useState<
    { id: string; name: string }[]
  >([]);
  const [generatedPlan, setGeneratedPlan] = useState<any>(null);
  const [editingField, setEditingField] = useState<{
    key: string;
    title: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [suggestedStrands, setSuggestedStrands] = useState<string[]>([]);
  const [suggestedIndicators, setSuggestedIndicators] = useState<{
    contentStandard: string;
    indicators: string[];
  } | null>(null);
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);

  const [form, setForm] = useState({
    subject: teacherSubjects.length === 1 ? teacherSubjects[0] : "",
    strand: "",
    topic: "",
    classLevel: "",
    duration: "60 mins",
  });

  // Handle navigation back
  const handleBack = useCallback(() => {
    if (generatedPlan) {
      setGeneratedPlan(null);
      return true;
    } else {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/teacher-dashboard");
      }
      return true;
    }
  }, [generatedPlan, router]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      handleBack,
    );
    return () => backHandler.remove();
  }, [handleBack]);

  useEffect(() => {
    if (appUser?.uid) {
      fetchWeeklyUsage();
      fetchClasses();
    }
  }, [appUser?.uid]);

  const fetchClasses = async () => {
    if (!appUser?.classes || appUser.classes.length === 0) return;
    try {
      const q = query(
        collection(db, "classes"),
        where("__name__", "in", appUser.classes),
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((doc) => ({
        id: doc.id,
        name: (doc.data() as any).name,
      }));
      const sorted = sortClasses(list);
      setAvailableClasses(sorted);

      if (sorted.length === 1) {
        setForm((prev) => ({ ...prev, classLevel: sorted[0].id }));
      }
    } catch (err) {
      console.error("Error fetching classes:", err);
    }
  };

  const getStartOfWeek = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day;
    const startOfWeek = new Date(now.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);
    return startOfWeek;
  };

  const fetchWeeklyUsage = async () => {
    if (!appUser?.uid) return;
    try {
      const startOfWeek = getStartOfWeek();
      const q = query(
        collection(db, "ai_generations"),
        where("userId", "==", appUser.uid),
        where("createdAt", ">=", Timestamp.fromDate(startOfWeek)),
      );
      const querySnapshot = await getDocs(q);

      const usage: Record<string, number> = {};
      querySnapshot.forEach((doc) => {
        const data = doc.data() as any;
        usage[data.subject] = (usage[data.subject] || 0) + 1;
      });
      setWeeklyUsage(usage);
    } catch (error) {
      console.error("Error fetching usage:", error);
    }
  };

  // Update suggested strands and indicators when subject and class level change
  useEffect(() => {
    if (form.subject && form.classLevel) {
      const strands = getCurriculumStrands(
        curriculum,
        form.subject,
        form.classLevel,
      );
      setSuggestedStrands(strands);
      setSuggestedIndicators(null);
      setSelectedIndicators([]);
    } else {
      setSuggestedStrands([]);
      setSuggestedIndicators(null);
      setSelectedIndicators([]);
    }
  }, [form.subject, form.classLevel, curriculum]);

  // Update indicators when strand changes
  useEffect(() => {
    if (form.subject && form.classLevel && form.strand) {
      const standards = getCurriculumIndicators(
        curriculum,
        form.subject,
        form.classLevel,
        form.strand,
      );
      setSuggestedIndicators(standards);
      setSelectedIndicators([]);
    } else {
      setSuggestedIndicators(null);
      setSelectedIndicators([]);
    }
  }, [form.strand, form.subject, form.classLevel, curriculum]);

  const selectedClassName =
    availableClasses.find((c) => c.id === form.classLevel)?.name ||
    NACCA_CLASS_LEVELS.find((c) => c === form.classLevel) ||
    "";
  const classLevelInfo = getClassLevelInfo(
    selectedClassName || form.classLevel,
  );
  const estimatedAge = classLevelInfo.ageRange;

  const handleGenerate = async () => {
    if (teacherSubjects.length === 0) {
      showToast({
        message: "You have no subjects assigned to your profile. Please contact the administrator.",
        type: "error",
      });
      return;
    }

    if (
      !form.subject ||
      !form.strand ||
      !form.topic ||
      !form.classLevel ||
      !form.duration
    ) {
      showToast({ message: "Please fill in all details.", type: "error" });
      return;
    }

    if (suggestedIndicators && selectedIndicators.length === 0) {
      showToast({
        message: "Please select at least one learning indicator.",
        type: "error",
      });
      return;
    }

    const currentUsage = weeklyUsage[form.subject] || 0;
    if (currentUsage >= 3) {
      showToast({
        message: `You have reached your limit of 3 generations for ${form.subject} this week.`,
        type: "error",
      });
      return;
    }

    setLoading(true);

    try {
      const genFn = httpsCallable(functions, "generateLessonPlan");

      const { data } = await genFn({
        subject: form.subject,
        strand: form.strand,
        topic: form.topic,
        classLevel: selectedClassName || form.classLevel,
        duration: form.duration,
        ageRange: estimatedAge,
        curriculum: curriculum,
        selectedIndicators:
          selectedIndicators.length > 0
            ? selectedIndicators
            : suggestedIndicators?.indicators || [],
        contentStandard: suggestedIndicators?.contentStandard || "",
      });

      setGeneratedPlan(data);
      fetchWeeklyUsage();
    } catch (error: any) {
      console.error("AI Error:", error);
      let msg = "Could not generate plan. Please try again.";
      if (error.code === "resource-exhausted") msg = error.message;
      showToast({ message: msg, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToVault = async () => {
    if (!generatedPlan) return;

    try {
      setLoading(true);
      const selectedClassName =
        availableClasses.find((c) => c.id === form.classLevel)?.name ||
        form.classLevel;

      await addDoc(collection(db, "pedagogy_vault"), {
        userId: appUser?.uid,
        subject: form.subject,
        topic: form.topic,
        strand: form.strand,
        classLevel: selectedClassName,
        duration: form.duration,
        plan: generatedPlan,
        curriculum: curriculum,
        classLevelInfo: classLevelInfo,
        createdAt: serverTimestamp(),
      });
      showToast({
        message: "Lesson plan saved to the Pedagogy Vault.",
        type: "success",
      });
    } catch (error) {
      console.error("Save error:", error);
      showToast({ message: "Could not save to vault.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const openEditor = (key: string, title: string) => {
    const currentItems = generatedPlan[key] || [];
    if (typeof currentItems === "string") {
      setEditValue(currentItems);
    } else if (Array.isArray(currentItems)) {
      setEditValue(currentItems.join("\n"));
    } else {
      setEditValue(JSON.stringify(currentItems, null, 2));
    }
    setEditingField({ key, title });
  };

  const saveEdit = () => {
    if (editingField) {
      const currentVal = generatedPlan[editingField.key];
      let newValue: any;

      if (typeof currentVal === "string") {
        newValue = editValue;
      } else if (Array.isArray(currentVal)) {
        newValue = editValue.split("\n").filter((line) => line.trim() !== "");
      } else {
        try {
          newValue = JSON.parse(editValue);
        } catch {
          newValue = editValue;
        }
      }

      setGeneratedPlan({
        ...generatedPlan,
        [editingField.key]: newValue,
      });
      setEditingField(null);
    }
  };

  const renderSection = (
    title: string,
    content: any,
    icon: string,
    key: string,
    isEditable: boolean = true,
  ) => {
    const renderContent = () => {
      if (typeof content === "string") {
        return <Text style={styles.listText}>{content}</Text>;
      }

      if (Array.isArray(content)) {
        return content.map((item, index) => (
          <View key={index} style={styles.listItem}>
            <Text style={[styles.bullet, { color: primary }]}>•</Text>
            <Text style={styles.listText}>{item}</Text>
          </View>
        ));
      }

      if (typeof content === "object" && content !== null) {
        // Handle nested objects like introduction, assessment, mainActivities
        return Object.entries(content).map(([subKey, subValue]) => {
          if (Array.isArray(subValue)) {
            return (
              <View key={subKey} style={styles.subSection}>
                <Text style={styles.subSectionTitle}>{subKey}:</Text>
                {subValue.map((item, idx) => (
                  <View key={idx} style={styles.listItem}>
                    <Text style={[styles.bullet, { color: primary }]}>
                      {">"}
                    </Text>
                    <Text style={styles.listText}>{item}</Text>
                  </View>
                ))}
              </View>
            );
          } else if (typeof subValue === "object" && subValue !== null) {
            return (
              <View key={subKey} style={styles.subSection}>
                <Text style={styles.subSectionTitle}>{subKey}:</Text>
                {Object.entries(subValue).map(([k, v]) => (
                  <View key={k} style={styles.listItem}>
                    <Text style={[styles.bullet, { color: primary }]}>
                      {">"}
                    </Text>
                    <Text style={styles.listText}>
                      <Text style={styles.bold}>{k}:</Text> {String(v)}
                    </Text>
                  </View>
                ))}
              </View>
            );
          }
          return (
            <View key={subKey} style={styles.subSection}>
              <Text style={styles.subSectionTitle}>{subKey}:</Text>
              <Text style={styles.listText}>{String(subValue)}</Text>
            </View>
          );
        });
      }

      return <Text style={styles.listText}>{String(content)}</Text>;
    };

    return (
      <Animatable.View animation="fadeInUp" style={styles.resultSection}>
        <View style={styles.sectionTitleRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <SVGIcon name={icon} size={20} color={primary} />
            <Text style={styles.sectionTitle}>{title}</Text>
          </View>
          {isEditable && (
            <TouchableOpacity onPress={() => openEditor(key, title)}>
              <SVGIcon name="create-outline" size={18} color={primary} />
            </TouchableOpacity>
          )}
        </View>
        {renderContent()}
      </Animatable.View>
    );
  };

  const renderActivitiesSection = (activities: any[]) => {
    if (!Array.isArray(activities)) return null;

    return (
      <Animatable.View animation="fadeInUp" style={styles.resultSection}>
        <View style={styles.sectionTitleRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <SVGIcon name="people-outline" size={20} color={primary} />
            <Text style={styles.sectionTitle}>
              Main Teaching Activities (5E Model)
            </Text>
          </View>
        </View>
        {activities.map((activity, index) => (
          <View key={index} style={styles.activityCard}>
            <View style={styles.activityHeader}>
              <View
                style={[styles.phaseBadge, { backgroundColor: primary + "20" }]}
              >
                <Text style={[styles.phaseText, { color: primary }]}>
                  {activity.phase || `Phase ${index + 1}`}
                </Text>
              </View>
              {activity.duration && (
                <Text style={styles.durationText}>{activity.duration}</Text>
              )}
            </View>
            <Text style={styles.activityTitle}>Activity:</Text>
            <Text style={styles.listText}>{activity.activity}</Text>
            <Text style={styles.activityTitle}>Teacher Role:</Text>
            <Text style={styles.listText}>{activity.teacherRole}</Text>
            {activity.differentiation && (
              <>
                <Text style={styles.activityTitle}>Differentiation:</Text>
                <Text style={styles.listText}>{activity.differentiation}</Text>
              </>
            )}
          </View>
        ))}
      </Animatable.View>
    );
  };

  const remaining = 3 - (weeklyUsage[form.subject] || 0);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <SVGIcon name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>AI Lesson Planner 🪄</Text>
          <Text style={styles.subtitle}>
            {curriculum} Curriculum Standards
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
      <View style={styles.formCard}>
        {teacherSubjects.length === 0 ? (
          <View style={styles.noSubjectContainer}>
            <SVGIcon name="warning-outline" size={40} color={COLORS.error} />
            <Text style={styles.noSubjectText}>
              No Subjects Assigned
            </Text>
            <Text style={styles.noSubjectSubtext}>
              You need to have subjects assigned to your profile to use the AI Lesson Planner.
            </Text>
          </View>
        ) : (
          <>
            {/* Curriculum Badge */}
            <View
              style={[
                styles.curriculumBadge,
                curriculum === "Montessori" && { backgroundColor: "#8B5CF6" },
                curriculum === "Cambridge" && { backgroundColor: "#2563EB" },
              ]}
            >
              <SVGIcon name="school-outline" size={16} color="#fff" />
              <Text style={styles.curriculumBadgeText}>
                {curriculum} Aligned
              </Text>
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Subject</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={form.subject}
                    onValueChange={(v) =>
                      setForm({ ...form, subject: v, strand: "" })
                    }
                    style={styles.picker}
                  >
                    <Picker.Item label="Choose subject..." value="" />
                    {teacherSubjects.map((s: string) => (
                      <Picker.Item key={s} label={s} value={s} />
                    ))}
                  </Picker>
                </View>
              </View>

              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.label}>
                  Class Level{" "}
                  {classLevelInfo.level ? `(${classLevelInfo.ageRange})` : ""}
                </Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={form.classLevel}
                    onValueChange={(v) => setForm({ ...form, classLevel: v })}
                    style={styles.picker}
                  >
                    <Picker.Item label="Choose class..." value="" />
                    {availableClasses.length > 0
                      ? availableClasses.map((c) => (
                          <Picker.Item key={c.id} label={c.name} value={c.id} />
                        ))
                      : NACCA_CLASS_LEVELS.map((level) => (
                          <Picker.Item
                            key={level}
                            label={level}
                            value={level}
                          />
                        ))}
                  </Picker>
                </View>
              </View>
            </View>

            {form.subject && (
              <View style={styles.usageTip}>
                <Text style={styles.usageTipText}>
                  Weekly allowance for {form.subject}:{" "}
                  <Text
                    style={{
                      fontWeight: "900",
                      color: remaining > 0 ? primary : COLORS.error,
                    }}
                  >
                    {remaining}/3 remaining
                  </Text>
                </Text>
              </View>
            )}

            {/* Curriculum Strand Selection */}
            <Text style={styles.label}>{curriculum} {labels.strand}</Text>
            {suggestedStrands.length > 0 ? (
              <View style={styles.strandContainer}>
                <View style={styles.strandListContainer}>
                  {suggestedStrands.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[
                        styles.strandOption,
                        form.strand === s && styles.strandOptionSelected,
                        form.strand === s &&
                          curriculum === "Montessori" && {
                            borderColor: "#8B5CF6",
                            backgroundColor: "#8B5CF615",
                          },
                        form.strand === s &&
                          curriculum === "Cambridge" && {
                            borderColor: "#2563EB",
                            backgroundColor: "#2563EB15",
                          },
                      ]}
                      onPress={() => setForm({ ...form, strand: s })}
                    >
                      <Text
                        style={[
                          styles.strandOptionText,
                          form.strand === s && styles.strandOptionTextSelected,
                          form.strand === s &&
                            curriculum === "Montessori" && { color: "#8B5CF6" },
                          form.strand === s &&
                            curriculum === "Cambridge" && { color: "#2563EB" },
                        ]}
                      >
                        {s}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[
                      styles.strandOption,
                      form.strand !== "" &&
                        !suggestedStrands.includes(form.strand) &&
                        styles.strandOptionSelected,
                    ]}
                    onPress={() => setForm({ ...form, strand: "" })}
                  >
                    <Text
                      style={[
                        styles.strandOptionText,
                        form.strand !== "" &&
                          !suggestedStrands.includes(form.strand) &&
                          styles.strandOptionTextSelected,
                      ]}
                    >
                      Other / Manual
                    </Text>
                  </TouchableOpacity>
                </View>

                {(!suggestedStrands.includes(form.strand) ||
                  form.strand === "") && (
                  <TextInput
                    style={styles.input}
                    placeholder={`Enter ${labels.strand.toLowerCase()} manually...`}
                    value={
                      suggestedStrands.includes(form.strand) ? "" : form.strand
                    }
                    onChangeText={(v) => setForm({ ...form, strand: v })}
                  />
                )}

                <Text style={styles.hintText}>
                  Based on {curriculum} curriculum for {form.subject} -{" "}
                  {form.classLevel}
                </Text>
              </View>
            ) : (
              <TextInput
                style={styles.input}
                placeholder={`e.g. ${
                  curriculum === "Montessori"
                    ? "Practical Life, Sensorial"
                    : "Number, Geometry"
                }`}
                value={form.strand}
                onChangeText={(v) => setForm({ ...form, strand: v })}
              />
            )}

            {/* Curriculum Indicator Selection */}
            {suggestedIndicators && (
              <View style={styles.strandContainer}>
                <Text style={styles.label}>
                  {labels.indicator}s (Select one or more)
                </Text>
                <ScrollView
                  style={styles.indicatorListContainer}
                  nestedScrollEnabled={true}
                  showsVerticalScrollIndicator={true}
                >
                  {suggestedIndicators.indicators.map((ind, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.indicatorCheckbox,
                        selectedIndicators.includes(ind) &&
                          styles.indicatorCheckboxSelected,
                      ]}
                      onPress={() => {
                        if (selectedIndicators.includes(ind)) {
                          setSelectedIndicators(
                            selectedIndicators.filter((i) => i !== ind),
                          );
                        } else {
                          setSelectedIndicators([...selectedIndicators, ind]);
                        }
                      }}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          selectedIndicators.includes(ind) && {
                            backgroundColor: primary,
                            borderColor: primary,
                          },
                        ]}
                      >
                        {selectedIndicators.includes(ind) && (
                          <SVGIcon name="checkmark" size={14} color="#fff" />
                        )}
                      </View>
                      <Text style={styles.indicatorText}>{ind}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <Text style={styles.standardText}>
                  {suggestedIndicators.contentStandard}
                </Text>
                {selectedIndicators.length > 0 && (
                  <Text style={styles.hintText}>
                    {selectedIndicators.length} {labels.indicator.toLowerCase()}
                    (s) selected
                  </Text>
                )}
              </View>
            )}

            <Text style={styles.label}>
              {curriculum === "GES" ? "Sub-strand / Topic" : "Topic / Theme"}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Addition and Subtraction, Living and Non-living things"
              value={form.topic}
              onChangeText={(v) => setForm({ ...form, topic: v })}
            />

            <Text style={styles.label}>Duration</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 60 mins, 40 mins, Double period"
              value={form.duration}
              onChangeText={(v) => setForm({ ...form, duration: v })}
            />

            <TouchableOpacity
              style={[
                styles.generateBtn,
                { backgroundColor: primary, opacity: remaining <= 0 ? 0.6 : 1 },
              ]}
              onPress={handleGenerate}
              disabled={loading || remaining <= 0}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <SVGIcon name="sparkles" size={20} color="#fff" />
                  <Text style={styles.generateBtnText}>
                    Generate {curriculum} Lesson Plan
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>

          {generatedPlan && (
            <View style={styles.resultsContainer}>
              {/* Plan Header */}
              <View style={styles.resultHeader}>
                <View style={styles.resultHeaderLeft}>
                  <Text style={styles.resultMainTitle}>{form.topic}</Text>
                  <View style={styles.resultMetaRow}>
                    <View
                      style={[
                        styles.metaBadge,
                        { backgroundColor: primary + "15" },
                      ]}
                    >
                      <Text style={[styles.metaBadgeText, { color: primary }]}>
                        {selectedClassName || form.classLevel}
                      </Text>
                    </View>
                    <View
                      style={[styles.metaBadge, { backgroundColor: "#F1F5F9" }]}
                    >
                      <Text style={styles.metaBadgeText}>{form.duration}</Text>
                    </View>
                    <View
                      style={[styles.metaBadge, { backgroundColor: "#F1F5F9" }]}
                    >
                      <Text style={styles.metaBadgeText}>{form.subject}</Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setGeneratedPlan(null)}>
                  <Text style={{ color: COLORS.error, fontWeight: "700" }}>
                    Clear
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Content Standard & Indicator */}
              {generatedPlan.contentStandard && (
                <View style={styles.standardCard}>
                  <View style={styles.standardRow}>
                    <SVGIcon name="book-outline" size={18} color={primary} />
                    <View>
                      <Text style={styles.standardLabel}>
                        {labels.contentStandard}:
                      </Text>
                      <Text style={styles.standardText}>
                        {generatedPlan.contentStandard}
                      </Text>
                    </View>
                  </View>
                  {generatedPlan.indicator && (
                    <View style={styles.standardRow}>
                      <SVGIcon name="flag-outline" size={18} color={primary} />
                      <View>
                        <Text style={styles.standardLabel}>
                          {labels.indicator}:
                        </Text>
                        <Text style={styles.standardText}>
                          {generatedPlan.indicator}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Learning Objectives */}
              {generatedPlan.learningObjectives &&
                renderSection(
                  "Learning Objectives",
                  generatedPlan.learningObjectives,
                  "checkbox-outline",
                  "learningObjectives",
                )}

              {/* Key Vocabulary */}
              {generatedPlan.keyVocabulary &&
                renderSection(
                  "Key Vocabulary",
                  generatedPlan.keyVocabulary,
                  "pricetag-outline",
                  "keyVocabulary",
                )}

              {/* Core Competencies */}
              {generatedPlan.coreCompetencies && (
                <Animatable.View
                  animation="fadeInUp"
                  style={styles.resultSection}
                >
                  <View style={styles.sectionTitleRow}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <SVGIcon name="star-outline" size={20} color={primary} />
                      <Text style={styles.sectionTitle}>
                        Core Competencies (21st Century Skills)
                      </Text>
                    </View>
                  </View>
                  <View style={styles.competencyTags}>
                    {generatedPlan.coreCompetencies.map(
                      (comp: string, idx: number) => (
                        <View
                          key={idx}
                          style={[
                            styles.competencyTag,
                            {
                              backgroundColor: primary + "15",
                              borderColor: primary + "30",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.competencyTagText,
                              { color: primary },
                            ]}
                          >
                            {comp}
                          </Text>
                        </View>
                      ),
                    )}
                  </View>
                </Animatable.View>
              )}

              {/* Teaching Materials */}
              {generatedPlan.teachingMaterials &&
                renderSection(
                  "Teaching Materials/Resources",
                  generatedPlan.teachingMaterials,
                  "briefcase-outline",
                  "teachingMaterials",
                )}

              {/* Previous Knowledge */}
              {generatedPlan.previousKnowledge && (
                <View style={styles.resultSection}>
                  <View style={styles.sectionTitleRow}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <SVGIcon
                        name="refresh-outline"
                        size={20}
                        color={primary}
                      />
                      <Text style={styles.sectionTitle}>
                        Previous Knowledge Required
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.listText}>
                    {generatedPlan.previousKnowledge}
                  </Text>
                </View>
              )}

              {/* Introduction */}
              {generatedPlan.introduction &&
                renderSection(
                  "Introduction (Engage)",
                  generatedPlan.introduction,
                  "sunny-outline",
                  "introduction",
                )}

              {/* Main Activities (5E Model) */}
              {generatedPlan.mainActivities &&
                renderActivitiesSection(generatedPlan.mainActivities)}

              {/* Assessment */}
              {generatedPlan.assessment && (
                <Animatable.View
                  animation="fadeInUp"
                  style={styles.resultSection}
                >
                  <View style={styles.sectionTitleRow}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <SVGIcon
                        name="clipboard-outline"
                        size={20}
                        color={primary}
                      />
                      <Text style={styles.sectionTitle}>Assessment</Text>
                    </View>
                  </View>
                  {generatedPlan.assessment.formative && (
                    <View style={styles.subSection}>
                      <Text style={styles.subSectionTitle}>
                        Formative Assessment:
                      </Text>
                      {generatedPlan.assessment.formative.map(
                        (item: string, idx: number) => (
                          <View key={idx} style={styles.listItem}>
                            <Text style={[styles.bullet, { color: primary }]}>
                              •
                            </Text>
                            <Text style={styles.listText}>{item}</Text>
                          </View>
                        ),
                      )}
                    </View>
                  )}
                  {generatedPlan.assessment.summative && (
                    <View style={styles.subSection}>
                      <Text style={styles.subSectionTitle}>
                        Summative Assessment:
                      </Text>
                      {generatedPlan.assessment.summative.map(
                        (item: string, idx: number) => (
                          <View key={idx} style={styles.listItem}>
                            <Text style={[styles.bullet, { color: primary }]}>
                              •
                            </Text>
                            <Text style={styles.listText}>{item}</Text>
                          </View>
                        ),
                      )}
                    </View>
                  )}
                  {generatedPlan.assessment.assessmentCriteria && (
                    <View style={styles.subSection}>
                      <Text style={styles.subSectionTitle}>
                        Assessment Criteria:
                      </Text>
                      {Object.entries(
                        generatedPlan.assessment.assessmentCriteria,
                      ).map(([level, desc]) => (
                        <View key={level} style={styles.criteriaRow}>
                          <Text
                            style={[styles.criteriaLevel, { color: primary }]}
                          >
                            {level}:
                          </Text>
                          <Text style={styles.criteriaDesc}>
                            {String(desc)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </Animatable.View>
              )}

              {/* Conclusion */}
              {generatedPlan.conclusion &&
                renderSection(
                  "Conclusion (Evaluate)",
                  generatedPlan.conclusion,
                  "checkmark-circle-outline",
                  "conclusion",
                )}

              {/* Homework */}
              {generatedPlan.homework &&
                renderSection(
                  "Homework/Assignment",
                  generatedPlan.homework,
                  "book-outline",
                  "homework",
                )}

              {/* Cross-Curricular Links */}
              {generatedPlan.crossCurricularLinks && (
                <View style={styles.resultSection}>
                  <View style={styles.sectionTitleRow}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <SVGIcon name="link-outline" size={20} color={primary} />
                      <Text style={styles.sectionTitle}>
                        Cross-Curricular Links
                      </Text>
                    </View>
                  </View>
                  {generatedPlan.crossCurricularLinks.map(
                    (link: string, idx: number) => (
                      <View key={idx} style={styles.listItem}>
                        <Text style={[styles.bullet, { color: primary }]}>
                          •
                        </Text>
                        <Text style={styles.listText}>{link}</Text>
                      </View>
                    ),
                  )}
                </View>
              )}

              {/* Safety Considerations */}
              {generatedPlan.safetyConsiderations && (
                <View style={[styles.resultSection, styles.safetySection]}>
                  <View style={styles.sectionTitleRow}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <SVGIcon
                        name="warning-outline"
                        size={20}
                        color="#F59E0B"
                      />
                      <Text style={[styles.sectionTitle, { color: "#F59E0B" }]}>
                        Safety Considerations
                      </Text>
                    </View>
                  </View>
                  {generatedPlan.safetyConsiderations.map(
                    (item: string, idx: number) => (
                      <View key={idx} style={styles.listItem}>
                        <Text style={[styles.bullet, { color: "#F59E0B" }]}>
                          ⚠
                        </Text>
                        <Text style={styles.listText}>{item}</Text>
                      </View>
                    ),
                  )}
                </View>
              )}

              {/* Teacher Reflection */}
              {generatedPlan.teacherReflection && (
                <View style={[styles.resultSection, styles.reflectionSection]}>
                  <View style={styles.sectionTitleRow}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <SVGIcon
                        name="person-outline"
                        size={20}
                        color="#64748B"
                      />
                      <Text style={[styles.sectionTitle, { color: "#64748B" }]}>
                        Teacher Reflection (Post-Lesson)
                      </Text>
                    </View>
                  </View>
                  {generatedPlan.teacherReflection.map(
                    (item: string, idx: number) => (
                      <View key={idx} style={styles.listItem}>
                        <Text style={[styles.bullet, { color: "#64748B" }]}>
                          💭
                        </Text>
                        <Text style={styles.listText}>{item}</Text>
                      </View>
                    ),
                  )}
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: primary }]}
                  onPress={handleSaveToVault}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <SVGIcon
                        name="cloud-upload-outline"
                        size={20}
                        color="#fff"
                      />
                      <Text style={styles.saveBtnText}>
                        Save to Pedagogy Vault
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Edit Modal */}
      <Modal visible={!!editingField} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit {editingField?.title}</Text>
              <TouchableOpacity onPress={() => setEditingField(null)}>
                <SVGIcon name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalHint}>
              One point per line (or JSON for complex fields)
            </Text>
            <TextInput
              style={styles.editorInput}
              multiline
              value={editValue}
              onChangeText={setEditValue}
              placeholder="Type each point on a new line..."
            />
            <TouchableOpacity
              style={[styles.modalSaveBtn, { backgroundColor: primary }]}
              onPress={saveEdit}
            >
              <Text style={styles.modalSaveBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  headerText: { flex: 1 },
  title: { fontSize: 20, fontWeight: "900", color: "#1E293B" },
  subtitle: { fontSize: 12, color: "#64748B", marginTop: 2 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    marginBottom: 25,
  },
  curriculumBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#059669",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginBottom: 15,
    gap: 6,
  },
  curriculumBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: "row",
    marginBottom: 20,
  },
  label: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  usageTip: {
    backgroundColor: "#F1F5F9",
    padding: 10,
    borderRadius: 10,
    marginBottom: 20,
  },
  usageTipText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  input: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 15,
    fontSize: 15,
    color: "#1E293B",
    marginBottom: 20,
    fontWeight: "600",
    ...Platform.select({
      web: {
        outlineStyle: "none",
      } as any,
    }),
  },
  pickerContainer: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 20,
  },
  picker: {
    height: 50,
    width: "100%",
  },
  strandContainer: {
    marginBottom: 0,
  },
  strandListContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  strandOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  strandOptionSelected: {
    backgroundColor: "#05966915",
    borderColor: "#059669",
  },
  strandOptionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  strandOptionTextSelected: {
    color: "#059669",
    fontWeight: "700",
  },
  hintText: {
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 4,
    marginLeft: 4,
    fontStyle: "italic",
  },
  generateBtn: {
    flexDirection: "row",
    height: 55,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    ...SHADOWS.medium,
    marginTop: 10,
  },
  generateBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  resultsContainer: {
    gap: 20,
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  resultHeaderLeft: { flex: 1 },
  resultMainTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1E293B",
    marginBottom: 8,
  },
  resultMetaRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  metaBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  metaBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },
  standardCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
  },
  standardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  standardLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  standardText: {
    fontSize: 14,
    color: "#1E293B",
    fontWeight: "500",
    lineHeight: 20,
  },
  resultSection: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    width: isLargeScreen ? (width - 60) / 2 : "100%",
  },
  resultsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 20,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#1E293B",
  },
  listItem: {
    flexDirection: "row",
    marginBottom: 8,
    paddingRight: 10,
  },
  bullet: {
    fontSize: 18,
    marginRight: 10,
    marginTop: -2,
  },
  listText: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 20,
    fontWeight: "500",
    flex: 1,
  },
  bold: {
    fontWeight: "700",
  },
  subSection: {
    marginTop: 8,
    marginBottom: 8,
  },
  subSectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2c0964",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  activityCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  activityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  phaseBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  phaseText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  durationText: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
  },
  activityTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    marginTop: 8,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  competencyTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  competencyTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  competencyTagText: {
    fontSize: 11,
    fontWeight: "600",
  },
  criteriaRow: {
    flexDirection: "row",
    marginBottom: 6,
    gap: 8,
  },
  criteriaLevel: {
    fontSize: 12,
    fontWeight: "700",
    width: 80,
    textTransform: "capitalize",
  },
  criteriaDesc: {
    flex: 1,
    fontSize: 12,
    color: "#475569",
    lineHeight: 18,
  },
  safetySection: {
    borderWidth: 2,
    borderColor: "#F59E0B20",
    backgroundColor: "#FFFBEB",
  },
  reflectionSection: {
    borderWidth: 2,
    borderColor: "#64748B20",
    backgroundColor: "#F8FAFC",
  },
  actionButtons: {
    marginTop: 10,
  },
  saveBtn: {
    flexDirection: "row",
    height: 55,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    ...SHADOWS.medium,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    height: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1E293B",
  },
  modalHint: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 15,
    fontWeight: "600",
  },
  editorInput: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    borderRadius: 20,
    padding: 20,
    fontSize: 16,
    color: "#1E293B",
    textAlignVertical: "top",
    fontWeight: "500",
    ...Platform.select({
      web: {
        outlineStyle: "none",
      } as any,
    }),
  },
  modalSaveBtn: {
    height: 55,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    ...SHADOWS.medium,
  },
  modalSaveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  indicatorListContainer: {
    maxHeight: 150,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 8,
    marginBottom: 8,
    backgroundColor: "#F8FAFC",
  },
  indicatorCheckbox: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  indicatorCheckboxSelected: {
    backgroundColor: "#F1F5F9",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    marginTop: 2,
  },
  indicatorText: {
    flex: 1,
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
    fontWeight: "500",
  },
  noSubjectContainer: {
    alignItems: "center",
    padding: 20,
    gap: 10,
  },
  noSubjectText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1E293B",
  },
  noSubjectSubtext: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
  },
});
