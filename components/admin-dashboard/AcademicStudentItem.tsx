import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../SVGIcon";
import { ScoreData } from "../../hooks/admin-dashboard/useViewAcademicRecords";

interface AcademicStudentItemProps {
  item: ScoreData;
  onPress: () => void;
  onEditMetadata: () => void;
  primary: string;
}

export const AcademicStudentItem = React.memo(
  ({
    item,
    onPress,
    onEditMetadata,
    primary,
  }: AcademicStudentItemProps) => (
    <Animatable.View
      animation="fadeInUp"
      duration={400}
      style={styles.studentCard}
    >
      <TouchableOpacity
        style={styles.cardInner}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={[styles.posBadge, { backgroundColor: primary + "10" }]}>
          <Text style={[styles.posText, { color: primary }]}>
            #{item.position}
          </Text>
        </View>
        <View style={{ flex: 1, marginLeft: 15 }}>
          <Text style={styles.name}>{item.fullName}</Text>
          <Text style={styles.idSub}>ID: {item.studentId.substring(0, 8)}</Text>
          {item.teacherRemarks ? (
            <Text style={styles.remarkPreview} numberOfLines={1}>
              Teacher: {item.teacherRemarks}
            </Text>
          ) : null}
        </View>
        <View style={styles.scoreInfo}>
          <Text style={[styles.score, { color: primary }]}>{item.total}</Text>
          <View style={[styles.gradeBadge, { backgroundColor: "#f1f5f9" }]}>
            <Text style={styles.gradeText}>{item.grade}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.editBtn} onPress={onEditMetadata}>
          <SVGIcon name="create-outline" color={primary} size={22} />
        </TouchableOpacity>
        <SVGIcon name="chevron-forward" color="#CBD5E1" size={18} />
      </TouchableOpacity>
    </Animatable.View>
  ),
);

AcademicStudentItem.displayName = "AcademicStudentItem";

const styles = StyleSheet.create({
  studentCard: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 18,
    elevation: 2,
    ...Platform.select({
      web: { boxShadow: "0 2px 15px rgba(0,0,0,0.05)" },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 15,
      }
    })
  },
  cardInner: { flexDirection: "row", alignItems: "center", padding: 15 },
  posBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  posText: { fontSize: 16, fontWeight: "900" },
  name: { fontSize: 15, fontWeight: "800", color: "#1E293B" },
  idSub: { fontSize: 11, color: "#94A3B8", marginTop: 2, fontWeight: "600" },
  remarkPreview: {
    fontSize: 10,
    color: "#64748B",
    marginTop: 4,
    fontStyle: "italic",
  },
  scoreInfo: { alignItems: "flex-end", marginRight: 15 },
  score: { fontSize: 17, fontWeight: "900" },
  gradeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  gradeText: { fontSize: 10, fontWeight: "800", color: "#64748B" },
  editBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
});
