import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import SVGIcon from "../SVGIcon";
import { COLORS, SIZES, SHADOWS } from "../../constants/theme";

export interface StudentData {
  uid: string;
  profile: {
    firstName: string;
    lastName: string;
    email?: string;
    studentID?: string;
    phone?: string;
    emergencyPhone?: string;
    parentPhone?: string;
  };
  classId: string;
  dateOfBirth?: any;
  parentUids?: string[];
  parents?: Array<{
    uid: string;
    firstName: string;
    lastName: string;
    phone: string;
  }>;
}

interface StudentCardProps {
  item: StudentData;
  isSelected: boolean;
  isSelectionActive: boolean;
  canUpdate: boolean;
  isLargeScreen: boolean;
  onPress: (item: StudentData) => void;
  onLongPress: (item: StudentData) => void;
  onEditProfile: (item: StudentData) => void;
  onEditEmail: (item: StudentData) => void;
  onPromote: (item: StudentData) => void;
}

export const StudentCard: React.FC<StudentCardProps> = ({
  item,
  isSelected,
  isSelectionActive,
  canUpdate,
  isLargeScreen,
  onPress,
  onLongPress,
  onEditProfile,
  onEditEmail,
  onPromote,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.itemCard,
        isLargeScreen && { flex: 1, marginBottom: 0 },
        isSelected && styles.itemCardSelected,
      ]}
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress(item)}
    >
      {isSelectionActive && (
        <View style={styles.selectionIndicator}>
          <SVGIcon
            name={isSelected ? "checkbox" : "square-outline"}
            size={20}
            color={isSelected ? COLORS.primary : COLORS.gray}
          />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.itemTitle}>
          {`${item.profile.firstName} ${item.profile.lastName}`}
        </Text>
        <Text style={styles.itemSubtitle}>
          ID: {item.profile.studentID || "N/A"}
        </Text>
        {item.profile.emergencyPhone ? (
          <Text style={styles.parentInfo}>
            <SVGIcon name="alert-circle" size={10} color={COLORS.danger} /> Emergency: {item.profile.emergencyPhone}
          </Text>
        ) : null}
        {item.profile.parentPhone ? (
          <Text style={styles.parentInfo}>
            <SVGIcon name="call" size={10} color={COLORS.primary} /> Parent: {item.profile.parentPhone}
          </Text>
        ) : null}
        {item.parents && item.parents.length > 0 ? (
          item.parents.map((p, idx) => (
            <Text key={idx} style={styles.parentInfo}>
              <SVGIcon name="call" size={10} color={COLORS.gray} /> {p.firstName} {p.lastName}: {p.phone}
            </Text>
          ))
        ) : (
          <Text style={[styles.parentInfo, { color: COLORS.danger }]}>
            No parent contact linked
          </Text>
        )}
      </View>
      {canUpdate && !isSelectionActive && (
        <View style={styles.actionIcons}>
          <TouchableOpacity
            onPress={() => onEditProfile(item)}
            style={styles.iconBtn}
          >
            <SVGIcon name="person" size={18} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onEditEmail(item)}
            style={styles.iconBtn}
          >
            <SVGIcon name="mail" size={18} color={COLORS.secondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onPromote(item)}
            style={styles.iconBtn}
          >
            <SVGIcon name="swap-horizontal" size={18} color={COLORS.gray} />
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  itemCard: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: SIZES.radius,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    ...SHADOWS.light,
  },
  itemCardSelected: {
    borderColor: COLORS.primary,
    borderWidth: 1,
    backgroundColor: COLORS.primary + "05",
  },
  selectionIndicator: {
    marginRight: 12,
  },
  itemTitle: { fontSize: SIZES.medium, fontWeight: "600", color: "#1E293B" },
  itemSubtitle: { fontSize: SIZES.small, color: COLORS.gray, marginTop: 4 },
  parentInfo: {
    fontSize: 10,
    color: COLORS.gray,
    marginTop: 2,
    fontWeight: "500",
  },
  actionIcons: {
    flexDirection: "row",
    gap: 12,
  },
  iconBtn: {
    padding: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
  },
});
