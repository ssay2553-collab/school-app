import { Picker } from '@react-native-picker/picker';
import * as Clipboard from 'expo-clipboard';
import { collection, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { useRouter } from "expo-router";
import React, { useEffect, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  Platform,
} from 'react-native';
import * as Animatable from "react-native-animatable";
import Constants from 'expo-constants';
import { getSchoolLogo } from "../../constants/Logos";
import { COLORS, SHADOWS } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { db } from '../../firebaseConfig';
import { SCHOOL_CONFIG } from "../../constants/Config";
import SVGIcon from "../../components/SVGIcon";
import { sortClasses } from "../../lib/classHelpers";

interface ClassItem {
  id: string;
  name: string;
}

const GenerateCodeScreen = () => {
  const router = useRouter();
  const { showToast } = useToast();
  const { appUser, loading: authLoading } = useAuth();
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [fetchingClasses, setFetchingClasses] = useState(true);

  const schoolId = (Constants.expoConfig?.extra?.schoolId || 'school').toLowerCase();
  const schoolLogo = getSchoolLogo(schoolId);

  const primary = SCHOOL_CONFIG.primaryColor;
  const brandPrimary = SCHOOL_CONFIG.brandPrimary;
  
  const isWeb = Platform.OS === 'web';
  const useNativeDriver = !isWeb;

  const bg = "#F8FAFC";
  const cardBg = "#FFFFFF";

  // GRANT ACCESS TO ALL ADMIN USERS
  const isAuthorized = useMemo(() => appUser?.role?.toLowerCase() === 'admin', [appUser]);

  useEffect(() => {
    if (!isAuthorized) return;
    const fetchClasses = async () => {
      try {
        const snap = await getDocs(collection(db, "classes"));
        const list: ClassItem[] = [];
        snap.forEach(d => list.push({ id: d.id, name: d.data().name || d.id }));
        const sorted = sortClasses(list);
        setClasses(sorted);
      } catch (err) {
        console.error("Error fetching classes:", err);
      } finally {
        setFetchingClasses(false);
      }
    };
    fetchClasses();
  }, [isAuthorized]);

  const generateRandomCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const handleGenerateCode = async () => {
    if (!isAuthorized) return;
    if (role === 'student' && !selectedClassId) {
      showToast({ message: 'Please select a class for the student code.', type: 'error' });
      return;
    }

    setLoading(true);
    setGeneratedCode(null);
    try {
      const code = generateRandomCode();
      const expiresAt = new Date(Date.now() + 20 * 60 * 1000);

      const codeData: any = {
        code,
        intendedForRole: role,
        used: false,
        createdBy: appUser?.uid,
        createdAt: serverTimestamp(),
        expiresAt: expiresAt,
      };

      if (role === 'student') {
        codeData.classId = selectedClassId;
      }

      await setDoc(doc(db, "signupCodes", code), codeData);
      setGeneratedCode(code);
    } catch (error) {
      console.error('Error generating code:', error);
      showToast({ message: 'Could not generate code.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (generatedCode) {
      await Clipboard.setStringAsync(generatedCode);
      showToast({ message: 'Code copied to clipboard.', type: 'success' });
    }
  };

  if (authLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={brandPrimary} />
      </View>
    );
  }

  if (!appUser || !isAuthorized) {
    return (
        <View style={styles.center}>
            <SVGIcon name="alert-circle" size={50} color={COLORS.danger} />
            <Text style={{ marginTop: 10, fontWeight: 'bold' }}>Permission Denied</Text>
            <TouchableOpacity onPress={() => router.replace("/admin-dashboard")} style={{ marginTop: 20 }}>
                <Text style={{ color: brandPrimary }}>Go Back</Text>
            </TouchableOpacity>
        </View>
    );
  }

  const headerTextColor = (schoolId === 'bms' || primary === '#FEDD00') ? brandPrimary : '#FFFFFF';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar barStyle="dark-content" backgroundColor={bg} />
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.schoolHeader, { backgroundColor: primary }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.miniBackBtn}>
            <SVGIcon name="arrow-back" size={20} color={headerTextColor} />
          </TouchableOpacity>
          <Image source={schoolLogo} style={styles.schoolLogoMini} resizeMode="contain" />
          <View>
            <Text style={[styles.schoolNameMini, { color: headerTextColor }]}>{SCHOOL_CONFIG.fullName}</Text>
            <Text style={[styles.mottoMini, { color: headerTextColor, opacity: 0.8 }]}>Security Protocol</Text>
          </View>
        </View>

        <View style={styles.headerTitleSection}>
            <Text style={[styles.mainTitle, { color: "#0F172A" }]}>Token Generator</Text>
            <Text style={[styles.headerSubtitle, { color: "#64748B" }]}>Generate unique security codes for onboarding.</Text>
        </View>

        <View style={[styles.formCard, { backgroundColor: cardBg }]}>
          <Text style={[styles.fieldLabel, { color: brandPrimary }]}>SELECT TARGET ROLE</Text>
          <View style={[styles.roleToggleContainer, { backgroundColor: "#F1F5F9" }]}>
            <TouchableOpacity 
              style={[styles.roleBtn, role === 'student' && [styles.roleBtnActive, { backgroundColor: brandPrimary }]]} 
              onPress={() => { setRole('student'); setGeneratedCode(null); }}
            >
              <SVGIcon name="school" size={20} color={role === 'student' ? '#fff' : "#64748B"} />
              <Text style={[styles.roleBtnText, { color: role === 'student' ? '#fff' : "#64748B" }]}>Student</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.roleBtn, role === 'teacher' && [styles.roleBtnActive, { backgroundColor: brandPrimary }]]} 
              onPress={() => { setRole('teacher'); setGeneratedCode(null); }}
            >
              <SVGIcon name="person" size={20} color={role === 'teacher' ? '#fff' : "#64748B"} />
              <Text style={[styles.roleBtnText, { color: role === 'teacher' ? '#fff' : "#64748B" }]}>Teacher</Text>
            </TouchableOpacity>
          </View>

          {role === 'student' && (
            <Animatable.View
              animation={isWeb ? undefined : "fadeIn"}
              duration={400}
              useNativeDriver={useNativeDriver}
              style={styles.inputGroup}
            >
              <View style={[styles.pickerBox, { borderColor: "#E2E8F0" }]}>
                <Text style={[styles.miniLabel, { color: "#94A3B8" }]}>ASSIGN TO CLASS</Text>
                {fetchingClasses ? (
                  <ActivityIndicator size="small" color={brandPrimary} style={{ alignSelf: 'flex-start', marginLeft: 15, marginTop: 15 }} />
                ) : (
                  <Picker
                    selectedValue={selectedClassId}
                    onValueChange={(val) => setSelectedClassId(val)}
                    style={[styles.picker, { color: "#1E293B" }]}
                    dropdownIconColor="#1E293B"
                  >
                    <Picker.Item label="Select Class..." value="" color="#94A3B8" />
                    {classes.map(c => (
                      <Picker.Item key={c.id} label={c.name} value={c.id} style={{ fontSize: 14 }} />
                    ))}
                  </Picker>
                )}
              </View>
            </Animatable.View>
          )}

          <TouchableOpacity 
            style={[styles.generateBtn, { backgroundColor: brandPrimary }, loading && { opacity: 0.7 }]} 
            onPress={handleGenerateCode} 
            disabled={loading}
          >
            {loading ? (
                <ActivityIndicator color="#fff" />
            ) : (
                <>
                    <Text style={styles.generateBtnText}>Create Token</Text>
                    <View style={{ marginLeft: 8 }}><SVGIcon name="flash" size={18} color="#fff" /></View>
                </>
            )}
          </TouchableOpacity>
        </View>

        {generatedCode && (
          <Animatable.View
            animation={isWeb ? undefined : "bounceIn"}
            useNativeDriver={useNativeDriver}
            style={[styles.resultCard, { backgroundColor: "#fff", borderColor: brandPrimary, borderWidth: 2 }]}
          >
            <View style={styles.resultHeader}>
                <View style={[styles.indicator, { backgroundColor: COLORS.success }]} />
                <Text style={[styles.resultLabel, { color: "#64748B" }]}>SECURE TOKEN READY</Text>
            </View>
            <View style={[styles.codeContainer, { borderColor: brandPrimary + '30' }]}>
                <Text style={[styles.codeText, { color: brandPrimary }]}>{generatedCode}</Text>
            </View>
            <View style={styles.expiryRow}>
                <SVGIcon name="time" size={14} color="#94A3B8" />
                <Text style={[styles.expiryNote, { color: "#94A3B8" }]}>Valid for 20 minutes</Text>
            </View>
            <TouchableOpacity onPress={copyToClipboard} style={[styles.copyBtn, { backgroundColor: brandPrimary }]}>
              <SVGIcon name="document-text" size={18} color="#fff" />
              <Text style={styles.copyBtnText}>Copy Code</Text>
            </TouchableOpacity>
          </Animatable.View>
        )}
        
        <View style={[styles.infoBox, { backgroundColor: "#fff", borderColor: "#E2E8F0", borderWidth: 1 }]}>
            <View style={[styles.infoIconBox, { backgroundColor: brandPrimary + '15' }]}>
                <SVGIcon name="shield-checkmark" size={20} color={brandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={[styles.infoTitle, { color: "#1E293B" }]}>One-Time Use</Text>
                <Text style={[styles.infoText, { color: "#64748B" }]}>This code will expire once used or after the time limit. Send it privately to the intended user.</Text>
            </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20 },
  schoolHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 25, padding: 12, borderRadius: 18, ...SHADOWS.small },
  miniBackBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  schoolLogoMini: { width: 28, height: 28, marginRight: 10 },
  schoolNameMini: { fontSize: 13, fontWeight: 'bold' },
  mottoMini: { fontSize: 10, fontStyle: 'italic' },
  headerTitleSection: { marginBottom: 25 },
  mainTitle: { fontSize: 26, fontWeight: "900" },
  headerSubtitle: { fontSize: 14, marginTop: 4 },
  formCard: { borderRadius: 24, padding: 20, ...SHADOWS.medium, marginBottom: 25 },
  fieldLabel: { fontSize: 11, fontWeight: "900", letterSpacing: 1.5, marginBottom: 15, textAlign: 'center' },
  roleToggleContainer: { flexDirection: 'row', borderRadius: 16, padding: 4, marginBottom: 20 },
  roleBtn: { flex: 1, flexDirection: 'row', height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 8 },
  roleBtnActive: { ...SHADOWS.small },
  roleBtnText: { fontWeight: '700', fontSize: 14 },
  inputGroup: { marginBottom: 20 },
  pickerBox: { backgroundColor: "#fff", borderRadius: 12, height: 60, justifyContent: "center", borderWidth: 1 },
  picker: { height: 50, marginLeft: -8 },
  miniLabel: { fontSize: 9, fontWeight: "900", position: 'absolute', top: 6, left: 12, zIndex: 1, letterSpacing: 0.8 },
  generateBtn: { height: 56, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', ...SHADOWS.small },
  generateBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  resultCard: { padding: 24, borderRadius: 28, alignItems: 'center', ...SHADOWS.large, marginBottom: 25 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 15 },
  indicator: { width: 8, height: 8, borderRadius: 4 },
  resultLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  codeContainer: { paddingVertical: 15, paddingHorizontal: 30, borderRadius: 20, borderStyle: 'dashed', borderWidth: 2, marginBottom: 15 },
  codeText: { fontSize: 36, fontWeight: 'bold', letterSpacing: 4 },
  expiryRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  expiryNote: { fontSize: 11, fontWeight: '600' },
  copyBtn: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 12, alignItems: 'center', gap: 10 },
  copyBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  infoBox: { flexDirection: 'row', padding: 18, borderRadius: 20, gap: 15, alignItems: 'center' },
  infoIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  infoTitle: { fontSize: 14, fontWeight: 'bold' },
  infoText: { fontSize: 12, lineHeight: 18, marginTop: 2 }
});

export default GenerateCodeScreen;
