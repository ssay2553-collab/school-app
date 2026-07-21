import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  FlatList,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../../../firebaseConfig";
import SVGIcon from "../../SVGIcon";
import { SHADOWS } from "../../../constants/theme";
import { useAuth } from "../../../contexts/AuthContext";
import { syncAchievementsToCloud, fetchAchievementsFromCloud } from "../../../utils/gameSync";

const { width } = Dimensions.get("window");

interface ScoreboardProps {
  onBack: () => void;
}

export const Scoreboard: React.FC<ScoreboardProps> = ({ onBack }) => {
  const { appUser } = useAuth();
  const [scores, setScores] = useState<any>({});
  const [stickers, setStickers] = useState<string[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [view, setView] = useState<"me" | "leaderboard">("me");

  const loadData = async () => {
    const quizLevel = await AsyncStorage.getItem("@quiz_level");
    const wordLevel = await AsyncStorage.getItem("@word_level");
    const scrambleLevel = await AsyncStorage.getItem("@scramble_level");
    const writingCount = await AsyncStorage.getItem("@writing_count");
    const unlockedStickers = await AsyncStorage.getItem("@unlocked_stickers");

    setScores({
      quiz: quizLevel ? JSON.parse(quizLevel) : 1,
      word: wordLevel ? JSON.parse(wordLevel) : 1,
      scramble: scrambleLevel ? JSON.parse(scrambleLevel) : 1,
      writing: writingCount ? JSON.parse(writingCount) : 0,
    });

    if (unlockedStickers) setStickers(JSON.parse(unlockedStickers));
    setLoading(false);
  };

  const fetchLeaderboard = async () => {
    try {
      const q = query(
        collection(db, "gameAchievements"),
        orderBy("totalScore", "desc"),
        limit(30)
      );
      const querySnapshot = await getDocs(q);
      const list: any[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Filtering in memory to save Firestore costs on complex indexes
        // If appUser has a class, we can prioritize showing students from the same department
        list.push({ id: doc.id, ...data });
      });
      setLeaderboard(list);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    }
  };

  useEffect(() => {
    loadData();
    fetchLeaderboard();
  }, []);

  const handleSync = async () => {
    if (!appUser?.uid) return;
    setSyncing(true);
    await syncAchievementsToCloud(appUser.uid, appUser.displayName, appUser.classId);
    await fetchLeaderboard();
    setSyncing(false);
  };

  const handlePullCloud = async () => {
    if (!appUser?.uid) return;
    setSyncing(true);
    await fetchAchievementsFromCloud(appUser.uid);
    await loadData();
    setSyncing(false);
  };

  const ScoreItem = ({ title, value, icon, color, sub }: any) => (
    <View style={[styles.scoreCard, { borderLeftColor: color }]}>
      <View style={[styles.iconBox, { backgroundColor: color + "20" }]}>
        <SVGIcon name={icon} color={color} size={30} />
      </View>
      <View style={styles.scoreInfo}>
        <Text style={styles.scoreTitle}>{title}</Text>
        <Text style={styles.scoreSub}>{sub}</Text>
      </View>
      <View style={styles.valueBox}>
        <Text style={[styles.scoreValue, { color }]}>{value}</Text>
      </View>
    </View>
  );

  const renderLeaderboardItem = ({ item, index }: any) => (
    <View style={[styles.leaderboardItem, item.id === appUser?.uid && styles.myRank]}>
      <View style={styles.rankBox}>
        <Text style={styles.rankText}>{index + 1}</Text>
      </View>
      <View style={styles.rankInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.rankName}>{item.studentName || "Super Student"}</Text>
          <Text style={styles.classTag}>{item.classId || "N/A"}</Text>
        </View>
        <Text style={styles.rankLevels}>
          Q:L{item.quiz_level || 1} | W:L{item.word_level || 1} | S:L{item.scramble_level || 1}
        </Text>
      </View>
      <View style={styles.rankScoreBox}>
        <Text style={styles.rankScore}>{item.totalScore || 0}</Text>
        <Text style={styles.rankPts}>pts</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <SVGIcon name="arrow-back" color="#1E293B" size={28} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scoreboard 🏆</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, view === "me" && styles.activeTab]}
          onPress={() => setView("me")}
        >
          <Text style={[styles.tabText, view === "me" && styles.activeTabText]}>My Stats</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, view === "leaderboard" && styles.activeTab]}
          onPress={() => setView("leaderboard")}
        >
          <Text style={[styles.tabText, view === "leaderboard" && styles.activeTabText]}>Top Students</Text>
        </TouchableOpacity>
      </View>

      {view === "me" ? (
        <ScrollView contentContainerStyle={styles.list}>
          {appUser && (
            <View style={styles.syncRow}>
              <TouchableOpacity style={styles.syncBtn} onPress={handleSync} disabled={syncing}>
                {syncing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.syncBtnText}>Save to Cloud ☁️</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.syncBtn, { backgroundColor: "#6366F1" }]}
                onPress={handlePullCloud}
                disabled={syncing}
              >
                <Text style={styles.syncBtnText}>Restore 🔄</Text>
              </TouchableOpacity>
            </View>
          )}

          <ScoreItem
            title="Quiz Master"
            sub="Highest Level Reached"
            value={`Lvl ${scores.quiz}`}
            icon="document-text"
            color="#0EA5E9"
          />
          <ScoreItem
            title="Word Hunter"
            sub="Highest Level Reached"
            value={`Lvl ${scores.word}`}
            icon="search"
            color="#10B981"
          />
          <ScoreItem
            title="Scramble Pro"
            sub="Highest Level Reached"
            value={`Lvl ${scores.scramble}`}
            icon="shuffle"
            color="#F43F5E"
          />
          <ScoreItem
            title="Writing Star"
            sub="Characters Traced"
            value={scores.writing}
            icon="create"
            color="#EC4899"
          />

          <View style={styles.stickerSection}>
            <Text style={styles.sectionTitle}>Sticker Collection ({stickers.length}) 🎨</Text>
            <View style={styles.stickerGrid}>
              {stickers.length > 0 ? (
                stickers.map((s, i) => (
                  <View key={i} style={styles.stickerBox}>
                    <Text style={styles.stickerEmoji}>{s}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyStickers}>Trace 5 letters to get your first sticker! 🚀</Text>
              )}
            </View>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={leaderboard}
          renderItem={renderLeaderboardItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.leaderboardList}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No scores yet. Be the first! 🏆</Text>
            </View>
          }
        />
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>Keep playing to level up! 🚀</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
  },
  headerTitle: { fontSize: 22, fontWeight: "900", color: "#1E293B" },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 10,
    gap: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
  },
  activeTab: {
    backgroundColor: "#1E293B",
  },
  tabText: {
    fontWeight: "700",
    color: "#64748B",
  },
  activeTabText: {
    color: "#fff",
  },
  list: { padding: 20, gap: 15 },
  scoreCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 20,
    borderLeftWidth: 6,
    ...SHADOWS.small,
  },
  iconBox: {
    width: 55,
    height: 55,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  scoreInfo: { flex: 1, marginLeft: 15 },
  scoreTitle: { fontSize: 18, fontWeight: "800", color: "#1E293B" },
  scoreSub: { fontSize: 12, color: "#64748B", fontWeight: "600", marginTop: 2 },
  valueBox: {
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 12,
  },
  scoreValue: { fontSize: 20, fontWeight: "900" },
  stickerSection: {
    marginTop: 20,
    padding: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1E293B",
    marginBottom: 15,
  },
  stickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  stickerBox: {
    width: (width - 80) / 4,
    height: (width - 80) / 4,
    backgroundColor: "#fff",
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.small,
  },
  stickerEmoji: {
    fontSize: 30,
  },
  emptyStickers: {
    fontSize: 14,
    color: "#94A3B8",
    fontWeight: "600",
    fontStyle: "italic",
    textAlign: "center",
    width: "100%",
    marginTop: 10,
  },
  footer: { padding: 20, alignItems: "center" },
  footerText: { fontSize: 16, fontWeight: "700", color: "#94A3B8" },
  syncRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  syncBtn: {
    flex: 1,
    backgroundColor: "#10B981",
    padding: 12,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    ...SHADOWS.small,
  },
  syncBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  leaderboardList: {
    padding: 20,
    gap: 12,
  },
  leaderboardItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 18,
    ...SHADOWS.small,
  },
  myRank: {
    borderWidth: 2,
    borderColor: "#10B981",
    backgroundColor: "#F0FDF4",
  },
  rankBox: {
    width: 35,
    height: 35,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  rankText: {
    fontWeight: "900",
    color: "#1E293B",
  },
  rankInfo: {
    flex: 1,
  },
  rankName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1E293B",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  classTag: {
    fontSize: 10,
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    color: "#475569",
    fontWeight: "700",
    overflow: "hidden",
  },
  rankLevels: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "600",
  },
  rankScoreBox: {
    alignItems: "flex-end",
  },
  rankScore: {
    fontSize: 18,
    fontWeight: "900",
    color: "#10B981",
  },
  rankPts: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "700",
  },
  emptyBox: {
    padding: 50,
    alignItems: "center",
  },
  emptyText: {
    color: "#94A3B8",
    fontWeight: "600",
  },
});
