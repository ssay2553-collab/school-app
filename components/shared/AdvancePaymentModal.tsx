import React, { useState, useMemo, useEffect } from "react";
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
import SVGIcon from "../SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";

interface AdvancePaymentModalProps {
  visible: boolean;
  onClose: () => void;
  studentName: string;
  className: string;
  feeType: "Feeding" | "Bus" | "Extra Classes";
  dailyRate: number;
  currentArrears: number;
  saving?: boolean;
  onConfirmPayment: (amount: number) => Promise<void>;
}

export const AdvancePaymentModal = ({
  visible,
  onClose,
  studentName,
  className,
  feeType,
  dailyRate,
  currentArrears,
  saving = false,
  onConfirmPayment,
}: AdvancePaymentModalProps) => {
  const [amountStr, setAmountStr] = useState("");

  useEffect(() => {
    if (visible) {
      setAmountStr("");
    }
  }, [visible]);

  const enteredAmount = parseFloat(amountStr) || 0;

  const calculation = useMemo(() => {
    if (enteredAmount <= 0) {
      return {
        arrearsCleared: 0,
        remainingForDays: 0,
        daysSatisfied: 0,
        hasArrearsToClear: currentArrears > 0,
      };
    }

    const arrearsCleared = Math.min(currentArrears, enteredAmount);
    const remainingForDays = enteredAmount - arrearsCleared;
    const rate = dailyRate > 0 ? dailyRate : 1;
    const daysSatisfied = Math.floor(remainingForDays / rate);

    return {
      arrearsCleared,
      remainingForDays,
      daysSatisfied,
      hasArrearsToClear: currentArrears > 0,
    };
  }, [enteredAmount, currentArrears, dailyRate]);

  const handleConfirm = async () => {
    if (enteredAmount <= 0 || saving) return;
    await onConfirmPayment(enteredAmount);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalCard}>
              {/* Header */}
              <View style={styles.header}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>Issue Fee Payment</Text>
                  <Text style={styles.studentName} numberOfLines={1}>
                    {studentName} • <Text style={styles.className}>{className}</Text>
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <SVGIcon name="close" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Info Badges */}
              <View style={styles.infoRow}>
                <View style={styles.infoBox}>
                  <Text style={styles.infoLabel}>{feeType} Rate</Text>
                  <Text style={[styles.infoValue, { color: COLORS.primary }]}>
                    ₵{dailyRate.toFixed(2)}/day
                  </Text>
                </View>
                <View
                  style={[
                    styles.infoBox,
                    currentArrears > 0 && { backgroundColor: "#FEF2F2", borderColor: "#FCA5A5" },
                  ]}
                >
                  <Text style={styles.infoLabel}>Current Arrears</Text>
                  <Text
                    style={[
                      styles.infoValue,
                      { color: currentArrears > 0 ? "#EF4444" : "#10B981" },
                    ]}
                  >
                    ₵{currentArrears.toFixed(2)}
                  </Text>
                </View>
              </View>

              {/* Amount Input */}
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Enter Payment Amount (₵)</Text>
                <View style={styles.inputContainer}>
                  <Text style={styles.currencySymbol}>₵</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0.00"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={amountStr}
                    onChangeText={setAmountStr}
                    autoFocus
                  />
                  {amountStr !== "" && (
                    <TouchableOpacity onPress={() => setAmountStr("")}>
                      <SVGIcon name="close-circle" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Calculation Summary Box */}
              {enteredAmount > 0 && (
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryTitle}>Payment Distribution</Text>

                  {calculation.arrearsCleared > 0 && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Arrears Cleared:</Text>
                      <Text style={[styles.summaryValue, { color: "#EF4444" }]}>
                        -₵{calculation.arrearsCleared.toFixed(2)}
                      </Text>
                    </View>
                  )}

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Remaining for Daily Fees:</Text>
                    <Text style={[styles.summaryValue, { color: COLORS.primary }]}>
                      ₵{calculation.remainingForDays.toFixed(2)}
                    </Text>
                  </View>

                  <View style={[styles.summaryRow, { borderBottomWidth: 0, paddingTop: 8 }]}>
                    <Text style={[styles.summaryLabel, { fontWeight: "800", color: "#0F172A" }]}>
                      Days Auto-Marked PAID:
                    </Text>
                    <View style={styles.daysBadge}>
                      <SVGIcon name="checkmark-circle" size={16} color="#065F46" />
                      <Text style={styles.daysBadgeText}>
                        {calculation.daysSatisfied} {calculation.daysSatisfied === 1 ? "Day" : "Days"}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={onClose}
                  disabled={saving}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.confirmBtn,
                    (enteredAmount <= 0 || saving) && { opacity: 0.5 },
                  ]}
                  onPress={handleConfirm}
                  disabled={enteredAmount <= 0 || saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.confirmBtnText}>
                      Confirm ₵{enteredAmount.toFixed(2)}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
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
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    ...SHADOWS.large,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0F172A",
  },
  studentName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
    marginTop: 2,
  },
  className: {
    color: "#64748B",
    fontWeight: "600",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  infoRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  infoBox: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "900",
    marginTop: 4,
  },
  inputSection: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: "900",
    color: "#475569",
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  summaryCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748B",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  summaryLabel: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "600",
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "800",
  },
  daysBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  daysBadgeText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#065F46",
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#64748B",
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
