import React from "react";
import { ScrollView, View, Text } from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../SVGIcon";
import { VIBE, styles } from "../../constants/admin-dashboard/ManageFeesStyles";

interface FeeStatsDashboardProps {
  stats: {
    expected: number;
    received: number;
    totalDiscount: number;
    balance: number;
  };
  activeMode: "billing" | "payment" | "discounts";
  studentsCount: number;
  searchQuery: string;
  totalProfileDiscountsSum: number;
  filteredStudentsCount: number;
}

export const FeeStatsDashboard: React.FC<FeeStatsDashboardProps> = ({
  stats,
  activeMode,
  studentsCount,
  searchQuery,
  totalProfileDiscountsSum,
  filteredStudentsCount,
}) => {
  if (activeMode === "payment" && studentsCount > 0 && !searchQuery) {
    return (
      <View style={{ zIndex: 10 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsDashboard}
        >
          <Animatable.View
            animation="zoomIn"
            style={[styles.statBox, { backgroundColor: VIBE.info }]}
          >
            <Text style={styles.statLabel}>EXPECTED</Text>
            <Text style={styles.statValue}>
              ₵{stats.expected.toLocaleString()}
            </Text>
            <View style={styles.statIcon}>
              <SVGIcon
                name="analytics"
                size={24}
                color="rgba(255,255,255,0.3)"
              />
            </View>
          </Animatable.View>
          <Animatable.View
            animation="zoomIn"
            delay={100}
            style={[styles.statBox, { backgroundColor: VIBE.success }]}
          >
            <Text style={styles.statLabel}>RECEIVED</Text>
            <Text style={styles.statValue}>
              ₵{stats.received.toLocaleString()}
            </Text>
            <View style={styles.statIcon}>
              <SVGIcon
                name="wallet"
                size={24}
                color="rgba(255,255,255,0.3)"
              />
            </View>
          </Animatable.View>
          <Animatable.View
            animation="zoomIn"
            delay={150}
            style={[styles.statBox, { backgroundColor: VIBE.purple }]}
          >
            <Text style={styles.statLabel}>DISCOUNTS</Text>
            <Text style={styles.statValue}>
              ₵{stats.totalDiscount.toLocaleString()}
            </Text>
            <View style={styles.statIcon}>
              <SVGIcon
                name="pricetag"
                size={24}
                color="rgba(255,255,255,0.3)"
              />
            </View>
          </Animatable.View>
          <Animatable.View
            animation="zoomIn"
            delay={200}
            style={[styles.statBox, { backgroundColor: VIBE.danger }]}
          >
            <Text style={styles.statLabel}>OUTSTANDING</Text>
            <Text style={styles.statValue}>
              ₵{stats.balance.toLocaleString()}
            </Text>
            <View style={styles.statIcon}>
              <SVGIcon
                name="alert-circle"
                size={24}
                color="rgba(255,255,255,0.3)"
              />
            </View>
          </Animatable.View>
        </ScrollView>
      </View>
    );
  }

  if (activeMode === "discounts" && filteredStudentsCount > 0) {
    return (
      <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
        <Animatable.View
          animation="fadeInDown"
          style={[
            styles.statBox,
            {
              backgroundColor: VIBE.success,
              width: "100%",
              height: 90,
              borderRadius: 20,
            },
          ]}
        >
          <Text style={styles.statLabel}>TOTAL APPLIED DISCOUNTS (LISTED)</Text>
          <Text style={[styles.statValue, { fontSize: 24 }]}>
            ₵
            {totalProfileDiscountsSum.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </Text>
          <View style={styles.statIcon}>
            <SVGIcon
              name="pricetag"
              size={28}
              color="rgba(255,255,255,0.3)"
            />
          </View>
        </Animatable.View>
      </View>
    );
  }

  return null;
};
