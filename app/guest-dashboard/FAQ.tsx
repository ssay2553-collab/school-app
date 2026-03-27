// /guest-dashboard/FAQ.tsx
import { Ionicons } from "@expo/vector-icons";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Animatable from "react-native-animatable";
import { COLORS } from "../../constants/theme";
import { db } from "../../firebaseConfig";

const faqKeys = [
  "mission_vision",
  "established",
  "school_hours",
  "location",
  "grades_offered",
  "student_teacher_ratio",
  "apply_admission",
  "admission_requirements",
  "entrance_exam",
  "school_fees",
  "scholarships",
  "academic_year_start",
  "curriculum",
  "extra_classes",
  "learning_support",
  "sports_programs",
  "clubs_societies",
  "arts_programs",
  "safety_measures",
  "transportation",
];

// Utility: Convert key to readable question
const formatQuestion = (key: string) =>
  key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

export default function FAQ() {
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(true);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFAQs() {
      const loaded: { [key: string]: string } = {};
      for (const key of faqKeys) {
        const ref = doc(db, "faqs", key);
        const snap = await getDoc(ref);
        const data = snap.data() as { answer?: string } | undefined;
        loaded[key] = data?.answer ?? "Answer not available yet.";
      }
      setAnswers(loaded);
      setLoading(false);
    }
    fetchFAQs();
  }, []);

  const toggleExpand = (key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 10 }}>Loading FAQs...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {faqKeys.map((key) => {
        const isExpanded = expandedKey === key;
        return (
          <View key={key} style={styles.card}>
            <TouchableOpacity style={styles.questionRow} onPress={() => toggleExpand(key)}>
              <Text style={styles.question}>{formatQuestion(key)}</Text>
              <Ionicons
                name="chevron-down-outline"
                size={20}
                color="#333"
                style={{ transform: [{ rotate: isExpanded ? "180deg" : "0deg" }] }}
              />
            </TouchableOpacity>

            {isExpanded && (
              <Animatable.View animation="fadeInDown" duration={300} style={{ marginTop: 8 }}>
                <Text style={styles.answer}>{answers[key]}</Text>
              </Animatable.View>
            )}
          </View>
        );
      })}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 15, backgroundColor: COLORS.backgroundPrimary },
  card: {
    backgroundColor: "#fff",
    padding: 15,
    marginBottom: 12,
    borderRadius: 10,
    elevation: 2,
  },
  questionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  question: { fontWeight: "bold", fontSize: 16, color: "#333" },
  answer: { fontSize: 14, color: "#444", lineHeight: 20 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
