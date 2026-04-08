import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import {
    collection,
    doc,
    getDocs,
    query,
    serverTimestamp,
    where,
    writeBatch,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    SafeAreaView,
    StatusBar,
} from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../../components/SVGIcon";
import { SHADOWS, COLORS as THEME_COLORS } from "../../../constants/theme";
import { auth, db } from "../../../firebaseConfig";
import { SCHOOL_CONFIG } from "../../../constants/Config";
import { Ionicons } from "@expo/vector-icons";
import { GES_SUBJECTS, CAMBRIDGE_SUBJECTS, CurriculumType } from "../../../constants/Curriculum";

const COLORS = { ...THEME_COLORS, gold: "#FFD700", orange: "#FFA500" };

export default function TeacherSignupScreen() {
  const router = useRouter();
  const primary = SCHOOL_CONFIG.primaryColor;
  const schoolId = SCHOOL_CONFIG.schoolId;
  const surface = SCHOOL_CONFIG.surfaceColor;
  
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ surname: "", firstName: "", phone: "", email: "", password: "", confirmPassword: "", signupCode: "" });
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [curriculum, setCurriculum] = useState<CurriculumType>("GES");
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [otherSubjects, setOtherSubjects] = useState<string[]>([]);
  const [showOtherModal, setShowOtherModal] = useState(false);
  const [newOtherSubject, setNewOtherSubject] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const snap = await getDocs(collection(db, "classes"));
        const list = snap.docs.map((d) => ({ id: d.id, name: d.data().name || d.id }));
        setClasses(list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })));
      } catch (err) { console.error(err); }
    };
    fetchClasses();
  }, []);

  const validateStep = () => {
    if (step === 1) {
      if (!form.firstName.trim() || !form.surname.trim()) {
        Alert.alert("Required", "Please enter your full name.");
        return false;
      }
      const emailRegex = /\S+@\S+\.\S+/;
      if (!emailRegex.test(form.email)) {
        Alert.alert("Invalid Email", "Please enter a valid email address.");
        return false;
      }
      if (form.phone.length < 10) {
        Alert.alert("Invalid Phone", "Please enter a valid phone number.");
        return false;
      }
      if (form.password.length < 6) {
        Alert.alert("Weak Password", "Password must be at least 6 characters.");
        return false;
      }
      if (form.password !== form.confirmPassword) {
        Alert.alert("Mismatch", "Passwords do not match.");
        return false;
      }
    } else if (step === 2) {
      if (selectedClasses.length === 0) {
        Alert.alert("Required", "Please select at least one class you teach.");
        return false;
      }
      if (selectedSubjects.length === 0 && otherSubjects.length === 0) {
        Alert.alert("Required", "Please select or add at least one subject.");
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      setStep(s => s + 1);
    }
  };

  const handleSignup = async () => {
    if (!form.signupCode.trim()) return Alert.alert("Error", "Signup code required.");
    setLoading(true);
    try {
      const cleanCode = form.signupCode.trim().toUpperCase();
      const q = query(collection(db, "signupCodes"), where("code", "==", cleanCode));
      const snap = await getDocs(q);

      if (snap.empty) {
        setLoading(false);
        return Alert.alert("Invalid Code", "This signup code is not valid. Please check with your admin.");
      }

      const codeDoc = snap.docs[0];
      const codeData = codeDoc.data();

      if (codeData.used) {
        setLoading(false);
        return Alert.alert("Used Code", "This code has already been used by another teacher.");
      }

      if (codeData.intendedForRole !== "teacher") {
        setLoading(false);
        return Alert.alert("Wrong Code", "This code is not meant for a teacher account.");
      }

      const cleanEmail = form.email.trim().toLowerCase();
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, form.password);
      
      // Ensure session is fresh for Firestore rules
      await cred.user.getIdToken(true);

      const batch = writeBatch(db);
      batch.set(doc(db, "users", cred.user.uid), {
        uid: cred.user.uid,
        role: "teacher",
        schoolId: schoolId,
        secretCode: cleanCode,
        status: "active",
        classes: selectedClasses,
        subjects: [...selectedSubjects, ...otherSubjects],
        curriculum: curriculum,
        profile: {
          firstName: form.firstName.trim(),
          lastName: form.surname.trim(),
          email: cleanEmail,
          phone: form.phone.trim()
        },
        createdAt: serverTimestamp(),
      });

      batch.update(doc(db, "signupCodes", codeDoc.id), { used: true, usedBy: cred.user.uid });
      await batch.commit();
      
      Alert.alert("Success 🎉", "Account created successfully! You can now log in.");
      setTimeout(() => {
        router.replace("/(auth)/login/teacher");
      }, 1000);
    } catch (err: any) {
      console.error("Teacher signup error:", err);
      let msg = err.message;
      if (err.code === 'auth/email-already-in-use') msg = "This email is already registered.";
      Alert.alert("Signup Failed", msg);
    } finally { setLoading(false); }
  };

  const addOtherSubject = () => {
    if (!newOtherSubject.trim()) return;
    setOtherSubjects(prev => [...prev, newOtherSubject.trim()]);
    setNewOtherSubject("");
    setShowOtherModal(false);
  };

  const renderStepIndicator = () => (
    <View style={styles.indicatorContainer}>
      {[1, 2, 3].map((s) => (
        <View key={s} style={styles.stepWrapper}>
          <View style={[styles.stepCircle, step >= s && { backgroundColor: primary }]}>
            {step > s ? <Ionicons name="checkmark" size={16} color="#fff" /> : <Text style={[styles.stepNumber, step >= s && { color: "#fff" }]}>{s}</Text>}
          </View>
          {s < 3 && <View style={[styles.stepLine, step > s && { backgroundColor: primary }]} />}
        </View>
      ))}
    </View>
  );

  const subjectList = curriculum === "GES" ? GES_SUBJECTS : CAMBRIDGE_SUBJECTS;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: surface }]}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Animatable.View animation="fadeInDown" style={styles.header}>
            <Text style={styles.title}>Teacher Registry</Text>
            <Text style={styles.subtitle}>Step {step} of 3</Text>
            {renderStepIndicator()}
          </Animatable.View>

          {step === 1 && (
            <Animatable.View animation="fadeInRight" style={styles.stepContainer}>
              <View style={styles.card}>
                <InputField label="FIRST NAME" placeholder="e.g. Ama" value={form.firstName} onChangeText={(v: string) => setForm({ ...form, firstName: v })} />
                <InputField label="SURNAME" placeholder="e.g. Boateng" value={form.surname} onChangeText={(v: string) => setForm({ ...form, surname: v })} />
                <InputField label="EMAIL" placeholder="teacher@school.com" value={form.email} onChangeText={(v: string) => setForm({ ...form, email: v })} autoCapitalize="none" keyboardType="email-address" />
                <InputField label="PHONE" placeholder="024 XXX XXXX" value={form.phone} onChangeText={(v: string) => setForm({ ...form, phone: v })} keyboardType="phone-pad" />
                <InputField label="PASSWORD" placeholder="••••••••" value={form.password} onChangeText={(v: string) => setForm({ ...form, password: v })} secureTextEntry={!showPassword} isPassword onTogglePassword={() => setShowPassword(!showPassword)} showPassword={showPassword} />
                <InputField label="CONFIRM PASSWORD" placeholder="••••••••" value={form.confirmPassword} onChangeText={(v: string) => setForm({ ...form, confirmPassword: v })} secureTextEntry={!showPassword} />
              </View>
            </Animatable.View>
          )}

          {step === 2 && (
            <Animatable.View animation="fadeInRight" style={styles.stepContainer}>
               <Text style={styles.sectionTitle}>Assign Classes</Text>
               <View style={styles.chipGrid}>{classes.map(c => <Chip key={c.id} label={c.name} active={selectedClasses.includes(c.id)} onPress={() => setSelectedClasses(prev => prev.includes(c.id) ? prev.filter(i => i !== c.id) : [...prev, c.id])} activeColor={primary} />)}</View>
               
               <Text style={styles.sectionTitle}>Select Curriculum</Text>
               <View style={styles.curriculumRow}>
                  <TouchableOpacity onPress={() => { setCurriculum("GES"); setSelectedSubjects([]); }} style={[styles.curriculumBtn, curriculum === "GES" && { backgroundColor: primary, borderColor: primary }]}>
                    <Text style={[styles.curriculumText, curriculum === "GES" && { color: "#fff" }]}>GES (National)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setCurriculum("Cambridge"); setSelectedSubjects([]); }} style={[styles.curriculumBtn, curriculum === "Cambridge" && { backgroundColor: primary, borderColor: primary }]}>
                    <Text style={[styles.curriculumText, curriculum === "Cambridge" && { color: "#fff" }]}>Cambridge (IGCSE)</Text>
                  </TouchableOpacity>
               </View>

               <Text style={styles.sectionTitle}>{curriculum} Subjects</Text>
               <View style={styles.chipGrid}>
                 {subjectList.map(s => <Chip key={s} label={s} active={selectedSubjects.includes(s)} onPress={() => setSelectedSubjects(prev => prev.includes(s) ? prev.filter(i => i !== s) : [...prev, s])} activeColor={primary} />)}
                 {otherSubjects.map(s => <Chip key={s} label={s} active={true} onPress={() => setOtherSubjects(prev => prev.filter(i => i !== s))} activeColor={COLORS.secondary} />)}
                 <TouchableOpacity onPress={() => setShowOtherModal(true)} style={styles.addOtherChip}>
                    <Ionicons name="add-circle" size={18} color={primary} />
                    <Text style={[styles.chipText, { color: primary, marginLeft: 4 }]}>Other</Text>
                 </TouchableOpacity>
               </View>
            </Animatable.View>
          )}

          {step === 3 && (
            <Animatable.View animation="fadeInRight" style={styles.stepContainer}>
              <View style={styles.codeCard}>
                <Ionicons name="shield-checkmark" size={48} color={primary} />
                <Text style={styles.codeTitle}>Final Verification</Text>
                <Text style={styles.codeSubtitle}>Enter the secure signup code from your administrator.</Text>
                <TextInput style={styles.codeInput} placeholder="CODE" placeholderTextColor="#94A3B8" value={form.signupCode} onChangeText={(v) => setForm({ ...form, signupCode: v })} autoCapitalize="characters" />
              </View>
            </Animatable.View>
          )}

          <View style={styles.footer}>
            {step > 1 && (
              <TouchableOpacity onPress={() => setStep(s => s - 1)} style={styles.backBtn}>
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => { if(step < 3) handleNext(); else handleSignup(); }}
              style={[styles.nextBtn, { backgroundColor: primary, flex: step === 1 ? 1 : 2 }]}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.nextBtnText}>{step === 3 ? "Register Account" : "Continue"}</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showOtherModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Animatable.View animation="zoomIn" duration={300} style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Custom Subject</Text>
            <TextInput style={styles.modalInput} placeholder="Subject Name" value={newOtherSubject} onChangeText={setNewOtherSubject} autoFocus />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowOtherModal(false)} style={styles.modalCancel}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={addOtherSubject} style={[styles.modalAdd, { backgroundColor: primary }]}><Text style={styles.addText}>Add Subject</Text></TouchableOpacity>
            </View>
          </Animatable.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const InputField = ({ label, isPassword, onTogglePassword, showPassword, ...props }: any) => (
  <View style={styles.inputGroup}>
    <Text style={styles.inputLabel}>{label}</Text>
    <View style={styles.inputWrapper}>
      <TextInput style={styles.input} placeholderTextColor="#94A3B8" {...props} />
      {isPassword && <TouchableOpacity onPress={onTogglePassword} style={styles.eyeIcon}><Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="#94A3B8" /></TouchableOpacity>}
    </View>
  </View>
);

