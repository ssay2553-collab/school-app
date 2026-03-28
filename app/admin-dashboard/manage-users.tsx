import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import {
    arrayRemove,
    arrayUnion,
    collection,
    deleteDoc,
    doc,
    documentId,
    getCountFromServer,
    getDoc,
    limit,
    onSnapshot,
    query,
    Timestamp,
    updateDoc,
    where,
    writeBatch,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
    Modal,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import * as Animatable from "react-native-animatable";
import { SafeAreaView } from "react-native-safe-area-context";
import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db, functions } from "../../firebaseConfig";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";
import { sortClasses } from "../../lib/classHelpers";
import { getDocsCacheFirst } from "../../lib/firestoreHelpers";

const { width } = Dimensions.get("window");
const DEFAULT_AVATAR = require("../../assets/default-avatar.png");

type UserRole = "admin" | "teacher" | "parent" | "student";
type PermissionLevel = "full" | "view" | "edit" | "deny";

interface User {
  uid: string;
  profile: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    gender?: string;
    profileImage?: string;
  };
  role: UserRole;
  adminRole?: string;
  classes?: string[];
  subjects?: string[];
  classTeacherOf?: string;
  classId?: string;
  assignedRoles?: string[];
  childrenIds?: string[];
  parentUids?: string[];
  canCreateNews?: boolean;
  permissions?: Record<string, PermissionLevel>;
  dateOfBirth?: any;
  walletBalance?: number;
  onScholarship?: boolean;
  status: "active" | "archived" | "disabled" | string;
  archivedAt?: any;
  archivedInYear?: string;
}

const roles: { name: string; role: UserRole; icon: string }[] = [
  { name: "Admins", role: "admin", icon: "shield-checkmark" },
  { name: "Teachers", role: "teacher", icon: "people" },
  { name: "Parents", role: "parent", icon: "home" },
  { name: "Students", role: "student", icon: "school" },
];

const PERMISSION_KEYS = [
  { key: "manage-fees", label: "Manage Fees" },
  { key: "staff-payroll", label: "Staff Payroll" },
  { key: "expenditure", label: "Expenditure" },
  { key: "manage-users", label: "Manage Users" },
];

const PERMISSION_LEVELS: { label: string; value: PermissionLevel }[] = [
  { label: "Full Control", value: "full" },
  { label: "View Only", value: "view" },
  { label: "Can Edit", value: "edit" },
  { label: "Deny Access", value: "deny" },
];

