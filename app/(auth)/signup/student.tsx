// /signup/student.tsx
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import {
    collection,
    doc,
    getDocs,
    getDocsFromServer,
    limit,
    query,
    serverTimestamp,
    Timestamp,
    where,
    writeBatch,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
    SafeAreaView,
    StatusBar,
    Dimensions,
    Image,
    Text,
} from "react-native";
import * as Animatable from "react-native-animatable";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import SVGIcon from "../../../components/SVGIcon";
import { SHADOWS, COLORS as THEME_COLORS } from "../../../constants/theme";
import { useToast } from "../../../contexts/ToastContext";
import { httpsCallable } from "firebase/functions";
import { auth, db, storage, functions } from "../../../firebaseConfig";
import { SCHOOL_CONFIG } from "../../../constants/Config";
import DateTimePicker from "@react-native-community/datetimepicker";

const { width } = Dimensions.get("window");

interface ClassItem {
  id: string;
  name: string;
}

// Simple session cache to save data for bulk registrations
let cachedClasses: ClassItem[] | null = null;

export default function StudentSignupScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const primary = SCHOOL_CONFIG.primaryColor;
  const secondary = SCHOOL_CONFIG.secondaryColor;

  const [step, setStep] = useState(1);
  const [classes, setClasses] = useState<ClassItem[]>(cachedClasses || []);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    gender: "",
    selectedClassId: "",
    signupCode: "",
    dateOfBirth: null as Date | null,
    profileImage: null as string | null,
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isCodeVerified, setIsCodeVerified] = useState(false);

  // Disable native driver for web/electron to avoid warnings
  const useNativeDriver = Platform.OS !== 'web';

  const verifyCode = async () => {
    if (!form.signupCode.trim()) {
      showToast({ message: "Please enter your signup code.", type: "error" });
      return;
    }
    setLoading(true);
    try {
      const cleanCode = form.signupCode.trim().toUpperCase();

      // 1. Check for a Pre-registered Profile (Bulk Import)
      const pendingQuery = query(
        collection(db, "users"),
        where("signupCode", "==", cleanCode),
        where("role", "==", "student"),
        where("status", "==", "pending_activation"),
        limit(1)
      );
      const pendingSnapshot = await getDocs(pendingQuery);
      const pendingDoc = pendingSnapshot.docs.find(d => d.data().status === "pending_activation");

      if (pendingDoc) {
        const data = pendingDoc.data();
        setForm(prev => ({
          ...prev,
          firstName: data.profile?.firstName || prev.firstName,
          lastName: data.profile?.lastName || prev.lastName,
          gender: data.profile?.gender || data.gender || "",
          selectedClassId: data.classId || prev.selectedClassId,
          dateOfBirth: data.dateOfBirth?.toDate ? data.dateOfBirth.toDate() : (data.dateOfBirth ? new Date(data.dateOfBirth) : null),
        }));
        showToast({ message: `Welcome ${data.profile?.firstName}! Profile found.`, type: "success" });
        setIsCodeVerified(true);
        setStep(2);
        return;
      }

      // 2. Check generic signupCodes
      const q = query(collection(db, "signupCodes"), where("code", "==", cleanCode), limit(1));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error("Invalid signup code. Please check with your teacher.");
      }

      const codeData = querySnapshot.docs[0].data();
      if (codeData.classId) {
        setForm(prev => ({ ...prev, selectedClassId: codeData.classId }));
      }

      showToast({ message: "Code verified! Please complete your account details.", type: "success" });
      setIsCodeVerified(true);
      setStep(2);
    } catch (err: any) {
      showToast({ message: err.message || "Verification failed.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchClasses = async () => {
      if (cachedClasses && cachedClasses.length > 0) return;
      try {
        // Fetch classes and use "safe filter" to include legacy docs or school-specific ones
        const q = query(collection(db, "classes"));
        const snap = await getDocsFromServer(q as any);
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) } as any))
          .map((d) => ({ id: d.id, name: d.name || d.id }));

        const sorted = list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        setClasses(sorted);
        cachedClasses = sorted;
      } catch (err) {
        console.error("Failed to fetch classes:", err);
      }
    };
    fetchClasses();
  }, []);

  const generateLinkCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission Denied", "We need access to your gallery to upload a profile picture.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1, // Full quality for the initial crop
      });

      if (!result.canceled) {
        // Resize to 300x300 - significantly reduces data regardless of quality setting
        const manipResult = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 300, height: 300 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );
        setForm({ ...form, profileImage: manipResult.uri });
      }
    } catch (e) {
      console.error("Image pick error:", e);
      Alert.alert("Error", "Failed to open image gallery.");
    }
  };

  const validateStep = () => {
    if (step === 1) {
      if (!form.signupCode.trim()) {
        showToast({ message: "Please enter your signup code.", type: "error" });
        return false;
      }
      if (!isCodeVerified) {
        verifyCode();
        return false;
      }
    } else if (step === 2) {
      if (!form.firstName.trim() || !form.lastName.trim()) {
        showToast({ message: "Please enter your full name.", type: "error" });
        return false;
      }
      if (!form.email.trim()) {
        showToast({ message: "Please enter an email address.", type: "error" });
        return false;
      }
      if (form.email.trim().includes(" ")) {
        showToast({ message: "Email or username cannot contain spaces.", type: "error" });
        return false;
      }
      if (form.password.length < 6) {
        showToast({ message: "Password must be at least 6 characters.", type: "error" });
        return false;
      }
      if (form.password !== form.confirmPassword) {
        showToast({ message: "Passwords do not match", type: "error" });
        return false;
      }
    } else if (step === 3) {
      if (!form.gender) {
        showToast({ message: "Please select your gender.", type: "error" });
        return false;
      }
      if (!form.selectedClassId) {
        showToast({ message: "Please select your class.", type: "error" });
        return false;
      }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep()) setStep(s => s + 1);
  };

  const prevStep = () => setStep(s => s - 1);

  // Robust way to get blob from local URI on Android
  const uriToBlob = (uri: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = function () {
        resolve(xhr.response);
      };
      xhr.onerror = function (e) {
        reject(new Error("Image upload failed at source. Please try another image."));
      };
      xhr.responseType = "blob";
      xhr.open("GET", uri, true);
      xhr.send(null);
    });
  };

  const handleSignup = async () => {
    if (!form.signupCode.trim()) {
      return showToast({ message: "Please enter your signup code.", type: "error" });
    }

    setLoading(true);

    try {
      const cleanCode = form.signupCode.trim().toUpperCase();

      // 1. Check for a Pre-registered Profile (Bulk Import)
      const pendingQuery = query(
        collection(db, "users"),
        where("signupCode", "==", cleanCode),
        where("role", "==", "student"),
        where("status", "==", "pending_activation"),
        limit(1)
      );
      const pendingSnapshot = await getDocs(pendingQuery);

      const pendingDoc = pendingSnapshot.docs.find(d => d.data().status === "pending_activation");

      let preRegisteredData: any = null;
      let pendingDocId: string | null = null;

      if (pendingDoc) {
        pendingDocId = pendingDoc.id;
        preRegisteredData = pendingDoc.data();
      }

      // 2. Validate Code (either from pending profile or standard signupCodes collection)
      let codeDocId: string | null = null;

      if (!preRegisteredData) {
        const q = query(collection(db, "signupCodes"), where("code", "==", cleanCode), limit(1));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          throw new Error("That signup code doesn't seem to fit. Check it again!");
        }

        const codeDoc = querySnapshot.docs[0];
        const codeData = codeDoc.data();

        if (codeData.expiresAt && Timestamp.now().toMillis() > codeData.expiresAt.toMillis()) {
          throw new Error("This code has expired. Ask your teacher for a new one!");
        }

        if (codeData.intendedForRole !== "student" || codeData.used || codeData.classId !== form.selectedClassId) {
          throw new Error("This code isn't for you or it's already been used! Check your class and code again.");
        }

        codeDocId = codeDoc.id;
      }

      // Auto-format "email" if they just entered a username
      // Remove all spaces and invalid characters for a safe email format
      let finalEmail = form.email.trim().toLowerCase().replace(/\s+/g, "");

      if (finalEmail && !finalEmail.includes("@")) {
        // Use a safe slug for the domain, defaulting to 'student'
        const domainSlug = (SCHOOL_CONFIG.schoolId || 'student')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, ''); // Ensure domain part is alphanumeric
        finalEmail = `${finalEmail}@${domainSlug}.edueaz.com`;
      }

      // Final validation check before calling Firebase
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(finalEmail)) {
        throw new Error("The email or username format is invalid. Please avoid special characters.");
      }

      console.log("[Signup] Attempting registration with email:", finalEmail);

      // Create Authentication Entry
      const cred = await createUserWithEmailAndPassword(auth, finalEmail, form.password);
      const userId = cred.user.uid;

      // Force token refresh to ensure custom claims or immediate visibility if needed
      await cred.user.getIdToken(true);

      // Safe Image Upload
      let profileImageUrl = null;
      if (form.profileImage) {
        try {
          const blob = await uriToBlob(form.profileImage);
          const storageRef = ref(storage, `profiles/${userId}.jpg`);
          await uploadBytes(storageRef, blob);
          profileImageUrl = await getDownloadURL(storageRef);
        } catch (imgErr) {
          console.error("Profile image upload failed:", imgErr);
        }
      }

      // Call the Cloud Function for pre-registered students to migrate data
      // New students write directly to Firestore to avoid Cloud Function overhead/CORS issues
      if (pendingDocId) {
        try {
          console.log("[Signup] Pre-registered student detected. Calling migration function...");
          const completeSignupFn = httpsCallable(functions, 'completeStudentSignup');
          await completeSignupFn({
            form: {
              ...form,
              email: finalEmail,
              dateOfBirth: form.dateOfBirth?.toISOString()
            },
            pendingDocId,
            codeDocId,
            profileImageUrl,
            cleanCode,
          });
        } catch (fnErr: any) {
          console.warn("[Signup] Cloud Function failed, falling back to client-side write for profile claiming:", fnErr);
          await performClientSideSignup(userId, finalEmail, profileImageUrl, cleanCode, pendingDocId, codeDocId, preRegisteredData);
        }
      } else {
        console.log("[Signup] New student detected. Performing direct Firestore registration...");
        await performClientSideSignup(userId, finalEmail, profileImageUrl, cleanCode, null, codeDocId, null);
      }

      showToast({ message: "Account created successfully! Welcome to your school portal.", type: "success" });
      router.replace("/(auth)/login/student");
    } catch (err: any) {
      console.error("Signup error details:", err);
      let msg = err.message;
      if (err.code === 'auth/email-already-in-use') msg = "This email or username is already taken.";
      showToast({ message: msg || "An unexpected error occurred.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const performClientSideSignup = async (
    userId: string,
    finalEmail: string,
    profileImageUrl: string | null,
    cleanCode: string,
    pendingDocId: string | null,
    codeDocId: string | null,
    preRegisteredData: any | null
  ) => {
    const batch = writeBatch(db);
    const userRef = doc(db, "users", userId);

    const userData = {
      uid: userId,
      email: finalEmail,
      role: "student",
      status: "active",
      classId: preRegisteredData?.classId || form.selectedClassId,
      profile: {
        firstName: form.firstName || preRegisteredData?.profile?.firstName,
        lastName: form.lastName || preRegisteredData?.profile?.lastName,
        fullName: `${form.firstName || preRegisteredData?.profile?.firstName} ${form.lastName || preRegisteredData?.profile?.lastName}`,
        gender: form.gender || preRegisteredData?.profile?.gender || "",
        profileImage: profileImageUrl || preRegisteredData?.profile?.profileImage || null,
        dateOfBirth: form.dateOfBirth ? Timestamp.fromDate(form.dateOfBirth) : (preRegisteredData?.dateOfBirth || null),
      },
      signupCode: cleanCode,
      parentLinkCode: preRegisteredData?.parentLinkCode || generateLinkCode(),
      parentUids: preRegisteredData?.parentUids || [],
      walletBalance: preRegisteredData?.walletBalance || 0,
      createdAt: preRegisteredData?.createdAt || serverTimestamp(),
      claimedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Always create/update the document at the Auth UID to ensure system helpers work
    batch.set(userRef, userData);

    if (pendingDocId) {
      // Mark the pre-registered profile as claimed
      batch.update(doc(db, "users", pendingDocId), {
        status: 'claimed',
        claimedBy: userId,
        claimedAt: serverTimestamp()
      });
    }

    // Mark code as used if it was a generic one
    if (codeDocId) {
      batch.update(doc(db, "signupCodes", codeDocId), {
        used: true,
        usedBy: userId,
        usedAt: serverTimestamp()
      });
    }

    await batch.commit();

    if (pendingDocId) {
      console.warn("[Signup] Migration of historical records might be incomplete if Cloud Function failed.");
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.indicatorContainer}>
      {[1, 2, 3].map((s) => (
        <View style={styles.stepWrapper} key={s}>
          <View style={[styles.stepCircle, step >= s && { backgroundColor: '#fff' }]}>
            {step > s ? (
              <SVGIcon name="checkmark" size={16} color={primary} />
            ) : (
              <Text style={[styles.stepNumber, step >= s && { color: primary }]}>{s}</Text>
            )}
          </View>
          {s < 3 && <View style={[styles.stepLine, step > s && { backgroundColor: '#fff' }]} />}
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: primary }}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          
          <Animatable.View animation="fadeInDown" useNativeDriver={useNativeDriver} style={styles.header}>
            <View style={styles.iconCircle}>
              <SVGIcon name="school" size={40} color={primary} />
            </View>
            <Text style={[styles.themedDefault, styles.title]}>Student Registry</Text>
            <Text style={[styles.themedDefault, styles.subtitle]}>Step {step} of 3</Text>
            {renderStepIndicator()}
          </Animatable.View>

          {step === 1 && (
            <Animatable.View animation="fadeInRight" useNativeDriver={useNativeDriver} style={styles.stepContainer}>
              <View style={styles.codeCard}>
                <View style={[styles.iconBadge, { backgroundColor: primary + '15' }]}>
                  <SVGIcon name="key" size={32} color={primary} />
                </View>
                <Text style={[styles.themedDefault, styles.codeTitle]}>Magic Signup Code</Text>
                <Text style={[styles.themedDefault, styles.codeSubtitle]}>Enter the secret code from your teacher to join your class.</Text>

                <TextInput
                  style={styles.codeInput}
                  placeholder="ENTER CODE"
                  placeholderTextColor="#94A3B8"
                  value={form.signupCode}
                  onChangeText={(v) => {
                    setForm({ ...form, signupCode: v });
                    setIsCodeVerified(false);
                  }}
                  autoCapitalize="characters"
                />

                <TouchableOpacity
                  onPress={verifyCode}
                  activeOpacity={0.8}
                  style={[styles.joinBtn, { backgroundColor: primary }]}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <View style={styles.joinBtnContent}>
                      <Text style={[styles.themedDefault, styles.joinBtnText]}>Verify Code</Text>
                      <View style={styles.joinBtnIcon}>
                        <SVGIcon name="shield-checkmark" size={18} color={primary} />
                      </View>
                    </View>
                  )}
                </TouchableOpacity>

                <Text style={[styles.themedDefault, styles.secureText]}>
                   <SVGIcon name="lock-closed" size={12} color="#94A3B8" /> Secure 256-bit Registry
                </Text>
              </View>
            </Animatable.View>
          )}

          {step === 2 && (
            <Animatable.View animation="fadeInRight" useNativeDriver={useNativeDriver} style={styles.stepContainer}>
              <View style={styles.card}>
                <Text style={[styles.themedDefault, styles.cardHeader]}>Account Details</Text>
                
                <View style={styles.avatarPickerContainer}>
                   <TouchableOpacity onPress={pickImage} style={styles.avatarBtn} disabled={loading}>
                      {form.profileImage ? (
                        <Image source={{ uri: form.profileImage }} style={styles.avatarImg} />
                      ) : (
                        <Image source={require("../../../assets/default-avatar.png")} style={styles.avatarImg} />
                      )}
                      <View style={styles.cameraOverlay}>
                        <SVGIcon name="camera" size={20} color="#fff" />
                      </View>
                   </TouchableOpacity>
                   {form.profileImage && (
                     <TouchableOpacity onPress={() => setForm({...form, profileImage: null})} style={styles.removeAvatar}>
                        <SVGIcon name="close-circle" size={20} color={THEME_COLORS.danger} />
                     </TouchableOpacity>
                   )}
                </View>

                <InputField label="FIRST NAME" placeholder="Your first name" value={form.firstName} onChangeText={(v: string) => setForm({ ...form, firstName: v })} />
                <InputField label="LAST NAME" placeholder="Your last name" value={form.lastName} onChangeText={(v: string) => setForm({ ...form, lastName: v })} />
                <InputField label="EMAIL OR USERNAME" placeholder="e.g. kojo123" value={form.email} onChangeText={(v: string) => setForm({ ...form, email: v })} autoCapitalize="none" keyboardType="email-address" />
                <InputField 
                  label="PASSWORD" 
                  placeholder="••••••••" 
                  value={form.password} 
                  onChangeText={(v: string) => setForm({ ...form, password: v })} 
                  secureTextEntry={!showPassword} 
                  isPassword 
                  onTogglePassword={() => setShowPassword(!showPassword)}
                  showPassword={showPassword}
                />
                <InputField label="CONFIRM PASSWORD" placeholder="••••••••" value={form.confirmPassword} onChangeText={(v: string) => setForm({ ...form, confirmPassword: v })} secureTextEntry={!showPassword} />
              </View>
            </Animatable.View>
          )}

          {step === 3 && (
            <Animatable.View animation="fadeInRight" useNativeDriver={useNativeDriver} style={styles.stepContainer}>
               <View style={styles.card}>
                 <Text style={[styles.themedDefault, styles.cardHeader]}>Student Profile</Text>
                 
                 <View style={styles.inputGroup}>
                   <Text style={[styles.themedDefault, styles.inputLabel]}>GENDER</Text>
                   <View style={styles.pickerWrapper}>
                     <Picker
                       selectedValue={form.gender}
                       onValueChange={(v) => setForm({ ...form, gender: v })}
                       style={styles.picker}
                       enabled={!loading}
                     >
                       <Picker.Item label="Select Gender" value="" />
                       <Picker.Item label="Male" value="Male" />
                       <Picker.Item label="Female" value="Female" />
                     </Picker>
                   </View>
                 </View>

                 <View style={styles.inputGroup}>
                   <Text style={[styles.themedDefault, styles.inputLabel]}>DATE OF BIRTH</Text>
                   {Platform.OS === 'web' ? (
                     <View style={styles.datePickerBtn}>
                        <input
                          type="date"
                          style={{
                            width: '100%',
                            border: 'none',
                            backgroundColor: 'transparent',
                            fontSize: '14px',
                            color: '#1E293B',
                            outline: 'none',
                            fontFamily: 'inherit'
                          }}
                          value={form.dateOfBirth ? form.dateOfBirth.toISOString().split('T')[0] : ""}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const date = new Date(e.target.value);
                            if (!isNaN(date.getTime())) {
                              setForm({ ...form, dateOfBirth: date });
                            }
                          }}
                          max={new Date().toISOString().split('T')[0]}
                        />
                     </View>
                   ) : (
                     <>
                       <TouchableOpacity 
                         style={styles.datePickerBtn} 
                         onPress={() => setShowDatePicker(true)}
                         activeOpacity={0.7}
                        >
                          <Text style={[styles.themedDefault, styles.dateText, !form.dateOfBirth && { color: "#94A3B8" }]}>
                            {form.dateOfBirth ? form.dateOfBirth.toLocaleDateString() : "Select Date of Birth"}
                          </Text>
                          <SVGIcon name="calendar" size={20} color={primary} />
                       </TouchableOpacity>

                       {showDatePicker && (
                         <DateTimePicker
                           value={form.dateOfBirth || new Date()}
                           mode="date"
                           display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                           maximumDate={new Date()}
                           onChange={(event: any, date?: Date) => {
                             setShowDatePicker(false);
                             if (date) setForm({ ...form, dateOfBirth: date });
                           }}
                         />
                       )}
                     </>
                   )}
                 </View>

                 <View style={styles.inputGroup}>
                   <Text style={[styles.themedDefault, styles.inputLabel]}>YOUR CLASS</Text>
                   <View style={styles.pickerWrapper}>
                     <Picker
                       selectedValue={form.selectedClassId}
                       onValueChange={(v) => setForm({ ...form, selectedClassId: v })}
                       style={styles.picker}
                       enabled={!loading}
                     >
                       <Picker.Item label="Which class are you in?" value="" />
                       {classes.map((c) => (
                         <Picker.Item key={c.id} label={c.name} value={c.id} />
                       ))}
                     </Picker>
                   </View>
                 </View>

                 <TouchableOpacity
                  onPress={handleSignup} 
                  activeOpacity={0.8}
                  style={[styles.joinBtn, { backgroundColor: primary, marginTop: 20 }]}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <View style={styles.joinBtnContent}>
                      <Text style={[styles.themedDefault, styles.joinBtnText]}>Finish Signup</Text>
                      <View style={styles.joinBtnIcon}>
                        <SVGIcon name="arrow-forward" size={18} color={primary} />
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
               </View>
            </Animatable.View>
          )}

          <View style={styles.footer}>
            {step > 1 && (
              <TouchableOpacity onPress={prevStep} style={styles.backBtn}>
                <Text style={[styles.themedDefault, styles.backBtnText]}>Back</Text>
              </TouchableOpacity>
            )}
            {step < 3 && (
              <TouchableOpacity 
                onPress={nextStep} 
                style={[styles.nextBtn, { backgroundColor: '#fff', flex: step === 1 ? 1 : 2 }]}
                disabled={loading}
              >
                <Text style={[styles.themedDefault, styles.nextBtnText, { color: primary }]}>Continue</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const InputField = ({ label, isPassword, onTogglePassword, showPassword, ...props }: any) => (
  <View style={styles.inputGroup}>
    <Text style={[styles.themedDefault, styles.inputLabel]}>{(label || "").toUpperCase()}</Text>
    <View style={styles.inputWrapper}>
      <TextInput 
        style={styles.input} 
        placeholderTextColor="#94A3B8" 
        {...props} 
        textAlignVertical="center"
      />
      {isPassword && (
        <TouchableOpacity onPress={onTogglePassword} style={styles.eyeIcon}>
          <SVGIcon name={showPassword ? "eye-off" : "eye"} size={20} color="#94A3B8" />
        </TouchableOpacity>
      )}
    </View>
  </View>
);

const styles = StyleSheet.create({
  themedDefault: {
    fontSize: 16,
    lineHeight: 24,
    color: '#1E293B', // Default text color if not specified
  },
  scrollContent: { padding: 24, flexGrow: 1 },
  header: { marginBottom: 30, alignItems: "center" },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    ...SHADOWS.small,
  },
  title: { fontSize: 26, fontWeight: "800", color: "#fff" },
  subtitle: { fontSize: 14, color: "rgba(255,255,255,0.8)", marginTop: 4, fontWeight: "600" },
  indicatorContainer: { flexDirection: "row", marginTop: 20, alignItems: "center", width: '100%', justifyContent: 'center' },
  stepWrapper: { flexDirection: 'row', alignItems: 'center' },
  stepCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  stepNumber: { fontSize: 14, fontWeight: 'bold', color: 'rgba(255,255,255,0.8)' },
  stepLine: { width: 40, height: 2, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 8 },
  stepContainer: { flex: 1 },
  card: { backgroundColor: "#fff", borderRadius: 24, padding: 20, ...SHADOWS.medium },
  cardHeader: { fontSize: 16, fontWeight: "800", color: "#1E293B", marginBottom: 20 },
  avatarPickerContainer: { alignItems: 'center', marginBottom: 25, position: 'relative' },
  avatarBtn: { 
    width: 100, 
    height: 100, 
    borderRadius: 35, 
    backgroundColor: '#F1F5F9', 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 2, 
    borderColor: '#E2E8F0',
    overflow: 'hidden'
  },
  avatarImg: { width: '100%', height: '100%' },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    height: 30,
    justifyContent: 'center',
    alignItems: 'center'
  },
  removeAvatar: { position: 'absolute', top: -5, right: width/2 - 50 - 24, backgroundColor: '#fff', borderRadius: 10 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 10, fontWeight: "900", color: "#64748B", marginBottom: 6, letterSpacing: 1 },
  inputWrapper: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: "#F1F5F9", 
    borderRadius: 12, 
    overflow: 'hidden',
    height: 55
  },
  input: { flex: 1, height: 55, paddingHorizontal: 15, fontSize: 14, color: "#1E293B" },
  eyeIcon: { paddingHorizontal: 12, height: '100%', justifyContent: 'center' },
  pickerWrapper: { backgroundColor: "#F1F5F9", borderRadius: 12, height: 55, justifyContent: 'center', overflow: 'hidden' },
  picker: { width: '100%', height: 55, color: '#1E293B' },
  datePickerBtn: { 
    backgroundColor: "#F1F5F9", 
    borderRadius: 12, 
    height: 55, 
    paddingHorizontal: 15, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between' 
  },
  dateText: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  codeCard: { backgroundColor: "#fff", borderRadius: 24, padding: 30, alignItems: "center", ...SHADOWS.medium },
  iconBadge: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  codeTitle: { fontSize: 20, fontWeight: "800", marginTop: 5, color: "#0F172A" },
  codeSubtitle: { textAlign: "center", color: "#64748B", marginTop: 8, marginBottom: 25, fontWeight: '500' },
  codeInput: { 
    width: '100%', 
    height: 60, 
    backgroundColor: "#F8FAFC", 
    borderRadius: 16, 
    textAlign: "center", 
    fontSize: 24, 
    fontWeight: "900", 
    color: '#0F172A',
    marginBottom: 25,
    borderWidth: 2,
    borderColor: '#F1F5F9'
  },
  joinBtn: {
    width: '100%',
    height: 65,
    borderRadius: 20,
    ...SHADOWS.medium,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  joinBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
  },
  joinBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  joinBtnIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center'
  },
  secureText: {
    marginTop: 20,
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '700',
    letterSpacing: 0.5
  },
  footer: { flexDirection: "row", gap: 12, marginTop: 30 },
  backBtn: { flex: 1, height: 55, justifyContent: "center", alignItems: "center", borderRadius: 16, backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  backBtnText: { fontWeight: "700", color: "#fff" },
  nextBtn: { height: 55, justifyContent: "center", alignItems: "center", borderRadius: 16, ...SHADOWS.medium },
  nextBtnText: { fontSize: 16, fontWeight: "800" },
});
