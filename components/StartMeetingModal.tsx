import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import SVGIcon from "./SVGIcon";

interface StartMeetingModalProps {
  visible: boolean;
  onClose: () => void;
  onStartMeeting: (title: string) => Promise<void>;
  groupType: "student" | "staff";
  groupName?: string;
}

export const StartMeetingModal: React.FC<StartMeetingModalProps> = ({
  visible,
  onClose,
  onStartMeeting,
  groupType,
  groupName,
}) => {
  const isStaff = groupType === "staff";
  const defaultTitle = isStaff ? "Staff Meeting" : "Live Classroom";
  const modalTitle = isStaff ? "Start Staff Meeting" : "Start Live Classroom";
  const modalSubtitle = isStaff
    ? groupName ? `Staff Group: ${groupName}` : "Initiate a live voice meeting for staff."
    : groupName ? `Classroom: ${groupName}` : "Initiate a live interactive voice classroom lesson.";
  const buttonLabel = isStaff ? "Launch Meeting" : "Launch Classroom";

  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    try {
      setLoading(true);
      const meetingTitle = title.trim() || defaultTitle;
      await onStartMeeting(meetingTitle);
      setTitle("");
      onClose();
    } catch (error) {
      console.error("Failed to start meeting/classroom:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.overlay}>
          <View style={styles.container}>
            <View style={styles.iconCircle}>
              <SVGIcon name="call" size={32} color="#4F46E5" />
            </View>

            <Text style={styles.title}>{modalTitle}</Text>
            <Text style={styles.subtitle}>{modalSubtitle}</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>{isStaff ? "Meeting Topic" : "Classroom Topic / Lesson"}</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder={defaultTitle}
                placeholderTextColor="#94A3B8"
                autoFocus
              />
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.startBtn} onPress={handleStart} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <SVGIcon name="call" size={18} color="#FFFFFF" />
                    <Text style={styles.startText}>{buttonLabel}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  container: {
    backgroundColor: "#FFFFFF",
    width: "100%",
    maxWidth: 420,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 20,
  },
  inputContainer: {
    width: "100%",
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1E293B",
    backgroundColor: "#F8FAFC",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  cancelText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#64748B",
  },
  startBtn: {
    flex: 1.5,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#4F46E5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  startText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
