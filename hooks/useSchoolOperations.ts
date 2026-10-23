import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import Constants from 'expo-constants';
import moment from 'moment';
import { db } from '../firebaseConfig';
import { SCHOOL_CONFIG } from '../constants/Config';

export type OperationalType = 'open' | 'holiday' | 'mid_term' | 'vacation';

export interface SchoolHolidayItem {
  id?: string;
  date?: string; // YYYY-MM-DD
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  title: string;
  type?: OperationalType;
}

export interface OperationalConfig {
  activeOverride?: OperationalType;
  overrideTitle?: string;
  startDate?: string;
  endDate?: string;
  unlockDate?: string; // Auto-unlock date YYYY-MM-DD
  holidays?: SchoolHolidayItem[];
  blockAttendance?: boolean;
  blockFinancials?: boolean;
}

export interface SchoolOperationalStatus {
  isBlocked: boolean;
  blockAttendance: boolean;
  blockFinancials: boolean;
  statusType: OperationalType;
  statusTitle: string;
  isGlobalOverride: boolean;
  unlockDate?: string;
}

export function useSchoolOperations() {
  const [config, setConfig] = useState<OperationalConfig>({
    activeOverride: 'open',
    overrideTitle: '',
    startDate: '',
    endDate: '',
    unlockDate: '',
    holidays: [],
    blockAttendance: true,
    blockFinancials: true,
  });
  const [nextTermBeginsDate, setNextTermBeginsDate] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const schoolId = (
    Constants.expoConfig?.extra?.schoolId ||
    SCHOOL_CONFIG.schoolId ||
    'school'
  ).toLowerCase();

  useEffect(() => {
    // 1. Listen to teacherAttendanceConfig for operational overrides
    const docRef = doc(db, 'teacherAttendanceConfig', schoolId);
    const unsubscribeConfig = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as OperationalConfig;
          setConfig({
            activeOverride: data.activeOverride || 'open',
            overrideTitle: data.overrideTitle || '',
            startDate: data.startDate || '',
            endDate: data.endDate || '',
            unlockDate: data.unlockDate || '',
            holidays: Array.isArray(data.holidays) ? data.holidays : [],
            blockAttendance: data.blockAttendance !== false,
            blockFinancials: data.blockFinancials !== false,
          });
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error listening to school operations config:', err);
        setLoading(false);
      }
    );

    // 2. Listen to school_settings/academic_config for nextTermBegins date
    const academicRef = doc(db, 'school_settings', 'academic_config');
    const unsubscribeAcademic = onSnapshot(
      academicRef,
      (snap) => {
        if (snap.exists()) {
          const aData = snap.data();
          if (aData?.nextTermBegins) {
            setNextTermBeginsDate(aData.nextTermBegins.toString().trim());
          }
        }
      },
      (err) => {
        console.error('Error listening to academic config:', err);
      }
    );

    return () => {
      unsubscribeConfig();
      unsubscribeAcademic();
    };
  }, [schoolId]);

  const getOperationalStatus = useCallback(
    (targetDate?: string): SchoolOperationalStatus => {
      const todayStr = moment().format('YYYY-MM-DD');
      const dateToCheck = targetDate || todayStr;

      const override = config.activeOverride || 'open';
      const globalOverrideTitle = config.overrideTitle?.trim();

      // Effective auto-unlock date:
      // If vacation, prefer nextTermBeginsDate if set, otherwise config.unlockDate
      let effectiveUnlockDate = config.unlockDate;
      if (override === 'vacation' && nextTermBeginsDate) {
        effectiveUnlockDate = nextTermBeginsDate;
      }

      // AUTO-UNLOCK CHECK:
      // If active override exists AND today >= effectiveUnlockDate:
      // The break/vacation is over, so the app automatically unlocks!
      if (
        override !== 'open' &&
        effectiveUnlockDate &&
        moment(todayStr).isSameOrAfter(moment(effectiveUnlockDate), 'day')
      ) {
        return {
          isBlocked: false,
          blockAttendance: false,
          blockFinancials: false,
          statusType: 'open',
          statusTitle: 'Normal Operations (Auto-Unlocked)',
          isGlobalOverride: false,
          unlockDate: effectiveUnlockDate,
        };
      }

      // 1. Global Admin Trigger Override
      if (
        override !== 'open' &&
        (!config.startDate || moment(todayStr).isSameOrAfter(moment(config.startDate), 'day'))
      ) {
        let defaultTitle = 'School Operations Paused';
        if (override === 'holiday') defaultTitle = 'Official School Holiday';
        if (override === 'mid_term') defaultTitle = 'Mid-Term Break';
        if (override === 'vacation') defaultTitle = 'School Vacation / End of Term Break';

        return {
          isBlocked: true,
          blockAttendance: config.blockAttendance !== false,
          blockFinancials: config.blockFinancials !== false,
          statusType: override,
          statusTitle: globalOverrideTitle || defaultTitle,
          isGlobalOverride: true,
          unlockDate: effectiveUnlockDate,
        };
      }

      // 2. Specific Date / Scheduled Off-Days Calendar
      const dateHoliday = config.holidays?.find((h) => {
        const check = moment(dateToCheck, 'YYYY-MM-DD');
        if (h.date && h.date === dateToCheck) return true;
        if (h.startDate && h.endDate) {
          const start = moment(h.startDate, 'YYYY-MM-DD');
          const end = moment(h.endDate, 'YYYY-MM-DD');
          return check.isBetween(start, end, 'day', '[]');
        }
        if (h.startDate && !h.endDate && h.startDate === dateToCheck) {
          return true;
        }
        return false;
      });

      if (dateHoliday) {
        const type = dateHoliday.type || 'holiday';
        return {
          isBlocked: true,
          blockAttendance: true,
          blockFinancials: true,
          statusType: type,
          statusTitle: dateHoliday.title || 'Official School Off-Day',
          isGlobalOverride: false,
        };
      }

      // 3. Normal Open School Day
      return {
        isBlocked: false,
        blockAttendance: false,
        blockFinancials: false,
        statusType: 'open',
        statusTitle: 'Normal Operations',
        isGlobalOverride: false,
      };
    },
    [config, nextTermBeginsDate]
  );

  return {
    loading,
    config,
    nextTermBeginsDate,
    getOperationalStatus,
  };
}
