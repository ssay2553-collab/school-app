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
import { stop, speak } from "expo-speech";
import SVGIcon from "../../SVGIcon";
import { usePersistedState } from "../../../hooks/student-dashboard/usePersistedState";
import { WORD_DATA, REMARKS, WRONG_REMARKS } from "./GameConstants";
import { SHADOWS } from "../../../constants/theme";
import { useAuth } from "../../../contexts/AuthContext";
import { syncAchievementsToCloud } from "../../../utils/gameSync";

const getRandomRemark = (isCorrect: boolean = true) => {
  const list = isCorrect ? REMARKS : WRONG_REMARKS;
  return list[Math.floor(Math.random() * list.length)];
};

interface WordHuntGameProps {
  onExit: () => void;
}

export const WordHuntGame: React.FC<WordHuntGameProps> = ({ onExit }) => {
  const { appUser } = useAuth();
  const [level, setLevel] = usePersistedState("@word_level", 1);
  const [words, setWords] = useState<any[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [input, setInput] = useState("");
  const [showSummary, setShowSummary] = useState(false);

  const startStage = useCallback(() => {
    let pool = WORD_DATA.filter((w) => w.level === level);
    if (pool.length === 0) pool = WORD_DATA;

    setWords([...pool].sort(() => 0.5 - Math.random()).slice(0, 5));
    setIndex(0);
    setScore(0);
    setInput("");
    setShowSummary(false);
  }, [level]);

  useEffect(() => {
    startStage();
    return () => { stop(); };
  }, [startStage]);

  useEffect(() => {
    if (words[index]) {
      stop();
      speak("Guess the word for: " + words[index].hint, { rate: 0.9 });
    }
  }, [index, words]);

  const handleNextLevel = () => {
    stop();
    if (score >= 4) {
      setLevel(level + 1);
      if (appUser?.uid) {
        syncAchievementsToCloud(appUser.uid, appUser.displayName, appUser.classId);
      }
    } else {
      startStage();
    }
  };

  const check = () => {
    const isCorrect = input.toUpperCase().trim() === words[index].word;
    const remark = getRandomRemark(isCorrect);

    stop();
    speak(remark, { rate: 1.0 });

    if (isCorrect) {
      setScore((s) => s + 1);
      Alert.alert("Correct!", remark);
    } else {
      Alert.alert(
        "Oops!",
        `${remark}\n\nThe word was ${words[index].word}`,
      );
    }
    if (index + 1 < words.length) {
      setIndex((i) => i + 1);
      setInput("");
    } else setShowSummary(true);
  };

  if (showSummary)
    return (
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>
          {score >= 4 ? "Well Done! 🌟" : "Good Try! 👍"}
        </Text>
        <Text style={styles.summaryText}>You found {score} / 5 words.</Text>
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
        <TouchableOpacity onPress={() => { stop(); onExit(); }}>
          <SVGIcon name="close-circle" color="#fff" size={32} />
        </TouchableOpacity>
        <Text style={styles.levelText}>Word Hunt 🔍</Text>
        <TouchableOpacity onPress={() => speak(words[index].hint)}>
          <SVGIcon name="volume-high" color="#fff" size={28} />
        </TouchableOpacity>
      </View>
      <View style={styles.scrambleContainer}>
        <Text style={styles.hintLabel}>GUESS THE WORD:</Text>
        <Text style={styles.hintValue}>{words[index].hint}</Text>
        <TextInput
          style={styles.textInput}
          placeholder="TYPE HERE..."
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
          <Text style={styles.checkButtonText}>SUBMIT</Text>
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
  hintValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    marginBottom: 30,
  },
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
