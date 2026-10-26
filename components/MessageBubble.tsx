import Constants from "expo-constants";
import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import moment from "moment";
import { COLORS, SHADOWS } from "../constants/theme";
import SVGIcon from "./SVGIcon";

interface MessageBubbleProps {
  message: {
    type?: "text" | "image" | "file" | "audio";
    text?: string;
    senderName?: string;
    senderFirstName?: string;
    senderImage?: string;
    fileUrl?: string;
    fileName?: string;
    createdAt?: any;
    timestamp?: any;
  };
  isYou: boolean;
  children?: React.ReactNode;
  onReply?: () => void;
  onDelete?: () => void;
}

const formatTimestamp = (timestamp: any) => {
  if (!timestamp) return "Sending...";
  let date: Date;
  if (typeof timestamp === "number") {
    date = new Date(timestamp);
  } else if (timestamp.seconds) {
    date = new Date(timestamp.seconds * 1000);
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else if (timestamp.toDate) {
    date = timestamp.toDate();
  } else {
    return "";
  }
  return moment(date).format("hh:mm A");
};

export default function MessageBubble({
  message,
  isYou,
  children,
  onReply,
  onDelete,
}: MessageBubbleProps) {
  const schoolId = Constants.expoConfig?.extra?.schoolId || "afahjoy";
  const isMorgis = schoolId === "morgis";

  // bubbleColor comes from theme's primary (can be overridden per-school via app.config.js)
  const bubbleColor = COLORS.primary;

  const renderContent = () => {
    if (children) return children;

    // Default to "text" type if missing but text content exists
    const type = message.type || (message.text ? "text" : null);

    switch (type) {
      case "text":
        return (
          <Text style={isYou ? styles.sentText : styles.receivedText}>
            {message.text}
          </Text>
        );
      case "image":
        return <Image source={{ uri: message.fileUrl }} style={styles.image} />;
      case "file":
        return (
          <View style={styles.fileContainer}>
            <SVGIcon
              name="document-text"
              size={24}
              color={isYou ? COLORS.white : bubbleColor}
            />
            <Text
              style={[
                styles.fileName,
                { color: isYou ? COLORS.white : COLORS.text },
              ]}
            >
              {message.fileName}
            </Text>
          </View>
        );
      default:
        return null;
    }
  };

  const displayName = message.senderFirstName || message.senderName;

  return (
    <View
      style={[
        styles.wrapper,
        isYou ? styles.sentWrapper : styles.receivedWrapper,
      ]}
    >
      {!isYou && displayName && (
        <View style={styles.senderHeaderRow}>
          {message.senderImage ? (
            <Image
              source={{ uri: message.senderImage }}
              style={styles.senderAvatarImage}
            />
          ) : (
            <View style={styles.senderAvatarFallback}>
              <Text style={styles.senderAvatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.senderName}>{displayName}</Text>
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isYou
            ? { ...styles.sentBubble, backgroundColor: bubbleColor }
            : styles.receivedBubble,
        ]}
      >
        {renderContent()}
        <View style={styles.footer}>
          <Text
            style={[
              styles.timestamp,
              isYou ? styles.timestampSent : styles.timestampReceived,
            ]}
          >
            {formatTimestamp(message.createdAt || message.timestamp)}
          </Text>
          {isYou && (
            <SVGIcon
              name="checkmark-done"
              size={14}
              color={isMorgis ? COLORS.secondary : COLORS.tertiary}
              style={{ marginLeft: 4 }}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 4,
    width: "100%",
  },
  sentWrapper: {
    alignItems: "flex-end",
    paddingLeft: 40,
  },
  receivedWrapper: {
    alignItems: "flex-start",
    paddingRight: 40,
  },
  senderHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    marginLeft: 4,
    gap: 6,
  },
  senderAvatarImage: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#E2E8F0",
  },
  senderAvatarFallback: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.primary + "20",
    justifyContent: "center",
    alignItems: "center",
  },
  senderAvatarText: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.primary,
  },
  senderName: {
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: "700",
  },
  bubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    ...SHADOWS.small,
    minWidth: 80,
  },
  sentBubble: {
    borderBottomRightRadius: 4,
  },
  receivedBubble: {
    backgroundColor: COLORS.card,
    borderBottomLeftRadius: 4,
  },
  sentText: {
    color: COLORS.white,
    fontSize: 15,
    lineHeight: 20,
  },
  receivedText: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 20,
  },
  image: {
    width: 220,
    height: 160,
    borderRadius: 12,
    marginBottom: 4,
  },
  fileContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  fileName: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "500",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 2,
  },
  timestamp: {
    fontSize: 10,
  },
  timestampSent: {
    color: COLORS.highlight,
  },
  timestampReceived: {
    color: COLORS.gray,
  },
});
