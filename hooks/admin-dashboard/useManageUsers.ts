import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Platform, Share } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { initializeApp, deleteApp } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocsFromServer,
  increment,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { db, functions, storage } from "../../firebaseConfig";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { sortClasses } from "../../lib/classHelpers";
import { useFinanceCleanup } from "./useFinanceCleanup";
import { useAcademicCleanup } from "./useAcademicCleanup";
import { User, UserRole, PermissionLevel, AssignmentModalState, PERMISSION_KEYS } from "./manage-users-types";
import { useRef } from "react";
import { getStudentFinalEmail } from "../../utils/authUnify";

interface UseManageUsersProps {
  appUser: any;
  acadConfig: any;
  showToast: any;
  router: any;
}

export function useManageUsers({ appUser, acadConfig, showToast, router }: UseManageUsersProps) {
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const currentUserRole = appUser?.adminRole?.toLowerCase() || "";
  const isSuperAdmin = [
    "proprietor",
    "proprietress",
    "manager",
    "headmaster",
    "headmistress",
    "administrator",
    "director",
    "accountant",
    "bursar",
    "admin",
    "super admin",
    "superadmin",
  ].includes(currentUserRole);

  const hasManageUsersAccess =
    appUser?.permissions?.["manage-users"] === "full" || isSuperAdmin;

  useEffect(() => {
    if (appUser && !hasManageUsersAccess) {
      showToast?.({
        message: "Access Denied: Unauthorized management access.",
        type: "error",
      });
      router.replace("/admin-dashboard");
    }
  }, [appUser, hasManageUsersAccess]);

  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedUserUids, setSelectedUserUids] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [allClasses, setAllClasses] = useState<{ id: string; name: string }[]>([]);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [linkedUsers, setLinkedUsers] = useState<User[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [assignmentModal, setAssignmentModal] = useState<AssignmentModalState>({ type: "none", target: null });
  const [updating, setUpdating] = useState(false);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Form states for modals
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    gender: "",
    emergencyPhone: "",
    parentPhone: "",
    dob: null as Date | null,
    busLocation: "",
    takesBus: false,
    onScholarship: false,
    onDiscount: false,
    discountAmount: "",
    isFeeding: false,
    takesExtraClasses: false,
  });

  const [upgradeForm, setUpgradeForm] = useState({
    email: "",
    password: "",
    roleText: "",
    phone: "",
  });

  const [customRoleText, setCustomRoleText] = useState("");
  const [deptText, setDeptText] = useState("");
  const [newsPermission, setNewsPermission] = useState(false);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [busLocations, setBusLocations] = useState<string[]>([]);
  const [isAddingNewBusLoc, setIsAddingNewBusLoc] = useState(false);
  const [newBusLocInput, setNewBusLocInput] = useState("");
  const [tempPermissions, setTempPermissions] = useState<Record<string, PermissionLevel>>({});
  const [targetClassId, setTargetClassId] = useState<string>("");

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const snap = await getDocsFromServer(collection(db, "classes") as any);
        const list = snap.docs.map((d: any) => ({
          id: d.id,
          name: d.data().name || d.id,
        }));
        if (isMounted.current) {
          setAllClasses(sortClasses(list));
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchClasses();
  }, []);

  useEffect(() => {
    const fetchBusRates = async () => {
      try {
        const docRef = doc(db, "school_settings", "bus_rates");
        const snap = await getDoc(docRef);
        if (snap.exists() && isMounted.current) {
          const rates = snap.data() as Record<string, number>;
          setBusLocations(Object.keys(rates).sort());
        }
      } catch (e) {
        console.error("Error fetching bus rates:", e);
      }
    };
    fetchBusRates();
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
      where("status", "in", showArchived ? ["archived"] : ["active", "pending_activation"]),
      limit(100),
    );

    if (selectedRole === "student" && selectedClassId !== "all") {
      q = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("classId", "==", selectedClassId),
        where("status", "in", showArchived ? ["archived"] : ["active", "pending_activation"]),
        limit(100),
      );
    }

    const unsub = onSnapshot(
      q,
      (snap) => {
        if (!isMounted.current) return;
        const fetchedList = snap.docs.map((d: any) => ({ uid: d.id, ...(d.data() as any) }) as User);
        const uniqueList = Array.from(new Map(fetchedList.map((u) => [u.uid, u])).values());

        if (selectedRole === "student") {
          uniqueList.sort((a, b) => {
            const classA = a.classId || "";
            const classB = b.classId || "";
            if (classA !== classB) return classA.localeCompare(classB);
            return (a.profile?.firstName || "").localeCompare(b.profile?.firstName || "");
          });
        } else {
          uniqueList.sort((a, b) => (a.profile?.firstName || "").localeCompare(b.profile?.firstName || ""));
        }
        setUsers(uniqueList);
        setLoading(false);
      },
      (err) => {
        if (!isMounted.current) return;
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

  const isHighestClassView = useMemo(() => {
    if (selectedRole !== "student" || selectedClassId === "all" || allClasses.length === 0) return false;
    return allClasses[allClasses.length - 1].id === selectedClassId;
  }, [selectedRole, selectedClassId, allClasses]);

  useEffect(() => {
    setSelectedUserUids([]);
  }, [selectedRole, selectedClassId, showArchived]);

  const toggleUserSelection = (uid: string) => {
    setSelectedUserUids((prev) => (prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]));
  };

  const handleSelectAll = () => {
    if (filteredUsers.length === 0) return;
    const allUids = filteredUsers.map((u) => u.uid);
    const isAllSelected = allUids.every((uid) => selectedUserUids.includes(uid));
    if (isAllSelected) {
      setSelectedUserUids((prev) => prev.filter((uid) => !allUids.includes(uid)));
    } else {
      setSelectedUserUids((prev) => Array.from(new Set([...prev, ...allUids])));
    }
  };

  const handleBulkImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "text/comma-separated-values",
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets.length) return;

      setLoading(true);
      const fileUri = result.assets[0].uri;
      const response = await fetch(fileUri);
      const csvText = await response.text();

      const rows = csvText.split(/\r?\n|\r/).filter((line) => line.trim() !== "");
      if (rows.length < 2) throw new Error("CSV file is empty or missing data.");

      const userData = rows.slice(1);

      let count = 0;
      let activatedCount = 0;
      let pendingCount = 0;
      let studentIncrement = 0;
      let staffIncrement = 0;
      let importErrors: string[] = [];

      // Initialize secondary auth for bulk creation if needed
      const firebaseConfig = (SCHOOL_CONFIG as any).firebase;
      if (!firebaseConfig || !firebaseConfig.apiKey) {
        throw new Error("Invalid school configuration: Firebase credentials missing for bulk activation.");
      }

      // Reuse or initialize the secondary app more efficiently
      const secondaryAppName = `bulk-import-${Date.now()}`;
      const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);

      try {
        // Firestore batch limit is 500. Each user has 1 set.
        const CHUNK_SIZE = 450;
        for (let i = 0; i < userData.length; i += CHUNK_SIZE) {
          const chunk = userData.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(db);
          let chunkStudentIncrement = 0;
          let chunkStaffIncrement = 0;

          for (const row of chunk) {
            const values = row.split(/[,;\t]/).map(v => v.trim().replace(/^"|"$/g, ''));

            if (values.length < 2) continue;

            const firstName = values[0];
            const lastName = values[1];
            const gender = values[2] || "";
            const extraInput = values[3];

            const cleanString = (val: string) => {
              if (!val) return "";
              const cleaned = val.trim().replace(/^"|"$/g, '');
              if (cleaned.toUpperCase().includes("E+")) {
                const num = Number(cleaned);
                return isNaN(num) ? cleaned : num.toLocaleString("fullwide", { useGrouping: false });
              }
              return cleaned;
            };

            const emergencyPhone = cleanString(values[4] || "");
            const parentPhone = cleanString(values[5] || "");
            const rawEmail = cleanString(values[6] || "");
            const password = cleanString(values[7] || "");

            if (!firstName || !lastName || firstName.toLowerCase() === "firstname") continue;

            const email = getStudentFinalEmail(rawEmail);

            let authUid = "";
            let signupCode = "";
            let status = "pending_activation";

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            // LOGIC: Create Auth Account "On the Go" if Email & Password exist
            if (email && password && password.length >= 6) {
              if (!emailRegex.test(email)) {
                importErrors.push(`${firstName} ${lastName}: Invalid email "${email}"`);
                // Fallback to signup code if email is invalid
                signupCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                pendingCount++;
              } else {
                try {
                  // Attempt to create Firebase Auth account
                  const userCred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
                  authUid = userCred.user.uid;
                  status = "active"; // Account is live!
                  activatedCount++;
                } catch (authError: any) {
                  const errorCode = (authError as any).code || 'auth-error';
                  console.warn(`Auth Error for ${email}: ${errorCode}`);

                  if (errorCode === 'auth/email-already-in-use') {
                    importErrors.push(`${firstName} ${lastName}: Email "${email}" is already taken.`);
                  } else {
                    importErrors.push(`${firstName} ${lastName} (${email}): ${errorCode}`);
                  }

                  // Fallback to signup code so they aren't lost
                  signupCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                  pendingCount++;
                }
              }
            } else {
              // Standard behavior: No email/pass provided, generate code for later
              signupCode = Math.random().toString(36).substring(2, 8).toUpperCase();
              pendingCount++;
            }

            const tempId = authUid || doc(collection(db, "users")).id;

            const newUserDoc: any = {
              uid: tempId,
              role: selectedRole,
              status: status,
              profile: { firstName, lastName, gender, emergencyPhone, parentPhone },
              createdAt: Timestamp.now(),
            };

            if (email) {
              newUserDoc.email = email.toLowerCase();
              newUserDoc.profile.email = email.toLowerCase();
            }
            if (authUid) {
              newUserDoc.authUid = authUid;
              newUserDoc.hasLoginEnabled = true;
            }

            let importClassId = "";
            if (selectedRole === "student") {
              if (extraInput) {
                const matchedClass = allClasses.find(
                  (c) => c.name.toLowerCase() === extraInput.toLowerCase() || c.id === extraInput,
                );
                importClassId = matchedClass ? matchedClass.id : "";
              } else {
                importClassId = selectedClassId === "all" ? "" : selectedClassId;
              }
              newUserDoc.classId = importClassId;
              chunkStudentIncrement++;
            } else if (["admin", "staff", "teacher"].includes(selectedRole || "")) {
              if (extraInput) newUserDoc.adminRole = extraInput;
              chunkStaffIncrement++;
            }

            if (signupCode) {
              newUserDoc.signupCode = signupCode;
              const codeData: any = {
                code: signupCode,
                intendedForRole: selectedRole,
                used: false,
                createdBy: appUser?.uid,
                createdAt: serverTimestamp(),
              };
              if (selectedRole === "student") {
                codeData.classId = importClassId;
              }
              batch.set(doc(db, "signupCodes", signupCode), codeData);
            }

            batch.set(doc(db, "users", tempId), newUserDoc);
            count++;
          }

          if (chunkStudentIncrement > 0 || chunkStaffIncrement > 0) {
            const statsRef = doc(db, "stats", "global");
            const statsUpdate: any = {};
            if (chunkStudentIncrement > 0) statsUpdate.totalStudents = increment(chunkStudentIncrement);
            if (chunkStaffIncrement > 0) statsUpdate.totalStaff = increment(chunkStaffIncrement);
            batch.set(statsRef, statsUpdate, { merge: true });
            studentIncrement += chunkStudentIncrement;
            staffIncrement += chunkStaffIncrement;
          }
          await batch.commit();
        }

        if (count > 0) {
          let summaryMsg = `Successfully imported ${count} ${selectedRole}(s).`;
          if (activatedCount > 0) summaryMsg += `\n- ${activatedCount} Active (Login enabled)`;
          if (pendingCount > 0) summaryMsg += `\n- ${pendingCount} Pending Activation`;

          if (importErrors.length > 0) {
            Alert.alert(
              "Import Completed with Warnings",
              `${summaryMsg}\n\nSome accounts could not be activated:\n${importErrors.slice(0, 5).join("\n")}${importErrors.length > 5 ? "\n..." : ""}`,
              [{ text: "OK" }]
            );
          } else {
            showToast?.({ message: summaryMsg, type: "success" });
          }
        }
      } finally {
        await deleteApp(secondaryApp);
      }
    } catch (error: any) {
      console.error(error);
      showToast?.({ message: `Import Failed: ${error.message}`, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUpdate = async (field: string, value: any) => {
    if (selectedUserUids.length === 0) return;
    setUpdating(true);
    try {
      const batch = writeBatch(db);

      // Firestore batch limit is 500. Each user has 1 update.
      const CHUNK_SIZE = 450;
      for (let i = 0; i < selectedUserUids.length; i += CHUNK_SIZE) {
        const chunk = selectedUserUids.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((uid) => {
          batch.update(doc(db, "users", uid), { [field]: value });
        });
        await batch.commit();
      }

      setSelectedUserUids([]);
      showToast?.({ message: `Updated ${selectedUserUids.length} students`, type: "success" });
    } catch (error) {
      console.error(error);
      showToast?.({ message: "Bulk update failed.", type: "error" });
    } finally {
      setUpdating(false);
    }
  };

  const fetchLinkedUsers = async (user: User) => {
    setLoadingLinks(true);
    setLinkedUsers([]);
    try {
      let idsToFetch: string[] = [];
      if (user.role === "parent" && user.childrenIds?.length) idsToFetch = user.childrenIds;
      else if (user.role === "student" && user.parentUids?.length) idsToFetch = user.parentUids;

      if (idsToFetch.length > 0) {
        const q = query(collection(db, "users"), where(documentId(), "in", idsToFetch));
        const snap = await getDocsFromServer(q as any);
        setLinkedUsers(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as any) }) as User));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLinks(false);
    }
  };

  const handleUnlinkParent = async (parentUid: string) => {
    if (!viewingUser) return;
    setUpdating(true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "users", viewingUser.uid), { parentUids: arrayRemove(parentUid) });
      batch.update(doc(db, "users", parentUid), { childrenIds: arrayRemove(viewingUser.uid) });
      await batch.commit();
      setLinkedUsers((prev) => prev.filter((u) => u.uid !== parentUid));
      setViewingUser((prev) =>
        prev ? { ...prev, parentUids: prev.parentUids?.filter((id) => id !== parentUid) } : null,
      );
      showToast?.({ message: "Parent unlinked from student record.", type: "success" });
    } catch (err) {
      showToast?.({ message: "Failed to unlink parent.", type: "error" });
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdatePermissions = async () => {
    if (!assignmentModal.target) return;
    setUpdating(true);
    try {
      const sanitized: Record<string, PermissionLevel> = Object.entries(tempPermissions || {}).reduce(
        (acc, [k, v]) => {
          if (["full", "view", "edit", "deny"].includes(v)) acc[k] = v as PermissionLevel;
          return acc;
        },
        {} as Record<string, PermissionLevel>,
      );
      await updateDoc(doc(db, "users", assignmentModal.target.uid), {
        permissions: sanitized,
        canCreateNews: newsPermission
      });
      const updatedUser = {
        ...assignmentModal.target,
        permissions: sanitized,
        canCreateNews: newsPermission
      };
      if (viewingUser?.uid === updatedUser.uid) setViewingUser(updatedUser);
      setAssignmentModal({ type: "none", target: null });
      showToast?.({ message: "Admin permissions updated", type: "success" });
    } catch (e: any) {
      console.error("Failed to update permissions:", e);
      const errorMsg = e.code === 'permission-denied'
        ? "Access Denied: You don't have permission to modify these settings."
        : "Failed to update permissions. Please try again.";
      showToast?.({ message: errorMsg, type: "error" });
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
      const updatedUser = {
        ...teacher,
        assignedRoles: teacher.assignedRoles ? Array.from(new Set([...teacher.assignedRoles, roleName])) : [roleName],
        canCreateNews: newsPermission,
      };
      if (viewingUser?.uid === teacher.uid) setViewingUser(updatedUser);
      setAssignmentModal({ type: "none", target: null });
      setCustomRoleText("");
      setDeptText("");
      showToast?.({ message: `Role assigned: ${roleName}`, type: "success" });
    } catch {
      showToast?.({ message: "Failed to assign role.", type: "error" });
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateClasses = async () => {
    if (!assignmentModal.target) return;
    setUpdating(true);
    try {
      await updateDoc(doc(db, "users", assignmentModal.target.uid), { classes: selectedClasses });
      const updatedUser = { ...assignmentModal.target, classes: selectedClasses };
      if (viewingUser?.uid === updatedUser.uid) setViewingUser(updatedUser);
      setAssignmentModal({ type: "none", target: null });
      showToast?.({ message: "Teacher classes updated.", type: "success" });
    } catch (err) {
      showToast?.({ message: "Failed to update classes.", type: "error" });
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateSubjects = async () => {
    if (!assignmentModal.target) return;
    setUpdating(true);
    try {
      await updateDoc(doc(db, "users", assignmentModal.target.uid), { subjects: selectedSubjects });
      const updatedUser = { ...assignmentModal.target, subjects: selectedSubjects };
      if (viewingUser?.uid === updatedUser.uid) setViewingUser(updatedUser);
      setAssignmentModal({ type: "none", target: null });
      showToast?.({ message: "Teacher subjects updated.", type: "success" });
    } catch (err) {
      showToast?.({ message: "Failed to update subjects.", type: "error" });
    } finally {
      setUpdating(false);
    }
  };

  const handleAssignDeptHead = async (department: string) => {
    const teacher = assignmentModal.target;
    if (!teacher || !department.trim()) {
      showToast?.({ message: "Error: Please enter a department name.", type: "error" });
      return;
    }
    setUpdating(true);
    try {
      await updateDoc(doc(db, "users", teacher.uid), {
        assignedRoles: arrayUnion("Dept Head"),
        departmentHeadOf: department.trim(),
        canCreateNews: newsPermission,
      });
      const updatedUser = {
        ...teacher,
        assignedRoles: teacher.assignedRoles ? Array.from(new Set([...teacher.assignedRoles, "Dept Head"])) : ["Dept Head"],
        departmentHeadOf: department.trim(),
        canCreateNews: newsPermission,
      };
      if (viewingUser?.uid === teacher.uid) setViewingUser(updatedUser);
      setAssignmentModal({ type: "none", target: null });
      setDeptText("");
      showToast?.({ message: `Assigned Dept Head (${department.trim()})`, type: "success" });
    } catch (e) {
      console.error(e);
      showToast?.({ message: "Failed to assign dept head.", type: "error" });
    } finally {
      setUpdating(false);
    }
  };

  const handleRemoveAssignedRole = async (roleName: string, user: User) => {
    if (!user) return;
    const performRemove = async () => {
      setUpdating(true);
      try {
        const batch = writeBatch(db);
        const userRef = doc(db, "users", user.uid);
        batch.update(userRef, { assignedRoles: arrayRemove(roleName) });
        if (roleName === "Dept Head") batch.update(userRef, { departmentHeadOf: null });
        if (roleName === "Class Teacher" || user.classTeacherOf) {
          if (user.classTeacherOf) batch.update(doc(db, "classes", user.classTeacherOf), { classTeacherId: null });
          batch.update(userRef, { classTeacherOf: null });
        }
        await batch.commit();
        setViewingUser((prev) =>
          prev
            ? {
                ...prev,
                assignedRoles: prev.assignedRoles?.filter((r) => r !== roleName),
                departmentHeadOf: roleName === "Dept Head" ? undefined : prev.departmentHeadOf,
                classTeacherOf: roleName === "Class Teacher" ? undefined : prev.classTeacherOf,
              }
            : prev,
        );
        showToast?.({ message: "Role removed.", type: "success" });
      } catch (e) {
        console.error(e);
        showToast?.({ message: "Failed to remove role.", type: "error" });
      } finally {
        setUpdating(false);
      }
    };

    const displayName = `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}`.trim() || user.uid;
    if (Platform.OS === "web") {
      if (window.confirm(`Confirm\n\nRemove role '${roleName}' from ${displayName}?`)) performRemove();
    } else {
      Alert.alert("Confirm", `Remove role '${roleName}' from ${displayName}?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: performRemove },
      ]);
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
      if (teacher.classTeacherOf) batch.update(doc(db, "classes", teacher.classTeacherOf), { classTeacherId: null });
      if (targetClassId && !isAlreadyAssigned) {
        const classDoc = await getDoc(doc(db, "classes", targetClassId));
        const oldId = classDoc.data()?.classTeacherId;
        if (oldId && oldId !== teacher.uid) batch.update(doc(db, "users", oldId), { classTeacherOf: null });
      }
      batch.update(doc(db, "users", teacher.uid), {
        classTeacherOf: finalClassId,
        assignedRoles: arrayUnion("Class Teacher"),
        canCreateNews: newsPermission,
      });
      if (targetClassId) batch.update(doc(db, "classes", targetClassId), { classTeacherId: isAlreadyAssigned ? null : teacher.uid });
      await batch.commit();
      const updatedUser = {
        ...teacher,
        classTeacherOf: finalClassId || undefined,
        assignedRoles: teacher.assignedRoles ? Array.from(new Set([...teacher.assignedRoles, "Class Teacher"])) : ["Class Teacher"],
        canCreateNews: newsPermission,
      };
      if (viewingUser?.uid === teacher.uid) setViewingUser(updatedUser);
      setAssignmentModal({ type: "none", target: null });
      showToast?.({ message: "Class Teacher assigned.", type: "success" });
    } catch {
      showToast?.({ message: "Assignment failed.", type: "error" });
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleArchiveStatus = async (user: User) => {
    if (!isSuperAdmin) {
      showToast?.({ message: "Denied: Only super admins can archive students.", type: "error" });
      return;
    }
    const displayName = `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}`.trim() || "Student";
    const isArchived = user.status === "archived";
    const msg = isArchived
      ? `Restore ${displayName} to active status?`
      : `Set ${displayName} as 'Stopped'? This will move them to the archive.`;

    const performToggle = async () => {
      setUpdating(true);
      try {
        const batch = writeBatch(db);
        const updates: any = {
          status: isArchived ? "active" : "archived",
          archivedAt: isArchived ? null : Timestamp.now(),
        };
        if (!isArchived && user.classId) {
          updates.previousClassId = user.classId;
          updates.classId = "archived";
        }

        // Keep parent links for historical record access
        // if (!isArchived && user.role === "student" && user.parentUids?.length) {
        //   user.parentUids.forEach((pUid) => {
        //     batch.update(doc(db, "users", pUid), {
        //       childrenIds: arrayRemove(user.uid),
        //     });
        //   });
        //   updates.parentUids = [];
        // }

        batch.update(doc(db, "users", user.uid), updates);
        if (user.role === "student") {
          const statsRef = doc(db, "stats", "global");
          batch.set(statsRef, { totalStudents: increment(isArchived ? 1 : -1) }, { merge: true });
        }
        await batch.commit();
        if (viewingUser?.uid === user.uid) setViewingUser({ ...viewingUser, ...updates });
        showToast?.({ message: isArchived ? "Student restored." : "Student moved to archive.", type: "success" });
      } catch (e) {
        console.error(e);
        showToast?.({ message: "Action failed.", type: "error" });
      } finally {
        setUpdating(false);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm(msg)) performToggle();
    } else {
      Alert.alert(isArchived ? "Restore Student" : "Student Stopped School?", msg, [
        { text: "Cancel", style: "cancel" },
        { text: isArchived ? "Restore" : "Set to Stopped", onPress: performToggle },
      ]);
    }
  };

  const handleGraduateClass = async () => {
    const currentClassName = allClasses.find((c) => c.id === selectedClassId)?.name || "";
    const highestClass = allClasses.length > 0 ? allClasses[allClasses.length - 1] : null;
    if (!highestClass || highestClass.id !== selectedClassId) {
      showToast?.({ message: `Graduation can only be triggered from ${highestClass?.name || "the highest class"}.`, type: "error" });
      return;
    }
    const targetStudents = users.filter((u) => u.status !== "archived");
    if (targetStudents.length === 0) {
      showToast?.({ message: `No active ${currentClassName} students found.`, type: "error" });
      return;
    }
    const performGraduation = async () => {
      setUpdating(true);
      try {
        const currentYear = acadConfig.academicYear || "Unknown Year";
        const chunks = [];
        for (let i = 0; i < targetStudents.length; i += 100) chunks.push(targetStudents.slice(i, i + 100));
        for (const chunk of chunks) {
          const batch = writeBatch(db);
          chunk.forEach((s) => {
            const updates: any = {
              status: "archived",
              archivedAt: Timestamp.now(),
              archivedInYear: currentYear,
              classId: "archived",
            };

            // Unlink from parents during graduation
            if (s.parentUids?.length) {
              s.parentUids.forEach((pUid: string) => {
                batch.update(doc(db, "users", pUid), {
                  childrenIds: arrayRemove(s.uid),
                });
              });
              updates.parentUids = [];
            }

            batch.update(doc(db, "users", s.uid), updates);
          });
          batch.set(doc(db, "stats", "global"), { totalStudents: increment(-chunk.length) }, { merge: true });
          await batch.commit();
        }
        setSelectedUserUids([]);
        showToast?.({ message: `Graduation for ${currentYear} completed.`, type: "success" });
      } catch (e) {
        showToast?.({ message: "Graduation process failed.", type: "error" });
      } finally {
        setUpdating(false);
      }
    };
    if (Platform.OS === "web") {
      if (window.confirm(`Move ${targetStudents.length} students from ${currentClassName} to Archive for ${acadConfig.academicYear}?`)) performGraduation();
    } else {
      Alert.alert("Confirm Graduation", `Move ${targetStudents.length} students from ${currentClassName} to Archive for ${acadConfig.academicYear}?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Graduate & Archive", style: "destructive", onPress: performGraduation },
      ]);
    }
  };

  const handleDeleteUser = (user: User) => {
    if (user.uid === appUser?.uid) {
      showToast?.({ message: "Error: You cannot delete your own account.", type: "error" });
      return;
    }
    const performDelete = async () => {
      const uidToDelete = user.uid;
      setDeletingUid(uidToDelete);
      setUpdating(true);
      try {
        const batch = writeBatch(db);
        if (user.role === "teacher" && user.classTeacherOf) batch.update(doc(db, "classes", user.classTeacherOf), { classTeacherId: null });
        if (user.role === "student" && user.parentUids?.length) {
          user.parentUids.forEach((pUid) => batch.update(doc(db, "users", pUid), { childrenIds: arrayRemove(uidToDelete) }));
        }
        if (user.role === "parent" && user.childrenIds?.length) {
          user.childrenIds.forEach((sUid) => batch.update(doc(db, "users", sUid), { parentUids: arrayRemove(uidToDelete) }));
        }
        const statsRef = doc(db, "stats", "global");
        if (user.role === "student" && user.status !== "archived") batch.set(statsRef, { totalStudents: increment(-1) }, { merge: true });
        else if (["admin", "teacher", "staff"].includes(user.role)) batch.set(statsRef, { totalStaff: increment(-1) }, { merge: true });
        await batch.commit();
        await httpsCallable(functions, "deleteUserAccount")({ uid: uidToDelete });
        setUsers((prev) => prev.filter((u) => u.uid !== uidToDelete));
        showToast?.({ message: "Account and references removed.", type: "success" });
      } catch (error: any) {
        console.error("Deletion failed:", error);
        try {
          await deleteDoc(doc(db, "users", uidToDelete));
          setUsers((prev) => prev.filter((u) => u.uid !== uidToDelete));
          showToast?.({ message: "Partial Success: Database entry removed.", type: "warning" });
        } catch (dbError) {
          showToast?.({ message: "Failed to delete user record.", type: "error" });
        }
      } finally {
        setDeletingUid(null);
        setUpdating(false);
        setViewingUser(null);
      }
    };

    const displayName = `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}`.trim() || user.uid;
    if (Platform.OS === "web") {
      if (window.confirm(`Permanently delete ${displayName} (${user.role})?`)) performDelete();
    } else {
      Alert.alert("Critical Action", `Permanently delete ${displayName} (${user.role})?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: performDelete },
      ]);
    }
  };

  const handleUpdateProfile = async () => {
    if (!assignmentModal.target || !hasManageUsersAccess) return;
    if (!editForm.firstName.trim() || !editForm.lastName.trim()) {
      showToast?.({ message: "Error: Names cannot be empty.", type: "error" });
      return;
    }
    setUpdating(true);
    try {
      const batch = writeBatch(db);
      const userRef = doc(db, "users", assignmentModal.target.uid);
      const updates: any = {
        email: editForm.email.trim().toLowerCase(),
        "profile.firstName": editForm.firstName.trim(),
        "profile.lastName": editForm.lastName.trim(),
        "profile.email": editForm.email.trim().toLowerCase(),
        "profile.phone": editForm.phone.trim(),
        "profile.gender": editForm.gender,
        "profile.emergencyPhone": editForm.emergencyPhone.trim(),
        "profile.parentPhone": editForm.parentPhone.trim(),
        busLocation: editForm.busLocation.trim(),
        takesBus: editForm.takesBus,
        onScholarship: editForm.onScholarship,
        onDiscount: editForm.onDiscount,
        discountAmount: editForm.onDiscount ? parseFloat(editForm.discountAmount) || 0 : 0,
        isFeeding: editForm.isFeeding,
        takesExtraClasses: editForm.takesExtraClasses,
      };
      if (editForm.dob) updates.dateOfBirth = Timestamp.fromDate(editForm.dob);
      batch.update(userRef, updates);

      if (!editForm.onDiscount && assignmentModal.target.onDiscount) {
        const { academicYear, currentTerm } = acadConfig;
        if (academicYear && currentTerm) {
          const recordId = `${assignmentModal.target.uid}_${academicYear.replace(/\//g, "-")}_${currentTerm.replace(/\s/g, "")}`;
          const recordSnap = await getDoc(doc(db, "studentFeeRecords", recordId));
          if (recordSnap.exists()) {
            const currentDiscount = recordSnap.data().discount || 0;
            if (currentDiscount > 0) {
              batch.update(doc(db, "studentFeeRecords", recordId), { discount: 0, balance: increment(currentDiscount) });
              batch.update(userRef, { walletBalance: increment(currentDiscount) });
            }
          }
        }
      }
      await batch.commit();
      const updatedUser = {
        ...assignmentModal.target,
        profile: { ...assignmentModal.target.profile, ...updates["profile"] },
        ...updates,
      };
      if (viewingUser?.uid === updatedUser.uid) setViewingUser(updatedUser);
      showToast?.({ message: "Profile updated.", type: "success" });
      setAssignmentModal({ type: "none", target: null });
    } catch (e) {
      console.error(e);
      showToast?.({ message: "Update failed.", type: "error" });
    } finally {
      setUpdating(false);
    }
  };

  const handleUpgradeStaff = async () => {
    if (!assignmentModal.target) return;
    if (!upgradeForm.email.trim() || upgradeForm.password.length < 6) {
      showToast?.({ message: "Error: Invalid email or short password.", type: "error" });
      return;
    }
    setUpdating(true);
    const secondaryAppName = `upgrade-staff-${Date.now()}`;
    const secondaryApp = initializeApp((SCHOOL_CONFIG as any).firebase || {}, secondaryAppName);
    try {
      const userCredential = await createUserWithEmailAndPassword(getAuth(secondaryApp), upgradeForm.email.trim(), upgradeForm.password);
      const updates = {
        authUid: userCredential.user.uid,
        role: "staff" as UserRole,
        email: upgradeForm.email.trim().toLowerCase(),
        adminRole: upgradeForm.roleText.trim(),
        "profile.phone": upgradeForm.phone.trim(),
        "profile.email": upgradeForm.email.trim().toLowerCase(),
        hasLoginEnabled: true,
      };
      await updateDoc(doc(db, "users", assignmentModal.target.uid), updates);
      if (viewingUser?.uid === assignmentModal.target.uid) setViewingUser({ ...viewingUser, ...updates });
      showToast?.({ message: "Staff account upgraded.", type: "success" });
      setAssignmentModal({ type: "none", target: null });
    } catch (e: any) {
      showToast?.({ message: `Error: ${e.message}`, type: "error" });
    } finally {
      await deleteApp(secondaryApp);
      setUpdating(false);
    }
  };

  const handleRegenerateSignupCode = async (user: User) => {
    if (user.status !== "pending_activation") return;
    setUpdating(true);
    try {
      const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const batch = writeBatch(db);

      // Update user doc
      batch.update(doc(db, "users", user.uid), { signupCode: newCode });

      // Create new signup code doc
      const codeData: any = {
        code: newCode,
        intendedForRole: user.role,
        used: false,
        createdBy: appUser?.uid,
        createdAt: serverTimestamp(),
      };
      if (user.classId) codeData.classId = user.classId;
      batch.set(doc(db, "signupCodes", newCode), codeData);

      // Clean up old code if it existed
      if (user.signupCode) {
        batch.delete(doc(db, "signupCodes", user.signupCode));
      }

      await batch.commit();

      if (viewingUser?.uid === user.uid) setViewingUser({ ...user, signupCode: newCode });
      showToast?.({ message: `Code Regenerated: ${newCode}`, type: "success" });
    } catch (err) {
      console.error(err);
      showToast?.({ message: "Failed to regenerate code.", type: "error" });
    } finally {
      setUpdating(false);
    }
  };

  const handleShareCode = async (user: User) => {
    const code = user.signupCode || user.secretCode;
    if (!code) return;
    const firstName = user.profile?.firstName || "there";
    try {
      await Share.share({ message: `Hello ${firstName}, your ${acadConfig.schoolName || "school"} token is: ${code}` });
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdateEmail = async () => {
    if (!assignmentModal.target || !editForm.email.trim()) return;
    setUpdating(true);
    try {
      await httpsCallable(functions, "updateUserEmail")({ uid: assignmentModal.target.uid, newEmail: editForm.email.trim() });
      await updateDoc(doc(db, "users", assignmentModal.target.uid), { "profile.email": editForm.email.trim() });
      showToast?.({ message: "Email updated.", type: "success" });
      setAssignmentModal({ type: "none", target: null });
    } catch (err: any) {
      showToast?.({ message: `Error: ${err.message}`, type: "error" });
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveNewBusLocation = async (targetUser?: User | null) => {
    if (!newBusLocInput.trim()) return;
    setUpdating(true);
    try {
      const newLoc = newBusLocInput.trim();
      await setDoc(doc(db, "school_settings", "bus_rates"), { [newLoc]: 0 }, { merge: true });
      setBusLocations(prev => (prev.includes(newLoc) ? prev : [...prev, newLoc].sort()));
      if (assignmentModal.type === 'edit_profile') setEditForm(p => ({ ...p, busLocation: newLoc }));
      else if (targetUser) {
        await updateDoc(doc(db, "users", targetUser.uid), { busLocation: newLoc });
        if (viewingUser?.uid === targetUser.uid) setViewingUser({ ...viewingUser, busLocation: newLoc });
      }
      setNewBusLocInput("");
      setIsAddingNewBusLoc(false);
      showToast?.({ message: "New bus location added", type: "success" });
    } catch (e) {
      showToast?.({ message: "Failed to add location.", type: "error" });
    } finally {
      setUpdating(false);
    }
  };

  const openPermissionModal = (user: User) => {
    const defaults = PERMISSION_KEYS.reduce((acc, p) => ({ ...acc, [p.key]: "deny" as PermissionLevel }), {});
    const incoming = user.permissions || {};
    const merged = Object.keys(defaults).reduce((acc, k) => {
      const val = (incoming as any)[k];
      acc[k] = ["full", "view", "edit", "deny"].includes(val) ? (val as PermissionLevel) : "deny";
      return acc;
    }, {} as Record<string, PermissionLevel>);
    setTempPermissions(merged);
    setNewsPermission(!!user.canCreateNews);
    setAssignmentModal({ type: "permissions", target: user });
  };

  const openEditProfile = (user: User) => {
    setEditForm({
      firstName: user.profile?.firstName || "",
      lastName: user.profile?.lastName || "",
      email: user.profile?.email || "",
      phone: user.profile?.phone || "",
      gender: user.profile?.gender || "",
      emergencyPhone: user.profile?.emergencyPhone || "",
      parentPhone: user.profile?.parentPhone || "",
      busLocation: user.busLocation || "",
      takesBus: !!user.takesBus,
      onScholarship: !!user.onScholarship,
      onDiscount: !!user.onDiscount,
      discountAmount: user.discountAmount ? String(user.discountAmount) : "",
      isFeeding: !!user.isFeeding,
      takesExtraClasses: !!user.takesExtraClasses,
      dob: user.dateOfBirth?.toDate ? user.dateOfBirth.toDate() : user.dateOfBirth ? new Date(user.dateOfBirth) : null,
    });
    setAssignmentModal({ type: "edit_profile", target: user });
  };

  const handleCopyAllCodes = async () => {
    const pendingStudents = filteredUsers.filter((u) => u.status === "pending_activation" && u.signupCode);
    if (pendingStudents.length === 0) {
      showToast?.({ message: "No pending students with codes found.", type: "error" });
      return;
    }
    const report = pendingStudents.map((s) => `${s.profile.firstName} ${s.profile.lastName}: ${s.signupCode}`).join("\n");
    await Clipboard.setStringAsync(report);
    showToast?.({ message: `Codes for ${pendingStudents.length} students copied.`, type: "success" });
  };

  const clearServiceArrears = async (user: User) => {
    const performClear = async () => {
      try {
        await updateDoc(doc(db, "users", user.uid), {
          dailyArrears: 0,
          termArrears: {}
        });
        if (viewingUser?.uid === user.uid) setViewingUser({
          ...viewingUser,
          dailyArrears: 0,
          termArrears: {}
        });
        showToast?.({ message: "All service arrears cleared.", type: "success" });
      } catch (err) {
        showToast?.({ message: "Failed to clear arrears.", type: "error" });
      }
    };
    if (Platform.OS === "web") {
      if (window.confirm("Reset ALL service arrears (including all terms) to 0?")) performClear();
    } else {
      Alert.alert("Clear All Arrears", "Reset ALL service arrears (including all terms) to 0?", [
        { text: "Cancel", style: "cancel" },
        { text: "Clear All", style: "destructive", onPress: performClear }
      ]);
    }
  };

  const clearTermArrears = async (termKey: string, user: User) => {
    const performClear = async () => {
      try {
        const amount = user.termArrears?.[termKey] || 0;
        await updateDoc(doc(db, "users", user.uid), {
          dailyArrears: increment(-amount),
          [`termArrears.${termKey}`]: 0
        });

        if (viewingUser?.uid === user.uid) {
           const newTermArrears = { ...(viewingUser.termArrears || {}) };
           newTermArrears[termKey] = 0;
           setViewingUser({
             ...viewingUser,
             dailyArrears: (viewingUser.dailyArrears || 0) - amount,
             termArrears: newTermArrears
           });
        }
        showToast?.({ message: `Arrears for ${termKey.replace(/_/g, ' ')} cleared.`, type: "success" });
      } catch (err) {
        showToast?.({ message: "Failed to clear term arrears.", type: "error" });
      }
    };

    const displayTerm = termKey.replace(/_/g, ' ');
    if (Platform.OS === "web") {
      if (window.confirm(`Reset arrears for ${displayTerm} to 0?`)) performClear();
    } else {
      Alert.alert("Clear Term Arrears", `Reset arrears for ${displayTerm} to 0?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Clear", style: "destructive", onPress: performClear }
      ]);
    }
  };

  const handleUploadProfileImage = async (user: User, source: 'library' | 'camera') => {
    try {
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      };

      const result = source === 'library'
        ? await ImagePicker.launchImageLibraryAsync(options)
        : await ImagePicker.launchCameraAsync(options);

      if (result.canceled || !result.assets.length) return;

      setUploadingImage(true);
      const uri = result.assets[0].uri;
      const response = await fetch(uri);
      const blob = await response.blob();
      const storageRef = ref(storage, `profiles/${user.uid}.jpg`);

      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);

      await updateDoc(doc(db, "users", user.uid), {
        "profile.profileImage": downloadURL,
      });

      if (viewingUser?.uid === user.uid) {
        setViewingUser({
          ...viewingUser,
          profile: { ...viewingUser.profile, profileImage: downloadURL },
        });
      }

      showToast?.({ message: "Profile image updated!", type: "success" });
    } catch (err) {
      console.error(err);
      showToast?.({ message: "Could not save image.", type: "error" });
    } finally {
      setUploadingImage(false);
    }
  };

  const handlePromoteRepeat = async (action: "Promote" | "Repeat") => {
    if (!targetClassId) {
      showToast?.({ message: "Please select a target class.", type: "error" });
      return;
    }
    const isBulk = selectedUserUids.length > 0;
    let targetUids = isBulk ? selectedUserUids : (assignmentModal.target ? [assignmentModal.target.uid] : []);

    // If no specific selection, but a class is filtered, target the entire class
    if (targetUids.length === 0 && selectedClassId !== "all") {
      targetUids = users.map((u) => u.uid);
    }

    if (targetUids.length === 0) {
      showToast?.({ message: "No students selected to move.", type: "error" });
      return;
    }

    setUpdating(true);
    try {
      const batch = writeBatch(db);
      targetUids.forEach((uid) => {
        const user = users.find(u => u.uid === uid);
        const currentStatus = user?.status || "active";
        // Preserve pending_activation status so they can still sign up after being moved
        const newStatus = currentStatus === "pending_activation" ? "pending_activation" : "active";

        batch.update(doc(db, "users", uid), {
          classId: targetClassId,
          status: newStatus,
        });
      });
      await batch.commit();

      showToast?.({
        message: `${action} successful for ${targetUids.length} student(s).`,
        type: "success",
      });
      setSelectedUserUids([]);
      setAssignmentModal({ type: "none", target: null });
      setTargetClassId("");
    } catch (e: any) {
      console.error(e);
      showToast?.({ message: "Action failed. Check permissions.", type: "error" });
    } finally {
      setUpdating(false);
    }
  };

  const { cleaning: isFinanceCleaning, runCleanup: runFinanceCleanup, runMigration: runFinanceMigration } = useFinanceCleanup(showToast);
  const { cleaning: isAcademicCleaning, runCleanup: runAcademicCleanup } = useAcademicCleanup(showToast);

  return {
    selectedRole, setSelectedRole,
    selectedClassId, setSelectedClassId,
    searchQuery, setSearchQuery,
    showArchived, setShowArchived,
    selectedUserUids, setSelectedUserUids,
    users, loading, refreshing,
    allClasses,
    viewingUser, setViewingUser,
    linkedUsers, loadingLinks,
    assignmentModal, setAssignmentModal,
    updating, deletingUid, uploadingImage,
    editForm, setEditForm,
    upgradeForm, setUpgradeForm,
    customRoleText, setCustomRoleText,
    deptText, setDeptText,
    newsPermission, setNewsPermission,
    selectedSubjects, setSelectedSubjects,
    selectedClasses, setSelectedClasses,
    busLocations,
    isAddingNewBusLoc, setIsAddingNewBusLoc,
    newBusLocInput, setNewBusLocInput,
    tempPermissions, setTempPermissions,
    targetClassId, setTargetClassId,
    filteredUsers, isHighestClassView,
    toggleUserSelection, handleSelectAll,
    handleBulkImport, handleBulkUpdate,
    fetchLinkedUsers, handleUnlinkParent,
    handleUpdatePermissions, handleAssignRole,
    handleUpdateClasses, handleUpdateSubjects,
    handleAssignDeptHead, handleRemoveAssignedRole,
    handleAssignClassTeacher, handleToggleArchiveStatus,
    handleGraduateClass, handleDeleteUser,
    handleUpdateProfile, handleUpgradeStaff,
    handleRegenerateSignupCode, handleShareCode,
    handleUpdateEmail, handleSaveNewBusLocation,
    openPermissionModal, openEditProfile,
    handleUploadProfileImage,
    handleCopyAllCodes, clearServiceArrears,
    clearTermArrears,
    isSuperAdmin, hasManageUsersAccess,
    handlePromoteRepeat,
    openPromoteRepeat: (target: User | null = null) => setAssignmentModal({ type: "promote_repeat", target }),
    runFinanceCleanup,
    runFinanceMigration,
    runAcademicCleanup,
    isFinanceCleaning,
    isAcademicCleaning
  };
}
