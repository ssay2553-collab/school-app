import React, { useState, useEffect, useCallback } from 'react';
import { SafeAreaView, StatusBar, Modal, ScrollView, Text, TouchableOpacity, View, StyleSheet, Alert, Image, Platform } from 'react-native';
import { useRouter } from 'expo-router';

import { useSchoolConfig } from '../../constants/Config';
import { SHADOWS } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { TierProtectedRoute } from '../../components/TierProtectedRoute';
import SVGIcon from '../../components/SVGIcon';

import { RoboticsHeader } from '../../components/robotics/RoboticsHeader';
import { RoboticsDashboard } from '../../components/robotics/RoboticsDashboard';
import { RoboticsLessons } from '../../components/robotics/RoboticsLessons';
import { RobotSimulator } from '../../components/robotics/RobotSimulator';
import { CodingBlocks } from '../../components/robotics/CodingBlocks';
import { RoboticsChallenges } from '../../components/robotics/RoboticsChallenges';
import { RoboticsAchievements } from '../../components/robotics/RoboticsAchievements';
import { TeacherRoboticsDashboard } from '../../components/robotics/TeacherRoboticsDashboard';
import { RoboticsTutorialModal } from '../../components/robotics/RoboticsTutorialModal';
import { LevelClearedModal } from '../../components/robotics/LevelClearedModal';
import { CelebrationModal } from '../../components/student-dashboard/games/CelebrationModal';
import { TextCodeSandbox } from '../../components/robotics/TextCodeSandbox';

import { LESSONS, Lesson } from '../../data/robotics/lessons';
import { ChallengeLevel, CHALLENGES } from '../../data/robotics/challenges';
import { getLocalRoboticsProgress, saveLocalRoboticsProgress } from '../../services/robotics/roboticsStorage';
import { executeRoboticsProgram, hasReachedTarget } from '../../services/robotics/roboticsEngine';
import { syncRoboticsProgressToFirebase } from '../../services/robotics/roboticsSync';
import { isTeacherUser, isAdminUser } from '../../utils/authUnify';

