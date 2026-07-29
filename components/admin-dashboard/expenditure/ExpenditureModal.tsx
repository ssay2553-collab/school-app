import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import moment from 'moment';
import SVGIcon from '../../SVGIcon';
import { EXPENDITURE_CATEGORIES, EXPENDITURE_STRUCTURE } from '../../../constants/admin-dashboard/ExpenditureConstants';

import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../../firebaseConfig';

// Guarded import for native-only library
const DateTimePicker =
  Platform.OS !== "web"
    ? require("@react-native-community/datetimepicker").default
    : null;

interface ExpenditureModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: {
    itemName: string;
    category: string;
    subCategory: string;
    amount: string;
    itemDate: Date;
    receiptUrl?: string;
  }) => Promise<boolean>;
  saving: boolean;
  primaryBrand: string;
  secondaryBrand: string;
}

export const ExpenditureModal: React.FC<ExpenditureModalProps> = ({
  visible,
  onClose,
  onSave,
  saving,
  primaryBrand,
  secondaryBrand,
}) => {
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [itemDate, setItemDate] = useState(new Date());
  const [receiptUrl, setReceiptUrl] = useState("");
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleSave = async () => {
    const success = await onSave({
      itemName,
      category,
      subCategory,
      amount,
      itemDate,
      receiptUrl,
    });
    if (success) {
      resetForm();
    }
  };

  const resetForm = () => {
    setItemName("");
    setCategory("");
    setSubCategory("");
    setAmount("");
    setItemDate(new Date());
    setReceiptUrl("");
  };

  const handlePickReceipt = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });

      if (result.canceled || !result.assets.length) return;

      setUploadingReceipt(true);
      const uri = result.assets[0].uri;
      const response = await fetch(uri);
      const blob = await response.blob();
      const filename = `receipt_${Date.now()}.jpg`;
      const storageRef = ref(storage, `expenditures/${filename}`);

      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);

      setReceiptUrl(downloadURL);
    } catch (err) {
      console.error("Receipt upload error:", err);
    } finally {
      setUploadingReceipt(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Expense</Text>
            <TouchableOpacity onPress={onClose}>
              <SVGIcon name="close-circle" size={32} color="#CBD5E1" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.modalInputWrapper}>
              <Text style={styles.modalInputLabel}>CATEGORY</Text>
              <View style={styles.categoryChipContainer}>
                {EXPENDITURE_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryChip,
                      category === cat && {
                        backgroundColor: primaryBrand,
                        borderColor: primaryBrand,
                      },
                    ]}
                    onPress={() => {
                      setCategory(cat);
                      setSubCategory("");
                    }}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        category === cat && { color: "#fff" },
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={[styles.modalInput, { marginTop: 8 }]}
                placeholder="Or type custom category..."
                value={category}
                onChangeText={setCategory}
                placeholderTextColor="#94A3B8"
              />
            </View>

            {category && EXPENDITURE_STRUCTURE[category] && (
              <View style={styles.modalInputWrapper}>
                <Text style={styles.modalInputLabel}>SUB-CATEGORY</Text>
                <View style={styles.categoryChipContainer}>
                  {EXPENDITURE_STRUCTURE[category].map((sub) => (
                    <TouchableOpacity
                      key={sub}
                      style={[
                        styles.categoryChip,
                        subCategory === sub && {
                          backgroundColor: secondaryBrand,
                          borderColor: secondaryBrand,
                        },
                      ]}
                      onPress={() => setSubCategory(sub)}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          subCategory === sub && { color: "#fff" },
                        ]}
                      >
                        {sub}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={[styles.modalInput, { marginTop: 8 }]}
                  placeholder="Or type custom sub-category..."
                  value={subCategory}
                  onChangeText={setSubCategory}
                  placeholderTextColor="#94A3B8"
                />
              </View>
            )}

            <View style={styles.modalInputWrapper}>
              <Text style={styles.modalInputLabel}>WHAT WAS PURCHASED?</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Printer Toner"
                value={itemName}
                onChangeText={setItemName}
                placeholderTextColor="#94A3B8"
              />
            </View>
            <View style={styles.modalInputWrapper}>
              <Text style={styles.modalInputLabel}>AMOUNT (₵)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="0.00"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.modalInputWrapper}>
              <Text style={styles.modalInputLabel}>DATE OF EXPENDITURE</Text>
              {Platform.OS === "web" ? (
                <View
                  style={[
                    styles.modalInput,
                    { flexDirection: "row", alignItems: "center", gap: 10 },
                  ]}
                >
                  <SVGIcon
                    name="calendar-outline"
                    size={18}
                    color={primaryBrand}
                  />
                  <TextInput
                    style={
                      {
                        flex: 1,
                        backgroundColor: "transparent",
                        fontSize: 16,
                        fontWeight: "600",
                        color: "#1E293B",
                        outlineStyle: "none",
                      } as any
                    }
                    defaultValue={itemDate.toISOString().split("T")[0]}
                    onChangeText={(val) => {
                      const parsed = moment(
                        val,
                        [
                          "YYYY-MM-DD",
                          "DD-MM-YYYY",
                          "MM-DD-YYYY",
                          "DD/MM/YYYY",
                          "MM/DD/YYYY",
                        ],
                        true,
                      );
                      if (parsed.isValid()) {
                        setItemDate(parsed.toDate());
                      }
                    }}
                    {...({ type: "date" } as any)}
                  />
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={[
                      styles.modalInput,
                      { flexDirection: "row", alignItems: "center", gap: 10 },
                    ]}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <SVGIcon
                      name="calendar-outline"
                      size={18}
                      color={primaryBrand}
                    />
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "600",
                        color: "#1E293B",
                      }}
                    >
                      {itemDate.toLocaleDateString()}
                    </Text>
                  </TouchableOpacity>

                  {showDatePicker && DateTimePicker && (
                    <DateTimePicker
                      value={itemDate}
                      mode="date"
                      display="default"
                      onChange={(event: any, selectedDate?: Date) => {
                        setShowDatePicker(false);
                        if (selectedDate) setItemDate(selectedDate);
                      }}
                      maximumDate={new Date()}
                    />
                  )}
                </>
              )}
            </View>

            <View style={styles.modalInputWrapper}>
              <Text style={styles.modalInputLabel}>RECEIPT (OPTIONAL)</Text>
              <TouchableOpacity
                style={[styles.modalInput, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}
                onPress={handlePickReceipt}
                disabled={uploadingReceipt}
              >
                <SVGIcon name={receiptUrl ? "checkmark-circle" : "camera-outline"} size={20} color={receiptUrl ? "#10B981" : primaryBrand} />
                <Text style={{ fontSize: 16, color: receiptUrl ? "#10B981" : "#1E293B", fontWeight: receiptUrl ? "700" : "500" }}>
                  {uploadingReceipt ? "Uploading..." : receiptUrl ? "Receipt Uploaded" : "Attach Image"}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: secondaryBrand, marginBottom: 20 }]}
              onPress={handleSave}
              disabled={saving || uploadingReceipt}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Save Entry</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#1E293B" },
  modalInputWrapper: { marginBottom: 20 },
  modalInputLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#94A3B8",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  modalInput: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#1E293B",
  },
  saveBtn: {
    height: 55,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  categoryChipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
});
