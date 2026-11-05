import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
} from "react-native";
import {
  GroupMeeting,
  MeetingParticipant,
  subscribeToMeetingParticipants,
  toggleMuteParticipant,
  toggleRaiseHandParticipant,
  muteAllMeetingParticipants,
  leaveGroupMeeting,
  endGroupMeeting,
} from "../src/services/groupMeetingService";
import { agoraRtcService } from "../src/services/agoraRtcService";
import SVGIcon from "./SVGIcon";

interface GroupMeetingModalProps {
  visible: boolean;
  meeting: GroupMeeting | null;
  currentUser: { uid: string; fullName: string; userType: string };
  onClose: () => void;
}

export const GroupMeetingModal: React.FC<GroupMeetingModalProps> = ({
  visible,
  meeting,
  currentUser,
  onClose,
}) => {
  const [participants, setParticipants] = useState<MeetingParticipant[]>([]);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [timeLeft, setTimeLeft] = useState<string>("");

  if (!meeting) return null;

  const isHost = meeting.hostUid === currentUser.uid || currentUser.userType === "admin";
  const myParticipant = participants.find((p) => p.uid === currentUser.uid);
  const isMuted = myParticipant ? myParticipant.isMuted : false;
  const raisedHand = myParticipant ? myParticipant.raisedHand : false;

  // Countdown timer & auto-cut at time limit
  useEffect(() => {
    if (!visible || !meeting?.startedAt) return;

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

      if (rem <= 0) {
        agoraRtcService.leaveChannel();
        if (isHost) {
          endGroupMeeting(meeting.id);
        }
        onClose();
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [visible, meeting?.startedAt, meeting?.maxDurationMinutes, meeting?.groupType, isHost, meeting?.id]);

  useEffect(() => {
    if (!meeting?.id) return;

    const unsubscribe = subscribeToMeetingParticipants(meeting.id, (list) => {
      setParticipants(list);
    });

    return () => unsubscribe();
  }, [meeting?.id]);

  // Join/Leave Agora RTC Channel on Modal Visibility
  useEffect(() => {
    if (visible && meeting?.channelName) {
      agoraRtcService.joinChannel(meeting.channelName, currentUser.uid, {
        isMuted,
      });
    }

    return () => {
      agoraRtcService.leaveChannel();
    };
  }, [visible, meeting?.channelName]);

  // Sync Mute state to local Agora RTC audio track
  useEffect(() => {
    if (visible) {
      agoraRtcService.setMuted(isMuted);
    }
  }, [isMuted, visible]);

  const handleToggleMute = async () => {
    if (!meeting?.id) return;
    const nextMuteState = !isMuted;
    await agoraRtcService.setMuted(nextMuteState);
    await toggleMuteParticipant(meeting.id, currentUser.uid, nextMuteState);
  };

  const handleToggleRaiseHand = async () => {
    if (!meeting?.id) return;
    await toggleRaiseHandParticipant(meeting.id, currentUser.uid, !raisedHand);
  };

  const handleMuteAll = async () => {
    if (!meeting?.id) return;
    await muteAllMeetingParticipants(meeting.id, currentUser.uid);
  };

  const handleLeaveMeeting = async () => {
    if (!meeting?.id) return;
    await agoraRtcService.leaveChannel();
    await leaveGroupMeeting(meeting.id, currentUser.uid);
    onClose();
  };

  const handleEndMeeting = async () => {
    if (!meeting?.id) return;

    // Web / React Native cross-platform confirm
    const confirmEnd = typeof window !== "undefined" && typeof window.confirm === "function"
      ? window.confirm("Are you sure you want to end this live meeting for everyone?")
      : true;

    if (confirmEnd) {
      await agoraRtcService.leaveChannel();
      await endGroupMeeting(meeting.id);
      onClose();
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getRandomColor = (uid: string) => {
    const colors = ["#4F46E5", "#0284C7", "#0D9488", "#7C3AED", "#D97706", "#E11D48"];
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
      hash = uid.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.liveBadge}>
              <View style={styles.livePulse} />
              <Text style={styles.liveBadgeText}>
                {meeting.groupType === "staff" ? "STAFF MEETING" : "LIVE CLASSROOM"}
              </Text>
            </View>
            <Text style={styles.meetingTitle} numberOfLines={1}>
              {meeting.title}
            </Text>
          </View>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <SVGIcon name="chevron-down" size={24} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Meeting Details Bar */}
        <View style={styles.infoBar}>
          <Text style={styles.infoText}>
            👥 {participants.length} Participant{participants.length === 1 ? "" : "s"}
          </Text>

          <View style={styles.timerPill}>
            <Text style={styles.timerText}>⏱️ {timeLeft || "--:--"}</Text>
          </View>

          {isHost && (
            <TouchableOpacity style={styles.muteAllBtn} onPress={handleMuteAll}>
              <SVGIcon name="mic" size={14} color="#F8FAFC" />
              <Text style={styles.muteAllText}>Mute All</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Participant Grid / Scroll View */}
        <ScrollView contentContainerStyle={styles.gridContainer}>
          {participants.map((p) => {
            const avatarBg = getRandomColor(p.uid);
            return (
              <View key={p.uid} style={styles.card}>
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: avatarBg },
                    !p.isMuted && styles.activeSpeakingBorder,
                  ]}
                >
                  <Text style={styles.avatarText}>{getInitials(p.fullName)}</Text>

                  {/* Mic Status Icon Badge */}
                  <View style={[styles.micBadge, p.isMuted ? styles.mutedBg : styles.activeBg]}>
                    <SVGIcon name="mic" size={12} color="#FFFFFF" />
                  </View>
                </View>

                <Text style={styles.participantName} numberOfLines={1}>
                  {p.fullName} {p.uid === currentUser.uid ? "(You)" : ""}
                </Text>

                <View style={styles.roleRow}>
                  {p.role === "host" ? (
                    <View style={styles.hostPill}>
                      <Text style={styles.hostPillText}>Host</Text>
                    </View>
                  ) : (
                    <Text style={styles.userTypePill}>{p.userType}</Text>
                  )}

                  {p.raisedHand && (
                    <View style={styles.handPill}>
                      <Text style={styles.handPillText}>✋ Raised Hand</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Control Toolbar */}
        <View style={styles.toolbar}>
          {/* Mute/Unmute */}
          <TouchableOpacity
            style={[styles.toolBtn, isMuted ? styles.toolBtnDanger : styles.toolBtnActive]}
            onPress={handleToggleMute}
          >
            <SVGIcon name="mic" size={22} color="#FFFFFF" />
            <Text style={styles.toolBtnLabel}>{isMuted ? "Unmute" : "Mute"}</Text>
          </TouchableOpacity>

          {/* Speaker Switch */}
          <TouchableOpacity
            style={[styles.toolBtn, isSpeakerOn ? styles.toolBtnActive : styles.toolBtnInactive]}
            onPress={() => setIsSpeakerOn(!isSpeakerOn)}
          >
            <SVGIcon name="volume-high" size={22} color="#FFFFFF" />
            <Text style={styles.toolBtnLabel}>{isSpeakerOn ? "Speaker" : "Earpiece"}</Text>
          </TouchableOpacity>

          {/* Raise Hand */}
          <TouchableOpacity
            style={[styles.toolBtn, raisedHand ? styles.toolBtnWarning : styles.toolBtnInactive]}
            onPress={handleToggleRaiseHand}
          >
            <Text style={{ fontSize: 20 }}>✋</Text>
            <Text style={styles.toolBtnLabel}>{raisedHand ? "Hand Raised" : "Raise Hand"}</Text>
          </TouchableOpacity>

          {/* Leave Call */}
          <TouchableOpacity style={styles.leaveBtn} onPress={handleLeaveMeeting}>
            <SVGIcon name="close" size={22} color="#FFFFFF" />
            <Text style={styles.leaveBtnText}>Leave</Text>
          </TouchableOpacity>

          {/* End Meeting for all (Host only) */}
          {isHost && (
            <TouchableOpacity style={styles.endBtn} onPress={handleEndMeeting}>
              <SVGIcon name="trash" size={20} color="#FFFFFF" />
              <Text style={styles.endBtnText}>End Meeting</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  headerLeft: {
    flex: 1,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  livePulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  liveBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#10B981",
    letterSpacing: 0.8,
  },
  meetingTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#F8FAFC",
  },
  closeBtn: {
    padding: 8,
  },
  infoBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#1E293B",
  },
  infoText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#94A3B8",
  },
  timerPill: {
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  timerText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FBBF24",
  },
  muteAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#DC2626",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  muteAllText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  gridContainer: {
    padding: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 16,
  },
  card: {
    width: "47%",
    backgroundColor: "#1E293B",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    position: "relative",
  },
  activeSpeakingBorder: {
    borderWidth: 3,
    borderColor: "#10B981",
  },
  avatarText: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  micBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#1E293B",
  },
  activeBg: {
    backgroundColor: "#10B981",
  },
  mutedBg: {
    backgroundColor: "#EF4444",
  },
  participantName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#F8FAFC",
    textAlign: "center",
    marginBottom: 6,
  },
  roleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  hostPill: {
    backgroundColor: "rgba(79, 70, 229, 0.3)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#6366F1",
  },
  hostPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#818CF8",
  },
  userTypePill: {
    fontSize: 11,
    color: "#94A3B8",
    textTransform: "capitalize",
  },
  handPill: {
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  handPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FBBF24",
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 12,
    paddingVertical: 16,
    backgroundColor: "#020617",
    borderTopWidth: 1,
    borderTopColor: "#1E293B",
  },
  toolBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    minWidth: 64,
  },
  toolBtnActive: {
    backgroundColor: "#4F46E5",
  },
  toolBtnInactive: {
    backgroundColor: "#1E293B",
  },
  toolBtnDanger: {
    backgroundColor: "#DC2626",
  },
  toolBtnWarning: {
    backgroundColor: "#D97706",
  },
  toolBtnLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 4,
  },
  leaveBtn: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  leaveBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
    marginTop: 2,
  },
  endBtn: {
    backgroundColor: "#7F1D1D",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  endBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FCA5A5",
    marginTop: 2,
  },
});
