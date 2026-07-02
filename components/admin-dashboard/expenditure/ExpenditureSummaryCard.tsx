import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as Animatable from 'react-native-animatable';
import { SHADOWS } from '../../../constants/theme';
import { GroupedExpenditure } from '../../../constants/admin-dashboard/ExpenditureConstants';

interface ExpenditureSummaryCardProps {
  item: GroupedExpenditure;
  index: number;
  summaryTotal: number;
  primaryBrand: string;
  secondaryBrand: string;
}

export const ExpenditureSummaryCard: React.FC<ExpenditureSummaryCardProps> = ({
  item,
  index,
  summaryTotal,
  primaryBrand,
  secondaryBrand,
}) => {
  return (
    <Animatable.View
      animation="fadeInUp"
      duration={400}
      delay={index * 50}
      style={styles.summaryCard}
    >
      <View style={styles.summaryCardHeader}>
        <View style={styles.summaryItemInfo}>
          <Text style={styles.summaryItemName}>{item.displayItem}</Text>
          <Text style={styles.summaryItemCount}>
            {item.count} transaction{item.count !== 1 ? "s" : ""}
          </Text>
        </View>
        <View style={styles.summaryAmounts}>
          <View style={styles.summaryAmountRow}>
            <Text style={styles.summaryAmountLabel}>This Month:</Text>
            <Text style={styles.summaryMonthAmount}>
              ₵
              {item.monthTotal.toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </Text>
          </View>
          <View style={styles.summaryAmountRow}>
            <Text style={styles.summaryAmountLabel}>This Term:</Text>
            <Text style={styles.summaryTermAmount}>
              ₵
              {item.termTotal.toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </Text>
          </View>
        </View>
      </View>
      {/* Progress bar showing proportion of term total */}
      {summaryTotal > 0 && (
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${Math.max((item.termTotal / summaryTotal) * 100, 2)}%`,
                backgroundColor:
                  index % 2 === 0 ? primaryBrand : secondaryBrand,
              },
            ]}
          />
        </View>
      )}
    </Animatable.View>
  );
};

const styles = StyleSheet.create({
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...SHADOWS.small,
  },
  summaryCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  summaryItemInfo: {
    flex: 1,
  },
  summaryItemName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    textTransform: "capitalize",
  },
  summaryItemCount: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  summaryAmounts: {
    alignItems: "flex-end",
  },
  summaryAmountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  summaryAmountLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
  },
  summaryMonthAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#059669",
  },
  summaryTermAmount: {
    fontSize: 16,
    fontWeight: "800",
    color: "#2e86de",
  },
  progressBarContainer: {
    marginTop: 12,
    height: 4,
    backgroundColor: "#E2E8F0",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 2,
  },
});
