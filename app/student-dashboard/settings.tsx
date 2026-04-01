import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import * as ImagePicker from "expo-image-picker";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import React, { useState } from "react";
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
} from "react-native";
import * as Animatable from "react-native-animatable";
import DateTimePicker from "@react-native-community/datetimepicker";
import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { auth, db, storage } from "../../firebaseConfig";

export default function StudentSettings() {
  const router = useRouter();
  const { appUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  
  const [dob, setDob] = useState<Date | null>(
    appUser?.dateOfBirth ? appUser.dateOfBirth.toDate() : null
  );
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Password change state
  const [pwModalVisible, setPwModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwUpdating, setPwUpdating] = useState(false);

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
        Alert.alert("Error", "Logout failed. Please try again.");
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

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      return Alert.alert("Required", "Please fill in all password fields.");
    }
    if (newPassword !== confirmPassword) {
      return Alert.alert("Mismatch", "New passwords do not match.");
    }
    if (newPassword.length < 6) {
      return Alert.alert("Short Password", "New password must be at least 6 characters.");
    }

    setPwUpdating(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error("No user session found.");

      // Re-authenticate first (Firebase security requirement for sensitive operations)
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Now update the password
      await updatePassword(user, newPassword);
      
      Alert.alert("Success", "Password updated successfully!");
      setPwModalVisible(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error(error);
      let msg = "Failed to update password.";
      if (error.code === 'auth/wrong-password') msg = "The current password you entered is incorrect.";
      Alert.alert("Error", msg);
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
      Alert.alert("Error", "Failed to open library.");
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
      
      Alert.alert("Success", "Profile picture updated!");
    } catch (err) {
      console.error(err);
      Alert.alert("Upload Failed", "Could not save image.");
    } finally {
      setUpdating(false);
    }
  };

  const saveDOB = async (selectedDate: Date) => {
    if (!appUser) return;
    setDob(selectedDate);
    setUpdating(true);
    try {
      await updateDoc(doc(db, "users", appUser.uid), {
        dateOfBirth: Timestamp.fromDate(selectedDate)
      });
      Alert.alert("Success", "Date of Birth updated!");
    } catch (e) {
      Alert.alert("Error", "Failed to update DOB.");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FDFDFD" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <SVGIcon name="arrow-back" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account & Profile</Text>
        {updating && <ActivityIndicator size="small" color={COLORS.primary} style={{marginLeft: 'auto'}} />}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animatable.View animation="fadeInUp" duration={800} style={styles.profileSection}>
          <TouchableOpacity onPress={pickImage} style={styles.avatarContainer}>
            {appUser?.profile?.profileImage ? (
              <Image source={{ uri: appUser.profile.profileImage }} style={styles.avatarImg} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: COLORS.primary }]}>
                <Text style={styles.avatarText}>{appUser?.profile?.firstName?.charAt(0) || "S"}</Text>
              </View>
            )}
            <View style={styles.editBadge}>
               <Ionicons name="camera" size={14} color="#FFF" />
            </View>
          </TouchableOpacity>
          
          <Text style={styles.userName}>{appUser?.profile?.firstName} {appUser?.profile?.lastName}</Text>
          <Text style={styles.userEmail}>{appUser?.profile?.email}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>STUDENT PORTAL ACTIVE</Text>
          </View>
        </Animatable.View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PERSONAL DETAILS</Text>
          <View style={styles.settingsCard}>
             <TouchableOpacity style={styles.settingItem} onPress={() => setShowDatePicker(true)}>
                <View style={styles.settingIconBox}>
                  <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
                </View>
                <View style={styles.settingTextContent}>
                  <Text style={styles.settingLabel}>Date of Birth</Text>
                  <Text style={[styles.settingValue, !dob && { color: '#94A3B8' }]}>
                    {dob ? dob.toLocaleDateString() : "Click to set birth date"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
             </TouchableOpacity>

             {showDatePicker && (
                <DateTimePicker
                  value={dob || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  maximumDate={new Date()}
                  onChange={(event, date) => {
                    setShowDatePicker(false);
                    if (date) saveDOB(date);
                  }}
                />
             )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SECURITY & ACCESS</Text>
          <View style={styles.settingsCard}>
             <TouchableOpacity style={styles.settingItem} onPress={() => setPwModalVisible(true)}>
                <View style={[styles.settingIconBox, { backgroundColor: '#EEF2FF' }]}>
                  <Ionicons name="lock-closed-outline" size={20} color="#4F46E5" />
                </View>
                <View style={styles.settingTextContent}>
                  <Text style={styles.settingLabel}>Security</Text>
                  <Text style={[styles.settingValue, { color: '#4F46E5' }]}>Change Login Password</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
             </TouchableOpacity>
             <View style={styles.divider} />
             <View style={styles.settingItem}>
                <View style={styles.settingIconBox}>
                  <Ionicons name="key-outline" size={20} color={COLORS.primary} />
                </View>
                <View style={styles.settingTextContent}>
                  <Text style={styles.settingLabel}>Family Link Code</Text>
                  <Text style={[styles.settingValue, { letterSpacing: 2, color: COLORS.secondary }]}>{appUser?.parentLinkCode || "------"}</Text>
                </View>
                <TouchableOpacity onPress={() => Alert.alert("Parent Link", "Provide this code to your parents so they can link their account to your profile.")}>
                    <Ionicons name="information-circle-outline" size={20} color="#94A3B8" />
                </TouchableOpacity>
             </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MY INFO</Text>
          <View style={styles.settingsCard}>
             <SettingItem 
                icon="person-outline" 
                title="Full Name" 
                value={`${appUser?.profile?.firstName} ${appUser?.profile?.lastName}`} 
             />
             <View style={styles.divider} />
             <SettingItem 
                icon="mail-outline" 
                title="Email Address" 
                value={appUser?.profile?.email || "Not set"} 
             />
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
                <Ionicons name="power-outline" size={20} color="#EF4444" />
              </View>
              <Text style={styles.logoutText}>Sign Out of My Account</Text>
              {loading ? <ActivityIndicator color="#EF4444" /> : <Ionicons name="chevron-forward" size={18} color="#94A3B8" />}
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
           <Text style={styles.footerText}>EduEaz App v1.2.0</Text>
           <Text style={styles.footerSubText}>Secure Student Portal Node</Text>
        </View>
      </ScrollView>

      {/* PASSWORD CHANGE MODAL */}
      <Modal visible={pwModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setPwModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
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
      <Ionicons name={icon} size={20} color={COLORS.primary} />
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
  modalBtn: { height: 55, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  modalBtnText: { color: '#fff', fontSize: 15, fontWeight: '900' }
});
