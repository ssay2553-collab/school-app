import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Animatable from "react-native-animatable";
import { COLORS, SHADOWS } from "../../constants/theme";
import SVGIcon from "../SVGIcon";

interface BulkActionBarProps {
  selectedCount: number;
  onCancel: () => void;
  onPromote: () => void;
  onRepeat: () => void;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  onCancel,
  onPromote,
  onRepeat,
}) => {
  if (selectedCount === 0) return null;

  return (
    <Animatable.View animation="slideInUp" style={styles.bulkActionBar}>
      <View style={styles.bulkActionInfo}>
        <Text style={styles.bulkActionCount}>{selectedCount} Selected</Text>
        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.bulkActionCancel}>Cancel</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.bulkActionButtons}>
        <TouchableOpacity
          style={[styles.bulkActionBtn, { backgroundColor: COLORS.success }]}
          onPress={onPromote}
        >
          <SVGIcon name="school" size={20} color="#fff" />
          <Text style={styles.bulkActionText}>Promote</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bulkActionBtn, { backgroundColor: COLORS.danger }]}
          onPress={onRepeat}
        >
          <SVGIcon name="refresh" size={20} color="#fff" />
          <Text style={styles.bulkActionText}>Repeat</Text>
        </TouchableOpacity>
      </View>
    </Animatable.View>
  );
};

const styles = StyleSheet.create({
  bulkActionBar: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: "#1e293b",
    borderRadius: 20,
    padding: 16,
    ...SHADOWS.medium,
  },
  bulkActionInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  bulkActionCount: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
  },
  bulkActionCancel: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "600",
  },
  bulkActionButtons: {
    flexDirection: "row",
    gap: 10,
  },
  bulkActionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  bulkActionText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
});
