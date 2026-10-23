import { useRouter } from "expo-router";
import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
  Alert,
  Platform,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Modal,
} from "react-native";
import { COLORS, SHADOWS, SIZES } from "../../constants/theme";
import { useTheme } from "../../contexts/ThemeContext";
import { useToast } from "../../contexts/ToastContext";
import { signOut } from "firebase/auth";
import { auth, db } from "../../firebaseConfig";
import SVGIcon from "../../components/SVGIcon";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  getDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import moment from "moment";
import { useFinanceCleanup } from "../../hooks/admin-dashboard/useFinanceCleanup";
import { repairMissingSignupCodes } from "../../scratch/repair_signup_codes";
import { broadcastFeeReminders } from "../../src/services/feeReminderService";
import { SCHOOL_CONFIG } from "../../constants/Config";
import Constants from "expo-constants";
import { SchoolHolidayItem, OperationalType } from "../../hooks/useSchoolOperations";

const DateTimePicker = Platform.OS !== 'web' ? require('@react-native-community/datetimepicker').default : null;

type DatePickerTarget = 'vacationNextTerm' | 'midTermStart' | 'midTermEnd' | 'holidayDate' | 'holidayStart' | 'holidayEnd' | null;

export default function AdminSettingsScreen() {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const router = useRouter();

  const [isCleaning, setIsCleaning] = useState(false);
  const [repairLoading, setRepairLoading] = useState(false);
  const [unifyLoading, setUnifyLoading] = useState(false);
  const [cfLoading, setCfLoading] = useState<Record<string, boolean>>({});
  const isMounted = useRef(true);
  const isNavigating = useRef(false);

  // Operational Switches State
  const [activeOverride, setActiveOverride] = useState<OperationalType>('open');
  const [overrideTitle, setOverrideTitle] = useState('');
  const [unlockDate, setUnlockDate] = useState('');
  const [savingOperations, setSavingOperations] = useState(false);

  // Scheduled Holidays / Off-Days List
  const [holidays, setHolidays] = useState<SchoolHolidayItem[]>([]);
  const [deletingHolidayId, setDeletingHolidayId] = useState<string | null>(null);

  // Modal states for Off-Day triggers & Advance Scheduling
  const [modalMode, setModalMode] = useState<'none' | 'holiday' | 'mid_term' | 'vacation' | 'off_day'>('none');
  const [holidayDateType, setHolidayDateType] = useState<'single' | 'range'>('single');
  const [vacationNextTermBegins, setVacationNextTermBegins] = useState('');
  const [midTermStartDate, setMidTermStartDate] = useState(moment().format('YYYY-MM-DD'));
  const [midTermEndDate, setMidTermEndDate] = useState(moment().add(5, 'days').format('YYYY-MM-DD'));
  const [holidayDate, setHolidayDate] = useState(moment().format('YYYY-MM-DD'));
  const [holidayStartDate, setHolidayStartDate] = useState(moment().format('YYYY-MM-DD'));
  const [holidayEndDate, setHolidayEndDate] = useState(moment().format('YYYY-MM-DD'));
  const [modalTitleInput, setModalTitleInput] = useState('');
  const [activateImmediately, setActivateImmediately] = useState(false);

  // DatePicker state
  const [activeDatePickerTarget, setActiveDatePickerTarget] = useState<DatePickerTarget>(null);
  const [activeDatePickerDate, setActiveDatePickerDate] = useState<Date>(new Date());

  const schoolId = (Constants.expoConfig?.extra?.schoolId || SCHOOL_CONFIG.schoolId || 'school').toLowerCase();

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    fetchOperationsConfig();
  }, [schoolId]);

  const fetchOperationsConfig = async () => {
    try {
      const snap = await getDoc(doc(db, 'teacherAttendanceConfig', schoolId));
      if (snap.exists() && isMounted.current) {
        const data = snap.data();
        if (data.activeOverride) setActiveOverride(data.activeOverride);
        if (data.overrideTitle) setOverrideTitle(data.overrideTitle);
        if (data.unlockDate) setUnlockDate(data.unlockDate);
        if (Array.isArray(data.holidays)) setHolidays(data.holidays);
      }

      // Also fetch nextTermBegins from academic_config
      const acadSnap = await getDoc(doc(db, 'school_settings', 'academic_config'));
      if (acadSnap.exists() && isMounted.current) {
        const aData = acadSnap.data();
        if (aData.nextTermBegins) {
          setVacationNextTermBegins(aData.nextTermBegins.toString().trim());
        }
      }
    } catch (e) {
      console.error('Error fetching operations config in settings:', e);
    }
  };

  const openDatePicker = (target: DatePickerTarget, currentVal: string) => {
    const parsed = moment(currentVal, 'YYYY-MM-DD');
    const d = parsed.isValid() ? parsed.toDate() : new Date();
    setActiveDatePickerDate(d);
    setActiveDatePickerTarget(target);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setActiveDatePickerTarget(null);
    }
    if (selectedDate && activeDatePickerTarget) {
      const formatted = moment(selectedDate).format('YYYY-MM-DD');
      if (activeDatePickerTarget === 'vacationNextTerm') {
        setVacationNextTermBegins(formatted);
      } else if (activeDatePickerTarget === 'midTermStart') {
        setMidTermStartDate(formatted);
      } else if (activeDatePickerTarget === 'midTermEnd') {
        setMidTermEndDate(formatted);
      } else if (activeDatePickerTarget === 'holidayDate') {
        setHolidayDate(formatted);
      } else if (activeDatePickerTarget === 'holidayStart') {
        setHolidayStartDate(formatted);
      } else if (activeDatePickerTarget === 'holidayEnd') {
        setHolidayEndDate(formatted);
      }
      setActiveDatePickerDate(selectedDate);
    }
  };

  const renderDateField = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    target: DatePickerTarget
  ) => {
    const isValid = Boolean(value) && moment(value, 'YYYY-MM-DD', true).isValid();
    const formattedDisplay = isValid
      ? moment(value, 'YYYY-MM-DD').format('ddd, MMM D, YYYY')
      : 'Select Date 📅';

    return (
      <View style={{ marginBottom: 12 }}>
        <Text style={styles.inputLabel}>{label}</Text>
        {Platform.OS === 'web' ? (
          <View style={styles.webDateRow}>
            <TouchableOpacity
              style={styles.datePickerBtn}
              onPress={() => openDatePicker(target, value)}
            >
              <SVGIcon name="calendar-outline" size={18} color={COLORS.primary} />
              <Text style={styles.datePickerBtnText}>
                {formattedDisplay} <Text style={{ fontSize: 11, color: '#64748b' }}>({value || 'YYYY-MM-DD'})</Text>
              </Text>
            </TouchableOpacity>
            <input
              type="date"
              value={value}
              onChange={(e) => {
                if (e.target.value) {
                  onChangeText(e.target.value);
                }
              }}
              style={webDateInputStyle}
            />
          </View>
        ) : (
          <TouchableOpacity
            style={styles.datePickerBtn}
            onPress={() => openDatePicker(target, value)}
          >
            <SVGIcon name="calendar-outline" size={18} color={COLORS.primary} />
            <Text style={styles.datePickerBtnText}>
              {formattedDisplay} <Text style={{ fontSize: 11, color: '#64748b' }}>({value || 'YYYY-MM-DD'})</Text>
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const { cleaning: isFinanceCleaning, runCleanup: runFinanceCleanup, report: financeReport } = useFinanceCleanup(showToast);

  const openTriggerModal = async (type: 'holiday' | 'mid_term' | 'vacation' | 'off_day') => {
    setModalMode(type);
    const todayStr = moment().format('YYYY-MM-DD');

    if (type === 'vacation') {
      setModalTitleInput(overrideTitle || 'School Vacation / Term Break');
      setHolidayDateType('range');
      setHolidayStartDate(todayStr);
      try {
        const acadSnap = await getDoc(doc(db, 'school_settings', 'academic_config'));
        if (acadSnap.exists() && acadSnap.data()?.nextTermBegins) {
          const nextTerm = acadSnap.data().nextTermBegins.toString().trim();
          setVacationNextTermBegins(nextTerm);
          setHolidayEndDate(nextTerm);
        } else {
          setHolidayEndDate(moment().add(1, 'month').format('YYYY-MM-DD'));
        }
      } catch (e) {
        console.error(e);
      }
    } else if (type === 'mid_term') {
      setModalTitleInput('Mid-Term Break');
      setHolidayDateType('range');
      setMidTermStartDate(todayStr);
      setMidTermEndDate(moment().add(5, 'days').format('YYYY-MM-DD'));
      setHolidayStartDate(todayStr);
      setHolidayEndDate(moment().add(5, 'days').format('YYYY-MM-DD'));
    } else if (type === 'holiday' || type === 'off_day') {
      setModalTitleInput('Public / School Holiday');
      setHolidayDateType('single');
      setHolidayDate(todayStr);
      setHolidayStartDate(todayStr);
      setHolidayEndDate(todayStr);
    }
    setActivateImmediately(false);
  };

  const handleSaveHolidayOrBreak = async () => {
    if (!modalTitleInput.trim()) {
      showToast({ message: 'Please enter a title / reason for the off-day.', type: 'error' });
      return;
    }

    let start = '';
    let end = '';
    let itemType: OperationalType = 'holiday';

    if (modalMode === 'vacation') {
      itemType = 'vacation';
      start = holidayDateType === 'single' ? holidayDate : holidayStartDate;
      end = vacationNextTermBegins.trim();
      if (!end) {
        showToast({ message: 'Please set Next Term Begins date.', type: 'error' });
        return;
      }
    } else if (modalMode === 'mid_term') {
      itemType = 'mid_term';
      start = midTermStartDate.trim();
      end = midTermEndDate.trim();
      if (!start || !end) {
        showToast({ message: 'Please set start and end dates.', type: 'error' });
        return;
      }
    } else {
      itemType = 'holiday';
      if (holidayDateType === 'single') {
        start = holidayDate.trim();
        end = holidayDate.trim();
      } else {
        start = holidayStartDate.trim();
        end = holidayEndDate.trim();
      }
      if (!start) {
        showToast({ message: 'Please select valid off-day date(s).', type: 'error' });
        return;
      }
    }

    setSavingOperations(true);
    try {
      const calculatedUnlockDate = moment(end).add(1, 'day').format('YYYY-MM-DD');

      const newItem: SchoolHolidayItem = {
        id: `hol_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        title: modalTitleInput.trim(),
        type: itemType,
        date: start,
        startDate: start,
        endDate: end,
      };

      // Filter existing item with exact same ID or duplicate date/range
      const updatedHolidays = [
        ...holidays.filter(h => (h.id && h.id !== newItem.id) || (!h.id && h.date !== newItem.date)),
        newItem
      ];

      const todayStr = moment().format('YYYY-MM-DD');
      const isTodayInWindow = moment(todayStr).isBetween(moment(start), moment(end), 'day', '[]');
      const shouldActivateNow = activateImmediately || isTodayInWindow;

      const payload: any = {
        holidays: updatedHolidays,
        updatedAt: serverTimestamp(),
      };

      if (modalMode === 'vacation' && vacationNextTermBegins.trim()) {
        await setDoc(doc(db, 'school_settings', 'academic_config'), {
          nextTermBegins: vacationNextTermBegins.trim(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }

      if (shouldActivateNow) {
        payload.activeOverride = itemType;
        payload.overrideTitle = newItem.title;
        payload.startDate = start;
        payload.endDate = end;
        payload.unlockDate = calculatedUnlockDate;
      }

      await setDoc(doc(db, 'teacherAttendanceConfig', schoolId), payload, { merge: true });

      if (isMounted.current) {
        setHolidays(updatedHolidays);
        if (shouldActivateNow) {
          setActiveOverride(itemType);
          setOverrideTitle(newItem.title);
          setUnlockDate(calculatedUnlockDate);
        }
        setModalMode('none');

        const dateRangeStr = start === end ? start : `${start} to ${end}`;
        if (shouldActivateNow) {
          showToast({
            message: `🎉 Mode Activated for ${dateRangeStr}! App will auto-unlock on ${calculatedUnlockDate}.`,
            type: 'success',
          });
        } else {
          showToast({
            message: `📅 Scheduled ${newItem.title} for ${dateRangeStr}! It will automatically trigger on the due date.`,
            type: 'success',
          });
        }
      }
    } catch (err) {
      if (isMounted.current) {
        console.error('Error saving scheduled holiday:', err);
        showToast({ message: 'Failed to save off-day schedule.', type: 'error' });
      }
    } finally {
      if (isMounted.current) setSavingOperations(false);
    }
  };

  const handleDeleteHoliday = async (holidayItem: SchoolHolidayItem) => {
    const confirmMsg = `Remove scheduled off-day "${holidayItem.title}" (${holidayItem.startDate || holidayItem.date})?`;

    const performDelete = async () => {
      setDeletingHolidayId(holidayItem.id || holidayItem.date || 'delete');
      try {
        const updated = holidays.filter(h =>
          (holidayItem.id && h.id !== holidayItem.id) ||
          (!holidayItem.id && h.date !== holidayItem.date)
        );

        await setDoc(doc(db, 'teacherAttendanceConfig', schoolId), {
          holidays: updated,
          updatedAt: serverTimestamp(),
        }, { merge: true });

        if (isMounted.current) {
          setHolidays(updated);
          showToast({ message: `Removed off-day "${holidayItem.title}".`, type: 'success' });
        }
      } catch (err) {
        console.error('Error removing holiday:', err);
        showToast({ message: 'Failed to remove off-day.', type: 'error' });
      } finally {
        if (isMounted.current) setDeletingHolidayId(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMsg)) {
        performDelete();
      }
    } else {
      Alert.alert('Delete Scheduled Off-Day', confirmMsg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: performDelete }
      ]);
    }
  };

  const handleResetOperations = async () => {
    setSavingOperations(true);
    try {
      const payload = {
        activeOverride: 'open',
        overrideTitle: '',
        unlockDate: '',
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'teacherAttendanceConfig', schoolId), payload, { merge: true });

      if (isMounted.current) {
        setActiveOverride('open');
        setOverrideTitle('');
        setUnlockDate('');
        showToast({ message: '🟢 Normal School Operations Activated! Attendance & daily fees unlocked.', type: 'success' });
      }
    } catch (err) {
      if (isMounted.current) {
        console.error(err);
        showToast({ message: 'Failed to reset operations.', type: 'error' });
      }
    } finally {
      if (isMounted.current) setSavingOperations(false);
    }
  };

  const handleRepairSignupCodes = async () => {
    setRepairLoading(true);
    try {
      const count = await repairMissingSignupCodes();
      if (isMounted.current) {
        showToast({ message: `Successfully repaired ${count} signup/parent link codes.`, type: "success" });
      }
    } catch (err: any) {
      if (isMounted.current) {
        console.error(err);
        showToast({ message: "Repair failed. Check console.", type: "error" });
      }
    } finally {
      if (isMounted.current) {
        setRepairLoading(false);
      }
    }
  };

  const handleUnifySiblingLinkCodes = async () => {
    setUnifyLoading(true);
    try {
      const q = query(collection(db, "users"), where("role", "==", "student"));
      const snap = await getDocs(q);

      if (snap.empty) {
        showToast({ message: "No student accounts found.", type: "info" });
        return;
      }

      const familyMap = new Map<string, Array<{ id: string; code: string }>>();

      snap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const profile = data.profile || {};
        const parentPhone = (profile.parentPhone || "").trim();
        const parentName = (profile.parentName || "").trim().toLowerCase();
        const lastName = (profile.lastName || "").trim().toLowerCase();

        let familyKey = "";
        if (parentPhone.length >= 7) {
          familyKey = `phone_${parentPhone}`;
        } else if (parentName) {
          familyKey = `name_${parentName}_${lastName}`;
        }

        if (familyKey) {
          const current = familyMap.get(familyKey) || [];
          current.push({
            id: docSnap.id,
            code: data.parentLinkCode || "",
          });
          familyMap.set(familyKey, current);
        }
      });

      let updatedStudentsCount = 0;
      let unifiedFamiliesCount = 0;
      const batch = writeBatch(db);

      familyMap.forEach((students) => {
        if (students.length >= 2) {
          let masterCode = students.find((s) => s.code)?.code;
          if (!masterCode) {
            masterCode = Math.random().toString(36).substring(2, 8).toUpperCase();
          }

          let familyHasUpdates = false;
          students.forEach((student) => {
            if (student.code !== masterCode) {
              batch.update(doc(db, "users", student.id), {
                parentLinkCode: masterCode,
              });
              updatedStudentsCount++;
              familyHasUpdates = true;
            }
          });

          if (familyHasUpdates) {
            unifiedFamiliesCount++;
          }
        }
      });

      if (updatedStudentsCount > 0) {
        await batch.commit();
        if (isMounted.current) {
          showToast({ message: `Unified ${updatedStudentsCount} students across ${unifiedFamiliesCount} families with matching parent link codes!`, type: "success" });
        }
      } else {
        if (isMounted.current) {
          showToast({ message: "All sibling accounts are already correctly unified.", type: "info" });
        }
      }
    } catch (err: any) {
      if (isMounted.current) {
        console.error("Sibling unification error:", err);
        showToast({ message: "Failed to unify sibling codes.", type: "error" });
      }
    } finally {
      if (isMounted.current) {
        setUnifyLoading(false);
      }
    }
  };

  const handleFeeRemindersBroadcast = async () => {
    const fnName = "triggerFeeReminders";
    setCfLoading(prev => ({ ...prev, [fnName]: true }));
    try {
      const result = await broadcastFeeReminders();
      if (isMounted.current) {
        showToast({ message: result.message, type: "success" });
      }
    } catch (err: any) {
      if (isMounted.current) {
        console.error(`Error in broadcastFeeReminders:`, err);
        showToast({ message: "Broadcast failed. Check system logs.", type: "error" });
      }
    } finally {
      if (isMounted.current) {
        setCfLoading(prev => ({ ...prev, [fnName]: false }));
      }
    }
  };

  const performLogout = async () => {
    try {
      await signOut(auth);
      if (!isNavigating.current) {
        isNavigating.current = true;
        router.replace("/");
      }
    } catch (e) {
      if (isMounted.current) {
        console.error("Logout error", e);
        showToast({ message: "Failed to log out.", type: "error" });
      }
    }
  };

  const handleLogout = () => {
    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to sign out?")) {
        performLogout();
      }
    } else {
      Alert.alert(
        "Confirm Logout",
        "Are you sure you want to sign out?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Logout", style: "destructive", onPress: performLogout },
        ]
      );
    }
  };

  const runCleanup = async () => {
    setIsCleaning(true);
    try {
      const now = new Date();
      const snap = await getDocs(collection(db, "assignments"));

      const expiredDocs = snap.docs.filter((d) => {
        const data = d.data();
        if (!data.dueDate) return false;
        const due = data.dueDate.toDate ? data.dueDate.toDate() : new Date(data.dueDate);
        return due.getTime() < now.getTime();
      });

      if (expiredDocs.length === 0) {
        showToast({ message: "No expired assignments found.", type: "info" });
        return;
      }

      const batch = writeBatch(db);
      expiredDocs.forEach((d) => {
        batch.delete(d.ref);
      });
      await batch.commit();

      if (isMounted.current) {
        showToast({ message: `Cleaned up ${expiredDocs.length} expired assignments.`, type: "success" });
      }
    } catch (e) {
      if (isMounted.current) {
        console.error(e);
        showToast({ message: "Cleanup failed.", type: "error" });
      }
    } finally {
      if (isMounted.current) {
        setIsCleaning(false);
      }
    }
  };

  const settingsOptions = [
    {
      title: "Clear Expired Assignments",
      icon: "trash-outline",
      action: () => {
        if (Platform.OS === "web") {
          if (window.confirm("Purge all assignments with expired due dates from the system?")) {
            runCleanup();
          }
        } else {
          Alert.alert("Confirm Cleanup", "Purge all assignments with expired due dates from the system?", [
            { text: "Cancel", style: "cancel" },
            { text: "Run Purge", style: "destructive", onPress: runCleanup }
          ]);
        }
      },
      color: "#F59E0B",
      loading: isCleaning,
    },
    {
      title: "Financial Balance Reconcile",
      icon: "calculator",
      action: () => {
        if (Platform.OS === "web") {
          if (window.confirm("Re-calculate all student balances from scratch? This fixes discrepancies between billed vs paid amounts.")) {
            runFinanceCleanup();
          }
        } else {
          Alert.alert("Financial Reconciliation", "Re-calculate all student balances from scratch? This fixes discrepancies between billed vs paid amounts.", [
            { text: "Cancel", style: "cancel" },
            { text: "Reconcile All", style: "default", onPress: runFinanceCleanup }
          ]);
        }
      },
      color: "#8B5CF6",
      loading: isFinanceCleaning,
    },
    {
        title: "Broadcast Fee Reminders",
        icon: "notifications-outline",
        action: handleFeeRemindersBroadcast,
        color: "#F59E0B",
        loading: cfLoading["triggerFeeReminders"],
    },
    {
      title: "Repair Missing Codes (Signup & Parent)",
      icon: "key",
      action: () => {
        if (Platform.OS === "web") {
          if (window.confirm("Scan for missing signup codes and student parent link codes in the database and generate/fix them?")) {
            handleRepairSignupCodes();
          }
        } else {
          Alert.alert("Repair Codes", "Scan for missing signup codes and student parent link codes in the database and generate/fix them?", [
            { text: "Cancel", style: "cancel" },
            { text: "Repair Now", style: "default", onPress: handleRepairSignupCodes }
          ]);
        }
      },
      color: "#6366F1",
      loading: repairLoading,
    },
    {
      title: "Unify Sibling Parent Link Codes",
      icon: "people-circle-outline",
      action: () => {
        const confirmMsg = "Scan all students and assign siblings (sharing parent phone/name) the exact same Parent Link Code?";
        if (Platform.OS === "web") {
          if (window.confirm(confirmMsg)) {
            handleUnifySiblingLinkCodes();
          }
        } else {
          Alert.alert("Unify Sibling Codes", confirmMsg, [
            { text: "Cancel", style: "cancel" },
            { text: "Unify Now", style: "default", onPress: handleUnifySiblingLinkCodes }
          ]);
        }
      },
      color: "#10B981",
      loading: unifyLoading,
    },
    {
      title: "Logout",
      icon: "log-out-outline",
      action: handleLogout,
      color: "#EF4444",
    },
  ];

  const todayStr = moment().format('YYYY-MM-DD');

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => {
            if (isNavigating.current) return;
            isNavigating.current = true;
            router.back();
          }}
          style={styles.backBtn}
        >
           <SVGIcon name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.header, { color: theme.text }]}>Admin System Settings</Text>
      </View>
      
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Academic Off-Day & Data Preservation Triggers Card */}
        <View style={[styles.opCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <SVGIcon name="shield-checkmark" size={22} color={COLORS.primary} />
            <Text style={[styles.opTitle, { color: theme.text }]}>Academic Off-Days & Auto-Unlock Controls</Text>
          </View>
          <Text style={styles.opSub}>
            Set holidays, midterm breaks, and off-days in advance. When due, attendance and daily fee requirements pause automatically and auto-unlock when the day/period ends.
          </Text>

          <View style={styles.opBtnGrid}>
            <TouchableOpacity
              style={[
                styles.opBtn,
                activeOverride === 'open' && { backgroundColor: '#10b981', borderColor: '#059669' },
              ]}
              onPress={handleResetOperations}
              disabled={savingOperations}
            >
              <Text style={[styles.opBtnText, activeOverride === 'open' && { color: '#fff' }]}>
                🟢 Normal Operations (Unlocked)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.opBtn,
                activeOverride === 'holiday' && { backgroundColor: '#f59e0b', borderColor: '#d97706' },
              ]}
              onPress={() => openTriggerModal('holiday')}
              disabled={savingOperations}
            >
              <Text style={[styles.opBtnText, activeOverride === 'holiday' && { color: '#fff' }]}>
                🎈 Public / School Holiday
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.opBtn,
                activeOverride === 'mid_term' && { backgroundColor: '#0284c7', borderColor: '#0369a1' },
              ]}
              onPress={() => openTriggerModal('mid_term')}
              disabled={savingOperations}
            >
              <Text style={[styles.opBtnText, activeOverride === 'mid_term' && { color: '#fff' }]}>
                🏖️ Mid-Term Break (Select Dates)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.opBtn,
                activeOverride === 'vacation' && { backgroundColor: '#8b5cf6', borderColor: '#7c3aed' },
              ]}
              onPress={() => openTriggerModal('vacation')}
              disabled={savingOperations}
            >
              <Text style={[styles.opBtnText, activeOverride === 'vacation' && { color: '#fff' }]}>
                🌴 Vacation / Term Break (Next Term)
              </Text>
            </TouchableOpacity>
          </View>

          {activeOverride !== 'open' && (
            <View style={styles.activeOpBanner}>
              <SVGIcon name="lock-closed" size={16} color="#d97706" />
              <View style={{ flex: 1 }}>
                <Text style={styles.activeOpBannerText}>
                  Active Mode Today: <Text style={{ fontWeight: '800' }}>{activeOverride.toUpperCase()}</Text> ({overrideTitle || 'Off-Day'})
                </Text>
                {unlockDate ? (
                  <Text style={styles.activeOpUnlockText}>
                    🔓 Auto-Unlocks On: <Text style={{ fontWeight: '800' }}>{unlockDate}</Text>
                  </Text>
                ) : null}
              </View>
            </View>
          )}
        </View>

        {/* Scheduled Holidays & Off-Days Calendar Card */}
        <View style={[styles.opCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <SVGIcon name="calendar-outline" size={22} color={COLORS.primary} />
              <Text style={[styles.opTitle, { color: theme.text }]}>📅 Scheduled Off-Days & Holidays</Text>
            </View>
            <TouchableOpacity
              style={styles.addScheduleBtn}
              onPress={() => openTriggerModal('off_day')}
            >
              <Text style={styles.addScheduleBtnText}>+ Schedule Off-Day</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.opSub}>
            Admins can set future holidays and breaks in advance. When the set date arrives, the system automatically pauses daily attendance & fees, and auto-unlocks when done.
          </Text>

          {holidays.length === 0 ? (
            <View style={styles.emptyHolidaysBox}>
              <Text style={styles.emptyHolidaysText}>No holidays or breaks scheduled in advance yet.</Text>
            </View>
          ) : (
            <View style={styles.holidayListContainer}>
              {holidays.map((item, idx) => {
                const startDateStr = item.startDate || item.date || todayStr;
                const endDateStr = item.endDate || item.date || startDateStr;
                const isSingle = startDateStr === endDateStr;

                const isTodayActive = moment(todayStr).isBetween(moment(startDateStr), moment(endDateStr), 'day', '[]');
                const isFuture = moment(todayStr).isBefore(moment(startDateStr), 'day');
                const daysUntil = moment(startDateStr).diff(moment(todayStr), 'days');

                const iconName = item.type === 'vacation' ? '🌴' : item.type === 'mid_term' ? '🏖️' : '🎈';

                return (
                  <View key={item.id || item.date || idx} style={styles.holidayItemRow}>
                    <View style={styles.holidayItemLeft}>
                      <Text style={{ fontSize: 18, marginRight: 8 }}>{iconName}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.holidayItemTitle}>{item.title || 'Official Off-Day'}</Text>
                        <Text style={styles.holidayItemDates}>
                          {isSingle
                            ? moment(startDateStr).format('ddd, MMM D, YYYY')
                            : `${moment(startDateStr).format('MMM D')} – ${moment(endDateStr).format('MMM D, YYYY')}`}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.holidayItemRight}>
                      {isTodayActive ? (
                        <View style={[styles.badge, { backgroundColor: '#fef2f2', borderColor: '#fca5a5' }]}>
                          <Text style={[styles.badgeText, { color: '#dc2626' }]}>🔴 Active Today</Text>
                        </View>
                      ) : isFuture ? (
                        <View style={[styles.badge, { backgroundColor: '#eff6ff', borderColor: '#93c5fd' }]}>
                          <Text style={[styles.badgeText, { color: '#2563eb' }]}>
                            {daysUntil === 1 ? '⏳ Tomorrow' : `⏳ In ${daysUntil} days`}
                          </Text>
                        </View>
                      ) : (
                        <View style={[styles.badge, { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' }]}>
                          <Text style={[styles.badgeText, { color: '#64748b' }]}>🏁 Passed</Text>
                        </View>
                      )}

                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => handleDeleteHoliday(item)}
                        disabled={deletingHolidayId === (item.id || item.date)}
                      >
                        {deletingHolidayId === (item.id || item.date) ? (
                          <ActivityIndicator size="small" color="#ef4444" />
                        ) : (
                          <SVGIcon name="trash-outline" size={18} color="#ef4444" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.list}>
          {settingsOptions.map((option, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.item, { backgroundColor: theme.card, borderBottomWidth: index === settingsOptions.length - 1 ? 0 : 1, borderBottomColor: theme.border }]}
              onPress={option.action}
              activeOpacity={0.7}
            >
              <View style={[styles.iconBox, { backgroundColor: option.color + "15" }]}>
                {option.loading ? <ActivityIndicator size="small" color={option.color} /> : <SVGIcon name={option.icon} size={22} color={option.color} />}
              </View>
              <Text style={[styles.itemText, { color: theme.text }]}>{option.title}</Text>
              <SVGIcon name="chevron-forward" size={20} color={theme.gray} />
            </TouchableOpacity>
          ))}
        </View>

        {financeReport && (
          <View style={[styles.reportCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.reportTitle, { color: theme.text }]}>Last Integrity Scan Result</Text>
            <View style={styles.reportGrid}>
              <View style={styles.reportItem}>
                <Text style={styles.reportLabel}>Records Reconciled</Text>
                <Text style={[styles.reportValue, { color: "#10B981" }]}>{financeReport.fixedRecords}</Text>
              </View>
              <View style={styles.reportItem}>
                <Text style={styles.reportLabel}>Balances Reconciled</Text>
                <Text style={[styles.reportValue, { color: "#8B5CF6" }]}>{financeReport.reconciledBalances}</Text>
              </View>
            </View>
          </View>
        )}

        <Text style={[styles.versionText, { color: theme.gray }]}>Version 2.2.0 • EduEaze Platform</Text>
      </ScrollView>

      {/* Trigger & Advance Schedule Modal */}
      <Modal visible={modalMode !== 'none'} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {modalMode === 'vacation' && '🌴 Schedule Vacation / Term Break'}
                {modalMode === 'mid_term' && '🏖️ Schedule Mid-Term Break'}
                {modalMode === 'holiday' && '🎈 Schedule Public / School Holiday'}
                {modalMode === 'off_day' && '📅 Schedule School Off-Day'}
              </Text>
              <TouchableOpacity onPress={() => setModalMode('none')}>
                <SVGIcon name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>
              Set off-days in advance. When the set date arrives, app operations pause automatically and auto-unlock when school resumes.
            </Text>

            <Text style={styles.inputLabel}>Reason / Title</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Independence Day, Term 1 Mid-Term Break..."
              placeholderTextColor="#94a3b8"
              value={modalTitleInput}
              onChangeText={setModalTitleInput}
            />

            {(modalMode === 'holiday' || modalMode === 'off_day') && (
              <View style={styles.typeToggleRow}>
                <TouchableOpacity
                  style={[styles.typeToggleBtn, holidayDateType === 'single' && styles.typeToggleBtnActive]}
                  onPress={() => setHolidayDateType('single')}
                >
                  <Text style={[styles.typeToggleText, holidayDateType === 'single' && styles.typeToggleTextActive]}>
                    Single Day
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeToggleBtn, holidayDateType === 'range' && styles.typeToggleBtnActive]}
                  onPress={() => setHolidayDateType('range')}
                >
                  <Text style={[styles.typeToggleText, holidayDateType === 'range' && styles.typeToggleTextActive]}>
                    Multi-Day Range
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {modalMode === 'vacation' && (
              <View style={styles.fieldBox}>
                {renderDateField('Next Term Begins Date', vacationNextTermBegins, setVacationNextTermBegins, 'vacationNextTerm')}
                {!vacationNextTermBegins ? (
                  <Text style={styles.warningNote}>
                    ⚠️ Next Term Begins date is not set. Set the date above so the app auto-unlocks when school resumes.
                  </Text>
                ) : (
                  <Text style={styles.infoNote}>
                    🔓 App will automatically unlock on <Text style={{ fontWeight: '800' }}>{vacationNextTermBegins}</Text>.
                  </Text>
                )}
              </View>
            )}

            {modalMode === 'mid_term' && (
              <View style={styles.fieldBox}>
                {renderDateField('Break Start Date', midTermStartDate, setMidTermStartDate, 'midTermStart')}
                {renderDateField('Break End Date', midTermEndDate, setMidTermEndDate, 'midTermEnd')}
                <Text style={styles.infoNote}>
                  🔓 App will automatically unlock on <Text style={{ fontWeight: '800' }}>{moment(midTermEndDate).add(1, 'day').format('YYYY-MM-DD')}</Text> after the break.
                </Text>
              </View>
            )}

            {(modalMode === 'holiday' || modalMode === 'off_day') && (
              <View style={styles.fieldBox}>
                {holidayDateType === 'single' ? (
                  renderDateField('Holiday Date', holidayDate, setHolidayDate, 'holidayDate')
                ) : (
                  <>
                    {renderDateField('Start Date', holidayStartDate, setHolidayStartDate, 'holidayStart')}
                    {renderDateField('End Date', holidayEndDate, setHolidayEndDate, 'holidayEnd')}
                  </>
                )}
                <Text style={styles.infoNote}>
                  🔓 App will automatically unlock on <Text style={{ fontWeight: '800' }}>{moment(holidayDateType === 'single' ? holidayDate : holidayEndDate).add(1, 'day').format('YYYY-MM-DD')}</Text>.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setActivateImmediately(!activateImmediately)}
            >
              <View style={[styles.checkbox, activateImmediately && styles.checkboxChecked]}>
                {activateImmediately && <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>✓</Text>}
              </View>
              <Text style={styles.checkboxText}>⚡ Activate override mode immediately today</Text>
            </TouchableOpacity>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setModalMode('none')}
                disabled={savingOperations}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveBtn, { backgroundColor: COLORS.primary }]}
                onPress={handleSaveHolidayOrBreak}
                disabled={savingOperations}
              >
                {savingOperations ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>Save & Schedule Off-Day</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* DatePicker Overlay for Mobile Platforms */}
      {activeDatePickerTarget && DateTimePicker && (
        Platform.OS === 'ios' ? (
          <Modal visible transparent animationType="fade" onRequestClose={() => setActiveDatePickerTarget(null)}>
            <View style={styles.modalOverlay}>
              <View style={styles.iosTimePickerContainer}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Date</Text>
                  <TouchableOpacity onPress={() => setActiveDatePickerTarget(null)}>
                    <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 15 }}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={activeDatePickerDate}
                  mode="date"
                  display="spinner"
                  onChange={handleDateChange}
                />
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={activeDatePickerDate}
            mode="date"
            display="default"
            onChange={handleDateChange}
          />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: SIZES.medium,
    paddingTop: 60,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backBtn: {
    marginRight: 15,
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
      default: {}
    }),
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
  },
  opCard: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
    ...SHADOWS.small,
  },
  opTitle: { fontSize: 16, fontWeight: '800', marginLeft: 8 },
  opSub: { fontSize: 12, color: '#64748b', lineHeight: 17, marginBottom: 14 },
  opBtnGrid: { gap: 8 },
  opBtn: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#f8fafc', alignItems: 'center' },
  opBtnText: { fontSize: 13, fontWeight: '700', color: '#334155' },
  activeOpBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fffbeb', borderRadius: 10, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#fde68a' },
  activeOpBannerText: { fontSize: 12, color: '#d97706', fontWeight: '600' },
  activeOpUnlockText: { fontSize: 11, color: '#059669', marginTop: 2, fontWeight: '600' },

  // Scheduled Holidays Section
  addScheduleBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  addScheduleBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  emptyHolidaysBox: { padding: 14, backgroundColor: '#f8fafc', borderRadius: 10, alignItems: 'center' },
  emptyHolidaysText: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic' },
  holidayListContainer: { gap: 8 },
  holidayItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  holidayItemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  holidayItemTitle: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  holidayItemDates: { fontSize: 11, color: '#64748b', marginTop: 2 },
  holidayItemRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  deleteBtn: { padding: 4 },

  list: {
    borderRadius: 20,
    overflow: 'hidden',
    ...SHADOWS.small,
  },
  item: {
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
      default: {}
    }),
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  itemText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
  },
  versionText: {
    textAlign: 'center',
    marginTop: 30,
    marginBottom: 20,
    fontSize: 12,
    fontWeight: '500',
  },
  reportCard: {
    marginTop: 20,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    ...SHADOWS.small,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 15,
  },
  reportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  reportItem: {
    width: '45%',
  },
  reportLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  reportValue: {
    fontSize: 18,
    fontWeight: '700',
  },

  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContainer: { backgroundColor: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 450 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  modalSub: { fontSize: 12, color: '#64748b', lineHeight: 16, marginBottom: 16 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 },
  modalInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, height: 44, fontSize: 13, color: '#0f172a', marginBottom: 12 },
  typeToggleRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  typeToggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#f8fafc', alignItems: 'center' },
  typeToggleBtnActive: { backgroundColor: '#e0f2fe', borderColor: '#0284c7' },
  typeToggleText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  typeToggleTextActive: { color: '#0284c7', fontWeight: '800' },
  fieldBox: { marginTop: 4 },
  warningNote: { fontSize: 11, color: '#dc2626', fontStyle: 'italic', marginBottom: 12 },
  infoNote: { fontSize: 11, color: '#059669', marginBottom: 12 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, marginTop: 4 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkboxText: { fontSize: 12, color: '#334155', fontWeight: '600' },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  modalCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center' },
  modalCancelText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  modalSaveBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalSaveText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  datePickerBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  webDateRow: {
    gap: 6,
  },
  iosTimePickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 450,
  },
});

const webDateInputStyle = {
  border: '1px solid #cbd5e1',
  borderRadius: '10px',
  padding: '8px 12px',
  fontSize: '13px',
  color: '#0f172a',
  backgroundColor: '#f8fafc',
  fontFamily: 'inherit',
  cursor: 'pointer',
  outline: 'none',
  height: '42px',
  width: '100%',
  boxSizing: 'border-box' as const,
  marginTop: '4px',
};
