// /signup/student.tsx
import { Picker } from "@react-native-picker/picker";
import React from "react";
import moment from "moment";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
    SafeAreaView,
    StatusBar,
    Image,
    Text,
} from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../../components/SVGIcon";
import { SHADOWS, COLORS as THEME_COLORS } from "../../../constants/theme";
import { SCHOOL_CONFIG } from "../../../constants/Config";
import { useStudentSignup } from "../../../hooks/auth/useStudentSignup";

const DateTimePicker = Platform.OS !== 'web' ? require('@react-native-community/datetimepicker').default : null;

export default function StudentSignupScreen() {
  const primary = SCHOOL_CONFIG.primaryColor;

  const {
    step,
    classes,
    form,
    setForm,
    showDatePicker,
    setShowDatePicker,
    showPassword,
    setShowPassword,
    loading,
    verifyCode,
    pickImage,
    nextStep,
    prevStep,
    handleSignup,
  } = useStudentSignup();

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
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          
          <Animatable.View animation="fadeInDown" useNativeDriver={Platform.OS !== 'web'} style={styles.header}>
            <View style={styles.iconCircle}>
              <SVGIcon name="school" size={40} color={primary} />
            </View>
            <Text style={[styles.themedDefault, styles.title]}>Student Registry</Text>
            <Text style={[styles.themedDefault, styles.subtitle]}>Step {step} of 3</Text>
            {renderStepIndicator()}
          </Animatable.View>

          {step === 1 && (
            <Animatable.View animation="fadeInRight" useNativeDriver={Platform.OS !== 'web'} style={styles.stepContainer}>
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
                    <ActivityIndicator color="#fff" size="small" />
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
            <Animatable.View animation="fadeInRight" useNativeDriver={Platform.OS !== 'web'} style={styles.stepContainer}>
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
            <Animatable.View animation="fadeInRight" useNativeDriver={Platform.OS !== 'web'} style={styles.stepContainer}>
               <View style={styles.card}>
                 <Text style={[styles.themedDefault, styles.cardHeader]}>Student Profile</Text>
                 
                 <View style={styles.inputGroup}>
                   <Text style={[styles.themedDefault, styles.inputLabel, { position: 'absolute', top: 12, left: 12, zIndex: 1 }]}>GENDER</Text>
                   <View style={styles.pickerWrapper}>
                     <Picker
                       selectedValue={form.gender}
                       onValueChange={(v) => setForm({ ...form, gender: v })}
                       style={styles.picker}
                       enabled={!loading}
                     >
                       <Picker.Item label="" value="" />
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
                          onChange={(e: any) => {
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
                            {form.dateOfBirth ? moment(form.dateOfBirth).format("MMM DD, YYYY") : "Select Date of Birth"}
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
                   <Text style={[styles.themedDefault, styles.inputLabel, { position: 'absolute', top: 12, left: 12, zIndex: 1 }]}>YOUR CLASS</Text>
                   <View style={styles.pickerWrapper}>
                     <Picker
                       selectedValue={form.selectedClassId}
                       onValueChange={(v) => setForm({ ...form, selectedClassId: v })}
                       style={styles.picker}
                       enabled={!loading}
                     >
                       <Picker.Item label="" value="" />
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
                    <ActivityIndicator color="#fff" size="small" />
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
    color: '#1E293B',
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
  removeAvatar: { position: 'absolute', top: -5, right: '50%', marginRight: -60, backgroundColor: '#fff', borderRadius: 10 },
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
  pickerWrapper: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    minHeight: 65,
    justifyContent: 'center',
    paddingTop: 12,
    position: 'relative'
  },
  picker: { width: '100%', height: 45, color: '#1E293B', marginLeft: -10 },
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
