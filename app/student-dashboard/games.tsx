import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";

const { width } = Dimensions.get("window");

const REMARKS = [
  "Awesome! 🌟",
  "Excellent! ✨",
  "Brilliant! 🧠",
  "Very Good! 👍",
  "Fantastic! 🌈",
  "Great Job! 🎉",
  "Superstar! ⭐",
  "Way to go! 🚀",
];

const WRONG_REMARKS = [
  "Not quite, but keep trying! 💪",
  "Oops! You'll get it next time! ✨",
  "So close! Try again! 🌈",
  "Don't give up! You're learning! 🧠",
  "Almost there! Keep going! 🚀",
  "Keep your chin up! You can do it! ⭐",
];

const getRandomRemark = (isCorrect: boolean = true) => {
  const list = isCorrect ? REMARKS : WRONG_REMARKS;
  return list[Math.floor(Math.random() * list.length)];
};

type GameMode = "menu" | "quiz" | "word" | "memory" | "math" | "scramble";

const GAME_BG = {
  quiz: "#0EA5E9",
  word: "#10B981",
  memory: "#F59E0B",
  math: "#8B5CF6",
  scramble: "#F43F5E",
  menu: "#FDFDFD",
};

/* -----------------------------------------------------
   DATA STRUCTURES
----------------------------------------------------- */
const QUIZ_DATA = [
  // Level 1
  {
    topic: "Science 🧪",
    question: "Which organ pumps blood through the body?",
    options: ["Lungs", "Heart", "Brain", "Liver"],
    answer: "Heart",
    level: 1,
  },
  {
    topic: "Math 🔢",
    question: "What is 7 + 8?",
    options: ["14", "15", "16", "13"],
    answer: "15",
    level: 1,
  },
  {
    topic: "English 📖",
    question: "Which of these is a noun?",
    options: ["Run", "Blue", "Happiness", "Quickly"],
    answer: "Happiness",
    level: 1,
  },
  {
    topic: "Geography 🌍",
    question: "What is the capital city of Ghana?",
    options: ["Accra", "Kumasi", "Takoradi", "Tamale"],
    answer: "Accra",
    level: 1,
  },
  {
    topic: "Science 🚀",
    question: "What planet do we live on?",
    options: ["Mars", "Venus", "Earth", "Jupiter"],
    answer: "Earth",
    level: 1,
  },
  // Level 2
  {
    topic: "Science 🧬",
    question: "What is the hardest natural substance on Earth?",
    options: ["Gold", "Iron", "Diamond", "Quartz"],
    answer: "Diamond",
    level: 2,
  },
  {
    topic: "Math ➗",
    question: "What is 12 x 12?",
    options: ["124", "144", "164", "134"],
    answer: "144",
    level: 2,
  },
  {
    topic: "History 🏛️",
    question: "Who was the first President of Ghana?",
    options: ["J.B Danquah", "Kwame Nkrumah", "Jerry Rawlings", "John Kufuor"],
    answer: "Kwame Nkrumah",
    level: 2,
  },
  {
    topic: "General 💡",
    question: "How many colors are in a rainbow?",
    options: ["5", "6", "7", "8"],
    answer: "7",
    level: 2,
  },
  {
    topic: "English ✍️",
    question: "A person who writes books is called a/an...",
    options: ["Artist", "Author", "Actor", "Architect"],
    answer: "Author",
    level: 2,
  },
  // Level 3
  {
    topic: "Science 🌡️",
    question: "At what temperature does water boil?",
    options: ["50°C", "90°C", "100°C", "120°C"],
    answer: "100°C",
    level: 3,
  },
  {
    topic: "Math ✖️",
    question: "What is 50 multiplied by 4?",
    options: ["150", "200", "250", "300"],
    answer: "200",
    level: 3,
  },
  {
    topic: "History 🇬🇭",
    question: "In which year did Ghana gain independence?",
    options: ["1950", "1957", "1960", "1966"],
    answer: "1957",
    level: 3,
  },
  {
    topic: "Geography 🗺️",
    question: "Which is the longest river in the world?",
    options: ["Amazon", "Nile", "Mississippi", "Volta"],
    answer: "Nile",
    level: 3,
  },
  {
    topic: "English 💬",
    question: "Which word is a synonym for 'Joyful'?",
    options: ["Sad", "Angry", "Happy", "Tired"],
    answer: "Happy",
    level: 3,
  },
  // Level 4
  {
    topic: "Science 🌬️",
    question: "Which gas do humans need to breathe in to survive?",
    options: ["Nitrogen", "Carbon Dioxide", "Oxygen", "Helium"],
    answer: "Oxygen",
    level: 4,
  },
  {
    topic: "Math 📐",
    question: "What is the square root of 81?",
    options: ["7", "8", "9", "10"],
    answer: "9",
    level: 4,
  },
  {
    topic: "General 🐆",
    question: "What is the fastest land animal?",
    options: ["Lion", "Cheetah", "Horse", "Tiger"],
    answer: "Cheetah",
    level: 4,
  },
  {
    topic: "ICT 💻",
    question: "What does 'WWW' stand for?",
    options: ["World Wide Web", "World Word Web", "Western Wide Web", "World Wide Win"],
    answer: "World Wide Web",
    level: 4,
  },
  {
    topic: "Geography 🌏",
    question: "What is the largest continent on Earth?",
    options: ["Africa", "Europe", "Asia", "North America"],
    answer: "Asia",
    level: 4,
  },
];

