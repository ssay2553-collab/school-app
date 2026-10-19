import React from "react";
import {
  Modal,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from "react-native";
import SVGIcon from "./SVGIcon";
import { markNotificationsAsRead } from "../src/services/notificationService";
import { useAuth } from "../contexts/AuthContext";
import { ExtendedNotification } from "../hooks/useUnreadNotifications";

interface Props {
  visible: boolean;
  onClose: () => void;
  notifications: ExtendedNotification[];
}

export const UnattendedNotificationModal: React.FC<Props> = ({
  visible,
  onClose,
  notifications,
}) => {
  const { appUser } = useAuth();

  const handleMarkAllRead = async () => {
    if (appUser?.uid) {
      await markNotificationsAsRead(appUser.uid);
    }
  };

  const handleMarkSingleRead = async (id: string, type?: any) => {
    if (appUser?.uid) {
      await markNotificationsAsRead(appUser.uid, type);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "Just now";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Recently";
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <SVGIcon name="notifications" size={22} color="#1E293B" />
              <Text style={styles.title}>Unattended Notifications</Text>
            </View>
            {notifications.length > 0 && (
              <TouchableOpacity onPress={handleMarkAllRead} activeOpacity={0.7}>
                <Text style={styles.markReadText}>Mark all read</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* List of Unattended Notifications */}
          {notifications.length === 0 ? (
            <View style={styles.emptyState}>
              <SVGIcon name="checkmark-seal" size={44} color="#10B981" />
              <Text style={styles.emptyTitle}>All Caught Up! 🎉</Text>
              <Text style={styles.emptySub}>
                You have no pending unread notifications at the moment.
              </Text>
            </View>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeBadgeText}>
                        {(item.type || "INFO").toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.timeText}>{formatDate(item.timestamp)}</Text>
                  </View>

                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardBody}>{item.body}</Text>

                  <View style={styles.cardFooter}>
                    <Text style={styles.senderText}>
                      From: {item.senderName || "System Admin"}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleMarkSingleRead(item.id, item.type)}
                      style={styles.dismissBtn}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.dismissBtnText}>Acknowledge</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          )}

          <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.closeButtonText}>Close Center</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContent: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "82%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 14,
    marginBottom: 14,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 17, fontWeight: "800", color: "#0F172A" },
  markReadText: { color: "#2563EB", fontWeight: "700", fontSize: 13 },
  emptyState: { paddingVertical: 40, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: "#0F172A", marginTop: 8 },
  emptySub: { color: "#64748B", fontSize: 13, textAlign: "center", paddingHorizontal: 20 },
  card: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#2563EB",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  typeBadge: {
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeText: { fontSize: 10, fontWeight: "800", color: "#1D4ED8" },
  timeText: { fontSize: 11, color: "#94A3B8" },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#0F172A", marginBottom: 4 },
  cardBody: { fontSize: 13, color: "#334155", lineHeight: 18 },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  senderText: { fontSize: 11, color: "#64748B", fontWeight: "600" },
  dismissBtn: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dismissBtnText: { fontSize: 11, fontWeight: "700", color: "#2563EB" },
  closeButton: {
    marginTop: 14,
    backgroundColor: "#0F172A",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  closeButtonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
});
