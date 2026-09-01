import React from "react";
import { View, TouchableOpacity, Text } from "react-native";
import SVGIcon from "../SVGIcon";
import { VIBE, styles } from "../../constants/admin-dashboard/ManageFeesStyles";

interface FeeModeTabsProps {
  activeMode: "payment" | "billing" | "discounts";
  setActiveMode: (mode: "payment" | "billing" | "discounts") => void;
}

export const FeeModeTabs: React.FC<FeeModeTabsProps> = ({
  activeMode,
  setActiveMode,
}) => {
  return (
    <View style={styles.modeToggleArea}>
      <View style={styles.modeTabs}>
        <TouchableOpacity
          style={[
            styles.modeTab,
            activeMode === "payment" && styles.activeModeTab,
          ]}
          activeOpacity={0.7}
          onPress={() => setActiveMode("payment")}
        >
          <SVGIcon
            name="cash"
            size={18}
            color={activeMode === "payment" ? "#fff" : VIBE.muted}
          />
          <Text
            style={[
              styles.modeTabText,
              activeMode === "payment" && { color: "#fff" },
            ]}
          >
            PAYMENTS
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.modeTab,
            activeMode === "billing" && styles.activeModeTab,
          ]}
          activeOpacity={0.7}
          onPress={() => setActiveMode("billing")}
        >
          <SVGIcon
            name="document-text"
            size={18}
            color={activeMode === "billing" ? "#fff" : VIBE.muted}
          />
          <Text
            style={[
              styles.modeTabText,
              activeMode === "billing" && { color: "#fff" },
            ]}
          >
            BILLING
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.modeTab,
            activeMode === "discounts" && styles.activeModeTab,
          ]}
          activeOpacity={0.7}
          onPress={() => setActiveMode("discounts")}
        >
          <SVGIcon
            name="pricetag"
            size={18}
            color={activeMode === "discounts" ? "#fff" : VIBE.muted}
          />
          <Text
            style={[
              styles.modeTabText,
              activeMode === "discounts" && { color: "#fff" },
            ]}
          >
            DISCOUNTS
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
