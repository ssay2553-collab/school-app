import React, { useState, useRef, useMemo, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  PanResponder,
  Dimensions,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import * as Animatable from "react-native-animatable";
import { Audio } from "expo-av";
import { safeSpeak, safeStop } from "../../../utils/safeSpeech";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import SVGIcon from "../../SVGIcon";
import { WRITING_DATA, REMARKS, PEN_COLORS } from "./GameConstants";
import { SHADOWS } from "../../../constants/theme";
import { useAuth } from "../../../contexts/AuthContext";
import { syncAchievementsToCloud } from "../../../utils/gameSync";

const { width } = Dimensions.get("window");
const CANVAS_SIZE = width * 0.85;
const STICKERS = ["🦁", "🚀", "⭐", "🌈", "🍦", "🎨", "⚽", "🍎", "🐱", "🦄", "🐼", "🐬"];

interface WritingGameProps {
  onExit: () => void;
}

type TaskType = "letter" | "number";

export const WritingGame: React.FC<WritingGameProps> = ({ onExit }) => {
  const { appUser } = useAuth();
  const [activeType, setActiveType] = useState<TaskType | null>(null);
  const [index, setIndex] = useState(0);
  const [paths, setPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>("");
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [showRemark, setShowRemark] = useState(false);
  const [remark, setRemark] = useState("");
  const [newSticker, setNewSticker] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const filteredData = useMemo(() => {
    if (!activeType) return [];
    return WRITING_DATA.filter((item) => item.type === activeType);
  }, [activeType]);

  const currentTask = filteredData[index % (filteredData.length || 1)];

  // Voice output when a new task is presented
  useEffect(() => {
    if (activeType && currentTask) {
      const speakTask = async () => {
        const textToSpeak = activeType === "letter"
          ? `Trace the letter ${currentTask.char}`
          : `Trace the number ${currentTask.char}`;

        safeStop();
        safeSpeak(textToSpeak, {
          language: 'en',
          pitch: 1.1,
          rate: 0.9,
        });
      };

      // Delay slightly to allow the UI to transition
      const timer = setTimeout(speakTask, 500);
      return () => clearTimeout(timer);
    }
  }, [index, activeType]);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
      safeStop();
    };
  }, []);

  const playSound = async (type: "success" | "click") => {
    try {
      const source = type === "success"
        ? require("../../../assets/notification.mp3")
        : require("../../../assets/message_sent.mp3");

      const { sound } = await Audio.Sound.createAsync(source);
      soundRef.current = sound;
      await sound.playAsync();
    } catch (error) {
      console.log("Error playing sound:", error);
    }
  };

  const activePathRef = useRef<string>("");

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderGrant: (evt) => {
          console.log("PanResponder Grant");
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          const { locationX, locationY } = evt.nativeEvent;
          const x = locationX || 0;
          const y = locationY || 0;
          const startPath = `M${x.toFixed(1)},${y.toFixed(1)}`;
          activePathRef.current = startPath;
          setCurrentPath(startPath);
        },
        onPanResponderMove: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          const x = locationX || 0;
          const y = locationY || 0;
          const newPoint = ` L${x.toFixed(1)},${y.toFixed(1)}`;
          activePathRef.current += newPoint;
          setCurrentPath(activePathRef.current);
        },
        onPanResponderRelease: () => {
          console.log("PanResponder Release, path length:", activePathRef.current.length);
          const finishedPath = activePathRef.current;
          // A valid path should have at least the 'M' and some movement
          if (finishedPath && finishedPath.length > 5) {
            setPaths((prev) => {
              console.log("Adding path to state, new count:", prev.length + 1);
              return [...prev, finishedPath];
            });
          }
          activePathRef.current = "";
          setCurrentPath("");
        },
        onPanResponderTerminate: () => {
          console.log("PanResponder Terminated");
          activePathRef.current = "";
          setCurrentPath("");
        },
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
      }),
    []
  );

  const handleClear = () => {
    playSound("click");
    setPaths([]);
    setCurrentPath("");
    activePathRef.current = "";
  };

  const handleNext = async () => {
    // Debug info
    console.log("Paths length:", paths.length);
    if (paths.length > 0) {
      console.log("First path length:", paths[0].length);
      console.log("First path content:", paths[0]);
    }

    // Basic completeness check
    if (paths.length === 0) {
      Speech.speak("Try tracing the " + (activeType === "letter" ? "letter" : "number") + " first!", { rate: 1.0 });
      return;
    }

    // Heuristic: Check if the drawing has a minimum size (not just a tiny dot)
    // Each point added is roughly 10-15 chars " Lxxx.x,yyy.y"
    // A reasonable stroke should have at least 3-4 points.
    const isReasonableEffort = paths.some(p => p.length > 30);

    if (!isReasonableEffort) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      safeSpeak("Keep going! Trace the whole shape.", { rate: 1.0 });
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    playSound("success");
    const selectedRemark = REMARKS[Math.floor(Math.random() * REMARKS.length)];
    setRemark(selectedRemark);
    setShowRemark(true);

    // Update writing count for scoreboard
    try {
      const savedCount = await AsyncStorage.getItem("@writing_count");
      const currentCount = (savedCount ? JSON.parse(savedCount) : 0) + 1;
      await AsyncStorage.setItem("@writing_count", JSON.stringify(currentCount));

      // Unlock a sticker every 5 characters
      if (currentCount % 5 === 0) {
        const savedStickers = await AsyncStorage.getItem("@unlocked_stickers");
        const unlockedStickers = savedStickers ? JSON.parse(savedStickers) : [];
        const stickerIndex = Math.floor((currentCount / 5) - 1) % STICKERS.length;
        const emoji = STICKERS[stickerIndex];

        if (!unlockedStickers.includes(emoji)) {
          const newStickers = [...unlockedStickers, emoji];
          await AsyncStorage.setItem("@unlocked_stickers", JSON.stringify(newStickers));
          setNewSticker(emoji);
          safeSpeak(`Wow! You earned a sticker!`, { rate: 1.0 });
        }
      }

      // Sync to cloud if user is logged in
      if (appUser?.uid) {
        syncAchievementsToCloud(appUser.uid, appUser.displayName, appUser.classId);
      }
    } catch (e) {
      console.error("Failed to update writing count", e);
    }

    // Announce success
    safeSpeak(selectedRemark, { rate: 1.0 });

    setTimeout(() => {
      setShowRemark(false);
      setIndex((i) => (i + 1) % filteredData.length);
      handleClear();
    }, 1500);
  };

  const renderSelection = () => (
    <View style={styles.selectionContainer}>
      <Text style={styles.selectionTitle}>Choose what to write!</Text>
      <View style={styles.selectionGrid}>
        <TouchableOpacity
          style={[styles.selectionCard, { backgroundColor: "#3B82F6" }]}
          onPress={() => {
            playSound("click");
            setActiveType("letter");
            setIndex(0);
          }}
        >
          <Text style={styles.selectionIcon}>ABC</Text>
          <Text style={styles.selectionText}>Letters</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.selectionCard, { backgroundColor: "#F59E0B" }]}
          onPress={() => {
            playSound("click");
            setActiveType("number");
            setIndex(0);
          }}
        >
          <Text style={styles.selectionIcon}>123</Text>
          <Text style={styles.selectionText}>Numbers</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!activeType) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onExit} style={styles.backBtn}>
            <SVGIcon name="close-circle" color="#fff" size={32} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Writing Fun!</Text>
          <View style={{ width: 32 }} />
        </View>
        {renderSelection()}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { playSound("click"); setActiveType(null); }} style={styles.backBtn}>
          <SVGIcon name="arrow-back" color="#fff" size={32} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Writing Fun! ✍️</Text>
        <TouchableOpacity onPress={() => {
           const text = activeType === "letter" ? `The letter ${currentTask.char}` : `The number ${currentTask.char}`;
           safeSpeak(text);
        }}>
          <SVGIcon name="volume-high" color="#fff" size={32} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.instruction}>
          Trace the {activeType}:
        </Text>

        <View style={styles.canvasContainer}>
          <View style={styles.ghostContainer} pointerEvents="none">
             <Text style={styles.ghostText}>{currentTask?.char}</Text>
             {paths.length === 0 && !currentPath && currentTask?.startPos && (
               <Animatable.View
                 animation="pulse"
                 iterationCount="infinite"
                 style={[
                   styles.startDot,
                   {
                     top: currentTask.startPos.top,
                     left: currentTask.startPos.left
                   }
                 ]}
               >
                 <SVGIcon
                    name="chevron-forward"
                    size={24}
                    color="#fff"
                    style={{
                      transform: [
                        { rotate: currentTask.dir === 'down' ? '90deg' :
                                  currentTask.dir === 'left' ? '180deg' :
                                  currentTask.dir === 'up' ? '270deg' : '0deg' }
                      ]
                    }}
                 />
               </Animatable.View>
             )}
          </View>

          <View
            {...panResponder.panHandlers}
            style={[styles.canvas, { backgroundColor: 'rgba(255, 255, 255, 0.01)' }]}
          >
            <Svg height={CANVAS_SIZE} width={CANVAS_SIZE} pointerEvents="none">
              {paths.map((p, i) => (
                <Path
                  key={i}
                  d={p}
                  fill="none"
                  stroke={penColor}
                  strokeWidth={14}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              {currentPath ? (
                <Path
                  d={currentPath}
                  fill="none"
                  stroke={penColor}
                  strokeWidth={14}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}
            </Svg>
          </View>
        </View>

        <View style={styles.palette}>
          {PEN_COLORS.map((color) => (
            <TouchableOpacity
              key={color}
              style={[
                styles.colorDot,
                { backgroundColor: color },
                penColor === color && styles.activeColorDot,
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setPenColor(color);
              }}
            />
          ))}
        </View>

        {showRemark && (
          <Animatable.View animation="bounceIn" style={styles.remarkContainer}>
            <Text style={styles.remarkText}>{remark}</Text>
          </Animatable.View>
        )}

        {newSticker && (
          <Animatable.View animation="zoomInUp" style={styles.stickerPopup}>
            <Text style={styles.stickerPopupLabel}>New Sticker! 🎉</Text>
            <Text style={styles.stickerPopupEmoji}>{newSticker}</Text>
            <TouchableOpacity
              style={styles.stickerCloseBtn}
              onPress={() => setNewSticker(null)}
            >
              <Text style={styles.stickerCloseText}>Yay! ✨</Text>
            </TouchableOpacity>
          </Animatable.View>
        )}

        <View style={styles.controls}>
          <TouchableOpacity style={styles.controlBtn} onPress={handleClear}>
            <SVGIcon name="trash" color="#fff" size={24} />
            <Text style={styles.controlBtnText}>Clear</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlBtn, styles.nextBtn]}
            onPress={handleNext}
          >
            <Text style={[styles.controlBtnText, { color: "#EC4899" }]}>
              Done! 🎉
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    marginTop: 10,
  },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 24, fontWeight: "900", color: "#fff" },
  selectionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  selectionTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#fff",
    marginBottom: 40,
    textAlign: "center",
  },
  selectionGrid: {
    flexDirection: "row",
    gap: 20,
  },
  selectionCard: {
    width: width * 0.4,
    height: width * 0.5,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.medium,
  },
  selectionIcon: {
    fontSize: 40,
    fontWeight: "900",
    color: "#fff",
    marginBottom: 10,
  },
  selectionText: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
  },
  content: { flex: 1, alignItems: "center" },
  instruction: {
    fontSize: 20,
    color: "#fff",
    fontWeight: "700",
    marginBottom: 20,
  },
  canvasContainer: {
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    backgroundColor: "#fff",
    borderRadius: 30,
    overflow: "hidden",
    ...SHADOWS.large,
    position: "relative",
  },
  ghostContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  startDot: {
    position: "absolute",
    width: 34,
    height: 34,
    backgroundColor: "#22C55E",
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
    ...SHADOWS.small,
  },
  ghostText: {
    fontSize: CANVAS_SIZE * 0.7,
    fontWeight: "900",
    color: "#F1F5F9",
    textAlign: "center",
  },
  canvas: {
    flex: 1,
    backgroundColor: "transparent",
  },
  remarkContainer: {
    position: "absolute",
    top: "40%",
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 50,
    ...SHADOWS.medium,
  },
  remarkText: {
    fontSize: 24,
    fontWeight: "900",
    color: "#EC4899",
  },
  stickerPopup: {
    position: "absolute",
    top: "25%",
    backgroundColor: "#fff",
    padding: 30,
    borderRadius: 40,
    alignItems: "center",
    ...SHADOWS.large,
    zIndex: 100,
    width: width * 0.7,
  },
  stickerPopupLabel: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1E293B",
    marginBottom: 10,
  },
  stickerPopupEmoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  stickerCloseBtn: {
    backgroundColor: "#EC4899",
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 20,
  },
  stickerCloseText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
  },
  palette: {
    flexDirection: "row",
    gap: 15,
    marginTop: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    padding: 10,
    borderRadius: 20,
  },
  colorDot: {
    width: 35,
    height: 35,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: "#fff",
  },
  activeColorDot: {
    transform: [{ scale: 1.2 }],
    borderColor: "#000",
  },
  controls: {
    flexDirection: "row",
    marginTop: 30,
    gap: 20,
    width: "100%",
    justifyContent: "center",
  },
  controlBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 25,
    paddingVertical: 15,
    borderRadius: 20,
    gap: 10,
  },
  nextBtn: {
    backgroundColor: "#fff",
  },
  controlBtnText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
  },
});
