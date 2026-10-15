import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
  Alert,
  BackHandler,
  Modal,
} from "react-native";
// Conditional import for DateTimePicker to support Web/Electron
const DateTimePicker = Platform.OS !== 'web' ? require('@react-native-community/datetimepicker').default : null;

import { useRouter } from "expo-router";
import moment from "moment";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useWeeklyTopics } from "../../hooks/teacher-dashboard/useWeeklyTopics";
import { CurriculumBrowserModal } from "../../components/teacher-dashboard/CurriculumBrowserModal";
import { getPedagogySuggestions } from "../../constants/Pedagogy";
import { useToast } from "../../contexts/ToastContext";
import { copyToClipboard } from "../../utils/copyToClipboard";
import { useRef } from "react";

export default function WeeklyTopicsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { showToast } = useToast();
  const isWeb = Platform.OS === "web";
  const isLargeScreen = width > 768;

  const [isViewMode, setIsViewMode] = useState(false);

  const {
    loading,
    saving,
    teacherClasses,
    selectedClassId,
    setSelectedClassId,
    selectedSubject,
    setSelectedSubject,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    weekNumber,
    setWeekNumber,
    topicData,
    setTopicData,
    performLookup,
    saveTopic,
    hasUnsavedChanges,
    subjects,
    curriculum,
    lookupStatus,
    clearTopicData,
    isLookingUp,
    isBrowserVisible,
    setIsBrowserVisible,
    handleBrowserSelect,
  } = useWeeklyTopics();

  const selectedClassName = useMemo(() => {
    return teacherClasses.find(c => c.id === selectedClassId)?.name || "";
  }, [teacherClasses, selectedClassId]);

  const pedagogyTier = useMemo(() => {
    return getPedagogySuggestions(selectedClassName);
  }, [selectedClassName]);

  const addChipValue = (field: keyof typeof topicData, value: string) => {
    const current = (topicData[field] as string) || "";
    if (!current.trim()) {
      setTopicData(prev => ({ ...prev, [field]: value }));
    } else if (!current.includes(value)) {
      setTopicData(prev => ({ ...prev, [field]: `${current}, ${value}` }));
    }
  };

  const labels = useMemo(() => {
    switch (curriculum) {
      case "Cambridge":
        return {
          topic: "Unit / Topic",
          strand: "Syllabus Reference",
          subStrand: "Learning Objective Ref",
          indicator: "Success Criteria Code",
          indicatorItem: "Success Criteria Statement",
          subTopics: "Lesson Content / Activities",
          objectives: "Key Learning Outcomes"
        };
      case "Montessori":
        return {
          topic: "Area of Interest",
          strand: "Material / Apparatus",
          subStrand: "Lesson Type",
          indicator: "Control Code",
          indicatorItem: "Control of Error / Statement",
          subTopics: "Direct Aim / Presentation",
          objectives: "Indirect Aim / Purpose"
        };
      case "GES":
      default:
        return {
          topic: "Week Topic / Content Standard",
          strand: "Strand",
          subStrand: "Sub-strand",
          indicator: "Indicator Code",
          indicatorItem: "Indicator Item / Statement",
          subTopics: "Sub-topics & Activities",
          objectives: "Learning Objectives"
        };
    }
  }, [curriculum]);

  const handleCopyText = async () => {
    const text = `
========================================
LESSON PLAN: ${selectedClassName || "Class"} - ${selectedSubject || "Subject"}
========================================
Week ${weekNumber || "N/A"}: ${moment(startDate).format("MMM D, YYYY")} - ${moment(endDate).format("MMM D, YYYY")}
Curriculum: ${curriculum}

1. CURRICULUM STANDARDS
----------------------------------------
• ${labels.topic}: ${topicData.topic || "N/A"}
• ${labels.strand}: ${topicData.strand || "N/A"}
• ${labels.subStrand}: ${topicData.subStrand || "N/A"}
• ${labels.indicator}: ${topicData.indicatorCode || "N/A"} - ${topicData.indicator || "N/A"}

2. SCOPE & LEARNING OBJECTIVES
----------------------------------------
• ${labels.subTopics}:
  ${topicData.subTopics || "N/A"}

• ${labels.objectives}:
  ${topicData.objectives || "N/A"}

3. PEDAGOGY & MATERIALS
----------------------------------------
• Teaching Method: ${topicData.teachingMethod || "N/A"}
• Required TLMs: ${topicData.tlmRequired || "N/A"}

4. LESSON DELIVERY PHASES
----------------------------------------
• Phase 1 (Lesson Starter / RPK):
  ${topicData.starterActivity || "N/A"}

• Phase 2 (Core Lesson Activities):
  ${topicData.coreActivities || "N/A"}

• Phase 3 (Assessment & Reflection):
  ${topicData.assessmentMethod || "N/A"}
========================================
`.trim();

    const ok = await copyToClipboard(text);
    if (ok) {
      showToast({ message: "Lesson plan copied to clipboard! 📋", type: "success" });
    } else {
      showToast({ message: "Failed to copy text", type: "error" });
    }
  };

  const webInputStyle = Platform.OS === 'web' ? {
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #E2E8F0',
    fontSize: '16px',
    width: '100%',
    marginBottom: '10px'
  } : {};

  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const isMounted = useRef(true);
  const isNavigating = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const handleBack = useCallback(() => {
    if (isNavigating.current) return true;
    isNavigating.current = true;

    const performBack = () => {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/teacher-dashboard");
      }
      setTimeout(() => {
        isNavigating.current = false;
      }, 500);
    };

    if (hasUnsavedChanges) {
      if (Platform.OS === "web") {
        if (window.confirm("You have unsaved changes in your planning. Do you want to discard them?")) {
          performBack();
        } else {
          isNavigating.current = false;
        }
      } else {
        Alert.alert(
          "Discard Changes?",
          "You have unsaved changes in your planning. Do you want to discard them?",
          [
            {
              text: "Keep Editing",
              style: "cancel",
              onPress: () => {
                isNavigating.current = false;
              }
            },
            {
              text: "Discard",
              style: "destructive",
              onPress: performBack,
            },
          ]
        );
      }
    } else {
      performBack();
    }
    return true;
  }, [hasUnsavedChanges, router]);

  useEffect(() => {
    const onBackPress = () => {
      handleBack();
      return true;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [handleBack]);

  const changeWeek = (weeks: number) => {
    const newStart = moment(startDate).add(weeks, "weeks").startOf("isoWeek");
    setStartDate(newStart.format("YYYY-MM-DD"));
    setEndDate(newStart.clone().add(4, "days").format("YYYY-MM-DD"));
  };

  const onStartDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS !== 'web') {
      setShowStartDatePicker(Platform.OS === 'ios');
    }
    if (selectedDate) {
      setStartDate(moment(selectedDate).format("YYYY-MM-DD"));
    }
  };

  const onEndDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS !== 'web') {
      setShowEndDatePicker(Platform.OS === 'ios');
    }
    if (selectedDate) {
      setEndDate(moment(selectedDate).format("YYYY-MM-DD"));
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View style={[styles.headerInner, isLargeScreen && styles.maxContent]}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <SVGIcon name="arrow-back" size={24} color="#1E293B" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Weekly Planning</Text>
            <Text style={styles.subtitle}>Subject-Based Lesson Topics</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <TouchableOpacity
              style={styles.headerViewPlanBtn}
              onPress={() => setIsViewMode(true)}
            >
              <SVGIcon name="eye-outline" size={18} color={COLORS.primary} />
              <Text style={styles.headerViewPlanText}>View Plan</Text>
            </TouchableOpacity>

            {hasUnsavedChanges && (
              <TouchableOpacity
                style={[styles.headerSaveBtn, saving && styles.disabledBtn]}
                onPress={saveTopic}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.headerSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.scrollContent, isLargeScreen && styles.maxContent]}>
        <View style={isLargeScreen ? styles.webLayout : null}>
          <View style={isLargeScreen ? styles.sidebar : null}>
            <View style={styles.section}>
              <Text style={styles.label}>1. Select Class</Text>
              <ScrollView
                horizontal={!isLargeScreen}
                showsHorizontalScrollIndicator={false}
                style={styles.chipScroll}
                contentContainerStyle={isLargeScreen && styles.verticalChipContainer}
              >
                {teacherClasses.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => setSelectedClassId(c.id)}
                    style={[styles.chip, selectedClassId === c.id && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, selectedClassId === c.id && styles.chipTextActive]}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>2. Select Subject</Text>
              <ScrollView
                horizontal={!isLargeScreen}
                showsHorizontalScrollIndicator={false}
                style={styles.chipScroll}
                contentContainerStyle={isLargeScreen && styles.verticalChipContainer}
              >
                {subjects.map((s: string) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setSelectedSubject(s)}
                    style={[styles.chip, selectedSubject === s && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, selectedSubject === s && styles.chipTextActive]}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          <View style={isLargeScreen ? styles.mainForm : null}>
            <View style={styles.weekPickerContainer}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={styles.label}>3. Week Duration & Number</Text>
                <View style={styles.weekNumInputContainer}>
                  <Text style={styles.weekNumLabel}>Week:</Text>
                  <TextInput
                    style={styles.weekNumInput}
                    placeholder="e.g. 1"
                    value={weekNumber}
                    onChangeText={setWeekNumber}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <View style={styles.weekPicker}>
                <TouchableOpacity onPress={() => changeWeek(-1)} style={styles.weekNavBtn}>
                  <SVGIcon name="chevron-back" size={20} color="#64748B" />
                </TouchableOpacity>

                <View style={styles.weekInfo}>
                  <View style={styles.dateRow}>
                    <TouchableOpacity onPress={() => setShowStartDatePicker(true)} style={styles.dateBox}>
                      <Text style={styles.dateLabel}>WEEK START</Text>
                      <Text style={styles.dateValue}>{moment(startDate).format("ddd, MMM D")}</Text>
                    </TouchableOpacity>
                    <View style={styles.dateDivider} />
                    <TouchableOpacity onPress={() => setShowEndDatePicker(true)} style={styles.dateBox}>
                      <Text style={styles.dateLabel}>WEEK ENDING</Text>
                      <Text style={styles.dateValue}>{moment(endDate).format("ddd, MMM D")}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity onPress={() => changeWeek(1)} style={styles.weekNavBtn}>
                  <SVGIcon name="chevron-forward" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              {showStartDatePicker && (
                Platform.OS === 'web' ? (
                  <View style={styles.webDatePickerContainer}>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setShowStartDatePicker(false);
                      }}
                      style={webInputStyle}
                    />
                    <TouchableOpacity onPress={() => setShowStartDatePicker(false)} style={styles.webCloseBtn}>
                      <Text style={styles.webCloseBtnText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <DateTimePicker
                    value={moment(startDate).toDate()}
                    mode="date"
                    display="default"
                    onChange={onStartDateChange}
                  />
                )
              )}
              {showEndDatePicker && (
                Platform.OS === 'web' ? (
                  <View style={styles.webDatePickerContainer}>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setShowEndDatePicker(false);
                      }}
                      style={webInputStyle}
                    />
                    <TouchableOpacity onPress={() => setShowEndDatePicker(false)} style={styles.webCloseBtn}>
                      <Text style={styles.webCloseBtnText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <DateTimePicker
                    value={moment(endDate).toDate()}
                    mode="date"
                    display="default"
                    onChange={onEndDateChange}
                  />
                )
              )}
            </View>

            <Animatable.View animation="fadeInUp" duration={600} style={styles.formCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <View style={styles.curriculumBadge}>
                  <Text style={styles.curriculumBadgeText}>{curriculum} CURRICULUM</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setIsViewMode(true)}
                  style={styles.cardViewBtn}
                >
                  <SVGIcon name="document-text-outline" size={15} color={COLORS.primary} />
                  <Text style={styles.cardViewBtnText}>View Lesson Plan</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{labels.topic}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={`Enter the main ${labels.topic.toLowerCase()}...`}
                  value={topicData.topic}
                  onChangeText={(text) => setTopicData({ ...topicData, topic: text })}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 15, marginBottom: 25 }}>
                <View style={[styles.inputGroup, { flex: 1, marginBottom: 0 }]}>
                  <Text style={styles.inputLabel}>{labels.strand}</Text>
                  <TextInput
                    style={[styles.input, { fontSize: 14 }]}
                    placeholder={labels.strand}
                    value={topicData.strand}
                    onChangeText={(text) => setTopicData({ ...topicData, strand: text })}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginBottom: 0 }]}>
                  <Text style={styles.inputLabel}>{labels.subStrand}</Text>
                  <TextInput
                    style={[styles.input, { fontSize: 14 }]}
                    placeholder={labels.subStrand}
                    value={topicData.subStrand}
                    onChangeText={(text) => setTopicData({ ...topicData, subStrand: text })}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={[styles.inputLabel, { marginBottom: 0 }]}>{labels.indicator}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => setIsBrowserVisible(true)}
                      style={styles.browseCurriculumBtn}
                    >
                      <SVGIcon name="book-outline" size={13} color={COLORS.primary} />
                      <Text style={styles.browseCurriculumText}>Browse Curriculum</Text>
                    </TouchableOpacity>
                    {curriculum === "GES" && (
                      <View style={[
                        styles.smartBadge,
                        lookupStatus === 'success' && { backgroundColor: '#05966915' },
                        lookupStatus === 'not_found' && { backgroundColor: '#DC262615' }
                      ]}>
                        <SVGIcon
                          name={lookupStatus === 'success' ? "checkmark-circle" : lookupStatus === 'not_found' ? "alert-circle" : "flash"}
                          size={12}
                          color={lookupStatus === 'success' ? "#059669" : lookupStatus === 'not_found' ? "#DC2626" : COLORS.primary}
                        />
                        <Text style={[
                          styles.smartBadgeText,
                          lookupStatus === 'success' && { color: "#059669" },
                          lookupStatus === 'not_found' && { color: "#DC2626" }
                        ]}>
                          {lookupStatus === 'success' ? "MATCHED" : lookupStatus === 'not_found' ? "NO MATCH" : "SMART LOOKUP"}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.indicatorInputWrapper}>
                  <TextInput
                    style={[styles.input, { flex: 1 }, lookupStatus === 'not_found' && { borderColor: '#DC2626' }]}
                    placeholder="e.g. B1.1.1.1.1"
                    value={topicData.indicatorCode}
                    onChangeText={(text) => setTopicData({ ...topicData, indicatorCode: text })}
                    onSubmitEditing={() => performLookup()}
                    onBlur={() => {
                      if (topicData.indicatorCode && topicData.indicatorCode.trim().length >= 4) {
                        performLookup();
                      }
                    }}
                    returnKeyType="search"
                  />

                  {topicData.indicatorCode !== "" && (
                    <TouchableOpacity
                      onPress={clearTopicData}
                      style={styles.clearInlineBtn}
                    >
                      <SVGIcon name="close-circle" size={20} color="#94A3B8" />
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    onPress={() => performLookup()}
                    style={[styles.lookupInlineBtn, isLookingUp && { opacity: 0.7 }]}
                    disabled={isLookingUp}
                  >
                    {isLookingUp ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <SVGIcon name="search" size={18} color="#fff" />
                    )}
                  </TouchableOpacity>

                  {lookupStatus === 'success' && (
                    <Animatable.View animation="bounceIn" style={[styles.checkIcon, { right: 55 }]}>
                      <SVGIcon name="checkmark-circle" size={20} color="#059669" />
                    </Animatable.View>
                  )}
                </View>
                {curriculum === "GES" && (
                  <Text style={[styles.hintText, lookupStatus === 'not_found' && { color: '#DC2626', fontWeight: '800' }]}>
                    {lookupStatus === 'not_found'
                      ? "Indicator code not found in local database. Please fill details manually."
                      : "Enter NaCCA code to auto-fill Strand, Sub-strand, Indicator Statement & Objectives"}
                  </Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{labels.indicatorItem}</Text>
                <TextInput
                  style={[styles.input, { minHeight: 70 }]}
                  placeholder={`Official ${labels.indicatorItem.toLowerCase()}...`}
                  value={topicData.indicator}
                  onChangeText={(text) => setTopicData({ ...topicData, indicator: text })}
                  multiline
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{labels.subTopics}</Text>
                <TextInput
                  style={[styles.input, { minHeight: 80 }]}
                  placeholder="Details of what will be covered..."
                  value={topicData.subTopics}
                  onChangeText={(text) => setTopicData({ ...topicData, subTopics: text })}
                  multiline
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{labels.objectives}</Text>
                <TextInput
                  style={[styles.input, { minHeight: 90 }]}
                  placeholder="Expected outcomes for students..."
                  value={topicData.objectives}
                  onChangeText={(text) => setTopicData({ ...topicData, objectives: text })}
                  multiline
                />
              </View>

              {/* --- PEDAGOGICAL & LESSON DELIVERY SECTIONS --- */}
              <View style={styles.pedagogyHeaderContainer}>
                <View style={styles.pedagogyBadge}>
                  <SVGIcon name="bulb-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.pedagogyBadgeText}>PEDAGOGY & LESSON DELIVERY</Text>
                </View>
                <Text style={styles.pedagogyTierText}>{pedagogyTier.tierName}</Text>
              </View>

              {/* 1. Teaching Method */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>TEACHING METHOD / PEDAGOGY</Text>
                <Text style={styles.suggestionTitle}>Tap suggestion to add:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionScroll}>
                  {pedagogyTier.teachingMethods.map((m, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.suggestionChip}
                      onPress={() => addChipValue('teachingMethod', m)}
                    >
                      <Text style={styles.suggestionChipText}>+ {m}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TextInput
                  style={[styles.input, { minHeight: 70 }]}
                  placeholder="e.g. Demonstration, Group Discussion, Play-Based..."
                  value={topicData.teachingMethod}
                  onChangeText={(text) => setTopicData({ ...topicData, teachingMethod: text })}
                  multiline
                />
              </View>

              {/* 2. Required TLMs */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>REQUIRED TLM (TEACHING & LEARNING MATERIALS)</Text>
                <Text style={styles.suggestionTitle}>Tap suggestion to add:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionScroll}>
                  {pedagogyTier.tlms.map((t, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.suggestionChip}
                      onPress={() => addChipValue('tlmRequired', t)}
                    >
                      <Text style={styles.suggestionChipText}>+ {t}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TextInput
                  style={[styles.input, { minHeight: 70 }]}
                  placeholder="e.g. Wall Charts, Realia, Counters, Flashcards..."
                  value={topicData.tlmRequired}
                  onChangeText={(text) => setTopicData({ ...topicData, tlmRequired: text })}
                  multiline
                />
              </View>

              {/* 3. Starter Activity (Phase 1) */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>PHASE 1: LESSON STARTER / RPK ACTIVITY</Text>
                <Text style={styles.suggestionTitle}>Tap suggestion to add:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionScroll}>
                  {pedagogyTier.starterActivities.map((s, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.suggestionChip}
                      onPress={() => addChipValue('starterActivity', s)}
                    >
                      <Text style={styles.suggestionChipText}>+ {s}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TextInput
                  style={[styles.input, { minHeight: 80 }]}
                  placeholder="How to introduce the lesson and test Relevant Previous Knowledge..."
                  value={topicData.starterActivity}
                  onChangeText={(text) => setTopicData({ ...topicData, starterActivity: text })}
                  multiline
                />
              </View>

              {/* 4. Core Delivery (Phase 2) */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>PHASE 2: CORE LESSON ACTIVITIES</Text>
                <Text style={styles.suggestionTitle}>Tap suggestion to add:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionScroll}>
                  {pedagogyTier.coreActivities.map((c, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.suggestionChip}
                      onPress={() => addChipValue('coreActivities', c)}
                    >
                      <Text style={styles.suggestionChipText}>+ {c}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TextInput
                  style={[styles.input, { minHeight: 100 }]}
                  placeholder="Step-by-step core teacher and learner activities during main delivery..."
                  value={topicData.coreActivities}
                  onChangeText={(text) => setTopicData({ ...topicData, coreActivities: text })}
                  multiline
                />
              </View>

              {/* 5. Assessment & Reflection (Phase 3) */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>PHASE 3: ASSESSMENT & REFLECTION</Text>
                <Text style={styles.suggestionTitle}>Tap suggestion to add:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionScroll}>
                  {pedagogyTier.assessmentMethods.map((a, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.suggestionChip}
                      onPress={() => addChipValue('assessmentMethod', a)}
                    >
                      <Text style={styles.suggestionChipText}>+ {a}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TextInput
                  style={[styles.input, { minHeight: 80 }]}
                  placeholder="Class exercise, oral questions, peer review, homework..."
                  value={topicData.assessmentMethod}
                  onChangeText={(text) => setTopicData({ ...topicData, assessmentMethod: text })}
                  multiline
                />
              </View>

              {/* Bottom Actions Row */}
              <View style={styles.bottomActionsRow}>
                <TouchableOpacity
                  style={styles.viewPlanMainBtn}
                  onPress={() => setIsViewMode(true)}
                >
                  <SVGIcon name="eye" size={20} color={COLORS.primary} />
                  <Text style={styles.viewPlanMainBtnText}>View Full Lesson Plan</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.savePlanMainBtn, saving && styles.disabledBtn]}
                  onPress={saveTopic}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <SVGIcon name="checkmark-circle" size={20} color="#fff" />
                      <Text style={styles.savePlanMainBtnText}>
                        {hasUnsavedChanges ? "Save Changes" : "Saved"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </Animatable.View>
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* --- READ-ONLY LESSON PLAN VIEW MODAL --- */}
      <Modal
        visible={isViewMode}
        animationType="slide"
        onRequestClose={() => setIsViewMode(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
          <StatusBar barStyle="dark-content" />

          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View style={[styles.modalHeaderInner, isLargeScreen && styles.maxContent]}>
              <TouchableOpacity
                onPress={() => setIsViewMode(false)}
                style={styles.backBtn}
              >
                <SVGIcon name="close" size={24} color="#1E293B" />
              </TouchableOpacity>

              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Lesson Plan View</Text>
                <Text style={styles.subtitle}>Read-Only Document</Text>
              </View>

              <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                <TouchableOpacity
                  onPress={handleCopyText}
                  style={styles.iconActionBtn}
                >
                  <SVGIcon name="copy-outline" size={20} color="#1E293B" />
                </TouchableOpacity>

                {Platform.OS === "web" && (
                  <TouchableOpacity
                    onPress={() => window.print()}
                    style={styles.iconActionBtn}
                  >
                    <SVGIcon name="print-outline" size={20} color="#1E293B" />
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={() => setIsViewMode(false)}
                  style={styles.modalEditBtn}
                >
                  <SVGIcon name="create-outline" size={18} color="#fff" />
                  <Text style={styles.modalEditBtnText}>Edit</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Modal Body */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[
              styles.scrollContent,
              isLargeScreen && styles.maxContent,
            ]}
          >
            <View style={styles.readOnlyDocument}>
              {/* Document Title Header */}
              <View style={styles.docHeader}>
                <View style={styles.docCurriculumBadge}>
                  <Text style={styles.docCurriculumText}>
                    {curriculum} CURRICULUM
                  </Text>
                </View>

                <Text style={styles.docTitle}>
                  {selectedClassName || "Class"} – {selectedSubject || "Subject"}
                </Text>

                <View style={styles.docMetaRow}>
                  <View style={styles.docMetaItem}>
                    <SVGIcon name="calendar-outline" size={14} color="#64748B" />
                    <Text style={styles.docMetaText}>
                      Week {weekNumber || "–"}: {moment(startDate).format("MMM D")} – {moment(endDate).format("MMM D, YYYY")}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.docDivider} />

              {/* Section 1: Curriculum & Standard Reference */}
              <View style={styles.docSection}>
                <Text style={styles.docSectionTitle}>1. CURRICULUM STANDARDS</Text>

                <View style={styles.docGrid}>
                  <View style={styles.docGridItem}>
                    <Text style={styles.docLabel}>{labels.topic}</Text>
                    <Text style={styles.docValue}>{topicData.topic || "Not specified"}</Text>
                  </View>

                  <View style={{ flexDirection: "row", gap: 15 }}>
                    <View style={[styles.docGridItem, { flex: 1 }]}>
                      <Text style={styles.docLabel}>{labels.strand}</Text>
                      <Text style={styles.docValue}>{topicData.strand || "Not specified"}</Text>
                    </View>
                    <View style={[styles.docGridItem, { flex: 1 }]}>
                      <Text style={styles.docLabel}>{labels.subStrand}</Text>
                      <Text style={styles.docValue}>{topicData.subStrand || "Not specified"}</Text>
                    </View>
                  </View>

                  <View style={styles.docGridItem}>
                    <Text style={styles.docLabel}>{labels.indicator}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      {topicData.indicatorCode ? (
                        <View style={styles.codeTag}>
                          <Text style={styles.codeTagText}>{topicData.indicatorCode}</Text>
                        </View>
                      ) : null}
                      <Text style={[styles.docValue, { flex: 1 }]}>
                        {topicData.indicator || "Not specified"}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Section 2: Scope & Objectives */}
              <View style={styles.docSection}>
                <Text style={styles.docSectionTitle}>2. SCOPE & LEARNING OBJECTIVES</Text>

                <View style={styles.docCardBlock}>
                  <Text style={styles.docLabel}>{labels.subTopics}</Text>
                  <Text style={styles.docBodyText}>{topicData.subTopics || "Not specified"}</Text>
                </View>

                <View style={styles.docCardBlock}>
                  <Text style={styles.docLabel}>{labels.objectives}</Text>
                  <Text style={styles.docBodyText}>{topicData.objectives || "Not specified"}</Text>
                </View>
              </View>

              {/* Section 3: Pedagogy & Materials */}
              <View style={styles.docSection}>
                <Text style={styles.docSectionTitle}>3. PEDAGOGY & TEACHING MATERIALS</Text>

                <View style={{ flexDirection: isLargeScreen ? "row" : "column", gap: 15 }}>
                  <View style={[styles.docCardBlock, { flex: 1 }]}>
                    <Text style={styles.docLabel}>TEACHING METHOD / PEDAGOGY</Text>
                    <Text style={styles.docBodyText}>{topicData.teachingMethod || "Not specified"}</Text>
                  </View>

                  <View style={[styles.docCardBlock, { flex: 1 }]}>
                    <Text style={styles.docLabel}>REQUIRED TLM (MATERIALS)</Text>
                    <Text style={styles.docBodyText}>{topicData.tlmRequired || "Not specified"}</Text>
                  </View>
                </View>
              </View>

              {/* Section 4: 3-Phase Lesson Delivery */}
              <View style={styles.docSection}>
                <Text style={styles.docSectionTitle}>4. LESSON DELIVERY PHASES</Text>

                <View style={styles.phaseCard}>
                  <View style={styles.phaseHeader}>
                    <View style={[styles.phaseDot, { backgroundColor: "#FF6B6B" }]} />
                    <Text style={styles.phaseTitle}>PHASE 1: LESSON STARTER / RPK</Text>
                  </View>
                  <Text style={styles.docBodyText}>{topicData.starterActivity || "Not specified"}</Text>
                </View>

                <View style={styles.phaseCard}>
                  <View style={styles.phaseHeader}>
                    <View style={[styles.phaseDot, { backgroundColor: "#4D96FF" }]} />
                    <Text style={styles.phaseTitle}>PHASE 2: CORE LESSON ACTIVITIES</Text>
                  </View>
                  <Text style={styles.docBodyText}>{topicData.coreActivities || "Not specified"}</Text>
                </View>

                <View style={styles.phaseCard}>
                  <View style={styles.phaseHeader}>
                    <View style={[styles.phaseDot, { backgroundColor: "#6BCB77" }]} />
                    <Text style={styles.phaseTitle}>PHASE 3: ASSESSMENT & REFLECTION</Text>
                  </View>
                  <Text style={styles.docBodyText}>{topicData.assessmentMethod || "Not specified"}</Text>
                </View>
              </View>

            </View>

            <View style={{ height: 60 }} />
          </ScrollView>

          {/* Modal Bottom Bar */}
          <View style={styles.modalFooter}>
            <View style={[styles.modalFooterInner, isLargeScreen && styles.maxContent]}>
              <TouchableOpacity
                style={styles.modalSecondaryBtn}
                onPress={handleCopyText}
              >
                <SVGIcon name="copy-outline" size={18} color="#1E293B" />
                <Text style={styles.modalSecondaryBtnText}>Copy Plan Text</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalPrimaryBtn}
                onPress={() => setIsViewMode(false)}
              >
                <SVGIcon name="create-outline" size={18} color="#fff" />
                <Text style={styles.modalPrimaryBtnText}>Edit Lesson Plan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      <CurriculumBrowserModal
        visible={isBrowserVisible}
        onClose={() => setIsBrowserVisible(false)}
        onSelect={handleBrowserSelect}
        initialSubject={selectedSubject}
        initialClass={teacherClasses.find(c => c.id === selectedClassId)?.name}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  maxContent: { width: "100%", maxWidth: 1100, alignSelf: "center" },
  header: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F1F5F9", zIndex: 10 },
  headerInner: { flexDirection: "row", alignItems: "center", padding: 20 },
  headerSaveBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 12,
    ...SHADOWS.small,
  },
  headerSaveText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
  disabledBtn: {
    opacity: 0.6,
  },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#F8FAFC", justifyContent: "center", alignItems: "center", marginRight: 15 },
  title: { fontSize: 20, fontWeight: "900", color: "#1E293B" },
  subtitle: { fontSize: 12, color: "#64748B", fontWeight: "700", textTransform: "uppercase" },
  scrollContent: { padding: 20 },
  webLayout: { flexDirection: "row", gap: 30 },
  sidebar: { width: 250 },
  mainForm: { flex: 1 },
  section: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: "900", color: "#64748B", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  chipScroll: { marginBottom: 5 },
  verticalChipContainer: { flexDirection: "column", gap: 10 },
  chip: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0", marginRight: 10, ...SHADOWS.small },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: "800", color: "#64748B" },
  chipTextActive: { color: "#fff" },
  weekPickerContainer: { marginBottom: 20 },
  weekPicker: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 20, padding: 10, ...SHADOWS.medium, borderWidth: 1, borderColor: "#E2E8F0" },
  weekNavBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#F8FAFC", justifyContent: "center", alignItems: "center" },
  weekInfo: { flex: 1, paddingHorizontal: 10 },
  dateRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  dateBox: { alignItems: "center", flex: 1 },
  dateLabel: { fontSize: 9, fontWeight: "900", color: "#94A3B8", marginBottom: 2 },
  dateValue: { fontSize: 14, fontWeight: "800", color: "#1E293B" },
  weekNumInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.small,
  },
  weekNumLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    marginRight: 6,
  },
  weekNumInput: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.primary,
    width: 40,
    padding: 0,
    textAlign: 'center',
  },
  dateDivider: { width: 1, height: 30, backgroundColor: "#E2E8F0", marginHorizontal: 15 },
  webDatePickerContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.medium,
    alignItems: 'center',
    gap: 10,
  },
  webCloseBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 8,
  },
  webCloseBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  formCard: { backgroundColor: "#fff", borderRadius: 24, padding: 25, ...SHADOWS.medium, borderWidth: 1, borderColor: "#F1F5F9" },
  curriculumBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 20,
  },
  curriculumBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 1,
  },
  inputGroup: { marginBottom: 25 },
  inputLabel: { fontSize: 13, fontWeight: "900", color: "#1E293B", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { backgroundColor: "#F8FAFC", borderRadius: 16, padding: 18, fontSize: 16, color: "#1E293B", borderWidth: 1, borderColor: "#E2E8F0", textAlignVertical: "top" },
  indicatorInputWrapper: { flexDirection: 'row', alignItems: 'center', position: 'relative' },
  lookupInlineBtn: { backgroundColor: COLORS.primary, height: 48, width: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginLeft: 8, ...SHADOWS.small },
  clearInlineBtn: { position: 'absolute', right: 65, zIndex: 5, padding: 5 },
  checkIcon: { position: 'absolute', right: 15 },
  smartBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary + '10', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4 },
  smartBadgeText: { fontSize: 9, fontWeight: '900', color: COLORS.primary },
  browseCurriculumBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primary + '10', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  browseCurriculumText: { fontSize: 9, fontWeight: '900', color: COLORS.primary },
  hintText: { fontSize: 10, color: '#94A3B8', marginTop: 8, fontWeight: '600', fontStyle: 'italic' },
  pedagogyHeaderContainer: {
    marginTop: 15,
    marginBottom: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  pedagogyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  pedagogyBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  pedagogyTierText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
  },
  suggestionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  suggestionScroll: {
    marginBottom: 10,
  },
  suggestionChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  suggestionChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  footer: { position: "absolute", bottom: 25, left: 20, right: 20, alignItems: "center" },
  saveBtn: { backgroundColor: COLORS.primary, height: 65, borderRadius: 22, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, width: "100%", maxWidth: 450, ...SHADOWS.large },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 0.5 },

  // View mode & Modal styles
  headerViewPlanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.primary + "15",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary + "30",
  },
  headerViewPlanText: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.primary,
  },
  cardViewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.primary + "10",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  cardViewBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.primary,
  },
  bottomActionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 25,
    alignItems: "center",
  },
  viewPlanMainBtn: {
    flex: 1,
    height: 54,
    borderRadius: 18,
    backgroundColor: COLORS.primary + "12",
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  viewPlanMainBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.primary,
  },
  savePlanMainBtn: {
    flex: 1,
    height: 54,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...SHADOWS.medium,
  },
  savePlanMainBtnText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#fff",
  },

  modalHeader: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    zIndex: 10,
  },
  modalHeaderInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
  },
  iconActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  modalEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    ...SHADOWS.small,
  },
  modalEditBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  readOnlyDocument: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 25,
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  docHeader: {
    marginBottom: 20,
  },
  docCurriculumBadge: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.primary + "15",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 12,
  },
  docCurriculumText: {
    fontSize: 10,
    fontWeight: "900",
    color: COLORS.primary,
    letterSpacing: 1,
  },
  docTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 8,
  },
  docMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 15,
  },
  docMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  docMetaText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
  docDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 20,
  },
  docSection: {
    marginBottom: 25,
  },
  docSectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.primary,
    letterSpacing: 1,
    marginBottom: 14,
    textTransform: "uppercase",
  },
  docGrid: {
    gap: 14,
  },
  docGridItem: {
    backgroundColor: "#F8FAFC",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  docLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  docValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
  },
  codeTag: {
    backgroundColor: COLORS.primary + "15",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  codeTagText: {
    fontSize: 11,
    fontWeight: "900",
    color: COLORS.primary,
  },
  docCardBlock: {
    backgroundColor: "#F8FAFC",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    marginBottom: 12,
  },
  docBodyText: {
    fontSize: 14,
    color: "#334155",
    lineHeight: 22,
    fontWeight: "500",
  },
  phaseCard: {
    backgroundColor: "#F8FAFC",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 12,
  },
  phaseHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  phaseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  phaseTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: "#1E293B",
    letterSpacing: 0.5,
  },
  modalFooter: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  modalFooterInner: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  modalSecondaryBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  modalSecondaryBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E293B",
  },
  modalPrimaryBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...SHADOWS.small,
  },
  modalPrimaryBtnText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#fff",
  },
});
