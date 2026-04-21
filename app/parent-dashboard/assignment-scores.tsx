import { useRouter } from "expo-router";
import {
    Timestamp,
    collection,
    doc,
    getDoc,
    getDocsFromCache,
    getDocsFromServer,
    limit,
    orderBy,
    query,
    startAfter,
    where,
} from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebaseConfig";

interface ScoreRecord {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  subjectId: string;
  marks: number;
  markedAt: Timestamp;
  studentName: string;
  responses?: Record<number, string>;
  questionScores?: Record<number, number>;
  type: "standard" | "mcq" | "short_answer";
}

interface AssignmentDetails {
  questions: { text: string; options?: string[] }[];
}

const PAGE_SIZE = 10;

export default function AssignmentScores() {
  const { appUser } = useAuth();
  const router = useRouter();
  const [scores, setScores] = useState<ScoreRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [assignmentMeta, setAssignmentMeta] = useState<Record<string, AssignmentDetails>>({});
  const [fetchingDetails, setFetchingDetails] = useState(false);

  const lastVisible = useRef<any>(null);
  const hasMore = useRef(true);

  const cutoff = useMemo(() => {
    const hundredDaysAgo = new Date();
    hundredDaysAgo.setDate(hundredDaysAgo.getDate() - 100);
    return Timestamp.fromDate(hundredDaysAgo);
  }, []);

  const childrenIdsKey = JSON.stringify(appUser?.childrenIds || []);

  const fetchScores = useCallback(
    async (isNextPage = false) => {
      const childrenIds = appUser?.childrenIds || [];
      if (childrenIds.length === 0) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (isNextPage && !hasMore.current) return;

      if (isNextPage) setLoadingMore(true);
      else {
        setLoading(true);
        lastVisible.current = null;
        hasMore.current = true;
      }

      try {
        const qConstraints: any[] = [
          where("studentId", "in", childrenIds.slice(0, 30)),
          where("marked", "==", true),
          where("markedAt", ">=", cutoff),
          orderBy("markedAt", "desc"),
          limit(PAGE_SIZE),
        ];

        if (isNextPage && lastVisible.current) {
          qConstraints.push(startAfter(lastVisible.current));
        }

        const q = query(collection(db, "submissions"), ...qConstraints);

        let snap;
        try {
          // For complex queries with 'in' and 'orderBy', cache results can be flaky or slow.
          // We'll try server first if cache is likely to be empty or outdated.
          snap = await getDocsFromServer(q);
        } catch (serverError) {
          console.warn("Server fetch failed, trying cache...", serverError);
          snap = await getDocsFromCache(q);
        }

        const data = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        })) as ScoreRecord[];

        if (isNextPage) setScores((prev) => [...prev, ...data]);
        else setScores(data);

        lastVisible.current = snap.docs[snap.docs.length - 1];
        hasMore.current = snap.docs.length === PAGE_SIZE;
      } catch (error) {
        console.error("Error fetching parent scores:", error);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [childrenIdsKey, cutoff],
  );

  useEffect(() => {
    if (appUser) {
      fetchScores();
    } else {
      // If no user, stop loading to show empty state
      setLoading(false);
    }
  }, [fetchScores, appUser]);

  const toggleExpand = async (item: ScoreRecord) => {
    if (expandedId === item.id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(item.id);

    if (!assignmentMeta[item.assignmentId] && item.type !== "standard") {
      setFetchingDetails(true);
      try {
        const docRef = doc(db, "assignments", item.assignmentId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setAssignmentMeta(prev => ({
            ...prev,
            [item.assignmentId]: docSnap.data() as AssignmentDetails
          }));
        }
      } catch (e) {
        console.error("Error fetching assignment meta:", e);
      } finally {
        setFetchingDetails(false);
      }
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchScores();
  };

  const renderScoreItem = ({ item, index }: { item: ScoreRecord; index: number }) => {
    const isExpanded = expandedId === item.id;
    const details = assignmentMeta[item.assignmentId];
    
    return (
      <Animatable.View animation="fadeInUp" delay={index * 50} key={item.id} style={styles.card}>
        <TouchableOpacity onPress={() => toggleExpand(item)} activeOpacity={0.8}>
          <View style={styles.cardHeader}>
            <View style={[styles.subjectBadge, { backgroundColor: COLORS.primary + "15" }]}>
              <Text style={[styles.subjectText, { color: COLORS.primary }]}>{item.subjectId}</Text>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.dateText}>{item.markedAt?.toDate().toLocaleDateString()}</Text>
              <SVGIcon name={isExpanded ? "chevron-up" : "chevron-down"} size={14} color="#94A3B8" style={{ marginLeft: 5 }} />
            </View>
          </View>

          <Text style={styles.titleText}>{item.assignmentTitle || "Class Assignment"}</Text>
          <Text style={styles.studentName}>Student: {item.studentName}</Text>

          <View style={styles.scoreRow}>
            <Text style={styles.scoreLabel}>Final Grade</Text>
            <View style={[styles.scoreBox, { backgroundColor: COLORS.primary }]}>
              <Text style={styles.scoreValue}>{item.marks}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <Animatable.View animation="fadeIn" duration={300} style={styles.expandedContent}>
            {item.type === "standard" ? (
              <Text style={styles.infoNote}>Detailed review is only available for interactive assignments.</Text>
            ) : fetchingDetails && !details ? (
              <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 15 }} />
            ) : details ? (
              <View style={styles.reviewList}>
                <Text style={styles.reviewTitle}>QUESTIONS & ANSWERS</Text>
                {details.questions.map((q, qIdx) => {
                  const score = item.questionScores?.[qIdx] ?? 0;
                  const response = item.responses?.[qIdx] || "Not answered";
                  return (
                    <View key={qIdx} style={styles.reviewItem}>
                      <Text style={styles.questionText}>{qIdx + 1}. {q.text}</Text>
                      <View style={styles.answerBox}>
                        <Text style={styles.answerLabel}>Child's Response:</Text>
                        <Text style={styles.answerText}>{response}</Text>
                      </View>
                      <View style={styles.scoreBadge}>
                        <Text style={styles.scoreBadgeText}>Points: {score}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.errorText}>Detailed report unavailable.</Text>
            )}
          </Animatable.View>
        )}
      </Animatable.View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <SVGIcon name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Academic Performance</Text>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={scores}
          keyExtractor={(item) => item.id}
          renderItem={renderScoreItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
            />
          }
          onEndReached={() => fetchScores(true)}
          onEndReachedThreshold={0.3}
          ListFooterComponent={() =>
            loadingMore ? (
              <ActivityIndicator color={COLORS.primary} style={{ margin: 20 }} />
            ) : null
          }
          ListEmptyComponent={() => (
            <View style={styles.emptyCenter}>
              <SVGIcon name="ribbon" size={80} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No Performance Data</Text>
              <Text style={styles.emptySub}>
                Scores for your children will appear here as they are graded.
              </Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backBtn: { padding: 5, marginRight: 15 },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#0F172A" },
  listContent: { padding: 20 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 15,
    ...SHADOWS.medium,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  subjectBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  subjectText: { fontSize: 12, fontWeight: "bold" },
  dateText: { fontSize: 12, color: "#94A3B8" },
  titleText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 4,
  },
  studentName: { fontSize: 13, color: "#64748B", marginBottom: 15 },
  scoreRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 15,
  },
  scoreLabel: { fontSize: 14, fontWeight: "600", color: "#475569" },
  scoreBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.small,
  },
  scoreValue: { color: "#fff", fontWeight: "bold", fontSize: 18 },
  expandedContent: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  infoNote: { fontSize: 12, color: '#64748B', fontStyle: 'italic' },
  reviewTitle: { fontSize: 10, fontWeight: '900', color: '#94A3B8', letterSpacing: 1, marginBottom: 12 },
  reviewList: { gap: 12 },
  reviewItem: { backgroundColor: '#F8FAFC', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#F1F5F9' },
  questionText: { fontSize: 14, color: '#1E293B', fontWeight: '700', marginBottom: 10 },
  answerBox: { marginBottom: 10 },
  answerLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  answerText: { fontSize: 13, color: '#475569', fontWeight: '500' },
  scoreBadge: { alignSelf: 'flex-start', backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  scoreBadgeText: { fontSize: 11, fontWeight: '800', color: COLORS.primary },
  errorText: { fontSize: 12, color: '#EF4444' },
  emptyCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 100,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#475569",
    marginTop: 20,
  },
  emptySub: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 10,
    lineHeight: 20,
  },
});