const WORD_DATA = [
  { hint: "A common fruit that's also a color 🍎", word: "ORANGE", level: 1 },
  { hint: "A device used to type ⌨️", word: "KEYBOARD", level: 1 },
  { hint: "A large body of water 🌊", word: "OCEAN", level: 1 },
  { hint: "Place where students learn 🏫", word: "SCHOOL", level: 1 },
  { hint: "The capital of Ghana 🇬🇭", word: "ACCRA", level: 1 },
  { hint: "King of the jungle 🦁", word: "LION", level: 2 },
  { hint: "Opposite of cold ☀️", word: "HOT", level: 2 },
  { hint: "Something you use to brush your teeth 🦷", word: "TOOTHBRUSH", level: 2 },
  { hint: "The star at the center of our solar system ☀️", word: "SUN", level: 2 },
  { hint: "A very tall animal with a long neck 🦒", word: "GIRAFFE", level: 2 },
  { hint: "Earth's only natural satellite 🌙", word: "MOON", level: 3 },
  { hint: "A person who treats sick people 🩺", word: "DOCTOR", level: 3 },
  { hint: "The building where you live 🏠", word: "HOUSE", level: 3 },
  { hint: "You use this to keep dry in rain ☂️", word: "UMBRELLA", level: 3 },
  { hint: "A large animal with a trunk 🐘", word: "ELEPHANT", level: 3 },
];

const SCRAMBLE_DATA = [
  { word: "APPLE", level: 1 },
  { word: "BANANA", level: 1 },
  { word: "CHAIR", level: 1 },
  { word: "TABLE", level: 1 },
  { word: "WINDOW", level: 1 },
  { word: "COMPUTER", level: 2 },
  { word: "ELEPHANT", level: 2 },
  { word: "MOUNTAIN", level: 2 },
  { word: "UNIVERSE", level: 2 },
  { word: "FOOTBALL", level: 2 },
];
const MEMORY_EMOJIS = [
  "🍎",
  "🐶",
  "🚀",
  "🌈",
  "🎈",
  "🍦",
  "🦁",
  "🎨",
  "⚽",
  "🍕",
  "🎸",
  "🦋",
];

const usePersistedState = (key: string, defaultValue: any) => {
  const [state, setState] = useState(defaultValue);
  useEffect(() => {
    const load = async () => {
      const saved = await AsyncStorage.getItem(key);
      if (saved) setState(JSON.parse(saved));
    };
    load();
  }, [key]);
  const setPersistedState = useCallback(
    (val: any) => {
      setState(val);
      AsyncStorage.setItem(key, JSON.stringify(val));
    },
    [key],
  );
  return [state, setPersistedState];
};

const QuizGame = ({ onExit }: { onExit: () => void }) => {
  const [level, setLevel] = usePersistedState("@quiz_level", 1);
  const [questions, setQuestions] = useState<any[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [remark, setRemark] = useState<string>("");
  const [showSummary, setShowSummary] = useState(false);

  const startStage = useCallback(() => {
    // Filter by level or fallback to random if level is too high
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
  }, [startStage]);

  const handleNextLevel = () => {
    if (score >= 4) {
      setLevel(level + 1);
    } else {
      startStage();
    }
  };

  const handleAnswer = (opt: string) => {
    if (selected) return;
    const correct = opt === questions[index].answer;
    setSelected(opt);
    setIsCorrect(correct);
    setRemark(getRandomRemark(correct));
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
        <TouchableOpacity onPress={onExit}>
          <SVGIcon name="close-circle" color="#fff" size={32} />
        </TouchableOpacity>
        <Text style={styles.levelText}>Quiz Fun!</Text>
        <Text style={styles.scoreText}>Score: {score}</Text>
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

const WordHuntGame = ({ onExit }: { onExit: () => void }) => {
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
  }, [startStage]);

  const handleNextLevel = () => {
    if (score >= 4) {
      setLevel(level + 1);
    } else {
      startStage();
    }
  };

  const check = () => {
    const isCorrect = input.toUpperCase().trim() === words[index].word;
    if (isCorrect) {
      setScore((s) => s + 1);
      Alert.alert("Correct!", getRandomRemark(true));
    } else {
      Alert.alert(
        "Oops!",
        `${getRandomRemark(false)}\n\nThe word was ${words[index].word}`,
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
        <TouchableOpacity onPress={onExit}>
          <SVGIcon name="close-circle" color="#fff" size={32} />
        </TouchableOpacity>
        <Text style={styles.levelText}>Word Hunt 🔍</Text>
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

const ScrambleGame = ({ onExit }: { onExit: () => void }) => {
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

export default function GamesScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<GameMode>("menu");
  const render = () => {
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
        render()
      )}
    </SafeAreaView>
  );
}

const MenuCard = ({ title, icon, color, onPress }: any) => (
  <TouchableOpacity
    style={[styles.menuCard, { backgroundColor: color }]}
    onPress={onPress}
  >
    <SVGIcon name={icon} size={32} color="#fff" />
    <Text style={styles.menuCardTitle}>{title}</Text>
  </TouchableOpacity>
);

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
  menuCard: {
    width: (width - 60) / 2,
    height: 140,
    borderRadius: 25,
    padding: 20,
    marginBottom: 20,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.small,
  },
  menuCardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
    marginTop: 12,
    textAlign: "center",
  },
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
});
