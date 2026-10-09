import React from "react";
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../SVGIcon";
import UnreadBadge from "../UnreadBadge";
import { SHADOWS } from "../../constants/theme";

interface AdminMenuCardProps {
  item: {
    title: string;
    subtitle: string;
    route: string;
    icon: string;
    color: string;
  };
  index: number;
  cardWidth: number;
  isSmallScreen: boolean;
  numColumns: number;
  totalUnread: number;
  onPress: () => void;
}

const getGradientColors = (color: string): [string, string] => {
  if (!color) return ["#818CF8", "#4F46E5"];
  const c = color.toLowerCase();
  const map: Record<string, [string, string]> = {
    "#10b981": ["#34D399", "#059669"],
    "#f59e0b": ["#FBBF24", "#D97706"],
    "#6366f1": ["#818CF8", "#4F46E5"],
    "#ef4444": ["#F87171", "#DC2626"],
    "#8b5cf6": ["#A78BFA", "#7C3AED"],
    "#06b6d4": ["#22D3EE", "#0891B2"],
    "#f97316": ["#FB923C", "#EA580C"],
    "#a855f7": ["#C084FC", "#9333EA"],
    "#3b82f6": ["#60A5FA", "#2563EB"],
    "#f43f5e": ["#FB7185", "#E11D48"],
    "#a55eea": ["#C084FC", "#8854D0"],
    "#ffd93d": ["#FFE066", "#D9A000"],
  };
  return map[c] || [color, color];
};

export const AdminMenuCard: React.FC<AdminMenuCardProps> = ({
  item,
  index,
  cardWidth,
  isSmallScreen,
  numColumns,
  totalUnread,
  onPress,
}) => {
  const gradientColors = getGradientColors(item.color);

  return (
    <Animatable.View
      animation="bounceIn"
      duration={800}
      delay={index * 50}
      useNativeDriver={false}
      style={[styles.cardWrapper, { width: cardWidth }]}
    >
      <TouchableOpacity
        style={styles.menuCard}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardGradient}
        >
          <View
            style={[
              styles.iconBox,
              {
                width: isSmallScreen ? 44 : 50,
                height: isSmallScreen ? 44 : 50,
                borderRadius: isSmallScreen ? 14 : 16,
              },
            ]}
          >
            <SVGIcon
              name={item.icon}
              size={numColumns > 3 ? 24 : isSmallScreen ? 20 : 22}
              color="#FFFFFF"
            />
          </View>
          <View style={styles.cardInfo}>
            <Text
              style={[
                styles.menuText,
                { fontSize: isSmallScreen ? 13 : 15 },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {item.title}
            </Text>
            <View style={styles.subtitlePill}>
              <Text
                style={[
                  styles.menuSubtitle,
                  {
                    fontSize: isSmallScreen ? 9 : 10,
                  },
                ]}
                numberOfLines={1}
              >
                {item.subtitle}
              </Text>
            </View>
          </View>
          {item.route &&
            (String(item.route).includes("chat") ||
              String(item.route).includes("group")) &&
            totalUnread > 0 ? (
              <View style={styles.badgePos}>
                <UnreadBadge count={totalUnread} />
              </View>
            ) : null}
        </LinearGradient>
      </TouchableOpacity>
    </Animatable.View>
  );
};

const styles = StyleSheet.create({
  cardWrapper: { marginBottom: 12 },
  menuCard: {
    borderRadius: 22,
    overflow: "hidden",
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    borderBottomWidth: 4,
    borderBottomColor: "rgba(0,0,0,0.18)",
    minHeight: 115,
    width: "100%",
    ...Platform.select({
      web: { cursor: 'pointer', transition: 'transform 0.15s ease' } as any,
      default: {}
    }),
  },
  cardGradient: {
    flex: 1,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBox: {
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    ...SHADOWS.small,
  },
  cardInfo: { alignItems: "center" },
  menuText: {
    fontWeight: "900",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  subtitlePill: {
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  menuSubtitle: {
    color: "rgba(255,255,255,0.95)",
    fontWeight: "700",
    textAlign: "center",
  },
  badgePos: { position: "absolute", top: 12, right: 12 },
});
