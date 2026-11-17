import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { safeSpeak, safeStop } from "../../../utils/safeSpeech";
import { Audio } from "expo-av";
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
import { SPELLING_WORDS_POOL, SpellingWord, REMARKS, WRONG_REMARKS } from "./GameConstants";
import { syncAchievementsToCloud, getStudentNameFromUser } from "../../../utils/gameSync";

interface SpellingBeeGameProps {
  onExit: () => void;
}

export function SpellingBeeGame({ onExit }: SpellingBeeGameProps) {
  const { appUser } = useAuth();
  const [gameState, setGameState] = useState<"menu" | "playing" | "round_summary" | "final_summary" | "defeat_summary" | "tie_summary">("menu");

  // Class Level & Words configuration
  const [studentLevel, setStudentLevel] = useState<number>(1);
  const [classNameStr, setClassNameStr] = useState<string>("Primary");

  // Game Rounds (3 Rounds, 6 words per round = 18 unique words total)
  const [currentRound, setCurrentRound] = useState(1);
  const [roundsData, setRoundsData] = useState<SpellingWord[][]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);

  const [inputAnswer, setInputAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [roundScore, setRoundScore] = useState(0);
  const [remarkMsg, setRemarkMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);

  // PC Opponent state
  const [pcScore, setPcScore] = useState(0);

  // Multiplayer state
  const [roomCode, setRoomCode] = useState("");
  const [matchId, setMatchId] = useState<string | null>(null);
  const [opponentName, setOpponentName] = useState<string>("Waiting for opponent...");
  const [opponentScore, setOpponentScore] = useState(0);
  const [isHost, setIsHost] = useState(false);
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [isMultiplayer, setIsMultiplayer] = useState(false);

  const soundRef = useRef<Audio.Sound | null>(null);

  // Identify student's class level on mount
  useEffect(() => {
    const fetchClassLevel = async () => {
      if (!appUser || !appUser.classId) return;
      try {
        const classSnap = await getDoc(doc(db, "classes", appUser.classId));
        if (classSnap.exists()) {
          const data = classSnap.data() as any;
          setClassNameStr(data.name || "Class");
          const lNum = Number(data.level);
          if (!isNaN(lNum) && lNum > 0) {
            if (lNum <= 3) setStudentLevel(1); // Lower Primary
            else if (lNum <= 6) setStudentLevel(2); // Upper Primary
            else if (lNum <= 9) setStudentLevel(3); // JHS
            else setStudentLevel(4);
          }
        }
      } catch (err) {
        console.log("Error fetching class level for spelling bee:", err);
      }
    };
    fetchClassLevel();
  }, [appUser]);

  const playSound = async (type: "success" | "click" | "error") => {
    try {
      let source = require("../../../assets/message_sent.mp3");
      if (type === "success") source = require("../../../assets/notification.mp3");
      const { sound } = await Audio.Sound.createAsync(source);
      soundRef.current = sound;
      await sound.playAsync();
    } catch (error) {
      console.log("Error playing sound:", error);
    }
  };

  useEffect(() => {
    return () => {
      if (soundRef.current) soundRef.current.unloadAsync();
      safeStop();
    };
  }, []);

  // Speak word function: "spell the word [word]"
  const speakCurrentWord = (wordObj: SpellingWord) => {
    if (!wordObj) return;
    safeStop();
    const phrase = `Spell the word, ${wordObj.word}`;
    safeSpeak(phrase, {
      language: 'en',
      pitch: 1.0,
      rate: 0.85,
    });
  };

  // Get current word
  const currentRoundWords = roundsData[currentRound - 1] || [];
  const currentWordObj = currentRoundWords[currentWordIndex];

  // Speak word whenever question index or round changes in playing state
  useEffect(() => {
    if (gameState === "playing" && currentWordObj) {
      const timer = setTimeout(() => {
        speakCurrentWord(currentWordObj);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [gameState, currentRound, currentWordIndex]);

  // Start Solo Game vs PC
  const startSoloGame = () => {
    setIsMultiplayer(false);

    // Progression: Round 1 (Easy - Lvl 1), Round 2 (Moderate - Lvl 2), Round 3 (Difficult - Lvl 3/4)
    const l1 = SPELLING_WORDS_POOL.filter(w => w.level === 1);
    const l2 = SPELLING_WORDS_POOL.filter(w => w.level === 2);
    const l3 = SPELLING_WORDS_POOL.filter(w => w.level >= 3);

    const r1 = [...l1].sort(() => 0.5 - Math.random()).slice(0, 5);
    const r2 = [...l2].sort(() => 0.5 - Math.random()).slice(0, 5);
    const r3 = [...l3].sort(() => 0.5 - Math.random()).slice(0, 5);

    setRoundsData([r1, r2, r3]);
    setCurrentRound(1);
    setCurrentWordIndex(0);
    setScore(0);
    setRoundScore(0);
    setPcScore(0);
    setInputAnswer("");
    setRemarkMsg(null);
    setShowCorrectAnswer(false);
    setGameState("playing");
  };

  // Multiplayer: Create Room
  const createMatchRoom = async () => {
    if (!appUser) return;
    setLoadingMatch(true);
    try {
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      setRoomCode(code);
      setIsHost(true);
      setIsMultiplayer(true);

      const l1 = SPELLING_WORDS_POOL.filter(w => w.level === 1);
      const l2 = SPELLING_WORDS_POOL.filter(w => w.level === 2);
      const l3 = SPELLING_WORDS_POOL.filter(w => w.level >= 3);

      const r1 = [...l1].sort(() => 0.5 - Math.random()).slice(0, 5);
      const r2 = [...l2].sort(() => 0.5 - Math.random()).slice(0, 5);
      const r3 = [...l3].sort(() => 0.5 - Math.random()).slice(0, 5);
      const generatedRounds = [r1, r2, r3];

      const matchRef = doc(db, "spelling_battles", code);
      await setDoc(matchRef, {
        roomCode: code,
        hostId: appUser.uid,
        hostName: getStudentNameFromUser(appUser),
        opponentId: null,
        opponentName: null,
        status: "waiting",
        roundsData: generatedRounds,
        scores: { [appUser.uid]: 0 },
        createdAt: serverTimestamp(),
      });

      setMatchId(code);
      setLoadingMatch(false);
    } catch (err) {
      console.log("Error creating spelling match:", err);
      setLoadingMatch(false);
    }
  };

  // Multiplayer: Join Room
  const joinMatchRoom = async () => {
    if (!appUser || roomCode.length !== 4) return;
    setLoadingMatch(true);
    try {
      const matchRef = doc(db, "spelling_battles", roomCode);
      const snap = await getDoc(matchRef);
      if (!snap.exists()) {
        playSound("error");
        setLoadingMatch(false);
        return;
      }
      const data = snap.data();
      if (data.status !== "waiting") {
        playSound("error");
        setLoadingMatch(false);
        return;
      }

      await updateDoc(matchRef, {
        opponentId: appUser.uid,
        opponentName: getStudentNameFromUser(appUser),
        status: "playing",
        [`scores.${appUser.uid}`]: 0,
      });

      setIsHost(false);
      setIsMultiplayer(true);
      setMatchId(roomCode);
      setRoundsData(data.roundsData);
      setCurrentRound(1);
      setCurrentWordIndex(0);
      setScore(0);
      setRoundScore(0);
      setLoadingMatch(false);
      setGameState("playing");
    } catch (err) {
      console.log("Error joining spelling match:", err);
      setLoadingMatch(false);
    }
  };

  // Listen to multiplayer match state
  useEffect(() => {
    if (!matchId || !isMultiplayer) return;
    const unsub = onSnapshot(doc(db, "spelling_battles", matchId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();

      if (gameState === "menu" && data.status === "playing") {
        if (data.roundsData) setRoundsData(data.roundsData);
        setCurrentRound(1);
        setCurrentWordIndex(0);
        setScore(0);
        setGameState("playing");
      }

      if (data.opponentName && isHost) setOpponentName(data.opponentName);
      else if (!isHost && data.hostName) setOpponentName(data.hostName);

      const oppId = isHost ? data.opponentId : data.hostId;
      if (oppId && data.scores && data.scores[oppId] !== undefined) {
        setOpponentScore(data.scores[oppId]);
      }

      if (data.status === "finished" && gameState === "playing") {
        const myFinal = score;
        const oppFinal = oppId && data.scores ? (data.scores[oppId] || 0) : 0;
        if (myFinal > oppFinal) {
          setGameState("final_summary");
          safeSpeak("Congratulations! You won the Spelling Bee battle!", { language: 'en' });
        } else if (myFinal === oppFinal) {
          setGameState("tie_summary");
          safeSpeak("Incredible spelling battle! It is a draw!", { language: 'en' });
        } else {
          setGameState("defeat_summary");
          safeSpeak("Good effort! Your opponent won the Spelling Bee.", { language: 'en' });
        }
      }
    });
    return () => unsub();
  }, [matchId, gameState, isHost, isMultiplayer, score]);

  // Update multiplayer score in Firestore
  const updateCloudScore = async (newScore: number) => {
    if (!matchId || !appUser) return;
    try {
      const matchRef = doc(db, "spelling_battles", matchId);
      await updateDoc(matchRef, {
        [`scores.${appUser.uid}`]: newScore,
      });
    } catch (err) {
      console.log("Error updating cloud score:", err);
    }
  };

  // Submit Answer
  const handleSubmitAnswer = async () => {
    if (!currentWordObj || !inputAnswer.trim()) return;

    const cleanInput = inputAnswer.trim().toLowerCase();
    const targetWord = currentWordObj.word.toLowerCase();
    const isCorrect = cleanInput === targetWord;

    if (isCorrect) {
      playSound("success");
      const rMsg = REMARKS[Math.floor(Math.random() * REMARKS.length)];
      setRemarkMsg({ text: `Correct! ${rMsg}`, type: "success" });
      const newScore = score + 10;
      const newRoundScore = roundScore + 10;
      setScore(newScore);
      setRoundScore(newRoundScore);
      if (isMultiplayer) updateCloudScore(newScore);
    } else {
      playSound("error");
      const wMsg = WRONG_REMARKS[Math.floor(Math.random() * WRONG_REMARKS.length)];
      setRemarkMsg({ text: `Incorrect. ${wMsg}`, type: "error" });
      setShowCorrectAnswer(true);
    }

    // PC Opponent logic in solo mode (Round 1: 40% Easy, Round 2: 65% Moderate, Round 3: 85% Difficult)
    if (!isMultiplayer) {
      const pcWinChance = currentRound === 1 ? 0.4 : currentRound === 2 ? 0.65 : 0.85;
      if (Math.random() < pcWinChance) {
        setPcScore(prev => prev + 10);
      }
    }

    // Move to next word after delay
    setTimeout(async () => {
      setRemarkMsg(null);
      setInputAnswer("");
      setShowCorrectAnswer(false);

      if (currentWordIndex + 1 < currentRoundWords.length) {
        setCurrentWordIndex(prev => prev + 1);
      } else {
        // Round complete
        if (currentRound < 3) {
          setGameState("round_summary");
          safeSpeak(`Round ${currentRound} complete! Get ready for round ${currentRound + 1}`, { language: 'en' });
        } else {
          // Final Summary
          if (appUser) {
            syncAchievementsToCloud(appUser.uid, getStudentNameFromUser(appUser), appUser.classId, score);
          }
          if (isMultiplayer && matchId) {
            try {
              await updateDoc(doc(db, "spelling_battles", matchId), { status: "finished" });
            } catch (e) {
              console.log("Error finishing match:", e);
            }
          }

          const oppScoreFinal = isMultiplayer ? opponentScore : pcScore;
          if (score > oppScoreFinal) {
            setGameState("final_summary");
            safeSpeak("Fantastic job! You won the Spelling Bee championship!", { language: 'en' });
          } else if (score === oppScoreFinal) {
            setGameState("tie_summary");
            safeSpeak("Incredible spelling battle! It is a draw!", { language: 'en' });
          } else {
            setGameState("defeat_summary");
            safeSpeak("Good effort! Keep practicing your spelling.", { language: 'en' });
          }
        }
      }
    }, 2000);
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onExit} style={styles.backBtn}>
          <SVGIcon name="arrow-back" size={22} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Spelling Bee 🐝 ({classNameStr})</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* MENU STATE */}
      {gameState === "menu" && !matchId && (
        <ScrollView contentContainerStyle={styles.menuContent} showsVerticalScrollIndicator={false}>
          <View style={styles.bannerCard}>
            <SVGIcon name="mic" size={48} color="#D97706" />
            <Text style={styles.bannerTitle}>Spelling Bee Championship</Text>
            <Text style={styles.bannerSub}>
              3 Rounds • 6 Words per Round (18 Unique Words Tailored for {classNameStr}) • Listen & Spell!
            </Text>
          </View>

          <TouchableOpacity style={[styles.modeCard, { backgroundColor: "#FEF3C7", borderColor: "#F59E0B" }]} onPress={startSoloGame}>
            <SVGIcon name="person" size={28} color="#B45309" />
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={[styles.modeTitle, { color: "#92400E" }]}>Play vs. Computer (AI)</Text>
              <Text style={styles.modeSub}>Test your spelling against the AI across 3 rounds!</Text>
            </View>
            <SVGIcon name="chevron-forward" size={20} color="#B45309" />
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
          <ActivityIndicator size="large" color="#D97706" style={{ marginVertical: 20 }} />
          <Text style={styles.tipText}>Share this 4-digit code with your mate so they can join your live spelling battle!</Text>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setMatchId(null)}>
            <Text style={styles.cancelBtnText}>Cancel Match</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* PLAYING STATE */}
      {gameState === "playing" && currentWordObj && (
        <ScrollView contentContainerStyle={styles.playingContent} showsVerticalScrollIndicator={false}>
          <View style={styles.statsBar}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>ROUND {currentRound}/3</Text>
              <Text style={[styles.statValue, { color: "#D97706" }]}>Word {currentWordIndex + 1}/5</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>MY SCORE</Text>
              <Text style={[styles.statValue, { color: "#16A34A" }]}>{score}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{isMultiplayer ? "MATE SCORE" : "PC SCORE"}</Text>
              <Text style={[styles.statValue, { color: "#DC2626" }]}>{isMultiplayer ? opponentScore : pcScore}</Text>
            </View>
          </View>

          <View style={styles.wordCard}>
            <Text style={styles.instructionPrompt}>Listen carefully and type the spelling!</Text>

            <TouchableOpacity
              style={styles.speakerButton}
              onPress={() => speakCurrentWord(currentWordObj)}
              activeOpacity={0.8}
            >
              <SVGIcon name="volume-high" size={32} color="#fff" />
              <Text style={styles.speakerBtnText}>🔊 Listen to Word Again</Text>
            </TouchableOpacity>

            <View style={styles.hintBox}>
              <Text style={styles.hintLabel}>💡 Hint / Definition:</Text>
              <Text style={styles.hintText}>{currentWordObj.hint}</Text>
            </View>
          </View>

          {remarkMsg && (
            <View style={[styles.remarkBanner, { backgroundColor: remarkMsg.type === "success" ? "#DCFCE7" : "#FEE2E2" }]}>
              <Text style={[styles.remarkText, { color: remarkMsg.type === "success" ? "#166534" : "#991B1B" }]}>
                {remarkMsg.text}
              </Text>
              {showCorrectAnswer && (
                <Text style={styles.correctRevealText}>
                  Correct Spelling: {currentWordObj.word}
                </Text>
              )}
            </View>
          )}

          <View style={styles.inputSection}>
            <TextInput
              style={styles.spellingInput}
              placeholder="Type spelling here..."
              placeholderTextColor="#94A3B8"
              value={inputAnswer}
              onChangeText={setInputAnswer}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleSubmitAnswer}
            />
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitAnswer}>
              <Text style={styles.submitBtnText}>Submit Spelling</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* ROUND SUMMARY STATE */}
      {gameState === "round_summary" && (
        <View style={styles.summaryContainer}>
          <SVGIcon name="trophy" size={56} color="#D97706" />
          <Text style={styles.summaryTitle}>Round {currentRound} Complete! 🌟</Text>
          <Text style={styles.summarySub}>Round Score: {roundScore} Points</Text>
          <Text style={styles.summarySub}>Total Score: {score} Points</Text>

          <TouchableOpacity
            style={styles.nextRoundBtn}
            onPress={() => {
              const nextR = currentRound + 1;
              setCurrentRound(nextR);
              setCurrentWordIndex(0);
              setRoundScore(0);
              setGameState("playing");
            }}
          >
            <Text style={styles.nextRoundBtnText}>Start Round {currentRound + 1}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* FINAL / VICTORY / DEFEAT / TIE SUMMARY */}
      {(gameState === "final_summary" || gameState === "defeat_summary" || gameState === "tie_summary") && (
        <CelebrationModal
          visible={true}
          isTie={gameState === "tie_summary"}
          isVictory={gameState === "final_summary"}
          title={gameState === "tie_summary" ? "IT'S A DRAW!" : gameState === "final_summary" ? "Spelling Champion! 🏆" : "YOU LOST!"}
          subtitle={gameState === "defeat_summary" ? (isMultiplayer ? `${opponentName} Won This Battle! 🏁` : "PC Won This Round! 🏁") : `Final Score: ${score} Points`}
          scoreText={`${score} pts`}
          secondScoreText={`${isMultiplayer ? opponentScore : pcScore} pts`}
          onPlayAgain={startSoloGame}
          onExit={onExit}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFBEB" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#FEF3C7",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#FEF3C7",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "900", color: "#1E293B" },
  menuContent: { padding: 20, gap: 20 },
  bannerCard: {
    backgroundColor: "#FEF3C7",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F59E0B",
    ...SHADOWS.small,
  },
  bannerTitle: { fontSize: 22, fontWeight: "900", color: "#92400E", marginTop: 12, textAlign: "center" },
  bannerSub: { fontSize: 13, color: "#78350F", fontWeight: "600", marginTop: 6, textAlign: "center", lineHeight: 18 },
  modeCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderRadius: 16,
    borderWidth: 1.5,
    ...SHADOWS.small,
  },
  modeTitle: { fontSize: 16, fontWeight: "800" },
  modeSub: { fontSize: 12, color: "#64748B", marginTop: 2, fontWeight: "500" },
  joinBox: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...SHADOWS.small,
  },
  joinLabel: { fontSize: 13, fontWeight: "800", color: "#334155" },
  codeInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    backgroundColor: "#F8FAFC",
  },
  joinBtn: {
    backgroundColor: "#D97706",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  joinBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  lobbyContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 30 },
  roomCodeBadge: {
    backgroundColor: "#FEF3C7",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#F59E0B",
    alignItems: "center",
    marginBottom: 20,
  },
  roomCodeLabel: { fontSize: 11, fontWeight: "800", color: "#B45309", letterSpacing: 1 },
  roomCodeText: { fontSize: 36, fontWeight: "900", color: "#92400E", marginTop: 4 },
  waitingText: { fontSize: 18, fontWeight: "800", color: "#1E293B", textAlign: "center" },
  tipText: { fontSize: 13, color: "#64748B", textAlign: "center", marginTop: 10, lineHeight: 18 },
  cancelBtn: { marginTop: 30, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: "#FEE2E2", borderRadius: 12 },
  cancelBtnText: { color: "#991B1B", fontWeight: "800", fontSize: 14 },
  playingContent: { padding: 20, gap: 20 },
  statsBar: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  statBox: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FEF3C7",
    ...SHADOWS.small,
  },
  statLabel: { fontSize: 10, fontWeight: "800", color: "#64748B" },
  statValue: { fontSize: 16, fontWeight: "900", marginTop: 4 },
  wordCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FEF3C7",
    ...SHADOWS.small,
  },
  instructionPrompt: { fontSize: 15, fontWeight: "800", color: "#1E293B", marginBottom: 16, textAlign: "center" },
  speakerButton: {
    backgroundColor: "#D97706",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 12,
    width: "100%",
    ...SHADOWS.small,
  },
  speakerBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  hintBox: {
    marginTop: 20,
    backgroundColor: "#FEF3C7",
    padding: 14,
    borderRadius: 12,
    width: "100%",
  },
  hintLabel: { fontSize: 12, fontWeight: "800", color: "#B45309" },
  hintText: { fontSize: 14, fontWeight: "700", color: "#92400E", marginTop: 4 },
  remarkBanner: {
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  remarkText: { fontSize: 14, fontWeight: "800" },
  correctRevealText: { fontSize: 13, fontWeight: "800", color: "#991B1B", marginTop: 4 },
  inputSection: { gap: 12 },
  spellingInput: {
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#D97706",
    borderRadius: 14,
    height: 56,
    paddingHorizontal: 20,
    fontSize: 20,
    fontWeight: "800",
    color: "#1E293B",
    textAlign: "center",
    letterSpacing: 2,
  },
  submitBtn: {
    backgroundColor: "#16A34A",
    borderRadius: 14,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.small,
  },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  summaryContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 30 },
  summaryTitle: { fontSize: 24, fontWeight: "900", color: "#1E293B", marginTop: 20, textAlign: "center" },
  summarySub: { fontSize: 15, fontWeight: "600", color: "#64748B", marginTop: 8, textAlign: "center" },
  nextRoundBtn: {
    marginTop: 30,
    backgroundColor: "#D97706",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    ...SHADOWS.small,
  },
  nextRoundBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
