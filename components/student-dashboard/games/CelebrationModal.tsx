import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Easing,
  Dimensions,
  StatusBar,
} from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../SVGIcon";
import { SHADOWS } from "../../../constants/theme";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } =
  Dimensions.get("window");

interface CelebrationModalProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  scoreText?: string;
  secondScoreText?: string;
  onPlayAgain: () => void;
  onExit: () => void;
  isVictory?: boolean;
  isPerfectScore?: boolean;
  isTie?: boolean;
}

const PARTICLES = [
  { emoji: "⭐", left: 5, delay: 0, duration: 2600, size: 22 },
  { emoji: "✨", left: 15, delay: 300, duration: 3200, size: 18 },
  { emoji: "🎉", left: 25, delay: 600, duration: 2900, size: 25 },
  { emoji: "🌟", left: 35, delay: 150, duration: 3500, size: 22 },
  { emoji: "🎊", left: 45, delay: 500, duration: 2700, size: 24 },
  { emoji: "⭐", left: 55, delay: 800, duration: 3100, size: 20 },
  { emoji: "✨", left: 65, delay: 200, duration: 2800, size: 22 },
  { emoji: "🎉", left: 75, delay: 700, duration: 3300, size: 24 },
  { emoji: "🌟", left: 85, delay: 400, duration: 3000, size: 20 },
  { emoji: "🎊", left: 95, delay: 900, duration: 2900, size: 23 },
  { emoji: "💛", left: 10, delay: 1100, duration: 3400, size: 19 },
  { emoji: "🏆", left: 90, delay: 1300, duration: 3600, size: 25 },
];

