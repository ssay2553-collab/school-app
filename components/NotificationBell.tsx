import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import SVGIcon from "./SVGIcon";
import { useUnreadNotifications } from "../hooks/useUnreadNotifications";
import { UnattendedNotificationModal } from "./UnattendedNotificationModal";

interface Props {
  color?: string;
  size?: number;
}

export const NotificationBell: React.FC<Props> = ({ color = "#FFFFFF", size = 22 }) => {
  const { unreadCount, unreadNotifications } = useUnreadNotifications();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.bellButton}
        onPress={() => setIsModalOpen(true)}
        activeOpacity={0.7}
      >
        <SVGIcon name="notifications" size={size} color={color} />

        {unreadCount > 0 && (
          <View style={styles.badgeContainer}>
            {Platform.OS === "web" && <View style={styles.pulsingBorder} />}
            <Text style={styles.badgeText}>
              {unreadCount > 99 ? "99+" : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <UnattendedNotificationModal
        visible={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        notifications={unreadNotifications}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
  },
  bellButton: {
    padding: 6,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  badgeContainer: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },
  pulsingBorder: {
    position: "absolute",
    width: "140%",
    height: "140%",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#EF4444",
    opacity: 0.6,
  },
});
