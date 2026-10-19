import React from "react";
import {
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../SVGIcon";
import UnreadBadge from "../UnreadBadge";

interface MetroTileProps {
  item: {
    title: string;
    subtitle: string;
    route: string;
    icon: string;
    color: string;
    isWide?: boolean;
  };
  index: number;
  tileWidth: number;
  tileHeight: number;
  totalUnread?: number;
  onPress: () => void;
}

export const MetroTile: React.FC<MetroTileProps> = React.memo(
  ({ item, index, tileWidth, tileHeight, totalUnread = 0, onPress }) => {
    const shouldAnimate = Platform.OS !== "web";
    const TileWrapper = shouldAnimate ? Animatable.View : View;

    return (
      <TileWrapper
        animation={shouldAnimate ? "fadeInUp" : undefined}
        duration={shouldAnimate ? 350 : undefined}
        delay={shouldAnimate ? index * 30 : undefined}
        useNativeDriver={shouldAnimate ? false : undefined}
        style={[styles.tileWrapper, { width: tileWidth, height: tileHeight }]}
      >
        <TouchableOpacity
          style={[styles.tile, { backgroundColor: item.color }]}
          onPress={onPress}
          activeOpacity={0.85}
        >
          {/* Windows 8 Accent Line */}
          <View style={styles.tileTopHighlight} />

          {/* Icon */}
          <View
            style={
              item.isWide
                ? styles.wideIconContainer
                : styles.squareIconContainer
            }
          >
            <SVGIcon
              name={item.icon}
              size={item.isWide ? 32 : 26}
              color="#FFFFFF"
            />
          </View>

          {/* Live Badge for Messages/Chats */}
          {item.route &&
          (String(item.route).includes("chat") ||
            String(item.route).includes("group")) &&
          totalUnread > 0 ? (
            <View style={styles.badgePos}>
              <UnreadBadge count={totalUnread} />
            </View>
          ) : null}

          {/* Bottom Text Label */}
          <View style={styles.textContainer}>
            <Text style={styles.tileTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.tileSubtitle} numberOfLines={1}>
              {item.subtitle}
            </Text>
          </View>
        </TouchableOpacity>
      </TileWrapper>
    );
  },
);

const styles = StyleSheet.create({
  tileWrapper: {
    marginBottom: 10,
  },
  tile: {
    flex: 1,
    borderRadius: 6, // Windows 8 Metro subtle rounding
    padding: 12,
    justifyContent: "space-between",
    position: "relative",
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    ...Platform.select({
      web: { cursor: "pointer", transition: "all 0.15s ease-in-out" } as any,
      default: {},
    }),
  },
  tileTopHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "rgba(255, 255, 255, 0.35)",
  },
  squareIconContainer: {
    alignSelf: "flex-start",
    marginTop: 2,
  },
  wideIconContainer: {
    alignSelf: "flex-end",
    marginTop: 2,
    marginRight: 2,
  },
  textContainer: {
    marginTop: "auto",
  },
  tileTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  tileSubtitle: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  badgePos: {
    position: "absolute",
    top: 8,
    right: 8,
  },
});
