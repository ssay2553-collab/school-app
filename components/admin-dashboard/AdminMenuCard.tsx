import React from "react";
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
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

export const AdminMenuCard: React.FC<AdminMenuCardProps> = ({
  item,
  index,
  cardWidth,
  isSmallScreen,
  numColumns,
  totalUnread,
  onPress,
}) => {
  return (
    <Animatable.View
      animation="bounceIn"
      duration={800}
      delay={index * 50}
      style={[styles.cardWrapper, { width: cardWidth }]}
    >
      <TouchableOpacity
        style={[styles.menuCard, { borderBottomColor: "rgba(0,0,0,0.1)" }]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[item.color, item.color]}
          style={styles.cardGradient}
        >
          <View
            style={[
              styles.iconBox,
              {
                backgroundColor: "rgba(255,255,255,0.2)",
                width: isSmallScreen ? 50 : 60,
                height: isSmallScreen ? 50 : 60,
                borderRadius: isSmallScreen ? 18 : 22,
              },
            ]}
          >
            <SVGIcon
              name={item.icon}
              size={numColumns > 3 ? 36 : isSmallScreen ? 26 : 30}
              color="#FFFFFF"
            />
          </View>
          <View style={styles.cardInfo}>
            <Text
              style={[
                styles.menuText,
                { fontSize: isSmallScreen ? 13 : 15, color: "#FFFFFF" },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {item.title}
            </Text>
            <Text
              style={[
                styles.menuSubtitle,
                {
                  color: "rgba(255,255,255,0.8)",
                  fontSize: isSmallScreen ? 9 : 10,
                },
              ]}
              numberOfLines={1}
            >
              {item.subtitle}
            </Text>
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
  cardWrapper: { marginBottom: 10 },
  menuCard: {
    borderRadius: 24,
    overflow: "hidden",
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    borderBottomWidth: 4,
    minHeight: 130,
    width: "100%",
  },
  cardGradient: {
    flex: 1,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBox: {
    width: 65,
    height: 65,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  cardInfo: { alignItems: "center" },
  menuText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1E293B",
    textAlign: "center",
  },
  menuSubtitle: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: "hidden",
  },
  badgePos: { position: "absolute", top: 15, right: 15 },
});
