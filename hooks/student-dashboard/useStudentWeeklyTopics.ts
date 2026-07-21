import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { useAcademicConfig } from '../useAcademicConfig';
import moment from 'moment';

export interface WeeklyTopic {
  id: string;
  classId: string;
  className: string;
  subject: string;
  startDate: string; // ISO date
  endDate: string;   // ISO date
  topic: string;
  subTopics?: string;
  objectives?: string;
  teacherId: string;
  academicYear: string;
  term: string;
}

export const useStudentWeeklyTopics = () => {
  const { appUser } = useAuth();
  const acadConfig = useAcademicConfig();
  const [loading, setLoading] = useState(true);
  const [topics, setTopics] = useState<WeeklyTopic[]>([]);
  const [selectedWeek, setSelectedWeek] = useState(moment().startOf('isoWeek').format('YYYY-MM-DD'));

  const academicYear = acadConfig.academicYear || "";
  const term = acadConfig.currentTerm || "";

  const fetchTopics = useCallback(async () => {
    if (!appUser?.classId || !academicYear) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const q = query(
        collection(db, "weeklyTopics"),
        where("classId", "==", appUser.classId),
        where("startDate", "==", selectedWeek),
        where("academicYear", "==", academicYear)
      );

      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WeeklyTopic[];

      setTopics(list);
    } catch (err) {
      console.error("fetchStudentWeeklyTopics error:", err);
    } finally {
      setLoading(false);
    }
  }, [appUser?.classId, selectedWeek, academicYear]);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  const weekRange = {
    start: selectedWeek,
    end: moment(selectedWeek).add(4, 'days').format('YYYY-MM-DD')
  };

  return {
    loading,
    topics,
    selectedWeek,
    setSelectedWeek,
    weekRange,
    refresh: fetchTopics
  };
};
