import { useState, useEffect, useCallback } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import * as ImagePicker from "expo-image-picker";
import { doc, updateDoc, query, collection, where, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Platform, Alert, BackHandler } from "react-native";
import { auth, db, storage } from "../../firebaseConfig";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { CurriculumType } from "../../constants/Curriculum";
import { getTeacherClasses, sortClasses } from "../../lib/classHelpers";

export const useTeacherProfile = () => {
  const router = useRouter();
  const { focus } = useLocalSearchParams();
  const { appUser } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [classNames, setClassNames] = useState<string[]>([]);
  const [mainClassName, setMainClassName] = useState<string>("");

  // Modals visibility
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [personalModalVisible, setPersonalModalVisible] = useState(false);
  const [workModalVisible, setWorkModalVisible] = useState(false);
  const [profModalVisible, setProfModalVisible] = useState(false);
  const [pwModalVisible, setPwModalVisible] = useState(false);

  // Edit Name state
  const [firstName, setFirstName] = useState(appUser?.profile?.firstName || "");
  const [lastName, setLastName] = useState(appUser?.profile?.lastName || "");

  // Personal Info state
  const [phone, setPhone] = useState(appUser?.profile?.phone || "");
  const [gender, setGender] = useState(appUser?.profile?.gender || "");
  const [dob, setDob] = useState<Date>(appUser?.profile?.dob ? new Date(appUser.profile.dob) : new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Work Assignments state
  const [selectedClasses, setSelectedClasses] = useState<string[]>(getTeacherClasses(appUser));
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(appUser?.subjects || []);
  const [curriculum, setCurriculum] = useState<CurriculumType>((appUser?.curriculum as CurriculumType) || "GES");
  const [allClasses, setAllClasses] = useState<{ id: string; name: string }[]>([]);
  const [customSubject, setCustomSubject] = useState("");
  const [isOtherSelected, setIsOtherSelected] = useState(false);

  // Professional Profile state
  const [bio, setBio] = useState(appUser?.profile?.bio || "");
  const [experience, setExperience] = useState(appUser?.profile?.experience || "");
  const [education, setEducation] = useState(appUser?.profile?.education || "");

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwUpdating, setPwUpdating] = useState(false);

  const handleBack = useCallback(() => {
    if (nameModalVisible) {
      setNameModalVisible(false);
      return true;
    }
    if (personalModalVisible) {
      setPersonalModalVisible(false);
      return true;
    }
    if (profModalVisible) {
      setProfModalVisible(false);
      return true;
    }
    if (pwModalVisible) {
      setPwModalVisible(false);
      return true;
    }
    if (workModalVisible) {
      setWorkModalVisible(false);
      return true;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/teacher-dashboard");
    }
    return true;
  }, [nameModalVisible, personalModalVisible, profModalVisible, pwModalVisible, workModalVisible, router]);

  useEffect(() => {
    if (appUser) {
      if (appUser.profile) {
        setFirstName(appUser.profile.firstName || "");
        setLastName(appUser.profile.lastName || "");
        setBio(appUser.profile.bio || "");
        setExperience(appUser.profile.experience || "");
        setEducation(appUser.profile.education || "");
        setPhone(appUser.profile.phone || "");
        setGender(appUser.profile.gender || "");
        setDob(appUser.profile.dob ? new Date(appUser.profile.dob) : new Date());
      }
      setSelectedClasses(getTeacherClasses(appUser));
      const subjects = appUser.subjects || [];
      const curr = (appUser.curriculum as CurriculumType) || "GES";
      setCurriculum(curr);
      setSelectedSubjects(subjects);
    }
  }, [appUser]);

  useEffect(() => {
    if (focus === "work") {
      setWorkModalVisible(true);
    }
  }, [focus]);

  useEffect(() => {
    const fetchAllClasses = async () => {
      try {
        const snap = await getDocs(collection(db, "classes"));
        const list = snap.docs.map((d) => ({ id: d.id, name: d.data().name || d.id }));
        setAllClasses(sortClasses(list));
      } catch (err) {
        console.error("Error fetching all classes:", err);
      }
    };
    fetchAllClasses();
  }, []);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", handleBack);
    return () => backHandler.remove();
  }, [handleBack]);

  useEffect(() => {
    const fetchClassNames = async () => {
      const classIds = getTeacherClasses(appUser);
      if (classIds.length === 0) {
        setClassNames([]);
        setMainClassName("");
        return;
      }
      try {
        const q = query(collection(db, "classes"), where("__name__", "in", classIds));
        const snap = await getDocs(q);
        const namesMap: Record<string, string> = {};
        snap.docs.forEach((doc) => {
          namesMap[doc.id] = doc.data().name;
        });
        const assignedClasses = selectedClasses
          .map((id) => ({ id, name: namesMap[id] }))
          .filter((c): c is { id: string; name: string } => !!c.name);
        const sorted = sortClasses(assignedClasses);
        setClassNames(sorted.map((c) => c.name));
        if (appUser?.classTeacherOf) {
          setMainClassName(namesMap[appUser.classTeacherOf] || "Unknown");
        }
      } catch (err) {
        console.error("Error fetching class names:", err);
      }
    };
    fetchClassNames();
  }, [selectedClasses, appUser?.classTeacherOf]);

  const handleLogout = () => {
    const performLogout = async () => {
      try {
        setLoading(true);
        await signOut(auth);
        if (Platform.OS === "web") {
          window.location.href = "/";
        } else {
          router.replace("/");
        }
      } catch (err) {
        showToast({ message: "Logout failed. Please try again.", type: "error" });
      } finally {
        setLoading(false);
      }
    };
    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to sign out?")) {
        performLogout();
      }
    } else {
      Alert.alert("Logout", "Are you sure you want to sign out?", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign Out", style: "destructive", onPress: performLogout },
      ]);
    }
  };

  const handleUpdateName = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      showToast({ message: "First name and surname are required.", type: "error" });
      return;
    }
    if (!appUser) return;
    setUpdating(true);
    try {
      await updateDoc(doc(db, "users", appUser.uid), {
        "profile.firstName": firstName.trim(),
        "profile.lastName": lastName.trim(),
      });
      showToast({ message: "Profile name updated!", type: "success" });
      setNameModalVisible(false);
    } catch (err) {
      console.error(err);
      showToast({ message: "Failed to update name.", type: "error" });
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdatePersonal = async () => {
    if (!appUser) return;
    setUpdating(true);
    try {
      await updateDoc(doc(db, "users", appUser.uid), {
        "profile.phone": phone.trim(),
        "profile.gender": gender,
        "profile.dob": dob.toISOString(),
      });
      showToast({ message: "Personal details updated!", type: "success" });
      setPersonalModalVisible(false);
    } catch (err) {
      console.error(err);
      showToast({ message: "Failed to update personal details.", type: "error" });
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateWork = async () => {
    if (!appUser) return;
    if (selectedClasses.length === 0) {
      showToast({ message: "Please select at least one class.", type: "error" });
      return;
    }
    let finalSubjects = [...selectedSubjects];
    if (isOtherSelected && customSubject.trim()) {
      if (!finalSubjects.includes(customSubject.trim())) {
        finalSubjects.push(customSubject.trim());
      }
    }
    if (finalSubjects.length === 0) {
      showToast({ message: "Please select at least one subject.", type: "error" });
      return;
    }
    setUpdating(true);
    try {
      await updateDoc(doc(db, "users", appUser.uid), {
        classes: selectedClasses,
        subjects: finalSubjects,
        curriculum: curriculum,
      });
      showToast({ message: "Work assignments updated!", type: "success" });
      setWorkModalVisible(false);
      setCustomSubject("");
      setIsOtherSelected(false);
    } catch (err) {
      console.error(err);
      showToast({ message: "Failed to update work assignments.", type: "error" });
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateProfessional = async () => {
    if (!appUser) return;
    setUpdating(true);
    try {
      await updateDoc(doc(db, "users", appUser.uid), {
        "profile.bio": bio.trim(),
        "profile.experience": experience.trim(),
        "profile.education": education.trim(),
      });
      showToast({ message: "Professional profile updated!", type: "success" });
      setProfModalVisible(false);
    } catch (err) {
      console.error(err);
      showToast({ message: "Failed to update professional profile.", type: "error" });
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast({ message: "Please fill in all password fields.", type: "error" });
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast({ message: "New passwords do not match.", type: "error" });
      return;
    }
    if (newPassword.length < 6) {
      showToast({ message: "New password must be at least 6 characters.", type: "error" });
      return;
    }
    setPwUpdating(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error("No user session found.");
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      showToast({ message: "Password updated successfully!", type: "success" });
      setPwModalVisible(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error(error);
      let msg = "Failed to update password.";
      if (error.code === "auth/wrong-password") msg = "The current password you entered is incorrect.";
      showToast({ message: msg, type: "error" });
    } finally {
      setPwUpdating(false);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });
      if (!result.canceled) {
        uploadProfileImage(result.assets[0].uri);
      }
    } catch (e) {
      showToast({ message: "Failed to open library.", type: "error" });
    }
  };

  const uploadProfileImage = async (uri: string) => {
    if (!appUser) return;
    setUpdating(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const storageRef = ref(storage, `profiles/${appUser.uid}.jpg`);
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      await updateDoc(doc(db, "users", appUser.uid), {
        "profile.profileImage": downloadURL,
      });
      showToast({ message: "Profile picture updated!", type: "success" });
    } catch (err) {
      console.error(err);
      showToast({ message: "Could not save image.", type: "error" });
    } finally {
      setUpdating(false);
    }
  };

  return {
    appUser,
    loading,
    updating,
    classNames,
    mainClassName,
    nameModalVisible,
    setNameModalVisible,
    personalModalVisible,
    setPersonalModalVisible,
    workModalVisible,
    setWorkModalVisible,
    profModalVisible,
    setProfModalVisible,
    pwModalVisible,
    setPwModalVisible,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    phone,
    setPhone,
    gender,
    setGender,
    dob,
    setDob,
    showDatePicker,
    setShowDatePicker,
    selectedClasses,
    setSelectedClasses,
    selectedSubjects,
    setSelectedSubjects,
    curriculum,
    setCurriculum,
    allClasses,
    customSubject,
    setCustomSubject,
    isOtherSelected,
    setIsOtherSelected,
    bio,
    setBio,
    experience,
    setExperience,
    education,
    setEducation,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    pwUpdating,
    handleBack,
    handleLogout,
    handleUpdateName,
    handleUpdatePersonal,
    handleUpdateWork,
    handleUpdateProfessional,
    handleUpdatePassword,
    pickImage,
  };
};
