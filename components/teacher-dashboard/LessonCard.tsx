import React from "react";
import { View, Text, StyleSheet } from "react-native";
import SVGIcon from "../SVGIcon";
import { SHADOWS } from "../../constants/theme";

interface Lesson {
  id: string;
  subject: string;
  startTime: string;
  endTime: string;
}

const SUBJECT_COLORS: Record<string, string> = {
  Mathematics: "#E0F2FE",
  English: "#FEE2E2",
  Science: "#DCFCE7",
  "Social Studies": "#FEF9C3",
  Computing: "#F3E8FF",
  RME: "#FFEDD5",
  "Creative Arts": "#FAE8FF",
  French: "#F1F5F9",
  History: "#FEF3C7",
  "Career Technology": "#E0E7FF",
  "Practical Life": "#F1F5F9",
  Sensorial: "#FAE8FF",
  Language: "#FEE2E2",
  Culture: "#FEF3C7",
  Break: "#F1F5F9",
  Lunch: "#F1F5F9",
  "Physical Education": "#ECFDF5",
  ICT: "#E0F2FE",
  Biology: "#DCFCE7",
  Chemistry: "#FEF9C3",
  Physics: "#F3E8FF",
  Economics: "#FFEDD5",
  "Business Studies": "#E0E7FF",
  Geography: "#ECFDF5",
  DEFAULT: "#F8FAFC",
};

const getSubjectColor = (subject: string) =>
  SUBJECT_COLORS[subject] || SUBJECT_COLORS.DEFAULT;

interface LessonCardProps {
  lesson: Lesson;
  brandColor: string;
  type?: "lesson" | "other";
}

export const LessonCard = React.memo(
  ({ lesson, brandColor, type = "lesson" }: LessonCardProps) => {
    const bgColor = getSubjectColor(lesson.subject);
    const isOther = type === "other";

    return (
      <View
        style={[
          styles.lessonCard,
          {
            backgroundColor: isOther
              ? "#F1F5F9"
              : bgColor === "#F8FAFC"
              ? "#fff"
              : bgColor,
          },
          isOther && { borderStyle: "dashed" },
        ]}
      >
        <View
          style={[styles.timeColumn, { borderRightColor: "rgba(0,0,0,0.05)" }]}
        >
          <Text style={styles.startTime}>
            {lesson.startTime?.split(" ")[0] || "--"}
          </Text>
          <Text style={styles.amPm}>
            {lesson.startTime?.split(" ")[1] || ""}
          </Text>
        </View>
        <View style={styles.lessonInfo}>
          <Text style={[styles.lessonSubject, isOther && { color: "#64748B" }]}>
            {lesson.subject}
          </Text>
          <View style={styles.durationRow}>
            <SVGIcon
              name="time-outline"
              size={12}
              color={isOther ? "#94A3B8" : "#64748B"}
            />
            <Text style={styles.durationText}>
              {lesson.startTime} – {lesson.endTime}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.statusIndicator,
            { backgroundColor: isOther ? "#94A3B8" : brandColor },
          ]}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  lessonCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#fff",
    marginBottom: 12,
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.03)",
  },
  timeColumn: {
    width: 65,
    borderRightWidth: 1,
    alignItems: "center",
    marginRight: 15,
    paddingRight: 10,
  },
  startTime: { fontSize: 16, fontWeight: "900", color: "#1E293B" },
  amPm: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#94A3B8",
    textTransform: "uppercase",
  },
  lessonInfo: { flex: 1 },
  lessonSubject: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
  durationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
  },
  durationText: { fontSize: 12, color: "#64748B", fontWeight: "500" },
  statusIndicator: { width: 4, height: 30, borderRadius: 2, marginLeft: 10 },
});
