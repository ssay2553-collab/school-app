import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
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
import { REMARKS, WRONG_REMARKS } from "./GameConstants";
import { CelebrationModal } from "./CelebrationModal";
import { SHADOWS } from "../../../constants/theme";
import { syncAchievementsToCloud, getStudentNameFromUser } from "../../../utils/gameSync";

// Expanded Master Idioms Pool (60+ idioms to guarantee zero repetition across questions per encounter)
const MASTER_IDIOMS = [
  { phrase: "A blessing in disguise", meaning: "A good thing that seemed bad at first.", example: "Missing the bus was a blessing in disguise." },
  { phrase: "A fish out of water", meaning: "Someone who feels uncomfortable in unfamiliar surroundings.", example: "He felt like a fish out of water at the new school." },
  { phrase: "A little bird told me", meaning: "Used to say you got information from a secret source.", example: "A little bird told me it's your birthday!" },
  { phrase: "Ants in your pants", meaning: "Being very restless, excited, or fidgety.", example: "Why do you have ants in your pants today?" },
  { phrase: "As busy as a bee", meaning: "Working very hard and being extremely busy.", example: "Mom has been as busy as a bee cleaning." },
  { phrase: "Barking up the wrong tree", meaning: "Looking in the wrong place or accusing the wrong person.", example: "If you think I took your pencil, you're barking up the wrong tree." },
  { phrase: "Bite off more than you can chew", meaning: "To take on more responsibilities than you can handle.", example: "Signing up for three sports is biting off more than you can chew." },
  { phrase: "Break a leg", meaning: "Good luck! (Often used before a performance or test).", example: "Break a leg in the school play tonight!" },
  { phrase: "Can of worms", meaning: "A complicated situation that causes trouble when opened.", example: "Asking about the broken vase opened up a can of worms." },
  { phrase: "Chicken out", meaning: "To decide not to do something because of fear.", example: "He wanted to ride the roller coaster, but chickened out." },
  { phrase: "Cost an arm and a leg", meaning: "To be extremely expensive.", example: "That spaceship Lego set costs an arm and a leg." },
  { phrase: "Cry over spilled milk", meaning: "To worry about something that already happened and cannot be changed.", example: "No use crying over spilled milk—let's practice harder." },
  { phrase: "Curiosity killed the cat", meaning: "Being too inquisitive can lead to getting into trouble.", example: "Don't peek inside the mystery box; curiosity killed the cat!" },
  { phrase: "Couch potato", meaning: "Someone who spends too much time sitting and watching TV.", example: "Don't be a couch potato all weekend." },
  { phrase: "Cut corners", meaning: "To do something carelessly to save time.", example: "Don't cut corners on your art project." },
  { phrase: "Every dog has its day", meaning: "Everyone will have good luck or success eventually.", example: "Don't give up; every dog has its day!" },
  { phrase: "Elephant in the room", meaning: "An obvious problem that everyone is avoiding discussing.", example: "The messy classroom was the elephant in the room." },
  { phrase: "Hit the books", meaning: "To study hard.", example: "Exams are coming up next week; time to hit the books!" },
  { phrase: "Hold your horses", meaning: "Wait a minute; slow down.", example: "Hold your horses! Let me explain the rules." },
  { phrase: "In a nutshell", meaning: "In a few words; concisely.", example: "In a nutshell, we need to study hard." },
  { phrase: "Let the cat out of the bag", meaning: "To accidentally reveal a secret.", example: "She let the cat out of the bag about the party." },
  { phrase: "Once in a blue moon", meaning: "Very rarely.", example: "We eat ice cream only once in a blue moon." },
  { phrase: "Pass with flying colors", meaning: "To succeed brilliantly.", example: "He passed the math test with flying colors." },
  { phrase: "Spill the beans", meaning: "To reveal a secret.", example: "Who spilled the beans about the surprise?" },
  { phrase: "Under the weather", meaning: "Feeling slightly sick or unwell.", example: "I stayed home today because I felt under the weather." },
  { phrase: "When pigs fly", meaning: "Something that is completely impossible.", example: "You think homework will be canceled? When pigs fly!" },
  { phrase: "Think outside the box", meaning: "To think creatively and unconventionally.", example: "To solve the puzzle, we need to think outside the box." },
  { phrase: "Piece of cake", meaning: "Something very easy to do.", example: "The spelling quiz was a piece of cake." },
  { phrase: "Apple of my eye", meaning: "Someone very precious and cherished.", example: "Little baby sister is grandfather's apple of his eye." },
  { phrase: "Burn the midnight oil", meaning: "To study late into the night.", example: "She burned the midnight oil for the history exam." },
  { phrase: "Cold feet", meaning: "To become nervous before doing something important.", example: "He got cold feet before giving his speech." },
  { phrase: "Head over heels", meaning: "Madly in love or extremely excited.", example: "She fell head over heels for gymnastics." },
  { phrase: "Keep your chin up", meaning: "Remain cheerful in difficult times.", example: "Keep your chin up; you'll do better next time." },
  { phrase: "Pull someone's leg", meaning: "To tease or joke with someone.", example: "Are you serious or just pulling my leg?" },
  { phrase: "See eye to eye", meaning: "To agree fully with someone.", example: "We don't always see eye to eye on games." },
  { phrase: "Step up your game", meaning: "To improve your performance or effort.", example: "We need to step up our game to win." },
  { phrase: "True blue", meaning: "Extremely loyal and trustworthy.", example: "My best friend is true blue." },
  { phrase: "White lie", meaning: "A harmless lie told to avoid hurting feelings.", example: "She told a white lie about the sweater." },
  { phrase: "Wild goose chase", meaning: "A hopeless pursuit of something.", example: "Looking for my lost eraser everywhere was a wild goose chase." },
  { phrase: "Born with a silver spoon", meaning: "Born into a very wealthy family.", example: "He was born with a silver spoon in his mouth." },
  { phrase: "Beat around the bush", meaning: "To avoid getting to the point.", example: "Stop beating around the bush and tell me what happened." },
  { phrase: "Blessing in disguise", meaning: "A good thing that seemed bad initially.", example: "Missing the train was a blessing in disguise." },
  { phrase: "Burn bridges", meaning: "To ruin relationships permanently.", example: "Never burn bridges with your former classmates." },
  { phrase: "Call it a day", meaning: "To stop working on something.", example: "It's getting late, let's call it a day." },
  { phrase: "Cost a fortune", meaning: "To be extremely expensive.", example: "That new computer costs a fortune." },
  { phrase: "Cutting edge", meaning: "The most modern and advanced.", example: "Our school uses cutting edge technology." },
  { phrase: "Down to earth", meaning: "Realistic and friendly.", example: "Even though she is famous, she is very down to earth." },
  { phrase: "Dropping like flies", meaning: "Falling ill or quitting rapidly in large numbers.", example: "The flu went around and students were dropping like flies." },
  { phrase: "Face the music", meaning: "To accept the unpleasant consequences of your actions.", example: "He broke the window and had to face the music." },
  { phrase: "Get out of hand", meaning: "To become out of control.", example: "The classroom noise got completely out of hand." },
  { phrase: "Bite the bullet", meaning: "To endure a painful situation that is unavoidable.", example: "We have to bite the bullet and finish our chores." },
  { phrase: "Burn bridges", meaning: "To ruin a relationship or connection permanently.", example: "Never burn bridges with your former classmates." },
  { phrase: "Call it a day", meaning: "To stop working on something for the day.", example: "Let's study for one more hour and call it a day." },
  { phrase: "Give someone the benefit of the doubt", meaning: "To believe someone's statement without proof.", example: "I gave him the benefit of the doubt." },
  { phrase: "Hit the nail on the head", meaning: "To describe exactly what is causing a problem.", example: "Your answer hit the nail on the head." },
  { phrase: "In the nick of time", meaning: "Just before the deadline or disaster; barely in time.", example: "We arrived at the exam hall in the nick of time." },
  { phrase: "Jump on the bandwagon", meaning: "To join a popular activity or trend.", example: "Everyone started wearing wristbands, so I jumped on the bandwagon." },
  { phrase: "Keep your fingers crossed", meaning: "To wish for good luck.", example: "Keep your fingers crossed that we win!" },
  { phrase: "Let sleeping dogs lie", meaning: "To leave an existing problem alone if it's not causing trouble.", example: "Don't bring up the old argument; let sleeping dogs lie." },
  { phrase: "Make a mountain out of a molehill", meaning: "To make a small problem seem much bigger than it is.", example: "Don't make a mountain out of a molehill over one quiz question." },
  { phrase: "On cloud nine", meaning: "Extremely happy and joyful.", example: "She was on cloud nine after winning the award." },
  { phrase: "Play devil's advocate", meaning: "To argue against an idea just for debate.", example: "He played devil's advocate during our discussion." },
  { phrase: "Rock the boat", meaning: "To cause trouble or upset a stable situation.", example: "Everything is running smoothly, so let's not rock the boat." },
  { phrase: "Through thick and thin", meaning: "Through good times and bad times.", example: "True friends stick together through thick and thin." },
  { phrase: "Weather the storm", meaning: "To survive a difficult period successfully.", example: "Working hard helped us weather the storm of exams." }
];

