import React, { memo } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import SVGIcon from "../SVGIcon";
import { SHADOWS } from "../../constants/theme";
import { VIBE } from "./FeedingFeeConstants";

const { width } = Dimensions.get("window");

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  isCurrency?: boolean;
}

const StatsCard = memo(({ title, value, icon, color, isCurrency = true }: StatsCardProps) => (
  <View
    style={[
      styles.statsCard,
      { borderLeftColor: color, backgroundColor: VIBE.surface },
    ]}
  >
    <View style={[styles.statsIconBox, { backgroundColor: color + "15" }]}>
      <SVGIcon name={icon} size={20} color={color} />
    </View>
    <View style={styles.statsInfo}>
      <Text style={styles.statsLabel}>{title}</Text>
      <Text style={[styles.statsValue, { color: VIBE.text }]}>
        {isCurrency ? `₵${Number(value).toFixed(2)}` : value}
      </Text>
    </View>
  </View>
));

interface FeedingFeeStatsProps {
  totalFeeding: number;
  recordsCount: number;
}

export const FeedingFeeStats = memo(({ totalFeeding, recordsCount }: FeedingFeeStatsProps) => {
  return (
    <View style={styles.statsRow}>
      <StatsCard
        title="Total Feeding"
        value={totalFeeding}
        icon="restaurant"
        color={VIBE.success}
      />
      <StatsCard
        title="Students Recorded"
        value={recordsCount}
        icon="people"
        color={VIBE.primary}
        isCurrency={false}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    padding: 16,
  },
  statsCard: {
    flex: 1,
    minWidth: width < 380 ? "100%" : 150,
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 20,
    borderLeftWidth: 5,
    backgroundColor: VIBE.surface,
    ...SHADOWS.small,
  },
  statsIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  statsInfo: { flex: 1 },
  statsLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: VIBE.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statsValue: {
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2,
  },
});
