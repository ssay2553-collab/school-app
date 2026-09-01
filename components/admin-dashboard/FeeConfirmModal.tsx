import React from "react";
import { Modal, View, Text, TouchableOpacity } from "react-native";
import { styles, VIBE } from "../../constants/admin-dashboard/ManageFeesStyles";

interface FeeConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: string;
}

export const FeeConfirmModal: React.FC<FeeConfirmModalProps> = ({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmColor = VIBE.primary,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlayCenter}>
        <View style={styles.alertCard}>
          <Text style={styles.alertTitle}>{title}</Text>
          <Text style={styles.alertText}>{message}</Text>
          <View style={styles.alertBtnRow}>
            <TouchableOpacity onPress={onCancel} style={styles.alertBtnSec} activeOpacity={0.7}>
              <Text style={styles.alertBtnTextSec}>{cancelText}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              style={[styles.alertBtnPri, { backgroundColor: confirmColor }]}
              activeOpacity={0.7}
            >
              <Text style={styles.alertBtnTextPri}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
