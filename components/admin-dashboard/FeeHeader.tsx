import React from "react";
import { View, Text, TouchableOpacity, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import SVGIcon from "../SVGIcon";
import { styles } from "../../constants/admin-dashboard/ManageFeesStyles";

interface FeeHeaderProps {
  primaryBrand: string;
  secondaryBrand: string;
  headerHeight: Animated.AnimatedInterpolation<number>;
  selectorGridOpacity: Animated.AnimatedInterpolation<number>;
  selectorGridHeight: Animated.AnimatedInterpolation<number>;
  onBack: () => void;
  onSelectClass: () => void;
  selectedClassId: string;
  classes: { id: string; name: string }[];
  academicYear: string;
  term: string;
}

export const FeeHeader: React.FC<FeeHeaderProps> = ({
  primaryBrand,
  secondaryBrand,
  headerHeight,
  selectorGridOpacity,
  selectorGridHeight,
  onBack,
  onSelectClass,
  selectedClassId,
  classes,
  academicYear,
  term,
}) => {
  return (
    <Animated.View style={styles.header}>
      <LinearGradient
        colors={[primaryBrand, secondaryBrand]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerTop, { minHeight: headerHeight }]}
      >
        <View style={styles.navBar}>
          <TouchableOpacity onPress={onBack} style={styles.headerIconBtn} activeOpacity={0.7}>
            <SVGIcon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.titleCenter}>
            <Text style={styles.headerTitle}>Finance Central</Text>
            <Text style={styles.headerSub}>ADMINISTRATION</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>
        <Animated.View
          style={[
            styles.selectorGrid,
            {
              opacity: selectorGridOpacity,
              height: selectorGridHeight,
              overflow: "hidden",
            },
          ]}
        >
          <TouchableOpacity style={styles.glassPill} onPress={onSelectClass} activeOpacity={0.8}>
            <Text style={styles.glassLabel}>TARGET CLASS</Text>
            <Text style={styles.glassValue} numberOfLines={1}>
              {selectedClassId === "all"
                ? "All Classes"
                : classes.find((c) => c.id === selectedClassId)?.name ||
                  "Select Class"}
            </Text>
          </TouchableOpacity>
          <View style={styles.glassPill}>
            <Text style={styles.glassLabel}>ACADEMIC YEAR</Text>
            <Text style={styles.glassValue}>{academicYear || "Not Set"}</Text>
          </View>
          <View style={styles.glassPill}>
            <Text style={styles.glassLabel}>TERM</Text>
            <Text style={styles.glassValue}>{term || "Not Set"}</Text>
          </View>
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  );
};
