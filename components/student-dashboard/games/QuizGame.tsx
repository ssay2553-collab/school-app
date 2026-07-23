import React, { useCallback, useEffect, useState, useRef } from "react";
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import { stop, speak } from "expo-speech";
import SVGIcon from "../../SVGIcon";
import { usePersistedState } from "../../../hooks/student-dashboard/usePersistedState";
import { QUIZ_DATA, REMARKS, WRONG_REMARKS } from "./GameConstants";
import { SHADOWS } from "../../../constants/theme";
import { useAuth } from "../../../contexts/AuthContext";
import { syncAchievementsToCloud } from "../../../utils/gameSync";

const getRandomRemark = (isCorrect: boolean = true) => {
  const list = isCorrect ? REMARKS : WRONG_REMARKS;
  return list[Math.floor(Math.random() * list.length)];
};

interface QuizGameProps {
  onExit: () => void;
}

export const QuizGame: React.FC<QuizGameProps> = ({ onExit }) => {
  const { appUser } = useAuth();
  const [level, setLevel] = usePersistedState("@quiz_level", 1);
  const [questions, setQuestions] = useState<any[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [remark, setRemark] = useState<string>("");
  const [showSummary, setShowSummary] = useState(false);

  const startStage = useCallback(() => {
    let pool = QUIZ_DATA.filter((q) => q.level === level);
    if (pool.length === 0) pool = QUIZ_DATA;

    setQuestions([...pool].sort(() => 0.5 - Math.random()).slice(0, 5));
    setIndex(0);
    setScore(0);
    setSelected(null);
    setIsCorrect(null);
    setRemark("");
    setShowSummary(false);
  }, [level]);

  useEffect(() => {
    startStage();
    return () => { stop(); };
  }, [startStage]);

  useEffect(() => {
    if (questions[index]) {
      const q = questions[index];
      stop();
      speak(q.question, { rate: 0.9 });
    }
  }, [index, questions]);

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

  const handleAnswer = (opt: string) => {
    if (selected) return;
    const correct = opt === questions[index].answer;
    setSelected(opt);
    setIsCorrect(correct);
    const selectedRemark = getRandomRemark(correct);
    setRemark(selectedRemark);

    stop();
    speak(selectedRemark, { rate: 1.0 });

    if (correct) setScore((s) => s + 1);
    setTimeout(() => {
      if (index + 1 < questions.length) {
        setIndex((i) => i + 1);
        setSelected(null);
        setIsCorrect(null);
        setRemark("");
      } else setShowSummary(true);
    }, 1500);
  };

  if (showSummary)
    return (
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>
          {score >= 4 ? "Level Clear! 🎉" : "Try Again! 💪"}
        </Text>
        <Text style={styles.summaryText}>
          You got {score} / {questions.length} correct!
        </Text>
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

  const q = questions[index];
  if (!q) return <ActivityIndicator color="#fff" />;

  return (
    <View style={styles.gameContainer}>
      <View style={styles.gameHeader}>
        <TouchableOpacity onPress={() => { stop(); onExit(); }}>
          <SVGIcon name="close-circle" color="#fff" size={32} />
        </TouchableOpacity>
        <Text style={styles.levelText}>Quiz Fun!</Text>
        <TouchableOpacity onPress={() => speak(q.question)}>
          <SVGIcon name="volume-high" color="#fff" size={28} />
        </TouchableOpacity>
      </View>
      <View style={styles.questionContainer}>
        <Text style={styles.topicBadge}>{q.topic}</Text>
        <Text style={styles.questionText}>{q.question}</Text>
        {remark ? (
          <Animatable.Text
            animation="bounceIn"
            style={[
              styles.quizRemark,
              { color: isCorrect ? "#34D399" : "#F87171" },
            ]}
          >
            {remark}
          </Animatable.Text>
        ) : null}
      </View>
      <View style={styles.optionsContainer}>
        {q.options.map((opt: string) => (
          <TouchableOpacity
            key={opt}
            style={[
              styles.optionButton,
              selected === opt && {
                backgroundColor: isCorrect ? "#10B981" : "#EF4444",
              },
            ]}
            onPress={() => handleAnswer(opt)}
          >
            <Text style={styles.optionText}>{opt}</Text>
          </TouchableOpacity>
        ))}
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
  scoreText: {
    fontSize: 18,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "700",
  },
  questionContainer: { alignItems: "center", marginBottom: 40 },
  topicBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 20,
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
  },
  questionText: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    lineHeight: 34,
  },
  quizRemark: {
    fontSize: 22,
    fontWeight: "900",
    marginTop: 20,
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  optionsContainer: { gap: 15 },
  optionButton: {
    padding: 20,
    borderRadius: 20,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  optionText: { color: "#fff", fontWeight: "bold", fontSize: 18 },
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
