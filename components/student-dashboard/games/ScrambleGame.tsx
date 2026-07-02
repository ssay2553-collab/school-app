import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import SVGIcon from "../../SVGIcon";
import { usePersistedState } from "../../../hooks/student-dashboard/usePersistedState";
import { SCRAMBLE_DATA, REMARKS, WRONG_REMARKS } from "./GameConstants";
import { SHADOWS } from "../../../constants/theme";

const getRandomRemark = (isCorrect: boolean = true) => {
  const list = isCorrect ? REMARKS : WRONG_REMARKS;
  return list[Math.floor(Math.random() * list.length)];
};

interface ScrambleGameProps {
  onExit: () => void;
}

export const ScrambleGame: React.FC<ScrambleGameProps> = ({ onExit }) => {
  const [level, setLevel] = usePersistedState("@scramble_level", 1);
  const [words, setWords] = useState<string[]>([]);
  const [scrambled, setScrambled] = useState("");
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [input, setInput] = useState("");
  const [showSummary, setShowSummary] = useState(false);

  const shuffle = (word: string) =>
    word
      .split("")
      .sort(() => 0.5 - Math.random())
      .join("");

  const startStage = useCallback(() => {
    let pool = SCRAMBLE_DATA.filter((s) => s.level === level).map((s) => s.word);
    if (pool.length === 0) pool = SCRAMBLE_DATA.map((s) => s.word);

    const stageWords = [...pool].sort(() => 0.5 - Math.random()).slice(0, 5);
    setWords(stageWords);
    if (stageWords[0]) setScrambled(shuffle(stageWords[0]));

    setIndex(0);
    setScore(0);
    setInput("");
    setShowSummary(false);
  }, [level]);

  useEffect(() => {
    startStage();
  }, [startStage]);

  const handleNextLevel = () => {
    if (score >= 4) {
      setLevel(level + 1);
    } else {
      startStage();
    }
  };

  const check = () => {
    const isCorrect = input.toUpperCase().trim() === words[index];
    if (isCorrect) {
      setScore((s) => s + 1);
      Alert.alert("Bravo!", getRandomRemark(true));
    } else {
      Alert.alert(
        "Not Quite",
        `${getRandomRemark(false)}\n\nThe word was ${words[index]}`,
      );
    }
    if (index + 1 < words.length) {
      const nextIdx = index + 1;
      setIndex(nextIdx);
      setScrambled(shuffle(words[nextIdx]));
      setInput("");
    } else setShowSummary(true);
  };

  if (showSummary)
    return (
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>
          {score >= 4 ? "Excellent! ✨" : "Keep Trying! 💪"}
        </Text>
        <Text style={styles.summaryText}>Unscrambled {score} / 5 words.</Text>
        <TouchableOpacity style={styles.summaryButton} onPress={handleNextLevel}>
          <Text style={styles.summaryButtonText}>
            {score >= 4 ? "Next Level" : "Retry Level"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.exitButton} onPress={onExit}>
          <Text style={styles.exitButtonText}>Back to Menu</Text>
        </TouchableOpacity>
      </View>
    );

  if (!words[index]) return <ActivityIndicator color="#fff" />;

  return (
    <View style={styles.gameContainer}>
      <View style={styles.gameHeader}>
        <TouchableOpacity onPress={onExit}>
          <SVGIcon name="close-circle" color="#fff" size={32} />
        </TouchableOpacity>
        <Text style={styles.levelText}>Scramble 🔠 (Lvl {level})</Text>
      </View>
      <View style={styles.scrambleContainer}>
        <Text style={styles.hintLabel}>UNSCRAMBLE THIS:</Text>
        <Text
          style={[
            styles.scrambledWord,
            {
              color: "#fff",
              fontSize: 40,
              fontWeight: "900",
              letterSpacing: 5,
              marginBottom: 30,
            },
          ]}
        >
          {scrambled}
        </Text>
        <TextInput
          style={styles.textInput}
          placeholder="TYPE WORD..."
          value={input}
          onChangeText={setInput}
          autoCapitalize="characters"
        />
        <TouchableOpacity
          style={[
            styles.checkButton,
            { backgroundColor: "rgba(255,255,255,0.3)" },
          ]}
          onPress={check}
        >
          <Text style={styles.checkButtonText}>CHECK</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  gameContainer: { flex: 1, padding: 25 },
  gameHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
  },
  levelText: { fontSize: 22, fontWeight: "900", color: "#fff" },
  scrambleContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  hintLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
    marginBottom: 10,
  },
  scrambledWord: { fontSize: 36, fontWeight: "900", textAlign: "center" },
  textInput: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.15)",
    padding: 20,
    borderRadius: 25,
    fontSize: 24,
    color: "#fff",
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 25,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  checkButton: {
    width: "100%",
    padding: 20,
    borderRadius: 25,
    alignItems: "center",
  },
  checkButtonText: { color: "#fff", fontWeight: "900", fontSize: 18 },
  summaryContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  summaryTitle: {
    fontSize: 44,
    fontWeight: "900",
    color: "#fff",
    marginBottom: 10,
    textAlign: "center",
  },
  summaryText: {
    fontSize: 20,
    color: "rgba(255,255,255,0.9)",
    marginBottom: 40,
  },
  summaryButton: {
    width: "100%",
    padding: 20,
    borderRadius: 25,
    alignItems: "center",
    backgroundColor: "#fff",
    ...SHADOWS.medium,
    marginBottom: 15,
  },
  summaryButtonText: { fontSize: 20, fontWeight: "900", color: "#1E293B" },
  exitButton: { marginTop: 20 },
  exitButtonText: {
    color: "rgba(255,255,255,0.6)",
    fontWeight: "700",
    fontSize: 16,
  },
});
