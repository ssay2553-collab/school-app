import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import moment from "moment";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import { useToast } from "../../contexts/ToastContext";
import { copyToClipboard } from "../../utils/copyToClipboard";
import SVGIcon from "../SVGIcon";

const DateTimePicker =
  Platform.OS !== "web"
    ? require("@react-native-community/datetimepicker").default
    : null;

const uriToBase64 = async (uri: string): Promise<string> => {
  if (!uri) return "";
  if (uri.startsWith("data:")) return uri;

  try {
    if (Platform.OS === "web") {
      const response = await fetch(uri);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } else {
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 300, height: 300 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (manipResult.base64) {
        return `data:image/jpeg;base64,${manipResult.base64}`;
      }
      const base64Data = await FileSystem.readAsStringAsync(manipResult.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return `data:image/jpeg;base64,${base64Data}`;
    }
  } catch (e) {
    console.error("Error converting URI to base64:", e);
    return uri;
  }
};

export interface StudentData {
  uid: string;
  parentLinkCode?: string;
  signupCode?: string;
  profile: {
    firstName: string;
    lastName: string;
    email?: string;
    studentID?: string;
    phone?: string;
    emergencyPhone?: string;
    parentPhone?: string;
    parentName?: string;
    parent2Phone?: string;
    parent2Name?: string;
    parentLinkCode?: string;
    profileImage?: string;
    photoURL?: string;
    dob?: any;
  };
  classId: string;
  dateOfBirth?: any;
  photoURL?: string;
  parentUids?: string[];
  parents?: Array<{
    uid: string;
    firstName: string;
    lastName: string;
    phone: string;
  }>;
}

interface StudentEditModalProps {
  visible: boolean;
  student: StudentData | null;
  onClose: () => void;
  onUpdateProfile: (data: {
    firstName: string;
    lastName: string;
    parentName: string;
    parentPhone: string;
    parent2Name?: string;
    parent2Phone?: string;
    dob: Date | null;
    profileImage?: string | null;
  }) => Promise<void>;
  updating: boolean;
}

export const StudentEditModal: React.FC<StudentEditModalProps> = ({
  visible,
  student,
  onClose,
  onUpdateProfile,
  updating,
}) => {
  const { showToast } = useToast();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parent2Name, setParent2Name] = useState("");
  const [parent2Phone, setParent2Phone] = useState("");
  const [parentLinkCode, setParentLinkCode] = useState("");
  const [dob, setDob] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [showYearSelector, setShowYearSelector] = useState(false);

  // Generate a list of recent birth years for quick year selection (e.g. 2000 to current year)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from(
    { length: currentYear - 2000 + 1 },
    (_, i) => currentYear - i
  );

  useEffect(() => {
    if (student) {
      setFirstName(student.profile?.firstName || "");
      setLastName(student.profile?.lastName || "");
      setParentName(student.profile?.parentName || "");
      setParentPhone(student.profile?.parentPhone || "");
      setParent2Name(student.profile?.parent2Name || "");
      setParent2Phone(student.profile?.parent2Phone || "");
      setParentLinkCode(
        student.parentLinkCode ||
          student.signupCode ||
          student.profile?.parentLinkCode ||
          ""
      );
      setProfileImage(
        student.profile?.profileImage ||
          student.profile?.photoURL ||
          student.photoURL ||
          null
      );

      const rawDob = student.profile?.dob || student.dateOfBirth;
      if (rawDob) {
        let parsedDate: Date | null = null;
        if (typeof rawDob.toDate === "function") {
          parsedDate = rawDob.toDate();
        } else if (rawDob instanceof Date) {
          parsedDate = rawDob;
        } else {
          parsedDate = new Date(rawDob);
        }
        if (parsedDate && parsedDate instanceof Date && !isNaN(parsedDate.getTime())) {
          setDob(parsedDate);
        } else {
          setDob(null);
        }
      } else {
        setDob(null);
      }
    }
  }, [student, visible]);

  if (!visible || !student) return null;

  const handleCopyLinkCode = async () => {
    if (!parentLinkCode) {
      showToast({ message: "No Parent Link Code available.", type: "error" });
      return;
    }
    const success = await copyToClipboard(parentLinkCode);
    if (success) {
      showToast({
        message: `Copied Parent Link Code: ${parentLinkCode}`,
        type: "success",
      });
    } else {
      showToast({ message: "Failed to copy code.", type: "error" });
    }
  };

  const handleTakeCameraPhoto = async () => {
    try {
      if (Platform.OS !== "web") {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          showToast({
            message: "Camera permission is required to take photo.",
            type: "error",
          });
          return;
        }
      }
      setImageLoading(true);
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const base64Uri = await uriToBase64(asset.uri);
        setProfileImage(base64Uri);
        showToast({ message: "Photo captured!", type: "success" });
      }
    } catch (err) {
      console.error("Camera error:", err);
      showToast({ message: "Failed to capture photo.", type: "error" });
    } finally {
      setImageLoading(false);
    }
  };

  const handlePickGalleryImage = async () => {
    try {
      if (Platform.OS !== "web") {
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          showToast({
            message: "Media library permission is required.",
            type: "error",
          });
          return;
        }
      }
      setImageLoading(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const base64Uri = await uriToBase64(asset.uri);
        setProfileImage(base64Uri);
        showToast({ message: "Photo selected!", type: "success" });
      }
    } catch (err) {
      console.error("Gallery error:", err);
      showToast({ message: "Failed to select photo.", type: "error" });
    } finally {
      setImageLoading(false);
    }
  };

  const formatDobForWebInput = (d: Date | null): string => {
    if (!d || !(d instanceof Date) || isNaN(d.getTime())) return "";
    try {
      return d.toISOString().split("T")[0];
    } catch {
      return "";
    }
  };

  const handleSelectYear = (year: number) => {
    const newDate = dob && !isNaN(dob.getTime()) ? new Date(dob) : new Date(2015, 0, 1);
    newDate.setFullYear(year);
    setDob(newDate);
    setShowYearSelector(false);
  };

  const handleNativeDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (event && event.type === "dismissed") {
      return;
    }
    if (date && date instanceof Date && !isNaN(date.getTime())) {
      setDob(date);
    }
  };

  const handleSave = () => {
    if (!firstName.trim()) {
      showToast({ message: "First name is required.", type: "error" });
      return;
    }
    if (!lastName.trim()) {
      showToast({ message: "Last name is required.", type: "error" });
      return;
    }

    const validDob = dob && dob instanceof Date && !isNaN(dob.getTime()) ? dob : null;

    onUpdateProfile({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      parentName: parentName.trim(),
      parentPhone: parentPhone.trim(),
      parent2Name: parent2Name.trim(),
      parent2Phone: parent2Phone.trim(),
      dob: validDob,
      profileImage,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalContainer}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>EDIT STUDENT PROFILE</Text>
            <TouchableOpacity onPress={onClose} disabled={updating}>
              <SVGIcon name="close" size={24} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* PARENT LINK CODE BANNER */}
            {parentLinkCode ? (
              <View style={styles.linkCodeBox}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.linkCodeTitle}>PARENTS LINK CODE</Text>
                  <Text style={styles.linkCodeValue}>{parentLinkCode}</Text>
                </View>
                <TouchableOpacity
                  style={styles.copyBtn}
                  onPress={handleCopyLinkCode}
                >
                  <SVGIcon name="copy-outline" size={16} color="#FFF" />
                  <Text style={styles.copyBtnText}>Copy Code</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* PROFILE IMAGE SECTION */}
            <View style={styles.avatarSection}>
              <View style={styles.avatarWrapper}>
                {profileImage ? (
                  <Image source={{ uri: profileImage }} style={styles.avatarImg} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarInitial}>
                      {(firstName.charAt(0) || "S").toUpperCase()}
                    </Text>
                  </View>
                )}
                {imageLoading && (
                  <View style={styles.avatarOverlay}>
                    <ActivityIndicator color="#FFF" />
                  </View>
                )}
              </View>

              <View style={styles.photoActionsRow}>
                <TouchableOpacity
                  style={[styles.photoBtn, styles.cameraBtn]}
                  onPress={handleTakeCameraPhoto}
                  disabled={updating || imageLoading}
                >
                  <SVGIcon name="camera" size={16} color="#FFF" />
                  <Text style={styles.photoBtnText}>Take Camera Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.photoBtn, styles.galleryBtn]}
                  onPress={handlePickGalleryImage}
                  disabled={updating || imageLoading}
                >
                  <SVGIcon name="images" size={16} color={COLORS.primary} />
                  <Text style={[styles.photoBtnText, { color: COLORS.primary }]}>
                    Gallery
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* STUDENT NAME */}
            <Text style={styles.inputLabel}>FIRST NAME *</Text>
            <TextInput
              style={styles.textInput}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First Name"
              placeholderTextColor="#94A3B8"
            />

            <Text style={[styles.inputLabel, { marginTop: 15 }]}>
              SURNAME / LAST NAME *
            </Text>
            <TextInput
              style={styles.textInput}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last Name"
              placeholderTextColor="#94A3B8"
            />

            {/* DATE OF BIRTH WITH EASY CROSS-PLATFORM PICKER & QUICK YEAR SELECT */}
            <Text style={[styles.inputLabel, { marginTop: 15 }]}>
              DATE OF BIRTH
            </Text>

            <View style={styles.dobContainer}>
              {Platform.OS === "web" ? (
                <View style={styles.webDateRow}>
                  <TextInput
                    style={[styles.textInput, { flex: 1 }]}
                    // @ts-ignore - web date input
                    type="date"
                    value={formatDobForWebInput(dob)}
                    onChange={(e: any) => {
                      const val = e.target?.value || e.nativeEvent?.text;
                      if (!val) {
                        setDob(null);
                        return;
                      }
                      const parsed = new Date(val);
                      if (!isNaN(parsed.getTime())) {
                        setDob(parsed);
                      }
                    }}
                  />
                  {dob && (
                    <TouchableOpacity
                      style={styles.clearDateBtn}
                      onPress={() => setDob(null)}
                    >
                      <SVGIcon name="close-circle" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View style={styles.nativeDateRow}>
                  <TouchableOpacity
                    style={styles.datePickerBtn}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <SVGIcon name="calendar" size={18} color={COLORS.primary} />
                    <Text style={styles.datePickerText}>
                      {dob && !isNaN(dob.getTime())
                        ? moment(dob).format("MMM DD, YYYY")
                        : "Select Date of Birth"}
                    </Text>
                  </TouchableOpacity>

                  {dob && (
                    <TouchableOpacity
                      style={styles.clearDateBtn}
                      onPress={() => setDob(null)}
                    >
                      <SVGIcon name="close-circle" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Quick Birth Year Selector Toggle */}
              <TouchableOpacity
                style={styles.quickYearToggle}
                onPress={() => setShowYearSelector(!showYearSelector)}
              >
                <SVGIcon name="time" size={14} color={COLORS.primary} />
                <Text style={styles.quickYearToggleText}>
                  {showYearSelector
                    ? "Hide Quick Year Selector"
                    : `Quick Select Year (${dob && !isNaN(dob.getTime()) ? dob.getFullYear() : "Select"})`}
                </Text>
              </TouchableOpacity>

              {showYearSelector && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.yearScroll}
                >
                  {yearOptions.map((y) => {
                    const isSelected = dob && !isNaN(dob.getTime()) && dob.getFullYear() === y;
                    return (
                      <TouchableOpacity
                        key={y}
                        style={[
                          styles.yearChip,
                          isSelected && styles.yearChipSelected,
                        ]}
                        onPress={() => handleSelectYear(y)}
                      >
                        <Text
                          style={[
                            styles.yearChipText,
                            isSelected && styles.yearChipTextSelected,
                          ]}
                        >
                          {y}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            {/* NATIVE DATETIME PICKER MODAL */}
            {Platform.OS !== "web" && showDatePicker && DateTimePicker && (
              <DateTimePicker
                value={dob && !isNaN(dob.getTime()) ? dob : new Date(2015, 0, 1)}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                maximumDate={new Date()}
                minimumDate={new Date(1990, 0, 1)}
                onChange={handleNativeDateChange}
              />
            )}

            {/* PARENT DETAILS */}
            <View style={styles.sectionDivider} />
            <Text style={styles.sectionHeader}>PARENT / GUARDIAN INFO</Text>

            <Text style={styles.inputLabel}>PRIMARY PARENT NAME</Text>
            <TextInput
              style={styles.textInput}
              value={parentName}
              onChangeText={setParentName}
              placeholder="Parent/Guardian Full Name"
              placeholderTextColor="#94A3B8"
            />

            <Text style={[styles.inputLabel, { marginTop: 15 }]}>
              PRIMARY PARENT CONTACT NUMBER
            </Text>
            <TextInput
              style={styles.textInput}
              value={parentPhone}
              onChangeText={setParentPhone}
              placeholder="Primary Phone Number"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
            />

            <Text style={[styles.inputLabel, { marginTop: 15 }]}>
              SECONDARY PARENT NAME (OPTIONAL)
            </Text>
            <TextInput
              style={styles.textInput}
              value={parent2Name}
              onChangeText={setParent2Name}
              placeholder="2nd Parent/Guardian Name"
              placeholderTextColor="#94A3B8"
            />

            <Text style={[styles.inputLabel, { marginTop: 15 }]}>
              SECONDARY PARENT CONTACT NUMBER (OPTIONAL)
            </Text>
            <TextInput
              style={styles.textInput}
              value={parent2Phone}
              onChangeText={setParent2Phone}
              placeholder="2nd Parent Phone Number"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
            />

            {/* SAVE BUTTON */}
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: COLORS.primary }]}
              onPress={handleSave}
              disabled={updating || imageLoading}
            >
              {updating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Save Student Profile</Text>
              )}
            </TouchableOpacity>
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
    width: "92%",
    maxWidth: 520,
    maxHeight: "90%",
    backgroundColor: "#FFFFFF",
    borderRadius: SIZES.radius || 20,
    padding: 20,
    ...SHADOWS.medium,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  modalTitle: {
    fontSize: SIZES.medium || 16,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: 0.5,
  },
  scrollContent: {
    paddingVertical: 15,
  },
  linkCodeBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.primary + "30",
  },
  linkCodeTitle: {
    fontSize: 9,
    fontWeight: "900",
    color: COLORS.primary,
    letterSpacing: 0.8,
  },
  linkCodeValue: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1E1B4B",
    letterSpacing: 1.5,
    marginTop: 2,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  copyBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 20,
  },
  avatarWrapper: {
    width: 90,
    height: 90,
    borderRadius: 45,
    overflow: "hidden",
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: COLORS.primary,
    marginBottom: 12,
  },
  avatarImg: {
    width: "100%",
    height: "100%",
  },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitial: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "800",
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  photoActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  photoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  cameraBtn: {
    backgroundColor: COLORS.primary,
  },
  galleryBtn: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: COLORS.primary + "30",
  },
  photoBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFF",
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#64748B",
    marginBottom: 6,
    letterSpacing: 0.8,
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
  dobContainer: {
    gap: 8,
  },
  webDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  nativeDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  datePickerBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  datePickerText: {
    fontSize: 14,
    color: "#1E293B",
    fontWeight: "500",
  },
  clearDateBtn: {
    padding: 6,
  },
  quickYearToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  quickYearToggleText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary,
  },
  yearScroll: {
    gap: 6,
    paddingVertical: 6,
  },
  yearChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  yearChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  yearChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  yearChipTextSelected: {
    color: "#FFFFFF",
  },
  sectionDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 20,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "900",
    color: COLORS.primary,
    letterSpacing: 1,
    marginBottom: 15,
  },
  saveBtn: {
    height: 52,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 25,
    ...SHADOWS.light,
  },
  saveBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
  },
});
