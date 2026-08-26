import React, { useState, useCallback, useEffect } from "react";
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
} from "react-native";
// Conditional import for DateTimePicker to support Web/Electron
const DateTimePicker = Platform.OS !== 'web' ? require('@react-native-community/datetimepicker').default : null;

import { useRouter } from "expo-router";
import moment from "moment";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useWeeklyTopics } from "../../hooks/teacher-dashboard/useWeeklyTopics";
import { useRef } from "react";

export default function WeeklyTopicsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  const isLargeScreen = width > 768;

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
    saveTopic,
    hasUnsavedChanges,
    subjects,
  } = useWeeklyTopics();

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
    if (hasUnsavedChanges) {
      Alert.alert(
        "Discard Changes?",
        "You have unsaved changes in your planning. Do you want to discard them?",
        [
          { text: "Keep Editing", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              isNavigating.current = false;
              router.back();
            },
          },
        ]
      );
      return true;
    }
    router.back();
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
                    onPress={() => {
                      if (isNavigating.current) return;
                      isNavigating.current = true;
                      setSelectedClassId(c.id);
                      setTimeout(() => { isNavigating.current = false; }, 500);
                    }}
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
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Topic for the Week</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter the main lesson topic..."
                  value={topicData.topic}
                  onChangeText={(text) => setTopicData({ ...topicData, topic: text })}
                  multiline
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Sub-topics / Activities</Text>
                <TextInput
                  style={[styles.input, { minHeight: 80 }]}
                  placeholder="Details of what will be covered..."
                  value={topicData.subTopics}
                  onChangeText={(text) => setTopicData({ ...topicData, subTopics: text })}
                  multiline
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Learning Objectives</Text>
                <TextInput
                  style={[styles.input, { minHeight: 100 }]}
                  placeholder="Expected outcomes for students..."
                  value={topicData.objectives}
                  onChangeText={(text) => setTopicData({ ...topicData, objectives: text })}
                  multiline
                />
              </View>
            </Animatable.View>
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
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
  inputGroup: { marginBottom: 25 },
  inputLabel: { fontSize: 13, fontWeight: "900", color: "#1E293B", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { backgroundColor: "#F8FAFC", borderRadius: 16, padding: 18, fontSize: 16, color: "#1E293B", borderWidth: 1, borderColor: "#E2E8F0", textAlignVertical: "top" },
  footer: { position: "absolute", bottom: 25, left: 20, right: 20, alignItems: "center" },
  saveBtn: { backgroundColor: COLORS.primary, height: 65, borderRadius: 22, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, width: "100%", maxWidth: 450, ...SHADOWS.large },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 0.5 },
});
