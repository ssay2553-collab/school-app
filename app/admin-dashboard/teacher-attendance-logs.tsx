import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, query, orderBy, serverTimestamp, writeBatch, where } from 'firebase/firestore';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import moment from 'moment';
import Constants from 'expo-constants';
import { COLORS, SHADOWS } from '../../constants/theme';
import { db } from '../../firebaseConfig';
import { SCHOOL_CONFIG } from '../../constants/Config';
import { getSchoolLogo } from '../../constants/Logos';
import SVGIcon from '../../components/SVGIcon';
import { useToast } from '../../contexts/ToastContext';
import { generateStaffAttendancePDF } from '../../utils/pdfGenerator';

interface AttendanceRecord {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherEmail?: string;
  date: string;
  checkInTime?: any;
  checkOutTime?: any;
  checkInDistance?: number;
  checkOutDistance?: number;
  status: string; // 'On Time' | 'Late' | 'Absent'
  hasPermission?: boolean;
  permissionReason?: string;
  permissionType?: 'with_permission' | 'without_permission';
}

interface TeacherStats {
  teacherId: string;
  teacherName: string;
  teacherEmail?: string;
  onTimeCount: number;
  lateCount: number;
  absentCount: number;
  excusedCount: number;
  unexcusedCount: number;
  holidayCount: number;
  totalDays: number;
}

interface TeacherWeeklyDayStats {
  teacherId: string;
  teacherName: string;
  teacherEmail?: string;
  days: {
    name: string; // 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'
    date: string; // YYYY-MM-DD
    status: 'Present' | 'Late' | 'Holiday' | 'Not Logged';
  }[];
}

interface StaffUser {
  id: string;
  name: string;
  email: string;
  categoryOrder?: number;
}

export default function TeacherAttendanceLogsScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [allStaff, setAllStaff] = useState<StaffUser[]>([]);
  const [timeFilter, setTimeFilter] = useState<'day' | 'week' | 'month' | 'term'>('month');
  const [selectedDate, setSelectedDate] = useState<string>(moment().format('YYYY-MM-DD'));
  const [viewMode, setViewMode] = useState<'daily' | 'summary'>('daily');

  // Holidays state
  const [holidays, setHolidays] = useState<{ date: string; title: string }[]>([]);

  // Permission Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [permissionType, setPermissionType] = useState<'with_permission' | 'without_permission'>('with_permission');
  const [permissionReason, setPermissionReason] = useState('');
  const [updating, setUpdating] = useState(false);

  const schoolId = (Constants.expoConfig?.extra?.schoolId || SCHOOL_CONFIG.schoolId || 'school').toLowerCase();
  const primary = SCHOOL_CONFIG.primaryColor || COLORS.primary;

  useEffect(() => {
    fetchAttendanceLogs();
  }, []);

  const fetchAttendanceLogs = async () => {
    setLoading(true);
    try {
      // 1. Fetch holidays from config
      const configRef = doc(db, 'teacherAttendanceConfig', schoolId);
      const configSnap = await getDoc(configRef);
      let activeHolidays = holidays;
      if (configSnap.exists()) {
        const cData = configSnap.data();
        if (cData.holidays && Array.isArray(cData.holidays)) {
          activeHolidays = cData.holidays;
          setHolidays(activeHolidays);
        }
      }

      // Helper for checking holidays
      const isHoliday = (dateStr: string) => {
        const check = moment(dateStr, 'YYYY-MM-DD');
        return activeHolidays.some(h => {
          if (h.date && h.date === dateStr) return true;
          const s = (h as any).startDate || h.date;
          const e = (h as any).endDate || h.date;
          if (s && e) {
            return check.isBetween(moment(s, 'YYYY-MM-DD'), moment(e, 'YYYY-MM-DD'), 'day', '[]');
          }
          return false;
        });
      };

      // 2. Fetch all staff members for complete log reporting
      const staffQ = query(collection(db, 'users'), where('role', 'in', ['teacher', 'admin', 'superadmin', 'staff']));
      const staffSnap = await getDocs(staffQ);

      const staffList: StaffUser[] = [];
      staffSnap.forEach((staffDoc) => {
        const sData = staffDoc.data();
        const sId = staffDoc.id;
        const sName = `${sData.profile?.firstName || ''} ${sData.profile?.lastName || ''}`.trim() || sData.fullName || 'Staff Member';
        const sEmail = sData.profile?.email || sData.email || '';
        const role = (sData.role || '').toLowerCase();
        const adminRole = sData.adminRole || sData.profile?.adminRole;

        let categoryOrder = 3; // Non-teaching staff last
        if (role === 'teacher' || role.includes('teacher')) {
          categoryOrder = 1; // Teaching staff first
        } else if (role === 'admin' || role.includes('admin') || role === 'superadmin' || adminRole) {
          categoryOrder = 2; // Admins second
        } else if (role === 'staff') {
          categoryOrder = 3; // Non-teaching staff last
        }

        staffList.push({ id: sId, name: sName, email: sEmail, categoryOrder });
      });

      staffList.sort((a, b) => (a.categoryOrder || 3) - (b.categoryOrder || 3) || a.name.localeCompare(b.name));
      setAllStaff(staffList);

      // Auto-mark absent after 4 PM (16:00) if no attendance taken
      const todayStr = moment().format('YYYY-MM-DD');
      const currentHour = moment().hour();
      const dayOfWeek = moment().day(); // 1 = Mon, 5 = Fri
      const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
      const isHolidayToday = isHoliday(todayStr);

      if (currentHour >= 16 && isWeekday && !isHolidayToday) {
        // Fetch existing attendance records for today
        const existingQ = query(collection(db, 'teacherAttendance'), where('date', '==', todayStr));
        const existingSnap = await getDocs(existingQ);
        const loggedTeacherIds = new Set(existingSnap.docs.map(d => d.data().teacherId));

        const batch = writeBatch(db);
        let batchCount = 0;

        staffList.forEach((st) => {
          if (!loggedTeacherIds.has(st.id)) {
            const newDocRef = doc(collection(db, 'teacherAttendance'));
            batch.set(newDocRef, {
              teacherId: st.id,
              teacherName: st.name,
              teacherEmail: st.email,
              date: todayStr,
              status: 'Absent',
              hasPermission: false,
              permissionType: 'without_permission',
              permissionReason: 'Automatically marked absent (No check-in recorded by 4:00 PM)',
              createdAt: serverTimestamp(),
            });
            batchCount++;
          }
        });

        if (batchCount > 0) {
          await batch.commit();
        }
      }

      // 3. Fetch logs
      const q = query(collection(db, 'teacherAttendance'), orderBy('date', 'desc'));
      const snap = await getDocs(q);
      const list: AttendanceRecord[] = [];

      snap.forEach((d) => {
        const data = d.data();
        const dateStr = data.date || moment().format('YYYY-MM-DD');

        list.push({
          id: d.id,
          teacherId: data.teacherId,
          teacherName: data.teacherName || 'Unknown Teacher',
          teacherEmail: data.teacherEmail || '',
          date: dateStr,
          checkInTime: data.checkInTime,
          checkOutTime: data.checkOutTime,
          checkInDistance: data.checkInDistance || 0,
          checkOutDistance: data.checkOutDistance || 0,
          status: data.status || 'On Time',
          hasPermission: data.hasPermission || false,
          permissionReason: data.permissionReason || '',
          permissionType: data.permissionType || 'without_permission',
        });
      });

      setRecords(list);
    } catch (err) {
      console.error('Error fetching teacher attendance logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkIsHolidayDate = (dateStr: string) => {
    const check = moment(dateStr, 'YYYY-MM-DD');
    return holidays.some(h => {
      if (h.date && h.date === dateStr) return true;
      const s = (h as any).startDate || h.date;
      const e = (h as any).endDate || h.date;
      if (s && e) {
        return check.isBetween(moment(s, 'YYYY-MM-DD'), moment(e, 'YYYY-MM-DD'), 'day', '[]');
      }
      return false;
    });
  };

  const checkGetHolidayObj = (dateStr: string) => {
    const check = moment(dateStr, 'YYYY-MM-DD');
    return holidays.find(h => {
      if (h.date && h.date === dateStr) return true;
      const s = (h as any).startDate || h.date;
      const e = (h as any).endDate || h.date;
      if (s && e) {
        return check.isBetween(moment(s, 'YYYY-MM-DD'), moment(e, 'YYYY-MM-DD'), 'day', '[]');
      }
      return false;
    });
  };

  const isSelectedDateHoliday = checkIsHolidayDate(selectedDate);
  const selectedHolidayObj = checkGetHolidayObj(selectedDate);

  const handleToggleSelectedDateHoliday = async () => {
    let updatedHolidays: { date: string; title: string }[];
    if (isSelectedDateHoliday) {
      updatedHolidays = holidays.filter(h => h.date !== selectedDate);
      showToast({ message: `Removed holiday for ${selectedDate}`, type: 'success' });
    } else {
      updatedHolidays = [...holidays, { date: selectedDate, title: 'Official School Holiday' }];
      showToast({ message: `Declared ${selectedDate} as an Official Holiday! 🎉`, type: 'success' });
    }

    try {
      const configRef = doc(db, 'teacherAttendanceConfig', schoolId);
      await setDoc(configRef, { holidays: updatedHolidays }, { merge: true });
      setHolidays(updatedHolidays);
    } catch (err) {
      console.error('Error toggling holiday for selected date:', err);
      showToast({ message: 'Failed to update holiday.', type: 'error' });
    }
  };

  const buildWeeklyBreakdownData = () => {
    const getHoliday = (dateStr: string) => {
      const check = moment(dateStr, 'YYYY-MM-DD');
      return holidays.find(h => {
        if (h.date && h.date === dateStr) return true;
        const s = (h as any).startDate || h.date;
        const e = (h as any).endDate || h.date;
        if (s && e) {
          return check.isBetween(moment(s, 'YYYY-MM-DD'), moment(e, 'YYYY-MM-DD'), 'day', '[]');
        }
        return false;
      });
    };

    let rangeStart: moment.Moment;
    let rangeEnd: moment.Moment;

    const refDate = moment(selectedDate, 'YYYY-MM-DD').isValid() ? moment(selectedDate, 'YYYY-MM-DD') : moment();

    if (timeFilter === 'day' || timeFilter === 'week') {
      rangeStart = moment(refDate).startOf('isoWeek');
      rangeEnd = moment(refDate).endOf('isoWeek');
    } else if (timeFilter === 'month') {
      rangeStart = moment(refDate).startOf('month').startOf('isoWeek');
      rangeEnd = moment(refDate).endOf('month').endOf('isoWeek');
    } else {
      if (records.length > 0) {
        const sortedDates = records.map(r => r.date).filter(Boolean).sort();
        rangeStart = moment(sortedDates[0], 'YYYY-MM-DD').startOf('isoWeek');
        rangeEnd = moment(sortedDates[sortedDates.length - 1], 'YYYY-MM-DD').endOf('isoWeek');
      } else {
        rangeStart = moment(refDate).startOf('month').startOf('isoWeek');
        rangeEnd = moment(refDate).endOf('month').endOf('isoWeek');
      }
    }

    const recordsMap: Record<string, Record<string, AttendanceRecord>> = {};
    records.forEach(r => {
      if (!recordsMap[r.date]) recordsMap[r.date] = {};
      recordsMap[r.date][r.teacherId] = r;
    });

    const staffDict: Record<string, { id: string; name: string; email: string; categoryOrder?: number }> = {};
    allStaff.forEach(s => {
      staffDict[s.id] = { id: s.id, name: s.name, email: s.email || '', categoryOrder: s.categoryOrder || 3 };
    });
    records.forEach(r => {
      if (r.teacherId && !staffDict[r.teacherId]) {
        staffDict[r.teacherId] = {
          id: r.teacherId,
          name: r.teacherName || 'Staff Member',
          email: r.teacherEmail || '',
          categoryOrder: 3,
        };
      }
    });

    const staffList = Object.values(staffDict);
    staffList.sort((a: any, b: any) => (a.categoryOrder || 3) - (b.categoryOrder || 3) || a.name.localeCompare(b.name));

    const weeks: any[] = [];
    let currMon = moment(rangeStart);
    let weekIndex = 1;

    while (currMon.isBefore(rangeEnd)) {
      const mondayStr = currMon.format('YYYY-MM-DD');
      const fridayDate = moment(currMon).add(4, 'days');
      const fridayStr = fridayDate.format('YYYY-MM-DD');

      const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((dayName, idx) => {
        const d = moment(currMon).add(idx, 'days');
        const dStr = d.format('YYYY-MM-DD');
        const hol = getHoliday(dStr);
        return {
          dayName,
          date: dStr,
          formattedDate: d.format('MMM DD'),
          isHoliday: Boolean(hol),
          holidayTitle: hol?.title || undefined,
        };
      });

      const weekHolidays = weekDays.filter(wd => wd.isHoliday).map(wd => ({
        date: wd.date,
        title: wd.holidayTitle || 'Holiday / Break',
      }));

      const staffLogs = staffList.map(st => {
        const dailyLogs: Record<string, any> = {};

        weekDays.forEach(wd => {
          const rec = recordsMap[wd.date]?.[st.id];
          const hol = getHoliday(wd.date);

          if (hol) {
            dailyLogs[wd.date] = {
              date: wd.date,
              dayName: wd.dayName,
              status: 'Holiday',
              isHoliday: true,
              holidayTitle: hol.title,
            };
          } else if (rec) {
            const inTime = rec.checkInTime
              ? moment.utc(rec.checkInTime.toDate?.() || rec.checkInTime).format('hh:mm A')
              : undefined;
            const outTime = rec.checkOutTime
              ? moment.utc(rec.checkOutTime.toDate?.() || rec.checkOutTime).format('hh:mm A')
              : undefined;

            let status: 'On Time' | 'Late' | 'Absent' | 'Excused' = 'On Time';
            if (rec.hasPermission) {
              status = 'Excused';
            } else if (rec.status === 'Late') {
              status = 'Late';
            } else if (rec.status === 'Absent') {
              status = 'Absent';
            }

            dailyLogs[wd.date] = {
              date: wd.date,
              dayName: wd.dayName,
              status,
              checkInTime: inTime,
              checkOutTime: outTime,
              permissionReason: rec.permissionReason,
            };
          } else {
            const isPast = moment(wd.date, 'YYYY-MM-DD').isSameOrBefore(moment(), 'day');
            dailyLogs[wd.date] = {
              date: wd.date,
              dayName: wd.dayName,
              status: isPast ? 'Absent' : 'Not Logged',
            };
          }
        });

        return {
          teacherId: st.id,
          teacherName: st.name,
          teacherEmail: st.email,
          dailyLogs,
        };
      });

      weeks.push({
        weekLabel: `WEEK ${weekIndex}: ${moment(mondayStr).format('MMM DD, YYYY')} - ${moment(fridayStr).format('MMM DD, YYYY')}`,
        startDate: mondayStr,
        endDate: fridayStr,
        holidays: weekHolidays,
        days: weekDays,
        staffLogs,
      });

      currMon.add(1, 'week');
      weekIndex++;
    }

    return weeks;
  };

  const handleExportAttendancePDF = async () => {
    try {
      const overallStats = getTeacherStatsMap();
      const weeks = buildWeeklyBreakdownData();

      const pdfData = {
        timeFilter,
        generatedAt: moment().format('YYYY-MM-DD hh:mm A'),
        weeks,
        overallStats,
      };

      await generateStaffAttendancePDF(
        pdfData,
        SCHOOL_CONFIG.fullName || SCHOOL_CONFIG.name || 'EduEaz School',
        SCHOOL_CONFIG.hotline || '',
        SCHOOL_CONFIG.email || '',
        SCHOOL_CONFIG.address || '',
        getSchoolLogo(SCHOOL_CONFIG.schoolId),
      );

      showToast({ message: 'Detailed staff attendance PDF exported successfully!', type: 'success' });
    } catch (err) {
      console.error('Error generating attendance PDF:', err);
      showToast({ message: 'Failed to export attendance PDF.', type: 'error' });
    }
  };

  const blurActiveElement = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      (document.activeElement as HTMLElement)?.blur();
    }
  };

  const handleOpenPermissionModal = (record: AttendanceRecord) => {
    blurActiveElement();
    setSelectedRecord(record);
    setPermissionType(record.permissionType || 'with_permission');
    setPermissionReason(record.permissionReason || '');
    setModalVisible(true);
  };

  const closeModal = () => {
    blurActiveElement();
    setModalVisible(false);
  };

  const handleSavePermission = async () => {
    if (!selectedRecord) return;

    setUpdating(true);
    try {
      const docRef = doc(db, 'teacherAttendance', selectedRecord.id);
      const updatePayload = {
        hasPermission: permissionType === 'with_permission',
        permissionType,
        permissionReason: permissionReason.trim(),
        updatedAt: serverTimestamp(),
      };

      await updateDoc(docRef, updatePayload);
      showToast({ message: 'Attendance permission details updated successfully!', type: 'success' });
      closeModal();
      fetchAttendanceLogs();
    } catch (err) {
      console.error('Error updating permission:', err);
      showToast({ message: 'Failed to update permission details.', type: 'error' });
    } finally {
      setUpdating(false);
    }
  };

  const getFilteredRecordsForStats = () => {
    const now = moment();
    return records.filter((r) => {
      const rDate = moment(r.date);
      if (timeFilter === 'day') {
        return r.date === selectedDate;
      } else if (timeFilter === 'week') {
        return rDate.isSame(now, 'week');
      } else if (timeFilter === 'month') {
        return rDate.isSame(now, 'month');
      } else {
        return rDate.isSame(now, 'year');
      }
    });
  };

  const getTeacherStatsMap = (): TeacherStats[] => {
    const weeks = buildWeeklyBreakdownData();
    const statsMap: Record<string, TeacherStats> = {};
    const todayStr = moment().format('YYYY-MM-DD');

    weeks.forEach((week) => {
      week.staffLogs.forEach((st: any) => {
        const tid = st.teacherId || 'unknown';
        if (!statsMap[tid]) {
          statsMap[tid] = {
            teacherId: tid,
            teacherName: st.teacherName,
            teacherEmail: st.teacherEmail,
            onTimeCount: 0,
            lateCount: 0,
            absentCount: 0,
            excusedCount: 0,
            unexcusedCount: 0,
            holidayCount: 0,
            totalDays: 0,
          };
        }

        week.days.forEach((wd: any) => {
          // Only evaluate working days up to today
          if (moment(wd.date, 'YYYY-MM-DD').isAfter(moment(todayStr, 'YYYY-MM-DD'), 'day')) return;

          const log = st.dailyLogs[wd.date];
          if (!log) return;

          if (log.status === 'Holiday') {
            statsMap[tid].holidayCount += 1;
          } else {
            statsMap[tid].totalDays += 1;

            if (log.status === 'On Time') {
              statsMap[tid].onTimeCount += 1;
            } else if (log.status === 'Late') {
              statsMap[tid].lateCount += 1;
            } else if (log.status === 'Excused') {
              statsMap[tid].excusedCount += 1;
            } else if (log.status === 'Absent') {
              statsMap[tid].absentCount += 1;
            }
          }
        });
      });
    });

    const statsList = Object.values(statsMap);
    const categoryMap = new Map(allStaff.map(s => [s.id, s.categoryOrder || 3]));
    statsList.sort((a, b) => {
      const catA = categoryMap.get(a.teacherId) || 3;
      const catB = categoryMap.get(b.teacherId) || 3;
      return catA - catB || a.teacherName.localeCompare(b.teacherName);
    });
    return statsList;
  };

  const currentStatsList = getTeacherStatsMap();
  const dailyFilteredRecords = records.filter((r) => r.date === selectedDate);

  const getWeeklyDaysStatsList = (): TeacherWeeklyDayStats[] => {
    const startOfWeek = moment().startOf('isoWeek'); // Monday
    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((name, index) => {
      const d = moment(startOfWeek).add(index, 'days');
      return { name, date: d.format('YYYY-MM-DD') };
    });

    const teacherMap: Record<string, TeacherWeeklyDayStats> = {};

    const filtered = getFilteredRecordsForStats();
    filtered.forEach((r) => {
      const tid = r.teacherId || 'unknown';
      if (!teacherMap[tid]) {
        teacherMap[tid] = {
          teacherId: tid,
          teacherName: r.teacherName,
          teacherEmail: r.teacherEmail,
          days: weekDays.map(wd => ({
            name: wd.name,
            date: wd.date,
            status: checkIsHolidayDate(wd.date) ? 'Holiday' : 'Not Logged',
          })),
        };
      }

      const dayObj = teacherMap[tid].days.find(d => d.date === r.date);
      if (dayObj) {
        dayObj.status = r.status === 'Late' ? 'Late' : 'Present';
      }
    });

    currentStatsList.forEach(stat => {
      if (!teacherMap[stat.teacherId]) {
        teacherMap[stat.teacherId] = {
          teacherId: stat.teacherId,
          teacherName: stat.teacherName,
          teacherEmail: stat.teacherEmail,
          days: weekDays.map(wd => ({
            name: wd.name,
            date: wd.date,
            status: checkIsHolidayDate(wd.date) ? 'Holiday' : 'Not Logged',
          })),
        };
      }
    });

    return Object.values(teacherMap);
  };

  const renderSummaryItem = ({ item }: { item: TeacherStats }) => {
    const isWeek = timeFilter === 'week';
    const weeklyDaysMap = getWeeklyDaysStatsList();
    const weeklyDays = isWeek ? weeklyDaysMap.find(w => w.teacherId === item.teacherId)?.days : null;

    return (
      <View style={styles.recordCard}>
        <View style={styles.recordHeader}>
          <View style={styles.teacherInfo}>
            <View style={[styles.avatarBox, { backgroundColor: primary + '20' }]}>
              <Text style={[styles.avatarText, { color: primary }]}>
                {item.teacherName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.teacherName}>{item.teacherName}</Text>
              {item.teacherEmail ? <Text style={styles.teacherEmail}>{item.teacherEmail}</Text> : null}
            </View>
          </View>
        </View>

        {isWeek && weeklyDays ? (
          <View style={styles.weeklyDaysRow}>
            {weeklyDays.map(wd => {
              const bg = wd.status === 'Present' ? '#ecfdf5' : wd.status === 'Late' ? '#fffbeb' : wd.status === 'Holiday' ? '#e0f2fe' : '#f1f5f9';
              const fg = wd.status === 'Present' ? '#059669' : wd.status === 'Late' ? '#d97706' : wd.status === 'Holiday' ? '#0284c7' : '#94a3b8';
              return (
                <View key={wd.name} style={[styles.dayBadge, { backgroundColor: bg }]}>
                  <Text style={[styles.dayBadgeName, { color: fg }]}>{wd.name}</Text>
                  <Text style={[styles.dayBadgeStatus, { color: fg }]}>
                    {wd.status === 'Present' ? '✓' : wd.status === 'Late' ? '⏱' : wd.status === 'Holiday' ? '🎉' : '—'}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.statsRow}>
            <View style={[styles.statBox, { backgroundColor: '#ecfdf5' }]}>
              <Text style={[styles.statNumber, { color: '#059669' }]}>{item.onTimeCount}</Text>
              <Text style={styles.statLabel}>On Time</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: '#fffbeb' }]}>
              <Text style={[styles.statNumber, { color: '#d97706' }]}>{item.lateCount}</Text>
              <Text style={styles.statLabel}>Late</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: '#fef2f2' }]}>
              <Text style={[styles.statNumber, { color: '#dc2626' }]}>{item.absentCount}</Text>
              <Text style={styles.statLabel}>Absent</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: '#eff6ff' }]}>
              <Text style={[styles.statNumber, { color: '#2563eb' }]}>{item.excusedCount}</Text>
              <Text style={styles.statLabel}>Excused</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderDailyItem = ({ item }: { item: AttendanceRecord }) => {
    const checkInFormatted = item.checkInTime
      ? moment.utc(item.checkInTime.toDate?.() || item.checkInTime).format('hh:mm A')
      : 'Not Logged In';

    const checkOutFormatted = item.checkOutTime
      ? moment.utc(item.checkOutTime.toDate?.() || item.checkOutTime).format('hh:mm A')
      : 'Not Logged Out';

    const isLate = item.status === 'Late';
    const showPermissionTag = isLate || item.hasPermission || Boolean(item.permissionReason?.trim());

    return (
      <TouchableOpacity
        style={styles.recordCard}
        onPress={() => handleOpenPermissionModal(item)}
        activeOpacity={0.8}
      >
        <View style={styles.recordHeader}>
          <View style={styles.teacherInfo}>
            <View style={[styles.avatarBox, { backgroundColor: primary + '20' }]}>
              <Text style={[styles.avatarText, { color: primary }]}>
                {item.teacherName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.teacherName}>{item.teacherName}</Text>
              {Boolean(item.teacherEmail) && <Text style={styles.teacherEmail}>{item.teacherEmail}</Text>}
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: isLate ? '#fffbeb' : '#ecfdf5' }]}>
            <SVGIcon name={isLate ? 'warning' : 'checkmark-circle'} size={14} color={isLate ? '#d97706' : '#059669'} />
            <Text style={[styles.statusText, { color: isLate ? '#d97706' : '#059669' }]}>{item.status}</Text>
          </View>
        </View>

        <View style={styles.recordDetails}>
          <View style={styles.detailItem}>
            <SVGIcon name="log-in" size={14} color="#059669" />
            <Text style={styles.detailText}>
              <Text>Log In: </Text>
              <Text style={styles.boldText}>{checkInFormatted}</Text>
            </Text>
          </View>
          <View style={styles.detailItem}>
            <SVGIcon name="log-out" size={14} color="#d97706" />
            <Text style={styles.detailText}>
              <Text>Log Out: </Text>
              <Text style={styles.boldText}>{checkOutFormatted}</Text>
            </Text>
          </View>

          {showPermissionTag && (
            <View style={[styles.permissionIndicator, item.hasPermission ? styles.permittedBox : styles.unpermittedBox]}>
              <SVGIcon
                name={item.hasPermission ? 'checkmark-circle' : 'close-circle'}
                size={14}
                color={item.hasPermission ? '#059669' : '#dc2626'}
              />
              <Text style={[styles.permissionText, { color: item.hasPermission ? '#059669' : '#dc2626' }]}>
                {item.hasPermission ? 'With Permission' : 'Late / Without Permission'}
                {Boolean(item.permissionReason) && `: "${item.permissionReason}"`}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={[styles.header, { backgroundColor: primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <SVGIcon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Staff Attendance & Stats</Text>
          <Text style={styles.headerSub}>Permissions & Absence Tracking</Text>
        </View>
        <TouchableOpacity
          style={styles.pdfHeaderBtn}
          onPress={handleExportAttendancePDF}
        >
          <SVGIcon name="document-text" size={18} color="#fff" />
          <Text style={styles.pdfHeaderText}>PDF</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.timeFilterBar}>
        {(['day', 'week', 'month', 'term'] as const).map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[styles.timeTab, timeFilter === filter && { backgroundColor: primary }]}
            onPress={() => setTimeFilter(filter)}
          >
            <Text style={[styles.timeTabText, timeFilter === filter && { color: '#fff' }]}>
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.viewModeBar}>
        <TouchableOpacity
          style={[styles.modeTab, viewMode === 'daily' && { backgroundColor: primary }]}
          onPress={() => setViewMode('daily')}
        >
          <Text style={[styles.modeTabText, viewMode === 'daily' && { color: '#fff' }]}>Daily Logs</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeTab, viewMode === 'summary' && { backgroundColor: primary }]}
          onPress={() => setViewMode('summary')}
        >
          <Text style={[styles.modeTabText, viewMode === 'summary' && { color: '#fff' }]}>Summary Statistics</Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'daily' && (
        <View style={styles.dateSelectorBar}>
          <TouchableOpacity
            style={[styles.dateTab, selectedDate === moment().format('YYYY-MM-DD') && { backgroundColor: primary }]}
            onPress={() => setSelectedDate(moment().format('YYYY-MM-DD'))}
          >
            <Text
              style={[
                styles.dateTabText,
                selectedDate === moment().format('YYYY-MM-DD') && { color: '#fff' },
              ]}
            >
              Today ({moment().format('MMM D')})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dateTab}>
            <Text style={styles.dateTabText}>Records: {dailyFilteredRecords.length}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.holidayToggleBtn,
              isSelectedDateHoliday && { backgroundColor: '#e0f2fe', borderColor: '#0284c7' },
            ]}
            onPress={handleToggleSelectedDateHoliday}
          >
            <SVGIcon name="calendar" size={14} color={isSelectedDateHoliday ? '#0284c7' : '#64748b'} />
            <Text style={[styles.holidayToggleText, isSelectedDateHoliday && { color: '#0284c7' }]}>
              {isSelectedDateHoliday ? `🎉 ${selectedHolidayObj?.title || 'Holiday'}` : '+ Declare Holiday'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={primary} />
        </View>
      ) : viewMode === 'daily' ? (
        dailyFilteredRecords.length === 0 ? (
          <View style={styles.emptyContainer}>
            <SVGIcon name="checkmark-circle" size={48} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>
              {isSelectedDateHoliday ? `🎉 Official Holiday: ${selectedHolidayObj?.title || 'School Closed'}` : `No Attendance Records for ${selectedDate}`}
            </Text>
            {isSelectedDateHoliday && (
              <Text style={styles.emptySub}>Staff members are excused from attendance check-in on this day.</Text>
            )}
          </View>
        ) : (
          <FlatList
            data={dailyFilteredRecords}
            keyExtractor={(item) => item.id}
            renderItem={renderDailyItem}
            contentContainerStyle={styles.listContent}
          />
        )
      ) : (
        currentStatsList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <SVGIcon name="analytics" size={48} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No Statistics Available for this {timeFilter}</Text>
          </View>
        ) : (
          <FlatList
            data={currentStatsList}
            keyExtractor={(item) => item.teacherId}
            renderItem={renderSummaryItem}
            contentContainerStyle={styles.listContent}
          />
        )
      )}

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Manage Teacher Permission</Text>
            <Text style={styles.modalSub}>
              {selectedRecord?.teacherName} — {selectedRecord?.date}
            </Text>

            <Text style={styles.label}>Permission Status</Text>
            <View style={styles.permissionToggleRow}>
              <TouchableOpacity
                style={[
                  styles.permissionToggleBtn,
                  permissionType === 'with_permission' && { backgroundColor: '#059669' },
                ]}
                onPress={() => setPermissionType('with_permission')}
              >
                <Text
                  style={[
                    styles.permissionToggleText,
                    permissionType === 'with_permission' && { color: '#fff' },
                  ]}
                >
                  With Permission (Excused)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.permissionToggleBtn,
                  permissionType === 'without_permission' && { backgroundColor: '#dc2626' },
                ]}
                onPress={() => setPermissionType('without_permission')}
              >
                <Text
                  style={[
                    styles.permissionToggleText,
                    permissionType === 'without_permission' && { color: '#fff' },
                  ]}
                >
                  Without Permission
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Permission Reason / Exact Details</Text>
            <TextInput
              style={styles.textArea}
              placeholder="e.g. Medical appointment, family emergency, traffic delay..."
              placeholderTextColor="#94a3b8"
              value={permissionReason}
              onChangeText={setPermissionReason}
              multiline
              numberOfLines={4}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={closeModal}
                disabled={updating}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, { backgroundColor: primary }]}
                onPress={handleSavePermission}
                disabled={updating}
              >
                {updating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...SHADOWS.small,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: '600', marginTop: 2 },
  pdfHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  pdfHeaderText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  timeFilterBar: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 8,
    justifyContent: 'center',
  },
  timeTab: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  timeTabText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  viewModeBar: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 10,
    justifyContent: 'center',
  },
  modeTab: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  modeTabText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  dateSelectorBar: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#F8FAFC',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  dateTab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#e2e8f0',
  },
  dateTabText: { fontSize: 12, fontWeight: '600', color: '#334155' },
  holidayToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    gap: 6,
  },
  holidayToggleText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16, paddingBottom: 40 },
  recordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  teacherInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontWeight: '700', fontSize: 16 },
  teacherName: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  teacherEmail: { fontSize: 12, color: '#64748b' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    gap: 4,
  },
  statusText: { fontSize: 12, fontWeight: '600' },
  recordDetails: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
    gap: 6,
  },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText: { fontSize: 13, color: '#475569', fontWeight: '500' },
  boldText: { fontWeight: '700', color: '#0f172a' },
  permissionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginTop: 6,
    gap: 6,
  },
  permittedBox: { backgroundColor: '#ecfdf5' },
  unpermittedBox: { backgroundColor: '#fef2f2' },
  permissionText: { fontSize: 12, fontWeight: '600' },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  statNumber: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  statLabel: { fontSize: 10, fontWeight: '600', color: '#475569' },
  weeklyDaysRow: {
    flexDirection: 'row',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
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
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#334155', marginTop: 12, textAlign: 'center' },
  emptySub: { fontSize: 13, color: '#64748b', marginTop: 6, textAlign: 'center' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 450,
    ...SHADOWS.medium,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  modalSub: { fontSize: 14, color: '#64748b', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 8 },
  permissionToggleRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  permissionToggleBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  permissionToggleText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  textArea: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    textAlignVertical: 'top',
    height: 100,
    marginBottom: 20,
  },
  modalBtnRow: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: '#475569' },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 10,
  },
  modalSaveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
