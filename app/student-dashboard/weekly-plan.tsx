import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from "firebase/firestore";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebaseConfig";

interface WeeklyTopic {
  id: string;
  subject: string;
  topic: string;
  weekStarting: string;
}

export default function WeeklyPlanScreen() {
  const router = useRouter();
  const { appUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [topics, setTopics] = useState<WeeklyTopic[]>([]);

  const fetchWeeklyPlan = async () => {
    if (!appUser?.classId || !appUser?.schoolId) return;

    try {
      setLoading(true);
      // Lesson plans are saved in 'pedagogy_vault'
      const q = query(
        collection(db, "pedagogy_vault"),
        where("schoolId", "==", appUser.schoolId),
        where("classLevel", "==", appUser.classId), // Teacher uses 'classLevel' field
        orderBy("createdAt", "desc"),
        limit(30) // Fetch slightly more to account for multiple subjects
      );

      const querySnapshot = await getDocs(q);
      // Process to keep only the latest topic per subject
      const latestBySubject: Record<string, WeeklyTopic> = {};

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const subject = data.subject;
        if (!latestBySubject[subject]) {
          latestBySubject[subject] = {
            id: doc.id,
            subject: data.subject,
            topic: data.topic || data.title || "No topic specified",
            weekStarting: data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString() : "This week",
          };
        }
      });

      setTopics(Object.values(latestBySubject));
    } catch (error) {
      console.error("Error fetching weekly plan:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWeeklyPlan();
  }, [appUser?.classId]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchWeeklyPlan();
  };

  const renderItem = ({ item, index }: { item: WeeklyTopic; index: number }) => (
    <Animatable.View
      animation="fadeInUp"
      duration={500}
      delay={index * 100}
      style={styles.card}
    >
      <View style={[styles.accent, { backgroundColor: getSubjectColor(item.subject) }]} />
      <View style={styles.cardContent}>
        <Text style={styles.subjectText}>{item.subject.toUpperCase()}</Text>
        <Text style={styles.topicText}>{item.topic}</Text>
        <View style={styles.footer}>
          <SVGIcon name="calendar-outline" size={14} color="#94A3B8" />
          <Text style={styles.dateText}>{item.weekStarting}</Text>
        </View>
      </View>
    </Animatable.View>
  );

  const getSubjectColor = (subject: string) => {
    const s = subject.toLowerCase();
    if (s.includes("math")) return "#EF4444";
    if (s.includes("eng")) return "#3B82F6";
    if (s.includes("sci")) return "#10B981";
    if (s.includes("art")) return "#F59E0B";
    if (s.includes("his")) return "#8B5CF6";
    return COLORS.primary;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <SVGIcon name="arrow-back" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Weekly Topics</Text>
          <Text style={styles.subtitle}>Your learning roadmap</Text>
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={topics}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <SVGIcon name="book-outline" size={60} color="#E2E8F0" />
              <Text style={styles.emptyText}>No topics updated for this week yet.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#FFF",
    ...SHADOWS.small,
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
  title: { fontSize: 24, fontWeight: "900", color: "#1E293B" },
  subtitle: { fontSize: 14, color: "#64748B", fontWeight: "600" },
  listContent: { padding: 20 },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    marginBottom: 15,
    flexDirection: "row",
    overflow: "hidden",
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  accent: { width: 6 },
  cardContent: { flex: 1, padding: 18 },
  subjectText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#94A3B8",
    letterSpacing: 1,
    marginBottom: 4,
  },
  topicText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1E293B",
    marginBottom: 10,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dateText: { fontSize: 12, color: "#94A3B8", fontWeight: "600" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyContainer: {
    alignItems: "center",
    marginTop: 100,
    paddingHorizontal: 40,
  },
  emptyText: {
    textAlign: "center",
    color: "#94A3B8",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 20,
  },
});
