import { Picker } from "@react-native-picker/picker";
import React from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import SVGIcon from "../../../components/SVGIcon";
import { CAMBRIDGE_SUBJECTS, GES_SUBJECTS } from "../../../constants/Curriculum";
import { COLORS, SHADOWS } from "../../../constants/theme";
import {
  AssignmentModalState,
  PermissionLevel,
  PERMISSION_KEYS,
  PERMISSION_LEVELS,
  User,
} from "../../../hooks/admin-dashboard/manage-users-types";

const { width } = Dimensions.get("window");

interface AssignmentModalProps {
  state: AssignmentModalState;
  onClose: () => void;
  onSetType: (state: AssignmentModalState) => void;
  allClasses: { id: string; name: string }[];
  updating: boolean;
  uploadingImage: boolean;
  handleUploadProfileImage: (user: User, source: "library" | "camera") => void;
  // Forms and their setters/handlers
  newsPermission: boolean;
  setNewsPermission: (val: boolean) => void;
  handleAssignRole: (role: string) => void;
  tempPermissions: Record<string, PermissionLevel>;
  setTempPermissions: React.Dispatch<React.SetStateAction<Record<string, PermissionLevel>>>;
  handleUpdatePermissions: () => void;
  selectedClasses: string[];
  setSelectedClasses: React.Dispatch<React.SetStateAction<string[]>>;
  handleUpdateClasses: () => void;
  selectedSubjects: string[];
  setSelectedSubjects: React.Dispatch<React.SetStateAction<string[]>>;
  handleUpdateSubjects: () => void;
  handleAssignClassTeacher: (classId: string) => void;
  deptText: string;
  setDeptText: (val: string) => void;
  handleAssignDeptHead: (dept: string) => void;
  customRoleText: string;
  setCustomRoleText: (val: string) => void;
  editForm: any;
  setEditForm: React.Dispatch<React.SetStateAction<any>>;
  handleUpdateProfile: () => void;
  handleUpdateEmail: () => void;
  upgradeForm: any;
  setUpgradeForm: React.Dispatch<React.SetStateAction<any>>;
  handleUpgradeStaff: () => void;
  busLocations: string[];
  isAddingNewBusLoc: boolean;
  setIsAddingNewBusLoc: (val: boolean) => void;
  newBusLocInput: string;
  setNewBusLocInput: (val: string) => void;
  handleSaveNewBusLocation: (target?: User | null) => void;
  targetClassId: string;
  setTargetClassId: (val: string) => void;
  handlePromoteRepeat: (action: "Promote" | "Repeat") => void;
}

