import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import moment from "moment";
import SVGIcon from "../SVGIcon";
import { VIBE, styles } from "../../constants/admin-dashboard/ManageFeesStyles";

interface FeeDailyTransactionsModalProps {
  visible: boolean;
  onClose: () => void;
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  dailyPayments: any[];
  loading: boolean;
}

export const FeeDailyTransactionsModal: React.FC<
  FeeDailyTransactionsModalProps
> = ({
  visible,
  onClose,
  selectedDate,
  onDateChange,
  dailyPayments,
  loading,
}) => {
  const [showDatePicker, setShowDatePicker] = React.useState(false);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === "android"}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheetBody}>
          <View style={styles.sheetHandle} />
          <View style={styles.modalTopRow}>
            <Text style={styles.sheetTitle}>Daily Transactions</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeRound}>
              <SVGIcon name="close" size={24} color={VIBE.muted} />
            </TouchableOpacity>
          </View>

          <View style={styles.dateSelector}>
            <SVGIcon name="calendar" size={20} color={VIBE.primary} />
            {Platform.OS === "web" ? (
              <input
                type="date"
                value={moment(selectedDate).format("YYYY-MM-DD")}
                onChange={(e) => onDateChange(new Date(e.target.value))}
                style={{
                  flex: 1,
                  border: "none",
                  background: "none",
                  fontSize: 16,
                  fontWeight: "700",
                  color: VIBE.text,
                  outline: "none",
                }}
              />
            ) : (
              <>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={styles.dateText}>
                    {moment(selectedDate).format("DD MMMM, YYYY")}
                  </Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display="default"
                    onChange={(event: any, date?: Date) => {
                      setShowDatePicker(false);
                      if (date) onDateChange(date);
                    }}
                  />
                )}
              </>
            )}
          </View>

          <View style={styles.dailyTotalCard}>
            <Text style={styles.dailyTotalLabel}>TOTAL COLLECTED</Text>
            <Text style={styles.dailyTotalValue}>
              ₵
              {dailyPayments
                .reduce((acc, p) => acc + (p.amount || 0), 0)
                .toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator
              size="large"
              color={VIBE.primary}
              style={{ marginTop: 20 }}
            />
          ) : (
            <FlatList
              data={dailyPayments}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.dailyPaymentItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dailyStudentName}>
                      {item.studentName}
                    </Text>
                    <Text style={styles.dailyStudentClass}>
                      {item.className} • {item.method}
                    </Text>
                    <Text style={styles.dailyReceipt}>
                      {item.receiptNo} • {moment(item.createdAt).format("LT")}
                    </Text>
                  </View>
                  <Text style={styles.dailyAmount}>
                    ₵{(item.amount || 0).toFixed(2)}
                  </Text>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <SVGIcon name="cash-outline" size={48} color={VIBE.muted} />
                  <Text style={styles.emptyText}>No transactions found</Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
};
