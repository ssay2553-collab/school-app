import React from "react";
import { View, Text, StyleSheet } from "react-native";
import SVGIcon from "../SVGIcon";
import { SHADOWS } from "../../constants/theme";

interface EditScoresStatsProps {
  stats: {
    avg: string;
    graded: number;
    high: string;
  };
  totalStudents: number;
  primary: string;
}

export const EditScoresStats = React.memo(({ stats, totalStudents, primary }: EditScoresStatsProps) => {
  return (
    <View style={styles.container}>
      <StatCard
        label="Class Average"
        value={stats.avg}
        icon="analytics"
        color={primary}
      />
      <StatCard
        label="Highest Score"
        value={stats.high}
        icon="trending-up"
        color="#10B981"
      />
      <StatCard
        label="Graded"
        value={`${stats.graded}/${totalStudents}`}
        icon="checkmark-circle"
        color="#F59E0B"
      />
    </View>
  );
});

const StatCard = ({ label, value, icon, color }: any) => (
  <View style={styles.card}>
    <View style={[styles.iconBox, { backgroundColor: color + "15" }]}>
      <SVGIcon name={icon} size={20} color={color} />
    </View>
    <View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  card: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    ...SHADOWS.small,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  statLabel: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1e293b",
  },
});
