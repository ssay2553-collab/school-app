import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import SVGIcon from "../SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { getStudentFinalEmail } from "../../utils/authUnify";

export interface StudentRow {
  id: string;
  fullName: string;
  username: string;
  password: string;
  parentName: string;
  parentPhone: string;
}

interface BulkStudentRegisterModalProps {
  visible: boolean;
  onClose: () => void;
  classes: any[];
  selectedClassId: string;
  onRegister: (classId: string, students: StudentRow[]) => Promise<boolean | void>;
  showToast?: (props: { message: string; type: "success" | "error" | "info" }) => void;
}

export const BulkStudentRegisterModal: React.FC<BulkStudentRegisterModalProps> = ({
  visible,
  onClose,
  classes,
  selectedClassId,
  onRegister,
  showToast,
}) => {
  const [targetClassId, setTargetClassId] = useState("");
  const [studentRows, setStudentRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState<{ [id: string]: boolean }>({});

  const togglePassword = (id: string) => {
    setShowPasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    if (visible) {
      setTargetClassId(selectedClassId && selectedClassId !== "all" ? selectedClassId : classes[0]?.id || "");
      setStudentRows([
        {
          id: Date.now().toString(),
          fullName: "",
          username: "",
          password: "123456",
          parentName: "",
          parentPhone: "",
        },
      ]);
    }
  }, [visible, selectedClassId, classes]);

  const addRow = () => {
    setStudentRows((prev) => [
      ...prev,
      {
        id: `${Date.now()}_${Math.random()}`,
        fullName: "",
        username: "",
        password: "123456",
        parentName: "",
        parentPhone: "",
      },
    ]);
  };

  const removeRow = (id: string) => {
    if (studentRows.length === 1) {
      showToast?.({ message: "You need at least one student entry.", type: "info" });
      return;
    }
    setStudentRows((prev) => prev.filter((row) => row.id !== id));
  };

  const updateRow = (id: string, field: keyof StudentRow, value: string) => {
    setStudentRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: value };
        if (field === "fullName") {
          const autoUser = value
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, "")
            .replace(/\s+/g, ".")
            .replace(/^\.|\.$/g, "");
          updated.username = autoUser;
        }
        return updated;
      })
    );
  };

  const handleSubmit = async () => {
    if (!targetClassId || targetClassId === "all") {
      showToast?.({ message: "Please select a target class.", type: "error" });
      return;
    }

    const validRows = studentRows.filter((r) => r.fullName.trim() !== "");
    if (validRows.length === 0) {
      showToast?.({ message: "Please enter at least one student's full name.", type: "error" });
      return;
    }

    setLoading(true);
    try {
      const success = await onRegister(targetClassId, validRows);
      if (success !== false) {
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === "android"}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheetBody}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Bulk Student Registration</Text>
              <Text style={styles.sheetSubtitle}>
                REGISTER MULTIPLE STUDENTS & ACCOUNTS INSTANTLY
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeRound} activeOpacity={0.7}>
              <SVGIcon name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40, gap: 16 }}
            style={{ width: "100%" }}
          >
            {/* Target Class Selector */}
            <View style={{ gap: 6 }}>
              <Text style={styles.label}>TARGET CLASS *</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
              >
                {classes.map((c) => {
                  const isSelected = targetClassId === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      activeOpacity={0.7}
                      onPress={() => setTargetClassId(c.id)}
                      style={[
                        styles.classPill,
                        isSelected && {
                          backgroundColor: COLORS.primary,
                          borderColor: COLORS.primary,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.classPillText,
                          isSelected && { color: "#fff" },
                        ]}
                      >
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Student Rows */}
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={styles.label}>STUDENTS LIST ({studentRows.length})</Text>
                <TouchableOpacity
                  onPress={addRow}
                  style={styles.addRowBtnTop}
                  activeOpacity={0.7}
                >
                  <SVGIcon name="add" size={16} color={COLORS.primary} />
                  <Text style={styles.addRowBtnTopText}>Add Row</Text>
                </TouchableOpacity>
              </View>

              {studentRows.map((row, index) => (
                <View key={row.id} style={styles.studentCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.indexBadge}>
                      <Text style={styles.indexBadgeText}>#{index + 1}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => removeRow(row.id)}
                      style={styles.removeRowBtn}
                      activeOpacity={0.7}
                    >
                      <SVGIcon name="trash" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>

                  <View style={{ gap: 10 }}>
                    <View>
                      <Text style={styles.fieldLabel}>Student Full Name *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. Kofi Mensah"
                        value={row.fullName}
                        onChangeText={(v) => updateRow(row.id, "fullName", v)}
                      />
                    </View>

                    <View style={{ flexDirection: Platform.OS === "web" ? "row" : "column", gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>Username / Handle</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="e.g. kofi.mensah"
                          value={row.username}
                          onChangeText={(v) => updateRow(row.id, "username", v)}
                          autoCapitalize="none"
                        />
                        <Text style={styles.emailHint}>
                          Email: {getStudentFinalEmail(row.username || "user")}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>Password</Text>
                        <View style={{
                          flexDirection: "row",
                          alignItems: "center",
                          backgroundColor: "#fff",
                          borderWidth: 1,
                          borderColor: "#E2E8F0",
                          borderRadius: 12,
                          paddingHorizontal: 12,
                          height: 48,
                        }}>
                          <TextInput
                            style={[styles.input, { flex: 1, borderWidth: 0, paddingHorizontal: 0, height: "100%", backgroundColor: "transparent" }]}
                            placeholder="Default: 123456"
                            value={row.password}
                            onChangeText={(v) => updateRow(row.id, "password", v)}
                            secureTextEntry={!showPasswords[row.id]}
                          />
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <TouchableOpacity onPress={() => togglePassword(row.id)} activeOpacity={0.7}>
                              <SVGIcon name={showPasswords[row.id] ? "eye-off" : "eye"} size={20} color="#64748B" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => updateRow(row.id, "password", "")} activeOpacity={0.7}>
                              <SVGIcon name="close" size={18} color="#64748B" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    </View>

                    <View style={{ flexDirection: Platform.OS === "web" ? "row" : "column", gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>Parent Name (Optional)</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Parent / Guardian Name"
                          value={row.parentName}
                          onChangeText={(v) => updateRow(row.id, "parentName", v)}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>Parent Phone (Optional)</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="e.g. 0241234567"
                          keyboardType="phone-pad"
                          value={row.parentPhone}
                          onChangeText={(v) => updateRow(row.id, "parentPhone", v)}
                        />
                      </View>
                    </View>
                  </View>
                </View>
              ))}

              <TouchableOpacity
                onPress={addRow}
                style={styles.addRowBtnBottom}
                activeOpacity={0.8}
              >
                <SVGIcon name="add-circle" size={20} color={COLORS.primary} />
                <Text style={styles.addRowBtnBottomText}>Click to add more students (+)</Text>
              </TouchableOpacity>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
              style={{ marginTop: 10 }}
            >
              <View style={styles.submitBtn}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.submitBtnText}>
                      SUBMIT & REGISTER ({studentRows.length}) STUDENTS
                    </Text>
                    <SVGIcon name="checkmark-circle" size={20} color="#fff" />
                  </>
                )}
              </View>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
  },
  sheetBody: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: "90%",
    ...SHADOWS.large,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 10,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1E293B",
  },
  sheetSubtitle: {
    fontSize: 9,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 1,
    marginTop: 2,
  },
  closeRound: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  label: {
    fontSize: 11,
    fontWeight: "900",
    color: "#475569",
    letterSpacing: 0.5,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
    marginBottom: 4,
  },
  emailHint: {
    fontSize: 9,
    fontWeight: "700",
    color: "#94A3B8",
    marginTop: 3,
    marginLeft: 2,
  },
  classPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  classPillText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1E293B",
  },
  addRowBtnTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  addRowBtnTopText: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.primary,
  },
  studentCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  indexBadge: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  indexBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#475569",
  },
  removeRowBtn: {
    padding: 4,
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
  },
  addRowBtnBottom: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EEF2FF",
    borderWidth: 1.5,
    borderColor: "#C7D2FE",
    borderStyle: "dashed",
    borderRadius: 16,
    paddingVertical: 14,
  },
  addRowBtnBottomText: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.primary,
  },
  submitBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 16,
    ...SHADOWS.medium,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 0.5,
  },
});
