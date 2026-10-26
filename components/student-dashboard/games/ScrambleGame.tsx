import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { safeSpeak, safeStop } from "../../../utils/safeSpeech";
import * as Animatable from "react-native-animatable";
import * as Haptics from "expo-haptics";
import SVGIcon from "../../SVGIcon";
import { usePersistedState } from "../../../hooks/student-dashboard/usePersistedState";
import { SCRAMBLE_DATA, REMARKS, WRONG_REMARKS } from "./GameConstants";
import { SHADOWS, COLORS } from "../../../constants/theme";
import { useAuth } from "../../../contexts/AuthContext";
import { syncAchievementsToCloud, getStudentNameFromUser } from "../../../utils/gameSync";

interface Tile {
  id: number;
  char: string;
  isUsed: boolean;
  isRevealedByHint?: boolean;
}

interface WordItem {
  word: string;
  hint?: string;
  level: number;
}

const getRandomRemark = (isCorrect: boolean = true) => {
  const list = isCorrect ? REMARKS : WRONG_REMARKS;
  return list[Math.floor(Math.random() * list.length)];
};

interface ScrambleGameProps {
  onExit: () => void;
}

export const ScrambleGame: React.FC<ScrambleGameProps> = ({ onExit }) => {
  const { appUser } = useAuth();
  const [level, setLevel] = usePersistedState("@scramble_level", 1);
  const [stageItems, setStageItems] = useState<WordItem[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);

  // Letter tiles state
  const [scrambledTiles, setScrambledTiles] = useState<Tile[]>([]);
  const [placedTiles, setPlacedTiles] = useState<Tile[]>([]);
  const [typedInput, setTypedInput] = useState("");

  // Hint & Clue State
  const [showHintText, setShowHintText] = useState(false);
  const [hintsUsedCount, setHintsUsedCount] = useState(0);

  const [showSummary, setShowSummary] = useState(false);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; message: string; subMessage?: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const currentItem = stageItems[index];

  // Helper to shuffle letters
  const shuffleString = (str: string) => {
    const chars = str.split("");
    for (let i = chars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    // Make sure it doesn't accidentally return the exact target word
    if (chars.join("") === str && str.length > 1) {
      [chars[0], chars[1]] = [chars[1], chars[0]];
    }
    return chars;
  };

  const setupWord = useCallback((wordItem: WordItem) => {
    const chars = shuffleString(wordItem.word);
    const tiles: Tile[] = chars.map((char, i) => ({
      id: i,
      char,
      isUsed: false,
    }));
    setScrambledTiles(tiles);
    setPlacedTiles([]);
    setTypedInput("");
    setShowHintText(false);
    setHintsUsedCount(0);
  }, []);

  const startStage = useCallback(() => {
    let pool = SCRAMBLE_DATA.filter((s) => s.level === level);
    if (pool.length === 0) pool = SCRAMBLE_DATA;

    // Pick 5 random unique words
    const selected = [...pool].sort(() => 0.5 - Math.random()).slice(0, 5);
    setStageItems(selected);
    setIndex(0);
    setScore(0);
    setStreak(0);
    setShowSummary(false);

    if (selected[0]) {
      setupWord(selected[0]);
    }
  }, [level, setupWord]);

  useEffect(() => {
    startStage();
    return () => {
      safeStop();
    };
  }, [startStage]);

  useEffect(() => {
    if (currentItem) {
      safeStop();
      safeSpeak("Unscramble this word", { rate: 0.9 });
    }
  }, [currentItem]);

  // Handle letter tile selection
  const handleSelectTile = (tile: Tile) => {
    if (tile.isUsed || isProcessing) return;
    Haptics.selectionAsync();

    setScrambledTiles((prev) =>
      prev.map((t) => (t.id === tile.id ? { ...t, isUsed: true } : t))
    );
    const updatedPlaced = [...placedTiles, tile];
    setPlacedTiles(updatedPlaced);
    setTypedInput(updatedPlaced.map((t) => t.char).join(""));
  };

  // Remove placed tile
  const handleRemovePlacedTile = (indexToRemove: number) => {
    if (isProcessing) return;
    Haptics.selectionAsync();

    const removedTile = placedTiles[indexToRemove];
    const updatedPlaced = placedTiles.filter((_, i) => i !== indexToRemove);
    setPlacedTiles(updatedPlaced);
    setTypedInput(updatedPlaced.map((t) => t.char).join(""));

    setScrambledTiles((prev) =>
      prev.map((t) => (t.id === removedTile.id ? { ...t, isUsed: false } : t))
    );
  };

  // Clear all placed tiles
  const handleClear = () => {
    if (isProcessing || placedTiles.length === 0) return;
    Haptics.selectionAsync();
    setPlacedTiles([]);
    setTypedInput("");
    setScrambledTiles((prev) =>
      prev.map((t) => ({ ...t, isUsed: t.isRevealedByHint ? t.isUsed : false }))
    );
  };

  // Backspace single letter
  const handleBackspace = () => {
    if (isProcessing || placedTiles.length === 0) return;
    handleRemovePlacedTile(placedTiles.length - 1);
  };

  // Sync text input with tiles
  const handleTextInput = (text: string) => {
    const clean = text.toUpperCase().replace(/[^A-Z]/g, "");
    setTypedInput(clean);

    // Reconstruct placed tiles from clean text
    const pool = scrambledTiles.map((t) => ({ ...t, isUsed: false }));
    const newPlaced: Tile[] = [];

    for (const char of clean.split("")) {
      const availableTile = pool.find((t) => !t.isUsed && t.char === char);
      if (availableTile) {
        availableTile.isUsed = true;
        newPlaced.push(availableTile);
      }
    }

    setPlacedTiles(newPlaced);
    setScrambledTiles(pool);
  };

  // HINT 1: Show Clue
  const handleToggleClue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextState = !showHintText;
    setShowHintText(nextState);

    if (nextState && currentItem?.hint) {
      safeStop();
      safeSpeak("Hint: " + currentItem.hint, { rate: 0.95 });
    }
  };

  // HINT 2: Reveal Next Letter
  const handleRevealNextLetter = () => {
    if (!currentItem || isProcessing) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const targetWord = currentItem.word;
    const targetLength = targetWord.length;

    // Find first mismatch position
    let targetIndex = -1;
    for (let i = 0; i < targetLength; i++) {
      if (!placedTiles[i] || placedTiles[i].char !== targetWord[i]) {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex === -1) return; // Word is already fully matching

    const neededChar = targetWord[targetIndex];

    // Find unused tile with neededChar
    const availableTile = scrambledTiles.find(
      (t) => !t.isUsed && t.char === neededChar
    );

    if (!availableTile) {
      // If no unused tile has neededChar, pull it from a wrong position in placedTiles
      const wrongTileIdx = placedTiles.findIndex(
        (t, idx) => idx >= targetIndex && t.char === neededChar
      );
      if (wrongTileIdx !== -1) {
        const tileToMove = placedTiles[wrongTileIdx];
        const newPlaced = [...placedTiles];
        newPlaced.splice(wrongTileIdx, 1);
        newPlaced.splice(targetIndex, 0, { ...tileToMove, isRevealedByHint: true });
        setPlacedTiles(newPlaced);
        setTypedInput(newPlaced.map((t) => t.char).join(""));
      }
      return;
    }

    // Mark available tile as used & insert in placedTiles at targetIndex
    setScrambledTiles((prev) =>
      prev.map((t) =>
        t.id === availableTile.id ? { ...t, isUsed: true, isRevealedByHint: true } : t
      )
    );

    const newPlaced = [...placedTiles];
    newPlaced[targetIndex] = { ...availableTile, isRevealedByHint: true };
    setPlacedTiles(newPlaced);
    setTypedInput(newPlaced.map((t) => t.char).join(""));
    setHintsUsedCount((h) => h + 1);

    safeStop();
    safeSpeak(`Revealed letter ${neededChar}`, { rate: 1.0 });
  };

  // HINT 3: Reshuffle remaining unused tiles
  const handleReshuffleTiles = () => {
    if (isProcessing) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setScrambledTiles((prev) => {
      const unused = prev.filter((t) => !t.isUsed);
      const shuffledChars = shuffleString(unused.map((t) => t.char).join(""));

      let unusedIdx = 0;
      return prev.map((t) => {
        if (!t.isUsed) {
          const newChar = shuffledChars[unusedIdx++];
          return { ...t, char: newChar };
        }
        return t;
      });
    });

    safeStop();
    safeSpeak("Tiles reshuffled", { rate: 1.0 });
  };

  const handleNextLevel = () => {
    safeStop();
    if (score >= 4) {
      setLevel(level + 1);
      if (appUser?.uid) {
        syncAchievementsToCloud(
          appUser.uid,
          getStudentNameFromUser(appUser),
          appUser.classId
        );
      }
    } else {
      startStage();
    }
  };

  const checkAnswer = async () => {
    if (isProcessing || !currentItem) return;
    const currentAnswer = (typedInput || placedTiles.map((t) => t.char).join(""))
      .trim()
      .toUpperCase();

    if (!currentAnswer) return;

    setIsProcessing(true);
    const isCorrect = currentAnswer === currentItem.word;
    const remark = getRandomRemark(isCorrect);

    safeStop();
    safeSpeak(remark, { rate: 1.0 });

    if (isCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setScore((s) => s + 1);
      setStreak((st) => st + 1);
      setFeedback({
        isCorrect: true,
        message: remark,
        subMessage: hintsUsedCount > 0 ? `Unscrambled with ${hintsUsedCount} hint(s)! ✨` : "Perfect Unscramble! 🔥",
      });
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setStreak(0);
      setFeedback({
        isCorrect: false,
        message: remark,
        subMessage: `The word was "${currentItem.word}"`,
      });
    }

    setTimeout(() => {
      setFeedback(null);
      if (index + 1 < stageItems.length) {
        const nextIdx = index + 1;
        setIndex(nextIdx);
        setupWord(stageItems[nextIdx]);
        setIsProcessing(false);
      } else {
        setShowSummary(true);
        setIsProcessing(false);
      }
    }, 2200);
  };

  if (showSummary) {
    return (
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>
          {score >= 4 ? "BRILLIANT! ✨" : "KEEP TRYING! 💪"}
        </Text>
        <Text style={styles.summaryText}>
          Unscrambled {score} / 5 words correctly!
        </Text>

        <View style={styles.summaryBadgesRow}>
          <View style={styles.summaryBadge}>
            <Text style={styles.summaryBadgeNum}>{score * 20} pts</Text>
            <Text style={styles.summaryBadgeLabel}>SCORE</Text>
          </View>
          <View style={styles.summaryBadge}>
            <Text style={styles.summaryBadgeNum}>Lvl {level}</Text>
            <Text style={styles.summaryBadgeLabel}>LEVEL</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.summaryButton}
          onPress={handleNextLevel}
          activeOpacity={0.8}
        >
          <Text style={styles.summaryButtonText}>
            {score >= 4 ? "NEXT LEVEL 🚀" : "TRY AGAIN 🔄"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.exitButton} onPress={onExit}>
          <Text style={styles.exitButtonText}>Back to Games Menu</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!currentItem) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  const targetLength = currentItem.word.length;

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Game Header */}
      <View style={styles.gameHeader}>
        <TouchableOpacity
          onPress={() => {
            safeStop();
            onExit();
          }}
          style={styles.headerIconBtn}
        >
          <SVGIcon name="close-circle" color="#fff" size={32} />
        </TouchableOpacity>

        <View style={styles.headerTitleBox}>
          <Text style={styles.levelText}>Scramble 🔠 (Lvl {level})</Text>

          <View style={styles.statsBar}>
            <View style={styles.statPill}>
              <Text style={styles.statPillText}>⭐ {score}/5</Text>
            </View>
            {streak > 1 && (
              <View style={[styles.statPill, { backgroundColor: "#F59E0B" }]}>
                <Text style={styles.statPillText}>🔥 {streak} Streak</Text>
              </View>
            )}
          </View>
        </View>

        <TouchableOpacity
          onPress={() =>
            safeSpeak("Unscramble " + currentItem.word.split("").join(" "))
          }
          style={styles.headerIconBtn}
        >
          <SVGIcon name="volume-high" color="#fff" size={28} />
        </TouchableOpacity>
      </View>

      {/* Clue / Hint Banner Box */}
      <View style={styles.hintSection}>
        {showHintText && currentItem.hint ? (
          <Animatable.View animation="fadeInDown" style={styles.clueBanner}>
            <View style={styles.clueHeaderRow}>
              <SVGIcon name="bulb" color="#F59E0B" size={20} />
              <Text style={styles.clueTitle}>WORD CLUE:</Text>
            </View>
            <Text style={styles.clueText}>"{currentItem.hint}"</Text>
          </Animatable.View>
        ) : (
          <TouchableOpacity
            style={styles.hintToggleBtn}
            onPress={handleToggleClue}
            activeOpacity={0.8}
          >
            <SVGIcon name="bulb-outline" color="#F59E0B" size={20} />
            <Text style={styles.hintToggleText}>NEED A CLUE? TAP FOR HINT</Text>
          </TouchableOpacity>
        )}

        {/* Extra Hint Control Buttons */}
        <View style={styles.hintActionsRow}>
          <TouchableOpacity
            style={styles.hintActionBtn}
            onPress={handleRevealNextLetter}
            activeOpacity={0.8}
            disabled={isProcessing}
          >
            <SVGIcon name="search" color="#3B82F6" size={16} />
            <Text style={styles.hintActionText}>REVEAL LETTER 🔍</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.hintActionBtn}
            onPress={handleReshuffleTiles}
            activeOpacity={0.8}
            disabled={isProcessing}
          >
            <SVGIcon name="refresh" color="#EC4899" size={16} />
            <Text style={styles.hintActionText}>RESHUFFLE 🔠</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Answer Slot Display */}
      <View style={styles.answerSlotsContainer}>
        <Text style={styles.slotsLabel}>YOUR WORD:</Text>
        <View style={styles.slotsRow}>
          {Array.from({ length: targetLength }).map((_, i) => {
            const placedTile = placedTiles[i];
            return (
              <TouchableOpacity
                key={i}
                style={[
                  styles.slotBox,
                  placedTile && styles.slotBoxFilled,
                  placedTile?.isRevealedByHint && styles.slotBoxRevealed,
                ]}
                onPress={() => placedTile && handleRemovePlacedTile(i)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.slotChar,
                    placedTile?.isRevealedByHint && { color: "#10B981" },
                  ]}
                >
                  {placedTile ? placedTile.char : ""}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Quick Clear / Backspace Row */}
        {placedTiles.length > 0 && (
          <View style={styles.slotControlsRow}>
            <TouchableOpacity
              onPress={handleBackspace}
              style={styles.smallControlBtn}
            >
              <SVGIcon name="backspace" color="#fff" size={16} />
              <Text style={styles.smallControlText}>DELETE</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleClear}
              style={styles.smallControlBtn}
            >
              <SVGIcon name="trash-outline" color="#fff" size={16} />
              <Text style={styles.smallControlText}>CLEAR ALL</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Scrambled Letter Tiles Pool */}
      <View style={styles.tilesContainer}>
        <Text style={styles.tilesLabel}>TAP LETTERS TO BUILD WORD:</Text>
        <View style={styles.tilesGrid}>
          {scrambledTiles.map((tile) => (
            <TouchableOpacity
              key={tile.id}
              style={[
                styles.tileBtn,
                tile.isUsed && styles.tileBtnUsed,
              ]}
              onPress={() => handleSelectTile(tile)}
              disabled={tile.isUsed || isProcessing}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tileChar,
                  tile.isUsed && styles.tileCharUsed,
                ]}
              >
                {tile.char}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Keyboard Input Fallback */}
      <TextInput
        style={styles.hiddenTextInput}
        value={typedInput}
        onChangeText={handleTextInput}
        autoCapitalize="characters"
        placeholder="OR TYPE HERE..."
        placeholderTextColor="rgba(255,255,255,0.4)"
      />

      {/* Submit / Check Answer Button */}
      <TouchableOpacity
        style={[
          styles.checkButton,
          placedTiles.length === targetLength && styles.checkButtonActive,
          isProcessing && { opacity: 0.6 },
        ]}
        onPress={checkAnswer}
        disabled={isProcessing || placedTiles.length === 0}
        activeOpacity={0.8}
      >
        <Text style={styles.checkButtonText}>
          {isProcessing ? "CHECKING..." : "CHECK ANSWER ✨"}
        </Text>
      </TouchableOpacity>

      {/* Feedback Overlay */}
      {feedback && (
        <Animatable.View
          animation="bounceIn"
          style={[
            styles.feedbackOverlay,
            { backgroundColor: feedback.isCorrect ? "#10B981" : "#EF4444" },
          ]}
        >
          <SVGIcon
            name={feedback.isCorrect ? "checkmark-circle" : "close-circle"}
            color="#fff"
            size={64}
          />
          <Text style={styles.feedbackText}>{feedback.message}</Text>
          {feedback.subMessage && (
            <Text style={styles.feedbackSubText}>{feedback.subMessage}</Text>
          )}
        </Animatable.View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContainer: { padding: 20, paddingBottom: 60, flexGrow: 1 },
  gameHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerIconBtn: { padding: 4 },
  headerTitleBox: { alignItems: "center" },
  levelText: { fontSize: 20, fontWeight: "900", color: "#fff" },
  statsBar: { flexDirection: "row", gap: 8, marginTop: 4 },
  statPill: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statPillText: { color: "#fff", fontSize: 11, fontWeight: "900" },

  // Hint Box
  hintSection: { marginBottom: 20 },
  hintToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#F59E0B70",
    gap: 8,
  },
  hintToggleText: {
    color: "#F59E0B",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  clueBanner: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderWidth: 1.5,
    borderColor: "#F59E0B",
    borderRadius: 20,
    padding: 15,
    marginBottom: 10,
  },
  clueHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  clueTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: "#F59E0B",
    letterSpacing: 1,
  },
  clueText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
    lineHeight: 20,
  },
  hintActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    gap: 10,
  },
  hintActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingVertical: 10,
    borderRadius: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  hintActionText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  // Answer Slots
  answerSlotsContainer: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 24,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  slotsLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 1,
    marginBottom: 12,
  },
  slotsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  slotBox: {
    width: 46,
    height: 52,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  slotBoxFilled: {
    backgroundColor: "#fff",
    borderColor: "#fff",
    ...SHADOWS.small,
  },
  slotBoxRevealed: {
    backgroundColor: "#ECFDF5",
    borderColor: "#10B981",
  },
  slotChar: {
    fontSize: 24,
    fontWeight: "900",
    color: "#1E293B",
  },
  slotControlsRow: {
    flexDirection: "row",
    gap: 15,
    marginTop: 15,
  },
  smallControlBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  smallControlText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
  },

  // Letter Tiles Pool
  tilesContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  tilesLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 1,
    marginBottom: 12,
  },
  tilesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
  },
  tileBtn: {
    width: 50,
    height: 54,
    borderRadius: 16,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.medium,
  },
  tileBtnUsed: {
    backgroundColor: "rgba(255,255,255,0.15)",
    elevation: 0,
  },
  tileChar: {
    fontSize: 24,
    fontWeight: "900",
    color: "#1E293B",
  },
  tileCharUsed: {
    color: "rgba(255,255,255,0.2)",
  },

  // Input Fallback
  hiddenTextInput: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 16,
    padding: 12,
    fontSize: 16,
    color: "#fff",
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },

  // Submit Button
  checkButton: {
    width: "100%",
    paddingVertical: 18,
    borderRadius: 22,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.25)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  checkButtonActive: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
    ...SHADOWS.medium,
  },
  checkButtonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 18,
    letterSpacing: 0.5,
  },

  // Summary Screen
  summaryContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  summaryTitle: {
    fontSize: 36,
    fontWeight: "900",
    color: "#fff",
    marginBottom: 10,
    textAlign: "center",
  },
  summaryText: {
    fontSize: 18,
    color: "rgba(255,255,255,0.9)",
    marginBottom: 30,
    fontWeight: "700",
  },
  summaryBadgesRow: {
    flexDirection: "row",
    gap: 20,
    marginBottom: 40,
  },
  summaryBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 24,
    paddingVertical: 15,
    borderRadius: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  summaryBadgeNum: {
    fontSize: 24,
    fontWeight: "900",
    color: "#fff",
  },
  summaryBadgeLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  summaryButton: {
    width: "100%",
    paddingVertical: 18,
    borderRadius: 22,
    alignItems: "center",
    backgroundColor: "#fff",
    ...SHADOWS.medium,
    marginBottom: 15,
  },
  summaryButtonText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1E293B",
  },
  exitButton: { marginTop: 15, padding: 10 },
  exitButtonText: {
    color: "rgba(255,255,255,0.7)",
    fontWeight: "800",
    fontSize: 15,
  },

  // Feedback Overlay
  feedbackOverlay: {
    position: "absolute",
    top: "30%",
    left: "10%",
    right: "10%",
    padding: 30,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.large,
    zIndex: 1000,
  },
  feedbackText: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 10,
  },
  feedbackSubText: {
    color: "rgba(255,255,255,0.95)",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 5,
  },
});
