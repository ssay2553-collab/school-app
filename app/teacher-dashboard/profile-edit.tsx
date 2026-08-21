import React from "react";
import {
  ActivityIndicator,
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
import { Picker } from "@react-native-picker/picker";
const DateTimePicker = Platform.OS !== 'web' ? require('@react-native-community/datetimepicker').default : null;
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { GES_SUBJECTS, CAMBRIDGE_SUBJECTS, CurriculumType } from "../../constants/Curriculum";
import moment from "moment";
import { useTeacherProfile } from "../../hooks/teacher-dashboard/useTeacherProfile";

export default function TeacherProfileEdit() {
  const {
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
  } = useTeacherProfile();

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
                    {appUser?.profile?.phone || "No Phone"} • {appUser?.profile?.gender || "Not specified"} • {appUser?.profile?.dob ? moment(appUser.profile.dob).format("MM/DD/YYYY") : "No DOB"}
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
                <Text style={styles.miniLabel}>GENDER</Text>
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
              {Platform.OS === 'web' ? (
                <View style={[styles.modalInput, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                   <SVGIcon name="calendar-outline" size={18} color={COLORS.primary} />
                   <TextInput
                    style={{
                      flex: 1,
                      backgroundColor: 'transparent',
                      fontSize: 16,
                      fontWeight: '600',
                      color: '#1E293B',
                      outlineStyle: 'none'
                    } as any}
                    defaultValue={dob instanceof Date && !isNaN(dob.getTime()) ? dob.toISOString().split('T')[0] : ''}
                    onChangeText={(val) => {
                      const parsed = moment(val, ["YYYY-MM-DD", "DD-MM-YYYY", "MM-DD-YYYY", "DD/MM/YYYY", "MM/DD/YYYY"], true);
                      if (parsed.isValid()) {
                        setDob(parsed.toDate());
                      }
                    }}
                    {...({ type: 'date' } as any)}
                  />
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.modalInput}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Text style={{ marginTop: 15, fontSize: 16, fontWeight: '600' }}>
                      {moment(dob).format("MM/DD/YYYY")}
                    </Text>
                  </TouchableOpacity>

                  {showDatePicker && (
                    <DateTimePicker
                      value={dob}
                      mode="date"
                      display="default"
                      onChange={(event: any, selectedDate?: Date) => {
                        setShowDatePicker(Platform.OS === 'ios');
                        if (selectedDate) setDob(selectedDate);
                      }}
                      maximumDate={new Date()}
                    />
                  )}
                </>
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
                <Text style={styles.miniLabel}>CURRICULUM</Text>
                <Picker
                  selectedValue={curriculum}
                  onValueChange={(v) => {
                    setCurriculum(v as CurriculumType);
                    setSelectedSubjects([]);
                    setIsOtherSelected(false);
                    setCustomSubject("");
                  }}
                  style={styles.picker}
                >
                  <Picker.Item label="GES (National)" value="GES" />
                  <Picker.Item label="Cambridge (IGCSE)" value="Cambridge" />
                  <Picker.Item label="Montessori" value="Montessori" />
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

                {/* Show custom subjects as active chips */}
                {selectedSubjects.filter(s => !(curriculum === "GES" ? GES_SUBJECTS : CAMBRIDGE_SUBJECTS).includes(s)).map(s => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setSelectedSubjects(prev => prev.filter(item => item !== s))}
                    style={[styles.chip, { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
                  >
                    <Text style={[styles.chipText, { color: '#fff' }]}>{s}</Text>
                  </TouchableOpacity>
                ))}

                <TouchableOpacity
                  onPress={() => setIsOtherSelected(!isOtherSelected)}
                  style={[styles.chip, isOtherSelected && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
                >
                  <Text style={[styles.chipText, isOtherSelected && { color: '#fff' }]}>Other</Text>
                </TouchableOpacity>
              </View>

              {isOtherSelected && (
                <>
                  <Text style={styles.modalLabel}>SPECIFY OTHER SUBJECT</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Enter subject name"
                    value={customSubject}
                    onChangeText={setCustomSubject}
                  />
                </>
              )}

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
    minHeight: 65,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingTop: 12,
  },
  miniLabel: {
    position: "absolute",
    top: 12,
    left: 12,
    fontSize: 9,
    fontWeight: "900",
    color: "#94A3B8",
    zIndex: 1,
  },
  picker: {
    width: '100%',
    marginLeft: -10,
  },
  modalBtn: { height: 55, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  modalBtnText: { color: '#fff', fontSize: 15, fontWeight: '900' }
});
