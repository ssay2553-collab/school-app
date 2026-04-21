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
  SafeAreaView
} from "react-native";
import * as Animatable from "react-native-animatable";
import { SHADOWS, COLORS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { db } from "../../firebaseConfig";
import { LinearGradient } from "expo-linear-gradient";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";

export default function ParentProfileEditScreen() {
  const router = useRouter();
  const { appUser } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
  });

  const primary = SCHOOL_CONFIG.primaryColor || COLORS.primary;

  useEffect(() => {
    if (!appUser) return;

    const fetchParent = async () => {
      try {
        const userRef = doc(db, "users", appUser.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const userData = snap.data() as any;
          const p = userData.profile || {};
          setForm({
            firstName: p.firstName || "",
            lastName: p.lastName || "",
            email: p.email || (appUser.profile as any)?.email || "",
            phone: p.phone || "",
          });
        }
      } catch (err) {
        console.error("Fetch parent failed:", err);
        showToast({ message: "Failed to load profile data.", type: "error" });
      } finally {
        setLoading(false);
      }
    };

    fetchParent();
  }, [appUser]);

  const handleSave = async () => {
    if (!appUser) return;

    if (!form.firstName.trim() || !form.lastName.trim()) {
      return showToast({ message: "Name cannot be empty.", type: "error" });
    }

    setSaving(true);
    try {
      const userRef = doc(db, "users", appUser.uid);
      await updateDoc(userRef, {
        "profile.firstName": form.firstName,
        "profile.lastName": form.lastName,
        "profile.phone": form.phone,
      });

      showToast({ message: "Profile updated successfully!", type: "success" });
      router.back();
    } catch (err) {
      console.error("Update profile failed:", err);
      showToast({ message: "Failed to update profile.", type: "error" });
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
          <View style={{ width: 24 }} />
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animatable.View animation="fadeInUp" duration={600} style={styles.card}>
          <View style={styles.cardHeader}>
             <View style={[styles.iconBox, { backgroundColor: primary + '15' }]}>
                <SVGIcon name="create" size={20} color={primary} />
             </View>
             <Text style={styles.cardTitle}>Personal Details</Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>FIRST NAME</Text>
            <TextInput
              value={form.firstName}
              onChangeText={(t) => setForm({ ...form, firstName: t })}
              style={styles.input}
              placeholder="Enter first name"
              placeholderTextColor="#94A3B8"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>LAST NAME</Text>
            <TextInput
              value={form.lastName}
              onChangeText={(t) => setForm({ ...form, lastName: t })}
              style={styles.input}
              placeholder="Enter last name"
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
              Email cannot be changed.
            </Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>PHONE NUMBER</Text>
            <TextInput
              value={form.phone}
              onChangeText={(t) => setForm({ ...form, phone: t })}
              keyboardType="phone-pad"
              style={styles.input}
              placeholder="e.g. 024XXXXXXX"
              placeholderTextColor="#94A3B8"
            />
          </View>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            disabled={saving}
          >
            <LinearGradient colors={[primary, '#4F46E5']} style={styles.btnGradient}>
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.saveText}>Save Changes</Text>
                  <SVGIcon name="checkmark-circle" size={18} color="#fff" style={{ marginLeft: 8 }} />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
          >
            <Text style={styles.cancelText}>Discard</Text>
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
