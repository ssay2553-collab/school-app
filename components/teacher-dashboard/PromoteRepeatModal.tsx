import { Picker } from "@react-native-picker/picker";
import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { COLORS, SIZES, SHADOWS } from "../../constants/theme";
import { StudentData } from "./StudentCard";

interface PromoteRepeatModalProps {
  visible: boolean;
  isBulkMode: boolean;
  selectedStudent: StudentData | null;
  selectedClass: { name: string } | null;
  targetClassId: string;
  allClasses: Array<{ id: string; name: string }>;
  onTargetClassChange: (id: string) => void;
  onClose: () => void;
  onUpdate: (action: "Promote" | "Repeat") => void;
}

export const PromoteRepeatModal: React.FC<PromoteRepeatModalProps> = ({
  visible,
  isBulkMode,
  selectedStudent,
  selectedClass,
  targetClassId,
  allClasses,
  onTargetClassChange,
  onClose,
  onUpdate,
}) => {
  if (!selectedClass) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            {isBulkMode
              ? "Promote / Repeat All Students"
              : "Promote / Repeat Student"}
          </Text>

          <Text style={styles.modalSubtitle}>
            {isBulkMode ? (
              <>
                Move all students from{" "}
                <Text style={{ fontWeight: "bold" }}>
                  {selectedClass.name}
                </Text>{" "}
                to:
              </>
            ) : (
              <>
                Move{" "}
                <Text style={{ fontWeight: "bold" }}>
                  {selectedStudent?.profile.firstName}
                </Text>{" "}
                from{" "}
                <Text style={{ fontWeight: "bold" }}>
                  {selectedClass.name}
                </Text>{" "}
                to:
              </>
            )}
          </Text>

          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={targetClassId}
              onValueChange={(val) => onTargetClassChange(val)}
              style={styles.picker}
              dropdownIconColor="#000"
            >
              <Picker.Item
                label="Select Target Class"
                value=""
                color="#94A3B8"
              />
              {allClasses.map((cls) => (
                <Picker.Item
                  key={cls.id}
                  label={cls.name}
                  value={cls.id}
                  color="#000"
                />
              ))}
            </Picker>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: "#E2E8F0" }]}
              onPress={onClose}
            >
              <Text style={[styles.modalButtonText, { color: "#475569" }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: COLORS.danger }]}
              onPress={() => onUpdate("Repeat")}
            >
              <Text style={[styles.modalButtonText, { color: "#fff" }]}>
                {isBulkMode ? "Repeat All" : "Repeat"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: COLORS.success }]}
              onPress={() => onUpdate("Promote")}
            >
              <Text style={[styles.modalButtonText, { color: "#fff" }]}>
                {isBulkMode ? "Promote All" : "Promote"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    width: "90%",
    backgroundColor: "white",
    borderRadius: SIZES.radius,
    padding: 20,
    ...SHADOWS.medium,
  },
  modalTitle: {
    fontSize: SIZES.large,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#0F172A",
  },
  modalSubtitle: {
    fontSize: SIZES.medium,
    color: COLORS.gray,
    marginBottom: 16,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: SIZES.radius,
    marginBottom: 20,
    backgroundColor: "#F8FAFC",
    overflow: "hidden",
  },
  picker: {
    height: 50,
    color: "#000",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: SIZES.radius,
    alignItems: "center",
  },
  modalButtonText: {
    fontWeight: "bold",
    fontSize: 12,
  },
});