interface IdiomGameProps {
  onExit: () => void;
}

export function IdiomGame({ onExit }: IdiomGameProps) {
  const { appUser } = useAuth();
  const [gameState, setGameState] = useState<"menu" | "playing" | "round_summary" | "final_summary" | "defeat_summary" | "tie_summary">("menu");

  // Game structure: 3 Rounds, 5 questions per round
  const [currentRound, setCurrentRound] = useState(1);
  const [roundQuestions, setRoundQuestions] = useState<any[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);

  const [timeLeft, setTimeLeft] = useState(90);
  const [score, setScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [remark, setRemark] = useState<string | null>(null);

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

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Generate 15 unique questions divided into 3 rounds of 5 questions each
  const prepareGameQuestions = () => {
    const easyPool = [...MASTER_IDIOMS.slice(0, 20)].sort(() => 0.5 - Math.random()).slice(0, 5);
    const modPool = [...MASTER_IDIOMS.slice(20, 40)].sort(() => 0.5 - Math.random()).slice(0, 5);
    const diffPool = [...MASTER_IDIOMS.slice(40)].sort(() => 0.5 - Math.random()).slice(0, 5);

    const mapQuestions = (pool: typeof MASTER_IDIOMS) => {
      return pool.map((item) => {
        const wrong = MASTER_IDIOMS
          .filter(i => i.phrase !== item.phrase)
          .sort(() => 0.5 - Math.random())
          .slice(0, 3)
          .map(i => i.meaning);
        const options = [...wrong, item.meaning].sort(() => 0.5 - Math.random());
        return {
          phrase: item.phrase,
          correctMeaning: item.meaning,
          example: item.example,
          options,
        };
      });
    };

    return [
      mapQuestions(easyPool), // Round 1: Easy
      mapQuestions(modPool),  // Round 2: Moderate
      mapQuestions(diffPool), // Round 3: Difficult
    ];
  };

  const [allRounds, setAllRounds] = useState<any[][]>([]);

  const startSoloGame = () => {
    setIsMultiplayer(false);
    const rounds = prepareGameQuestions();
    setAllRounds(rounds);
    setRoundQuestions(rounds[0]);
    setCurrentRound(1);
    setCurrentQIndex(0);
    setTimeLeft(90);
    setScore(0);
    setPcScore(0);
    setSelectedOption(null);
    setRemark(null);
    setGameState("playing");
  };

  const handleSpeak = (text: string) => {
    Speech.stop();
    Speech.speak(text, { language: 'en', rate: 0.9 });
  };

  const currentQ = roundQuestions[currentQIndex];

  // Question Timer Effect (90s countdown per question)
  useEffect(() => {
    if (gameState === "playing" && currentQ && selectedOption === null) {
      setTimeLeft(90);
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            handleTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState, currentQIndex, currentRound, currentQ, selectedOption]);

  // Timeout Handler: If user fails to answer in 90s, award +10 points to PC in solo mode!
  const handleTimeout = () => {
    if (selectedOption !== null) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setSelectedOption("TIMEOUT_EXPIRED");

    if (!isMultiplayer) {
      setRemark("Time's Up! ⌛ PC awarded +10 points!");
      setPcScore(p => p + 10);
    } else {
      setRemark("Time's Up! ⌛ Question expired.");
    }

    setTimeout(() => {
      advanceToNextQuestion(score);
    }, 1500);
  };

  // Helper to advance to next question or round summary
  const advanceToNextQuestion = (userFinalScore: number) => {
    setSelectedOption(null);
    setRemark(null);
    if (currentQIndex + 1 < roundQuestions.length) {
      setCurrentQIndex(c => c + 1);
    } else {
      // Round complete (5 questions finished)
      if (currentRound < 3) {
        setGameState("round_summary");
      } else {
        if (appUser?.uid) {
          syncAchievementsToCloud(appUser.uid, getStudentNameFromUser(appUser), appUser.classId, userFinalScore);
        }

        if (isMultiplayer && matchId && appUser?.uid) {
          updateDoc(doc(db, "idiom_battles", matchId), {
            status: "finished",
            [`scores.${appUser.uid}`]: userFinalScore,
          }).catch(err => console.error(err));
        }

        const oppFinal = isMultiplayer ? opponentScore : pcScore;
        if (userFinalScore > oppFinal) {
          setGameState("final_summary");
          Speech.speak("Congratulations! You won the Idiom Quest championship!", { language: 'en' });
        } else if (userFinalScore === oppFinal) {
          setGameState("tie_summary");
          Speech.speak("Incredible battle! It is a draw!", { language: 'en' });
        } else {
          setGameState("defeat_summary");
          Speech.speak("Good effort! You played brilliantly.", { language: 'en' });
        }
      }
    }
  };

  // Option selection handler
  const handleSelectOption = (option: string) => {
    if (selectedOption !== null) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setSelectedOption(option);

    const correct = option === currentQ.correctMeaning;
    const userFinalScore = correct ? score + 10 : score;
    if (correct) {
      setScore(userFinalScore);
      const randRemark = REMARKS[Math.floor(Math.random() * REMARKS.length)];
      setRemark(randRemark);
    } else {
      const randWrong = WRONG_REMARKS[Math.floor(Math.random() * WRONG_REMARKS.length)];
      setRemark(randWrong);
    }

    // Simulate PC score in solo mode (Round 1: 40% Easy, Round 2: 65% Moderate, Round 3: 85% Difficult)
    if (!isMultiplayer) {
      const pcWinChance = currentRound === 1 ? 0.4 : currentRound === 2 ? 0.65 : 0.85;
      if (Math.random() < pcWinChance) {
        setPcScore(p => p + 10);
      }
    }

    if (isMultiplayer && matchId && appUser?.uid) {
      updateDoc(doc(db, "idiom_battles", matchId), {
        [`scores.${appUser.uid}`]: userFinalScore,
      }).catch(err => console.error(err));
    }

    setTimeout(() => {
      advanceToNextQuestion(userFinalScore);
    }, 1500);
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
      const rounds = prepareGameQuestions();

      const matchRef = doc(db, "idiom_battles", code);
      await setDoc(matchRef, {
        hostId: appUser.uid,
        hostName: appUser.displayName || appUser.email || "Student",
        opponentId: null,
        opponentName: null,
        roundsData: rounds,
        status: "waiting",
        scores: { [appUser.uid]: 0 },
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
      const matchRef = doc(db, "idiom_battles", roomCode.trim());
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

      const rounds = data.roundsData || prepareGameQuestions();
      setAllRounds(rounds);
      setRoundQuestions(rounds[0]);
      setIsHost(false);
      setMatchId(roomCode.trim());

      await updateDoc(matchRef, {
        opponentId: appUser.uid,
        opponentName: appUser.displayName || appUser.email || "Challenger",
        status: "playing",
        [`scores.${appUser.uid}`]: 0,
      });

      setCurrentRound(1);
      setCurrentQIndex(0);
      setTimeLeft(90);
      setScore(0);
      setGameState("playing");
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Could not join room.");
    } finally {
      setLoadingMatch(false);
    }
  };

  // Listen to match updates
  useEffect(() => {
    if (!matchId) return;

    const unsub = onSnapshot(doc(db, "idiom_battles", matchId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();

      if (gameState === "menu" && data.status === "playing") {
        if (data.roundsData) {
          setAllRounds(data.roundsData);
          setRoundQuestions(data.roundsData[0]);
        }
        setCurrentRound(1);
        setCurrentQIndex(0);
        setTimeLeft(90);
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
          Speech.speak("Congratulations! You won the Idiom Quest battle!", { language: 'en' });
        } else if (myFinal === oppFinal) {
          setGameState("tie_summary");
          Speech.speak("Incredible battle! It is a draw!", { language: 'en' });
        } else {
          setGameState("defeat_summary");
          Speech.speak("Good effort! Your opponent won.", { language: 'en' });
        }
      }
    });

    return () => unsub();
  }, [matchId, gameState, isHost, score]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onExit} style={styles.backBtn}>
          <SVGIcon name="arrow-back" size={22} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Idiom Quest 🎭 (3 Rounds)</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* MENU STATE */}
      {gameState === "menu" && !matchId && (
        <ScrollView contentContainerStyle={styles.menuContent} showsVerticalScrollIndicator={false}>
          <View style={styles.bannerCard}>
            <SVGIcon name="sparkles" size={48} color="#A855F7" />
            <Text style={styles.bannerTitle}>Idiom Quest Championship</Text>
            <Text style={styles.bannerSub}>
              3 Rounds • 5 Questions per Round • 90 Seconds per Question • Head-to-Head Multiplayer!
            </Text>
          </View>

          <TouchableOpacity style={[styles.modeCard, { backgroundColor: "#F3E8FF", borderColor: "#C084FC" }]} onPress={startSoloGame}>
            <SVGIcon name="person" size={28} color="#7E22CE" />
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={[styles.modeTitle, { color: "#6B21A8" }]}>Play vs. Computer (AI)</Text>
              <Text style={styles.modeSub}>Complete 3 rounds of idiom challenges against the PC!</Text>
            </View>
            <SVGIcon name="chevron-forward" size={20} color="#7E22CE" />
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
          <ActivityIndicator size="large" color="#A855F7" style={{ marginVertical: 20 }} />
          <Text style={styles.tipText}>Share this 4-digit code with your mate so they can join your live battle!</Text>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setMatchId(null)}>
            <Text style={styles.cancelBtnText}>Cancel Match</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* PLAYING STATE */}
      {gameState === "playing" && currentQ && (
        <ScrollView contentContainerStyle={styles.playingContent} showsVerticalScrollIndicator={false}>
          <View style={styles.statsBar}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>ROUND {currentRound}/3</Text>
              <Text style={[styles.statValue, { color: "#7C3AED" }]}>Q {currentQIndex + 1}/5</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>TIME LEFT</Text>
              <Text style={[styles.statValue, timeLeft <= 15 && { color: "#EF4444" }]}>{timeLeft}s</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>MY SCORE</Text>
              <Text style={[styles.statValue, { color: "#A855F7" }]}>{score}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{isMultiplayer ? "MATE SCORE" : "PC SCORE"}</Text>
              <Text style={[styles.statValue, { color: "#D97706" }]}>{isMultiplayer ? opponentScore : pcScore}</Text>
            </View>
          </View>

          <View style={styles.quizQuestionCard}>
            <Text style={styles.promptLabel}>What is the meaning of this idiom?</Text>
            <Text style={styles.quizIdiomText}>"{currentQ.phrase}"</Text>
            <TouchableOpacity style={styles.quizSpeakerBtn} onPress={() => handleSpeak(currentQ.phrase)}>
              <SVGIcon name="volume-high" size={16} color="#A855F7" />
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#A855F7' }}>Listen</Text>
            </TouchableOpacity>
          </View>

          {remark && (
            <View style={[styles.remarkBanner, { backgroundColor: selectedOption === currentQ.correctMeaning ? '#DCFCE7' : '#FEE2E2' }]}>
              <Text style={[styles.remarkText, { color: selectedOption === currentQ.correctMeaning ? '#166534' : '#991B1B' }]}>
                {remark}
              </Text>
            </View>
          )}

          <View style={{ gap: 10 }}>
            {currentQ.options.map((opt: string, oIdx: number) => {
              let btnStyle: any = styles.quizOptionBtn;
              let textStyle: any = styles.quizOptionText;
              if (selectedOption !== null) {
                if (opt === currentQ.correctMeaning) {
                  btnStyle = [styles.quizOptionBtn, { backgroundColor: '#DCFCE7', borderColor: '#22C55E' }];
                  textStyle = [styles.quizOptionText, { color: '#166534', fontWeight: '800' }];
                } else if (opt === selectedOption) {
                  btnStyle = [styles.quizOptionBtn, { backgroundColor: '#FEE2E2', borderColor: '#EF4444' }];
                  textStyle = [styles.quizOptionText, { color: '#991B1B' }];
                }
              }

              return (
                <TouchableOpacity
                  key={oIdx}
                  style={btnStyle}
                  onPress={() => handleSelectOption(opt)}
                  activeOpacity={0.8}
                >
                  <Text style={textStyle}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* ROUND SUMMARY STATE */}
      {gameState === "round_summary" && (
        <View style={styles.summaryContainer}>
          <SVGIcon name="flag" size={56} color="#A855F7" />
          <Text style={styles.summaryTitle}>Round {currentRound} Complete! 🎯</Text>
          <Text style={styles.summarySub}>Get ready for Round {currentRound + 1}!</Text>

          <TouchableOpacity
            style={styles.playAgainBtn}
            onPress={() => {
              const nextRound = currentRound + 1;
              setCurrentRound(nextRound);
              setRoundQuestions(allRounds[nextRound - 1]);
              setCurrentQIndex(0);
              setTimeLeft(90);
              setSelectedOption(null);
              setRemark(null);
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
        subtitle="YOU WON THE IDIOM QUEST CHAMPIONSHIP! 🏆"
        scoreText={`Final Score: ${score} Points 🌟`}
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
        scoreText={`${score} pts`}
        secondScoreText={`${isMultiplayer ? opponentScore : pcScore} pts`}
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
        scoreText={`${score} pts`}
        secondScoreText={`${isMultiplayer ? opponentScore : pcScore} pts`}
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
    backgroundColor: "#F3E8FF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E9D5FF",
  },
  bannerTitle: { fontSize: 22, fontWeight: "900", color: "#581C87", marginTop: 12 },
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
    backgroundColor: "#F3E8FF",
    borderWidth: 2,
    borderColor: "#C084FC",
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 40,
    alignItems: "center",
    marginBottom: 20,
  },
  roomCodeLabel: { fontSize: 12, fontWeight: "800", color: "#7E22CE", letterSpacing: 1 },
  roomCodeText: { fontSize: 40, fontWeight: "900", color: "#581C87", marginTop: 4, letterSpacing: 4 },
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
    padding: 10,
    alignItems: "center",
    marginHorizontal: 2,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...SHADOWS.small,
  },
  statLabel: { fontSize: 9, fontWeight: "800", color: "#64748B" },
  statValue: { fontSize: 16, fontWeight: "900", marginTop: 2 },
  quizQuestionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E9D5FF",
    ...SHADOWS.medium,
  },
  promptLabel: { fontSize: 12, fontWeight: "700", color: "#64748B", textTransform: "uppercase", marginBottom: 8 },
  quizIdiomText: { fontSize: 22, fontWeight: "900", color: "#0F172A", textAlign: "center", marginBottom: 14 },
  quizSpeakerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  remarkBanner: {
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  remarkText: { fontSize: 14, fontWeight: "800" },
  quizOptionBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.small,
  },
  quizOptionText: { fontSize: 14, fontWeight: '700', color: '#1E293B', textAlign: 'center' },
  summaryContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  summaryTitle: { fontSize: 26, fontWeight: "900", color: "#1E293B", marginTop: 16 },
  summarySub: { fontSize: 15, color: "#64748B", marginTop: 8, marginBottom: 30 },
  playAgainBtn: {
    backgroundColor: "#A855F7",
    paddingHorizontal: 30,
    paddingVertical: 16,
    borderRadius: 16,
    width: "100%",
    alignItems: "center",
  },
  playAgainBtnText: { color: "#FFFFFF", fontWeight: "900", fontSize: 16 },
});
