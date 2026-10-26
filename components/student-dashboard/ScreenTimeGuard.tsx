import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  AppState,
  AppStateStatus,
  Platform,
  PanResponder,
} from "react-native";
import { doc, getDoc } from "firebase/firestore";
import SVGIcon from "../SVGIcon";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebaseConfig";
import { SHADOWS } from "../../constants/theme";

export type StudentTier = "preschool" | "lower_primary" | "upper_primary_jhs";

interface TierConfig {
  thresholdSeconds: number; // Duration in seconds before reminder triggers
  title: string;
  subtitle: string;
  message: string;
  buttonText: string;
  badgeColor: string;
  iconName: string;
  emoji: string;
}

const TIER_CONFIGS: Record<StudentTier, TierConfig> = {
  preschool: {
    thresholdSeconds: 3600, // 1 Hour active time
    title: "Time for a Play & Rest Break! 🎨",
    subtitle: "Active App Use: 1 Hour",
    message:
      "Hey little star! ⭐ You have been actively learning on EduEaz for 1 hour. It's time to rest your eyes, take a wiggle break, drink some water, and go play outside!",
    buttonText: "I'll Take a Break! 🎈",
    badgeColor: "#FF6B6B",
    iconName: "happy-outline",
    emoji: "⭐",
  },
  lower_primary: {
    thresholdSeconds: 7200, // 2 Hours active time
    title: "Rest Your Eyes & Recharge! 🌟",
    subtitle: "Active App Use: 2 Hours",
    message:
      "Awesome job studying! You've been actively learning on EduEaz for 2 hours today. Healthy eyes and a strong brain need regular breaks. Time to step away, stretch, eat a healthy snack, and stretch your legs!",
    buttonText: "Take a 15-Min Break 🍎",
    badgeColor: "#F59E0B",
    iconName: "fitness-outline",
    emoji: "🌟",
  },
  upper_primary_jhs: {
    thresholdSeconds: 10800, // 3 Hours active time
    title: "Screen Time Alert: Time to Unplug 🧠",
    subtitle: "Active App Use: 3 Hours",
    message:
      "Great work on your learning goals! You have logged 3 hours of active app usage. To protect your vision and maintain peak focus, please take a mandatory screen break now. Step outside, hydrate, and give your mind time to rest.",
    buttonText: "I'm Taking a Break 🌿",
    badgeColor: "#6366F1",
    iconName: "time-outline",
    emoji: "🌿",
  },
};

// Maximum allowed seconds of no user interaction before considering the student idle/inactive
const INACTIVITY_TIMEOUT_SECONDS = 120; // 2 minutes

