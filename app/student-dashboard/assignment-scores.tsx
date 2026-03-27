import { Ionicons } from "@expo/vector-icons";
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
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    View,
    SafeAreaView,
    StatusBar,
    TouchableOpacity,
} from "react-native";
import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebaseConfig";
import { useRouter } from "expo-router";
import * as Animatable from "react-native-animatable";

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

  const fetchScores = useCallback(
    async (isNextPage = false) => {
      if (!appUser?.uid || (!hasMore.current && isNextPage)) {
        setLoading(false);
        return;
      }

      if (isNextPage) setLoadingMore(true);
      else {
        setLoading(true);
        lastVisible.current = null;
        hasMore.current = true;
      }

      try {
        const qConstraints = [
          where("studentId", "==", appUser.uid),
          where("marked", "==", true),
          where("markedAt", ">=", cutoff),
          orderBy("markedAt", "desc"),
          limit(PAGE_SIZE),
        ];

        if (isNextPage && lastVisible.current) {
          qConstraints.push(startAfter(lastVisible.current) as any);
        }

        const q = query(collection(db, "submissions"), ...qConstraints);

        let snap;
        try {
          snap = await getDocsFromCache(q);
          if (snap.empty) snap = await getDocsFromServer(q);
        } catch {
          snap = await getDocsFromServer(q);
        }

        const data = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        })) as ScoreRecord[];

        if (isNextPage) setScores((prev) => [...prev, ...data]);
        else setScores(data);

        lastVisible.current = snap.docs[snap.docs.length - 1];
        hasMore.current = snap.docs.length === PAGE_SIZE;
      } catch (e) {
        console.error("Fetch Scores Error:", e);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [appUser?.uid, cutoff],
  );

  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

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

  const renderItem = ({ item }: { item: ScoreRecord }) => {
    const isExpanded = expandedId === item.id;
    const details = assignmentMeta[item.assignmentId];
    const displayDate = item.markedAt
      ? item.markedAt.toDate().toLocaleDateString()
      : "N/A";

    return (
      <View style={styles.card}>
        <TouchableOpacity 
          onPress={() => toggleExpand(item)} 
          activeOpacity={0.7} 
          style={styles.cardHeader}
        >
          <View style={styles.iconBox}>
            <SVGIcon name="ribbon" size={28} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>
              {item.assignmentTitle || "Assignment"}
            </Text>
            <Text style={styles.subject}>{item.subjectId}</Text>
            <Text style={styles.dateText}>Marked on: {displayDate}</Text>
          </View>
          <View style={styles.scoreAndExpand}>
            <View
              style={[
                styles.scoreBox,
                { backgroundColor: COLORS.primary + "10" },
              ]}
            >
              <Text style={[styles.scoreText, { color: COLORS.primary }]}>
                {item.marks}
              </Text>
              <Text style={[styles.scoreLabel, { color: COLORS.primary }]}>
                Marks
              </Text>
            </View>
            <Ionicons 
              name={isExpanded ? "chevron-up" : "chevron-down"} 
              size={18} 
              color="#94A3B8" 
              style={{ marginTop: 5 }} 
            />
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <Animatable.View animation="fadeIn" duration={300} style={styles.detailsContainer}>
            {item.type === "standard" ? (
              <Text style={styles.standardInfo}>
                Teacher assigned a total score for this standard assignment.
              </Text>
            ) : fetchingDetails && !details ? (
              <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 10 }} />
            ) : details ? (
              <View style={styles.reviewList}>
                <Text style={styles.reviewHeader}>QUESTION BREAKDOWN</Text>
                {details.questions.map((q, idx) => {
                  const score = item.questionScores?.[idx] ?? 0;
                  const response = item.responses?.[idx] || "No response";
                  return (
                    <View key={idx} style={styles.reviewItem}>
                      <Text style={styles.qText}>{idx + 1}. {q.text}</Text>
                      <View style={styles.responseRow}>
                        <Text style={styles.aLabel}>Your Answer:</Text>
                        <Text style={styles.aText}>{response}</Text>
                      </View>
                      <View style={styles.pointsBadge}>
                        <Text style={styles.pointsText}>Score: {score}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.errorText}>Details currently unavailable.</Text>
            )}
          </Animatable.View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <SVGIcon name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <View style={styles.headerContainer}>
          <Text style={styles.headerText}>Learning Progress 🏆</Text>
          <Text style={styles.subText}>
            Recent assignment results
          </Text>
        </View>
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
          style={{ marginTop: 50 }}
        />
      ) : (
        <FlatList
          data={scores}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
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
              <ActivityIndicator
                color={COLORS.primary}
                style={{ margin: 20 }}
              />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="stats-chart-outline" size={64} color="#CBD5E1" />
              <Text style={styles.emptyText}>No scores found.</Text>
              <Text style={styles.emptyHint}>
                Check back once your teacher marks your work!
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FDFDFD" },
  headerRow: { flexDirection: 'row', alignItems: 'center', padding: 20 },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginRight: 15, ...SHADOWS.small },
  headerContainer: { flex: 1 },
  headerText: { fontSize: 24, fontWeight: "900", color: "#0F172A" },
  subText: { fontSize: 14, color: "#64748B", marginTop: 2 },
  listContent: { padding: 20, paddingBottom: 40 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    ...SHADOWS.medium,
    borderLeftWidth: 5,
    borderLeftColor: COLORS.primary,
  },
  cardHeader: { flexDirection: "row", alignItems: "center" },
  iconBox: { marginRight: 15 },
  title: { fontSize: 17, fontWeight: "800", color: "#1E293B" },
  subject: { fontSize: 13, color: "#64748B", marginTop: 2, fontWeight: "600" },
  dateText: { fontSize: 11, color: "#94A3B8", marginTop: 4 },
  scoreAndExpand: { alignItems: 'center' },
  scoreBox: {
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    minWidth: 55,
  },
  scoreText: { fontSize: 20, fontWeight: "900" },
  scoreLabel: {
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
    marginTop: -2,
  },
  detailsContainer: {
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  standardInfo: { fontSize: 13, color: '#64748B', fontStyle: 'italic' },
  reviewList: { gap: 15 },
  reviewHeader: { fontSize: 10, fontWeight: '900', color: '#94A3B8', letterSpacing: 1, marginBottom: 5 },
  reviewItem: { backgroundColor: '#F8FAFC', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#F1F5F9' },
  qText: { fontSize: 14, color: '#1E293B', fontWeight: '700', marginBottom: 10 },
  responseRow: { marginBottom: 10 },
  aLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  aText: { fontSize: 13, color: '#475569', fontWeight: '500' },
  pointsBadge: { alignSelf: 'flex-start', backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  pointsText: { fontSize: 11, fontWeight: '800', color: COLORS.primary },
  errorText: { fontSize: 12, color: '#EF4444' },
  empty: { alignItems: "center", marginTop: 80, paddingHorizontal: 40 },
  emptyText: {
    color: "#475569",
    marginTop: 20,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyHint: {
    color: "#94A3B8",
    marginTop: 8,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