export default function RoboticsIndexScreen() {
  const router = useRouter();
  const config = useSchoolConfig();
  const primaryColor = config.brandPrimary || '#6366F1';
  const { appUser } = useAuth();
  const isTeacherOrAdmin = isTeacherUser(appUser) || isAdminUser(appUser);

  const [activeTab, setActiveTab] = useState<string>('learn');
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [completedChallenges, setCompletedChallenges] = useState<number[]>([]);
  const [totalPoints, setTotalPoints] = useState<number>(0);
  const [earnedBadges, setEarnedBadges] = useState<string[]>([]);
  const [assessmentScores, setAssessmentScores] = useState<Record<string, number>>({});
  const [syncStatus, setSyncStatus] = useState<'synced' | 'offline_saved' | 'syncing'>('synced');

  const [activeChallengeIndex, setActiveChallengeIndex] = useState<number>(0);
  const initialChallenge = CHALLENGES[0];

  // Simulator state
  const [robotX, setRobotX] = useState<number>(1);
  const [robotY, setRobotY] = useState<number>(1);
  const [robotDir, setRobotDir] = useState<'N' | 'E' | 'S' | 'W'>('E');
  const [simRunning, setSimRunning] = useState<boolean>(false);
  const [simLog, setSimLog] = useState<string>('Ready. Place commands and press Run!');
  const [targetX, setTargetX] = useState<number>(initialChallenge.targetX);
  const [targetY, setTargetY] = useState<number>(initialChallenge.targetY);
  const [checkpointX, setCheckpointX] = useState<number | undefined>(initialChallenge.checkpointX);
  const [checkpointY, setCheckpointY] = useState<number | undefined>(initialChallenge.checkpointY);
  const [checkpointCollected, setCheckpointCollected] = useState<boolean>(false);
  const [obstacles, setObstacles] = useState<Array<{ x: number; y: number }>>([]);
  const [movingHazards, setMovingHazards] = useState<Array<{ x: number; y: number }>>([]);
  const [gridSize, setGridSize] = useState<number>(5);
  const [isCooperative, setIsCooperative] = useState<boolean>(initialChallenge.isCooperative || false);
  const [switchX, setSwitchX] = useState<number | undefined>(initialChallenge.switchX);
  const [switchY, setSwitchY] = useState<number | undefined>(initialChallenge.switchY);
  const [switchPressed, setSwitchPressed] = useState<boolean>(false);
  const [gateX, setGateX] = useState<number | undefined>(initialChallenge.gateX);
  const [gateY, setGateY] = useState<number | undefined>(initialChallenge.gateY);
  const [robotBX, setRobotBX] = useState<number | undefined>(initialChallenge.robotBStartX || 1);
  const [robotBY, setRobotBY] = useState<number | undefined>(initialChallenge.robotBStartY || 1);
  const [robotBDirection, setRobotBDirection] = useState<'N' | 'E' | 'S' | 'W'>('E');

  // Coding Blocks state
  const [blockQueue, setBlockQueue] = useState<string[]>(initialChallenge.requiredCommands || ['move_forward', 'move_forward', 'stop']);
  const [codingMode, setCodingMode] = useState<'visual' | 'text'>('visual');
  const [textScript, setTextScript] = useState<string>('move_forward();\nmove_forward();\nstop();');

  const parseTextToCommands = (script: string): string[] => {
    const lines = script.split('\n');
    const cmds: string[] = [];
    for (const line of lines) {
      const clean = line.trim().toLowerCase();
      if (clean.includes('move_forward') || clean.includes('forward')) cmds.push('move_forward');
      else if (clean.includes('turn_left') || clean.includes('left')) cmds.push('turn_left');
      else if (clean.includes('turn_right') || clean.includes('right')) cmds.push('turn_right');
      else if (clean.includes('stop')) cmds.push('stop');
      else if (clean.includes('wait')) cmds.push('wait');
    }
    return cmds.length > 0 ? cmds : ['move_forward', 'stop'];
  };

  const handleCompileTextScript = () => {
    const parsed = parseTextToCommands(textScript);
    setBlockQueue(parsed);
    Alert.alert('Compiled Successfully 🚀', `Parsed ${parsed.length} commands into execution queue. Switching to simulator!`, [
      { text: 'Run Now', onPress: () => setActiveTab('simulator') }
    ]);
  };

  const isPathReachable = (
    start: { x: number; y: number },
    target: { x: number; y: number },
    obstaclesList: Array<{ x: number; y: number }>,
    gridSize: number = 5
  ): boolean => {
    const queue: Array<{ x: number; y: number }> = [start];
    const visited = new Set<string>();
    visited.add(`${start.x},${start.y}`);

    const isObs = (x: number, y: number) =>
      obstaclesList.some(o => o.x === x && o.y === y);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr.x === target.x && curr.y === target.y) return true;

      const neighbors = [
        { x: curr.x, y: curr.y - 1 },
        { x: curr.x + 1, y: curr.y },
        { x: curr.x, y: curr.y + 1 },
        { x: curr.x - 1, y: curr.y },
      ];

      for (const n of neighbors) {
        if (
          n.x >= 1 &&
          n.x <= gridSize &&
          n.y >= 1 &&
          n.y <= gridSize &&
          !isObs(n.x, n.y) &&
          !visited.has(`${n.x},${n.y}`)
        ) {
          visited.add(`${n.x},${n.y}`);
          queue.push(n);
        }
      }
    }
    return false;
  };

  const handleShuffleReset = () => {
    setRobotX(1);
    setRobotY(1);
    setRobotDir('E');
    const gSize = activeChallengeIndex >= 14 ? 6 : 5;
    setGridSize(gSize);

    let validPath = false;
    let finalRx = gSize === 6 ? 5 : 4;
    let finalRy = gSize === 6 ? 5 : 3;
    let newObs: Array<{ x: number; y: number }> = [];

    let attempts = 0;
    while (!validPath && attempts < 50) {
      attempts++;
      const rx = Math.floor(Math.random() * gSize) + 1;
      const ry = Math.floor(Math.random() * gSize) + 1;
      if (rx === 1 && ry === 1) continue;

      finalRx = rx;
      finalRy = ry;

      newObs = [];
      const obsCount = 3 + Math.floor(Math.random() * 2); // 3 or 4 obstacles
      while (newObs.length < obsCount) {
        const ox = Math.floor(Math.random() * gSize) + 1;
        const oy = Math.floor(Math.random() * gSize) + 1;
        if (!((ox === 1 && oy === 1) || (ox === finalRx && oy === finalRy) || newObs.some(o => o.x === ox && o.y === oy))) {
          newObs.push({ x: ox, y: oy });
        }
      }

      if (isPathReachable({ x: 1, y: 1 }, { x: finalRx, y: finalRy }, newObs, gSize)) {
        validPath = true;
      }
    }

    setTargetX(finalRx);
    setTargetY(finalRy);
    setCheckpointX(undefined);
    setCheckpointY(undefined);
    setCheckpointCollected(false);
    setIsCooperative(false);
    setSwitchX(undefined);
    setSwitchY(undefined);
    setSwitchPressed(false);
    setGateX(undefined);
    setGateY(undefined);
    setObstacles(newObs);
    if (gSize === 6) {
      setMovingHazards([{ x: 3, y: 3 }, { x: 4, y: 2 }]);
    } else {
      setMovingHazards([]);
    }
    setSimLog(`⚡ Expert Mode (${gSize}x${gSize}): Solvable maze with obstacles 🧱 & patrolling hazards ⚡!`);
  };

  // Lesson modal state
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [quizResult, setQuizResult] = useState<string | null>(null);
  const [tutorialVisible, setTutorialVisible] = useState(false);
  const [clearedModalVisible, setClearedModalVisible] = useState(false);
  const [justCompletedChallenge, setJustCompletedChallenge] = useState<ChallengeLevel | null>(null);
  const [simStartTime, setSimStartTime] = useState<number>(0);
  const [levelStats, setLevelStats] = useState({ starCount: 3, timeSeconds: 5, blocksUsed: 3, bonusPoints: 25 });
  const [celebrationConfig, setCelebrationConfig] = useState({
    visible: false,
    isVictory: true,
    title: '',
    subtitle: '',
    scoreText: '',
  });

  const handleFailureRetry = () => {
    setCelebrationConfig(c => ({ ...c, visible: false }));
    handleShuffleReset();
  };

  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    const data = await getLocalRoboticsProgress();
    setCompletedLessons(data.completedLessons);
    setCompletedChallenges(data.completedChallenges);
    setTotalPoints(data.totalPoints);
    setEarnedBadges(data.earnedBadges);
    setAssessmentScores(data.assessmentScores);

    // Resume from where they left off (first uncompleted challenge)
    const firstIncompleteIndex = CHALLENGES.findIndex(c => !data.completedChallenges.includes(c.id));
    if (firstIncompleteIndex !== -1) {
      setActiveChallengeIndex(firstIncompleteIndex);
      const ch = CHALLENGES[firstIncompleteIndex];
      const gSize = ch.id >= 15 ? 6 : 5;
      setGridSize(gSize);
      setTargetX(ch.targetX);
      setTargetY(ch.targetY);
      setCheckpointX(ch.checkpointX);
      setCheckpointY(ch.checkpointY);
      setCheckpointCollected(false);
      setIsCooperative(!!ch.isCooperative);
      setSwitchX(ch.switchX);
      setSwitchY(ch.switchY);
      setSwitchPressed(false);
      setGateX(ch.gateX);
      setGateY(ch.gateY);
      setRobotBX(ch.robotBStartX || 1);
      setRobotBY(ch.robotBStartY || 1);
      setObstacles(ch.obstacles || []);
      setMovingHazards(gSize === 6 ? [{ x: 3, y: 3 }] : []);
      setBlockQueue(ch.requiredCommands || ['move_forward', 'stop']);
    } else if (data.completedChallenges.length >= CHALLENGES.length) {
      handleShuffleReset();
    }
  };

  const persistAndSync = async (updates: {
    completedLessons?: string[];
    completedChallenges?: number[];
    totalPoints?: number;
    earnedBadges?: string[];
    assessmentScores?: Record<string, number>;
  }) => {
    const updated = await saveLocalRoboticsProgress(updates);
    setCompletedLessons(updated.completedLessons);
    setCompletedChallenges(updated.completedChallenges);
    setTotalPoints(updated.totalPoints);
    setEarnedBadges(updated.earnedBadges);
    setAssessmentScores(updated.assessmentScores);
    setSyncStatus('offline_saved');

    if (appUser?.uid) {
      setSyncStatus('syncing');
      const ok = await syncRoboticsProgressToFirebase(
        appUser.uid,
        (appUser as any).fullName || (appUser as any).profile?.firstName || 'Student/Teacher',
        updated
      );
      setSyncStatus(ok ? 'synced' : 'offline_saved');
    }
  };

  const handleNextLevel = () => {
    setClearedModalVisible(false);
    setActiveTab('simulator');
  };

  const handleReplayLevel = () => {
    setClearedModalVisible(false);
    if (justCompletedChallenge) {
      setTargetX(justCompletedChallenge.targetX);
      setTargetY(justCompletedChallenge.targetY);
      setCheckpointX(justCompletedChallenge.checkpointX);
      setCheckpointY(justCompletedChallenge.checkpointY);
      setCheckpointCollected(false);
      setIsCooperative(!!justCompletedChallenge.isCooperative);
      setSwitchX(justCompletedChallenge.switchX);
      setSwitchY(justCompletedChallenge.switchY);
      setSwitchPressed(false);
      setGateX(justCompletedChallenge.gateX);
      setGateY(justCompletedChallenge.gateY);
      setRobotBX(justCompletedChallenge.robotBStartX || 1);
      setRobotBY(justCompletedChallenge.robotBStartY || 1);
      setObstacles(justCompletedChallenge.obstacles || []);
      setBlockQueue(justCompletedChallenge.requiredCommands || ['move_forward', 'stop']);
    }
    setRobotX(1);
    setRobotY(1);
    setRobotDir('E');
    setSimLog('Level reloaded. Press Run to try again!');
  };

  const handleRunSimulator = () => {
    setSimStartTime(Date.now());
    setSimRunning(true);
    setSimLog('Starting robot program execution...');

    const execResult = executeRoboticsProgram(blockQueue as any, {
      gridSize,
      obstacles,
      startPosition: { x: robotX, y: robotY, direction: robotDir }
    });

    const steps = execResult.steps;
    if (steps.length === 0) {
      setSimRunning(false);
      setSimLog(execResult.message);
      if (!execResult.success) {
        Alert.alert('Simulation Error', execResult.message);
      }
      return;
    }

    let currentStepIndex = 0;
    let localCheckpointCollected = checkpointCollected;
    let currentHazards = [...movingHazards];

    const runNextStep = () => {
      if (currentStepIndex < steps.length) {
        const step = steps[currentStepIndex];
        setRobotX(step.position.x);
        setRobotY(step.position.y);
        setRobotDir(step.position.direction);

        // Patrolling hazards movement
        if (currentHazards.length > 0) {
          currentHazards = currentHazards.map(h => {
            const dirs = [{x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}];
            const d = dirs[Math.floor(Math.random() * dirs.length)];
            const nx = Math.max(1, Math.min(gridSize, h.x + d.x));
            const ny = Math.max(1, Math.min(gridSize, h.y + d.y));
            return { x: nx, y: ny };
          });
          setMovingHazards(currentHazards);
        }

        // Check hazard collision
        if (currentHazards.some(h => h.x === step.position.x && h.y === step.position.y)) {
          setSimRunning(false);
          setCelebrationConfig({
            visible: true,
            isVictory: false,
            title: 'MISSION FAILED! ⚡',
            subtitle: 'Electric patrolling hazard struck the robot!',
            scoreText: '0 Points',
          });
          return;
        }

        if (checkpointX && checkpointY && !localCheckpointCollected && step.position.x === checkpointX && step.position.y === checkpointY) {
          localCheckpointCollected = true;
          setCheckpointCollected(true);
          step.message = '💎 Checkpoint rescued! Item collected. Now navigate to final destination (🏫).';
        }

        setSimLog(step.message);
        currentStepIndex++;
        setTimeout(runNextStep, step.delay || 700);
      } else {
        setSimRunning(false);
        setSimLog(execResult.message);

        const finalPos = execResult.finalPosition;
        const reached = hasReachedTarget(finalPos, { x: targetX, y: targetY });
        const checkpointMet = !checkpointX || localCheckpointCollected;

        if (reached && checkpointMet && execResult.success) {
          const currentChallenge = CHALLENGES[activeChallengeIndex] || CHALLENGES[0];
          setJustCompletedChallenge(currentChallenge);
          setClearedModalVisible(true);

          const timeSecs = Math.max(1, Math.round((Date.now() - simStartTime) / 1000));
          const blocksCount = blockQueue.length;
          const maxAllowed = currentChallenge.maxBlocks || 10;

          let stars = 3;
          if (blocksCount > maxAllowed) stars = 2;
          if (timeSecs > 25) stars = Math.max(1, stars - 1);

          const bonus = 25;
          setLevelStats({
            starCount: stars,
            timeSeconds: timeSecs,
            blocksUsed: blocksCount,
            bonusPoints: bonus,
          });

          const nextIndex = (activeChallengeIndex + 1) % CHALLENGES.length;
          const nextChallenge = CHALLENGES[nextIndex];
          const nextGSize = nextChallenge.id >= 15 ? 6 : 5;

          const isAlreadyCompleted = completedChallenges.includes(currentChallenge.id);
          const earnedXP = isAlreadyCompleted ? 15 : currentChallenge.points + bonus;

          if (!isAlreadyCompleted) {
            const newCompletedChallenges = [...completedChallenges, currentChallenge.id];
            const newPoints = totalPoints + earnedXP;
            const newBadges = earnedBadges.includes(currentChallenge.badge)
              ? earnedBadges
              : [...earnedBadges, currentChallenge.badge];

            persistAndSync({
              completedChallenges: newCompletedChallenges,
              totalPoints: newPoints,
              earnedBadges: newBadges
            });
          } else {
            const newPoints = totalPoints + earnedXP;
            persistAndSync({ totalPoints: newPoints });
          }

          setActiveChallengeIndex(nextIndex);
          setGridSize(nextGSize);
          setTargetX(nextChallenge.targetX);
          setTargetY(nextChallenge.targetY);
          setCheckpointX(nextChallenge.checkpointX);
          setCheckpointY(nextChallenge.checkpointY);
          setCheckpointCollected(false);
          setObstacles(nextChallenge.obstacles || []);
          setMovingHazards(nextGSize === 6 ? [{ x: 3, y: 3 }] : []);
          setBlockQueue(nextChallenge.requiredCommands || ['move_forward', 'stop']);
          setRobotX(1);
          setRobotY(1);
          setRobotDir('E');
        } else {
          const failReason = !execResult.success
            ? execResult.message
            : (checkpointX && !localCheckpointCollected)
            ? `Robot reached destination (🏫) without collecting checkpoint item (💎) first!`
            : `Robot finished commands at (${finalPos.x}, ${finalPos.y}), but target destination was at (${targetX}, ${targetY}).`;

          setCelebrationConfig({
            visible: true,
            isVictory: false,
            title: 'MISSION FAILED! 💥',
            subtitle: failReason,
            scoreText: '0 Points',
          });
        }
      }
    };

    setTimeout(runNextStep, 500);
  };

  const handleSubmitQuiz = (lesson: Lesson) => {
    if (quizAnswer === null) {
      Alert.alert('Please select an option');
      return;
    }
    if (quizAnswer === lesson.quiz.correctIndex) {
      setQuizResult('Correct! 🎉');
      const newCompleted = completedLessons.includes(lesson.id) ? completedLessons : [...completedLessons, lesson.id];
      const newPoints = totalPoints + 25;
      const newBadges = earnedBadges.includes('Robotics Scholar') ? earnedBadges : [...earnedBadges, 'Robotics Scholar'];
      persistAndSync({ completedLessons: newCompleted, totalPoints: newPoints, earnedBadges: newBadges });
    } else {
      setQuizResult('Incorrect. Try again!');
    }
  };

  const handleCompleteChallenge = (challenge: ChallengeLevel) => {
    const idx = CHALLENGES.findIndex(c => c.id === challenge.id);
    if (idx !== -1) setActiveChallengeIndex(idx);
    const gSize = challenge.id >= 15 ? 6 : 5;
    setGridSize(gSize);
    setTargetX(challenge.targetX);
    setTargetY(challenge.targetY);
    setCheckpointX(challenge.checkpointX);
    setCheckpointY(challenge.checkpointY);
    setCheckpointCollected(false);
    setIsCooperative(!!challenge.isCooperative);
    setSwitchX(challenge.switchX);
    setSwitchY(challenge.switchY);
    setSwitchPressed(false);
    setGateX(challenge.gateX);
    setGateY(challenge.gateY);
    setRobotBX(challenge.robotBStartX || 1);
    setRobotBY(challenge.robotBStartY || 1);
    setObstacles(challenge.obstacles || []);
    setMovingHazards(gSize === 6 ? [{ x: 3, y: 3 }] : []);
    setBlockQueue(challenge.requiredCommands || ['move_forward', 'stop']);
    setRobotX(1);
    setRobotY(1);
    setRobotDir('E');

    if (!completedChallenges.includes(challenge.id)) {
      const newChallenges = [...completedChallenges, challenge.id];
      const newPoints = totalPoints + challenge.points;
      const newBadges = earnedBadges.includes(challenge.badge) ? earnedBadges : [...earnedBadges, challenge.badge];
      persistAndSync({ completedChallenges: newChallenges, totalPoints: newPoints, earnedBadges: newBadges });
    }
    Alert.alert('Level Loaded! 🎯', `Loaded "${challenge.title}". Arrange blocks and hit Run!`);
  };

  const handleAddBlock = (blockId: string, insertIndex?: number) => {
    const q = [...blockQueue];
    if (insertIndex !== undefined && insertIndex >= 0 && insertIndex < q.length) {
      q.splice(insertIndex + 1, 0, blockId);
    } else {
      q.push(blockId);
    }
    setBlockQueue(q);
  };

  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    const q = [...blockQueue];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= q.length) return;
    const temp = q[index];
    q[index] = q[targetIdx];
    q[targetIdx] = temp;
    setBlockQueue(q);
  };

  return (
    <TierProtectedRoute featureId="teacher_coding_robotics">
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={primaryColor} />

        <RoboticsHeader
          primaryColor={primaryColor}
          onBack={() => router.back()}
          onOpenTutorial={() => setTutorialVisible(true)}
          totalPoints={totalPoints}
          earnedBadgesCount={earnedBadges.length}
          completedLessonsCount={completedLessons.length}
          totalLessonsCount={LESSONS.length}
          syncStatus={syncStatus}
        />

          <RoboticsDashboard activeTab={activeTab} onChangeTab={setActiveTab} primaryColor={primaryColor} isTeacherOrAdmin={isTeacherOrAdmin}>
          {activeTab === 'learn' && (
            <RoboticsLessons
              completedLessons={completedLessons}
              onSelectLesson={(lesson) => {
                setSelectedLesson(lesson);
                setQuizAnswer(null);
                setQuizResult(null);
              }}
              primaryColor={primaryColor}
            />
          )}

          {activeTab === 'simulator' && (
            <RobotSimulator
              robotX={robotX}
              robotY={robotY}
              robotDir={robotDir}
              targetX={targetX}
              targetY={targetY}
              checkpointX={checkpointX}
              checkpointY={checkpointY}
              checkpointCollected={checkpointCollected}
              obstacles={obstacles}
              movingHazards={movingHazards}
              gridSize={gridSize}
              challengeTitle={CHALLENGES[activeChallengeIndex]?.title}
              challengeDescription={CHALLENGES[activeChallengeIndex]?.description}
              maxBlocks={CHALLENGES[activeChallengeIndex]?.maxBlocks}
              simRunning={simRunning}
              simLog={simLog}
              primaryColor={primaryColor}
              onRun={handleRunSimulator}
              onReset={handleShuffleReset}
              onOpenBlocks={() => setActiveTab('blocks')}
            />
          )}

          {activeTab === 'blocks' && (
            <View>
              <View style={styles.modeToggleRow}>
                <TouchableOpacity
                  style={[
                    styles.modeBtn,
                    codingMode === 'visual' && { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
                  ]}
                  onPress={() => setCodingMode('visual')}
                >
                  <Text style={[styles.modeBtnText, codingMode === 'visual' && { color: '#FFFFFF' }]}>🧩 Visual Blocks</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modeBtn,
                    codingMode === 'text' && { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
                  ]}
                  onPress={() => setCodingMode('text')}
                >
                  <Text style={[styles.modeBtnText, codingMode === 'text' && { color: '#FFFFFF' }]}>💻 Text Sandbox</Text>
                </TouchableOpacity>
              </View>

              {codingMode === 'visual' ? (
                <CodingBlocks
                  blockQueue={blockQueue}
                  onAddBlock={handleAddBlock}
                  onRemoveBlock={(idx) => {
                    const q = [...blockQueue];
                    q.splice(idx, 1);
                    setBlockQueue(q);
                  }}
                  onMoveBlock={handleMoveBlock}
                  onUpdateQueue={setBlockQueue}
                  onClearQueue={() => setBlockQueue([])}
                  onTestRun={() => setActiveTab('simulator')}
                  primaryColor={primaryColor}
                />
              ) : (
                <TextCodeSandbox
                  codeScript={textScript}
                  onChangeCode={setTextScript}
                  onRunScript={handleCompileTextScript}
                  primaryColor={primaryColor}
                />
              )}
            </View>
          )}

          {activeTab === 'challenges' && (
            <RoboticsChallenges
              completedChallenges={completedChallenges}
              onCompleteLevel={handleCompleteChallenge}
              primaryColor={primaryColor}
            />
          )}

          {activeTab === 'achievements' && (
            <RoboticsAchievements earnedBadges={earnedBadges} totalPoints={totalPoints} />
          )}

          {activeTab === 'teacher' && isTeacherOrAdmin && (
            <TeacherRoboticsDashboard
              primaryColor={primaryColor}
              onExportProgress={() => Alert.alert('Export', 'Student progress data exported successfully.')}
              onResetProgress={() => {
                Alert.alert('Reset', 'Are you sure you want to reset progress?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Reset', style: 'destructive', onPress: () => persistAndSync({ completedLessons: [], completedChallenges: [], totalPoints: 0, earnedBadges: [], assessmentScores: {} }) }
                ]);
              }}
            />
          )}
        </RoboticsDashboard>

        {/* LESSON MODAL */}
        <Modal visible={!!selectedLesson} animationType="slide" transparent={false} onRequestClose={() => setSelectedLesson(null)}>
          <SafeAreaView style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {selectedLesson && (
                <>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalCat}>{selectedLesson.category}</Text>
                    <TouchableOpacity onPress={() => setSelectedLesson(null)} style={styles.closeModalBtn}>
                      <SVGIcon name="close" size={24} color="#0F172A" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.modalTitle}>{selectedLesson.title}</Text>

                  <View style={[styles.illustrationBanner, { backgroundColor: primaryColor + '15', borderColor: primaryColor + '30' }]}>
                    <SVGIcon name={selectedLesson.illustrationIcon || 'book'} size={48} color={primaryColor} />
                    <Text style={[styles.illustrationBannerText, { color: primaryColor }]}>Interactive Robotics Laboratory Module</Text>
                  </View>

                  <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                    <Text style={styles.modalText}>{selectedLesson.content}</Text>

                    {selectedLesson.diagramImageBase64 ? (
                      <View style={styles.diagramCard}>
                        <View style={styles.diagramHeader}>
                          <SVGIcon name="eye" size={20} color={primaryColor} />
                          <Text style={styles.diagramTitle}>{selectedLesson.diagramTitle || 'Vital Technical & Visual Diagram'}</Text>
                        </View>
                        <View style={styles.diagramImageContainer}>
                          <Image
                            source={{ uri: selectedLesson.diagramImageBase64 }}
                            style={styles.diagramImage}
                            resizeMode="contain"
                          />
                        </View>
                        {selectedLesson.diagramCaption ? (
                          <Text style={styles.diagramCaption}>💡 {selectedLesson.diagramCaption}</Text>
                        ) : null}
                      </View>
                    ) : null}

                    {selectedLesson.architectureDetails ? (
                      <View style={styles.archBox}>
                        <Text style={styles.archTitle}>⚙️ Engineering & Architecture Deep Dive</Text>
                        <Text style={styles.archText}>{selectedLesson.architectureDetails}</Text>
                      </View>
                    ) : null}

                    {selectedLesson.codeExample ? (
                      <View style={styles.codeBox}>
                        <Text style={styles.codeTitle}>💻 Code / Pseudocode Implementation</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ paddingRight: 20 }}>
                          <Text style={styles.codeText}>{selectedLesson.codeExample}</Text>
                        </ScrollView>
                      </View>
                    ) : null}

                    <Text style={styles.keyPointsHeader}>Key Takeaways:</Text>
                    {selectedLesson.keyPoints.map((kp, i) => (
                      <Text key={i} style={styles.keyPointItem}>✅ {kp}</Text>
                    ))}

                    <View style={styles.quizBox}>
                      <Text style={styles.quizTitle}>🧠 Mini Knowledge Check</Text>
                      <Text style={styles.quizQ}>{selectedLesson.quiz.question}</Text>
                      {selectedLesson.quiz.options.map((opt, oIdx) => (
                        <TouchableOpacity
                          key={oIdx}
                          style={[styles.quizOption, quizAnswer === oIdx && { backgroundColor: primaryColor + '20', borderColor: primaryColor }]}
                          onPress={() => setQuizAnswer(oIdx)}
                        >
                          <Text style={styles.quizOptionText}>{opt}</Text>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity style={[styles.submitQuizBtn, { backgroundColor: primaryColor }]} onPress={() => handleSubmitQuiz(selectedLesson)}>
                        <Text style={styles.submitQuizText}>Submit Answer</Text>
                      </TouchableOpacity>
                      {quizResult && <Text style={styles.quizResultText}>{quizResult}</Text>}
                    </View>
                  </ScrollView>
                </>
              )}
            </View>
          </SafeAreaView>
        </Modal>

        {/* TUTORIAL / GUIDE MODAL */}
        <RoboticsTutorialModal
          visible={tutorialVisible}
          onClose={() => setTutorialVisible(false)}
          primaryColor={primaryColor}
        />

        {/* LEVEL CLEARED VICTORY MODAL */}
        <LevelClearedModal
          visible={clearedModalVisible}
          challenge={justCompletedChallenge}
          starCount={levelStats.starCount}
          timeSeconds={levelStats.timeSeconds}
          blocksUsed={levelStats.blocksUsed}
          bonusPoints={levelStats.bonusPoints}
          onNextLevel={handleNextLevel}
          onReplayLevel={handleReplayLevel}
          primaryColor={primaryColor}
        />

        {/* FAILURE / OBSTACLE HIT MODAL */}
        <CelebrationModal
          visible={celebrationConfig.visible}
          isVictory={celebrationConfig.isVictory}
          title={celebrationConfig.title}
          subtitle={celebrationConfig.subtitle}
          scoreText={celebrationConfig.scoreText}
          onPlayAgain={celebrationConfig.isVictory ? () => { setCelebrationConfig(c => ({ ...c, visible: false })); setActiveTab('simulator'); } : handleFailureRetry}
          onExit={() => setCelebrationConfig(c => ({ ...c, visible: false }))}
        />

      </SafeAreaView>
    </TierProtectedRoute>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  modalOverlay: { flex: 1, backgroundColor: '#0F172A20', justifyContent: 'center' },
  modalContent: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 20,
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingTop: 10 },
  modalCat: { fontSize: 12, fontWeight: '800', color: '#6366F1', textTransform: 'uppercase' },
  closeModalBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A', marginBottom: 16 },
  illustrationBanner: {
    height: 110,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1.5,
    gap: 8,
  },
  illustrationBannerText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modalBody: { flex: 1 },
  modalText: { fontSize: 15, color: '#334155', lineHeight: 24, marginBottom: 16 },
  diagramCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    ...SHADOWS.small,
  },
  diagramHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  diagramTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
  },
  diagramImageContainer: {
    width: '100%',
    height: 240,
    maxHeight: 280,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  diagramImage: {
    width: '100%',
    height: '100%',
  },
  diagramCaption: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
    fontStyle: 'italic',
  },
  archBox: { backgroundColor: '#EFF6FF', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#BFDBFE' },
  archTitle: { fontSize: 15, fontWeight: '900', color: '#1E40AF', marginBottom: 8 },
  archText: { fontSize: 14, color: '#1E3A8A', lineHeight: 22 },
  codeBox: { backgroundColor: '#0F172A', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
  codeTitle: { fontSize: 14, fontWeight: '900', color: '#38BDF8', marginBottom: 8 },
  codeText: { fontSize: 13, color: '#E2E8F0', lineHeight: 20, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  keyPointsHeader: { fontSize: 16, fontWeight: '900', color: '#0F172A', marginBottom: 10 },
  keyPointItem: { fontSize: 14, color: '#475569', marginBottom: 8, lineHeight: 20 },
  quizBox: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginTop: 10, marginBottom: 40, borderWidth: 1, borderColor: '#E2E8F0', ...SHADOWS.small },
  quizTitle: { fontSize: 17, fontWeight: '900', color: '#0F172A', marginBottom: 8 },
  quizQ: { fontSize: 15, fontWeight: '800', color: '#334155', marginBottom: 14 },
  quizOption: { padding: 14, backgroundColor: '#F8FAFC', borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  quizOptionText: { fontSize: 14, color: '#334155', fontWeight: '700' },
  submitQuizBtn: { padding: 14, borderRadius: 14, alignItems: 'center', marginTop: 12 },
  submitQuizText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  quizResultText: { fontSize: 15, fontWeight: '900', textAlign: 'center', marginTop: 12, color: '#10B981' },
  modeToggleRow: { flexDirection: 'row', backgroundColor: '#CBD5E1', borderRadius: 14, padding: 4, marginBottom: 16, gap: 4 },
  modeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  modeBtnText: { fontSize: 13, fontWeight: '800', color: '#1E293B' },
});
