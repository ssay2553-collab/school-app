import React from "react";
import { StyleSheet, Text, View } from "react-native";

export default function UnreadBadge({ count }: { count: number }) {
  if (!count || count <= 0) return null;
  const label = count > 99 ? "99+" : String(count);
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  text: { color: "#fff", fontSize: 11, fontWeight: "800" },
});
