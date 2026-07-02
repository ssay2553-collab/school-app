import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import SVGIcon from "../../components/SVGIcon";
import { COLORS } from "../../constants/theme";
import { GAME_BG, GameMode } from "../../components/student-dashboard/games/GameConstants";
import { QuizGame } from "../../components/student-dashboard/games/QuizGame";
import { WordHuntGame } from "../../components/student-dashboard/games/WordHuntGame";
import { ScrambleGame } from "../../components/student-dashboard/games/ScrambleGame";
import { MenuCard } from "../../components/student-dashboard/games/MenuCard";

export default function GamesScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<GameMode>("menu");

  const renderGame = () => {
    switch (mode) {
      case "quiz":
        return <QuizGame onExit={() => setMode("menu")} />;
      case "word":
        return <WordHuntGame onExit={() => setMode("menu")} />;
      case "scramble":
        return <ScrambleGame onExit={() => setMode("menu")} />;
      default:
        return (
          <View style={styles.center}>
            <Text style={{ color: "#fff", fontSize: 20, fontWeight: "bold" }}>
              Coming Soon! 🚧
            </Text>
            <TouchableOpacity
              onPress={() => setMode("menu")}
              style={{ marginTop: 20 }}
            >
              <Text style={{ color: "#fff", textDecorationLine: "underline" }}>
                Back to Menu
              </Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: GAME_BG[mode] }}>
      <StatusBar
        barStyle={mode === "menu" ? "dark-content" : "light-content"}
      />
      {mode === "menu" ? (
        <ScrollView contentContainerStyle={styles.menuContainer}>
          <View style={styles.menuHeader}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.menuBackBtn}
            >
              <SVGIcon name="arrow-back" size={24} color={COLORS.primary} />
            </TouchableOpacity>
            <Text style={styles.menuTitle}>Fun Zone! 🎡</Text>
            <Text style={styles.menuSub}>Learn while you play!</Text>
          </View>
          <View style={styles.menuGrid}>
            <MenuCard
              title="Knowledge Quiz"
              icon="document-text"
              color="#0EA5E9"
              onPress={() => setMode("quiz")}
            />
            <MenuCard
              title="Word Hunt"
              icon="search"
              color="#10B981"
              onPress={() => setMode("word")}
            />
            <MenuCard
              title="Word Scramble"
              icon="shuffle"
              color="#F43F5E"
              onPress={() => setMode("scramble")}
            />
            <MenuCard
              title="Memory Match"
              icon="apps"
              color="#F59E0B"
              onPress={() => setMode("memory")}
            />
            <MenuCard
              title="Math Sprint"
              icon="calculator"
              color="#8B5CF6"
              onPress={() => setMode("math")}
            />
          </View>
        </ScrollView>
      ) : (
        renderGame()
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  menuContainer: { paddingBottom: 40 },
  menuHeader: {
    padding: 30,
    alignItems: "center",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    marginBottom: 20,
  },
  menuBackBtn: {
    position: "absolute",
    left: 20,
    top: 35,
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
  },
  menuTitle: { fontSize: 28, fontWeight: "900", color: "#1E293B" },
  menuSub: { fontSize: 14, color: "#64748B", fontWeight: "600", marginTop: 4 },
  menuGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
});
