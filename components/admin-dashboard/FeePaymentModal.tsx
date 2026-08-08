import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Pressable,
  StyleSheet
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import moment from "moment";
import SVGIcon from "../SVGIcon";
import { VIBE, styles } from "../../constants/admin-dashboard/ManageFeesStyles";
import { StudentDraft } from "../../constants/admin-dashboard/ManageFeesTypes";

interface FeePaymentModalProps {
  visible: boolean;
  onClose: () => void;
  selectedStudent: StudentDraft | null;
  paymentAmount: string;
  setPaymentAmount: (val: string) => void;
  receivedFrom: string;
  setReceivedFrom: (val: string) => void;
  paymentDate: Date;
  setPaymentDate: (date: Date) => void;
  paymentMethod: "Cash" | "Cheque" | "E-cash" | "Momo";
  setPaymentMethod: (method: "Cash" | "Cheque" | "E-cash" | "Momo") => void;
  onConfirm: () => void;
  onDeletePayment: (payment: any) => void;
  saving: boolean;
  canEdit: boolean;
}

export const FeePaymentModal: React.FC<FeePaymentModalProps> = ({
  visible,
  onClose,
  selectedStudent,
  paymentAmount,
  setPaymentAmount,
  receivedFrom,
  setReceivedFrom,
  paymentDate,
  setPaymentDate,
  paymentMethod,
  setPaymentMethod,
  onConfirm,
  onDeletePayment,
  saving,
  canEdit,
}) => {
  const [showPaymentDatePicker, setShowPaymentDatePicker] = React.useState(false);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === "android"}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.paymentModal}>
          <View style={styles.sheetHandle} />
          <View style={styles.modalTopRow}>
            <Text style={styles.modalStudentName}>
              {selectedStudent?.fullName || "Student Profile"}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeRound}>
              <SVGIcon name="close" size={24} color={VIBE.muted} />
            </TouchableOpacity>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
            nestedScrollEnabled={true}
          >
            <View style={styles.modalInputs}>
              <TextInput
                style={styles.pillInput}
                placeholder="Amount (₵)"
                keyboardType="numeric"
                value={paymentAmount}
                onChangeText={setPaymentAmount}
                editable={canEdit}
                placeholderTextColor={VIBE.muted}
              />
              <TextInput
                style={styles.pillInput}
                placeholder="Received From"
                value={receivedFrom}
                onChangeText={setReceivedFrom}
                editable={canEdit}
                placeholderTextColor={VIBE.muted}
              />
              {Platform.OS === "web" ? (
                <View style={[styles.pillInput, { justifyContent: "center" }]}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: VIBE.text,
                        fontSize: 14,
                        marginRight: 10,
                      }}
                    >
                      Date:
                    </Text>
                    <input
                      type="date"
                      value={moment(paymentDate).format("YYYY-MM-DD")}
                      onChange={(e) => setPaymentDate(new Date(e.target.value))}
                      style={{
                        flex: 1,
                        border: "none",
                        background: "none",
                        fontSize: 14,
                        fontWeight: "700",
                        color: VIBE.text,
                        outline: "none",
                      }}
                    />
                    <SVGIcon name="calendar" size={18} color={VIBE.primary} />
                  </View>
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.pillInput, { justifyContent: "center" }]}
                    onPress={() => setShowPaymentDatePicker(true)}
                    disabled={!canEdit}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: paymentDate ? VIBE.text : VIBE.muted,
                          fontSize: 14,
                        }}
                      >
                        Date: {moment(paymentDate).format("DD MMM, YYYY")}
                      </Text>
                      <SVGIcon name="calendar" size={18} color={VIBE.primary} />
                    </View>
                  </TouchableOpacity>

                  {showPaymentDatePicker && (
                    <DateTimePicker
                      value={paymentDate}
                      mode="date"
                      display="default"
                      onChange={(event, selectedDate) => {
                        setShowPaymentDatePicker(Platform.OS === "ios");
                        if (selectedDate) {
                          setPaymentDate(selectedDate);
                        }
                      }}
                    />
                  )}
                </>
              )}
            </View>
            <View style={styles.methodGrid}>
              {["Cash", "Cheque", "Momo", "E-cash"].map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.methodBtn,
                    paymentMethod === m && { backgroundColor: VIBE.primary },
                  ]}
                  onPress={() => setPaymentMethod(m as any)}
                  disabled={!canEdit}
                >
                  <Text
                    style={[
                      styles.methodText,
                      paymentMethod === m && { color: "#fff" },
                    ]}
                  >
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: VIBE.primary }]}
              onPress={onConfirm}
              disabled={saving || !canEdit}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>CONFIRM PAYMENT</Text>
              )}
            </TouchableOpacity>

            <View style={styles.historyBlock}>
              <View style={styles.historyHeader}>
                <Text style={styles.blockTitle}>Term Transactions</Text>
              </View>
              {selectedStudent?.payments?.length ? (
                selectedStudent.payments
                  .slice()
                  .reverse()
                  .map((p: any, i: number) => (
                    <View
                      key={p.receiptNo || i}
                      style={styles.transactionTile}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={styles.tileHeader}>
                          <View>
                            <Text style={styles.tileAmt}>
                              ₵{(p.amount || 0).toFixed(2)}
                            </Text>
                            <Text
                              style={{
                                fontSize: 9,
                                fontWeight: "800",
                                color: VIBE.muted,
                              }}
                            >
                              {p.receiptNo || "N/A"}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => onDeletePayment(p)}
                            disabled={saving}
                          >
                            {saving ? (
                              <ActivityIndicator size="small" color={VIBE.danger} />
                            ) : (
                              <SVGIcon
                                name="trash"
                                size={16}
                                color={VIBE.danger}
                              />
                            )}
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.tileDetail}>
                          {p.method} • Received from {p.receivedFrom}
                        </Text>
                        <Text style={styles.tileDate}>
                          {p.createdAt
                            ? moment(p.createdAt).format("DD MMM, YYYY")
                            : "N/A"}{" "}
                          at{" "}
                          {p.createdAt
                            ? moment(p.createdAt).format("hh:mm A")
                            : ""}
                        </Text>
                      </View>
                    </View>
                  ))
              ) : (
                <Text style={styles.noHistory}>
                  No payments recorded this term.
                </Text>
              )}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