const Chip = ({ label, active, onPress, activeColor }: any) => (
  <TouchableOpacity onPress={onPress} style={[styles.chip, active && { backgroundColor: activeColor, borderColor: activeColor }]}>
    <Text style={[styles.chipText, active && { color: "#fff" }]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: { padding: 24, flexGrow: 1 },
  header: { marginBottom: 30, alignItems: "center" },
  title: { fontSize: 26, fontWeight: "800", color: "#0F172A" },
  subtitle: { fontSize: 14, color: "#64748B", marginTop: 4, fontWeight: "600" },
  indicatorContainer: { flexDirection: "row", marginTop: 20, alignItems: "center", justifyContent: 'center' },
  stepWrapper: { flexDirection: 'row', alignItems: 'center' },
  stepCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  stepNumber: { fontSize: 14, fontWeight: 'bold', color: '#64748B' },
  stepLine: { width: 40, height: 2, backgroundColor: '#E2E8F0', marginHorizontal: 8 },
  stepContainer: { flex: 1 },
  card: { backgroundColor: "#fff", borderRadius: 24, padding: 20, ...SHADOWS.medium },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 10, fontWeight: "900", color: "#64748B", marginBottom: 6, letterSpacing: 1 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: "#F1F5F9", borderRadius: 12, overflow: 'hidden' },
  input: { flex: 1, height: 50, paddingHorizontal: 15, fontSize: 14, color: "#1E293B" },
  eyeIcon: { paddingHorizontal: 12 },
  sectionTitle: { fontSize: 12, fontWeight: "900", color: "#94A3B8", marginBottom: 15, textTransform: "uppercase", letterSpacing: 1, marginTop: 10 },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
  chip: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0" },
  chipText: { fontSize: 13, fontWeight: "700", color: "#475569" },
  addOtherChip: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0", borderStyle: 'dashed', flexDirection: 'row', alignItems: 'center' },
  curriculumRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  curriculumBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', alignItems: 'center', backgroundColor: '#fff' },
  curriculumText: { fontSize: 13, fontWeight: '800', color: '#64748B' },
  codeCard: { backgroundColor: "#fff", borderRadius: 24, padding: 30, alignItems: "center", ...SHADOWS.medium },
  codeTitle: { fontSize: 20, fontWeight: "800", marginTop: 15, color: "#0F172A" },
  codeSubtitle: { textAlign: "center", color: "#64748B", marginTop: 8, marginBottom: 25 },
  codeInput: { width: '100%', height: 60, backgroundColor: "#F1F5F9", borderRadius: 16, textAlign: "center", fontSize: 24, fontWeight: "900", letterSpacing: 6 },
  footer: { flexDirection: "row", gap: 12, marginTop: 30 },
  backBtn: { flex: 1, height: 55, justifyContent: "center", alignItems: "center", borderRadius: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0" },
  backBtnText: { fontWeight: "700", color: "#64748B" },
  nextBtn: { height: 55, justifyContent: "center", alignItems: "center", borderRadius: 16, ...SHADOWS.medium },
  nextBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: '#fff', width: '100%', borderRadius: 24, padding: 24, ...SHADOWS.large },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 20 },
  modalInput: { backgroundColor: '#F1F5F9', height: 55, borderRadius: 12, paddingHorizontal: 15, fontSize: 16, color: '#1E293B', marginBottom: 20 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, height: 50, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: '#F1F5F9' },
  cancelText: { fontWeight: '700', color: '#64748B' },
  modalAdd: { flex: 2, height: 50, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  addText: { fontWeight: '800', color: '#fff' }
});
