import React from "react";
import { StyleSheet, Text, TouchableOpacity, View, Platform } from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../../constants/theme";

interface BulkActionBarProps {
  selectedCount: number;
  onCancel: () => void;
  onBulkUpdate: (field: string, value: any) => void;
  onClearArrears: () => void;
  onPromoteRepeat: () => void;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  onCancel,
  onBulkUpdate,
  onClearArrears,
  onPromoteRepeat,
}) => {
  if (selectedCount === 0) return null;

  return (
    <Animatable.View
      animation="slideInUp"
      style={styles.bulkActionBar}
      useNativeDriver={false}
    >
      <View style={styles.bulkActionInfo}>
        <Text style={styles.bulkActionCount}>{selectedCount} Selected</Text>
        <TouchableOpacity onPress={onCancel} activeOpacity={0.7}>
          <Text style={styles.bulkActionCancel}>Cancel</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.bulkActionButtons}>
        <TouchableOpacity
          style={styles.bulkActionBtn}
          onPress={() => onBulkUpdate("isFeeding", true)}
        >
          <SVGIcon name="restaurant" size={20} color="#fff" />
          <Text style={styles.bulkActionText}>Feeding</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.bulkActionBtn}
          onPress={() => onBulkUpdate("takesBus", true)}
        >
          <SVGIcon name="bus" size={20} color="#fff" />
          <Text style={styles.bulkActionText}>Bus</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.bulkActionBtn}
          onPress={() => onBulkUpdate("takesExtraClasses", true)}
        >
          <SVGIcon name="book" size={20} color="#fff" />
          <Text style={styles.bulkActionText}>Extra</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.bulkActionBtn}
          onPress={onClearArrears}
        >
          <SVGIcon name="refresh-circle" size={20} color="#fff" />
          <Text style={styles.bulkActionText}>Clear Arrears</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.bulkActionBtn}
          onPress={() => onBulkUpdate("onDiscount", true)}
        >
          <SVGIcon name="pricetag" size={20} color="#fff" />
          <Text style={styles.bulkActionText}>Discount</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bulkActionBtn, { backgroundColor: COLORS.secondary }]}
          onPress={onPromoteRepeat}
        >
          <SVGIcon name="trending-up" size={20} color="#fff" />
          <Text style={styles.bulkActionText}>Promote</Text>
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
    backgroundColor: "#1E293B",
    borderRadius: 20,
    padding: 16,
    ...SHADOWS.large,
  },
  bulkActionInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  bulkActionCount: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
  bulkActionCancel: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "700",
  },
  bulkActionButtons: {
    flexDirection: "row",
    gap: 10,
  },
  bulkActionBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
      default: {}
    }),
  },
  bulkActionText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
});
