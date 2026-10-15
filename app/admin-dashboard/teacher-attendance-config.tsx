import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
// @ts-ignore
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { COLORS, SHADOWS } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { db } from '../../firebaseConfig';
import { SCHOOL_CONFIG } from '../../constants/Config';
import SVGIcon from '../../components/SVGIcon';

export default function TeacherAttendanceConfigScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const { appUser } = useAuth();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/admin-dashboard');
    }
  };

  const [loading, setLoading] = useState(false);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');
  const [radius, setRadius] = useState<string>('50'); // default 50 meters range
  const [lateTime, setLateTime] = useState<string>('08:15'); // default late threshold time e.g. 08:15 AM
  const [configId, setConfigId] = useState<string>('');
  const [savedConfig, setSavedConfig] = useState<any>(null);

  const schoolId = (Constants.expoConfig?.extra?.schoolId || SCHOOL_CONFIG.schoolId || 'school').toLowerCase();
  const primary = SCHOOL_CONFIG.primaryColor || COLORS.primary;

  useEffect(() => {
    fetchExistingConfig();
  }, []);

  const fetchExistingConfig = async () => {
    try {
      const docRef = doc(db, 'teacherAttendanceConfig', schoolId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        setSavedConfig(data);
        if (data.latitude) setLatitude(data.latitude.toString());
        if (data.longitude) setLongitude(data.longitude.toString());
        if (data.radius) setRadius(data.radius.toString());
        if (data.lateTime) setLateTime(data.lateTime);
        if (data.configId) setConfigId(data.configId);
      }
    } catch (err) {
      console.error('Error fetching teacher attendance config:', err);
    }
  };

  const handleAutoGenerateLocation = async (showToastMessage = true) => {
    setFetchingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (showToastMessage) {
          showToast({ message: 'Permission to access location was denied', type: 'error' });
        }
        setFetchingLocation(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLatitude(location.coords.latitude.toString());
      setLongitude(location.coords.longitude.toString());
      if (showToastMessage) {
        showToast({ message: 'GPS coordinates auto-generated successfully!', type: 'success' });
      }
    } catch (err) {
      console.error('Error auto-generating location:', err);
      if (showToastMessage) {
        showToast({ message: 'Failed to auto-generate GPS location.', type: 'error' });
      }
    } finally {
      setFetchingLocation(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!latitude || !longitude) {
      showToast({ message: 'Please provide or auto-generate valid GPS coordinates.', type: 'error' });
      return;
    }

    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);
    const radiusNum = parseFloat(radius) || 50;

    if (isNaN(latNum) || isNaN(lngNum)) {
      showToast({ message: 'Invalid latitude or longitude values.', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const newConfigId = configId || `GPS_ATT_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const payload = {
        schoolId,
        configId: newConfigId,
        latitude: latNum,
        longitude: lngNum,
        radius: radiusNum,
        lateTime: lateTime || '08:15',
        updatedBy: appUser?.uid || 'admin',
        updatedAt: serverTimestamp(),
        date: new Date().toISOString().split('T')[0],
      };

      await setDoc(doc(db, 'teacherAttendanceConfig', schoolId), payload);
      setConfigId(newConfigId);
      setSavedConfig(payload);
      showToast({ message: 'Staff attendance GPS configuration saved successfully!', type: 'success' });
    } catch (err) {
      console.error('Error saving attendance config:', err);
      showToast({ message: 'Failed to save attendance configuration.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={[styles.header, { backgroundColor: primary }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <SVGIcon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Staff Attendance Setup</Text>
          <Text style={styles.headerSub}>GPS Geofencing & Late Threshold</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.logsBtn}
          onPress={() => router.push('/admin-dashboard/teacher-attendance-logs')}
        >
          <SVGIcon name="checkmark-circle" size={18} color={primary} />
          <Text style={[styles.logsBtnText, { color: primary }]}>View Teacher Attendance Logs & Stats</Text>
        </TouchableOpacity>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📍 GPS Range & Late Time Configuration</Text>
          <Text style={styles.sectionSub}>
            Auto-generate school GPS coordinates, define the allowed check-in range in meters, and set the late threshold time (e.g. 08:15 AM).
          </Text>

          <TouchableOpacity
            style={[styles.locationBtn, { backgroundColor: primary }]}
            onPress={() => handleAutoGenerateLocation(true)}
            disabled={fetchingLocation}
          >
            {fetchingLocation ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <SVGIcon name="location" size={18} color="#fff" />
                <Text style={styles.locationBtnText}>Auto-Generate Current GPS Coordinates</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.inputRow}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Latitude</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 5.6037"
                placeholderTextColor="#94a3b8"
                value={latitude}
                onChangeText={setLatitude}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Longitude</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. -0.1870"
                placeholderTextColor="#94a3b8"
                value={longitude}
                onChangeText={setLongitude}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.inputRow}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Allowed Range (Meters)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 50"
                placeholderTextColor="#94a3b8"
                value={radius}
                onChangeText={setRadius}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Late Threshold Time (HH:MM)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 08:15"
                placeholderTextColor="#94a3b8"
                value={lateTime}
                onChangeText={setLateTime}
              />
            </View>
          </View>
          <Text style={styles.hint}>
            Check-ins after {lateTime || '08:15'} will automatically be evaluated and marked as <Text style={{ fontWeight: '700', color: '#d97706' }}>Late</Text>.
          </Text>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: primary }, loading && { opacity: 0.7 }]}
            onPress={handleSaveConfig}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>Save Attendance Configuration</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.8)' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    ...SHADOWS.small,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 6 },
  sectionSub: { fontSize: 13, color: '#64748b', lineHeight: 18, marginBottom: 16 },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 8,
  },
  locationBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  inputRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  inputContainer: { flex: 1, marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '600', color: '#334155', marginBottom: 6 },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
    fontSize: 14,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  hint: { fontSize: 12, color: '#64748b', marginTop: 4, marginBottom: 16 },
  saveBtn: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  logsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.small,
    gap: 10,
  },
  logsBtnText: { fontSize: 14, fontWeight: '700' },
});
