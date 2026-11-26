import moment from "moment";
import React from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { VIBE, styles } from "../../constants/admin-dashboard/ManageFeesStyles";
import { StudentDraft } from "../../constants/admin-dashboard/ManageFeesTypes";
import SVGIcon from "../SVGIcon";

const DateTimePicker =
  Platform.OS !== "web"
    ? require("@react-native-community/datetimepicker").default
    : null;

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
  paymentCategory?: string;
  setPaymentCategory?: (cat: string) => void;
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
  paymentCategory = "general",
  setPaymentCategory,
  onConfirm,
  onDeletePayment,
  saving,
  canEdit,
}) => {
  const [showPaymentDatePicker, setShowPaymentDatePicker] =
    React.useState(false);

  const tuitionBal = Math.max(
    0,
    (Number(selectedStudent?.currentBalance) || 0) -
      (Number(selectedStudent?.ptaBalance) || 0) -
      (Number(selectedStudent?.admissionBalance) || 0) -
      (Number(selectedStudent?.maintenanceBalance) || 0) -
      (Number(selectedStudent?.booksBalance) || 0) -
      (Number(selectedStudent?.uniformBalance) || 0) -
      (Number(selectedStudent?.otherBalance) || 0),
  );

  const otherSubItems = React.useMemo(() => {
    if (!selectedStudent?.payments || !Array.isArray(selectedStudent.payments)) return [];
    const itemMap: Record<string, { category: string; billed: number; paid: number; balance: number }> = {};

    selectedStudent.payments.forEach((p: any) => {
      const type = (p.type || "").toLowerCase().trim();
      const rawCat = (p.otherCategory || p.categoryName || "").trim();
      if (
        type === "other" ||
        type === "other_payment" ||
        (rawCat && !["tuition", "pta", "maintenance", "admission", "books", "uniform"].includes(rawCat.toLowerCase()))
      ) {
        const cat = rawCat || "Other Charges";
        if (!itemMap[cat]) {
          itemMap[cat] = { category: cat, billed: 0, paid: 0, balance: 0 };
        }
        const amt = Number(p.amount) || 0;
        if (type === "other") {
          itemMap[cat].billed += amt;
        } else if (type === "other_payment") {
          itemMap[cat].paid += amt;
        }
      }
    });

    Object.values(itemMap).forEach((item) => {
      item.balance = item.billed - item.paid;
    });

    return Object.values(itemMap);
  }, [selectedStudent]);

  const rawCategories = [
    {
      key: "general",
      label: "General Fee (Waterfall)",
      amount: selectedStudent?.currentBalance || 0,
      alwaysShow: true,
    },
    {
      key: "tuition",
      label: "Tuition Fee",
      amount: tuitionBal,
      show:
        tuitionBal > 0 ||
        (Number(selectedStudent?.termBill) || 0) > 0 ||
        (Number(selectedStudent?.currentBalance) || 0) > 0 ||
        (Number(selectedStudent?.arrears) || 0) > 0,
    },
    {
      key: "pta",
      label: "PTA Dues",
      amount: selectedStudent?.ptaBalance || 0,
      show:
        (Number(selectedStudent?.ptaBill) || 0) > 0 ||
        (Number(selectedStudent?.ptaBalance) || 0) > 0,
    },
    {
      key: "maintenance",
      label: "Maintenance Dues",
      amount: selectedStudent?.maintenanceBalance || 0,
      show:
        (Number(selectedStudent?.maintenanceBill) || 0) > 0 ||
        (Number(selectedStudent?.maintenanceBalance) || 0) > 0,
    },
    {
      key: "admission",
      label: "Admission Fee",
      amount: selectedStudent?.admissionBalance || 0,
      show:
        (Number(selectedStudent?.admissionBill) || 0) > 0 ||
        (Number(selectedStudent?.admissionBalance) || 0) > 0,
    },
    {
      key: "books",
      label: "Books / Stationary",
      amount: selectedStudent?.booksBalance || 0,
      show:
        (Number(selectedStudent?.booksBill) || 0) > 0 ||
        (Number(selectedStudent?.booksBalance) || 0) > 0,
    },
    {
      key: "uniform",
      label: "Uniform Fee",
      amount: selectedStudent?.uniformBalance || 0,
      show:
        (Number(selectedStudent?.uniformBill) || 0) > 0 ||
        (Number(selectedStudent?.uniformBalance) || 0) > 0,
    },
    {
      key: "other",
      label: "Other Charges (All)",
      amount: selectedStudent?.otherBalance || 0,
      show:
        (Number(selectedStudent?.otherBill) || 0) > 0 ||
        (Number(selectedStudent?.otherBalance) || 0) > 0 ||
        otherSubItems.length > 0,
    },
    ...otherSubItems.map((sub) => ({
      key: `other:${sub.category}`,
      label: `Other: ${sub.category}`,
      amount: sub.balance > 0 ? sub.balance : (sub.billed > 0 ? sub.billed : 0),
      show: sub.billed > 0 || sub.balance > 0,
    })),
  ];

  const categories = rawCategories.filter((cat) => cat.alwaysShow || cat.show);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === "android"}
    >
      <KeyboardAvoidingView
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : Platform.OS === "android"
              ? "height"
              : undefined
        }
        style={styles.overlay}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.paymentModal,
            Platform.OS === "web" &&
              ({ zIndex: 10, pointerEvents: "auto" } as any),
          ]}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.modalTopRow}>
            <Text style={styles.modalStudentName}>
              {selectedStudent?.fullName || "Student Profile"}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeRound}
              activeOpacity={0.7}
            >
              <SVGIcon name="close" size={24} color={VIBE.muted} />
            </TouchableOpacity>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
            nestedScrollEnabled={true}
          >
            <View style={{ marginTop: 8, marginBottom: 14 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: VIBE.text, marginBottom: 8 }}>
                Target Fee Category
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: 10, gap: 6 }}
              >
                {categories.map((cat) => {
                  const isSelected = (paymentCategory || "general") === cat.key;
                  const amtText = `₵${Number(cat.amount || 0).toFixed(0)}`;
                  return (
                    <TouchableOpacity
                      key={cat.key}
                      style={[
                        {
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 20,
                          backgroundColor: isSelected ? VIBE.primary : "#F1F5F9",
                          borderWidth: 1,
                          borderColor: isSelected ? VIBE.primary : "#E2E8F0",
                          flexDirection: "row",
                          alignItems: "center",
                        },
                        Platform.OS === "web" && ({ cursor: "pointer" } as any),
                      ]}
                      activeOpacity={0.7}
                      onPress={() => {
                        if (setPaymentCategory) setPaymentCategory(cat.key);
                        if (cat.amount > 0 && cat.key !== "general") {
                          setPaymentAmount(cat.amount.toString());
                        }
                      }}
                      disabled={!canEdit}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: isSelected ? "#FFFFFF" : VIBE.text,
                        }}
                      >
                        {cat.label}
                      </Text>
                      <View
                        style={{
                          marginLeft: 6,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 10,
                          backgroundColor: isSelected ? "rgba(255,255,255,0.25)" : "#CBD5E1",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: "800",
                            color: isSelected ? "#FFFFFF" : "#334155",
                          }}
                        >
                          {amtText}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.modalInputs}>
              <TextInput
                style={styles.pillInput}
                placeholder="Amount (₵)"
                keyboardType={Platform.OS === "web" ? "default" : "numeric"}
                value={paymentAmount}
                onChangeText={(val) => {
                  if (Platform.OS === "web") {
                    const cleaned = val.replace(/[^0-9.]/g, "");
                    const parts = cleaned.split(".");
                    setPaymentAmount(
                      parts.length > 2
                        ? `${parts[0]}.${parts.slice(1).join("")}`
                        : cleaned,
                    );
                  } else {
                    setPaymentAmount(val);
                  }
                }}
                editable={canEdit !== false}
                placeholderTextColor={VIBE.muted}
              />
              <TextInput
                style={styles.pillInput}
                placeholder="Received From"
                value={receivedFrom}
                onChangeText={setReceivedFrom}
                editable={canEdit !== false}
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

                  {showPaymentDatePicker && DateTimePicker && (
                    <DateTimePicker
                      value={paymentDate}
                      mode="date"
                      display="default"
                      onChange={(event: any, selectedDate?: Date) => {
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
                    Platform.OS === "web" && ({ cursor: "pointer" } as any),
                  ]}
                  activeOpacity={0.7}
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
              style={[
                styles.saveBtn,
                { backgroundColor: VIBE.primary },
                Platform.OS === "web" && ({ cursor: "pointer" } as any),
              ]}
              activeOpacity={0.8}
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
                    <View key={p.receiptNo || i} style={styles.transactionTile}>
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
                              <ActivityIndicator
                                size="small"
                                color={VIBE.danger}
                              />
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
