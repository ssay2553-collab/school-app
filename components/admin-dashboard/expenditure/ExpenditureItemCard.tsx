import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as Animatable from 'react-native-animatable';
import SVGIcon from '../../SVGIcon';
import { COLORS, SHADOWS } from '../../../constants/theme';
import { Expenditure } from '../../../constants/admin-dashboard/ExpenditureConstants';

interface ExpenditureItemCardProps {
  item: Expenditure;
  canEdit: boolean;
  deletingId: string | null;
  onDelete: (item: Expenditure) => void;
}

export const ExpenditureItemCard: React.FC<ExpenditureItemCardProps> = ({
  item,
  canEdit,
  deletingId,
  onDelete,
}) => {
  return (
    <Animatable.View
      animation="fadeInUp"
      duration={400}
      style={styles.card}
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          {item.category ? (
            <Text style={styles.categoryBadgeText}>
              {item.category.toUpperCase()}
              {item.subCategory ? ` • ${item.subCategory.toUpperCase()}` : ""}
            </Text>
          ) : null}
          <Text style={styles.itemTitle}>
            {item.item || "Unnamed Expense"}
          </Text>
          <View style={styles.dateRow}>
            <SVGIcon
              name="calendar"
              size={12}
              color={COLORS.gray || "#9ca3af"}
            />
            <Text style={styles.dateText}>{item.date || "N/A"}</Text>
          </View>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 15,
          }}
        >
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.itemAmount}>
              ₵
              {(item.amount || 0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </Text>
            <View style={styles.adminBadge}>
              <Text style={styles.adminText}>
                {item.adminName} • {item.adminRole}
              </Text>
            </View>
          </View>
          {canEdit && (
            <TouchableOpacity
              onPress={() => onDelete(item)}
              style={styles.deleteBtn}
              disabled={deletingId === item.id}
            >
              {deletingId === item.id ? (
                <ActivityIndicator size="small" color="#EF4444" />
              ) : (
                <SVGIcon
                  name="trash-outline"
                  size={20}
                  color="#EF4444"
                />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animatable.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    ...SHADOWS.small,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemTitle: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  dateRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  dateText: { fontSize: 12, color: "#64748B", marginLeft: 4 },
  itemAmount: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.primary || "#2e86de",
  },
  adminBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  adminText: { fontSize: 10, color: "#64748B", fontWeight: "600" },
  deleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
  },
});
