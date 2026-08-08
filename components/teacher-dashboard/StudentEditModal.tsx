import DateTimePicker from "@react-native-community/datetimepicker";
import moment from "moment";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { COLORS, SHADOWS, SIZES } from "../../constants/theme";
import SVGIcon from "../SVGIcon";
import { StudentData } from "./StudentCard";

interface StudentEditModalProps {
  visible: boolean;
  type: "none" | "edit_profile" | "edit_email" | "edit_password" | "promote_repeat";
  student: StudentData | null;
  onClose: () => void;
  onUpdateProfile: (data: {
    firstName: string;
    lastName: string;
    phone: string;
    emergencyPhone: string;
    parentPhone: string;
    dob: Date | null;
  }) => Promise<void>;
  onUpdateEmail: (email: string) => Promise<void>;
  onUpdatePassword: (password: string) => Promise<void>;
  updating: boolean;
}

export const StudentEditModal: React.FC<StudentEditModalProps> = ({
  visible,
  type,
  student,
  onClose,
  onUpdateProfile,
  onUpdateEmail,
  onUpdatePassword,
  updating,
}) => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [dob, setDob] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (student) {
      setFirstName(student.profile.firstName || "");
      setLastName(student.profile.lastName || "");
      setEmail(student.profile.email || "");
      setPhone(student.profile.phone || "");
      setEmergencyPhone(student.profile.emergencyPhone || "");
      setParentPhone(student.profile.parentPhone || "");
      if (student.dateOfBirth) {
        setDob(student.dateOfBirth.toDate ? student.dateOfBirth.toDate() : new Date(student.dateOfBirth));
      } else {
        setDob(null);
      }
    }
  }, [student, visible]);

  if (type === "none" || type === "promote_repeat") return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalContainer}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {type.replace("_", " ").toUpperCase()}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <SVGIcon name="close" size={24} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20 }}>
            {type === "edit_profile" && (
              <View>
                <Text style={styles.inputLabel}>FIRST NAME</Text>
                <TextInput
                  style={styles.textInput}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First Name"
                />
                <Text style={[styles.inputLabel, { marginTop: 15 }]}>LAST NAME</Text>
                <TextInput
                  style={styles.textInput}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Last Name"
                />
                <Text style={[styles.inputLabel, { marginTop: 15 }]}>PHONE NUMBER</Text>
                <TextInput
                  style={styles.textInput}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Phone Number"
                  keyboardType="phone-pad"
                />
                <Text style={[styles.inputLabel, { marginTop: 15 }]}>EMERGENCY PHONE</Text>
                <TextInput
                  style={styles.textInput}
                  value={emergencyPhone}
                  onChangeText={setEmergencyPhone}
                  placeholder="Emergency Contact Phone"
                  keyboardType="phone-pad"
                />
                <Text style={[styles.inputLabel, { marginTop: 15 }]}>PARENT PHONE</Text>
                <TextInput
                  style={styles.textInput}
                  value={parentPhone}
                  onChangeText={setParentPhone}
                  placeholder="Parent/Guardian Phone"
                  keyboardType="phone-pad"
                />
                <Text style={[styles.inputLabel, { marginTop: 15 }]}>
                  DATE OF BIRTH
                </Text>
                {Platform.OS === "web" ? (
                  <TextInput
                    style={styles.textInput}
                    // @ts-ignore - web only
                    type="date"
                    value={dob ? dob.toISOString().split("T")[0] : ""}
                    onChange={(e: any) => {
                      const val = e.target.value;
                      setDob(val ? new Date(val) : null);
                    }}
                  />
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.textInput}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <Text style={{ color: dob ? "#1E293B" : "#94A3B8" }}>
                        {dob ? moment(dob).format("MMM DD, YYYY") : "Select Date"}
                      </Text>
                    </TouchableOpacity>
                    {showDatePicker && (
                      <DateTimePicker
                        value={dob || new Date()}
                        mode="date"
                        display="default"
                        onChange={(event: any, date?: Date) => {
                          setShowDatePicker(false);
                          if (date) setDob(date);
                        }}
                      />
                    )}
                  </>
                )}
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: COLORS.primary }]}
                  onPress={() =>
                    onUpdateProfile({
                      firstName,
                      lastName,
                      phone,
                      emergencyPhone,
                      parentPhone,
                      dob,
                    })
                  }
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {type === "edit_email" && (
              <View>
                <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
                <TextInput
                  style={styles.textInput}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: COLORS.primary }]}
                  onPress={() => onUpdateEmail(email)}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveBtnText}>Update Email</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {type === "edit_password" && (
              <View>
                <Text style={styles.inputLabel}>NEW PASSWORD</Text>
                <TextInput
                  style={styles.textInput}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="Min 6 characters"
                />
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: COLORS.primary }]}
                  onPress={() => onUpdatePassword(password)}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveBtnText}>Update Password</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  modalTitle: {
    fontSize: SIZES.large,
    fontWeight: "bold",
    color: "#0F172A",
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#94A3B8",
    marginBottom: 8,
    letterSpacing: 1,
  },
  textInput: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    fontSize: 14,
    color: "#1E293B",
  },
  saveBtn: {
    height: 55,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 25,
  },
  saveBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
  },
});
