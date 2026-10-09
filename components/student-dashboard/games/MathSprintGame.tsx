import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
} from "react-native";
import * as Animatable from "react-native-animatable";
import { safeSpeak, safeStop } from "../../../utils/safeSpeech";
import SVGIcon from "../../SVGIcon";
import { usePersistedState } from "../../../hooks/student-dashboard/usePersistedState";
import { MATH_SPRINT_DATA, REMARKS, WRONG_REMARKS, MathQuestion } from "./GameConstants";
import { SHADOWS } from "../../../constants/theme";
import { useAuth } from "../../../contexts/AuthContext";
import { syncAchievementsToCloud, getStudentNameFromUser } from "../../../utils/gameSync";

const getRandomRemark = (isCorrect: boolean = true) => {
  const list = isCorrect
    ? ["Speed Genius! ⚡", "Lightning Fast! ⚡", "Awesome Math! 🌟", "Spot On! ✨", "Superstar! ⭐", ...REMARKS]
    : WRONG_REMARKS;
  return list[Math.floor(Math.random() * list.length)];
};

interface MathSprintGameProps {
  onExit: () => void;
}

const QUESTION_TIMER_SECONDS = 15;

export const MathSprintGame: React.FC<MathSprintGameProps> = ({ onExit }) => {
  const { appUser } = useAuth();
  const [level, setLevel] = usePersistedState("@math_level", 1);
  const [questions, setQuestions] = useState<MathQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [remark, setRemark] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIMER_SECONDS);
  const [showSummary, setShowSummary] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timerAnim = useRef(new Animated.Value(1)).current;

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(QUESTION_TIMER_SECONDS);
    timerAnim.setValue(1);

    Animated.timing(timerAnim, {
      toValue: 0,
      duration: QUESTION_TIMER_SECONDS * 1000,
      useNativeDriver: false,
    }).start();

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [timerAnim]);

  const startStage = useCallback(() => {
    let pool = MATH_SPRINT_DATA.filter((q) => q.level === level);
    if (pool.length === 0) {
      pool = MATH_SPRINT_DATA.filter((q) => q.level <= level);
    }
    if (pool.length === 0) {
      pool = MATH_SPRINT_DATA;
    }

    const selectedQuestions = [...pool]
      .sort(() => 0.5 - Math.random())
      .slice(0, 5)
      .map((q) => ({
        ...q,
        options: [...q.options].sort(() => 0.5 - Math.random()),
      }));

    setQuestions(selectedQuestions);
    setIndex(0);
    setScore(0);
    setStreak(0);
    setSelected(null);
    setIsCorrect(null);
    setRemark("");
    setShowSummary(false);
  }, [level]);

  useEffect(() => {
    startStage();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      safeStop();
    };
  }, [startStage]);

  useEffect(() => {
    if (questions[index] && !showSummary) {
      const q = questions[index];
      safeStop();
      safeSpeak(`Solve: ${q.question.replace("=", "")}`, { rate: 1.0 });
      startTimer();
    }
  }, [index, questions, showSummary, startTimer]);

  useEffect(() => {
    if (timeLeft === 0 && selected === null && questions.length > 0) {
      // Time ran out!
      setSelected("TIMEOUT");
      setIsCorrect(false);
      setStreak(0);
      setRemark("Time's up! ⏰");
      safeStop();
      safeSpeak("Time's up!", { rate: 1.0 });

      setTimeout(() => {
        advanceQuestion();
      }, 1500);
    }
  }, [timeLeft, selected, questions]);

  const advanceQuestion = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (index + 1 < questions.length) {
      setIndex((i) => i + 1);
      setSelected(null);
      setIsCorrect(null);
      setRemark("");
    } else {
      setShowSummary(true);
    }
  };

  const handleNextLevel = () => {
    safeStop();
    if (score >= 4) {
      setLevel(level + 1);
      if (appUser?.uid) {
        syncAchievementsToCloud(appUser.uid, getStudentNameFromUser(appUser), appUser.classId);
      }
    } else {
      startStage();
    }
  };

  const handleAnswer = (opt: string) => {
    if (selected !== null) return;
    if (timerRef.current) clearInterval(timerRef.current);

    const correct = opt === questions[index].answer;
    setSelected(opt);
    setIsCorrect(correct);

    if (correct) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      setScore((s) => s + 1);
      const selectedRemark = newStreak > 1 ? `🔥 ${newStreak}x Streak!` : getRandomRemark(true);
      setRemark(selectedRemark);
      safeStop();
      safeSpeak(selectedRemark, { rate: 1.0 });
    } else {
      setStreak(0);
      const selectedRemark = getRandomRemark(false);
      setRemark(selectedRemark);
      safeStop();
      safeSpeak(selectedRemark, { rate: 1.0 });
    }

    setTimeout(() => {
      advanceQuestion();
    }, 1200);
  };

  if (showSummary) {
    return (
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>
          {score >= 4 ? "Sprint Completed! ⚡🎉" : "Keep Practicing! 💪"}
        </Text>
        <Text style={styles.summaryText}>
          You scored {score} / {questions.length} correct!
        </Text>
        {score >= 4 ? (
          <Text style={styles.summaryBadge}>Level {level} Unlocked! 🚀</Text>
        ) : null}
        <TouchableOpacity style={styles.summaryButton} onPress={handleNextLevel}>
          <Text style={styles.summaryButtonText}>
            {score >= 4 ? "Next Level ➡️" : "Retry Sprint 🔄"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.exitButton} onPress={onExit}>
          <Text style={styles.exitButtonText}>Back to Menu</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const q = questions[index];
  if (!q) return <ActivityIndicator color="#fff" style={{ flex: 1 }} />;

  return (
    <View style={styles.gameContainer}>
      {/* Game Header */}
      <View style={styles.gameHeader}>
        <TouchableOpacity onPress={() => { safeStop(); onExit(); }}>
          <SVGIcon name="close-circle" color="#fff" size={32} />
        </TouchableOpacity>
        <Text style={styles.levelText}>Math Sprint ⚡ Lvl {level}</Text>
        <TouchableOpacity onPress={() => safeSpeak(`Solve: ${q.question.replace("=", "")}`)}>
          <SVGIcon name="volume-high" color="#fff" size={28} />
        </TouchableOpacity>
      </View>

      {/* Progress & Timer Bar */}
      <View style={styles.timerBarContainer}>
        <Animated.View
          style={[
            styles.timerBar,
            {
              width: timerAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
              backgroundColor: timeLeft <= 5 ? "#EF4444" : "#F59E0B",
            },
          ]}
        />
      </View>
      <Text style={styles.timerText}>⏱️ {timeLeft}s remaining</Text>

      {/* Streak Badge */}
      {streak > 1 && (
        <Animatable.View animation="pulse" iterationCount="infinite" style={styles.streakBadge}>
          <Text style={styles.streakText}>🔥 {streak}x STREAK!</Text>
        </Animatable.View>
      )}

      {/* Question Card */}
      <View style={styles.questionContainer}>
        <Text style={styles.topicBadge}>SPEED ARITHMETIC 🧮</Text>
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

      {/* Speed Options */}
      <View style={styles.optionsGrid}>
        {q.options.map((opt: string) => {
          const isThisSelected = selected === opt;
          const isCorrectAnswer = opt === q.answer;

          let btnBg = "rgba(255,255,255,0.2)";
          if (selected !== null) {
            if (isThisSelected) {
              btnBg = isCorrect ? "#10B981" : "#EF4444";
            } else if (isCorrectAnswer && selected !== "TIMEOUT") {
              btnBg = "#10B981";
            }
          }

          return (
            <TouchableOpacity
              key={opt}
              style={[styles.optionButton, { backgroundColor: btnBg }]}
              onPress={() => handleAnswer(opt)}
              disabled={selected !== null}
            >
              <Text style={styles.optionText}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  gameContainer: { flex: 1, padding: 20 },
  gameHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  levelText: { fontSize: 20, fontWeight: "900", color: "#fff" },
  timerBarContainer: {
    height: 10,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 5,
    overflow: "hidden",
    marginBottom: 5,
  },
  timerBar: { height: "100%", borderRadius: 5 },
  timerText: {
    color: "rgba(255,255,255,0.9)",
    fontWeight: "800",
    fontSize: 13,
    textAlign: "right",
    marginBottom: 10,
  },
  streakBadge: {
    alignSelf: "center",
    backgroundColor: "#F59E0B",
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 10,
  },
  streakText: { color: "#fff", fontWeight: "900", fontSize: 14 },
  questionContainer: { alignItems: "center", marginVertical: 25 },
  topicBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 15,
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
  },
  questionText: {
    fontSize: 42,
    fontWeight: "900",
    color: "#fff",
    textAlign: "center",
    lineHeight: 50,
  },
  quizRemark: {
    fontSize: 22,
    fontWeight: "900",
    marginTop: 15,
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 15,
    marginTop: "auto",
    marginBottom: 20,
  },
  optionButton: {
    width: "47%",
    paddingVertical: 22,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.medium,
  },
  optionText: { color: "#fff", fontWeight: "900", fontSize: 26 },
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
    fontSize: 20,
    color: "rgba(255,255,255,0.9)",
    marginBottom: 15,
  },
  summaryBadge: {
    color: "#FDE047",
    fontWeight: "900",
    fontSize: 18,
    marginBottom: 30,
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
