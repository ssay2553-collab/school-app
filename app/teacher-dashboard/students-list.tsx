import { Picker } from "@react-native-picker/picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
    collection,
    doc,
    documentId,
    getDoc,
    getDocs,
    getDocsFromCache,
    getDocsFromServer,
    query,
    Timestamp,
    updateDoc,
    where,
    writeBatch,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Dimensions,
    BackHandler,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { COLORS, SHADOWS, SIZES } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { db, functions } from "../../firebaseConfig";
import SVGIcon from "../../components/SVGIcon";

// --- TYPES --- //
interface ClassData {
  id: string;
  name: string;
}

interface StudentData {
  uid: string;
  profile: {
    firstName: string;
    lastName: string;
    email?: string;
    studentID?: string;
  };
  classId: string;
  dateOfBirth?: any;
}

const { width } = Dimensions.get("window");
const isLargeScreen = width > 768;

// --- COMPONENT --- //
export default function PromoteStudentsScreen() {
  const router = useRouter();
  const { appUser } = useAuth();
  const { showToast } = useToast();

  // --- STATE --- //
  const [loading, setLoading] = useState(true);
  const [teacherClasses, setTeacherClasses] = useState<ClassData[]>([]);
  const [allClasses, setAllClasses] = useState<ClassData[]>([]); // For the picker
  const [students, setStudents] = useState<StudentData[]>([]);

  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(
    null,
  );
  const [isBulkMode, setIsBulkMode] = useState(false);

  const [targetClassId, setTargetClassId] = useState<string | null>(null);

  const [assignmentModal, setAssignmentModal] = useState<{
    type: "none" | "edit_profile" | "edit_email" | "edit_password" | "promote_repeat";
  }>({ type: "none" });

  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editDob, setEditDob] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [updating, setUpdating] = useState(false);

  const isClassTeacher = useMemo(() => {
    if (!selectedClass || !appUser) return false;
    return appUser.classTeacherOf === selectedClass.id || appUser.role === "admin";
  }, [selectedClass, appUser]);

  const handleBack = useCallback(() => {
    if (selectedClass) {
      setSelectedClass(null);
    } else {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/teacher-dashboard");
      }
    }
  }, [selectedClass, router]);

  useEffect(() => {
    const onBackPress = () => {
      handleBack();
      return true;
    };

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress,
    );

    return () => subscription.remove();
  }, [handleBack]);

  // --- DATA FETCHING --- //

  // 1. Fetch classes assigned to the current teacher
  useEffect(() => {
    if (!appUser) return;
    const fetchTeacherClasses = async () => {
      setLoading(true);
      try {
        const userSnap = await getDoc(doc(db, "users", appUser.uid));
        if (!userSnap.exists() || !(userSnap.data() as any).classes) {
          setTeacherClasses([]);
          return;
        }

        const classIds = (userSnap.data() as any).classes;
        if (classIds.length > 0) {
          const q = query(
            collection(db, "classes"),
            where(documentId(), "in", classIds),
          );
          // Use cache-first helper to reduce server reads
          const classesSnap = await (
            await import("../../lib/firestoreHelpers")
          ).getDocsCacheFirst(q as any);
          const list = classesSnap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }));
          setTeacherClasses(list);
        }
      } catch {
        console.error("Error fetching teacher classes");
        showToast({
          message: "Could not fetch your assigned classes.",
          type: "error",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchTeacherClasses();
  }, [appUser]);

  // 2. Fetch all classes for the promotion/repetition picker (Cache-first to reduce cost)
  useEffect(() => {
    const fetchAllClasses = async () => {
      try {
        const q = query(collection(db, "classes"));
        let snap;
        try {
          snap = await getDocsFromCache(q);
          if (snap.empty) snap = await getDocsFromServer(q);
        } catch {
          snap = await getDocsFromServer(q);
        }
        const list = snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || d.id,
        }));
        setAllClasses(list);
      } catch (err) {
        console.error("fetchAllClasses error:", err);
      }
    };

    fetchAllClasses();
  }, []);

  // 3. Fetch students when a class is selected
  const fetchStudents = async (classId: string) => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("classId", "==", classId),
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({
        uid: d.id,
        ...(d.data() as any),
      }));
      setStudents(list);
    } catch (err) {
      console.error(err);
      showToast({
        message: "Could not fetch students for this class.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };


  // --- HANDLERS --- //

  const handleSelectClass = (cls: ClassData) => {
    setSelectedClass(cls);
    fetchStudents(cls.id);
  };

  const closeModal = () => {
    setSelectedStudent(null);
    setIsBulkMode(false);
    setAssignmentModal({ type: "none" });
    setUpdating(false);
  };

  const handleUpdateProfile = async () => {
    if (!selectedStudent || !isClassTeacher) return;
    if (!editFirstName.trim() || !editLastName.trim()) {
      return showToast({ message: "Names cannot be empty.", type: "error" });
    }
    setUpdating(true);
    try {
      const updates: any = {
        "profile.firstName": editFirstName.trim(),
        "profile.lastName": editLastName.trim(),
      };
      if (editDob) {
        updates.dateOfBirth = Timestamp.fromDate(editDob);
      }
      await updateDoc(doc(db, "users", selectedStudent.uid), updates);

      showToast({ message: "Profile updated.", type: "success" });
      fetchStudents(selectedClass!.id);
      closeModal();
    } catch {
      showToast({ message: "Update failed.", type: "error" });
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateUserEmail = async () => {
    if (!selectedStudent || !editEmail.trim() || !isClassTeacher) return;
    setUpdating(true);
    try {
      const updateEmailFn = httpsCallable(functions, "updateUserEmail");
      await updateEmailFn({ uid: selectedStudent.uid, newEmail: editEmail.trim() });

      showToast({ message: "Email updated successfully.", type: "success" });
      fetchStudents(selectedClass!.id);
      closeModal();
    } catch (err: any) {
      showToast({ message: err.message || "Failed to update email.", type: "error" });
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateUserPassword = async () => {
    if (!selectedStudent || !editPassword.trim() || !isClassTeacher) return;
    if (editPassword.length < 6) {
      return showToast({ message: "Password must be at least 6 characters.", type: "error" });
    }
    setUpdating(true);
    try {
      const updatePwFn = httpsCallable(functions, "updateUserPassword");
      await updatePwFn({ uid: selectedStudent.uid, newPassword: editPassword.trim() });
      setEditPassword("");
      showToast({ message: "Password updated successfully.", type: "success" });
      closeModal();
    } catch (err: any) {
      showToast({ message: err.message || "Failed to update password.", type: "error" });
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdate = async (action: "Promote" | "Repeat") => {
    if (!targetClassId || !isClassTeacher) return;

    if (isBulkMode) {
      // Handle bulk update
      if (students.length === 0) return;
      setLoading(true);
      try {
        const batch = writeBatch(db);
        students.forEach((student) => {
          const studentRef = doc(db, "users", student.uid);
          batch.update(studentRef, { classId: targetClassId });
        });
        await batch.commit();

        showToast({
          message: `All students have been ${action.toLowerCase()}d.`,
          type: "success",
        });
        fetchStudents(selectedClass!.id); // Refresh list
        closeModal();
      } catch (err) {
        console.error(err);
        showToast({
          message: `Failed to ${action.toLowerCase()} all students.`,
          type: "error",
        });
      } finally {
        setLoading(false);
      }
    } else {
      // Handle individual update
      if (!selectedStudent) return;
      setLoading(true);
      try {
        const studentRef = doc(db, "users", selectedStudent.uid);
        await updateDoc(studentRef, { classId: targetClassId });

        showToast({
          message: `${selectedStudent.profile.firstName} has been ${action.toLowerCase()}d.`,
          type: "success",
        });
        fetchStudents(selectedClass!.id); // Refresh list
        closeModal();
      } catch (err) {
        console.error(err);
        showToast({
          message: `Failed to ${action.toLowerCase()} student.`,
          type: "error",
        });
      } finally {
        setLoading(false);
      }
    }
  };

  // --- UI RENDERING --- //

  if (loading && students.length === 0 && teacherClasses.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Stage 1: Select a Class
  if (!selectedClass) {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
        >
          <SVGIcon name="arrow-back" size={18} color={COLORS.primary} />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.header}>Select a Class</Text>
        {teacherClasses.length === 0 ? (
          <Text style={styles.emptyText}>
            You are not assigned to any classes.
          </Text>
        ) : (
          <FlatList
            data={teacherClasses}
            keyExtractor={(item) => item.id}
            numColumns={isLargeScreen ? 3 : 1}
            columnWrapperStyle={isLargeScreen ? { gap: 16 } : null}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.itemCard, isLargeScreen && { flex: 1, marginBottom: 0 }]}
                onPress={() => handleSelectClass(item)}
              >
                <Text style={styles.itemTitle}>{item.name}</Text>
                <SVGIcon
                  name="chevron-forward"
                  size={22}
                  color={COLORS.gray}
                />
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  }

  // Stage 2: Select a Student
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={handleBack}
      >
        <SVGIcon name="arrow-back" size={18} color={COLORS.primary} />
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.header}>Students in {selectedClass.name}</Text>

      {/* --- Bulk Action Buttons --- */}
      {isClassTeacher && (
        <View style={styles.bulkActionRow}>
          <TouchableOpacity
            style={[styles.bulkButton, { backgroundColor: COLORS.success }]}
            onPress={() => {
              setIsBulkMode(true);
              setTargetClassId(selectedClass.id);
            }}
          >
            <SVGIcon name="school" size={18} color="#fff" />
            <Text style={styles.bulkButtonText}>Promote All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.bulkButton, { backgroundColor: COLORS.danger }]}
            onPress={() => {
              setIsBulkMode(true);
              setTargetClassId(selectedClass.id);
            }}
          >
            <SVGIcon name="refresh" size={18} color="#fff" />
            <Text style={styles.bulkButtonText}>Repeat All</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} />
      ) : students.length === 0 ? (
        <Text style={styles.emptyText}>No students found in this class.</Text>
      ) : (
        <FlatList
          data={students}
          keyExtractor={(item) => item.uid}
          numColumns={isLargeScreen ? 2 : 1}
          columnWrapperStyle={isLargeScreen ? { gap: 16 } : null}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.itemCard, isLargeScreen && { flex: 1, marginBottom: 0 }]}
              onPress={() => {
                setSelectedStudent(item);
                setTargetClassId(item.classId); // Default picker to current class
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={styles.itemTitle}
                >{`${item.profile.firstName} ${item.profile.lastName}`}</Text>
                <Text style={styles.itemSubtitle}>
                  ID: {item.profile.studentID || "N/A"}
                </Text>
              </View>
              {isClassTeacher && (
                <View style={styles.actionIcons}>
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedStudent(item);
                      setEditFirstName(item.profile.firstName);
                      setEditLastName(item.profile.lastName);
                      setEditDob(item.dateOfBirth ? (item.dateOfBirth.toDate ? item.dateOfBirth.toDate() : new Date(item.dateOfBirth)) : null);
                      setAssignmentModal({ type: "edit_profile" });
                    }}
                    style={styles.iconBtn}
                  >
                    <SVGIcon name="person" size={18} color={COLORS.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedStudent(item);
                      setEditEmail(item.profile.email || "");
                      setEditPassword("");
                      setAssignmentModal({ type: "edit_email" });
                    }}
                    style={styles.iconBtn}
                  >
                    <SVGIcon name="mail" size={18} color={COLORS.secondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedStudent(item);
                      setTargetClassId(item.classId);
                      setAssignmentModal({ type: "promote_repeat" });
                    }}
                    style={styles.iconBtn}
                  >
                    <SVGIcon name="swap-horizontal" size={18} color={COLORS.gray} />
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}

      {/* --- PROMOTION/REPETITION MODAL --- */}
      <Modal
        visible={assignmentModal.type === "promote_repeat" || isBulkMode}
        transparent
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {isBulkMode
                ? "Promote / Repeat All Students"
                : "Promote / Repeat Student"}
            </Text>

            <Text style={styles.modalSubtitle}>
              {isBulkMode ? (
                <>
                  Move all students from{" "}
                  <Text style={{ fontWeight: "bold" }}>
                    {selectedClass.name}
                  </Text>{" "}
                  to:
                </>
              ) : (
                <>
                  Move{" "}
                  <Text style={{ fontWeight: "bold" }}>
                    {selectedStudent?.profile.firstName}
                  </Text>{" "}
                  from{" "}
                  <Text style={{ fontWeight: "bold" }}>
                    {selectedClass.name}
                  </Text>{" "}
                  to:
                </>
              )}
            </Text>

            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={targetClassId}
                onValueChange={(val) => setTargetClassId(val)}
                style={styles.picker}
                dropdownIconColor="#000"
              >
                <Picker.Item
                  label="Select Target Class"
                  value={null}
                  color="#94A3B8"
                />
                {allClasses.map((cls) => (
                  <Picker.Item
                    key={cls.id}
                    label={cls.name}
                    value={cls.id}
                    color="#000"
                  />
                ))}
              </Picker>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: "#E2E8F0" }]}
                onPress={closeModal}
              >
                <Text style={[styles.modalButtonText, { color: "#475569" }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: COLORS.danger }]}
                onPress={() => handleUpdate("Repeat")}
              >
                <Text style={[styles.modalButtonText, { color: "#fff" }]}>
                  {isBulkMode ? "Repeat All" : "Repeat"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { backgroundColor: COLORS.success },
                ]}
                onPress={() => handleUpdate("Promote")}
              >
                <Text style={[styles.modalButtonText, { color: "#fff" }]}>
                  {isBulkMode ? "Promote All" : "Promote"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- EDIT MODALS --- */}
      <Modal
        visible={assignmentModal.type !== "none" && assignmentModal.type !== "promote_repeat"}
        transparent
        animationType="slide"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {assignmentModal.type.replace("_", " ").toUpperCase()}
              </Text>
              <TouchableOpacity onPress={closeModal}>
                <SVGIcon name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }}>
              {assignmentModal.type === "edit_profile" && (
                <View>
                  <Text style={styles.inputLabel}>FIRST NAME</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editFirstName}
                    onChangeText={setEditFirstName}
                    placeholder="First Name"
                  />
                  <Text style={[styles.inputLabel, { marginTop: 15 }]}>LAST NAME</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editLastName}
                    onChangeText={setEditLastName}
                    placeholder="Last Name"
                  />
                  <Text style={[styles.inputLabel, { marginTop: 15 }]}>DATE OF BIRTH</Text>
                  <TouchableOpacity
                    style={styles.textInput}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Text style={{ color: editDob ? "#1E293B" : "#94A3B8" }}>
                      {editDob ? editDob.toLocaleDateString() : "Select Date"}
                    </Text>
                  </TouchableOpacity>
                  {showDatePicker && (
                    <DateTimePicker
                      value={editDob || new Date()}
                      mode="date"
                      display="default"
                      onChange={(event, date) => {
                        setShowDatePicker(false);
                        if (date) setEditDob(date);
                      }}
                    />
                  )}
                  <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: COLORS.primary }]}
                    onPress={handleUpdateProfile}
                    disabled={updating}
                  >
                    {updating ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
                  </TouchableOpacity>
                </View>
              )}

              {assignmentModal.type === "edit_email" && (
                <View>
                  <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editEmail}
                    onChangeText={setEditEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                  <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: COLORS.primary }]}
                    onPress={handleUpdateUserEmail}
                    disabled={updating}
                  >
                    {updating ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Update Email</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: COLORS.secondary, marginTop: 10 }]}
                    onPress={() => setAssignmentModal({ type: "edit_password" })}
                  >
                    <Text style={styles.saveBtnText}>Change Password Instead</Text>
                  </TouchableOpacity>
                </View>
              )}

              {assignmentModal.type === "edit_password" && (
                <View>
                  <Text style={styles.inputLabel}>NEW PASSWORD</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editPassword}
                    onChangeText={setEditPassword}
                    secureTextEntry
                    placeholder="Min 6 characters"
                  />
                  <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: COLORS.primary }]}
                    onPress={handleUpdateUserPassword}
                    disabled={updating}
                  >
                    {updating ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Update Password</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// --- STYLES --- //
const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: { flex: 1, padding: 16, backgroundColor: "#F8FAFC" },
  header: {
    fontSize: SIZES.xLarge,
    fontWeight: "bold",
    color: COLORS.primary,
    marginBottom: 16,
  },
  emptyText: { textAlign: "center", marginTop: 30, color: COLORS.gray },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  backButtonText: {
    color: COLORS.primary,
    marginLeft: 5,
    fontSize: SIZES.medium,
  },
  itemCard: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: SIZES.radius,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    ...SHADOWS.light,
  },
  itemTitle: { fontSize: SIZES.medium, fontWeight: "600", color: "#1E293B" },
  itemSubtitle: { fontSize: SIZES.small, color: COLORS.gray, marginTop: 4 },
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
  modalTitle: {
    fontSize: SIZES.large,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#0F172A",
  },
  modalSubtitle: {
    fontSize: SIZES.medium,
    color: COLORS.gray,
    marginBottom: 16,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: SIZES.radius,
    marginBottom: 20,
    backgroundColor: "#F8FAFC",
    overflow: "hidden",
  },
  picker: {
    height: 50,
    color: "#000",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: SIZES.radius,
    alignItems: "center",
  },
  modalButtonText: {
    fontWeight: "bold",
    fontSize: 12,
  },
  bulkActionRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
    gap: 10,
  },
  bulkButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: SIZES.radius,
    ...SHADOWS.light,
  },
  bulkButtonText: {
    color: "#fff",
    fontWeight: "bold",
    marginLeft: 8,
    fontSize: 12,
  },
  actionIcons: {
    flexDirection: "row",
    gap: 12,
  },
  iconBtn: {
    padding: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
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
