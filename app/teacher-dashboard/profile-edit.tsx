import { useRouter, useLocalSearchParams } from "expo-router";
import { signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import * as ImagePicker from "expo-image-picker";
import { doc, updateDoc, query, collection, where, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  Modal,
  TextInput,
  BackHandler,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { auth, db, storage } from "../../firebaseConfig";
import { useToast } from "../../contexts/ToastContext";
import { GES_SUBJECTS, CAMBRIDGE_SUBJECTS, CurriculumType } from "../../constants/Curriculum";

export default function TeacherProfileEdit() {
  const router = useRouter();
  const { focus } = useLocalSearchParams();
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [classNames, setClassNames] = useState<string[]>([]);
  const [mainClassName, setMainClassName] = useState<string>("");

  // Edit Name state
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [firstName, setFirstName] = useState(appUser?.profile?.firstName || "");
  const [lastName, setLastName] = useState(appUser?.profile?.lastName || "");

  // Personal Info state
  const [personalModalVisible, setPersonalModalVisible] = useState(false);
  const [phone, setPhone] = useState(appUser?.profile?.phone || "");
  const [gender, setGender] = useState(appUser?.profile?.gender || "");
  const [dob, setDob] = useState<Date>(appUser?.profile?.dob ? new Date(appUser.profile.dob) : new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Work Assignments state
  const [workModalVisible, setWorkModalVisible] = useState(false);
  const [selectedClasses, setSelectedClasses] = useState<string[]>(appUser?.classes || []);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(appUser?.subjects || []);
  const [curriculum, setCurriculum] = useState<CurriculumType>((appUser?.curriculum as CurriculumType) || "GES");
  const [allClasses, setAllClasses] = useState<{ id: string; name: string }[]>([]);

  // Professional Profile state
  const [profModalVisible, setProfModalVisible] = useState(false);
  const [bio, setBio] = useState(appUser?.profile?.bio || "");
  const [experience, setExperience] = useState(appUser?.profile?.experience || "");
  const [education, setEducation] = useState(appUser?.profile?.education || "");

  // Password change state
  const [pwModalVisible, setPwModalVisible] = useState(false);
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
      setSelectedClasses(appUser.classes || []);
      setSelectedSubjects(appUser.subjects || []);
      setCurriculum((appUser.curriculum as CurriculumType) || "GES");
    }
  }, [appUser]);

  useEffect(() => {
    if (focus === 'work') {
      setWorkModalVisible(true);
    }
  }, [focus]);

  useEffect(() => {
    const fetchAllClasses = async () => {
      try {
        const snap = await getDocs(collection(db, "classes"));
        const list = snap.docs.map((d) => ({ id: d.id, name: d.data().name || d.id }));
        setAllClasses(list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })));
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
    if (appUser?.profile) {
      setFirstName(appUser.profile.firstName || "");
      setLastName(appUser.profile.lastName || "");
      setBio(appUser.profile.bio || "");
      setExperience(appUser.profile.experience || "");
      setEducation(appUser.profile.education || "");
      setPhone(appUser.profile.phone || "");
      setGender(appUser.profile.gender || "");
    }
  }, [appUser]);

  useEffect(() => {
    const fetchClassNames = async () => {
      const classIds = [...(appUser?.classes || [])];
      if (appUser?.classTeacherOf && !classIds.includes(appUser.classTeacherOf)) {
        classIds.push(appUser.classTeacherOf);
      }

      if (classIds.length === 0) return;

      try {
        const q = query(
          collection(db, "classes"),
          where("__name__", "in", classIds)
        );
        const snap = await getDocs(q);
        const namesMap: Record<string, string> = {};
        snap.docs.forEach(doc => {
          namesMap[doc.id] = doc.data().name;
        });

        // Update states
        const assignedNames = (appUser?.classes || []).map(id => namesMap[id]).filter(Boolean);
        setClassNames(assignedNames);

        if (appUser?.classTeacherOf) {
          setMainClassName(namesMap[appUser.classTeacherOf] || "Unknown");
        }
      } catch (err) {
        console.error("Error fetching class names:", err);
      }
    };
    fetchClassNames();
  }, [appUser?.classes, appUser?.classTeacherOf]);

  const handleLogout = () => {
    const performLogout = async () => {
      try {
        setLoading(true);
        await signOut(auth);
        if (Platform.OS === 'web') {
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

    if (Platform.OS === 'web') {
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
        "profile.lastName": lastName.trim()
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
        "profile.dob": dob.toISOString()
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
    if (selectedSubjects.length === 0) {
      showToast({ message: "Please select at least one subject.", type: "error" });
      return;
    }

    setUpdating(true);
    try {
      await updateDoc(doc(db, "users", appUser.uid), {
        classes: selectedClasses,
        subjects: selectedSubjects,
        curriculum: curriculum
      });
      showToast({ message: "Work assignments updated!", type: "success" });
      setWorkModalVisible(false);
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
        "profile.education": education.trim()
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
      if (error.code === 'auth/wrong-password') msg = "The current password you entered is incorrect.";
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
        "profile.profileImage": downloadURL
      });

      showToast({ message: "Profile picture updated!", type: "success" });
    } catch (err) {
      console.error(err);
      showToast({ message: "Could not save image.", type: "error" });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FDFDFD" />

      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <SVGIcon name="arrow-back" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Teacher Profile</Text>
        {updating && <ActivityIndicator size="small" color={COLORS.primary} style={{marginLeft: 'auto'}} />}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animatable.View animation="fadeInUp" duration={800} style={styles.profileSection}>
          <TouchableOpacity onPress={pickImage} style={styles.avatarContainer}>
            {appUser?.profile?.profileImage ? (
              <Image source={{ uri: appUser.profile.profileImage }} style={styles.avatarImg} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: COLORS.primary }]}>
                <Text style={styles.avatarText}>{appUser?.profile?.firstName?.charAt(0) || "T"}</Text>
              </View>
            )}
            <View style={styles.editBadge}>
               <SVGIcon name="camera" size={14} color="#FFF" />
            </View>
          </TouchableOpacity>

          <Text style={styles.userName}>{appUser?.profile?.firstName} {appUser?.profile?.lastName}</Text>
          <Text style={styles.userEmail}>{appUser?.profile?.email}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>FACULTY MEMBER</Text>
          </View>
        </Animatable.View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PERSONAL DETAILS</Text>
          <View style={styles.settingsCard}>
             <TouchableOpacity style={styles.settingItem} onPress={() => setNameModalVisible(true)}>
                <View style={styles.settingIconBox}>
                  <SVGIcon name="person" size={20} color={COLORS.primary} />
                </View>
                <View style={styles.settingTextContent}>
                  <Text style={styles.settingLabel}>Full Name</Text>
                  <Text style={styles.settingValue}>{appUser?.profile?.firstName} {appUser?.profile?.lastName}</Text>
                </View>
                <SVGIcon name="create-outline" size={16} color={COLORS.primary} />
             </TouchableOpacity>
             <View style={styles.divider} />
             <TouchableOpacity style={styles.settingItem} onPress={() => setPersonalModalVisible(true)}>
                <View style={styles.settingIconBox}>
                  <SVGIcon name="call" size={20} color={COLORS.primary} />
                </View>
                <View style={styles.settingTextContent}>
                  <Text style={styles.settingLabel}>Contact & Identity</Text>
                  <Text style={styles.settingValue}>
                    {appUser?.profile?.phone || "No Phone"} • {appUser?.profile?.gender || "Not specified"} • {appUser?.profile?.dob ? new Date(appUser.profile.dob).toLocaleDateString() : "No DOB"}
                  </Text>
                </View>
                <SVGIcon name="create-outline" size={16} color={COLORS.primary} />
             </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SECURITY & ACCESS</Text>
          <View style={styles.settingsCard}>
             <TouchableOpacity style={styles.settingItem} onPress={() => setPwModalVisible(true)}>
                <View style={[styles.settingIconBox, { backgroundColor: '#EEF2FF' }]}>
                  <SVGIcon name="lock-closed" size={20} color="#4F46E5" />
                </View>
                <View style={styles.settingTextContent}>
                  <Text style={styles.settingLabel}>Security</Text>
                  <Text style={[styles.settingValue, { color: '#4F46E5' }]}>Change Login Password</Text>
                </View>
                <SVGIcon name="chevron-forward" size={16} color="#CBD5E1" />
             </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PROFESSIONAL INFO</Text>
          <View style={styles.settingsCard}>
             <TouchableOpacity style={styles.settingItem} onPress={() => setProfModalVisible(true)}>
                <View style={[styles.settingIconBox, {backgroundColor: COLORS.primary + '10'}]}>
                  <SVGIcon name="briefcase" size={20} color={COLORS.primary} />
                </View>
                <View style={styles.settingTextContent}>
                  <Text style={styles.settingLabel}>Professional Profile</Text>
                  <Text style={styles.settingValue} numberOfLines={1}>
                    {appUser?.profile?.education || "Add bio, experience & education"}
                  </Text>
                </View>
                <SVGIcon name="create-outline" size={16} color={COLORS.primary} />
             </TouchableOpacity>
             <View style={styles.divider} />
             <SettingItem
                icon="mail"
                title="Work Email"
                value={appUser?.profile?.email || "Not set"}
             />
             <View style={styles.divider} />
             <SettingItem
                icon="school"
                title="School ID"
                value={appUser?.schoolId?.toUpperCase() || "N/A"}
             />
             <View style={styles.divider} />
             <TouchableOpacity style={styles.settingItem} onPress={() => setWorkModalVisible(true)}>
                <View style={styles.settingIconBox}>
                  <SVGIcon name="book" size={20} color={COLORS.primary} />
                </View>
                <View style={styles.settingTextContent}>
                  <Text style={styles.settingLabel}>Assigned Classes & Subjects</Text>
                  <Text style={styles.settingValue} numberOfLines={1}>
                    {classNames.length > 0 ? classNames.join(", ") : "None assigned"}
                  </Text>
                </View>
                <SVGIcon name="create-outline" size={16} color={COLORS.primary} />
             </TouchableOpacity>
             {appUser?.classTeacherOf && (
               <>
                 <View style={styles.divider} />
                 <View style={styles.settingItem}>
                    <View style={[styles.settingIconBox, {backgroundColor: '#FFFBEB'}]}>
                      <SVGIcon name="ribbon" size={20} color="#D97706" />
                    </View>
                    <View style={styles.settingTextContent}>
                      <Text style={[styles.settingLabel, {color: '#D97706'}]}>Class Teacher Of</Text>
                      <Text style={styles.settingValue}>
                        {mainClassName || "Loading..."}
                      </Text>
                    </View>
                 </View>
               </>
             )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SYSTEM</Text>
          <TouchableOpacity
            style={[styles.settingsCard, styles.logoutBtn]}
            onPress={handleLogout}
            disabled={loading}
          >
            <View style={styles.logoutContent}>
              <View style={styles.logoutIconBox}>
                <SVGIcon name="power" size={20} color="#EF4444" />
              </View>
              <Text style={styles.logoutText}>Sign Out of My Account</Text>
              {loading ? <ActivityIndicator color="#EF4444" /> : <SVGIcon name="chevron-forward" size={18} color="#94A3B8" />}
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
           <Text style={styles.footerText}>EduEaz App v1.2.0</Text>
           <Text style={styles.footerSubText}>Secure Teacher Portal Node</Text>
        </View>
      </ScrollView>

      {/* NAME CHANGE MODAL */}
      <Modal visible={nameModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Profile Name</Text>
              <TouchableOpacity onPress={() => setNameModalVisible(false)}>
                <SVGIcon name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>FIRST NAME</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter first name"
                value={firstName}
                onChangeText={setFirstName}
              />

              <Text style={styles.modalLabel}>SURNAME (LAST NAME)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter surname"
                value={lastName}
                onChangeText={setLastName}
              />

              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: COLORS.primary }]}
                onPress={handleUpdateName}
                disabled={updating}
              >
                {updating ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnText}>Save Changes</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* PERSONAL INFO MODAL */}
      <Modal visible={personalModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Contact & Identity</Text>
              <TouchableOpacity onPress={() => setPersonalModalVisible(false)}>
                <SVGIcon name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>PHONE NUMBER</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter phone number"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />

              <Text style={styles.modalLabel}>GENDER</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={gender}
                  onValueChange={(itemValue) => setGender(itemValue)}
                  style={styles.picker}
                >
                  <Picker.Item label="Select Gender" value="" />
                  <Picker.Item label="Male" value="Male" />
                  <Picker.Item label="Female" value="Female" />
                  <Picker.Item label="Other" value="Other" />
                </Picker>
              </View>

              <Text style={styles.modalLabel}>DATE OF BIRTH</Text>
              <TouchableOpacity
                style={styles.modalInput}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={{ marginTop: 15, fontSize: 16, fontWeight: '600' }}>
                  {dob.toLocaleDateString()}
                </Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={dob}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(Platform.OS === 'ios');
                    if (selectedDate) setDob(selectedDate);
                  }}
                  maximumDate={new Date()}
                />
              )}

              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: COLORS.primary }]}
                onPress={handleUpdatePersonal}
                disabled={updating}
              >
                {updating ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnText}>Save Changes</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* WORK ASSIGNMENTS MODAL */}
      <Modal visible={workModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Classes & Subjects</Text>
              <TouchableOpacity onPress={() => setWorkModalVisible(false)}>
                <SVGIcon name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalLabel}>ASSIGNED CLASSES</Text>
              <View style={styles.chipGrid}>
                {allClasses.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => setSelectedClasses(prev => prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id])}
                    style={[styles.chip, selectedClasses.includes(c.id) && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
                  >
                    <Text style={[styles.chipText, selectedClasses.includes(c.id) && { color: '#fff' }]}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>CURRICULUM</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={curriculum}
                  onValueChange={(v) => { setCurriculum(v as CurriculumType); setSelectedSubjects([]); }}
                  style={styles.picker}
                >
                  <Picker.Item label="GES (National)" value="GES" />
                  <Picker.Item label="Cambridge (IGCSE)" value="Cambridge" />
                </Picker>
              </View>

              <Text style={styles.modalLabel}>{curriculum} SUBJECTS</Text>
              <View style={styles.chipGrid}>
                {(curriculum === "GES" ? GES_SUBJECTS : CAMBRIDGE_SUBJECTS).map(s => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setSelectedSubjects(prev => prev.includes(s) ? prev.filter(item => item !== s) : [...prev, s])}
                    style={[styles.chip, selectedSubjects.includes(s) && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
                  >
                    <Text style={[styles.chipText, selectedSubjects.includes(s) && { color: '#fff' }]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: COLORS.primary, marginBottom: 20 }]}
                onPress={handleUpdateWork}
                disabled={updating}
              >
                {updating ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnText}>Update Assignments</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* PROFESSIONAL INFO MODAL */}
      <Modal visible={profModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Professional Profile</Text>
              <TouchableOpacity onPress={() => setProfModalVisible(false)}>
                <SVGIcon name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalLabel}>BIO / ABOUT ME</Text>
              <TextInput
                style={[styles.modalInput, { height: 80, paddingTop: 12 }]}
                placeholder="Tell parents and students about yourself..."
                value={bio}
                onChangeText={setBio}
                multiline
              />

              <Text style={styles.modalLabel}>YEARS OF EXPERIENCE</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. 5"
                value={experience}
                onChangeText={setExperience}
                keyboardType="numeric"
              />

              <Text style={styles.modalLabel}>HIGHEST QUALIFICATION (EDUCATION)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. B.Ed in Mathematics"
                value={education}
                onChangeText={setEducation}
              />

              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: COLORS.primary }]}
                onPress={handleUpdateProfessional}
                disabled={updating}
              >
                {updating ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnText}>Save Profile</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* PASSWORD CHANGE MODAL */}
      <Modal visible={pwModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setPwModalVisible(false)}>
                <SVGIcon name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>CURRENT PASSWORD</Text>
              <TextInput
                style={styles.modalInput}
                secureTextEntry
                placeholder="Required for security"
                value={currentPassword}
                onChangeText={setCurrentPassword}
              />

              <Text style={styles.modalLabel}>NEW PASSWORD</Text>
              <TextInput
                style={styles.modalInput}
                secureTextEntry
                placeholder="At least 6 characters"
                value={newPassword}
                onChangeText={setNewPassword}
              />

              <Text style={styles.modalLabel}>CONFIRM NEW PASSWORD</Text>
              <TextInput
                style={styles.modalInput}
                secureTextEntry
                placeholder="Repeat new password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />

              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: COLORS.primary }]}
                onPress={handleUpdatePassword}
                disabled={pwUpdating}
              >
                {pwUpdating ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnText}>Update My Password</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const SettingItem = ({ icon, title, value }: any) => (
  <View style={styles.settingItem}>
    <View style={styles.settingIconBox}>
      <SVGIcon name={icon} size={20} color={COLORS.primary} />
    </View>
    <View style={styles.settingTextContent}>
      <Text style={styles.settingLabel}>{title}</Text>
      <Text style={styles.settingValue}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FDFDFD" },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFF',
    ...SHADOWS.small,
    zIndex: 10
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15
  },
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#0F172A" },
  scrollContent: { padding: 20 },
  profileSection: {
    alignItems: 'center',
    marginBottom: 30,
    backgroundColor: '#FFF',
    padding: 25,
    borderRadius: 30,
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  avatarContainer: { position: 'relative' },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    ...SHADOWS.small
  },
  avatarImg: {
    width: 100,
    height: 100,
    borderRadius: 35,
    marginBottom: 15,
  },
  avatarText: { color: '#FFF', fontSize: 40, fontWeight: 'bold' },
  editBadge: {
    position: 'absolute',
    bottom: 15,
    right: -5,
    backgroundColor: COLORS.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center'
  },
  userName: { fontSize: 22, fontWeight: '900', color: '#0F172A' },
  userEmail: { fontSize: 14, color: '#64748B', marginTop: 4, fontWeight: '600' },
  badge: {
    marginTop: 15,
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderRadius: 100
  },
  badgeText: { color: COLORS.primary, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  section: { marginBottom: 25 },
  sectionTitle: { fontSize: 11, fontWeight: '900', color: '#94A3B8', marginLeft: 10, marginBottom: 10, letterSpacing: 1 },
  settingsCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 10,
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  settingItem: { flexDirection: 'row', alignItems: 'center', padding: 15 },
  settingIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15
  },
  settingTextContent: { flex: 1 },
  settingLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '800', textTransform: 'uppercase' },
  settingValue: { fontSize: 15, color: '#1E293B', fontWeight: '700', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 15 },
  logoutBtn: { marginTop: 5, padding: 5 },
  logoutContent: { flexDirection: 'row', alignItems: 'center', padding: 15 },
  logoutIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15
  },
  logoutText: { flex: 1, fontSize: 15, fontWeight: '800', color: '#1E293B' },
  footer: { alignItems: 'center', marginTop: 20, marginBottom: 40 },
  footerText: { fontSize: 12, fontWeight: '800', color: '#CBD5E1' },
  footerSubText: { fontSize: 10, fontWeight: '700', color: '#E2E8F0', marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#1E293B' },
  modalBody: { gap: 15 },
  modalLabel: { fontSize: 10, fontWeight: '900', color: '#94A3B8', letterSpacing: 1 },
  modalInput: { backgroundColor: '#F1F5F9', height: 55, borderRadius: 15, paddingHorizontal: 15, fontSize: 16, fontWeight: '600' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 5, marginBottom: 15 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  chipText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  pickerWrapper: {
    backgroundColor: '#F1F5F9',
    borderRadius: 15,
    height: 55,
    justifyContent: 'center',
    overflow: 'hidden'
  },
  picker: {
    width: '100%',
    height: 55,
  },
  modalBtn: { height: 55, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  modalBtnText: { color: '#fff', fontSize: 15, fontWeight: '900' }
});
