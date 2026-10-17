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
  const [activeOverride, setActiveOverride] = useState<'open' | 'holiday' | 'mid_term' | 'vacation'>('open');
  const [overrideTitle, setOverrideTitle] = useState('');
  const [unlockDate, setUnlockDate] = useState('');
  const [savingOperations, setSavingOperations] = useState(false);

  // Modal states for Off-Day triggers
  const [modalMode, setModalMode] = useState<'none' | 'holiday' | 'mid_term' | 'vacation'>('none');
  const [vacationNextTermBegins, setVacationNextTermBegins] = useState('');
  const [midTermStartDate, setMidTermStartDate] = useState(moment().format('YYYY-MM-DD'));
  const [midTermEndDate, setMidTermEndDate] = useState(moment().add(5, 'days').format('YYYY-MM-DD'));
  const [holidayDate, setHolidayDate] = useState(moment().format('YYYY-MM-DD'));
  const [modalTitleInput, setModalTitleInput] = useState('');

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

  const { cleaning: isFinanceCleaning, runCleanup: runFinanceCleanup, report: financeReport } = useFinanceCleanup(showToast);

  const openTriggerModal = async (type: 'holiday' | 'mid_term' | 'vacation') => {
    setModalMode(type);
    if (type === 'vacation') {
      setModalTitleInput(overrideTitle || 'School Vacation / Term Break');
      // Fetch latest nextTermBegins date
      try {
        const acadSnap = await getDoc(doc(db, 'school_settings', 'academic_config'));
        if (acadSnap.exists() && acadSnap.data()?.nextTermBegins) {
          setVacationNextTermBegins(acadSnap.data().nextTermBegins.toString().trim());
        }
      } catch (e) {
        console.error(e);
      }
    } else if (type === 'mid_term') {
      setModalTitleInput(overrideTitle || 'Mid-Term Break');
      setMidTermStartDate(moment().format('YYYY-MM-DD'));
      setMidTermEndDate(moment().add(5, 'days').format('YYYY-MM-DD'));
    } else if (type === 'holiday') {
      setModalTitleInput(overrideTitle || 'Public / School Holiday');
      setHolidayDate(moment().format('YYYY-MM-DD'));
    }
  };

  const handleConfirmVacation = async () => {
    if (!vacationNextTermBegins.trim()) {
      showToast({ message: 'Please set the Next Term Begins date (YYYY-MM-DD).', type: 'error' });
      return;
    }

    setSavingOperations(true);
    try {
      const nextTermDateStr = vacationNextTermBegins.trim();

      // 1. Update academic_config in Firestore so Academic Calendar and app settings are synchronized
      await setDoc(doc(db, 'school_settings', 'academic_config'), {
        nextTermBegins: nextTermDateStr,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      // 2. Update teacherAttendanceConfig operational status with unlockDate = nextTermDateStr
      const payload = {
        activeOverride: 'vacation',
        overrideTitle: modalTitleInput.trim() || 'Vacation / End of Term Break',
        startDate: moment().format('YYYY-MM-DD'),
        unlockDate: nextTermDateStr,
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'teacherAttendanceConfig', schoolId), payload, { merge: true });

      if (isMounted.current) {
        setActiveOverride('vacation');
        setOverrideTitle(payload.overrideTitle);
        setUnlockDate(nextTermDateStr);
        setModalMode('none');
        showToast({
          message: `🌴 Vacation Mode Activated! Attendance & fees collection paused. App will auto-unlock on ${nextTermDateStr}.`,
          type: 'success',
        });
      }
    } catch (err) {
      if (isMounted.current) {
        console.error(err);
        showToast({ message: 'Failed to activate Vacation mode.', type: 'error' });
      }
    } finally {
      if (isMounted.current) setSavingOperations(false);
    }
  };

  const handleConfirmMidTerm = async () => {
    if (!midTermStartDate.trim() || !midTermEndDate.trim()) {
      showToast({ message: 'Please enter both start and end dates.', type: 'error' });
      return;
    }

    setSavingOperations(true);
    try {
      const startStr = midTermStartDate.trim();
      const endStr = midTermEndDate.trim();
      const calculatedUnlockDate = moment(endStr).add(1, 'day').format('YYYY-MM-DD');

      const payload = {
        activeOverride: 'mid_term',
        overrideTitle: modalTitleInput.trim() || 'Mid-Term Break',
        startDate: startStr,
        endDate: endStr,
        unlockDate: calculatedUnlockDate,
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'teacherAttendanceConfig', schoolId), payload, { merge: true });

      if (isMounted.current) {
        setActiveOverride('mid_term');
        setOverrideTitle(payload.overrideTitle);
        setUnlockDate(calculatedUnlockDate);
        setModalMode('none');
        showToast({
          message: `🏖️ Mid-Term Break Activated (${startStr} to ${endStr})! App will auto-unlock on ${calculatedUnlockDate}.`,
          type: 'success',
        });
      }
    } catch (err) {
      if (isMounted.current) {
        console.error(err);
        showToast({ message: 'Failed to activate Mid-Term Break.', type: 'error' });
      }
    } finally {
      if (isMounted.current) setSavingOperations(false);
    }
  };

  const handleConfirmHoliday = async () => {
    if (!holidayDate.trim()) {
      showToast({ message: 'Please enter the holiday date (YYYY-MM-DD).', type: 'error' });
      return;
    }

    setSavingOperations(true);
    try {
      const hDateStr = holidayDate.trim();
      const calculatedUnlockDate = moment(hDateStr).add(1, 'day').format('YYYY-MM-DD');

      const payload = {
        activeOverride: 'holiday',
        overrideTitle: modalTitleInput.trim() || 'Public / School Holiday',
        startDate: hDateStr,
        endDate: hDateStr,
        unlockDate: calculatedUnlockDate,
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'teacherAttendanceConfig', schoolId), payload, { merge: true });

      if (isMounted.current) {
        setActiveOverride('holiday');
        setOverrideTitle(payload.overrideTitle);
        setUnlockDate(calculatedUnlockDate);
        setModalMode('none');
        showToast({
          message: `🎈 Holiday Activated for ${hDateStr}! App will auto-unlock on ${calculatedUnlockDate}.`,
          type: 'success',
        });
      }
    } catch (err) {
      if (isMounted.current) {
        console.error(err);
        showToast({ message: 'Failed to activate Holiday mode.', type: 'error' });
      }
    } finally {
      if (isMounted.current) setSavingOperations(false);
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
            Trigger official school off-days (Holiday, Mid-Term Break, Vacation). Activating a trigger automatically pauses student/staff attendance marking and daily fees taking. Operations automatically resume/unlock on the set return date.
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
                  Active Mode: <Text style={{ fontWeight: '800' }}>{activeOverride.toUpperCase()}</Text> ({overrideTitle || 'Off-Day'})
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

      {/* Trigger Modals */}
      <Modal visible={modalMode !== 'none'} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {modalMode === 'vacation' && '🌴 Trigger Vacation / Term Break'}
                {modalMode === 'mid_term' && '🏖️ Trigger Mid-Term Break'}
                {modalMode === 'holiday' && '🎈 Trigger Public / School Holiday'}
              </Text>
              <TouchableOpacity onPress={() => setModalMode('none')}>
                <SVGIcon name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>
              {modalMode === 'vacation' && 'Vacation mode pauses daily attendance & fee taking until the Next Term Begins.'}
              {modalMode === 'mid_term' && 'Select the break start and end dates. The system automatically unlocks on the day after.'}
              {modalMode === 'holiday' && 'Set the holiday date and title. Operations automatically resume the next day.'}
            </Text>

            <Text style={styles.inputLabel}>Reason / Title</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Independence Day, Term 1 Mid-Term Break..."
              placeholderTextColor="#94a3b8"
              value={modalTitleInput}
              onChangeText={setModalTitleInput}
            />

            {modalMode === 'vacation' && (
              <View style={styles.fieldBox}>
                <Text style={styles.inputLabel}>Next Term Begins Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="YYYY-MM-DD (e.g. 2025-05-05)"
                  placeholderTextColor="#94a3b8"
                  value={vacationNextTermBegins}
                  onChangeText={setVacationNextTermBegins}
                />
                {!vacationNextTermBegins ? (
                  <Text style={styles.warningNote}>
                    ⚠️ Next Term Begins date is not set. Please set the date above so the app auto-unlocks when school resumes.
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
                <Text style={styles.inputLabel}>Break Start Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94a3b8"
                  value={midTermStartDate}
                  onChangeText={setMidTermStartDate}
                />
                <Text style={styles.inputLabel}>Break End Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94a3b8"
                  value={midTermEndDate}
                  onChangeText={setMidTermEndDate}
                />
                <Text style={styles.infoNote}>
                  🔓 App will automatically unlock on <Text style={{ fontWeight: '800' }}>{moment(midTermEndDate).add(1, 'day').format('YYYY-MM-DD')}</Text> after the break.
                </Text>
              </View>
            )}

            {modalMode === 'holiday' && (
              <View style={styles.fieldBox}>
                <Text style={styles.inputLabel}>Holiday Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94a3b8"
                  value={holidayDate}
                  onChangeText={setHolidayDate}
                />
                <Text style={styles.infoNote}>
                  🔓 App will automatically unlock on <Text style={{ fontWeight: '800' }}>{moment(holidayDate).add(1, 'day').format('YYYY-MM-DD')}</Text>.
                </Text>
              </View>
            )}

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
                onPress={
                  modalMode === 'vacation'
                    ? handleConfirmVacation
                    : modalMode === 'mid_term'
                    ? handleConfirmMidTerm
                    : handleConfirmHoliday
                }
                disabled={savingOperations}
              >
                {savingOperations ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>Activate & Set Auto-Unlock</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  fieldBox: { marginTop: 8 },
  warningNote: { fontSize: 11, color: '#dc2626', fontStyle: 'italic', marginBottom: 12 },
  infoNote: { fontSize: 11, color: '#059669', marginBottom: 12 },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  modalCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center' },
  modalCancelText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  modalSaveBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalSaveText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