export default function ScreenTimeGuard() {
  const { appUser } = useAuth();
  const [tier, setTier] = useState<StudentTier>("lower_primary");
  const [activeSeconds, setActiveSeconds] = useState<number>(0);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [snoozedUntil, setSnoozedUntil] = useState<number>(0);

  const appState = useRef<AppStateStatus>(AppState.currentState);
  const lastInteractionTime = useRef<number>(Date.now());

  // Record active user interaction (touches, clicks, keys, scroll)
  const recordInteraction = useCallback(() => {
    lastInteractionTime.current = Date.now();
  }, []);

  // Set up PanResponder to observe all touch events transparently
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => {
        recordInteraction();
        return false;
      },
      onMoveShouldSetPanResponderCapture: () => {
        recordInteraction();
        return false;
      },
    })
  ).current;

  // Web event listeners for mouse, keyboard, touch, scroll
  useEffect(() => {
    if (Platform.OS !== "web") return;

    const handleWebInteraction = () => {
      recordInteraction();
    };

    window.addEventListener("mousemove", handleWebInteraction, { passive: true });
    window.addEventListener("keydown", handleWebInteraction, { passive: true });
    window.addEventListener("touchstart", handleWebInteraction, { passive: true });
    window.addEventListener("scroll", handleWebInteraction, { passive: true });

    return () => {
      window.removeEventListener("mousemove", handleWebInteraction);
      window.removeEventListener("keydown", handleWebInteraction);
      window.removeEventListener("touchstart", handleWebInteraction);
      window.removeEventListener("scroll", handleWebInteraction);
    };
  }, [recordInteraction]);

  // 1. Determine student tier based on class level/department
  useEffect(() => {
    if (!appUser || appUser.role !== "student") return;

    let isMounted = true;
    const resolveTier = async () => {
      try {
        const classId = appUser.classId;
        if (!classId) return;

        const classSnap = await getDoc(doc(db, "classes", classId));
        if (!classSnap.exists() || !isMounted) return;

        const classData = classSnap.data() as any;
        const dept = (classData.department || "").toLowerCase();
        const className = (classData.name || "").toUpperCase();
        const levelNum = Number(classData.level);

        const PRESCHOOL_KEYWORDS = [
          "CRECHE",
          "NURSERY",
          "KG",
          "KINDERGARTEN",
          "TODDLER",
          "PLAYGROUND",
          "LEVEL A",
          "LEVEL B",
          "LEVEL C",
          "LEVEL D",
        ];

        if (
          dept === "pre-school" ||
          PRESCHOOL_KEYWORDS.some((kw) => className.includes(kw))
        ) {
          setTier("preschool");
        } else if (
          dept === "lower primary" ||
          (levelNum >= 1 && levelNum <= 3)
        ) {
          setTier("lower_primary");
        } else if (
          dept === "upper primary" ||
          dept === "jhs" ||
          levelNum >= 4
        ) {
          setTier("upper_primary_jhs");
        }
      } catch (err) {
        console.error("ScreenTimeGuard: Failed to resolve student tier", err);
      }
    };

    resolveTier();
    return () => {
      isMounted = false;
    };
  }, [appUser]);

  // 2. Precise active app-use timer
  useEffect(() => {
    if (!appUser || appUser.role !== "student") return;

    // Reset interaction timestamp when entering
    lastInteractionTime.current = Date.now();

    const timer = setInterval(() => {
      const isAppActive = appState.current === "active";
      const secondsSinceInteraction =
        (Date.now() - lastInteractionTime.current) / 1000;
      const isUserEngaged = secondsSinceInteraction <= INACTIVITY_TIMEOUT_SECONDS;

      // Only increment timer if app is in foreground AND student is actively engaged
      if (isAppActive && isUserEngaged) {
        setActiveSeconds((prev) => prev + 1);
      }
    }, 1000);

    const subscription = AppState.addEventListener("change", (nextState) => {
      appState.current = nextState;
      if (nextState === "active") {
        // Resume interaction clock when app is brought back to foreground
        lastInteractionTime.current = Date.now();
      }
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [appUser]);

  // 3. Trigger break reminder when activeSeconds reaches relevant threshold
  const currentConfig = TIER_CONFIGS[tier];

  useEffect(() => {
    if (!appUser || appUser.role !== "student") return;

    const now = Date.now();
    if (
      activeSeconds >= currentConfig.thresholdSeconds &&
      now > snoozedUntil &&
      !modalVisible
    ) {
      setModalVisible(true);
    }
  }, [activeSeconds, currentConfig, snoozedUntil, modalVisible, appUser]);

  const handleDismiss = () => {
    setModalVisible(false);
    // Snooze reminder for 15 minutes before checking again
    setSnoozedUntil(Date.now() + 15 * 60 * 1000);
  };

  if (!appUser || appUser.role !== "student") return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" {...panResponder.panHandlers}>
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={handleDismiss}
      >
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View
              style={[
                styles.iconBadge,
                { backgroundColor: currentConfig.badgeColor + "18" },
              ]}
            >
              <SVGIcon
                name={currentConfig.iconName}
                size={42}
                color={currentConfig.badgeColor}
              />
            </View>

            <Text style={styles.title}>{currentConfig.title}</Text>

            <View
              style={[
                styles.timeBadge,
                { backgroundColor: currentConfig.badgeColor + "20" },
              ]}
            >
              <Text
                style={[styles.timeBadgeText, { color: currentConfig.badgeColor }]}
              >
                {currentConfig.subtitle}
              </Text>
            </View>

            <Text style={styles.message}>{currentConfig.message}</Text>

            <TouchableOpacity
              style={[
                styles.actionBtn,
                { backgroundColor: currentConfig.badgeColor },
              ]}
              onPress={handleDismiss}
              activeOpacity={0.85}
            >
              <Text style={styles.actionBtnText}>{currentConfig.buttonText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    ...SHADOWS.large,
    elevation: 20,
  },
  iconBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 8,
  },
  timeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  timeBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  message: {
    fontSize: 14,
    color: "#475569",
    textAlign: "center",
    lineHeight: 22,
    fontWeight: "500",
    marginBottom: 24,
  },
  actionBtn: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.small,
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
});
