import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  SafeAreaView,
  StatusBar
} from "react-native";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../../firebaseConfig";
import { COLORS, SHADOWS } from "../../constants/theme";
import SVGIcon from "../../components/SVGIcon";
import { useRouter } from "expo-router";
import { useToast } from "../../contexts/ToastContext";

// FAQ document IDs
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

export default function FAQEditor() {
  const router = useRouter();
  const { showToast } = useToast();
  const [faqData, setFaqData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    const loadFAQs = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          showToast({ message: "Please log in again.", type: "error" });
          setLoading(false);
          return;
        }

        const loaded: Record<string, string> = {};
        for (const key of faqKeys) {
          const ref = doc(db, "faqs", key);
          const snap = await getDoc(ref);
          loaded[key] = snap.exists() ? String(snap.data()?.answer ?? "") : "";
        }
        setFaqData(loaded);
      } catch (error: any) {
        console.error("FAQ load error:", error);
        showToast({ message: "You do not have permission to view or edit FAQs.", type: "error" });
      } finally {
        setLoading(false);
      }
    };
    loadFAQs();
  }, []);

  const saveFAQ = async (key: string) => {
    try {
      setSavingKey(key);
      await setDoc(doc(db, "faqs", key), { answer: faqData[key] || "" }, { merge: true });
      showToast({ message: "FAQ updated successfully.", type: "success" });
    } catch (error) {
      console.error("Save FAQ error:", error);
      showToast({ message: "Could not save FAQ.", type: "error" });
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading Knowledge Base...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <SVGIcon name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Knowledge Base</Text>
          <Text style={styles.headerSubtitle}>Edit school FAQs & Information</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {faqKeys.map((key) => (
          <View key={key} style={styles.card}>
            <View style={styles.cardHeader}>
               <Text style={styles.label}>{key.replace(/_/g, " ").toUpperCase()}</Text>
               {savingKey === key && <ActivityIndicator size="small" color={COLORS.primary} />}
            </View>

            <TextInput
              style={styles.input}
              multiline
              value={faqData[key]}
              onChangeText={(text) => setFaqData((prev) => ({ ...prev, [key]: text }))}
              placeholder="Enter details here..."
              placeholderTextColor="#94A3B8"
            />

            <TouchableOpacity
              style={[styles.saveBtn, { opacity: savingKey === key ? 0.7 : 1 }]}
              onPress={() => saveFAQ(key)}
              disabled={savingKey === key}
            >
              <Text style={styles.saveText}>Update Entry</Text>
            </TouchableOpacity>
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 12, color: "#64748B", fontWeight: "600" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 25,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primary + "10",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  headerTitle: { fontSize: 22, fontWeight: "bold", color: "#0F172A" },
  headerSubtitle: { fontSize: 13, color: "#64748B", marginTop: 2 },
  scrollContent: { padding: 20 },
  card: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  label: {
    fontWeight: "800",
    fontSize: 11,
    color: COLORS.primary,
    letterSpacing: 1,
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 15,
    minHeight: 100,
    fontSize: 15,
    color: "#1E293B",
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  saveBtn: {
    marginTop: 15,
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  saveText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
});
