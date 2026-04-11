import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import React, { useState, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Keyboard,
} from "react-native";
import * as Animatable from "react-native-animatable";
import { getSchoolLogo } from "../../../constants/Logos";
import { SHADOWS, COLORS } from "../../../constants/theme";
import { auth, db } from "../../../firebaseConfig";
import { SCHOOL_CONFIG } from "../../../constants/Config";
import SVGIcon from "../../../components/SVGIcon";

interface ChildDetail {
  linkCode: string;
  name: string | null;
  className: string | null;
  isVerifying: boolean;
  isValid: boolean;
  error?: string;
}

export default function ParentSignup() {
  const router = useRouter();
  const schoolId = SCHOOL_CONFIG.schoolId;
  const schoolLogo = getSchoolLogo(schoolId);
  const schoolName = SCHOOL_CONFIG.name;
  const primary = SCHOOL_CONFIG.primaryColor;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [children, setChildren] = useState<ChildDetail[]>([
    { linkCode: "", name: null, className: null, isVerifying: false, isValid: false },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const firstInputRef = useRef<TextInput>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
        firstInputRef.current?.focus();
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const verifyChildCode = async (code: string, index: number) => {
    if (code.length < 6) return;
    Keyboard.dismiss();

    const newChildren = [...children];
    newChildren[index].isVerifying = true;
    newChildren[index].error = undefined;
    setChildren(newChildren);

    try {
      const q = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("parentLinkCode", "==", code),
        limit(1)
      );
      const snap = await getDocs(q);

      const updatedChildren = [...children];
      if (!snap.empty) {
        const data = snap.docs[0].data();
        
        // LIMIT CHECK: Only allow link if student has < 2 parents
        const existingParents = data.parentUids || [];
        if (existingParents.length >= 2) {
            updatedChildren[index].name = "Code Locked";
            updatedChildren[index].error = "Maximum (2) parents already linked.";
            updatedChildren[index].isValid = false;
        } else {
            updatedChildren[index].name = `${data.profile?.firstName} ${data.profile?.lastName}`;
            updatedChildren[index].isValid = true;
            updatedChildren[index].className = data.classId || "Assigned Class";
        }
      } else {
        updatedChildren[index].name = "Student not found";
        updatedChildren[index].isValid = false;
      }
      updatedChildren[index].isVerifying = false;
      setChildren(updatedChildren);
    } catch (err) {
      console.error("Verification error:", err);
      const updatedChildren = [...children];
      updatedChildren[index].isVerifying = false;
      updatedChildren[index].name = "Verification Failed";
      setChildren(updatedChildren);
    }
  };

  const handleAddChild = () => {
    setChildren([...children, { linkCode: "", name: null, className: null, isVerifying: false, isValid: false }]);
  };

  const handleChildLinkCodeChange = (text: string, index: number) => {
    const cleanText = text.trim().toUpperCase();
    const newChildren = [...children];
    newChildren[index].linkCode = cleanText;
    
    if (cleanText === "") {
        newChildren[index].name = null;
        newChildren[index].isValid = false;
        newChildren[index].error = undefined;
    }
    
    setChildren(newChildren);

    if (cleanText.length === 6) {
      verifyChildCode(cleanText, index);
    }
  };

  const handleSignup = async () => {
    Keyboard.dismiss();

    // Validation
    if (!firstName.trim() || !lastName.trim()) {
      return Alert.alert("Required", "Please enter your full name.");
    }
    if (phone.trim().length < 9) {
      return Alert.alert("Invalid Phone", "Please enter a valid phone number.");
    }
    if (!email.trim()) {
      return Alert.alert("Required", "Please enter an email address.");
    }
    if (password.length < 6) {
      return Alert.alert("Weak Password", "Password must be at least 6 characters.");
    }
    if (password !== confirmPassword) {
      return Alert.alert("Error", "Passwords do not match.");
    }

    const linkedChildren = children.filter(c => c.isValid);
    if (linkedChildren.length === 0) {
      return Alert.alert("Link Code Required", "Please enter at least one valid student link code. Contact the school if you don't have one.");
    }

    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      const parentId = userCredential.user.uid;

      // Ensure session is fresh for Firestore rules
      if (userCredential.user) {
        await userCredential.user.getIdToken(true);
      }

      const batch = writeBatch(db);

      const childrenUids: string[] = [];
      const childrenClassIds: string[] = [];
      
      for (const child of linkedChildren) {
          const studentQuery = query(
            collection(db, "users"), 
            where("role", "==", "student"), 
            where("parentLinkCode", "==", child.linkCode),
            limit(1)
          );
          const studentSnap = await getDocs(studentQuery);
          
          if (!studentSnap.empty) {
            const studentDoc = studentSnap.docs[0];
            const studentId = studentDoc.id;
            const studentData = studentDoc.data();
            
            childrenUids.push(studentId);
            if (studentData.classId) childrenClassIds.push(studentData.classId);
            
            batch.update(doc(db, "users", studentId), {
              parentUids: arrayUnion(parentId)
            });
          }
      }

      batch.set(doc(db, "users", parentId), {
        uid: parentId,
        role: "parent",
        profile: { 
          firstName: firstName.trim(), 
          lastName: lastName.trim(), 
          email: email.trim().toLowerCase(),
          phone: phone.trim()
        },
        childrenIds: childrenUids,
        childrenClassIds: childrenClassIds,
        status: "active",
        createdAt: serverTimestamp(),
      });

      await batch.commit();
      
      const successMsg = "Your parent account has been created! You can now log in to view your children's progress.";
      if (Platform.OS === 'web') {
        window.alert("Success 🎉\n" + successMsg);
        router.replace("/(auth)/login/parent");
      } else {
        Alert.alert("Success 🎉", successMsg);
        router.replace("/(auth)/login/parent");
      }
    } catch (err: any) {
      console.error("Signup error:", err);
      let msg = err.message;
      if (err.code === 'auth/email-already-in-use') msg = "This email is already registered.";

      if (Platform.OS === 'web') {
        window.alert("Signup Failed\n" + msg);
      } else {
        Alert.alert("Signup Failed", msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: SCHOOL_CONFIG.surfaceColor || "#F8FAFC" }]}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        style={styles.keyboardView}
      >
        <ScrollView 
            contentContainerStyle={styles.scrollContent} 
            keyboardShouldPersistTaps="handled"
        >
          <Animatable.View animation="fadeInDown" duration={800} style={styles.schoolHeader}>
            <Image source={schoolLogo} style={styles.schoolLogo} resizeMode="contain" />
            <View>
              <Text style={styles.schoolName}>{schoolName}</Text>
              <Text style={[styles.portalTag, { color: primary }]}>Parent Registration</Text>
            </View>
          </Animatable.View>

          <Animatable.View animation="fadeInUp" duration={800} style={styles.card}>
            <Text style={[styles.sectionTitle, { color: primary }]}>Profile Details</Text>
            <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                    <Text style={styles.label}>FIRST NAME</Text>
                    <TextInput 
                        ref={firstInputRef}
                        style={styles.inputField} 
                        value={firstName} 
                        onChangeText={setFirstName} 
                        placeholder="John" 
                    />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>LAST NAME</Text>
                    <TextInput 
                        style={styles.inputField} 
                        value={lastName} 
                        onChangeText={setLastName} 
                        placeholder="Doe" 
                    />
                </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>PHONE NUMBER</Text>
              <TextInput
                style={styles.inputField}
                value={phone}
                onChangeText={setPhone}
                placeholder="024 XXX XXXX"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>EMAIL ADDRESS</Text>
              <TextInput 
                style={styles.inputField} 
                value={email} 
                onChangeText={setEmail} 
                placeholder="parent@example.com" 
                keyboardType="email-address" 
                autoCapitalize="none" 
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>PASSWORD</Text>
              <View style={styles.passwordContainer}>
                <TextInput 
                  style={styles.passwordInput} 
                  value={password} 
                  onChangeText={setPassword} 
                  placeholder="••••••••" 
                  secureTextEntry={!showPassword} 
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                  <SVGIcon name={showPassword ? "eye-off" : "eye"} size={22} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>CONFIRM PASSWORD</Text>
              <View style={styles.passwordContainer}>
                <TextInput 
                  style={styles.passwordInput} 
                  value={confirmPassword} 
                  onChangeText={setConfirmPassword} 
                  placeholder="••••••••" 
                  secureTextEntry={!showConfirmPassword} 
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeIcon}>
                  <SVGIcon name={showConfirmPassword ? "eye-off" : "eye"} size={22} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.divider} />

            <Text style={[styles.sectionTitle, { color: primary, marginTop: 10 }]}>Student Linking</Text>
            <Text style={styles.infoText}>Link up to 2 parents per student.</Text>
            
            {children.map((child, index) => (
              <View key={index} style={styles.childEntry}>
                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>LINK CODE {index + 1}</Text>
                    {child.isVerifying && <ActivityIndicator size="small" color={primary} />}
                  </View>
                  <TextInput
                    style={[styles.inputField, child.isValid && styles.validInput, child.error && styles.errorInput]}
                    value={child.linkCode}
                    onChangeText={(text) => handleChildLinkCodeChange(text, index)}
                    placeholder="6-CHARACTER CODE"
                    maxLength={6}
                    autoCapitalize="characters"
                  />
                </View>

                {child.name && (
                  <View style={[styles.childFoundBox, !child.isValid && styles.childErrorBox]}>
                    <SVGIcon 
                        name={child.isValid ? "checkmark-circle" : "alert-circle"} 
                        size={18} 
                        color={child.isValid ? "#10B981" : "#EF4444"} 
                    />
                    <View style={styles.childFoundText}>
                        <Text style={[styles.studentName, !child.isValid && { color: '#EF4444' }]}>
                            {child.name}
                        </Text>
                        {child.isValid ? (
                            <Text style={styles.studentClass}>Found in {child.className}</Text>
                        ) : (
                            <Text style={styles.errorText}>{child.error || "Invalid code"}</Text>
                        )}
                    </View>
                  </View>
                )}
              </View>
            ))}

            <TouchableOpacity style={styles.addChildButton} onPress={handleAddChild}>
              <SVGIcon name="add-circle" size={20} color={primary} />
              <Text style={[styles.addChildButtonText, { color: primary }]}>Connect Another Child</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.submitButton, { backgroundColor: primary }, isLoading && { opacity: 0.7 }]} 
              onPress={handleSignup} 
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.btnContent}>
                    <Text style={styles.submitButtonText}>Complete Registration</Text>
                    <SVGIcon name="arrow-forward" size={20} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
               <Text style={styles.backText}>Return to Portal Selection</Text>
            </TouchableOpacity>
          </Animatable.View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  keyboardView: { flex: 1 } as any,
  scrollContent: { padding: 20 },
  schoolHeader: { flexDirection: "row", alignItems: "center", marginBottom: 20, backgroundColor: "#fff", padding: 15, borderRadius: 20, ...SHADOWS.small },
  schoolLogo: { width: 44, height: 44, marginRight: 15 },
  schoolName: { fontSize: 18, fontWeight: "900", color: "#0F172A" },
  portalTag: { fontSize: 13, fontWeight: "800", textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { backgroundColor: "#fff", borderRadius: 30, padding: 24, ...SHADOWS.medium, borderWidth: 1, borderColor: '#F1F5F9' },
  sectionTitle: { fontSize: 16, fontWeight: "900", marginBottom: 20, textTransform: 'uppercase', letterSpacing: 1 },
  row: { flexDirection: 'row' },
  inputGroup: { marginBottom: 16 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { fontSize: 10, fontWeight: "800", color: "#64748B", letterSpacing: 1 },
  inputField: { backgroundColor: "#F8FAFC", borderRadius: 14, padding: 14, fontSize: 15, color: "#1E293B", borderWidth: 1, borderColor: '#E2E8F0' },
  validInput: { borderColor: '#10B981', backgroundColor: '#F0FDF4' },
  errorInput: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  passwordContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFC", borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  passwordInput: { flex: 1, padding: 14, fontSize: 15, color: "#1E293B" },
  eyeIcon: { paddingHorizontal: 14 },
  infoText: { fontSize: 13, color: "#94A3B8", marginBottom: 20, fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 20 },
  childEntry: { marginBottom: 20 },
  childFoundBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', padding: 15, borderRadius: 14, marginTop: -8, borderWidth: 1, borderColor: '#DCFCE7' },
  childErrorBox: { backgroundColor: '#FEF2F2', borderColor: '#FEE2E2' },
  childFoundText: { marginLeft: 10, flex: 1 },
  studentName: { fontSize: 15, fontWeight: '800', color: '#065F46' },
  studentClass: { fontSize: 11, color: '#059669', fontWeight: '700', textTransform: 'uppercase' },
  errorText: { fontSize: 11, color: '#B91C1C', fontWeight: '700' },
  addChildButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: '#E2E8F0', marginBottom: 25 },
  addChildButtonText: { fontWeight: '800', marginLeft: 10, fontSize: 14 },
  submitButton: { padding: 20, borderRadius: 20, ...SHADOWS.medium, marginTop: 10 },
  btnContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  submitButtonText: { color: "#fff", fontSize: 18, fontWeight: "900" },
  backBtn: { marginTop: 25, alignItems: 'center' },
  backText: { color: "#94A3B8", fontSize: 14, fontWeight: '700' }
});