export default function ManageUsers() {
  const router = useRouter();
  const { appUser } = useAuth();
  const acadConfig = useAcademicConfig();

  const currentUserRole = appUser?.adminRole?.toLowerCase() || "";
  const isSuperAdmin = ["proprietor", "headmaster"].includes(currentUserRole);
  const hasManageUsersAccess =
    appUser?.permissions?.["manage-users"] === "full" || isSuperAdmin;

  useEffect(() => {
    if (appUser && !hasManageUsersAccess) {
      Alert.alert("Access Denied", "Unauthorized management access.");
      router.replace("/admin-dashboard");
    }
  }, [appUser, hasManageUsersAccess]);

  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [allClasses, setAllClasses] = useState<{ id: string; name: string }[]>(
    [],
  );

  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [linkedUsers, setLinkedUsers] = useState<User[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [assignmentCount, setAssignmentCount] = useState<number | null>(null);

  const [assignmentModal, setAssignmentModal] = useState<{
    type:
      | "none"
      | "assign_as"
      | "class_teacher"
      | "dept_head"
      | "permissions"
      | "other";
    target: User | null;
  }>({ type: "none", target: null });

  const [customRoleText, setCustomRoleText] = useState("");
  const [newsPermission, setNewsPermission] = useState(false);
  const [tempPermissions, setTempPermissions] = useState<
    Record<string, PermissionLevel>
  >({});
  const [updating, setUpdating] = useState(false);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const snap = await getDocsCacheFirst(collection(db, "classes") as any);
        const list = snap.docs.map((d: any) => ({
          id: d.id,
          name: d.data().name || d.id,
        }));
        setAllClasses(sortClasses(list));
      } catch (e) {
        console.error(e);
      }
    };
    fetchClasses();
  }, []);

  useEffect(() => {
    if (!selectedRole || !hasManageUsersAccess) {
      setUsers([]);
      return;
    }
    setLoading(true);
    let q = query(
      collection(db, "users"),
      where("role", "==", selectedRole),
      where("status", "==", showArchived ? "archived" : "active"),
      limit(100),
    );

    if (selectedRole === "student" && selectedClassId !== "all") {
      q = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("classId", "==", selectedClassId),
        where("status", "==", showArchived ? "archived" : "active"),
        limit(100),
      );
    }

    const unsub = onSnapshot(
      q,
      (snap) => {
        const fetchedList = snap.docs.map(
          (d: any) => ({ uid: d.id, ...d.data() }) as User,
        );
        if (selectedRole === "student") {
          fetchedList.sort((a, b) => {
            const classA = a.classId || "";
            const classB = b.classId || "";
            if (classA !== classB) return classA.localeCompare(classB);
            return (a.profile?.firstName || "").localeCompare(
              b.profile?.firstName || "",
            );
          });
        } else {
          fetchedList.sort((a, b) =>
            (a.profile?.firstName || "").localeCompare(
              b.profile?.firstName || "",
            ),
          );
        }
        setUsers(fetchedList);
        setLoading(false);
      },
      (err) => {
        console.error("ManageUsers Snapshot Error:", err);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [selectedRole, selectedClassId, hasManageUsersAccess, showArchived]);

  const filteredUsers = useMemo(() => {
    const low = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.profile?.firstName?.toLowerCase().includes(low) ||
        u.profile?.lastName?.toLowerCase().includes(low) ||
        u.profile?.email?.toLowerCase().includes(low),
    );
  }, [users, searchQuery]);

  const fetchLinkedUsersAndStats = async (user: User) => {
    setLoadingLinks(true);
    setLinkedUsers([]);
    setAssignmentCount(null);
    try {
      let idsToFetch: string[] = [];
      if (user.role === "parent" && user.childrenIds?.length)
        idsToFetch = user.childrenIds;
      else if (user.role === "student" && user.parentUids?.length)
        idsToFetch = user.parentUids;

      if (idsToFetch.length > 0) {
        // Safe check for empty arrays or invalid IDs
        const q = query(
          collection(db, "users"),
          where(documentId(), "in", idsToFetch),
        );
        const snap = await getDocsCacheFirst(q as any);
        setLinkedUsers(
          snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as User),
        );
      }
      if (user.role === "teacher") {
        const assignmentsQuery = query(
          collection(db, "assignments"),
          where("teacherId", "==", user.uid),
        );
        const countSnap = await getCountFromServer(assignmentsQuery);
        setAssignmentCount(countSnap.data().count);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLinks(false);
    }
  };

  const handleUpdatePermissions = async () => {
    if (!assignmentModal.target) return;
    setUpdating(true);
    try {
      await updateDoc(doc(db, "users", assignmentModal.target.uid), {
        permissions: tempPermissions,
      });
      setAssignmentModal({ type: "none", target: null });
      Alert.alert("Success", "Admin permissions updated.");
    } catch {
      Alert.alert("Error", "Failed to update permissions.");
    } finally {
      setUpdating(false);
    }
  };

  const handleAssignRole = async (roleName: string) => {
    const teacher = assignmentModal.target;
    if (!teacher) return;
    setUpdating(true);
    try {
      await updateDoc(doc(db, "users", teacher.uid), {
        assignedRoles: arrayUnion(roleName),
        canCreateNews: newsPermission,
      });
      setAssignmentModal({ type: "none", target: null });
      setCustomRoleText("");
      Alert.alert("Success", `Role assigned: ${roleName}`);
    } catch {
      Alert.alert("Error", "Failed to assign role.");
    } finally {
      setUpdating(false);
    }
  };

  const handleAssignClassTeacher = async (targetClassId: string) => {
    const teacher = assignmentModal.target;
    if (!teacher) return;
    setUpdating(true);
    try {
      const isAlreadyAssigned = teacher.classTeacherOf === targetClassId;
      const finalClassId = isAlreadyAssigned ? null : targetClassId;
      const batch = writeBatch(db);
      if (teacher.classTeacherOf)
        batch.update(doc(db, "classes", teacher.classTeacherOf), {
          classTeacherId: null,
        });
      if (targetClassId && !isAlreadyAssigned) {
        const classDoc = await getDoc(doc(db, "classes", targetClassId));
        const oldId = classDoc.data()?.classTeacherId;
        if (oldId && oldId !== teacher.uid)
          batch.update(doc(db, "users", oldId), { classTeacherOf: null });
      }
      batch.update(doc(db, "users", teacher.uid), {
        classTeacherOf: finalClassId,
        assignedRoles: arrayUnion("Class Teacher"),
        canCreateNews: newsPermission,
      });
      if (targetClassId)
        batch.update(doc(db, "classes", targetClassId), {
          classTeacherId: isAlreadyAssigned ? null : teacher.uid,
        });
      await batch.commit();
      setAssignmentModal({ type: "none", target: null });
      Alert.alert("Success", "Class Teacher assigned.");
    } catch {
      Alert.alert("Error", "Assignment failed.");
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleScholarship = async (user: User) => {
    if (!isSuperAdmin)
      return Alert.alert(
        "Denied",
        "Only super admins can update scholarship status.",
      );
    setUpdating(true);
    try {
      const newVal = !user.onScholarship;
      await updateDoc(doc(db, "users", user.uid), { onScholarship: newVal });
      setViewingUser((prev) =>
        prev ? { ...prev, onScholarship: newVal } : null,
      );
      Alert.alert(
        "Success",
        `Student is ${newVal ? "now" : "no longer"} on scholarship.`,
      );
    } catch {
      Alert.alert("Error", "Update failed.");
    } finally {
      setUpdating(false);
    }
  };

  const handleArchiveBasic9 = async () => {
    const currentClassName =
      allClasses.find((c) => c.id === selectedClassId)?.name || "";
    const isBasic9 =
      currentClassName.toLowerCase().includes("basic 9") ||
      currentClassName.toLowerCase().includes("grade 9");

    if (!isBasic9)
      return Alert.alert(
        "Invalid Action",
        "Graduation can only be triggered from the Basic 9 student list.",
      );

    const basic9Students = users.filter((u) => u.status !== "archived");
    if (basic9Students.length === 0)
      return Alert.alert(
        "Empty List",
        "No active Basic 9 students found to graduate.",
      );

    Alert.alert(
      "Confirm Graduation",
      `Move ${basic9Students.length} students to Archive for ${acadConfig.academicYear}? This will empty the current class list.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Graduate & Archive",
          style: "destructive",
          onPress: async () => {
            setUpdating(true);
            try {
              const currentYear = acadConfig.academicYear || "Unknown Year";
              // CHUNKED BATCHES: Firestore limit is 500 per batch. We chunk by 100 to be safe.
              const chunks = [];
              for (let i = 0; i < basic9Students.length; i += 100) {
                chunks.push(basic9Students.slice(i, i + 100));
              }

              for (const chunk of chunks) {
                const batch = writeBatch(db);
                chunk.forEach((s) => {
                  batch.update(doc(db, "users", s.uid), {
                    status: "archived",
                    archivedAt: Timestamp.now(),
                    archivedInYear: currentYear,
                    classId: "archived",
                  });
                });
                await batch.commit();
              }

              Alert.alert(
                "Success",
                `Graduation for ${currentYear} completed.`,
              );
            } catch (e) {
              Alert.alert("Error", "Graduation process failed.");
            } finally {
              setUpdating(false);
            }
          },
        },
      ],
    );
  };

  const handleRemoveRole = async (user: User, role: string) => {
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { assignedRoles: arrayRemove(role) });
      if (role === "Class Teacher") {
        const batch = writeBatch(db);
        batch.update(userRef, { classTeacherOf: null });
        if (user.classTeacherOf)
          batch.update(doc(db, "classes", user.classTeacherOf), {
            classTeacherId: null,
          });
        await batch.commit();
      }
      Alert.alert("Success", "Role removed.");
    } catch {
      Alert.alert("Error", "Remove failed.");
    }
  };

  const handleDeleteUser = (user: User) => {
    if (user.uid === appUser?.uid) return;
    Alert.alert(
      "Critical Action",
      `Permanently delete ${user.profile.firstName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeletingUid(user.uid);
            try {
              const deleteFn = httpsCallable(functions, "deleteUserAccount");
              await deleteFn({ uid: user.uid });
              Alert.alert("Success", "Account deleted.");
            } catch {
              await deleteDoc(doc(db, "users", user.uid));
              Alert.alert("Success", "Database entry removed.");
            } finally {
              setDeletingUid(null);
              setViewingUser(null);
            }
          },
        },
      ],
    );
  };

  const openPermissionModal = (user: User) => {
    setTempPermissions(
      user.permissions || {
        "manage-fees": "deny",
        "staff-payroll": "deny",
        expenditure: "deny",
        "manage-users": "deny",
      },
    );
    setAssignmentModal({ type: "permissions", target: user });
  };

  const formatDate = (date: any) => {
    if (!date) return "N/A";
    try {
      if (date.toDate)
        return date
          .toDate()
          .toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          });
      return new Date(date).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "Invalid Date";
    }
  };

  if (!hasManageUsersAccess) return null;

  if (!selectedRole) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.roleHeader}>
          <Text style={styles.roleHeaderTitle}>User Directory</Text>
          <Text style={styles.roleHeaderSub}>
            School staff and community management
          </Text>
        </View>
        <ScrollView contentContainerStyle={styles.roleGrid}>
          {roles.map((r, idx) => (
            <Animatable.View
              key={r.role}
              animation="fadeInUp"
              delay={idx * 100}
            >
              <TouchableOpacity
                style={styles.roleCard}
                onPress={() => setSelectedRole(r.role)}
              >
                <View
                  style={[
                    styles.roleIcon,
                    { backgroundColor: (COLORS.primary || "#2e86de") + "10" },
                  ]}
                >
                  <SVGIcon
                    name={r.icon}
                    color={COLORS.primary || "#2e86de"}
                    size={28}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.roleCardTitle}>{r.name}</Text>
                  <Text style={styles.roleCardSub}>
                    Overview and security control
                  </Text>
                </View>
                <SVGIcon
                  name="chevron-forward"
                  size={20}
                  color={COLORS.gray || "#9ca3af"}
                />
              </TouchableOpacity>
            </Animatable.View>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const selectedClassName =
    allClasses.find((c) => c.id === selectedClassId)?.name || "";
  const isBasic9View =
    selectedRole === "student" &&
    selectedClassName.toLowerCase().includes("basic 9");

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.mainHeader}>
        <TouchableOpacity
          onPress={() => setSelectedRole(null)}
          style={styles.backButton}
        >
          <SVGIcon
            name="arrow-back"
            size={24}
            color={COLORS.primary || "#2e86de"}
          />
        </TouchableOpacity>
        <Text style={styles.mainTitle}>
          {roles.find((r) => r.role === selectedRole)?.name}
        </Text>
        <TouchableOpacity
          onPress={() => setShowArchived(!showArchived)}
          style={[
            styles.archiveToggle,
            showArchived && { backgroundColor: COLORS.secondary || "#c53b59" },
          ]}
        >
          <SVGIcon
            name="archive"
            size={20}
            color={showArchived ? "#fff" : COLORS.gray || "#9ca3af"}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <SVGIcon name="search" size={20} color={COLORS.gray || "#9ca3af"} />
        <TextInput
          style={styles.searchInput}
          placeholder={`Search ${selectedRole}s...`}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={COLORS.gray || "#9ca3af"}
        />
      </View>

      {selectedRole === "student" && (
        <View style={styles.filterRow}>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedClassId}
              onValueChange={setSelectedClassId}
              style={styles.picker}
            >
              <Picker.Item label="All Classes" value="all" />
              {allClasses.map((c) => (
                <Picker.Item key={c.id} label={c.name} value={c.id} />
              ))}
            </Picker>
          </View>

          {isBasic9View && !showArchived && isSuperAdmin && (
            <TouchableOpacity
              style={styles.bulkArchiveBtn}
              onPress={handleArchiveBasic9}
            >
              <SVGIcon name="school" size={18} color="#fff" />
              <Text style={styles.bulkArchiveText}>GRADUATE</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {loading ? (
        <ActivityIndicator
          size="large"
          color={COLORS.primary || "#2e86de"}
          style={{ marginTop: 50 }}
        />
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.uid}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {}}
              tintColor={COLORS.primary || "#2e86de"}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.userCard}
              onLongPress={() =>
                item.role === "teacher" &&
                setAssignmentModal({ type: "assign_as", target: item })
              }
              onPress={() => {
                setViewingUser(item);
                fetchLinkedUsersAndStats(item);
              }}
            >
              <View style={styles.avatar}>
                <Image
                  source={
                    item.profile?.profileImage
                      ? { uri: item.profile.profileImage }
                      : DEFAULT_AVATAR
                  }
                  style={styles.avatarImg}
                  resizeMode="cover"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 15 }}>
                <Text style={styles.userName}>
                  {item.profile?.firstName} {item.profile?.lastName}
                </Text>
                <Text style={styles.userSubText}>
                  {item.status === "archived"
                    ? `Archived (${item.archivedInYear || "N/A"})`
                    : allClasses.find((c) => c.id === item.classId)?.name ||
                      item.adminRole ||
                      item.role.toUpperCase()}
                </Text>
                <View style={styles.badgeRow}>
                  {item.role === "teacher" && item.classTeacherOf && (
                    <View
                      style={[styles.badge, { backgroundColor: "#10b98115" }]}
                    >
                      <Text style={[styles.badgeText, { color: "#10b981" }]}>
                        Class:{" "}
                        {allClasses.find((c) => c.id === item.classTeacherOf)
                          ?.name || "N/A"}
                      </Text>
                    </View>
                  )}
                  {item.canCreateNews && (
                    <View
                      style={[styles.badge, { backgroundColor: "#f59e0b15" }]}
                    >
                      <Text style={[styles.badgeText, { color: "#f59e0b" }]}>
                        News Authority
                      </Text>
                    </View>
                  )}
                  {item.onScholarship && (
                    <View
                      style={[styles.badge, { backgroundColor: "#6366f115" }]}
                    >
                      <Text style={[styles.badgeText, { color: "#6366f1" }]}>
                        On Scholarship
                      </Text>
                    </View>
                  )}
                  {item.role === "student" &&
                    item.walletBalance !== undefined && (
                      <View
                        style={[
                          styles.badge,
                          {
                            backgroundColor:
                              item.walletBalance > 0
                                ? "#ef444415"
                                : "#10b98115",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            {
                              color:
                                item.walletBalance > 0 ? "#ef4444" : "#10b981",
                            },
                          ]}
                        >
                          {item.walletBalance > 0
                            ? `Debt: ₵${(item.walletBalance || 0).toLocaleString()}`
                            : "Cleared"}
                        </Text>
                      </View>
                    )}
                </View>
              </View>
              <SVGIcon
                name="chevron-forward"
                size={20}
                color={COLORS.gray || "#9ca3af"}
              />
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={!!viewingUser} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <Animatable.View
            animation="slideInUp"
            duration={400}
            style={styles.modalContent}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Member Profile</Text>
              <TouchableOpacity onPress={() => setViewingUser(null)}>
                <SVGIcon
                  name="close"
                  size={28}
                  color={COLORS.gray || "#9ca3af"}
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
            >
              {viewingUser && (
                <View style={{ padding: 20 }}>
                  <View style={styles.detailHero}>
                    <View style={styles.largeAvatar}>
                      <Image
                        source={
                          viewingUser.profile?.profileImage
                            ? { uri: viewingUser.profile.profileImage }
                            : DEFAULT_AVATAR
                        }
                        style={styles.avatarImgLarge}
                      />
                    </View>
                    <Text style={styles.detailName}>
                      {viewingUser.profile?.firstName}{" "}
                      {viewingUser.profile?.lastName}
                    </Text>
                    <Text style={styles.detailRole}>
                      {viewingUser.adminRole || viewingUser.role.toUpperCase()}
                    </Text>
                  </View>

                  {viewingUser.role === "student" && (
                    <View style={styles.financeCardRow}>
                      <View
                        style={[
                          styles.financeBox,
                          {
                            borderLeftColor:
                              (viewingUser.walletBalance || 0) > 0
                                ? "#ef4444"
                                : "#10b981",
                          },
                        ]}
                      >
                        <Text style={styles.financeLabel}>
                          FEES OUTSTANDING
                        </Text>
                        <Text
                          style={[
                            styles.financeValue,
                            {
                              color:
                                (viewingUser.walletBalance || 0) > 0
                                  ? "#ef4444"
                                  : "#10b981",
                            },
                          ]}
                        >
                          ₵{(viewingUser.walletBalance || 0).toLocaleString()}
                        </Text>
                      </View>
                      {viewingUser.onScholarship && (
                        <View
                          style={[
                            styles.financeBox,
                            { borderLeftColor: "#6366f1" },
                          ]}
                        >
                          <Text style={styles.financeLabel}>SCHOLARSHIP</Text>
                          <Text
                            style={[styles.financeValue, { color: "#6366f1" }]}
                          >
                            Active
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  <View style={styles.infoSection}>
                    <Text style={styles.infoLabel}>Bio Information</Text>
                    <View style={styles.infoGrid}>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoKey}>Email:</Text>
                        <Text style={styles.infoValue}>
                          {viewingUser.profile?.email || "N/A"}
                        </Text>
                      </View>
                      {viewingUser.role !== "student" && (
                        <View style={styles.infoRow}>
                          <Text style={styles.infoKey}>Phone:</Text>
                          <Text style={styles.infoValue}>
                            {viewingUser.profile?.phone || "N/A"}
                          </Text>
                        </View>
                      )}
                      <View style={styles.infoRow}>
                        <Text style={styles.infoKey}>Gender:</Text>
                        <Text style={styles.infoValue}>
                          {viewingUser.profile?.gender || "N/A"}
                        </Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoKey}>Date of Birth:</Text>
                        <Text style={styles.infoValue}>
                          {formatDate(viewingUser.dateOfBirth)}
                        </Text>
                      </View>
                      {viewingUser.role === "student" && (
                        <View style={styles.infoRow}>
                          <Text style={styles.infoKey}>Current Class:</Text>
                          <Text style={styles.infoValue}>
                            {allClasses.find(
                              (c) => c.id === viewingUser.classId,
                            )?.name || "N/A"}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {linkedUsers.length > 0 && (
                    <View style={styles.infoSection}>
                      <Text style={styles.infoLabel}>
                        {viewingUser.role === "student"
                          ? "Linked Parents"
                          : "Linked Students"}
                      </Text>
                      <View style={styles.linkedList}>
                        {linkedUsers.map((u) => (
                          <View key={u.uid} style={styles.linkedItem}>
                            <Image
                              source={
                                u.profile?.profileImage
                                  ? { uri: u.profile.profileImage }
                                  : DEFAULT_AVATAR
                              }
                              style={styles.linkedAvatar}
                            />
                            <View>
                              <Text style={styles.linkedName}>
                                {u.profile.firstName} {u.profile.lastName}
                              </Text>
                              <Text style={styles.linkedSub}>
                                {u.profile.phone ||
                                  u.profile.email ||
                                  "Contact linked"}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  <View style={styles.btnStack}>
                    {viewingUser.role === "admin" && isSuperAdmin && (
                      <TouchableOpacity
                        style={[
                          styles.actionButton,
                          { backgroundColor: COLORS.primary || "#2e86de" },
                        ]}
                        onPress={() => openPermissionModal(viewingUser)}
                      >
                        <Text style={styles.actionButtonText}>
                          Delegate Permissions
                        </Text>
                      </TouchableOpacity>
                    )}
                    {viewingUser.role === "teacher" && (
                      <TouchableOpacity
                        style={[
                          styles.actionButton,
                          { backgroundColor: COLORS.secondary || "#c53b59" },
                        ]}
                        onPress={() => {
                          setNewsPermission(viewingUser.canCreateNews || false);
                          setAssignmentModal({
                            type: "assign_as",
                            target: viewingUser,
                          });
                        }}
                      >
                        <Text style={styles.actionButtonText}>
                          Modify Authority
                        </Text>
                      </TouchableOpacity>
                    )}
                    {viewingUser.role === "student" && isSuperAdmin && (
                      <TouchableOpacity
                        style={[
                          styles.actionButton,
                          {
                            backgroundColor: viewingUser.onScholarship
                              ? "#f1f5f9"
                              : "#6366f1",
                          },
                        ]}
                        onPress={() => handleToggleScholarship(viewingUser)}
                      >
                        <Text
                          style={[
                            styles.actionButtonText,
                            {
                              color: viewingUser.onScholarship
                                ? "#6366f1"
                                : "#fff",
                            },
                          ]}
                        >
                          {viewingUser.onScholarship
                            ? "Revoke Scholarship"
                            : "Set on Scholarship"}
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[
                        styles.actionButton,
                        { backgroundColor: "#fee2e2", marginTop: 12 },
                      ]}
                      onPress={() => handleDeleteUser(viewingUser)}
                    >
                      <Text
                        style={[styles.actionButtonText, { color: "#ef4444" }]}
                      >
                        Delete Account
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </Animatable.View>
        </View>
      </Modal>

      <Modal
        visible={assignmentModal.type !== "none"}
        transparent
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.assignmentSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {assignmentModal.type.replace("_", " ").toUpperCase()}
              </Text>
              <TouchableOpacity
                onPress={() =>
                  setAssignmentModal({ type: "none", target: null })
                }
              >
                <SVGIcon name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 25 }}>
              {assignmentModal.type === "assign_as" && (
                <>
                  <View style={styles.switchRow}>
                    <View>
                      <Text style={styles.switchLabel}>Bulletin Authority</Text>
                      <Text style={styles.switchSub}>
                        Allow teacher to post news
                      </Text>
                    </View>
                    <Switch
                      value={newsPermission}
                      onValueChange={setNewsPermission}
                      thumbColor={
                        newsPermission
                          ? COLORS.secondary || "#c53b59"
                          : "#f4f3f4"
                      }
                      trackColor={{
                        false: "#767577",
                        true: (COLORS.secondary || "#c53b59") + "80",
                      }}
                    />
                  </View>
                  <View style={styles.actionGrid}>
                    <TouchableOpacity
                      style={styles.actionCard}
                      onPress={() =>
                        setAssignmentModal((p) => ({
                          ...p,
                          type: "class_teacher",
                        }))
                      }
                    >
                      <SVGIcon
                        name="school"
                        size={24}
                        color={COLORS.primary || "#2e86de"}
                      />
                      <Text style={styles.actionLabel}>Class Master</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionCard}
                      onPress={() =>
                        setAssignmentModal((p) => ({ ...p, type: "dept_head" }))
                      }
                    >
                      <SVGIcon
                        name="business"
                        size={24}
                        color={COLORS.primary || "#2e86de"}
                      />
                      <Text style={styles.actionLabel}>Dept Head</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionCard}
                      onPress={() => handleAssignRole("Event Organiser")}
                    >
                      <SVGIcon
                        name="calendar"
                        size={24}
                        color={COLORS.primary || "#2e86de"}
                      />
                      <Text style={styles.actionLabel}>Events</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionCard}
                      onPress={() =>
                        setAssignmentModal((p) => ({ ...p, type: "other" }))
                      }
                    >
                      <SVGIcon
                        name="add"
                        size={24}
                        color={COLORS.primary || "#2e86de"}
                      />
                      <Text style={styles.actionLabel}>Custom</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
              {assignmentModal.type === "permissions" &&
                PERMISSION_KEYS.map((pk) => (
                  <View key={pk.key} style={styles.permItem}>
                    <Text style={styles.permTitle}>{pk.label}</Text>
                    <View style={styles.permPickerBox}>
                      <Picker
                        selectedValue={tempPermissions[pk.key] || "deny"}
                        onValueChange={(v) =>
                          setTempPermissions((prev) => ({
                            ...prev,
                            [pk.key]: v,
                          }))
                        }
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
              {assignmentModal.type === "permissions" && (
                <TouchableOpacity
                  style={[
                    styles.saveBtn,
                    { backgroundColor: COLORS.success || "#05ac5b" },
                  ]}
                  onPress={handleUpdatePermissions}
                >
                  <Text style={styles.saveBtnText}>Commit Changes</Text>
                </TouchableOpacity>
              )}
              {assignmentModal.type === "class_teacher" && (
                <View>
                  {allClasses.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={styles.selectBtn}
                      onPress={() => handleAssignClassTeacher(c.id)}
                    >
                      <Text style={styles.selectBtnText}>{c.name}</Text>
                      <SVGIcon
                        name="chevron-forward"
                        size={18}
                        color="#94A3B8"
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  roleHeader: { padding: 30, backgroundColor: "#fff" },
  roleHeaderTitle: { fontSize: 28, fontWeight: "800", color: "#1E293B" },
  roleHeaderSub: { fontSize: 15, color: "#64748B", marginTop: 4 },
  roleGrid: { padding: 20 },
  roleCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    ...SHADOWS.medium,
  },
  roleIcon: {
    width: 55,
    height: 55,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  roleCardTitle: { fontSize: 18, fontWeight: "700", color: "#1E293B" },
  roleCardSub: { fontSize: 13, color: "#94A3B8" },
  mainHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#fff",
  },
  backButton: { flexDirection: "row", alignItems: "center", marginRight: 12 },
  mainTitle: { fontSize: 20, fontWeight: "800", color: "#1E293B" },
  archiveToggle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    margin: 16,
    paddingHorizontal: 16,
    borderRadius: 15,
    height: 50,
    ...SHADOWS.small,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16, color: "#1E293B" },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 10,
  },
  pickerContainer: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    height: 45,
    justifyContent: "center",
    ...SHADOWS.small,
  },
  picker: { width: "100%" },
  bulkArchiveBtn: {
    backgroundColor: COLORS.primary || "#2e86de",
    height: 45,
    paddingHorizontal: 15,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    ...SHADOWS.small,
  },
  bulkArchiveText: { color: "#fff", fontWeight: "800", fontSize: 11 },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    ...SHADOWS.small,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: (COLORS.primary || "#2e86de") + "15",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: "100%", height: "100%", borderRadius: 15 },
  userName: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
  userSubText: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "800",
    marginTop: 2,
  },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 8, gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 9, fontWeight: "800", textTransform: "uppercase" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: "92%",
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
  detailHero: { alignItems: "center", marginBottom: 20 },
  largeAvatar: {
    width: 90,
    height: 90,
    borderRadius: 25,
    backgroundColor: (COLORS.primary || "#2e86de") + "10",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    ...SHADOWS.small,
    overflow: "hidden",
  },
  avatarImgLarge: { width: "100%", height: "100%", borderRadius: 25 },
  detailName: { fontSize: 24, fontWeight: "800", color: "#1E293B" },
  detailRole: {
    fontSize: 14,
    color: COLORS.primary || "#2e86de",
    fontWeight: "700",
    marginTop: 4,
  },
  financeCardRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  financeBox: {
    flex: 1,
    padding: 15,
    backgroundColor: "#f8fafc",
    borderRadius: 15,
    borderLeftWidth: 4,
  },
  financeLabel: { fontSize: 9, fontWeight: "800", color: "#94A3B8" },
  financeValue: { fontSize: 16, fontWeight: "900", marginTop: 4 },
  infoSection: { marginBottom: 25, paddingHorizontal: 20 },
  infoLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#94A3B8",
    textTransform: "uppercase",
    marginBottom: 12,
    letterSpacing: 1,
  },
  infoGrid: { gap: 10 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  infoKey: { fontSize: 14, color: "#64748B", fontWeight: "600" },
  infoValue: { fontSize: 14, color: "#1E293B", fontWeight: "700" },
  linkedList: { gap: 10 },
  linkedItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
  },
  linkedAvatar: { width: 35, height: 35, borderRadius: 10, marginRight: 12 },
  linkedName: { fontSize: 14, fontWeight: "700", color: "#1E293B" },
  linkedSub: { fontSize: 11, color: "#94A3B8" },
  btnStack: { paddingBottom: 40 },
  actionButton: {
    height: 55,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 20,
  },
  actionButtonText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  assignmentSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: "85%",
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
  saveBtn: {
    height: 60,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
