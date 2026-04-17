import { Picker } from "@react-native-picker/picker";
import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
    collection,
    doc,
    getDocs,
    serverTimestamp,
    setDoc,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Platform
} from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { getSchoolLogo } from "../../constants/Logos";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebaseConfig";
import { sortClasses } from "../../lib/classHelpers";

interface ClassItem {
  id: string;
  name: string;
}

export default function GenerateStudentCode() {
  const router = useRouter();
  const { appUser } = useAuth();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [fetchingClasses, setFetchingClasses] = useState(true);

  const schoolId = (Constants.expoConfig?.extra?.schoolId || "afahjoy").toLowerCase();
  const schoolLogo = getSchoolLogo(schoolId);

  const primary = SCHOOL_CONFIG.primaryColor || COLORS.primary;
  const secondary = SCHOOL_CONFIG.secondaryColor || COLORS.secondary;

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const snap = await getDocs(collection(db, "classes"));
        const list: ClassItem[] = [];
        snap.forEach((d) =>
          list.push({ id: d.id, name: d.data().name || d.id }),
        );
        setClasses(sortClasses(list));
      } catch (err) {
        console.error("Error fetching classes:", err);
      } finally {
        setFetchingClasses(false);
      }
    };
    fetchClasses();
  }, []);

  const generateRandomCode = () =>
    Math.random().toString(36).substring(2, 8).toUpperCase();

  const handleGenerateCode = async () => {
    if (!selectedClassId) {
      Alert.alert("Required", "Please select a target class.");
      return;
    }

    setLoading(true);
    setGeneratedCode(null);
    try {
      const code = generateRandomCode();
      const expiresAt = new Date(Date.now() + 20 * 60 * 1000);

      const codeData = {
        code,
        intendedForRole: "student",
        used: false,
        createdBy: appUser?.uid,
        createdAt: serverTimestamp(),
        expiresAt: expiresAt,
        classId: selectedClassId,
      };

      await setDoc(doc(db, "signupCodes", code), codeData);
      setGeneratedCode(code);
    } catch (error) {
      console.error("Error generating code:", error);
      Alert.alert("Error", "Could not generate security token.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (generatedCode) {
      await Clipboard.setStringAsync(generatedCode);
      Alert.alert("Copied", "Token copied to clipboard.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <LinearGradient colors={[primary, secondary]} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <SVGIcon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>Student Tokens</Text>
            <Text style={styles.headerSubtitle}>Secure Registration Portal</Text>
          </View>
          <View style={styles.badgeWrapper}>
            <Image source={schoolLogo} style={styles.schoolLogo} resizeMode="contain" />
          </View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animatable.View animation="fadeInUp" duration={600} style={styles.mainCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.iconCircle}>
              <SVGIcon name="people-outline" size={22} color={primary} />
            </View>
            <View>
              <Text style={styles.sectionTitle}>TOKEN GENERATOR</Text>
              <Text style={styles.sectionSubtitle}>Assign a class to create a signup code</Text>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>TARGET CLASSROOM</Text>
            <View style={styles.pickerContainer}>
              {fetchingClasses ? (
                <ActivityIndicator size="small" color={primary} />
              ) : (
                <Picker
                  selectedValue={selectedClassId}
                  onValueChange={setSelectedClassId}
                  style={styles.picker}
                  dropdownIconColor={primary}
                >
                  <Picker.Item label="Select student class..." value="" color="#94A3B8" />
                  {classes.map((c) => (
                    <Picker.Item key={c.id} label={c.name} value={c.id} />
                  ))}
                </Picker>
              )}
            </View>
          </View>

          <TouchableOpacity 
            style={styles.generateBtn} 
            onPress={handleGenerateCode} 
            disabled={loading}
          >
            <LinearGradient colors={[primary, secondary]} start={{x:0, y:0}} end={{x:1, y:0}} style={styles.btnGradient}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <SVGIcon name="key-outline" size={20} color="#fff" />
                  <Text style={styles.generateBtnText}>Generate Security Token</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animatable.View>

        {generatedCode && (
          <Animatable.View animation="zoomIn" duration={500} style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <SVGIcon name="shield-checkmark" size={20} color="#10B981" />
              <Text style={styles.resultTitle}>SECURE TOKEN CREATED</Text>
            </View>
            
            <View style={styles.codeWrapper}>
              <Text style={[styles.codeText, { color: primary }]}>{generatedCode}</Text>
            </View>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <SVGIcon name="time-outline" size={14} color="#64748B" />
                <Text style={styles.metaText}>Expires in 20 mins</Text>
              </View>
              <View style={styles.metaDivider} />
              <View style={styles.metaItem}>
                <SVGIcon name="person-outline" size={14} color="#64748B" />
                <Text style={styles.metaText}>1-Time Use</Text>
              </View>
            </View>

            <TouchableOpacity onPress={copyToClipboard} style={styles.copyBtn}>
              <SVGIcon name="copy-outline" size={18} color="#fff" />
              <Text style={styles.copyBtnText}>Copy Token to Clipboard</Text>
            </TouchableOpacity>
          </Animatable.View>
        )}

        <View style={styles.guideCard}>
          <View style={[styles.guideIcon, { backgroundColor: primary + '10' }]}>
            <SVGIcon name="information-circle" size={24} color={primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.guideTitle}>How it works</Text>
            <Text style={styles.guideText}>
              Share this token with the parent or student. They must enter it during account creation to be automatically linked to the correct class.
            </Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    paddingTop: Platform.OS === 'android' ? 45 : 20,
    paddingHorizontal: 25,
    paddingBottom: 60,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
    ...SHADOWS.medium
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  headerInfo: { flex: 1, marginLeft: 15 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#fff' },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  badgeWrapper: { width: 44, height: 44, backgroundColor: '#fff', borderRadius: 12, padding: 6, justifyContent: 'center', alignItems: 'center' },
  schoolLogo: { width: '100%', height: '100%' },
  scrollContent: { paddingHorizontal: 20, marginTop: -30 },
  mainCard: { 
    backgroundColor: '#fff', 
    borderRadius: 28, 
    padding: 25, 
    ...SHADOWS.large,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 25 },
  iconCircle: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  sectionTitle: { fontSize: 11, fontWeight: '900', color: '#94A3B8', letterSpacing: 1.5 },
  sectionSubtitle: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginTop: 2 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 9, fontWeight: '900', color: '#64748B', marginBottom: 10, letterSpacing: 1 },
  pickerContainer: { 
    backgroundColor: '#F8FAFC', 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: '#E2E8F0',
    height: 56,
    justifyContent: 'center'
  },
  picker: { width: '100%', height: 56 },
  generateBtn: { borderRadius: 18, overflow: 'hidden', ...SHADOWS.small },
  btnGradient: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  generateBtnText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 0.5 },
  resultCard: { 
    backgroundColor: '#fff', 
    borderRadius: 28, 
    padding: 25, 
    marginTop: 20, 
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#10B981',
    borderStyle: 'dashed'
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 15 },
  resultTitle: { fontSize: 10, fontWeight: '900', color: '#10B981', letterSpacing: 1 },
  codeWrapper: { paddingVertical: 10 },
  codeText: { fontSize: 42, fontWeight: '900', letterSpacing: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 25 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  metaDivider: { width: 1, height: 12, backgroundColor: '#E2E8F0' },
  copyBtn: { backgroundColor: '#1E293B', paddingVertical: 14, paddingHorizontal: 25, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', justifyContent: 'center' },
  copyBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  guideCard: { flexDirection: 'row', padding: 20, backgroundColor: '#fff', borderRadius: 24, marginTop: 20, gap: 15, alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' },
  guideIcon: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  guideTitle: { fontSize: 15, fontWeight: '800', color: '#1E293B' },
  guideText: { fontSize: 12, color: '#64748B', lineHeight: 18, marginTop: 2, fontWeight: '600' }
});
