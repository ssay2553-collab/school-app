import React from "react";
import {
  ActivityIndicator,
  Platform,
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
import { useRef } from "react";

export default function StudentWeeklyTopicsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;
  const isNavigating = useRef(false);

  const {
    loading,
    topics,
    selectedWeek,
    setSelectedWeek,
    weekRange,
  } = useStudentWeeklyTopics();

  const brandColor = SCHOOL_CONFIG.brandPrimary || COLORS.primary;

  const changeWeek = (weeks: number) => {
    const newWeek = moment(selectedWeek).add(weeks, "weeks").startOf("isoWeek").format("YYYY-MM-DD");
    setSelectedWeek(newWeek);
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
            onPress={() => {
              if (isNavigating.current) return;
              isNavigating.current = true;
              router.back();
            }}
            style={styles.backBtn}
          >
            <SVGIcon name="arrow-back" size={24} color="#1E293B" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Weekly Topics</Text>
            <Text style={styles.subtitle}>What we are learning this week</Text>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.scrollContent, isLargeScreen && styles.maxContent]}>
        <View style={styles.weekPickerContainer}>
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

        {topics.length === 0 ? (
          <View style={styles.emptyState}>
            <SVGIcon name="book-outline" size={60} color="#CBD5E1" />
            <Text style={styles.emptyText}>No topics uploaded for this week yet.</Text>
          </View>
        ) : (
          <View style={styles.topicsGrid}>
            {topics.map((topic, index) => (
              <Animatable.View
                key={topic.id}
                animation="fadeInUp"
                delay={index * 100}
                style={styles.topicCard}
              >
                <View style={[styles.subjectHeader, { borderLeftColor: brandColor }]}>
                  <Text style={styles.subjectName}>{topic.subject}</Text>
                </View>

                <View style={styles.topicContent}>
                  <View style={styles.contentSection}>
                    <Text style={styles.sectionLabel}>Main Topic</Text>
                    <Text style={styles.topicTitle}>{topic.topic}</Text>
                  </View>

                  {topic.subTopics && (
                    <View style={styles.contentSection}>
                      <Text style={styles.sectionLabel}>Sub-topics & Activities</Text>
                      <Text style={styles.sectionText}>{topic.subTopics}</Text>
                    </View>
                  )}

                  {topic.objectives && (
                    <View style={styles.contentSection}>
                      <Text style={styles.sectionLabel}>Objectives</Text>
                      <Text style={styles.sectionText}>{topic.objectives}</Text>
                    </View>
                  )}
                </View>
              </Animatable.View>
            ))}
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
  header: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  headerInner: { flexDirection: "row", alignItems: "center", padding: 20 },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#F8FAFC", justifyContent: "center", alignItems: "center", marginRight: 15 },
  title: { fontSize: 20, fontWeight: "900", color: "#1E293B" },
  subtitle: { fontSize: 12, color: "#64748B", fontWeight: "700", textTransform: "uppercase" },
  scrollContent: { padding: 20 },
  weekPickerContainer: { marginBottom: 25 },
  weekPicker: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 20, padding: 10, ...SHADOWS.medium, borderWidth: 1, borderColor: "#E2E8F0" },
  weekNavBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#F8FAFC", justifyContent: "center", alignItems: "center" },
  weekInfo: { flex: 1, paddingHorizontal: 10 },
  dateRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  dateBox: { alignItems: "center", flex: 1 },
  dateLabel: { fontSize: 9, fontWeight: "900", color: "#94A3B8", marginBottom: 2 },
  dateValue: { fontSize: 14, fontWeight: "800", color: "#1E293B" },
  dateDivider: { width: 1, height: 30, backgroundColor: "#E2E8F0", marginHorizontal: 15 },
  topicsGrid: { gap: 20 },
  topicCard: { backgroundColor: "#fff", borderRadius: 24, overflow: "hidden", ...SHADOWS.medium, borderWidth: 1, borderColor: "#F1F5F9" },
  subjectHeader: { paddingHorizontal: 20, paddingVertical: 15, borderLeftWidth: 5, backgroundColor: "#F8FAFC" },
  subjectName: { fontSize: 18, fontWeight: "900", color: "#1E293B" },
  topicContent: { padding: 20 },
  contentSection: { marginBottom: 15 },
  sectionLabel: { fontSize: 10, fontWeight: "900", color: "#94A3B8", textTransform: "uppercase", marginBottom: 4, letterSpacing: 0.5 },
  topicTitle: { fontSize: 16, fontWeight: "800", color: "#1E293B" },
  sectionText: { fontSize: 14, color: "#475569", lineHeight: 20 },
  emptyState: { alignItems: "center", marginTop: 60 },
  emptyText: { fontSize: 14, color: "#94A3B8", marginTop: 15, fontWeight: "600", textAlign: "center" },
});