export function CelebrationModal({
  visible,
  title,
  subtitle,
  scoreText = "100 Points",
  secondScoreText,
  onPlayAgain,
  onExit,
  isVictory = true,
  isPerfectScore = false,
  isTie = false,
}: CelebrationModalProps) {
  const particles = useRef(
    PARTICLES.map(() => new Animated.Value(0))
  ).current;

  const trophyScale = useRef(new Animated.Value(0.7)).current;

  const trophyRotate = useRef(new Animated.Value(0)).current;

  const glowOpacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (!visible) {
      particles.forEach((particle) => particle.stopAnimation());
      trophyScale.stopAnimation();
      trophyRotate.stopAnimation();
      glowOpacity.stopAnimation();
      return;
    }

    const animations: Animated.CompositeAnimation[] = [];

    if (isVictory || isTie) {
      PARTICLES.forEach((particle, index) => {
        const animation = Animated.loop(
          Animated.sequence([
            Animated.delay(particle.delay),
            Animated.timing(particles[index], {
              toValue: 1,
              duration: particle.duration,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
            Animated.timing(particles[index], {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ])
        );

        animations.push(animation);
      });
    }

    const trophyAnimation = Animated.spring(trophyScale, {
      toValue: 1,
      friction: 4,
      tension: 60,
      useNativeDriver: true,
    });

    animations.push(trophyAnimation);

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0.5,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );

    animations.push(pulseAnimation);

    const rotationAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(trophyRotate, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(trophyRotate, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    if (isVictory || isTie) {
      animations.push(rotationAnimation);
    }

    animations.forEach((animation) => animation.start());

    return () => {
      animations.forEach((animation) => animation.stop());
    };
  }, [
    visible,
    isVictory,
    isTie,
    particles,
    trophyScale,
    trophyRotate,
    glowOpacity,
  ]);

  if (!visible) return null;

  const trophyRotation = trophyRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["-8deg", "8deg"],
  });

  const trophyColor = isTie
    ? "#D97706"
    : isPerfectScore
      ? "#EAB308"
      : isVictory
        ? "#F59E0B"
        : "#EF4444";

  const displayTitle =
    title ||
    (isTie
      ? "IT'S A DRAW!"
      : isVictory
        ? isPerfectScore
          ? "PERFECT SCORE!"
          : "CONGRATULATIONS!"
        : "YOU LOST!");

  const displaySubtitle =
    subtitle ||
    (isTie
      ? "YOU ARE BOTH CHAMPIONS! 🤝"
      : isVictory
        ? isPerfectScore
          ? "YOU ARE A TRUE CHAMPION! 🏆"
          : "YOU WON THE GAME! 🎉"
        : "Don't be discouraged! You fought a great battle! 💪");

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onExit}
    >
      <StatusBar
        backgroundColor="rgba(15, 23, 42, 0.95)"
        barStyle="light-content"
      />

      <View style={styles.victoryOverlay}>
        {/* ANIMATED FALLING CONFETTI */}

        {(isVictory || isTie) && (
          <View
            style={styles.confettiContainer}
            pointerEvents="none"
          >
            {PARTICLES.map((particle, index) => {
              const translateY = particles[index].interpolate({
                inputRange: [0, 1],
                outputRange: [-60, SCREEN_HEIGHT + 60],
              });

              const opacity = particles[index].interpolate({
                inputRange: [0, 0.1, 0.85, 1],
                outputRange: [0, 1, 1, 0],
              });

              const rotate = particles[index].interpolate({
                inputRange: [0, 1],
                outputRange: ["0deg", "360deg"],
              });

              return (
                <Animated.Text
                  key={index}
                  style={[
                    styles.confettiParticle,
                    {
                      left: `${particle.left}%`,
                      fontSize: particle.size,
                      opacity,
                      transform: [
                        { translateY },
                        { rotate },
                      ],
                    },
                  ]}
                >
                  {particle.emoji}
                </Animated.Text>
              );
            })}
          </View>
        )}

        {/* MAIN CELEBRATION CARD */}

        <Animatable.View
          animation="zoomIn"
          duration={700}
          easing="ease-out-back"
          style={styles.victoryCard}
        >
          {/* TOP DECORATION */}

          <View style={[styles.championBadge, isTie ? styles.tieBadge : (!isVictory && styles.defeatBadge)]}>
            <Text style={[styles.championBadgeText, isTie ? styles.tieBadgeText : (!isVictory && styles.defeatBadgeText)]}>
              {isTie ? "🤝 IT'S A TIE" : isVictory ? (isPerfectScore ? "👑 SUPER CHAMPION" : "🏆 WINNER") : "💔 YOU LOST - HARD FOUGHT"}
            </Text>
          </View>

          {/* TROPHY */}

          <View style={styles.trophyWrapper}>
            {(isVictory || isTie) && (
              <Animated.View
                style={[
                  styles.trophyGlow,
                  { opacity: glowOpacity },
                ]}
              />
            )}

            <Animated.View
              style={[
                styles.trophyCircle,
                isTie ? styles.tieCircle : (!isVictory && styles.defeatCircle),
                {
                  transform: [
                    { scale: trophyScale },
                    {
                      rotate: (isVictory || isTie)
                        ? trophyRotation
                        : "0deg",
                    },
                  ],
                },
              ]}
            >
              <Animatable.View
                animation="bounceIn"
                delay={200}
                duration={1200}
              >
                {isTie ? (
                  <View style={styles.tieTrophyContainer}>
                    <SVGIcon name="trophy" size={48} color="#D97706" />
                    <Text style={styles.tieHandshake}>🤝</Text>
                  </View>
                ) : (
                  <SVGIcon
                    name={isVictory ? "trophy" : "sad-outline"}
                    size={76}
                    color={trophyColor}
                  />
                )}
              </Animatable.View>
            </Animated.View>

            {(isVictory || isTie) && (
              <>
                <Text style={styles.trophyStarLeft}>✨</Text>
                <Text style={styles.trophyStarRight}>⭐</Text>
              </>
            )}
          </View>

          {/* CONGRATULATIONS */}

          <Animatable.Text
            animation="fadeInUp"
            delay={300}
            duration={700}
            style={styles.victoryHeader}
          >
            {displayTitle}
          </Animatable.Text>

          <Animatable.Text
            animation="fadeInUp"
            delay={450}
            duration={700}
            style={[
              styles.victorySub,
              isTie ? styles.tieSubtitle : (!isVictory && styles.defeatSubtitle),
            ]}
          >
            {displaySubtitle}
          </Animatable.Text>

          {/* SCORE DISPLAY */}

          {isTie && secondScoreText ? (
            <View style={styles.tieScoreRow}>
              <View style={styles.tiePlayerScore}>
                <Text style={styles.tiePlayerLabel}>PLAYER 1</Text>
                <Text style={styles.tiePlayerValue}>{scoreText}</Text>
              </View>

              <Text style={styles.tieVs}>=</Text>

              <View style={styles.tiePlayerScore}>
                <Text style={styles.tiePlayerLabel}>PLAYER 2</Text>
                <Text style={styles.tiePlayerValue}>{secondScoreText}</Text>
              </View>
            </View>
          ) : (!isVictory && secondScoreText) ? (
            <View style={styles.tieScoreRow}>
              <View style={[styles.tiePlayerScore, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5', borderWidth: 1 }]}>
                <Text style={[styles.tiePlayerLabel, { color: '#991B1B' }]}>YOUR SCORE</Text>
                <Text style={[styles.tiePlayerValue, { color: '#991B1B' }]}>{scoreText}</Text>
              </View>

              <Text style={[styles.tieVs, { color: '#EF4444' }]}>VS</Text>

              <View style={[styles.tiePlayerScore, { backgroundColor: '#DCFCE7', borderColor: '#86EFAC', borderWidth: 1 }]}>
                <Text style={[styles.tiePlayerLabel, { color: '#166534' }]}>WINNER'S SCORE</Text>
                <Text style={[styles.tiePlayerValue, { color: '#15803D' }]}>{secondScoreText}</Text>
              </View>
            </View>
          ) : (
            <Animatable.View
              animation="zoomIn"
              delay={550}
              duration={600}
              style={[
                styles.finalScoreBadge,
                isPerfectScore && styles.perfectScoreBadge,
                !isVictory && !isTie && styles.defeatScoreBadge,
              ]}
            >
              <Text style={[styles.finalScoreLabel, !isVictory && !isTie && { color: "#991B1B" }]}>
                FINAL RESULT
              </Text>

              <Text style={[styles.finalScoreVal, !isVictory && !isTie && { color: "#991B1B" }]}>
                {scoreText}
              </Text>

              {isPerfectScore && (
                <Text style={styles.perfectScoreText}>
                  ⭐ OUTSTANDING PERFORMANCE ⭐
                </Text>
              )}
            </Animatable.View>
          )}

          {/* MOTIVATIONAL MESSAGE */}

          <Text
            style={[
              styles.leaderboardNote,
              isTie ? styles.tieNote : (!isVictory && styles.defeatNote),
            ]}
          >
            {isTie
              ? "Incredible battle! Both players fought brilliantly to a draw! 🤝"
              : isPerfectScore
                ? "An incredible performance! You have mastered this challenge! 👑"
                : isVictory
                  ? "Your hard work is paying off. Keep shining! 🚀"
                  : "Don't give up! Every champion loses battles on their way to greatness. Keep practicing and you will conquer the next game! 💪"}
          </Text>

          {/* PLAY AGAIN */}

          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.victoryBtn,
              isTie ? styles.tieBtn : (!isVictory && styles.retryBtn),
            ]}
            onPress={onPlayAgain}
            accessibilityRole="button"
            accessibilityLabel="Play again"
          >
            <Text style={styles.victoryBtnText}>
              {isTie ? "🔄  PLAY AGAIN" : isVictory ? "🔄  PLAY AGAIN" : "💪  TRY AGAIN"}
            </Text>
          </TouchableOpacity>

          {/* EXIT */}

          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.exitBtn}
            onPress={onExit}
            accessibilityRole="button"
            accessibilityLabel="Back to Fun Zone"
          >
            <Text style={styles.exitText}>
              Back to Fun Zone
            </Text>
          </TouchableOpacity>
        </Animatable.View>

        {/* BOTTOM CELEBRATION */}

        {(isVictory || isTie) && (
          <Animatable.Text
            animation="fadeIn"
            delay={1000}
            duration={1000}
            style={styles.bottomMessage}
          >
            🌟 KEEP LEARNING. KEEP WINNING! 🌟
          </Animatable.Text>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  victoryOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.93)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    zIndex: 999,
  },

  confettiContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },

  confettiParticle: {
    position: "absolute",
    top: 0,
  },

  victoryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    padding: 25,
    paddingTop: 20,
    alignItems: "center",
    width: "100%",
    maxWidth: 390,
    maxHeight: "90%",
    ...SHADOWS.medium,
  },

  championBadge: {
    backgroundColor: "#FEF3C7",
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },

  championBadgeText: {
    color: "#92400E",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },

  tieBadge: {
    backgroundColor: "#FEF3C7",
    borderColor: "#F59E0B",
  },

  tieBadgeText: {
    color: "#92400E",
  },

  defeatBadge: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FCA5A5",
  },

  defeatBadgeText: {
    color: "#991B1B",
  },

  trophyWrapper: {
    width: 150,
    height: 140,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },

  trophyGlow: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#FDE68A",
  },

  trophyCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: "#FEF3C7",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#F59E0B",
    elevation: 8,
    ...SHADOWS.medium,
  },

  defeatCircle: {
    backgroundColor: "#FEE2E2",
    borderColor: "#EF4444",
  },

  tieCircle: {
    backgroundColor: "#FEF3C7",
    borderColor: "#D97706",
  },

  tieTrophyContainer: {
    alignItems: "center",
    justifyContent: "center",
  },

  tieHandshake: {
    fontSize: 28,
    marginTop: -5,
  },

  trophyStarLeft: {
    position: "absolute",
    left: 0,
    top: 20,
    fontSize: 25,
  },

  trophyStarRight: {
    position: "absolute",
    right: 0,
    top: 15,
    fontSize: 25,
  },

  victoryHeader: {
    fontSize: 25,
    fontWeight: "900",
    color: "#0F172A",
    textAlign: "center",
    letterSpacing: 0.5,
  },

  victorySub: {
    fontSize: 15,
    fontWeight: "900",
    color: "#D97706",
    marginTop: 7,
    textAlign: "center",
  },

  tieSubtitle: {
    color: "#D97706",
  },

  defeatSubtitle: {
    color: "#EF4444",
  },

  finalScoreBadge: {
    backgroundColor: "#EFF6FF",
    borderWidth: 2,
    borderColor: "#BFDBFE",
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: 18,
    alignItems: "center",
    marginVertical: 20,
    width: "100%",
  },

  perfectScoreBadge: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FCD34D",
  },

  defeatScoreBadge: {
    backgroundColor: "#FFF1F2",
    borderColor: "#FECDD3",
  },

  finalScoreLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "#2563EB",
    letterSpacing: 2,
  },

  finalScoreVal: {
    fontSize: 27,
    fontWeight: "900",
    color: "#1E3A8A",
    marginTop: 5,
    textAlign: "center",
  },

  perfectScoreText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#B45309",
    marginTop: 8,
    textAlign: "center",
  },

  tieScoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 15,
    marginBottom: 15,
  },

  tiePlayerScore: {
    flex: 1,
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },

  tiePlayerLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#92400E",
  },

  tiePlayerValue: {
    fontSize: 17,
    fontWeight: "900",
    color: "#78350F",
    marginTop: 5,
  },

  tieVs: {
    fontSize: 24,
    fontWeight: "900",
    color: "#D97706",
    marginHorizontal: 12,
  },

  leaderboardNote: {
    fontSize: 13,
    color: "#16A34A",
    fontWeight: "800",
    marginBottom: 20,
    textAlign: "center",
    lineHeight: 20,
  },

  tieNote: {
    color: "#D97706",
  },

  defeatNote: {
    color: "#64748B",
  },

  victoryBtn: {
    backgroundColor: "#2563EB",
    paddingVertical: 16,
    borderRadius: 16,
    width: "100%",
    alignItems: "center",
    elevation: 4,
  },

  tieBtn: {
    backgroundColor: "#D97706",
  },

  retryBtn: {
    backgroundColor: "#475569",
  },

  victoryBtnText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },

  exitBtn: {
    marginTop: 15,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },

  exitText: {
    color: "#64748B",
    fontWeight: "800",
    fontSize: 14,
  },

  bottomMessage: {
    color: "#FDE68A",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginTop: 18,
    textAlign: "center",
  },
});
