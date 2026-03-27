import { useRouter } from "expo-router";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StatusBar,
  SafeAreaView,
  Image
} from "react-native";
import * as Animatable from "react-native-animatable";
import * as ImagePicker from "expo-image-picker";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebaseConfig";
import { LinearGradient } from "expo-linear-gradient";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";

const storage = getStorage();

export default function ProfileEditScreen() {
  const router = useRouter();
  const { appUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    profileImage: "",
  });

  const primary = SCHOOL_CONFIG.primaryColor;
  const secondary = SCHOOL_CONFIG.secondaryColor;

  useEffect(() => {
    if (!appUser) return;

    const fetchTeacher = async () => {
      try {
        const ref = doc(db, "users", appUser.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data().profile;
          setForm({
            firstName: data.firstName || "",
            lastName: data.lastName || "",
            email: data.email || appUser.profile?.email || "",
            phone: data.phone || "",
            profileImage: data.profileImage || "",
          });
        }
      } catch (err) {
        console.error("Fetch teacher failed:", err);
        Alert.alert("Error", "Failed to load profile data.");
      } finally {
        setLoading(false);
      }
    };

    fetchTeacher();
  }, [appUser]);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0].uri) {
        handleImageUpload(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert("Error", "Could not access photo library.");
    }
  };

  const handleImageUpload = async (uri: string) => {
    if (!appUser) return;
    setUploading(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const storageRef = ref(storage, `profiles/${appUser.uid}`);
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      
      setForm(prev => ({ ...prev, profileImage: downloadURL }));
      const userRef = doc(db, "users", appUser.uid);
      await updateDoc(userRef, { "profile.profileImage": downloadURL });
      
      Alert.alert("Success", "Profile image updated!");
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to upload image.");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!appUser) return;

    if (!form.firstName.trim() || !form.lastName.trim()) {
      return Alert.alert("Validation", "Name cannot be empty.");
    }

    setSaving(true);
    try {
      const ref = doc(db, "users", appUser.uid);
      await updateDoc(ref, {
        "profile.firstName": form.firstName,
        "profile.lastName": form.lastName,
        "profile.phone": form.phone,
      });

      Alert.alert("Success", "Profile updated successfully!");
      router.back();
    } catch (err) {
      console.error("Update profile failed:", err);
      Alert.alert("Error", "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={primary} />
        <Text style={{ color: "#64748B", marginTop: 8 }}>
          Loading profile...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.mainContainer}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[primary, "#1E293B"]} style={styles.headerGradient}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <SVGIcon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <SVGIcon name="person" size={24} color={secondary} />
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animatable.View animation="fadeInUp" duration={600} style={styles.card}>
          <View style={styles.profileImageSection}>
            <TouchableOpacity style={styles.imageContainer} onPress={pickImage} disabled={uploading}>
               {form.profileImage ? (
                 <Image source={{ uri: form.profileImage }} style={styles.profileImg} />
               ) : (
                 <View style={styles.placeholderImg}>
                   <SVGIcon name="person" size={40} color="#94A3B8" />
                 </View>
               )}
               {uploading && (
                 <View style={styles.uploadingOverlay}>
                    <ActivityIndicator color="#fff" />
                 </View>
               )}
               <View style={[styles.cameraIcon, { backgroundColor: primary }]}>
                 <SVGIcon name="camera" size={16} color="#fff" />
               </View>
            </TouchableOpacity>
            <Text style={styles.imageHint}>Tap to change profile picture</Text>
          </View>

          <View style={styles.cardHeader}>
             <View style={[styles.iconBox, { backgroundColor: primary + '15' }]}>
                <SVGIcon name="create" size={20} color={primary} />
             </View>
             <Text style={styles.cardTitle}>Personal Information</Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>FIRST NAME</Text>
            <TextInput
              value={form.firstName}
              onChangeText={(t) => setForm({ ...form, firstName: t })}
              style={styles.input}
              placeholder="e.g. Samuel"
              placeholderTextColor="#94A3B8"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>LAST NAME</Text>
            <TextInput
              value={form.lastName}
              onChangeText={(t) => setForm({ ...form, lastName: t })}
              style={styles.input}
              placeholder="e.g. Mensah"
              placeholderTextColor="#94A3B8"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>EMAIL ADDRESS</Text>
            <View style={[styles.input, styles.disabledInput]}>
               <Text style={styles.disabledText}>{form.email}</Text>
               <SVGIcon name="lock-closed" size={14} color="#94A3B8" />
            </View>
            <Text style={styles.hint}>
              System credentials cannot be modified.
            </Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>PHONE NUMBER</Text>
            <TextInput
              value={form.phone}
              onChangeText={(t) => setForm({ ...form, phone: t })}
              keyboardType="phone-pad"
              style={styles.input}
              placeholder="024 XXX XXXX"
              placeholderTextColor="#94A3B8"
            />
          </View>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            disabled={saving || uploading}
          >
            <LinearGradient colors={[primary, '#4F46E5']} style={styles.btnGradient}>
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.saveText}>Update Profile</Text>
                  <SVGIcon name="checkmark-circle" size={18} color="#fff" style={{ marginLeft: 8 }} />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
          >
            <Text style={styles.cancelText}>Discard Changes</Text>
          </TouchableOpacity>
        </Animatable.View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: "#F8FAFC" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerGradient: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 25,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    ...SHADOWS.medium,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#fff' },
  scrollContent: { padding: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 24,
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  profileImageSection: { alignItems: 'center', marginBottom: 30 },
  imageContainer: { width: 100, height: 100, borderRadius: 35, position: 'relative', ...SHADOWS.medium },
  profileImg: { width: '100%', height: '100%', borderRadius: 35 },
  placeholderImg: { width: '100%', height: '100%', borderRadius: 35, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  uploadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 35, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  cameraIcon: { position: 'absolute', bottom: -5, right: -5, width: 32, height: 32, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#fff', zIndex: 2 },
  imageHint: { fontSize: 11, color: '#94A3B8', marginTop: 12, fontWeight: '600' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 25, gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
  fieldGroup: { marginBottom: 20 },
  label: { fontSize: 10, fontWeight: "900", color: "#94A3B8", marginBottom: 8, letterSpacing: 1 },
  input: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    fontWeight: '600',
    color: "#1E293B",
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  disabledInput: { backgroundColor: '#F1F5F9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  disabledText: { color: '#64748B', fontSize: 15 },
  hint: { fontSize: 11, color: '#94A3B8', marginTop: 6, fontStyle: 'italic' },
  saveButton: { marginTop: 15, borderRadius: 16, overflow: 'hidden', ...SHADOWS.medium },
  btnGradient: { padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  saveText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  cancelButton: { marginTop: 15, padding: 15, alignItems: "center" },
  cancelText: { fontWeight: "700", fontSize: 14, color: "#94A3B8" },
});
