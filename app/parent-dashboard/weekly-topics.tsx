import React, { useRef } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import moment from "moment";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useStudentWeeklyTopics } from "../../hooks/student-dashboard/useStudentWeeklyTopics";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { useAuth } from "../../contexts/AuthContext";

export default function ParentWeeklyTopicsScreen() {
  const router = useRouter();
  const { appUser } = useAuth();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;
  const isNavigating = useRef(false);

  const {
    loading,
    topics,
    selectedWeek,
    setSelectedWeek,
    weekRange,
    curriculum,
    childrenList,
    selectedChildId,
    setSelectedChildId,
  } = useStudentWeeklyTopics();

  const brandColor = SCHOOL_CONFIG.primaryColor || COLORS.primary;

  const getLabels = (topicCurriculum: string | undefined) => {
    const activeCurr = topicCurriculum || curriculum || "GES";
    switch (activeCurr) {
      case "Cambridge":
        return {
          topic: "Unit / Topic",
          strand: "Syllabus Reference",
          subStrand: "Learning Objective Ref",
          indicator: "Success Criteria Code",
          indicatorItem: "Success Criteria Statement",
          subTopics: "Lesson Content",
          objectives: "Key Learning Outcomes",
        };
      case "Montessori":
        return {
          topic: "Area of Interest",
          strand: "Material / Apparatus",
          subStrand: "Lesson Type",
          indicator: "Control Code",
          indicatorItem: "Control Statement",
          subTopics: "Presentation",
          objectives: "Indirect Aim",
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
          objectives: "Learning Objectives",
        };
    }
  };

  const changeWeek = (weeks: number) => {
    const newWeek = moment(selectedWeek)
      .add(weeks, "weeks")
      .startOf("isoWeek")
      .format("YYYY-MM-DD");
    setSelectedWeek(newWeek);
  };

  const handleBack = () => {
    if (isNavigating.current) return;
    isNavigating.current = true;

    try {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/parent-dashboard");
      }
    } catch (e) {
      router.replace("/parent-dashboard");
    }

    setTimeout(() => {
      isNavigating.current = false;
    }, 500);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={brandColor} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View style={[styles.headerInner, isLargeScreen && styles.maxContent]}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <SVGIcon name="arrow-back" size={24} color={brandColor} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: brandColor }]}>
              Weekly Learning Topics 📚
            </Text>
            <Text style={styles.subtitle}>
              Class Curriculum & Lesson Plans
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.replace("/parent-dashboard")}
            style={[styles.homeBtn, { backgroundColor: brandColor + "15" }]}
            activeOpacity={0.7}
          >
            <SVGIcon name="home" size={20} color={brandColor} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent,
          isLargeScreen && styles.maxContent,
        ]}
      >
        {/* Child Selector */}
        {childrenList && childrenList.length > 0 && (
          <View style={styles.childPickerContainer}>
            <Text style={styles.childPickerLabel}>SELECT WARD:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10 }}
            >
              {childrenList.map((child) => {
                const isActive = child.id === selectedChildId;
                return (
                  <TouchableOpacity
                    key={child.id}
                    onPress={() => setSelectedChildId(child.id)}
                    style={[
                      styles.childChip,
                      isActive && {
                        backgroundColor: brandColor,
                        borderColor: brandColor,
                      },
                    ]}
                    activeOpacity={0.8}
                  >
                    <SVGIcon
                      name="person"
                      size={14}
                      color={isActive ? "#fff" : brandColor}
                    />
                    <Text
                      style={[
                        styles.childChipText,
                        isActive && { color: "#fff" },
                      ]}
                    >
                      {child.name}{" "}
                      {child.className ? `(${child.className})` : ""}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Week Picker */}
        <View style={styles.weekPickerContainer}>
          <View style={styles.weekPicker}>
            <TouchableOpacity
              onPress={() => changeWeek(-1)}
              style={styles.weekNavBtn}
              activeOpacity={0.7}
            >
              <SVGIcon name="chevron-back" size={20} color="#64748B" />
            </TouchableOpacity>

            <View style={styles.weekInfo}>
              <View style={styles.dateRow}>
                <View style={styles.dateBox}>
                  <Text style={styles.dateLabel}>WEEK START</Text>
                  <Text style={styles.dateValue}>
                    {moment(weekRange.start).format("ddd, MMM D")}
                  </Text>
                </View>
                <View style={styles.dateDivider} />
                <View style={styles.dateBox}>
                  <Text style={styles.dateLabel}>WEEK ENDING</Text>
                  <Text style={styles.dateValue}>
                    {moment(weekRange.end).format("ddd, MMM D")}
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => changeWeek(1)}
              style={styles.weekNavBtn}
              activeOpacity={0.7}
            >
              <SVGIcon name="chevron-forward" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Topics List */}
        {topics.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <SVGIcon name="book-outline" size={56} color="#CBD5E1" />
            </View>
            <Text style={styles.emptyTitle}>No Topics Uploaded Yet</Text>
            <Text style={styles.emptyText}>
              Teachers have not uploaded lesson topics for this week yet.
              Check back soon or select another week.
            </Text>
          </View>
        ) : (
          <View style={styles.topicsGrid}>
            {topics.map((topic, index) => {
              const labels = getLabels(topic.curriculum);
              return (
                <Animatable.View
                  key={topic.id}
                  animation="fadeInUp"
                  delay={index * 100}
                  style={styles.topicCard}
                >
                  <View
                    style={[
                      styles.subjectHeader,
                      { borderLeftColor: brandColor },
                    ]}
                  >
                    <View>
                      <Text style={styles.subjectName}>{topic.subject}</Text>
                      {topic.className ? (
                        <Text style={styles.classNameText}>
                          {topic.className}
                        </Text>
                      ) : null}
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 6,
                        alignItems: "center",
                      }}
                    >
                      {topic.weekNumber ? (
                        <View style={styles.weekTag}>
                          <Text style={styles.weekTagText}>
                            Week {topic.weekNumber}
                          </Text>
                        </View>
                      ) : null}
                      {topic.curriculum && (
                        <View style={styles.curriculumTag}>
                          <Text style={styles.curriculumTagText}>
                            {topic.curriculum}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={styles.topicContent}>
                    <View style={styles.contentSection}>
                      <Text style={styles.sectionLabel}>{labels.topic}</Text>
                      <Text style={styles.topicTitle}>{topic.topic}</Text>
                    </View>

                    <View style={styles.row}>
                      {topic.strand && (
                        <View style={[styles.contentSection, { flex: 1 }]}>
                          <Text style={styles.sectionLabel}>{labels.strand}</Text>
                          <Text style={styles.sectionText}>{topic.strand}</Text>
                        </View>
                      )}
                      {topic.subStrand && (
                        <View style={[styles.contentSection, { flex: 1 }]}>
                          <Text style={styles.sectionLabel}>
                            {labels.subStrand}
                          </Text>
                          <Text style={styles.sectionText}>{topic.subStrand}</Text>
                        </View>
                      )}
                    </View>

                    {topic.indicatorCode && (
                      <View style={styles.contentSection}>
                        <Text style={styles.sectionLabel}>
                          {labels.indicator}
                        </Text>
                        <View style={styles.indicatorCodeBadge}>
                          <Text style={styles.indicatorCodeText}>
                            {topic.indicatorCode}
                          </Text>
                        </View>
                      </View>
                    )}

                    {topic.indicator ? (
                      <View style={styles.contentSection}>
                        <Text style={styles.sectionLabel}>
                          {labels.indicatorItem}
                        </Text>
                        <Text style={styles.sectionText}>{topic.indicator}</Text>
                      </View>
                    ) : null}

                    {topic.objectives ? (
                      <View style={styles.contentSection}>
                        <Text style={styles.sectionLabel}>
                          {labels.objectives}
                        </Text>
                        <Text style={styles.sectionText}>
                          {topic.objectives}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </Animatable.View>
              );
            })}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  maxContent: { width: "100%", maxWidth: 1100, alignSelf: "center" },
  header: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  headerInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    gap: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
  },
  homeBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 20, fontWeight: "900" },
  subtitle: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "700",
    textTransform: "uppercase",
    marginTop: 2,
  },
  scrollContent: { padding: 20 },
  childPickerContainer: { marginBottom: 20 },
  childPickerLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#94A3B8",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 2,
  },
  childChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...SHADOWS.small,
  },
  childChipText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1E293B",
  },
  weekPickerContainer: { marginBottom: 25 },
  weekPicker: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 10,
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  weekNavBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
  },
  weekInfo: { flex: 1, paddingHorizontal: 10 },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  dateBox: { alignItems: "center", flex: 1 },
  dateLabel: { fontSize: 9, fontWeight: "900", color: "#94A3B8", marginBottom: 2 },
  dateValue: { fontSize: 14, fontWeight: "800", color: "#1E293B" },
  dateDivider: {
    width: 1,
    height: 30,
    backgroundColor: "#E2E8F0",
    marginHorizontal: 15,
  },
  topicsGrid: { gap: 20 },
  topicCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    overflow: "hidden",
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  subjectHeader: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderLeftWidth: 5,
    backgroundColor: "#F8FAFC",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  subjectName: { fontSize: 18, fontWeight: "900", color: "#1E293B" },
  classNameText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    marginTop: 2,
  },
  weekTag: {
    backgroundColor: "#3B82F615",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  weekTagText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#2563EB",
    letterSpacing: 0.5,
  },
  curriculumTag: {
    backgroundColor: COLORS.primary + "15",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  curriculumTagText: {
    fontSize: 9,
    fontWeight: "800",
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  topicContent: { padding: 20 },
  contentSection: { marginBottom: 15 },
  row: { flexDirection: "row", gap: 15 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#94A3B8",
    textTransform: "uppercase",
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  indicatorCodeBadge: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.primary + "15",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 2,
  },
  indicatorCodeText: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  topicTitle: { fontSize: 16, fontWeight: "800", color: "#1E293B" },
  sectionText: { fontSize: 14, color: "#475569", lineHeight: 20 },
  emptyState: { alignItems: "center", marginTop: 60, paddingHorizontal: 30 },
  emptyIconBox: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: "900", color: "#1E293B" },
  emptyText: {
    fontSize: 13,
    color: "#94A3B8",
    marginTop: 6,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 18,
  },
});
