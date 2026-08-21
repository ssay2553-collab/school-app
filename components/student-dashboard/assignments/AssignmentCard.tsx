import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Animatable from "react-native-animatable";
import { COLORS, SHADOWS } from "../../../constants/theme";
import SVGIcon from "../../SVGIcon";
import { Assignment } from "../../../types/assignments";
import { Timestamp } from "firebase/firestore";
import moment from "moment";

interface AssignmentCardProps {
  item: Assignment;
  index: number;
  onStart: (item: Assignment) => void;
}

const AssignmentCard = ({ item, index, onStart }: AssignmentCardProps) => {
  const assignmentType = item.type;
  const isPreschool = assignmentType === 'preschool';
  const isMathematics = assignmentType === 'mathematics';

  const formatDate = (ts?: Timestamp) => {
    if (!ts) return "Soon";
    try {
      return moment(ts.toDate()).format("MMM DD, YYYY");
    } catch (e) {
      return "Soon";
    }
  };

  return (
    <Animatable.View animation="fadeInUp" delay={index * 100} style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.title}>{item.title}</Text>
        <View style={[
          styles.typeBadge,
          { backgroundColor: isPreschool ? '#FEF3C7' : isMathematics ? '#E0F2FE' : '#F0FDF4' }
        ]}>
          <Text style={[
            styles.typeText,
            { color: isPreschool ? '#D97706' : isMathematics ? '#0284C7' : '#10B981' }
          ]}>
            {assignmentType.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.detailsRow}>
        <View style={styles.infoRow}>
          <SVGIcon name="library" size={14} color={COLORS.primary} />
          <Text style={styles.infoText}>{item.subjectId}</Text>
        </View>
        <View style={styles.infoRow}>
          <SVGIcon name="calendar" size={14} color="#94A3B8" />
          <Text style={styles.infoText}>Due: {formatDate(item.dueDate)}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: COLORS.secondary }]}
        onPress={() => onStart(item)}
      >
        <Text style={styles.actionButtonText}>
          Start Now
        </Text>
        <SVGIcon name="arrow-forward" size={16} color="#fff" />
      </TouchableOpacity>
    </Animatable.View>
  );
};

export default AssignmentCard;

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 20, marginBottom: 15, ...SHADOWS.small, borderWidth: 1, borderColor: '#F1F5F9' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '800', color: '#1E293B', flex: 1, marginRight: 10 },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  typeText: { fontSize: 10, fontWeight: '900' },
  detailsRow: { flexDirection: 'row', gap: 20, marginBottom: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 14, gap: 10 },
  actionButtonText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
