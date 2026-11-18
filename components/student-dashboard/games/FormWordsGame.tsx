import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import * as Speech from "expo-speech";
import {
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../../firebaseConfig";
import { useAuth } from "../../../contexts/AuthContext";
import SVGIcon from "../../SVGIcon";
import { SHADOWS } from "../../../constants/theme";
import { CelebrationModal } from "./CelebrationModal";
import { syncAchievementsToCloud, getStudentNameFromUser } from "../../../utils/gameSync";
import { canFormWord, isDictionaryWord, getValidSubWords } from "./FormWordsDictionary";

const BASE_WORDS_POOL = [
  { word: "EXPERIMENT", hint: "A scientific test" },
  { word: "DICTIONARY", hint: "A book of words" },
  { word: "TECHNOLOGY", hint: "Science applied to industry" },
  { word: "ADVENTURE", hint: "An exciting experience" },
  { word: "CLASSROOM", hint: "Where students learn" },
  { word: "ASTRONAUT", hint: "Space traveler" },
  { word: "UNIVERSITY", hint: "Higher education institution" },
  { word: "INVENTION", hint: "A newly created device" },
  { word: "CALCULATOR", hint: "Math solving tool" },
  { word: "ENVIRONMENT", hint: "The natural world around us" },
  { word: "MATHEMATICS", hint: "Study of numbers & shapes" },
  { word: "GEOGRAPHY", hint: "Study of Earth's surface" },
  { word: "LITERATURE", hint: "Written artistic works" },
  { word: "ARCHAEOLOGY", hint: "Study of human history" },
  { word: "ASTRONOMY", hint: "Study of stars and space" },
  { word: "BIODIVERSITY", hint: "Variety of life on Earth" },
  { word: "CONSTELLATION", hint: "Group of stars in the sky" },
  { word: "ENCYCLOPEDIA", hint: "Comprehensive reference book" },
  { word: "ARCHITECTURE", hint: "Art and science of building" },
  { word: "ATMOSPHERE", hint: "Layers of gases surrounding Earth" },
  { word: "BIOCHEMISTRY", hint: "Chemistry of living organisms" },
  { word: "CARTOGRAPHY", hint: "Science of making maps" },
  { word: "DEMOCRACY", hint: "Government by the people" },
  { word: "ELECTRICITY", hint: "Flow of electric power" },
  { word: "FOUNDATION", hint: "The base supporting a structure" },
  { word: "GREENHOUSE", hint: "Glass building for plants" },
  { word: "HEMISPHERE", hint: "Half of the earth sphere" },
  { word: "INNOVATION", hint: "A new method or idea" },
  { word: "LABORATORY", hint: "Room for scientific research" },
  { word: "MICROSCOPE", hint: "Tool to see tiny objects" },
  { word: "NAVIGATION", hint: "Directing the course of a ship" },
  { word: "OBSERVATORY", hint: "Building for observing stars" },
  { word: "PALEONTOLOGY", hint: "Study of fossils" },
  { word: "PHOTOSYNTHESIS", hint: "Plant food production" },
  { word: "QUARANTINE", hint: "Isolation for health safety" },
  { word: "RENAISSANCE", hint: "Revival of art and learning" },
  { word: "SUBTERRANEAN", hint: "Existing beneath the earth" },
  { word: "THERMODYNAMICS", hint: "Physics of heat and energy" },
  { word: "TRIGONOMETRY", hint: "Branch of mathematics" },
];

interface FormWordsGameProps {
  onExit: () => void;
}

export function FormWordsGame({ onExit }: FormWordsGameProps) {
  const { appUser } = useAuth();
  const [gameState, setGameState] = useState<"menu" | "playing" | "round_summary" | "final_summary" | "defeat_summary" | "tie_summary">("menu");

  // Game Rounds configuration (3 Rounds, 1 unique base word per round = 3 unique words total)
  const [currentRound, setCurrentRound] = useState(1);
  const [roundWords, setRoundWords] = useState<{ word: string; hint: string }[]>([]);

  const [timeLeft, setTimeLeft] = useState(90);
  const [inputWord, setInputWord] = useState("");
  const [foundWords, setFoundWords] = useState<string[]>([]);
  const [totalScore, setTotalScore] = useState(0);
  const [roundScore, setRoundScore] = useState(0);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: "success" | "error" | "warning" } | null>(null);

  // PC Opponent state
  const [pcTotalScore, setPcTotalScore] = useState(0);
  const [pcRoundScore, setPcRoundScore] = useState(0);
  const [pcWords, setPcWords] = useState<string[]>([]);

  // Multiplayer state
  const [roomCode, setRoomCode] = useState("");
  const [matchId, setMatchId] = useState<string | null>(null);
  const [opponentName, setOpponentName] = useState<string>("Waiting for opponent...");
  const [opponentTotalScore, setOpponentTotalScore] = useState(0);
  const [opponentWords, setOpponentWords] = useState<string[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [isMultiplayer, setIsMultiplayer] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Start Solo Game vs PC
  const startSoloGame = () => {
    setIsMultiplayer(false);
    // 3 Rounds, 1 unique base word per round = 3 words total
    const shuffledUnique = [...BASE_WORDS_POOL].sort(() => 0.5 - Math.random()).slice(0, 3);
    setRoundWords(shuffledUnique);
    setCurrentRound(1);
    setTotalScore(0);
    setRoundScore(0);
    setPcTotalScore(0);
    setPcRoundScore(0);
    setFoundWords([]);
    setPcWords([]);
    setTimeLeft(90);
    setFeedbackMsg(null);
    setGameState("playing");
  };

  // Timer effect for round & competitive PC Opponent AI
  useEffect(() => {
    if (gameState === "playing") {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            handleEndRound();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Competitive PC Opponent AI timer simulation
      // Round 1 (Easy): Every 10s per word
      // Round 2 (Moderate): Every 7s per word
      // Round 3 (Difficult): Every 7s per word
      let pcInterval: NodeJS.Timeout | null = null;
      if (!isMultiplayer) {
        const pcIntervalMs = currentRound === 1 ? 10000 : 7000;
        pcInterval = setInterval(() => {
          const currentBaseStr = roundWords[currentRound - 1]?.word || "EXPERIMENT";
          const allSubwords = getValidSubWords(currentBaseStr);

          // Filter out words already submitted by PC or by user
          const validForPc = allSubwords.filter(w =>
            !pcWords.includes(w) &&
            !foundWords.includes(w)
          );

          if (validForPc.length > 0) {
            // Select a word. In Round 3 (Difficult), favor longer/higher scoring words if available
            let chosen: string;
            if (currentRound === 3 && validForPc.some(w => w.length >= 5)) {
              const longWords = validForPc.filter(w => w.length >= 5);
              chosen = longWords[Math.floor(Math.random() * longWords.length)];
            } else {
              chosen = validForPc[Math.floor(Math.random() * validForPc.length)];
            }

            setPcWords(p => [chosen, ...p]);
            const pts = chosen.length * 2;
            setPcRoundScore(s => s + pts);
            setPcTotalScore(s => s + pts);
          }
        }, pcIntervalMs);
      }

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (pcInterval) clearInterval(pcInterval);
      };
    }
  }, [gameState, currentRound, roundWords, foundWords, pcWords, isMultiplayer]);

  const handleEndRound = () => {
    if (currentRound < 3) {
      setGameState("round_summary");
      Speech.speak(`Round ${currentRound} complete!`, { language: 'en' });
    } else {
      if (appUser?.uid) {
        syncAchievementsToCloud(appUser.uid, getStudentNameFromUser(appUser), appUser.classId, totalScore);
      }

      if (isMultiplayer && matchId && appUser?.uid) {
        updateDoc(doc(db, "word_battles", matchId), {
          status: "finished",
          [`scores.${appUser.uid}`]: totalScore,
        }).catch(err => console.error(err));
      }

      const opponentScoreFinal = isMultiplayer ? opponentTotalScore : pcTotalScore;
      if (totalScore > opponentScoreFinal) {
        setGameState("final_summary");
        Speech.speak("Congratulations! You won the championship!", { language: 'en' });
      } else if (totalScore === opponentScoreFinal) {
        setGameState("tie_summary");
        Speech.speak("Incredible battle! It is a draw!", { language: 'en' });
      } else {
        setGameState("defeat_summary");
        Speech.speak("Good effort! You fought a great battle.", { language: 'en' });
      }
    }
  };

  // Submit word with strict dictionary validation
  const handleSumbitWord = () => {
    const clean = inputWord.toUpperCase().trim();
    if (!clean) return;

    const currentBase = roundWords[currentRound - 1]?.word || "";

    // Rule 1: Letter availability check
    if (!canFormWord(clean, currentBase)) {
      setFeedbackMsg({ text: `Wrong letters! "${clean}" cannot be formed from "${currentBase}".`, type: "error" });
      setInputWord("");
      setTimeout(() => setFeedbackMsg(null), 3000);
      return;
    }

    // Rule 2: Strict English Dictionary check
    if (!isDictionaryWord(clean, currentBase)) {
      setFeedbackMsg({ text: `Invalid word! "${clean}" is not a valid English word.`, type: "error" });
      setInputWord("");
      setTimeout(() => setFeedbackMsg(null), 3000);
      return;
    }

    // Rule 3: Already found by user
    if (foundWords.includes(clean)) {
      setFeedbackMsg({ text: `You already found "${clean}"!`, type: "warning" });
      setInputWord("");
      setTimeout(() => setFeedbackMsg(null), 3000);
      return;
    }

    // Rule 4: Unique word rule against opponent / PC
    const takenByOpponent = isMultiplayer ? opponentWords.includes(clean) : pcWords.includes(clean);
    if (takenByOpponent) {
      setFeedbackMsg({ text: `Word already taken! Opponent already submitted "${clean}".`, type: "warning" });
      setInputWord("");
      setTimeout(() => setFeedbackMsg(null), 3000);
      return;
    }

    const newFound = [clean, ...foundWords];
    const points = clean.length * 2;
    setFoundWords(newFound);
    const newRoundScore = roundScore + points;
    const newTotalScore = totalScore + points;
    setRoundScore(newRoundScore);
    setTotalScore(newTotalScore);
    setInputWord("");
    setFeedbackMsg({ text: `Correct! +${points} pts`, type: "success" });
    setTimeout(() => setFeedbackMsg(null), 2500);

    if (isMultiplayer && matchId && appUser?.uid) {
      updateDoc(doc(db, "word_battles", matchId), {
        [`scores.${appUser.uid}`]: newTotalScore,
        [`words.${appUser.uid}`]: newFound,
      }).catch(err => console.error(err));
    }
  };

  // Create Multiplayer Room
  const createMatchRoom = async () => {
    if (!appUser?.uid) return;
    setLoadingMatch(true);
    setIsMultiplayer(true);
    try {
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      setRoomCode(code);
      setIsHost(true);
      const shuffledUnique = [...BASE_WORDS_POOL].sort(() => 0.5 - Math.random()).slice(0, 3);
      setRoundWords(shuffledUnique);

      const matchRef = doc(db, "word_battles", code);
      await setDoc(matchRef, {
        hostId: appUser.uid,
        hostName: appUser.displayName || appUser.email || "Student",
        opponentId: null,
        opponentName: null,
        roundWords: shuffledUnique,
        status: "waiting",
        scores: { [appUser.uid]: 0 },
        words: { [appUser.uid]: [] },
        createdAt: serverTimestamp(),
      });

      setMatchId(code);
      setGameState("menu");
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Could not create online match.");
    } finally {
      setLoadingMatch(false);
    }
  };

  // Join Multiplayer Room
  const joinMatchRoom = async () => {
    if (!appUser?.uid || !roomCode.trim()) {
      Alert.alert("Enter Code", "Please enter a valid 4-digit room code.");
      return;
    }
    setLoadingMatch(true);
    setIsMultiplayer(true);
    try {
      const matchRef = doc(db, "word_battles", roomCode.trim());
      const snap = await getDoc(matchRef);
      if (!snap.exists()) {
        Alert.alert("Not Found", "Match room code does not exist.");
        setLoadingMatch(false);
        return;
      }

      const data = snap.data();
      if (data.status !== "waiting") {
        Alert.alert("Match Started", "This match has already started or finished.");
        setLoadingMatch(false);
        return;
      }

      setRoundWords(data.roundWords || [...BASE_WORDS_POOL].slice(0, 3));
      setIsHost(false);
      setMatchId(roomCode.trim());

      await updateDoc(matchRef, {
        opponentId: appUser.uid,
        opponentName: appUser.displayName || appUser.email || "Challenger",
        status: "playing",
        [`scores.${appUser.uid}`]: 0,
        [`words.${appUser.uid}`]: [],
      });

      setCurrentRound(1);
      setTimeLeft(90);
      setFoundWords([]);
      setTotalScore(0);
      setRoundScore(0);
      setOpponentWords([]);
      setGameState("playing");
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Could not join room.");
    } finally {
      setLoadingMatch(false);
    }
  };

  // Listen to match room updates
  useEffect(() => {
    if (!matchId) return;

    const unsub = onSnapshot(doc(db, "word_battles", matchId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();

      if (gameState === "menu" && data.status === "playing") {
        setCurrentRound(1);
        setTimeLeft(90);
        setFoundWords([]);
        setTotalScore(0);
        setRoundScore(0);
        setOpponentWords([]);
        setGameState("playing");
      }

      if (data.opponentName && isHost) setOpponentName(data.opponentName);
      else if (!isHost && data.hostName) setOpponentName(data.hostName);

      const oppId = isHost ? data.opponentId : data.hostId;
      if (oppId) {
        if (data.scores && data.scores[oppId] !== undefined) setOpponentTotalScore(data.scores[oppId]);
        if (data.words && data.words[oppId] !== undefined) setOpponentWords(data.words[oppId]);
      }

      if (data.status === "finished" && gameState === "playing") {
        const myFinalScore = totalScore;
        const oppFinalScore = oppId && data.scores ? (data.scores[oppId] || 0) : 0;
        if (myFinalScore > oppFinalScore) {
          setGameState("final_summary");
          Speech.speak("Congratulations! You won the battle!", { language: 'en' });
        } else if (myFinalScore === oppFinalScore) {
          setGameState("tie_summary");
          Speech.speak("Incredible battle! It is a draw!", { language: 'en' });
        } else {
          setGameState("defeat_summary");
          Speech.speak("Good effort! Your opponent won this battle.", { language: 'en' });
        }
      }
    });

    return () => unsub();
  }, [matchId, gameState, isHost, totalScore]);

  const currentBase = roundWords[currentRound - 1] || { word: "EXPERIMENT", hint: "A scientific test" };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onExit} style={styles.backBtn}>
          <SVGIcon name="arrow-back" size={22} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Form Words 🔠 (3 Rounds)</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* MENU STATE */}
      {gameState === "menu" && !matchId && (
        <ScrollView contentContainerStyle={styles.menuContent} showsVerticalScrollIndicator={false}>
          <View style={styles.bannerCard}>
            <SVGIcon name="flash" size={48} color="#2563EB" />
            <Text style={styles.bannerTitle}>Word Builder Championship</Text>
            <Text style={styles.bannerSub}>
              3 Rounds • 1 Word per Round (40+ Word Bank) • 90 Seconds per Round.
            </Text>
          </View>

          <TouchableOpacity style={[styles.modeCard, { backgroundColor: "#EFF6FF", borderColor: "#3B82F6" }]} onPress={startSoloGame}>
            <SVGIcon name="person" size={28} color="#2563EB" />
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={[styles.modeTitle, { color: "#1D4ED8" }]}>Play vs. Computer (AI)</Text>
              <Text style={styles.modeSub}>Complete 3 exciting rounds against the PC!</Text>
            </View>
            <SVGIcon name="chevron-forward" size={20} color="#3B82F6" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.modeCard, { backgroundColor: "#F0FDF4", borderColor: "#22C55E" }]} onPress={createMatchRoom}>
            <SVGIcon name="people" size={28} color="#16A34A" />
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={[styles.modeTitle, { color: "#15803D" }]}>Host Mate Battle</Text>
              <Text style={styles.modeSub}>Create a 4-digit code and challenge a classmate live!</Text>
            </View>
            <SVGIcon name="chevron-forward" size={20} color="#16A34A" />
          </TouchableOpacity>

          <View style={styles.joinBox}>
            <Text style={styles.joinLabel}>Have a Room Code? Join Mate:</Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <TextInput
                style={styles.codeInput}
                placeholder="Enter 4-digit code"
                placeholderTextColor="#94A3B8"
                value={roomCode}
                onChangeText={setRoomCode}
                keyboardType="numeric"
                maxLength={4}
              />
              <TouchableOpacity style={styles.joinBtn} onPress={joinMatchRoom} disabled={loadingMatch}>
                {loadingMatch ? <ActivityIndicator color="#fff" /> : <Text style={styles.joinBtnText}>Join Battle</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}

      {/* WAITING LOBBY */}
      {gameState === "menu" && matchId && (
        <View style={styles.lobbyContainer}>
          <View style={styles.roomCodeBadge}>
            <Text style={styles.roomCodeLabel}>ROOM CODE</Text>
            <Text style={styles.roomCodeText}>{roomCode}</Text>
          </View>
          <Text style={styles.waitingText}>Waiting for a classmate to join...</Text>
          <ActivityIndicator size="large" color="#2563EB" style={{ marginVertical: 20 }} />
          <Text style={styles.tipText}>Share this 4-digit code with your mate so they can join your live battle!</Text>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => { setMatchId(null); }}>
            <Text style={styles.cancelBtnText}>Cancel Match</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* PLAYING STATE */}
      {gameState === "playing" && (
        <ScrollView contentContainerStyle={styles.playingContent} showsVerticalScrollIndicator={false}>
          {/* STATS BAR */}
          <View style={styles.statsBar}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>ROUND</Text>
              <Text style={[styles.statValue, { color: "#7C3AED" }]}>{currentRound}/3</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>TIME LEFT</Text>
              <Text style={[styles.statValue, timeLeft <= 15 && { color: "#EF4444" }]}>{timeLeft}s</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>MY SCORE</Text>
              <Text style={[styles.statValue, { color: "#2563EB" }]}>{totalScore}</Text>
            </View>
          </View>

          {/* BASE WORD CARD */}
          <View style={styles.baseWordCard}>
            <Text style={styles.baseWordHint}>{currentBase.hint}</Text>
            <Text style={styles.baseWordText}>{currentBase.word}</Text>
            <Text style={styles.baseWordSub}>Form unique words using these letters!</Text>
            <TouchableOpacity
              style={styles.skipWordBtn}
              onPress={handleEndRound}
              activeOpacity={0.8}
            >
              <Text style={styles.skipWordBtnText}>
                {currentRound < 3 ? `Done with Round ${currentRound}? Go to Round ${currentRound + 1} ➡️` : "Finish Championship 🎯"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* FEEDBACK BANNER */}
          {feedbackMsg && (
            <View style={[styles.feedbackBanner, {
              backgroundColor: feedbackMsg.type === "success" ? "#DCFCE7" : feedbackMsg.type === "error" ? "#FEE2E2" : "#FEF3C7",
              borderColor: feedbackMsg.type === "success" ? "#22C55E" : feedbackMsg.type === "error" ? "#EF4444" : "#F59E0B"
            }]}>
              <Text style={[styles.feedbackText, {
                color: feedbackMsg.type === "success" ? "#166534" : feedbackMsg.type === "error" ? "#991B1B" : "#B45309"
              }]}>
                {feedbackMsg.text}
              </Text>
            </View>
          )}

          {/* INPUT FORM */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.wordInput}
              placeholder="Type word here..."
              placeholderTextColor="#94A3B8"
              value={inputWord}
              onChangeText={setInputWord}
              onSubmitEditing={handleSumbitWord}
              autoCapitalize="characters"
            />
            <TouchableOpacity style={styles.submitBtn} onPress={handleSumbitWord}>
              <Text style={styles.submitBtnText}>Submit</Text>
            </TouchableOpacity>
          </View>

          {/* DUAL WORD LISTS */}
          <View style={styles.listsContainer}>
            <View style={[styles.wordsSection, { flex: 1 }]}>
              <Text style={styles.sectionTitle}>Your Words ({foundWords.length})</Text>
              <View style={styles.chipGrid}>
                {foundWords.length === 0 ? (
                  <Text style={styles.noWordsText}>No words yet</Text>
                ) : (
                  foundWords.map((w, idx) => (
                    <View key={idx} style={styles.wordChip}>
                      <Text style={styles.wordChipText}>{w}</Text>
                      <Text style={styles.wordChipPoints}>+{w.length * 2}</Text>
                    </View>
                  ))
                )}
              </View>
            </View>

            <View style={[styles.wordsSection, { flex: 1, backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }]}>
              <Text style={[styles.sectionTitle, { color: "#B45309" }]}>
                {isMultiplayer ? `${opponentName}'s Words` : "PC Words"} ({isMultiplayer ? opponentWords.length : pcWords.length})
              </Text>
              <View style={styles.chipGrid}>
                {((isMultiplayer ? opponentWords : pcWords).length === 0) ? (
                  <Text style={styles.noWordsText}>Waiting for opponent...</Text>
                ) : (
                  (isMultiplayer ? opponentWords : pcWords).map((w, idx) => (
                    <View key={idx} style={[styles.wordChip, { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" }]}>
                      <Text style={[styles.wordChipText, { color: "#B45309" }]}>{w}</Text>
                      <Text style={[styles.wordChipPoints, { color: "#D97706" }]}>+{w.length * 2}</Text>
                    </View>
                  ))
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      )}

      {/* ROUND SUMMARY STATE */}
      {gameState === "round_summary" && (
        <View style={styles.summaryContainer}>
          <SVGIcon name="flag" size={56} color="#3B82F6" />
          <Text style={styles.summaryTitle}>Round {currentRound} Complete! 🎯</Text>
          <Text style={styles.summarySub}>
            You found {foundWords.length} word(s) in Round {currentRound}! Get ready for Round {currentRound + 1}.
          </Text>

          <TouchableOpacity
            style={styles.playAgainBtn}
            onPress={() => {
              setCurrentRound(r => r + 1);
              setTimeLeft(90);
              setFoundWords([]);
              setPcWords([]);
              setRoundScore(0);
              setPcRoundScore(0);
              setGameState("playing");
            }}
          >
            <Text style={styles.playAgainBtnText}>Start Round {currentRound + 1}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* REUSABLE CELEBRATION MODAL FOR VICTORY */}
      <CelebrationModal
        visible={gameState === "final_summary"}
        title="CONGRATULATIONS!"
        subtitle="YOU WON THE CHAMPIONSHIP! 🏆"
        scoreText={`Final Score: ${totalScore} Points 🌟`}
        isVictory={true}
        onPlayAgain={() => {
          setMatchId(null);
          startSoloGame();
        }}
        onExit={onExit}
      />

      {/* REUSABLE CELEBRATION MODAL FOR DRAW/TIE */}
      <CelebrationModal
        visible={gameState === "tie_summary"}
        isTie={true}
        scoreText={`${totalScore} pts`}
        secondScoreText={`${isMultiplayer ? opponentTotalScore : pcTotalScore} pts`}
        onPlayAgain={() => {
          setMatchId(null);
          startSoloGame();
        }}
        onExit={onExit}
      />

      {/* REUSABLE CELEBRATION MODAL FOR DEFEAT */}
      <CelebrationModal
        visible={gameState === "defeat_summary"}
        title="YOU LOST!"
        subtitle={isMultiplayer ? `${opponentName} Won This Battle! 🏁` : "PC Won This Round! 🏁"}
        scoreText={`${totalScore} pts`}
        secondScoreText={`${isMultiplayer ? opponentTotalScore : pcTotalScore} pts`}
        isVictory={false}
        onPlayAgain={() => {
          setMatchId(null);
          startSoloGame();
        }}
        onExit={onExit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#1E293B" },
  menuContent: { padding: 20, gap: 16 },
  bannerCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  bannerTitle: { fontSize: 22, fontWeight: "900", color: "#1E3A8A", marginTop: 12 },
  bannerSub: { fontSize: 13, color: "#475569", textAlign: "center", marginTop: 6, lineHeight: 18 },
  modeCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
  },
  modeTitle: { fontSize: 16, fontWeight: "900" },
  modeSub: { fontSize: 12, color: "#64748B", marginTop: 2 },
  joinBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...SHADOWS.small,
  },
  joinLabel: { fontSize: 13, fontWeight: "800", color: "#1E293B" },
  codeInput: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 16,
    fontWeight: "800",
    color: "#1E293B",
  },
  joinBtn: {
    backgroundColor: "#16A34A",
    paddingHorizontal: 20,
    justifyContent: "center",
    borderRadius: 12,
  },
  joinBtnText: { color: "#FFFFFF", fontWeight: "900", fontSize: 14 },
  lobbyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  roomCodeBadge: {
    backgroundColor: "#EFF6FF",
    borderWidth: 2,
    borderColor: "#3B82F6",
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 40,
    alignItems: "center",
    marginBottom: 20,
  },
  roomCodeLabel: { fontSize: 12, fontWeight: "800", color: "#2563EB", letterSpacing: 1 },
  roomCodeText: { fontSize: 40, fontWeight: "900", color: "#1E3A8A", marginTop: 4, letterSpacing: 4 },
  waitingText: { fontSize: 18, fontWeight: "900", color: "#1E293B" },
  tipText: { fontSize: 13, color: "#64748B", textAlign: "center", marginTop: 10, lineHeight: 18 },
  cancelBtn: { marginTop: 30, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, backgroundColor: "#FEE2E2" },
  cancelBtnText: { color: "#991B1B", fontWeight: "800", fontSize: 14 },
  playingContent: { padding: 20 },
  statsBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...SHADOWS.small,
  },
  statLabel: { fontSize: 10, fontWeight: "800", color: "#64748B" },
  statValue: { fontSize: 18, fontWeight: "900", marginTop: 2 },
  baseWordCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...SHADOWS.medium,
  },
  baseWordHint: { fontSize: 12, fontWeight: "700", color: "#64748B", textTransform: "uppercase" },
  baseWordText: { fontSize: 28, fontWeight: "900", color: "#1E3A8A", letterSpacing: 2, marginVertical: 6, textAlign: "center" },
  baseWordSub: { fontSize: 12, color: "#64748B", fontWeight: "600" },
  skipWordBtn: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  skipWordBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#2563EB",
  },
  feedbackBanner: {
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 1,
  },
  feedbackText: { fontSize: 14, fontWeight: "900" },
  inputRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  wordInput: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 50,
    fontSize: 16,
    fontWeight: "800",
    color: "#1E293B",
  },
  submitBtn: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 24,
    justifyContent: "center",
    borderRadius: 14,
  },
  submitBtnText: { color: "#FFFFFF", fontWeight: "900", fontSize: 15 },
  listsContainer: {
    flexDirection: "row",
    gap: 12,
  },
  wordsSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  sectionTitle: { fontSize: 13, fontWeight: "900", color: "#1E293B", marginBottom: 10 },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  noWordsText: { fontSize: 12, color: "#94A3B8", fontStyle: "italic" },
  wordChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  wordChipText: { fontSize: 12, fontWeight: "800", color: "#1E3A8A" },
  wordChipPoints: { fontSize: 10, fontWeight: "900", color: "#2563EB" },
  summaryContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  summaryTitle: { fontSize: 26, fontWeight: "900", color: "#1E293B", marginTop: 16 },
  summarySub: { fontSize: 15, color: "#64748B", marginTop: 8, marginBottom: 30, textAlign: "center" },
  playAgainBtn: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 30,
    paddingVertical: 16,
    borderRadius: 16,
    width: "100%",
    alignItems: "center",
  },
  playAgainBtnText: { color: "#FFFFFF", fontWeight: "900", fontSize: 16 },
});
