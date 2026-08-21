import React from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import SVGIcon from "../SVGIcon";
import { VIBE, styles } from "../../constants/admin-dashboard/ManageFeesStyles";
import { StudentDraft } from "../../constants/admin-dashboard/ManageFeesTypes";

interface FeeBulkActionStripProps {
  activeMode: "billing" | "discounts";
  amount: string;
  setAmount: (amt: string) => void;
  canEdit: boolean;
  onToggleSelectAll: () => void;
  filteredStudents: StudentDraft[];
  selectedStudentUids: Set<string>;
}

export const FeeBulkActionStrip: React.FC<FeeBulkActionStripProps> = ({
  activeMode,
  amount,
  setAmount,
  canEdit,
  onToggleSelectAll,
  filteredStudents,
  selectedStudentUids,
}) => {
  const isBilling = activeMode === "billing";
  const iconColor = isBilling ? VIBE.primary : VIBE.success;
  const symColor = isBilling ? VIBE.primary : VIBE.success;
  const symbol = isBilling ? "₵" : "-";
  const placeholder = isBilling ? "Bulk Bill (+/-)" : "Bulk Discount (₵)";

  const isAllSelected =
    filteredStudents.length > 0 &&
    filteredStudents.every((s) => selectedStudentUids.has(s.uid));

  return (
    <View style={styles.bulkActionStrip}>
      <View style={styles.bulkInputContainer}>
        <Text style={[styles.bulkSym, { color: symColor }]}>{symbol}</Text>
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={VIBE.muted}
          style={styles.bulkInput}
          keyboardType="numbers-and-punctuation"
          value={amount}
          onChangeText={setAmount}
          editable={canEdit}
        />
      </View>
      <TouchableOpacity style={styles.checkAllBtn} onPress={onToggleSelectAll}>
        <SVGIcon
          name={isAllSelected ? "checkbox" : "square"}
          size={28}
          color={iconColor}
        />
        <Text style={styles.checkAllText}>SELECT ALL</Text>
      </TouchableOpacity>
    </View>
  );
};
