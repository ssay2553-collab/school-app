import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { GroupMeeting } from "../src/services/groupMeetingService";
import SVGIcon from "./SVGIcon";

interface LiveCallBannerProps {
  meeting: GroupMeeting;
  onJoin: () => void;
  onEnd?: () => void;
  isHost?: boolean;
}

export const LiveCallBanner: React.FC<LiveCallBannerProps> = ({
  meeting,
  onJoin,
  onEnd,
  isHost,
}) => {
  const [timeLeft, setTimeLeft] = useState<string>("");
  const badgeLabel = meeting.groupType === "staff" ? "STAFF MEETING" : "CLASSROOM";

  useEffect(() => {
    if (!meeting.startedAt) return;

    const startTimeMs = meeting.startedAt?.toMillis
      ? meeting.startedAt.toMillis()
      : meeting.startedAt?.seconds
      ? meeting.startedAt.seconds * 1000
      : new Date(meeting.startedAt).getTime();

    const maxMins = meeting.maxDurationMinutes || (meeting.groupType === "staff" ? 20 : 35);
    const endTimeMs = (isNaN(startTimeMs) ? Date.now() : startTimeMs) + maxMins * 60 * 1000;

    const tick = () => {
      const now = Date.now();
      const rem = Math.max(0, endTimeMs - now);
      const mins = Math.floor(rem / 60000);
      const secs = Math.floor((rem % 60000) / 1000);
      setTimeLeft(`${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [meeting.startedAt, meeting.maxDurationMinutes, meeting.groupType]);

  return (
    <View style={styles.bannerContainer}>
      <View style={styles.leftContent}>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>{badgeLabel}</Text>
        </View>

        <View style={styles.titleColumn}>
          <Text style={styles.meetingTitle} numberOfLines={1}>
            {meeting.title}
          </Text>
          <Text style={styles.hostSubtitle} numberOfLines={1}>
            Host: {meeting.hostName} • 👥 {meeting.activeParticipantsCount || 1} • ⏱️ {timeLeft || "--:--"}
          </Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.joinBtn} onPress={onJoin} activeOpacity={0.8}>
          <SVGIcon name="call" size={16} color="#FFFFFF" />
          <Text style={styles.joinText}>Join</Text>
        </TouchableOpacity>

        {isHost && onEnd && (
          <TouchableOpacity style={styles.endBtn} onPress={onEnd} activeOpacity={0.8}>
            <SVGIcon name="close" size={16} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bannerContainer: {
    backgroundColor: "#0F172A",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  leftContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
    gap: 10,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  liveText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#EF4444",
    letterSpacing: 0.5,
  },
  titleColumn: {
    flex: 1,
  },
  meetingTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#F8FAFC",
  },
  hostSubtitle: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  joinBtn: {
    backgroundColor: "#10B981",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  joinText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  endBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    padding: 8,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
