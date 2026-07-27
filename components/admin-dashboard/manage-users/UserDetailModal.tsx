import React from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../../constants/theme";
import { User, PERMISSION_KEYS, PERMISSION_LEVELS } from "../../../hooks/admin-dashboard/manage-users-types";

const DEFAULT_AVATAR = require("../../../assets/default-avatar.png");

interface UserDetailModalProps {
  user: User | null;
  isVisible: boolean;
  onClose: () => void;
  linkedUsers: User[];
  isSuperAdmin: boolean;
  hasManageUsersAccess: boolean;
  allClasses: { id: string; name: string }[];
  updating: boolean;
  deletingUid: string | null;
  onEditProfile: (user: User) => void;
  onOpenPermissions: (user: User) => void;
  onUpgradeStaff: (user: User) => void;
  onModifyAuthority: (user: User) => void;
  onDeleteUser: (user: User) => void;
  onUnlinkParent: (parentUid: string) => void;
  onShareCode: (user: User) => void;
  onRegenerateCode: (user: User) => void;
  onClearArrears: (user: User) => void;
  onRemoveAssignedRole: (role: string, user: User) => void;
  onPromoteRepeat: (user: User) => void;
  onViewAttendance?: (user: User) => void;
  onToggleArchive?: (user: User) => void;
}

