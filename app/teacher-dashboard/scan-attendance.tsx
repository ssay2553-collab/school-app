import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import moment from 'moment';
import { COLORS, SHADOWS } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { db } from '../../firebaseConfig';
import { SCHOOL_CONFIG } from '../../constants/Config';
import SVGIcon from '../../components/SVGIcon';

export default function ScanAttendanceScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const { appUser } = useAuth();

  const [loading, setLoading] = useState(false);
  const [fetchingConfig, setFetchingConfig] = useState(true);
  const [configData, setConfigData] = useState<any>(null);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [attendanceRecord, setAttendanceRecord] = useState<any>(null);
  const [weeklyRecords, setWeeklyRecords] = useState<Record<string, any>>({});
  const [mode, setMode] = useState<'checkIn' | 'checkOut'>('checkIn');

  const schoolId = (Constants.expoConfig?.extra?.schoolId || SCHOOL_CONFIG.schoolId || 'school').toLowerCase();
  const primary = SCHOOL_CONFIG.primaryColor || COLORS.primary;
  const today = moment().format('YYYY-MM-DD');

  useEffect(() => {
    fetchConfigAndStatus();
  }, []);

  const fetchConfigAndStatus = async () => {
    setFetchingConfig(true);
    try {
      // 1. Fetch Admin Attendance Config
      const configRef = doc(db, 'teacherAttendanceConfig', schoolId);
      const configSnap = await getDoc(configRef);
      if (configSnap.exists()) {
        setConfigData(configSnap.data());
      }

      // 2. Check existing attendance record for today & fetch weekly records (Mon - Fri)
      if (appUser?.uid) {
        const attendanceRecordId = `${schoolId}_${appUser.uid}_${today}`;
        const attDocRef = doc(db, 'teacherAttendance', attendanceRecordId);
        const attSnap = await getDoc(attDocRef);
        if (attSnap.exists()) {
          const data = attSnap.data();
          setAttendanceRecord(data);
          if (data.checkInTime && !data.checkOutTime) {
            setMode('checkOut');
          }
        }

        const startOfWeek = moment().startOf('isoWeek'); // Monday
        const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((name, index) => {
          const d = moment(startOfWeek).add(index, 'days');
          return { name, date: d.format('YYYY-MM-DD') };
        });

        const weeklyMap: Record<string, any> = {};
        for (const wd of weekDays) {
          const recId = `${schoolId}_${appUser.uid}_${wd.date}`;
          const recSnap = await getDoc(doc(db, 'teacherAttendance', recId));
          if (recSnap.exists()) {
            weeklyMap[wd.date] = recSnap.data();
          }
        }
        setWeeklyRecords(weeklyMap);
      }

      // 3. Get current teacher GPS location
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setCurrentLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      } else {
        showToast({ message: 'Location permission is required for attendance verification.', type: 'error' });
      }
    } catch (err) {
      console.error('Error loading attendance setup:', err);
    } finally {
      setFetchingConfig(false);
    }
  };

  const calculateDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleCheckInOut = async () => {
    if (!configData) {
      showToast({ message: 'No active attendance session configured by admin.', type: 'error' });
      return;
    }

    if (!currentLocation) {
      showToast({ message: 'Fetching GPS location. Please wait...', type: 'error' });
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setCurrentLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      } catch (e) {
        showToast({ message: 'Unable to fetch GPS location. Please enable location services.', type: 'error' });
        return;
      }
    }

    setLoading(true);
    try {
      const teacherLat = currentLocation!.latitude;
      const teacherLng = currentLocation!.longitude;
      const adminLat = configData.latitude;
      const adminLng = configData.longitude;
      const allowedRadius = configData.radius || 50;

      const distance = calculateDistanceInMeters(teacherLat, teacherLng, adminLat, adminLng);

      if (distance > allowedRadius) {
        Alert.alert(
          'Attendance Rejected 🚫',
          `You are too far from the school location!\n\nYour distance: ${Math.round(distance)} meters\nAllowed range: ${allowedRadius} meters\n\nPlease move closer to the school premises.`
        );
        setLoading(false);
        return;
      }

      const attendanceRecordId = `${schoolId}_${appUser?.uid}_${today}`;
      const attDocRef = doc(db, 'teacherAttendance', attendanceRecordId);
      const attSnap = await getDoc(attDocRef);

      if (mode === 'checkIn') {
        if (attSnap.exists() && attSnap.data().checkInTime) {
          Alert.alert('Already Logged In', 'You have already logged in (checked in) for today.');
          setMode('checkOut');
          setLoading(false);
          return;
        }

        // Evaluate On Time vs Late based on admin lateTime threshold
        const now = moment();
        const lateThresholdStr = configData.lateTime || '08:15';
        const [lateH, lateM] = lateThresholdStr.split(':').map(Number);
        const currentTotalMinutes = now.hours() * 60 + now.minutes();
        const thresholdTotalMinutes = (isNaN(lateH) ? 8 : lateH) * 60 + (isNaN(lateM) ? 15 : lateM);

        const attendanceStatus = currentTotalMinutes <= thresholdTotalMinutes ? 'On Time' : 'Late';

        const checkInPayload = {
          teacherId: appUser?.uid,
          teacherName: appUser?.name || appUser?.displayName || 'Teacher',
          teacherEmail: appUser?.email || '',
          schoolId,
          date: today,
          checkInTime: serverTimestamp(),
          checkInLatitude: teacherLat,
          checkInLongitude: teacherLng,
          checkInDistance: distance,
          status: attendanceStatus,
          updatedAt: serverTimestamp(),
        };

        await setDoc(attDocRef, checkInPayload, { merge: true });
        const updatedSnap = await getDoc(attDocRef);
        setAttendanceRecord(updatedSnap.data());
        setWeeklyRecords(prev => ({ ...prev, [today]: updatedSnap.data() }));
        setMode('checkOut');
        Alert.alert(
          attendanceStatus === 'On Time' ? 'Login Successful! 🎉' : 'Logged In (Late) ⏰',
          `Your check-in has been recorded as: ${attendanceStatus} (${now.format('hh:mm A')}).`
        );
      } else {
        const checkOutPayload = {
          checkOutTime: serverTimestamp(),
          checkOutLatitude: teacherLat,
          checkOutLongitude: teacherLng,
          checkOutDistance: distance,
          updatedAt: serverTimestamp(),
        };

        await updateDoc(attDocRef, checkOutPayload);
        const updatedSnap = await getDoc(attDocRef);
        setAttendanceRecord(updatedSnap.data());
        setWeeklyRecords(prev => ({ ...prev, [today]: updatedSnap.data() }));
        Alert.alert('Logout Successful! 👋', 'Your attendance check-out has been recorded successfully.');
      }
    } catch (err) {
      console.error('Error recording attendance:', err);
      showToast({ message: 'Failed to record attendance.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const isCheckedIn = Boolean(attendanceRecord?.checkInTime);
  const isCheckedOut = Boolean(attendanceRecord?.checkOutTime);

  const checkInTimeFormatted = attendanceRecord?.checkInTime
    ? moment(attendanceRecord.checkInTime.toDate ? attendanceRecord.checkInTime.toDate() : attendanceRecord.checkInTime).format('hh:mm A')
    : null;

  const checkOutTimeFormatted = attendanceRecord?.checkOutTime
    ? moment(attendanceRecord.checkOutTime.toDate ? attendanceRecord.checkOutTime.toDate() : attendanceRecord.checkOutTime).format('hh:mm A')
    : null;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/teacher-dashboard');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={[styles.header, { backgroundColor: primary }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <SVGIcon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Staff Attendance</Text>
          <Text style={styles.headerSub}>GPS Proximity Verification</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {fetchingConfig ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={primary} />
          </View>
        ) : (
          <View style={styles.card}>
            <View style={[styles.iconBox, { backgroundColor: primary + '20' }]}>
              <SVGIcon name="checkmark-done-circle" size={32} color={primary} />
            </View>
            <Text style={styles.title}>GPS Attendance Check-In / Out</Text>
            <Text style={styles.subtitle}>
              Verify your presence at school via GPS location and record your check-in or check-out instantly.
            </Text>

            <View style={styles.weeklyCard}>
              <Text style={styles.weeklyTitle}>📅 This Week's Attendance (Mon - Fri)</Text>
              <View style={styles.weeklyDaysRow}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((name, index) => {
                  const d = moment(moment().startOf('isoWeek')).add(index, 'days').format('YYYY-MM-DD');
                  const rec = weeklyRecords[d];
                  const status = rec?.checkInTime ? (rec?.status === 'Late' ? 'Late' : 'Present') : 'Not Logged';
                  const bg = status === 'Present' ? '#ecfdf5' : status === 'Late' ? '#fffbeb' : '#f1f5f9';
                  const fg = status === 'Present' ? '#059669' : status === 'Late' ? '#d97706' : '#94a3b8';
                  return (
                    <View key={name} style={[styles.dayBadge, { backgroundColor: bg }]}>
                      <Text style={[styles.dayBadgeName, { color: fg }]}>{name}</Text>
                      <Text style={[styles.dayBadgeStatus, { color: fg }]}>
                        {status === 'Present' ? '✓' : status === 'Late' ? '⏱' : '—'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={styles.modeTabs}>
              <TouchableOpacity
                style={[styles.modeTab, mode === 'checkIn' && { backgroundColor: primary }]}
                onPress={() => setMode('checkIn')}
              >
                <Text style={[styles.modeTabText, mode === 'checkIn' && { color: '#fff' }]}>
                  Log In {isCheckedIn ? '✓' : ''}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeTab, mode === 'checkOut' && { backgroundColor: primary }]}
                onPress={() => setMode('checkOut')}
              >
                <Text style={[styles.modeTabText, mode === 'checkOut' && { color: '#fff' }]}>
                  Log Out {isCheckedOut ? '✓' : ''}
                </Text>
              </TouchableOpacity>
            </View>

            {currentLocation ? (
              <View style={styles.locationBadge}>
                <SVGIcon name="location" size={16} color="#10b981" />
                <Text style={styles.locationBadgeText}>
                  GPS Acquired ({currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)})
                </Text>
              </View>
            ) : (
              <View style={styles.warningBadge}>
                <SVGIcon name="warning" size={16} color="#f59e0b" />
                <Text style={styles.warningBadgeText}>Fetching GPS location...</Text>
              </View>
            )}

            <View style={styles.statusBox}>
              <Text style={styles.statusLabel}>Today's Status ({today}):</Text>
              <Text style={styles.statusValue}>
                🟢 Check-In: {isCheckedIn ? `${checkInTimeFormatted} (${attendanceRecord?.status || 'Present'}) ✓` : 'Pending ⏳'}
              </Text>
              <Text style={[styles.statusValue, { marginTop: 4 }]}>
                🔴 Check-Out: {isCheckedOut ? `${checkOutTimeFormatted} ✓` : 'Pending ⏳'}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.scanBtn, { backgroundColor: primary }, loading && { opacity: 0.7 }]}
              onPress={handleCheckInOut}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.scanBtnText}>
                  {mode === 'checkIn' ? 'Check In Now (Log In)' : 'Check Out Now (Log Out)'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  center: { padding: 40, alignItems: 'center' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    ...SHADOWS.small,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#1e293b', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 18, marginBottom: 16 },
  weeklyCard: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  weeklyTitle: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 10 },
  weeklyDaysRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'space-between',
  },
  dayBadge: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dayBadgeName: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
  dayBadgeStatus: { fontSize: 13, fontWeight: '800' },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 4,
    width: '100%',
    marginBottom: 16,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  modeTabText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 6,
  },
  locationBadgeText: { color: '#059669', fontSize: 12, fontWeight: '600' },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 6,
  },
  warningBadgeText: { color: '#d97706', fontSize: 12, fontWeight: '600' },
  statusBox: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  statusLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 4 },
  statusValue: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  scanBtn: {
    width: '100%',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  scanBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  headerSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
  },
});
