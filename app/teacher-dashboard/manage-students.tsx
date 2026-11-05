import { useRouter } from "expo-router";
import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import moment from "moment";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import {
  StudentData,
  StudentEditModal,
} from "../../components/teacher-dashboard/StudentEditModal";
import { COLORS, SHADOWS, SIZES } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { db } from "../../firebaseConfig";
import { getTeacherClasses, sortClasses } from "../../lib/classHelpers";
import { copyToClipboard } from "../../utils/copyToClipboard";

export default function TeacherManageStudentsScreen() {
  const router = useRouter();
  const { appUser } = useAuth();
  const { showToast } = useToast();

  const [classesList, setClassesList] = useState<{ id: string; name: string }[]>(
    []
  );
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [fetchingClasses, setFetchingClasses] = useState(true);

  const [students, setStudents] = useState<StudentData[]>([]);
  const [fetchingStudents, setFetchingStudents] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(
    null
  );
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [updatingProfile, setUpdatingProfile] = useState(false);

  const isNavigating = useRef(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const assignedClassIds = useMemo(
    () => getTeacherClasses(appUser),
    [appUser]
  );
  const isAdmin = appUser?.role === "admin";

  // 1. Fetch Classes assigned to Teacher or All if Admin
  const fetchClasses = useCallback(async () => {
    setFetchingClasses(true);
    try {
      const snap = await getDocs(collection(db, "classes"));
      if (!isMounted.current) return;

      const all = snap.docs.map((d) => ({
        id: d.id,
        name: d.data().name || d.id,
      }));

      let filtered = all;
      if (!isAdmin) {
        filtered = all.filter((c) => assignedClassIds.includes(c.id));
      }

      const sorted = sortClasses(filtered);
      setClassesList(sorted);
      if (sorted.length > 0 && !selectedClassId) {
        setSelectedClassId(sorted[0].id);
      }
    } catch (err) {
      console.error("Error fetching classes:", err);
      showToast({ message: "Failed to load classes.", type: "error" });
    } finally {
      if (isMounted.current) setFetchingClasses(false);
    }
  }, [appUser, assignedClassIds, isAdmin, selectedClassId, showToast]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  // 2. Fetch Students for Selected Class
  const fetchStudents = useCallback(async () => {
    if (!selectedClassId) {
      setStudents([]);
      return;
    }

    setFetchingStudents(true);
    try {
      const q = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("classId", "==", selectedClassId)
      );
      const snap = await getDocs(q);
      if (!isMounted.current) return;

      const list: StudentData[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          uid: d.id,
          parentLinkCode:
            data.parentLinkCode ||
            data.signupCode ||
            data.profile?.parentLinkCode ||
            "",
          signupCode: data.signupCode,
          profile: {
            firstName: data.profile?.firstName || "",
            lastName: data.profile?.lastName || "",
            email: data.profile?.email || data.email,
            studentID: data.profile?.studentID || data.studentID,
            phone: data.profile?.phone,
            emergencyPhone: data.profile?.emergencyPhone,
            parentPhone: data.profile?.parentPhone,
            parentName: data.profile?.parentName,
            parent2Phone: data.profile?.parent2Phone,
            parent2Name: data.profile?.parent2Name,
            parentLinkCode:
              data.profile?.parentLinkCode || data.parentLinkCode || data.signupCode,
            profileImage: data.profile?.profileImage,
            photoURL: data.profile?.photoURL,
            dob: data.profile?.dob || data.dateOfBirth,
          },
          classId: data.classId || selectedClassId,
          dateOfBirth: data.dateOfBirth || data.profile?.dob,
          photoURL: data.photoURL || data.profile?.photoURL,
          parentUids: data.parentUids || [],
        };
      });

      list.sort((a, b) =>
        `${a.profile.firstName} ${a.profile.lastName}`.localeCompare(
          `${b.profile.firstName} ${b.profile.lastName}`
        )
      );

      setStudents(list);
    } catch (err) {
      console.error("Error fetching students:", err);
      showToast({ message: "Failed to load students.", type: "error" });
    } finally {
      if (isMounted.current) {
        setFetchingStudents(false);
        setRefreshing(false);
      }
    }
  }, [selectedClassId, showToast]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStudents();
  };

  const handleBack = () => {
    if (isNavigating.current) return;
    isNavigating.current = true;
    setTimeout(() => {
      isNavigating.current = false;
    }, 500);

    if (Platform.OS === "web") {
      router.replace("/teacher-dashboard");
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/teacher-dashboard");
    }
  };

  const handleCopyCode = async (code: string) => {
    if (!code) return;
    const ok = await copyToClipboard(code);
    if (ok) {
      showToast({
        message: `Parent link code (${code}) copied to clipboard!`,
        type: "success",
      });
    } else {
      showToast({ message: "Failed to copy code.", type: "error" });
    }
  };

  // Filter students by search query (matches name, parent name, phone, or parent link code)
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase().trim();
    return students.filter((s) => {
      const name = `${s.profile.firstName} ${s.profile.lastName}`.toLowerCase();
      const parent = (s.profile.parentName || "").toLowerCase();
      const parentPhone = (s.profile.parentPhone || "").toLowerCase();
      const linkCode = (
        s.parentLinkCode ||
        s.signupCode ||
        s.profile?.parentLinkCode ||
        ""
      ).toLowerCase();
      return (
        name.includes(q) ||
        parent.includes(q) ||
        parentPhone.includes(q) ||
        linkCode.includes(q)
      );
    });
  }, [students, searchQuery]);

  const openEditModal = (student: StudentData) => {
    setSelectedStudent(student);
    setEditModalVisible(true);
  };

  // Save updated student profile
  const handleUpdateStudentProfile = async (data: {
    firstName: string;
    lastName: string;
    parentName: string;
    parentPhone: string;
    parent2Name?: string;
    parent2Phone?: string;
    dob: Date | null;
    profileImage?: string | null;
  }) => {
    if (!selectedStudent) return;
    setUpdatingProfile(true);

    try {
      const studentRef = doc(db, "users", selectedStudent.uid);
      const updates: Record<string, any> = {
        "profile.firstName": data.firstName,
        "profile.lastName": data.lastName,
        "profile.parentName": data.parentName,
        "profile.parentPhone": data.parentPhone,
        "profile.parent2Name": data.parent2Name || "",
        "profile.parent2Phone": data.parent2Phone || "",
        fullName: `${data.firstName} ${data.lastName}`,
        displayName: `${data.firstName} ${data.lastName}`,
      };

      const validIsoDate =
        data.dob && data.dob instanceof Date && !isNaN(data.dob.getTime())
          ? data.dob.toISOString()
          : null;

      if (validIsoDate) {
        updates["profile.dob"] = validIsoDate;
        updates["dateOfBirth"] = validIsoDate;
      } else {
        updates["profile.dob"] = null;
        updates["dateOfBirth"] = null;
      }

      if (data.profileImage) {
        updates["profile.profileImage"] = data.profileImage;
        updates["profile.photoURL"] = data.profileImage;
        updates["photoURL"] = data.profileImage;
      }

      await updateDoc(studentRef, updates);

      // Update local state
      setStudents((prev) =>
        prev.map((s) => {
          if (s.uid === selectedStudent.uid) {
            return {
              ...s,
              profile: {
                ...s.profile,
                firstName: data.firstName,
                lastName: data.lastName,
                parentName: data.parentName,
                parentPhone: data.parentPhone,
                parent2Name: data.parent2Name,
                parent2Phone: data.parent2Phone,
                profileImage: data.profileImage || s.profile.profileImage,
                photoURL: data.profileImage || s.profile.photoURL,
                dob: validIsoDate,
              },
              photoURL: data.profileImage || s.photoURL,
              dateOfBirth: validIsoDate,
            };
          }
          return s;
        })
      );

      showToast({ message: "Student profile updated successfully!", type: "success" });
      setEditModalVisible(false);
      setSelectedStudent(null);
    } catch (err: any) {
      console.error("Error updating student profile:", err);
      showToast({ message: err?.message || "Failed to update profile.", type: "error" });
    } finally {
      if (isMounted.current) setUpdatingProfile(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FDFDFD" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <SVGIcon name="arrow-back" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.headerTitle}>Student Profiles</Text>
          <Text style={styles.headerSubtitle}>
            Edit student details, parent info, photo & link codes
          </Text>
        </View>
      </View>

      {/* CLASS FILTER TABS */}
      <View style={styles.classBar}>
        <Text style={styles.filterLabel}>SELECT CLASS:</Text>
        {fetchingClasses ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : classesList.length === 0 ? (
          <Text style={styles.noClassesText}>No classes assigned</Text>
        ) : (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={classesList}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.classesScroll}
            renderItem={({ item }) => {
              const active = item.id === selectedClassId;
              return (
                <TouchableOpacity
                  style={[styles.classChip, active && styles.classChipActive]}
                  onPress={() => setSelectedClassId(item.id)}
                >
                  <Text
                    style={[
                      styles.classChipText,
                      active && styles.classChipTextActive,
                    ]}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>

      {/* SEARCH BAR */}
      <View style={styles.searchContainer}>
        <SVGIcon name="search" size={18} color="#94A3B8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search student, parent, or link code..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <SVGIcon name="close" size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {/* STUDENT LIST */}
      {fetchingStudents && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading students...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredStudents}
          keyExtractor={(item) => item.uid}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <SVGIcon name="person-outline" size={48} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No Students Found</Text>
              <Text style={styles.emptySub}>
                {searchQuery
                  ? "No student matches your search query."
                  : "No students enrolled in this class yet."}
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const fullName = `${item.profile.firstName} ${item.profile.lastName}`.trim();
            const photo = item.profile.profileImage || item.profile.photoURL || item.photoURL;
            const parentName = item.profile.parentName;
            const parentPhone = item.profile.parentPhone;
            const linkCode =
              item.parentLinkCode ||
              item.signupCode ||
              item.profile?.parentLinkCode;
            const rawDob = item.profile.dob || item.dateOfBirth;
            let dobFormatted = "";
            if (rawDob) {
              const d = rawDob.toDate ? rawDob.toDate() : new Date(rawDob);
              if (!isNaN(d.getTime())) {
                dobFormatted = moment(d).format("MMM DD, YYYY");
              }
            }

            return (
              <Animatable.View
                animation="fadeInUp"
                duration={300}
                delay={Math.min(index, 10) * 30}
              >
                <TouchableOpacity
                  style={styles.card}
                  onPress={() => openEditModal(item)}
                  activeOpacity={0.75}
                >
                  <View style={styles.cardAvatarWrapper}>
                    {photo ? (
                      <Image source={{ uri: photo }} style={styles.cardAvatar} />
                    ) : (
                      <View style={styles.cardAvatarPlaceholder}>
                        <Text style={styles.cardAvatarInitial}>
                          {(item.profile.firstName.charAt(0) || "S").toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.cardMainInfo}>
                    <Text style={styles.studentName}>{fullName || "Unnamed Student"}</Text>

                    {dobFormatted ? (
                      <Text style={styles.infoRow}>
                        <SVGIcon name="calendar" size={12} color={COLORS.primary} /> DOB:{" "}
                        {dobFormatted}
                      </Text>
                    ) : null}

                    {parentName || parentPhone ? (
                      <Text style={styles.infoRow}>
                        <SVGIcon name="call" size={12} color="#16A34A" /> Parent:{" "}
                        {parentName ? `${parentName} ` : ""}
                        {parentPhone ? `(${parentPhone})` : ""}
                      </Text>
                    ) : (
                      <Text style={[styles.infoRow, { color: COLORS.danger }]}>
                        No parent contact set
                      </Text>
                    )}

                    {/* PARENT LINK CODE CHIP */}
                    {linkCode ? (
                      <TouchableOpacity
                        style={styles.linkCodeChip}
                        onPress={() => handleCopyCode(linkCode)}
                      >
                        <SVGIcon name="key-outline" size={12} color={COLORS.primary} />
                        <Text style={styles.linkCodeChipText}>
                          Link Code: <Text style={styles.linkCodeHighlight}>{linkCode}</Text>
                        </Text>
                        <SVGIcon name="copy-outline" size={12} color={COLORS.primary} />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => openEditModal(item)}
                  >
                    <SVGIcon name="create-outline" size={18} color={COLORS.primary} />
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              </Animatable.View>
            );
          }}
        />
      )}

      {/* EDIT STUDENT MODAL */}
      <StudentEditModal
        visible={editModalVisible}
        student={selectedStudent}
        onClose={() => {
          setEditModalVisible(false);
          setSelectedStudent(null);
        }}
        onUpdateProfile={handleUpdateStudentProfile}
        updating={updatingProfile}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    ...SHADOWS.light,
  },
  backBtn: {
    padding: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: "500",
    color: "#64748B",
  },
  classBar: {
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  filterLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#94A3B8",
    paddingHorizontal: 20,
    marginBottom: 6,
    letterSpacing: 0.8,
  },
  classesScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  classChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
  },
  classChipActive: {
    backgroundColor: COLORS.primary,
  },
  classChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  classChipTextActive: {
    color: "#FFFFFF",
  },
  noClassesText: {
    paddingHorizontal: 20,
    fontSize: 12,
    color: "#94A3B8",
    fontStyle: "italic",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginVertical: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
    ...SHADOWS.light,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1E293B",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#475569",
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 4,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: SIZES.radius || 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    ...SHADOWS.light,
  },
  cardAvatarWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  cardAvatar: {
    width: "100%",
    height: "100%",
  },
  cardAvatarPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  cardAvatarInitial: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
  cardMainInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
  },
  infoRow: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 2,
  },
  linkCodeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: COLORS.primary + "20",
  },
  linkCodeChipText: {
    fontSize: 11,
    color: "#4338CA",
    fontWeight: "600",
  },
  linkCodeHighlight: {
    fontWeight: "900",
    color: COLORS.primary,
    letterSpacing: 0.8,
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    marginLeft: 10,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.primary,
  },
});
