import { Picker } from "@react-native-picker/picker";
import {
    collection,
    doc,
    documentId,
    getDoc,
    getDocs,
    getDocsFromCache,
    getDocsFromServer,
    query,
    updateDoc,
    where,
    writeBatch,
} from "firebase/firestore";
import React, { useEffect, useState, useCallback } from "react";
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
} from "react-native";
import { useRouter } from "expo-router";
import { COLORS, SHADOWS, SIZES } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebaseConfig";
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
    studentID?: string;
  };
  classId: string;
}

const { width } = Dimensions.get("window");
const isLargeScreen = width > 768;

// --- COMPONENT --- //
export default function PromoteStudentsScreen() {
  const router = useRouter();
  const { appUser } = useAuth();

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
        if (!userSnap.exists() || !userSnap.data().classes) {
          setTeacherClasses([]);
          return;
        }

        const classIds = userSnap.data().classes;
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
        Alert.alert("Error", "Could not fetch your assigned classes.");
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
      Alert.alert("Error", "Could not fetch students for this class.");
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
  };

  const handleUpdate = async (action: "Promote" | "Repeat") => {
    if (!targetClassId) return;

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

        Alert.alert(
          "Success",
          `All students have been ${action.toLowerCase()}d.`,
        );
        fetchStudents(selectedClass!.id); // Refresh list
        closeModal();
      } catch (err) {
        console.error(err);
        Alert.alert("Error", `Failed to ${action.toLowerCase()} all students.`);
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

        Alert.alert(
          "Success",
          `${selectedStudent.profile.firstName} has been ${action.toLowerCase()}d.`,
        );
        fetchStudents(selectedClass!.id); // Refresh list
        closeModal();
      } catch (err) {
        console.error(err);
        Alert.alert("Error", `Failed to ${action.toLowerCase()} student.`);
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
              <View>
                <Text
                  style={styles.itemTitle}
                >{`${item.profile.firstName} ${item.profile.lastName}`}</Text>
                <Text style={styles.itemSubtitle}>
                  ID: {item.profile.studentID || "N/A"}
                </Text>
              </View>
              <SVGIcon name="create" size={20} color={COLORS.gray} />
            </TouchableOpacity>
          )}
        />
      )}

      {/* --- PROMOTION/REPETITION MODAL --- */}
      <Modal
        visible={!!selectedStudent || isBulkMode}
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
});
