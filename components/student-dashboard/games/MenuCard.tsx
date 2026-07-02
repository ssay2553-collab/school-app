import React from "react";
import {
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
} from "react-native";
import SVGIcon from "../../SVGIcon";
import { SHADOWS } from "../../../constants/theme";

const { width } = Dimensions.get("window");

interface MenuCardProps {
  title: string;
  icon: string;
  color: string;
  onPress: () => void;
}

export const MenuCard: React.FC<MenuCardProps> = ({ title, icon, color, onPress }) => (
  <TouchableOpacity
    style={[styles.menuCard, { backgroundColor: color }]}
    onPress={onPress}
  >
    <SVGIcon name={icon} size={32} color="#fff" />
    <Text style={styles.menuCardTitle}>{title}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  menuCard: {
    width: (width - 60) / 2,
    height: 140,
    borderRadius: 25,
    padding: 20,
    marginBottom: 20,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.small,
  },
  menuCardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
    marginTop: 12,
    textAlign: "center",
  },
});
