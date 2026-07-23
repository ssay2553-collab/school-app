import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { stop, speak } from "expo-speech";
import * as Animatable from "react-native-animatable";
import * as Haptics from "expo-haptics";
import SVGIcon from "../../SVGIcon";
import { usePersistedState } from "../../../hooks/student-dashboard/usePersistedState";
import { SCRAMBLE_DATA, REMARKS, WRONG_REMARKS } from "./GameConstants";
import { SHADOWS } from "../../../constants/theme";
import { useAuth } from "../../../contexts/AuthContext";
import { syncAchievementsToCloud } from "../../../utils/gameSync";

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
  const [words, setWords] = useState<string[]>([]);
  const [scrambled, setScrambled] = useState("");
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [input, setInput] = useState("");
  const [showSummary, setShowSummary] = useState(false);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; message: string; subMessage?: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

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
    return () => { stop(); };
  }, [startStage]);

  useEffect(() => {
    if (scrambled) {
      stop();
      speak("Unscramble this word", { rate: 0.9 });
    }
  }, [scrambled]);

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

  const check = async () => {
    if (isProcessing || !input.trim()) return;
    setIsProcessing(true);

    const isCorrect = input.toUpperCase().trim() === words[index];
    const remark = getRandomRemark(isCorrect);

    stop();
    speak(remark, { rate: 1.0 });

    if (isCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setScore((s) => s + 1);
      setFeedback({ isCorrect: true, message: remark });
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setFeedback({
        isCorrect: false,
        message: remark,
        subMessage: `The word was ${words[index]}`
      });
    }

    // Show feedback for 2 seconds before moving on
    setTimeout(() => {
      setFeedback(null);
      if (index + 1 < words.length) {
        const nextIdx = index + 1;
        setIndex(nextIdx);
        setScrambled(shuffle(words[nextIdx]));
        setInput("");
        setIsProcessing(false);
      } else {
        setShowSummary(true);
        setIsProcessing(false);
      }
    }, 2000);
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
        <TouchableOpacity onPress={() => { stop(); onExit(); }}>
          <SVGIcon name="close-circle" color="#fff" size={32} />
        </TouchableOpacity>
        <Text style={styles.levelText}>Scramble 🔠 (Lvl {level})</Text>
        <TouchableOpacity onPress={() => speak("Unscramble " + scrambled.split('').join(' '))}>
          <SVGIcon name="volume-high" color="#fff" size={28} />
        </TouchableOpacity>
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
            isProcessing && { opacity: 0.5 }
          ]}
          onPress={check}
          disabled={isProcessing}
        >
          <Text style={styles.checkButtonText}>{isProcessing ? "CHECKING..." : "CHECK"}</Text>
        </TouchableOpacity>
      </View>

      {feedback && (
        <Animatable.View
          animation="bounceIn"
          style={[
            styles.feedbackOverlay,
            { backgroundColor: feedback.isCorrect ? "#22C55E" : "#EF4444" }
          ]}
        >
          <SVGIcon
            name={feedback.isCorrect ? "checkmark-circle" : "close-circle"}
            color="#fff"
            size={60}
          />
          <Text style={styles.feedbackText}>{feedback.message}</Text>
          {feedback.subMessage && (
            <Text style={styles.feedbackSubText}>{feedback.subMessage}</Text>
          )}
        </Animatable.View>
      )}
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
  feedbackOverlay: {
    position: 'absolute',
    top: '30%',
    left: '10%',
    right: '10%',
    padding: 30,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.large,
    zIndex: 1000,
  },
  feedbackText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 10,
  },
  feedbackSubText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 5,
  },
});