export const AssignmentModal: React.FC<AssignmentModalProps> = ({
  state,
  onClose,
  onSetType,
  allClasses,
  updating,
  uploadingImage,
  handleUploadProfileImage,
  newsPermission,
  setNewsPermission,
  handleAssignRole,
  tempPermissions,
  setTempPermissions,
  handleUpdatePermissions,
  selectedClasses,
  setSelectedClasses,
  handleUpdateClasses,
  selectedSubjects,
  setSelectedSubjects,
  handleUpdateSubjects,
  handleAssignClassTeacher,
  deptText,
  setDeptText,
  handleAssignDeptHead,
  customRoleText,
  setCustomRoleText,
  editForm,
  setEditForm,
  handleUpdateProfile,
  handleUpdateEmail,
  upgradeForm,
  setUpgradeForm,
  handleUpgradeStaff,
  busLocations,
  isAddingNewBusLoc,
  setIsAddingNewBusLoc,
  newBusLocInput,
  setNewBusLocInput,
  handleSaveNewBusLocation,
  targetClassId,
  setTargetClassId,
  handlePromoteRepeat,
}) => {
  if (state.type === "none") return null;

  return (
    <Modal visible={true} transparent animationType="slide">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.assignmentSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {state.type.replace("_", " ").toUpperCase()}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <SVGIcon name="close" size={24} color="#94A3B8" />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={{ padding: 25, paddingBottom: 60 }}
            showsVerticalScrollIndicator={false}
          >
            {state.type === "permissions" && (
              <>
                {(state.target?.role === "teacher" ||
                  state.target?.role === "staff" ||
                  state.target?.role === "admin") && (
                  <View style={{ marginBottom: 30 }}>
                    <Text style={styles.sectionHeader}>Authority & Assignments</Text>
                    <View style={styles.actionGrid}>
                      <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => onSetType({ ...state, type: "class_teacher" })}
                      >
                        <SVGIcon name="school" size={24} color={COLORS.primary} />
                        <Text style={styles.actionLabel}>Class Master</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => onSetType({ ...state, type: "dept_head" })}
                      >
                        <SVGIcon name="business" size={24} color={COLORS.primary} />
                        <Text style={styles.actionLabel}>Dept Head</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => onSetType({ ...state, type: "manage_classes" })}
                      >
                        <SVGIcon name="layers" size={24} color={COLORS.primary} />
                        <Text style={styles.actionLabel}>Teaching Classes</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => onSetType({ ...state, type: "manage_subjects" })}
                      >
                        <SVGIcon name="book" size={24} color={COLORS.primary} />
                        <Text style={styles.actionLabel}>Subjects</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => onSetType({ ...state, type: "other" })}
                      >
                        <SVGIcon name="star" size={24} color={COLORS.primary} />
                        <Text style={styles.actionLabel}>Other Roles</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                <Text style={styles.sectionHeader}>Delegated Permissions</Text>
                {PERMISSION_KEYS.map((pk) => (
                  <View key={pk.key} style={styles.permItem}>
                    <Text style={styles.permTitle}>{pk.label}</Text>
                    <View style={styles.permPickerBox}>
                      <Picker
                        selectedValue={(tempPermissions[pk.key] || "deny") as any}
                        onValueChange={(v) => {
                          const safe =
                            v === "full" || v === "view" || v === "edit" || v === "deny"
                              ? (v as PermissionLevel)
                              : "deny";
                          setTempPermissions((prev) => ({
                            ...prev,
                            [pk.key]: safe,
                          }));
                        }}
                      >
                        {PERMISSION_LEVELS.map((l) => (
                          <Picker.Item
                            key={l.value}
                            label={l.label}
                            value={l.value}
                          />
                        ))}
                      </Picker>
                    </View>
                  </View>
                ))}

                <TouchableOpacity
                  style={[
                    styles.saveBtn,
                    { backgroundColor: COLORS.success || "#05ac5b" },
                  ]}
                  onPress={handleUpdatePermissions}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveBtnText}>Commit Changes</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {state.type === "manage_classes" && (
              <View>
                <Text style={styles.pickerLabel}>Select Classes Taught</Text>
                <View style={styles.selectionGrid}>
                  {allClasses.map((c) => {
                    const isSelected = selectedClasses.includes(c.id);
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[
                          styles.selectionChip,
                          isSelected && { backgroundColor: COLORS.primary },
                        ]}
                        onPress={() => {
                          setSelectedClasses((prev) =>
                            isSelected
                              ? prev.filter((id) => id !== c.id)
                              : [...prev, c.id]
                          );
                        }}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            isSelected && { color: "#fff" },
                          ]}
                        >
                          {c.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TouchableOpacity
                  style={[
                    styles.saveBtn,
                    { backgroundColor: COLORS.primary, marginTop: 20 },
                  ]}
                  onPress={handleUpdateClasses}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save Class Selection</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {state.type === "manage_subjects" && (
              <View>
                <Text style={styles.pickerLabel}>Select Subjects Taught</Text>
                <View style={styles.selectionGrid}>
                  {[...new Set([...GES_SUBJECTS, ...CAMBRIDGE_SUBJECTS])]
                    .sort()
                    .map((s) => {
                      const isSelected = selectedSubjects.includes(s);
                      return (
                        <TouchableOpacity
                          key={s}
                          style={[
                            styles.selectionChip,
                            isSelected && { backgroundColor: COLORS.primary },
                          ]}
                          onPress={() => {
                            setSelectedSubjects((prev) =>
                              isSelected
                                ? prev.filter((sub) => sub !== s)
                                : [...prev, s]
                            );
                          }}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              isSelected && { color: "#fff" },
                            ]}
                          >
                            {s}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                </View>
                <TouchableOpacity
                  style={[
                    styles.saveBtn,
                    { backgroundColor: COLORS.primary, marginTop: 20 },
                  ]}
                  onPress={handleUpdateSubjects}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save Subject Selection</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {state.type === "class_teacher" && (
              <View>
                {allClasses.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.selectBtn}
                    onPress={() => handleAssignClassTeacher(c.id)}
                  >
                    <Text style={styles.selectBtnText}>{c.name}</Text>
                    <SVGIcon name="chevron-forward" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {state.type === "dept_head" && (
              <View>
                <Text style={[styles.pickerLabel, { marginBottom: 8 }]}>
                  Department
                </Text>
                <TextInput
                  placeholder="e.g. Mathematics, Science"
                  style={styles.textInput}
                  value={deptText}
                  onChangeText={setDeptText}
                />
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: COLORS.primary }]}
                  onPress={() => handleAssignDeptHead(deptText)}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveBtnText}>Assign Dept Head</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {state.type === "other" && (
              <View>
                <Text style={[styles.pickerLabel, { marginBottom: 8 }]}>
                  Custom Role
                </Text>
                <TextInput
                  placeholder="Enter custom role"
                  style={styles.textInput}
                  value={customRoleText}
                  onChangeText={setCustomRoleText}
                />
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: COLORS.primary }]}
                  onPress={() => handleAssignRole(customRoleText)}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveBtnText}>Assign Role</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {state.type === "edit_profile" && (
              <View>
                {/* Profile Image Editor */}
                <View style={styles.imageSection}>
                  <View style={styles.imageContainer}>
                    {state.target?.profile?.profileImage ? (
                      <Image
                        source={{ uri: state.target.profile.profileImage }}
                        style={styles.profileImg}
                      />
                    ) : (
                      <View style={styles.placeholderImg}>
                        <SVGIcon name="person" size={40} color="#CBD5E1" />
                      </View>
                    )}
                    {uploadingImage && (
                      <View style={styles.imageLoader}>
                        <ActivityIndicator color="#fff" size="small" />
                      </View>
                    )}
                  </View>
                  <View style={styles.imageActions}>
                    <TouchableOpacity
                      style={styles.imageActionBtn}
                      onPress={() =>
                        handleUploadProfileImage(state.target!, "library")
                      }
                      disabled={uploadingImage}
                    >
                      <SVGIcon name="image" size={20} color={COLORS.primary} />
                      <Text style={styles.imageActionText}>Gallery</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.imageActionBtn}
                      onPress={() =>
                        handleUploadProfileImage(state.target!, "camera")
                      }
                      disabled={uploadingImage}
                    >
                      <SVGIcon name="camera" size={20} color={COLORS.primary} />
                      <Text style={styles.imageActionText}>Camera</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.pickerLabel}>First Name</Text>
                <TextInput
                  style={[styles.textInput, { marginBottom: 15 }]}
                  value={editForm.firstName}
                  onChangeText={(t) => setEditForm((p: any) => ({ ...p, firstName: t }))}
                />
                <Text style={styles.pickerLabel}>Last Name</Text>
                <TextInput
                  style={[styles.textInput, { marginBottom: 15 }]}
                  value={editForm.lastName}
                  onChangeText={(t) => setEditForm((p: any) => ({ ...p, lastName: t }))}
                />
                <Text style={styles.pickerLabel}>Phone Number</Text>
                <TextInput
                  style={[styles.textInput, { marginBottom: 15 }]}
                  value={editForm.phone}
                  onChangeText={(t) => setEditForm((p: any) => ({ ...p, phone: t }))}
                  keyboardType="phone-pad"
                />

                {state.target?.role === "student" && (
                  <>
                    <Text style={styles.pickerLabel}>Emergency Number</Text>
                    <TextInput
                      style={[styles.textInput, { marginBottom: 15 }]}
                      value={editForm.emergencyPhone}
                      onChangeText={(t) => setEditForm((p: any) => ({ ...p, emergencyPhone: t }))}
                      keyboardType="phone-pad"
                      placeholder="Emergency contact number"
                    />
                    <Text style={styles.pickerLabel}>Parent Number</Text>
                    <TextInput
                      style={[styles.textInput, { marginBottom: 15 }]}
                      value={editForm.parentPhone}
                      onChangeText={(t) => setEditForm((p: any) => ({ ...p, parentPhone: t }))}
                      keyboardType="phone-pad"
                      placeholder="Parent contact number"
                    />
                  </>
                )}

                <Text style={styles.pickerLabel}>Gender</Text>
                <View style={[styles.permPickerBox, { marginBottom: 15 }]}>
                  <Picker
                    selectedValue={editForm.gender}
                    onValueChange={(t) => setEditForm((p: any) => ({ ...p, gender: t }))}
                  >
                    <Picker.Item label="Not Specified" value="" />
                    <Picker.Item label="Male" value="Male" />
                    <Picker.Item label="Female" value="Female" />
                  </Picker>
                </View>

                {state.target?.role === "student" && (
                  <>
                    <View style={styles.switchRowSmall}>
                      <Text style={styles.pickerLabel}>Uses School Bus</Text>
                      <Switch
                        value={editForm.takesBus}
                        onValueChange={(v) => setEditForm((p: any) => ({ ...p, takesBus: v }))}
                        trackColor={{ false: "#767577", true: COLORS.primary }}
                      />
                    </View>

                    {editForm.takesBus && (
                      <>
                        <View style={styles.labelRow}>
                          <Text style={styles.pickerLabel}>Bus Location / Stop</Text>
                          <TouchableOpacity onPress={() => setIsAddingNewBusLoc(!isAddingNewBusLoc)}>
                            <Text style={styles.linkText}>
                              {isAddingNewBusLoc ? "Cancel" : "+ Add New"}
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {isAddingNewBusLoc ? (
                          <View style={styles.inputActionRow}>
                            <TextInput
                              style={[styles.textInput, { flex: 1, marginBottom: 0 }]}
                              placeholder="New Location Name"
                              value={newBusLocInput}
                              onChangeText={setNewBusLocInput}
                            />
                            <TouchableOpacity
                              style={styles.actionBtnSmall}
                              onPress={() => handleSaveNewBusLocation(state.target)}
                            >
                              <Text style={{ color: "#fff", fontWeight: "700" }}>Save</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <View style={[styles.permPickerBox, { marginBottom: 15 }]}>
                            <Picker
                              selectedValue={editForm.busLocation}
                              onValueChange={(v) => setEditForm((p: any) => ({ ...p, busLocation: v }))}
                            >
                              <Picker.Item label="Select Location" value="" />
                              {busLocations.map((loc) => (
                                <Picker.Item key={loc} label={loc} value={loc} />
                              ))}
                            </Picker>
                          </View>
                        )}
                      </>
                    )}

                    <View style={styles.switchRowSmall}>
                      <Text style={styles.pickerLabel}>On Scholarship</Text>
                      <Switch
                        value={editForm.onScholarship}
                        onValueChange={(v) => setEditForm((p: any) => ({ ...p, onScholarship: v }))}
                        trackColor={{ false: "#767577", true: COLORS.primary }}
                      />
                    </View>

                    <View style={styles.switchRowSmall}>
                      <Text style={styles.pickerLabel}>On Discount</Text>
                      <Switch
                        value={editForm.onDiscount}
                        onValueChange={(v) => setEditForm((p: any) => ({ ...p, onDiscount: v }))}
                        trackColor={{ false: "#767577", true: COLORS.primary }}
                      />
                    </View>

                    <View style={styles.switchRowSmall}>
                      <Text style={styles.pickerLabel}>Enrolled in Feeding</Text>
                      <Switch
                        value={editForm.isFeeding}
                        onValueChange={(v) => setEditForm((p: any) => ({ ...p, isFeeding: v }))}
                        trackColor={{ false: "#767577", true: COLORS.primary }}
                      />
                    </View>

                    <View style={styles.switchRowSmall}>
                      <Text style={styles.pickerLabel}>Extra Classes</Text>
                      <Switch
                        value={editForm.takesExtraClasses}
                        onValueChange={(v) => setEditForm((p: any) => ({ ...p, takesExtraClasses: v }))}
                        trackColor={{ false: "#767577", true: COLORS.primary }}
                      />
                    </View>
                  </>
                )}

                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: COLORS.primary }]}
                  onPress={handleUpdateProfile}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save Profile</Text>
                  )}
                </TouchableOpacity>

                <View style={{ height: 30 }} />
                <Text style={[styles.pickerLabel, { color: COLORS.secondary }]}>
                  Security - Update Email
                </Text>
                <TextInput
                  style={[styles.textInput, { marginBottom: 15 }]}
                  value={editForm.email}
                  onChangeText={(t) => setEditForm((p: any) => ({ ...p, email: t }))}
                  placeholder="New Email Address"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: COLORS.secondary }]}
                  onPress={handleUpdateEmail}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveBtnText}>Update Auth Email</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {state.type === "upgrade_staff" && (
              <View>
                <Text style={styles.pickerLabel}>Staff Email (Login)</Text>
                <TextInput
                  style={[styles.textInput, { marginBottom: 15 }]}
                  value={upgradeForm.email}
                  onChangeText={(t) => setUpgradeForm((p: any) => ({ ...p, email: t }))}
                  placeholder="staff@edueaz.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <Text style={styles.pickerLabel}>Login Password</Text>
                <TextInput
                  style={[styles.textInput, { marginBottom: 15 }]}
                  value={upgradeForm.password}
                  onChangeText={(t) => setUpgradeForm((p: any) => ({ ...p, password: t }))}
                  placeholder="••••••••"
                  secureTextEntry
                />
                <Text style={styles.pickerLabel}>Assigned Role (Title)</Text>
                <TextInput
                  style={[styles.textInput, { marginBottom: 15 }]}
                  value={upgradeForm.roleText}
                  onChangeText={(t) => setUpgradeForm((p: any) => ({ ...p, roleText: t }))}
                  placeholder="e.g. Driver, Cook, Security"
                />
                <Text style={styles.pickerLabel}>Phone Number</Text>
                <TextInput
                  style={[styles.textInput, { marginBottom: 15 }]}
                  value={upgradeForm.phone}
                  onChangeText={(t) => setUpgradeForm((p: any) => ({ ...p, phone: t }))}
                  placeholder="024XXXXXXX"
                  keyboardType="phone-pad"
                />

                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: COLORS.primary }]}
                  onPress={handleUpgradeStaff}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveBtnText}>
                      Create Auth & Enable Login
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {state.type === "promote_repeat" && (
              <View>
                <Text style={styles.pickerLabel}>Move student(s) to:</Text>
                <View style={[styles.permPickerBox, { marginBottom: 15 }]}>
                  <Picker
                    selectedValue={targetClassId}
                    onValueChange={(val) => setTargetClassId(val)}
                  >
                    <Picker.Item label="Select Target Class" value="" />
                    {allClasses.map((c) => (
                      <Picker.Item key={c.id} label={c.name} value={c.id} />
                    ))}
                  </Picker>
                </View>

                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity
                    style={[
                      styles.saveBtn,
                      { flex: 1, backgroundColor: COLORS.secondary || "#c53b59" },
                    ]}
                    onPress={() => handlePromoteRepeat("Repeat")}
                    disabled={updating}
                  >
                    {updating ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.saveBtnText}>Repeat</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.saveBtn,
                      { flex: 1, backgroundColor: COLORS.success || "#05ac5b" },
                    ]}
                    onPress={() => handlePromoteRepeat("Promote")}
                    disabled={updating}
                  >
                    {updating ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.saveBtnText}>Promote</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  assignmentSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: "95%",
    width: "100%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 25,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    alignItems: "center",
  },
  modalTitle: { fontSize: 18, fontWeight: "900", color: "#1E293B" },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.primary,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary + "20",
    paddingBottom: 5,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
    padding: 15,
    backgroundColor: "#f8fafc",
    borderRadius: 15,
  },
  switchRowSmall: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  switchLabel: { fontSize: 15, fontWeight: "700", color: "#1E293B" },
  switchSub: { fontSize: 11, color: "#64748B" },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 15,
    justifyContent: "center",
  },
  actionCard: {
    width: (width - 80) / 2,
    padding: 20,
    backgroundColor: "#F8FAFC",
    borderRadius: 20,
    alignItems: "center",
    ...SHADOWS.small,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#475569",
    marginTop: 10,
  },
  permItem: {
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  permTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E293B",
    marginBottom: 5,
  },
  permPickerBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    overflow: "hidden",
  },
  pickerLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: "#475569",
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    fontSize: 14,
    color: "#1E293B",
  },
  saveBtn: {
    height: 60,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  selectionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
  },
  selectionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  chipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  selectBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 20,
    backgroundColor: "#F8FAFC",
    borderRadius: 15,
    marginBottom: 10,
    alignItems: "center",
  },
  selectBtnText: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  linkText: { color: COLORS.primary, fontSize: 12, fontWeight: "700" },
  inputActionRow: { flexDirection: "row", gap: 8, marginBottom: 15 },
  actionBtnSmall: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 15,
    justifyContent: "center",
    borderRadius: 8,
    height: 45,
  },
  // Profile Image Styles
  imageSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 25,
    backgroundColor: "#F8FAFC",
    padding: 15,
    borderRadius: 20,
    gap: 20,
  },
  imageContainer: {
    width: 80,
    height: 80,
    borderRadius: 25,
    overflow: "hidden",
    backgroundColor: "#E2E8F0",
    position: "relative",
  },
  profileImg: {
    width: "100%",
    height: "100%",
  },
  placeholderImg: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  imageLoader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  imageActions: {
    flex: 1,
    flexDirection: "row",
    gap: 10,
  },
  imageActionBtn: {
    flex: 1,
    height: 45,
    backgroundColor: "#fff",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...SHADOWS.small,
  },
  imageActionText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1E293B",
  },
});
