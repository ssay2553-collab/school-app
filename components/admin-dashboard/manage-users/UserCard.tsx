import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View, Platform } from "react-native";
import SVGIcon from "../../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../../constants/theme";
import { getTeacherClasses } from "../../../lib/classHelpers";
import { User } from "../../../hooks/admin-dashboard/manage-users-types";

const DEFAULT_AVATAR = require("../../../assets/default-avatar.png");

interface UserCardProps {
  user: User;
  isSelected: boolean;
  isSelectionActive: boolean;
  allClasses: { id: string; name: string }[];
  onToggleSelection: (uid: string) => void;
  onPress: (user: User) => void;
  onLongPress: (user: User) => void;
}

export const UserCard: React.FC<UserCardProps> = ({
  user,
  isSelected,
  isSelectionActive,
  allClasses,
  onToggleSelection,
  onPress,
  onLongPress,
}) => {
  const teacherClasses = ["teacher", "staff", "admin"].includes(user.role)
    ? getTeacherClasses(user as any)
    : [];

  return (
    <TouchableOpacity
      style={[styles.userCard, isSelected && styles.selectedCard]}
      onLongPress={() => onLongPress(user)}
      onPress={() => onPress(user)}
    >
      {isSelectionActive && user.role === "student" && (
        <View style={styles.selectionIndicator}>
          <SVGIcon
            name={isSelected ? "checkbox" : "square-outline"}
            size={24}
            color={isSelected ? COLORS.primary : COLORS.gray}
          />
        </View>
      )}
      <View style={styles.avatar}>
        <Image
          source={
            user.profile?.profileImage
              ? { uri: user.profile.profileImage }
              : DEFAULT_AVATAR
          }
          style={styles.avatarImg}
          resizeMode="cover"
        />
      </View>
      <View style={{ flex: 1, marginLeft: 15 }}>
        <Text style={styles.userName}>
          {user.profile?.firstName} {user.profile?.lastName}
        </Text>
        <Text style={styles.userSubText}>
          {user.status === "archived"
            ? `Archived (${user.archivedInYear || "N/A"})`
            : user.status === "pending_activation"
            ? `Pending Activation (Code: ${user.signupCode})`
            : allClasses.find((c) => c.id === user.classId)?.name ||
              user.adminRole ||
              user.role.toUpperCase()}
        </Text>
        <View style={styles.badgeRow}>
          {teacherClasses.length > 0 && (
            <View style={[styles.badge, { backgroundColor: "#10b98115" }]}>
              <Text style={[styles.badgeText, { color: "#10b981" }]}>
                {teacherClasses.length === 1
                  ? `Class: ${
                      allClasses.find((c) => c.id === teacherClasses[0])?.name ||
                      "N/A"
                    }`
                  : `${teacherClasses.length} Classes Assigned`}
              </Text>
            </View>
          )}
          {user.canCreateNews && (
            <View style={[styles.badge, { backgroundColor: "#f59e0b15" }]}>
              <Text style={[styles.badgeText, { color: "#f59e0b" }]}>
                News Authority
              </Text>
            </View>
          )}
          {user.onScholarship && (
            <View style={[styles.badge, { backgroundColor: "#6366f115" }]}>
              <Text style={[styles.badgeText, { color: "#6366f1" }]}>
                On Scholarship
              </Text>
            </View>
          )}
          {user.role === "student" &&
            (user.walletBalance !== undefined ||
              user.dailyArrears !== undefined) && (
              <View style={{ flexDirection: "row", gap: 4, flexWrap: "wrap" }}>
                {user.walletBalance !== undefined && (
                  <View
                    style={[
                      styles.badge,
                      {
                        backgroundColor:
                          user.walletBalance > 0 ? "#ef444415" : "#10b98115",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        {
                          color: user.walletBalance > 0 ? "#ef4444" : "#10b981",
                        },
                      ]}
                    >
                      {user.walletBalance > 0
                        ? `Tuition: ₵${(user.walletBalance || 0).toLocaleString()}`
                        : "Tuition Cleared"}
                    </Text>
                  </View>
                )}
                {(user.dailyArrears || 0) > 0 && (
                  <View style={[styles.badge, { backgroundColor: "#f59e0b15" }]}>
                    <Text style={[styles.badgeText, { color: "#f59e0b" }]}>
                      Arrears: ₵{(user.dailyArrears || 0).toLocaleString()}
                    </Text>
                  </View>
                )}
              </View>
            )}
        </View>
      </View>
      <SVGIcon
        name="chevron-forward"
        size={20}
        color={COLORS.gray || "#9ca3af"}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    ...SHADOWS.small,
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
      default: {}
    }),
  },
  selectedCard: {
    borderColor: COLORS.primary,
    borderWidth: 1,
    backgroundColor: (COLORS.primary || "#2e86de") + "05",
  },
  selectionIndicator: {
    marginRight: 10,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: (COLORS.primary || "#2e86de") + "15",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: "100%", height: "100%", borderRadius: 15 },
  userName: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
  userSubText: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "800",
    marginTop: 2,
  },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 8, gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 9, fontWeight: "800", textTransform: "uppercase" },
});