export const UserDetailModal: React.FC<UserDetailModalProps> = ({
  user,
  isVisible,
  onClose,
  linkedUsers,
  isSuperAdmin,
  hasManageUsersAccess,
  allClasses,
  updating,
  deletingUid,
  onEditProfile,
  onOpenPermissions,
  onUpgradeStaff,
  onModifyAuthority,
  onDeleteUser,
  onUnlinkParent,
  onShareCode,
  onRegenerateCode,
  onClearArrears,
  onRemoveAssignedRole,
  onPromoteRepeat,
  onViewAttendance,
  onToggleArchive,
}) => {
  if (!user) return null;

  const formatDate = (date: any) => {
    if (!date) return "N/A";
    try {
      if (date.toDate)
        return date.toDate().toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
      return new Date(date).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "Invalid Date";
    }
  };

  return (
    <Modal visible={isVisible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <Animatable.View
          animation="slideInUp"
          duration={400}
          style={styles.modalContent}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Member Profile</Text>
            <TouchableOpacity onPress={onClose}>
              <SVGIcon name="close" size={28} color={COLORS.gray || "#9ca3af"} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            <View style={{ padding: 20 }}>
              <View style={styles.detailHero}>
                <View style={styles.largeAvatar}>
                  <Image
                    source={
                      user.profile?.profileImage
                        ? { uri: user.profile.profileImage }
                        : DEFAULT_AVATAR
                    }
                    style={styles.avatarImgLarge}
                  />
                </View>
                <Text style={styles.detailName}>
                  {user.profile?.firstName} {user.profile?.lastName}
                </Text>
                <Text style={styles.detailRole}>
                  {user.adminRole || user.role.toUpperCase()}
                </Text>
                {user.assignedRoles && user.assignedRoles.length > 0 && (
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      marginTop: 8,
                      gap: 8,
                    }}
                  >
                    {user.assignedRoles.map((r, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.badge,
                          {
                            backgroundColor: "#eef2ff",
                            flexDirection: "row",
                            alignItems: "center",
                            paddingHorizontal: 10,
                          },
                        ]}
                      >
                        <Text style={[styles.badgeText, { color: "#4f46e5" }]}>
                          {r}
                        </Text>
                        {hasManageUsersAccess && (
                          <TouchableOpacity
                            onPress={() => onRemoveAssignedRole(r, user)}
                            style={{ marginLeft: 8 }}
                          >
                            <SVGIcon name="close" size={12} color="#374151" />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                    {user.departmentHeadOf ? (
                      <View style={[styles.badge, { backgroundColor: "#fff7ed" }]}>
                        <Text style={[styles.badgeText, { color: "#b45309" }]}>
                          Dept: {user.departmentHeadOf}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                )}
              </View>

              {user.role === "student" && (
                <View style={styles.financeCardRow}>
                  <View
                    style={[
                      styles.financeBox,
                      {
                        borderLeftColor:
                          (user.walletBalance || 0) > 0 ? "#ef4444" : "#10b981",
                      },
                    ]}
                  >
                    <Text style={styles.financeLabel}>TUITION BALANCE</Text>
                    <Text
                      style={[
                        styles.financeValue,
                        {
                          color:
                            (user.walletBalance || 0) > 0 ? "#ef4444" : "#10b981",
                        },
                      ]}
                    >
                      ₵{(user.walletBalance || 0).toLocaleString()}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.financeBox,
                      {
                        borderLeftColor:
                          (user.dailyArrears || 0) > 0 ? "#f59e0b" : "#10b981",
                      },
                    ]}
                  >
                    <Text style={styles.financeLabel}>SERVICE ARREARS</Text>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text
                        style={[
                          styles.financeValue,
                          {
                            color:
                              (user.dailyArrears || 0) > 0 ? "#f59e0b" : "#10b981",
                          },
                        ]}
                      >
                        ₵{(user.dailyArrears || 0).toLocaleString()}
                      </Text>
                      {(user.dailyArrears || 0) > 0 && (
                        <TouchableOpacity onPress={() => onClearArrears(user)}>
                          <SVGIcon
                            name="refresh-circle"
                            size={20}
                            color="#f59e0b"
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              )}

              {(user.signupCode || user.secretCode) && (
                <View style={styles.infoSection}>
                  <Text style={styles.infoLabel}>Security Tokens</Text>
                  <View
                    style={[
                      styles.financeBox,
                      {
                        borderLeftColor: "#f59e0b",
                        backgroundColor: "#fffbeb",
                      },
                    ]}
                  >
                    <Text style={[styles.financeLabel, { color: "#b45309" }]}>
                      {user.status === "pending_activation"
                        ? "SIGNUP CODE"
                        : "RESET/SECRET TOKEN"}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginTop: 4,
                      }}
                    >
                      <Text
                        style={[
                          styles.financeValue,
                          {
                            color: "#b45309",
                            fontSize: 24,
                            letterSpacing: 2,
                          },
                        ]}
                      >
                        {user.signupCode || user.secretCode || "N/A"}
                      </Text>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <TouchableOpacity
                          onPress={() => onShareCode(user)}
                          style={{
                            backgroundColor: COLORS.primary,
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 8,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <SVGIcon name="share-outline" size={14} color="#fff" />
                          <Text
                            style={{
                              color: "#fff",
                              fontSize: 10,
                              fontWeight: "800",
                            }}
                          >
                            SHARE
                          </Text>
                        </TouchableOpacity>
                        {user.status === "pending_activation" && (
                          <TouchableOpacity
                            onPress={() => onRegenerateCode(user)}
                            style={{
                              backgroundColor: "#b45309",
                              paddingHorizontal: 12,
                              paddingVertical: 6,
                              borderRadius: 8,
                            }}
                          >
                            <Text
                              style={{
                                color: "#fff",
                                fontSize: 10,
                                fontWeight: "800",
                              }}
                            >
                              REGENERATE
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    <Text
                      style={{
                        fontSize: 10,
                        color: "#d97706",
                        marginTop: 8,
                        fontWeight: "600",
                      }}
                    >
                      {user.status === "pending_activation"
                        ? "Provide this code to the student to claim their profile."
                        : "This token can be used for secure password resets."}
                    </Text>
                  </View>
                </View>
              )}

              {(user.role === "teacher" || user.role === "admin") && (
                <View style={styles.infoSection}>
                  <Text style={styles.infoLabel}>Teaching Assignments</Text>
                  <View style={styles.infoGrid}>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoKey}>Class Teacher Of:</Text>
                      <Text style={styles.infoValue}>
                        {user.classTeacherOf
                          ? allClasses.find((c) => c.id === user.classTeacherOf)
                              ?.name || user.classTeacherOf
                          : "N/A"}
                      </Text>
                    </View>
                    {(user.classes?.length || 0) > 0 && (
                      <View style={styles.infoRow}>
                        <Text style={styles.infoKey}>Assigned Classes:</Text>
                        <Text
                          style={[
                            styles.infoValue,
                            { flex: 1, textAlign: "right" },
                          ]}
                        >
                          {user.classes
                            ?.map(
                              (cid) =>
                                allClasses.find((c) => c.id === cid)?.name || cid,
                            )
                            .join(", ")}
                        </Text>
                      </View>
                    )}
                    {(user.subjects?.length || 0) > 0 && (
                      <View style={styles.infoRow}>
                        <Text style={styles.infoKey}>Assigned Subjects:</Text>
                        <Text
                          style={[
                            styles.infoValue,
                            { flex: 1, textAlign: "right" },
                          ]}
                        >
                          {user.subjects?.join(", ")}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              <View style={styles.infoSection}>
                <Text style={styles.infoLabel}>Bio Information</Text>
                <View style={styles.infoGrid}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>Email:</Text>
                    <Text style={styles.infoValue}>
                      {user.profile?.email || "N/A"}
                    </Text>
                  </View>
                  {user.role !== "student" && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoKey}>Phone:</Text>
                      <Text style={styles.infoValue}>
                        {user.profile?.phone || "N/A"}
                      </Text>
                    </View>
                  )}
                  {user.role === "student" && (
                    <>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoKey}>Emergency #:</Text>
                        <Text style={styles.infoValue}>
                          {user.profile?.emergencyPhone || "N/A"}
                        </Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoKey}>Parent #:</Text>
                        <Text style={styles.infoValue}>
                          {user.profile?.parentPhone || "N/A"}
                        </Text>
                      </View>
                    </>
                  )}
                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>Gender:</Text>
                    <Text style={styles.infoValue}>
                      {user.profile?.gender || "N/A"}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>Date of Birth:</Text>
                    <Text style={styles.infoValue}>
                      {formatDate(user.dateOfBirth)}
                    </Text>
                  </View>
                  {user.role === "student" && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoKey}>Bus Location:</Text>
                      <Text style={styles.infoValue}>
                        {user.busLocation || "N/A"}
                      </Text>
                    </View>
                  )}
                  {user.role === "student" && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoKey}>Current Class:</Text>
                      <Text style={styles.infoValue}>
                        {allClasses.find((c) => c.id === user.classId)?.name ||
                          "N/A"}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {user.permissions && Object.keys(user.permissions).length > 0 && (
                <View style={styles.infoSection}>
                  <Text style={styles.infoLabel}>Delegated Permissions</Text>
                  <View style={styles.infoGrid}>
                    {Object.entries(user.permissions).map(([key, level]) => {
                      if (level === "deny") return null;
                      const label =
                        PERMISSION_KEYS.find((pk) => pk.key === key)?.label ||
                        key;
                      const levelLabel =
                        PERMISSION_LEVELS.find((pl) => pl.value === level)
                          ?.label || level;
                      return (
                        <View key={key} style={styles.infoRow}>
                          <Text style={styles.infoKey}>{label}:</Text>
                          <Text
                            style={[
                              styles.infoValue,
                              { color: level === "full" ? "#10b981" : "#6366f1" },
                            ]}
                          >
                            {levelLabel}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {linkedUsers.length > 0 && (
                <View style={styles.infoSection}>
                  <Text style={styles.infoLabel}>
                    {user.role === "student"
                      ? "Linked Parents"
                      : "Linked Students"}
                  </Text>
                  <View style={styles.linkedList}>
                    {linkedUsers.map((u) => (
                      <View key={u.uid} style={styles.linkedItem}>
                        <Image
                          source={
                            u.profile?.profileImage
                              ? { uri: u.profile.profileImage }
                              : DEFAULT_AVATAR
                          }
                          style={styles.linkedAvatar}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.linkedName}>
                            {u.profile.firstName} {u.profile.lastName}
                          </Text>
                          <Text style={styles.linkedSub}>
                            {u.profile.phone ||
                              u.profile.email ||
                              "Contact linked"}
                          </Text>
                        </View>
                        {user.role === "student" && (
                          <TouchableOpacity
                            style={styles.unlinkBtn}
                            onPress={() => onUnlinkParent(u.uid)}
                          >
                            <Text style={styles.unlinkBtnText}>UNLINK</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.btnStack}>
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    {
                      backgroundColor: COLORS.success || "#05ac5b",
                      marginBottom: 12,
                    },
                  ]}
                  onPress={() => onEditProfile(user)}
                >
                  <Text style={styles.actionButtonText}>
                    Edit Profile / Setup Services
                  </Text>
                </TouchableOpacity>

                {user.role !== "student" &&
                  user.role !== "parent" &&
                  isSuperAdmin && (
                    <TouchableOpacity
                      style={[
                        styles.actionButton,
                        {
                          backgroundColor: COLORS.primary || "#2e86de",
                          marginBottom: 12,
                        },
                      ]}
                      onPress={() => onOpenPermissions(user)}
                    >
                      <Text style={styles.actionButtonText}>
                        Modify Authority & Permissions
                      </Text>
                    </TouchableOpacity>
                  )}
                {user.role === "staff" && (
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      {
                        backgroundColor: COLORS.primary || "#2e86de",
                        marginBottom: 12,
                      },
                    ]}
                    onPress={() => onUpgradeStaff(user)}
                  >
                    <Text style={styles.actionButtonText}>
                      Upgrade Account (Login)
                    </Text>
                  </TouchableOpacity>
                )}
                {user.role === "student" && (
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      {
                        backgroundColor: COLORS.primary || "#2e86de",
                        marginBottom: 12,
                      },
                    ]}
                    onPress={() => onViewAttendance?.(user)}
                  >
                    <Text style={styles.actionButtonText}>View Attendance Analysis</Text>
                  </TouchableOpacity>
                )}

                {user.role === "student" && (
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      {
                        backgroundColor: COLORS.secondary || "#c53b59",
                        marginBottom: 12,
                      },
                    ]}
                    onPress={() => onPromoteRepeat(user)}
                  >
                    <Text style={styles.actionButtonText}>Promote / Repeat</Text>
                  </TouchableOpacity>
                )}

                {user.role === "student" && (
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      {
                        backgroundColor:
                          user.status === "archived"
                            ? COLORS.success
                            : COLORS.gray || "#94A3B8",
                        marginBottom: 12,
                      },
                    ]}
                    onPress={() => onToggleArchive?.(user)}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <SVGIcon
                        name={user.status === "archived" ? "people" : "archive"}
                        size={20}
                        color="#fff"
                      />
                      <Text style={styles.actionButtonText}>
                        {user.status === "archived"
                          ? "Restore Student"
                          : "Archive Student"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    { backgroundColor: "#fee2e2", marginTop: 12 },
                  ]}
                  onPress={() => onDeleteUser(user)}
                  disabled={updating}
                >
                  {updating && deletingUid === user.uid ? (
                    <ActivityIndicator color="#ef4444" />
                  ) : (
                    <Text style={[styles.actionButtonText, { color: "#ef4444" }]}>
                      Delete Account
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </Animatable.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 30,
    width: "100%",
    maxWidth: 500,
    maxHeight: "90%",
    overflow: "hidden",
    ...SHADOWS.large,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 25,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    alignItems: "center",
  },
  modalTitle: { fontSize: 18, fontWeight: "900", color: "#1E293B" },
  detailHero: { alignItems: "center", marginBottom: 20 },
  largeAvatar: {
    width: 90,
    height: 90,
    borderRadius: 25,
    backgroundColor: (COLORS.primary || "#2e86de") + "10",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    ...SHADOWS.small,
    overflow: "hidden",
  },
  avatarImgLarge: { width: "100%", height: "100%", borderRadius: 25 },
  detailName: { fontSize: 24, fontWeight: "800", color: "#1E293B" },
  detailRole: {
    fontSize: 14,
    color: COLORS.primary || "#2e86de",
    fontWeight: "700",
    marginTop: 4,
  },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 9, fontWeight: "800", textTransform: "uppercase" },
  financeCardRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  financeBox: {
    flex: 1,
    padding: 15,
    backgroundColor: "#f8fafc",
    borderRadius: 15,
    borderLeftWidth: 4,
  },
  financeLabel: { fontSize: 9, fontWeight: "800", color: "#94A3B8" },
  financeValue: { fontSize: 16, fontWeight: "900", marginTop: 4 },
  infoSection: { marginBottom: 25, paddingHorizontal: 20 },
  infoLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#94A3B8",
    textTransform: "uppercase",
    marginBottom: 12,
    letterSpacing: 1,
  },
  infoGrid: { gap: 10 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  infoKey: { fontSize: 14, color: "#64748B", fontWeight: "600" },
  infoValue: { fontSize: 14, color: "#1E293B", fontWeight: "700" },
  linkedList: { gap: 10 },
  linkedItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
  },
  linkedAvatar: { width: 35, height: 35, borderRadius: 10, marginRight: 12 },
  linkedName: { fontSize: 14, fontWeight: "700", color: "#1E293B" },
  linkedSub: { fontSize: 11, color: "#94A3B8" },
  unlinkBtn: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  unlinkBtnText: { color: "#EF4444", fontSize: 9, fontWeight: "900" },
  btnStack: { paddingBottom: 40 },
  actionButton: {
    height: 55,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 20,
  },
  actionButtonText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
