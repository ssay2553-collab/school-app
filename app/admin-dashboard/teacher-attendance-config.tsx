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
import moment from 'moment';
import { COLORS, SHADOWS } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { db } from '../../firebaseConfig';
import { SCHOOL_CONFIG } from '../../constants/Config';
import { TierProtectedRoute } from '../../components/TierProtectedRoute';
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

  interface SchoolLocation {
    id: string;
    name: string;
    latitude: string;
    longitude: string;
    radius: string;
  }

  const [locations, setLocations] = useState<SchoolLocation[]>([
    { id: '1', name: 'Main Campus / Block A', latitude: '', longitude: '', radius: '100' }
  ]);
  const [lateTime, setLateTime] = useState<string>('07:15'); // default late threshold time e.g. 07:15 AM
  const [configId, setConfigId] = useState<string>('');
  const [savedConfig, setSavedConfig] = useState<any>(null);

  // Holidays state
  const [holidays, setHolidays] = useState<{ date: string; title: string }[]>([]);
  const [holidayDate, setHolidayDate] = useState<string>(moment().format('YYYY-MM-DD'));
  const [holidayTitle, setHolidayTitle] = useState<string>('');

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
        if (data.lateTime) setLateTime(data.lateTime);
        if (data.configId) setConfigId(data.configId);
        if (data.holidays && Array.isArray(data.holidays)) setHolidays(data.holidays);

        if (data.locations && Array.isArray(data.locations) && data.locations.length > 0) {
          setLocations(
            data.locations.map((l: any, idx: number) => ({
              id: l.id || `loc_${idx + 1}`,
              name: l.name || `Campus Block ${idx + 1}`,
              latitude: l.latitude !== undefined && l.latitude !== null ? l.latitude.toString() : '',
              longitude: l.longitude !== undefined && l.longitude !== null ? l.longitude.toString() : '',
              radius: l.radius !== undefined && l.radius !== null ? l.radius.toString() : '100',
            }))
          );
        } else if (data.latitude !== undefined && data.longitude !== undefined) {
          setLocations([
            {
              id: '1',
              name: 'Main Campus / Block A',
              latitude: data.latitude.toString(),
              longitude: data.longitude.toString(),
              radius: data.radius !== undefined ? data.radius.toString() : '100',
            },
          ]);
        }
      }
    } catch (err) {
      console.error('Error fetching teacher attendance config:', err);
    }
  };

  const handleAddLocationBlock = () => {
    setLocations([
      ...locations,
      {
        id: `loc_${Date.now()}`,
        name: `Annex / Block ${String.fromCharCode(65 + locations.length)}`,
        latitude: '',
        longitude: '',
        radius: locations[0]?.radius || '100',
      },
    ]);
  };

  const handleRemoveLocationBlock = (id: string) => {
    if (locations.length <= 1) {
      showToast({ message: 'You must maintain at least one school location block.', type: 'error' });
      return;
    }
    setLocations(locations.filter(l => l.id !== id));
  };

  const handleUpdateLocationField = (id: string, field: keyof SchoolLocation, value: string) => {
    setLocations(
      locations.map(l => (l.id === id ? { ...l, [field]: value } : l))
    );
  };

  const handleAutoGenerateLocationForBlock = async (id: string) => {
    setFetchingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showToast({ message: 'Permission to access location was denied', type: 'error' });
        setFetchingLocation(false);
        return;
      }

      let location;
      try {
        location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      } catch (highErr) {
        try {
          location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        } catch (balErr) {
          location = await Location.getLastKnownPositionAsync();
        }
      }

      if (!location || !location.coords) {
        throw new Error('Unable to acquire live GPS location.');
      }

      const latStr = location.coords.latitude.toString();
      const lngStr = location.coords.longitude.toString();
      const accuracyMeters = location.coords.accuracy ? Math.round(location.coords.accuracy) : null;

      setLocations(
        locations.map(l => (l.id === id ? { ...l, latitude: latStr, longitude: lngStr } : l))
      );
      const accInfo = accuracyMeters ? ` (Accuracy: ±${accuracyMeters}m)` : '';
      showToast({ message: `GPS coordinates auto-generated for block successfully!${accInfo}`, type: 'success' });
    } catch (err) {
      console.error('Error auto-generating location:', err);
      showToast({ message: 'Failed to auto-generate GPS location.', type: 'error' });
    } finally {
      setFetchingLocation(false);
    }
  };

  const handleSaveConfig = async () => {
    if (locations.length === 0) {
      showToast({ message: 'Please add at least one school location block.', type: 'error' });
      return;
    }

    const parsedLocations = [];
    for (const loc of locations) {
      if (!loc.latitude || !loc.longitude) {
        showToast({ message: `Please provide or auto-generate GPS coordinates for "${loc.name || 'Block'}".`, type: 'error' });
        return;
      }
      const cleanLat = loc.latitude.toString().trim().replace(',', '.');
      const cleanLng = loc.longitude.toString().trim().replace(',', '.');
      const cleanRad = loc.radius.toString().trim().replace(',', '.');

      const latNum = parseFloat(cleanLat);
      const lngNum = parseFloat(cleanLng);
      const radiusNum = parseFloat(cleanRad) || 100;

      if (isNaN(latNum) || isNaN(lngNum) || latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
        showToast({ message: `Invalid latitude/longitude values for "${loc.name}".`, type: 'error' });
        return;
      }
      if (radiusNum < 10) {
        showToast({ message: `Allowed radius for "${loc.name}" must be at least 10 meters.`, type: 'error' });
        return;
      }

      parsedLocations.push({
        id: loc.id,
        name: loc.name.trim() || 'Campus Block',
        latitude: latNum,
        longitude: lngNum,
        radius: radiusNum,
      });
    }

    // Normalize late time input (e.g. "7:15", "7.15", "715" -> "07:15")
    const normalizeLateTime = (input: string): string => {
      const clean = input.trim().replace('.', ':').replace(' ', '');
      if (!clean) return '07:15';
      if (clean.includes(':')) {
        const parts = clean.split(':');
        let h = parseInt(parts[0], 10);
        let m = parseInt(parts[1], 10);
        if (isNaN(h)) h = 7;
        if (isNaN(m)) m = 15;
        h = Math.max(0, Math.min(23, h));
        m = Math.max(0, Math.min(59, m));
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      }
      if (/^\d{3,4}$/.test(clean)) {
        const h = parseInt(clean.slice(0, clean.length - 2), 10);
        const m = parseInt(clean.slice(-2), 10);
        if (isNaN(h) || isNaN(m)) return '07:15';
        const normH = Math.max(0, Math.min(23, h));
        const normM = Math.max(0, Math.min(59, m));
        return `${normH.toString().padStart(2, '0')}:${normM.toString().padStart(2, '0')}`;
      }
      return '07:15';
    };

    const formattedLateTime = normalizeLateTime(lateTime);
    setLateTime(formattedLateTime);

    setLoading(true);
    try {
      const newConfigId = configId || `GPS_ATT_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const payload = {
        schoolId,
        configId: newConfigId,
        locations: parsedLocations,
        // Backward compatibility primary fields
        latitude: parsedLocations[0].latitude,
        longitude: parsedLocations[0].longitude,
        radius: parsedLocations[0].radius,
        lateTime: formattedLateTime,
        holidays,
        updatedBy: appUser?.uid || 'admin',
        updatedAt: serverTimestamp(),
        date: new Date().toISOString().split('T')[0],
      };

      await setDoc(doc(db, 'teacherAttendanceConfig', schoolId), payload, { merge: true });
      setConfigId(newConfigId);
      setSavedConfig(payload);
      showToast({ message: 'Staff attendance multi-location GPS configuration saved successfully!', type: 'success' });
    } catch (err) {
      console.error('Error saving attendance config:', err);
      showToast({ message: 'Failed to save attendance configuration.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddHoliday = async () => {
    if (!holidayDate.trim() || !holidayTitle.trim()) {
      showToast({ message: 'Please provide both a date (YYYY-MM-DD) and holiday title.', type: 'error' });
      return;
    }

    const newHoliday = { date: holidayDate.trim(), title: holidayTitle.trim() };
    const updatedHolidays = [...holidays.filter(h => h.date !== newHoliday.date), newHoliday];

    try {
      const docRef = doc(db, 'teacherAttendanceConfig', schoolId);
      await setDoc(docRef, { holidays: updatedHolidays }, { merge: true });
      setHolidays(updatedHolidays);
      setHolidayTitle('');
      showToast({ message: `Holiday "${newHoliday.title}" set for ${newHoliday.date}!`, type: 'success' });
    } catch (err) {
      console.error('Error declaring holiday:', err);
      showToast({ message: 'Failed to declare holiday.', type: 'error' });
    }
  };

  const handleRemoveHoliday = async (dateToRemove: string) => {
    const updatedHolidays = holidays.filter(h => h.date !== dateToRemove);
    try {
      const docRef = doc(db, 'teacherAttendanceConfig', schoolId);
      await setDoc(docRef, { holidays: updatedHolidays }, { merge: true });
      setHolidays(updatedHolidays);
      showToast({ message: 'Holiday removed successfully.', type: 'success' });
    } catch (err) {
      console.error('Error removing holiday:', err);
      showToast({ message: 'Failed to remove holiday.', type: 'error' });
    }
  };

  return (
    <TierProtectedRoute featureId="admin_staff_attendance">
      <SafeAreaView style={styles.container} edges={['top']}>
      <View style={[styles.header, { backgroundColor: primary }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <SVGIcon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Staff Attendance Setup</Text>
          <Text style={styles.headerSub}>GPS Geofencing, Late Threshold & Holidays</Text>
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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text style={styles.sectionTitle}>📍 Multi-Location / School Blocks Setup</Text>
            <TouchableOpacity
              onPress={handleAddLocationBlock}
              style={{ backgroundColor: `${primary}15`, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <SVGIcon name="add" size={16} color={primary} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: primary }}>Add Block</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionSub}>
            Configure GPS coordinates and range for all school blocks/locations (e.g., Main Campus, Annex, Second Location) so teachers anywhere on campus can successfully check in.
          </Text>

          {locations.map((loc) => (
            <View key={loc.id} style={{ backgroundColor: '#f8fafc', borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#e2e8f0' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <TextInput
                  style={[styles.input, { flex: 1, fontWeight: '700', color: primary, marginRight: 10, height: 40 }]}
                  placeholder="Block Name (e.g. Main Campus / Block A)"
                  placeholderTextColor="#94a3b8"
                  value={loc.name}
                  onChangeText={(val) => handleUpdateLocationField(loc.id, 'name', val)}
                />
                {locations.length > 1 && (
                  <TouchableOpacity
                    onPress={() => handleRemoveLocationBlock(loc.id)}
                    style={{ padding: 8, backgroundColor: '#fee2e2', borderRadius: 8 }}
                  >
                    <SVGIcon name="close" size={16} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={[styles.locationBtn, { backgroundColor: primary, marginBottom: 10, paddingVertical: 8 }]}
                onPress={() => handleAutoGenerateLocationForBlock(loc.id)}
                disabled={fetchingLocation}
              >
                {fetchingLocation ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <SVGIcon name="location" size={16} color="#fff" />
                    <Text style={[styles.locationBtnText, { fontSize: 12 }]}>Capture Current GPS for {loc.name || 'this Block'}</Text>
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
                    value={loc.latitude}
                    onChangeText={(val) => handleUpdateLocationField(loc.id, 'latitude', val)}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Longitude</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. -0.1870"
                    placeholderTextColor="#94a3b8"
                    value={loc.longitude}
                    onChangeText={(val) => handleUpdateLocationField(loc.id, 'longitude', val)}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Allowed Range (Meters)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 100"
                  placeholderTextColor="#94a3b8"
                  value={loc.radius}
                  onChangeText={(val) => handleUpdateLocationField(loc.id, 'radius', val)}
                  keyboardType="numeric"
                />
              </View>
            </View>
          ))}

          <View style={{ marginTop: 10, marginBottom: 16 }}>
            <Text style={styles.label}>Late Threshold Time (HH:MM)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 07:15"
              placeholderTextColor="#94a3b8"
              value={lateTime}
              onChangeText={setLateTime}
            />
          </View>

          {/* Preset Quick-Select Time Chips */}
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#64748b' }}>Quick Select:</Text>
            {['07:15', '07:30', '08:00', '08:15', '08:30', '09:00'].map((preset) => (
              <TouchableOpacity
                key={preset}
                onPress={() => setLateTime(preset)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 8,
                  backgroundColor: lateTime === preset ? primary : '#f1f5f9',
                  borderWidth: 1,
                  borderColor: lateTime === preset ? primary : '#cbd5e1',
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: lateTime === preset ? '#ffffff' : '#334155',
                  }}
                >
                  {preset}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.hint}>
            Recommended range: <Text style={{ fontWeight: '700', color: primary }}>100 – 200 meters</Text> per block. Check-ins after {lateTime || '08:15'} will automatically be evaluated and marked as <Text style={{ fontWeight: '700', color: '#d97706' }}>Late</Text>.
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

        {/* School Holidays & Off-Days Section */}
        <View style={[styles.card, { marginTop: 20 }]}>
          <Text style={styles.sectionTitle}>🎉 School Holidays & Off-Days Setup</Text>
          <Text style={styles.sectionSub}>
            Declare official school holidays. On declared holidays, staff members are exempt from attendance check-in and will NOT be logged as absent.
          </Text>

          <View style={styles.inputRow}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Holiday Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94a3b8"
                value={holidayDate}
                onChangeText={setHolidayDate}
              />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Holiday Reason / Title</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Independence Day"
                placeholderTextColor="#94a3b8"
                value={holidayTitle}
                onChangeText={setHolidayTitle}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.holidayBtn, { backgroundColor: primary }]}
            onPress={handleAddHoliday}
          >
            <SVGIcon name="calendar" size={18} color="#fff" />
            <Text style={styles.holidayBtnText}>Declare Holiday for Date 🎉</Text>
          </TouchableOpacity>

          {holidays.length > 0 ? (
            <View style={styles.holidayList}>
              <Text style={styles.holidayListTitle}>Declared Holidays ({holidays.length}):</Text>
              {holidays.map((h) => (
                <View key={h.date} style={styles.holidayItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.holidayItemDate}>📅 {h.date}</Text>
                    <Text style={styles.holidayItemTitle}>{h.title}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteHolidayBtn}
                    onPress={() => handleRemoveHoliday(h.date)}
                  >
                    <SVGIcon name="close" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyHolidayText}>No holidays declared yet.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  </TierProtectedRoute>
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
  holidayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 8,
  },
  holidayBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  holidayList: { marginTop: 12 },
  holidayListTitle: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8 },
  holidayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  holidayItemDate: { fontSize: 12, fontWeight: '800', color: '#0f172a' },
  holidayItemTitle: { fontSize: 13, color: '#475569', marginTop: 2 },
  deleteHolidayBtn: { padding: 6 },
  emptyHolidayText: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic', marginTop: 8 },
});
