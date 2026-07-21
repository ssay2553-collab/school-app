import React from "react";
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
} from "react-native";
import { useRouter } from "expo-router";
import moment from "moment";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useWeeklyTopics } from "../../hooks/teacher-dashboard/useWeeklyTopics";

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
    startDate: selectedWeek,
    setStartDate: setSelectedWeek,
    endDate,
    setEndDate,
    topicData,
    setTopicData,
    saveTopic,
    hasUnsavedChanges,
    subjects,
  } = useWeeklyTopics();

  const weekRange = {
    start: selectedWeek,
    end: endDate
  };

  const changeWeek = (weeks: number) => {
    const newWeek = moment(selectedWeek).add(weeks, "weeks").startOf("isoWeek").format("YYYY-MM-DD");
    setSelectedWeek(newWeek);
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
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <SVGIcon name="arrow-back" size={24} color="#1E293B" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Weekly Planning</Text>
            <Text style={styles.subtitle}>Subject-Based Lesson Topics</Text>
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
              <Text style={styles.label}>3. Week Duration</Text>
              <View style={styles.weekPicker}>
                <TouchableOpacity onPress={() => changeWeek(-1)} style={styles.weekNavBtn}>
                  <SVGIcon name="chevron-back" size={20} color="#64748B" />
                </TouchableOpacity>

                <View style={styles.weekInfo}>
                  <View style={styles.dateRow}>
                    <View style={styles.dateBox}>
                      <Text style={styles.dateLabel}>WEEK START</Text>
                      <Text style={styles.dateValue}>{moment(weekRange.start).format("ddd, MMM D")}</Text>
                    </View>
                    <View style={styles.dateDivider} />
                    <View style={styles.dateBox}>
                      <Text style={styles.dateLabel}>WEEK ENDING</Text>
                      <Text style={styles.dateValue}>{moment(weekRange.end).format("ddd, MMM D")}</Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity onPress={() => changeWeek(1)} style={styles.weekNavBtn}>
                  <SVGIcon name="chevron-forward" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>
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

      {hasUnsavedChanges && (
        <Animatable.View animation="slideInUp" duration={400} style={[styles.footer, isLargeScreen && styles.maxContent]}>
          <TouchableOpacity style={styles.saveBtn} onPress={saveTopic} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <SVGIcon name="cloud-upload" size={20} color="#fff" />
                <Text style={styles.saveBtnText}>Save Weekly Lesson Plan</Text>
              </>
            )}
          </TouchableOpacity>
        </Animatable.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  maxContent: { width: "100%", maxWidth: 1100, alignSelf: "center" },
  header: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F1F5F9", zIndex: 10 },
  headerInner: { flexDirection: "row", alignItems: "center", padding: 20 },
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
  dateDivider: { width: 1, height: 30, backgroundColor: "#E2E8F0", marginHorizontal: 15 },
  formCard: { backgroundColor: "#fff", borderRadius: 24, padding: 25, ...SHADOWS.medium, borderWidth: 1, borderColor: "#F1F5F9" },
  inputGroup: { marginBottom: 25 },
  inputLabel: { fontSize: 13, fontWeight: "900", color: "#1E293B", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { backgroundColor: "#F8FAFC", borderRadius: 16, padding: 18, fontSize: 16, color: "#1E293B", borderWidth: 1, borderColor: "#E2E8F0", textAlignVertical: "top" },
  footer: { position: "absolute", bottom: 25, left: 20, right: 20, alignItems: "center" },
  saveBtn: { backgroundColor: COLORS.primary, height: 65, borderRadius: 22, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, width: "100%", maxWidth: 450, ...SHADOWS.large },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 0.5 },
});
